import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import {
  FaRocket, FaWallet, FaChartBar, FaTint, FaBrain,
  FaListAlt, FaCoins, FaShieldAlt, FaDownload,
  FaUpload, FaTerminal, FaTelegram, FaTwitter,
  FaArrowRight, FaCheck, FaHeart, FaCopy,
} from 'react-icons/fa';

function useTypingEffect(text: string, speed = 45, startDelay = 0) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(iv); setDone(true); }
      }, speed);
      return () => clearInterval(iv);
    }, startDelay);
    return () => clearTimeout(t);
  }, [text, speed, startDelay]);
  return { displayed, done };
}

const FEATURES = [
  {
    icon: <FaTerminal />,
    title: 'Airdrop Tracker',
    path: '/',
    color: 'rgba(255, 255, 255, 0.51)',
    desc: 'Catat & kelola semua garapan airdrop mu. Tandai status harian, set deadline, estimasi reward, dan simpan wallet per task.',
    bullets: ['Status Ongoing / END / Waitlist', 'Daily reset otomatis jam 07.00 WIB', 'Deadline countdown & overdue alert'],
  },
  {
    icon: <FaListAlt />,
    title: 'Waitlist Manager',
    path: '/waitlist',
    color: 'rgba(255, 255, 255, 0.45)',
    desc: 'Daftar waitlist project baru dengan simpan akun sosmed (email, Discord, X) dan wallet yang dipakai.',
    bullets: ['Multi-sosmed per entry', 'Wallet address tracking', 'Linked ke Home tracker'],
  },
  {
    icon: <FaChartBar />,
    title: 'Finance Tracker',
    path: '/finance',
    color: 'rgba(255, 255, 255, 0.46)',
    desc: 'Pantau semua income & expense dari kegiatan kripto. Multi-currency: USD, IDR, BTC, ETH via CoinGecko.',
    bullets: ['Income vs Expense dashboard', 'Konversi real-time (USD/IDR/BTC/ETH)', 'Filter per network / tanggal'],
  },
  {
    icon: <FaCoins />,
    title: 'Portfolio Tracker',
    path: '/portfolio',
    color: 'rgba(255, 249, 234, 0.49)',
    desc: 'Track token airdrop yang sudah kamu terima. Hitung nilai holding, monitor vesting, dan catat yang sudah dijual.',
    bullets: ['Status Holding / Vesting / Sold', 'Kalkulasi total nilai otomatis', 'Filter & search by network'],
  },
  {
    icon: <FaTint />,
    title: 'Info Faucet',
    path: '/faucet',
    color: 'rgba(255, 255, 255, 0.51)',
    desc: 'Direktori lengkap faucet testnet populer. Monad, Sepolia, Sui, BNB, Base, dan banyak lagi dalam satu halaman.',
    bullets: ['14+ jaringan testnet', 'Multi-source per network', 'Search & filter cepat'],
  },
  {
    icon: <FaBrain />,
    title: 'AI Assistant',
    path: '/ai',
    color: 'rgba(255, 255, 255, 0.47)',
    desc: 'Chat langsung dengan Rekt AI untuk riset project, analisis whitepaper, atau tanya tentang strategi airdrop.',
    bullets: ['Powered by Rekt', 'Context-aware crypto advisor', 'Selalu up to date'],
  },
  {
    icon: <FaChartBar />,
    title: 'Dashboard',
    path: '/dashboard',
    color: 'rgba(255, 246, 233, 0.5)',
    desc: 'Overview lengkap semua data dalam satu layar. Progress harian, deadline, top network income, dan breakdown kategori.',
    bullets: ['Stat cards real-time', 'Deadline alert & overdue warning', 'Top network by income'],
  },
  {
    icon: <FaWallet />,
    title: 'Wallet-Gen',
    path: '/wallet-gen',
    color: 'rgba(255, 255, 255, 0.5)',
    desc: 'Generate EVM wallet baru langsung di browser. Enkripsi dengan password, export & import aman.',
    bullets: ['Dompet Ethereum Virtual Machine (EVM)', 'Enkripsi AES lokal', 'Bulk generate hingga 10+ wallet'],
  },
];

const EVM_ADDRESS = '0xf0B47853c621cAbA9Fd0Ed490C75856a2dFD43EF';

