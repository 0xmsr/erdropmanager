import { ethers } from 'ethers';
import bs58 from 'bs58';
import { ERC20_ABI, ERC20_BYTECODE } from '../Smartcontracttools';
import type { DetectedToken } from '../Walletgenerator';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

export function tronAddressHexToBase58(hexNo0x: string): string {
  const clean = hexNo0x.replace(/^0x/i, '').toLowerCase();
  const h1 = ethers.utils.sha256('0x' + clean).slice(2);
  const h2 = ethers.utils.sha256('0x' + h1).slice(2);
  const checksum = h2.slice(0, 8);
  return bs58.encode(Buffer.from(clean + checksum, 'hex'));
}

export function tronAddressBase58ToHex(address: string): string {
  const bytes = bs58.decode(address.trim());
  const full  = Buffer.from(bytes).toString('hex');
  return full.slice(0, full.length - 8);
}

export function isValidTronAddress(address: string): boolean {
  try {
    const hex = tronAddressBase58ToHex(address);
    return hex.length === 42 && hex.startsWith('41');
  } catch { return false; }
}


export function tronToEvmAddr(address: string): string {
  return '0x' + tronAddressBase58ToHex(address).replace(/^41/, '');
}

export function tronAddressFromPrivateKey(privateKeyHex: string): string {
  const pk = privateKeyHex.startsWith('0x') ? privateKeyHex : '0x' + privateKeyHex;
  const pubUncompressed = ethers.utils.computePublicKey(pk, false);
  const hash = ethers.utils.keccak256('0x' + pubUncompressed.slice(4)).slice(2);
  return tronAddressHexToBase58('41' + hash.slice(-40));
}

export function deriveTronAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
  const child  = hdNode.derivePath(`m/44'/195'/0'/0/${index}`);
  return { address: tronAddressFromPrivateKey(child.privateKey), privateKey: child.privateKey };
}

export interface TronNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  apiBase: string;
  isMainnet: boolean;
  faucetUrl?: string;
}

export const TRON_NETWORKS: TronNetworkCfg[] = [
  { id: 'mainnet', name: 'Tron Mainnet',        symbol: 'TRX', color: '#EF0027', explorerUrl: 'https://tronscan.org/#',        apiBase: 'https://api.trongrid.io',        isMainnet: true  },
  { id: 'nile',    name: 'Tron Nile Testnet',   symbol: 'TRX', color: '#FF7A59', explorerUrl: 'https://nile.tronscan.org/#',   apiBase: 'https://nile.trongrid.io',       isMainnet: false, faucetUrl: 'https://nileex.io/join/getJoinPage' },
  { id: 'shasta',  name: 'Tron Shasta Testnet', symbol: 'TRX', color: '#FFA94D', explorerUrl: 'https://shasta.tronscan.org/#', apiBase: 'https://api.shasta.trongrid.io', isMainnet: false, faucetUrl: 'https://shasta.tronex.io/join/getJoinPage' },
];

export const SUN_PER_TRX = 1_000_000;
export const sunToTrx  = (sun: number, dec = 6) => (sun / SUN_PER_TRX).toFixed(dec);
export const trxToSun  = (trx: string) => Math.round((parseFloat(trx || '0') || 0) * SUN_PER_TRX);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));


let tronApiQueue: Promise<unknown> = Promise.resolve();
const TRON_MIN_GAP_MS = 400;

function scheduleOnTronApiQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = tronApiQueue.then(fn, fn);
  tronApiQueue = run.then(() => sleep(TRON_MIN_GAP_MS), () => sleep(TRON_MIN_GAP_MS));
  return run;
}

