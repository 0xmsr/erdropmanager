import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import {
  FaHistory, FaPlusCircle, FaWrench, FaBug, FaRocket,
  FaChevronDown, FaChevronUp,
} from 'react-icons/fa';

type ChangeType = 'feature' | 'improvement' | 'fix';

interface ChangeEntry {
  type: ChangeType;
  text: string;
}

interface Version {
  version: string;
  date: string;
  title: string;
  changes: ChangeEntry[];
}

const CHANGELOG: Version[] = [
   {
    version: '2.2.0',
    date: '00 Agu 2026',
    title: 'Update v2.2.0',
    changes: [
      { type: 'feature', text: 'Menambahkan api CoinGecko untuk kurs semua crypto curenncy' },
      { type: 'feature', text: 'Menambahkan Raw ABI di Bytecode explorer' },
      { type: 'improvement', text: 'Memperbaiki kesalahan Path Di Axiome chain (pada cointype)' },
      { type: 'fix', text: 'Memperbaiki bug di page /Waitlist' },
    ],
  },
  {
    version: '2.1.9',
    date: '04 Agu 2026',
    title: 'Menambahkan fitur Explorer dan menambahkan 2 Network baru di Wallet-Gen dan Sedikit perbaikan',
    changes: [
      { type: 'feature', text: 'Menambahkan Network Baru Tron [TRX], Cosmos [ATOM], Axiome [AXM] di wallet-gen versi terbaru' },
      { type: 'feature', text: 'Menambahkan Explorer (Baru tersedia untuk EVM) di Wallet Gen' },
      { type: 'fix', text: 'Memperbaiki Bug EVM Token Kreator' },
    ],
  },
  {
    version: '2.1.6',
    date: '01 Agu 2026',
    title: 'Estimasi Fee ETH & Tombol Max Send',
    changes: [
      { type: 'feature', text: 'Menambahkan detail estimasi total fee dalam native coin (ETH/BNB/dll) di form Kirim (Send & Receive), dihitung dari Gas Price × Gas Limit' },
      { type: 'feature', text: 'Menambahkan estimasi fee per opsi Slow/Standard/Fast, serta estimasi live saat memakai Gas Manual' },
      { type: 'feature', text: 'Menambahkan tombol MAX pada kolom Jumlah — otomatis mengisi saldo maksimum yang bisa dikirim (native dikurangi estimasi gas, token terisi penuh)' },
      { type: 'fix', text: 'Memperbaiki bug asset yang tidak terdeteksi / tidak berubah di dropdown Asset pada Send & Receive — dropdown kini bersumber dari daftar token yang dikenal (bukan hasil fetch saldo yang bisa telat)' },
      { type: 'improvement', text: 'Auto-refresh saldo token saat daftar token dikenal berubah (token baru ditambahkan/dideploy) selagi wallet masih terhubung' },
    ],
  },
  {
    version: '2.1.5',
    date: '23 Jul 2026',
    title: 'Support Solana Network',
    changes: [
      { type: 'feature', text: 'Menambahkan Solana dan Token SPL20' },
      { type: 'feature', text: 'Support ERC20 Milik Ethereum Virtual Machine [EVM]' },
      { type: 'feature', text: 'Menambahkan Fitur Deploy Contract Standart ERC20 & SPL20' },
      { type: 'improvement', text: 'Memperbaiki UI > Penggunaan yang Lambat pada Wallet-Gen' },
      { type: 'improvement', text: 'Update kecil pada halaman Landing' },
    ],
  },
  {
    version: '2.1.2',
    date: '23 Jul 2026',
    title: 'Changelog Page',
    changes: [
      { type: 'feature', text: 'Menambahkan halaman Changelog untuk mencatat riwayat update aplikasi' },
    ],
  },
  {
    version: '2.1.1',
    date: '15 Jun 2026',
    title: 'Perbaikan Tx Decoder',
    changes: [
      { type: 'improvement', text: 'Refactor pengelolaan hasil lookup 4-byte signature' },
      { type: 'improvement', text: 'Menambahkan logika rekonstruksi ABI otomatis dari hasil decode' },
      { type: 'fix', text: 'Memperbaiki beberapa bug pada alur decode transaksi' },
      { type: 'fix', text: 'Menghapus file Wallet Generator versi lama yang duplikat' },
      { type: 'improvement', text: 'Update kecil pada halaman Landing' },
    ],
  },
  {
    version: '2.0.9',
    date: '14 Jun 2026',
    title: 'Tx Decoder & 4-Byte Signature Lookup',
    changes: [
      { type: 'feature', text: 'Menambahkan database 4-byte function signature & event topic untuk decode transaksi on-chain' },
      { type: 'fix', text: 'Memperbaiki penamaan import (case) komponen TxDecoder di Wallet Generator' },
      { type: 'fix', text: 'Memperbaiki path dan label menu navigasi (Navbar)' },
      { type: 'improvement', text: 'Merapikan struktur folder & lokasi file terkait Wallet Generator' },
    ],
  },
  {
    version: '2.0.7',
    date: '01 Jun 2026',
    title: 'Faucet Page',
    changes: [
      { type: 'feature', text: 'Menambahkan halaman Faucet, dimulai dengan faucet DAC Chain Testnet' },
      { type: 'improvement', text: 'Update label pada template Auto Action' },
    ],
  },
  {
    version: '2.0.5',
    date: '23 Mei 2026',
    title: 'Auto Action Multi Network & Donation',
    changes: [
      { type: 'feature', text: 'Fitur runBatch untuk menjalankan aksi berulang (loop) di banyak network sekaligus' },
      { type: 'feature', text: 'Menambahkan Donation Section dengan tombol copy address EVM' },
      { type: 'improvement', text: 'Update deskripsi & branding halaman AI Assistant' },
      { type: 'improvement', text: 'Pembaruan tampilan Wallet Generator' },
      { type: 'improvement', text: 'Update halaman Rekt' },
    ],
  },
  {
    version: '2.0.3',
    date: '22 Mei 2026',
    title: 'Garap Batch Loop',
    changes: [
      { type: 'feature', text: 'Menambahkan fitur runBatch awal untuk memproses garapan secara batch' },
      { type: 'feature', text: 'Menambahkan Garap Batch loop untuk otomasi pengerjaan berulang' },
      { type: 'fix', text: 'Perbaikan bug pada halaman Landing' },
      { type: 'fix', text: 'Perbaikan bug umum lainnya' },
    ],
  },
  {
    version: '2.0.1',
    date: '21 Mei 2026 (malam)',
    title: 'Terms of Service & Stabilisasi',
    changes: [
      { type: 'feature', text: 'Membuat halaman Terms of Service (ToS) khusus untuk Wallet Generator' },
      { type: 'improvement', text: 'Beberapa kali revisi konten & tampilan halaman ToS' },
      { type: 'improvement', text: 'Beberapa kali revisi App.tsx untuk merapikan routing' },
      { type: 'improvement', text: 'Update konfigurasi tsconfig.app.json dan package-lock.json' },
      { type: 'fix', text: 'Membersihkan file package-lock.json & folder ToS duplikat dari struktur lama (v2)' },
    ],
  },
  {
    version: '2.0.0',
    date: '21 Mei 2026 (siang)',
    title: 'Peluncuran Wallet Generator & Landing Page',
    changes: [
      { type: 'feature', text: 'Rilis awal halaman Wallet Generator' },
      { type: 'feature', text: 'Menambahkan halaman Landing sebagai pintu masuk aplikasi' },
      { type: 'improvement', text: 'Refactor Navbar agar menggunakan daftar menu terpusat (NAV_ITEMS)' },
      { type: 'improvement', text: 'Menambahkan dependency ethers.js untuk kebutuhan wallet & transaksi' },
      { type: 'improvement', text: 'Update halaman Waitlist' },
      { type: 'fix', text: 'Merapikan ulang struktur folder Landing & Wallet Generator dari versi awal (v2)' },
    ],
  },
  {
    version: '1.5.0',
    date: '06 Mei 2026',
    title: 'Perapian Aset & Warna Network',
    changes: [
      { type: 'improvement', text: 'Menambahkan kode warna (hex) untuk token/network baru: INK, OCTRA, AVAX, PHAROS' },
      { type: 'fix', text: 'Membersihkan folder ikon yang sudah tidak terpakai' },
    ],
  },
  {
    version: '1.0.0',
    date: '31 Mar 2026',
    title: 'Rilis Awal — Rekt & AI Agent',
    changes: [
      { type: 'feature', text: 'Rilis awal fitur Rekt dan AI Agent' },
      { type: 'improvement', text: 'Pembaruan tampilan (UI) awal aplikasi' },
    ],
  },
];

