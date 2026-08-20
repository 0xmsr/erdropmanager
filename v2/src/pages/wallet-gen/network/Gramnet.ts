import { ethers } from 'ethers';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import { keyPairFromSeed, sha256_sync } from '@ton/crypto';
// Gram = rebrand dari TON (The Open Network) — chain & address format tetap
// identik. Derivasi pakai mnemonic BIP39 yang sama dengan chain lain di app
// ini (persis pola deriveSolanaAddress), lewat SLIP-0010 ed25519.
import {
  WalletContractV4, WalletContractV5R1, TonClient,
  internal, comment as tonComment, toNano, fromNano,
} from '@ton/ton';
import { Address, SendMode, Cell, beginCell, contractAddress, Dictionary } from '@ton/core';
import { getHttpEndpoints } from '@orbs-network/ton-access';
import type { GramVersion } from '../types';
import type { DetectedToken } from '../Walletgenerator';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

export const GRAM_COIN_TYPE = 607;
export const GRAM_WALLET_VERSIONS: { id: GramVersion; label: string }[] = [
  { id: 'v5r1', label: 'W5 / v5r1 (terbaru, gasless-ready)' },
  { id: 'v4',   label: 'V4R2 (legacy, kompatibel wallet lama)' },
];

export interface GramKeypair {
  publicKey: Buffer;
  secretKey: Buffer;
}

export function deriveGramKeypair(mnemonic: string, index: number): GramKeypair {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2);
  const path    = `m/44'/${GRAM_COIN_TYPE}'/${index}'`;
  const { key } = deriveEd25519Path(path, seedHex);
  return keyPairFromSeed(Buffer.from(key));
}

export function keypairFromGramPrivateKey(privateKeyHex: string): GramKeypair {
  const secretKey = Buffer.from(privateKeyHex.trim(), 'hex');
  if (secretKey.length !== 64) {
    throw new Error('Private key Gram (TON) tidak valid — harus 64 byte (128 karakter hex).');
  }
  return { secretKey, publicKey: secretKey.subarray(32, 64) };
}

export function buildGramWallet(publicKey: Buffer, version: GramVersion) {
  return version === 'v4'
    ? WalletContractV4.create({ workchain: 0, publicKey })
    : WalletContractV5R1.create({ workchain: 0, publicKey });
}

export async function deriveGramAddress(
  mnemonic: string,
  index: number,
  version: GramVersion = 'v5r1',
): Promise<{ address: string; privateKey: string; version: GramVersion }> {
  const keyPair = deriveGramKeypair(mnemonic, index);
  const wallet  = buildGramWallet(keyPair.publicKey, version);
  return {
    address:    wallet.address.toString({ bounceable: false, testOnly: false }),
    privateKey: Buffer.from(keyPair.secretKey).toString('hex'),
    version,
  };
}

export function gramAddressFromPrivateKey(privateKeyHex: string, version: GramVersion = 'v5r1'): string {
  const { publicKey } = keypairFromGramPrivateKey(privateKeyHex);
  const wallet = buildGramWallet(publicKey, version);
  return wallet.address.toString({ bounceable: false, testOnly: false });
}

export function isValidGramAddress(address: string): boolean {
  try { Address.parse(address.trim()); return true; } catch { return false; }
}

export interface GramNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  isTestnet: boolean;
  restBase: string;
  apiUrls: string[];
  apiKey?: string;
}

export const GRAM_NETWORKS: GramNetworkCfg[] = [
  {
    id: 'mainnet',
    name: 'Gram Mainnet',
    symbol: 'GRAM',
    color: '#0098EA',
    explorerUrl: 'https://tonscan.org',
    isTestnet: false,
    restBase: 'https://toncenter.com',
    apiUrls: ['https://toncenter.com/api/v2/jsonRPC',
    ],
  },
  {
    id: 'testnet',
    name: 'Gram Testnet',
    symbol: 'GRAM',
    color: '#66C0F4',
    explorerUrl: 'https://testnet.tonscan.org',
    isTestnet: true,
    restBase: 'https://testnet.toncenter.com',
    apiUrls: [
      'https://testnet.toncenter.com/api/v2/jsonRPC',
    ],
  },
];

const gramEndpointCache: Record<string, { urls: string[]; expiresAt: number }> = {};
const GRAM_ENDPOINT_CACHE_MS = 4 * 60 * 1000;

const gramEndpointCooldown: Record<string, number> = {};
const GRAM_COOLDOWN_MS = 90 * 1000;

function isGramEndpointHealthy(endpoint: string): boolean {
  const until = gramEndpointCooldown[endpoint];
  return !until || until < Date.now();
}

function markGramEndpointUnhealthy(endpoint: string, ms: number = GRAM_COOLDOWN_MS): void {
  gramEndpointCooldown[endpoint] = Date.now() + ms;
}

