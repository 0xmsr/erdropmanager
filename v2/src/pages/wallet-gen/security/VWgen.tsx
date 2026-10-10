import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaLock, FaUnlock, FaShieldAlt, FaExclamationTriangle, FaEye, FaEyeSlash, FaKey, FaCheckCircle, FaTimes, FaCode,
} from 'react-icons/fa';
import { Navbar } from '../../../components/Navbar';
import type { BIP39Wallet } from '../../../pages/wallet-gen/types';
import {
  AUTOLOCK_PREF_KEY, MIN_PASSWORD_LENGTH, VaultError,
  changeVaultPassword, checkPasswordPolicy, createVault, destroyVault, isVaultSupported, lockVault,
  readLegacyPlaintextWallets, saveVault, unlockVault, vaultExists,
} from './Vault';

export interface VaultSession {
  initialWallets: BIP39Wallet[];
  /** Simpan snapshot wallet (terenkripsi). Dipanggil setiap `wallets` berubah. */
  persist: (wallets: BIP39Wallet[]) => void;
  /** Kunci vault sekarang (buang kunci dari memori, tutup halaman wallet). */
  lock: () => void;
  /** Beri tahu gate bahwa ada operasi panjang (queue/sweep) → tunda auto-lock. */
  setBusy: (busy: boolean) => void;
  /** Buka dialog ubah password. */
  openChangePassword: () => void;
  /** Auto-lock saat idle (menit, 0 = nonaktif). */
  autoLockMin: number;
  setAutoLockMin: (min: number) => void;
}

type Mode = 'loading' | 'unsupported' | 'setup' | 'locked' | 'unlocked';

const AUTOLOCK_OPTIONS = [5, 15, 30, 60, 0]; // menit; 0 = nonaktif
const MAX_FAILS_BEFORE_DELAY = 5;
const ACCENT = '#01a2ff';

/* ───────────── style ───────────── */

