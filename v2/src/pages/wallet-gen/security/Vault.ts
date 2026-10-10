/**
 * vault.ts — penyimpanan terenkripsi untuk secret WalletGen (mnemonic + private key).
 *
 *  - KDF    : PBKDF2-SHA256, 600.000 iterasi, salt acak 16 byte
 *  - Cipher : AES-256-GCM, IV acak 12 byte BARU di setiap penyimpanan
 *  - Kunci  : CryptoKey non-extractable, hanya hidup di memori (module scope)
 *  - Disk   : hanya ciphertext (key `walletVault.v1`)
 *
 * `bip39Wallets` (key lama) tetap ditulis sebagai SALINAN PUBLIK tanpa secret,
 * karena Home / Waitlist / Explorer / AIAssistant hanya membaca nama + address.
 */

const VAULT_KEY = 'walletVault.v1';
export const PUBLIC_MIRROR_KEY = 'bip39Wallets';
export const AUTOLOCK_PREF_KEY = 'walletVaultAutoLockMin';

const PBKDF2_ITERATIONS = 600_000;
const MIN_ITERATIONS = 210_000;          // tolak file vault yang iterasinya dilemahkan
const AAD = new TextEncoder().encode('walletVault.v1');
const SECRET_FIELDS = new Set(['mnemonic', 'privateKey', 'seed', 'secretKey', 'secret']);

export const MIN_PASSWORD_LENGTH = 10;

interface VaultFile {
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string;   // base64
  iv: string;     // base64
  ct: string;     // base64 (ciphertext + tag GCM)
}

export class VaultError extends Error {
  code: 'UNSUPPORTED' | 'BAD_PASSWORD' | 'LOCKED' | 'CORRUPT' | 'WEAK_PASSWORD' | 'WRITE_FAILED';
  constructor(code: VaultError['code'], message: string) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
  }
}

/* ───────────── helper encoding ───────────── */

const bs = (u: Uint8Array) => u as unknown as BufferSource;

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/* ───────────── state sesi (hanya memori) ───────────── */

let sessionKey: CryptoKey | null = null;
let sessionSalt = '';          // base64
let sessionIter = PBKDF2_ITERATIONS;
let saveChain: Promise<void> = Promise.resolve();

/* ───────────── util publik ───────────── */

export const isVaultSupported = (): boolean =>
  typeof globalThis.crypto !== 'undefined' &&
  !!globalThis.crypto.subtle &&
  (typeof globalThis.isSecureContext === 'undefined' || globalThis.isSecureContext);

export const vaultExists = (): boolean => !!localStorage.getItem(VAULT_KEY);
export const isUnlocked = (): boolean => sessionKey !== null;

/** Hapus semua field secret (rekursif). Dipakai untuk salinan publik. */
export const stripSecrets = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map(stripSecrets) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_FIELDS.has(k)) continue;
      out[k] = stripSecrets(v);
    }
    return out as T;
  }
  return value;
};

/** Wallet lama (plaintext) yang belum dimigrasi: ada mnemonic/privateKey di localStorage. */
export const readLegacyPlaintextWallets = <T,>(): T[] | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(PUBLIC_MIRROR_KEY) || '[]');
    if (!Array.isArray(raw)) return null;
    const hasSecret = raw.some(w => w && typeof w === 'object' && (w.mnemonic || (w.addresses || []).some((a: any) => a?.privateKey)));
    return hasSecret ? (raw as T[]) : null;
  } catch { return null; }
};

export const checkPasswordPolicy = (pw: string): string | null => {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  if (classes < 2) return 'Gabungkan minimal 2 jenis karakter (huruf, angka, simbol).';
  if (/^(.)\1+$/.test(pw)) return 'Password terlalu mudah ditebak.';
  return null;
};

/* ───────────── kripto inti ───────────── */

async function deriveKey(password: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bs(salt), iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,                       // non-extractable
    ['encrypt', 'decrypt'],
  );
}

async function encryptWith(key: CryptoKey, data: unknown, salt: string, iter: number): Promise<VaultFile> {
  const iv = crypto.getRandomValues(new Uint8Array(12));   // IV baru tiap simpan
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bs(iv), additionalData: bs(AAD) },
    key,
    bs(new TextEncoder().encode(JSON.stringify(data))),
  );
  return { v: 1, kdf: 'PBKDF2-SHA256', iter, salt, iv: toB64(iv), ct: toB64(ct) };
}

async function decryptWith<T>(key: CryptoKey, file: VaultFile): Promise<T> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bs(fromB64(file.iv)), additionalData: bs(AAD) },
      key,
      bs(fromB64(file.ct)),
    );
  } catch {
    // Tag GCM tidak cocok: password salah ATAU data dimodifikasi.
    throw new VaultError('BAD_PASSWORD', 'Password salah atau vault rusak.');
  }
  try { return JSON.parse(new TextDecoder().decode(plain)) as T; }
  catch { throw new VaultError('CORRUPT', 'Isi vault tidak valid.'); }
}

