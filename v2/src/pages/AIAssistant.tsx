import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { type Task, type Transaction, type PortfolioToken } from '../types';
import {
  FaRobot, FaPaperPlane, FaTrash, FaLightbulb, FaCheckCircle,
  FaFileImport, FaTimes, FaFileAlt,
  FaRegCopy, FaCheck, FaBrain,
  FaChevronDown, FaChevronUp,
} from 'react-icons/fa';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  actions?: TaskAction[];
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

interface OtakRektMemory {
  id: string;
  category: 'fakta' | 'preferensi' | 'tujuan' | 'catatan' | 'lainnya';
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  hitCount?: number;
}

const STORAGE_KEY      = 'rektChatHistoryV2';
const OTAK_REKT_KEY    = 'rektOtakMemory';
const MAX_SAVED_MESSAGES = 120;
const REKT_COLOR       = '#01a2ff';

const QUICK_PROMPTS = [
  { icon: '🚀', text: 'Garapin airdrop yang belum selesai hari ini' },
  { icon: '📋', text: 'Tampilkan semua airdrop ongoing beserta linknya' },
  { icon: '📊', text: 'Ringkas progress airdrop hari ini' },
  { icon: '⏰', text: 'Airdrop mana yang mendekati deadline?' },
  { icon: '💰', text: 'Analisis keuangan & portfolio saya' },
];

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `Halo! Saya **Rekt** 🤖 — AI assistant Erdrop Manager kamu, sepenuhnya lokal & offline.

Kemampuan saya:
✅ Kelola & pantau airdrop kamu
✅ Analisis keuangan & portfolio
✅ Import file sebagai konteks tambahan
✅ **CV Args Parser v3** — tuple bersarang, Etherscan decoded, raw calldata hex
✅ **Otomatis belajar** dari setiap obrolan kita — makin sering chat, makin pintar!

Saya tidak butuh API key atau koneksi internet. Semua berjalan di browser kamu sendiri 🔒

Tanya apa saja! 💬`,
  timestamp: Date.now(),
};

const loadMessages = (): Message[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [INITIAL_MESSAGE];
    const parsed: Message[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INITIAL_MESSAGE];
  } catch { return [INITIAL_MESSAGE]; }
};

const loadMemories = (): OtakRektMemory[] => {
  try { return JSON.parse(localStorage.getItem(OTAK_REKT_KEY) || '[]'); } catch { return []; }
};

const saveMemories = (mems: OtakRektMemory[]) => {
  try { localStorage.setItem(OTAK_REKT_KEY, JSON.stringify(mems.slice(-300))); } catch {}
};

const formatTime = (ts?: number): string => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const CodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ margin: '6px 0', border: '1px solid #2a2a2a', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1a', padding: '4px 10px', borderBottom: '1px solid #2a2a2a' }}>
        <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>{lang || 'code'}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4caf50' : '#555', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px' }}>
          {copied ? <><FaCheck size={10} /> Copied!</> : <><FaRegCopy size={10} /> Copy</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '10px 14px', overflowX: 'auto', background: '#0d0d0d', fontFamily: "'Courier New', monospace", fontSize: '12px', lineHeight: '1.6', color: '#e0e0e0', whiteSpace: 'pre' }}>
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
        if (line.startsWith('### ')) elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px', marginTop: '6px' }} dangerouslySetInnerHTML={{ __html: processed.replace('### ', '') }} />);
        else if (line.startsWith('## ')) elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#fff', fontSize: '15px', marginTop: '8px' }} dangerouslySetInnerHTML={{ __html: processed.replace('## ', '') }} />);
        else if (line.startsWith('# ')) elements.push(<div key={`${partIdx}-${i}`} style={{ fontWeight: 'bold', color: '#fff', fontSize: '16px', marginTop: '8px' }} dangerouslySetInnerHTML={{ __html: processed.replace('# ', '') }} />);
        else if (line.startsWith('- ') || line.startsWith('• ')) elements.push(
          <div key={`${partIdx}-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: '#aaa', flexShrink: 0 }}>•</span>
            <span dangerouslySetInnerHTML={{ __html: processed.replace(/^[-•] /, '') }} />
          </div>
        );
        else if (/^\d+\. /.test(line)) elements.push(
          <div key={`${partIdx}-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: '#aaa', flexShrink: 0, minWidth: '20px' }}>{line.match(/^(\d+)\./)?.[1]}.</span>
            <span dangerouslySetInnerHTML={{ __html: processed.replace(/^\d+\. /, '') }} />
          </div>
        );
        else if (line.trim() === '') elements.push(<div key={`${partIdx}-${i}`} style={{ height: '6px' }} />);
        else elements.push(<div key={`${partIdx}-${i}`} dangerouslySetInnerHTML={{ __html: processed }} />);
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
      const updated = tasks.map(t => { if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, status: action.payload.status }; } return t; });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      return { success: true, message: `✅ Status "${action.payload.nama}" → ${action.payload.status}` };
    }
    if (action.type === 'TOGGLE_DONE') {
      const keyword = (action.payload.nama || '').toLowerCase();
      let found = false;
      const updated = tasks.map(t => { if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, selesaiHariIni: action.payload.selesaiHariIni ?? true }; } return t; });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      return { success: true, message: `✅ "${action.payload.nama}" ditandai ${(action.payload.selesaiHariIni ?? true) ? 'selesai' : 'belum selesai'} hari ini` };
    }
    if (action.type === 'UPDATE') {
      const keyword = (action.payload.nama || '').toLowerCase();
      let found = false;
      const updated = tasks.map(t => { if (t.nama.toLowerCase().includes(keyword)) { found = true; return { ...t, ...action.payload }; } return t; });
      if (!found) return { success: false, message: `❌ Tugas "${action.payload.nama}" tidak ditemukan` };
      localStorage.setItem('airdropTasks', JSON.stringify(updated));
      return { success: true, message: `✅ Tugas "${action.payload.nama}" berhasil diperbarui!` };
    }
    return { success: false, message: '❌ Tipe aksi tidak dikenal' };
  } catch (e) { return { success: false, message: `❌ Error: ${e}` }; }
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
        if (item.type && item.payload !== undefined)
          actions.push({ type: item.type, payload: item.payload, label: item.label || item.type });
      });
      cleanText = cleanText.replace(match[0], '').trim();
    } catch {}
  }
  return { cleanText, actions };
};

// ─────────────────────────────────────────────────────────────
//  MINT / ABI CALL PARSER — v3  (tuple-aware, by 0xmsr + Rekt)
// ─────────────────────────────────────────────────────────────

interface ParsedArg {
  name: string;
  value: string;
  rawValue?: string;
  type: 'address' | 'uint' | 'bytes' | 'bool' | 'string' | 'tuple' | 'unknown';
  humanReadable?: string;
  tupleFields?: ParsedArg[];
}

interface MintCallResult {
  fnName: string;
  fnSignature?: string;
  args: ParsedArg[];
  rawCalldata?: string;
  contractAddress?: string;
  format: 'named' | 'positional' | 'calldata' | 'etherscan' | 'etherscan_table';
}

const weiToHuman = (wei: string): string | undefined => {
  try {
    const n = BigInt(wei);
    if (n === 0n) return '0 ETH';
    if (n >= 1_000_000_000_000_000n) {
      const eth = Number(n) / 1e18;
      return `≈ ${eth.toLocaleString('en-US', { maximumFractionDigits: 6 })} ETH`;
    }
    if (n >= 1_000_000_000n) {
      const gwei = Number(n) / 1e9;
      return `≈ ${gwei.toLocaleString('en-US', { maximumFractionDigits: 4 })} Gwei`;
    }
    if (n > 999_999n) return n.toLocaleString('en-US');
    return undefined;
  } catch { return undefined; }
};

const guessType = (val: string): ParsedArg['type'] => {
  if (/^0x[0-9a-fA-F]{40}$/.test(val.trim())) return 'address';
  if (/^\d+$/.test(val.trim())) return 'uint';
  if (/^0x[0-9a-fA-F]*$/.test(val.trim())) return 'bytes';
  if (val.trim() === 'true' || val.trim() === 'false') return 'bool';
  if (val.trim().startsWith('[') || val.trim().startsWith('(')) return 'tuple';
  return 'unknown';
};

const makeArgHuman = (name: string, val: string, type: ParsedArg['type']): string | undefined => {
  if (type !== 'uint') return undefined;
  return weiToHuman(val);
};