async function resolveGramEndpoints(net: GramNetworkCfg): Promise<string[]> {
  let urls: string[];
  const cached = gramEndpointCache[net.id];
  if (cached && cached.expiresAt > Date.now()) {
    urls = cached.urls;
  } else {
    urls = [...net.apiUrls];
    try {
      const orbsEndpoints = await Promise.race([
        getHttpEndpoints({ network: net.isTestnet ? 'testnet' : 'mainnet' }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
      ]);
      if (Array.isArray(orbsEndpoints) && orbsEndpoints.length > 0) {
        urls = [...orbsEndpoints, ...net.apiUrls];
      }
    } catch { /* Orbs gagal resolve (mis. offline) — tetap jalan pakai toncenter langsung */ }
    gramEndpointCache[net.id] = { urls, expiresAt: Date.now() + GRAM_ENDPOINT_CACHE_MS };
  }

  const healthy = urls.filter(isGramEndpointHealthy);
  return healthy.length > 0 ? healthy : urls;
}

function isGramRateLimitError(e: any): boolean {
  const msg = String(e?.message || e || '');
  return /429|rate limit|too many requests/i.test(msg);
}

const gramHostThrottleMs: Record<string, number> = {
  'toncenter.com': 1100,
  'testnet.toncenter.com': 1100,
};
let gramThrottleChain: Promise<void> = Promise.resolve();

function gramHostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

async function gramThrottleFor(endpoint: string): Promise<void> {
  const gapMs = gramHostThrottleMs[gramHostOf(endpoint)];
  if (!gapMs) return;
  const myTurn = gramThrottleChain.then(() => new Promise<void>(resolve => setTimeout(resolve, gapMs)));
  gramThrottleChain = myTurn;
  await myTurn;
}

async function withGramRetry<T>(fn: () => Promise<T>, retries = 1, baseDelayMs = 2000): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isGramRateLimitError(e) || attempt === retries) throw e;
      await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function getGramClient(net: GramNetworkCfg): Promise<TonClient> {
  const endpoints = await resolveGramEndpoints(net);
  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client = new TonClient({ endpoint, apiKey: net.apiKey });
      await withGramRetry(() => Promise.race([
        client.getMasterchainInfo(),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]));
      return client;
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

export async function getGramBalanceWithFallback(net: GramNetworkCfg, address: string): Promise<number> {
  const addr = Address.parse(address);
  const endpoints = await resolveGramEndpoints(net);
  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client  = new TonClient({ endpoint, apiKey: net.apiKey });
      const balance = await withGramRetry(() => Promise.race([
        client.getBalance(addr),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]));
      return Number(fromNano(balance.toString()));
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal.');
}

export type GramAccountStatus = 'active' | 'uninitialized' | 'frozen' | 'unknown';

export interface GramAccountState {
  status: GramAccountStatus;
  balanceNano: bigint;
  isDeployed: boolean;
  needsInitOnNextSend: boolean;
}

export const GRAM_DEPLOY_RESERVE_NANO = BigInt(50_000_000);

export async function getGramAccountState(net: GramNetworkCfg, address: string): Promise<GramAccountState> {
  const addr = Address.parse(address);
  const endpoints = await resolveGramEndpoints(net);
  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client = new TonClient({ endpoint, apiKey: net.apiKey });
      const state  = await withGramRetry(() => Promise.race([
        client.getContractState(addr),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]));
      const status: GramAccountStatus =
        state.state === 'active' ? 'active' :
        state.state === 'frozen' ? 'frozen' :
        'uninitialized';
      return {
        status,
        balanceNano: BigInt(state.balance.toString()),
        isDeployed: status === 'active',
        needsInitOnNextSend: status !== 'active',
      };
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error(`Tidak dapat cek status akun ${address} di ${net.name}.`);
}

export function gramActivationNote(state: GramAccountState): string | null {
  if (state.status === 'frozen') {
    return 'Akun ini berstatus FROZEN di jaringan Gram — tidak bisa kirim/terima sampai di-unfreeze.';
  }
  if (state.status === 'uninitialized') {
    const reserve = Number(fromNano(GRAM_DEPLOY_RESERVE_NANO.toString()));
    return state.balanceNano > 0n
      ? `Wallet ini sudah punya saldo tapi belum "aktif" di chain (belum pernah kirim keluar). ` +
        `Transaksi keluar PERTAMA akan otomatis deploy wallet contract-nya — sisain minimal ~${reserve} GRAM ` +
        `di luar jumlah kirim buat nutup gas deploy, atau tx bisa gagal.`
      : `Wallet ini belum pernah menerima dana sama sekali (uninitialized, saldo 0). ` +
        `Kirim dulu sejumlah GRAM ke address ini sebelum bisa dipakai kirim keluar.`;
  }
  return null;
}

export async function sendGram(
  net: GramNetworkCfg,
  privateKeyHex: string,
  toAddress: string,
  amountGram: number,
  commentText: string = '',
  version: GramVersion = 'v5r1',
): Promise<string> {
  if (!isValidGramAddress(toAddress)) {
    throw new Error('Address Gram (TON) tujuan tidak valid.');
  }
  if (!(amountGram > 0)) {
    throw new Error('Jumlah GRAM yang dikirim harus lebih dari 0.');
  }

  const keyPair = keypairFromGramPrivateKey(privateKeyHex);
  const wallet  = buildGramWallet(keyPair.publicKey, version);
  const endpoints = await resolveGramEndpoints(net);

  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client   = new TonClient({ endpoint, apiKey: net.apiKey });
      const contract = client.open(wallet);

      let seqno = 0;
      try { seqno = await withGramRetry(() => contract.getSeqno()); }
      catch { /* wallet belum aktif di chain — seqno awal 0 */ }

      await withGramRetry(() => contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [internal({
          to: Address.parse(toAddress.trim()),
          value: toNano(amountGram.toFixed(9)),
          bounce: false,
          body: commentText ? tonComment(commentText) : undefined,
        })],
      }));

      const landed = await pollGramSeqno(contract, seqno);
      if (!landed) {
        return '';
      }
      return await fetchGramLastTxHash(client, wallet.address);
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal saat kirim transaksi.');
}

export interface GramFeeEstimate {
  inFwdFeeNano: bigint;
  storageFeeNano: bigint;
  gasFeeNano: bigint;
  fwdFeeNano: bigint;
  totalFeeNano: bigint;
  totalFeeGram: number;
  willDeploy: boolean;
}

