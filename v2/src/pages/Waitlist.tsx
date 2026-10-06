import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { type Task } from '../types';
import { Navbar } from '../components/Navbar';
import { CustomAlert } from '../components/CustomModals';
import { 
    FaEdit, 
    FaExternalLinkAlt, 
    FaEnvelope, 
    FaDiscord, 
    FaTwitter, 
    FaWallet, 
    FaSave, 
    FaUndo, 
    FaListAlt,
    FaSearch,
    FaCopy,
    FaCheckCircle,
    FaGlobe,
    FaChevronDown,
    FaTimes
} from 'react-icons/fa';

const Field: React.FC<{
  label: string; icon: React.ReactNode; color: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  required?: boolean; hint?: React.ReactNode; children?: React.ReactNode;
}> = ({ label, icon, color, placeholder, value, onChange, required, hint, children }) => (
  <div className="wl-field" style={{ ['--accent' as any]: color }}>
    <label style={{ display: 'block', fontSize: '11px', color: '#777', marginBottom: '5px', letterSpacing: '0.5px' }}>
      {label} {required && <span style={{ color: '#ff5555' }}>*</span>}
    </label>
    <div style={{ position: 'relative' }}>
      <span className="wl-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#444', display: 'flex', pointerEvents: 'none' }}>
        {icon}
      </span>
      <input className="wl-input" placeholder={placeholder} value={value} required={required}
        onChange={e => onChange(e.target.value)} />
      {value && (
        <button type="button" onClick={() => onChange('')} title="Hapus isi" tabIndex={-1}
          style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '6px', display: 'flex' }}>
          <FaTimes size={11} />
        </button>
      )}
    </div>
    {hint && <div style={{ fontSize: '10px', marginTop: '4px', color: '#666' }}>{hint}</div>}
    {children}
  </div>
);

type PickGroup = { title: string; items: { label: string; sub?: string; value: string }[] };

