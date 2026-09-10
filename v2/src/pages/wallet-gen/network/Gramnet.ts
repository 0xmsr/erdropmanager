import { ethers } from 'ethers';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import { keyPairFromSeed, sha256_sync, mnemonicValidate, mnemonicToPrivateKey } from '@ton/crypto';
// Gram = rebrand dari TON (The Open Network) — chain & address format tetap
// identik. Derivasi pakai mnemonic BIP39 yang sama dengan chain lain di app
// ini (persis pola deriveSolanaAddress), lewat SLIP-0010 ed25519.
import {
  WalletContractV4, WalletContractV5R1, TonClient,
  internal, comment as tonComment, toNano, fromNano,
} from '@ton/ton';
import { Address, SendMode, Cell, beginCell, contractAddress, Dictionary } from '@ton/core';
import { getHttpEndpoints } from '@orbs-network/ton-access';
import { StonApiClient, AssetTag } from '@ston-fi/api';
import { dexFactory, Client as StonSdkClient } from '@ston-fi/sdk';
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

// ── Import mnemonic dari Telegram Wallet / Tonkeeper / wallet TON native lain ──
// PENTING: mnemonic yang di-generate wallet TON "native" (app Wallet bawaan
// Telegram, Tonkeeper, MyTonWallet, dst) TIDAK memakai skema BIP39+BIP32/SLIP-0010
// seperti deriveGramKeypair() di atas (yang dipakai untuk menurunkan address Gram
// dari mnemonic multi-chain buatan app ini sendiri). Wallet TON native derive
// key langsung dari kata-kata mnemonic lewat PBKDF2-HMAC-SHA512, TANPA path
// derivation apapun — lihat spec resmi di
// https://docs.ton.org/develop/dapps/asset-processing/mnemonics/wallet-mnemonics.
// Karena beda algoritma total, mnemonic dari Telegram Wallet:
//   1) hampir pasti gagal lolos validasi checksum BIP39 biasa (ethers.utils.isValidMnemonic)
//   2) kalaupun "dipaksa" lewat deriveGramKeypair(), akan menghasilkan address Gram
//      yang SALAH / tidak cocok dengan yang muncul di app Telegram Wallet aslinya.
// Makanya proses import-nya harus lewat fungsi khusus ini.
//
// CATATAN: fitur "password" mnemonic TON (mode password terpisah yang didukung
// sebagian wallet TON) sengaja TIDAK didukung di sini. Fitur itu cuma berlaku untuk
// mnemonic yang sengaja dibuat dalam "mode password" — mayoritas mnemonic dari
// Telegram Wallet/Tonkeeper adalah mnemonic biasa tanpa mode itu, jadi menambahkan
// kolom password di UI lebih sering bikin bingung (kelihatan seperti "password
// salah" padahal mnemonic-nya memang tidak pakai skema itu) daripada membantu.
export async function isValidTonMnemonic(words: string[]): Promise<boolean> {
  try {
    return await mnemonicValidate(words, undefined);
  } catch {
    return false;
  }
}

