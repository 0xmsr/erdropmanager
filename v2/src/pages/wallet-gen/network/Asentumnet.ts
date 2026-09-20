import { ethers } from 'ethers';
import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import { bech32 } from 'bech32';
import { AsentumClient, AsentumWallet, parseAse, formatAse } from '@asentum/sdk';

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
    if (isAsentumSeedKey(entry.privateKey)) return entry;
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

// Terima hex ("0x...") ATAU angka desimal biasa buat baseFeePerGas — RPC
// node-nya belum tentu selalu format hex kayak Ethereum asli.
function parseFeeBigInt(v: string | undefined | null): bigint {
  if (!v) return 0n;
  try { return BigInt(v); } catch { return 0n; }
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
      const sent   = await wallet.sendTransfer({ to: toAsentumHex(to), amount: parseAse(String(amountAse)) });
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
  const sent   = await wallet.sendTransfer({ to: toAsentumHex(to), amount: amount as any });
  await sent.wait();
  return { status: 'success', hash: sent.hash, sentAse: String(formatAse(amount as any)), balanceAse };
}
