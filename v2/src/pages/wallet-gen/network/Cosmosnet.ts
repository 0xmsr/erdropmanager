import { ethers } from 'ethers';
import {
  Slip10, Slip10Curve, Secp256k1, Sha256, Ripemd160, stringToPath,
} from '@cosmjs/crypto';
import { toBech32, fromBech32, toHex, fromHex } from '@cosmjs/encoding';
import {
  StargateClient, SigningStargateClient, GasPrice, type Coin,
  QueryClient, setupStakingExtension, setupDistributionExtension,
} from '@cosmjs/stargate';
import { Tendermint37Client } from '@cosmjs/tendermint-rpc';
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import type { DetectedToken } from '../Walletgenerator';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

export const ATOM_BECH32_PREFIX = 'cosmos';
export const ATOM_DENOM         = 'uatom';
export const ATOM_DECIMALS      = 6;
export const ATOM_COIN_TYPE     = 118;

function compressedPubkeyToAtomAddress(compressedPubkey: Uint8Array): string {
  const rawAddress = new Ripemd160(new Sha256(compressedPubkey).digest()).digest();
  return toBech32(ATOM_BECH32_PREFIX, rawAddress);
}

export async function deriveCosmosAddress(mnemonic: string, index: number): Promise<{ address: string; privateKey: string }> {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2);
  const seed    = fromHex(seedHex);
  const path    = stringToPath(`m/44'/${ATOM_COIN_TYPE}'/${index}'/0/0`);
  const { privkey }      = Slip10.derivePath(Slip10Curve.Secp256k1, seed, path);
  const { pubkey }       = await Secp256k1.makeKeypair(privkey);
  const compressedPubkey = Secp256k1.compressPubkey(pubkey);

  return {
    address:    compressedPubkeyToAtomAddress(compressedPubkey),
    privateKey: toHex(privkey),
  };
}

export async function cosmosAddressFromPrivateKey(privateKeyHex: string): Promise<string> {
  const clean = privateKeyHex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error('Private key Cosmos harus berupa 32 byte hex (64 karakter), dengan/tanpa prefix "0x".');
  }
  const privkey = fromHex(clean);
  const { pubkey } = await Secp256k1.makeKeypair(privkey);
  const compressedPubkey = Secp256k1.compressPubkey(pubkey);
  return compressedPubkeyToAtomAddress(compressedPubkey);
}

export function isValidCosmosAddress(address: string): boolean {
  try {
    const { prefix, data } = fromBech32(address.trim());
    return prefix === ATOM_BECH32_PREFIX && data.length === 20;
  } catch {
    return false;
  }
}