const SavedPicker: React.FC<{
  groups: PickGroup[]; accent: string; buttonLabel: string; searchPlaceholder: string;
  monoSub?: boolean; onPick: (value: string) => void;
}> = ({ groups, accent, buttonLabel, searchPlaceholder, monoSub, onPick }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total === 0) return null;

  const needle = q.trim().toLowerCase();
  const shown = groups
    .map(g => ({ ...g, items: g.items.filter(i =>
      !needle || i.label.toLowerCase().includes(needle) || i.value.toLowerCase().includes(needle)) }))
    .filter(g => g.items.length > 0);

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: '6px' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          padding: '8px 10px', fontSize: '11px', cursor: 'pointer', background: '#0d0d0d', color: '#888',
          border: `1px solid ${open ? accent : '#222'}` }}>
        <span>{buttonLabel} ({total})</span>
        <FaChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, background: '#111', border: `1px solid ${accent}`, borderTop: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.6)' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #1e1e1e' }}>
            <input type="search" autoFocus placeholder={searchPlaceholder} value={q}
              onChange={e => setQ(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }} />
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {shown.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: '#444', fontSize: '11px' }}>Tidak ditemukan.</div>
            ) : shown.map(g => (
              <div key={g.title}>
                {groups.length > 1 && (
                  <div style={{ padding: '6px 10px', fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', background: '#0a0a0a' }}>
                    {g.title} ({g.items.length})
                  </div>
                )}
                {g.items.map((o, i) => (
                  <button key={`${g.title}${i}`} type="button"
                    onClick={() => { onPick(o.value); setOpen(false); setQ(''); }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderBottom: '1px solid #151515', cursor: 'pointer' }}>
                    <div style={{ fontSize: '12px', color: '#ddd', wordBreak: 'break-all' }}>{o.label}</div>
                    {o.sub && <div style={{ fontSize: '10px', color: '#666', fontFamily: monoSub ? 'monospace' : 'inherit' }}>{o.sub}</div>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const Waitlist: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('airdropTasks');
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error("Gagal memuat data:", err);
      return [];
    }
  });

  const [formData, setFormData] = useState({
    nama: '', link: '', email: '', x: '', discord: '', address: '',
  });
  const [showFields, setShowFields] = useState({
    email: false, x: false, discord: false, address: false,
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [alertData, setAlertData] = useState<{
    isOpen: boolean; msg: string; type: 'success' | 'error' | 'hapus' | 'info';
  }>({ isOpen: false, msg: '', type: 'info' });

  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyValue = async (text: string, id: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };
  const getDomain = (link: string) => {
    try { return new URL(link).hostname.replace(/^www\./, ''); } catch { return link; }
  };

  const showAlert = (msg: string, type: 'success' | 'error' | 'hapus' | 'info' = 'info') => {
    setAlertData({ isOpen: true, msg, type });
  };

  useEffect(() => {
    localStorage.setItem('airdropTasks', JSON.stringify(tasks));
  }, [tasks]);

  const resetForm = () => {
    setIsEditMode(false);
    setEditId(null);
    setFormData({ nama: '', link: '', email: '', x: '', discord: '', address: '' });
    setShowFields({ email: false, x: false, discord: false, address: false });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.link) return;

    let formattedLink = formData.link.trim();
    if (!/^https?:\/\//i.test(formattedLink)) formattedLink = `https://${formattedLink}`;

    const taskPayload = {
      nama:          formData.nama,
      link:          formattedLink,
      emailUsed:     showFields.email   ? formData.email   : '',
      xUsed:         showFields.x       ? formData.x       : '',
      discordUsed:   showFields.discord ? formData.discord : '',
      walletAddress: showFields.address ? formData.address : '',
    };

    let updatedTasks: Task[];

    if (isEditMode && editId) {
      updatedTasks = tasks.map(t => t.id === editId ? { ...t, ...taskPayload } : t);
      showAlert('Berhasil diperbarui!', 'success');
    } else {
      const newTask: Task = {
        id: Date.now(),
        ...taskPayload,
        tugas: 'Waitlist Registration',
        akun: 1,
        status: 'Waitlist',
        selesaiHariIni: true,
        tanggalDitambahkan: new Date().toLocaleDateString('id-ID'),
        kategori: 'Waitlist',
        detailAkun: [],
      } as Task;
      updatedTasks = [...tasks, newTask];
      showAlert('Berhasil ditambahkan!', 'success');
    }

    setTasks(updatedTasks);
    localStorage.setItem('airdropTasks', JSON.stringify(updatedTasks));
    resetForm();
  };

  const handleEdit = (item: Task) => {
    setIsEditMode(true);
    setEditId(item.id);
    setFormData({
      nama:    item.nama,
      link:    item.link,
      email:   item.emailUsed   || '',
      x:       item.xUsed       || '',
      discord: item.discordUsed || '',
      address: (item as any).walletAddress || '',
    });
    setShowFields({
      email:   !!item.emailUsed,
      x:       !!item.xUsed,
      discord: !!item.discordUsed,
      address: !!(item as any).walletAddress,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  type AddrOption = { label: string; address: string };
  const addrOptions = useMemo(() => {
    const profile: AddrOption[] = [];
    const gen: AddrOption[] = [];
    try {
      const mw = JSON.parse(localStorage.getItem('masterWallets') || '[]');
      (Array.isArray(mw) ? mw : []).forEach((m: any) => {
        if (m?.address) profile.push({ label: String(m.name || 'Profile'), address: String(m.address) });
      });
    } catch { /* abaikan */ }
    try {
      const raw = JSON.parse(localStorage.getItem('bip39Wallets') || '[]');
      const fields: [string, string][] = [
        ['addresses', 'EVM'], ['solAddresses', 'SOL'], ['tronAddresses', 'TRON'],
        ['axmAddresses', 'AXM'], ['atomAddresses', 'ATOM'], ['suiAddresses', 'SUI'],
        ['aptAddresses', 'APT'], ['aseAddresses', 'ASE'],
      ];
      const seen = new Set(profile.map(p => p.address.toLowerCase()));
      const push = (label: string, address: string) => {
        const k = address.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        gen.push({ label, address });
      };
      (Array.isArray(raw) ? raw : []).forEach((w: any) => {
        const wName = String(w?.name || 'Wallet');
        fields.forEach(([field, chain]) => {
          (Array.isArray(w?.[field]) ? w[field] : []).forEach((a: any) => {
            if (a?.address) push(`${wName} · ${chain} #${(a.index ?? 0) + 1}`, String(a.address));
          });
        });
        if (w?.gramAddress?.address) push(`${wName} · GRAM`, String(w.gramAddress.address));
      });
    } catch { /* abaikan */ }
    return { profile, gen };
  }, [showFields.address]);

  // Akun sosmed yang pernah disimpan (dari semua garapan/waitlist), unik & diurutkan dari yang paling sering dipakai.
  const socialOptions = useMemo(() => {
    const build = (pick: (t: Task) => string | undefined) => {
      const map = new Map<string, { value: string; count: number }>();
      tasks.forEach(t => {
        const v = (pick(t) || '').trim();
        if (!v) return;
        const k = v.toLowerCase();
        const cur = map.get(k);
        if (cur) cur.count += 1; else map.set(k, { value: v, count: 1 });
      });
      return Array.from(map.values()).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    };
    return {
      email:   build(t => t.emailUsed),
      discord: build(t => t.discordUsed),
      x:       build(t => t.xUsed),
    };
  }, [tasks]);

  const shortAddr = (a: string) => (a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

  const waitlistTasks = tasks.filter(t => t.status === 'Waitlist');

  const toggleField = (field: keyof typeof showFields) =>
    setShowFields(p => ({ ...p, [field]: !p[field] }));

  const visibleTasks = waitlistTasks.filter(t => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return [t.nama, t.link, t.emailUsed, t.xUsed, t.discordUsed, (t as any).walletAddress]
      .some(v => (v || '').toLowerCase().includes(q));
  });
  const withWallet  = waitlistTasks.filter(t => (t as any).walletAddress).length;
  const withSocials = waitlistTasks.filter(t => t.emailUsed || t.xUsed || t.discordUsed).length;

  const SOCIALS = [
    { key: 'email',   icon: <FaEnvelope size={12} />, label: 'Email',     color: '#01a2ff' },
    { key: 'discord', icon: <FaDiscord size={12} />,  label: 'Discord',   color: '#5865F2' },
    { key: 'x',       icon: <FaTwitter size={12} />,  label: 'X/Twitter', color: '#9aa0a6' },
    { key: 'address', icon: <FaWallet size={12} />,   label: 'Wallet',    color: '#f3ba2f' },
  ] as const;

  const fieldMeta = {
    email:   { label: 'Email', placeholder: 'nama@email.com',     color: '#01a2ff', icon: <FaEnvelope /> },
    discord: { label: 'Discord', placeholder: 'username',  color: '#5865F2', icon: <FaDiscord /> },
    x:       { label: 'X / Twitter', placeholder: '@handle', color: '#9aa0a6', icon: <FaTwitter /> },
    address: { label: 'Wallet Address', placeholder: '0x… / alamat wallet',    color: '#f3ba2f', icon: <FaWallet /> },
  } as const;

  const sectionLabel: React.CSSProperties = {
    fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '4px 0 -2px',
  };

  const StatChip = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div style={{ flex: '1 1 120px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderLeft: `3px solid ${color}`, padding: '12px 14px' }}>
      <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace', marginTop: '4px' }}>{value}</div>
    </div>
  );

  return (
    <div className="app-container">
      <CustomAlert
        isOpen={alertData.isOpen}
        message={alertData.msg}
        type={alertData.type}
        onClose={() => setAlertData(p => ({ ...p, isOpen: false }))}
      />

      <header><h1><FaListAlt style={{ marginRight: '10px' }} />Waitlist Explorer</h1></header>
      <Navbar />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
        <StatChip label="Total Waitlist" value={waitlistTasks.length} color="#9c27b0" />
        <StatChip label="Dengan Sosmed" value={withSocials} color="#01a2ff" />
        <StatChip label="Dengan Wallet" value={withWallet} color="#f3ba2f" />
      </div>

      <style>{`
        .wl-input{width:100%;box-sizing:border-box;background:#0a0a0a !important;border:1px solid #222 !important;border-radius:0 !important;
          padding:11px 32px 11px 36px !important;color:#eee;font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s}
        .wl-input::placeholder{color:#444}
        .wl-field:focus-within .wl-input{border-color:var(--accent) !important;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
        .wl-field:focus-within .wl-icon{color:var(--accent) !important}
      `}</style>

      <div className="form-container" style={{ borderTop: `2px solid ${isEditMode ? '#ffaa00' : '#01a2ff'}` }}>
        <h2 style={{ textAlign: 'center', marginBottom: '16px', fontSize: '15px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {isEditMode ? <><FaEdit /> Edit Data</> : <><FaListAlt /> Tambah Waitlist Baru</>}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={sectionLabel}>Info Project</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <Field label="Nama Project" required icon={<FaListAlt size={12} />} color="#01a2ff"
              placeholder="misal: Arkham" value={formData.nama}
              onChange={v => setFormData(p => ({ ...p, nama: v }))} />
            <Field label="Link Waitlist" required icon={<FaGlobe size={12} />} color="#01a2ff"
              placeholder="contoh.xyz/waitlist" value={formData.link}
              onChange={v => setFormData(p => ({ ...p, link: v }))}
              hint={formData.link.trim() && !/^https?:\/\//i.test(formData.link.trim())
                ? <>Disimpan sebagai <span style={{ color: '#01a2ff' }}>https://{formData.link.trim()}</span></>
                : undefined} />
          </div>

          <div style={sectionLabel}>Sosmed yang digunakan</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SOCIALS.map(({ key, icon, label, color }) => {
              const active = showFields[key];
              return (
                <button key={key} type="button" aria-pressed={active} onClick={() => toggleField(key)}
                  style={{
                    flex: '1 1 110px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                    padding: '9px 12px', fontSize: '12px', cursor: 'pointer', userSelect: 'none',
                    background: active ? `${color}1f` : '#0d0d0d',
                    color: active ? color : '#666',
                    border: `1px solid ${active ? color : '#222'}`,
                    transition: 'all 0.15s',
                  }}>
                  {icon} {label}
                </button>
              );
            })}
          </div>

          {(showFields.email || showFields.discord || showFields.x || showFields.address) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {(['email', 'discord', 'x', 'address'] as const).filter(k => showFields[k]).map(k => (
                <Field key={k} label={fieldMeta[k].label} icon={fieldMeta[k].icon} color={fieldMeta[k].color}
                  placeholder={fieldMeta[k].placeholder} value={formData[k]}
                  onChange={v => setFormData(p => ({ ...p, [k]: v }))}
                  hint={k === 'email' && formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())
                    ? <span style={{ color: '#ffaa00' }}>Format email sepertinya belum valid</span>
                    : undefined}>
                  {k === 'address' ? (
                    <SavedPicker accent="#f3ba2f" monoSub
                      buttonLabel="Pilih dari wallet tersimpan" searchPlaceholder="Cari nama / address..."
                      groups={[
                        { title: 'Wallet Profile',   items: addrOptions.profile.map(o => ({ label: o.label, sub: shortAddr(o.address), value: o.address })) },
                        { title: 'WalletGen', items: addrOptions.gen.map(o => ({ label: o.label, sub: shortAddr(o.address), value: o.address })) },
                      ]}
                      onPick={v => setFormData(p => ({ ...p, address: v }))} />
                  ) : (
                    <SavedPicker accent={fieldMeta[k].color}
                      buttonLabel={`Pilih ${fieldMeta[k].label} tersimpan`} searchPlaceholder={`Cari ${fieldMeta[k].label}...`}
                      groups={[{ title: 'Tersimpan', items: socialOptions[k].map(o => ({
                        label: o.value, sub: `dipakai di ${o.count} project`, value: o.value })) }]}
                      onPick={v => setFormData(p => ({ ...p, [k]: v }))} />
                  )}
                </Field>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
            <button type="submit" className="btn-manage btn-import" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <FaSave /> {isEditMode ? 'Update Data' : 'Tambah Waitlist'}
            </button>
            <button type="button" className="cancel-btn" onClick={resetForm} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <FaUndo /> Reset
            </button>
          </div>
        </form>

        <p style={{ fontSize: '11px', color: '#444', textAlign: 'center', marginTop: '14px', marginBottom: 0 }}>
          Kelola status atau hapus di{' '}
          <Link to="/home" style={{ color: '#01a2ff' }}>Halaman Utama</Link>
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '24px 0 14px' }}>
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: '200px' }}>
          <FaSearch className="search-icon" />
          <input type="search" placeholder="Cari project / email / wallet..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <span style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>
          {visibleTasks.length} / {waitlistTasks.length} project
        </span>
      </div>

      {visibleTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: '#444', border: '1px dashed #2a2a2a', fontSize: '13px' }}>
          {waitlistTasks.length === 0 ? 'Belum ada data waitlist.' : 'Tidak ada hasil yang cocok.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
          {visibleTasks.map(item => {
            const wallet: string = (item as any).walletAddress || '';
            const rows: { icon: React.ReactNode; text: string; color: string; id: string }[] = [];
            if (item.emailUsed)   rows.push({ icon: <FaEnvelope size={11} />, text: item.emailUsed,   color: '#01a2ff', id: `e${item.id}` });
            if (item.discordUsed) rows.push({ icon: <FaDiscord size={11} />,  text: item.discordUsed, color: '#5865F2', id: `d${item.id}` });
            if (item.xUsed)       rows.push({ icon: <FaTwitter size={11} />,  text: item.xUsed,       color: '#9aa0a6', id: `x${item.id}` });
            if (wallet)           rows.push({ icon: <FaWallet size={11} />,   text: wallet,           color: '#f3ba2f', id: `w${item.id}` });
            const editing = isEditMode && editId === item.id;

            return (
              <div key={item.id} style={{
                background: '#0d0d0d', border: `1px solid ${editing ? '#ffaa00' : '#1e1e1e'}`, borderLeft: '3px solid #9c27b0',
                padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.nama}
                    </div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FaGlobe size={10} /> {getDomain(item.link)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <a href={item.link} target="_blank" rel="noreferrer" className="open-link" title="Buka Link">
                      <FaExternalLinkAlt size={13} />
                    </a>
                    <button className="action-btn edit-btn" onClick={() => handleEdit(item)} title="Edit Data">
                      <FaEdit size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {rows.length === 0 ? (
                    <span style={{ color: '#333', fontSize: '11px' }}>— no details —</span>
                  ) : rows.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0a0a0a', border: '1px solid #141414', padding: '6px 8px' }}>
                      <span style={{ color: r.color, display: 'flex', flexShrink: 0 }}>{r.icon}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: '11px', color: '#aaa', fontFamily: r.id.startsWith('w') ? 'monospace' : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.text}>
                        {r.text}
                      </span>
                      <button type="button" onClick={() => copyValue(r.text, r.id)} title="Salin"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0, color: copiedId === r.id ? '#4caf50' : '#444' }}>
                        {copiedId === r.id ? <FaCheckCircle size={11} /> : <FaCopy size={11} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