const TYPE_META: Record<ChangeType, { label: string; color: string; icon: React.ReactNode }> = {
  feature:     { label: 'Baru',     color: '#4caf50', icon: <FaPlusCircle /> },
  improvement: { label: 'Perbaikan', color: '#2196f3', icon: <FaWrench /> },
  fix:         { label: 'Bug Fix',  color: '#ff6600', icon: <FaBug /> },
};

export const Changelog: React.FC = () => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (version: string) =>
    setCollapsed(prev => ({ ...prev, [version]: !prev[version] }));

  return (
    <div className="app-container">
      <header>
        <h1><FaHistory style={{ marginRight: '8px' }} />Changelog</h1>
      </header>
      <Navbar />

      <p style={{ color: '#888', fontSize: '12px', textAlign: 'center', margin: '0 0 24px' }}>
        Riwayat update, fitur baru, dan perbaikan pada aplikasi.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
        {CHANGELOG.map((v, idx) => {
          const isOpen = !collapsed[v.version];
          const isLatest = idx === 0;
          return (
            <div key={v.version} style={{
              background: '#0d0d0d',
              border: '1px solid #1e1e1e',
              borderLeft: `3px solid ${isLatest ? '#01a2ff' : '#333'}`,
            }}>
              <div
                onClick={() => toggle(v.version)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', cursor: 'pointer', flexWrap: 'wrap', gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px',
                    color: isLatest ? '#01a2ff' : '#fff',
                    border: `1px solid ${isLatest ? '#01a2ff' : '#444'}`,
                    padding: '3px 8px',
                  }}>
                    v{v.version}
                  </span>
                  {isLatest && (
                    <span style={{
                      fontSize: '9px', fontWeight: 'bold', color: '#000', background: '#01a2ff',
                      padding: '3px 7px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      <FaRocket size={9} /> TERBARU
                    </span>
                  )}
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ddd' }}>{v.title}</span>
                  <span style={{ fontSize: '11px', color: '#555' }}>{v.date}</span>
                </div>
                {isOpen ? <FaChevronUp color="#555" size={12} /> : <FaChevronDown color="#555" size={12} />}
              </div>

              {isOpen && (
                <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {v.changes.map((c, i) => {
                    const meta = TYPE_META[c.type];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{
                          color: meta.color, fontSize: '11px', flexShrink: 0, marginTop: '2px',
                          display: 'flex', alignItems: 'center', gap: '5px',
                          border: `1px solid ${meta.color}`, padding: '2px 6px', whiteSpace: 'nowrap',
                        }}>
                          {meta.icon} {meta.label}
                        </span>
                        <span style={{ fontSize: '12px', color: '#bbb', lineHeight: 1.5 }}>{c.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