const parseEtherscanTableFmt = (text: string): MintCallResult | null => {
  const fnLine = text.match(/Function:\s*(.+)/i);
  if (!fnLine) return null;

  const fnFull = fnLine[1].trim();
  const fnName = fnFull.match(/^(\w+)/)?.[1] || 'call';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const topLevelArgs: Map<number, {
    name: string;
    solType: string;
    fields: { fieldName: string; solType: string; value: string }[];
    directValue?: string;
  }> = new Map();
  const numRowRe = /^(\d+)\s+(\w+)\s+(tuple|address|uint\d*|bytes\d*|bool|string)\s*(.*)?$/i;
  const subRowRe = /^(\w+)\.(\w+)\s+(address|uint\d*|bytes\d*|bool|string)\s+(0x[0-9a-fA-F]+|\d+|true|false|0x)$/i;
  const simpleRowRe = /^(\d+)\s+(\w+)\s+(address|uint\d*|bytes\d*|bool|string)\s+(0x[0-9a-fA-F]+|\d+|true|false)$/i;

  let currentTopIdx: number | null = null;

  for (const line of lines) {
    if (/^(Function:|Name\s+Type\s+Data|#)/i.test(line)) continue;
    const simpleM = line.match(simpleRowRe);
    if (simpleM) {
      const idx = parseInt(simpleM[1]);
      const name = simpleM[2];
      const solType = simpleM[3];
      const value = simpleM[4];
      topLevelArgs.set(idx, { name, solType, fields: [], directValue: value });
      currentTopIdx = idx;
      continue;
    }

    const numM = line.match(numRowRe);
    if (numM) {
      const idx = parseInt(numM[1]);
      const name = numM[2];
      const solType = numM[3];
      const rest = (numM[4] || '').trim();
      const entry: typeof topLevelArgs extends Map<any, infer V> ? V : never = {
        name, solType, fields: [],
        directValue: rest && /^(0x[0-9a-fA-F]+|\d+|true|false)$/.test(rest) ? rest : undefined
      };
      topLevelArgs.set(idx, entry);
      currentTopIdx = idx;
      continue;
    }

    const subM = line.match(subRowRe);
    if (subM) {
      const parentName = subM[1];
      const fieldName = subM[2];
      const solType = subM[3];
      const value = subM[4];
      for (const [, entry] of topLevelArgs) {
        if (entry.name === parentName) {
          entry.fields.push({ fieldName, solType, value });
          break;
        }
      }
      continue;
    }

    if (currentTopIdx !== null) {
      const plainSubRe = /^(\w+)\s+(address|uint\d*|bytes\d*|bool|string)\s+(0x[0-9a-fA-F]+|\d+|true|false|0x)$/i;
      const plainM = line.match(plainSubRe);
      if (plainM) {
        const entry = topLevelArgs.get(currentTopIdx);
        if (entry && entry.solType.toLowerCase() === 'tuple') {
          entry.fields.push({ fieldName: plainM[1], solType: plainM[2], value: plainM[3] });
        }
      }
    }
  }

  if (topLevelArgs.size === 0) return null;
  const args: ParsedArg[] = [];
  const sortedKeys = [...topLevelArgs.keys()].sort((a, b) => a - b);

  for (const key of sortedKeys) {
    const entry = topLevelArgs.get(key)!;
    if (entry.solType.toLowerCase() === 'tuple' && entry.fields.length > 0) {
      // Build tuple fields
      const tupleFields: ParsedArg[] = entry.fields.map(f => {
        const t = guessType(f.value);
        return { name: f.fieldName, value: f.value, type: t, humanReadable: makeArgHuman(f.fieldName, f.value, t) };
      });
      const tupleArray = entry.fields.map(f => f.value);
      const rawValue = JSON.stringify(tupleArray);
      args.push({ name: entry.name, value: rawValue, rawValue, type: 'tuple', tupleFields });
    } else if (entry.directValue) {
      const t = guessType(entry.directValue);
      args.push({ name: entry.name, value: entry.directValue, type: t, humanReadable: makeArgHuman(entry.name, entry.directValue, t) });
    } else {
      args.push({ name: entry.name, value: '[]', type: 'tuple', tupleFields: [] });
    }
  }

  if (args.length === 0) return null;
  return { fnName, fnSignature: fnFull, args, format: 'etherscan_table' };
};

const parseEtherscanFmt = (text: string): MintCallResult | null => {
  const fnMatch = text.match(/Function:\s*(\w+)/i);
  const fnName = fnMatch?.[1] || 'mint';
  const TAB_RE = /(?:\w+\.)?(\w+)\t(?:address|uint\d*|bytes\d*|bool|string|tuple)\t(0x[0-9a-fA-F]+|\d+|true|false)/g;
  const tabArgs: ParsedArg[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = TAB_RE.exec(text)) !== null) {
    const name  = tm[1];
    const value = tm[2];
    const type  = guessType(value);
    tabArgs.push({ name, value, type, humanReadable: makeArgHuman(name, value, type) });
  }
  if (tabArgs.length > 0) return { fnName, args: tabArgs, format: 'etherscan' };

  const sigMatch = text.match(/Function:\s*\w+\s*\(([^)]*)\)/i);
  const params = (sigMatch?.[1] || '').split(',').map((p, i) => {
    const parts = p.trim().split(/\s+/);
    return parts[1] || `arg${i}`;
  });
  const re = /\[(\d+)\]\s*[:\-]?\s*(0x[0-9a-fA-F]+|\d+|true|false)/g;
  const idxArgs: ParsedArg[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const idx   = parseInt(m[1]);
    const value = m[2];
    const name  = params[idx] || `arg${idx}`;
    const type  = guessType(value);
    idxArgs.push({ name, value, type, humanReadable: makeArgHuman(name, value, type) });
  }
  if (idxArgs.length > 0) return { fnName, args: idxArgs, format: 'etherscan' };

  return null;
};

const parseNamedFmt = (text: string): ParsedArg[] => {
  const args: ParsedArg[] = [];
  const lines = text.split('\n');
  const re = /^\s*[\[\(]?([A-Za-z_]\w{0,40})[\]\)]?\s*[:\-=]?\s+(0x[0-9a-fA-F]+|\d+|true|false)\s*$/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const name = m[1];
    const value = m[2];
    const type = guessType(value);
    args.push({ name, value, type, humanReadable: makeArgHuman(name, value, type) });
  }
  return args;
};

const parseCalldataFmt = (text: string): MintCallResult | null => {
  const m = text.match(/\b(0x[0-9a-fA-F]{74,})\b/);
  if (!m) return null;
  const hex = m[1];
  const selector = hex.slice(0, 10);
  const data = hex.slice(10);
  if (data.length < 64) return null;

  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += 64) chunks.push(data.slice(i, i + 64).padStart(64, '0'));

  const args: ParsedArg[] = chunks.map((chunk, i) => {
    if (chunk.startsWith('000000000000000000000000')) {
      const addr = '0x' + chunk.slice(24);
      return { name: `arg${i}`, value: addr, type: 'address' as const };
    }
    try {
      const bigVal = BigInt('0x' + chunk).toString();
      return { name: `arg${i}`, value: bigVal, type: 'uint' as const, humanReadable: weiToHuman(bigVal) };
    } catch {
      return { name: `arg${i}`, value: '0x' + chunk, type: 'bytes' as const };
    }
  });

  return { fnName: `? (selector ${selector})`, args, rawCalldata: hex, format: 'calldata' };
};

const KNOWN_POSITIONAL = ['benefactor', 'beneficiary', 'collateral', 'collateralAmount', 'overlayerWrapAmount'];

const parsePositionalFmt = (text: string): MintCallResult | null => {
  const addrs = [...new Set([...text.matchAll(/0x[0-9a-fA-F]{40}/g)].map(x => x[0]))];
  const amounts = [...text.matchAll(/\b(\d{7,})\b/g)].map(x => x[1]);
  if (addrs.length === 0 && amounts.length === 0) return null;

  const fnMatch = text.match(/\b(mint|transfer|approve|swap|deposit|withdraw|stake|claim|send)\b/i);
  const fnName = fnMatch?.[1] || 'mint';

  const args: ParsedArg[] = [
    ...addrs.map((addr, i): ParsedArg => ({ name: KNOWN_POSITIONAL[i] ?? `addr${i}`, value: addr, type: 'address' })),
    ...amounts.map((amt, i): ParsedArg => {
      const name = KNOWN_POSITIONAL[addrs.length + i] ?? `amount${i}`;
      return { name, value: amt, type: 'uint', humanReadable: makeArgHuman(name, amt, 'uint') };
    }),
  ];

  return { fnName, args, format: 'positional' };
};

const parseMintCallArgsV2 = (text: string): MintCallResult | null => {
  if (/Function:\s*\w+/i.test(text)) {
    const tableResult = parseEtherscanTableFmt(text);
    if (tableResult) return tableResult;
    const r = parseEtherscanFmt(text);
    if (r) return r;
  }
  const named = parseNamedFmt(text);
  if (named.length >= 1) {
    const fnMatch = text.match(/(?:function|fn|method|call)\s*[:\-]?\s*(\w+)/i);
    return { fnName: fnMatch?.[1] || 'mint', args: named, format: 'named' };
  }
  if (/0x[0-9a-fA-F]{74,}/i.test(text)) {
    const r = parseCalldataFmt(text);
    if (r) return r;
  }
  return parsePositionalFmt(text);
};

const buildCvArgsOutput = (args: ParsedArg[]): string => {
  const vals = args.map(a => {
    if (a.type === 'tuple' && a.tupleFields && a.tupleFields.length > 0) {
      return a.tupleFields.map(f => f.value);
    }
    return a.value;
  });
  return JSON.stringify([vals]);
};

const explainArgForHub = (arg: ParsedArg, idx: number): string => {
  if (arg.type === 'tuple' && arg.tupleFields && arg.tupleFields.length > 0) {
    const fieldList = arg.tupleFields.map(f => {
      const short = f.value.length > 30 ? f.value.slice(0, 14) + '...' + f.value.slice(-6) : f.value;
      const hint = f.humanReadable ? ` (${f.humanReadable})` : '';
      return `    • ${f.name}: \`${short}\`${hint}`;
    }).join('\n');
    return `**${idx + 1}. ${arg.name}** 📦 _tuple → isi sebagai array JSON_\n${fieldList}\n    → **format:** \`["${arg.tupleFields.map(f => f.value).join('","')}"\`]`;
  }
  const icon = arg.type === 'address' ? '🔑' : arg.type === 'uint' ? '🔢' : arg.type === 'bool' ? '🔘' : '📦';
  const short = arg.value.length > 30 ? arg.value.slice(0, 14) + '...' + arg.value.slice(-6) : arg.value;
  const hint = arg.humanReadable ? ` _(${arg.humanReadable})_` : '';
  return `**${idx + 1}. ${arg.name}** ${icon} \`${short}\`${hint}`;
};

const formatMintCallReply = (result: MintCallResult): string => {
  const lines: string[] = [];

  const formatBadge: Record<MintCallResult['format'], string> = {
    etherscan_table: '🟢 Etherscan decoded (table)',
    etherscan:       '🟢 Etherscan decoded',
    named:           '🔵 Named args',
    calldata:        '🟡 Raw calldata',
    positional:      '🟠 Positional (fallback)',
  };

  const hasTuple = result.args.some(a => a.type === 'tuple');

  lines.push(`⚙️ **CV Args — \`${result.fnName}\`**`);
  if (result.fnSignature && result.fnSignature !== result.fnName) {
    lines.push(`_Signature: \`${result.fnSignature.slice(0, 80)}${result.fnSignature.length > 80 ? '...' : ''}\`_`);
  }
  lines.push(`_Format: ${formatBadge[result.format]} · ${result.args.length} parameter_`);
  lines.push('');

  if (result.rawCalldata) {
    lines.push(`📦 **Selector:** \`${result.rawCalldata.slice(0, 10)}\` · ${(result.rawCalldata.length - 2) / 2} bytes`);
    lines.push('');
  }

  lines.push('**📋 Breakdown parameter:**');
  lines.push('');
  result.args.forEach((arg, i) => {
    lines.push(explainArgForHub(arg, i));
    lines.push('');
  });

  lines.push('---');
  lines.push('**⚙️ CV Args — copy ke GarapHub:**');
  lines.push('```');
  lines.push(buildCvArgsOutput(result.args));
  lines.push('```');

  if (hasTuple) {
    lines.push('');
    lines.push('**💡 Cara isi GarapHub (ada tuple):**');
    lines.push('');
    result.args.forEach((arg, i) => {
      if (arg.type === 'tuple' && arg.tupleFields && arg.tupleFields.length > 0) {
        const tupleVals = arg.tupleFields.map(f => JSON.stringify(f.value));
        lines.push(`**Arg ${i + 1} — \`${arg.name}\`** _(tuple = array JSON)_`);
        lines.push('```');
        lines.push(`[${tupleVals.join(', ')}]`);
        lines.push('```');
        lines.push('> ⚠️ _Jangan pakai string dengan koma. Harus array `["val1","val2",...]`_');
        lines.push('');

        arg.tupleFields.forEach(f => {
          const note = f.type === 'bytes'
            ? `bytes kosong → \`"0x"\` bukan \`0\` atau \`""\``
            : f.type === 'uint'
            ? `uint256 besar → pakai string ${f.humanReadable ? `(${f.humanReadable})` : ''}`
            : f.type === 'address'
            ? `address → \`"${f.value}"\``
            : '';
          if (note) lines.push(`  • \`${f.name}\` — ${note}`);
        });
        lines.push('');
      } else {
        lines.push(`**Arg ${i + 1} — \`${arg.name}\`** \`${arg.value}\``);
        lines.push('');
      }
    });
  }

  if (result.format === 'calldata') {
    lines.push('> ⚠️ _Arg names dari raw calldata mungkin tidak akurat. Paste Etherscan decoded untuk hasil presisi._');
  }
  if (result.format === 'positional') {
    lines.push('> ℹ️ _Parsed positional menggunakan nama field standar._');
  }

  return lines.join('\n');
};