export async function estimateGramFee(
  net: GramNetworkCfg,
  privateKeyHex: string,
  toAddress: string,
  amountGram: number,
  commentText: string = '',
  version: GramVersion = 'v5r1',
): Promise<GramFeeEstimate> {
  if (!isValidGramAddress(toAddress)) {
    throw new Error('Address Gram (TON) tujuan tidak valid.');
  }
  if (!(amountGram > 0)) {
    throw new Error('Jumlah GRAM yang dikirim harus lebih dari 0.');
  }

  const keyPair = keypairFromGramPrivateKey(privateKeyHex);
  const wallet  = buildGramWallet(keyPair.publicKey, version);

  let willDeploy = false;
  try {
    const state = await getGramAccountState(net, wallet.address.toString());
    willDeploy = state.needsInitOnNextSend;
  } catch { /* best-effort */ }

  const endpoints = await resolveGramEndpoints(net);
  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client   = new TonClient({ endpoint, apiKey: net.apiKey });
      const contract = client.open(wallet);

      let seqno = 0;
      try { seqno = await withGramRetry(() => contract.getSeqno()); }
      catch { /* wallet belum aktif di chain — seqno awal 0 */ }

      const transferBody = (wallet as any).createTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [internal({
          to: Address.parse(toAddress.trim()),
          value: toNano(amountGram.toFixed(9)),
          bounce: false,
          body: commentText ? tonComment(commentText) : undefined,
        })],
      }) as Cell;

      const fees = await withGramRetry(() => client.estimateExternalMessageFee(wallet.address, {
        body: transferBody,
        initCode: willDeploy ? wallet.init.code : null,
        initData: willDeploy ? wallet.init.data : null,
        ignoreSignature: true,
      }));

      return gramFeeFromSourceFees(fees.source_fees, willDeploy);
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal saat estimasi fee.');
}

export async function estimateGramJettonFee(
  net: GramNetworkCfg,
  privateKeyHex: string,
  jettonMasterAddress: string,
  toAddress: string,
  amount: number,
  decimals: number,
  commentText: string = '',
  version: GramVersion = 'v5r1',
): Promise<GramFeeEstimate> {
  if (!isValidGramAddress(jettonMasterAddress)) throw new Error('Address kontrak Jetton tidak valid.');
  if (!isValidGramAddress(toAddress)) throw new Error('Address Gram (TON) tujuan tidak valid.');
  if (!(amount > 0)) throw new Error('Jumlah token yang dikirim harus lebih dari 0.');

  const keyPair = keypairFromGramPrivateKey(privateKeyHex);
  const wallet  = buildGramWallet(keyPair.publicKey, version);

  let willDeploy = false;
  try {
    const state = await getGramAccountState(net, wallet.address.toString());
    willDeploy = state.needsInitOnNextSend;
  } catch { /* best-effort */ }

  const senderJettonWalletAddr = await getGramJettonWalletAddress(net, jettonMasterAddress, wallet.address.toString());
  const senderJettonWallet     = Address.parse(senderJettonWalletAddr);
  const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));

  const transferBody = beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(Date.now(), 64)
    .storeCoins(rawAmount)
    .storeAddress(Address.parse(toAddress.trim()))
    .storeAddress(wallet.address)
    .storeBit(0)
    .storeCoins(toNano('0.01'))
    .storeBit(0)
    .endCell();

  const endpoints = await resolveGramEndpoints(net);
  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client   = new TonClient({ endpoint, apiKey: net.apiKey });
      const contract = client.open(wallet);

      let seqno = 0;
      try { seqno = await withGramRetry(() => contract.getSeqno()); }
      catch { /* wallet belum aktif di chain — seqno awal 0 */ }

      const outerBody = (wallet as any).createTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [internal({
          to: senderJettonWallet,
          value: toNano('0.06'),
          bounce: true,
          body: transferBody,
        })],
      }) as Cell;

      const fees = await withGramRetry(() => client.estimateExternalMessageFee(wallet.address, {
        body: outerBody,
        initCode: willDeploy ? wallet.init.code : null,
        initData: willDeploy ? wallet.init.data : null,
        ignoreSignature: true,
      }));

      return gramFeeFromSourceFees(fees.source_fees, willDeploy);
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal saat estimasi fee Jetton.');
}

function gramFeeFromSourceFees(
  f: { in_fwd_fee: number; storage_fee: number; gas_fee: number; fwd_fee: number },
  willDeploy: boolean,
): GramFeeEstimate {
  const inFwdFeeNano   = BigInt(Math.round(f.in_fwd_fee));
  const storageFeeNano = BigInt(Math.round(f.storage_fee));
  const gasFeeNano     = BigInt(Math.round(f.gas_fee));
  const fwdFeeNano     = BigInt(Math.round(f.fwd_fee));
  const totalFeeNano   = inFwdFeeNano + storageFeeNano + gasFeeNano + fwdFeeNano;
  return {
    inFwdFeeNano,
    storageFeeNano,
    gasFeeNano,
    fwdFeeNano,
    totalFeeNano,
    totalFeeGram: Number(fromNano(totalFeeNano.toString())),
    willDeploy,
  };
}

export interface GramMaxSendableResult {
  maxAmountGram: number;
  feeGram: number;
  willDeploy: boolean;
}

const GRAM_MAX_SAFETY_BUFFER_NANO = BigInt(5_000_000);
const GRAM_MAX_FEE_FALLBACK_NANO  = BigInt(10_000_000);

export async function estimateGramMaxSendable(
  net: GramNetworkCfg,
  privateKeyHex: string,
  version: GramVersion = 'v5r1',
): Promise<GramMaxSendableResult> {
  const keyPair = keypairFromGramPrivateKey(privateKeyHex);
  const wallet  = buildGramWallet(keyPair.publicKey, version);
  const address = wallet.address.toString();

  const state = await getGramAccountState(net, address);
  if (state.balanceNano <= 0n) {
    throw new Error('Saldo GRAM kosong.');
  }

  let feeNano = GRAM_MAX_FEE_FALLBACK_NANO;
  try {
    const est = await estimateGramFee(net, privateKeyHex, address, 0.001, '', version);
    feeNano = est.totalFeeNano;
  } catch { /* gagal estimasi — pakai fallback konservatif di atas */ }

  const reserveNano = state.needsInitOnNextSend ? GRAM_DEPLOY_RESERVE_NANO : 0n;
  const effFeeNano  = feeNano + reserveNano + GRAM_MAX_SAFETY_BUFFER_NANO;
  const maxNano     = state.balanceNano - effFeeNano;

  if (maxNano <= 0n) {
    throw new Error(
      'Saldo tidak cukup untuk menutup biaya fee' +
      (state.needsInitOnNextSend ? ' + deploy wallet (tx pertama).' : '.')
    );
  }

  return {
    maxAmountGram: Number(fromNano(maxNano.toString())),
    feeGram: Number(fromNano(effFeeNano.toString())),
    willDeploy: state.needsInitOnNextSend,
  };
}

