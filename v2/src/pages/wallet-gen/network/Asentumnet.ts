import { ethers } from 'ethers';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import { bech32 } from 'bech32';
import { AsentumClient, AsentumWallet, AsentumContract, parseAse, formatAse } from '@asentum/sdk';
// Dipakai HANYA untuk workaround bug fee di bawah (lihat komentar di dekat
// `signAndSubmitAse`) — keduanya sudah otomatis ke-install lewat @asentum/sdk
// (dependency-nya), tapi tambahkan eksplisit ke package.json:
// `npm i @asentum/crypto@^0.1.0 @asentum/types@^0.1.0` biar tidak bergantung
// pada hoisting node_modules.
import { blake3, sign } from '@asentum/crypto';
import { TransactionBodySchema, SignedTransactionSchema } from '@asentum/types';

// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr

// ── CATATAN PENTING SEBELUM PAKAI ──────────────────────────────────────────
// Asentum adalah chain testnet post-quantum yang masih sangat baru & kecil
// (Dilithium3 / ML-DSA-65, bukan secp256k1/ed25519 biasa).
//   1. Address AsentumChain itu 20 byte, TAPI ada DUA representasi yang sah
//      buat account yang sama (pola mirip Cosmos EVM: cosmos1... vs 0x...):
//        - hex "0x" + 40 hex char — dipakai @asentum/sdk di level RPC
//          (getBalance, SendTransferOpts.to, dst — dikonfirmasi dari
//          @asentum/types ADDRESS_BYTES=20 & komentar d.ts-nya).
//        - bech32 "ase1..." (38 char setelah prefix "ase1": 32 char data +
//          6 char checksum, pas buat 20 byte) — ini yang ditampilkan di
//          Asentum Wallet extension beneran, dikonfirmasi langsung dari
//          address yang muncul di wallet dev kamu.
//      Jadi di file ini `address` yang disimpan/dipakai di app = bentuk
//      bech32 (biar sama persis kayak yang kelihatan di extension), dan
//      dikonversi ke hex on-the-fly tiap manggil @asentum/sdk. Perlu
//      `npm i bech32` kalau belum ada di package.json.
//   2. Asentum Wallet (extension resmi) cuma bisa import via PRIVATE KEY
//      mentah, bukan mnemonic — jadi path derivasi di bawah ini
//      (m/44'/1'/{index}'/0'/0') murni konvensi internal app ini untuk
//      menurunkan banyak address ASE secara deterministik dari satu master
//      mnemonic wallet. Nggak perlu cocok ke standar resmi manapun (memang
//      belum ada).
//   3. Private key Asentum = SEED 32 byte, ditulis 64 karakter hex (tanpa
//      atau dengan prefix "0x"). Ini sama persis dengan "recovery key" di
//      Asentum Wallet extension: Settings → Reveal recovery key → paste 64
//      karakter itu. Jadi `privateKey` yang disimpan di app = 64 hex seed itu,
//      dan wallet dibentuk lewat `AsentumWallet.fromSeed(client, seed)`.
//      Format lama "secretKeyHex:publicKeyHex" SUDAH TIDAK DIDUKUNG. Wallet
//      lama yang tersimpan dimigrasi paksa lewat `migrateAsentumAddresses()`
//      (derive ulang dari mnemonic — address tetap sama, cuma key-nya diganti
//      jadi seed 64 hex).
//   4. Per 18 Sep 2026, ada beberapa issue terbuka di
//      github.com/asentum-network/asentum-explorer yang melaporkan testnet
//      Asentum macet (block height beku) & validator banyak yang miss block
//      tanpa ke-jail. Jangan kaget kalau balance/kirim tx gagal terus — itu
//      kemungkinan besar dari sisi chain-nya, bukan bug di kode ini.
//   5. Testnet only — ASE di testnet tidak ada nilai uang.
// ────────────────────────────────────────────────────────────────────────

export interface AsentumNetworkCfg {
  id: string;
  name: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  rpcUrls: string[];
  faucetUrl?: string;   // endpoint HTTP faucet (airdrop dashboard)
}

// Hanya testnet — Asentum belum punya mainnet.
export const ASENTUM_NETWORKS: AsentumNetworkCfg[] = [
  {
    id: 'testnet',
    name: 'Asentum Testnet',
    symbol: 'ASE',
    color: '#4949DF',
    explorerUrl: 'https://explorer.asentum.com',
    rpcUrls: [
      'https://testnet.asentum.com',
    ],
    faucetUrl: 'https://airdrop.asentum.com/api/faucet',
  },
];

function makeClient(net: AsentumNetworkCfg, rpc?: string): AsentumClient {
  return new AsentumClient(rpc || net.rpcUrls[0]);
}

const ASENTUM_HRP = 'ase';

// hex "0x..40hex" (yang dipahami @asentum/sdk)  →  bech32 "ase1..." (yang
// ditampilkan Asentum Wallet extension). Sama address, beda tulisan.
export function hexToAsentumBech32(hexAddress: string): string {
  const clean = hexAddress.trim().replace(/^0x/i, '');
  const bytes = Buffer.from(clean, 'hex');
  return bech32.encode(ASENTUM_HRP, bech32.toWords(bytes));
}

// bech32 "ase1..."  →  hex "0x..40hex".
export function asentumBech32ToHex(bech32Address: string): string {
  const { prefix, words } = bech32.decode(bech32Address.trim());
  if (prefix !== ASENTUM_HRP) throw new Error('Prefix address Asentum tidak valid (harus "ase1...").');
  const bytes = Buffer.from(bech32.fromWords(words));
  return '0x' + bytes.toString('hex');
}

// Terima address dalam bentuk apa pun (bech32 ATAU hex) dan selalu balikin
// hex — dipakai tiap kali mau manggil @asentum/sdk (client.getBalance,
// sendTransfer({to}), dst), karena SDK-nya cuma paham hex.
function toAsentumHex(address: string): string {
  const a = address.trim();
  return a.toLowerCase().startsWith('0x') ? a : asentumBech32ToHex(a);
}

// Normalisasi input private key Asentum: 64 hex seed, boleh pakai "0x".
// Balikin 64 hex lowercase tanpa "0x", atau lempar error kalau formatnya salah.
export function normalizeAsentumSeed(input: string): string {
  const clean = input.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error('Format private key Asentum tidak valid — harus 64 karakter hex (recovery key dari Asentum Wallet: Settings → Reveal recovery key).');
  }
  return clean.toLowerCase();
}

// ── Derivasi address Asentum ──────────────────────────────────────────────
// Dilithium3/ML-DSA-65 seed-nya 32 byte (sama seperti seed ed25519), jadi
// dipakai ed25519-hd-key (SLIP-0010) untuk turunkan 32 byte deterministik
// dari mnemonic, lalu 32 byte itu dipakai sebagai seed keygen ML-DSA-65 via
// AsentumWallet.fromSeed(). Lihat CATATAN di atas soal path & format key.
export function deriveAsentumAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const seedHex = ethers.utils.mnemonicToSeed(mnemonic).slice(2);
  const path    = `m/44'/1'/${index}'/0'/0'`;
  const { key } = deriveEd25519Path(path, seedHex);

  const client = makeClient(ASENTUM_NETWORKS[0]);
  const wallet = AsentumWallet.fromSeed(client, key);

  // wallet.address dari SDK berupa hex — dikonversi ke bech32 supaya sama
  // persis dengan yang ditampilkan Asentum Wallet extension.
  // privateKey = seed 64 hex (sama dengan recovery key di extension).
  return { address: hexToAsentumBech32(wallet.address), privateKey: Buffer.from(key).toString('hex') };
}

// true kalau privateKey sudah berformat baru (64 hex seed, boleh "0x").
export function isAsentumSeedKey(privateKey: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test((privateKey || '').trim().replace(/^0x/i, ''));
}