export async function deriveGramFromTonMnemonic(
  words: string[],
  version: GramVersion = 'v5r1',
): Promise<{ address: string; privateKey: string; publicKey: string; version: GramVersion }> {
  const cleaned = words.map(w => w.trim().toLowerCase()).filter(Boolean);
  if (cleaned.length !== 24) {
    throw new Error(`Mnemonic wallet TON (Telegram Wallet / Tonkeeper) harus 24 kata, ditemukan ${cleaned.length} kata.`);
  }
  const valid = await isValidTonMnemonic(cleaned);
  if (!valid) {
    throw new Error('Mnemonic TON tidak valid — cek ejaan/urutan 24 katanya lagi.');
  }
  const keyPair = await mnemonicToPrivateKey(cleaned, undefined);
  const wallet  = buildGramWallet(keyPair.publicKey, version);
  return {
    address:    wallet.address.toString({ bounceable: false, testOnly: false }),
    privateKey: Buffer.from(keyPair.secretKey).toString('hex'),
    publicKey:  Buffer.from(keyPair.publicKey).toString('hex'),
    version,
  };
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

// Endpoint dari @orbs-network/ton-access itu gateway pihak ketiga yang
// mem-balance beban ke banyak node di belakang layar — network yang diminta
// cuma parameter permintaan, bukan sesuatu yang bisa kita verifikasi dari
// URL-nya sendiri (host-nya generik, "...ton.access.orbs.network", sama
// untuk mainnet maupun testnet). Kalau gateway ini lagi degradasi / salah
// rute, dia bisa diam-diam balikin endpoint jaringan yang SALAH tanpa error
// apapun — dan karena hasilnya di-cache 4 menit (GRAM_ENDPOINT_CACHE_MS),
// sekali salah, semua cek saldo dalam window itu ikut salah baca saldo
// testnet padahal yang dicek mainnet (atau sebaliknya).
//
// Endpoint langsung ke toncenter.com/testnet.toncenter.com (net.apiUrls)
// TIDAK punya masalah ini — jaringannya sudah pasti benar cuma dari hostname­
// nya sendiri. Makanya endpoint itu yang sekarang dicoba DULUAN; endpoint
// dinamis dari ton-access cuma dipakai sebagai cadangan tambahan kalau
// toncenter langsung gagal/kena rate-limit — bukan yang utama seperti
// sebelumnya.
function looksLikeWrongNetworkEndpoint(url: string, wantTestnet: boolean): boolean {
  const host = gramHostOf(url).toLowerCase();
  const mentionsTestnet = host.includes('testnet');
  // Cuma dibuang kalau host-nya secara eksplisit menyebut jaringan yang
  // berlawanan dengan yang diminta — host generik ton-access yang tidak
  // menyebut apa-apa tetap dianggap "kemungkinan aman" karena memang gak
  // bisa diverifikasi lewat URL doang.
  return wantTestnet ? false : mentionsTestnet;
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
      const safeOrbsEndpoints = (Array.isArray(orbsEndpoints) ? orbsEndpoints : [])
        .filter(u => !looksLikeWrongNetworkEndpoint(u, net.isTestnet));
      if (safeOrbsEndpoints.length > 0) {
        // toncenter langsung duluan (jaringannya pasti benar), ton-access
        // cuma cadangan tambahan.
        urls = [...net.apiUrls, ...safeOrbsEndpoints];
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

// ── Status jaringan (masterchain seqno terkini) — dipakai buat panel "live"
//    di tab GRAM Explorer, mirip panel "Latest Blocks" di sisi EVM. TON gak
//    punya konsep single "block number" linear kayak EVM (tiap workchain/shard
//    punya seqno sendiri), jadi yang dipakai sebagai acuan "block terkini"
//    adalah seqno block masterchain (workchain -1) — itu yang juga dipakai
//    Tonscan sebagai referensi block utama. ──
export interface GramMasterchainInfo {
  workchain: number;
  shard: string;
  latestSeqno: number;
}

export async function getGramMasterchainInfo(net: GramNetworkCfg): Promise<GramMasterchainInfo> {
  const endpoints = await resolveGramEndpoints(net);
  let lastErr: any;
  for (const endpoint of endpoints) {
    try {
      await gramThrottleFor(endpoint);
      const client = new TonClient({ endpoint, apiKey: net.apiKey });
      const info = await withGramRetry(() => Promise.race([
        client.getMasterchainInfo(),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]));
      return { workchain: info.workchain, shard: info.shard, latestSeqno: info.latestSeqno };
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error(`Tidak dapat ambil info masterchain ${net.name}.`);
}

// Format URL block Tonscan: https://tonscan.org/block/<workchain>:<shard>:<seqno>
export function gramMasterchainBlockExplorerUrl(net: GramNetworkCfg, info: GramMasterchainInfo): string {
  return `${net.explorerUrl}/block/${info.workchain}:${info.shard}:${info.latestSeqno}`;
}

// ── "Masterchain Detail" — daftar block masterchain terbaru & feed transaksi
//    terbaru jaringan (lintas workchain), pelengkap seqno tunggal di atas.
//    Mirip semangatnya panel "Latest Blocks" / "Latest Transactions" di
//    homepage Etherscan, tapi buat TON. Sumber: TonCenter REST v3, endpoint
//    `/blocks` & `/transactions` TANPA filter `account` (beda dari
//    fetchGramTxHistory yang selalu di-scope ke 1 address). ──
export interface GramLatestBlock {
  workchain: number;
  shard: string;
  seqno: number;
  timestamp: number; // gen_utime, unix seconds
  rootHash: string;
  fileHash: string;
  startLt: string;
  endLt: string;
  explorerUrl: string;
}

export async function fetchGramLatestBlocks(net: GramNetworkCfg, limit = 10): Promise<GramLatestBlock[]> {
  const params = new URLSearchParams({
    workchain: '-1', // masterchain aja -- ini yang jadi acuan "block terkini" di seluruh app ini
    limit: String(Math.min(Math.max(limit, 1), 50)),
    sort: 'desc',
  });
  let json: any;
  try {
    const res = await Promise.race([
      fetch(`${net.restBase}/api/v3/blocks?${params.toString()}`),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
    ]) as Response;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (e: any) {
    throw new Error(`Gagal ambil daftar block dari TonCenter.${e?.message ? ` (${e.message})` : ' Coba lagi beberapa saat.'}`);
  }

  const rawBlocks: any[] = Array.isArray(json?.blocks) ? json.blocks : [];
  return rawBlocks.map((b): GramLatestBlock => ({
    workchain: Number(b?.workchain ?? -1),
    shard: String(b?.shard ?? ''),
    seqno: Number(b?.seqno ?? 0),
    timestamp: Number(b?.gen_utime ?? 0),
    rootHash: b?.root_hash ?? '',
    fileHash: b?.file_hash ?? '',
    startLt: String(b?.start_lt ?? ''),
    endLt: String(b?.end_lt ?? ''),
    explorerUrl: `${net.explorerUrl}/block/${Number(b?.workchain ?? -1)}:${b?.shard ?? ''}:${Number(b?.seqno ?? 0)}`,
  }));
}

// ── Klasifikasi tipe akun (interface) & tipe transaksi (action) ala
//    Tonscan/TonViewer. Datanya BUKAN tebakan lokal — "interfaces" datang
//    dari address_book TonCenter v3 (deteksi kode kontrak per address), dan
//    tipe transaksi datang dari field "type" endpoint /api/v3/actions
//    (klasifikasi resmi TonCenter atas trace transaksi). ──
export const GRAM_ACCOUNT_TYPES: Record<string, { label: string; color: string; description: string }> = {
  undetected:             { label: 'Tidak Terdeteksi',        color: '#888', description: 'Kontrak punya kode, tapi code hash-nya belum dikenali template manapun oleh TonCenter.' },
  wallet_v4r2:            { label: 'Wallet v4R2',             color: '#4caf50', description: 'Wallet standar v4R2 — versi paling umum dipakai (Tonkeeper, Tonhub, dst).' },
  jetton_wallet_v2:       { label: 'Jetton Wallet v2',         color: '#01a2ff', description: 'Kontrak jetton wallet standar TEP-74 versi 2 — nyimpen saldo 1 jenis token milik 1 owner.' },
  nft_item:               { label: 'NFT Item',                color: '#e81899', description: 'Kontrak 1 item NFT (TEP-62) — bagian dari sebuah NFT collection.' },
  jetton_wallet:          { label: 'Jetton Wallet',            color: '#01a2ff', description: 'Kontrak jetton wallet standar TEP-74 — nyimpen saldo 1 jenis token milik 1 owner.' },
  wallet_v5r1:            { label: 'Wallet v5R1',              color: '#4caf50', description: 'Wallet standar v5R1 (W5) — versi terbaru, support gasless & multi-message.' },
  jetton_wallet_v1:       { label: 'Jetton Wallet v1',         color: '#01a2ff', description: 'Kontrak jetton wallet TEP-74 versi lama (v1).' },
  uninited:               { label: 'Belum Aktif',              color: '#555', description: 'Address ada di address book, tapi belum pernah dideploy / gak punya kode kontrak (uninitialized).' },
  jetton_wallet_governed: { label: 'Jetton Wallet (Governed)', color: '#01a2ff', description: 'Jetton wallet dari jetton yang punya admin/governance khusus (mis. bisa di-freeze admin).' },
  wallet_v3r2:            { label: 'Wallet v3R2',              color: '#4caf50', description: 'Wallet standar v3R2 — versi lama, masih banyak dipakai wallet lawas.' },
  other:                  { label: 'Lainnya',                  color: '#aaa', description: 'Interface terdeteksi tapi di luar daftar kategori umum di atas.' },
};

// Urutan prioritas kalau 1 address kebetulan punya >1 interface terdeteksi.
const GRAM_ACCOUNT_TYPE_PRIORITY = [
  'jetton_wallet_governed', 'jetton_wallet_v2', 'jetton_wallet_v1', 'jetton_wallet',
  'nft_item', 'wallet_v5r1', 'wallet_v4r2', 'wallet_v3r2', 'uninited',
];

export function classifyGramAccountType(interfaces: string[] | null | undefined): string {
  if (!interfaces || interfaces.length === 0) return 'undetected';
  for (const key of GRAM_ACCOUNT_TYPE_PRIORITY) {
    if (interfaces.includes(key)) return key;
  }
  if (interfaces.includes('undetected')) return 'undetected';
  return GRAM_ACCOUNT_TYPES[interfaces[0]] ? interfaces[0] : 'other';
}

export const GRAM_TX_TYPES: Record<string, { label: string; color: string; description: string }> = {
  SimpleTransfer:           { label: 'Transfer GRAM',             color: '#4caf50', description: 'Transfer TON/GRAM polos ke address lain, tanpa payload khusus.' },
  unknown:                  { label: 'Tidak Diketahui',            color: '#555', description: 'Tipe belum berhasil diklasifikasi (lookup Actions API gagal/timeout, atau belum diindeks).' },
  TextComment:              { label: 'Comment / Memo',             color: '#61dfff', description: 'Transfer yang menyertakan pesan teks (op 0x00000000) — biasanya buat memo exchange/CEX.' },
  Excess:                   { label: 'Excess (Sisa Gas)',          color: '#888', description: 'Pesan balasan otomatis dari kontrak, ngembaliin sisa gas yang gak kepake.' },
  WalletSignedExternalV5R1: { label: 'Wallet v5R1 Signed',         color: '#e8a119', description: 'Pesan eksternal yang ditandatangani & dieksekusi oleh wallet v5R1 (W5) milik user.' },
  JettonTransfer:           { label: 'Jetton Transfer',            color: '#01a2ff', description: 'Transfer token (jetton) dari 1 jetton wallet ke jetton wallet lain.' },
  JettonInternalTransfer:   { label: 'Jetton Internal Transfer',   color: '#01a2ff', description: 'Pesan internal jetton wallet → jetton wallet tujuan buat nge-mint saldo si penerima.' },
  JettonNotify:             { label: 'Jetton Notify',              color: '#01a2ff', description: 'Notifikasi ke kontrak penerima (mis. DEX) bahwa jetton sudah masuk — dipicu abis transfer.' },
  WalletSignedV4:           { label: 'Wallet v4 Signed',           color: '#e8a119', description: 'Pesan eksternal yang ditandatangani & dieksekusi oleh wallet v4 milik user.' },
  TeleitemStartAuction:     { label: 'Lelang Domain .ton',         color: '#e81899', description: 'Mulai lelang NFT domain .ton (Telemint/DNS auction).' },
  other:                    { label: 'Lainnya',                    color: '#aaa', description: 'Tipe action terdeteksi tapi di luar daftar kategori umum di atas.' },
};

export function classifyGramTxType(actionType: string | null | undefined): string {
  if (!actionType) return 'unknown';
  return GRAM_TX_TYPES[actionType] ? actionType : 'other';
}

export interface GramLatestTx {
  hash: string;
  timestamp: number;
  workchain: number;
  fromAddress: string | null;
  toAddress: string | null;
  amountGram: number | null;
  totalFeeGram: number;
  success: boolean;
  comment: string;
  explorerUrl: string;
  // Key di GRAM_TX_TYPES, hasil klasifikasi TonCenter Actions API (best-effort —
  // fallback 'unknown' kalau lookup actions gagal/timeout).
  txType: string;
  // ── Detail tambahan ala Etherscan-lite, buat panel "Akun Terbaru & Transaksi
  //    Terbaru" yang lebih informatif ──
  lt: string | null;              // logical time transaksi (urutan pasti di dalam 1 account)
  opCode: string | null;          // opcode pesan masuk (hex), ex. "0x00000000" = simple transfer/comment
  outMsgCount: number;            // jumlah pesan keluar dari transaksi ini
  computeExitCode: number | null; // exit code compute phase (0 = sukses)
  accountBalanceAfter: number | null; // saldo account SETELAH transaksi ini (GRAM)
}

// -- Feed transaksi terbaru LINTAS WORKCHAIN (bukan punya 1 address kayak
//    fetchGramTxHistory) — dipakai buat nunjukin denyut jaringan GRAM secara
//    umum. Karena gak ada 1 "owner" yang jadi acuan in/out, from/to diambil
//    apa adanya dari in_msg (kalau ada) & out_msgs pertama. --
export async function fetchGramLatestTransactions(net: GramNetworkCfg, limit = 10): Promise<GramLatestTx[]> {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 50)),
    sort: 'desc',
  });
  let json: any;
  try {
    const res = await Promise.race([
      fetch(`${net.restBase}/api/v3/transactions?${params.toString()}`),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
    ]) as Response;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (e: any) {
    throw new Error(`Gagal ambil feed transaksi dari TonCenter.${e?.message ? ` (${e.message})` : ' Coba lagi beberapa saat.'}`);
  }

  // -- Klasifikasi tipe transaksi (op) via endpoint /api/v3/actions TonCenter,
  //    dicocokkan ke tiap tx lewat hash (field "transactions" tiap action).
  //    Best-effort: kalau endpoint ini gagal/timeout, feed utama TETAP tampil,
  //    cuma semua tx jatuh ke fallback 'unknown'. --
  const txTypeByHash = new Map<string, string>();
  try {
    const actionsParams = new URLSearchParams({
      limit: String(Math.min(Math.max(limit, 1), 50)),
      sort: 'desc',
      include_accounts: 'false',
    });
    const actionsRes = await Promise.race([
      fetch(`${net.restBase}/api/v3/actions?${actionsParams.toString()}`),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
    ]) as Response;
    if (actionsRes.ok) {
      const actionsJson = await actionsRes.json();
      const rawActions: any[] = Array.isArray(actionsJson?.actions) ? actionsJson.actions : [];
      for (const a of rawActions) {
        const type = classifyGramTxType(a?.type);
        const txHashes: string[] = Array.isArray(a?.transactions) ? a.transactions : [];
        for (const h of txHashes) {
          if (!txTypeByHash.has(h)) txTypeByHash.set(h, type);
        }
      }
    }
  } catch { /* best-effort, biarin fallback 'unknown' di bawah */ }

  const rawTxs: any[] = Array.isArray(json?.transactions) ? json.transactions : [];
  return rawTxs.map((t): GramLatestTx => {
    const inMsg = t?.in_msg ?? null;
    const outMsgs: any[] = Array.isArray(t?.out_msgs) ? t.out_msgs : [];
    const hashB64 = t?.hash || '';

    let fromAddress: string | null = null;
    let toAddress: string | null = null;
    let amountNano: bigint | null = null;

    if (inMsg && inMsg.source) {
      fromAddress = inMsg.source;
      toAddress   = inMsg.destination ?? null;
      amountNano  = BigInt(inMsg.value || '0');
    } else if (outMsgs.length > 0) {
      fromAddress = t?.account ?? null;
      toAddress   = outMsgs[0]?.destination ?? null;
      amountNano  = outMsgs.reduce((sum, m) => sum + BigInt(m?.value || '0'), 0n);
    }

    return {
      hash: gramTxHashToHex(hashB64),
      timestamp: Number(t?.now ?? 0),
      workchain: typeof t?.account === 'string' && t.account.includes(':') ? Number(t.account.split(':')[0]) : Number(t?.workchain ?? 0),
      fromAddress,
      toAddress,
      amountGram: amountNano !== null ? Number(fromNano(amountNano.toString())) : null,
      totalFeeGram: Number(fromNano(String(t?.total_fees ?? '0'))),
      success: gramTxSuccess(t),
      comment: decodeGramMsgComment(inMsg ?? outMsgs[0]),
      explorerUrl: gramTxExplorerUrl(net, hashB64),
      txType: txTypeByHash.get(hashB64) ?? 'unknown',
      lt: t?.lt != null ? String(t.lt) : null,
      opCode: (inMsg?.opcode ?? outMsgs[0]?.opcode) ?? null,
      outMsgCount: outMsgs.length,
      computeExitCode: typeof t?.description?.compute_ph?.exit_code === 'number' ? t.description.compute_ph.exit_code : null,
      accountBalanceAfter: t?.account_state_after?.balance != null ? Number(fromNano(String(t.account_state_after.balance))) : null,
    };
  });
}

// ── "Latest Accounts" — TON gak punya feed native "akun terbaru" kayak
//    Etherscan, jadi diturunin dari address_book milik feed transaksi
//    terbaru (/api/v3/transactions), yang isinya udah ngandung hasil
//    deteksi interface (tipe kontrak) tiap address yang nongol di situ.
//    Diambil dari batch tx yang lebih besar dari `limit` biar address
//    unik yang kekumpul cukup. ──
export const GRAM_ACCOUNT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Aktif',                   color: '#4caf50' },
  uninit:   { label: 'Belum Diinisialisasi',    color: '#888' },
  frozen:   { label: 'Frozen',                  color: '#ff6666' },
  nonexist: { label: 'Tidak Ada',               color: '#555' },
};

export interface GramLatestAccount {
  address: string;          // raw address dari address_book (workchain:hex)
  friendlyAddress: string;  // user_friendly kalau ada, fallback ke raw
  accountType: string;      // key di GRAM_ACCOUNT_TYPES
  interfaces: string[];
  domain: string | null;
  explorerUrl: string;
  // ── Detail otoritatif dari /api/v3/accountStates (bukan cuma dari
  //    address_book) — status kontrak, saldo terkini, code hash. ──
  status: string | null;          // 'active' | 'uninit' | 'frozen' | 'nonexist'
  balanceGram: number | null;
  codeHash: string | null;
  lastTxLt: string | null;        // logical time transaksi terakhir account ini
  lastSeenAt: number | null;      // best-effort: timestamp tx terakhir yg kelihatan di feed ini (bukan aktivitas absolut)
  // ── Detail tambahan ala explorer TON pada umumnya (Tonscan/Tonviewer) —
  //    data hash kontrak, hash tx terakhir, frozen hash (kalau status
  //    frozen), & jumlah get-method yang terdeteksi di kode kontrak. Semua
  //    best-effort: kalau field-nya gak ada di response, tetap null, gak
  //    bikin daftar akun gagal tampil. ──
  dataHash: string | null;
  lastTxHash: string | null;
  frozenHash: string | null;
  getMethodsCount: number | null;
}

export async function fetchGramLatestAccounts(net: GramNetworkCfg, limit = 10): Promise<GramLatestAccount[]> {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(limit * 3, 1), 100)),
    sort: 'desc',
  });
  let json: any;
  try {
    const res = await Promise.race([
      fetch(`${net.restBase}/api/v3/transactions?${params.toString()}`),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
    ]) as Response;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (e: any) {
    throw new Error(`Gagal ambil daftar akun dari TonCenter.${e?.message ? ` (${e.message})` : ' Coba lagi beberapa saat.'}`);
  }

  const addressBook: Record<string, { user_friendly?: string; domain?: string | null; interfaces?: string[] }> = json?.address_book ?? {};
  const rawTxs: any[] = Array.isArray(json?.transactions) ? json.transactions : [];

  // -- Best-effort "terlihat terakhir" — cuma dari batch tx yang barusan
  //    ditarik di atas, BUKAN riwayat lengkap account. Cukup buat konteks
  //    "kenapa account ini nongol di daftar", bukan acuan aktivitas absolut. --
  const lastSeenByAddr = new Map<string, number>();
  for (const t of rawTxs) {
    const addr = typeof t?.account === 'string' ? t.account : null;
    const ts = Number(t?.now ?? 0);
    if (addr && (!lastSeenByAddr.has(addr) || ts > (lastSeenByAddr.get(addr) ?? 0))) {
      lastSeenByAddr.set(addr, ts);
    }
  }

  const rawAddrs = Object.keys(addressBook).slice(0, Math.max(limit, 1));

  // -- Status/saldo/code hash OTORITATIF via /api/v3/accountStates, dipanggil
  //    batch buat semua address yang mau ditampilkan. Best-effort: kalau
  //    gagal/timeout, daftar akun TETAP tampil, cuma tanpa status & saldo. --
  const stateByAddr = new Map<string, {
    status: string | null; balanceGram: number | null; codeHash: string | null; lastTxLt: string | null; interfaces: string[];
    dataHash: string | null; lastTxHash: string | null; frozenHash: string | null; getMethodsCount: number | null;
  }>();
  if (rawAddrs.length > 0) {
    try {
      const stateParams = new URLSearchParams();
      for (const a of rawAddrs) stateParams.append('address', a);
      stateParams.set('include_boc', 'false');
      const stateRes = await Promise.race([
        fetch(`${net.restBase}/api/v3/accountStates?${stateParams.toString()}`),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]) as Response;
      if (stateRes.ok) {
        const stateJson = await stateRes.json();
        const rawAccounts: any[] = Array.isArray(stateJson?.accounts) ? stateJson.accounts : [];
        for (const acc of rawAccounts) {
          const addr = acc?.address;
          if (!addr) continue;
          stateByAddr.set(addr, {
            status: acc?.status ?? null,
            balanceGram: acc?.balance != null ? Number(fromNano(String(acc.balance))) : null,
            codeHash: acc?.code_hash ?? null,
            lastTxLt: acc?.last_transaction_lt != null ? String(acc.last_transaction_lt) : null,
            interfaces: Array.isArray(acc?.interfaces) ? acc.interfaces : [],
            dataHash: acc?.data_hash ?? null,
            lastTxHash: acc?.last_transaction_hash ?? null,
            frozenHash: acc?.frozen_hash ?? null,
            getMethodsCount: Array.isArray(acc?.get_methods) ? acc.get_methods.length : null,
          });
        }
      }
    } catch { /* best-effort, biarin status/saldo kosong di bawah */ }
  }

  const out: GramLatestAccount[] = [];
  for (const rawAddr of rawAddrs) {
    const info = addressBook[rawAddr];
    const state = stateByAddr.get(rawAddr);
    const friendly = info?.user_friendly || rawAddr;
    // Interfaces dari accountStates lebih otoritatif (langsung dari deteksi
    // kode kontrak saat ini) — fallback ke address_book kalau gak ketemu.
    const mergedInterfaces = state?.interfaces?.length ? state.interfaces : (info?.interfaces ?? []);
    out.push({
      address: rawAddr,
      friendlyAddress: friendly,
      accountType: state?.status === 'uninit' ? 'uninited' : classifyGramAccountType(mergedInterfaces),
      interfaces: mergedInterfaces,
      domain: info?.domain ?? null,
      explorerUrl: `${net.explorerUrl}/address/${friendly}`,
      status: state?.status ?? null,
      balanceGram: state?.balanceGram ?? null,
      codeHash: state?.codeHash ?? null,
      lastTxLt: state?.lastTxLt ?? null,
      lastSeenAt: lastSeenByAddr.get(rawAddr) ?? null,
      dataHash: state?.dataHash ?? null,
      lastTxHash: state?.lastTxHash ?? null,
      frozenHash: state?.frozenHash ?? null,
      getMethodsCount: state?.getMethodsCount ?? null,
    });
  }
  return out;
}

