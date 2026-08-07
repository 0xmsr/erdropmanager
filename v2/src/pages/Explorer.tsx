import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { Navbar } from '../components/Navbar';
import { KNOWN_4BYTE, KNOWN_TOPICS } from './wallet-gen/know';
import {
  type RPCNetwork, DEFAULT_NETWORKS, RPC_NETWORKS_STORAGE_KEY,
  type DetectedToken, BLOCKSCOUT_HOSTS, fetchEvmTokenPortfolio,
} from './wallet-gen/Walletgenerator';
import {
  FaSearch, FaCube, FaExchangeAlt, FaWallet, FaFileCode, FaCopy,
  FaCheckCircle, FaTimesCircle, FaClock, FaSpinner, FaExternalLinkAlt,
  FaGlobe, FaLayerGroup, FaGasPump, FaArrowRight, FaChevronDown, FaChevronUp,
  FaExclamationTriangle, FaCompass, FaCoins, FaHistory, FaListUl,
  FaUsers, FaTag, FaChartLine, FaCog, FaSyncAlt, FaPlay, FaBolt,
  FaPlug, FaFileImport, FaUnlink,
} from 'react-icons/fa';

// ─────────────────────────────────────────────────────────────────────────
// Explorer.tsx — mini block-explorer ala Etherscan (multi-chain, RPC based)
// Cari address / tx hash / block number lalu tampilkan detailnya, plus feed
// blok terbaru. Tidak butuh API key — semua data diambil langsung dari RPC.
//
// Daftar network TIDAK lagi di-hardcode di sini — diambil dari localStorage
// key yang sama dengan halaman Wallet Generator (RPC_NETWORKS_STORAGE_KEY),
// jadi semua network + custom RPC yang ditambah/diedit di Wallet Gen otomatis
// ikut muncul & konsisten di Explorer juga. Kalau localStorage masih kosong
// (user belum pernah buka Wallet Gen), fallback ke DEFAULT_NETWORKS bawaan.
// ─────────────────────────────────────────────────────────────────────────

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
  // ── hasil decode token transfer (diisi belakangan, best-effort) ──
  transferKind?: 'erc20' | 'erc721' | null;
  transferFrom?: string | null;
  transferTo?: string | null;
  transferAmount?: string | null; // ERC-20: jumlah token (sudah dibagi decimals). ERC-721: token ID.
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
  // ── detail tambahan ala Etherscan ──
  confirmations: number | null;
  transactionIndex: number | null;
  feeNative: string | null;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  inputData: string;
  decodedParams: DecodedParam[];
  // ── raw JSON ala tab "Raw" di Etherscan — TX & receipt mentah dari RPC ──
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

// ── Token Page ala Etherscan/Blockscout — dipakai kalau address yang dicari
//    ternyata kontrak token (ERC-20/721/1155), bukan kontrak biasa. ──
interface TokenInfo {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;      // sudah dibagi decimals (formatted)
  totalSupplyRaw: string | null;   // angka mentah (belum dibagi decimals)
  standard: string;                // 'ERC-20' | 'ERC-721' | 'ERC-1155' | 'Unknown'
  holdersCount: number | null;
  iconUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  source: DataSource;
}

interface TokenHolder {
  address: string;
  balance: string;        // formatted (sudah dibagi decimals kalau diketahui)
  percentage: number | null;
}

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  amount: string;          // formatted amount, atau "Token ID #x" untuk NFT
  timestamp: number | null;
  isNft: boolean;
}

type DataSource = 'blockscout' | 'rpc' | null;

// ── helpers ──────────────────────────────────────────────────────────────
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

function isAddress(v: string) { return /^0x[0-9a-fA-F]{40}$/.test(v); }
function isTxOrBlockHash(v: string) { return /^0x[0-9a-fA-F]{64}$/.test(v); }
function isBlockNumber(v: string) { return /^\d+$/.test(v); }

// -- Bentuk objek TX/receipt "mentah" ala tab Raw di Etherscan, dengan semua
//    BigNumber dikonversi ke string desimal biasa (bukan {type:"BigNumber",hex})
//    supaya enak dibaca & di-copy. Field yang dipilih sengaja dibatasi ke yang
//    relevan -- bukan dump seluruh objek ethers.js (ada referensi provider &
//    fungsi internal di dalamnya yang bisa bikin JSON.stringify meledak / sirkular).
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

