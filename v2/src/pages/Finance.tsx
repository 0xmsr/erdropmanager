import React, { useState, useEffect, useMemo} from 'react';
import { type Transaction } from '../types';
import { Navbar } from '../components/Navbar';
import { CustomAlert, CustomConfirm } from '../components/CustomModals';
import { DEFAULT_CURRENCY_CONFIG, type CurrencyConfigType } from '../curenncy';
import { 
    FaWallet, 
    FaArrowUp, 
    FaArrowDown, 
    FaTrash, 
    FaPlus, 
    FaSearch, 
    FaChartLine,
    FaInfoCircle,
    FaChartPie,
    FaFileExport,
    FaExchangeAlt,
    FaSync,
    FaChevronDown,
    FaEdit,
    FaTimes,
    FaCalendarAlt,
    FaTrophy,
    FaCopy,
    FaFire,
    FaCode,
    FaDownload,
    FaUpload
} from 'react-icons/fa';

import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement,
  BarElement
);

const CANDLE_UP = '#33ff33';
const CANDLE_DOWN = '#ff3333';
const CANDLE_FLAT = '#888888';

const candleWickPlugin = {
  id: 'candleWick',
  beforeDatasetsDraw(chart: any) {
    const ds = chart.data.datasets[0];
    if (!ds || !ds.highs) return;
    const meta = chart.getDatasetMeta(0);
    const yScale = chart.scales.y;
    const ctx = chart.ctx;
    ctx.save();
    ctx.lineWidth = 1.5;
    meta.data.forEach((bar: any, i: number) => {
      ctx.strokeStyle = ds.wickColors[i];
      ctx.beginPath();
      ctx.moveTo(bar.x, yScale.getPixelForValue(ds.highs[i]));
      ctx.lineTo(bar.x, yScale.getPixelForValue(ds.lows[i]));
      ctx.stroke();
    });
    ctx.restore();
  }
};

const PAGE_SIZE = 10;
type ValidateResult = { ok: true; data: Transaction[] } | { ok: false; error: string };

// Validasi & normalisasi JSON hasil edit/import sebelum menimpa data transaksi.
const validateTransactions = (input: unknown): ValidateResult => {
  if (!Array.isArray(input)) return { ok: false, error: 'JSON harus berupa array transaksi, contoh: [ { ... }, { ... } ].' };

  const ids = new Set<number>();
  const data: Transaction[] = [];

  for (let i = 0; i < input.length; i++) {
    const item = input[i] as Record<string, unknown> | null;
    const no = i + 1;
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: `Item #${no}: harus berupa object.` };

    const { id, desc, amount, type, network, date } = item;
    if (typeof id !== 'number' || !Number.isFinite(id)) return { ok: false, error: `Item #${no}: "id" harus berupa angka.` };
    if (ids.has(id)) return { ok: false, error: `Item #${no}: "id" ${id} duplikat.` };
    if (typeof desc !== 'string' || desc.trim() === '') return { ok: false, error: `Item #${no}: "desc" harus berupa teks dan tidak boleh kosong.` };
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return { ok: false, error: `Item #${no}: "amount" harus angka lebih dari 0.` };
    if (type !== 'income' && type !== 'expense') return { ok: false, error: `Item #${no}: "type" harus "income" atau "expense".` };
    if (typeof network !== 'string' || network.trim() === '') return { ok: false, error: `Item #${no}: "network" harus berupa teks dan tidak boleh kosong.` };

    let safeDate = typeof date === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date) ? date : '';
    if (!safeDate) {
      const d = new Date(id);
      safeDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    ids.add(id);
    data.push({ ...(item as object), id, desc, amount, type, network, date: safeDate } as Transaction);
  }
  return { ok: true, data };
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Tanggal transaksi disimpan sebagai "dd/mm/yyyy"; fallback ke id (timestamp) jika formatnya tidak cocok.
const parseTxDate = (tx: Transaction): Date => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(tx.date || '');
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(tx.id);
};
const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const toInputDate = (d: Date) => `${toMonthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
const formatMonthKey = (key: string) => `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
const prevMonthKey = (key: string) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

const NETWORK_COLORS: { n: string; c: string }[] = [
  {n: 'BTC', c: '#F7931A'}, {n: 'SOL', c: '#9945FF'}, {n: 'ETH', c: '#627eea'},
  {n: 'OP', c: '#FF0420'}, {n: 'BASE', c: '#0052ff'}, {n: 'BSC', c: '#F3BA2F'},
  {n: 'MATIC', c: '#8247e5'}, {n: 'ARB', c: '#28a0f0'}, {n: 'APT', c: '#2ed3b9'},
  {n: 'SUI', c: '#6fbcf0'}, {n: 'NEAR', c: '#2ED3B7'}, {n: 'LINEA', c: '#FFFFFF'},
  {n: 'MON', c: '#7645D9'}, {n: 'INK', c: '#7037FF'}, {n: 'OCTRA', c: '#0000FF'},
  {n: 'AVAX', c: '#E84142'}, {n: 'PHAROS', c: '#0000D7'}, {n: 'GRAM', c: '#4DB5FF'},
  {n: 'CANTON', c: '#F5FF9E'},
];

const AnimatedMoney = ({ value, currency, config }: { value: number, currency: 'USD' | 'IDR' | 'BTC' | 'ETH', config: CurrencyConfigType }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const displayValueRef = React.useRef(0);
    const currentConfig = config[currency];
    const targetValue = value * currentConfig.rate;
    
    useEffect(() => {
        let startTimestamp: number | null = null;
        const duration = 1000;
        const startValue = displayValueRef.current;
        
        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            
            const current = startValue + (targetValue - startValue) * easeProgress;
            displayValueRef.current = current;
            setDisplayValue(current);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        
        window.requestAnimationFrame(step);
    }, [targetValue]);

    let formatted = '';
    if (currentConfig.code === 'IDR') {
        formatted = displayValue.toLocaleString('id-ID', { maximumFractionDigits: 0 });
    } else if (currentConfig.code === 'BTC') {
        formatted = displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    } else if (currentConfig.code === 'ETH') {
        formatted = displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 18 });
    } else {
        formatted = displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    return <span style={{ fontFamily: 'monospace' }}>{currentConfig.symbol} {formatted}</span>;
};

