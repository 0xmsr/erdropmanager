import nacl from 'tweetnacl';
import { Keypair as SolKeypair } from '@solana/web3.js';
import bs58 from 'bs58';
import type { GramVersion } from '../types';

import {
  SOLANA_NETWORKS, type SolNetworkCfg,
  getSolBalanceWithFallback, sendSolNative, isValidSolanaAddress,
} from './Solnet';
import {
  SUI_NETWORKS, type SuiNetworkCfg,
  getSuiBalanceWithFallback, sendSui, suiAddressFromPublicKey, isValidSuiAddress, suiFriendlyError,
} from './Suinet';
import {
  APTOS_NETWORKS, type AptosNetworkCfg,
  getAptosBalanceWithFallback, sendAptos, aptosAddressFromPublicKey, isValidAptosAddress, aptFriendlyError,
} from './Aptosnet';
import {
  TRON_NETWORKS, type TronNetworkCfg,
  getTronBalanceSun, tronSendTrx, tronAddressFromPrivateKey, isValidTronAddress, tronFriendlyError,
  SUN_PER_TRX, trxToSun,
} from './Tronnet';
import {
  COSMOS_NETWORKS, type AtomNetworkCfg,
  getAtomBalanceWithFallback, sendAtom, cosmosAddressFromPrivateKey, isValidCosmosAddress, atomFriendlyError,
} from './Cosmosnet';
import {
  AXIOME_NETWORKS, type AxmNetworkCfg,
  getAxmBalanceWithFallback, sendAxm, axiomeAddressFromPrivateKey, isValidAxiomeAddress, axmFriendlyError,
} from './Axiomenet';
import {
  GRAM_NETWORKS, type GramNetworkCfg,
  getGramBalanceWithFallback, sendGram, gramAddressFromPrivateKey, isValidGramAddress, gramFriendlyError,
  gramTxExplorerUrl,
} from './Gramnet';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr
//
// ── Multi-Chain Agent (v2.4) ──────────────────────────────────────────────
// Perluasan "Rekt" AI Assistant ke luar EVM: Solana, Sui, Aptos, Tron,
// Cosmos Hub, Axiome, dan Gram (TON). Sengaja dipisah dari AIAssistant.tsx
// update berikutnya — lihat Changelog v2.4.

export type ChainKey = 'sol' | 'sui' | 'apt' | 'tron' | 'atom' | 'axm' | 'gram';

export const CHAIN_KEYS: ChainKey[] = ['sol', 'sui', 'apt', 'tron', 'atom', 'axm', 'gram'];

export interface MultiChainChainConfig {
  privateKey: string;
  networkId: string;
  gramVersion?: GramVersion;
}

export interface MultiChainAgentConfig {
  sol?: MultiChainChainConfig;
  sui?: MultiChainChainConfig;
  apt?: MultiChainChainConfig;
  tron?: MultiChainChainConfig;
  atom?: MultiChainChainConfig;
  axm?: MultiChainChainConfig;
  gram?: MultiChainChainConfig;
  autopilotEnabled: boolean;
  thresholds: Partial<Record<ChainKey, number>>;
}

export const MULTI_CHAIN_CONFIG_KEY = 'rektMultiChainConfig';

// Default threshold auto-eksekusi ("aksi kecil/rutin" — di bawah nilai ini,
// PaymentSkill langsung jalan tanpa klik kalau autopilot ON; di atasnya
// tetap wajib klik "Jalankan" manual, sama seperti EVM Agent selama ini).
export const DEFAULT_MULTI_CHAIN_THRESHOLDS: Record<ChainKey, number> = {
  sol: 0.05, sui: 1, apt: 1, tron: 20, atom: 0.5, axm: 5, gram: 1,
};

export const loadMultiChainConfig = (): MultiChainAgentConfig => {
  try {
    const raw = JSON.parse(localStorage.getItem(MULTI_CHAIN_CONFIG_KEY) || '{}');
    return {
      autopilotEnabled: !!raw.autopilotEnabled,
      thresholds: { ...DEFAULT_MULTI_CHAIN_THRESHOLDS, ...(raw.thresholds || {}) },
      sol: raw.sol, sui: raw.sui, apt: raw.apt, tron: raw.tron, atom: raw.atom, axm: raw.axm, gram: raw.gram,
    };
  } catch {
    return { autopilotEnabled: false, thresholds: { ...DEFAULT_MULTI_CHAIN_THRESHOLDS } };
  }
};