const DonationSection: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(EVM_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      padding: '40px 20px',
      borderBottom: '1px solid #111',
      textAlign: 'center',
    }}>
      <p style={{
        fontSize: '10px', letterSpacing: '3px', color: '#555',
        textTransform: 'uppercase', marginBottom: '12px',
      }}>
        DUKUNG PENGEMBANGAN
      </p>
      <h2 style={{
        fontSize: 'clamp(16px, 4vw, 24px)',
        fontFamily: '"Courier New", monospace',
        letterSpacing: '2px', textTransform: 'uppercase',
        color: '#fff', border: 'none', margin: '0 0 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
      }}>
        <FaHeart style={{ color: '#ff4466', fontSize: '20px', animation: 'pulse-border 1.5s infinite' }} />
        Traktir Developer
      </h2>
      <p style={{ fontSize: '12px', color: '#555', lineHeight: 1.8, maxWidth: '480px', margin: '0 auto 24px' }}>
        Jika aplikasi ini membantu aktivitas airdrop kamu, pertimbangkan untuk donasi. Setiap kontribusi sangat berarti untuk pengembangan fitur baru!
      </p>

      <div style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        background: '#0d0d0d', border: '1px solid #1e1e1e',
        borderTop: '2px solid #f3ba2f',
        padding: '20px 28px', maxWidth: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaWallet style={{ color: '#f3ba2f', flexShrink: 0 }} />
          <span style={{
            fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase',
            color: '#f3ba2f',
          }}>
            EVM Address (ETH / BNB / Polygon / dll)
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: '#111', border: '1px solid #2a2a2a',
          padding: '10px 14px', maxWidth: '100%', boxSizing: 'border-box',
        }}>
          <code style={{
            fontSize: '12px', color: '#ccc', fontFamily: '"Courier New", monospace',
            wordBreak: 'break-all', flex: 1, textAlign: 'left',
          }}>
            {EVM_ADDRESS}
          </code>
          <button
            onClick={handleCopy}
            title="Copy address"
            style={{
              background: copied ? '#00e67622' : 'transparent',
              border: `1px solid ${copied ? '#00e676' : '#333'}`,
              color: copied ? '#00e676' : '#888',
              padding: '6px 10px', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', letterSpacing: '0.5px',
              transition: 'all 0.2s',
              fontFamily: '"Courier New", monospace',
            }}
          >
            <FaCopy style={{ fontSize: '11px' }} />
            {copied ? 'COPIED!' : 'COPY'}
          </button>
        </div>

        <p style={{ fontSize: '11px', color: '#444', margin: 0 }}>
          ⚠️ Pastikan mengirim ke jaringan yang benar (EVM compatible)
        </p>
      </div>
    </div>
  );
};