function readVaultFile(): VaultFile {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) throw new VaultError('CORRUPT', 'Vault tidak ditemukan.');
  try {
    const f = JSON.parse(raw) as VaultFile;
    if (f?.v !== 1 || f.kdf !== 'PBKDF2-SHA256' || !f.salt || !f.iv || !f.ct || typeof f.iter !== 'number')
      throw new Error('format');
    if (f.iter < MIN_ITERATIONS) throw new Error('iter');
    return f;
  } catch { throw new VaultError('CORRUPT', 'File vault rusak atau tidak dikenali.'); }
}

function writeVaultFile(f: VaultFile): void {
  try { localStorage.setItem(VAULT_KEY, JSON.stringify(f)); }
  catch { throw new VaultError('WRITE_FAILED', 'Gagal menulis vault (penyimpanan penuh / diblokir).'); }
}

function writePublicMirror(wallets: unknown): void {
  try { localStorage.setItem(PUBLIC_MIRROR_KEY, JSON.stringify(stripSecrets(wallets))); } catch { /* non-fatal */ }
}

/* ───────────── API ───────────── */

/** Buat vault baru. Setelah ditulis & diverifikasi, plaintext lama dihapus. */
export async function createVault<T>(password: string, wallets: T[]): Promise<void> {
  if (!isVaultSupported()) throw new VaultError('UNSUPPORTED', 'Browser/konteks ini tidak mendukung WebCrypto (butuh HTTPS atau localhost).');
  const weak = checkPasswordPolicy(password);
  if (weak) throw new VaultError('WEAK_PASSWORD', weak);

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, saltBytes, PBKDF2_ITERATIONS);
  const file = await encryptWith(key, wallets, toB64(saltBytes), PBKDF2_ITERATIONS);

  // Verifikasi bisa dibuka lagi SEBELUM plaintext lama ditimpa.
  const check = await decryptWith<T[]>(key, file);
  if (JSON.stringify(check) !== JSON.stringify(wallets)) throw new VaultError('CORRUPT', 'Verifikasi vault gagal.');

  writeVaultFile(file);
  writePublicMirror(wallets);      // menimpa plaintext lama dengan salinan tanpa secret

  sessionKey = key; sessionSalt = file.salt; sessionIter = file.iter;
}

export async function unlockVault<T>(password: string): Promise<T[]> {
  if (!isVaultSupported()) throw new VaultError('UNSUPPORTED', 'WebCrypto tidak tersedia.');
  const file = readVaultFile();
  const key = await deriveKey(password, fromB64(file.salt), file.iter);
  const wallets = await decryptWith<T[]>(key, file);
  if (!Array.isArray(wallets)) throw new VaultError('CORRUPT', 'Isi vault tidak valid.');
  sessionKey = key; sessionSalt = file.salt; sessionIter = file.iter;
  return wallets;
}

/** Simpan snapshot terbaru (terserialisasi, IV baru tiap kali) + perbarui salinan publik. */
export function saveVault<T>(wallets: T[]): Promise<void> {
  const run = async () => {
    if (!sessionKey) throw new VaultError('LOCKED', 'Vault terkunci.');
    const file = await encryptWith(sessionKey, wallets, sessionSalt, sessionIter);
    writeVaultFile(file);
    writePublicMirror(wallets);
  };
  const p = saveChain.then(run, run);
  saveChain = p.catch(() => undefined);
  return p;
}

/** Tunggu simpanan yang masih berjalan, lalu buang kunci dari memori. */
export async function lockVault(): Promise<void> {
  try { await saveChain; } catch { /* abaikan */ }
  sessionKey = null; sessionSalt = '';
}

export function changeVaultPassword<T>(oldPw: string, newPw: string): Promise<void> {
  const run = async () => {
    if (!isVaultSupported()) throw new VaultError('UNSUPPORTED', 'WebCrypto tidak tersedia.');
    const weak = checkPasswordPolicy(newPw);
    if (weak) throw new VaultError('WEAK_PASSWORD', weak);
    if (oldPw === newPw) throw new VaultError('WEAK_PASSWORD', 'Password baru harus berbeda dari password lama.');

    const cur = readVaultFile();
    const oldKey = await deriveKey(oldPw, fromB64(cur.salt), cur.iter);
    const data = await decryptWith<T[]>(oldKey, cur);
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const newKey = await deriveKey(newPw, saltBytes, PBKDF2_ITERATIONS);
    const file = await encryptWith(newKey, data, toB64(saltBytes), PBKDF2_ITERATIONS);

    const check = await decryptWith<T[]>(newKey, file);
    if (JSON.stringify(check) !== JSON.stringify(data)) throw new VaultError('CORRUPT', 'Verifikasi vault gagal.');

    writeVaultFile(file);
    sessionKey = newKey; sessionSalt = file.salt; sessionIter = file.iter;
  };
  const p = saveChain.then(run, run);
  saveChain = p.catch(() => undefined);
  return p;
}

export async function destroyVault(): Promise<void> {
  sessionKey = null; sessionSalt = '';
  localStorage.removeItem(VAULT_KEY);
  localStorage.removeItem(PUBLIC_MIRROR_KEY);
}