export function migrateAsentumAddresses(
  mnemonic: string,
  list: { index: number; address: string; privateKey: string }[],
): { list: { index: number; address: string; privateKey: string }[]; changed: boolean } {
  let changed = false;
  const out = (list || []).map(entry => {
    if (isAsentumSeedKey(entry.privateKey)) {
      // BUG (fixed): sebelumnya baris ini langsung `return entry;` tanpa
      // cross-check apa pun — begitu privateKey sudah berformat seed 64 hex
      // yang "benar", field `address` yang TERSIMPAN dipercaya selamanya,
      // walau algoritma address/checksum (hexToAsentumBech32, checksum di
      // @asentum/crypto, dst) berubah setelah wallet itu dibuat/dimigrasi.
      // Akibatnya: address yang ditampilkan di daftar wallet bisa berbeda
      // permanen dari address yang benar-benar dipakai saat deploy/kirim tx
      // (yang selalu dihitung ULANG dari privateKey tiap kali dipakai).
      // Fix: tetap hitung ulang address dari privateKey yang tersimpan tiap
      // migrasi jalan, dan perbaiki kalau ternyata sudah tidak match —
      // supaya address yang ditampilkan SELALU konsisten dengan address
      // yang benar-benar dipakai untuk transaksi.
      try {
        const correct = asentumAddressFromPrivateKey(ASENTUM_NETWORKS[0], entry.privateKey);
        if (correct !== entry.address) {
          console.warn(`[Asentum] address index ${entry.index} usang (privateKey sudah seed key, tapi address tersimpan tidak match hasil hitung ulang):`, entry.address, '→', correct);
          changed = true;
          return { ...entry, address: correct };
        }
      } catch { /* privateKey ternyata tidak valid — biarkan entry apa adanya */ }
      return entry;
    }
    try {
      const d = deriveAsentumAddress(mnemonic, entry.index);
      if (d.address !== entry.address) {
        console.warn(`[Asentum] address index ${entry.index} berubah saat migrasi key:`, entry.address, '→', d.address);
      }
      changed = true;
      return { index: entry.index, address: d.address, privateKey: d.privateKey };
    } catch {
      return entry;
    }
  });
  return { list: out, changed };
}

export function isValidAsentumAddress(address: string): boolean {
  const a = address.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return true;
  try {
    const { prefix, words } = bech32.decode(a);
    return prefix === ASENTUM_HRP && bech32.fromWords(words).length === 20;
  } catch { return false; }
}

export async function getAsentumBalanceWithFallback(net: AsentumNetworkCfg, address: string): Promise<number> {
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const client = makeClient(net, rpc);
      const bal = await Promise.race([
        client.getBalance(toAsentumHex(address)),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      return Number(formatAse(bal.balance));
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

// Minta ASE gratis dari faucet testnet lewat endpoint HTTP airdrop dashboard
// (POST https://airdrop.asentum.com/api/faucet). SEBELUMNYA pakai
// `wallet.requestFaucet()` dari @asentum/sdk (JSON-RPC ke node), tapi node
// sekarang menolak dengan `{accepted:false, reason:"unauthorized: the faucet
// is available through the airdrop dashboard, the Telegram wallet, or a
// validator install"}` — jadi jalur SDK sudah tidak bisa dipakai dari app ini.
// Respons sukses endpoint dashboard: {ok:true, txHash, amount:"5", to:"0x..."}.
//
// Body request = {address: "0x..."} (hex 20 byte; bech32 "ase1..." dikonversi
// dulu). Kalau dashboard ternyata memakai nama field lain, cukup ubah
// FAUCET_BODY_KEYS di bawah — semua key dicoba berurutan.
const FAUCET_BODY_KEYS = ['address', 'to', 'wallet'];

export interface AsentumFaucetResult {
  txHash?: string;
  hash?: string;
  amount?: string;
  to?: string;
}

export async function requestAsentumFaucet(net: AsentumNetworkCfg, privateKey: string, _rpc?: string): Promise<AsentumFaucetResult> {
  const url = net.faucetUrl;
  if (!url) throw new Error(`Faucet tidak dikonfigurasi untuk ${net.name}.`);

  // Address diturunkan dari privateKey (sama seperti sebelumnya) supaya
  // pemanggil tidak perlu berubah.
  const hexAddr = toAsentumHex(asentumAddressFromPrivateKey(net, privateKey));

  let lastErr: any;
  for (const key of FAUCET_BODY_KEYS) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ [key]: hexAddr }),
        signal: ctrl.signal,
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

      if (res.ok && data?.ok !== false && data?.accepted !== false) {
        const txHash = data.txHash || data.hash;
        return { txHash, hash: txHash, amount: data.amount, to: data.to };
      }
      const reason = data?.reason || data?.error || data?.message || `HTTP ${res.status}`;
      lastErr = new Error(String(reason));
      // Error karena rate limit / unauthorized tidak akan berubah kalau ganti
      // nama field — berhenti di sini. Coba key lain hanya untuk error
      // validasi body (400/422).
      if (res.status !== 400 && res.status !== 422) break;
    } catch (e: any) {
      lastErr = e?.name === 'AbortError' ? new Error('timeout') : e;
      break;
    } finally { clearTimeout(timer); }
  }
  throw lastErr || new Error(`Gagal request faucet dari ${net.name}. Cek koneksi.`);
}

function asentumWalletFromPrivateKey(net: AsentumNetworkCfg, privateKey: string, rpc?: string): AsentumWallet {
  const client = makeClient(net, rpc);
  // 64 hex seed (recovery key extension / seed hex mentah, boleh 0x)
  const seed = Buffer.from(normalizeAsentumSeed(privateKey), 'hex');
  return AsentumWallet.fromSeed(client, seed);
}

// Turunkan address (bech32 "ase1...") dari privateKey yang tersimpan
// (64 hex seed / recovery key) — dipakai TransferTab saat user "Connect"
// pakai private key hasil paste manual atau hasil pilih wallet tersimpan,
export function asentumAddressFromPrivateKey(net: AsentumNetworkCfg, privateKey: string, rpc?: string): string {
  const wallet = asentumWalletFromPrivateKey(net, privateKey, rpc);
  return hexToAsentumBech32(wallet.address);
}

export const ASENTUM_GAS_BUFFER = 0.01;

// ── Opsi gas fee (dipakai user, mis. di Swap/LP AuraSwap) ───────────────
// 'normal' = default lama (baseFee × 1.5), 'fast' = baseFee × 2 (prioritas
// lebih tinggi biar lebih cepat masuk blok saat network lagi padat),
// 'custom' = maxFeePerGas diisi manual dalam Gwei oleh user.
export type AseGasSpeed = 'normal' | 'fast' | 'custom';
export interface AseGasOverride {
  speed?: AseGasSpeed;              // default 'normal'
  customMaxFeePerGasGwei?: string;  // wajib diisi kalau speed === 'custom'
}

function gweiToWeiBig(gwei: string): bigint {
  const s = (gwei || '').trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return 0n;
  const [whole, frac = ''] = s.split('.');
  const fracPadded = (frac + '000000000').slice(0, 9); // 1 gwei = 1e9 wei
  return BigInt(whole || '0') * 1_000_000_000n + BigInt(fracPadded || '0');
}

// ── Estimasi gas fee ASE  ───────────────────────────────────────────────
// AsentumClient RPC-nya mirip gaya Ethereum (EIP-1559): tiap block header
// punya `baseFeePerGas`, dan SendTransferOpts (@asentum/types) bilang
// gasLimit default transfer native = 21.000 kalau tidak dioverride. SDK-nya
export const ASENTUM_TRANSFER_GAS_LIMIT = 21000n;
export const ASENTUM_FEE_SAFETY_MARGIN_NUM = 3n;
export const ASENTUM_FEE_SAFETY_MARGIN_DEN = 2n;

export interface AsentumFeeEstimate {
  gasLimit: string;
  baseFeePerGas: string;
  estimatedFeeWei: string;
  feeAse: number;
  isFallback: boolean;
}

// ══════════════════════════════════════════════════════════════════════════
// WORKAROUND: @asentum/sdk@0.1.0 mengunci `maxFeePerGas` ke `1n` (1 wei) untuk
// SEMUA transaksi — lihat AsentumWallet.sendTransfer/sendCall/deploy di
// node_modules/@asentum/sdk/src/wallet.ts (`signAndSubmit`). SendTransferOpts,
// SendCallOpts, dan DeployOpts TIDAK punya field untuk override ini.
// Transaksi Asentum bertipe EIP-1559 asli (lihat @asentum/types
// transaction.ts: "mirrors Ethereum's EIP-1559 transaction"), yang berarti
// node akan menolak / tidak pernah menambang tx dengan maxFeePerGas di bawah
// baseFeePerGas blok saat itu. Karena baseFeePerGas testnet nyaris pasti jauh
// di atas 1 wei, SETIAP transaksi lewat SDK ini (transfer, deploy, sendCall —
// termasuk deploy & init() Token Creator) akan underpriced: kadang ditolak
// langsung di submitRawTx, kadang malah "accepted" ke mempool tapi tidak
// pernah ditambang sampai timeout — persis gejala "deploy/init gagal di
// tengah jalan" yang bikin token nyangkut di status needs-init.
//
// Fix di level app (tanpa nunggu rilis SDK baru): re-implement signing +
// submit sendiri pakai primitive publik dari @asentum/crypto & @asentum/types
// (persis yang dipakai SDK secara internal), tapi maxFeePerGas dihitung dari
// baseFeePerGas asli chain (pola sama seperti estimateAsentumFee /
// estimateAsentumTokenDeployFee di bawah: base fee × 3/2). AsentumWallet
// tetap dipakai untuk keypair + address (wallet.keypair, wallet.address,
// wallet.client) — bukan untuk mengirim tx.
// ══════════════════════════════════════════════════════════════════════════

