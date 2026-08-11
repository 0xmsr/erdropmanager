import { ethers } from 'ethers';
import {
  Slip10, Slip10Curve, Secp256k1, Sha256, Ripemd160, stringToPath,
} from '@cosmjs/crypto';
import { toBech32, fromBech32, toHex, fromHex } from '@cosmjs/encoding';
import {
  StargateClient, SigningStargateClient, GasPrice, type Coin,
} from '@cosmjs/stargate';
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import type { DetectedToken } from '../Walletgenerator';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

export const AXM_BECH32_PREFIX = 'axm';
export const AXM_DENOM         = 'uaxm';
export const AXM_DECIMALS      = 6;
export const AXM_COIN_TYPE = 546;

function compressedPubkeyToAxmAddress(compressedPubkey: Uint8Array): string {
  const rawAddress = new Ripemd160(new Sha256(compressedPubkey).digest()).digest();
  return toBech32(AXM_BECH32_PREFIX, rawAddress);
}


export async function deriveAxiomeAddress(
  mnemonic: string,
  index: number,
): Promise<{ address: string; privateKey: string }> {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2);
  const seed    = fromHex(seedHex);
  const path    = stringToPath(`m/44'/${AXM_COIN_TYPE}'/0'/0/${index}`); // bip44

  const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, path);
  const { pubkey }  = await Secp256k1.makeKeypair(privkey);
  const address     = compressedPubkeyToAxmAddress(Secp256k1.compressPubkey(pubkey));

  return { address, privateKey: toHex(privkey) };
}

export async function axiomeAddressFromPrivateKey(privateKeyHex: string): Promise<string> {
  const clean = privateKeyHex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error('Private key Axiome harus berupa 32 byte hex (64 karakter), dengan/tanpa prefix "0x".');
  }
  const privkey = fromHex(clean);
  const { pubkey } = await Secp256k1.makeKeypair(privkey);
  const compressedPubkey = Secp256k1.compressPubkey(pubkey);
  return compressedPubkeyToAxmAddress(compressedPubkey);
}

export function isValidAxiomeAddress(address: string): boolean {
  try {
    const { prefix, data } = fromBech32(address.trim());
    return prefix === AXM_BECH32_PREFIX && data.length === 20;
  } catch {
    return false;
  }
}

export function isValidAxiomeContractAddress(address: string): boolean {
  try {
    const { prefix } = fromBech32(address.trim());
    return prefix === AXM_BECH32_PREFIX;
  } catch {
    return false;
  }
}

export interface AxmNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  chainId: string;
  denom: string;
  decimals: number;
  rpcUrls: string[];

  restUrls: string[];

}

export const AXIOME_NETWORKS: AxmNetworkCfg[] = [
  {
    id: 'axiome-mainnet',
    name: 'Axiome Chain',
    symbol: 'AXM',
    color: '#75bbe9',
    explorerUrl: 'https://axiomechain.org',
    chainId: 'axiome-1',
    denom: AXM_DENOM,
    decimals: AXM_DECIMALS,

    rpcUrls: [
      'https://api-chain.axiomechain.org',
    ],

    restUrls: [
      'https://axm-lcd.trickle.pro',
    ],
  },

];

