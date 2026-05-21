import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import {
  FaShieldAlt, FaKey, FaDatabase, FaExchangeAlt,
  FaChartLine, FaGavel, FaCode, FaCheckCircle, FaArrowLeft,
} from 'react-icons/fa';

const CLAUSES = [
  {
    num: '§ 01',
    icon: <FaShieldAlt />,
    color: '#f44336',
    title: 'Risiko Ditanggung Sendiri',
    body: `Tool ini adalah alat bantu lokal untuk generate dan manage wallet crypto. Segala kerugian — baik akibat wallet bocor, private key terekspos, salah kirim, kena hack, atau nasib sial lainnya — sepenuhnya menjadi tanggung jawab pengguna. Developer, IAC Community, maupun siapapun yang terlibat dalam pembuatan tool ini tidak bertanggung jawab atas apapun.`,
  },
  {
    num: '§ 02',
    icon: <FaKey />,
    color: '#f44336',
    title: 'Private Key & Mnemonic',
    body: `Private key dan mnemonic phrase yang digenerate adalah akses penuh ke wallet kamu. Siapapun yang punya ini bisa ambil semua aset tanpa bisa dibatalkan. Jangan screenshot sembarangan, jangan input di website lain, jangan kirim ke siapapun meski "dipercaya". Kalau hilang atau bocor — selesai, tidak ada recovery.`,
  },
  {
    num: '§ 03',
    icon: <FaDatabase />,
    color: '#ff9800',
    title: 'Data Tersimpan Lokal',
    body: `Tool ini menyimpan wallet data di localStorage browser. Tidak ada data yang dikirim ke server manapun. Konsekuensinya: clear browser data = hilang semua wallet, ganti browser = hilang, mode incognito = tidak tersimpan. Backup manual adalah kewajiban kamu, bukan kami.`,
  },
  {
    num: '§ 04',
    icon: <FaExchangeAlt />,
    color: '#ff9800',
    title: 'Transaksi On-Chain Irreversible',
    body: `Kirim ke address salah? Tidak bisa ditarik kembali. Masuk network salah? Mungkin hilang selamanya. Selalu double-check address dan network sebelum konfirmasi. Tool ini hanya memfasilitasi pembentukan transaksi — eksekusi ada di tangan kamu sendiri.`,
  },
  {
    num: '§ 05',
    icon: <FaChartLine />,
    color: '#2196f3',
    title: 'Bukan Financial Advice',
    body: `Tidak ada bagian dari tool ini yang bisa diinterpretasikan sebagai saran finansial, investasi, atau trading. Semua keputusan finansial sepenuhnya ada di kamu. Crypto sangat volatile dan kamu bisa kehilangan semua modal dalam sekejap.`,
  },
  {
    num: '§ 06',
    icon: <FaGavel />,
    color: '#9e9e9e',
    title: 'Penggunaan Legal',
    body: `Pengguna bertanggung jawab memastikan penggunaan tool ini sesuai regulasi crypto di negara/wilayah masing-masing. Penyalahgunaan untuk aktivitas ilegal (money laundering, fraud, dll) adalah tanggung jawab pengguna sepenuhnya. Kami tidak mau tahu, dan memang tidak bisa tahu.`,
  },
  {
    num: '§ 07',
    icon: <FaCode />,
    color: '#4caf50',
    title: 'Open Source & As-Is',
    body: `Tool ini dibuat dengan sebaik mungkin tapi disediakan apa adanya (as-is) tanpa warranty apapun. Bug mungkin ada, behavior unexpected mungkin terjadi. Selalu test dengan jumlah kecil dulu sebelum eksekusi besar. Lapor bug = membantu komunitas, pakai tanpa test = risiko sendiri.`,
  },
];

const CHECKBOXES = [
  'Saya paham semua risiko dan siap menanggung sendiri tanpa menyalahkan developer atau komunitas IAC',
  'Saya tidak akan pernah share private key / mnemonic ke siapapun, termasuk ke "support" yang tiba-tiba DM',
  'Saya akan backup wallet secara mandiri dan tidak menyalahkan tool kalau localStorage ke-clear',
  'Saya mengerti ini bukan financial advice dan crypto bisa bikin saldo jadi 0 dengan cepatnya wkwk',
];

export const ToS: React.FC = () => {
  const navigate = useNavigate();
  const [checked, setChecked] = useState<boolean[]>(Array(CHECKBOXES.length).fill(false));
  const allChecked = checked.every(Boolean);

  const toggle = (i: number) =>
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v));
  const handleAgree = () => {
    if (!allChecked) return;
    localStorage.setItem('tosAgreed', 'true');
    navigate('/wallet-gen');
  };

  return (
    <div className="app-container">
      <header>
        <h1>
          <FaShieldAlt style={{ marginRight: '8px', color: '#f44336' }} />
          Terms of Service
          <span style={{ fontSize: '12px', color: '#555', fontWeight: 'normal', marginLeft: '10px' }}>
            WalletGen · v1.0
          </span>
        </h1>
      </header>
      <Navbar />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <Link to="/wallet-gen" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#555', textDecoration: 'none', fontSize: '12px' }}>
          <FaArrowLeft size={11} /> Kembali ke Wallet Gen
        </Link>
        <span style={{ fontSize: '10px', color: '#333', border: '1px solid #f4433630', padding: '3px 10px', letterSpacing: '1px' }}>
          ⚠ BACA SAMPAI HABIS
        </span>
      </div>

      {/* Clauses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
        {CLAUSES.map((c) => (
          <div key={c.num} style={{
            background: '#0d0d0d',
            border: '1px solid #1e1e1e',
            borderLeft: `3px solid ${c.color}`,
            padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ color: c.color, fontSize: '13px' }}>{c.icon}</span>
              <span style={{ fontSize: '10px', color: '#444', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{c.num}</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{c.title}</span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#888', lineHeight: '1.7' }}>{c.body}</p>
          </div>
        ))}
      </div>

      {/* Agreement box */}
      <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderTop: '2px solid #f44336', padding: '20px', marginBottom: '28px' }}>
        <div style={{ fontSize: '10px', color: '#555', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '16px' }}>
          Pernyataan Persetujuan · Centang semua untuk lanjut
        </div>

        {CHECKBOXES.map((label, i) => (
          <label key={i} onClick={() => toggle(i)} style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            cursor: 'pointer', marginBottom: '12px',
          }}>
            <div style={{
              width: '16px', height: '16px', flexShrink: 0, marginTop: '1px',
              border: `1px solid ${checked[i] ? '#f44336' : '#333'}`,
              background: checked[i] ? '#1a0000' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              {checked[i] && <FaCheckCircle size={10} color="#f44336" />}
            </div>
            <span style={{ fontSize: '12px', color: checked[i] ? '#ccc' : '#666', lineHeight: '1.5', userSelect: 'none' }}>
              {label}
            </span>
          </label>
        ))}

        <button
          onClick={handleAgree}
          disabled={!allChecked}
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '13px',
            background: allChecked ? '#f44336' : 'transparent',
            color: allChecked ? '#fff' : '#333',
            border: `1px solid ${allChecked ? '#f44336' : '#333'}`,
            cursor: allChecked ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {allChecked
            ? <><FaCheckCircle /> SETUJU & LANJUT KE WALLET GEN</>
            : `⚠ CENTANG SEMUA DULU (${checked.filter(Boolean).length}/${CHECKBOXES.length})`}
        </button>
      </div>

      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