const isMintCallInput = (text: string): boolean => {
  const lower = text.toLowerCase();
  if (/^0x[0-9a-fA-F]{74,}/m.test(text)) return true;
  if (/Function:\s*\w+/i.test(text)) return true;
  if (lower.includes('cv args') || lower.includes('mint call') || lower.includes('calldata')) return true;
  if (/benefactor|beneficiary|collateral|overlayer/i.test(text)) return true;
  if (/(mint|transfer|approve|send|swap)\s*\(/i.test(text) && /0x[0-9a-fA-F]{40}/.test(text)) return true;
  if (/\b_sendParam\b|\b_fee\b|\bdstEid\b|\bamountLD\b|\bextraOptions\b/i.test(text)) return true;
  if (/\b\w+\s*[:\-=]\s*(0x[0-9a-fA-F]{40}|\d{8,})/m.test(text) && text.split('\n').length >= 2) return true;
  return false;
};

const extractMemoriesLocally = (
  userMsg: string,
  assistantReply: string
): Array<Omit<OtakRektMemory, 'id' | 'createdAt' | 'updatedAt'>> => {
  const results: Array<Omit<OtakRektMemory, 'id' | 'createdAt' | 'updatedAt'>> = [];
  const u = userMsg.toLowerCase();
  const a = assistantReply.toLowerCase();
  const prefPatterns: Array<{ re: RegExp; cat: OtakRektMemory['category']; build: (m: RegExpMatchArray) => string }> = [
    { re: /saya (suka|prefer|favorit|lebih suka|biasanya) (.{4,60})/i, cat: 'preferensi', build: m => `Pengguna ${m[1]} ${m[2]}` },
    { re: /aku (suka|prefer|favorit|lebih suka|biasanya) (.{4,60})/i,  cat: 'preferensi', build: m => `Pengguna ${m[1]} ${m[2]}` },
    { re: /gue (suka|prefer|favorit|lebih suka|biasanya) (.{4,60})/i,  cat: 'preferensi', build: m => `Pengguna ${m[1]} ${m[2]}` },
    { re: /gw (suka|prefer|favorit|lebih suka|biasanya) (.{4,60})/i,   cat: 'preferensi', build: m => `Pengguna ${m[1]} ${m[2]}` },
  ];
  for (const p of prefPatterns) {
    const m = userMsg.match(p.re);
    if (m) { results.push({ category: p.cat, content: p.build(m).slice(0, 280), tags: ['auto', 'preferensi'] }); break; }
  }

  const goalPatterns = [
    /ingin (.{5,80})/i,
    /mau (.{5,80})/i,
    /target (saya|aku|gue|gw)? ?(.{5,80})/i,
    /tujuan (saya|aku|gue|gw)? ?(.{5,80})/i,
    /lagi fokus (.{5,80})/i,
  ];
  for (const re of goalPatterns) {
    const m = userMsg.match(re);
    if (m && !u.includes('mau tanya') && !u.includes('mau lihat')) {
      const content = (m[2] || m[1] || '').trim();
      if (content.length > 5) { results.push({ category: 'tujuan', content: `Pengguna ingin ${content}`.slice(0, 280), tags: ['auto', 'tujuan'] }); break; }
    }
  }

  const walletMatch = userMsg.match(/(?:wallet|address|alamat)[^\n]*?(0x[0-9a-fA-F]{40})/i);
  if (walletMatch) results.push({ category: 'fakta', content: `Wallet address pengguna: ${walletMatch[1]}`, tags: ['auto', 'wallet'] });

  const networks = ['ethereum', 'solana', 'polygon', 'arbitrum', 'base', 'monad', 'sui', 'aptos', 'bnb', 'optimism', 'avalanche'];
  for (const net of networks) {
    if (u.includes(net) && (u.includes('saya pakai') || u.includes('pake') || u.includes('main') || u.includes('fokus'))) {
      results.push({ category: 'preferensi', content: `Pengguna aktif di jaringan ${net}`, tags: ['auto', 'network', net] }); break;
    }
  }

  if (u.includes('capek') || u.includes('lelah') || u.includes('tired'))
    results.push({ category: 'catatan', content: 'Pengguna kadang kelelahan saat garap airdrop', tags: ['auto', 'mood'] });
  if (u.includes('males') || u.includes('malas'))
    results.push({ category: 'catatan', content: 'Pengguna kadang malas, perlu motivasi ringan', tags: ['auto', 'mood'] });
  return results.filter(r => r.content.length >= 12);
};

interface ConvContext {
  lastTopic: string;
  mentionedTasks: string[];
  mentionedNetworks: string[];
  sessionStartedAt: number;
  msgCount: number;
}

const buildConvContext = (messages: Message[]): ConvContext => {
  const ctx: ConvContext = { lastTopic: '', mentionedTasks: [], mentionedNetworks: [], sessionStartedAt: Date.now(), msgCount: 0 };
  const tasks: Task[] = (() => { try { return JSON.parse(localStorage.getItem('airdropTasks') || '[]'); } catch { return []; } })();
  const taskNames = tasks.map(t => t.nama.toLowerCase());
  const networks = ['ethereum', 'solana', 'polygon', 'arbitrum', 'base', 'monad', 'sui', 'aptos', 'bnb', 'optimism', 'avalanche', 'sepolia', 'holesky', 'mumbai'];

  const recentMsgs = messages.slice(-20);
  ctx.msgCount = messages.filter(m => m.role === 'user').length;

  for (const msg of recentMsgs) {
    const lower = msg.content.toLowerCase();
    for (const name of taskNames) {
      if (lower.includes(name) && !ctx.mentionedTasks.includes(name)) ctx.mentionedTasks.push(name);
    }
    for (const net of networks) {
      if (lower.includes(net) && !ctx.mentionedNetworks.includes(net)) ctx.mentionedNetworks.push(net);
    }
    if (lower.match(/garap|airdrop|task|tugas/)) ctx.lastTopic = 'airdrop';
    else if (lower.match(/keuangan|income|profit|expense/)) ctx.lastTopic = 'keuangan';
    else if (lower.match(/portfolio|token|holding/)) ctx.lastTopic = 'portfolio';
    else if (lower.match(/deadline|mepet|expire/)) ctx.lastTopic = 'deadline';
    else if (lower.match(/faucet|testnet|faucets/)) ctx.lastTopic = 'faucet';
  }
  return ctx;
};

const extractTextFromFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['txt', 'md', 'csv', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml'].includes(ext || '')) {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file, 'utf-8');
    return;
  }
  reject(new Error(`Format .${ext} belum didukung.`));
});

