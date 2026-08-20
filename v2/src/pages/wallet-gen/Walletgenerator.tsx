import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import {
  Keypair as SolKeypair, Connection, PublicKey, SystemProgram,
  Transaction as SolTransaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction, createTransferInstruction,
  MINT_SIZE, getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction, createMintToInstruction,
  createInitializeMetadataPointerInstruction,
  getMintLen, ExtensionType,
  createCloseAccountInstruction, createBurnInstruction,
  getTokenMetadata,
} from '@solana/spl-token';
import {
  createInitializeInstruction as createInitializeTokenMetadataInstruction,
  createUpdateFieldInstruction as createUpdateTokenMetadataFieldInstruction,
  pack as packTokenMetadata,
  type TokenMetadata,
} from '@solana/spl-token-metadata';
import {
  PROGRAM_ID as METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
  Metadata as MplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import bs58 from 'bs58';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { CustomAlert, CustomConfirm, TxConfirmModal, type TxConfirmDetails } from '../../components/CustomModals';
import { KNOWN_4BYTE, KNOWN_TOPICS, KNOWN_SELECTORS } from './know'
import { TxDecoder } from './Txdecoder';
import {
  deriveSolanaAddress, getMetadataPda, SPL_META_MAX,
  SOLANA_NETWORKS, getSolanaConnection, getSolBalanceWithFallback,
  fetchSolTokenPortfolio,
} from './network/Solnet';
import {
  type TronNetworkCfg, TRON_NETWORKS, sunToTrx, trxToSun,
  isValidTronAddress, tronToEvmAddr, tronAddressFromPrivateKey, deriveTronAddress,
  getTronBalanceSun, tronSendTrx, tronReadContract, tronCallContract, tronDeployTrc20,
  fetchTronTokenPortfolio, tronGetTxInfo, tronAddressHexToBase58,
  getTronAccountResources, estimateTronNativeFee, estimateTronTrc20Fee, estimateTronDeployFee,
  type TronAccountResources, type TronFeeEstimate,
  tronFriendlyError,
} from './network/Tronnet';
import {
  deriveAxiomeAddress, AXIOME_NETWORKS, getAxmBalanceWithFallback, fetchAxmPortfolio,
  isValidAxiomeAddress, axiomeAddressFromPrivateKey, sendAxm, axmFriendlyError,
  estimateAxmFee, type AxmNetworkCfg, type AxmFeeEstimate,
} from './network/Axiomenet';
import {
  deriveCosmosAddress, COSMOS_NETWORKS, getAtomBalanceWithFallback, fetchAtomPortfolio,
  isValidCosmosAddress, cosmosAddressFromPrivateKey, sendAtom, atomFriendlyError,
  estimateAtomFee, ATOM_GAS_PRICE_TIERS, type AtomNetworkCfg, type AtomFeeEstimate, type AtomGasMode,
} from './network/Cosmosnet';
import {
  deriveGramAddress, GRAM_NETWORKS, GRAM_WALLET_VERSIONS, getGramBalanceWithFallback,
  isValidGramAddress, gramAddressFromPrivateKey, sendGram, gramFriendlyError,
  estimateGramFee, estimateGramMaxSendable, type GramNetworkCfg, type GramFeeEstimate,
  sendGramJetton, estimateGramJettonFee, getGramJettonMeta, fetchGramTokenPortfolio,
  deployGramJetton, estimateGramJettonDeployFee, GRAM_JETTON_DEPLOY_VALUE,
} from './network/Gramnet';
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
  FaCheck, FaRegCopy, FaCoins, FaRocket, FaHashtag, FaFaucet, FaUpload,
  FaCompass,
} from 'react-icons/fa';

// Wallet-Gen Dipecah jadi beberapa file mulai 20 agustus 2026 ~0xmsr
import {
  SmartContractConfig,
  BytecodeExplorer,
  ERC20_ABI,
  ERC20_BYTECODE,
  safeParseContractArgs,
  parseArgWithAbiType,
  parseTxError,
  compileSolidity,
} from './Smartcontracttools';
import type { DeployedErc20Token, CreatedSplToken, CompiledContract } from './Smartcontracttools';

import type {
  BIP39Wallet, RPCNetwork, AirdropTask, TxQueueItem, AutoContractCall, ChainKind, DetectedToken,
  GramVersion, WalletGeneratorCtx, CreatedGramToken,
} from './types';
import {
  AUTO_ACTION_TEMPLATES, AUTO_SELECTOR_MAP, TX_QUEUE_KEY, TX_HISTORY_KEY, SEPOLIA_RPCS,
  RPC_NETWORKS_STORAGE_KEY, DEFAULT_NETWORKS, QLENGTH_OPTIONS, TASK_TYPES, PRIORITY_COLORS,
  PRIORITY_LABELS, PINATA_API_BASE, PINATA_GATEWAY, CHAIN_OPTIONS, WALLET_CHAIN_OPTIONS,
  BLOCKSCOUT_HOSTS, TOKEN_METADATA_TYPE_SIZE, TOKEN_METADATA_LENGTH_SIZE,
} from './constants';
import {
  encodeAutoAbi, parseAbiFunc, shortAddr, weiToEthStr, ethToHex, generateMnemonic, deriveAddress,
  pinataUploadFile, pinataUploadJson, getProvider, fetchEvmTokenPortfolio, toIpfsUri,
} from './helpers';
import { WalletsTab } from './WalletsTab';
import { TransferTab } from './TransferTab';
import { GarapTab } from './GarapTab';
import { NetworksTab } from './NetworksTab';
import { TokenTab } from './TokenTab';
export * from './types';
export * from './constants';
export * from './helpers';