export const saveMultiChainConfig = (cfg: MultiChainAgentConfig) => {
  try { localStorage.setItem(MULTI_CHAIN_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
};

interface ChainMeta {
  label: string;
  symbol: string;
  color: string;
  networks: { id: string; name: string }[];
}

export const CHAIN_META: Record<ChainKey, ChainMeta> = {
  sol:  { label: 'Solana',        symbol: 'SOL',  color: '#9945FF', networks: SOLANA_NETWORKS },
  sui:  { label: 'Sui',           symbol: 'SUI',  color: '#4DA2FF', networks: SUI_NETWORKS },
  apt:  { label: 'Aptos',         symbol: 'APT',  color: '#00D2AA', networks: APTOS_NETWORKS },
  tron: { label: 'Tron',          symbol: 'TRX',  color: '#EF0027', networks: TRON_NETWORKS },
  atom: { label: 'Cosmos Hub',    symbol: 'ATOM', color: '#2E3148', networks: COSMOS_NETWORKS },
  axm:  { label: 'Axiome',        symbol: 'AXM',  color: '#75bbe9', networks: AXIOME_NETWORKS },
  gram: { label: 'Gram (TON)',    symbol: 'GRAM', color: '#0098EA', networks: GRAM_NETWORKS },
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return bytes;
}

function getNetworkFor<T extends { id: string }>(list: T[], networkId: string | undefined): T {
  return (networkId ? list.find(n => n.id === networkId) : undefined) || list[0];
}

export function getSelectedNetwork(chain: ChainKey, networkId: string | undefined) {
  return getNetworkFor(CHAIN_META[chain].networks as any, networkId);
}

// Address selalu diturunkan langsung dari Private Key yang diisi user (tidak
// pernah disimpan terpisah) — konsisten dengan getLocalEVMWalletAddress().
export async function getMultiChainAddress(chain: ChainKey, privateKey: string, gramVersion?: GramVersion): Promise<string> {
  if (!privateKey?.trim()) return '';
  try {
    switch (chain) {
      case 'sol':
        return SolKeypair.fromSecretKey(bs58.decode(privateKey.trim())).publicKey.toBase58();
      case 'sui': {
        const kp = nacl.sign.keyPair.fromSeed(hexToBytes(privateKey));
        return suiAddressFromPublicKey(kp.publicKey);
      }
      case 'apt': {
        const kp = nacl.sign.keyPair.fromSeed(hexToBytes(privateKey));
        return aptosAddressFromPublicKey(kp.publicKey);
      }
      case 'tron':
        return tronAddressFromPrivateKey(privateKey);
      case 'atom':
        return await cosmosAddressFromPrivateKey(privateKey);
      case 'axm':
        return await axiomeAddressFromPrivateKey(privateKey);
      case 'gram':
        return gramAddressFromPrivateKey(privateKey, gramVersion || 'v5r1');
      default:
        return '';
    }
  } catch {
    return '';
  }
}

export function isValidChainAddress(chain: ChainKey, address: string): boolean {
  switch (chain) {
    case 'sol': return isValidSolanaAddress(address);
    case 'sui': return isValidSuiAddress(address);
    case 'apt': return isValidAptosAddress(address);
    case 'tron': return isValidTronAddress(address);
    case 'atom': return isValidCosmosAddress(address);
    case 'axm': return isValidAxiomeAddress(address);
    case 'gram': return isValidGramAddress(address);
    default: return false;
  }
}

export async function getMultiChainBalance(chain: ChainKey, networkId: string | undefined, address: string): Promise<number> {
  switch (chain) {
    case 'sol': {
      const net = getSelectedNetwork('sol', networkId) as SolNetworkCfg;
      const lamports = await getSolBalanceWithFallback(net, address);
      return lamports / 1_000_000_000;
    }
    case 'sui': {
      const net = getSelectedNetwork('sui', networkId) as SuiNetworkCfg;
      return await getSuiBalanceWithFallback(net, address);
    }
    case 'apt': {
      const net = getSelectedNetwork('apt', networkId) as AptosNetworkCfg;
      return await getAptosBalanceWithFallback(net, address);
    }
    case 'tron': {
      const net = getSelectedNetwork('tron', networkId) as TronNetworkCfg;
      const sun = await getTronBalanceSun(net, address);
      return sun / SUN_PER_TRX;
    }
    case 'atom': {
      const net = getSelectedNetwork('atom', networkId) as AtomNetworkCfg;
      return await getAtomBalanceWithFallback(net, address);
    }
    case 'axm': {
      const net = getSelectedNetwork('axm', networkId) as AxmNetworkCfg;
      return await getAxmBalanceWithFallback(net, address);
    }
    case 'gram': {
      const net = getSelectedNetwork('gram', networkId) as GramNetworkCfg;
      return await getGramBalanceWithFallback(net, address);
    }
    default:
      throw new Error(`Chain ${chain} tidak dikenal.`);
  }
}

export async function sendMultiChainNative(
  chain: ChainKey,
  networkId: string | undefined,
  privateKey: string,
  toAddress: string,
  amount: number,
  memo: string = '',
  gramVersion?: GramVersion,
): Promise<string> {
  switch (chain) {
    case 'sol': {
      const net = getSelectedNetwork('sol', networkId) as SolNetworkCfg;
      return await sendSolNative(net, privateKey, toAddress, amount);
    }
    case 'sui': {
      const net = getSelectedNetwork('sui', networkId) as SuiNetworkCfg;
      return await sendSui(net, privateKey, toAddress, amount);
    }
    case 'apt': {
      const net = getSelectedNetwork('apt', networkId) as AptosNetworkCfg;
      return await sendAptos(net, privateKey, toAddress, amount);
    }
    case 'tron': {
      const net = getSelectedNetwork('tron', networkId) as TronNetworkCfg;
      const fromAddress = tronAddressFromPrivateKey(privateKey);
      return await tronSendTrx(net, fromAddress, toAddress, trxToSun(String(amount)), privateKey);
    }
    case 'atom': {
      const net = getSelectedNetwork('atom', networkId) as AtomNetworkCfg;
      return await sendAtom(net, privateKey, toAddress, amount, memo);
    }
    case 'axm': {
      const net = getSelectedNetwork('axm', networkId) as AxmNetworkCfg;
      return await sendAxm(net, privateKey, toAddress, amount, memo);
    }
    case 'gram': {
      const net = getSelectedNetwork('gram', networkId) as GramNetworkCfg;
      const hash = await sendGram(net, privateKey, toAddress, amount, memo, gramVersion || 'v5r1');
      if (!hash) {
        throw new Error('Transaksi terkirim tapi konfirmasi belum kelihatan on-chain — cek manual dulu di explorer sebelum retry (bisa saja tetap landed meski konfirmasi timeout).');
      }
      return hash;
    }
    default:
      throw new Error(`Chain ${chain} tidak dikenal.`);
  }
}

export function chainFriendlyError(chain: ChainKey, e: any): string {
  switch (chain) {
    case 'sui': return suiFriendlyError(e);
    case 'apt': return aptFriendlyError(e);
    case 'tron': return tronFriendlyError(String(e?.message || e));
    case 'atom': return atomFriendlyError(e);
    case 'axm': return axmFriendlyError(e);
    case 'gram': return gramFriendlyError(e);
    default: return e?.message || String(e);
  }
}

export function explorerAddressUrl(chain: ChainKey, networkId: string | undefined, address: string): string {
  const net: any = getSelectedNetwork(chain, networkId);
  const base = (net?.explorerUrl || '').replace(/\/$/, '');
  if (!base) return '';
  switch (chain) {
    case 'sol':  return `${base}/account/${address}${(net as SolNetworkCfg).clusterParam || ''}`;
    case 'sui':  return `${base}/${address}`;
    case 'apt':  return `${base}/${address}?network=${net.id}`;
    case 'tron': return `${base}/address/${address}`;
    case 'atom': return `${base}/address/${address}`;
    case 'axm':  return `${base}/account/${address}`;
    case 'gram': return `${base}/address/${address}`;
    default: return base;
  }
}

export function explorerTxUrl(chain: ChainKey, networkId: string | undefined, hash: string): string {
  const net: any = getSelectedNetwork(chain, networkId);
  const base = (net?.explorerUrl || '').replace(/\/$/, '');
  if (!base) return '';
  switch (chain) {
    case 'sol':  return `${base}/tx/${hash}${(net as SolNetworkCfg).clusterParam || ''}`;
    case 'sui':  return `${base.replace(/\/account$/, '/tx')}/${hash}`;
    case 'apt':  return `${base.replace(/\/account$/, '/txn')}/${hash}?network=${net.id}`;
    case 'tron': return `${base}/transaction/${hash}`;
    case 'atom': return `${base}/txs/${hash}`;
    case 'axm':  return `${base}/tx/${hash}`;
    case 'gram': return gramTxExplorerUrl(net as GramNetworkCfg, hash);
    default: return base;
  }
}

export interface MultiChainSkillResult {
  resultMsg: string;
  txHash?: string;
}

const shortAddr = (a: string) => a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

// Resolusi placeholder "__MYADDR__" (address milik wallet Multi-Chain Agent
// sendiri) — mirror pola "__WALLET__" di EVM Agent. Placeholder lain (nama
// kontrak dsb) belum relevan di v2.4 karena skill masih native-token only.
export async function executeMultiChainSkill(
  chain: ChainKey,
  skill: string,
  rawInput: Record<string, string>,
  cfg: MultiChainAgentConfig,
): Promise<MultiChainSkillResult> {
  const chainCfg = cfg[chain];
  const meta = CHAIN_META[chain];
  if (!chainCfg?.privateKey) {
    throw new Error(`Wallet ${meta.label} belum dikonfigurasi. Isi Private Key di panel 🌐 Multi-Chain Agent → ${meta.label}.`);
  }
  const myAddress = await getMultiChainAddress(chain, chainCfg.privateKey, chainCfg.gramVersion);
  if (!myAddress) {
    throw new Error(`Private Key ${meta.label} tidak valid — cek kembali formatnya.`);
  }
  const resolveAddr = (val: string | undefined): string =>
    (!val || val === '__MYADDR__') ? myAddress : val;

  if (skill === 'BalanceSkill') {
    const address = resolveAddr(rawInput.address);
    if (!isValidChainAddress(chain, address)) throw new Error(`Address ${meta.label} tidak valid: ${address}`);
    const bal = await getMultiChainBalance(chain, chainCfg.networkId, address);
    const net = getSelectedNetwork(chain, chainCfg.networkId);
    const link = explorerAddressUrl(chain, chainCfg.networkId, address);
    return {
      resultMsg: `🌐 **BalanceSkill (${meta.label})** ✅\n\n- Address: \`${shortAddr(address)}\`\n- Saldo: **${bal} ${meta.symbol}**\n- Network: ${(net as any).name}${link ? `\n- [Lihat di Explorer ↗](${link})` : ''}`,
    };
  }

  if (skill === 'PaymentSkill') {
    const to = resolveAddr(rawInput.to);
    const amount = parseFloat(rawInput.amount || '0');
    if (!to) throw new Error('Address tujuan ("to") wajib diisi.');
    if (!isValidChainAddress(chain, to)) throw new Error(`Address tujuan ${meta.label} tidak valid: ${to}`);
    if (!(amount > 0)) throw new Error('Jumlah yang dikirim harus lebih dari 0.');
    const net = getSelectedNetwork(chain, chainCfg.networkId);
    let txHash: string;
    try {
      txHash = await sendMultiChainNative(chain, chainCfg.networkId, chainCfg.privateKey, to, amount, rawInput.memo || '', chainCfg.gramVersion);
    } catch (e: any) {
      throw new Error(chainFriendlyError(chain, e));
    }
    const link = explorerTxUrl(chain, chainCfg.networkId, txHash);
    return {
      resultMsg: `🌐 **PaymentSkill (${meta.label})** ✅ TRANSAKSI TERKIRIM\n\n- Dari: \`${shortAddr(myAddress)}\`\n- Ke: \`${shortAddr(to)}\`\n- Jumlah: **${amount} ${meta.symbol}**\n- Network: ${(net as any).name}\n- Tx: ${link ? `[${txHash.slice(0, 16)}...](${link})` : `\`${txHash}\``}`,
      txHash,
    };
  }

  throw new Error(`Skill "${skill}" belum didukung untuk ${meta.label} — baru BalanceSkill & PaymentSkill yang tersedia di Multi-Chain Agent v2.4.`);
}

// Dipakai executeChainTask() di AIAssistant.tsx untuk memutuskan apakah
// sebuah PaymentSkill boleh langsung jalan tanpa klik ("autopilot aksi
// kecil/rutin") atau tetap wajib konfirmasi manual (nominal besar).
export function shouldAutoExecutePayment(chain: ChainKey, amount: number, cfg: MultiChainAgentConfig): boolean {
  if (!cfg.autopilotEnabled) return false;
  const threshold = cfg.thresholds?.[chain];
  if (threshold === undefined || threshold === null || Number.isNaN(threshold)) return false;
  return amount > 0 && amount <= threshold;
}

// Fragment prompt untuk buildOpencodeSystemPrompt() — menjelaskan ke AI
// skill apa saja yang tersedia dan bagaimana format action __CHAIN__.
export function buildMultiChainPromptFragment(cfg: MultiChainAgentConfig): string {
  const configuredChains = CHAIN_KEYS.filter(c => cfg[c]?.privateKey);
  const statusLine = CHAIN_KEYS.map(c => {
    const meta = CHAIN_META[c];
    const configured = !!cfg[c]?.privateKey;
    const threshold = cfg.thresholds?.[c];
    return `${c}=${meta.label}(${configured ? 'configured' : 'not configured'}${configured && cfg.autopilotEnabled && threshold ? `, autopilot≤${threshold}${meta.symbol}` : ''})`;
  }).join(', ');
  return `Multi-Chain Agent (v2.4): ${statusLine}. Autopilot global: ${cfg.autopilotEnabled ? 'ON' : 'OFF'}.\n` +
    `MULTI-CHAIN ACTIONS: kalau user minta cek saldo atau kirim token native di luar EVM (Solana/SOL, Sui/SUI, Aptos/APT, Tron/TRX, Cosmos Hub/ATOM, Axiome/AXM, Gram-TON/GRAM), gunakan blok JSON aksi dengan type "__CHAIN__". Payload wajib: {"chain":"sol|sui|apt|tron|atom|axm|gram","skill":"BalanceSkill|PaymentSkill", ...field lain}. BalanceSkill payload opsional {"address":"__MYADDR__"} (default cek wallet sendiri kalau tidak diisi). PaymentSkill payload wajib {"to":"<address tujuan>","amount":"<jumlah dalam unit native, contoh 0.5>"}, opsional {"memo":"..."} (dipakai di atom/axm/gram). JANGAN PERNAH menebak address wallet user sendiri — pakai placeholder "__MYADDR__" untuk itu. Chain yang belum "configured" tidak bisa dieksekusi — kalau user minta chain yang belum configured, suruh dia isi Private Key dulu di panel 🌐 Multi-Chain Agent. ` +
    `ATURAN AUTOPILOT: kalau Autopilot global ON dan jumlah PaymentSkill ≤ threshold chain tsb (lihat "autopilot≤..." di atas), transaksi akan otomatis dieksekusi TANPA klik konfirmasi dari user — jadi HANYA usulkan PaymentSkill sejumlah itu kalau user memang memintanya secara eksplisit (jangan berinisiatif kirim dana sendiri). Kalau jumlahnya di atas threshold atau autopilot OFF, transaksi tetap perlu diklik manual oleh user sebelum benar-benar terkirim — beri tahu user itu di balasanmu. Private key TIDAK PERNAH dikirim ke AI/OpenCode; signing selalu terjadi lokal di browser. Contoh: \`json [{"type":"__CHAIN__","label":"Kirim 0.01 SOL","payload":{"chain":"sol","skill":"PaymentSkill","to":"...","amount":"0.01"}}] \`` +
    (configuredChains.length === 0 ? `\nBelum ada chain non-EVM yang dikonfigurasi user.` : '');
}
