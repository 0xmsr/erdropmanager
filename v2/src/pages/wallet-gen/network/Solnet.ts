import { ethers } from 'ethers';
import {
  Keypair as SolKeypair, Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL,
  Transaction as SolTransaction, sendAndConfirmTransaction,
  StakeProgram, Authorized, Lockup, VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync,
  createBurnInstruction, createCloseAccountInstruction, createHarvestWithheldTokensToMintInstruction,
} from '@solana/spl-token';
import { PROGRAM_ID as METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import bs58 from 'bs58';
import type { DetectedToken } from '../Walletgenerator';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

export function deriveSolanaAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2);
  const path    = `m/44'/501'/${index}'/0'`;
  const { key } = deriveEd25519Path(path, seedHex);
  const keypair = SolKeypair.fromSeed(key);
  return {
    address:    keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  };
}


export function isValidSolanaAddress(address: string): boolean {
  try { new PublicKey(address.trim()); return true; } catch { return false; }
}

export async function sendSolNative(
  net: SolNetworkCfg,
  privateKeyHex: string,
  toAddress: string,
  amountSol: number,
): Promise<string> {
  if (!isValidSolanaAddress(toAddress)) {
    throw new Error('Address Solana tujuan tidak valid.');
  }
  if (!(amountSol > 0)) {
    throw new Error('Jumlah SOL yang dikirim harus lebih dari 0.');
  }
  let keypair: SolKeypair;
  try {
    keypair = SolKeypair.fromSecretKey(bs58.decode(privateKeyHex.trim()));
  } catch {
    throw new Error('Private Key Solana tidak valid (harus base58, hasil dari WalletGen).');
  }
  const toPubkey = new PublicKey(toAddress.trim());
  const connection = await getSolanaConnection(net);
  const tx = new SolTransaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey,
      lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
    }),
  );
  return await sendAndConfirmTransactionSafe(connection, tx, [keypair]);
}

export function getMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID,
  );
  return pda;
}


export const SPL_META_MAX = { name: 32, symbol: 10, uri: 200 } as const;

export interface SolNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  clusterParam: string;
  rpcUrls: string[];
}

export const SOLANA_NETWORKS: SolNetworkCfg[] = [
  {
    id: 'mainnet',
    name: 'Solana Mainnet',
    symbol: 'SOL',
    color: '#9945FF',
    explorerUrl: 'https://solscan.io',
    clusterParam: '',
    rpcUrls: [
      'https://api.mainnet.solana.com',
      'https://solana-rpc.publicnode.com',
      'https://solana.api.onfinality.io/public',
      'https://solana.blockpi.network/v1/rpc/public',
      'https://solana.public-rpc.com',
      'https://api.mainnet-beta.solana.com',
    ],
  },
  {
    id: 'devnet',
    name: 'Solana Devnet',
    symbol: 'SOL',
    color: '#14F195',
    explorerUrl: 'https://solscan.io',
    clusterParam: '?cluster=devnet',
    rpcUrls: [
      'https://api.devnet.solana.com',
    ],
  },
  {
    id: 'testnet',
    name: 'Solana Testnet',
    symbol: 'SOL',
    color: '#F1C40F',
    explorerUrl: 'https://solscan.io',
    clusterParam: '?cluster=testnet',
    rpcUrls: [
      'https://api.testnet.solana.com',
    ],
  },
];

export async function getSolanaConnection(net: SolNetworkCfg): Promise<Connection> {
  for (const rpc of orderedSolRpcs(net)) {
    try {
      const conn = new Connection(rpc, 'confirmed');
      await Promise.race([
        conn.getVersion(),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 6000)),
      ]);
      markSolRpcAlive(rpc);
      return conn;
    } catch { markSolRpcDead(rpc); }
  }
  throw new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

export async function sendAndConfirmTransactionSafe(
  connection: Connection,
  tx: SolTransaction,
  signers: SolKeypair[],
  opts?: { retries?: number; retryDelayMs?: number },
): Promise<string> {
  try {
    return await sendAndConfirmTransaction(connection, tx, signers);
  } catch (err: any) {
    const msg = err?.message || '';
    const isExpired =
      err?.name === 'TransactionExpiredBlockheightExceededError' ||
      /block height exceeded/i.test(msg);
    if (!isExpired) throw err;

    const sigBytes = tx.signature;
    if (!sigBytes) throw err;

    const sig = bs58.encode(sigBytes);
    const retries = opts?.retries ?? 6;
    const delayMs = opts?.retryDelayMs ?? 2000;

    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, delayMs));
      try {
        const status = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
        const st = status?.value;
        if (st) {
          if (st.err) {
            throw new Error(`Transaksi ditolak on-chain: ${JSON.stringify(st.err)}`);
          }
          if (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized') {
            return sig;
          }
        }
      } catch (checkErr: any) {
        if (checkErr?.message?.startsWith('Transaksi ditolak')) throw checkErr;
      }
    }

    throw new Error(
      `${msg} — cek manual dulu di explorer sebelum retry (signature: ${sig}), ` +
      `karena tx bisa saja tetap landed meski konfirmasi timeout.`
    );
  }
}

