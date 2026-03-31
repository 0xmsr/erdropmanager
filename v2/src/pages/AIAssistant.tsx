import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { type Task, type Transaction, type PortfolioToken } from '../types';
import {
  FaRobot, FaPaperPlane, FaTrash, FaLightbulb, FaCheckCircle,
  FaFileImport, FaLink, FaTimes, FaFileAlt, FaSpinner,
  FaChevronDown, FaChevronUp, FaMicrochip,
  FaRegCopy, FaCheck, FaNetworkWired
} from 'react-icons/fa';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  actions?: TaskAction[];
  model?: string;
  tokensUsed?: number;
}

interface TaskAction {
  type: 'ADD' | 'UPDATE' | 'DELETE' | 'UPDATE_STATUS' | 'TOGGLE_DONE';
  payload: any;
  label: string;
  applied?: boolean;
}

interface ImportedContext {
  name: string;
  content: string;
  type: 'file' | 'url';
}

interface ModelInfo {
  id: string;
  label: string;
  color: string;
  badge: string;
  description?: string;
  owned?: string;
}

interface ClawHubSkill {
  slug: string;
  name: string;
  description: string;
  author: string;
  downloads?: number;
  installs?: number;
  stars?: number;
  tags?: string[];
  license?: string;
  version?: string;
  highlighted?: boolean;
  suspicious?: boolean;
}

interface InstalledSkill {
  slug: string;
  name: string;
  description: string;
  content: string;
  installedAt: number;
  author: string;
}

interface OtakRektMemory {
  id: string;
  category: 'fakta' | 'preferensi' | 'tujuan' | 'catatan' | 'lainnya';
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

const BLUESMINDS_BASE = 'https://api.bluesminds.com/v1';
const API_KEY_STORAGE = 'bluesminds_api_key';
const SKILLS_STORAGE_KEY = 'rektInstalledSkills';
const OTAK_REKT_KEY = 'rektOtakMemory';

const loadApiKey = (): string => {
  try { return localStorage.getItem(API_KEY_STORAGE) || ''; } catch { return ''; }
};

const getModelMeta = (id: string): { color: string; badge: string } => {
  const lower = id.toLowerCase();
  if (lower.includes('minimax') || lower.includes('mini-max')) return { color: '#06b6d4', badge: 'MINIMAX' };
  if (lower.includes('deepseek-reasoner') || lower.includes('reasoner')) return { color: '#fb923c', badge: 'THINK' };
  if (lower.includes('deepseek')) return { color: '#f97316', badge: 'CODING' };
  if (lower.includes('gpt-4o-mini')) return { color: '#19c37d', badge: 'FAST' };
  if (lower.includes('gpt-4o') || lower.includes('gpt4o')) return { color: '#10a37f', badge: 'SMART' };
  if (lower.includes('gpt')) return { color: '#10a37f', badge: 'GPT' };
  if (lower.includes('claude') && lower.includes('haiku')) return { color: '#c084fc', badge: 'LITE' };
  if (lower.includes('claude') && lower.includes('sonnet')) return { color: '#a855f7', badge: 'REASONING' };
  if (lower.includes('claude')) return { color: '#9333ea', badge: 'CLAUDE' };
  if (lower.includes('gemini') && lower.includes('flash')) return { color: '#34a853', badge: 'SPEED' };
  if (lower.includes('gemini')) return { color: '#4285f4', badge: 'GOOGLE' };
  if (lower.includes('llama')) return { color: '#f59e0b', badge: 'OPEN' };
  if (lower.includes('mistral') || lower.includes('mixtral')) return { color: '#ff7043', badge: 'MISTRAL' };
  if (lower.includes('qwen')) return { color: '#8b5cf6', badge: 'QWEN' };
  return { color: '#64748b', badge: 'AI' };
};

const QUICK_PROMPTS = [
  { icon: '🚀', text: 'Garapin airdrop yang belum selesai hari ini', category: 'garap' },
  { icon: '📋', text: 'Tampilkan semua airdrop ongoing beserta linknya', category: 'garap' },
  { icon: '📊', text: 'Ringkas progress airdrop hari ini', category: 'info' },
  { icon: '⏰', text: 'Airdrop mana yang mendekati deadline?', category: 'info' },
  { icon: '💰', text: 'Analisis keuangan & portfolio saya', category: 'info' },
];

const STORAGE_KEY = 'rektChatHistoryV2';
const MAX_SAVED_MESSAGES = 120;

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `Halo! Saya **Rekt**, AI assistant Erdrop Manager kamu yang baru & lebih canggih! 🚀

Sekarang saya didukung oleh **BluesMind API** dengan akses ke berbagai model AI terbaik:
• GPT-4o, Claude 3.5, Gemini 1.5, DeepSeek, Llama 3.3 & lebih banyak lagi

Kemampuan saya:
✅ Kelola tugas airdrop langsung dari chat
✅ Analisis keuangan & portfolio
✅ Import file/URL sebagai konteks tambahan
✅ Ganti model AI sesuai kebutuhan kamu

Pilih model di atas dan mulai chat! 💬`,
  timestamp: Date.now(),
  model: 'system',
};

const loadMessages = (): Message[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [INITIAL_MESSAGE];
    const parsed: Message[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INITIAL_MESSAGE];
  } catch {
    return [INITIAL_MESSAGE];
  }
};

const formatTime = (ts?: number): string => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const parseActions = (text: string): { cleanText: string; actions: TaskAction[] } => {
  const actions: TaskAction[] = [];
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/gi;
  let cleanText = text;
  let match;
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      arr.forEach((item: any) => {
        if (item.type && item.payload !== undefined) {
          actions.push({ type: item.type, payload: item.payload, label: item.label || item.type });
        }
      });
      cleanText = cleanText.replace(match[0], '').trim();
    } catch {}
  }
  return { cleanText, actions };
};

const CodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ margin: '6px 0', border: '1px solid #2a2a2a', borderRadius: '4px', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1a1a1a', padding: '4px 10px', borderBottom: '1px solid #2a2a2a',
      }}>
        <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>
          {lang || 'code'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: copied ? '#4caf50' : '#555', fontSize: '11px',
            display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px',
            transition: 'color 0.2s',
          }}
          title="Copy kode"
        >
          {copied ? <><FaCheck size={10} /> Copied!</> : <><FaRegCopy size={10} /> Copy</>}
        </button>
      </div>
      {/* Code content */}
      <pre style={{
        margin: 0, padding: '10px 14px', overflowX: 'auto',
        background: '#0d0d0d', fontFamily: "'Courier New', monospace",
        fontSize: '12px', lineHeight: '1.6', color: '#e0e0e0',
        whiteSpace: 'pre',
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

const renderMarkdown = (text: string): React.ReactNode => {
  const elements: React.ReactNode[] = [];
  const parts = text.split(/(```[\s\S]*?```)/g);

  parts.forEach((part, partIdx) => {
    if (part.startsWith('```')) {
      const firstNewline = part.indexOf('\n');
      const lang = firstNewline > 3 ? part.slice(3, firstNewline).trim() : '';
      const code = firstNewline > -1 ? part.slice(firstNewline + 1).replace(/```$/, '').trimEnd() : part.slice(3).replace(/```$/, '').trim();
      elements.push(<CodeBlock key={`code-${partIdx}`} code={code} lang={lang} />);
    } else {
      const lines = part.split('\n');
      lines.forEach((line, i) => {
        let processed = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code style="background:#1e1e1e;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px;color:#e0e0e0">$1</code>')
          .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#646cff;text-decoration:underline;word-break:break-all;">$1</a>')
          .replace(/(?<![="'(])(https?:\/\/[^\s<>"'\]）)]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#646cff;text-decoration:underline;word-break:break-all;">$1</a>');

        if (line.startsWith('### ')) {
          elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '14px', marginTop: '6px' }} dangerouslySetInnerHTML={{ __html: processed.replace('### ', '') }} />);
        } else if (line.startsWith('## ')) {
          elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '15px', marginTop: '8px' }} dangerouslySetInnerHTML={{ __html: processed.replace('## ', '') }} />);
        } else if (line.startsWith('# ')) {
          elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '16px', marginTop: '8px' }} dangerouslySetInnerHTML={{ __html: processed.replace('# ', '') }} />);
        } else if (line.startsWith('- ') || line.startsWith('• ')) {
          elements.push(
            <div key={`${partIdx}-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: '#aaaaaa', flexShrink: 0 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: processed.replace(/^[-•] /, '') }} />
            </div>
          );
        } else if (/^\d+\. /.test(line)) {
          elements.push(
            <div key={`${partIdx}-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: '#aaaaaa', flexShrink: 0, minWidth: '20px' }}>{line.match(/^(\d+)\./)?.[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: processed.replace(/^\d+\. /, '') }} />
            </div>
          );
        } else if (line.trim() === '') {
          elements.push(<div key={`${partIdx}-${i}`} style={{ height: '6px' }} />);
        } else {
          elements.push(<div key={`${partIdx}-${i}`} dangerouslySetInnerHTML={{ __html: processed }} />);
        }
      });
    }
  });

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{elements}</div>;
};

const applyTaskAction = (action: TaskAction): { success: boolean; message: string } => {
  try {
    const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
    if (action.type === 'ADD') {
      const p = action.payload;
      const newTask: Task = {
        id: Date.now(), nama: p.nama || 'Tugas Baru', tugas: p.tugas || 'Garapan',
        link: p.link || '#', akun: p.akun || 1, status: p.status || 'Ongoing',
        selesaiHariIni: p.selesaiHariIni ?? false,
        tanggalDitambahkan: new Date().toLocaleDateString('id-ID'),
        kategori: p.kategori || 'Testnet', detailAkun: p.detailAkun || [],
        notes: p.notes || '', deadline: p.deadline || '', estimasiReward: p.estimasiReward || 0,
      };
      tasks.push(newTask);
      localStorage.setItem('airdropTasks', JSON.stringify(tasks));
      return { success: true, message: `✅ Tugas "${newTask.nama}" berhasil ditambahkan!` };
    }
    if (action.type === 'DELETE') {
      const keyword = (action.payload.nama || '').toLowerCase();
      const before = tasks.length;
      const filtered = tasks.filter(t => !t.nama.toLowerCase().includes(keyword));
      if (filtered.length === before) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(filtered));
      return { success: true, message: `🗑️ Tugas "${action.payload.nama}" berhasil dihapus!` };
    }
    if (action.type === 'UPDATE_STATUS') {
      const keyword = (action.payload.nama || '').toLowerCase();
      let found = false;
      const updated = tasks.map(t => {
        if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, status: action.payload.status }; }
        return t;
      });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      return { success: true, message: `✅ Status "${action.payload.nama}" → ${action.payload.status}` };
    }
    if (action.type === 'TOGGLE_DONE') {
      const keyword = (action.payload.nama || '').toLowerCase();
      let found = false;
      const updated = tasks.map(t => {
        if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, selesaiHariIni: action.payload.selesaiHariIni ?? true }; }
        return t;
      });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      const status = (action.payload.selesaiHariIni ?? true) ? 'selesai' : 'belum selesai';
      return { success: true, message: `✅ "${action.payload.nama}" ditandai ${status} hari ini` };
    }
    if (action.type === 'UPDATE') {
      const keyword = (action.payload.nama || '').toLowerCase();
      let found = false;
      const updated = tasks.map(t => {
        if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, ...action.payload }; }
        return t;
      });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      return { success: true, message: `✅ Tugas "${action.payload.nama}" berhasil diperbarui!` };
    }
    return { success: false, message: '❌ Tipe aksi tidak dikenal' };
  } catch (e) {
    return { success: false, message: `❌ Error: ${e}` };
  }
};