function aseAddressBytes20(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{40}$/.test(clean)) throw new Error('Address hex tidak valid untuk transaksi Asentum (harus 20 byte).');
  const out = new Uint8Array(20);
  for (let i = 0; i < 20; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function aseBytesToHex(bytes: Uint8Array): string {
  let hex = '0x';
  for (let i = 0; i < bytes.length; i++) hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return hex;
}

// baseFeePerGas asli × 3/2 (margin sama seperti estimasi fee lain di file
// ini) — kalau RPC gagal dibaca, fallback ke 1 gwei-equivalent (bukan 1n!)
// supaya tx tidak otomatis underpriced saat RPC lagi lambat/timeout.
// `gas` opsional: 'fast' pakai margin lebih tinggi (×2) biar lebih diprioritaskan
// node saat network padat; 'custom' pakai maxFeePerGas persis sesuai input
// user (Gwei) — TIDAK divalidasi terhadap baseFeePerGas asli, jadi kalau user
// isi kekecilan tx-nya bisa underpriced (sama risikonya kayak wallet lain).
async function aseFeeCap(client: AsentumClient, gas?: AseGasOverride): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  if (gas?.speed === 'custom') {
    const custom = gweiToWeiBig(gas.customMaxFeePerGasGwei || '');
    if (custom > 0n) return { maxFeePerGas: custom, maxPriorityFeePerGas: 0n };
  }
  let baseFee = 0n;
  try {
    const info: any = await client.getChainInfo();
    baseFee = parseFeeBigInt(info?.latestHeader?.baseFeePerGas);
  } catch { /* pakai fallback di bawah */ }
  const fast = gas?.speed === 'fast';
  const maxFeePerGas = baseFee > 0n
    ? (baseFee * (fast ? 2n : ASENTUM_FEE_SAFETY_MARGIN_NUM)) / (fast ? 1n : ASENTUM_FEE_SAFETY_MARGIN_DEN)
    : (fast ? 2_000_000_000n : 1_000_000_000n);
  return { maxFeePerGas, maxPriorityFeePerGas: 0n };
}

// Receipt "palsu" dari node untuk tx yang belum ditambang — bentuknya mirip
// receipt gagal ({success:false, returnValue:{error:'receipt not found'}}),
// makanya sebelumnya init() langsung dilaporkan "gagal on-chain" padahal tx
// cuma belum masuk blok.
function isReceiptPending(r: any): boolean {
  if (!r) return true;
  const txt = (v: unknown) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v, (_k, x) => typeof x === 'bigint' ? x.toString() : x));
  const re = /receipt not found|tx not found|not yet (mined|included)|pending/i;
  if (re.test(txt(r.error))) return true;
  if (r.success === false && re.test(txt(r.returnValue))) return true;
  // SDK bisa menormalisasi respons "receipt not found" jadi {success:false}
  // TANPA teks error & TANPA info blok. Receipt gagal yang ASLI selalu punya
  // salah satu: nomor/hash blok, gasUsed, atau returnValue (alasan revert).
  if (r.success === false) {
    const hasChainInfo = ['blockNumber', 'blockHeight', 'blockHash', 'block', 'gasUsed', 'returnValue']
      .some(k => r[k] !== undefined && r[k] !== null);
    if (!hasChainInfo) return true;
  }
  return false;
}

interface AseSentTx { hash: string; nonce: bigint; wait(timeoutMs?: number): Promise<any>; }

// Pengganti AsentumWallet['signAndSubmit'] privat (yang mengunci maxFeePerGas
// ke 1n) — bangun body, hash (BLAKE3), tanda tangan (Dilithium3 via
// wallet.keypair.secretKey), serialize, lalu submitRawTx() seperti biasa.
async function signAndSubmitAse(
  wallet: AsentumWallet,
  partial: { to: Uint8Array; value: bigint; data: Uint8Array; gasLimit: bigint; nonce?: bigint },
  gas?: AseGasOverride,
): Promise<AseSentTx> {
  const client = wallet.client;
  const chainId = await client.getChainId();
  const nonce = partial.nonce ?? await client.getNonce(wallet.address);
  const { maxFeePerGas, maxPriorityFeePerGas } = await aseFeeCap(client, gas);

  const body = {
    chainId, nonce, maxPriorityFeePerGas, maxFeePerGas,
    gasLimit: partial.gasLimit, to: partial.to, value: partial.value, data: partial.data,
  };
  const bodyBytes = (TransactionBodySchema as any).serialize(body);
  const digest = blake3(bodyBytes);
  const signature = sign(digest, (wallet as any).keypair.secretKey);
  const signedTx = { body, publicKey: (wallet as any).keypair.publicKey, signature };
  const rawTxHex = aseBytesToHex((SignedTransactionSchema as any).serialize(signedTx));

  const result = await client.submitRawTx(rawTxHex);
  if (!result.accepted) throw new Error(`transaction rejected: ${result.reason || 'unknown reason'}`);
  const txHash = result.txHash ?? '(unknown)';

  return {
    hash: txHash,
    nonce,
    async wait(timeoutMs = 15_000): Promise<any> {
      const start = Date.now();
      let lastRaw: any = null;
      while (Date.now() - start < timeoutMs) {
        try {
          const receipt = await client.getReceipt(txHash);
          lastRaw = receipt;
          if (receipt && !isReceiptPending(receipt)) return receipt;
        } catch (e: any) {
          if (!/not found|pending|unknown tx/i.test(String(e?.message ?? e))) throw e;
        }
        await new Promise(r => setTimeout(r, 1500));
      }
      let last = '';
      try { last = lastRaw ? ` — respons node terakhir: ${JSON.stringify(lastRaw, (_k, x) => typeof x === 'bigint' ? x.toString() : x).slice(0, 200)}` : ''; } catch { /* abaikan */ }
      throw new Error(`transaction ${txHash} not confirmed within ${timeoutMs}ms${last}`);
    },
  };
}

async function transferAse(wallet: AsentumWallet, toHex: string, amountWei: bigint, gasLimit: bigint = 21_000n, gas?: AseGasOverride): Promise<AseSentTx> {
  return signAndSubmitAse(wallet, { to: aseAddressBytes20(toHex), value: amountWei, data: new Uint8Array(0), gasLimit }, gas);
}

async function contractSendAse(
  wallet: AsentumWallet, contractAddressHex: string, method: string, args: unknown[] = [],
  opts: { value?: bigint; gasLimit?: bigint; gas?: AseGasOverride } = {},
): Promise<AseSentTx> {
  const data = new TextEncoder().encode(JSON.stringify({ method, args }));
  return signAndSubmitAse(wallet, {
    to: aseAddressBytes20(contractAddressHex), value: opts.value ?? 0n, data, gasLimit: opts.gasLimit ?? 2_000_000n,
  }, opts.gas);
}

async function deployAse(wallet: AsentumWallet, source: string, gasLimit?: bigint, gas?: AseGasOverride): Promise<{ address: string; deployTx: AseSentTx }> {
  const data = new TextEncoder().encode(source);
  const gasAmt = gasLimit ?? BigInt(Math.max(2_000_000, 1000 * source.length));
  const sent = await signAndSubmitAse(wallet, { to: new Uint8Array(20), value: 0n, data, gasLimit: gasAmt }, gas);

  const senderBytes = aseAddressBytes20(wallet.address);
  const nonceBytes = new Uint8Array(8);
  new DataView(nonceBytes.buffer).setBigUint64(0, sent.nonce, true);
  const combined = new Uint8Array(28);
  combined.set(senderBytes);
  combined.set(nonceBytes, 20);
  const contractAddress = aseBytesToHex(blake3(combined).slice(0, 20));

  return { address: contractAddress, deployTx: sent };
}

function parseFeeBigInt(v: string | undefined | null): bigint {
  if (!v) return 0n;
  try { return BigInt(v); } catch { return 0n; }
}

export interface AseGasPreview {
  gasLimit: string;
  maxFeePerGasWei: string;
  maxFeeWei: string;
  feeAse: number;
  isFallback: boolean;
}

export async function previewAseGasFee(net: AsentumNetworkCfg, gasLimit: bigint, gas?: AseGasOverride, rpc?: string): Promise<AseGasPreview> {
  const client = makeClient(net, rpc || net.rpcUrls[0]);
  let isFallback = true;
  try {
    const info: any = await client.getChainInfo();
    if (parseFeeBigInt(info?.latestHeader?.baseFeePerGas) > 0n) isFallback = false;
  } catch { /* isFallback tetap true */ }
  const { maxFeePerGas } = await aseFeeCap(client, gas);
  const maxFeeWei = gasLimit * maxFeePerGas;
  return {
    gasLimit: gasLimit.toString(),
    maxFeePerGasWei: maxFeePerGas.toString(),
    maxFeeWei: maxFeeWei.toString(),
    feeAse: Number(formatAse(maxFeeWei)),
    isFallback: isFallback && gas?.speed !== 'custom',
  };
}

