import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ethers } from 'ethers';
import { Navbar } from '../components/Navbar';
import { KNOWN_4BYTE, KNOWN_TOPICS } from './wallet-gen/know';
import type { RPCNetwork, DetectedToken } from './wallet-gen/types';
import { DEFAULT_NETWORKS, RPC_NETWORKS_STORAGE_KEY, BLOCKSCOUT_HOSTS } from './wallet-gen/constants';
import { fetchEvmTokenPortfolio } from './wallet-gen/helpers';
import {
  GRAM_NETWORKS, type GramNetworkCfg, type GramTxHistoryEntry, type GramTxDetail,
  getGramAccountState, getGramBalanceWithFallback, fetchGramTxHistory, fetchGramTxByHash,
  isValidGramAddress, gramFriendlyError, gramActivationNote, fetchGramTokenPortfolio,
  gramTxHashToHex, GRAM_WALLET_VERSIONS,
  getGramMasterchainInfo, gramAddressFormats,
  fetchGramLatestBlocks, fetchGramLatestTransactions, fetchGramLatestAccounts,
  GRAM_ACCOUNT_TYPES, GRAM_TX_TYPES, GRAM_ACCOUNT_STATUS_LABELS,
  type GramMasterchainInfo, type GramLatestBlock, type GramLatestTx, type GramLatestAccount,
} from './wallet-gen/network/Gramnet';
import {
  ASENTUM_NETWORKS, type AsentumNetworkCfg,
  isValidAsentumAddress, getAsentumBalanceWithFallback,
  hexToAsentumBech32, asentumBech32ToHex, aseFriendlyError,
  getAsentumChainStatus, getAsentumLatestBlocks, getAsentumBlockByHeight, getAsentumBlockByHash,
  getAsentumTransactionByHash, getAsentumMempool, getAsentumValidators, getAsentumBlockTxs, getAsentumAddressHistory, getAsentumAccountInfo, asentumAddrKey,
  formatAseGwei, formatAseAmount, asentumFeeTiers, getAsentumTxActivity,
  type AsentumActivityRange, type AsentumTxActivity,
  type AsentumChainStatus, type AsentumBlockSummary, type AsentumTxSummary, type AsentumValidator, type AsentumAddressHistory, type AsentumAccountInfo,
} from './wallet-gen/network/Asentumnet';
import {
  FaSearch, FaCube, FaExchangeAlt, FaWallet, FaFileCode, FaCopy,
  FaCheckCircle, FaTimesCircle, FaClock, FaSpinner, FaExternalLinkAlt,
  FaGlobe, FaLayerGroup, FaGasPump, FaArrowRight, FaChevronDown, FaChevronUp,
  FaExclamationTriangle, FaCompass, FaCoins, FaHistory, FaListUl,
  FaUsers, FaTag, FaChartLine, FaCog, FaSyncAlt, FaPlay, FaBolt,
  FaPlug, FaFileImport, FaUnlink, FaPlus, FaShieldAlt, FaChartBar,
} from 'react-icons/fa';

type ResultType = 'address' | 'tx' | 'block' | null;

interface AddressResult {
  address: string;
  balance: string;
  balanceUsd: number | null;
  txCount: number;
  isContract: boolean;
  code: string;
}

interface TxLog {
  address: string;
  logIndex: number;
  topic0: string | null;
  eventGuess: string | null;
  rawTopics: string[];
  rawData: string;
  transferKind?: 'erc20' | 'erc721' | null;
  transferFrom?: string | null;
  transferTo?: string | null;
  transferAmount?: string | null;
  transferSymbol?: string | null;
}

interface DecodedParam {
  name: string;
  type: string;
  value: string;
  note?: string;
}

interface TxResult {
  hash: string;
  status: 'success' | 'failed' | 'pending';
  blockNumber: number | null;
  timestamp: number | null;
  from: string;
  to: string | null;
  value: string;
  gasUsed: string | null;
  gasLimit: string | null;
  gasPrice: string;
  nonce: number;
  type: number | null;
  dataSelector: string | null;
  methodGuess: string | null;
  logs: TxLog[];
  totalLogs: number;
  confirmations: number | null;
  transactionIndex: number | null;
  feeNative: string | null;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  inputData: string;
  decodedParams: DecodedParam[];
  rawTxJson: string;
  rawReceiptJson: string | null;
  logsBloom: string | null;
}

interface BlockResult {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  txCount: number;
  baseFeePerGas: string | null;
  difficulty: string | null;
  extraData: string | null;
  transactions: { hash: string; from: string; to: string | null; value: string }[];
  rawJson: string;
}

interface LatestBlock {
  number: number;
  timestamp: number;
  txCount: number;
  miner: string;
}

interface RecentTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: number | null;
  status: 'success' | 'failed' | 'pending';
  methodGuess: string | null;
  source?: 'blockscout' | 'rpc';
  isTokenTransfer?: boolean;
  tokenAddress?: string;
}

interface ContractInfo {
  name: string | null;
  isVerified: boolean;
  compilerVersion?: string | null;
  language?: string | null;
  source?: 'blockscout' | 'rpc';
  isProxy?: boolean;
  implementation?: string | null;
  standardGuess?: string | null;
  creatorAddress?: string | null;
  creationTxHash?: string | null;
  abi?: any[] | null;
}

interface TokenInfo {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  totalSupplyRaw: string | null;
  standard: string;
  holdersCount: number | null;
  iconUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  source: DataSource;
}

interface TokenHolder {
  address: string;
  balance: string;
  percentage: number | null;
}

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number | null;
  isNft: boolean;
}

type DataSource = 'blockscout' | 'rpc' | null;

interface GramJettonInfo {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  description: string | null;
  imageUrl: string | null;
  totalSupplyRaw: string;
  totalSupplyFormatted: string;
  mintable: boolean;
  adminAddress: string | null;
}

interface GramJettonHolder {
  address: string;
  balanceFormatted: string;
  percentage: number | null;
}

interface GramTopJetton {
  poolAddress: string;
  tokenAddress: string | null;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  priceChangePct24h: number | null;
  volumeUsd24h: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  dexName: string | null;
  poolUrl: string;
  poolCreatedAt: number | null;
}

interface GramTonTicker {
  priceUsd: number | null;
  changePct24h: number | null;
  marketCapUsd: number | null;
  volumeUsd24h: number | null;
}

function shortHash(h: string, front = 10, back = 8) {
  return h && h.length > front + back ? `${h.slice(0, front)}…${h.slice(-back)}` : h;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Logo Asentum Explorer ───────────────────────────────────────────────
// Heksagon (blok/chain) + huruf "A" dengan titik di puncak (node/validator).
// `mono` = pakai currentColor supaya ikut warna teks tombol aktif/nonaktif.
const AsentumLogo: React.FC<{ size?: number; mono?: boolean; style?: React.CSSProperties }> = ({ size = 16, mono = false, style }) => {
  const c = mono ? 'currentColor' : 'url(#aseLogoGrad)';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }} role="img" aria-label="Asentum">
      <defs>
        <linearGradient id="aseLogoGrad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B6AAFF" />
          <stop offset="1" stopColor="#4949DF" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25L16 2.5Z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M10.6 21.8 16 10.2l5.4 11.6" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6 17.6h6.8" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="9.2" r="1.7" fill={c} />
    </svg>
  );
};

// Timestamp Asentum bisa detik atau milidetik → selalu jadikan detik.
function aseTs(ts: number | null | undefined): number | null {
  if (ts == null) return null;
  return ts < 2e10 ? ts : Math.floor(ts / 1000);
}

// Ambil field pertama yang ada dari objek raw (header/body/receipt).
function aseRawField(raw: any, keys: string[]): string | null {
  const srcs = [raw, raw?.header, raw?.receipt, raw?.body];
  for (const src of srcs) {
    if (!src || typeof src !== 'object') continue;
    for (const k of keys) {
      const v = src[k];
      if (v != null && typeof v !== 'object') return String(v);
    }
  }
  return null;
}

const ASE_RECENT_KEY = 'aseExplorerRecent';

function safeGramFmt(addr: string | null | undefined, net: GramNetworkCfg) {
  if (!addr) return null;
  try { return gramAddressFormats(addr, net); } catch { return null; }
}

function isGramTestnet(net: GramNetworkCfg): boolean {
  const s = `${(net as any).id ?? ''} ${net.name ?? ''} ${net.explorerUrl ?? ''}`.toLowerCase();
  return s.includes('testnet');
}

function gramToncenterBase(net: GramNetworkCfg): string {
  return isGramTestnet(net) ? 'https://testnet.toncenter.com' : 'https://toncenter.com';
}

const TONCENTER_MIN_GAP_MS = 1100;
let tonCenterQueue: Promise<void> = Promise.resolve();
let tonCenterLastRequestAt = 0;

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function isRateLimitError(e: any): boolean {
  const msg = String(e?.message ?? e ?? '');
  return /429|rate.?limit|too many request/i.test(msg);
}

// Nerjemahin error mentah dari ethers/RPC/wallet jadi kalimat pendek yang gampang
// dimengerti, misalnya "could not detect network (event=\"noNetwork\", code=NETWORK_ERROR,
// version=providers/5.8.0)" jadi cukup "Gagal konek ke RPC.". Kalau gak kenal polanya,
// balik ke pesan fallback yang sudah manusiawi (bukan raw error).
function friendlyRpcError(e: any, fallback: string): string {
  const raw = String(e?.error?.message || e?.message || e || '');
  if (/could not detect network|no.?network|network.?error/i.test(raw)) {
    return 'Gagal konek ke RPC. Coba ganti RPC atau network lain.';
  }
  if (/timeout|timed out/i.test(raw)) {
    return 'RPC tidak merespons (timeout). Coba lagi sebentar lagi.';
  }
  if (isRateLimitError(e)) {
    return 'RPC lagi dibatasi (rate limit). Tunggu sebentar lalu coba lagi.';
  }
  if (/failed to fetch|networkerror when attempting to fetch|load failed/i.test(raw)) {
    return 'Gagal konek ke server. Cek koneksi internet kamu.';
  }
  if (/insufficient funds/i.test(raw)) {
    return 'Saldo tidak cukup untuk bayar gas.';
  }
  if (/user rejected|action_rejected/i.test(raw)) {
    return 'Transaksi dibatalkan di wallet.';
  }
  if (/invalid address/i.test(raw)) {
    return 'Format address tidak valid.';
  }
  // Revert reason dari contract (kalau ada) biasanya udah jelas, jadi ditampilkan apa adanya
  if (typeof e?.reason === 'string' && e.reason) return e.reason;
  if (/call_exception|execution reverted|missing revert data/i.test(raw)) {
    return 'Panggilan ke contract gagal (revert).';
  }
  return fallback;
}

function runTonCenterRequest<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    tonCenterQueue = tonCenterQueue.then(async () => {
      const wait = TONCENTER_MIN_GAP_MS - (Date.now() - tonCenterLastRequestAt);
      if (wait > 0) await sleep(wait);

      for (let attempt = 0; ; attempt++) {
        try {
          const result = await fn();
          tonCenterLastRequestAt = Date.now();
          resolve(result);
          return;
        } catch (e: any) {
          tonCenterLastRequestAt = Date.now();
          if (!isRateLimitError(e) || attempt >= retries) {
            reject(e);
            return;
          }
          await sleep(TONCENTER_MIN_GAP_MS * Math.pow(2, attempt) + Math.random() * 300);
        }
      }
    });
  });
}

async function fetchGramJettonInfo(address: string, net: GramNetworkCfg): Promise<GramJettonInfo | null> {
  const base = gramToncenterBase(net);
  const json = await runTonCenterRequest(async () => {
    const res = await fetch(`${base}/api/v3/jetton/masters?address=${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
  const m = Array.isArray(json?.jetton_masters) ? json.jetton_masters[0] : null;
  if (!m) return null;

  const content = m.jetton_content ?? m.content ?? {};
  const decimalsRaw = content.decimals;
  const decimals = decimalsRaw != null && !isNaN(parseInt(String(decimalsRaw), 10))
    ? parseInt(String(decimalsRaw), 10) : 9;

  const totalSupplyRaw = String(m.total_supply ?? '0');
  let totalSupplyFormatted = totalSupplyRaw;
  try { totalSupplyFormatted = ethers.utils.formatUnits(totalSupplyRaw, decimals); } catch {}

  return {
    address: m.address ?? address,
    name: content.name ?? null,
    symbol: content.symbol ?? null,
    decimals,
    description: content.description ?? null,
    imageUrl: content.image ?? null,
    totalSupplyRaw,
    totalSupplyFormatted,
    mintable: !!m.mintable,
    adminAddress: m.admin_address ?? null,
  };
}

async function fetchGramJettonHolders(jettonAddress: string, net: GramNetworkCfg, decimals: number, totalSupplyRaw: string): Promise<GramJettonHolder[]> {
  const base = gramToncenterBase(net);
  const json = await runTonCenterRequest(async () => {
    const res = await fetch(`${base}/api/v3/jetton/wallets?jetton_address=${encodeURIComponent(jettonAddress)}&limit=20`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
  const items: any[] = Array.isArray(json?.jetton_wallets) ? json.jetton_wallets : [];
  let totalBn = 0n;
  try { totalBn = BigInt(totalSupplyRaw || '0'); } catch {}

  return items
    .map(it => {
      const balRaw = String(it?.balance ?? '0');
      let balBn = 0n;
      try { balBn = BigInt(balRaw); } catch {}
      return {
        address: it?.owner_address ?? it?.owner ?? it?.address ?? '',
        balBn,
        balanceFormatted: (() => { try { return ethers.utils.formatUnits(balRaw, decimals); } catch { return balRaw; } })(),
      };
    })
    .filter(h => h.address)
    .sort((a, b) => (b.balBn > a.balBn ? 1 : b.balBn < a.balBn ? -1 : 0))
    .slice(0, 20)
    .map(h => ({
      address: h.address,
      balanceFormatted: h.balanceFormatted,
      percentage: totalBn > 0n ? Number((h.balBn * 10000n) / totalBn) / 100 : null,
    }));
}

function mapGeckoTonPools(json: any, limit: number): GramTopJetton[] {
  const pools: any[] = Array.isArray(json?.data) ? json.data : [];
  const included: any[] = Array.isArray(json?.included) ? json.included : [];
  const byId = new Map<string, any>(included.map((it: any) => [it.id, it]));

  const toNum = (v: any): number | null => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  return pools
    .map((p: any): GramTopJetton | null => {
      const attrs = p?.attributes ?? {};
      const baseTokenId = p?.relationships?.base_token?.data?.id;
      const dexId = p?.relationships?.dex?.data?.id;
      const baseToken = baseTokenId ? byId.get(baseTokenId) : null;
      const dex = dexId ? byId.get(dexId) : null;
      const baseAttrs = baseToken?.attributes ?? {};
      if (!baseAttrs?.address) return null;

      const createdAtRaw = attrs.pool_created_at;
      const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : NaN;

      return {
        poolAddress: attrs.address ?? '',
        tokenAddress: baseAttrs.address ?? null,
        name: baseAttrs.name ?? null,
        symbol: baseAttrs.symbol ?? null,
        imageUrl: baseAttrs.image_url && !String(baseAttrs.image_url).includes('missing.png') ? baseAttrs.image_url : null,
        priceUsd: toNum(attrs.base_token_price_usd),
        priceChangePct24h: toNum(attrs.price_change_percentage?.h24),
        volumeUsd24h: toNum(attrs.volume_usd?.h24),
        liquidityUsd: toNum(attrs.reserve_in_usd),
        fdvUsd: toNum(attrs.market_cap_usd ?? attrs.fdv_usd),
        dexName: dex?.attributes?.name ?? null,
        poolUrl: `https://www.geckoterminal.com/ton/pools/${attrs.address ?? ''}`,
        poolCreatedAt: !isNaN(createdAtMs) ? Math.floor(createdAtMs / 1000) : null,
      };
    })
    .filter((j): j is GramTopJetton => j !== null)
    .slice(0, limit);
}

async function fetchGramTopJettons(): Promise<GramTopJetton[]> {
  const res = await fetch('https://api.geckoterminal.com/api/v2/networks/ton/trending_pools?include=base_token,quote_token,dex');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return mapGeckoTonPools(json, 20);
}

async function fetchGramNewJettonPools(): Promise<GramTopJetton[]> {
  const res = await fetch('https://api.geckoterminal.com/api/v2/networks/ton/new_pools?include=base_token,quote_token,dex');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return mapGeckoTonPools(json, 20);
}

async function fetchGramTonTicker(): Promise<GramTonTicker> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true'
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const d = json?.['the-open-network'] ?? {};
  return {
    priceUsd: typeof d.usd === 'number' ? d.usd : null,
    changePct24h: typeof d.usd_24h_change === 'number' ? d.usd_24h_change : null,
    marketCapUsd: typeof d.usd_market_cap === 'number' ? d.usd_market_cap : null,
    volumeUsd24h: typeof d.usd_24h_vol === 'number' ? d.usd_24h_vol : null,
  };
}

function isAddress(v: string) { return /^0x[0-9a-fA-F]{40}$/.test(v); }
function isTxOrBlockHash(v: string) { return /^0x[0-9a-fA-F]{64}$/.test(v); }
function isBlockNumber(v: string) { return /^\d+$/.test(v); }

function buildRawTxJson(tx: ethers.providers.TransactionResponse): string {
  const raw: Record<string, unknown> = {
    hash: tx.hash,
    type: tx.type ?? null,
    nonce: tx.nonce,
    blockHash: tx.blockHash ?? null,
    blockNumber: tx.blockNumber ?? null,
    transactionIndex: (tx as any).transactionIndex ?? null,
    from: tx.from,
    to: tx.to ?? null,
    value: tx.value ? tx.value.toString() : '0',
    gasLimit: tx.gasLimit ? tx.gasLimit.toString() : null,
    gasPrice: tx.gasPrice ? tx.gasPrice.toString() : null,
    maxFeePerGas: tx.maxFeePerGas ? tx.maxFeePerGas.toString() : null,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? tx.maxPriorityFeePerGas.toString() : null,
    chainId: tx.chainId ?? null,
    input: tx.data || '0x',
    accessList: (tx as any).accessList ?? null,
    v: tx.v ?? null,
    r: tx.r ?? null,
    s: tx.s ?? null,
  };
  return JSON.stringify(raw, null, 2);
}

interface BlockWithTxsLike {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  difficulty?: number | ethers.BigNumber | null;
  gasLimit: ethers.BigNumber;
  gasUsed: ethers.BigNumber;
  extraData?: string | null;
  transactions: { hash: string }[];
}

function buildRawBlockJson(blk: BlockWithTxsLike): string {
  const raw = {
    number: blk.number,
    hash: blk.hash,
    parentHash: blk.parentHash,
    nonce: (blk as any).nonce ?? null,
    timestamp: blk.timestamp,
    miner: blk.miner,
    difficulty: blk.difficulty ? blk.difficulty.toString() : null,
    gasLimit: blk.gasLimit ? blk.gasLimit.toString() : null,
    gasUsed: blk.gasUsed ? blk.gasUsed.toString() : null,
    baseFeePerGas: (blk as any).baseFeePerGas ? (blk as any).baseFeePerGas.toString() : null,
    extraData: blk.extraData ?? null,
    transactionCount: blk.transactions.length,
    transactions: blk.transactions.map((t: { hash: string }) => t.hash),
  };
  return JSON.stringify(raw, null, 2);
}

function buildRawReceiptJson(receipt: ethers.providers.TransactionReceipt | null): string | null {
  if (!receipt) return null;
  const raw = {
    transactionHash: receipt.transactionHash,
    transactionIndex: receipt.transactionIndex,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber,
    from: receipt.from,
    to: receipt.to ?? null,
    contractAddress: receipt.contractAddress ?? null,
    cumulativeGasUsed: receipt.cumulativeGasUsed ? receipt.cumulativeGasUsed.toString() : null,
    gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : null,
    effectiveGasPrice: (receipt as any).effectiveGasPrice ? (receipt as any).effectiveGasPrice.toString() : null,
    status: receipt.status ?? null,
    type: (receipt as any).type ?? null,
    logsBloom: receipt.logsBloom ?? null,
    logs: (receipt.logs ?? []).map(l => ({
      address: l.address,
      topics: l.topics,
      data: l.data,
      blockNumber: l.blockNumber,
      transactionHash: l.transactionHash,
      transactionIndex: l.transactionIndex,
      blockHash: l.blockHash,
      logIndex: l.logIndex,
      removed: l.removed,
    })),
  };
  return JSON.stringify(raw, null, 2);
}

function decodeCalldataSlot(hex32: string, abiType: string): string {
  try {
    const h = hex32.replace(/^0x/, '').padStart(64, '0');
    if (abiType === 'address') return ethers.utils.getAddress('0x' + h.slice(24));
    if (abiType === 'bool') return BigInt('0x' + h) === 0n ? 'false' : 'true';
    if (abiType.startsWith('uint') || abiType.startsWith('int')) {
      const signed = abiType.startsWith('int');
      const bits = parseInt(abiType.replace(/^u?int/, '') || '256', 10);
      let val = BigInt('0x' + h);
      if (signed && (val >> BigInt(bits - 1)) === 1n) val -= (1n << BigInt(bits));
      return val.toString();
    }
    if (abiType.startsWith('bytes') && abiType !== 'bytes') {
      const size = parseInt(abiType.replace('bytes', ''), 10) || 32;
      return '0x' + h.slice(0, size * 2);
    }
    return '0x' + h;
  } catch {
    return '0x' + hex32.replace(/^0x/, '');
  }
}

function decodeCalldataParams(inputData: string, knownSig: string | null): DecodedParam[] {
  if (!knownSig || !inputData || inputData.length <= 10) return [];
  const inner = knownSig.slice(knownSig.indexOf('(') + 1, knownSig.lastIndexOf(')'));
  const typeList = inner ? inner.split(',').map(t => t.trim()).filter(Boolean) : [];
  if (typeList.length === 0) return [];

  const body = inputData.slice(10);
  const params: DecodedParam[] = [];
  let offset = 0;
  typeList.forEach((abiType, i) => {
    const slot = body.slice(offset, offset + 64);
    if (slot.length < 64) { params.push({ name: `param${i}`, type: abiType, value: '(data terpotong)' }); return; }
    const isDynamic = abiType === 'string' || abiType === 'bytes' || abiType.endsWith('[]') || abiType.startsWith('(');
    let value: string; let note: string | undefined;
    if (isDynamic) {
      value = `offset 0x${BigInt('0x' + slot).toString(16)} (tipe dinamis -- lihat raw input data)`;
    } else {
      value = decodeCalldataSlot(slot, abiType);
      if (abiType === 'uint256') {
        try {
          const bn = BigInt('0x' + slot);
          if (bn > 10n ** 12n) note = `~ ${ethers.utils.formatUnits(slot, 18)} (kalau 18 decimals)`;
        } catch {}
      }
    }
    params.push({ name: `param${i}`, type: abiType, value, note });
    offset += 64;
  });
  return params;
}

function decodeRevertData(data: string): string | null {
  if (!data || data === '0x') return null;
  try {
    if (data.startsWith('0x08c379a0')) {
      const [reason] = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + data.slice(10));
      return reason;
    }
    if (data.startsWith('0x4e487b71')) {
      const [codeBn] = ethers.utils.defaultAbiCoder.decode(['uint256'], '0x' + data.slice(10));
      const code = codeBn.toNumber();
      const PANIC: Record<number, string> = {
        1: 'Assertion gagal', 17: 'Overflow/underflow aritmatika', 18: 'Pembagian dengan nol',
        33: 'Nilai enum tidak valid', 34: 'Akses storage byte array tidak valid',
        49: 'Pop pada array kosong', 50: 'Index array di luar batas',
        65: 'Alokasi memori terlalu besar', 81: 'Pemanggilan variabel fungsi internal yang belum diinisialisasi',
      };
      return `Panic -- ${PANIC[code] ?? `code 0x${code.toString(16)}`}`;
    }
  } catch {}
  return null;
}

async function fetchRevertReason(
  provider: ethers.providers.JsonRpcProvider,
  tx: ethers.providers.TransactionResponse,
): Promise<string | null> {
  try {
    await provider.call(
      { to: tx.to, from: tx.from, data: tx.data, value: tx.value, gasLimit: tx.gasLimit },
      tx.blockNumber ?? undefined,
    );
    return 'Tidak ada alasan revert (simulasi ulang justru berhasil -- kemungkinan state sudah berubah sejak TX ini di-mine).';
  } catch (err: any) {
    if (typeof err?.reason === 'string' && err.reason) return err.reason;
    const rawData: string | undefined = err?.error?.data ?? err?.data ?? err?.error?.error?.data;
    if (typeof rawData === 'string') {
      const decoded = decodeRevertData(rawData);
      if (decoded) return decoded;
    }
    return null;
  }
}


async function fetchAddressRecentTxs(address: string, networkId: string): Promise<RecentTx[]> {
  const host = BLOCKSCOUT_HOSTS[networkId];
  if (!host) {
    throw new Error('Riwayat transaksi belum didukung untuk network ini (belum ada instance Blockscout publik).');
  }
  const res = await fetch(`https://${host}/api/v2/addresses/${address}/transactions`);
  if (!res.ok) throw new Error(`Gagal mengambil riwayat transaksi (HTTP ${res.status}).`);
  const json = await res.json();
  const items: any[] = Array.isArray(json?.items) ? json.items : [];
  return items.slice(0, 12).map((it) => {
    const rawInput: string = it?.raw_input ?? it?.method ?? '';
    const selector = typeof rawInput === 'string' && rawInput.startsWith('0x') && rawInput.length >= 10
      ? rawInput.slice(2, 10).toLowerCase() : null;
    let valueEth = '0';
    try { valueEth = ethers.utils.formatEther(String(it?.value ?? '0')); } catch {}
    return {
      hash: it?.hash ?? '',
      from: it?.from?.hash ?? it?.from ?? '',
      to: it?.to?.hash ?? it?.to ?? null,
      value: valueEth,
      timestamp: it?.timestamp ? Math.floor(new Date(it.timestamp).getTime() / 1000) : null,
      status: it?.status === 'ok' ? 'success' : it?.status === 'error' ? 'failed' : 'pending',
      methodGuess: it?.method || (selector ? (KNOWN_4BYTE[selector] ?? null) : null),
    } as RecentTx;
  }).filter(t => t.hash);
}

async function fetchAddressCreatorInfo(address: string, host: string): Promise<{ creatorAddress: string | null; creationTxHash: string | null }> {
  try {
    const res = await fetch(`https://${host}/api/v2/addresses/${address}`);
    if (!res.ok) return { creatorAddress: null, creationTxHash: null };
    const json = await res.json();
    return {
      creatorAddress: json?.creator_address_hash ?? null,
      creationTxHash: json?.creation_tx_hash ?? json?.creation_transaction_hash ?? null,
    };
  } catch {
    return { creatorAddress: null, creationTxHash: null };
  }
}

async function fetchAddressContractInfo(address: string, networkId: string): Promise<ContractInfo> {
  const host = BLOCKSCOUT_HOSTS[networkId];
  if (!host) throw new Error('unsupported');
  const creator = await fetchAddressCreatorInfo(address, host);
  const res = await fetch(`https://${host}/api/v2/smart-contracts/${address}`);
  if (res.status === 404) return { name: null, isVerified: false, source: 'blockscout', ...creator };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return {
    name: json?.name ?? null,
    isVerified: true,
    compilerVersion: json?.compiler_version ?? null,
    language: json?.language ?? null,
    source: 'blockscout',
    creatorAddress: json?.creator_address_hash ?? creator.creatorAddress,
    creationTxHash: json?.creation_tx_hash ?? json?.creation_transaction_hash ?? creator.creationTxHash,
    abi: Array.isArray(json?.abi) ? json.abi : null,
  };
}

const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const EIP1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bb';
const RPC_SCAN_BLOCK_RANGE = 5000;
const RPC_SCAN_MAX_LOOKBACK = 50000;

const ERC20_MINI_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
];