// Tipe minimal yang kita butuhkan dari hasil provider.getBlockWithTransactions() --
// didefinisikan sendiri (bukan import ethers.providers.BlockWithTransactions) karena
// nama export itu tidak selalu tersedia di semua versi @ethersproject/providers.
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

// -- Decode input params dari calldata, berdasarkan signature yang dikenal di
//    KNOWN_4BYTE (mis. "transfer(address,uint256)"). Hanya bisa decode param
//    yang tipenya static (address/uint/int/bool/bytesN) -- param dynamic
//    (string/bytes/array) ditandai sebagai "dynamic" karena butuh ABI decoder
//    penuh untuk offset-nya, bukan sekadar baca per-slot 32 byte. Logika ini
//    sama dengan yang dipakai di halaman Tx Decoder.
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
        } catch { /* biarkan tanpa note */ }
      }
    }
    params.push({ name: `param${i}`, type: abiType, value, note });
    offset += 64;
  });
  return params;
}

// -- Ambil alasan revert dari TX yang gagal, dengan cara mensimulasikan ulang
//    (eth_call) tepat di block tempat TX itu di-mine. Butuh RPC yang masih
//    menyimpan state historis untuk block tsb (archive node) -- kalau RPC
//    publiknya bukan archive node atau block-nya sudah terlalu lama, akan
//    gagal dan kita tampilkan pesan generik alih-alih error mentah.
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
  } catch { /* bukan format Error(string)/Panic(uint256) standar */ }
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
    return null; // RPC tidak mendukung call historis / archive -- biarkan null, tampilkan fallback di UI
  }
}


// ── Detail tambahan (token holdings, riwayat TX, info kontrak) idealnya diambil
//    dari instance Blockscout publik — sama seperti yang dipakai halaman Wallet
//    Gen untuk fitur "Portofolio Token" — karena datanya lebih lengkap (ada
//    indexer alamat). TAPI datanya TIDAK SELALU dari Blockscout: kalau network
//    yang dipilih belum ada instance Blockscout publiknya, atau requestnya
//    gagal/timeout, otomatis fallback ke scan langsung via RPC (eth_getLogs
//    untuk transfer token + baca storage slot proxy EIP-1967) supaya network
//    apa pun tetap bisa menampilkan detail ala Etherscan. Setiap panel diberi
//    label kecil "via Blockscout" / "via RPC" supaya sumber datanya jelas.
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
    try { valueEth = ethers.utils.formatEther(String(it?.value ?? '0')); } catch { /* keep 0 */ }
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

// ── Fallback berbasis RPC murni (dipakai untuk network yang belum punya
//    instance Blockscout publik, ATAU sebagai cadangan kalau Blockscout
//    error/timeout). Tanpa indexer alamat, jadi data ini didapat dengan cara
//    berbeda dari Blockscout: scan event log Transfer ERC-20 & baca storage
//    slot proxy langsung dari RPC — bukan query "lihat semua TX suatu alamat"
//    yang memang tidak disediakan oleh RPC node biasa. Cakupannya dibatasi
//    (RPC_SCAN_MAX_LOOKBACK block terakhir) supaya tidak membebani RPC publik. ──
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const EIP1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bb';
const RPC_SCAN_BLOCK_RANGE = 5000;   // ukuran per panggilan eth_getLogs
const RPC_SCAN_MAX_LOOKBACK = 50000; // total block maksimal yang di-scan mundur

const ERC20_MINI_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
];

