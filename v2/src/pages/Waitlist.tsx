import React, { useState, useEffect } from 'react';
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
    FaListAlt
} from 'react-icons/fa';

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

  const waitlistTasks = tasks.filter(t => t.status === 'Waitlist');

  const toggleField = (field: keyof typeof showFields) =>
    setShowFields(p => ({ ...p, [field]: !p[field] }));

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

      <div className="form-container">
        <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>
          {isEditMode ? <><FaEdit /> Edit Data</> : <><FaListAlt /> Tambah Waitlist Baru</>}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              placeholder="Nama project (misal: Arkham)"
              value={formData.nama}
              onChange={e => setFormData(p => ({ ...p, nama: e.target.value }))}
              required
            />
            <input
              placeholder="Link Waitlist"
              value={formData.link}
              onChange={e => setFormData(p => ({ ...p, link: e.target.value }))}
              required
            />
          </div>

          <p style={{ fontSize: '11px', color: '#555', textAlign: 'center', margin: '4px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Sosmed yang digunakan
          </p>

          <div style={{
            display: 'flex', justifyContent: 'center', padding: '12px',
            border: '1px dashed #2a2a2a', flexWrap: 'wrap', gap: '14px',
          }}>
            {([
              { key: 'email',   icon: <FaEnvelope />,  label: 'Email' },
              { key: 'discord', icon: <FaDiscord />,   label: 'Discord' },
              { key: 'x',       icon: <FaTwitter />,   label: 'X/Twitter' },
              { key: 'address', icon: <FaWallet />,    label: 'Wallet' },
            ] as const).map(({ key, icon, label }) => (
              <label key={key} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showFields[key]}
                  onChange={() => toggleField(key)}
                  style={{ width: 'auto', margin: 0 }}
                />
                {icon} {label}
              </label>
            ))}
          </div>

          {(showFields.email || showFields.discord || showFields.x || showFields.address) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {showFields.email && (
                <div className="search-input-wrapper">
                  <FaEnvelope className="search-icon" style={{ left: '10px' }} />
                  <input placeholder="Email address" value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    style={{ paddingLeft: '35px', borderLeft: '2px solid #01a2ff' }} />
                </div>
              )}
              {showFields.discord && (
                <div className="search-input-wrapper">
                  <FaDiscord className="search-icon" style={{ left: '10px' }} />
                  <input placeholder="Discord username" value={formData.discord}
                    onChange={e => setFormData(p => ({ ...p, discord: e.target.value }))}
                    style={{ paddingLeft: '35px', borderLeft: '2px solid #5865F2' }} />
                </div>
              )}
              {showFields.x && (
                <div className="search-input-wrapper">
                  <FaTwitter className="search-icon" style={{ left: '10px' }} />
                  <input placeholder="X / Twitter handle" value={formData.x}
                    onChange={e => setFormData(p => ({ ...p, x: e.target.value }))}
                    style={{ paddingLeft: '35px', borderLeft: '2px solid #666' }} />
                </div>
              )}
              {showFields.address && (
                <div className="search-input-wrapper">
                  <FaWallet className="search-icon" style={{ left: '10px' }} />
                  <input placeholder="Wallet address" value={formData.address}
                    onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                    style={{ paddingLeft: '35px', borderLeft: '2px solid #f3ba2f' }} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button type="submit" className="btn-manage btn-import">
              <FaSave /> {isEditMode ? 'Update Data' : 'Tambah Waitlist'}
            </button>
            <button type="button" className="cancel-btn" onClick={resetForm}>
              <FaUndo /> Reset
            </button>
          </div>
        </form>

        <p style={{ fontSize: '11px', color: '#444', textAlign: 'center', marginTop: '14px' }}>
          Kelola status atau hapus di{' '}
          <Link to="/" style={{ color: '#01a2ff' }}>Halaman Utama</Link>
        </p>
      </div>

      <div className="table-container" style={{ marginTop: '24px' }}>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Info Akun</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {waitlistTasks.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '28px', color: '#333' }}>
                  Belum ada data waitlist.
                </td>
              </tr>
            ) : (
              waitlistTasks.map(item => (
                <tr key={item.id}>
                  <td data-label="Project" style={{ verticalAlign: 'middle' }}>
                    <strong style={{ fontSize: '13px' }}>{item.nama}</strong>
                  </td>
                  <td data-label="Info Akun">
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {item.emailUsed && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <FaEnvelope color="#01a2ff" size={11} /> {item.emailUsed}
                        </span>
                      )}
                      {item.discordUsed && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <FaDiscord color="#5865F2" size={11} /> {item.discordUsed}
                        </span>
                      )}
                      {item.xUsed && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <FaTwitter color="#888" size={11} /> {item.xUsed}
                        </span>
                      )}
                      {(item as any).walletAddress && (
                        <span style={{ color: '#f3ba2f', wordBreak: 'break-all', display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '11px' }}>
                          <FaWallet style={{ flexShrink: 0, marginTop: '2px' }} /> {(item as any).walletAddress}
                        </span>
                      )}
                      {!item.emailUsed && !item.discordUsed && !item.xUsed && !(item as any).walletAddress && (
                        <span style={{ color: '#2a2a2a', fontSize: '11px' }}>— no details —</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Action" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <a href={item.link} target="_blank" rel="noreferrer" className="open-link" title="Buka Link">
                        <FaExternalLinkAlt size={13} />
                      </a>
                      <button className="action-btn edit-btn" onClick={() => handleEdit(item)} title="Edit Data">
                        <FaEdit size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