export async function estimateAsentumFee(net: AsentumNetworkCfg, rpc?: string): Promise<AsentumFeeEstimate> {
  let lastErr: any;
  for (const r of (rpc ? [rpc] : net.rpcUrls)) {
    try {
      const client = makeClient(net, r);
      const info: any = await Promise.race([
        client.getChainInfo(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      const baseFeePerGas   = parseFeeBigInt(info?.latestHeader?.baseFeePerGas);
      const gasLimit        = ASENTUM_TRANSFER_GAS_LIMIT;
      const estimatedFeeWei = (gasLimit * baseFeePerGas * ASENTUM_FEE_SAFETY_MARGIN_NUM) / ASENTUM_FEE_SAFETY_MARGIN_DEN;
      return {
        gasLimit: gasLimit.toString(),
        baseFeePerGas: baseFeePerGas.toString(),
        estimatedFeeWei: estimatedFeeWei.toString(),
        feeAse: Number(formatAse(estimatedFeeWei)),
        isFallback: false,
      };
    } catch (e) { lastErr = e; }
  }

  const fallbackWei = parseAse(String(ASENTUM_GAS_BUFFER));
  return {
    gasLimit: ASENTUM_TRANSFER_GAS_LIMIT.toString(),
    baseFeePerGas: '0',
    estimatedFeeWei: fallbackWei.toString(),
    feeAse: ASENTUM_GAS_BUFFER,
    isFallback: true,
  };
}

export async function sendAsentum(net: AsentumNetworkCfg, privateKey: string, to: string, amountAse: number): Promise<string> {
  if (!isValidAsentumAddress(to)) {
    throw new Error('Address Asentum tujuan tidak valid.');
  }
  if (!(amountAse > 0)) {
    throw new Error('Jumlah ASE yang dikirim harus lebih dari 0.');
  }
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const wallet = asentumWalletFromPrivateKey(net, privateKey, rpc);
      const sent   = await transferAse(wallet, toAsentumHex(to), parseAse(String(amountAse)));
      await sent.wait();
      return sent.hash;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Gagal mengirim transaksi ke ${net.name}. Cek koneksi / RPC.`);
}

export function aseFriendlyError(e: any): string {
  const msg = e?.message || String(e);
  if (/insufficient.*balance/i.test(msg)) return 'Saldo ASE tidak cukup untuk jumlah + gas.';
  if (/invalid.*address/i.test(msg)) return 'Address tujuan tidak valid.';
  if (/format private key/i.test(msg)) return msg;
  if (/failed to fetch|networkerror|load failed|cors/i.test(msg)) return 'Faucet tidak bisa dijangkau dari browser (kemungkinan diblokir CORS oleh airdrop.asentum.com). Minta lewat dashboard https://airdrop.asentum.com atau Telegram wallet, atau lewatkan lewat proxy backend.';
  if (/unauthorized/i.test(msg)) return 'Faucet menolak request (unauthorized) — endpoint dashboard mungkin butuh login/sesi. Minta manual lewat https://airdrop.asentum.com atau Telegram wallet.';
  if (/rate.?limit|cooldown|already.*(funded|requested|claimed)|429/i.test(msg)) return 'Faucet lagi dibatasi (rate limit / cooldown) untuk address ini — coba lagi nanti.';
  if (/method not found|-32601/i.test(msg)) return 'Faucet tidak tersedia di RPC/versi SDK ini — cek versi @asentum/sdk atau minta manual lewat dokumentasi Asentum.';
  if (/timeout|halted|frozen/i.test(msg)) return 'Testnet Asentum sedang tidak responsif (chain dilaporkan sempat macet) — coba lagi nanti.';
  return msg || 'Gagal mengirim transaksi ASE.';
}

async function getAsentumBalanceRaw(net: AsentumNetworkCfg, address: string): Promise<{ raw: bigint; rpc: string }> {
  let lastErr: any;
  for (const rpc of net.rpcUrls) {
    try {
      const client = makeClient(net, rpc);
      const bal = await Promise.race([
        client.getBalance(toAsentumHex(address)),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      return { raw: BigInt(bal.balance as any), rpc };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`Tidak dapat connect ke ${net.name}. Cek koneksi / RPC.`);
}

export interface AsentumSweepOpts {
  amountMode: 'all' | 'fixed';
  fixedAse?: string;
  leaveAse?: string;
  feeWei: bigint;
}

export interface AsentumSweepResult {
  status: 'success' | 'skipped' | 'failed';
  hash?: string;
  sentAse?: string;
  balanceAse?: string;
  message?: string;
}

export async function sweepAsentumWallet(
  net: AsentumNetworkCfg,
  privateKey: string,
  to: string,
  opts: AsentumSweepOpts,
): Promise<AsentumSweepResult> {
  if (!isValidAsentumAddress(to)) throw new Error('Address Asentum tujuan tidak valid.');

  const from = asentumAddressFromPrivateKey(net, privateKey);
  if (toAsentumHex(from).toLowerCase() === toAsentumHex(to).toLowerCase()) {
    return { status: 'skipped', message: 'Wallet sumber sama dengan address tujuan' };
  }

  const { raw: balance, rpc } = await getAsentumBalanceRaw(net, from);
  const balanceAse = formatAse(balance);

  let amount: bigint;
  if (opts.amountMode === 'all') {
    const leave = opts.leaveAse && Number(opts.leaveAse) > 0 ? BigInt(parseAse(opts.leaveAse) as any) : 0n;
    amount = balance - opts.feeWei - leave;
  } else {
    amount = BigInt(parseAse(opts.fixedAse || '0') as any);
    if (amount > 0n && amount + opts.feeWei > balance) {
      return { status: 'skipped', balanceAse, message: `Saldo ${balanceAse} ASE tidak cukup untuk jumlah + fee` };
    }
  }
  if (amount <= 0n) {
    return { status: 'skipped', balanceAse, message: `Saldo ${balanceAse} ASE tidak cukup untuk menutup fee` };
  }

  const wallet = asentumWalletFromPrivateKey(net, privateKey, rpc);
  const sent   = await transferAse(wallet, toAsentumHex(to), amount);
  await sent.wait();
  return { status: 'success', hash: sent.hash, sentAse: String(formatAse(amount as any)), balanceAse };
}

export interface AsentumTokenParams {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  mintable: boolean;
  burnable: boolean;
}

export interface AsentumTokenInfo {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupplyRaw: string | null;
  totalSupply: string | null;
  ownerBalance: string | null;
}

export type AsentumTokenStage = 'validate' | 'deploy' | 'init' | 'verify';

export interface AsentumTokenDeployResult {
  contractAddress: string;
  ownerHex: string;
  ownerAddress: string;
  deployTxHash: string;
  initTxHash: string;
  info: AsentumTokenInfo | null;
  verifyWarning?: string;
}

export interface AsentumTokenFeeEstimate {
  deployGasLimit: string;
  initGasLimit: string;
  baseFeePerGas: string;
  maxFeeWei: string;
  feeAse: number;
  isFallback: boolean;
}

const ASE_ZERO_ADDRESS   = '0x' + '0'.repeat(40);
const ASE_INIT_GAS_LIMIT = 2_000_000n;
const ASE_CONFIRM_MS     = 60_000;

export interface AsentumTokenError extends Error {
  stage: AsentumTokenStage;
  contractAddress?: string;
  deployTxHash?: string;
}
function tokenErr(stage: AsentumTokenStage, cause: any, ctx: { contractAddress?: string; deployTxHash?: string } = {}): AsentumTokenError {
  const e = new Error(cause?.message || String(cause)) as AsentumTokenError;
  e.stage = stage;
  e.contractAddress = ctx.contractAddress;
  e.deployTxHash = ctx.deployTxHash;
  return e;
}

export function asentumUnitsFromDecimalString(value: string, decimals: number): bigint {
  const s = (value || '').trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('Total supply harus berupa angka positif (contoh: 1000000 atau 1000.5).');
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) {
    throw new Error(`Total supply punya ${frac.length} angka desimal, melebihi decimals token (${decimals}).`);
  }
  return BigInt(whole + frac.padEnd(decimals, '0'));
}

export function asentumFormatUnits(raw: string | bigint, decimals: number): string {
  const v = typeof raw === 'bigint' ? raw : BigInt(raw);
  if (decimals <= 0) return v.toString();
  const base  = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac  = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export interface ValidatedAsentumToken extends AsentumTokenParams {
  units: bigint;
}

export function validateAsentumTokenParams(p: AsentumTokenParams): ValidatedAsentumToken {
  const name   = (p.name || '').trim();
  const symbol = (p.symbol || '').trim().toUpperCase();
  if (!name || name.length > 50) throw new Error('Nama token wajib diisi (maks. 50 karakter).');
  if (/[\u0000-\u001f\u007f\u2028\u2029]/.test(name)) throw new Error('Nama token tidak boleh mengandung karakter kontrol / baris baru.');
  if (!/^[A-Z0-9]{1,11}$/.test(symbol)) throw new Error('Symbol harus 1–11 karakter huruf/angka (tanpa spasi atau simbol).');
  if (!Number.isInteger(p.decimals) || p.decimals < 0 || p.decimals > 18) throw new Error('Decimals harus bilangan bulat 0–18.');
  const units = asentumUnitsFromDecimalString(p.initialSupply, p.decimals);
  if (units <= 0n) throw new Error('Total supply harus lebih dari 0.');
  if (units.toString().length > 60) throw new Error('Total supply terlalu besar.');
  return { ...p, name, symbol, units };
}

export function buildAsentumTokenSource(ownerHex: string, opts: { mintable: boolean; burnable: boolean }): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(ownerHex)) throw new Error('Address owner tidak valid untuk template token.');
  const owner40 = ownerHex.toLowerCase().slice(2);
  const ZERO = ASE_ZERO_ADDRESS;

  const L: string[] = [
    '// ARC-20 fungible token — created via ErdropManager Token Creator',
    '',
    "const BAL = 'bal:';",
    "const ALLOW = 'allow:';",
    '',
    'function lc(a) { return String(a).toLowerCase(); }',
    'function tail40(a) { const x = lc(a); return x.slice(x.length - 40); }',
    '',
    '({',
    '  init(args) {',
    "    assert(!storage.get('initialized'), 'already initialised');",
    `    assert(tail40(msg.sender) === '${owner40}', 'only the deployer can initialize (sender=' + lc(msg.sender) + ')');`,
    '    const name = String((args && args.name) || "");',
    '    const symbol = String((args && args.symbol) || "");',
    '    const dec = Number(args && args.decimals);',
    "    assert(name.length > 0 && symbol.length > 0, 'name and symbol are required');",
    "    assert(dec >= 0 && dec <= 18 && dec === Math.floor(dec), 'decimals must be an integer 0-18');",
    '    const supply = BigInt((args && args.supply) || "0");',
    "    assert(supply >= 0n, 'initial supply cannot be negative');",
    '    const owner = lc(msg.sender);',
    "    storage.set('initialized', 'true');",
    "    storage.set('owner', owner);",
    "    storage.set('name', name);",
    "    storage.set('symbol', symbol);",
    "    storage.set('decimals', String(dec));",
    "    storage.set('totalSupply', supply.toString());",
    "    storage.set(BAL + owner, supply.toString());",
    `    emit('Transfer', { from: '${ZERO}', to: owner, value: supply.toString() });`,
    '    return true;',
    '  },',
    '',
    '  transfer(to, amount) {',
    '    const from = lc(msg.sender);',
    '    const toStr = lc(to);',
    '    const amt = BigInt(amount);',
    "    assert(amt > 0n, 'amount must be positive');",
    "    const fb = BigInt(storage.get(BAL + from) || '0');",
    "    assert(fb >= amt, 'insufficient balance');",
    "    storage.set(BAL + from, (fb - amt).toString());",
    "    storage.set(BAL + toStr, (BigInt(storage.get(BAL + toStr) || '0') + amt).toString());",
    "    emit('Transfer', { from, to: toStr, value: amt.toString() });",
    '    return true;',
    '  },',
    '',
    '  approve(spender, amount) {',
    '    const owner = lc(msg.sender);',
    "    storage.set(ALLOW + owner + ':' + lc(spender), BigInt(amount).toString());",
    "    emit('Approval', { owner, spender: lc(spender), value: BigInt(amount).toString() });",
    '    return true;',
    '  },',
    '',
    '  transferFrom(from, to, amount) {',
    '    const f = lc(from);',
    '    const toStr = lc(to);',
    '    const spender = lc(msg.sender);',
    '    const amt = BigInt(amount);',
    "    assert(amt > 0n, 'amount must be positive');",
    "    const allowed = BigInt(storage.get(ALLOW + f + ':' + spender) || '0');",
    "    assert(allowed >= amt, 'insufficient allowance');",
    "    const fb = BigInt(storage.get(BAL + f) || '0');",
    "    assert(fb >= amt, 'insufficient balance');",
    "    storage.set(ALLOW + f + ':' + spender, (allowed - amt).toString());",
    "    storage.set(BAL + f, (fb - amt).toString());",
    "    storage.set(BAL + toStr, (BigInt(storage.get(BAL + toStr) || '0') + amt).toString());",
    "    emit('Transfer', { from: f, to: toStr, value: amt.toString() });",
    '    return true;',
    '  },',
    '',
  ];

  if (opts.mintable) {
    L.push(
      '  mint(to, amount) {',
      "    assert(lc(msg.sender) === storage.get('owner'), 'only owner can mint');",
      '    const dest = lc(to);',
      '    const amt = BigInt(amount);',
      "    assert(amt > 0n, 'amount must be positive');",
      "    storage.set(BAL + dest, (BigInt(storage.get(BAL + dest) || '0') + amt).toString());",
      "    storage.set('totalSupply', (BigInt(storage.get('totalSupply') || '0') + amt).toString());",
      `    emit('Transfer', { from: '${ZERO}', to: dest, value: amt.toString() });`,
      '    return true;',
      '  },',
      '',
    );
  }

  if (opts.burnable) {
    L.push(
      '  burn(amount) {',
      '    const sender = lc(msg.sender);',
      '    const amt = BigInt(amount);',
      "    assert(amt > 0n, 'amount must be positive');",
      "    const bal = BigInt(storage.get(BAL + sender) || '0');",
      "    assert(bal >= amt, 'insufficient balance');",
      "    storage.set(BAL + sender, (bal - amt).toString());",
      "    storage.set('totalSupply', (BigInt(storage.get('totalSupply') || '0') - amt).toString());",
      `    emit('Transfer', { from: sender, to: '${ZERO}', value: amt.toString() });`,
      '    return true;',
      '  },',
      '',
    );
  }

  L.push(
    '  balanceOf(a) { return storage.get(BAL + lc(a)) || "0"; },',
    '  allowance(o, s) { return storage.get(ALLOW + lc(o) + ":" + lc(s)) || "0"; },',
    '  name() { return storage.get("name"); },',
    '  symbol() { return storage.get("symbol"); },',
    '  decimals() { return storage.get("decimals") || "18"; },',
    '  totalSupply() { return storage.get("totalSupply") || "0"; },',
    '  owner() { return storage.get("owner"); },',
    '});',
    '',
  );
  return L.join('\n');
}

async function pickHealthyAsentumRpc(net: AsentumNetworkCfg): Promise<string> {
  for (const rpc of net.rpcUrls) {
    try {
      const ok = await Promise.race([
        makeClient(net, rpc).isHealthy(),
        new Promise<boolean>(r => setTimeout(() => r(false), 6000)),
      ]);
      if (ok) return rpc;
    } catch {}
  }
  return net.rpcUrls[0];
}

function receiptFailureDetail(receipt: any): string {
  const ser = (v: unknown) => typeof v === 'string' ? v : JSON.stringify(v, (_k, x) => typeof x === 'bigint' ? x.toString() : x);
  for (const k of ['returnValue', 'error', 'revertReason', 'reason', 'message', 'revert', 'result']) {
    const v = receipt?.[k];
    if (v != null && v !== '') return ` — ${ser(v).slice(0, 300)}`;
  }
  try { return ` — receipt: ${ser(receipt).slice(0, 300)}`; } catch { return ''; }
}

async function waitAsentumReceipt(sent: { hash: string; wait(ms?: number): Promise<any> }, label: string): Promise<any> {
  const receipt = await sent.wait(ASE_CONFIRM_MS);
  if (receipt && receipt.success === false && !isReceiptPending(receipt)) {
    throw new Error(`${label} gagal on-chain${receiptFailureDetail(receipt)} (tx ${sent.hash})`);
  }
  return receipt;
}

function extractDeployedAddressFromReceipt(receipt: any): string | null {
  if (!receipt) return null;
  const candidates = [receipt.recipient, receipt.contractAddress, receipt.contract, receipt.createdAddress, receipt.address, receipt.to];
  for (const c of candidates) {
    if (typeof c === 'string' && /^0x[0-9a-fA-F]{40}$/.test(c)) return c;
  }
  return null;
}

export async function readAsentumToken(net: AsentumNetworkCfg, contractAddress: string, holderHex?: string, rpc?: string): Promise<AsentumTokenInfo> {
  const client   = makeClient(net, rpc || net.rpcUrls[0]);
  const contract = new AsentumContract(client, toAsentumHex(contractAddress));
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | null> => { try { return await fn(); } catch { return null; } };

  const [name, symbol, decimalsRaw, supplyRaw, balRaw] = await Promise.all([
    safe(() => contract.view('name')),
    safe(() => contract.view('symbol')),
    safe(() => contract.view('decimals')),
    safe(() => contract.view('totalSupply')),
    holderHex ? safe(() => contract.view('balanceOf', [holderHex])) : Promise.resolve(null),
  ]);
  const decimals = decimalsRaw == null ? null : Number(decimalsRaw);
  const decOk = decimals != null && !Number.isNaN(decimals);
  const fmt = (v: unknown) => (v == null || !decOk) ? null : asentumFormatUnits(String(v), decimals as number);
  return {
    name: name == null ? null : String(name),
    symbol: symbol == null ? null : String(symbol),
    decimals: decOk ? decimals : null,
    totalSupplyRaw: supplyRaw == null ? null : String(supplyRaw),
    totalSupply: fmt(supplyRaw),
    ownerBalance: fmt(balRaw),
  };
}

export const ASE_ARC20_SEND_GAS_LIMIT = 2_000_000n;

export interface AsentumArc20GasCheck {
  gasLimit: string;
  baseFeePerGas: string;
  maxFeePerGasWei: string;
  maxFeeWei: string;
  feeAse: string;
  balanceWei: string;
  balanceAse: string;
  hasAnyBalance: boolean;
  enough: boolean;
  isFallback: boolean;
}

export async function checkArc20SendGas(net: AsentumNetworkCfg, holderAddress: string): Promise<AsentumArc20GasCheck> {
  const { raw: balance, rpc } = await getAsentumBalanceRaw(net, holderAddress);

  let baseFee = 0n;
  try {
    const info: any = await Promise.race([
      makeClient(net, rpc).getChainInfo(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    baseFee = parseFeeBigInt(info?.latestHeader?.baseFeePerGas);
  } catch {}

  const isFallback   = !(baseFee > 0n);
  const maxFeePerGas = isFallback
    ? 1_000_000_000n
    : (baseFee * ASENTUM_FEE_SAFETY_MARGIN_NUM) / ASENTUM_FEE_SAFETY_MARGIN_DEN;
  const maxFeeWei    = ASE_ARC20_SEND_GAS_LIMIT * maxFeePerGas;

  return {
    gasLimit: ASE_ARC20_SEND_GAS_LIMIT.toString(),
    baseFeePerGas: baseFee.toString(),
    maxFeePerGasWei: maxFeePerGas.toString(),
    maxFeeWei: maxFeeWei.toString(),
    feeAse: String(formatAse(maxFeeWei)),
    balanceWei: balance.toString(),
    balanceAse: String(formatAse(balance)),
    hasAnyBalance: balance > 0n,
    enough: balance >= maxFeeWei,
    isFallback,
  };
}

export async function sendArc20Token(
  net: AsentumNetworkCfg, privateKey: string, contractAddress: string,
  to: string, amountHuman: string, decimals: number,
): Promise<string> {
  if (!isValidAsentumAddress(to)) throw new Error('Address tujuan tidak valid.');
  const units = asentumUnitsFromDecimalString(amountHuman, decimals);
  if (units <= 0n) throw new Error('Jumlah token harus lebih dari 0.');

  const rpc     = await pickHealthyAsentumRpc(net);
  const wallet  = asentumWalletFromPrivateKey(net, privateKey, rpc);
  const hexAddr = toAsentumHex(contractAddress);
  const toHex   = toAsentumHex(to);

  const tx = await contractSendAse(wallet, hexAddr, 'transfer', [toHex, units.toString()], { gasLimit: ASE_ARC20_SEND_GAS_LIMIT });
  await waitAsentumReceipt(tx, 'Kirim token ARC-20');
  return tx.hash;
}

export async function estimateAsentumTokenDeployFee(
  net: AsentumNetworkCfg,
  opts: { mintable: boolean; burnable: boolean },
  rpc?: string,
): Promise<AsentumTokenFeeEstimate> {
  const sourceLen = buildAsentumTokenSource(ASE_ZERO_ADDRESS, opts).length;
  const deployGas = BigInt(Math.max(2e6, 1e3 * sourceLen));
  const totalGas  = deployGas + ASE_INIT_GAS_LIMIT;

  for (const r of (rpc ? [rpc] : net.rpcUrls)) {
    try {
      const info: any = await Promise.race([
        makeClient(net, r).getChainInfo(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      const baseFee = parseFeeBigInt(info?.latestHeader?.baseFeePerGas);
      const maxWei  = (totalGas * baseFee * ASENTUM_FEE_SAFETY_MARGIN_NUM) / ASENTUM_FEE_SAFETY_MARGIN_DEN;
      return {
        deployGasLimit: deployGas.toString(), initGasLimit: ASE_INIT_GAS_LIMIT.toString(),
        baseFeePerGas: baseFee.toString(), maxFeeWei: maxWei.toString(),
        feeAse: Number(formatAse(maxWei)), isFallback: false,
      };
    } catch {}
  }
  return {
    deployGasLimit: deployGas.toString(), initGasLimit: ASE_INIT_GAS_LIMIT.toString(),
    baseFeePerGas: '0', maxFeeWei: parseAse(String(ASENTUM_GAS_BUFFER)).toString(),
    feeAse: ASENTUM_GAS_BUFFER, isFallback: true,
  };
}

function hex40(a: string): string {
  return String(a || '').trim().toLowerCase().replace(/^0x/, '');
}
function sourceHasOwner(source: string | null | undefined, walletHex: string): boolean {
  return !!source && source.toLowerCase().includes(hex40(walletHex));
}
function extractBakedOwner(source: string | null | undefined): string | null {
  const m = (source || '').match(/===\s*'(?:0x)?([0-9a-fA-F]{40})'/);
  return m ? '0x' + m[1].toLowerCase() : null;
}
function notDeployerMessage(source: string | null | undefined, walletHex: string): string {
  const baked = extractBakedOwner(source);
  return baked
    ? `Private key ini (${walletHex}) bukan deployer kontrak tersebut. Deployer aslinya: ${baked} — pakai private key wallet itu.`
    : 'Private key ini bukan deployer kontrak tersebut — init() hanya bisa dipanggil deployer aslinya.';
}

async function initAndVerify(
  net: AsentumNetworkCfg, wallet: AsentumWallet, contractAddress: string,
  v: ValidatedAsentumToken, rpc: string, deployTxHash: string,
  onProgress?: (msg: string) => void,
): Promise<AsentumTokenDeployResult> {
  let contractSource = '';
  try {
    const client = makeClient(net, rpc);
    const source = await client.getContractSource(contractAddress);
    contractSource = source || '';
    if (!sourceHasOwner(source, wallet.address)) {
      throw new Error(`Address kontrak (${contractAddress}) tidak membawa owner hex kita — kemungkinan address hasil deploy salah baca. Cek deploy tx ${deployTxHash} di explorer untuk address kontrak yang benar, lalu pakai "Selesaikan Inisialisasi" dengan address itu.`);
    }
  } catch (e: any) {
    throw tokenErr('deploy', e, { contractAddress, deployTxHash });
  }

  onProgress?.('Kontrak terkonfirmasi. Mengirim init() — set nama, symbol & mint supply awal...');
  let initTxHash = '';
  try {
    const objectStyle = /init\s*\(\s*args\s*\)/.test(contractSource);
    const initArgs: unknown[] = objectStyle
      ? [{ name: v.name, symbol: v.symbol, decimals: v.decimals, supply: v.units.toString() }]
      : [v.name, v.symbol, String(v.decimals), v.units.toString()];
    const tx = await contractSendAse(wallet, contractAddress, 'init', initArgs);
    initTxHash = tx.hash;
    try {
      await waitAsentumReceipt(tx, 'init()');
    } catch (waitErr: any) {
      const isTimeout = /not confirmed within|not found|pending/i.test(String(waitErr?.message ?? ''));
      let landed = false;
      if (isTimeout) {
        for (let i = 0; i < 6 && !landed; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try { landed = (await readAsentumToken(net, contractAddress, wallet.address, rpc)).name === v.name; } catch { /* retry */ }
        }
      }
      if (!landed) throw waitErr;
    }
  } catch (e: any) {
    throw tokenErr('init', e, { contractAddress, deployTxHash });
  }

  onProgress?.('Memverifikasi token langsung dari chain...');
  let info: AsentumTokenInfo | null = null;
  let verifyWarning: string | undefined;
  try {
    info = await readAsentumToken(net, contractAddress, wallet.address, rpc);
    const bad: string[] = [];
    if (info.name !== v.name) bad.push('name');
    if (info.symbol !== v.symbol) bad.push('symbol');
    if (info.decimals !== v.decimals) bad.push('decimals');
    if (info.totalSupplyRaw !== v.units.toString()) bad.push('totalSupply');
    if (bad.length) verifyWarning = `Verifikasi on-chain tidak cocok untuk: ${bad.join(', ')}. Cek kontrak di explorer.`;
  } catch {
    verifyWarning = 'Token terkirim tapi verifikasi on-chain gagal dibaca (RPC lambat?). Cek kontrak di explorer.';
  }
  return {
    contractAddress, ownerHex: wallet.address, ownerAddress: hexToAsentumBech32(wallet.address),
    deployTxHash, initTxHash, info, verifyWarning,
  };
}

export async function deployAsentumToken(
  net: AsentumNetworkCfg, privateKey: string, params: AsentumTokenParams,
  onProgress?: (msg: string) => void,
): Promise<AsentumTokenDeployResult> {
  let v: ValidatedAsentumToken;
  try { v = validateAsentumTokenParams(params); } catch (e) { throw tokenErr('validate', e); }

  const rpc    = await pickHealthyAsentumRpc(net);
  const wallet = asentumWalletFromPrivateKey(net, privateKey, rpc);
  const source = buildAsentumTokenSource(wallet.address, v);

  onProgress?.(`Deploy kontrak token ke ${net.name}...`);
  let deployed: { address: string; deployTx: { hash: string; wait(ms?: number): Promise<any> } };
  try { deployed = await deployAse(wallet, source); } catch (e) { throw tokenErr('deploy', e); }
  const deployTxHash = deployed.deployTx.hash || '';

  let contractAddress = deployed.address;
  try {
    const receipt = await waitAsentumReceipt(deployed.deployTx, 'Deploy kontrak');
    const realAddr = extractDeployedAddressFromReceipt(receipt);
    if (realAddr && realAddr.toLowerCase() !== contractAddress.toLowerCase()) {
      console.warn('[Asentum] Address kontrak hasil prediksi client-side beda dari receipt on-chain:', contractAddress, '→', realAddr, '(pakai yang dari receipt)');
      contractAddress = realAddr;
    }
  } catch (e: any) {
    if (/not confirmed within|not found|pending/i.test(String(e?.message ?? ''))) {
      for (let i = 0; i < 6; i++) {
        try {
          const src = await makeClient(net, rpc).getContractSource(contractAddress);
          if (sourceHasOwner(src, wallet.address)) {
            return initAndVerify(net, wallet, contractAddress, v, rpc, deployTxHash, onProgress);
          }
        } catch {}
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    throw tokenErr('deploy', e, { contractAddress, deployTxHash });
  }
  return initAndVerify(net, wallet, contractAddress, v, rpc, deployTxHash, onProgress);
}

export async function finishAsentumTokenInit(
  net: AsentumNetworkCfg, privateKey: string, contractAddress: string, params: AsentumTokenParams,
  deployTxHash = '', onProgress?: (msg: string) => void,
): Promise<AsentumTokenDeployResult> {
  let v: ValidatedAsentumToken;
  try { v = validateAsentumTokenParams(params); } catch (e) { throw tokenErr('validate', e); }

  const rpc     = await pickHealthyAsentumRpc(net);
  const wallet  = asentumWalletFromPrivateKey(net, privateKey, rpc);
  const client  = makeClient(net, rpc);
  const hexAddr = toAsentumHex(contractAddress);

  const source = await client.getContractSource(hexAddr).catch(() => null);
  if (!source) {
    throw tokenErr('init', new Error('Kontrak belum ada di chain (deploy belum terkonfirmasi atau gagal). Cek tx deploy di explorer, lalu coba lagi.'), { contractAddress: hexAddr, deployTxHash });
  }
  if (!sourceHasOwner(source, wallet.address)) {
    throw tokenErr('init', new Error(notDeployerMessage(source, wallet.address)), { contractAddress: hexAddr, deployTxHash });
  }

  const existing = await readAsentumToken(net, hexAddr, wallet.address, rpc);
  if (existing.name != null) {
    return {
      contractAddress: hexAddr, ownerHex: wallet.address, ownerAddress: hexToAsentumBech32(wallet.address),
      deployTxHash, initTxHash: '', info: existing,
      verifyWarning: 'Token sudah ter-init sebelumnya — tidak ada transaksi baru yang dikirim.',
    };
  }
  return initAndVerify(net, wallet, hexAddr, v, rpc, deployTxHash, onProgress);
}

export const AURA_SWAP_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export function isAuraSwapNative(token: string): boolean {
  return (token || '').trim().toLowerCase() === AURA_SWAP_NATIVE;
}

export interface AuraSwapPool {
  id: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  totalShares: string;
  feeBps: string;
  price0Cumulative: string;
  price1Cumulative: string;
  lastTs: string;
}

function auraSwapContract(net: AsentumNetworkCfg, poolAddress: string, rpc?: string): AsentumContract {
  return new AsentumContract(makeClient(net, rpc), toAsentumHex(poolAddress));
}

export async function findAuraSwapPoolId(
  net: AsentumNetworkCfg, poolAddress: string, tokenA: string, tokenB: string, rpc?: string,
): Promise<string | null> {
  const contract = auraSwapContract(net, poolAddress, rpc);
  const id = await contract.view('poolForPair', [toAsentumHex(tokenA), toAsentumHex(tokenB)]);
  return id == null ? null : String(id);
}

export async function readAuraSwapPool(
  net: AsentumNetworkCfg, poolAddress: string, poolId: string, rpc?: string,
): Promise<AuraSwapPool> {
  const contract = auraSwapContract(net, poolAddress, rpc);
  const raw = await contract.view('getPool', [poolId]);
  if (!raw) throw new Error(`Pool #${poolId} tidak ditemukan di kontrak ${poolAddress}.`);
  return JSON.parse(String(raw));
}

export async function getAuraSwapQuote(
  net: AsentumNetworkCfg, poolAddress: string, poolId: string, tokenIn: string, amountInRaw: string, rpc?: string,
): Promise<string> {
  const contract = auraSwapContract(net, poolAddress, rpc);
  const out = await contract.view('quote', [poolId, toAsentumHex(tokenIn), amountInRaw]);
  return String(out ?? '0');
}

export async function getAuraSwapAllowance(
  net: AsentumNetworkCfg, tokenAddress: string, ownerAddress: string, poolAddress: string, rpc?: string,
): Promise<bigint> {
  if (isAuraSwapNative(tokenAddress)) return 2n ** 256n - 1n;
  const contract = new AsentumContract(makeClient(net, rpc), toAsentumHex(tokenAddress));
  const raw = await contract.view('allowance', [toAsentumHex(ownerAddress), toAsentumHex(poolAddress)]);
  return BigInt(String(raw ?? '0'));
}

export interface AuraSwapExecResult {
  approveTxHash?: string;
  swapTxHash: string;
}

export const AURA_SWAP_GAS_LIMIT = 4_000_000n;

export async function executeAuraSwap(
  net: AsentumNetworkCfg, privateKey: string, poolAddress: string, poolId: string,
  tokenIn: string, amountInRaw: string, minOutRaw: string,
  onProgress?: (msg: string) => void, gas?: AseGasOverride,
): Promise<AuraSwapExecResult> {
  if (!(BigInt(amountInRaw) > 0n)) throw new Error('Jumlah yang mau di-swap harus lebih dari 0.');

  const rpc     = await pickHealthyAsentumRpc(net);
  const wallet  = asentumWalletFromPrivateKey(net, privateKey, rpc);
  const poolHex = toAsentumHex(poolAddress);
  const native  = isAuraSwapNative(tokenIn);

  let approveTxHash: string | undefined;
  if (!native) {
    const allowed = await getAuraSwapAllowance(net, tokenIn, wallet.address, poolAddress, rpc);
    if (allowed < BigInt(amountInRaw)) {
      onProgress?.('Mengirim approve() ARC-20 ke kontrak AuraSwap...');
      const approveTx = await contractSendAse(wallet, toAsentumHex(tokenIn), 'approve', [poolHex, amountInRaw], { gasLimit: ASE_ARC20_SEND_GAS_LIMIT, gas });
      await waitAsentumReceipt(approveTx, 'approve() ARC-20');
      approveTxHash = approveTx.hash;
    }
  }

  onProgress?.('Mengirim swapExactIn()...');
  const swapTx = await contractSendAse(
    wallet, poolHex, 'swapExactIn', [poolId, toAsentumHex(tokenIn), amountInRaw, minOutRaw],
    { value: native ? BigInt(amountInRaw) : 0n, gasLimit: AURA_SWAP_GAS_LIMIT, gas },
  );
  await waitAsentumReceipt(swapTx, 'Swap AuraSwap');

  return { approveTxHash, swapTxHash: swapTx.hash };
}

export async function getAuraSwapShares(
  net: AsentumNetworkCfg, poolAddress: string, poolId: string, ownerAddress: string, rpc?: string,
): Promise<string> {
  const contract = auraSwapContract(net, poolAddress, rpc);
  const raw = await contract.view('sharesOf', [poolId, toAsentumHex(ownerAddress)]);
  return String(raw ?? '0');
}

export interface AuraSwapCreatePoolResult {
  poolId: string;
  txHash: string;
}

export async function createAuraSwapPool(
  net: AsentumNetworkCfg, privateKey: string, poolAddress: string,
  token0: string, token1: string, feeBps?: number,
  onProgress?: (msg: string) => void, gas?: AseGasOverride,
): Promise<AuraSwapCreatePoolResult> {
  if (isAuraSwapNative(token0) && isAuraSwapNative(token1)) throw new Error('token0 dan token1 tidak boleh sama-sama native ASE.');
  const rpc     = await pickHealthyAsentumRpc(net);
  const wallet  = asentumWalletFromPrivateKey(net, privateKey, rpc);
  const poolHex = toAsentumHex(poolAddress);

  onProgress?.('Mengirim createPool()...');
  const tx = await contractSendAse(
    wallet, poolHex, 'createPool', [toAsentumHex(token0), toAsentumHex(token1), feeBps ?? 30],
    { gasLimit: 2_500_000n, gas },
  );
  await waitAsentumReceipt(tx, 'createPool() AuraSwap');

  let poolId: string | null = null;
  for (let i = 0; i < 6 && !poolId; i++) {
    poolId = await findAuraSwapPoolId(net, poolAddress, token0, token1, rpc).catch(() => null);
    if (!poolId) await new Promise(r => setTimeout(r, 2000));
  }
  if (!poolId) throw new Error(`Pool terkirim (tx ${tx.hash}) tapi poolId belum terbaca dari kontrak — cek tx di explorer, mungkin cuma RPC lambat mengindex.`);
  return { poolId, txHash: tx.hash };
}

export interface AuraSwapAddLiquidityResult {
  approveTxHashes: string[];
  txHash: string;
}

export async function addAuraSwapLiquidity(
  net: AsentumNetworkCfg, privateKey: string, poolAddress: string, poolId: string,
  token0: string, amount0Raw: string, token1: string, amount1Raw: string,
  onProgress?: (msg: string) => void, gas?: AseGasOverride,
): Promise<AuraSwapAddLiquidityResult> {
  if (!(BigInt(amount0Raw) > 0n) || !(BigInt(amount1Raw) > 0n)) throw new Error('Jumlah kedua sisi harus lebih dari 0.');

  const rpc     = await pickHealthyAsentumRpc(net);
  const wallet  = asentumWalletFromPrivateKey(net, privateKey, rpc);
  const poolHex = toAsentumHex(poolAddress);

  const approveTxHashes: string[] = [];
  let nativeValue = 0n;

  const ensureSide = async (token: string, amountRaw: string) => {
    if (isAuraSwapNative(token)) { nativeValue += BigInt(amountRaw); return; }
    const allowed = await getAuraSwapAllowance(net, token, wallet.address, poolAddress, rpc);
    if (allowed < BigInt(amountRaw)) {
      onProgress?.('Mengirim approve() ARC-20 ke kontrak AuraSwap...');
      const tx = await contractSendAse(wallet, toAsentumHex(token), 'approve', [poolHex, amountRaw], { gasLimit: ASE_ARC20_SEND_GAS_LIMIT, gas });
      await waitAsentumReceipt(tx, 'approve() ARC-20');
      approveTxHashes.push(tx.hash);
    }
  };
  await ensureSide(token0, amount0Raw);
  await ensureSide(token1, amount1Raw);

  onProgress?.('Mengirim addLiquidity()...');
  const tx = await contractSendAse(
    wallet, poolHex, 'addLiquidity', [poolId, amount0Raw, amount1Raw],
    { value: nativeValue, gasLimit: AURA_SWAP_GAS_LIMIT, gas },
  );
  await waitAsentumReceipt(tx, 'Tambah Likuiditas AuraSwap');
  return { approveTxHashes, txHash: tx.hash };
}

export interface AuraSwapRemoveLiquidityResult {
  txHash: string;
}

export async function removeAuraSwapLiquidity(
  net: AsentumNetworkCfg, privateKey: string, poolAddress: string, poolId: string, sharesRaw: string,
  onProgress?: (msg: string) => void, gas?: AseGasOverride,
): Promise<AuraSwapRemoveLiquidityResult> {
  if (!(BigInt(sharesRaw) > 0n)) throw new Error('Jumlah LP share harus lebih dari 0.');
  const rpc    = await pickHealthyAsentumRpc(net);
  const wallet = asentumWalletFromPrivateKey(net, privateKey, rpc);

  onProgress?.('Mengirim removeLiquidity()...');
  const tx = await contractSendAse(wallet, toAsentumHex(poolAddress), 'removeLiquidity', [poolId, sharesRaw], { gasLimit: AURA_SWAP_GAS_LIMIT, gas });
  await waitAsentumReceipt(tx, 'Tarik Likuiditas AuraSwap');
  return { txHash: tx.hash };
}

const AURA_SWAP_SCAN_BATCH = 25;

export async function listAuraSwapPools(
  net: AsentumNetworkCfg, poolAddress: string, opts?: { maxPools?: number; rpc?: string },
): Promise<AuraSwapPool[]> {
  const rpc = opts?.rpc || await pickHealthyAsentumRpc(net);
  const max = opts?.maxPools ?? 300;
  const contract = auraSwapContract(net, poolAddress, rpc);
  const pools: AuraSwapPool[] = [];

  for (let start = 1; start <= max; start += AURA_SWAP_SCAN_BATCH) {
    const end = Math.min(start + AURA_SWAP_SCAN_BATCH - 1, max);
    const batchIds: number[] = [];
    for (let id = start; id <= end; id++) batchIds.push(id);

    const batchResults = await Promise.all(
      batchIds.map(id => contract.view('getPool', [String(id)]).catch(() => null)),
    );

    let hitGap = false;
    for (const raw of batchResults) {
      if (!raw) { hitGap = true; break; }
      try { pools.push(JSON.parse(String(raw))); }
      catch { hitGap = true; break; }
    }
    if (hitGap) break;
  }
  return pools;
}

export interface AuraSwapTokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  isNative: boolean;
  balance: string | null;
}

export async function detectAuraSwapTokens(
  net: AsentumNetworkCfg, poolAddress: string, holderHex?: string, opts?: { maxPools?: number; rpc?: string },
): Promise<AuraSwapTokenInfo[]> {
  const rpc   = opts?.rpc || await pickHealthyAsentumRpc(net);
  const pools = await listAuraSwapPools(net, poolAddress, { maxPools: opts?.maxPools, rpc });

  const addrs = new Set<string>();
  for (const p of pools) { addrs.add(p.token0.toLowerCase()); addrs.add(p.token1.toLowerCase()); }

  const out: AuraSwapTokenInfo[] = [];
  await Promise.all(Array.from(addrs).map(async (addr) => {
    if (isAuraSwapNative(addr)) { out.push({ address: AURA_SWAP_NATIVE, symbol: net.symbol, decimals: 18, isNative: true, balance: null }); return; }
    try {
      const r = await readAsentumToken(net, addr, holderHex, rpc);
      out.push({
        address: addr,
        symbol: r.symbol || `${addr.slice(0, 6)}…${addr.slice(-4)}`,
        decimals: r.decimals ?? 18,
        isNative: false,
        balance: r.ownerBalance ?? null,
      });
    } catch {
      out.push({ address: addr, symbol: `${addr.slice(0, 6)}…${addr.slice(-4)}`, decimals: 18, isNative: false, balance: null });
    }
  }));

  out.sort((a, b) => (a.isNative === b.isNative ? a.symbol.localeCompare(b.symbol) : a.isNative ? -1 : 1));
  return out;
}

export interface AuraSwapPosition {
  poolId: string;
  pool: AuraSwapPool;
  shares: string;
}

export async function detectAuraSwapPositions(
  net: AsentumNetworkCfg, poolAddress: string, holderHex: string, opts?: { maxPools?: number; rpc?: string },
): Promise<AuraSwapPosition[]> {
  const rpc   = opts?.rpc || await pickHealthyAsentumRpc(net);
  const pools = await listAuraSwapPools(net, poolAddress, { maxPools: opts?.maxPools, rpc });
  const contract = auraSwapContract(net, poolAddress, rpc);

  const results = await Promise.all(pools.map(async (p) => {
    try {
      const raw = await contract.view('sharesOf', [p.id, toAsentumHex(holderHex)]);
      return { poolId: p.id, pool: p, shares: String(raw ?? '0') };
    } catch { return { poolId: p.id, pool: p, shares: '0' }; }
  }));
  return results.filter(r => { try { return BigInt(r.shares) > 0n; } catch { return false; } });
}