export interface AtomNetworkCfg {
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

export const COSMOS_NETWORKS: AtomNetworkCfg[] = [
  {
    id: 'cosmoshub-mainnet',
    name: 'Cosmos Hub',
    symbol: 'ATOM',
    color: '#2E3148',
    explorerUrl: 'https://www.mintscan.io/cosmos',
    chainId: 'cosmoshub-4',
    denom: ATOM_DENOM,
    decimals: ATOM_DECIMALS,
    rpcUrls: [
      'https://cosmos-rpc.publicnode.com:443',
      'https://cosmos-rpc.polkachu.com:443',
      'https://rpc-cosmoshub.ecostake.com',
      'https://rpc.lavenderfive.com:443/cosmoshub',
    ],
    restUrls: [
      'https://cosmos-rest.publicnode.com',
      'https://cosmos-api.polkachu.com',
      'https://rest-cosmoshub.ecostake.com',
      'https://rest.lavenderfive.com:443/cosmoshub',
    ],
  },
];

export async function getCosmosConnection(net: AtomNetworkCfg): Promise<StargateClient> {
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      return await Promise.race([
        StargateClient.connect(rpc),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

async function getAtomQueryClient(net: AtomNetworkCfg) {
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const tmClient = await Promise.race([
        Tendermint37Client.connect(rpc),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      const queryClient = QueryClient.withExtensions(tmClient, setupStakingExtension, setupDistributionExtension);
      return { queryClient, tmClient };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

function atomBondStatusToString(status: number): string {
  switch (status) {
    case 1: return 'BOND_STATUS_UNBONDED';
    case 2: return 'BOND_STATUS_UNBONDING';
    case 3: return 'BOND_STATUS_BONDED';
    default: return 'BOND_STATUS_UNSPECIFIED';
  }
}

function atomDecToNumber(dec: string | undefined): number {
  return Number(dec || '0') / 1e18;
}


export const ATOM_GAS_PRICE_TIERS = { slow: 0.01, standard: 0.025, fast: 0.03 } as const;
export type AtomGasMode = 'slow' | 'standard' | 'fast' | 'manual';

const ATOM_DEFAULT_GAS_PRICE = `${ATOM_GAS_PRICE_TIERS.standard}${ATOM_DENOM}`;

async function getSigningCosmosClient(
  net: AtomNetworkCfg,
  privateKeyHex: string,
  gasPriceUatom: number = ATOM_GAS_PRICE_TIERS.standard,
): Promise<{ client: SigningStargateClient; address: string }> {
  const clean = privateKeyHex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error('Private key Cosmos harus berupa 32 byte hex (64 karakter), dengan/tanpa prefix "0x".');
  }
  const wallet     = await DirectSecp256k1Wallet.fromKey(fromHex(clean), ATOM_BECH32_PREFIX);
  const [account]  = await wallet.getAccounts();

  const gasPriceStr = Number.isFinite(gasPriceUatom) && gasPriceUatom > 0
    ? `${gasPriceUatom}${ATOM_DENOM}`
    : ATOM_DEFAULT_GAS_PRICE;

  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const client = await Promise.race([
        SigningStargateClient.connectWithSigner(rpc, wallet, { gasPrice: GasPrice.fromString(gasPriceStr) }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      return { client, address: account.address };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

export async function sendAtom(
  net: AtomNetworkCfg,
  privateKeyHex: string,
  toAddress: string,
  amount: number,
  memo: string = '',
  gasPriceUatom: number = ATOM_GAS_PRICE_TIERS.standard,
): Promise<string> {
  if (!isValidCosmosAddress(toAddress)) {
    throw new Error('Address tujuan tidak valid — harus bech32 dengan prefix "cosmos1...".');
  }
  if (!(amount > 0)) {
    throw new Error('Jumlah ATOM yang dikirim harus lebih dari 0.');
  }
  const { client, address: fromAddress } = await getSigningCosmosClient(net, privateKeyHex, gasPriceUatom);
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

const ATOM_GAS_ADJUSTMENT = 1.4;

export interface AtomFeeEstimate {
  gasUnits: number;
  gasPriceUatom: number;
  feeUatom: number;
  feeAtom: number;
}

export async function estimateAtomFee(
  net: AtomNetworkCfg,
  privateKeyHex: string,
  toAddress: string,
  amount: number,
  memo: string = '',
  gasPriceUatom: number = ATOM_GAS_PRICE_TIERS.standard,
): Promise<AtomFeeEstimate> {
  if (!isValidCosmosAddress(toAddress)) {
    throw new Error('Address tujuan tidak valid — harus bech32 dengan prefix "cosmos1...".');
  }
  if (!(amount > 0)) {
    throw new Error('Jumlah ATOM harus lebih dari 0.');
  }
  const effGasPriceUatom = Number.isFinite(gasPriceUatom) && gasPriceUatom > 0
    ? gasPriceUatom
    : ATOM_GAS_PRICE_TIERS.standard;
  const { client, address: fromAddress } = await getSigningCosmosClient(net, privateKeyHex, effGasPriceUatom);
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
    const gasUnits = Math.ceil(gasUsed * ATOM_GAS_ADJUSTMENT);
    const feeUatom = Math.ceil(gasUnits * effGasPriceUatom);
    return {
      gasUnits,
      gasPriceUatom: effGasPriceUatom,
      feeUatom,
      feeAtom: feeUatom / Math.pow(10, net.decimals),
    };
  } finally {
    client.disconnect();
  }
}

export function atomFriendlyError(e: any): string {
  const raw = String(e?.message || e || '');
  if (/insufficient fee/i.test(raw)) {
    return 'Fee terlalu kecil ditolak mempool — coba naikkan gas price.';
  }
  if (/insufficient funds/i.test(raw)) {
    return 'Saldo ATOM tidak cukup untuk jumlah + fee transaksi.';
  }
  if (/account sequence mismatch/i.test(raw)) {
    return 'Sequence akun tidak sinkron (ada tx lain yang masih pending) — coba lagi sebentar.';
  }
  if (/timeout/i.test(raw)) {
    return 'Koneksi ke RPC Cosmos Hub timeout. Coba lagi atau ganti endpoint di COSMOS_NETWORKS[].rpcUrls.';
  }
  if (/no delegation for \(address, validator\)|delegation.*not found/i.test(raw)) {
    return 'Tidak ada delegasi aktif ke validator ini.';
  }
  if (/validator does not exist/i.test(raw)) {
    return 'Validator tidak ditemukan — cek kembali operator address-nya (harus diawali "cosmosvaloper1...").';
  }
  if (/validator.*jailed/i.test(raw)) {
    return 'Validator sedang di-jail (dihukum karena downtime/double-sign) — tidak bisa menerima delegasi baru sampai unjail.';
  }
  return raw || 'Gagal mengirim transaksi ATOM.';
}

export interface AtomValidator {
  address: string;
  moniker: string;
  commissionRate: number;
  jailed: boolean;
  status: string;
  votingPowerAtom: number;
}

export async function getAtomValidators(net: AtomNetworkCfg): Promise<AtomValidator[]> {
  const { queryClient, tmClient } = await getAtomQueryClient(net);
  try {
    const all: AtomValidator[] = [];
    let pageKey: Uint8Array | undefined;
    do {
      const res = await queryClient.staking.validators('BOND_STATUS_BONDED', pageKey);
      for (const v of res.validators) {
        all.push({
          address:         v.operatorAddress,
          moniker:         v.description?.moniker || v.operatorAddress,
          commissionRate:  atomDecToNumber(v.commission?.commissionRates?.rate),
          jailed:          !!v.jailed,
          status:          atomBondStatusToString(v.status),
          votingPowerAtom: Number(v.tokens || '0') / Math.pow(10, net.decimals),
        });
      }
      pageKey = res.pagination?.nextKey?.length ? res.pagination.nextKey : undefined;
    } while (pageKey);
    return all.sort((a, b) => b.votingPowerAtom - a.votingPowerAtom);
  } finally {
    tmClient.disconnect();
  }
}

export interface AtomDelegation {
  validatorAddress: string;
  balanceAtom: number;
}

export async function getAtomDelegations(net: AtomNetworkCfg, delegatorAddress: string): Promise<AtomDelegation[]> {
  const { queryClient, tmClient } = await getAtomQueryClient(net);
  try {
    const res = await queryClient.staking.delegatorDelegations(delegatorAddress);
    return res.delegationResponses.map((d): AtomDelegation => ({
      validatorAddress: d.delegation?.validatorAddress || '',
      balanceAtom: Number(d.balance?.amount ?? '0') / Math.pow(10, net.decimals),
    }));
  } finally {
    tmClient.disconnect();
  }
}

export interface AtomRewardEntry {
  validatorAddress: string;
  rewardAtom: number;
}

export async function getAtomRewards(net: AtomNetworkCfg, delegatorAddress: string): Promise<{ perValidator: AtomRewardEntry[]; totalAtom: number }> {
  const { queryClient, tmClient } = await getAtomQueryClient(net);
  try {
    const res = await queryClient.distribution.delegationTotalRewards(delegatorAddress);
    const sumDenom = (coins: { denom: string; amount: string }[] | undefined) =>
      (coins || []).filter(c => c.denom === net.denom).reduce((a, c) => a + atomDecToNumber(c.amount), 0);
    const perValidator = res.rewards.map((r): AtomRewardEntry => ({
      validatorAddress: r.validatorAddress,
      rewardAtom: sumDenom(r.reward) / Math.pow(10, net.decimals),
    }));
    const totalAtom = res.total.length > 0
      ? sumDenom(res.total) / Math.pow(10, net.decimals)
      : perValidator.reduce((a, r) => a + r.rewardAtom, 0);
    return { perValidator, totalAtom };
  } finally {
    tmClient.disconnect();
  }
}

export async function delegateAtom(
  net: AtomNetworkCfg,
  privateKeyHex: string,
  validatorAddress: string,
  amount: number,
  memo: string = '',
): Promise<string> {
  if (!validatorAddress?.trim().startsWith('cosmosvaloper1')) {
    throw new Error('Validator operator address tidak valid — harus diawali "cosmosvaloper1...".');
  }
  if (!(amount > 0)) {
    throw new Error('Jumlah ATOM yang di-stake harus lebih dari 0.');
  }
  const { client, address } = await getSigningCosmosClient(net, privateKeyHex);
  try {
    const amountBase = Math.round(amount * Math.pow(10, net.decimals)).toString();
    const coin: Coin = { denom: net.denom, amount: amountBase };
    const result = await client.delegateTokens(address, validatorAddress.trim(), coin, 'auto', memo);
    if (result.code !== 0) {
      throw new Error(`Delegasi ditolak chain (code ${result.code}): ${result.rawLog || 'tidak ada detail'}`);
    }
    return result.transactionHash;
  } finally {
    client.disconnect();
  }
}

export async function undelegateAtom(
  net: AtomNetworkCfg,
  privateKeyHex: string,
  validatorAddress: string,
  amount: number,
  memo: string = '',
): Promise<string> {
  if (!validatorAddress?.trim().startsWith('cosmosvaloper1')) {
    throw new Error('Validator operator address tidak valid — harus diawali "cosmosvaloper1...".');
  }
  if (!(amount > 0)) {
    throw new Error('Jumlah ATOM yang di-unstake harus lebih dari 0.');
  }
  const { client, address } = await getSigningCosmosClient(net, privateKeyHex);
  try {
    const amountBase = Math.round(amount * Math.pow(10, net.decimals)).toString();
    const coin: Coin = { denom: net.denom, amount: amountBase };
    const result = await client.undelegateTokens(address, validatorAddress.trim(), coin, 'auto', memo);
    if (result.code !== 0) {
      throw new Error(`Undelegate ditolak chain (code ${result.code}): ${result.rawLog || 'tidak ada detail'}`);
    }
    return result.transactionHash;
  } finally {
    client.disconnect();
  }
}

export async function claimAtomRewards(
  net: AtomNetworkCfg,
  privateKeyHex: string,
  validatorAddresses: string[],
): Promise<string[]> {
  const targets = validatorAddresses.map(v => v.trim()).filter(Boolean);
  if (targets.length === 0) {
    throw new Error('Tidak ada validator yang dipilih untuk klaim reward.');
  }
  const { client, address } = await getSigningCosmosClient(net, privateKeyHex);
  const hashes: string[] = [];
  try {
    for (const val of targets) {
      const result = await client.withdrawRewards(address, val, 'auto', '');
      if (result.code !== 0) {
        throw new Error(`Klaim reward ditolak chain (code ${result.code}) untuk validator ${val}: ${result.rawLog || 'tidak ada detail'}`);
      }
      hashes.push(result.transactionHash);
    }
    return hashes;
  } finally {
    client.disconnect();
  }
}


export async function getAtomBalanceWithFallback(net: AtomNetworkCfg, address: string): Promise<number> {
  let lastErr: any;
  for (const rest of net.restUrls) {
    try {
      const res = await Promise.race([
        fetch(`${rest}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${net.denom}`),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]) as Response;
      if (res.ok) {
        const json = await res.json();
        return Number(json?.balance?.amount ?? '0') / Math.pow(10, net.decimals);
      }
    } catch (e) { lastErr = e; }
  }
  try {
    const client = await getCosmosConnection(net);
    try {
      const coin = await client.getBalance(address, net.denom);
      return Number(coin?.amount ?? '0') / Math.pow(10, net.decimals);
    } finally {
      client.disconnect();
    }
  } catch (e) {
    throw lastErr || e || new Error('Semua RPC/REST Cosmos Hub gagal.');
  }
}

async function fetchAtomUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=cosmos&vs_currencies=usd');
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.cosmos?.usd;
    return typeof price === 'number' ? price : null;
  } catch { return null; }
}


export async function fetchAtomPortfolio(address: string, net: AtomNetworkCfg = COSMOS_NETWORKS[0]): Promise<DetectedToken[]> {
  const balance = await getAtomBalanceWithFallback(net, address);
  if (balance <= 0) return [];
  const price = await fetchAtomUsdPrice();
  return [{
    chain: 'atom' as any,
    address: net.denom,
    symbol: net.symbol,
    name: net.name,
    decimals: net.decimals,
    balance,
    balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
    usdPrice: price,
    usdValue: price !== null ? balance * price : null,
  } as DetectedToken];
}