export async function tronApi(net: TronNetworkCfg, path: string, body?: Record<string, unknown>, _attempt = 0): Promise<any> {
  return scheduleOnTronApiQueue(async () => {
    const res = await Promise.race([
      fetch(`${net.apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('Request timeout')), 15000)),
    ]);

    if (res.status === 429) {

      let bodyText = '';
      try { bodyText = await res.text(); } catch {  }
      const MAX_RETRIES = 5;
      if (_attempt < MAX_RETRIES) {
        const suspendMatch = bodyText.match(/suspended for\s+([\d.]+)\s*s/i);
        const waitMs = suspendMatch
          ? Math.ceil(parseFloat(suspendMatch[1]) * 1000) + 100
          : Math.min(8000, 500 * 2 ** _attempt) + Math.floor(Math.random() * 250);
        await sleep(waitMs);
        return tronApi(net, path, body, _attempt + 1);
      }
      throw new Error(
        `TronGrid ${path} gagal: rate limit (HTTP 429) masih tercapai setelah ${MAX_RETRIES}x percobaan ulang. ` +
        `TronGrid publik cuma ngizinin 3 request/detik per IP — pakai TRON-PRO-API-KEY (daftar gratis di ` +
        `tronscan.io) buat kuota lebih tinggi & lebih stabil, atau coba lagi sebentar lagi.` +
        (bodyText ? ` Detail: ${bodyText.slice(0, 200)}` : '')
      );
    }

    if (!res.ok) {

      let detail = '';
      try {
        const bodyText = await res.text();
        if (bodyText) detail = ` — ${bodyText.slice(0, 300)}`;
      } catch {  }
      throw new Error(`TronGrid ${path} gagal (HTTP ${res.status})${detail}`);
    }
    return res.json();
  });
}

export function tronDecodeErrMsg(res: any, fallback: string): string {
  if (res?.Error) return String(res.Error);

  const raw = res?.result?.message || res?.message || res?.Message;
  if (raw) {
    try {
      const decoded = /^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0
        ? Buffer.from(raw, 'hex').toString('utf8')
        : String(raw);
      if (decoded.trim()) return decoded;
    } catch { return String(raw); }
  }
  const code = res?.result?.code || res?.code;
  if (code && code !== 'SUCCESS') {
    const extra = raw ? '' : '';
    return `${fallback} (code: ${code})${extra}`;
  }

  try {
    let dump = JSON.stringify(res);
    if (dump && dump !== '{}' && dump !== 'null') {
      if (dump.length > 400) dump = dump.slice(0, 400) + '…';
      return `${fallback} Respons TronGrid: ${dump}`;
    }
  } catch {  }
  return fallback;
}


export function tronFriendlyError(raw: string): string {
  if (!raw) return 'Transaksi gagal (tidak ada detail error).';

  const stripped = raw.replace(/^class\s+org\.tron\.core\.exception\.\w+\s*:\s*/i, '').trim() || raw;

  const rules: [RegExp, string][] = [
    [/balance is not sufficient/i,
      'Saldo tidak cukup untuk menutupi jumlah transfer ditambah fee (bandwidth/energy). Kurangi jumlah kirim atau isi saldo dulu.'],
    [/bandwidth is not enough/i,
      'Bandwidth tidak cukup dan saldo TRX juga tidak cukup buat nge-cover biayanya.'],
    [/energy is not enough|cpu resource/i,
      'Energy tidak cukup dan saldo TRX juga tidak cukup buat nge-cover biayanya. Coba freeze/stake TRX buat Energy tambahan.'],
    [/account.*(not exist|does not exist)/i,
      'Address ini belum pernah aktif di jaringan Tron. Kirim TRX dulu ke address ini (mis. dari exchange/faucet) sebelum dipakai kirim keluar.'],
    [/signature check failed/i,
      'Private key tidak cocok dengan address pengirim (signature tidak valid).'],
    [/contract has not been deployed|no contract|contract not exist/i,
      'Contract tidak ditemukan di address / jaringan ini — cek lagi alamat contract & network-nya.'],
    [/dup transaction|duplicate transaction/i,
      'Transaksi terdeteksi duplikat — kemungkinan sudah terkirim sebelumnya.'],
    [/too big transaction|transaction expired/i,
      'Transaksi kedaluwarsa sebelum sempat di-broadcast — coba kirim ulang.'],
  ];
  for (const [re, msg] of rules) {
    if (re.test(stripped)) return msg;
  }
  return stripped;
}


export async function getTronBalanceSun(net: TronNetworkCfg, address: string): Promise<number> {
  const res = await fetch(`${net.apiBase}/v1/accounts/${address}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Gagal cek saldo (HTTP ${res.status})`);
  const data = await res.json();
  return data?.data?.[0]?.balance ?? 0;
}


export function tronSignTxId(txIdHex: string, privateKeyHex: string): string {
  const pk = privateKeyHex.startsWith('0x') ? privateKeyHex : '0x' + privateKeyHex;
  const signingKey = new ethers.utils.SigningKey(pk);
  const sig = signingKey.signDigest('0x' + txIdHex.replace(/^0x/, ''));
  const v = (sig.recoveryParam ?? 0).toString(16).padStart(2, '0');
  return sig.r.slice(2) + sig.s.slice(2) + v;
}

export async function tronBroadcastTx(net: TronNetworkCfg, tx: any, signatureHex: string): Promise<{ result: boolean; message?: string }> {
  const signed = { ...tx, signature: [signatureHex] };
  const res = await tronApi(net, '/wallet/broadcasttransaction', signed);
  if (res?.result === true) return { result: true };
  return { result: false, message: tronDecodeErrMsg(res, 'Broadcast transaksi gagal.') };
}

export async function tronSendTrx(net: TronNetworkCfg, fromAddress: string, toAddress: string, amountSun: number, privateKeyHex: string): Promise<string> {
  const tx = await tronApi(net, '/wallet/createtransaction', {
    owner_address: tronAddressBase58ToHex(fromAddress),
    to_address:    tronAddressBase58ToHex(toAddress),
    amount:        amountSun,
    visible: false,
  });
  if (!tx?.txID) throw new Error(tronDecodeErrMsg(tx, 'Gagal membuat transaksi (cek saldo / address tujuan).'));
  const sig = tronSignTxId(tx.txID, privateKeyHex);
  const result = await tronBroadcastTx(net, tx, sig);
  if (!result.result) throw new Error(result.message);
  return tx.txID as string;
}


export function tronEncodeCall(iface: ethers.utils.Interface, fn: string, args: any[]): { selector: string; parameter: string } {
  const full = iface.encodeFunctionData(fn, args);
  const selector = iface.getFunction(fn).format('sighash' as any);
  return { selector, parameter: full.slice(10) };
}

export async function tronReadContract(net: TronNetworkCfg, callerAddress: string, contractAddress: string, iface: ethers.utils.Interface, fn: string, args: any[]) {
  const { selector, parameter } = tronEncodeCall(iface, fn, args);
  const res = await tronApi(net, '/wallet/triggerconstantcontract', {
    owner_address: tronAddressBase58ToHex(callerAddress),
    contract_address: tronAddressBase58ToHex(contractAddress),
    function_selector: selector,
    parameter,
    visible: false,
  });
  const resultHex = res?.constant_result?.[0];
  if (!resultHex) throw new Error(tronDecodeErrMsg(res, 'Gagal membaca contract.'));
  return iface.decodeFunctionResult(fn, '0x' + resultHex);
}

export async function tronCallContract(net: TronNetworkCfg, ownerAddress: string, contractAddress: string, iface: ethers.utils.Interface, fn: string, args: any[], privateKeyHex: string, feeLimit = 100_000_000): Promise<string> {
  const { selector, parameter } = tronEncodeCall(iface, fn, args);
  const built = await tronApi(net, '/wallet/triggersmartcontract', {
    owner_address: tronAddressBase58ToHex(ownerAddress),
    contract_address: tronAddressBase58ToHex(contractAddress),
    function_selector: selector,
    parameter,
    fee_limit: feeLimit,
    call_value: 0,
    visible: false,
  });
  const tx = built?.transaction;
  if (!tx?.txID) throw new Error(tronDecodeErrMsg(built?.result ? built : built?.transaction, 'Gagal membangun transaksi contract.'));
  const sig = tronSignTxId(tx.txID, privateKeyHex);
  const result = await tronBroadcastTx(net, tx, sig);
  if (!result.result) throw new Error(result.message);
  return tx.txID as string;
}


export interface TronTxInfo {
  found: boolean;
  success: boolean;
  result?: string;
  energyUsed?: number;
  contractAddressHex?: string;
  revertReason?: string;
}

export async function tronGetTxInfo(net: TronNetworkCfg, txId: string): Promise<TronTxInfo> {
  const res = await tronApi(net, '/wallet/gettransactioninfobyid', { value: txId }).catch(() => null);
  if (!res || !res.id) return { found: false, success: false };
  const result = res?.receipt?.result || res?.result || 'SUCCESS';
  const success = result === 'SUCCESS';
  let revertReason: string | undefined;
  if (!success && res?.resMessage) {
    try { revertReason = Buffer.from(res.resMessage, 'hex').toString('utf8'); } catch {  }
  }
  return {
    found: true, success, result,
    energyUsed: res?.receipt?.energy_usage_total ?? res?.receipt?.energy_usage,
    contractAddressHex: res?.contract_address,
    revertReason,
  };
}


export async function tronWaitTxConfirmed(net: TronNetworkCfg, txId: string, attempts = 24, delayMs = 3500): Promise<TronTxInfo> {
  for (let i = 0; i < attempts; i++) {
    const info = await tronGetTxInfo(net, txId);
    if (info.found) return info;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return { found: false, success: false };
}


export async function estimateTronDeployFee(
  net: TronNetworkCfg, ownerAddress: string, bytecodeHex: string, parameterHex: string,
): Promise<TronFeeEstimate> {
  const [constantRes, resources, prices] = await Promise.all([
    tronApi(net, '/wallet/triggerconstantcontract', {
      owner_address: tronAddressBase58ToHex(ownerAddress),
      data: bytecodeHex.replace(/^0x/i, '') + parameterHex.replace(/^0x/i, ''),
      visible: false,
    }).catch(() => null),
    getTronAccountResources(net, ownerAddress).catch(() => null),
    getTronChainFeePrices(net),
  ]);

  const energyNeeded = constantRes?.energy_used ?? 1_500_000;
  const energyAvail  = resources ? Math.max(0, resources.energyLimit - resources.energyUsed) : 0;
  const energyShortfall = Math.max(0, energyNeeded - energyAvail);

  const bandwidthNeeded = 700;
  const bwAvail = resources ? Math.max(0, (resources.freeNetLimit - resources.freeNetUsed) + (resources.netLimit - resources.netUsed)) : 0;
  const bandwidthShortfall = Math.max(0, bandwidthNeeded - bwAvail);

  const feeSun = energyShortfall * prices.energyPriceSun + bandwidthShortfall * prices.bandwidthPriceSun;

  if (feeSun > 0) {
    const trxBalSun = await getTronBalanceSun(net, ownerAddress).catch(() => null);
    if (trxBalSun !== null && feeSun > trxBalSun) {
      throw new Error(`Saldo TRX tidak cukup buat deploy: constructor butuh ~${energyNeeded.toLocaleString('en-US')} Energy, kekurangannya (di luar kuota gratis/staked) bakal di-burn jadi ~${sunToTrx(feeSun)} TRX, saldo TRX kamu cuma ${sunToTrx(trxBalSun)} TRX. Isi saldo TRX dulu, atau freeze/stake TRX buat Energy tambahan.`);
    }
  }

  return {
    bandwidthNeeded, bandwidthAvailable: bwAvail,
    energyNeeded, energyAvailable: energyAvail,
    feeSun, coveredByFree: energyShortfall === 0 && bandwidthShortfall === 0,
    destinationIsNew: false, newAccountFeeSun: 0,
  };
}


export async function tronDeployTrc20(
  net: TronNetworkCfg, ownerAddress: string, privateKeyHex: string,
  params: { name: string; symbol: string; decimals: number; supply: string },
  feeLimit = 1_000_000_000,
): Promise<{ txId: string; contractAddress: string; pending?: boolean }> {

  const supplyIntStr = (params.supply || '0').split('.')[0].replace(/[^0-9]/g, '') || '0';
  const supplyRaw = ethers.BigNumber.from(supplyIntStr);
  const parameter = ethers.utils.defaultAbiCoder.encode(
    ['string', 'string', 'uint8', 'uint256'],
    [params.name, params.symbol, params.decimals, supplyRaw],
  ).slice(2);
  const bytecodeHex = ERC20_BYTECODE.replace(/^0x/, '');


  await estimateTronDeployFee(net, ownerAddress, bytecodeHex, parameter);

  const built = await tronApi(net, '/wallet/deploycontract', {
    owner_address: tronAddressBase58ToHex(ownerAddress),
    abi: JSON.stringify(ERC20_ABI),
    bytecode: bytecodeHex,
    parameter,
    name: params.name,
    fee_limit: feeLimit,
    call_value: 0,
    consume_user_resource_percent: 100,
    origin_energy_limit: 10_000_000,
    visible: false,
  });

  const tx = built?.txID ? built : built?.transaction;
  if (!tx?.txID) throw new Error(tronDecodeErrMsg(built, 'Gagal membangun transaksi deploy contract.'));
  const sig = tronSignTxId(tx.txID, privateKeyHex);
  const bcResult = await tronBroadcastTx(net, tx, sig);
  if (!bcResult.result) throw new Error(bcResult.message);


  const info = await tronWaitTxConfirmed(net, tx.txID as string);
  if (!info.found) {

    return { txId: tx.txID as string, contractAddress: '', pending: true };
  }
  if (!info.success) {
    const reason = info.revertReason ? ` — ${info.revertReason}` : '';
    throw new Error(`Deploy contract GAGAL dieksekusi on-chain: ${info.result}${reason}. TX tetap ter-broadcast (fee tetap kepotong) tapi contract TIDAK ter-deploy. Kalau ${info.result === 'OUT_OF_ENERGY' ? 'Energy habis, isi saldo TRX lebih banyak lalu coba lagi' : 'ada opcode tidak didukung, coba compile ulang dengan EVM version lebih lama lewat "Custom Solidity"'}.`);
  }

  const contractHex: string | undefined = info.contractAddressHex || tx?.contract_address;
  return { txId: tx.txID as string, contractAddress: contractHex ? tronAddressHexToBase58(contractHex) : '' };
}




export async function fetchTronTokenPortfolio(address: string, net: TronNetworkCfg = TRON_NETWORKS[0]): Promise<DetectedToken[]> {
  if (!net.isMainnet) {
    throw new Error('Deteksi token TRC-20 otomatis cuma didukung di Tron Mainnet (Tronscan tidak meng-index testnet).');
  }
  const res = await Promise.race([
    fetch(`https://apilist.tronscan.org/api/account?address=${address}`),
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
  ]);
  if (!res.ok) throw new Error(`Gagal ambil data token dari Tronscan (HTTP ${res.status}).`);
  const json = await res.json();


  const list: any[] = json?.trc20token_balances || json?.withPriceTokens || [];
  if (!Array.isArray(list) || list.length === 0) return [];

  return list
    .map((t) => {
      const decimals = Number(t?.tokenDecimal ?? t?.decimals ?? 6) || 0;
      const rawBal   = t?.balance ?? t?.quantity ?? '0';
      let balance: number;
      if (typeof t?.amount === 'number' || (typeof t?.amount === 'string' && t.amount !== '')) {
        balance = Number(t.amount);
      } else {
        try { balance = Number(BigInt(rawBal)) / Math.pow(10, decimals); } catch { balance = Number(rawBal) / Math.pow(10, decimals); }
      }
      const priceRaw = t?.tokenPriceInUsd ?? t?.priceInUsd ?? t?.price;
      const price    = priceRaw !== null && priceRaw !== undefined && priceRaw !== '' ? Number(priceRaw) : null;
      return {
        chain: 'tron',
        address: t?.tokenId || t?.contract_address || t?.tokenAddress || '',
        symbol: t?.tokenAbbr || t?.symbol || '???',
        name: t?.tokenName || t?.name || 'Unknown TRC-20 Token',
        decimals,
        balance,
        balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
        usdPrice: price !== null && !isNaN(price) ? price : null,
        usdValue: price !== null && !isNaN(price) ? balance * price : null,
        logo: t?.tokenLogo || t?.logo || undefined,
      } as DetectedToken;
    })
    .filter(t => t.balance > 0);
}


export async function tronAccountExists(net: TronNetworkCfg, address: string): Promise<boolean> {
  try {
    const res = await tronApi(net, '/wallet/getaccount', {
      address: tronAddressBase58ToHex(address),
      visible: false,
    });
    return !!(res && res.address);
  } catch {

    return true;
  }
}

export interface TronAccountResources {
  freeNetLimit: number; freeNetUsed: number;
  netLimit: number;     netUsed: number;
  energyLimit: number;  energyUsed: number;
}

export async function getTronAccountResources(net: TronNetworkCfg, address: string): Promise<TronAccountResources> {
  const res = await tronApi(net, '/wallet/getaccountresource', {
    address: tronAddressBase58ToHex(address),
    visible: false,
  });
  return {
    freeNetLimit: res?.freeNetLimit ?? 0,
    freeNetUsed:  res?.freeNetUsed  ?? 0,
    netLimit:     res?.NetLimit     ?? 0,
    netUsed:      res?.NetUsed      ?? 0,
    energyLimit:  res?.EnergyLimit  ?? 0,
    energyUsed:   res?.EnergyUsed   ?? 0,
  };
}


let tronFeePriceCache: { bandwidthPriceSun: number; energyPriceSun: number; createAccountFeeSun: number; createNewAccountFeeSun: number; ts: number } | null = null;

export async function getTronChainFeePrices(net: TronNetworkCfg): Promise<{ bandwidthPriceSun: number; energyPriceSun: number; createAccountFeeSun: number; createNewAccountFeeSun: number }> {
  if (tronFeePriceCache && Date.now() - tronFeePriceCache.ts < 5 * 60 * 1000) return tronFeePriceCache;
  try {
    const res = await tronApi(net, '/wallet/getchainparameters');
    const params: { key: string; value?: number }[] = res?.chainParameter ?? [];
    const find = (key: string, fallback: number) => params.find(p => p.key === key)?.value ?? fallback;
    const result = {
      bandwidthPriceSun: find('getTransactionFee', 1000),
      energyPriceSun:    find('getEnergyFee', 210),

      createAccountFeeSun:    find('getCreateAccountFee', 100_000),
      createNewAccountFeeSun: find('getCreateNewAccountFeeInSystemContract', 1_000_000),
      ts: Date.now(),
    };
    tronFeePriceCache = result;
    return result;
  } catch {
    return { bandwidthPriceSun: 1000, energyPriceSun: 210, createAccountFeeSun: 100_000, createNewAccountFeeSun: 1_000_000 };
  }
}


function estimateTxBandwidthBytes(rawDataHex: string): number {
  return Math.ceil(rawDataHex.length / 2) + 67;
}

export interface TronFeeEstimate {
  bandwidthNeeded: number;
  bandwidthAvailable: number;
  energyNeeded: number;
  energyAvailable: number;
  feeSun: number;
  coveredByFree: boolean;
  destinationIsNew: boolean;
  newAccountFeeSun: number;
}


export async function estimateTronNativeFee(net: TronNetworkCfg, fromAddress: string, toAddress: string, amountSun: number): Promise<TronFeeEstimate> {
  const [balanceSun, resources, prices, destExists] = await Promise.all([
    getTronBalanceSun(net, fromAddress).catch(() => null),
    getTronAccountResources(net, fromAddress).catch(() => null),
    getTronChainFeePrices(net),
    tronAccountExists(net, toAddress),
  ]);

  if (balanceSun !== null && amountSun > balanceSun) {
    throw new Error(`Saldo tidak cukup: mau kirim ${sunToTrx(amountSun)} TRX, saldo cuma ${sunToTrx(balanceSun)} TRX.`);
  }

  const tx = await tronApi(net, '/wallet/createtransaction', {
    owner_address: tronAddressBase58ToHex(fromAddress),
    to_address: tronAddressBase58ToHex(toAddress),
    amount: 1,
    visible: false,
  }).catch(() => null);

  const bandwidthNeeded = tx?.raw_data_hex ? estimateTxBandwidthBytes(tx.raw_data_hex) : 268;
  const bwAvail = resources ? Math.max(0, (resources.freeNetLimit - resources.freeNetUsed) + (resources.netLimit - resources.netUsed)) : 0;
  const shortfall = Math.max(0, bandwidthNeeded - bwAvail);
  const bandwidthFeeSun = shortfall * prices.bandwidthPriceSun;


  const newAccountFeeSun = destExists ? 0 : (prices.createAccountFeeSun + prices.createNewAccountFeeSun);
  const feeSun = bandwidthFeeSun + newAccountFeeSun;


  if (balanceSun !== null && (amountSun + feeSun) > balanceSun) {
    const extraNote = newAccountFeeSun > 0
      ? ` (termasuk fee aktivasi address baru ~${sunToTrx(newAccountFeeSun)} TRX, karena address tujuan belum pernah aktif di jaringan Tron)`
      : '';
    throw new Error(`Saldo tidak cukup untuk jumlah + fee${extraNote}: butuh ~${sunToTrx(amountSun + feeSun)} TRX, saldo cuma ${sunToTrx(balanceSun)} TRX.`);
  }

  return {
    bandwidthNeeded, bandwidthAvailable: bwAvail,
    energyNeeded: 0, energyAvailable: resources ? Math.max(0, resources.energyLimit - resources.energyUsed) : 0,
    feeSun, coveredByFree: shortfall === 0 && newAccountFeeSun === 0,
    destinationIsNew: !destExists, newAccountFeeSun,
  };
}


export async function estimateTronTrc20Fee(
  net: TronNetworkCfg, ownerAddress: string, contractAddress: string,
  iface: ethers.utils.Interface, toEvmAddr: string, amountBase: any,
): Promise<TronFeeEstimate> {
  const tokenBalRes = await tronReadContract(net, ownerAddress, contractAddress, iface, 'balanceOf', [tronToEvmAddr(ownerAddress)]).catch(() => null);
  const tokenBal = tokenBalRes ? tokenBalRes[0] : null;
  if (tokenBal !== null) {
    const insufficient = amountBase?.gt ? amountBase.gt(tokenBal) : Number(amountBase) > Number(tokenBal);
    if (insufficient) throw new Error('Saldo token tidak cukup untuk jumlah yang mau dikirim.');
  }

  const { selector, parameter } = tronEncodeCall(iface, 'transfer', [toEvmAddr, amountBase]);

  const toTronAddr = tronAddressHexToBase58('41' + toEvmAddr.replace(/^0x/i, ''));
  const [constantRes, resources, prices, destExists] = await Promise.all([
    tronApi(net, '/wallet/triggerconstantcontract', {
      owner_address: tronAddressBase58ToHex(ownerAddress),
      contract_address: tronAddressBase58ToHex(contractAddress),
      function_selector: selector,
      parameter,
      visible: false,
    }).catch(() => null),
    getTronAccountResources(net, ownerAddress).catch(() => null),
    getTronChainFeePrices(net),
    tronAccountExists(net, toTronAddr),
  ]);
  const energyNeeded = constantRes?.energy_used ?? 15000;
  const energyAvail  = resources ? Math.max(0, resources.energyLimit - resources.energyUsed) : 0;
  const energyShortfall = Math.max(0, energyNeeded - energyAvail);

  const bandwidthNeeded = 345;
  const bwAvail = resources ? Math.max(0, (resources.freeNetLimit - resources.freeNetUsed) + (resources.netLimit - resources.netUsed)) : 0;
  const bandwidthShortfall = Math.max(0, bandwidthNeeded - bwAvail);


  const newAccountFeeSun = destExists ? 0 : prices.createNewAccountFeeSun;
  const feeSun = energyShortfall * prices.energyPriceSun + bandwidthShortfall * prices.bandwidthPriceSun + newAccountFeeSun;


  if (feeSun > 0) {
    const trxBalSun = await getTronBalanceSun(net, ownerAddress).catch(() => null);
    if (trxBalSun !== null && feeSun > trxBalSun) {
      const extraNote = newAccountFeeSun > 0 ? ` (termasuk fee aktivasi address baru ~${sunToTrx(newAccountFeeSun)} TRX)` : '';
      throw new Error(`Saldo TRX tidak cukup buat fee${extraNote}: butuh ~${sunToTrx(feeSun)} TRX, saldo TRX cuma ${sunToTrx(trxBalSun)} TRX.`);
    }
  }

  return {
    bandwidthNeeded, bandwidthAvailable: bwAvail,
    energyNeeded, energyAvailable: energyAvail,
    feeSun, coveredByFree: energyShortfall === 0 && bandwidthShortfall === 0 && newAccountFeeSun === 0,
    destinationIsNew: !destExists, newAccountFeeSun,
  };
}