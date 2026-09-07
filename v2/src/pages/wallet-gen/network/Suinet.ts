import { ethers } from 'ethers';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import { blake2b } from 'blakejs';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

// ── Derivasi address Sui ──────────────────────────────────────────────────
// Sui pakai keypair ed25519 (default scheme). Path standar Sui Wallet:
// m/44'/784'/{account}'/0'/0' — semua level di-hardened (syarat SLIP-0010
// untuk ed25519), Address = blake2b256( flag(0x00 = Ed25519) || pubkey ), 32 byte, hex 0x-prefixed.

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function suiAddressFromPublicKey(pubKey: Uint8Array): string {
  const flagged = new Uint8Array(1 + pubKey.length);
  flagged[0] = 0x00;
  flagged.set(pubKey, 1);
  const hash = blake2b(flagged, undefined, 32);
  return '0x' + toHex(hash);
}

export function deriveSuiAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2);
  const path    = `m/44'/784'/${index}'/0'/0'`;
  const { key } = deriveEd25519Path(path, seedHex);
  const keypair = nacl.sign.keyPair.fromSeed(key);
  const address = suiAddressFromPublicKey(keypair.publicKey);
  return { address, privateKey: '0x' + toHex(key) };
}

export function isValidSuiAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(address.trim());
}

export interface SuiNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  rpcUrls: string[];
}

export const SUI_NETWORKS: SuiNetworkCfg[] = [
  {
    id: 'mainnet',
    name: 'Sui Mainnet',
    symbol: 'SUI',
    color: '#4DA2FF',
    explorerUrl: 'https://suiscan.xyz/mainnet/account',
    rpcUrls: [
      'https://sui-mainnet-endpoint.blockvision.org',
      'https://sui-rpc.publicnode.com',
      'https://rpc.ankr.com/sui',
    ],
  },
  {
    id: 'testnet',
    name: 'Sui Testnet',
    symbol: 'SUI',
    color: '#8dc3ff',
    explorerUrl: 'https://suiscan.xyz/testnet/account',
    rpcUrls: [
      'https://sui-testnet-rpc.publicnode.com',
      'https://rpc.ankr.com/sui_testnet',
    ],
  },
];

const MIST_PER_SUI = 1_000_000_000;

async function suiRpcCall(net: SuiNetworkCfg, method: string, params: any[]): Promise<any> {
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const res = await Promise.race([
        fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'Sui RPC error');
      return json.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

export async function getSuiBalanceWithFallback(net: SuiNetworkCfg, address: string): Promise<number> {
  const result = await suiRpcCall(net, 'suix_getBalance', [address, '0x2::sui::SUI']);
  return Number(result?.totalBalance || 0) / MIST_PER_SUI;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return bytes;
}

function suiKeypairFromPrivateKey(privateKeyHex: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(hexToBytes(privateKeyHex));
}

export const SUI_GAS_BUFFER = 0.01;

export async function sendSui(net: SuiNetworkCfg, privateKeyHex: string, to: string, amountSui: number): Promise<string> {
  const keypair = suiKeypairFromPrivateKey(privateKeyHex);
  const amountMist = Math.round(amountSui * MIST_PER_SUI);
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const client = new SuiJsonRpcClient({ url: rpc, network: net.id as 'mainnet' | 'testnet' });
      const tx = new Transaction();
      tx.setSender(keypair.toSuiAddress());
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      tx.transferObjects([coin], to);
      const result = await client.signAndExecuteTransaction({ transaction: tx, signer: keypair });
      return result.digest;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Gagal mengirim transaksi ke ${net.name}. Cek koneksi / RPC.`);
}

export function suiFriendlyError(e: any): string {
  const msg = e?.message || String(e);
  if (/insufficient\s*(gas|balance)/i.test(msg)) return 'Saldo SUI tidak cukup untuk jumlah + gas.';
  if (/invalid.*address/i.test(msg)) return 'Address tujuan tidak valid.';
  return msg || 'Gagal mengirim transaksi SUI.';
}