import { ethers } from 'ethers';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import { sha3_256 } from '@noble/hashes/sha3.js';
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from '@aptos-labs/ts-sdk';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

// ── Derivasi address Aptos ────────────────────────────────────────────────
// Aptos pakai keypair ed25519 (single-signer, scheme legacy). Path standar
// Aptos SDK: m/44'/637'/{account}'/0'/0' — semua level hardened, sama pola
// dengan Sui di Suinet.ts.
// Address (authentication key awal, sebelum key rotation) =
// sha3-256( pubkey || scheme(0x00 = Ed25519) ), 32 byte, hex 0x-prefixed.

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function aptosAddressFromPublicKey(pubKey: Uint8Array): string {
  const buf  = Buffer.concat([Buffer.from(pubKey), Buffer.from([0x00])]);
  const hash = sha3_256(buf);
  return '0x' + toHex(hash);
}

export function deriveAptosAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2);
  const path    = `m/44'/637'/${index}'/0'/0'`;
  const { key } = deriveEd25519Path(path, seedHex);
  const keypair = nacl.sign.keyPair.fromSeed(key);
  const address = aptosAddressFromPublicKey(keypair.publicKey);
  return { address, privateKey: '0x' + toHex(key) };
}

export function isValidAptosAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(address.trim());
}

export interface AptosNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  apiUrls: string[];
}

export const APTOS_NETWORKS: AptosNetworkCfg[] = [
  {
    id: 'mainnet',
    name: 'Aptos Mainnet',
    symbol: 'APT',
    color: '#00D2AA',
    explorerUrl: 'https://explorer.aptoslabs.com/account',
    apiUrls: [
      'https://api.mainnet.aptoslabs.com/v1',
      'https://aptos.blockpi.network/aptos/v1/public/v1',
      'https://public.1rpc.io/aptos/v1',
    ],
  },
  {
    id: 'testnet',
    name: 'Aptos Testnet',
    symbol: 'APT',
    color: '#7fe9d6',
    explorerUrl: 'https://explorer.aptoslabs.com/account',
    apiUrls: [
      'https://api.testnet.aptoslabs.com/v1',
      'https://fullnode.testnet.aptoslabs.com/v1',
    ],
  },
];

const OCTA_PER_APT = 100_000_000;

export async function getAptosBalanceWithFallback(net: AptosNetworkCfg, address: string): Promise<number> {
  let lastErr: any;
  for (const api of net.apiUrls) {
    try {
      const res = await Promise.race([
        fetch(`${api}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            function: '0x1::coin::balance',
            type_arguments: ['0x1::aptos_coin::AptosCoin'],
            arguments: [address],
          }),
        }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      if (res.status === 404) return 0; // akun belum pernah aktif di chain
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json  = await res.json();
      const value = Array.isArray(json) ? json[0] : undefined;
      return Number(value || 0) / OCTA_PER_APT;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return bytes;
}

function aptosAccountFromPrivateKey(privateKeyHex: string) {
  const privKey = new Ed25519PrivateKey(hexToBytes(privateKeyHex));
  return Account.fromPrivateKey({ privateKey: privKey });
}

function aptosNetworkEnum(net: AptosNetworkCfg): Network {
  return net.id === 'mainnet' ? Network.MAINNET : Network.TESTNET;
}

export const APTOS_GAS_BUFFER = 0.01;
export async function sendAptos(net: AptosNetworkCfg, privateKeyHex: string, to: string, amountApt: number): Promise<string> {
  const account = aptosAccountFromPrivateKey(privateKeyHex);
  const amountOcta = Math.round(amountApt * OCTA_PER_APT);
  let lastErr: any;
  for (const api of net.apiUrls) {
    try {
      const config = new AptosConfig({ network: aptosNetworkEnum(net), fullnode: api });
      const aptos  = new Aptos(config);
      const transaction = await aptos.transferCoinTransaction({
        sender: account.accountAddress,
        recipient: to,
        amount: amountOcta,
      });
      const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction });
      await aptos.waitForTransaction({ transactionHash: pending.hash });
      return pending.hash;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Gagal mengirim transaksi ke ${net.name}. Cek koneksi / RPC.`);
}

export function aptFriendlyError(e: any): string {
  const msg = e?.message || String(e);
  if (/insufficient.*balance|INSUFFICIENT_BALANCE/i.test(msg)) return 'Saldo APT tidak cukup untuk jumlah + gas.';
  if (/invalid.*address/i.test(msg)) return 'Address tujuan tidak valid.';
  return msg || 'Gagal mengirim transaksi APT.';
}