async function pollGramSeqno(contract: { getSeqno: () => Promise<number> }, prevSeqno: number, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  let interval = 3000;
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, interval));
    try {
      const seqno = await contract.getSeqno();
      if (seqno !== prevSeqno) return true;
    } catch {
      interval = Math.min(interval * 1.3, 6000);
    }
  }
  return false;
}

async function fetchGramLastTxHash(
  client: TonClient,
  address: Address,
  retries = 4,
  delayMs = 1500,
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const txs  = await client.getTransactions(address, { limit: 1 });
      const hash = txs?.[0]?.hash?.();
      if (hash) return Buffer.from(hash).toString('hex');
    } catch { /* coba lagi di attempt berikutnya */ }
    if (attempt < retries) await new Promise(r => setTimeout(r, delayMs));
  }
  return '';
}

export function gramFriendlyError(e: any): string {
  const raw = String(e?.message || e || '');
  if (/exit_code.*-14|not enough (ton|gram|funds)|balance.*insufficient/i.test(raw)) {
    return 'Saldo GRAM tidak cukup untuk jumlah + gas transaksi (ditambah gas deploy kalau wallet belum pernah kirim keluar).';
  }
  if (/uninitialized|contract is not initialized|account.*not (exist|active)/i.test(raw)) {
    return 'Wallet belum aktif di chain (uninitialized/belum pernah nerima dana). Kirim dulu sejumlah GRAM ke address ini.';
  }
  if (/timeout/i.test(raw)) {
    return 'Koneksi ke RPC Gram timeout. Coba lagi beberapa saat.';
  }
  if (/rate limit|429|too many requests/i.test(raw)) {
    return 'RPC TonCenter membatasi request (rate limit). Tunggu sebentar lalu coba lagi.';
  }
  if (/invalid.*address|unknown address type/i.test(raw)) {
    return 'Format address Gram (TON) tidak valid.';
  }
  return raw || 'Transaksi Gram gagal (tidak ada detail error).';
}

export async function fetchGramTokenPortfolio(address: string, net: GramNetworkCfg = GRAM_NETWORKS[0]): Promise<DetectedToken[]> {
  const owner = Address.parse(address).toString({ bounceable: true, testOnly: net.isTestnet });

  let jettonWallets: any[] = [];
  try {
    const res = await Promise.race([
      fetch(`${net.restBase}/api/v3/jetton/wallets?owner_address=${encodeURIComponent(owner)}&limit=100`),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
    ]) as Response;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    jettonWallets = Array.isArray(json?.jetton_wallets) ? json.jetton_wallets : [];
  } catch (e: any) {
    throw new Error(`Gagal ambil data jetton dari TonCenter.${e?.message ? ` (${e.message})` : ' Coba lagi beberapa saat.'}`);
  }

  const holdings = jettonWallets.filter((w: any) => Number(w?.balance ?? 0) > 0);
  if (holdings.length === 0) return [];

  const masterAddrs = Array.from(new Set(holdings.map((h: any) => h.jetton as string)));
  const metaMap: Record<string, { name?: string; symbol?: string; decimals?: number; image?: string }> = {};
  await Promise.all(masterAddrs.map(async (addr) => {
    const resolved = await resolveGramJettonMeta(net, addr);
    if (resolved) metaMap[addr] = resolved;
  }));

  return holdings.map((h: any) => {
    const meta      = metaMap[h.jetton] || {};
    const decimals  = meta.decimals ?? 9;
    const balance   = Number(h.balance) / Math.pow(10, decimals);
    return {
      chain: 'gram',
      address: h.jetton,
      symbol: meta.symbol || 'JETTON',
      name: meta.name || 'Unknown Jetton',
      decimals,
      balance,
      balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
      usdPrice: null,
      usdValue: null,
      logo: meta.image || undefined,
    } as DetectedToken;
  });
}

export type GramTxDirection = 'in' | 'out' | 'unknown';

export interface GramTxHistoryEntry {
  hash: string;
  lt: string;
  timestamp: number;
  success: boolean;
  direction: GramTxDirection;
  amountGram: number;
  counterparty: string;
  comment: string;
  totalFeeGram: number;
  explorerUrl: string;
}

export interface GramTxHistoryPage {
  items: GramTxHistoryEntry[];
  nextBeforeLt: string | null;
}

function decodeGramMsgComment(msg: any): string {
  const decoded = msg?.message_content?.decoded?.comment;
  if (typeof decoded === 'string' && decoded.length > 0) return decoded;
  const bodyB64 = msg?.message_content?.body;
  if (!bodyB64) return '';
  try {
    const cell  = Cell.fromBase64(bodyB64);
    const slice = cell.beginParse();
    if (slice.remainingBits < 32) return '';
    const op = slice.loadUint(32);
    if (op !== 0) return '';
    let text = slice.loadStringTail?.() ?? '';
    return text.trim();
  } catch { return ''; }
}

function gramTxSuccess(t: any): boolean {
  const d = t?.description;
  if (!d) return true;
  if (d.aborted === true) return false;
  if (d.compute_ph?.success === false) return false;
  if (d.action?.success === false) return false;
  return true;
}

function gramTxHashToHex(hashB64: string): string {
  try { return Buffer.from(hashB64, 'base64').toString('hex'); } catch { return hashB64 || ''; }
}

