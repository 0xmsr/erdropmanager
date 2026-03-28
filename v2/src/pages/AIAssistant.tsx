import React, { useState, useRef, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { type Task, type Transaction, type PortfolioToken } from '../types';
import { FaRobot, FaPaperPlane, FaTrash, FaLightbulb, FaCheckCircle, FaFileImport, FaLink, FaTimes, FaFileAlt, FaSpinner } from 'react-icons/fa';

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

const GROQ_API_KEY = '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';

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'llama-3.3-70b-versatile',
];

const QUICK_PROMPTS = [
  'Ringkas progress airdrop saya hari ini',
  'Airdrop mana yang mendekati deadline?',
  'Tips strategi airdrop yang efektif',
];

const STORAGE_KEY = 'rektChatHistory';
const MAX_SAVED_MESSAGES = 100;

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Halo! Saya Rekt, asisten AI Erdrop Manager kamu. Saya bisa **mengelola tugas** langsung dari chat!\n\nKamu juga bisa import file atau URL untuk dijadikan skills tambahan!',
  timestamp: Date.now(),
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
      if (filtered.length === before) return { success: false, message: `❌ Tidak ditemukan tugas "${action.payload.nama}"` };
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
      return { success: true, message: `✅ "${action.payload.nama}" ditandai sebagai ${status} hari ini` };
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
          for (let i = 0; i < bytes.length; i++) {
            raw += String.fromCharCode(bytes[i]);
          }
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
          resolve(extracted.trim().slice(0, 15000) || '(Konten PDF tidak dapat diekstrak secara langsung)');
        } catch (e) {
          reject(new Error(`Gagal parse PDF: ${e}`));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file PDF'));
      reader.readAsArrayBuffer(file);
      return;
    }

    reject(new Error(`Format file .${ext} belum didukung. Gunakan: txt, md, json, csv, pdf, js/ts/tsx/html`));
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
      if (data?.contents) {
        return stripHtmlTags(data.contents).slice(0, 15000);
      }
      const text = await res.text();
      return stripHtmlTags(text).slice(0, 15000);
    } catch { continue; }
  }

  throw new Error('Tidak bisa mengambil konten dari URL ini. Pastikan URL valid dan publik.');
};