const rektBrain = (
  userInput: string,
  memories: OtakRektMemory[],
  convCtx: ConvContext,
  importedContexts: ImportedContext[],
  messages: Message[]
): string => {
  const q = userInput.toLowerCase().trim();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const tasks: Task[]               = (() => { try { return JSON.parse(localStorage.getItem('airdropTasks')    || '[]'); } catch { return []; } })();
  const transactions: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('transactions')    || '[]'); } catch { return []; } })();
  const portfolio: PortfolioToken[] = (() => { try { return JSON.parse(localStorage.getItem('portfolioTokens') || '[]'); } catch { return []; } })();

  const ongoingTasks   = tasks.filter(t => t.status === 'Ongoing');
  const belumSelesai   = ongoingTasks.filter(t => !t.selesaiHariIni);
  const sudahSelesai   = ongoingTasks.filter(t => t.selesaiHariIni);
  const endedTasks     = tasks.filter(t => t.status === 'END');
  const waitlistTasks  = tasks.filter(t => t.status === 'Waitlist');
  const totalIncome    = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalExpense   = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const profit         = totalIncome - totalExpense;
  const holdingVal     = portfolio.filter(p => p.status === 'holding').reduce((a, p) => a + p.jumlahToken * p.hargaPerToken, 0);

  const deadlineDekat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(t => { const dl = new Date(t.deadline!); dl.setHours(0,0,0,0); return { ...t, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000) }; })
    .filter(t => t.diff >= 0 && t.diff <= 7)
    .sort((a, b) => a.diff - b.diff);

  const deadlineLewat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(t => { const dl = new Date(t.deadline!); dl.setHours(0,0,0,0); return { ...t, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000) }; })
    .filter(t => t.diff < 0);

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const recallMemory = (query: string): string => {
    if (memories.length === 0) return '';
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const hits = memories
      .filter(m => words.some(w => m.content.toLowerCase().includes(w) || (m.tags || []).some(t => t.toLowerCase().includes(w))))
      .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0));
    if (hits.length === 0) return '';
    return `\n\n🧠 _Rekt ingat: ${hits.slice(0, 2).map(m => m.content).join(' | ')}_`;
  };

  const ctxInfo = importedContexts.length > 0
    ? `\n\n📎 _Konteks aktif: ${importedContexts.map(c => c.name).join(', ')}_`
    : '';
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user' && m.content !== userInput)?.content?.toLowerCase() || '';
  const lastBotMsg  = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
  const isFollowUp  = q.length < 30 && (lastBotMsg.length > 100);

  if (isMintCallInput(userInput)) {
    const result = parseMintCallArgsV2(userInput);
    if (result) return formatMintCallReply(result);
  }

  if (q.match(/^(hai|halo|hi|hello|hei|pagi|siang|sore|malam|oi|oy|sup|woi)\b/)) {
    const hour = new Date().getHours();
    const sapa = hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 18 ? 'Sore' : 'Malam';
    const memNote = memories.length > 0 ? `\n\n🧠 Aku masih ingat **${memories.length} hal** tentang kamu!` : '';
    const ctxNote = convCtx.msgCount > 5 ? `\n\nKita udah ngobrol **${convCtx.msgCount} kali** nih bro, makin paham dengan kamu 😄` : '';
    return `${sapa}! 👋 Saya **Rekt**, AI lokal kamu.${memNote}${ctxNote}\n\nMau ngapain sekarang?`;
  }

  if (q.match(/siapa (kamu|lo|lu|elu|rekt)|kamu (apa|siapa|bisa apa)|lo (siapa|apa|bisa apa)/)) {
    return `Aku **Rekt** — AI assistant untuk Erdrop Manager kamu!\n\n✅ Sepenuhnya offline, gak butuh API\n✅ Otomatis belajar dari setiap obrolanmu\n✅ Bisa bantu pantau & garap airdrop\n✅ Bisa analisis keuangan & portfolio\n✅ Parse ABI mint() call args\n✅ Import file sebagai konteks\n\nMakin sering ngobrol, makin banyak yang aku ingat tentang kamu! 🧠`;
  }

  if (q.match(/progress|hari ini|ringkas|summary|selesai berapa|sudah berapa/)) {
    const pct = ongoingTasks.length > 0 ? Math.round((sudahSelesai.length / ongoingTasks.length) * 100) : 0;
    const progressBar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    let reply = `📊 **Progress Hari Ini**\n\n\`${progressBar}\` ${pct}%\n\n✅ Selesai: **${sudahSelesai.length}** / ${ongoingTasks.length}\n🔴 Belum: **${belumSelesai.length}** tugas\n`;
    if (belumSelesai.length > 0) {
      reply += `\n**Belum dikerjakan:**\n${belumSelesai.slice(0, 5).map(t => `- **${t.nama}**${t.link && t.link !== '#' ? ` → ${t.link}` : ''}`).join('\n')}`;
      if (belumSelesai.length > 5) reply += `\n...dan ${belumSelesai.length - 5} lagi`;
    } else if (ongoingTasks.length > 0) reply += `\n🎉 Semua sudah beres hari ini, mantap sultan!`;
    return reply + recallMemory(q);
  }

  if (q.match(/deadline|mepet|mendekat|expire|hampir habis/)) {
    if (deadlineLewat.length > 0) {
      const overdueStr = deadlineLewat.slice(0, 3).map(t => `- ❌ **${t.nama}** (lewat ${Math.abs(t.diff)} hari)`).join('\n');
      return `⚠️ **Airdrop Overdue:**\n\n${overdueStr}\n\nMending update ke END atau cek apakah masih bisa diikuti ya!`;
    }
    if (deadlineDekat.length === 0) return `✅ Tidak ada deadline dalam 7 hari ke depan. Santai dulu bro!`;
    return `⏰ **Deadline Mendekat:**\n\n${deadlineDekat.map(t => `- **${t.nama}** → ${t.diff === 0 ? '🔴 HARI INI' : t.diff === 1 ? '🟠 Besok' : `🟡 ${t.diff} hari lagi`}${t.link && t.link !== '#' ? `\n  🔗 ${t.link}` : ''}`).join('\n')}` + recallMemory(q);
  }
  if (q.match(/\b(list|tampil|semua|daftar|lihat)\b.*\b(airdrop|task|garapan|tugas)\b|\b(airdrop|task|garapan)\b.*\b(list|tampil|semua|daftar)\b/)) {
    if (tasks.length === 0) return `📋 Belum ada tugas airdrop yang tercatat. Tambah dulu di halaman utama ya!`;
    const lines = tasks.slice(0, 20).map(t => `- **${t.nama}** \`[${t.status}]\`${t.kategori ? ` _(${t.kategori})_` : ''}${t.link && t.link !== '#' ? `\n  🔗 ${t.link}` : ''}`);
    return `📋 **Daftar Airdrop** (${tasks.length} total):\n\n${lines.join('\n')}${tasks.length > 20 ? `\n\n...dan ${tasks.length - 20} lagi` : ''}`;
  }

  if (q.match(/\b(garap|kerjakan|mulai|kerja)\b|mana dulu|prioritas/)) {
    if (belumSelesai.length === 0) {
      return ongoingTasks.length === 0
        ? `Belum ada airdrop ongoing. Tambah dulu di halaman utama ya bro!`
        : `🎉 Semua airdrop ongoing **sudah dikerjakan** hari ini! Sultan mode activated 👑`;
    }
    const prioritized = [...belumSelesai].sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1; if (b.deadline) return 1; return 0;
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
    const actionJson = `\`\`\`json\n[{"type":"TOGGLE_DONE","label":"Tandai ${target.nama} selesai","payload":{"nama":"${target.nama}","selesaiHariIni":true}}]\n\`\`\``;
    return `🚀 **Garap sekarang: ${target.nama}**\nKategori: ${kat}${target.deadline ? ` | Deadline: ${target.deadline}` : ''}\n${target.link && target.link !== '#' ? `🔗 ${target.link}\n` : ''}\n**Step-by-step:**\n${guide}\n\nSetelah selesai, tandai tugas ini done:\n${actionJson}\n_(${belumSelesai.length - 1} tugas lain masih antri)_`;
  }

  if (q.match(/keuangan|income|expense|profit|uang|duit|finansial|pemasukan|pengeluaran/)) {
    const profitColor = profit >= 0 ? '▲ Untung' : '▼ Rugi';
    let reply = `💰 **Ringkasan Keuangan**\n\n📈 Income: **$${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n📉 Expense: **$${totalExpense.toFixed(2)}**\n${profit >= 0 ? '✅' : '❌'} Net Profit: **$${profit.toFixed(2)}** (${profitColor})\n📑 Total Transaksi: ${transactions.length}`;
    if (transactions.length === 0) reply += `\n\n_Belum ada transaksi. Tambah di menu Finance ya!_`;
    return reply + recallMemory(q);
  }

  if (q.match(/portfolio|token|holding|aset|coin/)) {
    const holdingTokens = portfolio.filter(p => p.status === 'holding');
    if (holdingTokens.length === 0) return `📦 Portfolio kamu masih kosong. Tambah token dulu di menu Portfolio!`;
    const lines = holdingTokens.slice(0, 8).map(p => `- **${p.tokenSymbol}** ${p.jumlahToken.toLocaleString('en-US', { maximumFractionDigits: 2 })} × $${p.hargaPerToken} = **$${(p.jumlahToken * p.hargaPerToken).toFixed(2)}** _(${p.status})_`);
    return `💼 **Portfolio** (${holdingTokens.length} token holding)\n\n${lines.join('\n')}\n\n💎 **Total Holding: $${holdingVal.toFixed(2)}**` + recallMemory(q);
  }

  if (q.match(/statistik|stats|total|rekap|dashboard|overview|rangkuman/)) {
    const pct = ongoingTasks.length > 0 ? Math.round((sudahSelesai.length / ongoingTasks.length) * 100) : 0;
    return `📊 **Statistik Erdrop Manager**\n\n🗂 Total Airdrop: **${tasks.length}**\n▶️ Ongoing: **${ongoingTasks.length}** (${pct}% selesai hari ini)\n🏁 Ended: **${endedTasks.length}**\n⏳ Waitlist: **${waitlistTasks.length}**\n⚠️ Deadline mepet: **${deadlineDekat.length}**\n\n💰 Income: **$${totalIncome.toFixed(2)}** | Profit: **$${profit.toFixed(2)}**\n💼 Portfolio: **$${holdingVal.toFixed(2)}**\n🧠 Memori Rekt: **${memories.length} ingatan**`;
  }

  if (q.match(/ingat|memori|otak|memory|rekt ingat|kamu tau|lo tau/)) {
    if (memories.length === 0) return `🧠 Rekt belum punya ingatan apapun tentang kamu.\n\nAjarkan aku sesuatu! Bilang aja hal-hal yang ingin aku ingat, misalnya:\n- "wallet utama aku 0x..."\n- "aku fokus di network Monad"\n- "target profit aku $500 bulan ini"`;
    const recent = memories.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    return `🧠 **Ingatan Rekt** (${memories.length} total):\n\n${recent.map(m => `- [${m.category}] ${m.content}`).join('\n')}${memories.length > 8 ? `\n\n_...dan ${memories.length - 8} ingatan lagi. Lihat di panel Otak Rekt._` : ''}`;
  }

  if (q.match(/ingat ini|catat ini|simpan ini|rekt ingat|tolong ingat|jangan lupa/)) {
    const contentStart = userInput.replace(/ingat ini[:\-]?|catat ini[:\-]?|simpan ini[:\-]?|rekt ingat[:\-]?|tolong ingat[:\-]?|jangan lupa[:\-]?/gi, '').trim();
    if (contentStart.length > 3) {
      return `✅ Baik, aku catat:\n_"${contentStart}"_\n\n🧠 Tersimpan di memori permanen aku!\n\n\`\`\`json\n[{"type":"__MEMORY__","label":"Simpan memori","payload":{"content":"${contentStart.replace(/"/g, '\\"')}","category":"catatan"}}]\n\`\`\``;
    }
    return `Mau aku ingat apa? Ceritain aja, misalnya:\n- "Rekt, ingat ini: wallet aku 0x..."\n- "Simpan ini: aku main airdrop sejak 2023"`;
  }

  if (q.match(/\b(tambah|daftarin|masukin)\b.*\b(airdrop|task|garapan|tugas)\b/)) {
    const namaMatch = userInput.match(/(?:tambah|daftarin|masukin)[^\n]*?(?:airdrop|task|garapan|tugas)[^\n]*?[:\-]?\s*["""]?(.+?)["""]?\s*(?:link|url|$)/i);
    const linkMatch = userInput.match(/(?:link|url)[:\s]+?(https?:\/\/\S+)/i);
    if (namaMatch) {
      const nama = namaMatch[1].trim().slice(0, 80);
      const link = linkMatch ? linkMatch[1] : '#';
      return `✅ Oke, aku tambahkan airdrop **${nama}**!\n\`\`\`json\n[{"type":"ADD","label":"Tambah ${nama}","payload":{"nama":"${nama}","tugas":"Garapan","link":"${link}","kategori":"Testnet","status":"Ongoing","akun":1,"selesaiHariIni":false,"detailAkun":[]}}]\n\`\`\``;
    }
    return `Mau tambah airdrop apa? Format: "Tambah airdrop [nama] link [url]"\nContoh: _Tambah airdrop Monad link https://testnet.monad.xyz_`;
  }

  if (q.match(/\b(hapus|delete|buang|remove)\b.*\b(airdrop|task|tugas)\b/)) {
    const namaMatch = userInput.match(/(?:hapus|delete|buang|remove)[^\n]*?(?:airdrop|task|tugas)[^\n]*?[:\-]?\s*(.+)/i);
    if (namaMatch) {
      const nama = namaMatch[1].trim().slice(0, 80);
      return `🗑️ Hapus **${nama}**?\n\`\`\`json\n[{"type":"DELETE","label":"Hapus ${nama}","payload":{"nama":"${nama}"}}]\n\`\`\``;
    }
    return `Mau hapus airdrop apa? Format: "Hapus airdrop [nama]"\nContoh: _Hapus airdrop Monad_`;
  }

  if (q.match(/\b(selesai|done|tandai|mark)\b.*\b(airdrop|task|tugas)\b|\b(sudah|udah)\b.*\b(garap|kerja|beres)\b/)) {
    const foundTask = tasks.find(t => q.includes(t.nama.toLowerCase()));
    if (foundTask) {
      return `✅ Tandai **${foundTask.nama}** selesai hari ini!\n\`\`\`json\n[{"type":"TOGGLE_DONE","label":"Tandai ${foundTask.nama} selesai","payload":{"nama":"${foundTask.nama}","selesaiHariIni":true}}]\n\`\`\``;
    }
    if (belumSelesai.length === 1) {
      const t = belumSelesai[0];
      return `✅ Tandai **${t.nama}** selesai?\n\`\`\`json\n[{"type":"TOGGLE_DONE","label":"Tandai ${t.nama} selesai","payload":{"nama":"${t.nama}","selesaiHariIni":true}}]\n\`\`\``;
    }
    return `Tugas mana yang mau ditandai selesai? Yang belum: ${belumSelesai.slice(0, 5).map(t => `**${t.nama}**`).join(', ')}`;
  }

  if (isFollowUp) {
    if (q.match(/^(ok|oke|oke bro|siap|sip|mantap|oke deh|noted|paham|ngerti|clear)$/)) {
      return pick([`Mantap! Ada lagi yang bisa aku bantu? 😄`, `Siap bro! Lanjut apa lagi?`, `Oke! Kalau ada yang mau ditanyain lagi, bilang aja 👍`]);
    }
    if (q.match(/^(makasih|thanks|terima kasih|thx|tengkyu)$/)) {
      return pick([`Sama-sama bro! 😊`, `No problem! Kalau butuh apa-apa chat lagi ya 🤙`, `Santai aja, senang bisa bantu!`]);
    }
    if (q.match(/^(lanjut|next|selanjutnya|berikutnya)$/) && convCtx.lastTopic === 'airdrop' && belumSelesai.length > 1) {
      const next = belumSelesai[1]; // second in the list
      const kat = next.kategori || 'Testnet';
      return `🚀 Lanjut ke: **${next.nama}** _(${kat})_\n${next.link && next.link !== '#' ? `🔗 ${next.link}\n` : ''}\nGas kerjain! Tandai selesai kalau udah beres:\n\`\`\`json\n[{"type":"TOGGLE_DONE","label":"Tandai ${next.nama} selesai","payload":{"nama":"${next.nama}","selesaiHariIni":true}}]\n\`\`\``;
    }
  }

  if (importedContexts.length > 0) {
    const ctx = importedContexts[0];
    const found = ctx.content.toLowerCase();
    if (found.includes(q.slice(0, 20)) || q.includes('file') || q.includes('dokumen') || q.includes('tadi')) {
      const excerpt = ctx.content.slice(0, 600);
      return `📄 **Dari file "${ctx.name}":**\n\n${excerpt}${ctx.content.length > 600 ? '\n\n_...(konten dipotong, file lebih panjang)_' : ''}`;
    }
  }
  if (q.match(/tips|saran|advice|motivasi|semangat/)) {
    const tips = [
      `💡 **Tips Airdrop:** Gunakan wallet berbeda untuk airdrop berisiko tinggi biar wallet utama aman.`,
      `💡 **Tips:** Selalu screenshot transaksi airdrop sebagai bukti kalau ada claim nanti.`,
      `💡 **Tips:** Diversifikasi! Jangan taruh semua effort di satu airdrop aja.`,
      `💡 **Tips:** Airdrop Testnet lebih worth kalau proyeknya punya backing investor besar.`,
      `💡 **Tips Keuangan:** Catat semua income & expense di menu Finance biar bisa tracking profit.`,
      `🔥 **Motivasi:** Konsistensi itu kunci. Sedikit setiap hari lebih baik dari nonstop tapi burnout!`,
      `🔥 **Motivasi:** Mereka yang rutin garap airdrop saat bear market yang panen saat bull market!`,
    ];
    return pick(tips) + recallMemory('tips motivasi');
  }

  if (q.match(/\bhelp\b|\bbantuan\b|\bbisa apa\b|\bperintah\b|\bcommand\b|\bfungsi\b/)) {
    return `🤖 **Rekt bisa bantu kamu dengan:**\n\n**📋 Airdrop:**\n- \`list airdrop\` — lihat semua\n- \`garap airdrop\` — panduan step-by-step\n- \`progress hari ini\` — berapa yang sudah selesai\n- \`deadline mepet?\` — cek yang hampir habis\n- \`tambah airdrop [nama] link [url]\` — tambah baru\n- \`hapus airdrop [nama]\` — hapus\n- \`selesai [nama]\` — tandai done\n\n**💰 Finansial:**\n- \`ringkasan keuangan\` — income/expense/profit\n- \`portfolio\` — token holding\n- \`statistik\` — overview lengkap\n\n**🧠 Memori:**\n- \`ingat ini: [info]\` — simpan ke memori\n- \`kamu ingat apa?\` — lihat semua ingatan\n\n**⚙️ CV Args Parser v3 (tuple-aware):**\n- Paste **Etherscan decoded table** (Function: send((uint32,...),...))\n  → otomatis deteksi tuple bersarang, output array JSON yang benar\n- Paste **named args** (benefactor: 0x... collateralAmount: 123)\n- Paste **raw calldata hex** (0x1249c58b000...)\n- Output: breakdown per field, format array untuk GarapHub, tips bytes kosong\n\n**🔧 Lain-lain:**\n- \`tips\` — saran & motivasi`;
  }

  if (q.match(/jam berapa|sekarang jam|waktu sekarang/)) {
    const now = new Date();
    return `🕐 Sekarang jam **${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}** · ${now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  const memHits = recallMemory(q);
  if (memHits && q.length > 8) {
    return `🔍 Berdasarkan yang aku ingat:${memHits}\n\nAda yang bisa aku bantu lebih lanjut soal ini?`;
  }

  const pct = ongoingTasks.length > 0 ? Math.round((sudahSelesai.length / ongoingTasks.length) * 100) : 0;
  const contextualHints: string[] = [];
  if (belumSelesai.length > 0) contextualHints.push(`masih ada **${belumSelesai.length} airdrop** yang belum dikerjakan hari ini`);
  if (deadlineDekat.length > 0) contextualHints.push(`**${deadlineDekat.length} deadline** dalam 7 hari ke depan`);
  if (profit > 0) contextualHints.push(`profit kamu $${profit.toFixed(2)} nih`);

  const fallbacks = [
    `Hmm, aku kurang paham maksudnya bro 😅 Coba cek \`help\` untuk lihat apa yang bisa aku bantu!`,
    `Aku belum bisa jawab itu secara spesifik. Tapi kalau soal airdrop, keuangan, atau portfolio — aku siap! Ketik \`help\` ya.`,
    contextualHints.length > 0
      ? `Btw, aku notice ${contextualHints[0]}. Mau aku bantu soal itu dulu?`
      : `Aku masih belajar dari percakapan kita. Coba tanya hal yang lebih spesifik ya bro! Ketik \`help\` buat lihat kemampuan aku.`,
  ];

  return pick(fallbacks) + ctxInfo;
};