function gramTxExplorerUrl(net: GramNetworkCfg, hashB64: string): string {
  try {
    const b64url = Buffer.from(hashB64, 'base64').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${net.explorerUrl}/tx/${b64url}`;
  } catch { return net.explorerUrl; }
}

export async function fetchGramTxHistory(
  net: GramNetworkCfg,
  address: string,
  opts: { limit?: number; beforeLt?: string | null } = {},
): Promise<GramTxHistoryPage> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  let owner: string;
  try {
    owner = Address.parse(address.trim()).toString({ bounceable: true, testOnly: net.isTestnet });
  } catch {
    throw new Error('Format address Gram (TON) tidak valid.');
  }

  const params = new URLSearchParams({
    account: owner,
    limit: String(limit),
    sort: 'desc',
  });
  if (opts.beforeLt) params.set('end_lt', opts.beforeLt);

  let json: any;
  try {
    const res = await Promise.race([
      fetch(`${net.restBase}/api/v3/transactions?${params.toString()}`),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
    ]) as Response;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (e: any) {
    throw new Error(`Gagal ambil riwayat transaksi dari TonCenter.${e?.message ? ` (${e.message})` : ' Coba lagi beberapa saat.'}`);
  }

  const rawTxs: any[] = Array.isArray(json?.transactions) ? json.transactions : [];

  const items: GramTxHistoryEntry[] = rawTxs.map((t) => {
    const inMsg   = t?.in_msg ?? null;
    const outMsgs: any[] = Array.isArray(t?.out_msgs) ? t.out_msgs : [];
    const hashB64 = t?.hash || '';

    let direction: GramTxDirection = 'unknown';
    let amountNano = 0n;
    let counterparty = '';
    let comment = '';

    if (inMsg && inMsg.source) {
      direction    = 'in';
      amountNano   = BigInt(inMsg.value || '0');
      counterparty = inMsg.source;
      comment      = decodeGramMsgComment(inMsg);
    } else if (outMsgs.length > 0) {
      direction    = 'out';
      amountNano   = outMsgs.reduce((sum, m) => sum + BigInt(m?.value || '0'), 0n);
      counterparty = outMsgs[0]?.destination || '';
      comment      = decodeGramMsgComment(outMsgs[0]);
    }

    return {
      hash: gramTxHashToHex(hashB64),
      lt: String(t?.lt ?? ''),
      timestamp: Number(t?.now ?? 0),
      success: gramTxSuccess(t),
      direction,
      amountGram: Number(fromNano(amountNano.toString())),
      counterparty,
      comment,
      totalFeeGram: Number(fromNano(String(t?.total_fees ?? '0'))),
      explorerUrl: gramTxExplorerUrl(net, hashB64),
    };
  });

  const nextBeforeLt = items.length === limit ? items[items.length - 1].lt : null;
  return { items, nextBeforeLt };
}


const JETTON_MINTER_CODE_B64 =
  'te6ccgECCwEAAe0AART/APSkE/S88sgLAQIBYgIDAgLMBAUCA3pgCQoD79mRDjgEit8GhpgYC42Eit8H0gGADpj+mf9qJofQB9IGpqGEAKqThdRxgamqiq44L5cCSA/SB9AGoYEGhAMGuQ/QAYEogaKCF4BFAqkGQoAn0BLGeLZmZk9qpwQQg97svvKThdcYEakuAB8YEYAmACcYEvgsIH+XhAYHCACT38FCIBuCoQCaoKAeQoAn0BLGeLAOeLZmSRZGWAiXoAegBlgGSQfIA4OmRlgWUD5f/k6DvADGRlgqxniygCfQEJ5bWJZmZkuP2AQA/jYD+gD6QPgoVBIIcFQgE1QUA8hQBPoCWM8WAc8WzMkiyMsBEvQA9ADLAMn5AHB0yMsCygfL/8nQUAjHBfLgShKhA1AkyFAE+gJYzxbMzMntVAH6QDAg1wsBwwCOH4IQ1TJ223CAEMjLBVADzxYi+gISy2rLH8s/yYBC+wCRW+IAMDUVxwXy4En6QDBZyFAE+gJYzxbMzMntVAAuUUPHBfLgSdQwAchQBPoCWM8WzMzJ7VQAfa289qJofQB9IGpqGDYY/BQAuCoQCaoKAeQoAn0BLGeLAOeLZmSRZGWAiXoAegBlgGT8gDg6ZGWBZQPl/+ToQAAfrxb2omh9AH0gamoYP6qQQA==';

const JETTON_WALLET_CODE_B64 =
  'te6ccgECEgEAAzQAART/APSkE/S88sgLAQIBYgIDAgLMBAUAG6D2BdqJofQB9IH0gahhAgHUBgcCAUgICQDDCDHAJJfBOAB0NMDAXGwlRNfA/AL4PpA+kAx+gAxcdch+gAx+gAwc6m0AALTH4IQD4p+pVIgupUxNFnwCOCCEBeNRRlSILqWMUREA/AJ4DWCEFlfB7y6k1nwCuBfBIQP8vCAAET6RDBwuvLhTYAIBIAoLAgEgEBEB8QD0z/6APpAIfAB7UTQ+gD6QPpA1DBRNqFSKscF8uLBKML/8uLCVDRCcFQgE1QUA8hQBPoCWM8WAc8WzMkiyMsBEvQA9ADLAMkg+QBwdMjLAsoHy//J0AT6QPQEMfoAINdJwgDy4sR3gBjIywVQCM8WcPoCF8trE8yAMA/c7UTQ+gD6QPpA1DAI0z/6AFFRoAX6QPpAU1vHBVRzbXBUIBNUFAPIUAT6AljPFgHPFszJIsjLARL0APQAywDJ+QBwdMjLAsoHy//J0FANxwUcsfLiwwr6AFGooYIImJaAggiYloAStgihggjk4cCgGKEn4w8l1wsBwwAjgDQ4PAK6CEBeNRRnIyx8Zyz9QB/oCIs8WUAbPFiX6AlADzxbJUAXMI5FykXHiUAioE6CCCOThwKoAggiYloCgoBS88uLFBMmAQPsAECPIUAT6AljPFgHPFszJ7VQAcFJ5oBihghBzYtCcyMsfUjDLP1j6AlAHzxZQB88WyXGAEMjLBSTPFlAG+gIVy2oUzMlx+wAQJBAjAA4QSRA4N18EAHbCALCOIYIQ1TJ223CAEMjLBVAIzxZQBPoCFstqEssfEss/yXL7AJM1bCHiA8hQBPoCWM8WAc8WzMntVADbO1E0PoA+kD6QNQwB9M/+gD6QDBRUaFSSccF8uLBJ8L/8uLCggjk4cCqABagFrzy4sOCEHvdl97Iyx8Vyz9QA/oCIs8WAc8WyXGAGMjLBSTPFnD6AstqzMmAQPsAQBPIUAT6AljPFgHPFszJ7VSAAgyAINch7UTQ+gD6QPpA1DAE0x+CEBeNRRlSILqCEHvdl94TuhKx8uLF0z8x+gAwE6BQI8hQBPoCWM8WAc8WzMntVIA==';

export const JETTON_MINTER_CODE = Cell.fromBase64(JETTON_MINTER_CODE_B64);
export const JETTON_WALLET_CODE = Cell.fromBase64(JETTON_WALLET_CODE_B64);

function encodeGramOffChainContent(uri: string): Cell {
  const bytes = Buffer.from(uri, 'utf-8');
  const build = (offset: number, isFirst: boolean): Cell => {
    const b = beginCell();
    if (isFirst) b.storeUint(0x01, 8);
    const cap   = isFirst ? 126 : 127;
    const chunk = bytes.subarray(offset, offset + cap);
    b.storeBuffer(chunk);
    const next = offset + cap;
    if (next < bytes.length) b.storeRef(build(next, false));
    return b.endCell();
  };
  return build(0, true);
}

function jettonWalletStateInit(ownerAddr: Address, minterAddr: Address, walletCode: Cell = JETTON_WALLET_CODE) {
  const data = beginCell()
    .storeCoins(0)
    .storeAddress(ownerAddr)
    .storeAddress(minterAddr)
    .storeRef(walletCode)
    .endCell();
  return { code: walletCode, data };
}

export function computeGramJettonWalletAddress(ownerAddress: string, jettonMasterAddress: string): string {
  const owner  = Address.parse(ownerAddress.trim());
  const master = Address.parse(jettonMasterAddress.trim());
  const addr   = contractAddress(0, jettonWalletStateInit(owner, master));
  return addr.toString({ bounceable: true });
}

export async function getGramJettonWalletAddress(
  net: GramNetworkCfg,
  jettonMasterAddress: string,
  ownerAddress: string,
): Promise<string> {
  const master = Address.parse(jettonMasterAddress.trim());
  const owner  = Address.parse(ownerAddress.trim());
  const ownerSlice = beginCell().storeAddress(owner).endCell();
  const endpoints = await resolveGramEndpoints(net);

  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client = new TonClient({ endpoint, apiKey: net.apiKey });
      const result = await withGramRetry(() => Promise.race([
        client.runMethod(master, 'get_wallet_address', [{ type: 'slice', cell: ownerSlice }]),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
      ]));
      return result.stack.readAddress().toString({ bounceable: true });
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error(`Gagal ambil address jetton-wallet dari ${net.name}.`);
}

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
];

function ipfsCidPath(uri: string): string | null {
  if (!uri.startsWith('ipfs://')) return null;
  return uri.slice('ipfs://'.length);
}

function ipfsUriToHttp(uri: string, gatewayBase: string = IPFS_GATEWAYS[0]): string {
  if (!uri) return uri;
  const cidPath = ipfsCidPath(uri);
  if (cidPath === null) return uri;
  return `${gatewayBase}${cidPath}`;
}

function decodeGramOnchainContentValue(cell: Cell): string | null {
  try {
    const slice = cell.beginParse();
    if (slice.remainingBits < 8) return null;
    const subTag = slice.loadUint(8);
    if (subTag !== 0x00) return null;
    const text = slice.loadStringTail?.() ?? '';
    return text || null;
  } catch { return null; }
}

function decodeGramOnchainContentDict(cell: Cell): {
  name?: string; symbol?: string; decimals?: number; image?: string; description?: string;
} | null {
  try {
    const dict = Dictionary.load(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell(), cell.beginParse());
    const readKey = (attr: string): string | undefined => {
      const hash = BigInt('0x' + sha256_sync(Buffer.from(attr, 'utf8')).toString('hex'));
      const valueCell = dict.get(hash);
      if (!valueCell) return undefined;
      return decodeGramOnchainContentValue(valueCell) ?? undefined;
    };
    const name        = readKey('name');
    const symbol      = readKey('symbol');
    const decimalsStr = readKey('decimals');
    const description = readKey('description');
    const imageRaw     = readKey('image');
    if (!name && !symbol && !decimalsStr && !imageRaw && !description) return null;
    return {
      name, symbol, description,
      decimals: decimalsStr !== undefined && decimalsStr.trim() !== '' && !isNaN(Number(decimalsStr)) ? Number(decimalsStr) : undefined,
      image: imageRaw ? ipfsUriToHttp(imageRaw) : undefined,
    };
  } catch { return null; }
}

function decodeGramOffChainContentUri(cell: Cell): string | null {
  try {
    const slice = cell.beginParse();
    if (slice.remainingBits < 8) return null;
    const tag = slice.loadUint(8);
    if (tag !== 0x01) return null;
    const uri = slice.loadStringTail?.() ?? '';
    return uri.trim() || null;
  } catch { return null; }
}


async function fetchGramJettonMetaJson(uri: string): Promise<{
  name?: string; symbol?: string; decimals?: number; image?: string; description?: string;
} | null> {
  const cidPath = ipfsCidPath(uri);
  const candidateGateways = cidPath !== null ? IPFS_GATEWAYS : [''];

  let lastErr: any = null;
  for (const gw of candidateGateways) {
    try {
      const url = cidPath !== null ? `${gw}${cidPath}` : uri;
      const res = await Promise.race([
        fetch(url),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]) as Response;
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
      const json = await res.json();
      const imageUri = json?.image ? String(json.image) : undefined;
      return {
        name: json?.name,
        symbol: json?.symbol,
        decimals: json?.decimals !== undefined && json?.decimals !== null ? Number(json.decimals) : undefined,
        image: imageUri ? ipfsUriToHttp(imageUri, gw || IPFS_GATEWAYS[0]) : undefined,
        description: json?.description,
      };
    } catch (e) { lastErr = e; continue; }
  }
  return null;
}

async function resolveGramJettonMetaOnchain(net: GramNetworkCfg, jettonMasterAddress: string): Promise<{
  name?: string; symbol?: string; decimals?: number; image?: string; description?: string;
} | null> {
  let master: Address;
  try { master = Address.parse(jettonMasterAddress.trim()); } catch { return null; }
  const endpoints = await resolveGramEndpoints(net);
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client = new TonClient({ endpoint, apiKey: net.apiKey });
      const result = await withGramRetry(() => Promise.race([
        client.runMethod(master, 'get_jetton_data'),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
      ]));
      const stack = result.stack;
      stack.readBigNumber();
      stack.readNumber();
      stack.readAddressOpt();
      const contentCell = stack.readCell();

      const uri = decodeGramOffChainContentUri(contentCell);
      if (uri) return await fetchGramJettonMetaJson(uri);

      const onchainDict = decodeGramOnchainContentDict(contentCell);
      if (onchainDict) return onchainDict;

      return null;

    } catch (e) { markGramEndpointUnhealthy(endpoint); }
  }
  return null;
}

async function resolveGramJettonMetaRest(net: GramNetworkCfg, jettonMasterAddress: string): Promise<{
  name?: string; symbol?: string; decimals?: number; image?: string; description?: string;
} | null> {
  try {
    const res = await fetch(`${net.restBase}/api/v3/jetton/masters?address=${encodeURIComponent(jettonMasterAddress.trim())}`);
    if (!res.ok) return null;
    const json    = await res.json();
    const item    = (json?.jetton_masters ?? [])[0];
    const content = item?.jetton_content;
    if (!content) return null;
    if (content.name || content.symbol || content.image) {
      return {
        name: content.name, symbol: content.symbol,
        decimals: content.decimals !== undefined && content.decimals !== null ? Number(content.decimals) : undefined,
        image: content.image ? ipfsUriToHttp(content.image) : undefined,
        description: content.description,
      };
    }
    if (typeof content.uri === 'string' && content.uri) return await fetchGramJettonMetaJson(content.uri);
    return null;
  } catch { return null; }
}

async function resolveGramJettonMeta(net: GramNetworkCfg, jettonMasterAddress: string): Promise<{
  name?: string; symbol?: string; decimals?: number; image?: string; description?: string;
} | null> {
  const onchain = await resolveGramJettonMetaOnchain(net, jettonMasterAddress);
  if (onchain && (onchain.name || onchain.symbol)) return onchain;
  const rest = await resolveGramJettonMetaRest(net, jettonMasterAddress);
  return rest ?? onchain;
}

export async function getGramJettonMeta(net: GramNetworkCfg, jettonMasterAddress: string): Promise<{
  name: string; symbol: string; decimals: number; image?: string;
} | null> {
  const resolved = await resolveGramJettonMeta(net, jettonMasterAddress);
  if (!resolved) return null;
  return {
    name:     resolved.name || 'Unknown Jetton',
    symbol:   resolved.symbol || 'JETTON',
    decimals: resolved.decimals ?? 9,
    image:    resolved.image || undefined,
  };
}

export interface GramJettonDeployParams {
  metadataUri: string;
  totalSupply: number;
  decimals: number;
}

export const GRAM_JETTON_DEPLOY_VALUE = toNano('0.07');

function buildGramJettonDeployMessage(
  adminAddress: Address,
  params: GramJettonDeployParams,
) {
  const contentCell = encodeGramOffChainContent(params.metadataUri.trim());
  const minterData  = beginCell()
    .storeCoins(0)
    .storeAddress(adminAddress)
    .storeRef(contentCell)
    .storeRef(JETTON_WALLET_CODE)
    .endCell();
  const minterStateInit = { code: JETTON_MINTER_CODE, data: minterData };
  const minterAddress   = contractAddress(0, minterStateInit);

  const rawAmount = BigInt(Math.round(params.totalSupply * Math.pow(10, params.decimals)));

  const masterMsg = beginCell()
    .storeUint(0x178d4519, 32)
    .storeUint(Date.now(), 64)
    .storeCoins(rawAmount)
    .storeAddress(minterAddress)
    .storeAddress(adminAddress)
    .storeCoins(0)
    .storeBit(0)
    .endCell();

  const mintBody = beginCell()
    .storeUint(21, 32)
    .storeUint(Date.now(), 64)
    .storeAddress(adminAddress)
    .storeCoins(toNano('0.05'))
    .storeRef(masterMsg)
    .endCell();

  return { minterAddress, minterStateInit, mintBody };
}

export async function estimateGramJettonDeployFee(
  net: GramNetworkCfg,
  privateKeyHex: string,
  params: { decimals: number; totalSupply?: number; metadataUri?: string },
  version: GramVersion = 'v5r1',
): Promise<GramFeeEstimate> {
  if (!Number.isInteger(params.decimals) || params.decimals < 0 || params.decimals > 18) {
    throw new Error('Decimals harus bilangan bulat 0–18.');
  }

  const keyPair     = keypairFromGramPrivateKey(privateKeyHex);
  const adminWallet = buildGramWallet(keyPair.publicKey, version);

  let willDeploy = false;
  try {
    const state = await getGramAccountState(net, adminWallet.address.toString());
    willDeploy = state.needsInitOnNextSend;
  } catch { /* best-effort */ }

  const placeholderUri = 'https://gateway.pinata.cloud/ipfs/QmPlaceholderPlaceholderPlaceholderPlaceholder1234';
  const { minterAddress, minterStateInit, mintBody } = buildGramJettonDeployMessage(adminWallet.address, {
    metadataUri: params.metadataUri?.trim() || placeholderUri,
    totalSupply: params.totalSupply ?? 1_000_000,
    decimals: params.decimals,
  });

  const endpoints = await resolveGramEndpoints(net);
  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client   = new TonClient({ endpoint, apiKey: net.apiKey });
      const contract = client.open(adminWallet);
      let seqno = 0;
      try { seqno = await withGramRetry(() => contract.getSeqno()); }
      catch { /* wallet belum aktif di chain — seqno awal 0 */ }

      const outerBody = (adminWallet as any).createTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [internal({
          to: minterAddress,
          value: GRAM_JETTON_DEPLOY_VALUE,
          bounce: false,
          init: minterStateInit,
          body: mintBody,
        })],
      }) as Cell;

      const fees = await withGramRetry(() => client.estimateExternalMessageFee(adminWallet.address, {
        body: outerBody,
        initCode: willDeploy ? adminWallet.init.code : null,
        initData: willDeploy ? adminWallet.init.data : null,
        ignoreSignature: true,
      }));

      return gramFeeFromSourceFees(fees.source_fees, willDeploy);
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal saat estimasi fee deploy Jetton.');
}

export async function deployGramJetton(
  net: GramNetworkCfg,
  privateKeyHex: string,
  params: GramJettonDeployParams,
  version: GramVersion = 'v5r1',
): Promise<{ jettonMasterAddress: string; jettonWalletAddress: string; txHash: string }> {
  if (!params.metadataUri.trim()) throw new Error('Metadata URI Jetton wajib diisi (upload JSON metadata dulu, mis. ke IPFS).');
  if (!(params.totalSupply > 0)) throw new Error('Total supply harus lebih dari 0.');
  if (!Number.isInteger(params.decimals) || params.decimals < 0 || params.decimals > 18) {
    throw new Error('Decimals harus bilangan bulat 0–18.');
  }

  const keyPair     = keypairFromGramPrivateKey(privateKeyHex);
  const adminWallet = buildGramWallet(keyPair.publicKey, version);

  const { minterAddress, minterStateInit, mintBody } = buildGramJettonDeployMessage(adminWallet.address, params);

  let lastErr: any;
  const endpoints = await resolveGramEndpoints(net);
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client   = new TonClient({ endpoint, apiKey: net.apiKey });
      const contract = client.open(adminWallet);
      let seqno = 0;
      try { seqno = await withGramRetry(() => contract.getSeqno()); }
      catch { /* wallet belum aktif di chain — seqno awal 0 */ }

      await withGramRetry(() => contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [internal({
          to: minterAddress,
          value: GRAM_JETTON_DEPLOY_VALUE,
          bounce: false,
          init: minterStateInit,
          body: mintBody,
        })],
      }));

      const landed = await pollGramSeqno(contract, seqno);
      let txHash = '';
      if (landed) {
        txHash = await fetchGramLastTxHash(client, adminWallet.address);
      }
      return {
        jettonMasterAddress: minterAddress.toString({ bounceable: true }),
        jettonWalletAddress: contractAddress(0, jettonWalletStateInit(adminWallet.address, minterAddress)).toString({ bounceable: true }),
        txHash,
      };
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal saat deploy Jetton.');
}

export async function sendGramJetton(
  net: GramNetworkCfg,
  privateKeyHex: string,
  jettonMasterAddress: string,
  toAddress: string,
  amount: number,
  decimals: number,
  commentText: string = '',
  version: GramVersion = 'v5r1',
): Promise<string> {
  if (!isValidGramAddress(jettonMasterAddress)) throw new Error('Address kontrak Jetton tidak valid.');
  if (!isValidGramAddress(toAddress)) throw new Error('Address Gram (TON) tujuan tidak valid.');
  if (!(amount > 0)) throw new Error('Jumlah token yang dikirim harus lebih dari 0.');

  const keyPair = keypairFromGramPrivateKey(privateKeyHex);
  const wallet  = buildGramWallet(keyPair.publicKey, version);

  const senderJettonWalletAddr = await getGramJettonWalletAddress(net, jettonMasterAddress, wallet.address.toString());
  const senderJettonWallet     = Address.parse(senderJettonWalletAddr);
  const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));

  const transferBody = beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(Date.now(), 64)
    .storeCoins(rawAmount)
    .storeAddress(Address.parse(toAddress.trim()))
    .storeAddress(wallet.address)
    .storeBit(0)
    .storeCoins(toNano('0.01'))
    .storeBit(0)
    .endCell();

  let lastErr: any;
  const endpoints = await resolveGramEndpoints(net);
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client   = new TonClient({ endpoint, apiKey: net.apiKey });
      const contract = client.open(wallet);
      let seqno = 0;
      try { seqno = await withGramRetry(() => contract.getSeqno()); }
      catch { /* wallet belum aktif di chain — seqno awal 0 */ }

      await withGramRetry(() => contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [internal({
          to: senderJettonWallet,
          value: toNano('0.06'),
          bounce: true,
          body: transferBody,
        })],
      }));

      const landed = await pollGramSeqno(contract, seqno);
      if (!landed) return '';
      return await fetchGramLastTxHash(client, wallet.address);
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal saat kirim Jetton.');
}
