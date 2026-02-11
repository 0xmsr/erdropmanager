import React, { useState, useEffect, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { type Task, type ExportData } from '../types';
import { Navbar } from '../components/Navbar';
import { CustomAlert, CustomConfirm, CustomPrompt } from '../components/CustomModals';

import { 
  FaEdit, 
  FaTrash, 
  FaExternalLinkAlt, 
  FaCheck, 
  FaTimes, 
  FaSearch, 
  FaFileImport, 
  FaFileExport, 
  FaPlus,
  FaUndo,
  FaWallet
} from 'react-icons/fa';

export const Home: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
  try {
    const saved = localStorage.getItem('airdropTasks');
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    console.error("Gagal memuat data:", err);
    return [];
  }
});

  const [masterWallets, setMasterWallets] = useState<{id: string, name: string, address: string}[]>(() => {
    const saved = localStorage.getItem('masterWallets');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [formData, setFormData] = useState<Partial<Task>>({
    nama: '', 
    tugas: '', 
    link: '', 
    akun: 1, 
    status: 'Ongoing',
    kategori: '',
    detailAkun: []
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [filter, setFilter] = useState('Semua');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<'terbaru' | 'terlama' | 'nama' | 'status'>('terbaru');
  const [alertData, setAlertData] = useState<{ isOpen: boolean; msg: string; type: 'success' | 'error' | 'hapus' | 'info' }>({
    isOpen: false, msg: '', type: 'info'
  });

  const [accountModal, setAccountModal] = useState<{isOpen: boolean, taskId: number | null, details: string[]}>({
    isOpen: false, taskId: null, details: []
  });

  const [confirmData, setConfirmData] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    onConfirmAction: (() => void) | null 
  }>({
    isOpen: false, title: '', message: '', onConfirmAction: null
  });

  const [promptData, setPromptData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    inputType: 'text' | 'password';
    onConfirmAction: ((val: string) => void) | null;
  }>({
    isOpen: false, title: '', message: '', inputType: 'text', onConfirmAction: null
  });

  const showAlert = (msg: string, type: 'success' | 'error' | 'hapus' | 'info' = 'info') => {
    setAlertData({ isOpen: true, msg, type });
  };

  const showConfirm = (title: string, message: string, action: () => void) => {
    setConfirmData({ isOpen: true, title, message, onConfirmAction: action });
  };

  const showPrompt = (title: string, message: string, action: (val: string) => void, isPassword = false) => {
    setPromptData({
      isOpen: true,
      title,
      message,
      inputType: isPassword ? 'password' : 'text',
      onConfirmAction: action
    });
  };

  useEffect(() => {
    localStorage.setItem('airdropTasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('masterWallets', JSON.stringify(masterWallets));
  }, [masterWallets]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  useEffect(() => {
    const checkDailyReset = (notify: boolean = true) => {
      const RESET_HOUR_WIB = 7;
      const lastReset = localStorage.getItem('lastReset');
      const now = new Date();
      const todayResetTime = new Date();
      todayResetTime.setHours(RESET_HOUR_WIB, 0, 0, 0);

      if (!lastReset || new Date(parseInt(lastReset)) < todayResetTime) {
        if (now.getHours() >= RESET_HOUR_WIB) {
          setTasks(prev => prev.map(t => {
            if (t.status === 'Waitlist' || t.status === 'END') return t;
            return { ...t, selesaiHariIni: false };
          }));
          localStorage.setItem('lastReset', now.getTime().toString());
          if (notify) {
            showAlert("Waktunya Cek Garapan Harian! Status telah direset.", 'info');
          }
        }
      }
    };
    
    checkDailyReset(false); 
    const interval = setInterval(() => checkDailyReset(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const addMasterWallet = () => {
    showPrompt(
      "NAMA WALLET",
      "Masukkan Nama Wallet (Contoh: Akun 1 / Metamask):",
      (name) => {
        if (!name) return;
        setPromptData(prev => ({ ...prev, isOpen: false }));
        
        setTimeout(() => {
          showPrompt(
            "WALLET ADDRESS",
            `Masukkan Wallet Address untuk ${name}:`,
            (address) => {
              if (address) {
                setMasterWallets(prev => [...prev, { id: Date.now().toString(), name, address }]);
                showAlert("Wallet berhasil ditambahkan!", "success");
              }
              setPromptData(prev => ({ ...prev, isOpen: false }));
            }
          );
        }, 300);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama) return;

    let formattedLink = formData.link || "";
    if (formattedLink.trim() !== "") {
      if (!/^https?:\/\//i.test(formattedLink)) {
        formattedLink = `https://${formattedLink.trim()}`;
      }
    }

    const now = new Date();
    const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const isWaitlist = formData.status === 'Waitlist';

    if (isEditMode && formData.id) {
      setTasks(tasks.map(t => t.id === formData.id ? { 
        ...t, 
        ...formData, 
        link: formattedLink,
        selesaiHariIni: isWaitlist ? true : t.selesaiHariIni
      } as Task : t));
      setIsEditMode(false);
      showAlert('Data berhasil diperbarui!', 'success');
    } else {
      const newTask: Task = {
        id: Date.now(),
        nama: formData.nama!,
        tugas: formData.tugas || '',
        link: formattedLink,
        akun: Number(formData.akun) || 1,
        status: (formData.status as any) || 'Ongoing',
        kategori: formData.kategori || '',
        detailAkun: Array(Number(formData.akun) || 1).fill(''),
        selesaiHariIni: formData.status === 'Waitlist',
        tanggalDitambahkan: timestamp
      };
      setTasks([...tasks, newTask]);
      showAlert('Garapan baru berhasil ditambahkan!', 'success');
    }
    
    setFormData({ nama: '', tugas: '', link: '', akun: 1, status: 'Ongoing', kategori: '' });
  };

  const handleDelete = (id: number) => {
    showConfirm(
      'HAPUS GARAPAN?',
      'Apakah Anda yakin ingin menghapus garapan ini? Data yang dihapus tidak dapat dikembalikan.',
      () => {
        setTasks(prev => prev.filter(t => t.id !== id));
        showAlert('Garapan berhasil dihapus.', 'hapus');
      }
    );
  };

  const handleEdit = (task: Task) => {
    setFormData(task);
    setIsEditMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleToday = (id: number) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        if (t.status === 'Waitlist') return { ...t, selesaiHariIni: true };
        return { ...t, selesaiHariIni: !t.selesaiHariIni };
      }
      return t;
    }));
  };

  const handleExport = () => {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    if (tasks.length === 0 && transactions.length === 0) {
      showAlert("Tidak ada data untuk dibackup!", 'error');
      return;
    }

    showPrompt(
      'PASSWORD ENKRIPSI',
      'Masukkan password untuk mengamankan file backup (kosongkan jika tidak ingin dienkripsi):',
      (password) => {
        const data: ExportData = { airdropTasks: tasks, financeTransactions: transactions };
        let content = JSON.stringify(data, null, 2);

        if (password) {
          try {
            const encrypted = CryptoJS.AES.encrypt(content, password).toString();
            content = JSON.stringify({ encryptedData: encrypted });
          } catch (e) {
            showAlert('Gagal mengenkripsi data', 'error');
            return;
          }
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `airdrop-backup-${new Date().toISOString().split('T')[0]}.txt`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        setPromptData(prev => ({ ...prev, isOpen: false }));
        showAlert('Data berhasil di-export!', 'success');
      },
      true
    );
  };

  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const resultString = event.target?.result as string;
        let parsed;
        try {
            parsed = JSON.parse(resultString);
        } catch (jsonError) {
             showAlert('File rusak atau bukan format JSON yang valid.', 'error');
             return;
        }
        
        const performRestore = (data: any) => {
           if (data.airdropTasks) {
            showConfirm(
              'TIMPA DATA?',
              'Import data akan menggabungkan/menimpa data yang ada sekarang. Lanjutkan?',
              () => {
                setTasks(data.airdropTasks);
                if (data.financeTransactions) {
                  localStorage.setItem('transactions', JSON.stringify(data.financeTransactions));
                }
                showAlert('Data berhasil dimuat ulang!', 'success');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }
            );
          } else {
            showAlert('Format data di dalam file tidak dikenali.', 'error');
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };

        if (parsed.encryptedData) {
          showPrompt(
            'FILE TERENKRIPSI',
            'File ini dilindungi password. Masukkan password untuk membuka:',
            (password) => {
              if (!password) {
                 showAlert('Password diperlukan untuk membuka file ini.', 'error');
                 if (fileInputRef.current) fileInputRef.current.value = '';
                 setPromptData(prev => ({ ...prev, isOpen: false }));
                 return;
              }
              try {
                const bytes = CryptoJS.AES.decrypt(parsed.encryptedData, password);
                const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
                if (!decryptedString) throw new Error("Password salah");
                const decryptedData = JSON.parse(decryptedString);
                setPromptData(prev => ({ ...prev, isOpen: false }));
                performRestore(decryptedData);
              } catch (err) {
                showAlert('Password salah atau file rusak.', 'error');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }
            },
            true
          );
        } else {
          performRestore(parsed);
        }
      } catch (err) {
        showAlert('Terjadi kesalahan saat membaca file.', 'error');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'nama') return a.nama.localeCompare(b.nama);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    if (sortBy === 'terlama') return a.id - b.id;
    return b.id - a.id;
  });

  const filteredTasks = sortedTasks.filter(t => {
    const matchSearch = 
        t.nama.toLowerCase().includes(search.toLowerCase()) || 
        t.tugas.toLowerCase().includes(search.toLowerCase()) ||
        (t.walletAddress && t.walletAddress.toLowerCase().includes(search.toLowerCase())); // Tambahkan ini

    const matchFilter = filter === 'Semua' || t.status === filter || t.kategori === filter;
    
    return matchSearch && matchFilter;
});

  const totalPages = Math.ceil(filteredTasks.length / rowsPerPage);
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const paginatedTasks = filteredTasks.slice((validCurrentPage - 1) * rowsPerPage, validCurrentPage * rowsPerPage);

  const completedCount = tasks.filter(t => t.selesaiHariIni).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
  
  const getWalletStatus = (task: Task) => {
  const filledDetails = task.detailAkun?.filter(d => d.trim() !== '').length || 0;
  
  if (filledDetails > 0) {
    return `${filledDetails}/${task.akun} Wallet`;
  }
  if (task.walletAddress && task.walletAddress.trim() !== '') {
    return "1 Wallet (Waitlist)";
  }

  return "No Wallet";
};

  return (
    <div className="app-container">
      <CustomAlert 
        isOpen={alertData.isOpen}
        message={alertData.msg}
        type={alertData.type}
        onClose={() => setAlertData({ ...alertData, isOpen: false })}
      />
      <CustomConfirm
        isOpen={confirmData.isOpen}
        title={confirmData.title}
        message={confirmData.message}
        onCancel={() => setConfirmData({ ...confirmData, isOpen: false })}
        onConfirm={() => {
          if (confirmData.onConfirmAction) confirmData.onConfirmAction();
          setConfirmData({ ...confirmData, isOpen: false });
        }}
      />
      <CustomPrompt
        isOpen={promptData.isOpen}
        title={promptData.title}
        message={promptData.message}
        inputType={promptData.inputType}
        onCancel={() => setPromptData({ ...promptData, isOpen: false })}
        onConfirm={(val) => {
          if (promptData.onConfirmAction) promptData.onConfirmAction(val);
        }}
      />

      {isMasterModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="modal-content" style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', width: '95%', maxWidth: '500px', border: '1px solid #333' }}>
            <h3 style={{ margin: '0 0 15px 0' }}><FaWallet /> Wallet Profile</h3>
            <button onClick={addMasterWallet} style={{ width: '100%', padding: '10px', background: '#646cff', color: 'white', border: 'none', borderRadius: '6px', marginBottom: '15px', cursor: 'pointer' }}>
              + Tambah Profile Baru
            </button>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {masterWallets.length === 0 ? <p style={{ textAlign: 'center', color: '#666' }}>Belum ada wallet terdaftar.</p> : 
                masterWallets.map(mw => (
                  <div key={mw.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#252525', padding: '10px', borderRadius: '6px', marginBottom: '8px' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{mw.name}</div>
                      <div style={{ fontSize: '11px', color: '#888', textOverflow: 'ellipsis', overflow: 'hidden' }}>{mw.address}</div>
                    </div>
                    <button onClick={() => setMasterWallets(masterWallets.filter(m => m.id !== mw.id))} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', padding: '5px' }}>
                      <FaTrash size={14} />
                    </button>
                  </div>
                ))
              }
            </div>
            <button onClick={() => setIsMasterModalOpen(false)} style={{ width: '100%', marginTop: '15px', padding: '10px', background: '#333', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Tutup</button>
          </div>
        </div>
      )}

      {accountModal.isOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}><FaWallet /> Detail Akun</h3>
              <button 
                onClick={() => {
                  const allWallets = accountModal.details.filter(d => d.trim() !== "").join('\n');
                  if (allWallets) {
                    navigator.clipboard.writeText(allWallets);
                    showAlert("Semua alamat berhasil disalin!", "success");
                  } else {
                    showAlert("Tidak ada alamat untuk disalin", "error");
                  }
                }}
                style={{ fontSize: '11px', padding: '4px 8px', background: '#444', color: '#fff', border: '1px solid #666', borderRadius: '4px', cursor: 'pointer' }}
              >
                Copy All
              </button>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', margin: '15px 0', paddingRight: '5px' }}>
              {accountModal.details.map((detail, idx) => (
                <div key={idx} style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #333' }}>
                  <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '5px' }}>Akun {idx + 1}</label>
                  
                  <select 
                    style={{ width: '100%', background: '#222', color: 'white', border: '1px solid #444', padding: '5px', borderRadius: '4px', marginBottom: '5px', fontSize: '12px' }}
                    onChange={(e) => {
                      const selected = masterWallets.find(mw => mw.address === e.target.value);
                      if (selected) {
                        const newDetails = [...accountModal.details];
                        newDetails[idx] = selected.address;
                        setAccountModal({ ...accountModal, details: newDetails });
                      }
                    }}
                  >
                    <option value="">-- Pilih dari Wallet Profile --</option>
                    {masterWallets.map(mw => (
                      <option key={mw.id} value={mw.address}>{mw.name}</option>
                    ))}
                  </select>

                  <input 
                    style={{ width: '100%', background: '#2d2d2d', border: '1px solid #444', color: 'white', padding: '8px', borderRadius: '4px', boxSizing: 'border-box' }}
                    value={detail}
                    onChange={(e) => {
                      const newDetails = [...accountModal.details];
                      newDetails[idx] = e.target.value;
                      setAccountModal({ ...accountModal, details: newDetails });
                    }}
                    placeholder="Alamat Wallet / Profil"
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ flex: 1, background: '#4CAF50', color: 'white', border: 'none', padding: '10px', borderRadius: '6px' }} onClick={() => {
                if (accountModal.taskId) {
                  setTasks(tasks.map(t => t.id === accountModal.taskId ? { ...t, detailAkun: accountModal.details } : t));
                  setAccountModal({ isOpen: false, taskId: null, details: [] });
                  showAlert("Detail disimpan!", "success");
                }
              }}>Simpan</button>
              <button style={{ flex: 1, background: '#f44336', color: 'white', border: 'none', padding: '10px', borderRadius: '6px' }} onClick={() => setAccountModal({ isOpen: false, taskId: null, details: [] })}>Batal</button>
            </div>
          </div>
        </div>
      )}

      <header>
        <h1>Erdrop Manager</h1>
      </header>
      <Navbar />

      <div className="form-container">
        <h2 style={{ textAlign: 'center' }}>
            {isEditMode ? <><FaEdit /> Edit Garapan</> : <><FaPlus /> Tambah Garapan</>}
        </h2>
        <form onSubmit={handleSubmit}>
          <input 
            value={formData.nama || ''} 
            onChange={e => setFormData({...formData, nama: e.target.value})} 
            placeholder="Contoh: Walrus" required 
          />
          <input 
            value={formData.tugas || ''} 
            onChange={e => setFormData({...formData, tugas: e.target.value})} 
            placeholder="Tugas (Daily)" required
          />
          <input 
            value={formData.link || ''} 
            onChange={e => setFormData({...formData, link: e.target.value})} 
            placeholder="Link (https://)" required
          />
          <select 
            value={formData.kategori || ''} 
            onChange={e => setFormData({...formData, kategori: e.target.value})}
          >
            <option>Pilih Kategori (Opsional)</option>
            <option value="Testnet">Testnet</option>
            <option value="Mainnet">Mainnet</option>
            <option value="Telegram Bot">Telegram Bot</option>
            <option value="Node">Node</option>
            <option value="Whitelist">Whitelist</option>
          </select>
          <input 
            type="number" 
            value={formData.akun || 1} 
            onChange={e => setFormData({...formData, akun: parseInt(e.target.value)})} 
            placeholder="Jumlah Akun" 
            min="1"
          />
          <select 
            value={formData.status || 'Ongoing'} 
            onChange={e => setFormData({...formData, status: e.target.value as any})}
          >
            <option value="Ongoing">Ongoing</option>
            <option value="END">END</option>
            <option value="Nunggu Info">Nunggu Info</option>
          </select>
          <div className="form-buttons">
            <button type="submit">
                {isEditMode ? <><FaCheck /> Update</> : <><FaPlus /> Tambah</>}
            </button>
            <button type="button" onClick={() => {
              setIsEditMode(false);
              setFormData({ nama: '', tugas: '', link: '', akun: 1, status: 'Ongoing', kategori: 'Testnet' });
            }}>
                <FaUndo /> Reset
            </button>
          </div>
        </form>
      </div>

      <div className="filter-container search-filter-bar">
        <div className="search-input-wrapper">
             <FaSearch className="search-icon" />
             <input 
              type="search" 
              placeholder="Cari garapan..." 
              value={search}
              onChange={e => setSearch(e.target.value)} 
            />
        </div>
        
        <select onChange={e => setFilter(e.target.value)} value={filter} className="status-filter">
          <option value="Semua">Semua Data</option>
          <optgroup label="Status">
            <option value="Ongoing">Ongoing</option>
            <option value="Waitlist">Waitlist</option>
            <option value="END">END</option>
          </optgroup>
          <optgroup label="Kategori">
            <option value="Testnet">Testnet</option>
            <option value="Mainnet">Mainnet</option>
            <option value="Telegram Bot">Telegram Bot</option>
            <option value="Node">Node</option>
          </optgroup>
        </select>

        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value as any)} 
          className="sort-filter"
        >
          <option value="terbaru">Terbaru</option>
          <option value="terlama">Terlama</option>
          <option value="nama">Nama (A-Z)</option>
          <option value="status">Status</option>
        </select>
      </div>

      <div className="data-management-container">
        <button onClick={handleExport} disabled={tasks.length === 0} className="btn-manage btn-export" style={{ opacity: tasks.length === 0 ? 0.5 : 1 }}>
          <FaFileExport /> <span>Export</span>
        </button>
        <button onClick={handleImportClick} className="btn-manage btn-import">
          <FaFileImport /> <span>Import</span>
        </button>
        <button onClick={() => setIsMasterModalOpen(true)} className="btn-manage" style={{ background: '#673ab7', color: 'white' }}>
          <FaWallet /> <span>Wallet</span>
        </button>
        <input type="file" ref={fileInputRef} accept=".txt" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      <div className="progress-wrapper" style={{ width: '100%', margin: '15px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 500 }}>Progress Garapan</span>
          <span style={{ fontSize: '12px', color: '#ffffff', fontWeight: 'bold' }}>
            {progressPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="progress-container" style={{ width: '100%', background: '#222', borderRadius: '10px', height: '12px', border: '1px solid #333', overflow: 'hidden' }}>
          <div style={{
            width: `${progressPercentage}%`, 
            height: '100%', 
            background: 'linear-gradient(90deg, #646cff, #646cff15)', 
            transition: 'width 0.5s ease'
          }}></div>
        </div>
        <p style={{ fontSize: '11px', textAlign: 'right', color: '#888', marginTop: '6px' }}>
          <strong>{completedCount}</strong> dari <strong>{tasks.length}</strong> tugas selesai
        </p>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Tugas</th>
              <th>Link</th>
              <th>Akun</th>
              <th>Status</th>
              <th>Hari Ini</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} style={{textAlign: 'center', padding: '20px', color: '#888'}}>
                  {search || filter !== 'Semua' ? 'Tidak ditemukan data.' : 'Belum ada garapan.'}
                </td>
              </tr>
            ) : paginatedTasks.map(task => (
              <tr key={task.id}>
                <td data-label="Nama">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{task.nama}</strong>
                    {task.kategori && (
                      <span style={{ fontSize: '10px', background: '#333', padding: '2px 6px', borderRadius: '4px', color: '#aaa', width: 'fit-content', marginTop: '4px' }}>
                        {task.kategori}
                      </span>
                    )}
                  </div>
                </td>
                <td data-label="Tugas">{task.tugas || '-'}</td>
                <td data-label="Link">
                  {task.link ? (
                    <a href={task.link} target="_blank" rel="noreferrer" className="open-link" 
                       onClick={() => { if(!task.selesaiHariIni) toggleToday(task.id); }}>
                      <FaExternalLinkAlt /> Open
                    </a>
                  ) : '-'}
                </td>
                <td data-label="Akun">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{task.akun} Akun</span>
                      <small style={{ 
                        fontSize: '10px', 
                        color: task.walletAddress ? '#646cff' : '#888'
                        }}>
                          ({getWalletStatus(task)})
                          </small>
                          </div>
                      <button 
                        type="button"
                        onClick={() => setAccountModal({
                        isOpen: true,
                        taskId: task.id,
                        details: task.detailAkun && task.detailAkun.length > 0 ? task.detailAkun : (task.walletAddress ? [task.walletAddress, ...Array(task.akun - 1).fill('')] : Array(task.akun).fill(''))
                      })}
                      style={{ 
                        padding: '4px 6px', 
                        background: task.walletAddress ? '#f3ba2f' : '#2196F3',
                        borderRadius: '4px', 
                        border: 'none', 
                        cursor: 'pointer', 
                        color: task.walletAddress ? '#000' : 'white' 
                      }} title={task.walletAddress ? `Terdeteksi: ${task.walletAddress}` : "Input Wallet"} ><FaWallet size={12} />
                      </button>
                      </div>
                </td>
                <td data-label="Status">
                  <span className={`status ${task.status.toLowerCase().replace(' ', '-')}`}>{task.status}</span>
                </td>
                <td data-label="Hari Ini">
                  <button 
                    className={`today-btn ${task.selesaiHariIni ? 'selesai' : 'belum'}`}
                    onClick={() => toggleToday(task.id)}
                  >
                    {task.selesaiHariIni ? <FaCheck /> : <FaTimes />}
                  </button>
                </td>
                <td data-label="Aksi">
                  <div className="action-buttons-wrapper">
                    <button className="action-btn edit-btn" onClick={() => handleEdit(task)}><FaEdit /></button>
                    <button className="action-btn delete-btn" onClick={() => handleDelete(task.id)}><FaTrash /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination-container">
            <button disabled={validCurrentPage === 1} onClick={() => setCurrentPage(c => Math.max(1, c - 1))}>Prev</button>
            <span>{validCurrentPage} / {totalPages}</span>
            <button disabled={validCurrentPage >= totalPages} onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}>Next</button>
        </div>
      )}

      <hr />
      <div style={{textAlign:'center', marginTop:'20px'}}>
        <a href='https://t.me/airdropiac' target='_blank' style={{marginRight: '10px'}}>
            <button>| Join Channel Telegram |</button>
        </a>
        <a href='https://twitter.com/intent/follow?screen_name=iaccommunity_' target="_blank" rel="noreferrer">
            <button>| Follow X |</button>
        </a>
      </div>
      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
