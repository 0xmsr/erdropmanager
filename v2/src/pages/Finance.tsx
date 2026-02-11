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
    FaChevronDown
} from 'react-icons/fa';

import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement
);

const AnimatedMoney = ({ value, currency, config }: { value: number, currency: 'USD' | 'IDR' | 'BTC' | 'ETH', config: CurrencyConfigType }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const currentConfig = config[currency];
    const targetValue = value * currentConfig.rate;
    
    useEffect(() => {
        let startTimestamp: number | null = null;
        const duration = 1000;
        const startValue = displayValue;
        
        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            
            const current = startValue + (targetValue - startValue) * easeProgress;
            setDisplayValue(current);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        
        window.requestAnimationFrame(step);
    }, [value, currency, targetValue]);

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
    if (net.includes('btc')) return '#F7931A';
    if (net.includes('sol')) return '#9945FF';
    if (net.includes('eth')) return '#627eea';
    if (net.includes('op')) return '#FF0420';
    if (net.includes('base')) return '#0052ff';
    if (net.includes('bsc') || net.includes('bnb')) return '#F3BA2F';
    if (net.includes('polygon') || net.includes('matic')) return '#8247e5';
    if (net.includes('arb')) return '#28a0f0';
    if (net.includes('apt')) return '#2ed3b9';
    if (net.includes('sui')) return '#6fbcf0';
    if (net.includes('near')) return '#2ED3B7';
    if (net.includes('linea')) return '#ffffff';
    if (net.includes('mon')) return '#7645D9';
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => 
      networkFilter === '' || t.network.toLowerCase().includes(networkFilter.toLowerCase())
    );
  }, [transactions, networkFilter]);

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

  const netBalance = stats.totalIncome - stats.totalExpense;
  const expenseRatio = stats.totalIncome > 0 ? (stats.totalExpense / stats.totalIncome) * 100 : (stats.totalExpense > 0 ? 100 : 0);

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.desc || !form.amount || !form.network) {
      showAlert('Mohon lengkapi semua data transaksi!', 'error');
      return;
    }

    const amountVal = parseFloat(form.amount);

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

  const deleteTx = (id: number) => {
    showConfirm(
      'HAPUS TRANSAKSI?',
      'Apakah Anda yakin ingin menghapus catatan keuangan ini?',
      () => {
        setTransactions(prev => prev.filter(t => t.id !== id));
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
    link.download = `finance_${currency}_${new Date().toISOString().split('T')[0]}.csv`;
    
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
          <div style={{fontSize: '0.6em', marginTop: '5px', color: '#888', display: 'none', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
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
                    
                    <div style={{ flex: 1, width: '100%', position: 'relative' }}>
                        {doughnutData.labels.length > 0 ? (
                            <Doughnut data={doughnutData} options={doughnutOptions} />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.8em' }}>
                                Tidak ada data aset positif
                            </div>
                        )}
                    </div>
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
                    <h3 style={{color: '#fff', fontSize: '1em', marginBottom: '15px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px'}}>
                         <FaChartLine style={{color: '#01a2ff'}}/> GROWTH HISTORY
                    </h3>
                    <div style={{ flex: 1, width: '100%', position: 'relative' }}>
                        <Line data={lineChartData} options={lineOptions} />
                    </div>
                </div>
            </div>
        )}
        <div className="form-container">
          <h2 style={{fontSize: '1.2em', textAlign: 'center'}}><FaPlus /> Catat Transaksi</h2>
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
            <button type="submit" style={{gridColumn: '1 / -1'}}><FaPlus /> Simpan</button>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', padding: '10px' }}>
              {[
                {n: 'BTC', c: '#F7931A'}, {n: 'SOL', c: '#9945FF'}, {n: 'ETH', c: '#627eea'},
                {n: 'OP', c: '#FF0420'}, {n: 'BASE', c: '#0052ff'}, {n: 'BSC', c: '#F3BA2F'}, 
                {n: 'MATIC', c: '#8247e5'}, {n: 'ARB', c: '#28a0f0'}, {n: 'APT', c: '#2ed3b9'}, 
                {n: 'SUI', c: '#6fbcf0'}, {n: 'NEAR', c: '#2ED3B7'}, {n: 'LINEA', c: '#FFFFFF'},
                {n: 'MON', c: '#7645D9'},
              ].map(item => (
              <div key={item.n} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7em', fontWeight: 'bold' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.c, boxShadow: `0 0 5px ${item.c}` }}></div>
                <span style={{ color: item.c }}>{item.n}</span>
                </div>
              ))}
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
                filteredTransactions.map(tx => (
                  <tr key={tx.id} style={{borderLeft: `4px solid ${tx.type === 'income' ? '#33ff33' : '#ff3333'}`}}>
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
                        <button className="action-btn delete-btn" onClick={() => deleteTx(tx.id)} title="Hapus">
                            <FaTrash />
                        </button>
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
      </div>
      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
