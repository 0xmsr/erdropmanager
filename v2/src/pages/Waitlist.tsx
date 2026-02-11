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

  const [formData, setFormData] = useState({ nama: '', link: '', email: '', x: '', discord: '', address: '' });
  const [showFields, setShowFields] = useState({ email: false, x: false, discord: false, address: false });
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [alertData, setAlertData] = useState<{ isOpen: boolean; msg: string; type: 'success' | 'error' | 'hapus' | 'info' }>({
    isOpen: false, msg: '', type: 'info'
  });

  const showAlert = (msg: string, type: 'success' | 'error' | 'hapus' | 'info' = 'info') => {
    setAlertData({ isOpen: true, msg, type });
  };

  useEffect(() => {
    localStorage.setItem('airdropTasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!formData.nama || !formData.link) return;

  let formattedLink = formData.link.trim();
  if (!/^https?:\/\//i.test(formattedLink)) {
    formattedLink = `https://${formattedLink}`;
  }

  const taskPayload = {
    nama: formData.nama,
    link: formattedLink,
    emailUsed: showFields.email ? formData.email : '',
    xUsed: showFields.x ? formData.x : '',
    discordUsed: showFields.discord ? formData.discord : '',
    walletAddress: showFields.address ? formData.address : ''
  };

  let updatedTasks: Task[];

  if (isEditMode && editId) {
    updatedTasks = tasks.map(t => t.id === editId ? { ...t, ...taskPayload } : t);
    setTasks(updatedTasks);
    setIsEditMode(false);
    setEditId(null);
    showAlert('Berhasil diperbarui!', 'success');
  } else {
    const newTask: Task = {
      id: Date.now(),
      ...taskPayload,
      tugas: 'Waitlist Registration',
      akun: 1,
      status: 'Waitlist',
      selesaiHariIni: true,
      tanggalDitambahkan: new Date().toLocaleDateString(),
      kategori: 'Waitlist',
      detailAkun: []
    } as Task;
    
    updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    showAlert('Berhasil ditambahkan!', 'success');
  }

  localStorage.setItem('airdropTasks', JSON.stringify(updatedTasks));
  setFormData({ nama: '', link: '', email: '', x: '', discord: '', address: '' });
  setShowFields({ email: false, x: false, discord: false, address: false });
};

  const handleEdit = (item: any) => {
    setIsEditMode(true);
    setEditId(item.id);
    setFormData({
      nama: item.nama,
      link: item.link,
      email: item.emailUsed || '',
      x: item.xUsed || '',
      discord: item.discordUsed || '',
      address: item.walletAddress || ''
    });
    setShowFields({
      email: !!item.emailUsed,
      x: !!item.xUsed,
      discord: !!item.discordUsed,
      address: !!item.walletAddress
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const waitlistTasks = tasks.filter(t => t.status === 'Waitlist');

  return (
    <div className="app-container">
      <CustomAlert 
        isOpen={alertData.isOpen}
        message={alertData.msg}
        type={alertData.type}
        onClose={() => setAlertData({ ...alertData, isOpen: false })}
      />

      <header><h1><FaListAlt style={{marginRight: '10px'}}/>Waitlist Explorer</h1></header>
      <Navbar />

      <div className="form-container">
        <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>
          {isEditMode ? <><FaEdit /> Edit Data</> : <><FaListAlt /> Tambah Waitlist Baru</>}
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input 
              placeholder="Contoh: Arkham" 
              value={formData.nama} 
              onChange={e => setFormData({...formData, nama: e.target.value})} 
              required
            />
            <input 
              placeholder="Link Waitlist" 
              value={formData.link} 
              onChange={e => setFormData({...formData, link: e.target.value})} 
              required
            />
          </div>

          <p style={{ fontSize: '12px', color: '#ffffff', textAlign: 'center', marginTop: '10px' }}>
           Sosmed yang digunakan (Centang untuk menampilkan input):
        </p>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            padding: '12px', 
            border: '1px dashed #555', 
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
               <input type="checkbox" checked={showFields.email} onChange={() => setShowFields({ ...showFields, email: !showFields.email })} /> 
               <FaEnvelope /> Email
            </label>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
               <input type="checkbox" checked={showFields.discord} onChange={() => setShowFields({ ...showFields, discord: !showFields.discord })} /> 
               <FaDiscord /> Discord
            </label>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
               <input type="checkbox" checked={showFields.x} onChange={() => setShowFields({ ...showFields, x: !showFields.x })} /> 
               <FaTwitter /> X / Twitter
            </label>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
               <input type="checkbox" checked={showFields.address} onChange={() => setShowFields({ ...showFields, address: !showFields.address })} /> 
               <FaWallet /> Wallet
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {showFields.email && (
              <div className="search-input-wrapper">
                <FaEnvelope className="search-icon" style={{left: '10px'}}/>
                <input 
                    placeholder="Email Address" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    style={{ paddingLeft: '35px', borderLeft: '3px solid #01a2ff' }}
                />
              </div>
            )}
            {showFields.discord && (
               <div className="search-input-wrapper">
                <FaDiscord className="search-icon" style={{left: '10px'}}/>
                <input 
                    placeholder="Discord Username" 
                    value={formData.discord} 
                    onChange={e => setFormData({...formData, discord: e.target.value})} 
                    style={{ paddingLeft: '35px', borderLeft: '3px solid #5865F2' }}
                />
              </div>
            )}
            {showFields.x && (
               <div className="search-input-wrapper">
                <FaTwitter className="search-icon" style={{left: '10px'}}/>
                <input 
                    placeholder="X / Twitter Handle" 
                    value={formData.x} 
                    onChange={e => setFormData({...formData, x: e.target.value})} 
                    style={{ paddingLeft: '35px', borderLeft: '3px solid #ffffff' }}
                />
               </div>
            )}
            {showFields.address && (
               <div className="search-input-wrapper">
                <FaWallet className="search-icon" style={{left: '10px'}}/>
                <input 
                    placeholder="Wallet Address" 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                    style={{ paddingLeft: '35px', borderLeft: '3px solid #f3ba2f' }}
                />
               </div>
            )}
          </div>
          
          <div className="form-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button type="submit" className="btn-manage btn-import">
    <FaSave /> <span>{isEditMode ? 'Update Data' : 'Tambah Waitlist'}</span>
  </button>
            <button type="button" className="cancel-btn" onClick={() => {
              setIsEditMode(false);
              setFormData({ nama: '', link: '', email: '', x: '', discord: '', address: '' });
              setShowFields({ email: false, x: false, discord: false, address: false });
            }}>
                <FaUndo /> Reset
            </button>
          </div>
        </form>

        <p style={{ fontSize: '12px', color: '#d3d3d3', textAlign: 'center', marginTop: '15px' }}>
            Kelola status atau hapus data di <Link to="/" style={{ color: '#01a2ff' }}>Halaman Utama</Link>
        </p>
      </div>

      <div className="table-container" style={{ marginTop: '30px' }}>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Info Akun</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {waitlistTasks.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px' }}>Belum ada data waitlist.</td></tr>
            ) : (
              waitlistTasks.map(item => (
                <tr key={item.id}>
                  <td data-label="Project" style={{ verticalAlign: 'middle' }}>
                    <strong>{item.nama}</strong>
                  </td>
                  <td data-label="Info Akun">
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {item.emailUsed && <span style={{display:'flex', alignItems:'center', gap:'5px'}}><FaEnvelope color="#01a2ff"/> {item.emailUsed}</span>}
                      {item.discordUsed && <span style={{display:'flex', alignItems:'center', gap:'5px'}}><FaDiscord color="#5865F2"/> {item.discordUsed}</span>}
                      {item.xUsed && <span style={{display:'flex', alignItems:'center', gap:'5px'}}><FaTwitter color="#fff"/> {item.xUsed}</span>}
                      {(item as any).walletAddress && (
                        <span style={{ color: '#f3ba2f', wordBreak: 'break-all', display:'flex', alignItems:'center', gap:'5px' }}>
                          <FaWallet /> {(item as any).walletAddress}
                        </span>
                      )}
                      {!item.emailUsed && !item.discordUsed && !item.xUsed && !(item as any).walletAddress && <span style={{color: '#444'}}>- No Details -</span>}
                    </div>
                  </td>
                  <td data-label="Action" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                      <a href={item.link} target="_blank" rel="noreferrer" className="open-link" title="Buka Link">
                          <FaExternalLinkAlt />
                      </a>
                      <button className="action-btn edit-btn" onClick={() => handleEdit(item)} title="Edit Data">
                          <FaEdit />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
