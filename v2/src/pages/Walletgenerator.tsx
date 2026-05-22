import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { CustomAlert, CustomConfirm } from '../components/CustomModals';
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
} from 'react-icons/fa';

interface BIP39Wallet {
  id: string;
  name: string;
  mnemonic: string;
  addresses: { index: number; address: string; privateKey: string }[];
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
  // Smart contract call fields (optional - filled when "Auto Execute" is configured)
  contractAddress?: string;
  contractAbi?: string;
  contractFunc?: string;
  contractArgs?: string;   // JSON array string e.g. '["0xabc", "1000"]'
  ethValue?: string;       // ETH value to send with call, default "0"
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
  { id:'transfer_eth',   label:'💸 Transfer ETH',       abi:'', category:'transfer' },
  { id:'erc20_approve',  label:'✅ ERC-20 Approve',      abi:'[{"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]', category:'token' },
  { id:'erc20_transfer', label:'➡️ ERC-20 Transfer',     abi:'[{"inputs":[{"name":"recipient","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]', category:'token' },
  { id:'nft_mint',       label:'🖼️ NFT Mint',            abi:'[{"inputs":[{"name":"quantity","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}]', category:'nft' },
  { id:'custom',         label:'⚙️ Custom Calldata',     abi:'', category:'custom' },
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

export interface ContractConfig {
  contractAddress: string;
  contractAbi:     string;
  contractFunc:    string;
  contractArgs:    string;  // JSON array string, e.g. '["0xabc","1000"]'
  ethValue:        string;  // ETH as string, e.g. "0.01"
}

interface AbiInput {
  name:         string;
  type:         string;
  internalType?: string;
}

interface AbiFunction {
  name:              string;
  type:              string;
  stateMutability?:  string;
  inputs:            AbiInput[];
  outputs?:          { name: string; type: string }[];
}

export interface SmartContractConfigProps {
  value:         ContractConfig;
  onChange:      (v: ContractConfig) => void;
  provider?:     any;
  fromAddress?:  string;
  defaultOpen?:  boolean;
}

interface AbiTemplate {
  id:          string;
  label:       string;
  icon:        string;
  color:       string;
  defaultFunc: string;
  fns:         AbiFunction[];
}

const ABI_TEMPLATES: AbiTemplate[] = [
  {
    id: 'erc20', label: 'ERC-20', icon: '💎', color: '#01a2ff', defaultFunc: 'transfer',
    fns: [
      { name:'transfer',     type:'function', stateMutability:'nonpayable', inputs:[{name:'recipient',type:'address'},{name:'amount',type:'uint256'}], outputs:[{name:'',type:'bool'}] },
      { name:'approve',      type:'function', stateMutability:'nonpayable', inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}], outputs:[{name:'',type:'bool'}] },
      { name:'transferFrom', type:'function', stateMutability:'nonpayable', inputs:[{name:'sender',type:'address'},{name:'recipient',type:'address'},{name:'amount',type:'uint256'}], outputs:[{name:'',type:'bool'}] },
      { name:'balanceOf',    type:'function', stateMutability:'view',       inputs:[{name:'account',type:'address'}], outputs:[{name:'',type:'uint256'}] },
      { name:'allowance',    type:'function', stateMutability:'view',       inputs:[{name:'owner',type:'address'},{name:'spender',type:'address'}], outputs:[{name:'',type:'uint256'}] },
      { name:'totalSupply',  type:'function', stateMutability:'view',       inputs:[], outputs:[{name:'',type:'uint256'}] },
    ],
  },
  {
    id: 'nft', label: 'NFT (ERC-721)', icon: '🖼️', color: '#e81899', defaultFunc: 'mint',
    fns: [
      { name:'mint',         type:'function', stateMutability:'payable',    inputs:[{name:'quantity',type:'uint256'}], outputs:[] },
      { name:'safeMint',     type:'function', stateMutability:'nonpayable', inputs:[{name:'to',type:'address'},{name:'tokenId',type:'uint256'}], outputs:[] },
      { name:'approve',      type:'function', stateMutability:'nonpayable', inputs:[{name:'to',type:'address'},{name:'tokenId',type:'uint256'}], outputs:[] },
      { name:'transferFrom', type:'function', stateMutability:'nonpayable', inputs:[{name:'from',type:'address'},{name:'to',type:'address'},{name:'tokenId',type:'uint256'}], outputs:[] },
      { name:'ownerOf',      type:'function', stateMutability:'view',       inputs:[{name:'tokenId',type:'uint256'}], outputs:[{name:'',type:'address'}] },
      { name:'tokenURI',     type:'function', stateMutability:'view',       inputs:[{name:'tokenId',type:'uint256'}], outputs:[{name:'',type:'string'}] },
      { name:'totalSupply',  type:'function', stateMutability:'view',       inputs:[], outputs:[{name:'',type:'uint256'}] },
    ],
  },
  {
    id: 'staking', label: 'Staking / Farm', icon: '🌾', color: '#9c27b0', defaultFunc: 'stake',
    fns: [
      { name:'stake',         type:'function', stateMutability:'nonpayable', inputs:[{name:'amount',type:'uint256'}], outputs:[] },
      { name:'unstake',       type:'function', stateMutability:'nonpayable', inputs:[{name:'amount',type:'uint256'}], outputs:[] },
      { name:'claimRewards',  type:'function', stateMutability:'nonpayable', inputs:[], outputs:[] },
      { name:'deposit',       type:'function', stateMutability:'nonpayable', inputs:[{name:'pid',type:'uint256'},{name:'amount',type:'uint256'}], outputs:[] },
      { name:'withdraw',      type:'function', stateMutability:'nonpayable', inputs:[{name:'pid',type:'uint256'},{name:'amount',type:'uint256'}], outputs:[] },
      { name:'harvest',       type:'function', stateMutability:'nonpayable', inputs:[{name:'pid',type:'uint256'},{name:'to',type:'address'}], outputs:[] },
      { name:'stakedBalance', type:'function', stateMutability:'view',       inputs:[{name:'account',type:'address'}], outputs:[{name:'',type:'uint256'}] },
      { name:'pendingReward', type:'function', stateMutability:'view',       inputs:[{name:'pid',type:'uint256'},{name:'user',type:'address'}], outputs:[{name:'',type:'uint256'}] },
    ],
  },
  {
    id: 'defi', label: 'DEX / DeFi', icon: '🔄', color: '#4caf50', defaultFunc: 'swapExactETHForTokens',
    fns: [
      { name:'swapExactETHForTokens',    type:'function', stateMutability:'payable',    inputs:[{name:'amountOutMin',type:'uint256'},{name:'path',type:'address[]'},{name:'to',type:'address'},{name:'deadline',type:'uint256'}], outputs:[{name:'amounts',type:'uint256[]'}] },
      { name:'swapExactTokensForTokens', type:'function', stateMutability:'nonpayable', inputs:[{name:'amountIn',type:'uint256'},{name:'amountOutMin',type:'uint256'},{name:'path',type:'address[]'},{name:'to',type:'address'},{name:'deadline',type:'uint256'}], outputs:[{name:'amounts',type:'uint256[]'}] },
      { name:'addLiquidity',             type:'function', stateMutability:'nonpayable', inputs:[{name:'tokenA',type:'address'},{name:'tokenB',type:'address'},{name:'amountADesired',type:'uint256'},{name:'amountBDesired',type:'uint256'},{name:'amountAMin',type:'uint256'},{name:'amountBMin',type:'uint256'},{name:'to',type:'address'},{name:'deadline',type:'uint256'}], outputs:[] },
      { name:'addLiquidityETH',          type:'function', stateMutability:'payable',    inputs:[{name:'token',type:'address'},{name:'amountTokenDesired',type:'uint256'},{name:'amountTokenMin',type:'uint256'},{name:'amountETHMin',type:'uint256'},{name:'to',type:'address'},{name:'deadline',type:'uint256'}], outputs:[] },
      { name:'removeLiquidity',          type:'function', stateMutability:'nonpayable', inputs:[{name:'tokenA',type:'address'},{name:'tokenB',type:'address'},{name:'liquidity',type:'uint256'},{name:'amountAMin',type:'uint256'},{name:'amountBMin',type:'uint256'},{name:'to',type:'address'},{name:'deadline',type:'uint256'}], outputs:[] },
      { name:'deposit',                  type:'function', stateMutability:'payable',    inputs:[], outputs:[] },
      { name:'withdraw',                 type:'function', stateMutability:'nonpayable', inputs:[{name:'amount',type:'uint256'}], outputs:[] },
    ],
  },
  {
    id: 'airdrop', label: 'Claim / Airdrop', icon: '🪂', color: '#f3ba2f', defaultFunc: 'claim',
    fns: [
      { name:'claim',        type:'function', stateMutability:'nonpayable', inputs:[], outputs:[] },
      { name:'claimTokens',  type:'function', stateMutability:'nonpayable', inputs:[{name:'amount',type:'uint256'},{name:'merkleProof',type:'bytes32[]'}], outputs:[] },
      { name:'claimRewards', type:'function', stateMutability:'nonpayable', inputs:[], outputs:[] },
      { name:'redeem',       type:'function', stateMutability:'nonpayable', inputs:[{name:'amount',type:'uint256'}], outputs:[] },
      { name:'isClaimed',    type:'function', stateMutability:'view',       inputs:[{name:'index',type:'uint256'}], outputs:[{name:'',type:'bool'}] },
      { name:'claimable',    type:'function', stateMutability:'view',       inputs:[{name:'account',type:'address'}], outputs:[{name:'',type:'uint256'}] },
    ],
  },
  {
    id: 'bridge', label: 'Bridge', icon: '🌉', color: '#ff6600', defaultFunc: 'depositETH',
    fns: [
      { name:'depositETH',   type:'function', stateMutability:'payable',    inputs:[{name:'minGasLimit',type:'uint32'},{name:'extraData',type:'bytes'}], outputs:[] },
      { name:'depositERC20', type:'function', stateMutability:'nonpayable', inputs:[{name:'l1Token',type:'address'},{name:'l2Token',type:'address'},{name:'amount',type:'uint256'},{name:'minGasLimit',type:'uint32'},{name:'extraData',type:'bytes'}], outputs:[] },
      { name:'bridgeAsset',  type:'function', stateMutability:'payable',    inputs:[{name:'destinationNetwork',type:'uint32'},{name:'destinationAddress',type:'address'},{name:'amount',type:'uint256'},{name:'token',type:'address'},{name:'forceUpdateGlobalExitRoot',type:'bool'},{name:'permitData',type:'bytes'}], outputs:[] },
      { name:'sendMessage',  type:'function', stateMutability:'payable',    inputs:[{name:'destinationNetwork',type:'uint32'},{name:'destinationAddress',type:'address'},{name:'forceUpdateGlobalExitRoot',type:'bool'},{name:'metadata',type:'bytes'}], outputs:[] },
    ],
  },
  {
    id: 'custom', label: 'Custom ABI', icon: '⚙️', color: '#836EFD', defaultFunc: '',
    fns: [],
  },
];

const KNOWN_SELECTORS: Record<string, string> = {
  'transfer(address,uint256)':                      '0xa9059cbb',
  'transferFrom(address,address,uint256)':          '0x23b872dd',
  'approve(address,uint256)':                       '0x095ea7b3',
  'balanceOf(address)':                             '0x70a08231',
  'allowance(address,address)':                     '0xdd62ed3e',
  'totalSupply()':                                  '0x18160ddd',
  'name()':                                         '0x06fdde03',
  'symbol()':                                       '0x95d89b41',
  'decimals()':                                     '0x313ce567',
  'mint(uint256)':                                  '0xa0712d68',
  'safeMint(address,uint256)':                      '0xa1448194',
  'ownerOf(uint256)':                               '0x6352211e',
  'tokenURI(uint256)':                              '0xc87b56dd',
  'stake(uint256)':                                 '0xa694fc3a',
  'unstake(uint256)':                               '0x2e17de78',
  'claimRewards()':                                 '0x372500ab',
  'deposit()':                                      '0xd0e30db0',
  'deposit(uint256)':                               '0xb6b55f25',
  'deposit(uint256,uint256)':                       '0xe2bbb158',
  'withdraw(uint256)':                              '0x2e1a7d4d',
  'withdraw(uint256,uint256)':                      '0x441a3e70',
  'claim()':                                        '0x4e71d92d',
  'claimTokens(uint256,bytes32[])':                 '0x48c54b9d',
  'redeem(uint256)':                                '0xdb006a75',
  'isClaimed(uint256)':                             '0x62c1e4d9',
  'swapExactETHForTokens(uint256,address[],address,uint256)': '0x7ff36ab5',
  'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)': '0x38ed1739',
};

function getFuncSelector(fn: AbiFunction): string {
  const sig = `${fn.name}(${fn.inputs.map(i => i.type).join(',')})`;
  return KNOWN_SELECTORS[sig] ?? '0x????????';
}

function buildFuncSig(fn: AbiFunction): string {
  return `${fn.name}(${fn.inputs.map(i => i.type).join(',')})`;
}

function encodeArgForType(type: string, val: string): string {
  try {
    if (type === 'address') {
      return (val || '0x0000000000000000000000000000000000000000')
        .toLowerCase().replace(/^0x/, '').padStart(64, '0');
    }
    if (type === 'bool') {
      return (val === 'true' || val === '1')
        ? '0000000000000000000000000000000000000000000000000000000000000001'
        : '0000000000000000000000000000000000000000000000000000000000000000';
    }
    if (type.startsWith('uint') || type.startsWith('int')) {
      return BigInt(val || '0').toString(16).padStart(64, '0');
    }
    if (type === 'bytes32') {
      return (val || '').replace(/^0x/, '').padEnd(64, '0');
    }
    // bytes, string, array — return as hex placeholder
    return '0'.padStart(64, '0');
  } catch {
    return 'ff'.padStart(64, '0');
  }
}

function buildCalldata(fn: AbiFunction, args: string[]): string {
  const selector = getFuncSelector(fn);
  if (fn.inputs.length === 0) return selector;
  const encoded = fn.inputs
    .map((inp, i) => encodeArgForType(inp.type, args[i] ?? ''))
    .join('');
  return selector + encoded;
}

function ethToWeiStr(eth: string): string {
  try {
    const val = parseFloat(eth);
    if (isNaN(val) || val <= 0) return '';
    return BigInt(Math.floor(val * 1e18)).toLocaleString() + ' wei';
  } catch { return ''; }
}

function weiToEthApprox(weiStr: string): string {
  try {
    const w = BigInt(weiStr.replace(/[^0-9]/g, ''));
    return (Number(w) / 1e18).toFixed(6) + ' ETH';
  } catch { return ''; }
}

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

const C = {
  bg:      '#0d0d0d',
  bg2:     '#111',
  bg3:     '#0a0a0a',
  border:  '#1e1e1e',
  border2: '#2a2a2a',
  accent:  '#836EFD',
  green:   '#4caf50',
  yellow:  '#f3ba2f',
  red:     '#f44336',
  blue:    '#01a2ff',
  pink:    '#e81899',
  muted:   '#555',
  dim:     '#333',
  text:    '#fff',
  sub:     '#888',
};