function addressToTopic(addr: string) {
  return '0x' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

async function scanLogsBackward(
  provider: ethers.providers.JsonRpcProvider,
  topics: (string | null)[],
  opts: { maxResults?: number } = {}
): Promise<ethers.providers.Log[]> {
  const maxResults = opts.maxResults ?? 40;
  const head = await provider.getBlockNumber();
  const floor = Math.max(0, head - RPC_SCAN_MAX_LOOKBACK);
  const collected: ethers.providers.Log[] = [];
  let to = head;
  while (to > floor && collected.length < maxResults) {
    const from = Math.max(floor, to - RPC_SCAN_BLOCK_RANGE + 1);
    try {
      const logs = await provider.getLogs({ fromBlock: from, toBlock: to, topics });
      collected.push(...logs);
    } catch {
      break;
    }
    to = from - 1;
  }
  return collected;
}

async function fetchAddressRecentTxsViaRpc(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
): Promise<RecentTx[]> {
  const addrTopic = addressToTopic(address);
  const [outLogs, inLogs] = await Promise.all([
    scanLogsBackward(provider, [ERC20_TRANSFER_TOPIC, addrTopic]),
    scanLogsBackward(provider, [ERC20_TRANSFER_TOPIC, null, addrTopic]),
  ]);

  const seen = new Set<string>();
  const logs = [...outLogs, ...inLogs]
    .filter(l => {
      const key = `${l.transactionHash}-${l.logIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, 12);

  if (logs.length === 0) return [];

  const decimalsCache = new Map<string, number>();
  const getDecimals = async (token: string) => {
    if (decimalsCache.has(token)) return decimalsCache.get(token)!;
    let d = 18;
    try { d = await new ethers.Contract(token, ERC20_MINI_ABI, provider).decimals(); } catch {}
    decimalsCache.set(token, d);
    return d;
  };

  const results = await Promise.all(logs.map(async (log): Promise<RecentTx | null> => {
    try {
      const [tx, block, receipt, decimals] = await Promise.all([
        provider.getTransaction(log.transactionHash),
        provider.getBlock(log.blockNumber),
        provider.getTransactionReceipt(log.transactionHash).catch(() => null),
        getDecimals(log.address),
      ]);
      let amount = '0';
      try { amount = ethers.utils.formatUnits(log.data, decimals); } catch {}
      return {
        hash: log.transactionHash,
        from: '0x' + log.topics[1].slice(-40),
        to: '0x' + log.topics[2].slice(-40),
        value: amount,
        timestamp: block?.timestamp ?? null,
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : (tx ? 'success' : 'pending'),
        methodGuess: 'Transfer (Token)',
        source: 'rpc',
        isTokenTransfer: true,
        tokenAddress: log.address,
      };
    } catch { return null; }
  }));

  return results.filter((r): r is RecentTx => r !== null);
}

async function fetchTokenPortfolioViaRpc(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
): Promise<DetectedToken[]> {
  const addrTopic = addressToTopic(address);
  const logs = await scanLogsBackward(provider, [ERC20_TRANSFER_TOPIC, null, addrTopic], { maxResults: 200 });
  const tokenAddrs = Array.from(new Set(logs.map(l => l.address))).slice(0, 20);
  if (tokenAddrs.length === 0) return [];

  const results = await Promise.all(tokenAddrs.map(async (tokenAddr): Promise<DetectedToken | null> => {
    try {
      const c = new ethers.Contract(tokenAddr, ERC20_MINI_ABI, provider);
      const [balRaw, decimals, symbol] = await Promise.all([
        c.balanceOf(address),
        c.decimals().catch(() => 18),
        c.symbol().catch(() => '???'),
      ]);
      if (balRaw.isZero()) return null;
      const balance = parseFloat(ethers.utils.formatUnits(balRaw, decimals));
      return {
        chain: 'evm', address: tokenAddr, symbol, name: symbol,
        decimals, balance,
        balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
        usdPrice: null, usdValue: null,
      } as DetectedToken;
    } catch { return null; }
  }));

  return results.filter((r: DetectedToken | null): r is DetectedToken => r !== null);
}

async function fetchAddressContractInfoViaRpc(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
  code: string,
): Promise<ContractInfo> {
  const isMinimalProxy = /^0x363d3d373d3d3d363d73[0-9a-fA-F]{40}5af43d82803e903d91602b57fd5bf3$/i.test(code);

  let implAddress: string | null = null;
  try {
    const raw = await provider.getStorageAt(address, EIP1967_IMPL_SLOT);
    const addr = '0x' + raw.slice(-40);
    if (addr !== ethers.constants.AddressZero) implAddress = ethers.utils.getAddress(addr);
  } catch {}

  let standard: string | null = null;
  try {
    await provider.call({ to: address, data: '0x18160ddd' });
    standard = 'ERC-20 (kemungkinan, dari deteksi selector)';
  } catch {}

  if (!standard) {
    try {
      const erc165 = new ethers.Contract(address, ['function supportsInterface(bytes4) view returns (bool)'], provider);
      if (await erc165.supportsInterface('0xd9b67a26')) standard = 'ERC-1155 (kemungkinan, via ERC-165)';
      else if (await erc165.supportsInterface('0x80ac58cd')) standard = 'ERC-721 (kemungkinan, via ERC-165)';
    } catch {}
  }

  return {
    name: null,
    isVerified: false,
    source: 'rpc',
    isProxy: isMinimalProxy || !!implAddress,
    implementation: implAddress,
    standardGuess: standard,
  };
}

const ERC20_META_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
];

async function detectTokenViaRpc(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
): Promise<TokenInfo | null> {
  const c = new ethers.Contract(address, ERC20_META_ABI, provider);
  const [name, symbol, decimalsRaw, totalSupplyRaw] = await Promise.all([
    c.name().catch(() => null),
    c.symbol().catch(() => null),
    c.decimals().catch(() => null),
    c.totalSupply().catch(() => null),
  ]);
  if (name == null && symbol == null) return null;

  const decimals = decimalsRaw != null ? Number(decimalsRaw) : null;

  let standard = 'ERC-20';
  try {
    const erc165 = new ethers.Contract(address, ['function supportsInterface(bytes4) view returns (bool)'], provider);
    if (await erc165.supportsInterface('0xd9b67a26')) standard = 'ERC-1155';
    else if (await erc165.supportsInterface('0x80ac58cd')) standard = 'ERC-721';
  } catch {}

  return {
    address, name, symbol,
    decimals,
    totalSupply: totalSupplyRaw && decimals != null ? ethers.utils.formatUnits(totalSupplyRaw, decimals) : (totalSupplyRaw ? totalSupplyRaw.toString() : null),
    totalSupplyRaw: totalSupplyRaw ? totalSupplyRaw.toString() : null,
    standard, holdersCount: null, iconUrl: null, priceUsd: null, marketCapUsd: null,
    source: 'rpc',
  };
}

async function fetchTokenInfoBlockscout(address: string, host: string): Promise<TokenInfo | null> {
  const res = await fetch(`https://${host}/api/v2/tokens/${address}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (!j || (!j.symbol && !j.name)) return null;
  const decimals = j.decimals != null ? parseInt(j.decimals, 10) : null;
  const priceUsd = j.exchange_rate != null ? parseFloat(j.exchange_rate) : null;
  const totalSupplyFormatted = j.total_supply && decimals != null
    ? ethers.utils.formatUnits(j.total_supply, decimals) : (j.total_supply ?? null);
  return {
    address,
    name: j.name ?? null,
    symbol: j.symbol ?? null,
    decimals,
    totalSupply: totalSupplyFormatted,
    totalSupplyRaw: j.total_supply ?? null,
    standard: j.type ?? 'ERC-20',
    holdersCount: j.holders != null ? parseInt(j.holders, 10) : null,
    iconUrl: j.icon_url ?? null,
    priceUsd,
    marketCapUsd: priceUsd != null && totalSupplyFormatted ? priceUsd * parseFloat(totalSupplyFormatted) : null,
    source: 'blockscout',
  };
}

async function fetchTokenHoldersBlockscout(address: string, host: string, decimals: number | null): Promise<TokenHolder[]> {
  const res = await fetch(`https://${host}/api/v2/tokens/${address}/holders?items_count=10`);
  if (!res.ok) throw new Error(`Gagal mengambil holders (HTTP ${res.status}).`);
  const j = await res.json();
  const items: any[] = Array.isArray(j?.items) ? j.items : [];
  return items.slice(0, 10).map((it): TokenHolder => {
    const raw = it?.value ?? '0';
    let balance = raw;
    try { balance = decimals != null ? ethers.utils.formatUnits(raw, decimals) : raw; } catch {}
    return {
      address: it?.address?.hash ?? it?.address ?? '',
      balance,
      percentage: it?.percentage != null ? parseFloat(it.percentage) : null,
    };
  }).filter(h => h.address);
}

async function fetchTokenTransfersBlockscout(
  address: string, host: string, decimals: number | null, isNft: boolean,
): Promise<TokenTransfer[]> {
  const res = await fetch(`https://${host}/api/v2/tokens/${address}/transfers?items_count=15`);
  if (!res.ok) throw new Error(`Gagal mengambil riwayat transfer (HTTP ${res.status}).`);
  const j = await res.json();
  const items: any[] = Array.isArray(j?.items) ? j.items : [];
  return items.slice(0, 15).map((it): TokenTransfer => {
    const total = it?.total;
    let amount = '';
    if (isNft) {
      amount = total?.token_id != null ? `Token ID #${total.token_id}` : (total?.token_instance?.id != null ? `Token ID #${total.token_instance.id}` : '—');
    } else {
      const raw = total?.value ?? '0';
      try { amount = decimals != null ? ethers.utils.formatUnits(raw, decimals) : String(raw); } catch { amount = String(raw); }
    }
    return {
      hash: it?.tx_hash ?? it?.transaction_hash ?? '',
      from: it?.from?.hash ?? '',
      to: it?.to?.hash ?? '',
      amount,
      timestamp: it?.timestamp ? Math.floor(new Date(it.timestamp).getTime() / 1000) : null,
      isNft,
    };
  }).filter(t => t.hash);
}

async function fetchTokenTransfersViaRpc(
  provider: ethers.providers.JsonRpcProvider,
  tokenAddress: string,
  decimals: number | null,
  isNft: boolean,
): Promise<TokenTransfer[]> {
  const head = await provider.getBlockNumber();
  const floor = Math.max(0, head - RPC_SCAN_MAX_LOOKBACK);
  const collected: ethers.providers.Log[] = [];
  let to = head;
  while (to > floor && collected.length < 15) {
    const from = Math.max(floor, to - RPC_SCAN_BLOCK_RANGE + 1);
    try {
      const logs = await provider.getLogs({ address: tokenAddress, fromBlock: from, toBlock: to, topics: [ERC20_TRANSFER_TOPIC] });
      collected.push(...logs);
    } catch { break; }
    to = from - 1;
  }
  const sorted = collected.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 15);

  const results = await Promise.all(sorted.map(async (log): Promise<TokenTransfer | null> => {
    try {
      const block = await provider.getBlock(log.blockNumber);
      const nft = log.topics.length === 4;
      let amount = '';
      if (nft) amount = `Token ID #${BigInt(log.topics[3]).toString()}`;
      else { try { amount = ethers.utils.formatUnits(log.data, decimals ?? 18); } catch { amount = log.data; } }
      return {
        hash: log.transactionHash,
        from: '0x' + log.topics[1].slice(-40),
        to: '0x' + log.topics[2].slice(-40),
        amount,
        timestamp: block?.timestamp ?? null,
        isNft: nft || isNft,
      };
    } catch { return null; }
  }));

  return results.filter((r): r is TokenTransfer => r !== null);
}

const NATIVE_SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  ETH: 'ethereum', BNB: 'binancecoin', MATIC: 'matic-network', POL: 'matic-network',
  AVAX: 'avalanche-2', RON: 'ronin', FTM: 'fantom', ONE: 'harmony-2',
  CRO: 'crypto-com-chain', GLMR: 'moonbeam', CELO: 'celo', KAVA: 'kava',
  METIS: 'metis-token', MNT: 'mantle', xDAI: 'xdai', GNO: 'gnosis',
  GRAM: 'the-open-network', TON: 'the-open-network',
};

async function fetchNativeTokenPrice(symbol: string): Promise<number | null> {
  const id = NATIVE_SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()];
  if (!id) return null;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[id]?.usd ?? null;
  } catch { return null; }
}

const EXPLORER_REFRESH_STORAGE_KEY = 'explorerAutoRefreshSettings';
const BIP39_WALLETS_STORAGE_KEY = 'bip39Wallets';

interface WalletGenAccount {
  key: string;
  label: string;
  address: string;
  privateKey: string;
}

function loadWalletGenAccounts(): WalletGenAccount[] {
  try {
    const raw = localStorage.getItem(BIP39_WALLETS_STORAGE_KEY);
    if (!raw) return [];
    const wallets: any[] = JSON.parse(raw);
    if (!Array.isArray(wallets)) return [];
    const out: WalletGenAccount[] = [];
    wallets.forEach(w => {
      (w?.addresses || []).forEach((a: any) => {
        if (!a?.address || !a?.privateKey) return;
        out.push({
          key: `${w.id}-${a.index}`,
          label: `[${w.name || 'Wallet'}] ${a.address.slice(0, 8)}…${a.address.slice(-4)} (#${a.index})`,
          address: a.address,
          privateKey: a.privateKey,
        });
      });
    });
    return out;
  } catch { return []; }
}

const COLORS = {
  bg: '#0d0d0d', border: '#1e1e1e', accent: '#01a2ff',
  muted: '#666', text: '#ddd', green: '#4caf50', red: '#f44336', amber: '#ffaa00',
};

// ── Tabel TX Asentum (dipakai di riwayat address, detail block & feed TX) ──
const aseStatusMeta = (st: AsentumTxSummary['status']) =>
  st === 'success' ? { label: 'Sukses', color: '#4caf50' }
  : st === 'failed' ? { label: 'Gagal', color: '#f44336' }
  : st === 'pending' ? { label: 'Pending', color: '#ffaa00' }
  : { label: 'Unknown', color: '#666' };

const AseBadge: React.FC<{ color: string; children: React.ReactNode; title?: string }> = ({ color, children, title }) => (
  <span title={title} style={{
    display: 'inline-block', fontSize: '10px', fontWeight: 'bold', color, border: `1px solid ${color}66`,
    padding: '2px 7px', whiteSpace: 'nowrap', letterSpacing: '0.3px',
  }}>{children}</span>
);

const aseRoleOf = (t: AsentumTxSummary, me: string): 'IN' | 'OUT' | 'SELF' | null => {
  const f = asentumAddrKey(t.from) === me, to = asentumAddrKey(t.to) === me;
  return f && to ? 'SELF' : f ? 'OUT' : to ? 'IN' : null;
};