// ── Dual format address — akun TON/GRAM yang sama bisa direpresentasikan
//    dalam 3 bentuk berbeda (bounceable EQ/kQ..., non-bounceable UQ/0Q...,
//    & raw workchain:hex). Salah pilih format pas kirim ke exchange/kontrak
//    yang gak toleran bisa bikin dana nyangkut — makanya ditampilkan semua
//    sekaligus di panel address, murni lokal (gak perlu API tambahan). ──
export interface GramAddressFormats {
  bounceable: string;
  nonBounceable: string;
  raw: string;
}

export function gramAddressFormats(address: string, net: GramNetworkCfg): GramAddressFormats {
  const addr = Address.parse(address.trim());
  return {
    bounceable:    addr.toString({ bounceable: true,  testOnly: net.isTestnet }),
    nonBounceable: addr.toString({ bounceable: false, testOnly: net.isTestnet }),
    raw:           addr.toRawString(),
  };
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
  // ── detail tambahan ala tab "Contract"/"More Info" di Tonscan — dipakai
  //    buat panel "Detail Akun" di Explorer, mirip detail isContract/code
  //    yang sudah ada di sisi EVM. ──
  codeHash: string | null;
  dataHash: string | null;
  // Tebakan versi wallet (v4/v5r1) berdasarkan code hash on-chain — code
  // contract SAMA persis untuk semua wallet versi yang sama (cuma data/pubkey
  // yang beda per address), jadi cukup dicocokkan sekali terhadap hash code
  // "template" v4 & v5r1 yang di-build lokal, tanpa perlu API tambahan.
  walletVersionGuess: GramVersion | 'unknown';
  // Seqno cuma valid & berhasil diambil untuk kontrak yang cocok dengan
  // walletVersionGuess (v4/v5r1) — kontrak lain (Jetton master, custom
  // contract, dst) gak punya get-method "seqno" & akan tetap null di sini.
  seqno: number | null;
  lastTxLt: string | null;
  lastTxHash: string | null;
  blockSeqno: number | null;
}

