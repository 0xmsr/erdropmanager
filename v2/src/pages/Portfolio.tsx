import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '../components/Navbar';
import { type PortfolioToken } from '../types';
import { CustomAlert, CustomConfirm } from '../components/CustomModals';
import {
  FaCoins, FaPlus, FaTrash, FaEdit, FaSearch,
  FaSave, FaUndo,
} from 'react-icons/fa';

const STATUS_COLORS: Record<PortfolioToken['status'], string> = {
  holding: '#4caf50',
  sold: '#888',
  vesting: '#f3ba2f',
};

const STATUS_LABELS: Record<PortfolioToken['status'], string> = {
  holding: 'Holding',
  sold: 'Sold',
  vesting: 'Vesting',
};

const emptyForm: Omit<PortfolioToken, 'id'> = {
  projectName: '',
  tokenSymbol: '',
  jumlahToken: 0,
  hargaPerToken: 0,
  network: '',
  tanggalDiterima: new Date().toISOString().split('T')[0],
  status: 'holding',
  catatan: '',
};

export const Portfolio: React.FC = () => {
  const [tokens, setTokens] = useState<PortfolioToken[]>(() => {
    try { return JSON.parse(localStorage.getItem('portfolioTokens') || '[]'); } catch { return []; }
  });

  const [form, setForm] = useState<Omit<PortfolioToken, 'id'>>(emptyForm);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PortfolioToken['status']>('all');
  const [alertData, setAlertData] = useState<{ isOpen: boolean; msg: string; type: 'success' | 'error' | 'hapus' | 'info' }>({ isOpen: false, msg: '', type: 'info' });
  const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; action: (() => void) | null }>({ isOpen: false, title: '', message: '', action: null });

  const showAlert = (msg: string, type: 'success' | 'error' | 'hapus' | 'info' = 'info') =>
    setAlertData({ isOpen: true, msg, type });

  useEffect(() => {
    localStorage.setItem('portfolioTokens', JSON.stringify(tokens));
  }, [tokens]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectName || !form.tokenSymbol) return;

    if (isEditMode && editId) {
      setTokens(prev => prev.map(t => t.id === editId ? { ...t, ...form } : t));
      showAlert('Token berhasil diperbarui!', 'success');
      setIsEditMode(false);
      setEditId(null);
    } else {
      const newToken: PortfolioToken = { ...form, id: Date.now().toString() };
      setTokens(prev => [newToken, ...prev]);
      showAlert('Token berhasil ditambahkan!', 'success');
    }
    setForm(emptyForm);
  };

  const handleEdit = (token: PortfolioToken) => {
    const { id, ...rest } = token;
    setForm(rest);
    setIsEditMode(true);
    setEditId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    setConfirmData({
      isOpen: true,
      title: 'HAPUS TOKEN?',
      message: 'Data token ini akan dihapus permanen.',
      action: () => {
        setTokens(prev => prev.filter(t => t.id !== id));
        showAlert('Token dihapus.', 'hapus');
      }
    });
  };

  const filtered = useMemo(() => tokens.filter(t => {
    const matchSearch = t.projectName.toLowerCase().includes(search.toLowerCase()) ||
      t.tokenSymbol.toLowerCase().includes(search.toLowerCase()) ||
      t.network.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  }), [tokens, search, statusFilter]);

  const stats = useMemo(() => {
    const holding = tokens.filter(t => t.status === 'holding');
    const totalValue = holding.reduce((acc, t) => acc + t.jumlahToken * t.hargaPerToken, 0);
    const soldValue = tokens.filter(t => t.status === 'sold')
      .reduce((acc, t) => acc + t.jumlahToken * t.hargaPerToken, 0);
    return { totalValue, soldValue, holdingCount: holding.length };
  }, [tokens]);

  return (
    <div className="app-container">
      <CustomAlert isOpen={alertData.isOpen} message={alertData.msg} type={alertData.type}
        onClose={() => setAlertData(p => ({ ...p, isOpen: false }))} />
      <CustomConfirm isOpen={confirmData.isOpen} title={confirmData.title} message={confirmData.message}
        onCancel={() => setConfirmData(p => ({ ...p, isOpen: false }))}
        onConfirm={() => { confirmData.action?.(); setConfirmData(p => ({ ...p, isOpen: false })); }} />

      <header>
        <h1><FaCoins style={{ marginRight: '10px' }} />Portfolio Tracker</h1>
      </header>
      <Navbar />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Nilai Holding', value: `$${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#4caf50' },
          { label: 'Token Holding', value: stats.holdingCount, color: '#2196f3' },
          { label: 'Total Sold', value: `$${stats.soldValue.toFixed(2)}`, color: '#888' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#111', borderLeft: `4px solid ${s.color}`, border: `1px solid #333`,
            padding: '16px 20px', flex: 1, minWidth: '160px'
          }}>
            <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', fontFamily: 'monospace', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="form-container">
        <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>
          {isEditMode ? <><FaEdit /> Edit Token</> : <><FaPlus /> Tambah Token</>}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          <input placeholder="Nama Project (Monad)" value={form.projectName}
            onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))} required />
          <input placeholder="Simbol Token (MON)" value={form.tokenSymbol}
            onChange={e => setForm(p => ({ ...p, tokenSymbol: e.target.value.toUpperCase() }))} required />
          <input type="number" placeholder="Jumlah Token" value={form.jumlahToken || ''}
            onChange={e => setForm(p => ({ ...p, jumlahToken: parseFloat(e.target.value) || 0 }))} min="0" step="any" />
          <input type="number" placeholder="Harga/Token (USD)" value={form.hargaPerToken || ''}
            onChange={e => setForm(p => ({ ...p, hargaPerToken: parseFloat(e.target.value) || 0 }))} min="0" step="any" />
          <input placeholder="Network (ETH, SOL, ...)" value={form.network}
            onChange={e => setForm(p => ({ ...p, network: e.target.value }))} />
          <input type="date" value={form.tanggalDiterima}
            onChange={e => setForm(p => ({ ...p, tanggalDiterima: e.target.value }))} />
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as PortfolioToken['status'] }))}>
            <option value="holding">Holding</option>
            <option value="vesting">Vesting</option>
            <option value="sold">Sold</option>
          </select>
          <input placeholder="Catatan (opsional)" value={form.catatan || ''}
            onChange={e => setForm(p => ({ ...p, catatan: e.target.value }))} />
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button type="submit" className="btn-manage btn-import">
              <FaSave /> {isEditMode ? 'Update' : 'Tambah Token'}
            </button>
            <button type="button" className="cancel-btn" onClick={() => {
              setForm(emptyForm); setIsEditMode(false); setEditId(null);
            }}><FaUndo /> Reset</button>
          </div>
        </form>
        {form.jumlahToken > 0 && form.hargaPerToken > 0 && (
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#4caf50', marginTop: '10px', fontFamily: 'monospace' }}>
            Estimasi nilai: <strong>${(form.jumlahToken * form.hargaPerToken).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </p>
        )}
      </div>

      <div className="filter-container search-filter-bar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '15px' }}>
        <div className="search-input-wrapper" style={{ flex: 1 }}>
          <FaSearch className="search-icon" />
          <input type="search" placeholder="Cari project / token / network..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ minWidth: '140px' }}>
          <option value="all">Semua Status</option>
          <option value="holding">Holding</option>
          <option value="vesting">Vesting</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Token</th>
              <th>Jumlah</th>
              <th>Harga/Token</th>
              <th>Total Nilai</th>
              <th>Network</th>
              <th>Tgl Diterima</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: '#555' }}>
                Belum ada token di portfolio.
              </td></tr>
            ) : filtered.map(token => (
              <tr key={token.id}>
                <td data-label="Project">
                  <strong>{token.projectName}</strong>
                  {token.catatan && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>{token.catatan}</div>
                  )}
                </td>
                <td data-label="Token" style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#f3ba2f' }}>
                  {token.tokenSymbol}
                </td>
                <td data-label="Jumlah" style={{ fontFamily: 'monospace' }}>
                  {token.jumlahToken.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </td>
                <td data-label="Harga" style={{ fontFamily: 'monospace', color: '#aaa' }}>
                  ${token.hargaPerToken.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </td>
                <td data-label="Total" style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#4caf50' }}>
                  ${(token.jumlahToken * token.hargaPerToken).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td data-label="Network" style={{ fontSize: '12px' }}>{token.network || '-'}</td>
                <td data-label="Tgl" style={{ fontSize: '12px', color: '#888' }}>{token.tanggalDiterima}</td>
                <td data-label="Status">
                  <span style={{
                    color: STATUS_COLORS[token.status],
                    border: `1px solid ${STATUS_COLORS[token.status]}`,
                    padding: '2px 8px', fontSize: '11px', fontWeight: 'bold'
                  }}>
                    {STATUS_LABELS[token.status]}
                  </span>
                </td>
                <td data-label="Aksi">
                  <div className="action-buttons-wrapper">
                    <button className="action-btn edit-btn" onClick={() => handleEdit(token)}><FaEdit /></button>
                    <button className="action-btn delete-btn" onClick={() => handleDelete(token.id)}><FaTrash /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="app-footer" style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '0.8em' }}>
        Powered by IAC Community
      </footer>
    </div>
  );
};