export async function getSolBalanceWithFallback(net: SolNetworkCfg, address: string): Promise<number> {
  const pubkey = new PublicKey(address);
  let lastErr: any;
  for (const rpc of orderedSolRpcs(net)) {
    try {
      const conn = new Connection(rpc, 'confirmed');
      return await Promise.race([
        conn.getBalance(pubkey),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Semua RPC gagal');
}

export async function fetchSolTokenPortfolio(address: string, net: SolNetworkCfg = SOLANA_NETWORKS[0]): Promise<DetectedToken[]> {
  const owner = new PublicKey(address);

  let resp: Awaited<ReturnType<Connection['getParsedTokenAccountsByOwner']>> | null = null;
  let lastErr: any;
  for (const rpc of orderedSolRpcs(net)) {
    try {
      const conn = new Connection(rpc, 'confirmed');
      resp = await Promise.race([
        conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
      ]);
      break;
    } catch (e) { lastErr = e; }
  }
  if (!resp && net.id === 'mainnet') {
    try {
      const jh = await fetchJupHoldings(address);
      resp = {
        value: jh.accounts.map(a => ({ account: { data: { parsed: { info: {
          mint: a.mint, tokenAmount: { uiAmount: a.uiAmount, decimals: a.decimals },
        } } } } })),
      } as any;
    } catch { }
  }
  if (!resp) {
    throw new Error(
      'Semua RPC Solana menolak permintaan cek token.' +
      (lastErr?.message ? ` (${lastErr.message})` : ' Coba lagi beberapa saat.')
    );
  }
  const holdings = resp.value
    .map(v => v.account.data.parsed?.info)
    .filter(info => info && Number(info.tokenAmount?.uiAmount ?? 0) > 0);
  if (holdings.length === 0) return [];


  const mints = Array.from(new Set(holdings.map((h: any) => h.mint as string)));
  const metaMap: Record<string, any> = {};
  for (let i = 0; i < mints.length; i += 100) {
    const chunk = mints.slice(i, i + 100);
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${chunk.join(',')}`);
      if (res.ok) {
        const arr = await res.json();
        (Array.isArray(arr) ? arr : []).forEach((t: any) => { metaMap[t.id] = t; });
      }
    } catch {  }
  }

  return holdings.map((h: any) => {
    const meta    = metaMap[h.mint];
    const balance = Number(h.tokenAmount.uiAmount);
    const price   = typeof meta?.usdPrice === 'number' ? meta.usdPrice : null;
    return {
      chain: 'sol',
      address: h.mint,
      symbol: meta?.symbol || `${h.mint.slice(0,4)}…`,
      name: meta?.name || 'Unknown SPL Token',
      decimals: h.tokenAmount.decimals,
      balance,
      balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
      usdPrice: price,
      usdValue: price !== null ? balance * price : null,
      logo: meta?.icon,
    } as DetectedToken;
  });
}

function keypairFromB58(privateKey: string): SolKeypair {
  try { return SolKeypair.fromSecretKey(bs58.decode(privateKey.trim())); }
  catch { throw new Error('Private Key Solana tidak valid (harus base58, hasil dari WalletGen).'); }
}

export interface SolTxHistoryItem {
  signature: string; slot: number; blockTime: number | null; ok: boolean; err: string | null;
  memo: string | null; feeSol: number | null; deltaSol: number | null;
}

export async function fetchSolTxHistory(
  net: SolNetworkCfg, address: string, opts: { limit?: number; before?: string } = {},
): Promise<SolTxHistoryItem[]> {
  const connection = await getSolanaConnection(net);
  const owner = new PublicKey(address.trim());
  const sigs = await connection.getSignaturesForAddress(owner, { limit: opts.limit ?? 20, before: opts.before }, 'confirmed');
  const items: SolTxHistoryItem[] = sigs.map(s => ({
    signature: s.signature, slot: s.slot, blockTime: s.blockTime ?? null, ok: !s.err,
    err: s.err ? JSON.stringify(s.err) : null, memo: s.memo ?? null, feeSol: null, deltaSol: null,
  }));
  if (items.length === 0) return items;
  try {
    const parsed = await connection.getParsedTransactions(
      items.map(i => i.signature), { maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    );
    parsed.forEach((tx, idx) => {
      if (!tx?.meta) return;
      const pos = tx.transaction.message.accountKeys.findIndex(k => k.pubkey.equals(owner));
      items[idx].feeSol = tx.meta.fee / LAMPORTS_PER_SOL;
      if (pos >= 0) items[idx].deltaSol = (tx.meta.postBalances[pos] - tx.meta.preBalances[pos]) / LAMPORTS_PER_SOL;
    });
  } catch { }
  return items;
}

export interface SolValidator { votePubkey: string; nodePubkey: string; commission: number; activatedStakeSol: number }

export async function fetchTopValidators(net: SolNetworkCfg, limit = 30, maxCommission = 10): Promise<SolValidator[]> {
  const connection = await getSolanaConnection(net);
  const { current } = await connection.getVoteAccounts('confirmed');
  return current
    .filter(v => v.commission <= maxCommission)
    .sort((a, b) => b.activatedStake - a.activatedStake)
    .slice(0, limit)
    .map(v => ({ votePubkey: v.votePubkey, nodePubkey: v.nodePubkey, commission: v.commission, activatedStakeSol: v.activatedStake / LAMPORTS_PER_SOL }));
}

export type SolStakeState = 'activating' | 'active' | 'deactivating' | 'inactive';
export interface SolStakeAccount {
  pubkey: string; lamports: number; balanceSol: number; voter: string | null; state: SolStakeState;
}

const U64_MAX = '18446744073709551615';

export async function fetchStakeAccounts(net: SolNetworkCfg, address: string): Promise<SolStakeAccount[]> {
  const connection = await getSolanaConnection(net);
  const owner = new PublicKey(address.trim());
  const { epoch } = await connection.getEpochInfo('confirmed');
  const accs = await connection.getParsedProgramAccounts(StakeProgram.programId, {
    filters: [{ memcmp: { offset: 12, bytes: owner.toBase58() } }], // offset 12 = staker authority
  });
  return accs.map(({ pubkey, account }) => {
    const parsed: any = (account.data as any).parsed;
    const del = parsed?.info?.stake?.delegation;
    let state: SolStakeState = 'inactive';
    if (parsed?.type === 'delegated' && del) {
      if (String(del.deactivationEpoch) !== U64_MAX) state = epoch > Number(del.deactivationEpoch) ? 'inactive' : 'deactivating';
      else state = epoch > Number(del.activationEpoch) ? 'active' : 'activating';
    }
    return { pubkey: pubkey.toBase58(), lamports: account.lamports, balanceSol: account.lamports / LAMPORTS_PER_SOL, voter: del?.voter ?? null, state };
  });
}

export async function stakeSol(
  net: SolNetworkCfg, privateKey: string, votePubkey: string, amountSol: number,
): Promise<{ signature: string; stakeAccount: string }> {
  if (!(amountSol > 0)) throw new Error('Jumlah stake harus lebih dari 0.');
  const payer = keypairFromB58(privateKey);
  const vote = new PublicKey(votePubkey.trim());
  const connection = await getSolanaConnection(net);
  const rent = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
  const minDelegation = await connection.getStakeMinimumDelegation().then(r => r.value).catch(() => 1);
  const delegateLamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  if (delegateLamports < minDelegation) throw new Error(`Minimal delegasi ${(minDelegation / LAMPORTS_PER_SOL).toFixed(6)} SOL.`);
  const needed = rent + delegateLamports + 10_000;
  if ((await connection.getBalance(payer.publicKey)) < needed) {
    throw new Error(`Saldo kurang. Perlu ≈ ${(needed / LAMPORTS_PER_SOL).toFixed(6)} SOL (stake + rent + fee).`);
  }
  const stakeKp = SolKeypair.generate();
  const tx = StakeProgram.createAccount({
    fromPubkey: payer.publicKey, stakePubkey: stakeKp.publicKey,
    authorized: new Authorized(payer.publicKey, payer.publicKey),
    lockup: new Lockup(0, 0, payer.publicKey), lamports: rent + delegateLamports,
  });
  tx.add(StakeProgram.delegate({ stakePubkey: stakeKp.publicKey, authorizedPubkey: payer.publicKey, votePubkey: vote }));
  const signature = await sendAndConfirmTransactionSafe(connection, tx, [payer, stakeKp]);
  return { signature, stakeAccount: stakeKp.publicKey.toBase58() };
}

export async function deactivateStake(net: SolNetworkCfg, privateKey: string, stakeAccount: string): Promise<string> {
  const payer = keypairFromB58(privateKey);
  const connection = await getSolanaConnection(net);
  const tx = StakeProgram.deactivate({ stakePubkey: new PublicKey(stakeAccount), authorizedPubkey: payer.publicKey });
  return await sendAndConfirmTransactionSafe(connection, tx, [payer]);
}

export async function withdrawStake(net: SolNetworkCfg, privateKey: string, stakeAccount: string): Promise<string> {
  const payer = keypairFromB58(privateKey);
  const connection = await getSolanaConnection(net);
  const pk = new PublicKey(stakeAccount);
  const lamports = await connection.getBalance(pk);
  if (lamports <= 0) throw new Error('Stake account kosong.');
  const tx = StakeProgram.withdraw({ stakePubkey: pk, authorizedPubkey: payer.publicKey, toPubkey: payer.publicKey, lamports });
  return await sendAndConfirmTransactionSafe(connection, tx, [payer]);
}

// ── 3. Swap via Jupiter (mainnet saja) ──
const JUP_SWAP_API  = 'https://lite-api.jup.ag/swap/v1';
const JUP_TOKEN_API = 'https://lite-api.jup.ag/tokens/v2/search';

export interface SwapToken { mint: string; symbol: string; name: string; decimals: number; balance?: number; icon?: string; usdValue?: number | null }
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const SWAP_PRESET_TOKENS: SwapToken[] = [
  { mint: WSOL_MINT,                                      symbol: 'SOL',  name: 'Solana',   decimals: 9 },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether',   decimals: 6 },
  { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  symbol: 'JUP',  name: 'Jupiter',  decimals: 6 },
  { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk',     decimals: 5 },
  { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF',  name: 'dogwifhat', decimals: 6 },
  { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  symbol: 'mSOL', name: 'Marinade staked SOL', decimals: 9 },
];

export async function searchSwapTokens(query: string): Promise<SwapToken[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(`${JUP_TOKEN_API}?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Pencarian token gagal (HTTP ${res.status}).`);
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : []).slice(0, 10).map((t: any) => ({
    mint: t.id, symbol: t.symbol || '?', name: t.name || 'Unknown', decimals: Number(t.decimals ?? 0),
  }));
}

export interface JupQuote {
  inputMint: string; outputMint: string; inAmount: string; outAmount: string;
  otherAmountThreshold: string; priceImpactPct: string; slippageBps: number; routePlan: any[];
  [k: string]: any;
}

export async function getJupiterQuote(p: { inputMint: string; outputMint: string; amountRaw: string; slippageBps?: number }): Promise<JupQuote> {
  const qs = new URLSearchParams({
    inputMint: p.inputMint, outputMint: p.outputMint, amount: p.amountRaw, slippageBps: String(p.slippageBps ?? 50),
  });
  const res = await fetch(`${JUP_SWAP_API}/quote?${qs}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(json?.error || `Quote gagal (HTTP ${res.status}).`);
  return json as JupQuote;
}

export function toRawAmount(amount: string, decimals: number): string {
  const [i, f = ''] = amount.trim().split('.');
  if (!/^\d*$/.test(i) || !/^\d*$/.test(f)) throw new Error('Format jumlah tidak valid.');
  const raw = (i || '0') + (f + '0'.repeat(decimals)).slice(0, decimals);
  return raw.replace(/^0+(?=\d)/, '');
}

export function fromRawAmount(raw: string, decimals: number): string {
  const s = raw.padStart(decimals + 1, '0');
  const i = s.slice(0, s.length - decimals);
  const f = s.slice(s.length - decimals).replace(/0+$/, '');
  return f ? `${i}.${f}` : i;
}

export interface SolFiatRate { usd: number; idr: number | null; at: number }
let solFiatCache: SolFiatRate | null = null;

export async function fetchSolFiatRate(force = false): Promise<SolFiatRate> {
  if (!force && solFiatCache && Date.now() - solFiatCache.at < 60_000) return solFiatCache;
  let usd = 0, idr: number | null = null;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,idr');
    const j = await r.json();
    usd = Number(j?.solana?.usd) || 0;
    idr = Number(j?.solana?.idr) || null;
  } catch { /* lanjut ke cadangan */ }
  if (!usd) {
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${WSOL_MINT}`);
    const j = await r.json();
    usd = Number(j?.[WSOL_MINT]?.usdPrice) || 0;
  }
  if (usd && !idr) {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const j = await r.json();
      const rate = Number(j?.rates?.IDR);
      if (rate) idr = usd * rate;
    } catch { /* IDR opsional */ }
  }
  if (!usd) throw new Error('Harga SOL tidak tersedia.');
  solFiatCache = { usd, idr, at: Date.now() };
  return solFiatCache;
}

export type SolPriorityLevel = 'medium' | 'high' | 'veryHigh';
export interface SolPriorityOption { id: SolPriorityLevel; label: string; hint: string; maxLamports: number }
export const SOL_PRIORITY_OPTIONS: SolPriorityOption[] = [
  { id: 'medium',   label: 'Normal', hint: 'Hemat, cocok untuk jaringan sepi',  maxLamports: 1_000_000 },
  { id: 'high',     label: 'Cepat',  hint: 'Lebih cepat masuk blok',            maxLamports: 2_000_000 },
  { id: 'veryHigh', label: 'Kilat',  hint: 'Prioritas tertinggi, fee terbesar', maxLamports: 5_000_000 },
];
export const SOL_BASE_FEE_PER_SIG = 5000;
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';

export interface JupSwapFeePreview {
  baseFeeLamports: number;
  priorityFeeLamports: number;
  rentLamports: number;
  rentNote: string;
  totalLamports: number;
  computeUnitLimit: number | null;
  computeUnitsEstimated: number | null;
  signatures: number;
  simulationError: string | null;
}

async function requestJupiterSwapTx(address: string, quote: JupQuote, priority: SolPriorityLevel) {
  const opt = SOL_PRIORITY_OPTIONS.find(o => o.id === priority) || SOL_PRIORITY_OPTIONS[0];
  const res = await fetch(`${JUP_SWAP_API}/swap`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote, userPublicKey: address, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: opt.maxLamports, priorityLevel: opt.id, global: false } },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.swapTransaction) throw new Error(json?.error || `Gagal membuat transaksi swap (HTTP ${res.status}).`);
  return json as { swapTransaction: string; lastValidBlockHeight?: number; prioritizationFeeLamports?: number; computeUnitLimit?: number; simulationError?: any };
}

function readComputeBudget(vtx: VersionedTransaction): { limit: number | null; microLamports: number | null } {
  let limit: number | null = null, price: number | null = null;
  const keys = vtx.message.staticAccountKeys;
  for (const ix of vtx.message.compiledInstructions) {
    if (keys[ix.programIdIndex]?.toBase58() !== COMPUTE_BUDGET_PROGRAM) continue;
    const d = Buffer.from(ix.data);
    if (d[0] === 2 && d.length >= 5) limit = d.readUInt32LE(1);
    if (d[0] === 3 && d.length >= 9) price = Number(d.readBigUInt64LE(1));
  }
  return { limit, microLamports: price };
}

export async function previewJupiterSwapFee(
  net: SolNetworkCfg, address: string, quote: JupQuote, priority: SolPriorityLevel,
): Promise<JupSwapFeePreview> {
  if (net.id !== 'mainnet') throw new Error('Jupiter hanya tersedia di Solana Mainnet.');
  const json = await requestJupiterSwapTx(address, quote, priority);
  const vtx = VersionedTransaction.deserialize(Buffer.from(json.swapTransaction, 'base64'));
  const signatures = vtx.message.header.numRequiredSignatures;
  const cb = readComputeBudget(vtx);
  const limit = json.computeUnitLimit ?? cb.limit;
  const priorityFee = typeof json.prioritizationFeeLamports === 'number'
    ? json.prioritizationFeeLamports
    : (limit && cb.microLamports ? Math.ceil(limit * cb.microLamports / 1_000_000) : 0);
  const baseFee = signatures * SOL_BASE_FEE_PER_SIG;

  let rent = 0, rentNote = '';
  let units: number | null = null;
  let simErr: string | null = json.simulationError ? (typeof json.simulationError === 'string' ? json.simulationError : (json.simulationError.error || JSON.stringify(json.simulationError))) : null;
  try {
    const connection = await getSolanaConnection(net);
    if (quote.outputMint !== WSOL_MINT) {
      const mintPk = new PublicKey(quote.outputMint);
      const mintInfo = await connection.getAccountInfo(mintPk);
      const programId = mintInfo?.owner || TOKEN_PROGRAM_ID;
      const ata = getAssociatedTokenAddressSync(mintPk, new PublicKey(address), true, programId);
      const ataInfo = await connection.getAccountInfo(ata);
      if (!ataInfo) {
        rent = await connection.getMinimumBalanceForRentExemption(programId.equals(TOKEN_2022_PROGRAM_ID) ? 175 : 165);
        rentNote = 'Akun token tujuan belum ada — dibuat otomatis, deposit rent ini kembali saat akun ditutup.';
      }
    }
    try {
      const sim = await connection.simulateTransaction(vtx, { sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed' });
      if (typeof sim.value.unitsConsumed === 'number') units = sim.value.unitsConsumed;
      if (sim.value.err && !simErr) simErr = JSON.stringify(sim.value.err);
    } catch { /* simulasi opsional */ }
  } catch { /* cek rent opsional */ }

  return {
    baseFeeLamports: baseFee, priorityFeeLamports: priorityFee, rentLamports: rent, rentNote,
    totalLamports: baseFee + priorityFee + rent,
    computeUnitLimit: limit ?? null, computeUnitsEstimated: units, signatures, simulationError: simErr,
  };
}

export async function executeJupiterSwap(
  net: SolNetworkCfg, privateKey: string, quote: JupQuote, priority: SolPriorityLevel = 'medium',
): Promise<string> {
  if (net.id !== 'mainnet') throw new Error('Jupiter hanya tersedia di Solana Mainnet.');
  const kp = keypairFromB58(privateKey);
  const json = await requestJupiterSwapTx(kp.publicKey.toBase58(), quote, priority);

  const vtx = VersionedTransaction.deserialize(Buffer.from(json.swapTransaction, 'base64'));
  vtx.sign([kp]);
  const connection = await getSolanaConnection(net);
  const signature = await connection.sendRawTransaction(vtx.serialize(), { maxRetries: 3 });
  const latest = await connection.getLatestBlockhash('confirmed');
  try {
    const conf = await connection.confirmTransaction(
      { signature, blockhash: vtx.message.recentBlockhash, lastValidBlockHeight: json.lastValidBlockHeight ?? latest.lastValidBlockHeight },
      'confirmed',
    );
    if (conf.value.err) throw new Error(`Swap ditolak on-chain: ${JSON.stringify(conf.value.err)}`);
  } catch (e: any) {
    if (/ditolak on-chain/.test(e?.message || '')) throw e;
    const st = (await connection.getSignatureStatus(signature, { searchTransactionHistory: true })).value;
    if (!st || (st.confirmationStatus !== 'confirmed' && st.confirmationStatus !== 'finalized')) {
      throw new Error(`${e?.message || 'Konfirmasi timeout'} — cek manual di explorer (signature: ${signature}).`);
    }
    if (st.err) throw new Error(`Swap ditolak on-chain: ${JSON.stringify(st.err)}`);
  }
  return signature;
}

export interface JupSwapReceipt {
  signature: string;
  feeLamports: number;
  baseFeeLamports: number;
  priorityFeeLamports: number;
  computeUnitsUsed: number | null;
  computeUnitLimit: number | null;
  rentPaidLamports: number;
  receivedRaw: string | null;
  sentRaw: string | null;
  slot: number | null;
}

export async function fetchJupiterSwapReceipt(
  net: SolNetworkCfg, signature: string, address: string, fromMint: string, toMint: string,
): Promise<JupSwapReceipt | null> {
  const connection = await getSolanaConnection(net);
  let tx: any = null;
  for (let i = 0; i < 6 && !tx; i++) {
    try { tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }); } catch { /* ulangi */ }
    if (!tx) await new Promise(r => setTimeout(r, 1500));
  }
  if (!tx?.meta) return null;
  const meta = tx.meta;
  const msg = tx.transaction.message;
  const sigs = msg.header?.numRequiredSignatures ?? 1;
  const base = sigs * SOL_BASE_FEE_PER_SIG;

  const tokDelta = (mint: string): bigint | null => {
    const sum = (arr: any[] | null | undefined): bigint => (arr || [])
      .filter((b: any) => b.owner === address && b.mint === mint)
      .reduce((a: bigint, b: any) => a + BigInt(b.uiTokenAmount?.amount || '0'), BigInt(0));
    const pre = sum(meta.preTokenBalances), post = sum(meta.postTokenBalances);
    if (pre === BigInt(0) && post === BigInt(0)) return null;
    return post - pre;
  };

  const keys: PublicKey[] = (msg.staticAccountKeys || msg.accountKeys || []);
  const selfIdx = keys.findIndex(k => k.toBase58() === address);
  const lamportDelta = selfIdx >= 0 ? BigInt(meta.postBalances[selfIdx]) - BigInt(meta.preBalances[selfIdx]) : null;

  let sent: bigint | null = null, received: bigint | null = null;
  if (fromMint === WSOL_MINT && lamportDelta !== null) sent = -(lamportDelta + BigInt(meta.fee));
  else { const d = tokDelta(fromMint); sent = d === null ? null : -d; }
  if (toMint === WSOL_MINT && lamportDelta !== null) received = lamportDelta + BigInt(meta.fee);
  else received = tokDelta(toMint);

  let limit: number | null = null;
  const ixs = msg.compiledInstructions || [];
  for (const ix of ixs) {
    if (keys[ix.programIdIndex]?.toBase58() !== COMPUTE_BUDGET_PROGRAM) continue;
    const d = Buffer.from(ix.data);
    if (d[0] === 2 && d.length >= 5) limit = d.readUInt32LE(1);
  }

  return {
    signature, feeLamports: meta.fee, baseFeeLamports: base, priorityFeeLamports: Math.max(0, meta.fee - base),
    computeUnitsUsed: typeof meta.computeUnitsConsumed === 'number' ? meta.computeUnitsConsumed : null,
    computeUnitLimit: limit, rentPaidLamports: 0,
    receivedRaw: received !== null && received > BigInt(0) ? received.toString() : null,
    sentRaw: sent !== null && sent > BigInt(0) ? sent.toString() : null,
    slot: tx.slot ?? null,
  };
}


// ── Deteksi SEMUA token account (SPL klasik + Token-2022, termasuk saldo 0) untuk fitur Tutup Akun.
//    Beda dari versi lama: tiap RPC dicoba bergantian, tiap program di-query terpisah (satu gagal
//    tidak menggagalkan yang lain), ada timeout, dan error dilaporkan — bukan ditelan jadi "kosong". ──
export interface SolTokenAccountRaw {
  pubkey: string; mint: string; decimals: number; uiAmount: number; programId: string; lamports: number;
  rawAmount?: string; state?: string; isNative?: boolean; closeAuthority?: string | null;
  withheldAmount?: string; nonTransferable?: boolean; confidential?: boolean;
}


function parseTokenAccountExtensions(exts: any): { withheldAmount?: string; nonTransferable?: boolean; confidential?: boolean } {
  const out: { withheldAmount?: string; nonTransferable?: boolean; confidential?: boolean } = {};
  if (!Array.isArray(exts)) return out;
  for (const e of exts) {
    if (e?.extension === 'transferFeeAmount') out.withheldAmount = String(e?.state?.withheldAmount ?? '0');
    if (e?.extension === 'nonTransferableAccount') out.nonTransferable = true;
    if (e?.extension === 'confidentialTransferAccount') out.confidential = true;
  }
  return out;
}

export type SolCloseVerdict = 'ready' | 'burn' | 'fix' | 'blocked';
export interface SolCloseNote { level: 'block' | 'fix' | 'warn' | 'info'; text: string }
export interface SolCloseDiagnosis {
  verdict: SolCloseVerdict;
  notes: SolCloseNote[];
  hasBalance: boolean;
  native: boolean;
  needsBurn: boolean;
  needsHarvest: boolean;
}

export function diagnoseSolTokenAccount(acc: SolTokenAccountRaw, owner: string): SolCloseDiagnosis {
  const notes: SolCloseNote[] = [];
  const native = acc.isNative === true || acc.mint === WSOL_MINT;
  const hasBalance = acc.rawAmount !== undefined ? acc.rawAmount !== '0' : acc.uiAmount > 0;
  const needsHarvest = !!acc.withheldAmount && acc.withheldAmount !== '0';
  const needsBurn = hasBalance && !native;
  let blocked = false;

  if (acc.state === 'frozen') {
    blocked = true;
    notes.push({ level: 'block', text: 'Akun dibekukan (frozen) oleh freeze authority penerbit token. Pemilik tidak bisa membakar atau menutupnya — hanya penerbit token yang bisa melepas pembekuan (thaw).' });
  }
  if (acc.closeAuthority && acc.closeAuthority !== owner) {
    blocked = true;
    notes.push({ level: 'block', text: `Close authority akun ini dipegang address lain (${acc.closeAuthority.slice(0, 4)}…${acc.closeAuthority.slice(-4)}), jadi wallet kamu tidak berwenang menutupnya.` });
  }
  if (needsHarvest) {
    notes.push({ level: 'fix', text: `Ada transfer fee tertahan (withheld) ${acc.withheldAmount} unit mentah di akun Token-2022 ini; selama belum nol akun tidak bisa ditutup. Perbaikan otomatis: harvest fee ke mint lebih dulu, lalu tutup.` });
  }
  if (native) {
    notes.push({ level: 'info', text: 'Akun wrapped SOL (WSOL): ditutup langsung tanpa bakar, saldonya otomatis kembali jadi SOL ke wallet.' });
  }
  if (acc.nonTransferable) {
    notes.push({ level: 'info', text: 'Token non-transferable (soulbound): tidak bisa dikirim, hanya bisa dibakar lalu ditutup.' });
  }
  if (acc.confidential) {
    notes.push({ level: 'warn', text: 'Akun memakai confidential transfer. Kalau masih ada saldo rahasia (pending/available) yang belum ditarik, penutupan bisa ditolak dan harus dikosongkan lewat tool confidential-transfer.' });
  }
  if (needsBurn) {
    notes.push({ level: 'info', text: 'Masih ada saldo token: harus dibakar dulu (permanen) sebelum akun bisa ditutup.' });
  }

  const verdict: SolCloseVerdict = blocked ? 'blocked' : needsHarvest ? 'fix' : needsBurn ? 'burn' : 'ready';
  return { verdict, notes, hasBalance, native, needsBurn, needsHarvest };
}

/** Akun yang aman diproses massal tanpa konfirmasi bakar: tidak diblokir dan tidak butuh bakar token. */
export function isSolBatchClosable(acc: SolTokenAccountRaw, owner: string): boolean {
  const d = diagnoseSolTokenAccount(acc, owner);
  return (d.verdict === 'ready' || d.verdict === 'fix') && !d.needsBurn;
}

export function buildSolCloseInstructions(acc: SolTokenAccountRaw, owner: PublicKey, burn: boolean) {
  const programId = new PublicKey(acc.programId);
  const ata = new PublicKey(acc.pubkey);
  const mint = new PublicKey(acc.mint);
  const d = diagnoseSolTokenAccount(acc, owner.toBase58());
  const ixs = [];
  if (d.needsHarvest) ixs.push(createHarvestWithheldTokensToMintInstruction(mint, [ata], programId));
  if (d.needsBurn && burn) {
    const raw = acc.rawAmount !== undefined ? BigInt(acc.rawAmount) : BigInt(Math.round(acc.uiAmount * 10 ** acc.decimals));
    ixs.push(createBurnInstruction(ata, mint, owner, raw, [], programId));
  }
  ixs.push(createCloseAccountInstruction(ata, owner, owner, [], programId));
  return ixs;
}

const TOKEN_ERROR_HINTS: Record<number, string> = {
  1: 'Saldo tidak cukup untuk instruksi ini.',
  4: 'Wallet ini bukan pemilik akun token tersebut.',
  10: 'Akun native (WSOL) tidak bisa dibakar — cukup ditutup langsung.',
  11: 'Akun masih punya saldo token. Bakar dulu (centang opsi bakar) atau kosongkan lewat kirim.',
  13: 'Akun dalam state tidak valid untuk operasi ini.',
  17: 'Akun dibekukan (frozen) oleh freeze authority penerbit token — hanya penerbit yang bisa membukanya.',
};

export function explainSolCloseError(e: any): string {
  const msg = String(e?.message || e || '');
  const logs: string[] = Array.isArray(e?.logs) ? e.logs : [];
  const all = `${msg} ${logs.join(' ')}`;
  const m = all.match(/custom program error: (0x[0-9a-f]+)/i) || all.match(/"Custom":\s*(\d+)/);
  if (m) {
    const code = m[1].startsWith('0x') ? parseInt(m[1], 16) : Number(m[1]);
    if (TOKEN_ERROR_HINTS[code]) return TOKEN_ERROR_HINTS[code];
  }
  if (/withheld/i.test(all)) return 'Masih ada transfer fee tertahan (withheld) di akun Token-2022 ini — harvest fee ke mint dulu.';
  if (/frozen/i.test(all)) return TOKEN_ERROR_HINTS[17];
  if (/insufficient (funds|lamports)|0x1\b/i.test(all) && /fee|lamport/i.test(all)) return 'Saldo SOL tidak cukup untuk membayar fee transaksi.';
  if (/block height exceeded|expired/i.test(msg)) return 'Transaksi kedaluwarsa sebelum terkonfirmasi — coba lagi.';
  if (/rate limit|429|403/i.test(msg)) return 'RPC menolak/membatasi permintaan — coba lagi atau pakai RPC kustom.';
  return msg.slice(0, 200) || 'Gagal tanpa pesan error dari RPC.';
}

// ── Kesehatan RPC: RPC yang baru gagal diparkir 60 detik (tetap dicoba paling akhir, jadi daftar tidak pernah kosong) ──
const rpcDeadUntil = new Map<string, number>();
function markSolRpcDead(url: string) { rpcDeadUntil.set(url, Date.now() + 60_000); }
function markSolRpcAlive(url: string) { rpcDeadUntil.delete(url); }
export function orderedSolRpcs(net: SolNetworkCfg): string[] {
  const now = Date.now();
  const alive = net.rpcUrls.filter(u => (rpcDeadUntil.get(u) ?? 0) <= now);
  const dead  = net.rpcUrls.filter(u => (rpcDeadUntil.get(u) ?? 0) > now);
  return [...alive, ...dead];
}
function solRpcHost(url: string): string { try { return new URL(url).host; } catch { return url; } }
function shortRpcErr(e: any): string {
  const m = String(e?.message || e);
  const j = m.match(/"message":"([^"]+)"/);
  return (j ? j[1] : m).slice(0, 90);
}

// Kirim ke SEMUA RPC sekaligus, ambil yang pertama berhasil (jauh lebih cepat & tahan RPC mati/berbayar).
function anySolRpc<T>(urls: string[], fn: (conn: Connection) => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const errs: string[] = [];
    let pending = urls.length;
    if (!pending) return reject(new Error('Tidak ada RPC yang dikonfigurasi.'));
    urls.forEach(url => {
      Promise.race([
        fn(new Connection(url, 'confirmed')),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), timeoutMs)),
      ]).then(v => { markSolRpcAlive(url); resolve(v); })
        .catch(e => {
          markSolRpcDead(url);
          errs.push(`${solRpcHost(url)}: ${shortRpcErr(e)}`);
          if (--pending === 0) reject(new Error(errs.join(' | ')));
        });
    });
  });
}

// ── RPC kustom (opsional) per jaringan — disimpan di localStorage, otomatis jadi prioritas pertama ──
const customRpcKey = (netId: string) => `solCustomRpc:${netId}`;
export function getCustomSolRpc(netId: string): string {
  try { return localStorage.getItem(customRpcKey(netId)) || ''; } catch { return ''; }
}
export function setCustomSolRpc(netId: string, url: string): void {
  const net = SOLANA_NETWORKS.find(n => n.id === netId);
  if (!net) return;
  const clean = url.trim();
  if (clean && !/^https?:\/\//i.test(clean)) throw new Error('URL RPC harus diawali https://');
  const old = getCustomSolRpc(netId);
  net.rpcUrls = net.rpcUrls.filter(u => u !== old && u !== clean);
  try { clean ? localStorage.setItem(customRpcKey(netId), clean) : localStorage.removeItem(customRpcKey(netId)); } catch { }
  if (clean) net.rpcUrls = [clean, ...net.rpcUrls];
  rpcDeadUntil.clear();
}
SOLANA_NETWORKS.forEach(n => {
  const c = getCustomSolRpc(n.id);
  if (c) n.rpcUrls = [c, ...n.rpcUrls.filter(u => u !== c)];
});

// Cadangan saat semua RPC publik menolak browser: API Jupiter (CORS terbuka). Rent diperkirakan (bukan dibaca on-chain).
export async function fetchJupHoldings(address: string): Promise<{ lamports: number; accounts: SolTokenAccountRaw[] }> {
  const res = await fetch(`https://lite-api.jup.ag/ultra/v1/holdings/${address.trim()}`);
  if (!res.ok) throw new Error(`Jupiter holdings HTTP ${res.status}`);
  const j = await res.json();
  const classic = TOKEN_PROGRAM_ID.toBase58();
  const accounts: SolTokenAccountRaw[] = [];
  for (const [mint, list] of Object.entries(j?.tokens || {})) {
    for (const a of (Array.isArray(list) ? list : []) as any[]) {
      if (!a?.account) continue;
      const programId = a.programId || classic;
      accounts.push({
        pubkey: a.account, mint, decimals: Number(a.decimals ?? 0),
        uiAmount: Number(a.uiAmount ?? a.uiAmountString ?? 0),
        rawAmount: a.amount !== undefined ? String(a.amount) : undefined,
        state: a.isFrozen ? 'frozen' : undefined,
        programId, lamports: programId === classic ? 2_039_280 : 2_157_600,
      });
    }
  }
  return { lamports: Number(j?.amount ?? 0), accounts };
}

export async function fetchAllSolTokenAccounts(
  net: SolNetworkCfg, address: string,
): Promise<{ accounts: SolTokenAccountRaw[]; warnings: string[]; solLamports?: number }> {
  const owner = new PublicKey(address.trim());
  const programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

  const load = async (p: PublicKey): Promise<SolTokenAccountRaw[]> => {
    let lastErr: any;
    for (let round = 0; round < 2; round++) {
      try {
        const resp = await anySolRpc(
          orderedSolRpcs(net),
          c => c.getParsedTokenAccountsByOwner(owner, { programId: p }),
          8000,
        );
        return resp.value.flatMap(({ pubkey, account }: any) => {
          const info = account?.data?.parsed?.info;
          if (!info?.mint || !info?.tokenAmount) return [];
          const ta = info.tokenAmount;
          return [{
            pubkey: pubkey.toBase58(),
            mint: info.mint as string,
            decimals: Number(ta.decimals ?? 0),
            uiAmount: Number(ta.uiAmount ?? ta.uiAmountString ?? 0),
            programId: p.toBase58(),
            lamports: Number(account.lamports ?? 0),
            rawAmount: String(ta.amount ?? '0'),
            state: info.state as string | undefined,
            isNative: !!info.isNative,
            closeAuthority: (info.closeAuthority as string | undefined) ?? null,
            ...parseTokenAccountExtensions(info.extensions),
          } as SolTokenAccountRaw];
        });
      } catch (e) {
        lastErr = e;
        if (round === 0) await new Promise(r => setTimeout(r, 1500)); // beri jeda kalau kena rate-limit
      }
    }
    throw lastErr;
  };

  const [r0, r1] = await Promise.allSettled(programs.map(load));
  if (r0.status === 'rejected' && r1.status === 'rejected') {
    console.warn('[Solana] RPC gagal:', (r0.reason as any)?.message || r0.reason);
    if (net.id === 'mainnet') {
      try {
        const jh = await fetchJupHoldings(address);
        return {
          accounts: jh.accounts, solLamports: jh.lamports,
          warnings: ['RPC publik menolak permintaan — memakai data Jupiter. Akun saldo 0 mungkin tidak muncul; isi "RPC kustom" untuk daftar lengkap.'],
        };
      } catch { }
    }
    throw new Error(
      `Semua RPC ${net.name} sedang menolak permintaan (${String((r0.reason as any)?.message || r0.reason).slice(0, 500)}). ` +
      'Solusi: buka Tools → "RPC kustom" lalu tempel endpoint pribadi (Helius / QuickNode / Alchemy — gratis).',
    );
  }
  const warnings: string[] = [];
  if (r0.status === 'rejected') warnings.push('Token klasik (SPL) gagal dimuat — daftar mungkin belum lengkap.');
  if (r1.status === 'rejected') warnings.push('Token-2022 gagal dimuat — daftar mungkin belum lengkap.');
  return {
    accounts: [...(r0.status === 'fulfilled' ? r0.value : []), ...(r1.status === 'fulfilled' ? r1.value : [])],
    warnings,
  };
}

// ── Swap: deteksi token SPL (klasik + Token-2022) yang di-hold wallet + daftar token populer ──
async function jupTokenMeta(mints: string[]): Promise<Record<string, any>> {
  const map: Record<string, any> = {};
  for (let i = 0; i < mints.length; i += 100) {
    try {
      const res = await fetch(`${JUP_TOKEN_API}?query=${mints.slice(i, i + 100).join(',')}`);
      if (res.ok) {
        const arr = await res.json();
        (Array.isArray(arr) ? arr : []).forEach((t: any) => { map[t.id] = t; });
      }
    } catch { }
  }
  return map;
}

/** Semua aset yang di-hold: SOL native + setiap SPL token bersaldo > 0, lengkap dengan saldo. Urut nilai USD. */
export async function fetchHeldSwapTokens(net: SolNetworkCfg, address: string): Promise<SwapToken[]> {
  const [{ accounts, solLamports }, rpcLamports] = await Promise.all([
    fetchAllSolTokenAccounts(net, address),
    getSolBalanceWithFallback(net, address).catch(() => null),
  ]);
  const lamports: number | null = rpcLamports ?? (solLamports ?? null);

  const byMint = new Map<string, { decimals: number; balance: number }>();
  for (const a of accounts) {
    if (!(a.uiAmount > 0)) continue;
    const prev = byMint.get(a.mint);
    byMint.set(a.mint, { decimals: a.decimals, balance: (prev?.balance ?? 0) + a.uiAmount });
  }

  const meta = await jupTokenMeta(Array.from(byMint.keys()));
  const tokens: SwapToken[] = Array.from(byMint.entries()).map(([mint, v]) => {
    const m = meta[mint];
    const price = typeof m?.usdPrice === 'number' ? m.usdPrice : null;
    return {
      mint, decimals: v.decimals, balance: v.balance,
      symbol: m?.symbol || `${mint.slice(0, 4)}…`,
      name: m?.name || 'Unknown SPL Token',
      icon: m?.icon,
      usdValue: price !== null ? price * v.balance : null,
    };
  });
  tokens.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));

  if (lamports !== null) {
    tokens.unshift({ ...SWAP_PRESET_TOKENS[0], balance: lamports / LAMPORTS_PER_SOL });
  }
  return tokens;
}

/** Token paling banyak diperdagangkan 24 jam terakhir (Jupiter). Gagal → pemanggil cukup pakai SWAP_PRESET_TOKENS. */
export async function fetchPopularSwapTokens(limit = 50): Promise<SwapToken[]> {
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=${limit}`);
  if (!res.ok) throw new Error(`Daftar token populer gagal (HTTP ${res.status}).`);
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : [])
    .filter((t: any) => t?.id && t?.symbol && Number.isFinite(Number(t.decimals)))
    .map((t: any) => ({ mint: t.id, symbol: t.symbol, name: t.name || t.symbol, decimals: Number(t.decimals), icon: t.icon }));
}

/* ════════════════════════════════════════════════════════════════════
 * SOLANA EXPLORER — status jaringan, block (slot), detail TX & info akun.
 * Dipakai halaman Explorer (tab SOL). Semua pakai anySolRpc supaya satu
 * RPC publik yang rate-limit / mati tidak menjatuhkan seluruh panel.
 * ════════════════════════════════════════════════════════════════════ */

export interface SolNetworkStatus {
  slot: number; blockHeight: number | null;
  epoch: number | null; slotIndex: number | null; slotsInEpoch: number | null; epochProgressPct: number | null;
  tps: number | null; avgSlotTimeSec: number | null;
  totalTxCount: number | null; version: string | null;
}

export async function getSolNetworkStatus(net: SolNetworkCfg): Promise<SolNetworkStatus> {
  const urls = orderedSolRpcs(net);
  const core = await anySolRpc(urls, async conn => {
    const [slot, epochInfo, perf, txCount, version] = await Promise.all([
      conn.getSlot('confirmed'),
      conn.getEpochInfo('confirmed').catch(() => null),
      conn.getRecentPerformanceSamples(4).catch(() => []),
      conn.getTransactionCount('confirmed').catch(() => null),
      conn.getVersion().catch(() => null),
    ]);
    return { slot, epochInfo, perf, txCount, version };
  }, 9000);
  const samples = core.perf.filter(p => p.samplePeriodSecs > 0 && p.numSlots > 0);
  const secs = samples.reduce((a, p) => a + p.samplePeriodSecs, 0);
  const txs = samples.reduce((a, p) => a + p.numTransactions, 0);
  const slots = samples.reduce((a, p) => a + p.numSlots, 0);
  const e = core.epochInfo;
  return {
    slot: core.slot,
    blockHeight: e?.blockHeight ?? null,
    epoch: e?.epoch ?? null, slotIndex: e?.slotIndex ?? null, slotsInEpoch: e?.slotsInEpoch ?? null,
    epochProgressPct: e && e.slotsInEpoch > 0 ? (e.slotIndex / e.slotsInEpoch) * 100 : null,
    tps: secs > 0 ? txs / secs : null,
    avgSlotTimeSec: slots > 0 ? secs / slots : null,
    totalTxCount: core.txCount,
    version: core.version?.['solana-core'] ?? null,
  };
}

export interface SolBlockSummary {
  slot: number; blockhash: string; previousBlockhash: string; parentSlot: number;
  blockTime: number | null; blockHeight: number | null; txCount: number; signatures: string[];
}

function mapSolBlock(slot: number, b: any): SolBlockSummary {
  const sigs: string[] = Array.isArray(b.signatures) ? b.signatures : [];
  return {
    slot, blockhash: b.blockhash, previousBlockhash: b.previousBlockhash, parentSlot: b.parentSlot,
    blockTime: b.blockTime ?? null, blockHeight: b.blockHeight ?? null, txCount: sigs.length, signatures: sigs,
  };
}

/** Satu block by slot. Slot yang di-skip leader → melempar Error('SLOT_SKIPPED'). */
export async function fetchSolBlock(net: SolNetworkCfg, slot: number): Promise<SolBlockSummary> {
  const urls = orderedSolRpcs(net);
  const b = await anySolRpc(urls, async conn => {
    try {
      return await conn.getBlock(slot, { transactionDetails: 'signatures', rewards: false, maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    } catch (e: any) {
      const m = String(e?.message || e);
      if (/skipped|not available|missing in long-term/i.test(m)) return null;
      throw e;
    }
  }, 12000);
  if (!b) throw new Error('SLOT_SKIPPED');
  return mapSolBlock(slot, b);
}

/** Ambil 1 block lewat RPC satu per satu (bukan balapan ke semua RPC → hemat rate limit). null = slot di-skip. */
async function fetchSolBlockSeq(net: SolNetworkCfg, slot: number): Promise<SolBlockSummary | null> {
  let lastErr: any = null;
  for (const url of orderedSolRpcs(net)) {
    try {
      const conn = new Connection(url, 'confirmed');
      const b = await Promise.race([
        conn.getBlock(slot, { transactionDetails: 'signatures', rewards: false, maxSupportedTransactionVersion: 0, commitment: 'confirmed' }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      markSolRpcAlive(url);
      return b ? mapSolBlock(slot, b) : null;
    } catch (e: any) {
      const m = String(e?.message || e);
      if (/skipped|was cleaned up|missing in long-term/i.test(m)) return null;
      lastErr = e;
      markSolRpcDead(url);
    }
  }
  throw lastErr || new Error('Semua RPC gagal');
}

/**
 * N block terbaru yang benar-benar diproduksi. Block dikirim bertahap lewat onPartial
 * supaya UI langsung terisi; melempar error (bukan array kosong) kalau tidak ada block yang berhasil diambil.
 */
export async function fetchSolLatestBlocks(
  net: SolNetworkCfg, count = 5,
  opts: { onPartial?: (blocks: SolBlockSummary[]) => void; shouldCancel?: () => boolean } = {},
): Promise<SolBlockSummary[]> {
  const urls = orderedSolRpcs(net);
  const head = await anySolRpc(urls, c => c.getSlot('confirmed'), 8000);
  let slots: number[];
  try {
    const produced = await anySolRpc(urls, c => c.getBlocks(Math.max(0, head - 30), head, 'confirmed'), 9000);
    slots = produced.slice(-(count + 3)).reverse();
  } catch {
    slots = Array.from({ length: count + 3 }, (_, i) => head - 1 - i).filter(n => n >= 0);
  }
  const got: SolBlockSummary[] = [];
  let lastErr: any = null;
  let i = 0;
  const worker = async () => {
    while (i < slots.length && got.length < count && !opts.shouldCancel?.()) {
      const slot = slots[i++];
      try {
        const b = await fetchSolBlockSeq(net, slot);
        if (b) { got.push(b); got.sort((x, y) => y.slot - x.slot); opts.onPartial?.(got.slice(0, count)); }
      } catch (e) { lastErr = e; }
    }
  };
  await Promise.all([worker(), worker()]);
  if (!got.length) throw lastErr || new Error('Tidak ada block yang bisa diambil dari RPC.');
  return got.slice(0, count);
}

export interface SolTxAccountChange { address: string; signer: boolean; writable: boolean; preSol: number; postSol: number; deltaSol: number }
export interface SolTxTokenChange { owner: string | null; mint: string; pre: number; post: number; delta: number; decimals: number }
export interface SolTxInstruction { program: string; programId: string; type: string | null; summary: string | null; innerCount: number }
export interface SolTxDetail {
  signature: string; slot: number; blockTime: number | null; ok: boolean; err: string | null;
  feeSol: number; computeUnits: number | null; version: string; recentBlockhash: string;
  signers: string[]; accounts: SolTxAccountChange[]; tokenChanges: SolTxTokenChange[];
  instructions: SolTxInstruction[]; logs: string[]; rawJson: string;
}

const SOL_KNOWN_PROGRAMS: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token Program',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': 'Token-2022 Program',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Account',
  'ComputeBudget111111111111111111111111111111': 'Compute Budget',
  'Stake11111111111111111111111111111111111111': 'Stake Program',
  'Vote111111111111111111111111111111111111111': 'Vote Program',
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': 'Memo v2',
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo': 'Memo v1',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter v6',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM v4',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool',
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'Metaplex Token Metadata',
};

export async function fetchSolTxDetail(net: SolNetworkCfg, signature: string): Promise<SolTxDetail | null> {
  const urls = orderedSolRpcs(net);
  const tx: any = await anySolRpc(urls, c => c.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }), 12000);
  if (!tx) return null;
  const meta = tx.meta;
  const keys: any[] = tx.transaction.message.accountKeys;
  const accounts: SolTxAccountChange[] = keys.map((k, i) => {
    const pre = (meta?.preBalances?.[i] ?? 0) / LAMPORTS_PER_SOL;
    const post = (meta?.postBalances?.[i] ?? 0) / LAMPORTS_PER_SOL;
    return { address: k.pubkey.toBase58(), signer: !!k.signer, writable: !!k.writable, preSol: pre, postSol: post, deltaSol: post - pre };
  });
  const tokKey = (b: any) => `${b.accountIndex}:${b.mint}`;
  const preTok = new Map<string, any>((meta?.preTokenBalances ?? []).map((b: any) => [tokKey(b), b]));
  const postTok = new Map<string, any>((meta?.postTokenBalances ?? []).map((b: any) => [tokKey(b), b]));
  const tokenChanges: SolTxTokenChange[] = [];
  new Set([...preTok.keys(), ...postTok.keys()]).forEach(k => {
    const a = preTok.get(k), b = postTok.get(k), ref = b ?? a;
    const pre = Number(a?.uiTokenAmount?.uiAmount ?? 0), post = Number(b?.uiTokenAmount?.uiAmount ?? 0);
    if (pre === post) return;
    tokenChanges.push({ owner: ref.owner ?? null, mint: ref.mint, pre, post, delta: post - pre, decimals: ref.uiTokenAmount?.decimals ?? 0 });
  });
  const inner: any[] = meta?.innerInstructions ?? [];
  const instructions: SolTxInstruction[] = (tx.transaction.message.instructions as any[]).map((ix, idx) => {
    const programId = ix.programId.toBase58();
    const parsed = ix.parsed;
    let summary: string | null = null;
    if (parsed?.info) {
      const i = parsed.info;
      if (i.lamports != null && (i.source || i.destination)) summary = `${i.source ?? '?'} → ${i.destination ?? '?'} · ${(Number(i.lamports) / LAMPORTS_PER_SOL).toLocaleString('en-US', { maximumFractionDigits: 9 })} SOL`;
      else if (i.amount != null || i.tokenAmount) summary = `${i.source ?? i.account ?? ''} → ${i.destination ?? ''} · ${i.tokenAmount?.uiAmountString ?? i.amount}`;
    }
    return {
      program: SOL_KNOWN_PROGRAMS[programId] ?? ix.program ?? 'Unknown Program', programId,
      type: parsed?.type ?? null, summary,
      innerCount: inner.filter(g => g.index === idx).reduce((a, g) => a + g.instructions.length, 0),
    };
  });
  return {
    signature, slot: tx.slot, blockTime: tx.blockTime ?? null, ok: !meta?.err,
    err: meta?.err ? JSON.stringify(meta.err) : null,
    feeSol: (meta?.fee ?? 0) / LAMPORTS_PER_SOL,
    computeUnits: meta?.computeUnitsConsumed ?? null,
    version: String(tx.version ?? 'legacy'),
    recentBlockhash: tx.transaction.message.recentBlockhash,
    signers: accounts.filter(a => a.signer).map(a => a.address),
    accounts, tokenChanges, instructions, logs: meta?.logMessages ?? [],
    rawJson: JSON.stringify(tx, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2),
  };
}

export type SolAccountKind = 'wallet' | 'program' | 'mint' | 'token-account' | 'stake' | 'vote' | 'other' | 'empty';
export interface SolAccountInfo {
  address: string; exists: boolean; kind: SolAccountKind; kindLabel: string;
  lamports: number; owner: string | null; ownerLabel: string | null; executable: boolean; dataSize: number; rentEpoch: string | null;
  mint?: { decimals: number; supply: string; supplyUi: number; mintAuthority: string | null; freezeAuthority: string | null; isInitialized: boolean; program: 'Token' | 'Token-2022' };
}

export async function fetchSolAccountInfo(net: SolNetworkCfg, address: string): Promise<SolAccountInfo> {
  const pk = new PublicKey(address.trim());
  const urls = orderedSolRpcs(net);
  const res = await anySolRpc(urls, c => c.getParsedAccountInfo(pk, 'confirmed'), 9000);
  const v: any = res.value;
  if (!v) return { address, exists: false, kind: 'empty', kindLabel: 'Akun belum ada di chain', lamports: 0, owner: null, ownerLabel: null, executable: false, dataSize: 0, rentEpoch: null };
  const owner = v.owner.toBase58();
  const parsed = v.data?.parsed;
  const base = {
    address, exists: true, lamports: v.lamports, owner, ownerLabel: SOL_KNOWN_PROGRAMS[owner] ?? null,
    executable: !!v.executable, dataSize: Array.isArray(v.data) ? Buffer.from(v.data[0], 'base64').length : (v.data?.space ?? 0),
    rentEpoch: v.rentEpoch != null ? String(v.rentEpoch) : null,
  };
  if (v.executable) return { ...base, kind: 'program', kindLabel: 'Program (executable)' };
  if (parsed?.type === 'mint' && (owner === TOKEN_PROGRAM_ID.toBase58() || owner === TOKEN_2022_PROGRAM_ID.toBase58())) {
    const i = parsed.info;
    return {
      ...base, kind: 'mint', kindLabel: 'Token Mint (SPL)',
      mint: {
        decimals: i.decimals, supply: i.supply, supplyUi: Number(i.supply) / 10 ** i.decimals,
        mintAuthority: i.mintAuthority ?? null, freezeAuthority: i.freezeAuthority ?? null, isInitialized: !!i.isInitialized,
        program: owner === TOKEN_2022_PROGRAM_ID.toBase58() ? 'Token-2022' : 'Token',
      },
    };
  }
  if (parsed?.type === 'account') return { ...base, kind: 'token-account', kindLabel: 'Token Account' };
  if (parsed?.program === 'stake') return { ...base, kind: 'stake', kindLabel: 'Stake Account' };
  if (parsed?.program === 'vote') return { ...base, kind: 'vote', kindLabel: 'Vote Account' };
  if (owner === '11111111111111111111111111111111') return { ...base, kind: 'wallet', kindLabel: 'Wallet (System Account)' };
  return { ...base, kind: 'other', kindLabel: `Data Account${base.ownerLabel ? ` · ${base.ownerLabel}` : ''}` };
}

/* ── Explorer: detail tambahan (supply, priority fee, validator, holder, metadata) ── */

export interface SolSupplyInfo { totalSol: number; circulatingSol: number; nonCirculatingSol: number }
export async function fetchSolSupply(net: SolNetworkCfg): Promise<SolSupplyInfo> {
  const r = await anySolRpc(orderedSolRpcs(net), c => c.getSupply({ commitment: 'confirmed', excludeNonCirculatingAccountsList: true }), 12000);
  return {
    totalSol: r.value.total / LAMPORTS_PER_SOL,
    circulatingSol: r.value.circulating / LAMPORTS_PER_SOL,
    nonCirculatingSol: r.value.nonCirculating / LAMPORTS_PER_SOL,
  };
}

export interface SolBlockFeeSample {
  slot: number; txCount: number; paidPct: number;
  /** µ-lamport/CU. exact=true → dibaca dari instruksi ComputeBudget; false → diperkirakan dari fee ÷ CU terpakai (cenderung lebih tinggi). */
  p50: number; p75: number; p90: number; max: number; exact: boolean;
  /** Priority fee per TX dalam lamport (di luar base fee 5.000/sig), selalu akurat. */
  lamP50: number; lamP90: number; lamMax: number;
}
export interface SolPriorityFees {
  medianMicroLamports: number; p75MicroLamports: number; maxMicroLamports: number; sampleSlots: number; typicalFeeSol: number;
  hotMedianMicroLamports: number | null; hotP75MicroLamports: number | null; hotP90MicroLamports: number | null;
  nonZeroSlotPct: number; hotNonZeroSlotPct: number | null;
  competitiveFeeSol: number;
  block: SolBlockFeeSample | null;
}
const SOL_HOT_ACCOUNTS = [
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
  'So11111111111111111111111111111111111111112', // wSOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
];
const SOL_VOTE_PROGRAM = 'Vote111111111111111111111111111111111111111';
function solQuantiles(arr: { prioritizationFee: number }[]) {
  const v = arr.map(x => x.prioritizationFee).sort((a, b) => a - b);
  const q = (p: number) => (v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : 0);
  const nz = v.length ? (v.filter(x => x > 0).length / v.length) * 100 : 0;
  return { median: q(0.5), p75: q(0.75), p90: q(0.9), max: v.length ? v[v.length - 1] : 0, n: v.length, nz };
}

async function sampleBlockPriorityFees(urls: string[]): Promise<SolBlockFeeSample | null> {
  const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  try {
    const slot = await anySolRpc(urls, c => c.getSlot('confirmed'), 8000);
    for (const mode of ['full', 'accounts'] as const) {
      for (const off of [3, 8]) {
        const target = slot - off;
        const blk: any = await anySolRpc(urls, async c => {
          try { return await (c as any).getBlock(target, { transactionDetails: mode, rewards: false, maxSupportedTransactionVersion: 0, commitment: 'confirmed' }); }
          catch { return null; }
        }, mode === 'full' ? 15000 : 12000);
        if (!blk) continue;
        const prices: number[] = [], lams: number[] = [];
        for (const t of blk.transactions ?? []) {
          const tx: any = t?.transaction;
          if (!tx) continue;
          const sigs = tx.signatures?.length ?? 1;
          const lam = Math.max(0, (t.meta?.fee ?? 0) - SOL_BASE_FEE_PER_SIG * sigs);
          let price = 0, isVote = false;
          if (mode === 'full') {
            const msg: any = tx.message;
            if (!msg) continue;
            const keys: PublicKey[] = msg.staticAccountKeys ?? msg.accountKeys ?? [];
            const ixs: any[] = msg.compiledInstructions ?? msg.instructions ?? [];
            for (const ix of ixs) {
              const pid = keys[ix.programIdIndex]?.toBase58();
              if (pid === SOL_VOTE_PROGRAM) { isVote = true; break; }
              if (pid === COMPUTE_BUDGET_PROGRAM) {
                const d = Buffer.from(ix.data);
                if (d[0] === 3 && d.length >= 9) price = Number(d.readBigUInt64LE(1));
              }
            }
          } else {
            const keys: string[] = (tx.accountKeys ?? []).map((k: any) => (k?.pubkey ?? k).toString());
            isVote = keys.includes(SOL_VOTE_PROGRAM);
            const cu = t.meta?.computeUnitsConsumed ?? 0;
            price = cu > 0 && lam > 0 ? Math.round((lam * 1_000_000) / cu) : 0;
          }
          if (isVote) continue;
          prices.push(price); lams.push(lam);
        }
        if (prices.length === 0) continue;
        prices.sort((a, b) => a - b); lams.sort((a, b) => a - b);
        return {
          slot: target, txCount: prices.length, paidPct: (lams.filter(x => x > 0).length / lams.length) * 100,
          p50: pct(prices, 0.5), p75: pct(prices, 0.75), p90: pct(prices, 0.9), max: prices[prices.length - 1], exact: mode === 'full',
          lamP50: pct(lams, 0.5), lamP90: pct(lams, 0.9), lamMax: lams[lams.length - 1],
        };
      }
    }
  } catch { /* opsional */ }
  return null;
}

export async function fetchSolPriorityFees(net: SolNetworkCfg): Promise<SolPriorityFees> {
  const urls = orderedSolRpcs(net);
  const [globalRaw, hotSettled, block] = await Promise.all([
    anySolRpc(urls, c => c.getRecentPrioritizationFees(), 9000),
    net.id === 'mainnet'
      ? Promise.allSettled(SOL_HOT_ACCOUNTS.map(k => anySolRpc(urls, c => c.getRecentPrioritizationFees({ lockedWritableAccounts: [new PublicKey(k)] }), 9000)))
      : Promise.resolve([] as PromiseSettledResult<{ slot: number; prioritizationFee: number }[]>[]),
    sampleBlockPriorityFees(urls),
  ]);
  const global = solQuantiles(globalRaw);

  let hot: ReturnType<typeof solQuantiles> | null = null;
  const perSlot = new Map<number, number>();
  for (const r of hotSettled) {
    if (r.status !== 'fulfilled') continue;
    for (const x of r.value) perSlot.set(x.slot, Math.max(perSlot.get(x.slot) ?? 0, x.prioritizationFee));
  }
  if (perSlot.size > 0) hot = solQuantiles(Array.from(perSlot.values()).map(prioritizationFee => ({ prioritizationFee })));

  const effTransfer = Math.max(global.median, hot?.median ?? 0);
  const effCompetitive = Math.max(global.p75, hot?.p75 ?? 0, block?.p75 ?? 0);
  return {
    medianMicroLamports: global.median, p75MicroLamports: global.p75, maxMicroLamports: global.max, sampleSlots: global.n,
    hotMedianMicroLamports: hot ? hot.median : null, hotP75MicroLamports: hot ? hot.p75 : null, hotP90MicroLamports: hot ? hot.p90 : null,
    nonZeroSlotPct: global.nz, hotNonZeroSlotPct: hot ? hot.nz : null,
    typicalFeeSol: (SOL_BASE_FEE_PER_SIG + Math.ceil((effTransfer * 200_000) / 1_000_000)) / LAMPORTS_PER_SOL,
    competitiveFeeSol: (SOL_BASE_FEE_PER_SIG + Math.ceil((effCompetitive * 300_000) / 1_000_000)) / LAMPORTS_PER_SOL,
    block,
  };
}

export interface SolValidatorRow { votePubkey: string; nodePubkey: string; commission: number; stakeSol: number; stakePct: number; lastVote: number; skipRatePct: null }
export interface SolValidatorsOverview { activeCount: number; delinquentCount: number; totalActiveStakeSol: number; top: SolValidatorRow[]; nakamoto: number }
export async function fetchSolValidatorsOverview(net: SolNetworkCfg, limit = 15): Promise<SolValidatorsOverview> {
  const r = await anySolRpc(orderedSolRpcs(net), c => c.getVoteAccounts('confirmed'), 15000);
  const total = r.current.reduce((a, v) => a + v.activatedStake, 0);
  const sorted = [...r.current].sort((a, b) => b.activatedStake - a.activatedStake);
  let acc = 0, nakamoto = 0;
  for (const v of sorted) { acc += v.activatedStake; nakamoto++; if (acc > total / 3) break; }
  return {
    activeCount: r.current.length, delinquentCount: r.delinquent.length, totalActiveStakeSol: total / LAMPORTS_PER_SOL, nakamoto,
    top: sorted.slice(0, limit).map(v => ({
      votePubkey: v.votePubkey, nodePubkey: v.nodePubkey, commission: v.commission, stakeSol: v.activatedStake / LAMPORTS_PER_SOL,
      stakePct: total > 0 ? (v.activatedStake / total) * 100 : 0, lastVote: v.lastVote, skipRatePct: null,
    })),
  };
}

export interface SolHolder { tokenAccount: string; owner: string | null; amount: number; pct: number | null }
export async function fetchSolTopHolders(net: SolNetworkCfg, mint: string, supplyUi: number): Promise<SolHolder[]> {
  const urls = orderedSolRpcs(net);
  const pk = new PublicKey(mint);
  const largest = await anySolRpc(urls, c => c.getTokenLargestAccounts(pk, 'confirmed'), 15000);
  const list = largest.value.slice(0, 20);
  if (!list.length) return [];
  const infos = await anySolRpc(urls, c => c.getMultipleParsedAccounts(list.map(l => l.address), { commitment: 'confirmed' }), 12000).catch(() => null);
  return list.map((l, i) => {
    const amount = Number(l.uiAmountString ?? l.uiAmount ?? 0);
    const owner = (infos?.value?.[i]?.data as any)?.parsed?.info?.owner ?? null;
    return { tokenAccount: l.address.toBase58(), owner, amount, pct: supplyUi > 0 ? (amount / supplyUi) * 100 : null };
  });
}

export interface SolTokenMeta { symbol: string | null; name: string | null; icon: string | null; usdPrice: number | null; holderCount: number | null; verified: boolean; liquidity: number | null; mcap: number | null }
export async function fetchSolTokenMeta(mint: string): Promise<SolTokenMeta | null> {
  const m = (await jupTokenMeta([mint]))[mint];
  if (!m) return null;
  return {
    symbol: m.symbol ?? null, name: m.name ?? null, icon: m.icon ?? null,
    usdPrice: typeof m.usdPrice === 'number' ? m.usdPrice : null,
    holderCount: typeof m.holderCount === 'number' ? m.holderCount : null,
    verified: !!m.isVerified, liquidity: typeof m.liquidity === 'number' ? m.liquidity : null, mcap: typeof m.mcap === 'number' ? m.mcap : null,
  };
}

export interface SolBlockStats { totalFeesSol: number; rewardsCount: number; leader: string | null; failedTx: number | null; computeUnits: number | null }
export async function fetchSolBlockStats(net: SolNetworkCfg, slot: number): Promise<SolBlockStats | null> {
  const b: any = await anySolRpc(orderedSolRpcs(net), async c => {
    try { return await c.getBlock(slot, { transactionDetails: 'full', rewards: true, maxSupportedTransactionVersion: 0, commitment: 'confirmed' }); }
    catch { return null; }
  }, 20000);
  if (!b) return null;
  const txs: any[] = b.transactions ?? [];
  const fees = txs.reduce((a, t) => a + (t.meta?.fee ?? 0), 0);
  const cu = txs.reduce((a, t) => a + (t.meta?.computeUnitsConsumed ?? 0), 0);
  const leader = (b.rewards ?? []).find((r: any) => r.rewardType === 'Fee')?.pubkey ?? null;
  return { totalFeesSol: fees / LAMPORTS_PER_SOL, rewardsCount: (b.rewards ?? []).length, leader, failedTx: txs.filter(t => t.meta?.err).length, computeUnits: cu || null };
}
