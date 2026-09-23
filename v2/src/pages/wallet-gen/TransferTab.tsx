// @ts-nocheck

import React from 'react';
import { Link } from 'react-router-dom';
import type { WalletGeneratorCtx, ChainKind } from './types';
import { CHAIN_OPTIONS } from './constants';
import { shortAddr } from './helpers';
import { GRAM_WALLET_VERSIONS, formatGramSwapOutput } from './network/Gramnet';
import {
  asentumBech32ToHex, readAsentumToken, sendArc20Token, checkArc20SendGas, asentumUnitsFromDecimalString,
  asentumFormatUnits, isValidAsentumAddress as isValidAseAddress, getAsentumBalanceWithFallback, aseFriendlyError,
  AURA_SWAP_NATIVE, isAuraSwapNative, findAuraSwapPoolId, readAuraSwapPool, getAuraSwapQuote, getAuraSwapAllowance,
  executeAuraSwap, getAuraSwapShares, createAuraSwapPool, addAuraSwapLiquidity, removeAuraSwapLiquidity,
  detectAuraSwapTokens, detectAuraSwapPositions, previewAseGasFee, AURA_SWAP_GAS_LIMIT,
} from './network/Asentumnet';
import type { AsentumArc20GasCheck, AuraSwapPool, AuraSwapTokenInfo, AuraSwapPosition, AseGasSpeed, AseGasOverride } from './network/Asentumnet';
import { chainAccent } from './wallet-themes/pixelTheme';
import { UI_THEMES, getUiTheme, themeScope } from './wallet-themes/UiThemes';

type Arc20Custom = { address: string; name: string; symbol: string; decimals: number };
const arc20CustomKey = (netId: string) => `aseArc20Custom:${netId}`;
function loadArc20Custom(netId: string): Arc20Custom[] {
  try {
    const v = JSON.parse(localStorage.getItem(arc20CustomKey(netId)) || '[]');
    return Array.isArray(v) ? v.filter(x => x && typeof x.address === 'string' && typeof x.symbol === 'string') : [];
  } catch { return []; }
}
function saveArc20Custom(netId: string, list: Arc20Custom[]) {
  try { localStorage.setItem(arc20CustomKey(netId), JSON.stringify(list)); } catch { /* storage penuh / diblokir */ }
}

function arc20Hex(addr: string): string {
  const a = addr.trim();
  return (a.toLowerCase().startsWith('0x') ? a : asentumBech32ToHex(a)).toLowerCase();
}
function arc20Thousands(v: string | null | undefined): string {
  if (v == null || v === '') return '—';
  const [w, f] = String(v).split('.');
  return (w || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
}
function arc20ShortAmt(v: string | null | undefined): string {
  if (v == null || v === '') return '?';
  const [w, f = ''] = String(v).split('.');
  const frac = f.slice(0, 6).replace(/0+$/, '');
  return arc20Thousands(frac ? `${w}.${frac}` : w);
}

function AseArc20PickerSheet({ ctx, net, tokens, activeAddress, loading, search, setSearch, onClose, onSelect, onRefresh,
  customAddr, setCustomAddr, onAddCustom, adding, addError }: {
  ctx: any; net: any;
  tokens: { address: string; symbol: string; name: string; balance: string }[];
  activeAddress: string; loading: boolean; search: string; setSearch: (v: string) => void;
  onClose: () => void; onSelect: (address: string) => void; onRefresh: () => void;
  customAddr: string; setCustomAddr: (v: string) => void; onAddCustom: () => void; adding: boolean; addError: string;
}) {
  const { FaSearch, FaSync, FaSpinner, FaCheckCircle, FaPlus } = ctx;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q))
    : tokens;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background:'#111', border:'1px solid #262626', borderBottom:'none', width:'100%', maxWidth:'480px',
          maxHeight:'78vh', display:'flex', flexDirection:'column', borderRadius:'16px 16px 0 0', overflow:'hidden',
          animation:'slideUp 0.18s ease-out',
        }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
          <div style={{ width:'36px', height:'4px', borderRadius:'2px', background:'#333' }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 18px 14px' }}>
          <span style={{ fontSize:'15px', fontWeight:'bold' }}>Pilih Token</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:'18px', padding:'4px', lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:'0 18px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'10px', padding:'10px 12px' }}>
            <FaSearch size={12} color="#555"/>
            <input
              autoFocus
              placeholder="Cari nama token atau tempel address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex:1, background:'none', border:'none', outline:'none', color:'#eee', fontSize:'13px' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'14px', padding:0 }}>×</button>
            )}
          </div>
        </div>

        <div style={{ padding:'0 10px 6px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', padding:'0 8px' }}>
            Token ARC-20 Tersimpan
          </span>
          <button onClick={onRefresh} disabled={loading}
            style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px', padding:'0 8px' }}>
            <FaSync size={9} style={{ animation:loading?'spin 1s linear infinite':undefined }}/> Refresh
          </button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'4px 10px 14px' }}>
          {loading && tokens.length === 0 && (
            <div style={{ textAlign:'center', color:'#555', padding:'30px 0', fontSize:'12px' }}>
              <FaSpinner style={{ animation:'spin 1s linear infinite', marginBottom:'8px' }} size={16}/>
              <div>Memuat token...</div>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center', color:'#444', padding:'30px 8px', fontSize:'12px', lineHeight:1.6 }}>
              {tokens.length === 0
                ? 'Belum ada token ARC-20 tersimpan. Tempel address kontraknya manual di kolom bawah, atau buat token baru lewat Token Creator.'
                : 'Tidak ada token yang cocok dengan pencarian.'}
            </div>
          )}
          {filtered.map(t => {
            const isActive = t.address.toLowerCase() === activeAddress.toLowerCase();
            return (
              <div key={t.address} onClick={() => onSelect(t.address)}
                style={{
                  display:'flex', alignItems:'center', gap:'12px', padding:'10px 8px', cursor:'pointer',
                  borderRadius:'10px', background: isActive ? `${net.color}1a` : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1a1a1a'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ width:34, height:34, borderRadius:'50%', background:'#222', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#666', fontWeight:'bold' }}>
                  {t.symbol.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:'bold', color:'#eee' }}>{t.symbol}</div>
                  <div style={{ fontSize:'11px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:'13px', fontFamily:'monospace', color:'#eee' }}>{t.balance}</div>
                  <div style={{ fontSize:'10px', color:'#555', fontFamily:'monospace' }}>{t.address.slice(0,6)}…{t.address.slice(-4)}</div>
                </div>
                {isActive && <FaCheckCircle size={13} color={net.color} style={{ flexShrink:0 }}/>}
              </div>
            );
          })}
        </div>

        <div style={{ padding:'10px 14px 16px', borderTop:'1px solid #1e1e1e', flexShrink:0 }}>
          <div style={{ fontSize:'10px', color:'#555', marginBottom:'6px' }}>Gak ketemu? Tambah manual:</div>
          <div style={{ display:'flex', gap:'6px' }}>
            <input type="text" placeholder="Contract address token (0x...)" value={customAddr}
              onChange={e => setCustomAddr(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customAddr.trim() && !adding) onAddCustom(); }}
              style={{ flex:1, boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px', padding:'9px 10px', background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#eee' }}/>
            <button onClick={onAddCustom} disabled={adding || !customAddr.trim()}
              style={{ background:'none', border:'1px solid #333', color:net.color, padding:'0 14px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap', opacity:(!customAddr.trim())?0.5:1 }}>
              {adding ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : <><FaPlus size={10}/> Tambah</>}
            </button>
          </div>
          {addError && <div style={{ fontSize:'11px', color:'#ff8a80', marginTop:'6px' }}>{addError}</div>}
        </div>
      </div>
    </div>
  );
}

