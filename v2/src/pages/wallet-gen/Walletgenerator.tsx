import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import {
  Keypair as SolKeypair, Connection, PublicKey, SystemProgram,
  Transaction as SolTransaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction, createTransferInstruction,
  MINT_SIZE, getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction, createMintToInstruction,
} from '@solana/spl-token';
import {
  PROGRAM_ID as METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from '@metaplex-foundation/mpl-token-metadata';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import bs58 from 'bs58';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { CustomAlert, CustomConfirm, TxConfirmModal, type TxConfirmDetails } from '../../components/CustomModals';
import { KNOWN_4BYTE, KNOWN_TOPICS, KNOWN_SELECTORS } from './know'
import { TxDecoder } from './Txdecoder';
import {
  FaWallet, FaPlus, FaTrash, FaCopy, FaEye, FaEyeSlash,
  FaKey, FaShieldAlt, FaLink,
  FaSearch, FaFileExport, FaFileImport, FaNetworkWired,
  FaCheckCircle, FaExclamationTriangle, FaRandom, FaEdit,
  FaPlug, FaPaperPlane, FaQrcode, FaSync, FaChevronDown, FaChevronUp,
  FaExchangeAlt, FaCalendarAlt, FaGlobe,
  FaBolt, FaPlay, FaCode, FaGasPump, FaRobot,
  FaSpinner, FaChartBar,
  FaMagic, FaLayerGroup, FaInfoCircle, FaTerminal, FaFileCode, FaList,
  FaCheck, FaRegCopy, FaCoins, FaRocket, FaHashtag, FaFaucet,
} from 'react-icons/fa';

import {
  SmartContractConfig,
  BytecodeExplorer,
  ERC20_ABI,
  ERC20_BYTECODE,
  safeParseContractArgs,
  parseArgWithAbiType,
  parseTxError,
  runAiCodeSecurityScan,
  AISEC_VERDICT_META,
  compileSolidity,
} from './Smartcontracttools';
import type { DeployedErc20Token, CreatedSplToken, AiSecResult, CompiledContract } from './Smartcontracttools';

interface BIP39Wallet {
  id: string;
  name: string;
  mnemonic: string;
  addresses: { index: number; address: string; privateKey: string }[];
  solAddresses: { index: number; address: string; privateKey: string }[];
  createdAt: number;
  tags: string[];
  note: string;
}

interface RPCNetwork {
  id: string;
  name: string;
  chainId: number;
  symbol: string;
  rpcUrls: string[];
  explorerUrl: string;
  color: string;
}

interface AirdropTask {
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

interface TxQueueItem {
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

interface AutoContractCall {
  contractAddress: string;
  abi: string;
  functionName: string;
  args: string;
  value: string;
}

const AUTO_ACTION_TEMPLATES = [
  { id:'transfer_eth',   label:'[] Transfer ETH',       abi:'', category:'transfer' },
  { id:'erc20_approve',  label:'[] ERC-20 Approve',      abi:'[{"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]', category:'token' },
  { id:'erc20_transfer', label:'[] ERC-20 Transfer',     abi:'[{"inputs":[{"name":"recipient","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]', category:'token' },
  { id:'nft_mint',       label:'[] NFT Mint',            abi:'[{"inputs":[{"name":"quantity","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}]', category:'nft' },
  { id:'custom',         label:'[] Custom Calldata',     abi:'', category:'custom' },
];

const AUTO_SELECTOR_MAP: Record<string, string> = {
  'approve(address,uint256)': '0x095ea7b3',
  'transfer(address,uint256)': '0xa9059cbb',
  'transferFrom(address,address,uint256)': '0x23b872dd',
  'mint(uint256)': '0xa0712d68',
  'claim()': '0x4e71d92d',
  'deposit()': '0xd0e30db0',
  'withdraw(uint256)': '0x2e1a7d4d',
  'stake(uint256)': '0xa694fc3a',
};

function encodeAutoAbi(funcSig: string, types: string[], values: any[]): string {
  const selector = AUTO_SELECTOR_MAP[funcSig] ?? '0x00000000';
  const encoded = values.map((v, i) => {
    if (types[i] === 'address') return String(v).toLowerCase().replace(/^0x/, '').padStart(64, '0');
    return BigInt(String(v)).toString(16).padStart(64, '0');
  }).join('');
  return selector + encoded;
}

function parseAbiFunc(abiStr: string, funcName: string) {
  try {
    const abi = JSON.parse(abiStr);
    return abi.find((f: any) => f.name === funcName && f.type === 'function');
  } catch { return null; }
}

const TX_QUEUE_KEY  = 'web3TxQueue';
const TX_HISTORY_KEY = 'web3TxHistory';

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0,6)}...${addr.slice(-4)}` : '';
}
function weiToEthStr(hexWei: string, dec = 6) {
  try {
    const wei = BigInt(hexWei);
    const whole = wei / BigInt('1000000000000000000');
    const frac  = wei % BigInt('1000000000000000000');
    return `${whole}.${frac.toString().padStart(18, '0').slice(0, dec)}`;
  } catch { return '0'; }
}
function ethToHex(eth: string): string {
  try { return '0x' + BigInt(Math.floor(parseFloat(eth) * 1e18)).toString(16); } catch { return '0x0'; }
}
const SEPOLIA_RPCS = [
  'https://rpc.sepolia.org',
  'https://1rpc.io/sepolia',
  'https://sepolia.llamarpc.com',
  'https://eth-sepolia.public.blastapi.io',
];

const DEFAULT_NETWORKS: RPCNetwork[] = [
  { id:'ethereum',      name:'Ethereum Mainnet',      chainId:1,          symbol:'ETH',    rpcUrls:['https://1rpc.io/eth','https://eth.llamarpc.com'],                                  explorerUrl:'https://etherscan.io',                  color:'#627EEA' },
  { id:'base',          name:'Base',                  chainId:8453,       symbol:'ETH',    rpcUrls:['https://1rpc.io/base','https://mainnet.base.org'],                                 explorerUrl:'https://basescan.org',                  color:'#0052FF' },
  { id:'arbitrum',      name:'Arbitrum One',          chainId:42161,      symbol:'ETH',    rpcUrls:['https://1rpc.io/arb','https://arb1.arbitrum.io/rpc'],                              explorerUrl:'https://arbiscan.io',                   color:'#28A0F0' },
  { id:'optimism',      name:'Optimism',              chainId:10,         symbol:'ETH',    rpcUrls:['https://1rpc.io/op','https://mainnet.optimism.io'],                                explorerUrl:'https://optimistic.etherscan.io',       color:'#FF0420' },
  { id:'polygon',       name:'Polygon',               chainId:137,        symbol:'MATIC',  rpcUrls:['https://1rpc.io/matic','https://polygon-rpc.com'],                                 explorerUrl:'https://polygonscan.com',               color:'#8247E5' },
  { id:'bnb',           name:'BNB Smart Chain',       chainId:56,         symbol:'BNB',    rpcUrls:['https://1rpc.io/bnb','https://bsc-dataseed1.binance.org'],                         explorerUrl:'https://bscscan.com',                   color:'#F3BA2F' },
  { id:'avalanche',     name:'Avalanche C-Chain',     chainId:43114,      symbol:'AVAX',   rpcUrls:['https://1rpc.io/avax/c','https://api.avax.network/ext/bc/C/rpc'],                  explorerUrl:'https://snowtrace.io',                  color:'#E84142' },
  { id:'fantom',        name:'Fantom Opera',          chainId:250,        symbol:'FTM',    rpcUrls:['https://1rpc.io/ftm','https://rpc.ftm.tools'],                                     explorerUrl:'https://ftmscan.com',                   color:'#1969FF' },
  { id:'cronos',        name:'Cronos',                chainId:25,         symbol:'CRO',    rpcUrls:['https://1rpc.io/cro','https://evm.cronos.org'],                                    explorerUrl:'https://cronoscan.com',                 color:'#002D74' },
  { id:'gnosis',        name:'Gnosis Chain',          chainId:100,        symbol:'xDAI',   rpcUrls:['https://1rpc.io/gnosis','https://rpc.gnosischain.com'],                            explorerUrl:'https://gnosisscan.io',                 color:'#04795B' },
  { id:'celo',          name:'Celo',                  chainId:42220,      symbol:'CELO',   rpcUrls:['https://1rpc.io/celo','https://forno.celo.org'],                                   explorerUrl:'https://celoscan.io',                   color:'#35D07F' },
  { id:'moonbeam',      name:'Moonbeam',              chainId:1284,       symbol:'GLMR',   rpcUrls:['https://1rpc.io/glmr','https://rpc.api.moonbeam.network'],                         explorerUrl:'https://moonbeam.moonscan.io',          color:'#53CBC9' },
  { id:'moonriver',     name:'Moonriver',             chainId:1285,       symbol:'MOVR',   rpcUrls:['https://1rpc.io/movr','https://rpc.api.moonriver.moonbeam.network'],               explorerUrl:'https://moonriver.moonscan.io',         color:'#F2A007' },
  { id:'aurora',        name:'Aurora (NEAR)',         chainId:1313161554, symbol:'ETH',    rpcUrls:['https://mainnet.aurora.dev'],                                                      explorerUrl:'https://aurorascan.dev',                color:'#70D44B' },
  { id:'klaytn',        name:'Klaytn',                chainId:8217,       symbol:'KLAY',   rpcUrls:['https://1rpc.io/klay','https://public-node-api.klaytnapi.com/v1/cypress'],          explorerUrl:'https://scope.klaytn.com',              color:'#FA5F2B' },
  { id:'zksync',        name:'zkSync Era',            chainId:324,        symbol:'ETH',    rpcUrls:['https://1rpc.io/zksync2-era','https://mainnet.era.zksync.io'],                     explorerUrl:'https://explorer.zksync.io',            color:'#8C8DFC' },
  { id:'scroll',        name:'Scroll',                chainId:534352,     symbol:'ETH',    rpcUrls:['https://1rpc.io/scroll','https://rpc.scroll.io'],                                  explorerUrl:'https://scrollscan.com',                color:'#EEB878' },
  { id:'linea',         name:'Linea',                 chainId:59144,      symbol:'ETH',    rpcUrls:['https://1rpc.io/linea','https://rpc.linea.build'],                                 explorerUrl:'https://lineascan.build',               color:'#61DFFF' },
  { id:'polygonzkevm',  name:'Polygon zkEVM',         chainId:1101,       symbol:'ETH',    rpcUrls:['https://1rpc.io/polygon/zkevm','https://zkevm-rpc.com'],                           explorerUrl:'https://zkevm.polygonscan.com',         color:'#8247E5' },
  { id:'mantle',        name:'Mantle',                chainId:5000,       symbol:'MNT',    rpcUrls:['https://1rpc.io/mantle','https://rpc.mantle.xyz'],                                 explorerUrl:'https://explorer.mantle.xyz',           color:'#C0C0C0' },
  { id:'blast',         name:'Blast',                 chainId:81457,      symbol:'ETH',    rpcUrls:['https://1rpc.io/blast','https://rpc.blast.io'],                                    explorerUrl:'https://blastscan.io',                  color:'#FCFC03' },
  { id:'taiko',         name:'Taiko',                 chainId:167000,     symbol:'ETH',    rpcUrls:['https://1rpc.io/taiko','https://rpc.mainnet.taiko.xyz'],                           explorerUrl:'https://taikoscan.io',                  color:'#E81899' },
  { id:'mode',          name:'Mode Network',          chainId:34443,      symbol:'ETH',    rpcUrls:['https://mainnet.mode.network'],                                                    explorerUrl:'https://modescan.io',                   color:'#DFFE00' },
  { id:'bob',           name:'BOB Network',           chainId:60808,      symbol:'ETH',    rpcUrls:['https://rpc.gobob.xyz'],                                                           explorerUrl:'https://explorer.gobob.xyz',            color:'#FF7600' },
  { id:'monad',         name:'Monad Testnet',         chainId:10143,      symbol:'MON',    rpcUrls:['https://testnet-rpc.monad.xyz'],                                                   explorerUrl:'https://testnet.monadexplorer.com',     color:'#836EFD' },
  { id:'pharos',        name:'Pharos Testnet',        chainId:688688,     symbol:'PHRS',   rpcUrls:['https://testnet.dplabs-internal.com'],                                             explorerUrl:'https://testnet.pharosscan.xyz',        color:'#1000F0' },
  { id:'sepolia',       name:'Ethereum Sepolia',      chainId:11155111,   symbol:'ETH',    rpcUrls:SEPOLIA_RPCS,                                                                        explorerUrl:'https://sepolia.etherscan.io',          color:'#9E9E9E' },
  { id:'base-sepolia',  name:'Base Sepolia',          chainId:84532,      symbol:'ETH',    rpcUrls:['https://sepolia.base.org','https://base-sepolia-rpc.publicnode.com'],              explorerUrl:'https://sepolia.basescan.org',          color:'#0052FF' },
  { id:'arb-sepolia',   name:'Arbitrum Sepolia',      chainId:421614,     symbol:'ETH',    rpcUrls:['https://sepolia-rollup.arbitrum.io/rpc'],                                          explorerUrl:'https://sepolia.arbiscan.io',           color:'#28A0F0' },
  { id:'op-sepolia',    name:'Optimism Sepolia',      chainId:11155420,   symbol:'ETH',    rpcUrls:['https://sepolia.optimism.io'],                                                     explorerUrl:'https://sepolia-optimism.etherscan.io', color:'#FF0420' },
  { id:'holesky',       name:'Ethereum Holesky',      chainId:17000,      symbol:'ETH',    rpcUrls:['https://1rpc.io/holesky','https://rpc.holesky.ethpandaops.io'],                    explorerUrl:'https://holesky.etherscan.io',          color:'#AA33FF' },
  { id:'bnb-testnet',   name:'BNB Testnet',           chainId:97,         symbol:'tBNB',   rpcUrls:['https://bsc-testnet-dataseed.bnbchain.org','https://bsc-testnet.publicnode.com'],  explorerUrl:'https://testnet.bscscan.com',           color:'#F3BA2F' },
  { id:'mumbai',        name:'Polygon Mumbai',        chainId:80001,      symbol:'MATIC',  rpcUrls:['https://rpc-mumbai.maticvigil.com','https://polygon-testnet.public.blastapi.io'],  explorerUrl:'https://mumbai.polygonscan.com',        color:'#8247E5' },
];

const QLENGTH_OPTIONS = [
  { label:'12 kata (128-bit)', bits:128  as const, words:12 },
  { label:'15 kata (160-bit)', bits:160  as const, words:15 },
  { label:'18 kata (192-bit)', bits:192  as const, words:18 },
  { label:'21 kata (224-bit)', bits:224  as const, words:21 },
  { label:'24 kata (256-bit)', bits:256  as const, words:24 },
];

const TASK_TYPES: { value: AirdropTask['taskType']; label: string; color: string }[] = [
  { value:'swap',    label:'Swap',    color:'#01a2ff' },
  { value:'bridge',  label:'Bridge',  color:'#f3ba2f' },
  { value:'mint',    label:'Mint',    color:'#4caf50' },
  { value:'stake',   label:'Stake',   color:'#9c27b0' },
  { value:'send',    label:'Send',    color:'#ff6600' },
  { value:'deploy',  label:'Deploy',  color:'#e81899' },
  { value:'vote',    label:'Vote',    color:'#00e676' },
  { value:'lp',      label:'Add LP',  color:'#61dfff' },
  { value:'other',   label:'Other',   color:'#888' },
];

const PRIORITY_COLORS: Record<AirdropTask['priority'], string> = {
  low: '#555', medium: '#ffaa00', high: '#ff3333',
};

const PRIORITY_LABELS: Record<AirdropTask['priority'], string> = {
  low: 'Low', medium: 'Medium', high: 'High',
};

function generateMnemonic(bits: 128|160|192|224|256): string {
  const entropy = ethers.utils.randomBytes(bits / 8);
  return ethers.utils.entropyToMnemonic(entropy);
}

function deriveAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
  const child  = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
  return { address: child.address, privateKey: child.privateKey };
}

// Solana pakai kurva ed25519 (SLIP-0010), bukan secp256k1 seperti EVM — jadi
// diturunkan lewat path berbeda (m/44'/501'/x'/0') tapi dari BIP39 seed yang sama.
function deriveSolanaAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2); // buang prefix '0x'
  const path    = `m/44'/501'/${index}'/0'`;
  const { key } = deriveEd25519Path(path, seedHex);
  const keypair = SolKeypair.fromSeed(key);
  return {
    address:    keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  };
}

// ── Metaplex Token Metadata: derive PDA "metadata" untuk sebuah mint ──
// Seeds: ["metadata", metadataProgramId, mint] — standar Metaplex Token Metadata Program.
function getMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID,
  );
  return pda;
}

// Batas panjang field yang di-enforce on-chain oleh Metaplex Token Metadata Program.
// Kalau dilewati, transaksi bakal ditolak program (bukan cuma validasi UI).
const SPL_META_MAX = { name: 32, symbol: 10, uri: 200 } as const;

type ChainKind = 'evm' | 'sol';

const CHAIN_OPTIONS: { id: ChainKind | string; label: string; soon?: boolean }[] = [
  { id: 'evm', label: 'EVM' },
  { id: 'sol', label: 'SOL' },
  { id: 'btc', label: 'BTC',  soon: true },
  { id: 'ton', label: 'TON',  soon: true },
  { id: 'sui', label: 'SUI',  soon: true },
  { id: 'apt', label: 'APT',  soon: true },
];

async function getProvider(network: RPCNetwork): Promise<ethers.providers.JsonRpcProvider> {
  for (const rpc of network.rpcUrls) {
    try {
      const p = new ethers.providers.JsonRpcProvider(rpc, { chainId: network.chainId, name: network.id });
      await Promise.race([
        p.getBlockNumber(),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 6000)),
      ]);
      return p;
    } catch { }
  }
  throw new Error(`Tidak dapat connect ke ${network.name}. Cek koneksi / RPC.`);
}

// ── Solana: daftar network yang bisa dipilih (Mainnet / Testnet / Devnet) ──
interface SolNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  clusterParam: string;   // suffix query utk Solscan, kosong utk mainnet
  rpcUrls: string[];
}

const SOLANA_NETWORKS: SolNetworkCfg[] = [
  {
    id: 'mainnet',
    name: 'Solana Mainnet',
    symbol: 'SOL',
    color: '#9945FF',
    explorerUrl: 'https://solscan.io',
    clusterParam: '',
    rpcUrls: [
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com',
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

async function getSolanaConnection(net: SolNetworkCfg): Promise<Connection> {
  for (const rpc of net.rpcUrls) {
    try {
      const conn = new Connection(rpc, 'confirmed');
      await Promise.race([
        conn.getVersion(),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 6000)),
      ]);
      return conn;
    } catch { }
  }
  throw new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

// ── Token Portfolio Scanner: deteksi SEMUA token yang dipegang wallet ──
// (bukan cuma token yang dibuat sendiri lewat Token Creator), plus harga USD
// kalau tersedia di Blockscout (EVM) / Jupiter (Solana).
export interface DetectedToken {
  chain: 'evm' | 'sol';
  address: string;   // contract address (EVM) atau mint address (Solana)
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  balanceFormatted: string;
  usdPrice: number | null;
  usdValue: number | null;
  logo?: string;
}

// Instance publik Blockscout (gratis, tanpa API key) per network id. Blockscout
// tidak meng-cover semua chain — kalau network belum ada di map ini, scan EVM
// akan menampilkan pesan "belum didukung" alih-alih gagal diam-diam.
const BLOCKSCOUT_HOSTS: Record<string, string> = {
  ethereum:      'eth.blockscout.com',
  sepolia:       'eth-sepolia.blockscout.com',
  holesky:       'eth-holesky.blockscout.com',
  base:          'base.blockscout.com',
  'base-sepolia':'base-sepolia.blockscout.com',
  optimism:      'optimism.blockscout.com',
  arbitrum:      'arbitrum.blockscout.com',
  polygon:       'polygon.blockscout.com',
  gnosis:        'gnosis.blockscout.com',
  celo:          'celo.blockscout.com',
  scroll:        'scroll.blockscout.com',
  zksync:        'zksync.blockscout.com',
};

async function fetchEvmTokenPortfolio(address: string, networkId: string): Promise<DetectedToken[]> {
  const host = BLOCKSCOUT_HOSTS[networkId];
  if (!host) {
    throw new Error(
      'Chain ini belum didukung untuk deteksi token otomatis (belum ada instance Blockscout publik). ' +
      'Coba: Ethereum, Base, Optimism, Arbitrum, Polygon, Gnosis, Celo, Scroll, zkSync Era, atau Sepolia.'
    );
  }
  const res = await fetch(`https://${host}/api/v2/addresses/${address}/tokens?type=ERC-20`);
  if (!res.ok) throw new Error(`Gagal ambil data token dari Blockscout (HTTP ${res.status}).`);
  const json = await res.json();
  const items: any[] = Array.isArray(json?.items) ? json.items : [];
  return items.map((it) => {
    const decimals = parseInt(it?.token?.decimals ?? '18', 10) || 0;
    const rawBal   = it?.value ?? '0';
    let balance = 0;
    try { balance = Number(BigInt(rawBal)) / Math.pow(10, decimals); } catch { balance = Number(rawBal) / Math.pow(10, decimals); }
    const priceStr = it?.token?.exchange_rate;
    const price    = priceStr !== null && priceStr !== undefined && priceStr !== '' ? parseFloat(priceStr) : null;
    return {
      chain: 'evm',
      address: it?.token?.address ?? '',
      symbol: it?.token?.symbol || '???',
      name: it?.token?.name || 'Unknown Token',
      decimals,
      balance,
      balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
      usdPrice: price !== null && !isNaN(price) ? price : null,
      usdValue: price !== null && !isNaN(price) ? balance * price : null,
      logo: it?.token?.icon_url || undefined,
    } as DetectedToken;
  });
}

async function fetchSolTokenPortfolio(address: string, net: SolNetworkCfg = SOLANA_NETWORKS[0]): Promise<DetectedToken[]> {
  const conn  = await getSolanaConnection(net);
  const owner = new PublicKey(address);
  const resp  = await conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
  const holdings = resp.value
    .map(v => v.account.data.parsed?.info)
    .filter(info => info && Number(info.tokenAmount?.uiAmount ?? 0) > 0);
  if (holdings.length === 0) return [];

  // Ambil metadata + harga USD sekaligus dari Jupiter Token API v2 (gratis, tanpa key,
  // maksimal 100 mint per request).
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
    } catch { /* metadata gagal diambil, tetap tampilkan saldo tanpa nama/harga */ }
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