export async function getAxiomeConnection(net: AxmNetworkCfg): Promise<StargateClient> {
  if (net.rpcUrls.length === 0) {
    throw new Error(
      `${net.name} belum punya RPC endpoint yang dikonfigurasi. ` +
      'Isi AXIOME_NETWORKS[].rpcUrls dengan endpoint Tendermint RPC (biasanya port 26657).'
    );
  }
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const client = await Promise.race([
        StargateClient.connect(rpc),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      return client;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

const AXM_DEFAULT_GAS_PRICE = `1.7${AXM_DENOM}`;


async function getSigningAxiomeClient(net: AxmNetworkCfg, privateKeyHex: string): Promise<{ client: SigningStargateClient; address: string }> {
  if (net.rpcUrls.length === 0) {
    throw new Error(
      `${net.name} belum punya RPC endpoint yang dikonfigurasi. ` +
      'Isi AXIOME_NETWORKS[].rpcUrls dengan endpoint Tendermint RPC (biasanya port 26657).'
    );
  }
  const clean = privateKeyHex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error('Private key Axiome harus berupa 32 byte hex (64 karakter), dengan/tanpa prefix "0x".');
  }
  const wallet  = await DirectSecp256k1Wallet.fromKey(fromHex(clean), AXM_BECH32_PREFIX);
  const [account] = await wallet.getAccounts();

  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const client = await Promise.race([
        SigningStargateClient.connectWithSigner(rpc, wallet, { gasPrice: GasPrice.fromString(AXM_DEFAULT_GAS_PRICE) }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      return { client, address: account.address };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

export async function sendAxm(
  net: AxmNetworkCfg,
  privateKeyHex: string,
  toAddress: string,
  amount: number,
  memo: string = '',
): Promise<string> {
  if (!isValidAxiomeAddress(toAddress)) {
    throw new Error('Address tujuan tidak valid — harus bech32 dengan prefix "axm1...".');
  }
  if (!(amount > 0)) {
    throw new Error('Jumlah AXM yang dikirim harus lebih dari 0.');
  }
  const { client, address: fromAddress } = await getSigningAxiomeClient(net, privateKeyHex);
  try {

    const amountBase = Math.round(amount * Math.pow(10, net.decimals)).toString();
    const coin: Coin = { denom: net.denom, amount: amountBase };
    const result = await client.sendTokens(fromAddress, toAddress.trim(), [coin], 'auto', memo);
    if (result.code !== 0) {
      throw new Error(`Transaksi ditolak chain (code ${result.code}): ${result.rawLog || 'tidak ada detail'}`);
    }
    return result.transactionHash;
  } finally {
    client.disconnect();
  }
}

const AXM_GAS_ADJUSTMENT = 1.4;
const AXM_GAS_PRICE_UAXM = 1.7;

export interface AxmFeeEstimate {
  gasUnits: number;
  gasPriceUaxm: number;
  feeUaxm: number;
  feeAxm: number;
}

export async function estimateAxmFee(
  net: AxmNetworkCfg,
  privateKeyHex: string,
  toAddress: string,
  amount: number,
  memo: string = '',
): Promise<AxmFeeEstimate> {
  if (!isValidAxiomeAddress(toAddress)) {
    throw new Error('Address tujuan tidak valid — harus bech32 dengan prefix "axm1...".');
  }
  if (!(amount > 0)) {
    throw new Error('Jumlah AXM harus lebih dari 0.');
  }
  const { client, address: fromAddress } = await getSigningAxiomeClient(net, privateKeyHex);
  try {
    const amountBase = Math.round(amount * Math.pow(10, net.decimals)).toString();
    const msg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: MsgSend.fromPartial({
        fromAddress,
        toAddress: toAddress.trim(),
        amount: [{ denom: net.denom, amount: amountBase }],
      }),
    };
    const gasUsed  = await client.simulate(fromAddress, [msg], memo);
    const gasUnits = Math.ceil(gasUsed * AXM_GAS_ADJUSTMENT);
    const feeUaxm  = Math.ceil(gasUnits * AXM_GAS_PRICE_UAXM);
    return {
      gasUnits,
      gasPriceUaxm: AXM_GAS_PRICE_UAXM,
      feeUaxm,
      feeAxm: feeUaxm / Math.pow(10, net.decimals),
    };
  } finally {
    client.disconnect();
  }
}

export function axmFriendlyError(e: any): string {
  const raw = String(e?.message || e || '');
  if (/insufficient fee/i.test(raw)) {
    return 'Fee terlalu kecil ditolak mempool — validator Axiome mungkin mematok min-gas-price berbeda dari default (0.025uaxm) yang dipakai di sini.';
  }
  if (/insufficient funds/i.test(raw)) {
    return 'Saldo AXM tidak cukup untuk jumlah + fee transaksi.';
  }
  if (/account sequence mismatch/i.test(raw)) {
    return 'Sequence akun tidak sinkron (ada tx lain yang masih pending) — coba lagi sebentar.';
  }
  if (/timeout/i.test(raw)) {
    return 'Koneksi ke RPC Axiome timeout. Cek endpoint di AXIOME_NETWORKS[].rpcUrls atau coba lagi.';
  }
  if (/belum punya RPC endpoint|belum punya REST\/LCD endpoint/i.test(raw)) {
    return raw;
  }
  if (/unknown query path|ErrUnknownRequest/i.test(raw)) {
    return 'RPC node menolak query ini (path tidak dikenali). Kemungkinan endpoint publik yang dipakai membatasi jenis query yang boleh diakses. Coba lagi nanti atau minta endpoint RPC alternatif dari tim Axiome (t.me/axm_node_support).';
  }
  if (/not found: (?:contract|no such contract)|no such contract/i.test(raw)) {
    return 'Contract address CW20 tidak ditemukan di chain ini — cek lagi alamatnya dan pastikan network (mainnet) sudah benar.';
  }
  if (/overflow|insufficient balance|cannot subtract/i.test(raw)) {
    return 'Saldo CW20 tidak cukup untuk jumlah yang mau dikirim.';
  }
  if (/unknown variant|unknown query|invalid msg|missing field/i.test(raw)) {
    return 'Contract ini kemungkinan bukan CW20 standar (query/execute message tidak dikenali kontraknya).';
  }
  return raw || 'Gagal mengirim transaksi AXM.';
}

export async function getAxmBalanceWithFallback(net: AxmNetworkCfg, address: string): Promise<number> {

  const client = await getAxiomeConnection(net);
  try {
    const coin = await client.getBalance(address, net.denom);
    return Number(coin?.amount ?? '0') / Math.pow(10, net.decimals);
  } finally {
    client.disconnect();
  }
}

async function fetchAxmUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=axiome&vs_currencies=usd');
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.axiome?.usd;
    return typeof price === 'number' ? price : null;
  } catch { return null; }
}

export interface Cw20TokenInfo {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

async function getAxmCosmWasmClient(net: AxmNetworkCfg): Promise<CosmWasmClient> {
  if (net.rpcUrls.length === 0) {
    throw new Error(
      `${net.name} belum punya RPC endpoint yang dikonfigurasi. ` +
      'Isi AXIOME_NETWORKS[].rpcUrls dengan endpoint Tendermint RPC (biasanya port 26657).'
    );
  }
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      return await Promise.race([
        CosmWasmClient.connect(rpc),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

export async function getCw20TokenInfo(net: AxmNetworkCfg, contractAddress: string): Promise<Cw20TokenInfo> {
  if (!isValidAxiomeContractAddress(contractAddress)) {
    throw new Error('Contract address CW20 tidak valid — harus bech32 dengan prefix "axm1...".');
  }
  const client = await getAxmCosmWasmClient(net);
  try {
    const info = await client.queryContractSmart(contractAddress.trim(), { token_info: {} });
    return {
      contractAddress: contractAddress.trim(),
      name: info.name,
      symbol: info.symbol,
      decimals: info.decimals,
      totalSupply: info.total_supply,
    };
  } finally {
    client.disconnect();
  }
}

export async function getCw20Balance(
  net: AxmNetworkCfg,
  contractAddress: string,
  ownerAddress: string,
  decimals: number,
): Promise<number> {
  if (!isValidAxiomeContractAddress(contractAddress)) {
    throw new Error('Contract address CW20 tidak valid — harus bech32 dengan prefix "axm1...".');
  }
  const client = await getAxmCosmWasmClient(net);
  try {
    const res = await client.queryContractSmart(contractAddress.trim(), { balance: { address: ownerAddress.trim() } });
    return Number(res.balance || '0') / Math.pow(10, decimals);
  } finally {
    client.disconnect();
  }
}

export async function sendCw20(
  net: AxmNetworkCfg,
  privateKeyHex: string,
  contractAddress: string,
  toAddress: string,
  amount: number,
  decimals: number,
  memo: string = '',
): Promise<string> {
  if (!isValidAxiomeContractAddress(contractAddress)) {
    throw new Error('Contract address CW20 tidak valid — harus bech32 dengan prefix "axm1...".');
  }
  if (!isValidAxiomeAddress(toAddress)) {
    throw new Error('Address tujuan tidak valid — harus bech32 dengan prefix "axm1...".');
  }
  if (!(amount > 0)) {
    throw new Error('Jumlah token yang dikirim harus lebih dari 0.');
  }
  if (net.rpcUrls.length === 0) {
    throw new Error(
      `${net.name} belum punya RPC endpoint yang dikonfigurasi. ` +
      'Isi AXIOME_NETWORKS[].rpcUrls dengan endpoint Tendermint RPC (biasanya port 26657).'
    );
  }
  const clean = privateKeyHex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error('Private key Axiome harus berupa 32 byte hex (64 karakter), dengan/tanpa prefix "0x".');
  }
  const wallet = await DirectSecp256k1Wallet.fromKey(fromHex(clean), AXM_BECH32_PREFIX);
  const [account] = await wallet.getAccounts();

  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const client = await Promise.race([

        SigningCosmWasmClient.connectWithSigner(rpc, wallet as any, { gasPrice: GasPrice.fromString(AXM_DEFAULT_GAS_PRICE) } as any),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      try {
        const amountBase = Math.round(amount * Math.pow(10, decimals)).toString();
        const msg = { transfer: { recipient: toAddress.trim(), amount: amountBase } };
        const result = await client.execute(account.address, contractAddress.trim(), msg, 'auto', memo);
        return result.transactionHash;
      } finally {
        client.disconnect();
      }
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

export async function fetchAxmPortfolio(
  address: string,
  net: AxmNetworkCfg = AXIOME_NETWORKS[0],
  cw20Contracts: string[] = [],
): Promise<DetectedToken[]> {
  const balance = await getAxmBalanceWithFallback(net, address);
  const price = await fetchAxmUsdPrice();
  const tokens: DetectedToken[] = [];
  if (balance > 0) {
    tokens.push({
      chain: 'axm' as any,
      address: net.denom,
      symbol: net.symbol,
      name: net.name,
      decimals: net.decimals,
      balance,
      balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
      usdPrice: price,
      usdValue: price !== null ? balance * price : null,
    } as DetectedToken);
  }

  const contracts = Array.from(new Set(cw20Contracts.map(c => c.trim()).filter(Boolean)));
  for (const contractAddress of contracts) {
    try {
      const info = await getCw20TokenInfo(net, contractAddress);
      const cw20Balance = await getCw20Balance(net, contractAddress, address, info.decimals);
      if (cw20Balance <= 0) continue;
      tokens.push({
        chain: 'axm' as any,
        address: contractAddress,
        symbol: info.symbol,
        name: info.name,
        decimals: info.decimals,
        balance: cw20Balance,
        balanceFormatted: cw20Balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
        usdPrice: null,
        usdValue: null,
      } as DetectedToken);
    } catch {  }
  }

  return tokens;
}
