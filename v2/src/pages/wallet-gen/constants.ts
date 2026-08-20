import type { RPCNetwork, AirdropTask, ChainKind } from './types';

export const AUTO_ACTION_TEMPLATES = [
  { id:'transfer_eth',   label:'[] Transfer ETH',       abi:'', category:'transfer' },
  { id:'erc20_approve',  label:'[] ERC-20 Approve',      abi:'[{"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]', category:'token' },
  { id:'erc20_transfer', label:'[] ERC-20 Transfer',     abi:'[{"inputs":[{"name":"recipient","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]', category:'token' },
  { id:'nft_mint',       label:'[] NFT Mint',            abi:'[{"inputs":[{"name":"quantity","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}]', category:'nft' },
  { id:'custom',         label:'[] Custom Calldata',     abi:'', category:'custom' },
];

export const AUTO_SELECTOR_MAP: Record<string, string> = {
  'approve(address,uint256)': '0x095ea7b3',
  'transfer(address,uint256)': '0xa9059cbb',
  'transferFrom(address,address,uint256)': '0x23b872dd',
  'mint(uint256)': '0xa0712d68',
  'claim()': '0x4e71d92d',
  'deposit()': '0xd0e30db0',
  'withdraw(uint256)': '0x2e1a7d4d',
  'stake(uint256)': '0xa694fc3a',
};

export const TX_QUEUE_KEY  = 'web3TxQueue';
export const TX_HISTORY_KEY = 'web3TxHistory';

export const SEPOLIA_RPCS = [
  'https://rpc.sepolia.org',
  'https://1rpc.io/sepolia',
  'https://sepolia.llamarpc.com',
  'https://eth-sepolia.public.blastapi.io',
];

export const RPC_NETWORKS_STORAGE_KEY = 'rpcNetworks';

export const DEFAULT_NETWORKS: RPCNetwork[] = [
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

export const QLENGTH_OPTIONS = [
  { label:'12 kata (128-bit)', bits:128  as const, words:12 },
  { label:'15 kata (160-bit)', bits:160  as const, words:15 },
  { label:'18 kata (192-bit)', bits:192  as const, words:18 },
  { label:'21 kata (224-bit)', bits:224  as const, words:21 },
  { label:'24 kata (256-bit)', bits:256  as const, words:24 },
];

export const TASK_TYPES: { value: AirdropTask['taskType']; label: string; color: string }[] = [
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

export const PRIORITY_COLORS: Record<AirdropTask['priority'], string> = {
  low: '#555', medium: '#ffaa00', high: '#ff3333',
};

export const PRIORITY_LABELS: Record<AirdropTask['priority'], string> = {
  low: 'Low', medium: 'Medium', high: 'High',
};

export const PINATA_API_BASE = 'https://api.pinata.cloud';
export const PINATA_GATEWAY   = 'https://gateway.pinata.cloud/ipfs/';

export const CHAIN_OPTIONS: { id: ChainKind | string; label: string; soon?: boolean }[] = [
  { id: 'evm',  label: 'EVM' },
  { id: 'sol',  label: 'SOL' },
  { id: 'tron', label: 'TRON' },
  { id: 'atom', label: 'ATOM' },
  { id: 'axm',  label: 'AXM' },
  { id: 'gram', label: 'GRAM (ex-TON)' },
  { id: 'btc', label: 'BTC',  soon: true },
  { id: 'sui', label: 'SUI',  soon: true },
  { id: 'apt', label: 'APT',  soon: true },
];

export const WALLET_CHAIN_OPTIONS: { id: ChainKind | string; label: string; soon?: boolean }[] = [
  { id: 'evm',  label: 'EVM' },
  { id: 'sol',  label: 'SOL' },
  { id: 'tron', label: 'TRON' },
  { id: 'atom', label: 'ATOM' },
  { id: 'axm',  label: 'AXM' },
  { id: 'gram', label: 'GRAM (ex-TON)' },
  { id: 'btc', label: 'BTC',  soon: true },
  { id: 'sui', label: 'SUI',  soon: true },
  { id: 'apt', label: 'APT',  soon: true },
];

export const BLOCKSCOUT_HOSTS: Record<string, string> = {
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

export const TOKEN_METADATA_TYPE_SIZE = 2;
export const TOKEN_METADATA_LENGTH_SIZE = 2;