const rektAutoBrain = (messages: Message[]): string | null => {
  const tasks: Task[] = (() => { try { return JSON.parse(localStorage.getItem('airdropTasks') || '[]'); } catch { return []; } })();
  const transactions: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('transactions') || '[]'); } catch { return []; } })();
  const portfolio: PortfolioToken[] = (() => { try { return JSON.parse(localStorage.getItem('portfolioTokens') || '[]'); } catch { return []; } })();

  const today = new Date(); today.setHours(0,0,0,0);
  const hour  = new Date().getHours();
  const ongoingTasks    = tasks.filter(t => t.status === 'Ongoing');
  const belumSelesai    = ongoingTasks.filter(t => !t.selesaiHariIni);
  const sudahSelesai    = ongoingTasks.filter(t => t.selesaiHariIni);
  const totalIncome     = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalExpense    = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const profit          = totalIncome - totalExpense;
  const holdingVal      = portfolio.filter(p => p.status === 'holding').reduce((a, p) => a + p.jumlahToken * p.hargaPerToken, 0);
  const lastUserMsg     = [...messages].reverse().find(m => m.role === 'user')?.content?.toLowerCase() || '';
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const deadlineMendekat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(t => { const dl = new Date(t.deadline!); dl.setHours(0,0,0,0); return { ...t, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000) }; })
    .filter(t => t.diff >= 0 && t.diff <= 3).sort((a, b) => a.diff - b.diff);

  const deadlineLewat = tasks
    .filter(t => t.deadline && t.status !== 'END')
    .map(t => { const dl = new Date(t.deadline!); dl.setHours(0,0,0,0); return { ...t, diff: Math.ceil((dl.getTime() - today.getTime()) / 86400000) }; })
    .filter(t => t.diff < 0);

  const neurons: (() => string | null)[] = [
    () => { const u = deadlineMendekat.filter(d => d.diff <= 1); if (!u.length) return null; const t = u[0]; const label = t.diff === 0 ? 'HARI INI' : 'besok'; return pick([`⚠️ Eh bro, **${t.nama}** deadline-nya ${label}! Jangan kelewatan ya.`, `🚨 Deadline **${t.nama}** tinggal ${label}! Udah dikerjain belum?`]); },
    () => { const s = deadlineMendekat.filter(d => d.diff >= 2); if (!s.length) return null; const t = s[0]; return pick([`📅 Btw, **${t.nama}** deadlinenya ${t.diff} hari lagi. Jangan ditunda terus ya!`, `Ingat, **${t.nama}** tinggal ${t.diff} hari lagi 😅`]); },
    () => { if (!deadlineLewat.length) return null; const t = deadlineLewat[0]; return pick([`💀 **${t.nama}** kayaknya udah lewat deadline ${Math.abs(t.diff)} hari lalu. Mending update ke END deh bro.`]); },
    () => { const p = sudahSelesai.length; const tot = ongoingTasks.length; if (p === 0 || tot === 0) return null; const pct = Math.round((p/tot)*100); if (pct >= 80) return pick([`🔥 Gila, udah ${p}/${tot} airdrop selesai hari ini! Hampir kelar semua!`, `Mantap jiwa! ${pct}% airdrop hari ini udah beres 💪`]); return null; },
    () => { if (belumSelesai.length === 0) return null; if (sudahSelesai.length > 0) return null; const t = pick(belumSelesai); return pick([`Pagi bro! ${belumSelesai.length} airdrop nunggu dikerjain. Mulai **${t.nama}** dulu? 🚀`, `${belumSelesai.length} garapan nunggu nih, jangan cuma bengong. Gas **${t.nama}**! 😄`]); },
    () => { if (belumSelesai.length !== 0 || ongoingTasks.length === 0) return null; return pick([`🎉 MANTAP! Semua airdrop hari ini udah kelar! Istirahat dulu sultan! 👑`, `GG! Semua garapan today done. Besok siap lagi ya 💪`]); },
    () => { if (transactions.length < 3) return null; if (profit > 0) return pick([`💰 Profit kamu sekarang $${profit.toFixed(2)}. Lumayan kan! Keep grinding!`]); if (profit < 0) return pick([`Hmm, pengeluaran lebih gede nih ($${Math.abs(profit).toFixed(2)} minus). Mending fokus garap airdrop biar balik modal 😅`]); return null; },
    () => { if (holdingVal < 1) return null; return pick([`Portfolio holding kamu ~$${holdingVal.toFixed(2)} sekarang. Semoga pumping bro! 🚀`]); },
    () => { if (hour >= 5 && hour < 9) return pick([`Selamat pagi bro! Udah siap garap airdrop hari ini? ☀️`]); if (hour >= 22 || hour < 2) return pick([`Masih melek? Jangan begadang kebanyakan gara-gara airdrop ya 😅`]); if (hour >= 12 && hour < 14) return pick([`Siang bro! Udah makan siang belum? Jangan skip makan gara-gara asik garap airdrop 😄`]); return null; },
    () => { if (!lastUserMsg) return null; if (lastUserMsg.includes('capek') || lastUserMsg.includes('lelah')) return `Istirahat dulu gapapa bro 😊`; if (lastUserMsg.includes('males') || lastUserMsg.includes('malas')) return pick([`Haha males juga wajar, tapi sayang kalau kelewatan deadline 😬`, `Gas dikit lagi bro, ${belumSelesai.length} airdrop doang kok!`]); return null; },
    () => pick([`💡 Tips: Gunakan wallet berbeda untuk airdrop berisiko tinggi.`, `💡 Jangan lupa screenshot setiap transaksi airdrop.`, `💡 Cek Twitter airdrop kamu secara berkala, kadang ada info penting.`, null]),
  ];

  const shuffled = [...neurons].sort(() => Math.random() - 0.5);
  for (const fn of shuffled) { const r = fn(); if (r) return r; }
  return pick([`Santai aja bro, kamu udah bagus progresnya 🙌`, `Keep grinding bro! 🚀`, null]);
};