export const GRAM_DEPLOY_RESERVE_NANO = BigInt(50_000_000);

// ── Hash code contract wallet "template" v4/v5r1, dihitung sekali & di-cache —
//    dipakai buat nebak versi wallet dari address sembarang tanpa API call
//    tambahan (lihat komentar walletVersionGuess di atas). ──
const gramWalletCodeHashCache: Partial<Record<GramVersion, string>> = {};
function gramWalletTemplateCodeHash(version: GramVersion): string {
  if (!gramWalletCodeHashCache[version]) {
    gramWalletCodeHashCache[version] = buildGramWallet(Buffer.alloc(32), version).init.code.hash().toString('hex');
  }
  return gramWalletCodeHashCache[version]!;
}

function gramCellHashHex(bocBuf: Buffer | null): string | null {
  if (!bocBuf) return null;
  try { return Cell.fromBoc(bocBuf)[0].hash().toString('hex'); } catch { return null; }
}

function guessGramWalletVersion(codeHash: string | null): GramVersion | 'unknown' {
  if (!codeHash) return 'unknown';
  if (codeHash === gramWalletTemplateCodeHash('v5r1')) return 'v5r1';
  if (codeHash === gramWalletTemplateCodeHash('v4')) return 'v4';
  return 'unknown';
}

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

      const codeHash = gramCellHashHex(state.code);
      const walletVersionGuess = guessGramWalletVersion(codeHash);

      let seqno: number | null = null;
      if (status === 'active' && walletVersionGuess !== 'unknown') {
        try {
          const res = await withGramRetry(() => client.runMethod(addr, 'seqno'));
          seqno = res.stack.readNumber();
        } catch { /* best-effort — biarkan null kalau get-method-nya gagal */ }
      }

      return {
        status,
        balanceNano: BigInt(state.balance.toString()),
        isDeployed: status === 'active',
        needsInitOnNextSend: status !== 'active',
        codeHash,
        dataHash: gramCellHashHex(state.data),
        walletVersionGuess,
        seqno,
        lastTxLt: state.lastTransaction?.lt ?? null,
        lastTxHash: state.lastTransaction?.hash ?? null,
        blockSeqno: state.blockId?.seqno ?? null,
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

  // ── Normalisasi address master Jetton ke format "user-friendly" (base64) ──
  // TonCenter API v3 (/api/v3/jetton/wallets) balikin field `jetton` (& `address`)
  // dalam format RAW (mis. "0:83dfd552e63729b472fcbcc8c45ebcc6691702558b68ec7527e1ba403a0f31a"),
  // BUKAN format yang biasa ditampilkan Explorer (tonscan.org / tonviewer.com) —
  // yaitu base64 dengan prefix EQ.../UQ... Kalau raw address ini langsung dipakai
  // di UI Send/Receive tanpa dikonversi, hasilnya keliatan beda total dari yang
  // ditampilkan Explorer meskipun address-nya sama persis di chain (bikin orang
  // ragu itu address yang benar apa bukan). Konversi ini: raw → friendly
  // bounceable (EQ...), sesuai konvensi Explorer buat address kontrak (jetton
  // master beda dari address wallet biasa yang pakai non-bounceable UQ...).
  const toFriendlyBounceable = (raw: string): string => {
    try { return Address.parse(raw).toString({ bounceable: true, testOnly: net.isTestnet }); }
    catch { return raw; }
  };

  const masterAddrsRaw = Array.from(new Set(holdings.map((h: any) => h.jetton as string)));
  const metaMap: Record<string, { name?: string; symbol?: string; decimals?: number; image?: string }> = {};
  await Promise.all(masterAddrsRaw.map(async (addr) => {
    const resolved = await resolveGramJettonMeta(net, addr);
    if (resolved) metaMap[addr] = resolved;
  }));

  // ── Harga USD per Jetton (best-effort) — cuma tersedia di Mainnet karena
  //    REST API STON.fi (sumber dexPriceUsd) cuma nge-serve data Mainnet
  //    (lihat catatan gramSwapAssertMainnet di bawah). Kalau gagal / Testnet,
  //    portfolio tetap ditampilkan tanpa nilai USD — bukan bagian kritis. ──
  const priceMap: Record<string, number> = {};
  if (net.id === 'mainnet') {
    try {
      const assets = await fetchGramSwapWalletAssets(owner);
      for (const a of assets) {
        if (a.kind === 'jetton' && a.dexPriceUsd != null) {
          const key = toFriendlyBounceable(a.address);
          priceMap[key] = a.dexPriceUsd;
        }
      }
    } catch { /* best-effort — biarkan priceMap kosong kalau STON.fi gagal/down */ }
  }

  return holdings.map((h: any) => {
    const meta      = metaMap[h.jetton] || {};
    const decimals  = meta.decimals ?? 9;
    const balance   = Number(h.balance) / Math.pow(10, decimals);
    const jettonAddr = toFriendlyBounceable(h.jetton);
    const price     = priceMap[jettonAddr] ?? null;
    return {
      chain: 'gram',
      address: jettonAddr,
      symbol: meta.symbol || 'JETTON',
      name: meta.name || 'Unknown Jetton',
      decimals,
      balance,
      balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
      usdPrice: price,
      usdValue: price !== null ? balance * price : null,
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

export function gramTxHashToHex(hashB64: string): string {
  try { return Buffer.from(hashB64, 'base64').toString('hex'); } catch { return hashB64 || ''; }
}

export function gramTxExplorerUrl(net: GramNetworkCfg, hashB64: string): string {
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

export interface GramTxDetail extends GramTxHistoryEntry {
  fromAddress: string;
  toAddress: string;
  computeSuccess: boolean | null;
  exitCode: number | null;
  outMsgsCount: number;
  rawJson: string;
  // ── breakdown fee & transisi status akun ala tab detail TX Tonscan — total
  //    fee-nya sendiri sudah ada di totalFeeGram (warisan GramTxHistoryEntry),
  //    field di bawah ini rinciannya per fase (storage/compute/action+forward). ──
  gasUsed: number | null;
  storageFeeGram: number | null;
  computeFeeGram: number | null;
  actionFeeGram: number | null;
  forwardFeeGram: number | null;
  // Status akun sebelum & sesudah tx ini — berguna buat nunjukin momen wallet
  // pertama kali di-deploy (uninitialized/frozen → active).
  origStatus: string | null;
  endStatus: string | null;
  aborted: boolean;
}

// ── Cari 1 transaksi TON berdasarkan hash (hex, 64 char) — dipakai buat
// lookup langsung di Explorer (mirip lookup tx hash di explorer EVM), tanpa
// perlu tahu address pemiliknya dulu. TonCenter v3 nerima hash dalam format
// base64url, jadi hex dari input di-convert dulu.
export async function fetchGramTxByHash(net: GramNetworkCfg, hashHex: string): Promise<GramTxDetail | null> {
  let hashB64url: string;
  try {
    hashB64url = Buffer.from(hashHex.trim(), 'hex').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    throw new Error('Format tx hash Gram (TON) tidak valid.');
  }

  let json: any;
  try {
    const res = await Promise.race([
      fetch(`${net.restBase}/api/v3/transactions?hash=${encodeURIComponent(hashB64url)}`),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
    ]) as Response;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (e: any) {
    throw new Error(`Gagal ambil detail transaksi dari TonCenter.${e?.message ? ` (${e.message})` : ' Coba lagi beberapa saat.'}`);
  }

  const rawTxs: any[] = Array.isArray(json?.transactions) ? json.transactions : [];
  const t = rawTxs[0];
  if (!t) return null;

  const inMsg   = t?.in_msg ?? null;
  const outMsgs: any[] = Array.isArray(t?.out_msgs) ? t.out_msgs : [];
  const hashB64 = t?.hash || '';

  let direction: GramTxDirection = 'unknown';
  let amountNano = 0n;
  let counterparty = '';
  let comment = '';
  let fromAddress = '';
  let toAddress = '';

  if (inMsg && inMsg.source) {
    direction    = 'in';
    amountNano   = BigInt(inMsg.value || '0');
    counterparty = inMsg.source;
    comment      = decodeGramMsgComment(inMsg);
    fromAddress  = inMsg.source || '';
    toAddress    = inMsg.destination || '';
  } else if (outMsgs.length > 0) {
    direction    = 'out';
    amountNano   = outMsgs.reduce((sum, m) => sum + BigInt(m?.value || '0'), 0n);
    counterparty = outMsgs[0]?.destination || '';
    comment      = decodeGramMsgComment(outMsgs[0]);
    fromAddress  = outMsgs[0]?.source || '';
    toAddress    = outMsgs[0]?.destination || '';
  }

  const d = t?.description;
  const computeSuccess: boolean | null = typeof d?.compute_ph?.success === 'boolean' ? d.compute_ph.success : null;
  const exitCode: number | null = typeof d?.compute_ph?.exit_code === 'number' ? d.compute_ph.exit_code : null;

  const toGramOrNull = (nano: unknown): number | null =>
    nano !== null && nano !== undefined ? Number(fromNano(String(nano))) : null;
  const gasUsed: number | null =
    typeof d?.compute_ph?.gas_used === 'string' || typeof d?.compute_ph?.gas_used === 'number'
      ? Number(d.compute_ph.gas_used) : null;
  const storageFeeGram = toGramOrNull(d?.storage_ph?.storage_fees_collected);
  const computeFeeGram = toGramOrNull(d?.compute_ph?.gas_fees);
  const actionFeeGram  = toGramOrNull(d?.action?.total_action_fees);
  const forwardFeeGram = toGramOrNull(d?.action?.total_fwd_fees);
  const origStatus: string | null = typeof t?.orig_status === 'string' ? t.orig_status : null;
  const endStatus: string | null  = typeof t?.end_status === 'string' ? t.end_status : null;

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
    fromAddress,
    toAddress,
    computeSuccess,
    exitCode,
    outMsgsCount: outMsgs.length,
    rawJson: JSON.stringify(t, null, 2),
    gasUsed,
    storageFeeGram,
    computeFeeGram,
    actionFeeGram,
    forwardFeeGram,
    origStatus,
    endStatus,
    aborted: d?.aborted === true,
  };
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
    const slice = cell.beginParse();
    // ── BUGFIX: cell content Jetton (TEP-64) selalu diawali tag 8-bit sebelum
    // isinya — 0x00 untuk onchain (dict), 0x01 untuk offchain (URI), persis
    // seperti yang sudah benar di-skip di decodeGramOffChainContentUri().
    // Sebelumnya dictionary di-load langsung dari cell.beginParse() TANPA
    // skip tag ini dulu, jadi bit dictionary-nya selalu mis-align 8 bit dari
    // seharusnya → hampir semua/semua jetton dgn metadata onchain gagal
    // di-decode dan jatuh ke default "Unknown Jetton" / "JETTON".
    if (slice.remainingBits < 8) return null;
    const tag = slice.loadUint(8);
    if (tag !== 0x00) return null; // bukan onchain content
    const dict = Dictionary.load(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell(), slice);
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

// ══════════════════════════════════════════════════════════════════════
// ── Swap DEX (STON.fi) — tukar TON⇄Jetton / Jetton⇄Jetton langsung dari
//    tab Send & Receive Gram, pakai wallet yang lagi connect (private key
//    lokal), tanpa perlu TonConnect / extension wallet eksternal.
//
//    Alurnya (sesuai rekomendasi resmi STON.fi, "API-driven workflow"):
//      1) fetchGramSwapAssets()   → daftar token yang bisa di-swap (dari
//         STON.fi API, sudah difilter yang liquidity-nya layak).
//      2) getGramSwapQuote()      → simulateSwap ke STON.fi API: dapat
//         perkiraan output, minimum-received (udah dipotong slippage),
//         plus info kontrak router yang harus dipakai.
//      3) estimateGramSwapFee() / sendGramSwap() → build txParams pakai
//         @ston-fi/sdk (dexFactory, otomatis pilih versi router yang
//         benar dari hasil simulasi), lalu kirim lewat wallet kita
//         sendiri — pola sama persis kayak sendGram/sendGramJetton di
//         atas (buka wallet contract, getSeqno, sendTransfer).
//
//    PENTING: REST API STON.fi (api.ston.fi) cuma nge-serve data Mainnet.
//    Jadi fitur swap ini sengaja dikunci hanya untuk GRAM_NETWORKS
//    id === 'mainnet' — di Testnet, liquidity STON.fi nyaris gak ada
//    dan API-nya emang gak nyediain data buat network itu. ──
// ══════════════════════════════════════════════════════════════════════

export type GramSwapAssetKind = 'ton' | 'jetton';

export interface GramSwapAssetInfo {
  // 'ton' untuk native TON/GRAM (STON.fi pakai sentinel address 'ton'),
  // selain itu address kontrak master Jetton-nya.
  address: string;
  kind: GramSwapAssetKind;
  symbol: string;
  name: string;
  decimals: number;
  image?: string;
  // Harga USD dari STON.fi (dex-implied) — best-effort, null kalau STON.fi
  // gak punya data pool buat token ini.
  dexPriceUsd?: number | null;
}

function mapStonAsset(a: any): GramSwapAssetInfo {
  const isTon = a?.kind === 'Ton' || a?.contractAddress === 'ton';
  const priceRaw = a?.dexPriceUsd;
  const dexPriceUsd = priceRaw !== undefined && priceRaw !== null && priceRaw !== '' && !isNaN(parseFloat(priceRaw))
    ? parseFloat(priceRaw) : null;
  return {
    address:  isTon ? 'ton' : String(a?.contractAddress || ''),
    kind:     isTon ? 'ton' : 'jetton',
    symbol:   a?.meta?.symbol || a?.meta?.displayName || (isTon ? 'GRAM' : '???'),
    name:     a?.meta?.displayName || a?.meta?.symbol || (isTon ? 'Gram (Prev TON Blockchain)' : 'Unknown Token'),
    decimals: typeof a?.meta?.decimals === 'number' ? a.meta.decimals : 9,
    image:    a?.meta?.imageUrl || a?.meta?.image,
    dexPriceUsd,
  };
}

// Token native GRAM/TON — selalu ada di posisi teratas daftar swap.
export const GRAM_SWAP_NATIVE_ASSET: GramSwapAssetInfo = {
  address: 'gram', kind: 'ton', symbol: 'GRAM', name: 'Gram (Prev TON Blockchain)', decimals: 9,
};

// PENTING: 'ton' di atas cuma sentinel INTERNAL biar UI (modal pilih token,
// perbandingan asset aktif, dedup by address, dst) gampang bedain native TON
// dari Jetton biasa. REST API STON.fi (simulateSwap) SAMA SEKALI gak ngerti
// literal string 'ton' — dia expect address kanonik pTON v1 ini buat
// merepresentasikan native TON. Sebelumnya `getGramSwapQuote` ngirim
// `fromAsset.address`/`toAsset.address` APA ADANYA ke `simulateSwap`, jadi
// begitu salah satu sisi swap-nya TON (termasuk pasangan default yang
// otomatis kepilih pas modal token pertama kali dibuka), STON.fi selalu
// nolak request-nya (address gak valid) → "Gagal simulasi swap" MELULU,
// padahal pair-nya sendiri liquid. Fix: terjemahkan sentinel 'ton' ke
// address asli ini SEBELUM manggil API lewat toStonApiAddress().
export const GRAM_SWAP_TON_API_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

function toStonApiAddress(asset: GramSwapAssetInfo): string {
  return asset.kind === 'ton' ? GRAM_SWAP_TON_API_ADDRESS : asset.address;
}

export function gramSwapAssertMainnet(net: GramNetworkCfg): void {
  if (net.id !== 'mainnet') {
    throw new Error('Swap DEX (STON.fi) cuma tersedia di Gram Mainnet — liquidity di Testnet nyaris gak ada & API STON.fi cuma nge-serve data Mainnet.');
  }
}

// Ambil daftar token yang bisa di-swap dari STON.fi. Tanpa `query` → daftar
// token populer/liquidity tinggi (bagus buat isi awal dropdown). Dengan
// `query` → cari token spesifik by nama/simbol/address.
export async function fetchGramSwapAssets(query: string = ''): Promise<GramSwapAssetInfo[]> {
  try {
    const api = new StonApiClient();
    const condition = [AssetTag.LiquidityVeryHigh, AssetTag.LiquidityHigh, AssetTag.LiquidityMedium].join(' | ');
    const q = query.trim();
    const list = q
      ? await api.queryAssets({ condition, searchTerms: [q] } as any)
      : await api.queryAssets({ condition });
    const mapped = (Array.isArray(list) ? list : []).map(mapStonAsset).filter(a => a.address);
    // Pastikan TON native selalu ada & gak dobel — baik di daftar awal (query
    // kosong) MAUPUN di hasil pencarian kalau query-nya cocok ke TON. Sebelumnya
    // TON selalu didrop total begitu ada query apapun (`return withoutTon` tanpa
    // syarat), jadi user gak akan PERNAH nemu TON lewat search box sekalipun
    // dia ngetik persis "ton" — padahal komentar di atas bilang TON "selalu ada".
    const withoutTon = mapped.filter(a => a.kind !== 'ton');
    if (!q) return [GRAM_SWAP_NATIVE_ASSET, ...withoutTon];
    const qLower = q.toLowerCase();
    const tonMatches = 'ton'.includes(qLower) || 'toncoin'.includes(qLower) || 'gram'.includes(qLower);
    return tonMatches ? [GRAM_SWAP_NATIVE_ASSET, ...withoutTon] : withoutTon;
  } catch (e: any) {
    throw new Error('Gagal mengambil daftar token swap dari STON.fi. ' + (e?.message || 'Cek koneksi internet.'));
  }
}

// Jetton yang lagi dipegang wallet, difilter biar cuma yang emang punya pool
// di STON.fi (jadi bisa langsung dipakai sebagai "From" tanpa gagal simulasi).
export async function fetchGramSwapWalletAssets(walletAddress: string): Promise<GramSwapAssetInfo[]> {
  try {
    const api = new StonApiClient();
    const list = await api.queryAssets({ walletAddress, condition: AssetTag.WalletHasBalance } as any);
    const mapped = (Array.isArray(list) ? list : []).map(mapStonAsset).filter(a => a.address);
    return mapped.some(a => a.kind === 'ton') ? mapped : [GRAM_SWAP_NATIVE_ASSET, ...mapped];
  } catch {
    return [GRAM_SWAP_NATIVE_ASSET];
  }
}

export interface GramSwapQuote {
  offerAddress: string;
  askAddress: string;
  offerUnits: string;
  askUnits: string;
  minAskUnits: string;
  // Harga efektif: berapa `toAsset` didapat per 1 `fromAsset`.
  rate: number;
  priceImpactPct?: number;
  router: any; // dilempar apa adanya ke dexFactory() pas build txParams
}

export async function getGramSwapQuote(
  fromAsset: GramSwapAssetInfo,
  toAsset: GramSwapAssetInfo,
  amount: number,
  slippagePct: number = 1,
): Promise<GramSwapQuote> {
  if (!(amount > 0)) throw new Error('Jumlah yang mau di-swap harus lebih dari 0.');
  if (fromAsset.address === toAsset.address) throw new Error('Token asal & tujuan swap tidak boleh sama.');
  if (!(slippagePct > 0)) throw new Error('Slippage tolerance harus lebih dari 0%.');

  const api = new StonApiClient();
  const offerUnits = BigInt(Math.round(amount * Math.pow(10, fromAsset.decimals))).toString();

  let result: any;
  try {
    result = await api.simulateSwap({
      offerAddress: toStonApiAddress(fromAsset),
      askAddress: toStonApiAddress(toAsset),
      offerUnits,
      slippageTolerance: (slippagePct / 100).toString(),
    });
  } catch (e: any) {
    throw new Error(
      `Gagal simulasi swap ${fromAsset.symbol} → ${toAsset.symbol} di STON.fi — kemungkinan pair ini belum ` +
      `punya liquidity pool, atau jumlahnya kurang dari minimum. ${e?.message || ''}`.trim()
    );
  }
  if (!result?.router) {
    throw new Error(`Tidak ditemukan rute swap ${fromAsset.symbol} → ${toAsset.symbol} di STON.fi.`);
  }

  const askUnitsNum = Number(result.askUnits ?? result.minAskUnits ?? 0);
  const offerUnitsNum = Number(result.offerUnits ?? offerUnits);
  const rate = offerUnitsNum > 0
    ? (askUnitsNum / Math.pow(10, toAsset.decimals)) / (offerUnitsNum / Math.pow(10, fromAsset.decimals))
    : 0;

  return {
    // Sengaja pakai address versi sentinel app (fromAsset.address/toAsset.address),
    // BUKAN result.offerAddress/askAddress dari API (yang buat TON bakal berupa
    // GRAM_SWAP_TON_API_ADDRESS asli, bukan 'ton') — biar tetap konsisten sama
    // skema address yang dipakai di seluruh UI, termasuk guard "quote vs token
    // yang dipilih sekarang" di gramExecuteSwap (Walletgenerator.tsx).
    offerAddress: fromAsset.address,
    askAddress:   toAsset.address,
    offerUnits:   String(result.offerUnits ?? offerUnits),
    askUnits:     String(result.askUnits ?? ''),
    minAskUnits:  String(result.minAskUnits ?? ''),
    rate,
    priceImpactPct: result.priceImpact !== undefined && result.priceImpact !== null ? Number(result.priceImpact) * 100 : undefined,
    router: result.router,
  };
}

export function formatGramSwapOutput(quote: GramSwapQuote, toAsset: GramSwapAssetInfo) {
  const div = Math.pow(10, toAsset.decimals);
  return {
    askAmount:    Number(quote.askUnits || 0) / div,
    minAskAmount: Number(quote.minAskUnits || 0) / div,
  };
}

// Build txParams (to/value/body) buat message swap, pakai @ston-fi/sdk —
// dexFactory() otomatis milih kontrak Router/pTON yang sesuai versi yang
// dipakai `quote.router` (dikirim balik dari hasil simulasi STON.fi).
async function buildGramSwapTxParams(
  net: GramNetworkCfg,
  quote: GramSwapQuote,
  fromAsset: GramSwapAssetInfo,
  toAsset: GramSwapAssetInfo,
  userWalletAddress: string,
): Promise<{ to: Address; value: bigint; body: Cell }> {
  const endpoints = await resolveGramEndpoints(net);
  const stonClient = new StonSdkClient({ endpoint: endpoints[0] });

  const dexContracts = dexFactory(quote.router);
  const router = stonClient.open(dexContracts.Router.create(quote.router.address));
  const proxyTon = dexContracts.pTON && quote.router.ptonMasterAddress
    ? dexContracts.pTON.create(quote.router.ptonMasterAddress)
    : null;

  const shared = {
    userWalletAddress,
    offerAmount: quote.offerUnits,
    minAskAmount: quote.minAskUnits,
    queryId: Date.now(),
  };

  let txParams: any;
  if (fromAsset.kind === 'ton') {
    if (!proxyTon) throw new Error('Router STON.fi ini tidak menyediakan proxy pTON untuk swap dari native TON.');
    txParams = await router.getSwapTonToJettonTxParams({ ...shared, proxyTon, askJettonAddress: quote.askAddress });
  } else if (toAsset.kind === 'ton') {
    if (!proxyTon) throw new Error('Router STON.fi ini tidak menyediakan proxy pTON untuk swap ke native TON.');
    txParams = await router.getSwapJettonToTonTxParams({ ...shared, proxyTon, offerJettonAddress: quote.offerAddress });
  } else {
    txParams = await router.getSwapJettonToJettonTxParams({ ...shared, offerJettonAddress: quote.offerAddress, askJettonAddress: quote.askAddress });
  }
  return { to: txParams.to as Address, value: BigInt(txParams.value), body: txParams.body as Cell };
}

export async function estimateGramSwapFee(
  net: GramNetworkCfg,
  privateKeyHex: string,
  quote: GramSwapQuote,
  fromAsset: GramSwapAssetInfo,
  toAsset: GramSwapAssetInfo,
  version: GramVersion = 'v5r1',
): Promise<GramFeeEstimate> {
  gramSwapAssertMainnet(net);
  const keyPair = keypairFromGramPrivateKey(privateKeyHex);
  const wallet  = buildGramWallet(keyPair.publicKey, version);

  let willDeploy = false;
  try {
    const state = await getGramAccountState(net, wallet.address.toString());
    willDeploy = state.needsInitOnNextSend;
  } catch { /* best-effort */ }

  const swapMsg = await buildGramSwapTxParams(net, quote, fromAsset, toAsset, wallet.address.toString());

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

      const body = (wallet as any).createTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [internal({ to: swapMsg.to, value: swapMsg.value, bounce: true, body: swapMsg.body })],
      }) as Cell;

      const fees = await withGramRetry(() => client.estimateExternalMessageFee(wallet.address, {
        body,
        initCode: willDeploy ? wallet.init.code : null,
        initData: willDeploy ? wallet.init.data : null,
        ignoreSignature: true,
      }));

      return gramFeeFromSourceFees(fees.source_fees, willDeploy);
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal saat estimasi fee swap.');
}

// ── Cek saldo gas GRAM (native TON) minimum sebelum swap ──
// Umum di ekosistem TON/GRAM: swap lewat DEX (STON.fi) SELALU butuh sejumlah
// TON native buat gas — bahkan kalau yang di-swap itu Jetton ke Jetton lain
// (bukan TON sama sekali). Alur swap-nya bukan 1 pesan tunggal, tapi rangkaian
// pesan internal berlapis (wallet → jetton wallet pengirim → jetton wallet
// router → kontrak Router/pool → notifikasi balik ke jetton wallet penerima,
// dst), dan tiap hop butuh ongkos gas + forward fee sendiri yang dibayar dari
// TON di wallet — BUKAN dipotong dari jumlah Jetton yang di-swap. Kalau saldo
// TON di wallet kurang dari total ongkos ini, tx bisa "nyangkut" di tengah
// chain of message (Jetton sudah kekirim/kekunci tapi swap gak pernah selesai)
// alih-alih gagal bersih di awal — jauh lebih nyusahin daripada dicegah dari awal.
//
// estimateGramSwapFee (estimateExternalMessageFee) cuma mensimulasikan pesan
// PERTAMA dari wallet ke Router/pTON, gak menghitung seluruh rangkaian pesan
// internal yang dipicu STON.fi di baliknya — jadi angkanya SERING under-estimate
// ongkos riil. Makanya di sini kita gak cuma pakai estimateGramSwapFee apa
// adanya, tapi jamin ada floor minimum (GRAM_SWAP_MIN_GAS_RESERVE_NANO) di atas
// estimasi tersebut sebagai buffer, supaya swap gak keburu dicoba padahal
// hampir pasti bakal gagal/nyangkut di tengah jalan.
export const GRAM_SWAP_MIN_GAS_RESERVE_NANO = BigInt(150_000_000); // ~0.15 TON

export interface GramSwapGasCheck {
  hasEnoughGas: boolean;
  requiredNano: bigint;
  balanceNano: bigint;
  shortfallNano: bigint;
  requiredGram: number;
  balanceGram: number;
  shortfallGram: number;
  willDeploy: boolean;
}

export async function checkGramSwapGasSufficiency(
  net: GramNetworkCfg,
  address: string,
  fromAsset: GramSwapAssetInfo,
  amount: number,
  feeEstimate?: GramFeeEstimate | null,
): Promise<GramSwapGasCheck> {
  const state = await getGramAccountState(net, address);
  const balanceNano = state.balanceNano;

  // Floor gas minimum, dinaikkan lagi kalau estimasi fee riil (kalau tersedia)
  // ternyata lebih besar dari floor-nya + sedikit safety buffer yang sama
  // dipakai estimateGramMaxSendable.
  let requiredGasNano = GRAM_SWAP_MIN_GAS_RESERVE_NANO;
  if (feeEstimate) {
    const withBuffer = feeEstimate.totalFeeNano + GRAM_MAX_SAFETY_BUFFER_NANO;
    if (withBuffer > requiredGasNano) requiredGasNano = withBuffer;
  }
  // Wallet belum aktif → tx swap ini sekaligus jadi tx deploy pertama, butuh
  // reserve tambahan (pola sama seperti sendGram/estimateGramMaxSendable).
  if (state.needsInitOnNextSend) requiredGasNano += GRAM_DEPLOY_RESERVE_NANO;

  // Kalau yang di-swap adalah TON native sendiri, jumlah yang mau di-swap ikut
  // motong saldo yang sama dengan gas — jadi totalnya harus dijumlah, bukan
  // dicek terpisah.
  const amountNano   = fromAsset.kind === 'ton' ? toNano(amount.toFixed(9)) : 0n;
  const requiredNano = requiredGasNano + amountNano;

  const hasEnoughGas  = balanceNano >= requiredNano;
  const shortfallNano = hasEnoughGas ? 0n : requiredNano - balanceNano;

  return {
    hasEnoughGas,
    requiredNano,
    balanceNano,
    shortfallNano,
    requiredGram:  Number(fromNano(requiredNano.toString())),
    balanceGram:   Number(fromNano(balanceNano.toString())),
    shortfallGram: Number(fromNano(shortfallNano.toString())),
    willDeploy: state.needsInitOnNextSend,
  };
}

export async function sendGramSwap(
  net: GramNetworkCfg,
  privateKeyHex: string,
  quote: GramSwapQuote,
  fromAsset: GramSwapAssetInfo,
  toAsset: GramSwapAssetInfo,
  version: GramVersion = 'v5r1',
  amount?: number,
): Promise<string> {
  gramSwapAssertMainnet(net);
  const keyPair = keypairFromGramPrivateKey(privateKeyHex);
  const wallet  = buildGramWallet(keyPair.publicKey, version);

  // Guard terakhir sebelum broadcast: pastikan saldo TON cukup buat gas swap
  // (+ jumlah swap kalau fromAsset-nya TON sendiri). Dicek di sini juga (bukan
  // cuma di UI) supaya fungsi ini tetap aman dipanggil langsung tanpa lewat UI.
  const swapAmountForGasCheck = amount ?? Number(quote.offerUnits) / Math.pow(10, fromAsset.decimals);
  const gasCheck = await checkGramSwapGasSufficiency(net, wallet.address.toString(), fromAsset, swapAmountForGasCheck);
  if (!gasCheck.hasEnoughGas) {
    throw new Error(
      `Saldo Gram  (Prev TON Blockchain) tidak cukup untuk gas swap. Butuh minimal ~${gasCheck.requiredGram.toLocaleString('en-US',{maximumFractionDigits:6})} GRAM` +
      (gasCheck.willDeploy ? ' (termasuk biaya deploy wallet, tx pertama)' : '') +
      `, saldo saat ini ~${gasCheck.balanceGram.toLocaleString('en-US',{maximumFractionDigits:6})} GRAM ` +
      `(kurang ~${gasCheck.shortfallGram.toLocaleString('en-US',{maximumFractionDigits:6})} GRAM). ` +
      `Ini umum di jaringan Gram/TON: swap lewat Jetton tetap butuh TON native buat bayar gas tiap hop pesan internal.`
    );
  }

  const swapMsg = await buildGramSwapTxParams(net, quote, fromAsset, toAsset, wallet.address.toString());

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
        messages: [internal({ to: swapMsg.to, value: swapMsg.value, bounce: true, body: swapMsg.body })],
      }));

      const landed = await pollGramSeqno(contract, seqno);
      if (!landed) return '';
      return await fetchGramLastTxHash(client, wallet.address);
    } catch (e) { lastErr = e; markGramEndpointUnhealthy(endpoint); }
  }
  throw lastErr || new Error('Semua RPC Gram gagal saat kirim transaksi swap.');
}