function addressToTopic(addr: string) {
  return '0x' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

// Scan mundur eth_getLogs berdasarkan topic tertentu, berhenti begitu cukup
// hasil ditemukan atau limit lookback tercapai. Kalau RPC menolak (limit
// range per query beda-beda tiap provider), scan dihentikan dengan sopan
// alih-alih melempar error ke seluruh fitur.
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
      break; // provider menolak range ini — hentikan scan, tetap kembalikan yang sudah didapat
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
    try { d = await new ethers.Contract(token, ERC20_MINI_ABI, provider).decimals(); } catch { /* default 18 */ }
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
      try { amount = ethers.utils.formatUnits(log.data, decimals); } catch { /* biarkan 0 kalau data log aneh */ }
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
    } catch { return null; } // token non-standar / call gagal — lewati
  }));

  return results.filter((r: DetectedToken | null): r is DetectedToken => r !== null);
}

async function fetchAddressContractInfoViaRpc(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
  code: string,
): Promise<ContractInfo> {
  // EIP-1167 minimal proxy: pola bytecode tetap & alamat implementasi tersemat di tengah
  const isMinimalProxy = /^0x363d3d373d3d3d363d73[0-9a-fA-F]{40}5af43d82803e903d91602b57fd5bf3$/i.test(code);

  let implAddress: string | null = null;
  try {
    const raw = await provider.getStorageAt(address, EIP1967_IMPL_SLOT);
    const addr = '0x' + raw.slice(-40);
    if (addr !== ethers.constants.AddressZero) implAddress = ethers.utils.getAddress(addr);
  } catch { /* getStorageAt tidak didukung / bukan proxy EIP-1967 */ }

  let standard: string | null = null;
  try {
    await provider.call({ to: address, data: '0x18160ddd' }); // totalSupply()
    standard = 'ERC-20 (kemungkinan, dari deteksi selector)';
  } catch { /* bukan ERC-20 */ }

  if (!standard) {
    try {
      const erc165 = new ethers.Contract(address, ['function supportsInterface(bytes4) view returns (bool)'], provider);
      if (await erc165.supportsInterface('0xd9b67a26')) standard = 'ERC-1155 (kemungkinan, via ERC-165)';
      else if (await erc165.supportsInterface('0x80ac58cd')) standard = 'ERC-721 (kemungkinan, via ERC-165)';
    } catch { /* bukan ERC-165 */ }
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

// ── Token Page — deteksi & ambil data token (ERC-20/721/1155) ala Etherscan/
//    Blockscout. Sama seperti panel lain di Explorer ini: coba Blockscout dulu
//    (datanya lebih lengkap — ikon, holders count, harga), fallback ke RPC
//    langsung (name/symbol/decimals/totalSupply + ERC-165) kalau Blockscout
//    tidak tersedia / gagal, supaya network apa pun tetap bisa menampilkan
//    info token dasar. ──
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
  // Tanpa name/symbol yang berhasil dibaca, ini kemungkinan bukan kontrak token
  if (name == null && symbol == null) return null;

  const decimals = decimalsRaw != null ? Number(decimalsRaw) : null;

  let standard = 'ERC-20';
  try {
    const erc165 = new ethers.Contract(address, ['function supportsInterface(bytes4) view returns (bool)'], provider);
    if (await erc165.supportsInterface('0xd9b67a26')) standard = 'ERC-1155';
    else if (await erc165.supportsInterface('0x80ac58cd')) standard = 'ERC-721';
  } catch { /* bukan ERC-165 — anggap ERC-20 selama name/symbol kebaca */ }

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
    try { balance = decimals != null ? ethers.utils.formatUnits(raw, decimals) : raw; } catch { /* biarkan raw */ }
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

// Fallback RPC murni: scan eth_getLogs langsung dari kontrak token itu sendiri
// (bukan dari address wallet seperti fetchAddressRecentTxsViaRpc), dibatasi
// RPC_SCAN_MAX_LOOKBACK block terakhir sama seperti panel lain.
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

// Mapping symbol native token → CoinGecko id, dipakai untuk menampilkan nilai
// USD dari balance address (best-effort, gagal diam-diam kalau symbol tidak
// dikenal atau CoinGecko tidak bisa diakses — bukan bagian kritis dari fitur).
const NATIVE_SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  ETH: 'ethereum', BNB: 'binancecoin', MATIC: 'matic-network', POL: 'matic-network',
  AVAX: 'avalanche-2', RON: 'ronin', FTM: 'fantom', ONE: 'harmony-2',
  CRO: 'crypto-com-chain', GLMR: 'moonbeam', CELO: 'celo', KAVA: 'kava',
  METIS: 'metis-token', MNT: 'mantle', xDAI: 'xdai', GNO: 'gnosis',
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

// ── Wallet tersimpan dari halaman Wallet Generator — dibaca dari localStorage
//    yang sama (bip39Wallets) supaya bisa dipakai langsung untuk Write Contract
//    tanpa perlu install/connect wallet browser terpisah. ──
interface WalletGenAccount {
  key: string;         // walletId-index, unik
  label: string;       // "[Nama Wallet] 0x1234…5678 (#0)"
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

// ─────────────────────────────────────────────────────────────────────────
// Read / Write Contract — ala Etherscan. Butuh ABI (otomatis dari Blockscout
// kalau kontrak sudah verified, atau paste manual). Read pakai RPC (getProvider,
// tanpa wallet). Write butuh wallet browser (window.ethereum) untuk sign & kirim TX.
// ─────────────────────────────────────────────────────────────────────────
interface AbiFunctionEntry {
  key: string;           // signature unik (nama+tipe input) untuk key React & state
  name: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  stateMutability: string;
  isRead: boolean;       // view/pure
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

// Parse nilai input mentah (string dari form) sesuai tipe ABI-nya. Tipe
// numerik/address/bytes/string dikirim apa adanya (ethers.js yang urus
// encoding); array/tuple diharapkan dalam format JSON.
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
      if (/^\d+$/.test(k)) return; // buang index numerik duplikat dari ethers struct result
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
      setResults(prev => ({ ...prev, [fn.key]: { loading: false, error: e?.reason || e?.message || 'Gagal membaca contract.' } }));
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
        setResults(prev => ({ ...prev, [fn.key]: { loading: false, error: e?.reason || e?.message || 'Transaksi gagal.' } }));
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
      setResults(prev => ({ ...prev, [fn.key]: { loading: false, error: e?.reason || e?.message || 'Transaksi gagal.' } }));
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
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid #9c27b0`, padding: '18px', marginBottom: '24px' }}>
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
  const [networks, setNetworks] = useState<RPCNetwork[]>(() => {
    try {
      const s = localStorage.getItem(RPC_NETWORKS_STORAGE_KEY);
      const parsed: RPCNetwork[] = s ? JSON.parse(s) : DEFAULT_NETWORKS;
      return parsed.length > 0 ? parsed : DEFAULT_NETWORKS;
    } catch { return DEFAULT_NETWORKS; }
  });

  // ── Sinkron kalau daftar network diubah di tab/halaman lain (mis. Wallet Gen) ──
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== RPC_NETWORKS_STORAGE_KEY) return;
      try {
        const parsed: RPCNetwork[] = e.newValue ? JSON.parse(e.newValue) : DEFAULT_NETWORKS;
        setNetworks(parsed.length > 0 ? parsed : DEFAULT_NETWORKS);
      } catch { /* biarkan daftar lama kalau parse gagal */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Wallet tersimpan dari Wallet Generator, dipakai sebagai opsi signer
  //    untuk Write Contract (alternatif dari wallet browser / MetaMask). ──
  const [walletGenAccounts, setWalletGenAccounts] = useState<WalletGenAccount[]>(() => loadWalletGenAccounts());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== BIP39_WALLETS_STORAGE_KEY) return;
      setWalletGenAccounts(loadWalletGenAccounts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const [networkId, setNetworkId] = useState(() => networks[0]?.id ?? DEFAULT_NETWORKS[0].id);
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

  // ── Pengaturan auto-refresh feed "Latest Blocks" — persist ke localStorage
  //    supaya preferensi tetap kesimpen walau reload/pindah halaman. ──
  const [refreshSettings, setRefreshSettings] = useState<{ enabled: boolean; intervalSec: 3 | 4 | 5 }>(() => {
    try {
      const s = localStorage.getItem(EXPLORER_REFRESH_STORAGE_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        const interval = [3, 4, 5].includes(parsed.intervalSec) ? parsed.intervalSec : 4;
        return { enabled: parsed.enabled !== false, intervalSec: interval };
      }
    } catch { /* pakai default */ }
    return { enabled: true, intervalSec: 4 };
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem(EXPLORER_REFRESH_STORAGE_KEY, JSON.stringify(refreshSettings));
  }, [refreshSettings]);

  // ── Detail tambahan untuk ADDRESS: token holdings, riwayat TX, info kontrak ──
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

  // ── Token Page (kalau address yang dicari adalah kontrak token) ──
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

  const network = useMemo(
    () => networks.find(n => n.id === networkId) ?? networks[0] ?? DEFAULT_NETWORKS[0],
    [networks, networkId]
  );
  const rpcUrl = network.rpcUrls[0];

  const getProvider = useCallback(
    () => new ethers.providers.JsonRpcProvider(rpcUrl),
    [rpcUrl]
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId]);

  // ── Auto-refresh feed "Latest Blocks" tiap 3-5 detik sesuai pengaturan ──
  useEffect(() => {
    if (!refreshSettings.enabled) return;
    const id = setInterval(() => { loadLatestBlocks(); }, refreshSettings.intervalSec * 1000);
    return () => clearInterval(id);
  }, [refreshSettings.enabled, refreshSettings.intervalSec, loadLatestBlocks]);

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

  // ── Load detail tambahan address (token holdings, riwayat TX, info kontrak)
  //    secara terpisah dari loading utama, supaya hasil RPC utama (saldo/nonce)
  //    langsung tampil duluan tanpa menunggu sumber lain selesai.
  //
  //    Blockscout dipakai duluan kalau tersedia untuk network ini (datanya lebih
  //    lengkap karena ada indexer), tapi TIDAK WAJIB — kalau Blockscout tidak
  //    tersedia untuk network tsb, atau request-nya gagal/timeout, otomatis
  //    fallback ke scan langsung via RPC (eth_getLogs + baca storage slot),
  //    supaya network apa pun tetap bisa menampilkan detail ala Etherscan. ──
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
        // Blockscout gagal / tidak tersedia → coba lagi via RPC sebelum menyerah
        try {
          const tokens = await fetchTokenPortfolioViaRpc(provider, addr);
          tokens.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));
          setTokenHoldings(tokens);
          setTokensSource('rpc');
        } catch (e: any) {
          setTokensError(e?.message || 'Gagal mengambil token holdings dari Blockscout maupun RPC.');
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
          setRecentTxsError(e?.message || 'Gagal mengambil riwayat transaksi dari Blockscout maupun RPC.');
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

  // ── Load info Token Page (kalau address ini kontrak token) — dijalankan
  //    terpisah dari loadAddressExtras supaya panel Contract Info / Token
  //    Holdings tetap tampil normal tanpa menunggu deteksi token selesai. ──
  const loadTokenInfo = useCallback(async (addr: string, netId: string) => {
    const provider = getProvider();
    const host = BLOCKSCOUT_HOSTS[netId];

    setTokenInfoLoading(true); setTokenInfo(null);
    let info: TokenInfo | null = null;
    if (host) {
      try { info = await fetchTokenInfoBlockscout(addr, host); } catch { /* fallback RPC di bawah */ }
    }
    if (!info) {
      try { info = await detectTokenViaRpc(provider, addr); } catch { info = null; }
    }
    setTokenInfo(info);
    setTokenInfoLoading(false);
    if (!info) return; // bukan kontrak token yang dikenal — tidak perlu load holders/transfers

    const isNft = info.standard.toUpperCase().includes('721') || info.standard.toUpperCase().includes('1155');

    setTokenHoldersLoading(true); setTokenHoldersError(null); setTokenHolders([]);
    (async () => {
      try {
        if (!host) throw new Error('Daftar holders butuh instance Blockscout — belum tersedia untuk network ini.');
        setTokenHolders(await fetchTokenHoldersBlockscout(addr, host, info!.decimals));
      } catch (e: any) {
        setTokenHoldersError(e?.message || 'Gagal mengambil daftar holders.');
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
          setTokenTransfersError(e2?.message || 'Gagal mengambil riwayat transfer token dari Blockscout maupun RPC.');
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

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
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

          // Confirmations: selisih block terbaru vs block TX ini (0/null kalau masih pending)
          let confirmations: number | null = null;
          if (tx.blockNumber) {
            try {
              const head = await provider.getBlockNumber();
              confirmations = Math.max(0, head - tx.blockNumber + 1);
            } catch { /* biarkan null kalau head block gagal diambil */ }
          }

          // Effective gas price: pakai dari receipt (akurat untuk tx EIP-1559) kalau ada, fallback ke tx.gasPrice
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

          // Revert reason (best-effort, hanya untuk TX yang gagal) -- dijalankan
          // terpisah supaya hasil utama TX langsung tampil tanpa menunggu simulasi ulang.
          if (receipt && receipt.status === 0) {
            setTxRevertLoading(true);
            fetchRevertReason(provider, tx).then(reason => {
              setTxRevertReason(reason);
              setTxRevertLoading(false);
            });
          }

          // Decode token transfer di dalam log (ERC-20 amount / ERC-721 tokenId),
          // best-effort & terpisah supaya tidak memblokir tampilan utama.
          if (logs.length > 0) {
            (async () => {
              const decimalsCache = new Map<string, { symbol: string; decimals: number } | null>();
              const decodedLogs = await Promise.all(logs.map(async (log): Promise<TxLog> => {
                if (log.topic0 !== ERC20_TRANSFER_TOPIC.replace(/^0x/, '')) return log;
                if (log.rawTopics.length === 4) {
                  // ERC-721 Transfer: tokenId ada di topic ke-3 (indexed), bukan di data
                  return {
                    ...log, transferKind: 'erc721',
                    transferFrom: '0x' + log.rawTopics[1].slice(-40),
                    transferTo: '0x' + log.rawTopics[2].slice(-40),
                    transferAmount: BigInt(log.rawTopics[3]).toString(),
                  };
                }
                if (log.rawTopics.length === 3 && log.rawData && log.rawData !== '0x') {
                  // ERC-20 Transfer: amount ada di data, symbol/decimals diambil dari kontrak token
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
          // fallback: mungkin ini block hash
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
      } else {
        throw new Error('Format tidak dikenali. Masukkan address (0x + 40 hex), TX hash / block hash (0x + 64 hex), atau nomor block.');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal mengambil data dari RPC. Coba ganti RPC atau network.');
    } finally {
      setLoading(false);
    }
  };

  const openBlock = (num: number) => {
    setQuery(String(num));
    setTimeout(() => handleSearch(), 0);
  };

  // ── small building blocks ──────────────────────────────────────────────
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
        {link && (
          <a href={link} target="_blank" rel="noreferrer" style={{ color: COLORS.accent, flexShrink: 0 }} title="Buka di explorer">
            <FaExternalLinkAlt size={11} />
          </a>
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
        <h1><FaCompass style={{ marginRight: '8px' }} />Explorer</h1>
      </header>
      <Navbar />

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
        <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${network.color}`, padding: '18px', marginBottom: '24px' }}>
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
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #9c27b0', padding: '18px' }}>
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
        <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #e8a119', padding: '18px', marginBottom: '24px' }}>
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
                        <div key={`${t.hash}-${i}`} onClick={() => { setQuery(t.hash); setTimeout(() => handleSearch(), 0); }} style={{
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
                          <div key={h.address} onClick={() => { setQuery(h.address); setTimeout(() => handleSearch(), 0); }} style={{
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
        <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #f3ba2f', padding: '18px', marginBottom: '24px' }}>
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
        <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: '2px solid #9c27b0', padding: '18px', marginBottom: '24px' }}>
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
                  <div key={t.hash} onClick={() => { setQuery(t.hash); setTimeout(() => handleSearch(), 0); }} style={{
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
        <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${network.color}`, padding: '18px', marginBottom: '24px' }}>
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
        <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${network.color}`, padding: '18px', marginBottom: '24px' }}>
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
                  <div key={t.hash} onClick={() => { setQuery(t.hash); setTimeout(() => handleSearch(), 0); }} style={{
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
      <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: `2px solid #2196f3`, padding: '18px', marginBottom: '24px' }}>
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

      <style>{`
        .spin-icon { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};