const AseTxTable: React.FC<{
  txs: AsentumTxSummary[]; symbol: string; viewer?: string | null; emptyText?: string;
  onTx: (hash: string) => void; onAddr: (addr: string) => void; onBlock: (h: number) => void;
}> = ({ txs, symbol, viewer, emptyText, onTx, onAddr, onBlock }) => {
  const me = viewer ? asentumAddrKey(viewer) : null;
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#666', borderBottom: '1px solid #222', whiteSpace: 'nowrap', fontWeight: 'normal' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #181818', fontFamily: 'monospace', whiteSpace: 'nowrap', color: '#ddd' };
  const link: React.CSSProperties = { color: '#836EFD', cursor: 'pointer' };
  if (!txs.length) return <p style={{ color: '#444', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{emptyText ?? 'Tidak ada transaksi.'}</p>;
  const roleColor = { IN: '#4caf50', OUT: '#ffaa00', SELF: '#61dfff' } as const;
  return (
    <div style={{ overflowX: 'auto', maxHeight: '460px', overflowY: 'auto' }}>
      <table style={{ width: '100%', minWidth: me ? 1130 : 1020, borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead style={{ position: 'sticky', top: 0, background: '#0d0d0d' }}>
          <tr>
            <th style={th}>Txn Hash</th><th style={th}>Method</th><th style={th}>Block</th><th style={th}>Age</th>
            <th style={th}>From</th>{me && <th style={th}>Role</th>}<th style={th}>To</th>
            <th style={th}>Value</th><th style={th}>Fee</th><th style={th}>Nonce</th><th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t, i) => {
            const st = aseStatusMeta(t.status);
            const role = me ? aseRoleOf(t, me) : null;
            const ts = t.timestamp != null ? (t.timestamp < 2e10 ? t.timestamp : Math.floor(t.timestamp / 1000)) : null;
            return (
              <tr key={`${t.hash}-${i}`}>
                <td style={td}><span style={link} onClick={() => t.hash && onTx(t.hash)}>{t.hash ? shortHash(t.hash, 8, 6) : '—'}</span></td>
                <td style={td}><AseBadge color={t.kind === 'deploy' ? '#e81899' : t.kind === 'transfer' ? '#01a2ff' : t.kind === 'call' ? '#9c27b0' : '#666'}>{t.method}</AseBadge></td>
                <td style={td}>{t.blockHeight != null ? <span style={link} onClick={() => onBlock(t.blockHeight!)}>#{t.blockHeight.toLocaleString('en-US')}</span> : '—'}</td>
                <td style={{ ...td, color: '#888' }}>{ts != null ? timeAgo(ts) : '—'}</td>
                <td style={td}>{t.from ? <span style={link} title={t.from} onClick={() => onAddr(t.from!)}>{shortHash(t.from, 8, 4)}</span> : '—'}</td>
                {me && <td style={td}>{role ? <AseBadge color={roleColor[role]}>{role}</AseBadge> : '—'}</td>}
                <td style={td}>{t.to ? <span style={link} title={t.to} onClick={() => onAddr(t.to!)}>{shortHash(t.to, 8, 4)}</span> : <span style={{ color: '#666' }}>— (contract baru)</span>}</td>
                <td style={td}>{t.valueAse != null ? `${t.valueAse} ${symbol}` : '—'}</td>
                <td style={{ ...td, color: '#888' }}>{t.feeAse != null ? `${t.feeAse} ${symbol}` : '—'}</td>
                <td style={td}>{t.nonce ?? '—'}</td>
                <td style={td}><AseBadge color={st.color}>{st.label}</AseBadge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface AbiFunctionEntry {
  key: string;
  name: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  stateMutability: string;
  isRead: boolean;
}

function extractAbiFunctions(abi: any[]): AbiFunctionEntry[] {
  if (!Array.isArray(abi)) return [];
  return abi
    .filter(item => item?.type === 'function' && item?.name)
    .map((f: any, idx: number) => {
      const mutability = f.stateMutability || (f.constant ? 'view' : 'nonpayable');
      const inputs = (f.inputs || []).map((i: any, ii: number) => ({ name: i.name || `arg${ii}`, type: i.type }));
      return {
        key: `${f.name}(${inputs.map((i: any) => i.type).join(',')})#${idx}`,
        name: f.name,
        inputs,
        outputs: (f.outputs || []).map((o: any) => ({ name: o.name, type: o.type })),
        stateMutability: mutability,
        isRead: mutability === 'view' || mutability === 'pure',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseAbiArgValue(type: string, raw: string): any {
  const t = raw.trim();
  if (type.endsWith('[]') || type.startsWith('tuple')) {
    return JSON.parse(t);
  }
  if (type === 'bool') return t.toLowerCase() === 'true' || t === '1';
  return t;
}

function formatAbiResult(val: any): string {
  if (val == null) return 'null';
  if (typeof val === 'object' && typeof val.toString === 'function' && val._isBigNumber) return val.toString();
  if (Array.isArray(val)) return JSON.stringify(val.map(v => (v?._isBigNumber ? v.toString() : v)), null, 2);
  if (typeof val === 'object') {
    const plain: Record<string, any> = {};
    Object.keys(val).forEach(k => {
      if (/^\d+$/.test(k)) return;
      plain[k] = val[k]?._isBigNumber ? val[k].toString() : val[k];
    });
    return JSON.stringify(plain, null, 2);
  }
  return String(val);
}

function ContractInteractionPanel({
  address, abi, getProvider, chainId, networkName, explorerUrl, walletGenAccounts,
}: {
  address: string;
  abi: any[];
  getProvider: () => any;
  chainId: number;
  networkName: string;
  explorerUrl: string;
  walletGenAccounts: WalletGenAccount[];
}) {
  const [tab, setTab] = useState<'read' | 'write'>('read');
  const [args, setArgs] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, { loading: boolean; value?: string; error?: string; txHash?: string }>>({});
  const [walletSource, setWalletSource] = useState<'browser' | 'walletgen'>(walletGenAccounts.length > 0 ? 'walletgen' : 'browser');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectedWgKey, setSelectedWgKey] = useState<string>(walletGenAccounts[0]?.key ?? '');
  const [payableValue, setPayableValue] = useState<Record<string, string>>({});

  const fns = useMemo(() => extractAbiFunctions(abi), [abi]);
  const readFns = fns.filter(f => f.isRead);
  const writeFns = fns.filter(f => !f.isRead);
  const selectedWgAccount = walletGenAccounts.find(a => a.key === selectedWgKey) || null;

  const getInjectedProvider = () => (typeof window !== 'undefined' ? (window as any).ethereum : null) || null;

  const connectWallet = async () => {
    const prov = getInjectedProvider();
    if (!prov) { alert('Wallet browser (MetaMask / Rabby / dll) tidak terdeteksi.'); return; }
    setConnecting(true);
    try {
      const accounts: string[] = await prov.request({ method: 'eth_requestAccounts' });
      const hexChain: string = await prov.request({ method: 'eth_chainId' });
      setWalletAddress(accounts[0] ?? null);
      setWalletChainId(parseInt(hexChain, 16));
    } catch (e: any) {
      alert(e?.message || 'Gagal menghubungkan wallet.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => { setWalletAddress(null); setWalletChainId(null); };

  const setArgVal = (fnKey: string, idx: number, val: string) => {
    setArgs(prev => {
      const cur = prev[fnKey] ? [...prev[fnKey]] : [];
      cur[idx] = val;
      return { ...prev, [fnKey]: cur };
    });
  };

  const runRead = async (fn: AbiFunctionEntry) => {
    setResults(prev => ({ ...prev, [fn.key]: { loading: true } }));
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(address, abi, provider);
      const argVals = (args[fn.key] || []).map((v, i) => parseAbiArgValue(fn.inputs[i]?.type || 'string', v || ''));
      const res = await contract[fn.name](...argVals);
      setResults(prev => ({ ...prev, [fn.key]: { loading: false, value: formatAbiResult(res) } }));
    } catch (e: any) {
      setResults(prev => ({ ...prev, [fn.key]: { loading: false, error: friendlyRpcError(e, 'Gagal membaca contract.') } }));
    }
  };

  const runWrite = async (fn: AbiFunctionEntry) => {
    if (walletSource === 'walletgen') {
      if (!selectedWgAccount) { alert('Pilih wallet dari Wallet Generator dulu.'); return; }
      setResults(prev => ({ ...prev, [fn.key]: { loading: true } }));
      try {
        const provider = getProvider();
        const signer = new ethers.Wallet(selectedWgAccount.privateKey, provider);
        const contract = new ethers.Contract(address, abi, signer);
        const argVals = (args[fn.key] || []).map((v, i) => parseAbiArgValue(fn.inputs[i]?.type || 'string', v || ''));
        const overrides: any = {};
        if (fn.stateMutability === 'payable' && payableValue[fn.key]) {
          overrides.value = ethers.utils.parseEther(payableValue[fn.key].trim() || '0');
        }
        const tx = await contract[fn.name](...argVals, overrides);
        setResults(prev => ({ ...prev, [fn.key]: { loading: false, txHash: tx.hash } }));
      } catch (e: any) {
        setResults(prev => ({ ...prev, [fn.key]: { loading: false, error: friendlyRpcError(e, 'Transaksi gagal.') } }));
      }
      return;
    }

    const prov = getInjectedProvider();
    if (!prov || !walletAddress) { alert('Hubungkan wallet browser dulu untuk menulis ke contract.'); return; }
    setResults(prev => ({ ...prev, [fn.key]: { loading: true } }));
    try {
      if (walletChainId !== chainId) {
        try {
          await prov.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] });
          setWalletChainId(chainId);
        } catch {
          throw new Error(`Wallet ada di chain lain — pindahkan manual ke ${networkName} (chainId ${chainId}) dulu.`);
        }
      }
      const web3Provider = new ethers.providers.Web3Provider(prov);
      const signer = web3Provider.getSigner();
      const contract = new ethers.Contract(address, abi, signer);
      const argVals = (args[fn.key] || []).map((v, i) => parseAbiArgValue(fn.inputs[i]?.type || 'string', v || ''));
      const overrides: any = {};
      if (fn.stateMutability === 'payable' && payableValue[fn.key]) {
        overrides.value = ethers.utils.parseEther(payableValue[fn.key].trim() || '0');
      }
      const tx = await contract[fn.name](...argVals, overrides);
      setResults(prev => ({ ...prev, [fn.key]: { loading: false, txHash: tx.hash } }));
    } catch (e: any) {
      setResults(prev => ({ ...prev, [fn.key]: { loading: false, error: friendlyRpcError(e, 'Transaksi gagal.') } }));
    }
  };

  const renderFnCard = (fn: AbiFunctionEntry, isWrite: boolean) => {
    const r = results[fn.key];
    return (
      <div key={fn.key} style={{ background: '#111', border: `1px solid ${COLORS.border}`, padding: '12px 14px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: fn.inputs.length ? '10px' : '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: isWrite ? COLORS.amber : COLORS.accent, fontFamily: 'monospace' }}>
            {fn.name}
            <span style={{ color: COLORS.muted, fontWeight: 'normal' }}>({fn.inputs.map(i => i.type).join(', ')})</span>
          </span>
          <span style={{ fontSize: '9px', color: COLORS.muted, border: `1px solid ${COLORS.border}`, padding: '2px 6px' }}>
            {fn.stateMutability}
          </span>
        </div>
        {fn.inputs.map((inp, i) => (
          <input
            key={i}
            placeholder={`${inp.name} (${inp.type})`}
            value={(args[fn.key] || [])[i] || ''}
            onChange={e => setArgVal(fn.key, i, e.target.value)}
            style={{ width: '100%', marginBottom: '6px', fontSize: '12px' }}
          />
        ))}
        {isWrite && fn.stateMutability === 'payable' && (
          <input
            placeholder={`Value (${networkName === '' ? 'native' : ''} ETH/BNB/dll, opsional)`}
            value={payableValue[fn.key] || ''}
            onChange={e => setPayableValue(p => ({ ...p, [fn.key]: e.target.value }))}
            style={{ width: '100%', marginBottom: '6px', fontSize: '12px', borderLeft: `2px solid ${COLORS.amber}` }}
          />
        )}
        <button
          type="button"
          onClick={() => (isWrite ? runWrite(fn) : runRead(fn))}
          disabled={r?.loading || (isWrite && ((walletSource === 'walletgen' && !selectedWgAccount) || (walletSource === 'browser' && !walletAddress)))}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '7px 12px',
            background: isWrite ? COLORS.amber : COLORS.accent, color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold',
            opacity: (r?.loading || (isWrite && ((walletSource === 'walletgen' && !selectedWgAccount) || (walletSource === 'browser' && !walletAddress)))) ? 0.5 : 1,
          }}
        >
          {r?.loading ? <FaSpinner className="spin-icon" size={11} /> : isWrite ? <FaBolt size={11} /> : <FaPlay size={11} />}
          {isWrite ? 'Write' : 'Query'}
        </button>
        {r?.value != null && (
          <pre style={{
            marginTop: '8px', background: '#000', border: `1px solid ${COLORS.border}`, padding: '8px 10px',
            fontSize: '11px', color: COLORS.green, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>{r.value}</pre>
        )}
        {r?.txHash && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: COLORS.green, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <FaCheckCircle size={11} /> TX terkirim:
            <a href={`${explorerUrl}/tx/${r.txHash}`} target="_blank" rel="noreferrer" style={{ color: COLORS.accent }}>
              {shortHash(r.txHash, 10, 8)}
            </a>
          </div>
        )}
        {r?.error && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: COLORS.red, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <FaExclamationTriangle size={11} style={{ flexShrink: 0, marginTop: '2px' }} /> {r.error}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid #9c27b0`, padding: '18px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9c27b0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaFileCode /> Read / Write Contract
        </h3>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button type="button" onClick={() => setTab('read')} style={{
          flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
          background: tab === 'read' ? COLORS.accent : '#111', color: tab === 'read' ? '#000' : '#888',
          border: `1px solid ${tab === 'read' ? COLORS.accent : COLORS.border}`,
        }}>
          Read Contract ({readFns.length})
        </button>
        <button type="button" onClick={() => setTab('write')} style={{
          flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
          background: tab === 'write' ? COLORS.amber : '#111', color: tab === 'write' ? '#000' : '#888',
          border: `1px solid ${tab === 'write' ? COLORS.amber : COLORS.border}`,
        }}>
          Write Contract ({writeFns.length})
        </button>
      </div>

      {tab === 'write' && (
        <div style={{ background: '#111', border: `1px solid ${COLORS.border}`, padding: '12px 14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => setWalletSource('walletgen')}
              disabled={walletGenAccounts.length === 0}
              style={{
                flex: 1, padding: '7px', fontSize: '10.5px', fontWeight: 'bold', cursor: walletGenAccounts.length === 0 ? 'not-allowed' : 'pointer',
                background: walletSource === 'walletgen' ? COLORS.green : 'transparent', color: walletSource === 'walletgen' ? '#000' : (walletGenAccounts.length === 0 ? '#444' : '#888'),
                border: `1px solid ${walletSource === 'walletgen' ? COLORS.green : COLORS.border}`,
              }}
            >
              Wallet dari Wallet-Gen
            </button>
            <button
              type="button"
              onClick={() => setWalletSource('browser')}
              style={{
                flex: 1, padding: '7px', fontSize: '10.5px', fontWeight: 'bold', cursor: 'pointer',
                background: walletSource === 'browser' ? COLORS.accent : 'transparent', color: walletSource === 'browser' ? '#000' : '#888',
                border: `1px solid ${walletSource === 'browser' ? COLORS.accent : COLORS.border}`,
              }}
            >
              Wallet Browser (MetaMask dll)
            </button>
          </div>

          {walletSource === 'walletgen' ? (
            walletGenAccounts.length === 0 ? (
              <p style={{ color: COLORS.muted, fontSize: '11px', margin: 0 }}>
                Belum ada wallet tersimpan di Wallet Generator. Buat / import wallet di halaman Wallet Generator dulu.
              </p>
            ) : (
              <select
                value={selectedWgKey}
                onChange={e => setSelectedWgKey(e.target.value)}
                style={{ width: '100%', fontSize: '12px' }}
              >
                {walletGenAccounts.map(a => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            )
          ) : (
            walletAddress ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: COLORS.green, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaCheckCircle size={11} /> {shortHash(walletAddress, 8, 6)}
                  {walletChainId !== chainId && <span style={{ color: COLORS.red }}> (chain salah — akan diminta pindah saat kirim TX)</span>}
                </span>
                <button type="button" onClick={disconnectWallet} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '5px 10px',
                  background: 'transparent', color: '#888', border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                }}>
                  <FaUnlink size={10} /> Disconnect
                </button>
              </div>
            ) : (
              <button type="button" onClick={connectWallet} disabled={connecting} style={{
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 12px',
                background: COLORS.accent, color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold',
              }}>
                {connecting ? <FaSpinner className="spin-icon" size={11} /> : <FaPlug size={11} />} Connect Wallet
              </button>
            )
          )}
        </div>
      )}

      {tab === 'read' && (
        readFns.length === 0
          ? <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Tidak ada fungsi read (view/pure) di ABI ini.</p>
          : readFns.map(fn => renderFnCard(fn, false))
      )}
      {tab === 'write' && (
        writeFns.length === 0
          ? <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Tidak ada fungsi write (nonpayable/payable) di ABI ini.</p>
          : writeFns.map(fn => renderFnCard(fn, true))
      )}
    </div>
  );
}

export const Explorer: React.FC = () => {
  const navigate = useNavigate();
  const { type: urlType, value: urlValue } = useParams<{ type?: string; value?: string }>();
  const [searchParams] = useSearchParams();

  const [networks, setNetworks] = useState<RPCNetwork[]>(() => {
    try {
      const s = localStorage.getItem(RPC_NETWORKS_STORAGE_KEY);
      const parsed: RPCNetwork[] = s ? JSON.parse(s) : DEFAULT_NETWORKS;
      return parsed.length > 0 ? parsed : DEFAULT_NETWORKS;
    } catch { return DEFAULT_NETWORKS; }
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== RPC_NETWORKS_STORAGE_KEY) return;
      try {
        const parsed: RPCNetwork[] = e.newValue ? JSON.parse(e.newValue) : DEFAULT_NETWORKS;
        setNetworks(parsed.length > 0 ? parsed : DEFAULT_NETWORKS);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [walletGenAccounts, setWalletGenAccounts] = useState<WalletGenAccount[]>(() => loadWalletGenAccounts());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== BIP39_WALLETS_STORAGE_KEY) return;
      setWalletGenAccounts(loadWalletGenAccounts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const [networkId, setNetworkId] = useState(() => {
    const fromUrl = searchParams.get('network');
    if (fromUrl && networks.some(n => n.id === fromUrl)) return fromUrl;
    return networks[0]?.id ?? DEFAULT_NETWORKS[0].id;
  });
  useEffect(() => {
    const fromUrl = searchParams.get('network');
    if (fromUrl && networks.some(n => n.id === fromUrl) && fromUrl !== networkId) {
      setNetworkId(fromUrl);
    }
  }, [searchParams]);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultType, setResultType] = useState<ResultType>(null);
  const [addressResult, setAddressResult] = useState<AddressResult | null>(null);
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [blockResult, setBlockResult] = useState<BlockResult | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showInputData, setShowInputData] = useState(false);
  const [showRawTx, setShowRawTx] = useState(false);
  const [showRawBlock, setShowRawBlock] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [txRevertReason, setTxRevertReason] = useState<string | null>(null);
  const [txRevertLoading, setTxRevertLoading] = useState(false);
  const [latestBlocks, setLatestBlocks] = useState<LatestBlock[]>([]);
  const [latestLoading, setLatestLoading] = useState(false);
  const [nativePriceUsd, setNativePriceUsd] = useState<number | null>(null);

  interface GasTier { gwei: number; maxFeePerGas?: string; maxPriorityFeePerGas?: string }
  interface GasTiers { isEip1559: boolean; baseFeeGwei: number | null; low: GasTier; standard: GasTier; fast: GasTier }
  const [gasTiers, setGasTiers] = useState<GasTiers | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);

  const [refreshSettings, setRefreshSettings] = useState<{ enabled: boolean; intervalSec: 3 | 4 | 5 }>(() => {
    try {
      const s = localStorage.getItem(EXPLORER_REFRESH_STORAGE_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        const interval = [3, 4, 5].includes(parsed.intervalSec) ? parsed.intervalSec : 4;
        return { enabled: parsed.enabled !== false, intervalSec: interval };
      }
    } catch {}
    return { enabled: true, intervalSec: 4 };
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem(EXPLORER_REFRESH_STORAGE_KEY, JSON.stringify(refreshSettings));
  }, [refreshSettings]);

  const [tokenHoldings,   setTokenHoldings]   = useState<DetectedToken[]>([]);
  const [tokensLoading,   setTokensLoading]   = useState(false);
  const [tokensError,     setTokensError]     = useState<string | null>(null);
  const [tokensSource,    setTokensSource]    = useState<DataSource>(null);
  const [recentTxs,       setRecentTxs]       = useState<RecentTx[]>([]);
  const [recentTxsLoading,setRecentTxsLoading]= useState(false);
  const [recentTxsError,  setRecentTxsError]  = useState<string | null>(null);
  const [recentTxsSource, setRecentTxsSource] = useState<DataSource>(null);
  const [contractInfo,    setContractInfo]    = useState<ContractInfo | null>(null);
  const [contractInfoLoading, setContractInfoLoading] = useState(false);
  const [contractAbi, setContractAbi] = useState<any[] | null>(null);
  const [manualAbiText, setManualAbiText] = useState('');
  const [manualAbiError, setManualAbiError] = useState<string | null>(null);
  const [showManualAbi, setShowManualAbi] = useState(false);

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenInfoLoading, setTokenInfoLoading] = useState(false);
  const [tokenHolders, setTokenHolders] = useState<TokenHolder[]>([]);
  const [tokenHoldersLoading, setTokenHoldersLoading] = useState(false);
  const [tokenHoldersError, setTokenHoldersError] = useState<string | null>(null);
  const [tokenTransfers, setTokenTransfers] = useState<TokenTransfer[]>([]);
  const [tokenTransfersLoading, setTokenTransfersLoading] = useState(false);
  const [tokenTransfersError, setTokenTransfersError] = useState<string | null>(null);
  const [tokenTransfersSource, setTokenTransfersSource] = useState<DataSource>(null);
  const [tokenTab, setTokenTab] = useState<'transfers' | 'holders'>('transfers');

  const [chain, setChain] = useState<'evm' | 'gram' | 'ase'>('evm');
  // Dipakai di useEffect parsing-URL di bawah, supaya baca chain yang lagi
  // aktif TANPA harus masukin `chain` ke deps effect itu (yang bakal bikin
  // effect-nya nge-loop tiap kali chain berubah).
  const chainRef = useRef(chain);
  useEffect(() => { chainRef.current = chain; }, [chain]);
  const [gramNetId, setGramNetId] = useState(() => GRAM_NETWORKS[0].id);
  const gramNetwork = useMemo(
    () => GRAM_NETWORKS.find(n => n.id === gramNetId) ?? GRAM_NETWORKS[0],
    [gramNetId]
  );

  // ── Asentum (ASE) ──────────────────────────────────────────────────────
  const [aseNetId, setAseNetId] = useState(() => ASENTUM_NETWORKS[0].id);
  const aseNetwork = useMemo(
    () => ASENTUM_NETWORKS.find(n => n.id === aseNetId) ?? ASENTUM_NETWORKS[0],
    [aseNetId]
  );
  const [aseQuery, setAseQuery] = useState('');
  const [aseRecent, setAseRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(ASE_RECENT_KEY) || '[]'); } catch { return []; }
  });
  const pushAseRecent = (q: string) => {
    setAseRecent(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 8);
      try { localStorage.setItem(ASE_RECENT_KEY, JSON.stringify(next)); } catch { /* abaikan */ }
      return next;
    });
  };
  const clearAseRecent = () => {
    setAseRecent([]);
    try { localStorage.removeItem(ASE_RECENT_KEY); } catch { /* abaikan */ }
  };
  const [aseLoading, setAseLoading] = useState(false);
  const [aseError, setAseError] = useState<string | null>(null);
  const [aseAddressResult, setAseAddressResult] = useState<{
    addressBech32: string;
    addressHex: string;
    balance: number;
    balanceUsd: number | null;
  } | null>(null);
  const [aseTxNotFound, setAseTxNotFound] = useState<string | null>(null);
  // Detail tx ASE hasil lookup "penuh" (bukan sekadar "belum diindeks" seperti
  // `aseTxNotFound` di atas) — dicoba lebih dulu di `handleAseSearch`, dan
  // hanya jatuh ke `aseTxNotFound` kalau SDK/RPC memang tidak punya datanya.
  const [aseTxDetail, setAseTxDetail] = useState<AsentumTxSummary | null>(null);
  // Detail block ASE — dibuka lewat search angka height, klik block di feed
  // "Block Terbaru", atau klik link "Block #N" dari detail tx. Sama pola
  // seperti blockResult di tab EVM.
  const [aseBlockDetail, setAseBlockDetail] = useState<AsentumBlockSummary | null>(null);
  const [aseBlockNotFound, setAseBlockNotFound] = useState<number | null>(null);
  const [showRawAseBlock, setShowRawAseBlock] = useState(false);
  const [showRawAseTx, setShowRawAseTx] = useState(false);

  // ── ASE: info akun, riwayat TX address (scan block), TX per block, feed TX ──
  const [aseAccount, setAseAccount] = useState<AsentumAccountInfo | null>(null);
  const [aseHist, setAseHist] = useState<AsentumAddressHistory | null>(null);
  const [aseHistLoading, setAseHistLoading] = useState(false);
  const [aseHistError, setAseHistError] = useState<string | null>(null);
  const [aseHistProgress, setAseHistProgress] = useState<{ done: number; total: number } | null>(null);
  const [aseScanDepth, setAseScanDepth] = useState(100);
  const [aseRoleFilter, setAseRoleFilter] = useState<'all' | 'IN' | 'OUT'>('all');
  const aseHistRun = useRef(0);
  const [aseBlockTxs, setAseBlockTxs] = useState<AsentumTxSummary[]>([]);
  const [aseBlockTxsLoading, setAseBlockTxsLoading] = useState(false);
  const [aseRecentTxs, setAseRecentTxs] = useState<AsentumTxSummary[]>([]);
  const [aseRecentTxsLoading, setAseRecentTxsLoading] = useState(false);

  const resetAseResults = () => {
    setAseError(null);
    setAseAddressResult(null);
    setAseTxNotFound(null);
    setAseTxDetail(null);
    setAseBlockDetail(null);
    setAseBlockNotFound(null);
    setShowRawAseBlock(false);
    setShowRawAseTx(false);
    setAseAccount(null);
    setAseHist(null);
    setAseHistError(null);
    setAseBlockTxs([]);
    aseHistRun.current++;
  };

  // Buka detail 1 block by height — dipakai baik dari search angka maupun
  // klik baris di feed "Block Terbaru" / link "Block #N" di detail tx.
  const openAseBlock = useCallback(async (height: number) => {
    resetAseResults();
    setAseLoading(true);
    try {
      setAseBlockDetail(await getAsentumBlockByHeight(aseNetwork, height));
      pushAseRecent(String(height));
      navigate(`/explorer/block/${height}`, { replace: true });
    } catch (e: any) {
      setAseBlockNotFound(height);
      setAseError(aseFriendlyError(e));
    } finally {
      setAseLoading(false);
    }
  }, [aseNetwork, navigate]);

  const handleAseSearch = async (eOrValue?: React.FormEvent | string) => {
    const directValue = typeof eOrValue === 'string' ? eOrValue : undefined;
    if (typeof eOrValue !== 'string') eOrValue?.preventDefault();
    const q = (directValue ?? aseQuery).trim();
    if (!q) return;
    if (directValue !== undefined) setAseQuery(directValue);

    // Angka polos = pencarian block by height (persis pola tab EVM).
    if (/^\d+$/.test(q)) {
      await openAseBlock(parseInt(q, 10));
      return;
    }

    resetAseResults();
    setAseLoading(true);
    try {
      if (isValidAsentumAddress(q) || /^0x[0-9a-fA-F]{40}$/.test(q)) {
        const addressBech32 = q.toLowerCase().startsWith('0x') ? hexToAsentumBech32(q) : q;
        const addressHex = q.toLowerCase().startsWith('0x') ? q : asentumBech32ToHex(q);
        const [balance, nativePrice] = await Promise.all([
          getAsentumBalanceWithFallback(aseNetwork, addressBech32),
          fetchNativeTokenPrice(aseNetwork.symbol).catch(() => null),
        ]);
        setAseAddressResult({
          addressBech32, addressHex, balance,
          balanceUsd: nativePrice != null ? balance * nativePrice : null,
        });
        pushAseRecent(addressBech32);
        navigate(`/explorer/address/${addressBech32}`, { replace: true });
      } else if (/^(0x)?[0-9a-fA-F]{64}$/.test(q)) {
        const hash = q.startsWith('0x') ? q : `0x${q}`;
        // 64-hex bisa jadi hash TX ATAU hash block — dicoba sebagai TX dulu
        // (lebih umum diketik user), baru fallback ke block-by-hash kalau
        // gagal. Kalau dua-duanya gagal (SDK belum support / memang belum
        // ke-mine), baru jatuh ke pesan "belum diindeks" + link ke block
        // explorer resmi seperti sebelumnya.
        try {
          setAseTxDetail(await getAsentumTransactionByHash(aseNetwork, hash));
          pushAseRecent(hash);
          navigate(`/explorer/tx/${hash}`, { replace: true });
        } catch {
          try {
            setAseBlockDetail(await getAsentumBlockByHash(aseNetwork, hash));
            pushAseRecent(hash);
            navigate(`/explorer/block/${hash}`, { replace: true });
          } catch {
            setAseTxNotFound(hash);
          }
        }
      } else {
        setAseError('Format tidak dikenali. Masukkan address Asentum (ase1... atau 0x + 40 hex), TX hash, atau nomor block.');
      }
    } catch (e: any) {
      setAseError(aseFriendlyError(e));
    }
    setAseLoading(false);
  };

  // ── ASE: status chain (auto-refresh), block terbaru, mempool & detail tx ──
  // Pola & nama sama seperti gramMcInfo/gramLatestBlocks/dst (dan latestBlocks
  // di tab EVM), tapi datanya lebih terbatas karena Asentum belum punya
  // indexer historis se-matang TonCenter/RPC EVM (lihat catatan besar di
  // Asentumnet.ts).
  const [aseChainStatus, setAseChainStatus] = useState<AsentumChainStatus | null>(null);
  const [aseChainStatusLoading, setAseChainStatusLoading] = useState(false);
  const [aseChainStatusError, setAseChainStatusError] = useState<string | null>(null);
  const [asePrevHeight, setAsePrevHeight] = useState<number | null>(null);
  const [aseHeightStalledSince, setAseHeightStalledSince] = useState<number | null>(null);

  const loadAseChainStatus = useCallback(async () => {
    setAseChainStatusLoading(true);
    try {
      const status = await getAsentumChainStatus(aseNetwork);
      setAseChainStatus(status);
      setAseChainStatusError(null);
      setAsePrevHeight(prev => {
        if (prev != null && status.height != null && prev === status.height) {
          setAseHeightStalledSince(since => since ?? Date.now());
        } else {
          setAseHeightStalledSince(null);
        }
        return status.height;
      });
    } catch (e: any) {
      setAseChainStatusError(aseFriendlyError(e));
    } finally {
      setAseChainStatusLoading(false);
    }
  }, [aseNetwork]);

  useEffect(() => {
    setAsePrevHeight(null);
    setAseHeightStalledSince(null);
    loadAseChainStatus();
  }, [aseNetId]);

  useEffect(() => {
    if (!refreshSettings.enabled || chain !== 'ase') return;
    const id = setInterval(() => { loadAseChainStatus(); }, refreshSettings.intervalSec * 1000);
    return () => clearInterval(id);
  }, [refreshSettings.enabled, refreshSettings.intervalSec, chain, loadAseChainStatus]);

  // Tab "Block Terbaru" vs "Mempool" — panel-nya sendiri SELALU tampil di tab
  // ASE (gak dibalik toggle lagi), persis seperti panel "Latest Blocks" yang
  // selalu tampil di tab EVM.
  const [aseDetailTab, setAseDetailTab] = useState<'blocks' | 'txs' | 'mempool' | 'validators'>('blocks');

  const [aseLatestBlocks, setAseLatestBlocks] = useState<AsentumBlockSummary[]>([]);
  const [aseLatestBlocksLoading, setAseLatestBlocksLoading] = useState(false);
  const [aseLatestBlocksError, setAseLatestBlocksError] = useState<string | null>(null);

  const loadAseLatestBlocks = useCallback(async () => {
    setAseLatestBlocksLoading(true);
    try {
      setAseLatestBlocks(await getAsentumLatestBlocks(aseNetwork, 10));
      setAseLatestBlocksError(null);
    } catch (e: any) {
      setAseLatestBlocksError(aseFriendlyError(e));
    } finally {
      setAseLatestBlocksLoading(false);
    }
  }, [aseNetwork]);

  const [aseMempool, setAseMempool] = useState<AsentumTxSummary[]>([]);
  const [aseMempoolLoading, setAseMempoolLoading] = useState(false);
  const [aseMempoolError, setAseMempoolError] = useState<string | null>(null);

  // `getAsentumMempool` sekarang SELALU melempar error yang sama — node
  // Asentum tidak punya endpoint buat list isi mempool sama sekali (lihat
  // catatan panjang di Asentumnet.ts), jadi ini bukan kegagalan sementara
  // yang perlu di-retry tiap interval refresh. Cukup panggil & tampilkan
  // pesannya SEKALI (tanpa spinner loading, tanpa network round-trip
  // berulang) — jumlah mempool yang beneran live tetap tampil lewat
  // `aseChainStatus.mempoolSize` di label tab & panel status chain di atas.
  const loadAseMempool = useCallback(async () => {
    try {
      setAseMempool(await getAsentumMempool(aseNetwork, 25));
      setAseMempoolError(null);
    } catch (e: any) {
      setAseMempoolError(aseFriendlyError(e));
    }
  }, [aseNetwork]);

  // Sama seperti loadLatestBlocks di tab EVM: muat begitu network ASE dipilih
  // (baik blocks maupun mempool, biar badge jumlah mempool di tab langsung
  // ada isinya), lalu auto-refresh feed yang lagi aktif dilihat.
  // ── ASE: daftar validator (endpoint REST /validators di node) ──
  const [aseValidators, setAseValidators] = useState<AsentumValidator[]>([]);
  const [aseValidatorsLoading, setAseValidatorsLoading] = useState(false);
  const [aseValidatorsError, setAseValidatorsError] = useState<string | null>(null);

  const loadAseValidators = useCallback(async () => {
    setAseValidatorsLoading(true);
    try {
      setAseValidators(await getAsentumValidators(aseNetwork));
      setAseValidatorsError(null);
    } catch (e: any) {
      setAseValidatorsError(aseFriendlyError(e));
    } finally {
      setAseValidatorsLoading(false);
    }
  }, [aseNetwork]);

  // ── ASE: statistik turunan dari 10 block terakhir (tanpa endpoint baru) ──
  const aseStats = useMemo(() => {
    const bs = aseLatestBlocks
      .map(b => ({ h: b.height, t: aseTs(b.timestamp), tx: b.txCount ?? 0, p: b.proposer }))
      .filter(b => b.t != null) as { h: number; t: number; tx: number; p: string | null }[];
    const totalTx = aseLatestBlocks.reduce((a, b) => a + (b.txCount ?? 0), 0);
    const proposers = new Map<string, number>();
    aseLatestBlocks.forEach(b => { if (b.proposer) proposers.set(b.proposer, (proposers.get(b.proposer) ?? 0) + 1); });
    let avgBlockTime: number | null = null;
    let tps: number | null = null;
    if (bs.length >= 2) {
      const newest = bs.reduce((a, b) => (b.h > a.h ? b : a));
      const oldest = bs.reduce((a, b) => (b.h < a.h ? b : a));
      const dh = newest.h - oldest.h;
      const dt = newest.t - oldest.t;
      if (dh > 0 && dt > 0) {
        avgBlockTime = dt / dh;
        tps = bs.filter(b => b.h !== oldest.h).reduce((a, b) => a + b.tx, 0) / dt;
      }
    }
    return {
      count: aseLatestBlocks.length,
      totalTx,
      avgTxPerBlock: aseLatestBlocks.length ? totalTx / aseLatestBlocks.length : null,
      avgBlockTime, tps,
      proposers: [...proposers.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [aseLatestBlocks]);

  useEffect(() => {
    if (chain !== 'ase') return;
    loadAseLatestBlocks();
    loadAseMempool();
    loadAseValidators();
  }, [chain, aseNetId]);

  const [aseActRange, setAseActRange] = useState<AsentumActivityRange>('24h');
  const [aseActivity, setAseActivity] = useState<AsentumTxActivity | null>(null);
  const [aseActLoading, setAseActLoading] = useState(false);
  const [aseActError, setAseActError] = useState<string | null>(null);
  const [aseActHover, setAseActHover] = useState<number | null>(null);
  const aseActRun = useRef(0);

  const loadAseActivity = useCallback(async (force = false) => {
    const run = ++aseActRun.current;
    setAseActLoading(true);
    setAseActError(null);
    try {
      const res = await getAsentumTxActivity(aseNetwork, aseActRange, { force, shouldCancel: () => aseActRun.current !== run });
      if (aseActRun.current === run) setAseActivity(res);
    } catch (e: any) {
      if (aseActRun.current === run) setAseActError(aseFriendlyError(e));
    } finally {
      if (aseActRun.current === run) setAseActLoading(false);
    }
  }, [aseNetwork, aseActRange]);

  useEffect(() => {
    if (chain !== 'ase') return;
    setAseActHover(null);
    loadAseActivity();
  }, [chain, aseNetId, aseActRange]);

  // Info akun + riwayat TX tiap kali address ASE baru dicari / kedalaman scan diganti.
  useEffect(() => {
    const addr = aseAddressResult?.addressHex;
    if (!addr) return;
    const run = ++aseHistRun.current;
    setAseAccount(null);
    getAsentumAccountInfo(aseNetwork, addr).then(a => { if (aseHistRun.current === run) setAseAccount(a); }).catch(() => {});
    setAseHist(null);
    setAseHistError(null);
    setAseHistLoading(true);
    setAseHistProgress({ done: 0, total: aseScanDepth });
    getAsentumAddressHistory(aseNetwork, addr, {
      depth: aseScanDepth, maxResults: 100,
      onProgress: (done, total) => { if (aseHistRun.current === run) setAseHistProgress({ done, total }); },
      // Tampilkan TX begitu ketemu — tidak perlu nunggu seluruh scan selesai.
      onPartial: part => { if (aseHistRun.current === run) setAseHist(part); },
      shouldCancel: () => aseHistRun.current !== run,
    }).then(h => { if (aseHistRun.current === run) setAseHist(h); })
      .catch(e => { if (aseHistRun.current === run) setAseHistError(aseFriendlyError(e)); })
      .finally(() => { if (aseHistRun.current === run) { setAseHistLoading(false); setAseHistProgress(null); } });
  }, [aseAddressResult?.addressHex, aseScanDepth, aseNetId]);

  // Daftar TX lengkap untuk block yang sedang dibuka.
  useEffect(() => {
    if (!aseBlockDetail) { setAseBlockTxs([]); return; }
    let cancelled = false;
    setAseBlockTxs([]);
    setAseBlockTxsLoading(true);
    getAsentumBlockTxs(aseNetwork, aseBlockDetail, 100)
      .then(t => { if (!cancelled) setAseBlockTxs(t); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAseBlockTxsLoading(false); });
    return () => { cancelled = true; };
  }, [aseBlockDetail?.height, aseBlockDetail?.hash, aseNetId]);

  // Feed "Transaksi Terbaru": diturunkan dari block terbaru yang berisi TX.
  useEffect(() => {
    if (chain !== 'ase' || aseDetailTab !== 'txs') return;
    const withTx = aseLatestBlocks.filter(b => b.txHashes.length > 0 || (b.txCount ?? 0) > 0).slice(0, 10);
    if (!withTx.length) { setAseRecentTxs([]); return; }
    let cancelled = false;
    setAseRecentTxsLoading(true);
    Promise.all(withTx.map(b => getAsentumBlockTxs(aseNetwork, b, 20).catch(() => [] as AsentumTxSummary[])))
      .then(all => { if (!cancelled) setAseRecentTxs(all.flat().slice(0, 40)); })
      .finally(() => { if (!cancelled) setAseRecentTxsLoading(false); });
    return () => { cancelled = true; };
  }, [chain, aseDetailTab, aseLatestBlocks, aseNetId]);

  useEffect(() => {
    if (!refreshSettings.enabled || chain !== 'ase') return;
    const id = setInterval(() => {
      // Mempool sengaja TIDAK di-refresh di sini — daftar TX pending memang
      // tidak tersedia (permanen, bukan gangguan sementara), jadi tidak ada
      // gunanya dipanggil ulang tiap tick. "Block Terbaru" tetap live.
      if (aseDetailTab === 'blocks' || aseDetailTab === 'txs') loadAseLatestBlocks();
      if (aseDetailTab === 'validators') loadAseValidators();
    }, refreshSettings.intervalSec * 1000);
    return () => clearInterval(id);
  }, [refreshSettings.enabled, refreshSettings.intervalSec, chain, aseDetailTab, aseNetId, loadAseLatestBlocks]);

  const [gramQuery, setGramQuery] = useState('');
  const [gramLoading, setGramLoading] = useState(false);
  const [gramError, setGramError] = useState<string | null>(null);
  const [gramAddressResult, setGramAddressResult] = useState<{
    address: string;
    status: string;
    balance: number;
    balanceUsd: number | null;
    activationNote: string | null;
    walletVersionGuess: string;
    seqno: number | null;
    codeHash: string | null;
    dataHash: string | null;
    lastTxHash: string | null;
    lastTxLt: string | null;
    blockSeqno: number | null;
  } | null>(null);
  const [gramTxs, setGramTxs] = useState<GramTxHistoryEntry[]>([]);
  const [gramTxsLoading, setGramTxsLoading] = useState(false);
  const [gramTxsError, setGramTxsError] = useState<string | null>(null);
  const [gramTxNextBeforeLt, setGramTxNextBeforeLt] = useState<string | null>(null);
  const [gramTxLoadingMore, setGramTxLoadingMore] = useState(false);
  const [gramTokens, setGramTokens] = useState<DetectedToken[]>([]);
  const [gramTokensLoading, setGramTokensLoading] = useState(false);
  const [gramTokensError, setGramTokensError] = useState<string | null>(null);
  const [gramJettonInfo, setGramJettonInfo] = useState<GramJettonInfo | null>(null);
  const [gramJettonInfoLoading, setGramJettonInfoLoading] = useState(false);
  const [gramJettonHolders, setGramJettonHolders] = useState<GramJettonHolder[]>([]);
  const [gramJettonHoldersLoading, setGramJettonHoldersLoading] = useState(false);
  const [gramJettonHoldersError, setGramJettonHoldersError] = useState<string | null>(null);
  const [gramTxDetail, setGramTxDetail] = useState<GramTxDetail | null>(null);
  const [gramTxNotFound, setGramTxNotFound] = useState<string | null>(null);
  const [showGramTxRaw, setShowGramTxRaw] = useState(false);

  const [gramMcInfo, setGramMcInfo] = useState<GramMasterchainInfo | null>(null);
  const [gramMcLoading, setGramMcLoading] = useState(false);

  const loadGramMcInfo = useCallback(async () => {
    setGramMcLoading(true);
    try {
      setGramMcInfo(await runTonCenterRequest(() => getGramMasterchainInfo(gramNetwork)));
    } catch {
      setGramMcInfo(null);
    } finally {
      setGramMcLoading(false);
    }
  }, [gramNetwork]);

  useEffect(() => {
    loadGramMcInfo();
  }, [gramNetId]);

  useEffect(() => {
    if (!refreshSettings.enabled || chain !== 'gram') return;
    const id = setInterval(() => { loadGramMcInfo(); }, refreshSettings.intervalSec * 1000);
    return () => clearInterval(id);
  }, [refreshSettings.enabled, refreshSettings.intervalSec, chain, loadGramMcInfo]);

  const [gramMcDetailOpen, setGramMcDetailOpen] = useState(false);
  const [gramMcDetailTab, setGramMcDetailTab] = useState<'blocks' | 'txs' | 'accounts'>('blocks');
  const [gramTxTypeFilter, setGramTxTypeFilter] = useState<string | null>(null);
  const [gramAccountTypeFilter, setGramAccountTypeFilter] = useState<string | null>(null);

  const [gramLatestBlocks, setGramLatestBlocks] = useState<GramLatestBlock[]>([]);
  const [gramLatestBlocksLoading, setGramLatestBlocksLoading] = useState(false);
  const [gramLatestBlocksError, setGramLatestBlocksError] = useState<string | null>(null);

  const loadGramLatestBlocks = useCallback(async () => {
    setGramLatestBlocksLoading(true);
    try {
      setGramLatestBlocks(await runTonCenterRequest(() => fetchGramLatestBlocks(gramNetwork, 10)));
      setGramLatestBlocksError(null);
    } catch (e: any) {
      setGramLatestBlocksError(gramFriendlyError(e));
    } finally {
      setGramLatestBlocksLoading(false);
    }
  }, [gramNetwork]);

  const [gramLatestTxs, setGramLatestTxs] = useState<GramLatestTx[]>([]);
  const [gramLatestTxsLoading, setGramLatestTxsLoading] = useState(false);
  const [gramLatestTxsError, setGramLatestTxsError] = useState<string | null>(null);

  const loadGramLatestTxs = useCallback(async () => {
    setGramLatestTxsLoading(true);
    try {
      setGramLatestTxs(await runTonCenterRequest(() => fetchGramLatestTransactions(gramNetwork, 10)));
      setGramLatestTxsError(null);
    } catch (e: any) {
      setGramLatestTxsError(gramFriendlyError(e));
    } finally {
      setGramLatestTxsLoading(false);
    }
  }, [gramNetwork]);

  const [gramLatestAccounts, setGramLatestAccounts] = useState<GramLatestAccount[]>([]);
  const [gramLatestAccountsLoading, setGramLatestAccountsLoading] = useState(false);
  const [gramLatestAccountsError, setGramLatestAccountsError] = useState<string | null>(null);

  const loadGramLatestAccounts = useCallback(async () => {
    setGramLatestAccountsLoading(true);
    try {
      setGramLatestAccounts(await runTonCenterRequest(() => fetchGramLatestAccounts(gramNetwork, 10)));
      setGramLatestAccountsError(null);
    } catch (e: any) {
      setGramLatestAccountsError(gramFriendlyError(e));
    } finally {
      setGramLatestAccountsLoading(false);
    }
  }, [gramNetwork]);

  useEffect(() => {
    if (!gramMcDetailOpen || chain !== 'gram') return;
    loadGramLatestBlocks();
    loadGramLatestTxs();
    loadGramLatestAccounts();
    if (!refreshSettings.enabled) return;
    const id = setInterval(() => {
      loadGramLatestBlocks();
      loadGramLatestTxs();
      loadGramLatestAccounts();
    }, refreshSettings.intervalSec * 1000);
    return () => clearInterval(id);
  }, [gramMcDetailOpen, chain, gramNetId, refreshSettings.enabled, refreshSettings.intervalSec]);

  const gramTxTypeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of gramLatestTxs) m.set(t.txType, (m.get(t.txType) ?? 0) + 1);
    return m;
  }, [gramLatestTxs]);
  const gramFilteredTxs = useMemo(
    () => gramTxTypeFilter ? gramLatestTxs.filter(t => t.txType === gramTxTypeFilter) : gramLatestTxs,
    [gramLatestTxs, gramTxTypeFilter]
  );
  const gramAccountTypeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of gramLatestAccounts) m.set(a.accountType, (m.get(a.accountType) ?? 0) + 1);
    return m;
  }, [gramLatestAccounts]);
  const gramFilteredAccounts = useMemo(
    () => gramAccountTypeFilter ? gramLatestAccounts.filter(a => a.accountType === gramAccountTypeFilter) : gramLatestAccounts,
    [gramLatestAccounts, gramAccountTypeFilter]
  );

  const gramNetworkStats = useMemo(() => {
    let tps: number | null = null;
    if (gramLatestTxs.length >= 2) {
      const stamps = gramLatestTxs.map(t => t.timestamp).filter(Boolean).sort((a, b) => a - b);
      const span = stamps[stamps.length - 1] - stamps[0];
      tps = span > 0 ? gramLatestTxs.length / span : null;
    }

    let avgBlockTimeSec: number | null = null;
    if (gramLatestBlocks.length >= 2) {
      const stamps = gramLatestBlocks.map(b => b.timestamp).filter(Boolean).sort((a, b) => a - b);
      const diffs: number[] = [];
      for (let i = 1; i < stamps.length; i++) diffs.push(stamps[i] - stamps[i - 1]);
      avgBlockTimeSec = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
    }

    return {
      tps,
      avgBlockTimeSec,
      txBatchCount: gramLatestTxs.length,
      blockBatchCount: gramLatestBlocks.length,
      uniqueAccountsBatch: gramLatestAccounts.length,
    };
  }, [gramLatestTxs, gramLatestBlocks, gramLatestAccounts]);

  const GRAM_TOP_JETTONS_REFRESH_MS = 60_000;
  const [gramTopJettons, setGramTopJettons] = useState<GramTopJetton[]>([]);
  const [gramTopJettonsLoading, setGramTopJettonsLoading] = useState(false);
  const [gramTopJettonsError, setGramTopJettonsError] = useState<string | null>(null);

  const loadGramTopJettons = useCallback(async () => {
    setGramTopJettonsLoading(true);
    try {
      setGramTopJettons(await fetchGramTopJettons());
      setGramTopJettonsError(null);
    } catch (e: any) {
      setGramTopJettonsError(e?.message || 'Gagal ambil daftar Top Jetton dari GeckoTerminal.');
    } finally {
      setGramTopJettonsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (chain !== 'gram' || isGramTestnet(gramNetwork)) return;
    loadGramTopJettons();
    const id = setInterval(loadGramTopJettons, GRAM_TOP_JETTONS_REFRESH_MS);
    return () => clearInterval(id);
  }, [chain, gramNetId, loadGramTopJettons]);

  type GramJettonTab = 'trending' | 'gainers' | 'losers' | 'volume' | 'new';
  const [gramJettonTab, setGramJettonTab] = useState<GramJettonTab>('trending');
  const [gramJettonShowAll, setGramJettonShowAll] = useState(false);
  const sortedGramTopJettons = useMemo(() => {
    const list = [...gramTopJettons];
    switch (gramJettonTab) {
      case 'gainers':
        return list.sort((a, b) => (b.priceChangePct24h ?? -Infinity) - (a.priceChangePct24h ?? -Infinity));
      case 'losers':
        return list.sort((a, b) => (a.priceChangePct24h ?? Infinity) - (b.priceChangePct24h ?? Infinity));
      case 'volume':
        return list.sort((a, b) => (b.volumeUsd24h ?? -Infinity) - (a.volumeUsd24h ?? -Infinity));
      default:
        return list;
    }
  }, [gramTopJettons, gramJettonTab]);
  useEffect(() => { setGramJettonShowAll(false); }, [gramJettonTab]);

  const [gramNewPools, setGramNewPools] = useState<GramTopJetton[]>([]);
  const [gramNewPoolsLoading, setGramNewPoolsLoading] = useState(false);
  const [gramNewPoolsError, setGramNewPoolsError] = useState<string | null>(null);

  const loadGramNewPools = useCallback(async () => {
    setGramNewPoolsLoading(true);
    try {
      setGramNewPools(await fetchGramNewJettonPools());
      setGramNewPoolsError(null);
    } catch (e: any) {
      setGramNewPoolsError(e?.message || 'Gagal ambil daftar Jetton Baru dari GeckoTerminal.');
    } finally {
      setGramNewPoolsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (chain !== 'gram' || isGramTestnet(gramNetwork)) return;
    loadGramNewPools();
    const id = setInterval(loadGramNewPools, GRAM_TOP_JETTONS_REFRESH_MS);
    return () => clearInterval(id);
  }, [chain, gramNetId, loadGramNewPools]);

  const gramJettonPanelList = gramJettonTab === 'new' ? gramNewPools : sortedGramTopJettons;
  const gramJettonPanelVisible = gramJettonShowAll ? gramJettonPanelList : gramJettonPanelList.slice(0, 5);
  const gramJettonPanelLoading = gramJettonTab === 'new' ? gramNewPoolsLoading : gramTopJettonsLoading;
  const gramJettonPanelError = gramJettonTab === 'new' ? gramNewPoolsError : gramTopJettonsError;

  const [gramTonTicker, setGramTonTicker] = useState<GramTonTicker | null>(null);
  const [gramTonTickerLoading, setGramTonTickerLoading] = useState(false);

  const loadGramTonTicker = useCallback(async () => {
    setGramTonTickerLoading(true);
    try {
      setGramTonTicker(await fetchGramTonTicker());
    } catch {
    } finally {
      setGramTonTickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (chain !== 'gram') return;
    loadGramTonTicker();
    const id = setInterval(loadGramTonTicker, GRAM_TOP_JETTONS_REFRESH_MS);
    return () => clearInterval(id);
  }, [chain, loadGramTonTicker]);

  const gramResultsAnchorRef = useRef<HTMLDivElement>(null);
  const scrollToGramResults = useCallback(() => {
    gramResultsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const resetGramResults = () => {
    setGramError(null);
    setGramAddressResult(null);
    setGramTxs([]);
    setGramTxsError(null);
    setGramTxNextBeforeLt(null);
    setGramTokens([]);
    setGramTokensError(null);
    setGramJettonInfo(null);
    setGramJettonInfoLoading(false);
    setGramJettonHolders([]);
    setGramJettonHoldersLoading(false);
    setGramJettonHoldersError(null);
    setGramTxDetail(null);
    setGramTxNotFound(null);
    setShowGramTxRaw(false);
  };

  const handleGramSearch = async (eOrValue?: React.FormEvent | string) => {
    const directValue = typeof eOrValue === 'string' ? eOrValue : undefined;
    if (typeof eOrValue !== 'string') eOrValue?.preventDefault();
    const q = (directValue ?? gramQuery).trim();
    if (!q) return;
    if (directValue !== undefined) setGramQuery(directValue);
    resetGramResults();
    setGramLoading(true);
    try {
      if (isValidGramAddress(q)) {
        const [state, balance, nativePrice] = await Promise.all([
          runTonCenterRequest(() => getGramAccountState(gramNetwork, q)),
          runTonCenterRequest(() => getGramBalanceWithFallback(gramNetwork, q)).catch(() => 0),
          fetchNativeTokenPrice('GRAM').catch(() => null),
        ]);
        setGramAddressResult({
          address: q, status: state.status, balance,
          balanceUsd: nativePrice != null ? balance * nativePrice : null,
          activationNote: gramActivationNote(state),
          walletVersionGuess: state.walletVersionGuess, seqno: state.seqno,
          codeHash: state.codeHash, dataHash: state.dataHash,
          lastTxHash: state.lastTxHash, lastTxLt: state.lastTxLt, blockSeqno: state.blockSeqno,
        });
        navigate(`/explorer/address/${q}`, { replace: true });

        setGramTxsLoading(true);
        runTonCenterRequest(() => fetchGramTxHistory(gramNetwork, q, { limit: 15 }))
          .then(page => { setGramTxs(page.items); setGramTxNextBeforeLt(page.nextBeforeLt); })
          .catch((e: any) => setGramTxsError(gramFriendlyError(e)))
          .finally(() => setGramTxsLoading(false));

        setGramTokensLoading(true);
        runTonCenterRequest(() => fetchGramTokenPortfolio(q, gramNetwork))
          .then(setGramTokens)
          .catch((e: any) => setGramTokensError(e?.message || 'Gagal ambil data Jetton.'))
          .finally(() => setGramTokensLoading(false));

        setGramJettonInfoLoading(true);
        fetchGramJettonInfo(q, gramNetwork)
          .then(info => {
            setGramJettonInfo(info);
            setGramJettonInfoLoading(false);
            if (info) {
              setGramJettonHoldersLoading(true);
              fetchGramJettonHolders(info.address, gramNetwork, info.decimals, info.totalSupplyRaw)
                .then(setGramJettonHolders)
                .catch((e: any) => setGramJettonHoldersError(e?.message || 'Gagal ambil daftar holder Jetton.'))
                .finally(() => setGramJettonHoldersLoading(false));
            }
          })
          .catch(() => { setGramJettonInfo(null); setGramJettonInfoLoading(false); });
      } else if (/^[0-9a-fA-F]{64}$/.test(q)) {
        const detail = await runTonCenterRequest(() => fetchGramTxByHash(gramNetwork, q));
        if (detail) { setGramTxDetail(detail); navigate(`/explorer/tx/${q}`, { replace: true }); }
        else setGramTxNotFound(q);
      } else {
        setGramError('Format tidak dikenali. Masukkan address Gram (UQ.../EQ...) atau tx hash (64 hex char).');
      }
    } catch (e: any) {
      setGramError(gramFriendlyError(e));
    }
    setGramLoading(false);
  };

  const handleGramResultClick = (addressOrTxHash: string) => {
    handleGramSearch(addressOrTxHash);
    scrollToGramResults();
  };

  const loadMoreGramTxs = async () => {
    if (!gramAddressResult || !gramTxNextBeforeLt) return;
    setGramTxLoadingMore(true);
    try {
      const page = await runTonCenterRequest(() => fetchGramTxHistory(gramNetwork, gramAddressResult.address, { limit: 15, beforeLt: gramTxNextBeforeLt }));
      setGramTxs(prev => [...prev, ...page.items]);
      setGramTxNextBeforeLt(page.nextBeforeLt);
    } catch (e: any) {
      setGramTxsError(gramFriendlyError(e));
    }
    setGramTxLoadingMore(false);
  };

  const network = useMemo(
    () => networks.find(n => n.id === networkId) ?? networks[0] ?? DEFAULT_NETWORKS[0],
    [networks, networkId]
  );
  const rpcUrl = network.rpcUrls[0];

  // Provider di-cache 1 instance per rpcUrl+chainId (bukan dibikin baru tiap panggilan)
  // dan chainId-nya dikasih tau di depan (network statis), supaya ethers gak perlu
  // auto-detect network lewat eth_chainId tiap kali. Auto-detect inilah yang sering
  // gagal / kena rate-limit di RPC publik dan muncul sebagai error
  // "could not detect network" (event="noNetwork", code=NETWORK_ERROR) — apalagi kalau
  // banyak request paralel (balance, gas tracker, latest blocks, dll) tiap-tiap bikin
  // provider baru sendiri-sendiri.
  const provider = useMemo(
    () => new ethers.providers.JsonRpcProvider(rpcUrl, { chainId: network.chainId, name: network.name || 'unknown' }),
    [rpcUrl, network.chainId, network.name]
  );

  const getProvider = useCallback(() => provider, [provider]);

  const loadLatestBlocks = useCallback(async () => {
    setLatestLoading(true);
    try {
      const provider = getProvider();
      const head = await provider.getBlockNumber();
      const nums = Array.from({ length: 6 }, (_, i) => head - i).filter(n => n >= 0);
      const blocks = await Promise.all(nums.map(n => provider.getBlock(n)));
      setLatestBlocks(
        blocks
          .filter(Boolean)
          .map(b => ({ number: b!.number, timestamp: b!.timestamp, txCount: b!.transactions.length, miner: b!.miner }))
      );
    } catch {
      setLatestBlocks([]);
    } finally {
      setLatestLoading(false);
    }
  }, [getProvider]);

  useEffect(() => {
    loadLatestBlocks();
  }, [networkId]);

  useEffect(() => {
    if (!refreshSettings.enabled) return;
    const id = setInterval(() => { loadLatestBlocks(); }, refreshSettings.intervalSec * 1000);
    return () => clearInterval(id);
  }, [refreshSettings.enabled, refreshSettings.intervalSec, loadLatestBlocks]);

  const FEE_HISTORY_BLOCK_COUNT = 20;
  const TIER_PERCENTILES = [25, 50, 90] as const;

  function percentile(sorted: ethers.BigNumber[], p: number): ethers.BigNumber {
    if (sorted.length === 0) return ethers.constants.Zero;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
  }

  const loadGasFees = useCallback(async () => {
    setGasLoading(true);
    try {
      const provider = getProvider();

      // 1) Coba eth_feeHistory dulu — data priority fee asli dari block-block terakhir.
      try {
        const feeHistory = await provider.send('eth_feeHistory', [
          ethers.utils.hexValue(FEE_HISTORY_BLOCK_COUNT),
          'latest',
          TIER_PERCENTILES,
        ]);
        const rewardRows: string[][] = Array.isArray(feeHistory?.reward) ? feeHistory.reward : [];
        const baseFees: string[] = Array.isArray(feeHistory?.baseFeePerGas) ? feeHistory.baseFeePerGas : [];
        if (rewardRows.length === 0) throw new Error('feeHistory kosong / tidak didukung RPC ini.');

        const avgAt = (col: number): ethers.BigNumber => {
          const vals = rewardRows.map(r => ethers.BigNumber.from(r[col] ?? '0x0'));
          const sum = vals.reduce((acc, v) => acc.add(v), ethers.constants.Zero);
          return vals.length > 0 ? sum.div(vals.length) : ethers.constants.Zero;
        };
        const tipLow = avgAt(0);
        const tipStandard = avgAt(1);
        const tipFast = avgAt(2);

        // Elemen terakhir baseFeePerGas dari feeHistory = proyeksi base fee block berikutnya.
        const nextBaseFee = baseFees.length > 0 ? ethers.BigNumber.from(baseFees[baseFees.length - 1]) : ethers.constants.Zero;
        const isEip1559 = nextBaseFee.gt(0);

        if (isEip1559) {
          const buildTier = (tip: ethers.BigNumber): GasTier => {
            const maxFeeWei = nextBaseFee.add(tip);
            return {
              gwei: parseFloat(ethers.utils.formatUnits(maxFeeWei, 'gwei')),
              maxFeePerGas: maxFeeWei.toString(),
              maxPriorityFeePerGas: tip.toString(),
            };
          };
          setGasTiers({
            isEip1559: true,
            baseFeeGwei: parseFloat(ethers.utils.formatUnits(nextBaseFee, 'gwei')),
            low: buildTier(tipLow),
            standard: buildTier(tipStandard),
            fast: buildTier(tipFast),
          });
        } else {
          // Network non-1559: "reward" dari feeHistory itu gasPrice efektif yg beneran
          // dibayar tx-tx di block tsb, jadi langsung dipakai sebagai tier gas price.
          setGasTiers({
            isEip1559: false,
            baseFeeGwei: null,
            low: { gwei: parseFloat(ethers.utils.formatUnits(tipLow, 'gwei')) },
            standard: { gwei: parseFloat(ethers.utils.formatUnits(tipStandard, 'gwei')) },
            fast: { gwei: parseFloat(ethers.utils.formatUnits(tipFast, 'gwei')) },
          });
        }
        setGasError(null);
        return;
      } catch {
        // lanjut ke fallback di bawah kalau eth_feeHistory gak didukung RPC ini
      }

      // 2) Fallback: sampling gasPrice ASLI dari transaksi 3 block terakhir.
      const head = await provider.getBlockNumber();
      const blockNums = [head, head - 1, head - 2].filter(n => n >= 0);
      const blocks = await Promise.all(blockNums.map(n => provider.getBlockWithTransactions(n).catch(() => null)));
      const gasPrices: ethers.BigNumber[] = [];
      blocks.forEach(b => {
        if (!b) return;
        b.transactions.forEach(tx => { if (tx.gasPrice) gasPrices.push(tx.gasPrice); });
      });
      gasPrices.sort((a, b) => (a.lt(b) ? -1 : a.gt(b) ? 1 : 0));

      if (gasPrices.length > 0) {
        setGasTiers({
          isEip1559: false,
          baseFeeGwei: null,
          low: { gwei: parseFloat(ethers.utils.formatUnits(percentile(gasPrices, 25), 'gwei')) },
          standard: { gwei: parseFloat(ethers.utils.formatUnits(percentile(gasPrices, 50), 'gwei')) },
          fast: { gwei: parseFloat(ethers.utils.formatUnits(percentile(gasPrices, 90), 'gwei')) },
        });
        setGasError(null);
        return;
      }

      // 3) Fallback terakhir: block-block terakhir gak ada transaksi sama sekali,
      // pakai saran gasPrice polos dari node (masih data RPC asli, cuma gak ada spread tier).
      const gasPrice = await provider.getGasPrice();
      const gweiNum = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      setGasTiers({
        isEip1559: false,
        baseFeeGwei: null,
        low: { gwei: gweiNum },
        standard: { gwei: gweiNum },
        fast: { gwei: gweiNum },
      });
      setGasError(null);
    } catch (e: any) {
      setGasTiers(null);
      setGasError(friendlyRpcError(e, 'Gagal mengambil data gas fee dari RPC.'));
    } finally {
      setGasLoading(false);
    }
  }, [getProvider]);

  useEffect(() => {
    loadGasFees();
  }, [networkId]);

  useEffect(() => {
    if (!refreshSettings.enabled) return;
    const id = setInterval(() => { loadGasFees(); }, refreshSettings.intervalSec * 1000);
    return () => clearInterval(id);
  }, [refreshSettings.enabled, refreshSettings.intervalSec, loadGasFees]);

  // Native token price dipakai buat estimasi biaya gas dalam USD (gas tracker) &
  // buat nilai USD saldo address di hasil pencarian.
  useEffect(() => {
    let cancelled = false;
    fetchNativeTokenPrice(network.symbol).then(price => {
      if (!cancelled) setNativePriceUsd(price);
    });
    return () => { cancelled = true; };
  }, [network.symbol]);

  const resetResults = () => {
    setError(null);
    setResultType(null);
    setAddressResult(null);
    setTxResult(null);
    setBlockResult(null);
    setShowCode(false);
    setShowInputData(false);
    setShowRawTx(false);
    setShowRawBlock(false);
    setExpandedLogs({});
    setTxRevertReason(null); setTxRevertLoading(false);
    setTokenHoldings([]); setTokensLoading(false); setTokensError(null); setTokensSource(null);
    setRecentTxs([]); setRecentTxsLoading(false); setRecentTxsError(null); setRecentTxsSource(null);
    setContractInfo(null); setContractInfoLoading(false);
    setContractAbi(null); setManualAbiText(''); setManualAbiError(null); setShowManualAbi(false);
    setTokenInfo(null); setTokenInfoLoading(false);
    setTokenHolders([]); setTokenHoldersLoading(false); setTokenHoldersError(null);
    setTokenTransfers([]); setTokenTransfersLoading(false); setTokenTransfersError(null); setTokenTransfersSource(null);
    setTokenTab('transfers');
  };

  const loadAddressExtras = useCallback(async (addr: string, netId: string, isContract: boolean, code: string) => {
    const provider = getProvider();
    const hasBlockscout = !!BLOCKSCOUT_HOSTS[netId];

    setTokensLoading(true); setTokensError(null); setTokenHoldings([]); setTokensSource(null);
    (async () => {
      try {
        const tokens = hasBlockscout ? await fetchEvmTokenPortfolio(addr, netId) : await fetchTokenPortfolioViaRpc(provider, addr);
        tokens.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));
        setTokenHoldings(tokens);
        setTokensSource(hasBlockscout ? 'blockscout' : 'rpc');
      } catch {
        try {
          const tokens = await fetchTokenPortfolioViaRpc(provider, addr);
          tokens.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));
          setTokenHoldings(tokens);
          setTokensSource('rpc');
        } catch (e: any) {
          setTokensError(friendlyRpcError(e, 'Gagal mengambil token holdings dari Blockscout maupun RPC.'));
        }
      } finally {
        setTokensLoading(false);
      }
    })();

    setRecentTxsLoading(true); setRecentTxsError(null); setRecentTxs([]); setRecentTxsSource(null);
    (async () => {
      try {
        const txs = hasBlockscout ? await fetchAddressRecentTxs(addr, netId) : await fetchAddressRecentTxsViaRpc(provider, addr);
        setRecentTxs(txs);
        setRecentTxsSource(hasBlockscout ? 'blockscout' : 'rpc');
      } catch {
        try {
          const txs = await fetchAddressRecentTxsViaRpc(provider, addr);
          setRecentTxs(txs);
          setRecentTxsSource('rpc');
        } catch (e: any) {
          setRecentTxsError(friendlyRpcError(e, 'Gagal mengambil riwayat transaksi dari Blockscout maupun RPC.'));
        }
      } finally {
        setRecentTxsLoading(false);
      }
    })();

    if (isContract) {
      setContractInfoLoading(true); setContractInfo(null);
      (async () => {
        try {
          const info = hasBlockscout ? await fetchAddressContractInfo(addr, netId) : await fetchAddressContractInfoViaRpc(provider, addr, code);
          setContractInfo(info);
          if (info.abi) setContractAbi(info.abi);
        } catch {
          try {
            const fallback = await fetchAddressContractInfoViaRpc(provider, addr, code);
            setContractInfo(fallback);
            if (fallback.abi) setContractAbi(fallback.abi);
          } catch {
            setContractInfo(null);
          }
        } finally {
          setContractInfoLoading(false);
        }
      })();
    }
  }, [getProvider]);

  const loadTokenInfo = useCallback(async (addr: string, netId: string) => {
    const provider = getProvider();
    const host = BLOCKSCOUT_HOSTS[netId];

    setTokenInfoLoading(true); setTokenInfo(null);
    let info: TokenInfo | null = null;
    if (host) {
      try { info = await fetchTokenInfoBlockscout(addr, host); } catch {}
    }
    if (!info) {
      try { info = await detectTokenViaRpc(provider, addr); } catch { info = null; }
    }
    setTokenInfo(info);
    setTokenInfoLoading(false);
    if (!info) return;

    const isNft = info.standard.toUpperCase().includes('721') || info.standard.toUpperCase().includes('1155');

    setTokenHoldersLoading(true); setTokenHoldersError(null); setTokenHolders([]);
    (async () => {
      try {
        if (!host) throw new Error('Daftar holders butuh instance Blockscout — belum tersedia untuk network ini.');
        setTokenHolders(await fetchTokenHoldersBlockscout(addr, host, info!.decimals));
      } catch (e: any) {
        setTokenHoldersError(friendlyRpcError(e, 'Gagal mengambil daftar holders.'));
      } finally {
        setTokenHoldersLoading(false);
      }
    })();

    setTokenTransfersLoading(true); setTokenTransfersError(null); setTokenTransfers([]); setTokenTransfersSource(null);
    (async () => {
      try {
        const transfers = host
          ? await fetchTokenTransfersBlockscout(addr, host, info!.decimals, isNft)
          : await fetchTokenTransfersViaRpc(provider, addr, info!.decimals, isNft);
        setTokenTransfers(transfers);
        setTokenTransfersSource(host ? 'blockscout' : 'rpc');
      } catch {
        try {
          const transfers = await fetchTokenTransfersViaRpc(provider, addr, info!.decimals, isNft);
          setTokenTransfers(transfers);
          setTokenTransfersSource('rpc');
        } catch (e2: any) {
          setTokenTransfersError(friendlyRpcError(e2, 'Gagal mengambil riwayat transfer token dari Blockscout maupun RPC.'));
        }
      } finally {
        setTokenTransfersLoading(false);
      }
    })();
  }, [getProvider]);

  const applyManualAbi = () => {
    try {
      const parsed = JSON.parse(manualAbiText);
      if (!Array.isArray(parsed)) throw new Error('ABI harus berupa array JSON, mis. [{...}, {...}]');
      setContractAbi(parsed);
      setManualAbiError(null);
      setShowManualAbi(false);
    } catch (e: any) {
      setManualAbiError(e?.message || 'ABI JSON tidak valid.');
    }
  };

  const handleSearch = async (eOrValue?: React.FormEvent | string) => {
    const directValue = typeof eOrValue === 'string' ? eOrValue : undefined;
    if (typeof eOrValue !== 'string') eOrValue?.preventDefault();
    const q = (directValue ?? query).trim();
    if (!q) return;
    if (directValue !== undefined) setQuery(directValue);
    resetResults();
    setLoading(true);

    try {
      const provider = getProvider();

      if (isAddress(q)) {
        const addr = ethers.utils.getAddress(q);
        const [balance, txCount, code] = await Promise.all([
          provider.getBalance(addr),
          provider.getTransactionCount(addr),
          provider.getCode(addr),
        ]);
        setAddressResult({
          address: addr,
          balance: ethers.utils.formatEther(balance),
          balanceUsd: null,
          txCount,
          isContract: code !== '0x',
          code,
        });
        setResultType('address');
        navigate(`/explorer/address/${addr}`, { replace: true });
        void loadAddressExtras(addr, networkId, code !== '0x', code);
        if (code !== '0x') void loadTokenInfo(addr, networkId);
        fetchNativeTokenPrice(network.symbol).then(price => {
          if (price == null) return;
          setAddressResult(prev => prev && prev.address === addr
            ? { ...prev, balanceUsd: price * parseFloat(prev.balance) }
            : prev);
        });
      } else if (isTxOrBlockHash(q)) {
        const tx = await provider.getTransaction(q);
        if (tx) {
          const receipt = await provider.getTransactionReceipt(q).catch(() => null);
          let ts: number | null = null;
          if (tx.blockNumber) {
            const blk = await provider.getBlock(tx.blockNumber).catch(() => null);
            ts = blk?.timestamp ?? null;
          }
          const selector = tx.data && tx.data.length >= 10 ? tx.data.slice(2, 10).toLowerCase() : null;
          const methodGuess = selector ? KNOWN_4BYTE[selector] ?? null : null;
          const decodedParams = decodeCalldataParams(tx.data || '0x', methodGuess);
          const rawLogs = receipt?.logs ?? [];
          const logs: TxLog[] = rawLogs.slice(0, 25).map(l => {
            const topic0 = l.topics && l.topics.length > 0 ? l.topics[0].toLowerCase() : null;
            const known = topic0 ? KNOWN_TOPICS[topic0.replace(/^0x/, '')] : undefined;
            return {
              address: l.address, logIndex: l.logIndex, topic0, eventGuess: known ? known.sig : null,
              rawTopics: l.topics ?? [], rawData: l.data ?? '0x',
            };
          });

          let confirmations: number | null = null;
          if (tx.blockNumber) {
            try {
              const head = await provider.getBlockNumber();
              confirmations = Math.max(0, head - tx.blockNumber + 1);
            } catch {}
          }

          const effectiveGasPrice = (receipt as any)?.effectiveGasPrice ?? tx.gasPrice ?? null;
          const feeNative = receipt && effectiveGasPrice
            ? ethers.utils.formatEther(receipt.gasUsed.mul(effectiveGasPrice))
            : null;

          setTxResult({
            hash: tx.hash,
            status: !tx.blockNumber ? 'pending' : receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'success',
            blockNumber: tx.blockNumber ?? null,
            timestamp: ts,
            from: tx.from,
            to: tx.to ?? null,
            value: ethers.utils.formatEther(tx.value),
            gasUsed: receipt ? receipt.gasUsed.toString() : null,
            gasLimit: tx.gasLimit ? tx.gasLimit.toString() : null,
            gasPrice: tx.gasPrice ? ethers.utils.formatUnits(tx.gasPrice, 'gwei') : '0',
            nonce: tx.nonce,
            type: tx.type ?? null,
            dataSelector: selector,
            methodGuess,
            logs,
            totalLogs: rawLogs.length,
            confirmations,
            transactionIndex: receipt ? receipt.transactionIndex : null,
            feeNative,
            maxFeePerGas: tx.maxFeePerGas ? ethers.utils.formatUnits(tx.maxFeePerGas, 'gwei') : null,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.utils.formatUnits(tx.maxPriorityFeePerGas, 'gwei') : null,
            inputData: tx.data || '0x',
            decodedParams,
            rawTxJson: buildRawTxJson(tx),
            rawReceiptJson: buildRawReceiptJson(receipt),
            logsBloom: receipt?.logsBloom ?? null,
          });
          setResultType('tx');
          navigate(`/explorer/tx/${tx.hash}`, { replace: true });

          if (receipt && receipt.status === 0) {
            setTxRevertLoading(true);
            fetchRevertReason(provider, tx).then(reason => {
              setTxRevertReason(reason);
              setTxRevertLoading(false);
            });
          }

          if (logs.length > 0) {
            (async () => {
              const decimalsCache = new Map<string, { symbol: string; decimals: number } | null>();
              const decodedLogs = await Promise.all(logs.map(async (log): Promise<TxLog> => {
                if (log.topic0 !== ERC20_TRANSFER_TOPIC) return log;
                if (log.rawTopics.length === 4) {
                  return {
                    ...log, transferKind: 'erc721',
                    transferFrom: '0x' + log.rawTopics[1].slice(-40),
                    transferTo: '0x' + log.rawTopics[2].slice(-40),
                    transferAmount: BigInt(log.rawTopics[3]).toString(),
                  };
                }
                if (log.rawTopics.length === 3 && log.rawData && log.rawData !== '0x') {
                  let meta = decimalsCache.get(log.address);
                  if (meta === undefined) {
                    try {
                      const c2 = new ethers.Contract(log.address, ERC20_MINI_ABI, provider);
                      const [decimals, symbol] = await Promise.all([
                        c2.decimals().catch(() => 18),
                        c2.symbol().catch(() => '???'),
                      ]);
                      meta = { symbol, decimals };
                    } catch { meta = null; }
                    decimalsCache.set(log.address, meta);
                  }
                  let amount: string;
                  try { amount = ethers.utils.formatUnits(log.rawData, meta?.decimals ?? 18); } catch { amount = log.rawData; }
                  return {
                    ...log, transferKind: 'erc20',
                    transferFrom: '0x' + log.rawTopics[1].slice(-40),
                    transferTo: '0x' + log.rawTopics[2].slice(-40),
                    transferAmount: amount,
                    transferSymbol: meta?.symbol ?? null,
                  };
                }
                return log;
              }));
              setTxResult(prev => (prev && prev.hash === tx.hash) ? { ...prev, logs: decodedLogs } : prev);
            })();
          }
        } else {
          const blk = await provider.getBlockWithTransactions(q).catch(() => null);
          if (!blk) throw new Error('Hash tidak ditemukan (bukan TX maupun Block hash yang valid di network ini)');
          setBlockResult({
            number: blk.number,
            hash: blk.hash,
            parentHash: blk.parentHash,
            timestamp: blk.timestamp,
            miner: blk.miner,
            gasUsed: blk.gasUsed.toString(),
            gasLimit: blk.gasLimit.toString(),
            txCount: blk.transactions.length,
            baseFeePerGas: (blk as any).baseFeePerGas ? ethers.utils.formatUnits((blk as any).baseFeePerGas, 'gwei') : null,
            difficulty: blk.difficulty ? blk.difficulty.toString() : null,
            extraData: blk.extraData ?? null,
            transactions: blk.transactions.slice(0, 25).map(t => ({
              hash: t.hash, from: t.from, to: t.to ?? null, value: ethers.utils.formatEther(t.value),
            })),
            rawJson: buildRawBlockJson(blk),
          });
          setResultType('block');
          navigate(`/explorer/block/${blk.number}`, { replace: true });
        }
      } else if (isBlockNumber(q)) {
        const blk = await provider.getBlockWithTransactions(parseInt(q, 10));
        if (!blk) throw new Error('Block tidak ditemukan');
        setBlockResult({
          number: blk.number,
          hash: blk.hash,
          parentHash: blk.parentHash,
          timestamp: blk.timestamp,
          miner: blk.miner,
          gasUsed: blk.gasUsed.toString(),
          gasLimit: blk.gasLimit.toString(),
          txCount: blk.transactions.length,
          baseFeePerGas: (blk as any).baseFeePerGas ? ethers.utils.formatUnits((blk as any).baseFeePerGas, 'gwei') : null,
          difficulty: blk.difficulty ? blk.difficulty.toString() : null,
          extraData: blk.extraData ?? null,
          transactions: blk.transactions.slice(0, 25).map(t => ({
            hash: t.hash, from: t.from, to: t.to ?? null, value: ethers.utils.formatEther(t.value),
          })),
          rawJson: buildRawBlockJson(blk),
        });
        setResultType('block');
        navigate(`/explorer/block/${blk.number}`, { replace: true });
      } else {
        throw new Error('Format tidak dikenali. Masukkan address (0x + 40 hex), TX hash / block hash (0x + 64 hex), atau nomor block.');
      }
    } catch (err: any) {
      setError(friendlyRpcError(err, 'Gagal mengambil data dari RPC. Coba ganti RPC atau network.'));
    } finally {
      setLoading(false);
    }
  };

  const openBlock = (num: number) => {
    handleSearch(String(num));
  };

  useEffect(() => {
    if (!urlValue) return;
    const val = decodeURIComponent(urlValue);
    if (val.startsWith('ase1')) {
      setChain('ase');
      handleAseSearch(val);
    } else if (val.startsWith('0x')) {
      setChain('evm');
      handleSearch(val);
    } else if (urlType === 'block' && isBlockNumber(val)) {
      // Angka block polos itu AMBIGU: baik EVM (`openBlock`/`handleSearch`)
      // maupun ASE (`openAseBlock`) sama-sama navigate ke
      // `/explorer/block/<number>` — tidak ada prefix pembeda sama sekali.
      // Sebelum ini kondisinya digabung ke cabang EVM di atas, jadi tiap
      // kali openAseBlock() manggil navigate(replace:true), effect ini
      // ke-trigger ulang, ketemu angka block polos, terus MAKSA chain balik
      // ke 'evm' — makanya klik block di tab Asentum malah nyasar ke EVM.
      // Fix: kalau ambigu begini, ikutin chain yang LAGI aktif (via ref,
      // biar gak baca nilai basi) alih-alih selalu asumsi EVM.
      if (chainRef.current === 'ase') {
        handleAseSearch(val);
      } else {
        setChain('evm');
        handleSearch(val);
      }
    } else {
      setChain('gram');
      handleGramSearch(val);
    }
  }, [urlType, urlValue]);

  const Row = ({ label, value, mono = true, copy, link }: {
    label: string; value: React.ReactNode; mono?: boolean; copy?: string; link?: string;
  }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: '14px', padding: '10px 0', borderBottom: `1px solid ${COLORS.border}`, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0, minWidth: '120px' }}>
        {label}
      </span>
      <span style={{
        fontSize: '13px', color: COLORS.text, fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-all', textAlign: 'right', flex: 1, display: 'flex', gap: '8px',
        justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap',
      }}>
        {value}
        {copy && (
          <FaCopy size={11} style={{ cursor: 'pointer', color: COLORS.muted, flexShrink: 0 }}
            onClick={() => copyToClipboard(copy)} title="Copy" />
        )}
      </span>
    </div>
  );

  const SourceTag = ({ source }: { source: DataSource }) => {
    if (!source) return null;
    const isBlockscout = source === 'blockscout';
    return (
      <span style={{
        fontSize: '9px', fontWeight: 'bold', color: isBlockscout ? COLORS.green : COLORS.accent,
        border: `1px solid ${isBlockscout ? COLORS.green : COLORS.accent}`, padding: '2px 6px',
        textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
      }}>
        via {isBlockscout ? 'Blockscout' : 'RPC'}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: TxResult['status'] }) => {
    const meta = {
      success: { color: COLORS.green, label: 'Success', icon: <FaCheckCircle size={11} /> },
      failed:  { color: COLORS.red,   label: 'Failed',  icon: <FaTimesCircle size={11} /> },
      pending: { color: COLORS.amber, label: 'Pending', icon: <FaClock size={11} /> },
    }[status];
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 'bold',
        color: meta.color, border: `1px solid ${meta.color}`, padding: '3px 8px',
      }}>
        {meta.icon} {meta.label}
      </span>
    );
  };

  return (
    <div className="app-container">
      <header>
        <h1>
          {chain === 'ase'
            ? <AsentumLogo size={26} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
            : <FaCompass style={{ marginRight: '8px' }} />}
          {chain === 'ase' ? 'Asentum Explorer' : 'Explorer'}
        </h1>
      </header>
      <Navbar />

      {/* ── Chain toggle: EVM vs GRAM (TON) ── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button type="button" onClick={() => setChain('evm')} style={{
          flex: 1, padding: '9px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
          background: chain === 'evm' ? COLORS.accent : 'none',
          color: chain === 'evm' ? '#000' : '#888',
          border: `1px solid ${chain === 'evm' ? COLORS.accent : COLORS.border}`,
        }}><FaGlobe style={{ marginRight: '6px' }} />EVM</button>
        <button type="button" onClick={() => setChain('gram')} style={{
          flex: 1, padding: '9px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
          background: chain === 'gram' ? '#0098EA' : 'none',
          color: chain === 'gram' ? '#fff' : '#888',
          border: `1px solid ${chain === 'gram' ? '#0098EA' : COLORS.border}`,
        }}><FaCompass style={{ marginRight: '6px' }} />GRAM</button>
        <button type="button" onClick={() => setChain('ase')} style={{
          flex: 1, padding: '9px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
          background: chain === 'ase' ? '#836EFD' : 'none',
          color: chain === 'ase' ? '#fff' : '#888',
          border: `1px solid ${chain === 'ase' ? '#836EFD' : COLORS.border}`,
        }}><AsentumLogo size={14} mono style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />ASE</button>
      </div>

      {chain === 'evm' && (
      <>
      {/* ── Network selector + pengaturan auto-refresh ── */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: showSettings ? '0' : '14px', padding: '12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`,
      }}>
        <FaGlobe color={network.color} size={14} />
        <select
          value={networkId}
          onChange={e => { setNetworkId(e.target.value); resetResults(); setQuery(''); }}
          style={{ flex: '1 1 200px', minWidth: '180px' }}
        >
          {networks.map(n => (
            <option key={n.id} value={n.id}>{n.name} (chainId {n.chainId})</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowSettings(s => !s)}
          title="Pengaturan auto-refresh"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px',
            background: showSettings ? COLORS.accent : '#111', color: showSettings ? '#000' : '#ccc',
            border: `1px solid ${showSettings ? COLORS.accent : COLORS.border}`, padding: '8px 12px', cursor: 'pointer',
          }}
        >
          <FaCog size={12} /> Pengaturan
        </button>
      </div>

      {showSettings && (
        <div style={{
          display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center',
          marginBottom: '14px', padding: '14px', background: '#111', border: `1px solid ${COLORS.border}`, borderTop: 'none',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={refreshSettings.enabled}
              onChange={e => setRefreshSettings(p => ({ ...p, enabled: e.target.checked }))}
              style={{ width: 'auto', margin: 0 }}
            />
            <FaSyncAlt size={11} color={refreshSettings.enabled ? COLORS.green : COLORS.muted} />
            Auto-refresh Latest Blocks
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: COLORS.muted }}>
            Interval:
            <select
              value={refreshSettings.intervalSec}
              disabled={!refreshSettings.enabled}
              onChange={e => setRefreshSettings(p => ({ ...p, intervalSec: Number(e.target.value) as 3 | 4 | 5 }))}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              <option value={3}>3 detik</option>
              <option value={4}>4 detik</option>
              <option value={5}>5 detik</option>
            </select>
          </label>
        </div>
      )}

      {/* ── Gas Tracker — estimasi fee Rendah / Standar / Cepat ── */}
      <div className="fade-in-up" style={{
        background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${COLORS.amber}`,
        padding: '16px 18px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: COLORS.amber, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaGasPump /> Gas Tracker — {network.name}
            {refreshSettings.enabled && !gasLoading && gasTiers && (
              <span style={{
                fontSize: '9px', fontWeight: 'bold', color: COLORS.green, border: `1px solid ${COLORS.green}`,
                padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', letterSpacing: '0.3px',
              }}>
                <FaSyncAlt size={8} /> live · {refreshSettings.intervalSec}s
              </span>
            )}
          </h3>
          {gasLoading && <FaSpinner className="spin-icon" color={COLORS.amber} size={12} />}
        </div>

        {gasError && !gasTiers ? (
          <p style={{ color: COLORS.red, fontSize: '11px', margin: 0 }}>{gasError}</p>
        ) : !gasTiers ? (
          <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '10px 0', margin: 0 }}>
            {gasLoading ? 'Memuat data gas fee…' : 'Tidak ada data (cek RPC).'}
          </p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              {([
                { key: 'low', label: 'Rendah', color: COLORS.green, icon: <FaClock size={11} />, eta: '~ 1-2 menit', tier: gasTiers.low },
                { key: 'standard', label: 'Standar', color: COLORS.accent, icon: <FaGasPump size={11} />, eta: '~ 30 detik', tier: gasTiers.standard },
                { key: 'fast', label: 'Cepat', color: COLORS.amber, icon: <FaBolt size={11} />, eta: '~ 15 detik', tier: gasTiers.fast },
              ] as const).map(({ key, label, color, icon, eta, tier }) => {
                const nativeCost = (tier.gwei * 21000) / 1e9;
                const usdCost = nativePriceUsd != null ? nativeCost * nativePriceUsd : null;
                return (
                  <div key={key} style={{
                    background: '#111', border: `1px solid ${color}40`, borderTop: `2px solid ${color}`,
                    padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px',
                  }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 'bold', color, textTransform: 'uppercase',
                      letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      {icon} {label}
                    </span>
                    <span style={{ fontSize: '17px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>
                      {tier.gwei.toFixed(2)} <span style={{ fontSize: '11px', color: COLORS.muted, fontWeight: 'normal' }}>Gwei</span>
                    </span>
                    <span style={{ fontSize: '10px', color: COLORS.muted }}>{eta}</span>
                    <span style={{ fontSize: '10px', color: COLORS.muted, fontFamily: 'monospace' }}>
                      ≈ {nativeCost.toFixed(6)} {network.symbol}
                      {usdCost != null && ` ($${usdCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '10px', color: COLORS.muted, margin: '10px 0 0' }}>
              {gasTiers.isEip1559
                ? `EIP-1559 · Base Fee saat ini ${gasTiers.baseFeeGwei?.toFixed(2)} Gwei · estimasi biaya di atas untuk transfer native standar (21.000 gas).`
                : `Legacy gas price (network ini belum EIP-1559) · estimasi biaya di atas untuk transfer native standar (21.000 gas).`}
            </p>
          </>
        )}
      </div>

      {/* ── Search bar ── */}
      <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
        <div className="search-input-wrapper" style={{ display: 'flex' }}>
          <FaSearch className="search-icon" />
          <input
            type="search"
            placeholder="Address (0x...) / TX Hash (0x...) / Block Number"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ color: '#fff' }}
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
          {loading ? <><FaSpinner className="spin-icon" /> Mencari…</> : <><FaSearch /> Cari</>}
        </button>
      </form>

      {error && (
        <div style={{
          background: 'rgba(255,51,51,0.07)', border: '1px solid #ff333344', borderLeft: '3px solid #ff3333',
          padding: '12px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <FaExclamationTriangle color="#ff3333" size={13} />
          <span style={{ color: '#ff6666', fontSize: '12px' }}>{error}</span>
        </div>
      )}

      {/* ── ADDRESS RESULT ── */}
      {resultType === 'address' && addressResult && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${network.color}`, padding: '18px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: network.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaWallet /> {addressResult.isContract ? 'Contract Address' : 'Wallet Address'}
          </h3>
          <Row label="Address" value={addressResult.address} copy={addressResult.address}
            link={`${network.explorerUrl}/address/${addressResult.address}`} />
          <Row label="Balance" value={
            <span>
              {parseFloat(addressResult.balance).toFixed(6)} {network.symbol}
              {addressResult.balanceUsd != null && (
                <span style={{ color: COLORS.muted, marginLeft: '6px' }}>
                  (${addressResult.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              )}
            </span>
          } />
          <Row label="Tx Count (Nonce)" value={addressResult.txCount} />
          <Row label="Type" value={addressResult.isContract
            ? <span style={{ color: COLORS.accent }}>Contract</span>
            : <span style={{ color: COLORS.green }}>EOA (Wallet Biasa)</span>} mono={false} />
          {addressResult.isContract && (
            <Row label="Verifikasi" value={
              contractInfoLoading
                ? <span style={{ color: COLORS.muted, display: 'flex', alignItems: 'center', gap: '6px' }}><FaSpinner className="spin-icon" size={10} /> Mengecek…</span>
                : contractInfo?.isVerified
                  ? <span style={{ color: COLORS.green, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FaCheckCircle size={11} /> Verified{contractInfo.name ? ` — ${contractInfo.name}` : ''}
                      {contractInfo.compilerVersion && <span style={{ color: COLORS.muted }}>({contractInfo.compilerVersion})</span>}
                      <SourceTag source="blockscout" />
                    </span>
                  : <span style={{ color: COLORS.muted, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <FaTimesCircle size={11} /> Source code belum verified
                      {contractInfo?.source === 'rpc' && <SourceTag source="rpc" />}
                    </span>
            } mono={false} />
          )}
          {addressResult.isContract && !contractInfoLoading && contractInfo?.creatorAddress && (
            <Row label="Contract Creator" value={
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {shortHash(contractInfo.creatorAddress, 10, 8)}
                {contractInfo.creationTxHash && (
                  <span style={{ color: COLORS.muted }}>
                    at tx {shortHash(contractInfo.creationTxHash, 8, 6)}
                  </span>
                )}
              </span>
            } copy={contractInfo.creatorAddress}
              link={`${network.explorerUrl}/address/${contractInfo.creatorAddress}`} />
          )}
          {addressResult.isContract && !contractInfoLoading && contractInfo?.source === 'rpc' && (contractInfo.standardGuess || contractInfo.isProxy) && (
            <Row label="Analisis Bytecode" value={
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                {contractInfo.standardGuess && <span style={{ color: COLORS.accent, fontSize: '12px' }}>{contractInfo.standardGuess}</span>}
                {contractInfo.isProxy && (
                  <span style={{ color: COLORS.amber, fontSize: '12px' }}>
                    Proxy contract{contractInfo.implementation ? ` → implementasi ${shortHash(contractInfo.implementation, 8, 6)}` : ' (minimal proxy / EIP-1167)'}
                  </span>
                )}
              </span>
            } mono={false} />
          )}
          {addressResult.isContract && (
            <div style={{ marginTop: '12px' }}>
              <div onClick={() => setShowCode(s => !s)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px',
              }}>
                <FaFileCode /> Bytecode ({(addressResult.code.length - 2) / 2} bytes)
                {showCode ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
              </div>
              {showCode && (
                <div style={{
                  marginTop: '8px', background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
                  fontSize: '10px', color: '#888', fontFamily: 'monospace', wordBreak: 'break-all',
                  maxHeight: '180px', overflowY: 'auto',
                }}>
                  {addressResult.code}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── READ / WRITE CONTRACT ── */}
      {resultType === 'address' && addressResult?.isContract && !contractInfoLoading && (
        <div style={{ marginBottom: '24px' }}>
          {contractAbi ? (
            <ContractInteractionPanel
              address={addressResult.address}
              abi={contractAbi}
              getProvider={getProvider}
              chainId={network.chainId}
              networkName={network.name}
              explorerUrl={network.explorerUrl}
              walletGenAccounts={walletGenAccounts}
            />
          ) : (
            <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #9c27b0', padding: '18px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9c27b0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaFileCode /> Read / Write Contract
              </h3>
              <p style={{ color: COLORS.muted, fontSize: '12px', margin: '0 0 12px' }}>
                {contractInfo?.isVerified === false
                  ? 'Contract belum verified di Blockscout, jadi ABI tidak bisa diambil otomatis. Paste ABI JSON manual untuk mulai Read / Write.'
                  : 'ABI tidak tersedia otomatis untuk network ini. Paste ABI JSON manual untuk mulai Read / Write.'}
              </p>
              {!showManualAbi ? (
                <button type="button" onClick={() => setShowManualAbi(true)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 12px',
                  background: '#111', color: '#ccc', border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                }}>
                  <FaFileImport size={11} /> Paste ABI Manual
                </button>
              ) : (
                <>
                  <textarea
                    placeholder='Paste ABI JSON, mis. [{"type":"function","name":"balanceOf",...}]'
                    value={manualAbiText}
                    onChange={e => setManualAbiText(e.target.value)}
                    rows={6}
                    style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace', marginBottom: '8px', resize: 'vertical' }}
                  />
                  {manualAbiError && (
                    <div style={{ color: COLORS.red, fontSize: '11px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FaExclamationTriangle size={11} /> {manualAbiError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={applyManualAbi} style={{
                      flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                      background: COLORS.accent, color: '#000', border: 'none',
                    }}>
                      Terapkan ABI
                    </button>
                    <button type="button" onClick={() => { setShowManualAbi(false); setManualAbiError(null); }} style={{
                      padding: '8px 12px', fontSize: '11px', cursor: 'pointer',
                      background: '#111', color: '#888', border: `1px solid ${COLORS.border}`,
                    }}>
                      Batal
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TOKEN PAGE — kalau address yang dicari adalah kontrak token ── */}
      {resultType === 'address' && addressResult?.isContract && (tokenInfoLoading || tokenInfo) && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #e8a119', padding: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#e8a119', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaTag /> Token Page
            </h3>
            <SourceTag source={tokenInfo?.source ?? null} />
          </div>

          {tokenInfoLoading ? (
            <p style={{ color: COLORS.muted, fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <FaSpinner className="spin-icon" size={12} /> Mendeteksi apakah address ini kontrak token…
            </p>
          ) : tokenInfo && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {tokenInfo.iconUrl
                  ? <img src={tokenInfo.iconUrl} alt="" width={36} height={36} style={{ borderRadius: '50%', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#555', fontWeight: 'bold' }}>
                      {(tokenInfo.symbol ?? '??').slice(0, 2).toUpperCase()}
                    </div>}
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {tokenInfo.name ?? 'Unknown Token'}
                    {tokenInfo.symbol && <span style={{ color: COLORS.muted, fontWeight: 'normal', fontSize: '13px' }}>({tokenInfo.symbol})</span>}
                  </div>
                  <span style={{
                    fontSize: '9px', fontWeight: 'bold', color: '#e8a119', border: '1px solid #e8a119',
                    padding: '2px 6px', marginTop: '4px', display: 'inline-block',
                  }}>
                    {tokenInfo.standard}
                  </span>
                </div>
                {tokenInfo.priceUsd != null && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '15px', fontFamily: 'monospace', color: COLORS.green, fontWeight: 'bold' }}>
                      ${tokenInfo.priceUsd < 0.01 ? tokenInfo.priceUsd.toPrecision(4) : tokenInfo.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </div>
                    <div style={{ fontSize: '10px', color: COLORS.muted, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <FaChartLine size={9} /> Price (USD)
                    </div>
                  </div>
                )}
              </div>

              <Row label="Contract" value={shortHash(tokenInfo.address, 12, 8)} copy={tokenInfo.address}
                link={`${network.explorerUrl}/token/${tokenInfo.address}`} />
              {tokenInfo.decimals != null && <Row label="Decimals" value={tokenInfo.decimals} />}
              {tokenInfo.totalSupply != null && (
                <Row label="Total Supply" value={`${parseFloat(tokenInfo.totalSupply).toLocaleString('en-US', { maximumFractionDigits: 6 })}${tokenInfo.symbol ? ' ' + tokenInfo.symbol : ''}`} />
              )}
              {tokenInfo.holdersCount != null && (
                <Row label="Holders" value={<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FaUsers size={11} />{tokenInfo.holdersCount.toLocaleString('id-ID')}</span>} mono={false} />
              )}
              {tokenInfo.marketCapUsd != null && (
                <Row label="Market Cap" value={`$${tokenInfo.marketCapUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
              )}

              {/* ── Tabs: Transfers / Holders ── */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '16px', marginBottom: '10px', borderBottom: `1px solid ${COLORS.border}` }}>
                {([
                  { key: 'transfers', label: `Transfers${tokenTransfers.length > 0 ? ` (${tokenTransfers.length})` : ''}` },
                  { key: 'holders', label: `Holders${tokenHolders.length > 0 ? ` (${tokenHolders.length})` : ''}` },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTokenTab(t.key)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '8px 4px', fontSize: '11px', fontWeight: 'bold',
                      color: tokenTab === t.key ? '#e8a119' : COLORS.muted,
                      borderBottom: tokenTab === t.key ? '2px solid #e8a119' : '2px solid transparent',
                      marginBottom: '-1px', textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tokenTab === 'transfers' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                    <SourceTag source={tokenTransfersSource} />
                    {tokenTransfersLoading && <FaSpinner className="spin-icon" color="#e8a119" size={12} style={{ marginLeft: '8px' }} />}
                  </div>
                  {tokenTransfersError ? (
                    <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{tokenTransfersError}</p>
                  ) : !tokenTransfersLoading && tokenTransfers.length === 0 ? (
                    <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Belum ada transfer tercatat.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                      {tokenTransfers.map((t, i) => (
                        <div key={`${t.hash}-${i}`} className="explorer-row" onClick={() => handleSearch(t.hash)} style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                          background: '#111', border: `1px solid ${COLORS.border}`, cursor: 'pointer', flexWrap: 'wrap',
                        }}>
                          <span style={{ color: COLORS.accent, fontFamily: 'monospace', fontSize: '11px' }}>{shortHash(t.hash, 8, 6)}</span>
                          <span style={{ color: COLORS.muted, fontFamily: 'monospace', fontSize: '11px' }}>
                            {shortHash(t.from, 6, 4)} <FaArrowRight size={9} style={{ margin: '0 4px' }} /> {shortHash(t.to, 6, 4)}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: '11px', fontFamily: 'monospace', color: COLORS.text }}>
                            {t.isNft ? t.amount : `${parseFloat(t.amount || '0').toLocaleString('en-US', { maximumFractionDigits: 6 })} ${tokenInfo.symbol ?? ''}`}
                          </span>
                          {t.timestamp && <span style={{ fontSize: '10px', color: COLORS.muted, whiteSpace: 'nowrap' }}>{timeAgo(t.timestamp)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tokenTab === 'holders' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                    {tokenHoldersLoading && <FaSpinner className="spin-icon" color="#e8a119" size={12} />}
                  </div>
                  {tokenHoldersError ? (
                    <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{tokenHoldersError}</p>
                  ) : !tokenHoldersLoading && tokenHolders.length === 0 ? (
                    <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Belum ada data holders.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {tokenHolders.map((h, idx) => {
                        const rankColors = ['#f3ba2f', '#aaaaaa', '#cd7f32'];
                        return (
                          <div key={h.address} className="explorer-row" onClick={() => handleSearch(h.address)} style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                            background: '#111', border: `1px solid ${COLORS.border}`, cursor: 'pointer', flexWrap: 'wrap',
                          }}>
                            <span style={{
                              width: '20px', height: '20px', flexShrink: 0,
                              background: rankColors[idx] ?? '#2a2a2a',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '10px', fontWeight: 'bold', color: idx < 3 ? '#000' : '#888',
                            }}>
                              {idx + 1}
                            </span>
                            <span style={{ color: COLORS.text, fontFamily: 'monospace', fontSize: '11px' }}>{shortHash(h.address, 8, 6)}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '11px', fontFamily: 'monospace', color: COLORS.text }}>
                              {parseFloat(h.balance || '0').toLocaleString('en-US', { maximumFractionDigits: 4 })}{tokenInfo.symbol ? ` ${tokenInfo.symbol}` : ''}
                            </span>
                            {h.percentage != null && (
                              <span style={{ fontSize: '10px', color: '#e8a119', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{h.percentage.toFixed(2)}%</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TOKEN HOLDINGS (detail tambahan untuk address) ── */}
      {resultType === 'address' && addressResult && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #f3ba2f', padding: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#f3ba2f', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaCoins /> Token Holdings
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SourceTag source={tokensSource} />
              {tokensLoading && <FaSpinner className="spin-icon" color="#f3ba2f" size={12} />}
            </div>
          </div>
          {tokensError ? (
            <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{tokensError}</p>
          ) : !tokensLoading && tokenHoldings.length === 0 ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              {tokensSource === 'rpc'
                ? `Tidak ada token terdeteksi dalam ${RPC_SCAN_MAX_LOOKBACK.toLocaleString('id-ID')} block terakhir (scan via RPC, tanpa Blockscout).`
                : 'Tidak ada token ERC-20 terdeteksi di address ini.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tokenHoldings.map(t => (
                <div key={t.address} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                  background: '#111', border: `1px solid ${COLORS.border}`, flexWrap: 'wrap',
                }}>
                  {t.logo
                    ? <img src={t.logo} alt="" width={20} height={20} style={{ borderRadius: '50%', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                    : <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#555' }}>{t.symbol.slice(0, 2).toUpperCase()}</div>}
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {t.symbol} <span style={{ color: COLORS.muted, fontWeight: 'normal' }}>· {t.name}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#444', fontFamily: 'monospace' }}>{shortHash(t.address, 8, 4)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>{t.balanceFormatted}</div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: t.usdValue !== null ? COLORS.green : '#444' }}>
                      {t.usdValue !== null ? '$' + t.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'harga n/a'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RECENT TRANSACTIONS (detail tambahan untuk address) ── */}
      {resultType === 'address' && addressResult && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #9c27b0', padding: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9c27b0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaHistory /> Riwayat Transaksi Terbaru
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SourceTag source={recentTxsSource} />
              {recentTxsLoading && <FaSpinner className="spin-icon" color="#9c27b0" size={12} />}
            </div>
          </div>
          {recentTxsSource === 'rpc' && !recentTxsLoading && (
            <p style={{ color: '#555', fontSize: '10px', margin: '0 0 10px' }}>
              Data dipindai langsung dari RPC (event log transfer token, {RPC_SCAN_MAX_LOOKBACK.toLocaleString('id-ID')} block terakhir) —
              transfer native {network.symbol} biasa (tanpa event log) tidak ikut ter-index tanpa Blockscout.
            </p>
          )}
          {recentTxsError ? (
            <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{recentTxsError}</p>
          ) : !recentTxsLoading && recentTxs.length === 0 ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              Belum ada transaksi tercatat di address ini.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
              {recentTxs.map(t => {
                const isOut = t.from.toLowerCase() === addressResult.address.toLowerCase();
                return (
                  <div key={t.hash} className="explorer-row" onClick={() => handleSearch(t.hash)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                    background: '#111', border: `1px solid ${COLORS.border}`, cursor: 'pointer', flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 'bold', color: isOut ? COLORS.amber : COLORS.green,
                      border: `1px solid ${isOut ? COLORS.amber : COLORS.green}`, padding: '2px 6px', flexShrink: 0,
                    }}>
                      {isOut ? 'OUT' : 'IN'}
                    </span>
                    <span style={{ color: COLORS.accent, fontFamily: 'monospace', fontSize: '11px' }}>{shortHash(t.hash, 8, 6)}</span>
                    <span style={{ fontSize: '10px', color: COLORS.muted, fontFamily: 'monospace' }}>
                      {t.methodGuess ?? '—'}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', fontFamily: 'monospace', color: COLORS.text }}>
                      {parseFloat(t.value).toFixed(4)} {network.symbol}
                    </span>
                    {t.timestamp && <span style={{ fontSize: '10px', color: COLORS.muted, whiteSpace: 'nowrap' }}>{timeAgo(t.timestamp)}</span>}
                    {t.status === 'failed'
                      ? <FaTimesCircle color={COLORS.red} size={11} />
                      : t.status === 'pending' ? <FaClock color={COLORS.amber} size={11} /> : <FaCheckCircle color={COLORS.green} size={11} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TX RESULT ── */}
      {resultType === 'tx' && txResult && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${network.color}`, padding: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: network.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaExchangeAlt /> Transaction Detail
            </h3>
            <StatusBadge status={txResult.status} />
          </div>
          {txResult.status === 'failed' && (
            <div style={{
              background: 'rgba(244,67,54,0.06)', border: '1px solid #f4433644', borderLeft: '3px solid #f44336',
              padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px',
            }}>
              <FaTimesCircle color="#f44336" size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: '#ff8a80' }}>
                <strong>Revert Reason: </strong>
                {txRevertLoading
                  ? <span style={{ color: COLORS.muted, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><FaSpinner className="spin-icon" size={10} /> Mensimulasikan ulang TX…</span>
                  : txRevertReason ?? <span style={{ color: COLORS.muted }}>Tidak bisa diambil (RPC bukan archive node, atau block terlalu lama untuk di-replay).</span>}
              </div>
            </div>
          )}
          <Row label="Tx Hash" value={shortHash(txResult.hash, 14, 12)} copy={txResult.hash}
            link={`${network.explorerUrl}/tx/${txResult.hash}`} />
          {txResult.blockNumber && <Row label="Block" value={txResult.blockNumber} link={`${network.explorerUrl}/block/${txResult.blockNumber}`} />}
          {txResult.confirmations != null && (
            <Row label="Confirmations" value={
              <span style={{ color: txResult.confirmations > 0 ? COLORS.green : COLORS.amber }}>
                {txResult.confirmations.toLocaleString('id-ID')}
              </span>
            } />
          )}
          {txResult.transactionIndex != null && <Row label="Position in Block" value={txResult.transactionIndex} />}
          {txResult.timestamp && <Row label="Timestamp" value={`${timeAgo(txResult.timestamp)} (${new Date(txResult.timestamp * 1000).toLocaleString('id-ID')})`} mono={false} />}
          <Row label="From" value={shortHash(txResult.from, 10, 8)} copy={txResult.from} link={`${network.explorerUrl}/address/${txResult.from}`} />
          <Row label="To" value={txResult.to
            ? <><FaArrowRight size={10} style={{ marginRight: 4 }} />{shortHash(txResult.to, 10, 8)}</>
            : <span style={{ color: COLORS.amber }}>Contract Creation</span>}
            copy={txResult.to || undefined} link={txResult.to ? `${network.explorerUrl}/address/${txResult.to}` : undefined} />
          <Row label="Value" value={`${parseFloat(txResult.value).toFixed(6)} ${network.symbol}`} />
          {txResult.gasUsed && txResult.gasLimit && (
            <Row label="Gas Used / Limit" value={`${parseInt(txResult.gasUsed, 10).toLocaleString('id-ID')} / ${parseInt(txResult.gasLimit, 10).toLocaleString('id-ID')} (${((parseInt(txResult.gasUsed, 10) / parseInt(txResult.gasLimit, 10)) * 100).toFixed(1)}%)`} />
          )}
          <Row label="Gas Price" value={`${parseFloat(txResult.gasPrice).toFixed(4)} Gwei`} />
          {txResult.maxFeePerGas && (
            <Row label="Max Fee / Priority Fee" value={`${parseFloat(txResult.maxFeePerGas).toFixed(4)} / ${parseFloat(txResult.maxPriorityFeePerGas || '0').toFixed(4)} Gwei`} />
          )}
          {txResult.feeNative && (
            <Row label="Transaction Fee" value={`${parseFloat(txResult.feeNative).toFixed(8)} ${network.symbol}`} />
          )}
          <Row label="Nonce" value={txResult.nonce} />
          {txResult.type !== null && <Row label="Tx Type" value={`Type ${txResult.type}${txResult.type === 2 ? ' (EIP-1559)' : ''}`} />}
          {txResult.dataSelector && (
            <Row label="Method" value={txResult.methodGuess
              ? <span style={{ color: COLORS.accent }}>{txResult.methodGuess}</span>
              : <span style={{ color: COLORS.muted }}>0x{txResult.dataSelector} (unknown)</span>} />
          )}
          {txResult.decodedParams.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '10px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Decoded Input Params
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {txResult.decodedParams.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '7px 10px',
                    background: '#111', border: `1px solid ${COLORS.border}`, fontSize: '11px', flexWrap: 'wrap',
                  }}>
                    <span style={{ color: COLORS.muted, minWidth: '70px', flexShrink: 0 }}>[{i}] {p.type}</span>
                    <span style={{ color: COLORS.text, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{p.value}</span>
                    {p.note && <span style={{ color: COLORS.accent, fontSize: '10px', flexShrink: 0 }}>{p.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {txResult.inputData && txResult.inputData !== '0x' && (
            <div style={{ marginTop: '12px' }}>
              <div onClick={() => setShowInputData(s => !s)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px',
              }}>
                <FaFileCode /> Input Data ({(txResult.inputData.length - 2) / 2} bytes)
                {showInputData ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
              </div>
              {showInputData && (
                <div style={{
                  marginTop: '8px', background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
                  fontSize: '10px', color: '#888', fontFamily: 'monospace', wordBreak: 'break-all',
                  maxHeight: '180px', overflowY: 'auto', position: 'relative',
                }}>
                  <FaCopy size={11} style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', color: COLORS.muted }}
                    onClick={() => copyToClipboard(txResult.inputData)} title="Copy" />
                  {txResult.inputData}
                </div>
              )}
            </div>
          )}
          {txResult.totalLogs > 0 && (
            <div style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '10px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaListUl size={10} /> Event Logs ({txResult.totalLogs}{txResult.totalLogs > txResult.logs.length ? `, menampilkan ${txResult.logs.length}` : ''})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {txResult.logs.map((l, i) => {
                  const isExpanded = !!expandedLogs[i];
                  return (
                  <div key={i} style={{
                    display: 'flex', flexDirection: 'column', gap: '7px', padding: '8px 10px',
                    background: '#111', border: `1px solid ${COLORS.border}`, fontSize: '11px',
                  }}>
                    <div
                      onClick={() => setExpandedLogs(s => ({ ...s, [i]: !s[i] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', cursor: 'pointer' }}
                    >
                      <span style={{
                        fontSize: '9px', color: COLORS.muted, border: `1px solid ${COLORS.border}`,
                        padding: '2px 5px', flexShrink: 0, fontFamily: 'monospace',
                      }}>
                        Log #{l.logIndex}
                      </span>
                      <span style={{ color: COLORS.muted, fontFamily: 'monospace', flexShrink: 0 }}>{shortHash(l.address, 8, 4)}</span>
                      {l.eventGuess
                        ? <span style={{ color: COLORS.accent }}>{l.eventGuess}</span>
                        : <span style={{ color: COLORS.muted }}>{l.topic0 ? `${shortHash(l.topic0, 10, 6)} (unknown event)` : 'anonymous log'}</span>}
                      <span style={{ marginLeft: 'auto', color: COLORS.muted, flexShrink: 0 }}>
                        {isExpanded ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                      </span>
                    </div>
                    {l.transferKind && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingLeft: '4px', fontSize: '11px' }}>
                        <span style={{
                          fontSize: '9px', fontWeight: 'bold', color: l.transferKind === 'erc20' ? COLORS.green : '#e81899',
                          border: `1px solid ${l.transferKind === 'erc20' ? COLORS.green : '#e81899'}`, padding: '1px 5px', flexShrink: 0,
                        }}>
                          {l.transferKind === 'erc20' ? 'ERC-20' : 'ERC-721'}
                        </span>
                        <span style={{ color: COLORS.text, fontFamily: 'monospace' }}>{shortHash(l.transferFrom ?? '', 6, 4)}</span>
                        <FaArrowRight size={9} color={COLORS.muted} />
                        <span style={{ color: COLORS.text, fontFamily: 'monospace' }}>{shortHash(l.transferTo ?? '', 6, 4)}</span>
                        <span style={{ color: COLORS.green, fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {l.transferKind === 'erc20'
                            ? `${parseFloat(l.transferAmount ?? '0').toLocaleString('en-US', { maximumFractionDigits: 6 })} ${l.transferSymbol ?? '???'}`
                            : `Token ID #${l.transferAmount}`}
                        </span>
                      </div>
                    )}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '7px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: COLORS.muted, minWidth: '52px', flexShrink: 0, fontSize: '10px', textTransform: 'uppercase' }}>Address</span>
                          <span style={{ color: COLORS.text, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{l.address}</span>
                          <FaCopy size={10} style={{ cursor: 'pointer', color: COLORS.muted, flexShrink: 0 }}
                            onClick={() => copyToClipboard(l.address)} title="Copy" />
                          <a href={`${network.explorerUrl}/address/${l.address}`} target="_blank" rel="noreferrer" style={{ color: COLORS.accent, flexShrink: 0 }}>
                            <FaExternalLinkAlt size={10} />
                          </a>
                        </div>
                        {l.rawTopics.map((t, ti) => (
                          <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: COLORS.muted, minWidth: '52px', flexShrink: 0, fontSize: '10px', textTransform: 'uppercase' }}>
                              Topic{ti}{ti === 0 ? '' : ''}
                            </span>
                            <span style={{ color: ti === 0 ? COLORS.accent : COLORS.text, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{t}</span>
                            <FaCopy size={10} style={{ cursor: 'pointer', color: COLORS.muted, flexShrink: 0 }}
                              onClick={() => copyToClipboard(t)} title="Copy" />
                          </div>
                        ))}
                        {l.rawTopics.length === 0 && (
                          <div style={{ color: COLORS.muted, fontSize: '10px' }}>Anonymous log — tidak ada topic.</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ color: COLORS.muted, minWidth: '52px', flexShrink: 0, fontSize: '10px', textTransform: 'uppercase' }}>Data</span>
                          <span style={{ color: COLORS.text, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
                            {l.rawData} <span style={{ color: COLORS.muted }}>({Math.max(0, (l.rawData.length - 2) / 2)} bytes)</span>
                          </span>
                          <FaCopy size={10} style={{ cursor: 'pointer', color: COLORS.muted, flexShrink: 0 }}
                            onClick={() => copyToClipboard(l.rawData)} title="Copy" />
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}
          {(txResult.rawTxJson || txResult.rawReceiptJson) && (
            <div style={{ marginTop: '14px' }}>
              <div onClick={() => setShowRawTx(s => !s)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px',
              }}>
                <FaFileCode /> Raw Transaction &amp; Receipt (JSON)
                {showRawTx ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
              </div>
              {showRawTx && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Raw Tx</span>
                      <FaCopy size={11} style={{ cursor: 'pointer', color: COLORS.muted }}
                        onClick={() => copyToClipboard(txResult.rawTxJson)} title="Copy raw tx JSON" />
                    </div>
                    <pre style={{
                      margin: 0, background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
                      fontSize: '10px', color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all', maxHeight: '260px', overflowY: 'auto',
                    }}>
                      {txResult.rawTxJson}
                    </pre>
                  </div>
                  {txResult.rawReceiptJson && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Raw Receipt</span>
                        <FaCopy size={11} style={{ cursor: 'pointer', color: COLORS.muted }}
                          onClick={() => copyToClipboard(txResult.rawReceiptJson!)} title="Copy raw receipt JSON" />
                      </div>
                      <pre style={{
                        margin: 0, background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
                        fontSize: '10px', color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all', maxHeight: '260px', overflowY: 'auto',
                      }}>
                        {txResult.rawReceiptJson}
                      </pre>
                    </div>
                  )}
                  {txResult.logsBloom && (
                    <div>
                      <div style={{ fontSize: '10px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                        Logs Bloom
                      </div>
                      <div style={{
                        background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
                        fontSize: '10px', color: '#888', fontFamily: 'monospace', wordBreak: 'break-all',
                        maxHeight: '90px', overflowY: 'auto', position: 'relative',
                      }}>
                        <FaCopy size={11} style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', color: COLORS.muted }}
                          onClick={() => copyToClipboard(txResult.logsBloom!)} title="Copy" />
                        {txResult.logsBloom}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BLOCK RESULT ── */}
      {resultType === 'block' && blockResult && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${network.color}`, padding: '18px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: network.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaCube /> Block #{blockResult.number}
          </h3>
          <Row label="Block Hash" value={shortHash(blockResult.hash, 14, 12)} copy={blockResult.hash}
            link={`${network.explorerUrl}/block/${blockResult.number}`} />
          <Row label="Parent Hash" value={shortHash(blockResult.parentHash, 14, 12)} copy={blockResult.parentHash}
            link={`${network.explorerUrl}/block/${blockResult.number - 1}`} />
          <Row label="Timestamp" value={`${timeAgo(blockResult.timestamp)} (${new Date(blockResult.timestamp * 1000).toLocaleString('id-ID')})`} mono={false} />
          <Row label="Miner / Validator" value={shortHash(blockResult.miner, 10, 8)} copy={blockResult.miner}
            link={`${network.explorerUrl}/address/${blockResult.miner}`} />
          <Row label="Gas Used / Limit" value={`${parseInt(blockResult.gasUsed, 10).toLocaleString('id-ID')} / ${parseInt(blockResult.gasLimit, 10).toLocaleString('id-ID')} (${((parseInt(blockResult.gasUsed, 10) / parseInt(blockResult.gasLimit, 10)) * 100).toFixed(1)}%)`} />
          {blockResult.baseFeePerGas && <Row label="Base Fee Per Gas" value={`${parseFloat(blockResult.baseFeePerGas).toFixed(6)} Gwei`} />}
          {blockResult.difficulty && blockResult.difficulty !== '0' && <Row label="Difficulty" value={blockResult.difficulty} />}
          <Row label="Transactions" value={blockResult.txCount} />
          {blockResult.extraData && blockResult.extraData !== '0x' && (
            <Row label="Extra Data" value={blockResult.extraData} />
          )}

          {blockResult.transactions.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '10px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                {blockResult.transactions.length} TX pertama di block ini
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                {blockResult.transactions.map(t => (
                  <div key={t.hash} className="explorer-row" onClick={() => handleSearch(t.hash)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', background: '#111', border: `1px solid ${COLORS.border}`,
                    fontSize: '11px', cursor: 'pointer', flexWrap: 'wrap',
                  }}>
                    <span style={{ color: COLORS.accent, fontFamily: 'monospace' }}>{shortHash(t.hash, 10, 6)}</span>
                    <span style={{ color: COLORS.muted, fontFamily: 'monospace' }}>
                      {shortHash(t.from, 6, 4)} <FaArrowRight size={9} style={{ margin: '0 4px' }} /> {t.to ? shortHash(t.to, 6, 4) : 'Contract Creation'}
                    </span>
                    <span style={{ color: COLORS.text, fontFamily: 'monospace' }}>{parseFloat(t.value).toFixed(4)} {network.symbol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '14px' }}>
            <div onClick={() => setShowRawBlock(s => !s)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
              fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px',
            }}>
              <FaFileCode /> Raw Block (JSON)
              {showRawBlock ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            </div>
            {showRawBlock && (
              <pre style={{
                marginTop: '8px', background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
                fontSize: '10px', color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                wordBreak: 'break-all', maxHeight: '260px', overflowY: 'auto', position: 'relative',
              }}>
                <FaCopy size={11} style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', color: COLORS.muted }}
                  onClick={() => copyToClipboard(blockResult.rawJson)} title="Copy" />
                {blockResult.rawJson}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ── Latest blocks feed ── */}
      <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid #2196f3`, padding: '18px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#2196f3', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaLayerGroup /> Latest Blocks — {network.name}
            {refreshSettings.enabled && !latestLoading && (
              <span style={{
                fontSize: '9px', fontWeight: 'bold', color: COLORS.green, border: `1px solid ${COLORS.green}`,
                padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', letterSpacing: '0.3px',
              }}>
                <FaSyncAlt size={8} /> live · {refreshSettings.intervalSec}s
              </span>
            )}
          </h3>
          {latestLoading && <FaSpinner className="spin-icon" color="#2196f3" size={12} />}
        </div>
        {latestBlocks.length === 0 ? (
          <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
            {latestLoading ? 'Memuat block terbaru…' : 'Tidak ada data (cek RPC).'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {latestBlocks.map(b => (
              <div key={b.number} onClick={() => openBlock(b.number)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                padding: '9px 12px', background: '#111', border: `1px solid ${COLORS.border}`,
                cursor: 'pointer', flexWrap: 'wrap',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: COLORS.accent, fontFamily: 'monospace', fontWeight: 'bold' }}>
                  <FaCube size={11} /> #{b.number}
                </span>
                <span style={{ fontSize: '11px', color: COLORS.muted }}>{timeAgo(b.timestamp)}</span>
                <span style={{ fontSize: '11px', color: COLORS.text, fontFamily: 'monospace' }}>
                  {b.txCount} txns
                </span>
                <span style={{ fontSize: '11px', color: COLORS.muted, fontFamily: 'monospace' }}>
                  <FaGasPump size={10} style={{ marginRight: 4 }} />{shortHash(b.miner, 6, 4)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {chain === 'gram' && (
      <>
      {/* ── GRAM (TON) network selector ── */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '14px', padding: '12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`,
      }}>
        <FaGlobe color={gramNetwork.color} size={14} />
        <select
          value={gramNetId}
          onChange={e => { setGramNetId(e.target.value); resetGramResults(); setGramQuery(''); }}
          style={{ flex: '1 1 200px', minWidth: '180px' }}
        >
          {GRAM_NETWORKS.map(n => (
            <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>
          ))}
        </select>
      </div>

      {/* ── Statistik Jaringan GRAM — dashboard ringkas gabungan (block
           terkini, harga TON, & jumlah listing Jetton). Gantiin 2 bar
           terpisah yang lama (Status Jaringan + Ticker TON) jadi 1 grid
           compact, biar halaman explorer gak kepanjangan. ── */}
      <div className="fade-in-up" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1px',
        background: COLORS.border, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${gramNetwork.color}`,
        marginBottom: '24px', overflow: 'hidden',
      }}>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FaLayerGroup size={9} /> Block Terkini
            {refreshSettings.enabled && !gramMcLoading && <FaSyncAlt size={7} color={COLORS.green} />}
          </div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: gramNetwork.color }}>
            {gramMcLoading && !gramMcInfo ? <FaSpinner className="spin-icon" size={11} /> : gramMcInfo ? `#${gramMcInfo.latestSeqno.toLocaleString('en-US')}` : '—'}
          </div>
        </div>

        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Harga GRAM</div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>
            {gramTonTickerLoading && !gramTonTicker ? <FaSpinner className="spin-icon" size={11} /> : gramTonTicker?.priceUsd != null ? `$${gramTonTicker.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—'}
          </div>
        </div>

        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Perubahan 24J</div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: (gramTonTicker?.changePct24h ?? 0) >= 0 ? COLORS.green : COLORS.red }}>
            {gramTonTicker?.changePct24h != null ? `${gramTonTicker.changePct24h >= 0 ? '+' : ''}${gramTonTicker.changePct24h.toFixed(2)}%` : '—'}
          </div>
        </div>

        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Market Cap</div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>
            {gramTonTicker?.marketCapUsd != null ? `$${(gramTonTicker.marketCapUsd / 1e9).toFixed(2)}B` : '—'}
          </div>
        </div>

        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Volume 24J</div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>
            {gramTonTicker?.volumeUsd24h != null ? `$${(gramTonTicker.volumeUsd24h / 1e6).toFixed(1)}M` : '—'}
          </div>
        </div>

        {!isGramTestnet(gramNetwork) && (
          <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Jetton Trending</div>
            <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#e8a119' }}>
              {gramTopJettonsLoading && gramTopJettons.length === 0 ? <FaSpinner className="spin-icon" size={11} /> : gramTopJettons.length}
            </div>
          </div>
        )}

        {!isGramTestnet(gramNetwork) && (
          <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Listing Baru</div>
            <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#61dfff' }}>
              {gramNewPoolsLoading && gramNewPools.length === 0 ? <FaSpinner className="spin-icon" size={11} /> : gramNewPools.length}
            </div>
          </div>
        )}
      </div>

      {/* -- Sama seperti panel "Jetton TON": gak relevan lagi begitu ada hasil
           pencarian aktif (address/tx), jadi disembunyikan bareng toggle-nya
           supaya halaman fokus ke hasil pencarian. Muncul lagi begitu hasil
           di-tutup / search baru dijalankan. -- */}
      {!gramAddressResult && !gramTxDetail && (
        <>
          <button onClick={() => setGramMcDetailOpen(p => !p)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            background: 'none', border: `1px dashed ${COLORS.border}`, color: COLORS.muted,
            padding: '8px', cursor: 'pointer', fontSize: '11px', marginBottom: '24px',
          }}>
            {gramMcDetailOpen ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
            {gramMcDetailOpen ? 'Sembunyikan Detail Masterchain' : 'Lihat Detail Masterchain (Block & Transaksi Terbaru)'}
          </button>

          {gramMcDetailOpen && (
            <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${gramNetwork.color}`, padding: '18px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: gramNetwork.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaLayerGroup /> Detail Masterchain
                </h3>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '9px', color: COLORS.muted, letterSpacing: '0.3px' }}>via TonCenter</span>
                  {(gramMcDetailTab === 'blocks' ? gramLatestBlocksLoading : gramMcDetailTab === 'txs' ? gramLatestTxsLoading : gramLatestAccountsLoading) && <FaSpinner className="spin-icon" color={gramNetwork.color} size={12} />}
                </span>
              </div>

              {/* ── Statistik turunan ala explorer TON pada umumnya — TPS &
                   rata-rata block time dari sampel terbaru, plus ringkasan
                   ukuran batch yang lagi ditampilkan. Best-effort/lokal,
                   bukan angka resmi network-wide (lihat catatan di useMemo
                   gramNetworkStats). ── */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '1px',
                background: COLORS.border, border: `1px solid ${COLORS.border}`, marginBottom: '12px', overflow: 'hidden',
              }}>
                <div style={{ background: COLORS.bg, padding: '8px 10px' }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, marginBottom: '3px' }}>TPS (sampel)</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: gramNetwork.color }}>
                    {gramNetworkStats.tps != null ? gramNetworkStats.tps.toFixed(2) : '—'}
                  </div>
                </div>
                <div style={{ background: COLORS.bg, padding: '8px 10px' }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, marginBottom: '3px' }}>Rata2 Block Time</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>
                    {gramNetworkStats.avgBlockTimeSec != null ? `${gramNetworkStats.avgBlockTimeSec.toFixed(1)}s` : '—'}
                  </div>
                </div>
                <div style={{ background: COLORS.bg, padding: '8px 10px' }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, marginBottom: '3px' }}>Block Disampel</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>{gramNetworkStats.blockBatchCount}</div>
                </div>
                <div style={{ background: COLORS.bg, padding: '8px 10px' }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, marginBottom: '3px' }}>Tx Disampel</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>{gramNetworkStats.txBatchCount}</div>
                </div>
                <div style={{ background: COLORS.bg, padding: '8px 10px' }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, marginBottom: '3px' }}>Akun Unik</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>{gramNetworkStats.uniqueAccountsBatch}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                {([
                  ['blocks', 'Block Terbaru'],
                  ['txs', 'Transaksi Terbaru'],
                  ['accounts', 'Akun Terbaru'],
                ] as ['blocks' | 'txs' | 'accounts', string][]).map(([key, label]) => (
                  <button key={key} onClick={() => { setGramMcDetailTab(key); setGramTxTypeFilter(null); setGramAccountTypeFilter(null); }} style={{
                    fontSize: '10px', padding: '5px 10px', cursor: 'pointer',
                    background: gramMcDetailTab === key ? gramNetwork.color : 'none',
                    color: gramMcDetailTab === key ? '#000' : COLORS.muted,
                    border: `1px solid ${gramMcDetailTab === key ? gramNetwork.color : COLORS.border}`,
                    fontWeight: gramMcDetailTab === key ? 'bold' : 'normal',
                  }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Ringkasan distribusi tipe — badge yang bisa diklik buat filter
                   daftar di bawahnya. Muncul cuma di tab yang relevan. ── */}
              {gramMcDetailTab === 'txs' && gramTxTypeCounts.size > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${COLORS.border}` }}>
                  {Array.from(gramTxTypeCounts.entries())
                    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                    .map(([type, count]) => {
                      const info = GRAM_TX_TYPES[type] ?? GRAM_TX_TYPES.other;
                      const active = gramTxTypeFilter === type;
                      return (
                        <button key={type} title={info.description}
                          onClick={() => setGramTxTypeFilter(active ? null : type)}
                          style={{
                            fontSize: '9px', fontWeight: 'bold', cursor: 'pointer',
                            color: active ? '#000' : info.color,
                            background: active ? info.color : 'none',
                            border: `1px solid ${info.color}70`, padding: '3px 8px',
                            display: 'flex', alignItems: 'center', gap: '5px',
                          }}>
                          {info.label} <span style={{ opacity: 0.75 }}>{count}</span>
                        </button>
                      );
                    })}
                  {gramTxTypeFilter && (
                    <button onClick={() => setGramTxTypeFilter(null)} style={{
                      fontSize: '9px', color: COLORS.muted, background: 'none', border: `1px solid ${COLORS.border}`, padding: '3px 8px', cursor: 'pointer',
                    }}>
                      ✕ Reset Filter
                    </button>
                  )}
                </div>
              )}
              {gramMcDetailTab === 'accounts' && gramAccountTypeCounts.size > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${COLORS.border}` }}>
                  {Array.from(gramAccountTypeCounts.entries())
                    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                    .map(([type, count]) => {
                      const info = GRAM_ACCOUNT_TYPES[type] ?? GRAM_ACCOUNT_TYPES.other;
                      const active = gramAccountTypeFilter === type;
                      return (
                        <button key={type} title={info.description}
                          onClick={() => setGramAccountTypeFilter(active ? null : type)}
                          style={{
                            fontSize: '9px', fontWeight: 'bold', cursor: 'pointer',
                            color: active ? '#000' : info.color,
                            background: active ? info.color : 'none',
                            border: `1px solid ${info.color}70`, padding: '3px 8px',
                            display: 'flex', alignItems: 'center', gap: '5px',
                          }}>
                          {info.label} <span style={{ opacity: 0.75 }}>{count}</span>
                        </button>
                      );
                    })}
                  {gramAccountTypeFilter && (
                    <button onClick={() => setGramAccountTypeFilter(null)} style={{
                      fontSize: '9px', color: COLORS.muted, background: 'none', border: `1px solid ${COLORS.border}`, padding: '3px 8px', cursor: 'pointer',
                    }}>
                      ✕ Reset Filter
                    </button>
                  )}
                </div>
              )}

              {gramMcDetailTab === 'blocks' ? (
                gramLatestBlocksError ? (
                  <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{gramLatestBlocksError}</p>
                ) : !gramLatestBlocksLoading && gramLatestBlocks.length === 0 ? (
                  <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Belum ada data block.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {gramLatestBlocks.map((b, idx) => (
                      <div key={`${b.seqno}-${idx}`} className="explorer-row" style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                        background: idx === 0 ? `${gramNetwork.color}0d` : '#111', border: `1px solid ${idx === 0 ? gramNetwork.color + '40' : COLORS.border}`, flexWrap: 'wrap',
                      }}>
                        <FaCube size={13} color={gramNetwork.color} style={{ flexShrink: 0 }} />
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: '110px' }}>
                          <span style={{ fontSize: '12px', color: COLORS.text, fontFamily: 'monospace', fontWeight: 'bold' }}>#{b.seqno.toLocaleString('en-US')}</span>
                          <span style={{ fontSize: '10px', color: COLORS.muted, fontFamily: 'monospace' }}>shard {b.shard}</span>
                        </span>
                        <span style={{ fontSize: '11px', color: COLORS.muted, minWidth: '80px' }}>{b.timestamp ? timeAgo(b.timestamp) : '—'}</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>
                          <span title={b.rootHash}>root {shortHash(b.rootHash, 6, 4)}</span>
                          <span title={b.fileHash}>file {shortHash(b.fileHash, 6, 4)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : gramMcDetailTab === 'txs' ? (
                gramLatestTxsError ? (
                  <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{gramLatestTxsError}</p>
                ) : !gramLatestTxsLoading && gramLatestTxs.length === 0 ? (
                  <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Belum ada data transaksi.</p>
                ) : gramFilteredTxs.length === 0 ? (
                  <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Gak ada transaksi dengan tipe ini di batch sekarang.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {gramFilteredTxs.map((t, idx) => {
                      const txTypeInfo = GRAM_TX_TYPES[t.txType] ?? GRAM_TX_TYPES.other;
                      return (
                      <div key={t.hash || idx} className="explorer-row" style={{
                        display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px',
                        background: '#111', border: `1px solid ${COLORS.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          {t.success ? <FaCheckCircle size={12} color={COLORS.green} style={{ flexShrink: 0 }} /> : <FaTimesCircle size={12} color={COLORS.red} style={{ flexShrink: 0 }} />}
                          <span
                            onClick={() => handleGramResultClick(t.hash)}
                            style={{ cursor: 'pointer', fontSize: '11px', color: COLORS.accent, fontFamily: 'monospace', minWidth: '90px' }}
                            title="Lihat detail transaksi ini"
                          >
                            {shortHash(t.hash, 8, 6)}
                          </span>
                          <span title={txTypeInfo.description} style={{
                            fontSize: '9px', fontWeight: 'bold', color: txTypeInfo.color,
                            border: `1px solid ${txTypeInfo.color}50`, padding: '2px 6px',
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            {txTypeInfo.label}
                          </span>
                          {!t.success && t.computeExitCode !== null && (
                            <span title="Exit code compute phase" style={{
                              fontSize: '9px', fontWeight: 'bold', color: COLORS.red,
                              border: `1px solid ${COLORS.red}50`, padding: '2px 6px', whiteSpace: 'nowrap',
                            }}>
                              exit {t.computeExitCode}
                            </span>
                          )}
                          <span style={{ fontSize: '10px', color: COLORS.muted, display: 'flex', alignItems: 'center', gap: '4px', minWidth: '150px' }}>
                            {t.fromAddress ? shortHash(t.fromAddress, 5, 4) : '—'}
                            <FaArrowRight size={8} />
                            {t.toAddress ? shortHash(t.toAddress, 5, 4) : '—'}
                          </span>
                          <span style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span style={{ fontSize: '11px', color: COLORS.text, fontFamily: 'monospace' }}>
                              {t.amountGram != null ? `${t.amountGram.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${gramNetwork.symbol}` : '—'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#555' }}>{t.timestamp ? timeAgo(t.timestamp) : ''}</span>
                          </span>
                        </div>
                        {/* -- Baris detail teknis: lt, opcode, jumlah pesan keluar, fee, comment.
                             Semuanya opsional (cuma muncul kalau datanya ada), biar baris gak
                             kepanjangan buat tx simpel. -- */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '9px', color: '#555', fontFamily: 'monospace', paddingLeft: '22px' }}>
                          {t.lt && <span title="Logical time">lt {t.lt}</span>}
                          {t.opCode && <span title="Opcode pesan masuk">op {t.opCode}</span>}
                          <span title="Jumlah pesan keluar dari tx ini">{t.outMsgCount} out-msg</span>
                          <span title="Total fee">fee {t.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} {gramNetwork.symbol}</span>
                          {t.accountBalanceAfter !== null && (
                            <span title="Saldo account setelah tx ini">saldo→ {t.accountBalanceAfter.toLocaleString('en-US', { maximumFractionDigits: 4 })} {gramNetwork.symbol}</span>
                          )}
                          {t.comment && <span title="Comment/memo" style={{ color: COLORS.muted, fontFamily: 'inherit' }}>💬 {t.comment.length > 40 ? `${t.comment.slice(0, 40)}…` : t.comment}</span>}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )
              ) : (
                gramLatestAccountsError ? (
                  <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{gramLatestAccountsError}</p>
                ) : !gramLatestAccountsLoading && gramLatestAccounts.length === 0 ? (
                  <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Belum ada data akun.</p>
                ) : gramFilteredAccounts.length === 0 ? (
                  <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Gak ada akun dengan tipe ini di batch sekarang.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {gramFilteredAccounts.map((a, idx) => {
                      const typeInfo = GRAM_ACCOUNT_TYPES[a.accountType] ?? GRAM_ACCOUNT_TYPES.other;
                      const statusInfo = a.status ? GRAM_ACCOUNT_STATUS_LABELS[a.status] : null;
                      return (
                      <div key={a.address || idx} className="explorer-row" style={{
                        display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px',
                        background: '#111', border: `1px solid ${COLORS.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <FaWallet size={12} color={typeInfo.color} style={{ flexShrink: 0 }} />
                          <span
                            onClick={() => handleGramSearch(a.friendlyAddress)}
                            style={{ cursor: 'pointer', fontSize: '11px', color: COLORS.accent, fontFamily: 'monospace', minWidth: '110px' }}
                            title="Lihat detail address ini"
                          >
                            {shortHash(a.friendlyAddress, 8, 6)}
                          </span>
                          <span title={typeInfo.description} style={{
                            fontSize: '9px', fontWeight: 'bold', color: typeInfo.color,
                            border: `1px solid ${typeInfo.color}50`, padding: '2px 6px',
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            {typeInfo.label}
                          </span>
                          {statusInfo && (
                            <span title={`Status kontrak: ${a.status}`} style={{
                              fontSize: '9px', fontWeight: 'bold', color: statusInfo.color,
                              border: `1px solid ${statusInfo.color}50`, padding: '2px 6px', whiteSpace: 'nowrap',
                            }}>
                              {statusInfo.label}
                            </span>
                          )}
                          {a.domain && (
                            <span style={{ fontSize: '10px', color: COLORS.muted }}>{a.domain}</span>
                          )}
                          <span style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span style={{ fontSize: '11px', color: COLORS.text, fontFamily: 'monospace' }}>
                              {a.balanceGram != null ? `${a.balanceGram.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${gramNetwork.symbol}` : '—'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#555' }}>{a.lastSeenAt ? timeAgo(a.lastSeenAt) : ''}</span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '9px', color: '#555', fontFamily: 'monospace', paddingLeft: '22px' }}>
                          {a.lastTxLt && <span title="Logical time transaksi terakhir">lt {a.lastTxLt}</span>}
                          {a.lastTxHash && (
                            <span
                              onClick={() => handleGramSearch(a.lastTxHash!)}
                              style={{ cursor: 'pointer' }}
                              title="Hash transaksi terakhir — klik buat lihat detail tx"
                            >
                              last tx {shortHash(a.lastTxHash, 6, 4)}
                            </span>
                          )}
                          {a.codeHash && <span title="Code hash kontrak">code {shortHash(a.codeHash, 6, 4)}</span>}
                          {a.dataHash && <span title="Data hash kontrak (state saat ini)">data {shortHash(a.dataHash, 6, 4)}</span>}
                          {a.frozenHash && <span title="Frozen hash — kontrak ini sedang frozen" style={{ color: '#ff6666' }}>frozen {shortHash(a.frozenHash, 6, 4)}</span>}
                          {a.getMethodsCount != null && a.getMethodsCount > 0 && (
                            <span title="Jumlah get-method yang terdeteksi di kode kontrak">{a.getMethodsCount} get-method{a.getMethodsCount === 1 ? '' : 's'}</span>
                          )}
                          {a.interfaces.length > 0 && (
                            <span title="Semua interface yang terdeteksi">iface: {a.interfaces.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )
              )}

              <p style={{ fontSize: '10px', color: '#333', margin: '10px 0 0' }}>
                {gramMcDetailTab === 'blocks'
                  ? 'Block terbaru di masterchain (workchain -1) — acuan block utama yang juga dipakai Tonscan.'
                  : gramMcDetailTab === 'txs'
                  ? 'Feed transaksi terbaru lintas workchain (bukan cuma dari 1 address). Tipe transaksi dari TonCenter Actions API, klik badge tipe di atas buat filter. Klik hash buat lihat detail lengkapnya.'
                  : 'Akun unik yang nongol di feed transaksi terbaru, diklasifikasi dari interface & status kontrak otoritatif TonCenter (accountStates). Klik badge tipe buat filter, klik address buat lihat detail lengkap.'}
                {' '}TPS & rata-rata block time dihitung lokal dari batch di atas (bukan statistik resmi network-wide) — semakin banyak block/tx yang di-fetch, semakin representatif angkanya.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Search bar GRAM ── */}
      <form onSubmit={handleGramSearch} style={{ marginBottom: '24px' }}>
        <div className="search-input-wrapper" style={{ display: 'flex' }}>
          <FaSearch className="search-icon" />
          <input
            type="search"
            placeholder="Address Gram (UQ... / EQ...) / TX Hash"
            value={gramQuery}
            onChange={e => setGramQuery(e.target.value)}
            style={{ color: '#fff' }}
          />
        </div>
        <button type="submit" disabled={gramLoading} style={{ width: '100%', marginTop: '10px' }}>
          {gramLoading ? <><FaSpinner className="spin-icon" /> Mencari…</> : <><FaSearch /> Cari</>}
        </button>
      </form>

      {gramError && (
        <div style={{
          background: 'rgba(255,51,51,0.07)', border: '1px solid #ff333344', borderLeft: '3px solid #ff3333',
          padding: '12px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <FaExclamationTriangle color="#ff3333" size={13} />
          <span style={{ color: '#ff6666', fontSize: '12px' }}>{gramError}</span>
        </div>
      )}

      {/* ── JETTON TON — panel gabungan leaderboard Jetton (sumber data:
           GeckoTerminal, bukan TonCenter). Gabung "Top Jetton" (trending/
           gainer/loser/volume, re-sort client-side) & "Jetton Baru" (pool
           baru listing) jadi 1 panel + tab, biar halaman explorer gak
           kepanjangan gara-gara 2 panel besar berdampingan. Panel ini
           persisten (gak butuh search dulu), mirip semangatnya "Latest
           Blocks" feed di sisi EVM. Cuma ditampilkan di mainnet --
           GeckoTerminal gak nge-index TON testnet. ── */}
      {/* -- Panel ini cuma relevan waktu user lagi "browsing" (belum cari
           address/contract/tx apa pun). Begitu ada hasil pencarian aktif
           (gramAddressResult / gramJettonInfo / gramTxDetail), sembunyikan
           biar halaman gak kepanjangan & fokus user langsung ke hasil yang
           dia cari, bukan ke leaderboard yang gak nyambung lagi. -- */}
      {!isGramTestnet(gramNetwork) && !gramAddressResult && !gramTxDetail && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${gramJettonTab === 'new' ? '#61dfff' : '#e8a119'}`, padding: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: gramJettonTab === 'new' ? '#61dfff' : '#e8a119', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {gramJettonTab === 'new' ? <FaPlus /> : <FaBolt />} Jetton GRAM
            </h3>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9px', color: COLORS.muted, letterSpacing: '0.3px' }}>via GeckoTerminal</span>
              {gramJettonPanelLoading && <FaSpinner className="spin-icon" color={gramJettonTab === 'new' ? '#61dfff' : '#e8a119'} size={12} />}
            </span>
          </div>

          {/* -- Tab: 4 opsi pertama murni re-sort data yang sama di client
               (gak nambah request ke GeckoTerminal), "Baru Listing" pakai
               sumber data terpisah (new_pools). -- */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {([
              ['trending', 'Trending'],
              ['gainers', 'Top Gainer'],
              ['losers', 'Top Loser'],
              ['volume', 'Volume Tertinggi'],
              ['new', 'Baru Listing'],
            ] as [GramJettonTab, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setGramJettonTab(key)} style={{
                fontSize: '10px', padding: '5px 10px', cursor: 'pointer',
                background: gramJettonTab === key ? (key === 'new' ? '#61dfff' : '#e8a119') : 'none',
                color: gramJettonTab === key ? '#000' : COLORS.muted,
                border: `1px solid ${gramJettonTab === key ? (key === 'new' ? '#61dfff' : '#e8a119') : COLORS.border}`,
                fontWeight: gramJettonTab === key ? 'bold' : 'normal',
              }}>
                {label}
              </button>
            ))}
          </div>

          {gramJettonPanelError ? (
            <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{gramJettonPanelError}</p>
          ) : !gramJettonPanelLoading && gramJettonPanelList.length === 0 ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              {gramJettonTab === 'new' ? 'Belum ada pool baru terdeteksi.' : 'Tidak ada data trending saat ini.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {gramJettonPanelVisible.map((j, idx) => {
                const rankColors = ['#f3ba2f', '#aaaaaa', '#cd7f32'];
                return (
                  <div key={j.poolAddress || idx} className="explorer-row" style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                    background: '#111', border: `1px solid ${COLORS.border}`, flexWrap: 'wrap',
                  }}>
                    <span style={{
                      width: '20px', height: '20px', flexShrink: 0,
                      background: gramJettonTab === 'new' ? '#2a2a2a' : (rankColors[idx] ?? '#2a2a2a'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 'bold', color: gramJettonTab !== 'new' && idx < 3 ? '#000' : '#888',
                    }}>
                      {idx + 1}
                    </span>
                    {j.imageUrl
                      ? <img src={j.imageUrl} alt="" width={22} height={22} style={{ borderRadius: '50%', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                      : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#555', fontWeight: 'bold' }}>
                          {(j.symbol ?? '??').slice(0, 2).toUpperCase()}
                        </div>}
                    <span
                      onClick={() => j.tokenAddress && handleGramResultClick(j.tokenAddress)}
                      style={{ cursor: j.tokenAddress ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', minWidth: '90px' }}
                      title={j.tokenAddress ? 'Lihat detail kontrak Jetton ini' : undefined}
                    >
                      <span style={{ fontSize: '12px', color: COLORS.text, fontWeight: 'bold' }}>{j.symbol ?? '???'}</span>
                      <span style={{ fontSize: '10px', color: COLORS.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {j.name ?? '—'}{j.dexName ? ` · ${j.dexName}` : ''}
                      </span>
                    </span>

                    <span style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span style={{ fontSize: '12px', color: COLORS.text, fontFamily: 'monospace' }}>
                        {j.priceUsd != null ? `$${j.priceUsd < 0.01 ? j.priceUsd.toPrecision(4) : j.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—'}
                      </span>
                      {gramJettonTab === 'new' ? (
                        j.poolCreatedAt != null && (
                          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#61dfff' }}>{timeAgo(j.poolCreatedAt)}</span>
                        )
                      ) : (
                        j.priceChangePct24h != null && (
                          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: j.priceChangePct24h >= 0 ? COLORS.green : COLORS.red }}>
                            {j.priceChangePct24h >= 0 ? '+' : ''}{j.priceChangePct24h.toFixed(2)}%
                          </span>
                        )
                      )}
                    </span>

                    <span style={{ fontSize: '10px', color: COLORS.muted, fontFamily: 'monospace', minWidth: '80px', textAlign: 'right' }}>
                      {gramJettonTab === 'new'
                        ? (j.liquidityUsd != null ? `Liq $${j.liquidityUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '')
                        : (j.volumeUsd24h != null ? `Vol $${j.volumeUsd24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '')}
                    </span>

                    <a href={j.poolUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.accent, flexShrink: 0 }} title="Lihat pool di GeckoTerminal">
                      <FaExternalLinkAlt size={11} />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* -- Tampilkan Semua / Ringkas -- defaultnya cuma 5 baris biar
               panel gak dorong konten lain terlalu jauh ke bawah. -- */}
          {gramJettonPanelList.length > 5 && (
            <button onClick={() => setGramJettonShowAll(p => !p)} style={{
              width: '100%', marginTop: '10px', background: 'none', border: `1px solid ${COLORS.border}`,
              color: COLORS.muted, padding: '7px', cursor: 'pointer', fontSize: '11px',
            }}>
              {gramJettonShowAll ? <><FaChevronUp size={9} style={{ marginRight: 5 }} /> Tampilkan Lebih Sedikit</>
                : <><FaChevronDown size={9} style={{ marginRight: 5 }} /> Tampilkan Semua ({gramJettonPanelList.length})</>}
            </button>
          )}

          <p style={{ fontSize: '10px', color: '#333', margin: '10px 0 0' }}>
            {gramJettonTab === 'gainers' && 'Diurut dari kenaikan harga 24 jam tertinggi.'}
            {gramJettonTab === 'losers' && 'Diurut dari penurunan harga 24 jam terdalam.'}
            {gramJettonTab === 'volume' && 'Diurut dari volume trading 24 jam tertinggi.'}
            {gramJettonTab === 'trending' && 'Diranking berdasar pool DEX paling trending 24 jam terakhir (volume & aktivitas on-chain).'}
            {gramJettonTab === 'new' && 'Pool DEX paling baru dibuat di GRAM (bukan berarti proyeknya baru — bisa juga pool baru dari token lama). Selalu DYOR — resiko rugpull/honeypot jauh lebih tinggi di sini.'}
            {gramJettonTab !== 'new' && <> Klik simbol Jetton buat lihat detail kontraknya di Explorer, atau ikon <FaExternalLinkAlt size={8} style={{ margin: '0 2px' }} /> buat buka pool-nya di GeckoTerminal.</>}
          </p>
        </div>
      )}

      {/* -- Anchor scroll: target `scrollToGramResults()` waktu klik row Jetton
           di panel atas — biar hasil pencarian (address/jetton) langsung
           kelihatan di viewport tanpa geser manual. `scrollMarginTop` biar
           gak ketutup header sticky pas scrollIntoView. -- */}
      <div ref={gramResultsAnchorRef} style={{ scrollMarginTop: '80px' }} />

      {/* ── GRAM ADDRESS RESULT ── */}
      {gramAddressResult && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${gramNetwork.color}`, padding: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: gramNetwork.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaWallet /> Wallet Address (GRAM)
            </h3>
            {/* -- Balik ke leaderboard "Jetton GRAM" / Detail Masterchain DAN
                 balik ke halaman utama Explorer (bersihin address dari URL),
                 bukan cuma bersihin state lokal tab GRAM. -- */}
            <button type="button" onClick={() => { resetGramResults(); setGramQuery(''); navigate('/explorer', { replace: true }); }} style={{
              fontSize: '10px', color: COLORS.muted, background: 'none', border: `1px solid ${COLORS.border}`,
              padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <FaTimesCircle size={10} /> Tutup & Kembali
            </button>
          </div>
          <Row label="Address" value={shortHash(gramAddressResult.address, 10, 8)} copy={gramAddressResult.address} />
          {(() => {
            const fmt = gramAddressFormats(gramAddressResult.address, gramNetwork);
            return (
              <>
                <Row label="Bounceable (EQ/kQ)" value={shortHash(fmt.bounceable, 10, 8)} copy={fmt.bounceable} />
                <Row label="Non-bounceable (UQ/0Q)" value={shortHash(fmt.nonBounceable, 10, 8)} copy={fmt.nonBounceable} />
                <Row label="Raw" value={shortHash(fmt.raw, 10, 8)} copy={fmt.raw} />
                <p style={{ fontSize: '10px', color: COLORS.muted, margin: '6px 0 0' }}>
                  Pakai <b>Non-bounceable</b> buat terima dana dari wallet biasa/exchange. <b>Bounceable</b> umumnya
                  buat address kontrak (mis. Jetton master) atau interaksi antar-kontrak.
                </p>
              </>
            );
          })()}
          <Row label="Status" value={
            <span style={{
              color: gramAddressResult.status === 'active' ? COLORS.green
                : gramAddressResult.status === 'frozen' ? COLORS.red : COLORS.amber,
              fontWeight: 'bold',
            }}>
              {gramAddressResult.status.toUpperCase()}
            </span>
          } mono={false} />
          <Row label="Balance" value={
            <span>
              {gramAddressResult.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} GRAM
              {gramAddressResult.balanceUsd != null && (
                <span style={{ color: COLORS.muted, marginLeft: '6px' }}>
                  (${gramAddressResult.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              )}
            </span>
          } />
          <Row label="Tipe Kontrak" value={
            gramAddressResult.walletVersionGuess === 'unknown'
              ? (gramAddressResult.status === 'uninitialized'
                  ? (gramAddressResult.balance > 0 ? 'Belum Deploy (Sudah Ada Saldo)' : 'Belum Deploy (Belum Ada Saldo)')
                  : 'Kontrak Lain / Bukan Wallet Standar')
              : (GRAM_WALLET_VERSIONS.find(v => v.id === gramAddressResult.walletVersionGuess)?.label ?? gramAddressResult.walletVersionGuess)
          } mono={false} />
          {gramAddressResult.seqno !== null && (
            <Row label="Seqno" value={String(gramAddressResult.seqno)} />
          )}
          {gramAddressResult.codeHash && (
            <Row label="Code Hash" value={shortHash(gramAddressResult.codeHash, 10, 8)} copy={gramAddressResult.codeHash} />
          )}
          {gramAddressResult.dataHash && (
            <Row label="Data Hash" value={shortHash(gramAddressResult.dataHash, 10, 8)} copy={gramAddressResult.dataHash} />
          )}
          {gramAddressResult.lastTxHash && (
            <Row label="TX Terakhir" value={
              <span
                onClick={() => handleGramSearch(gramTxHashToHex(gramAddressResult.lastTxHash!))}
                style={{ cursor: 'pointer', color: gramNetwork.color }}
                title="Lihat detail transaksi ini"
              >
                {shortHash(gramTxHashToHex(gramAddressResult.lastTxHash), 10, 8)}
              </span>
            } copy={gramTxHashToHex(gramAddressResult.lastTxHash)} />
          )}
          {gramAddressResult.blockSeqno !== null && (
            <Row label="Block Ref. (mc)" value={`#${gramAddressResult.blockSeqno.toLocaleString('en-US')}`} />
          )}

          {gramAddressResult.activationNote && (
            <div style={{
              background: '#1a1608', border: '1px solid #4a3f10', padding: '10px 12px', margin: '12px 0 0',
              display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#ffaa00', fontSize: '11px',
            }}>
              <FaExclamationTriangle size={11} style={{ marginTop: '1px', flexShrink: 0 }} />
              <span>{gramAddressResult.activationNote}</span>
            </div>
          )}

          {/* ── Token Holdings (Jetton) ── */}
          <h4 style={{ margin: '18px 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: COLORS.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaCoins /> Token Holdings (Jetton)
            {gramTokensLoading && <FaSpinner className="spin-icon" size={11} />}
          </h4>
          {gramTokensError ? (
            <p style={{ color: COLORS.red, fontSize: '11px', margin: 0 }}>{gramTokensError}</p>
          ) : gramTokens.length === 0 && !gramTokensLoading ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '10px 0', margin: 0 }}>
              Tidak ada Jetton yang terdeteksi.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
              {gramTokens.map(tok => (
                <div key={tok.address} className="explorer-row" onClick={() => handleGramSearch(tok.address)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', background: '#111', border: `1px solid ${COLORS.border}`,
                  cursor: 'pointer', flexWrap: 'wrap',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {tok.logo && <img src={tok.logo} alt="" width={18} height={18} style={{ borderRadius: '50%', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />}
                    <span style={{ fontSize: '12px', color: COLORS.text, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tok.name}</span>
                    <span style={{ fontSize: '11px', color: COLORS.muted }}>({tok.symbol})</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', color: COLORS.text, fontFamily: 'monospace' }}>
                      {tok.balanceFormatted}
                    </span>
                    {tok.usdValue != null && (
                      <span style={{ fontSize: '10px', color: COLORS.muted, fontFamily: 'monospace' }}>
                        ${tok.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {(gramAddressResult.balanceUsd != null || gramTokens.some(t => t.usdValue != null)) && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', border: `1px dashed ${COLORS.border}`, marginTop: '2px',
                }}>
                  <span style={{ fontSize: '10px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <FaChartLine size={9} style={{ marginRight: '5px' }} /> Estimasi Total Portfolio
                  </span>
                  <span style={{ fontSize: '13px', color: gramNetwork.color, fontFamily: 'monospace', fontWeight: 'bold' }}>
                    ${((gramAddressResult.balanceUsd ?? 0) + gramTokens.reduce((sum, t) => sum + (t.usdValue ?? 0), 0))
                      .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Jetton Contract Detail — digabung ke kartu Wallet Address
               (bukan kartu terpisah lagi), muncul kalau address yang dicari
               ternyata Jetton Master (bukan wallet biasa). Ala Token Page di
               sisi EVM: metadata, supply, admin, & daftar top holder. ── */}
          {(gramJettonInfoLoading || gramJettonInfo) && (
            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: `1px dashed ${COLORS.border}` }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#e8a119', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaTag /> Jetton Contract Detail
                {gramJettonInfoLoading && <FaSpinner className="spin-icon" size={11} />}
              </h4>

              {gramJettonInfoLoading ? (
                <p style={{ color: COLORS.muted, fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Mendeteksi apakah address ini Jetton Master…
                </p>
              ) : gramJettonInfo && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    {gramJettonInfo.imageUrl
                      ? <img src={gramJettonInfo.imageUrl} alt="" width={36} height={36} style={{ borderRadius: '50%', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                      : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#555', fontWeight: 'bold' }}>
                          {(gramJettonInfo.symbol ?? '??').slice(0, 2).toUpperCase()}
                        </div>}
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {gramJettonInfo.name ?? 'Unknown Jetton'}
                        {gramJettonInfo.symbol && <span style={{ color: COLORS.muted, fontWeight: 'normal', fontSize: '13px' }}>({gramJettonInfo.symbol})</span>}
                      </div>
                      <span style={{
                        fontSize: '9px', fontWeight: 'bold', color: '#e8a119', border: '1px solid #e8a119',
                        padding: '2px 6px', marginTop: '4px', display: 'inline-block',
                      }}>
                        JETTON
                      </span>
                    </div>
                  </div>

                  {gramJettonInfo.description && (
                    <p style={{ fontSize: '12px', color: COLORS.muted, margin: '0 0 14px', lineHeight: 1.5 }}>{gramJettonInfo.description}</p>
                  )}

                  <Row label="Jetton Master" value={shortHash(gramJettonInfo.address, 10, 8)} copy={gramJettonInfo.address}
                    link={`${gramNetwork.explorerUrl}/address/${gramJettonInfo.address}`} />
                  <Row label="Decimals" value={gramJettonInfo.decimals} />
                  <Row label="Total Supply" value={`${parseFloat(gramJettonInfo.totalSupplyFormatted).toLocaleString('en-US', { maximumFractionDigits: 6 })}${gramJettonInfo.symbol ? ' ' + gramJettonInfo.symbol : ''}`} />
                  <Row label="Mintable" value={
                    <span style={{ color: gramJettonInfo.mintable ? COLORS.amber : COLORS.green, fontWeight: 'bold' }}>
                      {gramJettonInfo.mintable ? 'YA' : 'TIDAK'}
                    </span>
                  } mono={false} />
                  {gramJettonInfo.adminAddress && (
                    <Row label="Admin Address" value={
                      <span
                        onClick={() => {
                          const friendly = safeGramFmt(gramJettonInfo.adminAddress, gramNetwork)?.nonBounceable ?? gramJettonInfo.adminAddress!;
                          handleGramSearch(friendly);
                        }}
                        style={{ cursor: 'pointer', color: gramNetwork.color }}
                        title="Lihat detail address ini"
                      >
                        {shortHash(safeGramFmt(gramJettonInfo.adminAddress, gramNetwork)?.nonBounceable ?? gramJettonInfo.adminAddress, 10, 8)}
                      </span>
                    } copy={gramJettonInfo.adminAddress} />
                  )}

                  {/* ── Top Holders Jetton ── */}
                  <h4 style={{ margin: '18px 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: COLORS.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaUsers /> Top Holders{gramJettonHolders.length > 0 ? ` (${gramJettonHolders.length})` : ''}
                    {gramJettonHoldersLoading && <FaSpinner className="spin-icon" size={11} />}
                  </h4>
                  {gramJettonHoldersError ? (
                    <p style={{ color: COLORS.red, fontSize: '11px', margin: 0 }}>{gramJettonHoldersError}</p>
                  ) : !gramJettonHoldersLoading && gramJettonHolders.length === 0 ? (
                    <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '10px 0', margin: 0 }}>
                      Belum ada data holder.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {gramJettonHolders.map((h, idx) => {
                        const rankColors = ['#f3ba2f', '#aaaaaa', '#cd7f32'];
                        const friendly = safeGramFmt(h.address, gramNetwork)?.nonBounceable ?? h.address;
                        return (
                          <div key={h.address} className="explorer-row" onClick={() => handleGramSearch(friendly)} style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                            background: '#111', border: `1px solid ${COLORS.border}`, cursor: 'pointer', flexWrap: 'wrap',
                          }}>
                            <span style={{
                              width: '20px', height: '20px', flexShrink: 0,
                              background: rankColors[idx] ?? '#2a2a2a',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '10px', fontWeight: 'bold', color: idx < 3 ? '#000' : '#888',
                            }}>
                              {idx + 1}
                            </span>
                            <span style={{ color: COLORS.text, fontFamily: 'monospace', fontSize: '11px' }}>{shortHash(friendly, 8, 6)}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '11px', fontFamily: 'monospace', color: COLORS.text }}>
                              {parseFloat(h.balanceFormatted || '0').toLocaleString('en-US', { maximumFractionDigits: 4 })}{gramJettonInfo.symbol ? ` ${gramJettonInfo.symbol}` : ''}
                            </span>
                            {h.percentage != null && (
                              <span style={{ fontSize: '10px', color: '#e8a119', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{h.percentage.toFixed(2)}%</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Transaksi Terakhir ── */}
          <h4 style={{ margin: '18px 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: COLORS.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaHistory /> Transaksi Terakhir
            {gramTxsLoading && <FaSpinner className="spin-icon" size={11} />}
          </h4>
          {gramTxsError && (
            <p style={{ color: COLORS.red, fontSize: '11px', margin: '0 0 10px' }}>{gramTxsError}</p>
          )}
          {gramTxs.length === 0 && !gramTxsLoading ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              Belum ada riwayat transaksi.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {gramTxs.map(t => (
                <div key={t.hash} className="explorer-row" onClick={() => handleGramSearch(t.hash)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', background: '#111', border: `1px solid ${COLORS.border}`,
                  cursor: 'pointer', flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 'bold', flexShrink: 0,
                    color: !t.success ? COLORS.red : t.direction === 'in' ? COLORS.green : t.direction === 'out' ? COLORS.red : COLORS.muted,
                    border: `1px solid ${!t.success ? COLORS.red : t.direction === 'in' ? COLORS.green : t.direction === 'out' ? COLORS.red : COLORS.muted}`,
                    padding: '2px 6px',
                  }}>
                    {!t.success ? 'FAILED' : t.direction === 'in' ? 'IN' : t.direction === 'out' ? 'OUT' : '?'}
                  </span>
                  <span style={{ fontSize: '11px', color: COLORS.text, fontFamily: 'monospace', flexShrink: 0 }}>
                    {t.amountGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} GRAM
                  </span>
                  <span
                    style={{ fontSize: '11px', color: COLORS.muted, fontFamily: 'monospace', flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}
                  >
                    {t.counterparty ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          const friendly = safeGramFmt(t.counterparty, gramNetwork)?.nonBounceable ?? t.counterparty;
                          handleGramSearch(friendly);
                        }}
                        title={`Lihat detail address ini · Raw: ${t.counterparty}`}
                        style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {shortHash(safeGramFmt(t.counterparty, gramNetwork)?.nonBounceable ?? t.counterparty, 8, 6)}
                      </span>
                    ) : (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>—</span>
                    )}
                    {t.counterparty && (
                      <FaCopy
                        size={10}
                        style={{ cursor: 'pointer', flexShrink: 0, color: COLORS.muted }}
                        title="Copy address"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(safeGramFmt(t.counterparty, gramNetwork)?.nonBounceable ?? t.counterparty);
                        }}
                      />
                    )}
                  </span>
                  {t.comment && (
                    <span style={{ fontSize: '10px', color: COLORS.muted, fontStyle: 'italic', flexShrink: 0 }}>
                      "{t.comment}"
                    </span>
                  )}
                  <span style={{ fontSize: '10px', color: COLORS.muted, flexShrink: 0 }}>
                    {t.timestamp ? timeAgo(t.timestamp) : ''}
                  </span>
                </div>
              ))}
              {gramTxNextBeforeLt && (
                <button type="button" onClick={loadMoreGramTxs} disabled={gramTxLoadingMore} style={{
                  marginTop: '4px', padding: '9px', background: 'none', border: `1px solid ${COLORS.border}`,
                  color: COLORS.muted, cursor: 'pointer', fontSize: '11px',
                }}>
                  {gramTxLoadingMore ? <><FaSpinner className="spin-icon" /> Memuat…</> : 'Muat Lebih Banyak'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── GRAM TX DETAIL — decode inline lewat TonCenter v3 (hash → tx), termasuk
           status compute phase & exit code, mirip panel detail TX di sisi EVM. ── */}
      {gramTxDetail && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${gramNetwork.color}`, padding: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: gramNetwork.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaExchangeAlt /> Transaksi GRAM
            </h3>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 'bold',
              color: gramTxDetail.success ? COLORS.green : COLORS.red,
              border: `1px solid ${gramTxDetail.success ? COLORS.green : COLORS.red}`, padding: '3px 8px',
            }}>
              {gramTxDetail.success ? <FaCheckCircle size={11} /> : <FaTimesCircle size={11} />}
              {gramTxDetail.success ? 'Success' : 'Failed'}
            </span>
            <button type="button" onClick={() => { resetGramResults(); setGramQuery(''); navigate('/explorer', { replace: true }); }} style={{
              fontSize: '10px', color: COLORS.muted, background: 'none', border: `1px solid ${COLORS.border}`,
              padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <FaTimesCircle size={10} /> Tutup & Kembali
            </button>
          </div>
          <Row label="TX Hash" value={shortHash(gramTxDetail.hash, 10, 8)} copy={gramTxDetail.hash} />
          <Row label="Waktu" value={gramTxDetail.timestamp ? new Date(gramTxDetail.timestamp * 1000).toLocaleString('id-ID') : '—'} mono={false} />
          <Row label="Logical Time (lt)" value={gramTxDetail.lt || '—'} />
          <Row label="Arah" value={
            <span style={{ color: gramTxDetail.direction === 'in' ? COLORS.green : gramTxDetail.direction === 'out' ? COLORS.red : COLORS.muted, fontWeight: 'bold' }}>
              {gramTxDetail.direction === 'in' ? 'MASUK (IN)' : gramTxDetail.direction === 'out' ? 'KELUAR (OUT)' : 'TIDAK DIKETAHUI'}
            </span>
          } mono={false} />
          {gramTxDetail.fromAddress && (() => {
            const fmt = safeGramFmt(gramTxDetail.fromAddress, gramNetwork);
            const friendly = fmt?.nonBounceable ?? gramTxDetail.fromAddress;
            return (
              <>
                <Row label="From" value={
                  <span
                    onClick={() => handleGramSearch(friendly)}
                    style={{ cursor: 'pointer', color: gramNetwork.color }}
                    title="Lihat detail address ini"
                  >
                    {shortHash(friendly, 10, 8)}
                  </span>
                } copy={friendly} />
                <Row label="From (Raw)" value={shortHash(gramTxDetail.fromAddress, 10, 8)} copy={gramTxDetail.fromAddress} />
              </>
            );
          })()}
          {gramTxDetail.toAddress && (() => {
            const fmt = safeGramFmt(gramTxDetail.toAddress, gramNetwork);
            const friendly = fmt?.nonBounceable ?? gramTxDetail.toAddress;
            return (
              <>
                <Row label="To" value={
                  <span
                    onClick={() => handleGramSearch(friendly)}
                    style={{ cursor: 'pointer', color: gramNetwork.color }}
                    title="Lihat detail address ini"
                  >
                    {shortHash(friendly, 10, 8)}
                  </span>
                } copy={friendly} />
                <Row label="To (Raw)" value={shortHash(gramTxDetail.toAddress, 10, 8)} copy={gramTxDetail.toAddress} />
              </>
            );
          })()}
          <Row label="Jumlah" value={`${gramTxDetail.amountGram.toLocaleString('en-US', { maximumFractionDigits: 9 })} GRAM`} />
          <Row label="Total Fee" value={`${gramTxDetail.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 9 })} GRAM`} />
          {gramTxDetail.comment && <Row label="Comment / Memo" value={gramTxDetail.comment} mono={false} />}
          {gramTxDetail.computeSuccess !== null && (
            <Row label="Compute Phase" value={
              <span style={{ color: gramTxDetail.computeSuccess ? COLORS.green : COLORS.red, fontWeight: 'bold' }}>
                {gramTxDetail.computeSuccess ? 'SUCCESS' : `FAILED${gramTxDetail.exitCode !== null ? ` (exit code ${gramTxDetail.exitCode})` : ''}`}
              </span>
            } mono={false} />
          )}
          <Row label="Out Messages" value={String(gramTxDetail.outMsgsCount)} />
          {(gramTxDetail.origStatus || gramTxDetail.endStatus) && (
            <Row label="Status Akun" value={
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: COLORS.muted }}>{gramTxDetail.origStatus ?? '—'}</span>
                <FaArrowRight size={10} style={{ color: COLORS.muted }} />
                <span style={{ color: gramTxDetail.endStatus === 'active' ? COLORS.green : COLORS.text, fontWeight: 'bold' }}>
                  {gramTxDetail.endStatus ?? '—'}
                </span>
              </span>
            } mono={false} />
          )}

          {/* ── Breakdown Fee — rincian per fase dari totalFeeGram di atas ── */}
          <h4 style={{ margin: '18px 0 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: COLORS.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaGasPump /> Breakdown Fee
          </h4>
          {gramTxDetail.storageFeeGram !== null && (
            <Row label="Storage Fee" value={`${gramTxDetail.storageFeeGram.toLocaleString('en-US', { maximumFractionDigits: 9 })} GRAM`} />
          )}
          {gramTxDetail.computeFeeGram !== null && (
            <Row label="Compute Fee" value={`${gramTxDetail.computeFeeGram.toLocaleString('en-US', { maximumFractionDigits: 9 })} GRAM`} />
          )}
          {gramTxDetail.gasUsed !== null && (
            <Row label="Gas Used" value={gramTxDetail.gasUsed.toLocaleString('en-US')} />
          )}
          {gramTxDetail.forwardFeeGram !== null && (
            <Row label="Forward Fee" value={`${gramTxDetail.forwardFeeGram.toLocaleString('en-US', { maximumFractionDigits: 9 })} GRAM`} />
          )}
          {gramTxDetail.actionFeeGram !== null && (
            <Row label="Action Fee" value={`${gramTxDetail.actionFeeGram.toLocaleString('en-US', { maximumFractionDigits: 9 })} GRAM`} />
          )}

          <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowGramTxRaw(s => !s)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px',
              background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: '8px 12px', cursor: 'pointer',
            }}>
              <FaFileCode size={11} /> {showGramTxRaw ? 'Sembunyikan Raw JSON' : 'Lihat Raw JSON'}
            </button>
          </div>
          {showGramTxRaw && (
            <pre style={{
              marginTop: '10px', background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
              fontSize: '10px', color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
              wordBreak: 'break-all', maxHeight: '300px', overflowY: 'auto', position: 'relative',
            }}>
              <FaCopy size={11} style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', color: COLORS.muted }}
                onClick={() => copyToClipboard(gramTxDetail.rawJson)} title="Copy" />
              {gramTxDetail.rawJson}
            </pre>
          )}
        </div>
      )}

      {/* ── GRAM TX NOT FOUND — hash valid tapi TonCenter gak nemu txnya (mis. belum
           terindex / node berbeda). ── */}
      {gramTxNotFound && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${COLORS.amber}`, padding: '18px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: COLORS.amber, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaExclamationTriangle /> Transaksi Tidak Ditemukan
          </h3>
          <Row label="TX Hash" value={shortHash(gramTxNotFound, 10, 8)} copy={gramTxNotFound} />
          <p style={{ fontSize: '11px', color: COLORS.muted, margin: '10px 0 0' }}>
            TonCenter belum mengindeks transaksi ini, atau hash-nya salah.
          </p>
        </div>
      )}

      </>
      )}

      {chain === 'ase' && (
      <>
      {/* ── Network selector ASE ── */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '14px', padding: '12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`,
      }}>
        <AsentumLogo size={18} />
        <select value={aseNetId} onChange={e => { setAseNetId(e.target.value); resetAseResults(); }}
          style={{ background: '#111', color: '#ddd', border: `1px solid ${COLORS.border}`, padding: '6px 10px', fontSize: '12px' }}>
          {ASENTUM_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <span style={{ fontSize: '10px', color: COLORS.muted }}>
          Chain post-quantum testnet.
        </span>

      </div>

      {/* ── Status Jaringan ASE — height, mempool size, chain id. Auto refresh
           kalau refreshSettings.enabled, sama seperti panel GRAM di atas.
           Ada indikator "chain mungkin macet" kalau height gak berubah
           beberapa siklus refresh berturut-turut (lihat catatan bug #5 di
           Asentumnet.ts — testnet ini pernah beneran freeze). ── */}
      <div className="fade-in-up" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1px',
        background: COLORS.border, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #836EFD',
        marginBottom: '14px', overflow: 'hidden',
      }}>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FaLayerGroup size={9} /> Block Terkini
            {refreshSettings.enabled && !aseChainStatusLoading && <FaSyncAlt size={7} color={COLORS.green} />}
          </div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#836EFD' }}>
            {aseChainStatusLoading && !aseChainStatus ? <FaSpinner className="spin-icon" size={11} /> : aseChainStatus?.height != null ? `#${aseChainStatus.height.toLocaleString('en-US')}` : '—'}
          </div>
        </div>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Mempool</div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: (aseChainStatus?.mempoolSize ?? 0) > 200 ? COLORS.red : COLORS.text }}>
            {aseChainStatusLoading && !aseChainStatus ? <FaSpinner className="spin-icon" size={11} /> : aseChainStatus?.mempoolSize != null ? aseChainStatus.mempoolSize.toLocaleString('en-US') : '—'}
          </div>
        </div>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Chain ID</div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text }}>
            {aseChainStatus?.chainId ?? '—'}
          </div>
        </div>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Status</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: aseHeightStalledSince ? COLORS.red : COLORS.green, display: 'flex', alignItems: 'center', gap: '5px' }}>
            {aseChainStatusError ? <><FaExclamationTriangle size={10} /> Error</> : aseHeightStalledSince ? <><FaExclamationTriangle size={10} /> Mungkin Macet</> : <><FaCheckCircle size={10} /> Lancar</>}
          </div>
        </div>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Base Fee</div>
          <div title={aseChainStatus?.baseFeePerGas != null ? `${aseChainStatus.baseFeePerGas} wei per gas` : undefined}
            style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {aseChainStatus?.baseFeePerGas != null ? `${formatAseGwei(aseChainStatus.baseFeePerGas)} Gwei` : '—'}
          </div>
          {aseChainStatus?.baseFeePerGas != null && (
            <div style={{ fontSize: '9px', color: COLORS.muted, marginTop: '3px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {aseChainStatus.baseFeePerGas} wei
            </div>
          )}
        </div>
        {(() => {
          const tiers = asentumFeeTiers(aseChainStatus?.baseFeePerGas);
          return (
            <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Est. Fee Transfer</div>
              <div
                title={tiers ? `${Number(tiers.gasLimit).toLocaleString('en-US')} gas × base fee. Maks normal (1.5×): ${formatAseAmount(tiers.normalMaxFeeWei)} ${aseNetwork.symbol} · Maks fast (2×): ${formatAseAmount(tiers.fastMaxFeeWei)} ${aseNetwork.symbol}` : undefined}
                style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tiers ? `${formatAseAmount(tiers.estimatedFeeWei)} ${aseNetwork.symbol}` : '—'}
              </div>
              {tiers && (
                <div style={{ fontSize: '9px', color: COLORS.muted, marginTop: '3px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Maks: {formatAseAmount(tiers.normalMaxFeeWei)}
                </div>
              )}
            </div>
          );
        })()}
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Umur Block</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {aseChainStatus?.latestBlockTimestamp != null ? timeAgo(aseTs(aseChainStatus.latestBlockTimestamp)!) : '—'}
          </div>
        </div>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Rata² Block Time</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {aseStats.avgBlockTime != null ? `${aseStats.avgBlockTime.toFixed(1)} dtk` : '—'}
          </div>
        </div>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Est. TPS</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {aseStats.tps != null ? aseStats.tps.toFixed(2) : '—'}
          </div>
        </div>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>Proposer Terakhir</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {aseChainStatus?.proposer ? shortHash(aseChainStatus.proposer, 8, 4) : '—'}
          </div>
        </div>
        <div style={{ background: COLORS.bg, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '5px' }}>RPC Aktif</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {aseChainStatus?.rpc ? aseChainStatus.rpc.replace(/^https?:\/\//, '') : '—'}
          </div>
        </div>
      </div>

      {aseChainStatusError && !aseChainStatus && (
        <p style={{ color: '#ff6666', fontSize: '11px', margin: '0 0 14px' }}>{aseChainStatusError}</p>
      )}

      {(() => {
        const act = aseActivity && aseActivity.range === aseActRange ? aseActivity : null;
        const W = 720, H = 190, PL = 40, PR = 8, PT = 10, PB = 22;
        const n = act?.buckets.length ?? 0;
        const max = act ? Math.max(1, ...act.buckets.map(b => b.txCount)) : 1;
        const slot = n ? (W - PL - PR) / n : 0;
        const barW = Math.max(2, slot - 3);
        const fmtLabel = (start: number) => {
          const d = new Date(start * 1000);
          return aseActRange === '24h'
            ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        };
        const fmtFull = (start: number, end: number) => {
          const a = new Date(start * 1000), b = new Date(end * 1000);
          return aseActRange === '24h'
            ? `${a.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${a.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} – ${b.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
            : a.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
        };
        const labelEvery = aseActRange === '24h' ? 3 : aseActRange === '7d' ? 1 : 5;
        const hov = act && aseActHover != null ? act.buckets[aseActHover] : null;
        const peak = act ? act.buckets[act.peakIndex] : null;
        const avg = act && n ? act.totalTx / n : null;
        const unitLabel = aseActRange === '24h' ? 'jam' : 'hari';
        return (
          <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: '14px 16px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#836EFD', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaChartBar size={10} /> History Transaksi
                {aseActLoading && <FaSpinner className="spin-icon" size={10} />}
                {act && !act.exact && (
                  <span title="Jumlah TX per periode diestimasi dari sampel block (rata-rata TX/block × jumlah block)." style={{ fontSize: '9px', color: '#ffaa00', border: '1px solid #ffaa0066', padding: '1px 6px', textTransform: 'none', letterSpacing: '0.3px' }}>/\/</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {([['24h', '24 Jam'], ['7d', '7 Hari'], ['30d', '30 Hari']] as [AsentumActivityRange, string][]).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setAseActRange(key)} style={{
                    fontSize: '10px', padding: '4px 10px', cursor: 'pointer',
                    background: aseActRange === key ? '#836EFD' : 'none',
                    color: aseActRange === key ? '#fff' : COLORS.muted,
                    border: `1px solid ${aseActRange === key ? '#836EFD' : COLORS.border}`,
                    fontWeight: aseActRange === key ? 'bold' : 'normal',
                  }}>{label}</button>
                ))}
                <button type="button" title="Muat ulang" disabled={aseActLoading} onClick={() => loadAseActivity(true)} style={{ background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.muted, cursor: aseActLoading ? 'default' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                  <FaSyncAlt size={10} />
                </button>
              </div>
            </div>

            {act ? (
              <>
                <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', fontSize: '12px', color: COLORS.text, fontFamily: 'monospace', marginBottom: '8px' }}>
                  <span><span style={{ color: COLORS.muted }}>Total TX: </span>{act.totalTx.toLocaleString('en-US')}</span>
                  <span><span style={{ color: COLORS.muted }}>Rata-rata/{unitLabel}: </span>{avg != null ? avg.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—'}</span>
                  <span><span style={{ color: COLORS.muted }}>Puncak: </span>{peak && peak.txCount > 0 ? `${peak.txCount.toLocaleString('en-US')} (${fmtLabel(peak.start)})` : '—'}</span>
                </div>
                <div style={{ fontSize: '11px', color: hov ? COLORS.text : COLORS.muted, fontFamily: 'monospace', minHeight: '16px', marginBottom: '4px' }}>
                  {hov
                    ? `${fmtFull(hov.start, hov.end)} · ${hov.txCount.toLocaleString('en-US')} TX · ${hov.blocks.toLocaleString('en-US')} block`
                    : 'Arahkan kursor ke bar untuk detail.'}
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxHeight: '240px' }} role="img" aria-label="Chart tx transaksi Asentum">
                  {[0, 0.5, 1].map(f => {
                    const y = PT + (H - PT - PB) * (1 - f);
                    return (
                      <g key={f}>
                        <line x1={PL} x2={W - PR} y1={y} y2={y} stroke={COLORS.border} strokeWidth={1} />
                        <text x={PL - 6} y={y + 3} textAnchor="end" fontSize={9} fill={COLORS.muted} fontFamily="monospace">{Math.round(max * f).toLocaleString('en-US')}</text>
                      </g>
                    );
                  })}
                  {act.buckets.map((b, i) => {
                    const h = b.txCount > 0 ? Math.max(2, ((H - PT - PB) * b.txCount) / max) : 0;
                    const x = PL + i * slot + (slot - barW) / 2;
                    const isLast = i === n - 1;
                    return (
                      <g key={b.start} onMouseEnter={() => setAseActHover(i)} onMouseLeave={() => setAseActHover(null)}>
                        <rect x={PL + i * slot} y={PT} width={slot} height={H - PT - PB} fill="transparent" />
                        <rect x={x} y={H - PB - h} width={barW} height={h} fill={aseActHover === i ? '#a99bff' : '#836EFD'} opacity={isLast ? 0.6 : 1} />
                        {i % labelEvery === 0 && (
                          <text x={PL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={9} fill={COLORS.muted} fontFamily="monospace">{fmtLabel(b.start)}</text>
                        )}
                        <title>{`${fmtFull(b.start, b.end)} — ${b.txCount.toLocaleString('en-US')} TX`}</title>
                      </g>
                    );
                  })}
                </svg>
                <div style={{ fontSize: '9px', color: COLORS.muted, marginTop: '4px' }}>
                  Dihitung di klien dari timestamp &amp; jumlah TX per block. Bar terakhir = {unitLabel} berjalan (belum penuh).
                </div>
              </>
            ) : aseActError ? (
              <p style={{ color: '#ff6666', fontSize: '11px', margin: 0 }}>{aseActError}</p>
            ) : (
              <p style={{ color: '#444', fontSize: '12px', margin: 0 }}>{aseActLoading ? 'Memuat data aktivitas…' : 'Belum ada data.'}</p>
            )}
          </div>
        );
      })()}

      {/* ── Statistik 10 block terakhir (dihitung di klien dari feed block) ── */}
      {aseStats.count > 0 && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: '14px 16px', marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#836EFD', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaChartLine size={10} /> Statistik {aseStats.count} block terakhir
          </div>
          <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', fontSize: '12px', color: COLORS.text, fontFamily: 'monospace' }}>
            <span><span style={{ color: COLORS.muted }}>Total TX: </span>{aseStats.totalTx.toLocaleString('en-US')}</span>
            <span><span style={{ color: COLORS.muted }}>TX/block: </span>{aseStats.avgTxPerBlock != null ? aseStats.avgTxPerBlock.toFixed(2) : '—'}</span>
            <span><span style={{ color: COLORS.muted }}>Block time: </span>{aseStats.avgBlockTime != null ? `${aseStats.avgBlockTime.toFixed(1)} dtk` : '—'}</span>
            <span><span style={{ color: COLORS.muted }}>Proposer unik: </span>{aseStats.proposers.length}</span>
          </div>
          {aseStats.proposers.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {aseStats.proposers.slice(0, 5).map(([addr, n]) => (
                <div key={addr} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
                  <span style={{ width: '120px', color: COLORS.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortHash(addr, 8, 4)}</span>
                  <div style={{ flex: 1, height: '6px', background: '#111' }}>
                    <div style={{ width: `${(n / aseStats.count) * 100}%`, height: '100%', background: '#836EFD' }} />
                  </div>
                  <span style={{ width: '64px', textAlign: 'right', color: COLORS.text, fontFamily: 'monospace' }}>{n} block</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleAseSearch} style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="search"
            placeholder="Address (ase1.../0x+40hex), TX hash (0x+64hex), atau nomor block"
            value={aseQuery}
            onChange={e => setAseQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={aseLoading} style={{
            background: '#836EFD', color: '#fff', border: 'none', padding: '0 18px',
            cursor: aseLoading ? 'default' : 'pointer', fontSize: '13px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: '6px', opacity: aseLoading ? 0.6 : 1,
          }}>
            {aseLoading ? <FaSpinner className="spin-icon" /> : <FaSearch />} Cari
          </button>
        </div>
      </form>

      {/* ── Pintasan & riwayat pencarian ── */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
        {aseChainStatus?.height != null && (
          <button type="button" onClick={() => openAseBlock(aseChainStatus.height!)} style={{ fontSize: '10px', color: '#836EFD', border: '1px solid #836EFD55', background: 'none', padding: '4px 9px', cursor: 'pointer' }}>
            Block terkini
          </button>
        )}
        <button type="button" onClick={() => openAseBlock(0)} style={{ fontSize: '10px', color: '#836EFD', border: '1px solid #836EFD55', background: 'none', padding: '4px 9px', cursor: 'pointer' }}>
          Genesis #0
        </button>
        {aseRecent.length > 0 && <span style={{ fontSize: '10px', color: COLORS.muted, marginLeft: '6px' }}><FaHistory size={9} /> Terakhir:</span>}
        {aseRecent.map(r => (
          <button key={r} type="button" onClick={() => handleAseSearch(r)} title={r} style={{
            fontSize: '10px', fontFamily: 'monospace', color: COLORS.text, border: `1px solid ${COLORS.border}`,
            background: '#111', padding: '4px 9px', cursor: 'pointer',
          }}>{/^\d+$/.test(r) ? `#${r}` : shortHash(r, 8, 4)}</button>
        ))}
        {aseRecent.length > 0 && (
          <button type="button" onClick={clearAseRecent} style={{ fontSize: '10px', color: COLORS.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            hapus
          </button>
        )}
      </div>

      {aseError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px',
          border: '1px solid #f4433644', borderLeft: '3px solid #f44336', marginBottom: '20px',
        }}>
          <FaExclamationTriangle color="#f44336" size={13} />
          <span style={{ color: '#ff6666', fontSize: '12px' }}>{aseError}</span>
        </div>
      )}

      {aseAddressResult && (() => {
        const me = asentumAddrKey(aseAddressResult.addressHex);
        const allTxs = aseHist?.txs ?? [];
        const shown = allTxs.filter(t => {
          if (aseRoleFilter === 'all') return true;
          const r = aseRoleOf(t, me);
          return r === aseRoleFilter || r === 'SELF'; // TX ke diri sendiri masuk IN maupun OUT
        });
        const sum = (role: 'IN' | 'OUT') => allTxs
          .filter(t => t.status !== 'failed' && aseRoleOf(t, me) === role)
          .reduce((a, t) => a + (parseFloat(t.valueAse ?? '0') || 0), 0);
        const inCount = allTxs.filter(t => aseRoleOf(t, me) === 'IN').length;
        const outCount = allTxs.filter(t => aseRoleOf(t, me) === 'OUT').length;
        return (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #836EFD', padding: '18px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#836EFD', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaWallet /> {aseAccount?.token ? 'Token ARC-20' : aseAccount?.isContract ? 'Smart Contract (ASE)' : 'Wallet Address (ASE)'}
          </h3>
          <Row label="Address (bech32)" value={aseAddressResult.addressBech32} copy={aseAddressResult.addressBech32} />
          <Row label="Address (hex)" value={aseAddressResult.addressHex} copy={aseAddressResult.addressHex} />
          <Row label="Saldo" value={
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#836EFD' }}>
              {aseAddressResult.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {aseNetwork.symbol}
            </span>
          } mono={false} />
          {aseAddressResult.balanceUsd != null && (
            <Row label="Saldo (USD)" value={`$${aseAddressResult.balanceUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`} mono={false} />
          )}
          <Row label="Tipe Akun" value={aseAccount ? <AseBadge color={aseAccount.isContract ? '#9c27b0' : '#01a2ff'}>{aseAccount.token ? 'CONTRACT · ARC-20' : aseAccount.isContract ? 'CONTRACT' : 'WALLET (EOA)'}</AseBadge> : <FaSpinner className="spin-icon" size={11} />} mono={false} />
          <Row label="Nonce" value={aseAccount ? (aseAccount.nonce ?? '—') : <FaSpinner className="spin-icon" size={11} />} />
          {aseAccount?.token && (
            <>
              <Row label="Nama Token" value={aseAccount.token.name ?? '—'} mono={false} />
              <Row label="Simbol" value={aseAccount.token.symbol ?? '—'} mono={false} />
              <Row label="Decimals" value={aseAccount.token.decimals ?? '—'} />
              <Row label="Total Supply" value={aseAccount.token.totalSupply ?? aseAccount.token.totalSupplyRaw ?? '—'} />
            </>
          )}
          <Row label="Salin Link" value={
            <span onClick={() => copyToClipboard(`${window.location.origin}/explorer/address/${aseAddressResult.addressBech32}`)} style={{ color: '#836EFD', cursor: 'pointer', fontSize: '12px' }}>
              <FaCopy size={9} /> Salin link halaman ini
            </span>
          } mono={false} />

          {/* ── Riwayat TX (hasil scan block terakhir) ── */}
          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#836EFD', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaHistory size={11} /> Riwayat TX
                {aseHistLoading && <FaSpinner className="spin-icon" size={11} />}
                {aseHistLoading && (
                  <button type="button" onClick={() => { aseHistRun.current++; setAseHistLoading(false); setAseHistProgress(null); }} style={{
                    fontSize: '10px', padding: '3px 8px', cursor: 'pointer', background: 'none', color: COLORS.red,
                    border: `1px solid ${COLORS.red}66`, textTransform: 'none', letterSpacing: 0,
                  }}>Hentikan</button>
                )}
              </span>
              <span style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10px', color: COLORS.muted }}>Scan</span>
                <select value={aseScanDepth} onChange={e => setAseScanDepth(parseInt(e.target.value, 10))} style={{ background: '#111', color: '#ddd', border: `1px solid ${COLORS.border}`, padding: '4px 8px', fontSize: '11px' }}>
                  {[100, 10000, 50000, 1000000000000000000].map(n => <option key={n} value={n}>{n.toLocaleString('en-US')} block terakhir</option>)}
                </select>
                {(['all', 'IN', 'OUT'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setAseRoleFilter(f)} style={{
                    fontSize: '10px', padding: '4px 10px', cursor: 'pointer', fontWeight: aseRoleFilter === f ? 'bold' : 'normal',
                    background: aseRoleFilter === f ? '#836EFD' : 'none', color: aseRoleFilter === f ? '#fff' : COLORS.muted,
                    border: `1px solid ${aseRoleFilter === f ? '#836EFD' : COLORS.border}`,
                  }}>{f === 'all' ? 'Semua' : f}</button>
                ))}
              </span>
            </div>

            {aseHistProgress && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ height: '4px', background: '#111' }}>
                  <div style={{ width: `${Math.min(100, (aseHistProgress.done / Math.max(1, aseHistProgress.total)) * 100)}%`, height: '100%', background: '#836EFD', transition: 'width .2s' }} />
                </div>
                <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>
                  Memindai block {aseHistProgress.done.toLocaleString('en-US')} / {aseHistProgress.total.toLocaleString('en-US')}…
                </div>
              </div>
            )}

            {aseHistError && <p style={{ color: '#ff6666', fontSize: '12px', margin: '0 0 10px' }}>{aseHistError}</p>}
            {aseHistLoading && !aseHist && !aseHistError && (
              <p style={{ color: COLORS.muted, fontSize: '11px', margin: '0 0 10px' }}>Belum ada TX ditemukan — TX akan muncul di sini begitu ketemu…</p>
            )}

            {aseHist && (
              <>
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '11px', fontFamily: 'monospace', marginBottom: '8px', color: COLORS.text }}>
                  <span><span style={{ color: COLORS.muted }}>Ditemukan: </span>{allTxs.length} TX</span>
                  <span><span style={{ color: COLORS.muted }}>IN: </span><span style={{ color: COLORS.green }}>{inCount} ({sum('IN').toLocaleString('en-US', { maximumFractionDigits: 6 })} {aseNetwork.symbol})</span></span>
                  <span><span style={{ color: COLORS.muted }}>OUT: </span><span style={{ color: '#ffaa00' }}>{outCount} ({sum('OUT').toLocaleString('en-US', { maximumFractionDigits: 6 })} {aseNetwork.symbol})</span></span>
                </div>
                <p style={{ fontSize: '10px', color: COLORS.muted, margin: '0 0 10px', lineHeight: 1.5 }}>
                  Dipindai block #{aseHist.fromHeight.toLocaleString('en-US')} – #{aseHist.toHeight.toLocaleString('en-US')} ({aseHist.scannedBlocks.toLocaleString('en-US')} block, {aseHist.blocksWithTx.toLocaleString('en-US')} berisi TX).
                  {' '}Node Asentum belum punya indexer per-address, jadi riwayat ini hanya mencakup rentang tersebut
                  {aseHistLoading ? ' (masih memindai — hasil bertambah otomatis)' : aseHist.complete ? '' : ' (sebagian block gagal dimuat / pemindaian dihentikan)'}
                  {allTxs.length >= 100 ? ' dan dibatasi 100 TX terbaru' : ''}. Naikkan jumlah block untuk menjangkau lebih lama.
                </p>
                <AseTxTable
                  txs={shown} viewer={aseAddressResult.addressHex} symbol={aseNetwork.symbol}
                  emptyText={`Tidak ada TX untuk address ini pada ${aseHist.scannedBlocks.toLocaleString('en-US')} block terakhir.`}
                  onTx={h => handleAseSearch(h)} onAddr={a => handleAseSearch(a)} onBlock={h => openAseBlock(h)}
                />
              </>
            )}
          </div>
        </div>
        );
      })()}

      {aseTxDetail && (() => {
        const t = aseTxDetail;
        const st = aseStatusMeta(t.status);
        const ts = aseTs(t.timestamp);
        const selfTx = t.from && t.to && asentumAddrKey(t.from) === asentumAddrKey(t.to);
        const confirmations = t.blockHeight != null && aseChainStatus?.height != null ? Math.max(0, aseChainStatus.height - t.blockHeight + 1) : null;
        const jsonRaw = (v: any) => JSON.stringify(v, (_k, x) => typeof x === 'bigint' ? x.toString() : x, 2);
        // ── Detail fee (EIP-1559) ──
        const toBI = (v: string | null): bigint | null => { try { return v == null ? null : BigInt(v); } catch { return null; } };
        const gUsed = toBI(t.gasUsed), gLimit = toBI(t.gasLimit);
        const baseFee = toBI(t.baseFeePerGas), effPrice = toBI(t.effectiveGasPrice), maxFee = toBI(t.maxFeePerGas);
        const gasPct = gUsed != null && gLimit != null && gLimit > 0n ? Number((gUsed * 10000n) / gLimit) / 100 : null;
        const baseCost = gUsed != null && baseFee != null && effPrice != null ? gUsed * (baseFee < effPrice ? baseFee : effPrice) : null;
        const tipCost = gUsed != null && effPrice != null && baseCost != null ? gUsed * effPrice - baseCost : null;
        const savings = gUsed != null && maxFee != null && effPrice != null && maxFee > effPrice ? (maxFee - effPrice) * gUsed : null;
        const gweiWei = (w: string | null) => w != null ? `${formatAseGwei(w)} Gwei (${w} wei)` : '—';
        const aseAmt = (w: bigint) => `${formatAseAmount(w)} ${aseNetwork.symbol}`;
        return (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #836EFD', padding: '18px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#836EFD', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaExchangeAlt /> Transaksi ASE
          </h3>
          <Row label="Txn Hash" value={t.hash} copy={t.hash} />
          <Row label="Status" value={<AseBadge color={st.color}>{st.label}</AseBadge>} mono={false} />
          <Row label="Method" value={<AseBadge color={t.kind === 'deploy' ? '#e81899' : t.kind === 'transfer' ? '#01a2ff' : t.kind === 'call' ? '#9c27b0' : '#666'}>{t.method}</AseBadge>} mono={false} />
          <Row label="Jenis" value={t.kind === 'transfer' ? 'Transfer native' : t.kind === 'deploy' ? 'Deploy smart contract' : t.kind === 'call' ? 'Panggilan smart contract' : 'Tidak diketahui'} mono={false} />
          {t.blockHeight != null && (
            <Row label="Block" value={
              <span onClick={() => openAseBlock(t.blockHeight!)} style={{ color: '#836EFD', cursor: 'pointer' }}>#{t.blockHeight.toLocaleString('en-US')}</span>
            } mono={false} />
          )}
          {confirmations != null && <Row label="Konfirmasi" value={`${confirmations.toLocaleString('en-US')} block`} mono={false} />}
          {ts != null && <Row label="Age" value={`${timeAgo(ts)} · ${new Date(ts * 1000).toLocaleString('id-ID')}`} mono={false} />}
          <Row label="Nonce" value={t.nonce ?? '—'} />
          {t.from && <Row label="From" value={
            <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <AseBadge color="#ffaa00">{selfTx ? 'SELF' : 'PENGIRIM'}</AseBadge>
              <span onClick={() => handleAseSearch(t.from!)} style={{ color: '#836EFD', cursor: 'pointer' }}>{t.from}</span>
            </span>
          } copy={t.from} />}
          <Row label="To" value={t.to ? (
            <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <AseBadge color="#4caf50">{t.kind === 'call' ? 'CONTRACT' : 'PENERIMA'}</AseBadge>
              <span onClick={() => handleAseSearch(t.to!)} style={{ color: '#836EFD', cursor: 'pointer' }}>{t.to}</span>
            </span>
          ) : <span style={{ color: COLORS.muted }}>— (pembuatan contract)</span>} copy={t.to ?? undefined} />
          <Row label="Value" value={t.valueAse != null ? `${t.valueAse} ${aseNetwork.symbol}` : '—'} mono={false} />
          <Row label="Fee Transaksi" value={t.feeAse != null ? `${t.feeAse} ${aseNetwork.symbol}` : '—'} mono={false} />
          <Row label="Gas Price (efektif)" value={gweiWei(t.effectiveGasPrice)} mono={false} />
          <Row label="Base Fee (block)" value={gweiWei(t.baseFeePerGas)} mono={false} />
          {t.maxFeePerGas != null && <Row label="Max Fee / Gas" value={gweiWei(t.maxFeePerGas)} mono={false} />}
          {t.maxPriorityFeePerGas != null && <Row label="Max Priority Fee / Gas" value={gweiWei(t.maxPriorityFeePerGas)} mono={false} />}
          <Row label="Gas Limit" value={gLimit != null ? gLimit.toLocaleString('en-US') : '—'} />
          <Row label="Gas Used" value={gUsed != null ? `${gUsed.toLocaleString('en-US')}${gasPct != null ? ` (${gasPct.toFixed(2)}%)` : ''}` : '—'} />
          {baseCost != null && tipCost != null && (
            <Row label="Rincian Fee" value={`Base ${aseAmt(baseCost)} · Tip ${aseAmt(tipCost)}`} mono={false} />
          )}
          {savings != null && <Row label="Hemat vs Max Fee" value={aseAmt(savings)} mono={false} />}
          {t.input && (
            <Row label="Input Data" value={
              <span style={{ display: 'block', maxHeight: '110px', overflowY: 'auto', fontSize: '11px', color: '#888' }}>{t.input}</span>
            } copy={t.input} />
          )}
          <Row label="Salin Link" value={
            <span onClick={() => copyToClipboard(`${window.location.origin}/explorer/tx/${t.hash}`)} style={{ color: '#836EFD', cursor: 'pointer', fontSize: '12px' }}>
              <FaCopy size={9} /> Salin link halaman ini
            </span>
          } mono={false} />
          <div style={{ marginTop: '14px' }}>
            <div onClick={() => setShowRawAseTx(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
              fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px',
            }}>
              <FaFileCode /> Raw TX (JSON)
              {showRawAseTx ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            </div>
            {showRawAseTx && (
              <pre style={{
                marginTop: '8px', background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
                fontSize: '10px', color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                wordBreak: 'break-all', maxHeight: '260px', overflowY: 'auto', position: 'relative',
              }}>
                <FaCopy size={11} style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', color: COLORS.muted }}
                  onClick={() => copyToClipboard(jsonRaw(t.raw))} title="Copy" />
                {jsonRaw(t.raw)}
              </pre>
            )}
          </div>
        </div>
        );
      })()}

      {/* ── BLOCK RESULT ASE — persis pola blockResult di tab EVM: klik nomor
           block (search angka, klik baris di feed, atau link "Block #N" dari
           detail tx) buka kartu ini, lengkap dengan daftar tx di block itu
           (klik salah satu → buka detail tx-nya) & raw JSON toggle. ── */}
      {aseBlockDetail && (
        <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #836EFD', padding: '18px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#836EFD', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaCube /> Block #{aseBlockDetail.height.toLocaleString('en-US')}
          </h3>
          {aseBlockDetail.hash && <Row label="Block Hash" value={aseBlockDetail.hash} copy={aseBlockDetail.hash} />}
          {aseBlockDetail.height > 0 && (
            <Row label="Parent" value={
              <span onClick={() => openAseBlock(aseBlockDetail.height - 1)} style={{ color: '#836EFD', cursor: 'pointer' }}>
                #{(aseBlockDetail.height - 1).toLocaleString('en-US')}
              </span>
            } mono={false} />
          )}
          {aseBlockDetail.timestamp != null && (
            <Row label="Timestamp" value={new Date(aseBlockDetail.timestamp * (aseBlockDetail.timestamp < 2e10 ? 1000 : 1)).toLocaleString('id-ID')} mono={false} />
          )}
          {aseBlockDetail.proposer && <Row label="Proposer / Validator" value={aseBlockDetail.proposer} copy={aseBlockDetail.proposer} />}
          {aseChainStatus?.height != null && aseBlockDetail.height < aseChainStatus.height && (
            <Row label="Berikutnya" value={
              <span onClick={() => openAseBlock(aseBlockDetail.height + 1)} style={{ color: '#836EFD', cursor: 'pointer' }}>
                #{(aseBlockDetail.height + 1).toLocaleString('en-US')}
              </span>
            } mono={false} />
          )}
          {aseBlockDetail.timestamp != null && <Row label="Umur" value={timeAgo(aseTs(aseBlockDetail.timestamp)!)} mono={false} />}
          {aseChainStatus?.height != null && (
            <Row label="Konfirmasi" value={`${Math.max(0, aseChainStatus.height - aseBlockDetail.height + 1).toLocaleString('en-US')} block`} mono={false} />
          )}
          <Row label="Transactions" value={aseBlockDetail.txCount ?? aseBlockDetail.txHashes.length} />
          {(() => {
            const b = aseBlockDetail;
            const used = b.gasUsed != null ? BigInt(b.gasUsed) : null;
            const limit = b.gasLimit != null ? BigInt(b.gasLimit) : null;
            const base = b.baseFeePerGas != null ? BigInt(b.baseFeePerGas) : null;
            const pct = used != null && limit != null && limit > 0n ? Number((used * 10000n) / limit) / 100 : null;
            return (
              <>
                {used != null && <Row label="Gas Used" value={`${used.toLocaleString('en-US')}${pct != null ? ` (${pct.toFixed(2)}%)` : ''}`} />}
                {limit != null && <Row label="Gas Limit" value={limit.toLocaleString('en-US')} />}
                {base != null && <Row label="Base Fee" value={`${formatAseGwei(b.baseFeePerGas)} Gwei (${b.baseFeePerGas} wei)`} mono={false} />}
                {used != null && base != null && <Row label="Total Base Fee" value={`${formatAseAmount(used * base)} ${aseNetwork.symbol}`} mono={false} />}
              </>
            );
          })()}
          {([
            ['State Root', ['stateRoot']],
            ['Parent Hash', ['parentHash', 'prevHash']],
          ] as [string, string[]][]).map(([label, keys]) => {
            const v = aseRawField(aseBlockDetail.raw, keys);
            return v != null ? <Row key={label} label={label} value={v} copy={v} /> : null;
          })}
          <Row label="Salin Link" value={
            <span onClick={() => copyToClipboard(`${window.location.origin}/explorer/block/${aseBlockDetail.height}`)} style={{ color: '#836EFD', cursor: 'pointer', fontSize: '12px' }}>
              <FaCopy size={9} /> Salin link halaman ini
            </span>
          } mono={false} />

          {(aseBlockDetail.txHashes.length > 0 || (aseBlockDetail.txCount ?? 0) > 0) && (
            <div style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '10px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {aseBlockDetail.txHashes.length || aseBlockDetail.txCount} TX di block ini
                {aseBlockTxsLoading && <FaSpinner className="spin-icon" size={10} />}
                {aseBlockDetail.txHashes.length > 100 && <span style={{ textTransform: 'none' }}>(100 pertama)</span>}
              </p>
              {aseBlockTxsLoading && aseBlockTxs.length === 0 ? (
                <p style={{ color: '#444', fontSize: '12px', margin: 0 }}>Memuat detail transaksi…</p>
              ) : (
                <AseTxTable txs={aseBlockTxs} symbol={aseNetwork.symbol}
                  onTx={h => handleAseSearch(h)} onAddr={a => handleAseSearch(a)} onBlock={h => openAseBlock(h)} />
              )}
            </div>
          )}

          <div style={{ marginTop: '14px' }}>
            <div onClick={() => setShowRawAseBlock(s => !s)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
              fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px',
            }}>
              <FaFileCode /> Raw Block (JSON)
              {showRawAseBlock ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            </div>
            {showRawAseBlock && (
              <pre style={{
                marginTop: '8px', background: '#000', border: `1px solid ${COLORS.border}`, padding: '10px',
                fontSize: '10px', color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                wordBreak: 'break-all', maxHeight: '260px', overflowY: 'auto', position: 'relative',
              }}>
                <FaCopy size={11} style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', color: COLORS.muted }}
                  onClick={() => copyToClipboard(JSON.stringify(aseBlockDetail.raw, null, 2))} title="Copy" />
                {JSON.stringify(aseBlockDetail.raw, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {aseTxNotFound && (
        <div className="fade-in-up" style={{
          background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #836EFD',
          padding: '24px', textAlign: 'center',
        }}>
          <FaExchangeAlt size={20} color="#836EFD" style={{ marginBottom: '10px' }} />
          <p style={{ color: COLORS.text, fontSize: '13px', fontWeight: 'bold', margin: '0 0 6px' }}>
            Detail transaksi ASE belum diindeks di sini
          </p>
          <p style={{ color: COLORS.muted, fontSize: '11px', margin: '0 0 14px', wordBreak: 'break-all' }}>
            {aseTxNotFound}
          </p>
          <button onClick={() => handleAseSearch(aseTxNotFound)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#836EFD',
            border: '1px solid #836EFD', padding: '8px 16px', background: 'none', cursor: 'pointer', fontWeight: 'bold',
          }}>
            <FaSyncAlt size={11} /> Coba Cari Lagi
          </button>
        </div>
      )}

      {aseBlockNotFound != null && (
        <div className="fade-in-up" style={{
          background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #836EFD',
          padding: '24px', textAlign: 'center',
        }}>
          <FaCube size={20} color="#836EFD" style={{ marginBottom: '10px' }} />
          <p style={{ color: COLORS.text, fontSize: '13px', fontWeight: 'bold', margin: '0 0 6px' }}>
            Block #{aseBlockNotFound.toLocaleString('en-US')} tidak bisa dimuat
          </p>
          <p style={{ color: COLORS.muted, fontSize: '11px', margin: '0 0 14px' }}>
            SDK/RPC yang dipakai mungkin belum expose data block ini langsung.
          </p>
          <button onClick={() => openAseBlock(aseBlockNotFound)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#836EFD',
            border: '1px solid #836EFD', padding: '8px 16px', background: 'none', cursor: 'pointer', fontWeight: 'bold',
          }}>
            <FaSyncAlt size={11} /> Coba Lagi
          </button>
        </div>
      )}

      {!aseAddressResult && !aseTxDetail && !aseBlockDetail && !aseTxNotFound && !aseBlockNotFound && !aseError && (
        <div style={{ textAlign: 'center', padding: '24px 20px', color: '#333' }}>
          <AsentumLogo size={44} style={{ marginBottom: '10px', opacity: 0.55 }} />
          <p style={{ fontSize: '12px', margin: 0 }}>
            Cari address, TX hash, atau nomor block Asentum di atas — atau klik langsung salah satu baris
            di feed "Block Terbaru" / "Transaksi" / "Validator" di bawah.
          </p>
        </div>
      )}

      {/* ── Block Terbaru & Mempool ASE — SELALU tampil (persis panel "Latest
           Blocks" di tab EVM), bukan cuma pas kosong hasil pencarian, biar
           mudah pantau chain post-quantum ini yang sempat dilaporkan macet
           (lihat catatan bug #5 di Asentumnet.ts). ── */}
      <div className="fade-in-up" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #836EFD', padding: '18px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#836EFD', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AsentumLogo size={14} /> Block, Mempool &amp; Validator — {aseNetwork.name}
            {refreshSettings.enabled && (
              <span style={{
                fontSize: '9px', fontWeight: 'bold', color: COLORS.green, border: `1px solid ${COLORS.green}`,
                padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', letterSpacing: '0.3px',
              }}>
                <FaSyncAlt size={8} /> live · {refreshSettings.intervalSec}s
              </span>
            )}
          </h3>
          {(aseDetailTab === 'blocks' ? aseLatestBlocksLoading : aseDetailTab === 'validators' ? aseValidatorsLoading : aseDetailTab === 'txs' ? aseRecentTxsLoading : aseMempoolLoading) && <FaSpinner className="spin-icon" color="#836EFD" size={12} />}
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {(['blocks', 'txs', 'mempool', 'validators'] as const).map(key => (
            <button key={key} onClick={() => setAseDetailTab(key)} style={{
              flex: 1, padding: '7px 10px', fontSize: '11px', cursor: 'pointer',
              background: aseDetailTab === key ? '#836EFD' : 'none',
              color: aseDetailTab === key ? '#fff' : COLORS.muted,
              border: `1px solid ${aseDetailTab === key ? '#836EFD' : COLORS.border}`,
              fontWeight: aseDetailTab === key ? 'bold' : 'normal',
            }}>
              {key === 'blocks' ? 'Block Terbaru' : key === 'txs' ? 'Transaksi' : key === 'validators' ? `Validator (${aseValidators.length})` : `Mempool (${aseChainStatus?.mempoolSize ?? aseMempool.length ?? 0})`}
            </button>
          ))}
        </div>

        {aseDetailTab === 'txs' ? (
          <AseTxTable txs={aseRecentTxs} symbol={aseNetwork.symbol}
            emptyText={aseRecentTxsLoading ? 'Memuat transaksi terbaru…' : 'Belum ada transaksi di 10 block terbaru yang berisi TX.'}
            onTx={h => handleAseSearch(h)} onAddr={a => handleAseSearch(a)} onBlock={h => openAseBlock(h)} />
        ) : aseDetailTab === 'validators' ? (
          aseValidatorsError ? (
            <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{aseValidatorsError}</p>
          ) : !aseValidatorsLoading && aseValidators.length === 0 ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>Tidak ada data validator.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {aseValidators.map((v, idx) => (
                <div key={`${v.address ?? v.moniker ?? idx}`} className="explorer-row"
                  onClick={() => v.address && handleAseSearch(v.address)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                    padding: '9px 12px', background: '#111', border: `1px solid ${COLORS.border}`, cursor: v.address ? 'pointer' : 'default', flexWrap: 'wrap',
                  }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '10px', color: COLORS.muted, fontFamily: 'monospace', minWidth: '22px' }}>{idx + 1}</span>
                    <span style={{ fontSize: '12px', color: '#836EFD', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.moniker ?? (v.address ? shortHash(v.address, 10, 6) : '—')}
                    </span>
                  </span>
                  <span style={{ fontSize: '11px', color: COLORS.text, fontFamily: 'monospace' }}>
                    {v.power != null ? v.power : '—'}
                  </span>
                  {v.missedBlocks != null && (
                    <span style={{ fontSize: '10px', color: v.missedBlocks > 0 ? '#ffaa00' : COLORS.muted }}>miss {v.missedBlocks}</span>
                  )}
                  {v.jailed != null && (
                    <span style={{
                      fontSize: '10px', padding: '3px 8px', flexShrink: 0,
                      color: v.jailed ? COLORS.red : COLORS.green, border: `1px solid ${v.jailed ? COLORS.red : COLORS.green}55`,
                    }}>{v.jailed ? 'JAILED' : 'AKTIF'}</span>
                  )}
                </div>
              ))}
            </div>
          )
        ) : aseDetailTab === 'blocks' ? (
          aseLatestBlocksError ? (
            <p style={{ color: '#ff6666', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>{aseLatestBlocksError}</p>
          ) : !aseLatestBlocksLoading && aseLatestBlocks.length === 0 ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              {aseLatestBlocksLoading ? 'Memuat block terbaru…' : 'Tidak ada data (cek RPC).'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {aseLatestBlocks.map((b, idx) => (
                <div key={`${b.height}-${idx}`} className="explorer-row" onClick={() => openAseBlock(b.height)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                  padding: '9px 12px', background: '#111', border: `1px solid ${COLORS.border}`, cursor: 'pointer', flexWrap: 'wrap',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#836EFD', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    <FaCube size={11} /> #{b.height.toLocaleString('en-US')}
                  </span>
                  <span style={{ fontSize: '11px', color: COLORS.muted }}>
                    {b.timestamp ? timeAgo(b.timestamp < 2e10 ? b.timestamp : Math.floor(b.timestamp / 1000)) : (b.hash ? `${b.hash.slice(0, 10)}…` : '—')}
                  </span>
                  {b.proposer && (
                    <span title={b.proposer} style={{ fontSize: '10px', color: COLORS.muted, fontFamily: 'monospace' }}>
                      {shortHash(b.proposer, 6, 4)}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: COLORS.text, fontFamily: 'monospace' }}>
                    {b.txCount != null ? `${b.txCount} txns` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          aseMempoolError ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ color: COLORS.muted, fontSize: '12px', margin: '0 0 6px' }}>{aseMempoolError}</p>
              {aseChainStatus?.mempoolSize != null && (
                <p style={{ color: '#836EFD', fontSize: '12px', fontFamily: 'monospace', margin: 0 }}>
                  Jumlah saat ini: {aseChainStatus.mempoolSize.toLocaleString('en-US')} tx pending
                </p>
              )}
            </div>
          ) : !aseMempoolLoading && aseMempool.length === 0 ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              {aseMempoolLoading ? 'Memuat mempool…' : 'Mempool kosong (atau data belum tersedia).'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {aseMempool.map((t, idx) => (
                <div key={`${t.hash}-${idx}`} className="explorer-row" onClick={() => handleAseSearch(t.hash)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                  padding: '9px 12px', background: '#111', border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#836EFD', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.hash ? `${t.hash.slice(0, 16)}…${t.hash.slice(-6)}` : '—'}
                    </div>
                    <div style={{ fontSize: '10px', color: COLORS.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.from ? `dari ${t.from.slice(0, 8)}…` : 'menunggu di-mine'}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', color: '#ffaa00', border: '1px solid #ffaa0040', padding: '3px 8px', flexShrink: 0 }}>PENDING</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      </>
      )}

      <style>{`
        .spin-icon { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .fade-in-up { animation: fadeInUp 0.32s ease-out; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .explorer-row {
          transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
        }
        .explorer-row:hover {
          border-color: #333 !important;
          background: #161616 !important;
          transform: translateX(2px);
        }
      `}</style>

      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
