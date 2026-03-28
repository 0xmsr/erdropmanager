import React, { useMemo } from 'react';
import { Navbar } from '../components/Navbar';
import { type Task, type Transaction, type PortfolioToken } from '../types';
import {
  FaChartBar, FaCheckCircle, FaClock, FaTrophy,
  FaExclamationTriangle, FaWallet, FaFire, FaStar,
  FaBell, FaCalendarAlt
} from 'react-icons/fa';

export const Dashboard: React.FC = () => {
  const tasks: Task[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('airdropTasks') || '[]'); } catch { return []; }
  }, []);

  const transactions: Transaction[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('transactions') || '[]'); } catch { return []; }
  }, []);

  const portfolio: PortfolioToken[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('portfolioTokens') || '[]'); } catch { return []; }
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ongoingTasks = tasks.filter(t => t.status === 'Ongoing');
  const endedTasks = tasks.filter(t => t.status === 'END');
  const waitlistTasks = tasks.filter(t => t.status === 'Waitlist');
  const completedToday = ongoingTasks.filter(t => t.selesaiHariIni).length;
  const totalOngoing = ongoingTasks.length;
  const progressToday = totalOngoing > 0 ? Math.round((completedToday / totalOngoing) * 100) : 0;
  const upcomingDeadlines = tasks.filter(t => {
    if (!t.deadline || t.status === 'END') return false;
    const dl = new Date(t.deadline);
    dl.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).map(t => {
    const dl = new Date(t.deadline!);
    dl.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { ...t, diffDays };
  }).sort((a, b) => a.diffDays - b.diffDays);

  const overdueDeadlines = tasks.filter(t => {
    if (!t.deadline || t.status === 'END') return false;
    const dl = new Date(t.deadline);
    dl.setHours(0, 0, 0, 0);
    return dl.getTime() < today.getTime();
  });

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const networkStats: Record<string, { income: number; count: number }> = {};
  transactions.filter(t => t.type === 'income').forEach(t => {
    const net = t.network.toUpperCase();
    if (!networkStats[net]) networkStats[net] = { income: 0, count: 0 };
    networkStats[net].income += t.amount;
    networkStats[net].count += 1;
  });
  const topNetworks = Object.entries(networkStats)
    .sort((a, b) => b[1].income - a[1].income)
    .slice(0, 5);
  const portfolioValue = portfolio.filter(p => p.status === 'holding')
    .reduce((acc, p) => acc + p.jumlahToken * p.hargaPerToken, 0);

  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentTasks = tasks.filter(t => {
    if (!t.tanggalDitambahkan) return false;
    const parts = t.tanggalDitambahkan.split(' ')[0].split('/');
    if (parts.length < 3) return false;
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return d >= sevenDaysAgo;
  }).length;

  const StatCard = ({ icon, label, value, sub, color }: {
    icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
  }) => (
    <div style={{
      background: '#111', border: `1px solid #333`, borderLeft: `4px solid ${color}`,
      padding: '18px', flex: '1', minWidth: '160px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ color, fontSize: '18px' }}>{icon}</span>
        <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{sub}</div>}
    </div>
  );

  const getDeadlineBadge = (diffDays: number) => {
    if (diffDays === 0) return { text: 'HARI INI', color: '#ff3333' };
    if (diffDays === 1) return { text: 'BESOK', color: '#ff6600' };
    if (diffDays <= 3) return { text: `${diffDays} hari lagi`, color: '#ffaa00' };
    return { text: `${diffDays} hari lagi`, color: '#4caf50' };
  };

  return (
    <div className="app-container">
      <header>
        <h1><FaChartBar style={{ marginRight: '10px' }} />Dashboard</h1>
      </header>
      <Navbar />

      {(overdueDeadlines.length > 0 || upcomingDeadlines.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          {overdueDeadlines.length > 0 && (
            <div style={{
              background: 'rgba(255,51,51,0.1)', border: '1px solid #ff3333',
              padding: '12px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <FaExclamationTriangle color="#ff3333" />
              <span style={{ color: '#ff6666', fontSize: '13px' }}>
                <strong>{overdueDeadlines.length} garapan</strong> sudah melewati deadline:{' '}
                {overdueDeadlines.slice(0, 3).map(t => t.nama).join(', ')}
                {overdueDeadlines.length > 3 && ` +${overdueDeadlines.length - 3} lagi`}
              </span>
            </div>
          )}
          {upcomingDeadlines.length > 0 && (
            <div style={{
              background: 'rgba(255,170,0,0.08)', border: '1px solid #ffaa00',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <FaBell color="#ffaa00" />
              <span style={{ color: '#ffcc44', fontSize: '13px' }}>
                <strong>{upcomingDeadlines.length} deadline</strong> dalam 7 hari ke depan
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={<FaFire />} label="Progress Hari Ini" value={`${progressToday}%`}
          sub={`${completedToday}/${totalOngoing} garapan selesai`} color="#ff6600" />
        <StatCard icon={<FaCheckCircle />} label="Total Garapan" value={tasks.length}
          sub={`${ongoingTasks.length} ongoing • ${endedTasks.length} ended`} color="#4caf50" />
        <StatCard icon={<FaClock />} label="Waitlist" value={waitlistTasks.length}
          sub="Menunggu konfirmasi" color="#9c27b0" />
        <StatCard icon={<FaStar />} label="Ditambah 7 Hari" value={recentTasks}
          sub="Project baru" color="#2196f3" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={<FaTrophy />} label="Total Income" value={`$${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`Expense: $${totalExpense.toFixed(2)}`} color="#00e676" />
        <StatCard icon={<FaChartBar />} label="Net Profit" value={`$${netProfit.toFixed(2)}`}
          sub={netProfit >= 0 ? 'Untung' : 'Rugi'} color={netProfit >= 0 ? '#00e676' : '#f44336'} />
        <StatCard icon={<FaWallet />} label="Portfolio" value={`$${portfolioValue.toFixed(2)}`}
          sub={`${portfolio.filter(p => p.status === 'holding').length} token holding`} color="#f3ba2f" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        <div style={{ background: '#111', border: '1px solid #333', padding: '20px' }}>
          <h3 style={{
            borderBottom: '1px solid #333', paddingBottom: '10px', marginTop: 0,
            fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffaa00',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <FaCalendarAlt /> Deadline Mendatang
          </h3>
          {upcomingDeadlines.length === 0 ? (
            <p style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              Tidak ada deadline dalam 7 hari
            </p>
          ) : (
            upcomingDeadlines.slice(0, 6).map(task => {
              const badge = getDeadlineBadge(task.diffDays);
              return (
                <div key={task.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1e1e1e'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{task.nama}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{task.kategori || 'Uncategorized'}</div>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 'bold', color: badge.color,
                    border: `1px solid ${badge.color}`, padding: '3px 8px', whiteSpace: 'nowrap'
                  }}>
                    {badge.text}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div style={{ background: '#111', border: '1px solid #333', padding: '20px' }}>
          <h3 style={{
            borderBottom: '1px solid #333', paddingBottom: '10px', marginTop: 0,
            fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: '#f3ba2f',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <FaTrophy /> Top Network (Income)
          </h3>
          {topNetworks.length === 0 ? (
            <p style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              Belum ada data transaksi
            </p>
          ) : (
            topNetworks.map(([net, stat], idx) => (
              <div key={net} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 0', borderBottom: '1px solid #1e1e1e'
              }}>
                <span style={{
                  width: '22px', height: '22px', background: idx === 0 ? '#f3ba2f' : idx === 1 ? '#aaa' : '#cd7f32',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 'bold', color: '#000', flexShrink: 0
                }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{net}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>{stat.count} transaksi</div>
                </div>
                <span style={{ fontSize: '13px', color: '#00e676', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  ${stat.income.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ background: '#111', border: '1px solid #333', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{
          borderBottom: '1px solid #333', paddingBottom: '10px', marginTop: 0,
          fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: '#2196f3'
        }}>
          Breakdown per Kategori
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {['Testnet', 'Mainnet', 'Telegram Bot', 'Node', 'Whitelist', 'Waitlist'].map(kat => {
            const count = tasks.filter(t => t.kategori === kat || t.status === kat).length;
            return (
              <div key={kat} style={{
                background: '#1a1a1a', border: '1px solid #333', padding: '10px 16px',
                display: 'flex', gap: '10px', alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#888' }}>{kat}</span>
                <span style={{
                  fontWeight: 'bold', fontSize: '16px', color: '#fff',
                  fontFamily: 'monospace'
                }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="app-footer" style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '0.8em' }}>
        Powered by IAC Community
      </footer>
    </div>
  );
};