type BadgeColor = 'accent' | 'green' | 'yellow' | 'red' | 'blue' | 'muted' | 'pink';
const BADGE_COLORS: Record<BadgeColor, string> = {
  accent: C.accent, green: C.green, yellow: C.yellow,
  red: C.red, blue: C.blue, muted: C.muted, pink: C.pink,
};

const Badge: React.FC<{ color: BadgeColor; children: React.ReactNode; style?: React.CSSProperties }> = ({ color, children, style }) => {
  const c = BADGE_COLORS[color];
  return (
    <span style={{
      fontSize: '10px', color: c,
      border: `1px solid ${c}44`,
      background: `${c}11`,
      padding: '2px 7px',
      letterSpacing: '0.5px',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
      ...style,
    }}>{children}</span>
  );
};

const FieldLabel: React.FC<{
  children: React.ReactNode;
  tip?: string;
  extra?: React.ReactNode;
}> = ({ children, tip, extra }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'5px' }}>
    <span style={{ fontSize:'10px', color: C.muted, textTransform:'uppercase', letterSpacing:'1px' }}>
      {children}
    </span>
    {extra}
    {tip && (
      <span title={tip} style={{ color: C.dim, cursor:'help', fontSize:'11px', lineHeight:1 }}>
        <FaInfoCircle />
      </span>
    )}
  </div>
);

const MutBadge: React.FC<{ mut?: string }> = ({ mut }) => {
  const color: BadgeColor =
    mut === 'view' || mut === 'pure' ? 'blue' :
    mut === 'payable' ? 'yellow' : 'green';
  return <Badge color={color}>{mut ?? 'nonpayable'}</Badge>;
};

interface GasNetwork { id: string; label: string; rpc: string; symbol: string; explorer: string; }

const GAS_NETWORKS: GasNetwork[] = [
  { id:'ethereum',   label:'Ethereum',       rpc:'https://1rpc.io/eth',                    symbol:'ETH',  explorer:'https://etherscan.io/tx/' },
  { id:'base',       label:'Base',           rpc:'https://1rpc.io/base',                   symbol:'ETH',  explorer:'https://basescan.org/tx/' },
  { id:'arbitrum',   label:'Arbitrum One',   rpc:'https://1rpc.io/arb',                    symbol:'ETH',  explorer:'https://arbiscan.io/tx/' },
  { id:'optimism',   label:'Optimism',       rpc:'https://1rpc.io/op',                     symbol:'ETH',  explorer:'https://optimistic.etherscan.io/tx/' },
  { id:'polygon',    label:'Polygon',        rpc:'https://1rpc.io/matic',                  symbol:'MATIC',explorer:'https://polygonscan.com/tx/' },
  { id:'bnb',        label:'BNB Chain',      rpc:'https://1rpc.io/bnb',                    symbol:'BNB',  explorer:'https://bscscan.com/tx/' },
  { id:'monad',      label:'Monad Testnet',  rpc:'https://testnet-rpc.monad.xyz',          symbol:'MON',  explorer:'https://testnet.monadexplorer.com/tx/' },
  { id:'pharos',     label:'Pharos Testnet', rpc:'https://testnet.dplabs-internal.com',    symbol:'PHRS', explorer:'https://testnet.pharosscan.xyz/tx/' },
  { id:'sepolia',    label:'Sepolia',        rpc:'https://rpc.sepolia.org',                symbol:'ETH',  explorer:'https://sepolia.etherscan.io/tx/' },
  { id:'base-sep',   label:'Base Sepolia',   rpc:'https://sepolia.base.org',               symbol:'ETH',  explorer:'https://sepolia.basescan.org/tx/' },
];

