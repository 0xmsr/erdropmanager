import React, { useState, useEffect, useMemo } from 'react';
import { type Transaction } from '../types';
import { Navbar } from '../components/Navbar';
import { CustomAlert, CustomConfirm } from '../components/CustomModals';

export const Finance: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [form, setForm] = useState({ desc: '', amount: '', type: 'income', network: '' });
  const [networkFilter, setNetworkFilter] = useState('');

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

  const getNetworkColor = (network: string) => {
    const net = network.toLowerCase();
    if (net.includes('btc')) return '#F7931A'; // bitcoin
    if (net.includes('sol')) return '#9945FF'; // solana
    if (net.includes('eth')) return '#627eea'; // eth
    if (net.includes('op')) return '#FF0420'; // optimism
    if (net.includes('base')) return '#0052ff'; // base
    if (net.includes('bsc') || net.includes('bnb')) return '#F3BA2F'; // bsc
    if (net.includes('polygon') || net.includes('matic')) return '#8247e5'; // polygon or matic
    if (net.includes('arb')) return '#28a0f0'; // arb
    if (net.includes('apt')) return '#2ed3b9'; // aptos
    if (net.includes('sui')) return '#6fbcf0'; // sui
    if (net.includes('near')) return '#2ED3B7'; // near
    if (net.includes('linea')) return '#ffffff'; // linea
    return '#ffffff';
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

  const netBalance = stats.totalIncome - stats.totalExpense;
  const expenseRatio = stats.totalIncome > 0 ? (stats.totalExpense / stats.totalIncome) * 100 : (stats.totalExpense > 0 ? 100 : 0);

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.desc || !form.amount || !form.network) {
      showAlert('Mohon lengkapi semua data transaksi!', 'error');
      return;
    }

    const now = new Date();
    const newTx: Transaction = {
      id: Date.now(),
      desc: form.desc,
      amount: parseFloat(form.amount),
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

      <header><h1>Keuangan</h1></header>
      <Navbar />

      <div className="finance-container">
        <div className="summary-card" style={{
          margin: '20px 0', 
          border: '1px solid #444', 
          padding: '20px', 
          borderRadius: '12px', 
          background: '#111',
          boxShadow: netBalance < 0 ? '0 0 20px rgba(255, 51, 51, 0.2)' : '0 0 20px rgba(51, 255, 51, 0.1)',
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
             <span style={{color: '#33ff33', fontWeight: 'bold'}}>Income: ${stats.totalIncome.toLocaleString()}</span>
             <span style={{color: '#ff3333', fontWeight: 'bold'}}>Expense: ${stats.totalExpense.toLocaleString()}</span>
          </div>

          <div style={{ height: '16px', width: '100%', background: '#222', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
            <div style={{
              height: '100%', 
              width: `${Math.min(expenseRatio, 100)}%`, 
              background: expenseRatio > 85 ? '#ff0000' : '#ff3333', 
              transition: 'width 1s ease',
            }}></div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '15px', fontWeight: 'bold', fontSize: '1.2em', color: netBalance >= 0 ? '#33ff33' : '#ff3333' }}>
            {netBalance >= 0 ? '▲' : '▼'} Net Balance: ${netBalance.toLocaleString()}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="summary-card" style={{ border: '1px solid #444', padding: '15px', borderRadius: '12px', background: '#111', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase' }}>Network Terbanyak</span>
            {stats.topFreq ? (
              <div style={{ marginTop: '5px' }}>
                <h3 style={{ margin: 0, color: getNetworkColor(stats.topFreq.name) }}>{stats.topFreq.name}</h3>
                <span style={{ fontSize: '0.9em' }}>{stats.topFreq.count} Transaksi</span>
              </div>
            ) : <p>-</p>}
          </div>

          <div className="summary-card" style={{ border: '1px solid #444', padding: '15px', borderRadius: '12px', background: '#111', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase' }}>Volume Terbesar</span>
            {stats.topVol ? (
              <div style={{ marginTop: '5px' }}>
                <h3 style={{ margin: 0, color: getNetworkColor(stats.topVol.name) }}>{stats.topVol.name}</h3>
                <span style={{ fontSize: '0.9em', fontWeight: 'bold' }}>${stats.topVol.volume.toLocaleString()}</span>
              </div>
            ) : <p>-</p>}
          </div>
        </div>

        <div className="form-container">
          <form onSubmit={addTransaction}>
            <input value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Deskripsi Transaksi" required />
            <input value={form.network} onChange={e => setForm({...form, network: e.target.value})} placeholder="Network (Base, Sol, dll)" required />
            <input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="Jumlah ($)" required />
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="income">Pemasukan (+)</option>
              <option value="expense">Pengeluaran (-)</option>
            </select>
            <button type="submit">Catat Transaksi</button>
          </form>
        </div>
        
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '12px', 
          marginBottom: '20px', 
          padding: '12px', 
          background: 'rgba(255,255,255,0.05)', 
          borderRadius: '8px',
          border: '1px solid #333'
          }}>
           
           <details>
            <summary>
              INPO WARNA NETWORK:
              </summary>
              {[
                {n: 'BTC', c: '#F7931A'}, {n: 'SOL', c: '#9945FF'}, {n: 'ETH', c: '#627eea'},
                {n: 'OP', c: '#FF0420'}, {n: 'BASE', c: '#0052ff'}, {n: 'BSC', c: '#F3BA2F'}, 
                {n: 'MATIC', c: '#8247e5'}, {n: 'ARB', c: '#28a0f0'}, {n: 'APT', c: '#2ed3b9'}, 
                {n: 'SUI', c: '#6fbcf0'}, {n: 'NEAR', c: '#2ED3B7'}, {n: 'LINEA', c: '#FFFFFF'},
              ].map(item => (
              <div key={item.n} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7em', fontWeight: 'bold' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.c, boxShadow: `0 0 5px ${item.c}` }}></div>
                <span style={{ color: item.c }}>{item.n}</span>
                </div>
              ))}</details>
              </div>
              
              <div className="filter-container" style={{marginBottom: '15px'}}>
                <input 
                placeholder="Cari berdasarkan Network..." 
                value={networkFilter}
                onChange={e => setNetworkFilter(e.target.value)}
                style={{padding: '12px', background: '#000', border: '1px solid #444'}}
                />
              </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Deskripsi</th>
                <th>Network</th>
                <th>Tipe</th>
                <th>Jumlah</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(tx => (
                  <tr key={tx.id} style={{borderLeft: `4px solid ${tx.type === 'income' ? '#33ff33' : '#ff3333'}`}}>
                    <td>{tx.date}</td>
                    <td>{tx.desc}</td>
                    <td>
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
                    <td style={{color: tx.type === 'income' ? '#33ff33' : '#ff3333', fontWeight: 'bold'}}>
                        {tx.type.toUpperCase()}
                    </td>
                    <td>${tx.amount.toLocaleString()}</td>
                    <td>
                        <button className="delete-btn" onClick={() => deleteTx(tx.id)}>Hapus</button>
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