const rektLocalReply = (userInput: string, memories: OtakRektMemory[] = []): string => {
  const tasks: any[]        = (() => { try { return JSON.parse(localStorage.getItem('airdropTasks') || '[]'); } catch { return []; } })();
  const transactions: any[] = (() => { try { return JSON.parse(localStorage.getItem('transactions') || '[]'); } catch { return []; } })();
  const portfolio: any[]    = (() => { try { return JSON.parse(localStorage.getItem('portfolioTokens') || '[]'); } catch { return []; } })();
  if (memories.length > 0) {
    const q = userInput.toLowerCase();
    const relevant = memories.filter(m => {
      const words = q.split(/\s+/).filter(w => w.length > 3);
      return words.some(w => m.content.toLowerCase().includes(w) || (m.tags || []).some(t => t.toLowerCase().includes(w)));
    });
    if (relevant.length > 0) {
      const memList = relevant.slice(0, 5).map(m => `- [${m.category}] ${m.content}`).join('\n');
      return `🧠 **Dari ingatan Rekt:**\n\n${memList}\n\n_(Rekt offline — jawaban dari memori tersimpan)_`;
    }
  }

  const q = userInput.toLowerCase();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const ongoingTasks  = tasks.filter(t => t.status === 'Ongoing');
  const belumSelesai  = ongoingTasks.filter(t => !t.selesaiHariIni);
  const sudahSelesai  = ongoingTasks.filter(t => t.selesaiHariIni);
  const endedTasks    = tasks.filter(t => t.status === 'END');
  const waitlistTasks = tasks.filter(t => t.status === 'Waitlist');

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((a: number, b: any) => a + b.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a: number, b: any) => a + b.amount, 0);
  const holdingValue = portfolio.filter(p => p.status === 'holding').reduce((a: number, p: any) => a + p.jumlahToken * p.hargaPerToken, 0);

  const deadlineDekat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(t => {
      const dl = new Date(t.deadline!); dl.setHours(0, 0, 0, 0);
      return { nama: t.nama, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000), link: t.link };
    })
    .filter(t => t.diff >= 0 && t.diff <= 7)
    .sort((a, b) => a.diff - b.diff);
  if (q.match(/progress|hari ini|ringkas|summary|selesai/)) {
    const pct = ongoingTasks.length > 0 ? Math.round((sudahSelesai.length / ongoingTasks.length) * 100) : 0;
    return `📊 **Progress Hari Ini**\n\n` +
      `✅ Selesai: **${sudahSelesai.length}** / ${ongoingTasks.length} (${pct}%)\n` +
      `🔴 Belum: **${belumSelesai.length}** tugas\n\n` +
      (belumSelesai.length > 0
        ? `**Yang belum dikerjakan:**\n${belumSelesai.slice(0, 5).map((t: any) => `- ${t.nama}${t.link ? ` → ${t.link}` : ''}`).join('\n')}${belumSelesai.length > 5 ? `\n...dan ${belumSelesai.length - 5} lagi` : ''}`
        : `🎉 Semua sudah beres hari ini, mantap!`);
  }

  if (q.match(/deadline|mepet|mendekat|expire/)) {
    if (deadlineDekat.length === 0) return `✅ **Tidak ada deadline** dalam 7 hari ke depan. Santai dulu bro!`;
    return `⏰ **Deadline Mendekat:**\n\n` +
      deadlineDekat.map((t: any) =>
        `- **${t.nama}** → ${t.diff === 0 ? '🔴 HARI INI' : t.diff === 1 ? '🟠 Besok' : `🟡 ${t.diff} hari lagi`}${t.link ? `\n  🔗 ${t.link}` : ''}`
      ).join('\n');
  }

  if (q.match(/list|tampil|semua|daftar|airdrop/)) {
    if (tasks.length === 0) return `📋 Belum ada tugas airdrop yang tercatat.`;
    const lines = tasks.slice(0, 15).map((t: any) =>
      `- **${t.nama}** [${t.status}]${t.link ? ` → ${t.link}` : ''}${t.kategori ? ` _(${t.kategori})_` : ''}`
    );
    return `📋 **Daftar Airdrop** (${tasks.length} total):\n\n${lines.join('\n')}${tasks.length > 15 ? `\n...dan ${tasks.length - 15} lagi` : ''}`;
  }

  if (q.match(/garap|kerjakan|mulai|mana dulu|prioritas/)) {
    if (belumSelesai.length === 0) return `🎉 Semua airdrop **sudah dikerjakan** hari ini! Istirahat dulu.`;
    const prioritized = [...belumSelesai].sort((a: any, b: any) => {
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
    const target = prioritized[0];
    const kat = target.kategori || 'Testnet';
    const guideMap: Record<string, string> = {
      'Testnet':      '1) Buka link\n2) Connect wallet (MetaMask/Rabby)\n3) Klaim faucet jika ada\n4) Lakukan transaksi testnet (swap/bridge)\n5) Cek poin/XP bertambah',
      'Telegram Bot': '1) Buka link di Telegram\n2) Start bot (/start)\n3) Selesaikan daily task\n4) Klaim reward harian',
      'Mainnet':      '1) Buka link\n2) Connect wallet (pastikan ada saldo)\n3) Lakukan aksi on-chain\n4) Screenshot bukti transaksi',
      'Node':         '1) Cek status node\n2) Pastikan node running\n3) Claim reward jika ada\n4) Update software jika perlu',
      'Whitelist':    '1) Buka link\n2) Isi form whitelist\n3) Follow sosmed yang diminta\n4) Submit & catat konfirmasi',
      'Waitlist':     '1) Cek status waitlist\n2) Selesaikan quest tambahan\n3) Invite referral jika perlu',
    };
    const guide = guideMap[kat] || guideMap['Testnet'];
    return `🚀 **Garap sekarang: ${target.nama}**\n` +
      `Kategori: ${kat}${target.deadline ? ` | Deadline: ${target.deadline}` : ''}\n` +
      (target.link ? `🔗 ${target.link}\n` : '') +
      `\n**Step-by-step:**\n${guide}\n\n` +
      `_(${belumSelesai.length - 1} tugas lain masih antri)_`;
  }

  if (q.match(/keuangan|income|expense|profit|uang|duit|finansial/)) {
    const profit = totalIncome - totalExpense;
    return `💰 **Ringkasan Keuangan**\n\n` +
      `📈 Total Income: **$${totalIncome.toFixed(2)}**\n` +
      `📉 Total Expense: **$${totalExpense.toFixed(2)}**\n` +
      `${profit >= 0 ? '✅' : '❌'} Net Profit: **$${profit.toFixed(2)}** (${profit >= 0 ? 'Untung' : 'Rugi'})\n` +
      `📑 Total Transaksi: ${transactions.length}`;
  }

  if (q.match(/portfolio|token|holding|aset/)) {
    const holdingTokens = portfolio.filter((p: any) => p.status === 'holding');
    if (holdingTokens.length === 0) return `📦 Portfolio kamu masih kosong. Tambah token dulu di menu Portfolio!`;
    const lines = holdingTokens.slice(0, 8).map((p: any) =>
      `- **${p.tokenSymbol}** ${p.jumlahToken.toLocaleString('en-US', { maximumFractionDigits: 2 })} × $${p.hargaPerToken} = **$${(p.jumlahToken * p.hargaPerToken).toFixed(2)}**`
    );
    return `💼 **Portfolio Holding** (${holdingTokens.length} token)\n\n${lines.join('\n')}\n\n💎 Total Nilai: **$${holdingValue.toFixed(2)}**`;
  }

  if (q.match(/statistik|stats|total|rekap|dashboard/)) {
    return `📊 **Statistik Erdrop Manager**\n\n` +
      `🗂 Total Airdrop: **${tasks.length}**\n` +
      `▶️ Ongoing: **${ongoingTasks.length}**\n` +
      `✅ Selesai hari ini: **${sudahSelesai.length}**\n` +
      `🏁 Ended: **${endedTasks.length}**\n` +
      `⏳ Waitlist: **${waitlistTasks.length}**\n\n` +
      `💰 Income: **$${totalIncome.toFixed(2)}** | Profit: **$${(totalIncome - totalExpense).toFixed(2)}**\n` +
      `💼 Portfolio: **$${holdingValue.toFixed(2)}**`;
  }

  if (q.match(/^(hai|halo|hi|hello|hei|pagi|siang|malam|oi|oy)\b/)) {
    const jam = new Date().getHours();
    const sapa = jam < 11 ? 'Pagi' : jam < 15 ? 'Siang' : jam < 18 ? 'Sore' : 'Malam';
    const memInfo = memories.length > 0 ? `\n🧠 Aku punya **${memories.length} ingatan** tentang kamu — tanya aja!` : '';
    return `${sapa}! 👋 Aku **Rekt** — lagi mode offline karena token API habis.${memInfo}\n\n` +
      `Aku tetap bisa bantu kamu dengan data lokal:\n` +
      `- 📋 **"list"** — lihat semua airdrop\n` +
      `- 🚀 **"garap"** — cari airdrop yang harus dikerjakan\n` +
      `- ⏰ **"deadline"** — cek deadline mendekat\n` +
      `- 📊 **"progress"** — progress hari ini\n` +
      `- 💰 **"keuangan"** — ringkasan finansial\n` +
      `- 💼 **"portfolio"** — lihat token holding\n` +
      `- 📈 **"statistik"** — overview lengkap`;
  }

  const memFallback = memories.length > 0
    ? `\n\n🧠 Rekt punya **${memories.length} ingatan** tentang kamu. Coba tanya sesuatu yang spesifik!`
    : `\n\nSemakin sering chat dengan Rekt (saat online), makin banyak ingatan yang tersimpan! 💡`;
  return `⚡ **Rekt (Mode Offline)**\n\n` +
    `Maaf, token API kamu habis jadi aku lagi jalan tanpa koneksi AI.${memFallback}\n\n` +
    `Yang bisa aku bantu sekarang:\n` +
    `- **"garap"** — rekomendasi airdrop yang harus dikerjakan\n` +
    `- **"list"** — tampilkan semua airdrop\n` +
    `- **"deadline"** — cek deadline mendekat\n` +
    `- **"progress"** — progress hari ini\n` +
    `- **"keuangan"** — ringkasan finansial\n` +
    `- **"portfolio"** — aset yang sedang holding\n` +
    `- **"statistik"** — rekap lengkap\n\n` +
    `_Top up token API kamu untuk balik ke mode penuh ya!_ 🔑`;
};

const extractTextFromFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['txt', 'md', 'csv', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Gagal membaca file teks'));
      reader.readAsText(file, 'utf-8');
      return;
    }
    if (ext === 'pdf') {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const bytes = new Uint8Array(reader.result as ArrayBuffer);
          let raw = '';
          for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
          const textMatches = raw.match(/BT[\s\S]*?ET/g) || [];
          let extracted = '';
          for (const block of textMatches) {
            const tjMatches = block.match(/\((.*?)\)\s*Tj/g) || [];
            for (const tj of tjMatches) {
              const inner = tj.match(/\((.*?)\)\s*Tj/)?.[1] || '';
              extracted += inner + ' ';
            }
          }
          if (!extracted.trim()) {
            const printable = raw.match(/[\x20-\x7E]{4,}/g) || [];
            extracted = printable.filter(s => /[a-zA-Z]{2,}/.test(s)).join(' ');
          }
          resolve(extracted.trim().slice(0, 15000) || '(Konten PDF tidak dapat diekstrak)');
        } catch (e) { reject(new Error(`Gagal parse PDF: ${e}`)); }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file PDF'));
      reader.readAsArrayBuffer(file);
      return;
    }
    reject(new Error(`Format .${ext} belum didukung.`));
  });
};

const fetchUrlContent = async (url: string): Promise<string> => {
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (data?.contents) return stripHtmlTags(data.contents).slice(0, 15000);
      const text = await res.text();
      return stripHtmlTags(text).slice(0, 15000);
    } catch { continue; }
  }
  throw new Error('Tidak bisa mengambil konten URL ini.');
};

const stripHtmlTags = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ').trim();

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      title="Copy"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4caf50' : '#555', padding: '4px 6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
    >
      {copied ? <><FaCheck size={11} /> Copied</> : <><FaRegCopy size={11} /> Copy</>}
    </button>
  );
};