export const SmartContractConfig: React.FC<SmartContractConfigProps> = ({
  value,
  onChange,
  provider,
  fromAddress,
  defaultOpen = false,
}) => {
  const [open,           setOpen]           = useState(defaultOpen);
  const [activeTab,      setActiveTab]      = useState<'visual' | 'manual' | 'raw'>('visual');
  const [parsedAbi,      setParsedAbi]      = useState<AbiFunction[]>([]);
  const [abiParseError,  setAbiParseError]  = useState('');
  const [selFunc,        setSelFunc]        = useState<AbiFunction | null>(null);
  const [argValues,      setArgValues]      = useState<string[]>([]);
  const [calldata,       setCalldata]       = useState('');
  const [copiedCalldata, setCopiedCalldata] = useState(false);
  const [gasNetId,       setGasNetId]       = useState('sepolia');
  const [gasResult,      setGasResult]      = useState<null | {
    gasUsed: number; gasPriceGwei: number;
    slow: number; standard: number; fast: number;
    calldataBytes: number; zeroBytes: number; nonZeroBytes: number; dataCost: number;
    method: 'rpc' | 'heuristic'; symbol: string;
  }>(null);
  const [estimating,     setEstimating]     = useState(false);
  const [gasError,       setGasError]       = useState('');
  const [selectedTplId,  setSelectedTplId]  = useState('');
  const [fnSearch,       setFnSearch]       = useState('');
  const [rawCalldata,    setRawCalldata]    = useState('');
  const [gasEstimate,    setGasEstimate]    = useState('');

  useEffect(() => {
    const raw = (value.contractAbi || '').trim();
    if (!raw) {
      setParsedAbi([]);
      setAbiParseError('');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const fns: AbiFunction[] = (Array.isArray(parsed) ? parsed : [])
        .filter((f: any) => f.type === 'function');
      setParsedAbi(fns);
      setAbiParseError('');

      if (value.contractFunc) {
        const found = fns.find(f => f.name === value.contractFunc) ?? null;
        if (found) {
          setSelFunc(found);
          try {
            const existingArgs: any[] = JSON.parse(value.contractArgs || '[]');
            setArgValues(found.inputs.map((_, i) => String(existingArgs[i] ?? '')));
          } catch {
            setArgValues(found.inputs.map(() => ''));
          }
        }
      }
    } catch (e: any) {
      setAbiParseError(e?.message ?? 'ABI tidak valid');
      setParsedAbi([]);
    }
  }, [value.contractAbi]);

  useEffect(() => {
    if (!selFunc) { setCalldata(''); return; }
    const cd = buildCalldata(selFunc, argValues);
    setCalldata(cd);
    onChange({
      ...value,
      contractFunc: selFunc.name,
      contractArgs: JSON.stringify(argValues),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selFunc, argValues]);

  const handleTemplateSelect = (id: string) => {
    const tpl = ABI_TEMPLATES.find(t => t.id === id);
    if (!tpl) return;
    setSelectedTplId(id);
    setFnSearch('');

    if (id === 'custom') {
      onChange({ ...value, contractAbi: '', contractFunc: '' });
      setParsedAbi([]);
      setSelFunc(null);
      setArgValues([]);
      setCalldata('');
      return;
    }

    const abiStr = JSON.stringify(tpl.fns, null, 2);
    setParsedAbi(tpl.fns);
    setAbiParseError('');

    const defFn = tpl.fns.find(f => f.name === tpl.defaultFunc) ?? tpl.fns[0] ?? null;
    setSelFunc(defFn);
    setArgValues(defFn ? defFn.inputs.map(() => '') : []);

    onChange({
      ...value,
      contractAbi:  abiStr,
      contractFunc: defFn?.name ?? '',
      contractArgs: '[]',
    });
  };

  const handleFuncSelect = (fn: AbiFunction) => {
    setSelFunc(fn);
    setArgValues(fn.inputs.map(() => ''));
    onChange({ ...value, contractFunc: fn.name, contractArgs: '[]' });
  };

  const handleArgChange = (i: number, v: string) => {
    const next = [...argValues];
    next[i] = v;
    setArgValues(next);
  };

  const handleGasEstimate = useCallback(async () => {
    if (!value.contractAddress) { setGasError('Isi contract address dulu'); return; }
    setEstimating(true);
    setGasResult(null);
    setGasError('');

    const hex = (calldata || '0x').replace(/^0x/, '');
    const calldataBytes = Math.max(0, hex.length / 2);
    let zeroBytes = 0, nonZeroBytes = 0, dataCost = 0;
    for (let i = 0; i < hex.length; i += 2) {
      if (hex.slice(i, i + 2) === '00') { zeroBytes++; dataCost += 4; }
      else { nonZeroBytes++; dataCost += 16; }
    }

    const net = GAS_NETWORKS.find(n => n.id === gasNetId) ?? GAS_NETWORKS[0];
    let gasUsed  = 21_000 + dataCost + (calldataBytes > 4 ? 8_000 : 0);
    let gasPriceGwei = 0;
    let method: 'rpc' | 'heuristic' = 'heuristic';

    const rpcCall = (rpcMethod: string, params: any[]) =>
      fetch(net.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: rpcMethod, params }),
        signal: AbortSignal.timeout(8000),
      }).then(r => r.json());

    try {
      const ethVal = value.ethValue && value.ethValue !== '0'
        ? '0x' + BigInt(Math.floor(parseFloat(value.ethValue) * 1e18)).toString(16)
        : '0x0';

      // fire estimate + gasPrice + feeHistory in parallel
      const [estRes, priceRes, feeRes] = await Promise.allSettled([
        rpcCall('eth_estimateGas', [{
          from: '0x0000000000000000000000000000000000000001',
          to:   value.contractAddress,
          data: calldata || '0x',
          value: ethVal,
        }]),
        rpcCall('eth_gasPrice', []),
        rpcCall('eth_feeHistory', ['0x5', 'latest', [10, 50, 90]]),
      ]);

      // parse gas estimate
      if (estRes.status === 'fulfilled' && estRes.value?.result) {
        gasUsed = parseInt(estRes.value.result, 16);
        method  = 'rpc';
      }

      // parse base fee from feeHistory (EIP-1559) → more accurate than gasPrice
      let baseFeeGwei = 0;
      if (feeRes.status === 'fulfilled' && feeRes.value?.result?.baseFeePerGas?.length) {
        const fees: string[] = feeRes.value.result.baseFeePerGas;
        const latest = fees[fees.length - 1];
        baseFeeGwei = parseInt(latest, 16) / 1e9;
      }

      // parse legacy gasPrice as fallback
      if (priceRes.status === 'fulfilled' && priceRes.value?.result) {
        gasPriceGwei = parseInt(priceRes.value.result, 16) / 1e9;
      }

      // prefer baseFee when available, add small priority tip
      if (baseFeeGwei > 0) {
        gasPriceGwei = baseFeeGwei + 0.1; // +0.1 gwei tip
      }
    } catch { /* keep heuristic */ }

    // default gwei when both fail
    if (gasPriceGwei <= 0) gasPriceGwei = net.id === 'ethereum' ? 15 : 1;

    const ethCost = (mult: number) => (gasUsed * gasPriceGwei * mult * 1e9) / 1e18;

    setGasResult({
      gasUsed, gasPriceGwei,
      slow:     ethCost(1),
      standard: ethCost(1.3),
      fast:     ethCost(2),
      calldataBytes, zeroBytes, nonZeroBytes, dataCost,
      method, symbol: net.symbol,
    });
    setEstimating(false);
  }, [provider, fromAddress, value, calldata, gasNetId]);

  const copyCalldataFn = async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedCalldata(true);
    setTimeout(() => setCopiedCalldata(false), 1500);
  };

  const resetConfig = () => {
    onChange({ contractAddress:'', contractAbi:'', contractFunc:'', contractArgs:'[]', ethValue:'0' });
    setParsedAbi([]);
    setSelFunc(null);
    setArgValues([]);
    setCalldata('');
    setRawCalldata('');
    setSelectedTplId('');
    setFnSearch('');
    setGasEstimate('');
    setAbiParseError('');
  };

  const filteredFuncs = useMemo(
    () => parsedAbi.filter(f => f.name.toLowerCase().includes(fnSearch.toLowerCase())),
    [parsedAbi, fnSearch],
  );

  const isPayable    = selFunc?.stateMutability === 'payable';
  const isView       = selFunc?.stateMutability === 'view' || selFunc?.stateMutability === 'pure';
  const addrOk       = isValidAddress(value.contractAddress);
  const addrDirty    = value.contractAddress.length > 0;
  const funcSig      = selFunc ? buildFuncSig(selFunc) : '';
  const selector4    = selFunc ? getFuncSelector(selFunc) : '';
  const weiPreview   = value.ethValue && value.ethValue !== '0' ? ethToWeiStr(value.ethValue) : '';
  const cdBytes      = calldata ? Math.floor((calldata.length - 2) / 2) : 0;
  const isConfigured = !!(value.contractAddress || value.contractFunc);

  const S = {
    panel: {
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderTop: 'none',
      padding: '16px',
    } as React.CSSProperties,
    input: {
      background: '#0d0d0d',
      border: `1px solid ${C.border2}`,
      color: C.text,
      padding: '8px 10px',
      fontFamily: 'monospace',
      fontSize: '12px',
      width: '100%',
      boxSizing: 'border-box' as const,
      outline: 'none',
    } as React.CSSProperties,
    select: {
      background: '#0d0d0d',
      border: `1px solid ${C.border2}`,
      color: C.text,
      padding: '8px 10px',
      fontSize: '12px',
      width: '100%',
      boxSizing: 'border-box' as const,
      cursor: 'pointer',
    } as React.CSSProperties,
    textarea: {
      background: '#0d0d0d',
      border: `1px solid ${C.border2}`,
      color: C.text,
      padding: '8px 10px',
      fontFamily: 'monospace',
      fontSize: '11px',
      width: '100%',
      boxSizing: 'border-box' as const,
      resize: 'vertical' as const,
      outline: 'none',
    } as React.CSSProperties,
    tabBtn: (active: boolean) => ({
      padding: '6px 14px',
      cursor: 'pointer',
      fontSize: '11px',
      background: active ? C.accent : 'transparent',
      border: `1px solid ${active ? C.accent : C.border}`,
      color: active ? '#000' : C.muted,
      fontWeight: (active ? 'bold' : 'normal') as any,
      letterSpacing: '0.5px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      transition: 'all 0.15s',
    }) as React.CSSProperties,
    tplBtn: (active: boolean, color: string) => ({
      padding: '6px 12px',
      cursor: 'pointer',
      fontSize: '11px',
      background: active ? `${color}22` : C.bg2,
      border: `1px solid ${active ? color : C.border}`,
      color: active ? color : C.muted,
      fontWeight: (active ? 'bold' : 'normal') as any,
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      transition: 'all 0.15s',
    }) as React.CSSProperties,
    fnBtn: (active: boolean) => ({
      padding: '5px 10px',
      cursor: 'pointer',
      fontSize: '11px',
      background: active ? `${C.accent}18` : C.bg3,
      border: `1px solid ${active ? C.accent : C.border}`,
      color: active ? C.accent : C.sub,
      fontFamily: 'monospace',
      fontWeight: (active ? 'bold' : 'normal') as any,
      transition: 'all 0.12s',
    }) as React.CSSProperties,
  };

  return (
    <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: '12px', marginBottom: '10px' }}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%',
          background: open ? `${C.accent}0f` : C.bg2,
          border: `1px solid ${open ? C.accent + '55' : C.border}`,
          borderLeft: `3px solid ${C.accent}`,
          color: C.accent,
          padding: '10px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'space-between',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <FaCode size={13} />
          <span style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:'bold' }}>
            Smart Contract Config
          </span>
          {isConfigured
            ? <Badge color="green">✓ Configured</Badge>
            : <Badge color="muted">opsional</Badge>
          }
        </div>
        <span style={{ color: C.dim, fontSize: '12px' }}>
          {open ? <FaChevronUp /> : <FaChevronDown />}
        </span>
      </button>

      {open && (
        <div style={S.panel}>
          <div style={{
            background: `${C.accent}0a`,
            border: `1px solid ${C.accent}22`,
            borderLeft: `3px solid ${C.accent}`,
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '11px',
            color: '#666',
            lineHeight: '1.6',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}>
            <FaInfoCircle color={C.accent} style={{ flexShrink:0, marginTop:'2px' }} />
            <span>
              Isi konfigurasi ini agar task punya tombol{' '}
              <strong style={{ color: C.accent }}>⚡ Execute</strong> yang langsung kirim TX.
              Gunakan <strong style={{ color: '#aaa' }}>Visual Builder</strong> untuk pilih fungsi dari template,
              atau <strong style={{ color: '#aaa' }}>Manual ABI</strong> untuk paste JSON ABI dari Etherscan.
            </span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <FieldLabel tip="Pilih template untuk auto-fill ABI standar kontrak">
              <FaMagic style={{ marginRight:'4px' }} /> Template ABI
            </FieldLabel>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {ABI_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleTemplateSelect(tpl.id)}
                  style={S.tplBtn(selectedTplId === tpl.id, tpl.color)}
                >
                  <span>{tpl.icon}</span>
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            display:'flex', gap:'4px', marginBottom:'14px',
            borderBottom: `1px solid ${C.border}`, paddingBottom:'8px',
            flexWrap: 'wrap',
          }}>
            <button type="button" style={S.tabBtn(activeTab==='visual')} onClick={() => setActiveTab('visual')}>
              <FaMagic size={10} /> Visual Builder
            </button>
            <button type="button" style={S.tabBtn(activeTab==='manual')} onClick={() => setActiveTab('manual')}>
              <FaFileCode size={10} /> Manual ABI
            </button>
            <button type="button" style={S.tabBtn(activeTab==='raw')} onClick={() => setActiveTab('raw')}>
              <FaTerminal size={10} /> Raw Calldata
            </button>
          </div>

          {activeTab === 'visual' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

              <div>
                <FieldLabel tip="Alamat smart contract target (0x...)">
                  Contract Address
                  {addrDirty && (
                    addrOk
                      ? <span style={{ fontSize:'10px', color: C.green, display:'flex', alignItems:'center', gap:'3px' }}>
                          <FaCheckCircle size={9} /> valid
                        </span>
                      : <span style={{ fontSize:'10px', color: C.red, display:'flex', alignItems:'center', gap:'3px' }}>
                          <FaExclamationTriangle size={9} /> invalid
                        </span>
                  )}
                </FieldLabel>
                <input
                  placeholder="0x1234...abcd"
                  value={value.contractAddress}
                  onChange={e => onChange({ ...value, contractAddress: e.target.value })}
                  style={{
                    ...S.input,
                    borderColor: addrDirty
                      ? (addrOk ? C.green + '66' : C.red + '66')
                      : C.border2,
                  }}
                />
              </div>

              {parsedAbi.length > 0 && (
                <div>
                  <FieldLabel tip="Pilih fungsi yang akan dipanggil dari ABI">
                    <FaList style={{ marginRight:'4px' }} /> Pilih Fungsi
                    <Badge color="blue">{parsedAbi.length} fungsi</Badge>
                  </FieldLabel>

                  {parsedAbi.length > 5 && (
                    <div style={{ position:'relative', marginBottom:'8px' }}>
                      <FaSearch style={{ position:'absolute', left:'9px', top:'50%', transform:'translateY(-50%)', color: C.muted, fontSize:'11px' }} />
                      <input
                        placeholder="Cari nama fungsi..."
                        value={fnSearch}
                        onChange={e => setFnSearch(e.target.value)}
                        style={{ ...S.input, paddingLeft:'28px', fontFamily:'inherit' }}
                      />
                    </div>
                  )}

                  <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                    {filteredFuncs.map(fn => {
                      const mutColor =
                        fn.stateMutability === 'view' || fn.stateMutability === 'pure' ? C.blue :
                        fn.stateMutability === 'payable' ? C.yellow : C.green;
                      return (
                        <button
                          key={fn.name}
                          type="button"
                          onClick={() => handleFuncSelect(fn)}
                          style={S.fnBtn(selFunc?.name === fn.name)}
                        >
                          {fn.name}
                          <span style={{ fontSize:'9px', color: mutColor, marginLeft:'3px' }}>
                            {fn.stateMutability}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selFunc && (
                <div style={{
                  background: C.bg3,
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${C.accent}`,
                  padding: '14px',
                }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center', marginBottom:'12px' }}>
                    <code style={{ fontSize:'12px', color: C.accent, fontFamily:'monospace' }}>
                      {funcSig}
                    </code>
                    <MutBadge mut={selFunc.stateMutability} />
                    {selector4 !== '0x????????' && (
                      <Badge color="muted">{selector4}</Badge>
                    )}
                    {isView && <Badge color="blue">read-only</Badge>}
                  </div>

                  {selFunc.inputs.length === 0 ? (
                    <p style={{ fontSize:'11px', color: C.muted, fontStyle:'italic', margin:0 }}>
                      Fungsi ini tidak memerlukan argumen
                    </p>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'10px' }}>
                      {selFunc.inputs.map((inp, i) => {
                        const isAddr  = inp.type === 'address';
                        const isUint  = inp.type.startsWith('uint') || inp.type.startsWith('int');
                        const isBool  = inp.type === 'bool';
                        const argBadgeColor: BadgeColor =
                          isAddr ? 'blue' : isUint ? 'green' : isBool ? 'yellow' : 'muted';
                        const argVal = argValues[i] ?? '';
                        const addrArgOk = isAddr && argVal.length > 0 && isValidAddress(argVal);
                        const addrArgBad = isAddr && argVal.length > 0 && !isValidAddress(argVal);

                        return (
                          <div key={i}>
                            <FieldLabel tip={`Tipe: ${inp.type}${inp.internalType ? ' / ' + inp.internalType : ''}`}>
                              <span style={{ color: C.accent }}>{inp.name || `param_${i}`}</span>
                              <Badge color={argBadgeColor}>{inp.type}</Badge>
                            </FieldLabel>

                            {isBool ? (
                              <select
                                value={argVal || 'false'}
                                onChange={e => handleArgChange(i, e.target.value)}
                                style={S.select}
                              >
                                <option value="false">false</option>
                                <option value="true">true</option>
                              </select>
                            ) : (
                              <>
                                <input
                                  placeholder={
                                    isAddr ? '0x...' :
                                    isUint ? '0 (dalam wei)' :
                                    inp.type.includes('[]') ? '["val1","val2"]' :
                                    inp.type
                                  }
                                  value={argVal}
                                  onChange={e => handleArgChange(i, e.target.value)}
                                  style={{
                                    ...S.input,
                                    borderColor: addrArgBad
                                      ? C.red + '66'
                                      : addrArgOk
                                        ? C.green + '66'
                                        : C.border2,
                                  }}
                                />
                                {addrArgBad && (
                                  <div style={{ fontSize:'9px', color: C.red, marginTop:'2px', display:'flex', alignItems:'center', gap:'3px' }}>
                                    <FaExclamationTriangle size={8} /> Format address tidak valid
                                  </div>
                                )}
                                {isUint && argVal.length > 10 && (
                                  <div style={{ fontSize:'9px', color: C.muted, marginTop:'2px', fontFamily:'monospace' }}>
                                    ≈ {weiToEthApprox(argVal)}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isPayable && (
                    <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:`1px dashed ${C.border}` }}>
                      <FieldLabel tip="ETH yang dikirim bersama TX (msg.value). Wajib untuk fungsi payable.">
                        <span style={{ color: C.yellow }}>ETH Value (msg.value)</span>
                      </FieldLabel>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0.01"
                          value={value.ethValue}
                          onChange={e => onChange({ ...value, ethValue: e.target.value })}
                          style={{ ...S.input, width:'160px' }}
                        />
                        <span style={{ fontSize:'12px', color: C.muted }}>ETH</span>
                        {weiPreview && <Badge color="yellow">{weiPreview}</Badge>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selFunc && !isPayable && (
                <div>
                  <FieldLabel tip="Biasanya 0 untuk non-payable. Override jika perlu.">
                    ETH Value
                    <Badge color="muted">override</Badge>
                  </FieldLabel>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <input
                      type="number" min="0" step="0.0001" placeholder="0"
                      value={value.ethValue}
                      onChange={e => onChange({ ...value, ethValue: e.target.value })}
                      style={{ ...S.input, width:'160px' }}
                    />
                    <span style={{ fontSize:'12px', color: C.muted }}>ETH</span>
                  </div>
                </div>
              )}

              {calldata && (
                <div>
                  <FieldLabel tip="Hex calldata — 4 byte selector + ABI-encoded arguments">
                    <FaLayerGroup style={{ marginRight:'4px' }} /> Calldata Preview
                    <Badge color="muted">{cdBytes} bytes</Badge>
                  </FieldLabel>
                  <div style={{
                    background: '#050505',
                    border: `1px solid ${C.border}`,
                    padding: '10px 12px',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start',
                    position: 'relative',
                  }}>
                    <code style={{
                      flex:1, fontSize:'11px', fontFamily:'monospace',
                      wordBreak:'break-all', lineHeight:'1.7', color: '#666',
                    }}>
                      <span style={{ color: C.accent, fontWeight:'bold' }}>{calldata.slice(0, 10)}</span>
                      <span>{calldata.slice(10)}</span>
                    </code>
                    <button
                      type="button"
                      onClick={() => copyCalldataFn(calldata)}
                      title="Salin calldata"
                      style={{ background:'none', border:'none', cursor:'pointer', padding:'2px', flexShrink:0, color: copiedCalldata ? C.green : C.dim }}
                    >
                      {copiedCalldata ? <FaCheckCircle size={12} /> : <FaCopy size={12} />}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ borderTop:`1px dashed ${C.border2}`, paddingTop:'12px' }}>
                <div style={{ fontSize:'10px', color:C.muted, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px' }}>
                  <FaGasPump size={10}/> Gas Estimator
                </div>

                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', marginBottom:'10px' }}>
                  <select
                    value={gasNetId}
                    onChange={e => { setGasNetId(e.target.value); setGasResult(null); setGasError(''); }}
                    style={{ fontSize:'11px', padding:'6px 10px', background:C.bg2, border:`1px solid ${C.border2}`, color:C.text, flex:1, minWidth:'140px', cursor:'pointer' }}
                  >
                    {GAS_NETWORKS.map(n => (
                      <option key={n.id} value={n.id}>{n.label} ({n.symbol})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleGasEstimate}
                    disabled={estimating || !value.contractAddress}
                    style={{
                      padding:'6px 14px', cursor: !value.contractAddress ? 'not-allowed' : 'pointer',
                      background: estimating ? C.bg2 : 'transparent',
                      border:`1px solid ${C.border2}`, color: estimating ? C.muted : C.accent,
                      fontSize:'11px', opacity: !value.contractAddress ? 0.4 : 1,
                      display:'flex', alignItems:'center', gap:'5px', transition:'all 0.2s',
                      whiteSpace:'nowrap',
                    }}
                  >
                    {estimating
                      ? <><FaSpinner size={10} style={{ animation:'spin 1s linear infinite' }}/> Estimasi...</>
                      : <><FaGasPump size={10}/> Hitung Gas</>}
                  </button>
                  {gasResult && (
                    <button
                      type="button"
                      onClick={() => { setGasResult(null); setGasError(''); }}
                      style={{ background:'none', border:'none', color:C.dim, cursor:'pointer', fontSize:'11px', padding:'4px 6px' }}
                      title="Reset"
                    >✕</button>
                  )}
                </div>

                {gasError && (
                  <div style={{ fontSize:'11px', color:C.yellow, display:'flex', alignItems:'center', gap:'5px', marginBottom:'8px' }}>
                    <FaExclamationTriangle size={10}/> {gasError}
                  </div>
                )}

                {gasResult && (() => {
                  const fmtEth = (v: number) =>
                    v < 0.000001 ? '<0.000001' : v.toFixed(v < 0.001 ? 8 : 6);
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>

                      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                        <Badge color={gasResult.method === 'rpc' ? 'green' : 'yellow'}>
                          {gasResult.method === 'rpc' ? '✓ RPC Real-time' : '≈ Estimasi Kasar'}
                        </Badge>
                        <Badge color="muted">{GAS_NETWORKS.find(n=>n.id===gasNetId)?.label}</Badge>
                        <Badge color="blue">{gasResult.gasPriceGwei.toFixed(2)} Gwei</Badge>
                      </div>

                      <div style={{ background:C.bg3, border:`1px solid ${C.border}`, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'10px', color:C.muted, textTransform:'uppercase', letterSpacing:'1px' }}>Gas Limit</span>
                        <span style={{ fontFamily:'monospace', fontSize:'15px', fontWeight:'bold', color:C.text }}>
                          {gasResult.gasUsed.toLocaleString()}
                        </span>
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px' }}>
                        {[
                          { label:'🐢 Slow',     mult:'1×',   val:gasResult.slow,     color:C.muted },
                          { label:'🚗 Standard',  mult:'1.3×', val:gasResult.standard, color:C.accent },
                          { label:'⚡ Fast',      mult:'2×',   val:gasResult.fast,     color:C.yellow },
                        ].map(tier => (
                          <div key={tier.label} style={{ background:C.bg3, border:`1px solid ${C.border}`, padding:'10px 8px', textAlign:'center' }}>
                            <div style={{ fontSize:'10px', color:tier.color, marginBottom:'5px', fontWeight:'bold' }}>{tier.label}</div>
                            <div style={{ fontSize:'10px', color:C.dim, marginBottom:'4px' }}>{tier.mult}</div>
                            <div style={{ fontFamily:'monospace', fontSize:'12px', fontWeight:'bold', color:tier.color }}>
                              {fmtEth(tier.val)}
                            </div>
                            <div style={{ fontSize:'9px', color:C.dim, marginTop:'2px' }}>{gasResult.symbol}</div>
                          </div>
                        ))}
                      </div>

                      {gasResult.calldataBytes > 0 && (
                        <div style={{ background:C.bg3, border:`1px solid ${C.border}`, padding:'10px 14px' }}>
                          <div style={{ fontSize:'10px', color:C.muted, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Calldata Breakdown</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 16px' }}>
                            {[
                              { label:'Total bytes',    val: gasResult.calldataBytes },
                              { label:'Non-zero bytes', val: `${gasResult.nonZeroBytes} × 16 gas` },
                              { label:'Zero bytes',     val: `${gasResult.zeroBytes} × 4 gas` },
                              { label:'Data cost',      val: `${gasResult.dataCost.toLocaleString()} gas` },
                            ].map(r => (
                              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', borderBottom:`1px solid ${C.border}`, paddingBottom:'3px' }}>
                                <span style={{ color:C.dim }}>{r.label}</span>
                                <span style={{ fontFamily:'monospace', color:C.sub }}>{r.val}</span>
                              </div>
                            ))}
                          </div>
                          {gasResult.calldataBytes > 0 && (
                            <div style={{ marginTop:'8px' }}>
                              <div style={{ height:'3px', background:C.border, width:'100%', overflow:'hidden' }}>
                                <div style={{
                                  height:'100%',
                                  width:`${Math.round((gasResult.nonZeroBytes / gasResult.calldataBytes) * 100)}%`,
                                  background:C.accent, transition:'width 0.5s ease',
                                }}/>
                              </div>
                              <div style={{ fontSize:'9px', color:C.dim, marginTop:'3px' }}>
                                {Math.round((gasResult.nonZeroBytes/gasResult.calldataBytes)*100)}% non-zero bytes (lebih mahal)
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === 'manual' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <FieldLabel>Contract Address</FieldLabel>
                <input
                  placeholder="0x..."
                  value={value.contractAddress}
                  onChange={e => onChange({ ...value, contractAddress: e.target.value })}
                  style={S.input}
                />
              </div>

              <div>
                <FieldLabel tip="Paste ABI JSON array dari Etherscan / dokumen kontrak">
                  ABI JSON
                  {parsedAbi.length > 0 && !abiParseError && (
                    <Badge color="green">{parsedAbi.length} fungsi terbaca</Badge>
                  )}
                  {abiParseError && <Badge color="red">error parse</Badge>}
                </FieldLabel>
                <textarea
                  rows={6}
                  placeholder={`[{"inputs":[{"name":"recipient","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]`}
                  value={value.contractAbi}
                  onChange={e => onChange({ ...value, contractAbi: e.target.value })}
                  style={{
                    ...S.textarea,
                    borderColor: abiParseError
                      ? C.red + '66'
                      : parsedAbi.length > 0
                        ? C.green + '44'
                        : C.border2,
                  }}
                />
                {abiParseError && (
                  <div style={{ fontSize:'10px', color: C.red, marginTop:'3px', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaExclamationTriangle size={9} /> {abiParseError}
                  </div>
                )}
                {!abiParseError && parsedAbi.length > 0 && (
                  <div style={{ fontSize:'10px', color: C.green, marginTop:'3px', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaCheckCircle size={9} /> {parsedAbi.length} fungsi berhasil di-parse — switch ke Visual Builder untuk pilih fungsi
                  </div>
                )}
              </div>

              <div>
                <FieldLabel tip="Nama fungsi yang dipanggil (harus cocok dengan yang ada di ABI)">
                  Function Name
                </FieldLabel>
                <div style={{ display:'flex', gap:'8px' }}>
                  <input
                    placeholder="mint, claim, transfer..."
                    value={value.contractFunc}
                    onChange={e => onChange({ ...value, contractFunc: e.target.value })}
                    style={S.input}
                  />
                  {parsedAbi.length > 0 && (
                    <select
                      value={value.contractFunc}
                      onChange={e => {
                        const fn = parsedAbi.find(f => f.name === e.target.value) ?? null;
                        if (fn) {
                          handleFuncSelect(fn);
                          setActiveTab('visual');
                        }
                      }}
                      style={{ ...S.select, minWidth:'140px', width:'auto' }}
                    >
                      <option value="">Pilih dari ABI</option>
                      {parsedAbi.map(f => (
                        <option key={f.name} value={f.name}>
                          {f.name} ({f.stateMutability ?? 'nonpayable'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <FieldLabel tip='Array JSON argumen. Contoh: ["0xabc123", "1000000000000000000"]'>
                  Arguments (JSON Array)
                </FieldLabel>
                <input
                  placeholder='["0xRecipient", "1000000000000000000"]'
                  value={value.contractArgs}
                  onChange={e => onChange({ ...value, contractArgs: e.target.value })}
                  style={S.input}
                />
                <div style={{ fontSize:'10px', color: C.muted, marginTop:'3px' }}>
                  Nilai uint256 dalam wei — 1 ETH = 1000000000000000000
                </div>
              </div>

              <div>
                <FieldLabel tip="ETH yang dikirim bersama TX. Isi 0 jika tidak perlu.">
                  ETH Value
                </FieldLabel>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <input
                    type="number" min="0" step="0.0001" placeholder="0"
                    value={value.ethValue}
                    onChange={e => onChange({ ...value, ethValue: e.target.value })}
                    style={{ ...S.input, width:'160px' }}
                  />
                  <span style={{ fontSize:'12px', color: C.muted }}>ETH</span>
                  {weiPreview && <Badge color="yellow">{weiPreview}</Badge>}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'raw' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{
                background: '#1a1000',
                border: `1px solid ${C.yellow}33`,
                borderLeft: `3px solid ${C.yellow}`,
                padding: '10px 14px',
                fontSize: '11px',
                color: '#886',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
              }}>
                <FaExclamationTriangle color={C.yellow} style={{ flexShrink:0, marginTop:'1px' }} />
                <span>
                  Mode untuk advanced user. Tidak ada validasi otomatis —
                  pastikan calldata benar sebelum eksekusi. Salah calldata bisa menyebabkan TX gagal atau dana hilang.
                </span>
              </div>

              <div>
                <FieldLabel>Contract Address</FieldLabel>
                <input
                  placeholder="0x..."
                  value={value.contractAddress}
                  onChange={e => onChange({ ...value, contractAddress: e.target.value })}
                  style={S.input}
                />
              </div>
              <div>
                <FieldLabel tip="Ketik function signature untuk lookup 4-byte selector. Known sigs saja.">
                  Function Signature Helper
                </FieldLabel>
                <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                  <input
                    placeholder="transfer(address,uint256)"
                    value={value.contractFunc}
                    onChange={e => onChange({ ...value, contractFunc: e.target.value })}
                    style={{ ...S.input, flex:1, minWidth:'200px' }}
                  />
                  {value.contractFunc && (
                    <Badge color="accent">
                      {KNOWN_SELECTORS[value.contractFunc] ?? '0x????????'}
                    </Badge>
                  )}
                </div>
                <div style={{ fontSize:'10px', color: C.muted, marginTop:'3px' }}>
                  Format: functionName(type1,type2) — contoh: transfer(address,uint256)
                </div>
              </div>

              <div>
                <FieldLabel tip="Hex calldata lengkap: 4-byte selector + ABI-encoded args">
                  Raw Calldata (Hex)
                </FieldLabel>
                <div style={{ position:'relative' }}>
                  <textarea
                    rows={5}
                    placeholder="0xa9059cbb000000000000000000000000..."
                    value={rawCalldata}
                    onChange={e => {
                      setRawCalldata(e.target.value);
                      setCalldata(e.target.value);
                      onChange({ ...value, contractArgs: e.target.value });
                    }}
                    style={{ ...S.textarea, paddingRight:'32px' }}
                  />
                  <button
                    type="button"
                    onClick={() => copyCalldataFn(rawCalldata)}
                    style={{ position:'absolute', top:'8px', right:'8px', background:'none', border:'none', cursor:'pointer', color: copiedCalldata ? C.green : C.dim, padding:'2px' }}
                  >
                    {copiedCalldata ? <FaCheckCircle size={12} /> : <FaCopy size={12} />}
                  </button>
                </div>
                {rawCalldata.startsWith('0x') && rawCalldata.length > 10 && (
                  <div style={{ fontSize:'10px', color: C.muted, marginTop:'3px', fontFamily:'monospace' }}>
                    Selector:{' '}
                    <span style={{ color: C.accent }}>{rawCalldata.slice(0, 10)}</span>
                    {' · '}
                    {Math.floor((rawCalldata.length - 2) / 2)} bytes total
                  </div>
                )}
              </div>

              <div>
                <FieldLabel>ETH Value</FieldLabel>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <input
                    type="number" min="0" step="0.0001" placeholder="0"
                    value={value.ethValue}
                    onChange={e => onChange({ ...value, ethValue: e.target.value })}
                    style={{ ...S.input, width:'160px' }}
                  />
                  <span style={{ fontSize:'12px', color: C.muted }}>ETH</span>
                  {weiPreview && <Badge color="yellow">{weiPreview}</Badge>}
                </div>
              </div>
            </div>
          )}

          {isConfigured && (
            <div style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: '#050505',
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${C.green}`,
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <span style={{ fontSize:'10px', color: C.muted, textTransform:'uppercase', letterSpacing:'1px', flexShrink:0, display:'flex', alignItems:'center', gap:'4px' }}>
                <FaPlay size={8} /> Ringkasan
              </span>
              {value.contractAddress && (
                <Badge color={addrOk ? 'green' : 'red'}>
                  📍 {value.contractAddress.slice(0, 8)}...{value.contractAddress.slice(-4)}
                </Badge>
              )}
              {value.contractFunc && (
                <Badge color="accent">
                  <FaBolt size={9} style={{ marginRight:'3px' }} />
                  {value.contractFunc}()
                </Badge>
              )}
              {value.ethValue && value.ethValue !== '0' && (
                <Badge color="yellow">
                  💰 {value.ethValue} ETH
                </Badge>
              )}
              {cdBytes > 0 && (
                <Badge color="muted">{cdBytes} bytes calldata</Badge>
              )}
            </div>
          )}

          <p style={{ fontSize:'10px', color: C.dim, marginTop:'10px', lineHeight:'1.5' }}>
            💡 Bagian ini bisa dikosongkan dan diisi nanti saat eksekusi task.
            Jika diisi, tombol <strong style={{ color: C.accent }}>⚡ Execute</strong> akan otomatis pre-fill konfigurasi ini.
          </p>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'8px' }}>
            <button
              type="button"
              onClick={resetConfig}
              style={{
                background: 'none',
                border: `1px solid ${C.border}`,
                color: C.dim,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'color 0.15s',
              }}
            >
              <FaTrash size={9} /> Reset Config
            </button>
          </div>
        </div>
      )}
    </div>
  );
};



// ═══════════════════════════════════════════════════════════════════════
// BytecodeExplorer — EVM Bytecode Decoder & Function Decompiler
// ═══════════════════════════════════════════════════════════════════════

// ── Complete EVM Opcode Table ──────────────────────────────────────────
const EVM_OPCODES: Record<string, { name: string; inputs: number; desc: string; color: string }> = {
  '00': { name:'STOP',         inputs:0, desc:'Halt execution',                              color:'#888' },
  '01': { name:'ADD',          inputs:0, desc:'a + b',                                       color:'#4caf50' },
  '02': { name:'MUL',          inputs:0, desc:'a * b',                                       color:'#4caf50' },
  '03': { name:'SUB',          inputs:0, desc:'a - b',                                       color:'#4caf50' },
  '04': { name:'DIV',          inputs:0, desc:'a / b (integer)',                             color:'#4caf50' },
  '05': { name:'SDIV',         inputs:0, desc:'Signed integer division',                     color:'#4caf50' },
  '06': { name:'MOD',          inputs:0, desc:'a % b',                                       color:'#4caf50' },
  '07': { name:'SMOD',         inputs:0, desc:'Signed modulo',                               color:'#4caf50' },
  '08': { name:'ADDMOD',       inputs:0, desc:'(a + b) % N',                                color:'#4caf50' },
  '09': { name:'MULMOD',       inputs:0, desc:'(a * b) % N',                                color:'#4caf50' },
  '0a': { name:'EXP',          inputs:0, desc:'a ** b',                                      color:'#4caf50' },
  '0b': { name:'SIGNEXTEND',   inputs:0, desc:'Sign extend x from b-th bit',                color:'#4caf50' },
  '10': { name:'LT',           inputs:0, desc:'a < b',                                       color:'#2196f3' },
  '11': { name:'GT',           inputs:0, desc:'a > b',                                       color:'#2196f3' },
  '12': { name:'SLT',          inputs:0, desc:'Signed less-than',                            color:'#2196f3' },
  '13': { name:'SGT',          inputs:0, desc:'Signed greater-than',                         color:'#2196f3' },
  '14': { name:'EQ',           inputs:0, desc:'a == b',                                      color:'#2196f3' },
  '15': { name:'ISZERO',       inputs:0, desc:'a == 0',                                      color:'#2196f3' },
  '16': { name:'AND',          inputs:0, desc:'Bitwise AND',                                 color:'#2196f3' },
  '17': { name:'OR',           inputs:0, desc:'Bitwise OR',                                  color:'#2196f3' },
  '18': { name:'XOR',          inputs:0, desc:'Bitwise XOR',                                 color:'#2196f3' },
  '19': { name:'NOT',          inputs:0, desc:'Bitwise NOT',                                 color:'#2196f3' },
  '1a': { name:'BYTE',         inputs:0, desc:'i-th byte of x',                              color:'#2196f3' },
  '1b': { name:'SHL',          inputs:0, desc:'Shift left',                                  color:'#2196f3' },
  '1c': { name:'SHR',          inputs:0, desc:'Shift right (logical)',                       color:'#2196f3' },
  '1d': { name:'SAR',          inputs:0, desc:'Shift right (arithmetic)',                    color:'#2196f3' },
  '20': { name:'SHA3',         inputs:0, desc:'Keccak-256 hash',                             color:'#9c27b0' },
  '30': { name:'ADDRESS',      inputs:0, desc:'Address of current contract',                 color:'#f3ba2f' },
  '31': { name:'BALANCE',      inputs:0, desc:'Balance of address',                          color:'#f3ba2f' },
  '32': { name:'ORIGIN',       inputs:0, desc:'Transaction origin address',                  color:'#f3ba2f' },
  '33': { name:'CALLER',       inputs:0, desc:'msg.sender',                                  color:'#f3ba2f' },
  '34': { name:'CALLVALUE',    inputs:0, desc:'msg.value (ETH sent)',                        color:'#f3ba2f' },
  '35': { name:'CALLDATALOAD', inputs:0, desc:'Load 32 bytes from calldata',                 color:'#f3ba2f' },
  '36': { name:'CALLDATASIZE', inputs:0, desc:'Length of calldata in bytes',                 color:'#f3ba2f' },
  '37': { name:'CALLDATACOPY', inputs:0, desc:'Copy calldata to memory',                     color:'#f3ba2f' },
  '38': { name:'CODESIZE',     inputs:0, desc:'Size of current contract code',               color:'#f3ba2f' },
  '39': { name:'CODECOPY',     inputs:0, desc:'Copy code to memory',                         color:'#f3ba2f' },
  '3a': { name:'GASPRICE',     inputs:0, desc:'Gas price of current transaction',            color:'#f3ba2f' },
  '3b': { name:'EXTCODESIZE',  inputs:0, desc:'Size of external account code',               color:'#f3ba2f' },
  '3c': { name:'EXTCODECOPY',  inputs:0, desc:'Copy external code to memory',                color:'#f3ba2f' },
  '3d': { name:'RETURNDATASIZE',inputs:0,desc:'Size of output from last call',               color:'#f3ba2f' },
  '3e': { name:'RETURNDATACOPY',inputs:0,desc:'Copy return data to memory',                  color:'#f3ba2f' },
  '3f': { name:'EXTCODEHASH',  inputs:0, desc:'Keccak-256 of external code',                 color:'#f3ba2f' },
  '40': { name:'BLOCKHASH',    inputs:0, desc:'Hash of a previous block',                    color:'#ff6600' },
  '41': { name:'COINBASE',     inputs:0, desc:'Current block miner address',                 color:'#ff6600' },
  '42': { name:'TIMESTAMP',    inputs:0, desc:'Current block timestamp',                     color:'#ff6600' },
  '43': { name:'NUMBER',       inputs:0, desc:'Current block number',                        color:'#ff6600' },
  '44': { name:'DIFFICULTY',   inputs:0, desc:'Current block difficulty / PREVRANDAO',       color:'#ff6600' },
  '45': { name:'GASLIMIT',     inputs:0, desc:'Current block gas limit',                     color:'#ff6600' },
  '46': { name:'CHAINID',      inputs:0, desc:'Chain ID (EIP-155)',                          color:'#ff6600' },
  '47': { name:'SELFBALANCE',  inputs:0, desc:'Balance of current contract',                 color:'#ff6600' },
  '48': { name:'BASEFEE',      inputs:0, desc:'Base fee of current block (EIP-1559)',        color:'#ff6600' },
  '49': { name:'BLOBHASH',     inputs:0, desc:'Versioned blob hash (EIP-4844)',              color:'#ff6600' },
  '4a': { name:'BLOBBASEFEE',  inputs:0, desc:'Blob base fee (EIP-7516)',                    color:'#ff6600' },
  '50': { name:'POP',          inputs:0, desc:'Remove top stack item',                       color:'#888' },
  '51': { name:'MLOAD',        inputs:0, desc:'Load 32 bytes from memory',                   color:'#00e676' },
  '52': { name:'MSTORE',       inputs:0, desc:'Save 32 bytes to memory',                     color:'#00e676' },
  '53': { name:'MSTORE8',      inputs:0, desc:'Save 1 byte to memory',                       color:'#00e676' },
  '54': { name:'SLOAD',        inputs:0, desc:'Load from storage',                           color:'#e91e63' },
  '55': { name:'SSTORE',       inputs:0, desc:'Save to storage',                             color:'#e91e63' },
  '56': { name:'JUMP',         inputs:0, desc:'Alter program counter',                       color:'#ff3333' },
  '57': { name:'JUMPI',        inputs:0, desc:'Conditional jump',                            color:'#ff3333' },
  '58': { name:'PC',           inputs:0, desc:'Program counter before this instruction',     color:'#888' },
  '59': { name:'MSIZE',        inputs:0, desc:'Size of active memory in bytes',              color:'#888' },
  '5a': { name:'GAS',          inputs:0, desc:'Amount of available gas',                     color:'#888' },
  '5b': { name:'JUMPDEST',     inputs:0, desc:'Mark valid jump destination',                  color:'#ff3333' },
  '5c': { name:'TLOAD',        inputs:0, desc:'Load from transient storage (EIP-1153)',      color:'#e91e63' },
  '5d': { name:'TSTORE',       inputs:0, desc:'Save to transient storage (EIP-1153)',        color:'#e91e63' },
  '5e': { name:'MCOPY',        inputs:0, desc:'Copy memory (EIP-5656)',                      color:'#00e676' },
  '5f': { name:'PUSH0',        inputs:0, desc:'Push 0 onto stack (EIP-3855)',                color:'#836efd' },
  // PUSH1..PUSH32
  ...Object.fromEntries(Array.from({length:32},(_,i)=>[
    (0x60+i).toString(16).padStart(2,'0'),
    { name:`PUSH${i+1}`, inputs:i+1, desc:`Push ${i+1} byte(s) onto stack`, color:'#836efd' }
  ])),
  // DUP1..DUP16
  ...Object.fromEntries(Array.from({length:16},(_,i)=>[
    (0x80+i).toString(16).padStart(2,'0'),
    { name:`DUP${i+1}`, inputs:0, desc:`Duplicate ${i+1}${i===0?'st':i===1?'nd':i===2?'rd':'th'} stack item`, color:'#61dfff' }
  ])),
  // SWAP1..SWAP16
  ...Object.fromEntries(Array.from({length:16},(_,i)=>[
    (0x90+i).toString(16).padStart(2,'0'),
    { name:`SWAP${i+1}`, inputs:0, desc:`Swap top with ${i+2}nd stack item`, color:'#61dfff' }
  ])),
  // LOG0..LOG4
  ...Object.fromEntries(Array.from({length:5},(_,i)=>[
    (0xa0+i).toString(16).padStart(2,'0'),
    { name:`LOG${i}`, inputs:0, desc:`Append log with ${i} topic(s)`, color:'#9c27b0' }
  ])),
  'f0': { name:'CREATE',       inputs:0, desc:'Create new contract',                         color:'#e81899' },
  'f1': { name:'CALL',         inputs:0, desc:'Message-call into an account',                color:'#e81899' },
  'f2': { name:'CALLCODE',     inputs:0, desc:'Message-call with this code',                 color:'#e81899' },
  'f3': { name:'RETURN',       inputs:0, desc:'Halt and return output data',                  color:'#888' },
  'f4': { name:'DELEGATECALL', inputs:0, desc:'Delegate call (EIP-7)',                       color:'#e81899' },
  'f5': { name:'CREATE2',      inputs:0, desc:'Create with deterministic address (EIP-1014)',color:'#e81899' },
  'fa': { name:'STATICCALL',   inputs:0, desc:'Static call (no state change)',               color:'#e81899' },
  'fd': { name:'REVERT',       inputs:0, desc:'Halt, revert state, return data',             color:'#f44336' },
  'fe': { name:'INVALID',      inputs:0, desc:'Designated invalid instruction',              color:'#f44336' },
  'ff': { name:'SELFDESTRUCT', inputs:0, desc:'Destroy contract and send ETH',               color:'#f44336' },
};

// ── Known 4-byte selectors (expanded) ─────────────────────────────────
const KNOWN_4BYTE: Record<string, string> = {
  '06fdde03': 'name()',
  '95d89b41': 'symbol()',
  '313ce567': 'decimals()',
  '18160ddd': 'totalSupply()',
  '70a08231': 'balanceOf(address)',
  'a9059cbb': 'transfer(address,uint256)',
  '23b872dd': 'transferFrom(address,address,uint256)',
  '095ea7b3': 'approve(address,uint256)',
  'dd62ed3e': 'allowance(address,address)',
  '40c10f19': 'mint(address,uint256)',
  'a0712d68': 'mint(uint256)',
  '42966c68': 'burn(uint256)',
  '79cc6790': 'burnFrom(address,uint256)',
  '6352211e': 'ownerOf(uint256)',
  'c87b56dd': 'tokenURI(uint256)',
  'a22cb465': 'setApprovalForAll(address,bool)',
  'e985e9c5': 'isApprovedForAll(address,address)',
  'b88d4fde': 'safeTransferFrom(address,address,uint256,bytes)',
  '42842e0e': 'safeTransferFrom(address,address,uint256)',
  '8da5cb5b': 'owner()',
  'f2fde38b': 'transferOwnership(address)',
  '715018a6': 'renounceOwnership()',
  '5c975abb': 'paused()',
  '8456cb59': 'pause()',
  '3f4ba83a': 'unpause()',
  'd0e30db0': 'deposit()',
  '2e1a7d4d': 'withdraw(uint256)',
  '4e71d92d': 'claim()',
  '372500ab': 'claimRewards()',
  'a694fc3a': 'stake(uint256)',
  '2e17de78': 'unstake(uint256)',
  'e2bbb158': 'deposit(uint256,uint256)',
  '441a3e70': 'withdraw(uint256,uint256)',
  '1249c58b': 'mint()',
  '60806040': '(constructor / pragma pattern)',
  '3ccfd60b': 'withdraw()',
  'b6b55f25': 'deposit(uint256)',
  'f340fa01': 'deposit(address)',
  '0a19b14a': 'trade(address,uint256,address,uint256,address,uint256,bytes)',
  '38ed1739': 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
  '7ff36ab5': 'swapExactETHForTokens(uint256,address[],address,uint256)',
  '18cbafe5': 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)',
  'fb3bdb41': 'swapETHForExactTokens(uint256,address[],address,uint256)',
  '5c11d795': 'swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)',
  'e8e33700': 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)',
  'f305d719': 'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)',
  'baa2abde': 'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)',
  '02751cec': 'removeLiquidityETH(address,uint256,uint256,uint256,address,uint256)',
  'ac9650d8': 'multicall(bytes[])',
  '5ae401dc': 'multicall(uint256,bytes[])',
  '1f00ca74': 'getAmountsOut(uint256,address[])',
  'd06ca61f': 'getAmountsOut(uint256,address[])',
  'a67a6a45': 'swapExactInput(bytes,address,uint256)',
  '414bf389': 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
};

// ── Disassembler ──────────────────────────────────────────────────────
interface DisasmInstruction {
  offset: number;
  hex: string;
  op: string;
  operand?: string;
  desc: string;
  color: string;
  isPush: boolean;
}

function disassemble(hexInput: string): DisasmInstruction[] {
  const clean = hexInput.replace(/^0x/i, '').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (clean.length === 0 || clean.length % 2 !== 0) return [];
  const bytes: string[] = [];
  for (let i = 0; i < clean.length; i += 2) bytes.push(clean.slice(i, i + 2));

  const result: DisasmInstruction[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    const opInfo = EVM_OPCODES[b];
    const offset = i;
    if (!opInfo) {
      result.push({ offset, hex: b, op: 'UNKNOWN', desc: `Unknown opcode 0x${b}`, color: '#444', isPush: false });
      i++;
      continue;
    }
    // PUSH1..PUSH32 have inline operand bytes
    const pushMatch = opInfo.name.match(/^PUSH(\d+)$/);
    if (pushMatch) {
      const n = parseInt(pushMatch[1]);
      const operandBytes = bytes.slice(i + 1, i + 1 + n);
      const operand = operandBytes.join('');
      result.push({
        offset, hex: b, op: opInfo.name,
        operand: operand.length === n * 2 ? '0x' + operand : '0x(incomplete)',
        desc: opInfo.desc, color: opInfo.color, isPush: true,
      });
      i += 1 + n;
    } else {
      result.push({ offset, hex: b, op: opInfo.name, desc: opInfo.desc, color: opInfo.color, isPush: false });
      i++;
    }
  }
  return result;
}

// ── Function Signature Extractor ──────────────────────────────────────
interface DetectedFunc {
  selector: string;
  known: string | null;
  offset: number;
}

function extractFunctionSelectors(hexInput: string): DetectedFunc[] {
  const clean = hexInput.replace(/^0x/i, '').toLowerCase().replace(/[^0-9a-f]/g, '');
  const found: DetectedFunc[] = [];
  const seen = new Set<string>();

  // Scan for PUSH4 (0x63) followed by 4 bytes = likely a function selector comparison
  for (let i = 0; i < clean.length - 10; i += 2) {
    if (clean.slice(i, i + 2) === '63') { // PUSH4
      const sel = clean.slice(i + 2, i + 10);
      if (sel.length === 8 && !seen.has(sel) && !/^0{8}$/.test(sel) && !/^f{8}$/.test(sel)) {
        seen.add(sel);
        found.push({
          selector: sel,
          known: KNOWN_4BYTE[sel] ?? null,
          offset: i / 2,
        });
      }
    }
  }
  return found;
}

// ── String Extractor ──────────────────────────────────────────────────
function extractStrings(hexInput: string): string[] {
  const clean = hexInput.replace(/^0x/i, '').toLowerCase().replace(/[^0-9a-f]/g, '');
  const strings: string[] = [];
  // Look for printable ASCII sequences (length >= 4)
  let run = '';
  for (let i = 0; i < clean.length - 2; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (byte >= 0x20 && byte <= 0x7e) {
      run += String.fromCharCode(byte);
    } else {
      if (run.length >= 4) strings.push(run);
      run = '';
    }
  }
  if (run.length >= 4) strings.push(run);
  // Deduplicate and filter noise
  return [...new Set(strings)].filter(s => s.trim().length >= 4);
}

// ── Main Component ────────────────────────────────────────────────────
const BytecodeExplorer: React.FC = () => {
  const [input,      setInput]      = useState('');
  const [tab,        setTab]        = useState<'disasm'|'funcs'|'strings'>('disasm');
  const [filterOp,   setFilterOp]   = useState('');
  const [disasm,     setDisasm]     = useState<DisasmInstruction[]>([]);
  const [funcs,      setFuncs]      = useState<DetectedFunc[]>([]);
  const [strings,    setStrings]    = useState<string[]>([]);
  const [parsed,     setParsed]     = useState(false);
  const [error,      setError]      = useState('');
  const [showMax,    setShowMax]    = useState(500);

  const handleParse = () => {
    const clean = input.trim().replace(/\s/g, '');
    if (!clean) { setError('Masukkan bytecode hex dulu.'); return; }
    const hex = clean.replace(/^0x/i, '');
    if (hex.length % 2 !== 0) { setError('Bytecode tidak valid: panjang ganjil.'); return; }
    if (!/^[0-9a-fA-F]*$/.test(hex)) { setError('Bytecode mengandung karakter non-hex.'); return; }
    setError('');
    setDisasm(disassemble(clean));
    setFuncs(extractFunctionSelectors(clean));
    setStrings(extractStrings(clean));
    setParsed(true);
    setShowMax(500);
    setTab('disasm');
  };

  const handleClear = () => {
    setInput(''); setDisasm([]); setFuncs([]); setStrings([]);
    setParsed(false); setError(''); setFilterOp('');
  };

  const filteredDisasm = filterOp
    ? disasm.filter(d => d.op.toLowerCase().includes(filterOp.toLowerCase()))
    : disasm;

  const byteCount = input.replace(/^0x/i,'').replace(/\s/g,'').replace(/[^0-9a-fA-F]/g,'').length / 2;

  // Color groups for legend
  const legend = [
    { color:'#836efd', label:'PUSH' },
    { color:'#4caf50', label:'Arithmetic' },
    { color:'#2196f3', label:'Comparison / Logic' },
    { color:'#f3ba2f', label:'Environment' },
    { color:'#ff6600', label:'Block Info' },
    { color:'#00e676', label:'Memory' },
    { color:'#e91e63', label:'Storage' },
    { color:'#ff3333', label:'Jump' },
    { color:'#e81899', label:'Call / Create' },
    { color:'#61dfff', label:'DUP / SWAP' },
    { color:'#9c27b0', label:'SHA3 / LOG' },
    { color:'#f44336', label:'REVERT / INVALID' },
    { color:'#888',    label:'Misc' },
  ];

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: `2px solid ${active ? '#836efd' : 'transparent'}`,
    color: active ? '#836efd' : '#555',
    fontSize: '12px', fontWeight: active ? 'bold' : 'normal',
    transition: 'all 0.2s', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: '5px',
  });

  return (
    <div>
      <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:'2px solid #836efd', padding:'18px', marginBottom:'16px' }}>
        <h3 style={{ margin:'0 0 12px', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#836efd', display:'flex', alignItems:'center', gap:'6px' }}>
          <FaTerminal /> EVM Bytecode Explorer
        </h3>
        <textarea
          value={input}
          onChange={e => { setInput(e.target.value); setParsed(false); }}
          placeholder={"Paste bytecode hex di sini...\n\nContoh:\n0x608060405234801561001057600080fd5b50...\n\natau bytecode dari hasil kompilasi Solidity / on-chain contract."}
          rows={6}
          style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', resize:'vertical', background:'#070707', border:'1px solid #2a2a2a', color:'#aaa', padding:'10px' }}
        />
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginTop:'10px', flexWrap:'wrap' }}>
          <button onClick={handleParse} style={{ background:'#836efd', color:'#fff', border:'none', padding:'9px 20px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', display:'flex', alignItems:'center', gap:'6px' }}>
            <FaBolt /> Parse Bytecode
          </button>
          <button onClick={handleClear} style={{ background:'none', border:'1px solid #333', color:'#555', padding:'9px 16px', cursor:'pointer', fontSize:'12px' }}>
            Clear
          </button>
          {input.length > 0 && (
            <span style={{ fontSize:'11px', color:'#444', fontFamily:'monospace' }}>
              {Math.floor(byteCount).toLocaleString()} bytes · {input.replace(/^0x/i,'').replace(/\s/g,'').replace(/[^0-9a-fA-F]/g,'').length} hex chars
            </span>
          )}
        </div>
        {error && (
          <div style={{ marginTop:'10px', color:'#f44336', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
            <FaExclamationTriangle size={11}/> {error}
          </div>
        )}
      </div>

      {parsed && (
        <>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Total Instruksi', value: disasm.length.toLocaleString(),  color:'#836efd' },
              { label:'Fungsi Terdeteksi', value: funcs.length,                  color:'#f3ba2f' },
              { label:'String Terdeteksi', value: strings.length,               color:'#4caf50' },
              { label:'Ukuran',            value: `${Math.floor(byteCount).toLocaleString()} bytes`, color:'#01a2ff' },
            ].map(s => (
              <div key={s.label} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${s.color}`, padding:'12px 16px', flex:1, minWidth:'120px' }}>
                <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{s.label}</div>
                <div style={{ fontFamily:'monospace', fontWeight:'bold', fontSize:'18px', color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:'2px', borderBottom:'1px solid #1e1e1e', marginBottom:'16px', overflowX:'auto' }}>
            <button style={tabBtnStyle(tab==='disasm')} onClick={() => setTab('disasm')}>
              <FaList /> Disassembly ({disasm.length})
            </button>
            <button style={tabBtnStyle(tab==='funcs')} onClick={() => setTab('funcs')}>
              <FaCode /> Fungsi ({funcs.length})
            </button>
            <button style={tabBtnStyle(tab==='strings')} onClick={() => setTab('strings')}>
              <FaFileCode /> Strings ({strings.length})
            </button>
          </div>

          {tab === 'disasm' && (
            <>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'12px' }}>
                {legend.map(l => (
                  <span key={l.label} style={{ fontSize:'10px', color:l.color, border:`1px solid ${l.color}33`, background:`${l.color}11`, padding:'2px 7px' }}>
                    {l.label}
                  </span>
                ))}
              </div>

              <div style={{ marginBottom:'12px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <div className="search-input-wrapper" style={{ flex:1, minWidth:'160px' }}>
                  <FaSearch className="search-icon" />
                  <input type="search" placeholder="Filter opcode (PUSH, CALL, JUMP...)" value={filterOp} onChange={e => { setFilterOp(e.target.value); setShowMax(500); }} />
                </div>
                {filterOp && (
                  <span style={{ fontSize:'11px', color:'#555' }}>{filteredDisasm.length} hasil</span>
                )}
              </div>

              <div style={{ background:'#070707', border:'1px solid #1a1a1a', fontFamily:'monospace', fontSize:'12px', maxHeight:'60vh', overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'70px 30px 120px 1fr', gap:'0', borderBottom:'1px solid #1a1a1a', padding:'6px 12px', fontSize:'10px', color:'#333', textTransform:'uppercase', letterSpacing:'1px', position:'sticky', top:0, background:'#0a0a0a' }}>
                  <span>OFFSET</span>
                  <span>HEX</span>
                  <span>OPCODE</span>
                  <span>OPERAND / DESC</span>
                </div>
                {filteredDisasm.slice(0, showMax).map((ins, idx) => (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:'70px 30px 120px 1fr', gap:'0', padding:'4px 12px', borderBottom:'1px solid #0f0f0f', transition:'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background='#111')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <span style={{ color:'#333' }}>{ins.offset.toString(16).padStart(4,'0')}</span>
                    <span style={{ color:'#2a2a2a' }}>{ins.hex}</span>
                    <span style={{ color: ins.color, fontWeight:'bold' }}>{ins.op}</span>
                    <span style={{ color: ins.operand ? '#aaa' : '#2a2a2a', wordBreak:'break-all' }}>
                      {ins.operand
                        ? <><span style={{ color:'#fff' }}>{ins.operand}</span>{' '}<span style={{ color:'#333', fontSize:'10px' }}>// {ins.desc}</span></>
                        : <span style={{ fontSize:'10px' }}>{ins.desc}</span>
                      }
                    </span>
                  </div>
                ))}
                {filteredDisasm.length > showMax && (
                  <div style={{ padding:'12px', textAlign:'center' }}>
                    <button onClick={() => setShowMax(n => n + 500)} style={{ background:'none', border:'1px solid #333', color:'#555', padding:'6px 16px', cursor:'pointer', fontSize:'11px' }}>
                      Tampilkan 500 instruksi lagi ({(filteredDisasm.length - showMax).toLocaleString()} tersisa)
                    </button>
                  </div>
                )}
                {filteredDisasm.length === 0 && (
                  <div style={{ padding:'24px', textAlign:'center', color:'#333' }}>Tidak ada instruksi yang cocok.</div>
                )}
              </div>
            </>
          )}

          {tab === 'funcs' && (
            <div>
              <p style={{ fontSize:'12px', color:'#555', marginBottom:'12px' }}>
                Selector 4-byte yang ditemukan dalam bytecode (via PUSH4). Selector yang dikenal dicocokkan dengan database fungsi umum.
              </p>
              {funcs.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', color:'#333', border:'1px dashed #1a1a1a' }}>
                  Tidak ada function selector yang terdeteksi.
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:'10px' }}>
                  {funcs.map((f, i) => (
                    <div key={i} style={{ background:'#0d0d0d', border:`1px solid ${f.known ? '#f3ba2f44' : '#1e1e1e'}`, borderLeft:`3px solid ${f.known ? '#f3ba2f' : '#333'}`, padding:'12px 16px', display:'flex', flexDirection:'column', gap:'6px' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <code style={{ fontFamily:'monospace', fontSize:'13px', color:'#836efd', fontWeight:'bold' }}>0x{f.selector}</code>
                        <span style={{ fontSize:'10px', color:'#333' }}>offset: 0x{f.offset.toString(16)}</span>
                      </div>
                      {f.known ? (
                        <div style={{ fontSize:'12px', color:'#f3ba2f', fontFamily:'monospace' }}>{f.known}</div>
                      ) : (
                        <div style={{ fontSize:'11px', color:'#333', fontStyle:'italic' }}>
                          Unknown selector — cek di{' '}
                          <a href={`https://www.4byte.directory/signatures/?bytes4_signature=0x${f.selector}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>4byte.directory</a>
                          {' '}atau{' '}
                          <a href={`https://sig.eth.samczsun.com/api/v1/signatures?function=0x${f.selector}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>sig.eth</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop:'16px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'12px 20px', flex:1, minWidth:'120px', textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'#555', marginBottom:'4px', textTransform:'uppercase' }}>Teridentifikasi</div>
                  <div style={{ fontSize:'22px', fontWeight:'bold', color:'#f3ba2f', fontFamily:'monospace' }}>{funcs.filter(f=>f.known).length}</div>
                </div>
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'12px 20px', flex:1, minWidth:'120px', textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'#555', marginBottom:'4px', textTransform:'uppercase' }}>Tidak Dikenal</div>
                  <div style={{ fontSize:'22px', fontWeight:'bold', color:'#333', fontFamily:'monospace' }}>{funcs.filter(f=>!f.known).length}</div>
                </div>
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'12px 20px', flex:1, minWidth:'120px', textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'#555', marginBottom:'4px', textTransform:'uppercase' }}>Total Selector</div>
                  <div style={{ fontSize:'22px', fontWeight:'bold', color:'#836efd', fontFamily:'monospace' }}>{funcs.length}</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'strings' && (
            <div>
              <p style={{ fontSize:'12px', color:'#555', marginBottom:'12px' }}>
                String ASCII yang ditemukan dalam bytecode (panjang ≥ 4). Biasanya berisi error messages, token names, atau metadata kontrak.
              </p>
              {strings.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', color:'#333', border:'1px dashed #1a1a1a' }}>
                  Tidak ada string yang terdeteksi.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {strings.map((s, i) => (
                    <div key={i} style={{ background:'#0d0d0d', border:'1px solid #1a1a1a', padding:'8px 14px', display:'flex', alignItems:'center', gap:'12px', fontFamily:'monospace' }}>
                      <span style={{ fontSize:'10px', color:'#333', minWidth:'30px' }}>{i + 1}</span>
                      <span style={{ fontSize:'12px', color:'#4caf50', wordBreak:'break-all', flex:1 }}>{s}</span>
                      <span style={{ fontSize:'10px', color:'#333', whiteSpace:'nowrap' }}>{s.length} chars</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════

export const WalletGenerator: React.FC = () => {

  const [wallets,  setWallets]  = useState<BIP39Wallet[]>(() => {
    try { return JSON.parse(localStorage.getItem('bip39Wallets') || '[]'); } catch { return []; }
  });
  const [networks, setNetworks] = useState<RPCNetwork[]>(() => {
    try {
      const s = localStorage.getItem('rpcNetworks');
      return s ? JSON.parse(s) : DEFAULT_NETWORKS;
    } catch { return DEFAULT_NETWORKS; }
  });
  const [airdropTasks, setAirdropTasks] = useState<AirdropTask[]>(() => {
    try { return JSON.parse(localStorage.getItem('walletAirdropTasks') || '[]'); } catch { return []; }
  });

  const [activeTab,      setActiveTab]      = useState<'wallets'|'transfer'|'garap'|'networks'|'bytecode'>('wallets');
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

  const txProviderRef   = useRef<ethers.providers.JsonRpcProvider | null>(null);
  const txWalletRef     = useRef<ethers.Wallet | null>(null);
  const garapImportRef  = useRef<HTMLInputElement>(null);

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

  // ── TOS Modal state ──────────────────────────────────────────────
  const [tosAgreed,       setTosAgreed]       = useState<boolean>(() => localStorage.getItem('tosAgreed') === 'true');
  const [tosChecked,      setTosChecked]      = useState<boolean[]>([false, false, false, false]);
  const tosAllChecked = tosChecked.every(Boolean);

  const handleTosAgree = () => {
    if (!tosAllChecked) return;
    localStorage.setItem('tosAgreed', 'true');
    setTosAgreed(true);
  };

  // ── Multi Balance Checker state ──────────────────────────────────
  const [balCheckNetId,   setBalCheckNetId]   = useState<string>('ethereum');
  const [balResults,      setBalResults]      = useState<Record<string, { balance: string; loading: boolean; error: boolean }>>({});
  const [balChecking,     setBalChecking]     = useState(false);

  // ── QR Code modal state ──────────────────────────────────────────
  const [qrAddress,       setQrAddress]       = useState<string | null>(null);

  // ── CSV Export state ─────────────────────────────────────────────
  const [csvExporting,    setCsvExporting]    = useState(false);

  // ── Auto Garap state ──────────────────────────────────
  const [agQueue,       setAgQueue]       = useState<TxQueueItem[]>(() => { try { return JSON.parse(localStorage.getItem(TX_QUEUE_KEY) || '[]'); } catch { return []; } });
  const [agHistory,     setAgHistory]     = useState<TxQueueItem[]>(() => { try { return JSON.parse(localStorage.getItem(TX_HISTORY_KEY) || '[]'); } catch { return []; } });
  const [agRunning,     setAgRunning]     = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const agStopRef = React.useRef(false);
  const [agSimMode,     setAgSimMode]     = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agGasPrice,    setAgGasPrice]    = useState('');
  const [agGasLimit,    setAgGasLimit]    = useState('200000'); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agTab,         setAgTab]         = useState<'queue'|'builder'|'reader'|'history'>('queue'); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agLog,         setAgLog]         = useState<string[]>([]);
  const agLogRef = React.useRef<HTMLDivElement>(null);
  const [agExpanded,    setAgExpanded]    = useState<string|null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agContract,    setAgContract]    = useState<AutoContractCall>({ contractAddress:'', abi:'', functionName:'', args:'[]', value:'0' }); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agCalldata,    setAgCalldata]    = useState(''); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agTpl,         setAgTpl]         = useState(''); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agReadC,       setAgReadC]       = useState({ address:'', abi:'', func:'', args:'[]' }); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agReadResult,  setAgReadResult]  = useState(''); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agReading,     setAgReading]     = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agTaskSel,     setAgTaskSel]     = useState(''); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agSuggest,     setAgSuggest]     = useState<string[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars

  // ── Garap Hub execution panel state ──────────────────────────────
  const [execTaskId,    setExecTaskId]    = useState<string|null>(null);   // which task is open
  const [execNetId,     setExecNetId]     = useState<string>('sepolia');
  const [execWalSel,    setExecWalSel]    = useState<string>('');           // "walletIdx,addrIdx"
  const [execPrivKey,   setExecPrivKey]   = useState<string>('');
  const [execRunning,   setExecRunning]   = useState(false);
  const [execLog,       setExecLog]       = useState<string[]>([]);
  // per-task contract config (ephemeral, filled from task fields or overridden in UI)
  const [execContract,  setExecContract]  = useState<{
    contractAddress: string; contractAbi: string; contractFunc: string;
    contractArgs: string; ethValue: string;
  }>({ contractAddress:'', contractAbi:'', contractFunc:'', contractArgs:'[]', ethValue:'0' });
  const [execMode,      setExecMode]      = useState<'contract'|'raw'>('contract'); // contract call vs raw ETH send
  const [execRawTo,     setExecRawTo]     = useState('');
  const [execRawVal,    setExecRawVal]    = useState('0');
  const [execRawData,   setExecRawData]   = useState('0x');
  const [execGasLimit,  setExecGasLimit]  = useState('');   // manual override, empty = auto-estimate
  const [execSimFailed, setExecSimFailed] = useState(false); // true = estimateGas reverted, warn user

  // \u2500\u2500 Batch execution modal state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const [batchModalOpen,   setBatchModalOpen]   = useState(false);
  const [batchNetId,       setBatchNetId]       = useState<string>('sepolia');
  // Multi-wallet support
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
  const [batchLoopMax,     setBatchLoopMax]     = useState(0);       // 0 = infinite
  const [batchLoopDelay,   setBatchLoopDelay]   = useState(5000);    // ms between rounds
  const [batchLoopRound,   setBatchLoopRound]   = useState(0);       // current round (1-based)
  const [batchRetryFailed, setBatchRetryFailed] = useState(false);   // auto-retry gagal
  const [batchRetryMax,    setBatchRetryMax]    = useState(3);        // max retry per task
  const [batchRetryDelay,  setBatchRetryDelay]  = useState(2000);     // ms sebelum retry
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
    const net = networks.find(n => n.id === batchNetId);
    if (!net) { batchAddLog('Network tidak valid.', 'err'); return; }
    setBatchRunning(true);
    setBatchDone(false);
    batchStopRef.current = false;
    setBatchLoopRound(0);
    setBatchProgress({ walDone:0, walTotal:batchWallets.length, taskDone:0, taskTotal:tasks.length, currentWal:'', currentTask:'' });

    batchAddLog(`Menghubungkan ke ${net.name}...`, 'info');
    let provider: ethers.providers.JsonRpcProvider;
    try {
      provider = await getProvider(net);
      batchAddLog(`Terhubung ke ${net.name}`, 'ok');
    } catch (e: any) {
      batchAddLog(`Gagal connect: ${e.message}`, 'err');
      setBatchRunning(false);
      return;
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

    // ── Outer loop (rounds) ──────────────────────────────────────────
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

      // ── Wallet loop ──────────────────────────────────────────────
      for (let wi = 0; wi < batchWallets.length; wi++) {
        if (batchStopRef.current) break;
        const bw = batchWallets[wi];
        setBatchProgress(p => ({ ...p, walDone: wi, walTotal: batchWallets.length, currentWal: bw.label, taskDone: 0, taskTotal: tasks.length, currentTask: '' }));

        let ethWallet: ethers.Wallet;
        try {
          ethWallet = new ethers.Wallet(bw.privateKey, provider);
          batchAddLog(`
👛 Wallet [${wi+1}/${batchWallets.length}]: ${bw.address.slice(0,10)}…${bw.address.slice(-4)}`, 'info');
        } catch (e: any) {
          batchAddLog(`❌ Wallet ${wi+1} invalid: ${e.message}`, 'err');
          continue;
        }

      setBatchProgress(p => ({ ...p, taskDone: 0, taskTotal: tasks.length, currentTask: '' }));

      // ── Inner task loop ──────────────────────────────────────────
      for (let i = 0; i < tasks.length; i++) {
        if (batchStopRef.current) { batchAddLog('⛔ Dihentikan oleh user.', 'warn'); break; }
        const task = tasks[i];
        setBatchProgress(p => ({ ...p, taskDone: i, taskTotal: tasks.length, currentTask: task.projectName }));

        const maxAttempts = batchRetryFailed ? 1 + batchRetryMax : 1;
        let taskSuccess = false;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (batchStopRef.current) break;

          const attemptLabel = maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : '';
          batchAddLog(`  [Task ${i+1}/${tasks.length}] ${task.projectName}${attemptLabel}`, 'info');

          try {
            let txRequest: ethers.providers.TransactionRequest = {};
            if (task.contractAddress) {
              if (task.contractAbi && task.contractFunc) {
                const iface = new ethers.utils.Interface(JSON.parse(task.contractAbi));
                const args  = JSON.parse(task.contractArgs || '[]');
                const data  = iface.encodeFunctionData(task.contractFunc, args);
                txRequest = {
                  to: task.contractAddress,
                  value: task.ethValue && task.ethValue !== '0' ? ethers.utils.parseEther(task.ethValue) : ethers.BigNumber.from(0),
                  data,
                };
                batchAddLog(`  Func: ${task.contractFunc}(${args.join(', ')})`, 'info');
              } else {
                txRequest = { to: task.contractAddress, value: ethers.BigNumber.from(0), data: '0x' };
              }
            } else {
              batchAddLog(`  Skip — tidak ada contract address`, 'warn');
              taskSuccess = true; // skip bukan failure
              break;
            }

            if (batchStopRef.current) { batchAddLog('⛔ Dihentikan oleh user.', 'warn'); break; }

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

            if (batchStopRef.current) { batchAddLog('⛔ Dihentikan oleh user.', 'warn'); break; }

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

            if (batchStopRef.current) { batchAddLog('⛔ TX dikonfirmasi tapi batch dihentikan.', 'warn'); break; }

            batchAddLog(`  ✅ Confirmed block #${receipt.blockNumber}${attempt > 1 ? ` (setelah ${attempt} attempt)` : ''}`, 'ok');
            roundSuccess++;
            taskSuccess = true;
            setAirdropTasks(prev => prev.map(t => t.id === task.id
              ? { ...t, txHash: tx.hash, walletAddress: ethWallet.address, status: 'done', doneAt: Date.now() }
              : t
            ));
            saveTxHistory({
              taskName: task.projectName,
              description: `[BATCH${isLooping ? ` R${round}`:''}] ${task.taskType.toUpperCase()} · ${task.network || net.name} · block #${receipt.blockNumber}`,
              to: task.contractAddress || '',
              value: task.ethValue || '0',
              data: '0x',
              status: 'success',
              txHash: tx.hash,
              timestamp: Date.now(),
            });
            if (net.explorerUrl) batchAddLog(`  ${net.explorerUrl}/tx/${tx.hash}`, 'info');
            break; // sukses, keluar dari retry loop
          } catch (e: any) {
            const msg: string = e?.message ?? String(e);
            if (msg === '__STOPPED__') {
              batchAddLog('⛔ Dihentikan saat menunggu konfirmasi TX.', 'warn');
              break;
            }
            let friendly = msg;
            if (msg.includes('insufficient funds')) friendly = 'Saldo tidak cukup';
            else if (msg.includes('nonce')) friendly = 'Nonce error';
            else if (msg.includes('timeout') || msg.includes('network')) friendly = 'Timeout/RPC error';
            batchAddLog(`  GAGAL: ${friendly.slice(0, 100)}`, 'err');

            if (batchRetryFailed && attempt < maxAttempts && !batchStopRef.current) {
              batchAddLog(`  🔄 Retry ${attempt}/${batchRetryMax} dalam ${batchRetryDelay}ms...`, 'warn');
              await interruptibleDelay(batchRetryDelay);
            } else {
              roundFail++;
              setAirdropTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'failed' } : t));
            }
          }
        } // end retry loop

        if (batchStopRef.current) { batchAddLog('⛔ Dihentikan oleh user.', 'warn'); break; }

        if (!taskSuccess && batchRetryFailed) {
          batchAddLog(`  ❌ Task "${task.projectName}" gagal setelah ${maxAttempts} attempt.`, 'err');
        }

        if (i < tasks.length - 1 && !batchStopRef.current && batchDelayMs > 0 && taskSuccess) {
          batchAddLog(`  Delay ${batchDelayMs}ms...`, 'info');
          await interruptibleDelay(batchDelayMs);
        }
        setBatchProgress(p => ({ ...p, taskDone: i + 1 }));
      }
      // ── End inner task loop ──────────────────────────────────────

        // delay between wallets (except after last wallet)
        if (wi < batchWallets.length - 1 && !batchStopRef.current && batchWalDelay > 0) {
          batchAddLog(`⏳ Jeda ${batchWalDelay / 1000}s sebelum wallet berikutnya...`, 'info');
          await interruptibleDelay(batchWalDelay);
        }

        setBatchProgress(p => ({ ...p, walDone: wi + 1 }));
      }
      // ── End wallet loop ──────────────────────────────────────────

      totalSuccess += roundSuccess;
      totalFail    += roundFail;

      if (isLooping) {
        batchAddLog(`Round ${round} selesai — Sukses: ${roundSuccess} | Gagal: ${roundFail} | Total: ${totalSuccess}✅ ${totalFail}❌`, roundSuccess > 0 ? 'ok' : 'warn');
      }

      // Stop if user clicked stop
      if (batchStopRef.current) break;

      // Stop if not looping
      if (!isLooping) break;

      // Stop if max rounds reached
      if (maxRounds > 0 && round >= maxRounds) {
        batchAddLog(`✅ Selesai ${maxRounds} round.`, 'ok');
        break;
      }

      // Delay before next round
      if (batchLoopDelay > 0) {
        batchAddLog(`⏳ Jeda ${batchLoopDelay / 1000}s sebelum round ${round + 1}...`, 'info');
        await interruptibleDelay(batchLoopDelay);
        if (batchStopRef.current) break;
      }
    }
    // ── End outer loop ───────────────────────────────────────────────

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
    if (!execPrivKey) { execAddLog('❌ Pilih wallet / masukkan private key.'); return; }
    const net = networks.find(n => n.id === execNetId);
    if (!net) { execAddLog('❌ Network tidak valid.'); return; }

    setExecRunning(true);
    setExecSimFailed(false);
    execAddLog(`🌐 Menghubungkan ke ${net.name}...`);

    try {
      const provider = await getProvider(net);
      const wallet   = new ethers.Wallet(execPrivKey, provider);
      execAddLog(`✅ Terhubung: ${wallet.address}`);

      // ── Build txRequest ────────────────────────────────────────────
      let txRequest: ethers.providers.TransactionRequest = {};

      if (execMode === 'contract' && execContract.contractAddress) {
        execAddLog(`📝 Mempersiapkan contract call ke ${shortAddr(execContract.contractAddress)}...`);
        if (execContract.contractAbi && execContract.contractFunc) {
          try {
            const iface = new ethers.utils.Interface(JSON.parse(execContract.contractAbi));
            const args  = JSON.parse(execContract.contractArgs || '[]');
            const data  = iface.encodeFunctionData(execContract.contractFunc, args);
            txRequest = {
              to:    execContract.contractAddress,
              value: execContract.ethValue && execContract.ethValue !== '0'
                       ? ethers.utils.parseEther(execContract.ethValue)
                       : ethers.BigNumber.from(0),
              data,
            };
            execAddLog(`⚙️  Func: ${execContract.contractFunc}(${args.join(', ')})`);
          } catch (e: any) {
            execAddLog(`❌ ABI encode error: ${e.message}`);
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
        if (!execRawTo) { execAddLog('❌ Masukkan address tujuan.'); setExecRunning(false); return; }
        txRequest = {
          to:    execRawTo,
          value: ethers.utils.parseEther(execRawVal || '0'),
          data:  execRawData || '0x',
        };
        execAddLog(`💸 Mengirim ${execRawVal} ${net.symbol} ke ${shortAddr(execRawTo)}`);
      }

      // ── Gas estimation ─────────────────────────────────────────────
      if (execGasLimit && parseInt(execGasLimit) > 0) {
        // User provided manual override — skip simulation entirely
        txRequest.gasLimit = ethers.BigNumber.from(execGasLimit);
        execAddLog(`⛽ Gas limit manual: ${parseInt(execGasLimit).toLocaleString()}`);
      } else {
        execAddLog('⛽ Estimasi gas...');
        try {
          const estimated = await wallet.estimateGas(txRequest);
          // Add 20% buffer
          const withBuffer = estimated.mul(120).div(100);
          txRequest.gasLimit = withBuffer;
          execAddLog(`⛽ Gas: ~${estimated.toNumber().toLocaleString()} (+20% buffer → ${withBuffer.toNumber().toLocaleString()})`);
        } catch (gasErr: any) {
          // Detect revert vs generic failure
          const msg: string = gasErr?.message ?? '';
          const isRevert  = msg.includes('execution reverted') || msg.includes('UNPREDICTABLE_GAS_LIMIT') || msg.includes('revert');
          const reason    = gasErr?.error?.reason ?? gasErr?.reason ?? '';

          setExecSimFailed(true);

          if (isRevert) {
            execAddLog(`⚠️  Simulasi TX REVERT${reason ? ` — "${reason}"` : ''}`);
            execAddLog(`💡 Kemungkinan penyebab: saldo tidak cukup, arg salah, state kontrak tidak sesuai.`);
            execAddLog(`💡 Set gas limit manual di atas lalu coba lagi, atau periksa konfigurasi.`);
          } else {
            execAddLog(`⚠️  Gas estimasi gagal: ${msg.slice(0, 120)}`);
            execAddLog(`💡 Set gas limit manual (misal: 200000) untuk force-send.`);
          }

          setExecRunning(false);
          return; // stop — don't send a tx that will definitely fail
        }
      }

      // ── Send ──────────────────────────────────────────────────────
      execAddLog('🚀 Mengirim transaksi...');
      const tx = await wallet.sendTransaction(txRequest);
      execAddLog(`📨 TX terkirim! Hash: ${tx.hash}`);

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
      execAddLog(`✅ DIKONFIRMASI di block #${receipt.blockNumber}!`);
      setExecSimFailed(false);
      showAlert(`TX "${task.projectName}" berhasil! Block #${receipt.blockNumber}`, 'success');

      // ── Save to TX history ─────────────────────────────────────────
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
      const msg: string = e?.message ?? String(e);
      // Decode common ethers errors into friendly messages
      let friendly = msg;
      if (msg.includes('UNPREDICTABLE_GAS_LIMIT'))
        friendly = 'TX akan revert di kontrak. Periksa args, saldo, dan state kontrak.';
      else if (msg.includes('insufficient funds'))
        friendly = 'Saldo ETH tidak cukup untuk gas + value.';
      else if (msg.includes('nonce'))
        friendly = 'Nonce error — mungkin ada TX pending sebelumnya.';
      else if (msg.includes('replacement fee too low'))
        friendly = 'Gas price terlalu rendah untuk menggantikan TX pending.';
      else if (msg.includes('timeout') || msg.includes('network'))
        friendly = 'Timeout / RPC error — coba lagi atau ganti RPC.';

      execAddLog(`❌ GAGAL: ${friendly}`);
      if (friendly !== msg) execAddLog(`   Detail: ${msg.slice(0, 200)}`);
      setAirdropTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'failed' } : t));
      showAlert(`TX gagal: ${friendly}`, 'error');
    }
    setExecRunning(false);
  };
  // MetaMask connect for Auto Garap
  const [agWallet,      setAgWallet]      = useState({ address:'', chainId:0, chainName:'', balance:'0', connected:false });
  const [agConnecting,  setAgConnecting]  = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  // Raw TX builder state
  const [agRawTo,       setAgRawTo]       = useState(''); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agRawVal,      setAgRawVal]      = useState('0'); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agRawData,     setAgRawData]     = useState('0x'); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agRawDesc,     setAgRawDesc]     = useState(''); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [agRawTask,     setAgRawTask]     = useState('Manual'); // eslint-disable-line @typescript-eslint/no-unused-vars

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
    if (!prov) { agAddLog('❌ MetaMask tidak ditemukan. Install dulu.'); return; }
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
      agAddLog(`✅ Terhubung: ${shortAddr(address)} | ${cName} | ${balance} ETH`);
      try {
        const gp: string = await prov.request({ method:'eth_gasPrice' });
        setAgGasPrice((Number(BigInt(gp)) / 1e9).toFixed(2));
      } catch {}
    } catch (e: any) { agAddLog(`❌ Gagal: ${e?.message ?? e}`); }
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
      agAddLog(`🌐 Pindah ke ${net.name}`);
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
        } catch (ae: any) { agAddLog(`❌ Gagal tambah network: ${ae?.message}`); }
      } else { agAddLog(`❌ Gagal switch: ${e?.message}`); }
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
    if (!agWallet.connected && !agSimMode) { agAddLog('❌ Hubungkan MetaMask atau aktifkan Sim Mode.'); return; }
    setAgRunning(true); agStopRef.current = false;
    const pending = agQueue.filter(q => q.status === 'pending');
    agAddLog(`▶️ Menjalankan ${pending.length} TX pending...`);
    for (let i = 0; i < agQueue.length; i++) {
      if (agStopRef.current) { agAddLog('⛔ Dihentikan.'); break; }
      const item = agQueue[i];
      if (item.status !== 'pending') continue;
      setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status:'running' } : q));
      agAddLog(`🚀 TX: ${item.description} → ${shortAddr(item.to)}`);
      try {
        if (agWallet.connected && !agSimMode) {
          const est = await agEstimateGas(item);
          setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, gasEstimate: est } : q));
          agAddLog(`   ⛽ Gas: ${est}`);
        }
        await new Promise(r => setTimeout(r, 600));
        if (agSimMode) {
          const fakeHash = '0x' + Array.from({length:64}, () => Math.floor(Math.random()*16).toString(16)).join('');
          setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status:'success', txHash:fakeHash, timestamp:Date.now() } : q));
          agAddLog(`   ✅ [SIM] ${fakeHash.slice(0,18)}...`);
        } else {
          const hash = await agSendTx(item);
          setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status:'success', txHash:hash, timestamp:Date.now() } : q));
          setAgHistory(prev => [{ ...item, status:'success', txHash:hash, timestamp:Date.now() }, ...prev.slice(0,299)]);
          agAddLog(`   ✅ Hash: ${hash.slice(0,18)}...`);
        }
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setAgQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status:'failed', error:msg } : q));
        agAddLog(`   ❌ ${msg.slice(0,100)}`);
      }
      await new Promise(r => setTimeout(r, 600));
    }
    setAgRunning(false); agAddLog('✅ Queue selesai.');
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
    if (!prov) { setAgReadResult('❌ Wallet tidak terhubung'); return; }
    setAgReading(true); setAgReadResult('');
    try {
      const fd = parseAbiFunc(agReadC.abi, agReadC.func);
      if (!fd) throw new Error('Fungsi tidak ditemukan');
      const vals = JSON.parse(agReadC.args);
      const types = fd.inputs.map((i: any) => i.type);
      const data = encodeAutoAbi(`${fd.name}(${types.join(',')})`, types, vals);
      const res: string = await prov.request({ method:'eth_call', params:[{ to:agReadC.address, data },'latest'] });
      setAgReadResult(res);
    } catch (e: any) { setAgReadResult(`❌ ${e?.message}`); }
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

  // ── Multi Balance Checker logic ──────────────────────────────────
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

  // ── QR Code generator (pure canvas, no external lib) ─────────────
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
      // simple deterministic pattern based on address chars
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
      // finder patterns (corners)
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

  // ── CSV Batch Export ──────────────────────────────────────────────
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
      for (let i = 0; i < addressCount; i++) {
        const { address, privateKey } = deriveAddress(mnemonic, i);
        addresses.push({ index: i, address, privateKey });
      }
      const newWallet: BIP39Wallet = {
        id: Date.now().toString(), name: walletName.trim() || `Wallet #${wallets.length + 1}`,
        mnemonic, addresses, createdAt: Date.now(), tags: [], note: '',
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
      for (let i = 0; i <= nextIndex; i++) {
        if (!existing.has(i)) {
          const { address, privateKey } = deriveAddress(w.mnemonic, i);
          newAddrs.push({ index: i, address, privateKey });
        }
      }
      newAddrs.sort((a, b) => a.index - b.index);
      setWallets(prev => prev.map(x => x.id === walletId ? { ...x, addresses: newAddrs } : x));
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

  // ── Export / Import Garap Hub tasks ─────────────────────────────
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

  // ── Save TX to history helper ────────────────────────────────────
  const saveTxHistory = (entry: Omit<TxQueueItem, 'id'>) => {
    const histEntry: TxQueueItem = { ...entry, id: Date.now().toString() + Math.random().toString(36).slice(2) };
    setAgHistory(prev => [histEntry, ...prev.slice(0, 499)]);
  };

  const filteredWallets = wallets.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.addresses.some(a => a.address.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedNetwork = networks.find(n => n.id === txNetworkId) ?? networks[0];

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

  const txSend = async () => {
    const wallet = txWalletRef.current;
    if (!wallet) return;
    if (!ethers.utils.isAddress(txSendTo)) { showAlert('Address tujuan tidak valid.', 'error'); return; }
    const amt = parseFloat(txSendAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('Jumlah tidak valid.', 'error'); return; }
    setTxSending(true);
    setTxStatus({ type: 'pending', msg: `Mengirim transaksi ke ${selectedNetwork?.name}...` });
    try {
      const tx = await wallet.sendTransaction({
        to: txSendTo, value: ethers.utils.parseEther(txSendAmt),
      });
      setTxStatus({ type: 'pending', msg: 'Tx terkirim! Menunggu konfirmasi...', hash: tx.hash });
      const receipt = await tx.wait();
      setTxStatus({ type: 'success', msg: `Dikonfirmasi di block #${receipt.blockNumber}`, hash: tx.hash });
      saveTxHistory({
        taskName: 'Transfer',
        description: `Kirim ${txSendAmt} ${selectedNetwork?.symbol ?? 'ETH'} ke ${shortAddr(txSendTo)} di ${selectedNetwork?.name ?? ''}`,
        to: txSendTo,
        value: txSendAmt,
        data: '0x',
        status: 'success',
        txHash: tx.hash,
        timestamp: Date.now(),
      });
      setTxSendTo(''); setTxSendAmt('');
      await txRefreshBalance();
    } catch (e: any) { setTxStatus({ type: 'error', msg: e.message }); }
    setTxSending(false);
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

  return (
    <div className="app-container">
      <CustomAlert isOpen={alertData.isOpen} message={alertData.msg} type={alertData.type}
        onClose={() => setAlertData(p => ({ ...p, isOpen: false }))} />
      <CustomConfirm isOpen={confirmData.isOpen} title={confirmData.title} message={confirmData.message}
        onCancel={() => setConfirmData(p => ({ ...p, isOpen: false }))}
        onConfirm={() => { confirmData.action?.(); setConfirmData(p => ({ ...p, isOpen: false })); }} />

      {qrAddress && <QRModal address={qrAddress} onClose={() => setQrAddress(null)} />}

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
                <button onClick={() => { setBatchModalOpen(false); setBatchLog([]); setBatchDone(false); setBatchProgress({walDone:0,walTotal:0,taskDone:0,taskTotal:0,currentWal:'',currentTask:''}); }}
                  style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>✕</button>
              )}
            </div>

            {/* Config — only shown before running */}
            {!batchRunning && !batchDone && (
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #1a1a1a', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
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
                    Network
                  </label>
                  <select value={batchNetId} onChange={e => setBatchNetId(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'11px' }}>
                    {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
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

                <div style={{ gridColumn:'1/-1' }}>
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
              </div>
            )}

            {/* Progress bar — shown while running or done */}
            {(batchRunning || batchDone) && (
              <div style={{ padding:'12px 20px', borderBottom:'1px solid #1a1a1a', background:'#070707' }}>
                {/* Wallet progress */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <span style={{ fontSize:'11px', color:'#01a2ff' }}>
                    👛 {batchDone ? 'Selesai' : (batchProgress.currentWal || 'Memulai...')}
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
                    {batchDone ? '✅ Selesai!' : `⚡ ${batchProgress.currentTask || 'Memulai...'}`}
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
                    <button onClick={() => { batchStopRef.current = true; batchAddLog('⛔ Menghentikan setelah TX saat ini...', 'warn'); }}
                      disabled={batchStopRef.current}
                      style={{ background: batchStopRef.current ? '#1a1a1a' : '#2a0a0a', border:`1px solid ${batchStopRef.current ? '#444' : '#f44336'}`, color: batchStopRef.current ? '#555' : '#f44336', padding:'6px 14px', cursor: batchStopRef.current ? 'not-allowed' : 'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                      <FaSpinner style={{ animation:'spin 1s linear infinite' }} size={11}/> {batchStopRef.current ? 'Menghentikan...' : 'Stop'}
                    </button>
                  )}
                  {batchDone && (
                    <button onClick={() => { setBatchModalOpen(false); setBatchLog([]); setBatchDone(false); setBatchProgress({walDone:0,walTotal:0,taskDone:0,taskTotal:0,currentWal:'',currentTask:''}); setBatchSelectedIds(new Set()); }}
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

      <div style={{ display:'flex', gap:'2px', marginBottom:'20px', borderBottom:'1px solid #1e1e1e', overflowX:'auto' }}>
        {([
          ['wallets',  <FaWallet/>,       'Wallet BIP39'],
          ['transfer', <FaExchangeAlt/>,  'Send / Receive'],
          ['garap',    <FaRobot/>,        'Garap Hub'],
          ['networks', <FaNetworkWired/>, 'RPC Networks'],
          ['bytecode', <FaTerminal/>,     'Bytecode'],
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
              return (
                <div key={w.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #01a2ff', overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', cursor:'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : w.id)}>
                    <FaWallet color="#01a2ff" size={14}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'bold', fontSize:'14px' }}>{w.name}</div>
                      <div style={{ fontSize:'10px', color:'#444', marginTop:'2px' }}>
                        {new Date(w.createdAt).toLocaleString('id-ID')} · {w.addresses.length} address · m/44'/60'/0'/0/x
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
                      <div>
                        <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                          <FaShieldAlt style={{ marginRight:'5px' }}/>Derived Addresses (EIP-55 Checksummed)
                        </div>
                        {w.addresses.sort((a,b) => a.index - b.index).map(addr => {
                          const pkKey      = `pk_${w.id}_${addr.index}`;
                          const pkRevealed = revealedPKs.has(pkKey);
                          return (
                            <div key={addr.index} style={{ background:'#0a0a0a', border:'1px solid #151515', padding:'12px', marginBottom:'8px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                                <span style={{ fontSize:'10px', color:'#444', background:'#111', padding:'2px 7px', fontFamily:'monospace' }}>#{addr.index}</span>
                                <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}>
                                  {addr.address}
                                </code>
                                <button onClick={() => copyText(addr.address, `addr_${addr.index}_${w.id}`)}
                                  style={{ background:'none', border:'none', color:copiedKey===`addr_${addr.index}_${w.id}`?'#4caf50':'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  {copiedKey===`addr_${addr.index}_${w.id}` ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                                </button>
                                <button onClick={() => setQrAddress(addr.address)} title="QR Code"
                                  style={{ background:'none', border:'none', color:'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  <FaQrcode size={12}/>
                                </button>
                                {balResults[addr.address] && (
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
                                  <button onClick={() => copyText(addr.privateKey, `pk_copy_${addr.index}_${w.id}`)}
                                    style={{ background:'none', border:'none', color:copiedKey===`pk_copy_${addr.index}_${w.id}`?'#4caf50':'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                    {copiedKey===`pk_copy_${addr.index}_${w.id}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
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
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'6px' }}>
              <FaGlobe style={{ marginRight:'4px' }}/>Pilih Network
            </label>
            <select
              value={txNetworkId}
              onChange={e => { if (txConnected) txDisconnect(); setTxNetworkId(e.target.value); }}
              style={{ width:'100%', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px' }}
            >
              {networks.map(n => (
                <option key={n.id} value={n.id}>{n.name} · {n.symbol} · Chain {n.chainId}</option>
              ))}
            </select>
            {selectedNetwork && (
              <div style={{ marginTop:'8px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:'11px', color: selectedNetwork.color, border:`1px solid ${selectedNetwork.color}44`, padding:'3px 10px', fontFamily:'monospace' }}>
                  Chain ID: {selectedNetwork.chainId}
                </span>
                <span style={{ fontSize:'11px', color:'#555', border:'1px solid #1e1e1e', padding:'3px 10px' }}>
                  {selectedNetwork.symbol}
                </span>
                {selectedNetwork.explorerUrl && (
                  <a href={selectedNetwork.explorerUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize:'11px', color:'#01a2ff', border:'1px solid #01a2ff30', padding:'3px 10px', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaLink size={9}/> Explorer ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {!txConnected ? (
            <div className="form-container" style={{ maxWidth:'560px', margin:'0 auto' }}>
              <h2 style={{ textAlign:'center', marginBottom:'16px', fontSize:'15px' }}>
                <FaPlug style={{ marginRight:'8px' }}/>Connect ke {selectedNetwork?.name}
              </h2>
              {wallets.length > 0 && (
                <div style={{ marginBottom:'12px' }}>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Pilih dari wallet tersimpan:</label>
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
              <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                <FaKey style={{ marginRight:'4px' }}/>Private Key
              </label>
              <input
                type="password"
                placeholder="0x..."
                value={txPrivKey}
                onChange={e => { setTxPrivKey(e.target.value); setTxWalletSel(''); }}
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}
              />
              <button onClick={txConnect} disabled={txConnecting || !txPrivKey.trim()}
                style={{ width:'100%', padding:'12px', background:txConnecting?'#1a1a2a':selectedNetwork?.color??'#01a2ff', color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!txPrivKey.trim()?0.5:1 }}>
                {txConnecting
                  ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                  : <><FaPlug/> Connect</>}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${selectedNetwork?.color??'#01a2ff'}`, padding:'18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>
                      <FaQrcode style={{ marginRight:'5px' }}/>Receive — Address Kamu
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <code style={{ flex:1, fontSize:'13px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
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
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Saldo</div>
                    <div style={{ fontSize:'22px', fontWeight:'bold', fontFamily:'monospace', color:'#fff' }}>
                      {txLoadingBal ? '...' : txBalance}
                    </div>
                    <button onClick={() => txRefreshBalance()} disabled={txLoadingBal}
                      style={{ marginTop:'6px', background:'none', border:'1px solid #333', color:'#555', padding:'4px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px' }}>
                      <FaSync size={10} style={{ animation:txLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:'2px solid #01a2ff', padding:'18px' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:'13px', textTransform:'uppercase', letterSpacing:'1px', color:'#01a2ff', display:'flex', alignItems:'center', gap:'6px' }}>
                  <FaPaperPlane/> Send {selectedNetwork?.symbol} — {selectedNetwork?.name}
                </h3>
                <div style={{ display:'grid', gap:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Ke address (to)</label>
                    <input type="text" placeholder="0x..." value={txSendTo}
                      onChange={e => setTxSendTo(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Jumlah {selectedNetwork?.symbol}</label>
                    <input type="number" placeholder="0.001" step="0.0001" min="0" value={txSendAmt}
                      onChange={e => setTxSendAmt(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace' }}/>
                  </div>
                  <button onClick={txSend} disabled={txSending || !txSendTo || !txSendAmt}
                    style={{ padding:'12px', background:txSending?'#1a1a2a':selectedNetwork?.color??'#01a2ff', color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!txSendTo||!txSendAmt)?0.5:1 }}>
                    {txSending
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                      : <><FaPaperPlane/> Kirim Transaksi</>}
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
                          <input placeholder='Args JSON ["arg1","arg2"] — kosong jika tidak ada' value={execContract.contractArgs}
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
                            : <><FaBolt/> Eksekusi TX</>}
                      </button>

                      {execLog.length > 0 && (
                        <div style={{ background:'#030308', border:'1px solid #0e0e1a', padding:'10px', fontFamily:'monospace', fontSize:'10px', color:'#888', maxHeight:'140px', overflowY:'auto', lineHeight:'1.7' }}>
                          {execLog.map((l, i) => (
                            <div key={i} style={{
                              color: l.includes('✅')||l.includes('DIKONFIRMASI') ? '#4caf50'
                                   : l.includes('❌') ? '#f44336'
                                   : l.includes('🚀')||l.includes('📨') ? '#836EFD'
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
