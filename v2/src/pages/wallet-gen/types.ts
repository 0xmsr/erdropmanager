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
  gramAddress?: { address: string; privateKey: string; version: GramVersion };
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
}

export interface AutoContractCall {
  contractAddress: string;
  abi: string;
  functionName: string;
  args: string;
  value: string;
}

export type ChainKind = 'evm' | 'sol' | 'tron' | 'atom' | 'axm' | 'gram';

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