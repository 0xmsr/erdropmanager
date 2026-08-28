import { ethers } from 'ethers';
import {
  Keypair as SolKeypair, Connection, PublicKey,
  Transaction as SolTransaction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID as METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import bs58 from 'bs58';
import type { DetectedToken } from '../Walletgenerator';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

export function deriveSolanaAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2);
  const path    = `m/44'/501'/${index}'/0'`;
  const { key } = deriveEd25519Path(path, seedHex);
  const keypair = SolKeypair.fromSeed(key);
  return {
    address:    keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  };
}


export function getMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID,
  );
  return pda;
}


export const SPL_META_MAX = { name: 32, symbol: 10, uri: 200 } as const;

export interface SolNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  clusterParam: string;
  rpcUrls: string[];
}

export const SOLANA_NETWORKS: SolNetworkCfg[] = [
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
      'https://rpc.ankr.com/solana',
      'https://solana.drpc.org',
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

export async function getSolanaConnection(net: SolNetworkCfg): Promise<Connection> {
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


// ── Kirim + konfirmasi TX Solana dengan aman terhadap "block height exceeded". ──
// sendAndConfirmTransaction bawaan web3.js polling konfirmasi memakai window
// validitas blockhash (~150 block / 60-90 detik). Kalau RPC lambat / network padat,
// window itu bisa habis DULUAN sebelum RPC sempat lihat tx-nya confirmed — padahal
// tx itu sendiri sudah tervalidasi & landed on-chain. Bug ini bikin transfer yang
// SEBENARNYA BERHASIL malah dilaporkan gagal ke user.
//
// Fix: begitu error TransactionExpiredBlockheightExceededError muncul, jangan
// langsung anggap gagal — cross-check langsung ke chain pakai getSignatureStatus.
// Signature transaksi sudah tersedia di tx.signature karena signing terjadi
// SEBELUM broadcast (di dalam sendAndConfirmTransaction/sendTransaction), jadi
// kita tetap bisa melacaknya walau pemanggilnya keburu throw.
export async function sendAndConfirmTransactionSafe(
  connection: Connection,
  tx: SolTransaction,
  signers: SolKeypair[],
  opts?: { retries?: number; retryDelayMs?: number },
): Promise<string> {
  try {
    return await sendAndConfirmTransaction(connection, tx, signers);
  } catch (err: any) {
    const msg = err?.message || '';
    const isExpired =
      err?.name === 'TransactionExpiredBlockheightExceededError' ||
      /block height exceeded/i.test(msg);
    if (!isExpired) throw err;

    const sigBytes = tx.signature;
    if (!sigBytes) throw err; // belum sempat signed, memang gagal total

    const sig = bs58.encode(sigBytes);
    const retries = opts?.retries ?? 6;
    const delayMs = opts?.retryDelayMs ?? 2000;

    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, delayMs));
      try {
        const status = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
        const st = status?.value;
        if (st) {
          if (st.err) {
            throw new Error(`Transaksi ditolak on-chain: ${JSON.stringify(st.err)}`);
          }
          if (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized') {
            return sig; // Sudah landed — cuma RPC/client-nya yang telat lihat.
          }
        }
      } catch (checkErr: any) {
        if (checkErr?.message?.startsWith('Transaksi ditolak')) throw checkErr;
        // lanjut retry kalau ini cuma error jaringan sesaat
      }
    }

    // Setelah semua retry tetap tidak ketemu status "confirmed" → benar-benar expired,
    // lempar error asli tapi sertakan signature biar user bisa cek manual.
    throw new Error(
      `${msg} — cek manual dulu di explorer sebelum retry (signature: ${sig}), ` +
      `karena tx bisa saja tetap landed meski konfirmasi timeout.`
    );
  }
}

export async function getSolBalanceWithFallback(net: SolNetworkCfg, address: string): Promise<number> {
  const pubkey = new PublicKey(address);
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const conn = new Connection(rpc, 'confirmed');
      return await Promise.race([
        conn.getBalance(pubkey),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Semua RPC gagal');
}

export async function fetchSolTokenPortfolio(address: string, net: SolNetworkCfg = SOLANA_NETWORKS[0]): Promise<DetectedToken[]> {
  const owner = new PublicKey(address);

  let resp: Awaited<ReturnType<Connection['getParsedTokenAccountsByOwner']>> | null = null;
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const conn = new Connection(rpc, 'confirmed');
      resp = await Promise.race([
        conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
      ]);
      break;
    } catch (e) { lastErr = e; }
  }
  if (!resp) {
    throw new Error(
      'Semua RPC Solana menolak permintaan cek token.' +
      (lastErr?.message ? ` (${lastErr.message})` : ' Coba lagi beberapa saat.')
    );
  }
  const holdings = resp.value
    .map(v => v.account.data.parsed?.info)
    .filter(info => info && Number(info.tokenAmount?.uiAmount ?? 0) > 0);
  if (holdings.length === 0) return [];


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
    } catch {  }
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