const css = `
.vg-card{background:#0d0d0d;border:1px solid #1e1e1e;border-top:2px solid ${ACCENT};padding:28px 24px;max-width:460px;margin:30px auto;width:100%;box-sizing:border-box}
.vg-card h3{margin:0 0 6px;font-size:18px;color:#fff;display:flex;align-items:center;gap:10px}
.vg-sub{font-size:12.5px;color:#888;line-height:1.65;margin:0 0 18px}
.vg-field{position:relative;margin-bottom:12px}
.vg-label{display:block;font-size:12px;color:#aaa;margin-bottom:6px}
.vg-input{width:100%;box-sizing:border-box;padding:12px 42px 12px 12px;background:#111;color:#fff;border:1px solid #333;font-family:monospace;font-size:14px;border-radius:0}
.vg-input:focus{outline:none;border-color:${ACCENT};box-shadow:0 0 0 1px ${ACCENT}}
.vg-input:disabled{opacity:.5}
.vg-eye{position:absolute;right:0;bottom:0;height:43px;width:42px;background:none;border:none;color:#777;cursor:pointer;display:flex;align-items:center;justify-content:center}
.vg-eye:hover,.vg-eye:focus-visible{color:#fff;outline:none}
.vg-hint{font-size:11px;color:#ffaa44;margin:4px 0 0;display:flex;align-items:center;gap:6px}
.vg-meter{display:flex;gap:4px;margin:8px 0 4px}
.vg-meter span{flex:1;height:3px;background:#222;transition:background .2s}
.vg-meter-label{font-size:11px;color:#888;margin:0 0 12px}
.vg-btn{width:100%;padding:13px;background:#fff;color:#000;border:none;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px}
.vg-btn:hover:not(:disabled){background:#e8e8e8}
.vg-btn:disabled{opacity:.5;cursor:not-allowed}
.vg-btn:focus-visible,.vg-ghost:focus-visible,.vg-link:focus-visible{outline:2px solid ${ACCENT};outline-offset:2px}
.vg-ghost{padding:11px 16px;background:transparent;color:#ccc;border:1px solid #333;cursor:pointer;font-size:13px}
.vg-ghost:hover{border-color:#666;color:#fff}
.vg-link{background:none;border:none;padding:0;color:${ACCENT};cursor:pointer;text-decoration:underline;font-size:inherit}
.vg-err{color:#ff6666;font-size:12px;margin:2px 0 12px;line-height:1.5}
.vg-warn{font-size:12px;color:#ffaa44;line-height:1.6;border-left:3px solid #ffaa00;padding-left:10px;margin:0 0 14px}
.vg-ack{display:flex;gap:8px;font-size:12px;color:#bbb;margin:6px 0 16px;cursor:pointer;line-height:1.5}
.vg-bar{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:center;font-size:12px;color:#777;padding:14px 12px 24px}
.vg-bar select{background:#111;color:#bbb;border:1px solid #333;font-size:12px;padding:3px 6px}
.vg-chip{display:inline-flex;align-items:center;gap:6px;color:#4caf50}
.vg-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px}
.vg-overlay .vg-card{margin:0;max-height:92vh;overflow-y:auto;position:relative}
.vg-close{position:absolute;top:10px;right:10px;background:none;border:none;color:#777;cursor:pointer;font-size:16px;padding:6px}
.vg-close:hover{color:#fff}
.vg-set-sec{padding:16px 0;border-top:1px solid #1e1e1e}
.vg-set-sec:first-of-type{border-top:none;padding-top:4px}
.vg-pill{font-size:11px;padding:2px 8px;border:1px solid #2e7d32;color:#6fcf7a;margin-left:auto}
.vg-pill.on{border-color:#ffaa00;color:#ffaa44}
.vg-set-sec h4{margin:0 0 4px;font-size:13px;color:#fff;display:flex;align-items:center;gap:8px}
.vg-set-sec p{margin:0 0 12px;font-size:12px;color:#888;line-height:1.55}
.vg-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:12.5px;color:#bbb}
.vg-switch.vg-switch{-webkit-appearance:none;appearance:none;position:relative;display:inline-block;flex:none;box-sizing:border-box;width:58px;min-width:58px;height:28px;margin:0;padding:0;border:1px solid #444;border-radius:14px;background:#161616;cursor:pointer;transition:background .2s,border-color .2s}
.vg-switch.vg-switch::before{content:'OFF';position:absolute;top:0;right:9px;line-height:26px;font-size:9.5px;font-weight:bold;letter-spacing:.4px;color:#777;transition:opacity .15s}
.vg-switch.vg-switch::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#8a8a8a;transition:transform .2s,background .2s}
.vg-switch.vg-switch:hover{border-color:#666}
.vg-switch.vg-switch[aria-checked="true"]{background:#2e0c0c;border-color:#ff3333}
.vg-switch.vg-switch[aria-checked="true"]::before{content:'ON';left:9px;right:auto;color:#ff8888}
.vg-switch.vg-switch[aria-checked="true"]::after{transform:translateX(30px);background:#ff5555}
.vg-switch.vg-switch:focus-visible{outline:2px solid ${ACCENT};outline-offset:2px}
.vg-set-actions{display:flex;flex-wrap:wrap;gap:8px}
.vg-set-actions .vg-ghost{padding:9px 12px;display:inline-flex;align-items:center;gap:6px}
.vg-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0d2a14;border:1px solid #2e7d32;color:#8ee89a;padding:10px 16px;font-size:13px;z-index:110;display:flex;align-items:center;gap:8px}
@media (prefers-reduced-motion:reduce){.vg-meter span,.vg-switch.vg-switch,.vg-switch.vg-switch::after{transition:none}}
`;

/* ───────────── util kecil ───────────── */