export const AIAssistant: React.FC = () => {
  const [messages, setMessages]       = useState<Message[]>(loadMessages);
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});
  const [importedContexts, setImportedContexts] = useState<ImportedContext[]>([]);
  const [showImportPanel, setShowImportPanel]   = useState(false);
  const [importError, setImportError]           = useState('');
  const [importSuccess, setImportSuccess]       = useState('');
  const [importLoading, setImportLoading]       = useState(false);
  const [streamingText, setStreamingText]       = useState('');
  const [showSettings, setShowSettings]         = useState(false);
  const [showOtakRekt, setShowOtakRekt]         = useState(false);
  const [otakMemories, setOtakMemories]         = useState<OtakRektMemory[]>(loadMemories);
  const [otakInput, setOtakInput]               = useState('');
  const [otakCategory, setOtakCategory]         = useState<OtakRektMemory['category']>('fakta');
  const [otakTags, setOtakTags]                 = useState('');
  const [otakEditId, setOtakEditId]             = useState<string | null>(null);
  const [otakFilter, setOtakFilter]             = useState<OtakRektMemory['category'] | 'semua'>('semua');
  const [otakSearch, setOtakSearch]             = useState('');
  const [otakMsg, setOtakMsg]                   = useState('');
  const [autoMode, setAutoMode]                 = useState<boolean>(() => { try { return localStorage.getItem('rektAutoMode') !== 'false'; } catch { return true; } });
  const [showGarapPanel, setShowGarapPanel]     = useState(false);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const otakImportRef  = useRef<HTMLInputElement>(null);
  const autoTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMsgRef = useRef<number>(Date.now());

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES))); } catch {} }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  useEffect(() => {
    if (!autoMode) return;
    const schedule = () => {
      const delay = 120_000 + Math.random() * 240_000;
      autoTimerRef.current = setTimeout(async () => {
        if (Date.now() - lastUserMsgRef.current >= 60_000 && !isLoading) {
          const text = rektAutoBrain(messages);
          if (text) {
            let shown = '';
            for (let i = 0; i < text.length; i++) {
              shown += text[i];
              setStreamingText(shown);
              const ch = text[i];
              const delay2 = ch === ' ' ? 18 + Math.random() * 20 : ch === '.' || ch === '!' || ch === '?' ? 70 + Math.random() * 50 : 10 + Math.random() * 15;
              await new Promise(r => setTimeout(r, delay2));
            }
            setStreamingText('');
            setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: Date.now(), model: 'rekt-local' } as Message]);
          }
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, [autoMode, messages, isLoading]);

  const autoLearn = useCallback((userMsg: string, assistantReply: string) => {
    const newMems = extractMemoriesLocally(userMsg, assistantReply);
    if (newMems.length === 0) return;
    setOtakMemories(prev => {
      const now = Date.now();
      const entries: OtakRektMemory[] = newMems.map(m => ({
        ...m,
        id: `auto_${now}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
        hitCount: 0,
      }));
      const filtered = entries.filter(e => !prev.some(p => p.content.toLowerCase().includes(e.content.slice(0, 20).toLowerCase())));
      if (filtered.length === 0) return prev;
      const merged = [...prev, ...filtered].slice(-300);
      saveMemories(merged);
      setOtakMsg(`🧠 +${filtered.length} ingatan baru tersimpan otomatis`);
      setTimeout(() => setOtakMsg(''), 3000);
      return merged;
    });
  }, []);

  const addOrUpdateMemory = useCallback(() => {
    if (!otakInput.trim()) return;
    const tags = otakTags.split(',').map(t => t.trim()).filter(Boolean);
    setOtakMemories(prev => {
      let updated: OtakRektMemory[];
      if (otakEditId) {
        updated = prev.map(m => m.id === otakEditId ? { ...m, content: otakInput.trim(), category: otakCategory, tags, updatedAt: Date.now() } : m);
        setOtakMsg('✅ Memory diperbarui!');
      } else {
        updated = [...prev, { id: `mem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, category: otakCategory, content: otakInput.trim(), createdAt: Date.now(), updatedAt: Date.now(), tags, hitCount: 0 }];
        setOtakMsg('✅ Memory disimpan!');
      }
      saveMemories(updated);
      return updated;
    });
    setOtakInput(''); setOtakTags(''); setOtakEditId(null);
    setTimeout(() => setOtakMsg(''), 2500);
  }, [otakInput, otakCategory, otakTags, otakEditId]);

  const deleteMemory = useCallback((id: string) => {
    setOtakMemories(prev => { const u = prev.filter(m => m.id !== id); saveMemories(u); return u; });
  }, []);

  const startEditMemory = useCallback((m: OtakRektMemory) => {
    setOtakInput(m.content); setOtakCategory(m.category); setOtakTags((m.tags || []).join(', ')); setOtakEditId(m.id);
  }, []);

  const exportOtakMemory = useCallback(() => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: '2.0', memories: otakMemories }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `otakRekt_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.json`; a.click();
    URL.revokeObjectURL(url);
    setOtakMsg('✅ Memory berhasil diekspor!'); setTimeout(() => setOtakMsg(''), 2500);
  }, [otakMemories]);

  const importOtakMemory = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const imported: OtakRektMemory[] = json.memories || (Array.isArray(json) ? json : []);
        if (!imported.length) { setOtakMsg('❌ File kosong/tidak valid'); return; }
        setOtakMemories(prev => {
          const map = new Map(prev.map(m => [m.id, m]));
          imported.forEach(m => map.set(m.id, m));
          const merged = Array.from(map.values());
          saveMemories(merged);
          return merged;
        });
        setOtakMsg(`✅ ${imported.length} memory berhasil diimpor!`); setTimeout(() => setOtakMsg(''), 3000);
      } catch { setOtakMsg('❌ File JSON tidak valid'); setTimeout(() => setOtakMsg(''), 3000); }
    };
    reader.readAsText(file); e.target.value = '';
  }, []);

  const sendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;
    lastUserMsgRef.current = Date.now();

    const userMsg: Message = { role: 'user', content: userInput, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setStreamingText('');
    const thinkTime = 180 + Math.random() * 320;
    await new Promise(r => setTimeout(r, thinkTime));

    const convCtx = buildConvContext(newMessages);
    const reply = rektBrain(userInput, otakMemories, convCtx, importedContexts, newMessages);

    let cleanReply = reply;
    const memActionMatch = reply.match(/```json\s*(\[.*?"type":\s*"__MEMORY__".*?\])\s*```/s);
    if (memActionMatch) {
      try {
        const memAction = JSON.parse(memActionMatch[1])[0];
        if (memAction?.payload?.content) {
          const newMem: OtakRektMemory = {
            id: `mem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
            category: memAction.payload.category || 'catatan',
            content: memAction.payload.content,
            createdAt: Date.now(), updatedAt: Date.now(), tags: ['manual'], hitCount: 0,
          };
          setOtakMemories(prev => { const u = [...prev, newMem]; saveMemories(u); return u; });
          setOtakMsg(`🧠 Tersimpan: "${newMem.content.slice(0, 40)}..."`);
          setTimeout(() => setOtakMsg(''), 3000);
        }
      } catch {}
      cleanReply = reply.replace(memActionMatch[0], '').trim();
    }

    let shown = '';
    const words = cleanReply.split('');
    for (let i = 0; i < words.length; i++) {
      shown += words[i];
      setStreamingText(shown);
      const ch = words[i];
      const delay = ch === ' ' ? 8 + Math.random() * 10
                  : ch === '\n' ? 30 + Math.random() * 20
                  : ch === '.' || ch === '!' || ch === '?' ? 40 + Math.random() * 30
                  : ch === ',' ? 20 + Math.random() * 15
                  : 5 + Math.random() * 8;
      await new Promise(r => setTimeout(r, delay));
    }
    setStreamingText('');

    const { cleanText, actions } = parseActions(cleanReply);
    const assistantMsg: Message = {
      role: 'assistant',
      content: cleanText,
      timestamp: Date.now(),
      actions: actions.length > 0 ? actions : undefined,
    };
    setMessages(prev => [...prev, assistantMsg]);
    autoLearn(userInput, cleanText);

    setIsLoading(false);
  }, [messages, otakMemories, importedContexts, isLoading, autoLearn]);

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
    actions.forEach((action, aIdx) => { if (!action.applied) setTimeout(() => applyAction(msgIndex, aIdx, action), aIdx * 100); });
  };

  const clearChat = () => { setMessages([INITIAL_MESSAGE]); localStorage.removeItem(STORAGE_KEY); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleFileImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImportError(''); setImportSuccess(''); setImportLoading(true);
    const results: ImportedContext[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { errors.push(`${file.name}: > 5MB`); continue; }
      try { const content = await extractTextFromFile(file); results.push({ name: file.name, content, type: 'file' }); }
      catch (e: any) { errors.push(`${file.name}: ${e.message}`); }
    }
    setImportLoading(false);
    if (results.length > 0) { setImportedContexts(prev => [...prev, ...results].slice(-5)); setImportSuccess(`✅ ${results.length} file berhasil diimport!`); setTimeout(() => setImportSuccess(''), 3000); }
    if (errors.length > 0) setImportError(errors.join('\n'));
  };

  const getPendingTasks = useCallback(() => {
    try {
      const tasks: Task[] = JSON.parse(localStorage.getItem('airdropTasks') || '[]');
      return tasks.filter(t => t.status === 'Ongoing' && !t.selesaiHariIni).sort((a, b) => {
        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (a.deadline) return -1; if (b.deadline) return 1; return 0;
      });
    } catch { return []; }
  }, []);

  const msgCount = messages.filter(m => m.role === 'user').length;

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ margin: 0, border: 'none', paddingBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaRobot style={{ color: REKT_COLOR }} /> Rekt — AI
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#0d0d0d', padding: '4px 10px', border: `1px solid ${REKT_COLOR}22`, fontSize: '11px', color: '#555' }}>
            💬 {msgCount} msg · 🧠 {otakMemories.length} ingatan
          </div>
          <button onClick={() => setShowSettings(p => !p)}
            style={{ background: showSettings ? '#111' : 'transparent', border: '1px solid #333', color: '#888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px' }}>
            ⚙️ Settings
          </button>
          <button onClick={() => setShowOtakRekt(p => !p)}
            style={{ background: showOtakRekt ? '#0d1a2a' : 'transparent', border: `1px solid ${showOtakRekt ? REKT_COLOR : '#333'}`, color: showOtakRekt ? REKT_COLOR : '#888', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FaBrain size={12} /> otakRekt{otakMemories.length > 0 && <span style={{ background: REKT_COLOR, color: '#000', borderRadius: '9px', padding: '0 5px', fontSize: '10px', fontWeight: 'bold' }}>{otakMemories.length}</span>}
          </button>
        </div>
      </header>
      <Navbar />

      {showSettings && (
        <div style={{ background: '#0d0d1a', border: '1px solid #2a2a5a', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>⚙️ <strong style={{ color: '#aaa' }}>Settings</strong></div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Chat</span>
              <button onClick={clearChat} style={{ fontSize: '12px', padding: '6px 14px', background: '#1a0d0d', border: '1px solid #f44336', color: '#f88', cursor: 'pointer' }}>🗑️ Hapus Semua Chat</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Memori</span>
              <button onClick={() => { if (window.confirm(`Reset semua ${otakMemories.length} memori Rekt?`)) { setOtakMemories([]); saveMemories([]); setOtakMsg('🗑️ Semua memori dihapus'); setTimeout(() => setOtakMsg(''), 3000); } }}
                disabled={otakMemories.length === 0}
                style={{ fontSize: '12px', padding: '6px 14px', background: '#1a0d0d', border: '1px solid #f44336', color: '#f88', cursor: 'pointer', opacity: otakMemories.length === 0 ? 0.4 : 1 }}>
                🧠 Reset Memori Rekt
              </button>
            </div>
          </div>
          <div style={{ marginTop: '12px', padding: '8px 12px', background: '#0a0a14', border: `1px solid ${REKT_COLOR}22`, fontSize: '11px', color: '#555' }}>
            🔒 Rekt berjalan sepenuhnya <strong style={{ color: REKT_COLOR }}>lokal & offline</strong> di browser kamu. Tidak ada data yang dikirim ke server manapun.
          </div>
        </div>
      )}

      {showOtakRekt && (
        <div style={{ background: '#050d14', border: `1px solid ${REKT_COLOR}`, borderLeft: `4px solid ${REKT_COLOR}`, padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaBrain size={18} color={REKT_COLOR} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: REKT_COLOR }}>otakRekt — Adaptive Memory</div>
                <div style={{ fontSize: '11px', color: '#555' }}>
                  {otakMemories.length} ingatan ·{' '}
                  <span style={{ color: `${REKT_COLOR}66` }}>{otakMemories.filter(m => m.id.startsWith('auto_')).length} auto-learned</span>
                  {' '}· makin sering chat, makin pintar! 🧠
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={exportOtakMemory} disabled={otakMemories.length === 0}
                style={{ fontSize: '11px', padding: '5px 12px', background: '#0a1e2a', border: `1px solid ${REKT_COLOR}`, color: REKT_COLOR, cursor: 'pointer', opacity: otakMemories.length === 0 ? 0.4 : 1 }}>⬇️ Export</button>
              <button onClick={() => otakImportRef.current?.click()}
                style={{ fontSize: '11px', padding: '5px 12px', background: '#0a1e0a', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer' }}>⬆️ Import</button>
              <input ref={otakImportRef} type="file" accept=".json" onChange={importOtakMemory} style={{ display: 'none' }} />
            </div>
          </div>

          {otakMsg && (
            <div style={{ padding: '7px 12px', background: otakMsg.startsWith('✅') || otakMsg.startsWith('🧠') ? '#0a1e0a' : '#1a0a0a', border: `1px solid ${otakMsg.startsWith('✅') || otakMsg.startsWith('🧠') ? '#4caf50' : '#f44336'}`, color: otakMsg.startsWith('✅') || otakMsg.startsWith('🧠') ? '#4caf50' : '#f88', fontSize: '12px', marginBottom: '12px' }}>
              {otakMsg}
            </div>
          )}

          <div style={{ background: '#0a1520', border: '1px solid #1a3040', padding: '12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: REKT_COLOR, marginBottom: '8px' }}>{otakEditId ? '✏️ Edit Memory' : '➕ Tambah Memory Baru'}</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <select value={otakCategory} onChange={e => setOtakCategory(e.target.value as OtakRektMemory['category'])}
                style={{ fontSize: '12px', padding: '6px 10px', background: '#0d1e2e', border: '1px solid #1a3a4a', color: REKT_COLOR, cursor: 'pointer', minWidth: '120px' }}>
                <option value="fakta">📌 Fakta</option>
                <option value="preferensi">❤️ Preferensi</option>
                <option value="tujuan">🎯 Tujuan</option>
                <option value="catatan">📝 Catatan</option>
                <option value="lainnya">💡 Lainnya</option>
              </select>
              <input value={otakTags} onChange={e => setOtakTags(e.target.value)} placeholder="tags (pisah koma, opsional)"
                style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: '#0d1e2e', border: '1px solid #1a3a4a', color: '#aaa', minWidth: '120px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea value={otakInput} onChange={e => setOtakInput(e.target.value)}
                placeholder="Tulis hal yang ingin Rekt selalu ingat tentang kamu, tujuanmu, preferensi, dll..."
                rows={3}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addOrUpdateMemory(); } }}
                style={{ flex: 1, fontSize: '12px', padding: '8px 10px', background: '#0d1e2e', border: '1px solid #1a3a4a', color: '#ddd', resize: 'vertical', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={addOrUpdateMemory} disabled={!otakInput.trim()}
                  style={{ padding: '8px 16px', background: otakInput.trim() ? REKT_COLOR : '#0a1e2a', color: otakInput.trim() ? '#000' : '#333', border: 'none', cursor: otakInput.trim() ? 'pointer' : 'default', fontWeight: 'bold', fontSize: '12px' }}>
                  {otakEditId ? 'Update' : 'Simpan'}
                </button>
                {otakEditId && <button onClick={() => { setOtakEditId(null); setOtakInput(''); setOtakTags(''); }}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #333', color: '#666', cursor: 'pointer', fontSize: '11px' }}>Batal</button>}
              </div>
            </div>
            <div style={{ fontSize: '10px', color: '#2a4a5a', marginTop: '5px' }}>Ctrl+Enter untuk simpan cepat · atau cukup ceritakan di chat, Rekt akan belajar otomatis 🧠</div>
          </div>

          {otakMemories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#2a4a5a', fontSize: '12px' }}>
              Belum ada ingatan. Ngobrol dulu sama Rekt — dia akan belajar otomatis! 💬
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={otakSearch} onChange={e => setOtakSearch(e.target.value)} placeholder="🔍 Cari memory..."
                  style={{ flex: 1, fontSize: '12px', padding: '5px 10px', background: '#0d0d0d', border: '1px solid #1a3a4a', color: '#aaa', minWidth: '120px' }} />
                {(['semua','fakta','preferensi','tujuan','catatan','lainnya'] as const).map(cat => (
                  <button key={cat} onClick={() => setOtakFilter(cat)}
                    style={{ fontSize: '10px', padding: '4px 10px', background: otakFilter === cat ? REKT_COLOR : '#0a1520', color: otakFilter === cat ? '#000' : '#555', border: `1px solid ${otakFilter === cat ? REKT_COLOR : '#1a3a4a'}`, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {cat}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                {otakMemories
                  .filter(m => otakFilter === 'semua' || m.category === otakFilter)
                  .filter(m => !otakSearch || m.content.toLowerCase().includes(otakSearch.toLowerCase()) || (m.tags||[]).some(t => t.toLowerCase().includes(otakSearch.toLowerCase())))
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map(m => {
                    const catColors: Record<OtakRektMemory['category'], string> = { fakta: REKT_COLOR, preferensi: '#f472b6', tujuan: '#fb923c', catatan: '#a3e635', lainnya: '#a78bfa' };
                    const catEmoji: Record<OtakRektMemory['category'], string> = { fakta: '📌', preferensi: '❤️', tujuan: '🎯', catatan: '📝', lainnya: '💡' };
                    const c = catColors[m.category];
                    return (
                      <div key={m.id} style={{ background: '#0a1520', border: `1px solid ${c}22`, borderLeft: `3px solid ${c}`, padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10px', padding: '1px 7px', background: `${c}18`, border: `1px solid ${c}44`, color: c }}>{catEmoji[m.category]} {m.category}</span>
                            {m.id.startsWith('auto_') && <span style={{ fontSize: '9px', padding: '1px 6px', background: '#0a1e2a', border: `1px solid ${REKT_COLOR}44`, color: REKT_COLOR }}>🤖 auto</span>}
                            {(m.tags||[]).filter(t=>t!=='auto').map(tag => <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', background: '#0d1e2e', color: '#4a7a9a', border: '1px solid #1a3a4a' }}>#{tag}</span>)}
                            <span style={{ fontSize: '10px', color: '#2a4a5a', marginLeft: 'auto' }}>{new Date(m.updatedAt).toLocaleDateString('id-ID')}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => startEditMemory(m)} style={{ fontSize: '10px', padding: '3px 8px', background: '#0a1e2a', border: '1px solid #1a4a5a', color: REKT_COLOR, cursor: 'pointer' }}>✏️</button>
                          <button onClick={() => deleteMemory(m.id)} style={{ fontSize: '10px', padding: '3px 8px', background: '#1a0a0a', border: '1px solid #3a1a1a', color: '#f44336', cursor: 'pointer' }}>🗑️</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FaLightbulb color="#f3ba2f" size={10} /> Pertanyaan cepat:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p.text} onClick={() => sendMessage(p.text)} disabled={isLoading}
              style={{ fontSize: '12px', padding: '5px 10px', background: '#111', border: '1px solid #2a2a2a', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: isLoading ? 0.5 : 1 }}>
              {p.icon} {p.text}
            </button>
          ))}
        </div>
      </div>

      {(() => {
        const pendingTasks = getPendingTasks();
        const totalOngoing = (() => { try { return (JSON.parse(localStorage.getItem('airdropTasks')||'[]') as Task[]).filter(t=>t.status==='Ongoing').length; } catch { return 0; } })();
        return (
          <div style={{ marginBottom: '12px' }}>
            <button onClick={() => setShowGarapPanel(p => !p)}
              style={{ width: '100%', fontSize: '13px', padding: '10px 16px', background: showGarapPanel ? '#0d1a0d' : '#0a1a0a', border: `1px solid ${showGarapPanel ? '#4caf50' : '#1e3a1e'}`, borderLeft: '4px solid #4caf50', color: '#4caf50', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
              <span style={{ fontSize: '18px' }}>🚀</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>Mode Garap Airdrop</div>
                <div style={{ fontSize: '11px', color: '#2a5a2a' }}>{pendingTasks.length} belum dikerjakan · {totalOngoing} total ongoing</div>
              </div>
              {pendingTasks.length > 0 && <span style={{ background: '#f44336', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>{pendingTasks.length}</span>}
              {showGarapPanel ? <FaChevronUp color="#4caf50" size={12} /> : <FaChevronDown color="#4caf50" size={12} />}
            </button>
            {showGarapPanel && (
              <div style={{ background: '#080f08', border: '1px solid #1e3a1e', borderTop: 'none', padding: '12px' }}>
                {pendingTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#4caf50', fontSize: '13px' }}>✅ Semua airdrop sudah dikerjakan hari ini!</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#4a6a4a', marginBottom: '10px' }}>
                      <span>Klik "Garap" untuk panduan step-by-step:</span>
                      <button onClick={() => sendMessage('Garapin semua airdrop yang belum selesai hari ini satu per satu')} disabled={isLoading}
                        style={{ fontSize: '11px', padding: '4px 10px', background: '#0d2a0d', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer' }}>⚡ Garap Semua</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                      {pendingTasks.map((task, idx) => (
                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0d1a0d', border: '1px solid #1a2a1a', padding: '10px 12px' }}>
                          <span style={{ color: '#555', fontSize: '11px', minWidth: '20px', fontFamily: 'monospace' }}>{idx + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔴 {task.nama}</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10px', color: '#666', background: '#1a1a1a', padding: '1px 6px', border: '1px solid #333' }}>{task.kategori || 'Testnet'}</span>
                              {task.deadline && <span style={{ fontSize: '10px', color: '#ffaa00' }}>⏰ {task.deadline}</span>}
                              {task.estimasiReward ? <span style={{ fontSize: '10px', color: '#4caf50' }}>💰 ~${task.estimasiReward}</span> : null}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            {task.link && task.link !== '#' && (
                              <a href={task.link} target="_blank" rel="noreferrer"
                                style={{ fontSize: '11px', padding: '5px 8px', background: '#111', border: '1px solid #333', color: '#888', textDecoration: 'none' }} title="Buka link">🔗</a>
                            )}
                            <button onClick={() => { setShowGarapPanel(false); sendMessage(`Garap airdrop ${task.nama} link: ${task.link} kategori: ${task.kategori || 'Testnet'}${task.deadline ? ` deadline: ${task.deadline}` : ''}`); }} disabled={isLoading}
                              style={{ fontSize: '11px', padding: '5px 12px', background: '#0d2a0d', border: '1px solid #4caf50', color: '#7fff7f', cursor: 'pointer', fontWeight: 'bold', opacity: isLoading ? 0.5 : 1 }}>
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

      <div style={{ marginBottom: '12px' }}>
        <button onClick={() => setShowImportPanel(p => !p)}
          style={{ width: '100%', fontSize: '13px', padding: '8px 14px', background: showImportPanel ? '#0a0d1a' : 'transparent', border: `1px solid ${showImportPanel ? '#646cff' : '#222'}`, borderLeft: '4px solid #646cff', color: '#646cff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
          <FaFileImport size={13} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 'bold' }}>Import File/Konteks</span>
            <span style={{ fontSize: '11px', color: '#2a2a5a', marginLeft: '8px' }}>{importedContexts.length > 0 ? `${importedContexts.length} aktif` : 'txt, md, csv, json, js, ts, html'}</span>
          </div>
          {showImportPanel ? <FaChevronUp color="#646cff" size={11} /> : <FaChevronDown color="#646cff" size={11} />}
        </button>
        {showImportPanel && (
          <div style={{ background: '#07091a', border: '1px solid #1a1e3a', borderTop: 'none', padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <button onClick={() => fileInputRef.current?.click()} disabled={importLoading}
                style={{ fontSize: '12px', padding: '8px 14px', background: '#0d0d30', border: '1px solid #646cff', color: '#a0a0ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaFileAlt size={12} /> {importLoading ? 'Memuat...' : 'Upload File'}
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.html,.css,.xml" onChange={e => handleFileImport(e.target.files)} style={{ display: 'none' }} />
            </div>
            {importError && <div style={{ color: '#f88', fontSize: '12px', marginBottom: '8px', padding: '6px', background: 'rgba(244,67,54,0.1)', border: '1px solid #f44336' }}>❌ {importError}</div>}
            {importSuccess && <div style={{ color: '#4caf50', fontSize: '12px', marginBottom: '8px' }}>{importSuccess}</div>}
            {importedContexts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {importedContexts.map((ctx, i) => (
                  <div key={i} style={{ background: '#0d1030', border: '1px solid #2a2a5a', padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaFileAlt size={10} color="#646cff" />
                    <span style={{ color: '#a0a0ff' }}>{ctx.name}</span>
                    <span style={{ color: '#444', fontSize: '10px' }}>{(ctx.content.length / 1024).toFixed(1)}KB</span>
                    <button onClick={() => setImportedContexts(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ minHeight: '360px', maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 2px', marginBottom: '10px' }}>
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: '30px', height: '30px', background: REKT_COLOR, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px' }}>
                <FaRobot size={14} color="white" />
              </div>
            )}
            <div style={{ maxWidth: '80%' }}>
              <div style={{ fontSize: '10px', color: '#444', marginBottom: '3px', textAlign: msg.role === 'user' ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && <span style={{ color: REKT_COLOR }}>Rekt</span>}
                <span>{formatTime(msg.timestamp)}</span>
                {msg.role === 'assistant' && (
                  <button onClick={() => navigator.clipboard.writeText(msg.content)} title="Copy pesan"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: '0 2px', fontSize: '11px' }}>
                    <FaRegCopy size={9} />
                  </button>
                )}
              </div>
              <div style={{
                background: msg.role === 'user' ? '#1a1a2e' : '#111',
                border: msg.role === 'user' ? '1px solid #2a2a5a' : `1px solid #222`,
                borderLeft: msg.role === 'assistant' ? `3px solid ${REKT_COLOR}` : undefined,
                padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#ddd',
              }}>
                {renderMarkdown(msg.content)}
              </div>

              {msg.actions && msg.actions.length > 0 && (
                <div style={{ marginTop: '8px', marginLeft: msg.role === 'assistant' ? '38px' : 0, background: '#0a160a', border: '1px solid #1e3a1e', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#4caf50', marginBottom: '4px' }}>⚡ Rekt ingin melakukan {msg.actions.length} aksi:</div>
                  {msg.actions.map((action, aIdx) => {
                    const key = `${msgIdx}-${aIdx}`;
                    const feedback = actionFeedback[key];
                    const actionColor = action.type === 'DELETE' ? '#f44336' : action.type === 'ADD' ? '#4caf50' : '#646cff';
                    return (
                      <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', padding: '2px 7px', fontFamily: 'monospace', background: `${actionColor}15`, border: `1px solid ${actionColor}`, color: actionColor }}>{action.type}</span>
                        <span style={{ fontSize: '12px', color: '#aaa', flex: 1 }}>{action.label}</span>
                        {feedback ? (
                          <span style={{ fontSize: '11px', color: feedback.startsWith('✅') ? '#4caf50' : '#f44336' }}>{feedback}</span>
                        ) : (
                          <button onClick={() => applyAction(msgIdx, aIdx, action)} disabled={action.applied}
                            style={{ fontSize: '11px', padding: '4px 12px', background: action.applied ? '#1a2a1a' : '#0d2a0d', border: `1px solid ${action.applied ? '#2a4a2a' : '#4caf50'}`, color: action.applied ? '#4caf50' : '#7fff7f', cursor: action.applied ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {action.applied ? <><FaCheckCircle size={10} /> Diterapkan</> : '▶ Terapkan'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {msg.actions.some(a => !a.applied) && (
                    <button onClick={() => applyAllActions(msgIdx, msg.actions!)}
                      style={{ marginTop: '4px', fontSize: '12px', padding: '6px 14px', background: '#0d2a0d', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                      <FaCheckCircle size={12} /> Terapkan Semua ({msg.actions.filter(a => !a.applied).length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {(isLoading || streamingText) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', background: REKT_COLOR, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px' }}>
              <FaRobot size={14} color="white" />
            </div>
            <div style={{ maxWidth: '80%' }}>
              <div style={{ fontSize: '10px', color: REKT_COLOR, marginBottom: '3px' }}>Rekt</div>
              <div style={{ background: '#111', border: `1px solid #222`, borderLeft: `3px solid ${REKT_COLOR}`, padding: '12px 16px', fontSize: '13px', lineHeight: '1.6', color: '#ddd' }}>
                {streamingText ? renderMarkdown(streamingText) : (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: '7px', height: '7px', background: REKT_COLOR, borderRadius: '50%', display: 'inline-block', animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                )}
                {streamingText && <span style={{ display: 'inline-block', width: '2px', height: '14px', background: REKT_COLOR, marginLeft: '2px', animation: 'blink 0.7s step-end infinite', verticalAlign: 'middle' }} />}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'flex-end' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={importedContexts.length > 0 ? `Tanya tentang ${importedContexts[0].name}... (Enter kirim)` : `Chat dengan Rekt... (Enter kirim, Shift+Enter baris baru)`}
          disabled={isLoading} rows={2}
          style={{ flex: 1, resize: 'vertical', minHeight: '52px', fontFamily: "'Courier New', monospace", fontSize: '13px', padding: '10px 12px', background: '#0d0d0d', color: '#fff', border: `1px solid ${input.trim() ? REKT_COLOR + '44' : '#222'}`, boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
            style={{ background: REKT_COLOR, color: 'white', border: 'none', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', opacity: (!input.trim() || isLoading) ? 0.5 : 1, fontSize: '13px' }}>
            <FaPaperPlane size={13} /> Kirim
          </button>
          <button onClick={clearChat} style={{ background: 'transparent', color: '#333', border: '1px solid #1a1a1a', padding: '7px 14px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FaTrash size={10} /> Reset
          </button>
        </div>
      </div>

      <div style={{ marginTop: '8px', padding: '7px 12px', background: '#0a0a0a', border: '1px solid #141414', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ color: '#2a2a2a', display: 'flex', alignItems: 'center', gap: '5px' }}>
          🔒 Encrypted Chat By · <span style={{ color: REKT_COLOR + '88' }}>Rekt</span>
          {importedContexts.length > 0 && <span style={{ color: '#646cff' }}>· 📎 {importedContexts.length} konteks</span>}
        </span>
        <button
          onClick={() => { const next = !autoMode; setAutoMode(next); try { localStorage.setItem('rektAutoMode', String(next)); } catch {} }}
          title={autoMode ? 'Rekt aktif ngobrol sendiri — klik untuk matikan' : 'Mode diam — klik untuk aktifkan auto-chat'}
          style={{ background: autoMode ? '#0d1f0d' : '#111', border: `1px solid ${autoMode ? '#4caf50' : '#2a2a2a'}`, color: autoMode ? '#4caf50' : '#444', padding: '3px 9px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '2px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: autoMode ? '#4caf50' : '#444', boxShadow: autoMode ? '0 0 6px #4caf50' : 'none', display: 'inline-block', animation: autoMode ? 'pulse 2s ease-in-out infinite' : 'none' }} />
          {autoMode ? 'Rekt Online' : 'Rekt Diam'}
        </button>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:0.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(-3px)} }
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
