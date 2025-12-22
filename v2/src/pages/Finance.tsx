import React, { useState, useEffect } from 'react';
import { type Transaction } from '../types';
import { Navbar } from '../components/Navbar';
import { CustomAlert, CustomConfirm } from '../components/CustomModals';

export const Finance: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [form, setForm] = useState({ desc: '', amount: '', type: 'income', network: '' });

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

  const showAlert = (msg: string, type: 'success' | 'error' | 'hapus' | 'info' = 'info') => {
    setAlertData({ isOpen: true, msg, type });
  };

  const showConfirm = (title: string, message: string, action: () => void) => {
    setConfirmData({ isOpen: true, title, message, onConfirmAction: action });
  };

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

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
      'Apakah Anda yakin ingin menghapus catatan keuangan ini? Saldo akan dikalkulasi ulang.',
      () => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        showAlert('Data transaksi berhasil dihapus.', 'hapus');
      }
    );
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const netBalance = totalIncome - totalExpense;

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
        <div className="summary-container" style={{display:'flex', justifyContent:'space-around', margin:'20px 0', border:'1px solid white', padding:'10px', flexWrap: 'wrap', gap: '10px'}}>
          <div style={{color: '#33ff33'}}>Income: ${totalIncome.toFixed(2)}</div>
          <div style={{color: '#ff3333'}}>Expense: ${totalExpense.toFixed(2)}</div>
          <div style={{color: netBalance >= 0 ? '#33ff33' : '#ff3333', fontWeight:'bold'}}>
            Net: ${netBalance.toFixed(2)}
          </div>
        </div>

        <div className="form-container">
          <h2 style={{ textAlign: 'center' }}>Tambah Transaksi</h2>
          <form onSubmit={addTransaction} id="transaction-form">
            <input 
              value={form.desc} 
              onChange={e => setForm({...form, desc: e.target.value})} 
              placeholder="Deskripsi" 
              required
            />
            <input 
              value={form.network} 
              onChange={e => setForm({...form, network: e.target.value})} 
              placeholder="Network (mis: Base)" 
            />
            <input 
              type="number" 
              value={form.amount} 
              onChange={e => setForm({...form, amount: e.target.value})} 
              placeholder="Jumlah.... ($)" 
              required
            />
            <select 
              value={form.type} 
              onChange={e => setForm({...form, type: e.target.value})}
            >
              <option value="income">Pendapatan</option>
              <option value="expense">Pengeluaran</option>
            </select>
            
            <div className="form-buttons">
              <button type="submit">Simpan</button>
              <button 
                type="button" 
                onClick={() => setForm({ desc: '', amount: '', type: 'income', network: '' })}
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr><th>Tgl</th><th>Desc</th><th>Net</th><th>Type</th><th>$</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                 <tr><td colSpan={6} style={{textAlign: 'center'}}>Belum ada data transaksi</td></tr>
              ) : transactions.map(tx => (
                <tr key={tx.id} style={{color: tx.type === 'income' ? '#33ff33' : '#ff3333'}}>
                  <td data-label="Tgl">{tx.date}</td>
                  <td data-label="Desc">{tx.desc}</td>
                  <td data-label="Net">{tx.network}</td>
                  <td data-label="Type">{tx.type}</td>
                  <td data-label="Jumlah">${tx.amount}</td>
                  <td data-label="Aksi"><button className="delete-btn" onClick={() => deleteTx(tx.id)}>Hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="app-footer">
        Powered by IAC Community
      </footer>
    </div>
  );
};