export const WalletGenerator: React.FC = () => {

  const [wallets,  setWallets]  = useState<BIP39Wallet[]>(() => {
    try {
      const saved: BIP39Wallet[] = JSON.parse(localStorage.getItem('bip39Wallets') || '[]');
      // Wallet lama (sebelum fitur Solana) belum punya solAddresses — turunkan dari mnemonic yang sama.
      return saved.map(w => {
        if (w.solAddresses && w.solAddresses.length > 0) return w;
        try {
          const solAddresses = w.addresses.map(a => ({ index: a.index, ...deriveSolanaAddress(w.mnemonic, a.index) }));
          return { ...w, solAddresses };
        } catch { return { ...w, solAddresses: w.solAddresses || [] }; }
      });
    } catch { return []; }
  });
  const [chainView, setChainView] = useState<Record<string, ChainKind>>({});
  const [networks, setNetworks] = useState<RPCNetwork[]>(() => {
    try {
      const s = localStorage.getItem('rpcNetworks');
      return s ? JSON.parse(s) : DEFAULT_NETWORKS;
    } catch { return DEFAULT_NETWORKS; }
  });
  const [airdropTasks, setAirdropTasks] = useState<AirdropTask[]>(() => {
    try { return JSON.parse(localStorage.getItem('walletAirdropTasks') || '[]'); } catch { return []; }
  });

  const [activeTab, setActiveTab] = useState<
  'wallets' | 'transfer' | 'airdrop' | 'auto' | 'sweep' | 'balcheck' | 'networks' | 'bytecode' | 'txdecoder' | 'garap' | 'token'
>('wallets');
  const [generating,     setGenerating]     = useState(false);
  const [entropyBits,    setEntropyBits]    = useState<128|160|192|224|256>(128);
  const [addressCount,   setAddressCount]   = useState(1);
  const [walletName,     setWalletName]     = useState('');
  const [customMnemonic, setCustomMnemonic] = useState('');
  const [importMode,     setImportMode]     = useState(false);
  const [revealedIds,    setRevealedIds]    = useState<Set<string>>(new Set());
  const [revealedPKs,    setRevealedPKs]    = useState<Set<string>>(new Set());
  const [search,         setSearch]         = useState('');
  const [expandedId,     setExpandedId]     = useState<string|null>(null);
  const [copiedKey,      setCopiedKey]      = useState('');
  const [alertData,      setAlertData]      = useState<{isOpen:boolean;msg:string;type:'success'|'error'|'hapus'|'info'}>({isOpen:false,msg:'',type:'info'});
  const [confirmData,    setConfirmData]    = useState<{isOpen:boolean;title:string;message:string;action:(()=>void)|null}>({isOpen:false,title:'',message:'',action:null});

  // ── Dev Mode: skip konfirmasi TX (default OFF = selalu minta konfirmasi) ──
  const [devMode, setDevMode] = useState<boolean>(() => localStorage.getItem('devModeSkipTxConfirm') === 'true');
  useEffect(() => { localStorage.setItem('devModeSkipTxConfirm', String(devMode)); }, [devMode]);

  const [txConfirmModal, setTxConfirmModal] = useState<{isOpen:boolean; details: TxConfirmDetails|null}>({isOpen:false, details:null});
  const txConfirmResolverRef = useRef<((ok:boolean)=>void)|null>(null);

  // Modul konfirmasi TX — resolve(true) kalau user klik "Kirim Transaksi",
  // resolve(false) kalau batal. Kalau Dev Mode aktif, langsung lolos tanpa modal.
  const requestTxConfirm = useCallback((details: TxConfirmDetails): Promise<boolean> => {
    if (devMode) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      txConfirmResolverRef.current = resolve;
      setTxConfirmModal({ isOpen: true, details });
    });
  }, [devMode]);

  const handleTxConfirmDecision = (ok: boolean) => {
    setTxConfirmModal({ isOpen: false, details: null });
    txConfirmResolverRef.current?.(ok);
    txConfirmResolverRef.current = null;
  };

  const [txChain,       setTxChain]       = useState<ChainKind>('evm');
  const [txNetworkId,   setTxNetworkId]   = useState<string>('sepolia');
  const [txPrivKey,     setTxPrivKey]     = useState('');
  const [txConnected,   setTxConnected]   = useState(false);
  const [txAddress,     setTxAddress]     = useState('');
  const [txBalance,     setTxBalance]     = useState('—');
  const [txLoadingBal,  setTxLoadingBal]  = useState(false);
  const [txSendTo,      setTxSendTo]      = useState('');
  const [txSendAmt,     setTxSendAmt]     = useState('');
  const [txSending,     setTxSending]     = useState(false);
  const [txConnecting,  setTxConnecting]  = useState(false);
  const [txStatus,      setTxStatus]      = useState<{type:'idle'|'pending'|'success'|'error';msg:string;hash?:string}>({type:'idle',msg:''});
  const [txWalletSel,   setTxWalletSel]   = useState('');

  // ── ERC-20 asset selector untuk Kirim (single) di EVM ──
  const [txAsset,        setTxAsset]        = useState<string>('native'); // 'native' atau contract address token
  const [txTokens,       setTxTokens]       = useState<{address:string;symbol:string;decimals:number;name:string;balance:string}[]>([]);
  const [txTokensLoading,setTxTokensLoading]= useState(false);
  const [txAddTokenAddr, setTxAddTokenAddr] = useState('');
  const [txAddingToken,  setTxAddingToken]  = useState(false);
  const [customErc20Tokens, setCustomErc20Tokens] = useState<{chainId:number;address:string;symbol:string;decimals:number;name:string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('customErc20Tokens') || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('customErc20Tokens', JSON.stringify(customErc20Tokens)); }, [customErc20Tokens]);

  const [txGasMode,     setTxGasMode]     = useState<'slow'|'standard'|'fast'|'manual'>('standard');
  const [txGasPrices,   setTxGasPrices]   = useState<{slow:number;standard:number;fast:number}|null>(null);
  const [txGasManual,   setTxGasManual]   = useState('');
  const [txGasLimit,    setTxGasLimit]    = useState('');
  const [txFetchingGas, setTxFetchingGas] = useState(false);
  const [txMode,        setTxMode]        = useState<'single'|'multi'|'sweep'>('single');
  const [txMultiRows,   setTxMultiRows]   = useState<{id:string;to:string;amount:string;status:'idle'|'pending'|'success'|'failed';hash?:string;error?:string}[]>([
    { id: '1', to: '', amount: '', status: 'idle' },
  ]);
  const [txMultiRunning, setTxMultiRunning] = useState(false);
  const [txMultiEqualAmt, setTxMultiEqualAmt] = useState('');
  const [sweepDestAddr,    setSweepDestAddr]    = useState('');
  const [sweepAmtMode,     setSweepAmtMode]     = useState<'all'|'fixed'>('all');
  const [sweepFixedAmt,    setSweepFixedAmt]    = useState('');
  const [sweepLeaveGas,    setSweepLeaveGas]    = useState('0.0005');
  const [sweepSources,     setSweepSources]     = useState<{id:string;label:string;address:string;privateKey:string;balance?:string;status:'idle'|'pending'|'success'|'failed'|'skipped';hash?:string;error?:string}[]>([]);
  const [sweepManualPK,    setSweepManualPK]    = useState('');
  const [sweepRunning,     setSweepRunning]     = useState(false);
  const [sweepDelayMs,     setSweepDelayMs]     = useState(1500);
  const [sweepFetchingBal, setSweepFetchingBal] = useState(false);
  const [gasAdvanced,   setGasAdvanced]   = useState(false);
  const [sweepAdvanced, setSweepAdvanced] = useState(false);

  const txProviderRef   = useRef<ethers.providers.JsonRpcProvider | null>(null);
  const txWalletRef     = useRef<ethers.Wallet | null>(null);
  const garapImportRef  = useRef<HTMLInputElement>(null);

  // ── Solana Send/Receive ──
  const [solNetId,       setSolNetId]       = useState('mainnet');
  const SOLANA_NETWORK = SOLANA_NETWORKS.find(n => n.id === solNetId) ?? SOLANA_NETWORKS[0];
  const [solPrivKey,    setSolPrivKey]    = useState('');
  const [solConnected,  setSolConnected]  = useState(false);
  const [solConnecting, setSolConnecting] = useState(false);
  const [solAddress,    setSolAddress]    = useState('');
  const [solBalance,    setSolBalance]    = useState('—');
  const [solLoadingBal, setSolLoadingBal] = useState(false);
  const [solFaucetLoading, setSolFaucetLoading] = useState(false);
  const [highlightFaucet,  setHighlightFaucet]  = useState(false);
  const [solSendTo,     setSolSendTo]     = useState('');
  const [solSendAmt,    setSolSendAmt]    = useState('');
  const [solSending,    setSolSending]    = useState(false);
  const [solWalletSel,  setSolWalletSel]  = useState('');
  const [solStatus,     setSolStatus]     = useState<{type:'idle'|'pending'|'success'|'error';msg:string;hash?:string}>({type:'idle',msg:''});
  const solConnRef      = useRef<Connection | null>(null);
  const solKeypairRef   = useRef<SolKeypair | null>(null);

  // Mode kirim: single / multi-send / sweep (mirror EVM)
  const [solMode, setSolMode] = useState<'single'|'multi'|'sweep'>('single');

  // Asset yang dikirim di mode single: 'native' (SOL) atau mint address token SPL
  const [solAsset,          setSolAsset]          = useState<string>('native');
  const [solTokens,         setSolTokens]         = useState<{mint:string; decimals:number; uiAmount:number}[]>([]);
  const [solTokensLoading,  setSolTokensLoading]  = useState(false);

  // Multi Send Solana
  const [solMultiRows, setSolMultiRows] = useState<{id:string;to:string;amount:string;status:'idle'|'pending'|'success'|'failed';hash?:string;error?:string}[]>([
    { id: '1', to: '', amount: '', status: 'idle' },
  ]);
  const [solMultiRunning,  setSolMultiRunning]  = useState(false);
  const [solMultiEqualAmt, setSolMultiEqualAmt] = useState('');

  // Sweep Solana
  const [solSweepDestAddr,   setSolSweepDestAddr]   = useState('');
  const [solSweepAmtMode,    setSolSweepAmtMode]    = useState<'all'|'fixed'>('all');
  const [solSweepFixedAmt,   setSolSweepFixedAmt]   = useState('');
  const [solSweepLeaveBuf,   setSolSweepLeaveBuf]   = useState('0.00001');
  const [solSweepSources,    setSolSweepSources]    = useState<{id:string;label:string;address:string;privateKey:string;balance?:string;status:'idle'|'pending'|'success'|'failed'|'skipped';hash?:string;error?:string}[]>([]);
  const [solSweepManualPK,   setSolSweepManualPK]   = useState('');
  const [solSweepRunning,    setSolSweepRunning]    = useState(false);
  const [solSweepDelayMs,    setSolSweepDelayMs]    = useState(1200);
  const [solSweepFetchingBal,setSolSweepFetchingBal]= useState(false);

  const [netForm,      setNetForm]      = useState<Omit<RPCNetwork,'id'>&{rpcRaw:string}>({name:'',chainId:0,symbol:'',rpcUrls:[],rpcRaw:'',explorerUrl:'',color:'#01a2ff'});
  const [netEditId,    setNetEditId]    = useState<string|null>(null);
  const [showNetForm,  setShowNetForm]  = useState(false);
  const [netSearch,    setNetSearch]    = useState('');

  const atEmptyForm: Omit<AirdropTask,'id'|'createdAt'|'doneAt'> = {
    projectName:'', network:'', taskType:'swap', description:'', txHash:'',
    walletAddress:'', status:'todo', priority:'medium', deadline:'', notes:'',
    contractAddress:'', contractAbi:'', contractFunc:'', contractArgs:'[]', ethValue:'0',
  };
  const [atForm,       setAtForm]       = useState<Omit<AirdropTask,'id'|'createdAt'|'doneAt'>>(atEmptyForm);
  const [atEditId,     setAtEditId]     = useState<string|null>(null);
  const [atFilter,     setAtFilter]     = useState<'all'|'todo'|'done'|'failed'>('all');
  const [atSearch,     setAtSearch]     = useState('');
  const [atShowForm,   setAtShowForm]   = useState(false);

  useEffect(() => { localStorage.setItem('bip39Wallets',        JSON.stringify(wallets));      }, [wallets]);
  useEffect(() => { localStorage.setItem('rpcNetworks',         JSON.stringify(networks));     }, [networks]);
  useEffect(() => { localStorage.setItem('walletAirdropTasks',  JSON.stringify(airdropTasks)); }, [airdropTasks]);

  // ── Deep link: page lain bisa arahkan ke sini via URL hash "#faucetsolana"
  //    (mis. tombol "Cari Faucet SOL" di page Faucet -> href="/wallet-gen#faucetsolana")
  //    Otomatis pindah ke tab Transfer, chain Solana, network Devnet, lalu scroll & highlight tombol faucet.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'faucetsolana') {
      setActiveTab('transfer');
      setTxChain('sol');
      setSolNetId(prev => (prev === 'mainnet' ? 'devnet' : prev));
      setHighlightFaucet(true);
      setTimeout(() => setHighlightFaucet(false), 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== 'transfer') return;
    if (window.location.hash.replace('#', '').toLowerCase() !== 'faucetsolana') return;
    const t = setTimeout(() => {
      document.getElementById('faucetsolana')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(t);
  }, [activeTab]);

  const [tosAgreed,       setTosAgreed]       = useState<boolean>(() => localStorage.getItem('tosAgreed') === 'true');
  const [tosChecked,      setTosChecked]      = useState<boolean[]>([false, false, false, false]);
  const tosAllChecked = tosChecked.every(Boolean);

  const handleTosAgree = () => {
    if (!tosAllChecked) return;
    localStorage.setItem('tosAgreed', 'true');
    setTosAgreed(true);
  };
  const [balCheckNetId,   setBalCheckNetId]   = useState<string>('ethereum');
  const [balResults,      setBalResults]      = useState<Record<string, { balance: string; loading: boolean; error: boolean }>>({});
  const [balChecking,     setBalChecking]     = useState(false);
  const [qrAddress,       setQrAddress]       = useState<string | null>(null);
  const [portfolioTarget,  setPortfolioTarget]  = useState<{ chain: ChainKind; address: string; walletName: string } | null>(null);
  const [portfolioNetId,   setPortfolioNetId]   = useState('ethereum');
  const [portfolioTokens,  setPortfolioTokens]  = useState<DetectedToken[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError,   setPortfolioError]   = useState('');
  const [csvExporting,    setCsvExporting]    = useState(false);
  const [agQueue,       setAgQueue]       = useState<TxQueueItem[]>(() => { try { return JSON.parse(localStorage.getItem(TX_QUEUE_KEY) || '[]'); } catch { return []; } });
  const [agHistory,     setAgHistory]     = useState<TxQueueItem[]>(() => { try { return JSON.parse(localStorage.getItem(TX_HISTORY_KEY) || '[]'); } catch { return []; } });
  const [agRunning,     setAgRunning]     = useState(false);
  const agStopRef = React.useRef(false);
  const [agSimMode,     setAgSimMode]     = useState(false);
  const [agGasPrice,    setAgGasPrice]    = useState('');
  const [agGasLimit,    setAgGasLimit]    = useState('200000');
  const [agTab,         setAgTab]         = useState<'queue'|'builder'|'reader'|'history'>('queue');
  const [agLog,         setAgLog]         = useState<string[]>([]);
  const agLogRef = React.useRef<HTMLDivElement>(null);
  const [agExpanded,    setAgExpanded]    = useState<string|null>(null);
  const [agContract,    setAgContract]    = useState<AutoContractCall>({ contractAddress:'', abi:'', functionName:'', args:'[]', value:'0' });
  const [agCalldata,    setAgCalldata]    = useState('');
  const [agTpl,         setAgTpl]         = useState('');
  const [agReadC,       setAgReadC]       = useState({ address:'', abi:'', func:'', args:'[]' });
  const [agReadResult,  setAgReadResult]  = useState('');
  const [agReading,     setAgReading]     = useState(false);
  const [agTaskSel,     setAgTaskSel]     = useState('');
  const [agSuggest,     setAgSuggest]     = useState<string[]>([]);

  const [execTaskId,    setExecTaskId]    = useState<string|null>(null);

  // ── Token Creator: ERC-20 (EVM) & SPL Token (Solana) ──
  const [tcChain, setTcChain] = useState<ChainKind>('evm');

  // -- ERC-20 --
  const [tcNetworkId,  setTcNetworkId]  = useState<string>('sepolia');
  const [tcWalletSel,  setTcWalletSel]  = useState('');
  const [tcPrivKey,    setTcPrivKey]    = useState('');
  const [tcName,       setTcName]       = useState('');
  const [tcSymbol,     setTcSymbol]     = useState('');
  const [tcDecimals,   setTcDecimals]   = useState('18');
  const [tcSupply,     setTcSupply]     = useState('1000000');
  const [tcDeploying,  setTcDeploying]  = useState(false);
  const [tcDeployStatus, setTcDeployStatus] = useState<{type:'idle'|'pending'|'success'|'error';msg:string}>({type:'idle',msg:''});
  const [erc20Tokens,  setErc20Tokens]  = useState<DeployedErc20Token[]>(() => {
    try { return JSON.parse(localStorage.getItem('erc20DeployedTokens') || '[]'); } catch { return []; }
  });

  // -- ERC-20: mode "Kode Solidity Kustom" (alternatif dari template bawaan) --
  const [tcEvmMode,        setTcEvmMode]        = useState<'template'|'custom'>('template');
  const [tcCustomSolidity, setTcCustomSolidity]  = useState('');
  const [tcCustomCtorArgs, setTcCustomCtorArgs]  = useState('[]');
  const [tcCompiling,      setTcCompiling]       = useState(false);
  const [tcCompileError,   setTcCompileError]    = useState('');
  const [tcCompiled,       setTcCompiled]        = useState<CompiledContract | null>(null);
  const [tcSecScanning,    setTcSecScanning]     = useState(false);
  const [tcSecResult,      setTcSecResult]       = useState<AiSecResult | null>(null);
  const [tcSecError,       setTcSecError]        = useState('');
  const [tcRiskAck,        setTcRiskAck]         = useState(false); // checkbox "paham risiko" utk kode berisiko tinggi/kritis

  // -- SPL Token --
  const [tcSolNetId,     setTcSolNetId]     = useState('mainnet');
  const [tcSolWalletSel, setTcSolWalletSel] = useState('');
  const [tcSolPrivKey,   setTcSolPrivKey]   = useState('');
  const [tcSolName,      setTcSolName]      = useState('');
  const [tcSolSymbol,    setTcSolSymbol]    = useState('');
  const [tcSolDecimals,  setTcSolDecimals]  = useState('9');
  const [tcSolSupply,    setTcSolSupply]    = useState('1000000');
  // -- Metadata on-chain (Metaplex) --
  const [tcSolAddMeta,     setTcSolAddMeta]     = useState(true); // toggle: sertakan metadata on-chain atau tidak
  const [tcSolUri,         setTcSolUri]         = useState('');   // URI ke JSON metadata (name/image/description/attributes)
  const [tcSolImageUrl,    setTcSolImageUrl]    = useState('');   // hanya utk preview lokal, tidak dikirim on-chain langsung
  const [tcSolDescription, setTcSolDescription] = useState('');   // hanya utk preview lokal, tidak dikirim on-chain langsung
  const [tcSolCreating,  setTcSolCreating]  = useState(false);
  const [tcSolStatus,    setTcSolStatus]    = useState<{type:'idle'|'pending'|'success'|'error';msg:string}>({type:'idle',msg:''});
  const [splTokens,      setSplTokens]      = useState<CreatedSplToken[]>(() => {
    try { return JSON.parse(localStorage.getItem('splCreatedTokens') || '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('erc20DeployedTokens', JSON.stringify(erc20Tokens)); }, [erc20Tokens]);
  useEffect(() => { localStorage.setItem('splCreatedTokens',   JSON.stringify(splTokens));   }, [splTokens]);
  const [execNetId,     setExecNetId]     = useState<string>('sepolia');
  const [execWalSel,    setExecWalSel]    = useState<string>('');
  const [execPrivKey,   setExecPrivKey]   = useState<string>('');
  const [execRunning,   setExecRunning]   = useState(false);
  const [execLog,       setExecLog]       = useState<string[]>([]);
  const [execContract,  setExecContract]  = useState<{
    contractAddress: string; contractAbi: string; contractFunc: string;
    contractArgs: string; ethValue: string;
  }>({ contractAddress:'', contractAbi:'', contractFunc:'', contractArgs:'[]', ethValue:'0' });
  const [execMode,      setExecMode]      = useState<'contract'|'raw'>('contract');
  const [execRawTo,     setExecRawTo]     = useState('');
  const [execRawVal,    setExecRawVal]    = useState('0');
  const [execRawData,   setExecRawData]   = useState('0x');
  const [execGasLimit,  setExecGasLimit]  = useState('');
  const [execSimFailed, setExecSimFailed] = useState(false);
  const [execReadResult, setExecReadResult] = useState<string | null>(null); // hasil eth_call view/pure
  const [batchModalOpen,   setBatchModalOpen]   = useState(false);
  const [batchNetId,       setBatchNetId]       = useState<string>('sepolia');
  const [batchWallets,     setBatchWallets]     = useState<{id:string;label:string;address:string;privateKey:string}[]>([]);
  const [batchManualPK,    setBatchManualPK]    = useState('');
  const [batchWalDelay,    setBatchWalDelay]    = useState<number>(3000);
  const [batchGasLimit,    setBatchGasLimit]    = useState<string>('');
  const [batchDelayMs,     setBatchDelayMs]     = useState<number>(2000);
  const [batchRunning,     setBatchRunning]     = useState(false);
  const [batchLog,         setBatchLog]         = useState<{id:string;msg:string;type:'info'|'ok'|'err'|'warn'}[]>([]);
  const [batchProgress,    setBatchProgress]    = useState<{walDone:number;walTotal:number;taskDone:number;taskTotal:number;currentWal:string;currentTask:string}>({walDone:0,walTotal:0,taskDone:0,taskTotal:0,currentWal:'',currentTask:''});
  const [batchDone,        setBatchDone]        = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoopEnabled, setBatchLoopEnabled] = useState(false);
  const [batchLoopMax,     setBatchLoopMax]     = useState(0);
  const [batchLoopDelay,   setBatchLoopDelay]   = useState(5000);
  const [batchLoopRound,   setBatchLoopRound]   = useState(0);
  const [batchRetryFailed, setBatchRetryFailed] = useState(false);
  const [batchRetryMax,    setBatchRetryMax]    = useState(3);
  const [batchRetryDelay,  setBatchRetryDelay]  = useState(2000);
  const [batchTaskNetworks, setBatchTaskNetworks] = useState<Record<string, string>>({});
  const batchStopRef = React.useRef(false);
  const batchLogRef  = React.useRef<HTMLDivElement>(null);

  const execAddLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setExecLog(prev => [...prev.slice(-99), `[${ts}] ${msg}`]);
  };

  const batchAddLog = (msg: string, type: 'info'|'ok'|'err'|'warn' = 'info') => {
    const ts = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const entry = { id: Date.now().toString() + Math.random(), msg: `[${ts}] ${msg}`, type };
    setBatchLog(prev => [...prev.slice(-499), entry]);
    setTimeout(() => { if (batchLogRef.current) batchLogRef.current.scrollTop = batchLogRef.current.scrollHeight; }, 30);
  };

  // helpers for multi-wallet management
  const addBatchWalletFromBIP39 = (val: string) => {
    if (!val || !val.includes(',')) return;
    const [wi, ai] = val.split(',').map(Number);
    const w = wallets[wi];
    const addr = w?.addresses.find(a => a.index === ai);
    if (!addr) return;
    const id = `${wi},${ai}`;
    if (batchWallets.some(bw => bw.id === id)) return; // already added
    setBatchWallets(prev => [...prev, { id, label: `[${w.name}] ${addr.address.slice(0,8)}…${addr.address.slice(-4)} (#${addr.index})`, address: addr.address, privateKey: addr.privateKey }]);
  };

  const addBatchWalletManual = () => {
    const pk = batchManualPK.trim();
    if (!pk) return;
    try {
      const w = new ethers.Wallet(pk);
      const id = `manual_${w.address}`;
      if (batchWallets.some(bw => bw.id === id)) { setBatchManualPK(''); return; }
      setBatchWallets(prev => [...prev, { id, label: `[Manual] ${w.address.slice(0,8)}…${w.address.slice(-4)}`, address: w.address, privateKey: pk }]);
      setBatchManualPK('');
    } catch { /* invalid PK */ }
  };

  const removeBatchWallet = (id: string) => setBatchWallets(prev => prev.filter(bw => bw.id !== id));

  const runBatchExec = async (tasks: AirdropTask[]) => {
    if (batchWallets.length === 0) { batchAddLog('Tambahkan minimal 1 wallet.', 'err'); return; }
    const defaultNet = networks.find(n => n.id === batchNetId);
    if (!defaultNet) { batchAddLog('Network default tidak valid.', 'err'); return; }

    // Check if multi-network mode is active
    const multiNetworkMode = tasks.some(t => batchTaskNetworks[t.id] && batchTaskNetworks[t.id] !== batchNetId);

    const okBatch = await requestTxConfirm({
      title: `Batch Garap — ${tasks.length} task × ${batchWallets.length} wallet`,
      network: defaultNet.name,
      extra: 'Batch akan mengirim banyak transaksi berturut-turut secara otomatis, tanpa konfirmasi per-TX. Pastikan daftar task & wallet sudah benar sebelum lanjut.',
    });
    if (!okBatch) { batchAddLog('[batal] Batch dibatalkan oleh user.', 'warn'); return; }

    setBatchRunning(true);
    setBatchDone(false);
    batchStopRef.current = false;
    setBatchLoopRound(0);
    setBatchProgress({ walDone:0, walTotal:batchWallets.length, taskDone:0, taskTotal:tasks.length, currentWal:'', currentTask:'' });

    // Provider cache: networkId -> provider
    const providerCache: Record<string, ethers.providers.JsonRpcProvider> = {};

    const getOrCreateProvider = async (net: RPCNetwork): Promise<ethers.providers.JsonRpcProvider> => {
      if (providerCache[net.id]) return providerCache[net.id];
      batchAddLog(`[+] Menghubungkan ke ${net.name}...`, 'info');
      const p = await getProvider(net);
      providerCache[net.id] = p;
      batchAddLog(`[done] Terhubung ke ${net.name}`, 'ok');
      return p;
    };

    // Pre-connect all required networks
    const requiredNetIds = new Set<string>([batchNetId]);
    tasks.forEach(t => { if (batchTaskNetworks[t.id]) requiredNetIds.add(batchTaskNetworks[t.id]); });
    if (requiredNetIds.size > 1) {
      batchAddLog(`[change] Multi-network mode: ${requiredNetIds.size} network akan digunakan`, 'info');
    }
    for (const netId of requiredNetIds) {
      const n = networks.find(x => x.id === netId);
      if (!n) { batchAddLog(`[X] Network "${netId}" tidak ditemukan.`, 'err'); setBatchRunning(false); return; }
      try { await getOrCreateProvider(n); } catch (e: any) {
        batchAddLog(`[X] Gagal connect ke ${n.name}: ${e.message}`, 'err');
        setBatchRunning(false); return;
      }
    }

    // Interruptible delay helper
    const interruptibleDelay = async (ms: number) => {
      const step = 200;
      let elapsed = 0;
      while (elapsed < ms) {
        if (batchStopRef.current) return;
        await new Promise(r => setTimeout(r, Math.min(step, ms - elapsed)));
        elapsed += step;
      }
    };

    let totalSuccess = 0;
    let totalFail    = 0;
    let round        = 0;

    while (true) {
      if (batchStopRef.current) break;

      round++;
      setBatchLoopRound(round);
      const isLooping = batchLoopEnabled;
      const maxRounds = batchLoopMax; // 0 = infinite

      if (isLooping) {
        batchAddLog(`━━━ Round ${round}${maxRounds > 0 ? ` / ${maxRounds}` : ' (∞)'} ━━━`, 'info');
      }

      let roundSuccess = 0;
      let roundFail    = 0;

      for (let wi = 0; wi < batchWallets.length; wi++) {
        if (batchStopRef.current) break;
        const bw = batchWallets[wi];
        setBatchProgress(p => ({ ...p, walDone: wi, walTotal: batchWallets.length, currentWal: bw.label, taskDone: 0, taskTotal: tasks.length, currentTask: '' }));

        // Wallet will be re-connected per task if network changes
        batchAddLog(`\n[wallet] Wallet [${wi+1}/${batchWallets.length}]: ${bw.address.slice(0,10)}…${bw.address.slice(-4)}`, 'info');

      setBatchProgress(p => ({ ...p, taskDone: 0, taskTotal: tasks.length, currentTask: '' }));
      for (let i = 0; i < tasks.length; i++) {
        if (batchStopRef.current) { batchAddLog('[stopbyuser] Dihentikan oleh user.', 'warn'); break; }
        const task = tasks[i];
        setBatchProgress(p => ({ ...p, taskDone: i, taskTotal: tasks.length, currentTask: task.projectName }));

        // Resolve network for this task
        const taskNetId = batchTaskNetworks[task.id] || batchNetId;
        const taskNet = networks.find(n => n.id === taskNetId) ?? defaultNet;
        const taskProvider = providerCache[taskNet.id];
        if (!taskProvider) {
          batchAddLog(`  [X] Provider untuk ${taskNet.name} tidak tersedia, skip.`, 'err');
          continue;
        }

        const maxAttempts = batchRetryFailed ? 1 + batchRetryMax : 1;
        let taskSuccess = false;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (batchStopRef.current) break;

          const attemptLabel = maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : '';
          const netLabel = taskNetId !== batchNetId ? ` [${taskNet.name}]` : '';
          batchAddLog(`  [Task ${i+1}/${tasks.length}] ${task.projectName}${netLabel}${attemptLabel}`, 'info');

          // Create wallet connected to the correct network provider
          let ethWallet: ethers.Wallet;
          try {
            ethWallet = new ethers.Wallet(bw.privateKey, taskProvider);
          } catch (e: any) {
            batchAddLog(`[X] Wallet ${wi+1} invalid: ${(e as any).message}`, 'err');
            break;
          }

          try {
            let txRequest: ethers.providers.TransactionRequest = {};
            if (task.contractAddress) {
              if (task.contractAbi && task.contractFunc) {
                const iface = new ethers.utils.Interface(JSON.parse(task.contractAbi));
                const fragment = iface.getFunction(task.contractFunc);
                const _rawArgs = safeParseContractArgs(task.contractArgs || '[]');
                const args = _rawArgs.map((a: any, i: number) =>
                  parseArgWithAbiType(a, fragment.inputs[i] ?? { type: 'bytes' })
                );
                const data  = iface.encodeFunctionData(task.contractFunc, args);
                batchAddLog(`  Func: ${task.contractFunc}(${args.join(', ')})`, 'info');

                // ── VIEW / PURE: gunakan provider.call, jangan kirim TX ──
                const mut = (fragment as any).stateMutability as string;
                if (mut === 'view' || mut === 'pure') {
                  batchAddLog(`  [read-only] Fungsi "${task.contractFunc}" adalah ${mut} — eth_call (tanpa gas/TX).`, 'info');
                  const callResult = await ethWallet.provider.call({ to: task.contractAddress, data });
                  let decoded = callResult;
                  try {
                    const outTypes = fragment.outputs ?? [];
                    if (outTypes.length > 0) {
                      const dec = iface.decodeFunctionResult(task.contractFunc, callResult);
                      decoded = dec.map((v: any) => v.toString()).join(', ');
                    }
                  } catch { /* pakai raw hex */ }
                  batchAddLog(`  [result] ${decoded}`, 'ok');
                  taskSuccess = true;
                  setAirdropTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'done', doneAt: Date.now() } : t));
                  break; // selesai tanpa TX
                }

                // ── WRITE: lanjut sebagai TX ──
                txRequest = {
                  to: task.contractAddress,
                  value: task.ethValue && task.ethValue !== '0' ? ethers.utils.parseEther(task.ethValue) : ethers.BigNumber.from(0),
                  data,
                };
              } else {
                txRequest = { to: task.contractAddress, value: ethers.BigNumber.from(0), data: '0x' };
              }
            } else {
              batchAddLog(`  Skip — tidak ada contract address`, 'warn');
              taskSuccess = true; // skip bukan failure
              break;
            }

            if (batchStopRef.current) { batchAddLog('[stopbyuser] Dihentikan oleh user.', 'warn'); break; }

            if (batchGasLimit && parseInt(batchGasLimit) > 0) {
              txRequest.gasLimit = ethers.BigNumber.from(batchGasLimit);
            } else {
              try {
                const est = await ethWallet.estimateGas(txRequest);
                txRequest.gasLimit = est.mul(120).div(100);
                batchAddLog(`  Gas: ~${est.toNumber().toLocaleString()} (+20%)`, 'info');
              } catch (gasErr: any) {
                const reason = gasErr?.error?.reason ?? gasErr?.reason ?? gasErr?.message ?? '';
                batchAddLog(`  Simulasi REVERT: ${String(reason).slice(0, 80)}`, 'err');
                if (batchRetryFailed && attempt < maxAttempts && !batchStopRef.current) {
                  batchAddLog(`  🔄 Retry ${attempt}/${batchRetryMax} dalam ${batchRetryDelay}ms...`, 'warn');
                  await interruptibleDelay(batchRetryDelay);
                  continue;
                }
                roundFail++;
                setAirdropTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'failed' } : t));
                break;
              }
            }

            if (batchStopRef.current) { batchAddLog('[stopbyuser] Dihentikan oleh user.', 'warn'); break; }

            const tx = await ethWallet.sendTransaction(txRequest);
            batchAddLog(`  TX: ${tx.hash.slice(0, 20)}...`, 'ok');

            // Race tx.wait() against stop signal
            const receipt = await Promise.race([
              tx.wait(),
              new Promise<never>((_, rej) => {
                const poll = setInterval(() => {
                  if (batchStopRef.current) { clearInterval(poll); rej(new Error('__STOPPED__')); }
                }, 300);
                tx.wait().finally(() => clearInterval(poll));
              }),
            ]);

            if (batchStopRef.current) { batchAddLog('[stopbyuser] TX dikonfirmasi tapi batch dihentikan.', 'warn'); break; }

            batchAddLog(`  [done] Confirmed block #${receipt.blockNumber}${attempt > 1 ? ` (setelah ${attempt} attempt)` : ''}`, 'ok');
            roundSuccess++;
            taskSuccess = true;
            setAirdropTasks(prev => prev.map(t => t.id === task.id
              ? { ...t, txHash: tx.hash, walletAddress: ethWallet.address, status: 'done', doneAt: Date.now() }
              : t
            ));
            saveTxHistory({
              taskName: task.projectName,
              description: `[BATCH${isLooping ? ` R${round}`:''}] ${task.taskType.toUpperCase()} · ${task.network || taskNet.name} · block #${receipt.blockNumber}`,
              to: task.contractAddress || '',
              value: task.ethValue || '0',
              data: '0x',
              status: 'success',
              txHash: tx.hash,
              timestamp: Date.now(),
            });
            if (taskNet.explorerUrl) batchAddLog(`  ${taskNet.explorerUrl}/tx/${tx.hash}`, 'info');
            break; // sukses, keluar dari retry loop
          } catch (e: any) {
            const msg: string = e?.message ?? String(e);
            if (msg === '__STOPPED__') {
              batchAddLog('[stopbyuser] Dihentikan saat menunggu konfirmasi TX.', 'warn');
              break;
            }
            const parsed = parseTxError(e);
            batchAddLog(`  GAGAL: ${parsed.friendly}`, 'err');
            if (parsed.detail) batchAddLog(`  Detail: ${parsed.detail.slice(0, 120)}`, 'err');
            if (parsed.hint)   batchAddLog(`  💡 ${parsed.hint}`, 'warn');

            if (batchRetryFailed && attempt < maxAttempts && !batchStopRef.current) {
              batchAddLog(`  🔄 Retry ${attempt}/${batchRetryMax} dalam ${batchRetryDelay}ms...`, 'warn');
              await interruptibleDelay(batchRetryDelay);
            } else {
              roundFail++;
              setAirdropTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'failed' } : t));
            }
          }
        } // end retry loop

        if (batchStopRef.current) { batchAddLog('[stopbyuser] Dihentikan oleh user.', 'warn'); break; }

        if (!taskSuccess && batchRetryFailed) {
          batchAddLog(`  [X] Task "${task.projectName}" gagal setelah ${maxAttempts} attempt.`, 'err');
        }

        if (i < tasks.length - 1 && !batchStopRef.current && batchDelayMs > 0 && taskSuccess) {
          batchAddLog(`  Delay ${batchDelayMs}ms...`, 'info');
          await interruptibleDelay(batchDelayMs);
        }
        setBatchProgress(p => ({ ...p, taskDone: i + 1 }));
      }

        if (wi < batchWallets.length - 1 && !batchStopRef.current && batchWalDelay > 0) {
          batchAddLog(`⏳ Jeda ${batchWalDelay / 1000}s sebelum wallet berikutnya...`, 'info');
          await interruptibleDelay(batchWalDelay);
        }

        setBatchProgress(p => ({ ...p, walDone: wi + 1 }));
      }

      totalSuccess += roundSuccess;
      totalFail    += roundFail;

      if (isLooping) {
        batchAddLog(`Round ${round} selesai — Sukses: ${roundSuccess} | Gagal: ${roundFail} | Total: ${totalSuccess}[done] ${totalFail}[X]`, roundSuccess > 0 ? 'ok' : 'warn');
      }

      // Stop if user clicked stop
      if (batchStopRef.current) break;

      // Stop if not looping
      if (!isLooping) break;

      // Stop if max rounds reached
      if (maxRounds > 0 && round >= maxRounds) {
        batchAddLog(`[done] Selesai ${maxRounds} round.`, 'ok');
        break;
      }

      // Delay before next round
      if (batchLoopDelay > 0) {
        batchAddLog(`⏳ Jeda ${batchLoopDelay / 1000}s sebelum round ${round + 1}...`, 'info');
        await interruptibleDelay(batchLoopDelay);
        if (batchStopRef.current) break;
      }
    }

    batchAddLog(
      `🏁 Selesai! ${batchLoopEnabled ? `${round} round · ` : ''}Total: ${totalSuccess} sukses | ${totalFail} gagal`,
      totalSuccess > 0 ? 'ok' : 'warn'
    );
    setBatchRunning(false);
    setBatchDone(true);
    setBatchProgress(p => ({ ...p, currentTask: '', currentWal: '' }));
  };

  const openExecPanel = (task: AirdropTask) => {
    setExecTaskId(task.id);
    setExecLog([]);
    setExecReadResult(null);
    setExecContract({
      contractAddress: task.contractAddress || '',
      contractAbi:     task.contractAbi     || '',
      contractFunc:    task.contractFunc    || '',
      contractArgs:    task.contractArgs    || '[]',
      ethValue:        task.ethValue        || '0',
    });
    setExecMode(task.contractAddress ? 'contract' : 'raw');
    setExecRawTo(task.walletAddress ? '' : '');
    setExecRawVal('0');
    setExecRawData('0x');
    // pre-fill network from task.network name
    const matched = networks.find(n =>
      n.name.toLowerCase().includes(task.network.toLowerCase()) ||
      task.network.toLowerCase().includes(n.name.toLowerCase()) ||
      n.id.toLowerCase() === task.network.toLowerCase()
    );
    if (matched) setExecNetId(matched.id);
  };

  const handleExecWalSel = (val: string) => {
    setExecWalSel(val);
    if (!val || !val.includes(',')) { setExecPrivKey(''); return; }
    const [wi, ai] = val.split(',').map(Number);
    const addr = wallets[wi]?.addresses.find(a => a.index === ai);
    if (addr) setExecPrivKey(addr.privateKey);
  };

  const runExec = async (task: AirdropTask) => {
    if (!execPrivKey) { execAddLog('[X] Pilih wallet / masukkan private key.'); return; }
    const net = networks.find(n => n.id === execNetId);
    if (!net) { execAddLog('[X] Network tidak valid.'); return; }

    setExecRunning(true);
    setExecSimFailed(false);
    execAddLog(`[+] Menghubungkan ke ${net.name}...`);

    try {
      const provider = await getProvider(net);
      const wallet   = new ethers.Wallet(execPrivKey, provider);
      execAddLog(`[done] Terhubung: ${wallet.address}`);

      let txRequest: ethers.providers.TransactionRequest = {};

      if (execMode === 'contract' && execContract.contractAddress) {
        execAddLog(`[prepare] Mempersiapkan contract call ke ${shortAddr(execContract.contractAddress)}...`);
        if (execContract.contractAbi && execContract.contractFunc) {
          try {
            const iface = new ethers.utils.Interface(JSON.parse(execContract.contractAbi));
            const fragment = iface.getFunction(execContract.contractFunc);
            const _rawArgs = safeParseContractArgs(execContract.contractArgs || '[]');
            const args = _rawArgs.map((a: any, i: number) =>
              parseArgWithAbiType(a, fragment.inputs[i] ?? { type: 'bytes' })
            );
            const data  = iface.encodeFunctionData(execContract.contractFunc, args);
            execAddLog(`[</>]  Func: ${execContract.contractFunc}(${args.join(', ')})`);

            // ── VIEW / PURE: gunakan eth_call, jangan kirim TX ──
            const mut = (fragment as any).stateMutability as string;
            if (mut === 'view' || mut === 'pure') {
              execAddLog(`[read-only] Fungsi "${execContract.contractFunc}" adalah ${mut} — menggunakan eth_call (tidak ada gas/TX).`);
              const callResult = await provider.call({
                to:   execContract.contractAddress,
                data,
              });
              // Decode hasil jika ada outputs
              let decoded = callResult;
              try {
                const outTypes = fragment.outputs ?? [];
                if (outTypes.length > 0) {
                  const dec = iface.decodeFunctionResult(execContract.contractFunc, callResult);
                  decoded = dec.map((v: any) => v.toString()).join(', ');
                }
              } catch { /* pakai raw hex */ }
              execAddLog(`[result] ${decoded}`);
              setExecReadResult(decoded);
              setExecRunning(false);
              return;
            }
            // ── WRITE: lanjut sebagai TX ──
            txRequest = {
              to:    execContract.contractAddress,
              value: execContract.ethValue && execContract.ethValue !== '0'
                       ? ethers.utils.parseEther(execContract.ethValue)
                       : ethers.BigNumber.from(0),
              data,
            };
          } catch (e: any) {
            execAddLog(`[X] ABI encode error: ${e.message}`);
            setExecRunning(false);
            return;
          }
        } else {
          txRequest = {
            to:    execContract.contractAddress,
            value: execContract.ethValue && execContract.ethValue !== '0'
                     ? ethers.utils.parseEther(execContract.ethValue)
                     : ethers.BigNumber.from(0),
            data:  execContract.contractAbi || '0x',
          };
          execAddLog(`📤 Raw call ke kontrak (no ABI decode)`);
        }
      } else {
        if (!execRawTo) { execAddLog('[X] Masukkan address tujuan.'); setExecRunning(false); return; }
        txRequest = {
          to:    execRawTo,
          value: ethers.utils.parseEther(execRawVal || '0'),
          data:  execRawData || '0x',
        };
        execAddLog(`💸 Mengirim ${execRawVal} ${net.symbol} ke ${shortAddr(execRawTo)}`);
      }

      if (execGasLimit && parseInt(execGasLimit) > 0) {
        // User provided manual override — skip simulation entirely
        txRequest.gasLimit = ethers.BigNumber.from(execGasLimit);
        execAddLog(`[~] Gas limit manual: ${parseInt(execGasLimit).toLocaleString()}`);
      } else {
        execAddLog('[~] Estimasi gas...');
        try {
          const estimated = await wallet.estimateGas(txRequest);
          // Add 20% buffer
          const withBuffer = estimated.mul(120).div(100);
          txRequest.gasLimit = withBuffer;
          execAddLog(`[~] Gas: ~${estimated.toNumber().toLocaleString()} (+20% buffer → ${withBuffer.toNumber().toLocaleString()})`);
        } catch (gasErr: any) {
          // Detect revert vs generic failure
          const parsed   = parseTxError(gasErr);
          const isRevert = (gasErr?.message ?? '').toLowerCase().includes('revert')
            || (gasErr?.message ?? '').includes('UNPREDICTABLE_GAS_LIMIT');

          setExecSimFailed(true);

          if (isRevert) {
            execAddLog(`⚠️  Simulasi TX REVERT — ${parsed.friendly}`);
            if (parsed.detail) execAddLog(`   Detail: ${parsed.detail}`);
            if (parsed.hint)   execAddLog(`   💡 ${parsed.hint}`);
            else execAddLog(`   💡 Periksa args, saldo token, dan state kontrak.`);
            execAddLog(`   💡 Set gas limit manual di atas lalu coba lagi jika ingin force-send.`);
          } else {
            execAddLog(`⚠️  Gas estimasi gagal: ${parsed.friendly}`);
            if (parsed.detail) execAddLog(`   Detail: ${parsed.detail}`);
            execAddLog(`   💡 Set gas limit manual (misal: 200000) untuk force-send.`);
          }

          setExecRunning(false);
          return; // stop — don't send a tx that will definitely fail
        }
      }

      const okToSend = await requestTxConfirm({
        title: `Garap: ${task.projectName || task.taskType}`,
        network: net.name,
        to: (txRequest.to as string) || '',
        value: execMode === 'contract'
          ? `${execContract.ethValue || '0'} ${net.symbol}`
          : `${execRawVal || '0'} ${net.symbol}`,
        data: (txRequest.data as string) || '0x',
      });
      if (!okToSend) {
        execAddLog('[batal] Dibatalkan oleh user sebelum kirim.');
        setExecRunning(false);
        return;
      }

      execAddLog('[execute] Mengirim transaksi...');
      const tx = await wallet.sendTransaction(txRequest);
      execAddLog(`[send] TX terkirim! Hash: ${tx.hash}`);

      setAirdropTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, txHash: tx.hash, walletAddress: wallet.address, status: 'done', doneAt: Date.now(),
            contractAddress: execContract.contractAddress || t.contractAddress,
            contractAbi:     execContract.contractAbi     || t.contractAbi,
            contractFunc:    execContract.contractFunc    || t.contractFunc,
            contractArgs:    execContract.contractArgs    || t.contractArgs,
            ethValue:        execContract.ethValue        || t.ethValue,
          }
        : t
      ));

      execAddLog('⏳ Menunggu konfirmasi...');
      const receipt = await tx.wait();
      execAddLog(`[done] DIKONFIRMASI di block #${receipt.blockNumber}!`);
      setExecSimFailed(false);
      showAlert(`TX "${task.projectName}" berhasil! Block #${receipt.blockNumber}`, 'success');
      saveTxHistory({
        taskName: task.projectName,
        description: `${task.taskType.toUpperCase()} · ${task.network || net.name} · block #${receipt.blockNumber}`,
        to: execMode === 'contract' ? (execContract.contractAddress || execRawTo) : execRawTo,
        value: execMode === 'contract' ? (execContract.ethValue || '0') : execRawVal,
        data: '0x',
        status: 'success',
        txHash: tx.hash,
        timestamp: Date.now(),
      });

      const explorerUrl = net.explorerUrl ? `${net.explorerUrl}/tx/${tx.hash}` : '';
      if (explorerUrl) execAddLog(`🔗 Explorer: ${explorerUrl}`);

    } catch (e: any) {
      const parsed = parseTxError(e);
      execAddLog(`[X] GAGAL: ${parsed.friendly}`);
      if (parsed.detail) execAddLog(`   Detail: ${parsed.detail}`);
      if (parsed.hint)   execAddLog(`   💡 ${parsed.hint}`);
      setAirdropTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'failed' } : t));
      showAlert(`TX gagal: ${parsed.friendly}`, 'error');
    }
    setExecRunning(false);
  };
  // MetaMask connect for Auto Garap
  const [agWallet,      setAgWallet]      = useState({ address:'', chainId:0, chainName:'', balance:'0', connected:false });
  const [agConnecting,  setAgConnecting]  = useState(false);
  // Raw TX builder state
  const [agRawTo,       setAgRawTo]       = useState('');
  const [agRawVal,      setAgRawVal]      = useState('0');
  const [agRawData,     setAgRawData]     = useState('0x');
  const [agRawDesc,     setAgRawDesc]     = useState('');
  const [agRawTask,     setAgRawTask]     = useState('Manual');

  useEffect(() => { localStorage.setItem(TX_QUEUE_KEY, JSON.stringify(agQueue)); }, [agQueue]);
  useEffect(() => { localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(agHistory)); }, [agHistory]);
  useEffect(() => { if (agLogRef.current) agLogRef.current.scrollTop = agLogRef.current.scrollHeight; }, [agLog]);

  const agAddLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setAgLog(prev => [...prev.slice(-199), `[${ts}] ${msg}`]);
  };

  const getInjectProv = (): any => (window as any).ethereum || null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agConnectMM = async () => {
    const prov = getInjectProv();
    if (!prov) { agAddLog('[X] MetaMask tidak ditemukan. Install dulu.'); return; }
    setAgConnecting(true);
    agAddLog('🔌 Menghubungkan MetaMask...');
    try {
      const accounts: string[] = await prov.request({ method:'eth_requestAccounts' });
      const chainHex: string   = await prov.request({ method:'eth_chainId' });
      const chainId = parseInt(chainHex, 16);
      const address = accounts[0];
      const balHex: string = await prov.request({ method:'eth_getBalance', params:[address,'latest'] });
      const balance = weiToEthStr(balHex);
      const cName = networks.find(n => n.chainId === chainId)?.name ?? `Chain ${chainId}`;
      setAgWallet({ address, chainId, chainName: cName, balance, connected: true });
      agAddLog(`[done] Terhubung: ${shortAddr(address)} | ${cName} | ${balance} ETH`);
      try {
        const gp: string = await prov.request({ method:'eth_gasPrice' });
        setAgGasPrice((Number(BigInt(gp)) / 1e9).toFixed(2));
      } catch {}
    } catch (e: any) { agAddLog(`[X] Gagal: ${e?.message ?? e}`); }
    setAgConnecting(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agDisconnectMM = () => {
    setAgWallet({ address:'', chainId:0, chainName:'', balance:'0', connected:false });
    agAddLog('🔌 Disconnected.');
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agSwitchNetwork = async (chainId: number) => {
    const prov = getInjectProv();
    const net  = networks.find(n => n.chainId === chainId);
    if (!prov || !net) return;
    try {
      await prov.request({ method:'wallet_switchEthereumChain', params:[{ chainId:'0x'+chainId.toString(16) }] });
      setAgWallet(p => ({ ...p, chainId, chainName: net.name }));
      agAddLog(`[+] Pindah ke ${net.name}`);
    } catch (e: any) {
      if (e?.code === 4902) {
        try {
          await prov.request({ method:'wallet_addEthereumChain', params:[{
            chainId:'0x'+chainId.toString(16), chainName: net.name,
            rpcUrls: net.rpcUrls,
            nativeCurrency:{ name:net.symbol, symbol:net.symbol, decimals:18 },
            blockExplorerUrls: net.explorerUrl ? [net.explorerUrl] : [],
          }] });
          agAddLog(`➕ ${net.name} ditambahkan ke MetaMask`);
        } catch (ae: any) { agAddLog(`[X] Gagal tambah network: ${ae?.message}`); }
      } else { agAddLog(`[X] Gagal switch: ${e?.message}`); }
    }
  };

  const agRefreshBal = async () => {
    const prov = getInjectProv();
    if (!prov || !agWallet.address) return;
    const h: string = await prov.request({ method:'eth_getBalance', params:[agWallet.address,'latest'] });
    setAgWallet(p => ({ ...p, balance: weiToEthStr(h) }));
  };

  const agSendTx = async (item: TxQueueItem) => {
    const prov = getInjectProv();
    if (!prov) throw new Error('Wallet tidak terhubung');
    const params: any = {
      from: agWallet.address, to: item.to,
      value: ethToHex(item.value || '0'),
      data: item.data || '0x',
      gas: '0x' + parseInt(agGasLimit).toString(16),
    };
    if (agGasPrice) params.gasPrice = '0x' + Math.floor(parseFloat(agGasPrice) * 1e9).toString(16);
    const hash: string = await prov.request({ method:'eth_sendTransaction', params:[params] });
    return hash;
  };

  const agEstimateGas = async (item: TxQueueItem): Promise<string> => {
    const prov = getInjectProv();
    if (!prov || !agWallet.connected) return 'N/A';
    try {
      const g: string = await prov.request({ method:'eth_estimateGas', params:[{ from:agWallet.address, to:item.to, value:ethToHex(item.value||'0'), data:item.data||'0x' }] });
      return parseInt(g, 16).toLocaleString();
    } catch { return 'N/A'; }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agRunQueue = async () => {
    if (!agWallet.connected && !agSimMode) { agAddLog('[X] Hubungkan MetaMask atau aktifkan Sim Mode.'); return; }
    const pending = agQueue.filter(q => q.status === 'pending');
    if (!agSimMode) {
      const okAgent = await requestTxConfirm({
        title: `Jalankan Agent Queue — ${pending.length} TX`,
        network: agWallet.chainName || '-',
        extra: 'TX akan dikirim on-chain satu per satu tanpa konfirmasi per-item.',
      });
      if (!okAgent) { agAddLog('[batal] Dibatalkan oleh user.'); return; }
    }
    setAgRunning(true); agStopRef.current = false;
    agAddLog(`▶️ Menjalankan ${pending.length} TX pending...`);
    for (let i = 0; i < agQueue.length; i++) {
      if (agStopRef.current) { agAddLog('[stopbyuser] Dihentikan.'); break; }
      const item = agQueue[i];
      if (item.status !== 'pending') continue;
      setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status:'running' } : q));
      agAddLog(`[execute] TX: ${item.description} → ${shortAddr(item.to)}`);
      try {
        if (agWallet.connected && !agSimMode) {
          const est = await agEstimateGas(item);
          setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, gasEstimate: est } : q));
          agAddLog(`   [~] Gas: ${est}`);
        }
        await new Promise(r => setTimeout(r, 600));
        if (agSimMode) {
          const fakeHash = '0x' + Array.from({length:64}, () => Math.floor(Math.random()*16).toString(16)).join('');
          setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status:'success', txHash:fakeHash, timestamp:Date.now() } : q));
          agAddLog(`   [done] [SIM] ${fakeHash.slice(0,18)}...`);
        } else {
          const hash = await agSendTx(item);
          setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status:'success', txHash:hash, timestamp:Date.now() } : q));
          setAgHistory(prev => [{ ...item, status:'success', txHash:hash, timestamp:Date.now() }, ...prev.slice(0,299)]);
          agAddLog(`   [done] Hash: ${hash.slice(0,18)}...`);
        }
      } catch (e: any) {
        const parsed = parseTxError(e);
        setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status:'failed', error: parsed.friendly + (parsed.detail ? ` — ${parsed.detail}` : '') } : q));
        agAddLog(`   [X] ${parsed.friendly}`);
        if (parsed.detail) agAddLog(`      Detail: ${parsed.detail.slice(0, 120)}`);
        if (parsed.hint)   agAddLog(`      💡 ${parsed.hint}`);
      }
      await new Promise(r => setTimeout(r, 600));
    }
    setAgRunning(false); agAddLog('[done] Queue selesai.');
    if (agWallet.connected) agRefreshBal();
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agAddToQueue = (item: Omit<TxQueueItem,'id'|'status'>) =>
    setAgQueue(prev => [...prev, { ...item, id: Date.now().toString(), status:'pending' }]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agBuildCalldata = () => {
    try {
      const fd = parseAbiFunc(agContract.abi, agContract.functionName);
      if (!fd) { setAgCalldata('⚠️ Fungsi tidak ditemukan di ABI'); return; }
      const vals = JSON.parse(agContract.args);
      const types = fd.inputs.map((i: any) => i.type);
      const sig   = `${fd.name}(${types.join(',')})`;
      setAgCalldata(encodeAutoAbi(sig, types, vals));
    } catch (e: any) { setAgCalldata(`⚠️ Error: ${e?.message}`); }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agCallRead = async () => {
    const prov = getInjectProv();
    if (!prov) { setAgReadResult('[X] Wallet tidak terhubung'); return; }
    setAgReading(true); setAgReadResult('');
    try {
      const fd = parseAbiFunc(agReadC.abi, agReadC.func);
      if (!fd) throw new Error('Fungsi tidak ditemukan');
      const vals = JSON.parse(agReadC.args);
      const types = fd.inputs.map((i: any) => i.type);
      const data = encodeAutoAbi(`${fd.name}(${types.join(',')})`, types, vals);
      const res: string = await prov.request({ method:'eth_call', params:[{ to:agReadC.address, data },'latest'] });
      setAgReadResult(res);
    } catch (e: any) { setAgReadResult(`[X] ${e?.message}`); }
    setAgReading(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agPending  = agQueue.filter(q => q.status === 'pending').length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agSuccess  = agQueue.filter(q => q.status === 'success').length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agFailed   = agQueue.filter(q => q.status === 'failed').length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agNetColor = networks.find(n => n.chainId === agWallet.chainId)?.color ?? '#01a2ff';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agExplorer = networks.find(n => n.chainId === agWallet.chainId)?.explorerUrl ?? 'https://etherscan.io';

  const checkAllBalances = async () => {
    const net = networks.find(n => n.id === balCheckNetId);
    if (!net) return;
    const allAddresses = wallets.flatMap(w => w.addresses.map(a => ({ walletName: w.name, ...a })));
    if (allAddresses.length === 0) { showAlert('Belum ada wallet untuk dicek.', 'error'); return; }
    setBalChecking(true);
    const init: Record<string, { balance: string; loading: boolean; error: boolean }> = {};
    allAddresses.forEach(a => { init[a.address] = { balance: '...', loading: true, error: false }; });
    setBalResults(init);
    try {
      const provider = await getProvider(net);
      await Promise.all(allAddresses.map(async a => {
        try {
          const bal = await provider.getBalance(a.address);
          const formatted = parseFloat(ethers.utils.formatEther(bal)).toFixed(6) + ' ' + net.symbol;
          setBalResults(prev => ({ ...prev, [a.address]: { balance: formatted, loading: false, error: false } }));
        } catch {
          setBalResults(prev => ({ ...prev, [a.address]: { balance: 'Error', loading: false, error: true } }));
        }
      }));
    } catch (e: any) {
      showAlert('Gagal connect ke network: ' + e.message, 'error');
      allAddresses.forEach(a => setBalResults(prev => ({ ...prev, [a.address]: { balance: 'Error', loading: false, error: true } })));
    }
    setBalChecking(false);
  };

  // ── Token Portfolio: cek SEMUA token (ERC-20 / SPL) yang dipegang 1 address ──
  const scanPortfolioFor = useCallback(async (target: { chain: ChainKind; address: string }, netId: string) => {
    setPortfolioLoading(true);
    setPortfolioError('');
    setPortfolioTokens([]);
    try {
      const tokens = target.chain === 'sol'
        ? await fetchSolTokenPortfolio(target.address)
        : await fetchEvmTokenPortfolio(target.address, netId);
      tokens.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));
      setPortfolioTokens(tokens);
    } catch (e: any) {
      setPortfolioError(e?.message || 'Gagal mengambil data token.');
    }
    setPortfolioLoading(false);
  }, []);

  const openPortfolio = (chain: ChainKind, address: string, walletName: string) => {
    const target = { chain, address, walletName };
    setPortfolioTarget(target);
    scanPortfolioFor(target, portfolioNetId);
  };

  const changePortfolioNetwork = (netId: string) => {
    setPortfolioNetId(netId);
    if (portfolioTarget) scanPortfolioFor(portfolioTarget, netId);
  };

  const refreshPortfolio = () => {
    if (portfolioTarget) scanPortfolioFor(portfolioTarget, portfolioNetId);
  };

  const portfolioTotalUsd = portfolioTokens.reduce((sum, t) => sum + (t.usdValue ?? 0), 0);

  const PortfolioModal: React.FC<{
    target: { chain: ChainKind; address: string; walletName: string };
    onClose: () => void;
  }> = ({ target, onClose }) => (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${target.chain==='sol'?'#9945FF':'#01a2ff'}`, width:'100%', maxWidth:'560px', maxHeight:'82vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 18px', borderBottom:'1px solid #1a1a1a', display:'flex', alignItems:'center', gap:'10px' }}>
          <FaCoins color={target.chain==='sol'?'#9945FF':'#01a2ff'} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:'bold', fontSize:'14px' }}>Portofolio Token</div>
            <div style={{ fontSize:'11px', color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {target.walletName} · {target.address}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 10px', cursor:'pointer', fontSize:'12px' }}>Tutup</button>
        </div>

        {target.chain === 'evm' && (
          <div style={{ padding:'12px 18px', borderBottom:'1px solid #161616', display:'flex', alignItems:'center', gap:'8px' }}>
            <FaGlobe size={11} color="#555"/>
            <select value={portfolioNetId} onChange={e => changePortfolioNetwork(e.target.value)}
              style={{ flex:1, fontSize:'12px', fontFamily:'monospace', padding:'6px 8px' }}>
              {networks.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
            </select>
            <button onClick={refreshPortfolio} disabled={portfolioLoading}
              style={{ background:'none', border:'1px solid #333', color:'#888', padding:'6px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
              <FaSync size={10} style={{ animation: portfolioLoading ? 'spin 1s linear infinite' : undefined }}/> Refresh
            </button>
          </div>
        )}

        <div style={{ padding:'14px 18px', overflowY:'auto', flex:1 }}>
          {portfolioLoading && (
            <div style={{ textAlign:'center', color:'#555', padding:'30px 0', fontSize:'12px' }}>
              <FaSpinner style={{ animation:'spin 1s linear infinite', marginBottom:'8px' }} size={18}/>
              <div>Memindai token{target.chain==='evm' ? ' via Blockscout' : ' via Solana RPC + Jupiter'}...</div>
            </div>
          )}

          {!portfolioLoading && portfolioError && (
            <div style={{ background:'#2a0d0d', border:'1px solid #5a1e1e', color:'#ff8888', padding:'12px', fontSize:'12px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
              <FaExclamationTriangle style={{ marginTop:'2px', flexShrink:0 }}/>
              <span>{portfolioError}</span>
            </div>
          )}

          {!portfolioLoading && !portfolioError && portfolioTokens.length === 0 && (
            <div style={{ textAlign:'center', color:'#444', padding:'30px 0', fontSize:'12px' }}>
              Tidak ada token terdeteksi di address ini.
            </div>
          )}

          {!portfolioLoading && !portfolioError && portfolioTokens.length > 0 && (
            <>
              <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', padding:'12px 14px', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px' }}>Total Nilai (USD)</span>
                <span style={{ fontSize:'18px', fontWeight:'bold', color:'#4caf50', fontFamily:'monospace' }}>
                  {portfolioTotalUsd > 0 ? '$' + portfolioTotalUsd.toLocaleString('en-US', { maximumFractionDigits:2 }) : '—'}
                </span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {portfolioTokens.map(t => (
                  <div key={t.address} style={{ background:'#0a0a0a', border:'1px solid #151515', padding:'10px 12px', display:'flex', alignItems:'center', gap:'10px' }}>
                    {t.logo
                      ? <img src={t.logo} alt="" width={22} height={22} style={{ borderRadius:'50%', flexShrink:0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}/>
                      : <div style={{ width:22, height:22, borderRadius:'50%', background:'#1a1a1a', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color:'#555' }}>{t.symbol.slice(0,2).toUpperCase()}</div>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {t.symbol} <span style={{ color:'#555', fontWeight:'normal' }}>· {t.name}</span>
                      </div>
                      <div style={{ fontSize:'10px', color:'#444', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {t.address.slice(0,8)}…{t.address.slice(-4)}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:'12px', fontFamily:'monospace' }}>{t.balanceFormatted}</div>
                      <div style={{ fontSize:'11px', fontFamily:'monospace', color: t.usdValue !== null ? '#4caf50' : '#444' }}>
                        {t.usdValue !== null ? '$' + t.usdValue.toLocaleString('en-US', { maximumFractionDigits:2 }) : 'harga tidak tersedia'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const QRModal: React.FC<{ address: string; onClose: () => void }> = ({ address, onClose }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const size = 200;
      const cellSize = 6;
      const cells = Math.floor(size / cellSize);
      canvas.width  = size + 40;
      canvas.height = size + 40;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      const hash = address.toLowerCase().replace('0x', '');
      for (let row = 0; row < cells; row++) {
        for (let col = 0; col < cells; col++) {
          const charIdx = (row * cells + col) % hash.length;
          const val = parseInt(hash[charIdx], 16);
          if ((val + row + col) % 3 !== 0) {
            ctx.fillRect(20 + col * cellSize, 20 + row * cellSize, cellSize - 1, cellSize - 1);
          }
        }
      }
      [[0,0],[0,cells-7],[cells-7,0]].forEach(([r, c]) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(20 + c * cellSize, 20 + r * cellSize, 7 * cellSize, 7 * cellSize);
        ctx.fillStyle = '#fff';
        ctx.fillRect(20 + (c+1) * cellSize, 20 + (r+1) * cellSize, 5 * cellSize, 5 * cellSize);
        ctx.fillStyle = '#000';
        ctx.fillRect(20 + (c+2) * cellSize, 20 + (r+2) * cellSize, 3 * cellSize, 3 * cellSize);
      });
    }, [address]);

    const downloadQR = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `qr_${address.slice(0, 10)}.png`;
      a.click();
    };

    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}
        onClick={onClose}>
        <div style={{ background:'#111', border:'1px solid #333', padding:'24px', textAlign:'center', maxWidth:'340px', width:'90%' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'12px' }}>
            <FaQrcode style={{ marginRight:'5px' }}/>QR Code Address
          </div>
          <canvas ref={canvasRef} style={{ display:'block', margin:'0 auto 12px', border:'4px solid #fff', imageRendering:'pixelated' }}/>
          <code style={{ fontSize:'10px', color:'#888', wordBreak:'break-all', display:'block', marginBottom:'14px', fontFamily:'monospace' }}>
            {address}
          </code>
          <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
            <button onClick={downloadQR}
              style={{ background:'#01a2ff', color:'#000', border:'none', padding:'8px 18px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'6px' }}>
              <FaFileExport/> Download PNG
            </button>
            <button onClick={() => copyText(address, 'qr_addr')}
              style={{ background:'#111', color:'#888', border:'1px solid #333', padding:'8px 18px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
              {copiedKey === 'qr_addr' ? <><FaCheckCircle color="#4caf50"/> Tersalin!</> : <><FaCopy/> Salin</>}
            </button>
            <button onClick={onClose}
              style={{ background:'none', color:'#555', border:'1px solid #333', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  };

  const exportAllCSV = () => {
    if (wallets.length === 0) { showAlert('Tidak ada wallet untuk diekspor.', 'error'); return; }
    setCsvExporting(true);
    const rows: string[][] = [
      ['Wallet Name', 'Address Index', 'Address', 'Private Key', 'Mnemonic Word Count', 'Created At', 'Tags', 'Note'],
    ];
    wallets.forEach(w => {
      w.addresses.forEach(a => {
        rows.push([
          w.name,
          String(a.index),
          a.address,
          a.privateKey,
          String(w.mnemonic.split(' ').length),
          new Date(w.createdAt).toLocaleString('id-ID'),
          w.tags.join('; '),
          w.note,
        ]);
      });
    });
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `wallets_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setCsvExporting(false);
    showAlert(`${wallets.length} wallet berhasil diekspor ke CSV!`, 'success');
  };

  const showAlert = (msg: string, type: 'success'|'error'|'hapus'|'info' = 'info') =>
    setAlertData({ isOpen: true, msg, type });

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  const generateWallet = async () => {
    setGenerating(true);
    try {
      let mnemonic: string;
      if (importMode) {
        const words = customMnemonic.normalize('NFKD').trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (![12,15,18,21,24].includes(words.length)) {
          showAlert(`Jumlah kata tidak valid: ${words.length} (harus 12/15/18/21/24).`, 'error');
          setGenerating(false); return;
        }
        mnemonic = words.join(' ');
        if (!ethers.utils.isValidMnemonic(mnemonic)) {
          showAlert('Mnemonic tidak valid — cek ejaan kata-kata BIP39.', 'error');
          setGenerating(false); return;
        }
      } else {
        mnemonic = generateMnemonic(entropyBits);
      }
      const addresses: BIP39Wallet['addresses'] = [];
      const solAddresses: BIP39Wallet['addresses'] = [];
      for (let i = 0; i < addressCount; i++) {
        const { address, privateKey } = deriveAddress(mnemonic, i);
        addresses.push({ index: i, address, privateKey });
        const sol = deriveSolanaAddress(mnemonic, i);
        solAddresses.push({ index: i, address: sol.address, privateKey: sol.privateKey });
      }
      const newWallet: BIP39Wallet = {
        id: Date.now().toString(), name: walletName.trim() || `Wallet #${wallets.length + 1}`,
        mnemonic, addresses, solAddresses, createdAt: Date.now(), tags: [], note: '',
      };
      setWallets(prev => [newWallet, ...prev]);
      setExpandedId(newWallet.id);
      showAlert(importMode ? 'Mnemonic berhasil diimpor!' : 'Wallet BIP39 berhasil dibuat!', 'success');
      setWalletName(''); setCustomMnemonic(''); setImportMode(false);
    } catch (e: any) { showAlert('Gagal generate: ' + e.message, 'error'); }
    setGenerating(false);
  };

  const deriveMore = async (walletId: string, nextIndex: number) => {
    const w = wallets.find(x => x.id === walletId);
    if (!w) return;
    setGenerating(true);
    try {
      const existing = new Set(w.addresses.map(a => a.index));
      const newAddrs = [...w.addresses];
      const newSolAddrs = [...(w.solAddresses || [])];
      const existingSol = new Set(newSolAddrs.map(a => a.index));
      for (let i = 0; i <= nextIndex; i++) {
        if (!existing.has(i)) {
          const { address, privateKey } = deriveAddress(w.mnemonic, i);
          newAddrs.push({ index: i, address, privateKey });
        }
        if (!existingSol.has(i)) {
          const sol = deriveSolanaAddress(w.mnemonic, i);
          newSolAddrs.push({ index: i, address: sol.address, privateKey: sol.privateKey });
        }
      }
      newAddrs.sort((a, b) => a.index - b.index);
      newSolAddrs.sort((a, b) => a.index - b.index);
      setWallets(prev => prev.map(x => x.id === walletId ? { ...x, addresses: newAddrs, solAddresses: newSolAddrs } : x));
      showAlert('Address berhasil diturunkan!', 'success');
    } catch (e: any) { showAlert('Gagal: ' + e.message, 'error'); }
    setGenerating(false);
  };

  const deleteWallet = (id: string) => {
    setConfirmData({
      isOpen: true, title: 'HAPUS WALLET?',
      message: 'Data wallet + mnemonic akan dihapus permanen. Pastikan sudah backup!',
      action: () => { setWallets(prev => prev.filter(w => w.id !== id)); showAlert('Wallet dihapus.', 'hapus'); },
    });
  };

  const exportWallet = (w: BIP39Wallet) => {
    const blob = new Blob([JSON.stringify(w, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${w.name.replace(/\s/g,'_')}_wallet.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportGarapan = () => {
    if (airdropTasks.length === 0) { showAlert('Belum ada task untuk diexport.', 'error'); return; }
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      walletAirdropTasks: airdropTasks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `garap-hub-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert(`${airdropTasks.length} task berhasil diexport!`, 'success');
  };

  const handleGarapImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const imported: AirdropTask[] = parsed.walletAirdropTasks ?? parsed;
        if (!Array.isArray(imported)) throw new Error('Format tidak dikenali');
        setConfirmData({
          isOpen: true, title: 'IMPORT TASK?',
          message: `${imported.length} task akan digabung dengan data yang ada. Lanjutkan?`,
          action: () => {
            const existingIds = new Set(airdropTasks.map(t => t.id));
            const newTasks = imported.filter(t => !existingIds.has(t.id));
            setAirdropTasks(prev => [...newTasks, ...prev]);
            showAlert(`${newTasks.length} task baru berhasil diimport!`, 'success');
          },
        });
      } catch { showAlert('File tidak valid atau format salah.', 'error'); }
      if (garapImportRef.current) garapImportRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const saveTxHistory = (entry: Omit<TxQueueItem, 'id'>) => {
    const histEntry: TxQueueItem = { ...entry, id: Date.now().toString() + Math.random().toString(36).slice(2) };
    setAgHistory(prev => [histEntry, ...prev.slice(0, 499)]);
  };

  const filteredWallets = wallets.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.addresses.some(a => a.address.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedNetwork = networks.find(n => n.id === txNetworkId) ?? networks[0];

  // Daftar token ERC-20 yang dikenal untuk network aktif: gabungan token custom yang
  // ditambahkan manual + token yang pernah dideploy sendiri lewat Token Creator.
  const knownTxTokens = useMemo(() => {
    const chainId = selectedNetwork?.chainId;
    if (!chainId) return [];
    const fromCustom = customErc20Tokens.filter(t => t.chainId === chainId);
    const fromDeployed = erc20Tokens
      .filter(t => t.chainId === chainId)
      .map(t => ({ chainId: t.chainId, address: t.address, symbol: t.symbol, decimals: t.decimals, name: t.name }));
    const merged = [...fromCustom, ...fromDeployed];
    const seen = new Set<string>();
    return merged.filter(t => {
      const key = t.address.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [customErc20Tokens, erc20Tokens, selectedNetwork?.chainId]);

  const selectedTxToken = txAsset !== 'native' ? knownTxTokens.find(t => t.address.toLowerCase() === txAsset.toLowerCase()) : undefined;
  const txIsToken = txAsset !== 'native' && !!selectedTxToken;

  const txConnect = async () => {
    const pk = txPrivKey.trim();
    if (!pk) { showAlert('Masukkan private key dulu.', 'error'); return; }
    if (!selectedNetwork) { showAlert('Pilih network dulu.', 'error'); return; }
    setTxConnecting(true);
    setTxStatus({ type: 'idle', msg: '' });
    try {
      const provider = await getProvider(selectedNetwork);
      const wallet   = new ethers.Wallet(pk, provider);
      txProviderRef.current = provider;
      txWalletRef.current   = wallet;
      setTxAddress(wallet.address);
      setTxConnected(true);
      await txRefreshBalance(provider, wallet.address);
      await txFetchTokenBalances(provider, wallet.address);
      setTxFetchingGas(true);
      try {
        const feeData = await provider.getFeeData();
        const baseGwei = feeData.gasPrice ? parseFloat(ethers.utils.formatUnits(feeData.gasPrice, 'gwei')) : 1;
        setTxGasPrices({
          slow:     Math.max(0.001, baseGwei * 0.85),
          standard: Math.max(0.001, baseGwei),
          fast:     Math.max(0.001, baseGwei * 1.3),
        });
      } catch { /* ignore */ }
      setTxFetchingGas(false);
    } catch (e: any) { showAlert('Gagal connect: ' + e.message, 'error'); }
    setTxConnecting(false);
  };

  const txDisconnect = () => {
    txProviderRef.current = null;
    txWalletRef.current   = null;
    setTxConnected(false);
    setTxAddress('');
    setTxBalance('—');
    setTxPrivKey('');
    setTxWalletSel('');
    setTxStatus({ type: 'idle', msg: '' });
    setTxAsset('native');
    setTxTokens([]);
    setTxAddTokenAddr('');
  };

  const txRefreshBalance = async (
    prov?: ethers.providers.JsonRpcProvider | null,
    addr?: string,
  ) => {
    const provider = prov ?? txProviderRef.current;
    const address  = addr ?? txAddress;
    if (!provider || !address) return;
    setTxLoadingBal(true);
    try {
      const bal = await provider.getBalance(address);
      const sym = selectedNetwork?.symbol ?? 'ETH';
      setTxBalance(parseFloat(ethers.utils.formatEther(bal)).toFixed(6) + ' ' + sym);
    } catch { setTxBalance('Error'); }
    setTxLoadingBal(false);
  };

  // ── ERC-20: refresh saldo semua token yang dikenal untuk network aktif ──
  const txFetchTokenBalances = async (
    prov?: ethers.providers.JsonRpcProvider | null,
    addr?: string,
  ) => {
    const provider = prov ?? txProviderRef.current;
    const address  = addr ?? txAddress;
    if (!provider || !address || knownTxTokens.length === 0) { setTxTokens([]); return; }
    setTxTokensLoading(true);
    try {
      const results = await Promise.all(knownTxTokens.map(async (t) => {
        try {
          const c = new ethers.Contract(t.address, ERC20_ABI, provider);
          const bal = await c.balanceOf(address);
          return { address: t.address, symbol: t.symbol, decimals: t.decimals, name: t.name, balance: ethers.utils.formatUnits(bal, t.decimals) };
        } catch { return { address: t.address, symbol: t.symbol, decimals: t.decimals, name: t.name, balance: '0' }; }
      }));
      setTxTokens(results);
    } catch { setTxTokens([]); }
    setTxTokensLoading(false);
  };

  // ── ERC-20: tambah token custom dengan contract address (fetch name/symbol/decimals on-chain) ──
  const addCustomErc20Token = async () => {
    const addr = txAddTokenAddr.trim();
    if (!ethers.utils.isAddress(addr)) { showAlert('Contract address token tidak valid.', 'error'); return; }
    if (!selectedNetwork) { showAlert('Pilih network dulu.', 'error'); return; }
    const chainId = selectedNetwork.chainId;
    if (knownTxTokens.some(t => t.address.toLowerCase() === addr.toLowerCase())) {
      showAlert('Token ini sudah ada di daftar.', 'info');
      setTxAsset(addr); setTxAddTokenAddr('');
      return;
    }
    setTxAddingToken(true);
    try {
      const provider = txProviderRef.current ?? await getProvider(selectedNetwork);
      const c = new ethers.Contract(addr, ERC20_ABI, provider);
      const [name, symbol, decimals] = await Promise.all([c.name(), c.symbol(), c.decimals()]);
      setCustomErc20Tokens(prev => [...prev, { chainId, address: addr, symbol, decimals, name }]);
      setTxAsset(addr);
      setTxAddTokenAddr('');
      showAlert(`Token ${symbol} berhasil ditambahkan!`, 'success');
      if (txConnected) await txFetchTokenBalances();
    } catch (e: any) {
      showAlert('Gagal membaca info token — pastikan address kontrak ERC-20 valid di network ini.', 'error');
    }
    setTxAddingToken(false);
  };

  const removeCustomErc20Token = (address: string) => {
    setCustomErc20Tokens(prev => prev.filter(t => t.address.toLowerCase() !== address.toLowerCase()));
    if (txAsset.toLowerCase() === address.toLowerCase()) setTxAsset('native');
    setTxTokens(prev => prev.filter(t => t.address.toLowerCase() !== address.toLowerCase()));
  };

  const txFetchGasPrice = async () => {
    const provider = txProviderRef.current;
    if (!provider) return;
    setTxFetchingGas(true);
    try {
      const feeData = await provider.getFeeData();
      const baseGwei = feeData.gasPrice ? parseFloat(ethers.utils.formatUnits(feeData.gasPrice, 'gwei')) : 1;
      setTxGasPrices({
        slow:     Math.max(0.001, baseGwei * 0.85),
        standard: Math.max(0.001, baseGwei),
        fast:     Math.max(0.001, baseGwei * 1.3),
      });
    } catch { /* silently ignore */ }
    setTxFetchingGas(false);
  };

  const txGetGasPrice = (): ethers.BigNumber | undefined => {
    if (txGasMode === 'manual' && txGasManual) {
      try { return ethers.utils.parseUnits(txGasManual, 'gwei'); } catch { return undefined; }
    }
    if (!txGasPrices) return undefined;
    const gwei = txGasPrices[txGasMode as 'slow'|'standard'|'fast'] ?? txGasPrices.standard;
    try { return ethers.utils.parseUnits(gwei.toFixed(9), 'gwei'); } catch { return undefined; }
  };

  const txSend = async () => {
    const wallet = txWalletRef.current;
    if (!wallet) return;
    if (!ethers.utils.isAddress(txSendTo)) { showAlert('Address tujuan tidak valid.', 'error'); return; }
    const amt = parseFloat(txSendAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('Jumlah tidak valid.', 'error'); return; }

    const isToken = txAsset !== 'native';
    const token = isToken ? knownTxTokens.find(t => t.address.toLowerCase() === txAsset.toLowerCase()) : null;
    if (isToken && !token) { showAlert('Token tidak ditemukan di daftar.', 'error'); return; }

    const okSend = await requestTxConfirm({
      title: isToken ? 'Kirim Token ERC-20' : 'Kirim Transaksi',
      network: selectedNetwork?.name,
      to: txSendTo,
      value: isToken ? `${txSendAmt} ${token!.symbol} (kontrak ${shortAddr(token!.address)})` : `${txSendAmt} ${selectedNetwork?.symbol ?? 'ETH'}`,
    });
    if (!okSend) return;

    setTxSending(true);
    setTxStatus({ type: 'pending', msg: `Mengirim transaksi ke ${selectedNetwork?.name}...` });
    try {
      const gp = txGetGasPrice();
      let tx: ethers.providers.TransactionResponse;

      if (isToken && token) {
        const c = new ethers.Contract(token.address, ERC20_ABI, wallet);
        const amountBN = ethers.utils.parseUnits(txSendAmt, token.decimals);
        const overrides: ethers.PayableOverrides = { gasLimit: parseInt(txGasLimit) || 80000 };
        if (gp) overrides.gasPrice = gp;
        tx = await c.transfer(txSendTo, amountBN, overrides);
      } else {
        const txReq: ethers.providers.TransactionRequest = {
          to: txSendTo,
          value: ethers.utils.parseEther(txSendAmt),
          gasLimit: parseInt(txGasLimit) || 21000,
        };
        if (gp) txReq.gasPrice = gp;
        tx = await wallet.sendTransaction(txReq);
      }

      setTxStatus({ type: 'pending', msg: 'Tx terkirim! Menunggu konfirmasi...', hash: tx.hash });
      const receipt = await tx.wait();
      setTxStatus({ type: 'success', msg: `Dikonfirmasi di block #${receipt.blockNumber}`, hash: tx.hash });
      saveTxHistory({
        taskName: 'Transfer',
        description: isToken
          ? `Kirim ${txSendAmt} ${token!.symbol} ke ${shortAddr(txSendTo)} di ${selectedNetwork?.name ?? ''}`
          : `Kirim ${txSendAmt} ${selectedNetwork?.symbol ?? 'ETH'} ke ${shortAddr(txSendTo)} di ${selectedNetwork?.name ?? ''}`,
        to: txSendTo, value: txSendAmt, data: '0x',
        status: 'success', txHash: tx.hash, timestamp: Date.now(),
      });
      setTxSendTo(''); setTxSendAmt('');
      await txRefreshBalance();
      if (isToken) await txFetchTokenBalances();
    } catch (e: any) { setTxStatus({ type: 'error', msg: e.message }); }
    setTxSending(false);
  };

  // ══ Solana: connect / balance / send ══
  const solConnect = async () => {
    const pk = solPrivKey.trim();
    if (!pk) { showAlert('Masukkan private key Solana dulu (base58).', 'error'); return; }
    setSolConnecting(true);
    setSolStatus({ type: 'idle', msg: '' });
    try {
      const secret  = bs58.decode(pk);
      const keypair = SolKeypair.fromSecretKey(secret);
      const conn    = await getSolanaConnection(SOLANA_NETWORK);
      solConnRef.current    = conn;
      solKeypairRef.current = keypair;
      setSolAddress(keypair.publicKey.toBase58());
      setSolConnected(true);
      await solRefreshBalance(conn, keypair.publicKey.toBase58());
      await solFetchTokens(conn, keypair.publicKey.toBase58());
    } catch (e: any) { showAlert('Gagal connect: ' + e.message, 'error'); }
    setSolConnecting(false);
  };

  const solDisconnect = () => {
    solConnRef.current    = null;
    solKeypairRef.current = null;
    setSolConnected(false);
    setSolAddress('');
    setSolBalance('—');
    setSolPrivKey('');
    setSolWalletSel('');
    setSolStatus({ type: 'idle', msg: '' });
    setSolAsset('native');
    setSolTokens([]);
  };

  // ── SPL Token: fetch saldo token yang dipegang address aktif ──
  const solFetchTokens = async (conn?: Connection | null, addr?: string) => {
    const connection = conn ?? solConnRef.current;
    const address    = addr ?? solAddress;
    if (!connection || !address) return;
    setSolTokensLoading(true);
    try {
      const owner = new PublicKey(address);
      const resp  = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
      const tokens = resp.value
        .map(({ account }) => {
          const info = account.data.parsed.info;
          return {
            mint:     info.mint as string,
            decimals: info.tokenAmount.decimals as number,
            uiAmount: (info.tokenAmount.uiAmount ?? 0) as number,
          };
        })
        .filter(t => t.uiAmount > 0);
      setSolTokens(tokens);
    } catch { setSolTokens([]); }
    setSolTokensLoading(false);
  };

  const solRefreshBalance = async (conn?: Connection | null, addr?: string) => {
    const connection = conn ?? solConnRef.current;
    const address    = addr ?? solAddress;
    if (!connection || !address) return;
    setSolLoadingBal(true);
    try {
      const lamports = await connection.getBalance(new PublicKey(address));
      setSolBalance((lamports / LAMPORTS_PER_SOL).toFixed(6) + ' SOL');
    } catch { setSolBalance('Error'); }
    setSolLoadingBal(false);
  };

  // ── Ganti cluster Solana (Mainnet/Testnet/Devnet). Kalau sedang connected,
  //    reconnect pakai keypair yang sama & refresh saldo + token di cluster baru. ──
  const switchSolNetwork = async (newId: string) => {
    setSolNetId(newId);
    if (!solConnected || !solKeypairRef.current) return;
    const newNet = SOLANA_NETWORKS.find(n => n.id === newId) ?? SOLANA_NETWORKS[0];
    setSolLoadingBal(true);
    try {
      const conn = await getSolanaConnection(newNet);
      solConnRef.current = conn;
      await solRefreshBalance(conn, solAddress);
      await solFetchTokens(conn, solAddress);
    } catch (e: any) {
      showAlert(`Gagal pindah ke ${newNet.name}: ` + e.message, 'error');
    }
    setSolLoadingBal(false);
  };

  // ── Faucet: minta SOL gratis di Devnet/Testnet lewat RPC requestAirdrop ──
  const solRequestAirdrop = async () => {
    if (solNetId === 'mainnet') { showAlert('Faucet cuma tersedia di Devnet / Testnet.', 'error'); return; }
    if (!solConnRef.current || !solAddress) { showAlert('Connect wallet Solana dulu.', 'error'); return; }
    setSolFaucetLoading(true);
    try {
      const conn = solConnRef.current;
      const sig  = await conn.requestAirdrop(new PublicKey(solAddress), LAMPORTS_PER_SOL);
      const bh   = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
      showAlert(`Airdrop 1 SOL berhasil di ${SOLANA_NETWORK.name}!`, 'success');
      await solRefreshBalance(conn, solAddress);
    } catch (e: any) {
      const msg = e?.message || 'Gagal request airdrop.';
      if (/429|rate.?limit/i.test(msg)) {
        showAlert('Faucet RPC lagi dibatasi (rate limit). Tunggu beberapa menit, atau pakai faucet.solana.com / web faucet QuickNode secara manual.', 'error');
      } else if (/airdrop limit|faucet/i.test(msg)) {
        showAlert('Limit airdrop harian address ini sudah habis. Coba lagi besok atau pakai faucet eksternal.', 'error');
      } else {
        showAlert('Airdrop gagal: ' + msg, 'error');
      }
    }
    setSolFaucetLoading(false);
  };

  const handleSolWalletSel = (val: string) => {
    setSolWalletSel(val);
    if (!val) return;
    const [wi, ai] = val.split(',').map(Number);
    const w    = wallets[wi];
    const addr = w?.solAddresses?.find(a => a.index === ai);
    if (addr) setSolPrivKey(addr.privateKey);
  };

  const solSend = async () => {
    const keypair    = solKeypairRef.current;
    const connection = solConnRef.current;
    if (!keypair || !connection) return;
    let toPubkey: PublicKey;
    try { toPubkey = new PublicKey(solSendTo.trim()); }
    catch { showAlert('Address Solana tujuan tidak valid.', 'error'); return; }
    const amt = parseFloat(solSendAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('Jumlah tidak valid.', 'error'); return; }

    // ── Kirim token SPL ──
    if (solAsset !== 'native') {
      const token = solTokens.find(t => t.mint === solAsset);
      if (!token) { showAlert('Token tidak ditemukan di wallet ini.', 'error'); return; }

      const okSendToken = await requestTxConfirm({
        title: 'Kirim Token',
        network: SOLANA_NETWORK.name,
        to: solSendTo,
        value: `${solSendAmt} token (mint ${shortAddr(token.mint)})`,
      });
      if (!okSendToken) return;

      setSolSending(true);
      setSolStatus({ type: 'pending', msg: `Mengirim token ke ${SOLANA_NETWORK.name}...` });
      try {
        const mintPk  = new PublicKey(token.mint);
        const fromAta = await getAssociatedTokenAddress(mintPk, keypair.publicKey);
        const toAta   = await getAssociatedTokenAddress(mintPk, toPubkey);

        const tx = new SolTransaction();
        const toAtaInfo = await connection.getAccountInfo(toAta);
        if (!toAtaInfo) {
          // Address tujuan belum punya token account untuk mint ini — buatkan dulu.
          tx.add(createAssociatedTokenAccountInstruction(keypair.publicKey, toAta, toPubkey, mintPk));
        }
        const rawAmount = BigInt(Math.round(amt * 10 ** token.decimals));
        tx.add(createTransferInstruction(fromAta, toAta, keypair.publicKey, rawAmount));

        const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
        setSolStatus({ type: 'success', msg: 'Transaksi token dikonfirmasi', hash: sig });
        saveTxHistory({
          taskName: 'Transfer Token',
          description: `Kirim ${solSendAmt} token (mint ${shortAddr(token.mint)}) ke ${shortAddr(solSendTo)} di ${SOLANA_NETWORK.name}`,
          to: solSendTo, value: solSendAmt, data: '',
          status: 'success', txHash: sig, timestamp: Date.now(),
        });
        setSolSendTo(''); setSolSendAmt('');
        await solFetchTokens();
        await solRefreshBalance();
      } catch (e: any) { setSolStatus({ type: 'error', msg: e.message }); }
      setSolSending(false);
      return;
    }

    // ── Kirim SOL native ──
    const okSend = await requestTxConfirm({
      title: 'Kirim Transaksi',
      network: SOLANA_NETWORK.name,
      to: solSendTo,
      value: `${solSendAmt} SOL`,
    });
    if (!okSend) return;

    setSolSending(true);
    setSolStatus({ type: 'pending', msg: `Mengirim transaksi ke ${SOLANA_NETWORK.name}...` });
    try {
      const tx = new SolTransaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports: Math.round(amt * LAMPORTS_PER_SOL),
        })
      );
      const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
      setSolStatus({ type: 'success', msg: 'Transaksi dikonfirmasi', hash: sig });
      saveTxHistory({
        taskName: 'Transfer',
        description: `Kirim ${solSendAmt} SOL ke ${shortAddr(solSendTo)} di ${SOLANA_NETWORK.name}`,
        to: solSendTo, value: solSendAmt, data: '',
        status: 'success', txHash: sig, timestamp: Date.now(),
      });
      setSolSendTo(''); setSolSendAmt('');
      await solRefreshBalance();
    } catch (e: any) { setSolStatus({ type: 'error', msg: e.message }); }
    setSolSending(false);
  };

  // ══ Solana: Multi Send ══
  const solMultiAddRow = () =>
    setSolMultiRows(prev => [...prev, { id: Date.now().toString(), to: '', amount: '', status: 'idle' }]);

  const solMultiRemoveRow = (id: string) =>
    setSolMultiRows(prev => prev.filter(r => r.id !== id));

  const solMultiUpdateRow = (id: string, field: 'to'|'amount', val: string) =>
    setSolMultiRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const solMultiApplyEqual = () => {
    if (!solMultiEqualAmt) return;
    setSolMultiRows(prev => prev.map(r => ({ ...r, amount: solMultiEqualAmt })));
  };

  const solIsValidAddr = (addr: string) => { try { new PublicKey(addr.trim()); return true; } catch { return false; } };

  const selectedSolToken = solAsset !== 'native' ? solTokens.find(t => t.mint === solAsset) : undefined;
  const solIsToken = solAsset !== 'native' && !!selectedSolToken;

  const solMultiSend = async () => {
    const keypair    = solKeypairRef.current;
    const connection = solConnRef.current;
    if (!keypair || !connection) { showAlert('Wallet Solana tidak terhubung.', 'error'); return; }
    const validRows = solMultiRows.filter(r => solIsValidAddr(r.to) && parseFloat(r.amount) > 0);
    if (validRows.length === 0) { showAlert('Tidak ada baris valid (address + jumlah).', 'error'); return; }
    if (solAsset !== 'native' && !selectedSolToken) { showAlert('Token tidak ditemukan di wallet ini.', 'error'); return; }

    const assetLabel = solIsToken ? `token (mint ${shortAddr(selectedSolToken!.mint)})` : 'SOL';
    const totalAmt = validRows.reduce((a, r) => a + parseFloat(r.amount), 0);
    const okMulti = await requestTxConfirm({
      title: `Multi-Send — ${validRows.length} penerima`,
      network: SOLANA_NETWORK.name,
      value: `${totalAmt} ${assetLabel} (total)`,
      extra: 'TX akan dikirim satu per satu ke semua penerima di bawah, tanpa konfirmasi per-baris.',
    });
    if (!okMulti) return;

    setSolMultiRunning(true);
    setSolMultiRows(prev => prev.map(r => ({ ...r, status: 'idle', hash: undefined, error: undefined })));
    const mintPk = solIsToken ? new PublicKey(selectedSolToken!.mint) : null;

    for (const row of validRows) {
      setSolMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'pending' } : r));
      try {
        let sig: string;
        if (mintPk && selectedSolToken) {
          const toPubkey = new PublicKey(row.to.trim());
          const fromAta  = await getAssociatedTokenAddress(mintPk, keypair.publicKey);
          const toAta    = await getAssociatedTokenAddress(mintPk, toPubkey);
          const tx = new SolTransaction();
          const toAtaInfo = await connection.getAccountInfo(toAta);
          if (!toAtaInfo) tx.add(createAssociatedTokenAccountInstruction(keypair.publicKey, toAta, toPubkey, mintPk));
          const rawAmount = BigInt(Math.round(parseFloat(row.amount) * 10 ** selectedSolToken.decimals));
          tx.add(createTransferInstruction(fromAta, toAta, keypair.publicKey, rawAmount));
          sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
        } else {
          const toPubkey = new PublicKey(row.to.trim());
          const tx = new SolTransaction().add(SystemProgram.transfer({
            fromPubkey: keypair.publicKey, toPubkey, lamports: Math.round(parseFloat(row.amount) * LAMPORTS_PER_SOL),
          }));
          sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
        }
        setSolMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'success', hash: sig } : r));
        saveTxHistory({
          taskName: 'Multi-Send', description: `${row.amount} ${assetLabel} → ${shortAddr(row.to)} di ${SOLANA_NETWORK.name}`,
          to: row.to, value: row.amount, data: '',
          status: 'success', txHash: sig, timestamp: Date.now(),
        });
      } catch (e: any) {
        setSolMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'failed', error: e.message?.slice(0,120) } : r));
      }
    }
    setSolMultiRunning(false);
    await solRefreshBalance();
    if (solIsToken) await solFetchTokens();
  };

  // ══ Solana: Sweep ══
  const solSweepAddFromBIP39 = (val: string) => {
    if (!val || !val.includes(',')) return;
    const [wi, ai] = val.split(',').map(Number);
    const w    = wallets[wi];
    const addr = w?.solAddresses?.find(a => a.index === ai);
    if (!addr) return;
    const id = `bip39_${wi}_${ai}`;
    if (solSweepSources.some(s => s.id === id)) return;
    setSolSweepSources(prev => [...prev, {
      id, label: `[${w.name}] #${ai} ${addr.address.slice(0,10)}…`,
      address: addr.address, privateKey: addr.privateKey,
      status: 'idle',
    }]);
  };

  const solSweepAddManualPK = () => {
    const pk = solSweepManualPK.trim();
    if (!pk) return;
    try {
      const secret  = bs58.decode(pk);
      const keypair = SolKeypair.fromSecretKey(secret);
      const addr = keypair.publicKey.toBase58();
      const id   = `manual_${addr}`;
      if (solSweepSources.some(s => s.id === id)) { showAlert('Address sudah ada di daftar.', 'error'); return; }
      setSolSweepSources(prev => [...prev, {
        id, label: `Manual ${addr.slice(0,10)}…`,
        address: addr, privateKey: pk,
        status: 'idle',
      }]);
      setSolSweepManualPK('');
    } catch { showAlert('Private key Solana tidak valid.', 'error'); }
  };

  const solSweepRemoveSource = (id: string) =>
    setSolSweepSources(prev => prev.filter(s => s.id !== id));

  const solSweepFetchBalances = async () => {
    if (solSweepSources.length === 0) return;
    setSolSweepFetchingBal(true);
    try {
      const connection = await getSolanaConnection(SOLANA_NETWORK);
      if (solIsToken && selectedSolToken) {
        const mintPk = new PublicKey(selectedSolToken.mint);
        await Promise.all(solSweepSources.map(async s => {
          try {
            const owner = new PublicKey(s.address);
            const ata = await getAssociatedTokenAddress(mintPk, owner);
            const info = await connection.getTokenAccountBalance(ata).catch(() => null);
            const ui = info?.value?.uiAmount ?? 0;
            setSolSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: `${ui} (mint ${shortAddr(selectedSolToken.mint)})` } : x));
          } catch {
            setSolSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: '0' } : x));
          }
        }));
      } else {
        await Promise.all(solSweepSources.map(async s => {
          try {
            const lamports = await connection.getBalance(new PublicKey(s.address));
            setSolSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: (lamports / LAMPORTS_PER_SOL).toFixed(6) + ' SOL' } : x));
          } catch {
            setSolSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: 'Error' } : x));
          }
        }));
      }
    } catch (e: any) { showAlert('Gagal fetch balance: ' + e.message, 'error'); }
    setSolSweepFetchingBal(false);
  };

  // Base fee Solana per signature — jauh lebih kecil & stabil dibanding gas EVM.
  const SOL_BASE_FEE_LAMPORTS = 5000;

  const solSweepRun = async () => {
    if (!solIsValidAddr(solSweepDestAddr)) { showAlert('Address tujuan tidak valid.', 'error'); return; }
    if (solSweepSources.length === 0) { showAlert('Belum ada wallet sumber.', 'error'); return; }
    if (solAsset !== 'native' && !selectedSolToken) { showAlert('Token tidak ditemukan.', 'error'); return; }
    const isToken = solIsToken && !!selectedSolToken;

    const okSweep = await requestTxConfirm({
      title: `Sweep — ${solSweepSources.length} wallet sumber`,
      network: SOLANA_NETWORK.name,
      to: solSweepDestAddr,
      extra: isToken
        ? (solSweepAmtMode === 'all'
            ? `Akan mengirim seluruh saldo token (mint ${shortAddr(selectedSolToken!.mint)}) dari tiap wallet sumber. Wallet sumber tetap butuh sedikit SOL untuk fee.`
            : `Akan mengirim ${solSweepFixedAmt || '0'} token (mint ${shortAddr(selectedSolToken!.mint)}) dari tiap wallet sumber. Wallet sumber tetap butuh sedikit SOL untuk fee.`)
        : (solSweepAmtMode === 'all'
            ? 'Akan mengirim seluruh saldo (dikurangi fee) dari tiap wallet sumber ke address tujuan di atas.'
            : `Akan mengirim ${solSweepFixedAmt || '0'} SOL dari tiap wallet sumber ke address tujuan di atas.`),
    });
    if (!okSweep) return;

    setSolSweepRunning(true);
    setSolSweepSources(prev => prev.map(s => ({ ...s, status: 'idle', hash: undefined, error: undefined })));

    let connection: Connection;
    try {
      connection = await getSolanaConnection(SOLANA_NETWORK);
    } catch (e: any) {
      showAlert('Gagal connect ke network: ' + e.message, 'error');
      setSolSweepRunning(false);
      return;
    }

    const toPubkey = new PublicKey(solSweepDestAddr.trim());
    const leaveLamports = solSweepLeaveBuf && parseFloat(solSweepLeaveBuf) > 0
      ? Math.round(parseFloat(solSweepLeaveBuf) * LAMPORTS_PER_SOL) : 0;
    const mintPk = isToken ? new PublicKey(selectedSolToken!.mint) : null;

    for (const src of solSweepSources) {
      setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'pending' } : s));
      try {
        const secret  = bs58.decode(src.privateKey);
        const keypair = SolKeypair.fromSecretKey(secret);

        if (mintPk && selectedSolToken) {
          // ── Sweep token SPL: kirim seluruh (atau sebagian tetap) saldo token,
          //    fee tetap dibayar pakai SOL native milik wallet sumber. ──
          const fromAta = await getAssociatedTokenAddress(mintPk, keypair.publicKey);
          const info = await connection.getTokenAccountBalance(fromAta).catch(() => null);
          const rawBalance = info?.value ? BigInt(info.value.amount) : BigInt(0);

          if (rawBalance <= BigInt(0)) {
            setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped', error: 'Saldo token 0' } : s));
            if (solSweepDelayMs > 0) await new Promise(r => setTimeout(r, solSweepDelayMs));
            continue;
          }

          const rawAmount = solSweepAmtMode === 'all'
            ? rawBalance
            : BigInt(Math.round(parseFloat(solSweepFixedAmt || '0') * 10 ** selectedSolToken.decimals));

          if (rawAmount <= BigInt(0) || rawAmount > rawBalance) {
            setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped',
              error: rawAmount > rawBalance ? 'Jumlah melebihi saldo token' : 'Jumlah 0' } : s));
            if (solSweepDelayMs > 0) await new Promise(r => setTimeout(r, solSweepDelayMs));
            continue;
          }

          const toAta = await getAssociatedTokenAddress(mintPk, toPubkey);
          const toAtaInfo = await connection.getAccountInfo(toAta);
          const needsAtaCreate = !toAtaInfo;

          // Estimasi kebutuhan SOL: fee dasar + rent ATA baru (kalau tujuan belum punya token account untuk mint ini)
          const nativeBal = await connection.getBalance(keypair.publicKey);
          const estRentForAta = needsAtaCreate ? 2039280 : 0; // rent-exempt minimum utk token account (lamports)
          const requiredLamports = SOL_BASE_FEE_LAMPORTS + estRentForAta;
          if (nativeBal < requiredLamports) {
            setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped',
              error: `SOL tidak cukup untuk fee${needsAtaCreate ? '+rent ATA tujuan' : ''} (butuh ~${(requiredLamports/LAMPORTS_PER_SOL).toFixed(6)} SOL)` } : s));
            if (solSweepDelayMs > 0) await new Promise(r => setTimeout(r, solSweepDelayMs));
            continue;
          }

          const tx = new SolTransaction();
          if (needsAtaCreate) tx.add(createAssociatedTokenAccountInstruction(keypair.publicKey, toAta, toPubkey, mintPk));
          tx.add(createTransferInstruction(fromAta, toAta, keypair.publicKey, rawAmount));

          const uiAmount = Number(rawAmount) / 10 ** selectedSolToken.decimals;
          setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, balance: `sending ${uiAmount}...` } : s));

          const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
          setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'success', hash: sig, balance: `sent ${uiAmount} (mint ${shortAddr(selectedSolToken.mint)})` } : s));
          saveTxHistory({
            taskName: 'Sweep Token',
            description: `${uiAmount} token (mint ${shortAddr(selectedSolToken.mint)}) dari ${shortAddr(src.address)} → ${shortAddr(solSweepDestAddr)} di ${SOLANA_NETWORK.name}`,
            to: solSweepDestAddr, value: String(uiAmount), data: '',
            status: 'success', txHash: sig, timestamp: Date.now(),
          });
        } else {
          // ── Sweep SOL native ──
          const lamports = await connection.getBalance(keypair.publicKey);

          let sendLamports: number;
          if (solSweepAmtMode === 'all') {
            sendLamports = lamports - SOL_BASE_FEE_LAMPORTS - leaveLamports;
          } else {
            sendLamports = Math.round(parseFloat(solSweepFixedAmt || '0') * LAMPORTS_PER_SOL);
          }

          if (sendLamports <= 0) {
            setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped',
              error: `Saldo (${(lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL) tidak cukup untuk fee` } : s));
            if (solSweepDelayMs > 0) await new Promise(r => setTimeout(r, solSweepDelayMs));
            continue;
          }

          const tx = new SolTransaction().add(SystemProgram.transfer({
            fromPubkey: keypair.publicKey, toPubkey, lamports: sendLamports,
          }));
          const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
          const sentSol = (sendLamports / LAMPORTS_PER_SOL).toFixed(8);
          setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'success', hash: sig, balance: `sent ${sentSol} SOL` } : s));
          saveTxHistory({
            taskName: 'Sweep',
            description: `${sentSol} SOL dari ${shortAddr(src.address)} → ${shortAddr(solSweepDestAddr)} di ${SOLANA_NETWORK.name}`,
            to: solSweepDestAddr, value: sentSol, data: '',
            status: 'success', txHash: sig, timestamp: Date.now(),
          });
        }
      } catch (e: any) {
        setSolSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'failed', error: e.message?.slice(0,160) } : s));
      }
      if (solSweepDelayMs > 0) await new Promise(r => setTimeout(r, solSweepDelayMs));
    }
    setSolSweepRunning(false);
    await solSweepFetchBalances();
  };

  const txMultiAddRow = () =>
    setTxMultiRows(prev => [...prev, { id: Date.now().toString(), to: '', amount: '', status: 'idle' }]);

  const txMultiRemoveRow = (id: string) =>
    setTxMultiRows(prev => prev.filter(r => r.id !== id));

  const txMultiUpdateRow = (id: string, field: 'to'|'amount', val: string) =>
    setTxMultiRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const txMultiApplyEqual = () => {
    if (!txMultiEqualAmt) return;
    setTxMultiRows(prev => prev.map(r => ({ ...r, amount: txMultiEqualAmt })));
  };

  const txMultiSend = async () => {
    const wallet = txWalletRef.current;
    if (!wallet) { showAlert('Wallet tidak terhubung.', 'error'); return; }
    const validRows = txMultiRows.filter(r => ethers.utils.isAddress(r.to) && parseFloat(r.amount) > 0);
    if (validRows.length === 0) { showAlert('Tidak ada baris valid (address + jumlah).', 'error'); return; }
    if (txAsset !== 'native' && !selectedTxToken) { showAlert('Token tidak ditemukan di daftar.', 'error'); return; }

    const assetSymbol = txIsToken ? selectedTxToken!.symbol : (selectedNetwork?.symbol ?? 'ETH');
    const totalAmt = validRows.reduce((a, r) => a + parseFloat(r.amount), 0);
    const okMulti = await requestTxConfirm({
      title: `Multi-Send — ${validRows.length} penerima`,
      network: selectedNetwork?.name,
      value: `${totalAmt} ${assetSymbol} (total)`,
      extra: txIsToken
        ? `Token: ${selectedTxToken!.symbol} (${shortAddr(selectedTxToken!.address)}). TX dikirim satu per satu, tanpa konfirmasi per-baris. Pastikan wallet punya cukup ${selectedNetwork?.symbol ?? 'native coin'} untuk gas.`
        : 'TX akan dikirim satu per satu ke semua penerima di bawah, tanpa konfirmasi per-baris.',
    });
    if (!okMulti) return;

    setTxMultiRunning(true);
    setTxMultiRows(prev => prev.map(r => ({ ...r, status: 'idle', hash: undefined, error: undefined })));
    const gp = txGetGasPrice();
    const tokenContract = txIsToken ? new ethers.Contract(selectedTxToken!.address, ERC20_ABI, wallet) : null;

    for (const row of validRows) {
      setTxMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'pending' } : r));
      try {
        let tx: ethers.providers.TransactionResponse;
        if (tokenContract && selectedTxToken) {
          const amountBN = ethers.utils.parseUnits(row.amount, selectedTxToken.decimals);
          const overrides: ethers.PayableOverrides = { gasLimit: parseInt(txGasLimit) || 80000 };
          if (gp) overrides.gasPrice = gp;
          tx = await tokenContract.transfer(row.to, amountBN, overrides);
        } else {
          const txReq: ethers.providers.TransactionRequest = {
            to: row.to,
            value: ethers.utils.parseEther(row.amount),
            gasLimit: parseInt(txGasLimit) || 21000,
          };
          if (gp) txReq.gasPrice = gp;
          tx = await wallet.sendTransaction(txReq);
        }
        await tx.wait();
        setTxMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'success', hash: tx.hash } : r));
        saveTxHistory({
          taskName: 'Multi-Send', description: `${row.amount} ${assetSymbol} → ${shortAddr(row.to)}`,
          to: row.to, value: row.amount, data: '0x',
          status: 'success', txHash: tx.hash, timestamp: Date.now(),
        });
      } catch (e: any) {
        setTxMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'failed', error: e.message?.slice(0,120) } : r));
      }
    }
    setTxMultiRunning(false);
    await txRefreshBalance();
    if (txIsToken) await txFetchTokenBalances();
  };

  const sweepAddFromBIP39 = (val: string) => {
    if (!val || !val.includes(',')) return;
    const [wi, ai] = val.split(',').map(Number);
    const w = wallets[wi];
    const addr = w?.addresses.find(a => a.index === ai);
    if (!addr) return;
    const id = `bip39_${wi}_${ai}`;
    if (sweepSources.some(s => s.id === id)) return;
    setSweepSources(prev => [...prev, {
      id, label: `[${w.name}] #${ai} ${addr.address.slice(0,10)}…`,
      address: addr.address, privateKey: addr.privateKey,
      status: 'idle',
    }]);
  };

  const sweepAddManualPK = () => {
    const pk = sweepManualPK.trim();
    if (!pk) return;
    try {
      const wallet = new ethers.Wallet(pk);
      const id = `manual_${wallet.address}`;
      if (sweepSources.some(s => s.id === id)) { showAlert('Address sudah ada di daftar.', 'error'); return; }
      setSweepSources(prev => [...prev, {
        id, label: `Manual ${wallet.address.slice(0,10)}…`,
        address: wallet.address, privateKey: pk,
        status: 'idle',
      }]);
      setSweepManualPK('');
    } catch { showAlert('Private key tidak valid.', 'error'); }
  };

  const sweepRemoveSource = (id: string) =>
    setSweepSources(prev => prev.filter(s => s.id !== id));

  const sweepFetchBalances = async () => {
    const net = selectedNetwork;
    if (!net || sweepSources.length === 0) return;
    setSweepFetchingBal(true);
    try {
      const provider = await getProvider(net);
      if (txIsToken && selectedTxToken) {
        const c = new ethers.Contract(selectedTxToken.address, ERC20_ABI, provider);
        await Promise.all(sweepSources.map(async s => {
          try {
            const bal = await c.balanceOf(s.address);
            const formatted = parseFloat(ethers.utils.formatUnits(bal, selectedTxToken.decimals)).toFixed(6) + ' ' + selectedTxToken.symbol;
            setSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: formatted } : x));
          } catch {
            setSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: 'Error' } : x));
          }
        }));
      } else {
        await Promise.all(sweepSources.map(async s => {
          try {
            const bal = await provider.getBalance(s.address);
            const formatted = parseFloat(ethers.utils.formatEther(bal)).toFixed(6) + ' ' + net.symbol;
            setSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: formatted } : x));
          } catch {
            setSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: 'Error' } : x));
          }
        }));
      }
    } catch (e: any) { showAlert('Gagal fetch balance: ' + e.message, 'error'); }
    setSweepFetchingBal(false);
  };

  const sweepRun = async () => {
    if (!ethers.utils.isAddress(sweepDestAddr)) { showAlert('Address tujuan tidak valid.', 'error'); return; }
    if (sweepSources.length === 0) { showAlert('Belum ada wallet sumber.', 'error'); return; }
    const net = selectedNetwork;
    if (!net) { showAlert('Pilih network dulu.', 'error'); return; }
    if (txAsset !== 'native' && !selectedTxToken) { showAlert('Token tidak ditemukan di daftar.', 'error'); return; }
    const isToken = txIsToken && !!selectedTxToken;

    const okSweep = await requestTxConfirm({
      title: `Sweep — ${sweepSources.length} wallet sumber`,
      network: net.name,
      to: sweepDestAddr,
      extra: isToken
        ? (sweepAmtMode === 'all'
            ? `Akan mengirim seluruh saldo token ${selectedTxToken!.symbol} dari tiap wallet sumber. Wallet sumber tetap butuh sedikit ${net.symbol} untuk bayar gas.`
            : `Akan mengirim ${sweepFixedAmt || '0'} ${selectedTxToken!.symbol} dari tiap wallet sumber. Wallet sumber tetap butuh sedikit ${net.symbol} untuk bayar gas.`)
        : (sweepAmtMode === 'all'
            ? 'Akan mengirim seluruh saldo (dikurangi gas) dari tiap wallet sumber ke address tujuan di atas.'
            : `Akan mengirim ${sweepFixedAmt || '0'} ${net.symbol} dari tiap wallet sumber ke address tujuan di atas.`),
    });
    if (!okSweep) return;

    setSweepRunning(true);
    setSweepSources(prev => prev.map(s => ({ ...s, status: 'idle', hash: undefined, error: undefined })));

    let provider: ethers.providers.JsonRpcProvider;
    try {
      provider = await getProvider(net);
    } catch (e: any) {
      showAlert('Gagal connect ke network: ' + e.message, 'error');
      setSweepRunning(false);
      return;
    }

    for (const src of sweepSources) {
      setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'pending' } : s));
      try {
        const wallet = new ethers.Wallet(src.privateKey, provider);

        // ── Query actual gas price from RPC directly (no artificial minimum) ──
        let effectiveGasPrice: ethers.BigNumber;
        try {
          const raw = await provider.send('eth_gasPrice', []);
          effectiveGasPrice = ethers.BigNumber.from(raw);
          if (effectiveGasPrice.lte(0)) effectiveGasPrice = ethers.BigNumber.from(1);
        } catch {
          try {
            const feeHistory = await provider.send('eth_feeHistory', ['0x1', 'latest', []]);
            const baseFeeHex: string = feeHistory?.baseFeePerGas?.[1] ?? feeHistory?.baseFeePerGas?.[0];
            effectiveGasPrice = baseFeeHex ? ethers.BigNumber.from(baseFeeHex) : ethers.BigNumber.from(1);
          } catch {
            effectiveGasPrice = ethers.BigNumber.from(1);
          }
        }

        if (isToken) {
          // ── Sweep token ERC-20: kirim seluruh (atau sebagian tetap) saldo token,
          //    gas tetap dibayar pakai native coin milik wallet sumber. ──
          const c = new ethers.Contract(selectedTxToken!.address, ERC20_ABI, wallet);
          const tokenBal: ethers.BigNumber = await c.balanceOf(wallet.address);

          if (tokenBal.lte(0)) {
            setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped', error: `Saldo ${selectedTxToken!.symbol} 0` } : s));
            if (sweepDelayMs > 0) await new Promise(r => setTimeout(r, sweepDelayMs));
            continue;
          }

          const sendAmt = sweepAmtMode === 'all'
            ? tokenBal
            : ethers.utils.parseUnits(sweepFixedAmt || '0', selectedTxToken!.decimals);

          if (sendAmt.lte(0) || sendAmt.gt(tokenBal)) {
            setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped',
              error: sendAmt.gt(tokenBal) ? 'Jumlah melebihi saldo token' : 'Jumlah 0' } : s));
            if (sweepDelayMs > 0) await new Promise(r => setTimeout(r, sweepDelayMs));
            continue;
          }

          const gasLimit = ethers.BigNumber.from(parseInt(txGasLimit) || 80000);
          const gasCost  = effectiveGasPrice.mul(gasLimit);
          const nativeBal = await provider.getBalance(wallet.address);
          if (nativeBal.lt(gasCost)) {
            setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped',
              error: `${net.symbol} tidak cukup untuk gas (butuh ~${ethers.utils.formatEther(gasCost)})` } : s));
            if (sweepDelayMs > 0) await new Promise(r => setTimeout(r, sweepDelayMs));
            continue;
          }

          const sendFormatted = parseFloat(ethers.utils.formatUnits(sendAmt, selectedTxToken!.decimals)).toFixed(8);
          setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, balance: `sending ${sendFormatted} ${selectedTxToken!.symbol}...` } : s));

          const tx = await c.transfer(sweepDestAddr, sendAmt, { gasLimit, gasPrice: effectiveGasPrice });
          await tx.wait();
          setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'success', hash: tx.hash,
            balance: `sent ${sendFormatted} ${selectedTxToken!.symbol}` } : s));
          saveTxHistory({
            taskName: 'Sweep Token',
            description: `${sendFormatted} ${selectedTxToken!.symbol} dari ${shortAddr(src.address)} → ${shortAddr(sweepDestAddr)}`,
            to: sweepDestAddr, value: sendFormatted, data: '0x',
            status: 'success', txHash: tx.hash, timestamp: Date.now(),
          });
        } else {
          // ── Sweep native coin ──
          const bal = await provider.getBalance(wallet.address);

          if (bal.lte(0)) {
            setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped', error: 'Saldo 0' } : s));
            if (sweepDelayMs > 0) await new Promise(r => setTimeout(r, sweepDelayMs));
            continue;
          }

          const gasLimit = ethers.BigNumber.from(21000);
          const gasCost = effectiveGasPrice.mul(gasLimit);

          let sendAmt: ethers.BigNumber;
          if (sweepAmtMode === 'all') {
            const leaveWei = sweepLeaveGas && parseFloat(sweepLeaveGas) > 0
              ? ethers.utils.parseEther(sweepLeaveGas)
              : ethers.BigNumber.from(0);
            sendAmt = bal.sub(gasCost).sub(leaveWei);
            if (sendAmt.lte(0)) {
              const minGasCost = ethers.BigNumber.from(21000);
              sendAmt = bal.sub(minGasCost).sub(leaveWei);
            }
          } else {
            sendAmt = ethers.utils.parseEther(sweepFixedAmt || '0');
          }

          if (sendAmt.lte(0)) {
            setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped',
              error: `Saldo (${ethers.utils.formatEther(bal)} ${net.symbol}) habis untuk gas` } : s));
            if (sweepDelayMs > 0) await new Promise(r => setTimeout(r, sweepDelayMs));
            continue;
          }

          const txReq: ethers.providers.TransactionRequest = {
            to: sweepDestAddr,
            value: sendAmt,
            gasLimit,
            gasPrice: effectiveGasPrice,
          };

          const gasCostEth = parseFloat(ethers.utils.formatEther(gasCost)).toFixed(10);
          const sendEth = parseFloat(ethers.utils.formatEther(sendAmt)).toFixed(10);
          setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s,
            balance: `gas: ${gasCostEth} | send: ${sendEth} ${net.symbol}` } : s));

          const tx = await wallet.sendTransaction(txReq);
          await tx.wait();
          const amtFormatted = parseFloat(ethers.utils.formatEther(sendAmt)).toFixed(8);
          setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'success', hash: tx.hash,
            balance: `sent ${amtFormatted} ${net.symbol}` } : s));
          saveTxHistory({
            taskName: 'Sweep',
            description: `${amtFormatted} ${net.symbol} dari ${shortAddr(src.address)} → ${shortAddr(sweepDestAddr)}`,
            to: sweepDestAddr, value: amtFormatted, data: '0x',
            status: 'success', txHash: tx.hash, timestamp: Date.now(),
          });
        }
      } catch (e: any) {
        setSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'failed', error: e.message?.slice(0, 160) } : s));
      }
      if (sweepDelayMs > 0) await new Promise(r => setTimeout(r, sweepDelayMs));
    }
    setSweepRunning(false);
    await sweepFetchBalances();
  };

  const handleTxWalletSel = (val: string) => {
    setTxWalletSel(val);
    if (!val || !val.includes(',')) return;
    const parts = val.split(',').map(Number);
    if (parts.some(isNaN)) return;
    const [wi, idx] = parts;
    const addr = wallets[wi]?.addresses.find(a => a.index === idx);
    if (addr) setTxPrivKey(addr.privateKey);
  };

  const saveNetwork = () => {
    if (!netForm.name || !netForm.chainId || !netForm.symbol) {
      showAlert('Nama, Chain ID, dan Symbol wajib diisi.', 'error'); return;
    }
    const urls = netForm.rpcRaw.split('\n').map(s => s.trim()).filter(Boolean);
    if (netEditId) {
      setNetworks(prev => prev.map(n => n.id === netEditId ? { ...netForm, rpcUrls: urls, id: netEditId } : n));
      showAlert('Network diperbarui!', 'success');
    } else {
      setNetworks(prev => [...prev, { ...netForm, rpcUrls: urls, id: Date.now().toString() }]);
      showAlert('Network ditambahkan!', 'success');
    }
    setNetForm({ name:'', chainId:0, symbol:'', rpcUrls:[], rpcRaw:'', explorerUrl:'', color:'#01a2ff' });
    setNetEditId(null); setShowNetForm(false);
  };

  const addToMetaMask = async (n: RPCNetwork) => {
    const w = (window as any).ethereum;
    if (!w) { showAlert('MetaMask tidak ditemukan!', 'error'); return; }
    try {
      await w.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId:'0x'+n.chainId.toString(16), chainName:n.name, nativeCurrency:{name:n.symbol,symbol:n.symbol,decimals:18}, rpcUrls:n.rpcUrls, blockExplorerUrls:n.explorerUrl?[n.explorerUrl]:undefined }],
      });
      showAlert(`${n.name} berhasil ditambahkan ke MetaMask!`, 'success');
    } catch (e: any) { showAlert('Gagal: ' + e.message, 'error'); }
  };

  const txStatusColor = { idle:'#555', pending:'#ffaa00', success:'#4caf50', error:'#f44336' }[txStatus.type];

  const saveAirdropTask = () => {
    if (!atForm.projectName) { showAlert('Nama project wajib diisi.', 'error'); return; }
    if (atEditId) {
      setAirdropTasks(prev => prev.map(t => t.id === atEditId ? { ...t, ...atForm } : t));
      showAlert('Task diperbarui!', 'success');
    } else {
      const newTask: AirdropTask = { ...atForm, id: Date.now().toString(), createdAt: Date.now() };
      setAirdropTasks(prev => [newTask, ...prev]);
      showAlert('Task ditambahkan!', 'success');
    }
    setAtForm(atEmptyForm); setAtEditId(null); setAtShowForm(false);
  };

  const markTaskDone = (id: string) => {
    setAirdropTasks(prev => prev.map(t => t.id === id
      ? { ...t, status: t.status === 'done' ? 'todo' : 'done', doneAt: t.status === 'done' ? undefined : Date.now() }
      : t
    ));
  };

  const deleteAirdropTask = (id: string) => {
    setConfirmData({
      isOpen: true, title: 'HAPUS TASK?', message: 'Task ini akan dihapus permanen.',
      action: () => { setAirdropTasks(prev => prev.filter(t => t.id !== id)); showAlert('Task dihapus.', 'hapus'); },
    });
  };

  const editAirdropTask = (t: AirdropTask) => {
    const { id, createdAt, doneAt, ...rest } = t;
    setAtForm(rest); setAtEditId(id); setAtShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredAtTasks = airdropTasks.filter(t => {
    const matchStatus = atFilter === 'all' || t.status === atFilter;
    const matchSearch = t.projectName.toLowerCase().includes(atSearch.toLowerCase()) ||
      t.network.toLowerCase().includes(atSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(atSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const atStats = {
    total: airdropTasks.length,
    todo:  airdropTasks.filter(t => t.status === 'todo').length,
    done:  airdropTasks.filter(t => t.status === 'done').length,
    failed:airdropTasks.filter(t => t.status === 'failed').length,
  };

  const filteredNetworks = networks.filter(n =>
    n.name.toLowerCase().includes(netSearch.toLowerCase()) ||
    n.symbol.toLowerCase().includes(netSearch.toLowerCase())
  );

  // ── Token Creator: helper & handlers ──
  const tcSelectedNetwork = networks.find(n => n.id === tcNetworkId) ?? networks[0];

  const handleTcWalletSel = (val: string) => {
    setTcWalletSel(val);
    if (!val || !val.includes(',')) return;
    const parts = val.split(',').map(Number);
    if (parts.some(isNaN)) return;
    const [wi, idx] = parts;
    const addr = wallets[wi]?.addresses.find(a => a.index === idx);
    if (addr) setTcPrivKey(addr.privateKey);
  };

  const handleTcSolWalletSel = (val: string) => {
    setTcSolWalletSel(val);
    if (!val) return;
    const [wi, ai] = val.split(',').map(Number);
    const w    = wallets[wi];
    const addr = w?.solAddresses?.find(a => a.index === ai);
    if (addr) setTcSolPrivKey(addr.privateKey);
  };

  // -- Kompilasi kode Solidity kustom (mode "Custom") jadi ABI + bytecode --
  const compileTcCustomContract = async () => {
    if (!tcCustomSolidity.trim()) { showAlert('Paste kode Solidity dulu.', 'error'); return; }
    setTcCompiling(true);
    setTcCompileError('');
    setTcCompiled(null);
    try {
      const result = await compileSolidity(tcCustomSolidity);
      setTcCompiled(result);
      showAlert(`Compile berhasil: contract "${result.contractName}"${result.warnings.length ? ` (${result.warnings.length} warning)` : ''}.`, 'success');
    } catch (e: any) {
      setTcCompileError(e?.message || 'Gagal compile kode Solidity.');
    }
    setTcCompiling(false);
  };

  // -- Scan keamanan AI atas kode Solidity kustom sebelum deploy --
  // Setiap kali kode diubah, hasil scan lama otomatis di-reset (lihat onChange textarea) supaya
  // orang tidak bisa "scan sekali lalu ubah kode jadi berbahaya" dan tetap lolos gate deploy.
  const runTcSecurityScan = async () => {
    if (!tcCustomSolidity.trim()) { showAlert('Paste kode Solidity dulu.', 'error'); return; }
    setTcSecScanning(true);
    setTcSecError('');
    setTcSecResult(null);
    setTcRiskAck(false);
    try {
      const result = await runAiCodeSecurityScan(tcCustomSolidity, 'solidity');
      setTcSecResult(result);
    } catch (e: any) {
      setTcSecError(e?.message || 'Gagal menganalisis keamanan kode.');
    }
    setTcSecScanning(false);
  };

  // -- Deploy kontrak ERC-20 ke jaringan EVM yang dipilih --
  const deployErc20Token = async () => {
    const pk = tcPrivKey.trim();
    if (!pk)                    { showAlert('Pilih wallet atau masukkan private key deployer.', 'error'); return; }
    if (!tcSelectedNetwork)     { showAlert('Pilih network dulu.', 'error'); return; }

    // ══ Mode: Kode Solidity Kustom ══
    if (tcEvmMode === 'custom') {
      if (!tcCompiled) { showAlert('Compile kode Solidity dulu sebelum deploy.', 'error'); return; }
      if (!tcSecResult) { showAlert('Jalankan scan keamanan dulu sebelum deploy — wajib untuk kode kustom.', 'error'); return; }
      if ((tcSecResult.verdict === 'HIGH_RISK' || tcSecResult.verdict === 'CRITICAL') && !tcRiskAck) {
        showAlert('Hasil scan menunjukkan risiko tinggi/kritis. Centang konfirmasi "saya paham risiko" dulu kalau tetap ingin deploy.', 'error');
        return;
      }

      const ctorFragment = (tcCompiled.abi || []).find((f: any) => f.type === 'constructor');
      let ctorArgs: any[] = [];
      try {
        const rawArgs = safeParseContractArgs(tcCustomCtorArgs || '[]');
        ctorArgs = rawArgs.map((a: any, i: number) =>
          parseArgWithAbiType(a, ctorFragment?.inputs?.[i] ?? { type: 'bytes' })
        );
      } catch { showAlert('Constructor Arguments tidak valid (harus JSON array).', 'error'); return; }

      const ok = await requestTxConfirm({
        title: `Deploy Kontrak Kustom: ${tcCompiled.contractName}`,
        network: tcSelectedNetwork.name,
        extra: `Verdict scan keamanan: ${AISEC_VERDICT_META[tcSecResult.verdict].label} (skor ${tcSecResult.score}/100). ` +
          `Constructor args: ${tcCustomCtorArgs || '[]'}. Kode ini BUKAN template audited bawaan — kamu bertanggung jawab penuh atas isi kontrak.`,
      });
      if (!ok) return;

      setTcDeploying(true);
      setTcDeployStatus({ type: 'pending', msg: `Deploying "${tcCompiled.contractName}" ke ${tcSelectedNetwork.name}...` });
      try {
        const provider = await getProvider(tcSelectedNetwork);
        const wallet   = new ethers.Wallet(pk, provider);
        const factory  = new ethers.ContractFactory(tcCompiled.abi, tcCompiled.bytecode, wallet);
        const contract = await factory.deploy(...ctorArgs);
        setTcDeployStatus({ type: 'pending', msg: `TX terkirim: ${contract.deployTransaction.hash.slice(0,12)}... menunggu konfirmasi...` });
        await contract.deployed();

        // Coba baca name()/symbol()/decimals() kalau kontrak menyediakannya (standar ERC-20-like);
        // kalau tidak ada, fallback ke label manual dari form (tcName/tcSymbol/tcDecimals).
        let readName = tcName.trim() || tcCompiled.contractName;
        let readSymbol = tcSymbol.trim().toUpperCase() || 'TOKEN';
        let readDecimals = parseInt(tcDecimals || '18', 10);
        try { readName = await contract.name(); } catch {}
        try { readSymbol = await contract.symbol(); } catch {}
        try { readDecimals = await contract.decimals(); } catch {}

        const newToken: DeployedErc20Token = {
          id: Date.now().toString(),
          chainId: tcSelectedNetwork.chainId,
          networkId: tcSelectedNetwork.id,
          networkName: tcSelectedNetwork.name,
          address: contract.address,
          name: readName,
          symbol: readSymbol,
          decimals: readDecimals,
          initialSupply: tcSupply.trim() || '-',
          deployer: wallet.address,
          txHash: contract.deployTransaction.hash,
          createdAt: Date.now(),
        };
        setErc20Tokens(prev => [newToken, ...prev]);
        setTcDeployStatus({ type: 'success', msg: `Kontrak berhasil dideploy di ${contract.address}` });
        showAlert(`Kontrak "${tcCompiled.contractName}" berhasil dideploy!`, 'success');
        setTcCustomSolidity(''); setTcCompiled(null); setTcSecResult(null); setTcRiskAck(false); setTcCustomCtorArgs('[]');
      } catch (e: any) {
        const msg = e?.reason || e?.message || 'Gagal deploy token.';
        setTcDeployStatus({ type: 'error', msg: String(msg).slice(0, 200) });
        showAlert('Gagal deploy: ' + String(msg).slice(0, 160), 'error');
      }
      setTcDeploying(false);
      return;
    }

    // ══ Mode: Template Bawaan (SimpleERC20) ══
    if (!tcName.trim())         { showAlert('Nama token wajib diisi.', 'error'); return; }
    if (!tcSymbol.trim())       { showAlert('Symbol token wajib diisi.', 'error'); return; }
    const decimals = parseInt(tcDecimals, 10);
    if (isNaN(decimals) || decimals < 0 || decimals > 18) { showAlert('Decimals harus angka 0–18.', 'error'); return; }
    let supplyBN: ethers.BigNumber;
    try {
      if (!tcSupply.trim() || isNaN(Number(tcSupply))) throw new Error('invalid');
      supplyBN = ethers.BigNumber.from(tcSupply.trim());
      if (supplyBN.lte(0)) throw new Error('invalid');
    } catch { showAlert('Total supply tidak valid (masukkan angka bulat).', 'error'); return; }

    const ok = await requestTxConfirm({
      title: `Deploy Token ERC-20: ${tcName} (${tcSymbol.toUpperCase()})`,
      network: tcSelectedNetwork.name,
      extra: `Decimals: ${decimals} · Total Supply: ${tcSupply} ${tcSymbol.toUpperCase()} — akan di-mint seluruhnya ke address deployer saat deploy.`,
    });
    if (!ok) return;

    setTcDeploying(true);
    setTcDeployStatus({ type: 'pending', msg: `Deploying ke ${tcSelectedNetwork.name}...` });
    try {
      const provider = await getProvider(tcSelectedNetwork);
      const wallet   = new ethers.Wallet(pk, provider);
      const factory  = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE, wallet);
      const contract = await factory.deploy(tcName.trim(), tcSymbol.trim().toUpperCase(), decimals, supplyBN);
      setTcDeployStatus({ type: 'pending', msg: `TX terkirim: ${contract.deployTransaction.hash.slice(0,12)}... menunggu konfirmasi...` });
      await contract.deployed();

      const newToken: DeployedErc20Token = {
        id: Date.now().toString(),
        chainId: tcSelectedNetwork.chainId,
        networkId: tcSelectedNetwork.id,
        networkName: tcSelectedNetwork.name,
        address: contract.address,
        name: tcName.trim(),
        symbol: tcSymbol.trim().toUpperCase(),
        decimals,
        initialSupply: tcSupply.trim(),
        deployer: wallet.address,
        txHash: contract.deployTransaction.hash,
        createdAt: Date.now(),
      };
      setErc20Tokens(prev => [newToken, ...prev]);
      setTcDeployStatus({ type: 'success', msg: `Token berhasil dideploy di ${contract.address}` });
      showAlert(`Token ERC-20 "${tcName}" berhasil dideploy!`, 'success');
      setTcName(''); setTcSymbol(''); setTcSupply('1000000');
    } catch (e: any) {
      const msg = e?.reason || e?.message || 'Gagal deploy token.';
      setTcDeployStatus({ type: 'error', msg: String(msg).slice(0, 200) });
      showAlert('Gagal deploy: ' + String(msg).slice(0, 160), 'error');
    }
    setTcDeploying(false);
  };

  // -- Buat SPL Token baru di Solana (mint account + ATA + mint initial supply) --
  const createSplToken = async () => {
    const pk = tcSolPrivKey.trim();
    if (!pk)               { showAlert('Pilih wallet atau masukkan private key Solana.', 'error'); return; }
    if (!tcSolName.trim())   { showAlert('Nama token wajib diisi.', 'error'); return; }
    if (!tcSolSymbol.trim()) { showAlert('Symbol token wajib diisi.', 'error'); return; }
    const decimals = parseInt(tcSolDecimals, 10);
    if (isNaN(decimals) || decimals < 0 || decimals > 9) { showAlert('Decimals SPL Token harus 0–9.', 'error'); return; }
    const supplyNum = Number(tcSolSupply);
    if (!tcSolSupply.trim() || isNaN(supplyNum) || supplyNum <= 0) { showAlert('Total supply tidak valid.', 'error'); return; }

    // Validasi batas panjang field metadata (di-enforce keras oleh Metaplex Token Metadata Program on-chain)
    const metaName = tcSolName.trim();
    const metaSymbol = tcSolSymbol.trim().toUpperCase();
    const metaUri = tcSolUri.trim();
    if (metaName.length > SPL_META_MAX.name) { showAlert(`Nama token maksimal ${SPL_META_MAX.name} karakter (dibatasi program Metaplex).`, 'error'); return; }
    if (metaSymbol.length > SPL_META_MAX.symbol) { showAlert(`Symbol token maksimal ${SPL_META_MAX.symbol} karakter (dibatasi program Metaplex).`, 'error'); return; }
    if (tcSolAddMeta) {
      if (!metaUri) { showAlert('URI metadata JSON wajib diisi kalau mau menyertakan metadata on-chain (atau matikan toggle metadata).', 'error'); return; }
      if (metaUri.length > SPL_META_MAX.uri) { showAlert(`URI metadata maksimal ${SPL_META_MAX.uri} karakter (dibatasi program Metaplex) — pakai link pendek/hosting JSON (Arweave, IPFS, GitHub raw, dsb).`, 'error'); return; }
      try { new URL(metaUri); } catch { showAlert('URI metadata harus berupa URL yang valid (https://... atau ipfs://...).', 'error'); return; }
    }

    const tcSolNet = SOLANA_NETWORKS.find(n => n.id === tcSolNetId) ?? SOLANA_NETWORKS[0];

    const ok = await requestTxConfirm({
      title: `Buat SPL Token: ${tcSolName} (${tcSolSymbol.toUpperCase()})`,
      network: tcSolNet.name,
      extra: `Decimals: ${decimals} · Total Supply: ${tcSolSupply} ${tcSolSymbol.toUpperCase()} — akan di-mint seluruhnya ke wallet ini. ${
        tcSolAddMeta
          ? `Metadata on-chain (Metaplex) AKAN dibuat: name="${metaName}", symbol="${metaSymbol}", uri="${metaUri}". Wallet/explorer lain akan menampilkan nama & logo token ini dengan benar.`
          : 'Metadata on-chain (Metaplex) TIDAK disertakan — nama/symbol hanya tersimpan lokal, wallet lain mungkin menampilkan token ini sebagai "Unknown Token".'
      }`,
    });
    if (!ok) return;

    setTcSolCreating(true);
    setTcSolStatus({ type: 'pending', msg: 'Menyiapkan mint account...' });
    try {
      const connection = await getSolanaConnection(tcSolNet);
      const secret      = bs58.decode(pk);
      const payer       = SolKeypair.fromSecretKey(secret);
      const mintKeypair = SolKeypair.generate();

      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, payer.publicKey);
      const rawAmount = BigInt(Math.round(supplyNum * (10 ** decimals)));
      const metadataPda = getMetadataPda(mintKeypair.publicKey);

      const tx = new SolTransaction().add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(mintKeypair.publicKey, decimals, payer.publicKey, payer.publicKey, TOKEN_PROGRAM_ID),
        createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, mintKeypair.publicKey),
        createMintToInstruction(mintKeypair.publicKey, ata, payer.publicKey, rawAmount, [], TOKEN_PROGRAM_ID),
      );

      // ── Sertakan metadata on-chain (Metaplex Token Metadata Program) ──
      // Ini yang bikin wallet/explorer (Phantom, Solscan, dst) bisa menampilkan
      // nama, symbol, dan logo token — bukan cuma "Unknown Token".
      if (tcSolAddMeta) {
        tx.add(
          createCreateMetadataAccountV3Instruction(
            {
              metadata: metadataPda,
              mint: mintKeypair.publicKey,
              mintAuthority: payer.publicKey,
              payer: payer.publicKey,
              updateAuthority: payer.publicKey,
            },
            {
              createMetadataAccountArgsV3: {
                data: {
                  name: metaName,
                  symbol: metaSymbol,
                  uri: metaUri,
                  sellerFeeBasisPoints: 0,
                  creators: null,
                  collection: null,
                  uses: null,
                },
                isMutable: true,        // update authority masih bisa ubah metadata nanti
                collectionDetails: null,
              },
            },
          ),
        );
      }

      setTcSolStatus({ type: 'pending', msg: 'Mengirim transaksi ke Solana...' });
      const sig = await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair]);

      const newToken: CreatedSplToken = {
        id: Date.now().toString(),
        mint: mintKeypair.publicKey.toBase58(),
        networkId: tcSolNet.id,
        networkName: tcSolNet.name,
        name: metaName,
        symbol: metaSymbol,
        decimals,
        initialSupply: tcSolSupply.trim(),
        mintAuthority: payer.publicKey.toBase58(),
        txHash: sig,
        createdAt: Date.now(),
        hasMetadata: tcSolAddMeta,
        metadataUri: tcSolAddMeta ? metaUri : undefined,
        metadataPda: tcSolAddMeta ? metadataPda.toBase58() : undefined,
        imageUrl: tcSolImageUrl.trim() || undefined,
        description: tcSolDescription.trim() || undefined,
      };
      setSplTokens(prev => [newToken, ...prev]);
      setTcSolStatus({ type: 'success', msg: `SPL Token berhasil dibuat${tcSolAddMeta ? ' (dengan metadata on-chain)' : ''}! Mint: ${mintKeypair.publicKey.toBase58()}` });
      showAlert(`SPL Token "${metaName}" berhasil dibuat!`, 'success');
      setTcSolName(''); setTcSolSymbol(''); setTcSolSupply('1000000');
      setTcSolUri(''); setTcSolImageUrl(''); setTcSolDescription('');
    } catch (e: any) {
      const msg = e?.message || 'Gagal membuat SPL Token.';
      setTcSolStatus({ type: 'error', msg: String(msg).slice(0, 200) });
      showAlert('Gagal: ' + String(msg).slice(0, 160), 'error');
    }
    setTcSolCreating(false);
  };

  const deleteErc20Token = (id: string) => {
    setConfirmData({
      isOpen: true, title: 'HAPUS DARI DAFTAR?',
      message: 'Ini hanya menghapus catatan lokal — kontrak tetap ada di blockchain.',
      action: () => { setErc20Tokens(prev => prev.filter(t => t.id !== id)); showAlert('Catatan token dihapus.', 'hapus'); },
    });
  };

  const deleteSplToken = (id: string) => {
    setConfirmData({
      isOpen: true, title: 'HAPUS DARI DAFTAR?',
      message: 'Ini hanya menghapus catatan lokal — mint tetap ada di blockchain.',
      action: () => { setSplTokens(prev => prev.filter(t => t.id !== id)); showAlert('Catatan token dihapus.', 'hapus'); },
    });
  };

  // Shared Asset selector (native coin vs ERC-20 token) — used by Single Send, Multi Send, and Sweep.
  const renderAssetSelector = () => (
    <div style={{ marginBottom:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
        <label style={{ fontSize:'11px', color:'#555' }}>Asset</label>
        <button onClick={() => txFetchTokenBalances()} disabled={txTokensLoading || knownTxTokens.length === 0}
          style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px' }}>
          <FaSync size={9} style={{ animation:txTokensLoading?'spin 1s linear infinite':undefined }}/> Refresh token
        </button>
      </div>
      <select value={txAsset} onChange={e => setTxAsset(e.target.value)}
        style={{ width:'100%', fontFamily:'monospace', fontSize:'12px', padding:'10px 12px' }}>
        <option value="native">{selectedNetwork?.symbol ?? 'ETH'} (native)</option>
        {txTokens.map(t => (
          <option key={t.address} value={t.address}>
            {t.symbol} · {shortAddr(t.address)} · saldo {parseFloat(t.balance).toLocaleString(undefined,{maximumFractionDigits:6})}
          </option>
        ))}
      </select>
      {knownTxTokens.length === 0 && (
        <div style={{ fontSize:'10px', color:'#444', marginTop:'4px' }}>
          Belum ada token ERC-20 yang dikenal di network ini — tambahkan lewat contract address di bawah.
        </div>
      )}
      <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
        <input type="text" placeholder="Tambah token via contract address (0x...)" value={txAddTokenAddr}
          onChange={e => setTxAddTokenAddr(e.target.value)}
          style={{ flex:1, boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px', padding:'8px 10px' }}/>
        <button onClick={addCustomErc20Token} disabled={txAddingToken || !txAddTokenAddr.trim()}
          style={{ background:'none', border:'1px solid #333', color:'#01a2ff', padding:'0 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap', opacity:(!txAddTokenAddr.trim())?0.5:1 }}>
          {txAddingToken ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : <FaPlus size={10}/>}
        </button>
      </div>
      {knownTxTokens.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'8px' }}>
          {knownTxTokens.map(t => (
            <span key={t.address} style={{
              fontSize:'10px', color:'#666', border:'1px solid #222', padding:'3px 7px',
              display:'flex', alignItems:'center', gap:'6px',
            }}>
              {t.symbol}
              <FaTrash size={8} style={{ cursor:'pointer', color:'#444' }}
                onClick={() => removeCustomErc20Token(t.address)} title="Hapus dari daftar"/>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // Compact gas-fee control — collapsed by default (just shows the active mode),
  // expands into the full slow/standard/fast/manual grid on demand.
  // Shared Asset selector Solana (SOL native vs SPL token) — dipakai Kirim, Multi Send, Sweep.
  const renderSolAssetSelector = () => (
    <div style={{ marginBottom:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
        <label style={{ fontSize:'11px', color:'#555' }}>Asset</label>
        <button onClick={() => solFetchTokens()} disabled={solTokensLoading}
          style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px' }}>
          <FaSync size={9} style={{ animation:solTokensLoading?'spin 1s linear infinite':undefined }}/> Refresh token
        </button>
      </div>
      <select value={solAsset} onChange={e => setSolAsset(e.target.value)}
        style={{ width:'100%', fontFamily:'monospace', fontSize:'12px', padding:'10px 12px' }}>
        <option value="native">SOL (native)</option>
        {solTokens.map(t => (
          <option key={t.mint} value={t.mint}>
            {shortAddr(t.mint)} · saldo {t.uiAmount}
          </option>
        ))}
      </select>
      {solTokens.length === 0 && (
        <div style={{ fontSize:'10px', color:'#444', marginTop:'4px' }}>
          Tidak ada token SPL terdeteksi di wallet ini.
        </div>
      )}
    </div>
  );

  const renderGasFeeBox = () => {
    const modeLabels: Record<typeof txGasMode, string> = {
      slow: 'Slow', standard: 'Standard', fast: 'Fast', manual: 'Manual',
    };
    const currentGwei = txGasMode !== 'manual' && txGasPrices
      ? txGasPrices[txGasMode as 'slow'|'standard'|'fast']
      : null;

    return (
      <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#888' }}>
            <FaGasPump size={11} color="#f3ba2f"/>
            <span>Gas: <strong style={{ color:'#f3ba2f' }}>{modeLabels[txGasMode]}</strong></span>
            {currentGwei !== null && <span style={{ color:'#555', fontFamily:'monospace' }}>~{currentGwei.toFixed(2)} Gwei</span>}
            {txGasMode === 'manual' && <span style={{ color:'#555', fontFamily:'monospace' }}>{txGasManual || '?'} Gwei</span>}
          </div>
          <button onClick={() => setGasAdvanced(p => !p)}
            style={{ background:'none', border:'none', color:'#01a2ff', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px' }}>
            {gasAdvanced ? <>Tutup <FaChevronUp size={9}/></> : <>Ubah <FaChevronDown size={9}/></>}
          </button>
        </div>

        {gasAdvanced && (
          <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #161616' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', marginBottom:'8px' }}>
              <button onClick={txFetchGasPrice} disabled={txFetchingGas}
                style={{ background:'none', border:'1px solid #333', color:txFetchingGas?'#888':'#f3ba2f', padding:'3px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px' }}>
                <FaSync size={9} style={{ animation:txFetchingGas?'spin 1s linear infinite':undefined }}/> {txFetchingGas ? 'Fetching...' : 'Refresh Gas'}
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom:'10px' }}>
              {(['slow','standard','fast','manual'] as const).map(mode => {
                const gpVal = txGasPrices ? {
                  slow: txGasPrices.slow, standard: txGasPrices.standard, fast: txGasPrices.fast, manual: null,
                }[mode] : null;
                return (
                  <button key={mode} onClick={() => setTxGasMode(mode)} style={{
                    padding:'8px 4px', background: txGasMode===mode ? '#1a1400' : '#0d0d0d',
                    border:`1px solid ${txGasMode===mode ? '#f3ba2f' : '#1e1e1e'}`,
                    color: txGasMode===mode ? '#f3ba2f' : '#555',
                    cursor:'pointer', fontSize:'11px', textAlign:'center', transition:'all 0.15s',
                  }}>
                    <div style={{ fontWeight:'bold', marginBottom:'2px' }}>{modeLabels[mode]}</div>
                    {mode !== 'manual' && gpVal !== null && (
                      <div style={{ fontSize:'10px', color:'#888', fontFamily:'monospace' }}>{gpVal.toFixed(2)} Gwei</div>
                    )}
                    {mode !== 'manual' && gpVal === null && (
                      <div style={{ fontSize:'10px', color:'#333' }}>—</div>
                    )}
                  </button>
                );
              })}
            </div>
            {txGasMode === 'manual' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <div>
                  <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Gas Price (Gwei)</label>
                  <input type="number" placeholder="e.g. 5" value={txGasManual} min="0" step="0.1"
                    onChange={e => setTxGasManual(e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                </div>
                <div>
                  <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Gas Limit</label>
                  <input type="number" placeholder="21000" value={txGasLimit} min="21000"
                    onChange={e => setTxGasLimit(e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <label style={{ fontSize:'10px', color:'#555', whiteSpace:'nowrap', textTransform:'uppercase' }}>Gas Limit:</label>
                <input type="number" value={txGasLimit} min="21000"
                  onChange={e => setTxGasLimit(e.target.value)}
                  style={{ width:'100px', fontFamily:'monospace', fontSize:'12px' }}/>
                <span style={{ fontSize:'10px', color:'#333' }}>def: 21000 (native tx)</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <CustomAlert isOpen={alertData.isOpen} message={alertData.msg} type={alertData.type}
        onClose={() => setAlertData(p => ({ ...p, isOpen: false }))} />
      <CustomConfirm isOpen={confirmData.isOpen} title={confirmData.title} message={confirmData.message}
        onCancel={() => setConfirmData(p => ({ ...p, isOpen: false }))}
        onConfirm={() => { confirmData.action?.(); setConfirmData(p => ({ ...p, isOpen: false })); }} />
      <TxConfirmModal isOpen={txConfirmModal.isOpen} details={txConfirmModal.details}
        onCancel={() => handleTxConfirmDecision(false)}
        onConfirm={() => handleTxConfirmDecision(true)} />

      {qrAddress && <QRModal address={qrAddress} onClose={() => setQrAddress(null)} />}
      {portfolioTarget && <PortfolioModal target={portfolioTarget} onClose={() => setPortfolioTarget(null)} />}

      {/* ── Batch Execution Modal ─────────────────────────────────── */}
      {batchModalOpen && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:9000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
        }}>
          <div style={{
            background:'#0a0a0a', border:'1px solid #2a2a2a', borderTop:'3px solid #836EFD',
            width:'100%', maxWidth:'600px', maxHeight:'90vh', display:'flex', flexDirection:'column',
          }}>
            {/* Header */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #1a1a1a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <FaLayerGroup color="#836EFD" size={14}/>
                <span style={{ fontWeight:'bold', fontSize:'13px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#836EFD' }}>
                  Garap Batch
                </span>
                <span style={{ fontSize:'11px', color:'#555', border:'1px solid #2a2a2a', padding:'2px 8px' }}>
                  {batchSelectedIds.size} task dipilih
                </span>
              </div>
              {!batchRunning && (
                <button onClick={() => { setBatchModalOpen(false); setBatchLog([]); setBatchDone(false); setBatchProgress({walDone:0,walTotal:0,taskDone:0,taskTotal:0,currentWal:'',currentTask:''}); setBatchTaskNetworks({}); }}
                  style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>✕</button>
              )}
            </div>

            {/* Config — only shown before running */}
            {!batchRunning && !batchDone && (
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #1a1a1a', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', overflowY:'auto', flex:1 }}>
                {/* ── Multi-wallet panel ── */}
                <div style={{ gridColumn:'1/-1', background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #01a2ff', padding:'12px 14px' }}>
                  <div style={{ fontSize:'10px', color:'#01a2ff', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
                    <FaWallet size={10}/> Daftar Wallet ({batchWallets.length}) — semua wallet akan garap task secara urut
                  </div>

                  {/* Add from BIP39 */}
                  <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
                    <select defaultValue="" onChange={e => { addBatchWalletFromBIP39(e.target.value); e.target.value = ''; }}
                      style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}>
                      <option value="">＋ Tambah dari BIP39...</option>
                      {wallets.map((w, wi) => w.addresses.map((a) => {
                        const id = `${wi},${a.index}`;
                        const already = batchWallets.some(bw => bw.id === id);
                        return (
                          <option key={id} value={id} disabled={already}>
                            {already ? '✓ ' : ''} [{w.name}] {a.address.slice(0,10)}…{a.address.slice(-4)} (#{a.index})
                          </option>
                        );
                      }))}
                    </select>
                  </div>

                  {/* Add manual PK */}
                  <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                    <input type="password" placeholder="Private key manual (0x...)" value={batchManualPK}
                      onChange={e => setBatchManualPK(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addBatchWalletManual()}
                      style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}/>
                    <button onClick={addBatchWalletManual} disabled={!batchManualPK.trim()}
                      style={{ background:'#01a2ff', color:'#000', border:'none', padding:'6px 12px', cursor: batchManualPK.trim() ? 'pointer' : 'not-allowed', fontSize:'11px', fontWeight:'bold', opacity: batchManualPK.trim() ? 1 : 0.4 }}>
                      ＋
                    </button>
                  </div>

                  {/* Wallet list */}
                  {batchWallets.length === 0 ? (
                    <div style={{ color:'#333', fontSize:'11px', textAlign:'center', padding:'10px 0', border:'1px dashed #1a1a1a' }}>
                      Belum ada wallet. Tambah dari BIP39 atau masukkan private key manual.
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                      {batchWallets.map((bw, idx) => (
                        <div key={bw.id} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#111', border:'1px solid #1a1a1a', padding:'6px 10px' }}>
                          <span style={{ fontSize:'10px', color:'#444', minWidth:'16px', textAlign:'right' }}>{idx+1}</span>
                          <span style={{ flex:1, fontFamily:'monospace', fontSize:'11px', color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bw.label}</span>
                          <button onClick={() => removeBatchWallet(bw.id)}
                            style={{ background:'none', border:'none', color:'#f44336', cursor:'pointer', padding:'2px 5px', fontSize:'12px', flexShrink:0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    Network Default
                  </label>
                  <select value={batchNetId} onChange={e => setBatchNetId(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'11px' }}>
                    {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>

                {/* ── Per-task network override ── */}
                {batchSelectedIds.size > 0 && (
                  <div style={{ gridColumn:'1/-1', background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #f3ba2f', padding:'12px 14px' }}>
                    <div style={{ fontSize:'10px', color:'#f3ba2f', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
                      <FaNetworkWired size={10}/> Network per Task (Override) — kosongkan untuk pakai default
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {airdropTasks.filter(t => batchSelectedIds.has(t.id)).map(task => {
                        const overrideNetId = batchTaskNetworks[task.id] || '';
                        const effectiveNet = networks.find(n => n.id === (overrideNetId || batchNetId));
                        const isOverridden = !!overrideNetId && overrideNetId !== batchNetId;
                        return (
                          <div key={task.id} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#111', border:'1px solid #1a1a1a', padding:'7px 10px' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:'11px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {task.projectName}
                              </div>
                              <div style={{ fontSize:'10px', color:'#444', marginTop:'1px' }}>{task.taskType.toUpperCase()} · {task.network || '—'}</div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:'5px', flexShrink:0 }}>
                              {isOverridden && (
                                <span style={{ fontSize:'9px', color:'#f3ba2f', border:'1px solid #f3ba2f44', padding:'1px 5px', letterSpacing:'0.5px' }}>
                                  OVERRIDE
                                </span>
                              )}
                              <select
                                value={overrideNetId}
                                onChange={e => setBatchTaskNetworks(prev => {
                                  const updated = { ...prev };
                                  if (e.target.value) updated[task.id] = e.target.value;
                                  else delete updated[task.id];
                                  return updated;
                                })}
                                style={{
                                  fontFamily:'monospace', fontSize:'10px', padding:'3px 6px',
                                  background:'#0a0a0a', color: isOverridden ? '#f3ba2f' : '#555',
                                  border: `1px solid ${isOverridden ? '#f3ba2f44' : '#1e1e1e'}`,
                                  minWidth:'140px',
                                }}
                              >
                                <option value="">— default ({effectiveNet?.name ?? batchNetId}) —</option>
                                {networks.map(n => (
                                  <option key={n.id} value={n.id}>{n.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize:'10px', color:'#443322', marginTop:'8px', lineHeight:'1.5' }}>
                      Task dengan network berbeda akan dieksekusi menggunakan RPC masing-masing. Semua network di-connect di awal sebelum batch dimulai.
                    </div>
                  </div>
                )}
                <div>
                  <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    Gas Limit (kosong = auto)
                  </label>
                  <input type="number" placeholder="auto" value={batchGasLimit}
                    onChange={e => setBatchGasLimit(e.target.value)} min="21000"
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px' }}/>
                </div>
                <div>
                  <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    Delay antar TX (ms)
                  </label>
                  <div style={{ display:'flex', gap:'5px', alignItems:'center' }}>
                    <input type="number" value={batchDelayMs} min="0" step="500"
                      onChange={e => setBatchDelayMs(parseInt(e.target.value)||0)}
                      style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}/>
                    {([500,1000,2000,5000] as const).map(v => (
                      <button key={v} onClick={() => setBatchDelayMs(v)}
                        style={{ fontSize:'10px', padding:'4px 6px', background:'#111', border:`1px solid ${batchDelayMs===v?'#836EFD':'#2a2a2a'}`, color:batchDelayMs===v?'#836EFD':'#555', cursor:'pointer' }}>
                        {v/1000}s
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    Delay antar Wallet (ms)
                  </label>
                  <div style={{ display:'flex', gap:'5px', alignItems:'center' }}>
                    <input type="number" value={batchWalDelay} min="0" step="500"
                      onChange={e => setBatchWalDelay(parseInt(e.target.value)||0)}
                      style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}/>
                    {([0,1000,3000,5000] as const).map(v => (
                      <button key={v} onClick={() => setBatchWalDelay(v)}
                        style={{ fontSize:'10px', padding:'4px 6px', background:'#111', border:`1px solid ${batchWalDelay===v?'#01a2ff':'#2a2a2a'}`, color:batchWalDelay===v?'#01a2ff':'#555', cursor:'pointer' }}>
                        {v===0?'Off':v/1000+'s'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* ── Loop settings ── */}
                <div style={{ gridColumn:'1/-1', background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #836EFD', padding:'12px 14px' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none', marginBottom: batchLoopEnabled ? '10px' : '0' }}>
                    <input type="checkbox" checked={batchLoopEnabled} onChange={e => setBatchLoopEnabled(e.target.checked)} style={{ width:'auto', margin:0, accentColor:'#836EFD' }}/>
                    <span style={{ fontSize:'12px', color: batchLoopEnabled ? '#836EFD' : '#666', fontWeight: batchLoopEnabled ? 'bold' : 'normal' }}>
                      🔁 Loop (ulangi semua task terus-menerus)
                    </span>
                  </label>
                  {batchLoopEnabled && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'4px' }}>
                      <div>
                        <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                          Max Round (0 = ∞)
                        </label>
                        <input type="number" value={batchLoopMax} min="0"
                          onChange={e => setBatchLoopMax(parseInt(e.target.value)||0)}
                          style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px' }}/>
                      </div>
                      <div>
                        <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                          Jeda antar Round (ms)
                        </label>
                        <input type="number" value={batchLoopDelay} min="0" step="1000"
                          onChange={e => setBatchLoopDelay(parseInt(e.target.value)||0)}
                          style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px' }}/>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Auto-retry settings ── */}
                <div style={{ gridColumn:'1/-1', background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #ff6600', padding:'12px 14px' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none', marginBottom: batchRetryFailed ? '10px' : '0' }}>
                    <input type="checkbox" checked={batchRetryFailed} onChange={e => setBatchRetryFailed(e.target.checked)} style={{ width:'auto', margin:0, accentColor:'#ff6600' }}/>
                    <span style={{ fontSize:'12px', color: batchRetryFailed ? '#ff9944' : '#666', fontWeight: batchRetryFailed ? 'bold' : 'normal' }}>
                      🔄 Auto-retry task gagal otomatis
                    </span>
                  </label>
                  {batchRetryFailed && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'4px' }}>
                      <div>
                        <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                          Max Retry per Task
                        </label>
                        <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                          <input type="number" value={batchRetryMax} min="1" max="10"
                            onChange={e => setBatchRetryMax(Math.min(10, Math.max(1, parseInt(e.target.value)||1)))}
                            style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}/>
                          {([1,2,3,5] as const).map(v => (
                            <button key={v} onClick={() => setBatchRetryMax(v)}
                              style={{ fontSize:'10px', padding:'4px 6px', background:'#111', border:`1px solid ${batchRetryMax===v?'#ff6600':'#2a2a2a'}`, color:batchRetryMax===v?'#ff9944':'#555', cursor:'pointer', flexShrink:0 }}>
                              {v}x
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                          Delay Sebelum Retry (ms)
                        </label>
                        <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                          <input type="number" value={batchRetryDelay} min="500" step="500"
                            onChange={e => setBatchRetryDelay(parseInt(e.target.value)||1000)}
                            style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}/>
                          {([1000,2000,5000] as const).map(v => (
                            <button key={v} onClick={() => setBatchRetryDelay(v)}
                              style={{ fontSize:'10px', padding:'4px 6px', background:'#111', border:`1px solid ${batchRetryDelay===v?'#ff6600':'#2a2a2a'}`, color:batchRetryDelay===v?'#ff9944':'#555', cursor:'pointer', flexShrink:0 }}>
                              {v/1000}s
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ gridColumn:'1/-1', fontSize:'10px', color:'#554433', lineHeight:'1.5' }}>
                        Jika TX gagal (revert, timeout, dll), otomatis coba ulang hingga {batchRetryMax}x dengan jeda {batchRetryDelay/1000}s. Jika semua attempt gagal, task ditandai <span style={{ color:'#f44336' }}>failed</span>.
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Tombol eksekusi sticky — selalu terlihat di luar area scroll */}
            {!batchRunning && !batchDone && (
              <div style={{ padding:'12px 20px', borderTop:'1px solid #1e1e1e', background:'#0a0a0a', flexShrink:0 }}>
                <button
                  onClick={() => runBatchExec(airdropTasks.filter(t => batchSelectedIds.has(t.id) && t.contractAddress))}
                  disabled={batchWallets.length === 0 || batchSelectedIds.size === 0}
                  style={{
                    width:'100%', padding:'12px', background: batchWallets.length === 0 || batchSelectedIds.size === 0 ? '#1a1a1a' : '#836EFD',
                    color:'#fff', border:'none', cursor: batchWallets.length === 0 || batchSelectedIds.size === 0 ? 'not-allowed' : 'pointer',
                    fontSize:'13px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                    opacity: batchWallets.length === 0 || batchSelectedIds.size === 0 ? 0.5 : 1,
                  }}>
                  <FaLayerGroup size={13}/> Eksekusi {batchSelectedIds.size} Task × {batchWallets.length} Wallet
                </button>
                <div style={{ fontSize:'10px', color:'#444', marginTop:'6px', textAlign:'center' }}>
                  Hanya task dengan contract address yang dieksekusi. Task tanpa kontrak akan di-skip.
                </div>
              </div>
            )}

            {/* Progress bar — shown while running or done */}
            {(batchRunning || batchDone) && (
              <div style={{ padding:'12px 20px', borderBottom:'1px solid #1a1a1a', background:'#070707' }}>
                {/* Wallet progress */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <span style={{ fontSize:'11px', color:'#01a2ff' }}>
                    [wallet] {batchDone ? 'Selesai' : (batchProgress.currentWal || 'Memulai...')}
                  </span>
                  <span style={{ fontFamily:'monospace', fontSize:'11px', color:'#444' }}>
                    Wallet {batchProgress.walDone}/{batchProgress.walTotal}
                  </span>
                </div>
                <div style={{ height:'3px', background:'#1a1a1a', marginBottom:'8px', overflow:'hidden' }}>
                  <div style={{
                    height:'100%',
                    width: batchProgress.walTotal > 0 ? `${(batchProgress.walDone / batchProgress.walTotal) * 100}%` : '0%',
                    background: batchDone ? '#4caf50' : '#01a2ff',
                    transition:'width 0.4s ease',
                  }}/>
                </div>
                {/* Task progress */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <span style={{ fontSize:'12px', color: batchDone ? '#4caf50' : '#836EFD', fontWeight:'bold' }}>
                    {batchDone ? '[done] Selesai!' : `⚡ ${batchProgress.currentTask || 'Memulai...'}`}
                  </span>
                  <span style={{ fontFamily:'monospace', fontSize:'12px', color:'#888' }}>
                    Task {batchProgress.taskDone}/{batchProgress.taskTotal}
                  </span>
                </div>
                <div style={{ height:'4px', background:'#1a1a1a', borderRadius:'2px', overflow:'hidden' }}>
                  <div style={{
                    height:'100%',
                    width: batchProgress.taskTotal > 0 ? `${(batchProgress.taskDone / batchProgress.taskTotal) * 100}%` : '0%',
                    background: batchDone ? '#4caf50' : '#836EFD',
                    transition:'width 0.4s ease',
                    boxShadow: batchDone ? '0 0 8px #4caf5066' : '0 0 8px #836EFD66',
                  }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'10px' }}>
                  {batchRunning && (
                    <button onClick={() => { batchStopRef.current = true; batchAddLog('[stopbyuser] Menghentikan setelah TX saat ini...', 'warn'); }}
                      disabled={batchStopRef.current}
                      style={{ background: batchStopRef.current ? '#1a1a1a' : '#2a0a0a', border:`1px solid ${batchStopRef.current ? '#444' : '#f44336'}`, color: batchStopRef.current ? '#555' : '#f44336', padding:'6px 14px', cursor: batchStopRef.current ? 'not-allowed' : 'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                      <FaSpinner style={{ animation:'spin 1s linear infinite' }} size={11}/> {batchStopRef.current ? 'Menghentikan...' : 'Stop'}
                    </button>
                  )}
                  {batchDone && (
                    <button onClick={() => { setBatchModalOpen(false); setBatchLog([]); setBatchDone(false); setBatchProgress({walDone:0,walTotal:0,taskDone:0,taskTotal:0,currentWal:'',currentTask:''}); setBatchSelectedIds(new Set()); setBatchTaskNetworks({}); }}
                      style={{ background:'#4caf50', border:'none', color:'#000', padding:'6px 16px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                      Tutup
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Log output */}
            <div ref={batchLogRef} style={{ flex:1, overflowY:'auto', padding:'12px 20px', fontFamily:'monospace', fontSize:'11px', lineHeight:'1.7', minHeight:'160px', maxHeight:'300px' }}>
              {batchLog.length === 0 ? (
                <div style={{ color:'#333', textAlign:'center', marginTop:'20px' }}>Log eksekusi akan muncul di sini.</div>
              ) : (
                batchLog.map(l => (
                  <div key={l.id} style={{
                    color: l.type==='ok' ? '#4caf50' : l.type==='err' ? '#f44336' : l.type==='warn' ? '#ffaa00' : '#666',
                    borderBottom: l.msg.startsWith('[') && !l.msg.includes('  ') ? '1px solid #0f0f0f' : 'none',
                    paddingBottom: l.msg.startsWith('[') && !l.msg.includes('  ') ? '4px' : '0',
                    marginBottom:  l.msg.startsWith('[') && !l.msg.includes('  ') ? '4px' : '0',
                  }}>
                    {l.msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {!tosAgreed && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            background: '#0d0d0d', border: '1px solid #2a2a2a', borderTop: '3px solid #f44336',
            maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ fontSize: '28px' }}>💀</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Terms of Service
                </div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                  Wallet Generator · Baca dulu sebelum lanjut
                </div>
              </div>
              <Link to="/wallet-gen/tos" style={{ marginLeft: 'auto', fontSize: '11px', color: '#444', textDecoration: 'none', border: '1px solid #333', padding: '4px 10px', whiteSpace: 'nowrap' }}>
                Baca Lengkap ↗
              </Link>
            </div>

            {[
              { color: '#f44336', num: '§ 01', title: 'Risiko Ditanggung Sendiri', body: 'Segala kerugian — wallet bocor, salah kirim, kena hack — sepenuhnya tanggung jawab pengguna. Developer & IAC Community tidak bertanggung jawab apapun.' },
              { color: '#f44336', num: '§ 02', title: 'Private Key & Mnemonic', body: 'Jangan pernah share ke siapapun untuk alasan apapun. Kalau bocor — selesai, tidak ada recovery.' },
              { color: '#ff9800', num: '§ 03', title: 'Data Tersimpan Lokal', body: 'Semua data hanya di localStorage browser kamu. Clear cache = hilang semua. Backup manual wajib.' },
              { color: '#ff9800', num: '§ 04', title: 'Transaksi Irreversible', body: 'Salah kirim? Tidak bisa balik. Selalu double-check address & network sebelum eksekusi.' },
            ].map(c => (
              <div key={c.num} style={{ borderLeft: `2px solid ${c.color}`, padding: '10px 14px', marginBottom: '8px', background: '#111' }}>
                <div style={{ fontSize: '10px', color: '#555', letterSpacing: '1px', marginBottom: '3px' }}>{c.num} · {c.title}</div>
                <div style={{ fontSize: '11px', color: '#777', lineHeight: '1.6' }}>{c.body}</div>
              </div>
            ))}

            <div style={{ fontSize: '10px', color: '#444', textAlign: 'center', margin: '12px 0 4px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Centang semua untuk lanjut
            </div>

            {[
              'Saya paham semua risiko dan siap menanggung sendiri',
              'Saya tidak akan share private key / mnemonic ke siapapun',
              'Saya akan backup wallet sendiri jika tidak ingin kehilangan data',
              'Saya paham ini bukan financial advice dan crypto bisa bikin saldo jadi 0',
            ].map((label, i) => (
              <label key={i} onClick={() => setTosChecked(prev => prev.map((v, idx) => idx === i ? !v : v))}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                <div style={{
                  width: '15px', height: '15px', flexShrink: 0, marginTop: '1px',
                  border: `1px solid ${tosChecked[i] ? '#f44336' : '#333'}`,
                  background: tosChecked[i] ? '#1a0000' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tosChecked[i] && <span style={{ color: '#f44336', fontSize: '10px' }}>✓</span>}
                </div>
                <span style={{ fontSize: '11px', color: tosChecked[i] ? '#ccc' : '#555', lineHeight: '1.5', userSelect: 'none' }}>
                  {label}
                </span>
              </label>
            ))}

            <button onClick={handleTosAgree} disabled={!tosAllChecked} style={{
              width: '100%', marginTop: '12px', padding: '12px',
              background: tosAllChecked ? '#f44336' : 'transparent',
              color: tosAllChecked ? '#fff' : '#333',
              border: `1px solid ${tosAllChecked ? '#f44336' : '#333'}`,
              cursor: tosAllChecked ? 'pointer' : 'not-allowed',
              fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px',
              transition: 'all 0.2s',
            }}>
              {tosAllChecked
                ? '✓ SETUJU & MULAI PAKAI WALLET GEN'
                : `⚠ CENTANG SEMUA DULU (${tosChecked.filter(Boolean).length}/4)`}
            </button>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <Link to="/wallet-gen/tos" style={{ fontSize: '10px', color: '#444', textDecoration: 'none', letterSpacing: '0.5px' }}>
                Baca ToS lengkap (7 pasal) →
              </Link>
            </div>
          </div>
        </div>
      )}

      <header>
        <h1>
          <FaWallet style={{ marginRight:'8px' }}/>WalletGen
          <span style={{ fontSize:'12px', color:'#555', fontWeight:'normal', marginLeft:'8px' }}>v1</span>
        </h1>
      </header>
      <Navbar />

      <div style={{ background:'rgba(255,170,0,0.06)', border:'1px solid #ffaa0030', borderLeft:'3px solid #ffaa00', padding:'12px 16px', marginBottom:'20px', display:'flex', alignItems:'flex-start', gap:'10px' }}>
        <FaExclamationTriangle color="#ffaa00" size={14} style={{ flexShrink:0, marginTop:'2px' }}/>
        <span style={{ fontSize:'12px', color:'#ffcc44', lineHeight:'1.6' }}>
          <strong>PERINGATAN KEAMANAN:</strong> Mnemonic phrase adalah kunci utama wallet Anda. Jangan pernah share ke siapapun.
          Data disimpan di <code style={{ background:'#2a2a00', padding:'1px 5px' }}>localStorage</code> — gunakan hanya di perangkat pribadi yang aman.
        </span>
      </div>

      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap',
        background: devMode ? 'rgba(255,51,51,0.07)' : '#0d0d0d',
        border: `1px solid ${devMode ? '#ff333344' : '#1e1e1e'}`,
        borderLeft: `3px solid ${devMode ? '#ff3333' : '#4caf50'}`,
        padding: '10px 16px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '12px', color: devMode ? '#ff8888' : '#888', display:'flex', alignItems:'center', gap:'8px' }}>
          {devMode ? <FaExclamationTriangle color="#ff3333" size={13} /> : <FaShieldAlt color="#4caf50" size={13} />}
          <span>
            {devMode
              ? <><strong style={{ color:'#ff5555' }}>MODE DEVELOPER AKTIF</strong> — semua TX dikirim langsung tanpa konfirmasi.</>
              : <>Mode konfirmasi TX aktif — setiap transaksi akan minta konfirmasi sebelum dikirim.</>}
          </span>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none', flexShrink:0 }}>
          <span style={{ fontSize:'11px', color: devMode ? '#ff5555' : '#555', fontWeight:'bold' }}>DEV MODE (skip konfirmasi)</span>
          <span
            onClick={() => {
              if (!devMode) {
                setConfirmData({
                  isOpen: true,
                  title: 'Aktifkan Dev Mode?',
                  message: 'Semua transaksi (single, multi-send, sweep, batch garap, agent queue) akan langsung dikirim TANPA konfirmasi. Gunakan hanya kalau kamu yakin dengan apa yang sedang dilakukan.',
                  action: () => setDevMode(true),
                });
              } else {
                setDevMode(false);
              }
            }}
            style={{
              width: '38px', height: '20px', borderRadius: '10px', position: 'relative',
              background: devMode ? '#ff3333' : '#2a2a2a', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '2px', left: devMode ? '20px' : '2px',
              width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </span>
        </label>
      </div>

      <div style={{ display:'flex', gap:'2px', marginBottom:'20px', borderBottom:'1px solid #1e1e1e', overflowX:'auto' }}>
        {([
          ['wallets',  <FaWallet/>,       'Wallet BIP39'],
          ['transfer', <FaExchangeAlt/>,  'Send / Receive'],
          ['garap',    <FaRobot/>,        'Garap Hub'],
          ['networks', <FaNetworkWired/>, 'RPC Networks'],
          ['bytecode', <FaTerminal/>,     'Bytecode'],
          ['txdecoder', <FaCode />, 'TX Decoder'],
          ['token',     <FaCoins />,      'Token Creator'],
        ] as const).map(([k, icon, label]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{
            padding:'10px 16px', background:'none', border:'none', whiteSpace:'nowrap',
            borderBottom:`2px solid ${activeTab === k ? '#01a2ff' : 'transparent'}`,
            color:activeTab === k ? '#01a2ff' : '#555',
            cursor:'pointer', fontSize:'13px', fontWeight:activeTab === k ? 'bold' : 'normal',
            transition:'all 0.2s', display:'flex', alignItems:'center', gap:'6px',
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {activeTab === 'wallets' && (
        <>
          <div className="form-container" style={{ marginBottom:'24px' }}>
            <h2 style={{ textAlign:'center', marginBottom:'16px', fontSize:'15px' }}>
              {importMode ? <><FaFileImport/> Import Mnemonic</> : <><FaRandom/> Generate Wallet Baru</>}
            </h2>
            <div style={{ display:'flex', gap:'8px', marginBottom:'14px', justifyContent:'center' }}>
              {[false, true].map(isImport => (
                <button key={String(isImport)} onClick={() => setImportMode(isImport)} style={{
                  padding:'7px 16px',
                  background:importMode === isImport ? '#01a2ff' : '#111',
                  border:`1px solid ${importMode === isImport ? '#01a2ff' : '#333'}`,
                  color:importMode === isImport ? '#000' : '#888',
                  cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                }}>
                  {isImport ? <><FaFileImport style={{ marginRight:'5px' }}/>Import</> : <><FaRandom style={{ marginRight:'5px' }}/>Generate</>}
                </button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <input placeholder="Nama Wallet (opsional)" value={walletName} onChange={e => setWalletName(e.target.value)}/>
              {!importMode && (
                <select value={entropyBits} onChange={e => setEntropyBits(Number(e.target.value) as any)}>
                  {QLENGTH_OPTIONS.map(o => <option key={o.bits} value={o.bits}>{o.label}</option>)}
                </select>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <label style={{ fontSize:'12px', color:'#888', whiteSpace:'nowrap' }}>Jumlah Address:</label>
                <input type="number" min={1} max={20} value={addressCount}
                  onChange={e => setAddressCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{ width:'70px' }}/>
              </div>
            </div>
            {importMode && (
              <textarea
                placeholder="Masukkan mnemonic phrase (12/15/18/21/24 kata, dipisah spasi)..."
                value={customMnemonic}
                onChange={e => setCustomMnemonic(e.target.value)}
                rows={3}
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', resize:'vertical', marginBottom:'10px' }}
              />
            )}
            <button onClick={generateWallet}
              disabled={generating || (importMode && !customMnemonic.trim())}
              style={{ width:'100%', padding:'13px', background:generating?'#1a2a1a':'#01a2ff', color:generating?'#4caf50':'#000', border:'none', cursor:generating?'wait':'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:importMode&&!customMnemonic.trim()?0.5:1 }}>
              {generating
                ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Generating...</>
                : importMode ? <><FaFileImport/> Import Wallet</> : <><FaRandom/> Generate Wallet</>}
            </button>
          </div>

          <div className="search-filter-bar" style={{ marginBottom:'16px' }}>
            <div className="search-input-wrapper">
              <FaSearch className="search-icon"/>
              <input type="search" placeholder="Cari nama / address..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <span style={{ fontSize:'12px', color:'#555', alignSelf:'center' }}>{wallets.length} wallet tersimpan</span>
          </div>

          <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:'2px solid #4caf50', padding:'16px', marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1, flexWrap:'wrap' }}>
                <span style={{ fontSize:'11px', color:'#4caf50', textTransform:'uppercase', letterSpacing:'1px', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'5px' }}>
                  <FaChartBar size={11}/> Cek Balance Semua Wallet
                </span>
                <select value={balCheckNetId} onChange={e => { setBalCheckNetId(e.target.value); setBalResults({}); }}
                  style={{ fontSize:'12px', padding:'5px 8px', fontFamily:'monospace', minWidth:'180px' }}>
                  {networks.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                <button onClick={checkAllBalances} disabled={balChecking || wallets.length === 0}
                  style={{ background: balChecking ? '#1a2a1a' : '#4caf50', color:'#000', border:'none', padding:'8px 16px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'6px', opacity: wallets.length === 0 ? 0.4 : 1 }}>
                  {balChecking
                    ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Checking...</>
                    : <><FaSync size={10}/> Cek Semua Balance</>}
                </button>
                <button onClick={exportAllCSV} disabled={csvExporting || wallets.length === 0}
                  style={{ background:'#111', color: wallets.length === 0 ? '#333' : '#f3ba2f', border:`1px solid ${wallets.length === 0 ? '#222' : '#f3ba2f44'}`, padding:'8px 14px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'6px' }}>
                  {csvExporting ? '...' : <><FaFileExport size={10}/> Export CSV</>}
                </button>
              </div>
            </div>
            {Object.keys(balResults).length > 0 && (
              <div style={{ marginTop:'12px', fontSize:'11px', color:'#555', display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {Object.entries(balResults).map(([addr, r]) => (
                  <span key={addr} style={{ background:'#111', border:`1px solid ${r.error ? '#f4433622' : '#4caf5022'}`, padding:'4px 10px', fontFamily:'monospace', display:'flex', alignItems:'center', gap:'6px' }}>
                    <span style={{ color:'#444' }}>{addr.slice(0,8)}…{addr.slice(-4)}</span>
                    <span style={{ color: r.error ? '#f44336' : r.loading ? '#888' : '#4caf50', fontWeight:'bold' }}>
                      {r.loading ? '⟳' : r.balance}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {filteredWallets.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px', color:'#333', border:'1px dashed #222' }}>
                <FaWallet size={28} style={{ marginBottom:'10px', opacity:0.3 }}/>
                <p>Belum ada wallet. Generate wallet pertamamu!</p>
              </div>
            )}
            {filteredWallets.map(w => {
              const isExpanded      = expandedId === w.id;
              const isMnemonicShown = revealedIds.has(w.id);
              const activeChain: ChainKind = chainView[w.id] || 'evm';
              const activeList  = activeChain === 'sol' ? (w.solAddresses || []) : w.addresses;
              const activePath  = activeChain === 'sol' ? "m/44'/501'/x'/0'" : "m/44'/60'/0'/0/x";
              return (
                <div key={w.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #01a2ff', overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', cursor:'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : w.id)}>
                    <FaWallet color="#01a2ff" size={14}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'bold', fontSize:'14px' }}>{w.name}</div>
                      <div style={{ fontSize:'10px', color:'#444', marginTop:'2px' }}>
                        {new Date(w.createdAt).toLocaleString('id-ID')} · {activeList.length} address · {activePath}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <button onClick={e => { e.stopPropagation(); exportWallet(w); }} title="Export JSON"
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 8px', cursor:'pointer', fontSize:'11px' }}>
                        <FaFileExport/>
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteWallet(w.id); }} title="Hapus"
                        style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'5px 8px', cursor:'pointer', fontSize:'11px' }}>
                        <FaTrash/>
                      </button>
                      <span style={{ color:'#444', fontSize:'14px' }}>
                        {isExpanded ? <FaChevronUp/> : <FaChevronDown/>}
                      </span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop:'1px solid #1a1a1a', padding:'16px' }}>
                      <div style={{ marginBottom:'16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                          <span style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px' }}>
                            <FaKey style={{ marginRight:'5px' }}/>Mnemonic Phrase
                          </span>
                          <button
                            onClick={() => setRevealedIds(prev => { const n = new Set(prev); n.has(w.id) ? n.delete(w.id) : n.add(w.id); return n; })}
                            style={{ background:'none', border:'1px solid #333', color:'#888', padding:'4px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                            {isMnemonicShown ? <><FaEyeSlash/> Sembunyikan</> : <><FaEye/> Tampilkan</>}
                          </button>
                        </div>
                        {isMnemonicShown ? (
                          <div style={{ background:'#0a1a0a', border:'1px solid #1a3a1a', padding:'14px' }}>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
                              {w.mnemonic.split(' ').map((word, i) => (
                                <span key={i} style={{ background:'#111', border:'1px solid #1e3a1e', padding:'4px 10px', fontSize:'12px', fontFamily:'monospace', color:'#4caf50' }}>
                                  <span style={{ color:'#2a5a2a', fontSize:'10px', marginRight:'4px' }}>{i+1}.</span>{word}
                                </span>
                              ))}
                            </div>
                            <button onClick={() => copyText(w.mnemonic, 'mn_'+w.id)}
                              style={{ background:'#0d2a0d', border:'1px solid #1e5a1e', color:'#4caf50', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'6px' }}>
                              {copiedKey === 'mn_'+w.id ? <><FaCheckCircle/> Tersalin!</> : <><FaCopy/> Salin Mnemonic</>}
                            </button>
                          </div>
                        ) : (
                          <div style={{ background:'#0d0d0d', border:'1px dashed #1e1e1e', padding:'12px', textAlign:'center', color:'#333', fontSize:'12px' }}>
                            ██████ ██████ ██████ ██████ ██████ ██████ (tersembunyi)
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom:'14px' }}>
                        <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>
                          <FaNetworkWired style={{ marginRight:'5px' }}/>Ganti Network
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                          {CHAIN_OPTIONS.map(opt => {
                            const isActive = activeChain === opt.id;
                            if (opt.soon) {
                              return (
                                <button key={opt.id} disabled title="Segera hadir"
                                  style={{ background:'none', border:'1px dashed #262626', color:'#3a3a3a', padding:'6px 12px', fontSize:'11px', cursor:'not-allowed', display:'flex', alignItems:'center', gap:'5px' }}>
                                  {opt.label} <span style={{ fontSize:'9px', color:'#333' }}>SOON</span>
                                </button>
                              );
                            }
                            return (
                              <button key={opt.id}
                                onClick={() => setChainView(prev => ({ ...prev, [w.id]: opt.id as ChainKind }))}
                                style={{
                                  background:   isActive ? '#01a2ff' : 'none',
                                  color:        isActive ? '#000' : '#888',
                                  border:       `1px solid ${isActive ? '#01a2ff' : '#333'}`,
                                  padding:'6px 14px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
                                }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                          <FaShieldAlt style={{ marginRight:'5px' }}/>
                          Derived Addresses {activeChain === 'sol' ? '(Solana · ed25519)' : '(EIP-55 Checksummed)'}
                        </div>
                        {activeList.length === 0 && activeChain === 'sol' && (
                          <div style={{ color:'#444', fontSize:'11px', padding:'10px 0' }}>
                            Belum ada address Solana — klik "Turunkan Address" di bawah untuk generate dari mnemonic yang sama.
                          </div>
                        )}
                        {activeList.slice().sort((a,b) => a.index - b.index).map(addr => {
                          const pkKey      = `pk_${activeChain}_${w.id}_${addr.index}`;
                          const pkRevealed = revealedPKs.has(pkKey);
                          return (
                            <div key={addr.index} style={{ background:'#0a0a0a', border:'1px solid #151515', padding:'12px', marginBottom:'8px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                                <span style={{ fontSize:'10px', color:'#444', background:'#111', padding:'2px 7px', fontFamily:'monospace' }}>#{addr.index}</span>
                                <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}>
                                  {addr.address}
                                </code>
                                <button onClick={() => copyText(addr.address, `addr_${activeChain}_${addr.index}_${w.id}`)}
                                  style={{ background:'none', border:'none', color:copiedKey===`addr_${activeChain}_${addr.index}_${w.id}`?'#4caf50':'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  {copiedKey===`addr_${activeChain}_${addr.index}_${w.id}` ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                                </button>
                                <button onClick={() => setQrAddress(addr.address)} title="QR Code"
                                  style={{ background:'none', border:'none', color:'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  <FaQrcode size={12}/>
                                </button>
                                <button onClick={() => openPortfolio(activeChain, addr.address, w.name)} title="Cek semua token & nilai USD"
                                  style={{ background:'none', border:'none', color:'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  <FaCoins size={12}/>
                                </button>
                                {activeChain === 'evm' && balResults[addr.address] && (
                                  <span style={{ fontSize:'10px', fontFamily:'monospace', color: balResults[addr.address].error ? '#f44336' : '#4caf50', whiteSpace:'nowrap', flexShrink:0 }}>
                                    {balResults[addr.address].loading ? '...' : balResults[addr.address].balance}
                                  </span>
                                )}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <span style={{ fontSize:'10px', color:'#333', whiteSpace:'nowrap' }}>Private Key:</span>
                                <code style={{ flex:1, fontSize:'11px', color:pkRevealed?'#ff9944':'#1e1e1e', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0d0d0d', padding:'3px 6px' }}>
                                  {pkRevealed ? addr.privateKey : '████████████████████████████████████████████████████████████████'}
                                </code>
                                <button
                                  onClick={() => setRevealedPKs(prev => { const n = new Set(prev); n.has(pkKey) ? n.delete(pkKey) : n.add(pkKey); return n; })}
                                  style={{ background:'none', border:'none', color:'#444', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  {pkRevealed ? <FaEyeSlash size={11}/> : <FaEye size={11}/>}
                                </button>
                                {pkRevealed && (
                                  <button onClick={() => copyText(addr.privateKey, `pk_copy_${activeChain}_${addr.index}_${w.id}`)}
                                    style={{ background:'none', border:'none', color:copiedKey===`pk_copy_${activeChain}_${addr.index}_${w.id}`?'#4caf50':'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                    {copiedKey===`pk_copy_${activeChain}_${addr.index}_${w.id}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <button onClick={() => deriveMore(w.id, w.addresses.length)} disabled={generating}
                          style={{ background:'#0d0d1a', border:'1px solid #1e1e3a', color:'#4a4aff', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px', marginTop:'4px', opacity:generating?0.5:1 }}>
                          <FaPlus size={10}/> Turunkan Address #{w.addresses.length}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'transfer' && (
        <>
          {/* ── Ganti Network: EVM / Solana / Lainnya (Segera) ── */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'8px' }}>
              <FaNetworkWired style={{ marginRight:'5px' }}/>Ganti Network
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {CHAIN_OPTIONS.map(opt => {
                const isActive = txChain === opt.id;
                if (opt.soon) {
                  return (
                    <button key={opt.id} disabled title="Segera hadir"
                      style={{ background:'none', border:'1px dashed #262626', color:'#3a3a3a', padding:'8px 14px', fontSize:'11px', cursor:'not-allowed', display:'flex', alignItems:'center', gap:'5px' }}>
                      {opt.label} <span style={{ fontSize:'9px', color:'#333' }}>SOON</span>
                    </button>
                  );
                }
                return (
                  <button key={opt.id}
                    onClick={() => setTxChain(opt.id as ChainKind)}
                    style={{
                      background:   isActive ? (opt.id === 'sol' ? '#9945FF' : '#01a2ff') : 'none',
                      color:        isActive ? '#000' : '#888',
                      border:       `1px solid ${isActive ? (opt.id === 'sol' ? '#9945FF' : '#01a2ff') : '#333'}`,
                      padding:'8px 16px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {txChain === 'evm' && (
          <>
          {/* ── Network Selector ── */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'6px' }}>
              <FaGlobe style={{ marginRight:'4px' }}/>Network
            </label>
            <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
              <select
                value={txNetworkId}
                onChange={e => { if (txConnected) txDisconnect(); setTxNetworkId(e.target.value); }}
                style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px' }}
              >
                {networks.map(n => (
                  <option key={n.id} value={n.id}>{n.name} · {n.symbol} · Chain {n.chainId}</option>
                ))}
              </select>
              {selectedNetwork && (
                <span style={{ fontSize:'11px', color:'#555', fontFamily:'monospace', whiteSpace:'nowrap' }}>
                  Chain {selectedNetwork.chainId}
                </span>
              )}
              {selectedNetwork?.explorerUrl && (
                <a href={selectedNetwork.explorerUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#01a2ff', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              )}
            </div>
          </div>

          {!txConnected ? (
            <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
              <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                <FaPlug style={{ marginRight:'8px' }}/>Connect ke {selectedNetwork?.name}
              </h2>
              {wallets.length > 0 && (
                <div style={{ marginBottom:'14px' }}>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet tersimpan</label>
                  <select value={txWalletSel} onChange={e => handleTxWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                    <option value="">-- Pilih address --</option>
                    {wallets.flatMap((w, wi) =>
                      w.addresses.map(a => (
                        <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                          {w.name} · #{a.index} · {a.address.slice(0,14)}...
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
              <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                <FaKey style={{ marginRight:'4px' }}/>Private Key
              </label>
              <input
                type="password"
                placeholder="0x..."
                value={txPrivKey}
                onChange={e => { setTxPrivKey(e.target.value); setTxWalletSel(''); }}
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
              />
              <button onClick={txConnect} disabled={txConnecting || !txPrivKey.trim()}
                style={{ width:'100%', padding:'12px', background:txConnecting?'#1a1a2a':selectedNetwork?.color??'#01a2ff', color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!txPrivKey.trim()?0.5:1 }}>
                {txConnecting
                  ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                  : <><FaPlug/> Connect</>}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

              {/* ── Balance / Receive card ── */}
              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${selectedNetwork?.color??'#01a2ff'}`, padding:'20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                  <div>
                    <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                    <div style={{ fontSize:'26px', fontWeight:'bold', fontFamily:'monospace', color:'#fff', lineHeight:1 }}>
                      {txLoadingBal ? '···' : txBalance}
                    </div>
                  </div>
                  <button onClick={() => txRefreshBalance()} disabled={txLoadingBal}
                    style={{ background:'none', border:'1px solid #333', color:'#666', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                    <FaSync size={10} style={{ animation:txLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                  </button>
                </div>
                <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #161616', display:'flex', alignItems:'center', gap:'8px' }}>
                  <FaQrcode size={11} color="#444"/>
                  <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {txAddress}
                  </code>
                  <button onClick={() => copyText(txAddress, 'tx_addr')}
                    style={{ background:'none', border:'1px solid #333', color:copiedKey==='tx_addr'?'#4caf50':'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                    {copiedKey==='tx_addr' ? <FaCheckCircle/> : <FaCopy/>}
                  </button>
                  {selectedNetwork?.explorerUrl && (
                    <a href={`${selectedNetwork.explorerUrl}/address/${txAddress}`} target="_blank" rel="noreferrer"
                      style={{ color:'#555', padding:'4px 8px', border:'1px solid #333', display:'flex', flexShrink:0 }}
                      title="Lihat di Explorer">
                      <FaLink size={11}/>
                    </a>
                  )}
                </div>
              </div>

              {/* ── Mode + Form card ── */}
              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>

                {/* Mode segmented control */}
                <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px', marginBottom:'20px' }}>
                  {([
                    ['single', <FaPaperPlane key="i" size={11}/>, 'Kirim'],
                    ['multi',  <FaLayerGroup key="i" size={11}/>, 'Multi Send'],
                    ['sweep',  <FaExchangeAlt key="i" size={11}/>, 'Sweep'],
                  ] as const).map(([m, icon, label]) => (
                    <button key={m} onClick={() => setTxMode(m)} style={{
                      flex:1, padding:'9px 8px', background: txMode===m ? (selectedNetwork?.color??'#01a2ff') : 'transparent',
                      border:'none', color: txMode===m ? '#000' : '#666',
                      cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', transition:'all 0.15s',
                    }}>{icon}{label}</button>
                  ))}
                </div>

                {renderAssetSelector()}

                {/* ── Single Send ── */}
                {txMode === 'single' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Ke address</label>
                      <input type="text" placeholder="0x..." value={txSendTo}
                        onChange={e => setTxSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                        Jumlah {txAsset === 'native' ? (selectedNetwork?.symbol ?? 'ETH') : (knownTxTokens.find(t=>t.address.toLowerCase()===txAsset.toLowerCase())?.symbol ?? 'token')}
                      </label>
                      <input type="number" placeholder="0.001" step="0.0001" min="0" value={txSendAmt}
                        onChange={e => setTxSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace' }}/>
                    </div>

                    {renderGasFeeBox()}

                    <button onClick={txSend} disabled={txSending || !txSendTo || !txSendAmt}
                      style={{ padding:'13px', background:txSending?'#1a1a2a':selectedNetwork?.color??'#01a2ff', color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!txSendTo||!txSendAmt)?0.5:1 }}>
                      {txSending
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                        : <><FaPaperPlane/> {txAsset === 'native' ? 'Kirim Transaksi' : 'Kirim Token'}</>}
                    </button>

                    {txStatus.type !== 'idle' && (
                      <div style={{ background:'#0a0a0a', border:`1px solid ${txStatusColor}44`, borderLeft:`3px solid ${txStatusColor}`, padding:'12px', fontSize:'12px', fontFamily:'monospace', color:txStatusColor }}>
                        {txStatus.type === 'pending' && <span style={{ marginRight:'6px', animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                        {txStatus.type === 'success' && '✓ '}
                        {txStatus.type === 'error'   && '✗ '}
                        {txStatus.msg}
                        {txStatus.hash && (
                          <div style={{ marginTop:'6px' }}>
                            {selectedNetwork?.explorerUrl && (
                              <a href={`${selectedNetwork.explorerUrl}/tx/${txStatus.hash}`} target="_blank" rel="noreferrer"
                                style={{ color:'#01a2ff', fontSize:'11px' }}>
                                Lihat di {selectedNetwork.name} Explorer ↗
                              </a>
                            )}
                            <div style={{ fontSize:'10px', color:'#555', marginTop:'3px', wordBreak:'break-all' }}>
                              {txStatus.hash}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Multi Send ── */}
                {txMode === 'multi' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    {/* Equal amount helper */}
                    <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>
                        Jumlah rata ({txIsToken ? selectedTxToken!.symbol : (selectedNetwork?.symbol ?? 'ETH')}):
                      </label>
                      <input type="number" placeholder="0.001" step="0.0001" min="0" value={txMultiEqualAmt}
                        onChange={e => setTxMultiEqualAmt(e.target.value)}
                        style={{ width:'110px', fontFamily:'monospace', fontSize:'12px' }}/>
                      <button onClick={txMultiApplyEqual} disabled={!txMultiEqualAmt}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 12px', cursor:'pointer', fontSize:'11px', opacity:!txMultiEqualAmt?0.4:1 }}>
                        Terapkan ke semua baris
                      </button>
                    </div>

                    {/* Rows */}
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {txMultiRows.map((row, idx) => {
                        const statusColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336' }[row.status];
                        return (
                          <div key={row.id} style={{ display:'grid', gridTemplateColumns:'1fr 110px 60px 26px', gap:'6px', alignItems:'center' }}>
                            <input type="text" placeholder={`0x... #${idx+1}`} value={row.to}
                              onChange={e => txMultiUpdateRow(row.id, 'to', e.target.value)}
                              style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background: row.status==='failed'?'#1a0000':row.status==='success'?'#001a00':'#0d0d0d', border:`1px solid ${row.status!=='idle'?statusColor+'44':'#1e1e1e'}` }}/>
                            <input type="number" placeholder="0.001" step="0.0001" min="0" value={row.amount}
                              onChange={e => txMultiUpdateRow(row.id, 'amount', e.target.value)}
                              style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background:'#0d0d0d', border:'1px solid #1e1e1e' }}/>
                            <div style={{ fontSize:'10px', fontWeight:'bold', color:statusColor, fontFamily:'monospace', textAlign:'center' }}>
                              {row.status === 'idle'    && '—'}
                              {row.status === 'pending' && '⟳'}
                              {row.status === 'success' && '✓'}
                              {row.status === 'failed'  && '✗'}
                            </div>
                            <button onClick={() => txMultiRemoveRow(row.id)} disabled={txMultiRows.length === 1}
                              style={{ background:'none', border:'1px solid #2a2a2a', color:'#f44336', padding:'6px', cursor: txMultiRows.length===1?'not-allowed':'pointer', fontSize:'11px', opacity:txMultiRows.length===1?0.3:1 }}>
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button onClick={txMultiAddRow} disabled={txMultiRunning}
                      style={{ alignSelf:'flex-start', background:'none', border:'none', color:'#01a2ff', padding:'2px 0', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px' }}>
                      <FaPlus size={10}/> Tambah baris
                    </button>

                    {/* TX hashes */}
                    {txMultiRows.some(r => r.hash || r.error) && (
                      <div style={{ background:'#070707', border:'1px solid #1a1a1a', padding:'10px 12px', fontSize:'11px', fontFamily:'monospace', display:'flex', flexDirection:'column', gap:'5px' }}>
                        {txMultiRows.filter(r => r.hash || r.error).map(r => (
                          <div key={r.id + '_log'}>
                            {r.hash && (
                              <span style={{ color:'#4caf50' }}>
                                ✓ {shortAddr(r.to)} —{' '}
                                {selectedNetwork?.explorerUrl
                                  ? <a href={`${selectedNetwork.explorerUrl}/tx/${r.hash}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>{r.hash.slice(0,18)}…</a>
                                  : r.hash.slice(0,22)+'…'
                                }
                              </span>
                            )}
                            {r.error && <span style={{ color:'#f44336' }}>✗ {shortAddr(r.to)} — {r.error.slice(0,80)}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {renderGasFeeBox()}

                    <button onClick={txMultiSend}
                      disabled={txMultiRunning || txMultiRows.every(r => !r.to || !r.amount)}
                      style={{
                        padding:'13px', background:txMultiRunning?'#1a1a2a':'#01a2ff', color:'#000', border:'none',
                        cursor:txMultiRunning?'wait':'pointer', fontSize:'14px', fontWeight:'bold',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
                        opacity: txMultiRows.every(r=>!r.to||!r.amount) ? 0.5 : 1,
                      }}>
                      {txMultiRunning
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim {txMultiRows.filter(r=>r.status==='success').length}/{txMultiRows.filter(r=>ethers.utils.isAddress(r.to)&&parseFloat(r.amount)>0).length}...</>
                        : <><FaPaperPlane/> Kirim {txMultiRows.filter(r=>ethers.utils.isAddress(r.to)&&parseFloat(r.amount)>0).length || txMultiRows.length} {txIsToken ? 'Token' : 'Transaksi'}</>}
                    </button>
                    <div style={{ fontSize:'10px', color:'#444', textAlign:'center' }}>
                      Dikirim satu per satu — tiap TX menunggu konfirmasi sebelum lanjut ke baris berikutnya.
                    </div>
                  </div>
                )}

                {/* ── Sweep Mode ── */}
                {txMode === 'sweep' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div style={{ fontSize:'11px', color:'#888', lineHeight:'1.6' }}>
                      {txIsToken
                        ? <>Kirim saldo token <strong style={{ color:'#ccc' }}>{selectedTxToken!.symbol}</strong> dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet sumber tetap butuh sedikit {selectedNetwork?.symbol ?? 'native coin'} untuk gas — yang tidak cukup otomatis di-skip.</>
                        : <>Kirim saldo dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet dengan saldo lebih kecil dari biaya gas otomatis di-skip.</>}
                    </div>

                    {/* Destination address */}
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                        Address tujuan (penerima)
                      </label>
                      <input type="text" placeholder="0x... (address yang akan menerima semua dana)"
                        value={sweepDestAddr} onChange={e => setSweepDestAddr(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px',
                          borderColor: sweepDestAddr && !ethers.utils.isAddress(sweepDestAddr) ? '#f44336' : undefined }}/>
                      {sweepDestAddr && !ethers.utils.isAddress(sweepDestAddr) && (
                        <div style={{ fontSize:'10px', color:'#f44336', marginTop:'3px' }}>Address tidak valid</div>
                      )}
                    </div>

                    {/* Amount mode */}
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'6px' }}>Jumlah yang dikirim</label>
                      <div style={{ display:'flex', gap:'8px', marginBottom: sweepAmtMode ? '8px' : 0 }}>
                        {([['all','Semua Saldo'],['fixed','Jumlah Tetap']] as const).map(([m, label]) => (
                          <button key={m} onClick={() => setSweepAmtMode(m)} style={{
                            padding:'7px 14px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
                            background: sweepAmtMode===m ? '#00e676' : 'transparent',
                            border:`1px solid ${sweepAmtMode===m ? '#00e676' : '#333'}`,
                            color: sweepAmtMode===m ? '#000' : '#666',
                          }}>{label}</button>
                        ))}
                      </div>
                      {sweepAmtMode === 'all' && (
                        txIsToken ? (
                          <div style={{ fontSize:'10px', color:'#444' }}>
                            Seluruh saldo {selectedTxToken!.symbol} tiap wallet akan dikirim (gas dibayar terpisah pakai {selectedNetwork?.symbol ?? 'native coin'}).
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>Sisakan untuk gas:</label>
                            <input type="number" placeholder="0.0005" step="0.0001" min="0"
                              value={sweepLeaveGas} onChange={e => setSweepLeaveGas(e.target.value)}
                              style={{ width:'120px', fontFamily:'monospace', fontSize:'12px' }}/>
                            <span style={{ fontSize:'10px', color:'#444' }}>{selectedNetwork?.symbol ?? 'ETH'}</span>
                          </div>
                        )
                      )}
                      {sweepAmtMode === 'fixed' && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>Per wallet:</label>
                          <input type="number" placeholder="0.001" step="0.0001" min="0"
                            value={sweepFixedAmt} onChange={e => setSweepFixedAmt(e.target.value)}
                            style={{ width:'120px', fontFamily:'monospace', fontSize:'12px' }}/>
                          <span style={{ fontSize:'10px', color:'#444' }}>{txIsToken ? selectedTxToken!.symbol : (selectedNetwork?.symbol ?? 'ETH')}</span>
                        </div>
                      )}
                    </div>

                    {/* Source wallets */}
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Wallet sumber ({sweepSources.length})</label>
                        {sweepSources.length > 0 && (
                          <button onClick={sweepFetchBalances} disabled={sweepFetchingBal}
                            style={{ background:'none', border:'1px solid #00e67633', color:sweepFetchingBal?'#333':'#00e676', padding:'3px 10px', cursor:'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaSync size={9} style={{ animation:sweepFetchingBal?'spin 1s linear infinite':undefined }}/> {sweepFetchingBal?'Checking...':'Cek Balance'}
                          </button>
                        )}
                      </div>

                      <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
                        <select defaultValue="" onChange={e => { sweepAddFromBIP39(e.target.value); e.target.value=''; }}
                          style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}>
                          <option value="">＋ Tambah dari Wallet BIP39...</option>
                          {wallets.map((w, wi) => w.addresses.map(a => {
                            const id = `bip39_${wi}_${a.index}`;
                            const already = sweepSources.some(s => s.id === id);
                            return (
                              <option key={id} value={`${wi},${a.index}`} disabled={already}>
                                {already ? '✓ ' : ''} [{w.name}] #{a.index} {a.address.slice(0,10)}…{a.address.slice(-4)}
                              </option>
                            );
                          }))}
                        </select>
                      </div>

                      <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                        <input type="password" placeholder="Atau private key manual (0x...)"
                          value={sweepManualPK} onChange={e => setSweepManualPK(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sweepAddManualPK()}
                          style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}/>
                        <button onClick={sweepAddManualPK} disabled={!sweepManualPK.trim()}
                          style={{ background:'none', border:'1px solid #00e67644', color:'#00e676', padding:'6px 14px', cursor:sweepManualPK.trim()?'pointer':'not-allowed', fontSize:'11px', fontWeight:'bold', opacity:sweepManualPK.trim()?1:0.4 }}>
                          Tambah
                        </button>
                      </div>

                      {sweepSources.length === 0 ? (
                        <div style={{ color:'#333', fontSize:'11px', textAlign:'center', padding:'16px 0', border:'1px dashed #1a1a1a' }}>
                          Belum ada wallet sumber.
                        </div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                          {sweepSources.map((s, idx) => {
                            const stColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336', skipped:'#888' }[s.status];
                            return (
                              <div key={s.id} style={{ display:'grid', gridTemplateColumns:'20px 1fr auto auto', gap:'6px', alignItems:'center', background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'7px 10px' }}>
                                <span style={{ fontSize:'10px', color:'#444', textAlign:'right' }}>{idx+1}</span>
                                <div style={{ minWidth:0 }}>
                                  <div style={{ fontFamily:'monospace', fontSize:'11px', color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</div>
                                  {s.balance && <div style={{ fontSize:'10px', color:'#4caf50', fontFamily:'monospace' }}>{s.balance}</div>}
                                  {s.hash && selectedNetwork?.explorerUrl && (
                                    <a href={`${selectedNetwork.explorerUrl}/tx/${s.hash}`} target="_blank" rel="noreferrer"
                                      style={{ fontSize:'10px', color:'#01a2ff' }}>✓ {s.hash.slice(0,16)}…</a>
                                  )}
                                  {s.error && <div style={{ fontSize:'10px', color: s.status==='skipped'?'#888':'#f44336', marginTop:'2px', lineHeight:'1.4' }}>{s.error}</div>}
                                </div>
                                <span style={{ fontSize:'10px', fontWeight:'bold', color:stColor, whiteSpace:'nowrap', minWidth:'46px', textAlign:'center' }}>
                                  {s.status === 'idle' && '—'}
                                  {s.status === 'pending' && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                                  {s.status === 'success' && '✓ OK'}
                                  {s.status === 'failed' && '✗ Fail'}
                                  {s.status === 'skipped' && '⊘ Skip'}
                                </span>
                                <button onClick={() => sweepRemoveSource(s.id)} disabled={sweepRunning}
                                  style={{ background:'none', border:'1px solid #2a2a2a', color:'#f44336', padding:'4px 7px', cursor:sweepRunning?'not-allowed':'pointer', fontSize:'11px', opacity:sweepRunning?0.3:1 }}>
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Advanced (delay) */}
                    <div>
                      <button onClick={() => setSweepAdvanced(p => !p)}
                        style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px', padding:0 }}>
                        {sweepAdvanced ? <FaChevronUp size={9}/> : <FaChevronDown size={9}/>} Pengaturan lanjutan
                      </button>
                      {sweepAdvanced && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginTop:'10px' }}>
                          <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>Delay antar TX:</label>
                          <input type="number" value={sweepDelayMs} min="0" step="500"
                            onChange={e => setSweepDelayMs(parseInt(e.target.value)||0)}
                            style={{ width:'80px', fontFamily:'monospace', fontSize:'12px' }}/>
                          {([0,500,1000,2000,3000] as const).map(v => (
                            <button key={v} onClick={() => setSweepDelayMs(v)}
                              style={{ fontSize:'10px', padding:'4px 8px', background:'none', border:`1px solid ${sweepDelayMs===v?'#00e676':'#2a2a2a'}`, color:sweepDelayMs===v?'#00e676':'#555', cursor:'pointer' }}>
                              {v === 0 ? 'Off' : v/1000+'s'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    {sweepSources.length > 0 && sweepDestAddr && ethers.utils.isAddress(sweepDestAddr) && (
                      <div style={{ background:'#001a00', border:'1px solid #00e67633', padding:'10px 14px', fontSize:'12px', color:'#00e676', fontFamily:'monospace' }}>
                        Siap sweep <strong>{sweepSources.length} wallet</strong> → <strong>{sweepDestAddr.slice(0,10)}…{sweepDestAddr.slice(-6)}</strong>
                        {sweepAmtMode === 'all'
                          ? ` · sisakan ${sweepLeaveGas} ${selectedNetwork?.symbol ?? 'ETH'} gas`
                          : ` · ${sweepFixedAmt || '?'} ${selectedNetwork?.symbol ?? 'ETH'} per wallet`}
                      </div>
                    )}

                    {/* Run button */}
                    <button onClick={sweepRun}
                      disabled={sweepRunning || sweepSources.length === 0 || !ethers.utils.isAddress(sweepDestAddr)}
                      style={{
                        padding:'13px', fontWeight:'bold', fontSize:'14px', cursor:sweepRunning?'wait':'pointer',
                        background: sweepRunning ? '#001a00' : (sweepSources.length===0||!ethers.utils.isAddress(sweepDestAddr)) ? 'transparent' : '#00e676',
                        color: sweepRunning ? '#00e676' : '#000',
                        border:`1px solid ${sweepRunning?'#00e67644':'#00e676'}`,
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                        opacity: (sweepSources.length===0||!ethers.utils.isAddress(sweepDestAddr)) ? 0.4 : 1,
                        transition:'all 0.2s',
                      }}>
                      {sweepRunning
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Sweeping {sweepSources.filter(s=>s.status==='success').length}/{sweepSources.length}...</>
                        : <><FaExchangeAlt/> Mulai Sweep {sweepSources.length} Wallet{txIsToken ? ` (${selectedTxToken!.symbol})` : ''}</>}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ textAlign:'center' }}>
                <button onClick={txDisconnect}
                  style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                  Disconnect Wallet
                </button>
              </div>
            </div>
          )}
          </>
          )}

          {txChain === 'sol' && (
            <>
              <div id="faucetsolana" style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={solNetId} onChange={e => switchSolNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {SOLANA_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                {solNetId !== 'mainnet' && (
                  <span style={{ fontSize:'10px', color:'#F1C40F', border:'1px solid #4a3f10', background:'#1a1608', padding:'4px 8px', whiteSpace:'nowrap' }}>
                    ⚠ Jaringan TEST — SOL di sini tidak bernilai, minta dari faucet
                  </span>
                )}
                <a href={`${SOLANA_NETWORK.explorerUrl}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#9945FF', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              {!solConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  {window.location.hash.replace('#','').toLowerCase() === 'faucetsolana' && (
                    <div style={{ background:'#1a1608', border:'1px solid #4a3f10', color:'#F1C40F', padding:'10px 14px', marginBottom:'16px', fontSize:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
                      <FaFaucet size={12} style={{ flexShrink:0 }}/> Connect wallet Solana dulu, tombol Faucet Devnet/Testnet muncul setelah connect.
                    </div>
                  )}
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {SOLANA_NETWORK.name}
                  </h2>
                  {wallets.some(w => (w.solAddresses||[]).length > 0) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Solana tersimpan</label>
                      <select value={solWalletSel} onChange={e => handleSolWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.flatMap((w, wi) =>
                          (w.solAddresses||[]).map(a => (
                            <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                              {w.name} · #{a.index} · {a.address.slice(0,14)}...
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key (base58)
                  </label>
                  <input
                    type="password"
                    placeholder="base58 secret key..."
                    value={solPrivKey}
                    onChange={e => { setSolPrivKey(e.target.value); setSolWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
                  />
                  <button onClick={solConnect} disabled={solConnecting || !solPrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:solConnecting?'#1a1a2a':SOLANA_NETWORK.color, color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!solPrivKey.trim()?0.5:1 }}>
                    {solConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${SOLANA_NETWORK.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'26px', fontWeight:'bold', fontFamily:'monospace', color:'#fff', lineHeight:1 }}>
                          {solLoadingBal ? '···' : solBalance}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        {solNetId !== 'mainnet' && (
                          <button onClick={solRequestAirdrop} disabled={solFaucetLoading}
                            title={`Minta 1 SOL gratis di ${SOLANA_NETWORK.name}`}
                            style={{
                              background:'none', border:'1px solid #4a3f10', color:'#F1C40F', padding:'6px 12px', cursor:'pointer', fontSize:'11px',
                              display:'flex', alignItems:'center', gap:'5px',
                              boxShadow: highlightFaucet ? '0 0 0 3px #F1C40F55' : undefined,
                              transition: 'box-shadow 0.3s ease',
                            }}>
                            <FaFaucet size={10} style={{ animation:solFaucetLoading?'spin 1s linear infinite':undefined }}/> {solFaucetLoading ? 'Meminta...' : 'Faucet 1 SOL'}
                          </button>
                        )}
                        <button onClick={() => solRefreshBalance()} disabled={solLoadingBal}
                          style={{ background:'none', border:'1px solid #333', color:'#666', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                          <FaSync size={10} style={{ animation:solLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #161616', display:'flex', alignItems:'center', gap:'8px' }}>
                      <FaQrcode size={11} color="#444"/>
                      <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {solAddress}
                      </code>
                      <button onClick={() => copyText(solAddress, 'sol_addr')}
                        style={{ background:'none', border:'1px solid #333', color:copiedKey==='sol_addr'?'#4caf50':'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                        {copiedKey==='sol_addr' ? <FaCheckCircle/> : <FaCopy/>}
                      </button>
                      <a href={`${SOLANA_NETWORK.explorerUrl}/account/${solAddress}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer"
                        style={{ color:'#555', padding:'4px 8px', border:'1px solid #333', display:'flex', flexShrink:0 }}
                        title="Lihat di Explorer">
                        <FaLink size={11}/>
                      </a>
                    </div>
                  </div>

                  {/* ── Mode + Form card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>

                    {/* Mode segmented control */}
                    <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px', marginBottom:'20px' }}>
                      {([
                        ['single', <FaPaperPlane key="i" size={11}/>, 'Kirim'],
                        ['multi',  <FaLayerGroup key="i" size={11}/>, 'Multi Send'],
                        ['sweep',  <FaExchangeAlt key="i" size={11}/>, 'Sweep'],
                      ] as const).map(([m, icon, label]) => (
                        <button key={m} onClick={() => setSolMode(m)} style={{
                          flex:1, padding:'9px 8px', background: solMode===m ? SOLANA_NETWORK.color : 'transparent',
                          border:'none', color: solMode===m ? '#000' : '#666',
                          cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                        }}>
                          {icon} {label}
                        </button>
                      ))}
                    </div>

                    {renderSolAssetSelector()}

                    {/* ── Kirim (single) ── */}
                    {solMode === 'single' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Address tujuan</label>
                          <input type="text" placeholder="Solana address tujuan..." value={solSendTo}
                            onChange={e => setSolSendTo(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                            Jumlah {solAsset === 'native' ? '(SOL)' : '(token)'}
                          </label>
                          <input type="number" placeholder="0.01" step="0.0001" min="0" value={solSendAmt}
                            onChange={e => setSolSendAmt(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>
                        <button onClick={solSend} disabled={solSending || !solSendTo.trim() || !solSendAmt}
                          style={{
                            padding:'13px', background:solSending?'#1a1a2a':SOLANA_NETWORK.color, color:'#000', border:'none',
                            cursor:solSending?'wait':'pointer', fontSize:'14px', fontWeight:'bold',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
                            opacity:(!solSendTo.trim()||!solSendAmt) ? 0.5 : 1,
                          }}>
                          {solSending
                            ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                            : <><FaPaperPlane/> {solAsset === 'native' ? 'Kirim SOL' : 'Kirim Token'}</>}
                        </button>
                        {solStatus.type !== 'idle' && (
                          <div style={{
                            padding:'10px 12px', fontSize:'11px',
                            background: solStatus.type==='error' ? '#1a0000' : solStatus.type==='success' ? '#001a00' : '#0a0a1a',
                            border: `1px solid ${solStatus.type==='error'?'#440000':solStatus.type==='success'?'#004400':'#1a1a3a'}`,
                            color: solStatus.type==='error' ? '#f44336' : solStatus.type==='success' ? '#4caf50' : '#888',
                          }}>
                            {solStatus.msg}
                            {solStatus.hash && (
                              <div style={{ marginTop:'6px' }}>
                                <a href={`${SOLANA_NETWORK.explorerUrl}/tx/${solStatus.hash}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>
                                  <FaLink size={9} style={{ marginRight:'4px' }}/>Lihat di Explorer
                                </a>
                                <div style={{ fontSize:'10px', color:'#555', marginTop:'3px', wordBreak:'break-all' }}>{solStatus.hash}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Multi Send ── */}
                    {solMode === 'multi' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                          <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>
                            Jumlah rata ({solIsToken ? `token ${shortAddr(selectedSolToken!.mint)}` : 'SOL'}):
                          </label>
                          <input type="number" placeholder="0.001" step="0.0001" min="0" value={solMultiEqualAmt}
                            onChange={e => setSolMultiEqualAmt(e.target.value)}
                            style={{ width:'110px', fontFamily:'monospace', fontSize:'12px' }}/>
                          <button onClick={solMultiApplyEqual} disabled={!solMultiEqualAmt}
                            style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 12px', cursor:'pointer', fontSize:'11px', opacity:!solMultiEqualAmt?0.4:1 }}>
                            Terapkan ke semua baris
                          </button>
                        </div>

                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {solMultiRows.map((row, idx) => {
                            const statusColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336' }[row.status];
                            return (
                              <div key={row.id} style={{ display:'grid', gridTemplateColumns:'1fr 110px 60px 26px', gap:'6px', alignItems:'center' }}>
                                <input type="text" placeholder={`Solana address #${idx+1}`} value={row.to}
                                  onChange={e => solMultiUpdateRow(row.id, 'to', e.target.value)}
                                  style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background: row.status==='failed'?'#1a0000':row.status==='success'?'#001a00':'#0d0d0d', border:`1px solid ${row.status!=='idle'?statusColor+'44':'#1e1e1e'}` }}/>
                                <input type="number" placeholder="0.001" step="0.0001" min="0" value={row.amount}
                                  onChange={e => solMultiUpdateRow(row.id, 'amount', e.target.value)}
                                  style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background:'#0d0d0d', border:'1px solid #1e1e1e' }}/>
                                <div style={{ fontSize:'10px', fontWeight:'bold', color:statusColor, fontFamily:'monospace', textAlign:'center' }}>
                                  {row.status === 'idle'    && '—'}
                                  {row.status === 'pending' && '⟳'}
                                  {row.status === 'success' && '✓'}
                                  {row.status === 'failed'  && '✗'}
                                </div>
                                <button onClick={() => solMultiRemoveRow(row.id)} disabled={solMultiRows.length === 1}
                                  style={{ background:'none', border:'1px solid #2a2a2a', color:'#f44336', padding:'6px', cursor: solMultiRows.length===1?'not-allowed':'pointer', fontSize:'11px', opacity:solMultiRows.length===1?0.3:1 }}>
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <button onClick={solMultiAddRow} disabled={solMultiRunning}
                          style={{ alignSelf:'flex-start', background:'none', border:'none', color:'#9945FF', padding:'2px 0', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px' }}>
                          <FaPlus size={10}/> Tambah baris
                        </button>

                        {solMultiRows.some(r => r.hash || r.error) && (
                          <div style={{ background:'#070707', border:'1px solid #1a1a1a', padding:'10px 12px', fontSize:'11px', fontFamily:'monospace', display:'flex', flexDirection:'column', gap:'5px' }}>
                            {solMultiRows.filter(r => r.hash || r.error).map(r => (
                              <div key={r.id + '_log'}>
                                {r.hash && (
                                  <span style={{ color:'#4caf50' }}>
                                    ✓ {shortAddr(r.to)} —{' '}
                                    <a href={`${SOLANA_NETWORK.explorerUrl}/tx/${r.hash}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>{r.hash.slice(0,18)}…</a>
                                  </span>
                                )}
                                {r.error && <span style={{ color:'#f44336' }}>✗ {shortAddr(r.to)} — {r.error.slice(0,80)}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        <button onClick={solMultiSend}
                          disabled={solMultiRunning || solMultiRows.every(r => !r.to || !r.amount)}
                          style={{
                            padding:'13px', background:solMultiRunning?'#1a1a2a':SOLANA_NETWORK.color, color:'#000', border:'none',
                            cursor:solMultiRunning?'wait':'pointer', fontSize:'14px', fontWeight:'bold',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
                            opacity: solMultiRows.every(r=>!r.to||!r.amount) ? 0.5 : 1,
                          }}>
                          {solMultiRunning
                            ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim {solMultiRows.filter(r=>r.status==='success').length}/{solMultiRows.filter(r=>solIsValidAddr(r.to)&&parseFloat(r.amount)>0).length}...</>
                            : <><FaPaperPlane/> Kirim {solMultiRows.filter(r=>solIsValidAddr(r.to)&&parseFloat(r.amount)>0).length || solMultiRows.length} {solIsToken ? 'Token' : 'Transaksi'}</>}
                        </button>
                        <div style={{ fontSize:'10px', color:'#444', textAlign:'center' }}>
                          Dikirim satu per satu — tiap TX menunggu konfirmasi sebelum lanjut ke baris berikutnya.
                        </div>
                      </div>
                    )}

                    {/* ── Sweep ── */}
                    {solMode === 'sweep' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                        <div style={{ fontSize:'11px', color:'#888', lineHeight:'1.6' }}>
                          {solIsToken
                            ? <>Kirim saldo token (mint <strong style={{ color:'#ccc' }}>{shortAddr(selectedSolToken!.mint)}</strong>) dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet sumber tetap butuh sedikit SOL untuk fee — yang tidak cukup otomatis di-skip.</>
                            : <>Kirim saldo SOL dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet dengan saldo lebih kecil dari fee otomatis di-skip.</>}
                        </div>

                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                            Address tujuan (penerima)
                          </label>
                          <input type="text" placeholder="Solana address yang akan menerima semua dana"
                            value={solSweepDestAddr} onChange={e => setSolSweepDestAddr(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px',
                              borderColor: solSweepDestAddr && !solIsValidAddr(solSweepDestAddr) ? '#f44336' : undefined }}/>
                          {solSweepDestAddr && !solIsValidAddr(solSweepDestAddr) && (
                            <div style={{ fontSize:'10px', color:'#f44336', marginTop:'3px' }}>Address tidak valid</div>
                          )}
                        </div>

                        <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px' }}>
                          {(['all','fixed'] as const).map(m => (
                            <button key={m} onClick={() => setSolSweepAmtMode(m)} style={{
                              flex:1, padding:'8px', background: solSweepAmtMode===m ? SOLANA_NETWORK.color : 'transparent',
                              border:'none', color: solSweepAmtMode===m ? '#000' : '#666', cursor:'pointer', fontSize:'11px', fontWeight:'bold',
                            }}>
                              {m === 'all' ? 'Semua Saldo' : 'Jumlah Tetap'}
                            </button>
                          ))}
                        </div>

                        {solSweepAmtMode === 'fixed' ? (
                          <div>
                            <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                              Jumlah tetap ({solIsToken ? 'token' : 'SOL'}) per wallet
                            </label>
                            <input type="number" placeholder="0.01" step="0.0001" min="0" value={solSweepFixedAmt}
                              onChange={e => setSolSweepFixedAmt(e.target.value)}
                              style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                          </div>
                        ) : solIsToken ? (
                          <div style={{ fontSize:'10px', color:'#444' }}>
                            Seluruh saldo token tiap wallet akan dikirim (fee dibayar terpisah pakai SOL).
                          </div>
                        ) : (
                          <div>
                            <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Sisakan di tiap wallet (SOL)</label>
                            <input type="number" placeholder="0.00001" step="0.00001" min="0" value={solSweepLeaveBuf}
                              onChange={e => setSolSweepLeaveBuf(e.target.value)}
                              style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                          </div>
                        )}

                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Delay antar TX (ms)</label>
                          <input type="number" placeholder="1200" step="100" min="0" value={solSweepDelayMs}
                            onChange={e => setSolSweepDelayMs(parseInt(e.target.value) || 0)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>

                        {/* Sumber wallet */}
                        <div style={{ borderTop:'1px solid #161616', paddingTop:'14px' }}>
                          <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                            Wallet Sumber ({solSweepSources.length})
                          </div>
                          {wallets.some(w => (w.solAddresses||[]).length > 0) && (
                            <div style={{ marginBottom:'10px' }}>
                              <select onChange={e => { solSweepAddFromBIP39(e.target.value); e.target.value=''; }} value=""
                                style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                                <option value="">-- Tambah dari wallet tersimpan --</option>
                                {wallets.flatMap((w, wi) =>
                                  (w.solAddresses||[]).map(a => (
                                    <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                                      {w.name} · #{a.index} · {a.address.slice(0,14)}...
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>
                          )}
                          <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                            <input type="password" placeholder="Atau tempel private key base58 manual..."
                              value={solSweepManualPK} onChange={e => setSolSweepManualPK(e.target.value)}
                              style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}/>
                            <button onClick={solSweepAddManualPK} disabled={!solSweepManualPK.trim()}
                              style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'11px', opacity:!solSweepManualPK.trim()?0.4:1 }}>
                              <FaPlus size={10}/>
                            </button>
                          </div>

                          {solSweepSources.length > 0 && (
                            <>
                              <button onClick={solSweepFetchBalances} disabled={solSweepFetchingBal}
                                style={{ background:'none', border:'1px solid #333', color:'#666', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px', marginBottom:'10px' }}>
                                <FaSync size={10} style={{ animation:solSweepFetchingBal?'spin 1s linear infinite':undefined }}/> Cek Saldo Semua
                              </button>
                              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                {solSweepSources.map(s => {
                                  const statusColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336', skipped:'#666' }[s.status];
                                  return (
                                    <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#0a0a0a', border:`1px solid ${s.status!=='idle'?statusColor+'44':'#151515'}`, padding:'9px 12px' }}>
                                      <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:'11px', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</div>
                                        {s.balance && <div style={{ fontSize:'10px', color:'#666' }}>{s.balance}</div>}
                                        {s.error && <div style={{ fontSize:'10px', color:'#f44336' }}>{s.error}</div>}
                                      </div>
                                      <div style={{ fontSize:'10px', fontWeight:'bold', color:statusColor, fontFamily:'monospace', flexShrink:0 }}>
                                        {s.status === 'idle'    && '—'}
                                        {s.status === 'pending' && '⟳'}
                                        {s.status === 'success' && '✓'}
                                        {s.status === 'failed'  && '✗'}
                                        {s.status === 'skipped' && 'skip'}
                                      </div>
                                      <button onClick={() => solSweepRemoveSource(s.id)} disabled={solSweepRunning}
                                        style={{ background:'none', border:'none', color:'#f44336', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>

                        <button onClick={solSweepRun}
                          disabled={solSweepRunning || solSweepSources.length === 0 || !solIsValidAddr(solSweepDestAddr)}
                          style={{
                            padding:'13px', fontWeight:'bold', fontSize:'14px', cursor:solSweepRunning?'wait':'pointer',
                            background: solSweepRunning ? '#001a00' : (solSweepSources.length===0||!solIsValidAddr(solSweepDestAddr)) ? 'transparent' : '#00e676',
                            color: solSweepRunning ? '#00e676' : '#000',
                            border:`1px solid ${solSweepRunning?'#00e67644':'#00e676'}`,
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                            opacity: (solSweepSources.length===0||!solIsValidAddr(solSweepDestAddr)) ? 0.4 : 1,
                            transition:'all 0.2s',
                          }}>
                          {solSweepRunning
                            ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Sweeping {solSweepSources.filter(s=>s.status==='success').length}/{solSweepSources.length}...</>
                            : <><FaExchangeAlt/> Mulai Sweep {solSweepSources.length} Wallet{solIsToken ? ` (Token ${shortAddr(selectedSolToken!.mint)})` : ''}</>}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Riwayat Transaksi Solana ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'18px' }}>
                    <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'12px' }}>
                      Riwayat Transaksi Solana
                    </div>
                    {(() => {
                      const solHistory = agHistory.filter(h => h.description.includes(SOLANA_NETWORK.name)).slice(0, 15);
                      if (solHistory.length === 0) {
                        return <p style={{ color:'#333', fontSize:'12px', textAlign:'center', padding:'16px 0', margin:0 }}>Belum ada transaksi Solana.</p>;
                      }
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
                          {solHistory.map(h => (
                            <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid #141414' }}>
                              <div style={{ minWidth:0, flex:1 }}>
                                <div style={{ fontSize:'11px', color:'#ccc', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.description}</div>
                                <div style={{ fontSize:'10px', color:'#444' }}>{h.timestamp ? new Date(h.timestamp).toLocaleString('id-ID') : ''}</div>
                              </div>
                              {h.txHash && (
                                <a href={`${SOLANA_NETWORK.explorerUrl}/tx/${h.txHash}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer"
                                  style={{ color:'#9945FF', flexShrink:0, display:'flex', alignItems:'center', gap:'4px', fontSize:'10px', textDecoration:'none' }}>
                                  <FaLink size={9}/> Lihat
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ textAlign:'center' }}>
                    <button onClick={solDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {CHAIN_OPTIONS.find(o => o.id === txChain)?.soon && (
            <div style={{ textAlign:'center', padding:'40px', color:'#333', border:'1px dashed #222' }}>
              Network ini akan segera hadir.
            </div>
          )}
        </>
      )}

      {activeTab === 'garap' && (
        <>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Total Task',  value: atStats.total,  color:'#01a2ff' },
              { label:'Todo',        value: atStats.todo,   color:'#ffaa00' },
              { label:'Done',        value: atStats.done,   color:'#4caf50' },
              { label:'Failed',      value: atStats.failed, color:'#f44336' },
            ].map(s => (
              <div key={s.label} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${s.color}`, padding:'12px 18px', flex:1, minWidth:'110px' }}>
                <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{s.label}</div>
                <div style={{ fontSize:'24px', fontWeight:'bold', fontFamily:'monospace', color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
              <button onClick={() => { setAtShowForm(p => !p); setAtEditId(null); setAtForm(atEmptyForm); }}
                style={{ background:'#01a2ff', color:'#000', border:'none', padding:'9px 18px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'6px' }}>
                <FaPlus/> Tambah Task
              </button>
              <button
                onClick={() => {
                  if (batchSelectedIds.size > 0) {
                    setBatchModalOpen(true);
                  } else {
                    // Auto-select all todo tasks with contract
                    const todoIds = new Set(airdropTasks.filter(t => t.status === 'todo' && t.contractAddress).map(t => t.id));
                    if (todoIds.size > 0) { setBatchSelectedIds(todoIds); setBatchModalOpen(true); }
                    else { showAlert('Tidak ada task todo dengan contract address.', 'info'); }
                  }
                }}
                style={{
                  background: batchSelectedIds.size > 0 ? '#1a0d2a' : '#111',
                  border:`1px solid ${batchSelectedIds.size > 0 ? '#836EFD' : '#333'}`,
                  color: batchSelectedIds.size > 0 ? '#836EFD' : '#555',
                  padding:'9px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                  display:'flex', alignItems:'center', gap:'6px',
                }}>
                <FaLayerGroup size={12}/> Garap Batch {batchSelectedIds.size > 0 ? `(${batchSelectedIds.size})` : ''}
              </button>
              {batchSelectedIds.size > 0 && (
                <button onClick={() => setBatchSelectedIds(new Set())}
                  style={{ background:'none', border:'1px solid #333', color:'#555', padding:'6px 10px', cursor:'pointer', fontSize:'11px' }}>
                  Batal Pilih
                </button>
              )}
              <button onClick={exportGarapan} disabled={airdropTasks.length === 0}
                style={{ background:'none', border:'1px solid #4caf5044', color:'#4caf50', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px', opacity: airdropTasks.length === 0 ? 0.4 : 1 }}>
                <FaFileExport size={12}/> Export
              </button>
              <button onClick={() => garapImportRef.current?.click()}
                style={{ background:'none', border:'1px solid #ffaa0044', color:'#ffaa00', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px' }}>
                <FaFileImport size={12}/> Import
              </button>
              <input ref={garapImportRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleGarapImport} />
            </div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {(['all','todo','done','failed'] as const).map(f => (
                <button key={f} onClick={() => setAtFilter(f)} style={{
                  padding:'6px 14px', fontSize:'11px', cursor:'pointer', fontWeight:'bold',
                  background: atFilter === f ? (f==='all'?'#01a2ff':f==='todo'?'#ffaa00':f==='done'?'#4caf50':'#f44336') : '#111',
                  color: atFilter === f ? '#000' : '#555',
                  border:`1px solid ${atFilter===f?(f==='all'?'#01a2ff':f==='todo'?'#ffaa00':f==='done'?'#4caf50':'#f44336'):'#333'}`,
                }}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {atShowForm && (
            <div className="form-container" style={{ marginBottom:'20px' }}>
              <h3 style={{ marginTop:0, marginBottom:'14px', fontSize:'13px', textTransform:'uppercase', letterSpacing:'1px', color:'#01a2ff' }}>
                {atEditId ? <><FaEdit/> Edit Task</> : <><FaPlus/> Task Baru</>}
              </h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px', marginBottom:'10px' }}>
                <input placeholder="Nama Project *" value={atForm.projectName}
                  onChange={e => setAtForm(p => ({ ...p, projectName: e.target.value }))} required/>
                <input placeholder="Network (Monad, Base, ...)" value={atForm.network}
                  onChange={e => setAtForm(p => ({ ...p, network: e.target.value }))}/>
                <select value={atForm.taskType} onChange={e => setAtForm(p => ({ ...p, taskType: e.target.value as AirdropTask['taskType'] }))}>
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={atForm.priority} onChange={e => setAtForm(p => ({ ...p, priority: e.target.value as AirdropTask['priority'] }))}>
                  <option value="low">Priority: Low</option>
                  <option value="medium">Priority: Medium</option>
                  <option value="high">Priority: High</option>
                </select>
                <select value={atForm.status} onChange={e => setAtForm(p => ({ ...p, status: e.target.value as AirdropTask['status'] }))}>
                  <option value="todo">Status: Todo</option>
                  <option value="done">Status: Done</option>
                  <option value="failed">Status: Failed</option>
                </select>
                <input type="date" value={atForm.deadline} title="Deadline"
                  onChange={e => setAtForm(p => ({ ...p, deadline: e.target.value }))}/>
                <input placeholder="Wallet address (opsional)" value={atForm.walletAddress}
                  onChange={e => setAtForm(p => ({ ...p, walletAddress: e.target.value }))}
                  style={{ gridColumn:'span 2', fontFamily:'monospace', fontSize:'12px' }}/>
                <input placeholder="Deskripsi task" value={atForm.description}
                  onChange={e => setAtForm(p => ({ ...p, description: e.target.value }))}
                  style={{ gridColumn:'span 2' }}/>
                <input placeholder="TX Hash (isi setelah selesai)" value={atForm.txHash}
                  onChange={e => setAtForm(p => ({ ...p, txHash: e.target.value }))}
                  style={{ gridColumn:'span 2', fontFamily:'monospace', fontSize:'11px' }}/>
                <textarea placeholder="Catatan tambahan..." value={atForm.notes}
                  onChange={e => setAtForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} style={{ gridColumn:'1/-1', resize:'vertical', fontFamily:'inherit', fontSize:'12px' }}/>
              </div>

              <SmartContractConfig
                value={{
                  contractAddress: atForm.contractAddress || '',
                  contractAbi:     atForm.contractAbi     || '',
                  contractFunc:    atForm.contractFunc    || '',
                  contractArgs:    atForm.contractArgs    || '[]',
                  ethValue:        atForm.ethValue        || '0',
                }}
                onChange={(cfg) => setAtForm(p => ({ ...p, ...cfg }))}
                defaultOpen={!!atEditId}
              />

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <button onClick={saveAirdropTask} className="btn-manage btn-import" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                  <FaCheckCircle/> {atEditId ? 'Update' : 'Simpan Task'}
                </button>
                <button onClick={() => { setAtShowForm(false); setAtEditId(null); setAtForm(atEmptyForm); }} className="cancel-btn">Batal</button>
              </div>
            </div>
          )}

          <div className="search-filter-bar" style={{ marginBottom:'16px' }}>
            <div className="search-input-wrapper" style={{ flex:1 }}>
              <FaSearch className="search-icon"/>
              <input type="search" placeholder="Cari project / network / deskripsi..." value={atSearch}
                onChange={e => setAtSearch(e.target.value)}/>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filteredAtTasks.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px', color:'#333', border:'1px dashed #222' }}>
                {atSearch ? 'Tidak ditemukan.' : 'Belum ada task. Klik "Tambah Task" untuk mulai.'}
              </div>
            )}
            {filteredAtTasks.map(task => {
              const isDone         = task.status === 'done';
              const isFailed       = task.status === 'failed';
              const taskTypeInfo   = TASK_TYPES.find(t => t.value === task.taskType);
              const deadlineOverdue = task.deadline && task.status === 'todo'
                ? new Date(task.deadline) < new Date(new Date().toDateString())
                : false;
              const isExecOpen     = execTaskId === task.id;
              const explorerNet    = networks.find(n => n.id === execNetId);

              return (
                <div key={task.id} style={{
                  background:'#0d0d0d',
                  border:`1px solid ${isDone?'#1e3a1e':isFailed?'#3a1e1e':'#1e1e1e'}`,
                  borderLeft:`3px solid ${isDone?'#4caf50':isFailed?'#f44336':PRIORITY_COLORS[task.priority]}`,
                  overflow:'hidden',
                }}>
                  <div style={{ padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:'12px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:'200px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'6px' }}>
                        <span style={{ fontWeight:'bold', fontSize:'14px', textDecoration:isDone?'line-through':'none', color:isDone?'#555':'#fff' }}>
                          {task.projectName}
                        </span>
                        {taskTypeInfo && (
                          <span style={{ fontSize:'10px', color:taskTypeInfo.color, border:`1px solid ${taskTypeInfo.color}44`, padding:'2px 8px', fontWeight:'bold' }}>
                            {taskTypeInfo.label}
                          </span>
                        )}
                        <span style={{ fontSize:'10px', color:PRIORITY_COLORS[task.priority], border:`1px solid ${PRIORITY_COLORS[task.priority]}44`, padding:'2px 8px' }}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        {task.network && (
                          <span style={{ fontSize:'10px', color:'#888', border:'1px solid #333', padding:'2px 8px' }}>{task.network}</span>
                        )}
                        {task.contractAddress && (
                          <span style={{ fontSize:'10px', color:'#836EFD', border:'1px solid #836EFD44', padding:'2px 8px', display:'flex', alignItems:'center', gap:'3px' }}>
                            <FaCode size={9}/> Contract
                          </span>
                        )}
                        {deadlineOverdue && (
                          <span style={{ fontSize:'10px', color:'#ff3333', border:'1px solid #ff333344', padding:'2px 8px', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaExclamationTriangle size={9}/> OVERDUE
                          </span>
                        )}
                      </div>
                      {task.description && <div style={{ fontSize:'12px', color:'#666', marginBottom:'4px' }}>{task.description}</div>}
                      <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', fontSize:'11px', color:'#444', marginTop:'4px' }}>
                        {task.deadline && (
                          <span style={{ display:'flex', alignItems:'center', gap:'4px', color:deadlineOverdue?'#ff5555':'#555' }}>
                            <FaCalendarAlt size={10}/> {task.deadline}
                          </span>
                        )}
                        {task.walletAddress && (
                          <span style={{ fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'180px', whiteSpace:'nowrap' }}>
                            {shortAddr(task.walletAddress)}
                          </span>
                        )}
                        {task.doneAt && <span style={{ color:'#4caf50' }}>✓ {new Date(task.doneAt).toLocaleDateString('id-ID')}</span>}
                      </div>
                      {task.txHash && (
                        <div style={{ marginTop:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ fontSize:'10px', color:'#555' }}>TX:</span>
                          <code style={{ fontSize:'10px', color:'#888', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'220px' }}>
                            {task.txHash}
                          </code>
                          <button onClick={() => copyText(task.txHash, 'txh_'+task.id)}
                            style={{ background:'none', border:'none', color:copiedKey==='txh_'+task.id?'#4caf50':'#444', cursor:'pointer', padding:'2px', flexShrink:0 }}>
                            {copiedKey==='txh_'+task.id ? <FaCheckCircle size={10}/> : <FaCopy size={10}/>}
                          </button>
                        </div>
                      )}
                      {task.notes && <div style={{ fontSize:'11px', color:'#444', marginTop:'5px', fontStyle:'italic' }}>{task.notes}</div>}
                    </div>

                    <div style={{ display:'flex', gap:'6px', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end', alignItems:'flex-start' }}>
                      {/* Batch checkbox */}
                      {task.contractAddress && (
                        <button
                          title="Pilih untuk Batch"
                          onClick={() => setBatchSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                            return next;
                          })}
                          style={{
                            background: batchSelectedIds.has(task.id) ? '#1a0d2a' : '#0a0a0a',
                            border:`1px solid ${batchSelectedIds.has(task.id) ? '#836EFD' : '#2a2a2a'}`,
                            color: batchSelectedIds.has(task.id) ? '#836EFD' : '#333',
                            padding:'6px 8px', cursor:'pointer', fontSize:'11px',
                            display:'flex', alignItems:'center', gap:'4px',
                          }}>
                          <FaLayerGroup size={10}/> {batchSelectedIds.has(task.id) ? '✓' : '+'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (isExecOpen) { setExecTaskId(null); }
                          else { openExecPanel(task); }
                        }}
                        title="Execute Smart Contract"
                        style={{
                          background: isExecOpen ? '#1a0d2a' : (task.contractAddress ? '#0d0a1a' : '#0a0a0a'),
                          border:`1px solid ${isExecOpen ? '#836EFD' : task.contractAddress ? '#836EFD55' : '#333'}`,
                          color: isExecOpen ? '#836EFD' : task.contractAddress ? '#836EFD' : '#555',
                          padding:'6px 10px', cursor:'pointer', fontSize:'12px',
                          display:'flex', alignItems:'center', gap:'5px', fontWeight:'bold',
                        }}>
                        <FaBolt size={11}/> {isExecOpen ? 'Tutup' : 'Execute'}
                      </button>
                      <button onClick={() => markTaskDone(task.id)} title={isDone?'Tandai Ulang':'Tandai Selesai'}
                        style={{ background:isDone?'#1e3a1e':'#0a1a0a', border:`1px solid ${isDone?'#4caf50':'#333'}`, color:isDone?'#4caf50':'#555', padding:'6px 10px', cursor:'pointer', fontSize:'12px' }}>
                        <FaCheckCircle/>
                      </button>
                      <button onClick={() => editAirdropTask(task)} title="Edit"
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'6px 10px', cursor:'pointer', fontSize:'12px' }}>
                        <FaEdit/>
                      </button>
                      <button onClick={() => deleteAirdropTask(task.id)} title="Hapus"
                        style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'6px 10px', cursor:'pointer', fontSize:'12px' }}>
                        <FaTrash/>
                      </button>
                    </div>
                  </div>

                  {isExecOpen && (
                    <div style={{ borderTop:'1px solid #1a0d2a', background:'#080810', padding:'16px' }}>
                      <div style={{ fontSize:'11px', color:'#836EFD', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <FaBolt size={10}/> Execute — {task.projectName}
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                        <div>
                          <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                            <FaWallet style={{ marginRight:'4px' }}/>Wallet (dari BIP39)
                          </label>
                          <select value={execWalSel} onChange={e => handleExecWalSel(e.target.value)}
                            style={{ width:'100%', fontFamily:'monospace', fontSize:'11px' }}>
                            <option value="">-- Pilih wallet --</option>
                            {wallets.flatMap((w, wi) =>
                              w.addresses.map(a => (
                                <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                                  {w.name} · #{a.index} · {shortAddr(a.address)}
                                </option>
                              ))
                            )}
                          </select>
                          {!execWalSel && (
                            <input type="password" placeholder="Atau paste Private Key (0x...)"
                              value={execPrivKey}
                              onChange={e => { setExecPrivKey(e.target.value); setExecWalSel(''); }}
                              style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px', marginTop:'6px' }}/>
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                            <FaNetworkWired style={{ marginRight:'4px' }}/>Network
                          </label>
                          <select value={execNetId} onChange={e => setExecNetId(e.target.value)}
                            style={{ width:'100%', fontFamily:'monospace', fontSize:'11px' }}>
                            {networks.map(n => (
                              <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
                        {(['contract','raw'] as const).map(m => (
                          <button key={m} onClick={() => setExecMode(m)} style={{
                            padding:'5px 14px', fontSize:'11px', cursor:'pointer', fontWeight:'bold',
                            background: execMode===m ? '#1a0d2a' : '#111',
                            border:`1px solid ${execMode===m ? '#836EFD' : '#333'}`,
                            color: execMode===m ? '#836EFD' : '#555',
                          }}>
                            {m === 'contract' ? <><FaCode style={{ marginRight:'4px' }}/>Contract Call</> : <><FaPaperPlane style={{ marginRight:'4px' }}/>Raw ETH Send</>}
                          </button>
                        ))}
                      </div>

                      {execMode === 'contract' ? (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                          <input placeholder="Contract Address (0x...)" value={execContract.contractAddress}
                            onChange={e => setExecContract(p => ({ ...p, contractAddress: e.target.value }))}
                            style={{ fontFamily:'monospace', fontSize:'11px', gridColumn:'span 2' }}/>
                          <input placeholder="Function Name (mint, claim, stake, ...)" value={execContract.contractFunc}
                            onChange={e => setExecContract(p => ({ ...p, contractFunc: e.target.value }))}/>
                          <input placeholder='Args JSON — simple: ["0xabc","1000"] | tuple: [["40245","0x...","1000"],["108874","0"],"0x..."]' value={execContract.contractArgs}
                            onChange={e => setExecContract(p => ({ ...p, contractArgs: e.target.value }))}
                            style={{ fontFamily:'monospace', fontSize:'11px' }}/>
                          <input placeholder="ETH Value (e.g. 0.01 — atau 0 jika payable dengan value 0)" value={execContract.ethValue}
                            onChange={e => setExecContract(p => ({ ...p, ethValue: e.target.value }))}/>
                          <div style={{ fontSize:'10px', color:'#555', alignSelf:'center' }}>
                            💡 Kosongkan ABI = raw calldata
                          </div>
                          <textarea placeholder='ABI JSON (opsional) — contoh: [{"inputs":[{"name":"quantity","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}]'
                            value={execContract.contractAbi}
                            onChange={e => setExecContract(p => ({ ...p, contractAbi: e.target.value }))}
                            rows={3} style={{ gridColumn:'span 2', resize:'vertical', fontFamily:'monospace', fontSize:'10px' }}/>
                          <div style={{ gridColumn:'span 2', display:'flex', gap:'5px', flexWrap:'wrap' }}>
                            {AUTO_ACTION_TEMPLATES.filter(t => t.abi).map(t => (
                              <button key={t.id} onClick={() => {
                                setExecContract(p => ({ ...p, contractAbi: t.abi }));
                                if (t.id === 'erc20_approve') setExecContract(p => ({ ...p, contractFunc: 'approve' }));
                                if (t.id === 'erc20_transfer') setExecContract(p => ({ ...p, contractFunc: 'transfer' }));
                                if (t.id === 'nft_mint') setExecContract(p => ({ ...p, contractFunc: 'mint' }));
                              }}
                              style={{ fontSize:'10px', padding:'3px 8px', background:'#111', border:'1px solid #333', color:'#888', cursor:'pointer' }}>
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                          <input placeholder="To Address (0x...)" value={execRawTo}
                            onChange={e => setExecRawTo(e.target.value)}
                            style={{ fontFamily:'monospace', fontSize:'11px', gridColumn:'span 2' }}/>
                          <input placeholder="ETH Amount (e.g. 0.001)" value={execRawVal}
                            onChange={e => setExecRawVal(e.target.value)} type="number" step="any" min="0"/>
                          <input placeholder="Calldata (0x, opsional)" value={execRawData}
                            onChange={e => setExecRawData(e.target.value)}
                            style={{ fontFamily:'monospace', fontSize:'11px' }}/>
                        </div>
                      )}

                      <div style={{ marginBottom:'8px' }}>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'5px', display:'flex', alignItems:'center', gap:'5px' }}>
                          <FaGasPump size={9}/> Gas Limit
                          <span style={{ color:'#333', fontStyle:'italic', textTransform:'none', letterSpacing:0 }}>(kosong = auto-estimate)</span>
                        </div>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                          <input
                            type="number"
                            placeholder="auto"
                            value={execGasLimit}
                            onChange={e => { setExecGasLimit(e.target.value); setExecSimFailed(false); }}
                            min="21000"
                            style={{ flex:1, fontFamily:'monospace', fontSize:'12px',
                              borderColor: execSimFailed ? '#ffaa00' : undefined }}
                          />
                          {(['100000','200000','300000','500000'] as const).map(v => (
                            <button key={v} type="button"
                              onClick={() => { setExecGasLimit(v); setExecSimFailed(false); }}
                              style={{ fontSize:'10px', padding:'4px 7px', background:'#111', border:'1px solid #2a2a2a',
                                color: execGasLimit === v ? '#836EFD' : '#555', cursor:'pointer',
                                borderColor: execGasLimit === v ? '#836EFD' : '#2a2a2a' }}>
                              {parseInt(v)/1000}k
                            </button>
                          ))}
                          {execGasLimit && (
                            <button type="button" onClick={() => { setExecGasLimit(''); setExecSimFailed(false); }}
                              style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:'12px' }}>✕</button>
                          )}
                        </div>
                      </div>

                      {execSimFailed && (
                        <div style={{
                          background:'rgba(255,170,0,0.07)', border:'1px solid #ffaa0055',
                          borderLeft:'3px solid #ffaa00', padding:'10px 12px', marginBottom:'8px',
                          fontSize:'11px', color:'#ffcc44', lineHeight:'1.6',
                        }}>
                          <div style={{ fontWeight:'bold', marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
                            <FaExclamationTriangle size={11}/> Simulasi TX revert
                          </div>
                          <div>TX kemungkinan akan gagal. Set gas limit manual di atas dan klik <strong>Force Send</strong> untuk tetap mengirim (risiko gas hangus).</div>
                        </div>
                      )}

                      <button
                        onClick={() => runExec(task)}
                        disabled={execRunning || !execPrivKey}
                        style={{
                          width:'100%', padding:'11px', marginBottom:'10px',
                          background: execRunning ? '#1a0d2a' : execSimFailed ? '#3a2a00' : '#836EFD',
                          color: '#fff', border: execSimFailed ? '1px solid #ffaa00' : 'none',
                          cursor: execRunning || !execPrivKey ? 'not-allowed' : 'pointer',
                          fontSize:'13px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                          opacity: !execPrivKey ? 0.5 : 1,
                        }}>
                        {execRunning
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Executing...</>
                          : execSimFailed
                            ? <><FaExclamationTriangle size={12}/> Force Send (⚠️ Berisiko)</>
                            : <><FaBolt/> Eksekusi TX / Call</>}
                      </button>

                      {execReadResult !== null && (
                        <div style={{
                          background:'#001a0d', border:'1px solid #00e67644', borderLeft:'3px solid #00e676',
                          padding:'10px 14px', marginBottom:'10px', fontSize:'12px',
                        }}>
                          <div style={{ fontSize:'10px', color:'#00e676', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px', display:'flex', alignItems:'center', gap:'5px' }}>
                            <FaCheckCircle size={10}/> Hasil Read-Only (eth_call)
                          </div>
                          <code style={{ fontFamily:'monospace', color:'#aaffcc', wordBreak:'break-all', lineHeight:'1.7', display:'block' }}>
                            {execReadResult}
                          </code>
                        </div>
                      )}

                      {execLog.length > 0 && (
                        <div style={{ background:'#030308', border:'1px solid #0e0e1a', padding:'10px', fontFamily:'monospace', fontSize:'10px', color:'#888', maxHeight:'140px', overflowY:'auto', lineHeight:'1.7' }}>
                          {execLog.map((l, i) => (
                            <div key={i} style={{
                              color: l.includes('[done]')||l.includes('DIKONFIRMASI')||l.includes('[result]') ? '#4caf50'
                                   : l.includes('[X]') ? '#f44336'
                                   : l.includes('[read-only]') ? '#01a2ff'
                                   : l.includes('[execute]')||l.includes('[send]') ? '#836EFD'
                                   : l.includes('⏳') ? '#ffaa00'
                                   : '#666',
                            }}>{l}</div>
                          ))}
                        </div>
                      )}

                      {task.txHash && task.status === 'done' && explorerNet?.explorerUrl && (
                        <div style={{ marginTop:'8px', textAlign:'center' }}>
                          <a href={`${explorerNet.explorerUrl}/tx/${task.txHash}`} target="_blank" rel="noreferrer"
                            style={{ fontSize:'11px', color:'#836EFD', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'5px' }}>
                            <FaLink size={10}/> Lihat TX di {explorerNet.name} Explorer ↗
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {airdropTasks.length > 0 && (
            <div style={{ marginTop:'20px', textAlign:'center' }}>
              <button
                onClick={() => setConfirmData({ isOpen:true, title:'HAPUS SEMUA TASK?', message:'Semua airdrop task akan dihapus.',
                  action:()=>{ setAirdropTasks([]); showAlert('Semua task dihapus.','hapus'); } })}
                style={{ background:'none', border:'1px solid #333', color:'#555', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                Hapus Semua Task
              </button>
            </div>
          )}

          <div style={{ marginTop:'28px', background:'#0a0a0a', border:'1px solid #1e1e1e', borderTop:'2px solid #836EFD' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderBottom:'1px solid #141414' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <FaChartBar color="#836EFD" size={13}/>
                <span style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#836EFD', fontWeight:'bold' }}>
                  TX History
                </span>
                <span style={{ fontSize:'11px', color:'#333', border:'1px solid #222', padding:'2px 8px', fontFamily:'monospace' }}>
                  {agHistory.length} tx
                </span>
              </div>
              {agHistory.length > 0 && (
                <button
                  onClick={() => setConfirmData({ isOpen:true, title:'HAPUS HISTORY TX?', message:'Semua riwayat transaksi akan dihapus.',
                    action:()=>{ setAgHistory([]); showAlert('History TX dihapus.','hapus'); } })}
                  style={{ background:'none', border:'1px solid #2a2a2a', color:'#444', padding:'5px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                  <FaTrash size={10}/> Clear
                </button>
              )}
            </div>

            {agHistory.length === 0 ? (
              <div style={{ padding:'32px', textAlign:'center', color:'#2a2a2a', fontSize:'12px' }}>
                Belum ada transaksi. History akan muncul setelah TX berhasil.
              </div>
            ) : (
              <div style={{ maxHeight:'420px', overflowY:'auto' }}>
                {agHistory.slice(0, 100).map((h, idx) => {
                  const histNet = h.description.includes('·')
                    ? networks.find(n => h.description.toLowerCase().includes(n.id.toLowerCase()) || h.description.toLowerCase().includes(n.name.toLowerCase()))
                    : null;
                  const timeStr = h.timestamp
                    ? new Date(h.timestamp).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                    : '—';
                  const isBatch = h.description.startsWith('[BATCH]');
                  return (
                    <div key={h.id ?? idx} style={{
                      display:'flex', alignItems:'flex-start', gap:'12px',
                      padding:'12px 18px', borderBottom:'1px solid #111',
                      transition:'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0d0d0d')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {/* status dot */}
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: h.status === 'success' ? '#4caf50' : h.status === 'failed' ? '#f44336' : '#ffaa00', flexShrink:0, marginTop:'5px' }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', flexWrap:'wrap' }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:'12px', fontWeight:'bold', color:'#ddd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {isBatch && <span style={{ fontSize:'10px', color:'#836EFD', border:'1px solid #836EFD44', padding:'1px 5px', marginRight:'6px', fontWeight:'normal' }}>BATCH</span>}
                              {h.taskName}
                            </div>
                            <div style={{ fontSize:'11px', color:'#555', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {h.description}
                            </div>
                          </div>
                          <span style={{ fontSize:'10px', color:'#444', whiteSpace:'nowrap', flexShrink:0 }}>{timeStr}</span>
                        </div>
                        {h.txHash && (
                          <div style={{ marginTop:'6px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                            <code style={{ fontSize:'10px', color:'#555', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'220px' }}>
                              {h.txHash}
                            </code>
                            <button
                              onClick={() => copyText(h.txHash!, `hist_${h.id}`)}
                              style={{ background:'none', border:'none', color: copiedKey === `hist_${h.id}` ? '#4caf50' : '#333', cursor:'pointer', padding:'2px', flexShrink:0 }}
                              title="Salin TX Hash">
                              {copiedKey === `hist_${h.id}` ? <FaCheckCircle size={10}/> : <FaCopy size={10}/>}
                            </button>
                            {histNet?.explorerUrl && (
                              <a href={`${histNet.explorerUrl}/tx/${h.txHash}`} target="_blank" rel="noreferrer"
                                style={{ fontSize:'10px', color:'#836EFD', textDecoration:'none', display:'flex', alignItems:'center', gap:'3px', flexShrink:0 }}>
                                <FaLink size={9}/> Explorer ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {agHistory.length > 100 && (
                  <div style={{ padding:'12px', textAlign:'center', fontSize:'11px', color:'#333' }}>
                    Menampilkan 100 dari {agHistory.length} tx terakhir
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {activeTab === 'networks' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
            <div className="search-input-wrapper" style={{ flex:1 }}>
              <FaSearch className="search-icon"/>
              <input type="search" placeholder="Cari network / symbol..." value={netSearch} onChange={e => setNetSearch(e.target.value)}/>
            </div>
            <span style={{ fontSize:'12px', color:'#555', whiteSpace:'nowrap' }}>{filteredNetworks.length} network</span>
            <button onClick={() => { setShowNetForm(p => !p); setNetEditId(null); setNetForm({ name:'', chainId:0, symbol:'', rpcUrls:[], rpcRaw:'', explorerUrl:'', color:'#01a2ff' }); }}
              style={{ background:'#01a2ff', color:'#000', border:'none', padding:'8px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'6px' }}>
              <FaPlus/> Tambah Network
            </button>
          </div>

          {showNetForm && (
            <div className="form-container" style={{ marginBottom:'20px' }}>
              <h3 style={{ marginTop:0, marginBottom:'14px', fontSize:'13px', textTransform:'uppercase', letterSpacing:'1px', color:'#01a2ff' }}>
                {netEditId ? <><FaEdit/> Edit Network</> : <><FaPlus/> Network Baru</>}
              </h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <input placeholder="Nama Network" value={netForm.name} onChange={e => setNetForm(p => ({ ...p, name:e.target.value }))}/>
                <input type="number" placeholder="Chain ID" value={netForm.chainId||''} onChange={e => setNetForm(p => ({ ...p, chainId:parseInt(e.target.value)||0 }))}/>
                <input placeholder="Symbol (ETH, BNB, ...)" value={netForm.symbol} onChange={e => setNetForm(p => ({ ...p, symbol:e.target.value.toUpperCase() }))}/>
                <input placeholder="Block Explorer URL" value={netForm.explorerUrl} onChange={e => setNetForm(p => ({ ...p, explorerUrl:e.target.value }))}/>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>RPC URLs (satu per baris):</label>
                  <textarea placeholder="https://rpc.example.com" value={netForm.rpcRaw} onChange={e => setNetForm(p => ({ ...p, rpcRaw:e.target.value }))}
                    rows={3} style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', resize:'vertical' }}/>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <label style={{ fontSize:'12px', color:'#888' }}>Warna:</label>
                  <input type="color" value={netForm.color} onChange={e => setNetForm(p => ({ ...p, color:e.target.value }))}
                    style={{ width:'40px', height:'32px', padding:'2px', border:'1px solid #333', background:'#111', cursor:'pointer' }}/>
                  <span style={{ fontSize:'12px', color:netForm.color, fontFamily:'monospace' }}>{netForm.color}</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <button onClick={saveNetwork} className="btn-manage btn-import" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                  <FaCheckCircle/> {netEditId ? 'Update' : 'Tambah'}
                </button>
                <button onClick={() => { setShowNetForm(false); setNetEditId(null); }} className="cancel-btn">Batal</button>
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'12px' }}>
            {filteredNetworks.map(n => (
              <div key={n.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${n.color}`, padding:'16px', display:'flex', flexDirection:'column', gap:'10px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                  <div>
                    <div style={{ fontWeight:'bold', fontSize:'13px', color:n.color }}>{n.name}</div>
                    <div style={{ fontSize:'11px', color:'#444', marginTop:'2px' }}>Chain ID: {n.chainId} · {n.symbol}</div>
                  </div>
                  <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
                    <button onClick={() => { setNetForm({ ...n, rpcRaw:n.rpcUrls.join('\n') }); setNetEditId(n.id); setShowNetForm(true); }} title="Edit"
                      style={{ background:'none', border:'1px solid #333', color:'#888', padding:'4px 7px', cursor:'pointer', fontSize:'11px' }}><FaEdit/></button>
                    <button onClick={() => setConfirmData({ isOpen:true, title:'HAPUS NETWORK?', message:'Network ini akan dihapus.',
                        action:()=>{ setNetworks(prev => prev.filter(x => x.id !== n.id)); showAlert('Network dihapus.','hapus'); } })} title="Hapus"
                      style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'4px 7px', cursor:'pointer', fontSize:'11px' }}><FaTrash/></button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>
                    <FaLink style={{ marginRight:'4px' }}/>RPC Endpoints
                  </div>
                  {n.rpcUrls.map((url, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                      <code style={{ flex:1, fontSize:'10px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'4px 8px', border:'1px solid #141414' }}>
                        {url}
                      </code>
                      <button onClick={() => copyText(url, `rpc_${n.id}_${i}`)} title="Salin RPC"
                        style={{ background:'none', border:'none', color:copiedKey===`rpc_${n.id}_${i}`?'#4caf50':'#333', cursor:'pointer', padding:'3px', flexShrink:0 }}>
                        {copiedKey===`rpc_${n.id}_${i}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
                  {n.explorerUrl && (
                    <a href={n.explorerUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize:'11px', color:n.color, border:`1px solid ${n.color}30`, padding:'5px 10px', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                      <FaLink size={10}/> Explorer
                    </a>
                  )}
                  <button onClick={() => addToMetaMask(n)}
                    style={{ fontSize:'11px', color:'#f6851b', border:'1px solid #f6851b30', padding:'5px 10px', cursor:'pointer', background:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaPlug size={10}/> + MetaMask
                  </button>
                  <button onClick={() => { copyText(n.rpcUrls[0]||'', 'chain_'+n.id); showAlert('RPC URL disalin!','success'); }}
                    style={{ fontSize:'11px', color:'#888', border:'1px solid #1e1e1e', padding:'5px 10px', cursor:'pointer', background:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaCopy size={10}/> Salin RPC
                  </button>
                  <button onClick={() => { setTxNetworkId(n.id); setActiveTab('transfer'); }}
                    style={{ fontSize:'11px', color:'#4caf50', border:'1px solid #4caf5030', padding:'5px 10px', cursor:'pointer', background:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaExchangeAlt size={10}/> Send/Receive
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:'20px', textAlign:'center' }}>
            <button
              onClick={() => setConfirmData({ isOpen:true, title:'RESET NETWORKS?', message:'Semua network akan direset ke default.',
                action:()=>{ setNetworks(DEFAULT_NETWORKS); showAlert('Networks direset ke default.','success'); } })}
              style={{ background:'none', border:'1px solid #333', color:'#555', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
              Reset ke Default Networks
            </button>
          </div>
        </>
      )}

      {activeTab === 'bytecode' && (
        <BytecodeExplorer />
      )}

      {activeTab === 'txdecoder' && (
        <TxDecoder
        networks={networks}
        defaultRpc="https://eth.llamarpc.com"
        />
      )}

      {activeTab === 'token' && (
        <>
          {/* ── Pilih Chain: EVM (ERC-20) / Solana (SPL Token) ── */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'8px' }}>
              <FaCoins style={{ marginRight:'5px' }}/>Buat Token Baru
            </label>
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => setTcChain('evm')} style={{
                background: tcChain === 'evm' ? '#01a2ff' : 'none',
                color: tcChain === 'evm' ? '#000' : '#888',
                border: `1px solid ${tcChain === 'evm' ? '#01a2ff' : '#333'}`,
                padding:'8px 16px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
              }}>ERC-20 (EVM)</button>
              <button onClick={() => setTcChain('sol')} style={{
                background: tcChain === 'sol' ? '#9945FF' : 'none',
                color: tcChain === 'sol' ? '#000' : '#888',
                border: `1px solid ${tcChain === 'sol' ? '#9945FF' : '#333'}`,
                padding:'8px 16px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
              }}>SPL Token (Solana)</button>
            </div>
          </div>

          {/* ══════════ ERC-20 ══════════ */}
          {tcChain === 'evm' && (
            <>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'6px' }}>
                  <FaGlobe style={{ marginRight:'4px' }}/>Network Deploy
                </label>
                <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                  <select value={tcNetworkId} onChange={e => setTcNetworkId(e.target.value)}
                    style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px' }}>
                    {networks.map(n => (
                      <option key={n.id} value={n.id}>{n.name} · {n.symbol} · Chain {n.chainId}</option>
                    ))}
                  </select>
                  {tcSelectedNetwork && (
                    <span style={{ fontSize:'11px', color:'#555', fontFamily:'monospace', whiteSpace:'nowrap' }}>Chain {tcSelectedNetwork.chainId}</span>
                  )}
                </div>
                <p style={{ fontSize:'11px', color:'#444', marginTop:'6px' }}>
                  <FaInfoCircle style={{ marginRight:'4px' }}/>
                  Disarankan coba di testnet dulu (Sepolia / Holesky / BNB Testnet) sebelum deploy ke mainnet.
                </p>
              </div>

              <div style={{ marginBottom:'16px', display:'flex', gap:'8px' }}>
                <button onClick={() => setTcEvmMode('template')}
                  style={{ flex:1, padding:'10px', fontSize:'12px', cursor:'pointer',
                    background: tcEvmMode === 'template' ? '#01a2ff' : 'none',
                    color: tcEvmMode === 'template' ? '#000' : '#888',
                    border: `1px solid ${tcEvmMode === 'template' ? '#01a2ff' : '#333'}` }}>
                  <FaFileCode style={{ marginRight:'6px' }}/>Template Bawaan
                </button>
                <button onClick={() => setTcEvmMode('custom')}
                  style={{ flex:1, padding:'10px', fontSize:'12px', cursor:'pointer',
                    background: tcEvmMode === 'custom' ? '#01a2ff' : 'none',
                    color: tcEvmMode === 'custom' ? '#000' : '#888',
                    border: `1px solid ${tcEvmMode === 'custom' ? '#01a2ff' : '#333'}` }}>
                  <FaCode style={{ marginRight:'6px' }}/>Kode Solidity Kustom
                </button>
              </div>

              <div className="form-container" style={{ maxWidth:'520px', margin:'0 auto 24px' }}>
                <h2 style={{ textAlign:'center', marginBottom:'16px', fontSize:'15px' }}>
                  <FaRocket style={{ marginRight:'8px' }}/>{tcEvmMode === 'custom' ? 'Deploy Kontrak Kustom' : 'Deploy Token ERC-20'}
                </h2>

                {wallets.length > 0 && (
                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Deployer (dari BIP39 tersimpan)</label>
                    <select value={tcWalletSel} onChange={e => handleTcWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                      <option value="">-- Pilih address --</option>
                      {wallets.flatMap((w, wi) =>
                        w.addresses.map(a => (
                          <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                            {w.name} · #{a.index} · {a.address.slice(0,14)}...
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
                <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                  <FaKey style={{ marginRight:'4px' }}/>Private Key Deployer
                </label>
                <input type="password" placeholder="0x..." value={tcPrivKey} onChange={e => setTcPrivKey(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', marginBottom:'14px' }}/>

                {tcEvmMode === 'template' && (
                <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Nama Token</label>
                    <input placeholder="misal: My Awesome Token" value={tcName} onChange={e => setTcName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Symbol</label>
                    <input placeholder="misal: MAT" value={tcSymbol} onChange={e => setTcSymbol(e.target.value.toUpperCase())} style={{ textTransform:'uppercase' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Decimals</label>
                    <input type="number" min={0} max={18} placeholder="18" value={tcDecimals} onChange={e => setTcDecimals(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Total Supply</label>
                    <input type="number" min={1} placeholder="1000000" value={tcSupply} onChange={e => setTcSupply(e.target.value)} />
                  </div>
                </div>

                <p style={{ fontSize:'11px', color:'#444', margin:'4px 0 14px' }}>
                  Seluruh total supply akan di-mint ke address deployer saat kontrak dideploy. Kontrak
                  mendukung <code>mint</code> tambahan (owner-only), <code>burn</code>, dan transfer ownership.
                </p>
                </>
                )}

                {tcEvmMode === 'custom' && (
                <>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaFileCode style={{ marginRight:'4px' }}/>Kode Solidity (.sol) — 1 file, tanpa import eksternal
                  </label>
                  <textarea
                    value={tcCustomSolidity}
                    onChange={e => { setTcCustomSolidity(e.target.value); setTcCompiled(null); setTcCompileError(''); setTcSecResult(null); setTcSecError(''); setTcRiskAck(false); }}
                    placeholder={'// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n\ncontract MyToken {\n  string public name = "My Token";\n  string public symbol = "MTK";\n  ...\n}'}
                    rows={12}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px', background:'#0a0a0a', color:'#ccc', border:'1px solid #262626', padding:'10px', resize:'vertical', marginBottom:'8px' }}
                  />
                  <p style={{ fontSize:'10px', color:'#555', margin:'0 0 12px' }}>
                    Kode harus 1 file mandiri (semua kode ditulis langsung di sini, tidak ada <code>import</code> ke file lain).
                    Kompilasi berjalan di browser via <code>solc</code> — kontrak kompleks bisa makan waktu beberapa detik.
                  </p>

                  <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
                    <button onClick={compileTcCustomContract} disabled={tcCompiling || !tcCustomSolidity.trim()}
                      className="btn-manage" style={{ flex:'1 1 160px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: tcCompiling ? 0.6 : 1 }}>
                      {tcCompiling ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Compiling...</> : <><FaTerminal/> Compile</>}
                    </button>
                    <button onClick={runTcSecurityScan} disabled={tcSecScanning || !tcCustomSolidity.trim()}
                      className="btn-manage" style={{ flex:'1 1 160px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: tcSecScanning ? 0.6 : 1 }}>
                      {tcSecScanning ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Menganalisis...</> : <><FaShieldAlt/> Scan Keamanan</>}
                    </button>
                  </div>

                  {tcCompileError && (
                    <div style={{ marginBottom:'12px', padding:'10px 12px', fontSize:'11px', color:'#ff6666', border:'1px solid #f4433644', borderLeft:'3px solid #f44336', whiteSpace:'pre-wrap', fontFamily:'monospace' }}>
                      {tcCompileError}
                    </div>
                  )}
                  {tcCompiled && (
                    <div style={{ marginBottom:'12px', padding:'10px 12px', fontSize:'11px', color:'#4caf50', border:'1px solid #4caf5044', borderLeft:'3px solid #4caf50' }}>
                      <FaCheckCircle style={{ marginRight:'6px' }}/>Compile OK — contract <code>{tcCompiled.contractName}</code>
                      {' · '}{tcCompiled.abi.filter((f:any)=>f.type==='function').length} function
                      {tcCompiled.warnings.length > 0 && <div style={{ color:'#F1C40F', marginTop:'4px' }}>{tcCompiled.warnings.length} warning compiler (non-fatal)</div>}
                    </div>
                  )}

                  {tcSecError && (
                    <div style={{ marginBottom:'12px', padding:'10px 12px', fontSize:'11px', color:'#ff6666', border:'1px solid #f4433644', borderLeft:'3px solid #f44336' }}>
                      {tcSecError}
                    </div>
                  )}
                  {tcSecResult && (
                    <div style={{ marginBottom:'12px', padding:'12px', border:`1px solid ${AISEC_VERDICT_META[tcSecResult.verdict].color}44`, borderLeft:`3px solid ${AISEC_VERDICT_META[tcSecResult.verdict].color}` }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', flexWrap:'wrap', gap:'6px' }}>
                        <span style={{ fontSize:'12px', fontWeight:'bold', color:AISEC_VERDICT_META[tcSecResult.verdict].color, display:'flex', alignItems:'center', gap:'6px' }}>
                          <FaShieldAlt/> {AISEC_VERDICT_META[tcSecResult.verdict].label}
                        </span>
                        <span style={{ fontSize:'11px', color:'#888' }}>Skor: {tcSecResult.score}/100</span>
                      </div>
                      <p style={{ fontSize:'11px', color:'#aaa', margin:'0 0 8px' }}>{tcSecResult.summary}</p>
                      {tcSecResult.findings.length > 0 && (
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'8px' }}>
                          {tcSecResult.findings.map((f, i) => {
                            const sevColor: Record<string,string> = { critical:'#f44336', high:'#ff9800', medium:'#F1C40F', low:'#8bc34a', info:'#555' };
                            return (
                              <div key={i} style={{ fontSize:'10px', padding:'6px 8px', background:'#0a0a0a', border:'1px solid #1a1a1a' }}>
                                <span style={{ color:sevColor[f.severity]||'#888', fontWeight:'bold', textTransform:'uppercase' }}>[{f.severity}]</span>{' '}
                                <span style={{ color:'#ccc' }}>{f.title}</span>
                                {f.location && <span style={{ color:'#555' }}> — {f.location}</span>}
                                <div style={{ color:'#777', marginTop:'3px' }}>{f.description}</div>
                                {f.recommendation && <div style={{ color:'#4caf50', marginTop:'3px' }}>↳ {f.recommendation}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {(tcSecResult.verdict === 'HIGH_RISK' || tcSecResult.verdict === 'CRITICAL') && (
                        <label style={{ display:'flex', alignItems:'flex-start', gap:'8px', fontSize:'11px', color:'#ff9800', cursor:'pointer', marginTop:'8px', padding:'8px', background:'#1a1206', border:'1px solid #4a3f10' }}>
                          <input type="checkbox" checked={tcRiskAck} onChange={e => setTcRiskAck(e.target.checked)} style={{ marginTop:'2px' }}/>
                          Saya sudah membaca temuan di atas dan tetap ingin melanjutkan deploy dengan risiko ini sepenuhnya di tanggung jawab saya.
                        </label>
                      )}
                    </div>
                  )}

                  {tcCompiled && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                        Constructor Arguments (JSON array{tcCompiled.abi.find((f:any)=>f.type==='constructor')?.inputs?.length ? `, ${tcCompiled.abi.find((f:any)=>f.type==='constructor').inputs.map((i:any)=>i.name||i.type).join(', ')}` : ' — constructor tanpa argumen'})
                      </label>
                      <input placeholder='["MyToken","MTK",18,"1000000000000000000000000"]' value={tcCustomCtorArgs} onChange={e => setTcCustomCtorArgs(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px' }}/>
                    </div>
                  )}

                  <p style={{ fontSize:'11px', color:'#444', margin:'4px 0 14px' }}>
                    <FaInfoCircle style={{ marginRight:'4px' }}/>
                    Wajib compile dan scan keamanan dulu sebelum tombol deploy aktif. Hasil scan dari AI bersifat
                    bantuan (bukan audit formal) — tetap review kode sendiri sebelum deploy ke mainnet, apalagi
                    kalau kontrak akan memegang dana orang lain.
                  </p>
                </>
                )}

                {tcDeployStatus.type !== 'idle' && (
                  <div style={{
                    marginBottom:'14px', padding:'10px 12px', fontSize:'12px',
                    border: `1px solid ${{pending:'#ffaa0044',success:'#4caf5044',error:'#f4433644',idle:'#33333344'}[tcDeployStatus.type]}`,
                    borderLeft: `3px solid ${{pending:'#ffaa00',success:'#4caf50',error:'#f44336',idle:'#555'}[tcDeployStatus.type]}`,
                    color: {pending:'#ffcc44',success:'#4caf50',error:'#ff6666',idle:'#888'}[tcDeployStatus.type],
                    wordBreak:'break-all',
                  }}>
                    {tcDeployStatus.type === 'pending' && <FaSpinner style={{ marginRight:'6px', animation:'spin 1s linear infinite' }}/>}
                    {tcDeployStatus.msg}
                  </div>
                )}

                <button onClick={deployErc20Token}
                  disabled={tcDeploying || (tcEvmMode === 'custom' && (!tcCompiled || !tcSecResult || (['HIGH_RISK','CRITICAL'].includes(tcSecResult?.verdict||'') && !tcRiskAck)))}
                  className="btn-manage btn-import"
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: tcDeploying ? 0.6 : 1 }}>
                  {tcDeploying ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Deploying...</> : <><FaRocket/> {tcEvmMode === 'custom' ? 'Deploy Kontrak' : 'Deploy Token'}</>}
                </button>
              </div>

              {erc20Tokens.length > 0 && (
                <div style={{ marginBottom:'20px' }}>
                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#01a2ff', marginBottom:'10px' }}>
                    <FaList style={{ marginRight:'6px' }}/>Token yang Sudah Dideploy ({erc20Tokens.length})
                  </h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'12px' }}>
                    {erc20Tokens.map(t => {
                      const net = networks.find(n => n.id === t.networkId);
                      return (
                        <div key={t.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid #01a2ff`, padding:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <div>
                              <div style={{ fontWeight:'bold', fontSize:'13px' }}>{t.name} <span style={{ color:'#555' }}>({t.symbol})</span></div>
                              <div style={{ fontSize:'10px', color:'#444', marginTop:'2px' }}>{t.networkName} · {t.decimals} dec · supply {Number(t.initialSupply).toLocaleString()}</div>
                            </div>
                            <button onClick={() => deleteErc20Token(t.id)} title="Hapus catatan"
                              style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'4px 7px', cursor:'pointer', fontSize:'11px' }}><FaTrash/></button>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <code style={{ flex:1, fontSize:'10px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'5px 8px', border:'1px solid #141414' }}>
                              {t.address}
                            </code>
                            <button onClick={() => copyText(t.address, `erc20_${t.id}`)} title="Salin address"
                              style={{ background:'none', border:'none', color:copiedKey===`erc20_${t.id}`?'#4caf50':'#333', cursor:'pointer', padding:'3px', flexShrink:0 }}>
                              {copiedKey===`erc20_${t.id}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                            </button>
                          </div>
                          {net?.explorerUrl && (
                            <a href={`${net.explorerUrl}/address/${t.address}`} target="_blank" rel="noreferrer"
                              style={{ fontSize:'11px', color:'#01a2ff', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                              <FaLink size={10}/> Lihat di Explorer
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════════ SPL TOKEN ══════════ */}
          {tcChain === 'sol' && (
            <>
              <div className="form-container" style={{ maxWidth:'520px', margin:'16px auto 24px' }}>
                <h2 style={{ textAlign:'center', marginBottom:'16px', fontSize:'15px' }}>
                  <FaRocket style={{ marginRight:'8px' }}/>Buat SPL Token
                </h2>

                <div style={{ marginBottom:'14px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                  <select value={tcSolNetId} onChange={e => setTcSolNetId(e.target.value)}
                    style={{ flex:'1 1 200px', fontFamily:'monospace', fontSize:'12px', padding:'8px 10px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                    {SOLANA_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                  </select>
                  {tcSolNetId !== 'mainnet' && (
                    <span style={{ fontSize:'10px', color:'#F1C40F', border:'1px solid #4a3f10', background:'#1a1608', padding:'4px 8px', whiteSpace:'nowrap' }}>
                      ⚠ Jaringan TEST — token dibuat di {SOLANA_NETWORKS.find(n => n.id === tcSolNetId)?.name}, tidak muncul di mainnet
                    </span>
                  )}
                </div>

                {wallets.length > 0 && (
                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Solana (dari BIP39 tersimpan)</label>
                    <select value={tcSolWalletSel} onChange={e => handleTcSolWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                      <option value="">-- Pilih address --</option>
                      {wallets.flatMap((w, wi) =>
                        (w.solAddresses || []).map(a => (
                          <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                            {w.name} · #{a.index} · {a.address.slice(0,14)}...
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
                <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                  <FaKey style={{ marginRight:'4px' }}/>Private Key (base58)
                </label>
                <input type="password" placeholder="Private key Solana (base58)" value={tcSolPrivKey} onChange={e => setTcSolPrivKey(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', marginBottom:'14px' }}/>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Nama Token</label>
                    <input placeholder="misal: My Solana Token" value={tcSolName} onChange={e => setTcSolName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Symbol</label>
                    <input placeholder="misal: MST" value={tcSolSymbol} onChange={e => setTcSolSymbol(e.target.value.toUpperCase())} style={{ textTransform:'uppercase' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Decimals (0–9)</label>
                    <input type="number" min={0} max={9} placeholder="9" value={tcSolDecimals} onChange={e => setTcSolDecimals(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Total Supply</label>
                    <input type="number" min={1} placeholder="1000000" value={tcSolSupply} onChange={e => setTcSolSupply(e.target.value)} />
                  </div>
                </div>

                <div style={{ margin:'14px 0', padding:'12px', background:'#0d0d0d', border:'1px solid #1e1e1e' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#ccc', cursor:'pointer', marginBottom: tcSolAddMeta ? '12px' : 0 }}>
                    <input type="checkbox" checked={tcSolAddMeta} onChange={e => setTcSolAddMeta(e.target.checked)} />
                    <FaHashtag size={11}/> Sertakan Metadata On-chain (Metaplex)
                  </label>

                  {tcSolAddMeta && (
                    <>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                        URI Metadata JSON <span style={{ color:'#666' }}>(wajib, maks {SPL_META_MAX.uri} karakter)</span>
                      </label>
                      <input placeholder="https://... atau ipfs://... (link ke file metadata.json)" value={tcSolUri}
                        onChange={e => setTcSolUri(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', marginBottom:'4px' }}/>
                      <p style={{ fontSize:'10px', color:'#555', margin:'0 0 12px' }}>
                        URI harus mengarah ke file JSON standar Metaplex (berisi <code>name</code>, <code>symbol</code>,{' '}
                        <code>image</code>, <code>description</code>). Host di Arweave/Irys, IPFS (nft.storage/Pinata), atau
                        GitHub raw. Field gambar &amp; deskripsi di bawah ini hanya untuk pratinjau lokal — tidak otomatis
                        diunggah, jadi pastikan isinya sama dengan file JSON yang kamu host.
                      </p>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Image URL (opsional, pratinjau)</label>
                          <input placeholder="https://.../logo.png" value={tcSolImageUrl} onChange={e => setTcSolImageUrl(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box' }}/>
                        </div>
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Deskripsi (opsional, pratinjau)</label>
                          <input placeholder="Deskripsi singkat token" value={tcSolDescription} onChange={e => setTcSolDescription(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box' }}/>
                        </div>
                      </div>

                      {tcSolImageUrl.trim() && (
                        <div style={{ marginTop:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
                          <img src={tcSolImageUrl.trim()} alt="preview logo token"
                            style={{ width:'36px', height:'36px', borderRadius:'50%', objectFit:'cover', border:'1px solid #262626' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                          <span style={{ fontSize:'10px', color:'#555' }}>Pratinjau logo (dari Image URL di atas)</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <p style={{ fontSize:'11px', color:'#444', margin:'4px 0 14px' }}>
                  <FaInfoCircle style={{ marginRight:'4px' }}/>
                  Membuat mint account SPL Token baru + associated token account, lalu mint seluruh total
                  supply ke wallet ini.{' '}
                  {tcSolAddMeta
                    ? 'Metadata (nama, symbol, URI) akan ditulis on-chain lewat Metaplex Token Metadata Program, jadi wallet/explorer lain (Phantom, Solscan, dll) bisa menampilkan nama & logo token dengan benar.'
                    : 'Metadata on-chain dimatikan — nama/symbol hanya tersimpan lokal di daftar bawah, wallet lain mungkin menampilkan token ini sebagai "Unknown Token".'}
                </p>

                {tcSolStatus.type !== 'idle' && (
                  <div style={{
                    marginBottom:'14px', padding:'10px 12px', fontSize:'12px',
                    border: `1px solid ${{pending:'#ffaa0044',success:'#4caf5044',error:'#f4433644',idle:'#33333344'}[tcSolStatus.type]}`,
                    borderLeft: `3px solid ${{pending:'#ffaa00',success:'#4caf50',error:'#f44336',idle:'#555'}[tcSolStatus.type]}`,
                    color: {pending:'#ffcc44',success:'#4caf50',error:'#ff6666',idle:'#888'}[tcSolStatus.type],
                    wordBreak:'break-all',
                  }}>
                    {tcSolStatus.type === 'pending' && <FaSpinner style={{ marginRight:'6px', animation:'spin 1s linear infinite' }}/>}
                    {tcSolStatus.msg}
                  </div>
                )}

                <button onClick={createSplToken} disabled={tcSolCreating} className="btn-manage btn-import"
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: tcSolCreating ? 0.6 : 1 }}>
                  {tcSolCreating ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Membuat Token...</> : <><FaHashtag/> Buat SPL Token</>}
                </button>
              </div>

              {splTokens.length > 0 && (
                <div style={{ marginBottom:'20px' }}>
                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#9945FF', marginBottom:'10px' }}>
                    <FaList style={{ marginRight:'6px' }}/>SPL Token yang Sudah Dibuat ({splTokens.length})
                  </h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'12px' }}>
                    {splTokens.map(t => {
                      const tNet = SOLANA_NETWORKS.find(n => n.id === t.networkId) ?? SOLANA_NETWORKS[0];
                      return (
                      <div key={t.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid #9945FF`, padding:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            {t.imageUrl && (
                              <img src={t.imageUrl} alt={t.symbol}
                                style={{ width:'28px', height:'28px', borderRadius:'50%', objectFit:'cover', border:'1px solid #262626', flexShrink:0 }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                            )}
                            <div>
                              <div style={{ fontWeight:'bold', fontSize:'13px' }}>{t.name} <span style={{ color:'#555' }}>({t.symbol})</span></div>
                              <div style={{ fontSize:'10px', color:'#444', marginTop:'2px' }}>
                                {t.networkName || 'Solana Mainnet'}
                                {tNet.id !== 'mainnet' && <span style={{ color:'#F1C40F' }}> (TEST)</span>}
                                {' · '}{t.decimals} dec · supply {Number(t.initialSupply).toLocaleString()}
                              </div>
                              {t.description && (
                                <div style={{ fontSize:'10px', color:'#555', marginTop:'3px' }}>{t.description}</div>
                              )}
                            </div>
                          </div>
                          <button onClick={() => deleteSplToken(t.id)} title="Hapus catatan"
                            style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'4px 7px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}><FaTrash/></button>
                        </div>

                        {t.hasMetadata ? (
                          <span style={{ alignSelf:'flex-start', fontSize:'9px', color:'#4caf50', border:'1px solid #1c3a1c', background:'#0e1a0e', padding:'2px 7px', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaCheckCircle size={9}/> Metadata on-chain (Metaplex)
                          </span>
                        ) : (
                          <span style={{ alignSelf:'flex-start', fontSize:'9px', color:'#888', border:'1px solid #2a2a2a', background:'#111', padding:'2px 7px' }}>
                            Tanpa metadata on-chain
                          </span>
                        )}

                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <code style={{ flex:1, fontSize:'10px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'5px 8px', border:'1px solid #141414' }}>
                            {t.mint}
                          </code>
                          <button onClick={() => copyText(t.mint, `spl_${t.id}`)} title="Salin mint address"
                            style={{ background:'none', border:'none', color:copiedKey===`spl_${t.id}`?'#4caf50':'#333', cursor:'pointer', padding:'3px', flexShrink:0 }}>
                            {copiedKey===`spl_${t.id}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                          </button>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                          <a href={`${tNet.explorerUrl}/token/${t.mint}${tNet.clusterParam}`} target="_blank" rel="noreferrer"
                            style={{ fontSize:'11px', color:'#9945FF', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaLink size={10}/> Lihat di Solscan
                          </a>
                          {t.metadataUri && (
                            <a href={t.metadataUri} target="_blank" rel="noreferrer"
                              style={{ fontSize:'11px', color:'#555', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                              <FaLink size={10}/> Lihat JSON Metadata
                            </a>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <footer className="app-footer" style={{ marginTop: '40px' }}>
        <span>Powered by IAC Community</span>
        <span style={{ margin: '0 10px', color: '#333' }}>·</span>
        <span style={{ fontSize: '11px', color: '#333', cursor: 'pointer' }}
          onClick={() => { localStorage.removeItem('tosAgreed'); setTosAgreed(false); setTosChecked([false,false,false,false]); }}
          title="Lihat persetujuan ToS">
          Lihat ToS
        </span>
      </footer>
    </div>
  );
};