function strength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '#222' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  let s = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) s++;
  if (pw.length >= 14) s++;
  if (classes >= 3) s++;
  if (pw.length >= 18 && classes >= 2) s++;
  if (checkPasswordPolicy(pw)) s = Math.min(s, 1);
  const map = [
    { label: 'Terlalu lemah', color: '#ff3b3b' },
    { label: 'Lemah', color: '#ff3b3b' },
    { label: 'Cukup', color: '#ffaa00' },
    { label: 'Kuat', color: '#8bc34a' },
    { label: 'Sangat kuat', color: '#4caf50' },
  ];
  return { score: s, ...map[s] };
}

const StrengthMeter: React.FC<{ pw: string }> = ({ pw }) => {
  const st = strength(pw);
  if (!pw) return null;
  return (
    <>
      <div className="vg-meter" aria-hidden="true">
        {[1, 2, 3, 4].map(i => <span key={i} style={{ background: st.score >= i ? st.color : undefined }} />)}
      </div>
      <p className="vg-meter-label" aria-live="polite">Kekuatan password: <span style={{ color: st.color }}>{st.label}</span></p>
    </>
  );
};

interface PwFieldProps {
  id: string; label: string; value: string; onChange: (v: string) => void;
  autoComplete: 'new-password' | 'current-password'; autoFocus?: boolean; disabled?: boolean; placeholder?: string;
}
const PwField: React.FC<PwFieldProps> = ({ id, label, value, onChange, autoComplete, autoFocus, disabled, placeholder }) => {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <div className="vg-field">
      <label className="vg-label" htmlFor={id}>{label}</label>
      <input
        id={id} className="vg-input" type={show ? 'text' : 'password'} value={value}
        autoComplete={autoComplete} autoFocus={autoFocus} disabled={disabled} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyUp={e => setCaps(e.getModifierState?.('CapsLock') ?? false)}
        onBlur={() => setCaps(false)}
      />
      <button type="button" className="vg-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} tabIndex={0}>
        {show ? <FaEyeSlash /> : <FaEye />}
      </button>
      {caps && <p className="vg-hint"><FaExclamationTriangle /> Caps Lock aktif</p>}
    </div>
  );
};

/* ───────────── pengaturan WalletGen (dipakai di samping tombol Explorer) ───────────── */

export interface WalletGenSettingsProps {
  open: boolean;
  onClose: () => void;
  devMode: boolean;
  onToggleDevMode: () => void;
  vault: VaultSession;
}

export const WalletGenSettings: React.FC<WalletGenSettingsProps> = ({ open, onClose, devMode, onToggleDevMode, vault }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="vg-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vg-card" role="dialog" aria-modal="true" aria-labelledby="gs-title">
        <button type="button" className="vg-close" onClick={onClose} aria-label="Tutup"><FaTimes /></button>
        <h3 id="gs-title"><FaShieldAlt style={{ color: ACCENT }} /> Pengaturan WalletGen</h3>

        <div className="vg-set-sec">
          <h4><FaCode style={{ color: '#ffaa44' }} /> Dev mode {devMode && <span className="vg-pill on">Aktif</span>}</h4>
          <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: devMode ? '#ff8888' : '#888' }}>
            {devMode ? <FaExclamationTriangle color="#ff3333" size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                     : <FaShieldAlt color="#4caf50" size={13} style={{ marginTop: 2, flexShrink: 0 }} />}
            <span>
              {devMode
                ? <><strong style={{ color: '#ff5555' }}>MODE DEVELOPER AKTIF</strong> — semua TX dikirim langsung tanpa konfirmasi.</>
                : <>Mode konfirmasi TX aktif — setiap transaksi akan minta konfirmasi sebelum dikirim.</>}
            </span>
          </p>
          <div className="vg-row">
            <span id="gs-dev-label" style={{ fontWeight: 'bold', fontSize: 11, color: devMode ? '#ff5555' : '#777' }}>DEV MODE (skip konfirmasi)</span>
            <button type="button" role="switch" aria-checked={devMode} aria-labelledby="gs-dev-label"
              className="vg-switch" onClick={onToggleDevMode} />
          </div>
        </div>

        <div className="vg-set-sec">
          <h4><FaLock style={{ color: '#4caf50' }} /> Keamanan WalletGen <span className="vg-pill">Terenkripsi</span></h4>
          <p>Mnemonic dan private key disimpan terenkripsi (AES-256-GCM) dan hanya terbuka dengan password.</p>
          <div className="vg-row">
            <label htmlFor="gs-autolock">Auto-lock saat idle</label>
            <select id="gs-autolock" value={vault.autoLockMin} onChange={e => vault.setAutoLockMin(Number(e.target.value))}
              style={{ background: '#111', color: '#bbb', border: '1px solid #333', fontSize: 12, padding: '4px 6px' }}>
              {AUTOLOCK_OPTIONS.map(m => <option key={m} value={m}>{m === 0 ? 'nonaktif' : `${m} menit`}</option>)}
            </select>
          </div>
          <div className="vg-set-actions">
            <button type="button" className="vg-ghost" onClick={() => { onClose(); vault.openChangePassword(); }}><FaKey /> Ubah password</button>
            <button type="button" className="vg-ghost" onClick={() => { onClose(); vault.lock(); }}><FaLock /> Kunci sekarang</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────────── komponen utama ───────────── */