const stripHtmlTags = (html: string): string => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const AIAssistant: React.FC = () => {
  const [messages, setMessages]       = useState<Message[]>(loadMessages);
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [activeModel, setActiveModel] = useState(GROQ_MODELS[0]);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});
  const [importedContexts, setImportedContexts] = useState<ImportedContext[]>([]);
  const [showImportPanel, setShowImportPanel]   = useState(false);
  const [urlInput, setUrlInput]                 = useState('');
  const [importLoading, setImportLoading]       = useState(false);
  const [importError, setImportError]           = useState('');
  const [importSuccess, setImportSuccess]       = useState('');

  const bottomRef  = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const toSave = messages.slice(-MAX_SAVED_MESSAGES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[Rekt] Gagal menyimpan chat:', e);
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImportError('');
    setImportSuccess('');
    setImportLoading(true);

    const results: ImportedContext[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name}: Ukuran file melebihi 5MB`);
        continue;
      }
      try {
        const content = await extractTextFromFile(file);
        results.push({ name: file.name, content, type: 'file' });
      } catch (e: any) {
        errors.push(`${file.name}: ${e.message}`);
      }
    }

    setImportLoading(false);

    if (results.length > 0) {
      setImportedContexts(prev => {
        const newCtx = [...prev, ...results];
        return newCtx.slice(-5);
      });
      setImportSuccess(`✅ ${results.length} file berhasil diimport!`);
      setTimeout(() => setImportSuccess(''), 3000);
    }
    if (errors.length > 0) {
      setImportError(errors.join('\n'));
    }
  };

  const handleUrlImport = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\/.+/.test(url)) {
      setImportError('URL harus dimulai dengan http:// atau https://');
      return;
    }

    setImportError('');
    setImportSuccess('');
    setImportLoading(true);

    try {
      const content = await fetchUrlContent(url);
      const name = new URL(url).hostname + new URL(url).pathname.slice(0, 30);
      setImportedContexts(prev => [...prev.slice(-4), { name, content, type: 'url' }]);
      setUrlInput('');
      setImportSuccess('✅ Konten URL berhasil diimport!');
      setTimeout(() => setImportSuccess(''), 3000);
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setImportLoading(false);
    }
  };

  const removeContext = (index: number) => {
    setImportedContexts(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileImport(e.dataTransfer.files);
  };

  const getContextData = () => {
    const tasks: Task[]               = JSON.parse(localStorage.getItem('airdropTasks')    || '[]');
    const transactions: Transaction[] = JSON.parse(localStorage.getItem('transactions')    || '[]');
    const portfolio: PortfolioToken[] = JSON.parse(localStorage.getItem('portfolioTokens') || '[]');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ongoingTasks   = tasks.filter(t => t.status === 'Ongoing');
    const completedToday = ongoingTasks.filter(t => t.selesaiHariIni).length;

    const overdueOrSoon = tasks
      .filter(t => {
        if (!t.deadline || t.status === 'END') return false;
        const dl = new Date(t.deadline);
        dl.setHours(0, 0, 0, 0);
        return Math.ceil((dl.getTime() - today.getTime()) / 86400000) <= 7;
      })
      .map(t => {
        const dl   = new Date(t.deadline!);
        dl.setHours(0, 0, 0, 0);
        const diff = Math.ceil((dl.getTime() - today.getTime()) / 86400000);
        return { nama: t.nama, diff };
      });

    const totalIncome  = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    const holdingValue = portfolio.filter(p => p.status === 'holding')
      .reduce((a, p) => a + p.jumlahToken * p.hargaPerToken, 0);

    const taskList = tasks.slice(0, 30).map(t =>
      `id:${t.id} nama:"${t.nama}" status:${t.status} kategori:${t.kategori||'-'} selesai:${t.selesaiHariIni?'Y':'N'}${t.deadline?` dl:${t.deadline}`:''}`
    ).join('\n');

    const importedSection = importedContexts.length > 0
      ? `\n=== KONTEKS TAMBAHAN (${importedContexts.length} item) ===\n` +
        importedContexts.map((ctx, i) =>
          `[${i + 1}] ${ctx.type === 'url' ? '🔗' : '📄'} ${ctx.name}:\n${ctx.content.slice(0, 3000)}${ctx.content.length > 3000 ? '\n...(terpotong)' : ''}`
        ).join('\n\n---\n')
      : '';

    return `
=== DATA ERDROP MANAGER ===
Tanggal: ${today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

AIRDROP: total=${tasks.length} ongoing=${ongoingTasks.length} selesaiHariIni=${completedToday} END=${tasks.filter(t=>t.status==='END').length} waitlist=${tasks.filter(t=>t.status==='Waitlist').length}

DAFTAR TUGAS (max 30):
${taskList || '(kosong)'}

DEADLINE ≤7hr:
${overdueOrSoon.length > 0
  ? overdueOrSoon.map(d => `- ${d.nama}: ${d.diff<0?`LEWAT${Math.abs(d.diff)}hr`:d.diff===0?'HARI INI':`${d.diff}hr`}`).join('\n')
  : 'tidak ada'}

KEUANGAN: income=$${totalIncome.toFixed(2)} expense=$${totalExpense.toFixed(2)} profit=$${(totalIncome-totalExpense).toFixed(2)} txn=${transactions.length}

PORTFOLIO: nilai=$${holdingValue.toFixed(2)} token=${portfolio.filter(p=>p.status==='holding').length}
${portfolio.filter(p=>p.status==='holding').slice(0,8).map(p=>`- ${p.tokenSymbol} ${p.jumlahToken}x$${p.hargaPerToken}=$${(p.jumlahToken*p.hargaPerToken).toFixed(2)}`).join('\n')||'(kosong)'}
=== END ===${importedSection}`;
  };

  const callGroqWithFallback = async (
    apiMessages: { role: string; content: string }[],
    modelList: string[]
  ): Promise<{ text: string; usedModel: string }> => {
    for (let i = 0; i < modelList.length; i++) {
      const model = modelList[i];
      const res   = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model, messages: apiMessages, max_tokens: 1024, temperature: 0.7 }),
      });

      const data = await res.json();

      if (!res.ok) {
        const isRateLimit = res.status === 429 || data?.error?.code === 'rate_limit_exceeded';
        if (isRateLimit && i < modelList.length - 1) {
          console.warn(`[Rekt] ${model} rate-limited, coba ${modelList[i+1]}...`);
          continue;
        }
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }

      const text = data.choices?.[0]?.message?.content || 'Maaf, tidak bisa memproses.';
      return { text, usedModel: model };
    }
    throw new Error('Semua model rate-limited. Tunggu 1 menit lalu coba lagi.');
  };

  const sendMessage = async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: userInput, timestamp: Date.now() };
    const newMessages      = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const systemPrompt = `Kamu adalah asisten AI bernama Rekt untuk Erdrop Manager (manajemen airdrop crypto).
Data pengguna saat ini:
${getContextData()}

=== KEMAMPUAN MANAJEMEN TUGAS ===
Kamu bisa mengelola tugas pengguna. Jika pengguna meminta untuk:
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
- Jika ada konteks tambahan dari file/URL, gunakan informasi tersebut untuk menjawab pertanyaan
- JSON harus valid dan di akhir respons
- Gunakan Bahasa Indonesia santai, emoji boleh, singkat & to the point`;

      const historyMessages = newMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));

      const { text, usedModel } = await callGroqWithFallback(
        [{ role: 'system', content: systemPrompt }, ...historyMessages],
        GROQ_MODELS
      );

      setActiveModel(usedModel);
      const { cleanText, actions } = parseActions(text);

      const assistantMsg: Message = {
        role: 'assistant', content: cleanText, timestamp: Date.now(),
        actions: actions.length > 0 ? actions : undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}`, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyAction = (msgIndex: number, actionIndex: number, action: TaskAction) => {
    const result = applyTaskAction(action);
    const key = `${msgIndex}-${actionIndex}`;
    setActionFeedback(prev => ({ ...prev, [key]: result.message }));
    setMessages(prev => prev.map((msg, mIdx) => {
      if (mIdx !== msgIndex || !msg.actions) return msg;
      const newActions = msg.actions.map((a, aIdx) => aIdx === actionIndex ? { ...a, applied: true } : a);
      return { ...msg, actions: newActions };
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
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const modelColor    = activeModel.includes('70b') ? '#f97316' : '#a855f7';
  const msgCount      = messages.filter(m => m.role === 'user').length;
  const storageUsedKB = (() => {
    try { return (new Blob([localStorage.getItem(STORAGE_KEY) || '']).size / 1024).toFixed(1); }
    catch { return '0'; }
  })();

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
          <FaRobot style={{ marginRight: '10px' }} />Rekt - AI 
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ background: '#0d0d0d', padding: '4px 10px', border: '1px solid #333', fontSize: '11px', color: '#666' }}>
            💾 {msgCount} pesan · {storageUsedKB} KB
          </div>
        </div>
      </header>
      <Navbar />

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaLightbulb color="#f3ba2f" /> Pertanyaan & perintah cepat:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p} onClick={() => sendMessage(p)} disabled={isLoading} style={{
              fontSize: '12px', padding: '6px 12px', background: '#1a1a1a',
              border: '1px solid #444', color: '#ccc', cursor: 'pointer',
              textTransform: 'none', fontWeight: 'normal', letterSpacing: '0', minHeight: '34px',
            }}>{p}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setShowImportPanel(p => !p)}
          style={{
            fontSize: '12px', padding: '7px 14px',
            background: showImportPanel ? '#1a1a3a' : '#111',
            border: `1px solid ${showImportPanel ? '#646cff' : '#444'}`,
            color: showImportPanel ? '#a0a0ff' : '#888',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <FaFileImport size={12} />
          Import Konteks/Skills
          {importedContexts.length > 0 && (
            <span style={{
              background: '#646cff', color: '#fff',
              borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold',
            }}>{importedContexts.length}</span>
          )}
        </button>

        {showImportPanel && (
          <div style={{
            marginTop: '10px', background: '#0d0d1a',
            border: '1px solid #2a2a5a', padding: '16px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FaFileAlt size={11} /> Import dari File
                </div>
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #333', padding: '20px',
                    textAlign: 'center', cursor: 'pointer', fontSize: '12px',
                    color: '#666', transition: 'border-color 0.2s',
                    background: '#0a0a1a',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#646cff')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}
                >
                  {importLoading
                    ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Membaca file...</>
                    : <>📂 Drag & drop file atau klik<br />
                      <span style={{ fontSize: '11px', color: '#555' }}>txt, md, json, csv, pdf, js/ts/tsx</span>
                    </>}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.json,.csv,.pdf,.js,.ts,.tsx,.jsx,.html,.css,.xml"
                  style={{ display: 'none' }}
                  onChange={e => handleFileImport(e.target.files)}
                />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FaLink size={11} /> Import dari URL
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="url"
                    placeholder="https://example.com/article"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#0a0a1a', color: '#fff',
                      border: '1px solid #333', padding: '8px 10px',
                      fontSize: '12px',
                    }}
                  />
                  <button
                    onClick={handleUrlImport}
                    disabled={importLoading || !urlInput.trim()}
                    style={{
                      background: '#1a1a3a', border: '1px solid #646cff',
                      color: '#a0a0ff', padding: '8px 12px', cursor: 'pointer',
                      fontSize: '12px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '6px',
                      opacity: importLoading || !urlInput.trim() ? 0.5 : 1,
                    }}
                  >
                    {importLoading
                      ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Memuat...</>
                      : <><FaLink size={11} /> Fetch URL</>}
                  </button>
                  <p style={{ fontSize: '10px', color: '#ffffff', margin: 0 }}>
                    Ambil konten teks dari halaman web, artikel, docs, dll.
                  </p>
                  
                </div>
              </div>
              <p style={{ fontSize: '13px', color: '#ffffff', margin: 0 }}>Kamu bisa mendownloads skills secara gratis di <a style={{ fontSize: '13px', color: '#ce4403', margin: 0 }} href='https://clawhub.ai/skills?sort=downloads'>https://clawhub.ai</a></p>
            </div>

            {importError && (
              <div style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid #f44336', padding: '8px 12px', fontSize: '12px', color: '#f88', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
                ❌ {importError}
              </div>
            )}
            {importSuccess && (
              <div style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid #4caf50', padding: '8px 12px', fontSize: '12px', color: '#8f8', marginBottom: '10px' }}>
                {importSuccess}
              </div>
            )}

            {importedContexts.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
                  Konteks/Skills aktif ({importedContexts.length}/5):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {importedContexts.map((ctx, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#111', border: '1px solid #222', padding: '8px 10px',
                    }}>
                      <span style={{ fontSize: '14px' }}>{ctx.type === 'url' ? '🔗' : '📄'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ctx.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#555' }}>
                          {ctx.content.length.toLocaleString()} karakter
                        </div>
                      </div>
                      <button
                        onClick={() => removeContext(i)}
                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px', fontSize: '13px' }}
                        title="Hapus konteks/skills"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setImportedContexts([])}
                  style={{
                    marginTop: '8px', fontSize: '11px', color: '#555',
                    background: 'none', border: '1px solid #222', padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Hapus Semua Konteks/Skills
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        background: '#0d0d0d', border: '1px solid #333', height: '480px',
        overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx}>
            <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: '28px', height: '28px', background: modelColor, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginRight: '8px', marginTop: '4px',
                }}>
                  <FaRobot size={14} color="white" />
                </div>
              )}
              <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  background: msg.role === 'user' ? '#1e1e3f' : '#1a1a1a',
                  border: `1px solid ${msg.role === 'user' ? '#646cff55' : '#333'}`,
                  padding: '12px 16px', fontSize: '14px', lineHeight: '1.6', color: '#ddd',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                {msg.timestamp && (
                  <span style={{ fontSize: '10px', color: '#444', marginTop: '3px', paddingLeft: '2px' }}>
                    {formatTime(msg.timestamp)}
                  </span>
                )}
              </div>
            </div>

            {msg.actions && msg.actions.length > 0 && (
              <div style={{
                marginTop: '8px', marginLeft: '36px',
                background: '#0d1a0d', border: '1px solid #2a4a2a',
                padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ fontSize: '11px', color: '#4caf50', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ Rekt ingin melakukan {msg.actions.length} aksi pada tugas:
                </div>
                {msg.actions.map((action, aIdx) => {
                  const key = `${msgIdx}-${aIdx}`;
                  const feedback = actionFeedback[key];
                  return (
                    <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px',
                        background: action.type === 'DELETE' ? '#3a1a1a' : action.type === 'ADD' ? '#1a2a1a' : '#1a1a2a',
                        border: `1px solid ${action.type === 'DELETE' ? '#f44336' : action.type === 'ADD' ? '#4caf50' : '#646cff'}`,
                        color: action.type === 'DELETE' ? '#f44336' : action.type === 'ADD' ? '#4caf50' : '#a0a0ff',
                        fontFamily: 'monospace',
                      }}>
                        {action.type}
                      </span>
                      <span style={{ fontSize: '12px', color: '#bbb', flex: 1 }}>{action.label}</span>
                      {feedback ? (
                        <span style={{ fontSize: '11px', color: feedback.startsWith('✅') ? '#4caf50' : '#f44336' }}>
                          {feedback}
                        </span>
                      ) : (
                        <button
                          onClick={() => applyAction(msgIdx, aIdx, action)}
                          disabled={action.applied}
                          style={{
                            fontSize: '11px', padding: '4px 12px',
                            background: action.applied ? '#1a2a1a' : '#1a3a1a',
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
                  <button
                    onClick={() => applyAllActions(msgIdx, msg.actions!)}
                    style={{
                      marginTop: '4px', fontSize: '12px', padding: '6px 16px',
                      background: '#1a3a1a', border: '1px solid #4caf50',
                      color: '#4caf50', cursor: 'pointer', alignSelf: 'flex-start',
                      display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold',
                    }}
                  >
                    <FaCheckCircle size={12} /> Terapkan Semua ({msg.actions.filter(a => !a.applied).length})
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', background: modelColor, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FaRobot size={14} color="white" />
            </div>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', padding: '12px 20px', display: 'flex', gap: '6px' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: '7px', height: '7px', background: modelColor, borderRadius: '50%',
                  display: 'inline-block', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'flex-end' }}>
        <textarea
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={importedContexts.length > 0 ? `Tanya tentang ${importedContexts[0].name}...` : 'Tanya sesuatu atau perintahkan Rekt...'}
          disabled={isLoading} rows={2}
          style={{
            flex: 1, resize: 'vertical', minHeight: '48px', fontFamily: "'Courier New', monospace",
            fontSize: '14px', padding: '10px', background: '#111', color: '#fff',
            border: '1px solid #444', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            style={{
              background: '#646cff', color: 'white', border: 'none', padding: '10px 16px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              opacity: (isLoading || !input.trim()) ? 0.5 : 1,
            }}
          >
            <FaPaperPlane size={14} /> Kirim
          </button>
          <button
            onClick={clearChat}
            style={{
              background: 'transparent', color: '#555', border: '1px solid #2a2a2a',
              padding: '8px 16px', cursor: 'pointer', fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <FaTrash size={12} /> Reset
          </button>
        </div>
      </div>

      <div style={{
        marginTop: '10px', padding: '8px 12px',
        background: '#0d0d0d', border: '1px solid #1e1e1e',
        fontSize: '11px', color: '#555',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: '#3a3a6a' }}>
          {importedContexts.length > 0 ? `📎 ${importedContexts.length} konteks aktif` : '·'}
        </span>
        <span style={{ color: '#333' }}>maks {MAX_SAVED_MESSAGES} pesan</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50%       { opacity: 1;   transform: translateY(-3px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <footer className="app-footer" style={{ marginTop: '30px', textAlign: 'center', color: '#666', fontSize: '0.8em' }}>
        Powered by IAC Community
      </footer>
    </div>
  );
};