function AseArc20Panel({ ctx, net, privateKey, holderHex, holderBech32, savedTokens = [] }: {
  ctx: any; net: any; privateKey: string; holderHex: string; holderBech32: string; savedTokens?: any[];
}) {
  const {
    FaCoins, FaSync, FaSpinner, FaChevronDown, FaTrash, FaPaperPlane, FaLink, FaQrcode, FaCopy, FaCheckCircle,
    FaGasPump, FaExclamationTriangle, copyText, copiedKey, setQrAddress,
  } = ctx;

  const [tokenAddr, setTokenAddr] = React.useState('');   // hex lowercase
  const [info, setInfo] = React.useState<{ name: string | null; symbol: string | null; decimals: number | null; totalSupply: string | null; ownerBalance: string | null } | null>(null);
  const [loadingInfo, setLoadingInfo] = React.useState(false);
  const [infoError, setInfoError] = React.useState('');
  const [to, setTo] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [status, setStatus] = React.useState<{ type: 'pending' | 'success' | 'error'; msg: string; hash?: string } | null>(null);
  const [gas, setGas] = React.useState<AsentumArc20GasCheck | null>(null);
  const [gasLoading, setGasLoading] = React.useState(false);
  const [gasError, setGasError] = React.useState('');
  const [custom, setCustom] = React.useState<Arc20Custom[]>(() => loadArc20Custom(net.id));
  const [balances, setBalances] = React.useState<Record<string, any>>({});
  const [balLoading, setBalLoading] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState('');
  const [customAddr, setCustomAddr] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState('');

  const mountedRef = React.useRef(true);
  const infoReqRef = React.useRef(0);
  const balReqRef  = React.useRef(0);

  React.useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const created = (savedTokens || [])
    .filter(t => t && t.status === 'ready' && t.contractAddress && (!t.netId || t.netId === net.id))
    .map(t => ({ address: String(t.contractAddress).toLowerCase(), symbol: String(t.symbol || '?'), name: String(t.name || t.symbol || 'Token'), source: 'created' as const }));
  const needsInitCount = (savedTokens || []).filter(t => t && t.status === 'needs-init' && (!t.netId || t.netId === net.id)).length;
  const createdSet = new Set(created.map(t => t.address));
  const customOnly = custom
    .filter(t => !createdSet.has(t.address.toLowerCase()))
    .map(t => ({ address: t.address.toLowerCase(), symbol: t.symbol, name: t.name, source: 'custom' as const }));
  const known = [...created, ...customOnly];
  const knownKey = known.map(t => t.address).join(',');
  const selectedKnown = known.find(t => t.address === tokenAddr.toLowerCase());
  const balOf = (addr: string): string | null => balances[addr.toLowerCase()]?.ownerBalance ?? null;
  const loadBalances = async () => {
    if (!holderHex || known.length === 0) return;
    const reqId = ++balReqRef.current;
    setBalLoading(true);
    const results = await Promise.all(known.map(async t => {
      try { return [t.address, await readAsentumToken(net, t.address, holderHex)] as const; }
      catch { return [t.address, null] as const; }
    }));
    if (!mountedRef.current || reqId !== balReqRef.current) return;
    setBalances(prev => {
      const next = { ...prev };
      for (const [k, r] of results) if (r && r.name != null) next[k] = r;
      return next;
    });
    setBalLoading(false);
  };
  React.useEffect(() => { loadBalances(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [net.id, holderHex, knownKey]);

  const loadInfo = async (addrOverride?: string) => {
    const addr = (addrOverride ?? tokenAddr).trim();
    if (!addr) return;
    if (!isValidAseAddress(addr)) { setInfoError('Address kontrak token tidak valid.'); setInfo(null); return; }
    const reqId = ++infoReqRef.current;
    setLoadingInfo(true); setInfoError('');
    try {
      const result = await readAsentumToken(net, addr, holderHex);
      if (reqId !== infoReqRef.current || !mountedRef.current) return;
      if (result.name == null || result.decimals == null) {
        setInfoError('Kontrak ditemukan, tapi bukan (atau bukan versi) ARC-20 yang valid — name()/decimals() tidak terbaca.');
        setInfo(null);
      } else {
        setInfo(result);
        setBalances(prev => ({ ...prev, [addr.toLowerCase()]: result }));
      }
    } catch (e: any) {
      if (reqId !== infoReqRef.current || !mountedRef.current) return;
      setInfoError(e?.message || 'Gagal membaca kontrak token.');
      setInfo(null);
    } finally {
      if (reqId === infoReqRef.current && mountedRef.current) setLoadingInfo(false);
    }
  };

  const selectToken = (addr: string) => {
    const hex = addr.toLowerCase();
    setPickerOpen(false); setPickerSearch(''); setAddError(''); setCustomAddr('');
    setStatus(null); setAmount(''); setInfoError('');
    setTokenAddr(hex);
    const cached = balances[hex];
    setInfo(cached && cached.name != null && cached.decimals != null ? cached : null);
    loadInfo(hex);
  };

  const addCustom = async () => {
    const raw = customAddr.trim();
    if (!isValidAseAddress(raw)) { setAddError('Address kontrak token tidak valid.'); return; }
    let hex = '';
    try { hex = arc20Hex(raw); } catch { setAddError('Address kontrak token tidak valid.'); return; }
    if (known.some(t => t.address === hex)) { selectToken(hex); return; }
    setAdding(true); setAddError('');
    try {
      const r = await readAsentumToken(net, hex, holderHex);
      if (!mountedRef.current) return;
      if (r.name == null || r.decimals == null || !r.symbol) {
        setAddError('Kontrak ditemukan, tapi bukan (atau bukan versi) ARC-20 yang valid — name()/symbol()/decimals() tidak terbaca.');
        return;
      }
      const next = [{ address: hex, name: r.name, symbol: r.symbol, decimals: r.decimals }, ...custom.filter(t => t.address.toLowerCase() !== hex)];
      setCustom(next); saveArc20Custom(net.id, next);
      setBalances(prev => ({ ...prev, [hex]: r }));
      selectToken(hex);
    } catch (e: any) {
      if (mountedRef.current) setAddError(e?.message || 'Gagal membaca kontrak token.');
    } finally { if (mountedRef.current) setAdding(false); }
  };

  const removeCustom = (addr: string) => {
    const next = custom.filter(t => t.address.toLowerCase() !== addr.toLowerCase());
    setCustom(next); saveArc20Custom(net.id, next);
    if (tokenAddr.toLowerCase() === addr.toLowerCase()) { setTokenAddr(''); setInfo(null); setAmount(''); setStatus(null); }
  };

  const refreshGas = async () => {
    if (!holderHex && !holderBech32) return;
    setGasLoading(true); setGasError('');
    try {
      const g = await checkArc20SendGas(net, holderHex || holderBech32);
      if (mountedRef.current) setGas(g);
    } catch (e: any) {
      if (mountedRef.current) { setGas(null); setGasError(e?.message || 'Gagal membaca saldo ASE / estimasi fee.'); }
    } finally {
      if (mountedRef.current) setGasLoading(false);
    }
  };

  React.useEffect(() => { refreshGas();}, [net.id, holderHex]);

  const refreshAll = () => { loadBalances(); refreshGas(); if (tokenAddr) loadInfo(); };
  const amountCheck: { ok: boolean; err: string } = (() => {
    const s = amount.trim();
    if (!s || !info || info.decimals == null) return { ok: false, err: '' };
    if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, err: 'Jumlah tidak valid.' };
    const frac = s.split('.')[1] || '';
    if (frac.length > info.decimals) return { ok: false, err: `Maksimal ${info.decimals} angka desimal untuk token ini.` };
    try {
      const units = asentumUnitsFromDecimalString(s, info.decimals);
      const bal   = asentumUnitsFromDecimalString(info.ownerBalance || '0', info.decimals);
      if (units <= 0n) return { ok: false, err: '' };
      if (units > bal) return { ok: false, err: `Melebihi saldo token kamu (${info.ownerBalance ?? '0'} ${info.symbol}).` };
      return { ok: true, err: '' };
    } catch { return { ok: false, err: 'Jumlah tidak valid.' }; }
  })();

  const noGasBalance = !!gas && !gas.hasAnyBalance;
  const canSend = !sending && !!info && isValidAseAddress(to.trim()) && amountCheck.ok && !noGasBalance;

  const send = async () => {
    if (!canSend || !info || info.decimals == null || !info.symbol) return;
    setSending(true);
    setStatus({ type: 'pending', msg: `Mengirim ${amount} ${info.symbol}...` });
    try {
      const hash = await sendArc20Token(net, privateKey, tokenAddr.trim(), to.trim(), amount.trim(), info.decimals);
      if (!mountedRef.current) return;
      setStatus({ type: 'success', msg: `Berhasil mengirim ${amount} ${info.symbol}.`, hash });
      setAmount('');
      loadInfo();
      refreshGas();
      loadBalances();
    } catch (e: any) {
      if (mountedRef.current) setStatus({ type: 'error', msg: e?.message || 'Gagal mengirim token.' });
    } finally { if (mountedRef.current) setSending(false); }
  };

  const statusColor = status ? ({ pending:'#ffaa00', success:'#4caf50', error:'#f44336' } as const)[status.type] : '#555';
  const selSymbol = info?.symbol ?? selectedKnown?.symbol ?? null;
  const selName   = info?.name   ?? selectedKnown?.name   ?? null;
  const recvAddr  = holderHex || holderBech32;

  const pickerTokens = known
    .map(t => {
      const b = balances[t.address];
      const bal = b?.ownerBalance ?? null;
      const held = bal != null && /[1-9]/.test(bal);
      return { address: t.address, symbol: b?.symbol ?? t.symbol, name: b?.name ?? t.name, held,
        balance: bal != null ? arc20ShortAmt(bal) : (balLoading ? '…' : '?') };
    })
    .sort((a, b) => Number(b.held) - Number(a.held));

  return (
    <>
      {/* ── Kartu Kirim (pola ERC-20/Jetton) ── */}
      <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', gap:'8px' }}>
          <h3 style={{ fontSize:'13px', margin:0 }}><FaCoins style={{ marginRight:'6px' }}/>Kirim Token ARC-20</h3>
          <button onClick={refreshAll} disabled={balLoading || loadingInfo || gasLoading}
            style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px' }}>
            <FaSync size={9} style={{ animation:(balLoading||loadingInfo||gasLoading)?'spin 1s linear infinite':undefined }}/> Refresh saldo
          </button>
        </div>

        <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Token</label>
        <button onClick={() => setPickerOpen(true)}
          style={{
            width:'100%', display:'flex', alignItems:'center', gap:'10px', background:'#070707',
            border:'1px solid #262626', borderRadius:'10px', padding:'10px 12px', cursor:'pointer',
            textAlign:'left', boxSizing:'border-box',
          }}>
          {selSymbol
            ? <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a1a1a', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:net.color, fontWeight:'bold' }}>{selSymbol.slice(0,2).toUpperCase()}</div>
            : <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a1a1a', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <FaCoins size={12} color={net.color}/>
              </div>}
          <div style={{ flex:1, minWidth:0 }}>
            {selSymbol ? (
              <>
                <div style={{ fontSize:'13px', fontWeight:'bold', color:'#eee' }}>{selSymbol}</div>
                <div style={{ fontSize:'11px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {selName}{tokenAddr ? ` · ${shortAddr(tokenAddr)}` : ''}
                </div>
              </>
            ) : (
              <div style={{ fontSize:'13px', color:'#666' }}>{balLoading ? 'Memuat token...' : 'Pilih Token ARC-20...'}</div>
            )}
          </div>
          {(balLoading && !selSymbol) || loadingInfo
            ? <FaSpinner size={12} color="#555" style={{ animation:'spin 1s linear infinite', flexShrink:0 }}/>
            : <FaChevronDown size={12} color="#555" style={{ flexShrink:0 }}/>}
        </button>

        {known.length === 0 && (
          <div style={{ fontSize:'10px', color:'#444', marginTop:'6px' }}>
            Belum ada token ARC-20 yang tersimpan — buka "Pilih Token ARC-20" buat tambah lewat contract address, atau buat token baru di Token Creator.
          </div>
        )}
        {needsInitCount > 0 && (
          <div style={{ fontSize:'10px', color:'#666', marginTop:'6px' }}>
            {needsInitCount} token belum selesai diinisialisasi dan tidak ditampilkan — selesaikan dulu lewat Token Creator ("Selesaikan Inisialisasi").
          </div>
        )}

        {known.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'8px' }}>
            {known.map(t => {
              const isActive = tokenAddr.toLowerCase() === t.address;
              const b = balOf(t.address);
              const balLabel = b != null ? arc20ShortAmt(b) : (balLoading ? '...' : '?');
              return (
                <span key={t.address} onClick={() => selectToken(t.address)} style={{
                  fontSize:'10px', color: isActive ? net.color : '#666',
                  border:`1px solid ${isActive ? net.color : '#222'}`,
                  padding:'3px 7px', display:'flex', alignItems:'center', gap:'6px', cursor:'pointer',
                }}>
                  {balances[t.address]?.symbol ?? t.symbol} · {balLabel}
                  {t.source === 'custom' && (
                    <FaTrash size={8} style={{ cursor:'pointer', color:'#444' }}
                      onClick={e => { e.stopPropagation(); removeCustom(t.address); }} title="Hapus dari daftar"/>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {infoError && <div style={{ fontSize:'11px', color:'#f44336', marginTop:'8px' }}>{infoError}</div>}

        {info && (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginTop:'16px' }}>
            <div>
              <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Ke address</label>
              <input type="text" placeholder="0x... atau ase1..." value={to} onChange={e => setTo(e.target.value)}
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
            </div>

            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                <label style={{ fontSize:'11px', color:'#555' }}>Jumlah {info.symbol}</label>
                <button onClick={() => setAmount(info.ownerBalance || '0')}
                  style={{ background:'none', border:'1px solid #333', color:net.color, padding:'2px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px' }}>
                  MAX
                </button>
              </div>
              <input type="number" placeholder="0.0" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace' }}/>
              <div style={{ fontSize:'10px', color:'#444', marginTop:'4px' }}>
                Saldo kamu: <span style={{ fontFamily:'monospace', color:'#888' }}>{arc20Thousands(info.ownerBalance ?? '0')} {info.symbol}</span>
              </div>
              {amountCheck.err && <div style={{ fontSize:'11px', color:'#f44336', marginTop:'6px' }}>{amountCheck.err}</div>}
            </div>

            {/* ── Estimasi Gas Fee (pola sama dgn kotak fee Kirim ASE) ── */}
            <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', marginBottom: (gas || gasError) ? '8px' : 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#666', textTransform:'uppercase', letterSpacing:'0.5px', fontSize:'10px' }}>
                  <FaGasPump size={10}/> Estimasi Gas Fee
                  {gasLoading && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                </div>
                <button onClick={refreshGas} disabled={gasLoading}
                  style={{ background:'none', border:'1px solid #333', color:'#888', padding:'2px 8px', cursor:gasLoading?'not-allowed':'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px' }}>
                  <FaSync size={9} style={{ animation:gasLoading?'spin 1s linear infinite':undefined }}/> Refresh
                </button>
              </div>
              {gas && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px', fontSize:'11px' }}>
                  <span style={{ color:'#888' }}>Saldo ASE: <span style={{ fontFamily:'monospace', color:'#ccc' }}>{gas.balanceAse}</span></span>
                  <span style={{ color:'#888' }}>Gas Limit: <span style={{ fontFamily:'monospace', color:'#ccc' }}>{Number(gas.gasLimit).toLocaleString('en-US')}</span> unit</span>
                  <span style={{ color:'#888' }}>Base Fee: <span style={{ fontFamily:'monospace', color:'#ccc' }}>{gas.isFallback ? '—' : gas.baseFeePerGas}</span> wei/unit</span>
                  <span style={{ fontFamily:'monospace', fontWeight:'bold', color: !gas.hasAnyBalance ? '#ff6666' : !gas.enough ? '#ffaa00' : '#4caf50' }}>
                    ≤ {gas.feeAse} ASE
                  </span>
                </div>
              )}
              {gasError && (
                <div style={{ display:'flex', gap:'6px', alignItems:'flex-start', color:'#ffaa00', fontSize:'11px' }}>
                  <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                  <span>{gasError}</span>
                </div>
              )}
              {gas && !gas.hasAnyBalance && (
                <div style={{ display:'flex', gap:'6px', alignItems:'flex-start', color:'#ff6666', fontSize:'11px', marginTop:'8px' }}>
                  <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                  <span>Saldo ASE 0 — tidak bisa bayar gas. Minta dulu lewat Faucet ASE di atas.</span>
                </div>
              )}
              {gas && gas.hasAnyBalance && !gas.enough && (
                <div style={{ display:'flex', gap:'6px', alignItems:'flex-start', color:'#ffaa00', fontSize:'11px', marginTop:'8px' }}>
                  <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                  <span>Saldo lebih kecil dari batas atas fee. Tx masih bisa dicoba, tapi node bisa menolaknya — tambah ASE kalau gagal.</span>
                </div>
              )}
              <div style={{ fontSize:'10px', color:'#444', marginTop:'6px' }}>
                Batas atas (gas limit penuh × fee cap){gas?.isFallback ? ' — base fee tidak terbaca dari RPC, pakai perkiraan kasar' : ''}; biaya aktual biasanya jauh lebih kecil. Gas dibayar dengan ASE, bukan dengan token.
              </div>
            </div>

            <button onClick={send} disabled={!canSend}
              style={{
                padding:'13px', background: sending ? '#0a0a1a' : net.color, color:'#fff', border:'none',
                cursor: sending ? 'wait' : (canSend ? 'pointer' : 'not-allowed'), fontSize:'14px', fontWeight:'bold',
                display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                opacity: (canSend || sending) ? 1 : 0.5,
              }}>
              {sending
                ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                : <><FaPaperPlane/> Kirim Token</>}
            </button>
          </div>
        )}

        {status && (
          <div style={{ background:'#0a0a0a', border:`1px solid ${statusColor}44`, borderLeft:`3px solid ${statusColor}`, padding:'12px', fontSize:'12px', fontFamily:'monospace', color:statusColor, marginTop:'14px' }}>
            {status.type === 'pending' && <span style={{ marginRight:'6px', animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
            {status.type === 'success' && '✓ '}
            {status.type === 'error'   && '✗ '}
            {status.msg}
            {status.hash && (
              <div style={{ marginTop:'6px' }}>
                <a href={`${net.explorerUrl}/tx/${status.hash}`} target="_blank" rel="noreferrer" style={{ color:net.color === '#4949DF' ? '#7a7aff' : net.color, fontSize:'11px' }}>
                  Lihat di {net.name} Explorer ↗
                </a>
                <div style={{ fontSize:'10px', color:'#555', marginTop:'3px', wordBreak:'break-all' }}>{status.hash}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Token (pola ERC-20) ── */}
      {info && tokenAddr && (
        <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', gap:'8px', flexWrap:'wrap' }}>
            <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'flex', alignItems:'center', gap:'6px' }}>
              <FaCoins size={11}/> Detail Token
              {loadingInfo && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
            </div>
            <a href={`${net.explorerUrl}/address/${tokenAddr}`} target="_blank" rel="noreferrer"
              style={{ fontSize:'11px', color:'#7a7aff', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
              <FaLink size={9}/> Lihat Kontrak di Explorer
            </a>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px' }}>
            <div>
              <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Nama / Symbol</div>
              <div style={{ fontSize:'12px', color:'#ccc', marginTop:'3px' }}>{info.name} ({info.symbol})</div>
            </div>
            <div>
              <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Standard</div>
              <div style={{ fontSize:'12px', color:'#ccc', marginTop:'3px' }}>ARC-20 · {info.decimals} desimal</div>
            </div>
            <div>
              <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Total Supply</div>
              <div style={{ fontSize:'12px', color:'#ccc', marginTop:'3px', fontFamily:'monospace', wordBreak:'break-all' }}>{arc20Thousands(info.totalSupply)}</div>
            </div>
            <div>
              <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Saldo Kamu</div>
              <div style={{ fontSize:'12px', color:'#4caf50', marginTop:'3px', fontFamily:'monospace', wordBreak:'break-all' }}>{arc20Thousands(info.ownerBalance ?? '0')} {info.symbol}</div>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Kontrak</div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'3px' }}>
                <code style={{ flex:1, fontSize:'11px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tokenAddr}</code>
                <button onClick={() => copyText(tokenAddr, 'arc20_contract')}
                  style={{ background:'none', border:'1px solid #333', color:copiedKey==='arc20_contract'?'#4caf50':'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                  {copiedKey==='arc20_contract' ? <FaCheckCircle/> : <FaCopy/>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Terima Token ── */}
      <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'18px' }}>
        <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
          Terima Token — kirim ke address ini
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {recvAddr || '—'}
          </code>
          <button onClick={() => copyText(recvAddr, 'arc20_recv')} disabled={!recvAddr}
            style={{ background:'none', border:'1px solid #333', color:copiedKey==='arc20_recv'?'#4caf50':'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
            {copiedKey==='arc20_recv' ? <FaCheckCircle/> : <FaCopy/>}
          </button>
          <button onClick={() => setQrAddress(recvAddr)} disabled={!recvAddr} title="QR Code"
            style={{ background:'none', border:'1px solid #333', color:'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
            <FaQrcode size={11}/>
          </button>
          {recvAddr && (
            <a href={`${net.explorerUrl}/address/${recvAddr}`} target="_blank" rel="noreferrer" title="Lihat di Explorer"
              style={{ color:'#555', padding:'4px 8px', border:'1px solid #333', display:'flex', flexShrink:0 }}>
              <FaLink size={11}/>
            </a>
          )}
        </div>
        <div style={{ fontSize:'10px', color:'#444', marginTop:'8px' }}>
          Address yang sama dengan address native ASE kamu (hex) — kontrak ARC-20 pakai representasi ini untuk balanceOf/transfer.
        </div>
      </div>

      {pickerOpen && (
        <AseArc20PickerSheet ctx={ctx} net={net}
          tokens={pickerTokens} activeAddress={tokenAddr} loading={balLoading}
          search={pickerSearch} setSearch={setPickerSearch}
          onClose={() => { setPickerOpen(false); setPickerSearch(''); setAddError(''); }}
          onSelect={selectToken} onRefresh={loadBalances}
          customAddr={customAddr} setCustomAddr={v => { setCustomAddr(v); setAddError(''); }}
          onAddCustom={addCustom} adding={adding} addError={addError} />
      )}
    </>
  );
}

const auraPoolKey = (netId: string) => `auraSwapPool:${netId}`;
const AURA_SWAP_DEFAULT_POOL: Record<string, string> = {
  testnet: 'ase1v0myp2de3dhj3crvkhxqlnjaw2mvp64a9efkpl',
};

type AuraTokenSide = { mode: 'native' | 'token'; addr: string };

function auraTokenEff(t: AuraTokenSide): string {
  return t.mode === 'native' ? AURA_SWAP_NATIVE : t.addr.trim();
}

function AuraTokenPickerSheet({ ctx, net, tokens, detecting, activeMode, activeAddr, onClose, onSelectNative, onSelectToken,
  search, setSearch, manualAddr, setManualAddr, onAddManual, manualAdding, manualError }: {
  ctx: any; net: any; tokens: AuraSwapTokenInfo[]; detecting?: boolean;
  activeMode: 'native' | 'token'; activeAddr: string;
  onClose: () => void; onSelectNative: () => void; onSelectToken: (address: string) => void;
  search: string; setSearch: (v: string) => void;
  manualAddr: string; setManualAddr: (v: string) => void; onAddManual: () => void; manualAdding: boolean; manualError: string;
}) {
  const { FaSearch, FaSpinner, FaCheckCircle, FaPlus } = ctx;
  const q = search.trim().toLowerCase();
  const curAddr = activeAddr.trim().toLowerCase();

  const arc20Tokens = tokens.filter(t => !t.isNative);
  const held = (t: AuraSwapTokenInfo) => t.balance != null && /[1-9]/.test(t.balance);
  const filtered = (q
    ? arc20Tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.address.toLowerCase().includes(q))
    : arc20Tokens
  ).slice().sort((a, b) => Number(held(b)) - Number(held(a)));

  const nativeMatches = !q || net.symbol.toLowerCase().includes(q) || 'native'.includes(q);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background:'#111', border:'1px solid #262626', borderBottom:'none', width:'100%', maxWidth:'480px',
          maxHeight:'78vh', display:'flex', flexDirection:'column', borderRadius:'16px 16px 0 0', overflow:'hidden',
          animation:'slideUp 0.18s ease-out',
        }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
          <div style={{ width:'36px', height:'4px', borderRadius:'2px', background:'#333' }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 18px 14px' }}>
          <span style={{ fontSize:'15px', fontWeight:'bold' }}>Pilih Token</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:'18px', padding:'4px', lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:'0 18px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'10px', padding:'10px 12px' }}>
            <FaSearch size={12} color="#555"/>
            <input
              autoFocus
              placeholder="Cari nama token atau tempel address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex:1, background:'none', border:'none', outline:'none', color:'#eee', fontSize:'13px' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'14px', padding:0 }}>×</button>
            )}
          </div>
        </div>

        <div style={{ padding:'0 10px 6px' }}>
          <span style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', padding:'0 8px' }}>
            Token ARC-20 Terdeteksi di Pool
          </span>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'4px 10px 14px' }}>
          {nativeMatches && (
            <div onClick={onSelectNative}
              style={{
                display:'flex', alignItems:'center', gap:'12px', padding:'10px 8px', cursor:'pointer',
                borderRadius:'10px', background: activeMode === 'native' ? `${net.color}1a` : 'transparent',
              }}
              onMouseEnter={e => { if (activeMode !== 'native') e.currentTarget.style.background = '#1a1a1a'; }}
              onMouseLeave={e => { if (activeMode !== 'native') e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:'#222', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:net.color, fontWeight:'bold' }}>
                {net.symbol.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:'bold', color:'#eee' }}>{net.symbol}</div>
                <div style={{ fontSize:'11px', color:'#666' }}>Native · {net.name}</div>
              </div>
              {activeMode === 'native' && <FaCheckCircle size={13} color={net.color} style={{ flexShrink:0 }}/>}
            </div>
          )}

          {detecting && (
            <div style={{ textAlign:'center', color:'#555', padding:'20px 0 10px', fontSize:'12px' }}>
              <FaSpinner style={{ animation:'spin 1s linear infinite', marginBottom:'8px' }} size={16}/>
              <div>Mendeteksi token listed di pool ini...</div>
            </div>
          )}
          {!detecting && filtered.length === 0 && (
            <div style={{ textAlign:'center', color:'#444', padding:'24px 8px 8px', fontSize:'12px', lineHeight:1.6 }}>
              {arc20Tokens.length === 0
                ? 'Belum ada token ARC-20 yang kedetek listed di pool ini. Tempel address kontraknya manual di kolom bawah.'
                : 'Tidak ada token yang cocok dengan pencarian.'}
            </div>
          )}
          {filtered.map(t => {
            const isActive = activeMode === 'token' && curAddr === t.address.toLowerCase();
            return (
              <div key={t.address} onClick={() => onSelectToken(t.address)}
                style={{
                  display:'flex', alignItems:'center', gap:'12px', padding:'10px 8px', cursor:'pointer',
                  borderRadius:'10px', background: isActive ? `${net.color}1a` : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1a1a1a'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ width:34, height:34, borderRadius:'50%', background:'#222', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#666', fontWeight:'bold' }}>
                  {t.symbol.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:'bold', color:'#eee' }}>{t.symbol}</div>
                  <div style={{ fontSize:'11px', color:'#666', fontFamily:'monospace' }}>{t.address.slice(0,6)}…{t.address.slice(-4)}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:'13px', fontFamily:'monospace', color:'#eee' }}>{t.balance != null ? arc20ShortAmt(t.balance) : '?'}</div>
                </div>
                {isActive && <FaCheckCircle size={13} color={net.color} style={{ flexShrink:0 }}/>}
              </div>
            );
          })}
        </div>

        <div style={{ padding:'10px 14px 16px', borderTop:'1px solid #1e1e1e', flexShrink:0 }}>
          <div style={{ fontSize:'10px', color:'#555', marginBottom:'6px' }}>Belum listed di pool ini? Tambah manual:</div>
          <div style={{ display:'flex', gap:'6px' }}>
            <input type="text" placeholder="Contract address token (0x... / ase1...)" value={manualAddr}
              onChange={e => setManualAddr(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && manualAddr.trim() && !manualAdding) onAddManual(); }}
              style={{ flex:1, boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px', padding:'9px 10px', background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#eee' }}/>
            <button onClick={onAddManual} disabled={manualAdding || !manualAddr.trim()}
              style={{ background:'none', border:'1px solid #333', color:net.color, padding:'0 14px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap', opacity:(!manualAddr.trim())?0.5:1 }}>
              {manualAdding ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : <><FaPlus size={10}/> Pakai</>}
            </button>
          </div>
          {manualError && <div style={{ fontSize:'11px', color:'#ff8a80', marginTop:'6px' }}>{manualError}</div>}
        </div>
      </div>
    </div>
  );
}

function AuraTokenSidePicker({ ctx, net, label, side, setSide, info, tokens, detecting }: {
  ctx: any; net: any; label: string; side: AuraTokenSide; setSide: (v: AuraTokenSide) => void;
  info: { symbol: string; decimals: number } | null;
  tokens?: AuraSwapTokenInfo[]; detecting?: boolean;
}) {
  const { FaSpinner, FaChevronDown, FaCoins } = ctx;
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [manualAddr, setManualAddr] = React.useState('');
  const [manualAdding, setManualAdding] = React.useState(false);
  const [manualError, setManualError] = React.useState('');

  const list = tokens || [];
  const arc20Tokens = list.filter(t => !t.isNative);
  const curAddr = side.addr.trim().toLowerCase();
  const matchedToken = side.mode === 'token' ? arc20Tokens.find(t => t.address.toLowerCase() === curAddr) : undefined;
  const selSymbol = side.mode === 'native' ? net.symbol : (matchedToken?.symbol ?? info?.symbol ?? null);
  const closeSheet = () => { setOpen(false); setSearch(''); setManualAddr(''); setManualError(''); };
  const selectNative = () => { setSide({ mode: 'native', addr: '' }); closeSheet(); };
  const selectToken  = (addr: string) => { setSide({ mode: 'token', addr }); closeSheet(); };
  const addManual = () => {
    const raw = manualAddr.trim();
    if (!isValidAseAddress(raw)) { setManualError('Address kontrak token tidak valid.'); return; }
    setManualAdding(true); setManualError('');
    try {
      const hex = arc20Hex(raw);
      selectToken(hex);
    } catch { setManualError('Address kontrak token tidak valid.'); }
    finally { setManualAdding(false); }
  };

  return (
    <div>
      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>{label}</label>
      <button onClick={() => setOpen(true)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:'10px', background:'#070707',
          border:'1px solid #262626', borderRadius:'10px', padding:'10px 12px', cursor:'pointer',
          textAlign:'left', boxSizing:'border-box',
        }}>
        {selSymbol
          ? <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a1a1a', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:net.color, fontWeight:'bold' }}>{selSymbol.slice(0,2).toUpperCase()}</div>
          : <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a1a1a', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <FaCoins size={12} color={net.color}/>
            </div>}
        <div style={{ flex:1, minWidth:0 }}>
          {selSymbol ? (
            <>
              <div style={{ fontSize:'13px', fontWeight:'bold', color:'#eee' }}>{selSymbol}</div>
              <div style={{ fontSize:'11px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {side.mode === 'native' ? `Native · ${net.name}` : (side.addr ? shortAddr(side.addr) : '')}
              </div>
            </>
          ) : (
            <div style={{ fontSize:'13px', color:'#666' }}>{detecting ? 'Mendeteksi token...' : 'Pilih Token...'}</div>
          )}
        </div>
        {detecting && !selSymbol
          ? <FaSpinner size={12} color="#555" style={{ animation:'spin 1s linear infinite', flexShrink:0 }}/>
          : <FaChevronDown size={12} color="#555" style={{ flexShrink:0 }}/>}
      </button>
      {info && <div style={{ fontSize:'10px', color:'#555', marginTop:'4px' }}>{info.symbol} · {info.decimals} desimal</div>}

      {open && (
        <AuraTokenPickerSheet ctx={ctx} net={net} tokens={list} detecting={detecting}
          activeMode={side.mode} activeAddr={side.addr}
          onClose={closeSheet} onSelectNative={selectNative} onSelectToken={selectToken}
          search={search} setSearch={setSearch}
          manualAddr={manualAddr} setManualAddr={v => { setManualAddr(v); setManualError(''); }}
          onAddManual={addManual} manualAdding={manualAdding} manualError={manualError} />
      )}
    </div>
  );
}

function AseSwapPanel({ ctx, net, privateKey, holderHex, holderBech32 }: {
  ctx: any; net: any; privateKey: string; holderHex: string; holderBech32: string;
}) {
  const { FaExchangeAlt, FaArrowRight, FaSpinner, FaExclamationTriangle, FaCheckCircle, FaSlidersH } = ctx;

  const [poolAddr, setPoolAddr] = React.useState<string>(() => {
    try { return localStorage.getItem(auraPoolKey(net.id)) || AURA_SWAP_DEFAULT_POOL[net.id] || ''; }
    catch { return AURA_SWAP_DEFAULT_POOL[net.id] || ''; }
  });
  const [tokenIn,  setTokenIn]  = React.useState<AuraTokenSide>({ mode: 'native', addr: '' });
  const [tokenOut, setTokenOut] = React.useState<AuraTokenSide>({ mode: 'token',  addr: '' });
  const [inInfo,  setInInfo]  = React.useState<{ symbol: string; decimals: number } | null>(null);
  const [outInfo, setOutInfo] = React.useState<{ symbol: string; decimals: number } | null>(null);
  const [inBal,  setInBal]  = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState('');
  const [slippage, setSlippage] = React.useState('1');

  const [poolId, setPoolId] = React.useState('');
  const [pool, setPool] = React.useState<AuraSwapPool | null>(null);
  const [poolLoading, setPoolLoading] = React.useState(false);
  const [poolError, setPoolError] = React.useState('');

  const [detectedTokens, setDetectedTokens] = React.useState<AuraSwapTokenInfo[]>([]);
  const [detectingTokens, setDetectingTokens] = React.useState(false);
  const [detectNonce, setDetectNonce] = React.useState(0);

  const [quoteRaw, setQuoteRaw] = React.useState('');
  const [quoting, setQuoting] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState('');
  const [allowanceOk, setAllowanceOk] = React.useState(true);

  const [gasSpeed, setGasSpeed] = React.useState<AseGasSpeed>('normal');
  const [customGwei, setCustomGwei] = React.useState('');

  const [swapping, setSwapping] = React.useState(false);
  const [swapProgress, setSwapProgress] = React.useState('');
  const [status, setStatus] = React.useState<{ type: 'success' | 'error'; msg: string; hash?: string; approveHash?: string } | null>(null);

  const mountedRef = React.useRef(true);
  React.useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  React.useEffect(() => { try { localStorage.setItem(auraPoolKey(net.id), poolAddr.trim()); } catch {} }, [poolAddr, net.id]);
  React.useEffect(() => {
    try { setPoolAddr(localStorage.getItem(auraPoolKey(net.id)) || AURA_SWAP_DEFAULT_POOL[net.id] || ''); }
    catch { setPoolAddr(AURA_SWAP_DEFAULT_POOL[net.id] || ''); }
  }, [net.id]);

  const poolValid = isValidAseAddress(poolAddr.trim());
  const inAddrEff  = auraTokenEff(tokenIn);
  const outAddrEff = auraTokenEff(tokenOut);
  const inValid  = tokenIn.mode === 'native'  || isValidAseAddress(tokenIn.addr.trim());
  const outValid = tokenOut.mode === 'native' || isValidAseAddress(tokenOut.addr.trim());
  const pairReady = poolValid && inValid && outValid
    && !(tokenIn.mode === 'native' && tokenOut.mode === 'native')
    && (tokenIn.mode !== 'token' || tokenIn.addr.trim()) && (tokenOut.mode !== 'token' || tokenOut.addr.trim())
    && inAddrEff.toLowerCase() !== outAddrEff.toLowerCase();

  React.useEffect(() => {
    setDetectedTokens([]);
    if (!poolValid) return;
    let cancelled = false;
    setDetectingTokens(true);
    (async () => {
      try {
        const list = await detectAuraSwapTokens(net, poolAddr.trim(), holderHex || undefined);
        if (!cancelled && mountedRef.current) setDetectedTokens(list);
      } catch { if (!cancelled && mountedRef.current) setDetectedTokens([]); }
      finally { if (!cancelled && mountedRef.current) setDetectingTokens(false); }
    })();
    return () => { cancelled = true; };
  }, [net, poolAddr, poolValid, holderHex, detectNonce]);

  const loadSideInfo = React.useCallback(async (side: AuraTokenSide, setInfo: (v: any) => void) => {
    if (side.mode === 'native') { setInfo({ symbol: net.symbol, decimals: 18 }); return; }
    const addr = side.addr.trim();
    if (!isValidAseAddress(addr)) { setInfo(null); return; }
    try {
      const r = await readAsentumToken(net, addr, holderHex);
      if (!mountedRef.current) return;
      if (r.symbol == null || r.decimals == null) { setInfo(null); return; }
      setInfo({ symbol: r.symbol, decimals: r.decimals });
    } catch { if (mountedRef.current) setInfo(null); }
  }, [net, holderHex]);

  React.useEffect(() => { loadSideInfo(tokenIn, setInInfo); }, [tokenIn.mode, tokenIn.addr]);
  React.useEffect(() => { loadSideInfo(tokenOut, setOutInfo); }, [tokenOut.mode, tokenOut.addr]);

  const refreshInBalance = React.useCallback(async () => {
    if (!holderHex && !holderBech32) return;
    try {
      if (tokenIn.mode === 'native') {
        const b = await getAsentumBalanceWithFallback(net, holderBech32 || holderHex);
        if (mountedRef.current) setInBal(String(b));
      } else if (isValidAseAddress(tokenIn.addr.trim())) {
        const r = await readAsentumToken(net, tokenIn.addr.trim(), holderHex);
        if (mountedRef.current) setInBal(r.ownerBalance ?? '0');
      } else { setInBal(null); }
    } catch { if (mountedRef.current) setInBal(null); }
  }, [net, holderHex, holderBech32, tokenIn.mode, tokenIn.addr]);
  React.useEffect(() => { refreshInBalance(); }, [refreshInBalance]);
  React.useEffect(() => {
    setPoolId(''); setPool(null); setPoolError(''); setQuoteRaw(''); setQuoteError('');
    if (!pairReady) return;
    let cancelled = false;
    setPoolLoading(true);
    (async () => {
      try {
        const id = await findAuraSwapPoolId(net, poolAddr.trim(), inAddrEff, outAddrEff);
        if (cancelled || !mountedRef.current) return;
        if (!id) { setPoolError('Pool untuk pasangan token ini belum ada di kontrak tersebut.'); return; }
        setPoolId(id);
        try { setPool(await readAuraSwapPool(net, poolAddr.trim(), id)); } catch { /* opsional, tidak fatal */ }
      } catch (e: any) {
        if (!cancelled && mountedRef.current) setPoolError(aseFriendlyError(e) || e?.message || 'Gagal membaca kontrak AuraSwap — cek address pool.');
      } finally { if (!cancelled && mountedRef.current) setPoolLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [net, poolAddr, pairReady, inAddrEff, outAddrEff]);

  React.useEffect(() => {
    setQuoteRaw(''); setQuoteError('');
    const s = amount.trim();
    if (!poolId || !inInfo || !s || !/^\d+(\.\d+)?$/.test(s) || Number(s) <= 0) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setQuoting(true);
      try {
        const raw = asentumUnitsFromDecimalString(s, inInfo.decimals).toString();
        const out = await getAuraSwapQuote(net, poolAddr.trim(), poolId, inAddrEff, raw);
        if (cancelled || !mountedRef.current) return;
        if (!(BigInt(out) > 0n)) { setQuoteError('Output 0 — jumlah terlalu kecil atau liquidity pool belum cukup.'); return; }
        setQuoteRaw(out);
        if (tokenIn.mode === 'token' && holderHex) {
          const allowed = await getAuraSwapAllowance(net, inAddrEff, holderHex, poolAddr.trim());
          if (!cancelled && mountedRef.current) setAllowanceOk(allowed >= BigInt(raw));
        } else if (mountedRef.current) setAllowanceOk(true);
      } catch (e: any) {
        if (!cancelled && mountedRef.current) setQuoteError(aseFriendlyError(e) || e?.message || 'Gagal mengambil quote.');
      } finally { if (!cancelled && mountedRef.current) setQuoting(false); }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [net, poolAddr, poolId, amount, inInfo, inAddrEff, tokenIn.mode, holderHex]);

  const flip = () => {
    setTokenIn(tokenOut); setTokenOut(tokenIn);
    setAmount(''); setQuoteRaw(''); setQuoteError(''); setStatus(null);
  };

  const spotRate = React.useMemo(() => {
    if (!pool || !inInfo || !outInfo) return null;
    try {
      const aIsToken0 = pool.token0.toLowerCase() === inAddrEff.toLowerCase();
      const [reserveInRaw, reserveOutRaw] = aIsToken0 ? [pool.reserve0, pool.reserve1] : [pool.reserve1, pool.reserve0];
      const reserveIn  = Number(asentumFormatUnits(reserveInRaw,  inInfo.decimals));
      const reserveOut = Number(asentumFormatUnits(reserveOutRaw, outInfo.decimals));
      if (!(reserveIn > 0) || !(reserveOut > 0)) return null;
      return reserveOut / reserveIn;
    } catch { return null; }
  }, [pool, inInfo, outInfo, inAddrEff]);
  const spotRateStr = spotRate == null ? null
    : spotRate < 0.000001 ? spotRate.toExponential(4)
    : spotRate.toLocaleString('en-US', { maximumFractionDigits: 6 });

  const slippageBps = (() => {
    const n = Number(slippage);
    if (!Number.isFinite(n) || n < 0) return 100;
    return Math.round(Math.min(n, 50) * 100);
  })();
  const minOutRaw = (() => {
    if (!quoteRaw) return '';
    try {
      const q = BigInt(quoteRaw);
      return (q - (q * BigInt(slippageBps)) / 10000n).toString();
    } catch { return ''; }
  })();

  const amountValid = (() => {
    const s = amount.trim();
    if (!s || !inInfo) return false;
    if (!/^\d+(\.\d+)?$/.test(s) || Number(s) <= 0) return false;
    const frac = s.split('.')[1] || '';
    if (frac.length > inInfo.decimals) return false;
    if (inBal != null) {
      try { return asentumUnitsFromDecimalString(s, inInfo.decimals) <= asentumUnitsFromDecimalString(inBal, inInfo.decimals); } catch { return false; }
    }
    return true;
  })();

  const gasReady = gasSpeed !== 'custom' || /^\d+(\.\d+)?$/.test(customGwei.trim());
  const canSwap = !swapping && poolValid && !!poolId && !!quoteRaw && !!minOutRaw && amountValid && gasReady;

  const doSwap = async () => {
    if (!canSwap || !inInfo) return;
    setSwapping(true); setStatus(null); setSwapProgress('Menyiapkan transaksi...');
    try {
      const raw = asentumUnitsFromDecimalString(amount.trim(), inInfo.decimals).toString();
      const gasOverride: AseGasOverride = { speed: gasSpeed, customMaxFeePerGasGwei: gasSpeed === 'custom' ? customGwei.trim() : undefined };
      const res = await executeAuraSwap(net, privateKey, poolAddr.trim(), poolId, inAddrEff, raw, minOutRaw, msg => { if (mountedRef.current) setSwapProgress(msg); }, gasOverride);
      if (!mountedRef.current) return;
      setStatus({ type: 'success', msg: `Swap terkirim — cek explorer untuk hasil akhir.`, hash: res.swapTxHash, approveHash: res.approveTxHash });
      setAmount(''); setQuoteRaw('');
      refreshInBalance();
    } catch (e: any) {
      if (mountedRef.current) setStatus({ type: 'error', msg: aseFriendlyError(e) || e?.message || 'Swap gagal.' });
    } finally { if (mountedRef.current) { setSwapping(false); setSwapProgress(''); } }
  };

  return (
    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
      <h3 style={{ fontSize:'13px', margin:0 }}><FaExchangeAlt style={{ marginRight:'6px' }}/>Swap (AuraSwap)</h3>
      <details style={{ background:'#070707', border:'1px solid #262626' }}>
        <summary style={{ cursor:'pointer', padding:'10px 12px', fontSize:'11px', color:'#888', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
          <span>Address Kontrak AuraSwap (pool){poolValid && <span style={{ color:'#444', fontFamily:'monospace', marginLeft:'6px' }}>· {shortAddr(poolAddr.trim())}</span>}</span>
          <span onClick={e => { e.preventDefault(); e.stopPropagation(); if (poolValid) setDetectNonce(n => n + 1); }} title="Deteksi ulang token listed di pool"
            style={{ fontSize:'10px', color: poolValid ? net.color : '#333', cursor: poolValid ? 'pointer' : 'default', fontWeight:'bold', flexShrink:0 }}>
            ↻ Deteksi ulang token
          </span>
        </summary>
        <div style={{ padding:'0 12px 12px' }}>
          <input placeholder="0x... / ase1..." value={poolAddr} onChange={e => setPoolAddr(e.target.value)}
            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', borderColor: poolAddr.trim() && !poolValid ? '#f44336' : undefined }}/>
          {poolAddr.trim() && !poolValid && <div style={{ fontSize:'10px', color:'#f44336', marginTop:'4px' }}>Address kontrak tidak valid.</div>}
        </div>
      </details>

      <AuraTokenSidePicker ctx={ctx} net={net} label="Dari" side={tokenIn} setSide={setTokenIn} info={inInfo} tokens={detectedTokens} detecting={detectingTokens}/>

      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
        <input type="number" min="0" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)}
          style={{ width:'100%', boxSizing:'border-box', fontSize:'14px' }}/>
        {inBal != null && inInfo && (
          <div style={{ fontSize:'10px', color:'#555', display:'flex', justifyContent:'space-between' }}>
            <span>Saldo: {arc20ShortAmt(inBal)} {inInfo.symbol}</span>
            <span onClick={() => setAmount(inBal)} style={{ color:net.color, cursor:'pointer', fontWeight:'bold' }}>MAX</span>
          </div>
        )}
      </div>

      <div style={{ display:'flex', justifyContent:'center' }}>
        <button onClick={flip} title="Tukar arah" style={{ background:'none', border:'1px solid #333', color:'#888', padding:'6px 10px', cursor:'pointer' }}>
          <FaArrowRight style={{ transform:'rotate(90deg)' }}/>
        </button>
      </div>

      <AuraTokenSidePicker ctx={ctx} net={net} label="Ke" side={tokenOut} setSide={setTokenOut} info={outInfo} tokens={detectedTokens} detecting={detectingTokens}/>

      <div>
        <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Estimasi diterima</label>
        <div style={{ background:'#070707', border:'1px solid #262626', padding:'10px 12px', fontSize:'14px', color: quoteRaw ? '#eee' : '#555' }}>
          {quoting ? <><FaSpinner size={11} style={{ animation:'spin 1s linear infinite', marginRight:'6px' }}/>Menghitung...</>
            : quoteRaw && outInfo ? `≈ ${asentumFormatUnits(quoteRaw, outInfo.decimals)} ${outInfo.symbol}`
            : poolLoading ? 'Mencari pool...' : '—'}
        </div>
        {spotRateStr && inInfo && outInfo && (
          <div style={{ fontSize:'10px', color:'#666', marginTop:'4px' }}>
            Rate: 1 {inInfo.symbol} ≈ {spotRateStr} {outInfo.symbol}
          </div>
        )}
        {quoteError && <div style={{ fontSize:'10px', color:'#f44336', marginTop:'4px' }}>{quoteError}</div>}
        {poolError && !poolLoading && <div style={{ fontSize:'10px', color:'#f44336', marginTop:'4px' }}>{poolError}</div>}
        {pool && <div style={{ fontSize:'10px', color:'#444', marginTop:'4px' }}>Pool #{pool.id} · fee {Number(pool.feeBps)/100}%</div>}
      </div>

      <div>
        <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}><FaSlidersH style={{ marginRight:'4px' }}/>Slippage tolerance (%)</label>
        <div style={{ display:'flex', gap:'6px' }}>
          {['0.5','1','3'].map(v => (
            <button key={v} onClick={() => setSlippage(v)} style={{
              flex:1, padding:'6px', fontSize:'11px', cursor:'pointer',
              background: slippage === v ? net.color : 'none', color: slippage === v ? '#fff' : '#888',
              border:`1px solid ${slippage === v ? net.color : '#333'}`,
            }}>{v}%</button>
          ))}
          <input type="number" min="0" max="50" value={slippage} onChange={e => setSlippage(e.target.value)}
            style={{ width:'70px', fontSize:'11px' }}/>
        </div>
        {minOutRaw && outInfo && (
          <div style={{ fontSize:'10px', color:'#555', marginTop:'4px' }}>Minimum diterima: {asentumFormatUnits(minOutRaw, outInfo.decimals)} {outInfo.symbol}</div>
        )}
      </div>

      <AuraGasFeePicker ctx={ctx} net={net} gasLimit={AURA_SWAP_GAS_LIMIT} speed={gasSpeed} setSpeed={setGasSpeed} customGwei={customGwei} setCustomGwei={setCustomGwei}/>

      {!allowanceOk && tokenIn.mode === 'token' && (
        <div style={{ fontSize:'11px', color:'#ffaa00', display:'flex', alignItems:'center', gap:'6px' }}>
          <FaExclamationTriangle size={11}/> Perlu approve() dulu — tombol Swap di bawah akan mengirim approve lalu swap sekaligus (2 transaksi).
        </div>
      )}

      <button onClick={doSwap} disabled={!canSwap}
        style={{ width:'100%', padding:'12px', background: swapping ? '#0a0a1a' : net.color, color:'#fff', border:'none', cursor: canSwap ? 'pointer' : 'not-allowed', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: canSwap ? 1 : 0.5 }}>
        {swapping
          ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> {swapProgress || 'Swapping...'}</>
          : <><FaExchangeAlt/> Swap</>}
      </button>

      {status && (
        <div style={{
          fontSize:'12px', padding:'10px 12px', border:`1px solid ${status.type === 'success' ? '#4caf5044' : '#f4433644'}`,
          borderLeft:`3px solid ${status.type === 'success' ? '#4caf50' : '#f44336'}`, color: status.type === 'success' ? '#8fd98f' : '#ff8a80',
          display:'flex', flexDirection:'column', gap:'4px',
        }}>
          <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            {status.type === 'success' ? <FaCheckCircle size={11}/> : <FaExclamationTriangle size={11}/>} {status.msg}
          </span>
          {status.approveHash && (
            <a href={`${net.explorerUrl}/tx/${status.approveHash}`} target="_blank" rel="noreferrer" style={{ color:'#7a7aff', fontSize:'11px' }}>
              Tx approve: {status.approveHash.slice(0,18)}…
            </a>
          )}
          {status.hash && (
            <a href={`${net.explorerUrl}/tx/${status.hash}`} target="_blank" rel="noreferrer" style={{ color:'#7a7aff', fontSize:'11px' }}>
              Tx swap: {status.hash.slice(0,18)}…
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function AuraGasFeePicker({ ctx, net, gasLimit, speed, setSpeed, customGwei, setCustomGwei }: {
  ctx: any; net: any; gasLimit: bigint; speed: AseGasSpeed; setSpeed: (v: AseGasSpeed) => void;
  customGwei: string; setCustomGwei: (v: string) => void;
}) {
  const { FaGasPump, FaSpinner } = ctx;
  const [preview, setPreview] = React.useState<{ feeAse: number; isFallback: boolean } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const mountedRef = React.useRef(true);
  React.useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  React.useEffect(() => {
    if (speed === 'custom' && !/^\d+(\.\d+)?$/.test(customGwei.trim())) { setPreview(null); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const p = await previewAseGasFee(net, gasLimit, speed === 'custom' ? { speed, customMaxFeePerGasGwei: customGwei.trim() } : { speed });
        if (!cancelled && mountedRef.current) setPreview({ feeAse: p.feeAse, isFallback: p.isFallback });
      } catch { if (!cancelled && mountedRef.current) setPreview(null); }
      finally { if (!cancelled && mountedRef.current) setLoading(false); }
    }, speed === 'custom' ? 500 : 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, gasLimit.toString(), speed, customGwei]);

  const tab = (v: AseGasSpeed, label: string) => (
    <button onClick={() => setSpeed(v)} style={{
      flex:1, padding:'6px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
      background: speed === v ? net.color : 'none', color: speed === v ? '#fff' : '#888',
      border:`1px solid ${speed === v ? net.color : '#333'}`,
    }}>{label}</button>
  );

  return (
    <div>
      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}><FaGasPump style={{ marginRight:'4px' }}/>Gas Fee</label>
      <div style={{ display:'flex', gap:'6px', marginBottom:'6px' }}>
        {tab('normal', 'Normal')}
        {tab('fast', 'Cepat')}
        {tab('custom', 'Custom')}
      </div>
      {speed === 'custom' && (
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
          <input type="number" min="0" placeholder="mis. 2" value={customGwei} onChange={e => setCustomGwei(e.target.value)}
            style={{ flex:1, fontSize:'12px' }}/>
          <span style={{ fontSize:'11px', color:'#555' }}>Gwei (maxFeePerGas)</span>
        </div>
      )}
      <div style={{ fontSize:'10px', color:'#555' }}>
        {loading ? <><FaSpinner size={9} style={{ animation:'spin 1s linear infinite', marginRight:'4px' }}/>Menghitung estimasi fee...</>
          : preview ? <>Estimasi fee (batas atas): ~{preview.feeAse.toFixed(6)} {net.symbol}{preview.isFallback ? ' · baseFee fallback (RPC lambat baca chain info)' : ''}</>
          : speed === 'custom' ? 'Isi Gwei buat lihat estimasi fee.' : '—'}
      </div>
    </div>
  );
}

function AseLiquidityPanel({ ctx, net, privateKey, holderHex, holderBech32 }: {
  ctx: any; net: any; privateKey: string; holderHex: string; holderBech32: string;
}) {
  const { FaLayerGroup, FaSpinner, FaExclamationTriangle, FaCheckCircle, FaPlus } = ctx;

  const [poolAddr, setPoolAddr] = React.useState<string>(() => {
    try { return localStorage.getItem(auraPoolKey(net.id)) || AURA_SWAP_DEFAULT_POOL[net.id] || ''; }
    catch { return AURA_SWAP_DEFAULT_POOL[net.id] || ''; }
  });
  React.useEffect(() => { try { localStorage.setItem(auraPoolKey(net.id), poolAddr.trim()); } catch { /* storage penuh/diblokir */ } }, [poolAddr, net.id]);
  React.useEffect(() => {
    try { setPoolAddr(localStorage.getItem(auraPoolKey(net.id)) || AURA_SWAP_DEFAULT_POOL[net.id] || ''); }
    catch { setPoolAddr(AURA_SWAP_DEFAULT_POOL[net.id] || ''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net.id]);

  const [lpMode, setLpMode] = React.useState<'add' | 'remove'>('add');

  const [tokenA, setTokenA] = React.useState<AuraTokenSide>({ mode: 'native', addr: '' });
  const [tokenB, setTokenB] = React.useState<AuraTokenSide>({ mode: 'token',  addr: '' });
  const [infoA, setInfoA] = React.useState<{ symbol: string; decimals: number } | null>(null);
  const [infoB, setInfoB] = React.useState<{ symbol: string; decimals: number } | null>(null);
  const [balA, setBalA] = React.useState<string | null>(null);
  const [balB, setBalB] = React.useState<string | null>(null);
  const [amtA, setAmtA] = React.useState('');
  const [amtB, setAmtB] = React.useState('');
  const [lastEdited, setLastEdited] = React.useState<'a' | 'b'>('a');

  const [poolId, setPoolId] = React.useState('');
  const [pool, setPool] = React.useState<AuraSwapPool | null>(null);
  const [poolLoading, setPoolLoading] = React.useState(false);
  const [poolMissing, setPoolMissing] = React.useState(false);
  const [poolError, setPoolError] = React.useState('');
  const [myShares, setMyShares] = React.useState<string | null>(null);

  const [detectedTokens, setDetectedTokens] = React.useState<AuraSwapTokenInfo[]>([]);
  const [detectingTokens, setDetectingTokens] = React.useState(false);
  const [detectNonce, setDetectNonce] = React.useState(0);

  const [positions, setPositions] = React.useState<AuraSwapPosition[] | null>(null);
  const [positionsLoading, setPositionsLoading] = React.useState(false);
  const [positionsError, setPositionsError] = React.useState('');
  const [posNonce, setPosNonce] = React.useState(0);

  const [creatingPool, setCreatingPool] = React.useState(false);
  const [feeBps, setFeeBps] = React.useState('30');
  const [removeAmt, setRemoveAmt] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const [status, setStatus] = React.useState<{ type: 'success' | 'error'; msg: string; hashes?: string[] } | null>(null);

  const [gasSpeed, setGasSpeed] = React.useState<AseGasSpeed>('normal');
  const [customGwei, setCustomGwei] = React.useState('');
  const gasReady = gasSpeed !== 'custom' || /^\d+(\.\d+)?$/.test(customGwei.trim());
  const gasOverride = (): AseGasOverride => ({ speed: gasSpeed, customMaxFeePerGasGwei: gasSpeed === 'custom' ? customGwei.trim() : undefined });

  const mountedRef = React.useRef(true);
  React.useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const poolValid = isValidAseAddress(poolAddr.trim());
  const addrA = auraTokenEff(tokenA);
  const addrB = auraTokenEff(tokenB);
  const aValid = tokenA.mode === 'native' || isValidAseAddress(tokenA.addr.trim());
  const bValid = tokenB.mode === 'native' || isValidAseAddress(tokenB.addr.trim());
  const pairReady = poolValid && aValid && bValid
    && !(tokenA.mode === 'native' && tokenB.mode === 'native')
    && (tokenA.mode !== 'token' || tokenA.addr.trim()) && (tokenB.mode !== 'token' || tokenB.addr.trim())
    && addrA.toLowerCase() !== addrB.toLowerCase();
  React.useEffect(() => {
    setDetectedTokens([]);
    if (!poolValid) return;
    let cancelled = false;
    setDetectingTokens(true);
    (async () => {
      try {
        const list = await detectAuraSwapTokens(net, poolAddr.trim(), holderHex || undefined);
        if (!cancelled && mountedRef.current) setDetectedTokens(list);
      } catch { if (!cancelled && mountedRef.current) setDetectedTokens([]); }
      finally { if (!cancelled && mountedRef.current) setDetectingTokens(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, poolAddr, poolValid, holderHex, detectNonce]);

  const symbolFor = React.useCallback((addr: string) => {
    if (isAuraSwapNative(addr)) return net.symbol;
    const hit = detectedTokens.find(t => t.address.toLowerCase() === addr.toLowerCase());
    return hit ? hit.symbol : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }, [detectedTokens, net.symbol]);

  React.useEffect(() => {
    setPositions(null); setPositionsError('');
    if (!poolValid || !holderHex) return;
    let cancelled = false;
    setPositionsLoading(true);
    (async () => {
      try {
        const list = await detectAuraSwapPositions(net, poolAddr.trim(), holderHex);
        if (!cancelled && mountedRef.current) setPositions(list);
      } catch (e: any) {
        if (!cancelled && mountedRef.current) setPositionsError(aseFriendlyError(e) || e?.message || 'Gagal memindai posisi LP.');
      } finally { if (!cancelled && mountedRef.current) setPositionsLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, poolAddr, poolValid, holderHex, posNonce]);
  
  const openPosition = (pos: AuraSwapPosition) => {
    const t0Native = isAuraSwapNative(pos.pool.token0);
    const t1Native = isAuraSwapNative(pos.pool.token1);
    setTokenA(t0Native ? { mode: 'native', addr: '' } : { mode: 'token', addr: pos.pool.token0 });
    setTokenB(t1Native ? { mode: 'native', addr: '' } : { mode: 'token', addr: pos.pool.token1 });
    setPoolId(pos.poolId); setPool(pos.pool); setMyShares(pos.shares); setPoolMissing(false);
    setLpMode('remove'); setStatus(null);
  };

  const loadSideInfo = React.useCallback(async (side: AuraTokenSide, setInfo: (v: any) => void) => {
    if (side.mode === 'native') { setInfo({ symbol: net.symbol, decimals: 18 }); return; }
    const addr = side.addr.trim();
    if (!isValidAseAddress(addr)) { setInfo(null); return; }
    try {
      const r = await readAsentumToken(net, addr, holderHex);
      if (!mountedRef.current) return;
      if (r.symbol == null || r.decimals == null) { setInfo(null); return; }
      setInfo({ symbol: r.symbol, decimals: r.decimals });
    } catch { if (mountedRef.current) setInfo(null); }
  }, [net, holderHex]);
  React.useEffect(() => { loadSideInfo(tokenA, setInfoA); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tokenA.mode, tokenA.addr]);
  React.useEffect(() => { loadSideInfo(tokenB, setInfoB); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tokenB.mode, tokenB.addr]);

  const loadSideBalance = React.useCallback(async (side: AuraTokenSide, setBal: (v: string | null) => void) => {
    if (!holderHex && !holderBech32) return;
    try {
      if (side.mode === 'native') {
        const b = await getAsentumBalanceWithFallback(net, holderBech32 || holderHex);
        if (mountedRef.current) setBal(String(b));
      } else if (isValidAseAddress(side.addr.trim())) {
        const r = await readAsentumToken(net, side.addr.trim(), holderHex);
        if (mountedRef.current) setBal(r.ownerBalance ?? '0');
      } else { setBal(null); }
    } catch { if (mountedRef.current) setBal(null); }
  }, [net, holderHex, holderBech32]);
  React.useEffect(() => { loadSideBalance(tokenA, setBalA); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tokenA.mode, tokenA.addr, loadSideBalance]);
  React.useEffect(() => { loadSideBalance(tokenB, setBalB); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tokenB.mode, tokenB.addr, loadSideBalance]);

  React.useEffect(() => {
    setPoolId(''); setPool(null); setPoolError(''); setPoolMissing(false); setMyShares(null);
    if (!pairReady) return;
    let cancelled = false;
    setPoolLoading(true);
    (async () => {
      try {
        const id = await findAuraSwapPoolId(net, poolAddr.trim(), addrA, addrB);
        if (cancelled || !mountedRef.current) return;
        if (!id) { setPoolMissing(true); return; }
        setPoolId(id);
        const p = await readAuraSwapPool(net, poolAddr.trim(), id);
        if (cancelled || !mountedRef.current) return;
        setPool(p);
        if (holderHex) {
          const s = await getAuraSwapShares(net, poolAddr.trim(), id, holderHex);
          if (!cancelled && mountedRef.current) setMyShares(s);
        }
      } catch (e: any) {
        if (!cancelled && mountedRef.current) setPoolError(aseFriendlyError(e) || e?.message || 'Gagal membaca kontrak AuraSwap — cek address pool.');
      } finally { if (!cancelled && mountedRef.current) setPoolLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [net, poolAddr, pairReady, addrA, addrB, lpMode]);

  React.useEffect(() => {
    if (!pool || !infoA || !infoB) return;
    const r0 = BigInt(pool.reserve0 || '0'); const r1 = BigInt(pool.reserve1 || '0');
    if (r0 <= 0n || r1 <= 0n) return;
    const aIsToken0 = pool.token0.toLowerCase() === addrA.toLowerCase();
    const [rA, rB] = aIsToken0 ? [r0, r1] : [r1, r0];
    try {
      if (lastEdited === 'a') {
        const s = amtA.trim();
        if (!/^\d+(\.\d+)?$/.test(s) || Number(s) <= 0) return;
        const unitsA = asentumUnitsFromDecimalString(s, infoA.decimals);
        const unitsB = (unitsA * rB) / rA;
        setAmtB(asentumFormatUnits(unitsB.toString(), infoB.decimals));
      } else {
        const s = amtB.trim();
        if (!/^\d+(\.\d+)?$/.test(s) || Number(s) <= 0) return;
        const unitsB = asentumUnitsFromDecimalString(s, infoB.decimals);
        const unitsA = (unitsB * rA) / rB;
        setAmtA(asentumFormatUnits(unitsA.toString(), infoA.decimals));
      }
    } catch {}
  }, [amtA, amtB, lastEdited, pool, infoA, infoB, addrA]);

  const spotRateAB = React.useMemo(() => {
    if (!pool || !infoA || !infoB) return null;
    try {
      const aIsToken0 = pool.token0.toLowerCase() === addrA.toLowerCase();
      const [reserveARaw, reserveBRaw] = aIsToken0 ? [pool.reserve0, pool.reserve1] : [pool.reserve1, pool.reserve0];
      const reserveA = Number(asentumFormatUnits(reserveARaw, infoA.decimals));
      const reserveB = Number(asentumFormatUnits(reserveBRaw, infoB.decimals));
      if (!(reserveA > 0) || !(reserveB > 0)) return null;
      return reserveB / reserveA;
    } catch { return null; }
  }, [pool, infoA, infoB, addrA]);
  const spotRateABStr = spotRateAB == null ? null
    : spotRateAB < 0.000001 ? spotRateAB.toExponential(4)
    : spotRateAB.toLocaleString('en-US', { maximumFractionDigits: 6 });

  const amountsValid = (() => {
    if (!infoA || !infoB) return false;
    const sa = amtA.trim(), sb = amtB.trim();
    if (!/^\d+(\.\d+)?$/.test(sa) || Number(sa) <= 0) return false;
    if (!/^\d+(\.\d+)?$/.test(sb) || Number(sb) <= 0) return false;
    try {
      if (balA != null && asentumUnitsFromDecimalString(sa, infoA.decimals) > asentumUnitsFromDecimalString(balA, infoA.decimals)) return false;
      if (balB != null && asentumUnitsFromDecimalString(sb, infoB.decimals) > asentumUnitsFromDecimalString(balB, infoB.decimals)) return false;
      return true;
    } catch { return false; }
  })();

  const doCreatePool = async () => {
    if (!pairReady) return;
    setCreatingPool(true); setStatus(null); setProgress('Membuat pool baru...');
    try {
      const fee = Math.max(0, Math.min(9999, parseInt(feeBps, 10) || 30));
      const res = await createAuraSwapPool(net, privateKey, poolAddr.trim(), addrA, addrB, fee, msg => { if (mountedRef.current) setProgress(msg); }, gasOverride());
      if (!mountedRef.current) return;
      setPoolId(res.poolId); setPoolMissing(false);
      setStatus({ type: 'success', msg: `Pool baru dibuat (#${res.poolId}). Sekarang isi jumlah di atas untuk setor likuiditas pertama.`, hashes: [res.txHash] });
      const p = await readAuraSwapPool(net, poolAddr.trim(), res.poolId).catch(() => null);
      if (p && mountedRef.current) setPool(p);
    } catch (e: any) {
      if (mountedRef.current) setStatus({ type: 'error', msg: aseFriendlyError(e) || e?.message || 'Gagal membuat pool.' });
    } finally { if (mountedRef.current) { setCreatingPool(false); setProgress(''); } }
  };

  const doAddLiquidity = async () => {
    if (!poolId || !infoA || !infoB || !amountsValid) return;
    setBusy(true); setStatus(null); setProgress('Menyiapkan transaksi...');
    try {
      const unitsA = asentumUnitsFromDecimalString(amtA.trim(), infoA.decimals).toString();
      const unitsB = asentumUnitsFromDecimalString(amtB.trim(), infoB.decimals).toString();
      const aIsToken0 = pool ? pool.token0.toLowerCase() === addrA.toLowerCase() : true;
      const [tok0, amt0, tok1, amt1] = aIsToken0 ? [addrA, unitsA, addrB, unitsB] : [addrB, unitsB, addrA, unitsA];
      const res = await addAuraSwapLiquidity(net, privateKey, poolAddr.trim(), poolId, tok0, amt0, tok1, amt1, msg => { if (mountedRef.current) setProgress(msg); }, gasOverride());
      if (!mountedRef.current) return;
      setStatus({ type: 'success', msg: 'Likuiditas berhasil ditambahkan.', hashes: [...res.approveTxHashes, res.txHash] });
      setAmtA(''); setAmtB('');
      loadSideBalance(tokenA, setBalA); loadSideBalance(tokenB, setBalB);
      const [p, s] = await Promise.all([readAuraSwapPool(net, poolAddr.trim(), poolId), getAuraSwapShares(net, poolAddr.trim(), poolId, holderHex)]);
      if (mountedRef.current) { setPool(p); setMyShares(s); }
    } catch (e: any) {
      if (mountedRef.current) setStatus({ type: 'error', msg: aseFriendlyError(e) || e?.message || 'Gagal menambah likuiditas.' });
    } finally { if (mountedRef.current) { setBusy(false); setProgress(''); } }
  };

  const removeValid = (() => {
    const s = removeAmt.trim();
    if (!s || !/^\d+$/.test(s) || !(BigInt(s) > 0n)) return false;
    if (myShares != null) { try { return BigInt(s) <= BigInt(myShares); } catch { return false; } }
    return true;
  })();

  const doRemoveLiquidity = async () => {
    if (!poolId || !removeValid) return;
    setBusy(true); setStatus(null); setProgress('Menyiapkan transaksi...');
    try {
      const res = await removeAuraSwapLiquidity(net, privateKey, poolAddr.trim(), poolId, removeAmt.trim(), msg => { if (mountedRef.current) setProgress(msg); }, gasOverride());
      if (!mountedRef.current) return;
      setStatus({ type: 'success', msg: 'Likuiditas berhasil ditarik.', hashes: [res.txHash] });
      setRemoveAmt('');
      const [p, s] = await Promise.all([readAuraSwapPool(net, poolAddr.trim(), poolId), getAuraSwapShares(net, poolAddr.trim(), poolId, holderHex)]);
      if (mountedRef.current) { setPool(p); setMyShares(s); }
    } catch (e: any) {
      if (mountedRef.current) setStatus({ type: 'error', msg: aseFriendlyError(e) || e?.message || 'Gagal menarik likuiditas.' });
    } finally { if (mountedRef.current) { setBusy(false); setProgress(''); } }
  };

  const modeTab = (m: 'add' | 'remove', label: string) => (
    <button onClick={() => { setLpMode(m); setStatus(null); }} style={{
      flex:1, padding:'8px', fontSize:'12px', fontWeight:'bold', cursor:'pointer',
      background: lpMode === m ? net.color : 'none', color: lpMode === m ? '#fff' : '#888',
      border:`1px solid ${lpMode === m ? net.color : '#333'}`,
    }}>{label}</button>
  );

  return (
    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
      <h3 style={{ fontSize:'13px', margin:0 }}><FaLayerGroup style={{ marginRight:'6px' }}/>Likuiditas (AuraSwap LP)</h3>

      <details style={{ background:'#070707', border:'1px solid #262626' }}>
        <summary style={{ cursor:'pointer', padding:'10px 12px', fontSize:'11px', color:'#888', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
          <span>Address Kontrak AuraSwap (pool){poolValid && <span style={{ color:'#444', fontFamily:'monospace', marginLeft:'6px' }}>· {shortAddr(poolAddr.trim())}</span>}</span>
          <span onClick={e => { e.preventDefault(); e.stopPropagation(); if (poolValid) { setDetectNonce(n => n + 1); setPosNonce(n => n + 1); } }} title="Deteksi ulang token & posisi LP"
            style={{ fontSize:'10px', color: poolValid ? net.color : '#333', cursor: poolValid ? 'pointer' : 'default', fontWeight:'bold', flexShrink:0 }}>
            ↻ Deteksi ulang
          </span>
        </summary>
        <div style={{ padding:'0 12px 12px' }}>
          <input placeholder="0x... / ase1..." value={poolAddr} onChange={e => setPoolAddr(e.target.value)}
            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', borderColor: poolAddr.trim() && !poolValid ? '#f44336' : undefined }}/>
          {poolAddr.trim() && !poolValid && <div style={{ fontSize:'10px', color:'#f44336', marginTop:'4px' }}>Address kontrak tidak valid.</div>}
        </div>
      </details>

      {poolValid && (
        <div style={{ background:'#070707', border:'1px solid #262626', padding:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ fontSize:'11px', color:'#888', fontWeight:'bold' }}>Posisi LP kamu (auto-detect)</div>
          {positionsLoading && (
            <div style={{ fontSize:'11px', color:'#555', display:'flex', alignItems:'center', gap:'6px' }}>
              <FaSpinner size={11} style={{ animation:'spin 1s linear infinite' }}/> Memindai semua pool di kontrak ini...
            </div>
          )}
          {!positionsLoading && positionsError && <div style={{ fontSize:'11px', color:'#f44336' }}>{positionsError}</div>}
          {!positionsLoading && !positionsError && positions && positions.length === 0 && (
            <div style={{ fontSize:'11px', color:'#444' }}>Belum ada LP share di kontrak ini untuk wallet yang aktif.</div>
          )}
          {!positionsLoading && positions && positions.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {positions.map(pos => (
                <div key={pos.poolId} onClick={() => openPosition(pos)} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px',
                  padding:'8px 10px', background:'#0d0d0d', border:'1px solid #1e1e1e', cursor:'pointer',
                }}>
                  <div style={{ fontSize:'12px', color:'#ddd' }}>
                    {symbolFor(pos.pool.token0)} / {symbolFor(pos.pool.token1)}
                    <span style={{ color:'#444', marginLeft:'6px' }}>Pool #{pos.poolId}</span>
                  </div>
                  <div style={{ fontSize:'11px', color:net.color, fontWeight:'bold' }}>{pos.shares} share</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display:'flex', gap:'6px' }}>
        {modeTab('add', 'Tambah Likuiditas')}
        {modeTab('remove', 'Tarik Likuiditas')}
      </div>

      <AuraTokenSidePicker ctx={ctx} net={net} label="Token A" side={tokenA} setSide={setTokenA} info={infoA} tokens={detectedTokens} detecting={detectingTokens}/>
      <AuraTokenSidePicker ctx={ctx} net={net} label="Token B" side={tokenB} setSide={setTokenB} info={infoB} tokens={detectedTokens} detecting={detectingTokens}/>

      {poolLoading && (
        <div style={{ fontSize:'11px', color:'#555', display:'flex', alignItems:'center', gap:'6px' }}>
          <FaSpinner size={11} style={{ animation:'spin 1s linear infinite' }}/> Mencari pool untuk pasangan ini...
        </div>
      )}
      {poolError && !poolLoading && <div style={{ fontSize:'11px', color:'#f44336' }}>{poolError}</div>}
      {pool && (
        <div style={{ fontSize:'10px', color:'#444' }}>
          Pool #{pool.id} · fee {Number(pool.feeBps)/100}%
          {spotRateABStr && infoA && infoB && <> · Rate: 1 {infoA.symbol} ≈ {spotRateABStr} {infoB.symbol}</>}
        </div>
      )}
      {myShares != null && <div style={{ fontSize:'10px', color:'#555' }}>LP share kamu di pool ini: {myShares}</div>}

      {poolMissing && !poolLoading && pairReady && (
        <div style={{ background:'#070707', border:'1px solid #262626', padding:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ fontSize:'11px', color:'#ffaa00', display:'flex', alignItems:'center', gap:'6px' }}>
            <FaExclamationTriangle size={11}/> Pool untuk pasangan token ini belum ada di kontrak tersebut.
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <label style={{ fontSize:'11px', color:'#555' }}>Fee pool (bps, mis. 30 = 0.30%)</label>
            <input type="number" min="0" max="9999" value={feeBps} onChange={e => setFeeBps(e.target.value)} style={{ width:'80px', fontSize:'11px' }}/>
          </div>
          <button onClick={doCreatePool} disabled={creatingPool || !gasReady}
            style={{ padding:'10px', background: creatingPool ? '#0a0a1a' : net.color, color:'#fff', border:'none', cursor: (creatingPool || !gasReady) ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
            {creatingPool ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> {progress || 'Membuat pool...'}</> : <><FaPlus/> Buat Pool Baru</>}
          </button>
        </div>
      )}

      {poolValid && (
        <AuraGasFeePicker ctx={ctx} net={net} gasLimit={AURA_SWAP_GAS_LIMIT} speed={gasSpeed} setSpeed={setGasSpeed} customGwei={customGwei} setCustomGwei={setCustomGwei}/>
      )}

      {lpMode === 'add' && poolId && (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'11px', color:'#555' }}>Jumlah {infoA?.symbol ?? 'Token A'}</label>
            <input type="number" min="0" placeholder="0.0" value={amtA} onChange={e => { setAmtA(e.target.value); setLastEdited('a'); }}
              style={{ width:'100%', boxSizing:'border-box', fontSize:'14px' }}/>
            {balA != null && infoA && (
              <div style={{ fontSize:'10px', color:'#555', display:'flex', justifyContent:'space-between' }}>
                <span>Saldo: {arc20ShortAmt(balA)} {infoA.symbol}</span>
                <span onClick={() => { setAmtA(balA); setLastEdited('a'); }} style={{ color:net.color, cursor:'pointer', fontWeight:'bold' }}>MAX</span>
              </div>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'11px', color:'#555' }}>Jumlah {infoB?.symbol ?? 'Token B'}</label>
            <input type="number" min="0" placeholder="0.0" value={amtB} onChange={e => { setAmtB(e.target.value); setLastEdited('b'); }}
              style={{ width:'100%', boxSizing:'border-box', fontSize:'14px' }}/>
            {balB != null && infoB && (
              <div style={{ fontSize:'10px', color:'#555', display:'flex', justifyContent:'space-between' }}>
                <span>Saldo: {arc20ShortAmt(balB)} {infoB.symbol}</span>
                <span onClick={() => { setAmtB(balB); setLastEdited('b'); }} style={{ color:net.color, cursor:'pointer', fontWeight:'bold' }}>MAX</span>
              </div>
            )}
          </div>
          {pool && BigInt(pool.reserve0 || '0') > 0n && (
            <div style={{ fontSize:'10px', color:'#444' }}>Jumlah sisi lain otomatis dihitung mengikuti rasio reserve pool saat ini.</div>
          )}
          <button onClick={doAddLiquidity} disabled={busy || !amountsValid || !gasReady}
            style={{ width:'100%', padding:'12px', background: busy ? '#0a0a1a' : net.color, color:'#fff', border:'none', cursor: (busy || !amountsValid || !gasReady) ? 'not-allowed' : 'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: (busy || !amountsValid || !gasReady) ? 0.5 : 1 }}>
            {busy ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> {progress || 'Memproses...'}</> : <><FaLayerGroup/> Tambah Likuiditas</>}
          </button>
        </>
      )}

      {lpMode === 'remove' && poolId && (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'11px', color:'#555' }}>Jumlah LP share yang ditarik</label>
            <input type="number" min="0" placeholder="0" value={removeAmt} onChange={e => setRemoveAmt(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box', fontSize:'14px' }}/>
            {myShares != null && (
              <div style={{ fontSize:'10px', color:'#555', display:'flex', justifyContent:'space-between' }}>
                <span>Share kamu: {myShares}</span>
                <span onClick={() => setRemoveAmt(myShares)} style={{ color:net.color, cursor:'pointer', fontWeight:'bold' }}>MAX</span>
              </div>
            )}
          </div>
          <button onClick={doRemoveLiquidity} disabled={busy || !removeValid || !gasReady}
            style={{ width:'100%', padding:'12px', background: busy ? '#0a0a1a' : net.color, color:'#fff', border:'none', cursor: (busy || !removeValid || !gasReady) ? 'not-allowed' : 'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: (busy || !removeValid || !gasReady) ? 0.5 : 1 }}>
            {busy ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> {progress || 'Memproses...'}</> : <><FaLayerGroup/> Tarik Likuiditas</>}
          </button>
        </>
      )}

      {status && (
        <div style={{
          fontSize:'12px', padding:'10px 12px', border:`1px solid ${status.type === 'success' ? '#4caf5044' : '#f4433644'}`,
          borderLeft:`3px solid ${status.type === 'success' ? '#4caf50' : '#f44336'}`, color: status.type === 'success' ? '#8fd98f' : '#ff8a80',
          display:'flex', flexDirection:'column', gap:'4px',
        }}>
          <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            {status.type === 'success' ? <FaCheckCircle size={11}/> : <FaExclamationTriangle size={11}/>} {status.msg}
          </span>
          {(status.hashes || []).map((h, i) => (
            <a key={i} href={`${net.explorerUrl}/tx/${h}`} target="_blank" rel="noreferrer" style={{ color:'#7a7aff', fontSize:'11px' }}>
              Tx: {h.slice(0,18)}…
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AseSendAssetSection({ ctx, net, privateKey, holderHex, holderBech32, savedTokens, nativeContent }: {
  ctx: any; net: any; privateKey: string; holderHex: string; holderBech32: string; savedTokens?: any[]; nativeContent: any;
}) {
  const { FaPaperPlane, FaCoins, FaExchangeAlt, FaLayerGroup } = ctx;
  const [assetMode, setAssetMode] = React.useState<'native' | 'token' | 'swap' | 'lp'>('native');
  const [tokenOpened, setTokenOpened] = React.useState(false);
  const [swapOpened, setSwapOpened] = React.useState(false);
  const [lpOpened, setLpOpened] = React.useState(false);

  const tabStyle = (active: boolean): any => ({
    flex:1, padding:'8px', fontSize:'12px', fontWeight:'bold', cursor:'pointer',
    background: active ? net.color : 'none',
    color: active ? '#fff' : '#888',
    border: `1px solid ${active ? net.color : '#333'}`,
  });

  return (
    <>
      <div style={{ display:'flex', gap:'6px' }}>
        <button onClick={() => setAssetMode('native')} style={tabStyle(assetMode === 'native')}>
          <FaPaperPlane style={{ marginRight:'6px' }}/>Native ({net.symbol})
        </button>
        <button onClick={() => { setAssetMode('token'); setTokenOpened(true); }} style={tabStyle(assetMode === 'token')}>
          <FaCoins style={{ marginRight:'6px' }}/>Token (ARC-20)
        </button>
        <button onClick={() => { setAssetMode('swap'); setSwapOpened(true); }} style={tabStyle(assetMode === 'swap')}>
          <FaExchangeAlt style={{ marginRight:'6px' }}/>Swap
        </button>
        <button onClick={() => { setAssetMode('lp'); setLpOpened(true); }} style={tabStyle(assetMode === 'lp')}>
          <FaLayerGroup style={{ marginRight:'6px' }}/>LP
        </button>
      </div>

      {assetMode === 'native' && nativeContent}

      {tokenOpened && (
        <div style={{ display: assetMode === 'token' ? 'flex' : 'none', flexDirection:'column', gap:'14px' }}>
          <AseArc20Panel ctx={ctx} net={net} privateKey={privateKey} holderHex={holderHex} holderBech32={holderBech32} savedTokens={savedTokens} />
        </div>
      )}

      {swapOpened && (
        <div style={{ display: assetMode === 'swap' ? 'flex' : 'none', flexDirection:'column', gap:'14px' }}>
          <AseSwapPanel ctx={ctx} net={net} privateKey={privateKey} holderHex={holderHex} holderBech32={holderBech32} />
        </div>
      )}

      {lpOpened && (
        <div style={{ display: assetMode === 'lp' ? 'flex' : 'none', flexDirection:'column', gap:'14px' }}>
          <AseLiquidityPanel ctx={ctx} net={net} privateKey={privateKey} holderHex={holderHex} holderBech32={holderBech32} />
        </div>
      )}
    </>
  );
}

export function TransferTab({ ctx }: { ctx: WalletGeneratorCtx }) {
  const {
    AXIOME_NETWORK, AXIOME_NETWORKS, COSMOS_NETWORK, COSMOS_NETWORKS, GRAM_NETWORK, GRAM_NETWORKS,
    SUI_NETWORK, SUI_NETWORKS, APTOS_NETWORK, APTOS_NETWORKS, FaBolt, FaCheckCircle, 
    FaChevronDown, FaChevronUp, FaCoins, FaCopy, FaExchangeAlt, FaExclamationTriangle, FaFaucet, 
    FaGasPump, FaGlobe, FaInfoCircle, FaKey, FaLayerGroup, FaLink, FaNetworkWired, FaPaperPlane, 
    FaPlug, FaPlus, FaQrcode, FaRocket, FaSpinner, FaSync, FaTrash, LAMPORTS_PER_SOL, SOLANA_NETWORK, 
    SOLANA_NETWORKS, TOKEN_2022_PROGRAM_ID, TRON_NETWORKS, activeTab, agHistory, atomAddress, 
    atomBalance, atomConnect, atomConnected, atomConnecting, atomDisconnect, atomFeeEstimate, 
    atomFeeEstimateError, atomLoadingBal, atomMaxLoading, atomNetId, atomPrivKey, atomRefreshBalance, atomSend, 
    atomSendAmt, atomSendTo, atomSending, atomSetMaxAmount, atomStatus, atomWalletSel, axmAddress, axmBalance, 
    axmConnect, axmConnected, axmConnecting, axmDisconnect, axmFeeEstimate, axmFeeEstimateError, 
    axmFeeEstimating, axmLoadingBal, axmMaxLoading, axmNetId, axmPrivKey, axmRefreshBalance, axmSend, axmSendAmt, 
    axmSendTo, axmSending, axmSetMaxAmount, axmStatus, axmWalletSel, 
    suiAddress, suiBalance, suiConnect, suiConnected, suiConnecting, suiDisconnect,
    suiLoadingBal, suiMaxLoading, suiNetId, suiPrivKey, setSuiPrivKey, suiRefreshBalance, suiSend, suiSendAmt, setSuiSendAmt, suiSendTo, setSuiSendTo, suiSending, suiSetMaxAmount,
    suiStatus, suiWalletSel, setSuiWalletSel, handleSuiWalletSel, switchSuiNetwork,
    aptAddress, aptBalance, aptConnect, aptConnected, aptConnecting, aptDisconnect,
    aptLoadingBal, aptMaxLoading, aptNetId, aptPrivKey, setAptPrivKey, aptRefreshBalance, aptSend, aptSendAmt, setAptSendAmt, aptSendTo, setAptSendTo, aptSending, aptSetMaxAmount,
    aptStatus, aptWalletSel, setAptWalletSel, handleAptWalletSel, switchAptNetwork,
    ASENTUM_NETWORK, ASENTUM_NETWORKS, aseAddress, aseBalance, aseConnect, aseConnected, aseConnecting, aseDisconnect,
    aseLoadingBal, aseMaxLoading, aseNetId, asePrivKey, setAsePrivKey, aseRefreshBalance, aseSend, aseSendAmt, setAseSendAmt, aseSendTo, setAseSendTo, aseSending, aseSetMaxAmount,
    aseStatus, aseWalletSel, setAseWalletSel, handleAseWalletSel, switchAseNetwork, aseFaucetLoading, aseRequestFaucet,
    aseFeeEstimate, aseFeeEstimating, aseFeeEstimateError, aseRefreshFeeEstimate,
    aseMode, setAseMode, aseIsValidAddr, uiStyle, setUiStyle, aseTokens = [],
    aseMultiRows, aseMultiRunning, aseMultiEqualAmt, setAseMultiEqualAmt,
    aseMultiAddRow, aseMultiRemoveRow, aseMultiUpdateRow, aseMultiApplyEqual, aseMultiSend,
    aseSweepDestAddr, setAseSweepDestAddr, aseSweepAmtMode, setAseSweepAmtMode,
    aseSweepFixedAmt, setAseSweepFixedAmt, aseSweepLeaveBuf, setAseSweepLeaveBuf,
    aseSweepSources, aseSweepManualPK, setAseSweepManualPK, aseSweepRunning,
    aseSweepDelayMs, setAseSweepDelayMs, aseSweepFetchingBal,
    aseSweepAddFromBIP39, aseSweepAddManualPK, aseSweepRemoveSource, aseSweepFetchBalances, aseSweepRun,
    gramAddress, gramBalance, gramConnect, gramConnected, gramConnecting, gramDisconnect, 
    gramLoadingBal, gramNetId, gramPrivKey, gramRefreshBalance, gramSend, gramSendAmt, gramSendTo, 
    gramMemo, setGramMemo, 
    gramSending, gramStatus, gramWalletSel, handleGramWalletSel, setGramPrivKey, setGramSendAmt, 
    setGramSendTo, setGramWalletSel, switchGramNetwork, gramConnectVersion, setGramConnectVersion, 
    gramFeeEstimate, gramFeeEstimateError, gramFeeEstimating, gramMaxLoading, gramSetMaxAmount, 
    gramSendMode, setGramSendMode, gramJettonMaster, setGramJettonMaster, gramJettonTo, setGramJettonTo, 
    gramJettonAmt, setGramJettonAmt, gramJettonComment, setGramJettonComment, gramJettonSending, gramJettonStatus, 
    gramJettonMeta, gramJettonMetaLoading, gramJettonMetaError, gramJettonFeeEstimate, gramJettonFeeEstimating, 
    gramJettonFeeEstimateError, gramJettonDetected, gramJettonDetectedLoading, gramLoadDetectedJettons, 
    gramSelectJetton, gramSendJetton, gramJettonPickerOpen, setGramJettonPickerOpen, 
    gramSwapAssets, gramSwapAssetsLoading, gramSwapAssetsError, gramLoadSwapAssets, 
    gramSwapFrom, gramSwapTo, gramSwapAmt, setGramSwapAmt, gramSwapSlippage, setGramSwapSlippage, 
    gramSwapQuote, gramSwapQuoting, gramSwapQuoteError, gramSwapFeeEstimate, gramSwapFeeEstimating, 
    gramSwapFeeEstimateError, gramSwapGasCheck, gramSwapInsufficientBalance, gramSwapAvailableBalance, 
    gramSwapSending, gramSwapStatus, setGramSwapPickerOpen, 
    gramSwapFlip, gramExecuteSwap, gramSwapMaxLoading, gramSwapSetMaxAmount, 
    FaSlidersH, FaArrowRight, FaWallet, 
    renderGasFiatBadge, gasFiatCcy, setGasFiatCcy, solDestAtaExists, solDestAtaChecking, SOL_TOKEN_ACCOUNT_RENT_LAMPORTS,
    copiedKey, copyText, ethers, handleAtomWalletSel, 
    handleAxmWalletSel, handleSolWalletSel, handleTronWalletSel, handleTxWalletSel, highlightFaucet, 
    isValidTronAddress, knownTxTokens, networks, openTronFaucet, renderAssetSelector, 
    renderAtomGasFeeBox, renderGasFeeBox, renderSolAssetSelector, search, selectedNetwork, 
    selectedSolToken, selectedTxToken, setAtomPrivKey, setAtomSendAmt, setAtomSendTo, setAtomWalletSel, 
    setAxmPrivKey, setAxmSendAmt, setAxmSendTo, setAxmWalletSel, setQrAddress, setSolCloseBurnFirst, 
    setSolCloseFilter, setSolCloseSearch, setSolMode, setSolMultiEqualAmt, setSolPrivKey, 
    setSolSendAmt, setSolSendTo, setSolSweepAmtMode, setSolSweepDelayMs, setSolSweepDestAddr, 
    setSolSweepFixedAmt, setSolSweepLeaveBuf, setSolSweepManualPK, setSolWalletSel, setSweepAdvanced, 
    setSweepAmtMode, setSweepDelayMs, setSweepDestAddr, setSweepFixedAmt, setSweepLeaveGas, 
    setSweepManualPK, setTronAsset, setTronMode, setTronMultiEqualAmt, setTronPrivKey, setTronSendAmt, 
    setTronSendTo, setTronSweepAmtMode, setTronSweepDestAddr, setTronSweepFixedAmt, 
    setTronSweepLeaveBuf, setTronSweepManualPK, setTronWalletSel, setTxChain, setTxMode, 
    setTxMultiEqualAmt, setTxNetworkId, setTxPrivKey, setTxSendAmt, setTxSendTo, setTxWalletSel, 
    solAddress, solAsset, solBalance, solCloseAccounts, solCloseAllRunning, solCloseBurnFirst, 
    solCloseFilter, solCloseLoading, solCloseSearch, solCloseSelected, solCloseSelectedAccounts, 
    solCloseToggleSelect, solCloseToggleSelectAll, solCloseTokenAccount, solClosingId, solConnect, 
    solConnected, solConnecting, solDisconnect, solFaucetLoading, solFetchCloseAccounts, solIsToken, 
    solIsValidAddr, solLoadingBal, solMaxLoading, solMode, solMultiAddRow, solMultiApplyEqual, solMultiEqualAmt, 
    solMultiRemoveRow, solMultiRows, solMultiRunning, solMultiSend, solMultiUpdateRow, solNetId, 
    solPrivKey, solRefreshBalance, solRequestAirdrop, solSend, solSendAmt, solSendTo, solSending, solSetMaxAmount, 
    solStatus, solSweepAddFromBIP39, solSweepAddManualPK, solSweepAmtMode, solSweepDelayMs, 
    solSweepDestAddr, solSweepFetchBalances, solSweepFetchingBal, solSweepFixedAmt, solSweepLeaveBuf, 
    solSweepManualPK, solSweepRemoveSource, solSweepRun, solSweepRunning, solSweepSources, 
    solWalletSel, sunToTrx, sweepAddFromBIP39, sweepAddManualPK, sweepAdvanced, sweepAmtMode, 
    sweepDelayMs, sweepDestAddr, sweepFetchBalances, sweepFetchingBal, sweepFixedAmt, sweepLeaveGas, 
    sweepManualPK, sweepRemoveSource, sweepRun, sweepRunning, sweepSources, switchAtomNetwork, 
    switchAxmNetwork, switchSolNetwork, switchTronNetwork, trc20Tokens, tronAddress, tronAsset, 
    tronAssetBal, tronAssetBalLoading, tronBalance, tronConnect, tronConnected, tronConnecting, 
    tronDisconnect, tronFeeEstimate, tronFeeEstimateError, tronFeeEstimating, tronLoadingBal, tronMaxLoading, tronMode, 
    tronMultiAddRow, tronMultiApplyEqual, tronMultiEqualAmt, tronMultiRemoveRow, tronMultiRows, 
    tronMultiRunning, tronMultiSend, tronMultiUpdateRow, tronNetId, tronNetwork, tronPrivKey, 
    tronRefreshBalance, tronRefreshResources, tronResources, tronResourcesLoading, tronSend, 
    tronSendAmt, tronSendTo, tronSending, tronSetMaxAmount, tronStatus, tronSweepAddFromBIP39, tronSweepAddManualPK, 
    tronSweepAmtMode, tronSweepDestAddr, tronSweepFetchBalances, tronSweepFetchingBal, 
    tronSweepFixedAmt, tronSweepLeaveBuf, tronSweepManualPK, tronSweepRemoveSource, tronSweepRun, 
    tronSweepRunning, tronSweepSources, tronWalletSel, txAddress, txAsset, txBalance, txChain, 
    txConnect, txConnected, txConnecting, txDisconnect, txIsToken, txLoadingBal, txMaxLoading, txMode, 
    txMultiAddRow, txMultiApplyEqual, txMultiEqualAmt, txMultiRemoveRow, txMultiRows, txMultiRunning, 
    txMultiSend, txMultiUpdateRow, txNetworkId, txPrivKey, txRefreshBalance, txSend, txSendAmt, 
    txSendTo, txSending, txSetMaxAmount, txStatus, txStatusColor, txWalletSel, txSendAssetMode, wallets,
    txWalletHistory, txWalletHistoryLoading, txWalletHistoryError, txLoadWalletHistory,
    txTokenDetail, txTokenDetailLoading, txTokenDetailError,
    txApproveSpender, setTxApproveSpender, txApproveAmt, setTxApproveAmt,
    txApproveUnlimited, setTxApproveUnlimited, txApproving, txRevokingSpender,
    txApproveStatus, txAllowanceResult, txAllowanceChecking,
    txCheckAllowance, txApproveToken, txRevokeApproval, txApprovalHistoryForToken,
  } = ctx;

  let aseHexAddress = '';
  try { aseHexAddress = aseAddress ? asentumBech32ToHex(aseAddress) : ''; } catch { aseHexAddress = ''; }

  const [gramSwapFlipSpin, setGramSwapFlipSpin] = React.useState(false);
  const handleGramSwapFlip = () => {
    setGramSwapFlipSpin(true);
    gramSwapFlip();
    setTimeout(() => setGramSwapFlipSpin(false), 300);
  };

  const gramSwapFromHolding = gramSwapFrom && gramSwapFrom.kind !== 'ton'
    ? gramJettonDetected.find(t => t.address === gramSwapFrom.address)
    : null;
  const gramSwapFromBalanceLabel = !gramSwapFrom
    ? null
    : gramSwapFrom.kind === 'ton'
      ? (gramBalance === '—' || gramBalance === 'Error' ? null : gramBalance)
      : (gramSwapFromHolding ? `${gramSwapFromHolding.balanceFormatted} ${gramSwapFrom.symbol}` : '0 ' + gramSwapFrom.symbol);

  const gramSwapButtonLabel = (() => {
    if (gramSwapSending) return 'Swapping...';
    if (!gramSwapFrom || !gramSwapTo) return 'Pilih Token';
    if (!gramSwapAmt) return 'Masukkan Jumlah';
    if (gramSwapQuoting && !gramSwapQuote) return 'Menghitung Quote...';
    if (!gramSwapQuote) return 'Quote Tidak Tersedia';
    return `Swap ${gramSwapFrom.symbol} → ${gramSwapTo.symbol}`;
  })();

  const activeTheme = getUiTheme(String(uiStyle || 'default'));
  const isThemed = !!activeTheme.css;
  const uiAccent = chainAccent(String(txChain));

  return (
        <div className="px-scope" data-ui={activeTheme.id}
          style={isThemed ? ({ ['--ui-accent' as any]: uiAccent, ['--ui-accent-dim' as any]: uiAccent + '66' } as React.CSSProperties) : undefined}>
          {activeTheme.css && <style>{activeTheme.css(themeScope(activeTheme.id))}</style>}

          {/* ── Pengaturan gaya tampilan (khusus tab Send / Receive) ── */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap',
            background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #01a2ff',
            padding:'10px 16px', marginBottom:'16px',
          }}>
            <div style={{ fontSize:'12px', color:'#888' }}>
              <strong style={{ color:'#ccc' }}>Gaya tampilan</strong> — hanya berlaku di Send / Receive, tersimpan otomatis.
            </div>
            <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px', flexWrap:'wrap' }}>
              {UI_THEMES.map(t => (
                <button key={t.id} onClick={() => setUiStyle(t.id)} style={{
                  padding:'7px 14px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'bold',
                  background: activeTheme.id === t.id ? '#01a2ff' : 'transparent',
                  color: activeTheme.id === t.id ? '#000' : '#666',
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'8px' }}>
              <FaNetworkWired style={{ marginRight:'5px' }}/>Ganti Network
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {CHAIN_OPTIONS.map(opt => {
                const isActive = txChain === opt.id;
                if (opt.soon) {
                  return (
                    <button key={opt.id} disabled title="Segera hadir"
                      style={{ background:'none', border:'1px dashed #262626', color:'#3a3a3a', padding:'8px 14px', fontSize:'11px', cursor:'not-allowed', display:'flex', alignItems:'center', gap:'5px' }}>
                      {opt.label} <span style={{ fontSize:'9px', color:'#333' }}>SOON</span>
                    </button>
                  );
                }
                const chainColor = opt.id === 'sol' ? '#9945FF' : opt.id === 'tron' ? '#EF0027' : opt.id === 'axm' ? '#75bbe9' : opt.id === 'gram' ? '#0088CC' : opt.id === 'sui' ? '#4DA2FF' : opt.id === 'apt' ? '#00D2AA' : opt.id === 'ase' ? '#4949DF' : '#01a2ff';
                return (
                  <button key={opt.id}
                    onClick={() => setTxChain(opt.id as ChainKind)}
                    style={{
                      background:   isActive ? chainColor : 'none',
                      color:        isActive ? (opt.id === 'tron' || opt.id === 'axm' || opt.id === 'gram' ? '#fff' : '#000') : '#888',
                      border:       `1px solid ${isActive ? chainColor : '#333'}`,
                      padding:'8px 16px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {txChain === 'evm' && (
          <>
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'6px' }}>
              <FaGlobe style={{ marginRight:'4px' }}/>Network
            </label>
            <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
              <select
                value={txNetworkId}
                onChange={e => { if (txConnected) txDisconnect(); setTxNetworkId(e.target.value); }}
                style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px' }}
              >
                {networks.map(n => (
                  <option key={n.id} value={n.id}>{n.name} · {n.symbol} · Chain {n.chainId}</option>
                ))}
              </select>
              {selectedNetwork && (
                <span style={{ fontSize:'11px', color:'#555', fontFamily:'monospace', whiteSpace:'nowrap' }}>
                  Chain {selectedNetwork.chainId}
                </span>
              )}
              {selectedNetwork?.explorerUrl && (
                <a href={selectedNetwork.explorerUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#01a2ff', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              )}
            </div>
          </div>

          {!txConnected ? (
            <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
              <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                <FaPlug style={{ marginRight:'8px' }}/>Connect ke {selectedNetwork?.name}
              </h2>
              {wallets.length > 0 && (
                <div style={{ marginBottom:'14px' }}>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet tersimpan</label>
                  <select value={txWalletSel} onChange={e => handleTxWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                    <option value="">-- Pilih address --</option>
                    {wallets.flatMap((w, wi) =>
                      w.addresses.map(a => (
                        <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                          {w.name} · #{a.index} · {a.address.slice(0,14)}...
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
              <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                <FaKey style={{ marginRight:'4px' }}/>Private Key
              </label>
              <input
                type="password"
                placeholder="0x..."
                value={txPrivKey}
                onChange={e => { setTxPrivKey(e.target.value); setTxWalletSel(''); }}
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
              />
              <button onClick={txConnect} disabled={txConnecting || !txPrivKey.trim()}
                style={{ width:'100%', padding:'12px', background:txConnecting?'#1a1a2a':selectedNetwork?.color??'#01a2ff', color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!txPrivKey.trim()?0.5:1 }}>
                {txConnecting
                  ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                  : <><FaPlug/> Connect</>}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${selectedNetwork?.color??'#01a2ff'}`, padding:'20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                  <div>
                    <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                    <div style={{ fontSize:'26px', fontWeight:'bold', fontFamily:'monospace', color:'#fff', lineHeight:1 }}>
                      {txLoadingBal ? '···' : txBalance}
                    </div>
                  </div>
                  <button onClick={() => txRefreshBalance()} disabled={txLoadingBal}
                    style={{ background:'none', border:'1px solid #333', color:'#666', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                    <FaSync size={10} style={{ animation:txLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                  </button>
                </div>
                <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #161616', display:'flex', alignItems:'center', gap:'8px' }}>
                  <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {txAddress}
                  </code>
                  <button onClick={() => copyText(txAddress, 'tx_addr')}
                    style={{ background:'none', border:'1px solid #333', color:copiedKey==='tx_addr'?'#4caf50':'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                    {copiedKey==='tx_addr' ? <FaCheckCircle/> : <FaCopy/>}
                  </button>
                  <button onClick={() => setQrAddress(txAddress)} title="QR Code"
                    style={{ background:'none', border:'1px solid #333', color:'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                    <FaQrcode size={11}/>
                  </button>
                  {selectedNetwork?.explorerUrl && (
                    <a href={`${selectedNetwork.explorerUrl}/address/${txAddress}`} target="_blank" rel="noreferrer"
                      style={{ color:'#555', padding:'4px 8px', border:'1px solid #333', display:'flex', flexShrink:0 }}
                      title="Lihat di Explorer">
                      <FaLink size={11}/>
                    </a>
                  )}
                </div>
              </div>

              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px', marginBottom:'20px' }}>
                  {([
                    ['single', <FaPaperPlane key="i" size={11}/>, 'Kirim'],
                    ['multi',  <FaLayerGroup key="i" size={11}/>, 'Multi Send'],
                    ['sweep',  <FaExchangeAlt key="i" size={11}/>, 'Sweep'],
                  ] as const).map(([m, icon, label]) => (
                    <button key={m} onClick={() => setTxMode(m)} style={{
                      flex:1, padding:'9px 8px', background: txMode===m ? (selectedNetwork?.color??'#01a2ff') : 'transparent',
                      border:'none', color: txMode===m ? '#000' : '#666',
                      cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', transition:'all 0.15s',
                    }}>{icon}{label}</button>
                  ))}
                </div>

                {renderAssetSelector()}

                {txMode === 'single' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Ke address</label>
                      <input type="text" placeholder="0x..." value={txSendTo}
                        onChange={e => setTxSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                    </div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>
                          Jumlah {txAsset === 'native' ? (selectedNetwork?.symbol ?? 'ETH') : (knownTxTokens.find(t=>t.address.toLowerCase()===txAsset.toLowerCase())?.symbol ?? 'token')}
                        </label>
                        <button onClick={txSetMaxAmount} disabled={txMaxLoading || !txConnected}
                          style={{ background:'none', border:'1px solid #333', color:txMaxLoading?'#555':'#01a2ff', padding:'2px 8px', cursor:(txMaxLoading||!txConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!txConnected?0.4:1 }}>
                          {txMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.001" step="0.0001" min="0" value={txSendAmt}
                        onChange={e => setTxSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace' }}/>
                    </div>

                    {renderGasFeeBox()}

                    <button onClick={txSend} disabled={txSending || !txSendTo || !txSendAmt || (txSendAssetMode==='token' && txAsset==='native')}
                      style={{ padding:'13px', background:txSending?'#1a1a2a':selectedNetwork?.color??'#01a2ff', color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!txSendTo||!txSendAmt||(txSendAssetMode==='token'&&txAsset==='native'))?0.5:1 }}>
                      {txSending
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                        : (txSendAssetMode==='token' && txAsset==='native')
                          ? <><FaCoins/> Pilih Token Dulu</>
                          : <><FaPaperPlane/> {txAsset === 'native' ? 'Kirim Transaksi' : 'Kirim Token'}</>}
                    </button>

                    {txStatus.type !== 'idle' && (
                      <div style={{ background:'#0a0a0a', border:`1px solid ${txStatusColor}44`, borderLeft:`3px solid ${txStatusColor}`, padding:'12px', fontSize:'12px', fontFamily:'monospace', color:txStatusColor }}>
                        {txStatus.type === 'pending' && <span style={{ marginRight:'6px', animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                        {txStatus.type === 'success' && '✓ '}
                        {txStatus.type === 'error'   && '✗ '}
                        {txStatus.msg}
                        {txStatus.hash && (
                          <div style={{ marginTop:'6px' }}>
                            {selectedNetwork?.explorerUrl && (
                              <a href={`${selectedNetwork.explorerUrl}/tx/${txStatus.hash}`} target="_blank" rel="noreferrer"
                                style={{ color:'#01a2ff', fontSize:'11px' }}>
                                Lihat di {selectedNetwork.name} Explorer ↗
                              </a>
                            )}
                            <div style={{ fontSize:'10px', color:'#555', marginTop:'3px', wordBreak:'break-all' }}>
                              {txStatus.hash}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {txMode === 'multi' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>
                        Jumlah rata ({txIsToken ? selectedTxToken!.symbol : (selectedNetwork?.symbol ?? 'ETH')}):
                      </label>
                      <input type="number" placeholder="0.001" step="0.0001" min="0" value={txMultiEqualAmt}
                        onChange={e => setTxMultiEqualAmt(e.target.value)}
                        style={{ width:'110px', fontFamily:'monospace', fontSize:'12px' }}/>
                      <button onClick={txMultiApplyEqual} disabled={!txMultiEqualAmt}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 12px', cursor:'pointer', fontSize:'11px', opacity:!txMultiEqualAmt?0.4:1 }}>
                        Terapkan ke semua baris
                      </button>
                    </div>

                    {/* Rows */}
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {txMultiRows.map((row, idx) => {
                        const statusColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336' }[row.status];
                        return (
                          <div key={row.id} style={{ display:'grid', gridTemplateColumns:'1fr 110px 60px 26px', gap:'6px', alignItems:'center' }}>
                            <input type="text" placeholder={`0x... #${idx+1}`} value={row.to}
                              onChange={e => txMultiUpdateRow(row.id, 'to', e.target.value)}
                              style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background: row.status==='failed'?'#1a0000':row.status==='success'?'#001a00':'#0d0d0d', border:`1px solid ${row.status!=='idle'?statusColor+'44':'#1e1e1e'}` }}/>
                            <input type="number" placeholder="0.001" step="0.0001" min="0" value={row.amount}
                              onChange={e => txMultiUpdateRow(row.id, 'amount', e.target.value)}
                              style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background:'#0d0d0d', border:'1px solid #1e1e1e' }}/>
                            <div style={{ fontSize:'10px', fontWeight:'bold', color:statusColor, fontFamily:'monospace', textAlign:'center' }}>
                              {row.status === 'idle'    && '—'}
                              {row.status === 'pending' && '⟳'}
                              {row.status === 'success' && '✓'}
                              {row.status === 'failed'  && '✗'}
                            </div>
                            <button onClick={() => txMultiRemoveRow(row.id)} disabled={txMultiRows.length === 1}
                              style={{ background:'none', border:'1px solid #2a2a2a', color:'#f44336', padding:'6px', cursor: txMultiRows.length===1?'not-allowed':'pointer', fontSize:'11px', opacity:txMultiRows.length===1?0.3:1 }}>
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button onClick={txMultiAddRow} disabled={txMultiRunning}
                      style={{ alignSelf:'flex-start', background:'none', border:'none', color:'#01a2ff', padding:'2px 0', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px' }}>
                      <FaPlus size={10}/> Tambah baris
                    </button>

                    {/* TX hashes */}
                    {txMultiRows.some(r => r.hash || r.error) && (
                      <div style={{ background:'#070707', border:'1px solid #1a1a1a', padding:'10px 12px', fontSize:'11px', fontFamily:'monospace', display:'flex', flexDirection:'column', gap:'5px' }}>
                        {txMultiRows.filter(r => r.hash || r.error).map(r => (
                          <div key={r.id + '_log'}>
                            {r.hash && (
                              <span style={{ color:'#4caf50' }}>
                                ✓ {shortAddr(r.to)} —{' '}
                                {selectedNetwork?.explorerUrl
                                  ? <a href={`${selectedNetwork.explorerUrl}/tx/${r.hash}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>{r.hash.slice(0,18)}…</a>
                                  : r.hash.slice(0,22)+'…'
                                }
                              </span>
                            )}
                            {r.error && <span style={{ color:'#f44336' }}>✗ {shortAddr(r.to)} — {r.error.slice(0,80)}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {renderGasFeeBox()}

                    <button onClick={txMultiSend}
                      disabled={txMultiRunning || txMultiRows.every(r => !r.to || !r.amount) || (txSendAssetMode==='token' && txAsset==='native')}
                      style={{
                        padding:'13px', background:txMultiRunning?'#1a1a2a':'#01a2ff', color:'#000', border:'none',
                        cursor:txMultiRunning?'wait':'pointer', fontSize:'14px', fontWeight:'bold',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
                        opacity: (txMultiRows.every(r=>!r.to||!r.amount) || (txSendAssetMode==='token' && txAsset==='native')) ? 0.5 : 1,
                      }}>
                      {txMultiRunning
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim {txMultiRows.filter(r=>r.status==='success').length}/{txMultiRows.filter(r=>ethers.utils.isAddress(r.to)&&parseFloat(r.amount)>0).length}...</>
                        : (txSendAssetMode==='token' && txAsset==='native')
                          ? <><FaCoins/> Pilih Token Dulu</>
                          : <><FaPaperPlane/> Kirim {txMultiRows.filter(r=>ethers.utils.isAddress(r.to)&&parseFloat(r.amount)>0).length || txMultiRows.length} {txIsToken ? 'Token' : 'Transaksi'}</>}
                    </button>
                    <div style={{ fontSize:'10px', color:'#444', textAlign:'center' }}>
                      Dikirim satu per satu — tiap TX menunggu konfirmasi sebelum lanjut ke baris berikutnya.
                    </div>
                  </div>
                )}

                {/* ── Sweep Mode ── */}
                {txMode === 'sweep' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div style={{ fontSize:'11px', color:'#888', lineHeight:'1.6' }}>
                      {txIsToken
                        ? <>Kirim saldo token <strong style={{ color:'#ccc' }}>{selectedTxToken!.symbol}</strong> dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet sumber tetap butuh sedikit {selectedNetwork?.symbol ?? 'native coin'} untuk gas — yang tidak cukup otomatis di-skip.</>
                        : <>Kirim saldo dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet dengan saldo lebih kecil dari biaya gas otomatis di-skip.</>}
                    </div>

                    {/* Destination address */}
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                        Address tujuan (penerima)
                      </label>
                      <input type="text" placeholder="0x... (address yang akan menerima semua dana)"
                        value={sweepDestAddr} onChange={e => setSweepDestAddr(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px',
                          borderColor: sweepDestAddr && !ethers.utils.isAddress(sweepDestAddr) ? '#f44336' : undefined }}/>
                      {sweepDestAddr && !ethers.utils.isAddress(sweepDestAddr) && (
                        <div style={{ fontSize:'10px', color:'#f44336', marginTop:'3px' }}>Address tidak valid</div>
                      )}
                    </div>

                    {/* Amount mode */}
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'6px' }}>Jumlah yang dikirim</label>
                      <div style={{ display:'flex', gap:'8px', marginBottom: sweepAmtMode ? '8px' : 0 }}>
                        {([['all','Semua Saldo'],['fixed','Jumlah Tetap']] as const).map(([m, label]) => (
                          <button key={m} onClick={() => setSweepAmtMode(m)} style={{
                            padding:'7px 14px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
                            background: sweepAmtMode===m ? '#00e676' : 'transparent',
                            border:`1px solid ${sweepAmtMode===m ? '#00e676' : '#333'}`,
                            color: sweepAmtMode===m ? '#000' : '#666',
                          }}>{label}</button>
                        ))}
                      </div>
                      {sweepAmtMode === 'all' && (
                        txIsToken ? (
                          <div style={{ fontSize:'10px', color:'#444' }}>
                            Seluruh saldo {selectedTxToken!.symbol} tiap wallet akan dikirim (gas dibayar terpisah pakai {selectedNetwork?.symbol ?? 'native coin'}).
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>Sisakan untuk gas:</label>
                            <input type="number" placeholder="0.0005" step="0.0001" min="0"
                              value={sweepLeaveGas} onChange={e => setSweepLeaveGas(e.target.value)}
                              style={{ width:'120px', fontFamily:'monospace', fontSize:'12px' }}/>
                            <span style={{ fontSize:'10px', color:'#444' }}>{selectedNetwork?.symbol ?? 'ETH'}</span>
                          </div>
                        )
                      )}
                      {sweepAmtMode === 'fixed' && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>Per wallet:</label>
                          <input type="number" placeholder="0.001" step="0.0001" min="0"
                            value={sweepFixedAmt} onChange={e => setSweepFixedAmt(e.target.value)}
                            style={{ width:'120px', fontFamily:'monospace', fontSize:'12px' }}/>
                          <span style={{ fontSize:'10px', color:'#444' }}>{txIsToken ? selectedTxToken!.symbol : (selectedNetwork?.symbol ?? 'ETH')}</span>
                        </div>
                      )}
                    </div>

                    {/* Source wallets */}
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Wallet sumber ({sweepSources.length})</label>
                        {sweepSources.length > 0 && (
                          <button onClick={sweepFetchBalances} disabled={sweepFetchingBal}
                            style={{ background:'none', border:'1px solid #00e67633', color:sweepFetchingBal?'#333':'#00e676', padding:'3px 10px', cursor:'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaSync size={9} style={{ animation:sweepFetchingBal?'spin 1s linear infinite':undefined }}/> {sweepFetchingBal?'Checking...':'Cek Balance'}
                          </button>
                        )}
                      </div>

                      <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
                        <select defaultValue="" onChange={e => { sweepAddFromBIP39(e.target.value); e.target.value=''; }}
                          style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}>
                          <option value="">＋ Tambah dari Wallet BIP39...</option>
                          {wallets.map((w, wi) => w.addresses.map(a => {
                            const id = `bip39_${wi}_${a.index}`;
                            const already = sweepSources.some(s => s.id === id);
                            return (
                              <option key={id} value={`${wi},${a.index}`} disabled={already}>
                                {already ? '✓ ' : ''} [{w.name}] #{a.index} {a.address.slice(0,10)}…{a.address.slice(-4)}
                              </option>
                            );
                          }))}
                        </select>
                      </div>

                      <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                        <input type="password" placeholder="Atau private key manual (0x...)"
                          value={sweepManualPK} onChange={e => setSweepManualPK(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sweepAddManualPK()}
                          style={{ flex:1, fontFamily:'monospace', fontSize:'11px' }}/>
                        <button onClick={sweepAddManualPK} disabled={!sweepManualPK.trim()}
                          style={{ background:'none', border:'1px solid #00e67644', color:'#00e676', padding:'6px 14px', cursor:sweepManualPK.trim()?'pointer':'not-allowed', fontSize:'11px', fontWeight:'bold', opacity:sweepManualPK.trim()?1:0.4 }}>
                          Tambah
                        </button>
                      </div>

                      {sweepSources.length === 0 ? (
                        <div style={{ color:'#333', fontSize:'11px', textAlign:'center', padding:'16px 0', border:'1px dashed #1a1a1a' }}>
                          Belum ada wallet sumber.
                        </div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                          {sweepSources.map((s, idx) => {
                            const stColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336', skipped:'#888' }[s.status];
                            return (
                              <div key={s.id} style={{ display:'grid', gridTemplateColumns:'20px 1fr auto auto', gap:'6px', alignItems:'center', background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'7px 10px' }}>
                                <span style={{ fontSize:'10px', color:'#444', textAlign:'right' }}>{idx+1}</span>
                                <div style={{ minWidth:0 }}>
                                  <div style={{ fontFamily:'monospace', fontSize:'11px', color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</div>
                                  {s.balance && <div style={{ fontSize:'10px', color:'#4caf50', fontFamily:'monospace' }}>{s.balance}</div>}
                                  {s.hash && selectedNetwork?.explorerUrl && (
                                    <a href={`${selectedNetwork.explorerUrl}/tx/${s.hash}`} target="_blank" rel="noreferrer"
                                      style={{ fontSize:'10px', color:'#01a2ff' }}>✓ {s.hash.slice(0,16)}…</a>
                                  )}
                                  {s.error && <div style={{ fontSize:'10px', color: s.status==='skipped'?'#888':'#f44336', marginTop:'2px', lineHeight:'1.4' }}>{s.error}</div>}
                                </div>
                                <span style={{ fontSize:'10px', fontWeight:'bold', color:stColor, whiteSpace:'nowrap', minWidth:'46px', textAlign:'center' }}>
                                  {s.status === 'idle' && '—'}
                                  {s.status === 'pending' && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                                  {s.status === 'success' && '✓ OK'}
                                  {s.status === 'failed' && '✗ Fail'}
                                  {s.status === 'skipped' && '⊘ Skip'}
                                </span>
                                <button onClick={() => sweepRemoveSource(s.id)} disabled={sweepRunning}
                                  style={{ background:'none', border:'1px solid #2a2a2a', color:'#f44336', padding:'4px 7px', cursor:sweepRunning?'not-allowed':'pointer', fontSize:'11px', opacity:sweepRunning?0.3:1 }}>
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Advanced (delay) */}
                    <div>
                      <button onClick={() => setSweepAdvanced(p => !p)}
                        style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px', padding:0 }}>
                        {sweepAdvanced ? <FaChevronUp size={9}/> : <FaChevronDown size={9}/>} Pengaturan lanjutan
                      </button>
                      {sweepAdvanced && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginTop:'10px' }}>
                          <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>Delay antar TX:</label>
                          <input type="number" value={sweepDelayMs} min="0" step="500"
                            onChange={e => setSweepDelayMs(parseInt(e.target.value)||0)}
                            style={{ width:'80px', fontFamily:'monospace', fontSize:'12px' }}/>
                          {([0,500,1000,2000,3000] as const).map(v => (
                            <button key={v} onClick={() => setSweepDelayMs(v)}
                              style={{ fontSize:'10px', padding:'4px 8px', background:'none', border:`1px solid ${sweepDelayMs===v?'#00e676':'#2a2a2a'}`, color:sweepDelayMs===v?'#00e676':'#555', cursor:'pointer' }}>
                              {v === 0 ? 'Off' : v/1000+'s'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    {sweepSources.length > 0 && sweepDestAddr && ethers.utils.isAddress(sweepDestAddr) && (
                      <div style={{ background:'#001a00', border:'1px solid #00e67633', padding:'10px 14px', fontSize:'12px', color:'#00e676', fontFamily:'monospace' }}>
                        Siap sweep <strong>{sweepSources.length} wallet</strong> → <strong>{sweepDestAddr.slice(0,10)}…{sweepDestAddr.slice(-6)}</strong>
                        {sweepAmtMode === 'all'
                          ? ` · sisakan ${sweepLeaveGas} ${selectedNetwork?.symbol ?? 'ETH'} gas`
                          : ` · ${sweepFixedAmt || '?'} ${selectedNetwork?.symbol ?? 'ETH'} per wallet`}
                      </div>
                    )}

                    {/* Run button */}
                    <button onClick={sweepRun}
                      disabled={sweepRunning || sweepSources.length === 0 || !ethers.utils.isAddress(sweepDestAddr) || (txSendAssetMode==='token' && txAsset==='native')}
                      style={{
                        padding:'13px', fontWeight:'bold', fontSize:'14px', cursor:sweepRunning?'wait':'pointer',
                        background: sweepRunning ? '#001a00' : (sweepSources.length===0||!ethers.utils.isAddress(sweepDestAddr)||(txSendAssetMode==='token'&&txAsset==='native')) ? '#12301f' : '#00e676',
                        color: sweepRunning ? '#00e676' : (sweepSources.length===0||!ethers.utils.isAddress(sweepDestAddr)||(txSendAssetMode==='token'&&txAsset==='native')) ? '#7dffb3' : '#000',
                        border:`1px solid ${sweepRunning?'#00e67644':'#00e676'}`,
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                        opacity: (sweepSources.length===0||!ethers.utils.isAddress(sweepDestAddr)||(txSendAssetMode==='token'&&txAsset==='native')) ? 0.85 : 1,
                        transition:'all 0.2s',
                      }}>
                      {sweepRunning
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Sweeping {sweepSources.filter(s=>s.status==='success').length}/{sweepSources.length}...</>
                        : (txSendAssetMode==='token' && txAsset==='native')
                          ? <><FaCoins/> Pilih Token Dulu</>
                          : <><FaExchangeAlt/> Mulai Sweep {sweepSources.length} Wallet{txIsToken ? ` (${selectedTxToken!.symbol})` : ''}</>}
                    </button>
                  </div>
                )}
              </div>

              {txIsToken && selectedTxToken && (
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', gap:'8px', flexWrap:'wrap' }}>
                    <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'flex', alignItems:'center', gap:'6px' }}>
                      <FaCoins size={11}/> Detail Token
                      {txTokenDetailLoading && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                    </div>
                    <Link to={`/explorer/address/${selectedTxToken.address}?network=${selectedNetwork?.id ?? ''}`}
                      style={{ fontSize:'11px', color:'#01a2ff', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                      <FaLink size={9}/> Lihat Detail Lengkap di Explorer
                    </Link>
                  </div>

                  {txTokenDetailError && !txTokenDetail && (
                    <p style={{ color:'#ff8888', fontSize:'11px', margin:0 }}>{txTokenDetailError}</p>
                  )}

                  {!txTokenDetailError && !txTokenDetail && !txTokenDetailLoading && (
                    <p style={{ color:'#333', fontSize:'12px', textAlign:'center', padding:'10px 0', margin:0 }}>Mengambil detail token…</p>
                  )}

                  {txTokenDetail && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Nama / Symbol</div>
                        <div style={{ fontSize:'12px', color:'#ccc', marginTop:'3px' }}>
                          {txTokenDetail.name || selectedTxToken.name} ({txTokenDetail.symbol || selectedTxToken.symbol})
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Standard</div>
                        <div style={{ fontSize:'12px', color:'#ccc', marginTop:'3px' }}>{txTokenDetail.standard}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Total Supply</div>
                        <div style={{ fontSize:'12px', color:'#ccc', marginTop:'3px', fontFamily:'monospace' }}>
                          {txTokenDetail.totalSupply ? parseFloat(txTokenDetail.totalSupply).toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Holders</div>
                        <div style={{ fontSize:'12px', color:'#ccc', marginTop:'3px' }}>{txTokenDetail.holdersCount?.toLocaleString('en-US') ?? '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Harga (USD)</div>
                        <div style={{ fontSize:'12px', color:'#4caf50', marginTop:'3px', fontFamily:'monospace' }}>
                          {txTokenDetail.priceUsd != null ? `$${txTokenDetail.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 6 })}` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Market Cap (USD)</div>
                        <div style={{ fontSize:'12px', color:'#ccc', marginTop:'3px', fontFamily:'monospace' }}>
                          {txTokenDetail.marketCapUsd != null ? `$${txTokenDetail.marketCapUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {txIsToken && selectedTxToken && (() => {
                const approveStatusColor = { idle:'#555', pending:'#ffaa00', success:'#4caf50', error:'#f44336' }[txApproveStatus.type];
                const approvalHistory = txApprovalHistoryForToken(selectedTxToken.address);
                return (
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'18px' }}>
                  <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'flex', alignItems:'center', gap:'6px', marginBottom:'14px' }}>
                    <FaCheckCircle size={11}/> Approve &amp; Allowance ({selectedTxToken.symbol})
                  </div>

                  <div style={{ background:'#0a0a0a', border:'1px solid #1e1e1e', borderLeft:'3px solid #ffaa00', padding:'10px 12px', marginBottom:'14px', fontSize:'11px', color:'#aa8844', lineHeight:'1.6', display:'flex', gap:'8px' }}>
                    <FaExclamationTriangle size={12} style={{ flexShrink:0, marginTop:'1px' }}/>
                    <span>Approve memberi izin ke address lain (biasanya kontrak DEX/dApp) untuk menarik token ini dari wallet kamu. Cuma approve ke kontrak yang kamu percaya, dan revoke kalau sudah tidak dipakai.</span>
                  </div>

                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Address Spender (kontrak yang diberi izin)</label>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <input type="text" placeholder="0x..." value={txApproveSpender}
                        onChange={e => setTxApproveSpender(e.target.value)}
                        style={{ flex:1, boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                      <button onClick={() => txCheckAllowance()} disabled={txAllowanceChecking || !ethers.utils.isAddress(txApproveSpender.trim())}
                        style={{ background:'none', border:'1px solid #333', color:txAllowanceChecking?'#555':'#01a2ff', padding:'0 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap', opacity: ethers.utils.isAddress(txApproveSpender.trim()) ? 1 : 0.4 }}>
                        {txAllowanceChecking ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'Cek Allowance'}
                      </button>
                    </div>
                    {ethers.utils.isAddress(txApproveSpender.trim()) && (
                      <div style={{ fontSize:'11px', marginTop:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <span style={{ color:'#555' }}>Allowance saat ini:</span>
                        {txAllowanceChecking ? (
                          <span style={{ color:'#555' }}>mengecek...</span>
                        ) : txAllowanceResult ? (
                          <span style={{ fontFamily:'monospace', fontWeight:'bold', color: txAllowanceResult.isUnlimited ? '#ff9800' : (txAllowanceResult.raw.isZero() ? '#555' : '#4caf50') }}>
                            {txAllowanceResult.isUnlimited ? '∞ Unlimited' : `${parseFloat(txAllowanceResult.formatted).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${selectedTxToken.symbol}`}
                          </span>
                        ) : (
                          <span style={{ color:'#333' }}>—</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none', marginBottom:'8px' }}>
                      <input type="checkbox" checked={txApproveUnlimited} onChange={e => setTxApproveUnlimited(e.target.checked)} style={{ width:'auto', margin:0, accentColor:'#01a2ff' }}/>
                      <span style={{ fontSize:'12px', color: txApproveUnlimited ? '#01a2ff' : '#888' }}>Unlimited approval (MaxUint256)</span>
                    </label>
                    {!txApproveUnlimited && (
                      <input type="number" placeholder={`Jumlah ${selectedTxToken.symbol} yang diizinkan`} min="0" value={txApproveAmt}
                        onChange={e => setTxApproveAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                    )}
                  </div>

                  <button onClick={() => txApproveToken()}
                    disabled={txApproving || !ethers.utils.isAddress(txApproveSpender.trim()) || (!txApproveUnlimited && !txApproveAmt)}
                    style={{ width:'100%', padding:'12px', background: txApproving ? '#1a1a2a' : (selectedNetwork?.color ?? '#01a2ff'), color:'#000', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                      opacity: (!ethers.utils.isAddress(txApproveSpender.trim()) || (!txApproveUnlimited && !txApproveAmt)) ? 0.5 : 1 }}>
                    {txApproving
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Memproses...</>
                      : <><FaCheckCircle/> Approve {selectedTxToken.symbol}</>}
                  </button>

                  {txApproveStatus.type !== 'idle' && (
                    <div style={{ background:'#0a0a0a', border:`1px solid ${approveStatusColor}44`, borderLeft:`3px solid ${approveStatusColor}`, padding:'10px 12px', fontSize:'12px', fontFamily:'monospace', color:approveStatusColor, marginTop:'12px' }}>
                      {txApproveStatus.type === 'pending' && <span style={{ marginRight:'6px', animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                      {txApproveStatus.type === 'success' && '✓ '}
                      {txApproveStatus.type === 'error'   && '✗ '}
                      {txApproveStatus.msg}
                      {txApproveStatus.hash && selectedNetwork?.explorerUrl && (
                        <div style={{ marginTop:'6px' }}>
                          <a href={`${selectedNetwork.explorerUrl}/tx/${txApproveStatus.hash}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff', fontSize:'11px' }}>
                            Lihat di {selectedNetwork.name} Explorer ↗
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {approvalHistory.length > 0 && (
                    <div style={{ marginTop:'18px', paddingTop:'14px', borderTop:'1px solid #161616' }}>
                      <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                        Approval Tersimpan di Wallet Ini ({approvalHistory.length})
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                        {approvalHistory.map(a => (
                          <div key={a.spender} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#0a0a0a', border:'1px solid #161616', padding:'8px 10px' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:'11px', fontFamily:'monospace', color:'#ccc', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {a.spender}
                              </div>
                              <div style={{ fontSize:'10px', color: a.unlimited ? '#ff9800' : '#555', marginTop:'2px' }}>
                                {a.unlimited ? '∞ Unlimited' : `${a.lastAmount} ${selectedTxToken.symbol}`} · {new Date(a.timestamp).toLocaleDateString('id-ID')}
                              </div>
                            </div>
                            <button onClick={() => { setTxApproveSpender(a.spender); txCheckAllowance(a.spender); }} title="Isi ke form di atas"
                              style={{ background:'none', border:'1px solid #333', color:'#666', padding:'5px 8px', cursor:'pointer', fontSize:'10px', flexShrink:0 }}>
                              <FaPlug size={10}/>
                            </button>
                            <button onClick={() => txRevokeApproval(a.spender)} disabled={txApproving} title="Revoke (cabut izin)"
                              style={{ background:'none', border:'1px solid #f4433650', color: txRevokingSpender===a.spender ? '#555' : '#f44336', padding:'5px 10px', cursor: txApproving ? 'not-allowed' : 'pointer', fontSize:'10px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px', flexShrink:0 }}>
                              {txRevokingSpender===a.spender ? <FaSpinner style={{ animation:'spin 1s linear infinite' }} size={10}/> : <><FaTrash size={9}/> Revoke</>}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}

              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', gap:'8px', flexWrap:'wrap' }}>
                  <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'flex', alignItems:'center', gap:'6px' }}>
                    Riwayat Transaksi Wallet
                    {txWalletHistoryLoading && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <button onClick={() => txLoadWalletHistory()} disabled={txWalletHistoryLoading}
                      style={{ background:'none', border:'1px solid #333', color:'#666', padding:'4px 10px', cursor:'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px' }}>
                      <FaSync size={9} style={{ animation:txWalletHistoryLoading?'spin 1s linear infinite':undefined }}/> Refresh
                    </button>
                    <Link to={`/explorer/address/${txAddress}?network=${selectedNetwork?.id ?? ''}`}
                      style={{ fontSize:'11px', color:selectedNetwork?.color??'#01a2ff', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                      <FaLink size={9}/> Lihat Semua di Explorer
                    </Link>
                  </div>
                </div>

                {txWalletHistoryError ? (
                  <p style={{ color:'#ff8888', fontSize:'11px', textAlign:'center', padding:'12px 0', margin:0 }}>{txWalletHistoryError}</p>
                ) : !txWalletHistoryLoading && txWalletHistory.length === 0 ? (
                  <p style={{ color:'#333', fontSize:'12px', textAlign:'center', padding:'16px 0', margin:0 }}>Belum ada transaksi untuk address ini.</p>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                    {txWalletHistory.map(h => {
                      const stColor = h.status==='success' ? '#4caf50' : h.status==='failed' ? '#f44336' : '#ffaa00';
                      const isOut = h.from.toLowerCase() === txAddress.toLowerCase();
                      return (
                        <Link key={h.hash} to={`/explorer/tx/${h.hash}?network=${selectedNetwork?.id ?? ''}`} className="explorer-row"
                          style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'9px 8px', borderBottom:'1px solid #141414', textDecoration:'none', border:'1px solid transparent' }}>
                          <div style={{ minWidth:0, flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                              <span style={{ fontSize:'9px', fontWeight:'bold', color:stColor, border:`1px solid ${stColor}44`, padding:'1px 5px' }}>
                                {h.status === 'success' ? 'OK' : h.status === 'failed' ? 'FAIL' : 'PENDING'}
                              </span>
                              <span style={{ fontSize:'11px', color:'#ccc' }}>
                                {h.methodGuess || (isOut ? 'Transfer Keluar' : 'Transfer Masuk')}
                              </span>
                            </div>
                            <div style={{ fontSize:'10px', color:'#444', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {shortAddr(h.hash)} · {isOut ? `Ke ${shortAddr(h.to||'')}` : `Dari ${shortAddr(h.from)}`}
                              {h.timestamp && ` · ${new Date(h.timestamp*1000).toLocaleString('id-ID')}`}
                            </div>
                          </div>
                          <div style={{ fontSize:'11px', fontFamily:'monospace', color:isOut?'#f44336':'#4caf50', flexShrink:0 }}>
                            {isOut?'-':'+'}{parseFloat(h.value).toFixed(5)} {selectedNetwork?.symbol??'ETH'}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ textAlign:'center' }}>
                <button onClick={txDisconnect}
                  style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                  Disconnect Wallet
                </button>
              </div>
            </div>
          )}
          </>
          )}

          {txChain === 'sol' && (
            <>
              <div id="faucetsolana" style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={solNetId} onChange={e => switchSolNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {SOLANA_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                {solNetId !== 'mainnet' && (
                  <span style={{ fontSize:'10px', color:'#F1C40F', border:'1px solid #4a3f10', background:'#1a1608', padding:'4px 8px', whiteSpace:'nowrap' }}>
                    ⚠ Jaringan TEST — SOL di sini tidak bernilai, minta dari faucet
                  </span>
                )}
                <a href={`${SOLANA_NETWORK.explorerUrl}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#9945FF', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              {!solConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  {window.location.hash.replace('#','').toLowerCase() === 'faucetsolana' && (
                    <div style={{ background:'#1a1608', border:'1px solid #4a3f10', color:'#F1C40F', padding:'10px 14px', marginBottom:'16px', fontSize:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
                      <FaFaucet size={12} style={{ flexShrink:0 }}/> Connect wallet Solana dulu, tombol Faucet Devnet/Testnet muncul setelah connect.
                    </div>
                  )}
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {SOLANA_NETWORK.name}
                  </h2>
                  {wallets.some(w => (w.solAddresses||[]).length > 0) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Solana tersimpan</label>
                      <select value={solWalletSel} onChange={e => handleSolWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.flatMap((w, wi) =>
                          (w.solAddresses||[]).map(a => (
                            <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                              {w.name} · #{a.index} · {a.address.slice(0,14)}...
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key (base58)
                  </label>
                  <input
                    type="password"
                    placeholder="base58 secret key..."
                    value={solPrivKey}
                    onChange={e => { setSolPrivKey(e.target.value); setSolWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
                  />
                  <button onClick={solConnect} disabled={solConnecting || !solPrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:solConnecting?'#1a1a2a':SOLANA_NETWORK.color, color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!solPrivKey.trim()?0.5:1 }}>
                    {solConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${SOLANA_NETWORK.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'26px', fontWeight:'bold', fontFamily:'monospace', color:'#fff', lineHeight:1 }}>
                          {solLoadingBal ? '···' : solBalance}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        {solNetId !== 'mainnet' && (
                          <button onClick={solRequestAirdrop} disabled={solFaucetLoading}
                            title={`Minta 1 SOL gratis di ${SOLANA_NETWORK.name}`}
                            style={{
                              background:'none', border:'1px solid #4a3f10', color:'#F1C40F', padding:'6px 12px', cursor:'pointer', fontSize:'11px',
                              display:'flex', alignItems:'center', gap:'5px',
                              boxShadow: highlightFaucet ? '0 0 0 3px #F1C40F55' : undefined,
                              transition: 'box-shadow 0.3s ease',
                            }}>
                            <FaFaucet size={10} style={{ animation:solFaucetLoading?'spin 1s linear infinite':undefined }}/> {solFaucetLoading ? 'Meminta...' : 'Faucet 1 SOL'}
                          </button>
                        )}
                        <button onClick={() => solRefreshBalance()} disabled={solLoadingBal}
                          style={{ background:'none', border:'1px solid #333', color:'#666', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                          <FaSync size={10} style={{ animation:solLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #161616', display:'flex', alignItems:'center', gap:'8px' }}>
                      <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {solAddress}
                      </code>
                      <button onClick={() => copyText(solAddress, 'sol_addr')}
                        style={{ background:'none', border:'1px solid #333', color:copiedKey==='sol_addr'?'#4caf50':'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                        {copiedKey==='sol_addr' ? <FaCheckCircle/> : <FaCopy/>}
                      </button>
                      <button onClick={() => setQrAddress(solAddress)} title="QR Code"
                        style={{ background:'none', border:'1px solid #333', color:'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                        <FaQrcode size={11}/>
                      </button>
                      <a href={`${SOLANA_NETWORK.explorerUrl}/account/${solAddress}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer"
                        style={{ color:'#555', padding:'4px 8px', border:'1px solid #333', display:'flex', flexShrink:0 }}
                        title="Lihat di Explorer">
                        <FaLink size={11}/>
                      </a>
                    </div>
                  </div>

                  {/* ── Mode + Form card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>

                    {/* Mode segmented control */}
                    <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px', marginBottom:'20px' }}>
                      {([
                        ['single', <FaPaperPlane key="i" size={11}/>, 'Kirim'],
                        ['multi',  <FaLayerGroup key="i" size={11}/>, 'Multi Send'],
                        ['sweep',  <FaExchangeAlt key="i" size={11}/>, 'Sweep'],
                        ['close',  <FaTrash key="i" size={11}/>, 'Tutup Akun'],
                      ] as const).map(([m, icon, label]) => (
                        <button key={m} onClick={() => setSolMode(m)} style={{
                          flex:1, padding:'9px 8px', background: solMode===m ? SOLANA_NETWORK.color : 'transparent',
                          border:'none', color: solMode===m ? '#000' : '#666',
                          cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                        }}>
                          {icon} {label}
                        </button>
                      ))}
                    </div>

                    {solMode !== 'close' && renderSolAssetSelector()}

                    {/* ── Kirim (single) ── */}
                    {solMode === 'single' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Address tujuan</label>
                          <input type="text" placeholder="Solana address tujuan..." value={solSendTo}
                            onChange={e => setSolSendTo(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                            <label style={{ fontSize:'11px', color:'#555' }}>
                              Jumlah {solAsset === 'native' ? '(SOL)' : '(token)'}
                            </label>
                            <button onClick={solSetMaxAmount} disabled={solMaxLoading || !solConnected}
                              style={{ background:'none', border:'1px solid #333', color:solMaxLoading?'#555':SOLANA_NETWORK.color, padding:'2px 8px', cursor:(solMaxLoading||!solConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!solConnected?0.4:1 }}>
                              {solMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                            </button>
                          </div>
                          <input type="number" placeholder="0.01" step="0.0001" min="0" value={solSendAmt}
                            onChange={e => setSolSendAmt(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>
                        {(() => {
                          const needsNewAta = solIsToken && solDestAtaExists === false;
                          const totalFeeLamports = 5000 + (needsNewAta ? SOL_TOKEN_ACCOUNT_RENT_LAMPORTS : 0);
                          const totalFeeSol = totalFeeLamports / LAMPORTS_PER_SOL;
                          return (
                            <>
                              {solIsToken && solDestAtaChecking && (
                                <div style={{ fontSize:'10px', color:'#555', display:'flex', alignItems:'center', gap:'6px' }}>
                                  <FaSpinner style={{ animation:'spin 1s linear infinite' }} size={9}/> Mengecek token account tujuan...
                                </div>
                              )}
                              {needsNewAta && (
                                <div style={{ background:'#1a1608', border:'1px solid #4a3f10', color:'#F1C40F', padding:'9px 12px', fontSize:'11px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                                  <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                                  <span>
                                    Address tujuan belum punya token account untuk mint ini — akan dibuatkan otomatis saat kirim,
                                    nambah biaya rent ± <strong>{(SOL_TOKEN_ACCOUNT_RENT_LAMPORTS/LAMPORTS_PER_SOL).toFixed(6)} SOL</strong> (dibayar sekali, dari saldo SOL pengirim, bukan dari jumlah token yang dikirim).
                                  </span>
                                </div>
                              )}
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'11px', color:'#555', flexWrap:'wrap' }}>
                                <FaGasPump size={10} color="#f3ba2f"/> Fee jaringan{needsNewAta ? ' (+ rent akun baru)' : ''}:
                                <span style={{ fontFamily:'monospace', color:'#4caf50', background:'#0a1a0a', border:'1px solid #1a2a1a', padding:'2px 6px' }}>
                                  ≈ {totalFeeSol.toFixed(6)} SOL
                                </span>
                                {renderGasFiatBadge(totalFeeSol)}
                              </div>
                            </>
                          );
                        })()}
                        <button onClick={solSend} disabled={solSending || !solSendTo.trim() || !solSendAmt}
                          style={{
                            padding:'13px', background:solSending?'#1a1a2a':SOLANA_NETWORK.color, color:'#000', border:'none',
                            cursor:solSending?'wait':'pointer', fontSize:'14px', fontWeight:'bold',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
                            opacity:(!solSendTo.trim()||!solSendAmt) ? 0.5 : 1,
                          }}>
                          {solSending
                            ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                            : <><FaPaperPlane/> {solAsset === 'native' ? 'Kirim SOL' : 'Kirim Token'}</>}
                        </button>
                        {solStatus.type !== 'idle' && (
                          <div style={{
                            padding:'10px 12px', fontSize:'11px',
                            background: solStatus.type==='error' ? '#1a0000' : solStatus.type==='success' ? '#001a00' : '#0a0a1a',
                            border: `1px solid ${solStatus.type==='error'?'#440000':solStatus.type==='success'?'#004400':'#1a1a3a'}`,
                            color: solStatus.type==='error' ? '#f44336' : solStatus.type==='success' ? '#4caf50' : '#888',
                          }}>
                            {solStatus.msg}
                            {solStatus.hash && (
                              <div style={{ marginTop:'6px' }}>
                                <a href={`${SOLANA_NETWORK.explorerUrl}/tx/${solStatus.hash}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>
                                  <FaLink size={9} style={{ marginRight:'4px' }}/>Lihat di Explorer
                                </a>
                                <div style={{ fontSize:'10px', color:'#555', marginTop:'3px', wordBreak:'break-all' }}>{solStatus.hash}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Multi Send ── */}
                    {solMode === 'multi' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                          <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>
                            Jumlah rata ({solIsToken ? `token ${shortAddr(selectedSolToken!.mint)}` : 'SOL'}):
                          </label>
                          <input type="number" placeholder="0.001" step="0.0001" min="0" value={solMultiEqualAmt}
                            onChange={e => setSolMultiEqualAmt(e.target.value)}
                            style={{ width:'110px', fontFamily:'monospace', fontSize:'12px' }}/>
                          <button onClick={solMultiApplyEqual} disabled={!solMultiEqualAmt}
                            style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 12px', cursor:'pointer', fontSize:'11px', opacity:!solMultiEqualAmt?0.4:1 }}>
                            Terapkan ke semua baris
                          </button>
                        </div>

                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {solMultiRows.map((row, idx) => {
                            const statusColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336' }[row.status];
                            return (
                              <div key={row.id} style={{ display:'grid', gridTemplateColumns:'1fr 110px 60px 26px', gap:'6px', alignItems:'center' }}>
                                <input type="text" placeholder={`Solana address #${idx+1}`} value={row.to}
                                  onChange={e => solMultiUpdateRow(row.id, 'to', e.target.value)}
                                  style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background: row.status==='failed'?'#1a0000':row.status==='success'?'#001a00':'#0d0d0d', border:`1px solid ${row.status!=='idle'?statusColor+'44':'#1e1e1e'}` }}/>
                                <input type="number" placeholder="0.001" step="0.0001" min="0" value={row.amount}
                                  onChange={e => solMultiUpdateRow(row.id, 'amount', e.target.value)}
                                  style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background:'#0d0d0d', border:'1px solid #1e1e1e' }}/>
                                <div style={{ fontSize:'10px', fontWeight:'bold', color:statusColor, fontFamily:'monospace', textAlign:'center' }}>
                                  {row.status === 'idle'    && '—'}
                                  {row.status === 'pending' && '⟳'}
                                  {row.status === 'success' && '✓'}
                                  {row.status === 'failed'  && '✗'}
                                </div>
                                <button onClick={() => solMultiRemoveRow(row.id)} disabled={solMultiRows.length === 1}
                                  style={{ background:'none', border:'1px solid #2a2a2a', color:'#f44336', padding:'6px', cursor: solMultiRows.length===1?'not-allowed':'pointer', fontSize:'11px', opacity:solMultiRows.length===1?0.3:1 }}>
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <button onClick={solMultiAddRow} disabled={solMultiRunning}
                          style={{ alignSelf:'flex-start', background:'none', border:'none', color:'#9945FF', padding:'2px 0', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px' }}>
                          <FaPlus size={10}/> Tambah baris
                        </button>

                        {solMultiRows.some(r => r.hash || r.error) && (
                          <div style={{ background:'#070707', border:'1px solid #1a1a1a', padding:'10px 12px', fontSize:'11px', fontFamily:'monospace', display:'flex', flexDirection:'column', gap:'5px' }}>
                            {solMultiRows.filter(r => r.hash || r.error).map(r => (
                              <div key={r.id + '_log'}>
                                {r.hash && (
                                  <span style={{ color:'#4caf50' }}>
                                    ✓ {shortAddr(r.to)} —{' '}
                                    <a href={`${SOLANA_NETWORK.explorerUrl}/tx/${r.hash}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer" style={{ color:'#01a2ff' }}>{r.hash.slice(0,18)}…</a>
                                  </span>
                                )}
                                {r.error && <span style={{ color:'#f44336' }}>✗ {shortAddr(r.to)} — {r.error.slice(0,80)}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        <button onClick={solMultiSend}
                          disabled={solMultiRunning || solMultiRows.every(r => !r.to || !r.amount)}
                          style={{
                            padding:'13px', background:solMultiRunning?'#1a1a2a':SOLANA_NETWORK.color, color:'#000', border:'none',
                            cursor:solMultiRunning?'wait':'pointer', fontSize:'14px', fontWeight:'bold',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
                            opacity: solMultiRows.every(r=>!r.to||!r.amount) ? 0.5 : 1,
                          }}>
                          {solMultiRunning
                            ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim {solMultiRows.filter(r=>r.status==='success').length}/{solMultiRows.filter(r=>solIsValidAddr(r.to)&&parseFloat(r.amount)>0).length}...</>
                            : <><FaPaperPlane/> Kirim {solMultiRows.filter(r=>solIsValidAddr(r.to)&&parseFloat(r.amount)>0).length || solMultiRows.length} {solIsToken ? 'Token' : 'Transaksi'}</>}
                        </button>
                        <div style={{ fontSize:'10px', color:'#444', textAlign:'center' }}>
                          Dikirim satu per satu — tiap TX menunggu konfirmasi sebelum lanjut ke baris berikutnya.
                        </div>
                      </div>
                    )}

                    {/* ── Sweep ── */}
                    {solMode === 'sweep' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                        <div style={{ fontSize:'11px', color:'#888', lineHeight:'1.6' }}>
                          {solIsToken
                            ? <>Kirim saldo token (mint <strong style={{ color:'#ccc' }}>{shortAddr(selectedSolToken!.mint)}</strong>) dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet sumber tetap butuh sedikit SOL untuk fee — yang tidak cukup otomatis di-skip.</>
                            : <>Kirim saldo SOL dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet dengan saldo lebih kecil dari fee otomatis di-skip.</>}
                        </div>

                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                            Address tujuan (penerima)
                          </label>
                          <input type="text" placeholder="Solana address yang akan menerima semua dana"
                            value={solSweepDestAddr} onChange={e => setSolSweepDestAddr(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px',
                              borderColor: solSweepDestAddr && !solIsValidAddr(solSweepDestAddr) ? '#f44336' : undefined }}/>
                          {solSweepDestAddr && !solIsValidAddr(solSweepDestAddr) && (
                            <div style={{ fontSize:'10px', color:'#f44336', marginTop:'3px' }}>Address tidak valid</div>
                          )}
                        </div>

                        <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px' }}>
                          {(['all','fixed'] as const).map(m => (
                            <button key={m} onClick={() => setSolSweepAmtMode(m)} style={{
                              flex:1, padding:'8px', background: solSweepAmtMode===m ? SOLANA_NETWORK.color : 'transparent',
                              border:'none', color: solSweepAmtMode===m ? '#000' : '#666', cursor:'pointer', fontSize:'11px', fontWeight:'bold',
                            }}>
                              {m === 'all' ? 'Semua Saldo' : 'Jumlah Tetap'}
                            </button>
                          ))}
                        </div>

                        {solSweepAmtMode === 'fixed' ? (
                          <div>
                            <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                              Jumlah tetap ({solIsToken ? 'token' : 'SOL'}) per wallet
                            </label>
                            <input type="number" placeholder="0.01" step="0.0001" min="0" value={solSweepFixedAmt}
                              onChange={e => setSolSweepFixedAmt(e.target.value)}
                              style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                          </div>
                        ) : solIsToken ? (
                          <div style={{ fontSize:'10px', color:'#444' }}>
                            Seluruh saldo token tiap wallet akan dikirim (fee dibayar terpisah pakai SOL).
                          </div>
                        ) : (
                          <div>
                            <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Sisakan di tiap wallet (SOL)</label>
                            <input type="number" placeholder="0.00001" step="0.00001" min="0" value={solSweepLeaveBuf}
                              onChange={e => setSolSweepLeaveBuf(e.target.value)}
                              style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                          </div>
                        )}

                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Delay antar TX (ms)</label>
                          <input type="number" placeholder="1200" step="100" min="0" value={solSweepDelayMs}
                            onChange={e => setSolSweepDelayMs(parseInt(e.target.value) || 0)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>

                        {/* Sumber wallet */}
                        <div style={{ borderTop:'1px solid #161616', paddingTop:'14px' }}>
                          <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                            Wallet Sumber ({solSweepSources.length})
                          </div>
                          {wallets.some(w => (w.solAddresses||[]).length > 0) && (
                            <div style={{ marginBottom:'10px' }}>
                              <select onChange={e => { solSweepAddFromBIP39(e.target.value); e.target.value=''; }} value=""
                                style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                                <option value="">-- Tambah dari wallet tersimpan --</option>
                                {wallets.flatMap((w, wi) =>
                                  (w.solAddresses||[]).map(a => (
                                    <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                                      {w.name} · #{a.index} · {a.address.slice(0,14)}...
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>
                          )}
                          <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                            <input type="password" placeholder="Atau tempel private key base58 manual..."
                              value={solSweepManualPK} onChange={e => setSolSweepManualPK(e.target.value)}
                              style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}/>
                            <button onClick={solSweepAddManualPK} disabled={!solSweepManualPK.trim()}
                              style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'11px', opacity:!solSweepManualPK.trim()?0.4:1 }}>
                              <FaPlus size={10}/>
                            </button>
                          </div>

                          {solSweepSources.length > 0 && (
                            <>
                              <button onClick={solSweepFetchBalances} disabled={solSweepFetchingBal}
                                style={{ background:'none', border:'1px solid #333', color:'#666', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px', marginBottom:'10px' }}>
                                <FaSync size={10} style={{ animation:solSweepFetchingBal?'spin 1s linear infinite':undefined }}/> Cek Saldo Semua
                              </button>
                              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                {solSweepSources.map(s => {
                                  const statusColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336', skipped:'#666' }[s.status];
                                  return (
                                    <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#0a0a0a', border:`1px solid ${s.status!=='idle'?statusColor+'44':'#151515'}`, padding:'9px 12px' }}>
                                      <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:'11px', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</div>
                                        {s.balance && <div style={{ fontSize:'10px', color:'#666' }}>{s.balance}</div>}
                                        {s.error && <div style={{ fontSize:'10px', color:'#f44336' }}>{s.error}</div>}
                                      </div>
                                      <div style={{ fontSize:'10px', fontWeight:'bold', color:statusColor, fontFamily:'monospace', flexShrink:0 }}>
                                        {s.status === 'idle'    && '—'}
                                        {s.status === 'pending' && '⟳'}
                                        {s.status === 'success' && '✓'}
                                        {s.status === 'failed'  && '✗'}
                                        {s.status === 'skipped' && 'skip'}
                                      </div>
                                      <button onClick={() => solSweepRemoveSource(s.id)} disabled={solSweepRunning}
                                        style={{ background:'none', border:'none', color:'#f44336', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>

                        <button onClick={solSweepRun}
                          disabled={solSweepRunning || solSweepSources.length === 0 || !solIsValidAddr(solSweepDestAddr)}
                          style={{
                            padding:'13px', fontWeight:'bold', fontSize:'14px', cursor:solSweepRunning?'wait':'pointer',
                            background: solSweepRunning ? '#001a00' : (solSweepSources.length===0||!solIsValidAddr(solSweepDestAddr)) ? '#12301f' : '#00e676',
                            color: solSweepRunning ? '#00e676' : (solSweepSources.length===0||!solIsValidAddr(solSweepDestAddr)) ? '#7dffb3' : '#000',
                            border:`1px solid ${solSweepRunning?'#00e67644':'#00e676'}`,
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                            opacity: (solSweepSources.length===0||!solIsValidAddr(solSweepDestAddr)) ? 0.85 : 1,
                            transition:'all 0.2s',
                          }}>
                          {solSweepRunning
                            ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Sweeping {solSweepSources.filter(s=>s.status==='success').length}/{solSweepSources.length}...</>
                            : <><FaExchangeAlt/> Mulai Sweep {solSweepSources.length} Wallet{solIsToken ? ` (Token ${shortAddr(selectedSolToken!.mint)})` : ''}</>}
                        </button>
                      </div>
                    )}

                    {/* ── Tutup Akun Token (Close Token Account) ──
                        Menutup token account (ATA / Token-2022) SPL untuk menarik kembali
                        rent (± 0.002 SOL/akun) yang terkunci di dalamnya. Selalu mengikuti
                        cluster aktif (SOLANA_NETWORK) — jadi otomatis berfungsi baik di
                        Mainnet, Testnet, maupun Devnet tanpa perlu konfigurasi tambahan. */}
                    {solMode === 'close' && (() => {
                      const emptyAccs    = solCloseAccounts.filter(a => a.uiAmount === 0);
                      const balanceAccs  = solCloseAccounts.filter(a => a.uiAmount > 0);
                      const totalReclaim = solCloseAccounts.reduce((s, a) => s + a.lamports, 0) / LAMPORTS_PER_SOL;
                      const selectedEmpty      = emptyAccs.filter(a => solCloseSelected.has(a.pubkey));
                      const selectedReclaim    = selectedEmpty.reduce((s, a) => s + a.lamports, 0) / LAMPORTS_PER_SOL;
                      const allEmptySelected   = emptyAccs.length > 0 && emptyAccs.every(a => solCloseSelected.has(a.pubkey));
                      const q = solCloseSearch.trim().toLowerCase();
                      const visibleAccs = solCloseAccounts
                        .filter(a => solCloseFilter === 'all' ? true : solCloseFilter === 'empty' ? a.uiAmount === 0 : a.uiAmount > 0)
                        .filter(a => !q || a.mint.toLowerCase().includes(q) || a.pubkey.toLowerCase().includes(q));

                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                          {/* Info banner */}
                          <div style={{ display:'flex', gap:'9px', fontSize:'11px', color:'#777', lineHeight:1.6, background:'#0a0a0a', border:'1px solid #1e1e1e', padding:'10px 12px' }}>
                            <FaInfoCircle size={12} style={{ color:'#555', flexShrink:0, marginTop:'2px' }}/>
                            <div>
                              Setiap token account SPL (baik <strong style={{ color:'#ccc' }}>SPL Token</strong> klasik maupun <strong style={{ color:'#ccc' }}>Token-2022</strong>)
                              menahan rent ± <strong style={{ color:'#ccc' }}>0.00203928 SOL</strong>. Menutup akun kosong mengembalikan rent itu ke wallet ini.
                              Akun yang masih bersaldo harus dikosongkan dulu — kirim ke wallet lain, atau bakar langsung dari sini.
                            </div>
                          </div>

                          {/* Kartu ringkasan */}
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px' }}>
                            {[
                              { label: 'Total Akun',      value: solCloseAccounts.length,                 color: '#ccc' },
                              { label: 'Siap Ditutup',    value: emptyAccs.length,                        color: '#4caf50' },
                              { label: 'Reclaim Tersedia',value: `± ${totalReclaim.toFixed(5)} SOL`,       color: SOLANA_NETWORK.color },
                            ].map(card => (
                              <div key={card.label} style={{ background:'#0a0a0a', border:'1px solid #1e1e1e', padding:'10px 12px', textAlign:'center' }}>
                                <div style={{ fontSize: typeof card.value === 'number' ? '18px' : '13px', fontWeight:'bold', color: card.color, fontFamily:'monospace' }}>
                                  {card.value}
                                </div>
                                <div style={{ fontSize:'9px', color:'#555', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'3px' }}>
                                  {card.label}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Toolbar: filter + search + refresh */}
                          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
                            <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px', flexShrink:0 }}>
                              {([
                                ['all',     `Semua (${solCloseAccounts.length})`],
                                ['empty',   `Kosong (${emptyAccs.length})`],
                                ['balance', `Bersaldo (${balanceAccs.length})`],
                              ] as const).map(([f, label]) => (
                                <button key={f} onClick={() => setSolCloseFilter(f)} style={{
                                  padding:'6px 10px', background: solCloseFilter===f ? '#1a1a1a' : 'transparent',
                                  border:'none', color: solCloseFilter===f ? '#ccc' : '#555',
                                  cursor:'pointer', fontSize:'10px', fontWeight:'bold', whiteSpace:'nowrap',
                                }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                            <input type="text" placeholder="Cari mint / ATA address..." value={solCloseSearch}
                              onChange={e => setSolCloseSearch(e.target.value)}
                              style={{ flex:1, minWidth:'160px', fontFamily:'monospace', fontSize:'11px', padding:'7px 10px' }}/>
                            <button onClick={() => solFetchCloseAccounts()} disabled={solCloseLoading}
                              style={{ background:'none', border:'1px solid #333', color:'#888', padding:'7px 12px', cursor: solCloseLoading?'wait':'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px', flexShrink:0 }}>
                              <FaSync size={9} style={{ animation:solCloseLoading?'spin 1s linear infinite':undefined }}/> Refresh
                            </button>
                          </div>

                          {/* Loading skeleton */}
                          {solCloseLoading && solCloseAccounts.length === 0 && (
                            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                              {[0,1,2].map(i => (
                                <div key={i} style={{ height:'52px', background:'#0a0a0a', border:'1px solid #1e1e1e', opacity:0.5 - i*0.1,
                                  animation:'pulse 1.4s ease-in-out infinite' }}/>
                              ))}
                            </div>
                          )}

                          {/* Empty state */}
                          {!solCloseLoading && solCloseAccounts.length === 0 && (
                            <div style={{ textAlign:'center', padding:'32px 0', color:'#333' }}>
                              <FaCoins size={22} style={{ color:'#222', marginBottom:'8px' }}/>
                              <p style={{ fontSize:'12px', margin:0 }}>
                                Tidak ada token account SPL di wallet ini pada cluster {SOLANA_NETWORK.name}.
                              </p>
                            </div>
                          )}

                          {/* Tidak ada hasil filter/pencarian, tapi datanya ada */}
                          {!solCloseLoading && solCloseAccounts.length > 0 && visibleAccs.length === 0 && (
                            <p style={{ color:'#333', fontSize:'12px', textAlign:'center', padding:'16px 0', margin:0 }}>
                              Tidak ada akun yang cocok dengan filter/pencarian saat ini.
                            </p>
                          )}

                          {/* Pilih semua akun kosong */}
                          {emptyAccs.length > 1 && solCloseFilter !== 'balance' && (
                            <label style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'11px', color:'#888', cursor:'pointer', userSelect:'none' }}>
                              <input type="checkbox" checked={allEmptySelected}
                                onChange={() => solCloseToggleSelectAll(emptyAccs.map(a => a.pubkey))}/>
                              Pilih semua akun kosong ({emptyAccs.length})
                            </label>
                          )}

                          {/* Daftar akun */}
                          {visibleAccs.length > 0 && (
                            <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'420px', overflowY:'auto', paddingRight:'2px' }}>
                              {visibleAccs.map(acc => {
                                const isClosing  = solClosingId === acc.pubkey;
                                const hasBalance = acc.uiAmount > 0;
                                const burnFirst  = !!solCloseBurnFirst[acc.pubkey];
                                const isSelected = solCloseSelected.has(acc.pubkey);
                                const reclaimSol = (acc.lamports / LAMPORTS_PER_SOL).toFixed(6);
                                const isToken22  = acc.programId === TOKEN_2022_PROGRAM_ID.toBase58();
                                const accentColor= hasBalance ? '#f4a300' : '#4caf50';
                                const displayName  = acc.name || acc.symbol || (acc.metaLoaded ? 'Token Tidak Dikenal' : '');
                                const avatarLetter = (acc.name || acc.symbol || acc.mint).trim().charAt(0).toUpperCase() || '?';
                                const createdLabel = acc.createdAtLoaded
                                  ? (acc.createdAt
                                      ? new Date(acc.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
                                      : 'tidak diketahui')
                                  : null;
                                return (
                                  <div key={acc.pubkey} style={{
                                    padding:'11px 12px', background:'#0a0a0a', borderTop:'1px solid #1e1e1e', borderRight:'1px solid #1e1e1e', borderBottom:'1px solid #1e1e1e',
                                    borderLeft:`3px solid ${accentColor}55`,
                                    display:'flex', flexDirection:'column', gap:'9px',
                                  }}>
                                    <div style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
                                      {!hasBalance && (
                                        <input type="checkbox" checked={isSelected} onChange={() => solCloseToggleSelect(acc.pubkey)}
                                          style={{ marginTop:'3px', flexShrink:0, cursor:'pointer' }}/>
                                      )}
                                      {/* Avatar: logo token kalau ada, kalau nggak avatar inisial berwarna —
                                          supaya kartu akun kosong nggak nampak blank hitam polos. */}
                                      <div style={{
                                        width:'30px', height:'30px', borderRadius:'50%', flexShrink:0, marginTop:'1px',
                                        overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
                                        background: acc.image ? '#111' : `${accentColor}22`,
                                        border:`1px solid ${accentColor}55`,
                                      }}>
                                        {acc.image
                                          ? <img src={acc.image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}/>
                                          : <span style={{ fontSize:'12px', fontWeight:'bold', color: accentColor }}>{avatarLetter}</span>}
                                      </div>
                                      <div style={{ minWidth:0, flex:1 }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                                          <span style={{ fontSize:'12px', color:'#eee', fontWeight:'bold' }}>
                                            {displayName || <span style={{ display:'inline-block', width:'70px', height:'10px', background:'#1a1a1a', borderRadius:'2px' }}/>}
                                          </span>
                                          {acc.symbol && acc.name && (
                                            <span style={{ fontSize:'10px', color:'#777' }}>{acc.symbol}</span>
                                          )}
                                          <span style={{
                                            fontSize:'9px', fontWeight:'bold', padding:'1px 6px',
                                            color: isToken22 ? '#c792ea' : '#569cd6',
                                            background: isToken22 ? '#c792ea1a' : '#569cd61a',
                                            border:`1px solid ${isToken22 ? '#c792ea33' : '#569cd633'}`,
                                          }}>
                                            {isToken22 ? 'Token-2022' : 'SPL Token'}
                                          </span>
                                        </div>
                                        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', marginTop:'3px' }}>
                                          <span style={{ fontSize:'11px', color:'#ccc', fontFamily:'monospace' }}>Mint {shortAddr(acc.mint)}</span>
                                          <button onClick={() => copyText(acc.mint, `close_mint_${acc.pubkey}`)}
                                            style={{ background:'none', border:'none', color: copiedKey===`close_mint_${acc.pubkey}` ? '#4caf50' : '#444', cursor:'pointer', padding:'2px', display:'flex' }}>
                                            {copiedKey===`close_mint_${acc.pubkey}` ? <FaCheckCircle size={9}/> : <FaCopy size={9}/>}
                                          </button>
                                        </div>
                                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'3px' }}>
                                          <span style={{ fontSize:'10px', color:'#555', fontFamily:'monospace' }}>ATA {shortAddr(acc.pubkey)}</span>
                                          <button onClick={() => copyText(acc.pubkey, `close_ata_${acc.pubkey}`)}
                                            style={{ background:'none', border:'none', color: copiedKey===`close_ata_${acc.pubkey}` ? '#4caf50' : '#333', cursor:'pointer', padding:'2px', display:'flex' }}>
                                            {copiedKey===`close_ata_${acc.pubkey}` ? <FaCheckCircle size={9}/> : <FaCopy size={9}/>}
                                          </button>
                                        </div>
                                        <div style={{ fontSize:'10px', color:'#555', marginTop:'3px' }}>
                                          Dibuat: {createdLabel ?? <span style={{ display:'inline-block', width:'60px', height:'8px', background:'#1a1a1a', borderRadius:'2px', verticalAlign:'middle' }}/>}
                                        </div>
                                      </div>
                                      <div style={{ textAlign:'right', flexShrink:0 }}>
                                        <div style={{ fontSize:'11px', color: hasBalance ? '#ffb300' : '#4caf50', fontWeight:'bold' }}>
                                          saldo {acc.uiAmount}
                                        </div>
                                        <div style={{ fontSize:'10px', color:'#666' }}>reclaim ± {reclaimSol} SOL</div>
                                      </div>
                                    </div>

                                    {hasBalance && (
                                      <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'10px', color:'#f4a300', cursor:'pointer' }}>
                                        <input type="checkbox" checked={burnFirst}
                                          onChange={e => setSolCloseBurnFirst(prev => ({ ...prev, [acc.pubkey]: e.target.checked }))}/>
                                        Bakar sisa saldo dulu, lalu tutup akun (tindakan permanen — token akan hilang)
                                      </label>
                                    )}

                                    <button onClick={() => solCloseTokenAccount(acc)}
                                      disabled={isClosing || solCloseAllRunning || (hasBalance && !burnFirst)}
                                      style={{
                                        padding:'9px', fontSize:'11px', fontWeight:'bold',
                                        background: isClosing ? '#1a0000' : (hasBalance && !burnFirst) ? 'transparent' : '#f44336',
                                        color: isClosing ? '#f44336' : '#fff',
                                        border: `1px solid ${(hasBalance && !burnFirst) ? '#333' : '#f44336'}`,
                                        cursor: isClosing ? 'wait' : (hasBalance && !burnFirst) ? 'not-allowed' : 'pointer',
                                        opacity: (hasBalance && !burnFirst) ? 0.4 : 1,
                                        display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                                      }}>
                                      {isClosing
                                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Menutup...</>
                                        : <><FaTrash size={10}/> {hasBalance ? 'Bakar & Tutup Akun' : 'Tutup Akun'}</>}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Bar aksi batch — nempel di bawah daftar, aktif kalau ada akun kosong yang dicentang */}
                          {emptyAccs.length > 0 && (
                            <div style={{
                              display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap',
                              background:'#0a0a0a', border:'1px solid #1e1e1e', padding:'10px 12px',
                            }}>
                              <div style={{ fontSize:'11px', color:'#888' }}>
                                {selectedEmpty.length > 0
                                  ? <>{selectedEmpty.length} akun dipilih · reclaim ± <strong style={{ color:'#4caf50' }}>{selectedReclaim.toFixed(6)} SOL</strong></>
                                  : 'Belum ada akun kosong yang dipilih.'}
                              </div>
                              <button onClick={solCloseSelectedAccounts} disabled={solCloseAllRunning || !!solClosingId || selectedEmpty.length === 0}
                                style={{
                                  padding:'10px 16px', fontWeight:'bold', fontSize:'12px',
                                  cursor: (solCloseAllRunning || selectedEmpty.length===0) ? (solCloseAllRunning?'wait':'not-allowed') : 'pointer',
                                  background: solCloseAllRunning ? '#001a00' : selectedEmpty.length===0 ? 'transparent' : '#00e676',
                                  color: solCloseAllRunning ? '#00e676' : selectedEmpty.length===0 ? '#555' : '#000',
                                  border: `1px solid ${solCloseAllRunning ? '#00e67644' : selectedEmpty.length===0 ? '#333' : '#00e676'}`,
                                  display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                                  opacity: !!solClosingId ? 0.5 : 1, flexShrink:0,
                                }}>
                                {solCloseAllRunning
                                  ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Menutup...</>
                                  : <><FaTrash/> Tutup {selectedEmpty.length || ''} Akun Terpilih</>}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── Riwayat Transaksi Solana ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'18px' }}>
                    <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'12px' }}>
                      Riwayat Transaksi Solana
                    </div>
                    {(() => {
                      const solHistory = agHistory.filter(h => h.description.includes(SOLANA_NETWORK.name)).slice(0, 15);
                      if (solHistory.length === 0) {
                        return <p style={{ color:'#333', fontSize:'12px', textAlign:'center', padding:'16px 0', margin:0 }}>Belum ada transaksi Solana.</p>;
                      }
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
                          {solHistory.map(h => (
                            <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid #141414' }}>
                              <div style={{ minWidth:0, flex:1 }}>
                                <div style={{ fontSize:'11px', color:'#ccc', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.description}</div>
                                <div style={{ fontSize:'10px', color:'#444' }}>{h.timestamp ? new Date(h.timestamp).toLocaleString('id-ID') : ''}</div>
                              </div>
                              {h.txHash && (
                                <a href={`${SOLANA_NETWORK.explorerUrl}/tx/${h.txHash}${SOLANA_NETWORK.clusterParam}`} target="_blank" rel="noreferrer"
                                  style={{ color:'#9945FF', flexShrink:0, display:'flex', alignItems:'center', gap:'4px', fontSize:'10px', textDecoration:'none' }}>
                                  <FaLink size={9}/> Lihat
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ textAlign:'center' }}>
                    <button onClick={solDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {txChain === 'tron' && (
            <>
              <div style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={tronNetId} onChange={e => switchTronNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {TRON_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                {!tronNetwork.isMainnet && (
                  <span style={{ fontSize:'10px', color:'#F1C40F', border:'1px solid #4a3f10', background:'#1a1608', padding:'4px 8px', whiteSpace:'nowrap' }}>
                    ⚠ Jaringan TEST — TRX di sini tidak bernilai, minta dari faucet Nile/Shasta
                  </span>
                )}
                {!tronNetwork.isMainnet && tronNetwork.faucetUrl && (
                  <button onClick={openTronFaucet}
                    style={{ fontSize:'11px', color:'#000', background:'#F1C40F', border:'none', padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', whiteSpace:'nowrap', fontWeight:'bold' }}>
                    <FaFaucet size={10}/> Faucet {tronNetwork.name.replace('Tron ', '').replace(' Testnet', '')}
                  </button>
                )}
                <a href={`${tronNetwork.explorerUrl}`} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#EF0027', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              {!tronConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {tronNetwork.name}
                  </h2>
                  {wallets.some(w => (w.tronAddresses||[]).length > 0) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Tron tersimpan</label>
                      <select value={tronWalletSel} onChange={e => handleTronWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.flatMap((w, wi) =>
                          (w.tronAddresses||[]).map(a => (
                            <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                              {w.name} · #{a.index} · {a.address.slice(0,14)}...
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key (hex)
                  </label>
                  <input
                    type="password"
                    placeholder="0x... atau hex tanpa prefix"
                    value={tronPrivKey}
                    onChange={e => { setTronPrivKey(e.target.value); setTronWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
                  />
                  <button onClick={tronConnect} disabled={tronConnecting || !tronPrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:tronConnecting?'#2a1a1a':tronNetwork.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!tronPrivKey.trim()?0.5:1 }}>
                    {tronConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${tronNetwork.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'22px', fontWeight:'bold', fontFamily:'monospace' }}>
                          {tronLoadingBal ? <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> : tronBalance}
                        </div>
                      </div>
                      <button onClick={() => { tronRefreshBalance(); tronRefreshResources(); }} disabled={tronLoadingBal}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <FaSync size={11} style={{ animation:tronLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                      </button>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #1a1a1a' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'8px 10px' }}>
                          {tronAddress}
                        </code>
                        <button onClick={() => copyText(tronAddress, 'tron_recv')} style={{ background:'none', border:'1px solid #333', color:copiedKey==='tron_recv'?'#4caf50':'#888', cursor:'pointer', padding:'8px 10px' }}>
                          {copiedKey==='tron_recv' ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                        </button>
                        <button onClick={() => setQrAddress(tronAddress)} style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'8px 10px' }}>
                          <FaQrcode size={12}/>
                        </button>
                        <a href={`${tronNetwork.explorerUrl}/address/${tronAddress}`} target="_blank" rel="noreferrer"
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 10px', display:'flex' }} title="Lihat di Explorer">
                          <FaLink size={12}/>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* ── Resources card: Bandwidth & Energy ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                      <h3 style={{ fontSize:'13px', margin:0 }}><FaBolt style={{ marginRight:'6px', color:'#F1C40F' }}/>Resources</h3>
                      <button onClick={() => tronRefreshResources()} disabled={tronResourcesLoading}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                        <FaSync size={10} style={{ animation:tronResourcesLoading?'spin 1s linear infinite':undefined }}/> Refresh
                      </button>
                    </div>

                    {tronResourcesLoading && !tronResources ? (
                      <div style={{ textAlign:'center', color:'#555', padding:'10px 0', fontSize:'12px' }}>
                        <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Memuat kuota resource...
                      </div>
                    ) : !tronResources ? (
                      <div style={{ textAlign:'center', color:'#444', padding:'10px 0', fontSize:'12px' }}>Gagal memuat resource. Coba refresh.</div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                        {([
                          { label: 'Bandwidth', icon: <FaNetworkWired size={11} color="#01a2ff"/>, used: tronResources.freeNetUsed + tronResources.netUsed, limit: tronResources.freeNetLimit + tronResources.netLimit, color:'#01a2ff' },
                          { label: 'Energy',    icon: <FaBolt size={11} color="#F1C40F"/>,          used: tronResources.energyUsed,                                limit: tronResources.energyLimit,                             color:'#F1C40F' },
                        ] as const).map(r => {
                          const pct = r.limit > 0 ? Math.min(100, (r.used / r.limit) * 100) : 0;
                          const avail = Math.max(0, r.limit - r.used);
                          return (
                            <div key={r.label}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px', fontSize:'11px' }}>
                                <span style={{ display:'flex', alignItems:'center', gap:'6px', color:'#888' }}>{r.icon} {r.label}</span>
                                <span style={{ fontFamily:'monospace', color:'#666' }}>
                                  {avail.toLocaleString('en-US')} tersedia · {r.used.toLocaleString('en-US')}/{r.limit.toLocaleString('en-US')}
                                </span>
                              </div>
                              <div style={{ height:'6px', background:'#1a1a1a', overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${pct}%`, background:r.color, transition:'width .3s' }}/>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ fontSize:'10px', color:'#555' }}>
                          Kuota gratis pulih tiap 24 jam. Kurang? Selisihnya di-"burn" pakai TRX saat kirim, atau tambah kuota lewat Freeze TRX (governance) di Tronscan.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Mode toggle: Single / Multi / Sweep ── */}
                  <div style={{ display:'flex', gap:'8px' }}>
                    {([['single','Kirim'],['multi','Multi-Send'],['sweep','Sweep']] as const).map(([m, label]) => (
                      <button key={m} onClick={() => setTronMode(m)}
                        style={{ flex:1, padding:'9px', background:tronMode===m?tronNetwork.color:'none', color:tronMode===m?'#fff':'#888', border:`1px solid ${tronMode===m?tronNetwork.color:'#333'}`, cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {tronMode === 'single' && (
                    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                      <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim TRX</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Asset</label>
                      <select value={tronAsset} onChange={e => setTronAsset(e.target.value)}
                        style={{ width:'100%', fontFamily:'monospace', fontSize:'13px', marginBottom:'6px' }}>
                        <option value="native">TRX (native)</option>
                        {trc20Tokens.filter(t => t.netId === tronNetId && t.address).map(t => (
                          <option key={t.address} value={t.address}>{t.symbol} — {t.name}</option>
                        ))}
                      </select>
                      {tronAsset !== 'native' && (
                        <div style={{ fontSize:'11px', color:'#888', marginBottom:'12px' }}>
                          Saldo: {tronAssetBalLoading ? '...' : tronAssetBal}
                        </div>
                      )}
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="T..." value={tronSendTo} onChange={e => setTronSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>
                          Jumlah ({tronAsset === 'native' ? 'TRX' : (trc20Tokens.find(t=>t.address===tronAsset)?.symbol || 'Token')})
                        </label>
                        <button onClick={tronSetMaxAmount} disabled={tronMaxLoading || !tronConnected}
                          style={{ background:'none', border:'1px solid #333', color:tronMaxLoading?'#555':tronNetwork.color, padding:'2px 8px', cursor:(tronMaxLoading||!tronConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!tronConnected?0.4:1 }}>
                          {tronMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.0" value={tronSendAmt} onChange={e => setTronSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'16px' }}/>

                      {(tronFeeEstimating || tronFeeEstimate) && (
                        <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', padding:'10px 12px', marginBottom:'16px', fontSize:'11px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#666', marginBottom: tronFeeEstimate ? '8px' : 0, textTransform:'uppercase', letterSpacing:'0.5px', fontSize:'10px' }}>
                            <FaGasPump size={10}/> Estimasi Fee
                            {tronFeeEstimating && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                          </div>
                          {tronFeeEstimate && (
                            <>
                              {tronFeeEstimate.destinationIsNew && (
                                <div style={{ display:'flex', gap:'6px', alignItems:'flex-start', color:'#ffaa00', marginBottom:'8px', paddingBottom:'8px', borderBottom:'1px solid #1a1a1a' }}>
                                  <FaExclamationTriangle size={10} style={{ marginTop:'2px', flexShrink:0 }}/>
                                  <span>Address tujuan belum pernah aktif di jaringan Tron — ada fee aktivasi ekstra ~{sunToTrx(tronFeeEstimate.newAccountFeeSun)} TRX yang otomatis dipotong, di luar bandwidth biasa.</span>
                                </div>
                              )}
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                                <span style={{ color:'#888' }}><FaNetworkWired size={9} style={{ marginRight:'5px' }}/>Bandwidth</span>
                                <span style={{ fontFamily:'monospace', color: tronFeeEstimate.bandwidthNeeded <= tronFeeEstimate.bandwidthAvailable ? '#4caf50' : '#ffaa00' }}>
                                  {tronFeeEstimate.bandwidthNeeded} / {tronFeeEstimate.bandwidthAvailable} tersedia
                                </span>
                              </div>
                              {tronFeeEstimate.newAccountFeeSun > 0 && (
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                                  <span style={{ color:'#888' }}><FaRocket size={9} style={{ marginRight:'5px' }}/>Fee aktivasi akun baru</span>
                                  <span style={{ fontFamily:'monospace', color:'#ffaa00' }}>
                                    ~{sunToTrx(tronFeeEstimate.newAccountFeeSun)} TRX
                                  </span>
                                </div>
                              )}
                              {tronFeeEstimate.energyNeeded > 0 && (
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                                  <span style={{ color:'#888' }}><FaBolt size={9} style={{ marginRight:'5px' }}/>Energy</span>
                                  <span style={{ fontFamily:'monospace', color: tronFeeEstimate.energyNeeded <= tronFeeEstimate.energyAvailable ? '#4caf50' : '#ffaa00' }}>
                                    {tronFeeEstimate.energyNeeded} / {tronFeeEstimate.energyAvailable} tersedia
                                  </span>
                                </div>
                              )}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'6px', borderTop:'1px solid #1a1a1a', flexWrap:'wrap', gap:'6px' }}>
                                <span style={{ color:'#888' }}>Total biaya</span>
                                <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                  <span style={{ fontFamily:'monospace', fontWeight:'bold', color: tronFeeEstimate.coveredByFree ? '#4caf50' : '#ffaa00' }}>
                                    {tronFeeEstimate.coveredByFree ? 'Gratis (dicover kuota)' : `~${sunToTrx(tronFeeEstimate.feeSun)} TRX`}
                                  </span>
                                  {!tronFeeEstimate.coveredByFree && renderGasFiatBadge(parseFloat(sunToTrx(tronFeeEstimate.feeSun)))}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {tronFeeEstimateError && (
                        <div style={{ background:'#2a0d0d', border:'1px solid #5a1e1e', color:'#ff8888', padding:'10px 12px', marginBottom:'16px', fontSize:'11px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                          <FaExclamationTriangle style={{ marginTop:'1px', flexShrink:0 }} size={11}/>
                          <span>{tronFeeEstimateError}</span>
                        </div>
                      )}

                      <button onClick={tronSend} disabled={tronSending || !tronSendTo.trim() || !tronSendAmt || !!tronFeeEstimateError}
                        style={{ width:'100%', padding:'12px', background:tronSending?'#2a1a1a':tronNetwork.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!tronSendTo.trim()||!tronSendAmt||!!tronFeeEstimateError)?0.5:1 }}>
                        {tronSending
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                          : <><FaPaperPlane/> Kirim {tronAsset === 'native' ? 'TRX' : (trc20Tokens.find(t=>t.address===tronAsset)?.symbol || 'Token')}</>}
                      </button>
                      {tronStatus.type !== 'idle' && (
                        <div style={{
                          marginTop:'14px', padding:'12px', fontSize:'12px',
                          background: tronStatus.type==='error' ? '#2a0d0d' : tronStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                          border: `1px solid ${tronStatus.type==='error' ? '#5a1e1e' : tronStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                          color: tronStatus.type==='error' ? '#ff8888' : tronStatus.type==='success' ? '#88ff88' : '#ffff88',
                        }}>
                          {tronStatus.msg}
                          {tronStatus.hash && (
                            <a href={`${tronNetwork.explorerUrl}/transaction/${tronStatus.hash}`} target="_blank" rel="noreferrer"
                              style={{ display:'block', marginTop:'6px', color:'#EF0027', wordBreak:'break-all' }}>
                              <FaLink size={9}/> {tronStatus.hash}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {tronMode === 'multi' && (
                    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                      <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaLayerGroup style={{ marginRight:'6px' }}/>Multi-Send TRX</h3>
                      <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                        <input placeholder="Samakan semua jumlah (TRX)" value={tronMultiEqualAmt} onChange={e => setTronMultiEqualAmt(e.target.value)}
                          style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}/>
                        <button onClick={tronMultiApplyEqual} style={{ background:'none', border:'1px solid #333', color:'#888', padding:'0 14px', cursor:'pointer', fontSize:'12px' }}>Terapkan</button>
                      </div>
                      {tronMultiRows.map(row => (
                        <div key={row.id} style={{ display:'flex', gap:'6px', marginBottom:'8px', alignItems:'center' }}>
                          <input placeholder="Address tujuan" value={row.to} onChange={e => tronMultiUpdateRow(row.id, 'to', e.target.value)}
                            style={{ flex:2, fontFamily:'monospace', fontSize:'12px' }}/>
                          <input placeholder="Jumlah" type="number" value={row.amount} onChange={e => tronMultiUpdateRow(row.id, 'amount', e.target.value)}
                            style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}/>
                          <span style={{ fontSize:'10px', width:'70px', flexShrink:0, color: row.status==='success'?'#4caf50':row.status==='failed'?'#f44336':row.status==='pending'?'#ffaa00':'#444' }}>
                            {row.status==='idle' ? '' : row.status}
                          </span>
                          <button onClick={() => tronMultiRemoveRow(row.id)} disabled={tronMultiRows.length<=1}
                            style={{ background:'none', border:'none', color:'#f44336', cursor:'pointer', padding:'6px' }}><FaTrash size={11}/></button>
                        </div>
                      ))}
                      <button onClick={tronMultiAddRow} style={{ background:'none', border:'1px dashed #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', marginBottom:'16px' }}>
                        <FaPlus size={10}/> Tambah Baris
                      </button>
                      <button onClick={tronMultiSend} disabled={tronMultiRunning}
                        style={{ width:'100%', padding:'12px', background:tronMultiRunning?'#2a1a1a':tronNetwork.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
                        {tronMultiRunning ? 'Mengirim...' : `Kirim ke ${tronMultiRows.filter(r=>isValidTronAddress(r.to)&&parseFloat(r.amount)>0).length} Penerima`}
                      </button>
                    </div>
                  )}

                  {tronMode === 'sweep' && (
                    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                      <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaExchangeAlt style={{ marginRight:'6px' }}/>Sweep TRX</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan (kumpulkan ke sini)</label>
                      <input placeholder="T..." value={tronSweepDestAddr} onChange={e => setTronSweepDestAddr(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                        <select value={tronSweepAmtMode} onChange={e => setTronSweepAmtMode(e.target.value as any)} style={{ fontSize:'12px' }}>
                          <option value="all">Sapu Semua Saldo</option>
                          <option value="fixed">Jumlah Tetap</option>
                        </select>
                        {tronSweepAmtMode === 'all' ? (
                          <input placeholder="Sisakan (TRX)" value={tronSweepLeaveBuf} onChange={e => setTronSweepLeaveBuf(e.target.value)} style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}/>
                        ) : (
                          <input placeholder="Jumlah tetap (TRX)" value={tronSweepFixedAmt} onChange={e => setTronSweepFixedAmt(e.target.value)} style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}/>
                        )}
                      </div>

                      <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                        <select value="" onChange={e => tronSweepAddFromBIP39(e.target.value)} style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}>
                          <option value="">-- Tambah dari Wallet BIP39 --</option>
                          {wallets.flatMap((w, wi) =>
                            (w.tronAddresses||[]).map(a => (
                              <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>{w.name} · #{a.index} · {a.address.slice(0,14)}...</option>
                            ))
                          )}
                        </select>
                      </div>
                      <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
                        <input placeholder="Atau tempel private key manual" value={tronSweepManualPK} onChange={e => setTronSweepManualPK(e.target.value)}
                          style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}/>
                        <button onClick={tronSweepAddManualPK} style={{ background:'none', border:'1px solid #333', color:'#888', padding:'0 14px', cursor:'pointer', fontSize:'12px' }}>Tambah</button>
                      </div>

                      {tronSweepSources.length > 0 && (
                        <>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                            <span style={{ fontSize:'11px', color:'#555' }}>{tronSweepSources.length} wallet sumber</span>
                            <button onClick={tronSweepFetchBalances} disabled={tronSweepFetchingBal}
                              style={{ background:'none', border:'1px solid #333', color:'#888', padding:'4px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                              <FaSync size={10} style={{ animation:tronSweepFetchingBal?'spin 1s linear infinite':undefined }}/> Cek Saldo Semua
                            </button>
                          </div>
                          {tronSweepSources.map(s => (
                            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 0', borderBottom:'1px solid #141414', fontSize:'11px' }}>
                              <span style={{ flex:1, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</span>
                              <span style={{ color:'#4caf50', fontFamily:'monospace' }}>{s.balance ?? '—'}</span>
                              <span style={{ width:'60px', color: s.status==='success'?'#4caf50':s.status==='failed'?'#f44336':s.status==='skipped'?'#ffaa00':s.status==='pending'?'#ffaa00':'#444' }}>{s.status==='idle'?'':s.status}</span>
                              <button onClick={() => tronSweepRemoveSource(s.id)} style={{ background:'none', border:'none', color:'#f44336', cursor:'pointer', padding:'4px' }}><FaTrash size={10}/></button>
                            </div>
                          ))}
                        </>
                      )}

                      <button onClick={tronSweepRun} disabled={tronSweepRunning || tronSweepSources.length===0}
                        style={{ width:'100%', marginTop:'16px', padding:'12px', background:tronSweepRunning?'#2a1a1a':tronNetwork.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', opacity:tronSweepSources.length===0?0.5:1 }}>
                        {tronSweepRunning ? 'Menyapu...' : `Sweep dari ${tronSweepSources.length} Wallet`}
                      </button>
                    </div>
                  )}

                  <div style={{ textAlign:'center' }}>
                    <button onClick={tronDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {txChain === 'axm' && (
            <>
              <div style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={axmNetId} onChange={e => switchAxmNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {AXIOME_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                <a href={`${AXIOME_NETWORK.explorerUrl}`} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#75bbe9', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              {AXIOME_NETWORK.rpcUrls.length === 0 && (
                <div style={{ background:'#1a1608', border:'1px solid #4a3f10', color:'#F1C40F', padding:'12px 14px', marginBottom:'16px', fontSize:'11px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                  <FaExclamationTriangle size={12} style={{ marginTop:'1px', flexShrink:0 }}/>
                  <span>Belum ada RPC/REST Axiome yang dikonfigurasi — isi <code>AXIOME_NETWORKS[].rpcUrls</code> / <code>restUrls</code> di <code>Axiomenet.ts</code> dengan endpoint node yang kamu punya akses (kirim & cek saldo butuh ini).</span>
                </div>
              )}

              {!axmConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {AXIOME_NETWORK.name}
                  </h2>
                  {wallets.some(w => (w.axmAddresses||[]).length > 0) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Axiome tersimpan</label>
                      <select value={axmWalletSel} onChange={e => handleAxmWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.flatMap((w, wi) =>
                          (w.axmAddresses||[]).map(a => (
                            <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                              {w.name} · #{a.index} · {a.address.slice(0,14)}...
                            </option>
                          ))
                        )}
                      </select>

                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key (hex)
                  </label>
                  <input
                    type="password"
                    placeholder="0x... atau hex tanpa prefix"
                    value={axmPrivKey}
                    onChange={e => { setAxmPrivKey(e.target.value); setAxmWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
                  />
                  <button onClick={axmConnect} disabled={axmConnecting || !axmPrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:axmConnecting?'#2a1a1a':AXIOME_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!axmPrivKey.trim()?0.5:1 }}>
                    {axmConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${AXIOME_NETWORK.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'22px', fontWeight:'bold', fontFamily:'monospace' }}>
                          {axmLoadingBal ? <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> : axmBalance}
                        </div>
                      </div>
                      <button onClick={() => axmRefreshBalance()} disabled={axmLoadingBal}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <FaSync size={11} style={{ animation:axmLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                      </button>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #1a1a1a' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'8px 10px' }}>
                          {axmAddress}
                        </code>
                        <button onClick={() => copyText(axmAddress, 'axm_recv')} style={{ background:'none', border:'1px solid #333', color:copiedKey==='axm_recv'?'#4caf50':'#888', cursor:'pointer', padding:'8px 10px' }}>
                          {copiedKey==='axm_recv' ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                        </button>
                        <button onClick={() => setQrAddress(axmAddress)} style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'8px 10px' }}>
                          <FaQrcode size={12}/>
                        </button>
                        <a href={`${AXIOME_NETWORK.explorerUrl}/address/${axmAddress}`} target="_blank" rel="noreferrer"
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 10px', display:'flex' }} title="Lihat di Explorer">
                          <FaLink size={12}/>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim AXM</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="axm1..." value={axmSendTo} onChange={e => setAxmSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Jumlah (AXM)</label>
                        <button onClick={axmSetMaxAmount} disabled={axmMaxLoading || !axmConnected}
                          style={{ background:'none', border:'1px solid #333', color:axmMaxLoading?'#555':AXIOME_NETWORK.color, padding:'2px 8px', cursor:(axmMaxLoading||!axmConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!axmConnected?0.4:1 }}>
                          {axmMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.0" value={axmSendAmt} onChange={e => setAxmSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'16px' }}/>

                      {(axmFeeEstimating || axmFeeEstimate || axmFeeEstimateError) && (
                        <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px', marginBottom:'16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#666', marginBottom: (axmFeeEstimate || axmFeeEstimateError) ? '8px' : 0, textTransform:'uppercase', letterSpacing:'0.5px', fontSize:'10px' }}>
                            <FaGasPump size={10}/> Estimasi Fee
                            {axmFeeEstimating && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                          </div>
                          {axmFeeEstimate && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px', fontSize:'11px' }}>
                              <span style={{ color:'#888' }}>Gas: <span style={{ fontFamily:'monospace', color:'#ccc' }}>{axmFeeEstimate.gasUnits.toLocaleString('en-US')}</span> unit</span>
                              <span style={{ color:'#888' }}>Harga: <span style={{ fontFamily:'monospace', color:'#ccc' }}>{axmFeeEstimate.gasPriceUaxm}</span> uaxm/unit</span>
                              <span style={{ fontFamily:'monospace', fontWeight:'bold', color:'#4caf50' }}>
                                ≈ {axmFeeEstimate.feeAxm.toLocaleString('en-US', { maximumFractionDigits: 6 })} AXM
                              </span>
                              {renderGasFiatBadge(axmFeeEstimate.feeAxm)}
                            </div>
                          )}
                          {axmFeeEstimateError && (
                            <div style={{ display:'flex', gap:'6px', alignItems:'flex-start', color:'#ffaa00', fontSize:'11px' }}>
                              <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                              <span>{axmFeeEstimateError}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <button onClick={axmSend} disabled={axmSending || !axmSendTo.trim() || !axmSendAmt || AXIOME_NETWORK.rpcUrls.length===0}
                        style={{ width:'100%', padding:'12px', background:axmSending?'#2a1a1a':AXIOME_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!axmSendTo.trim()||!axmSendAmt||AXIOME_NETWORK.rpcUrls.length===0)?0.5:1 }}>
                        {axmSending
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                          : <><FaPaperPlane/> Kirim AXM</>}
                      </button>
                      {axmStatus.type !== 'idle' && (
                        <div style={{
                          marginTop:'14px', padding:'12px', fontSize:'12px',
                          background: axmStatus.type==='error' ? '#2a0d0d' : axmStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                          border: `1px solid ${axmStatus.type==='error' ? '#5a1e1e' : axmStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                          color: axmStatus.type==='error' ? '#ff8888' : axmStatus.type==='success' ? '#88ff88' : '#ffff88',
                        }}>
                          {axmStatus.msg}
                          {axmStatus.hash && (
                            <a href={`${AXIOME_NETWORK.explorerUrl}/tx/${axmStatus.hash}`} target="_blank" rel="noreferrer"
                              style={{ display:'block', marginTop:'6px', color:'#75bbe9', wordBreak:'break-all' }}>
                              <FaLink size={9}/> {axmStatus.hash}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                  <div style={{ textAlign:'center' }}>
                    <button onClick={axmDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {txChain === 'sui' && (
            <>
              <div style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={suiNetId} onChange={e => switchSuiNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {SUI_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                <a href={SUI_NETWORK.explorerUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#4DA2FF', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              {!suiConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {SUI_NETWORK.name}
                  </h2>
                  {wallets.some(w => (w.suiAddresses||[]).length > 0) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Sui tersimpan</label>
                      <select value={suiWalletSel} onChange={e => handleSuiWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.flatMap((w, wi) =>
                          (w.suiAddresses||[]).map(a => (
                            <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                              {w.name} · #{a.index} · {a.address.slice(0,14)}...
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key (hex)
                  </label>
                  <input
                    type="password"
                    placeholder="0x... 32-byte seed hex"
                    value={suiPrivKey}
                    onChange={e => { setSuiPrivKey(e.target.value); setSuiWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
                  />
                  <button onClick={suiConnect} disabled={suiConnecting || !suiPrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:suiConnecting?'#1a1e2a':SUI_NETWORK.color, color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!suiPrivKey.trim()?0.5:1 }}>
                    {suiConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${SUI_NETWORK.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'22px', fontWeight:'bold', fontFamily:'monospace' }}>
                          {suiLoadingBal ? <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> : suiBalance}
                        </div>
                      </div>
                      <button onClick={() => suiRefreshBalance()} disabled={suiLoadingBal}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <FaSync size={11} style={{ animation:suiLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                      </button>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #1a1a1a' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'8px 10px' }}>
                          {suiAddress}
                        </code>
                        <button onClick={() => copyText(suiAddress, 'sui_recv')} style={{ background:'none', border:'1px solid #333', color:copiedKey==='sui_recv'?'#4caf50':'#888', cursor:'pointer', padding:'8px 10px' }}>
                          {copiedKey==='sui_recv' ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                        </button>
                        <button onClick={() => setQrAddress(suiAddress)} style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'8px 10px' }}>
                          <FaQrcode size={12}/>
                        </button>
                        <a href={`${SUI_NETWORK.explorerUrl}/${suiAddress}`} target="_blank" rel="noreferrer"
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 10px', display:'flex' }} title="Lihat di Explorer">
                          <FaLink size={12}/>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim SUI</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="0x..." value={suiSendTo} onChange={e => setSuiSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Jumlah (SUI)</label>
                        <button onClick={suiSetMaxAmount} disabled={suiMaxLoading || !suiConnected}
                          style={{ background:'none', border:'1px solid #333', color:suiMaxLoading?'#555':SUI_NETWORK.color, padding:'2px 8px', cursor:(suiMaxLoading||!suiConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!suiConnected?0.4:1 }}>
                          {suiMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.0" value={suiSendAmt} onChange={e => setSuiSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'8px' }}/>
                      <div style={{ fontSize:'10px', color:'#444', marginBottom:'16px' }}>
                        <FaGasPump size={9} style={{ marginRight:'4px' }}/>Gas budget dipatok otomatis (dipotong dari saldo yang sama)
                      </div>

                      <button onClick={suiSend} disabled={suiSending || !suiSendTo.trim() || !suiSendAmt}
                        style={{ width:'100%', padding:'12px', background:suiSending?'#1a1e2a':SUI_NETWORK.color, color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!suiSendTo.trim()||!suiSendAmt)?0.5:1 }}>
                        {suiSending
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                          : <><FaPaperPlane/> Kirim SUI</>}
                      </button>
                      {suiStatus.type !== 'idle' && (
                        <div style={{
                          marginTop:'14px', padding:'12px', fontSize:'12px',
                          background: suiStatus.type==='error' ? '#2a0d0d' : suiStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                          border: `1px solid ${suiStatus.type==='error' ? '#5a1e1e' : suiStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                          color: suiStatus.type==='error' ? '#ff8888' : suiStatus.type==='success' ? '#88ff88' : '#ffff88',
                        }}>
                          {suiStatus.msg}
                          {suiStatus.hash && (
                            <a href={`${SUI_NETWORK.explorerUrl.replace('/account','/tx')}/${suiStatus.hash}`} target="_blank" rel="noreferrer"
                              style={{ display:'block', marginTop:'6px', color:'#4DA2FF', wordBreak:'break-all' }}>
                              <FaLink size={9}/> {suiStatus.hash}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                  <div style={{ textAlign:'center' }}>
                    <button onClick={suiDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {txChain === 'apt' && (
            <>
              <div style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={aptNetId} onChange={e => switchAptNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {APTOS_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                <a href={APTOS_NETWORK.explorerUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#00D2AA', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              {!aptConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {APTOS_NETWORK.name}
                  </h2>
                  {wallets.some(w => (w.aptAddresses||[]).length > 0) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Aptos tersimpan</label>
                      <select value={aptWalletSel} onChange={e => handleAptWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.flatMap((w, wi) =>
                          (w.aptAddresses||[]).map(a => (
                            <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                              {w.name} · #{a.index} · {a.address.slice(0,14)}...
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key (hex)
                  </label>
                  <input
                    type="password"
                    placeholder="0x... 32-byte seed hex"
                    value={aptPrivKey}
                    onChange={e => { setAptPrivKey(e.target.value); setAptWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
                  />
                  <button onClick={aptConnect} disabled={aptConnecting || !aptPrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:aptConnecting?'#0a1a16':APTOS_NETWORK.color, color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!aptPrivKey.trim()?0.5:1 }}>
                    {aptConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${APTOS_NETWORK.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'22px', fontWeight:'bold', fontFamily:'monospace' }}>
                          {aptLoadingBal ? <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> : aptBalance}
                        </div>
                      </div>
                      <button onClick={() => aptRefreshBalance()} disabled={aptLoadingBal}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <FaSync size={11} style={{ animation:aptLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                      </button>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #1a1a1a' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'8px 10px' }}>
                          {aptAddress}
                        </code>
                        <button onClick={() => copyText(aptAddress, 'apt_recv')} style={{ background:'none', border:'1px solid #333', color:copiedKey==='apt_recv'?'#4caf50':'#888', cursor:'pointer', padding:'8px 10px' }}>
                          {copiedKey==='apt_recv' ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                        </button>
                        <button onClick={() => setQrAddress(aptAddress)} style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'8px 10px' }}>
                          <FaQrcode size={12}/>
                        </button>
                        <a href={`${APTOS_NETWORK.explorerUrl}/${aptAddress}`} target="_blank" rel="noreferrer"
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 10px', display:'flex' }} title="Lihat di Explorer">
                          <FaLink size={12}/>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim APT</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="0x..." value={aptSendTo} onChange={e => setAptSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Jumlah (APT)</label>
                        <button onClick={aptSetMaxAmount} disabled={aptMaxLoading || !aptConnected}
                          style={{ background:'none', border:'1px solid #333', color:aptMaxLoading?'#555':APTOS_NETWORK.color, padding:'2px 8px', cursor:(aptMaxLoading||!aptConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!aptConnected?0.4:1 }}>
                          {aptMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.0" value={aptSendAmt} onChange={e => setAptSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'8px' }}/>
                      <div style={{ fontSize:'10px', color:'#444', marginBottom:'16px' }}>
                        <FaGasPump size={9} style={{ marginRight:'4px' }}/>Gas fee dipatok kecil & otomatis dipotong dari saldo yang sama — tombol MAX sudah menyisakan buffer-nya.
                      </div>

                      <button onClick={aptSend} disabled={aptSending || !aptSendTo.trim() || !aptSendAmt}
                        style={{ width:'100%', padding:'12px', background:aptSending?'#0a1a16':APTOS_NETWORK.color, color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!aptSendTo.trim()||!aptSendAmt)?0.5:1 }}>
                        {aptSending
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                          : <><FaPaperPlane/> Kirim APT</>}
                      </button>
                      {aptStatus.type !== 'idle' && (
                        <div style={{
                          marginTop:'14px', padding:'12px', fontSize:'12px',
                          background: aptStatus.type==='error' ? '#2a0d0d' : aptStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                          border: `1px solid ${aptStatus.type==='error' ? '#5a1e1e' : aptStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                          color: aptStatus.type==='error' ? '#ff8888' : aptStatus.type==='success' ? '#88ff88' : '#ffff88',
                        }}>
                          {aptStatus.msg}
                          {aptStatus.hash && (
                            <a href={`${APTOS_NETWORK.explorerUrl}/${aptAddress}/transactions?txn=${aptStatus.hash}`} target="_blank" rel="noreferrer"
                              style={{ display:'block', marginTop:'6px', color:'#00D2AA', wordBreak:'break-all' }}>
                              <FaLink size={9}/> {aptStatus.hash}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                  <div style={{ textAlign:'center' }}>
                    <button onClick={aptDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {txChain === 'ase' && (
            <>
              <div style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={aseNetId} onChange={e => switchAseNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {ASENTUM_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                <a href={ASENTUM_NETWORK.explorerUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#4949DF', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              <div style={{ marginBottom:'16px', padding:'10px 12px', background:'#1a1a0d', border:'1px solid #5a5a1e', fontSize:'11px', color:'#ffff88', display:'flex', alignItems:'flex-start', gap:'8px' }}>
                <FaExclamationTriangle size={12} style={{ flexShrink:0, marginTop:'1px' }}/>
                <span>Asentum masih testnet post-quantum (Dilithium3/ML-DSA-65) — saldo/kirim tx bisa gagal kalau chain-nya sedang tidak responsif.</span>
              </div>

              {!aseConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {ASENTUM_NETWORK.name}
                  </h2>
                  {wallets.some(w => (w.aseAddresses||[]).length > 0) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Asentum tersimpan</label>
                      <select value={aseWalletSel} onChange={e => handleAseWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.flatMap((w, wi) =>
                          (w.aseAddresses||[]).map(a => (
                            <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                              {w.name} · #{a.index} · {a.address.slice(0,14)}...
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key
                  </label>
                  <input
                    type="password"
                    placeholder="64 hex seed (recovery key)"
                    value={asePrivKey}
                    onChange={e => { setAsePrivKey(e.target.value); setAseWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
                  />
                  <button onClick={aseConnect} disabled={aseConnecting || !asePrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:aseConnecting?'#0a0a1a':ASENTUM_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!asePrivKey.trim()?0.5:1 }}>
                    {aseConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${ASENTUM_NETWORK.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'22px', fontWeight:'bold', fontFamily:'monospace' }}>
                          {aseLoadingBal ? <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> : aseBalance}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button onClick={aseRequestFaucet} disabled={aseFaucetLoading}
                          title={`Minta ASE gratis di ${ASENTUM_NETWORK.name}`}
                          style={{ background:'none', border:'1px solid #4a3f10', color:'#F1C40F', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                          <FaFaucet size={11} style={{ animation:aseFaucetLoading?'spin 1s linear infinite':undefined }}/> {aseFaucetLoading ? 'Meminta...' : 'Faucet ASE'}
                        </button>
                        <button onClick={() => aseRefreshBalance()} disabled={aseLoadingBal}
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                          <FaSync size={11} style={{ animation:aseLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #1a1a1a' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'8px 10px' }}>
                          {aseAddress}
                        </code>
                        <button onClick={() => copyText(aseAddress, 'ase_recv')} style={{ background:'none', border:'1px solid #333', color:copiedKey==='ase_recv'?'#4caf50':'#888', cursor:'pointer', padding:'8px 10px' }}>
                          {copiedKey==='ase_recv' ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                        </button>
                        <button onClick={() => setQrAddress(aseAddress)} style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'8px 10px' }}>
                          <FaQrcode size={12}/>
                        </button>
                        <a href={`${ASENTUM_NETWORK.explorerUrl}/address/${aseAddress}`} target="_blank" rel="noreferrer"
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 10px', display:'flex' }} title="Lihat di Explorer">
                          <FaLink size={12}/>
                        </a>
                      </div>
                      {aseHexAddress && (
                        <div style={{ marginTop:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'9px', color:'#555', textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }} title='Address RPC Asentum — dipakai @asentum/sdk buat request RPC (getBalance, sendTransfer, dst). Sama akun dengan yang di atas, cuma beda representasi; bukan address EVM walau formatnya mirip.'>
                            Hex (RPC):
                          </span>
                          <code style={{ flex:1, fontSize:'11px', color:'#7a7aff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'6px 10px' }}>
                            {aseHexAddress}
                          </code>
                          <button onClick={() => copyText(aseHexAddress, 'ase_recv_hex')} style={{ background:'none', border:'1px solid #333', color:copiedKey==='ase_recv_hex'?'#4caf50':'#888', cursor:'pointer', padding:'6px 8px', flexShrink:0 }}>
                            {copiedKey==='ase_recv_hex' ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                          </button>
                          <a href={`${ASENTUM_NETWORK.explorerUrl}/address/${aseHexAddress}`} target="_blank" rel="noreferrer"
                            style={{ background:'none', border:'1px solid #333', color:'#888', padding:'6px 8px', display:'flex', flexShrink:0 }} title="Lihat di Explorer">
                            <FaLink size={11}/>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <AseSendAssetSection ctx={ctx} net={ASENTUM_NETWORK} privateKey={asePrivKey} holderHex={aseHexAddress} holderBech32={aseAddress} savedTokens={aseTokens}
                    nativeContent={<>
                  {/* ── Mode: Kirim / Multi Send / Sweep ── */}
                  <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px' }}>
                    {([
                      ['single', <FaPaperPlane key="i" size={11}/>, 'Kirim'],
                      ['multi',  <FaLayerGroup key="i" size={11}/>, 'Multi Send'],
                      ['sweep',  <FaExchangeAlt key="i" size={11}/>, 'Sweep'],
                    ] as const).map(([m, icon, label]) => (
                      <button key={m} onClick={() => setAseMode(m)} style={{
                        flex:1, padding:'9px 8px', background: aseMode===m ? ASENTUM_NETWORK.color : 'transparent',
                        border:'none', color: aseMode===m ? '#fff' : '#666',
                        cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                      }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>

                  {aseMode === 'single' && (
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim ASE</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="ase1... atau 0x..." value={aseSendTo} onChange={e => setAseSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Jumlah (ASE)</label>
                        <button onClick={aseSetMaxAmount} disabled={aseMaxLoading || !aseConnected}
                          style={{ background:'none', border:'1px solid #333', color:aseMaxLoading?'#555':ASENTUM_NETWORK.color, padding:'2px 8px', cursor:(aseMaxLoading||!aseConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!aseConnected?0.4:1 }}>
                          {aseMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.0" value={aseSendAmt} onChange={e => setAseSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'16px' }}/>

                      <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px', marginBottom:'16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', marginBottom: (aseFeeEstimate || aseFeeEstimateError) ? '8px' : 0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#666', textTransform:'uppercase', letterSpacing:'0.5px', fontSize:'10px' }}>
                            <FaGasPump size={10}/> Estimasi Gas Fee
                            {aseFeeEstimating && <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                          </div>
                          <button onClick={() => aseRefreshFeeEstimate()} disabled={aseFeeEstimating}
                            style={{ background:'none', border:'1px solid #333', color:'#888', padding:'2px 8px', cursor:aseFeeEstimating?'not-allowed':'pointer', fontSize:'10px', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaSync size={9} style={{ animation:aseFeeEstimating?'spin 1s linear infinite':undefined }}/> Refresh
                          </button>
                        </div>
                        {aseFeeEstimate && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px', fontSize:'11px' }}>
                            <span style={{ color:'#888' }}>Gas Limit: <span style={{ fontFamily:'monospace', color:'#ccc' }}>{Number(aseFeeEstimate.gasLimit).toLocaleString('en-US')}</span> unit</span>
                            <span style={{ color:'#888' }}>Base Fee: <span style={{ fontFamily:'monospace', color:'#ccc' }}>{aseFeeEstimate.baseFeePerGas}</span> wei/unit</span>
                            <span style={{ fontFamily:'monospace', fontWeight:'bold', color:'#4caf50' }}>
                              ≈ {aseFeeEstimate.feeAse.toLocaleString('en-US', { maximumFractionDigits: 18 })} ASE
                            </span>
                          </div>
                        )}
                        {aseFeeEstimateError && (
                          <div style={{ display:'flex', gap:'6px', alignItems:'flex-start', color:'#ffaa00', fontSize:'11px' }}>
                            <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                            <span>{aseFeeEstimateError}</span>
                          </div>
                        )}
                        <div style={{ fontSize:'10px', color:'#444', marginTop:'6px' }}>
                          Gas fee otomatis dipotong dari saldo yang sama — tombol MAX sudah menyisakan estimasi di atas.
                        </div>
                      </div>

                      <button onClick={aseSend} disabled={aseSending || !aseSendTo.trim() || !aseSendAmt}
                        style={{ width:'100%', padding:'12px', background:aseSending?'#0a0a1a':ASENTUM_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!aseSendTo.trim()||!aseSendAmt)?0.5:1 }}>
                        {aseSending
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                          : <><FaPaperPlane/> Kirim ASE</>}
                      </button>
                      {aseStatus.type !== 'idle' && (
                        <div style={{
                          marginTop:'14px', padding:'12px', fontSize:'12px',
                          background: aseStatus.type==='error' ? '#2a0d0d' : aseStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                          border: `1px solid ${aseStatus.type==='error' ? '#5a1e1e' : aseStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                          color: aseStatus.type==='error' ? '#ff8888' : aseStatus.type==='success' ? '#88ff88' : '#ffff88',
                        }}>
                          {aseStatus.msg}
                          {aseStatus.hash && (
                            <a href={`${ASENTUM_NETWORK.explorerUrl}/tx/${aseStatus.hash}`} target="_blank" rel="noreferrer"
                              style={{ display:'block', marginTop:'6px', color:'#4949DF', wordBreak:'break-all' }}>
                              <FaLink size={9}/> {aseStatus.hash}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Multi Send ── */}
                  {aseMode === 'multi' && (
                    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
                      <h3 style={{ fontSize:'13px', margin:0 }}><FaLayerGroup style={{ marginRight:'6px' }}/>Multi Send ASE</h3>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                        <label style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>Jumlah rata (ASE):</label>
                        <input type="number" placeholder="0.001" step="0.0001" min="0" value={aseMultiEqualAmt}
                          onChange={e => setAseMultiEqualAmt(e.target.value)}
                          style={{ width:'110px', fontFamily:'monospace', fontSize:'12px' }}/>
                        <button onClick={aseMultiApplyEqual} disabled={!aseMultiEqualAmt}
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 12px', cursor:'pointer', fontSize:'11px', opacity:!aseMultiEqualAmt?0.4:1 }}>
                          Terapkan ke semua baris
                        </button>
                      </div>

                      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                        {aseMultiRows.map((row, idx) => {
                          const statusColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336' }[row.status];
                          return (
                            <div key={row.id} style={{ display:'grid', gridTemplateColumns:'1fr 110px 40px 26px', gap:'6px', alignItems:'center' }}>
                              <input type="text" placeholder={`ase1... atau 0x... #${idx+1}`} value={row.to}
                                onChange={e => aseMultiUpdateRow(row.id, 'to', e.target.value)}
                                style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background: row.status==='failed'?'#1a0000':row.status==='success'?'#001a00':'#0d0d0d', border:`1px solid ${row.to && !aseIsValidAddr(row.to) ? '#f4433666' : row.status!=='idle'?statusColor+'44':'#1e1e1e'}` }}/>
                              <input type="number" placeholder="0.001" step="0.0001" min="0" value={row.amount}
                                onChange={e => aseMultiUpdateRow(row.id, 'amount', e.target.value)}
                                style={{ fontFamily:'monospace', fontSize:'11px', padding:'8px 9px', background:'#0d0d0d', border:'1px solid #1e1e1e' }}/>
                              <div style={{ fontSize:'10px', fontWeight:'bold', color:statusColor, fontFamily:'monospace', textAlign:'center' }}>
                                {row.status === 'idle'    && '—'}
                                {row.status === 'pending' && '⟳'}
                                {row.status === 'success' && '✓'}
                                {row.status === 'failed'  && '✗'}
                              </div>
                              <button onClick={() => aseMultiRemoveRow(row.id)} disabled={aseMultiRows.length === 1 || aseMultiRunning}
                                style={{ background:'none', border:'1px solid #2a2a2a', color:'#f44336', padding:'6px', cursor: aseMultiRows.length===1?'not-allowed':'pointer', fontSize:'11px', opacity:aseMultiRows.length===1?0.3:1 }}>
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <button onClick={aseMultiAddRow} disabled={aseMultiRunning}
                        style={{ alignSelf:'flex-start', background:'none', border:'none', color:ASENTUM_NETWORK.color, padding:'2px 0', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px' }}>
                        <FaPlus size={10}/> Tambah baris
                      </button>

                      {aseMultiRows.some(r => r.hash || r.error) && (
                        <div style={{ background:'#070707', border:'1px solid #1a1a1a', padding:'10px 12px', fontSize:'11px', fontFamily:'monospace', display:'flex', flexDirection:'column', gap:'5px' }}>
                          {aseMultiRows.filter(r => r.hash || r.error).map(r => (
                            <div key={r.id + '_log'}>
                              {r.hash && (
                                <span style={{ color:'#4caf50' }}>
                                  ✓ {shortAddr(r.to)} —{' '}
                                  <a href={`${ASENTUM_NETWORK.explorerUrl}/tx/${r.hash}`} target="_blank" rel="noreferrer" style={{ color:'#7a7aff' }}>{r.hash.slice(0,18)}…</a>
                                </span>
                              )}
                              {r.error && <span style={{ color:'#f44336' }}>✗ {shortAddr(r.to)} — {r.error.slice(0,80)}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      <button onClick={aseMultiSend}
                        disabled={aseMultiRunning || aseMultiRows.every(r => !r.to || !r.amount)}
                        style={{
                          padding:'13px', background:aseMultiRunning?'#0a0a1a':ASENTUM_NETWORK.color, color:'#fff', border:'none',
                          cursor:aseMultiRunning?'wait':'pointer', fontSize:'14px', fontWeight:'bold',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
                          opacity: aseMultiRows.every(r=>!r.to||!r.amount) ? 0.5 : 1,
                        }}>
                        {aseMultiRunning
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim {aseMultiRows.filter(r=>r.status==='success').length}/{aseMultiRows.filter(r=>aseIsValidAddr(r.to)&&parseFloat(r.amount)>0).length}...</>
                          : <><FaPaperPlane/> Kirim {aseMultiRows.filter(r=>aseIsValidAddr(r.to)&&parseFloat(r.amount)>0).length || aseMultiRows.length} Transaksi</>}
                      </button>
                      <div style={{ fontSize:'10px', color:'#444', textAlign:'center' }}>
                        Dikirim satu per satu — tiap TX menunggu konfirmasi sebelum lanjut. Tiap TX memotong gas fee dari saldo yang sama.
                      </div>
                    </div>
                  )}

                  {/* ── Sweep ── */}
                  {aseMode === 'sweep' && (
                    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
                      <h3 style={{ fontSize:'13px', margin:0 }}><FaExchangeAlt style={{ marginRight:'6px' }}/>Sweep ASE</h3>
                      <div style={{ fontSize:'11px', color:'#888', lineHeight:'1.6' }}>
                        Kirim saldo ASE dari banyak wallet ke <strong style={{ color:'#ccc' }}>satu address tujuan</strong>. Wallet dengan saldo lebih kecil dari estimasi fee otomatis di-skip.
                      </div>

                      <div>
                        <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Address tujuan (penerima)</label>
                        <input type="text" placeholder="ase1... atau 0x... yang akan menerima semua dana"
                          value={aseSweepDestAddr} onChange={e => setAseSweepDestAddr(e.target.value)}
                          style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px',
                            borderColor: aseSweepDestAddr && !aseIsValidAddr(aseSweepDestAddr) ? '#f44336' : undefined }}/>
                        {aseSweepDestAddr && !aseIsValidAddr(aseSweepDestAddr) && (
                          <div style={{ fontSize:'10px', color:'#f44336', marginTop:'3px' }}>Address tidak valid</div>
                        )}
                      </div>

                      <div style={{ display:'flex', gap:'2px', background:'#000', border:'1px solid #1e1e1e', padding:'2px' }}>
                        {(['all','fixed'] as const).map(m => (
                          <button key={m} onClick={() => setAseSweepAmtMode(m)} style={{
                            flex:1, padding:'8px', background: aseSweepAmtMode===m ? ASENTUM_NETWORK.color : 'transparent',
                            border:'none', color: aseSweepAmtMode===m ? '#fff' : '#666', cursor:'pointer', fontSize:'11px', fontWeight:'bold',
                          }}>
                            {m === 'all' ? 'Semua Saldo' : 'Jumlah Tetap'}
                          </button>
                        ))}
                      </div>

                      {aseSweepAmtMode === 'fixed' ? (
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Jumlah tetap (ASE) per wallet</label>
                          <input type="number" placeholder="0.01" step="0.0001" min="0" value={aseSweepFixedAmt}
                            onChange={e => setAseSweepFixedAmt(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>
                      ) : (
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Sisakan di tiap wallet (ASE, di luar fee)</label>
                          <input type="number" placeholder="0" step="0.0001" min="0" value={aseSweepLeaveBuf}
                            onChange={e => setAseSweepLeaveBuf(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>
                      )}

                      <div>
                        <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>Delay antar TX (ms)</label>
                        <input type="number" placeholder="1500" step="100" min="0" value={aseSweepDelayMs}
                          onChange={e => setAseSweepDelayMs(parseInt(e.target.value) || 0)}
                          style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                      </div>

                      {/* Sumber wallet */}
                      <div style={{ borderTop:'1px solid #161616', paddingTop:'14px' }}>
                        <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                          Wallet Sumber ({aseSweepSources.length})
                        </div>
                        {wallets.some(w => (w.aseAddresses||[]).length > 0) && (
                          <div style={{ marginBottom:'10px' }}>
                            <select onChange={e => { aseSweepAddFromBIP39(e.target.value); e.target.value=''; }} value=""
                              style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                              <option value="">-- Tambah dari wallet tersimpan --</option>
                              {wallets.flatMap((w, wi) =>
                                (w.aseAddresses||[]).map(a => (
                                  <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                                    {w.name} · #{a.index} · {a.address.slice(0,14)}...
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        )}
                        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                          <input type="password" placeholder="Atau tempel private key (64 hex seed) manual..."
                            value={aseSweepManualPK} onChange={e => setAseSweepManualPK(e.target.value)}
                            style={{ flex:1, fontFamily:'monospace', fontSize:'12px' }}/>
                          <button onClick={aseSweepAddManualPK} disabled={!aseSweepManualPK.trim()}
                            style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'11px', opacity:!aseSweepManualPK.trim()?0.4:1 }}>
                            <FaPlus size={10}/>
                          </button>
                        </div>

                        {aseSweepSources.length > 0 && (
                          <>
                            <button onClick={aseSweepFetchBalances} disabled={aseSweepFetchingBal}
                              style={{ background:'none', border:'1px solid #333', color:'#666', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px', marginBottom:'10px' }}>
                              <FaSync size={10} style={{ animation:aseSweepFetchingBal?'spin 1s linear infinite':undefined }}/> Cek Saldo Semua
                            </button>
                            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                              {aseSweepSources.map(src => {
                                const statusColor = { idle:'#333', pending:'#ffaa00', success:'#4caf50', failed:'#f44336', skipped:'#666' }[src.status];
                                return (
                                  <div key={src.id} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#0a0a0a', border:`1px solid ${src.status!=='idle'?statusColor+'44':'#151515'}`, padding:'9px 12px' }}>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontSize:'11px', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{src.label}</div>
                                      {src.balance && <div style={{ fontSize:'10px', color:'#666' }}>{src.balance}</div>}
                                      {src.error && <div style={{ fontSize:'10px', color: src.status==='failed' ? '#f44336' : '#888' }}>{src.error}</div>}
                                      {src.hash && (
                                        <a href={`${ASENTUM_NETWORK.explorerUrl}/tx/${src.hash}`} target="_blank" rel="noreferrer" style={{ fontSize:'10px', color:'#7a7aff', fontFamily:'monospace' }}>
                                          {src.hash.slice(0,18)}…
                                        </a>
                                      )}
                                    </div>
                                    <div style={{ fontSize:'10px', fontWeight:'bold', color:statusColor, fontFamily:'monospace', flexShrink:0 }}>
                                      {src.status === 'idle'    && '—'}
                                      {src.status === 'pending' && '⟳'}
                                      {src.status === 'success' && '✓'}
                                      {src.status === 'failed'  && '✗'}
                                      {src.status === 'skipped' && 'skip'}
                                    </div>
                                    <button onClick={() => aseSweepRemoveSource(src.id)} disabled={aseSweepRunning}
                                      style={{ background:'none', border:'none', color:'#f44336', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      <button onClick={aseSweepRun}
                        disabled={aseSweepRunning || aseSweepSources.length === 0 || !aseIsValidAddr(aseSweepDestAddr)}
                        style={{
                          padding:'13px', fontWeight:'bold', fontSize:'14px', cursor:aseSweepRunning?'wait':'pointer',
                          background: aseSweepRunning ? '#001a00' : (aseSweepSources.length===0||!aseIsValidAddr(aseSweepDestAddr)) ? '#12301f' : '#00e676',
                          color: aseSweepRunning ? '#00e676' : (aseSweepSources.length===0||!aseIsValidAddr(aseSweepDestAddr)) ? '#7dffb3' : '#000',
                          border:`1px solid ${aseSweepRunning?'#00e67644':'#00e676'}`,
                          display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                          opacity: (aseSweepSources.length===0||!aseIsValidAddr(aseSweepDestAddr)) ? 0.85 : 1,
                          transition:'all 0.2s',
                        }}>
                        {aseSweepRunning
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Sweeping {aseSweepSources.filter(x=>x.status==='success').length}/{aseSweepSources.length}...</>
                          : <><FaExchangeAlt/> Mulai Sweep {aseSweepSources.length} Wallet</>}
                      </button>
                    </div>
                  )}

                    </>} />

                  <div style={{ textAlign:'center' }}>
                    <button onClick={aseDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {txChain === 'gram' && (
            <>
              <div style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={gramNetId} onChange={e => switchGramNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {GRAM_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                <a href={`${GRAM_NETWORK.explorerUrl}`} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#0088CC', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              {!gramConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {GRAM_NETWORK.name}
                  </h2>
                  {wallets.some(w => w.gramAddress) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Gram tersimpan</label>
                      <select value={gramWalletSel} onChange={e => handleGramWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.map((w, wi) => w.gramAddress && (
                          <option key={wi} value={String(wi)}>
                            {w.name} · {w.gramAddress.address.slice(0,14)}...
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key (hex, 64-byte nacl secret key)
                  </label>
                  <input
                    type="password"
                    placeholder="hex 128 karakter"
                    value={gramPrivKey}
                    onChange={e => { setGramPrivKey(e.target.value); setGramWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'10px' }}
                  />
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    Versi Wallet Contract
                  </label>
                  <select value={gramConnectVersion} onChange={e => setGramConnectVersion(e.target.value)}
                    style={{ width:'100%', fontFamily:'monospace', fontSize:'12px', marginBottom:'14px' }}>
                    {GRAM_WALLET_VERSIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  
                  <button onClick={gramConnect} disabled={gramConnecting || !gramPrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:gramConnecting?'#2a1a1a':GRAM_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!gramPrivKey.trim()?0.5:1 }}>
                    {gramConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${GRAM_NETWORK.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'22px', fontWeight:'bold', fontFamily:'monospace' }}>
                          {gramLoadingBal ? <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> : gramBalance}
                        </div>
                      </div>
                      <button onClick={() => gramRefreshBalance()} disabled={gramLoadingBal}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <FaSync size={11} style={{ animation:gramLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                      </button>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #1a1a1a' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'8px 10px' }}>
                          {gramAddress}
                        </code>
                        <button onClick={() => copyText(gramAddress, 'gram_recv')} style={{ background:'none', border:'1px solid #333', color:copiedKey==='gram_recv'?'#4caf50':'#888', cursor:'pointer', padding:'8px 10px' }}>
                          {copiedKey==='gram_recv' ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                        </button>
                        <button onClick={() => setQrAddress(gramMemo.trim() ? `ton://transfer/${gramAddress}?text=${encodeURIComponent(gramMemo.trim())}` : gramAddress)}
                          style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'8px 10px' }}>
                          <FaQrcode size={12}/>
                        </button>
                        <a href={`${GRAM_NETWORK.explorerUrl}/address/${gramAddress}`} target="_blank" rel="noreferrer"
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 10px', display:'flex' }} title="Lihat di Explorer">
                          <FaLink size={12}/>
                        </a>
                      </div>
                      {gramMemo.trim() && (
                        <div style={{ fontSize:'10px', color:'#444', marginTop:'8px' }}>
                          Memo aktif: <span style={{ color:'#888', fontFamily:'monospace' }}>"{gramMemo.trim()}"</span> — ikut disertakan ke QR/link di atas. Ubah di field "Memo / Comment" pada form Kirim GRAM.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => setGramSendMode('native')} style={{
                      flex:1, padding:'8px', fontSize:'12px', fontWeight:'bold', cursor:'pointer',
                      background: gramSendMode === 'native' ? GRAM_NETWORK.color : 'none',
                      color: gramSendMode === 'native' ? '#fff' : '#888',
                      border: `1px solid ${gramSendMode === 'native' ? GRAM_NETWORK.color : '#333'}`,
                    }}><FaPaperPlane style={{ marginRight:'6px' }}/>Native (TON)</button>
                    <button onClick={() => setGramSendMode('jetton')} style={{
                      flex:1, padding:'8px', fontSize:'12px', fontWeight:'bold', cursor:'pointer',
                      background: gramSendMode === 'jetton' ? GRAM_NETWORK.color : 'none',
                      color: gramSendMode === 'jetton' ? '#fff' : '#888',
                      border: `1px solid ${gramSendMode === 'jetton' ? GRAM_NETWORK.color : '#333'}`,
                    }}><FaCoins style={{ marginRight:'6px' }}/>Jetton</button>
                    <button onClick={() => setGramSendMode('swap')} style={{
                      flex:1, padding:'8px', fontSize:'12px', fontWeight:'bold', cursor:'pointer',
                      background: gramSendMode === 'swap' ? GRAM_NETWORK.color : 'none',
                      color: gramSendMode === 'swap' ? '#fff' : '#888',
                      border: `1px solid ${gramSendMode === 'swap' ? GRAM_NETWORK.color : '#333'}`,
                    }}><FaExchangeAlt style={{ marginRight:'6px' }}/>Swap</button>
                  </div>

                  {gramSendMode === 'native' && (
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim GRAM</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="UQ... / EQ..." value={gramSendTo} onChange={e => setGramSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Jumlah (GRAM)</label>
                        <button onClick={gramSetMaxAmount} disabled={gramMaxLoading || !gramConnected}
                          style={{ background:'none', border:'1px solid #333', color:gramMaxLoading?'#555':GRAM_NETWORK.color, padding:'2px 8px', cursor:(gramMaxLoading||!gramConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!gramConnected?0.4:1 }}>
                          {gramMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.0" value={gramSendAmt} onChange={e => setGramSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>

                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Memo / Comment (opsional)</label>
                      <input placeholder="mis. memo transfer / ID exchange tujuan" value={gramMemo} onChange={e => setGramMemo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'4px' }}/>
                      <div style={{ fontSize:'10px', color:'#444', marginBottom:'16px' }}>
                        Field ini dipakai bareng buat QR/link di kartu "Terima" di atas — kalau diisi, ikut ke-embed di sana juga.
                      </div>

                      {gramFeeEstimateError && (
                        <div style={{ background:'#1a1608', border:'1px solid #4a3f10', padding:'10px 12px', marginBottom:'16px', display:'flex', gap:'6px', alignItems:'flex-start', color:'#ffaa00', fontSize:'11px' }}>
                          <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                          <span>{gramFeeEstimateError}</span>
                        </div>
                      )}

                      {gramFeeEstimate ? (
                        <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px', marginBottom:'16px', fontSize:'11px', color:'#666', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                          <FaInfoCircle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                          <span>
                            Estimasi fee: <span style={{ fontFamily:'monospace', color:'#888' }}>~{gramFeeEstimate.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} GRAM</span>{' '}
                            {renderGasFiatBadge(gramFeeEstimate.totalFeeGram)}
                            {gramFeeEstimate.willDeploy && ' (termasuk deploy wallet — tx pertama dari address ini)'}
                            {gramFeeEstimating && <span style={{ marginLeft:'6px', animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                          </span>
                        </div>
                      ) : (
                        <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px', marginBottom:'16px', fontSize:'11px', color:'#666', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                          <FaInfoCircle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                          <span>
                            {gramFeeEstimating
                              ? <>Menghitung estimasi fee <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span></>
                              : 'Isi address tujuan & jumlah buat lihat estimasi fee jaringan TON sebelum kirim.'}
                          </span>
                        </div>
                      )}

                      <button onClick={gramSend} disabled={gramSending || !gramSendTo.trim() || !gramSendAmt}
                        style={{ width:'100%', padding:'12px', background:gramSending?'#2a1a1a':GRAM_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!gramSendTo.trim()||!gramSendAmt)?0.5:1 }}>
                        {gramSending
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                          : <><FaPaperPlane/> Kirim GRAM</>}
                      </button>
                      {gramStatus.type !== 'idle' && (
                        <div style={{
                          marginTop:'14px', padding:'12px', fontSize:'12px',
                          background: gramStatus.type==='error' ? '#2a0d0d' : gramStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                          border: `1px solid ${gramStatus.type==='error' ? '#5a1e1e' : gramStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                          color: gramStatus.type==='error' ? '#ff8888' : gramStatus.type==='success' ? '#88ff88' : '#ffff88',
                        }}>
                          {gramStatus.msg}
                          {gramStatus.hash && (
                            <a href={`${GRAM_NETWORK.explorerUrl}/tx/${gramStatus.hash}`} target="_blank" rel="noreferrer"
                              style={{ display:'block', marginTop:'6px', color:'#0088CC', wordBreak:'break-all' }}>
                              <FaLink size={9}/> {gramStatus.hash}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {gramSendMode === 'jetton' && (
                    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                        <h3 style={{ fontSize:'13px', margin:0 }}><FaCoins style={{ marginRight:'6px' }}/>Kirim Jetton</h3>
                      </div>

                      {/* ── Token picker ala Bitget Wallet: tap buat buka bottom-sheet
                          berisi search + daftar Jetton yang dipegang, bukan dropdown <select>. ── */}
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Token</label>
                      <button onClick={() => { setGramJettonPickerOpen(true); if (gramJettonDetected.length === 0) gramLoadDetectedJettons(); }}
                        style={{
                          width:'100%', display:'flex', alignItems:'center', gap:'10px', background:'#070707',
                          border:'1px solid #262626', borderRadius:'10px', padding:'10px 12px', cursor:'pointer',
                          marginBottom:'12px', textAlign:'left', boxSizing:'border-box',
                        }}>
                        {gramJettonMeta?.image
                          ? <img src={gramJettonMeta.image} alt="" width={28} height={28} style={{ borderRadius:'50%', flexShrink:0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}/>
                          : <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a1a1a', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <FaCoins size={12} color="#0088CC"/>
                            </div>}
                        <div style={{ flex:1, minWidth:0 }}>
                          {gramJettonMeta ? (
                            <>
                              <div style={{ fontSize:'13px', fontWeight:'bold', color:'#eee' }}>{gramJettonMeta.symbol}</div>
                              <div style={{ fontSize:'11px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{gramJettonMeta.name}</div>
                            </>
                          ) : (
                            <div style={{ fontSize:'13px', color:'#666' }}>
                              {gramJettonDetectedLoading ? 'Memuat token...' : 'Pilih Token Jetton...'}
                            </div>
                          )}
                        </div>
                        {gramJettonDetectedLoading
                          ? <FaSpinner size={12} color="#555" style={{ animation:'spin 1s linear infinite', flexShrink:0 }}/>
                          : <FaChevronDown size={12} color="#555" style={{ flexShrink:0 }}/>}
                      </button>

                      <details style={{ marginBottom:'8px' }}>
                        <summary style={{ fontSize:'10px', color:'#555', cursor:'pointer', userSelect:'none' }}>
                          Atau tempel address kontrak Jetton manual
                        </summary>
                        <label style={{ fontSize:'11px', color:'#555', display:'block', margin:'10px 0 4px' }}>Address Kontrak Jetton</label>
                        <input placeholder="EQ... / UQ... (jetton master)" value={gramJettonMaster}
                          onChange={e => setGramJettonMaster(e.target.value)}
                          style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'8px' }}/>
                      </details>

                      {gramJettonMetaLoading && (
                        <div style={{ fontSize:'11px', color:'#666', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                          <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Mengambil metadata Jetton...
                        </div>
                      )}
                      {gramJettonMetaError && (
                        <div style={{ background:'#2a0d0d', border:'1px solid #5a1e1e', color:'#ff8888', padding:'8px 10px', marginBottom:'12px', fontSize:'11px' }}>
                          {gramJettonMetaError}
                        </div>
                      )}
                      {gramJettonMeta && !gramJettonMetaLoading && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#070707', border:'1px solid #1e1e1e', padding:'8px 10px', marginBottom:'12px' }}>
                          {gramJettonMeta.image
                            ? <img src={gramJettonMeta.image} alt="" width={20} height={20} style={{ borderRadius:'50%', flexShrink:0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}/>
                            : <FaCoins size={14} color="#0088CC"/>}
                          <span style={{ fontSize:'12px' }}>{gramJettonMeta.name} <span style={{ color:'#555' }}>({gramJettonMeta.symbol}) · {gramJettonMeta.decimals} dec</span></span>
                        </div>
                      )}

                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="UQ... / EQ..." value={gramJettonTo} onChange={e => setGramJettonTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>

                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                        Jumlah {gramJettonMeta ? `(${gramJettonMeta.symbol})` : ''}
                      </label>
                      <input type="number" placeholder="0.0" value={gramJettonAmt} onChange={e => setGramJettonAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>

                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Komentar (opsional)</label>
                      <input placeholder="mis. memo transfer" value={gramJettonComment} onChange={e => setGramJettonComment(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontSize:'13px', marginBottom:'16px' }}/>

                      {gramJettonFeeEstimateError && (
                        <div style={{ background:'#1a1608', border:'1px solid #4a3f10', padding:'10px 12px', marginBottom:'16px', display:'flex', gap:'6px', alignItems:'flex-start', color:'#ffaa00', fontSize:'11px' }}>
                          <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                          <span>{gramJettonFeeEstimateError}</span>
                        </div>
                      )}
                      {gramJettonFeeEstimate ? (
                        <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px', marginBottom:'16px', fontSize:'11px', color:'#666', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                          <FaInfoCircle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                          <span>
                            Estimasi fee: <span style={{ fontFamily:'monospace', color:'#888' }}>~{gramJettonFeeEstimate.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} GRAM</span>{' '}
                            {renderGasFiatBadge(gramJettonFeeEstimate.totalFeeGram)}
                            {gramJettonFeeEstimate.willDeploy && ' (termasuk deploy wallet — tx pertama dari address ini)'}
                            {gramJettonFeeEstimating && <span style={{ marginLeft:'6px', animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>}
                          </span>
                        </div>
                      ) : (
                        <div style={{ background:'#070707', border:'1px solid #1e1e1e', padding:'10px 12px', marginBottom:'16px', fontSize:'11px', color:'#666', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                          <FaInfoCircle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                          <span>
                            {gramJettonFeeEstimating
                              ? <>Menghitung estimasi fee <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span></>
                              : 'Isi address kontrak, tujuan & jumlah buat lihat estimasi fee sebelum kirim.'}
                          </span>
                        </div>
                      )}

                      <button onClick={gramSendJetton} disabled={gramJettonSending || !gramJettonMaster.trim() || !gramJettonTo.trim() || !gramJettonAmt || !gramJettonMeta}
                        style={{ width:'100%', padding:'12px', background:gramJettonSending?'#2a1a1a':GRAM_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!gramJettonMaster.trim()||!gramJettonTo.trim()||!gramJettonAmt||!gramJettonMeta)?0.5:1 }}>
                        {gramJettonSending
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                          : <><FaCoins/> Kirim Jetton</>}
                      </button>
                      {gramJettonStatus.type !== 'idle' && (
                        <div style={{
                          marginTop:'14px', padding:'12px', fontSize:'12px',
                          background: gramJettonStatus.type==='error' ? '#2a0d0d' : gramJettonStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                          border: `1px solid ${gramJettonStatus.type==='error' ? '#5a1e1e' : gramJettonStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                          color: gramJettonStatus.type==='error' ? '#ff8888' : gramJettonStatus.type==='success' ? '#88ff88' : '#ffff88',
                        }}>
                          {gramJettonStatus.msg}
                          {gramJettonStatus.hash && (
                            <a href={`${GRAM_NETWORK.explorerUrl}/tx/${gramJettonStatus.hash}`} target="_blank" rel="noreferrer"
                              style={{ display:'block', marginTop:'6px', color:'#0088CC', wordBreak:'break-all' }}>
                              <FaLink size={9}/> {gramJettonStatus.hash}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {gramSendMode === 'swap' && (
                    <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                        <h3 style={{ fontSize:'13px', margin:0 }}><FaExchangeAlt style={{ marginRight:'6px' }}/>Swap Token (STON.fi)</h3>
                        {gramNetId === 'mainnet' && (
                          <span style={{ fontSize:'10px', color:'#444', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaSlidersH size={9}/> Slippage {gramSwapSlippage || '0'}%
                          </span>
                        )}
                      </div>

                      {gramNetId !== 'mainnet' ? (
                        <div style={{ background:'#1a1608', border:'1px solid #4a3f10', color:'#ffaa00', padding:'12px', fontSize:'12px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                          <FaExclamationTriangle size={13} style={{ marginTop:'1px', flexShrink:0 }}/>
                          <span>Swap DEX (STON.fi) cuma tersedia di <b>Gram Mainnet</b> — liquidity di Testnet nyaris gak ada. Ganti network di atas dulu.</span>
                        </div>
                      ) : (
                        <>
                          {/* ── Kartu "Dari" + "Ke" digabung, tombol flip numpuk di batas tengah ── */}
                          <div style={{ position:'relative' }}>
                            {/* ── Token asal ── */}
                            <div style={{ background:'#070707', border:'1px solid #262626', borderRadius:'14px 14px 4px 4px', padding:'12px 14px 16px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                                <span style={{ fontSize:'11px', color:'#555' }}>Dari</span>
                                {gramSwapFromBalanceLabel && (
                                  <span style={{ fontSize:'10px', color:'#555', display:'flex', alignItems:'center', gap:'4px' }}>
                                    <FaWallet size={9}/> {gramSwapFromBalanceLabel}
                                    <button onClick={gramSwapSetMaxAmount} disabled={gramSwapMaxLoading}
                                      style={{ background:'none', border:`1px solid ${GRAM_NETWORK.color}40`, color:GRAM_NETWORK.color, fontSize:'9px', fontWeight:'bold', padding:'2px 6px', cursor:'pointer', borderRadius:'4px', marginLeft:'2px' }}>
                                      {gramSwapMaxLoading ? '...' : 'MAKS'}
                                    </button>
                                  </span>
                                )}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                <button onClick={() => { setGramSwapPickerOpen('from'); if (gramSwapAssets.length === 0) gramLoadSwapAssets(); }}
                                  style={{
                                    display:'flex', alignItems:'center', gap:'8px', background:'#131313',
                                    border:'1px solid #292929', borderRadius:'999px', padding:'6px 12px 6px 6px', cursor:'pointer',
                                    flexShrink:0, maxWidth:'42%',
                                  }}>
                                  {gramSwapFrom?.image
                                    ? <img src={gramSwapFrom.image} alt="" width={24} height={24} style={{ borderRadius:'50%', flexShrink:0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}/>
                                    : <div style={{ width:24, height:24, borderRadius:'50%', background:'#1a1a1a', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                        <FaCoins size={10} color="#0088CC"/>
                                      </div>}
                                  {gramSwapFrom ? (
                                    <span style={{ fontSize:'13px', fontWeight:'bold', color:'#eee', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{gramSwapFrom.symbol}</span>
                                  ) : (
                                    <span style={{ fontSize:'12px', color:'#666' }}>{gramSwapAssetsLoading ? 'Memuat...' : 'Pilih token'}</span>
                                  )}
                                  <FaChevronDown size={10} color="#555" style={{ flexShrink:0 }}/>
                                </button>
                                <input type="number" placeholder="0.0" value={gramSwapAmt} onChange={e => setGramSwapAmt(e.target.value)}
                                  style={{ flex:1, minWidth:0, textAlign:'right', background:'none', border:'none', outline:'none', fontFamily:'monospace', fontSize:'20px', fontWeight:'bold', color:'#eee', padding:0 }}/>
                              </div>
                            </div>

                            {/* ── Tombol tukar arah — numpuk di batas antara dua kartu ── */}
                            <div style={{ textAlign:'center', height:0, position:'relative', zIndex:2 }}>
                              <button onClick={handleGramSwapFlip} title="Tukar arah"
                                style={{
                                  background:'#161616', border:'2px solid #0d0d0d', borderRadius:'50%', width:'32px', height:'32px',
                                  color:GRAM_NETWORK.color, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
                                  transform: `translateY(-16px) rotate(${gramSwapFlipSpin ? 180 : 0}deg)`, transition:'transform 0.3s ease',
                                }}>
                                <FaExchangeAlt size={13} style={{ transform:'rotate(90deg)' }}/>
                              </button>
                            </div>

                            {/* ── Token tujuan ── */}
                            <div style={{ background:'#070707', border:'1px solid #262626', borderTop:'1px solid #1a1a1a', borderRadius:'4px 4px 14px 14px', padding:'16px 14px 12px', marginTop:'-4px' }}>
                              <div style={{ fontSize:'11px', color:'#555', marginBottom:'8px' }}>Ke</div>
                              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                <button onClick={() => { setGramSwapPickerOpen('to'); if (gramSwapAssets.length === 0) gramLoadSwapAssets(); }}
                                  style={{
                                    display:'flex', alignItems:'center', gap:'8px', background:'#131313',
                                    border:'1px solid #292929', borderRadius:'999px', padding:'6px 12px 6px 6px', cursor:'pointer',
                                    flexShrink:0, maxWidth:'42%',
                                  }}>
                                  {gramSwapTo?.image
                                    ? <img src={gramSwapTo.image} alt="" width={24} height={24} style={{ borderRadius:'50%', flexShrink:0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}/>
                                    : <div style={{ width:24, height:24, borderRadius:'50%', background:'#1a1a1a', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                        <FaCoins size={10} color="#0088CC"/>
                                      </div>}
                                  {gramSwapTo ? (
                                    <span style={{ fontSize:'13px', fontWeight:'bold', color:'#eee', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{gramSwapTo.symbol}</span>
                                  ) : (
                                    <span style={{ fontSize:'12px', color:'#666' }}>{gramSwapAssetsLoading ? 'Memuat...' : 'Pilih token'}</span>
                                  )}
                                  <FaChevronDown size={10} color="#555" style={{ flexShrink:0 }}/>
                                </button>
                                <div style={{ flex:1, minWidth:0, textAlign:'right', fontFamily:'monospace', fontSize:'20px', fontWeight:'bold', color: gramSwapQuote && gramSwapTo ? '#eee' : '#3a3a3a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {gramSwapQuote && gramSwapTo
                                    ? formatGramSwapOutput(gramSwapQuote, gramSwapTo).askAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })
                                    : (gramSwapQuoting ? <FaSpinner size={16} style={{ animation:'spin 1s linear infinite' }}/> : '0.0')}
                                </div>
                              </div>
                            </div>
                          </div>

                          {gramSwapAssetsError && (
                            <div style={{ background:'#2a0d0d', border:'1px solid #5a1e1e', color:'#ff8888', padding:'8px 10px', margin:'12px 0 0', fontSize:'11px' }}>
                              {gramSwapAssetsError}
                            </div>
                          )}

                          {/* ── Slippage Tolerance ── */}
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'14px' }}>
                            <span style={{ fontSize:'11px', color:'#555', flexShrink:0, display:'flex', alignItems:'center', gap:'5px' }}><FaSlidersH size={10}/> Slippage</span>
                            <div style={{ display:'flex', gap:'6px', flex:1 }}>
                              {['0.5','1','3'].map(p => (
                                <button key={p} onClick={() => setGramSwapSlippage(p)} style={{
                                  padding:'6px 12px', fontSize:'11px', fontWeight:'bold', cursor:'pointer', borderRadius:'6px',
                                  background: gramSwapSlippage === p ? GRAM_NETWORK.color : 'none',
                                  color: gramSwapSlippage === p ? '#fff' : '#888',
                                  border: `1px solid ${gramSwapSlippage === p ? GRAM_NETWORK.color : '#333'}`,
                                }}>{p}%</button>
                              ))}
                              <input type="number" placeholder="Custom" value={gramSwapSlippage} onChange={e => setGramSwapSlippage(e.target.value)}
                                style={{ width:'70px', flexShrink:0, boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', borderRadius:'6px' }}/>
                            </div>
                          </div>

                          {/* ── Ringkasan quote ── */}
                          {gramSwapQuoteError && (
                            <div style={{ background:'#2a0d0d', border:'1px solid #5a1e1e', color:'#ff8888', padding:'8px 10px', marginTop:'12px', fontSize:'11px' }}>
                              {gramSwapQuoteError}
                            </div>
                          )}
                          {gramSwapQuote && gramSwapTo && gramSwapFrom && (
                            (() => {
                              const out = formatGramSwapOutput(gramSwapQuote, gramSwapTo);
                              const highImpact = (gramSwapQuote.priceImpactPct ?? 0) > 5;
                              return (
                                <div style={{ background:'#070707', border:'1px solid #1e1e1e', borderRadius:'10px', padding:'12px 14px', marginTop:'12px', fontSize:'12px', color:'#ccc' }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px', paddingBottom:'8px', borderBottom:'1px solid #1a1a1a' }}>
                                    <span style={{ color:'#666', display:'flex', alignItems:'center', gap:'5px' }}><FaExchangeAlt size={9}/> Rate</span>
                                    <span style={{ fontFamily:'monospace' }}>
                                      1 {gramSwapFrom.symbol} <FaArrowRight size={8} style={{ margin:'0 4px', color:'#444' }}/> {gramSwapQuote.rate.toLocaleString('en-US', { maximumFractionDigits: 6 })} {gramSwapTo.symbol}
                                    </span>
                                  </div>
                                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                                    <span style={{ color:'#666' }}>Minimum diterima</span>
                                    <span style={{ fontFamily:'monospace' }}>~{out.minAskAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {gramSwapTo.symbol}</span>
                                  </div>
                                  {gramSwapQuote.priceImpactPct !== undefined && (
                                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                                      <span style={{ color:'#666' }}>Price impact</span>
                                      <span style={{ fontFamily:'monospace', color: highImpact ? '#ff8888' : '#888', display:'flex', alignItems:'center', gap:'4px' }}>
                                        {highImpact && <FaExclamationTriangle size={9}/>} {gramSwapQuote.priceImpactPct.toFixed(2)}%
                                      </span>
                                    </div>
                                  )}
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                                    <span style={{ color:'#666', display:'flex', alignItems:'center', gap:'5px' }}><FaGasPump size={9}/> Fee network</span>
                                    <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                      <span style={{ fontFamily:'monospace' }}>
                                        {gramSwapFeeEstimateError
                                          ? <span style={{ color:'#ffaa00' }}>gagal dihitung</span>
                                          : gramSwapFeeEstimate
                                            ? `~${gramSwapFeeEstimate.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} GRAM`
                                            : (gramSwapFeeEstimating ? 'menghitung...' : '—')}
                                      </span>
                                      {gramSwapFeeEstimate && renderGasFiatBadge(gramSwapFeeEstimate.totalFeeGram)}
                                    </span>
                                  </div>
                                  {highImpact && (
                                    <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid #1a1a1a', fontSize:'10px', color:'#ff8888', display:'flex', gap:'6px', alignItems:'flex-start' }}>
                                      <FaExclamationTriangle size={10} style={{ marginTop:'1px', flexShrink:0 }}/>
                                      <span>Price impact tinggi — liquidity pair ini tipis, pertimbangkan swap jumlah lebih kecil.</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}

                          {/* ── Peringatan saldo token "Dari" tidak cukup ──
                              Cek langsung terhadap saldo real (TON native atau Jetton) yang
                              beneran dipegang wallet — lihat gramSwapInsufficientBalance di
                              WalletGenerator. Muncul begitu jumlah yang diketik user melebihi
                              saldo, sebelum tombol Swap sempat diklik. */}
                          {gramSwapInsufficientBalance && gramSwapFrom && (
                            <div style={{ background:'#2a0d0d', border:'1px solid #5a1e1e', color:'#ff8888', padding:'10px 12px', marginTop:'10px', fontSize:'11px', borderRadius:'8px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                              <FaExclamationTriangle size={11} style={{ marginTop:'2px', flexShrink:0 }}/>
                              <span>
                                Saldo {gramSwapFrom.symbol} tidak cukup. Kamu mau swap {gramSwapAmt} {gramSwapFrom.symbol},
                                tapi saldo yang dipegang cuma ~{(gramSwapAvailableBalance ?? 0).toLocaleString('en-US',{maximumFractionDigits:6})} {gramSwapFrom.symbol}.
                              </span>
                            </div>
                          )}

                          {/* ── Peringatan saldo gas TON minimum sebelum swap ──
                              Umum di jaringan Gram/TON: swap Jetton tetap butuh TON native
                              buat gas tiap hop pesan internal — kalau kurang, tx bisa nyangkut
                              di tengah jalan alih-alih gagal bersih. Lihat checkGramSwapGasSufficiency. */}
                          {gramSwapGasCheck && !gramSwapGasCheck.hasEnoughGas && (
                            <div style={{ background:'#2a0d0d', border:'1px solid #5a1e1e', color:'#ff8888', padding:'10px 12px', marginTop:'10px', fontSize:'11px', borderRadius:'8px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                              <FaGasPump size={11} style={{ marginTop:'2px', flexShrink:0 }}/>
                              <span>
                                Saldo GRAM tidak cukup untuk gas swap. Butuh minimal ~{gramSwapGasCheck.requiredGram.toLocaleString('en-US',{maximumFractionDigits:6})} GRAM
                                {gramSwapGasCheck.willDeploy ? ' (termasuk deploy wallet)' : ''}, saldo saat ini ~{gramSwapGasCheck.balanceGram.toLocaleString('en-US',{maximumFractionDigits:6})} GRAM
                                (kurang ~{gramSwapGasCheck.shortfallGram.toLocaleString('en-US',{maximumFractionDigits:6})} GRAM). Swap Jetton tetap butuh GRAM native buat gas.
                              </span>
                            </div>
                          )}

                          <button onClick={gramExecuteSwap}
                            disabled={gramSwapSending || !gramSwapFrom || !gramSwapTo || !gramSwapAmt || !gramSwapQuote || gramSwapInsufficientBalance || (gramSwapGasCheck ? !gramSwapGasCheck.hasEnoughGas : false)}
                            style={{ width:'100%', padding:'13px', marginTop:'14px', borderRadius:'10px', background:gramSwapSending?'#2a1a1a':GRAM_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!gramSwapFrom||!gramSwapTo||!gramSwapAmt||!gramSwapQuote||gramSwapInsufficientBalance||(gramSwapGasCheck&&!gramSwapGasCheck.hasEnoughGas))?0.5:1, transition:'opacity 0.15s ease' }}>
                            {gramSwapSending
                              ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Swapping...</>
                              : gramSwapInsufficientBalance
                                ? <>Saldo {gramSwapFrom?.symbol || ''} Tidak Cukup</>
                                : <><FaExchangeAlt/> {gramSwapButtonLabel}</>}
                          </button>
                          {gramSwapStatus.type !== 'idle' && (
                            <div style={{
                              marginTop:'14px', padding:'12px', fontSize:'12px', borderRadius:'8px',
                              background: gramSwapStatus.type==='error' ? '#2a0d0d' : gramSwapStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                              border: `1px solid ${gramSwapStatus.type==='error' ? '#5a1e1e' : gramSwapStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                              color: gramSwapStatus.type==='error' ? '#ff8888' : gramSwapStatus.type==='success' ? '#88ff88' : '#ffff88',
                              display:'flex', alignItems:'flex-start', gap:'8px',
                            }}>
                              {gramSwapStatus.type==='success'
                                ? <FaCheckCircle size={13} style={{ marginTop:'1px', flexShrink:0 }}/>
                                : gramSwapStatus.type==='error'
                                  ? <FaExclamationTriangle size={13} style={{ marginTop:'1px', flexShrink:0 }}/>
                                  : <FaSpinner size={13} style={{ marginTop:'1px', flexShrink:0, animation:'spin 1s linear infinite' }}/>}
                              <div>
                                {gramSwapStatus.msg}
                                {gramSwapStatus.hash && (
                                  <a href={`${GRAM_NETWORK.explorerUrl}/tx/${gramSwapStatus.hash}`} target="_blank" rel="noreferrer"
                                    style={{ display:'block', marginTop:'6px', color:'#0088CC', wordBreak:'break-all' }}>
                                    <FaLink size={9}/> {gramSwapStatus.hash}
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                          <div style={{ marginTop:'12px', fontSize:'10px', color:'#444', textAlign:'center' }}>
                            Powered by STON.fi DEX
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ textAlign:'center' }}>
                    <button onClick={gramDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {txChain === 'atom' && (
            <>
              <div style={{ marginBottom:'16px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <select value={atomNetId} onChange={e => switchAtomNetwork(e.target.value)}
                  style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                  {COSMOS_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                <a href={`${COSMOS_NETWORK.explorerUrl}`} target="_blank" rel="noreferrer"
                  style={{ fontSize:'11px', color:'#2E3148', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                  <FaLink size={9}/> Explorer
                </a>
              </div>

              {COSMOS_NETWORK.rpcUrls.length === 0 && (
                <div style={{ background:'#1a1608', border:'1px solid #4a3f10', color:'#F1C40F', padding:'12px 14px', marginBottom:'16px', fontSize:'11px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                  <FaExclamationTriangle size={12} style={{ marginTop:'1px', flexShrink:0 }}/>
                  <span>Belum ada RPC/REST Cosmos Hub yang dikonfigurasi — isi <code>COSMOS_NETWORKS[].rpcUrls</code> / <code>restUrls</code> di <code>Cosmosnet.ts</code> dengan endpoint node yang kamu punya akses (kirim & cek saldo butuh ini).</span>
                </div>
              )}

              {!atomConnected ? (
                <div className="form-container" style={{ maxWidth:'420px', margin:'32px auto' }}>
                  <h2 style={{ textAlign:'center', marginBottom:'18px', fontSize:'15px' }}>
                    <FaPlug style={{ marginRight:'8px' }}/>Connect ke {COSMOS_NETWORK.name}
                  </h2>
                  {wallets.some(w => (w.atomAddresses||[]).length > 0) && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Cosmos tersimpan</label>
                      <select value={atomWalletSel} onChange={e => handleAtomWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                        <option value="">-- Pilih address --</option>
                        {wallets.flatMap((w, wi) =>
                          (w.atomAddresses||[]).map(a => (
                            <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                              {w.name} · #{a.index} · {a.address.slice(0,14)}...
                            </option>
                          ))
                        )}
                      </select>

                    </div>
                  )}
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaKey style={{ marginRight:'4px' }}/>Private Key (hex)
                  </label>
                  <input
                    type="password"
                    placeholder="0x... atau hex tanpa prefix"
                    value={atomPrivKey}
                    onChange={e => { setAtomPrivKey(e.target.value); setAtomWalletSel(''); }}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}
                  />
                  <button onClick={atomConnect} disabled={atomConnecting || !atomPrivKey.trim()}
                    style={{ width:'100%', padding:'12px', background:atomConnecting?'#2a1a1a':COSMOS_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:!atomPrivKey.trim()?0.5:1 }}>
                    {atomConnecting
                      ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Connecting...</>
                      : <><FaPlug/> Connect</>}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

                  {/* ── Balance / Receive card ── */}
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:`2px solid ${COSMOS_NETWORK.color}`, padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Saldo</div>
                        <div style={{ fontSize:'22px', fontWeight:'bold', fontFamily:'monospace' }}>
                          {atomLoadingBal ? <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> : atomBalance}
                        </div>
                      </div>
                      <button onClick={() => atomRefreshBalance()} disabled={atomLoadingBal}
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <FaSync size={11} style={{ animation:atomLoadingBal?'spin 1s linear infinite':undefined }}/> Refresh
                      </button>
                    </div>
                    <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #1a1a1a' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'8px 10px' }}>
                          {atomAddress}
                        </code>
                        <button onClick={() => copyText(atomAddress, 'atom_recv')} style={{ background:'none', border:'1px solid #333', color:copiedKey==='atom_recv'?'#4caf50':'#888', cursor:'pointer', padding:'8px 10px' }}>
                          {copiedKey==='atom_recv' ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                        </button>
                        <button onClick={() => setQrAddress(atomAddress)} style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'8px 10px' }}>
                          <FaQrcode size={12}/>
                        </button>
                        <a href={`${COSMOS_NETWORK.explorerUrl}/account/${atomAddress}`} target="_blank" rel="noreferrer"
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'8px 10px', display:'flex' }} title="Lihat di Explorer">
                          <FaLink size={12}/>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim ATOM</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="cosmos1..." value={atomSendTo} onChange={e => setAtomSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Jumlah (ATOM)</label>
                        <button onClick={atomSetMaxAmount} disabled={atomMaxLoading || !atomConnected}
                          style={{ background:'none', border:'1px solid #333', color:atomMaxLoading?'#555':COSMOS_NETWORK.color, padding:'2px 8px', cursor:(atomMaxLoading||!atomConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!atomConnected?0.4:1 }}>
                          {atomMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.0" value={atomSendAmt} onChange={e => setAtomSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'16px' }}/>

                      {renderAtomGasFeeBox()}

                      {atomFeeEstimateError && (
                        <div style={{ background:'#1a1608', border:'1px solid #4a3f10', padding:'10px 12px', marginBottom:'16px', display:'flex', gap:'6px', alignItems:'flex-start', color:'#ffaa00', fontSize:'11px' }}>
                          <FaExclamationTriangle size={11} style={{ marginTop:'1px', flexShrink:0 }}/>
                          <span>{atomFeeEstimateError}</span>
                        </div>
                      )}

                      {atomFeeEstimate && (
                        <div style={{ fontSize:'10px', color:'#555', marginTop:'-10px', marginBottom:'16px' }}>
                          Estimasi gas: <span style={{ fontFamily:'monospace', color:'#888' }}>{atomFeeEstimate.gasUnits.toLocaleString('en-US')}</span> unit (dari simulate() dry-run)
                        </div>
                      )}

                      <button onClick={atomSend} disabled={atomSending || !atomSendTo.trim() || !atomSendAmt || COSMOS_NETWORK.rpcUrls.length===0}
                        style={{ width:'100%', padding:'12px', background:atomSending?'#2a1a1a':COSMOS_NETWORK.color, color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!atomSendTo.trim()||!atomSendAmt||COSMOS_NETWORK.rpcUrls.length===0)?0.5:1 }}>
                        {atomSending
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
                          : <><FaPaperPlane/> Kirim ATOM</>}
                      </button>
                      {atomStatus.type !== 'idle' && (
                        <div style={{
                          marginTop:'14px', padding:'12px', fontSize:'12px',
                          background: atomStatus.type==='error' ? '#2a0d0d' : atomStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                          border: `1px solid ${atomStatus.type==='error' ? '#5a1e1e' : atomStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                          color: atomStatus.type==='error' ? '#ff8888' : atomStatus.type==='success' ? '#88ff88' : '#ffff88',
                        }}>
                          {atomStatus.msg}
                          {atomStatus.hash && (
                            <a href={`${COSMOS_NETWORK.explorerUrl}/tx/${atomStatus.hash}`} target="_blank" rel="noreferrer"
                              style={{ display:'block', marginTop:'6px', color:'#2E3148', wordBreak:'break-all' }}>
                              <FaLink size={9}/> {atomStatus.hash}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                  <div style={{ textAlign:'center' }}>
                    <button onClick={atomDisconnect}
                      style={{ background:'none', border:'1px solid #f4433630', color:'#f44336', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {CHAIN_OPTIONS.find(o => o.id === txChain)?.soon && (
            <div style={{ textAlign:'center', padding:'40px', color:'#333', border:'1px dashed #222' }}>
              Network ini akan segera hadir.
            </div>
          )}
        </div>
  );
}