export const WalletGenerator: React.FC = () => {

  const [wallets,  setWallets]  = useState<BIP39Wallet[]>(() => {
    try {
      const saved: BIP39Wallet[] = JSON.parse(localStorage.getItem('bip39Wallets') || '[]');

      const axmCoinTypeFixed = localStorage.getItem('axmCoinTypeFixV5') === 'done';
      if (!axmCoinTypeFixed) localStorage.setItem('axmCoinTypeFixV5', 'done');

      const gramNativeDerivFixed = localStorage.getItem('gramNativeDerivFixV1') === 'done';
      if (!gramNativeDerivFixed) localStorage.setItem('gramNativeDerivFixV1', 'done');

      return saved.map(w => {
        let next = w;
        if (!next.solAddresses || next.solAddresses.length === 0) {
          try {
            const solAddresses = next.addresses.map(a => ({ index: a.index, ...deriveSolanaAddress(next.mnemonic, a.index) }));
            next = { ...next, solAddresses };
          } catch { next = { ...next, solAddresses: next.solAddresses || [] }; }
        }

        if (!next.tronAddresses || next.tronAddresses.length === 0) {
          try {
            const tronAddresses = next.addresses.map(a => ({ index: a.index, ...deriveTronAddress(next.mnemonic, a.index) }));
            next = { ...next, tronAddresses };
          } catch { next = { ...next, tronAddresses: next.tronAddresses || [] }; }
        }

        if (!next.axmAddresses || (!axmCoinTypeFixed && next.axmAddresses.length > 0)) {
          next = { ...next, axmAddresses: [] };
        }

        if (!next.atomAddresses || next.atomAddresses.length === 0) {
          next = { ...next, atomAddresses: [] };
        }

        if (next.gramAddress === undefined || (!gramNativeDerivFixed && next.gramAddress)) {
          next = { ...next, gramAddress: undefined };
        }
        return next;
      });
    } catch { return []; }
  });
  const [chainView, setChainView] = useState<Record<string, ChainKind>>({});
  const [networks, setNetworks] = useState<RPCNetwork[]>(() => {
    try {
      const s = localStorage.getItem(RPC_NETWORKS_STORAGE_KEY);
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


  const [devMode, setDevMode] = useState<boolean>(() => localStorage.getItem('devModeSkipTxConfirm') === 'true');
  useEffect(() => { localStorage.setItem('devModeSkipTxConfirm', String(devMode)); }, [devMode]);

  const [txConfirmModal, setTxConfirmModal] = useState<{isOpen:boolean; details: TxConfirmDetails|null}>({isOpen:false, details:null});
  const txConfirmResolverRef = useRef<((ok:boolean)=>void)|null>(null);


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
  const [txMaxLoading,  setTxMaxLoading]  = useState(false);
  const [txSending,     setTxSending]     = useState(false);
  const [txConnecting,  setTxConnecting]  = useState(false);
  const [txStatus,      setTxStatus]      = useState<{type:'idle'|'pending'|'success'|'error';msg:string;hash?:string}>({type:'idle',msg:''});
  const [txWalletSel,   setTxWalletSel]   = useState('');


  const [txAsset,        setTxAsset]        = useState<string>('native');
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


  const [solMode, setSolMode] = useState<'single'|'multi'|'sweep'|'close'>('single');


  const [solAsset,          setSolAsset]          = useState<string>('native');
  const [solTokens,         setSolTokens]         = useState<{mint:string; decimals:number; uiAmount:number}[]>([]);
  const [solTokensLoading,  setSolTokensLoading]  = useState(false);


  const [solCloseAccounts,   setSolCloseAccounts]   = useState<{
    pubkey:string; mint:string; decimals:number; uiAmount:number; programId:string; lamports:number;

    name?: string; symbol?: string; image?: string; metaLoaded?: boolean;
    createdAt?: number | null; createdAtLoaded?: boolean;
  }[]>([]);

  const solTokenMetaCacheRef = useRef<Map<string, { name?: string; symbol?: string; image?: string }>>(new Map());
  const [solCloseLoading,    setSolCloseLoading]    = useState(false);
  const [solClosingId,       setSolClosingId]       = useState<string>('');
  const [solCloseBurnFirst,  setSolCloseBurnFirst]  = useState<Record<string, boolean>>({});
  const [solCloseAllRunning, setSolCloseAllRunning] = useState(false);
  const [solCloseSelected,   setSolCloseSelected]   = useState<Set<string>>(new Set());
  const [solCloseFilter,     setSolCloseFilter]     = useState<'all'|'empty'|'balance'>('all');
  const [solCloseSearch,     setSolCloseSearch]     = useState('');


  const [solMultiRows, setSolMultiRows] = useState<{id:string;to:string;amount:string;status:'idle'|'pending'|'success'|'failed';hash?:string;error?:string}[]>([
    { id: '1', to: '', amount: '', status: 'idle' },
  ]);
  const [solMultiRunning,  setSolMultiRunning]  = useState(false);
  const [solMultiEqualAmt, setSolMultiEqualAmt] = useState('');


  const [solSweepDestAddr,   setSolSweepDestAddr]   = useState('');
  const [solSweepAmtMode,    setSolSweepAmtMode]    = useState<'all'|'fixed'>('all');
  const [solSweepFixedAmt,   setSolSweepFixedAmt]   = useState('');
  const [solSweepLeaveBuf,   setSolSweepLeaveBuf]   = useState('0.00001');
  const [solSweepSources,    setSolSweepSources]    = useState<{id:string;label:string;address:string;privateKey:string;balance?:string;status:'idle'|'pending'|'success'|'failed'|'skipped';hash?:string;error?:string}[]>([]);
  const [solSweepManualPK,   setSolSweepManualPK]   = useState('');
  const [solSweepRunning,    setSolSweepRunning]    = useState(false);
  const [solSweepDelayMs,    setSolSweepDelayMs]    = useState(1200);
  const [solSweepFetchingBal,setSolSweepFetchingBal]= useState(false);


  const [tronNetId,       setTronNetId]       = useState('mainnet');
  const [tronPrivKey,     setTronPrivKey]     = useState('');
  const [tronConnected,   setTronConnected]   = useState(false);
  const [tronConnecting,  setTronConnecting]  = useState(false);
  const [tronAddress,     setTronAddress]     = useState('');
  const [tronBalance,     setTronBalance]     = useState('—');
  const [tronLoadingBal,  setTronLoadingBal]  = useState(false);
  const [tronSendTo,      setTronSendTo]      = useState('');
  const [tronSendAmt,     setTronSendAmt]     = useState('');
  const [tronAsset,       setTronAsset]       = useState<string>('native');
  const [tronAssetBal,    setTronAssetBal]    = useState('—');
  const [tronAssetBalLoading, setTronAssetBalLoading] = useState(false);
  const [tronSending,     setTronSending]     = useState(false);
  const [tronWalletSel,   setTronWalletSel]   = useState('');
  const [tronStatus,      setTronStatus]      = useState<{type:'idle'|'pending'|'success'|'error';msg:string;hash?:string}>({type:'idle',msg:''});


  const [tronResources,        setTronResources]        = useState<TronAccountResources | null>(null);
  const [tronResourcesLoading, setTronResourcesLoading] = useState(false);
  const [tronFeeEstimate,      setTronFeeEstimate]      = useState<TronFeeEstimate | null>(null);
  const [tronFeeEstimating,    setTronFeeEstimating]    = useState(false);
  const [tronFeeEstimateError, setTronFeeEstimateError] = useState<string | null>(null);

  const [tronMode, setTronMode] = useState<'single'|'multi'|'sweep'>('single');
  const [tronMultiRows,   setTronMultiRows]   = useState<{id:string;to:string;amount:string;status:'idle'|'pending'|'success'|'failed';hash?:string;error?:string}[]>([
    { id: '1', to: '', amount: '', status: 'idle' },
  ]);
  const [tronMultiRunning,  setTronMultiRunning]  = useState(false);
  const [tronMultiEqualAmt, setTronMultiEqualAmt] = useState('');

  const [tronSweepDestAddr,    setTronSweepDestAddr]    = useState('');
  const [tronSweepAmtMode,     setTronSweepAmtMode]     = useState<'all'|'fixed'>('all');
  const [tronSweepFixedAmt,    setTronSweepFixedAmt]    = useState('');
  const [tronSweepLeaveBuf,    setTronSweepLeaveBuf]    = useState('1');
  const [tronSweepSources,     setTronSweepSources]     = useState<{id:string;label:string;address:string;privateKey:string;balance?:string;status:'idle'|'pending'|'success'|'failed'|'skipped';hash?:string;error?:string}[]>([]);
  const [tronSweepManualPK,    setTronSweepManualPK]    = useState('');
  const [tronSweepRunning,     setTronSweepRunning]     = useState(false);
  const [tronSweepDelayMs,     setTronSweepDelayMs]     = useState(1500);
  const [tronSweepFetchingBal, setTronSweepFetchingBal] = useState(false);


  const [tcTronNetId,     setTcTronNetId]     = useState('mainnet');
  const [tcTronWalletSel, setTcTronWalletSel] = useState('');
  const [tcTronPrivKey,   setTcTronPrivKey]   = useState('');
  const [tcTronName,      setTcTronName]      = useState('');
  const [tcTronSymbol,    setTcTronSymbol]    = useState('');
  const [tcTronDecimals,  setTcTronDecimals]  = useState('6');
  const [tcTronSupply,    setTcTronSupply]    = useState('1000000');
  const [tcTronCreating,  setTcTronCreating]  = useState(false);
  const [tcTronStatus,    setTcTronStatus]    = useState<{type:'idle'|'pending'|'success'|'error';msg:string}>({type:'idle',msg:''});

  // ── Token Creator · Tron: estimasi Energy/Bandwidth/fee TRX sebelum deploy ──
  const [tcTronFeeEstimate, setTcTronFeeEstimate] = useState<TronFeeEstimate | null>(null);
  const [tcTronFeeLoading,  setTcTronFeeLoading]  = useState(false);
  const [tcTronFeeError,    setTcTronFeeError]    = useState('');

  const [trc20Tokens,     setTrc20Tokens]     = useState<{netId:string;address:string;symbol:string;decimals:number;name:string;supply:string;txId:string;createdAt:number;pending?:boolean}[]>(() => {
    try { return JSON.parse(localStorage.getItem('trc20Tokens') || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('trc20Tokens', JSON.stringify(trc20Tokens)); }, [trc20Tokens]);


  const [axmNetId,       setAxmNetId]       = useState('axiome-mainnet');
  const AXIOME_NETWORK = AXIOME_NETWORKS.find(n => n.id === axmNetId) ?? AXIOME_NETWORKS[0];
  const [axmPrivKey,    setAxmPrivKey]    = useState('');
  const [axmConnected,  setAxmConnected]  = useState(false);
  const [axmConnecting, setAxmConnecting] = useState(false);
  const [axmAddress,    setAxmAddress]    = useState('');
  const [axmBalance,    setAxmBalance]    = useState('—');
  const [axmLoadingBal, setAxmLoadingBal] = useState(false);
  const [axmSendTo,     setAxmSendTo]     = useState('');
  const [axmSendAmt,    setAxmSendAmt]    = useState('');
  const [axmSending,    setAxmSending]    = useState(false);
  const [axmWalletSel,  setAxmWalletSel]  = useState('');
  const [axmStatus,     setAxmStatus]     = useState<{type:'idle'|'pending'|'success'|'error';msg:string;hash?:string}>({type:'idle',msg:''});
  const [axmFeeEstimate,      setAxmFeeEstimate]      = useState<AxmFeeEstimate | null>(null);
  const [axmFeeEstimating,    setAxmFeeEstimating]    = useState(false);
  const [axmFeeEstimateError, setAxmFeeEstimateError] = useState<string | null>(null);


  const [axmCw20Input, setAxmCw20Input] = useState('');


  const [atomNetId,       setAtomNetId]       = useState('cosmoshub-mainnet');
  const COSMOS_NETWORK = COSMOS_NETWORKS.find(n => n.id === atomNetId) ?? COSMOS_NETWORKS[0];
  const [atomPrivKey,    setAtomPrivKey]    = useState('');
  const [atomConnected,  setAtomConnected]  = useState(false);
  const [atomConnecting, setAtomConnecting] = useState(false);
  const [atomAddress,    setAtomAddress]    = useState('');
  const [atomBalance,    setAtomBalance]    = useState('—');
  const [atomLoadingBal, setAtomLoadingBal] = useState(false);
  const [atomSendTo,     setAtomSendTo]     = useState('');
  const [atomSendAmt,    setAtomSendAmt]    = useState('');
  const [atomSending,    setAtomSending]    = useState(false);
  const [atomWalletSel,  setAtomWalletSel]  = useState('');
  const [atomStatus,     setAtomStatus]     = useState<{type:'idle'|'pending'|'success'|'error';msg:string;hash?:string}>({type:'idle',msg:''});
  const [atomFeeEstimate,      setAtomFeeEstimate]      = useState<AtomFeeEstimate | null>(null);
  const [atomFeeEstimating,    setAtomFeeEstimating]    = useState(false);
  const [atomFeeEstimateError, setAtomFeeEstimateError] = useState<string | null>(null);

  const [atomGasMode,     setAtomGasMode]     = useState<AtomGasMode>('standard');
  const [atomGasManual,   setAtomGasManual]   = useState('');
  const [atomGasAdvanced, setAtomGasAdvanced] = useState(false);
  const [atomGasRefreshNonce, setAtomGasRefreshNonce] = useState(0);


  const [gramNetId,       setGramNetId]       = useState('mainnet');
  const GRAM_NETWORK = GRAM_NETWORKS.find(n => n.id === gramNetId) ?? GRAM_NETWORKS[0];
  // Versi wallet contract TON dipakai saat generate wallet baru (lihat GRAM_WALLET_VERSIONS di network/Gramnet.ts).
  const [gramVersion,        setGramVersion]        = useState<GramVersion>('v5r1');
  // Versi dipakai saat connect manual via private key mentah — beda dari gramVersion
  // karena connect bisa pakai private key dari wallet lama (V4) walau default generate sekarang W5.
  const [gramConnectVersion, setGramConnectVersion] = useState<GramVersion>('v5r1');
  const [gramPrivKey,    setGramPrivKey]    = useState('');
  const [gramConnected,  setGramConnected]  = useState(false);
  const [gramConnecting, setGramConnecting] = useState(false);
  const [gramAddress,    setGramAddress]    = useState('');
  const [gramBalance,    setGramBalance]    = useState('—');
  const [gramLoadingBal, setGramLoadingBal] = useState(false);
  const [gramSendTo,     setGramSendTo]     = useState('');
  const [gramSendAmt,    setGramSendAmt]    = useState('');
  const [gramSending,    setGramSending]    = useState(false);
  const [gramWalletSel,  setGramWalletSel]  = useState('');
  const [gramStatus,     setGramStatus]     = useState<{type:'idle'|'pending'|'success'|'error';msg:string;hash?:string}>({type:'idle',msg:''});
  const [gramFeeEstimate,      setGramFeeEstimate]      = useState<GramFeeEstimate | null>(null);
  const [gramFeeEstimating,    setGramFeeEstimating]    = useState(false);
  const [gramFeeEstimateError, setGramFeeEstimateError] = useState<string | null>(null);


  // ── Token Creator · Jetton (Gram/TON, TEP-74) ──
  const [tcGramNetId,       setTcGramNetId]       = useState('mainnet');
  const [tcGramVersion,     setTcGramVersion]     = useState<GramVersion>('v5r1');
  const [tcGramWalletSel,   setTcGramWalletSel]   = useState('');
  const [tcGramPrivKey,     setTcGramPrivKey]     = useState('');
  const [tcGramName,        setTcGramName]        = useState('');
  const [tcGramSymbol,      setTcGramSymbol]      = useState('');
  const [tcGramDecimals,    setTcGramDecimals]    = useState('9');
  const [tcGramSupply,      setTcGramSupply]      = useState('1000000');
  const [tcGramDescription, setTcGramDescription] = useState('');
  const [tcGramImageUrl,    setTcGramImageUrl]    = useState('');
  const [tcGramImageUploading, setTcGramImageUploading] = useState(false);
  const [tcGramCreating,    setTcGramCreating]    = useState(false);
  const [tcGramStatus,      setTcGramStatus]      = useState<{type:'idle'|'pending'|'success'|'error';msg:string}>({type:'idle',msg:''});

  const [tcGramFeeGram,    setTcGramFeeGram]    = useState('');
  const [tcGramFeeDetail,  setTcGramFeeDetail]  = useState<GramFeeEstimate | null>(null);
  const [tcGramFeeLoading, setTcGramFeeLoading] = useState(false);
  const [tcGramFeeError,   setTcGramFeeError]   = useState('');

  const [gramTokens, setGramTokens] = useState<CreatedGramToken[]>(() => {
    try { return JSON.parse(localStorage.getItem('gramTokens') || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('gramTokens', JSON.stringify(gramTokens)); }, [gramTokens]);

  const tcGramSelectedNetwork = GRAM_NETWORKS.find(n => n.id === tcGramNetId) ?? GRAM_NETWORKS[0];
  const [gramMaxLoading,       setGramMaxLoading]       = useState(false);
  // ── Jetton (kirim token TON, bukan native GRAM) — pola sama seperti
  //    gramSend* di atas, cuma target-nya jetton-wallet, bukan wallet TON
  //    langsung (lihat sendGramJetton/estimateGramJettonFee di Gramnet.ts).
  const [gramSendMode,      setGramSendMode]      = useState<'native' | 'jetton'>('native');
  const [gramJettonMaster,  setGramJettonMaster]  = useState('');
  const [gramJettonTo,      setGramJettonTo]      = useState('');
  const [gramJettonAmt,     setGramJettonAmt]     = useState('');
  const [gramJettonComment, setGramJettonComment] = useState('');
  const [gramJettonSending, setGramJettonSending] = useState(false);
  const [gramJettonStatus,  setGramJettonStatus]  = useState<{type:'idle'|'pending'|'success'|'error';msg:string;hash?:string}>({type:'idle',msg:''});
  const [gramJettonMeta,        setGramJettonMeta]        = useState<{ name: string; symbol: string; decimals: number; image?: string } | null>(null);
  const [gramJettonMetaLoading, setGramJettonMetaLoading] = useState(false);
  const [gramJettonMetaError,   setGramJettonMetaError]   = useState<string | null>(null);
  const [gramJettonFeeEstimate,      setGramJettonFeeEstimate]      = useState<GramFeeEstimate | null>(null);
  const [gramJettonFeeEstimating,    setGramJettonFeeEstimating]    = useState(false);
  const [gramJettonFeeEstimateError, setGramJettonFeeEstimateError] = useState<string | null>(null);
  // Jetton yang terdeteksi otomatis di address yang lagi connect — dipakai buat
  // dropdown "pilih dari yang dipegang" supaya user gak perlu ketik master address manual.
  const [gramJettonDetected,        setGramJettonDetected]        = useState<DetectedToken[]>([]);
  const [gramJettonDetectedLoading, setGramJettonDetectedLoading] = useState(false);

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


  useEffect(() => {
    const need = wallets.filter(w => !w.axmAddresses || w.axmAddresses.length === 0);
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const w of need) {
        try {
          const axmAddresses = await Promise.all(
            w.addresses.map(async a => ({ index: a.index, ...(await deriveAxiomeAddress(w.mnemonic, a.index)) }))
          );
          if (cancelled) return;
          setWallets(prev => prev.map(x => x.id === w.id ? { ...x, axmAddresses } : x));
        } catch {  }
      }
    })();
    return () => { cancelled = true; };

  }, [wallets]);


  useEffect(() => {
    const need = wallets.filter(w => !w.atomAddresses || w.atomAddresses.length === 0);
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const w of need) {
        try {
          const atomAddresses = await Promise.all(
            w.addresses.map(async a => ({ index: a.index, ...(await deriveCosmosAddress(w.mnemonic, a.index)) }))
          );
          if (cancelled) return;
          setWallets(prev => prev.map(x => x.id === w.id ? { ...x, atomAddresses } : x));
        } catch {  }
      }
    })();
    return () => { cancelled = true; };

  }, [wallets]);

  useEffect(() => {
    const need = wallets.filter(w => !w.gramAddress);
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const w of need) {
        try {
          const derivedGram = await deriveGramAddress(w.mnemonic, 0, gramVersion);
          if (cancelled) return;
          setWallets(prev => prev.map(x => x.id === w.id ? { ...x, gramAddress: derivedGram } : x));
        } catch {  }
      }
    })();
    return () => { cancelled = true; };

  }, [wallets, gramVersion]);

  // Beralih versi wallet contract Gram (TON) untuk 1 wallet BIP39 tersimpan —
  // menurunkan ulang address dari mnemonic yang sama dengan versi kontrak lain
  // (W5 <-> V4R2). Private key hasil turunan tetap sama, cuma address-nya beda.
  const switchGramVersion = async (walletId: string) => {
    const w = wallets.find(x => x.id === walletId);
    if (!w) return;
    const nextVersion: GramVersion = (w.gramAddress?.version ?? 'v5r1') === 'v4' ? 'v5r1' : 'v4';
    try {
      const derived = await deriveGramAddress(w.mnemonic, 0, nextVersion);
      setWallets(prev => prev.map(x => x.id === walletId ? { ...x, gramAddress: derived } : x));
    } catch (e: any) { showAlert('Gagal ganti versi Gram (TON): ' + e.message, 'error'); }
  };

  useEffect(() => { localStorage.setItem(RPC_NETWORKS_STORAGE_KEY, JSON.stringify(networks));   }, [networks]);
  useEffect(() => { localStorage.setItem('walletAirdropTasks',  JSON.stringify(airdropTasks)); }, [airdropTasks]);


  useEffect(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'faucetsolana') {
      setActiveTab('transfer');
      setTxChain('sol');
      setSolNetId(prev => (prev === 'mainnet' ? 'devnet' : prev));
      setHighlightFaucet(true);
      setTimeout(() => setHighlightFaucet(false), 4000);
    }

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


  const [tcChain, setTcChain] = useState<ChainKind>('evm');


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


  const [tcEvmMode,        setTcEvmMode]        = useState<'template'|'custom'>('template');
  const [tcCustomSolidity, setTcCustomSolidity]  = useState('');
  const [tcCustomCtorArgs, setTcCustomCtorArgs]  = useState('[]');
  const [tcCompiling,      setTcCompiling]       = useState(false);
  const [tcCompileError,   setTcCompileError]    = useState('');
  const [tcCompiled,       setTcCompiled]        = useState<CompiledContract | null>(null);

  // ── Token Creator · EVM: estimasi gas sebelum deploy ──
  const [tcGasPriceGwei, setTcGasPriceGwei] = useState<number | null>(null);
  const [tcGasLimitEst,  setTcGasLimitEst]  = useState('');
  const [tcGasFeeNative, setTcGasFeeNative] = useState('');
  const [tcGasLoading,   setTcGasLoading]   = useState(false);
  const [tcGasError,     setTcGasError]     = useState('');


  const [tcSolStandard, setTcSolStandard] = useState<'classic'|'token2022'>('classic');
  const [tcSolNetId,     setTcSolNetId]     = useState('mainnet');
  const [tcSolWalletSel, setTcSolWalletSel] = useState('');
  const [tcSolPrivKey,   setTcSolPrivKey]   = useState('');
  const [tcSolName,      setTcSolName]      = useState('');
  const [tcSolSymbol,    setTcSolSymbol]    = useState('');
  const [tcSolDecimals,  setTcSolDecimals]  = useState('9');
  const [tcSolSupply,    setTcSolSupply]    = useState('1000000');

  const [tcSolAddMeta,     setTcSolAddMeta]     = useState(true);
  const [tcSolImageUrl,    setTcSolImageUrl]    = useState('');
  const [tcSolDescription, setTcSolDescription] = useState('');
  const [tcSolPinataJwt,   setTcSolPinataJwt]   = useState(() => localStorage.getItem('tcSolPinataJwt') || '');
  const [tcSolImageUploading, setTcSolImageUploading] = useState(false);
  const [tcSolCreating,  setTcSolCreating]  = useState(false);
  const [tcSolStatus,    setTcSolStatus]    = useState<{type:'idle'|'pending'|'success'|'error';msg:string}>({type:'idle',msg:''});

  // ── Token Creator · Solana: estimasi biaya (rent + network fee) sebelum buat token ──
  const [tcSolFeeSol,     setTcSolFeeSol]     = useState('');
  const [tcSolFeeDetail,  setTcSolFeeDetail]  = useState<{ mintRent: number; ataRent: number; metadataRent: number; networkFee: number } | null>(null);
  const [tcSolFeeLoading, setTcSolFeeLoading] = useState(false);
  const [tcSolFeeError,   setTcSolFeeError]   = useState('');

  const [splTokens,      setSplTokens]      = useState<CreatedSplToken[]>(() => {
    try { return JSON.parse(localStorage.getItem('splCreatedTokens') || '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('erc20DeployedTokens', JSON.stringify(erc20Tokens)); }, [erc20Tokens]);
  useEffect(() => { localStorage.setItem('splCreatedTokens',   JSON.stringify(splTokens));   }, [splTokens]);
  useEffect(() => { localStorage.setItem('tcSolPinataJwt',     tcSolPinataJwt);              }, [tcSolPinataJwt]);
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
  const [execReadResult, setExecReadResult] = useState<string | null>(null);
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


  const addBatchWalletFromBIP39 = (val: string) => {
    if (!val || !val.includes(',')) return;
    const [wi, ai] = val.split(',').map(Number);
    const w = wallets[wi];
    const addr = w?.addresses.find(a => a.index === ai);
    if (!addr) return;
    const id = `${wi},${ai}`;
    if (batchWallets.some(bw => bw.id === id)) return;
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
    } catch {  }
  };

  const removeBatchWallet = (id: string) => setBatchWallets(prev => prev.filter(bw => bw.id !== id));

  const runBatchExec = async (tasks: AirdropTask[]) => {
    if (batchWallets.length === 0) { batchAddLog('Tambahkan minimal 1 wallet.', 'err'); return; }
    const defaultNet = networks.find(n => n.id === batchNetId);
    if (!defaultNet) { batchAddLog('Network default tidak valid.', 'err'); return; }


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


    const providerCache: Record<string, ethers.providers.JsonRpcProvider> = {};

    const getOrCreateProvider = async (net: RPCNetwork): Promise<ethers.providers.JsonRpcProvider> => {
      if (providerCache[net.id]) return providerCache[net.id];
      batchAddLog(`[+] Menghubungkan ke ${net.name}...`, 'info');
      const p = await getProvider(net);
      providerCache[net.id] = p;
      batchAddLog(`[done] Terhubung ke ${net.name}`, 'ok');
      return p;
    };


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
      const maxRounds = batchLoopMax;

      if (isLooping) {
        batchAddLog(`━━━ Round ${round}${maxRounds > 0 ? ` / ${maxRounds}` : ' (∞)'} ━━━`, 'info');
      }

      let roundSuccess = 0;
      let roundFail    = 0;

      for (let wi = 0; wi < batchWallets.length; wi++) {
        if (batchStopRef.current) break;
        const bw = batchWallets[wi];
        setBatchProgress(p => ({ ...p, walDone: wi, walTotal: batchWallets.length, currentWal: bw.label, taskDone: 0, taskTotal: tasks.length, currentTask: '' }));


        batchAddLog(`\n[wallet] Wallet [${wi+1}/${batchWallets.length}]: ${bw.address.slice(0,10)}…${bw.address.slice(-4)}`, 'info');

      setBatchProgress(p => ({ ...p, taskDone: 0, taskTotal: tasks.length, currentTask: '' }));
      for (let i = 0; i < tasks.length; i++) {
        if (batchStopRef.current) { batchAddLog('[stopbyuser] Dihentikan oleh user.', 'warn'); break; }
        const task = tasks[i];
        setBatchProgress(p => ({ ...p, taskDone: i, taskTotal: tasks.length, currentTask: task.projectName }));


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
                  } catch {  }
                  batchAddLog(`  [result] ${decoded}`, 'ok');
                  taskSuccess = true;
                  setAirdropTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'done', doneAt: Date.now() } : t));
                  break;
                }


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
              taskSuccess = true;
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
            break;
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
        }

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


      if (batchStopRef.current) break;


      if (!isLooping) break;


      if (maxRounds > 0 && round >= maxRounds) {
        batchAddLog(`[done] Selesai ${maxRounds} round.`, 'ok');
        break;
      }


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


            const mut = (fragment as any).stateMutability as string;
            if (mut === 'view' || mut === 'pure') {
              execAddLog(`[read-only] Fungsi "${execContract.contractFunc}" adalah ${mut} — menggunakan eth_call (tidak ada gas/TX).`);
              const callResult = await provider.call({
                to:   execContract.contractAddress,
                data,
              });

              let decoded = callResult;
              try {
                const outTypes = fragment.outputs ?? [];
                if (outTypes.length > 0) {
                  const dec = iface.decodeFunctionResult(execContract.contractFunc, callResult);
                  decoded = dec.map((v: any) => v.toString()).join(', ');
                }
              } catch {  }
              execAddLog(`[result] ${decoded}`);
              setExecReadResult(decoded);
              setExecRunning(false);
              return;
            }

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

        txRequest.gasLimit = ethers.BigNumber.from(execGasLimit);
        execAddLog(`[~] Gas limit manual: ${parseInt(execGasLimit).toLocaleString()}`);
      } else {
        execAddLog('[~] Estimasi gas...');
        try {
          const estimated = await wallet.estimateGas(txRequest);

          const withBuffer = estimated.mul(120).div(100);
          txRequest.gasLimit = withBuffer;
          execAddLog(`[~] Gas: ~${estimated.toNumber().toLocaleString()} (+20% buffer → ${withBuffer.toNumber().toLocaleString()})`);
        } catch (gasErr: any) {

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
          return;
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

  const [agWallet,      setAgWallet]      = useState({ address:'', chainId:0, chainName:'', balance:'0', connected:false });
  const [agConnecting,  setAgConnecting]  = useState(false);

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


  const agDisconnectMM = () => {
    setAgWallet({ address:'', chainId:0, chainName:'', balance:'0', connected:false });
    agAddLog('🔌 Disconnected.');
  };


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


  const agAddToQueue = (item: Omit<TxQueueItem,'id'|'status'>) =>
    setAgQueue(prev => [...prev, { ...item, id: Date.now().toString(), status:'pending' }]);


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


  const agPending  = agQueue.filter(q => q.status === 'pending').length;

  const agSuccess  = agQueue.filter(q => q.status === 'success').length;

  const agFailed   = agQueue.filter(q => q.status === 'failed').length;

  const agNetColor = networks.find(n => n.chainId === agWallet.chainId)?.color ?? '#01a2ff';

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

  const checkAllSolBalances = async () => {
    const allSol = wallets.flatMap(w => (w.solAddresses || []).map(a => ({ walletName: w.name, ...a })));
    if (allSol.length === 0) { showAlert('Belum ada address Solana untuk dicek.', 'error'); return; }
    setBalChecking(true);
    const init: Record<string, { balance: string; loading: boolean; error: boolean }> = {};
    allSol.forEach(a => { init[a.address] = { balance: '...', loading: true, error: false }; });
    setBalResults(prev => ({ ...prev, ...init }));
    const net = SOLANA_NETWORKS[0];

    const CONCURRENCY = 5;
    let cursor = 0;
    const worker = async () => {
      while (cursor < allSol.length) {
        const a = allSol[cursor++];
        try {
          const lamports = await getSolBalanceWithFallback(net, a.address);
          const formatted = (lamports / LAMPORTS_PER_SOL).toFixed(6) + ' SOL';
          setBalResults(prev => ({ ...prev, [a.address]: { balance: formatted, loading: false, error: false } }));
        } catch {
          setBalResults(prev => ({ ...prev, [a.address]: { balance: 'Error', loading: false, error: true } }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allSol.length) }, worker));
    setBalChecking(false);
  };

  const checkAllTronBalances = async () => {
    const allTron = wallets.flatMap(w => (w.tronAddresses || []).map(a => ({ walletName: w.name, ...a })));
    if (allTron.length === 0) { showAlert('Belum ada address Tron untuk dicek.', 'error'); return; }
    setBalChecking(true);
    const init: Record<string, { balance: string; loading: boolean; error: boolean }> = {};
    allTron.forEach(a => { init[a.address] = { balance: '...', loading: true, error: false }; });
    setBalResults(prev => ({ ...prev, ...init }));
    const net = TRON_NETWORKS[0];
    const CONCURRENCY = 5;
    let cursor = 0;
    const worker = async () => {
      while (cursor < allTron.length) {
        const a = allTron[cursor++];
        try {
          const sun = await getTronBalanceSun(net, a.address);
          setBalResults(prev => ({ ...prev, [a.address]: { balance: sunToTrx(sun) + ' TRX', loading: false, error: false } }));
        } catch {
          setBalResults(prev => ({ ...prev, [a.address]: { balance: 'Error', loading: false, error: true } }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allTron.length) }, worker));
    setBalChecking(false);
  };

  const checkAllAxmBalances = async () => {
    const allAxm = wallets.flatMap(w => (w.axmAddresses || []).map(a => ({ walletName: w.name, ...a })));
    if (allAxm.length === 0) { showAlert('Belum ada address Axiome untuk dicek.', 'error'); return; }
    const net = AXIOME_NETWORKS[0];
    if (net.rpcUrls.length === 0) {
      showAlert('Axiome belum punya RPC endpoint yang dikonfigurasi (isi AXIOME_NETWORKS[].rpcUrls di Axiomenet.ts).', 'error');
      return;
    }
    setBalChecking(true);
    const init: Record<string, { balance: string; loading: boolean; error: boolean }> = {};
    allAxm.forEach(a => { init[a.address] = { balance: '...', loading: true, error: false }; });
    setBalResults(prev => ({ ...prev, ...init }));
    const CONCURRENCY = 5;
    let cursor = 0;
    const worker = async () => {
      while (cursor < allAxm.length) {
        const a = allAxm[cursor++];
        try {
          const balance = await getAxmBalanceWithFallback(net, a.address);
          setBalResults(prev => ({ ...prev, [a.address]: { balance: balance.toFixed(6) + ' AXM', loading: false, error: false } }));
        } catch {
          setBalResults(prev => ({ ...prev, [a.address]: { balance: 'Error', loading: false, error: true } }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allAxm.length) }, worker));
    setBalChecking(false);
  };

  const checkAllAtomBalances = async () => {
    const allAtom = wallets.flatMap(w => (w.atomAddresses || []).map(a => ({ walletName: w.name, ...a })));
    if (allAtom.length === 0) { showAlert('Belum ada address Cosmos Hub untuk dicek.', 'error'); return; }
    const net = COSMOS_NETWORKS[0];
    setBalChecking(true);
    const init: Record<string, { balance: string; loading: boolean; error: boolean }> = {};
    allAtom.forEach(a => { init[a.address] = { balance: '...', loading: true, error: false }; });
    setBalResults(prev => ({ ...prev, ...init }));
    const CONCURRENCY = 5;
    let cursor = 0;
    const worker = async () => {
      while (cursor < allAtom.length) {
        const a = allAtom[cursor++];
        try {
          const balance = await getAtomBalanceWithFallback(net, a.address);
          setBalResults(prev => ({ ...prev, [a.address]: { balance: balance.toFixed(6) + ' ATOM', loading: false, error: false } }));
        } catch {
          setBalResults(prev => ({ ...prev, [a.address]: { balance: 'Error', loading: false, error: true } }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allAtom.length) }, worker));
    setBalChecking(false);
  };

  const checkAllGramBalances = async () => {
    const allGram = wallets.filter(w => w.gramAddress).map(w => ({ walletName: w.name, index: 0, address: w.gramAddress!.address }));
    if (allGram.length === 0) { showAlert('Belum ada address Gram (TON) untuk dicek.', 'error'); return; }
    const net = GRAM_NETWORKS[0];
    setBalChecking(true);
    const init: Record<string, { balance: string; loading: boolean; error: boolean }> = {};
    allGram.forEach(a => { init[a.address] = { balance: '...', loading: true, error: false }; });
    setBalResults(prev => ({ ...prev, ...init }));
    const CONCURRENCY = 5;
    let cursor = 0;
    const worker = async () => {
      while (cursor < allGram.length) {
        const a = allGram[cursor++];
        try {
          const balance = await getGramBalanceWithFallback(net, a.address);
          setBalResults(prev => ({ ...prev, [a.address]: { balance: balance.toFixed(6) + ' TON', loading: false, error: false } }));
        } catch {
          setBalResults(prev => ({ ...prev, [a.address]: { balance: 'Error', loading: false, error: true } }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allGram.length) }, worker));
    setBalChecking(false);
  };


  const scanPortfolioFor = useCallback(async (target: { chain: ChainKind; address: string }, netId: string) => {
    setPortfolioLoading(true);
    setPortfolioError('');
    setPortfolioTokens([]);
    try {
      const tokens = target.chain === 'sol'
        ? await fetchSolTokenPortfolio(target.address)
        : target.chain === 'tron'
        ? await fetchTronTokenPortfolio(target.address, TRON_NETWORKS.find(n => n.id === netId) ?? TRON_NETWORKS[0])
        : target.chain === 'axm'
        ? await fetchAxmPortfolio(target.address, AXIOME_NETWORKS.find(n => n.id === netId) ?? AXIOME_NETWORKS[0], axmCw20Input.split(',').map(s => s.trim()).filter(Boolean))
        : target.chain === 'atom'
        ? await fetchAtomPortfolio(target.address, COSMOS_NETWORKS.find(n => n.id === netId) ?? COSMOS_NETWORKS[0])
        : await fetchEvmTokenPortfolio(target.address, netId);
      tokens.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));
      setPortfolioTokens(tokens);
    } catch (e: any) {
      setPortfolioError(e?.message || 'Gagal mengambil data token.');
    }
    setPortfolioLoading(false);
  }, [axmCw20Input]);

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
        style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${target.chain==='sol'?'#9945FF':target.chain==='tron'?'#EF0027':target.chain==='axm'?'#75bbe9':target.chain==='atom'?'#2E3148':'#01a2ff'}`, width:'100%', maxWidth:'560px', maxHeight:'82vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 18px', borderBottom:'1px solid #1a1a1a', display:'flex', alignItems:'center', gap:'10px' }}>
          <FaCoins color={target.chain==='sol'?'#9945FF':target.chain==='tron'?'#EF0027':target.chain==='axm'?'#75bbe9':target.chain==='atom'?'#2E3148':'#01a2ff'} />
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

        {target.chain === 'tron' && (
          <div style={{ padding:'12px 18px', borderBottom:'1px solid #161616', display:'flex', alignItems:'center', gap:'8px' }}>
            <FaGlobe size={11} color="#555"/>
            <div style={{ flex:1, fontSize:'11px', color:'#666', fontFamily:'monospace' }}>
              Tron Mainnet · via Tronscan (testnet belum didukung)
            </div>
            <button onClick={refreshPortfolio} disabled={portfolioLoading}
              style={{ background:'none', border:'1px solid #333', color:'#888', padding:'6px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
              <FaSync size={10} style={{ animation: portfolioLoading ? 'spin 1s linear infinite' : undefined }}/> Refresh
            </button>
          </div>
        )}

        {target.chain === 'axm' && (
          <div style={{ padding:'12px 18px', borderBottom:'1px solid #161616', display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <FaGlobe size={11} color="#555"/>
              <div style={{ flex:1, fontSize:'11px', color:'#666', fontFamily:'monospace' }}>
                Axiome Chain · saldo AXM native + CW20 manual (belum ada indexer publik)
              </div>
              <button onClick={refreshPortfolio} disabled={portfolioLoading}
                style={{ background:'none', border:'1px solid #333', color:'#888', padding:'6px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                <FaSync size={10} style={{ animation: portfolioLoading ? 'spin 1s linear infinite' : undefined }}/> Refresh
              </button>
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              <input type="text" placeholder="Contract address CW20 (axm1..., pisah koma kalau lebih dari 1)"
                value={axmCw20Input} onChange={e => setAxmCw20Input(e.target.value)}
                style={{ flex:1, background:'#0d0d0d', border:'1px solid #333', color:'#ddd', padding:'6px 8px', fontSize:'11px', fontFamily:'monospace' }} />
              <button type="button" onClick={refreshPortfolio} disabled={portfolioLoading}
                style={{ background:'none', border:'1px solid #333', color:'#888', padding:'6px 10px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                Cek CW20
              </button>
            </div>
          </div>
        )}

        {target.chain === 'atom' && (
          <div style={{ padding:'12px 18px', borderBottom:'1px solid #161616', display:'flex', alignItems:'center', gap:'8px' }}>
            <FaGlobe size={11} color="#555"/>
            <div style={{ flex:1, fontSize:'11px', color:'#666', fontFamily:'monospace' }}>
              Cosmos Hub · saldo ATOM native (belum ada indexer IBC/token publik)
            </div>
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
              <div>Memindai token{target.chain==='evm' ? ' via Blockscout' : target.chain==='tron' ? ' via Tronscan' : target.chain==='axm' ? ' via Axiome RPC' : target.chain==='atom' ? ' via Cosmos Hub RPC/REST' : ' via Solana RPC + Jupiter'}...</div>
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
      ['Wallet Name', 'Chain', 'Address Index', 'Address', 'Private Key', 'Mnemonic Word Count', 'Created At', 'Tags', 'Note'],
    ];
    wallets.forEach(w => {
      const pushRows = (chain: string, list: BIP39Wallet['addresses']) => {
        list.forEach(a => {
          rows.push([
            w.name, chain, String(a.index), a.address, a.privateKey,
            String(w.mnemonic.split(' ').length),
            new Date(w.createdAt).toLocaleString('id-ID'),
            w.tags.join('; '), w.note,
          ]);
        });
      };
      pushRows('EVM', w.addresses);
      pushRows('SOL', w.solAddresses || []);
      pushRows('TRON', w.tronAddresses || []);
      pushRows('AXM', w.axmAddresses || []);
      pushRows('ATOM', w.atomAddresses || []);
      pushRows('GRAM', w.gramAddress ? [{ index: 0, address: w.gramAddress.address, privateKey: w.gramAddress.privateKey }] : []);
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
      const tronAddresses: BIP39Wallet['addresses'] = [];
      const axmAddresses: BIP39Wallet['addresses'] = [];
      const atomAddresses: BIP39Wallet['addresses'] = [];
      for (let i = 0; i < addressCount; i++) {
        const { address, privateKey } = deriveAddress(mnemonic, i);
        addresses.push({ index: i, address, privateKey });
        const sol = deriveSolanaAddress(mnemonic, i);
        solAddresses.push({ index: i, address: sol.address, privateKey: sol.privateKey });
        const tron = deriveTronAddress(mnemonic, i);
        tronAddresses.push({ index: i, address: tron.address, privateKey: tron.privateKey });
        const axm = await deriveAxiomeAddress(mnemonic, i);
        axmAddresses.push({ index: i, address: axm.address, privateKey: axm.privateKey });
        const atom = await deriveCosmosAddress(mnemonic, i);
        atomAddresses.push({ index: i, address: atom.address, privateKey: atom.privateKey });
      }
      // Gram (TON): cuma 1 keypair per wallet (bukan per-index) — lihat catatan di Gramnet.ts.
      const derivedGram = await deriveGramAddress(mnemonic, 0, gramVersion);
      const newWallet: BIP39Wallet = {
        id: Date.now().toString(), name: walletName.trim() || `Wallet #${wallets.length + 1}`,
        mnemonic, addresses, solAddresses, tronAddresses, axmAddresses, atomAddresses, gramAddress: derivedGram, createdAt: Date.now(), tags: [], note: '',
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
      const newTronAddrs = [...(w.tronAddresses || [])];
      const existingTron = new Set(newTronAddrs.map(a => a.index));
      const newAxmAddrs = [...(w.axmAddresses || [])];
      const existingAxm = new Set(newAxmAddrs.map(a => a.index));
      const newAtomAddrs = [...(w.atomAddresses || [])];
      const existingAtom = new Set(newAtomAddrs.map(a => a.index));
      for (let i = 0; i <= nextIndex; i++) {
        if (!existing.has(i)) {
          const { address, privateKey } = deriveAddress(w.mnemonic, i);
          newAddrs.push({ index: i, address, privateKey });
        }
        if (!existingSol.has(i)) {
          const sol = deriveSolanaAddress(w.mnemonic, i);
          newSolAddrs.push({ index: i, address: sol.address, privateKey: sol.privateKey });
        }
        if (!existingTron.has(i)) {
          const tron = deriveTronAddress(w.mnemonic, i);
          newTronAddrs.push({ index: i, address: tron.address, privateKey: tron.privateKey });
        }
        if (!existingAxm.has(i)) {
          const axm = await deriveAxiomeAddress(w.mnemonic, i);
          newAxmAddrs.push({ index: i, address: axm.address, privateKey: axm.privateKey });
        }
        if (!existingAtom.has(i)) {
          const atom = await deriveCosmosAddress(w.mnemonic, i);
          newAtomAddrs.push({ index: i, address: atom.address, privateKey: atom.privateKey });
        }
      }
      newAddrs.sort((a, b) => a.index - b.index);
      newSolAddrs.sort((a, b) => a.index - b.index);
      newTronAddrs.sort((a, b) => a.index - b.index);
      newAxmAddrs.sort((a, b) => a.index - b.index);
      newAtomAddrs.sort((a, b) => a.index - b.index);
      // TON tidak ikut "turunkan address" di sini — algoritma native TON cuma menghasilkan
      // 1 keypair per mnemonic (persis seperti Tonkeeper), bukan banyak address per index.
      setWallets(prev => prev.map(x => x.id === walletId ? { ...x, addresses: newAddrs, solAddresses: newSolAddrs, tronAddresses: newTronAddrs, axmAddresses: newAxmAddrs, atomAddresses: newAtomAddrs } : x));
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

  // Kalau daftar token dikenal berubah (token baru ditambahkan / dideploy) selagi wallet
  // sudah connect, auto-refresh saldo tokennya — biar dropdown Asset tidak nyangkut di "?".
  const knownTxTokenAddrs = knownTxTokens.map(t => t.address.toLowerCase()).sort().join(',');
  useEffect(() => {
    if (!txConnected || knownTxTokens.length === 0) return;
    txFetchTokenBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConnected, knownTxTokenAddrs]);

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
      } catch {}
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
    } catch {}
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

  // ── Isi otomatis "Jumlah" dengan saldo maksimum yang bisa dikirim ──
  // Token: seluruh saldo token (gas dibayar terpisah pakai native coin).
  // Native: saldo dikurangi estimasi biaya gas (gasPrice × gasLimit) biar tidak insufficient funds.
  const txSetMaxAmount = async () => {
    const provider = txProviderRef.current;
    const address = txAddress;
    if (!provider || !address) { showAlert('Connect wallet dulu.', 'error'); return; }
    setTxMaxLoading(true);
    try {
      if (txIsToken && selectedTxToken) {
        const c = new ethers.Contract(selectedTxToken.address, ERC20_ABI, provider);
        const bal: ethers.BigNumber = await c.balanceOf(address);
        if (bal.lte(0)) {
          showAlert(`Saldo ${selectedTxToken.symbol} kosong.`, 'error');
        } else {
          setTxSendAmt(ethers.utils.formatUnits(bal, selectedTxToken.decimals));
        }
      } else {
        const bal = await provider.getBalance(address);
        const gasPrice = txGetGasPrice() ?? await provider.getGasPrice();
        const gasLimit = ethers.BigNumber.from(parseInt(txGasLimit) || 21000);
        const gasCost = gasPrice.mul(gasLimit);
        const max = bal.sub(gasCost);
        if (max.lte(0)) {
          showAlert('Saldo tidak cukup untuk menutup biaya gas.', 'error');
        } else {
          setTxSendAmt(ethers.utils.formatEther(max));
        }
      }
    } catch (e: any) {
      showAlert('Gagal menghitung jumlah maksimum: ' + e.message, 'error');
    }
    setTxMaxLoading(false);
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
      await solFetchCloseAccounts(conn, keypair.publicKey.toBase58());
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
    setSolCloseAccounts([]);
    setSolCloseBurnFirst({});
    setSolCloseSelected(new Set());
    setSolCloseFilter('all');
    setSolCloseSearch('');
  };

  // ══════════════════════════════════════════════════════════════════════
  // ── Tron: Send & Receive (connect, balance, single/multi/sweep TRX) ──
  // ══════════════════════════════════════════════════════════════════════
  const tronNetwork = TRON_NETWORKS.find(n => n.id === tronNetId) ?? TRON_NETWORKS[0];

  const tronRefreshBalance = async (netOverride?: TronNetworkCfg, addr?: string) => {
    const net     = netOverride ?? tronNetwork;
    const address = addr ?? tronAddress;
    if (!address) return;
    setTronLoadingBal(true);
    try {
      const sun = await getTronBalanceSun(net, address);
      setTronBalance(sunToTrx(sun) + ' TRX');
    } catch { setTronBalance('Error'); }
    setTronLoadingBal(false);
  };

  // Saldo token TRC-20 aktif (kalau tronAsset bukan 'native') untuk address yang connect.
  const tronRefreshAssetBalance = async () => {
    if (tronAsset === 'native' || !tronAddress) { setTronAssetBal('—'); return; }
    const token = trc20Tokens.find(t => t.address === tronAsset);
    if (!token) { setTronAssetBal('—'); return; }
    setTronAssetBalLoading(true);
    try {
      const net = TRON_NETWORKS.find(n => n.id === token.netId) ?? tronNetwork;
      const iface = new ethers.utils.Interface(ERC20_ABI);
      const result = await tronReadContract(net, tronAddress, tronAsset, iface, 'balanceOf', [tronToEvmAddr(tronAddress)]);
      const raw = result[0];
      setTronAssetBal(ethers.utils.formatUnits(raw, token.decimals) + ' ' + token.symbol);
    } catch { setTronAssetBal('Error'); }
    setTronAssetBalLoading(false);
  };
  useEffect(() => { tronRefreshAssetBalance(); }, [tronAsset, tronAddress]);

  // Estimasi fee (Bandwidth/Energy) berjalan otomatis & di-debounce tiap kali form
  // kirim (tujuan/jumlah/asset) berubah — tanpa broadcast, aman dipanggil berkali-kali.
  useEffect(() => {
    if (!tronConnected || !tronAddress || tronMode !== 'single') { setTronFeeEstimate(null); setTronFeeEstimateError(null); return; }
    const to  = tronSendTo.trim();
    const amt = parseFloat(tronSendAmt);
    if (!isValidTronAddress(to) || isNaN(amt) || amt <= 0) { setTronFeeEstimate(null); setTronFeeEstimateError(null); return; }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setTronFeeEstimating(true);
      setTronFeeEstimateError(null);
      try {
        let est: TronFeeEstimate;
        if (tronAsset === 'native') {
          est = await estimateTronNativeFee(tronNetwork, tronAddress, to, trxToSun(tronSendAmt));
        } else {
          const token = trc20Tokens.find(t => t.address === tronAsset);
          if (!token) throw new Error('Token tidak ditemukan.');
          const iface = new ethers.utils.Interface(ERC20_ABI);
          const amountBase = ethers.utils.parseUnits(tronSendAmt || '0', token.decimals);
          est = await estimateTronTrc20Fee(tronNetwork, tronAddress, tronAsset, iface, tronToEvmAddr(to), amountBase);
        }
        if (!cancelled) { setTronFeeEstimate(est); setTronFeeEstimateError(null); }
      } catch (e: any) {
        if (!cancelled) { setTronFeeEstimate(null); setTronFeeEstimateError(e?.message || 'Gagal menghitung estimasi fee.'); }
      }
      if (!cancelled) setTronFeeEstimating(false);
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tronConnected, tronAddress, tronMode, tronAsset, tronSendTo, tronSendAmt, tronNetId]);

  // Ambil kuota Bandwidth & Energy akun (gratis harian + hasil freeze/stake TRX).
  const tronRefreshResources = async (netOverride?: TronNetworkCfg, addr?: string) => {
    const net     = netOverride ?? tronNetwork;
    const address = addr ?? tronAddress;
    if (!address) return;
    setTronResourcesLoading(true);
    try {
      const res = await getTronAccountResources(net, address);
      setTronResources(res);
    } catch { setTronResources(null); }
    setTronResourcesLoading(false);
  };

  const tronConnect = async () => {
    const pk = tronPrivKey.trim();
    if (!pk) { showAlert('Masukkan private key Tron dulu (hex).', 'error'); return; }
    setTronConnecting(true);
    setTronStatus({ type: 'idle', msg: '' });
    try {
      const address = tronAddressFromPrivateKey(pk);
      setTronAddress(address);
      setTronConnected(true);
      await tronRefreshBalance(tronNetwork, address);
      await tronRefreshResources(tronNetwork, address);
    } catch (e: any) { showAlert('Gagal connect: private key Tron tidak valid. (' + e.message + ')', 'error'); }
    setTronConnecting(false);
  };

  const tronDisconnect = () => {
    setTronConnected(false);
    setTronAddress('');
    setTronBalance('—');
    setTronPrivKey('');
    setTronWalletSel('');
    setTronStatus({ type: 'idle', msg: '' });
    setTronAsset('native');
    setTronAssetBal('—');
    setTronResources(null);
    setTronFeeEstimate(null);
    setTronFeeEstimateError(null);
  };

  const switchTronNetwork = async (newId: string) => {
    setTronNetId(newId);
    if (!tronConnected || !tronAddress) return;
    const newNet = TRON_NETWORKS.find(n => n.id === newId) ?? TRON_NETWORKS[0];
    await tronRefreshBalance(newNet, tronAddress);
    await tronRefreshResources(newNet, tronAddress);
  };

  // Faucet Tron testnet (Nile/Shasta) TIDAK punya endpoint airdrop otomatis kayak
  // Solana devnet (butuh reCAPTCHA manual di halaman faucet resmi) — jadi yang bisa
  // dibantu di sini cuma nyalin address wallet ke clipboard + buka halaman faucet-nya
  // di tab baru, biar user tinggal paste & klik Obtain.
  const openTronFaucet = async () => {
    if (!tronNetwork.faucetUrl) return;
    if (tronConnected && tronAddress) {
      await copyText(tronAddress, 'tron_faucet_addr');
      showAlert(`Address disalin ke clipboard. Tempel di halaman faucet ${tronNetwork.name} yang baru dibuka.`, 'info');
    }
    window.open(tronNetwork.faucetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTronWalletSel = (val: string) => {
    setTronWalletSel(val);
    if (!val) return;
    const [wi, ai] = val.split(',').map(Number);
    const w    = wallets[wi];
    const addr = w?.tronAddresses?.find(a => a.index === ai);
    if (addr) setTronPrivKey(addr.privateKey);
  };

  const tronSend = async () => {
    if (!tronConnected || !tronAddress) { showAlert('Wallet Tron tidak terhubung.', 'error'); return; }
    if (!isValidTronAddress(tronSendTo.trim())) { showAlert('Address Tron tujuan tidak valid.', 'error'); return; }
    const amt = parseFloat(tronSendAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('Jumlah tidak valid.', 'error'); return; }

    const token = tronAsset !== 'native' ? trc20Tokens.find(t => t.address === tronAsset) : undefined;
    if (tronAsset !== 'native' && !token) { showAlert('Token tidak ditemukan.', 'error'); return; }

    const okSend = await requestTxConfirm({
      title: 'Kirim Transaksi',
      network: tronNetwork.name,
      to: tronSendTo,
      value: token ? `${tronSendAmt} ${token.symbol}` : `${tronSendAmt} TRX`,
    });
    if (!okSend) return;

    setTronSending(true);
    setTronStatus({ type: 'pending', msg: `Mengirim transaksi ke ${tronNetwork.name}...` });
    try {
      let txId: string;
      if (token) {
        const iface = new ethers.utils.Interface(ERC20_ABI);
        const amountBase = ethers.utils.parseUnits(tronSendAmt, token.decimals);
        txId = await tronCallContract(tronNetwork, tronAddress, token.address, iface, 'transfer', [tronToEvmAddr(tronSendTo.trim()), amountBase], tronPrivKey);
      } else {
        txId = await tronSendTrx(tronNetwork, tronAddress, tronSendTo.trim(), trxToSun(tronSendAmt), tronPrivKey);
      }
      setTronStatus({ type: 'success', msg: 'Transaksi terkirim (broadcast sukses)', hash: txId });
      saveTxHistory({
        taskName: 'Transfer', description: `Kirim ${tronSendAmt} ${token ? token.symbol : 'TRX'} ke ${shortAddr(tronSendTo)} di ${tronNetwork.name}`,
        to: tronSendTo, value: tronSendAmt, data: '',
        status: 'success', txHash: txId, timestamp: Date.now(),
      });
      setTronSendTo(''); setTronSendAmt('');
      await tronRefreshBalance();
      await tronRefreshAssetBalance();
    } catch (e: any) { setTronStatus({ type: 'error', msg: tronFriendlyError(e.message) }); }
    setTronSending(false);
  };

  // ══ Tron: Multi Send ══
  const tronMultiAddRow = () =>
    setTronMultiRows(prev => [...prev, { id: Date.now().toString(), to: '', amount: '', status: 'idle' }]);
  const tronMultiRemoveRow = (id: string) =>
    setTronMultiRows(prev => prev.filter(r => r.id !== id));
  const tronMultiUpdateRow = (id: string, field: 'to'|'amount', val: string) =>
    setTronMultiRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const tronMultiApplyEqual = () => {
    if (!tronMultiEqualAmt) return;
    setTronMultiRows(prev => prev.map(r => ({ ...r, amount: tronMultiEqualAmt })));
  };

  const tronMultiSend = async () => {
    if (!tronConnected || !tronAddress) { showAlert('Wallet Tron tidak terhubung.', 'error'); return; }
    const validRows = tronMultiRows.filter(r => isValidTronAddress(r.to) && parseFloat(r.amount) > 0);
    if (validRows.length === 0) { showAlert('Tidak ada baris valid (address + jumlah).', 'error'); return; }

    const totalAmt = validRows.reduce((a, r) => a + parseFloat(r.amount), 0);

    // Cek dulu total saldo cukup buat semua baris SEBELUM mulai kirim satu-satu — supaya
    // ketahuan dari awal daripada baru gagal di tengah jalan pas TX ke-berapa.
    try {
      const balSun = await getTronBalanceSun(tronNetwork, tronAddress);
      const totalSun = trxToSun(String(totalAmt));
      if (totalSun > balSun) {
        showAlert(`Saldo tidak cukup: total kirim ${totalAmt} TRX, saldo cuma ${sunToTrx(balSun)} TRX.`, 'error');
        return;
      }
    } catch {}

    const okMulti = await requestTxConfirm({
      title: `Multi-Send — ${validRows.length} penerima`,
      network: tronNetwork.name,
      value: `${totalAmt} TRX (total)`,
      extra: 'TX akan dikirim satu per satu ke semua penerima di bawah, tanpa konfirmasi per-baris.',
    });
    if (!okMulti) return;

    setTronMultiRunning(true);
    setTronMultiRows(prev => prev.map(r => ({ ...r, status: 'idle', hash: undefined, error: undefined })));
    for (const row of validRows) {
      setTronMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'pending' } : r));
      try {
        const txId = await tronSendTrx(tronNetwork, tronAddress, row.to.trim(), trxToSun(row.amount), tronPrivKey);
        setTronMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'success', hash: txId } : r));
        saveTxHistory({
          taskName: 'Multi-Send', description: `${row.amount} TRX → ${shortAddr(row.to)} di ${tronNetwork.name}`,
          to: row.to, value: row.amount, data: '',
          status: 'success', txHash: txId, timestamp: Date.now(),
        });
      } catch (e: any) {
        setTronMultiRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'failed', error: tronFriendlyError(e.message)?.slice(0,140) } : r));
      }
    }
    setTronMultiRunning(false);
    await tronRefreshBalance();
  };

  // ══ Tron: Sweep ══
  const tronSweepAddFromBIP39 = (val: string) => {
    if (!val || !val.includes(',')) return;
    const [wi, ai] = val.split(',').map(Number);
    const w    = wallets[wi];
    const addr = w?.tronAddresses?.find(a => a.index === ai);
    if (!addr) return;
    const id = `bip39_${wi}_${ai}`;
    if (tronSweepSources.some(s => s.id === id)) return;
    setTronSweepSources(prev => [...prev, {
      id, label: `[${w.name}] #${ai} ${addr.address.slice(0,10)}…`,
      address: addr.address, privateKey: addr.privateKey, status: 'idle',
    }]);
  };

  const tronSweepAddManualPK = () => {
    const pk = tronSweepManualPK.trim();
    if (!pk) return;
    try {
      const addr = tronAddressFromPrivateKey(pk);
      const id   = `manual_${addr}`;
      if (tronSweepSources.some(s => s.id === id)) { showAlert('Address sudah ada di daftar.', 'error'); return; }
      setTronSweepSources(prev => [...prev, { id, label: `Manual ${addr.slice(0,10)}…`, address: addr, privateKey: pk, status: 'idle' }]);
      setTronSweepManualPK('');
    } catch { showAlert('Private key Tron tidak valid.', 'error'); }
  };

  const tronSweepRemoveSource = (id: string) =>
    setTronSweepSources(prev => prev.filter(s => s.id !== id));

  const tronSweepFetchBalances = async () => {
    if (tronSweepSources.length === 0) return;
    setTronSweepFetchingBal(true);
    await Promise.all(tronSweepSources.map(async s => {
      try {
        const sun = await getTronBalanceSun(tronNetwork, s.address);
        setTronSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: sunToTrx(sun) + ' TRX' } : x));
      } catch {
        setTronSweepSources(prev => prev.map(x => x.id === s.id ? { ...x, balance: 'Error' } : x));
      }
    }));
    setTronSweepFetchingBal(false);
  };

  const tronSweepRun = async () => {
    if (!isValidTronAddress(tronSweepDestAddr)) { showAlert('Address tujuan tidak valid.', 'error'); return; }
    if (tronSweepSources.length === 0) { showAlert('Belum ada wallet sumber.', 'error'); return; }

    const okSweep = await requestTxConfirm({
      title: `Sweep — ${tronSweepSources.length} wallet sumber`,
      network: tronNetwork.name,
      to: tronSweepDestAddr,
      extra: tronSweepAmtMode === 'all'
        ? `Akan mengirim seluruh saldo (disisakan ± ${tronSweepLeaveBuf || '0'} TRX untuk bandwidth/fee) dari tiap wallet sumber.`
        : `Akan mengirim ${tronSweepFixedAmt || '0'} TRX dari tiap wallet sumber ke address tujuan di atas.`,
    });
    if (!okSweep) return;

    setTronSweepRunning(true);
    setTronSweepSources(prev => prev.map(s => ({ ...s, status: 'idle', hash: undefined, error: undefined })));

    for (const src of tronSweepSources) {
      setTronSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'pending' } : s));
      try {
        const sun = await getTronBalanceSun(tronNetwork, src.address);
        let sendSun: number;
        if (tronSweepAmtMode === 'all') {
          const leaveSun = trxToSun(tronSweepLeaveBuf || '0');
          sendSun = sun - leaveSun - 1_100_000; // sisakan estimasi biaya bandwidth/aktivasi akun tujuan
        } else {
          sendSun = trxToSun(tronSweepFixedAmt);
          // Mode "fixed" sebelumnya nggak dicek ke saldo aktual sama sekali — kalau saldo wallet
          // sumber lebih kecil dari jumlah tetap ini, langsung skip di sini daripada baru gagal
          // di TronGrid dengan pesan mentah "balance is not sufficient".
          if (sendSun > sun) {
            setTronSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped', error: `Saldo cuma ${sunToTrx(sun)} TRX, kurang dari ${tronSweepFixedAmt} TRX` } : s));
            if (tronSweepDelayMs > 0) await new Promise(r => setTimeout(r, tronSweepDelayMs));
            continue;
          }
        }
        if (sendSun <= 0) {
          setTronSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'skipped', error: 'Saldo tidak cukup' } : s));
        } else {
          const txId = await tronSendTrx(tronNetwork, src.address, tronSweepDestAddr.trim(), sendSun, src.privateKey);
          setTronSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'success', hash: txId } : s));
          saveTxHistory({
            taskName: 'Sweep', description: `Sweep ${sunToTrx(sendSun)} TRX dari ${shortAddr(src.address)} → ${shortAddr(tronSweepDestAddr)} di ${tronNetwork.name}`,
            to: tronSweepDestAddr, value: sunToTrx(sendSun), data: '',
            status: 'success', txHash: txId, timestamp: Date.now(),
          });
        }
      } catch (e: any) {
        setTronSweepSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'failed', error: tronFriendlyError(e.message)?.slice(0,140) } : s));
      }
      if (tronSweepDelayMs > 0) await new Promise(r => setTimeout(r, tronSweepDelayMs));
    }
    setTronSweepRunning(false);
    await tronRefreshBalance();
  };

  // ══════════════════════════════════════════════════════════════════════
  // ── Axiome (AXM): Send & Receive (connect via private key, cek saldo,
  //    kirim AXM native) — pola sama seperti Tron di atas, tapi lewat cosmjs
  //    SigningStargateClient (Axiome = Cosmos SDK, bukan EVM). ──
  // ══════════════════════════════════════════════════════════════════════
  const axmRefreshBalance = async (netOverride?: AxmNetworkCfg, addr?: string) => {
    const net     = netOverride ?? AXIOME_NETWORK;
    const address = addr ?? axmAddress;
    if (!address) return;
    setAxmLoadingBal(true);
    try {
      const bal = await getAxmBalanceWithFallback(net, address);
      setAxmBalance(bal.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' AXM');
    } catch { setAxmBalance('Error'); }
    setAxmLoadingBal(false);
  };

  const axmConnect = async () => {
    const pk = axmPrivKey.trim();
    if (!pk) { showAlert('Masukkan private key Axiome dulu (hex).', 'error'); return; }
    setAxmConnecting(true);
    setAxmStatus({ type: 'idle', msg: '' });
    try {
      const address = await axiomeAddressFromPrivateKey(pk);
      setAxmAddress(address);
      setAxmConnected(true);
      await axmRefreshBalance(AXIOME_NETWORK, address);
    } catch (e: any) { showAlert('Gagal connect: private key Axiome tidak valid. (' + e.message + ')', 'error'); }
    setAxmConnecting(false);
  };

  const axmDisconnect = () => {
    setAxmConnected(false);
    setAxmAddress('');
    setAxmBalance('—');
    setAxmPrivKey('');
    setAxmWalletSel('');
    setAxmStatus({ type: 'idle', msg: '' });
  };

  const switchAxmNetwork = async (newId: string) => {
    setAxmNetId(newId);
    if (!axmConnected || !axmAddress) return;
    const newNet = AXIOME_NETWORKS.find(n => n.id === newId) ?? AXIOME_NETWORKS[0];
    await axmRefreshBalance(newNet, axmAddress);
  };

  const handleAxmWalletSel = (val: string) => {
    setAxmWalletSel(val);
    if (!val) return;
    const [wi, ai] = val.split(',').map(Number);
    const w    = wallets[wi];
    const addr = w?.axmAddresses?.find(a => a.index === ai);
    if (addr) setAxmPrivKey(addr.privateKey);
  };

  const axmSend = async () => {
    if (!axmConnected || !axmAddress) { showAlert('Wallet Axiome tidak terhubung.', 'error'); return; }
    if (!isValidAxiomeAddress(axmSendTo.trim())) { showAlert('Address Axiome tujuan tidak valid.', 'error'); return; }
    const amt = parseFloat(axmSendAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('Jumlah tidak valid.', 'error'); return; }

    const okSend = await requestTxConfirm({
      title: 'Kirim Transaksi',
      network: AXIOME_NETWORK.name,
      to: axmSendTo,
      value: `${axmSendAmt} AXM`,
    });
    if (!okSend) return;

    setAxmSending(true);
    setAxmStatus({ type: 'pending', msg: `Mengirim transaksi ke ${AXIOME_NETWORK.name}...` });
    try {
      const txHash = await sendAxm(AXIOME_NETWORK, axmPrivKey, axmSendTo.trim(), amt);
      setAxmStatus({ type: 'success', msg: 'Transaksi terkirim (broadcast sukses)', hash: txHash });
      saveTxHistory({
        taskName: 'Transfer', description: `Kirim ${axmSendAmt} AXM ke ${shortAddr(axmSendTo)} di ${AXIOME_NETWORK.name}`,
        to: axmSendTo, value: axmSendAmt, data: '',
        status: 'success', txHash, timestamp: Date.now(),
      });
      setAxmSendTo(''); setAxmSendAmt('');
      await axmRefreshBalance();
    } catch (e: any) { setAxmStatus({ type: 'error', msg: axmFriendlyError(e) }); }
    setAxmSending(false);
  };

  // Estimasi fee AXM berjalan otomatis & di-debounce tiap kali tujuan/jumlah berubah — pola sama
  // seperti estimasi fee ATOM di bawah, lewat simulate() dry-run ke node Axiome.
  useEffect(() => {
    if (!axmConnected || !axmAddress) { setAxmFeeEstimate(null); setAxmFeeEstimateError(null); return; }
    const to  = axmSendTo.trim();
    const amt = parseFloat(axmSendAmt);
    if (!isValidAxiomeAddress(to) || isNaN(amt) || amt <= 0) { setAxmFeeEstimate(null); setAxmFeeEstimateError(null); return; }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setAxmFeeEstimating(true);
      setAxmFeeEstimateError(null);
      try {
        const est = await estimateAxmFee(AXIOME_NETWORK, axmPrivKey, to, amt);
        if (!cancelled) { setAxmFeeEstimate(est); setAxmFeeEstimateError(null); }
      } catch (e: any) {
        if (!cancelled) { setAxmFeeEstimate(null); setAxmFeeEstimateError(e?.message || 'Gagal menghitung estimasi fee.'); }
      }
      if (!cancelled) setAxmFeeEstimating(false);
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [axmConnected, axmAddress, axmSendTo, axmSendAmt, axmNetId]);

  // ══════════════════════════════════════════════════════════════════════
  // ── Cosmos Hub (ATOM): Send & Receive — pola identik dengan Axiome di atas,
  //    tapi lewat Cosmosnet.ts (SigningStargateClient ke Cosmos Hub, coinType
  //    118 resmi, REST publik CORS-friendly). ──
  // ══════════════════════════════════════════════════════════════════════
  const atomRefreshBalance = async (netOverride?: AtomNetworkCfg, addr?: string) => {
    const net     = netOverride ?? COSMOS_NETWORK;
    const address = addr ?? atomAddress;
    if (!address) return;
    setAtomLoadingBal(true);
    try {
      const bal = await getAtomBalanceWithFallback(net, address);
      setAtomBalance(bal.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ATOM');
    } catch { setAtomBalance('Error'); }
    setAtomLoadingBal(false);
  };

  const atomConnect = async () => {
    const pk = atomPrivKey.trim();
    if (!pk) { showAlert('Masukkan private key Cosmos dulu (hex).', 'error'); return; }
    setAtomConnecting(true);
    setAtomStatus({ type: 'idle', msg: '' });
    try {
      const address = await cosmosAddressFromPrivateKey(pk);
      setAtomAddress(address);
      setAtomConnected(true);
      await atomRefreshBalance(COSMOS_NETWORK, address);
    } catch (e: any) { showAlert('Gagal connect: private key Cosmos tidak valid. (' + e.message + ')', 'error'); }
    setAtomConnecting(false);
  };

  const atomDisconnect = () => {
    setAtomConnected(false);
    setAtomAddress('');
    setAtomBalance('—');
    setAtomPrivKey('');
    setAtomWalletSel('');
    setAtomStatus({ type: 'idle', msg: '' });
    setAtomGasMode('standard');
    setAtomGasManual('');
    setAtomGasAdvanced(false);
  };

  const switchAtomNetwork = async (newId: string) => {
    setAtomNetId(newId);
    if (!atomConnected || !atomAddress) return;
    const newNet = COSMOS_NETWORKS.find(n => n.id === newId) ?? COSMOS_NETWORKS[0];
    await atomRefreshBalance(newNet, atomAddress);
  };

  const handleAtomWalletSel = (val: string) => {
    setAtomWalletSel(val);
    if (!val) return;
    const [wi, ai] = val.split(',').map(Number);
    const w    = wallets[wi];
    const addr = w?.atomAddresses?.find(a => a.index === ai);
    if (addr) setAtomPrivKey(addr.privateKey);
  };

  // Resolve gasPrice (uatom/unit) aktif dari mode yang dipilih user — tier resmi chain-registry
  // untuk slow/standard/fast, atau angka manual (fallback ke 'standard' kalau manual kosong/invalid).
  const atomGetGasPriceUatom = (): number => {
    if (atomGasMode === 'manual') {
      const v = parseFloat(atomGasManual);
      return Number.isFinite(v) && v > 0 ? v : ATOM_GAS_PRICE_TIERS.standard;
    }
    return ATOM_GAS_PRICE_TIERS[atomGasMode];
  };

  const atomSend = async () => {
    if (!atomConnected || !atomAddress) { showAlert('Wallet Cosmos tidak terhubung.', 'error'); return; }
    if (!isValidCosmosAddress(atomSendTo.trim())) { showAlert('Address Cosmos tujuan tidak valid.', 'error'); return; }
    const amt = parseFloat(atomSendAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('Jumlah tidak valid.', 'error'); return; }

    const gasPriceUatom = atomGetGasPriceUatom();
    const feeLabel = atomFeeEstimate
      ? `Fee: ~${atomFeeEstimate.feeAtom.toLocaleString('en-US', { maximumFractionDigits: 6 })} ATOM (${atomGasMode === 'manual' ? 'Manual' : atomGasMode[0].toUpperCase() + atomGasMode.slice(1)} · ${gasPriceUatom} uatom/unit)`
      : `Gas: ${atomGasMode === 'manual' ? 'Manual' : atomGasMode[0].toUpperCase() + atomGasMode.slice(1)} · ${gasPriceUatom} uatom/unit`;

    const okSend = await requestTxConfirm({
      title: 'Kirim Transaksi',
      network: COSMOS_NETWORK.name,
      to: atomSendTo,
      value: `${atomSendAmt} ATOM`,
      extra: `${feeLabel}.`,
    });
    if (!okSend) return;

    setAtomSending(true);
    setAtomStatus({ type: 'pending', msg: `Mengirim transaksi ke ${COSMOS_NETWORK.name}...` });
    try {
      const txHash = await sendAtom(COSMOS_NETWORK, atomPrivKey, atomSendTo.trim(), amt, '', gasPriceUatom);
      setAtomStatus({ type: 'success', msg: 'Transaksi terkirim (broadcast sukses)', hash: txHash });
      saveTxHistory({
        taskName: 'Transfer', description: `Kirim ${atomSendAmt} ATOM ke ${shortAddr(atomSendTo)} di ${COSMOS_NETWORK.name}`,
        to: atomSendTo, value: atomSendAmt, data: '',
        status: 'success', txHash, timestamp: Date.now(),
      });
      setAtomSendTo(''); setAtomSendAmt('');
      await atomRefreshBalance();
    } catch (e: any) { setAtomStatus({ type: 'error', msg: atomFriendlyError(e) }); }
    setAtomSending(false);
  };

  // Estimasi fee ATOM berjalan otomatis & di-debounce tiap kali tujuan/jumlah berubah — pola sama
  // seperti estimasi fee Tron di atas, tapi lewat simulate() dry-run ke node Cosmos (bukan tabel
  // Bandwidth/Energy sisi klien), jadi butuh sedikit delay lebih ke RPC dan aman dipanggil berkali-kali.
  useEffect(() => {
    if (!atomConnected || !atomAddress) { setAtomFeeEstimate(null); setAtomFeeEstimateError(null); return; }
    const to  = atomSendTo.trim();
    const amt = parseFloat(atomSendAmt);
    if (!isValidCosmosAddress(to) || isNaN(amt) || amt <= 0) { setAtomFeeEstimate(null); setAtomFeeEstimateError(null); return; }

    let cancelled = false;
    const gasPriceUatom = atomGetGasPriceUatom();
    const timer = setTimeout(async () => {
      setAtomFeeEstimating(true);
      setAtomFeeEstimateError(null);
      try {
        const est = await estimateAtomFee(COSMOS_NETWORK, atomPrivKey, to, amt, '', gasPriceUatom);
        if (!cancelled) { setAtomFeeEstimate(est); setAtomFeeEstimateError(null); }
      } catch (e: any) {
        if (!cancelled) { setAtomFeeEstimate(null); setAtomFeeEstimateError(e?.message || 'Gagal menghitung estimasi fee.'); }
      }
      if (!cancelled) setAtomFeeEstimating(false);
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atomConnected, atomAddress, atomSendTo, atomSendAmt, atomNetId, atomGasMode, atomGasManual, atomGasRefreshNonce]);

  // ══════════════════════════════════════════════════════════════════════
  // ── Gram (TON): Send & Receive (connect via private key, cek saldo,
  //    kirim TON native) — pola sama seperti Axiome/Cosmos di atas, tapi
  //    lewat @ton/ton (WalletContractV4/V5R1). TON tidak punya "derive address
  //    per index" di app ini (1 wallet = 1 address Gram), jadi tidak ada
  //    pemilihan #index di wallet selector. Estimasi fee & Send Max sudah
  //    interaktif (lihat estimateGramFee/estimateGramMaxSendable di
  //    network/Gramnet.ts) lewat dry-run estimateExternalMessageFee TonCenter. ──
  const gramRefreshBalance = async (netOverride?: GramNetworkCfg, addr?: string) => {
    const net     = netOverride ?? GRAM_NETWORK;
    const address = addr ?? gramAddress;
    if (!address) return;
    setGramLoadingBal(true);
    try {
      const bal = await getGramBalanceWithFallback(net, address);
      setGramBalance(bal.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' TON');
    } catch { setGramBalance('Error'); }
    setGramLoadingBal(false);
  };

  const gramConnect = async () => {
    const pk = gramPrivKey.trim();
    if (!pk) { showAlert('Masukkan private key Gram (TON) dulu (hex).', 'error'); return; }
    setGramConnecting(true);
    setGramStatus({ type: 'idle', msg: '' });
    try {
      const address = gramAddressFromPrivateKey(pk, gramConnectVersion);
      setGramAddress(address);
      setGramConnected(true);
      await gramRefreshBalance(GRAM_NETWORK, address);
    } catch (e: any) { showAlert('Gagal connect: private key Gram (TON) tidak valid. (' + e.message + ')', 'error'); }
    setGramConnecting(false);
  };

  const gramDisconnect = () => {
    setGramConnected(false);
    setGramAddress('');
    setGramBalance('—');
    setGramPrivKey('');
    setGramWalletSel('');
    setGramStatus({ type: 'idle', msg: '' });
    setGramSendMode('native');
    setGramJettonMaster(''); setGramJettonTo(''); setGramJettonAmt(''); setGramJettonComment('');
    setGramJettonMeta(null); setGramJettonMetaError(null);
    setGramJettonDetected([]);
    setGramJettonStatus({ type: 'idle', msg: '' });
  };

  const switchGramNetwork = async (newId: string) => {
    setGramNetId(newId);
    if (!gramConnected || !gramAddress) return;
    const newNet = GRAM_NETWORKS.find(n => n.id === newId) ?? GRAM_NETWORKS[0];
    await gramRefreshBalance(newNet, gramAddress);
  };

  const handleGramWalletSel = (val: string) => {
    setGramWalletSel(val);
    if (!val) return;
    const wi = Number(val);
    const w  = wallets[wi];
    if (w?.gramAddress) {
      setGramPrivKey(w.gramAddress.privateKey);
      setGramConnectVersion(w.gramAddress.version ?? 'v5r1');
    }
  };

  const gramSend = async () => {
    if (!gramConnected || !gramAddress) { showAlert('Wallet Gram (TON) tidak terhubung.', 'error'); return; }
    if (!isValidGramAddress(gramSendTo.trim())) { showAlert('Address Gram (TON) tujuan tidak valid.', 'error'); return; }
    const amt = parseFloat(gramSendAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('Jumlah tidak valid.', 'error'); return; }

    const feeLabel = gramFeeEstimate
      ? `Estimasi fee: ~${gramFeeEstimate.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} TON${gramFeeEstimate.willDeploy ? ' (termasuk deploy wallet)' : ''}.`
      : undefined;

    const okSend = await requestTxConfirm({
      title: 'Kirim Transaksi',
      network: GRAM_NETWORK.name,
      to: gramSendTo,
      value: `${gramSendAmt} TON`,
      extra: feeLabel,
    });
    if (!okSend) return;

    setGramSending(true);
    setGramStatus({ type: 'pending', msg: `Mengirim transaksi ke ${GRAM_NETWORK.name}...` });
    try {
      const txHash = await sendGram(GRAM_NETWORK, gramPrivKey, gramSendTo.trim(), amt, '', gramConnectVersion);
      setGramStatus({
        type: 'success',
        msg: txHash ? 'Transaksi terkirim & terkonfirmasi' : 'Transaksi terkirim (belum dapat hash — cek explorer manual kalau perlu)',
        hash: txHash || undefined,
      });
      saveTxHistory({
        taskName: 'Transfer', description: `Kirim ${gramSendAmt} TON ke ${shortAddr(gramSendTo)} di ${GRAM_NETWORK.name}`,
        to: gramSendTo, value: gramSendAmt, data: '',
        status: 'success', txHash: txHash || '', timestamp: Date.now(),
      });
      setGramSendTo(''); setGramSendAmt('');
      await gramRefreshBalance();
    } catch (e: any) { setGramStatus({ type: 'error', msg: gramFriendlyError(e) }); }
    setGramSending(false);
  };

  // ── Isi otomatis "Jumlah" dengan saldo TON maksimum yang bisa dikirim ──
  // Pola sama seperti txSetMaxAmount (EVM): tarik saldo, kurangi estimasi
  // fee (+ reserve deploy kalau wallet belum aktif), isi field kalau masih positif.
  const gramSetMaxAmount = async () => {
    if (!gramConnected || !gramAddress) { showAlert('Connect wallet dulu.', 'error'); return; }
    setGramMaxLoading(true);
    try {
      const result = await estimateGramMaxSendable(GRAM_NETWORK, gramPrivKey, gramConnectVersion);
      setGramSendAmt(result.maxAmountGram.toFixed(9).replace(/0+$/,'').replace(/\.$/,''));
    } catch (e: any) {
      showAlert('Gagal menghitung jumlah maksimum: ' + (e?.message || e), 'error');
    }
    setGramMaxLoading(false);
  };

  // Estimasi fee TON berjalan otomatis & di-debounce tiap kali tujuan/jumlah berubah —
  // pola sama seperti estimasi fee Atom/Tron di atas, lewat estimateExternalMessageFee
  // (dry-run TonCenter, tidak broadcast apa pun ke chain).
  useEffect(() => {
    if (!gramConnected || !gramAddress) { setGramFeeEstimate(null); setGramFeeEstimateError(null); return; }
    const to  = gramSendTo.trim();
    const amt = parseFloat(gramSendAmt);
    if (!isValidGramAddress(to) || isNaN(amt) || amt <= 0) { setGramFeeEstimate(null); setGramFeeEstimateError(null); return; }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setGramFeeEstimating(true);
      setGramFeeEstimateError(null);
      try {
        const est = await estimateGramFee(GRAM_NETWORK, gramPrivKey, to, amt, '', gramConnectVersion);
        if (!cancelled) { setGramFeeEstimate(est); setGramFeeEstimateError(null); }
      } catch (e: any) {
        if (!cancelled) { setGramFeeEstimate(null); setGramFeeEstimateError(e?.message || 'Gagal menghitung estimasi fee.'); }
      }
      if (!cancelled) setGramFeeEstimating(false);
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gramConnected, gramAddress, gramSendTo, gramSendAmt, gramNetId, gramConnectVersion]);

  // ══════════════════════════════════════════════════════════════════════
  // ── Gram (TON): Jetton (kirim token, bukan native GRAM) — fitur wallet
  //    ala Tonkeeper: lihat saldo Jetton yang dipegang, pilih salah satu
  //    (atau tempel master address manual), lalu kirim. Semua fungsi inti
  //    (sendGramJetton/estimateGramJettonFee/getGramJettonMeta/
  //    fetchGramTokenPortfolio) sudah ada di network/Gramnet.ts — bagian
  //    ini cuma nyambungin ke state & UI, pola sama persis kayak gramSend*
  //    native di atas. ──
  const gramLoadDetectedJettons = async () => {
    if (!gramConnected || !gramAddress) return;
    setGramJettonDetectedLoading(true);
    try {
      const tokens = await fetchGramTokenPortfolio(gramAddress, GRAM_NETWORK);
      setGramJettonDetected(tokens);
    } catch { setGramJettonDetected([]); }
    setGramJettonDetectedLoading(false);
  };

  const gramSelectJetton = (masterAddress: string) => {
    setGramJettonMaster(masterAddress);
    const found = gramJettonDetected.find(t => t.address === masterAddress);
    if (found) {
      setGramJettonMeta({ name: found.name, symbol: found.symbol, decimals: found.decimals, image: found.logo });
      setGramJettonMetaError(null);
    }
  };

  // Auto-load daftar Jetton yang dipegang begitu masuk mode "Jetton" pertama kali.
  useEffect(() => {
    if (gramSendMode === 'jetton' && gramConnected && gramJettonDetected.length === 0 && !gramJettonDetectedLoading) {
      gramLoadDetectedJettons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gramSendMode, gramConnected]);

  // Ambil metadata (nama/symbol/decimals) begitu master address diisi manual
  // (belum tentu ada di daftar terdeteksi — mis. jetton baru / low-liquidity
  // yang belum ke-index) — didebounce biar gak spam RPC tiap ketikan.
  useEffect(() => {
    const master = gramJettonMaster.trim();
    if (!master || !isValidGramAddress(master)) { setGramJettonMeta(null); setGramJettonMetaError(null); return; }
    const known = gramJettonDetected.find(t => t.address === master);
    if (known) { setGramJettonMeta({ name: known.name, symbol: known.symbol, decimals: known.decimals, image: known.logo }); setGramJettonMetaError(null); return; }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setGramJettonMetaLoading(true);
      setGramJettonMetaError(null);
      try {
        const meta = await getGramJettonMeta(GRAM_NETWORK, master);
        if (!cancelled) {
          if (meta) setGramJettonMeta(meta);
          else { setGramJettonMeta(null); setGramJettonMetaError('Metadata Jetton tidak ditemukan — pastikan address kontraknya benar.'); }
        }
      } catch (e: any) {
        if (!cancelled) { setGramJettonMeta(null); setGramJettonMetaError(e?.message || 'Gagal mengambil metadata Jetton.'); }
      }
      if (!cancelled) setGramJettonMetaLoading(false);
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gramJettonMaster, gramNetId]);

  // Estimasi fee Jetton — pola sama seperti estimasi fee native GRAM di atas.
  useEffect(() => {
    if (!gramConnected || !gramAddress || !gramJettonMeta) { setGramJettonFeeEstimate(null); setGramJettonFeeEstimateError(null); return; }
    const master = gramJettonMaster.trim();
    const to     = gramJettonTo.trim();
    const amt    = parseFloat(gramJettonAmt);
    if (!isValidGramAddress(master) || !isValidGramAddress(to) || isNaN(amt) || amt <= 0) {
      setGramJettonFeeEstimate(null); setGramJettonFeeEstimateError(null); return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setGramJettonFeeEstimating(true);
      setGramJettonFeeEstimateError(null);
      try {
        const est = await estimateGramJettonFee(GRAM_NETWORK, gramPrivKey, master, to, amt, gramJettonMeta.decimals, gramJettonComment, gramConnectVersion);
        if (!cancelled) { setGramJettonFeeEstimate(est); setGramJettonFeeEstimateError(null); }
      } catch (e: any) {
        if (!cancelled) { setGramJettonFeeEstimate(null); setGramJettonFeeEstimateError(e?.message || 'Gagal menghitung estimasi fee Jetton.'); }
      }
      if (!cancelled) setGramJettonFeeEstimating(false);
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gramConnected, gramAddress, gramJettonMaster, gramJettonTo, gramJettonAmt, gramJettonMeta, gramNetId, gramConnectVersion]);

  const gramSendJetton = async () => {
    if (!gramConnected || !gramAddress) { showAlert('Wallet Gram (TON) tidak terhubung.', 'error'); return; }
    const master = gramJettonMaster.trim();
    if (!isValidGramAddress(master)) { showAlert('Address kontrak Jetton tidak valid.', 'error'); return; }
    if (!isValidGramAddress(gramJettonTo.trim())) { showAlert('Address Gram (TON) tujuan tidak valid.', 'error'); return; }
    const amt = parseFloat(gramJettonAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('Jumlah tidak valid.', 'error'); return; }
    if (!gramJettonMeta) { showAlert('Metadata Jetton belum termuat — tunggu sebentar atau cek address kontraknya.', 'error'); return; }

    const feeLabel = gramJettonFeeEstimate
      ? `Estimasi fee: ~${gramJettonFeeEstimate.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} TON${gramJettonFeeEstimate.willDeploy ? ' (termasuk deploy wallet)' : ''}.`
      : undefined;

    const okSend = await requestTxConfirm({
      title: 'Kirim Jetton',
      network: GRAM_NETWORK.name,
      to: gramJettonTo,
      value: `${gramJettonAmt} ${gramJettonMeta.symbol}`,
      extra: feeLabel,
    });
    if (!okSend) return;

    setGramJettonSending(true);
    setGramJettonStatus({ type: 'pending', msg: `Mengirim ${gramJettonMeta.symbol} ke ${GRAM_NETWORK.name}...` });
    try {
      const txHash = await sendGramJetton(GRAM_NETWORK, gramPrivKey, master, gramJettonTo.trim(), amt, gramJettonMeta.decimals, gramJettonComment, gramConnectVersion);
      setGramJettonStatus({
        type: 'success',
        msg: txHash ? 'Transaksi Jetton terkirim & terkonfirmasi' : 'Transaksi Jetton terkirim (belum dapat hash — cek explorer manual kalau perlu)',
        hash: txHash || undefined,
      });
      saveTxHistory({
        taskName: 'Transfer Jetton', description: `Kirim ${gramJettonAmt} ${gramJettonMeta.symbol} ke ${shortAddr(gramJettonTo)} di ${GRAM_NETWORK.name}`,
        to: gramJettonTo, value: gramJettonAmt, data: master,
        status: 'success', txHash: txHash || '', timestamp: Date.now(),
      });
      setGramJettonTo(''); setGramJettonAmt(''); setGramJettonComment('');
      gramLoadDetectedJettons();
    } catch (e: any) { setGramJettonStatus({ type: 'error', msg: gramFriendlyError(e) }); }
    setGramJettonSending(false);
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

  // ── Close Token Account: ambil SEMUA token account milik address aktif (SPL Token
  //    klasik + Token-2022), termasuk yang saldonya 0 — beda dari solFetchTokens yang
  //    cuma nampilin saldo > 0 untuk keperluan kirim. Tiap akun nyimpen rent ± 0.00203928
  //    SOL (dibaca langsung dari lamports akunnya) yang bisa ditarik balik saat ditutup. ──
  const solFetchCloseAccounts = async (conn?: Connection | null, addr?: string) => {
    const connection = conn ?? solConnRef.current;
    const address    = addr ?? solAddress;
    if (!connection || !address) return;
    setSolCloseLoading(true);
    try {
      const owner = new PublicKey(address);
      const [legacy, t22] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
      ]);
      const mapAccounts = (resp: typeof legacy, programId: PublicKey) => resp.value.map(({ pubkey, account }) => {
        const info = account.data.parsed.info;
        return {
          pubkey:    pubkey.toBase58(),
          mint:      info.mint as string,
          decimals:  info.tokenAmount.decimals as number,
          uiAmount:  (info.tokenAmount.uiAmount ?? 0) as number,
          programId: programId.toBase58(),
          lamports:  account.lamports as number,
        };
      });
      const all = [...mapAccounts(legacy, TOKEN_PROGRAM_ID), ...mapAccounts(t22, TOKEN_2022_PROGRAM_ID)];
      // Urutkan: akun saldo 0 (paling gampang ditutup) di atas, akun bersaldo di bawah.
      all.sort((a, b) => (a.uiAmount > 0 ? 1 : 0) - (b.uiAmount > 0 ? 1 : 0));
      setSolCloseAccounts(all);
      // Default: semua akun kosong langsung tercentang, siap ditutup massal.
      setSolCloseSelected(new Set(all.filter(a => a.uiAmount === 0).map(a => a.pubkey)));
      // Lengkapi detail (nama, simbol, gambar, tanggal dibuat) di belakang layar — tiap akun
      // langsung tampil dengan alamatnya dulu, detailnya nyusul satu per satu saat siap.
      void solEnrichCloseAccounts(connection, all);
    } catch { setSolCloseAccounts([]); }
    setSolCloseLoading(false);
  };

  // ── Ambil field "image" dari JSON off-chain metadata token (Arweave/IPFS/HTTP gateway) ──
  const solFetchImageFromUri = async (uri: string): Promise<string | undefined> => {
    if (!uri || !/^https?:\/\//i.test(uri)) return undefined;
    try {
      const res  = await fetch(uri);
      const json = await res.json();
      return typeof json?.image === 'string' ? json.image : undefined;
    } catch { return undefined; }
  };

  // ── Ambil metadata token (nama, simbol, gambar) untuk sebuah mint. Token-2022 disimpan
  //    langsung di mint account (extension TokenMetadata); SPL Token klasik disimpan di
  //    akun terpisah lewat Metaplex Token Metadata Program (PDA "metadata"). Kalau mint
  //    memang polos tanpa metadata (token lama/anonim), dibiarkan kosong — UI nampilin
  //    fallback nama "Token Tidak Dikenal" + avatar inisial, bukan blank kosong. ──
  const solFetchTokenMeta = async (
    connection: Connection, mint: string, programId: string,
  ): Promise<{ name?: string; symbol?: string; image?: string }> => {
    const cached = solTokenMetaCacheRef.current.get(mint);
    if (cached) return cached;
    const meta: { name?: string; symbol?: string; image?: string } = {};
    try {
      const mintPk = new PublicKey(mint);
      if (programId === TOKEN_2022_PROGRAM_ID.toBase58()) {
        const tm = await getTokenMetadata(connection, mintPk).catch(() => null);
        if (tm) {
          meta.name   = tm.name?.replace(/\0/g, '').trim() || undefined;
          meta.symbol = tm.symbol?.replace(/\0/g, '').trim() || undefined;
          const uri   = tm.uri?.replace(/\0/g, '').trim();
          if (uri) meta.image = await solFetchImageFromUri(uri);
        }
      }
      if (!meta.name) {
        // Fallback (atau memang SPL klasik): baca akun Metaplex Token Metadata Program.
        const metadataPda = getMetadataPda(mintPk);
        const info = await connection.getAccountInfo(metadataPda);
        if (info?.data) {
          const [parsed] = MplTokenMetadata.deserialize(info.data);
          meta.name   = parsed.data.name?.replace(/\0/g, '').trim() || undefined;
          meta.symbol = parsed.data.symbol?.replace(/\0/g, '').trim() || undefined;
          const uri   = parsed.data.uri?.replace(/\0/g, '').trim();
          if (uri) meta.image = await solFetchImageFromUri(uri);
        }
      }
    } catch {}
    solTokenMetaCacheRef.current.set(mint, meta);
    return meta;
  };

  const solFetchAccountCreatedAt = async (connection: Connection, ata: string): Promise<number | null> => {
    try {
      const pk = new PublicKey(ata);
      let before: string | undefined;
      let oldest: { blockTime?: number | null } | null = null;
      for (let i = 0; i < 5; i++) {
        const sigs = await connection.getSignaturesForAddress(pk, { limit: 1000, before }, 'confirmed');
        if (sigs.length === 0) break;
        oldest = sigs[sigs.length - 1];
        if (sigs.length < 1000) break;
        before = sigs[sigs.length - 1].signature;
      }
      return oldest?.blockTime ? oldest.blockTime * 1000 : null;
    } catch { return null; }
  };

  // ── Jalankan enrichment metadata + tanggal dibuat untuk semua akun, tiap akun update
  //    state-nya masing-masing begitu datanya siap (bukan nunggu semuanya kelar). ──
  const solEnrichCloseAccounts = async (connection: Connection, accs: { pubkey: string; mint: string; programId: string }[]) => {
    accs.forEach(acc => {
      solFetchTokenMeta(connection, acc.mint, acc.programId).then(meta => {
        setSolCloseAccounts(prev => prev.map(a => a.pubkey === acc.pubkey ? { ...a, ...meta, metaLoaded: true } : a));
      });
      solFetchAccountCreatedAt(connection, acc.pubkey).then(createdAt => {
        setSolCloseAccounts(prev => prev.map(a => a.pubkey === acc.pubkey ? { ...a, createdAt, createdAtLoaded: true } : a));
      });
    });
  };

  // ── Tutup satu token account: kalau masih ada saldo & user centang "bakar sisa saldo",
  //    burn dulu baru close dalam 1 transaksi; kalau saldo 0, langsung close. Rent-nya
  //    (dibayar SOL asli) otomatis balik ke wallet pemilik saat instruksi CloseAccount
  //    dieksekusi — berlaku sama persis di Mainnet, Testnet, maupun Devnet karena logic-nya
  //    murni bagian dari SPL Token Program, bukan hal spesifik-cluster. ──
  const solCloseTokenAccount = async (item: typeof solCloseAccounts[number]) => {
    const keypair    = solKeypairRef.current;
    const connection = solConnRef.current;
    if (!keypair || !connection) { showAlert('Connect wallet Solana dulu.', 'error'); return; }

    const burnFirst = !!solCloseBurnFirst[item.pubkey];
    if (item.uiAmount > 0 && !burnFirst) {
      showAlert('Akun token ini masih ada saldo. Centang "Bakar sisa saldo dulu" untuk menutupnya, atau kosongkan saldonya lewat Kirim/Sweep terlebih dahulu.', 'error');
      return;
    }

    const programId = new PublicKey(item.programId);
    const ataPk      = new PublicKey(item.pubkey);
    const reclaimSol = (item.lamports / LAMPORTS_PER_SOL).toFixed(6);

    const okClose = await requestTxConfirm({
      title: 'Tutup Akun Token',
      network: SOLANA_NETWORK.name,
      to: item.pubkey,
      value: item.uiAmount > 0
        ? `Bakar ${item.uiAmount} token (mint ${shortAddr(item.mint)}) lalu tutup akun — reclaim ± ${reclaimSol} SOL rent`
        : `Tutup akun token kosong (mint ${shortAddr(item.mint)}) — reclaim ± ${reclaimSol} SOL rent`,
    });
    if (!okClose) return;

    setSolClosingId(item.pubkey);
    try {
      const tx = new SolTransaction();
      if (item.uiAmount > 0) {
        const mintPk     = new PublicKey(item.mint);
        const rawAmount  = BigInt(Math.round(item.uiAmount * 10 ** item.decimals));
        tx.add(createBurnInstruction(ataPk, mintPk, keypair.publicKey, rawAmount, [], programId));
      }
      tx.add(createCloseAccountInstruction(ataPk, keypair.publicKey, keypair.publicKey, [], programId));

      const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
      showAlert(`Akun token ditutup. ± ${reclaimSol} SOL rent sudah kembali ke wallet.`, 'success');
      saveTxHistory({
        taskName: 'Close Token Account',
        description: `Tutup akun token (mint ${shortAddr(item.mint)}) di ${SOLANA_NETWORK.name}, reclaim ${reclaimSol} SOL`,
        to: item.pubkey, value: reclaimSol, data: '',
        status: 'success', txHash: sig, timestamp: Date.now(),
      });
      setSolCloseBurnFirst(prev => { const n = { ...prev }; delete n[item.pubkey]; return n; });
      setSolCloseSelected(prev => { const n = new Set(prev); n.delete(item.pubkey); return n; });
      await solFetchCloseAccounts();
      await solFetchTokens();
      await solRefreshBalance();
    } catch (e: any) {
      showAlert('Gagal menutup akun: ' + e.message, 'error');
    }
    setSolClosingId('');
  };

  // ── Toggle centang satu akun kosong untuk batch-close, plus helper pilih/batalkan semua. ──
  const solCloseToggleSelect = (pubkey: string) =>
    setSolCloseSelected(prev => {
      const n = new Set(prev);
      if (n.has(pubkey)) n.delete(pubkey); else n.add(pubkey);
      return n;
    });

  const solCloseToggleSelectAll = (pubkeys: string[]) =>
    setSolCloseSelected(prev => {
      const allSelected = pubkeys.length > 0 && pubkeys.every(p => prev.has(p));
      if (allSelected) {
        const n = new Set(prev);
        pubkeys.forEach(p => n.delete(p));
        return n;
      }
      return new Set([...prev, ...pubkeys]);
    });

  // ── Tutup semua akun kosong yang dicentang sekaligus (batch), berguna untuk
  //    "bersih-bersih" wallet & menarik balik seluruh rent yang nyangkut. Hanya akun
  //    bersaldo 0 yang boleh masuk batch ini — akun bersaldo tetap harus ditutup satu-satu
  //    lewat tombol "Bakar & Tutup Akun" supaya tidak ada token yang tak sengaja terbakar. ──
  const solCloseSelectedAccounts = async () => {
    const keypair    = solKeypairRef.current;
    const connection = solConnRef.current;
    if (!keypair || !connection) { showAlert('Connect wallet Solana dulu.', 'error'); return; }

    const targetAccs = solCloseAccounts.filter(a => a.uiAmount === 0 && solCloseSelected.has(a.pubkey));
    if (targetAccs.length === 0) { showAlert('Belum ada akun kosong yang dicentang untuk ditutup.', 'error'); return; }

    const totalLamports = targetAccs.reduce((s, a) => s + a.lamports, 0);
    const okAll = await requestTxConfirm({
      title: `Tutup ${targetAccs.length} Akun Token Terpilih`,
      network: SOLANA_NETWORK.name,
      to: solAddress,
      value: `Reclaim total ± ${(totalLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL rent dari ${targetAccs.length} akun`,
    });
    if (!okAll) return;

    setSolCloseAllRunning(true);
    let closedCount = 0, closedLamports = 0;
    for (const acc of targetAccs) {
      try {
        const tx = new SolTransaction().add(
          createCloseAccountInstruction(new PublicKey(acc.pubkey), keypair.publicKey, keypair.publicKey, [], new PublicKey(acc.programId))
        );
        await sendAndConfirmTransaction(connection, tx, [keypair]);
        closedCount++; closedLamports += acc.lamports;
        setSolCloseSelected(prev => { const n = new Set(prev); n.delete(acc.pubkey); return n; });
      } catch {}
    }
    saveTxHistory({
      taskName: 'Close Token Account',
      description: `Tutup ${closedCount}/${targetAccs.length} akun token terpilih di ${SOLANA_NETWORK.name}, reclaim ${(closedLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
      to: solAddress, value: (closedLamports / LAMPORTS_PER_SOL).toFixed(6), data: '',
      status: closedCount > 0 ? 'success' : 'failed', timestamp: Date.now(),
    });
    showAlert(
      closedCount > 0
        ? `${closedCount}/${targetAccs.length} akun berhasil ditutup, ± ${(closedLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL rent kembali.`
        : 'Tidak ada akun yang berhasil ditutup.',
      closedCount > 0 ? 'success' : 'error'
    );
    await solFetchCloseAccounts();
    await solRefreshBalance();
    setSolCloseAllRunning(false);
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
      await solFetchCloseAccounts(conn, solAddress);
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

  // Reset estimasi gas/fee tiap kali network/mode-nya ganti, biar nggak nampilin
  // angka basi dari network sebelumnya sebelum user klik "Cek Estimasi" lagi.
  useEffect(() => {
    setTcGasPriceGwei(null); setTcGasLimitEst(''); setTcGasFeeNative(''); setTcGasError('');
  }, [tcNetworkId, tcEvmMode]);

  useEffect(() => {
    setTcSolFeeSol(''); setTcSolFeeDetail(null); setTcSolFeeError('');
  }, [tcSolNetId, tcSolStandard, tcSolAddMeta]);

  useEffect(() => {
    setTcTronFeeEstimate(null); setTcTronFeeError('');
  }, [tcTronNetId]);

  // -- Estimasi gas EVM sebelum deploy: ambil gas price on-chain terkini + estimateGas
  // transaksi deploy yang sesungguhnya (template ERC-20 ATAU kontrak kustom yang sudah
  // di-compile), lalu kalikan buat dapat perkiraan total fee dalam native coin network ini. --
  const estimateTcEvmGas = async () => {
    if (!tcSelectedNetwork) { setTcGasError('Pilih network dulu.'); return; }
    if (tcEvmMode === 'custom' && !tcCompiled) { setTcGasError('Compile kode Solidity dulu sebelum cek estimasi gas.'); return; }
    setTcGasLoading(true);
    setTcGasError('');
    try {
      const provider = await getProvider(tcSelectedNetwork);
      const feeData  = await provider.getFeeData().catch(() => null);
      const gasPrice = feeData?.gasPrice ?? await provider.getGasPrice();
      const gwei     = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      const deployerAddr = (() => { try { return tcPrivKey.trim() ? new ethers.Wallet(tcPrivKey.trim()).address : undefined; } catch { return undefined; } })();

      let gasLimit: ethers.BigNumber;
      try {
        if (tcEvmMode === 'custom' && tcCompiled) {
          const ctorFragment = (tcCompiled.abi || []).find((f: any) => f.type === 'constructor');
          let ctorArgs: any[] = [];
          try {
            const rawArgs = safeParseContractArgs(tcCustomCtorArgs || '[]');
            ctorArgs = rawArgs.map((a: any, i: number) => parseArgWithAbiType(a, ctorFragment?.inputs?.[i] ?? { type: 'bytes' }));
          } catch {}
          const factory  = new ethers.ContractFactory(tcCompiled.abi, tcCompiled.bytecode);
          const deployTx = factory.getDeployTransaction(...ctorArgs);
          gasLimit = await provider.estimateGas({ ...deployTx, from: deployerAddr });
        } else {
          const decimals  = parseInt(tcDecimals, 10) || 18;
          const supplyBN  = (() => { try { return ethers.BigNumber.from(tcSupply.trim() || '1000000'); } catch { return ethers.BigNumber.from('1000000'); } })();
          const factory   = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE);
          const deployTx  = factory.getDeployTransaction(tcName.trim() || 'Token', (tcSymbol.trim() || 'TKN').toUpperCase(), decimals, supplyBN);
          gasLimit = await provider.estimateGas({ ...deployTx, from: deployerAddr });
        }
      } catch {
        // Fallback kalau estimateGas ditolak node (mis. belum isi private key) — angka wajar
        // berdasarkan pengalaman deploy template ERC-20 / kontrak kustom rata-rata.
        gasLimit = ethers.BigNumber.from(tcEvmMode === 'custom' ? 2_500_000 : 1_300_000);
      }
      const gasLimitBuffered = gasLimit.mul(115).div(100); // buffer 15% biar nggak "out of gas" pas eksekusi beneran
      const feeWei = gasPrice.mul(gasLimitBuffered);

      setTcGasPriceGwei(gwei);
      setTcGasLimitEst(gasLimitBuffered.toString());
      setTcGasFeeNative(parseFloat(ethers.utils.formatEther(feeWei)).toFixed(6));
    } catch (e: any) {
      setTcGasError(e?.reason || e?.message || 'Gagal mengambil estimasi gas dari network ini.');
    }
    setTcGasLoading(false);
  };

  // -- Estimasi biaya SPL Token sebelum dibuat: rent-exempt mint account + associated
  // token account + (kalau classic + metadata) rent akun Metaplex Metadata, ditambah
  // network fee dasar Solana (5000 lamports/signature × 2 signer: payer + mint keypair). --
  const METAPLEX_METADATA_RENT_LAMPORTS = 5_616_720; // ≈0.0056 SOL — rent-exempt akun Metadata V3 standar (perkiraan; nilai aktualnya dihitung & dipungut otomatis on-chain oleh program Metaplex saat instruksi createMetadataAccountV3 dieksekusi)
  const TOKEN_ACCOUNT_SIZE = 165; // ukuran baku akun token SPL (spl-token AccountLayout.span)

  const estimateTcSolFee = async () => {
    setTcSolFeeLoading(true);
    setTcSolFeeError('');
    try {
      const net = SOLANA_NETWORKS.find(n => n.id === tcSolNetId) ?? SOLANA_NETWORKS[0];
      const connection = await getSolanaConnection(net);

      let mintRent: number;
      if (tcSolStandard === 'token2022') {
        const mintLen = getMintLen([ExtensionType.MetadataPointer]);
        const dummyMeta: TokenMetadata = {
          updateAuthority: SystemProgram.programId,
          mint: SystemProgram.programId,
          name: tcSolName.trim() || 'Token Name',
          symbol: (tcSolSymbol.trim() || 'TKN').toUpperCase(),
          uri: tcSolAddMeta ? 'https://gateway.pinata.cloud/ipfs/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' : '',
          additionalMetadata: [],
        };
        const metadataLen = TOKEN_METADATA_TYPE_SIZE + TOKEN_METADATA_LENGTH_SIZE + packTokenMetadata(dummyMeta).length;
        mintRent = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
      } else {
        mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
      }

      const ataRent      = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);
      const metadataRent = (tcSolStandard === 'classic' && tcSolAddMeta) ? METAPLEX_METADATA_RENT_LAMPORTS : 0;
      const networkFee   = 2 * 5000; // payer + mint keypair baru = 2 signature

      const totalLamports = mintRent + ataRent + metadataRent + networkFee;
      setTcSolFeeDetail({ mintRent, ataRent, metadataRent, networkFee });
      setTcSolFeeSol((totalLamports / LAMPORTS_PER_SOL).toFixed(6));
    } catch (e: any) {
      setTcSolFeeError(e?.message || 'Gagal mengambil estimasi biaya dari network ini.');
    }
    setTcSolFeeLoading(false);
  };

  // -- Estimasi Energy/Bandwidth/fee TRX sebelum deploy TRC-20: pakai dry-run
  // triggerconstantcontract + cek resource akun (energy/bandwidth gratis vs staked)
  // lewat estimateTronDeployFee (Tronnet.ts) — fungsi yang sama yang jadi validator
  // saldo di deployTrc20Token, di sini dipanggil lebih awal cuma buat preview. --
  const estimateTcTronFee = async () => {
    const net = TRON_NETWORKS.find(n => n.id === tcTronNetId) ?? TRON_NETWORKS[0];
    let ownerAddress = '';
    try { ownerAddress = tcTronPrivKey.trim() ? tronAddressFromPrivateKey(tcTronPrivKey.trim()) : ''; } catch { ownerAddress = ''; }
    if (!ownerAddress) { setTcTronFeeError('Isi private key Tron deployer dulu buat estimasi Energy & fee.'); return; }

    setTcTronFeeLoading(true);
    setTcTronFeeError('');
    try {
      const name      = tcTronName.trim() || 'Token';
      const symbol    = (tcTronSymbol.trim() || 'TKN').toUpperCase();
      const decimals  = parseInt(tcTronDecimals) || 0;
      const supplyIntStr = (tcTronSupply || '1000000').split('.')[0].replace(/[^0-9]/g, '') || '1000000';
      const supplyRaw = ethers.BigNumber.from(supplyIntStr);
      const parameter = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'uint8', 'uint256'],
        [name, symbol, decimals, supplyRaw],
      ).slice(2);
      const bytecodeHex = ERC20_BYTECODE.replace(/^0x/, '');
      const est = await estimateTronDeployFee(net, ownerAddress, bytecodeHex, parameter);
      setTcTronFeeEstimate(est);
    } catch (e: any) {
      setTcTronFeeError(tronFriendlyError(e?.message || 'Gagal mengambil estimasi Energy/fee.'));
    }
    setTcTronFeeLoading(false);
  };

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

  const handleTcTronWalletSel = (val: string) => {
    setTcTronWalletSel(val);
    if (!val) return;
    const [wi, ai] = val.split(',').map(Number);
    const w    = wallets[wi];
    const addr = w?.tronAddresses?.find(a => a.index === ai);
    if (addr) setTcTronPrivKey(addr.privateKey);
  };

  // -- Pilih wallet Gram (TON) tersimpan buat jadi admin/deployer Jetton --
  // Beda dari chain lain: gramAddress bukan array per-index tapi 1 objek per
  // wallet (lihat BIP39Wallet di types.ts), dan versi wallet contract-nya
  // (v4/v5r1) ikut otomatis dari wallet yang dipilih (address beda per versi).
  const handleTcGramWalletSel = (val: string) => {
    setTcGramWalletSel(val);
    if (!val) return;
    const wi = Number(val);
    const w  = wallets[wi];
    if (w?.gramAddress) {
      setTcGramPrivKey(w.gramAddress.privateKey);
      setTcGramVersion(w.gramAddress.version);
    }
  };

  // -- Bangun JSON metadata Jetton dari isian form (sama pola dgn SPL Token) --
  const buildTcGramMetadataJson = (): Record<string, string> => {
    const name = tcGramName.trim();
    const symbol = tcGramSymbol.trim().toUpperCase();
    const description = tcGramDescription.trim();
    const image = tcGramImageUrl.trim();
    const decimals = parseInt(tcGramDecimals, 10);
    return {
      name,
      symbol,
      // TEP-64: decimals wajib ada (sbg string) — tanpa ini beberapa
      // wallet/explorer TON menolak/skip seluruh metadata (termasuk image).
      decimals: String(isNaN(decimals) ? 9 : decimals),
      ...(description && { description }),
      // Simpan sebagai ipfs:// (bukan link gateway Pinata https langsung) —
      // supaya explorer TON (Tonviewer/Tonscan/Tonkeeper) resolve image
      // lewat gateway pilihan mereka sendiri, bukan bergantung 1 gateway
      // yang bisa rate-limit/block fetch dari server explorer. Lihat
      // toIpfsUri() di helpers.ts untuk detail.
      ...(image && { image: toIpfsUri(image) }),
    };
  };

  // Upload JSON metadata Jetton ke IPFS lewat Pinata — pakai JWT yang sama dengan
  // tab SPL Token (1 akun Pinata dipakai bareng, lihat catatan di TokenTab.tsx).
  const uploadTcGramMetadataJson = async (): Promise<string> => {
    const jwt = tcSolPinataJwt.trim();
    if (!jwt) {
      throw new Error('Isi Pinata JWT API Key dulu (gratis, daftar di app.pinata.cloud/keys) — dipakai bersama tab SPL Token.');
    }
    const json = buildTcGramMetadataJson();
    return pinataUploadJson(json, jwt, `${json.symbol || 'jetton'}-metadata.json`);
  };

  // Upload file gambar Jetton ke IPFS lewat Pinata (resize dulu, sama persis pola handleTcSolImageFile).
  const handleTcGramImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showAlert('File yang dipilih harus berupa gambar.', 'error'); return; }
    const jwt = tcSolPinataJwt.trim();
    if (!jwt) { showAlert('Isi Pinata JWT API Key dulu (gratis, daftar di app.pinata.cloud/keys) sebelum upload gambar.', 'error'); return; }

    const reader = new FileReader();
    reader.onerror = () => showAlert('Gagal membaca file gambar.', 'error');
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => showAlert('Gagal memproses file gambar.', 'error');
      img.onload = async () => {
        const SIZE = 512;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) { showAlert('Browser tidak mendukung pemrosesan gambar.', 'error'); return; }
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
        canvas.toBlob(async (blob) => {
          if (!blob) { showAlert('Gagal mengkompresi gambar.', 'error'); return; }
          setTcGramImageUploading(true);
          try {
            const url = await pinataUploadFile(blob, jwt, file.name || 'logo.jpg');
            setTcGramImageUrl(url);
          } catch (err: any) {
            showAlert(err?.message || 'Gagal upload gambar ke IPFS.', 'error');
          }
          setTcGramImageUploading(false);
        }, 'image/jpeg', 0.85);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Live-preview JSON metadata yang akan di-upload ke IPFS saat deploy.
  const tcGramMetaPreview = useMemo(
    () => ({ json: buildTcGramMetadataJson() }),
    [tcGramName, tcGramSymbol, tcGramDescription, tcGramImageUrl],
  );

  // -- Estimasi fee jaringan (dry-run, TIDAK broadcast) sebelum deploy Jetton --
  const estimateTcGramFee = async () => {
    const pk = tcGramPrivKey.trim();
    if (!pk) { setTcGramFeeError('Isi private key Gram (TON) dulu.'); return; }
    setTcGramFeeLoading(true);
    setTcGramFeeError('');
    try {
      const decimals = parseInt(tcGramDecimals, 10);
      const detail = await estimateGramJettonDeployFee(tcGramSelectedNetwork, pk, {
        decimals: isNaN(decimals) ? 9 : decimals,
        totalSupply: Number(tcGramSupply) || undefined,
        // Bug lama: kirim tcGramImageUrl (link gambar) sebagai metadataUri,
        // padahal metadataUri seharusnya link JSON metadata (belum ada saat
        // estimasi, karena upload ke IPFS baru terjadi pas tombol Deploy
        // ditekan). Biarkan undefined supaya estimateGramJettonDeployFee
        // pakai placeholder URI internal (panjang wajar, mendekati ukuran
        // link Pinata asli) — hasil estimasi jadi lebih akurat & konsisten.
        metadataUri: undefined,
      }, tcGramVersion);
      setTcGramFeeDetail(detail);
      setTcGramFeeGram(detail.totalFeeGram.toFixed(6));
    } catch (e: any) {
      setTcGramFeeError(gramFriendlyError(e?.message || 'Gagal mengambil estimasi fee.'));
    }
    setTcGramFeeLoading(false);
  };

  // -- Deploy Jetton baru: upload metadata ke IPFS dulu, lalu 1 tx deploy minter + mint --
  const createGramJetton = async () => {
    const pk = tcGramPrivKey.trim();
    if (!pk) { showAlert('Isi private key Gram (TON) dulu, atau pilih dari wallet tersimpan.', 'error'); return; }
    const name = tcGramName.trim();
    const symbol = tcGramSymbol.trim().toUpperCase();
    if (!name)   { showAlert('Nama token wajib diisi.', 'error'); return; }
    if (!symbol) { showAlert('Symbol token wajib diisi.', 'error'); return; }
    const decimals = parseInt(tcGramDecimals, 10);
    if (isNaN(decimals) || decimals < 0 || decimals > 18) { showAlert('Decimals harus 0–18.', 'error'); return; }
    const supplyNum = Number(tcGramSupply);
    if (!tcGramSupply.trim() || isNaN(supplyNum) || supplyNum <= 0) { showAlert('Total supply tidak valid.', 'error'); return; }

    const net = tcGramSelectedNetwork;
    let adminAddress = '';
    try { adminAddress = gramAddressFromPrivateKey(pk, tcGramVersion); }
    catch { showAlert('Private key Gram (TON) tidak valid.', 'error'); return; }

    const ok = await requestTxConfirm({
      title: `Deploy Jetton: ${name} (${symbol})`,
      network: net.name,
      value: `Supply ${tcGramSupply} ${symbol} · ${decimals} decimals`,
      extra: `1 transaksi: deploy kontrak minter baru + mint seluruh total supply ke wallet admin ini (${shortAddr(adminAddress)}). ` +
        `Metadata (name/symbol${tcGramDescription.trim() ? '/description' : ''}${tcGramImageUrl.trim() ? '/image' : ''}) akan di-upload ke IPFS lewat Pinata dulu sebelum deploy, lalu link-nya dipakai sebagai content URI on-chain (wajib, standar TEP-64).`,
    });
    if (!ok) return;

    setTcGramCreating(true);
    try {
      setTcGramStatus({ type: 'pending', msg: 'Meng-upload metadata ke IPFS (Pinata)...' });
      const metaUri = await uploadTcGramMetadataJson();
      // Content URI yang ditulis ON-CHAIN dipakai dalam bentuk ipfs:// (bukan
      // link gateway https Pinata) — supaya explorer TON resolve lewat
      // gateway mereka sendiri dan logo/nama token tampil dengan benar
      // (lihat catatan di toIpfsUri, helpers.ts). Link https tetap dipakai
      // untuk tombol "Lihat JSON Metadata" di UI (ipfs:// tidak bisa dibuka
      // langsung di tab browser biasa).
      const metaUriOnChain = toIpfsUri(metaUri);

      setTcGramStatus({ type: 'pending', msg: `Deploy Jetton ke ${net.name}... (broadcast + tunggu konfirmasi, bisa ~10-60 detik)` });
      const { jettonMasterAddress, jettonWalletAddress, txHash } = await deployGramJetton(net, pk, {
        metadataUri: metaUriOnChain, totalSupply: supplyNum, decimals,
      }, tcGramVersion);

      const newToken: CreatedGramToken = {
        id: Date.now().toString(),
        masterAddress: jettonMasterAddress,
        walletAddress: jettonWalletAddress,
        netId: net.id,
        networkName: net.name,
        name, symbol, decimals,
        initialSupply: tcGramSupply.trim(),
        version: tcGramVersion,
        txHash,
        createdAt: Date.now(),
        metadataUri: metaUri,
        imageUrl: tcGramImageUrl.trim() || undefined,
        description: tcGramDescription.trim() || undefined,
      };
      setGramTokens(prev => [newToken, ...prev]);
      setTcGramStatus({ type: 'success', msg: `Jetton berhasil dibuat! Master: ${jettonMasterAddress}` });
      showAlert(`Jetton "${name}" berhasil dibuat!`, 'success');
      saveTxHistory({
        taskName: 'Deploy Jetton', description: `Deploy Jetton ${name} (${symbol}) di ${net.name}`,
        to: jettonMasterAddress, value: tcGramSupply.trim(), data: '',
        status: 'success', txHash, timestamp: Date.now(),
      });
      setTcGramName(''); setTcGramSymbol(''); setTcGramSupply('1000000');
      setTcGramImageUrl(''); setTcGramDescription('');
      setTcGramFeeDetail(null); setTcGramFeeGram('');
    } catch (e: any) {
      const msg = gramFriendlyError(e?.message || 'Gagal membuat Jetton.');
      setTcGramStatus({ type: 'error', msg: String(msg).slice(0, 200) });
      showAlert('Gagal: ' + String(msg).slice(0, 160), 'error');
    }
    setTcGramCreating(false);
  };

  const deleteGramToken = (id: string) => {
    setConfirmData({
      isOpen: true, title: 'HAPUS DARI DAFTAR?',
      message: 'Ini hanya menghapus catatan lokal — kontrak Jetton tetap ada di blockchain.',
      action: () => { setGramTokens(prev => prev.filter(t => t.id !== id)); showAlert('Catatan token dihapus.', 'hapus'); },
    });
  };

  // -- Deploy token TRC-20 (pakai ulang bytecode/ABI ERC-20, valid krn ABI Solidity sama) --
  const deployTrc20Token = async () => {
    const net = TRON_NETWORKS.find(n => n.id === tcTronNetId) ?? TRON_NETWORKS[0];
    const pk = tcTronPrivKey.trim();
    if (!pk) { showAlert('Masukkan private key Tron dulu.', 'error'); return; }
    const name = tcTronName.trim();
    const symbol = tcTronSymbol.trim().toUpperCase();
    const decimals = parseInt(tcTronDecimals) || 0;
    if (!name || !symbol) { showAlert('Nama & simbol token wajib diisi.', 'error'); return; }
    if (decimals < 0 || decimals > 18) { showAlert('Decimals harus 0–18.', 'error'); return; }
    if (!tcTronSupply || parseFloat(tcTronSupply) <= 0) { showAlert('Total supply tidak valid.', 'error'); return; }

    let ownerAddress: string;
    try { ownerAddress = tronAddressFromPrivateKey(pk); }
    catch { showAlert('Private key Tron tidak valid.', 'error'); return; }

    const okDeploy = await requestTxConfirm({
      title: 'Deploy Token TRC-20',
      network: net.name,
      value: `${name} (${symbol}) · supply ${tcTronSupply}`,
      extra: 'Sebelum broadcast, saldo TRX & Energy kamu bakal dicek dulu (constructor deploy ERC-20 butuh Energy cukup besar) — kalau kurang, akan ditolak di sini dengan pesan jelas dulu daripada gagal di tengah jalan. Bytecode-nya pakai ulang template ERC-20 (ABI Solidity identik antara TVM & EVM); kalau tetap gagal karena opcode tidak didukung, coba dulu di testnet (Nile/Shasta).',
    });
    if (!okDeploy) return;

    setTcTronCreating(true);
    setTcTronStatus({ type: 'pending', msg: `Deploy contract ke ${net.name}... (estimasi Energy, lalu broadcast + tunggu konfirmasi block, bisa ~10-90 detik)` });
    try {
      const { txId, contractAddress, pending } = await tronDeployTrc20(net, ownerAddress, pk, { name, symbol, decimals, supply: tcTronSupply });
      // PENTING (bug): dulu kalau tronDeployTrc20 timeout nunggu konfirmasi, dia throw
      // dan blok "catch" di bawah yang jalan — token-nya nggak pernah masuk trc20Tokens
      // walau tx-nya sendiri kerap TETAP sukses on-chain beberapa saat kemudian (kejadian
      // nyata: sukses di Tronscan, tapi hilang dari daftar app). Sekarang kasus "pending"
      // itu bukan exception lagi, jadi selalu disimpan di sini — dengan address kosong
      // dulu kalau belum ke-konfirmasi, dan bisa di-refresh manual (tombol di bawah).
      setTcTronStatus({
        type: pending ? 'pending' : 'success',
        msg: pending
          ? `TX sudah ter-broadcast (txID: ${txId.slice(0, 14)}...) tapi belum sempat ke-konfirmasi dalam waktu tunggu. Kemungkinan besar tetap sukses — token sudah ditambahkan ke daftar di bawah, klik "Cek Status" di situ buat refresh alamat contract-nya setelah beberapa saat.`
          : (contractAddress ? `Token berhasil dibuat: ${contractAddress}` : 'Deploy terkirim — cek Tronscan untuk contract address.'),
      });
      setTrc20Tokens(prev => [{
        netId: net.id, address: contractAddress, symbol, decimals, name, supply: tcTronSupply,
        txId, createdAt: Date.now(), pending: !!pending,
      }, ...prev]);
      saveTxHistory({
        taskName: 'Deploy TRC-20', description: `Deploy token ${name} (${symbol}) di ${net.name}${pending ? ' (menunggu konfirmasi)' : ''}`,
        to: contractAddress || '', value: tcTronSupply, data: '',
        status: pending ? 'pending' : 'success', txHash: txId, timestamp: Date.now(),
      });
      setTcTronName(''); setTcTronSymbol(''); setTcTronSupply('1000000');
    } catch (e: any) {
      setTcTronStatus({ type: 'error', msg: tronFriendlyError(e.message) });
    }
    setTcTronCreating(false);
  };

  // -- Refresh status token TRC-20 yang masih "pending" (belum sempat ke-konfirmasi
  // waktu deploy) — cek ulang gettransactioninfobyid pakai txId yang udah tersimpan,
  // supaya alamat contract-nya bisa ke-isi tanpa perlu deploy ulang dari nol.
  const [tcTronRefreshing, setTcTronRefreshing] = useState<string | null>(null);
  const refreshPendingTrc20 = async (txId: string, netId: string) => {
    const net = TRON_NETWORKS.find(n => n.id === netId) ?? TRON_NETWORKS[0];
    setTcTronRefreshing(txId);
    try {
      const info = await tronGetTxInfo(net, txId);
      if (!info.found) { showAlert('Belum ke-konfirmasi juga — coba lagi beberapa saat lagi, atau cek manual di Tronscan.', 'error'); return; }
      if (!info.success) {
        setTrc20Tokens(prev => prev.filter(t => t.txId !== txId));
        showAlert(`Deploy ini ternyata GAGAL on-chain (${info.result}${info.revertReason ? ` — ${info.revertReason}` : ''}) — dihapus dari daftar.`, 'error');
        return;
      }
      const address = info.contractAddressHex ? tronAddressHexToBase58(info.contractAddressHex) : '';
      setTrc20Tokens(prev => prev.map(t => t.txId === txId ? { ...t, address, pending: false } : t));
      showAlert(address ? `Terkonfirmasi! Contract address: ${address}` : 'Terkonfirmasi, tapi contract address belum kebaca — cek manual di Tronscan.', 'success');
    } catch (e: any) {
      showAlert(tronFriendlyError(e?.message || 'Gagal cek status.'), 'error');
    }
    setTcTronRefreshing(null);
  };

  // -- Bangun JSON metadata SPL Token dari isian form --
  // JSON ini nanti di-upload ke IPFS (lewat Pinata) dan link gateway-nya (https://) yang
  // dipakai sebagai `uri` on-chain — bukan data:application/json;base64,... — supaya
  // explorer/wallet yang fetch metadata via server (bukan browser) bisa benar-benar
  // resolve JSON & gambarnya.
  const buildTcSolMetadataJson = (): Record<string, string> => {
    const name = tcSolName.trim();
    const symbol = tcSolSymbol.trim().toUpperCase();
    const description = tcSolDescription.trim();
    const image = tcSolImageUrl.trim();
    return { name, symbol, ...(description && { description }), ...(image && { image }) };
  };

  // Upload JSON metadata (name/symbol/description/image) ke IPFS lewat Pinata, kembalikan
  // link gateway https://-nya. Dipakai baik oleh standar classic (Metaplex) maupun token2022.
  const uploadTcSolMetadataJson = async (): Promise<string> => {
    const jwt = tcSolPinataJwt.trim();
    if (!jwt) {
      throw new Error('Isi Pinata JWT API Key dulu (gratis, daftar di app.pinata.cloud/keys) sebelum menyertakan metadata on-chain.');
    }
    const json = buildTcSolMetadataJson();
    return pinataUploadJson(json, jwt, `${json.symbol || 'token'}-metadata.json`);
  };

  // Upload file gambar mentah (di-resize dulu biar tidak kebesaran) ke IPFS lewat Pinata,
  // hasilnya link gateway https:// yang dipakai sebagai field "image" di JSON metadata.
  const handleTcSolImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset supaya file yang sama bisa dipilih ulang
    if (!file) return;
    if (!file.type.startsWith('image/')) { showAlert('File yang dipilih harus berupa gambar.', 'error'); return; }
    const jwt = tcSolPinataJwt.trim();
    if (!jwt) { showAlert('Isi Pinata JWT API Key dulu (gratis, daftar di app.pinata.cloud/keys) sebelum upload gambar.', 'error'); return; }

    const reader = new FileReader();
    reader.onerror = () => showAlert('Gagal membaca file gambar.', 'error');
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => showAlert('Gagal memproses file gambar.', 'error');
      img.onload = async () => {
        const SIZE = 512; // resize wajar biar upload cepat & hemat kuota, bukan thumbnail super kecil
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) { showAlert('Browser tidak mendukung pemrosesan gambar.', 'error'); return; }
        const s = Math.min(img.width, img.height); // crop tengah jadi persegi
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
        canvas.toBlob(async (blob) => {
          if (!blob) { showAlert('Gagal mengkompresi gambar.', 'error'); return; }
          setTcSolImageUploading(true);
          try {
            const url = await pinataUploadFile(blob, jwt, file.name || 'logo.jpg');
            setTcSolImageUrl(url);
          } catch (err: any) {
            showAlert(err?.message || 'Gagal upload gambar ke IPFS.', 'error');
          }
          setTcSolImageUploading(false);
        }, 'image/jpeg', 0.85);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Dipakai UI utk live-preview JSON yang akan di-upload ke IPFS (sama untuk classic & token2022)
  const tcSolMetaPreview = useMemo(
    () => ({ json: buildTcSolMetadataJson() }),
    [tcSolName, tcSolSymbol, tcSolDescription, tcSolImageUrl],
  );

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

  // -- Deploy kontrak ERC-20 ke jaringan EVM yang dipilih --
  const deployErc20Token = async () => {
    const pk = tcPrivKey.trim();
    if (!pk)                    { showAlert('Pilih wallet atau masukkan private key deployer.', 'error'); return; }
    if (!tcSelectedNetwork)     { showAlert('Pilih network dulu.', 'error'); return; }

    // ══ Mode: Kode Solidity Kustom ══
    if (tcEvmMode === 'custom') {
      if (!tcCompiled) { showAlert('Compile kode Solidity dulu sebelum deploy.', 'error'); return; }

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
        extra: `Constructor args: ${tcCustomCtorArgs || '[]'}. Kode ini BUKAN template audited bawaan — kamu bertanggung jawab penuh atas isi kontrak.`,
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
        setTcCustomSolidity(''); setTcCompiled(null); setTcCustomCtorArgs('[]');
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

    const metaName = tcSolName.trim();
    const metaSymbol = tcSolSymbol.trim().toUpperCase();
    if (metaName.length > SPL_META_MAX.name) { showAlert(`Nama token maksimal ${SPL_META_MAX.name} karakter.`, 'error'); return; }
    if (metaSymbol.length > SPL_META_MAX.symbol) { showAlert(`Symbol token maksimal ${SPL_META_MAX.symbol} karakter.`, 'error'); return; }

    const tcSolNet = SOLANA_NETWORKS.find(n => n.id === tcSolNetId) ?? SOLANA_NETWORKS[0];
    const rawAmount = BigInt(Math.round(supplyNum * (10 ** decimals)));

    // ══════════ Standar Token-2022 (Token Extensions, gaya pump.fun) ══════════
    // Metadata (name/symbol/uri) nempel LANGSUNG di mint account lewat extension
    // "metadataPointer" + "tokenMetadata". `uri` menunjuk ke JSON off-chain (di-upload ke
    // IPFS lewat Pinata) yang berisi name/symbol/description/image — sama seperti pola
    // Metaplex classic — supaya explorer/wallet (Solscan, Phantom, dst) bisa resolve gambar.
    if (tcSolStandard === 'token2022') {
      const metaJson = buildTcSolMetadataJson();

      const ok = await requestTxConfirm({
        title: `Buat Token-2022: ${metaName} (${metaSymbol})`,
        network: tcSolNet.name,
        extra: `Decimals: ${decimals} · Total Supply: ${tcSolSupply} ${metaSymbol} — akan di-mint seluruhnya ke wallet ini. ` +
          `Standar: Token-2022 (Token Extensions, gaya pump.fun) — metadata ditulis LANGSUNG di mint account, tanpa akun Metaplex terpisah.` +
          (tcSolAddMeta ? ` JSON metadata (name/symbol${metaJson.description ? '/description' : ''}${metaJson.image ? '/image' : ''}) akan di-upload ke IPFS lewat Pinata.` : ''),
      });
      if (!ok) return;

      setTcSolCreating(true);
      try {
        let metaUri = '';
        if (tcSolAddMeta) {
          setTcSolStatus({ type: 'pending', msg: 'Meng-upload metadata ke IPFS (Pinata)...' });
          metaUri = await uploadTcSolMetadataJson();
        }

        setTcSolStatus({ type: 'pending', msg: 'Menyiapkan mint account (Token-2022)...' });
        const connection  = await getSolanaConnection(tcSolNet);
        const secret      = bs58.decode(pk);
        const payer       = SolKeypair.fromSecretKey(secret);
        const mintKeypair = SolKeypair.generate();

        const tokenMetadata: TokenMetadata = {
          updateAuthority: payer.publicKey,
          mint: mintKeypair.publicKey,
          name: metaJson.name,
          symbol: metaJson.symbol,
          uri: metaUri,
          additionalMetadata: [],
        };

        const mintLen = getMintLen([ExtensionType.MetadataPointer]);
        const metadataLen = TOKEN_METADATA_TYPE_SIZE + TOKEN_METADATA_LENGTH_SIZE + packTokenMetadata(tokenMetadata).length;
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
        const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);

        const tx = new SolTransaction().add(
          SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: mintLen,
            lamports,
            programId: TOKEN_2022_PROGRAM_ID,
          }),
          createInitializeMetadataPointerInstruction(
            mintKeypair.publicKey, payer.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID,
          ),
          createInitializeMintInstruction(
            mintKeypair.publicKey, decimals, payer.publicKey, payer.publicKey, TOKEN_2022_PROGRAM_ID,
          ),
          createInitializeTokenMetadataInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            metadata: mintKeypair.publicKey,
            updateAuthority: payer.publicKey,
            mint: mintKeypair.publicKey,
            mintAuthority: payer.publicKey,
            name: metaJson.name,
            symbol: metaJson.symbol,
            uri: metaUri,
          }),
        );

        tx.add(
          createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID),
          createMintToInstruction(mintKeypair.publicKey, ata, payer.publicKey, rawAmount, [], TOKEN_2022_PROGRAM_ID),
        );

        setTcSolStatus({ type: 'pending', msg: 'Mengirim transaksi ke Solana...' });
        const sig = await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair]);

        const newToken: CreatedSplToken = {
          id: Date.now().toString(),
          mint: mintKeypair.publicKey.toBase58(),
          networkId: tcSolNet.id,
          networkName: tcSolNet.name,
          name: metaJson.name,
          symbol: metaJson.symbol,
          decimals,
          initialSupply: tcSolSupply.trim(),
          mintAuthority: payer.publicKey.toBase58(),
          txHash: sig,
          createdAt: Date.now(),
          hasMetadata: tcSolAddMeta,
          metadataUri: metaUri || undefined,
          imageUrl: tcSolImageUrl.trim() || undefined,
          description: tcSolDescription.trim() || undefined,
          standard: 'token2022',
        };
        setSplTokens(prev => [newToken, ...prev]);
        setTcSolStatus({ type: 'success', msg: `Token-2022 berhasil dibuat! Mint: ${mintKeypair.publicKey.toBase58()}` });
        showAlert(`Token-2022 "${metaJson.name}" berhasil dibuat!`, 'success');
        setTcSolName(''); setTcSolSymbol(''); setTcSolSupply('1000000');
        setTcSolImageUrl(''); setTcSolDescription('');
      } catch (e: any) {
        const msg = e?.message || 'Gagal membuat Token-2022.';
        setTcSolStatus({ type: 'error', msg: String(msg).slice(0, 200) });
        showAlert('Gagal: ' + String(msg).slice(0, 160), 'error');
      }
      setTcSolCreating(false);
      return;
    }

    // ══════════ Standar Classic (SPL Token + Metaplex Token Metadata Program) ══════════
    // URI metadata TIDAK diambil dari input https://, tapi di-generate otomatis dari form
    // (nama/symbol/image/deskripsi) menjadi JSON, di-upload ke IPFS lewat Pinata, dan link
    // gateway https://-nya (bukan data: URI) dipakai sebagai `uri` on-chain — supaya
    // explorer/wallet yang fetch metadata via server bisa benar-benar resolve gambarnya.
    const metaJsonPreview = buildTcSolMetadataJson();

    const ok = await requestTxConfirm({
      title: `Buat SPL Token: ${tcSolName} (${tcSolSymbol.toUpperCase()})`,
      network: tcSolNet.name,
      extra: `Decimals: ${decimals} · Total Supply: ${tcSolSupply} ${tcSolSymbol.toUpperCase()} — akan di-mint seluruhnya ke wallet ini. ${
        tcSolAddMeta
          ? `Metadata on-chain (Metaplex) AKAN dibuat: name="${metaName}", symbol="${metaSymbol}" — JSON metadata (${['name','symbol', metaJsonPreview.description && 'description', metaJsonPreview.image && 'image'].filter(Boolean).join('/')}) akan di-upload ke IPFS lewat Pinata lebih dulu, lalu link-nya dipakai sebagai uri. Wallet/explorer lain akan menampilkan nama & logo token ini dengan benar.`
          : 'Metadata on-chain (Metaplex) TIDAK disertakan — nama/symbol hanya tersimpan lokal, wallet lain mungkin menampilkan token ini sebagai "Unknown Token".'
      }`,
    });
    if (!ok) return;

    setTcSolCreating(true);
    try {
      let metaUri = '';
      if (tcSolAddMeta) {
        setTcSolStatus({ type: 'pending', msg: 'Meng-upload metadata ke IPFS (Pinata)...' });
        metaUri = await uploadTcSolMetadataJson();
        if (metaUri.length > SPL_META_MAX.uri) {
          // Praktis mustahil (link gateway Pinata jauh di bawah 200 char), tapi tetap dijaga
          // supaya konsisten dengan batas keras program Metaplex on-chain.
          throw new Error(`URI metadata (${metaUri.length} karakter) melebihi batas ${SPL_META_MAX.uri} karakter dari program Metaplex.`);
        }
      }

      setTcSolStatus({ type: 'pending', msg: 'Menyiapkan mint account...' });
      const connection = await getSolanaConnection(tcSolNet);
      const secret      = bs58.decode(pk);
      const payer       = SolKeypair.fromSecretKey(secret);
      const mintKeypair = SolKeypair.generate();

      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, payer.publicKey);
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
        standard: 'classic',
      };
      setSplTokens(prev => [newToken, ...prev]);
      setTcSolStatus({ type: 'success', msg: `SPL Token berhasil dibuat${tcSolAddMeta ? ' (dengan metadata on-chain)' : ''}! Mint: ${mintKeypair.publicKey.toBase58()}` });
      showAlert(`SPL Token "${metaName}" berhasil dibuat!`, 'success');
      setTcSolName(''); setTcSolSymbol(''); setTcSolSupply('1000000');
      setTcSolImageUrl(''); setTcSolDescription('');
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
        {knownTxTokens.map(t => {
          const fetched = txTokens.find(x => x.address.toLowerCase() === t.address.toLowerCase());
          const balLabel = fetched
            ? parseFloat(fetched.balance).toLocaleString(undefined,{maximumFractionDigits:6})
            : (txTokensLoading ? '...' : '?');
          return (
            <option key={t.address} value={t.address}>
              {t.symbol} · {shortAddr(t.address)} · saldo {balLabel}
            </option>
          );
        })}
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

    const nativeSymbol = selectedNetwork?.symbol ?? 'ETH';
    const effGasLimit = parseInt(txGasLimit) || 21000;

    // Estimasi total fee = gasPrice (Gwei) * gasLimit, dikonversi ke native coin (ETH/BNB/dll).
    const estimateFeeEth = (gwei: number | null): string | null => {
      if (gwei === null || !isFinite(gwei) || gwei <= 0) return null;
      const feeEth = (gwei * effGasLimit) / 1e9;
      if (feeEth === 0) return null;
      // Tampilkan lebih banyak desimal kalau nilainya sangat kecil.
      const decimals = feeEth < 0.0001 ? 8 : feeEth < 0.01 ? 6 : 4;
      return feeEth.toFixed(decimals);
    };

    const manualGwei = txGasMode === 'manual' ? parseFloat(txGasManual) : NaN;
    const currentFeeEth = txGasMode === 'manual'
      ? estimateFeeEth(isFinite(manualGwei) ? manualGwei : null)
      : estimateFeeEth(currentGwei);

    return (
      <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#888', flexWrap:'wrap' }}>
            <FaGasPump size={11} color="#f3ba2f"/>
            <span>Gas: <strong style={{ color:'#f3ba2f' }}>{modeLabels[txGasMode]}</strong></span>
            {currentGwei !== null && <span style={{ color:'#555', fontFamily:'monospace' }}>~{currentGwei.toFixed(2)} Gwei</span>}
            {txGasMode === 'manual' && <span style={{ color:'#555', fontFamily:'monospace' }}>{txGasManual || '?'} Gwei</span>}
            {currentFeeEth !== null && (
              <span style={{ color:'#4caf50', fontFamily:'monospace', background:'#0a1a0a', border:'1px solid #1a2a1a', padding:'2px 6px' }}>
                ≈ {currentFeeEth} {nativeSymbol}
              </span>
            )}
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
                      <>
                        <div style={{ fontSize:'10px', color:'#888', fontFamily:'monospace' }}>{gpVal.toFixed(2)} Gwei</div>
                        {estimateFeeEth(gpVal) !== null && (
                          <div style={{ fontSize:'9px', color:'#4caf50', fontFamily:'monospace', marginTop:'1px' }}>
                            ≈{estimateFeeEth(gpVal)} {nativeSymbol}
                          </div>
                        )}
                      </>
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
                {currentFeeEth !== null && (
                  <div style={{ gridColumn:'1 / -1', fontSize:'10px', color:'#4caf50', fontFamily:'monospace' }}>
                    Estimasi total fee ≈ {currentFeeEth} {nativeSymbol}
                  </div>
                )}
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

  // ── Selector Gas Cosmos (Slow/Standard/Fast/Manual) — mirror renderGasFeeBox EVM di atas,
  // tapi satuan uatom/unit gas (bukan Gwei/ETH) & "Refresh Gas" cuma re-trigger simulate() dry-run
  // (tier Slow/Standard/Fast sendiri tetap dari chain-registry, bukan oracle live seperti EVM). ──
  const renderAtomGasFeeBox = () => {
    const modeLabels: Record<AtomGasMode, string> = {
      slow: 'Slow', standard: 'Standard', fast: 'Fast', manual: 'Manual',
    };
    const gasPriceUatom = atomGetGasPriceUatom();

    // Estimasi total fee = gasUnits (dari simulate() terakhir, kalau ada) × gasPrice tier ini.
    const estimateFeeAtomFor = (priceUatom: number): string | null => {
      if (!atomFeeEstimate || !isFinite(priceUatom) || priceUatom <= 0) return null;
      const feeUatom = Math.ceil(atomFeeEstimate.gasUnits * priceUatom);
      const feeAtom  = feeUatom / Math.pow(10, COSMOS_NETWORK.decimals);
      const decimals = feeAtom < 0.0001 ? 8 : feeAtom < 0.01 ? 6 : 4;
      return feeAtom.toFixed(decimals);
    };

    const currentFeeAtom = estimateFeeAtomFor(gasPriceUatom);

    return (
      <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#888', flexWrap:'wrap' }}>
            <FaGasPump size={11} color="#f3ba2f"/>
            <span>Gas: <strong style={{ color:'#f3ba2f' }}>{modeLabels[atomGasMode]}</strong></span>
            <span style={{ color:'#555', fontFamily:'monospace' }}>{gasPriceUatom} uatom/unit</span>
            {currentFeeAtom !== null && (
              <span style={{ color:'#4caf50', fontFamily:'monospace', background:'#0a1a0a', border:'1px solid #1a2a1a', padding:'2px 6px' }}>
                ≈ {currentFeeAtom} ATOM
              </span>
            )}
            {atomFeeEstimating && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
          </div>
          <button onClick={() => setAtomGasAdvanced(p => !p)}
            style={{ background:'none', border:'none', color:'#01a2ff', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px' }}>
            {atomGasAdvanced ? <>Tutup <FaChevronUp size={9}/></> : <>Ubah <FaChevronDown size={9}/></>}
          </button>
        </div>

        {atomGasAdvanced && (
          <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #161616' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', marginBottom:'8px' }}>
              <button onClick={() => setAtomGasRefreshNonce(n => n + 1)} disabled={atomFeeEstimating}
                style={{ background:'none', border:'1px solid #333', color:atomFeeEstimating?'#888':'#f3ba2f', padding:'3px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px' }}>
                <FaSync size={9} style={{ animation:atomFeeEstimating?'spin 1s linear infinite':undefined }}/> {atomFeeEstimating ? 'Fetching...' : 'Refresh Gas'}
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom:'10px' }}>
              {(['slow','standard','fast','manual'] as const).map(mode => {
                const gpVal = mode === 'manual' ? null : ATOM_GAS_PRICE_TIERS[mode];
                const feeForMode = gpVal !== null ? estimateFeeAtomFor(gpVal) : null;
                return (
                  <button key={mode} onClick={() => setAtomGasMode(mode)} style={{
                    padding:'8px 4px', background: atomGasMode===mode ? '#1a1400' : '#0d0d0d',
                    border:`1px solid ${atomGasMode===mode ? '#f3ba2f' : '#1e1e1e'}`,
                    color: atomGasMode===mode ? '#f3ba2f' : '#555',
                    cursor:'pointer', fontSize:'11px', textAlign:'center', transition:'all 0.15s',
                  }}>
                    <div style={{ fontWeight:'bold', marginBottom:'2px' }}>{modeLabels[mode]}</div>
                    {gpVal !== null && (
                      <>
                        <div style={{ fontSize:'10px', color:'#888', fontFamily:'monospace' }}>{gpVal} uatom</div>
                        {feeForMode !== null && (
                          <div style={{ fontSize:'9px', color:'#4caf50', fontFamily:'monospace', marginTop:'1px' }}>
                            ≈{feeForMode} ATOM
                          </div>
                        )}
                      </>
                    )}
                    {gpVal === null && <div style={{ fontSize:'10px', color:'#333' }}>—</div>}
                  </button>
                );
              })}
            </div>
            {atomGasMode === 'manual' && (
              <div>
                <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Gas Price (uatom/unit)</label>
                <input type="number" placeholder="e.g. 0.025" value={atomGasManual} min="0" step="0.001"
                  onChange={e => setAtomGasManual(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                {currentFeeAtom !== null && (
                  <div style={{ fontSize:'10px', color:'#4caf50', fontFamily:'monospace', marginTop:'6px' }}>
                    Estimasi total fee ≈ {currentFeeAtom} ATOM
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ctx dikumpulkan sekali di sini lalu diteruskan ke setiap komponen Tab
  // (lihat WalletGeneratorCtx di ./types.ts untuk penjelasan pendekatannya).
  const ctx: WalletGeneratorCtx = {
    AXIOME_NETWORK, AXIOME_NETWORKS, COSMOS_NETWORK, COSMOS_NETWORKS, GRAM_NETWORK, GRAM_NETWORKS, FaBolt, FaCalendarAlt, FaChartBar, 
    FaCheckCircle, FaChevronDown, FaChevronUp, FaCode, FaCoins, FaCopy, FaEdit, FaExchangeAlt, 
    FaExclamationTriangle, FaEye, FaEyeSlash, FaFaucet, FaFileCode, FaFileExport, FaFileImport, FaGasPump, 
    FaGlobe, FaHashtag, FaInfoCircle, FaKey, FaLayerGroup, FaLink, FaList, FaNetworkWired, FaPaperPlane, FaPlug, 
    FaPlus, FaQrcode, FaRandom, FaRocket, FaSearch, FaShieldAlt, FaSpinner, FaSync, FaTerminal, FaTrash, 
    FaUpload, FaWallet, LAMPORTS_PER_SOL, SOLANA_NETWORK, SOLANA_NETWORKS, SmartContractConfig, 
    TOKEN_2022_PROGRAM_ID, TRON_NETWORKS, activeTab, addToMetaMask, addressCount, agHistory, airdropTasks, 
    atEditId, atEmptyForm, atFilter, atForm, atSearch, atShowForm, atStats, atomAddress, atomBalance, 
    atomConnect, atomConnected, atomConnecting, atomDisconnect, atomFeeEstimate, atomFeeEstimateError, 
    atomLoadingBal, atomNetId, atomPrivKey, atomRefreshBalance, atomSend, atomSendAmt, atomSendTo, atomSending, 
    atomStatus, atomWalletSel, axmAddress, axmBalance, axmConnect, axmConnected, axmConnecting, axmDisconnect, 
    axmFeeEstimate, axmFeeEstimateError, axmFeeEstimating, axmLoadingBal, axmNetId, axmPrivKey, 
    axmRefreshBalance, axmSend, axmSendAmt, axmSendTo, axmSending, axmStatus, axmWalletSel, balCheckNetId, 
    balChecking, balResults, batchSelectedIds, chainView, checkAllAtomBalances, checkAllAxmBalances, 
    checkAllGramBalances, gramAddress, gramBalance, gramConnect, gramConnected, gramConnecting, gramDisconnect, 
    gramLoadingBal, gramNetId, gramPrivKey, gramRefreshBalance, gramSend, gramSendAmt, gramSendTo, gramSending, 
    gramStatus, gramWalletSel, handleGramWalletSel, setGramPrivKey, setGramSendAmt, setGramSendTo, 
    setGramWalletSel, switchGramNetwork, gramVersion, setGramVersion, 
    gramConnectVersion, setGramConnectVersion, switchGramVersion, 
    gramFeeEstimate, gramFeeEstimateError, gramFeeEstimating, gramMaxLoading, gramSetMaxAmount, 
    gramSendMode, setGramSendMode, gramJettonMaster, setGramJettonMaster, gramJettonTo, setGramJettonTo, 
    gramJettonAmt, setGramJettonAmt, gramJettonComment, setGramJettonComment, gramJettonSending, gramJettonStatus, 
    gramJettonMeta, gramJettonMetaLoading, gramJettonMetaError, gramJettonFeeEstimate, gramJettonFeeEstimating, 
    gramJettonFeeEstimateError, gramJettonDetected, gramJettonDetectedLoading, gramLoadDetectedJettons, 
    gramSelectJetton, gramSendJetton, 
    checkAllBalances, checkAllSolBalances, checkAllTronBalances, compileTcCustomContract, copiedKey, copyText, 
    createSplToken, csvExporting, customMnemonic, deleteAirdropTask, deleteErc20Token, deleteSplToken, 
    deleteWallet, deployErc20Token, deployTrc20Token, deriveMore, editAirdropTask, entropyBits, erc20Tokens, 
    estimateTcEvmGas, estimateTcSolFee, estimateTcTronFee, ethers, execContract, execGasLimit, execLog, execMode, 
    execNetId, execPrivKey, execRawData, execRawTo, execRawVal, execReadResult, execRunning, execSimFailed, 
    execTaskId, execWalSel, expandedId, exportAllCSV, exportGarapan, exportWallet, filteredAtTasks, 
    filteredNetworks, filteredWallets, garapImportRef, generateWallet, generating, handleAtomWalletSel, 
    handleAxmWalletSel, handleExecWalSel, handleGarapImport, handleSolWalletSel, handleTcSolImageFile, 
    handleTcSolWalletSel, handleTcTronWalletSel, handleTcWalletSel, handleTronWalletSel, handleTxWalletSel, 
    highlightFaucet, importMode, isValidTronAddress, knownTxTokens, markTaskDone, netEditId, netForm, netSearch, 
    networks, openExecPanel, openPortfolio, openTronFaucet, refreshPendingTrc20, renderAssetSelector, 
    renderAtomGasFeeBox, renderGasFeeBox, renderSolAssetSelector, revealedIds, revealedPKs, runExec, 
    saveAirdropTask, saveNetwork, search, selectedNetwork, selectedSolToken, selectedTxToken, setActiveTab, 
    setAddressCount, setAgHistory, setAirdropTasks, setAtEditId, setAtFilter, setAtForm, setAtSearch, 
    setAtShowForm, setAtomPrivKey, setAtomSendAmt, setAtomSendTo, setAtomWalletSel, setAxmPrivKey, setAxmSendAmt, 
    setAxmSendTo, setAxmWalletSel, setBalCheckNetId, setBalResults, setBatchModalOpen, setBatchSelectedIds, 
    setChainView, setConfirmData, setCustomMnemonic, setEntropyBits, setExecContract, setExecGasLimit, 
    setExecMode, setExecNetId, setExecPrivKey, setExecRawData, setExecRawTo, setExecRawVal, setExecSimFailed, 
    setExecTaskId, setExecWalSel, setExpandedId, setImportMode, setNetEditId, setNetForm, setNetSearch, 
    setNetworks, setQrAddress, setRevealedIds, setRevealedPKs, setSearch, setShowNetForm, setSolCloseBurnFirst, 
    setSolCloseFilter, setSolCloseSearch, setSolMode, setSolMultiEqualAmt, setSolPrivKey, setSolSendAmt, 
    setSolSendTo, setSolSweepAmtMode, setSolSweepDelayMs, setSolSweepDestAddr, setSolSweepFixedAmt, 
    setSolSweepLeaveBuf, setSolSweepManualPK, setSolWalletSel, setSweepAdvanced, setSweepAmtMode, 
    setSweepDelayMs, setSweepDestAddr, setSweepFixedAmt, setSweepLeaveGas, setSweepManualPK, setTcChain, 
    setTcCompileError, setTcCompiled, setTcCustomCtorArgs, setTcCustomSolidity, setTcDecimals, setTcEvmMode, 
    setTcName, setTcNetworkId, setTcPrivKey, setTcSolAddMeta, setTcSolDecimals, setTcSolDescription, 
    setTcSolImageUrl, setTcSolName, setTcSolNetId, setTcSolPinataJwt, setTcSolPrivKey, setTcSolSupply, 
    setTcSolSymbol, setTcSupply, setTcSymbol, setTcTronDecimals, setTcTronName, setTcTronNetId, setTcTronPrivKey, 
    setTcTronSupply, setTcTronSymbol, setTcTronWalletSel, setTronAsset, setTronMode, setTronMultiEqualAmt, 
    setTronPrivKey, setTronSendAmt, setTronSendTo, setTronSweepAmtMode, setTronSweepDestAddr, 
    setTronSweepFixedAmt, setTronSweepLeaveBuf, setTronSweepManualPK, setTronWalletSel, setTxChain, setTxMode, 
    setTxMultiEqualAmt, setTxNetworkId, setTxPrivKey, setTxSendAmt, setTxSendTo, setTxWalletSel, setWalletName, 
    showAlert, showNetForm, solAddress, solAsset, solBalance, solCloseAccounts, solCloseAllRunning, 
    solCloseBurnFirst, solCloseFilter, solCloseLoading, solCloseSearch, solCloseSelected, 
    solCloseSelectedAccounts, solCloseToggleSelect, solCloseToggleSelectAll, solCloseTokenAccount, solClosingId, 
    solConnect, solConnected, solConnecting, solDisconnect, solFaucetLoading, solFetchCloseAccounts, solIsToken, 
    solIsValidAddr, solLoadingBal, solMode, solMultiAddRow, solMultiApplyEqual, solMultiEqualAmt, 
    solMultiRemoveRow, solMultiRows, solMultiRunning, solMultiSend, solMultiUpdateRow, solNetId, solPrivKey, 
    solRefreshBalance, solRequestAirdrop, solSend, solSendAmt, solSendTo, solSending, solStatus, 
    solSweepAddFromBIP39, solSweepAddManualPK, solSweepAmtMode, solSweepDelayMs, solSweepDestAddr, 
    solSweepFetchBalances, solSweepFetchingBal, solSweepFixedAmt, solSweepLeaveBuf, solSweepManualPK, 
    solSweepRemoveSource, solSweepRun, solSweepRunning, solSweepSources, solWalletSel, splTokens, sunToTrx, 
    sweepAddFromBIP39, sweepAddManualPK, sweepAdvanced, sweepAmtMode, sweepDelayMs, sweepDestAddr, 
    sweepFetchBalances, sweepFetchingBal, sweepFixedAmt, sweepLeaveGas, sweepManualPK, sweepRemoveSource, 
    sweepRun, sweepRunning, sweepSources, switchAtomNetwork, switchAxmNetwork, switchSolNetwork, 
    switchTronNetwork, tcChain, tcCompileError, tcCompiled, tcCompiling, tcCustomCtorArgs, tcCustomSolidity, 
    tcDecimals, tcDeployStatus, tcDeploying, tcEvmMode, tcGasError, tcGasFeeNative, tcGasLimitEst, tcGasLoading, 
    tcGasPriceGwei,
    GRAM_WALLET_VERSIONS, GRAM_JETTON_DEPLOY_VALUE, gramTokens, deleteGramToken, createGramJetton, estimateTcGramFee,
    tcGramNetId, setTcGramNetId, tcGramVersion, setTcGramVersion, tcGramWalletSel, handleTcGramWalletSel,
    tcGramPrivKey, setTcGramPrivKey, tcGramName, setTcGramName, tcGramSymbol, setTcGramSymbol,
    tcGramDecimals, setTcGramDecimals, tcGramSupply, setTcGramSupply, tcGramDescription, setTcGramDescription,
    tcGramImageUrl, setTcGramImageUrl, handleTcGramImageFile, tcGramImageUploading, tcGramCreating, tcGramStatus,
    tcGramFeeGram, tcGramFeeDetail, tcGramFeeLoading, tcGramFeeError, tcGramSelectedNetwork, tcGramMetaPreview,
    tcName, tcNetworkId, tcPrivKey, tcSelectedNetwork, tcSolAddMeta, tcSolCreating, 
    tcSolDecimals, tcSolDescription, tcSolFeeDetail, tcSolFeeError, tcSolFeeLoading, tcSolFeeSol, 
    tcSolImageUploading, tcSolImageUrl, tcSolMetaPreview, tcSolName, tcSolNetId, tcSolPinataJwt, tcSolPrivKey, 
    tcSolStandard, tcSolStatus, tcSolSupply, tcSolSymbol, tcSolWalletSel, tcSupply, tcSymbol, tcTronCreating, 
    tcTronDecimals, tcTronFeeError, tcTronFeeEstimate, tcTronFeeLoading, tcTronName, tcTronNetId, tcTronPrivKey, 
    tcTronRefreshing, tcTronStatus, tcTronSupply, tcTronSymbol, tcTronWalletSel, tcWalletSel, trc20Tokens, 
    tronAddress, tronAsset, tronAssetBal, tronAssetBalLoading, tronBalance, tronConnect, tronConnected, 
    tronConnecting, tronDisconnect, tronFeeEstimate, tronFeeEstimateError, tronFeeEstimating, tronLoadingBal, 
    tronMode, tronMultiAddRow, tronMultiApplyEqual, tronMultiEqualAmt, tronMultiRemoveRow, tronMultiRows, 
    tronMultiRunning, tronMultiSend, tronMultiUpdateRow, tronNetId, tronNetwork, tronPrivKey, tronRefreshBalance, 
    tronRefreshResources, tronResources, tronResourcesLoading, tronSend, tronSendAmt, tronSendTo, tronSending, 
    tronStatus, tronSweepAddFromBIP39, tronSweepAddManualPK, tronSweepAmtMode, tronSweepDestAddr, 
    tronSweepFetchBalances, tronSweepFetchingBal, tronSweepFixedAmt, tronSweepLeaveBuf, tronSweepManualPK, 
    tronSweepRemoveSource, tronSweepRun, tronSweepRunning, tronSweepSources, tronWalletSel, txAddress, txAsset, 
    txBalance, txChain, txConnect, txConnected, txConnecting, txDisconnect, txIsToken, txLoadingBal, 
    txMaxLoading, txMode, txMultiAddRow, txMultiApplyEqual, txMultiEqualAmt, txMultiRemoveRow, txMultiRows, 
    txMultiRunning, txMultiSend, txMultiUpdateRow, txNetworkId, txPrivKey, txRefreshBalance, txSend, txSendAmt, 
    txSendTo, txSending, txSetMaxAmount, txStatus, txStatusColor, txWalletSel, walletName, wallets
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

      <header style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'14px', flexWrap:'wrap' }}>
        <h1 style={{ margin:0 }}>
          <FaWallet style={{ marginRight:'8px' }}/>WalletGen
          <span style={{ fontSize:'12px', color:'#555', fontWeight:'normal', marginLeft:'8px' }}>v1</span>
        </h1>
        <Link to="/explorer" style={{ textDecoration:'none' }}>
          <button style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
            <FaCompass size={12}/> Explorer
          </button>
        </Link>
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

      {activeTab === 'wallets' && <WalletsTab ctx={ctx} />}

      {activeTab === 'transfer' && <TransferTab ctx={ctx} />}

      {activeTab === 'garap' && <GarapTab ctx={ctx} />}

      {activeTab === 'networks' && <NetworksTab ctx={ctx} />}

      {activeTab === 'bytecode' && (
        <BytecodeExplorer />
      )}

      {activeTab === 'txdecoder' && (
        <TxDecoder
        networks={networks}
        defaultRpc="https://eth.llamarpc.com"
        />
      )}

      {activeTab === 'token' && <TokenTab ctx={ctx} />}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
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
