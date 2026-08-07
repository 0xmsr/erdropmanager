import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { KNOWN_4BYTE, KNOWN_TOPICS, KNOWN_SELECTORS } from './know';
import {
  FaBolt, FaCheck, FaCheckCircle, FaChevronDown, FaChevronUp, FaCode, FaCopy,
  FaExclamationTriangle, FaFileCode, FaGasPump, FaGlobe, FaInfoCircle,
  FaLayerGroup, FaList, FaMagic, FaPlay, FaRegCopy, FaSearch, FaShieldAlt,
  FaSpinner, FaTerminal, FaTrash,
} from 'react-icons/fa';




export const ERC20_ABI = [{"inputs":[{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_decimals","type":"uint8"},{"name":"_initialSupply","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"name":"spender","type":"address"},{"name":"value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"name":"value","type":"uint256"}],"name":"burn","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"mint","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];

export const ERC20_BYTECODE = '0x608060405234801562000010575f80fd5b5060405162000fd538038062000fd58339810160408190526200003391620001b1565b5f620000408582620002c0565b5060016200004f8482620002c0565b506002805460ff841660ff199091168117909155600480546001600160a01b031916331790555f906200008490600a6200049b565b620000909083620004af565b6003819055335f818152600560205260408082208490555192935090917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef90620000dd9085815260200190565b60405180910390a35050505050620004c9565b634e487b7160e01b5f52604160045260245ffd5b5f82601f83011262000114575f80fd5b81516001600160401b0380821115620001315762000131620000f0565b604051601f8301601f19908116603f011681019082821181831017156200015c576200015c620000f0565b816040528381526020925086602085880101111562000179575f80fd5b5f91505b838210156200019c57858201830151818301840152908201906200017d565b5f602085830101528094505050505092915050565b5f805f8060808587031215620001c5575f80fd5b84516001600160401b0380821115620001dc575f80fd5b620001ea8883890162000104565b9550602087015191508082111562000200575f80fd5b506200020f8782880162000104565b935050604085015160ff8116811462000226575f80fd5b6060959095015193969295505050565b600181811c908216806200024b57607f821691505b6020821081036200026a57634e487b7160e01b5f52602260045260245ffd5b50919050565b601f821115620002bb57805f5260205f20601f840160051c81016020851015620002975750805b601f840160051c820191505b81811015620002b8575f8155600101620002a3565b50505b505050565b81516001600160401b03811115620002dc57620002dc620000f0565b620002f481620002ed845462000236565b8462000270565b602080601f8311600181146200032a575f8415620003125750858301515b5f19600386901b1c1916600185901b17855562000384565b5f85815260208120601f198616915b828110156200035a5788860151825594840194600190910190840162000339565b50858210156200037857878501515f19600388901b60f8161c191681555b505060018460011b0185555b505050505050565b634e487b7160e01b5f52601160045260245ffd5b600181815b80851115620003e057815f1904821115620003c457620003c46200038c565b80851615620003d257918102915b93841c9390800290620003a5565b509250929050565b5f82620003f85750600162000495565b816200040657505f62000495565b81600181146200041f57600281146200042a576200044a565b600191505062000495565b60ff8411156200043e576200043e6200038c565b50506001821b62000495565b5060208310610133831016604e8410600b84101617156200046f575081810a62000495565b6200047b8383620003a0565b805f19048211156200049157620004916200038c565b0290505b92915050565b5f620004a88383620003e8565b9392505050565b80820281158282048414176200049557620004956200038c565b610afe80620004d75f395ff3fe608060405234801561000f575f80fd5b50600436106100e5575f3560e01c806370a082311161008857806395d89b411161006357806395d89b41146101ed578063a9059cbb146101f5578063dd62ed3e14610208578063f2fde38b14610232575f80fd5b806370a0823114610199578063715018a6146101b85780638da5cb5b146101c2575f80fd5b806323b872dd116100c357806323b872dd14610141578063313ce5671461015457806340c10f191461017357806342966c6814610186575f80fd5b806306fdde03146100e9578063095ea7b31461010757806318160ddd1461012a575b5f80fd5b6100f1610245565b6040516100fe91906108f1565b60405180910390f35b61011a610115366004610958565b6102d0565b60405190151581526020016100fe565b61013360035481565b6040519081526020016100fe565b61011a61014f366004610980565b61033c565b6002546101619060ff1681565b60405160ff90911681526020016100fe565b61011a610181366004610958565b610400565b61011a6101943660046109b9565b6104fa565b6101336101a73660046109d0565b60056020525f908152604090205481565b6101c06105ff565b005b6004546101d5906001600160a01b031681565b6040516001600160a01b0390911681526020016100fe565b6100f1610672565b61011a610203366004610958565b61067f565b6101336102163660046109f0565b600660209081525f928352604080842090915290825290205481565b6101c06102403660046109d0565b610694565b5f805461025190610a21565b80601f016020809104026020016040519081016040528092919081815260200182805461027d90610a21565b80156102c85780601f1061029f576101008083540402835291602001916102c8565b820191905f5260205f20905b8154815290600101906020018083116102ab57829003601f168201915b505050505081565b335f8181526006602090815260408083206001600160a01b038716808552925280832085905551919290917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9259061032a9086815260200190565b60405180910390a35060015b92915050565b6001600160a01b0383165f908152600660209081526040808320338452909152812054828110156103b45760405162461bcd60e51b815260206004820152601f60248201527f53696d706c6545524332303a20616c6c6f77616e63652065786365656465640060448201526064015b60405180910390fd5b5f1981146103ea576103c68382610a6d565b6001600160a01b0386165f9081526006602090815260408083203384529091529020555b6103f585858561077e565b506001949350505050565b6004545f906001600160a01b0316331461042c5760405162461bcd60e51b81526004016103ab90610a80565b8160035f82825461043d9190610ab5565b90915550506001600160a01b0383165f9081526005602052604081208054849290610469908490610ab5565b90915550506040518281526001600160a01b038416905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a3826001600160a01b03167f0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885836040516104e991815260200190565b60405180910390a250600192915050565b335f90815260056020526040812054828110156105635760405162461bcd60e51b815260206004820152602160248201527f53696d706c6545524332303a206275726e20657863656564732062616c616e636044820152606560f81b60648201526084016103ab565b61056d8382610a6d565b335f9081526005602052604081209190915560038054859290610591908490610a6d565b90915550506040518381525f9033907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a360405183815233907fcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5906020016104e9565b6004546001600160a01b031633146106295760405162461bcd60e51b81526004016103ab90610a80565b6004546040515f916001600160a01b0316907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908390a3600480546001600160a01b0319169055565b6001805461025190610a21565b5f61068b33848461077e565b50600192915050565b6004546001600160a01b031633146106be5760405162461bcd60e51b81526004016103ab90610a80565b6001600160a01b0381166107235760405162461bcd60e51b815260206004820152602660248201527f53696d706c6545524332303a206e6577206f776e6572206973207a65726f206160448201526564647265737360d01b60648201526084016103ab565b6004546040516001600160a01b038084169216907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0905f90a3600480546001600160a01b0319166001600160a01b0392909216919091179055565b6001600160a01b0382166107e25760405162461bcd60e51b815260206004820152602560248201527f53696d706c6545524332303a207472616e7366657220746f207a65726f206164604482015264647265737360d81b60648201526084016103ab565b6001600160a01b0383165f90815260056020526040902054818110156108585760405162461bcd60e51b815260206004820152602560248201527f53696d706c6545524332303a207472616e7366657220657863656564732062616044820152646c616e636560d81b60648201526084016103ab565b6108628282610a6d565b6001600160a01b038086165f908152600560205260408082209390935590851681529081208054849290610897908490610ab5565b92505081905550826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516108e391815260200190565b60405180910390a350505050565b5f602080835283518060208501525f5b8181101561091d57858101830151858201604001528201610901565b505f604082860101526040601f19601f8301168501019250505092915050565b80356001600160a01b0381168114610953575f80fd5b919050565b5f8060408385031215610969575f80fd5b6109728361093d565b946020939093013593505050565b5f805f60608486031215610992575f80fd5b61099b8461093d565b92506109a96020850161093d565b9150604084013590509250925092565b5f602082840312156109c9575f80fd5b5035919050565b5f602082840312156109e0575f80fd5b6109e98261093d565b9392505050565b5f8060408385031215610a01575f80fd5b610a0a8361093d565b9150610a186020840161093d565b90509250929050565b600181811c90821680610a3557607f821691505b602082108103610a5357634e487b7160e01b5f52602260045260245ffd5b50919050565b634e487b7160e01b5f52601160045260245ffd5b8181038181111561033657610336610a59565b6020808252818101527f53696d706c6545524332303a2063616c6c6572206973206e6f74206f776e6572604082015260600190565b8082018082111561033657610336610a5956fea2646970667358221220b42a9ec11921dd284b4e5ad1d889951daf122c44fe5b40e487d86d789aac14f964736f6c63430008180033';

export interface DeployedErc20Token {
  id: string;
  chainId: number;
  networkId: string;
  networkName: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  deployer: string;
  txHash: string;
  createdAt: number;
}

export interface CreatedSplToken {
  id: string;
  mint: string;
  networkId: string;
  networkName: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  mintAuthority: string;
  txHash: string;
  createdAt: number;

  hasMetadata?: boolean;
  metadataUri?: string;
  metadataPda?: string;
  imageUrl?: string;
  description?: string;
  standard?: 'classic' | 'token2022';
}

export interface ContractConfig {
  contractAddress: string;
  contractAbi:     string;
  contractFunc:    string;
  contractArgs:    string;
  ethValue:        string;
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
    id: 'custom', label: 'Custom ABI', icon: '[</>]', color: '#836EFD', defaultFunc: '',
    fns: [],
  },
];

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

export interface ParsedTxError {
  friendly: string;
  detail:   string;
  hint?:    string;
  category: string;
}

function weiToToken(weiStr: string, decimals = 18): string {
  try {
    const raw  = weiStr.startsWith('0x') ? BigInt(weiStr) : BigInt(weiStr);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = raw / base;
    const frac  = raw % base;
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6);
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return weiStr;
  }
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function extractRawMessage(e: any): string {
  const candidates: string[] = [
    e?.error?.error?.error?.message,
    e?.error?.error?.message,
    e?.error?.data?.message,
    e?.error?.message,
    e?.data?.message,
    e?.body && (() => { try { return JSON.parse(e.body)?.error?.message; } catch { return ''; } })(),
    e?.message,
    String(e ?? ''),
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}


function extractReason(e: any): string {
  return (
    e?.reason ??
    e?.error?.reason ??
    e?.error?.data?.reason ??
    e?.data?.reason ??
    ''
  ).trim();
}

const KNOWN_ERROR_SELECTORS: Record<string, string> = {
  '0x08c379a0': 'Error(string)',
  '0x4e487b71': 'Panic(uint256)',
  '0x7939f424': 'TransferFailed()',
  '0x82b42900': 'Unauthorized()',
  '0x3ee5aeb5': 'Reentrancy()',
};

function decodeRevertData(hexData: string): string | null {
  if (!hexData || hexData === '0x' || hexData.length < 10) return null;
  try {
    const selector = hexData.slice(0, 10).toLowerCase();
    if (selector === '0x08c379a0') {
      const data = hexData.slice(10);
      if (data.length >= 128) {
        const lenHex = data.slice(64, 128);
        const len = parseInt(lenHex, 16);
        const strHex = data.slice(128, 128 + len * 2);
        const str = strHex.match(/.{1,2}/g)?.map(b => String.fromCharCode(parseInt(b, 16))).join('') ?? '';
        if (str) return `"${str}"`;
      }
    }
    
    if (selector === '0x4e487b71') {
      const code = parseInt(hexData.slice(10 + 56), 16);
      const PANIC_CODES: Record<number, string> = {
        0x00: 'generic panic',
        0x01: 'assert() gagal',
        0x11: 'overflow/underflow aritmatika',
        0x12: 'pembagian / modulo dengan nol',
        0x21: 'konversi enum tidak valid',
        0x22: 'akses storage yang rusak',
        0x31: 'pop() array kosong',
        0x32: 'akses array out-of-bounds',
        0x41: 'alokasi memori terlalu besar',
        0x51: 'panggil zero-initialized function pointer',
      };
      return `Panic(${PANIC_CODES[code] ?? `code 0x${code.toString(16)}`})`;
    }
    if (KNOWN_ERROR_SELECTORS[selector]) {
      return KNOWN_ERROR_SELECTORS[selector];
    }
    return null;
  } catch {
    return null;
  }
}

export function parseTxError(e: any): ParsedTxError {
  const raw    = extractRawMessage(e);
  const reason = extractReason(e);
  const msg    = raw.toLowerCase();

  const ok = (
    friendly: string,
    detail: string,
    category: ParsedTxError['category'],
    hint?: string,
  ): ParsedTxError => ({ friendly, detail, category, hint });

  const customMatch =
    raw.match(/Fail(?:ed)? with (?:custom )?[Ee]rror ['"]?([A-Za-z0-9_]+)\s*\(([^)]*)\)/i) ??
    raw.match(/custom error ['"]([A-Za-z0-9_]+)['"]\s*\(([^)]*)\)/i) ??
    raw.match(/reverted with custom error '([A-Za-z0-9_]+)\(([^)]*)\)'/i);

  if (customMatch) {
    const errName   = customMatch[1];
    const errParams = customMatch[2].trim();
    if (errName === 'ERC20InsufficientBalance') {
      const senderM = errParams.match(/sender=(0x[0-9a-fA-F]{40})/i);
      const balM    = errParams.match(/balance=(\d+)/i);
      const needM   = errParams.match(/needed=(\d+)/i);
      const sender  = senderM ? senderM[1] : '';
      const have    = balM  ? weiToToken(balM[1])  : '?';
      const need    = needM ? weiToToken(needM[1]) : '?';
      return ok(
        `Saldo token ERC-20 tidak cukup`,
        `${sender ? `Wallet: ${shortAddress(sender)} · ` : ''}Punya: ${have} · Dibutuhkan: ${need}`,
        'token',
        `Top-up token terlebih dahulu, atau kurangi jumlah yang ingin dikirim.`,
      );
    }

    if (errName === 'ERC20InsufficientAllowance') {
      const spenderM = errParams.match(/spender=(0x[0-9a-fA-F]{40})/i);
      const allowM   = errParams.match(/allowance=(\d+)/i);
      const needM    = errParams.match(/needed=(\d+)/i);
      const spender  = spenderM ? spenderM[1] : '';
      const have     = allowM ? weiToToken(allowM[1]) : '?';
      const need     = needM  ? weiToToken(needM[1])  : '?';
      return ok(
        `Allowance ERC-20 tidak cukup`,
        `${spender ? `Spender: ${shortAddress(spender)} · ` : ''}Allowance: ${have} · Dibutuhkan: ${need}`,
        'token',
        `Panggil approve(spender, amount) ke kontrak token terlebih dahulu.`,
      );
    }

    if (errName === 'ERC20InvalidSender') {
      const addrM = errParams.match(/(0x[0-9a-fA-F]{40})/);
      return ok(
        `Alamat pengirim token tidak valid`,
        addrM ? `Address: ${addrM[1]}` : errParams,
        'token',
        `Pastikan address pengirim bukan 0x000…000 dan bukan address kontrak yang salah.`,
      );
    }

    if (errName === 'ERC20InvalidReceiver') {
      const addrM = errParams.match(/(0x[0-9a-fA-F]{40})/);
      return ok(
        `Alamat tujuan transfer token tidak valid`,
        addrM ? `Address: ${addrM[1]}` : errParams,
        'token',
        `Pastikan address tujuan bukan 0x000…000 (zero address) atau kontrak yang menolak token.`,
      );
    }

    if (errName === 'ERC20InvalidApprover') {
      return ok(
        `Approver tidak valid — tidak bisa approve dari address ini`,
        errParams, 'token',
        `Periksa bahwa wallet yang approve bukan zero address.`,
      );
    }

    if (errName === 'ERC20InvalidSpender') {
      return ok(
        `Spender tidak valid untuk approve`,
        errParams, 'token',
        `Periksa address kontrak yang kamu approve — pastikan bukan zero address.`,
      );
    }

    if (errName === 'ERC721InvalidOwner') {
      const addrM = errParams.match(/(0x[0-9a-fA-F]{40})/);
      return ok(
        `Bukan pemilik NFT ini`,
        addrM ? `Address: ${addrM[1]}` : errParams, 'token',
        `Pastikan wallet kamu benar-benar memiliki NFT (token ID) yang ingin ditransfer.`,
      );
    }

    if (errName === 'ERC721IncorrectOwner') {
      const fromM  = errParams.match(/from=(0x[0-9a-fA-F]{40})/i);
      const ownerM = errParams.match(/owner=(0x[0-9a-fA-F]{40})/i);
      return ok(
        `Pemilik NFT tidak sesuai`,
        `${fromM ? `From: ${shortAddress(fromM[1])} · ` : ''}${ownerM ? `Owner: ${shortAddress(ownerM[1])}` : errParams}`,
        'token',
        `Address 'from' bukan pemilik token ini di kontrak.`,
      );
    }

    if (errName === 'ERC721NonexistentToken') {
      const idM = errParams.match(/tokenId=(\d+)/i) ?? errParams.match(/(\d+)/);
      return ok(
        `Token ID tidak ada / belum di-mint`,
        idM ? `Token ID: ${idM[1]}` : errParams, 'token',
        `Pastikan token ID yang kamu masukkan sudah di-mint dan ada di kontrak.`,
      );
    }

    if (errName === 'ERC721InsufficientApproval') {
      return ok(
        `Belum ada approval untuk NFT ini`,
        errParams, 'token',
        `Panggil approve(operator, tokenId) atau setApprovalForAll(operator, true) terlebih dahulu.`,
      );
    }

    if (errName === 'ERC721InvalidApprover' || errName === 'ERC721InvalidOperator') {
      return ok(`Approver/Operator NFT tidak valid`, errParams, 'token');
    }

    if (errName === 'ERC1155InsufficientBalance') {
      const addrM   = errParams.match(/sender=(0x[0-9a-fA-F]{40})/i) ?? errParams.match(/(0x[0-9a-fA-F]{40})/);
      const balM    = errParams.match(/balance=(\d+)/i);
      const needM   = errParams.match(/needed=(\d+)/i);
      const idM     = errParams.match(/id=(\d+)/i);
      return ok(
        `Saldo ERC-1155 tidak cukup`,
        `${addrM ? `Addr: ${shortAddress(addrM[1])} · ` : ''}${idM ? `ID: ${idM[1]} · ` : ''}Punya: ${balM?.[1] ?? '?'} · Butuh: ${needM?.[1] ?? '?'}`,
        'token',
        `Pastikan kamu punya cukup token ID tersebut sebelum transfer.`,
      );
    }

    if (errName === 'ERC1155InvalidApproval') {
      return ok(`Belum ada approval untuk ERC-1155 ini`, errParams, 'token',
        `Panggil setApprovalForAll(operator, true) terlebih dahulu.`);
    }

    if (errName === 'OwnableUnauthorizedAccount') {
      const addrM = errParams.match(/(0x[0-9a-fA-F]{40})/);
      return ok(
        `Akses ditolak — hanya owner kontrak`,
        addrM ? `Account: ${shortAddress(addrM[1])}` : errParams,
        'access',
        `Wallet kamu bukan owner kontrak ini. Tidak bisa memanggil fungsi restricted.`,
      );
    }

    if (errName === 'OwnableInvalidOwner') {
      return ok(`Pemindahan owner ke address tidak valid`, errParams, 'access',
        `Tidak bisa transfer ownership ke zero address atau address yang tidak valid.`);
    }

    if (errName === 'AccessControlUnauthorizedAccount') {
      const addrM = errParams.match(/(0x[0-9a-fA-F]{40})/);
      const roleM = errParams.match(/neededRole=(0x[0-9a-fA-F]+)/i) ?? errParams.match(/(0x[0-9a-fA-F]{64})/);
      return ok(
        `Akses ditolak — role tidak memenuhi syarat`,
        `${addrM ? `Account: ${shortAddress(addrM[1])} · ` : ''}${roleM ? `Role: ${roleM[1].slice(0,10)}…` : ''}`,
        'access',
        `Wallet ini tidak memiliki role yang dibutuhkan. Hubungi admin kontrak untuk grant role.`,
      );
    }

    if (errName === 'AccessControlBadConfirmation') {
      return ok(`Konfirmasi role renounce salah`, errParams, 'access',
        `Saat renounceRole, address yang dikirim harus sama dengan msg.sender.`);
    }

    if (errName === 'EnforcedPause') {
      return ok(
        `Kontrak sedang di-pause — operasi tidak bisa dilakukan`,
        errParams, 'contract',
        `Tunggu kontrak di-unpause oleh admin, atau cek channel resmi proyek.`,
      );
    }

    if (errName === 'ExpectedPause') {
      return ok(`Kontrak harus dalam kondisi pause untuk fungsi ini`, errParams, 'contract');
    }

    if (errName === 'ReentrancyGuardReentrantCall') {
      return ok(
        `Reentrancy terdeteksi — panggilan berlapis tidak diizinkan`,
        errParams, 'contract',
        `Kontrak menolak karena ada panggilan rekursif/bertumpuk. Ini adalah proteksi keamanan.`,
      );
    }

    if (errName === 'SafeERC20FailedOperation') {
      const addrM = errParams.match(/(0x[0-9a-fA-F]{40})/);
      return ok(
        `Operasi token gagal (SafeERC20)`,
        addrM ? `Token contract: ${shortAddress(addrM[1])}` : errParams,
        'token',
        `Transfer/approve ke kontrak token ini gagal. Pastikan token memiliki saldo dan kontrak valid.`,
      );
    }

    if (errName === 'SafeERC20FailedDecreaseAllowance') {
      return ok(
        `Gagal mengurangi allowance — nilai akan negatif`,
        errParams, 'token',
        `Gunakan approve(spender, 0) dulu sebelum set allowance baru (safe approval pattern).`,
      );
    }

    if (errName === 'SafeCastOverflowedUintDowncast' || errName === 'SafeCastOverflowedIntDowncast') {
      return ok(
        `Overflow saat konversi tipe data di kontrak`,
        errParams, 'contract',
        `Nilai yang dikirim terlalu besar untuk tipe data yang digunakan kontrak.`,
      );
    }

    if (errName === 'AddressInsufficientBalance') {
      const addrM = errParams.match(/(0x[0-9a-fA-F]{40})/);
      return ok(
        `Saldo address tidak cukup untuk operasi ini`,
        addrM ? `Address: ${shortAddress(addrM[1])}` : errParams,
        'token',
        `Pastikan kontrak atau wallet punya cukup ETH/native token.`,
      );
    }

    if (errName === 'AddressEmptyCode') {
      const addrM = errParams.match(/(0x[0-9a-fA-F]{40})/);
      return ok(
        `Address bukan kontrak — tidak ada bytecode`,
        addrM ? `Address: ${addrM[1]}` : errParams,
        'contract',
        `Pastikan address yang kamu gunakan adalah smart contract, bukan EOA (wallet biasa).`,
      );
    }

    if (errName === 'FailedInnerCall') {
      return ok(
        `Inner call ke kontrak lain gagal`,
        errParams, 'contract',
        `Salah satu call internal di dalam kontrak ini gagal — cek args dan state kontrak yang dipanggil.`,
      );
    }

    if (errName === 'GovernorInvalidProposalState') {
      return ok(`Status proposal tidak valid untuk aksi ini`, errParams, 'contract',
        `Cek apakah proposal sudah dalam status yang benar (Active, Succeeded, Queued, dll).`);
    }

    if (errName === 'GovernorUnmetDelay') {
      return ok(`Waktu delay belum terpenuhi`, errParams, 'contract',
        `Tunggu timelock / voting delay selesai sebelum melanjutkan.`);
    }

    if (errName === 'VotesExpiredSignature') {
      return ok(`Tanda tangan vote sudah kadaluarsa`, errParams, 'access',
        `Deadline signature sudah lewat — buat signature baru.`);
    }

    if (errName === 'InvalidInitialization') {
      return ok(`Kontrak sudah diinisialisasi atau inisialisasi tidak valid`, errParams, 'contract',
        `Fungsi initialize() hanya bisa dipanggil sekali.`);
    }

    if (errName === 'NotInitializing') {
      return ok(`Kontrak belum dalam proses inisialisasi`, errParams, 'contract');
    }

    if (errName === 'DeadlineExceeded' || errName === 'ERC2612ExpiredSignature' || errName === 'PermitExpired') {
      return ok(
        `Deadline transaksi / permit sudah lewat`,
        errParams, 'contract',
        `Buat ulang TX dengan deadline yang lebih panjang, atau buat signature permit baru.`,
      );
    }

    if (errName === 'ERC2612InvalidSigner') {
      return ok(`Signer permit tidak valid`, errParams, 'access',
        `Signature yang diberikan tidak cocok dengan owner token.`);
    }

    if (errName === 'TooLittleReceived' || errName === 'InsufficientOutputAmount'
        || errName === 'SlippageExceeded' || errName === 'PriceTooHigh' || errName === 'PriceTooLow') {
      return ok(
        `Slippage melebihi batas — harga bergerak terlalu jauh`,
        errParams, 'contract',
        `Naikkan slippage tolerance di UI swap, atau coba saat kondisi pasar lebih stabil.`,
      );
    }

    if (errName === 'InsufficientLiquidity' || errName === 'K') {
      return ok(
        `Likuiditas pool tidak cukup untuk swap/LP ini`,
        errParams, 'contract',
        `Kurangi jumlah yang ingin diswap, atau coba pool lain.`,
      );
    }

    if (errName === 'Expired') {
      return ok(`TX/Order sudah expired`, errParams, 'contract',
        `Deadline sudah lewat. Kirim ulang TX dengan deadline yang baru.`);
    }

    if (errName === 'Locked') {
      return ok(`Token sedang terkunci (locked/vesting)`, errParams, 'token',
        `Tunggu periode vesting/lock selesai sebelum bisa transfer.`);
    }

    return ok(
      `Custom Error: ${errName}`,
      errParams
        ? `Params: (${errParams})`
        : `(tidak ada parameter)`,
      'unknown',
      `Cek ABI atau kode kontrak untuk arti error "${errName}".`,
    );
  }

  const revertHex: string =
    e?.error?.data ??
    e?.data?.data ??
    e?.error?.error?.data ??
    '';

  if (revertHex && typeof revertHex === 'string' && revertHex.startsWith('0x')) {
    const decoded = decodeRevertData(revertHex);
    if (decoded) {
      return ok(
        `TX revert: ${decoded}`,
        `Revert data: ${revertHex.slice(0, 66)}${revertHex.length > 66 ? '…' : ''}`,
        'contract',
        `Kontrak menolak TX dengan data di atas — periksa kondisi/state kontrak.`,
      );
    }
  }

  const revertStrMatch =
    raw.match(/execution reverted[,:\s]*["']([^"']{1,200})["']/i) ??
    raw.match(/reverted with reason string ["']([^"']{1,200})["']/i) ??
    raw.match(/revert\s+([A-Z][A-Za-z0-9 _:!]{2,100})/);

  const revertStr = (revertStrMatch?.[1] ?? reason ?? '').trim();
  if (revertStr && revertStr.toLowerCase() !== 'execution reverted') {
    let hint = `Periksa kondisi kontrak — fungsi menolak dengan alasan ini.`;

    if (/not\s*(the\s*)?owner|caller.*not.*owner/i.test(revertStr))
      hint = `Wallet kamu bukan owner kontrak ini.`;
    else if (/paused|is paused/i.test(revertStr))
      hint = `Kontrak sedang di-pause. Tunggu unpause dari admin.`;
    else if (/cooldown|too soon|wait/i.test(revertStr))
      hint = `Ada cooldown period — tunggu sebentar lalu coba lagi.`;
    else if (/whitelist|not whitelisted/i.test(revertStr))
      hint = `Address kamu tidak ada di whitelist kontrak ini.`;
    else if (/cap|max supply|sold out/i.test(revertStr))
      hint = `Sudah mencapai batas maksimum (cap/max supply) — tidak bisa mint lagi.`;
    else if (/already claimed|already minted/i.test(revertStr))
      hint = `Airdrop/mint sudah pernah diklaim dari address ini.`;
    else if (/invalid proof|merkle/i.test(revertStr))
      hint = `Merkle proof tidak valid — address kamu mungkin tidak ada di snapshot.`;
    else if (/insufficient|not enough|balance/i.test(revertStr))
      hint = `Saldo tidak cukup untuk operasi ini.`;
    else if (/deadline|expired/i.test(revertStr))
      hint = `Deadline TX sudah lewat — kirim ulang dengan deadline baru.`;
    else if (/slippage|price impact/i.test(revertStr))
      hint = `Slippage terlalu tinggi. Coba naikkan toleransi slippage.`;
    else if (/allowance|approve/i.test(revertStr))
      hint = `Perlu approve token terlebih dahulu sebelum kontrak bisa menggunakannya.`;

    return ok(
      `TX revert: "${revertStr}"`,
      raw.length > revertStr.length + 30 ? raw.slice(0, 200) : '',
      'contract',
      hint,
    );
  }

  if (msg.includes('execution reverted')) {
    return ok(
      `TX revert tanpa pesan — kontrak menolak transaksi ini`,
      raw.slice(0, 200),
      'contract',
      `Kemungkinan: saldo token kurang, kondisi require() gagal, atau state kontrak tidak sesuai. Coba simulasikan di Tenderly.`,
    );
  }

  if (msg.includes('nonce too low') || msg.includes('nonce has already been used')
      || msg.includes('already known') || msg.includes('tx already in pool')) {
    return ok(
      `Nonce sudah terpakai — TX duplikat atau sudah confirmed`,
      raw.slice(0, 200),
      'nonce',
      `TX dengan nonce ini sudah masuk mempool atau sudah confirmed. Coba kirim ulang tanpa override nonce.`,
    );
  }
  if (msg.includes('nonce too high') || msg.includes('nonce gap')) {
    return ok(
      `Nonce terlalu tinggi — ada gap TX yang belum confirmed`,
      raw.slice(0, 200),
      'nonce',
      `Ada TX pending sebelumnya yang belum confirmed. Tunggu dulu atau speed-up TX pending itu.`,
    );
  }
  if (msg.includes('replacement transaction underpriced') || msg.includes('replacement fee too low')) {
    return ok(
      `Gas price terlalu rendah untuk replace TX pending`,
      raw.slice(0, 200),
      'gas',
      `Naikkan gas price minimal 10–12% lebih tinggi dari TX pending yang ingin digantikan.`,
    );
  }
  if (msg.includes('nonce')) {
    return ok(
      `Nonce error — ada konflik dengan TX pending`,
      raw.slice(0, 200),
      'nonce',
      `Cek TX pending di explorer. Tunggu confirmed/dropped, atau gunakan nonce override manual.`,
    );
  }

  if (msg.includes('insufficient funds for gas') || msg.includes('insufficient funds for intrinsic')) {
    const haveM = raw.match(/have (\d+)/i);
    const wantM = raw.match(/want (\d+)/i);
    const haveEth = haveM ? weiToToken(haveM[1]) : null;
    const wantEth = wantM ? weiToToken(wantM[1]) : null;
    return ok(
      `Saldo native token tidak cukup untuk gas`,
      haveEth && wantEth ? `Punya: ${haveEth} · Butuh: ${wantEth}` : raw.slice(0, 200),
      'gas',
      `Top-up native token (ETH/BNB/MATIC/dll) ke wallet ini untuk membayar gas fee.`,
    );
  }
  if (msg.includes('insufficient funds') || msg.includes('insufficient balance for transfer')) {
    return ok(
      `Saldo tidak cukup (gas + value)`,
      raw.slice(0, 200),
      'gas',
      `Pastikan wallet punya cukup native token untuk gas fee ditambah nilai ETH yang dikirim.`,
    );
  }
  if (msg.includes('unpredictable_gas_limit') || msg.includes('cannot estimate gas')) {
    return ok(
      `Gas estimasi gagal — TX akan revert`,
      raw.slice(0, 200),
      'gas',
      `Kontrak akan menolak TX ini. Periksa args, saldo token & allowance, dan state kontrak. Bisa juga set gas limit manual untuk force-send.`,
    );
  }
  if (msg.includes('gas required exceeds allowance') || msg.includes('exceeds block gas limit')) {
    return ok(
      `Gas yang dibutuhkan melebihi block gas limit`,
      raw.slice(0, 200),
      'gas',
      `Operasi terlalu berat untuk satu blok. Coba pecah menjadi beberapa TX lebih kecil.`,
    );
  }
  if (msg.includes('out of gas') || msg.includes('intrinsic gas too low')) {
    return ok(
      `Gas habis saat eksekusi`,
      raw.slice(0, 200),
      'gas',
      `Naikkan gas limit. Untuk operasi kompleks, coba 2–3x dari estimasi awal.`,
    );
  }
  if (msg.includes('max fee per gas less than block base fee') || msg.includes('basefee')) {
    return ok(
      `Gas price di bawah base fee blok saat ini`,
      raw.slice(0, 200),
      'gas',
      `Naikkan maxFeePerGas agar TX bisa masuk blok. Cek gas tracker network yang relevan.`,
    );
  }
  if (msg.includes('max priority fee per gas') || msg.includes('tip too low')) {
    return ok(
      `Priority fee (tip) terlalu rendah`,
      raw.slice(0, 200),
      'gas',
      `Naikkan maxPriorityFeePerGas agar miner/validator memprioritaskan TX ini.`,
    );
  }

  if (msg.includes('could not detect network') || msg.includes('failed to detect network')) {
    return ok(
      `Tidak bisa detect network — RPC tidak merespons`,
      raw.slice(0, 200),
      'network',
      `Ganti ke RPC lain di Settings Networks, atau cek status jaringan di chainlist.org.`,
    );
  }
  if (msg.includes('connection refused') || msg.includes('econnrefused')) {
    return ok(
      `Koneksi ke RPC ditolak`,
      raw.slice(0, 200),
      'network',
      `RPC endpoint tidak aktif atau diblokir. Coba RPC publik alternatif.`,
    );
  }
  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('request timed out')) {
    return ok(
      `Request ke RPC timeout`,
      raw.slice(0, 200),
      'network',
      `RPC terlalu lambat atau overload. Coba ganti RPC atau ulangi beberapa saat lagi.`,
    );
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
    return ok(
      `Rate limit RPC — terlalu banyak request`,
      raw.slice(0, 200),
      'network',
      `Tunggu beberapa detik atau gunakan RPC dengan rate limit lebih tinggi (misalnya daftarkan API key).`,
    );
  }
  if (msg.includes('network changed') || msg.includes('chain id mismatch') || msg.includes('chainid')) {
    return ok(
      `Chain ID tidak cocok — wallet/RPC beda network`,
      raw.slice(0, 200),
      'network',
      `Pastikan network yang dipilih di app sama dengan network aktif di wallet/MetaMask.`,
    );
  }
  if (msg.includes('server error') || msg.includes('internal server') || msg.includes('-32603')) {
    return ok(
      `Internal server error dari node RPC`,
      raw.slice(0, 200),
      'network',
      `RPC node mengalami masalah internal. Coba RPC lain atau tunggu beberapa menit.`,
    );
  }
  if (msg.includes('method not found') || msg.includes('-32601')) {
    return ok(
      `Method RPC tidak didukung oleh node ini`,
      raw.slice(0, 200),
      'network',
      `Node RPC ini tidak mendukung method yang dipanggil. Coba RPC lain atau node yang lebih lengkap.`,
    );
  }
  if (msg.includes('invalid params') || msg.includes('-32602')) {
    return ok(
      `Parameter RPC tidak valid`,
      raw.slice(0, 200),
      'network',
      `Format parameter yang dikirim ke RPC tidak sesuai. Periksa address, data hex, dan tipe input.`,
    );
  }

  if (msg.includes('user rejected') || msg.includes('user denied') || e?.code === 4001) {
    return ok(`TX dibatalkan oleh user di wallet`, '', 'wallet');
  }
  if (msg.includes('invalid private key') || msg.includes('bad private key')) {
    return ok(
      `Private key tidak valid`,
      raw.slice(0, 200),
      'wallet',
      `Pastikan private key 64 karakter hex dan diawali 0x. Jangan gunakan mnemonic di sini.`,
    );
  }
  if (msg.includes('could not sign') || msg.includes('signing failed')) {
    return ok(
      `Gagal menandatangani TX`,
      raw.slice(0, 200),
      'wallet',
      `Pastikan private key benar dan wallet aktif di network yang sesuai.`,
    );
  }
  if (msg.includes('transaction hash mismatch')) {
    return ok(
      `Hash TX tidak cocok — kemungkinan RPC tidak reliable`,
      raw.slice(0, 200),
      'network',
      `Ganti RPC dan coba kirim ulang.`,
    );
  }

  if (msg.includes('contract not deployed') || msg.includes('no contract code at')
      || msg.includes('account does not exist')) {
    return ok(
      `Kontrak tidak ditemukan di address/network ini`,
      raw.slice(0, 200),
      'contract',
      `Pastikan address kontrak benar dan kamu terhubung ke network yang tepat.`,
    );
  }
  if (msg.includes('call exception') || msg.includes('bad result from backend')) {
    return ok(
      `Call ke kontrak gagal — kemungkinan fungsi tidak ada atau input salah`,
      raw.slice(0, 200),
      'contract',
      `Periksa nama fungsi, ABI, dan tipe argumen yang digunakan.`,
    );
  }
  if (msg.includes('invalid argument') || msg.includes('value out of range')) {
    return ok(
      `Argumen tidak valid — nilai di luar jangkauan tipe data`,
      raw.slice(0, 200),
      'contract',
      `Periksa tipe data argumen (uint256, address, bytes32) dan pastikan nilainya dalam range yang benar.`,
    );
  }
  if (msg.includes('overflow') || msg.includes('underflow')) {
    return ok(
      `Overflow / underflow aritmatika`,
      raw.slice(0, 200),
      'contract',
      `Nilai yang dimasukkan terlalu besar atau terlalu kecil untuk tipe data kontrak.`,
    );
  }

  if (raw) {
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    return ok(
      cleaned.slice(0, 160),
      cleaned.length > 160 ? cleaned.slice(160, 360) : '',
      'unknown',
      `Error tidak dikenali. Coba cek di block explorer atau Tenderly untuk detail lebih lanjut.`,
    );
  }

  return ok(
    `TX gagal — error tidak diketahui`,
    '',
    'unknown',
    `Cek koneksi RPC dan coba ulangi. Jika terus gagal, cek TX di block explorer.`,
  );
}

export function safeParseContractArgs(raw: string): any[] {
  try {
    const patched = raw.replace(/(?<!["\d.])(\d{16,})(?![\d".])/g, '"$1"');
    return JSON.parse(patched);
  } catch {
    try { return JSON.parse(raw); } catch { return []; }
  }
}

export function parseArgWithAbiType(val: any, abiInput: any): any {
  const type: string = abiInput?.type ?? '';
  const isTuple = type === 'tuple' || type.startsWith('tuple(') || type.startsWith('tuple[');
  const isUint  = type.startsWith('uint') || type.startsWith('int');

  if (Array.isArray(val)) {
    if (isTuple && abiInput?.components) {
      return (val as any[]).map((v: any, i: number) =>
        parseArgWithAbiType(v, abiInput.components[i] ?? { type: 'bytes' })
      );
    }
    return val;
  }

  if (typeof val === 'string') {
    if (isUint) return val;

    if (isTuple) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && abiInput?.components) {
          return (parsed as any[]).map((v: any, i: number) =>
            parseArgWithAbiType(v, abiInput.components[i] ?? { type: 'bytes' })
          );
        }
        return parsed;
      } catch { }
      try {
        const parsed = JSON.parse('[' + val + ']');
        const comps: any[] = abiInput?.components ?? [];
        return (parsed as any[]).map((v: any, i: number) =>
          parseArgWithAbiType(v, comps[i] ?? { type: 'bytes' })
        );
      } catch { return val; }
    }

    try { return JSON.parse(val); } catch { return val; }
  }

  if (typeof val === 'number' && isUint) return val.toFixed(0);

  return val;
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
    const parsedArgs = argValues.map(v => {
      if (typeof v === 'string' && (v.trim().startsWith('[') || v.trim().startsWith('{'))) {
        try { return JSON.parse(v); } catch { return v; }
      }
      return v;
    });
    onChange({
      ...value,
      contractFunc: selFunc.name,
      contractArgs: JSON.stringify(parsedArgs),
    });
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

      if (estRes.status === 'fulfilled' && estRes.value?.result) {
        gasUsed = parseInt(estRes.value.result, 16);
        method  = 'rpc';
      }

      let baseFeeGwei = 0;
      if (feeRes.status === 'fulfilled' && feeRes.value?.result?.baseFeePerGas?.length) {
        const fees: string[] = feeRes.value.result.baseFeePerGas;
        const latest = fees[fees.length - 1];
        baseFeeGwei = parseInt(latest, 16) / 1e9;
      }

      if (priceRes.status === 'fulfilled' && priceRes.value?.result) {
        gasPriceGwei = parseInt(priceRes.value.result, 16) / 1e9;
      }

      if (baseFeeGwei > 0) {
        gasPriceGwei = baseFeeGwei + 0.1;
      }
    } catch {  }

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

              {selFunc && !isPayable && !isView && (
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

              {isView && (
                <div style={{ background:'#001a2a', border:'1px solid #01a2ff33', borderLeft:'3px solid #01a2ff', padding:'10px 14px', fontSize:'12px', color:'#01a2ff', display:'flex', alignItems:'center', gap:'8px' }}>
                  <FaInfoCircle size={12} />
                  <span>Fungsi <strong>read-only</strong> ({selFunc?.stateMutability}) — tidak mengirim transaksi, tidak ada gas yang digunakan.</span>
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

                {isView ? (
                  <div style={{ fontSize:'11px', color:'#01a2ff', background:'#001a2a', border:'1px solid #01a2ff33', padding:'8px 12px', display:'flex', alignItems:'center', gap:'6px' }}>
                    <FaInfoCircle size={10}/>
                    Fungsi read-only — tidak membutuhkan gas.
                  </div>
                ) : (
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
                )}

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
                </div> {}
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
                <FieldLabel tip='Array JSON argumen. Simple: ["0xabc", "1000"]. Tuple bersarang: [["val1","val2","0x"], ["fee","0"], "0xaddr"]'>
                  Arguments (JSON Array)
                </FieldLabel>
                <input
                  placeholder='Simple: ["0xAddr","1000"] | Tuple: [["40245","0x...","1000","0x0003","0x","0x"],["108874","0"],"0x..."]'
                  value={value.contractArgs}
                  onChange={e => onChange({ ...value, contractArgs: e.target.value })}
                  style={S.input}
                />
                <div style={{ fontSize:'10px', color: C.muted, marginTop:'3px' }}>
                  uint256 dalam wei · bytes kosong = "0x" · tuple = array bersarang [["val1","val2",...]]
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
  ...Object.fromEntries(Array.from({length:32},(_,i)=>[
    (0x60+i).toString(16).padStart(2,'0'),
    { name:`PUSH${i+1}`, inputs:i+1, desc:`Push ${i+1} byte(s) onto stack`, color:'#836efd' }
  ])),
  ...Object.fromEntries(Array.from({length:16},(_,i)=>[
    (0x80+i).toString(16).padStart(2,'0'),
    { name:`DUP${i+1}`, inputs:0, desc:`Duplicate ${i+1}${i===0?'st':i===1?'nd':i===2?'rd':'th'} stack item`, color:'#61dfff' }
  ])),
  ...Object.fromEntries(Array.from({length:16},(_,i)=>[
    (0x90+i).toString(16).padStart(2,'0'),
    { name:`SWAP${i+1}`, inputs:0, desc:`Swap top with ${i+2}nd stack item`, color:'#61dfff' }
  ])),
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



function detectContractPatterns(selectors: string[]): { label: string; color: string; desc: string }[] {
  const s = new Set(selectors);
  const patterns: { label: string; color: string; desc: string }[] = [];


  if (s.has('a9059cbb') && s.has('70a08231') && s.has('095ea7b3') && s.has('18160ddd')) {
    patterns.push({ label: 'ERC-20 Token', color: '#f3ba2f', desc: 'Implementasi token fungible standar' });
    if (s.has('40c10f19') || s.has('a0712d68')) patterns.push({ label: 'Mintable', color: '#4caf50', desc: 'Ada fungsi mint — supply bisa ditambah' });
    if (s.has('42966c68') || s.has('79cc6790')) patterns.push({ label: 'Burnable', color: '#ff6600', desc: 'Ada fungsi burn — token bisa dihancurkan' });
    if (s.has('d505accf')) patterns.push({ label: 'EIP-2612 Permit', color: '#61dfff', desc: 'Mendukung gasless approve via signature' });
  }

  if (s.has('6352211e') && s.has('42842e0e') && s.has('e985e9c5')) {
    patterns.push({ label: 'ERC-721 NFT', color: '#e81899', desc: 'Koleksi NFT (non-fungible token)' });
    if (s.has('2f745c59') || s.has('4f6ccce7')) patterns.push({ label: 'Enumerable', color: '#836efd', desc: 'ERC-721 Enumerable — bisa di-list semua token' });
  }

  if (s.has('00fdd58e') && s.has('2eb2c2d6') && s.has('f242432a')) {
    patterns.push({ label: 'ERC-1155 Multi-Token', color: '#00e676', desc: 'Multi-token standard (batch transfer)' });
  }

  if (s.has('3659cfe6') || s.has('4f1ef286') || s.has('52d1902d')) {
    patterns.push({ label: 'UUPS Proxy', color: '#8c8dfc', desc: 'Upgradeable via UUPS pattern (EIP-1822)' });
  }
  if (s.has('cf7a1d77') || s.has('aaf10f42')) {
    patterns.push({ label: 'Transparent Proxy', color: '#8c8dfc', desc: 'OpenZeppelin Transparent Proxy' });
  }
  if (s.has('c4d66de8') || s.has('e1c7392a') || s.has('8129fc1c')) {
    patterns.push({ label: 'Initializable', color: '#9c27b0', desc: 'Kontrak menggunakan pola initialize() bukan constructor' });
  }

  if (s.has('8da5cb5b') && (s.has('f2fde38b') || s.has('715018a6'))) {
    patterns.push({ label: 'Ownable', color: '#ff6600', desc: 'OpenZeppelin Ownable — ada owner tunggal' });
  }
  if (s.has('5ac86ab7') && s.has('2f2ff15d') && s.has('d547741f')) {
    patterns.push({ label: 'AccessControl', color: '#ff6600', desc: 'Role-based access control (RBAC)' });
  }

  if (s.has('5c975abb') && (s.has('8456cb59') || s.has('3f4ba83a'))) {
    patterns.push({ label: 'Pausable', color: '#ffaa00', desc: 'Kontrak bisa di-pause/unpause' });
  }

  if (s.has('a694fc3a') || (s.has('b6b55f25') && s.has('2e1a7d4d') && s.has('3d18b912'))) {
    patterns.push({ label: 'Staking/Farming', color: '#836efd', desc: 'Pool staking atau yield farming' });
  }

  if (s.has('38ed1739') || s.has('7ff36ab5') || s.has('414bf389')) {
    patterns.push({ label: 'DEX / AMM', color: '#01a2ff', desc: 'Router swap / Automated Market Maker' });
  }
  if (s.has('e8e33700') || s.has('baa2abde')) {
    patterns.push({ label: 'Liquidity Pool', color: '#01a2ff', desc: 'Bisa add/remove liquidity' });
  }

  if (s.has('6a761202') && s.has('a0e67e2b') && s.has('e75235b8')) {
    patterns.push({ label: 'Gnosis Safe / Multisig', color: '#00e676', desc: 'Multi-signature wallet' });
  }

  if (s.has('7d5e81e2') && s.has('56781388')) {
    patterns.push({ label: 'Governor / DAO', color: '#4caf50', desc: 'On-chain governance / voting' });
  }

  if (s.has('3a871cdd') || s.has('b61d27f6')) {
    patterns.push({ label: 'ERC-4337 Account Abstraction', color: '#61dfff', desc: 'Smart contract wallet / Account Abstraction' });
  }

  if (s.has('ac9650d8') || s.has('5ae401dc') || s.has('252dba42')) {
    patterns.push({ label: 'Multicall', color: '#888', desc: 'Batch beberapa call dalam satu transaksi' });
  }

  if (s.has('4e71d92d') || s.has('48c54b9d') || s.has('5c85974f')) {
    patterns.push({ label: 'Airdrop / Claim', color: '#f3ba2f', desc: 'Kontrak distribusi / klaim token airdrop' });
  }

  if (s.has('ab9c4b5d') || s.has('5cffe9de') || s.has('490e6cbc')) {
    patterns.push({ label: 'Flashloan', color: '#ff3333', desc: '⚠️ Ada mekanisme flash loan' });
  }

  return patterns;
}


function decodeCalldata(hexCalldata: string): { selector: string; sig: string | null; params: { offset: number; hex: string; decoded: string }[] } | null {
  try {
    const clean = hexCalldata.replace(/^0x/i, '').replace(/\s/g, '').toLowerCase();
    if (clean.length < 8) return null;
    const selector = clean.slice(0, 8);
    const sig = KNOWN_4BYTE[selector] ?? null;
    const paramData = clean.slice(8);
    const params: { offset: number; hex: string; decoded: string }[] = [];
    for (let i = 0; i < paramData.length; i += 64) {
      const chunk = paramData.slice(i, i + 64).padEnd(64, '0');
      let decoded = '0x' + chunk;

      if (chunk.startsWith('000000000000000000000000')) {
        const addr = '0x' + chunk.slice(24);
        if (/^[0-9a-f]{40}$/.test(addr) && !addr.match(/^0+$/)) {
          decoded = `address: 0x${addr}`;
        }
      }

      const bn = BigInt('0x' + chunk);
      if (bn < BigInt('0xffffffffffff')) decoded = `uint: ${bn.toString()}`;

      if (chunk === '0'.repeat(63) + '0') decoded = 'bool: false';
      if (chunk === '0'.repeat(63) + '1') decoded = 'bool: true';
      params.push({ offset: i / 2, hex: '0x' + chunk, decoded });
    }
    return { selector, sig, params };
  } catch { return null; }
}


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

interface DetectedFunc {
  selector: string;
  known: string | null;
  offset: number;
}

function extractFunctionSelectors(hexInput: string): DetectedFunc[] {
  const clean = hexInput.replace(/^0x/i, '').toLowerCase().replace(/[^0-9a-f]/g, '');
  const found: DetectedFunc[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < clean.length - 10; i += 2) {
    if (clean.slice(i, i + 2) === '63') {
      const sel = clean.slice(i + 2, i + 10);
      if (sel.length === 8 && !seen.has(sel) && !/^0{8}$/.test(sel) && !/^f{8}$/.test(sel)) {
        seen.add(sel);
        found.push({ selector: sel, known: KNOWN_4BYTE[sel] ?? null, offset: i / 2 });
      }
    }
  }
  return found;
}


interface AbiEntry {
  type: string;
  name: string;
  inputs: { name: string; type: string; internalType?: string }[];
  outputs: { name: string; type: string; internalType?: string }[];
  stateMutability: string;
}


function parseSigToAbi(sig: string): AbiEntry | null {
  const m = sig.match(/^(\w+)\(([^)]*)\)$/);
  if (!m) return null;
  const name = m[1];
  const rawParams = m[2];

  const parseParams = (raw: string): { name: string; type: string; internalType?: string }[] => {
    if (!raw.trim()) return [];
    const result: { name: string; type: string }[] = [];
    let depth = 0, current = '';
    for (const ch of raw) {
      if (ch === '(') { depth++; current += ch; }
      else if (ch === ')') { depth--; current += ch; }
      else if (ch === ',' && depth === 0) { result.push(parseOneParam(current.trim())); current = ''; }
      else { current += ch; }
    }
    if (current.trim()) result.push(parseOneParam(current.trim()));
    return result;
  };

  const parseOneParam = (s: string, idx?: number): { name: string; type: string } => {
    const parts = s.trim().split(/\s+/);
    if (parts.length >= 2) return { type: parts[0], name: parts[1] };
    return { type: s.trim(), name: `arg${idx ?? 0}` };
  };

  const inputs = parseParams(rawParams).map((p, i) => ({ ...p, name: p.name || `arg${i}`, internalType: p.type }));

  const viewNames = /^(get|is|has|balance|total|name|symbol|decimals|owner|allowance|supply|supports|paused|version|uri|domain|nonce|earned|pending|price|quote|estimate|compute|preview|convert)/i;
  const payableNames = /^(mint|buy|purchase|deposit|fund|pay|contribute|addLiquidity|bridge|swap.*ETH|buyToken)/i;
  const stateMutability = viewNames.test(name) ? 'view' : payableNames.test(name) ? 'payable' : 'nonpayable';

  let outputs: { name: string; type: string; internalType?: string }[] = [];
  if (viewNames.test(name)) {
    if (/balance|amount|total|supply|price|value|count|length|id|nonce|rate|time|duration|period|reward/i.test(name)) outputs = [{ name: '', type: 'uint256', internalType: 'uint256' }];
    else if (/address|owner|spender|operator|token|asset|impl/i.test(name)) outputs = [{ name: '', type: 'address', internalType: 'address' }];
    else if (/name|symbol|uri|version|string/i.test(name)) outputs = [{ name: '', type: 'string', internalType: 'string' }];
    else if (/bool|is|has|supports|paused/i.test(name)) outputs = [{ name: '', type: 'bool', internalType: 'bool' }];
    else outputs = [{ name: '', type: 'uint256', internalType: 'uint256' }];
  } else if (/approve|transfer/i.test(name)) {
    outputs = [{ name: '', type: 'bool', internalType: 'bool' }];
  }

  return { type: 'function', name, inputs, outputs, stateMutability };
}

function buildAbiFromSelectors(funcs: DetectedFunc[]): AbiEntry[] {
  const entries: AbiEntry[] = [];
  for (const f of funcs) {
    if (!f.known) continue;
    const entry = parseSigToAbi(f.known);
    if (entry) entries.push(entry);
  }
  const seen = new Set<string>();
  return entries.filter(e => { const k = e.name; if (seen.has(k)) return false; seen.add(k); return true; });
}

function extractStrings(hexInput: string): string[] {
  const clean = hexInput.replace(/^0x/i, '').toLowerCase().replace(/[^0-9a-f]/g, '');
  const strings: string[] = [];
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
  return [...new Set(strings)].filter(s => s.trim().length >= 4);
}


const CalldataDecoder: React.FC = () => {
  const [cdInput, setCdInput] = useState('');
  const [cdResult, setCdResult] = useState<ReturnType<typeof decodeCalldata> | null>(null);
  const [cdCopied, setCdCopied] = useState(false);

  const handleDecode = () => {
    const r = decodeCalldata(cdInput.trim());
    setCdResult(r);
  };

  return (
    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:'2px solid #f3ba2f', padding:'18px', marginBottom:'16px' }}>
      <h3 style={{ margin:'0 0 12px', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#f3ba2f', display:'flex', alignItems:'center', gap:'6px' }}>
        <FaCode /> Calldata Decoder
      </h3>
      <p style={{ fontSize:'12px', color:'#444', margin:'0 0 10px' }}>
        Decode calldata hex menjadi selector + parameter. Paste calldata dari tx di explorer.
      </p>
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        <input
          value={cdInput}
          onChange={e => { setCdInput(e.target.value); setCdResult(null); }}
          placeholder="0xa9059cbb000000000000000000000000..."
          style={{ flex:1, fontFamily:'monospace', fontSize:'12px', background:'#070707', border:'1px solid #2a2a2a', color:'#aaa', padding:'8px 12px', minWidth:'200px' }}
        />
        <button onClick={handleDecode}
          style={{ background:'#f3ba2f', color:'#000', border:'none', padding:'8px 18px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', whiteSpace:'nowrap' }}>
          Decode
        </button>
        {cdInput && (
          <button onClick={() => { setCdInput(''); setCdResult(null); }}
            style={{ background:'none', border:'1px solid #333', color:'#555', padding:'8px 12px', cursor:'pointer', fontSize:'12px' }}>
            Clear
          </button>
        )}
      </div>

      {cdResult && (
        <div style={{ marginTop:'14px' }}>
          <div style={{ display:'flex', gap:'8px', marginBottom:'10px', flexWrap:'wrap', alignItems:'center' }}>
            <code style={{ fontSize:'13px', color:'#836efd', fontFamily:'monospace', background:'#111', padding:'4px 10px', border:'1px solid #1e1e1e' }}>
              0x{cdResult.selector}
            </code>
            {cdResult.sig ? (
              <span style={{ fontSize:'13px', color:'#f3ba2f', fontFamily:'monospace', fontWeight:'bold' }}>{cdResult.sig}</span>
            ) : (
              <span style={{ fontSize:'12px', color:'#555', fontStyle:'italic' }}>
                Signature tidak dikenal —{' '}
                <a href={`https://www.4byte.directory/signatures/?bytes4_signature=0x${cdResult.selector}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>cari di 4byte.directory</a>
              </span>
            )}
            <button
              onClick={() => {
                const txt = cdResult.sig
                  ? `Selector: 0x${cdResult.selector}\nSignature: ${cdResult.sig}\n\n${cdResult.params.map((p,i)=>`[${i}] ${p.decoded}`).join('\n')}`
                  : `Selector: 0x${cdResult.selector} (unknown)`;
                navigator.clipboard.writeText(txt);
                setCdCopied(true);
                setTimeout(() => setCdCopied(false), 2000);
              }}
              style={{ marginLeft:'auto', background:'none', border:'1px solid #333', color: cdCopied ? '#4caf50' : '#555', padding:'4px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px' }}>
              {cdCopied ? <><FaCheck size={10}/> Copied</> : <><FaRegCopy size={10}/> Copy</>}
            </button>
          </div>

          {cdResult.params.length > 0 && (
            <div style={{ background:'#070707', border:'1px solid #1a1a1a' }}>
              <div style={{ padding:'6px 12px', borderBottom:'1px solid #1a1a1a', fontSize:'10px', color:'#333', textTransform:'uppercase', letterSpacing:'1px', display:'grid', gridTemplateColumns:'60px 1fr 1fr' }}>
                <span>SLOT</span>
                <span>HEX (32 bytes)</span>
                <span>DECODED</span>
              </div>
              {cdResult.params.map((p, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr', padding:'6px 12px', borderBottom:'1px solid #0a0a0a', fontSize:'11px', fontFamily:'monospace' }}>
                  <span style={{ color:'#333' }}>[{i}]</span>
                  <span style={{ color:'#444', wordBreak:'break-all', fontSize:'10px' }}>{p.hex.slice(0,18)}…</span>
                  <span style={{ color:'#f3ba2f', wordBreak:'break-all' }}>{p.decoded}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const EventTopicLookup: React.FC = () => {
  const [topicInput, setTopicInput] = useState('');
  const [topicResult, setTopicResult] = useState<typeof KNOWN_TOPICS[string] | null | 'notfound'>(null);

  const handleLookup = () => {
    const clean = topicInput.trim().replace(/^0x/i, '').toLowerCase();
    if (KNOWN_TOPICS[clean]) setTopicResult(KNOWN_TOPICS[clean]);
    else setTopicResult('notfound');
  };

  const catColor: Record<string, string> = {
    'ERC-20':'#f3ba2f', 'ERC-721':'#e81899', 'ERC-1155':'#00e676',
    'Access':'#ff6600', 'Pausable':'#ffaa00', 'Proxy':'#8c8dfc',
    'DeFi':'#01a2ff', 'DEX':'#61dfff', 'Staking':'#836efd',
    'Governance':'#4caf50',
  };

  return (
    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:'2px solid #9c27b0', padding:'18px', marginBottom:'16px' }}>
      <h3 style={{ margin:'0 0 12px', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#9c27b0', display:'flex', alignItems:'center', gap:'6px' }}>
        <FaList /> Event Topic Lookup
      </h3>
      <p style={{ fontSize:'12px', color:'#444', margin:'0 0 10px' }}>
        Lookup topic0 dari event log (keccak256 hash 32 bytes) ke nama event yang dikenal.
      </p>
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        <input
          value={topicInput}
          onChange={e => { setTopicInput(e.target.value); setTopicResult(null); }}
          placeholder="0xddf252ad1be2c89b69c2b068fc378daa..."
          style={{ flex:1, fontFamily:'monospace', fontSize:'12px', background:'#070707', border:'1px solid #2a2a2a', color:'#aaa', padding:'8px 12px', minWidth:'200px' }}
        />
        <button onClick={handleLookup}
          style={{ background:'#9c27b0', color:'#fff', border:'none', padding:'8px 18px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', whiteSpace:'nowrap' }}>
          Lookup
        </button>
      </div>

      {topicResult && topicResult !== 'notfound' && (
        <div style={{ marginTop:'12px', background:'#070707', border:'1px solid #1a1a1a', padding:'12px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'13px', color:'#fff', fontFamily:'monospace', fontWeight:'bold' }}>{topicResult.sig}</span>
            <span style={{ fontSize:'10px', padding:'2px 8px', border:`1px solid ${catColor[topicResult.category]||'#555'}`, color:catColor[topicResult.category]||'#555' }}>
              {topicResult.category}
            </span>
          </div>
          <div style={{ fontSize:'12px', color:'#888' }}>{topicResult.desc}</div>
        </div>
      )}
      {topicResult === 'notfound' && (
        <div style={{ marginTop:'12px', fontSize:'12px', color:'#555', fontStyle:'italic' }}>
          Topic tidak ditemukan di database lokal.{' '}
          <a href={`https://www.4byte.directory/event-signatures/?bytes4_signature=${topicInput.trim()}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>Cek di 4byte.directory</a>
        </div>
      )}

      {}
      <details style={{ marginTop:'14px' }}>
        <summary style={{ cursor:'pointer', fontSize:'11px', color:'#333', userSelect:'none', padding:'6px 0' }}>
          Lihat semua {Object.keys(KNOWN_TOPICS).length} event topic yang dikenal ▾
        </summary>
        <div style={{ marginTop:'8px', display:'flex', flexDirection:'column', gap:'4px', maxHeight:'300px', overflowY:'auto' }}>
          {Object.entries(KNOWN_TOPICS).map(([hash, ev]) => (
            <div key={hash} style={{ display:'grid', gridTemplateColumns:'90px 1fr 80px', gap:'8px', padding:'6px 10px', background:'#070707', border:'1px solid #0f0f0f', fontSize:'11px', fontFamily:'monospace', cursor:'pointer' }}
              onClick={() => setTopicInput('0x' + hash)}>
              <code style={{ color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>0x{hash.slice(0,6)}…</code>
              <span style={{ color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.sig}</span>
              <span style={{ fontSize:'10px', color: catColor[ev.category]||'#555', textAlign:'right' }}>{ev.category}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

export interface AiSecFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location: string;
  recommendation: string;
}
export interface AiSecResult {
  verdict: 'SAFE' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL';
  score: number;
  summary: string;
  language: string;
  findings: AiSecFinding[];
  positives: string[];
  patterns_detected: string[];
  overall_explanation: string;
}


export const AISEC_VERDICT_META: Record<AiSecResult['verdict'], { label: string; color: string }> = {
  SAFE:         { label: 'AMAN',          color: '#4caf50' },
  LOW_RISK:     { label: 'RISIKO RENDAH', color: '#8bc34a' },
  MEDIUM_RISK:  { label: 'RISIKO SEDANG', color: '#F1C40F' },
  HIGH_RISK:    { label: 'RISIKO TINGGI', color: '#ff9800' },
  CRITICAL:     { label: 'KRITIS/BAHAYA', color: '#f44336' },
};

const AI_SEC_SYSTEM_PROMPT = `Kamu adalah expert security auditor dan smart contract / code reviewer. Analisis kode yang diberikan secara SANGAT DETAIL untuk menemukan kerentanan keamanan, backdoor, atau kode berbahaya.

PENTING: Jawab HANYA dalam format JSON berikut, tidak ada teks lain di luar JSON:
{
  "verdict": "SAFE" | "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK" | "CRITICAL",
  "score": <angka 0-100, 100=paling aman>,
  "summary": "<ringkasan singkat 2-3 kalimat dalam Bahasa Indonesia>",
  "language": "<bahasa pemrograman yang terdeteksi>",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "title": "<judul temuan singkat>",
      "description": "<penjelasan SANGAT DETAIL mengapa ini berbahaya — minimal 3-4 kalimat, jelaskan mekanisme serangan, dampak nyata, dan konteks dalam Bahasa Indonesia>",
      "location": "<nama fungsi / baris / variabel spesifik yang bermasalah>",
      "recommendation": "<saran konkret dan spesifik untuk memperbaiki masalah ini>"
    }
  ],
  "positives": ["<hal baik 1>", "<hal baik 2>"],
  "patterns_detected": ["<pola yang terdeteksi 1>", "<pola 2>"],
  "overall_explanation": "<penjelasan menyeluruh 4-6 kalimat: apa tujuan kode ini, bagaimana cara kerjanya, potensi risiko keseluruhan, dan rekomendasi umum — dalam Bahasa Indonesia>"
}

Analisis mencakup:
- Reentrancy attack (untuk Solidity)
- Integer overflow / underflow
- Access control yang lemah atau hilang
- Private key / mnemonic / credential hardcoded
- Pengiriman data ke server external (exfiltration)
- Penggunaan fungsi berbahaya: eval(), exec(), shell=True, selfdestruct, delegatecall, tx.origin
- Logika yang mencurigakan atau tersembunyi
- Missing input validation
- Unchecked external calls
- Pola rugpull (mint tak terbatas, blacklist, fee tersembunyi, pause)
- Hal-hal positif dan praktik keamanan yang sudah benar

Berikan skor yang jujur. Jika kode benar-benar aman, katakan aman.`;


export async function runAiCodeSecurityScan(code: string, lang: string = 'auto'): Promise<AiSecResult> {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('Kode kosong — paste kode terlebih dahulu.');

  const userPrompt = `Analisis keamanan kode berikut${lang !== 'auto' ? ` (${lang})` : ''}:\n\n\`\`\`\n${trimmed}\n\`\`\``;

  let resp: Response;
  try {
    resp = await fetch('/api/ai-security-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: AI_SEC_SYSTEM_PROMPT, prompt: userPrompt }),
    });
  } catch {
    throw new Error(
      'Nggak bisa hubungin backend AI Security Scan ("/api/ai-security-scan" tidak ditemukan/tidak merespons). ' +
      'API Anthropic memang TIDAK BISA dipanggil langsung dari browser (diblokir CORS, dan API key bakal ke-expose ' +
      'ke publik kalau dipaksakan) — endpoint backend proxy kecil perlu dibuat dulu di server kamu (lihat contoh di komentar kode fungsi ini).'
    );
  }
  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => '');
    throw new Error(`Backend AI Security Scan gagal (HTTP ${resp.status}).${bodyText ? ` ${bodyText.slice(0, 300)}` : ''}`);
  }
  const data = await resp.json();
  const raw = (data.content ?? []).find((b: any) => b.type === 'text')?.text ?? '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned) as AiSecResult;
  } catch {
    throw new Error('Gagal membaca hasil analisis (respons AI tidak valid JSON).');
  }
}


export interface CompiledContract {
  contractName: string;
  abi: any[];
  bytecode: string;
  warnings: string[];
}

const SOLC_CDN_BASE = 'https://binaries.soliditylang.org/bin/';

const SOLC_FALLBACK_FILE = 'soljson-v0.8.24+commit.e11b9ed9.js';

async function resolveSolcFileName(): Promise<string> {
  try {
    const res = await fetch(SOLC_CDN_BASE + 'list.json');
    if (res.ok) {
      const list = await res.json();
      const fname = list?.releases?.[list?.latestRelease];
      if (typeof fname === 'string' && fname) return fname;
    }
  } catch {  }
  return SOLC_FALLBACK_FILE;
}


const NPM_CDN_BASE = 'https://cdn.jsdelivr.net/npm/';

function extractImportPaths(source: string): string[] {
  const re = /import\s+(?:[^'"]*?from\s+)?["']([^"']+)["']/g;
  const paths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) paths.push(m[1]);
  return paths;
}

// Resolve import RELATIF ("./X.sol", "../Y.sol") terhadap path file yang meng-import-nya —
// import non-relatif (nama package langsung, mis. "@openzeppelin/contracts/...") dibalikin
// apa adanya karena sudah berupa path lengkap dari root package.
function resolveImportPath(fromPath: string, importPath: string): string {
  if (!importPath.startsWith('.')) return importPath;
  const baseParts = fromPath.split('/').slice(0, -1);
  for (const part of importPath.split('/')) {
    if (part === '.' || part === '') continue;
    else if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }
  return baseParts.join('/');
}

async function fetchImportSource(path: string): Promise<string> {
  const url = NPM_CDN_BASE + path;
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) {
    throw new Error(`Gagal fetch dependency "${path}" dari CDN (${url}) — pastikan nama package & path-nya benar (case-sensitive), atau cek koneksi internet.`);
  }
  return res.text();
}

// BFS ambil semua import (termasuk yang nested) sampai nggak ada yang belum ke-fetch.
// Balikin map { path: content } yang siap digabung ke `sources` Standard JSON.
async function resolveAllImports(entrySource: string): Promise<Record<string, string>> {
  const sources: Record<string, string> = {};
  const seen = new Set<string>();
  const queue: string[] = extractImportPaths(entrySource).map(p => p.startsWith('.') ? p.replace(/^\.\//, '') : p);
  queue.forEach(p => seen.add(p));

  while (queue.length > 0) {
    const path = queue.shift()!;
    if (sources[path]) continue;
    const content = await fetchImportSource(path);
    sources[path] = content;
    for (const imp of extractImportPaths(content)) {
      const resolved = resolveImportPath(path, imp);
      if (!seen.has(resolved)) { seen.add(resolved); queue.push(resolved); }
    }
  }
  return sources;
}

// Worker dibuat dari Blob supaya tidak perlu file terpisah di project — isinya cuma
// `importScripts(url)` + jembatan pesan compile (lihat penjelasan lengkap di atas).
const SOLC_WORKER_SRC = `
self.onmessage = function (e) {
  var msg = e.data || {};
  if (msg.type === 'load') {
    try {
      importScripts(msg.url);
      self.postMessage({ type: 'loaded', reqId: msg.reqId });
    } catch (err) {
      self.postMessage({ type: 'error', reqId: msg.reqId, error: String((err && err.message) || err) });
    }
    return;
  }
  if (msg.type === 'compile') {
    try {
      var Module = self.Module;
      if (!Module || typeof Module.cwrap !== 'function') {
        throw new Error('Module Emscripten tidak ditemukan di dalam worker.');
      }
      var compileFn;
      try {
        var c2 = Module.cwrap('solidity_compile', 'string', ['string', 'number']);
        compileFn = function (json) { return c2(json, 0); };
        compileFn('{"language":"Solidity","sources":{},"settings":{"outputSelection":{}}}'); // uji cepat signature
      } catch (sigErr) {
        var c1 = Module.cwrap('solidity_compile', 'string', ['string']);
        compileFn = function (json) { return c1(json); };
      }
      var out = compileFn(msg.input);
      self.postMessage({ type: 'result', reqId: msg.reqId, output: out });
    } catch (err) {
      self.postMessage({ type: 'error', reqId: msg.reqId, error: String((err && err.message) || err) });
    }
  }
};
`;

let solcWorker: Worker | null = null;
let solcWorkerReadyPromise: Promise<void> | null = null;
let solcReqCounter = 0;

function getSolcWorker(): Worker {
  if (solcWorker) return solcWorker;
  const blob = new Blob([SOLC_WORKER_SRC], { type: 'application/javascript' });
  solcWorker = new Worker(URL.createObjectURL(blob));
  return solcWorker;
}

function solcWorkerRequest(worker: Worker, msg: Record<string, any>, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const reqId = ++solcReqCounter;
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timeout menunggu respons worker compiler Solidity.')); }, timeoutMs);
    const onMessage = (e: MessageEvent) => {
      const data = e.data || {};
      if (data.reqId !== reqId) return;
      cleanup();
      if (data.type === 'error') reject(new Error(data.error || 'Worker compiler gagal.'));
      else resolve(data);
    };
    const onError = (e: ErrorEvent) => { cleanup(); reject(new Error(e.message || 'Worker compiler crash.')); };
    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ ...msg, reqId });
  });
}

async function ensureSolcWorkerLoaded(): Promise<Worker> {
  const worker = getSolcWorker();
  if (!solcWorkerReadyPromise) {
    solcWorkerReadyPromise = (async () => {
      const fileName = await resolveSolcFileName();
      await solcWorkerRequest(worker, { type: 'load', url: SOLC_CDN_BASE + fileName }, 30000);
    })();
  }
  try {
    await solcWorkerReadyPromise;
  } catch (err) {
    // Reset state biar percobaan BERIKUTNYA nggak nyangkut di promise yang udah gagal —
    // worker lama di-terminate & dibuat ulang dari nol pas dipanggil lagi.
    solcWorkerReadyPromise = null;
    try { worker.terminate(); } catch { /* ignore */ }
    solcWorker = null;
    throw err;
  }
  return worker;
}

export async function compileSolidity(source: string, preferredContractName?: string): Promise<CompiledContract> {
  const src = source.trim();
  if (!src) throw new Error('Kode Solidity kosong.');

  const worker = await ensureSolcWorkerLoaded();

  // Kalau kode nggak punya `import` sama sekali, ini langsung balikin {} tanpa hit network.
  let importedSources: Record<string, string>;
  try {
    importedSources = await resolveAllImports(src);
  } catch (err: any) {
    throw new Error(err?.message || 'Gagal resolve dependency import.');
  }

  const input = {
    language: 'Solidity',
    sources: {
      'Contract.sol': { content: src },
      ...Object.fromEntries(Object.entries(importedSources).map(([p, c]) => [p, { content: c }])),
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };

  // Compile kontrak panjang/kompleks bisa makan beberapa detik di WASM — timeout dikasih
  // longgar (2 menit) supaya nggak keputus di tengah jalan buat kontrak yang wajar besarnya.
  const res = await solcWorkerRequest(worker, { type: 'compile', input: JSON.stringify(input) }, 120_000);
  const output = JSON.parse(res.output);

  const errors: string[] = [];
  const warnings: string[] = [];
  for (const e of output.errors ?? []) {
    if (e.severity === 'error') errors.push(e.formattedMessage || e.message);
    else warnings.push(e.formattedMessage || e.message);
  }
  if (errors.length > 0) {
    throw new Error('Compile gagal:\n' + errors.join('\n'));
  }

  const contracts = output.contracts?.['Contract.sol'] ?? {};
  const names = Object.keys(contracts);
  if (names.length === 0) throw new Error('Tidak ada contract yang terdeteksi dalam kode (pastikan ada `contract ... { }`).');

  // Kalau ada beberapa contract dalam satu file, pilih yang namanya cocok (kalau diberikan),
  // atau contract TERAKHIR yang dideklarasikan (konvensi umum: kontrak utama ditulis paling akhir/atas).
  const chosenName = (preferredContractName && names.includes(preferredContractName))
    ? preferredContractName
    : names[names.length - 1];

  const chosen = contracts[chosenName];
  const bytecode = chosen?.evm?.bytecode?.object;
  if (!bytecode) throw new Error(`Contract "${chosenName}" tidak menghasilkan bytecode (abstract contract / interface?).`);

  return {
    contractName: chosenName,
    abi: chosen.abi ?? [],
    bytecode: bytecode.startsWith('0x') ? bytecode : '0x' + bytecode,
    warnings,
  };
}

export const BytecodeExplorer: React.FC = () => {
  const [input,      setInput]      = useState('');
  const [tab,        setTab]        = useState<'disasm'|'funcs'|'strings'|'abi'|'tools'|'patterns'|'aisec'>('disasm');
  const [filterOp,   setFilterOp]   = useState('');
  const [disasm,     setDisasm]     = useState<DisasmInstruction[]>([]);
  const [funcs,      setFuncs]      = useState<DetectedFunc[]>([]);
  const [strings,    setStrings]    = useState<string[]>([]);
  const [abiEntries, setAbiEntries] = useState<AbiEntry[]>([]);
  const [parsed,     setParsed]     = useState(false);
  const [error,      setError]      = useState('');
  const [showMax,    setShowMax]    = useState(500);
  const [abiCopied,  setAbiCopied]  = useState(false);
  const [patterns,   setPatterns]   = useState<{ label: string; color: string; desc: string }[]>([]);
  const [hasSelfDestruct, setHasSelfDestruct] = useState(false);
  const [lookupLoading, setLookupLoading] = useState<string | null>(null);
  const [lookupResults, setLookupResults] = useState<Record<string, string>>({});

  // ── AI Security Analyzer state ──
  const [secCodeInput,  setSecCodeInput]  = useState('');
  const [secLang,       setSecLang]       = useState('auto');
  const [secLoading,    setSecLoading]    = useState(false);
  const [secResult,     setSecResult]     = useState<AiSecResult | null>(null);
  const [secError,      setSecError]      = useState('');
  const [secSubTab,     setSecSubTab]     = useState<'findings'|'positives'|'explain'>('findings');

  const handleParse = () => {
    const clean = input.trim().replace(/\s/g, '');
    if (!clean) { setError('Masukkan bytecode hex dulu.'); return; }
    const hex = clean.replace(/^0x/i, '');
    if (hex.length % 2 !== 0) { setError('Bytecode tidak valid: panjang ganjil.'); return; }
    if (!/^[0-9a-fA-F]*$/.test(hex)) { setError('Bytecode mengandung karakter non-hex.'); return; }
    setError('');
    const d = disassemble(clean);
    setDisasm(d);
    const detectedFuncs = extractFunctionSelectors(clean);
    setFuncs(detectedFuncs);
    setStrings(extractStrings(clean));
    setAbiEntries(buildAbiFromSelectors(detectedFuncs));
    setPatterns(detectContractPatterns(detectedFuncs.map(f => f.selector)));
    setHasSelfDestruct(d.some(ins => ins.op === 'SELFDESTRUCT'));
    setParsed(true);
    setShowMax(500);
    setTab('disasm');
    setLookupResults({});
  };

  const handleClear = () => {
    setInput(''); setDisasm([]); setFuncs([]); setStrings([]); setAbiEntries([]);
    setParsed(false); setError(''); setFilterOp(''); setPatterns([]); setLookupResults({});
  };

  const analyzeCodeSecurity = async () => {
    const code = secCodeInput.trim();
    if (!code) { setSecError('Paste kode terlebih dahulu.'); return; }
    setSecLoading(true);
    setSecResult(null);
    setSecError('');
    try {
      const result = await runAiCodeSecurityScan(code, secLang);
      setSecResult(result);
      setSecSubTab('findings');
    } catch (e: any) {
      setSecError('Gagal menganalisis kode: ' + (e?.message ?? 'unknown error'));
    } finally {
      setSecLoading(false);
    }
  };

  const [lookupAllLoading, setLookupAllLoading] = useState(false);
  const [lookupAllProgress, setLookupAllProgress] = useState<{done:number;total:number}|null>(null);

  // Lookup unknown selector against 4byte.directory via Anthropic API proxy
  const lookup4Byte = async (selector: string) => {
    if (lookupResults[selector] !== undefined) return;
    setLookupLoading(selector);
    try {
      const res = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`);
      if (res.ok) {
        const data = await res.json();
        const sigs: any[] = data.results ?? [];
        const result = sigs.length > 0 ? sigs.map((s: any) => s.text_signature).join(' | ') : '(not found)';
        const newResults = { ...lookupResults, [selector]: result };
        setLookupResults(newResults);
        rebuildAbiWithLookup(funcs, newResults);
      } else {
        setLookupResults(prev => ({ ...prev, [selector]: '(lookup failed)' }));
      }
    } catch {
      setLookupResults(prev => ({ ...prev, [selector]: '(lookup failed — CORS/network)' }));
    } finally {
      setLookupLoading(null);
    }
  };

  /** Rebuild abiEntries dengan menggabungkan known DB lokal + hasil lookupResults */
  const rebuildAbiWithLookup = (currentFuncs: DetectedFunc[], currentLookup: Record<string, string>) => {
    const entries: AbiEntry[] = [];
    const seen = new Set<string>();
    for (const f of currentFuncs) {
      const sig = f.known ?? (() => {
        const raw = currentLookup[f.selector];
        if (!raw || raw.startsWith('(')) return null;
        return raw.split(' | ')[0].trim();
      })();
      if (!sig) continue;
      const entry = parseSigToAbi(sig);
      if (!entry || seen.has(entry.name)) continue;
      seen.add(entry.name);
      entries.push(entry);
    }
    setAbiEntries(entries);
  };

  // Lookup all unknown selectors sequentially
  const lookupAll4Byte = async () => {
    const unknown = funcs.filter(f => !f.known && lookupResults[f.selector] === undefined);
    if (unknown.length === 0) return;
    setLookupAllLoading(true);
    setLookupAllProgress({ done: 0, total: unknown.length });
    const newResults = { ...lookupResults };
    for (let i = 0; i < unknown.length; i++) {
      const selector = unknown[i].selector;
      try {
        const res = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`);
        if (res.ok) {
          const data = await res.json();
          const sigs: any[] = data.results ?? [];
          newResults[selector] = sigs.length > 0 ? sigs.map((s: any) => s.text_signature).join(' | ') : '(not found)';
        } else {
          newResults[selector] = '(lookup failed)';
        }
      } catch {
        newResults[selector] = '(lookup failed — CORS/network)';
      }
      setLookupResults({ ...newResults });
      setLookupAllProgress({ done: i + 1, total: unknown.length });
      await new Promise(r => setTimeout(r, 120));
    }
    setLookupAllLoading(false);
    setLookupAllProgress(null);
    // Rebuild ABI dengan semua hasil lookup yang berhasil
    rebuildAbiWithLookup(funcs, newResults);
  };

  const filteredDisasm = filterOp
    ? disasm.filter(d => d.op.toLowerCase().includes(filterOp.toLowerCase()))
    : disasm;

  const byteCount = input.replace(/^0x/i,'').replace(/\s/g,'').replace(/[^0-9a-fA-F]/g,'').length / 2;

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
    padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: `2px solid ${active ? '#836efd' : 'transparent'}`,
    color: active ? '#836efd' : '#555',
    fontSize: '12px', fontWeight: active ? 'bold' : 'normal',
    transition: 'all 0.2s', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: '5px',
  });

  return (
    <div>
      {/* Input Panel */}
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

      {/* Tools always visible */}
      <CalldataDecoder />
      <EventTopicLookup />

      {parsed && (
        <>
          {/* Stats */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Total Instruksi', value: disasm.length.toLocaleString(),  color:'#836efd' },
              { label:'Fungsi Terdeteksi', value: funcs.length,                  color:'#f3ba2f' },
              { label:'Dikenal', value: funcs.filter(f=>f.known).length,         color:'#4caf50' },
              { label:'Unknown', value: funcs.filter(f=>!f.known).length,        color:'#ff6600' },
              { label:'ABI Terbentuk', value: abiEntries.length,                 color:'#00e676' },
              { label:'String', value: strings.length,                           color:'#01a2ff' },
              { label:'Ukuran', value: `${Math.floor(byteCount).toLocaleString()} bytes`, color:'#888' },
            ].map(s => (
              <div key={s.label} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${s.color}`, padding:'10px 14px', flex:1, minWidth:'100px' }}>
                <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{s.label}</div>
                <div style={{ fontFamily:'monospace', fontWeight:'bold', fontSize:'16px', color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {hasSelfDestruct && (
            <div style={{ background:'#1a0000', border:'1px solid #f44336', padding:'10px 16px', marginBottom:'12px', fontSize:'12px', color:'#f44336', display:'flex', gap:'8px', alignItems:'center' }}>
              <FaExclamationTriangle/> <strong>PERINGATAN:</strong> Bytecode mengandung instruksi <code>SELFDESTRUCT</code> — kontrak ini bisa dihancurkan!
            </div>
          )}

          {/* Pattern badges */}
          {patterns.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'14px' }}>
              {patterns.map((p, i) => (
                <span key={i} title={p.desc} style={{ fontSize:'11px', color:p.color, border:`1px solid ${p.color}55`, background:`${p.color}11`, padding:'4px 10px', cursor:'help', display:'flex', alignItems:'center', gap:'4px' }}>
                  <FaShieldAlt size={9}/> {p.label}
                </span>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:'2px', borderBottom:'1px solid #1e1e1e', marginBottom:'16px', overflowX:'auto' }}>
            <button style={tabBtnStyle(tab==='disasm')} onClick={() => setTab('disasm')}>
              <FaList /> Disassembly ({disasm.length})
            </button>
            <button style={tabBtnStyle(tab==='funcs')} onClick={() => setTab('funcs')}>
              <FaCode /> Fungsi ({funcs.length})
            </button>
            <button style={tabBtnStyle(tab==='abi')} onClick={() => setTab('abi')}>
              <FaFileCode /> ABI ({abiEntries.length})
            </button>
            <button style={tabBtnStyle(tab==='strings')} onClick={() => setTab('strings')}>
              <FaTerminal /> Strings ({strings.length})
            </button>
            <button style={tabBtnStyle(tab==='patterns')} onClick={() => setTab('patterns')}>
              <FaLayerGroup /> Patterns ({patterns.length})
            </button>
          </div>

          {/* Disassembly tab */}
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
                {filterOp && <span style={{ fontSize:'11px', color:'#555' }}>{filteredDisasm.length} hasil</span>}
              </div>
              <div style={{ background:'#070707', border:'1px solid #1a1a1a', fontFamily:'monospace', fontSize:'12px', maxHeight:'60vh', overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'70px 30px 120px 1fr', gap:'0', borderBottom:'1px solid #1a1a1a', padding:'6px 12px', fontSize:'10px', color:'#333', textTransform:'uppercase', letterSpacing:'1px', position:'sticky', top:0, background:'#0a0a0a' }}>
                  <span>OFFSET</span><span>HEX</span><span>OPCODE</span><span>OPERAND / DESC</span>
                </div>
                {filteredDisasm.slice(0, showMax).map((ins, idx) => (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:'70px 30px 120px 1fr', gap:'0', padding:'4px 12px', borderBottom:'1px solid #0f0f0f' }}
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
                {filteredDisasm.length === 0 && <div style={{ padding:'24px', textAlign:'center', color:'#333' }}>Tidak ada instruksi yang cocok.</div>}
              </div>
            </>
          )}

          {/* Funcs tab */}
          {tab === 'funcs' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'12px' }}>
                <p style={{ fontSize:'12px', color:'#555', margin:0 }}>
                  Selector 4-byte yang ditemukan dalam bytecode (via PUSH4). Database lokal memiliki {Object.keys(KNOWN_4BYTE).length}+ signature. Klik "Lookup" untuk cari ke 4byte.directory.
                </p>
                {funcs.length > 0 && (() => {
                  const unknownCount = funcs.filter(f => !f.known && lookupResults[f.selector] === undefined).length;
                  return (
                    <button
                      onClick={lookupAll4Byte}
                      disabled={lookupAllLoading || unknownCount === 0}
                      title={unknownCount === 0 ? 'Semua selector sudah di-lookup' : `Lookup ${unknownCount} selector unknown ke 4byte.directory`}
                      style={{
                        background: unknownCount === 0 ? '#0d0d0d' : '#01a2ff22',
                        border: `1px solid ${unknownCount === 0 ? '#222' : '#01a2ff'}`,
                        color: unknownCount === 0 ? '#333' : '#01a2ff',
                        padding:'7px 14px', cursor: unknownCount === 0 ? 'not-allowed' : 'pointer',
                        fontSize:'12px', fontWeight:'bold',
                        display:'flex', alignItems:'center', gap:'6px',
                        flexShrink:0, whiteSpace:'nowrap',
                        opacity: lookupAllLoading ? 0.7 : 1,
                        transition:'all 0.2s',
                      }}>
                      {lookupAllLoading ? (
                        <><FaSpinner size={11} style={{ animation:'spin 1s linear infinite' }}/> Lookup All... {lookupAllProgress ? `${lookupAllProgress.done}/${lookupAllProgress.total}` : ''}</>
                      ) : (
                        <><FaGlobe size={11}/> Lookup All {unknownCount > 0 ? `(${unknownCount})` : '✓'}</>
                      )}
                    </button>
                  );
                })()}
              </div>
              {funcs.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', color:'#333', border:'1px dashed #1a1a1a' }}>Tidak ada function selector yang terdeteksi.</div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:'10px' }}>
                  {funcs.map((f, i) => {
                    const onlineSig = lookupResults[f.selector];
                    return (
                      <div key={i} style={{ background:'#0d0d0d', border:`1px solid ${f.known || onlineSig ? '#f3ba2f44' : '#1e1e1e'}`, borderLeft:`3px solid ${f.known ? '#f3ba2f' : onlineSig ? '#01a2ff' : '#333'}`, padding:'12px 16px', display:'flex', flexDirection:'column', gap:'6px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'4px' }}>
                          <code style={{ fontFamily:'monospace', fontSize:'13px', color:'#836efd', fontWeight:'bold' }}>0x{f.selector}</code>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                            <span style={{ fontSize:'10px', color:'#333' }}>offset: 0x{f.offset.toString(16)}</span>
                            {!f.known && !onlineSig && (
                              <button
                                onClick={() => lookup4Byte(f.selector)}
                                disabled={lookupLoading === f.selector}
                                style={{ fontSize:'10px', background:'none', border:'1px solid #1e1e1e', color: lookupLoading === f.selector ? '#333' : '#01a2ff', padding:'2px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'3px' }}>
                                {lookupLoading === f.selector ? <><FaSpinner size={9} style={{ animation:'spin 1s linear infinite' }}/> Lookup...</> : '↗ Lookup'}
                              </button>
                            )}
                          </div>
                        </div>
                        {f.known ? (
                          <div style={{ fontSize:'12px', color:'#f3ba2f', fontFamily:'monospace' }}>{f.known}</div>
                        ) : onlineSig ? (
                          <div style={{ fontSize:'12px', color:'#01a2ff', fontFamily:'monospace' }}>
                            <FaGlobe size={9} style={{ marginRight:'4px' }}/>{onlineSig}
                          </div>
                        ) : (
                          <div style={{ fontSize:'11px', color:'#333', fontStyle:'italic' }}>
                            Unknown — klik Lookup atau cek manual di{' '}
                            <a href={`https://www.4byte.directory/signatures/?bytes4_signature=0x${f.selector}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>4byte.directory</a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop:'16px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'12px 20px', flex:1, minWidth:'120px', textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'#555', marginBottom:'4px', textTransform:'uppercase' }}>DB Lokal</div>
                  <div style={{ fontSize:'22px', fontWeight:'bold', color:'#f3ba2f', fontFamily:'monospace' }}>{funcs.filter(f=>f.known).length}</div>
                </div>
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'12px 20px', flex:1, minWidth:'120px', textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'#555', marginBottom:'4px', textTransform:'uppercase' }}>Online Lookup</div>
                  <div style={{ fontSize:'22px', fontWeight:'bold', color:'#01a2ff', fontFamily:'monospace' }}>{Object.values(lookupResults).filter(v=>v!=='(not found)'&&v!=='(lookup failed)'&&v!=='(lookup failed — CORS/network)').length}</div>
                </div>
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'12px 20px', flex:1, minWidth:'120px', textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'#555', marginBottom:'4px', textTransform:'uppercase' }}>Unknown</div>
                  <div style={{ fontSize:'22px', fontWeight:'bold', color:'#333', fontFamily:'monospace' }}>{funcs.filter(f=>!f.known && !lookupResults[f.selector]).length}</div>
                </div>
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'12px 20px', flex:1, minWidth:'120px', textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'#555', marginBottom:'4px', textTransform:'uppercase' }}>Total Selector</div>
                  <div style={{ fontSize:'22px', fontWeight:'bold', color:'#836efd', fontFamily:'monospace' }}>{funcs.length}</div>
                </div>
              </div>
            </div>
          )}

          {/* ABI tab */}
          {tab === 'abi' && (
            <div>
              {/* Banner: masih ada unknown selector yang belum di-lookup */}
              {funcs.filter(f => !f.known && !lookupResults[f.selector]).length > 0 && (
                <div style={{ background:'#01a2ff11', border:'1px solid #01a2ff44', borderLeft:'3px solid #01a2ff', padding:'10px 14px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'12px', color:'#01a2ff', fontWeight:'bold', marginBottom:'2px' }}>
                      {funcs.filter(f => !f.known && !lookupResults[f.selector]).length} selector belum diidentifikasi
                    </div>
                    <div style={{ fontSize:'11px', color:'#555' }}>
                      Pergi ke tab <strong style={{ color:'#f3ba2f' }}>Fungsi</strong> → klik <strong style={{ color:'#01a2ff' }}>Lookup All</strong> untuk mencari signature dari 4byte.directory, lalu ABI di sini akan otomatis diperbarui.
                    </div>
                  </div>
                  <button
                    onClick={() => { setTab('funcs'); setTimeout(lookupAll4Byte, 100); }}
                    disabled={lookupAllLoading}
                    style={{ background:'#01a2ff22', border:'1px solid #01a2ff', color:'#01a2ff', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'6px', flexShrink:0, whiteSpace:'nowrap' }}>
                    {lookupAllLoading
                      ? <><FaSpinner size={11} style={{ animation:'spin 1s linear infinite' }}/> Lookup... {lookupAllProgress ? `${lookupAllProgress.done}/${lookupAllProgress.total}` : ''}</>
                      : <><FaGlobe size={11}/> Lookup All Sekarang</>}
                  </button>
                </div>
              )}
              {/* Banner: semua sudah di-lookup */}
              {funcs.filter(f => !f.known && !lookupResults[f.selector]).length === 0 && Object.keys(lookupResults).length > 0 && (
                <div style={{ background:'#4caf5011', border:'1px solid #4caf5044', borderLeft:'3px solid #4caf50', padding:'8px 14px', marginBottom:'14px', fontSize:'12px', color:'#4caf50', display:'flex', alignItems:'center', gap:'8px' }}>
                  <FaCheckCircle size={11}/> Semua selector telah di-lookup — ABI di bawah sudah lengkap.
                </div>
              )}
              <p style={{ fontSize:'12px', color:'#555', marginBottom:'12px' }}>
                ABI lengkap yang direkonstruksi dari function selector yang dikenal. Selector yang belum dikenal tidak termasuk — gunakan tab Fungsi → Lookup untuk memperluas ABI.
              </p>
              {abiEntries.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', color:'#333', border:'1px dashed #1a1a1a' }}>
                  Tidak ada ABI yang bisa direkonstruksi — tidak ada function selector yang dikenal.
                  <div style={{ marginTop:'10px', fontSize:'11px', color:'#2a2a2a' }}>
                    Coba cek selector secara manual di{' '}
                    <a href="https://www.4byte.directory" target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>4byte.directory</a>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(abiEntries, null, 2));
                        setAbiCopied(true);
                        setTimeout(() => setAbiCopied(false), 2500);
                      }}
                      style={{ background:'#0d2a0d', border:`1px solid ${abiCopied ? '#4caf50' : '#00e676'}`, color: abiCopied ? '#4caf50' : '#00e676', padding:'8px 16px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px', fontWeight:'bold' }}>
                      {abiCopied ? <><FaCheck size={11}/> Copied!</> : <><FaRegCopy size={11}/> Copy ABI (JSON)</>}
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(abiEntries, null, 2)], { type:'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'abi.json'; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{ background:'none', border:'1px solid #333', color:'#555', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                      ↓ Download abi.json
                    </button>
                    <span style={{ fontSize:'11px', color:'#333' }}>
                      {abiEntries.length} fungsi · {funcs.filter(f => !f.known && !lookupResults[f.selector]?.match(/^[a-zA-Z_]/)  ).length} selector tidak dikenal (tidak termasuk)
                    </span>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:'10px', marginBottom:'16px' }}>
                    {abiEntries.map((entry, i) => {
                      const mutColor = entry.stateMutability === 'view' ? '#2196f3'
                        : entry.stateMutability === 'payable' ? '#ff6600'
                        : '#4caf50';
                      const selector = funcs.find(f => f.known?.startsWith(entry.name + '('))?.selector;
                      return (
                        <div key={i} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${mutColor}`, padding:'12px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', flexWrap:'wrap', gap:'4px' }}>
                            <span style={{ fontFamily:'monospace', fontSize:'13px', color:'#fff', fontWeight:'bold' }}>{entry.name}</span>
                            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                              <span style={{ fontSize:'10px', padding:'2px 7px', border:`1px solid ${mutColor}`, color:mutColor, fontWeight:'bold', letterSpacing:'0.5px' }}>
                                {entry.stateMutability.toUpperCase()}
                              </span>
                              {selector && (
                                <code style={{ fontSize:'10px', color:'#836efd', fontFamily:'monospace' }}>0x{selector}</code>
                              )}
                            </div>
                          </div>
                          {entry.inputs.length > 0 && (
                            <div style={{ marginBottom:'6px' }}>
                              <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Inputs</div>
                              {entry.inputs.map((inp, j) => (
                                <div key={j} style={{ display:'flex', gap:'8px', fontSize:'12px', padding:'3px 0', borderBottom:'1px solid #0f0f0f' }}>
                                  <span style={{ color:'#f3ba2f', fontFamily:'monospace', minWidth:'80px' }}>{inp.type}</span>
                                  <span style={{ color:'#aaa' }}>{inp.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {entry.outputs.length > 0 && (
                            <div>
                              <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Returns</div>
                              {entry.outputs.map((out, j) => (
                                <div key={j} style={{ display:'flex', gap:'8px', fontSize:'12px', padding:'3px 0' }}>
                                  <span style={{ color:'#00e676', fontFamily:'monospace', minWidth:'80px' }}>{out.type}</span>
                                  <span style={{ color:'#555' }}>{out.name || '—'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {entry.inputs.length === 0 && entry.outputs.length === 0 && (
                            <div style={{ fontSize:'11px', color:'#333', fontStyle:'italic' }}>no params / no return value</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ background:'#070707', border:'1px solid #1a1a1a' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:'1px solid #1a1a1a', background:'#0d0d0d' }}>
                      <span style={{ fontSize:'11px', color:'#444', fontFamily:'monospace' }}>ABI JSON</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(JSON.stringify(abiEntries, null, 2)); setAbiCopied(true); setTimeout(() => setAbiCopied(false), 2500); }}
                        style={{ background:'none', border:'none', cursor:'pointer', color: abiCopied ? '#4caf50' : '#444', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px', padding:'2px 6px' }}>
                        {abiCopied ? <><FaCheck size={10}/> Copied!</> : <><FaRegCopy size={10}/> Copy</>}
                      </button>
                    </div>
                    <pre style={{ margin:0, padding:'14px', overflowX:'auto', fontFamily:'monospace', fontSize:'11px', lineHeight:'1.6', color:'#aaa', whiteSpace:'pre', maxHeight:'50vh', overflowY:'auto' }}>
                      {JSON.stringify(abiEntries, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Strings tab */}
          {tab === 'strings' && (
            <div>
              <p style={{ fontSize:'12px', color:'#555', marginBottom:'12px' }}>
                String ASCII yang ditemukan dalam bytecode (panjang ≥ 4). Biasanya berisi error messages, token names, atau metadata kontrak.
              </p>
              {strings.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', color:'#333', border:'1px dashed #1a1a1a' }}>Tidak ada string yang terdeteksi.</div>
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

          {/* Patterns tab */}
          {tab === 'patterns' && (
            <div>
              <p style={{ fontSize:'12px', color:'#555', marginBottom:'14px' }}>
                Deteksi otomatis pola kontrak berdasarkan kombinasi function selector. Hover badge untuk keterangan.
              </p>
              {hasSelfDestruct && (
                <div style={{ background:'#1a0000', border:'1px solid #f44336', padding:'12px 16px', marginBottom:'12px', display:'flex', gap:'8px', alignItems:'center' }}>
                  <FaExclamationTriangle style={{ color:'#f44336' }}/>
                  <div>
                    <div style={{ fontSize:'13px', color:'#f44336', fontWeight:'bold' }}>SELFDESTRUCT terdeteksi!</div>
                    <div style={{ fontSize:'11px', color:'#ff6666', marginTop:'2px' }}>Kontrak ini mengandung instruksi SELFDESTRUCT yang memungkinkan developer menghancurkan kontrak dan menarik semua ETH di dalamnya. Hati-hati dengan rugpull.</div>
                  </div>
                </div>
              )}
              {patterns.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', color:'#333', border:'1px dashed #1a1a1a' }}>
                  Tidak ada pola kontrak standar yang terdeteksi dari selector yang ada.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {patterns.map((p, i) => (
                    <div key={i} style={{ background:'#0d0d0d', border:`1px solid ${p.color}33`, borderLeft:`4px solid ${p.color}`, padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:'12px' }}>
                      <FaShieldAlt style={{ color:p.color, marginTop:'2px', flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:'bold', color:p.color, marginBottom:'4px' }}>{p.label}</div>
                        <div style={{ fontSize:'12px', color:'#888' }}>{p.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selector coverage summary */}
              <div style={{ marginTop:'20px', background:'#070707', border:'1px solid #1a1a1a', padding:'14px' }}>
                <div style={{ fontSize:'11px', color:'#444', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>Coverage Selector</div>
                <div style={{ display:'flex', gap:'4px', height:'8px', borderRadius:'2px', overflow:'hidden', marginBottom:'8px' }}>
                  <div style={{ flex: funcs.filter(f=>f.known).length, background:'#4caf50' }}/>
                  <div style={{ flex: funcs.filter(f=>!f.known && lookupResults[f.selector] && !lookupResults[f.selector].includes('not found') && !lookupResults[f.selector].includes('failed')).length, background:'#01a2ff' }}/>
                  <div style={{ flex: Math.max(funcs.filter(f=>!f.known && !lookupResults[f.selector]).length, 1), background:'#1a1a1a' }}/>
                </div>
                <div style={{ display:'flex', gap:'16px', fontSize:'11px' }}>
                  <span style={{ color:'#4caf50' }}>● DB Lokal: {funcs.filter(f=>f.known).length}</span>
                  <span style={{ color:'#01a2ff' }}>● Online: {Object.values(lookupResults).filter(v=>!v.includes('not found')&&!v.includes('failed')).length}</span>
                  <span style={{ color:'#555' }}>● Unknown: {funcs.filter(f=>!f.known && !lookupResults[f.selector]).length}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