export const Finance: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [form, setForm] = useState({ desc: '', amount: '', type: 'income', network: '' });
  const [networkFilter, setNetworkFilter] = useState('');
  const [colorSearch, setColorSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [sortBy, setSortBy] = useState<'oldest' | 'newest' | 'highest' | 'lowest'>('oldest');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [growthMode, setGrowthMode] = useState<'line' | 'candle'>('line');
  const [monthFilter, setMonthFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [rawDraft, setRawDraft] = useState('');
  const [rawError, setRawError] = useState('');
  const [allocationMode, setAllocationMode] = useState<'net' | 'volume'>('net');
  
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfigType>(DEFAULT_CURRENCY_CONFIG);
  const [currency, setCurrency] = useState<'USD' | 'IDR' | 'BTC' | 'ETH'>('USD');
  const [isLoadingRate, setIsLoadingRate] = useState(false);

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

useEffect(() => {
    const fetchRates = async () => {
        setIsLoadingRate(true);
        try {
            const [fiatResponse, cryptoResponse] = await Promise.all([
                fetch('https://api.exchangerate-api.com/v4/latest/USD'),
                fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd')
            ]);

            const fiatData = await fiatResponse.json();
            const cryptoData = await cryptoResponse.json();
            
            setCurrencyConfig(prev => {
                let newIdrRate = prev.IDR.rate;
                let newBtcRate = prev.BTC.rate;
                let newEthRate = prev.ETH.rate;

                if (fiatData?.rates?.IDR) newIdrRate = fiatData.rates.IDR;
                if (cryptoData?.bitcoin?.usd) newBtcRate = 1 / cryptoData.bitcoin.usd;
                if (cryptoData?.ethereum?.usd) newEthRate = 1 / cryptoData.ethereum.usd;

                return {
                    ...prev,
                    IDR: { ...prev.IDR, rate: newIdrRate },
                    BTC: { ...prev.BTC, rate: newBtcRate },
                    ETH: { ...prev.ETH, rate: newEthRate }
                };
            });
        } catch (error) {
            console.error("Gagal mengambil kurs mata uang", error);
        } finally {
            setIsLoadingRate(false);
        }
    };
    fetchRates();
}, []);

  const getNetworkColor = (network: string) => {
    const net = network.toLowerCase();
    if (net.includes('bitcoin') || net.includes('btc')) return '#F7931A';
    if (net.includes('solana') || net.includes('sol')) return '#9945FF';
    if (net.includes('ethereum') || net.includes('eth')) return '#627eea';
    if (net.includes('optimism') || net.includes('op')) return '#FF0420';
    if (net.includes('base')) return '#0052ff';
    if (net.includes('bsc') || net.includes('bnb')) return '#F3BA2F';
    if (net.includes('polygon') || net.includes('pol') || net.includes('matic')) return '#8247e5';
    if (net.includes('arbitrum') || net.includes('arb')) return '#28a0f0';
    if (net.includes('aptos') || net.includes('apt')) return '#2ed3b9';
    if (net.includes('sui')) return '#6fbcf0';
    if (net.includes('near')) return '#2ED3B7';
    if (net.includes('linea')) return '#ffffff';
    if (net.includes('monad') || net.includes('mon')) return '#7645D9';
    if (net.includes('ink')) return '#7037FF';
    if (net.includes('octra')) return '#0000FF';
    if (net.includes('avax')) return '#E84142';
    if (net.includes('pharos') || net.includes('pros')) return '#0000D7';
    if (net.includes('canton') || net === 'cc') return '#F5FF9E';
    if (net === 'ton' || net.includes('gram')) return '#4DB5FF';
    return '#ffffff';
  };

  const formatStaticMoney = (amount: number) => {
    const { symbol, rate, code } = currencyConfig[currency];
    const value = amount * rate;
    
    if (code === 'IDR') {
      return `${symbol} ${value.toLocaleString('id-ID')}`;
    } else if (code === 'BTC') {
      return `${symbol} ${value.toFixed(8)}`;
    } else if (code === 'ETH') {
      return `${symbol} ${value.toFixed(18)}`;
    } else {
      return `${symbol}${value.toLocaleString('en-US')}`;
    }
  };

  const showAlert = (msg: string, type: 'success' | 'error' | 'hapus' | 'info' = 'info') => {
    setAlertData({ isOpen: true, msg, type });
  };

  const showConfirm = (title: string, message: string, action: () => void) => {
    setConfirmData({ isOpen: true, title, message, onConfirmAction: action });
  };

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Filter network + tipe (tanpa filter periode) -> dipakai juga untuk perbandingan antar bulan.
  const baseFiltered = useMemo(() => {
    return transactions.filter(t =>
      (networkFilter === '' || t.network.toLowerCase().includes(networkFilter.toLowerCase())) &&
      (typeFilter === 'all' || t.type === typeFilter)
    );
  }, [transactions, networkFilter, typeFilter]);

  const monthOptions = useMemo(() => {
    const keys = new Set(transactions.map(t => toMonthKey(parseTxDate(t))));
    return Array.from(keys).sort().reverse();
  }, [transactions]);

  const monthlyNet = useMemo(() => {
    const map: Record<string, number> = {};
    baseFiltered.forEach(t => {
      const key = toMonthKey(parseTxDate(t));
      map[key] = (map[key] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    });
    return map;
  }, [baseFiltered]);

  const filteredTransactions = useMemo(() => {
    const result = baseFiltered.filter(t => {
      if (!monthFilter && !dateFrom && !dateTo) return true;
      const d = parseTxDate(t);
      if (monthFilter && toMonthKey(d) !== monthFilter) return false;
      const day = toInputDate(d);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
    switch (sortBy) {
      case 'newest': return result.sort((a, b) => b.id - a.id);
      case 'highest': return result.sort((a, b) => b.amount - a.amount);
      case 'lowest': return result.sort((a, b) => a.amount - b.amount);
      default: return result.sort((a, b) => a.id - b.id);
    }
  }, [baseFiltered, monthFilter, dateFrom, dateTo, sortBy]);

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [networkFilter, typeFilter, sortBy, monthFilter, dateFrom, dateTo]);

  const rawJson = useMemo(() => JSON.stringify(transactions, null, 2), [transactions]);

  useEffect(() => {
    setRawDraft(rawJson);
    setRawError('');
  }, [rawJson]);

  const filteredSummary = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expense };
  }, [filteredTransactions]);

  const networkStats = useMemo(() => {
    const map: Record<string, { income: number; expense: number; count: number }> = {};
    transactions.forEach(t => {
      const net = t.network.toUpperCase();
      if (!map[net]) map[net] = { income: 0, expense: 0, count: 0 };
      map[net].count += 1;
      if (t.type === 'income') map[net].income += t.amount;
      else map[net].expense += t.amount;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [transactions]);

  const roiRows = useMemo(() => {
    const withCapital = networkStats
      .filter(n => n.expense > 0)
      .map(n => ({ ...n, profit: n.income - n.expense, roi: ((n.income - n.expense) / n.expense) * 100 }))
      .sort((a, b) => b.roi - a.roi);
    const noCapital = networkStats.filter(n => n.expense === 0 && n.income > 0).sort((a, b) => b.income - a.income);
    const maxAbs = withCapital.reduce((acc, r) => Math.max(acc, Math.abs(r.roi)), 0);
    return { withCapital, noCapital, maxAbs };
  }, [networkStats]);

  // Aktivitas harian: heatmap 16 minggu terakhir + streak hari berturut-turut.
  const activity = useMemo(() => {
    const WEEKS = 16;
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      const key = toInputDate(parseTxDate(t));
      counts[key] = (counts[key] || 0) + 1;
    });

    const dayNum = (key: string) => {
      const [y, m, d] = key.split('-').map(Number);
      return Math.round(Date.UTC(y, m - 1, d) / 86400000);
    };
    const nums = Object.keys(counts).map(dayNum).sort((a, b) => a - b);

    let longest = 0;
    let run = 0;
    nums.forEach((n, i) => {
      run = i > 0 && n === nums[i - 1] + 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    });

    const today = new Date();
    const todayNum = dayNum(toInputDate(today));
    const daySet = new Set(nums);
    let cursor = daySet.has(todayNum) ? todayNum : todayNum - 1;
    let current = 0;
    while (daySet.has(cursor)) {
      current += 1;
      cursor -= 1;
    }

    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((WEEKS - 1) * 7 + today.getDay()));
    const cells: { key: string; label: string; count: number; future: boolean }[] = [];
    let max = 0;
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = toInputDate(d);
      const count = counts[key] || 0;
      max = Math.max(max, count);
      cells.push({
        key,
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
        count,
        future: d > today
      });
    }

    return { cells, max, current, longest, activeDays: nums.length };
  }, [transactions]);

  const stats = useMemo(() => {
    const inc = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const exp = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    
    const counts: Record<string, number> = {};
    const volumes: Record<string, number> = {};

    transactions.forEach(t => {
      const net = t.network.toUpperCase();
      counts[net] = (counts[net] || 0) + 1;
      volumes[net] = (volumes[net] || 0) + t.amount;
    });

    const mostFrequent = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const highestVolume = Object.entries(volumes).sort((a, b) => b[1] - a[1])[0];
    
    return { 
      totalIncome: inc, 
      totalExpense: exp, 
      topFreq: mostFrequent ? { name: mostFrequent[0], count: mostFrequent[1] } : null,
      topVol: highestVolume ? { name: highestVolume[0], volume: highestVolume[1] } : null
    };
  }, [transactions]);

  const currentRate = currencyConfig[currency].rate;

  const doughnutData = useMemo(() => {
    const networkData: Record<string, number> = {};
    
    transactions.forEach(t => {
        const net = t.network.toUpperCase();
        const value = t.amount * currentRate;
        
        if (allocationMode === 'net') {
            const modifier = t.type === 'income' ? 1 : -1;
            networkData[net] = (networkData[net] || 0) + (value * modifier);
        } else {
            networkData[net] = (networkData[net] || 0) + value;
        }
    });
    const labels = Object.keys(networkData).filter(label => networkData[label] > 0);
    const dataValues = labels.map(label => networkData[label]);
    const bgColors = labels.map(label => getNetworkColor(label));
    
    return {
        labels,
        datasets: [{
            label: allocationMode === 'net' ? `Assets (${currency})` : `Volume (${currency})`,
            data: dataValues,
            backgroundColor: bgColors,
            borderColor: '#111',
            borderWidth: 2,
        }]
    };
  }, [transactions, currentRate, currency, allocationMode]);

  const allocationDetails = useMemo(() => {
    const map: Record<string, { income: number; expense: number; count: number }> = {};
    transactions.forEach(t => {
      const net = t.network.toUpperCase();
      if (!map[net]) map[net] = { income: 0, expense: 0, count: 0 };
      map[net].count += 1;
      if (t.type === 'income') map[net].income += t.amount;
      else map[net].expense += t.amount;
    });

    const rows = Object.entries(map).map(([name, v]) => ({
      name,
      ...v,
      net: v.income - v.expense,
      volume: v.income + v.expense,
    }));
    const valueOf = (r: { net: number; volume: number }) => allocationMode === 'net' ? r.net : r.volume;

    const positive = rows.filter(r => valueOf(r) > 0).sort((a, b) => valueOf(b) - valueOf(a));
    const deficit = rows.filter(r => valueOf(r) <= 0).sort((a, b) => valueOf(a) - valueOf(b));
    const total = positive.reduce((acc, r) => acc + valueOf(r), 0);

    return {
      total,
      positive: positive.map(r => ({ ...r, value: valueOf(r), pct: total > 0 ? (valueOf(r) / total) * 100 : 0 })),
      deficit: deficit.map(r => ({ ...r, value: valueOf(r) })),
    };
  }, [transactions, allocationMode]);

  const lineChartData = useMemo(() => {
    const sortedTx = [...transactions].sort((a, b) => a.id - b.id);
    
    let currentBalance = 0;
    const labels: string[] = [];
    const dataPoints: number[] = [];
    labels.push('Start');
    dataPoints.push(0);

    sortedTx.forEach(tx => {
        if (tx.type === 'income') {
            currentBalance += tx.amount;
        } else {
            currentBalance -= tx.amount;
        }
        const dateObj = new Date(tx.id); 
        const dateLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
        
        labels.push(dateLabel);
        dataPoints.push(currentBalance * currentRate);
    });

    return {
        labels,
        datasets: [
            {
                label: `Balance History (${currency})`,
                data: dataPoints,
                borderColor: currency === 'BTC' ? '#F7931A' : (currency === 'ETH' ? '#627eea' : '#01a2ff'),
                backgroundColor: currency === 'BTC' 
            ? 'rgba(247, 147, 26, 0.2)' 
            : (currency === 'ETH' ? 'rgba(98, 126, 234, 0.2)' : 'rgba(1, 162, 255, 0.2)'),
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#fff'
            }
        ]
    };
  }, [transactions, currentRate, currency]);

  const candleChart = useMemo(() => {
    const sortedTx = [...transactions].sort((a, b) => a.id - b.id);
    const labels: string[] = [];
    const bodies: [number, number][] = [];
    const opens: number[] = [];
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const colors: string[] = [];

    let balance = 0;
    let currentDay = '';
    let open = 0, high = 0, low = 0;

    const pushCandle = (close: number) => {
      const o = open * currentRate;
      const c = close * currentRate;
      opens.push(o);
      closes.push(c);
      highs.push(high * currentRate);
      lows.push(low * currentRate);
      bodies.push([Math.min(o, c), Math.max(o, c)]);
      colors.push(c > o ? CANDLE_UP : c < o ? CANDLE_DOWN : CANDLE_FLAT);
    };

    sortedTx.forEach(tx => {
      const d = new Date(tx.id);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (dayKey !== currentDay) {
        if (currentDay !== '') pushCandle(balance);
        currentDay = dayKey;
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        open = balance;
        high = balance;
        low = balance;
      }
      balance += tx.type === 'income' ? tx.amount : -tx.amount;
      high = Math.max(high, balance);
      low = Math.min(low, balance);
    });
    if (currentDay !== '') pushCandle(balance);

    const rawMin = lows.length ? Math.min(...lows) : 0;
    const rawMax = highs.length ? Math.max(...highs) : 1;
    const pad = (rawMax - rawMin) * 0.1 || Math.abs(rawMax) * 0.1 || 1;

    return {
      min: rawMin - pad,
      max: rawMax + pad,
      opens, closes, highs, lows,
      data: {
        labels,
        datasets: [{
          label: `Balance Candle (${currency})`,
          data: bodies,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
          borderSkipped: false as const,
          barPercentage: 0.6,
          categoryPercentage: 0.9,
          highs,
          lows,
          wickColors: colors
        }]
      }
    };
  }, [transactions, currentRate, currency]);

  const doughnutOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
          legend: {
              position: 'right' as const,
              labels: { color: '#ccc', font: { family: 'monospace', size: 10 }, boxWidth: 10 }
          },
          tooltip: {
            callbacks: {
                label: (context: any) => {
                    let label = context.label || '';
                    if (label) label += ': ';
                    if (context.parsed !== null) {
                        const val = context.parsed;
                        if (currency === 'IDR') {
                            label += `Rp ${val.toLocaleString('id-ID')}`;
                        } else if (currency === 'BTC') {
                            label += `₿ ${val.toFixed(8)}`;
                        } else if (currency === 'ETH') {
                            label += `♦ ${val.toFixed(8)}`;
                        } else {
                            label += `$${val.toLocaleString('en-US')}`;
                        }
                    }
                    return label;
                }
            }
          }
      }
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            mode: 'index' as const,
            intersect: false,
            callbacks: {
                label: (context: any) => {
                    const val = context.parsed.y;
                    if (currency === 'IDR') {
                        return ` Balance: Rp ${val.toLocaleString('id-ID')}`;
                    } else if (currency === 'BTC') {
                        return ` Balance: ₿ ${val.toFixed(8)}`;
                    } else if (currency === 'ETH') {
                        return ` Balance: ♦ ${val.toFixed(18)}`;
                    } else {
                        return ` Balance: $${val.toLocaleString('en-US')}`;
                    }
                }
            }
        }
    },
    scales: {
        x: {
            grid: { display: false, color: '#333' },
            ticks: { color: '#888', font: { size: 10 } }
        },
        y: {
            grid: { color: '#222' },
            ticks: { 
                color: '#888', 
                callback: (value: any) => {
                    if (currency === 'IDR') {
                         if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'M';
                         if (value >= 1000000) return (value / 1000000).toFixed(1) + 'jt';
                         return value;
                    }
                    if (currency === 'BTC') {
                        return '₿ ' + parseFloat(value).toFixed(4);
                    }
                    if (currency === 'ETH') {
                        return '♦ ' + parseFloat(value).toFixed(4);
                    }
                    return '$' + value;
                }
            }
        }
    }
  };

  const formatCandleValue = (val: number) => {
    if (currency === 'IDR') return `Rp ${val.toLocaleString('id-ID')}`;
    if (currency === 'BTC') return `₿ ${val.toFixed(8)}`;
    if (currency === 'ETH') return `♦ ${val.toFixed(8)}`;
    return `$${val.toLocaleString('en-US')}`;
  };

  const candleOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: (context: any) => {
                    const i = context.dataIndex;
                    return [
                        ` Open:  ${formatCandleValue(candleChart.opens[i])}`,
                        ` High:  ${formatCandleValue(candleChart.highs[i])}`,
                        ` Low:   ${formatCandleValue(candleChart.lows[i])}`,
                        ` Close: ${formatCandleValue(candleChart.closes[i])}`
                    ];
                }
            }
        }
    },
    scales: {
        x: lineOptions.scales.x,
        y: { ...lineOptions.scales.y, min: candleChart.min, max: candleChart.max, beginAtZero: false }
    }
  };

  const netBalance = stats.totalIncome - stats.totalExpense;
  const expenseRatio = stats.totalIncome > 0 ? (stats.totalExpense / stats.totalIncome) * 100 : (stats.totalExpense > 0 ? 100 : 0);

  const filterSelectStyle: React.CSSProperties = {
    backgroundColor: '#111',
    color: '#fff',
    border: '1px solid #444',
    padding: '0 10px',
    height: '42px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.85em',
    fontWeight: 'bold',
    outline: 'none'
  };

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.desc || !form.amount || !form.network) {
      showAlert('Mohon lengkapi semua data transaksi!', 'error');
      return;
    }

    const amountVal = parseFloat(form.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showAlert('Jumlah transaksi harus lebih dari 0!', 'error');
      return;
    }

    if (editingId !== null) {
      setTransactions(prev => prev.map(t => t.id === editingId
        ? { ...t, desc: form.desc, amount: amountVal, type: form.type as 'income' | 'expense', network: form.network }
        : t
      ));
      setEditingId(null);
      setForm({ desc: '', amount: '', type: 'income', network: '' });
      showAlert('Transaksi berhasil diperbarui.', 'success');
      return;
    }

    const now = new Date();
    const newTx: Transaction = {
      id: Date.now(),
      desc: form.desc,
      amount: amountVal, 
      type: form.type as 'income' | 'expense',
      network: form.network,
      date: `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
    };

    setTransactions([...transactions, newTx]);
    setForm({ desc: '', amount: '', type: 'income', network: '' });
    showAlert('Transaksi berhasil disimpan.', 'success');
  };

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setForm({ desc: tx.desc, amount: String(tx.amount), type: tx.type, network: tx.network });
    document.getElementById('form-transaksi')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const copyRawJson = async () => {
    try {
      await navigator.clipboard.writeText(rawDraft);
      showAlert('JSON berhasil disalin ke clipboard.', 'success');
    } catch {
      showAlert('Gagal menyalin. Blok teks lalu salin manual.', 'error');
    }
  };

  const downloadRawJson = () => {
    const blob = new Blob([rawJson], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `erdropmanager_finance_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRawFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setRawDraft(await file.text());
      setRawError('');
    } catch {
      setRawError('Gagal membaca file.');
    }
  };

  const applyRawJson = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawDraft);
    } catch (err) {
      setRawError(`JSON tidak valid: ${(err as Error).message}`);
      return;
    }
    const result = validateTransactions(parsed);
    if (!result.ok) {
      setRawError(result.error);
      return;
    }
    const data = result.data;
    setRawError('');
    showConfirm(
      'TERAPKAN JSON?',
      `Ini akan mengganti ${transactions.length} transaksi saat ini dengan ${data.length} transaksi dari JSON.`,
      () => {
        setTransactions(data);
        setEditingId(null);
        showAlert('Data berhasil diimpor dari JSON.', 'success');
      }
    );
  };

  const duplicateTx = (tx: Transaction) => {
    setEditingId(null);
    setForm({ desc: tx.desc, amount: String(tx.amount), type: tx.type, network: tx.network });
    document.getElementById('form-transaksi')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ desc: '', amount: '', type: 'income', network: '' });
  };

  const deleteTx = (id: number) => {
    showConfirm(
      'HAPUS TRANSAKSI?',
      'Apakah Anda yakin ingin menghapus catatan keuangan ini?',
      () => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        setEditingId(prev => (prev === id ? null : prev));
        showAlert('Data transaksi berhasil dihapus.', 'hapus');
      }
    );
  };

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      showAlert('Tidak ada data transaksi untuk diexport.', 'error');
      return;
    }

    const currentConf = currencyConfig[currency];
    const headers = ['Date', 'Description', 'Network', 'Type', `Amount (${currentConf.code})`];
    
    const csvRows = filteredTransactions.map(tx => {
      const safeDesc = `"${tx.desc.replace(/"/g, '""')}"`;
      const exportAmount = tx.amount * currentConf.rate;
      
      return [
        tx.date,
        safeDesc,
        tx.network,
        tx.type.toUpperCase(),
        currency === 'BTC' ? exportAmount.toFixed(8) : exportAmount
      ].join(',');
    });

    const csvString = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `erdropmanager_finance_${currency}_${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showAlert(`Data berhasil diexport (Format: ${currency})!`, 'success');
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

      <header>
          <h1><FaWallet style={{marginRight: '10px'}}/>Keuangan</h1>
          <div style={{fontSize: '0.6em', marginTop: '5px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>1 USD : .
            {isLoadingRate ? (
                <>
                    <FaSync className="spin-animation" /> Updating Rates...
                </>
            ) : (
                currency === 'USD' ? `${currencyConfig.IDR.rate.toLocaleString('id-ID')} IDR` :
                currency === 'IDR' ? `Rate: 1 USD ≈ ${currencyConfig.IDR.rate.toLocaleString('id-ID')} IDR` :
                `Rate: 1 USD ≈ ${currencyConfig.BTC.rate.toFixed(8)} BTC`
            )}
          </div>
      </header>
      <Navbar />

      <div className="finance-container">
        <div className="summary-card" style={{
          margin: '20px 0', 
          border: '1px solid #444', 
          padding: '25px', 
          borderRadius: '0', 
          background: '#111',
          boxShadow: netBalance < 0 ? '0 0 20px rgba(255, 51, 51, 0.2)' : '0 0 20px rgba(51, 255, 51, 0.1)',
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px'}}>
             <span style={{color: '#33ff33', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'5px', fontSize: '1.1em'}}>
                <FaArrowUp /> Income: <AnimatedMoney value={stats.totalIncome} currency={currency} config={currencyConfig} />
             </span>
             <span style={{color: '#ff3333', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'5px', fontSize: '1.1em'}}>
                <FaArrowDown /> Expense: <AnimatedMoney value={stats.totalExpense} currency={currency} config={currencyConfig} />
             </span>
          </div>

          {(() => {
            let barColor = '#00ff88';
            let statusText = 'Aman';

            if (expenseRatio > 60) {
                barColor = '#f3ba2f';
                statusText = 'Waspada';
            } 
            if (expenseRatio > 80) {
                barColor = '#ff3333';
                statusText = 'Boros';
            }
            
            const remaining = stats.totalIncome - stats.totalExpense;

            return (
              <div style={{ marginTop: '20px', padding: '0 5px' }}>
                <div style={{
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '8px', 
                    fontSize: '0.85em', 
                    fontWeight: 'bold',
                    fontFamily: 'monospace'
                }}>
                   <span style={{ color: barColor }}>
                      Penggunaan: {expenseRatio.toFixed(1)}% ({statusText})
                   </span>
                   <span style={{ color: remaining < 0 ? '#ff3333' : '#fff' }}>
                      {remaining < 0 ? 'Defisit: ' : 'Sisa: '} 
                      <AnimatedMoney value={Math.abs(remaining)} currency={currency} config={currencyConfig} />
                   </span>
                </div>
                <div style={{ 
                    height: '14px', 
                    width: '100%', 
                    background: '#1a1a1a', 
                    borderRadius: '7px', 
                    overflow: 'hidden', 
                    border: '1px solid #333',
                    position: 'relative'
                }}>
                  <div style={{
                    height: '100%', 
                    width: `${Math.min(expenseRatio, 100)}%`, 
                    background: barColor, 
                    boxShadow: `0 0 12px ${barColor}88`,
                    borderRadius: '7px',
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.5s ease',
                  }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        transform: 'skewX(-20deg)'
                    }}></div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ textAlign: 'center', marginTop: '20px', fontWeight: 'bold', fontSize: '1.8em', color: netBalance >= 0 ? '#33ff33' : '#ff3333', textShadow: '0 0 10px rgba(0,0,0,0.5)', transition: 'color 0.3s' }}>
             {netBalance >= 0 ? '+' : ''} <AnimatedMoney value={netBalance} currency={currency} config={currencyConfig} />
          </div>
          <p style={{textAlign: 'center', fontSize: '0.8em', color: '#888', marginTop: '-5px'}}>SALDO BERSIH</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="summary-card" style={{ border: '1px solid #444', padding: '15px', background: '#111', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase', fontFamily: 'bold' }}><FaChartLine /> Network sering dipakai</span>
            {stats.topFreq ? (
              <div style={{ marginTop: '5px' }}>
                <h3 style={{ margin: 0, color: getNetworkColor(stats.topFreq.name) }}>{stats.topFreq.name}</h3>
                <span style={{ fontSize: '0.9em' }}>{stats.topFreq.count} Transaksi</span>
              </div>
            ) : <p>-</p>}
          </div>

          <div className="summary-card" style={{ border: '1px solid #444', padding: '15px', background: '#111', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase', fontFamily: 'bold' }}><FaWallet /> Volume teratas</span>
            {stats.topVol ? (
              <div style={{ marginTop: '5px' }}>
                <h3 style={{ margin: 0, color: getNetworkColor(stats.topVol.name) }}>{stats.topVol.name}</h3>
                <span style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                    <AnimatedMoney value={stats.topVol.volume} currency={currency} config={currencyConfig} />
                </span>
              </div>
            ) : <p>-</p>}
          </div>
        </div>

        {transactions.length > 0 && (
            <div className="charts-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
                marginBottom: '20px'
            }}>
                <div style={{
                    padding: '20px',
                    background: '#111',
                    border: '1px solid #444',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minHeight: '350px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{color: '#fff', fontSize: '1em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <FaChartPie style={{color: '#F3BA2F'}}/> 
                            {allocationMode === 'net' ? 'ASET BERSIH' : 'TOTAL VOLUME'}
                        </h3>
                        
                        <div style={{ display: 'flex', background: '#222', borderRadius: '5px', padding: '2px' }}>
                            <button 
                                onClick={() => setAllocationMode('net')}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '0.7em',
                                    border: 'none',
                                    background: allocationMode === 'net' ? '#444' : 'transparent',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    borderRadius: '3px',
                                    fontWeight: 'bold'
                                }}
                            >ASSETS</button>
                            <button 
                                onClick={() => setAllocationMode('volume')}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '0.7em',
                                    border: 'none',
                                    background: allocationMode === 'volume' ? '#444' : 'transparent',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    borderRadius: '3px',
                                    fontWeight: 'bold'
                                }}
                            >RIWAYAT</button>
                        </div>
                    </div>
                    
                    <div style={{ flex: 1, width: '100%', position: 'relative', minHeight: '240px' }}>
                        {doughnutData.labels.length > 0 ? (
                            <Doughnut data={doughnutData} options={doughnutOptions} />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.8em' }}>
                                Tidak ada data aset positif
                            </div>
                        )}
                    </div>

                    {transactions.length > 0 && (
                        <div style={{ width: '100%', marginTop: '15px', borderTop: '1px dashed #333', paddingTop: '15px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ background: '#0d0d0d', border: '1px solid #222', padding: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.6em', color: '#888', marginBottom: '3px' }}>
                                        {allocationMode === 'net' ? 'TOTAL ASET' : 'TOTAL VOLUME'}
                                    </div>
                                    <div style={{ fontSize: '0.75em', fontWeight: 'bold', color: '#fff', wordBreak: 'break-all' }}>
                                        {formatStaticMoney(allocationDetails.total)}
                                    </div>
                                </div>
                                <div style={{ background: '#0d0d0d', border: '1px solid #222', padding: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.6em', color: '#888', marginBottom: '3px' }}>JUMLAH NETWORK</div>
                                    <div style={{ fontSize: '0.75em', fontWeight: 'bold', color: '#fff' }}>
                                        {allocationDetails.positive.length + allocationDetails.deficit.length}
                                        {allocationDetails.deficit.length > 0 && (
                                            <span style={{ color: '#ff3333', fontWeight: 'normal' }}> ({allocationDetails.deficit.length} defisit)</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ background: '#0d0d0d', border: '1px solid #222', padding: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.6em', color: '#888', marginBottom: '3px' }}>TERBESAR</div>
                                    {allocationDetails.positive[0] ? (
                                        <div style={{ fontSize: '0.75em', fontWeight: 'bold', color: getNetworkColor(allocationDetails.positive[0].name) }}>
                                            {allocationDetails.positive[0].name} · {allocationDetails.positive[0].pct.toFixed(1)}%
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.75em', color: '#666' }}>-</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                                {allocationDetails.positive.map((r, i) => {
                                    const color = getNetworkColor(r.name);
                                    return (
                                        <div key={r.name}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75em', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color }}>
                                                    <span style={{ color: '#666', fontWeight: 'normal' }}>#{i + 1}</span>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 5px ${color}` }}></span>
                                                    {r.name}
                                                </span>
                                                <span style={{ color: '#fff', fontWeight: 'bold' }}>
                                                    {formatStaticMoney(r.value)} <span style={{ color: '#888', fontWeight: 'normal' }}>({r.pct.toFixed(1)}%)</span>
                                                </span>
                                            </div>
                                            <div style={{ height: '4px', background: '#222', marginTop: '4px' }}>
                                                <div style={{ width: `${r.pct}%`, height: '100%', background: color, boxShadow: `0 0 6px ${color}88` }}></div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.65em', color: '#888', marginTop: '3px' }}>
                                                <span>{r.count} transaksi</span>
                                                {allocationMode === 'net' && (
                                                    <>
                                                        <span style={{ color: '#33ff33' }}>+ {formatStaticMoney(r.income)}</span>
                                                        <span style={{ color: '#ff3333' }}>- {formatStaticMoney(r.expense)}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {allocationDetails.deficit.length > 0 && (
                                    <div style={{ borderTop: '1px dashed #333', paddingTop: '8px' }}>
                                        <div style={{ fontSize: '0.65em', color: '#888', marginBottom: '6px' }}>
                                            (SALDO ≤ 0)
                                        </div>
                                        {allocationDetails.deficit.map(r => (
                                            <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7em', marginBottom: '3px' }}>
                                                <span style={{ color: getNetworkColor(r.name), fontWeight: 'bold' }}>{r.name}</span>
                                                <span style={{ color: r.value < 0 ? '#ff3333' : '#888' }}>{formatStaticMoney(r.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div style={{
                    padding: '20px',
                    background: '#111',
                    border: '1px solid #444',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minHeight: '350px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{color: '#fff', fontSize: '1em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px'}}>
                             <FaChartLine style={{color: '#01a2ff'}}/> GROWTH HISTORY
                        </h3>
                        <div style={{ display: 'flex', background: '#222', borderRadius: '5px', padding: '2px' }}>
                            {([['line', 'LINE'], ['candle', 'CANDLE']] as const).map(([mode, label]) => (
                                <button
                                    key={mode}
                                    onClick={() => setGrowthMode(mode)}
                                    style={{
                                        padding: '4px 8px',
                                        fontSize: '0.7em',
                                        border: 'none',
                                        background: growthMode === mode ? '#444' : 'transparent',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        borderRadius: '3px',
                                        fontWeight: 'bold'
                                    }}
                                >{label}</button>
                            ))}
                        </div>
                    </div>
                    <div style={{ flex: 1, width: '100%', position: 'relative', minHeight: '240px' }}>
                        {growthMode === 'line' ? (
                            <Line data={lineChartData} options={lineOptions} />
                        ) : (
                            <Bar data={candleChart.data} options={candleOptions} plugins={[candleWickPlugin]} />
                        )}
                    </div>
                    {growthMode === 'candle' && (
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '10px', fontSize: '0.65em', color: '#888' }}>
                            <span><span style={{ color: CANDLE_UP }}>■</span> Pemasukan</span>
                            <span><span style={{ color: CANDLE_DOWN }}>■</span> Pengeluaran</span>
                        </div>
                    )}
                </div>
            </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ padding: '20px', background: '#111', border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h3 style={{ color: '#fff', fontSize: '1em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaTrophy style={{ color: '#F3BA2F' }} /> ROI PER NETWORK
              </h3>
              {stats.totalExpense > 0 && (() => {
                const totalRoi = ((stats.totalIncome - stats.totalExpense) / stats.totalExpense) * 100;
                const c = totalRoi >= 0 ? '#33ff33' : '#ff3333';
                return (
                  <span style={{ fontSize: '0.75em', fontWeight: 'bold', color: c, border: `1px solid ${c}55`, background: '#161616', padding: '3px 10px', borderRadius: '999px' }}>
                    TOTAL {totalRoi >= 0 ? '+' : ''}{totalRoi.toFixed(1)}%
                  </span>
                );
              })()}
            </div>
            <div style={{ fontSize: '0.65em', color: '#666', marginBottom: '15px' }}>
              Modal = total pengeluaran, Hasil = total pemasukan pada network tersebut.
            </div>

            {roiRows.withCapital.length === 0 && roiRows.noCapital.length === 0 ? (
              <div style={{ color: '#666', fontSize: '0.8em', textAlign: 'center', padding: '20px 0' }}>
                Belum ada data. Catat pengeluaran (modal) dan pemasukan (hasil) per network.
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
                {roiRows.withCapital.map((r, i) => {
                  const netColor = getNetworkColor(r.name);
                  const roiColor = r.roi > 0 ? '#33ff33' : r.roi < 0 ? '#ff3333' : '#888';
                  const barPct = roiRows.maxAbs > 0 ? (Math.abs(r.roi) / roiRows.maxAbs) * 100 : 0;
                  return (
                    <div key={r.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78em', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: netColor }}>
                          <span style={{ color: '#666', fontWeight: 'normal' }}>#{i + 1}</span>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: netColor, boxShadow: `0 0 5px ${netColor}` }}></span>
                          {r.name}
                        </span>
                        <span style={{ color: roiColor, fontWeight: 'bold' }}>
                          {r.roi > 0 ? '+' : ''}{r.roi.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ height: '4px', background: '#222', marginTop: '5px' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: roiColor, boxShadow: `0 0 6px ${roiColor}88` }}></div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.65em', color: '#888', marginTop: '4px' }}>
                        <span>Modal {formatStaticMoney(r.expense)}</span>
                        <span>Hasil {formatStaticMoney(r.income)}</span>
                        <span style={{ color: roiColor }}>{r.profit >= 0 ? 'Profit +' : 'Rugi -'}{formatStaticMoney(Math.abs(r.profit))}</span>
                      </div>
                    </div>
                  );
                })}

                {roiRows.noCapital.length > 0 && (
                  <div style={{ borderTop: '1px dashed #333', paddingTop: '8px' }}>
                    <div style={{ fontSize: '0.65em', color: '#888', marginBottom: '6px' }}>TANPA MODAL (BELUM ADA PENGELUARAN)</div>
                    {roiRows.noCapital.map(r => (
                      <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72em', marginBottom: '3px' }}>
                        <span style={{ color: getNetworkColor(r.name), fontWeight: 'bold' }}>{r.name}</span>
                        <span style={{ color: '#33ff33' }}>+ {formatStaticMoney(r.income)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ padding: '20px', background: '#111', border: '1px solid #444' }}>
            <h3 style={{ color: '#fff', fontSize: '1em', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaFire style={{ color: '#ff8a00' }} /> AKTIVITAS HARIAN
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '15px' }}>
              {[
                { label: 'STREAK SAAT INI', value: `${activity.current} hari`, color: activity.current > 0 ? '#ff8a00' : '#888' },
                { label: 'STREAK TERPANJANG', value: `${activity.longest} hari`, color: '#fff' },
                { label: 'HARI AKTIF', value: `${activity.activeDays} hari`, color: '#fff' }
              ].map(box => (
                <div key={box.label} style={{ background: '#0d0d0d', border: '1px solid #222', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.55em', color: '#888', marginBottom: '3px' }}>{box.label}</div>
                  <div style={{ fontSize: '0.8em', fontWeight: 'bold', color: box.color }}>{box.value}</div>
                </div>
              ))}
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: '6px' }}>
              <div style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridTemplateRows: 'repeat(7, 12px)',
                gridAutoColumns: '12px',
                gap: '3px',
                width: 'max-content',
                margin: '0 auto'
              }}>
                {activity.cells.map(c => {
                  const ratio = activity.max > 0 ? c.count / activity.max : 0;
                  const level = c.count === 0 ? 0 : ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
                  const bg = ['#1a1a1a', 'rgba(51,255,51,0.25)', 'rgba(51,255,51,0.5)', 'rgba(51,255,51,0.75)', '#33ff33'][level];
                  return (
                    <div
                      key={c.key}
                      title={`${c.label}: ${c.count} transaksi`}
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        background: c.future ? 'transparent' : bg,
                        boxShadow: level === 4 ? '0 0 5px rgba(51,255,51,0.6)' : 'none'
                      }}
                    ></div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '10px', fontSize: '0.65em', color: '#888' }}>
              <span>16 minggu terakhir</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Sedikit
                {['#1a1a1a', 'rgba(51,255,51,0.25)', 'rgba(51,255,51,0.5)', 'rgba(51,255,51,0.75)', '#33ff33'].map(c => (
                  <span key={c} style={{ width: '10px', height: '10px', borderRadius: '2px', background: c, display: 'inline-block' }}></span>
                ))}
                Banyak
              </span>
            </div>
          </div>
        </div>

        <div className="form-container" id="form-transaksi" style={editingId !== null ? { borderColor: '#01a2ff' } : undefined}>
          <h2 style={{fontSize: '1.2em', textAlign: 'center'}}>
            {editingId !== null ? <><FaEdit /> Edit Transaksi</> : <><FaPlus /> Catat Transaksi</>}
          </h2>
          <form onSubmit={addTransaction}>
            <input value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Deskripsi Transaksi" required />
            <input value={form.network} onChange={e => setForm({...form, network: e.target.value})} placeholder="Network (Base, Sol, dll)" required />
            <div style={{display:'flex', flexDirection:'column', gap: '5px'}}>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="Jumlah (USD)" required />
                {form.amount && (
                    <span style={{fontSize: '0.8em', color: '#666', paddingLeft: '5px'}}>
                        ≈ Rp {(parseFloat(form.amount) * currencyConfig.IDR.rate).toLocaleString('id-ID')}
                    </span>
                )}
            </div>
            
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="income">Pemasukan (+)</option>
              <option value="expense">Pengeluaran (-)</option>
            </select>
            <button type="submit" style={{gridColumn: '1 / -1'}}>
              {editingId !== null ? <><FaEdit /> Perbarui</> : <><FaPlus /> Simpan</>}
            </button>
            {editingId !== null && (
              <button type="button" onClick={cancelEdit} style={{gridColumn: '1 / -1', background: 'transparent', border: '1px solid #444', color: '#aaa'}}>
                <FaTimes /> Batal Edit
              </button>
            )}
          </form>
        </div>
        <div style={{ 
          marginBottom: '20px', 
          padding: '10px', 
          background: '#0d0d0d', 
          border: '1px dashed #333'
          }}>
            <details>
             <summary style={{cursor: 'pointer', fontSize: '0.85em', color: '#aaa', display:'flex', alignItems:'center', gap:'5px'}}>
              <FaInfoCircle /> KLIK UNTUK LIHAT KODE WARNA NETWORK
              </summary>
              <div style={{ position: 'relative', marginTop: '10px' }}>
                <FaSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '0.8em', pointerEvents: 'none' }} />
                <input
                  type="search"
                  placeholder="Cari network (BTC, SOL, BASE...)"
                  value={colorSearch}
                  onChange={e => setColorSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 30px', fontSize: '0.8em', backgroundColor: '#111', color: '#fff', border: '1px solid #333', borderRadius: '5px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', padding: '10px' }}>
              {(() => {
                const keyword = colorSearch.trim().toLowerCase();
                const filtered = NETWORK_COLORS.filter(item =>
                  item.n.toLowerCase().includes(keyword) || item.c.toLowerCase().includes(keyword)
                );
                if (filtered.length === 0) {
                  return <span style={{ fontSize: '0.75em', color: '#666' }}>Network "{colorSearch}" tidak ditemukan.</span>;
                }
                return filtered.map(item => (
                  <div
                    key={item.n}
                    role="button"
                    title="Klik untuk isi kolom Network di form"
                    onClick={() => setForm(f => ({ ...f, network: item.n }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7em', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.c, boxShadow: `0 0 5px ${item.c}` }}></div>
                    <span style={{ color: item.c }}>{item.n}</span>
                  </div>
                ));
              })()}
              </div>
            </details>
          </div>
          <div className="search-filter-bar" style={{marginBottom: '25px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
            <div className="search-input-wrapper" style={{flex: 1}}>
              <FaSearch className="search-icon" />
              <input 
              type="search" 
              placeholder="Filter berdasarkan Network..." 
              value={networkFilter}
              onChange={e => setNetworkFilter(e.target.value)}/>
            </div>
            <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
               <FaExchangeAlt style={{
                 position: 'absolute', 
                 left: '12px', 
                 zIndex: 2, 
                 color: '#888',
                 pointerEvents: 'none'
               }}/>
               <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'IDR' | 'BTC' | 'ETH')}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundColor: '#111',
                    color: '#fff',
                    border: '1px solid #444',
                    padding: '0 35px 0 35px',
                    height: '42px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: 'bold',
                    outline: 'none',
                    minWidth: '120px'
                  }}
               >
                  <option value="USD">USD ($)</option>
                  <option value="IDR">IDR (Rp)</option>
                  <option value="BTC">BTC (₿)</option>
                  <option value="ETH">ETH (♦)</option>
               </select>
               <FaChevronDown style={{
                  position: 'absolute',
                  right: '12px',
                  color: '#888',
                  fontSize: '0.7em',
                  pointerEvents: 'none'
               }}/>
            </div>
            
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | 'income' | 'expense')} style={filterSelectStyle}>
              <option value="all">Semua Tipe</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'oldest' | 'newest' | 'highest' | 'lowest')} style={filterSelectStyle}>
              <option value="oldest">Terlama</option>
              <option value="newest">Terbaru</option>
              <option value="highest">Jumlah Terbesar</option>
              <option value="lowest">Jumlah Terkecil</option>
            </select>
            <button 
              onClick={handleExportCSV} 
              className="btn-manage btn-export" 
              style={{
                width: 'auto', 
                minWidth: 'unset', 
                padding: '0 20px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title={`Download data sebagai CSV (${currency})`}
            >
              <FaFileExport /> CSV
            </button>
          </div>

        {transactions.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '0.75em', color: '#888', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
              <FaCalendarAlt /> PERIODE
            </span>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={filterSelectStyle}>
              <option value="">Semua Bulan</option>
              {monthOptions.map(k => <option key={k} value={k}>{formatMonthKey(k)}</option>)}
            </select>
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} title="Dari tanggal" style={{ ...filterSelectStyle, colorScheme: 'dark' }} />
            <span style={{ color: '#666', fontSize: '0.8em' }}>s/d</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} title="Sampai tanggal" style={{ ...filterSelectStyle, colorScheme: 'dark' }} />
            {(monthFilter || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setMonthFilter(''); setDateFrom(''); setDateTo(''); }}
                style={{ ...filterSelectStyle, display: 'flex', alignItems: 'center', gap: '6px', color: '#aaa' }}
              >
                <FaTimes /> Reset
              </button>
            )}
          </div>
        )}

        {transactions.length > 0 && (() => {
          const filteredNet = filteredSummary.income - filteredSummary.expense;
          const netColor = filteredNet > 0 ? '#33ff33' : filteredNet < 0 ? '#ff3333' : '#888';
          const pillBase: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '0.78em',
            fontWeight: 'bold',
            borderRadius: '999px',
            whiteSpace: 'nowrap'
          };
          return (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '12px',
              padding: '10px 14px',
              background: '#0d0d0d',
              border: '1px solid #222',
              borderLeft: '3px solid #ffffff'
            }}>
              <span style={{ fontSize: '0.78em', color: '#888', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Menampilkan
                <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1em', textShadow: '0 0 8px #F3BA2F66' }}>
                  {filteredTransactions.length}
                </span>
                dari {transactions.length} transaksi
              </span>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ ...pillBase, color: '#33ff33', background: 'rgba(51,255,51,0.08)', border: '1px solid rgba(51,255,51,0.35)', boxShadow: '0 0 8px rgba(51,255,51,0.12)' }}>
                  <FaArrowUp style={{ fontSize: '0.85em' }} /> {formatStaticMoney(filteredSummary.income)}
                </span>
                <span style={{ ...pillBase, color: '#ff3333', background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.35)', boxShadow: '0 0 8px rgba(255,51,51,0.12)' }}>
                  <FaArrowDown style={{ fontSize: '0.85em' }} /> {formatStaticMoney(filteredSummary.expense)}
                </span>
                <span style={{ ...pillBase, color: netColor, background: '#161616', border: `1px solid ${netColor}55` }}>
                  <FaWallet style={{ fontSize: '0.85em' }} /> {filteredNet > 0 ? '+' : filteredNet < 0 ? '-' : ''}{formatStaticMoney(Math.abs(filteredNet))}
                </span>
                {monthFilter && monthlyNet[prevMonthKey(monthFilter)] !== undefined && (() => {
                  const diff = (monthlyNet[monthFilter] ?? 0) - monthlyNet[prevMonthKey(monthFilter)];
                  const c = diff > 0 ? '#33ff33' : diff < 0 ? '#ff3333' : '#888';
                  return (
                    <span style={{ ...pillBase, color: c, background: '#161616', border: `1px solid ${c}55` }} title={`Selisih saldo bersih dibanding ${formatMonthKey(prevMonthKey(monthFilter))}`}>
                      {diff > 0 ? <FaArrowUp style={{ fontSize: '0.85em' }} /> : diff < 0 ? <FaArrowDown style={{ fontSize: '0.85em' }} /> : null}
                      vs {formatMonthKey(prevMonthKey(monthFilter))}: {diff > 0 ? '+' : diff < 0 ? '-' : ''}{formatStaticMoney(Math.abs(diff))}
                    </span>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Deskripsi</th>
                <th>Network</th>
                <th>Tipe</th>
                <th>Jumlah ({currency})</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                visibleTransactions.map(tx => (
                  <tr key={tx.id} style={{borderLeft: `4px solid ${tx.type === 'income' ? '#33ff33' : '#ff3333'}`, background: editingId === tx.id ? '#161616' : undefined}}>
                    <td data-label="Tanggal">{tx.date}</td>
                    <td data-label="Deskripsi">{tx.desc}</td>
                    <td data-label="Network">
                      <span 
                        className="status" 
                        style={{ 
                          borderColor: getNetworkColor(tx.network), 
                          color: getNetworkColor(tx.network),
                          textShadow: `0 0 5px ${getNetworkColor(tx.network)}88`
                        }}
                      >
                        {tx.network}
                      </span>
                    </td>
                    <td data-label="Tipe" style={{color: tx.type === 'income' ? '#33ff33' : '#ff3333', fontWeight: 'bold'}}>
                        {tx.type.toUpperCase()}
                    </td>
                    <td data-label={`Jumlah (${currency})`}>
                        {formatStaticMoney(tx.amount)}
                    </td>
                    <td data-label="Aksi">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button className="action-btn" onClick={() => startEdit(tx)} title="Edit" style={{ color: '#01a2ff' }}>
                                <FaEdit />
                            </button>
                            <button className="action-btn" onClick={() => duplicateTx(tx)} title="Duplikat ke form" style={{ color: '#F3BA2F' }}>
                                <FaCopy />
                            </button>
                            <button className="action-btn delete-btn" onClick={() => deleteTx(tx.id)} title="Hapus">
                                <FaTrash />
                            </button>
                        </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{textAlign: 'center', padding: '30px', color: '#666'}}>
                    Belum ada data transaksi ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length > visibleCount && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
            <button
              type="button"
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              style={{ ...filterSelectStyle, padding: '0 20px' }}
            >
              <FaChevronDown style={{ marginRight: '6px', fontSize: '0.8em' }} />
              Tampilkan {Math.min(PAGE_SIZE, filteredTransactions.length - visibleCount)} lagi ({filteredTransactions.length - visibleCount} tersisa)
            </button>
            <button
              type="button"
              onClick={() => setVisibleCount(filteredTransactions.length)}
              style={{ ...filterSelectStyle, padding: '0 20px', color: '#aaa' }}
            >
              Tampilkan semua
            </button>
          </div>
        )}

        <div style={{ marginTop: '30px', padding: '10px', background: '#0d0d0d', border: '1px dashed #333' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '0.85em', color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FaCode /> RAW JSON
            </summary>

            <div style={{ marginTop: '12px', padding: '0 4px 6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', fontSize: '0.7em', color: '#888' }}>
                <span>
                  {transactions.length} transaksi · {(new Blob([rawJson]).size / 1024).toFixed(1)} KB
                </span>
                {rawDraft !== rawJson && (
                  <span style={{ color: '#f3ba2f', fontWeight: 'bold' }}>Ada perubahan yang belum diterapkan</span>
                )}
              </div>

              <textarea
                value={rawDraft}
                onChange={e => { setRawDraft(e.target.value); setRawError(''); }}
                spellCheck={false}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: '280px',
                  resize: 'vertical',
                  padding: '12px',
                  background: '#050505',
                  color: '#33ff33',
                  border: `1px solid ${rawError ? '#ff3333' : '#333'}`,
                  borderRadius: '5px',
                  fontFamily: 'monospace',
                  fontSize: '0.75em',
                  lineHeight: 1.5,
                  whiteSpace: 'pre',
                  overflow: 'auto',
                  outline: 'none'
                }}
              />

              {rawError && (
                <div style={{ marginTop: '8px', fontSize: '0.75em', color: '#ff3333' }}>{rawError}</div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                <button type="button" onClick={copyRawJson} style={{ ...filterSelectStyle, height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaCopy /> Salin
                </button>
                <button type="button" onClick={downloadRawJson} style={{ ...filterSelectStyle, height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaDownload /> Download
                </button>
                <label style={{ ...filterSelectStyle, height: '38px', display: 'flex', alignItems: 'center', gap: '6px', boxSizing: 'border-box' }}>
                  <FaUpload /> Upload .json
                  <input type="file" accept="application/json,.json" onChange={handleRawFile} style={{ display: 'none' }} />
                </label>
                <button
                  type="button"
                  onClick={() => { setRawDraft(rawJson); setRawError(''); }}
                  disabled={rawDraft === rawJson}
                  style={{ ...filterSelectStyle, height: '38px', color: '#aaa', opacity: rawDraft === rawJson ? 0.4 : 1, cursor: rawDraft === rawJson ? 'not-allowed' : 'pointer' }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={applyRawJson}
                  disabled={rawDraft === rawJson}
                  style={{ ...filterSelectStyle, height: '38px', color: '#33ff33', borderColor: '#33ff33', opacity: rawDraft === rawJson ? 0.4 : 1, cursor: rawDraft === rawJson ? 'not-allowed' : 'pointer' }}
                >
                  Terapkan
                </button>
              </div>

              <div style={{ marginTop: '10px', fontSize: '0.65em', color: '#666' }}>
                Setiap item wajib punya: id (angka unik), desc, amount (&gt; 0, dalam USD), type ("income" / "expense"), dan network. Menerapkan JSON akan menimpa seluruh data transaksi.
              </div>
            </div>
          </details>
        </div>
      </div>
      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
