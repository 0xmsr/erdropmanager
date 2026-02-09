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
  FaUndo
} from 'react-icons/fa';

export const Home: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('airdropTasks');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [formData, setFormData] = useState<Partial<Task>>({
    nama: '', tugas: '', link: '', akun: 1, status: 'Ongoing'
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [filter, setFilter] = useState('Semua');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [alertData, setAlertData] = useState<{ isOpen: boolean; msg: string; type: 'success' | 'error' | 'hapus' | 'info' }>({
    isOpen: false, msg: '', type: 'info'
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
        selesaiHariIni: isWaitlist ? true : false,
        tanggalDitambahkan: timestamp
      };
      setTasks([...tasks, newTask]);
      showAlert('Garapan baru berhasil ditambahkan!', 'success');
    }
    
    setFormData({ nama: '', tugas: '', link: '', akun: 1, status: 'Ongoing' });
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

  const filteredTasks = tasks.filter(t => {
    const matchSearch = t.nama.toLowerCase().includes(search.toLowerCase()) || t.tugas.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'Semua' || t.status === filter;
    return matchSearch && matchFilter;
  });

  const totalPages = Math.ceil(filteredTasks.length / rowsPerPage);
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const paginatedTasks = filteredTasks.slice((validCurrentPage - 1) * rowsPerPage, validCurrentPage * rowsPerPage);

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
            <option value="Waitlist">Waitlist</option>
            <option value="END">END</option>
            <option value="Nunggu Info">Nunggu Info</option>
          </select>
          <div className="form-buttons">
            <button type="submit">
                {isEditMode ? <><FaCheck /> Update</> : <><FaPlus /> Tambah</>}
            </button>
            <button type="button" onClick={() => {
              setIsEditMode(false);
              setFormData({ nama: '', tugas: '', link: '', akun: 1, status: 'Ongoing' });
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
          <option value="Semua">Semua Status</option>
          <option value="Ongoing">Ongoing</option>
          <option value="Waitlist">Waitlist</option>
          <option value="END">END</option>
          <option value="Nunggu Info">Nunggu Info</option>
        </select>
      </div>

      <div className="data-management-container">
        <button onClick={handleExport} disabled={tasks.length === 0}className="btn-manage btn-export"style={{ opacity: tasks.length === 0 ? 0.5 : 1 }}
  ><FaFileExport /> <span>Export Backup</span></button>
  
        <button onClick={handleImportClick} className="btn-manage btn-import"
  ><FaFileImport /> <span>Import Data</span>
  </button>
  
  <input 
    type="file" 
    ref={fileInputRef} 
    accept=".txt" 
    style={{ display: 'none' }} 
    onChange={handleImport} 
  />
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
              <tr><td colSpan={7} style={{textAlign: 'center', padding: '20px', color: '#888'}}>
                {search || filter !== 'Semua' ? 'Tidak ditemukan data yang cocok.' : 'Belum ada garapan.'}
              </td></tr>
            ) : paginatedTasks.map(task => (
              <tr key={task.id}>
                <td data-label="Nama"><strong>{task.nama}</strong></td>
                <td data-label="Tugas">{task.tugas || '-'}</td>
                <td data-label="Link">
                    {task.link ? (
                        <a href={task.link} target="_blank" rel="noreferrer" className="open-link" 
                           title="Buka Link"
                           onClick={() => { if(!task.selesaiHariIni) toggleToday(task.id); }}>
                            <FaExternalLinkAlt /> Open
                        </a>
                    ) : '-'}
                </td>
                <td data-label="Akun">{task.akun}</td>
                <td data-label="Status">
                  <span className={`status ${task.status.toLowerCase().replace(' ', '-')}`}>{task.status}</span>
                </td>
                <td data-label="Hari Ini">
                  <button 
                    className={`today-btn ${task.selesaiHariIni ? 'selesai' : 'belum'}`}
                    onClick={() => toggleToday(task.id)}
                    title={task.selesaiHariIni ? 'Tandai belum selesai' : 'Tandai selesai'}
                  >
                    {task.selesaiHariIni ? <FaCheck /> : <FaTimes />}
                  </button>
                </td>
                <td data-label="Aksi">
                  <div className="action-buttons-wrapper">
                    <button className="action-btn edit-btn" onClick={() => handleEdit(task)} title="Edit">
                        <FaEdit />
                    </button>
                    <button className="action-btn delete-btn" onClick={() => handleDelete(task.id)} title="Hapus">
                        <FaTrash />
                    </button>
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
            <span>Page {validCurrentPage} of {totalPages}</span>
            <button disabled={validCurrentPage >= totalPages} onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}>Next</button>
        </div>
      )}

      <hr></hr>
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