export const AIAssistant: React.FC = () => {
  const [messages, setMessages]           = useState<Message[]>(loadMessages);
  const [input, setInput]                 = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [apiKey, setApiKey]               = useState<string>(loadApiKey);
  const [apiKeyInput, setApiKeyInput]     = useState('');
  const [showApiKeySetup, setShowApiKeySetup] = useState(!loadApiKey());
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading]     = useState(false);
  const [modelsError, setModelsError]         = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [actionFeedback, setActionFeedback]   = useState<Record<string, string>>({});
  const [importedContexts, setImportedContexts] = useState<ImportedContext[]>([]);
  const [showImportPanel, setShowImportPanel]   = useState(false);
  const [urlInput, setUrlInput]                 = useState('');
  const [importLoading, setImportLoading]       = useState(false);
  const [importError, setImportError]           = useState('');
  const [importSuccess, setImportSuccess]       = useState('');
  const [streamingText, setStreamingText]       = useState('');
  const [temperature, setTemperature]           = useState(0.7);
  const [showSettings, setShowSettings]         = useState(false);
  const [totalTokens, setTotalTokens]           = useState(0);
  const [showGarapPanel, setShowGarapPanel]     = useState(false);
  const [showSkillStore, setShowSkillStore]       = useState(false);
  const [storeSkills, setStoreSkills]             = useState<ClawHubSkill[]>([]);
  const [storeLoading, setStoreLoading]           = useState(false);
  const [storeError, setStoreError]               = useState('');
  const [storeSearch, setStoreSearch]             = useState('');
  const [storeSort, setStoreSort]                 = useState<'downloads' | 'installs' | 'stars' | 'newest'>('downloads');
  const [installedSkills, setInstalledSkills]     = useState<InstalledSkill[]>(() => {
    try { return JSON.parse(localStorage.getItem(SKILLS_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [installingSlug, setInstallingSlug]       = useState('');
  const [skillInstallMsg, setSkillInstallMsg]     = useState('');
  const [previewSkill, setPreviewSkill]           = useState<InstalledSkill | null>(null);
  const [showOtakRekt, setShowOtakRekt]           = useState(false);
  const [otakMemories, setOtakMemories]           = useState<OtakRektMemory[]>(() => {
    try { return JSON.parse(localStorage.getItem(OTAK_REKT_KEY) || '[]'); } catch { return []; }
  });
  const [otakInput, setOtakInput]                 = useState('');
  const [otakCategory, setOtakCategory]           = useState<OtakRektMemory['category']>('fakta');
  const [otakTags, setOtakTags]                   = useState('');
  const [otakEditId, setOtakEditId]               = useState<string | null>(null);
  const [otakFilter, setOtakFilter]               = useState<OtakRektMemory['category'] | 'semua'>('semua');
  const [otakSearch, setOtakSearch]               = useState('');
  const [otakMsg, setOtakMsg]                     = useState('');
  const otakImportRef                             = useRef<HTMLInputElement>(null);
  const bottomRef       = useRef<HTMLDivElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const autoTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMsgRef  = useRef<number>(Date.now());
  const [autoMode, setAutoMode] = useState<boolean>(() => {
    try { return localStorage.getItem('rektAutoMode') !== 'false'; } catch { return true; }
  });

  const activeModel: ModelInfo = availableModels.find(m => m.id === selectedModelId)
    || { id: selectedModelId, label: selectedModelId || 'Pilih Model', color: '#64748b', badge: 'AI' };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const fetchModels = useCallback(async (key: string) => {
    if (!key) return;
    setModelsLoading(true);
    setModelsError('');
    try {
      const res = await fetch(`${BLUESMINDS_BASE}/models`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: any[] = Array.isArray(data) ? data : (data.data || []);
      const mapped: ModelInfo[] = list
        .filter((m: any) => m.id)
        .map((m: any) => {
          const { color, badge } = getModelMeta(m.id);
          return { id: m.id, label: m.id, color, badge, owned: m.owned_by || '' };
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      setAvailableModels(mapped);
      if (mapped.length > 0) setSelectedModelId(prev => prev || mapped[0].id);
    } catch (e: any) {
      setModelsError(`Gagal memuat model: ${e.message}`);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) fetchModels(apiKey);
  }, [apiKey, fetchModels]);

  const saveApiKey = () => {
    const key = apiKeyInput.trim();
    if (!key.startsWith('sk-')) { alert('API key harus dimulai dengan sk-'); return; }
    localStorage.setItem(API_KEY_STORAGE, key);
    setApiKey(key);
    setApiKeyInput('');
    setShowApiKeySetup(false);
    fetchModels(key);
  };

  const removeApiKey = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setApiKey('');
    setShowApiKeySetup(true);
  };

  const getInstalledSkillsContext = useCallback((): string => {
    if (installedSkills.length === 0) return '';
    return `\n=== INSTALLED CLAWHUB SKILLS (${installedSkills.length}) ===\n` +
      installedSkills.map(s =>
        `[SKILL: ${s.name} by ${s.author}]\n${s.content.slice(0, 2000)}${s.content.length > 2000 ? '\n...(terpotong)' : ''}`
      ).join('\n\n---\n');
  }, [installedSkills]);

  const getOtakRektContext = useCallback((): string => {
    if (otakMemories.length === 0) return '';
    return `\n=== OTAK REKT — PERMANENT MEMORY (${otakMemories.length} item) ===\n` +
      `Ini adalah memori permanen yang disimpan pengguna untuk kamu ingat selalu:\n` +
      otakMemories.map(m =>
        `[${m.category.toUpperCase()}${m.tags?.length ? ` #${m.tags.join(' #')}` : ''}] ${m.content}`
      ).join('\n') +
      `\n=== END MEMORY ===`;
  }, [otakMemories]);

  const getContextData = useCallback(() => {
    const tasks: Task[]               = JSON.parse(localStorage.getItem('airdropTasks')    || '[]');
    const transactions: Transaction[] = JSON.parse(localStorage.getItem('transactions')    || '[]');
    const portfolio: PortfolioToken[] = JSON.parse(localStorage.getItem('portfolioTokens') || '[]');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ongoingTasks   = tasks.filter(t => t.status === 'Ongoing');
    const completedToday = ongoingTasks.filter(t => t.selesaiHariIni).length;

    const overdueOrSoon = tasks.filter(t => {
      if (!t.deadline || t.status === 'END') return false;
      const dl = new Date(t.deadline); dl.setHours(0, 0, 0, 0);
      return Math.ceil((dl.getTime() - today.getTime()) / 86400000) <= 7;
    }).map(t => {
      const dl = new Date(t.deadline!); dl.setHours(0, 0, 0, 0);
      const diff = Math.ceil((dl.getTime() - today.getTime()) / 86400000);
      return { nama: t.nama, diff };
    });

    const totalIncome  = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    const holdingValue = portfolio.filter(p => p.status === 'holding').reduce((a, p) => a + p.jumlahToken * p.hargaPerToken, 0);

    const taskList = tasks.slice(0, 30).map(t =>
      `id:${t.id} nama:"${t.nama}" status:${t.status} kategori:${t.kategori || '-'} selesai:${t.selesaiHariIni ? 'Y' : 'N'}${t.deadline ? ` dl:${t.deadline}` : ''}${t.estimasiReward ? ` reward:$${t.estimasiReward}` : ''}`
    ).join('\n');

    const importedSection = importedContexts.length > 0
      ? `\n=== KONTEKS TAMBAHAN (${importedContexts.length} item) ===\n` +
        importedContexts.map((ctx, i) =>
          `[${i + 1}] ${ctx.type === 'url' ? '🔗' : '📄'} ${ctx.name}:\n${ctx.content.slice(0, 3000)}${ctx.content.length > 3000 ? '\n...(terpotong)' : ''}`
        ).join('\n\n---\n')
      : '';

    return `=== DATA ERDROP MANAGER ===
Tanggal: ${today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
AIRDROP: total=${tasks.length} ongoing=${ongoingTasks.length} selesaiHariIni=${completedToday} END=${tasks.filter(t => t.status === 'END').length} waitlist=${tasks.filter(t => t.status === 'Waitlist').length}
DAFTAR TUGAS (max 30):
${taskList || '(kosong)'}
DEADLINE ≤7hr:
${overdueOrSoon.length > 0 ? overdueOrSoon.map(d => `- ${d.nama}: ${d.diff < 0 ? `LEWAT ${Math.abs(d.diff)}hr` : d.diff === 0 ? 'HARI INI' : `${d.diff}hr`}`).join('\n') : 'tidak ada'}
KEUANGAN: income=$${totalIncome.toFixed(2)} expense=$${totalExpense.toFixed(2)} profit=$${(totalIncome - totalExpense).toFixed(2)} txn=${transactions.length}
PORTFOLIO: nilai=$${holdingValue.toFixed(2)} token=${portfolio.filter(p => p.status === 'holding').length}
${portfolio.filter(p => p.status === 'holding').slice(0, 8).map(p => `- ${p.tokenSymbol} ${p.jumlahToken}x$${p.hargaPerToken}=$${(p.jumlahToken * p.hargaPerToken).toFixed(2)}`).join('\n') || '(kosong)'}
=== END ===${importedSection}${getInstalledSkillsContext()}${getOtakRektContext()}`;
  }, [importedContexts, getInstalledSkillsContext, getOtakRektContext]);

  const sendMessage = async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;
    if (!apiKey) { setShowApiKeySetup(true); return; }

    const userMsg: Message = { role: 'user', content: userInput, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setStreamingText('');

    abortRef.current = new AbortController();

    try {
      const systemPrompt = `Kamu adalah asisten AI bernama Rekt untuk Erdrop Manager (manajemen airdrop crypto).
Data pengguna saat ini:
${getContextData()}

=== KEMAMPUAN GARAP AIRDROP ===
Kamu bisa membantu pengguna mengerjakan (garap) airdrop satu per satu. Jika pengguna minta garap airdrop:
1. Pilih airdrop ongoing yang selesaiHariIni:N (belum dikerjakan hari ini), urutkan dari deadline terdekat
2. Tampilkan nama, link, kategori, dan deadline-nya
3. Berikan panduan STEP-BY-STEP yang spesifik dan actionable untuk mengerjakan airdrop tersebut
4. Setelah panduan, sertakan JSON untuk menandai tugas selesai

PANDUAN PER KATEGORI (gunakan ini sebagai referensi panduan step-by-step):
- Testnet: 1) Buka link, 2) Connect wallet (MetaMask/Rabby), 3) Klaim faucet jika ada, 4) Lakukan transaksi testnet (swap/bridge/mint), 5) Cek poin/XP bertambah
- Telegram Bot: 1) Buka link di Telegram, 2) Start bot (/start), 3) Selesaikan daily task (klik tombol, join channel, invite teman jika perlu), 4) Klaim reward harian
- Mainnet: 1) Buka link, 2) Connect wallet dengan saldo cukup, 3) Lakukan aksi on-chain (swap, provide liquidity, dll), 4) Screenshot bukti transaksi
- Node: 1) Cek status node, 2) Pastikan node running (cek uptime), 3) Claim reward jika ada, 4) Update software jika ada update
- Whitelist: 1) Buka link, 2) Isi form whitelist (email, wallet, sosmed), 3) Follow semua sosmed yang diminta, 4) Submit dan catat konfirmasi
- Waitlist: 1) Cek status waitlist, 2) Selesaikan quest tambahan jika ada, 3) Invite referral jika perlu

FORMAT TAMPILAN TUGAS (gunakan ini saat menampilkan airdrop yang perlu dikerjakan):
🔴 BELUM DIKERJAKAN | 🟢 SUDAH SELESAI
Saat list airdrop, tampilkan juga linknya agar mudah diklik.

=== KEMAMPUAN MANAJEMEN TUGAS ===
Kamu bisa mengelola tugas pengguna. Jika pengguna meminta:
- MENAMBAH tugas: sertakan blok JSON di akhir respons
- MENGHAPUS tugas: sertakan blok JSON di akhir respons
- MENGUBAH STATUS tugas: sertakan blok JSON di akhir respons
- MENANDAI selesai/belum: sertakan blok JSON di akhir respons

FORMAT JSON (wajib dibungkus \`\`\`json ... \`\`\`):
Untuk TAMBAH:
\`\`\`json
[{"type":"ADD","label":"Tambah tugas X","payload":{"nama":"X","tugas":"Garapan","link":"#","kategori":"Testnet","status":"Ongoing","akun":1,"selesaiHariIni":false,"detailAkun":[]}}]
\`\`\`
Untuk HAPUS:
\`\`\`json
[{"type":"DELETE","label":"Hapus tugas X","payload":{"nama":"X"}}]
\`\`\`
Untuk UBAH STATUS:
\`\`\`json
[{"type":"UPDATE_STATUS","label":"Ubah status X","payload":{"nama":"X","status":"END"}}]
\`\`\`
Untuk TANDAI SELESAI:
\`\`\`json
[{"type":"TOGGLE_DONE","label":"Tandai X selesai","payload":{"nama":"X","selesaiHariIni":true}}]
\`\`\`

Status valid: "Ongoing", "END", "Waitlist", "Nunggu Info"
Kategori valid: "Testnet", "Mainnet", "Telegram Bot", "Node", "Whitelist", "Waitlist"

PENTING:
- Hanya sertakan JSON jika ada aksi yang perlu dilakukan
- Jika ada konteks tambahan dari file/URL, gunakan informasi tersebut
- JSON harus valid dan di akhir respons
- Gunakan Bahasa Indonesia santai, emoji boleh, singkat & to the point
- Gunakan markdown (bold **text**, list dengan -, heading dengan ##) untuk memperjelas jawaban
- Saat garap airdrop, selalu tampilkan link airdropnya dan panduan step-by-step yang jelas
`;

      const historyMessages = newMessages.slice(-14).map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${BLUESMINDS_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: selectedModelId,
          messages: [{ role: 'system', content: systemPrompt }, ...historyMessages],
          max_tokens: 1500,
          temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let usageTokens = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.replace('data: ', '').trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              fullText += delta;
              setStreamingText(fullText);
              if (parsed.usage) usageTokens = parsed.usage.total_tokens || 0;
            } catch {}
          }
        }
      } else {
        const data = await response.json();
        fullText = data.choices?.[0]?.message?.content || 'Maaf, tidak bisa memproses.';
        usageTokens = data.usage?.total_tokens || 0;
      }

      setStreamingText('');
      setTotalTokens(prev => prev + usageTokens);

      const { cleanText, actions } = parseActions(fullText);
      const assistantMsg: Message = {
        role: 'assistant', content: cleanText, timestamp: Date.now(),
        actions: actions.length > 0 ? actions : undefined,
        model: selectedModelId,
        tokensUsed: usageTokens,
      };
      setMessages(prev => [...prev, assistantMsg]);
      autoExtractMemory(userInput, cleanText);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⛔ Dihentikan.', timestamp: Date.now(), model: selectedModelId }]);
      } else {
        const errMsg = err.message || '';
        const isQuotaOrAuth =
          errMsg.includes('429') ||
          errMsg.includes('401') ||
          errMsg.includes('quota') ||
          errMsg.includes('limit') ||
          errMsg.includes('unauthorized') ||
          errMsg.includes('insufficient');

        if (isQuotaOrAuth) {
          const localReply = rektLocalReply(userInput, otakMemories);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `> _Mode Offline — Token API habis/tidak valid. Rekt berjalan dari memori lokal._\n\n${localReply}`,
            timestamp: Date.now(),
            model: 'rekt-local',
          }]);
        } else {
          try {
            const systemPrompt2 = `Kamu adalah Rekt, asisten Erdrop Manager. Data: ${getContextData().slice(0, 2000)}. Jawab singkat dalam Bahasa Indonesia.`;
            const historyMessages2 = [...messages, { role: 'user', content: userInput }].slice(-10).map(m => ({ role: m.role, content: m.content }));

            const resp2 = await fetch(`${BLUESMINDS_BASE}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: selectedModelId,
                messages: [{ role: 'system', content: systemPrompt2 }, ...historyMessages2],
                max_tokens: 1000,
                temperature,
                stream: false,
              }),
            });

            const data2 = await resp2.json();
            if (!resp2.ok) {
              const errMsg2 = data2?.error?.message || `HTTP ${resp2.status}`;
              const isQuota2 =
                resp2.status === 429 ||
                resp2.status === 401 ||
                errMsg2.toLowerCase().includes('quota') ||
                errMsg2.toLowerCase().includes('limit') ||
                errMsg2.toLowerCase().includes('unauthorized');

              if (isQuota2) {
                const localReply = rektLocalReply(userInput, otakMemories);
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `> ⚡ _Mode Offline — Token API habis/tidak valid. Rekt berjalan dari memori lokal._\n\n${localReply}`,
                  timestamp: Date.now(),
                  model: 'rekt-local',
                }]);
              } else {
                throw new Error(errMsg2);
              }
            } else {
              const text2 = data2.choices?.[0]?.message?.content || 'Maaf, tidak bisa memproses.';
              const { cleanText: ct2, actions: acts2 } = parseActions(text2);
              setMessages(prev => [...prev, {
                role: 'assistant', content: ct2, timestamp: Date.now(),
                actions: acts2.length > 0 ? acts2 : undefined, model: selectedModelId,
              }]);
              autoExtractMemory(userInput, ct2);
            }
          } catch (fallbackErr: any) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `❌ **Error**: ${err.message}\n\nCoba ganti model atau periksa koneksi internet.`,
              timestamp: Date.now(),
            }]);
          }
        }
      }
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsLoading(false);
    setStreamingText('');
  };

  const applyAction = (msgIndex: number, actionIndex: number, action: TaskAction) => {
    const result = applyTaskAction(action);
    const key = `${msgIndex}-${actionIndex}`;
    setActionFeedback(prev => ({ ...prev, [key]: result.message }));
    setMessages(prev => prev.map((msg, mIdx) => {
      if (mIdx !== msgIndex || !msg.actions) return msg;
      return { ...msg, actions: msg.actions.map((a, aIdx) => aIdx === actionIndex ? { ...a, applied: true } : a) };
    }));
    window.dispatchEvent(new Event('storage'));
  };

  const applyAllActions = (msgIndex: number, actions: TaskAction[]) => {
    actions.forEach((action, aIdx) => {
      if (!action.applied) setTimeout(() => applyAction(msgIndex, aIdx, action), aIdx * 100);
    });
  };

  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setTotalTokens(0);
    localStorage.removeItem(STORAGE_KEY);
  };

  const rektBrain = useCallback((): string => {
    const tasks: Task[]               = JSON.parse(localStorage.getItem('airdropTasks')    || '[]');
    const transactions: Transaction[] = JSON.parse(localStorage.getItem('transactions')    || '[]');
    const portfolio: PortfolioToken[] = JSON.parse(localStorage.getItem('portfolioTokens') || '[]');

    const now   = new Date();
    const hour  = now.getHours();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const ongoingTasks    = tasks.filter(t => t.status === 'Ongoing');
    const belumSelesai    = ongoingTasks.filter(t => !t.selesaiHariIni);
    const sudahSelesai    = ongoingTasks.filter(t => t.selesaiHariIni);
    const totalOngoing    = ongoingTasks.length;
    const totalSelesai    = sudahSelesai.length;

    const deadlineMendekat = tasks
      .filter(t => t.deadline && t.status !== 'END')
      .map(t => {
        const dl = new Date(t.deadline!); dl.setHours(0,0,0,0);
        return { nama: t.nama, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000), link: t.link };
      })
      .filter(t => t.diff >= 0 && t.diff <= 3)
      .sort((a, b) => a.diff - b.diff);

    const deadlineLewat = tasks
      .filter(t => t.deadline && t.status !== 'END')
      .map(t => {
        const dl = new Date(t.deadline!); dl.setHours(0,0,0,0);
        return { nama: t.nama, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000) };
      })
      .filter(t => t.diff < 0);

    const totalIncome  = transactions.filter(t => t.type === 'income').reduce((a,b) => a+b.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a,b) => a+b.amount, 0);
    const profit       = totalIncome - totalExpense;
    const holdingVal   = portfolio.filter(p => p.status === 'holding').reduce((a,p) => a + p.jumlahToken * p.hargaPerToken, 0);
    const lastMsgs = messages.slice(-6);
    const lastUserMsg = [...lastMsgs].reverse().find(m => m.role === 'user')?.content?.toLowerCase() || '';
    const lastBotMsg  = [...lastMsgs].reverse().find(m => m.role === 'assistant')?.content || '';
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const neurons: (() => string | null)[] = [
      () => {
        const urgent = deadlineMendekat.filter(d => d.diff <= 1);
        if (!urgent.length) return null;
        const t = urgent[0];
        const label = t.diff === 0 ? 'HARI INI' : 'besok';
        return pick([
          `⚠️ Eh bro, **${t.nama}** deadline-nya ${label}! Jangan sampe kelewatan ya.`,
          `🚨 Deadline **${t.nama}** tinggal ${label}! Udah dikerjain belum?`,
          `Bro... **${t.nama}** mau expired ${label}. Gas dulu sebelum terlambat 🔥`,
        ]);
      },
      () => {
        const soon = deadlineMendekat.filter(d => d.diff >= 2 && d.diff <= 3);
        if (!soon.length) return null;
        const t = soon[0];
        return pick([
          `📅 Btw, **${t.nama}** deadlinenya ${t.diff} hari lagi. Masih aman, tapi jangan ditunda terus.`,
          `Ingat ya, **${t.nama}** tinggal ${t.diff} hari. Mending dikerjain duluan sebelum numpuk 😅`,
        ]);
      },

      () => {
        if (!deadlineLewat.length) return null;
        const t = deadlineLewat[0];
        return pick([
          `💀 Btw, **${t.nama}** kayaknya udah lewat deadline ${Math.abs(t.diff)} hari lalu. Mending update statusnya ke END deh.`,
          `Eh, **${t.nama}** udah expire ${Math.abs(t.diff)} hari lalu bro. Hapus atau pindah ke END aja biar rapih.`,
        ]);
      },

      () => {
        if (totalSelesai === 0 || totalOngoing === 0) return null;
        const pct = Math.round((totalSelesai / totalOngoing) * 100);
        if (pct >= 80) return pick([
          `🔥 Gila bro, udah ${totalSelesai}/${totalOngoing} airdrop selesai hari ini! Hampir kelar semua, gas!`,
          `Mantap jiwa! ${pct}% airdrop hari ini udah beres. Sisa dikit lagi 💪`,
        ]);
        if (pct >= 50) return pick([
          `Lumayan progress-nya, ${totalSelesai} dari ${totalOngoing} beres hari ini. Lanjut yang sisanya! 🚀`,
          `Udah setengah jalan nih, ${totalSelesai}/${totalOngoing} selesai. Keep going bro!`,
        ]);
        return null;
      },

      () => {
        if (belumSelesai.length === 0) return null;
        if (sudahSelesai.length > 0) return null;
        const random = pick(belumSelesai);
        return pick([
          `Pagi bro! ${belumSelesai.length} airdrop nunggu digauin hari ini. Mulai dari **${random.nama}** dulu? 🚀`,
          `Ayo gas bro, masih ada ${belumSelesai.length} airdrop belum dikerjain nih. **${random.nama}** duluan?`,
          `${belumSelesai.length} garapan nunggu nih. Jangan cuma bengong doang, gas **${random.nama}**! 😄`,
        ]);
      },

      () => {
        if (belumSelesai.length !== 0 || totalOngoing === 0) return null;
        return pick([
          `🎉 MANTAP! Semua airdrop hari ini udah kelar semua! Istirahat dulu, sultan! 👑`,
          `Semua beres! ${totalOngoing} airdrop done hari ini. Lo emang gila bro hahaha 🔥`,
          `GG bro! Semua garapan hari ini done. Besok siap-siap lagi ya 💪`,
        ]);
      },

      () => {
        if (!belumSelesai.length) return null;
        const t = pick(belumSelesai);
        return pick([
          `Eh btw, gimana progress **${t.nama}**? Udah dikerjain belum hari ini?`,
          `**${t.nama}** masih nunggu nih bro, jangan lupa dikerjain ya 😬`,
          `Ngomong-ngomong, **${t.nama}** kapan mau digarap? Deadline udah mepet loh.`,
        ]);
      },

      () => {
        if (transactions.length < 3) return null;
        if (profit > 0) return pick([
          `💰 Btw, profit kamu sekarang $${profit.toFixed(2)}. Lumayan kan! Airdrop emang worth it 🤑`,
          `Cek portfolio dong, total profit udah $${profit.toFixed(2)} nih. Keep grinding!`,
        ]);
        if (profit < 0) return pick([
          `Hmm, pengeluaran lebih gede dari pemasukan nih ($${Math.abs(profit).toFixed(2)} minus). Mending fokus garap airdrop biar balik modal 😅`,
        ]);
        return null;
      },

      () => {
        if (holdingVal < 1) return null;
        return pick([
          `Portfolio holding kamu sekitar $${holdingVal.toFixed(2)} sekarang. Semoga pumping terus bro! 🚀`,
          `Udah cek harga token kamu belum? Total holding sekitar $${holdingVal.toFixed(2)} nih.`,
        ]);
      },

      () => {
        if (hour >= 5 && hour < 9) return pick([
          `Selamat pagi bro! Udah siap garap airdrop hari ini? ☀️`,
          `Pagi! Jangan lupa sarapan dulu sebelum hunting airdrop ya 😄`,
        ]);
        if (hour >= 22 || hour < 2) return pick([
          `Masih melek bro? Jangan begadang kebanyakan gara-gara airdrop ya 😅`,
          `Malam bro! Udah garap semua belum hari ini? Kalau udah, istirahat yang cukup!`,
        ]);
        if (hour >= 12 && hour < 14) return pick([
          `Siang bro! Udah makan siang belum? Jangan skip makan gara-gara asik garap airdrop 😄`,
        ]);
        return null;
      },

      () => {
        return pick([
          `💡 Tips: Gunakan wallet berbeda untuk airdrop berisiko tinggi, biar wallet utama aman.`,
          `💡 Jangan lupa screenshot setiap transaksi airdrop sebagai bukti kalau ada claim nanti.`,
          `💡 Cek Twitter/X airdrop yang kamu ikutin secara berkala, kadang ada info penting yang terlewat.`,
          `💡 Airdrop Testnet biasanya lebih worth kalau proyeknya punya backing investor gede.`,
          `💡 Diversifikasi ya bro, jangan taruh semua effort di satu airdrop aja.`,
          null,
        ]);
      },

      () => {
        if (!lastUserMsg) return null;
        if (lastUserMsg.includes('capek') || lastUserMsg.includes('tired') || lastUserMsg.includes('lelah'))
          return pick([`Istirahat dulu gapapa bro, garapan bisa besok lagi 😊`, `Santai dulu, gak ada yang urgent banget kok sekarang.`]);
        if (lastUserMsg.includes('profit') || lastUserMsg.includes('cuan'))
          return `Semangat bro! Airdrop emang butuh sabar, tapi hasilnya worth it kalau konsisten 💪`;
        if (lastUserMsg.includes('males') || lastUserMsg.includes('malas'))
          return pick([`Haha males juga wajar bro, tapi sayang kalau kelewatan deadline 😬`, `Gas dikit lagi bro, ${belumSelesai.length} airdrop doang kok!`]);
        return null;
      },

      () => {
        if (!lastBotMsg || lastBotMsg.length < 20) return null;
        if (lastBotMsg.includes('selesai') && belumSelesai.length > 0)
          return `Masih ada ${belumSelesai.length} lagi yang belum dikerjain nih, lanjut? 😄`;
        return null;
      },
    ];

    const shuffled = [...neurons].sort(() => Math.random() - 0.5);
    for (const fn of shuffled) {
      const result = fn();
      if (result) return result;
    }

    return pick([
      `Santai aja bro, kamu udah bagus kok progresnya 🙌`,
      `Jangan lupa minum air putih ya bro, udah lama di depan layar nih 😄`,
      `Keep grinding bro! Airdrop season lagi bagus-bagusnya 🚀`,
    ]);
  }, [messages]);

  const sendAutoMessage = useCallback(async () => {
    if (isLoading) return;

    const text = rektBrain();
    if (!text) return;
    const typingDelay = 600 + Math.random() * 800;
    await new Promise(r => setTimeout(r, typingDelay));
    let shown = '';
    for (let i = 0; i < text.length; i++) {
      shown += text[i];
      setStreamingText(shown);
      const ch = text[i];
      const delay = ch === ' ' ? 18 + Math.random() * 25
                  : ch === '.' || ch === '!' || ch === '?' ? 80 + Math.random() * 60
                  : ch === ',' ? 40 + Math.random() * 30
                  : 12 + Math.random() * 18;
      await new Promise(r => setTimeout(r, delay));
    }

    setStreamingText('');
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: text,
      timestamp: Date.now(),
      model: 'rekt-local',
    }]);
  }, [rektBrain, isLoading]);

  useEffect(() => {
    if (!autoMode) return;

    const schedule = () => {
      const delay = 120_000 + Math.random() * 240_000;
      autoTimerRef.current = setTimeout(async () => {
        const idleSince = Date.now() - lastUserMsgRef.current;
        if (idleSince >= 60_000) {
          await sendAutoMessage();
        }
        schedule();
      }, delay);
    };

    schedule();
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, [autoMode, sendAutoMessage]);

  const sendMessageWithTracking = useCallback(async (userInput: string) => {
    lastUserMsgRef.current = Date.now();
    return sendMessage(userInput);
  }, [sendMessage]);

  const fetchStoreSkills = useCallback(async (sort: string, query?: string) => {
    setStoreLoading(true);
    setStoreError('');
    try {
      // Try clawhub HTTP API via corsproxy
      const proxies = [
        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      ];

      const targetUrl = `https://clawhub.ai/api/v1/skills?sort=${sort}&limit=40${query ? `&q=${encodeURIComponent(query)}` : ''}`;
      let list: any[] = [];
      let fetched = false;

      for (const makeProxy of proxies) {
        try {
          const res = await fetch(makeProxy(targetUrl), { signal: AbortSignal.timeout(12000) });
          if (!res.ok) continue;
          const raw = await res.text();
          // allorigins wraps in { contents: "..." }
          let json: any;
          try { json = JSON.parse(raw); } catch { continue; }
          if (json?.contents) {
            try { json = JSON.parse(json.contents); } catch { continue; }
          }
          list = Array.isArray(json) ? json : (json?.skills || json?.data || json?.results || []);
          if (list.length > 0) { fetched = true; break; }
        } catch { continue; }
      }

      // Fallback: GitHub API — list skill dirs in openclaw/skills repo
      if (!fetched || list.length === 0) {
        const ghRes = await fetch(
          'https://api.github.com/repos/openclaw/skills/git/trees/main?recursive=1',
          { headers: { Accept: 'application/vnd.github.v3+json' }, signal: AbortSignal.timeout(12000) }
        );
        if (!ghRes.ok) throw new Error(`GitHub API HTTP ${ghRes.status}`);
        const ghData = await ghRes.json();
        const skillPaths: string[] = (ghData.tree || [])
          .map((f: any) => f.path as string)
          .filter((p: string) => /^skills\/[^/]+\/[^/]+\/SKILL\.md$/.test(p));

        // Build a list from paths
        const seen = new Set<string>();
        list = skillPaths.map((p: string) => {
          const parts = p.split('/');
          const author = parts[1];
          const slug = parts[2];
          const key = `${author}/${slug}`;
          if (seen.has(key)) return null;
          seen.add(key);
          return { slug, name: slug, author, description: '' };
        }).filter(Boolean);

        // Sort by slug name if no better info
        if (sort === 'newest') list.reverse();
        fetched = true;
      }

      setStoreSkills(list.slice(0, 60).map((s: any) => ({
        slug:        s.slug || s.id || '',
        name:        s.name || s.slug || '',
        description: s.description || s.summary || '',
        author:      s.author || s.owner || s.username || '',
        downloads:   s.downloads ?? s.downloadCount ?? 0,
        installs:    s.installs ?? s.installCount ?? 0,
        stars:       s.stars ?? s.starCount ?? 0,
        tags:        s.tags || [],
        license:     s.license || '',
        version:     s.version || s.latestVersion || 'latest',
        highlighted: s.highlighted ?? false,
        suspicious:  s.suspicious ?? false,
      })));
    } catch (e: any) {
      setStoreError(`Gagal memuat skill: ${e.message}`);
    } finally {
      setStoreLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showSkillStore) fetchStoreSkills(storeSort, storeSearch);
  }, [showSkillStore, storeSort]);

  const installSkill = useCallback(async (skill: ClawHubSkill) => {
    if (installingSlug) return;
    setInstallingSlug(skill.slug);
    setSkillInstallMsg('');
    try {
      let skillContent = '';

      // 1. Try GitHub raw SKILL.md directly (no CORS issue)
      const ghRawUrl = `https://raw.githubusercontent.com/openclaw/skills/main/skills/${skill.author}/${skill.slug}/SKILL.md`;
      try {
        const ghRes = await fetch(ghRawUrl, { signal: AbortSignal.timeout(10000) });
        if (ghRes.ok) skillContent = await ghRes.text();
      } catch {}

      // 2. If no GitHub path, try clawhub API detail via proxy to get version, then download ZIP
      if (!skillContent) {
        let version = skill.version || 'latest';
        const proxies = [
          (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
          (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        ];
        for (const makeProxy of proxies) {
          try {
            const dRes = await fetch(makeProxy(`https://clawhub.ai/api/v1/skills/${skill.slug}`), { signal: AbortSignal.timeout(8000) });
            if (!dRes.ok) continue;
            const raw = await dRes.text();
            let json: any;
            try { json = JSON.parse(raw); } catch { continue; }
            if (json?.contents) try { json = JSON.parse(json.contents); } catch {}
            version = json?.latestVersion || json?.version || version;
            break;
          } catch { continue; }
        }

        // Download ZIP and unzip to get SKILL.md using JSZip
        const dlUrl = `https://clawhub.ai/api/v1/download/${skill.slug}/${version}`;
        for (const makeProxy of proxies) {
          try {
            const dlRes = await fetch(makeProxy(dlUrl), { signal: AbortSignal.timeout(15000) });
            if (!dlRes.ok) continue;
            const blob = await dlRes.blob();
            // Dynamically load JSZip from CDN
            const JSZip = await new Promise<any>((res, rej) => {
              if ((window as any).JSZip) return res((window as any).JSZip);
              const s = document.createElement('script');
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
              s.onload = () => res((window as any).JSZip);
              s.onerror = rej;
              document.head.appendChild(s);
            });
            const zip = await JSZip.loadAsync(blob);
            const skillFile = Object.keys(zip.files).find(
              (f: string) => f.toLowerCase().endsWith('skill.md') && !zip.files[f].dir
            );
            if (skillFile) {
              skillContent = await zip.files[skillFile].async('string');
              break;
            }
          } catch { continue; }
        }
      }

      if (!skillContent) {
        skillContent = `# ${skill.name || skill.slug}\n\nAuthor: ${skill.author}\nSlug: ${skill.slug}\n\n${skill.description || '(No description available)'}`;
      }

      const newSkill: InstalledSkill = {
        slug:        skill.slug,
        name:        skill.name || skill.slug,
        description: skill.description,
        content:     skillContent,
        installedAt: Date.now(),
        author:      skill.author,
      };

      setInstalledSkills(prev => {
        const updated = [...prev.filter(s => s.slug !== skill.slug), newSkill];
        localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      setSkillInstallMsg(`✅ Skill "${newSkill.name}" berhasil diinstall!`);
      setTimeout(() => setSkillInstallMsg(''), 3000);
    } catch (e: any) {
      setSkillInstallMsg(`❌ Gagal install: ${e.message}`);
      setTimeout(() => setSkillInstallMsg(''), 4000);
    } finally {
      setInstallingSlug('');
    }
  }, [installingSlug]);

  const uninstallSkill = useCallback((slug: string) => {
    setInstalledSkills(prev => {
      const updated = prev.filter(s => s.slug !== slug);
      localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const saveOtakMemories = useCallback((mems: OtakRektMemory[]) => {
    localStorage.setItem(OTAK_REKT_KEY, JSON.stringify(mems));
    setOtakMemories(mems);
  }, []);

  const addOrUpdateMemory = useCallback(() => {
    if (!otakInput.trim()) return;
    const tags = otakTags.split(',').map(t => t.trim()).filter(Boolean);
    if (otakEditId) {
      setOtakMemories(prev => {
        const updated = prev.map(m =>
          m.id === otakEditId
            ? { ...m, content: otakInput.trim(), category: otakCategory, tags, updatedAt: Date.now() }
            : m
        );
        localStorage.setItem(OTAK_REKT_KEY, JSON.stringify(updated));
        return updated;
      });
      setOtakMsg('✅ Memory diperbarui!');
    } else {
      const newMem: OtakRektMemory = {
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        category: otakCategory,
        content: otakInput.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags,
      };
      setOtakMemories(prev => {
        const updated = [...prev, newMem];
        localStorage.setItem(OTAK_REKT_KEY, JSON.stringify(updated));
        return updated;
      });
      setOtakMsg('✅ Memory disimpan!');
    }
    setOtakInput('');
    setOtakTags('');
    setOtakEditId(null);
    setTimeout(() => setOtakMsg(''), 2500);
  }, [otakInput, otakCategory, otakTags, otakEditId]);

  const deleteMemory = useCallback((id: string) => {
    setOtakMemories(prev => {
      const updated = prev.filter(m => m.id !== id);
      localStorage.setItem(OTAK_REKT_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const startEditMemory = useCallback((m: OtakRektMemory) => {
    setOtakInput(m.content);
    setOtakCategory(m.category);
    setOtakTags((m.tags || []).join(', '));
    setOtakEditId(m.id);
  }, []);

  const exportOtakMemory = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      memories: otakMemories,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otakRekt_memory_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOtakMsg('✅ Memory berhasil diekspor!');
    setTimeout(() => setOtakMsg(''), 2500);
  }, [otakMemories]);

  const importOtakMemory = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const imported: OtakRektMemory[] = json.memories || (Array.isArray(json) ? json : []);
        if (!imported.length) { setOtakMsg('❌ File tidak valid atau kosong'); return; }
        setOtakMemories(prev => {
          const map = new Map(prev.map(m => [m.id, m]));
          imported.forEach(m => map.set(m.id, m));
          const merged = Array.from(map.values());
          localStorage.setItem(OTAK_REKT_KEY, JSON.stringify(merged));
          return merged;
        });
        setOtakMsg(`✅ ${imported.length} memory berhasil diimpor!`);
        setTimeout(() => setOtakMsg(''), 3000);
      } catch { setOtakMsg('❌ File JSON tidak valid'); setTimeout(() => setOtakMsg(''), 3000); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const autoExtractMemory = useCallback(async (userMsg: string, assistantReply: string) => {
    if (!apiKey || !selectedModelId) return;
    try {
      const extractPrompt = `Kamu adalah sistem ekstraksi memori untuk AI bernama Rekt.
Analisa percakapan berikut dan ekstrak HANYA informasi penting yang layak diingat jangka panjang tentang pengguna, preferensi, tujuan, atau fakta kunci.
Abaikan obrolan biasa, pertanyaan umum, atau info airdrop sementara.

Percakapan:
User: ${userMsg.slice(0, 500)}
Rekt: ${assistantReply.slice(0, 800)}

Jika ada yang layak diingat, balas HANYA dengan JSON array (tanpa teks lain):
[{"category":"fakta|preferensi|tujuan|catatan","content":"isi ingatan singkat","tags":["tag1"]}]

Jika tidak ada yang layak diingat, balas hanya: []`;

      const resp = await fetch(`${BLUESMINDS_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: selectedModelId,
          messages: [{ role: 'user', content: extractPrompt }],
          max_tokens: 300,
          temperature: 0.3,
          stream: false,
        }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content || '[]';
      const clean = raw.replace(/```json|```/g, '').trim();
      const extracted: Array<{ category: OtakRektMemory['category']; content: string; tags?: string[] }> = JSON.parse(clean);
      if (!Array.isArray(extracted) || extracted.length === 0) return;

      setOtakMemories(prev => {
        const now = Date.now();
        const newMems: OtakRektMemory[] = extracted
          .filter(e => e.content && e.content.length > 5)
          .map(e => ({
            id: `auto_${now}_${Math.random().toString(36).slice(2, 7)}`,
            category: (['fakta','preferensi','tujuan','catatan','lainnya'].includes(e.category) ? e.category : 'lainnya') as OtakRektMemory['category'],
            content: e.content.slice(0, 300),
            createdAt: now,
            updatedAt: now,
            tags: e.tags || ['auto'],
          }));
        if (newMems.length === 0) return prev;
        const merged = [...prev, ...newMems].slice(-200);
        try { localStorage.setItem(OTAK_REKT_KEY, JSON.stringify(merged)); } catch {}
        setOtakMsg(`🧠 +${newMems.length} ingatan baru tersimpan otomatis`);
        setTimeout(() => setOtakMsg(''), 3000);
        return merged;
      });
    } catch {}
  }, [apiKey, selectedModelId]);

  const getPendingTasks = useCallback(() => {
    try {
      const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
      return tasks
        .filter(t => t.status === 'Ongoing' && !t.selesaiHariIni)
        .sort((a, b) => {
          if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          if (a.deadline) return -1;
          if (b.deadline) return 1;
          return 0;
        });
    } catch { return []; }
  }, []);

  const buildGarapPrompt = (task: Task): string =>
    `Aku mau garap airdrop **${task.nama}** sekarang.\n- Link: ${task.link}\n- Kategori: ${task.kategori || 'Testnet'}${task.deadline ? `\n- Deadline: ${task.deadline}` : ''}${task.notes ? `\n- Catatan: ${task.notes}` : ''}\n\nBerikan panduan step-by-step yang detail untuk mengerjakan airdrop ini. Setelah selesai, sertakan action untuk menandai tugas ini selesai hari ini.`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageWithTracking(input); }
  };

  const handleFileImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImportError(''); setImportSuccess(''); setImportLoading(true);
    const results: ImportedContext[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { errors.push(`${file.name}: > 5MB`); continue; }
      try {
        const content = await extractTextFromFile(file);
        results.push({ name: file.name, content, type: 'file' });
      } catch (e: any) { errors.push(`${file.name}: ${e.message}`); }
    }
    setImportLoading(false);
    if (results.length > 0) {
      setImportedContexts(prev => [...prev, ...results].slice(-5));
      setImportSuccess(`✅ ${results.length} file berhasil diimport!`);
      setTimeout(() => setImportSuccess(''), 3000);
    }
    if (errors.length > 0) setImportError(errors.join('\n'));
  };

  const handleUrlImport = async () => {
    const url = urlInput.trim();
    if (!url || !/^https?:\/\/.+/.test(url)) { setImportError('URL harus dimulai dengan http(s)://'); return; }
    setImportError(''); setImportSuccess(''); setImportLoading(true);
    try {
      const content = await fetchUrlContent(url);
      const name = new URL(url).hostname + new URL(url).pathname.slice(0, 30);
      setImportedContexts(prev => [...prev.slice(-4), { name, content, type: 'url' }]);
      setUrlInput('');
      setImportSuccess('✅ Konten URL berhasil diimport!');
      setTimeout(() => setImportSuccess(''), 3000);
    } catch (e: any) { setImportError(e.message); }
    finally { setImportLoading(false); }
  };

  const msgCount = messages.filter(m => m.role === 'user').length;

  return (
    <div className="app-container">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ margin: 0, border: 'none', paddingBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          Rekt — AI Assistant
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#0d0d0d', padding: '4px 10px', border: '1px solid #222', fontSize: '11px', color: '#555' }}>
            💬 {msgCount} msg · 🔢 {totalTokens.toLocaleString()} tokens
          </div>
          <button
            onClick={() => { setShowSettings(p => !p); setShowModelPicker(false); }}
            style={{ background: '#111', border: '1px solid #333', color: '#888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px' }}
          >⚙️ Settings</button>
          <button
            onClick={() => setShowOtakRekt(p => !p)}
            style={{
              background: showOtakRekt ? '#0d1a2a' : '#111',
              border: `1px solid ${showOtakRekt ? '#06b6d4' : '#333'}`,
              color: showOtakRekt ? '#06b6d4' : '#888',
              padding: '5px 10px', cursor: 'pointer', fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            🧠 otakRekt {otakMemories.length > 0 && <span style={{ background: '#06b6d4', color: '#000', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{otakMemories.length}</span>}
          </button>
        </div>
      </header>
      <Navbar />

      {/* Settings Panel */}
      {showSettings && (
        <div style={{ background: '#0d0d1a', border: '1px solid #2a2a5a', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚙️ <strong style={{ color: '#aaa' }}>Settings</strong>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#888', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              Temperature: <strong style={{ color: activeModel.color }}>{temperature}</strong>
              <input type="range" min="0" max="1" step="0.1" value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                style={{ accentColor: activeModel.color, width: '140px' }} />
              <span style={{ fontSize: '10px', color: '#555' }}>0 = lebih pasti · 1 = lebih kreatif</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Aksi Cepat</span>
              <button onClick={clearChat} style={{ fontSize: '12px', padding: '6px 14px', background: '#1a0d0d', border: '1px solid #f44336', color: '#f88', cursor: 'pointer' }}>
                🗑️ Hapus Semua Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {showOtakRekt && (
        <div style={{ background: '#050d14', border: '1px solid #06b6d4', borderLeft: '4px solid #06b6d4', padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🧠</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#06b6d4' }}>otakRekt — Permanent Memory</div>
                <div style={{ fontSize: '11px', color: '#555' }}>
                  {otakMemories.length} ingatan tersimpan ·{' '}
                  <span style={{ color: '#06b6d433' }}>
                    {otakMemories.filter(m => m.id.startsWith('auto_')).length} auto
                  </span>
                  {' '}· makin sering chat, makin pintar Rekt 🧠
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={exportOtakMemory} disabled={otakMemories.length === 0}
                style={{ fontSize: '11px', padding: '5px 12px', background: '#0a1e2a', border: '1px solid #06b6d4', color: '#06b6d4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', opacity: otakMemories.length === 0 ? 0.4 : 1 }}>
                ⬇️ Export JSON
              </button>
              <button onClick={() => otakImportRef.current?.click()}
                style={{ fontSize: '11px', padding: '5px 12px', background: '#0a1e0a', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ⬆️ Import JSON
              </button>
              <input ref={otakImportRef} type="file" accept=".json" onChange={importOtakMemory} style={{ display: 'none' }} />
              {otakMemories.length > 0 && (
                <button onClick={() => { if (window.confirm(`Hapus semua ${otakMemories.length} memory?`)) saveOtakMemories([]); }}
                  style={{ fontSize: '11px', padding: '5px 12px', background: '#1a0a0a', border: '1px solid #f44336', color: '#f88', cursor: 'pointer' }}>
                  🗑️ Hapus Semua
                </button>
              )}
            </div>
          </div>

          {otakMsg && (
            <div style={{ padding: '7px 12px', background: otakMsg.startsWith('✅') ? '#0a1e0a' : '#1a0a0a', border: `1px solid ${otakMsg.startsWith('✅') ? '#4caf50' : '#f44336'}`, color: otakMsg.startsWith('✅') ? '#4caf50' : '#f88', fontSize: '12px', marginBottom: '12px' }}>
              {otakMsg}
            </div>
          )}

          {/* Add / Edit Form */}
          <div style={{ background: '#0a1520', border: '1px solid #1a3040', padding: '12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: '#06b6d4', marginBottom: '8px' }}>{otakEditId ? '✏️ Edit Memory' : '➕ Tambah Memory Baru'}</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <select value={otakCategory} onChange={e => setOtakCategory(e.target.value as OtakRektMemory['category'])}
                style={{ fontSize: '12px', padding: '6px 10px', background: '#0d1e2e', border: '1px solid #1a3a4a', color: '#06b6d4', cursor: 'pointer', minWidth: '120px' }}>
                <option value="fakta">📌 Fakta</option>
                <option value="preferensi">❤️ Preferensi</option>
                <option value="tujuan">🎯 Tujuan</option>
                <option value="catatan">📝 Catatan</option>
                <option value="lainnya">💡 Lainnya</option>
              </select>
              <input value={otakTags} onChange={e => setOtakTags(e.target.value)}
                placeholder="tags (pisah koma, opsional)"
                style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: '#0d1e2e', border: '1px solid #1a3a4a', color: '#aaa', minWidth: '120px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea value={otakInput} onChange={e => setOtakInput(e.target.value)}
                placeholder="Tulis sesuatu yang ingin Rekt selalu ingat tentang kamu, tujuan, preferensi, dll..."
                rows={3}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addOrUpdateMemory(); } }}
                style={{ flex: 1, fontSize: '12px', padding: '8px 10px', background: '#0d1e2e', border: '1px solid #1a3a4a', color: '#ddd', resize: 'vertical', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={addOrUpdateMemory} disabled={!otakInput.trim()}
                  style={{ padding: '8px 16px', background: otakInput.trim() ? '#06b6d4' : '#0a1e2a', color: otakInput.trim() ? '#000' : '#333', border: 'none', cursor: otakInput.trim() ? 'pointer' : 'default', fontWeight: 'bold', fontSize: '12px' }}>
                  {otakEditId ? 'Update' : 'Simpan'}
                </button>
                {otakEditId && (
                  <button onClick={() => { setOtakEditId(null); setOtakInput(''); setOtakTags(''); }}
                    style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #333', color: '#666', cursor: 'pointer', fontSize: '11px' }}>
                    Batal
                  </button>
                )}
              </div>
            </div>
            <div style={{ fontSize: '10px', color: '#2a4a5a', marginTop: '5px' }}>Ctrl+Enter untuk simpan cepat</div>
          </div>

          {/* Filter & Search */}
          {otakMemories.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={otakSearch} onChange={e => setOtakSearch(e.target.value)}
                placeholder="🔍 Cari memory..."
                style={{ flex: 1, fontSize: '12px', padding: '5px 10px', background: '#0d0d0d', border: '1px solid #1a3a4a', color: '#aaa', minWidth: '120px' }} />
              {(['semua', 'fakta', 'preferensi', 'tujuan', 'catatan', 'lainnya'] as const).map(cat => (
                <button key={cat} onClick={() => setOtakFilter(cat)}
                  style={{
                    fontSize: '10px', padding: '4px 10px',
                    background: otakFilter === cat ? '#06b6d4' : '#0a1520',
                    color: otakFilter === cat ? '#000' : '#555',
                    border: `1px solid ${otakFilter === cat ? '#06b6d4' : '#1a3a4a'}`,
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}>
                  {cat === 'semua' ? `Semua (${otakMemories.length})` : cat}
                </button>
              ))}
            </div>
          )}

          {/* Memory List */}
          {otakMemories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#333', fontSize: '13px', border: '1px dashed #1a3a4a' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧠</div>
              <div style={{ color: '#4a7a9a' }}>Otak Rekt masih kosong.</div>
              <div style={{ fontSize: '11px', color: '#2a4a5a', marginTop: '8px', lineHeight: '1.6' }}>
                💬 Chat dengan Rekt (perlu API) — ingatan akan <strong style={{ color: '#06b6d4' }}>tersimpan otomatis</strong> dari percakapan.<br />
                Makin banyak chat, makin pintar Rekt — bahkan bisa diajak ngobrol tanpa API!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
              {otakMemories
                .filter(m => otakFilter === 'semua' || m.category === otakFilter)
                .filter(m => !otakSearch || m.content.toLowerCase().includes(otakSearch.toLowerCase()) || (m.tags || []).some(t => t.toLowerCase().includes(otakSearch.toLowerCase())))
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(m => {
                  const catColors: Record<OtakRektMemory['category'], string> = {
                    fakta: '#06b6d4', preferensi: '#f472b6', tujuan: '#fb923c', catatan: '#a3e635', lainnya: '#a78bfa'
                  };
                  const catEmoji: Record<OtakRektMemory['category'], string> = {
                    fakta: '📌', preferensi: '❤️', tujuan: '🎯', catatan: '📝', lainnya: '💡'
                  };
                  const c = catColors[m.category];
                  return (
                    <div key={m.id} style={{ background: '#0a1520', border: `1px solid ${c}22`, borderLeft: `3px solid ${c}`, padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', padding: '1px 7px', background: `${c}18`, border: `1px solid ${c}44`, color: c }}>{catEmoji[m.category]} {m.category}</span>
                          {m.id.startsWith('auto_') && (
                            <span style={{ fontSize: '9px', padding: '1px 6px', background: '#0a1e2a', border: '1px solid #06b6d444', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              🤖 auto
                            </span>
                          )}
                          {(m.tags || []).filter(t => t !== 'auto').map(tag => (
                            <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', background: '#0d1e2e', color: '#4a7a9a', border: '1px solid #1a3a4a' }}>#{tag}</span>
                          ))}
                          <span style={{ fontSize: '10px', color: '#2a4a5a', marginLeft: 'auto' }}>{new Date(m.updatedAt).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => startEditMemory(m)}
                          style={{ fontSize: '10px', padding: '3px 8px', background: '#0a1e2a', border: '1px solid #1a4a5a', color: '#06b6d4', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => deleteMemory(m.id)}
                          style={{ fontSize: '10px', padding: '3px 8px', background: '#1a0a0a', border: '1px solid #3a1a1a', color: '#f44336', cursor: 'pointer' }}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* API Key Setup */}
      {showApiKeySetup ? (
        <div style={{
          background: '#0d0a00', border: '1px solid #f3ba2f',
          borderLeft: '4px solid #f3ba2f', padding: '16px', marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '16px' }}>🔑</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f3ba2f' }}>BluesMind API Key Diperlukan</div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                Dapatkan API key di{' '}
                <a href="https://api.bluesminds.com/register?aff=1v7S" target="_blank" rel="noreferrer"
                  style={{ color: '#f3ba2f' }}>api.bluesminds.com/</a>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={apiKeyVisible ? 'text' : 'password'}
                placeholder="sk-MSbH..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveApiKey()}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 38px 9px 12px',
                  background: '#1a1400', color: '#fff', border: '1px solid #5a4a00',
                  fontSize: '13px', fontFamily: 'monospace',
                }}
              />
              <button
                onClick={() => setApiKeyVisible(p => !p)}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}
              >{apiKeyVisible ? '🙈' : '👁️'}</button>
            </div>
            <button onClick={saveApiKey}
              style={{ padding: '9px 18px', background: '#f3ba2f', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              Simpan
            </button>
            {apiKey && (
              <button onClick={() => setShowApiKeySetup(false)}
                style={{ padding: '9px 14px', background: 'transparent', color: '#888', border: '1px solid #333', cursor: 'pointer', fontSize: '12px' }}>
                Batal
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
          background: '#0a100a', border: '1px solid #1e3a1e', padding: '8px 12px',
        }}>
          <span style={{ fontSize: '12px' }}>🔑</span>
          <span style={{ fontSize: '12px', color: '#4caf50', fontFamily: 'monospace' }}>
            API Key: sk-****{apiKey.slice(-6)}
          </span>
          <span style={{ fontSize: '11px', color: '#2a5a2a', background: '#0d1e0d', border: '1px solid #1e3a1e', padding: '1px 7px' }}>AKTIF</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setShowApiKeySetup(true); setApiKeyInput(''); }}
            style={{ background: 'none', border: '1px solid #2a2a2a', color: '#555', cursor: 'pointer', fontSize: '11px', padding: '3px 10px' }}>
            Ganti Key
          </button>
          <button onClick={removeApiKey}
            style={{ background: 'none', border: '1px solid #3a1a1a', color: '#f44336', cursor: 'pointer', fontSize: '11px', padding: '3px 10px' }}>
            Hapus
          </button>
        </div>
      )}

      {/* Model Picker */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => { setShowModelPicker(p => !p); setShowSettings(false); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
            background: '#0d0d1a', border: `1px solid ${activeModel.color}44`,
            borderLeft: `4px solid ${activeModel.color}`, padding: '10px 14px',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <FaMicrochip style={{ color: activeModel.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: activeModel.color }}>
              {modelsLoading ? 'Memuat model...' : (activeModel.label || 'Pilih Model')}
            </div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              {modelsLoading
                ? 'Mengambil daftar dari API...'
                : availableModels.length > 0
                  ? `${availableModels.length} model tersedia`
                  : apiKey ? 'Klik untuk pilih model' : 'Input API key terlebih dahulu'}
            </div>
          </div>
          <span style={{
            fontSize: '10px', fontWeight: 'bold', padding: '2px 8px',
            border: `1px solid ${activeModel.color}`, color: activeModel.color,
          }}>{activeModel.badge}</span>
          {showModelPicker ? <FaChevronUp color="#555" size={12} /> : <FaChevronDown color="#555" size={12} />}
        </button>

        {showModelPicker && (
          <div style={{
            background: '#0a0a14', border: '1px solid #222', borderTop: 'none',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', padding: '12px',
          }}>
            {modelsLoading && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '13px', gridColumn: '1/-1' }}>
                <FaSpinner style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />
                Memuat daftar model dari BluesMind API...
              </div>
            )}
            {modelsError && (
              <div style={{ padding: '12px', color: '#f88', fontSize: '12px', background: 'rgba(244,67,54,0.08)', border: '1px solid #f44336', gridColumn: '1/-1' }}>
                ❌ {modelsError}
                <button onClick={() => fetchModels(apiKey)} style={{ marginLeft: '10px', fontSize: '11px', color: '#f97316', background: 'none', border: '1px solid #f97316', cursor: 'pointer', padding: '2px 8px' }}>Retry</button>
              </div>
            )}
            {!modelsLoading && !modelsError && availableModels.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '12px', gridColumn: '1/-1' }}>
                Tidak ada model tersedia. Periksa API key kamu.
              </div>
            )}
            {availableModels.map(m => (
              <button
                key={m.id}
                onClick={() => { setSelectedModelId(m.id); setShowModelPicker(false); }}
                style={{
                  background: selectedModelId === m.id ? `${m.color}18` : '#111',
                  border: `1px solid ${selectedModelId === m.id ? m.color : '#222'}`,
                  padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: m.color, wordBreak: 'break-all' }}>{m.label}</span>
                  <span style={{ fontSize: '9px', border: `1px solid ${m.color}`, color: m.color, padding: '1px 5px', fontWeight: 'bold', flexShrink: 0, marginLeft: '6px' }}>{m.badge}</span>
                </div>
                {m.owned && <span style={{ fontSize: '10px', color: '#3a3a3a' }}>{m.owned}</span>}
                {selectedModelId === m.id && <span style={{ fontSize: '10px', color: m.color }}>✓ Aktif</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FaLightbulb color="#f3ba2f" size={10} /> Pertanyaan cepat:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p.text} onClick={() => sendMessage(p.text)} disabled={isLoading} style={{
              fontSize: '12px', padding: '5px 10px', background: '#111',
              border: '1px solid #2a2a2a', color: '#aaa', cursor: 'pointer',
              fontWeight: 'normal', letterSpacing: '0', display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              {p.icon} {p.text}
            </button>
          ))}
        </div>
      </div>

      {/* Garap Airdrop Panel */}
      {(() => {
        const pendingTasks = getPendingTasks();
        const totalOngoing = (() => { try { return (JSON.parse(localStorage.getItem('airdropTasks') || '[]') as Task[]).filter(t => t.status === 'Ongoing').length; } catch { return 0; } })();
        return (
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => setShowGarapPanel(p => !p)}
              style={{
                width: '100%', fontSize: '13px', padding: '10px 16px',
                background: showGarapPanel ? '#0d1a0d' : '#0a1a0a',
                border: `1px solid ${showGarapPanel ? '#4caf50' : '#1e3a1e'}`,
                borderLeft: '4px solid #4caf50',
                color: '#4caf50', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '18px' }}>🚀</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>Mode Garap Airdrop</div>
                <div style={{ fontSize: '11px', color: '#2a5a2a' }}>
                  {pendingTasks.length} tugas belum dikerjakan hari ini · {totalOngoing} total ongoing
                </div>
              </div>
              {pendingTasks.length > 0 && (
                <span style={{ background: '#f44336', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>
                  {pendingTasks.length}
                </span>
              )}
              {showGarapPanel ? <FaChevronUp color="#4caf50" size={12} /> : <FaChevronDown color="#4caf50" size={12} />}
            </button>

            {showGarapPanel && (
              <div style={{ background: '#080f08', border: '1px solid #1e3a1e', borderTop: 'none', padding: '12px' }}>
                {pendingTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#4caf50', fontSize: '13px' }}>
                    ✅ Semua airdrop sudah dikerjakan hari ini!
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '11px', color: '#4a6a4a', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Klik "Garap" untuk dapat panduan step-by-step dari AI:</span>
                      <button
                        onClick={() => sendMessage(`Garapin semua airdrop yang belum selesai hari ini satu per satu. Mulai dari yang paling prioritas.`)}
                        disabled={isLoading}
                        style={{ fontSize: '11px', padding: '4px 10px', background: '#0d2a0d', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer' }}
                      >
                        ⚡ Garap Semua
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                      {pendingTasks.map((task, idx) => (
                        <div key={task.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: '#0d1a0d', border: '1px solid #1a2a1a',
                          padding: '10px 12px',
                        }}>
                          <span style={{ color: '#555', fontSize: '11px', minWidth: '20px', fontFamily: 'monospace' }}>{idx + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🔴 {task.nama}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10px', color: '#666', background: '#1a1a1a', padding: '1px 6px', border: '1px solid #333' }}>
                                {task.kategori || 'Testnet'}
                              </span>
                              {task.deadline && (
                                <span style={{ fontSize: '10px', color: '#ffaa00' }}>
                                  ⏰ {task.deadline}
                                </span>
                              )}
                              {task.estimasiReward ? (
                                <span style={{ fontSize: '10px', color: '#4caf50' }}>
                                  💰 ~${task.estimasiReward}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            {task.link && task.link !== '#' && (
                              <a href={task.link} target="_blank" rel="noreferrer"
                                style={{ fontSize: '11px', padding: '5px 8px', background: '#111', border: '1px solid #333', color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="Buka link">
                                🔗
                              </a>
                            )}
                            <button
                              onClick={() => { setShowGarapPanel(false); sendMessage(buildGarapPrompt(task)); }}
                              disabled={isLoading}
                              style={{
                                fontSize: '11px', padding: '5px 12px',
                                background: '#0d2a0d', border: '1px solid #4caf50',
                                color: '#7fff7f', cursor: 'pointer', fontWeight: 'bold',
                                opacity: isLoading ? 0.5 : 1,
                              }}
                            >
                              ▶ Garap
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ClawHub Skill Store */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setShowSkillStore(p => !p)}
          style={{
            width: '100%', fontSize: '13px', padding: '10px 16px',
            background: showSkillStore ? '#0a0d1a' : '#090c18',
            border: `1px solid ${showSkillStore ? '#646cff' : '#1a1e3a'}`,
            borderLeft: '4px solid #646cff',
            color: '#646cff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '18px' }}>🧩</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold' }}>ClawHub Skill Store</div>
            <div style={{ fontSize: '11px', color: '#2a2a5a' }}>
              Browse & install skills dari clawhub.ai · {installedSkills.length} skill terinstall
            </div>
          </div>
          {installedSkills.length > 0 && (
            <span style={{ background: '#646cff', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>
              {installedSkills.length}
            </span>
          )}
          {showSkillStore ? <FaChevronUp color="#646cff" size={12} /> : <FaChevronDown color="#646cff" size={12} />}
        </button>

        {showSkillStore && (
          <div style={{ background: '#07091a', border: '1px solid #1a1e3a', borderTop: 'none', padding: '14px' }}>
            {/* Installed Skills */}
            {installedSkills.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: '#646cff', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📦 Skill Terinstall ({installedSkills.length})</span>
                  <button
                    onClick={() => sendMessage(`Gunakan skill yang sudah terinstall untuk membantu saya. Skill tersedia: ${installedSkills.map(s => s.name).join(', ')}`)}
                    disabled={isLoading}
                    style={{ fontSize: '10px', padding: '2px 8px', background: 'transparent', border: '1px solid #646cff', color: '#646cff', cursor: 'pointer' }}
                  >
                    ⚡ Gunakan Semua Skill
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {installedSkills.map(s => (
                    <div key={s.slug} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#0d1030', border: '1px solid #2a2a5a',
                      padding: '5px 10px', fontSize: '12px',
                    }}>
                      <span style={{ color: '#a0a0ff' }}>{s.name}</span>
                      <span style={{ color: '#444', fontSize: '10px' }}>by {s.author}</span>
                      <button
                        onClick={() => sendMessage(`Jelaskan cara menggunakan skill "${s.name}" dan apa yang bisa dilakukan dengan skill ini.`)}
                        disabled={isLoading}
                        title="Tanya AI tentang skill ini"
                        style={{ background: 'none', border: 'none', color: '#646cff', cursor: 'pointer', fontSize: '11px', padding: '0 4px' }}
                      >?</button>
                      <button
                        onClick={() => uninstallSkill(s.slug)}
                        title="Uninstall"
                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '11px', padding: '0' }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {skillInstallMsg && (
              <div style={{
                padding: '8px 12px', marginBottom: '10px', fontSize: '12px',
                background: skillInstallMsg.startsWith('✅') ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
                border: `1px solid ${skillInstallMsg.startsWith('✅') ? '#4caf50' : '#f44336'}`,
                color: skillInstallMsg.startsWith('✅') ? '#4caf50' : '#f88',
              }}>
                {skillInstallMsg}
              </div>
            )}

            {/* Search & Sort Bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: '180px' }}>
                <input
                  placeholder="🔍 Cari skill (web search, twitter, notion...)"
                  value={storeSearch}
                  onChange={e => setStoreSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchStoreSkills(storeSort, storeSearch)}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                    background: '#0d0d20', color: '#ddd', border: '1px solid #2a2a5a',
                    fontSize: '12px',
                  }}
                />
              </div>
              <select
                value={storeSort}
                onChange={e => { const v = e.target.value as any; setStoreSort(v); fetchStoreSkills(v, storeSearch); }}
                style={{ padding: '8px 10px', background: '#0d0d20', color: '#888', border: '1px solid #2a2a5a', fontSize: '12px' }}
              >
                <option value="downloads">⬇️ Downloads</option>
                <option value="installs">📦 Installs</option>
                <option value="stars">⭐ Stars</option>
                <option value="newest">🆕 Newest</option>
              </select>
              <button
                onClick={() => fetchStoreSkills(storeSort, storeSearch)}
                disabled={storeLoading}
                style={{ padding: '8px 14px', background: '#0d0d30', border: '1px solid #646cff', color: '#646cff', cursor: 'pointer', fontSize: '12px' }}
              >
                {storeLoading ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> : '🔄 Muat'}
              </button>
            </div>

            {/* Skills Grid */}
            {storeError ? (
              <div style={{ padding: '12px', color: '#f88', fontSize: '12px', background: 'rgba(244,67,54,0.08)', border: '1px solid #f44336' }}>
                ❌ {storeError}
                <button onClick={() => fetchStoreSkills(storeSort, storeSearch)} style={{ marginLeft: '10px', fontSize: '11px', color: '#f97316', background: 'none', border: '1px solid #f97316', cursor: 'pointer', padding: '2px 8px' }}>Retry</button>
              </div>
            ) : storeLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#555' }}>
                <FaSpinner style={{ animation: 'spin 1s linear infinite', marginBottom: '8px', fontSize: '20px' }} />
                <div style={{ fontSize: '12px' }}>Memuat skill dari clawhub.ai...</div>
              </div>
            ) : storeSkills.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#444', fontSize: '12px' }}>
                Belum ada skill. Klik "Muat" untuk memuat dari ClawHub.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
                {storeSkills.filter(s => !s.suspicious).map(skill => {
                  const isInstalled = installedSkills.some(i => i.slug === skill.slug);
                  const isInstalling = installingSlug === skill.slug;
                  return (
                    <div key={skill.slug} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      background: isInstalled ? '#0d1030' : '#0d0d1a',
                      border: `1px solid ${isInstalled ? '#2a2a5a' : '#1a1a2e'}`,
                      padding: '10px 12px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '13px', color: isInstalled ? '#a0a0ff' : '#ddd' }}>
                            {skill.highlighted ? '⭐ ' : ''}{skill.name || skill.slug}
                          </span>
                          {skill.author && <span style={{ fontSize: '10px', color: '#444' }}>by {skill.author}</span>}
                          {isInstalled && <span style={{ fontSize: '10px', color: '#646cff', border: '1px solid #646cff', padding: '0 5px' }}>INSTALLED</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '3px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {skill.description}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
                          {(skill.downloads ?? 0) > 0 && <span style={{ fontSize: '10px', color: '#555' }}>⬇️ {skill.downloads?.toLocaleString()}</span>}
                          {(skill.installs ?? 0) > 0 && <span style={{ fontSize: '10px', color: '#555' }}>📦 {skill.installs?.toLocaleString()}</span>}
                          {(skill.stars ?? 0) > 0 && <span style={{ fontSize: '10px', color: '#555' }}>⭐ {skill.stars}</span>}
                          {skill.license && <span style={{ fontSize: '10px', color: '#555' }}>{skill.license}</span>}
                          <a href={`https://clawhub.ai/${skill.author}/${skill.slug}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: '10px', color: '#3a3a7a', textDecoration: 'none' }}>🔗 clawhub</a>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {isInstalled ? (
                          <>
                            <button
                              onClick={() => setPreviewSkill(installedSkills.find(s => s.slug === skill.slug) || null)}
                              style={{ fontSize: '11px', padding: '5px 10px', background: '#0d1030', border: '1px solid #646cff', color: '#a0a0ff', cursor: 'pointer' }}
                            >📄 Preview</button>
                            <button
                              onClick={() => uninstallSkill(skill.slug)}
                              style={{ fontSize: '11px', padding: '5px 10px', background: '#1a0d1a', border: '1px solid #444', color: '#888', cursor: 'pointer' }}
                            >✕ Hapus</button>
                          </>
                        ) : (
                          <button
                            onClick={() => installSkill(skill)}
                            disabled={!!installingSlug}
                            style={{
                              fontSize: '11px', padding: '5px 12px',
                              background: isInstalling ? '#1a1a3a' : '#0d0d30',
                              border: `1px solid ${isInstalling ? '#888' : '#646cff'}`,
                              color: isInstalling ? '#888' : '#a0a0ff',
                              cursor: installingSlug ? 'default' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: '5px',
                            }}
                          >
                            {isInstalling ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} size={10} /> Installing...</> : '⬇ Install'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SKILL.md Preview Modal */}
      {previewSkill && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }} onClick={() => setPreviewSkill(null)}>
          <div style={{
            background: '#0d0d1a', border: '1px solid #646cff', width: '100%', maxWidth: '720px',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderBottom: '1px solid #1a1a3a', background: '#07091a',
            }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#a0a0ff', fontSize: '14px' }}>📄 {previewSkill.name}</div>
                <div style={{ fontSize: '11px', color: '#555' }}>by {previewSkill.author} · SKILL.md</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { sendMessage(`Gunakan skill "${previewSkill.name}" untuk membantu saya. Jelaskan apa yang bisa dilakukan skill ini.`); setPreviewSkill(null); }}
                  style={{ fontSize: '11px', padding: '5px 12px', background: '#0d0d30', border: '1px solid #646cff', color: '#a0a0ff', cursor: 'pointer' }}
                >⚡ Gunakan Skill Ini</button>
                <button onClick={() => setPreviewSkill(null)}
                  style={{ background: 'none', border: '1px solid #333', color: '#888', cursor: 'pointer', padding: '5px 10px', fontSize: '12px' }}>✕ Tutup</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '16px', flex: 1 }}>
              <pre style={{
                fontFamily: 'monospace', fontSize: '12px', color: '#ccc', lineHeight: '1.6',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              }}>{previewSkill.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Import Panel Toggle */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setShowImportPanel(p => !p)}
          style={{
            fontSize: '12px', padding: '7px 14px',
            background: showImportPanel ? '#1a1a3a' : '#111',
            border: `1px solid ${showImportPanel ? '#646cff' : '#333'}`,
            color: showImportPanel ? '#a0a0ff' : '#666',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <FaFileImport size={12} /> Import Konteks
          {importedContexts.length > 0 && (
            <span style={{ background: '#646cff', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>
              {importedContexts.length}
            </span>
          )}
        </button>

        {showImportPanel && (
          <div style={{ marginTop: '10px', background: '#0d0d1a', border: '1px solid #2a2a5a', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FaFileAlt size={11} /> Import dari File
                </div>
                <div
                  onDrop={e => { e.preventDefault(); handleFileImport(e.dataTransfer.files); }}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #333', padding: '20px', textAlign: 'center',
                    cursor: 'pointer', fontSize: '12px', color: '#555', background: '#0a0a1a',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#646cff')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}
                >
                  {importLoading
                    ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Membaca...</>
                    : <>📂 Drag & drop atau klik<br /><span style={{ fontSize: '11px', color: '#444' }}>txt, md, json, csv, pdf, js/ts/tsx</span></>}
                </div>
                <input ref={fileInputRef} type="file" multiple
                  accept=".txt,.md,.json,.csv,.pdf,.js,.ts,.tsx,.jsx,.html,.css,.xml"
                  style={{ display: 'none' }} onChange={e => handleFileImport(e.target.files)} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FaLink size={11} /> Import dari URL
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input type="url" placeholder="https://example.com" value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a1a', color: '#fff', border: '1px solid #333', padding: '8px 10px', fontSize: '12px' }} />
                  <button onClick={handleUrlImport} disabled={importLoading || !urlInput.trim()}
                    style={{ background: '#1a1a3a', border: '1px solid #646cff', color: '#a0a0ff', padding: '8px', cursor: 'pointer', fontSize: '12px', opacity: importLoading || !urlInput.trim() ? 0.5 : 1 }}>
                    {importLoading ? '⏳ Memuat...' : '🔗 Fetch URL'}
                  </button>
                </div>
              </div>
            </div>
            {importError && <div style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid #f44336', padding: '8px 12px', fontSize: '12px', color: '#f88', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>❌ {importError}</div>}
            {importSuccess && <div style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid #4caf50', padding: '8px 12px', fontSize: '12px', color: '#8f8', marginBottom: '8px' }}>{importSuccess}</div>}
            {importedContexts.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>Aktif ({importedContexts.length}/5):</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {importedContexts.map((ctx, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111', border: '1px solid #1e1e1e', padding: '6px 10px' }}>
                      <span>{ctx.type === 'url' ? '🔗' : '📄'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.name}</div>
                        <div style={{ fontSize: '10px', color: '#444' }}>{ctx.content.length.toLocaleString()} karakter</div>
                      </div>
                      <button onClick={() => setImportedContexts(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '13px' }}>
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setImportedContexts([])}
                  style={{ marginTop: '8px', fontSize: '11px', color: '#555', background: 'none', border: '1px solid #1e1e1e', padding: '4px 10px', cursor: 'pointer' }}>
                  Hapus Semua
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Window */}
      <div style={{
        background: '#080808', border: '1px solid #1e1e1e', height: '500px',
        overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx}>
            <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px' }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: '30px', height: '30px',
                  background: msg.model ? (availableModels.find((m: ModelInfo) => m.id === msg.model)?.color || activeModel.color) : '#555',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '4px',
                }}>
                  <FaRobot size={14} color="white" />
                </div>
              )}
              <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {/* Model badge */}
                {msg.role === 'assistant' && msg.model && msg.model !== 'system' && (
                  <div style={{ fontSize: '10px', color: availableModels.find((m: ModelInfo) => m.id === msg.model)?.color || '#555', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FaMicrochip size={9} /> {availableModels.find((m: ModelInfo) => m.id === msg.model)?.label || msg.model}
                    {msg.tokensUsed ? <span style={{ color: '#333' }}>· {msg.tokensUsed} tokens</span> : null}
                  </div>
                )}
                <div style={{
                  background: msg.role === 'user' ? '#0d1424' : '#111',
                  border: `1px solid ${msg.role === 'user' ? '#1a2a5a' : '#222'}`,
                  borderLeft: msg.role === 'assistant' ? `3px solid ${msg.model && msg.model !== 'system' ? (availableModels.find((m: ModelInfo) => m.id === msg.model)?.color || '#333') : '#333'}` : undefined,
                  padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#ddd',
                  wordBreak: 'break-word',
                }}>
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                  {msg.timestamp && <span style={{ fontSize: '10px', color: '#333' }}>{formatTime(msg.timestamp)}</span>}
                  {msg.role === 'assistant' && msg.content && <CopyButton text={msg.content} />}
                </div>
              </div>
              {msg.role === 'user' && (
                <div style={{
                  width: '30px', height: '30px', background: '#1a2a5a',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '4px', fontSize: '14px',
                }}>👤</div>
              )}
            </div>

            {/* Action Buttons */}
            {msg.actions && msg.actions.length > 0 && (
              <div style={{
                marginTop: '8px', marginLeft: '38px',
                background: '#0a160a', border: '1px solid #1e3a1e',
                padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ fontSize: '11px', color: '#4caf50', marginBottom: '4px' }}>
                  ⚡ Rekt ingin melakukan {msg.actions.length} aksi:
                </div>
                {msg.actions.map((action, aIdx) => {
                  const key = `${msgIdx}-${aIdx}`;
                  const feedback = actionFeedback[key];
                  const actionColor = action.type === 'DELETE' ? '#f44336' : action.type === 'ADD' ? '#4caf50' : '#646cff';
                  return (
                    <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', fontFamily: 'monospace',
                        background: `${actionColor}15`, border: `1px solid ${actionColor}`, color: actionColor,
                      }}>{action.type}</span>
                      <span style={{ fontSize: '12px', color: '#aaa', flex: 1 }}>{action.label}</span>
                      {feedback ? (
                        <span style={{ fontSize: '11px', color: feedback.startsWith('✅') ? '#4caf50' : '#f44336' }}>{feedback}</span>
                      ) : (
                        <button onClick={() => applyAction(msgIdx, aIdx, action)} disabled={action.applied}
                          style={{
                            fontSize: '11px', padding: '4px 12px',
                            background: action.applied ? '#1a2a1a' : '#0d2a0d',
                            border: `1px solid ${action.applied ? '#2a4a2a' : '#4caf50'}`,
                            color: action.applied ? '#4caf50' : '#7fff7f',
                            cursor: action.applied ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          {action.applied ? <><FaCheckCircle size={10} /> Diterapkan</> : '▶ Terapkan'}
                        </button>
                      )}
                    </div>
                  );
                })}
                {msg.actions.some(a => !a.applied) && (
                  <button onClick={() => applyAllActions(msgIdx, msg.actions!)}
                    style={{
                      marginTop: '4px', fontSize: '12px', padding: '6px 14px',
                      background: '#0d2a0d', border: '1px solid #4caf50', color: '#4caf50',
                      cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold',
                    }}
                  >
                    <FaCheckCircle size={12} /> Terapkan Semua ({msg.actions.filter(a => !a.applied).length})
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Streaming Text */}
        {(isLoading || streamingText) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', background: activeModel.color, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px',
            }}>
              <FaRobot size={14} color="white" />
            </div>
            <div style={{ maxWidth: '80%' }}>
              <div style={{ fontSize: '10px', color: activeModel.color, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FaMicrochip size={9} /> {activeModel.label}
              </div>
              <div style={{
                background: '#111', border: `1px solid #222`, borderLeft: `3px solid ${activeModel.color}`,
                padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#ddd',
              }}>
                {streamingText ? renderMarkdown(streamingText) : (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: '7px', height: '7px', background: activeModel.color, borderRadius: '50%',
                        display: 'inline-block', animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                )}
                {streamingText && <span style={{ display: 'inline-block', width: '2px', height: '14px', background: activeModel.color, marginLeft: '2px', animation: 'blink 0.7s step-end infinite', verticalAlign: 'middle' }} />}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'flex-end' }}>
        <textarea
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={importedContexts.length > 0 ? `Tanya tentang ${importedContexts[0].name}...` : `Chat dengan ${activeModel.label}... (Enter kirim, Shift+Enter baris baru)`}
          disabled={isLoading} rows={2}
          style={{
            flex: 1, resize: 'vertical', minHeight: '52px', fontFamily: "'Courier New', monospace",
            fontSize: '13px', padding: '10px 12px', background: '#0d0d0d', color: '#fff',
            border: `1px solid ${input.trim() ? activeModel.color + '44' : '#222'}`,
            boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {isLoading ? (
            <button onClick={stopGeneration}
              style={{ background: '#2a0a0a', color: '#f44336', border: '1px solid #f44336', padding: '10px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              ⛔ Stop
            </button>
          ) : (
            <button onClick={() => sendMessageWithTracking(input)} disabled={!input.trim()}
              style={{
                background: activeModel.color, color: 'white', border: 'none', padding: '10px 14px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold',
                opacity: !input.trim() ? 0.5 : 1, fontSize: '13px',
              }}
            >
              <FaPaperPlane size={13} /> Kirim
            </button>
          )}
          <button onClick={clearChat} style={{ background: 'transparent', color: '#333', border: '1px solid #1a1a1a', padding: '7px 14px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FaTrash size={10} /> Reset
          </button>
        </div>
      </div>

      {/* Footer Info Bar */}
      <div style={{
        marginTop: '8px', padding: '7px 12px', background: '#0a0a0a', border: '1px solid #141414',
        fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
      }}>
        <span style={{ color: '#333', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FaNetworkWired size={10} style={{ color: '#222' }} /> Powered by <span style={{ color: activeModel.color }}>iaccommunity</span>
          {importedContexts.length > 0 && <span style={{ color: '#646cff' }}>· 📎 {importedContexts.length} konteks aktif</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              const next = !autoMode;
              setAutoMode(next);
              try { localStorage.setItem('rektAutoMode', String(next)); } catch {}
            }}
            title={autoMode ? 'Rekt aktif ngobrol sendiri — klik untuk matikan' : 'Mode diam — klik untuk aktifkan auto-chat'}
            style={{
              background: autoMode ? '#0d1f0d' : '#111',
              border: `1px solid ${autoMode ? '#4caf50' : '#2a2a2a'}`,
              color: autoMode ? '#4caf50' : '#444',
              padding: '3px 9px', fontSize: '10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '2px',
              transition: 'all 0.2s',
            }}
          >
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: autoMode ? '#4caf50' : '#444',
              boxShadow: autoMode ? '0 0 6px #4caf50' : 'none',
              display: 'inline-block',
              animation: autoMode ? 'pulse 2s ease-in-out infinite' : 'none',
            }} />
            {autoMode ? 'Rekt Online' : 'Rekt Diam'}
          </button>
          <span style={{ color: '#2a2a2a' }}>max {MAX_SAVED_MESSAGES} msg</span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:0.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(-3px)} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 4px #4caf50} 50%{box-shadow:0 0 10px #4caf5088} }
        strong { font-weight: bold; }
        em { font-style: italic; }
      `}</style>

      <footer className="app-footer" style={{ marginTop: '30px', textAlign: 'center', color: '#333', fontSize: '0.8em' }}>
        Powered by IAC Community
      </footer>
    </div>
  );
};
