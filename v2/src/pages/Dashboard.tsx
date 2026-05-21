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

  const ongoingTasks  = tasks.filter(t => t.status === 'Ongoing');
  const endedTasks    = tasks.filter(t => t.status === 'END');
  const waitlistTasks = tasks.filter(t => t.status === 'Waitlist');
  const completedToday = ongoingTasks.filter(t => t.selesaiHariIni).length;
  const totalOngoing   = ongoingTasks.length;
  const progressToday  = totalOngoing > 0 ? Math.round((completedToday / totalOngoing) * 100) : 0;
  // copyright 0xmsr
  const upcomingDeadlines = tasks
    .filter(t => {
      if (!t.deadline || t.status === 'END') return false;
      const dl = new Date(t.deadline);
      dl.setHours(0, 0, 0, 0);
      const diff = Math.ceil((dl.getTime() - today.getTime()) / 86400000);
      return diff >= 0 && diff <= 7;
    })
    .map(t => {
      const dl = new Date(t.deadline!);
      dl.setHours(0, 0, 0, 0);
      return { ...t, diffDays: Math.ceil((dl.getTime() - today.getTime()) / 86400000) };
    })
    .sort((a, b) => a.diffDays - b.diffDays);

  const overdueDeadlines = tasks.filter(t => {
    if (!t.deadline || t.status === 'END') return false;
    const dl = new Date(t.deadline);
    dl.setHours(0, 0, 0, 0);
    return dl.getTime() < today.getTime();
  });

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const netProfit    = totalIncome - totalExpense;
  // copyright 0xmsr
  const networkStats: Record<string, { income: number; count: number }> = {};
  transactions.filter(t => t.type === 'income').forEach(t => {
    const net = t.network.toUpperCase();
    if (!networkStats[net]) networkStats[net] = { income: 0, count: 0 };
    networkStats[net].income += t.amount;
    networkStats[net].count  += 1;
  });
  const topNetworks = Object.entries(networkStats)
    .sort((a, b) => b[1].income - a[1].income)
    .slice(0, 5);

  const portfolioValue = portfolio
    .filter(p => p.status === 'holding')
    .reduce((acc, p) => acc + p.jumlahToken * p.hargaPerToken, 0);

  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
  const recentTasks  = tasks.filter(t => {
    if (!t.tanggalDitambahkan) return false;
    const parts = t.tanggalDitambahkan.split(' ')[0].split('/');
    if (parts.length < 3) return false;
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return d >= sevenDaysAgo;
  }).length;

  const StatCard = ({
    icon, label, value, sub, color,
  }: {
    icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
  }) => (
    <div style={{
      background: '#0d0d0d',
      border: '1px solid #1e1e1e',
      borderLeft: `3px solid ${color}`,
      padding: '16px',
      flex: '1',
      minWidth: '140px',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ color, fontSize: '16px' }}>{icon}</span>
        <span style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace', lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: '#444', marginTop: '6px', letterSpacing: '0.3px' }}>{sub}</div>
      )}
    </div>
  );

  const getDeadlineBadge = (diffDays: number) => {
    if (diffDays === 0) return { text: 'HARI INI', color: '#ff3333' };
    if (diffDays === 1) return { text: 'BESOK', color: '#ff6600' };
    if (diffDays <= 3)  return { text: `${diffDays}h lagi`, color: '#ffaa00' };
    return { text: `${diffDays}h lagi`, color: '#4caf50' };
  };

  const CATEGORIES = ['Testnet', 'Mainnet', 'Telegram Bot', 'Node', 'Whitelist', 'Waitlist'];
  const categoryCount = (kat: string) => {
    if (kat === 'Waitlist') return tasks.filter(t => t.status === 'Waitlist').length;
    return tasks.filter(t => t.kategori === kat).length;
  };

  return (
    <div className="app-container">
      <header>
        <h1><FaChartBar style={{ marginRight: '8px' }} />Dashboard</h1>
      </header>
      <Navbar />
      {(overdueDeadlines.length > 0 || upcomingDeadlines.length > 0) && (
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {overdueDeadlines.length > 0 && (
            <div style={{
              background: 'rgba(255,51,51,0.07)', border: '1px solid #ff333344',
              borderLeft: '3px solid #ff3333', padding: '11px 14px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <FaExclamationTriangle color="#ff3333" size={13} />
              <span style={{ color: '#ff6666', fontSize: '12px' }}>
                <strong>{overdueDeadlines.length} garapan</strong> melewati deadline:{' '}
                {overdueDeadlines.slice(0, 3).map(t => t.nama).join(', ')}
                {overdueDeadlines.length > 3 && ` +${overdueDeadlines.length - 3} lagi`}
              </span>
            </div>
          )}
          {upcomingDeadlines.length > 0 && (
            <div style={{
              background: 'rgba(255,170,0,0.05)', border: '1px solid #ffaa0044',
              borderLeft: '3px solid #ffaa00', padding: '11px 14px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <FaBell color="#ffaa00" size={13} />
              <span style={{ color: '#ffcc44', fontSize: '12px' }}>
                <strong>{upcomingDeadlines.length} deadline</strong> dalam 7 hari ke depan
              </span>
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
        <StatCard icon={<FaFire />} label="Progress Hari Ini" value={`${progressToday}%`}
          sub={`${completedToday} / ${totalOngoing} selesai`} color="#ff6600" />
        <StatCard icon={<FaCheckCircle />} label="Total Garapan" value={tasks.length}
          sub={`${ongoingTasks.length} ongoing · ${endedTasks.length} ended`} color="#4caf50" />
        <StatCard icon={<FaClock />} label="Waitlist" value={waitlistTasks.length}
          sub="Menunggu konfirmasi" color="#9c27b0" />
        <StatCard icon={<FaStar />} label="7 Hari Terakhir" value={recentTasks}
          sub="Project baru" color="#2196f3" />
      </div>
      <div style={{ marginBottom: '20px', padding: '0 2px' }}>
        <div style={{ height: '3px', background: '#1a1a1a', width: '100%', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: '#ff6600', width: `${progressToday}%`,
            transition: 'width 0.8s ease', boxShadow: '0 0 8px rgba(255,102,0,0.5)',
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <StatCard icon={<FaTrophy />} label="Total Income"
          value={`$${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`Expense: $${totalExpense.toFixed(2)}`} color="#00e676" />
        <StatCard icon={<FaChartBar />} label="Net Profit"
          value={`$${netProfit.toFixed(2)}`}
          sub={netProfit >= 0 ? '▲ Untung' : '▼ Rugi'}
          color={netProfit >= 0 ? '#00e676' : '#f44336'} />
        <StatCard icon={<FaWallet />} label="Portfolio"
          value={`$${portfolioValue.toFixed(2)}`}
          sub={`${portfolio.filter(p => p.status === 'holding').length} token holding`}
          color="#f3ba2f" />
      </div>

      <div className="dashboard-grid-2col" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px',
      }}>
        <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderTop: '2px solid #ffaa00', padding: '18px' }}>
          <h3 style={{
            margin: '0 0 14px', fontSize: '11px', textTransform: 'uppercase',
            letterSpacing: '1.5px', color: '#ffaa00',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <FaCalendarAlt /> Deadline Mendatang
          </h3>
          {upcomingDeadlines.length === 0 ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              Tidak ada deadline dalam 7 hari
            </p>
          ) : (
            upcomingDeadlines.slice(0, 6).map(task => {
              const badge = getDeadlineBadge(task.diffDays);
              return (
                <div key={task.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 0', borderBottom: '1px solid #141414',
                }}>
                  <div style={{ minWidth: 0, paddingRight: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.nama}
                    </div>
                    <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>
                      {task.kategori || 'Uncategorized'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 'bold', color: badge.color,
                    border: `1px solid ${badge.color}`, padding: '3px 7px',
                    whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.5px',
                  }}>
                    {badge.text}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderTop: '2px solid #f3ba2f', padding: '18px' }}>
          <h3 style={{
            margin: '0 0 14px', fontSize: '11px', textTransform: 'uppercase',
            letterSpacing: '1.5px', color: '#f3ba2f',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <FaTrophy /> Top Network (Income)
          </h3>
          {topNetworks.length === 0 ? (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              Belum ada data transaksi
            </p>
          ) : (
            topNetworks.map(([net, stat], idx) => {
              const rankColors = ['#f3ba2f', '#aaaaaa', '#cd7f32'];
              return (
                <div key={net} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 0', borderBottom: '1px solid #141414',
                }}>
                  <span style={{
                    width: '20px', height: '20px', flexShrink: 0,
                    background: rankColors[idx] ?? '#2a2a2a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 'bold',
                    color: idx < 3 ? '#000' : '#888',
                  }}>
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{net}</div>
                    <div style={{ fontSize: '10px', color: '#444' }}>{stat.count} transaksi</div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#00e676', fontFamily: 'monospace', fontWeight: 'bold', flexShrink: 0 }}>
                    ${stat.income.toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderTop: '2px solid #2196f3', padding: '18px', marginBottom: '24px' }}>
        <h3 style={{
          margin: '0 0 14px', fontSize: '11px', textTransform: 'uppercase',
          letterSpacing: '1.5px', color: '#2196f3',
        }}>
          Breakdown per Kategori
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {CATEGORIES.map(kat => {
            const count = categoryCount(kat);
            return (
              <div key={kat} style={{
                background: '#111', border: '1px solid #1e1e1e',
                padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'center',
                opacity: count === 0 ? 0.4 : 1,
              }}>
                <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.5px' }}>{kat}</span>
                <span style={{ fontWeight: 'bold', fontSize: '16px', color: count > 0 ? '#fff' : '#333', fontFamily: 'monospace' }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="app-footer">Powered by IAC Community</footer>
    </div>
  );
};