function handleTiltMove(e: React.MouseEvent<HTMLDivElement>) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 7;
  const rotateX = -((y - rect.height / 2) / (rect.height / 2)) * 7;
  card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(4px)`;
  card.style.setProperty('--shine-x', `${(x / rect.width) * 100}%`);
  card.style.setProperty('--shine-y', `${(y / rect.height) * 100}%`);
}

function handleTiltLeave(e: React.MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
}

export const Landing: React.FC = () => {
  const heroLine1 = useTypingEffect('E R D R O P', 50, 200);
  const heroLine2 = useTypingEffect('MANAGER_', 50, 900);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) setVisible(prev => new Set([...prev, e.target.id]));
        });
      },
      { threshold: 0.12 }
    );
    cardRefs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="app-container" style={{ padding: 0, overflow: 'hidden' }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanline {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }
        @keyframes glitch {
          0%,100% { text-shadow: 2px 0 #01a2ff, -2px 0 #ff3333; }
          25% { text-shadow: -2px 0 #01a2ff, 2px 0 #ff3333; }
          50% { text-shadow: 2px 2px #01a2ff, -2px -2px #ff3333; }
          75% { text-shadow: -2px 2px #01a2ff, 2px -2px #ff3333; }
        }
        @keyframes pulse-border {
          0%,100% { box-shadow: 0 0 0 0 rgba(1,162,255,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(1,162,255,0); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .feature-card {
          transition: transform 0.15s ease, box-shadow 0.25s ease;
          transform-style: preserve-3d;
          will-change: transform;
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at var(--shine-x, 50%) var(--shine-y, 50%), rgba(255,255,255,0.10), transparent 55%);
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
        .feature-card:hover::before {
          opacity: 1;
        }
        .feature-card:hover {
          box-shadow: 0 20px 36px -14px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05);
        }
        .cta-btn {
          transition: all 0.2s ease;
        }
        .cta-btn:hover {
          filter: brightness(1.12);
        }
        /* Tombol 3D neo-brutalist: shadow padat yang "menekan flush" saat
           diklik — pola yang sama dipakai di .open-link (App.css), di sini
           dibuat reusable via currentColor supaya otomatis nyambung ke
           warna teks/border tiap tombol. */
        .btn-3d {
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .btn-3d:hover {
          transform: translate(-2px, -2px);
        }
        .btn-3d:active {
          transform: translate(2px, 2px) !important;
          box-shadow: 0 0 0 0 transparent !important;
        }
        .fade-in-card {
          opacity: 0;
          transform: translateY(20px);
        }
        .fade-in-card.visible {
          animation: fadeSlideUp 0.5s ease forwards;
        }

        /* Terminal chrome dots — highlight tipis biar kesannya glossy/3D. */
        .term-dot {
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.5);
        }

        /* Kubus wireframe 3D murni CSS, dekorasi di pojok hero. */
        .cube-3d-wrap {
          position: absolute;
          top: 22px;
          right: 24px;
          width: 54px;
          height: 54px;
          perspective: 380px;
          display: none;
          pointer-events: none;
        }
        @media (min-width: 640px) {
          .cube-3d-wrap { display: block; }
        }
        .cube-3d {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: cubeSpin 14s linear infinite;
        }
        .cube-3d .face {
          position: absolute;
          width: 54px;
          height: 54px;
          border: 1px solid rgba(1,162,255,0.55);
          background: rgba(1,162,255,0.05);
        }
        .cube-3d .face.front  { transform: translateZ(27px); }
        .cube-3d .face.back   { transform: translateZ(-27px) rotateY(180deg); }
        .cube-3d .face.right  { transform: rotateY(90deg) translateZ(27px); }
        .cube-3d .face.left   { transform: rotateY(-90deg) translateZ(27px); }
        .cube-3d .face.top    { transform: rotateX(90deg) translateZ(27px); }
        .cube-3d .face.bottom { transform: rotateX(-90deg) translateZ(27px); }
        @keyframes cubeSpin {
          from { transform: rotateX(0deg) rotateY(0deg); }
          to   { transform: rotateX(360deg) rotateY(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cube-3d { animation: none; }
        }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '10px 16px', background: '#0a0a0a', borderBottom: '1px solid #1e1e1e',
      }}>
        <span className="term-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
        <span className="term-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
        <span className="term-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
        <span style={{ marginLeft: '8px', fontSize: '10px', color: '#555', letterSpacing: '1px', fontFamily: '"Courier New", monospace' }}>
          ~/erdrop-manager — zsh
        </span>
      </div>

      <div style={{
        position: 'relative',
        padding: '48px 24px 40px',
        background: '#000',
        borderBottom: '1px solid #1e1e1e',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.07,
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
          width: '500px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(1,162,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="cube-3d-wrap" aria-hidden="true">
          <div className="cube-3d">
            <div className="face front" />
            <div className="face back" />
            <div className="face right" />
            <div className="face left" />
            <div className="face top" />
            <div className="face bottom" />
          </div>
        </div>
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            border: '1px solid #333', padding: '5px 14px',
            fontSize: '10px', letterSpacing: '2px', color: '#888',
            textTransform: 'uppercase', marginBottom: '28px',
            animation: 'fadeSlideUp 0.5s ease 0.1s both',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#01a2ff', animation: 'blink 1.5s infinite' }} />
            Powered by IAC Community
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 8vw, 64px)',
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color: '#fff',
            border: 'none',
            margin: '0 0 8px',
            lineHeight: 1.1,
            animation: 'glitch 8s ease-in-out infinite',
          }}>
            {heroLine1.displayed}
            {!heroLine1.done && <span style={{ animation: 'blink 0.8s infinite' }}>_</span>}
          </h1>
          <h1 style={{
            fontSize: 'clamp(18px, 5vw, 40px)',
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            letterSpacing: '6px',
            textTransform: 'uppercase',
            color: '#01a2ff',
            border: 'none',
            margin: '0 0 24px',
            lineHeight: 1.2,
          }}>
            {heroLine2.displayed}
            {heroLine1.done && !heroLine2.done && <span style={{ animation: 'blink 0.8s infinite' }}>_</span>}
          </h1>

          <p style={{
            fontSize: '13px', color: '#888', maxWidth: '520px',
            margin: '0 auto 32px', lineHeight: 1.8, letterSpacing: '0.5px',
            animation: 'fadeSlideUp 0.5s ease 1.5s both',
          }}>
            Satu platform untuk mengelola airdrop, keuangan kripto, portfolio token, dan wallet — semuanya tersimpan lokal di browser kamu. Gratis. Privat. No signup.
          </p>
          <div style={{
            display: 'flex', gap: '12px', justifyContent: 'center',
            flexWrap: 'wrap', marginBottom: '40px',
            animation: 'fadeSlideUp 0.5s ease 1.8s both',
          }}>
            <Link to="/home" style={{ textDecoration: 'none' }}>
              <button className="cta-btn btn-3d" style={{
                background: '#fff', color: '#000', border: 'none',
                padding: '12px 28px', fontFamily: '"Courier New", monospace',
                fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px',
                textTransform: 'uppercase', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '4px 4px 0 0 #01a2ff',
              }}>
                <FaRocket /> Mulai Sekarang
              </button>
            </Link>
            <a href="https://t.me/airdropiac" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="cta-btn btn-3d" style={{
                background: 'transparent', color: '#01a2ff', border: '1px solid #01a2ff',
                padding: '12px 28px', fontFamily: '"Courier New", monospace',
                fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px',
                textTransform: 'uppercase', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '4px 4px 0 0 currentColor',
              }}>
                <FaTelegram /> Join Channel
              </button>
            </a>
          </div>
          <div style={{
            display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap',
            animation: 'fadeSlideUp 0.5s ease 2s both',
          }}>
            {[
              { label: '8 Fitur', color: '#ffffff' },
              { label: '100% Lokal', color: '#888888' },
              { label: 'No Login', color: '#888888' },
              { label: 'Open Source', color: '#ffffff' },
            ].map(p => (
              <span key={p.label} style={{
                fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
                color: p.color, border: `1px solid ${p.color}33`,
                background: `${p.color}11`, padding: '4px 12px',
              }}>
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <Navbar />
      </div>

      <div style={{ padding: '32px 20px', borderBottom: '1px solid #111' }}>
        <p style={{
          fontSize: '10px', letterSpacing: '3px', color: '#555',
          textTransform: 'uppercase', textAlign: 'center', marginBottom: '20px',
        }}>
          KENAPA ERDROP MANAGER?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { icon: <FaShieldAlt />, title: 'Data 100% Lokal', desc: 'Semua data tersimpan di localStorage browser kamu. Tidak ada server, tidak ada database cloud, tidak ada yang bisa akses datamu.', color: '#ffffff' },
            { icon: <FaDownload />, title: 'Export & Import', desc: 'Backup semua data ke file .txt terenkripsi. Pindah device kapan saja tanpa kehilangan catatan airdrop.', color: '#ffffff' },
            { icon: <FaUpload />, title: 'Zero Signup', desc: 'Langsung pakai tanpa registrasi, email, atau password. Buka browser, buka app, mulai catat.', color: '#ffffff' },
          ].map((item, i) => (
            <div key={i}
              className="feature-card"
              onMouseMove={handleTiltMove}
              onMouseLeave={handleTiltLeave}
              style={{
                background: '#0d0d0d', border: '1px solid #1a1a1a',
                borderTop: `2px solid ${item.color}`, padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
              <span style={{ color: item.color, fontSize: '20px' }}>{item.icon}</span>
              <strong style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.title}</strong>
              <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '32px 20px', borderBottom: '1px solid #111' }}>
        <p style={{
          fontSize: '10px', letterSpacing: '3px', color: '#555',
          textTransform: 'uppercase', textAlign: 'center', marginBottom: '24px',
        }}>
          MODUL &amp; FITUR
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              id={`feat-${i}`}
              ref={el => { cardRefs.current[i] = el; }}
              className={`feature-card fade-in-card ${visible.has(`feat-${i}`) ? 'visible' : ''}`}
              onMouseMove={handleTiltMove}
              onMouseLeave={handleTiltLeave}
              style={{
                background: '#0d0d0d',
                border: '1px solid #1a1a1a',
                borderLeft: `3px solid ${f.color}`,
                padding: '20px',
                animationDelay: `${(i % 4) * 0.08}s`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{
                  width: '36px', height: '36px', background: `${f.color}18`,
                  border: `1px solid ${f.color}44`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: f.color, fontSize: '16px', flexShrink: 0,
                }}>
                  {f.icon}
                </span>
                <strong style={{ fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff' }}>
                  {f.title}
                </strong>
              </div>

              <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.7, margin: '0 0 14px' }}>
                {f.desc}
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {f.bullets.map(b => (
                  <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '11px', color: '#555' }}>
                    <FaCheck style={{ color: f.color, flexShrink: 0, marginTop: '2px', fontSize: '9px' }} />
                    {b}
                  </li>
                ))}
              </ul>

              <Link to={f.path} style={{ textDecoration: 'none' }}>
                <button className="btn-3d" style={{
                  width: '100%', background: 'transparent',
                  border: `1px solid ${f.color}55`, color: f.color,
                  padding: '8px 0', fontSize: '10px', letterSpacing: '1.5px',
                  textTransform: 'uppercase', cursor: 'pointer',
                  fontFamily: '"Courier New", monospace',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  boxShadow: '3px 3px 0 0 currentColor',
                }}>
                  Coba Fitur <FaArrowRight style={{ fontSize: '9px' }} />
                </button>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '32px 20px', borderBottom: '1px solid #111' }}>
        <p style={{
          fontSize: '10px', letterSpacing: '3px', color: '#555',
          textTransform: 'uppercase', textAlign: 'center', marginBottom: '24px',
        }}>
          CARA PAKAI
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: '23px', top: '22px', bottom: '22px', width: '1px',
            background: 'linear-gradient(#1e1e1e, #333 15%, #333 85%, #1e1e1e)',
          }} />
          {[
            { step: '01', title: 'Tambah Garapan', desc: 'Buka halaman Home. Isi nama project, tugas, link, dan jumlah akun. Klik tambah — garapan langsung tersimpan.', color: '#01a2ff' },
            { step: '02', title: 'Tandai Progress Harian', desc: 'Setiap hari, klik ✓ pada kolom "Hari Ini" untuk setiap garapan yang sudah dikerjakan. Status akan reset otomatis jam 07.00 WIB.', color: '#00e676' },
            { step: '03', title: 'Catat Keuangan', desc: 'Buka Finance Tracker. Tambahkan income dari klaim reward atau expense dari gas fee. Pantau P&L keseluruhan.', color: '#f3ba2f' },
            { step: '04', title: 'Track Portfolio', desc: 'Setelah terima token, tambahkan ke Portfolio Tracker. Set harga per token untuk melihat estimasi nilai holding kamu.', color: '#a855f7' },
            { step: '05', title: 'Backup Data', desc: 'Klik tombol Export di Home untuk download backup terenkripsi. Simpan file-nya. Import kembali kapanpun dibutuhkan.', color: '#ff6b6b' },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', gap: '16px', alignItems: 'flex-start',
              padding: '18px 0',
              borderBottom: i < 4 ? '1px solid #0f0f0f' : 'none',
            }}>
              <div style={{
                position: 'relative', zIndex: 1,
                fontFamily: '"Courier New", monospace',
                fontSize: '32px', fontWeight: 'bold',
                color: 'transparent',
                WebkitTextStroke: `1.2px ${s.color}`,
                textShadow: `2px 2px 0 ${s.color}33`,
                lineHeight: 1, flexShrink: 0, width: '48px',
              }}>
                {s.step}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', color: s.color, display: 'block', marginBottom: '6px' }}>
                  {s.title}
                </strong>
                <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.7, margin: 0 }}>
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '40px 20px',
        background: '#000',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <p style={{
            fontSize: '10px', letterSpacing: '3px', color: '#555',
            textTransform: 'uppercase', marginBottom: '12px',
          }}>
            BERGABUNG BERSAMA KOMUNITAS
          </p>
          <h2 style={{
            fontSize: 'clamp(18px, 5vw, 32px)',
            fontFamily: '"Courier New", monospace',
            letterSpacing: '2px', textTransform: 'uppercase',
            color: '#fff', border: 'none', margin: '0 0 12px',
          }}>
            INPO AIRDROP CRYPTO
          </h2>
          <p style={{ fontSize: '12px', color: '#555', marginBottom: '28px', lineHeight: 1.8 }}>
            Update airdrop terbaru, tips & strategi, diskusi bersama member aktif.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="https://t.me/airdropiac" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="btn-3d" style={{
                background: '#0088cc', color: '#fff', border: 'none',
                padding: '12px 24px', fontFamily: '"Courier New", monospace',
                fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px',
                textTransform: 'uppercase', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                animation: 'pulse-border 2s infinite',
                boxShadow: '4px 4px 0 0 #ffffff',
              }}>
                <FaTelegram /> Telegram Channel
              </button>
            </a>
            <a href="https://twitter.com/intent/follow?screen_name=iaccommunity_" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="btn-3d" style={{
                background: 'transparent', color: '#fff', border: '1px solid #333',
                padding: '12px 24px', fontFamily: '"Courier New", monospace',
                fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px',
                textTransform: 'uppercase', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '4px 4px 0 0 currentColor',
              }}>
                <FaTwitter /> Follow X
              </button>
            </a>
          </div>
        </div>
      </div>

      <DonationSection />

      <footer className="app-footer" style={{ textAlign: 'center', color: '#333', fontSize: '11px', padding: '16px', borderTop: '1px solid #111' }}>
        Powered by IAC Community
      </footer>
    </div>
  );
};
