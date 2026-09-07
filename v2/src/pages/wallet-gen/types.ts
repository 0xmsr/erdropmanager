export type GramVersion = 'v4' | 'v5r1';

export interface BIP39Wallet {
  id: string;
  name: string;
  mnemonic: string;
  addresses: { index: number; address: string; privateKey: string }[];
  solAddresses: { index: number; address: string; privateKey: string }[];
  tronAddresses: { index: number; address: string; privateKey: string }[];
  axmAddresses: { index: number; address: string; privateKey: string }[];
  atomAddresses: { index: number; address: string; privateKey: string }[];
  suiAddresses: { index: number; address: string; privateKey: string }[];
  aptAddresses: { index: number; address: string; privateKey: string }[];
  gramAddress?: { address: string; privateKey: string; version: GramVersion };
  // true kalau wallet ini diimport dari mnemonic TON native (Telegram Wallet /
  // Tonkeeper / dst), bukan dari mnemonic BIP39 multi-chain buatan app ini.
  // Wallet seperti ini HANYA punya address Gram yang valid — field mnemonic
  // di atas bukan mnemonic BIP39 & tidak bisa dipakai untuk menurunkan
  // address EVM/SOL/TRON/AXM/ATOM ("Derive More" akan ditolak untuk wallet ini).
  isTonNative?: boolean;
  createdAt: number;
  tags: string[];
  note: string;
}

export interface RPCNetwork {
  id: string;
  name: string;
  chainId: number;
  symbol: string;
  rpcUrls: string[];
  explorerUrl: string;
  color: string;
}

// Bentuk data mentah satu chain dari Chainlist (chainid.network/chains.json).
// Hanya field yang benar-benar dipakai yang dideklarasikan di sini — respons
// aslinya punya banyak field lain (icon, faucets, parent, dll) yang diabaikan.
export interface ChainlistChain {
  name: string;
  chain: string;
  chainId: number;
  shortName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpc: string[];
  explorers?: { name: string; url: string; standard?: string }[];
  infoURL?: string;
}

export interface AirdropTask {
  id: string;
  projectName: string;
  network: string;
  taskType: 'swap' | 'bridge' | 'mint' | 'stake' | 'send' | 'deploy' | 'vote' | 'lp' | 'other';
  description: string;
  txHash: string;
  walletAddress: string;
  status: 'todo' | 'done' | 'failed';
  priority: 'low' | 'medium' | 'high';
  deadline: string;
  notes: string;
  createdAt: number;
  doneAt?: number;
  contractAddress?: string;
  contractAbi?: string;
  contractFunc?: string;
  contractArgs?: string;
  ethValue?: string;
}

export interface TxQueueItem {
  id: string;
  taskName: string;
  description: string;
  to: string;
  value: string;
  data: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  txHash?: string;
  error?: string;
  gasEstimate?: string;
  timestamp?: number;
  networkId?: string;
}

export interface AutoContractCall {
  contractAddress: string;
  abi: string;
  functionName: string;
  args: string;
  value: string;
}

export type ChainKind = 'evm' | 'sol' | 'tron' | 'atom' | 'axm' | 'gram' | 'sui' | 'apt';

export interface CreatedGramToken {
  id: string;
  masterAddress: string;
  walletAddress: string;
  netId: string;
  networkName: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  version: GramVersion;
  txHash: string;
  createdAt: number;
  metadataUri?: string;
  imageUrl?: string;
  description?: string;
}

export interface EvmWalletTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: number | null;
  status: 'success' | 'failed' | 'pending';
  methodGuess: string | null;
}

export interface EvmTokenDetail {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  standard: string;
  holdersCount: number | null;
  iconUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
}

export interface DetectedToken {
  chain: 'evm' | 'sol' | 'tron' | 'atom' | 'axm' | 'gram';
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  balanceFormatted: string;
  usdPrice: number | null;
  usdValue: number | null;
  logo?: string;
}

export type WalletGeneratorCtx = Record<string, any>;