export const VaultGate: React.FC<{ children: (s: VaultSession) => React.ReactNode }> = ({ children }) => {
  const [mode, setMode]         = useState<Mode>('loading');
  const [wallets, setWallets]   = useState<BIP39Wallet[]>([]);
  const [sessionId, setSessionId] = useState(0);
  const [pw, setPw]             = useState('');
  const [pw2, setPw2]           = useState('');
  const [ack, setAck]           = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [working, setWorking]   = useState(false);
  const [fails, setFails]       = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [now, setNow]           = useState(Date.now());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [autoLockMin, setAutoLockMin] = useState<number>(() => {
    const v = Number(localStorage.getItem(AUTOLOCK_PREF_KEY));
    return AUTOLOCK_OPTIONS.includes(v) ? v : 15;
  });

  /* ubah password */
  const [cpOpen, setCpOpen]       = useState(false);
  const [cpOld, setCpOld]         = useState('');
  const [cpNew, setCpNew]         = useState('');
  const [cpNew2, setCpNew2]       = useState('');
  const [cpError, setCpError]     = useState<string | null>(null);
  const [cpWorking, setCpWorking] = useState(false);
  const [cpFails, setCpFails]     = useState(0);
  const [cpBlockedUntil, setCpBlockedUntil] = useState(0);
  const [toast, setToast]         = useState<string | null>(null);

  const [legacyInit] = useState(() => readLegacyPlaintextWallets<BIP39Wallet>());
  const legacy = useRef<BIP39Wallet[] | null>(legacyInit);
  const lastActivity = useRef(Date.now());
  const busyRef = useRef(false);

  /* status awal */
  useEffect(() => {
    if (!isVaultSupported()) setMode('unsupported');
    else setMode(vaultExists() ? 'locked' : 'setup');
  }, []);

  /* countdown blokir percobaan (unlock & ubah password) */
  const maxBlock = Math.max(blockedUntil, cpBlockedUntil);
  useEffect(() => {
    if (maxBlock <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [maxBlock]);

  /* toast hilang otomatis */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const resetChangePw = () => {
    setCpOpen(false); setCpOld(''); setCpNew(''); setCpNew2(''); setCpError(null);
  };

  const lock = useCallback(() => {
    void lockVault().then(() => {
      setWallets([]); setPw(''); setPw2(''); setError(null);
      setCpOpen(false); setCpOld(''); setCpNew(''); setCpNew2(''); setCpError(null);
      setMode('locked');
    });
  }, []);

  /* auto-lock saat idle */
  useEffect(() => {
    if (mode !== 'unlocked' || autoLockMin === 0) return;
    const bump = () => { lastActivity.current = Date.now(); };
    const evts: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    evts.forEach(e => window.addEventListener(e, bump, { passive: true }));
    const tick = setInterval(() => {
      if (busyRef.current) { lastActivity.current = Date.now(); return; }
      if (Date.now() - lastActivity.current >= autoLockMin * 60_000) lock();
    }, 10_000);
    const vis = () => { if (!document.hidden && !busyRef.current && Date.now() - lastActivity.current >= autoLockMin * 60_000) lock(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      evts.forEach(e => window.removeEventListener(e, bump));
      clearInterval(tick);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [mode, autoLockMin, lock]);

  /* kunci saat komponen dilepas (navigasi ke halaman lain) */
  useEffect(() => () => { void lockVault(); }, []);

  /* Escape menutup dialog ubah password */
  useEffect(() => {
    if (!cpOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !cpWorking) resetChangePw(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cpOpen, cpWorking]);

  const persist = useCallback((w: BIP39Wallet[]) => {
    saveVault(w).then(() => setSaveError(null)).catch(e =>
      setSaveError(e instanceof VaultError ? e.message : 'Gagal menyimpan vault.'));
  }, []);
  const setBusy = useCallback((b: boolean) => { busyRef.current = b; }, []);
  const openChangePassword = useCallback(() => { setCpError(null); setCpOpen(true); }, []);

  const changeAutoLock = (min: number) => {
    setAutoLockMin(min);
    try { localStorage.setItem(AUTOLOCK_PREF_KEY, String(min)); } catch { /* abaikan */ }
  };

  const open = (w: BIP39Wallet[]) => {
    setWallets(w); setSessionId(s => s + 1); setPw(''); setPw2(''); setAck(false);
    setError(null); setFails(0); lastActivity.current = Date.now(); setMode('unlocked');
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const weak = checkPasswordPolicy(pw);
    if (weak) return setError(weak);
    if (pw !== pw2) return setError('Konfirmasi password tidak sama.');
    if (!ack) return setError('Centang pernyataan di bawah dulu.');
    setWorking(true);
    try {
      const initial = legacy.current ?? [];
      await createVault(pw, initial);
      legacy.current = null;
      open(initial);
    } catch (err) {
      setError(err instanceof VaultError ? err.message : 'Gagal membuat vault.');
    } finally { setWorking(false); }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < blockedUntil) return;
    setError(null); setWorking(true);
    try {
      const w = await unlockVault<BIP39Wallet>(pw);
      open(w);
    } catch (err) {
      const n = fails + 1;
      setFails(n);
      if (n >= MAX_FAILS_BEFORE_DELAY) setBlockedUntil(Date.now() + Math.min(300, 15 * (n - MAX_FAILS_BEFORE_DELAY + 1)) * 1000);
      setError(err instanceof VaultError ? err.message : 'Gagal membuka vault.');
      setPw('');
    } finally { setWorking(false); }
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < cpBlockedUntil) return;
    setCpError(null);
    const weak = checkPasswordPolicy(cpNew);
    if (weak) return setCpError(weak);
    if (cpNew === cpOld) return setCpError('Password baru harus berbeda dari password lama.');
    if (cpNew !== cpNew2) return setCpError('Konfirmasi password baru tidak sama.');
    setCpWorking(true);
    busyRef.current = true;   // tunda auto-lock selama proses
    try {
      await changeVaultPassword<BIP39Wallet>(cpOld, cpNew);
      resetChangePw(); setCpFails(0);
      lastActivity.current = Date.now();
      setToast('Password vault berhasil diubah.');
    } catch (err) {
      if (err instanceof VaultError && err.code === 'BAD_PASSWORD') {
        const n = cpFails + 1;
        setCpFails(n);
        if (n >= MAX_FAILS_BEFORE_DELAY) setCpBlockedUntil(Date.now() + Math.min(300, 15 * (n - MAX_FAILS_BEFORE_DELAY + 1)) * 1000);
        setCpError('Password lama salah.');
        setCpOld('');
      } else {
        setCpError(err instanceof VaultError ? err.message : 'Gagal mengubah password.');
      }
    } finally { busyRef.current = false; setCpWorking(false); }
  };

  const handleReset = async () => {
    await destroyVault();
    legacy.current = null; setConfirmReset(false); setPw(''); setPw2(''); setError(null);
    setMode('setup');
  };

  /* ───────── tampilan ───────── */

  const blockedSecs = Math.max(0, Math.ceil((blockedUntil - now) / 1000));
  const cpBlockedSecs = Math.max(0, Math.ceil((cpBlockedUntil - now) / 1000));

  if (mode === 'unlocked') {
    const cpDisabled = cpWorking || cpBlockedSecs > 0;
    return (
      <>
        <style>{css}</style>
        {saveError && (
          <div role="alert" style={{ background: 'rgba(255,51,51,0.12)', border: '1px solid #ff3333', color: '#ff8888',
            padding: '10px 14px', fontSize: '12px', position: 'sticky', top: 0, zIndex: 50 }}>
            <FaExclamationTriangle style={{ marginRight: 8 }} />
            {saveError} — perubahan terakhir BELUM tersimpan terenkripsi. Jangan tutup tab, backup mnemonic dulu.
          </div>
        )}

        <React.Fragment key={sessionId}>
          {children({ initialWallets: wallets, persist, lock, setBusy, openChangePassword, autoLockMin, setAutoLockMin: changeAutoLock })}
        </React.Fragment>

        {cpOpen && (
          <div className="vg-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !cpWorking) resetChangePw(); }}>
            <form className="vg-card" role="dialog" aria-modal="true" aria-labelledby="cp-title" onSubmit={handleChangePw}>
              <button type="button" className="vg-close" onClick={resetChangePw} disabled={cpWorking} aria-label="Tutup"><FaTimes /></button>
              <h3 id="cp-title"><FaKey style={{ color: ACCENT }} /> Ubah password vault</h3>
              <p className="vg-sub">Wallet dienkripsi ulang dengan password baru. Mnemonic dan private key tidak berubah.</p>

              <PwField id="cp-old" label="Password lama" value={cpOld} onChange={setCpOld}
                autoComplete="current-password" autoFocus disabled={cpDisabled} />
              <PwField id="cp-new" label={`Password baru (min ${MIN_PASSWORD_LENGTH} karakter)`} value={cpNew} onChange={setCpNew}
                autoComplete="new-password" disabled={cpDisabled} />
              <StrengthMeter pw={cpNew} />
              <PwField id="cp-new2" label="Ulangi password baru" value={cpNew2} onChange={setCpNew2}
                autoComplete="new-password" disabled={cpDisabled} />

              {cpError && <p role="alert" className="vg-err">{cpError}</p>}
              {cpBlockedSecs > 0 && <p className="vg-hint" style={{ marginBottom: 12 }}>Terlalu banyak percobaan. Coba lagi dalam {cpBlockedSecs} dtk.</p>}

              <p className="vg-sub" style={{ marginBottom: 16 }}>
                Jika lupa password baru, wallet hanya bisa dipulihkan dari backup mnemonic.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="vg-ghost" onClick={resetChangePw} disabled={cpWorking}>Batal</button>
                <button type="submit" className="vg-btn" disabled={cpDisabled || !cpOld || !cpNew || !cpNew2}>
                  <FaKey /> {cpWorking ? 'Mengenkripsi ulang…' : 'Simpan password baru'}
                </button>
              </div>
            </form>
          </div>
        )}

        {toast && <div className="vg-toast" role="status"><FaCheckCircle /> {toast}</div>}
      </>
    );
  }

  return (
    <div className="app-container">
      <style>{css}</style>
      <header><h1><FaLock style={{ marginRight: '10px' }} />WalletGen</h1></header>
      <Navbar />

      {mode === 'loading' && <p style={{ textAlign: 'center', color: '#666' }}>Memuat…</p>}

      {mode === 'unsupported' && (
        <div className="vg-card" style={{ borderTopColor: '#ff3333' }}>
          <h3 style={{ color: '#ff8888' }}><FaExclamationTriangle /> WebCrypto tidak tersedia</h3>
          <p className="vg-sub">
            Wallet disimpan terenkripsi, jadi halaman ini harus dibuka lewat <b>HTTPS</b> atau <b>localhost</b> di browser modern.
            Demi keamanan, aplikasi tidak akan menyimpan secret sebagai plaintext sebagai cadangan.
          </p>
        </div>
      )}

      {mode === 'setup' && (
        <form onSubmit={handleSetup} className="vg-card">
          <h3><FaShieldAlt style={{ color: ACCENT }} /> Buat password vault</h3>
          <p className="vg-sub">
            Mnemonic dan private key dienkripsi (AES-256-GCM, kunci dari PBKDF2 600.000 iterasi). Password tidak pernah disimpan.
          </p>
          {legacy.current && (
            <p className="vg-warn">
              Ditemukan <b>{legacy.current.length} wallet</b> lama yang tersimpan <b>tanpa enkripsi</b>. Wallet akan dienkripsi
              otomatis, lalu mnemonic &amp; private key plaintext dihapus dari browser.
            </p>
          )}
          <PwField id="su-pw" label={`Password (min ${MIN_PASSWORD_LENGTH} karakter)`} value={pw} onChange={setPw}
            autoComplete="new-password" autoFocus disabled={working} />
          <StrengthMeter pw={pw} />
          <PwField id="su-pw2" label="Ulangi password" value={pw2} onChange={setPw2}
            autoComplete="new-password" disabled={working} />
          <label className="vg-ack">
            <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ marginTop: 3 }} />
            Saya paham: jika lupa password, wallet hanya bisa dipulihkan dari backup mnemonic yang saya simpan sendiri.
          </label>
          {error && <p role="alert" className="vg-err">{error}</p>}
          <button type="submit" disabled={working} className="vg-btn">
            <FaLock /> {working ? 'Mengenkripsi…' : 'Buat & enkripsi'}
          </button>
        </form>
      )}

      {mode === 'locked' && (
        <form onSubmit={handleUnlock} className="vg-card">
          <h3><FaLock style={{ color: ACCENT }} /> WalletGen terkunci</h3>
          <p className="vg-sub">Masukkan password untuk membuka wallet kamu.</p>
          <PwField id="un-pw" label="Password WalletGen" value={pw} onChange={setPw}
            autoComplete="current-password" autoFocus disabled={working || blockedSecs > 0} />
          {error && <p role="alert" className="vg-err">{error}</p>}
          {blockedSecs > 0 && <p className="vg-hint" style={{ marginBottom: 12 }}>Terlalu banyak percobaan. Coba lagi dalam {blockedSecs} dtk.</p>}
          <button type="submit" disabled={working || blockedSecs > 0 || !pw} className="vg-btn">
            <FaUnlock /> {working ? 'Membuka…' : 'Buka WalletGen'}
          </button>

          <div style={{ marginTop: '18px', borderTop: '1px solid #1e1e1e', paddingTop: '12px', fontSize: '12px', color: '#666' }}>
            {!confirmReset ? (
              <button type="button" className="vg-link" style={{ color: '#888' }} onClick={() => setConfirmReset(true)}>Lupa password?</button>
            ) : (
              <div style={{ color: '#ff8888', lineHeight: 1.6 }}>
                Reset akan <b>menghapus permanen</b> semua wallet di browser ini. Lanjutkan hanya jika mnemonic sudah kamu backup.
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setConfirmReset(false)} className="cancel-btn">Batal</button>
                  <button type="button" onClick={handleReset} className="ya-btn">Hapus &amp; reset</button>
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
