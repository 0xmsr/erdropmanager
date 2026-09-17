import React, { useState, useRef, useEffect, useCallback } from 'react';

import { Navbar } from '../components/Navbar';
import { ethers } from 'ethers';

import { type Task, type Transaction, type PortfolioToken } from '../types';

import {
  FaRobot, FaPaperPlane, FaTrash, FaLightbulb, FaCheckCircle,
  FaFileImport, FaTimes, FaFileAlt,
  FaRegCopy, FaCheck, FaBrain,
  FaChevronDown, FaChevronUp,
  FaEthereum, FaWallet, FaExchangeAlt, FaCoins, FaLink, FaSpinner, FaSyncAlt, FaGlobe,
} from 'react-icons/fa';

// v2.4 — Multi-Chain Agent: perluasan Rekt ke luar EVM (Solana, Sui, Aptos,
// Tron, Cosmos Hub, Axiome, Gram/TON). Lihat file untuk detail skill & config.
// NOTE: sesuaikan path import ini kalau struktur folder project berbeda —
// asumsi net file (Solnet.ts dst) ada di src/pages/wallet-gen/networks/.
import {
  type ChainKey, CHAIN_KEYS, CHAIN_META,
  type MultiChainAgentConfig, loadMultiChainConfig, saveMultiChainConfig,
  getMultiChainAddress, executeMultiChainSkill, shouldAutoExecutePayment,
  buildMultiChainPromptFragment, explorerTxUrl,
} from './wallet-gen/network/multiChainAgent';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  actions?: TaskAction[];
  model?: string;
}

interface TaskAction {
  type: 'ADD' | 'UPDATE' | 'DELETE' | 'UPDATE_STATUS' | 'TOGGLE_DONE' | '__EVM__' | '__CHAIN__' | '__LEARN_WORKFLOW__';
  payload: any;
  label: string;
  applied?: boolean;
}

interface ImportedContext {
  name: string;
  content: string;
  type: 'file' | 'url';
}

interface OtakRektMemory {
  id: string;
  category: 'fakta' | 'preferensi' | 'tujuan' | 'catatan' | 'lainnya';
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  hitCount?: number;
}

const STORAGE_KEY        = 'rektChatHistoryV2';
const OTAK_REKT_KEY      = 'rektOtakMemory';
const EVM_CONFIG_KEY  = 'evmAgentConfig';
const MAX_SAVED_MESSAGES = 120;
const REKT_COLOR         = '#7c7c7c';
const EVM_COLOR       = '#7d7d7d';
const MULTI_CHAIN_COLOR = '#8fb8ff';
const EVOLUTION_COLOR = '#a2a2a2';
const AGENT_COLOR = '#bbbbbb';
const ONLINE_STATUS_COLOR = '#4caf50';
const LOCAL_MODE_COLOR    = '#ffa726';

interface WorkflowStep {
  skill: string;
  paramShape: string[];
}

interface LearnedWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  trigger?: string;
  source: 'auto' | 'ai' | 'manual';
  enabled: boolean;
  usageCount: number;
  successCount: number;
  failCount: number;
  createdAt: number;
  updatedAt: number;
}

interface WorkflowHistoryEntry {
  skill: string;
  paramShape: string[];
  success: boolean;
  timestamp: number;
}

const WORKFLOW_HISTORY_KEY  = 'rektWorkflowHistory';
const LEARNED_WORKFLOWS_KEY = 'rektLearnedWorkflows';
const MAX_WORKFLOW_HISTORY  = 250;
const WORKFLOW_PATTERN_MIN_OCCURRENCE = 3;
const WORKFLOW_SEQUENCE_WINDOW_MS     = 5 * 60 * 1000;

type AutopilotLogEntry = { taskName: string; mode: 'sandbox' | 'live'; status: 'success' | 'skipped' | 'error'; summary: string; timestamp: number };

interface EVMConfig {
  rpcUrl: string;
  privateKey: string;
  chainId: number;
  networkName: string;
  dexRouterAddress: string;
  usdcAddress: string;
  wethAddress: string;
  nftContractAddress: string;
  explorerUrl: string;
  customTokens: { symbol: string; address: string }[];
  contractsByChain?: Record<number, {
    dexRouterAddress: string;
    usdcAddress: string;
    wethAddress: string;
    nftContractAddress: string;
    customTokens: { symbol: string; address: string }[];
  }>;
  gasMode: 'hemat' | 'standard' | 'cepat' | 'custom';
  customGasGwei: string;
}

const NATIVE_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const resolveTokenBySymbol = (cfg: Partial<EVMConfig>, symbol: string): string => {
  const s = symbol.trim().toUpperCase();
  if (!s) return '';
  if (s === 'USDC' && cfg.usdcAddress) return cfg.usdcAddress;
  if (s === 'WETH' && cfg.wethAddress) return cfg.wethAddress;
  const found = (cfg.customTokens || []).find(t => t.symbol.trim().toUpperCase() === s);
  return found?.address || '';
};

type ChainContracts = {
  dexRouterAddress: string;
  usdcAddress: string;
  wethAddress: string;
  nftContractAddress: string;
  customTokens: { symbol: string; address: string }[];
};

const EMPTY_CHAIN_CONTRACTS: ChainContracts = {
  dexRouterAddress: '', usdcAddress: '', wethAddress: '', nftContractAddress: '', customTokens: [],
};

const pickChainContracts = (obj: Partial<EVMConfig>): ChainContracts => ({
  dexRouterAddress: obj.dexRouterAddress || '',
  usdcAddress: obj.usdcAddress || '',
  wethAddress: obj.wethAddress || '',
  nftContractAddress: obj.nftContractAddress || '',
  customTokens: obj.customTokens || [],
});

const switchActiveChain = (cfg: Partial<EVMConfig>, newFields: Partial<EVMConfig>): Partial<EVMConfig> => {
  const oldChainId = cfg.chainId;
  const newChainId = newFields.chainId ?? cfg.chainId;
  const contractsByChain = { ...(cfg.contractsByChain || {}) };
  if (oldChainId != null) contractsByChain[oldChainId] = pickChainContracts(cfg);
  const newContracts = newChainId != null ? (contractsByChain[newChainId] || EMPTY_CHAIN_CONTRACTS) : EMPTY_CHAIN_CONTRACTS;
  return { ...cfg, ...newFields, ...newContracts, contractsByChain };
};

const applyPresetToChainDraft = (savedCfg: Partial<EVMConfig>, formData: Partial<EVMConfig>, newFields: Partial<EVMConfig>): Partial<EVMConfig> => {
  const newChainId = newFields.chainId;
  const saved = newChainId != null ? (savedCfg.contractsByChain?.[newChainId] || EMPTY_CHAIN_CONTRACTS) : EMPTY_CHAIN_CONTRACTS;
  return { ...formData, ...newFields, ...saved };
};

const commitEvmConfigSave = (cfg: Partial<EVMConfig>, formData: Partial<EVMConfig>): Partial<EVMConfig> => {
  const newChainId = formData.chainId ?? cfg.chainId;
  const contractsByChain = { ...(cfg.contractsByChain || {}) };
  if (newChainId != null) contractsByChain[newChainId] = pickChainContracts(formData);
  return { ...cfg, ...formData, contractsByChain };
};

const EVM_CHAIN_PRESETS: Record<string, Partial<EVMConfig>> = {
  ethereum:  { chainId: 1,     networkName: 'Ethereum Mainnet', rpcUrl: 'https://rpc.ankr.com/eth', explorerUrl: 'https://etherscan.io' },
  arbitrum:  { chainId: 42161, networkName: 'Arbitrum One',     rpcUrl: 'https://rpc.ankr.com/arbitrum', explorerUrl: 'https://arbiscan.io' },
  optimism:  { chainId: 10,    networkName: 'Optimism',         rpcUrl: 'https://rpc.ankr.com/optimism', explorerUrl: 'https://optimistic.etherscan.io' },
  base:      { chainId: 8453,  networkName: 'Base',             rpcUrl: 'https://rpc.ankr.com/base', explorerUrl: 'https://basescan.org' },
  polygon:   { chainId: 137,   networkName: 'Polygon',          rpcUrl: 'https://rpc.ankr.com/polygon', explorerUrl: 'https://polygonscan.com' },
  bnb:       { chainId: 56,    networkName: 'BNB Chain',        rpcUrl: 'https://rpc.ankr.com/bsc', explorerUrl: 'https://bscscan.com' },
  sepolia:   { chainId: 11155111, networkName: 'Sepolia Testnet',rpcUrl: 'https://rpc.ankr.com/eth_sepolia', explorerUrl: 'https://sepolia.etherscan.io' },
  kryvora:   { chainId: 73829164, networkName: 'Kryvora Testnet',rpcUrl: 'https://rpc-testnet.kryvora.network', explorerUrl: 'https://explorer-testnet.kryvora.network/' },
  robinhood: { chainId: 4663, networkName: 'Robin Hood Mainnet',rpcUrl: 'https://rpc.mainnet.chain.robinhood.com', explorerUrl: 'https://robinhoodchain.blockscout.com/' },
};

const EVM_FALLBACK_RPCS: Record<number, string[]> = {
  1:        ['https://eth.llamarpc.com', 'https://1rpc.io/eth', 'https://ethereum-rpc.publicnode.com'],
  42161:    ['https://arb1.arbitrum.io/rpc', 'https://1rpc.io/arb', 'https://arbitrum-one-rpc.publicnode.com'],
  10:       ['https://mainnet.optimism.io', 'https://1rpc.io/op', 'https://optimism-rpc.publicnode.com'],
  8453:     ['https://mainnet.base.org', 'https://1rpc.io/base', 'https://base-rpc.publicnode.com'],
  137:      ['https://polygon-rpc.com', 'https://1rpc.io/matic', 'https://polygon-bor-rpc.publicnode.com'],
  56:       ['https://bsc-dataseed1.binance.org', 'https://1rpc.io/bnb', 'https://bsc-rpc.publicnode.com'],
  11155111: ['https://rpc.sepolia.org', 'https://1rpc.io/sepolia', 'https://ethereum-sepolia-rpc.publicnode.com'],
  4663:     ['https://robinhood.api.pocket.network','wss://robinhood-rpc.publicnode.com','https://robinhood.rpc.blxrbdn.com','https://rpc.nodeflare.app/robinhood/public']
};

const EVM_PROVIDER_TIMEOUT_MS = 6000;

async function tryConnectProvider(rpcUrl: string, chainId?: number): Promise<ethers.providers.JsonRpcProvider | null> {
  try {
    const p = new ethers.providers.JsonRpcProvider(rpcUrl, chainId ? { chainId, name: 'evm-agent' } : undefined);
    await Promise.race([
      p.getBlockNumber(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), EVM_PROVIDER_TIMEOUT_MS)),
    ]);
    return p;
  } catch {
    return null;
  }
}

async function getResilientEvmProvider(rpcUrl: string, chainId?: number): Promise<ethers.providers.JsonRpcProvider> {
  if (!rpcUrl) throw new Error('RPC URL belum diisi di ⚙️ Konfigurasi EVM Agent.');
  const candidates = [rpcUrl, ...(chainId ? (EVM_FALLBACK_RPCS[chainId] || []) : [])]
    .filter((url, i, arr) => url && arr.indexOf(url) === i); 
  for (const url of candidates) {
    const p = await tryConnectProvider(url, chainId);
    if (p) return p;
  }
  throw new Error(
    `Tidak bisa connect ke RPC (dicoba ${candidates.length} endpoint${candidates.length > 1 ? ` termasuk fallback` : ''}). ` +
    `RPC utama mungkin down/di-rate-limit — cek koneksi atau ganti RPC URL di ⚙️ Konfigurasi EVM Agent.`
  );
}

interface EVMTaskLog {
  id: string;
  skill: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input: Record<string, string>;
  result?: string;
  txHash?: string;
  timestamp: number;
}

interface ChainTaskLog {
  id: string;
  chain: ChainKey;
  skill: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input: Record<string, string>;
  result?: string;
  txHash?: string;
  timestamp: number;
}

const loadEVMConfig = (): Partial<EVMConfig> => {
  try { return JSON.parse(localStorage.getItem(EVM_CONFIG_KEY) || '{}'); } catch { return {}; }
};

const saveEVMConfig = (cfg: Partial<EVMConfig>) => {
  try { localStorage.setItem(EVM_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
};

const getLocalEVMWalletAddress = (cfg: Partial<EVMConfig>): string => {
  try { return cfg.privateKey ? new ethers.Wallet(cfg.privateKey.trim()).address : ''; } catch { return ''; }
};

interface WatchedWallet {
  id: string;
  label: string;
  address: string;
  chainKey: string;
}

const WATCH_WALLETS_KEY = 'rektWatchWallets';
const EXPLORER_API_KEY_STORAGE = 'rektExplorerApiKey';

const loadWatchWallets = (): WatchedWallet[] => {
  try { return JSON.parse(localStorage.getItem(WATCH_WALLETS_KEY) || '[]'); } catch { return []; }
};
const saveWatchWallets = (list: WatchedWallet[]) => {
  try { localStorage.setItem(WATCH_WALLETS_KEY, JSON.stringify(list)); } catch {}
};

const ETHERSCAN_V2_SUPPORTED_CHAIN_IDS = new Set([1, 42161, 10, 8453, 137, 56, 11155111]);

const OPENCODE_CONFIG_KEY   = 'opencodeAgentConfig';
const DEFAULT_OPENCODE_URL  = 'http://localhost:4096';

const OPENCODE_TUNNEL_COMMAND =
  'npx --yes concurrently -k -n opencode,tunnel ' +
  '"npx --yes opencode-ai serve" ' +
  '"npx --yes cloudflared tunnel --url http://localhost:4096"';
const isMobileDevice = (): boolean => {
  try {
    const ua = navigator.userAgent || '';
    const uaIsMobile = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
    const touchNarrow = typeof window !== 'undefined' && window.innerWidth <= 820 && 'ontouchstart' in window;
    return uaIsMobile || touchNarrow;
  } catch { return false; }
};

const isLocalhostUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
  } catch { return false; }
};

const isHopelessOpencodeTarget = (baseUrl: string): boolean =>
  isMobileDevice() && isLocalhostUrl(baseUrl);
interface OpencodeConfig {
  baseUrl: string;
  sessionId?: string;
  learningSessionId?: string;
  model?: string;
}

const loadOpencodeConfig = (): OpencodeConfig => {
  try {
    const saved = JSON.parse(localStorage.getItem(OPENCODE_CONFIG_KEY) || '{}');
    return {
      baseUrl: saved.baseUrl || DEFAULT_OPENCODE_URL,
      sessionId: saved.sessionId || undefined,
      learningSessionId: saved.learningSessionId || undefined,
      model: saved.model || undefined,
    };
  } catch { return { baseUrl: DEFAULT_OPENCODE_URL }; }
};

const saveOpencodeConfig = (cfg: OpencodeConfig) => {
  try { localStorage.setItem(OPENCODE_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
};

// --- Robust fetch helpers -------------------------------------------------
// NOTE: calling `ctrl.abort()` WITHOUT an explicit reason makes some fetch
// implementations (Hermes/React Native WebView, some Chromium builds) throw
// the unhelpful `TypeError: signal is aborted without reason` instead of a
// normal AbortError. We always pass a reason so downstream code can tell a
// real timeout apart from a network failure and show a useful message.
const abortWithReason = (ctrl: AbortController, reason: string) => {
  try { ctrl.abort(new DOMException(reason, 'TimeoutError')); }
  catch { try { (ctrl as any).abort(reason); } catch { ctrl.abort(); } }
};

const isAbortTimeout = (err: unknown): boolean =>
  err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError');

/** Turn a raw fetch/abort error into a short, user-facing Indonesian explanation. */
const describeOpencodeError = (err: unknown): string => {
  if (isAbortTimeout(err)) return 'Server OpenCode tidak merespons dalam waktu yang wajar (timeout).';
  if (err instanceof TypeError) {
    // Covers "Failed to fetch" / "Load failed" / "NetworkError" across browsers.
    return 'Tidak bisa menghubungi server OpenCode — server mati, URL salah, atau diblokir CORS/jaringan.';
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/aborted without reason/i.test(msg)) return 'Koneksi ke server OpenCode terputus tiba-tiba (kemungkinan timeout).';
  return msg || 'Error tidak dikenal saat menghubungi OpenCode.';
};

/** Retry a flaky network call once (skip retry on HTTP 4xx thrown as Error). */
const withOpencodeRetry = async <T,>(fn: () => Promise<T>, retries = 1): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const isClientError = /\(4\d\d\)/.test(msg);
    if (retries > 0 && !isClientError) {
      await new Promise(r => setTimeout(r, 400));
      return withOpencodeRetry(fn, retries - 1);
    }
    throw err;
  }
};

const checkOpencodeHealth = async (baseUrl: string): Promise<boolean> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => abortWithReason(ctrl, 'health-check-timeout'), 2500);
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/global/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    // Different opencode-ai versions report readiness slightly differently.
    return data === null ? true : (data?.healthy !== false);
  } catch { return false; }
};

const splitOpencodeModel = (model?: string): { providerID?: string; modelID?: string } => {
  if (!model || !model.includes('/')) return {};
  const idx = model.indexOf('/');
  return { providerID: model.slice(0, idx), modelID: model.slice(idx + 1) };
};

const ensureOpencodeSession = async (cfg: OpencodeConfig): Promise<string> => {
  const base = cfg.baseUrl.replace(/\/$/, '');
  if (cfg.sessionId) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => abortWithReason(ctrl, 'session-check-timeout'), 4000);
      const check = await fetch(`${base}/session/${cfg.sessionId}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (check.ok) return cfg.sessionId;
    } catch {}
  }
  const res = await fetch(`${base}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Rekt Chat — Airdrop Manager' }),
  });
  if (!res.ok) throw new Error(`Gagal buat session opencode (${res.status})`);
  const session = await res.json();
  const sessionId = session.id as string;
  saveOpencodeConfig({ ...cfg, sessionId });
  return sessionId;
};

const callOpencodeAIOnce = async (cfg: OpencodeConfig, systemPrompt: string, userInput: string): Promise<string> => {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const sessionId = await ensureOpencodeSession(cfg);
  const ctrl = new AbortController();
  const t = setTimeout(() => abortWithReason(ctrl, 'opencode-message-timeout'), 90_000);
  try {
    const res = await fetch(`${base}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        system: systemPrompt,
        ...splitOpencodeModel(cfg.model),
        parts: [{ type: 'text', text: userInput }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`opencode server error (${res.status})${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
    }
    const data = await res.json();
    const parts: any[] = data?.parts || [];
    const text = parts.filter(p => p.type === 'text' && typeof p.text === 'string').map(p => p.text).join('\n').trim();
    if (!text) throw new Error('Balasan kosong dari opencode');
    return text;
  } finally {
    clearTimeout(t);
  }
};

/** Public entrypoint: retries once on timeout/network failure, but never on a real HTTP 4xx. */
const callOpencodeAI = async (cfg: OpencodeConfig, systemPrompt: string, userInput: string): Promise<string> => {
  try {
    return await withOpencodeRetry(() => callOpencodeAIOnce(cfg, systemPrompt, userInput), 1);
  } catch (err) {
    throw new Error(describeOpencodeError(err));
  }
};

const ensureOpencodeLearningSession = async (cfg: OpencodeConfig): Promise<string> => {
  const base = cfg.baseUrl.replace(/\/$/, '');
  if (cfg.learningSessionId) {
    try {
      const check = await fetch(`${base}/session/${cfg.learningSessionId}`);
      if (check.ok) return cfg.learningSessionId;
    } catch {}
  }
  const res = await fetch(`${base}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Rekt Learning — OpenCode History' }),
  });
  if (!res.ok) throw new Error(`Gagal buat learning session opencode (${res.status})`);
  const session = await res.json();
  const learningSessionId = session.id as string;
  saveOpencodeConfig({ ...cfg, learningSessionId });
  return learningSessionId;
};

const callOpencodeLearningAIOnce = async (cfg: OpencodeConfig, systemPrompt: string, userInput: string): Promise<string> => {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const sessionId = await ensureOpencodeLearningSession(cfg);
  const ctrl = new AbortController();
  const t = setTimeout(() => abortWithReason(ctrl, 'opencode-learning-timeout'), 90_000);
  try {
    const res = await fetch(`${base}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        system: systemPrompt,
        ...splitOpencodeModel(cfg.model),
        parts: [{ type: 'text', text: userInput }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`opencode learning server error (${res.status})${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
    }
    const data = await res.json();
    const parts: any[] = data?.parts || [];
    const text = parts.filter(p => p.type === 'text' && typeof p.text === 'string').map(p => p.text).join('\n').trim();
    if (!text) throw new Error('Balasan learning kosong dari opencode');
    return text;
  } finally {
    clearTimeout(t);
  }
};

/** Public entrypoint: retries once on timeout/network failure, but never on a real HTTP 4xx. */
const callOpencodeLearningAI = async (cfg: OpencodeConfig, systemPrompt: string, userInput: string): Promise<string> => {
  try {
    return await withOpencodeRetry(() => callOpencodeLearningAIOnce(cfg, systemPrompt, userInput), 1);
  } catch (err) {
    throw new Error(describeOpencodeError(err));
  }
};

interface OpencodeModelOption {
  value: string;
  label: string;
  providerID: string;
}

const OPENCODE_MODEL_CACHE_KEY = 'opencodeModelCache';

const loadCachedOpencodeModels = (baseUrl: string): { options: OpencodeModelOption[]; defaultValue?: string } | null => {
  try {
    const cache = JSON.parse(localStorage.getItem(OPENCODE_MODEL_CACHE_KEY) || '{}');
    return cache?.[baseUrl] || null;
  } catch { return null; }
};

const saveCachedOpencodeModels = (baseUrl: string, value: { options: OpencodeModelOption[]; defaultValue?: string }) => {
  try {
    const cache = JSON.parse(localStorage.getItem(OPENCODE_MODEL_CACHE_KEY) || '{}');
    cache[baseUrl] = value;
    localStorage.setItem(OPENCODE_MODEL_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

const fetchOpencodeProvidersOnce = async (baseUrl: string): Promise<{ options: OpencodeModelOption[]; defaultValue?: string }> => {
  const base = baseUrl.replace(/\/$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => abortWithReason(ctrl, 'provider-list-timeout'), 6000);
  try {
    const res = await fetch(`${base}/provider`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Gagal ambil daftar provider (${res.status})`);
    const data = await res.json();
    const providers: any[] = Array.isArray(data?.all) ? data.all : [];
    const connected: string[] = Array.isArray(data?.connected) ? data.connected : [];
    const options: OpencodeModelOption[] = [];
    for (const p of providers) {
      if (connected.length > 0 && !connected.includes(p.id)) continue;
      const models = p?.models;
      const modelEntries: [string, any][] = Array.isArray(models)
        ? models.map((m: any) => [m.id, m])
        : models && typeof models === 'object'
          ? Object.entries(models)
          : [];
      for (const [modelId, modelInfo] of modelEntries) {
        options.push({
          value: `${p.id}/${modelId}`,
          label: `${p.name || p.id} — ${modelInfo?.name || modelId}`,
          providerID: p.id,
        });
      }
    }
    let defaultValue: string | undefined;
    const def = data?.default;
    if (def && typeof def === 'object') {
      const firstProviderId = Object.keys(def)[0];
      if (firstProviderId) defaultValue = `${firstProviderId}/${def[firstProviderId]}`;
    }
    return { options, defaultValue };
  } finally {
    clearTimeout(t);
  }
};

/** Public entrypoint: retries once, falls back to last-known-good list from cache, and re-caches on success. */
const fetchOpencodeProviders = async (baseUrl: string): Promise<{ options: OpencodeModelOption[]; defaultValue?: string }> => {
  try {
    const result = await withOpencodeRetry(() => fetchOpencodeProvidersOnce(baseUrl), 1);
    if (result.options.length > 0) saveCachedOpencodeModels(baseUrl, result);
    return result;
  } catch (err) {
    const cached = loadCachedOpencodeModels(baseUrl);
    if (cached && cached.options.length > 0) return cached; // stale-but-useful beats an empty picker
    throw new Error(describeOpencodeError(err));
  }
};

const QUICK_PROMPTS = [
  { icon: '🚀', text: 'Garapin airdrop yang belum selesai hari ini' },
  { icon: '📋', text: 'Tampilkan semua airdrop ongoing beserta linknya' },
  { icon: '📊', text: 'Ringkas progress airdrop hari ini' },
  { icon: '⏰', text: 'Airdrop mana yang mendekati deadline?' },
  { icon: '💰', text: 'Analisis keuangan & portfolio saya' },
  { icon: '🔑', text: 'Tampilkan semua wallet BIP39 saya' },
  { icon: '⛓️', text: 'Semua task todo di WalletGen' },
  { icon: '📊', text: 'Ringkas semua task gabungan airdrop & walletgen' },
  { icon: '🔎', text: 'Cariin project testnet/airdrop baru yang lagi rame dari X & Telegram' },
  { icon: '📡', text: 'Riset status garapan yang lagi ongoing pakai data terbaru dari X & Telegram' },
];

const EVM_QUICK_PROMPTS = [
  { icon: '💎', text: 'Cek saldo wallet EVM saya' },
  { icon: '💱', text: 'Swap 0.0001 ETH ke USDC' },
  { icon: '🌐', text: 'Ganti ke jaringan Arbitrum' },
  { icon: '🔑', text: 'Approve token USDC ke spender' },
  { icon: '🖼️', text: 'Mint NFT di kontrak EVM saya' },
  { icon: '🥩', text: 'Stake 0.01 ETH di contract' },
  { icon: '📡', text: 'Status EVM Agent' },
  { icon: '🔍', text: 'Cek allowance token saya' },
];

const getInitialMessage = (): Message => ({
  role: 'assistant',
  content: `Halo! Saya **Rekt** 🤖 — AI assistant Erdrop Manager.
Saya adalah **Rekt** — adaptive AI agent di atas **OpenCode AI**. OpenCode menjadi reasoning/research engine saya, sementara Rekt menyimpan pola dari histori chat OpenCode dan beradaptasi untuk pencarian airdrop, WL, testnet, project, workflow, dan preferensi kamu.
`,
  timestamp: Date.now(),
});

const loadMessages = (): Message[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [getInitialMessage()];
    const parsed: Message[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [getInitialMessage()];
  } catch { return [getInitialMessage()]; }
};

const loadMemories = (): OtakRektMemory[] => {
  try { return JSON.parse(localStorage.getItem(OTAK_REKT_KEY) || '[]'); } catch { return []; }
};

const saveMemories = (mems: OtakRektMemory[]) => {
  try { localStorage.setItem(OTAK_REKT_KEY, JSON.stringify(mems.slice(-300))); } catch {}
};

const REKT_OPENCODE_LEARNING_KEY = 'rektOpencodeLearningV1';
const REKT_OPENCODE_REVIEW_INTERVAL = 8;
const REKT_OPENCODE_HISTORY_LIMIT = 40;

interface RektOpencodeLearning {
  version: 1;
  updatedAt: number;
  reviewedTurns: number;
  totalTurns: number;
  lessons: string[];
  userPreferences: string[];
  researchPatterns: string[];
  airdropPatterns: string[];
  wlPatterns: string[];
  successfulApproaches: string[];
  avoidApproaches: string[];
  discoveredEntities: string[];
}

const EMPTY_REKT_OPENCODE_LEARNING: RektOpencodeLearning = {
  version: 1,
  updatedAt: 0,
  reviewedTurns: 0,
  totalTurns: 0,
  lessons: [],
  userPreferences: [],
  researchPatterns: [],
  airdropPatterns: [],
  wlPatterns: [],
  successfulApproaches: [],
  avoidApproaches: [],
  discoveredEntities: [],
};

const loadRektOpencodeLearning = (): RektOpencodeLearning => {
  try {
    const raw = JSON.parse(localStorage.getItem(REKT_OPENCODE_LEARNING_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return EMPTY_REKT_OPENCODE_LEARNING;
    return {
      ...EMPTY_REKT_OPENCODE_LEARNING,
      ...raw,
      lessons: Array.isArray(raw.lessons) ? raw.lessons.slice(-80) : [],
      userPreferences: Array.isArray(raw.userPreferences) ? raw.userPreferences.slice(-60) : [],
      researchPatterns: Array.isArray(raw.researchPatterns) ? raw.researchPatterns.slice(-60) : [],
      airdropPatterns: Array.isArray(raw.airdropPatterns) ? raw.airdropPatterns.slice(-60) : [],
      wlPatterns: Array.isArray(raw.wlPatterns) ? raw.wlPatterns.slice(-60) : [],
      successfulApproaches: Array.isArray(raw.successfulApproaches) ? raw.successfulApproaches.slice(-60) : [],
      avoidApproaches: Array.isArray(raw.avoidApproaches) ? raw.avoidApproaches.slice(-60) : [],
      discoveredEntities: Array.isArray(raw.discoveredEntities) ? raw.discoveredEntities.slice(-120) : [],
    };
  } catch {
    return EMPTY_REKT_OPENCODE_LEARNING;
  }
};

const saveRektOpencodeLearning = (learning: RektOpencodeLearning) => {
  try { localStorage.setItem(REKT_OPENCODE_LEARNING_KEY, JSON.stringify(learning)); } catch {}
};

const compactRektLearning = (learning: RektOpencodeLearning): string => JSON.stringify({
  lessons: learning.lessons.slice(-18),
  userPreferences: learning.userPreferences.slice(-12),
  researchPatterns: learning.researchPatterns.slice(-12),
  airdropPatterns: learning.airdropPatterns.slice(-12),
  wlPatterns: learning.wlPatterns.slice(-12),
  successfulApproaches: learning.successfulApproaches.slice(-12),
  avoidApproaches: learning.avoidApproaches.slice(-12),
  discoveredEntities: learning.discoveredEntities.slice(-30),
});

const mergeUniqueStrings = (base: string[], incoming: unknown, max = 80): string[] => {
  const items = Array.isArray(incoming) ? incoming : [];
  const normalized = items
    .filter((x): x is string => typeof x === 'string')
    .map(x => x.trim())
    .filter(Boolean);
  const seen = new Set(base.map(x => x.toLowerCase()));
  const out = [...base];
  for (const item of normalized) {
    const k = item.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(item); }
  }
  return out.slice(-max);
};

const buildRektLearningContext = (learning: RektOpencodeLearning): string => {
  if (!learning.totalTurns && learning.lessons.length === 0) {
    return '\n=== REKT ADAPTIVE MEMORY ===\nBelum ada pembelajaran dari histori OpenCode. Pelajari pola user mulai dari percakapan ini.';
  }
  return `
=== REKT ADAPTIVE MEMORY — BELAJAR DARI HISTORI OPENCODE ===
Rekt adalah layer adaptive di atas OpenCode AI. Gunakan konteks ini sebagai memori kerja, tetapi jangan menganggapnya sebagai fakta on-chain terkini.
Total turn yang sudah dipelajari: ${learning.reviewedTurns}

Lessons:
${learning.lessons.slice(-18).map(x => `- ${x}`).join('\n') || '-'}

Preferensi user:
${learning.userPreferences.slice(-12).map(x => `- ${x}`).join('\n') || '-'}

Pola riset:
${learning.researchPatterns.slice(-12).map(x => `- ${x}`).join('\n') || '-'}

Pola airdrop:
${learning.airdropPatterns.slice(-12).map(x => `- ${x}`).join('\n') || '-'}

Pola WL:
${learning.wlPatterns.slice(-12).map(x => `- ${x}`).join('\n') || '-'}

Pendekatan yang terbukti membantu:
${learning.successfulApproaches.slice(-12).map(x => `- ${x}`).join('\n') || '-'}

Pendekatan yang sebaiknya dihindari:
${learning.avoidApproaches.slice(-12).map(x => `- ${x}`).join('\n') || '-'}

Entity/project yang pernah muncul:
${learning.discoveredEntities.slice(-30).map(x => `- ${x}`).join('\n') || '-'}

ATURAN ADAPTASI:
1. Pertahankan preferensi user yang sudah terbukti berulang.
2. Untuk pencarian airdrop/WL, gunakan pola riset historis sebagai prioritas investigasi.
3. Jangan menganggap project/entity di memori sebagai active/current tanpa verifikasi terbaru.
4. Setelah percakapan baru, Rekt akan memperbarui memori ini melalui OpenCode lagi.
`;
};

const buildLearningTranscript = (messages: Message[]): string => messages
  .slice(-REKT_OPENCODE_HISTORY_LIMIT)
  .map((m, i) => `[${i + 1}] ${m.role.toUpperCase()}: ${m.content.slice(0, 1800)}`)
  .join('\n\n');
const parseLearningJson = (text: string): Partial<RektOpencodeLearning> | null => {
  try {
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i)?.[1] || text.trim();
    const jsonStart = fenced.indexOf('{');
    const jsonEnd = fenced.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) return null;
    const parsed = JSON.parse(fenced.slice(jsonStart, jsonEnd + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

type AgentProfession = 'scout_x' | 'scout_telegram' | 'admin_telegram' | 'onchain_executor' | 'researcher' | 'deadline_guard' | 'reminder_wl';

interface AgentDef {
  id: string;
  name: string;
  profession: AgentProfession;
  active: boolean;
  intervalSec: number;
  createdAt: number;
  lastRunAt?: number;
  runCount: number;
  successCount: number;
  tgBotToken?: string;
  tgChatId?: string;
  tgNotifyChatId?: string;
  tgTargetChannels?: string;
  tgTargetLastIds?: Record<string, number>;
  evmSkill?: string;
  tgUpdateOffset?: number;
  xBearerToken?: string;
  xQuery?: string;
  xSinceId?: string;
  xProxyUrl?: string;
}

interface AgentLogEntry {
  id: string;
  agentId: string;
  agentName: string;
  profession: AgentProfession;
  status: 'success' | 'error' | 'info';
  message: string;
  timestamp: number;
}

const AGENTS_KEY      = 'rektAgentTeam';
const AGENT_LOG_KEY    = 'rektAgentTeamLog';
const MAX_AGENTS       = 10;
const MAX_AGENT_LOGS   = 150;
const SCOUT_HISTORY_KEY = 'rektScoutDiscoveredHistory';
const loadScoutHistory = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SCOUT_HISTORY_KEY) || '[]'); } catch { return []; }
};
const addToScoutHistory = (nama: string) => {
  try {
    const hist = loadScoutHistory();
    const key = nama.toLowerCase();
    if (!hist.includes(key)) localStorage.setItem(SCOUT_HISTORY_KEY, JSON.stringify([...hist, key].slice(-500)));
  } catch {}
};

const FRESHNESS_THRESHOLD_DAYS = 7;
const MAX_SCOUT_CANDIDATES_PER_RUN = 5;

const URGENT_THRESHOLD_DAYS = 2;

const AGENT_PROFESSION_META: Record<AgentProfession, { label: string; icon: string; color: string; desc: string; defaultInterval: number; beta?: boolean }> = {
  scout_x:          { label: 'Scout X (Twitter)', icon: 'X',  color: '#e6e6e6', desc: `Cari airdrop/WL/testnet dari X — REAL kalau Bearer Token diisi (manggil X API v2 beneran, dengan since_id paginasi, poin dari engagement asli, & proxy CORS opsional kalau diblokir browser); simulasi pool referensi kalau kosong. Proses sampai ${MAX_SCOUT_CANDIDATES_PER_RUN} kandidat/putaran, cek indikasi scam sebelum ditambahin.`, defaultInterval: 90, beta: true },
  scout_telegram:   { label: 'Scout Telegram',    icon: 'T', color: '#979797', desc: `Baca pesan grup/channel Telegram buat airdrop/WL/testnet — REAL kalau Bot Token diisi (baca pesan asli lewat getUpdates, bisa mantau banyak grup sekaligus, deadline diambil dari isi pesan); simulasi pool referensi kalau kosong. Proses sampai ${MAX_SCOUT_CANDIDATES_PER_RUN} kandidat/putaran, cek indikasi scam sebelum ditambahin.`, defaultInterval: 90, beta: true },
  admin_telegram:   { label: 'Admin Telegram',    icon: 'A', color: '#979797', desc: 'Kirim reminder/moderasi ke grup Telegram — REAL kalau Bot Token diisi.', defaultInterval: 60 },
  onchain_executor: { label: 'Onchain Executor',  icon: 'onc', color: EVM_COLOR, desc: 'Jalankan skill EVM Agent secara berkala — REAL, pakai wallet EVM Agent.', defaultInterval: 120 },
  researcher:       { label: 'Peneliti Garapan',  icon: 'P', color: '#b1b1b1', desc: 'Riset ulang garapan yang ditambahin Scout — cek deadline/link/scam dulu, lalu verifikasi status terkini pakai riset AI + web search beneran sebelum declare valid. Yang kebukti gak valid DIHAPUS otomatis; yang statusnya ambigu ditandai "Perlu verifikasi manual" (gak asal declare valid).', defaultInterval: 180 },
  deadline_guard:   { label: 'Penjaga Deadline',  icon: 'D', color: '#767676', desc: `Scan semua garapan Ongoing, tandai yang deadline-nya tinggal ≤${URGENT_THRESHOLD_DAYS} hari lagi, & kirim alert Telegram — REAL kalau Bot Token diisi, simulasi (cuma dicatat) kalau kosong.`, defaultInterval: 60 },
  reminder_wl:      { label: 'Kang Reminder',     icon: '🔔', color: '#989898', desc: 'Pantau garapan berstatus Waitlist (WL/airdrop yang mau digarap tapi belum mulai) — cek pakai riset OpenCode AI (100% lokal, tanpa API key) apakah udah dibuka/mulai, otomatis naikin status ke Ongoing & reminder-nya langsung muncul di chat Rekt (channel utama). Telegram cuma tambahan OPSIONAL kalau Bot Token/Chat ID diisi.', defaultInterval: 180 },
};

const MOCK_GARAPAN_POOL: { nama: string; tugas: string; kategori: 'Testnet' | 'Whitelist' | 'NFT' | 'Social' | 'Retroactive'; link: string; deadlineDays: number; estimasiPoin: number; minAkun: number; ditemukanHariLalu: number }[] = [

];

const parseDeadline = (deadlineStr?: string | null): Date => {
  if (!deadlineStr) return new Date(NaN);
  const trimmed = deadlineStr.trim();
  if (!trimmed) return new Date(NaN);
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) {
    const iso = new Date(trimmed);
    if (!isNaN(iso.getTime())) return iso;
  }
  const parts = trimmed.split(/[\/\-]/);
  if (parts.length === 3) {
    const dd = Number(parts[0]), mm = Number(parts[1]);
    let yyyy = Number(parts[2]);
    if (yyyy < 100) yyyy += 2000;
    if (dd && mm && yyyy) {
      const d = new Date(yyyy, mm - 1, dd);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date(trimmed);
};

const toISODateString = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const MONTHS_ID: Record<string, number> = {
  jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3,
  mei: 4, may: 4, jun: 5, juni: 5, june: 5, jul: 6, juli: 6, july: 6,
  agu: 7, agustus: 7, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9, nov: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
};
const extractDeadlineFromText = (text: string, fallbackDays = 7): string => {
  const now = Date.now();
  const clampFuture = (d: Date): Date | null => {
    if (isNaN(d.getTime())) return null;
    if (d.getTime() < now - 24 * 60 * 60 * 1000) d.setFullYear(d.getFullYear() + 1);
    return d;
  };
  const numeric = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (numeric) {
    const dd = Number(numeric[1]), mm = Number(numeric[2]);
    const yyyy = numeric[3] ? (numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3])) : new Date().getFullYear();
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      const d = clampFuture(new Date(yyyy, mm - 1, dd));
      if (d) return toISODateString(d);
    }
  }
  const monthNamesRe = Object.keys(MONTHS_ID).sort((a, b) => b.length - a.length).join('|');
  const dMonY = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthNamesRe})\\.?\\s*(\\d{4})?\\b`, 'i'));
  if (dMonY) {
    const dd = Number(dMonY[1]);
    const mm = MONTHS_ID[dMonY[2].toLowerCase()];
    const yyyy = dMonY[3] ? Number(dMonY[3]) : new Date().getFullYear();
    const d = clampFuture(new Date(yyyy, mm, dd));
    if (d) return toISODateString(d);
  }
  const monDY = text.match(new RegExp(`\\b(${monthNamesRe})\\.?\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?\\b`, 'i'));
  if (monDY) {
    const mm = MONTHS_ID[monDY[1].toLowerCase()];
    const dd = Number(monDY[2]);
    const yyyy = monDY[3] ? Number(monDY[3]) : new Date().getFullYear();
    const d = clampFuture(new Date(yyyy, mm, dd));
    if (d) return toISODateString(d);
  }
  const relDays = text.match(/(\d{1,3})\s*(hari lagi|days? left|days? to go)/i);
  if (relDays) return toISODateString(new Date(now + Number(relDays[1]) * 24 * 60 * 60 * 1000));
  return toISODateString(new Date(now + fallbackDays * 24 * 60 * 60 * 1000));
};

const estimatePointsFromEngagement = (likes: number, retweets: number, replies: number): number => {
  const weighted = likes + retweets * 2 + replies * 1.5;
  if (weighted <= 0) return 35;
  const score = 35 + Math.log10(weighted + 1) * 22;
  return Math.max(30, Math.min(95, Math.round(score)));
};

const SCAM_KEYWORDS = ['seed phrase', 'private key', 'kirim dulu', 'transfer dulu', 'connect & sign instan', 'klaim instan tanpa quest'];
const looksSuspicious = (g: { nama: string; tugas: string }): boolean => {
  const text = `${g.nama} ${g.tugas}`.toLowerCase();
  return SCAM_KEYWORDS.some(k => text.includes(k));
};

// ===========================================================================
// SOCIAL RESEARCH — X (Twitter) via official API, Telegram via personal
// account login (MTProto). Both are OPTIONAL: if not configured, Rekt just
// falls back to whatever OpenCode's own web-search tool can do.
//
// Security notes (surfaced to the user in Settings too):
// - X: only a Bearer Token is stored, read-only official API, no login/cookies.
// - Telegram: a StringSession is stored after you log in with your phone.
//   That session string is equivalent to being logged into your account
//   (it can read every chat you're in). It's kept in localStorage like the
//   rest of Rekt's config, so anyone with access to this browser profile can
//   use it. Use a secondary/dedicated Telegram account for research if you
//   want to limit blast radius, not your main personal account.
// ===========================================================================

interface XApiConfig {
  bearerToken?: string;
}
const X_API_CONFIG_KEY = 'rektXApiConfig';
const loadXApiConfig = (): XApiConfig => {
  try { return JSON.parse(localStorage.getItem(X_API_CONFIG_KEY) || '{}'); } catch { return {}; }
};
const saveXApiConfig = (cfg: XApiConfig) => {
  try { localStorage.setItem(X_API_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
};

interface XPost {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  likes: number;
  retweets: number;
  url: string;
}

const X_API_BASE = 'https://api.twitter.com/2';

const xApiFetch = async (cfg: XApiConfig, path: string, timeoutMs = 15000): Promise<any> => {
  if (!cfg.bearerToken) throw new Error('Bearer Token X belum diisi di Settings → Social Research.');
  const ctrl = new AbortController();
  const t = setTimeout(() => abortWithReason(ctrl, 'x-api-timeout'), timeoutMs);
  try {
    const res = await fetch(`${X_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${cfg.bearerToken}` },
      signal: ctrl.signal,
    });
    if (res.status === 429) throw new Error('X API rate limit tercapai (429) — coba lagi beberapa menit lagi.');
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`X API error (${res.status})${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
    }
    return await res.json();
  } catch (err) {
    throw new Error(describeOpencodeError(err));
  } finally {
    clearTimeout(t);
  }
};

/** Search recent public posts (last 7 days, standard v2 search/recent tier). */
const searchXRecent = async (cfg: XApiConfig, query: string, maxResults = 10): Promise<XPost[]> => {
  const params = new URLSearchParams({
    query: `${query} -is:retweet`,
    max_results: String(Math.min(Math.max(maxResults, 10), 100)),
    'tweet.fields': 'created_at,public_metrics,author_id',
    expansions: 'author_id',
    'user.fields': 'username,name',
  });
  const data = await xApiFetch(cfg, `/tweets/search/recent?${params.toString()}`);
  const users: Record<string, { username: string; name: string }> = {};
  for (const u of data?.includes?.users || []) users[u.id] = { username: u.username, name: u.name };
  const tweets: any[] = data?.data || [];
  return tweets.map(tw => {
    const handle = users[tw.author_id]?.username || tw.author_id;
    return {
      id: tw.id,
      text: String(tw.text || '').slice(0, 500),
      author: handle,
      createdAt: tw.created_at,
      likes: tw.public_metrics?.like_count ?? 0,
      retweets: tw.public_metrics?.retweet_count ?? 0,
      url: `https://x.com/${handle}/status/${tw.id}`,
    } as XPost;
  });
};

/** Recent posts from one specific project/official account. */
const fetchXUserRecentPosts = async (cfg: XApiConfig, username: string, maxResults = 10): Promise<XPost[]> => {
  const handle = username.replace(/^@/, '');
  const userData = await xApiFetch(cfg, `/users/by/username/${encodeURIComponent(handle)}`);
  const userId = userData?.data?.id;
  if (!userId) throw new Error(`Akun X @${handle} tidak ditemukan.`);
  const params = new URLSearchParams({
    max_results: String(Math.min(Math.max(maxResults, 5), 100)),
    exclude: 'retweets,replies',
    'tweet.fields': 'created_at,public_metrics',
  });
  const data = await xApiFetch(cfg, `/users/${userId}/tweets?${params.toString()}`);
  const tweets: any[] = data?.data || [];
  return tweets.map(tw => ({
    id: tw.id,
    text: String(tw.text || '').slice(0, 500),
    author: handle,
    createdAt: tw.created_at,
    likes: tw.public_metrics?.like_count ?? 0,
    retweets: tw.public_metrics?.retweet_count ?? 0,
    url: `https://x.com/${handle}/status/${tw.id}`,
  }));
};

const testXApiConnection = async (cfg: XApiConfig): Promise<{ ok: boolean; message: string }> => {
  try {
    await xApiFetch(cfg, `/users/by/username/x`);
    return { ok: true, message: '✅ Bearer Token valid, X API bisa diakses.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
};

// --- Telegram (MTProto, personal account login) ---------------------------
// Uses the `telegram` (gramjs) package, loaded lazily so the app still builds
// even if it hasn't been installed yet. Run: npm install telegram
interface TelegramClientConfig {
  apiId?: number;
  apiHash?: string;
  phoneNumber?: string;
  sessionString?: string;
  meLabel?: string; // cached "@username / first name" shown in settings after login
}
const TG_CLIENT_CONFIG_KEY = 'rektTelegramClientConfig';
const loadTelegramClientConfig = (): TelegramClientConfig => {
  try { return JSON.parse(localStorage.getItem(TG_CLIENT_CONFIG_KEY) || '{}'); } catch { return {}; }
};
const saveTelegramClientConfig = (cfg: TelegramClientConfig) => {
  try { localStorage.setItem(TG_CLIENT_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
};

let tgLibCache: { TelegramClient: any; StringSession: any } | null = null;
// gramjs falls back to Node's `os.type()`/`os.release()` to auto-fill deviceModel/systemVersion
// when they're not explicitly given. That Node module doesn't exist in a browser bundle, which
// is exactly what throws `os_1.default.type is not a function`. Passing these explicitly makes
// gramjs skip that fallback entirely, so it never touches `os`.
const TELEGRAM_BROWSER_CLIENT_OPTS = {
  connectionRetries: 3,
  deviceModel: 'Rekt Web',
  systemVersion: 'Browser',
  appVersion: '1.0.0',
};
const loadTelegramLib = async (): Promise<{ TelegramClient: any; StringSession: any }> => {
  if (tgLibCache) return tgLibCache;
  try {
    const [clientMod, sessionMod] = await Promise.all([
      // @ts-ignore optional dependency — install with: npm install telegram
      import('telegram'),
      // @ts-ignore optional dependency
      import('telegram/sessions'),
    ]);
    tgLibCache = { TelegramClient: (clientMod as any).TelegramClient, StringSession: (sessionMod as any).StringSession };
    return tgLibCache;
  } catch {
    throw new Error('Package "telegram" belum terinstall. Jalankan `npm install telegram` di project ini lalu reload.');
  }
};

let tgClientSingleton: any = null;
let tgClientSingletonKey = '';

const getConnectedTelegramClient = async (cfg: TelegramClientConfig): Promise<any> => {
  if (!cfg.apiId || !cfg.apiHash || !cfg.sessionString) {
    throw new Error('Telegram belum login. Buka Settings → Social Research untuk login dulu.');
  }
  const key = `${cfg.apiId}:${cfg.apiHash}:${cfg.sessionString}`;
  if (tgClientSingleton && tgClientSingletonKey === key) {
    if (!tgClientSingleton.connected) await tgClientSingleton.connect();
    return tgClientSingleton;
  }
  if (tgClientSingleton) { try { await tgClientSingleton.disconnect(); } catch {} }
  const { TelegramClient, StringSession } = await loadTelegramLib();
  const client = new TelegramClient(new StringSession(cfg.sessionString), cfg.apiId, cfg.apiHash, TELEGRAM_BROWSER_CLIENT_OPTS);
  await client.connect();
  tgClientSingleton = client;
  tgClientSingletonKey = key;
  return client;
};

type TelegramLoginStep = 'connecting' | 'code' | 'password' | 'done' | 'error';

interface TelegramLoginHandle {
  submitCode: (code: string) => void;
  submitPassword: (password: string) => void;
  cancel: () => void;
}

/** Kicks off the standard gramjs login flow (phone already known from cfg). */
const startTelegramLogin = (
  cfg: TelegramClientConfig,
  callbacks: {
    onStep: (step: TelegramLoginStep, info?: string) => void;
    onSuccess: (sessionString: string, meLabel: string) => void;
    onError: (message: string) => void;
  },
): TelegramLoginHandle => {
  let cancelled = false;
  let codeResolver: ((v: string) => void) | null = null;
  let passwordResolver: ((v: string) => void) | null = null;
  let clientRef: any = null;

  if (!cfg.apiId || !cfg.apiHash || !cfg.phoneNumber) {
    callbacks.onError('API ID, API Hash, dan nomor HP (format internasional, contoh +6281234567890) wajib diisi.');
    return { submitCode: () => {}, submitPassword: () => {}, cancel: () => {} };
  }

  (async () => {
    try {
      callbacks.onStep('connecting');
      const { TelegramClient, StringSession } = await loadTelegramLib();
      const client = new TelegramClient(new StringSession(''), cfg.apiId!, cfg.apiHash!, TELEGRAM_BROWSER_CLIENT_OPTS);
      clientRef = client;
      await client.start({
        phoneNumber: async () => cfg.phoneNumber!,
        phoneCode: async () => {
          if (cancelled) throw new Error('login dibatalkan');
          callbacks.onStep('code');
          return new Promise<string>(resolve => { codeResolver = resolve; });
        },
        password: async () => {
          if (cancelled) throw new Error('login dibatalkan');
          callbacks.onStep('password');
          return new Promise<string>(resolve => { passwordResolver = resolve; });
        },
        onError: (err: any) => { throw err instanceof Error ? err : new Error(String(err)); },
      });
      if (cancelled) return;
      const sessionString = client.session.save() as string;
      tgClientSingleton = client;
      tgClientSingletonKey = `${cfg.apiId}:${cfg.apiHash}:${sessionString}`;
      let meLabel = cfg.phoneNumber || 'Telegram';
      try {
        const me = await client.getMe();
        meLabel = me?.username ? `@${me.username}` : [me?.firstName, me?.lastName].filter(Boolean).join(' ') || meLabel;
      } catch {}
      callbacks.onStep('done');
      callbacks.onSuccess(sessionString, meLabel);
    } catch (err) {
      if (cancelled) return;
      callbacks.onStep('error');
      callbacks.onError(err instanceof Error ? err.message : String(err));
    }
  })();

  return {
    submitCode: (code: string) => { codeResolver?.(code.trim()); codeResolver = null; },
    submitPassword: (password: string) => { passwordResolver?.(password); passwordResolver = null; },
    cancel: () => { cancelled = true; try { clientRef?.disconnect(); } catch {} },
  };
};

const disconnectTelegramClient = async () => {
  if (tgClientSingleton) { try { await tgClientSingleton.disconnect(); } catch {} }
  tgClientSingleton = null;
  tgClientSingletonKey = '';
};

interface TelegramHit {
  chatTitle: string;
  chatUsername?: string;
  text: string;
  date: number;
  messageId: number;
  url?: string;
}

/** Scans channels/groups you're already a member of for messages matching the given keywords. */
const searchTelegramForKeywords = async (
  cfg: TelegramClientConfig,
  keywords: string[],
  opts: { maxChats?: number; perChatPerKeyword?: number; maxHits?: number } = {},
): Promise<TelegramHit[]> => {
  const client = await getConnectedTelegramClient(cfg);
  const maxChats = opts.maxChats ?? 60;
  const perChatPerKeyword = opts.perChatPerKeyword ?? 4;
  const maxHits = opts.maxHits ?? 25;
  const dialogs = await client.getDialogs({ limit: maxChats });
  const hits: TelegramHit[] = [];
  for (const dialog of dialogs) {
    if (hits.length >= maxHits) break;
    if (!(dialog.isChannel || dialog.isGroup)) continue;
    for (const kw of keywords) {
      if (hits.length >= maxHits) break;
      try {
        const msgs = await client.getMessages(dialog.entity, { search: kw, limit: perChatPerKeyword });
        for (const m of msgs) {
          if (!m?.message) continue;
          const username = dialog.entity?.username as string | undefined;
          hits.push({
            chatTitle: dialog.title || 'Unknown chat',
            chatUsername: username,
            text: String(m.message).slice(0, 400),
            date: m.date ? Number(m.date) * 1000 : Date.now(),
            messageId: m.id,
            url: username ? `https://t.me/${username}/${m.id}` : undefined,
          });
        }
      } catch { /* one bad chat shouldn't stop the whole scan */ }
    }
  }
  return hits.sort((a, b) => b.date - a.date).slice(0, maxHits);
};

/**
 * Polls SPECIFIC channels/groups (by @username, t.me link, or exact title for private
 * chats you've already joined) for messages newer than the stored per-chat offset.
 * Unlike the Bot API path, this uses your personal account — no admin rights needed,
 * and for PUBLIC channels you don't even need to be a member/subscriber at all.
 */
const pollTelegramChannelsForNew = async (
  cfg: TelegramClientConfig,
  targets: string[],
  lastIds: Record<string, number>,
  opts: { perChatLimit?: number } = {},
): Promise<{ hits: TelegramHit[]; newLastIds: Record<string, number>; errors: string[] }> => {
  const client = await getConnectedTelegramClient(cfg);
  const perChatLimit = opts.perChatLimit ?? 30;
  const hits: TelegramHit[] = [];
  const newLastIds: Record<string, number> = { ...lastIds };
  const errors: string[] = [];
  let dialogsCache: any[] | null = null;
  for (const raw of targets) {
    const key = raw.trim();
    if (!key) continue;
    const handle = key.replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '');
    try {
      let entity: any;
      try {
        entity = await client.getEntity(handle);
      } catch {
        if (!dialogsCache) dialogsCache = (await client.getDialogs({ limit: 200 })) as any[];
        const found = dialogsCache.find((d: any) =>
          (d.title || '').toLowerCase() === key.toLowerCase() ||
          (d.entity?.username || '').toLowerCase() === handle.toLowerCase());
        if (!found) throw new Error(`chat "${key}" gak ketemu — cek lagi usernamenya (kalau publik) atau pastiin kamu udah join (kalau grup/channel privat)`);
        entity = found.entity;
      }
      const minId = lastIds[key] || 0;
      if (minId === 0) {
        // First run for this chat: just record the current latest message ID as the
        // baseline, don't treat the whole existing history as "new" updates.
        const latest = await client.getMessages(entity, { limit: 1 });
        if (latest?.[0]?.id) newLastIds[key] = latest[0].id;
        continue;
      }
      const msgs = await client.getMessages(entity, { limit: perChatLimit, minId });
      let maxId = minId;
      const username = entity?.username as string | undefined;
      for (const m of msgs) {
        maxId = Math.max(maxId, m.id);
        if (!m?.message) continue;
        hits.push({
          chatTitle: entity?.title || key,
          chatUsername: username,
          text: String(m.message).slice(0, 400),
          date: m.date ? Number(m.date) * 1000 : Date.now(),
          messageId: m.id,
          url: username ? `https://t.me/${username}/${m.id}` : undefined,
        });
      }
      if (maxId > minId) newLastIds[key] = maxId;
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { hits, newLastIds, errors };
};

/** Combines X + Telegram findings into one text block ready to inject as AI context. */
const gatherSocialResearchContext = async (
  xCfg: XApiConfig,
  tgCfg: TelegramClientConfig,
  query: string,
): Promise<string> => {
  const sections: string[] = [];
  if (xCfg.bearerToken) {
    try {
      const posts = await searchXRecent(xCfg, query, 10);
      sections.push(posts.length
        ? `**Dari X (pencarian: "${query}")**\n` + posts.slice(0, 8).map(p =>
            `• @${p.author} (${new Date(p.createdAt).toLocaleDateString('id-ID')}, ${p.likes}❤ ${p.retweets}🔁): ${p.text} — ${p.url}`).join('\n')
        : `**Dari X**: tidak ada post terkini yang ketemu untuk "${query}".`);
    } catch (err) {
      sections.push(`**Dari X**: gagal riset — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (tgCfg.sessionString) {
    try {
      const keywords = query.split(/\s+/).filter(w => w.length >= 3).slice(0, 4);
      const hits = await searchTelegramForKeywords(tgCfg, keywords.length ? keywords : [query]);
      sections.push(hits.length
        ? `**Dari Telegram (channel/grup yang kamu ikuti)**\n` + hits.slice(0, 10).map(h =>
            `• [${h.chatTitle}] ${h.text}${h.url ? ` — ${h.url}` : ''}`).join('\n')
        : `**Dari Telegram**: tidak ada obrolan terkait "${query}" di channel/grup kamu.`);
    } catch (err) {
      sections.push(`**Dari Telegram**: gagal riset — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!sections.length) return '';
  return `\n\n=== SOCIAL RESEARCH SNAPSHOT (data live, BUKAN dari ingatan AI — prioritaskan ini di atas asumsi) ===\n${sections.join('\n\n')}\n=== END SOCIAL RESEARCH SNAPSHOT ===`;
};

/** Loose heuristic: does this message look like it wants fresh project/news research? */
const SOCIAL_RESEARCH_INTENT_RE = /\b(cari(in)?|riset|research|cek|check|validasi|valid(kah)?|scam|legit|udah\s*mulai|sudah\s*mulai|status\s*(project|garapan)|project\s*baru|testnet\s*baru|airdrop\s*baru|whitelist\s*baru|wl\s*baru|kabar|update)\b/i;
const shouldGatherSocialContext = (userInput: string): boolean => SOCIAL_RESEARCH_INTENT_RE.test(userInput);

/** Pulls a short search query out of a longer user message (project name / keywords). */
const extractResearchQuery = (userInput: string): string => {
  const handleMatch = userInput.match(/@[\w_]{3,}/);
  if (handleMatch) return handleMatch[0];
  const stopwords = new Set(['yang', 'atau', 'dengan', 'untuk', 'dari', 'saya', 'kamu', 'gimana', 'apakah', 'masih', 'sudah', 'udah', 'belum', 'ini', 'itu']);
  const words = userInput.replace(/[^\p{L}\p{N}\s@]/gu, ' ').split(/\s+/).filter(w => w.length >= 4 && !stopwords.has(w.toLowerCase()));
  return words.slice(0, 5).join(' ') || userInput.slice(0, 60);
};

const researchProjectValidity = async (
  cfg: OpencodeConfig,
  target: { nama: string; tugas: string; kategori: string; link: string; deadline: string },
  socialCfg?: { xCfg?: XApiConfig; tgCfg?: TelegramClientConfig },
): Promise<{ valid: true | false | 'uncertain'; confidence: 'high' | 'medium' | 'low'; reason: string } | null> => {
  try {
    const systemPrompt = `Kamu adalah "Rekt", asisten riset airdrop crypto. Tugasmu sekarang: cek status TERKINI & legitimasi sebuah garapan. Kalau kamu punya akses tool pencarian web, WAJIB dipakai buat cari info terbaru — jangan nebak dari ingatan doang. Kalau ada blok SOCIAL RESEARCH SNAPSHOT di bawah, itu data live dari X/Telegram — prioritaskan itu di atas asumsi/ingatanmu. Jawab HANYA dengan JSON murni (tanpa markdown/backtick/teks lain), persis format ini: {"valid": true, "confidence": "high", "reason": "alasan singkat max 2 kalimat, bahasa Indonesia santai"}. Aturan: valid=false HANYA kalau ada bukti KUAT project/game-nya resmi ditutup/dibatalkan/expired/scam. valid=true kalau ada indikasi KUAT masih aktif & layak dikejar sekarang. Kalau infonya ambigu, ada rebrand/event baru yang detailnya belum jelas, nama garapan bisa merujuk ke lebih dari satu hal, atau kamu gak nemu info definitif — pakai valid:"uncertain" dan confidence:"low", JANGAN maksa nebak.`;
    let userInput = `Nama: ${target.nama}\nDeskripsi tugas: ${target.tugas}\nKategori: ${target.kategori}\nLink resmi: ${target.link}\nDeadline tercatat: ${target.deadline}\n\nMasih valid & layak digarap gak?`;
    if (socialCfg?.xCfg?.bearerToken || socialCfg?.tgCfg?.sessionString) {
      try { userInput += await gatherSocialResearchContext(socialCfg.xCfg || {}, socialCfg.tgCfg || {}, target.nama); } catch {}
    }
    const raw = await callOpencodeAI(cfg, systemPrompt, userInput);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.valid !== true && parsed.valid !== false && parsed.valid !== 'uncertain') return null;
    const confidence: 'high' | 'medium' | 'low' = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium';
    return { valid: parsed.valid, confidence, reason: String(parsed.reason || 'gak ada alasan spesifik dari riset AI.').slice(0, 300) };
  } catch {
    return null;
  }
};

const checkGarapanStarted = async (
  cfg: OpencodeConfig,
  target: { nama: string; tugas: string; kategori: string; link: string },
  socialCfg?: { xCfg?: XApiConfig; tgCfg?: TelegramClientConfig },
): Promise<{ started: true | false | 'uncertain'; confidence: 'high' | 'medium' | 'low'; reason: string } | null> => {
  try {
    const systemPrompt = `Kamu adalah "Rekt", asisten riset airdrop crypto. Tugasmu sekarang: cek apakah sebuah garapan airdrop/WL/testnet SUDAH MULAI/DIBUKA (misalnya: pendaftaran WL sudah dibuka, mint sudah live, testnet/quest sudah bisa dikerjakan, klaim sudah bisa dilakukan) — bukan masih "coming soon"/belum diumumkan tanggalnya. Kalau kamu punya akses tool pencarian web, WAJIB dipakai buat cari info terbaru — jangan nebak dari ingatan doang. Kalau ada blok SOCIAL RESEARCH SNAPSHOT di bawah, itu data live dari X/Telegram — prioritaskan itu di atas asumsi/ingatanmu. Jawab HANYA dengan JSON murni (tanpa markdown/backtick/teks lain), persis format ini: {"started": true, "confidence": "high", "reason": "alasan singkat max 2 kalimat, bahasa Indonesia santai"}. Aturan: started=true HANYA kalau ada bukti KUAT acara/WL/tugasnya SUDAH bisa dikerjakan/diklaim SEKARANG. started=false kalau masih jelas belum dibuka. Kalau infonya ambigu, gak jelas, atau kamu gak nemu info definitif soal statusnya sekarang — pakai started:"uncertain" dan confidence:"low", JANGAN maksa nebak.`;
    let userInput = `Nama: ${target.nama}\nDeskripsi tugas yang mau digarap: ${target.tugas}\nKategori: ${target.kategori}\nLink resmi: ${target.link}\n\nSudah mulai/dibuka belum?`;
    if (socialCfg?.xCfg?.bearerToken || socialCfg?.tgCfg?.sessionString) {
      try { userInput += await gatherSocialResearchContext(socialCfg.xCfg || {}, socialCfg.tgCfg || {}, target.nama); } catch {}
    }
    const raw = await callOpencodeAI(cfg, systemPrompt, userInput);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.started !== true && parsed.started !== false && parsed.started !== 'uncertain') return null;
    const confidence: 'high' | 'medium' | 'low' = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium';
    return { started: parsed.started, confidence, reason: String(parsed.reason || 'gak ada alasan spesifik dari riset AI.').slice(0, 300) };
  } catch {
    return null;
  }
};

const loadAgents = (): AgentDef[] => {
  try { return JSON.parse(localStorage.getItem(AGENTS_KEY) || '[]'); } catch { return []; }
};
const saveAgents = (agents: AgentDef[]) => {
  try { localStorage.setItem(AGENTS_KEY, JSON.stringify(agents.slice(0, MAX_AGENTS))); } catch {}
};
const loadAgentLogs = (): AgentLogEntry[] => {
  try { return JSON.parse(localStorage.getItem(AGENT_LOG_KEY) || '[]'); } catch { return []; }
};
const saveAgentLogs = (logs: AgentLogEntry[]) => {
  try { localStorage.setItem(AGENT_LOG_KEY, JSON.stringify(logs.slice(-MAX_AGENT_LOGS))); } catch {}
};

const loadWorkflowHistory = (): WorkflowHistoryEntry[] => {
  try { return JSON.parse(localStorage.getItem(WORKFLOW_HISTORY_KEY) || '[]'); } catch { return []; }
};

const saveWorkflowHistory = (hist: WorkflowHistoryEntry[]) => {
  try { localStorage.setItem(WORKFLOW_HISTORY_KEY, JSON.stringify(hist.slice(-MAX_WORKFLOW_HISTORY))); } catch {}
};

const loadLearnedWorkflows = (): LearnedWorkflow[] => {
  try { return JSON.parse(localStorage.getItem(LEARNED_WORKFLOWS_KEY) || '[]'); } catch { return []; }
};

const saveLearnedWorkflows = (wfs: LearnedWorkflow[]) => {
  try { localStorage.setItem(LEARNED_WORKFLOWS_KEY, JSON.stringify(wfs.slice(-100))); } catch {}
};

const stepSignature = (step: WorkflowStep): string => `${step.skill}(${[...step.paramShape].sort().join(',')})`;

const detectSequencePatterns = (history: WorkflowHistoryEntry[]): { steps: WorkflowStep[]; count: number }[] => {
  const successOnly = history.filter(h => h.success).sort((a, b) => a.timestamp - b.timestamp);
  const sequences = new Map<string, { steps: WorkflowStep[]; count: number }>();
  for (let len = 2; len <= 3; len++) {
    for (let i = 0; i + len <= successOnly.length; i++) {
      const windowEntries = successOnly.slice(i, i + len);
      const withinWindow = windowEntries.every((h, idx) => idx === 0 || h.timestamp - windowEntries[idx - 1].timestamp <= WORKFLOW_SEQUENCE_WINDOW_MS);
      if (!withinWindow) continue;
      const steps: WorkflowStep[] = windowEntries.map(h => ({ skill: h.skill, paramShape: h.paramShape }));
      const key = steps.map(stepSignature).join('|');
      const existing = sequences.get(key);
      if (existing) existing.count++; else sequences.set(key, { steps, count: 1 });
    }
  }
  return Array.from(sequences.values()).filter(s => s.count >= WORKFLOW_PATTERN_MIN_OCCURRENCE);
};

const namePatternWorkflow = (steps: WorkflowStep[]): string => steps.map(s => s.skill.replace('Skill', '')).join(' → ');

const describePatternWorkflow = (steps: WorkflowStep[], count: number): string =>
  count > 0
    ? `Pola otomatis: rangkaian ${steps.map(s => s.skill).join(' → ')} yang sudah dilakukan berturut-turut ${count}x.`
    : `Workflow diusulkan AI dari pola percakapan: ${steps.map(s => s.skill).join(' → ')}.`;
const computeNewWorkflows = (history: WorkflowHistoryEntry[], existing: LearnedWorkflow[]): LearnedWorkflow[] => {
  const patterns = detectSequencePatterns(history);
  const existingKeys = new Set(existing.map(w => w.steps.map(stepSignature).join('|')));
  const additions: LearnedWorkflow[] = [];
  for (const p of patterns) {
    const key = p.steps.map(stepSignature).join('|');
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    const now = Date.now();
    additions.push({
      id: `wf_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: namePatternWorkflow(p.steps),
      description: describePatternWorkflow(p.steps, p.count),
      steps: p.steps,
      source: 'auto',
      enabled: true,
      usageCount: p.count,
      successCount: p.count,
      failCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  return additions;
};

const findMatchingWorkflow = (task: Task, workflows: LearnedWorkflow[]): LearnedWorkflow | null => {
  const haystack = `${task.nama} ${task.tugas} ${task.kategori || ''} ${task.notes || ''}`.toLowerCase();
  const safeCandidates = workflows.filter(w =>
    w.enabled &&
    w.steps.length > 0 &&
    w.steps.every(s => s.paramShape.length === 0) &&
    (w.usageCount === 0 || w.successCount / w.usageCount >= 0.7)
  );
  for (const w of safeCandidates) {
    const keywords = [w.trigger, ...w.steps.map(s => s.skill.replace('Skill', ''))].filter(Boolean) as string[];
    if (keywords.some(k => k.length >= 3 && haystack.includes(k.toLowerCase()))) return w;
  }
  return null;
};

const formatTime = (ts?: number): string => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const streamTextInto = async (text: string, onUpdate: (t: string) => void): Promise<void> => {
  if (!text) return;
  const words = text.match(/\s+|[^\s]+/g) || [];
  const total = words.length;
  if (total < 6 || !/\s/.test(text)) {
    onUpdate(text);
    return;
  }
  let shown = '';
  for (let i = 0; i < total; i++) {
    shown += words[i];
    onUpdate(shown);
    const w = words[i];
    const delay = /[.!?\n]/.test(w) ? 12 + Math.random() * 18
                : w.startsWith(',') || w.startsWith(';') || w.startsWith(':') ? 8 + Math.random() * 10
                : /\s/.test(w) ? 6 + Math.random() * 8
                : 3 + Math.random() * 6;
    await new Promise(r => setTimeout(r, delay));
  }
};

const CodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ margin: '6px 0', border: '1px solid #2a2a2a', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1a', padding: '4px 10px', borderBottom: '1px solid #2a2a2a' }}>
        <span style={{ fontSize: '11px', color: '#555555', fontFamily: 'monospace' }}>{lang || 'code'}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#878787' : '#555555', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px' }}>
          {copied ? <><FaCheck size={10} /> Copied!</> : <><FaRegCopy size={10} /> Copy</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '10px 14px', overflowX: 'auto', background: '#0d0d0d', fontFamily: "'Courier New', monospace", fontSize: '12px', lineHeight: '1.6', color: '#e0e0e0', whiteSpace: 'pre' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

const renderMarkdown = (text: string): React.ReactNode => {
  const elements: React.ReactNode[] = [];
  const parts = text.split(/(```[\s\S]*?```)/g);
  parts.forEach((part, partIdx) => {
    if (part.startsWith('```')) {
      const firstNewline = part.indexOf('\n');
      const lang = firstNewline > 3 ? part.slice(3, firstNewline).trim() : '';
      const code = firstNewline > -1 ? part.slice(firstNewline + 1).replace(/```$/, '').trimEnd() : part.slice(3).replace(/```$/, '').trim();
      elements.push(<CodeBlock key={`code-${partIdx}`} code={code} lang={lang} />);
    } else {
      const lines = part.split('\n');
      lines.forEach((line, i) => {
        let processed = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code style="background:#1e1e1e;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px;color:#e0e0e0">$1</code>')
          .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#7a7a7a;text-decoration:underline;word-break:break-all;">$1</a>')
          .replace(/(?<![="'(])(https?:\/\/[^\s<>"'\]）)]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#7a7a7a;text-decoration:underline;word-break:break-all;">$1</a>');
        if (line.startsWith('### ')) elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '14px', marginTop: '6px' }} dangerouslySetInnerHTML={{ __html: processed.replace('### ', '') }} />);
        else if (line.startsWith('## ')) elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '15px', marginTop: '8px' }} dangerouslySetInnerHTML={{ __html: processed.replace('## ', '') }} />);
        else if (line.startsWith('# ')) elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '16px', marginTop: '8px' }} dangerouslySetInnerHTML={{ __html: processed.replace('# ', '') }} />);
        else if (line.startsWith('- ') || line.startsWith('• ')) elements.push(
          <div key={`${partIdx}-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: '#aaaaaa', flexShrink: 0 }}>•</span>
            <span dangerouslySetInnerHTML={{ __html: processed.replace(/^[-•] /, '') }} />
          </div>
        );
        else if (/^\d+\. /.test(line)) elements.push(
          <div key={`${partIdx}-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: '#aaaaaa', flexShrink: 0, minWidth: '20px' }}>{line.match(/^(\d+)\./)?.[1]}.</span>
            <span dangerouslySetInnerHTML={{ __html: processed.replace(/^\d+\. /, '') }} />
          </div>
        );
        else if (line.trim() === '') elements.push(<div key={`${partIdx}-${i}`} style={{ height: '6px' }} />);
        else elements.push(<div key={`${partIdx}-${i}`} dangerouslySetInnerHTML={{ __html: processed }} />);
      });
    }
  });
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{elements}</div>;
};

const applyTaskAction = (action: TaskAction): { success: boolean; message: string } => {
  try {
    const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
    if (action.type === 'ADD') {
      const p = action.payload;
      const newTask: Task = {
        id: Date.now(), nama: p.nama || 'Tugas Baru', tugas: p.tugas || 'Garapan',
        link: p.link || '#', akun: p.akun || 1, status: p.status || 'Ongoing',
        selesaiHariIni: p.selesaiHariIni ?? false,
        tanggalDitambahkan: new Date().toLocaleDateString('id-ID'),
        kategori: p.kategori || 'Testnet', detailAkun: p.detailAkun || [],
        notes: p.notes || '', deadline: p.deadline || '', estimasiReward: p.estimasiReward || 0,
      };
      tasks.push(newTask);
      localStorage.setItem('airdropTasks', JSON.stringify(tasks));
      return { success: true, message: `✅ Tugas "${newTask.nama}" berhasil ditambahkan!` };
    }
    if (action.type === 'DELETE') {
      const keyword = (action.payload.nama || '').toLowerCase();
      const before = tasks.length;
      const filtered = tasks.filter(t => !t.nama.toLowerCase().includes(keyword));
      if (filtered.length === before) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(filtered));
      return { success: true, message: `🗑️ Tugas "${action.payload.nama}" berhasil dihapus!` };
    }
    if (action.type === 'UPDATE_STATUS') {
      const keyword = (action.payload.nama || '').toLowerCase();
      let found = false;
      const updated = tasks.map(t => { if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, status: action.payload.status }; } return t; });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      return { success: true, message: `✅ Status "${action.payload.nama}" → ${action.payload.status}` };
    }
    if (action.type === 'TOGGLE_DONE') {
      const keyword = (action.payload.nama || '').toLowerCase();
      let found = false;
      const updated = tasks.map(t => { if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, selesaiHariIni: action.payload.selesaiHariIni ?? true }; } return t; });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      return { success: true, message: `✅ "${action.payload.nama}" ditandai ${(action.payload.selesaiHariIni ?? true) ? 'selesai' : 'belum selesai'} hari ini` };
    }
    if (action.type === 'UPDATE') {
      const keyword = (action.payload.nama || '').toLowerCase();
      let found = false;
      const updated = tasks.map(t => { if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, ...action.payload }; } return t; });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      return { success: true, message: `✅ Tugas "${action.payload.nama}" berhasil diperbarui!` };
    }
    return { success: false, message: '❌ Tipe aksi tidak dikenal' };
  } catch (e) { return { success: false, message: `❌ Error: ${e}` }; }
};

const parseActions = (text: string): { cleanText: string; actions: TaskAction[] } => {
  const actions: TaskAction[] = [];
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/gi;
  let cleanText = text;
  let match;
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      arr.forEach((item: any) => {
        if (item.type && item.payload !== undefined)
          actions.push({ type: item.type, payload: item.payload, label: item.label || item.type });
      });
      cleanText = cleanText.replace(match[0], '').trim();
    } catch {}
  }
  return { cleanText, actions };
};

interface ParsedArg {
  name: string;
  value: string;
  rawValue?: string;
  type: 'address' | 'uint' | 'bytes' | 'bool' | 'string' | 'tuple' | 'unknown';
  humanReadable?: string;
  tupleFields?: ParsedArg[];
}

interface MintCallResult {
  fnName: string;
  fnSignature?: string;
  args: ParsedArg[];
  rawCalldata?: string;
  contractAddress?: string;
  format: 'named' | 'positional' | 'calldata' | 'etherscan' | 'etherscan_table';
}

const weiToHuman = (wei: string): string | undefined => {
  try {
    const n = BigInt(wei);
    if (n === 0n) return '0 ETH';
    if (n >= 1_000_000_000_000_000n) {
      const eth = Number(n) / 1e18;
      return `≈ ${eth.toLocaleString('en-US', { maximumFractionDigits: 6 })} ETH`;
    }
    if (n >= 1_000_000_000n) {
      const gwei = Number(n) / 1e9;
      return `≈ ${gwei.toLocaleString('en-US', { maximumFractionDigits: 4 })} Gwei`;
    }
    if (n > 999_999n) return n.toLocaleString('en-US');
    return undefined;
  } catch { return undefined; }
};

const guessType = (val: string): ParsedArg['type'] => {
  if (/^0x[0-9a-fA-F]{40}$/.test(val.trim())) return 'address';
  if (/^\d+$/.test(val.trim())) return 'uint';
  if (/^0x[0-9a-fA-F]*$/.test(val.trim())) return 'bytes';
  if (val.trim() === 'true' || val.trim() === 'false') return 'bool';
  if (val.trim().startsWith('[') || val.trim().startsWith('(')) return 'tuple';
  return 'unknown';
};

const makeArgHuman = (name: string, val: string, type: ParsedArg['type']): string | undefined => {
  if (type !== 'uint') return undefined;
  return weiToHuman(val);
};

const parseEtherscanTableFmt = (text: string): MintCallResult | null => {
  const fnLine = text.match(/Function:\s*(.+)/i);
  if (!fnLine) return null;
  const fnFull = fnLine[1].trim();
  const fnName = fnFull.match(/^(\w+)/)?.[1] || 'call';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const topLevelArgs: Map<number, {
    name: string;
    solType: string;
    fields: { fieldName: string; solType: string; value: string }[];
    directValue?: string;
  }> = new Map();
  const numRowRe = /^(\d+)\s+(\w+)\s+(tuple|address|uint\d*|bytes\d*|bool|string)\s*(.*)?$/i;
  const subRowRe = /^(\w+)\.(\w+)\s+(address|uint\d*|bytes\d*|bool|string)\s+(0x[0-9a-fA-F]+|\d+|true|false|0x)$/i;
  const simpleRowRe = /^(\d+)\s+(\w+)\s+(address|uint\d*|bytes\d*|bool|string)\s+(0x[0-9a-fA-F]+|\d+|true|false)$/i;
  let currentTopIdx: number | null = null;
  for (const line of lines) {
    if (/^(Function:|Name\s+Type\s+Data|#)/i.test(line)) continue;
    const simpleM = line.match(simpleRowRe);
    if (simpleM) {
      const idx = parseInt(simpleM[1]);
      const name = simpleM[2];
      const solType = simpleM[3];
      const value = simpleM[4];
      topLevelArgs.set(idx, { name, solType, fields: [], directValue: value });
      currentTopIdx = idx;
      continue;
    }
    const numM = line.match(numRowRe);
    if (numM) {
      const idx = parseInt(numM[1]);
      const name = numM[2];
      const solType = numM[3];
      const rest = (numM[4] || '').trim();
      const entry: typeof topLevelArgs extends Map<any, infer V> ? V : never = {
        name, solType, fields: [],
        directValue: rest && /^(0x[0-9a-fA-F]+|\d+|true|false)$/.test(rest) ? rest : undefined
      };
      topLevelArgs.set(idx, entry);
      currentTopIdx = idx;
      continue;
    }
    const subM = line.match(subRowRe);
    if (subM) {
      const parentName = subM[1];
      const fieldName = subM[2];
      const solType = subM[3];
      const value = subM[4];
      for (const [, entry] of topLevelArgs) {
        if (entry.name === parentName) {
          entry.fields.push({ fieldName, solType, value });
          break;
        }
      }
      continue;
    }
    if (currentTopIdx !== null) {
      const plainSubRe = /^(\w+)\s+(address|uint\d*|bytes\d*|bool|string)\s+(0x[0-9a-fA-F]+|\d+|true|false|0x)$/i;
      const plainM = line.match(plainSubRe);
      if (plainM) {
        const entry = topLevelArgs.get(currentTopIdx);
        if (entry && entry.solType.toLowerCase() === 'tuple') {
          entry.fields.push({ fieldName: plainM[1], solType: plainM[2], value: plainM[3] });
        }
      }
    }
  }
  if (topLevelArgs.size === 0) return null;
  const args: ParsedArg[] = [];
  const sortedKeys = [...topLevelArgs.keys()].sort((a, b) => a - b);
  for (const key of sortedKeys) {
    const entry = topLevelArgs.get(key)!;
    if (entry.solType.toLowerCase() === 'tuple' && entry.fields.length > 0) {
      const tupleFields: ParsedArg[] = entry.fields.map(f => {
        const t = guessType(f.value);
        return { name: f.fieldName, value: f.value, type: t, humanReadable: makeArgHuman(f.fieldName, f.value, t) };
      });
      const tupleArray = entry.fields.map(f => f.value);
      const rawValue = JSON.stringify(tupleArray);
      args.push({ name: entry.name, value: rawValue, rawValue, type: 'tuple', tupleFields });
    } else if (entry.directValue) {
      const t = guessType(entry.directValue);
      args.push({ name: entry.name, value: entry.directValue, type: t, humanReadable: makeArgHuman(entry.name, entry.directValue, t) });
    } else {
      args.push({ name: entry.name, value: '[]', type: 'tuple', tupleFields: [] });
    }
  }
  if (args.length === 0) return null;
  return { fnName, fnSignature: fnFull, args, format: 'etherscan_table' };
};

const parseEtherscanFmt = (text: string): MintCallResult | null => {
  const fnMatch = text.match(/Function:\s*(\w+)/i);
  const fnName = fnMatch?.[1] || 'mint';
  const TAB_RE = /(?:\w+\.)?(\w+)\t(?:address|uint\d*|bytes\d*|bool|string|tuple)\t(0x[0-9a-fA-F]+|\d+|true|false)/g;
  const tabArgs: ParsedArg[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = TAB_RE.exec(text)) !== null) {
    const name  = tm[1];
    const value = tm[2];
    const type  = guessType(value);
    tabArgs.push({ name, value, type, humanReadable: makeArgHuman(name, value, type) });
  }
  if (tabArgs.length > 0) return { fnName, args: tabArgs, format: 'etherscan' };
  const sigMatch = text.match(/Function:\s*\w+\s*\(([^)]*)\)/i);
  const params = (sigMatch?.[1] || '').split(',').map((p, i) => {
    const parts = p.trim().split(/\s+/);
    return parts[1] || `arg${i}`;
  });
  const re = /\[(\d+)\]\s*[:\-]?\s*(0x[0-9a-fA-F]+|\d+|true|false)/g;
  const idxArgs: ParsedArg[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const idx   = parseInt(m[1]);
    const value = m[2];
    const name  = params[idx] || `arg${idx}`;
    const type  = guessType(value);
    idxArgs.push({ name, value, type, humanReadable: makeArgHuman(name, value, type) });
  }
  if (idxArgs.length > 0) return { fnName, args: idxArgs, format: 'etherscan' };
  return null;
};

const parseNamedFmt = (text: string): ParsedArg[] => {
  const args: ParsedArg[] = [];
  const lines = text.split('\n');
  const re = /^\s*[\[\(]?([A-Za-z_]\w{0,40})[\]\)]?\s*[:\-=]?\s+(0x[0-9a-fA-F]+|\d+|true|false)\s*$/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const name = m[1];
    const value = m[2];
    const type = guessType(value);
    args.push({ name, value, type, humanReadable: makeArgHuman(name, value, type) });
  }
  return args;
};

const parseCalldataFmt = (text: string): MintCallResult | null => {
  const m = text.match(/\b(0x[0-9a-fA-F]{74,})\b/);
  if (!m) return null;
  const hex = m[1];
  const selector = hex.slice(0, 10);
  const data = hex.slice(10);
  if (data.length < 64) return null;
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += 64) chunks.push(data.slice(i, i + 64).padStart(64, '0'));
  const args: ParsedArg[] = chunks.map((chunk, i) => {
    if (chunk.startsWith('000000000000000000000000')) {
      const addr = '0x' + chunk.slice(24);
      return { name: `arg${i}`, value: addr, type: 'address' as const };
    }
    try {
      const bigVal = BigInt('0x' + chunk).toString();
      return { name: `arg${i}`, value: bigVal, type: 'uint' as const, humanReadable: weiToHuman(bigVal) };
    } catch {
      return { name: `arg${i}`, value: '0x' + chunk, type: 'bytes' as const };
    }
  });
  return { fnName: `? (selector ${selector})`, args, rawCalldata: hex, format: 'calldata' };
};

const KNOWN_POSITIONAL = ['benefactor', 'beneficiary', 'collateral', 'collateralAmount', 'overlayerWrapAmount'];

const parsePositionalFmt = (text: string): MintCallResult | null => {
  const addrs = [...new Set([...text.matchAll(/0x[0-9a-fA-F]{40}/g)].map(x => x[0]))];
  const amounts = [...text.matchAll(/\b(\d{7,})\b/g)].map(x => x[1]);
  if (addrs.length === 0 && amounts.length === 0) return null;
  const fnMatch = text.match(/\b(mint|transfer|approve|swap|deposit|withdraw|stake|claim|send)\b/i);
  const fnName = fnMatch?.[1] || 'mint';
  const args: ParsedArg[] = [
    ...addrs.map((addr, i): ParsedArg => ({ name: KNOWN_POSITIONAL[i] ?? `addr${i}`, value: addr, type: 'address' })),
    ...amounts.map((amt, i): ParsedArg => {
      const name = KNOWN_POSITIONAL[addrs.length + i] ?? `amount${i}`;
      return { name, value: amt, type: 'uint', humanReadable: makeArgHuman(name, amt, 'uint') };
    }),
  ];
  return { fnName, args, format: 'positional' };
};

const parseMintCallArgsV2 = (text: string): MintCallResult | null => {
  if (/Function:\s*\w+/i.test(text)) {
    const tableResult = parseEtherscanTableFmt(text);
    if (tableResult) return tableResult;
    const r = parseEtherscanFmt(text);
    if (r) return r;
  }
  const named = parseNamedFmt(text);
  if (named.length >= 1) {
    const fnMatch = text.match(/(?:function|fn|method|call)\s*[:\-]?\s*(\w+)/i);
    return { fnName: fnMatch?.[1] || 'mint', args: named, format: 'named' };
  }
  if (/0x[0-9a-fA-F]{74,}/i.test(text)) {
    const r = parseCalldataFmt(text);
    if (r) return r;
  }
  return parsePositionalFmt(text);
};

const buildCvArgsOutput = (args: ParsedArg[]): string => {
  const vals = args.map(a => {
    if (a.type === 'tuple' && a.tupleFields && a.tupleFields.length > 0) {
      return a.tupleFields.map(f => f.value);
    }
    return a.value;
  });
  return JSON.stringify([vals]);
};

const explainArgForHub = (arg: ParsedArg, idx: number): string => {
  if (arg.type === 'tuple' && arg.tupleFields && arg.tupleFields.length > 0) {
    const fieldList = arg.tupleFields.map(f => {
      const short = f.value.length > 30 ? f.value.slice(0, 14) + '...' + f.value.slice(-6) : f.value;
      const hint = f.humanReadable ? ` (${f.humanReadable})` : '';
      return `    • ${f.name}: \`${short}\`${hint}`;
    }).join('\n');
    return `**${idx + 1}. ${arg.name}** 📦 _tuple → isi sebagai array JSON_\n${fieldList}\n    → **format:** \`["${arg.tupleFields.map(f => f.value).join('","')}"\`]`;
  }
  const icon = arg.type === 'address' ? '🔑' : arg.type === 'uint' ? '🔢' : arg.type === 'bool' ? '🔘' : '📦';
  const short = arg.value.length > 30 ? arg.value.slice(0, 14) + '...' + arg.value.slice(-6) : arg.value;
  const hint = arg.humanReadable ? ` _(${arg.humanReadable})_` : '';
  return `**${idx + 1}. ${arg.name}** ${icon} \`${short}\`${hint}`;
};

const formatMintCallReply = (result: MintCallResult): string => {
  const lines: string[] = [];
  const formatBadge: Record<MintCallResult['format'], string> = {
    etherscan_table: '🟢 Etherscan decoded (table)',
    etherscan:       '🟢 Etherscan decoded',
    named:           '🔵 Named args',
    calldata:        '🟡 Raw calldata',
    positional:      '🟠 Positional (fallback)',
  };
  const hasTuple = result.args.some(a => a.type === 'tuple');
  lines.push(`⚙️ **CV Args — \`${result.fnName}\`**`);
  if (result.fnSignature && result.fnSignature !== result.fnName) {
    lines.push(`_Signature: \`${result.fnSignature.slice(0, 80)}${result.fnSignature.length > 80 ? '...' : ''}\`_`);
  }
  lines.push(`_Format: ${formatBadge[result.format]} · ${result.args.length} parameter_`);
  lines.push('');
  if (result.rawCalldata) {
    lines.push(`📦 **Selector:** \`${result.rawCalldata.slice(0, 10)}\` · ${(result.rawCalldata.length - 2) / 2} bytes`);
    lines.push('');
  }
  lines.push('**📋 Breakdown parameter:**');
  lines.push('');
  result.args.forEach((arg, i) => {
    lines.push(explainArgForHub(arg, i));
    lines.push('');
  });
  lines.push('---');
  lines.push('**⚙️ CV Args — copy ke GarapHub:**');
  lines.push('```');
  lines.push(buildCvArgsOutput(result.args));
  lines.push('```');
  if (hasTuple) {
    lines.push('');
    lines.push('**💡 Cara isi GarapHub (ada tuple):**');
    lines.push('');
    result.args.forEach((arg, i) => {
      if (arg.type === 'tuple' && arg.tupleFields && arg.tupleFields.length > 0) {
        const tupleVals = arg.tupleFields.map(f => JSON.stringify(f.value));
        lines.push(`**Arg ${i + 1} — \`${arg.name}\`** _(tuple = array JSON)_`);
        lines.push('```');
        lines.push(`[${tupleVals.join(', ')}]`);
        lines.push('```');
        lines.push('> ⚠️ _Jangan pakai string dengan koma. Harus array `["val1","val2",...]`_');
        lines.push('');
        arg.tupleFields.forEach(f => {
          const note = f.type === 'bytes'
            ? `bytes kosong → \`"0x"\` bukan \`0\` atau \`""\``
            : f.type === 'uint'
            ? `uint256 besar → pakai string ${f.humanReadable ? `(${f.humanReadable})` : ''}`
            : f.type === 'address'
            ? `address → \`"${f.value}"\``
            : '';
          if (note) lines.push(`  • \`${f.name}\` — ${note}`);
        });
        lines.push('');
      } else {
        lines.push(`**Arg ${i + 1} — \`${arg.name}\`** \`${arg.value}\``);
        lines.push('');
      }
    });
  }
  if (result.format === 'calldata') {
    lines.push('> ⚠️ _Arg names dari raw calldata mungkin tidak akurat. Paste Etherscan decoded untuk hasil presisi._');
  }
  if (result.format === 'positional') {
    lines.push('> ℹ️ _Parsed positional menggunakan nama field standar._');
  }
  return lines.join('\n');
};

const isMintCallInput = (text: string): boolean => {
  const lower = text.toLowerCase();
  if (/^0x[0-9a-fA-F]{74,}/m.test(text)) return true;
  if (/Function:\s*\w+/i.test(text)) return true;
  if (lower.includes('cv args') || lower.includes('mint call') || lower.includes('calldata')) return true;
  if (/benefactor|beneficiary|collateral|overlayer/i.test(text)) return true;
  if (/(mint|transfer|approve|send|swap)\s*\(/i.test(text) && /0x[0-9a-fA-F]{40}/.test(text)) return true;
  if (/\b_sendParam\b|\b_fee\b|\bdstEid\b|\bamountLD\b|\bextraOptions\b/i.test(text)) return true;
  if (/\b\w+\s*[:\-=]\s*(0x[0-9a-fA-F]{40}|\d{8,})/m.test(text) && text.split('\n').length >= 2) return true;
  return false;
};

const extractMemoriesLocally = (
  userMsg: string,
  assistantReply: string
): Array<Omit<OtakRektMemory, 'id' | 'createdAt' | 'updatedAt'>> => {
  const results: Array<Omit<OtakRektMemory, 'id' | 'createdAt' | 'updatedAt'>> = [];
  const u = userMsg.toLowerCase();
  const prefPatterns: Array<{ re: RegExp; cat: OtakRektMemory['category']; build: (m: RegExpMatchArray) => string }> = [
    { re: /(?:saya|aku|gue?|gw)\s+(suka|prefer|favorit|lebih suka|biasanya|seneng)\s+(.{4,80})/i, cat: 'preferensi', build: m => `Pengguna ${m[1]} ${m[2].trim()}` },
    { re: /(?:saya|aku|gue?|gw)\s+(?:gak|tidak|nggak|ndak)\s+(?:suka|mau|seneng)\s+(.{4,80})/i, cat: 'preferensi', build: m => `Pengguna tidak suka ${m[1].trim()}` },
    { re: /lebih\s+(?:suka|prefer)\s+(.{4,80})\s+(?:daripada|dari|dibanding)\s+(.{4,60})/i, cat: 'preferensi', build: m => `Pengguna lebih suka ${m[1].trim()} daripada ${m[2].trim()}` },
    { re: /biasanya\s+(?:saya|aku|gue?|gw)\s+(.{5,80})/i, cat: 'preferensi', build: m => `Pengguna biasanya ${m[1].trim()}` },
  ];
  for (const p of prefPatterns) {
    const m = userMsg.match(p.re);
    if (m) { results.push({ category: p.cat, content: p.build(m).slice(0, 280), tags: ['auto', 'preferensi'] }); break; }
  }
  const goalPatterns: Array<{ re: RegExp; extract: (m: RegExpMatchArray) => string }> = [
    { re: /target\s+(?:saya|aku|gue?|gw)?\s*(?:adalah|itu|:)?\s*(.{5,100})/i, extract: m => `Target pengguna: ${m[1].trim()}` },
    { re: /tujuan\s+(?:saya|aku|gue?|gw)?\s*(?:adalah|itu|:)?\s*(.{5,100})/i, extract: m => `Tujuan pengguna: ${m[1].trim()}` },
    { re: /lagi\s+(?:fokus|ngejar|kejar)\s+(.{5,100})/i, extract: m => `Pengguna sedang fokus: ${m[1].trim()}` },
    { re: /pengen\s+(?:bisa|punya|dapet|dapat|capai)\s+(.{5,100})/i, extract: m => `Pengguna ingin ${m[1].trim()}` },
    { re: /mau\s+(?:coba|garap|ikut|fokus\s+ke)\s+(.{5,100})/i, extract: m => `Pengguna mau ${m[1].trim()}` },
    { re: /hasilkan\s+(?:\$)?(\d[\d.,]+)\s+(?:per\s+bulan|sebulan|monthly)/i, extract: m => `Target income pengguna: $${m[1].trim()} per bulan` },
  ];
  for (const { re, extract } of goalPatterns) {
    const m = userMsg.match(re);
    if (m && !u.includes('mau tanya') && !u.includes('mau lihat') && !u.includes('mau nanya')) {
      const content = extract(m);
      if (content.length > 12) { results.push({ category: 'tujuan', content: content.slice(0, 280), tags: ['auto', 'tujuan'] }); break; }
    }
  }
  const walletMatch = userMsg.match(/(?:wallet|address|alamat|addr)[^\n]*?(0x[0-9a-fA-F]{40})/i);
  if (walletMatch) results.push({ category: 'fakta', content: `Wallet address pengguna: ${walletMatch[1]}`, tags: ['auto', 'wallet'] });
  const solMatch = userMsg.match(/(?:wallet|address|sol|solana|sui|aptos)[^\n]*?([1-9A-HJ-NP-Za-km-z]{32,44})/i);
  if (solMatch && !walletMatch) results.push({ category: 'fakta', content: `Non-EVM wallet pengguna: ${solMatch[1]}`, tags: ['auto', 'wallet'] });
  const NETWORKS = ['ethereum','solana','polygon','arbitrum','base','monad','sui','aptos','bnb','optimism','avalanche','zksync','starknet','scroll','linea','sei','ton','cosmos','near'];
  for (const net of NETWORKS) {
    if (u.includes(net) && /(?:pake|pakai|main|aktif|fokus|suka|garap)\s/.test(u)) {
      results.push({ category: 'preferensi', content: `Pengguna aktif di jaringan ${net}`, tags: ['auto', 'network', net] }); break;
    }
  }
  const nameMatch = userMsg.match(/(?:nama|panggil)\s+(?:saya|aku|gue?|gw)?\s+(?:adalah|itu|:)?\s*([A-Za-z]{3,20})/i);
  if (nameMatch) results.push({ category: 'fakta', content: `Nama pengguna: ${nameMatch[1]}`, tags: ['auto', 'identitas'] });
  const sinceMatch = userMsg.match(/(?:main|garap|ikut)\s+airdrop\s+(?:sejak|dari|since)\s+(\d{4}|tahun\s+\d{4})/i);
  if (sinceMatch) results.push({ category: 'fakta', content: `Pengguna main airdrop sejak ${sinceMatch[1]}`, tags: ['auto', 'pengalaman'] });
  const walletCountMatch = userMsg.match(/punya\s+(\d+)\s+(?:wallet|akun|address)/i);
  if (walletCountMatch) results.push({ category: 'fakta', content: `Pengguna punya ${walletCountMatch[1]} wallet/akun`, tags: ['auto', 'wallet'] });
  if (/(?:capek|lelah|tired|kecapekan|exhausted)/.test(u))
    results.push({ category: 'catatan', content: 'Pengguna kadang kelelahan — perlu reminder istirahat', tags: ['auto', 'mood'] });
  if (/(?:males|malas|ogah|bored|gabut)/.test(u))
    results.push({ category: 'catatan', content: 'Pengguna kadang malas — perlu motivasi ringan', tags: ['auto', 'mood'] });
  if (/(?:rugi|boncos|loss|merugi|minus banyak)/.test(u))
    results.push({ category: 'catatan', content: 'Pengguna pernah rugi — sensitif soal financial risk', tags: ['auto', 'finansial'] });
  if (/(?:node|vps|server|running node)/.test(u))
    results.push({ category: 'preferensi', content: 'Pengguna menjalankan node / VPS', tags: ['auto', 'teknis'] });
  const exchangeMatch = userMsg.match(/(?:pake|pakai|use)\s+(binance|okx|bybit|kucoin|gate|coinbase|mexc|htx|huobi)\b/i);
  if (exchangeMatch) results.push({ category: 'preferensi', content: `Pengguna pakai exchange ${exchangeMatch[1]}`, tags: ['auto', 'exchange'] });
  return results.filter(r => r.content.length >= 12);
};

interface ConvContext {
  lastTopic: string;
  mentionedTasks: string[];
  mentionedNetworks: string[];
  sessionStartedAt: number;
  msgCount: number;
}

const buildConvContext = (messages: Message[]): ConvContext => {
  const ctx: ConvContext = { lastTopic: '', mentionedTasks: [], mentionedNetworks: [], sessionStartedAt: Date.now(), msgCount: 0 };
  const tasks: Task[] = (() => { try { return JSON.parse(localStorage.getItem('airdropTasks') || '[]'); } catch { return []; } })();
  const taskNames = tasks.map(t => t.nama.toLowerCase());
  const networks = ['ethereum', 'solana', 'polygon', 'arbitrum', 'base', 'monad', 'sui', 'aptos', 'bnb', 'optimism', 'avalanche', 'sepolia', 'holesky', 'mumbai'];
  const recentMsgs = messages.slice(-20);
  ctx.msgCount = messages.filter(m => m.role === 'user').length;
  for (const msg of recentMsgs) {
    const lower = msg.content.toLowerCase();
    for (const name of taskNames) {
      if (lower.includes(name) && !ctx.mentionedTasks.includes(name)) ctx.mentionedTasks.push(name);
    }
    for (const net of networks) {
      if (lower.includes(net) && !ctx.mentionedNetworks.includes(net)) ctx.mentionedNetworks.push(net);
    }
    if (lower.match(/garap|airdrop|task|tugas/)) ctx.lastTopic = 'airdrop';
    else if (lower.match(/keuangan|income|profit|expense/)) ctx.lastTopic = 'keuangan';
    else if (lower.match(/portfolio|token|holding/)) ctx.lastTopic = 'portfolio';
    else if (lower.match(/deadline|mepet|expire/)) ctx.lastTopic = 'deadline';
    else if (lower.match(/faucet|testnet|faucets/)) ctx.lastTopic = 'faucet';
  }
  return ctx;
};

/**
 * When OpenCode (the reasoning engine) is unreachable, Rekt should not just
 * apologize — it should still act as the "adaptive layer" it claims to be,
 * using locally stored memory/workflows/learning to give a best-effort,
 * clearly-labeled degraded answer instead of a dead end.
 */
const buildOfflineFallbackReply = (
  userInput: string,
  errorMessage: string,
  memories: OtakRektMemory[],
  workflows: LearnedWorkflow[],
  adaptiveLearning: RektOpencodeLearning,
): string => {
  const q = userInput.toLowerCase();
  const keywords = q.split(/[^a-z0-9]+/i).filter(w => w.length >= 4);
  const scoreText = (text: string): number => keywords.reduce((n, k) => n + (text.toLowerCase().includes(k) ? 1 : 0), 0);

  const relevantMemories = memories
    .map(m => ({ m, score: scoreText(m.content) + (m.tags || []).reduce((n, t) => n + scoreText(t), 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => `• (${x.m.category}) ${x.m.content}`);

  const relevantWorkflows = workflows
    .filter(w => w.enabled && (scoreText(w.name) + scoreText(w.description) + scoreText(w.trigger || '') > 0))
    .slice(0, 3)
    .map(w => `• **${w.name}** — ${w.description}`);

  const learningPools: [string, string[]][] = [
    ['Pola sukses sebelumnya', adaptiveLearning.successfulApproaches],
    ['Preferensi kamu', adaptiveLearning.userPreferences],
    ['Pola riset airdrop/WL', [...adaptiveLearning.airdropPatterns, ...adaptiveLearning.wlPatterns]],
  ];
  const relevantLearning = learningPools
    .map(([label, items]) => ({ label, hits: items.filter(item => scoreText(item) > 0).slice(0, 3) }))
    .filter(x => x.hits.length > 0);

  const hasAnyContext = relevantMemories.length > 0 || relevantWorkflows.length > 0 || relevantLearning.length > 0;

  let body = `⚠️ **OpenCode offline** — reasoning engine tidak bisa dihubungi.\n_Detail: ${errorMessage}_\n\n`;

  if (hasAnyContext) {
    body += `Rekt masih bisa bantu pakai memori & pembelajaran lokal yang tersimpan (belum diverifikasi ulang secara real-time):\n\n`;
    if (relevantMemories.length) body += `**Memori terkait:**\n${relevantMemories.join('\n')}\n\n`;
    if (relevantWorkflows.length) body += `**Workflow yang pernah dipelajari:**\n${relevantWorkflows.join('\n')}\n\n`;
    for (const { label, hits } of relevantLearning) {
      body += `**${label}:**\n${hits.map(h => `• ${h}`).join('\n')}\n\n`;
    }
    body += `Ini bukan jawaban baru dari AI, cuma yang sudah pernah tersimpan — nyalakan OpenCode lagi buat riset/analisis terkini.\n\n`;
  } else {
    body += `Belum ada memori/pembelajaran lokal yang relevan dengan pertanyaan ini, jadi Rekt tidak bisa menjawab tanpa reasoning engine.\n\n`;
  }

  body += `Periksa **Settings → OpenCode**, pastikan servernya jalan (\`npx opencode-ai serve\`), lalu coba lagi.`;
  return body;
};

const buildOpencodeSystemPrompt = (memories: OtakRektMemory[], importedContexts: ImportedContext[], workflows: LearnedWorkflow[] = [], adaptiveLearning?: RektOpencodeLearning): string => {
  const tasks: Task[]               = (() => { try { return JSON.parse(localStorage.getItem('airdropTasks')    || '[]'); } catch { return []; } })();
  const transactions: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('transactions')    || '[]'); } catch { return []; } })();
  const portfolio: PortfolioToken[] = (() => { try { return JSON.parse(localStorage.getItem('portfolioTokens') || '[]'); } catch { return []; } })();
  const walletGenWallets = (() => { try { return JSON.parse(localStorage.getItem('bip39Wallets') || '[]'); } catch { return []; } })();
  const walletGenTasks   = (() => { try { return JSON.parse(localStorage.getItem('walletAirdropTasks') || '[]'); } catch { return []; } })();
  const totalIncome  = transactions.filter((t: Transaction) => t.type === 'income').reduce((a: number, b: Transaction) => a + b.amount, 0);
  const totalExpense = transactions.filter((t: Transaction) => t.type === 'expense').reduce((a: number, b: Transaction) => a + b.amount, 0);
  const trimmedTasks = tasks.slice(0, 60).map(t => ({
    nama: t.nama, status: t.status, kategori: t.kategori, deadline: t.deadline,
    selesaiHariIni: t.selesaiHariIni, link: t.link,
  }));
  const ctxParts: string[] = [];
  ctxParts.push(
    `Kamu adalah "Rekt", AI assistant di dalam aplikasi web "Airdrop & WalletGen Manager" (bahasa Indonesia, gaya santai tapi informatif, boleh pakai emoji secukupnya).`,
    `Kamu berjalan lewat OpenCode AI (opencode-ai) yang di-hosting lokal oleh user — tidak ada API key eksternal yang dipakai user, jadi jangan pernah minta API key ke user.`,
    `Tugasmu: bantu user kelola daftar "garapan" airdrop/testnet, keuangan, portfolio, wallet WalletGen (BIP39), dan EVM Agent (cek saldo/swap/transfer/stake/approve/mint di jaringan EVM).`,
  );
  const evmCfgSnapshot = loadEVMConfig();
  let evmWalletAddress = '';
  try { if (evmCfgSnapshot.privateKey) evmWalletAddress = new ethers.Wallet(evmCfgSnapshot.privateKey).address; } catch {}
  const evmTokenList = ['USDC', 'WETH', ...(evmCfgSnapshot.customTokens || []).map(t => t.symbol).filter(Boolean)];
  ctxParts.push(`EVM Agent: ${evmCfgSnapshot.rpcUrl ? 'configured' : 'not configured'} | Network: ${evmCfgSnapshot.networkName || 'unknown'} | Chain ID: ${evmCfgSnapshot.chainId || 'unknown'} | Wallet: ${evmWalletAddress || 'not available'} | Token ERC-20 tersimpan: ${evmTokenList.join(', ') || '-'}`);
  ctxParts.push(`
=== DATA SAAT INI (read-only snapshot dari localStorage browser user) ===`);
  ctxParts.push(`Total garapan: ${tasks.length} (Ongoing: ${tasks.filter(t => t.status === 'Ongoing').length}, END: ${tasks.filter(t => t.status === 'END').length}, Waitlist: ${tasks.filter(t => t.status === 'Waitlist').length})`);
  ctxParts.push(`Daftar garapan (maks 60): ${JSON.stringify(trimmedTasks)}`);
  ctxParts.push(`Keuangan: income $${totalIncome.toFixed(2)}, expense $${totalExpense.toFixed(2)}, net $${(totalIncome - totalExpense).toFixed(2)}`);
  ctxParts.push(`Portfolio holding: ${portfolio.filter((p: PortfolioToken) => p.status === 'holding').length} token`);
  ctxParts.push(`WalletGen: ${walletGenWallets.length} wallet BIP39 tersimpan, ${walletGenTasks.length} task WalletGen`);
  if (memories.length > 0) {
    ctxParts.push(`Memori jangka panjang tentang user (otakRekt, ${memories.length} entri): ${JSON.stringify(memories.slice(-30).map(m => ({ kategori: m.category, isi: m.content })))}`);
  }
  if (importedContexts.length > 0) {
    ctxParts.push(`File/konteks yang baru diimpor user: ${importedContexts.map(c => `[${c.name}]: ${c.content.slice(0, 800)}`).join('\n')}`);
  }
  if (adaptiveLearning) ctxParts.push(buildRektLearningContext(adaptiveLearning));
  const enabledWorkflows = workflows.filter(w => w.enabled);
  if (enabledWorkflows.length > 0) {
    ctxParts.push(`\n=== WORKFLOW YANG SUDAH DIPELAJARI SENDIRI OLEH AGENT (self-evolving, ${enabledWorkflows.length}) ===`);
    ctxParts.push(JSON.stringify(enabledWorkflows.map(w => ({
      nama: w.name,
      deskripsi: w.description,
      urutanSkill: w.steps.map(s => s.skill),
      dipakai: w.usageCount,
      suksesRate: w.usageCount > 0 ? `${Math.round((w.successCount / w.usageCount) * 100)}%` : '-',
      sumber: w.source,
    }))));
  }
  ctxParts.push(`\n=== FORMAT AKSI (WAJIB kalau user minta ubah data) ===`);
  ctxParts.push(
    `Kalau user minta menambah/mengubah/menghapus garapan, akhiri balasanmu dengan SATU blok code fence berbahasa json berisi array aksi, contoh:`,
    '```json\n[{"type":"ADD","label":"Tambah garapan X","payload":{"nama":"X","link":"https://...","kategori":"Testnet","status":"Ongoing"}}]\n```',
    `Tipe aksi yang valid: "ADD" (payload: nama, link, tugas?, akun?, status?, kategori?, deadline?, notes?, estimasiReward?), "UPDATE" (payload: nama sebagai kata kunci pencarian + field yang diubah), "DELETE" (payload: {"nama":"kata kunci"}), "UPDATE_STATUS" (payload: {"nama":"...","status":"Ongoing|END|Waitlist"}), "TOGGLE_DONE" (payload: {"nama":"...","selesaiHariIni":true|false}).`,
    `Kalau user minta kamu mengingat sesuatu secara permanen (fakta/preferensi/tujuan), tambahkan aksi tipe "__MEMORY__" dengan payload {"content":"...","category":"fakta|preferensi|tujuan|catatan|lainnya"}.`,
    `EVM ACTIONS BOLEH dibuat oleh AI bila user meminta aksi blockchain. Gunakan blok JSON yang sama dengan type "__EVM__". Payload minimal: {skill, ...input}. Skill yang tersedia: BalanceSkill, TokenBalanceSkill, PaymentSkill, ERC20TransferSkill, ApproveSkill, AllowanceSkill, ReadContractSkill, ContractCallSkill, StakeSkill, NFTMintSkill, SwitchNetworkSkill, PriceOracleSkill, SwapSkill. Untuk field alamat (tokenAddress/address/spender/owner/tokenInAddress/tokenOutAddress), JANGAN pernah menebak alamat kontrak — pakai placeholder "__WALLET__" untuk alamat wallet user, "__ROUTER__" untuk DEX router, "__ETH__" untuk native coin (ETH/BNB/MATIC dst, dipakai di SwapSkill), atau "__SIMBOL__" (contoh "__USDC__", "__DAI__", atau simbol lain dari daftar "Token ERC-20 tersimpan" di atas) untuk alamat token; semuanya otomatis di-resolve secara lokal oleh browser sebelum eksekusi. Kalau user sebut token yang TIDAK ada di daftar tersimpan, minta dia isi alamat kontraknya langsung di chat atau tambahkan dulu di panel ⚙️ Konfigurasi EVM Agent → Daftar Token ERC-20. SwapSkill sudah eksekusi swap on-chain sungguhan lewat DEX router gaya Uniswap V2 (butuh dexRouterAddress & wethAddress terisi di config) — payload: {skill:"SwapSkill", amountIn, tokenIn, tokenOut, tokenInAddress:"__SIMBOL_ATAU_ETH__", tokenOutAddress:"__SIMBOL_ATAU_ETH__", slippageBps (opsional, default "100"=1%)}; approve otomatis dijalankan dulu kalau allowance kurang. MODE ABI CUSTOM: SEMUA skill di atas yang menyentuh contract address terima field opsional "customAbi" (JSON ABI array ATAU human-readable function signature, contoh "function swap(uint256,address) returns (uint256)") — kalau diisi, dipakai MENGGANTI/menambah ABI bawaan skill tersebut. Ini dipakai kalau contract-nya tidak standar (bukan ERC-20 biasa / bukan router Uniswap V2 standar) sehingga panggilan default gagal/revert — user bisa kasih ABI asli contract itu lewat "customAbi" supaya skill manapun (termasuk SwapSkill) bisa manggil function yang benar. KONTROL GAS: user bisa atur mode gas (hemat/standard/cepat/custom) di panel ⛓️ EVM Agent → ⛽ Kontrol Gas; ini otomatis berlaku ke SEMUA transaksi (nggak perlu diset per-action). Semua skill yang kirim transaksi juga otomatis disimulasikan dulu (pre-flight) sebelum benar-benar broadcast — kalau bakal revert, tx dibatalkan duluan supaya gas tidak kebuang percuma. Gas limit-nya juga otomatis di-estimasi lalu dikasih buffer +20% (bukan cuma estimasi mentah yang mepet ke limit) supaya tx tidak rawan out-of-gas; kalau estimasi gagal dihitung sama sekali, tx dibatalkan dan Rekt kasih tau di chat duluan alih-alih langsung eksekusi. Estimasi fee (gas limit × gas price) selalu ditampilkan di chat SEBELUM tx di-broadcast, jadi nominalnya kelihatan lebih dulu. Contoh transfer: \`json [{"type":"__EVM__","label":"Kirim 0.01 ETH","payload":{"skill":"PaymentSkill","to":"0x...","amountInEther":"0.01"}}] \``,
    buildMultiChainPromptFragment(loadMultiChainConfig()),
    `MODE RISET PROYEK (via X/Telegram/dll): kalau user minta riset/cari info soal sebuah project crypto/testnet/airdrop (nama spesifik ATAU sekadar "cariin project baru yang lagi rame"), gali & rangkum pakai kemampuan pencarianmu (X/Twitter, Telegram, dokumentasi resmi, berita crypto, explorer, dll). Susun rapi minimal mencakup: nama & jenis project (L1/L2/testnet/app), status (testnet/mainnet/beta/whitelist), reward/token potensial, cara ikutan kalau ada (RPC/chain ID/faucet/join link), daftar tugas harian (connect wallet, claim faucet, kirim tx, social task, deploy contract, dst), link resmi (website, docs, X, Telegram, Discord), dan sumber referensi di bagian akhir. Kalau user sudah jelas mau digarap, langsung sertakan aksi "ADD" buat masukin ke garapan; kalau masih ambigu (nama project mirip beberapa proyek beda), tanya dulu yang mana sebelum nambah.`,
    `AGENT EVOLUTION (workflow belajar sendiri): daftar di "=== WORKFLOW YANG SUDAH DIPELAJARI SENDIRI ===" (kalau ada) terbentuk OTOMATIS dari kebiasaan eksekusi user (murni lokal, tanpa AI) — pakai sebagai referensi urutan skill yang biasa dipakai bareng biar responsmu lebih cepat & konsisten. Kalau dari HISTORI PERCAKAPAN kamu lihat user berulang kali (≥3x) minta rangkaian 2-3 aksi/skill yang SAMA dan pola itu BELUM ada di daftar tsb, kamu BOLEH mengusulkan menyimpannya sebagai workflow baru — tambahkan SATU aksi tambahan (selain aksi utama yang diminta user) tipe "__LEARN_WORKFLOW__" dengan label diawali emoji "🧬 ", payload: {"name":"Nama singkat","description":"Penjelasan pola ini","steps":[{"skill":"NamaSkill1"},{"skill":"NamaSkill2"}]}. JANGAN mengarang pola yang belum benar-benar berulang di percakapan.`,
    `AI TIDAK BOLEH meminta, menampilkan, menyimpan, atau mengirim private key/seed phrase ke server/OpenCode. Signing dilakukan lokal oleh ethers.Wallet di browser. Setiap transaksi on-chain tetap harus melewati approval UI user; jangan mengklaim transaksi terkirim sebelum executor mengembalikan tx hash/receipt.`,
    `Kalau tidak ada aksi yang perlu dilakukan, JANGAN sertakan blok json sama sekali — cukup jawab teks biasa.`,
  );
  return ctxParts.join('\n');
};

const extractTextFromFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['txt', 'md', 'csv', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml'].includes(ext || '')) {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file, 'utf-8');
    return;
  }
  reject(new Error(`Format .${ext} belum didukung.`));
});

const rektBrain = (
  userInput: string,
  memories: OtakRektMemory[],
  convCtx: ConvContext,
  importedContexts: ImportedContext[],
  messages: Message[]
): string => {
  const q    = userInput.toLowerCase().trim();
  const raw  = userInput.trim();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tasks: Task[]               = (() => { try { return JSON.parse(localStorage.getItem('airdropTasks')    || '[]'); } catch { return []; } })();
  const transactions: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('transactions')    || '[]'); } catch { return []; } })();
  const portfolio: PortfolioToken[] = (() => { try { return JSON.parse(localStorage.getItem('portfolioTokens') || '[]'); } catch { return []; } })();
  const walletGenWallets: { id:string; name:string; addresses:{index:number;address:string}[]; tags:string[]; note:string }[] =
    (() => { try { return JSON.parse(localStorage.getItem('bip39Wallets') || '[]'); } catch { return []; } })();
  const walletGenTasks: { id:string; projectName:string; network:string; taskType:string; status:string; priority:string; deadline:string; walletAddress:string; notes:string }[] =
    (() => { try { return JSON.parse(localStorage.getItem('walletAirdropTasks') || '[]'); } catch { return []; } })();
  const walletGenNetworks: { id:string; name:string; chainId:number; symbol:string }[] =
    (() => { try { return JSON.parse(localStorage.getItem('rpcNetworks') || '[]'); } catch { return []; } })();
  const wgWalletCount   = walletGenWallets.length;
  const wgAddrTotal     = walletGenWallets.reduce((s, w) => s + w.addresses.length, 0);
  const wgTaskTodo      = walletGenTasks.filter(t => t.status === 'todo');
  const wgTaskDone      = walletGenTasks.filter(t => t.status === 'done');
  const wgTaskFailed    = walletGenTasks.filter(t => t.status === 'failed');
  const wgTaskHighPrio  = wgTaskTodo.filter(t => t.priority === 'high');
  const ongoingTasks   = tasks.filter(t => t.status === 'Ongoing');
  const belumSelesai   = ongoingTasks.filter(t => !t.selesaiHariIni);
  const sudahSelesai   = ongoingTasks.filter(t => t.selesaiHariIni);
  const endedTasks     = tasks.filter(t => t.status === 'END');
  const waitlistTasks  = tasks.filter(t => t.status === 'Waitlist');
  const totalIncome    = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalExpense   = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const profit         = totalIncome - totalExpense;
  const holdingTokens  = portfolio.filter(p => p.status === 'holding');
  const holdingVal     = holdingTokens.reduce((a, p) => a + p.jumlahToken * p.hargaPerToken, 0);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const pct = ongoingTasks.length > 0 ? Math.round((sudahSelesai.length / ongoingTasks.length) * 100) : 0;
  const withDeadline = (t: Task) => {
    const dl = parseDeadline(t.deadline); dl.setHours(0, 0, 0, 0);
    return { ...t, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000) };
  };
  const deadlineDekat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(withDeadline).filter(t => t.diff >= 0 && t.diff <= 7)
    .sort((a, b) => a.diff - b.diff);
  const deadlineLewat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(withDeadline).filter(t => t.diff < 0);
  const recallMemory = (query: string): string => {
    if (memories.length === 0) return '';
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const hits = memories
      .filter(m => words.some(w => m.content.toLowerCase().includes(w) || (m.tags || []).some(t => t.includes(w))))
      .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
      .slice(0, 3);
    if (hits.length === 0) return '';
    return `\n\n🧠 _Rekt ingat: ${hits.map(m => m.content).join(' · ')}_`;
  };
  const ctxInfo = importedContexts.length > 0
    ? `\n\n📎 _Konteks aktif: ${importedContexts.map(c => c.name).join(', ')}_` : '';
  const lastBotMsg  = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user' && m.content !== raw)?.content?.toLowerCase() || '';
  const isFollowUp  = q.length < 35 && lastBotMsg.length > 80;
  const progressBar = (p: number) => '█'.repeat(Math.round(p / 10)) + '░'.repeat(10 - Math.round(p / 10));
  const findTask = (keyword: string): Task | undefined => {
    const kw = keyword.toLowerCase();
    return tasks.find(t => t.nama.toLowerCase() === kw)
      || tasks.find(t => t.nama.toLowerCase().includes(kw))
      || tasks.find(t => kw.includes(t.nama.toLowerCase()));
  };
  const netStats: Record<string, { income: number; count: number; expense: number }> = {};
  transactions.forEach(t => {
    const net = t.network.toUpperCase();
    if (!netStats[net]) netStats[net] = { income: 0, count: 0, expense: 0 };
    if (t.type === 'income') { netStats[net].income += t.amount; netStats[net].count += 1; }
    else netStats[net].expense += t.amount;
  });
  const topNetworks = Object.entries(netStats).sort((a, b) => b[1].income - a[1].income);
  const katStats: Record<string, number> = {};
  tasks.forEach(t => { const k = t.kategori || 'Uncategorized'; katStats[k] = (katStats[k] || 0) + 1; });
  if (isMintCallInput(raw)) {
    const result = parseMintCallArgsV2(raw);
    if (result) return formatMintCallReply(result);
  }
  if (/wallet.*gen|bip39|wallet saya|dompet saya|berapa wallet|list wallet|wallet address|address saya/.test(q)) {
    if (wgWalletCount === 0) return `Belum ada wallet tersimpan di WalletGen. Buat dulu di halaman **Wallet Generator** ya!`;
    const lines = walletGenWallets.slice(0, 10).map(w =>
      `- **${w.name}** — ${w.addresses.length} address${w.tags?.length ? ` · _[${w.tags.join(', ')}]_` : ''}${w.note ? `
  📝 ${w.note}` : ''}
  ${w.addresses.slice(0,3).map(a => `\`${a.address.slice(0,8)}…${a.address.slice(-4)}\``).join(' · ')}${w.addresses.length > 3 ? ` +${w.addresses.length-3} lagi` : ''}`
    );
    return `🔑 **WalletGen — ${wgWalletCount} Wallet Tersimpan** (${wgAddrTotal} total address)
${lines.join('\n')}${wgWalletCount > 10 ? `

...+${wgWalletCount-10} wallet lainnya` : ''}

💡 _Buka tab **Wallet Generator** untuk kelola, derive address baru, atau cek balance._` + recallMemory(q);
  }
  if (/task.*wallet|wallet.*task|garap.*wallet|walletgen.*task|task.*gen|todo.*wallet|wallet.*todo/.test(q) && wgTaskTodo.length + wgTaskDone.length + wgTaskFailed.length > 0) {
    const highLines = wgTaskHighPrio.slice(0, 5).map(t =>
      `- 🔴 **${t.projectName}** · ${t.taskType} on **${t.network}**${t.deadline ? ` · deadline: ${t.deadline}` : ''}${t.walletAddress ? `
  wallet: \`${t.walletAddress.slice(0,8)}…${t.walletAddress.slice(-4)}\`` : ''}`
    );
    const todoLines = wgTaskTodo.slice(0, 8).map(t =>
      `- **${t.projectName}** · ${t.taskType} · ${t.network}${t.deadline ? ` _(${t.deadline})_` : ''}`
    );
    return `⛓️ **WalletGen Task Summary**
📊 Todo: **${wgTaskTodo.length}** · Done: **${wgTaskDone.length}** · Failed: **${wgTaskFailed.length}**

${wgTaskHighPrio.length > 0 ? `🚨 **High Priority (${wgTaskHighPrio.length}):**

${highLines.join('\n')}

` : ''}📋 **Task Todo:**

${todoLines.join('\n')}${wgTaskTodo.length > 8 ? `

...+${wgTaskTodo.length-8} lagi` : ''}` + recallMemory(q);
  }
  if (/semua.*task|total.*task|gabung.*task|all task|ringkas semua|overview semua/.test(q) && wgTaskTodo.length + wgTaskDone.length > 0) {
    const combined = tasks.length + walletGenTasks.length;
    const combTodo  = belumSelesai.length + wgTaskTodo.length;
    const combDone  = sudahSelesai.length + wgTaskDone.length;
    return `📊 **Overview Semua Garapan**
🗂️ **Airdrop Manager:** ${tasks.length} task (${belumSelesai.length} belum selesai, ${sudahSelesai.length} selesai hari ini)

⛓️ **WalletGen Tasks:** ${walletGenTasks.length} task (${wgTaskTodo.length} todo, ${wgTaskDone.length} done)

📦 **Total Gabungan:** ${combined} task · ${combTodo} pending · ${combDone} done

${wgTaskHighPrio.length > 0 ? `🚨 WalletGen high-prio: **${wgTaskHighPrio.length}** task butuh perhatian!` : ''}` + recallMemory(q);
  }
  if (/network.*wallet|rpc.*wallet|chain.*wallet|walletgen.*network|jaringan.*wallet/.test(q) && walletGenNetworks.length > 0) {
    const lines = walletGenNetworks.slice(0, 12).map(n => `- **${n.name}** · ${n.symbol} · chainId: \`${n.chainId}\``);
    return `🌐 **WalletGen Networks (${walletGenNetworks.length} terkonfigurasi)**
${lines.join('\n')}${walletGenNetworks.length > 12 ? `

...+${walletGenNetworks.length-12} lainnya` : ''}

💡 Buka tab **RPC Networks** di WalletGen untuk tambah/edit network.` + recallMemory(q);
  }
  if (/^(hai|halo|halo bro|hi|hello|hei|pagi|siang|sore|malam|oi|oy|oke|sup|woi|yo|hey)\b/.test(q)) {
    const hour = new Date().getHours();
    const sapa = hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 18 ? 'Sore' : 'Malam';
    const memNote = memories.length > 0 ? `\n🧠 Masih ingat **${memories.length} hal** tentang kamu!` : '';
    const progressNote = ongoingTasks.length > 0
      ? `\n📊 Progress hari ini: **${sudahSelesai.length}/${ongoingTasks.length}** selesai (${pct}%)`
      : '';
    const deadlineNote = deadlineDekat.length > 0
      ? `\n⏰ Ada **${deadlineDekat.length}** deadline dalam 7 hari!` : '';
    return `${sapa}! 👋 Saya **Rekt**, siap bantu bro.${memNote}${progressNote}${deadlineNote}\n\nMau ngapain sekarang?`;
  }
  if (/siapa (kamu|lo|lu|rekt)|kamu (apa|siapa|bisa apa)|lo (siapa|bisa apa)|rekt itu apa/.test(q)) {
    return `Aku **Rekt** — AI assistant untuk Erdrop Manager kamu!\n\n✅ Kelola airdrop: tambah, hapus, update, tandai selesai\n✅ Analisis keuangan & portfolio secara mendalam\n✅ Prioritaskan garapan berdasarkan deadline & kategori\n✅ Ranking airdrop, analisis jaringan terbaik\n✅ Hitung ROI, income rata-rata, proyeksi\n✅ Parse ABI/calldata (CV Args v3)\n✅ Import file sebagai konteks\n✅ Belajar dari setiap obrolan — makin sering chat, makin pintar 🧠\n\nKetik \`help\` untuk lihat semua perintah!`;
  }
  if (/progress|hari ini|ringkas|summary|selesai berapa|sudah berapa|udah berapa|status hari/.test(q)) {
    const bar = progressBar(pct);
    let reply = `📊 **Progress Hari Ini**\n\n\`${bar}\` **${pct}%**\n\n✅ Selesai: **${sudahSelesai.length}** / ${ongoingTasks.length} task`;
    if (sudahSelesai.length > 0) reply += `\n${sudahSelesai.slice(0, 5).map(t => `  - ${t.nama}`).join('\n')}${sudahSelesai.length > 5 ? `\n  ...+${sudahSelesai.length - 5} lagi` : ''}`;
    if (belumSelesai.length > 0) {
      reply += `\n\n🔴 Belum: **${belumSelesai.length}** task`;
      reply += `\n${belumSelesai.slice(0, 6).map(t => `  - **${t.nama}**${t.deadline ? ` _(deadline: ${t.deadline})_` : ''}${t.link && t.link !== '#' ? `\n    🔗 ${t.link}` : ''}`).join('\n')}`;
      if (belumSelesai.length > 6) reply += `\n  ...+${belumSelesai.length - 6} lagi`;
    } else if (ongoingTasks.length > 0) {
      reply += `\n\n🎉 **Semua sudah beres hari ini, mantap bro**`;
    }
    if (deadlineDekat.length > 0) reply += `\n\n⏰ Deadline dekat: ${deadlineDekat.slice(0, 3).map(t => `**${t.nama}** (${t.diff === 0 ? '🔴 hari ini' : t.diff === 1 ? '🟠 besok' : `🟡 ${t.diff}h lagi`})`).join(', ')}`;
    return reply + recallMemory(q);
  }
  if (/deadline|mepet|mendekat|expire|hampir habis|urgent|kapan habis|due/.test(q)) {
    let reply = '';
    if (deadlineLewat.length > 0) {
      reply += `💀 **Overdue (${deadlineLewat.length}):**\n${deadlineLewat.slice(0, 5).map(t => `- ❌ **${t.nama}** — lewat **${Math.abs(t.diff)} hari** yang lalu`).join('\n')}\n\nMending update ke END atau cek apakah masih bisa diikuti.\n\n`;
    }
    if (deadlineDekat.length === 0 && deadlineLewat.length === 0) return `✅ Tidak ada deadline dalam 7 hari ke depan. Santai dulu bro!`;
    if (deadlineDekat.length > 0) {
      const urgent = deadlineDekat.filter(t => t.diff <= 1);
      const soon   = deadlineDekat.filter(t => t.diff > 1);
      if (urgent.length > 0) reply += `🚨 **URGENT — Hari ini / Besok:**\n${urgent.map(t => `- **${t.nama}** ${t.diff === 0 ? '🔴 HARI INI' : '🟠 Besok'}${t.link && t.link !== '#' ? `\n  🔗 ${t.link}` : ''}`).join('\n')}\n\n`;
      if (soon.length > 0) reply += `⏰ **Segera (2-7 hari):**\n${soon.map(t => `- **${t.nama}** — ${t.diff} hari lagi${t.link && t.link !== '#' ? `\n  🔗 ${t.link}` : ''}`).join('\n')}`;
    }
    return reply.trim() + recallMemory(q);
  }
  if (/\b(list|tampil|semua|daftar|lihat|show)\b.*\b(airdrop|task|garapan|tugas)\b|\b(airdrop|task|garapan)\b.*\b(list|tampil|semua|daftar)\b/.test(q)) {
    if (tasks.length === 0) return `📋 Belum ada task airdrop. Tambah dulu di halaman utama ya!`;
    let filtered = tasks;
    let label = 'Semua';
    if (/ongoing/.test(q))   { filtered = ongoingTasks;  label = 'Ongoing'; }
    if (/ended|end\b/.test(q)) { filtered = endedTasks; label = 'Ended'; }
    if (/waitlist/.test(q))  { filtered = waitlistTasks; label = 'Waitlist'; }
    if (/belum selesai|belum kelar|belum done/.test(q)) { filtered = belumSelesai; label = 'Belum Selesai'; }
    if (/testnet/.test(q))   { filtered = tasks.filter(t => t.kategori === 'Testnet'); label = 'Testnet'; }
    if (/mainnet/.test(q))   { filtered = tasks.filter(t => t.kategori === 'Mainnet'); label = 'Mainnet'; }
    if (/node/.test(q))      { filtered = tasks.filter(t => t.kategori === 'Node');    label = 'Node'; }
    if (/telegram|bot/.test(q)) { filtered = tasks.filter(t => t.kategori === 'Telegram Bot'); label = 'Telegram Bot'; }
    const lines = filtered.slice(0, 20).map(t =>
      `- **${t.nama}** \`[${t.status}]\`${t.kategori ? ` _(${t.kategori})_` : ''}${t.selesaiHariIni ? ' ✅' : ''}${t.deadline ? ` · deadline: ${t.deadline}` : ''}${t.link && t.link !== '#' ? `\n  🔗 ${t.link}` : ''}`
    );
    return `📋 **${label}** (${filtered.length} task):\n\n${lines.join('\n')}${filtered.length > 20 ? `\n\n...dan ${filtered.length - 20} lagi` : ''}`;
  }
  if (/\b(garap|kerjakan|mulai|kerja|gaskeun|gas|mana dulu|prioritas|rekomendasi|rekomen|suggest)\b/.test(q)) {
    if (belumSelesai.length === 0) {
      return ongoingTasks.length === 0
        ? `Belum ada airdrop ongoing. Tambah dulu di halaman utama ya bro!`
        : `🎉 Semua airdrop ongoing **sudah dikerjakan** hari ini! bro mode activated`;
    }
    const sortedByPriority = [...belumSelesai].sort((a, b) => {
      const scoreA = (() => {
        let s = 0;
        if (a.deadline) {
          const dl = parseDeadline(a.deadline); dl.setHours(0,0,0,0);
          const diff = Math.ceil((dl.getTime() - today.getTime()) / 86400000);
          s += diff <= 0 ? 1000 : diff <= 1 ? 500 : diff <= 3 ? 200 : diff <= 7 ? 50 : 0;
        }
        const katPrio: Record<string,number> = { Node: 30, Mainnet: 20, Testnet: 10, 'Telegram Bot': 8, Whitelist: 5 };
        s += katPrio[a.kategori || ''] || 0;
        return s;
      })();
      const scoreB = (() => {
        let s = 0;
        if (b.deadline) {
          const dl = parseDeadline(b.deadline); dl.setHours(0,0,0,0);
          const diff = Math.ceil((dl.getTime() - today.getTime()) / 86400000);
          s += diff <= 0 ? 1000 : diff <= 1 ? 500 : diff <= 3 ? 200 : diff <= 7 ? 50 : 0;
        }
        const katPrio: Record<string,number> = { Node: 30, Mainnet: 20, Testnet: 10, 'Telegram Bot': 8, Whitelist: 5 };
        s += katPrio[b.kategori || ''] || 0;
        return s;
      })();
      return scoreB - scoreA;
    });
    const target = sortedByPriority[0];
    const kat = target.kategori || 'Testnet';
    const guideMap: Record<string, string> = {
      'Testnet':      '1. Buka link\n2. Connect wallet (MetaMask / Rabby)\n3. Klaim faucet jika tersedia\n4. Lakukan transaksi testnet (swap / bridge / mint)\n5. Cek poin / XP bertambah',
      'Telegram Bot': '1. Buka link di Telegram\n2. Start bot (`/start`)\n3. Selesaikan daily task\n4. Klaim reward harian',
      'Mainnet':      '1. Buka link\n2. Connect wallet (pastikan ada saldo native)\n3. Lakukan aksi on-chain yang disyaratkan\n4. Screenshot bukti transaksi',
      'Node':         '1. Cek status node (`systemctl status` / dashboard)\n2. Pastikan node synced & running\n3. Claim reward jika sudah tersedia\n4. Update software jika ada versi baru',
      'Whitelist':    '1. Buka link\n2. Isi form whitelist\n3. Follow sosmed yang diminta\n4. Submit & catat nomor konfirmasi',
      'Waitlist':     '1. Cek status waitlist di dashboard\n2. Selesaikan quest tambahan jika ada\n3. Invite referral untuk naikkan posisi antrian',
    };
    const guide = guideMap[kat] || guideMap['Testnet'];
    const actionJson = `\`\`\`json\n[{"type":"TOGGLE_DONE","label":"Tandai ${target.nama} selesai","payload":{"nama":"${target.nama}","selesaiHariIni":true}}]\n\`\`\``;
    let reply = `🚀 **Garap sekarang: ${target.nama}**\n`;
    reply += `Kategori: **${kat}**`;
    if (target.deadline) {
      const dl = parseDeadline(target.deadline); dl.setHours(0,0,0,0);
      const diff = Math.ceil((dl.getTime() - today.getTime()) / 86400000);
      reply += ` · Deadline: **${target.deadline}** (${diff <= 0 ? '🔴 HARI INI' : diff === 1 ? '🟠 besok' : `🟡 ${diff} hari lagi`})`;
    }
    if (target.link && target.link !== '#') reply += `\n🔗 ${target.link}`;
    reply += `\n\n**Step-by-step:**\n${guide}\n\nSetelah selesai, tandai done:\n${actionJson}`;
    if (sortedByPriority.length > 1) reply += `\n\n_Antrian berikutnya: ${sortedByPriority.slice(1, 4).map(t => `**${t.nama}**`).join(', ')}${sortedByPriority.length > 4 ? ` +${sortedByPriority.length - 4} lagi` : ''}_`;
    return reply;
  }
  if (/keuangan|income|expense|profit|uang|duit|finansial|pemasukan|pengeluaran|earning|penghasilan|roi|return/.test(q)) {
    if (transactions.length === 0) return `💰 Belum ada transaksi tercatat. Tambah dulu di menu **Finance** ya!`;
    const avgIncome = transactions.filter(t => t.type === 'income').length > 0
      ? (totalIncome / transactions.filter(t => t.type === 'income').length).toFixed(2) : '0';
    const profitLabel = profit >= 0 ? `✅ Untung` : `❌ Rugi`;
    const roi = totalExpense > 0 ? ((profit / totalExpense) * 100).toFixed(1) : '∞';
    let reply = `💰 **Ringkasan Keuangan**\n\n`;
    reply += `📈 Income: **$${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n`;
    reply += `📉 Expense: **$${totalExpense.toFixed(2)}**\n`;
    reply += `${profit >= 0 ? '✅' : '❌'} Net Profit: **$${profit.toFixed(2)}** — ${profitLabel}\n`;
    reply += `📊 ROI: **${roi}%**\n`;
    reply += `📑 Total transaksi: **${transactions.length}** | Avg income/tx: **$${avgIncome}**`;
    if (topNetworks.length > 0) {
      reply += `\n\n🏆 **Top Network:**\n`;
      reply += topNetworks.slice(0, 4).map(([net, s], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        const netProfit = s.income - s.expense;
        return `${medal} **${net}** — income $${s.income.toFixed(2)} · ${s.count} tx · profit $${netProfit.toFixed(2)}`;
      }).join('\n');
    }
    return reply + recallMemory(q);
  }
  if (/portfolio|token|holding|aset|coin|crypto|bag/.test(q)) {
    if (holdingTokens.length === 0 && portfolio.length === 0) return `📦 Portfolio kamu masih kosong. Tambah token di menu **Portfolio**!`;
    const soldTokens = portfolio.filter(p => p.status === 'sold');
    const vestingTokens = portfolio.filter(p => p.status === 'vesting');
    const soldVal = soldTokens.reduce((a, p) => a + p.jumlahToken * p.hargaPerToken, 0);
    let reply = `💼 **Portfolio Tracker**\n\n`;
    reply += `💎 Holding: **${holdingTokens.length} token** — Total: **$${holdingVal.toFixed(2)}**\n`;
    if (soldTokens.length > 0) reply += `💸 Sold: **${soldTokens.length} token** — Nilai: **$${soldVal.toFixed(2)}**\n`;
    if (vestingTokens.length > 0) reply += `⏳ Vesting: **${vestingTokens.length} token**\n`;
    if (holdingTokens.length > 0) {
      const sorted = [...holdingTokens].sort((a, b) => (b.jumlahToken * b.hargaPerToken) - (a.jumlahToken * a.hargaPerToken));
      reply += `\n**Detail Holding:**\n`;
      reply += sorted.slice(0, 10).map(p => {
        const val = p.jumlahToken * p.hargaPerToken;
        const pctOfTotal = holdingVal > 0 ? ((val / holdingVal) * 100).toFixed(1) : '0';
        return `- **${p.tokenSymbol}** — ${p.jumlahToken.toLocaleString('en-US', { maximumFractionDigits: 4 })} token × $${p.hargaPerToken} = **$${val.toFixed(2)}** _(${pctOfTotal}%)_${p.network ? ` [${p.network}]` : ''}`;
      }).join('\n');
      if (sorted.length > 10) reply += `\n...dan ${sorted.length - 10} token lagi`;
    }
    return reply + recallMemory(q);
  }
  if (/statistik|stats|total|rekap|dashboard|overview|rangkuman|laporan|analisis total|keseluruhan/.test(q)) {
    const roi = totalExpense > 0 ? ((profit / totalExpense) * 100).toFixed(1) : '∞';
    const bar = progressBar(pct);
    let reply = `📊 **Dashboard Erdrop Manager**\n\n`;
    reply += `**🗂 Airdrop:**\n`;
    reply += `\`${bar}\` ${pct}% hari ini\n`;
    reply += `- Total: **${tasks.length}** | Ongoing: **${ongoingTasks.length}** | Ended: **${endedTasks.length}** | Waitlist: **${waitlistTasks.length}**\n`;
    reply += `- Selesai hari ini: **${sudahSelesai.length}/${ongoingTasks.length}**\n`;
    if (deadlineDekat.length > 0) reply += `- ⚠️ Deadline dekat: **${deadlineDekat.length}** task\n`;
    if (deadlineLewat.length > 0) reply += `- 💀 Overdue: **${deadlineLewat.length}** task\n`;
    if (Object.keys(katStats).length > 0) {
      reply += `\n**Breakdown Kategori:**\n`;
      reply += Object.entries(katStats).sort((a,b) => b[1]-a[1]).map(([k,v]) => `- ${k}: **${v}**`).join('\n');
    }
    reply += `\n\n**💰 Keuangan:**\n`;
    reply += `- Income: **$${totalIncome.toFixed(2)}** | Expense: **$${totalExpense.toFixed(2)}**\n`;
    reply += `- Net Profit: **$${profit.toFixed(2)}** (${profit >= 0 ? '▲ Untung' : '▼ Rugi'}) | ROI: **${roi}%**\n`;
    reply += `- Transaksi: **${transactions.length}**\n`;
    reply += `\n**💼 Portfolio:**\n`;
    reply += `- Holding: **${holdingTokens.length} token** — Nilai: **$${holdingVal.toFixed(2)}**\n`;
    reply += `\n**🧠 otakRekt:** **${memories.length}** ingatan tersimpan`;
    return reply + ctxInfo;
  }
  if (/ranking|peringkat|terbaik|paling worth|paling bagus|paling penting|urutan prioritas/.test(q)) {
    if (tasks.length === 0) return `Belum ada task untuk diranking. Tambah dulu ya bro!`;
    const ranked = [...ongoingTasks].sort((a, b) => {
      const score = (t: Task) => {
        let s = 0;
        if (t.deadline) {
          const dl = parseDeadline(t.deadline); dl.setHours(0,0,0,0);
          const diff = Math.ceil((dl.getTime() - today.getTime()) / 86400000);
          s += diff <= 0 ? 200 : diff <= 1 ? 100 : diff <= 3 ? 50 : diff <= 7 ? 20 : 0;
        }
        const katPrio: Record<string,number> = { Node: 30, Mainnet: 25, Testnet: 15, 'Telegram Bot': 10, Whitelist: 5 };
        s += katPrio[t.kategori || ''] || 0;
        if (!t.selesaiHariIni) s += 10;
        return s;
      };
      return score(b) - score(a);
    });
    return `🏆 **Ranking Prioritas Airdrop Ongoing:**\n_(berdasarkan urgency deadline + kategori)_\n\n${ranked.slice(0, 10).map((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      let info = `${medal} **${t.nama}** ${t.selesaiHariIni ? '✅' : '🔴'} [${t.kategori || '-'}]`;
      if (t.deadline) {
        const dl = parseDeadline(t.deadline); dl.setHours(0,0,0,0);
        const diff = Math.ceil((dl.getTime() - today.getTime()) / 86400000);
        info += ` · ${diff <= 0 ? '⚠️ HARI INI' : diff === 1 ? 'besok' : `${diff}h lagi`}`;
      }
      return info;
    }).join('\n')}`;
  }
  const isSwitchNetworkIntent = /(ganti|switch|pindah|ubah).*(jaringan|network|chain)/i.test(q) ||
    (/\b(arbitrum|base|optimism|polygon|bnb|avalanche|linea|scroll|zksync|sepolia)\b/i.test(q) && /(ganti|switch|pindah|pakai|gunakan)/i.test(q));
  if (!isSwitchNetworkIntent && /jaringan|network|chain.*terbaik|network.*bagus|mana.*chain|chain.*mana|income.*network|network.*income/.test(q)) {
    if (transactions.length === 0) return `Belum ada data transaksi buat analisis jaringan. Catat dulu di menu Finance!`;
    return `🌐 **Analisis Jaringan (berdasarkan income):**\n\n${topNetworks.slice(0, 6).map(([net, s], i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      const netP = s.income - s.expense;
      const avg = s.count > 0 ? (s.income / s.count).toFixed(2) : '0';
      return `${medal} **${net}**\n   Income: $${s.income.toFixed(2)} · Profit: $${netP.toFixed(2)} · ${s.count} tx · avg $${avg}/tx`;
    }).join('\n\n')}\n\n💡 Fokus di jaringan **${topNetworks[0]?.[0] || '-'}** untuk maximize income!` + recallMemory(q);
  }
  if (/rata.rata|average|proyeksi|estimasi|perkiraan|sebulan|per bulan|monthly|per hari|per minggu/.test(q)) {
    if (transactions.length === 0) return `Belum ada transaksi buat hitung rata-rata. Tambah dulu di Finance!`;
    const incomeTxs = transactions.filter(t => t.type === 'income');
    const avgPerTx = incomeTxs.length > 0 ? (totalIncome / incomeTxs.length) : 0;
    const dates = transactions.map(t => new Date((t as any).tanggal || t.date || Date.now()).getTime()).filter(Boolean);
    const oldestDate = dates.length > 0 ? Math.min(...dates) : Date.now();
    const dayRange = Math.max(1, Math.ceil((Date.now() - oldestDate) / 86400000));
    const dailyIncome = totalIncome / dayRange;
    const monthlyEst = dailyIncome * 30;
    const weeklyEst  = dailyIncome * 7;
    return `📈 **Proyeksi & Rata-rata Income**\n\n- Avg income per transaksi: **$${avgPerTx.toFixed(2)}**\n- Estimasi harian: **$${dailyIncome.toFixed(2)}**\n- Estimasi mingguan: **$${weeklyEst.toFixed(2)}**\n- Estimasi bulanan: **$${monthlyEst.toFixed(2)}**\n\n_(berdasarkan ${incomeTxs.length} transaksi income selama ~${dayRange} hari)_\n\n${monthlyEst > 100 ? `🔥 Lumayan! Kalau konsisten, dalam setahun bisa **$${(monthlyEst * 12).toFixed(0)}**!` : `💡 Masih bisa di-_scale up_ dengan nambah garapan dan fokus di network yang paling menghasilkan.`}` + recallMemory(q);
  }
  if (/ingat|memori|otak|memory|rekt ingat|kamu tau|lo tau|lo ingat|kamu ingat/.test(q)) {
    if (memories.length === 0) return `🧠 Rekt belum punya ingatan tentang kamu.\n\nCeritain sesuatu! Misalnya:\n- _"wallet utama aku 0x..."_\n- _"aku fokus di network Monad"_\n- _"target profit aku $500 bulan ini"_\n- _"nama aku [nama]"_`;
    const recent = [...memories].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
    const catIcon: Record<string,string> = { fakta: '📌', preferensi: '❤️', tujuan: '🎯', catatan: '📝', lainnya: '💡' };
    return `🧠 **Ingatan Rekt** (${memories.length} total · ${memories.filter(m => m.id.startsWith('auto_')).length} auto-learned):\n\n${recent.map(m => `${catIcon[m.category] || '💡'} ${m.content}${m.tags?.filter(t => t !== 'auto').length ? ` _#${m.tags?.filter(t => t !== 'auto').join(' #')}_` : ''}`).join('\n')}${memories.length > 10 ? `\n\n...dan ${memories.length - 10} ingatan lagi. Lihat di panel **otakRekt**. 🧠` : ''}`;
  }
  if (/ingat ini|catat ini|simpan ini|rekt ingat|tolong ingat|jangan lupa|note ini/.test(q)) {
    const contentStart = raw.replace(/ingat ini[:\-]?|catat ini[:\-]?|simpan ini[:\-]?|rekt ingat[:\-]?|tolong ingat[:\-]?|jangan lupa[:\-]?|note ini[:\-]?/gi, '').trim();
    if (contentStart.length > 3) {
      return `✅ Oke, aku catat:\n_"${contentStart}"_\n\n\`\`\`json\n[{"type":"__MEMORY__","label":"Simpan memori","payload":{"content":"${contentStart.replace(/"/g, '\\"')}","category":"catatan"}}]\n\`\`\``;
    }
    return `Mau aku ingat apa bro? Contoh:\n- _"Rekt, ingat ini: wallet aku 0x..."_\n- _"Simpan ini: target income bulan ini $300"_`;
  }
  if (/\b(tambah|daftarin|masukin|add|buat)\b.*\b(airdrop|task|garapan|tugas|project)\b/.test(q)) {
    const namaMatch = raw.match(/(?:tambah|daftarin|masukin|add|buat)[^\n]*?(?:airdrop|task|garapan|tugas|project)[^\n]*?[:\-]?\s*["""«]?(.+?)["""»]?\s*(?:link|url|http|$)/i);
    const linkMatch = raw.match(/(?:link|url)[:\s]+(https?:\/\/\S+)/i) || raw.match(/(https?:\/\/\S+)/i);
    const katMatch  = raw.match(/kategori[:\s]+(testnet|mainnet|node|telegram bot|whitelist|waitlist)/i);
    const dlMatch   = raw.match(/deadline[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (namaMatch || linkMatch) {
      const nama = (namaMatch?.[1] || 'Airdrop Baru').trim().slice(0, 80);
      const link = linkMatch?.[1] || '#';
      const kat  = katMatch?.[1] || 'Testnet';
      const dlParsed = dlMatch?.[1] ? parseDeadline(dlMatch[1]) : null;
      const deadline = (dlParsed && !isNaN(dlParsed.getTime())) ? toISODateString(dlParsed) : '';
      return `✅ Tambah airdrop **${nama}**!\n\`\`\`json\n[{"type":"ADD","label":"Tambah ${nama}","payload":{"nama":"${nama}","tugas":"Garapan","link":"${link}","kategori":"${kat}","status":"Ongoing","akun":1,"selesaiHariIni":false,"detailAkun":[],"deadline":"${deadline}","estimasiReward":0}}]\n\`\`\``;
    }
    return `Mau tambah airdrop apa bro? Format:\n\`Tambah airdrop [nama] link [url]\`\n\nContoh: _Tambah airdrop Monad link https://testnet.monad.xyz_`;
  }
  if (/\b(hapus|delete|buang|remove|hilangkan)\b.*\b(airdrop|task|tugas|garapan|project)\b/.test(q)) {
    const namaMatch = raw.match(/(?:hapus|delete|buang|remove|hilangkan)[^\n]*?(?:airdrop|task|tugas|garapan|project)[^\n]*?[:\-]?\s*(.+)/i);
    if (namaMatch) {
      const nama = namaMatch[1].trim().slice(0, 80);
      const found = findTask(nama);
      const label = found ? found.nama : nama;
      return `🗑️ Hapus **${label}**?\n\`\`\`json\n[{"type":"DELETE","label":"Hapus ${label}","payload":{"nama":"${label}"}}]\n\`\`\``;
    }
    return `Mau hapus task apa bro? Format: \`Hapus airdrop [nama]\``;
  }
  if (/\b(selesai|done|tandai|mark|beres|kelar|finish)\b.*\b(airdrop|task|tugas|garapan)\b|\b(sudah|udah|abis)\b.*\b(garap|kerja|beres|kelar)\b/.test(q)) {
    const namaFromMsg = tasks.find(t => q.includes(t.nama.toLowerCase()));
    if (namaFromMsg) {
      return `✅ Tandai **${namaFromMsg.nama}** selesai hari ini!\n\`\`\`json\n[{"type":"TOGGLE_DONE","label":"Tandai ${namaFromMsg.nama} selesai","payload":{"nama":"${namaFromMsg.nama}","selesaiHariIni":true}}]\n\`\`\``;
    }
    if (belumSelesai.length === 1) {
      const t = belumSelesai[0];
      return `✅ Tandai **${t.nama}** selesai?\n\`\`\`json\n[{"type":"TOGGLE_DONE","label":"Tandai ${t.nama} selesai","payload":{"nama":"${t.nama}","selesaiHariIni":true}}]\n\`\`\``;
    }
    if (belumSelesai.length === 0) return `🎉 Semua task sudah selesai hari ini! Mantap bro`;
    return `Task mana yang mau ditandai selesai?\n${belumSelesai.slice(0, 6).map(t => `- **${t.nama}**`).join('\n')}\n\nSebutkan namanya bro!`;
  }
  if (/\b(update|ubah|ganti|set)\b.*\b(status|jadi|ke)\b/.test(q)) {
    const statusMatch = raw.match(/(?:END|ended|end)\b/i);
    const namaFromMsg = tasks.find(t => q.includes(t.nama.toLowerCase()));
    if (namaFromMsg && statusMatch) {
      return `🏁 Set **${namaFromMsg.nama}** → END?\n\`\`\`json\n[{"type":"UPDATE_STATUS","label":"Update ${namaFromMsg.nama} → END","payload":{"nama":"${namaFromMsg.nama}","status":"END"}}]\n\`\`\``;
    }
  }
  if (/tandai semua|semua selesai|all done|selesaikan semua|mark all/.test(q)) {
    if (belumSelesai.length === 0) return `🎉 Semua sudah selesai hari ini!`;
    const actions = belumSelesai.slice(0, 10).map(t => ({ type: 'TOGGLE_DONE', label: `Tandai ${t.nama} selesai`, payload: { nama: t.nama, selesaiHariIni: true } }));
    return `✅ Tandai **${belumSelesai.length}** task selesai sekaligus?\n\`\`\`json\n${JSON.stringify(actions, null, 2)}\n\`\`\``;
  }
  if (/jam berapa|sekarang jam|waktu sekarang|tanggal berapa|hari ini tanggal/.test(q)) {
    const now = new Date();
    return `🕐 **${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}** · ${now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  if (/tips|saran|advice|motivasi|semangat|strategi airdrop|cara sukses|biar berhasil/.test(q)) {
    const tips = [
      `💡 **Tips Wallet:** Pakai wallet berbeda untuk airdrop berisiko tinggi — biar wallet utama aman dari drainer.`,
      `💡 **Tips Bukti:** Selalu screenshot setiap transaksi airdrop sebagai bukti kalau ada klaim di masa depan.`,
      `💡 **Tips Diversifikasi:** Jangan taruh semua effort di satu airdrop. Spread risiko ke beberapa proyek.`,
      `💡 **Tips Testnet:** Airdrop Testnet lebih worth kalau proyeknya punya backing investor besar & roadmap jelas.`,
      `💡 **Tips Keuangan:** Catat semua income & expense di menu Finance — tracking profit itu penting bro!`,
      `💡 **Tips Node:** Node operator biasanya dapat alokasi lebih besar dari rata-rata user biasa.`,
      `💡 **Tips Waktu:** Garap testnet di jam sepi (tengah malam / pagi buta) — biasanya gas lebih murah & server lebih responsif.`,
      `💡 **Tips Research:** Cek tokenomics sebelum invest effort — proyek dengan >50% supply untuk tim itu red flag.`,
      `💡 **Tips Referral:** Kumpulin referral dari awal — kadang ada multiplier reward untuk early referrer.`,
      `🔥 **Motivasi:** Konsistensi > intensity. Garap sedikit tiap hari lebih baik dari nonstop lalu burnout!`,
      `🔥 **Motivasi:** Mereka yang rajin garap airdrop di bear market yang panen besar di bull market!`,
      `🔥 **Motivasi:** ${belumSelesai.length > 0 ? `${belumSelesai.length} airdrop masih nunggu bro. Gas dulu, istirahat belakangan! 💪` : 'Semua task udah kelar hari ini. Maintenancenya worth it 🔥'}`,
    ];
    return pick(tips) + recallMemory('tips motivasi');
  }
  if (importedContexts.length > 0 && /file|dokumen|tadi|konten|isi|bacain/.test(q)) {
    const ctx = importedContexts[0];
    const excerpt = ctx.content.slice(0, 800);
    return `📄 **Dari file "${ctx.name}":**\n\n${excerpt}${ctx.content.length > 800 ? '\n\n_...(konten terpotong)_' : ''}`;
  }
  if (/\bhelp\b|\bbantuan\b|\bbisa apa\b|\bperintah\b|\bcommand\b|\bfungsi\b|\bfeature\b/.test(q)) {
    return `🤖 **Rekt bisa bantu kamu dengan:**\n\n**📋 Airdrop:**\n- \`progress hari ini\` — berapa yang selesai\n- \`list airdrop\` / \`list ongoing\` / \`list belum selesai\`\n- \`garap sekarang\` — task prioritas terbaik\n- \`ranking airdrop\` — urutkan by urgency\n- \`deadline mepet\` — yang hampir habis\n- \`tambah airdrop [nama] link [url]\`\n- \`hapus airdrop [nama]\`\n- \`selesai [nama]\` — tandai done\n- \`tandai semua selesai\`\n\n**💰 Finansial:**\n- \`ringkasan keuangan\` — income/expense/profit/ROI\n- \`rata-rata income\` — proyeksi harian/bulanan\n- \`network terbaik\` — analisis per chain\n- \`statistik\` — overview lengkap\n\n**💼 Portfolio:**\n- \`portfolio\` — token holdings & nilai\n\n**🧠 Memori:**\n- \`ingat ini: [info]\` — simpan ke memori\n- \`kamu ingat apa\` — lihat semua ingatan\n\n**⚙️ CV Args v3:** Paste calldata / Etherscan decoded → auto-parse!\n\n**💡 Lain-lain:** \`tips\` \`motivasi\` \`strategi\` \`jam berapa\``;
  }
  if (isFollowUp) {
    if (/^(ok|oke|oke bro|siap|sip|mantap|noted|paham|ngerti|clear|got it|roger)$/.test(q))
      return pick([`Mantap! Ada lagi yang bisa aku bantu bro? 😄`, `Siap! Lanjut apa lagi?`, `Oke bro! Kalau ada yang kurang jelas, tanya aja 👍`]);
    if (/^(makasih|thanks|terima kasih|thx|tengkyu|tq|ty)$/.test(q))
      return pick([`Sama-sama bro! 😊`, `No problem! Kalau butuh apa-apa chat lagi ya 🤙`, `Santai aja, senang bisa bantu!`]);
    if (/^(lanjut|next|selanjutnya|berikutnya)$/.test(q) && belumSelesai.length > 1) {
      const next = belumSelesai[1];
      return `🚀 Lanjut: **${next.nama}** _(${next.kategori || 'Testnet'})_\n${next.link && next.link !== '#' ? `🔗 ${next.link}\n` : ''}\nTandai selesai kalau udah:\n\`\`\`json\n[{"type":"TOGGLE_DONE","label":"Tandai ${next.nama} selesai","payload":{"nama":"${next.nama}","selesaiHariIni":true}}]\n\`\`\``;
    }
    if (/^(hm+|hmm+|oh|ooh|wah|weh|iya|ya|yep|yup)$/.test(q))
      return pick([`Ada lagi? 😄`, `Lanjut bro! 🚀`, `Oke, mau bahas apa lagi?`]);
  }
  const memHits = recallMemory(q);
  if (memHits && q.length > 6) {
    return `🔍 Berdasarkan yang aku ingat:${memHits}\n\nAda yang bisa aku bantu lebih lanjut soal ini?`;
  }
  const contextualHints: string[] = [];
  if (belumSelesai.length > 0) contextualHints.push(`masih ada **${belumSelesai.length} airdrop** belum dikerjakan hari ini`);
  if (deadlineDekat.filter(t => t.diff <= 2).length > 0) contextualHints.push(`ada **${deadlineDekat.filter(t => t.diff <= 2).length} deadline** dalam 2 hari ke depan`);
  if (deadlineLewat.length > 0) contextualHints.push(`**${deadlineLewat.length} task** sudah overdue deadline`);
  if (profit < 0) contextualHints.push(`keuangan kamu lagi minus **$${Math.abs(profit).toFixed(2)}**`);
  if (contextualHints.length > 0) {
    return `Hmm, aku kurang paham maksudnya bro 😅 Tapi btw — ${contextualHints[0]}. Mau aku bantu soal itu dulu?\n\nKetik \`help\` buat lihat semua yang bisa aku bantu ya!`;
  }
  const needsEVMSetup = (label: string): string | null => {
    const cfg = loadEVMConfig();
    if (!cfg.rpcUrl || !cfg.privateKey) {
      return `⛓️ **EVM Agent — ${label}**\n\nSetup EVM Agent dulu bro! Klik tombol **⛓️ EVM Agent** di atas, isi RPC URL & Private Key.\n\n💡 Tips: Pilih preset jaringan (Ethereum, Arbitrum, Base, dll.) biar lebih gampang!`;
    }
    return null;
  };
  const evmCfgForTokens = loadEVMConfig();
  const knownTokenSymbols = Array.from(new Set(
    ['USDC', 'WETH', 'USDT', 'DAI', 'WBTC', ...(evmCfgForTokens.customTokens || []).map(t => (t.symbol || '').toUpperCase()).filter(Boolean)]
  ));
  const tokenSymbolPattern = knownTokenSymbols.map(s => s.toLowerCase()).join('|');
  if (/(ganti|switch|pindah|ubah).*(jaringan|network|chain)/i.test(q) ||
      (/\b(arbitrum|base|optimism|polygon|bnb|avalanche|linea|scroll|zksync|sepolia)\b/.test(q) && /(ganti|switch|pindah|pakai|gunakan)/i.test(q))) {
    const networkMatch = q.match(/\b(ethereum|arbitrum|base|optimism|polygon|bnb|avalanche|linea|scroll|zksync|sepolia)\b/i);
    const net = (networkMatch?.[1] || '').toLowerCase();
    const preset = EVM_CHAIN_PRESETS[net];
    if (preset) {
      return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"SwitchNetworkSkill","chainId":"${preset.chainId}","networkName":"${preset.networkName}","rpcUrl":"${preset.rpcUrl}"},"label":"Ganti ke ${preset.networkName}"}]\n\`\`\`\n\n⛓️ Siap ganti ke **${preset.networkName}** (Chain ID: ${preset.chainId}). Klik **Jalankan**!`;
    }
    return `⛓️ Jaringan yang tersedia:\n${Object.entries(EVM_CHAIN_PRESETS).map(([k, v]) => `- **${v.networkName}** (Chain ${v.chainId}) — ketik \`ganti ke ${k}\``).join('\n')}`;
  }
  if (new RegExp(`(cek|check|lihat|liat|saldo|balance|punya berapa).*(wallet|evm|eth|matic|bnb|avax|token|${tokenSymbolPattern})`, 'i').test(q) ||
      /(wallet|evm|eth).*(saldo|balance|berapa)/i.test(q)) {
    const err1 = needsEVMSetup('Cek Saldo'); if (err1) return err1;
    const tokenMatch = raw.match(/token\s+(0x[0-9a-fA-F]{40})/i);
    if (tokenMatch) {
      return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"TokenBalanceSkill","tokenAddress":"${tokenMatch[1]}","address":"__WALLET__"},"label":"Cek saldo token ${tokenMatch[1].slice(0,10)}..."}]\n\`\`\`\n\n⛓️ Mengecek saldo token ERC-20. Klik **Jalankan**!`;
    }
    const tokenSymbolMatchBal = raw.match(new RegExp(`\\b(${tokenSymbolPattern})\\b`, 'i'));
    if (tokenSymbolMatchBal) {
      const sym = tokenSymbolMatchBal[1].toUpperCase();
      return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"TokenBalanceSkill","tokenAddress":"__${sym}__","address":"__WALLET__"},"label":"Cek saldo token ${sym}"}]\n\`\`\`\n\n⛓️ Mengecek saldo token **${sym}**. Klik **Jalankan**!`;
    }
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"BalanceSkill","address":"__WALLET__"},"label":"Cek saldo native EVM"}]\n\`\`\`\n\n⛓️ Mengecek saldo wallet EVM... klik **Jalankan** di bawah!`;
  }
  if (new RegExp(`(swap|tukar|exchange).*(eth|token|${tokenSymbolPattern})`, 'i').test(q) ||
      new RegExp(`(eth|${tokenSymbolPattern}).*(swap|tukar|ke).*(${tokenSymbolPattern}|eth|token)`, 'i').test(q)) {
    const err2 = needsEVMSetup('Swap Token'); if (err2) return err2;
    const amtMatch = raw.match(new RegExp(`(\\d+\\.?\\d*)\\s*(eth|${tokenSymbolPattern})`, 'i'));
    const tokenOutMatch = raw.match(new RegExp(`ke\\s+(eth|weth|wbtc|${tokenSymbolPattern})`, 'i'));
    const slippageMatch = raw.match(/slippage\s*(\d+\.?\d*)\s*%/i);
    const amt = amtMatch?.[1] || '0.001';
    const tokenIn = (amtMatch?.[2] || 'ETH').toUpperCase();
    const tokenOut = (tokenOutMatch?.[1] || 'USDC').toUpperCase();
    const slippageBps = slippageMatch ? Math.round(Number(slippageMatch[1]) * 100) : 100;
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"SwapSkill","amountIn":"${amt}","tokenIn":"${tokenIn}","tokenOut":"${tokenOut}","tokenInAddress":"__${tokenIn}__","tokenOutAddress":"__${tokenOut}__","slippageBps":"${slippageBps}"},"label":"Swap ${amt} ${tokenIn} → ${tokenOut}"}]\n\`\`\`\n\n⛓️ Ready swap **${amt} ${tokenIn} → ${tokenOut}** via DEX router (slippage ${(slippageBps / 100).toFixed(2)}%)! Kalau token-nya butuh approve, otomatis di-approve dulu. Klik **Jalankan** untuk eksekusi.`;
  }
  if (new RegExp(`(approve|izinkan|allow).*(token|${tokenSymbolPattern})`, 'i').test(q)) {
    const err3 = needsEVMSetup('Approve Token'); if (err3) return err3;
    const spenderMatch = raw.match(/(?:spender|ke|untuk|to)\s+(0x[0-9a-fA-F]{40})/i);
    const tokenMatch2 = raw.match(/token\s+(0x[0-9a-fA-F]{40})/i);
    const tokenSymbolMatch2 = raw.match(new RegExp(`\\b(${tokenSymbolPattern})\\b`, 'i'));
    const amtMatch2 = raw.match(/(unlimited|max|\d+\.?\d*)/i);
    const spender = spenderMatch?.[1] || '';
    const tokenAddr = tokenMatch2?.[1] || (tokenSymbolMatch2 ? `__${tokenSymbolMatch2[1].toUpperCase()}__` : '__USDC__');
    const amount = amtMatch2?.[1] || 'unlimited';
    if (!spender) return `⛓️ Mau approve ke spender mana bro?\n\nFormat: _"Approve USDC unlimited ke 0x..."_ (bisa ganti USDC dengan token ERC-20 lain yang sudah ditambahkan di Config)`;
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"ApproveSkill","tokenAddress":"${tokenAddr}","spender":"${spender}","amount":"${amount}"},"label":"Approve token ke ${spender.slice(0,10)}..."}]\n\`\`\`\n\n⛓️ Ready approve token ke \`${spender.slice(0,10)}...\` — jumlah: **${amount}**. Klik **Jalankan**!`;
  }
  if (/(cek|check).*(allowance|izin|approval)/i.test(q) || /allowance.*token/i.test(q)) {
    const err4 = needsEVMSetup('Cek Allowance'); if (err4) return err4;
    const spenderMatch = raw.match(/(0x[0-9a-fA-F]{40})/);
    const tokenSymbolMatch4 = raw.match(new RegExp(`\\b(${tokenSymbolPattern})\\b`, 'i'));
    const spender = spenderMatch?.[1] || '__ROUTER__';
    const tokenAddr4 = tokenSymbolMatch4 ? `__${tokenSymbolMatch4[1].toUpperCase()}__` : '__USDC__';
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"AllowanceSkill","tokenAddress":"${tokenAddr4}","spender":"${spender}","owner":"__WALLET__"},"label":"Cek allowance token"}]\n\`\`\`\n\n⛓️ Mengecek allowance ERC-20. Klik **Jalankan**!`;
  }
  if (/(stake|staking|deposit).*(eth|token|contract)/i.test(q) || /stake\s+(\d+\.?\d*)/i.test(q)) {
    const err5 = needsEVMSetup('Staking'); if (err5) return err5;
    const amtMatch3 = raw.match(/(\d+\.?\d*)\s*(eth|token)?/i);
    const contractMatch = raw.match(/(?:contract|di|to)\s+(0x[0-9a-fA-F]{40})/i);
    const amt2 = amtMatch3?.[1] || '0.01';
    const contract = contractMatch?.[1] || '';
    if (!contract) return `⛓️ **EVM Agent — Staking**\n\nSetup contract address dulu bro!\nFormat: _"Stake 0.01 ETH di contract 0x..."_`;
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"StakeSkill","contractAddress":"${contract}","amount":"${amt2}"},"label":"Stake ${amt2} ETH di ${contract.slice(0,10)}..."}]\n\`\`\`\n\n⛓️ Ready stake **${amt2} ETH** di \`${contract.slice(0,10)}...\`. Klik **Jalankan**!`;
  }
  if (/(harga|price|kurs|berapa harga|token price).*(eth|btc|token|coin|usdc|matic|bnb|avax)/i.test(q) ||
      /(eth|btc|matic|bnb|avax).*(harga|price|worth|berapa)/i.test(q)) {
    const tokenMatch3 = q.match(/\b(ethereum|bitcoin|matic|polygon|bnb|binance|avax|avalanche|arbitrum|optimism|linea|scroll)\b/i);
    const coinMap: Record<string,string> = { bitcoin:'bitcoin', matic:'matic-network', polygon:'matic-network', bnb:'binancecoin', binance:'binancecoin', avax:'avalanche-2', avalanche:'avalanche-2', arbitrum:'arbitrum', optimism:'optimism', linea:'ethereum', scroll:'ethereum' };
    const coinId = coinMap[(tokenMatch3?.[1] || '').toLowerCase()] || 'ethereum';
    const label = tokenMatch3?.[1] || 'ETH';
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"PriceOracleSkill","source":"coingecko","coingeckoId":"${coinId}"},"label":"Harga ${label} dari CoinGecko"}]\n\`\`\`\n\n⛓️ Mengambil harga **${label}** dari CoinGecko. Klik **Jalankan**!`;
  }
  if (new RegExp(`(kirim|transfer|send|bayar).*(token|${tokenSymbolPattern})`, 'i').test(q)) {
    const errTokenTransfer = needsEVMSetup('ERC-20 Transfer'); if (errTokenTransfer) return errTokenTransfer;
    const amtToken = raw.match(new RegExp(`(\\d+\\.?\\d*)\\s*(${tokenSymbolPattern}|token)`, 'i'))?.[1] || '0';
    const tokenSymMatch = raw.match(new RegExp(`\\b(${tokenSymbolPattern})\\b`, 'i'));
    const tokenAddrDirect = raw.match(/token\s+(0x[0-9a-fA-F]{40})/i)?.[1];
    const tokenName = (tokenSymMatch?.[1] || 'TOKEN').toUpperCase();
    const toToken = raw.match(/ke\s+(0x[0-9a-fA-F]{40})/i)?.[1] || raw.match(/(0x[0-9a-fA-F]{40})/)?.[1] || '';
    if (!toToken) return `⛓️ Format: _"Kirim 10 USDC ke 0x..."_ (ganti USDC dengan simbol token ERC-20 lain yang sudah ditambahkan di Config)`;
    const tokenAddrOrPlaceholder = tokenAddrDirect || `__${tokenName}__`;
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"ERC20TransferSkill","tokenAddress":"${tokenAddrOrPlaceholder}","to":"${toToken}","amount":"${amtToken}"},"label":"Transfer ${amtToken} ${tokenName} ke ${toToken.slice(0,10)}..."}]\n\`\`\`\n\n⛓️ Ready transfer **${amtToken} ${tokenName}**. Klik **Jalankan** untuk sign & broadcast.`;
  }
  if (/(kirim|transfer|send|bayar|payment).*(eth|token|wallet)/i.test(q)) {
    const err6 = needsEVMSetup('Transfer'); if (err6) return err6;
    const amtMatch4 = raw.match(/(\d+\.?\d*)\s*(eth|token)?/i);
    const addrMatch = raw.match(/ke\s+(0x[0-9a-fA-F]{40})/i) || raw.match(/(0x[0-9a-fA-F]{40})/);
    const amt3 = amtMatch4?.[1] || '0.001';
    const to = addrMatch?.[1] || '0x0000000000000000000000000000000000000000';
    if (to === '0x0000000000000000000000000000000000000000') return `⛓️ Format: _"Kirim 0.01 ETH ke 0x..."_`;
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"PaymentSkill","to":"${to}","amountInEther":"${amt3}"},"label":"Transfer ${amt3} ETH ke ${to.slice(0,8)}..."}]\n\`\`\`\n\n⛓️ Ready transfer **${amt3} ETH** ke \`${to.slice(0,10)}...\`. Klik **Jalankan**!`;
  }
  if (/(mint|buat|create).*(nft|collectible)/i.test(q)) {
    const err7 = needsEVMSetup('Mint NFT'); if (err7) return err7;
    const uriMatch = raw.match(/uri[:\s]+(ipfs:\/\/\S+|https?:\/\/\S+)/i);
    const uri = uriMatch?.[1] || 'ipfs://QmEVMNFT';
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"NFTMintSkill","tokenURI":"${uri}"},"label":"Mint NFT di EVM"}]\n\`\`\`\n\n⛓️ Ready mint NFT URI: \`${uri}\`. Klik **Jalankan**!`;
  }
  if (/(baca|read|panggil|call).*(contract|kontrak)/i.test(q)) {
    const err8 = needsEVMSetup('Read Contract'); if (err8) return err8;
    const contractMatch2 = raw.match(/(0x[0-9a-fA-F]{40})/);
    const funcMatch = raw.match(/(?:fungsi|function|fn)\s+(\w+)/i);
    const contract2 = contractMatch2?.[1] || '';
    const func = funcMatch?.[1] || 'balanceOf';
    if (!contract2) return `⛓️ Format: _"Baca contract 0x... fungsi balanceOf"_`;
    return `\`\`\`json\n[{"type":"__EVM__","payload":{"skill":"ReadContractSkill","contractAddress":"${contract2}","functionName":"${func}","args":"__WALLET__"},"label":"Baca ${func} dari ${contract2.slice(0,10)}..."}]\n\`\`\`\n\n⛓️ Membaca contract \`${contract2.slice(0,10)}...\`. Klik **Jalankan**!`;
  }
  if (/(status|info|detail).*(evm|agent|blockchain)/i.test(q) || /evm\s+agent/i.test(q)) {
    const cfg2 = loadEVMConfig();
    const isConfigured = !!(cfg2.rpcUrl && cfg2.privateKey);
    const networkList = Object.entries(EVM_CHAIN_PRESETS).map(([, v]) => `- **${v.networkName}** (${v.chainId})`).join('\n');
    const tokenListStatus = ['USDC', 'WETH', ...(cfg2.customTokens || []).map(t => t.symbol).filter(Boolean)].join(', ');
    return `⛓️ **EVM Agent Status**\n\n${isConfigured ? `🟢 **Terhubung** — ${cfg2.networkName || 'Custom RPC'}` : '🔴 **Belum dikonfigurasi**'}\n\n**Config:**\n- Network: ${cfg2.networkName || '_belum diset_'}\n- RPC: ${cfg2.rpcUrl ? `\`${cfg2.rpcUrl.slice(0, 35)}...\`` : '_belum diset_'}\n- Chain ID: ${cfg2.chainId || '_belum diset_'}\n- Token ERC-20 tersimpan: ${tokenListStatus}\n\n**Skills:**\n- BalanceSkill, TokenBalanceSkill\n- PaymentSkill, SwapSkill\n- ApproveSkill, AllowanceSkill\n- StakeSkill, NFTMintSkill\n- ReadContractSkill, PriceOracleSkill\n- SwitchNetworkSkill\n\n**Jaringan tersedia:**\n${networkList}\n\n${isConfigured ? 'Contoh: _"Ganti ke Base"_, _"Approve USDC"_, _"Swap ETH ke USDC"_. Mau pakai token lain selain USDC/WETH? Tambahkan dulu di panel ⚙️ Konfigurasi EVM Agent → Daftar Token ERC-20.' : 'Klik **⛓️ EVM Agent** di header untuk setup!'}`;
  }
  return pick([
    `Hmm, aku kurang nangkep maksudnya bro 😅 Coba cek \`help\` untuk lihat daftar perintah yang tersedia!`,
    `Belum bisa jawab yang itu secara spesifik, tapi soal airdrop, keuangan, portfolio, atau CV args — aku siap! Ketik \`help\` ya.`,
    `Aku masih belajar dari setiap obrolanmu. Coba tanya lebih spesifik, atau ketik \`help\` buat lihat kemampuan aku bro!`,
  ]) + ctxInfo;
};

const rektAutoBrain = (messages: Message[]): string | null => {
  const tasks: Task[] = (() => { try { return JSON.parse(localStorage.getItem('airdropTasks') || '[]'); } catch { return []; } })();
  const transactions: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('transactions') || '[]'); } catch { return []; } })();
  const portfolio: PortfolioToken[] = (() => { try { return JSON.parse(localStorage.getItem('portfolioTokens') || '[]'); } catch { return []; } })();
  const today = new Date(); today.setHours(0,0,0,0);
  const hour  = new Date().getHours();
  const ongoingTasks    = tasks.filter(t => t.status === 'Ongoing');
  const belumSelesai    = ongoingTasks.filter(t => !t.selesaiHariIni);
  const sudahSelesai    = ongoingTasks.filter(t => t.selesaiHariIni);
  const totalIncome     = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalExpense    = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const profit          = totalIncome - totalExpense;
  const holdingVal      = portfolio.filter(p => p.status === 'holding').reduce((a, p) => a + p.jumlahToken * p.hargaPerToken, 0);
  const lastUserMsg     = [...messages].reverse().find(m => m.role === 'user')?.content?.toLowerCase() || '';
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const deadlineMendekat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(t => { const dl = parseDeadline(t.deadline); dl.setHours(0,0,0,0); return { ...t, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000) }; })
    .filter(t => t.diff >= 0 && t.diff <= 3).sort((a, b) => a.diff - b.diff);
  const deadlineLewat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(t => { const dl = parseDeadline(t.deadline); dl.setHours(0,0,0,0); return { ...t, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000) }; })
    .filter(t => t.diff < 0);
  const neurons: (() => string | null)[] = [
    () => { const u = deadlineMendekat.filter(d => d.diff <= 1); if (!u.length) return null; const t = u[0]; const label = t.diff === 0 ? 'HARI INI' : 'besok'; return pick([`⚠️ Eh bro, **${t.nama}** deadline-nya ${label}! Jangan kelewatan ya.`, `🚨 Deadline **${t.nama}** tinggal ${label}! Udah dikerjain belum?`]); },
    () => { const s = deadlineMendekat.filter(d => d.diff >= 2); if (!s.length) return null; const t = s[0]; return pick([`📅 Btw, **${t.nama}** deadlinenya ${t.diff} hari lagi. Jangan ditunda terus ya!`, `Ingat, **${t.nama}** tinggal ${t.diff} hari lagi 😅`]); },
    () => { if (!deadlineLewat.length) return null; const t = deadlineLewat[0]; return pick([`💀 **${t.nama}** kayaknya udah lewat deadline ${Math.abs(t.diff)} hari lalu. Mending update ke END deh bro.`]); },
    () => { const p = sudahSelesai.length; const tot = ongoingTasks.length; if (p === 0 || tot === 0) return null; const pct = Math.round((p/tot)*100); if (pct >= 80) return pick([`🔥 Gila, udah ${p}/${tot} airdrop selesai hari ini! Hampir kelar semua!`, `Mantap jiwa! ${pct}% airdrop hari ini udah beres 💪`]); return null; },
    () => { if (belumSelesai.length === 0) return null; if (sudahSelesai.length > 0) return null; const t = pick(belumSelesai); return pick([`Pagi bro! ${belumSelesai.length} airdrop nunggu dikerjain. Mulai **${t.nama}** dulu? 🚀`, `${belumSelesai.length} garapan nunggu nih, jangan cuma bengong. Gas **${t.nama}**! 😄`]); },
    () => { if (belumSelesai.length !== 0 || ongoingTasks.length === 0) return null; return pick([`🎉 MANTAP! Semua airdrop hari ini udah kelar! Istirahat dulu bro!`, `GG! Semua garapan today done. Besok siap lagi ya 💪`]); },
    () => { if (transactions.length < 3) return null; if (profit > 0) return pick([`💰 Profit kamu sekarang $${profit.toFixed(2)}. Lumayan kan! Keep grinding!`]); if (profit < 0) return pick([`Hmm, pengeluaran lebih gede nih ($${Math.abs(profit).toFixed(2)} minus). Mending fokus garap airdrop biar balik modal 😅`]); return null; },
    () => { if (holdingVal < 1) return null; return pick([`Portfolio holding kamu ~$${holdingVal.toFixed(2)} sekarang. Semoga pumping bro! 🚀`]); },
    () => { if (hour >= 5 && hour < 9) return pick([`Selamat pagi bro! Udah siap garap airdrop hari ini? ☀️`]); if (hour >= 22 || hour < 2) return pick([`Masih melek? Jangan begadang kebanyakan gara-gara airdrop ya 😅`]); if (hour >= 12 && hour < 14) return pick([`Siang bro! Udah makan siang belum? Jangan skip makan gara-gara asik garap airdrop 😄`]); return null; },
    () => { if (!lastUserMsg) return null; if (lastUserMsg.includes('capek') || lastUserMsg.includes('lelah')) return `Istirahat dulu gapapa bro 😊`; if (lastUserMsg.includes('males') || lastUserMsg.includes('malas')) return pick([`Haha males juga wajar, tapi sayang kalau kelewatan deadline 😬`, `Gas dikit lagi bro, ${belumSelesai.length} airdrop doang kok!`]); return null; },
    () => pick([`💡 Tips: Gunakan wallet berbeda untuk airdrop berisiko tinggi.`, `💡 Jangan lupa screenshot setiap transaksi airdrop.`, `💡 Cek Twitter airdrop kamu secara berkala, kadang ada info penting.`, null]),
  ];
  const shuffled = [...neurons].sort(() => Math.random() - 0.5);
  for (const fn of shuffled) { const r = fn(); if (r) return r; }
  return pick([`Santai aja bro, kamu udah bagus progresnya 🙌`, `Keep grinding bro! 🚀`, null]);
};

export const AIAssistant: React.FC = () => {
  const [messages, setMessages]       = useState<Message[]>(loadMessages);
  const [input, setInput]             = useState('');
  const [researchInput, setResearchInput] = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});
  const [importedContexts, setImportedContexts] = useState<ImportedContext[]>([]);
  const [showImportPanel, setShowImportPanel]   = useState(false);
  const [importError, setImportError]           = useState('');
  const [importSuccess, setImportSuccess]       = useState('');
  const [importLoading, setImportLoading]       = useState(false);
  const [streamingText, setStreamingText]       = useState('');
  const [showSettings, setShowSettings]         = useState(false);
  const [showOtakRekt, setShowOtakRekt]         = useState(false);
  const [otakMemories, setOtakMemories]         = useState<OtakRektMemory[]>(loadMemories);
  const [otakInput, setOtakInput]               = useState('');
  const [otakCategory, setOtakCategory]         = useState<OtakRektMemory['category']>('fakta');
  const [otakTags, setOtakTags]                 = useState('');
  const [otakEditId, setOtakEditId]             = useState<string | null>(null);
  const [otakFilter, setOtakFilter]             = useState<OtakRektMemory['category'] | 'semua'>('semua');
  const [otakSearch, setOtakSearch]             = useState('');
  const [otakMsg, setOtakMsg]                   = useState('');
  const [autoMode, setAutoMode]                 = useState<boolean>(() => { try { return localStorage.getItem('rektAutoMode') !== 'false'; } catch { return true; } });
  const [notifyOnDone, setNotifyOnDone]         = useState<boolean>(() => { try { return localStorage.getItem('rektNotifyOnDone') === 'true'; } catch { return false; } });
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | 'unsupported'>(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));
  const [autonomousAgent, setAutonomousAgent]   = useState<boolean>(() => { try { return localStorage.getItem('rektAutonomousAgent') === 'true'; } catch { return false; } });
  const [agentQueue, setAgentQueue]             = useState<TaskAction[]>([]);
  const [agentBusy, setAgentBusy]               = useState(false);
  const [showGarapPanel, setShowGarapPanel]     = useState(false);
  const [showEVMPanel, setShowEVMPanel]   = useState(false);
  const [evmConfig, setEVMConfig]         = useState<Partial<EVMConfig>>(loadEVMConfig);
  const [evmLogs, setEVMLogs]             = useState<EVMTaskLog[]>([]);
  const [evmRunning, setEVMRunning]       = useState(false);
  const [evmMsg, setEVMMsg]               = useState('');
  const [evmConfigEdit, setEVMConfigEdit] = useState(false);
  const [evmFormData, setEVMFormData]     = useState<Partial<EVMConfig>>({});
  const [showChainPanel, setShowChainPanel] = useState(false);
  const [multiChainConfig, setMultiChainConfig] = useState<MultiChainAgentConfig>(loadMultiChainConfig);
  const [multiChainConfigEdit, setMultiChainConfigEdit] = useState(false);
  const [multiChainFormData, setMultiChainFormData] = useState<MultiChainAgentConfig>(loadMultiChainConfig);
  const [chainLogs, setChainLogs] = useState<ChainTaskLog[]>([]);
  const [chainRunning, setChainRunning] = useState(false);
  const [chainMsg, setChainMsg] = useState('');
  const [multiChainAddresses, setMultiChainAddresses] = useState<Partial<Record<ChainKey, string>>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(CHAIN_KEYS.map(async (c) => {
        const pk = multiChainConfig[c]?.privateKey;
        if (!pk) return [c, ''] as const;
        try { return [c, await getMultiChainAddress(c, pk, multiChainConfig[c]?.gramVersion)] as const; }
        catch { return [c, ''] as const; }
      }));
      if (!cancelled) setMultiChainAddresses(Object.fromEntries(entries) as Partial<Record<ChainKey, string>>);
    })();
    return () => { cancelled = true; };
  }, [multiChainConfig]);
  const [showWalletDashboard, setShowWalletDashboard] = useState(false);
  const [watchWallets, setWatchWallets] = useState<WatchedWallet[]>(loadWatchWallets);
  const [walletBalances, setWalletBalances] = useState<Record<string, { loading?: boolean; error?: string; native?: string; symbol?: string; tokens?: { symbol: string; amount: string }[] }>>({});
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletChain, setNewWalletChain] = useState<string>('ethereum');
  const [explorerApiKey, setExplorerApiKey] = useState<string>(() => { try { return localStorage.getItem(EXPLORER_API_KEY_STORAGE) || ''; } catch { return ''; } });
  const [activityContractInput, setActivityContractInput] = useState<Record<string, string>>({});
  const [activityResults, setActivityResults] = useState<Record<string, { loading?: boolean; error?: string; nonce?: number; isContract?: boolean; contractTxCount?: number; firstTx?: string; lastTx?: string; totalTxFromApi?: number; source?: 'explorer' | 'rpc-logs' | 'rpc-basic'; note?: string }>>({});
  const [expandedActivityWalletId, setExpandedActivityWalletId] = useState<string | null>(null);
  const formatFeeDynamic = (feeEth: number): string => {
    const decimals =
      feeEth < 0.000000000001 ? 18 :
      feeEth < 0.000001       ? 12 :
      feeEth < 0.0001         ? 9  :
      feeEth < 0.01           ? 6  : 4;
    return feeEth.toFixed(decimals);
  };
  const GAS_MODE_MULTIPLIER: Record<string, number> = { hemat: 0.85, standard: 1, cepat: 1.3 };
  const [gasPreviewGwei, setGasPreviewGwei] = useState<Record<string, number> | null>(null);
  const [gasPreviewLoading, setGasPreviewLoading] = useState(false);
  const [gasPreviewError, setGasPreviewError] = useState('');
  const refreshGasPreview = useCallback(async () => {
    if (!evmConfig.rpcUrl) {
      setGasPreviewError('Isi RPC URL dulu di ⚙️ Konfigurasi EVM Agent.');
      return;
    }
    setGasPreviewLoading(true);
    setGasPreviewError('');
    try {
      const provider = await getResilientEvmProvider(evmConfig.rpcUrl, evmConfig.chainId ? Number(evmConfig.chainId) : undefined);
      const feeData = await provider.getFeeData();
      const baseWei = feeData.maxFeePerGas || feeData.gasPrice;
      if (!baseWei) throw new Error('RPC tidak mengembalikan fee data.');
      const baseGwei = Number(ethers.utils.formatUnits(baseWei, 'gwei'));
      setGasPreviewGwei({
        hemat: baseGwei * GAS_MODE_MULTIPLIER.hemat,
        standard: baseGwei * GAS_MODE_MULTIPLIER.standard,
        cepat: baseGwei * GAS_MODE_MULTIPLIER.cepat,
      });
    } catch (err: any) {
      setGasPreviewError(err?.message || 'Gagal ambil gas price dari RPC.');
      setGasPreviewGwei(null);
    } finally {
      setGasPreviewLoading(false);
    }
  }, [evmConfig.rpcUrl, evmConfig.chainId]);
  useEffect(() => {
    setGasPreviewGwei(null);
    setGasPreviewError('');
    if (evmConfig.rpcUrl) refreshGasPreview();
  }, [evmConfig.chainId]);
  const estimateGasPreviewFeeEth = (gwei: number | null | undefined, gasLimit = 21000): string | null => {
    if (gwei === null || gwei === undefined || !isFinite(gwei) || gwei <= 0) return null;
    const feeEth = (gwei * gasLimit) / 1e9;
    if (feeEth === 0) return null;
    return formatFeeDynamic(feeEth);
  };
  const [newTokenSymbol, setNewTokenSymbol]   = useState('');
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [customAbiOpen, setCustomAbiOpen] = useState(false);
  const [customAbiForm, setCustomAbiForm] = useState({
    contractAddress: '', abi: '', functionName: '', args: '', value: '', mode: 'read' as 'read' | 'write',
  });
  const [opencodeCfg, setOpencodeCfg]           = useState<OpencodeConfig>(loadOpencodeConfig);
  const [opencodeStatus, setOpencodeStatus]     = useState<'checking' | 'online' | 'offline'>('checking');
  const [opencodeUrlDraft, setOpencodeUrlDraft] = useState<string>(() => loadOpencodeConfig().baseUrl);
  const [tunnelCmdCopied, setTunnelCmdCopied]   = useState(false);
  const [opencodeModels, setOpencodeModels]           = useState<OpencodeModelOption[]>([]);
  const [opencodeModelsLoading, setOpencodeModelsLoading] = useState(false);
  const [opencodeModelsError, setOpencodeModelsError]     = useState('');
  // --- Social research: X (official API) + Telegram (personal account login) ---
  const [xApiCfg, setXApiCfg]                 = useState<XApiConfig>(loadXApiConfig);
  const [xApiTokenDraft, setXApiTokenDraft]   = useState<string>(() => loadXApiConfig().bearerToken || '');
  const [xApiTesting, setXApiTesting]         = useState(false);
  const [xApiTestMsg, setXApiTestMsg]         = useState('');
  const [tgClientCfg, setTgClientCfg]         = useState<TelegramClientConfig>(loadTelegramClientConfig);
  const [tgLoginDraft, setTgLoginDraft]       = useState(() => {
    const c = loadTelegramClientConfig();
    return { apiId: c.apiId ? String(c.apiId) : '', apiHash: c.apiHash || '', phoneNumber: c.phoneNumber || '' };
  });
  const [tgLoginStep, setTgLoginStep]         = useState<'idle' | 'connecting' | 'code' | 'password' | 'error'>('idle');
  const [tgLoginError, setTgLoginError]       = useState('');
  const [tgLoginCodeInput, setTgLoginCodeInput]         = useState('');
  const [tgLoginPasswordInput, setTgLoginPasswordInput] = useState('');
  const tgLoginHandleRef = useRef<TelegramLoginHandle | null>(null);
  const [socialResearchBusy, setSocialResearchBusy] = useState(false);
  const startTgLogin = useCallback(() => {
    const apiId = parseInt(tgLoginDraft.apiId, 10);
    const cfg: TelegramClientConfig = { apiId: isNaN(apiId) ? undefined : apiId, apiHash: tgLoginDraft.apiHash.trim(), phoneNumber: tgLoginDraft.phoneNumber.trim() };
    setTgLoginError('');
    tgLoginHandleRef.current = startTelegramLogin(cfg, {
      onStep: (step) => setTgLoginStep(step === 'done' ? 'idle' : step),
      onSuccess: (sessionString, meLabel) => {
        const next: TelegramClientConfig = { ...cfg, sessionString, meLabel };
        setTgClientCfg(next);
        saveTelegramClientConfig(next);
        setTgLoginStep('idle');
        setTgLoginCodeInput('');
        setTgLoginPasswordInput('');
      },
      onError: (message) => { setTgLoginError(message); setTgLoginStep('error'); },
    });
  }, [tgLoginDraft]);
  const logoutTelegram = useCallback(async () => {
    await disconnectTelegramClient();
    const cleared: TelegramClientConfig = {};
    setTgClientCfg(cleared);
    saveTelegramClientConfig(cleared);
  }, []);
  const loadOpencodeModelList = useCallback(async () => {
    setOpencodeModelsLoading(true);
    setOpencodeModelsError('');
    try {
      const { options, defaultValue } = await fetchOpencodeProviders(opencodeCfg.baseUrl);
      setOpencodeModels(options);
      if (options.length === 0) setOpencodeModelsError('Belum ada provider/model yang tersambung di server OpenCode.');
      else if (!opencodeCfg.model && defaultValue) {
        const next = { ...opencodeCfg, model: defaultValue };
        setOpencodeCfg(next); saveOpencodeConfig(next);
      }
    } catch (err: any) {
      setOpencodeModelsError(err?.message || 'Gagal ambil daftar model dari server OpenCode.');
      setOpencodeModels([]);
    } finally {
      setOpencodeModelsLoading(false);
    }
  }, [opencodeCfg]);
  const [workflowHistory, setWorkflowHistory]       = useState<WorkflowHistoryEntry[]>(loadWorkflowHistory);
  const [learnedWorkflows, setLearnedWorkflows]     = useState<LearnedWorkflow[]>(loadLearnedWorkflows);
  const [rektOpencodeLearning, setRektOpencodeLearning] = useState<RektOpencodeLearning>(loadRektOpencodeLearning);
  const rektLearningBusyRef = useRef(false);
  const [adaptiveLearningBusy, setAdaptiveLearningBusy] = useState(false);
  const [otakRektTab, setOtakRektTab] = useState<'memori' | 'evolusi'>('memori');
  const [evolutionMsg, setEvolutionMsg]             = useState('');
  const [evolutionAnalyzing, setEvolutionAnalyzing] = useState(false);
  const [autopilotSandbox, setAutopilotSandbox] = useState<boolean>(() => {
    try { return localStorage.getItem('rektAutopilotSandbox') !== 'false'; } catch { return true; }
  });
  const [agentTeam, setAgentTeam]                 = useState<AgentDef[]>(loadAgents);
  const [agentTeamLogs, setAgentTeamLogs]         = useState<AgentLogEntry[]>(loadAgentLogs);
  const [showAgentTeamPanel, setShowAgentTeamPanel] = useState(false);
  // Panel header (Settings/otakRekt/Evolusi/EVM/Multi-Chain/Multi-Wallet/Tim Agent)
  // dibikin saling eksklusif: buka salah satu otomatis nutup yang lain lagi
  // kebuka, tapi klik panel yang sama lagi tetap toggle (buka/tutup) seperti biasa.
  const togglePanel = useCallback((panel: 'settings' | 'otakRekt' | 'evm' | 'chain' | 'wallet' | 'agentTeam') => {
    setShowSettings(prev => panel === 'settings' ? !prev : false);
    setShowOtakRekt(prev => panel === 'otakRekt' ? !prev : false);
    setShowEVMPanel(prev => panel === 'evm' ? !prev : false);
    setShowChainPanel(prev => panel === 'chain' ? !prev : false);
    setShowWalletDashboard(prev => panel === 'wallet' ? !prev : false);
    setShowAgentTeamPanel(prev => panel === 'agentTeam' ? !prev : false);
  }, []);
  const [newAgentName, setNewAgentName]           = useState('');
  const [newAgentProfession, setNewAgentProfession] = useState<AgentProfession>('scout_x');
  const [showAddAgentForm, setShowAddAgentForm]   = useState(false);
  const agentTeamRef = useRef<AgentDef[]>(agentTeam);
  useEffect(() => { agentTeamRef.current = agentTeam; }, [agentTeam]);
  const [autopilotRunning, setAutopilotRunning]   = useState(false);
  const [autopilotProgress, setAutopilotProgress] = useState<{ current: number; total: number; taskName: string } | null>(null);
  const [autopilotLog, setAutopilotLog]           = useState<AutopilotLogEntry[]>([]);
  const [autopilotScheduleEnabled, setAutopilotScheduleEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('rektAutopilotScheduleEnabled') === 'true'; } catch { return false; }
  });
  const [autopilotScheduleTime, setAutopilotScheduleTime] = useState<string>(() => {
    try { return localStorage.getItem('rektAutopilotScheduleTime') || '09:00'; } catch { return '09:00'; }
  });
  const bottomRef      = useRef<HTMLDivElement>(null);
  const chatScrollRef  = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const otakImportRef  = useRef<HTMLInputElement>(null);
  const autoTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMsgRef = useRef<number>(Date.now());
  const prevWorkflowCountRef = useRef<number>(0);
  const autopilotStopRef = useRef(false);
  const prevIsLoadingRef = useRef(false);
  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    // Anggap "di bawah" kalau jaraknya < 120px dari dasar — biar nggak perlu
    // presisi pixel-perfect buat tetap auto-scroll waktu Rekt lagi ngetik.
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);
  useEffect(() => {
    if (isHopelessOpencodeTarget(opencodeCfg.baseUrl)) {
      setOpencodeStatus('offline');
      return;
    }
    let cancelled = false;
    const ping = async () => {
      setOpencodeStatus('checking');
      const ok = await checkOpencodeHealth(opencodeCfg.baseUrl);
      if (!cancelled) setOpencodeStatus(ok ? 'online' : 'offline');
    };
    ping();
    const interval = setInterval(ping, 20_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [opencodeCfg.baseUrl]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES))); } catch {} }, [messages]);
  useEffect(() => { try { localStorage.setItem('rektAutonomousAgent', String(autonomousAgent)); } catch {} }, [autonomousAgent]);
  useEffect(() => { try { localStorage.setItem('rektAutopilotSandbox', String(autopilotSandbox)); } catch {} }, [autopilotSandbox]);
  useEffect(() => { try { localStorage.setItem('rektNotifyOnDone', String(notifyOnDone)); } catch {} }, [notifyOnDone]);
  // Bunyi "ping" pendek pakai Web Audio API (bukan file audio eksternal, jadi
  // tidak nambah aset & tetap jalan offline) — dipakai buat notif Rekt selesai ngetik.
  const playNotifyBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.34);
      osc.onended = () => ctx.close();
    } catch {}
  }, []);
  // Deteksi transisi isLoading true → false (Rekt baru selesai generate balasan)
  // lalu kasih notif: bunyi ping selalu, plus browser Notification kalau tab
  // ini sedang tidak aktif/di-background (jadi kelihatan meski lagi buka tab lain).
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading && notifyOnDone) {
      playNotifyBeep();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) {
        const lastMsg = messages[messages.length - 1];
        const preview = lastMsg?.role === 'assistant' ? lastMsg.content.replace(/[*_`#]/g, '').slice(0, 120) : 'Balasan baru sudah siap.';
        try {
          const n = new Notification('Rekt selesai ngetik', { body: preview, icon: '/iconsiac.png', tag: 'rekt-reply' });
          n.onclick = () => { window.focus(); n.close(); };
        } catch {}
      }
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, notifyOnDone, playNotifyBeep, messages]);
  // Auto-scroll ke dasar chat setiap ada teks baru — dipakai scrollTop
  // langsung (instan), BUKAN scrollIntoView({smooth}), karena waktu Rekt
  // lagi "ngetik" streamingText berubah puluhan kali per detik dan smooth-scroll
  // keburu di-interrupt tiap kali sebelum animasinya selesai, jadi keliatannya
  // nggak ke-scroll padahal teksnya udah lanjut turun (user jadi harus scroll
  // manual). Cuma auto-scroll kalau user memang lagi di dekat dasar chat —
  // kalau lagi scroll ke atas baca histori lama, posisinya nggak dipaksa turun.
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const el = chatScrollRef.current;
    if (el) { el.scrollTop = el.scrollHeight; }
    else { bottomRef.current?.scrollIntoView({ behavior: 'auto' }); }
  }, [messages, streamingText, isLoading]);
  useEffect(() => {
    if (!autoMode) return;
    const schedule = () => {
      const delay = 120_000 + Math.random() * 240_000;
      autoTimerRef.current = setTimeout(async () => {
        if (Date.now() - lastUserMsgRef.current >= 60_000 && !isLoading) {
          const text = rektAutoBrain(messages);
          if (text) {
            await streamTextInto(text, setStreamingText);
            setStreamingText('');
            setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: Date.now(), model: 'rekt-local' } as Message]);
          }
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, [autoMode, messages, isLoading]);
  const autoLearn = useCallback((userMsg: string, assistantReply: string) => {
    const newMems = extractMemoriesLocally(userMsg, assistantReply);
    if (newMems.length === 0) return;
    setOtakMemories(prev => {
      const now = Date.now();
      const entries: OtakRektMemory[] = newMems.map(m => ({
        ...m,
        id: `auto_${now}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
        hitCount: 0,
      }));
      const filtered = entries.filter(e => !prev.some(p => p.content.toLowerCase().includes(e.content.slice(0, 20).toLowerCase())));
      if (filtered.length === 0) return prev;
      const merged = [...prev, ...filtered].slice(-300);
      saveMemories(merged);
      setOtakMsg(`🧠 +${filtered.length} ingatan baru tersimpan otomatis`);
      setTimeout(() => setOtakMsg(''), 3000);
      return merged;
    });
  }, []);
  const addOrUpdateMemory = useCallback(() => {
    if (!otakInput.trim()) return;
    const tags = otakTags.split(',').map(t => t.trim()).filter(Boolean);
    setOtakMemories(prev => {
      let updated: OtakRektMemory[];
      if (otakEditId) {
        updated = prev.map(m => m.id === otakEditId ? { ...m, content: otakInput.trim(), category: otakCategory, tags, updatedAt: Date.now() } : m);
        setOtakMsg('✅ Memory diperbarui!');
      } else {
        updated = [...prev, { id: `mem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, category: otakCategory, content: otakInput.trim(), createdAt: Date.now(), updatedAt: Date.now(), tags, hitCount: 0 }];
        setOtakMsg('✅ Memory disimpan!');
      }
      saveMemories(updated);
      return updated;
    });
    setOtakInput(''); setOtakTags(''); setOtakEditId(null);
    setTimeout(() => setOtakMsg(''), 2500);
  }, [otakInput, otakCategory, otakTags, otakEditId]);
  const deleteMemory = useCallback((id: string) => {
    setOtakMemories(prev => { const u = prev.filter(m => m.id !== id); saveMemories(u); return u; });
  }, []);
  const startEditMemory = useCallback((m: OtakRektMemory) => {
    setOtakInput(m.content); setOtakCategory(m.category); setOtakTags((m.tags || []).join(', ')); setOtakEditId(m.id);
  }, []);
  const exportOtakMemory = useCallback(() => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: '2.0', memories: otakMemories }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `otakRekt_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.json`; a.click();
    URL.revokeObjectURL(url);
    setOtakMsg('✅ Memory berhasil diekspor!'); setTimeout(() => setOtakMsg(''), 2500);
  }, [otakMemories]);
  const importOtakMemory = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const imported: OtakRektMemory[] = json.memories || (Array.isArray(json) ? json : []);
        if (!imported.length) { setOtakMsg('❌ File kosong/tidak valid'); return; }
        setOtakMemories(prev => {
          const map = new Map(prev.map(m => [m.id, m]));
          imported.forEach(m => map.set(m.id, m));
          const merged = Array.from(map.values());
          saveMemories(merged);
          return merged;
        });
        setOtakMsg(`✅ ${imported.length} memory berhasil diimpor!`); setTimeout(() => setOtakMsg(''), 3000);
      } catch { setOtakMsg('❌ File JSON tidak valid'); setTimeout(() => setOtakMsg(''), 3000); }
    };
    reader.readAsText(file); e.target.value = '';
  }, []);
  const evolveWorkflows = useCallback((history: WorkflowHistoryEntry[]) => {
    setLearnedWorkflows(prev => {
      const additions = computeNewWorkflows(history, prev);
      if (additions.length === 0) return prev;
      const merged = [...prev, ...additions];
      saveLearnedWorkflows(merged);
      return merged;
    });
  }, []);
  const recordWorkflowOutcome = useCallback((skill: string, paramShape: string[], success: boolean) => {
    setWorkflowHistory(prev => {
      const updated = [...prev, { skill, paramShape, success, timestamp: Date.now() }].slice(-MAX_WORKFLOW_HISTORY);
      saveWorkflowHistory(updated);
      return updated;
    });
    setLearnedWorkflows(prev => {
      const sig = stepSignature({ skill, paramShape });
      let changed = false;
      const updated = prev.map(w => {
        if (!w.steps.some(s => stepSignature(s) === sig)) return w;
        changed = true;
        const usageCount = w.usageCount + 1;
        const successCount = w.successCount + (success ? 1 : 0);
        const failCount = w.failCount + (success ? 0 : 1);
        const shouldDisable = usageCount >= 3 && failCount / usageCount > 0.5;
        return { ...w, usageCount, successCount, failCount, enabled: shouldDisable ? false : w.enabled, updatedAt: Date.now() };
      });
      if (!changed) return prev;
      saveLearnedWorkflows(updated);
      return updated;
    });
  }, []);
  useEffect(() => {
    if (workflowHistory.length >= WORKFLOW_PATTERN_MIN_OCCURRENCE) evolveWorkflows(workflowHistory);
  }, [workflowHistory, evolveWorkflows]);
  useEffect(() => {
    if (learnedWorkflows.length > prevWorkflowCountRef.current) {
      const diff = learnedWorkflows.length - prevWorkflowCountRef.current;
      setEvolutionMsg(`🧬 +${diff} workflow baru dipelajari dari kebiasaanmu!`);
      setTimeout(() => setEvolutionMsg(''), 5000);
    }
    prevWorkflowCountRef.current = learnedWorkflows.length;
  }, [learnedWorkflows.length]);
  const manualEvolveWorkflows = useCallback(() => {
    setEvolutionAnalyzing(true);
    evolveWorkflows(workflowHistory);
    setTimeout(() => {
      setEvolutionAnalyzing(false);
      setEvolutionMsg(prevMsg => prevMsg || 'ℹ️ Belum ada pola baru yang cukup sering terjadi (minimal 3x berturut-turut).');
      setTimeout(() => setEvolutionMsg(''), 4000);
    }, 400);
  }, [evolveWorkflows, workflowHistory]);
  const persistExplorerApiKey = useCallback((key: string) => {
    setExplorerApiKey(key);
    try { localStorage.setItem(EXPLORER_API_KEY_STORAGE, key); } catch {}
  }, []);
  const refreshWalletBalance = useCallback(async (wallet: WatchedWallet) => {
    setWalletBalances(prev => ({ ...prev, [wallet.id]: { ...prev[wallet.id], loading: true, error: undefined } }));
    try {
      const preset = EVM_CHAIN_PRESETS[wallet.chainKey];
      if (!preset?.rpcUrl) throw new Error('Chain tidak dikenal.');
      const provider = await getResilientEvmProvider(preset.rpcUrl!, preset.chainId);
      const balanceWei = await provider.getBalance(wallet.address);
      const native = ethers.utils.formatEther(balanceWei);
      const symbol = { 137: 'MATIC', 56: 'BNB' }[preset.chainId as number] || 'ETH';
      const chainContracts = preset.chainId != null ? evmConfig.contractsByChain?.[preset.chainId] : undefined;
      const tokenDefs: { symbol: string; address: string }[] = [
        ...(chainContracts?.usdcAddress ? [{ symbol: 'USDC', address: chainContracts.usdcAddress }] : []),
        ...(chainContracts?.wethAddress ? [{ symbol: 'WETH', address: chainContracts.wethAddress }] : []),
        ...(chainContracts?.customTokens || []),
      ].filter(t => t.address);
      const tokens: { symbol: string; amount: string }[] = [];
      for (const t of tokenDefs) {
        try {
          const erc20 = new ethers.Contract(t.address, ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], provider);
          const [bal, dec] = await Promise.all([erc20.balanceOf(wallet.address), erc20.decimals().catch(() => 18)]);
          tokens.push({ symbol: t.symbol, amount: ethers.utils.formatUnits(bal, dec) });
        } catch {
        }
      }
      setWalletBalances(prev => ({ ...prev, [wallet.id]: { loading: false, native, symbol, tokens } }));
    } catch (e: any) {
      setWalletBalances(prev => ({ ...prev, [wallet.id]: { loading: false, error: e?.message || 'Gagal ambil saldo.' } }));
    }
  }, [evmConfig.contractsByChain]);
  const refreshAllWalletBalances = useCallback(() => {
    watchWallets.forEach(w => { refreshWalletBalance(w); });
  }, [watchWallets, refreshWalletBalance]);
  useEffect(() => {
    watchWallets.forEach(w => { if (!walletBalances[w.id]) refreshWalletBalance(w); });
  }, [watchWallets]);
  const addWatchWallet = useCallback(() => {
    const address = newWalletAddress.trim();
    if (!ethers.utils.isAddress(address)) { alert('Alamat EVM tidak valid.'); return; }
    const wallet: WatchedWallet = {
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: newWalletLabel.trim() || `Wallet #${watchWallets.length + 1}`,
      address: ethers.utils.getAddress(address), 
      chainKey: newWalletChain,
    };
    setWatchWallets(prev => { const updated = [...prev, wallet]; saveWatchWallets(updated); return updated; });
    setNewWalletLabel('');
    setNewWalletAddress('');
  }, [newWalletLabel, newWalletAddress, newWalletChain, watchWallets.length]);
  const addCurrentEvmWalletToWatch = useCallback(() => {
    const address = getLocalEVMWalletAddress(evmConfig);
    if (!address) { alert('Belum ada wallet EVM Agent aktif — isi Private Key dulu di panel ⛓️ EVM Agent.'); return; }
    const chainKey = Object.keys(EVM_CHAIN_PRESETS).find(k => EVM_CHAIN_PRESETS[k].chainId === evmConfig.chainId) || 'ethereum';
    const wallet: WatchedWallet = {
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: `EVM Agent (${evmConfig.networkName || chainKey})`,
      address, chainKey,
    };
    setWatchWallets(prev => {
      if (prev.some(w => w.address.toLowerCase() === address.toLowerCase() && w.chainKey === chainKey)) return prev; 
      const updated = [...prev, wallet]; saveWatchWallets(updated); return updated;
    });
  }, [evmConfig]);
  const removeWatchWallet = useCallback((id: string) => {
    setWatchWallets(prev => { const updated = prev.filter(w => w.id !== id); saveWatchWallets(updated); return updated; });
    setWalletBalances(prev => { const { [id]: _drop, ...rest } = prev; return rest; });
    setActivityResults(prev => { const { [id]: _drop, ...rest } = prev; return rest; });
  }, []);
  const checkWalletActivity = useCallback(async (wallet: WatchedWallet) => {
    setActivityResults(prev => ({ ...prev, [wallet.id]: { loading: true } }));
    try {
      const preset = EVM_CHAIN_PRESETS[wallet.chainKey];
      if (!preset?.rpcUrl) throw new Error('Chain tidak dikenal.');
      const provider = await getResilientEvmProvider(preset.rpcUrl!, preset.chainId);
      const contractAddress = (activityContractInput[wallet.id] || '').trim();
      const [nonce, code] = await Promise.all([
        provider.getTransactionCount(wallet.address),
        provider.getCode(wallet.address),
      ]);
      const isContract = code !== '0x';
      if (explorerApiKey && preset.chainId != null && ETHERSCAN_V2_SUPPORTED_CHAIN_IDS.has(preset.chainId)) {
        try {
          const url = `https://api.etherscan.io/v2/api?chainid=${preset.chainId}&module=account&action=txlist&address=${wallet.address}&startblock=0&endblock=99999999&sort=desc&apikey=${explorerApiKey}`;
          const res = await fetch(url);
          const data = await res.json();
          const txs: any[] = Array.isArray(data.result) ? data.result : [];
          if (data.status === '0' && txs.length === 0 && data.message && !/no transactions/i.test(data.message)) {
            throw new Error(data.message || 'Explorer API menolak request (cek API key).');
          }
          let contractTxCount: number | undefined;
          let firstTx: string | undefined, lastTx: string | undefined;
          if (contractAddress && ethers.utils.isAddress(contractAddress)) {
            const related = txs.filter(t => String(t.to || '').toLowerCase() === contractAddress.toLowerCase());
            contractTxCount = related.length;
            if (related.length > 0) {
              firstTx = new Date(Number(related[related.length - 1].timeStamp) * 1000).toLocaleDateString('id-ID');
              lastTx = new Date(Number(related[0].timeStamp) * 1000).toLocaleDateString('id-ID');
            }
          }
          setActivityResults(prev => ({ ...prev, [wallet.id]: {
            loading: false, nonce, isContract, contractTxCount, firstTx, lastTx,
            totalTxFromApi: txs.length, source: 'explorer',
            note: `Diambil dari Etherscan-compatible API (maks ${txs.length} tx terbaru per halaman API — bukan berarti total tx sepanjang umur wallet kalau lebih dari itu).`,
          } }));
          return;
        } catch (apiErr: any) {
          setActivityResults(prev => ({ ...prev, [wallet.id]: { ...prev[wallet.id], note: `Explorer API gagal (${apiErr?.message || 'unknown'}), fallback ke RPC-only...` } }));
        }
      }
      let contractTxCount: number | undefined;
      let note = 'Nonce & status contract langsung dari RPC (akurat, real-time). Isi "Explorer API Key" di atas buat hitungan interaksi kontrak yang lebih lengkap (bukan cuma histori recent).';
      if (contractAddress && ethers.utils.isAddress(contractAddress)) {
        try {
          const latestBlock = await provider.getBlockNumber();
          const RECENT_RANGE = 30000; 
          const fromBlock = Math.max(0, latestBlock - RECENT_RANGE);
          const paddedWallet = ethers.utils.hexZeroPad(wallet.address, 32).toLowerCase();
          const logs = await provider.getLogs({ address: contractAddress, fromBlock, toBlock: latestBlock });
          contractTxCount = logs.filter(l => l.topics.some(t => t.toLowerCase() === paddedWallet)).length;
          note = `Dihitung dari event log ${RECENT_RANGE.toLocaleString('id-ID')} blok terakhir saja (RPC publik biasanya batasin rentang query) — kalau interaksinya lebih lama dari itu, isi "Explorer API Key" di atas biar kehitung penuh.`;
        } catch (logErr: any) {
          note = `Nonce & status contract di atas tetap akurat, tapi cek interaksi kontrak spesifik gagal (${logErr?.message || 'RPC ini kemungkinan gak dukung eth_getLogs rentang besar'}) — isi "Explorer API Key" buat cara yang lebih reliable.`;
        }
      }
      setActivityResults(prev => ({ ...prev, [wallet.id]: { loading: false, nonce, isContract, contractTxCount, source: contractTxCount != null ? 'rpc-logs' : 'rpc-basic', note } }));
    } catch (e: any) {
      setActivityResults(prev => ({ ...prev, [wallet.id]: { loading: false, error: e?.message || 'Gagal cek aktivitas.' } }));
    }
  }, [activityContractInput, explorerApiKey]);
  const toggleWorkflowEnabled = useCallback((id: string) => {
    setLearnedWorkflows(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, enabled: !w.enabled, updatedAt: Date.now() } : w);
      saveLearnedWorkflows(updated);
      return updated;
    });
  }, []);
  const deleteLearnedWorkflow = useCallback((id: string) => {
    setLearnedWorkflows(prev => {
      const updated = prev.filter(w => w.id !== id);
      saveLearnedWorkflows(updated);
      return updated;
    });
  }, []);
  const executeEVMTask = useCallback(async (skill: string, rawInput: Record<string, string>): Promise<string | undefined> => {
    if (!evmConfig.rpcUrl || !evmConfig.privateKey) {
      const errMsg = '❌ EVM Wallet belum siap. Isi RPC URL & Private Key di config.';
      setEVMMsg(errMsg);
      setTimeout(() => setEVMMsg(''), 4000);
      setMessages(prev => [...prev, { role: 'assistant', content: `⛓️ **${skill}** ❌ GAGAL\n\n${errMsg}`, timestamp: Date.now() }]);
      return undefined;
    }
    const walletAddrForPlaceholder = getLocalEVMWalletAddress(evmConfig);
    const PLACEHOLDER_RE = /^__([A-Z0-9_]+)__$/;
    const resolvePlaceholder = (token: string): { value: string; error?: string } => {
      const m = token.match(PLACEHOLDER_RE);
      if (!m) return { value: token };
      const key = m[1];
      if (key === 'WALLET') {
        return walletAddrForPlaceholder
          ? { value: walletAddrForPlaceholder }
          : { value: '', error: 'Wallet address tidak terbaca (Private Key belum valid)' };
      }
      if (key === 'ROUTER') {
        return evmConfig.dexRouterAddress
          ? { value: evmConfig.dexRouterAddress }
          : { value: '', error: 'DEX Router Address belum diisi di ⚙️ Konfigurasi EVM Agent' };
      }
      if (key === 'ETH' || key === 'NATIVE') {
        return { value: NATIVE_ETH_ADDRESS };
      }
      const tokenAddress = resolveTokenBySymbol(evmConfig, key);
      return tokenAddress
        ? { value: tokenAddress }
        : { value: '', error: `Alamat contract token ${key} belum ada. Tambahkan di ⚙️ Konfigurasi EVM Agent → Daftar Token ERC-20, atau sebutkan alamat 0x... langsung di chat` };
    };
    const input: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawInput)) {
      if (typeof val !== 'string') { input[key] = val; continue; }
      const resolved = resolvePlaceholder(val);
      if (resolved.error) {
        const errMsg = `${resolved.error}.`;
        setEVMMsg(`❌ ${skill}: ${errMsg}`);
        setTimeout(() => setEVMMsg(''), 6000);
        setMessages(prev => [...prev, { role: 'assistant', content: `⛓️ **${skill}** ❌ GAGAL\n\n${errMsg}`, timestamp: Date.now() }]);
        return undefined;
      }
      input[key] = resolved.value;
    }
    const taskId = `evm_${Date.now()}`;
    const newLog: EVMTaskLog = { id: taskId, skill, status: 'running', input, timestamp: Date.now() };
    setEVMLogs(prev => [newLog, ...prev].slice(0, 30));
    setEVMRunning(true);
    try {
      if (skill === 'SwitchNetworkSkill') {
        const netKey = Object.keys(EVM_CHAIN_PRESETS).find(k => String(EVM_CHAIN_PRESETS[k].chainId) === String(input.chainId));
        const newCfg = switchActiveChain(evmConfig, {
          chainId: Number(input.chainId),
          networkName: input.networkName,
          rpcUrl: input.rpcUrl || evmConfig.rpcUrl,
          explorerUrl: netKey ? EVM_CHAIN_PRESETS[netKey].explorerUrl : evmConfig.explorerUrl,
        });
        setEVMConfig(newCfg as Partial<EVMConfig>);
        saveEVMConfig(newCfg as Partial<EVMConfig>);
        const hasContracts = !!(newCfg.dexRouterAddress || newCfg.nftContractAddress || (newCfg.customTokens && newCfg.customTokens.length));
        const resultMsg = `⛓️ **SwitchNetworkSkill** ✅\n\n🌐 **${input.networkName}**\n- Chain ID: \`${input.chainId}\`\n- RPC aktif dan wallet akan memakai network ini untuk transaksi berikutnya.${hasContracts ? '' : '\n- ⚠️ Belum ada DEX Router/USDC/WETH/NFT contract tersimpan untuk network ini — isi dulu di ⚙️ Konfigurasi EVM Agent kalau mau pakai SwapSkill/NFTMintSkill di sini.'}`;
        setEVMLogs(prev => prev.map(l => l.id === taskId ? { ...l, status: 'success', result: resultMsg, timestamp: Date.now() } : l));
        setMessages(prev => [...prev, { role: 'assistant', content: resultMsg, timestamp: Date.now() }]);
        return resultMsg;
      }
      const provider = await getResilientEvmProvider(evmConfig.rpcUrl, evmConfig.chainId ? Number(evmConfig.chainId) : undefined);
      const network = await provider.getNetwork();
      if (evmConfig.chainId && Number(network.chainId) !== Number(evmConfig.chainId)) {
        throw new Error(`Chain ID RPC (${network.chainId}) berbeda dengan config (${evmConfig.chainId}).`);
      }
      const wallet = new ethers.Wallet(evmConfig.privateKey.trim(), provider);
      const address = await wallet.getAddress();
      const explorer = evmConfig.explorerUrl || 'https://etherscan.io';
      const networkName = evmConfig.networkName || `Chain ${network.chainId}`;
      const erc20Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function allowance(address owner,address spender) view returns (uint256)',
        'function approve(address spender,uint256 amount) returns (bool)',
        'function transfer(address to,uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
      ];
      const validAddress = (value: string, label: string) => {
        if (!ethers.utils.isAddress(value)) throw new Error(`${label} bukan alamat EVM yang valid.`);
        return ethers.utils.getAddress(value);
      };
      const parseCustomAbiFragments = (raw?: string): any[] => {
        if (!raw || !raw.trim()) return [];
        const trimmed = raw.trim();
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch { /* bukan JSON valid, coba parsing baris demi baris */ }
        return trimmed.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
      };
      const buildAbi = (baseAbi: string[], customAbiRaw?: string): any[] => {
        const custom = parseCustomAbiFragments(customAbiRaw);
        return custom.length > 0 ? [...custom, ...baseAbi] : baseAbi;
      };
      const buildInterface = (customAbiRaw: string | undefined, fallbackSignature?: string): ethers.utils.Interface => {
        const custom = parseCustomAbiFragments(customAbiRaw);
        if (custom.length > 0) return new ethers.utils.Interface(custom);
        if (fallbackSignature) return new ethers.utils.Interface([`function ${fallbackSignature}`]);
        throw new Error('Isi "customAbi" (ABI JSON/signature) atau "functionSignature" dulu.');
      };
      const GAS_SPEED_MULTIPLIER: Record<string, number> = { hemat: 0.85, standard: 1, cepat: 1.3 };
      const buildGasOverrides = async (): Promise<Record<string, ethers.BigNumber>> => {
        if (evmConfig.gasMode === 'custom' && evmConfig.customGasGwei) {
          return { gasPrice: ethers.utils.parseUnits(evmConfig.customGasGwei, 'gwei') };
        }
        const feeData = await provider.getFeeData();
        const mult = GAS_SPEED_MULTIPLIER[evmConfig.gasMode || 'standard'] ?? 1;
        const scale = (bn: ethers.BigNumber) => bn.mul(Math.round(mult * 1000)).div(1000);
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          return { maxFeePerGas: scale(feeData.maxFeePerGas), maxPriorityFeePerGas: scale(feeData.maxPriorityFeePerGas) };
        }
        if (feeData.gasPrice) return { gasPrice: scale(feeData.gasPrice) };
        return {};
      };
      const GAS_LIMIT_BUFFER_BPS = 2000; 
      const estimateGasWithBuffer = async (estimateFn: () => Promise<ethers.BigNumber>): Promise<ethers.BigNumber> => {
        const raw = await estimateFn();
        return raw.mul(10000 + GAS_LIMIT_BUFFER_BPS).div(10000);
      };
      const safeEstimateGasLimit = async (
        label: string,
        estimateFn: () => Promise<ethers.BigNumber>,
      ): Promise<ethers.BigNumber> => {
        try {
          return await estimateGasWithBuffer(estimateFn);
        } catch (err: any) {
          const reason = err?.reason || err?.error?.message || err?.data?.message || err?.message || 'tidak diketahui';
          throw new Error(`Estimasi gas untuk ${label} gagal/kurang (${reason}) — tx DIBATALKAN sebelum kirim, tidak ada gas yang kepotong.`);
        }
      };
      const previewFee = (label: string, gasLimit: ethers.BigNumber, priceOverrides: Record<string, ethers.BigNumber>) => {
        const unitPrice = priceOverrides.gasPrice || priceOverrides.maxFeePerGas;
        if (!unitPrice) return;
        const estFee = gasLimit.mul(unitPrice);
        const feeEthNum = parseFloat(ethers.utils.formatEther(estFee));
        const feeStr = isFinite(feeEthNum) && feeEthNum > 0 ? formatFeeDynamic(feeEthNum) : ethers.utils.formatEther(estFee);
        setMessages(prev => [...prev, {
          role: 'assistant',
          timestamp: Date.now(),
          content: `⛽ **${label}** — gas limit di-set **${gasLimit.toString()}** (buffer +${GAS_LIMIT_BUFFER_BPS / 100}% dari estimasi, biar nggak mepet & rawan out-of-gas) → estimasi fee maks **~${feeStr} ETH** (mode: ${evmConfig.gasMode || 'standard'}).`,
        }]);
      };
      const ensureSufficientBalance = async (label: string, gasLimit: ethers.BigNumber, priceOverrides: Record<string, ethers.BigNumber>, valueWei: ethers.BigNumberish = 0) => {
        const unitPrice = priceOverrides.gasPrice || priceOverrides.maxFeePerGas || ethers.BigNumber.from(0);
        const estimatedFee = gasLimit.mul(unitPrice);
        const value = ethers.BigNumber.from(valueWei);
        const required = estimatedFee.add(value);
        const balance = await provider.getBalance(address);
        if (balance.lt(required)) {
          const kurang = required.sub(balance);
          throw new Error(
            `Saldo ETH kamu nggak cukup buat ${label} — tx DIBATALKAN, belum dikirim ke jaringan.\n` +
            `- Estimasi gas fee: **${formatFeeDynamic(parseFloat(ethers.utils.formatEther(estimatedFee)))} ETH**` +
            (value.gt(0) ? ` + value **${ethers.utils.formatEther(value)} ETH**` : '') +
            ` = butuh **${ethers.utils.formatEther(required)} ETH**\n` +
            `- Saldo kamu sekarang: **${ethers.utils.formatEther(balance)} ETH**\n` +
            `- Kurang: **${ethers.utils.formatEther(kurang)} ETH**\n\n` +
            `Isi dulu saldo native coin di wallet \`${address}\` (klaim di halaman Faucet kalau ini testnet), baru coba lagi.`
          );
        }
      };
      const preflightCheck = async (to: string, data: string, value: ethers.BigNumberish = 0) => {
        try {
          await provider.call({ to, data, value, from: address });
        } catch (err: any) {
          const reason = err?.reason || err?.error?.message || err?.data?.message || err?.message || 'Transaksi akan revert';
          throw new Error(`Simulasi gagal, tx DIBATALKAN sebelum kirim (gas aman, tidak kepotong): ${reason}`);
        }
      };
      let resultMsg = '';
      let txHash: string | undefined;
      if (skill === 'BalanceSkill') {
        const balance = await provider.getBalance(address);
        resultMsg = `⛓️ **BalanceSkill** ✅\n\n- Wallet: \`${address}\`\n- Network: **${networkName}**\n- Balance: **${ethers.utils.formatEther(balance)} ${input.symbol || 'ETH'}**\n- Chain ID: \`${network.chainId}\`\n\nWallet berhasil dibaca langsung dari RPC.`;
      } else if (skill === 'TokenBalanceSkill') {
        const tokenAddress = validAddress(input.tokenAddress, 'Token');
        const token = new ethers.Contract(tokenAddress, buildAbi(erc20Abi, input.customAbi), provider);
        const [balance, decimals, symbol] = await Promise.all([token.balanceOf(address), token.decimals(), token.symbol()]);
        resultMsg = `⛓️ **TokenBalanceSkill** ✅\n\n- Wallet: \`${address}\`\n- Token: \`${tokenAddress}\`\n- Balance: **${ethers.utils.formatUnits(balance, decimals)} ${symbol}**\n- Network: **${networkName}**${input.customAbi ? '\n- Mode: 🔧 Custom ABI' : ''}`;
      } else if (skill === 'AllowanceSkill') {
        const tokenAddress = validAddress(input.tokenAddress, 'Token');
        const spender = validAddress(input.spender, 'Spender');
        const token = new ethers.Contract(tokenAddress, buildAbi(erc20Abi, input.customAbi), provider);
        const [allowance, decimals, symbol] = await Promise.all([token.allowance(address, spender), token.decimals(), token.symbol()]);
        resultMsg = `⛓️ **AllowanceSkill** ✅\n\n- Owner: \`${address}\`\n- Spender: \`${spender}\`\n- Allowance: **${ethers.utils.formatUnits(allowance, decimals)} ${symbol}**${input.customAbi ? '\n- Mode: 🔧 Custom ABI' : ''}`;
      } else if (skill === 'PaymentSkill') {
        const to = validAddress(input.to, 'Recipient');
        const amount = input.amountInEther || '0';
        const value = ethers.utils.parseEther(amount);
        const gasOverrides = await buildGasOverrides();
        const gasLimit = await safeEstimateGasLimit('PaymentSkill', () => wallet.estimateGas({ to, value }));
        previewFee('PaymentSkill', gasLimit, gasOverrides);
        await ensureSufficientBalance('PaymentSkill', gasLimit, gasOverrides, value);
        const tx = await wallet.sendTransaction({ to, value, ...gasOverrides, gasLimit });
        txHash = tx.hash;
        const receipt = await tx.wait();
        const feeInfo = receipt ? `\n- Fee: **${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice || 0))} ETH** (mode: ${evmConfig.gasMode || 'standard'})` : '';
        resultMsg = `⛓️ **PaymentSkill** ✅ TRANSACTION CONFIRMED\n\n- From: \`${address}\`\n- To: \`${to}\`\n- Amount: **${amount} ${input.symbol || 'ETH'}**\n- Block: **${receipt?.blockNumber ?? '-'}**${feeInfo}\n- Tx: [${tx.hash.slice(0, 18)}...](${explorer}/tx/${tx.hash})`;
      } else if (skill === 'ApproveSkill') {
        const tokenAddress = validAddress(input.tokenAddress, 'Token');
        const spender = validAddress(input.spender, 'Spender');
        const token = new ethers.Contract(tokenAddress, buildAbi(erc20Abi, input.customAbi), wallet);
        const decimals = Number(await token.decimals());
        const amount = input.amount === 'unlimited' || input.amount === 'max' ? ethers.constants.MaxUint256 : ethers.utils.parseUnits(input.amount || '0', decimals);
        await token.callStatic.approve(spender, amount).catch((err: any) => { throw new Error(`Simulasi gagal, tx DIBATALKAN sebelum kirim (gas aman): ${err?.reason || err?.message || 'akan revert'}`); });
        const gasOverrides = await buildGasOverrides();
        const gasLimit = await safeEstimateGasLimit('ApproveSkill', () => token.estimateGas.approve(spender, amount));
        previewFee('ApproveSkill', gasLimit, gasOverrides);
        await ensureSufficientBalance('ApproveSkill', gasLimit, gasOverrides, 0);
        const tx = await token.approve(spender, amount, { ...gasOverrides, gasLimit });
        txHash = tx.hash;
        const receipt = await tx.wait();
        const feeInfo = receipt ? `\n- Fee: **${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice || 0))} ETH** (mode: ${evmConfig.gasMode || 'standard'})` : '';
        resultMsg = `⛓️ **ApproveSkill** ✅ TRANSACTION CONFIRMED\n\n- Token: \`${tokenAddress}\`\n- Spender: \`${spender}\`\n- Amount: **${amount === ethers.constants.MaxUint256 ? 'UNLIMITED' : input.amount}**\n- Block: **${receipt?.blockNumber ?? '-'}**${feeInfo}\n- Tx: [${tx.hash.slice(0, 18)}...](${explorer}/tx/${tx.hash})${input.customAbi ? '\n- Mode: 🔧 Custom ABI' : ''}`;
      } else if (skill === 'ERC20TransferSkill') {
        const tokenAddress = validAddress(input.tokenAddress, 'Token');
        const to = validAddress(input.to, 'Recipient');
        const token = new ethers.Contract(tokenAddress, buildAbi(erc20Abi, input.customAbi), wallet);
        const decimals = Number(await token.decimals());
        const transferAmount = ethers.utils.parseUnits(input.amount || '0', decimals);
        await token.callStatic.transfer(to, transferAmount).catch((err: any) => { throw new Error(`Simulasi gagal, tx DIBATALKAN sebelum kirim (gas aman): ${err?.reason || err?.message || 'akan revert'}`); });
        const gasOverrides = await buildGasOverrides();
        const gasLimit = await safeEstimateGasLimit('ERC20TransferSkill', () => token.estimateGas.transfer(to, transferAmount));
        previewFee('ERC20TransferSkill', gasLimit, gasOverrides);
        await ensureSufficientBalance('ERC20TransferSkill', gasLimit, gasOverrides, 0);
        const tx = await token.transfer(to, transferAmount, { ...gasOverrides, gasLimit });
        txHash = tx.hash;
        const receipt = await tx.wait();
        const feeInfo = receipt ? `\n- Fee: **${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice || 0))} ETH** (mode: ${evmConfig.gasMode || 'standard'})` : '';
        resultMsg = `⛓️ **ERC20TransferSkill** ✅ TRANSACTION CONFIRMED\n\n- Token: \`${tokenAddress}\`\n- To: \`${to}\`\n- Amount: **${input.amount}**\n- Block: **${receipt?.blockNumber ?? '-'}**${feeInfo}\n- Tx: [${tx.hash.slice(0, 18)}...](${explorer}/tx/${tx.hash})${input.customAbi ? '\n- Mode: 🔧 Custom ABI' : ''}`;
      } else if (skill === 'ReadContractSkill') {
        const contractAddress = validAddress(input.contractAddress, 'Contract');
        const functionName = input.functionName || 'balanceOf';
        const iface = buildInterface(input.customAbi, functionName);
        const args = input.args && input.args !== address ? JSON.parse(input.args) : (functionName.includes('balanceOf') ? [address] : []);
        const data = iface.encodeFunctionData(functionName, Array.isArray(args) ? args : [args]);
        const rawResult = await provider.call({ to: contractAddress, data });
        let decodedResult = '';
        try {
          const decoded = iface.decodeFunctionResult(functionName, rawResult);
          decodedResult = decoded.length === 1 ? decoded[0].toString() : JSON.stringify(decoded.map((d: any) => d.toString()));
        } catch { /* ABI hasil tebakan mungkin gak match return type — biarkan tampil raw saja */ }
        resultMsg = `⛓️ **ReadContractSkill** ✅\n\n- Contract: \`${contractAddress}\`\n- Function: **${functionName}**\n- Raw result: \`${rawResult}\`${decodedResult ? `\n- Decoded: **${decodedResult}**` : ''}\n- Network: **${networkName}**${input.customAbi ? '\n- Mode: 🔧 Custom ABI' : ''}`;
      } else if (skill === 'ContractCallSkill') {
        const contractAddress = validAddress(input.contractAddress, 'Contract');
        const fn = input.functionSignature || input.functionName;
        const functionName = input.functionName || (fn ? fn.split('(')[0] : '');
        if (!functionName) throw new Error('functionName wajib diisi (atau functionSignature).');
        const iface = buildInterface(input.customAbi, fn);
        let args: any[] = [];
        if (input.args) {
          try { args = JSON.parse(input.args); } catch { args = input.args.split(',').map(v => v.trim()).filter(Boolean); }
        }
        const data = iface.encodeFunctionData(functionName, Array.isArray(args) ? args : [args]);
        const value = input.value ? ethers.utils.parseEther(input.value) : 0n;
        await preflightCheck(contractAddress, data, value);
        const gasOverrides = await buildGasOverrides();
        const gasLimit = await safeEstimateGasLimit('ContractCallSkill', () => wallet.estimateGas({ to: contractAddress, data, value }));
        previewFee('ContractCallSkill', gasLimit, gasOverrides);
        await ensureSufficientBalance('ContractCallSkill', gasLimit, gasOverrides, value);
        const tx = await wallet.sendTransaction({ to: contractAddress, data, value, ...gasOverrides, gasLimit });
        txHash = tx.hash;
        const receipt = await tx.wait();
        const feeInfo = receipt ? `\n- Fee: **${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice || 0))} ETH** (mode: ${evmConfig.gasMode || 'standard'})` : '';
        resultMsg = `⛓️ **ContractCallSkill** ✅ TRANSACTION CONFIRMED\n\n- Contract: \`${contractAddress}\`\n- Function: **${functionName}**${input.customAbi ? ' (🔧 Custom ABI)' : ''}\n- Block: **${receipt?.blockNumber ?? '-'}**${feeInfo}\n- Tx: [${tx.hash.slice(0, 18)}...](${explorer}/tx/${tx.hash})`;
      } else if (skill === 'StakeSkill') {
        const contractAddress = validAddress(input.contractAddress, 'Staking contract');
        const fn = input.functionSignature || 'stake()';
        const functionName = input.functionName || fn.split('(')[0];
        const iface = buildInterface(input.customAbi, fn);
        const args = input.args ? JSON.parse(input.args) : [];
        const data = iface.encodeFunctionData(functionName, Array.isArray(args) ? args : [args]);
        const value = input.amount ? ethers.utils.parseEther(input.amount) : 0n;
        await preflightCheck(contractAddress, data, value);
        const gasOverrides = await buildGasOverrides();
        const gasLimit = await safeEstimateGasLimit('StakeSkill', () => wallet.estimateGas({ to: contractAddress, data, value }));
        previewFee('StakeSkill', gasLimit, gasOverrides);
        await ensureSufficientBalance('StakeSkill', gasLimit, gasOverrides, value);
        const tx = await wallet.sendTransaction({ to: contractAddress, data, value, ...gasOverrides, gasLimit });
        txHash = tx.hash;
        const receipt = await tx.wait();
        const feeInfo = receipt ? `\n- Fee: **${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice || 0))} ETH** (mode: ${evmConfig.gasMode || 'standard'})` : '';
        resultMsg = `⛓️ **StakeSkill** ✅ TRANSACTION CONFIRMED\n\n- Contract: \`${contractAddress}\`\n- Amount: **${input.amount || '0'} ETH**\n- Block: **${receipt?.blockNumber ?? '-'}**${feeInfo}\n- Tx: [${tx.hash.slice(0, 18)}...](${explorer}/tx/${tx.hash})${input.customAbi ? '\n- Mode: 🔧 Custom ABI' : ''}`;
      } else if (skill === 'NFTMintSkill') {
        const contractAddress = validAddress(input.contractAddress || evmConfig.nftContractAddress || '', 'NFT contract');
        const fn = input.functionSignature || 'mint(string)';
        const functionName = input.functionName || fn.split('(')[0];
        const iface = buildInterface(input.customAbi, fn);
        const args = input.args ? JSON.parse(input.args) : [input.tokenURI || ''];
        const data = iface.encodeFunctionData(functionName, Array.isArray(args) ? args : [args]);
        const value = input.value ? ethers.utils.parseEther(input.value) : 0n;
        await preflightCheck(contractAddress, data, value);
        const gasOverrides = await buildGasOverrides();
        const gasLimit = await safeEstimateGasLimit('NFTMintSkill', () => wallet.estimateGas({ to: contractAddress, data, value }));
        previewFee('NFTMintSkill', gasLimit, gasOverrides);
        await ensureSufficientBalance('NFTMintSkill', gasLimit, gasOverrides, value);
        const tx = await wallet.sendTransaction({ to: contractAddress, data, value, ...gasOverrides, gasLimit });
        txHash = tx.hash;
        const receipt = await tx.wait();
        const feeInfo = receipt ? `\n- Fee: **${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice || 0))} ETH** (mode: ${evmConfig.gasMode || 'standard'})` : '';
        resultMsg = `⛓️ **NFTMintSkill** ✅ TRANSACTION CONFIRMED\n\n- Contract: \`${contractAddress}\`\n- Block: **${receipt?.blockNumber ?? '-'}**${feeInfo}\n- Tx: [${tx.hash.slice(0, 18)}...](${explorer}/tx/${tx.hash})${input.customAbi ? '\n- Mode: 🔧 Custom ABI' : ''}`;
      } else if (skill === 'SwapSkill') {
        if (!evmConfig.dexRouterAddress) {
          throw new Error('DEX Router Address belum diisi. Isi dulu di ⚙️ Konfigurasi EVM Agent.');
        }
        if (!evmConfig.wethAddress) {
          throw new Error('WETH Address belum diisi. Dibutuhkan sebagai hop/wrap untuk swap via native coin. Isi dulu di ⚙️ Konfigurasi EVM Agent.');
        }
        const routerAddress = validAddress(evmConfig.dexRouterAddress, 'DEX Router');
        const wethAddress   = validAddress(evmConfig.wethAddress, 'WETH');
        const routerAbi = [
          'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
          'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
          'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
          'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
        ];
        const router     = new ethers.Contract(routerAddress, buildAbi(routerAbi, input.customAbi), wallet);
        const routerRead = new ethers.Contract(routerAddress, buildAbi(routerAbi, input.customAbi), provider);
        const isNativeIn  = (input.tokenInAddress  || '').toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
        const isNativeOut = (input.tokenOutAddress || '').toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
        if (isNativeIn && isNativeOut) throw new Error('Tidak bisa swap native coin (ETH) ke dirinya sendiri.');
        const tokenInAddr  = isNativeIn  ? wethAddress : validAddress(input.tokenInAddress,  'Token In');
        const tokenOutAddr = isNativeOut ? wethAddress : validAddress(input.tokenOutAddress, 'Token Out');
        if (tokenInAddr.toLowerCase() === tokenOutAddr.toLowerCase()) throw new Error('Token asal dan token tujuan sama.');
        const path = (isNativeIn || isNativeOut || tokenInAddr.toLowerCase() === wethAddress.toLowerCase() || tokenOutAddr.toLowerCase() === wethAddress.toLowerCase())
          ? [tokenInAddr, tokenOutAddr]
          : [tokenInAddr, wethAddress, tokenOutAddr];
        const slippageBps = input.slippageBps ? Math.max(1, Math.min(5000, Number(input.slippageBps))) : 100; 
        const deadlineMinutes = input.deadlineMinutes ? Number(input.deadlineMinutes) : 20;
        const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;
        let amountInWei: ethers.BigNumber;
        let approveTxHash: string | undefined;
        let tokenInSymbol = input.tokenIn || 'ETH';
        if (isNativeIn) {
          amountInWei = ethers.utils.parseEther(input.amountIn || input.amount || '0');
        } else {
          const tokenInContract = new ethers.Contract(tokenInAddr, erc20Abi, wallet);
          const [decimalsIn, symbolIn, balanceIn] = await Promise.all([
            tokenInContract.decimals(), tokenInContract.symbol(), tokenInContract.balanceOf(address),
          ]);
          tokenInSymbol = symbolIn;
          amountInWei = ethers.utils.parseUnits(input.amountIn || input.amount || '0', decimalsIn);
          if (balanceIn.lt(amountInWei)) {
            throw new Error(`Saldo ${symbolIn} tidak cukup. Punya ${ethers.utils.formatUnits(balanceIn, decimalsIn)}, butuh ${input.amountIn || input.amount}.`);
          }
          const currentAllowance: ethers.BigNumber = await tokenInContract.allowance(address, routerAddress);
          if (currentAllowance.lt(amountInWei)) {
            const approveGasOverrides = await buildGasOverrides();
            const approveGasLimit = await safeEstimateGasLimit('SwapSkill (approve)', () => tokenInContract.estimateGas.approve(routerAddress, amountInWei));
            previewFee('SwapSkill (approve)', approveGasLimit, approveGasOverrides);
            await ensureSufficientBalance('SwapSkill (approve)', approveGasLimit, approveGasOverrides, 0);
            const approveTx = await tokenInContract.approve(routerAddress, amountInWei, { ...approveGasOverrides, gasLimit: approveGasLimit });
            approveTxHash = approveTx.hash;
            await approveTx.wait();
          }
        }
        let amountOutMin = ethers.BigNumber.from(0);
        try {
          const amountsOut: ethers.BigNumber[] = await routerRead.getAmountsOut(amountInWei, path);
          const expectedOut = amountsOut[amountsOut.length - 1];
          amountOutMin = expectedOut.mul(10000 - slippageBps).div(10000);
        } catch {
          throw new Error('Gagal ambil quote harga dari router (kemungkinan pair/liquidity tidak tersedia di path ini).');
        }
        let tx;
        const swapGasOverrides = await buildGasOverrides();
        if (isNativeIn) {
          const data = router.interface.encodeFunctionData('swapExactETHForTokens', [amountOutMin, path, address, deadline]);
          await preflightCheck(routerAddress, data, amountInWei);
          const swapGasLimit = await safeEstimateGasLimit('SwapSkill', () => router.estimateGas.swapExactETHForTokens(amountOutMin, path, address, deadline, { value: amountInWei }));
          previewFee('SwapSkill', swapGasLimit, swapGasOverrides);
          await ensureSufficientBalance('SwapSkill', swapGasLimit, swapGasOverrides, amountInWei);
          tx = await router.swapExactETHForTokens(amountOutMin, path, address, deadline, { value: amountInWei, ...swapGasOverrides, gasLimit: swapGasLimit });
        } else if (isNativeOut) {
          await router.callStatic.swapExactTokensForETH(amountInWei, amountOutMin, path, address, deadline).catch((err: any) => { throw new Error(`Simulasi swap gagal, tx DIBATALKAN sebelum kirim (gas aman): ${err?.reason || err?.message || 'akan revert'}`); });
          const swapGasLimit = await safeEstimateGasLimit('SwapSkill', () => router.estimateGas.swapExactTokensForETH(amountInWei, amountOutMin, path, address, deadline));
          previewFee('SwapSkill', swapGasLimit, swapGasOverrides);
          await ensureSufficientBalance('SwapSkill', swapGasLimit, swapGasOverrides, 0);
          tx = await router.swapExactTokensForETH(amountInWei, amountOutMin, path, address, deadline, { ...swapGasOverrides, gasLimit: swapGasLimit });
        } else {
          await router.callStatic.swapExactTokensForTokens(amountInWei, amountOutMin, path, address, deadline).catch((err: any) => { throw new Error(`Simulasi swap gagal, tx DIBATALKAN sebelum kirim (gas aman): ${err?.reason || err?.message || 'akan revert'}`); });
          const swapGasLimit = await safeEstimateGasLimit('SwapSkill', () => router.estimateGas.swapExactTokensForTokens(amountInWei, amountOutMin, path, address, deadline));
          previewFee('SwapSkill', swapGasLimit, swapGasOverrides);
          await ensureSufficientBalance('SwapSkill', swapGasLimit, swapGasOverrides, 0);
          tx = await router.swapExactTokensForTokens(amountInWei, amountOutMin, path, address, deadline, { ...swapGasOverrides, gasLimit: swapGasLimit });
        }
        txHash = tx.hash;
        const receipt = await tx.wait();
        const feeInfo = receipt ? `\n- Fee: **${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice || 0))} ETH** (mode: ${evmConfig.gasMode || 'standard'})` : '';
        resultMsg = `⛓️ **SwapSkill** ✅ TRANSACTION CONFIRMED\n\n- Router: \`${routerAddress}\`\n- Path: \`${path.join(' → ')}\`\n- Amount In: **${input.amountIn || input.amount} ${tokenInSymbol}**\n- Slippage: **${(slippageBps / 100).toFixed(2)}%** (min out: \`${amountOutMin.toString()}\`)\n${approveTxHash ? `- Approve Tx: [${approveTxHash.slice(0, 18)}...](${explorer}/tx/${approveTxHash})\n` : ''}- Block: **${receipt?.blockNumber ?? '-'}**${feeInfo}\n- Tx: [${tx.hash.slice(0, 18)}...](${explorer}/tx/${tx.hash})${input.customAbi ? '\n- Mode: 🔧 Custom ABI' : ''}`;
      } else if (skill === 'PriceOracleSkill') {
        const coinId = input.coingeckoId || 'ethereum';
        const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,idr&include_24hr_change=true`);
        if (!resp.ok) throw new Error(`CoinGecko error (${resp.status})`);
        const data = await resp.json();
        const coinData = data?.[coinId];
        if (!coinData) throw new Error(`Token ${coinId} tidak ditemukan.`);
        resultMsg = `⛓️ **PriceOracleSkill** ✅\n\n- USD: **$${Number(coinData.usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}**\n- IDR: **Rp ${Number(coinData.idr || 0).toLocaleString('id-ID')}**`;
      } else {
        throw new Error(`Skill ${skill} belum memiliki executor on-chain.`);
      }
      setEVMLogs(prev => prev.map(l => l.id === taskId ? { ...l, status: 'success', result: resultMsg, txHash, timestamp: Date.now() } : l));
      recordWorkflowOutcome(skill, Object.keys(rawInput).sort(), true);
      setMessages(prev => [...prev, { role: 'assistant', content: resultMsg, timestamp: Date.now() }]);
      return resultMsg;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setEVMLogs(prev => prev.map(l => l.id === taskId ? { ...l, status: 'error', result: errMsg, timestamp: Date.now() } : l));
      recordWorkflowOutcome(skill, Object.keys(rawInput).sort(), false);
      setEVMMsg(`❌ ${skill}: ${errMsg}`);
      setTimeout(() => setEVMMsg(''), 6000);
      setMessages(prev => [...prev, { role: 'assistant', content: `⛓️ **${skill}** ❌ GAGAL\n\n${errMsg}`, timestamp: Date.now() }]);
      return undefined;
    } finally {
      setEVMRunning(false);
    }
  }, [evmConfig, recordWorkflowOutcome]);
  const executeChainTask = useCallback(async (chain: ChainKey, skill: string, rawInput: Record<string, string>): Promise<string | undefined> => {
    const chainCfg = multiChainConfig[chain];
    const meta = CHAIN_META[chain];
    if (!chainCfg?.privateKey) {
      const errMsg = `❌ Wallet ${meta.label} belum dikonfigurasi. Isi Private Key di panel 🌐 Multi-Chain Agent.`;
      setChainMsg(errMsg);
      setTimeout(() => setChainMsg(''), 4000);
      setMessages(prev => [...prev, { role: 'assistant', content: `🌐 **${skill} (${meta.label})** ❌ GAGAL\n\n${errMsg}`, timestamp: Date.now() }]);
      return undefined;
    }
    setChainRunning(true);
    const taskId = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setChainLogs(prev => [...prev, { id: taskId, chain, skill, status: 'running', input: rawInput, timestamp: Date.now() }]);
    try {
      const result = await executeMultiChainSkill(chain, skill, rawInput, multiChainConfig);
      setChainLogs(prev => prev.map(l => l.id === taskId ? { ...l, status: 'success', result: result.resultMsg, txHash: result.txHash, timestamp: Date.now() } : l));
      recordWorkflowOutcome(`${chain}:${skill}`, Object.keys(rawInput).sort(), true);
      setMessages(prev => [...prev, { role: 'assistant', content: result.resultMsg, timestamp: Date.now() }]);
      return result.resultMsg;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setChainLogs(prev => prev.map(l => l.id === taskId ? { ...l, status: 'error', result: errMsg, timestamp: Date.now() } : l));
      recordWorkflowOutcome(`${chain}:${skill}`, Object.keys(rawInput).sort(), false);
      setChainMsg(`❌ ${skill}: ${errMsg}`);
      setTimeout(() => setChainMsg(''), 6000);
      setMessages(prev => [...prev, { role: 'assistant', content: `🌐 **${skill} (${meta.label})** ❌ GAGAL\n\n${errMsg}`, timestamp: Date.now() }]);
      return undefined;
    } finally {
      setChainRunning(false);
    }
  }, [multiChainConfig, recordWorkflowOutcome]);
  // "Autopilot aksi kecil/rutin" (v2.4): PaymentSkill lintas-chain yang jumlahnya
  // di bawah threshold per-chain langsung dieksekusi tanpa klik kalau toggle
  // autopilot ON. BalanceSkill (read-only, tanpa risiko dana) selalu auto-run.
  // Nominal di atas threshold / autopilot OFF tetap wajib diklik manual oleh
  // user, sama seperti alur EVM Agent selama ini.
  const partitionAndRunAutoChainActions = useCallback((allActions: TaskAction[]): TaskAction[] => {
    const remaining: TaskAction[] = [];
    for (const a of allActions) {
      if (a.type === '__CHAIN__') {
        const payload = a.payload as { chain: ChainKey; skill: string } & Record<string, string>;
        const isBalance = payload.skill === 'BalanceSkill';
        const amount = parseFloat(payload.amount || '0');
        const isSmallPayment = payload.skill === 'PaymentSkill' && shouldAutoExecutePayment(payload.chain, amount, multiChainConfig);
        if (isBalance || isSmallPayment) {
          const { chain, skill, ...inputRest } = payload;
          void executeChainTask(chain, skill, inputRest);
          continue;
        }
      }
      remaining.push(a);
    }
    return remaining;
  }, [multiChainConfig, executeChainTask]);
  useEffect(() => {
    if (!autonomousAgent || agentBusy || agentQueue.length === 0) return;
    let cancelled = false;
    const runNext = async () => {
      const action = agentQueue[0];
      if (!action || cancelled) return;
      setAgentBusy(true);
      try {
        if (action.type === '__EVM__') {
          const payload = action.payload as { skill: string } & Record<string, string>;
          const { skill, ...inputRest } = payload;
          await executeEVMTask(skill, inputRest);
        } else if (action.type === '__CHAIN__') {
          const payload = action.payload as { chain: ChainKey; skill: string } & Record<string, string>;
          const { chain, skill, ...inputRest } = payload;
          await executeChainTask(chain, skill, inputRest);
        } else {
          const result = applyTaskAction(action);
          setActionFeedback(prev => ({ ...prev, [`agent-${Date.now()}`]: `🤖 ${result.message}` }));
          recordWorkflowOutcome(action.type, Object.keys(action.payload || {}).sort(), result.success);
        }
      } finally {
        if (!cancelled) {
          setAgentQueue(prev => prev.slice(1));
          setAgentBusy(false);
        }
      }
    };
    runNext();
    return () => { cancelled = true; };
  }, [autonomousAgent, agentBusy, agentQueue, executeEVMTask, executeChainTask, recordWorkflowOutcome]);
  const saveEVMConfigHandler = useCallback(() => {
    const merged = commitEvmConfigSave(evmConfig, evmFormData);
    setEVMConfig(merged);
    saveEVMConfig(merged);
    setEVMConfigEdit(false);
    setEVMMsg('✅ Config EVM tersimpan!');
    setTimeout(() => setEVMMsg(''), 2500);
  }, [evmConfig, evmFormData]);
  const saveMultiChainConfigHandler = useCallback(() => {
    const merged: MultiChainAgentConfig = {
      ...multiChainConfig,
      ...multiChainFormData,
      thresholds: { ...multiChainConfig.thresholds, ...multiChainFormData.thresholds },
    };
    setMultiChainConfig(merged);
    saveMultiChainConfig(merged);
    setMultiChainConfigEdit(false);
    setChainMsg('✅ Config Multi-Chain Agent tersimpan!');
    setTimeout(() => setChainMsg(''), 2500);
  }, [multiChainConfig, multiChainFormData]);
  const runCustomAbiCall = useCallback(() => {
    const { contractAddress, abi, functionName, args, value, mode } = customAbiForm;
    if (!contractAddress.trim()) {
      setEVMMsg('❌ Isi Contract Address dulu.');
      setTimeout(() => setEVMMsg(''), 4000);
      return;
    }
    if (!abi.trim()) {
      setEVMMsg('❌ Isi ABI dulu (JSON array atau human-readable signature).');
      setTimeout(() => setEVMMsg(''), 4000);
      return;
    }
    if (!functionName.trim()) {
      setEVMMsg('❌ Isi nama function yang mau dipanggil.');
      setTimeout(() => setEVMMsg(''), 4000);
      return;
    }
    executeEVMTask(mode === 'read' ? 'ReadContractSkill' : 'ContractCallSkill', {
      contractAddress: contractAddress.trim(),
      customAbi: abi.trim(),
      functionName: functionName.trim(),
      args: args.trim(),
      ...(mode === 'write' && value.trim() ? { value: value.trim() } : {}),
    });
  }, [customAbiForm, executeEVMTask]);
  const learnFromOpenCodeHistory = useCallback(async (historyMessages: Message[], force = false) => {
    if (rektLearningBusyRef.current) return;
    const userTurns = historyMessages.filter(m => m.role === 'user').length;
    if (!force && (userTurns < REKT_OPENCODE_REVIEW_INTERVAL || userTurns - rektOpencodeLearning.reviewedTurns < REKT_OPENCODE_REVIEW_INTERVAL)) return;
    rektLearningBusyRef.current = true;
    setAdaptiveLearningBusy(true);
    try {
      const transcript = buildLearningTranscript(historyMessages);
      const learningSystem = `Kamu adalah modul LEARNING milik Rekt. Tugasmu bukan menjawab user, tetapi menganalisis histori percakapan OpenCode/Rekt yang diberikan lalu mengekstrak pola yang berguna untuk percakapan berikutnya.
Fokus terutama pada: pencarian airdrop, whitelist/WL, testnet, project discovery, cara user meminta riset, preferensi output, pola task, project/entity yang pernah muncul, pendekatan yang berhasil, dan pendekatan yang gagal/tidak disukai.

JANGAN mengarang fakta baru. Ambil hanya pola yang benar-benar terlihat dari transcript. Jangan simpan private key, seed phrase, credential, atau secret.

Balas HANYA JSON valid dengan schema:
{
  "lessons": string[],
  "userPreferences": string[],
  "researchPatterns": string[],
  "airdropPatterns": string[],
  "wlPatterns": string[],
  "successfulApproaches": string[],
  "avoidApproaches": string[],
  "discoveredEntities": string[]
}`;
      const learningPrompt = `=== HISTORI CHAT OPENCODE/REKT ===\n${transcript}\n\n=== MEMORI LAMA ===\n${compactRektLearning(rektOpencodeLearning)}\n\nGabungkan hanya pembelajaran yang didukung histori.`;
      const raw = await callOpencodeLearningAI(opencodeCfg, learningSystem, learningPrompt);
      const learned = parseLearningJson(raw);
      if (!learned) return;
      setRektOpencodeLearning(prev => {
        const merged: RektOpencodeLearning = {
          version: 1,
          updatedAt: Date.now(),
          reviewedTurns: userTurns,
          totalTurns: userTurns,
          lessons: mergeUniqueStrings(prev.lessons, learned.lessons, 80),
          userPreferences: mergeUniqueStrings(prev.userPreferences, learned.userPreferences, 60),
          researchPatterns: mergeUniqueStrings(prev.researchPatterns, learned.researchPatterns, 60),
          airdropPatterns: mergeUniqueStrings(prev.airdropPatterns, learned.airdropPatterns, 60),
          wlPatterns: mergeUniqueStrings(prev.wlPatterns, learned.wlPatterns, 60),
          successfulApproaches: mergeUniqueStrings(prev.successfulApproaches, learned.successfulApproaches, 60),
          avoidApproaches: mergeUniqueStrings(prev.avoidApproaches, learned.avoidApproaches, 60),
          discoveredEntities: mergeUniqueStrings(prev.discoveredEntities, learned.discoveredEntities, 120),
        };
        saveRektOpencodeLearning(merged);
        return merged;
      });
    } catch (err) {
      console.debug('Rekt adaptive learning skipped:', err);
    } finally {
      rektLearningBusyRef.current = false;
      setAdaptiveLearningBusy(false);
    }
  }, [opencodeCfg, rektOpencodeLearning]);
  const sendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;
    lastUserMsgRef.current = Date.now();
    isNearBottomRef.current = true;
    const userMsg: Message = { role: 'user', content: userInput, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setStreamingText('');
    const thinkTime = 180 + Math.random() * 320;
    await new Promise(r => setTimeout(r, thinkTime));
    let reply: string;
    try {
      let systemPrompt = buildOpencodeSystemPrompt(otakMemories, importedContexts, learnedWorkflows, rektOpencodeLearning) +
        `
=== REKT > OPENCODE ARCHITECTURE ===
Rekt adalah adaptive agent/orchestrator. OpenCode AI adalah reasoning engine di bawah Rekt. Gunakan REKT ADAPTIVE MEMORY sebagai pembelajaran dari histori OpenCode sebelumnya. Jika user meminta mencari airdrop/WL/testnet/project, adaptasikan strategi pencarian berdasarkan pola historis yang tersimpan, lalu verifikasi hasilnya dari informasi terkini yang tersedia di sesi ini. Jangan menganggap memory lama sebagai fakta terkini.`;
      if (shouldGatherSocialContext(userInput) && (xApiCfg.bearerToken || tgClientCfg.sessionString)) {
        setSocialResearchBusy(true);
        try { systemPrompt += await gatherSocialResearchContext(xApiCfg, tgClientCfg, extractResearchQuery(userInput)); }
        catch (socialErr) { console.debug('Social research skipped:', socialErr); }
        finally { setSocialResearchBusy(false); }
      }
      reply = await callOpencodeAI(opencodeCfg, systemPrompt, userInput);
      setOpencodeStatus('online');
    } catch (err) {
      console.error('OpenCode AI gagal:', err);
      setOpencodeStatus('offline');
      const message = err instanceof Error ? err.message : String(err);
      reply = buildOfflineFallbackReply(userInput, message, otakMemories, learnedWorkflows, rektOpencodeLearning);
    }
    let cleanReply = reply;
    const memActionMatch = reply.match(/```json\s*(\[.*?"type":\s*"__MEMORY__".*?\])\s*```/s);
    if (memActionMatch) {
      try {
        const memAction = JSON.parse(memActionMatch[1])[0];
        if (memAction?.payload?.content) {
          const newMem: OtakRektMemory = {
            id: `mem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
            category: memAction.payload.category || 'catatan',
            content: memAction.payload.content,
            createdAt: Date.now(), updatedAt: Date.now(), tags: ['manual'], hitCount: 0,
          };
          setOtakMemories(prev => { const u = [...prev, newMem]; saveMemories(u); return u; });
          setOtakMsg(`🧠 Tersimpan: "${newMem.content.slice(0, 40)}..."`);
          setTimeout(() => setOtakMsg(''), 3000);
        }
      } catch {}
      cleanReply = reply.replace(memActionMatch[0], '').trim();
    }
    await streamTextInto(cleanReply, setStreamingText);
    setStreamingText('');
    const { cleanText, actions } = parseActions(cleanReply);
    const nonAutoActions = partitionAndRunAutoChainActions(actions);
    const evmActions = nonAutoActions.filter(a => a.type === '__EVM__');
    const chainActions = nonAutoActions.filter(a => a.type === '__CHAIN__');
    const regularActions = nonAutoActions.filter(a => a.type !== '__EVM__' && a.type !== '__CHAIN__');
    const specialActions = [
      ...evmActions.map(pa => ({ ...pa, type: 'ADD' as const, label: '⛓️ ' + pa.label })),
      ...chainActions.map(pa => ({ ...pa, type: 'ADD' as const, label: '🌐 ' + pa.label })),
    ];
    if (specialActions.length > 0 && regularActions.length === 0) {
      const assistantMsg: Message = {
        role: 'assistant',
        content: cleanText,
        timestamp: Date.now(),
        actions: specialActions,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } else {
      const assistantMsg: Message = {
        role: 'assistant',
        content: cleanText,
        timestamp: Date.now(),
        actions: regularActions.length > 0 ? regularActions : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    }
    autoLearn(userInput, cleanText);
    void learnFromOpenCodeHistory([...newMessages, { role: 'assistant', content: cleanText, timestamp: Date.now() } as Message]);
    if (autonomousAgent && nonAutoActions.length > 0) {
      setAgentQueue(prev => [...prev, ...nonAutoActions].slice(0, 50));
    }
    setIsLoading(false);
  }, [messages, otakMemories, importedContexts, isLoading, autoLearn, learnFromOpenCodeHistory, rektOpencodeLearning, opencodeCfg, opencodeStatus, learnedWorkflows, xApiCfg, tgClientCfg, partitionAndRunAutoChainActions]);
  const regenerateLastResponse = useCallback(async () => {
    if (isLoading) return;
    const lastIdx = messages.length - 1;
    if (lastIdx < 0 || messages[lastIdx].role !== 'assistant') return;
    let lastUserInput = '';
    for (let i = lastIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserInput = messages[i].content; break; }
    }
    if (!lastUserInput) return;
    const historyBefore = messages.slice(0, lastIdx);
    setMessages(historyBefore);
    setIsLoading(true);
    setStreamingText('');
    let reply: string;
    try {
      let systemPrompt = buildOpencodeSystemPrompt(otakMemories, importedContexts, learnedWorkflows, rektOpencodeLearning) +
        `\n\n=== REKT > OPENCODE ARCHITECTURE ===\nRekt adalah adaptive agent/orchestrator. OpenCode AI adalah reasoning engine di bawah Rekt. Ini adalah PERMINTAAN REGENERATE — user tidak puas dengan balasan sebelumnya untuk pertanyaan yang sama, coba beri sudut pandang/pendekatan berbeda dari sebelumnya kalau relevan.`;
      if (shouldGatherSocialContext(lastUserInput) && (xApiCfg.bearerToken || tgClientCfg.sessionString)) {
        setSocialResearchBusy(true);
        try { systemPrompt += await gatherSocialResearchContext(xApiCfg, tgClientCfg, extractResearchQuery(lastUserInput)); }
        catch (socialErr) { console.debug('Social research skipped:', socialErr); }
        finally { setSocialResearchBusy(false); }
      }
      reply = await callOpencodeAI(opencodeCfg, systemPrompt, lastUserInput);
      setOpencodeStatus('online');
    } catch (err) {
      console.error('OpenCode AI gagal (regenerate):', err);
      setOpencodeStatus('offline');
      const message = err instanceof Error ? err.message : String(err);
      reply = buildOfflineFallbackReply(lastUserInput, message, otakMemories, learnedWorkflows, rektOpencodeLearning);
    }
    await streamTextInto(reply, setStreamingText);
    setStreamingText('');
    const { cleanText, actions } = parseActions(reply);
    const nonAutoActions = partitionAndRunAutoChainActions(actions);
    const evmActions = nonAutoActions.filter(a => a.type === '__EVM__');
    const chainActions = nonAutoActions.filter(a => a.type === '__CHAIN__');
    const regularActions = nonAutoActions.filter(a => a.type !== '__EVM__' && a.type !== '__CHAIN__');
    const specialActions = [
      ...evmActions.map(pa => ({ ...pa, type: 'ADD' as const, label: '⛓️ ' + pa.label })),
      ...chainActions.map(pa => ({ ...pa, type: 'ADD' as const, label: '🌐 ' + pa.label })),
    ];
    const assistantMsg: Message = {
      role: 'assistant',
      content: cleanText,
      timestamp: Date.now(),
      actions: specialActions.length > 0 && regularActions.length === 0
        ? specialActions
        : (regularActions.length > 0 ? regularActions : undefined),
    };
    setMessages(prev => [...prev, assistantMsg]);
    autoLearn(lastUserInput, cleanText);
    void learnFromOpenCodeHistory([...historyBefore, { role: 'user', content: lastUserInput, timestamp: Date.now() } as Message, assistantMsg]);
    setIsLoading(false);
  }, [messages, isLoading, otakMemories, importedContexts, learnedWorkflows, rektOpencodeLearning, opencodeCfg, autoLearn, learnFromOpenCodeHistory, xApiCfg, tgClientCfg, partitionAndRunAutoChainActions]);
  const applyAction = (msgIndex: number, actionIndex: number, action: TaskAction) => {
    if (action.type === '__LEARN_WORKFLOW__') {
      const wfPayload = (action.payload || {}) as { name?: string; description?: string; steps?: { skill: string; paramShape?: string[] }[]; trigger?: string };
      const steps: WorkflowStep[] = Array.isArray(wfPayload.steps)
        ? wfPayload.steps.map(s => ({ skill: String(s.skill || ''), paramShape: Array.isArray(s.paramShape) ? s.paramShape.map(String) : [] })).filter(s => s.skill)
        : [];
      const wfKey = steps.map(stepSignature).join('|');
      const alreadyLearned = steps.length > 0 && learnedWorkflows.some(w => w.steps.map(stepSignature).join('|') === wfKey);
      let wfFeedback: string;
      if (steps.length === 0) {
        wfFeedback = '❌ Workflow tidak valid (steps kosong).';
      } else if (alreadyLearned) {
        wfFeedback = 'ℹ️ Workflow serupa sudah tersimpan.';
      } else {
        const now = Date.now();
        const newWf: LearnedWorkflow = {
          id: `wf_${now}_${Math.random().toString(36).slice(2, 7)}`,
          name: wfPayload.name || namePatternWorkflow(steps),
          description: wfPayload.description || describePatternWorkflow(steps, 0),
          steps, trigger: wfPayload.trigger, source: 'ai', enabled: true,
          usageCount: 0, successCount: 0, failCount: 0, createdAt: now, updatedAt: now,
        };
        setLearnedWorkflows(prev => { const u = [...prev, newWf]; saveLearnedWorkflows(u); return u; });
        wfFeedback = `🧬 Workflow "${newWf.name}" tersimpan — Rekt akan mengenali pola ini ke depannya.`;
      }
      const wfFbKey = `${msgIndex}-${actionIndex}`;
      setActionFeedback(prev => ({ ...prev, [wfFbKey]: wfFeedback }));
      setMessages(prev => prev.map((msg, mIdx) => {
        if (mIdx !== msgIndex || !msg.actions) return msg;
        return { ...msg, actions: msg.actions.map((a, aIdx) => aIdx === actionIndex ? { ...a, applied: true } : a) };
      }));
      return;
    }
    if (action.label.startsWith('⛓️ ')) {
      const evmPayload = action.payload as { skill: string } & Record<string, string>;
      const { skill, ...inputRest } = evmPayload;
      executeEVMTask(skill, inputRest as Record<string, string>);
      const key = `${msgIndex}-${actionIndex}`;
      setActionFeedback(prev => ({ ...prev, [key]: '⛓️ Menjalankan EVM task...' }));
      setMessages(prev => prev.map((msg, mIdx) => {
        if (mIdx !== msgIndex || !msg.actions) return msg;
        return { ...msg, actions: msg.actions.map((a, aIdx) => aIdx === actionIndex ? { ...a, applied: true } : a) };
      }));
      return;
    }
    if (action.label.startsWith('🌐 ')) {
      const chainPayload = action.payload as { chain: ChainKey; skill: string } & Record<string, string>;
      const { chain, skill, ...inputRest } = chainPayload;
      executeChainTask(chain, skill, inputRest as Record<string, string>);
      const key = `${msgIndex}-${actionIndex}`;
      setActionFeedback(prev => ({ ...prev, [key]: '🌐 Menjalankan Multi-Chain task...' }));
      setMessages(prev => prev.map((msg, mIdx) => {
        if (mIdx !== msgIndex || !msg.actions) return msg;
        return { ...msg, actions: msg.actions.map((a, aIdx) => aIdx === actionIndex ? { ...a, applied: true } : a) };
      }));
      return;
    }
    const result = applyTaskAction(action);
    const key = `${msgIndex}-${actionIndex}`;
    setActionFeedback(prev => ({ ...prev, [key]: result.message }));
    recordWorkflowOutcome(action.type, Object.keys(action.payload || {}).sort(), result.success);
    setMessages(prev => prev.map((msg, mIdx) => {
      if (mIdx !== msgIndex || !msg.actions) return msg;
      return { ...msg, actions: msg.actions.map((a, aIdx) => aIdx === actionIndex ? { ...a, applied: true } : a) };
    }));
    window.dispatchEvent(new Event('storage'));
  };
  const applyAllActions = (msgIndex: number, actions: TaskAction[]) => {
    actions.forEach((action, aIdx) => { if (!action.applied) setTimeout(() => applyAction(msgIndex, aIdx, action), aIdx * 100); });
  };
  const clearChat = () => { setMessages([getInitialMessage()]); localStorage.removeItem(STORAGE_KEY); };
  const handleToggleNotify = useCallback(async () => {
    if (!notifyOnDone) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { const perm = await Notification.requestPermission(); setNotifyPermission(perm); } catch {}
      }
      setNotifyOnDone(true);
    } else {
      setNotifyOnDone(false);
    }
  }, [notifyOnDone]);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };
  const handleFileImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImportError(''); setImportSuccess(''); setImportLoading(true);
    const results: ImportedContext[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { errors.push(`${file.name}: > 5MB`); continue; }
      try { const content = await extractTextFromFile(file); results.push({ name: file.name, content, type: 'file' }); }
      catch (e: any) { errors.push(`${file.name}: ${e.message}`); }
    }
    setImportLoading(false);
    if (results.length > 0) { setImportedContexts(prev => [...prev, ...results].slice(-5)); setImportSuccess(`✅ ${results.length} file berhasil diimport!`); setTimeout(() => setImportSuccess(''), 3000); }
    if (errors.length > 0) setImportError(errors.join('\n'));
  };
  const getPendingTasks = useCallback(() => {
    try {
      const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
      return tasks.filter(t => t.status === 'Ongoing' && !t.selesaiHariIni).sort((a, b) => {
        if (a.deadline && b.deadline) return parseDeadline(a.deadline).getTime() - parseDeadline(b.deadline).getTime();
        if (a.deadline) return -1; if (b.deadline) return 1; return 0;
      });
    } catch { return []; }
  }, []);
  const stopAutopilot = useCallback(() => {
    autopilotStopRef.current = true;
  }, []);
  const runAutopilotGarapan = useCallback(async () => {
    if (autopilotRunning) return;
    const pending = getPendingTasks();
    if (pending.length === 0) {
      setAutopilotLog(prev => [...prev, { taskName: '-', mode: autopilotSandbox ? 'sandbox' : 'live', status: 'skipped', summary: 'Tidak ada garapan Ongoing yang perlu dikerjakan hari ini.', timestamp: Date.now() } as AutopilotLogEntry].slice(-100));
      return;
    }
    autopilotStopRef.current = false;
    setAutopilotRunning(true);
    setAutopilotProgress({ current: 0, total: pending.length, taskName: pending[0].nama });
    for (let i = 0; i < pending.length; i++) {
      if (autopilotStopRef.current) break;
      const task = pending[i];
      setAutopilotProgress({ current: i + 1, total: pending.length, taskName: task.nama });
      const matched = findMatchingWorkflow(task, learnedWorkflows);
      const workflowContext = matched
        ? `
=== LEARNED WORKFLOW CONTEXT ===
Workflow kandidat: ${matched.name}
Urutan skill historis: ${matched.steps.map(s => s.skill).join(' → ')}
Gunakan hanya sebagai referensi. OpenCode tetap wajib memvalidasi dan memilih action.`
        : '';
      const taskPrompt = `Kerjakan garapan airdrop/testnet berikut secara MANDIRI (mode Autopilot):\nNama: ${task.nama}\nTugas: ${task.tugas}\nKategori: ${task.kategori}\nLink: ${task.link || '-'}\nNotes: ${task.notes || '-'}\nDeadline: ${task.deadline || '-'}`;
      try {
        let replyText = '';
        let actions: TaskAction[] = [];
        const autopilotSystemPrompt = buildOpencodeSystemPrompt(otakMemories, importedContexts, learnedWorkflows, rektOpencodeLearning) +
          `
=== AUTOPILOT GARAPAN AKTIF (${autopilotSandbox ? 'MODE SANDBOX' : 'MODE LIVE'}) ===
` +
          workflowContext +
          `
OpenCode AI adalah satu-satunya sumber reasoning. Jangan gunakan local brain. ` +
          (autopilotSandbox
            ? `Mode SANDBOX: jangan keluarkan blok aksi JSON; jelaskan rencana.`
            : `Mode LIVE: keluarkan aksi yang memang bisa dieksekusi dengan skill yang tersedia. Bila benar-benar selesai, boleh TOGGLE_DONE; bila ragu jangan tandai selesai.`);
        try {
          const raw = await callOpencodeAI(opencodeCfg, autopilotSystemPrompt, taskPrompt);
          setOpencodeStatus('online');
          const parsed = parseActions(raw);
          replyText = parsed.cleanText;
          actions = autopilotSandbox ? [] : parsed.actions;
        } catch (aiErr) {
          console.error('Autopilot: OpenCode AI gagal:', aiErr);
          setOpencodeStatus('offline');
          replyText = `❌ OpenCode AI tidak tersedia. Autopilot tidak menjalankan local brain maupun learned workflow secara langsung.`;
          actions = [];
        }
        const tag = autopilotSandbox ? `🧪 **[SANDBOX] ${task.nama}**` : `🤖 **[AUTOPILOT] ${task.nama}**`;
        setMessages(prev => [...prev, { role: 'assistant', content: `${tag}\n\n${replyText}`, timestamp: Date.now(), actions: (!autopilotSandbox && actions.length > 0) ? actions : undefined }]);
        if (!autopilotSandbox && actions.length > 0) {
          setAgentQueue(prev => [...prev, ...actions].slice(0, 50));
        }
        setAutopilotLog(prev => [...prev, { taskName: task.nama, mode: autopilotSandbox ? 'sandbox' : 'live', status: 'success', summary: replyText.slice(0, 160), timestamp: Date.now() } as AutopilotLogEntry].slice(-100));
      } catch (err: unknown) {
        const em = err instanceof Error ? err.message : String(err);
        setAutopilotLog(prev => [...prev, { taskName: task.nama, mode: autopilotSandbox ? 'sandbox' : 'live', status: 'error', summary: em, timestamp: Date.now() } as AutopilotLogEntry].slice(-100));
      }
      if (!autopilotStopRef.current && i < pending.length - 1) {
        await new Promise(res => setTimeout(res, 1500));
      }
    }
    setAutopilotRunning(false);
    setAutopilotProgress(null);
  }, [autopilotRunning, autopilotSandbox, getPendingTasks, opencodeStatus, opencodeCfg, otakMemories, importedContexts, learnedWorkflows, messages]);
  useEffect(() => { try { localStorage.setItem('rektAutopilotScheduleEnabled', String(autopilotScheduleEnabled)); } catch {} }, [autopilotScheduleEnabled]);
  useEffect(() => { try { localStorage.setItem('rektAutopilotScheduleTime', autopilotScheduleTime); } catch {} }, [autopilotScheduleTime]);
  useEffect(() => {
    if (!autopilotScheduleEnabled) return;
    const checkSchedule = () => {
      if (autopilotRunning || autopilotStopRef.current) return;
      const now = new Date();
      const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayStr = now.toLocaleDateString('id-ID');
      let lastRun = '';
      try { lastRun = localStorage.getItem('rektAutopilotLastRunDate') || ''; } catch {}
      if (nowHM >= autopilotScheduleTime && lastRun !== todayStr) {
        try { localStorage.setItem('rektAutopilotLastRunDate', todayStr); } catch {}
        runAutopilotGarapan();
      }
    };
    checkSchedule();
    const interval = setInterval(checkSchedule, 30000);
    return () => clearInterval(interval);
  }, [autopilotScheduleEnabled, autopilotScheduleTime, autopilotRunning, runAutopilotGarapan]);
  const pushAgentLog = useCallback((entry: Omit<AgentLogEntry, 'id'>) => {
    setAgentTeamLogs(prev => {
      const updated = [{ ...entry, id: `alog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, ...prev].slice(0, MAX_AGENT_LOGS);
      saveAgentLogs(updated);
      return updated;
    });
  }, []);
  const addAgent = useCallback(() => {
    setAgentTeam(prev => {
      if (prev.length >= MAX_AGENTS) return prev;
      const meta = AGENT_PROFESSION_META[newAgentProfession];
      const newAgent: AgentDef = {
        id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: newAgentName.trim() || `${meta.label} #${prev.filter(a => a.profession === newAgentProfession).length + 1}`,
        profession: newAgentProfession,
        active: true,
        intervalSec: meta.defaultInterval,
        createdAt: Date.now(),
        runCount: 0,
        successCount: 0,
        evmSkill: newAgentProfession === 'onchain_executor' ? 'BalanceSkill' : undefined,
      };
      const updated = [...prev, newAgent];
      saveAgents(updated);
      return updated;
    });
    setNewAgentName('');
    setShowAddAgentForm(false);
  }, [newAgentName, newAgentProfession]);
  const removeAgent = useCallback((id: string) => {
    setAgentTeam(prev => { const updated = prev.filter(a => a.id !== id); saveAgents(updated); return updated; });
  }, []);
  const toggleAgentActive = useCallback((id: string) => {
    setAgentTeam(prev => { const updated = prev.map(a => a.id === id ? { ...a, active: !a.active } : a); saveAgents(updated); return updated; });
  }, []);
  const updateAgentField = useCallback((id: string, patch: Partial<AgentDef>) => {
    setAgentTeam(prev => { const updated = prev.map(a => a.id === id ? { ...a, ...patch } : a); saveAgents(updated); return updated; });
  }, []);
  const runAgentOnce = useCallback(async (agent: AgentDef) => {
    const meta = AGENT_PROFESSION_META[agent.profession];
    try {
      if (agent.profession === 'scout_x' || agent.profession === 'scout_telegram') {
        const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
        const existingNames = new Set(tasks.map(t => t.nama.toLowerCase()));
        const scoutHistory = new Set(loadScoutHistory());
        const sourceLabel = agent.profession === 'scout_x' ? 'X (Twitter)' : 'grup Telegram';
        const processCandidate = (cand: { nama: string; tugas: string; kategori: string; link: string; deadline: string; estimasiPoin: number; minAkun: number }, isReal: boolean): boolean => {
          const key = cand.nama.toLowerCase();
          if (existingNames.has(key) || scoutHistory.has(key)) return false;
          addToScoutHistory(cand.nama);
          const kategoriTag = cand.kategori === 'Whitelist' ? '📝 WL' : cand.kategori === 'Testnet' ? '🧪 Testnet' : cand.kategori;
          const tagPrefix = isReal ? '' : '[Simulasi] ';
          pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Nemu kandidat ${tagPrefix}"${cand.nama}" (${kategoriTag}) dari ${sourceLabel} — lagi cek indikasi scam sebelum ditambahin...`, timestamp: Date.now() });
          if (looksSuspicious(cand)) {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `⚠️ ${tagPrefix}"${cand.nama}" keliatan mencurigakan (pola kata kunci scam) — DILEWATIN, gak ditambahin ke daftar.`, timestamp: Date.now() });
            return true;
          }
          const result = applyTaskAction({
            type: 'ADD', label: cand.nama,
            payload: {
              nama: cand.nama, tugas: cand.tugas, kategori: cand.kategori,
              status: 'Ongoing', link: cand.link, deadline: cand.deadline,
              estimasiReward: cand.estimasiPoin, akun: cand.minAkun,
              notes: `${tagPrefix}Ditemukan otomatis oleh agent "${agent.name}" dari ${sourceLabel} · kategori ${kategoriTag} · rekomendasi ${cand.minAkun} akun · estimasi poin ${cand.estimasiPoin}/100 (heuristik internal, bukan jaminan reward asli).`,
            },
          });
          window.dispatchEvent(new Event('storage'));
          pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `✅ ${tagPrefix}"${cand.nama}" (${kategoriTag}) ditambahkan ke daftar garapan · link ${cand.link} · deadline ${cand.deadline} · estimasi poin ${cand.estimasiPoin}/100 · rekomendasi ${cand.minAkun} akun.`, timestamp: Date.now() });
          if (result.success && isReal && agent.profession === 'scout_telegram') {
            const chatText = `📡 **Update baru dari grup/channel Telegram!**\nAda yang share garapan: **${cand.nama}** (${kategoriTag})${cand.link && cand.link !== '#' ? `\nLink: ${cand.link}` : ''}\nDeadline: ${cand.deadline}\nLangsung aku tambahin ke daftar garapan kamu (status Ongoing).`;
            setMessages(prev => [...prev, { role: 'assistant', content: chatText, timestamp: Date.now(), model: 'scout-telegram' } as Message]);
            const notifyChatId = (agent.tgNotifyChatId || '').trim();
            if (agent.tgBotToken && notifyChatId) {
              (async () => {
                try {
                  const tgText = `📡 [Rekt-Scout] Ada yang share garapan baru di grup/channel Telegram: "${cand.nama}" (${kategoriTag})${cand.link && cand.link !== '#' ? `\nLink: ${cand.link}` : ''}`;
                  const res = await fetch(`https://api.telegram.org/bot${agent.tgBotToken}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: notifyChatId, text: tgText }),
                  });
                  const data = await res.json();
                  if (!data.ok) {
                    pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Notifikasi "${cand.nama}" muncul di chat Rekt, tapi gagal dikirim ke Telegram (chat ${notifyChatId}): ${data.description || 'unknown error'}`, timestamp: Date.now() });
                  }
                } catch (tgErr: unknown) {
                  const tgEm = tgErr instanceof Error ? tgErr.message : String(tgErr);
                  pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Notifikasi "${cand.nama}" muncul di chat Rekt, tapi gagal dikirim ke Telegram (chat ${notifyChatId}): ${tgEm}`, timestamp: Date.now() });
                }
              })();
            }
          }
          return true;
        };
        const guessKategori = (lower: string): string =>
          /whitelist|\bwl\b/.test(lower) ? 'Whitelist' : /testnet/.test(lower) ? 'Testnet' : /mint|\bnft\b/.test(lower) ? 'NFT' : /retro/.test(lower) ? 'Retroactive' : 'Social';
        const AIRDROP_KEYWORDS_RE = /\b(airdrop|testnet|whitelist|\bwl\b|mint|quest|claim|retroactive|retro)\b/i;
        if (agent.profession === 'scout_telegram' && (agent.tgTargetChannels || '').trim()) {
          const targets = (agent.tgTargetChannels || '').split(',').map(s => s.trim()).filter(Boolean);
          if (!tgClientCfg.sessionString) {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Channel/grup target udah diisi, tapi akun Telegram pribadi belum login. Buka Settings → Social Research buat login dulu (gak perlu Bot Token/admin buat mode ini).`, timestamp: Date.now() });
          } else {
            try {
              const { hits, newLastIds, errors } = await pollTelegramChannelsForNew(tgClientCfg, targets, agent.tgTargetLastIds || {});
              setAgentTeam(prev => { const updated = prev.map(a => a.id === agent.id ? { ...a, tgTargetLastIds: newLastIds } : a); saveAgents(updated); return updated; });
              let handledCount = 0;
              for (const hit of hits) {
                if (handledCount >= MAX_SCOUT_CANDIDATES_PER_RUN) break;
                const lower = hit.text.toLowerCase();
                if (!AIRDROP_KEYWORDS_RE.test(lower)) continue;
                const linkMatch = hit.text.match(/https?:\/\/\S+/);
                const nama = hit.text.split('\n')[0].replace(/[#*_`]/g, '').trim().slice(0, 80) || `Airdrop dari ${hit.chatTitle}`;
                const wasProcessed = processCandidate({
                  nama, tugas: hit.text.slice(0, 200), kategori: guessKategori(lower),
                  link: hit.url || linkMatch?.[0] || '#', deadline: extractDeadlineFromText(hit.text),
                  estimasiPoin: estimatePointsFromEngagement(0, 0, 0), minAkun: 1,
                }, true);
                if (wasProcessed) handledCount++;
              }
              if (errors.length > 0) {
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Sebagian target gagal dipantau (akun pribadi): ${errors.join(' · ')}`, timestamp: Date.now() });
              }
              if (handledCount === 0 && hits.length === 0 && errors.length === 0) {
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Sudah cek ${targets.length} channel/grup target (akun pribadi), belum ada pesan baru sejak putaran terakhir.`, timestamp: Date.now() });
              } else if (handledCount === 0 && hits.length > 0) {
                const preview = hits.slice(0, 3).map(h => `"${h.text.slice(0, 70).replace(/\n/g, ' ')}${h.text.length > 70 ? '…' : ''}"`).join(' · ');
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Sudah baca ${hits.length} pesan baru dari channel/grup target (akun pribadi), tapi belum ada yang kelihatan kayak airdrop/WL/testnet baru. Isi pesannya: ${preview}`, timestamp: Date.now() });
              } else if (handledCount >= MAX_SCOUT_CANDIDATES_PER_RUN) {
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Sudah nyentuh batas ${MAX_SCOUT_CANDIDATES_PER_RUN} kandidat per putaran (akun pribadi) — sisanya (kalau ada) diproses di putaran berikutnya.`, timestamp: Date.now() });
              }
            } catch (e: any) {
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Gagal pantau channel/grup target lewat akun pribadi: ${e?.message || 'unknown error'}.`, timestamp: Date.now() });
            }
          }
        } else if (agent.profession === 'scout_telegram' && agent.tgBotToken) {
          try {
            const offset = agent.tgUpdateOffset || 0;
            const res = await fetch(`https://api.telegram.org/bot${agent.tgBotToken}/getUpdates?offset=${offset}&limit=50&timeout=0`);
            const data = await res.json();
            if (!data.ok) {
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Gagal ambil pesan Telegram: ${data.description || 'unknown error'}. Cek lagi Bot Token-nya.`, timestamp: Date.now() });
            } else {
              const updates: any[] = data.result || [];
              const allowedChatIds = (agent.tgChatId || '').split(',').map(s => s.trim()).filter(Boolean);
              let maxUpdateId = offset - 1;
              let handledCount = 0;
              const skippedTexts: string[] = [];
              for (const upd of updates) {
                maxUpdateId = Math.max(maxUpdateId, upd.update_id);
                if (handledCount >= MAX_SCOUT_CANDIDATES_PER_RUN) continue;
                const msg = upd.message || upd.channel_post;
                const text: string = msg?.text || msg?.caption || '';
                if (!text) continue;
                if (allowedChatIds.length > 0 && !allowedChatIds.includes(String(msg.chat?.id))) continue;
                const lower = text.toLowerCase();
                if (!AIRDROP_KEYWORDS_RE.test(lower)) { skippedTexts.push(text); continue; }
                const linkMatch = text.match(/https?:\/\/\S+/);
                const nama = text.split('\n')[0].replace(/[#*_`]/g, '').trim().slice(0, 80) || 'Airdrop dari Telegram';
                const wasProcessed = processCandidate({
                  nama, tugas: text.slice(0, 200), kategori: guessKategori(lower),
                  link: linkMatch?.[0] || '#', deadline: extractDeadlineFromText(text),
                  estimasiPoin: estimatePointsFromEngagement(0, 0, 0), minAkun: 1,
                }, true);
                if (wasProcessed) handledCount++;
              }
              if (maxUpdateId >= offset) {
                setAgentTeam(prev => { const updated = prev.map(a => a.id === agent.id ? { ...a, tgUpdateOffset: maxUpdateId + 1 } : a); saveAgents(updated); return updated; });
              }
              if (handledCount === 0 && skippedTexts.length > 0) {
                const preview = skippedTexts.slice(0, 3).map(t => `"${t.slice(0, 70).replace(/\n/g, ' ')}${t.length > 70 ? '…' : ''}"`).join(' · ');
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Sudah baca ${updates.length} pesan Telegram terbaru, tapi belum ada yang kelihatan kayak airdrop/WL/testnet baru. Isi pesannya: ${preview}`, timestamp: Date.now() });
              } else if (handledCount === 0) {
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Sudah baca ${updates.length} pesan Telegram terbaru, tapi belum ada yang kelihatan kayak airdrop/WL/testnet baru.`, timestamp: Date.now() });
              } else if (handledCount >= MAX_SCOUT_CANDIDATES_PER_RUN) {
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Sudah nyentuh batas ${MAX_SCOUT_CANDIDATES_PER_RUN} kandidat per putaran — sisanya (kalau ada) diproses di putaran berikutnya.`, timestamp: Date.now() });
              }
            }
          } catch (e: any) {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Gagal konek ke Telegram Bot API: ${e?.message || 'network error'}.`, timestamp: Date.now() });
          }
        } else if (agent.profession === 'scout_x' && agent.xBearerToken) {
          try {
            const query = encodeURIComponent(agent.xQuery || '(airdrop OR testnet OR whitelist) crypto -is:retweet');
            const sinceParam = agent.xSinceId ? `&since_id=${agent.xSinceId}` : '';
            const targetUrl = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=25&tweet.fields=created_at,public_metrics${sinceParam}`;
            const fetchUrl = agent.xProxyUrl ? `${agent.xProxyUrl}${encodeURIComponent(targetUrl)}` : targetUrl;
            const res = await fetch(fetchUrl, {
              headers: { Authorization: `Bearer ${agent.xBearerToken}` },
            });
            if (res.status === 429) {
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `X API kena rate limit (HTTP 429) — tier gratis X API v2 emang ketat, coba naikin interval agent ini biar gak sering kena limit.`, timestamp: Date.now() });
            } else if (!res.ok) {
              const errText = await res.text().catch(() => '');
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `X API nolak request (HTTP ${res.status})${agent.xProxyUrl ? ' lewat proxy' : ''}. ${errText.slice(0, 150)}`, timestamp: Date.now() });
            } else {
              const data = await res.json();
              const tweets: any[] = data.data || [];
              let handledCount = 0;
              let newestId = agent.xSinceId || '0';
              for (const tw of tweets) {
                if (tw.id && BigInt(tw.id) > BigInt(newestId || '0')) newestId = tw.id;
                if (handledCount >= MAX_SCOUT_CANDIDATES_PER_RUN) continue;
                const text: string = tw.text || '';
                const lower = text.toLowerCase();
                if (!AIRDROP_KEYWORDS_RE.test(lower)) continue;
                const linkMatch = text.match(/https?:\/\/\S+/);
                const nama = text.split('\n')[0].replace(/[#*_`]/g, '').trim().slice(0, 80) || 'Airdrop dari X';
                const pm = tw.public_metrics || {};
                const wasProcessed = processCandidate({
                  nama, tugas: text.slice(0, 200), kategori: guessKategori(lower),
                  link: linkMatch?.[0] || '#', deadline: extractDeadlineFromText(text),
                  estimasiPoin: estimatePointsFromEngagement(pm.like_count || 0, pm.retweet_count || 0, pm.reply_count || 0),
                  minAkun: 1,
                }, true);
                if (wasProcessed) handledCount++;
              }
              if (newestId !== (agent.xSinceId || '0')) {
                setAgentTeam(prev => { const updated = prev.map(a => a.id === agent.id ? { ...a, xSinceId: newestId } : a); saveAgents(updated); return updated; });
              }
              if (handledCount === 0) {
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Sudah cari di X (${tweets.length} tweet dicek), tapi belum ada yang kelihatan kayak airdrop/WL/testnet baru.`, timestamp: Date.now() });
              } else if (handledCount >= MAX_SCOUT_CANDIDATES_PER_RUN) {
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Sudah nyentuh batas ${MAX_SCOUT_CANDIDATES_PER_RUN} kandidat per putaran — sisanya (kalau ada) diproses di putaran berikutnya.`, timestamp: Date.now() });
              }
            }
          } catch (e: any) {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Gagal konek ke X API${agent.xProxyUrl ? ' lewat proxy yang diisi' : ' — kemungkinan diblokir CORS oleh browser (isi "Proxy CORS" kalau ini kejadian)'}. Detail: ${e?.message || 'network error'}`, timestamp: Date.now() });
          }
        } else {
          const candidates = MOCK_GARAPAN_POOL.filter(g => !existingNames.has(g.nama.toLowerCase()) && !scoutHistory.has(g.nama.toLowerCase()) && g.ditemukanHariLalu <= FRESHNESS_THRESHOLD_DAYS);
          const tokenHint = agent.profession === 'scout_x' ? 'isi "Bearer Token API X" di config agent ini' : 'isi "Telegram Bot Token" (butuh admin di grup/channel-nya) ATAU isi "Channel/Grup target (akun pribadi)" + login di Settings → Social Research (gak butuh admin) di config agent ini';
          if (candidates.length === 0) {
            const poolExhausted = MOCK_GARAPAN_POOL.every(g => existingNames.has(g.nama.toLowerCase()) || scoutHistory.has(g.nama.toLowerCase()));
            const msg = poolExhausted
              ? `[Simulasi] Semua project di pool referensi udah pernah ditemukan. ${tokenHint} biar mode REAL nyala.`
              : `[Simulasi] Sudah nyisir ${sourceLabel}, tapi belum ada airdrop/WL/testnet TERBARU (≤${FRESHNESS_THRESHOLD_DAYS} hari) di pool referensi yang belum ditawarin. (${tokenHint} biar mode REAL nyala)`;
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: msg, timestamp: Date.now() });
          } else {
            const sorted = [...candidates].sort((a, b) => b.estimasiPoin - a.estimasiPoin);
            const top = sorted.slice(0, Math.min(3, sorted.length));
            const found = top[Math.floor(Math.random() * top.length)];
            const deadlineDate = toISODateString(new Date(Date.now() + found.deadlineDays * 24 * 60 * 60 * 1000));
            processCandidate({ nama: found.nama, tugas: found.tugas, kategori: found.kategori, link: found.link, deadline: deadlineDate, estimasiPoin: found.estimasiPoin, minAkun: found.minAkun }, false);
          }
        }
      } else if (agent.profession === 'admin_telegram') {
        const pending = getPendingTasks();
        const text = `🤖 [Rekt-Admin] Reminder: ada ${pending.length} garapan Ongoing yang belum kelar hari ini.`;
        if (agent.tgBotToken && agent.tgChatId) {
          const res = await fetch(`https://api.telegram.org/bot${agent.tgBotToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: agent.tgChatId, text }),
          });
          const data = await res.json();
          if (data.ok) {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'success', message: `Pesan reminder terkirim ke Telegram (chat ${agent.tgChatId}).`, timestamp: Date.now() });
          } else {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `Gagal kirim ke Telegram: ${data.description || 'unknown error'}`, timestamp: Date.now() });
          }
        } else {
          pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `[Simulasi] Bot Token/Chat ID belum diisi — pesan yang AKAN dikirim: "${text}"`, timestamp: Date.now() });
        }
      } else if (agent.profession === 'onchain_executor') {
        const skill = agent.evmSkill || 'BalanceSkill';
        pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Menjalankan skill "${skill}" lewat EVM Agent...`, timestamp: Date.now() });
        await executeEVMTask(skill, {});
        pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'success', message: `Skill "${skill}" selesai dijalankan (lihat detail di panel ⛓️ EVM Agent).`, timestamp: Date.now() });
      } else if (agent.profession === 'researcher') {
        const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
        const scoutTasks = tasks.filter(t => t.status === 'Ongoing' && /ditemukan otomatis oleh agent/i.test(t.notes || ''));
        if (scoutTasks.length === 0) {
          pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Belum ada garapan hasil temuan Scout yang perlu diriset ulang saat ini.`, timestamp: Date.now() });
        } else {
          const target = scoutTasks[Math.floor(Math.random() * scoutTasks.length)];
          pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Lagi riset ulang "${target.nama}" — cek deadline, indikasi scam, & link resmi...`, timestamp: Date.now() });
          const reasons: string[] = [];
          if (target.deadline) {
            const parsedDeadline = parseDeadline(target.deadline);
            if (!isNaN(parsedDeadline.getTime()) && parsedDeadline.getTime() < Date.now()) {
              reasons.push('deadline sudah lewat');
            }
          }
          if (looksSuspicious({ nama: target.nama, tugas: target.tugas })) {
            reasons.push('kata kunci mencurigakan terdeteksi');
          }
          if (target.link && target.link !== '#') {
            try {
              await fetch(target.link, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(8000) });
            } catch {
              reasons.push('link resmi gak bisa diakses (kemungkinan sudah mati/diganti)');
            }
          }
          if (reasons.length > 0) {
            const result = applyTaskAction({ type: 'DELETE', label: target.nama, payload: { nama: target.nama } });
            window.dispatchEvent(new Event('storage'));
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `🗑️ "${target.nama}" dihapus otomatis dari daftar garapan — ${reasons.join(', ')}.`, timestamp: Date.now() });
          } else {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Cek dasar "${target.nama}" lolos (deadline/link/scam) — lagi verifikasi status terkini pakai riset OpenCode AI sebelum declare valid...`, timestamp: Date.now() });
            const verdict = await researchProjectValidity(opencodeCfg, { nama: target.nama, tugas: target.tugas, kategori: target.kategori || '', link: target.link || '', deadline: target.deadline || '' }, { xCfg: xApiCfg, tgCfg: tgClientCfg });
            if (verdict === null) {
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `⚠️ "${target.nama}" lolos cek dasar, tapi riset OpenCode AI buat verifikasi status project gagal dipanggil (server opencode offline/network error) — dibiarkan tetap di daftar buat sementara, disaranin cek manual dulu sebelum digarap serius.`, timestamp: Date.now() });
            } else if (verdict.valid === false && verdict.confidence !== 'low') {
              const result = applyTaskAction({ type: 'DELETE', label: target.nama, payload: { nama: target.nama } });
              window.dispatchEvent(new Event('storage'));
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `🗑️ "${target.nama}" dihapus otomatis — riset AI (${verdict.confidence} confidence): ${verdict.reason}`, timestamp: Date.now() });
            } else if (verdict.valid === true && verdict.confidence === 'high') {
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'success', message: `✅ "${target.nama}" masih valid & layak digarap — dikonfirmasi riset AI: ${verdict.reason}`, timestamp: Date.now() });
            } else {
              const flagPrefix = '⚠️ Perlu verifikasi manual';
              const alreadyFlagged = (target.notes || '').includes(flagPrefix);
              if (!alreadyFlagged) {
                const newNotes = `${flagPrefix} — ${verdict.reason} · ${target.notes || ''}`.trim();
                applyTaskAction({ type: 'UPDATE', label: target.nama, payload: { nama: target.nama, notes: newNotes } });
                window.dispatchEvent(new Event('storage'));
              }
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `⚠️ "${target.nama}" statusnya AMBIGU menurut riset AI (confidence: ${verdict.confidence}) — ${verdict.reason} Ditandai "Perlu verifikasi manual" & TETAP di daftar (gak dihapus otomatis), cek langsung ke user sebelum lanjut digarap.`, timestamp: Date.now() });
            }
          }
        }
      } else if (agent.profession === 'deadline_guard') {
        const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
        const withDaysLeft = tasks
          .filter(t => t.status === 'Ongoing' && t.deadline)
          .map(t => {
            const parsed = parseDeadline(t.deadline);
            const daysLeft = isNaN(parsed.getTime()) ? null : Math.ceil((parsed.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            return { task: t, daysLeft };
          })
          .filter(x => x.daysLeft !== null && x.daysLeft >= 0 && x.daysLeft <= URGENT_THRESHOLD_DAYS && !(x.task.notes || '').startsWith('⏰ URGENT'))
          .sort((a, b) => (a.daysLeft as number) - (b.daysLeft as number));
        if (withDaysLeft.length === 0) {
          pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Gak ada garapan Ongoing yang deadline-nya mepet (≤${URGENT_THRESHOLD_DAYS} hari) & belum ditandai saat ini.`, timestamp: Date.now() });
        } else {
          const { task: target, daysLeft } = withDaysLeft[0];
          const urgencyLabel = daysLeft === 0 ? 'HARI INI' : daysLeft === 1 ? 'besok' : `${daysLeft} hari lagi`;
          const newNotes = `⏰ URGENT (deadline ${urgencyLabel}) · ${target.notes || ''}`.trim();
          const result = applyTaskAction({ type: 'UPDATE', label: target.nama, payload: { nama: target.nama, notes: newNotes } });
          window.dispatchEvent(new Event('storage'));
          const alertText = `🚨 [Rekt-Deadline] "${target.nama}" deadline-nya ${urgencyLabel} — buruan digarap!`;
          if (agent.tgBotToken && agent.tgChatId) {
            const res = await fetch(`https://api.telegram.org/bot${agent.tgBotToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: agent.tgChatId, text: alertText }),
            });
            const data = await res.json();
            if (data.ok) {
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `⏰ "${target.nama}" ditandai URGENT (${urgencyLabel}) & alert terkirim ke Telegram (chat ${agent.tgChatId}).`, timestamp: Date.now() });
            } else {
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `⏰ "${target.nama}" ditandai URGENT, tapi gagal kirim alert Telegram: ${data.description || 'unknown error'}`, timestamp: Date.now() });
            }
          } else {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `⏰ [Simulasi] "${target.nama}" ditandai URGENT (${urgencyLabel}) — alert yang AKAN dikirim: "${alertText}" (isi Bot Token/Chat ID biar beneran terkirim).`, timestamp: Date.now() });
          }
        }
      } else if (agent.profession === 'reminder_wl') {
        const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
        const waitlistTasks = tasks.filter(t => t.status === 'Waitlist');
        if (waitlistTasks.length === 0) {
          pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Gak ada garapan berstatus Waitlist yang perlu dipantau saat ini.`, timestamp: Date.now() });
        } else {
          const target = waitlistTasks[Math.floor(Math.random() * waitlistTasks.length)];
          pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `Lagi cek apakah "${target.nama}" udah mulai/dibuka — riset OpenCode AI...`, timestamp: Date.now() });
          const verdict = await checkGarapanStarted(opencodeCfg, { nama: target.nama, tugas: target.tugas, kategori: target.kategori || '', link: target.link || '' }, { xCfg: xApiCfg, tgCfg: tgClientCfg });
          if (verdict === null) {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `⚠️ Riset OpenCode AI buat cek "${target.nama}" gagal dipanggil (server opencode offline/network error) — tetap di Waitlist, dicoba lagi putaran berikutnya.`, timestamp: Date.now() });
          } else if (verdict.started === true && verdict.confidence !== 'low') {
            const result = applyTaskAction({ type: 'UPDATE_STATUS', label: target.nama, payload: { nama: target.nama, status: 'Ongoing' } });
            window.dispatchEvent(new Event('storage'));
            const chatText = `🔔 **${target.nama}** kelihatannya udah MULAI/DIBUKA — status aku naikin ke **Ongoing**, buruan digarap sebelum keburu tutup/mepet deadline!\n_Riset OpenCode (${verdict.confidence} confidence): ${verdict.reason}_${target.link ? `\nLink: ${target.link}` : ''}`;
            setMessages(prev => [...prev, { role: 'assistant', content: chatText, timestamp: Date.now(), model: 'kang-reminder' } as Message]);
            if (agent.tgBotToken && agent.tgChatId) {
              try {
                const tgText = `🔔 [Rekt-Reminder] "${target.nama}" udah MULAI/DIBUKA — buruan digarap!${target.link ? `\nLink: ${target.link}` : ''}`;
                const res = await fetch(`https://api.telegram.org/bot${agent.tgBotToken}/sendMessage`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: agent.tgChatId, text: tgText }),
                });
                const data = await res.json();
                if (data.ok) {
                  pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `🔔 "${target.nama}" udah mulai — status dinaikin ke Ongoing, reminder muncul di chat Rekt & (opsional) juga terkirim ke Telegram (chat ${agent.tgChatId}).`, timestamp: Date.now() });
                } else {
                  pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `🔔 "${target.nama}" udah mulai — status dinaikin ke Ongoing & reminder muncul di chat Rekt. Telegram (opsional) gagal terkirim: ${data.description || 'unknown error'}.`, timestamp: Date.now() });
                }
              } catch (tgErr: unknown) {
                const tgEm = tgErr instanceof Error ? tgErr.message : String(tgErr);
                pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `🔔 "${target.nama}" udah mulai — status dinaikin ke Ongoing & reminder muncul di chat Rekt. Telegram (opsional) gagal terkirim: ${tgEm}.`, timestamp: Date.now() });
              }
            } else {
              pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: result.success ? 'success' : 'error', message: `🔔 "${target.nama}" udah mulai (riset OpenCode, ${verdict.confidence} confidence: ${verdict.reason}) — status dinaikin ke Ongoing & reminder muncul langsung di chat Rekt (Telegram gak diisi, dilewatin — opsional).`, timestamp: Date.now() });
            }
          } else {
            pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'info', message: `"${target.nama}" kelihatannya belum mulai (riset OpenCode, ${verdict.confidence} confidence: ${verdict.reason}) — tetap di Waitlist, dicek lagi putaran berikutnya.`, timestamp: Date.now() });
          }
        }
      }
    } catch (err: unknown) {
      const em = err instanceof Error ? err.message : String(err);
      pushAgentLog({ agentId: agent.id, agentName: agent.name, profession: agent.profession, status: 'error', message: `${meta.label} gagal jalan: ${em}`, timestamp: Date.now() });
      setAgentTeam(prev => { const updated = prev.map(a => a.id === agent.id ? { ...a, lastRunAt: Date.now(), runCount: a.runCount + 1 } : a); saveAgents(updated); return updated; });
    }
  }, [pushAgentLog, getPendingTasks, executeEVMTask, setMessages, opencodeCfg, xApiCfg, tgClientCfg]);
  const agentRunningRef = useRef<Set<string>>(new Set());
  const [runningAgentIds, setRunningAgentIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const agent of agentTeamRef.current) {
        if (!agent.active) continue;
        if (agentRunningRef.current.has(agent.id)) continue;
        const last = agent.lastRunAt || agent.createdAt;
        if (now - last >= agent.intervalSec * 1000) {
          agentRunningRef.current.add(agent.id);
          setRunningAgentIds(prev => new Set(prev).add(agent.id));
          runAgentOnce(agent).finally(() => {
            agentRunningRef.current.delete(agent.id);
            setRunningAgentIds(prev => { const next = new Set(prev); next.delete(agent.id); return next; });
          });
        }
      }
    };
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [runAgentOnce]);
  const msgCount = messages.filter(m => m.role === 'user').length;
  return (
    <div className="app-container pixel-bw-theme">
      {/* ── Header ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ margin: 0, border: 'none', paddingBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaRobot style={{ color: REKT_COLOR }} /> Rekt — AI
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#0d0d0d', padding: '4px 10px', border: `1px solid ${REKT_COLOR}22`, fontSize: '11px', color: '#555555' }}>
            💬 {msgCount} msg · 🧠 {otakMemories.length} ingatan
          </div>
          <div
            title={opencodeStatus === 'online' ? `Terhubung ke OpenCode AI (${opencodeCfg.baseUrl})` : opencodeStatus === 'offline' ? (isHopelessOpencodeTarget(opencodeCfg.baseUrl) ? 'localhost tidak bisa diakses dari HP — buka Settings buat pakai link tunnel' : 'OpenCode AI offline — local brain disabled') : 'Mengecek koneksi OpenCode AI...'}
            style={{
              background: '#0d0d0d', padding: '4px 10px',
              border: `1px solid ${opencodeStatus === 'online' ? ONLINE_STATUS_COLOR : opencodeStatus === 'offline' ? LOCAL_MODE_COLOR : '#555555'}55`,
              fontSize: '11px', color: opencodeStatus === 'online' ? ONLINE_STATUS_COLOR : opencodeStatus === 'offline' ? LOCAL_MODE_COLOR : '#888888',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: opencodeStatus === 'online' ? ONLINE_STATUS_COLOR : opencodeStatus === 'offline' ? LOCAL_MODE_COLOR : '#888888',
              boxShadow: opencodeStatus === 'online' ? `0 0 6px ${ONLINE_STATUS_COLOR}` : opencodeStatus === 'offline' ? `0 0 6px ${LOCAL_MODE_COLOR}` : 'none',
              display: 'inline-block', flexShrink: 0,
            }} />
            {opencodeStatus === 'online' ? 'OpenCode AI' : opencodeStatus === 'offline' ? 'OpenCode Offline' : 'Mengecek...'}
          </div>
          {(xApiCfg.bearerToken || tgClientCfg.sessionString) && (
            <div title={[xApiCfg.bearerToken ? 'X API tersambung' : null, tgClientCfg.sessionString ? `Telegram login sebagai ${tgClientCfg.meLabel || tgClientCfg.phoneNumber || 'akun tersambung'}` : null].filter(Boolean).join(' · ')}
              style={{ background: '#0d0d0d', padding: '4px 10px', border: `1px solid ${REKT_COLOR}55`, fontSize: '11px', color: socialResearchBusy ? REKT_COLOR : '#888888', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: REKT_COLOR, boxShadow: socialResearchBusy ? `0 0 6px ${REKT_COLOR}` : 'none', display: 'inline-block', flexShrink: 0 }} />
              {socialResearchBusy ? '🔎 Riset X/Telegram...' : `🔎 ${[xApiCfg.bearerToken ? 'X' : null, tgClientCfg.sessionString ? 'Telegram' : null].filter(Boolean).join(' + ')}`}
            </div>
          )}
          <button onClick={() => togglePanel('settings')}
            style={{ background: showSettings ? '#111111' : 'transparent', border: '1px solid #333333', color: '#888888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px' }}>
            ⚙️ Settings
          </button>
          <button onClick={() => togglePanel('otakRekt')}
            style={{ background: showOtakRekt ? '#181818' : 'transparent', border: `1px solid ${(adaptiveLearningBusy || evolutionAnalyzing) ? REKT_COLOR : showOtakRekt ? REKT_COLOR : '#333333'}`, color: showOtakRekt ? REKT_COLOR : '#888888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: (adaptiveLearningBusy || evolutionAnalyzing) ? `0 0 8px ${REKT_COLOR}66` : 'none' }}>
            {(adaptiveLearningBusy || evolutionAnalyzing) && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: REKT_COLOR, display: 'inline-block', animation: 'pulse-dot 0.9s ease-in-out infinite' }} />}
            <FaBrain size={12} /> otakRekt
            {otakMemories.length > 0 && <span style={{ background: REKT_COLOR, color: '#000000', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{otakMemories.length}</span>}
            {learnedWorkflows.filter(w => w.enabled).length > 0 && <span title="Workflow aktif" style={{ background: EVOLUTION_COLOR, color: '#000000', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>🧬{learnedWorkflows.filter(w => w.enabled).length}</span>}
          </button>
          <button onClick={() => togglePanel('evm')}
            style={{ background: showEVMPanel ? '#141414' : 'transparent', border: `1px solid ${evmRunning ? EVM_COLOR : showEVMPanel ? EVM_COLOR : '#333333'}`, color: showEVMPanel ? EVM_COLOR : '#888888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: evmRunning ? `0 0 8px ${EVM_COLOR}66` : 'none' }}>
            {evmRunning && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: EVM_COLOR, display: 'inline-block', animation: 'pulse-dot 0.9s ease-in-out infinite' }} />}
            <FaEthereum size={12} /> EVM Agent{evmLogs.filter(l => l.status === 'success').length > 0 && <span style={{ background: EVM_COLOR, color: '#ffffff', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{evmLogs.filter(l => l.status === 'success').length}</span>}
          </button>
          <button onClick={() => togglePanel('chain')}
            style={{ background: showChainPanel ? '#141414' : 'transparent', border: `1px solid ${chainRunning ? MULTI_CHAIN_COLOR : showChainPanel ? MULTI_CHAIN_COLOR : '#333333'}`, color: showChainPanel ? MULTI_CHAIN_COLOR : '#888888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: chainRunning ? `0 0 8px ${MULTI_CHAIN_COLOR}66` : 'none' }}>
            {chainRunning && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: MULTI_CHAIN_COLOR, display: 'inline-block', animation: 'pulse-dot 0.9s ease-in-out infinite' }} />}
            <FaGlobe size={12} /> Multi-Chain{chainLogs.filter(l => l.status === 'success').length > 0 && <span style={{ background: MULTI_CHAIN_COLOR, color: '#000000', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{chainLogs.filter(l => l.status === 'success').length}</span>}
          </button>
          <button onClick={() => togglePanel('wallet')}
            style={{ background: showWalletDashboard ? '#141414' : 'transparent', border: `1px solid ${showWalletDashboard ? EVM_COLOR : '#333333'}`, color: showWalletDashboard ? EVM_COLOR : '#888888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FaWallet size={12} /> Multi-Wallet{watchWallets.length > 0 && <span style={{ background: EVM_COLOR, color: '#ffffff', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{watchWallets.length}</span>}
          </button>
          <button onClick={() => togglePanel('agentTeam')}
            style={{ background: showAgentTeamPanel ? '#181818' : 'transparent', border: `1px solid ${runningAgentIds.size > 0 ? AGENT_COLOR : showAgentTeamPanel ? AGENT_COLOR : '#333333'}`, color: showAgentTeamPanel ? AGENT_COLOR : '#888888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: runningAgentIds.size > 0 ? `0 0 8px ${AGENT_COLOR}66` : 'none' }}>
            {runningAgentIds.size > 0 && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: AGENT_COLOR, display: 'inline-block', animation: 'pulse-dot 0.9s ease-in-out infinite' }} />}
            🤖 Tim Agent{agentTeam.filter(a => a.active).length > 0 && <span style={{ background: AGENT_COLOR, color: '#000000', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{agentTeam.filter(a => a.active).length}</span>}
          </button>
        </div>
      </header>
      <Navbar />
      {showSettings && (
        <div style={{ background: '#0e0e0e', border: '1px solid #2f2f2f', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#888888', marginBottom: '12px' }}>⚙️ <strong style={{ color: '#aaaaaa' }}>Settings</strong></div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#888888' }}>Chat</span>
              <button onClick={clearChat} style={{ fontSize: '12px', padding: '6px 14px', background: '#111111', border: '1px solid #767676', color: '#acacac', cursor: 'pointer' }}>🗑️ Hapus Semua Chat</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#888888' }}>Notifikasi</span>
              <button onClick={handleToggleNotify}
                title={notifyOnDone ? 'Bunyi ping + notif browser tiap Rekt selesai ngetik' : 'Aktifkan notif selesai ngetik'}
                style={{ fontSize: '12px', padding: '6px 14px', background: notifyOnDone ? '#1c1c1c' : '#111111', border: `1px solid ${notifyOnDone ? REKT_COLOR : '#767676'}`, color: notifyOnDone ? REKT_COLOR : '#acacac', cursor: 'pointer', fontWeight: notifyOnDone ? 700 : 400 }}>
                {notifyOnDone ? '🔔 Notif ON — Rekt Selesai Ngetik' : '🔕 Notif OFF'}
              </button>
              {notifyOnDone && notifyPermission === 'denied' && (
                <span style={{ fontSize: '10px', color: '#767676', maxWidth: '220px', lineHeight: 1.5 }}>
                  ⚠️ Izin notifikasi browser diblokir — bunyi ping tetap jalan, tapi notif pop-up cuma muncul kalau izin notification di-allow lagi lewat setting browser.
                </span>
              )}
              {notifyOnDone && notifyPermission !== 'denied' && (
                <span style={{ fontSize: '10px', color: '#444444', maxWidth: '220px', lineHeight: 1.5 }}>
                  Bunyi ping selalu aktif. Notif pop-up muncul kalau tab ini lagi di background.
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#888888' }}>Memori</span>
              <button onClick={() => { if (window.confirm(`Reset semua ${otakMemories.length} memori Rekt?`)) { setOtakMemories([]); saveMemories([]); setOtakMsg('🗑️ Semua memori dihapus'); setTimeout(() => setOtakMsg(''), 3000); } }}
                disabled={otakMemories.length === 0}
                style={{ fontSize: '12px', padding: '6px 14px', background: '#111111', border: '1px solid #767676', color: '#acacac', cursor: 'pointer', opacity: otakMemories.length === 0 ? 0.4 : 1 }}>
                🧠 Reset Memori Rekt
              </button>
            </div>
          </div>
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #202020' }}>
            <span style={{ fontSize: '12px', color: '#888888' }}>🧩 OpenCode AI Server</span>
            {isHopelessOpencodeTarget(opencodeCfg.baseUrl) ? (
              <div style={{ fontSize: '11px', color: '#555555', margin: '6px 0 10px', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 8px' }}>
                  <code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>localhost</code> di HP itu HP itu sendiri, jadi tidak akan pernah nyambung ke server di komputer kamu. Tapi kamu <strong style={{ color: '#dddddd' }}>tetap bisa</strong> pakai OpenCode AI beneran dari HP — tanpa install apapun di HP, tanpa file skrip tambahan di project:
                </p>
                <ol style={{ margin: '0 0 8px', paddingLeft: '18px' }}>
                  <li>Di komputer, buka terminal lalu paste command di bawah ini (tombol 📋)</li>
                  <li>Tunggu sampai muncul baris berisi <code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>https://xxxx.trycloudflare.com</code> di terminal</li>
                  <li>Paste link itu ke kolom di bawah — dari HP mana pun</li>
                </ol>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <code style={{
                    flex: 1, display: 'block', background: '#050505', border: '1px solid #222222',
                    padding: '8px 10px', color: '#d8d8d8', fontSize: '10.5px', lineHeight: 1.5,
                    wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                  }}>
                    {OPENCODE_TUNNEL_COMMAND}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(OPENCODE_TUNNEL_COMMAND); setTunnelCmdCopied(true); setTimeout(() => setTunnelCmdCopied(false), 2000); }}
                    style={{ flexShrink: 0, fontSize: '11px', padding: '6px 10px', background: tunnelCmdCopied ? '#1f1f1f' : '#181818', border: `1px solid ${tunnelCmdCopied ? '#878787' : REKT_COLOR}`, color: tunnelCmdCopied ? '#878787' : REKT_COLOR, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {tunnelCmdCopied ? '✅ Disalin' : '📋 Copy'}
                  </button>
                </div>
                <p style={{ margin: 0 }}>Command ini cuma pakai <code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>npx</code> (auto-download saat pertama jalan, tanpa langkah install manual). Biarkan terminalnya tetap terbuka selama dipakai dari HP — kalau ditutup / komputer mati, Rekt berhenti sampai OpenCode aktif kembali. Tiap kali command ini dijalankan ulang, link-nya berubah.</p>
              </div>
            ) : (
              <p style={{ fontSize: '11px', color: '#555555', margin: '6px 0 10px', lineHeight: 1.5 }}>
                Jalankan <code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>npx opencode-ai serve</code> (atau <code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>opencode serve</code> kalau sudah install global) di komputer ini — tidak butuh API key. Rekt akan otomatis pakai server itu untuk generate balasan.
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={opencodeUrlDraft}
                onChange={e => setOpencodeUrlDraft(e.target.value)}
                placeholder={DEFAULT_OPENCODE_URL}
                style={{ flex: '1 1 220px', minWidth: '180px', fontSize: '12px', padding: '7px 10px', background: '#0d0d0d', border: '1px solid #333333', color: '#dddddd' }}
              />
              <button
                onClick={() => { const next = { ...opencodeCfg, baseUrl: opencodeUrlDraft.trim() || DEFAULT_OPENCODE_URL, sessionId: undefined }; setOpencodeCfg(next); saveOpencodeConfig(next); }}
                style={{ fontSize: '12px', padding: '6px 14px', background: '#181818', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: 'pointer' }}>
                💾 Simpan & Sambungkan
              </button>
              {opencodeCfg.sessionId && (
                <button
                  onClick={() => { const next = { ...opencodeCfg, sessionId: undefined }; setOpencodeCfg(next); saveOpencodeConfig(next); }}
                  title="Mulai session baru di opencode (percakapan lama tidak dibawa lagi ke AI)"
                  style={{ fontSize: '12px', padding: '6px 14px', background: '#111111', border: '1px solid #444444', color: '#888888', cursor: 'pointer' }}>
                  🔄 Reset Session AI
                </button>
              )}
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px', color: opencodeStatus === 'online' ? ONLINE_STATUS_COLOR : opencodeStatus === 'offline' ? LOCAL_MODE_COLOR : '#888888' }}>
              Status: {opencodeStatus === 'online' ? `✅ Terhubung ke ${opencodeCfg.baseUrl}` : opencodeStatus === 'offline' ? `❌ Tidak terhubung ke ${opencodeCfg.baseUrl} — Rekt tidak memiliki fallback local brain` : '⏳ Mengecek...'}
            </div>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#888888' }}>🧠 Model AI (opsional)</span>
                <button onClick={loadOpencodeModelList} disabled={opencodeModelsLoading || opencodeStatus !== 'online'}
                  style={{ fontSize: '10px', padding: '4px 10px', background: '#141414', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: opencodeStatus === 'online' ? 'pointer' : 'not-allowed', opacity: (opencodeModelsLoading || opencodeStatus !== 'online') ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FaSyncAlt size={9} style={opencodeModelsLoading ? { animation: 'spin 1s linear infinite' } : undefined} /> {opencodeModelsLoading ? 'Mengambil...' : 'Cek Model Tersedia'}
                </button>
              </div>
              {opencodeModelsError && (
                <div style={{ fontSize: '10.5px', color: '#acacac', marginBottom: '8px' }}>⚠️ {opencodeModelsError}</div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={opencodeCfg.model || ''}
                  onChange={e => { const next = { ...opencodeCfg, model: e.target.value || undefined }; setOpencodeCfg(next); saveOpencodeConfig(next); }}
                  style={{ flex: '1 1 220px', minWidth: '180px', fontSize: '12px', padding: '7px 10px', background: '#0d0d0d', border: '1px solid #333333', color: '#dddddd' }}>
                  <option value="">Default server (auto)</option>
                  {opencodeModels.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {opencodeCfg.model && (
                  <button onClick={() => { const next = { ...opencodeCfg, model: undefined }; setOpencodeCfg(next); saveOpencodeConfig(next); }}
                    style={{ fontSize: '11px', padding: '6px 12px', background: '#111111', border: '1px solid #444444', color: '#888888', cursor: 'pointer' }}>
                    Reset ke Default
                  </button>
                )}
              </div>
              <p style={{ fontSize: '10.5px', color: '#444444', margin: '6px 0 0', lineHeight: 1.5 }}>
                Klik <strong style={{ color: REKT_COLOR }}>Cek Model Tersedia</strong> untuk ambil daftar provider/model yang sudah dikonfigurasi di server OpenCode kamu, lalu pilih salah satu buat dipakai Rekt. Kosongkan untuk pakai model default server.
              </p>
            </div>
          </div>
          <div style={{ marginTop: '12px', padding: '8px 12px', background: '#0b0b0b', border: `1px solid ${REKT_COLOR}22`, fontSize: '11px', color: '#555555' }}>
            🧩 Balasan Rekt diambil dari <strong style={{ color: REKT_COLOR }}>OpenCode AI</strong> (server lokal, tanpa API key) kalau tersedia, dan <strong style={{ color: REKT_COLOR }}>tanpa fallback local brain</strong> kalau server-nya tidak aktif. Data garapan/keuangan/wallet tetap tersimpan hanya di browser kamu.
          </div>

          {/* --- Social Research: X + Telegram --- */}
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #202020' }}>
            <span style={{ fontSize: '12px', color: '#888888' }}>🔎 Social Research — X & Telegram</span>
            <p style={{ fontSize: '11px', color: '#555555', margin: '6px 0 10px', lineHeight: 1.5 }}>
              Kalau diisi, Rekt bakal narik data live dari X/Telegram saat kamu minta riset/cek status project, lalu kasih ke OpenCode sebagai konteks tambahan (bukan cuma nebak dari ingatan model).
            </p>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: '#888888', marginBottom: '6px' }}>𝕏 X (Twitter) — official API, read-only</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="password"
                  value={xApiTokenDraft}
                  onChange={e => setXApiTokenDraft(e.target.value)}
                  placeholder="Bearer Token (dari developer.x.com)"
                  style={{ flex: '1 1 260px', minWidth: '180px', fontSize: '12px', padding: '7px 10px', background: '#0d0d0d', border: '1px solid #333333', color: '#dddddd' }}
                />
                <button
                  onClick={() => { const next = { bearerToken: xApiTokenDraft.trim() || undefined }; setXApiCfg(next); saveXApiConfig(next); setXApiTestMsg(''); }}
                  style={{ fontSize: '12px', padding: '6px 14px', background: '#181818', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: 'pointer' }}>
                  💾 Simpan
                </button>
                <button
                  disabled={!xApiCfg.bearerToken || xApiTesting}
                  onClick={async () => { setXApiTesting(true); setXApiTestMsg(''); const r = await testXApiConnection(xApiCfg); setXApiTestMsg(r.message); setXApiTesting(false); }}
                  style={{ fontSize: '12px', padding: '6px 14px', background: '#111111', border: '1px solid #444444', color: '#888888', cursor: (!xApiCfg.bearerToken || xApiTesting) ? 'not-allowed' : 'pointer', opacity: (!xApiCfg.bearerToken || xApiTesting) ? 0.5 : 1 }}>
                  {xApiTesting ? '⏳ Cek...' : '🔌 Test'}
                </button>
                {xApiCfg.bearerToken && (
                  <button onClick={() => { setXApiCfg({}); saveXApiConfig({}); setXApiTokenDraft(''); setXApiTestMsg(''); }}
                    style={{ fontSize: '12px', padding: '6px 14px', background: '#111111', border: '1px solid #444444', color: '#888888', cursor: 'pointer' }}>
                    🗑️ Hapus
                  </button>
                )}
              </div>
              {xApiTestMsg && <div style={{ fontSize: '10.5px', color: '#acacac', marginTop: '6px' }}>{xApiTestMsg}</div>}
              <p style={{ fontSize: '10.5px', color: '#444444', margin: '6px 0 0', lineHeight: 1.5 }}>
                Cuma butuh Bearer Token dari <code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>developer.x.com</code> (tier gratis/Basic cukup buat search terbatas). Tidak ada login/cookie akun asli yang dipakai.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#888888', marginBottom: '6px' }}>✈️ Telegram — login akun pribadi (MTProto)</div>
              {tgClientCfg.sessionString ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: ONLINE_STATUS_COLOR }}>✅ Login sebagai {tgClientCfg.meLabel || tgClientCfg.phoneNumber}</span>
                  <button onClick={logoutTelegram}
                    style={{ fontSize: '12px', padding: '6px 14px', background: '#111111', border: '1px solid #444444', color: '#888888', cursor: 'pointer' }}>
                    🚪 Logout
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <input value={tgLoginDraft.apiId} onChange={e => setTgLoginDraft(p => ({ ...p, apiId: e.target.value.replace(/\D/g, '') }))}
                      placeholder="API ID (my.telegram.org)" style={{ flex: '1 1 140px', fontSize: '12px', padding: '7px 10px', background: '#0d0d0d', border: '1px solid #333333', color: '#dddddd' }} />
                    <input value={tgLoginDraft.apiHash} onChange={e => setTgLoginDraft(p => ({ ...p, apiHash: e.target.value }))}
                      placeholder="API Hash" style={{ flex: '1 1 200px', fontSize: '12px', padding: '7px 10px', background: '#0d0d0d', border: '1px solid #333333', color: '#dddddd' }} />
                    <input value={tgLoginDraft.phoneNumber} onChange={e => setTgLoginDraft(p => ({ ...p, phoneNumber: e.target.value }))}
                      placeholder="+6281234567890" style={{ flex: '1 1 160px', fontSize: '12px', padding: '7px 10px', background: '#0d0d0d', border: '1px solid #333333', color: '#dddddd' }} />
                  </div>
                  {tgLoginStep === 'idle' && (
                    <button onClick={startTgLogin} disabled={!tgLoginDraft.apiId || !tgLoginDraft.apiHash || !tgLoginDraft.phoneNumber}
                      style={{ fontSize: '12px', padding: '6px 14px', background: '#181818', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: 'pointer', opacity: (!tgLoginDraft.apiId || !tgLoginDraft.apiHash || !tgLoginDraft.phoneNumber) ? 0.5 : 1 }}>
                      📲 Kirim Kode & Login
                    </button>
                  )}
                  {tgLoginStep === 'connecting' && <div style={{ fontSize: '11px', color: '#888888' }}>⏳ Menghubungkan ke Telegram...</div>}
                  {tgLoginStep === 'code' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input value={tgLoginCodeInput} onChange={e => setTgLoginCodeInput(e.target.value)} placeholder="Kode dari Telegram"
                        style={{ flex: '1 1 160px', fontSize: '12px', padding: '7px 10px', background: '#0d0d0d', border: '1px solid #333333', color: '#dddddd' }} />
                      <button onClick={() => tgLoginHandleRef.current?.submitCode(tgLoginCodeInput)} disabled={!tgLoginCodeInput}
                        style={{ fontSize: '12px', padding: '6px 14px', background: '#181818', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: 'pointer' }}>
                        ✅ Submit Kode
                      </button>
                    </div>
                  )}
                  {tgLoginStep === 'password' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input type="password" value={tgLoginPasswordInput} onChange={e => setTgLoginPasswordInput(e.target.value)} placeholder="Password 2FA"
                        style={{ flex: '1 1 160px', fontSize: '12px', padding: '7px 10px', background: '#0d0d0d', border: '1px solid #333333', color: '#dddddd' }} />
                      <button onClick={() => tgLoginHandleRef.current?.submitPassword(tgLoginPasswordInput)} disabled={!tgLoginPasswordInput}
                        style={{ fontSize: '12px', padding: '6px 14px', background: '#181818', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: 'pointer' }}>
                        ✅ Submit Password
                      </button>
                    </div>
                  )}
                  {tgLoginStep === 'error' && <div style={{ fontSize: '11px', color: '#e57373', marginTop: '4px' }}>❌ {tgLoginError}</div>}
                </>
              )}
              <p style={{ fontSize: '10.5px', color: '#444444', margin: '8px 0 0', lineHeight: 1.5 }}>
                Ambil API ID/Hash gratis di <code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>my.telegram.org</code>. ⚠️ Session login ini setara akses penuh ke akun Telegram kamu (bisa baca semua chat) dan disimpan di localStorage browser ini — <strong style={{ color: '#dddddd' }}>disarankan pakai akun kedua/khusus riset</strong>, bukan akun utama. Butuh package <code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>telegram</code> ter-install (<code style={{ background: '#111111', padding: '1px 5px', color: REKT_COLOR }}>npm install telegram</code>).
              </p>
            </div>
          </div>
        </div>
      )}
      {showOtakRekt && (
        <div style={{ background: '#0b0b0b', border: `1px solid ${REKT_COLOR}`, borderLeft: `4px solid ${REKT_COLOR}`, padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaBrain size={18} color={REKT_COLOR} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: REKT_COLOR }}>otakRekt — Memory & Evolusi</div>
                <div style={{ fontSize: '11px', color: '#555555' }}>
                  {otakMemories.length} ingatan · {learnedWorkflows.length} workflow ({learnedWorkflows.filter(w => w.enabled).length} aktif) · makin sering chat, makin pintar! 🧠
                </div>
                <div style={{ fontSize: '10px', color: '#444444', marginTop: '3px' }}>
                  🧩 Adaptive learning (OpenCode): {rektOpencodeLearning.lessons.length} pola tersimpan
                  {rektOpencodeLearning.updatedAt ? ` · update terakhir ${new Date(rektOpencodeLearning.updatedAt).toLocaleString('id-ID')}` : ''}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <button onClick={() => setOtakRektTab('memori')}
              style={{ fontSize: '11px', padding: '6px 14px', background: otakRektTab === 'memori' ? REKT_COLOR : '#141414', color: otakRektTab === 'memori' ? '#000000' : REKT_COLOR, border: `1px solid ${REKT_COLOR}`, cursor: 'pointer', fontWeight: otakRektTab === 'memori' ? 700 : 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaBrain size={11} /> Memori{otakMemories.length > 0 && <span style={{ background: otakRektTab === 'memori' ? '#000000' : REKT_COLOR, color: otakRektTab === 'memori' ? REKT_COLOR : '#000000', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{otakMemories.length}</span>}
            </button>
            <button onClick={() => setOtakRektTab('evolusi')}
              style={{ fontSize: '11px', padding: '6px 14px', background: otakRektTab === 'evolusi' ? EVOLUTION_COLOR : '#141414', color: otakRektTab === 'evolusi' ? '#000000' : EVOLUTION_COLOR, border: `1px solid ${EVOLUTION_COLOR}`, cursor: 'pointer', fontWeight: otakRektTab === 'evolusi' ? 700 : 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
              🧬 Evolusi{learnedWorkflows.filter(w => w.enabled).length > 0 && <span style={{ background: otakRektTab === 'evolusi' ? '#000000' : EVOLUTION_COLOR, color: otakRektTab === 'evolusi' ? EVOLUTION_COLOR : '#000000', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{learnedWorkflows.filter(w => w.enabled).length}</span>}
            </button>
          </div>
          {otakRektTab === 'memori' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <button onClick={() => learnFromOpenCodeHistory(messages, true)} disabled={adaptiveLearningBusy || messages.filter(m => m.role === 'user').length === 0}
                  title="Paksa Rekt menganalisis ulang seluruh histori chat sekarang, tanpa menunggu interval otomatis"
                  style={{ fontSize: '11px', padding: '5px 12px', background: '#161616', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: (adaptiveLearningBusy || messages.filter(m => m.role === 'user').length === 0) ? 0.5 : 1 }}>
                  <FaSyncAlt size={10} style={adaptiveLearningBusy ? { animation: 'spin 1s linear infinite' } : undefined} /> {adaptiveLearningBusy ? 'Menganalisis...' : 'Refresh Sekarang'}
                </button>
                <button onClick={exportOtakMemory} disabled={otakMemories.length === 0}
                  style={{ fontSize: '11px', padding: '5px 12px', background: '#191919', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: 'pointer', opacity: otakMemories.length === 0 ? 0.4 : 1 }}>⬇️ Export</button>
                <button onClick={() => otakImportRef.current?.click()}
                  style={{ fontSize: '11px', padding: '5px 12px', background: '#161616', border: '1px solid #878787', color: '#878787', cursor: 'pointer' }}>⬆️ Import</button>
                <input ref={otakImportRef} type="file" accept=".json" onChange={importOtakMemory} style={{ display: 'none' }} />
              </div>
              {otakMsg && (
                <div style={{ padding: '7px 12px', background: otakMsg.startsWith('✅') || otakMsg.startsWith('🧠') ? '#161616' : '#0f0f0f', border: `1px solid ${otakMsg.startsWith('✅') || otakMsg.startsWith('🧠') ? '#878787' : '#767676'}`, color: otakMsg.startsWith('✅') || otakMsg.startsWith('🧠') ? '#878787' : '#acacac', fontSize: '12px', marginBottom: '12px' }}>
                  {otakMsg}
                </div>
              )}
              <div style={{ background: '#131313', border: '1px solid #2b2b2b', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: REKT_COLOR, marginBottom: '8px' }}>{otakEditId ? '✏️ Edit Memory' : '➕ Tambah Memory Baru'}</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <select value={otakCategory} onChange={e => setOtakCategory(e.target.value as OtakRektMemory['category'])}
                    style={{ fontSize: '12px', padding: '6px 10px', background: '#1b1b1b', border: '1px solid #323232', color: REKT_COLOR, cursor: 'pointer', minWidth: '120px' }}>
                    <option value="fakta">📌 Fakta</option>
                    <option value="preferensi">❤️ Preferensi</option>
                    <option value="tujuan">🎯 Tujuan</option>
                    <option value="catatan">📝 Catatan</option>
                    <option value="lainnya">💡 Lainnya</option>
                  </select>
                  <input value={otakTags} onChange={e => setOtakTags(e.target.value)} placeholder="tags (pisah koma, opsional)"
                    style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: '#1b1b1b', border: '1px solid #323232', color: '#aaaaaa', minWidth: '120px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <textarea value={otakInput} onChange={e => setOtakInput(e.target.value)}
                    placeholder="Tulis hal yang ingin Rekt selalu ingat tentang kamu, tujuanmu, preferensi, dll..."
                    rows={3}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addOrUpdateMemory(); } }}
                    style={{ flex: 1, fontSize: '12px', padding: '8px 10px', background: '#1b1b1b', border: '1px solid #323232', color: '#dddddd', resize: 'vertical', fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button onClick={addOrUpdateMemory} disabled={!otakInput.trim()}
                      style={{ padding: '8px 16px', background: otakInput.trim() ? REKT_COLOR : '#191919', color: otakInput.trim() ? '#000000' : '#333333', border: 'none', cursor: otakInput.trim() ? 'pointer' : 'default', fontWeight: 'bold', fontSize: '12px' }}>
                      {otakEditId ? 'Update' : 'Simpan'}
                    </button>
                    {otakEditId && <button onClick={() => { setOtakEditId(null); setOtakInput(''); setOtakTags(''); }}
                      style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #333333', color: '#666666', cursor: 'pointer', fontSize: '11px' }}>Batal</button>}
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#424242', marginTop: '5px' }}>Ctrl+Enter untuk simpan cepat · atau cukup ceritakan di chat, Rekt akan belajar otomatis 🧠</div>
              </div>
              {otakMemories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#424242', fontSize: '12px' }}>
                  Belum ada ingatan. Ngobrol dulu sama Rekt — dia akan belajar otomatis! 💬
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input value={otakSearch} onChange={e => setOtakSearch(e.target.value)} placeholder="🔍 Cari memory..."
                      style={{ flex: 1, fontSize: '12px', padding: '5px 10px', background: '#0d0d0d', border: '1px solid #323232', color: '#aaaaaa', minWidth: '120px' }} />
                    {(['semua','fakta','preferensi','tujuan','catatan','lainnya'] as const).map(cat => (
                      <button key={cat} onClick={() => setOtakFilter(cat)}
                        style={{ fontSize: '10px', padding: '4px 10px', background: otakFilter === cat ? REKT_COLOR : '#131313', color: otakFilter === cat ? '#000000' : '#555555', border: `1px solid ${otakFilter === cat ? REKT_COLOR : '#323232'}`, cursor: 'pointer', textTransform: 'capitalize' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                    {otakMemories
                      .filter(m => otakFilter === 'semua' || m.category === otakFilter)
                      .filter(m => !otakSearch || m.content.toLowerCase().includes(otakSearch.toLowerCase()) || (m.tags||[]).some(t => t.toLowerCase().includes(otakSearch.toLowerCase())))
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .map(m => {
                        const catColors: Record<OtakRektMemory['category'], string> = { fakta: REKT_COLOR, preferensi: '#a1a1a1', tujuan: '#a8a8a8', catatan: '#bebebe', lainnya: '#a0a0a0' };
                        const catEmoji: Record<OtakRektMemory['category'], string> = { fakta: '📌', preferensi: '❤️', tujuan: '🎯', catatan: '📝', lainnya: '💡' };
                        const c = catColors[m.category];
                        return (
                          <div key={m.id} style={{ background: '#131313', border: `1px solid ${c}22`, borderLeft: `3px solid ${c}`, padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '10px', padding: '1px 7px', background: `${c}18`, border: `1px solid ${c}44`, color: c }}>{catEmoji[m.category]} {m.category}</span>
                                {m.id.startsWith('auto_') && <span style={{ fontSize: '9px', padding: '1px 6px', background: '#191919', border: `1px solid ${REKT_COLOR}44`, color: REKT_COLOR }}>🤖 auto</span>}
                                {(m.tags||[]).filter(t=>t!=='auto').map(tag => <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', background: '#1b1b1b', color: '#6f6f6f', border: '1px solid #323232' }}>#{tag}</span>)}
                                <span style={{ fontSize: '10px', color: '#424242', marginLeft: 'auto' }}>{new Date(m.updatedAt).toLocaleDateString('id-ID')}</span>
                              </div>
                              <div style={{ fontSize: '13px', color: '#cccccc', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                              <button onClick={() => startEditMemory(m)} style={{ fontSize: '10px', padding: '3px 8px', background: '#191919', border: '1px solid #3d3d3d', color: REKT_COLOR, cursor: 'pointer' }}>✏️</button>
                              <button onClick={() => deleteMemory(m.id)} style={{ fontSize: '10px', padding: '3px 8px', background: '#0f0f0f', border: '1px solid #242424', color: '#767676', cursor: 'pointer' }}>🗑️</button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </>
          )}
          {otakRektTab === 'evolusi' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button onClick={manualEvolveWorkflows} disabled={evolutionAnalyzing || workflowHistory.length === 0}
                  style={{ fontSize: '11px', padding: '5px 12px', background: '#141414', border: `1px solid ${EVOLUTION_COLOR}`, color: EVOLUTION_COLOR, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: (evolutionAnalyzing || workflowHistory.length === 0) ? 0.5 : 1 }}>
                  <FaSyncAlt size={11} style={evolutionAnalyzing ? { animation: 'spin 1s linear infinite' } : undefined} /> {evolutionAnalyzing ? 'Menganalisis...' : 'Pelajari dari Riwayat'}
                </button>
              </div>
              {evolutionMsg && (
                <div style={{ padding: '7px 12px', background: evolutionMsg.startsWith('🧬') ? '#101010' : evolutionMsg.startsWith('❌') ? '#0f0f0f' : '#131313', border: `1px solid ${evolutionMsg.startsWith('🧬') ? EVOLUTION_COLOR : evolutionMsg.startsWith('❌') ? '#767676' : '#555555'}`, color: evolutionMsg.startsWith('🧬') ? EVOLUTION_COLOR : evolutionMsg.startsWith('❌') ? '#acacac' : '#aaaaaa', fontSize: '12px', marginBottom: '12px' }}>
                  {evolutionMsg}
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#888888', marginBottom: '10px', lineHeight: '1.6' }}>
                Setiap kali kamu menjalankan rangkaian skill/aksi yang sama berulang kali (minimal {WORKFLOW_PATTERN_MIN_OCCURRENCE}x), Rekt otomatis mengenalinya sebagai <strong>workflow</strong> dan mengingatnya — tanpa perlu diprogram manual. Rekt juga bisa mengusulkan workflow baru sendiri lewat chat kalau AI online. Workflow yang sering gagal otomatis dinonaktifkan (self-correcting).
              </div>
              {learnedWorkflows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#555555', fontSize: '13px' }}>Belum ada workflow yang dipelajari. Jalankan beberapa aksi berulang, atau klik "Pelajari dari Riwayat".</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                  {[...learnedWorkflows].sort((a, b) => b.updatedAt - a.updatedAt).map(wf => (
                    <div key={wf.id} style={{ background: '#0a0a0a', border: `1px solid ${wf.enabled ? '#2b2b2b' : '#2a2a2a'}`, padding: '10px 12px', opacity: wf.enabled ? 1 : 0.55 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '160px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: wf.enabled ? EVOLUTION_COLOR : '#777777', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {wf.name}
                            <span style={{ fontSize: '9px', padding: '1px 6px', background: wf.source === 'auto' ? '#272727' : wf.source === 'ai' ? '#222222' : '#282828', color: wf.source === 'auto' ? '#989898' : wf.source === 'ai' ? '#a2a2a2' : '#c3c3c3', borderRadius: '3px' }}>
                              {wf.source === 'auto' ? 'AUTO' : wf.source === 'ai' ? 'AI' : 'MANUAL'}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#888888', marginTop: '3px' }}>{wf.description}</div>
                          <div style={{ fontSize: '10px', color: '#555555', marginTop: '5px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {wf.steps.map((s, i) => (
                              <span key={i} style={{ padding: '2px 6px', background: '#141414', border: `1px solid ${EVOLUTION_COLOR}44`, borderRadius: '3px' }}>{s.skill}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: '10px', color: '#555555', marginTop: '5px' }}>
                            Dipakai {wf.usageCount}x · Sukses {wf.usageCount > 0 ? Math.round((wf.successCount / wf.usageCount) * 100) : 0}%
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                          <button onClick={() => toggleWorkflowEnabled(wf.id)} title={wf.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                            style={{ fontSize: '10px', padding: '4px 8px', background: 'transparent', border: `1px solid ${wf.enabled ? '#878787' : '#555555'}`, color: wf.enabled ? '#878787' : '#777777', cursor: 'pointer' }}>
                            {wf.enabled ? 'ON' : 'OFF'}
                          </button>
                          <button onClick={() => deleteLearnedWorkflow(wf.id)} title="Hapus workflow"
                            style={{ fontSize: '10px', padding: '4px 8px', background: 'transparent', border: '1px solid #767676', color: '#767676', cursor: 'pointer' }}>
                            <FaTrash size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {showEVMPanel && (
        <div style={{ background: '#0f0f0f', border: `1px solid ${EVM_COLOR}`, borderLeft: `4px solid ${EVM_COLOR}`, padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaEthereum size={18} color={EVM_COLOR} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: EVM_COLOR }}>EVM Agent — Multi-chain Skills</div>
                <div style={{ fontSize: '11px', color: '#555555' }}>
                  {evmConfig.rpcUrl
                    ? <span style={{ color: '#878787' }}>🟢 {evmConfig.networkName || 'Terhubung'}</span>
                    : <span style={{ color: '#767676' }}>🔴 Belum dikonfigurasi</span>}
                  {(() => { const addr = getLocalEVMWalletAddress(evmConfig); return addr ? <span> · Wallet <code style={{ color: '#aaaaaa' }}>{addr.slice(0, 8)}…{addr.slice(-6)}</code></span> : null; })()}
                  {' · '}{evmLogs.length} task log
                  {' · '}{2 + (evmConfig.customTokens || []).length} token ERC-20
                  {' · '}⛽ {evmConfig.gasMode || 'standard'}
                  {evmConfig.explorerUrl && evmConfig.rpcUrl && <span> · <a href={evmConfig.explorerUrl} target="_blank" rel="noreferrer" style={{ color: EVM_COLOR, textDecoration: 'none' }}>Explorer ↗</a></span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setAutonomousAgent(v => !v)}
                title={autonomousAgent ? 'AI boleh mengeksekusi action wallet/on-chain tanpa klik per transaksi' : 'Aktifkan autonomous execution'}
                style={{ fontSize: '11px', padding: '5px 12px', background: autonomousAgent ? '#1c1c1c' : '#0e0e0e', border: `1px solid ${autonomousAgent ? '#878787' : '#555555'}`, color: autonomousAgent ? '#878787' : '#888888', cursor: 'pointer', fontWeight: autonomousAgent ? 700 : 400 }}>
                {autonomousAgent ? '🤖 AUTO ON' : '🤖 AUTO OFF'}
              </button>
              <button onClick={() => { setEVMConfigEdit(p => !p); setEVMFormData(evmConfig); }}
                style={{ fontSize: '11px', padding: '5px 12px', background: evmConfigEdit ? '#141414' : '#0e0e0e', border: `1px solid ${EVM_COLOR}`, color: EVM_COLOR, cursor: 'pointer' }}>
                {evmConfigEdit ? '✕ Tutup Config' : '⚙️ Config'}
              </button>
              <button onClick={() => setCustomAbiOpen(p => !p)}
                title="Panggil contract address (CA) apa pun pakai ABI sendiri — buat kalau ABI bawaan skill nggak cocok"
                style={{ fontSize: '11px', padding: '5px 12px', background: customAbiOpen ? '#141414' : '#0e0e0e', border: '1px solid #8c8c8c', color: '#b1b1b1', cursor: 'pointer' }}>
                {customAbiOpen ? '✕ Tutup ABI Custom' : '🔧 Mode ABI Custom'}
              </button>
            </div>
          </div>
          {evmMsg && (
            <div style={{ padding: '7px 12px', background: evmMsg.startsWith('✅') ? '#161616' : '#0f0f0f', border: `1px solid ${evmMsg.startsWith('✅') ? '#878787' : '#767676'}`, color: evmMsg.startsWith('✅') ? '#878787' : '#acacac', fontSize: '12px', marginBottom: '12px' }}>
              {evmMsg}
            </div>
          )}
          <div style={{ padding: '8px 12px', background: autonomousAgent ? '#111111' : '#111111', border: `1px solid ${autonomousAgent ? '#4a4a4a' : '#222222'}`, color: autonomousAgent ? '#b6b6b6' : '#777777', fontSize: '11px', marginBottom: '12px' }}>
            {autonomousAgent
              ? <>🤖 <b>Autonomous Agent aktif.</b> AI dapat menjalankan action terstruktur, membaca blockchain, signing lokal, broadcast, dan menunggu confirmation secara otomatis.</>
              : <>🤖 <b>Autonomous Agent mati.</b> Klik AUTO ON sekali jika ingin agent bekerja tanpa approval per-action.</>}
            <div style={{ marginTop: '4px', color: '#666666' }}>Private key tidak pernah dikirim ke AI/OpenCode; hanya digunakan lokal oleh ethers di browser.</div>
          </div>
          {/* Kontrol Gas — biar gampang diatur tanpa buka Config dulu. "Hemat" narik gas price
              di bawah rata-rata network (murah, agak lambat), "Cepat" dinaikkan (mahal dikit,
              cepat konfirmasi). Semua skill kirim tx (Payment/Approve/Transfer/Swap/ContractCall/
              Stake/NFTMint) otomatis pakai mode ini. Live Gwei + estimasi fee per mode (mirror
              renderGasFeeBox di WalletGenerator.tsx) — klik Refresh Gas buat narik harga terbaru
              dari RPC, angkanya nggak nunggu sampai ada tx beneran. */}
          <div style={{ padding: '10px 12px', background: '#111111', border: '1px solid #ffaa0033', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '11px', color: '#b0b0b0', fontWeight: 'bold' }}>
                ⛽ Kontrol Gas — biar gak boros
              </div>
              <button onClick={refreshGasPreview} disabled={gasPreviewLoading}
                style={{ background: 'none', border: '1px solid #ffaa0066', color: gasPreviewLoading ? '#848484' : '#b0b0b0', padding: '3px 10px', cursor: gasPreviewLoading ? 'wait' : 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FaSyncAlt size={9} style={{ animation: gasPreviewLoading ? 'spin 1s linear infinite' : undefined }} /> {gasPreviewLoading ? 'Fetching...' : 'Refresh Gas'}
              </button>
            </div>
            {gasPreviewError && (
              <div style={{ fontSize: '10px', color: '#949494', marginBottom: '8px' }}>{gasPreviewError}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '6px', marginBottom: '8px' }}>
              {([
                { key: 'hemat',    label: '🐢 Hemat' },
                { key: 'standard', label: '⚖️ Standard' },
                { key: 'cepat',    label: '🚀 Cepat' },
                { key: 'custom',   label: '✏️ Custom' },
              ] as const).map(opt => {
                const active = (evmConfig.gasMode || 'standard') === opt.key;
                const gwei = opt.key !== 'custom' && gasPreviewGwei ? gasPreviewGwei[opt.key] : null;
                const feeEth = opt.key === 'custom'
                  ? estimateGasPreviewFeeEth(parseFloat(evmConfig.customGasGwei || ''))
                  : estimateGasPreviewFeeEth(gwei);
                return (
                  <button key={opt.key}
                    onClick={() => {
                      const merged = { ...evmConfig, gasMode: opt.key };
                      setEVMConfig(merged);
                      saveEVMConfig(merged);
                    }}
                    style={{ fontSize: '11px', padding: '6px 4px', cursor: 'pointer', background: active ? '#b0b0b0' : 'transparent', color: active ? '#000000' : '#b0b0b0', border: '1px solid #ffaa0066', fontWeight: active ? 'bold' : 400, textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>
                    <div>{opt.label}</div>
                    {opt.key !== 'custom' && gwei !== null && (
                      <div style={{ fontSize: '10px', opacity: 0.8, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gwei.toFixed(2)} Gwei</div>
                    )}
                    {feeEth !== null && (
                      <div style={{ fontSize: '9px', opacity: 0.8, fontFamily: 'monospace', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ≈{feeEth} ETH
                      </div>
                    )}
                    {opt.key !== 'custom' && gwei === null && !gasPreviewLoading && (
                      <div style={{ fontSize: '9px', opacity: 0.5 }}>— klik Refresh Gas —</div>
                    )}
                  </button>
                );
              })}
            </div>
            {evmConfig.gasMode === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                <input
                  value={evmConfig.customGasGwei || ''}
                  onChange={e => {
                    const merged = { ...evmConfig, customGasGwei: e.target.value };
                    setEVMConfig(merged);
                    saveEVMConfig(merged);
                  }}
                  placeholder="Gas price manual (Gwei), mis. 1.5"
                  style={{ fontSize: '12px', padding: '6px 10px', background: '#0f0f0f', border: '1px solid #ffaa0044', color: '#dddddd', fontFamily: 'monospace', width: '220px' }}
                />
                <span style={{ fontSize: '10px', color: '#646464' }}>Gwei</span>
              </div>
            )}
            <div style={{ fontSize: '10px', color: '#646464', marginTop: '6px' }}>
              Berlaku otomatis di semua transaksi (Payment, Approve, Transfer, Swap, Contract Call, Stake, NFT Mint).
              Simulasi (pre-flight) juga jalan duluan sebelum kirim — kalau bakal revert, tx dibatalkan sebelum buang gas.
              Gas limit dihitung otomatis + buffer 20% (nggak mepet ke limit lagi) dan estimasi fee-nya muncul di chat sebelum tx benar-benar dikirim.
              Angka Gwei/fee di kartu atas dihitung dari gas limit representatif (21.000, transfer native) — fee tx sungguhan (Approve/Swap/dll) bisa beda tergantung kompleksitas tx-nya, lihat pesan ⛽ di chat pas eksekusi buat angka pastinya.
            </div>
          </div>
          {evmConfigEdit && (
            <div style={{ background: '#0c0c0c', border: `1px solid ${EVM_COLOR}33`, padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: EVM_COLOR, marginBottom: '10px' }}>⚙️ Konfigurasi EVM Agent</div>
              {/* Network Preset Selector */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: '#666666', marginBottom: '6px' }}>🌐 Pilih Preset Jaringan (opsional):</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {Object.entries(EVM_CHAIN_PRESETS).map(([key, preset]) => (
                    <button key={key} onClick={() => setEVMFormData(prev => applyPresetToChainDraft(evmConfig, prev, { chainId: preset.chainId!, networkName: preset.networkName!, rpcUrl: preset.rpcUrl!, explorerUrl: preset.explorerUrl! }))}
                      style={{ fontSize: '10px', padding: '3px 8px', background: evmFormData.chainId === preset.chainId ? EVM_COLOR : '#0f0f0f', color: evmFormData.chainId === preset.chainId ? '#ffffff' : '#666666', border: `1px solid ${evmFormData.chainId === preset.chainId ? EVM_COLOR : EVM_COLOR + '33'}`, cursor: 'pointer' }}>
                      {preset.networkName}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {([
                  { key: 'networkName', label: 'Nama Network', placeholder: 'Ethereum Mainnet' },
                  { key: 'rpcUrl', label: 'RPC URL', placeholder: 'https://mainnet.infura.io/v3/YOUR_KEY' },
                  { key: 'privateKey', label: 'Private Key', placeholder: '0x... (tersimpan lokal)' },
                  { key: 'chainId', label: 'Chain ID', placeholder: '1' },
                  { key: 'explorerUrl', label: 'Explorer URL', placeholder: 'https://etherscan.io' },
                  { key: 'dexRouterAddress', label: 'DEX Router Address', placeholder: '0x... (Uniswap / 1inch)' },
                  { key: 'usdcAddress', label: 'USDC Address', placeholder: '0x...' },
                  { key: 'wethAddress', label: 'WETH Address', placeholder: '0x...' },
                  { key: 'nftContractAddress', label: 'NFT Contract (opsional)', placeholder: '0x...' },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', color: '#666666', minWidth: '140px' }}>{label}</label>
                    <input
                      type={key === 'privateKey' ? 'password' : 'text'}
                      value={String((evmFormData as Record<string, unknown>)[key] || '')}
                      onChange={e => setEVMFormData(prev => ({ ...prev, [key]: key === 'chainId' ? Number(e.target.value) : e.target.value }))}
                      placeholder={placeholder}
                      style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: '#0f0f0f', border: `1px solid ${EVM_COLOR}44`, color: '#aaaaaa', fontFamily: 'monospace' }}
                    />
                  </div>
                ))}
                {/* Daftar Token ERC-20 custom — tidak dibatasi USDC/WETH */}
                <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: `1px dashed ${EVM_COLOR}33` }}>
                  <div style={{ fontSize: '11px', color: EVM_COLOR, marginBottom: '8px' }}>
                    🪙 Daftar Token ERC-20 (selain USDC/WETH)
                  </div>
                  {((evmFormData.customTokens && evmFormData.customTokens.length > 0) ? evmFormData.customTokens : []).length === 0 && (
                    <div style={{ fontSize: '11px', color: '#444444', marginBottom: '8px' }}>
                      Belum ada token custom. Tambahkan simbol + alamat contract-nya di bawah, mis. DAI, USDT, LINK, dll.
                    </div>
                  )}
                  {(evmFormData.customTokens || []).map((t, idx) => (
                    <div key={`${t.symbol}-${idx}`} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#bfbfbf', minWidth: '60px', fontFamily: 'monospace' }}>
                        {t.symbol.toUpperCase()}
                      </span>
                      <code style={{ flex: 1, fontSize: '11px', color: '#999999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.address}
                      </code>
                      <button
                        onClick={() => setEVMFormData(prev => ({ ...prev, customTokens: (prev.customTokens || []).filter((_, i) => i !== idx) }))}
                        title="Hapus token ini"
                        style={{ fontSize: '11px', padding: '3px 8px', background: 'transparent', border: '1px solid #f4433666', color: '#acacac', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input
                      value={newTokenSymbol}
                      onChange={e => setNewTokenSymbol(e.target.value)}
                      placeholder="Simbol (mis. DAI)"
                      style={{ width: '110px', fontSize: '12px', padding: '6px 10px', background: '#0f0f0f', border: `1px solid ${EVM_COLOR}44`, color: '#aaaaaa', fontFamily: 'monospace' }}
                    />
                    <input
                      value={newTokenAddress}
                      onChange={e => setNewTokenAddress(e.target.value)}
                      placeholder="Alamat contract 0x..."
                      style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: '#0f0f0f', border: `1px solid ${EVM_COLOR}44`, color: '#aaaaaa', fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={() => {
                        const symbol = newTokenSymbol.trim().toUpperCase();
                        const address = newTokenAddress.trim();
                        if (!symbol || !ethers.utils.isAddress(address)) {
                          setEVMMsg('❌ Isi simbol & alamat contract (0x...) yang valid dulu.');
                          setTimeout(() => setEVMMsg(''), 4000);
                          return;
                        }
                        setEVMFormData(prev => {
                          const existing = (prev.customTokens || []).filter(t => t.symbol.toUpperCase() !== symbol);
                          return { ...prev, customTokens: [...existing, { symbol, address: ethers.utils.getAddress(address) }] };
                        });
                        setNewTokenSymbol('');
                        setNewTokenAddress('');
                      }}
                      style={{ fontSize: '12px', padding: '6px 14px', background: EVM_COLOR, color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      + Tambah
                    </button>
                  </div>
                  <div style={{ fontSize: '10px', color: '#555555', marginTop: '6px' }}>
                    Setelah disimpan, sebut simbolnya di chat (mis. "Approve DAI ke 0x...", "Kirim 10 LINK ke 0x...") — Rekt otomatis pakai alamat contract dari daftar ini.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button onClick={saveEVMConfigHandler}
                    style={{ fontSize: '12px', padding: '7px 18px', background: EVM_COLOR, color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                    💾 Simpan Config
                  </button>
                  <button onClick={() => setEVMConfigEdit(false)}
                    style={{ fontSize: '12px', padding: '7px 14px', background: 'transparent', border: '1px solid #333333', color: '#666666', cursor: 'pointer' }}>
                    Batal
                  </button>
                </div>
                <div style={{ fontSize: '10px', color: '#333333', marginTop: '4px' }}>
                  🔒 Config tersimpan di localStorage browser — tidak pernah dikirim ke server manapun.
                </div>
              </div>
            </div>
          )}
          {customAbiOpen && (
            <div style={{ background: '#0d0d0d', border: '1px solid #aa66ff55', padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: '#b1b1b1', fontWeight: 'bold', marginBottom: '4px' }}>
                🔧 Mode ABI Custom
              </div>
              <div style={{ fontSize: '11px', color: '#888888', marginBottom: '10px', lineHeight: 1.5 }}>
                Panggil contract address (CA) mana pun langsung pakai ABI sendiri — berguna kalau ABI bawaan skill
                (ERC-20 standar / router Uniswap V2) tidak cocok dengan contract yang sebenarnya (nama fungsi beda,
                parameter beda, atau contract non-standar). <b>Baca</b> = gratis, tanpa gas, tanpa kirim transaksi.
                <b> Kirim Transaksi</b> = beneran sign & broadcast, butuh gas.
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button onClick={() => setCustomAbiForm(p => ({ ...p, mode: 'read' }))}
                  style={{ flex: 1, fontSize: '11px', padding: '6px', cursor: 'pointer', background: customAbiForm.mode === 'read' ? '#8c8c8c' : 'transparent', color: customAbiForm.mode === 'read' ? '#ffffff' : '#8c8c8c', border: '1px solid #8c8c8c', fontWeight: 'bold' }}>
                  👁️ Baca (view)
                </button>
                <button onClick={() => setCustomAbiForm(p => ({ ...p, mode: 'write' }))}
                  style={{ flex: 1, fontSize: '11px', padding: '6px', cursor: 'pointer', background: customAbiForm.mode === 'write' ? '#767676' : 'transparent', color: customAbiForm.mode === 'write' ? '#ffffff' : '#acacac', border: '1px solid #f4433666', fontWeight: 'bold' }}>
                  ✍️ Kirim Transaksi
                </button>
              </div>
              <input
                value={customAbiForm.contractAddress}
                onChange={e => setCustomAbiForm(p => ({ ...p, contractAddress: e.target.value }))}
                placeholder="Contract Address (0x...)"
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px', padding: '7px 10px', background: '#0f0f0f', border: '1px solid #aa66ff44', color: '#dddddd', fontFamily: 'monospace', marginBottom: '8px' }}
              />
              <textarea
                value={customAbiForm.abi}
                onChange={e => setCustomAbiForm(p => ({ ...p, abi: e.target.value }))}
                placeholder={'ABI — JSON array (export dari Etherscan) atau human-readable, 1 signature per baris. Contoh:\nfunction swap(uint256 amount, address to) returns (uint256)\nfunction getReserves() view returns (uint112, uint112, uint32)'}
                rows={4}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '7px 10px', background: '#0f0f0f', border: '1px solid #aa66ff44', color: '#dddddd', fontFamily: 'monospace', marginBottom: '8px', resize: 'vertical' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: customAbiForm.mode === 'write' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <input
                  value={customAbiForm.functionName}
                  onChange={e => setCustomAbiForm(p => ({ ...p, functionName: e.target.value }))}
                  placeholder="Nama function (mis. swap)"
                  style={{ fontSize: '12px', padding: '7px 10px', background: '#0f0f0f', border: '1px solid #aa66ff44', color: '#dddddd', fontFamily: 'monospace' }}
                />
                <input
                  value={customAbiForm.args}
                  onChange={e => setCustomAbiForm(p => ({ ...p, args: e.target.value }))}
                  placeholder='Args JSON, mis. ["100","0x..."]'
                  style={{ fontSize: '12px', padding: '7px 10px', background: '#0f0f0f', border: '1px solid #aa66ff44', color: '#dddddd', fontFamily: 'monospace' }}
                />
                {customAbiForm.mode === 'write' && (
                  <input
                    value={customAbiForm.value}
                    onChange={e => setCustomAbiForm(p => ({ ...p, value: e.target.value }))}
                    placeholder="Value ETH (opsional, mis. 0.01)"
                    style={{ fontSize: '12px', padding: '7px 10px', background: '#0f0f0f', border: '1px solid #aa66ff44', color: '#dddddd', fontFamily: 'monospace' }}
                  />
                )}
              </div>
              <button onClick={runCustomAbiCall} disabled={evmRunning}
                style={{ fontSize: '12px', padding: '8px 16px', background: customAbiForm.mode === 'write' ? '#767676' : '#8c8c8c', color: '#ffffff', border: 'none', cursor: evmRunning ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: evmRunning ? 0.6 : 1 }}>
                {evmRunning ? '⏳ Menjalankan...' : customAbiForm.mode === 'write' ? '✍️ Kirim Transaksi' : '👁️ Baca Contract'}
              </button>
            </div>
          )}
          {/* Quick EVM Actions */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#444444', marginBottom: '6px' }}>⚡ Quick Actions:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {EVM_QUICK_PROMPTS.map(p => (
                <button key={p.text} onClick={() => { setShowEVMPanel(false); sendMessage(p.text); }} disabled={isLoading || evmRunning}
                  style={{ fontSize: '12px', padding: '5px 10px', background: '#111111', border: `1px solid ${EVM_COLOR}33`, color: '#898989', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: (isLoading || evmRunning) ? 0.5 : 1 }}>
                  {p.icon} {p.text}
                </button>
              ))}
            </div>
          </div>
          {/* Task Logs */}
          {evmLogs.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#444444' }}>📋 Task Log ({evmLogs.length}):</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(evmLogs, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `evm-task-log-${Date.now()}.json`; a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{ fontSize: '10px', padding: '2px 8px', background: 'transparent', border: `1px solid ${EVM_COLOR}`, color: EVM_COLOR, cursor: 'pointer' }}>⬇️ Export</button>
                  <button onClick={() => setEVMLogs([])} style={{ fontSize: '10px', padding: '2px 8px', background: 'transparent', border: '1px solid #333333', color: '#555555', cursor: 'pointer' }}>Clear</button>
                </div>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {evmLogs.map(log => (
                  <div key={log.id} style={{ background: '#0c0c0c', border: `1px solid ${log.status === 'success' ? '#4caf5022' : log.status === 'error' ? '#f4433622' : `${EVM_COLOR}22`}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', padding: '1px 7px', background: log.status === 'success' ? '#161616' : log.status === 'error' ? '#0f0f0f' : '#0c0c0c', border: `1px solid ${log.status === 'success' ? '#878787' : log.status === 'error' ? '#767676' : EVM_COLOR}`, color: log.status === 'success' ? '#878787' : log.status === 'error' ? '#acacac' : EVM_COLOR, fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {log.status === 'running' ? <FaSpinner size={9} style={{ animation: 'spin 1s linear infinite' }} /> : log.status === 'success' ? '✅' : '❌'} {log.status}
                    </span>
                    <span style={{ fontSize: '12px', color: EVM_COLOR, fontWeight: 'bold' }}>{log.skill}</span>
                    <span style={{ fontSize: '11px', color: '#555555' }}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</span>
                    {log.txHash && (
                      evmConfig.explorerUrl ? (
                        <a href={`${evmConfig.explorerUrl.replace(/\/$/, '')}/tx/${log.txHash}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: '10px', color: EVM_COLOR, fontFamily: 'monospace', textDecoration: 'none', borderBottom: `1px dotted ${EVM_COLOR}` }}>
                          tx: {log.txHash.slice(0, 12)}... ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: '10px', color: '#7a7a7a', fontFamily: 'monospace' }}>tx: {log.txHash.slice(0, 12)}...</span>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {evmLogs.length === 0 && !evmConfigEdit && (
            <div style={{ textAlign: 'center', padding: '16px', color: '#333333', fontSize: '12px' }}>
              Belum ada task yang dijalankan. Ketik perintah seperti:<br/>
              <span style={{ color: EVM_COLOR }}>_"Cek saldo wallet EVM"_</span> atau <span style={{ color: EVM_COLOR }}>_"Swap 0.001 ETH ke USDC"_</span>
            </div>
          )}
        </div>
      )}
      {showChainPanel && (
        <div style={{ background: '#0f0f0f', border: `1px solid ${MULTI_CHAIN_COLOR}`, borderLeft: `4px solid ${MULTI_CHAIN_COLOR}`, padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaGlobe size={18} color={MULTI_CHAIN_COLOR} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: MULTI_CHAIN_COLOR }}>Multi-Chain Agent — Non-EVM Skills</div>
                <div style={{ fontSize: '11px', color: '#555555' }}>
                  {CHAIN_KEYS.filter(c => multiChainConfig[c]?.privateKey).length} / {CHAIN_KEYS.length} chain configured
                  {' · '}{chainLogs.length} task log
                  {' · '}{multiChainConfig.autopilotEnabled ? '🟢 Autopilot ON' : '🔴 Autopilot OFF'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => {
                  const merged = { ...multiChainConfig, autopilotEnabled: !multiChainConfig.autopilotEnabled };
                  setMultiChainConfig(merged);
                  saveMultiChainConfig(merged);
                }}
                title={multiChainConfig.autopilotEnabled ? 'AI boleh auto-eksekusi PaymentSkill di bawah threshold tanpa klik' : 'Aktifkan autopilot aksi kecil/rutin'}
                style={{ fontSize: '11px', padding: '5px 12px', background: multiChainConfig.autopilotEnabled ? '#1c1c1c' : '#0e0e0e', border: `1px solid ${multiChainConfig.autopilotEnabled ? MULTI_CHAIN_COLOR : '#555555'}`, color: multiChainConfig.autopilotEnabled ? MULTI_CHAIN_COLOR : '#888888', cursor: 'pointer', fontWeight: multiChainConfig.autopilotEnabled ? 700 : 400 }}>
                {multiChainConfig.autopilotEnabled ? '🤖 AUTOPILOT ON' : '🤖 AUTOPILOT OFF'}
              </button>
              <button onClick={() => { setMultiChainConfigEdit(p => !p); setMultiChainFormData(multiChainConfig); }}
                style={{ fontSize: '11px', padding: '5px 12px', background: multiChainConfigEdit ? '#141414' : '#0e0e0e', border: `1px solid ${MULTI_CHAIN_COLOR}`, color: MULTI_CHAIN_COLOR, cursor: 'pointer' }}>
                {multiChainConfigEdit ? '✕ Tutup Config' : '⚙️ Config'}
              </button>
            </div>
          </div>
          {chainMsg && (
            <div style={{ padding: '7px 12px', background: chainMsg.startsWith('✅') ? '#161616' : '#0f0f0f', border: `1px solid ${chainMsg.startsWith('✅') ? MULTI_CHAIN_COLOR : '#767676'}`, color: chainMsg.startsWith('✅') ? MULTI_CHAIN_COLOR : '#acacac', fontSize: '12px', marginBottom: '12px' }}>
              {chainMsg}
            </div>
          )}
          <div style={{ padding: '8px 12px', background: '#111111', border: `1px solid ${multiChainConfig.autopilotEnabled ? MULTI_CHAIN_COLOR + '55' : '#222222'}`, color: multiChainConfig.autopilotEnabled ? '#b6b6b6' : '#777777', fontSize: '11px', marginBottom: '12px' }}>
            {multiChainConfig.autopilotEnabled
              ? <>🤖 <b>Autopilot aktif.</b> PaymentSkill dengan jumlah ≤ threshold per-chain (lihat Config) langsung dieksekusi tanpa klik. Nominal di atas threshold tetap wajib diklik manual. BalanceSkill (cek saldo) selalu otomatis karena read-only.</>
              : <>🤖 <b>Autopilot mati.</b> Semua PaymentSkill lintas-chain wajib diklik manual dulu sebelum terkirim.</>}
            <div style={{ marginTop: '4px', color: '#666666' }}>Private key tidak pernah dikirim ke AI/OpenCode; signing selalu lokal di browser, sama seperti EVM Agent.</div>
          </div>
          {multiChainConfigEdit && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: MULTI_CHAIN_COLOR, marginBottom: '10px' }}>⚙️ Konfigurasi Multi-Chain Agent</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {CHAIN_KEYS.map(c => {
                  const meta = CHAIN_META[c];
                  const chainForm = multiChainFormData[c] || { privateKey: '', networkId: meta.networks[0].id };
                  const addr = multiChainAddresses[c];
                  return (
                    <div key={c} style={{ background: '#0c0c0c', border: `1px solid ${meta.color}33`, borderLeft: `3px solid ${meta.color}`, padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: meta.color }}>{meta.label} ({meta.symbol})</span>
                        <select
                          value={chainForm.networkId || meta.networks[0].id}
                          onChange={e => setMultiChainFormData(p => ({ ...p, [c]: { ...(p[c] || { privateKey: '' }), networkId: e.target.value } }))}
                          style={{ fontSize: '11px', padding: '4px 6px', background: '#0f0f0f', border: `1px solid ${meta.color}44`, color: '#ccc' }}>
                          {meta.networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                        </select>
                      </div>
                      <input
                        type="password"
                        value={chainForm.privateKey || ''}
                        onChange={e => setMultiChainFormData(p => ({ ...p, [c]: { ...(p[c] || { networkId: meta.networks[0].id }), privateKey: e.target.value } }))}
                        placeholder={`Private Key ${meta.label} (hasil dari WalletGen)`}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px', padding: '7px 10px', background: '#0f0f0f', border: `1px solid ${meta.color}44`, color: '#dddddd', fontFamily: 'monospace', marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', color: '#555555' }}>
                          Address: {addr ? <code style={{ color: '#aaaaaa' }}>{addr.slice(0, 10)}…{addr.slice(-6)}</code> : <span style={{ color: '#444' }}>belum valid</span>}
                        </span>
                        <span style={{ fontSize: '10px', color: '#555555', marginLeft: 'auto' }}>Autopilot threshold:</span>
                        <input
                          type="number" step="any" min="0"
                          value={String((multiChainFormData.thresholds || {})[c] ?? '')}
                          onChange={e => setMultiChainFormData(p => ({ ...p, thresholds: { ...p.thresholds, [c]: parseFloat(e.target.value) || 0 } }))}
                          placeholder="0"
                          style={{ width: '80px', fontSize: '11px', padding: '4px 6px', background: '#0f0f0f', border: `1px solid ${meta.color}44`, color: '#ccc' }}
                        />
                        <span style={{ fontSize: '10px', color: '#555555' }}>{meta.symbol}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={saveMultiChainConfigHandler}
                style={{ marginTop: '12px', fontSize: '12px', padding: '8px 16px', background: MULTI_CHAIN_COLOR, color: '#000000', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                <FaCheckCircle style={{ marginRight: '6px' }} /> Simpan Config
              </button>
            </div>
          )}
          {chainLogs.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#444444' }}>📋 Task Log ({chainLogs.length}):</div>
                <button onClick={() => setChainLogs([])} style={{ fontSize: '10px', padding: '2px 8px', background: 'transparent', border: '1px solid #333333', color: '#555555', cursor: 'pointer' }}>Clear</button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {chainLogs.map(log => {
                  const meta = CHAIN_META[log.chain];
                  const txLink = log.txHash ? explorerTxUrl(log.chain, multiChainConfig[log.chain]?.networkId, log.txHash) : '';
                  return (
                    <div key={log.id} style={{ background: '#0c0c0c', border: `1px solid ${log.status === 'success' ? '#4caf5022' : log.status === 'error' ? '#f4433622' : `${meta.color}22`}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', padding: '1px 7px', background: log.status === 'success' ? '#161616' : log.status === 'error' ? '#0f0f0f' : '#0c0c0c', border: `1px solid ${log.status === 'success' ? MULTI_CHAIN_COLOR : log.status === 'error' ? '#767676' : meta.color}`, color: log.status === 'success' ? MULTI_CHAIN_COLOR : log.status === 'error' ? '#acacac' : meta.color, fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {log.status === 'running' ? <FaSpinner size={9} style={{ animation: 'spin 1s linear infinite' }} /> : log.status === 'success' ? '✅' : '❌'} {log.status}
                      </span>
                      <span style={{ fontSize: '12px', color: meta.color, fontWeight: 'bold' }}>{meta.label} · {log.skill}</span>
                      <span style={{ fontSize: '11px', color: '#555555' }}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</span>
                      {log.txHash && (
                        txLink ? (
                          <a href={txLink} target="_blank" rel="noreferrer"
                            style={{ fontSize: '10px', color: meta.color, fontFamily: 'monospace', textDecoration: 'none', borderBottom: `1px dotted ${meta.color}` }}>
                            tx: {log.txHash.slice(0, 12)}... ↗
                          </a>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#7a7a7a', fontFamily: 'monospace' }}>tx: {log.txHash.slice(0, 12)}...</span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {chainLogs.length === 0 && !multiChainConfigEdit && (
            <div style={{ textAlign: 'center', padding: '16px', color: '#333333', fontSize: '12px' }}>
              Belum ada task yang dijalankan. Isi Private Key dulu di ⚙️ Config, lalu coba:<br/>
              <span style={{ color: MULTI_CHAIN_COLOR }}>_"Cek saldo SOL"_</span> atau <span style={{ color: MULTI_CHAIN_COLOR }}>_"Kirim 0.01 SUI ke ..."_</span>
            </div>
          )}
        </div>
      )}
      {showWalletDashboard && (
        <div style={{ background: '#0f0f0f', border: `1px solid ${EVM_COLOR}`, borderLeft: `4px solid ${EVM_COLOR}`, padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <FaWallet size={18} color={EVM_COLOR} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: EVM_COLOR }}>Multi-Wallet Dashboard</div>
                <div style={{ fontSize: '10px', color: '#888888', marginTop: '2px', maxWidth: '620px' }}>
                  Pantau saldo banyak alamat EVM sekaligus (gak harus punya private key-nya — cukup alamatnya aja) dalam satu tampilan, plus cek aktivitas on-chain read-only. 100% baca-saja, gak pernah minta/nyimpen private key di sini.
                </div>
              </div>
            </div>
            {watchWallets.length > 0 && (
              <button onClick={refreshAllWalletBalances}
                style={{ fontSize: '11px', padding: '5px 12px', background: '#141414', border: `1px solid ${EVM_COLOR}`, color: EVM_COLOR, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FaSyncAlt size={10} /> Refresh Semua
              </button>
            )}
          </div>
          {/* ── Form tambah wallet yang dipantau ── */}
          <div style={{ background: '#0c0c0c', border: `1px solid ${EVM_COLOR}33`, padding: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <input value={newWalletLabel} onChange={e => setNewWalletLabel(e.target.value)} placeholder="Label (mis. Wallet Utama, Wallet Testnet A)"
                style={{ flex: '1 1 200px', background: '#000000', border: `1px solid ${EVM_COLOR}55`, color: '#ffffff', padding: '6px 8px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
              <input value={newWalletAddress} onChange={e => setNewWalletAddress(e.target.value)} placeholder="0x... alamat EVM"
                style={{ flex: '2 1 260px', background: '#000000', border: `1px solid ${EVM_COLOR}55`, color: '#ffffff', padding: '6px 8px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
              <select value={newWalletChain} onChange={e => setNewWalletChain(e.target.value)}
                style={{ flex: '1 1 140px', background: '#000000', border: `1px solid ${EVM_COLOR}55`, color: '#ffffff', padding: '6px 8px', fontSize: '11px', fontFamily: "'Courier New', monospace" }}>
                {Object.entries(EVM_CHAIN_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.networkName}</option>)}
              </select>
              <button onClick={addWatchWallet}
                style={{ fontSize: '11px', padding: '6px 14px', background: '#141414', border: `1px solid ${EVM_COLOR}`, color: EVM_COLOR, cursor: 'pointer' }}>
                + Tambah
              </button>
            </div>
            <button onClick={addCurrentEvmWalletToWatch}
              style={{ fontSize: '10px', padding: '4px 10px', background: 'transparent', border: `1px solid #333333`, color: '#888888', cursor: 'pointer' }}>
              ⛓️ Tambah wallet EVM Agent yang lagi aktif
            </button>
          </div>
          {/* ── Explorer API key (opsional, dipakai buat activity checker) ── */}
          <div style={{ marginBottom: '14px' }}>
            <input value={explorerApiKey} onChange={e => persistExplorerApiKey(e.target.value)} placeholder="Explorer API Key (opsional — Etherscan V2, buat cek aktivitas kontrak lebih lengkap)"
              style={{ width: '100%', boxSizing: 'border-box', background: '#000000', border: `1px solid #333333`, color: '#ffffff', padding: '6px 8px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
            <div style={{ fontSize: '9px', color: '#555555', marginTop: '4px' }}>
              Kosongin buat tetap bisa cek aktivitas — cuma turun mode ke RPC-only (nonce & status contract tetap akurat, tapi cek interaksi kontrak spesifik dibatasi ~30rb blok terakhir). Isi 1 API key dari <a href="https://etherscan.io/apis" target="_blank" rel="noreferrer" style={{ color: '#888888' }}>etherscan.io/apis</a> — otomatis kepakai buat SEMUA chain di daftar lewat Etherscan V2 (satu key, banyak chain), kecuali Kryvora Testnet (bukan explorer Etherscan-compatible).
            </div>
          </div>
          {/* ── Daftar wallet + saldo agregat ── */}
          {watchWallets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: '#333333', fontSize: '12px' }}>
              Belum ada wallet yang dipantau. Tambahkan alamat di form atas buat mulai lihat dashboard saldo agregatnya.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {watchWallets.map(wallet => {
                const bal = walletBalances[wallet.id];
                const act = activityResults[wallet.id];
                const preset = EVM_CHAIN_PRESETS[wallet.chainKey];
                const expanded = expandedActivityWalletId === wallet.id;
                return (
                  <div key={wallet.id} style={{ background: '#0a0a0a', border: `1px solid ${EVM_COLOR}33`, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#dddddd' }}>
                          {wallet.label} <span style={{ fontSize: '9px', padding: '1px 6px', background: '#141414', color: EVM_COLOR, border: `1px solid ${EVM_COLOR}55`, marginLeft: '4px' }}>{preset?.networkName || wallet.chainKey}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#666666', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code>{wallet.address.slice(0, 10)}…{wallet.address.slice(-8)}</code>
                          {preset?.explorerUrl && <a href={`${preset.explorerUrl}/address/${wallet.address}`} target="_blank" rel="noreferrer" style={{ color: EVM_COLOR, textDecoration: 'none' }}>Explorer ↗</a>}
                        </div>
                        <div style={{ fontSize: '13px', color: '#ffffff', marginTop: '6px' }}>
                          {bal?.loading && <span style={{ color: '#888888', display: 'flex', alignItems: 'center', gap: '5px' }}><FaSpinner size={10} style={{ animation: 'spin 1s linear infinite' }} /> Mengambil saldo...</span>}
                          {bal?.error && <span style={{ color: '#acacac', fontSize: '11px' }}>⚠️ {bal.error}</span>}
                          {bal && !bal.loading && !bal.error && (
                            <>
                              <b>{Number(bal.native).toLocaleString('id-ID', { maximumFractionDigits: 6 })} {bal.symbol}</b>
                              {(bal.tokens || []).filter(t => Number(t.amount) > 0).map(t => (
                                <span key={t.symbol} style={{ marginLeft: '10px', fontSize: '11px', color: '#aaaaaa' }}>· {Number(t.amount).toLocaleString('id-ID', { maximumFractionDigits: 4 })} {t.symbol}</span>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => refreshWalletBalance(wallet)} title="Refresh saldo"
                          style={{ fontSize: '10px', padding: '4px 8px', background: 'transparent', border: '1px solid #333333', color: '#888888', cursor: 'pointer' }}>
                          <FaSyncAlt size={10} />
                        </button>
                        <button onClick={() => setExpandedActivityWalletId(expanded ? null : wallet.id)}
                          style={{ fontSize: '10px', padding: '4px 8px', background: expanded ? '#141414' : 'transparent', border: `1px solid ${expanded ? EVM_COLOR : '#333333'}`, color: expanded ? EVM_COLOR : '#888888', cursor: 'pointer' }}>
                          🔎 Aktivitas
                        </button>
                        <button onClick={() => removeWatchWallet(wallet.id)} title="Hapus dari daftar pantau"
                          style={{ fontSize: '10px', padding: '4px 8px', background: 'transparent', border: '1px solid #333333', color: '#666666', cursor: 'pointer' }}>
                          <FaTrash size={10} />
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #1a1a1a' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <input value={activityContractInput[wallet.id] || ''} onChange={e => setActivityContractInput(prev => ({ ...prev, [wallet.id]: e.target.value }))}
                            placeholder="Alamat kontrak (opsional) — cek pernah interaksi/enggak"
                            style={{ flex: '1 1 260px', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 8px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
                          <button onClick={() => checkWalletActivity(wallet)}
                            style={{ fontSize: '11px', padding: '5px 12px', background: '#141414', border: `1px solid ${EVM_COLOR}`, color: EVM_COLOR, cursor: 'pointer' }}>
                            Cek Aktivitas
                          </button>
                        </div>
                        {act?.loading && <div style={{ fontSize: '11px', color: '#888888', display: 'flex', alignItems: 'center', gap: '5px' }}><FaSpinner size={10} style={{ animation: 'spin 1s linear infinite' }} /> Menganalisis on-chain...</div>}
                        {act?.error && <div style={{ fontSize: '11px', color: '#acacac' }}>⚠️ {act.error}</div>}
                        {act && !act.loading && !act.error && (
                          <div style={{ fontSize: '11px', color: '#cccccc', lineHeight: 1.7 }}>
                            · Total tx terkirim dari wallet ini (nonce): <b>{act.nonce}</b><br />
                            · Tipe alamat: <b>{act.isContract ? 'Smart contract' : 'Wallet biasa (EOA)'}</b><br />
                            {act.contractTxCount != null && <>· Interaksi ke kontrak yang diisi: <b>{act.contractTxCount}x</b>{act.firstTx && <> (pertama {act.firstTx}, terakhir {act.lastTx})</>}<br /></>}
                            {act.totalTxFromApi != null && <>· Total tx dari explorer API: <b>{act.totalTxFromApi}</b><br /></>}
                            {act.note && <span style={{ color: '#666666', fontSize: '10px' }}>ℹ️ {act.note}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {showAgentTeamPanel && (
        <div style={{ background: '#090909', border: `1px solid ${AGENT_COLOR}`, borderLeft: `4px solid ${AGENT_COLOR}`, padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🤖</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: AGENT_COLOR }}>Tim AI Agent — Multi-Profesi</div>
                <div style={{ fontSize: '11px', color: '#555555' }}>
                  {agentTeam.length}/{MAX_AGENTS} agent · {agentTeam.filter(a => a.active).length} aktif · {agentTeamLogs.length} log
                </div>
              </div>
            </div>
            <button onClick={() => setShowAddAgentForm(p => !p)} disabled={agentTeam.length >= MAX_AGENTS}
              style={{ fontSize: '11px', padding: '5px 12px', background: '#121212', border: `1px solid ${AGENT_COLOR}`, color: AGENT_COLOR, cursor: agentTeam.length >= MAX_AGENTS ? 'not-allowed' : 'pointer', opacity: agentTeam.length >= MAX_AGENTS ? 0.5 : 1 }}>
              {showAddAgentForm ? '✕ Tutup' : '+ Tambah Agent'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#888888', marginBottom: '12px', lineHeight: '1.6' }}>
            Tiap agent kerja <b>sendiri di background</b> sesuai profesinya, tanpa perlu kamu chat/klik satu-satu — mirip Autopilot, tapi bisa sampai {MAX_AGENTS} agent sekaligus dengan tugas berbeda-beda.
            </div>
          {showAddAgentForm && (
            <div style={{ padding: '10px 12px', background: '#121212', border: '1px solid #303030', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 160px' }}>
                <div style={{ fontSize: '10px', color: '#888888', marginBottom: '4px' }}>Nama agent (opsional)</div>
                <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} placeholder="mis. Rekt-Scout-01"
                  style={{ width: '100%', boxSizing: 'border-box', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '7px 9px', fontSize: '12px', fontFamily: "'Courier New', monospace" }} />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontSize: '10px', color: '#888888', marginBottom: '4px' }}>Profesi</div>
                <select value={newAgentProfession} onChange={e => setNewAgentProfession(e.target.value as AgentProfession)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '7px 9px', fontSize: '12px', fontFamily: "'Courier New', monospace" }}>
                  {(Object.keys(AGENT_PROFESSION_META) as AgentProfession[]).map(k => (
                    <option key={k} value={k}>{AGENT_PROFESSION_META[k].icon} {AGENT_PROFESSION_META[k].label}{AGENT_PROFESSION_META[k].beta ? ' (BETA)' : ''}</option>
                  ))}
                </select>
              </div>
              <button onClick={addAgent} style={{ fontSize: '12px', padding: '8px 16px', background: AGENT_COLOR, border: 'none', color: '#000000', fontWeight: 'bold', cursor: 'pointer' }}>
                ▶ Rekrut Agent
              </button>
            </div>
          )}
          {agentTeam.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#555555', fontSize: '13px' }}>Belum ada agent. Klik "+ Tambah Agent" buat mulai rekrut tim.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {agentTeam.map(agent => {
                const meta = AGENT_PROFESSION_META[agent.profession];
                return (
                  <div key={agent.id} style={{ background: '#0e0e0e', border: `1px solid ${agent.active ? '#303030' : '#222222'}`, padding: '10px 12px', opacity: agent.active ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: AGENT_COLOR, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {meta.icon} {agent.name}
                          <span style={{ fontSize: '9px', padding: '1px 6px', background: '#121212', color: '#b3b3b3', border: '1px solid #333333' }}>{meta.label}</span>
                          {runningAgentIds.has(agent.id) && (
                            <span style={{ fontSize: '9px', padding: '1px 7px', background: '#121212', color: AGENT_COLOR, border: `1px solid ${AGENT_COLOR}`, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: AGENT_COLOR, display: 'inline-block', animation: 'pulse-dot 0.9s ease-in-out infinite' }} />
                              JALAN
                            </span>
                          )}
                          {meta.beta && (
                            <span title="Fitur baru diupgrade & belum battle-tested lama — REAL-nya (proxy CORS, ekstraksi deadline, skor engagement) masih tahap awal, sedia cek log kalau ada yang aneh." style={{ fontSize: '9px', padding: '1px 6px', background: '#1c1c1c', color: '#c0c0c0', border: '1px solid #3f3f3f', fontWeight: 'bold', letterSpacing: '0.5px' }}>BETA</span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666666', marginTop: '4px' }}>{meta.desc}</div>
                        {meta.beta && (
                          <div style={{ fontSize: '9px', color: '#c0c0c0', marginTop: '4px', background: '#0f0f0f', border: '1px solid #292929', padding: '4px 6px' }}>
                            ⚠️ Mode BETA — jalur REAL agent ini (paginasi since_id/offset, ekstraksi deadline dari teks, skor poin dari engagement, proxy CORS) baru aja diupgrade & belum diuji lama di produksi. Cek log agent secara berkala buat mastiin hasilnya sesuai ekspektasi, terutama kalau lagi diandalkan buat garapan dengan deadline ketat.
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#555555', marginTop: '5px' }}>
                          Interval {agent.intervalSec}s · Jalan {agent.runCount}x · Sukses {agent.runCount > 0 ? Math.round((agent.successCount / agent.runCount) * 100) : 0}%
                          {agent.lastRunAt && <> · Terakhir {new Date(agent.lastRunAt).toLocaleTimeString('id-ID')}</>}
                        </div>
                        {(agent.profession === 'admin_telegram' || agent.profession === 'deadline_guard' || agent.profession === 'scout_telegram' || agent.profession === 'reminder_wl') && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                            <input value={agent.tgBotToken || ''} onChange={e => updateAgentField(agent.id, { tgBotToken: e.target.value })} placeholder="Telegram Bot Token"
                              style={{ flex: '1 1 140px', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 7px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
                            <input value={agent.tgChatId || ''} onChange={e => updateAgentField(agent.id, { tgChatId: e.target.value })} placeholder={agent.profession === 'scout_telegram' ? 'Chat/Group ID SUMBER (opsional, boleh > 1 dipisah koma)' : agent.profession === 'reminder_wl' ? 'Chat/Group ID (opsional)' : 'Chat/Group ID'}
                              style={{ flex: '1 1 100px', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 7px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
                            {agent.profession === 'scout_telegram' && (
                              <input value={agent.tgNotifyChatId || ''} onChange={e => updateAgentField(agent.id, { tgNotifyChatId: e.target.value })} placeholder="Chat ID NOTIFIKASI kamu (opsional)"
                                style={{ flex: '1 1 100px', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 7px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
                            )}
                          </div>
                        )}
                        {agent.profession === 'scout_telegram' && (
                          <div style={{ marginTop: '6px' }}>
                            <input value={agent.tgTargetChannels || ''} onChange={e => updateAgentField(agent.id, { tgTargetChannels: e.target.value })} placeholder="ATAU: channel/grup target TANPA admin — @username dipisah koma (mode akun pribadi)"
                              style={{ width: '100%', boxSizing: 'border-box', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 7px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
                          </div>
                        )}
                        {agent.profession === 'reminder_wl' && (
                          <div style={{ fontSize: '9px', color: '#555555', marginTop: '4px' }}>
                            Bot Token/Chat ID di atas SEPENUHNYA OPSIONAL — reminder utamanya selalu langsung muncul sebagai pesan di chat Rekt, gak butuh setting apa pun. Isi Bot Token + Chat ID cuma kalau mau reminder-nya JUGA nyampe ke Telegram (misalnya buat notifikasi di HP). Riset "udah mulai belum"-nya 100% pakai OpenCode AI (server `opencode serve` yang sama dengan chat Rekt) — kalau server itu offline, garapan tetap di Waitlist & dicek lagi nanti, gak fallback ke Claude API.
                          </div>
                        )}
                        {agent.profession === 'scout_telegram' && (
                          <div style={{ fontSize: '9px', color: '#555555', marginTop: '4px' }}>
                            <b>2 mode, pilih salah satu (atau kosongin dua-duanya buat simulasi pool referensi):</b>
                            <br />① <b>Bot Token</b> — buat grup/channel yang KAMU kontrol: bot HARUS jadi anggota/admin (channel post cuma kebaca kalau bot jadi admin channel), dan privacy mode bot di-disable lewat @BotFather biar bisa baca pesan grup biasa. Chat/Group ID SUMBER boleh diisi lebih dari satu (pisah koma), atau kosongin buat baca semua chat si bot.
                            <br />② <b>Channel/grup target (akun pribadi)</b> — buat channel/grup ORANG LAIN yang gak mungkin kamu jadiin admin: isi @username-nya (pisah koma kalau lebih dari satu), lalu login akun Telegram pribadi kamu di Settings → Social Research (sekali aja). Kalau channel-nya PUBLIK, kamu bahkan gak perlu join — cukup usernamenya. Kalau grup/channel PRIVAT, pastiin kamu udah join duluan lewat invite link, baru masukin nama persis chat-nya di sini.
                            <br />Deadline & poin diambil dari isi pesan asli, sampai {MAX_SCOUT_CANDIDATES_PER_RUN} kandidat diproses tiap putaran.
                            <br />🔔 Begitu ada yang share garapan baru (mode mana pun), notifikasi langsung muncul otomatis di chat Rekt ini (gak perlu setting apa pun). Isi "Chat ID NOTIFIKASI kamu" (ID chat pribadi kamu dengan bot, BUKAN Chat/Group ID sumber di atas) kalau mau notifnya JUGA nyampe ke Telegram/HP kamu.
                          </div>
                        )}
                        {agent.profession === 'scout_x' && (
                          <div style={{ marginTop: '6px' }}>
                            <input value={agent.xBearerToken || ''} onChange={e => updateAgentField(agent.id, { xBearerToken: e.target.value })} placeholder="Bearer Token API X (v2)"
                              style={{ width: '100%', boxSizing: 'border-box', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 7px', fontSize: '11px', fontFamily: "'Courier New', monospace", marginBottom: '6px' }} />
                            <input value={agent.xQuery || ''} onChange={e => updateAgentField(agent.id, { xQuery: e.target.value })} placeholder="Query pencarian (kosongkan buat default)"
                              style={{ width: '100%', boxSizing: 'border-box', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 7px', fontSize: '11px', fontFamily: "'Courier New', monospace", marginBottom: '6px' }} />
                            <input value={agent.xProxyUrl || ''} onChange={e => updateAgentField(agent.id, { xProxyUrl: e.target.value })} placeholder="Proxy CORS (opsional, mis. https://proxy-kamu.com/?url=)"
                              style={{ width: '100%', boxSizing: 'border-box', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 7px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
                            <div style={{ fontSize: '9px', color: '#555555', marginTop: '4px' }}>
                              Mode REAL nyoba beneran manggil X API v2 pakai Bearer Token ini. Jujur: X biasanya TIDAK ngizinin request langsung dari browser (CORS) — kalau gagal karena itu, isi "Proxy CORS" dengan layanan proxy yang KAMU percaya (URL target ditempel terenkode di belakangnya). Sekarang poin diestimasi dari like/retweet/reply tweet asli (bukan 40 flat), deadline diambil dari isi tweet, dipaginasi pakai since_id biar gak baca ulang tweet lama, dan sampai {MAX_SCOUT_CANDIDATES_PER_RUN} kandidat diproses tiap putaran. Kosongin Bearer Token buat tetap pakai mode simulasi pool referensi.
                            </div>
                          </div>
                        )}
                        {agent.profession === 'onchain_executor' && (
                          <div style={{ marginTop: '6px' }}>
                            <input value={agent.evmSkill || 'BalanceSkill'} onChange={e => updateAgentField(agent.id, { evmSkill: e.target.value })} placeholder="Nama skill EVM (mis. BalanceSkill)"
                              style={{ width: '100%', boxSizing: 'border-box', background: '#000000', border: '1px solid #333333', color: '#ffffff', padding: '5px 7px', fontSize: '11px', fontFamily: "'Courier New', monospace" }} />
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        <button onClick={() => toggleAgentActive(agent.id)} title={agent.active ? 'Nonaktifkan' : 'Aktifkan'}
                          style={{ fontSize: '10px', padding: '4px 8px', background: 'transparent', border: `1px solid ${agent.active ? '#878787' : '#555555'}`, color: agent.active ? '#878787' : '#777777', cursor: 'pointer' }}>
                          {agent.active ? 'ON' : 'OFF'}
                        </button>
                        <button onClick={() => removeAgent(agent.id)} title="Berhentikan agent"
                          style={{ fontSize: '10px', padding: '4px 8px', background: 'transparent', border: '1px solid #767676', color: '#767676', cursor: 'pointer' }}>
                          <FaTrash size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {agentTeamLogs.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: '#888888', marginBottom: '6px' }}>📋 Log aktivitas agent (terbaru dulu):</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '220px', overflowY: 'auto' }}>
                {agentTeamLogs.slice(0, 40).map(log => (
                  <div key={log.id} style={{ fontSize: '11px', padding: '6px 9px', background: '#0e0e0e', borderLeft: `3px solid ${log.status === 'success' ? '#878787' : log.status === 'error' ? '#767676' : AGENT_COLOR}`, color: '#aaaaaa' }}>
                    <span style={{ color: '#555555' }}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</span>{' · '}
                    <span style={{ color: AGENT_COLOR }}>{AGENT_PROFESSION_META[log.profession].icon} {log.agentName}</span>{' — '}
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#555555', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FaLightbulb color="#bbbbbb" size={10} /> Pertanyaan cepat:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p.text} onClick={() => sendMessage(p.text)} disabled={isLoading}
              style={{ fontSize: '12px', padding: '5px 10px', background: '#111111', border: '1px solid #2a2a2a', color: '#aaaaaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: isLoading ? 0.5 : 1 }}>
              {p.icon} {p.text}
            </button>
          ))}
        </div>
      </div>
      {(() => {
        const pendingTasks = getPendingTasks();
        const totalOngoing = (() => { try { return (JSON.parse(localStorage.getItem('airdropTasks')||'[]') as Task[]).filter(t=>t.status==='Ongoing').length; } catch { return 0; } })();
        return (
          <div style={{ marginBottom: '12px' }}>
            <button onClick={() => setShowGarapPanel(p => !p)}
              style={{ width: '100%', fontSize: '13px', padding: '10px 16px', background: showGarapPanel ? '#151515' : '#131313', border: `1px solid ${showGarapPanel ? '#878787' : '#2e2e2e'}`, borderLeft: '4px solid #878787', color: '#878787', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
              <span style={{ fontSize: '18px' }}>🚀</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>Mode Garap Airdrop</div>
                <div style={{ fontSize: '11px', color: '#464646' }}>{pendingTasks.length} belum dikerjakan · {totalOngoing} total ongoing</div>
              </div>
              {pendingTasks.length > 0 && <span style={{ background: '#767676', color: '#ffffff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>{pendingTasks.length}</span>}
              {showGarapPanel ? <FaChevronUp color="#878787" size={12} /> : <FaChevronDown color="#878787" size={12} />}
            </button>
            {showGarapPanel && (
              <div style={{ background: '#0c0c0c', border: '1px solid #2e2e2e', borderTop: 'none', padding: '12px' }}>
                {pendingTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#878787', fontSize: '13px' }}>✅ Semua airdrop sudah dikerjakan hari ini!</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#5d5d5d', marginBottom: '10px' }}>
                      <span>Klik "Garap" untuk panduan step-by-step:</span>
                      <button onClick={() => sendMessage('Garapin semua airdrop yang belum selesai hari ini satu per satu')} disabled={isLoading}
                        style={{ fontSize: '11px', padding: '4px 10px', background: '#1e1e1e', border: '1px solid #878787', color: '#878787', cursor: 'pointer' }}>⚡ Garap Semua</button>
                    </div>
                    <div style={{ background: '#0a0a0a', border: '1px solid #333333', padding: '10px 12px', marginBottom: '10px', display: 'flex', gap: '6px' }}>
                      <input value={researchInput} onChange={e => setResearchInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && researchInput.trim() && !isLoading) { sendMessage(`Riset proyek "${researchInput.trim()}" lengkap dari X/Telegram/dokumentasi resmi, terus tawarin buat ditambah ke garapan kalau relevan`); setResearchInput(''); } }}
                        placeholder="🔎 Nama project buat diriset (X/Telegram/dll)..."
                        style={{ flex: 1, fontSize: '12px', padding: '7px 10px', background: '#111111', border: '1px solid #333333', color: '#dddddd' }} />
                      <button onClick={() => { if (researchInput.trim() && !isLoading) { sendMessage(`Riset proyek "${researchInput.trim()}" lengkap dari X/Telegram/dokumentasi resmi, terus tawarin buat ditambah ke garapan kalau relevan`); setResearchInput(''); } }} disabled={isLoading || !researchInput.trim()}
                        style={{ fontSize: '11px', padding: '7px 12px', background: '#111111', border: '1px solid #7a7a7a', color: '#7a7a7a', cursor: 'pointer', opacity: (isLoading || !researchInput.trim()) ? 0.5 : 1 }}>Riset</button>
                    </div>
                    <div style={{ background: '#0a0a0a', border: `1px solid ${EVOLUTION_COLOR}44`, padding: '10px 12px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '11px', color: EVOLUTION_COLOR, fontWeight: 'bold' }}>🧬 Autopilot — Rekt kerjain semua garapan sendiri</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setAutopilotSandbox(true)} disabled={autopilotRunning}
                            style={{ fontSize: '10px', padding: '4px 9px', background: autopilotSandbox ? '#101010' : 'transparent', border: `1px solid ${autopilotSandbox ? EVOLUTION_COLOR : '#444444'}`, color: autopilotSandbox ? EVOLUTION_COLOR : '#777777', cursor: autopilotRunning ? 'not-allowed' : 'pointer' }}>🧪 Sandbox</button>
                          <button onClick={() => setAutopilotSandbox(false)} disabled={autopilotRunning}
                            style={{ fontSize: '10px', padding: '4px 9px', background: !autopilotSandbox ? '#141414' : 'transparent', border: `1px solid ${!autopilotSandbox ? '#767676' : '#444444'}`, color: !autopilotSandbox ? '#767676' : '#777777', cursor: autopilotRunning ? 'not-allowed' : 'pointer' }}>🔴 Live</button>
                        </div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#666666', marginTop: '6px', lineHeight: '1.5' }}>
                        {autopilotSandbox
                          ? 'Sandbox: Rekt cuma bikin rencana per garapan (aman, tidak ada aksi/tx nyata, tidak menandai selesai).'
                          : '⚠️ Live: Rekt beneran menjalankan aksi (bisa termasuk transaksi on-chain lewat wallet aktif) & menandai garapan selesai secara otomatis.'}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        {!autopilotRunning ? (
                          <button onClick={runAutopilotGarapan}
                            style={{ flex: 1, fontSize: '11px', padding: '7px 10px', background: '#141414', border: `1px solid ${EVOLUTION_COLOR}`, color: EVOLUTION_COLOR, cursor: 'pointer', fontWeight: 'bold' }}>
                            ▶️ Jalankan Autopilot ({pendingTasks.length} garapan)
                          </button>
                        ) : (
                          <button onClick={stopAutopilot}
                            style={{ flex: 1, fontSize: '11px', padding: '7px 10px', background: '#141414', border: '1px solid #767676', color: '#acacac', cursor: 'pointer', fontWeight: 'bold' }}>
                            ⏹ Stop Autopilot
                          </button>
                        )}
                      </div>
                      {autopilotProgress && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#888888', marginBottom: '3px' }}>
                            Mengerjakan {autopilotProgress.current}/{autopilotProgress.total}: {autopilotProgress.taskName}
                          </div>
                          <div style={{ height: '5px', background: '#1a1a1a', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(autopilotProgress.current / autopilotProgress.total) * 100}%`, background: EVOLUTION_COLOR, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #222222', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: autopilotScheduleEnabled ? EVOLUTION_COLOR : '#888888', cursor: 'pointer' }}>
                          <input type="checkbox" checked={autopilotScheduleEnabled} onChange={e => setAutopilotScheduleEnabled(e.target.checked)} />
                          🕐 Jadwalkan otomatis tiap hari jam
                        </label>
                        <input type="time" value={autopilotScheduleTime} onChange={e => setAutopilotScheduleTime(e.target.value)} disabled={!autopilotScheduleEnabled}
                          style={{ fontSize: '11px', padding: '4px 8px', background: '#111111', border: '1px solid #333333', color: '#dddddd', opacity: autopilotScheduleEnabled ? 1 : 0.5 }} />
                        {autopilotScheduleEnabled && (
                          <span style={{ fontSize: '10px', color: EVOLUTION_COLOR }}>
                            aktif — jalan otomatis mode {autopilotSandbox ? '🧪 Sandbox' : '🔴 Live'} (jangan tutup app biar tepat waktu)
                          </span>
                        )}
                      </div>
                      {autopilotLog.length > 0 && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                          {[...autopilotLog].reverse().slice(0, 20).map((l, i) => (
                            <div key={i} style={{ fontSize: '10px', padding: '4px 8px', background: '#111111', border: `1px solid ${l.status === 'success' ? '#333333' : l.status === 'error' ? '#282828' : '#2a2a2a'}`, color: l.status === 'success' ? '#ababab' : l.status === 'error' ? '#acacac' : '#888888' }}>
                              {l.status === 'success' ? '✅' : l.status === 'error' ? '❌' : '⏭️'} <strong>{l.taskName}</strong> ({l.mode}) — {l.summary}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                      {pendingTasks.map((task, idx) => (
                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#151515', border: '1px solid #232323', padding: '10px 12px' }}>
                          <span style={{ color: '#555555', fontSize: '11px', minWidth: '20px', fontFamily: 'monospace' }}>{idx + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#dddddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔴 {task.nama}</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10px', color: '#666666', background: '#1a1a1a', padding: '1px 6px', border: '1px solid #333333' }}>{task.kategori || 'Testnet'}</span>
                              {task.deadline && <span style={{ fontSize: '10px', color: '#b0b0b0' }}>⏰ {task.deadline}</span>}
                              {task.estimasiReward ? <span style={{ fontSize: '10px', color: '#878787' }}>💰 ~${task.estimasiReward}</span> : null}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            {task.link && task.link !== '#' && (
                              <a href={task.link} target="_blank" rel="noreferrer"
                                style={{ fontSize: '11px', padding: '5px 8px', background: '#111111', border: '1px solid #333333', color: '#888888', textDecoration: 'none' }} title="Buka link">🔗</a>
                            )}
                            <button onClick={() => { setShowGarapPanel(false); sendMessage(`Garap airdrop ${task.nama} link: ${task.link} kategori: ${task.kategori || 'Testnet'}${task.deadline ? ` deadline: ${task.deadline}` : ''}`); }} disabled={isLoading}
                              style={{ fontSize: '11px', padding: '5px 12px', background: '#1e1e1e', border: '1px solid #878787', color: '#cacaca', cursor: 'pointer', fontWeight: 'bold', opacity: isLoading ? 0.5 : 1 }}>
                              ▶ Garap
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}
      <div style={{ marginBottom: '12px' }}>
        <button onClick={() => setShowImportPanel(p => !p)}
          style={{ width: '100%', fontSize: '13px', padding: '8px 14px', background: showImportPanel ? '#0e0e0e' : 'transparent', border: `1px solid ${showImportPanel ? '#7a7a7a' : '#222222'}`, borderLeft: '4px solid #7a7a7a', color: '#7a7a7a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
          <FaFileImport size={13} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 'bold' }}>Import File/Konteks</span>
            <span style={{ fontSize: '11px', color: '#2f2f2f', marginLeft: '8px' }}>{importedContexts.length > 0 ? `${importedContexts.length} aktif` : 'txt, md, csv, json, js, ts, html'}</span>
          </div>
          {showImportPanel ? <FaChevronUp color="#7a7a7a" size={11} /> : <FaChevronDown color="#7a7a7a" size={11} />}
        </button>
        {showImportPanel && (
          <div style={{ background: '#0a0a0a', border: '1px solid #202020', borderTop: 'none', padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <button onClick={() => fileInputRef.current?.click()} disabled={importLoading}
                style={{ fontSize: '12px', padding: '8px 14px', background: '#111111', border: '1px solid #7a7a7a', color: '#ababab', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaFileAlt size={12} /> {importLoading ? 'Memuat...' : 'Upload File'}
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.html,.css,.xml" onChange={e => handleFileImport(e.target.files)} style={{ display: 'none' }} />
            </div>
            {importError && <div style={{ color: '#acacac', fontSize: '12px', marginBottom: '8px', padding: '6px', background: 'rgba(118,118,118,0.12)', border: '1px solid #767676' }}>❌ {importError}</div>}
            {importSuccess && <div style={{ color: '#878787', fontSize: '12px', marginBottom: '8px' }}>{importSuccess}</div>}
            {importedContexts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {importedContexts.map((ctx, i) => (
                  <div key={i} style={{ background: '#131313', border: '1px solid #2f2f2f', padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaFileAlt size={10} color="#7a7a7a" />
                    <span style={{ color: '#ababab' }}>{ctx.name}</span>
                    <span style={{ color: '#444444', fontSize: '10px' }}>{(ctx.content.length / 1024).toFixed(1)}KB</span>
                    <button onClick={() => setImportedContexts(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: '#555555', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div ref={chatScrollRef} onScroll={handleChatScroll} style={{ minHeight: '360px', maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 2px', marginBottom: '10px' }}>
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: '30px', height: '30px', background: REKT_COLOR, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px' }}>
                <FaRobot size={14} color="white" />
              </div>
            )}
            <div style={{ maxWidth: '80%' }}>
              <div style={{ fontSize: '10px', color: '#444444', marginBottom: '3px', textAlign: msg.role === 'user' ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && <span style={{ color: REKT_COLOR }}>Rekt</span>}
                <span>{formatTime(msg.timestamp)}</span>
                {msg.role === 'assistant' && (
                  <button onClick={() => navigator.clipboard.writeText(msg.content)} title="Copy pesan"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333333', padding: '0 2px', fontSize: '11px' }}>
                    <FaRegCopy size={9} />
                  </button>
                )}
                {msg.role === 'assistant' && msgIdx === messages.length - 1 && !isLoading && (
                  <button onClick={regenerateLastResponse} title="Regenerate balasan ini — minta Rekt jawab ulang"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333333', padding: '0 2px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>
                    <FaSyncAlt size={9} />
                  </button>
                )}
              </div>
              <div style={{
                background: msg.role === 'user' ? '#1c1c1c' : '#111111',
                border: msg.role === 'user' ? '1px solid #2f2f2f' : `1px solid #222222`,
                borderLeft: msg.role === 'assistant' ? `3px solid ${REKT_COLOR}` : undefined,
                padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#dddddd',
              }}>
                {renderMarkdown(msg.content)}
              </div>
              {msg.actions && msg.actions.length > 0 && (
                <div style={{ marginTop: '8px', marginLeft: msg.role === 'assistant' ? '38px' : 0, background: '#111111', border: '1px solid #2e2e2e', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#878787', marginBottom: '4px' }}>⚡ Rekt ingin melakukan {msg.actions.length} aksi:</div>
                  {msg.actions.map((action, aIdx) => {
                    const key = `${msgIdx}-${aIdx}`;
                    const feedback = actionFeedback[key];
                    const actionColor = action.type === 'DELETE' ? '#767676' : action.type === 'ADD' ? '#878787' : action.type === '__LEARN_WORKFLOW__' ? EVOLUTION_COLOR : '#7a7a7a';
                    return (
                      <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', padding: '2px 7px', fontFamily: 'monospace', background: `${actionColor}15`, border: `1px solid ${actionColor}`, color: actionColor }}>{action.type === '__LEARN_WORKFLOW__' ? '🧬 EVOLVE' : action.type}</span>
                        <span style={{ fontSize: '12px', color: '#aaaaaa', flex: 1 }}>{action.label}</span>
                        {feedback ? (
                          <span style={{ fontSize: '11px', color: feedback.startsWith('✅') ? '#878787' : '#767676' }}>{feedback}</span>
                        ) : (
                          <button onClick={() => applyAction(msgIdx, aIdx, action)} disabled={action.applied}
                            style={{ fontSize: '11px', padding: '4px 12px', background: action.applied ? '#232323' : '#1e1e1e', border: `1px solid ${action.applied ? '#3d3d3d' : '#878787'}`, color: action.applied ? '#878787' : '#cacaca', cursor: action.applied ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {action.applied ? <><FaCheckCircle size={10} /> Diterapkan</> : '▶ Terapkan'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {msg.actions.some(a => !a.applied) && (
                    <button onClick={() => applyAllActions(msgIdx, msg.actions!)}
                      style={{ marginTop: '4px', fontSize: '12px', padding: '6px 14px', background: '#1e1e1e', border: '1px solid #878787', color: '#878787', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                      <FaCheckCircle size={12} /> Terapkan Semua ({msg.actions.filter(a => !a.applied).length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {evmRunning && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '30px', height: '30px', background: EVM_COLOR, color: EVM_COLOR, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px', animation: 'avatar-glow 1.4s ease-in-out infinite', boxShadow: `0 0 0 0 ${EVM_COLOR}` }}>
            <FaEthereum size={14} color="white" />
          </div>
          <div style={{ maxWidth: '80%' }}>
            <div style={{ fontSize: '10px', color: EVM_COLOR, marginBottom: '3px' }}>EVM Agent</div>
            <div style={{ background: '#0b0b0b', border: `1px solid ${EVM_COLOR}33`, borderLeft: `3px solid ${EVM_COLOR}`, padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#dddddd' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <FaSpinner size={12} color={EVM_COLOR} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: EVM_COLOR }}>Mengeksekusi EVM task...</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {chainRunning && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '30px', height: '30px', background: MULTI_CHAIN_COLOR, color: MULTI_CHAIN_COLOR, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px', animation: 'avatar-glow 1.4s ease-in-out infinite', boxShadow: `0 0 0 0 ${MULTI_CHAIN_COLOR}` }}>
            <FaGlobe size={14} color="#000000" />
          </div>
          <div style={{ maxWidth: '80%' }}>
            <div style={{ fontSize: '10px', color: MULTI_CHAIN_COLOR, marginBottom: '3px' }}>Multi-Chain Agent</div>
            <div style={{ background: '#0b0b0b', border: `1px solid ${MULTI_CHAIN_COLOR}33`, borderLeft: `3px solid ${MULTI_CHAIN_COLOR}`, padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#dddddd' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <FaSpinner size={12} color={MULTI_CHAIN_COLOR} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: MULTI_CHAIN_COLOR }}>Mengeksekusi Multi-Chain task...</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {runningAgentIds.size > 0 && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '30px', height: '30px', background: AGENT_COLOR, color: AGENT_COLOR, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px', animation: 'avatar-glow 1.4s ease-in-out infinite', boxShadow: `0 0 0 0 ${AGENT_COLOR}` }}>
            🤖
          </div>
          <div style={{ maxWidth: '80%' }}>
            <div style={{ fontSize: '10px', color: AGENT_COLOR, marginBottom: '3px' }}>Tim Agent</div>
            <div style={{ background: '#0b0b0b', border: `1px solid ${AGENT_COLOR}33`, borderLeft: `3px solid ${AGENT_COLOR}`, padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#dddddd' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <FaSpinner size={12} color={AGENT_COLOR} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: AGENT_COLOR }}>
                  {Array.from(runningAgentIds).map(id => agentTeam.find(a => a.id === id)?.name).filter(Boolean).join(', ') || 'Agent'} lagi jalan...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {(isLoading || streamingText) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', background: REKT_COLOR, color: REKT_COLOR, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px', animation: 'avatar-glow 1.4s ease-in-out infinite', boxShadow: `0 0 0 0 ${REKT_COLOR}` }}>
              <FaRobot size={14} color="white" />
            </div>
            <div style={{ maxWidth: '80%' }}>
              <div style={{ fontSize: '10px', color: REKT_COLOR, marginBottom: '3px' }}>Rekt</div>
              <div style={{ background: '#111111', border: `1px solid #222222`, borderLeft: `3px solid ${REKT_COLOR}`, padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#dddddd' }}>
                {streamingText ? renderMarkdown(streamingText) : (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: '7px', height: '7px', background: REKT_COLOR, borderRadius: '50%', display: 'inline-block', animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                )}
                {streamingText && <span style={{ display: 'inline-block', width: '2px', height: '14px', background: REKT_COLOR, marginLeft: '2px', animation: 'blink 0.7s step-end infinite', verticalAlign: 'middle' }} />}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'flex-end' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={importedContexts.length > 0 ? `Tanya tentang ${importedContexts[0].name}... (Enter kirim)` : `Chat dengan Rekt... (Enter kirim, Shift+Enter baris baru)`}
          disabled={isLoading} rows={2}
          style={{ flex: 1, resize: 'vertical', minHeight: '52px', fontFamily: "'Courier New', monospace", fontSize: '13px', padding: '10px 12px', background: '#0d0d0d', color: '#ffffff', border: `1px solid ${input.trim() ? REKT_COLOR + '44' : '#222222'}`, boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
            style={{ background: REKT_COLOR, color: 'white', border: 'none', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', opacity: (!input.trim() || isLoading) ? 0.5 : 1, fontSize: '13px' }}>
            <FaPaperPlane size={13} /> Kirim
          </button>
          <button onClick={clearChat} style={{ background: 'transparent', color: '#333333', border: '1px solid #1a1a1a', padding: '7px 14px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FaTrash size={10} /> Reset
          </button>
        </div>
      </div>
      <div style={{ marginTop: '8px', padding: '7px 12px', background: '#0a0a0a', border: '1px solid #141414', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ color: '#2a2a2a', display: 'flex', alignItems: 'center', gap: '5px' }}>
          🔒 Encrypted Chat By · <span style={{ color: REKT_COLOR + '88' }}>Rekt</span>
          {importedContexts.length > 0 && <span style={{ color: '#7a7a7a' }}>· 📎 {importedContexts.length} konteks</span>}
        </span>
        <button
          onClick={() => { const next = !autoMode; setAutoMode(next); try { localStorage.setItem('rektAutoMode', String(next)); } catch {} }}
          title={autoMode ? 'Rekt aktif ngobrol sendiri — klik untuk matikan' : 'Mode diam — klik untuk aktifkan auto-chat'}
          style={{ background: autoMode ? '#181818' : '#111111', border: `1px solid ${autoMode ? ONLINE_STATUS_COLOR : '#2a2a2a'}`, color: autoMode ? ONLINE_STATUS_COLOR : '#444444', padding: '3px 9px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '2px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: autoMode ? ONLINE_STATUS_COLOR : '#444444', boxShadow: autoMode ? `0 0 6px ${ONLINE_STATUS_COLOR}` : 'none', display: 'inline-block', animation: autoMode ? 'pulse 2s ease-in-out infinite' : 'none' }} />
          {autoMode ? 'Rekt Online' : 'Rekt Diam'}
        </button>
      </div>
      <style>{`
        @keyframes blink { 0%,100%{opacity:0.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(-3px)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 4px #878787} 50%{box-shadow:0 0 10px #4caf5088} }
        /* BUG FIX: dipakai (mis. ikon loading EVM & Multi-Wallet Dashboard) tapi belum pernah didefinisikan — akibatnya ikon "muter" itu diam aja selama ini. */
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        /* Dipakai buat nandain "Rekt/agent lagi ngerjain sesuatu": titik kecil
           berkedip di badge/tombol header, dan cincin cahaya yang mengembang
           lalu memudar di avatar bulat (EVM/Multi-Chain/Tim Agent/Rekt). */
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.7)} }
        @keyframes avatar-glow {
          0%   { box-shadow: 0 0 0 0 currentColor; }
          70%  { box-shadow: 0 0 0 7px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        strong { font-weight: bold; }
        em { font-style: italic; }
        /* ── 8-BIT PIXEL THEME (v2) ─────────────────────────────────────
           Versi sebelumnya pakai CSS filter (grayscale+sepia+hue-rotate+
           contrast tinggi) buat maksa semua warna jadi hitam-putih-skyblue —
           efeknya malah bikin mata sakit (kontras kepaksa, warna jadi
           "washed out"/flicker pas scroll). Filter itu DIHAPUS total di versi
           ini. Sebagai gantinya, tampilan retro 8-bit dibangun dari CSS asli
           (bukan filter paksa) supaya kontrasnya wajar dan nyaman dibaca:
           1) Font pixel ('Press Start 2P') dipakai TERBATAS — cuma di header,
              tombol, dan footer. Teks chat/isi tetap monospace biasa
              (Courier New) biar tetap nyaman dibaca panjang-panjang.
           2) Border tetap kotak tegas (border-radius: 0) — ciri khas 8-bit.
           3) Tombol dikasih "pixel shadow" (drop shadow tanpa blur) + animasi
              "tertekan" pas diklik (translate sejauh shadow-nya, lalu shadow
              hilang) — biar berasa nekan tombol beneran ala game retro.
           4) Scanline halus + partikel pixel yang mengambang pelan-pelan buat
              nuansa animasi 8-bit, TAPI opacity-nya sengaja dibikin sangat
              rendah dan gerakannya lambat/steps (bukan smooth/strobe) supaya
              tetap nyaman di mata, bukan bikin pusing.
        ───────────────────────────────────────────────────────────────── */
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .pixel-bw-theme {
          position: relative;
          font-family: 'Courier New', ui-monospace, monospace;
        }
        .pixel-bw-theme *,
        .pixel-bw-theme *::before,
        .pixel-bw-theme *::after {
          border-radius: 0 !important;
        }
        .pixel-bw-theme header,
        .pixel-bw-theme button,
        .pixel-bw-theme .app-footer {
          font-family: 'Press Start 2P', 'Courier New', monospace !important;
        }
        /* Font pixel bikin teks jadi lebih lebar & rapat — dikompensasi biar tombol
           gak keliatan sesak/kepotong. */
        .pixel-bw-theme button {
          font-size: 10px !important;
          line-height: 1.6 !important;
          letter-spacing: 0.5px;
        }
        /* Pixel drop-shadow + animasi "nekan tombol" ala 8-bit, dipicu hanya
           saat diklik — bukan animasi terus-menerus, jadi gak mengganggu. */
        .pixel-bw-theme button:not(:disabled) {
          box-shadow: 3px 3px 0 0 rgba(0,0,0,0.85) !important;
          transition: transform 0.06s steps(1), box-shadow 0.06s steps(1) !important;
        }
        .pixel-bw-theme button:not(:disabled):active {
          transform: translate(3px, 3px);
          box-shadow: 0 0 0 0 rgba(0,0,0,0.85) !important;
        }
        .pixel-bw-theme input,
        .pixel-bw-theme textarea,
        .pixel-bw-theme select {
          box-shadow: 2px 2px 0 0 rgba(0,0,0,0.6) !important;
        }
        /* Scanline CRT halus — bergerak sangat pelan, opacity rendah banget,
           cuma nuansa, gak sampai ganggu bacaan teks. */
        .pixel-bw-theme::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2147483000;
          background: repeating-linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.035) 0px,
            rgba(255, 255, 255, 0.035) 1px,
            transparent 1px,
            transparent 3px
          );
          animation: pixel-scanline-drift 10s linear infinite;
        }
        @keyframes pixel-scanline-drift {
          0%   { background-position-y: 0px; }
          100% { background-position-y: 120px; }
        }
        /* Debu pixel yang mengambang pelan pakai gerakan steps() (per-frame,
           bukan smooth) biar berasa "8-bit", opacity rendah biar gak silau. */
        .pixel-bw-theme::after {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.22;
          background-repeat: no-repeat;
          background-image:
            radial-gradient(2px 2px at 12% 18%, #ffffff, transparent 100%),
            radial-gradient(2px 2px at 82% 12%, #ffffff, transparent 100%),
            radial-gradient(2px 2px at 48% 78%, #ffffff, transparent 100%),
            radial-gradient(2px 2px at 28% 55%, #ffffff, transparent 100%),
            radial-gradient(2px 2px at 92% 68%, #ffffff, transparent 100%),
            radial-gradient(2px 2px at 65% 30%, #ffffff, transparent 100%);
          animation: pixel-dust-float 7s steps(7) infinite;
        }
        @keyframes pixel-dust-float {
          0%   { transform: translateY(0); }
          50%  { transform: translateY(-8px); }
          100% { transform: translateY(0); }
        }
      `}</style>
      <footer className="app-footer" style={{ marginTop: '30px', textAlign: 'center', color: '#333333', fontSize: '0.8em' }}>
        Powered by IAC Community
      </footer>
    </div>
  );
};
