import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { type PortfolioToken } from '../types';
import { CustomAlert, CustomConfirm } from '../components/CustomModals';
import {
  FaCoins, FaPlus, FaTrash, FaEdit, FaSearch,
  FaSave, FaUndo, FaThumbtack, FaSync, FaWifi,
  FaExchangeAlt, FaTimes, FaArrowRight,
} from 'react-icons/fa';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<PortfolioToken['status'], string> = {
  holding: '#4caf50', sold: '#888', vesting: '#f3ba2f',
};
const STATUS_LABELS: Record<PortfolioToken['status'], string> = {
  holding: 'Holding', sold: 'Sold', vesting: 'Vesting',
};
const emptyForm: Omit<PortfolioToken, 'id'> = {
  projectName: '', tokenSymbol: '', jumlahToken: 0, hargaPerToken: 0,
  network: '', tanggalDiterima: new Date().toISOString().split('T')[0],
  status: 'holding', catatan: '',
};

// ─── Ref ID & Timestamp helpers ──────────────────────────────────────────────
function generateRefId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INPO-${date}-${rand}`;
}

function generateTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── CoinGecko helpers ────────────────────────────────────────────────────────
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana',
  MATIC: 'matic-network', POL: 'matic-network', ARB: 'arbitrum',
  OP: 'optimism', AVAX: 'avalanche-2', LINK: 'chainlink',
  UNI: 'uniswap', AAVE: 'aave', CRV: 'curve-dao-token',
  DOT: 'polkadot', ADA: 'cardano', XRP: 'ripple', DOGE: 'dogecoin',
  PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk', JUP: 'jupiter-exchange-solana',
  SUI: 'sui', APT: 'aptos', SEI: 'sei-network', TIA: 'celestia',
  PYTH: 'pyth-network', JTO: 'jito-governance-token', W: 'wormhole',
  ENA: 'ethena', MON: 'monad-testnet', USDT: 'tether', USDC: 'usd-coin', DAI: 'dai',
};

interface LivePrice { usd: number; usd_24h_change: number; }
type LivePriceMap = Record<string, LivePrice | null>;

async function fetchLivePrices(symbols: string[]): Promise<LivePriceMap> {
  const result: LivePriceMap = {};
  const idMap: Record<string, string> = {};
  const unknownSymbols: string[] = [];
  for (const sym of symbols) {
    const id = SYMBOL_TO_ID[sym.toUpperCase()];
    if (id) { idMap[id] = sym; } else { unknownSymbols.push(sym); }
  }
  for (const sym of unknownSymbols) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`);
      const data = await res.json();
      const match = data?.coins?.find((c: { symbol: string; id: string }) => c.symbol.toLowerCase() === sym.toLowerCase());
      if (match) { idMap[match.id] = sym; } else { result[sym] = null; }
    } catch { result[sym] = null; }
  }
  const ids = Object.keys(idMap);
  if (ids.length === 0) return result;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
    );
    const data = await res.json();
    for (const [coinId, sym] of Object.entries(idMap)) {
      result[sym] = data[coinId]
        ? { usd: data[coinId].usd, usd_24h_change: data[coinId].usd_24h_change ?? 0 }
        : null;
    }
  } catch { for (const sym of Object.values(idMap)) { result[sym] = null; } }
  return result;
}

// ─── CoinGecko search suggestion type ────────────────────────────────────────
interface CoinSuggestion {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number | null;
}

async function searchCoins(query: string): Promise<CoinSuggestion[]> {
  if (!query || query.length < 1) return [];
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    return (data?.coins ?? []).slice(0, 8) as CoinSuggestion[];
  } catch { return []; }
}

// ─── CoinSearchInput component ────────────────────────────────────────────────
interface CoinSearchInputProps {
  value: string;
  onChange: (symbol: string) => void;
  onSelect: (coin: CoinSuggestion) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}

const CoinSearchInput: React.FC<CoinSearchInputProps> = ({
  value, onChange, onSelect, placeholder = 'Simbol token (ETH, SOL...)', inputStyle,
}) => {
  const [suggestions, setSuggestions] = useState<CoinSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.length < 1) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchCoins(value);
      setSuggestions(results);
      setOpen(results.length > 0);
      setLoading(false);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (coin: CoinSuggestion) => {
    onSelect(coin);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1 }}>
      <div style={{ position: 'relative' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          onFocus={() => { setFocused(true); if (suggestions.length > 0) setOpen(true); }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#161616',
            border: `1px solid ${focused ? '#4caf50' : '#2a2a2a'}`,
            color: '#f3ba2f', padding: '8px 32px 8px 8px',
            fontFamily: 'monospace', fontWeight: 'bold',
            outline: 'none', transition: 'border-color 0.15s',
            ...inputStyle,
          }}
        />
        {loading && (
          <div style={{
            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
            color: '#555', fontSize: '11px',
          }}>
            <FaSync style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#161616', border: '1px solid #2a3a2a',
          zIndex: 2000, maxHeight: '260px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          {/* Header hint */}
          <div style={{
            padding: '5px 10px', fontSize: '10px', color: '#444',
            borderBottom: '1px solid #1a1a1a', letterSpacing: '0.5px',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <img src="https://static.coingecko.com/s/thumbnail-007177f3eca19695592f0b8b0eabbdae4523f2d21e1bee54db0b8e2b5f65a8c7.png"
              alt="CoinGecko" width={12} height={12} style={{ opacity: 0.5 }} />
            HASIL DARI COINGECKO
          </div>

          {suggestions.map((coin, idx) => (
            <div
              key={coin.id}
              onMouseDown={() => handleSelect(coin)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', cursor: 'pointer',
                background: 'transparent',
                borderBottom: idx < suggestions.length - 1 ? '1px solid #1a1a1a' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e2e1e')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Coin thumb */}
              <img
                src={coin.thumb}
                alt={coin.symbol}
                width={24} height={24}
                style={{ borderRadius: '50%', flexShrink: 0, background: '#222' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              {/* Name + symbol */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {coin.name}
                </div>
                <div style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>
                  {coin.symbol.toUpperCase()}
                  {coin.market_cap_rank && (
                    <span style={{ marginLeft: '6px', color: '#444' }}>#{coin.market_cap_rank}</span>
                  )}
                </div>
              </div>
              {/* Tap hint */}
              <div style={{ fontSize: '10px', color: '#2a4a2a', flexShrink: 0 }}>pilih</div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ─── Swap History type ────────────────────────────────────────────────────────
interface SwapRecord {
  id: string; tanggal: string; timestamp: string; refId: string; memo: string;
  fromSymbol: string; fromAmount: number; fromPriceUsd: number;
  toSymbol: string; toAmount: number; toPriceUsd: number; valueUsd: number;
}

// ─── SwapModal ────────────────────────────────────────────────────────────────
interface SwapModalProps {
  tokens: PortfolioToken[];
  livePrices: LivePriceMap;
  onClose: () => void;
  onSwap: (
    fromId: string, fromAmountUsed: number,
    toSymbol: string, toProjectName: string, toNetwork: string,
    toAmount: number, toPriceUsd: number, fromPriceUsd: number, memo: string,
  ) => void;
}

const SwapModal: React.FC<SwapModalProps> = ({ tokens, livePrices, onClose, onSwap }) => {
  const holdingTokens = tokens.filter(t => t.status === 'holding' || t.status === 'vesting');
  const [fromId, setFromId] = useState(holdingTokens[0]?.id ?? '');
  const [fromAmountInput, setFromAmountInput] = useState('');
  const [toSymbolInput, setToSymbolInput] = useState('');
  const [toProjectInput, setToProjectInput] = useState('');
  const [toNetworkInput, setToNetworkInput] = useState('');
  const [fetchingToPrice, setFetchingToPrice] = useState(false);
  const [toPriceFetched, setToPriceFetched] = useState<number | null>(null);
  const [toPriceError, setToPriceError] = useState('');
  const [manualToPrice, setManualToPrice] = useState('');
  const [useManualPrice, setUseManualPrice] = useState(false);

  const fromToken = holdingTokens.find(t => t.id === fromId);
  const fromLive = fromToken ? livePrices[fromToken.tokenSymbol.toUpperCase()] : undefined;
  const fromPriceUsd = fromLive?.usd ?? fromToken?.hargaPerToken ?? 0;
  const fromAmount = parseFloat(fromAmountInput) || 0;
  const fromValueUsd = fromAmount * fromPriceUsd;
  const toSymbolUp = toSymbolInput.toUpperCase().trim();
  const toPrice = useManualPrice ? (parseFloat(manualToPrice) || 0) : (toPriceFetched ?? 0);
  const toAmount = toPrice > 0 ? fromValueUsd / toPrice : 0;

  const handleFetchToPrice = async (sym?: string) => {
    const target = (sym ?? toSymbolUp);
    if (!target) return;
    setFetchingToPrice(true); setToPriceError(''); setToPriceFetched(null);
    try {
      const result = await fetchLivePrices([target]);
      const lp = result[target];
      if (lp?.usd) { setToPriceFetched(lp.usd); setUseManualPrice(false); }
      else { setToPriceError('Harga tidak ditemukan. Masukkan manual.'); setUseManualPrice(true); }
    } catch { setToPriceError('Gagal fetch harga. Masukkan manual.'); setUseManualPrice(true); }
    finally { setFetchingToPrice(false); }
  };

  const handleCoinSelect = (coin: CoinSuggestion) => {
    const sym = coin.symbol.toUpperCase();
    setToSymbolInput(sym);
    setToProjectInput(coin.name);
    setToPriceFetched(null); setToPriceError(''); setUseManualPrice(false);
    // Auto-fetch price after selection
    setTimeout(() => handleFetchToPrice(sym), 100);
  };

  const [swapMemo, setSwapMemo] = useState('');

  const canSwap = fromToken && fromAmount > 0 && fromAmount <= fromToken.jumlahToken
    && toSymbolUp && toPrice > 0 && toProjectInput.trim();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#111', border: '1px solid #2a2a2a', padding: '28px', width: '100%', maxWidth: '480px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaExchangeAlt style={{ color: '#f3ba2f' }} /> Swap Token (CV)
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px' }}><FaTimes /></button>
        </div>

        {holdingTokens.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: '20px 0' }}>Tidak ada token holding/vesting untuk di-swap.</p>
        ) : (
          <>
            {/* FROM */}
            <div style={{ background: '#0d1117', border: '1px solid #1e2727', padding: '16px', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase' }}>Dari</div>
              <select value={fromId} onChange={e => { setFromId(e.target.value); setFromAmountInput(''); }}
                style={{ width: '100%', marginBottom: '10px', background: '#161616', border: '1px solid #2a2a2a', color: '#e0e0e0', padding: '8px' }}>
                {holdingTokens.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.projectName} ({t.tokenSymbol}) — {t.jumlahToken.toLocaleString('en-US', { maximumFractionDigits: 4 })} token
                  </option>
                ))}
              </select>
              {fromToken && (
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
                  Tersedia: <span style={{ color: '#aaa', fontFamily: 'monospace' }}>
                    {fromToken.jumlahToken.toLocaleString('en-US', { maximumFractionDigits: 6 })} {fromToken.tokenSymbol}
                  </span>
                  {fromLive && <span style={{ marginLeft: '8px', color: '#4caf50' }}>@ ${fromLive.usd.toLocaleString('en-US', { maximumFractionDigits: 6 })}</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Jumlah yang di-swap" value={fromAmountInput}
                  onChange={e => setFromAmountInput(e.target.value)} min="0" step="any"
                  style={{ flex: 1, background: '#161616', border: '1px solid #2a2a2a', color: '#e0e0e0', padding: '8px', fontFamily: 'monospace' }} />
                {fromToken && (
                  <button onClick={() => setFromAmountInput(String(fromToken.jumlahToken))}
                    style={{ background: '#1a2a1a', border: '1px solid #2a3a2a', color: '#4caf50', padding: '6px 10px', cursor: 'pointer', fontSize: '11px' }}>MAX</button>
                )}
              </div>
              {fromAmount > 0 && fromPriceUsd > 0 && (
                <div style={{ fontSize: '12px', color: '#4caf50', marginTop: '6px', fontFamily: 'monospace' }}>
                  ≈ ${fromValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              {fromToken && fromAmount > fromToken.jumlahToken && (
                <div style={{ fontSize: '11px', color: '#f44336', marginTop: '4px' }}>⚠ Melebihi saldo yang tersedia</div>
              )}
            </div>

            {/* Arrow */}
            <div style={{ textAlign: 'center', color: '#f3ba2f', margin: '4px 0', fontSize: '18px' }}><FaArrowRight /></div>

            {/* TO */}
            <div style={{ background: '#0d1117', border: '1px solid #1e2727', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase' }}>Ke</div>

              {/* Symbol search with autocomplete */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                <CoinSearchInput
                  value={toSymbolInput}
                  onChange={v => { setToSymbolInput(v); setToPriceFetched(null); setToPriceError(''); setUseManualPrice(false); }}
                  onSelect={handleCoinSelect}
                  placeholder="Ketik nama / simbol token..."
                />
                <button onClick={() => handleFetchToPrice()} disabled={!toSymbolUp || fetchingToPrice}
                  style={{
                    background: '#1a2a1a', border: '1px solid #2a4a2a', color: fetchingToPrice ? '#444' : '#4caf50',
                    padding: '8px 12px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                  }}>
                  <FaSync style={{ animation: fetchingToPrice ? 'spin 1s linear infinite' : 'none' }} /> Cek Harga
                </button>
              </div>

              {/* Hint text */}
              <div style={{ fontSize: '10px', color: '#3a4a3a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <img src="https://static.coingecko.com/s/thumbnail-007177f3eca19695592f0b8b0eabbdae4523f2d21e1bee54db0b8e2b5f65a8c7.png"
                  alt="" width={10} height={10} style={{ opacity: 0.4 }} />
                Ketik simbol atau nama, lalu pilih dari daftar CoinGecko
              </div>

              <input placeholder="Nama project (otomatis terisi jika dipilih)"
                value={toProjectInput} onChange={e => setToProjectInput(e.target.value)}
                style={{ width: '100%', marginBottom: '8px', background: '#161616', border: '1px solid #2a2a2a', color: '#e0e0e0', padding: '8px', boxSizing: 'border-box' }} />
              <input placeholder="Network (opsional)"
                value={toNetworkInput} onChange={e => setToNetworkInput(e.target.value)}
                style={{ width: '100%', marginBottom: '8px', background: '#161616', border: '1px solid #2a2a2a', color: '#e0e0e0', padding: '8px', boxSizing: 'border-box' }} />

              {toPriceError && <div style={{ fontSize: '11px', color: '#f3ba2f', marginBottom: '6px' }}>{toPriceError}</div>}

              {(useManualPrice || toPriceError) && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Harga manual (USD/token)</div>
                  <input type="number" placeholder="Masukkan harga/token" value={manualToPrice}
                    onChange={e => setManualToPrice(e.target.value)} min="0" step="any"
                    style={{ width: '100%', background: '#161616', border: '1px solid #2a4a2a', color: '#e0e0e0', padding: '8px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                </div>
              )}

              {toPriceFetched != null && !useManualPrice && (
                <div style={{ fontSize: '12px', color: '#4caf50', marginBottom: '6px', fontFamily: 'monospace' }}>
                  Harga: ${toPriceFetched.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                  <button onClick={() => setUseManualPrice(true)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '10px' }}>ganti manual</button>
                </div>
              )}

              {toAmount > 0 && (
                <div style={{ fontSize: '13px', color: '#e0e0e0', fontFamily: 'monospace', marginTop: '4px' }}>
                  Dapat: <strong style={{ color: '#4caf50' }}>
                    {toAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {toSymbolUp}
                  </strong>
                  <span style={{ color: '#555', fontSize: '11px', marginLeft: '6px' }}>
                    (≈ ${fromValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </div>
              )}
            </div>

            {canSwap && (
              <div style={{ background: '#0a1a0a', border: '1px solid #1a3a1a', padding: '12px', marginBottom: '16px', fontSize: '12px', fontFamily: 'monospace', color: '#888' }}>
                <div style={{ marginBottom: '4px', color: '#4caf50', fontWeight: 'bold' }}>Ringkasan Swap</div>
                <div>{fromAmount.toLocaleString()} {fromToken?.tokenSymbol} → {toAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {toSymbolUp}</div>
                <div style={{ color: '#555', marginTop: '2px' }}>Rate: 1 {fromToken?.tokenSymbol} = {(fromPriceUsd / toPrice).toFixed(6)} {toSymbolUp}</div>
                {fromToken && fromAmount >= fromToken.jumlahToken && (
                  <div style={{ color: '#f3ba2f', marginTop: '4px', fontSize: '11px' }}>
                    ⚡ Seluruh posisi {fromToken.tokenSymbol} akan terhapus dari portfolio
                  </div>
                )}
              </div>
            )}

            {/* Memo swap */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Memo / Catatan (opsional)</div>
              <input placeholder="Contoh: Swap dari airdrop XYZ..." value={swapMemo}
                onChange={e => setSwapMemo(e.target.value)}
                style={{ width: '100%', background: '#161616', border: '1px solid #2a2a2a', color: '#e0e0e0', padding: '8px', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '12px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button onClick={() => {
                if (!canSwap || !fromToken) return;
                onSwap(fromToken.id, fromAmount, toSymbolUp, toProjectInput.trim(), toNetworkInput.trim(), toAmount, toPrice, fromPriceUsd, swapMemo.trim());
              }} disabled={!canSwap}
                style={{ background: canSwap ? '#1a3a1a' : '#111', border: `1px solid ${canSwap ? '#4caf50' : '#333'}`, color: canSwap ? '#4caf50' : '#444', padding: '12px', cursor: canSwap ? 'pointer' : 'not-allowed', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <FaExchangeAlt /> Konfirmasi Swap
              </button>
              <button onClick={onClose} style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '12px', cursor: 'pointer' }}>Batal</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Export CSV helper ────────────────────────────────────────────────────────
function exportSwapCSV(history: SwapRecord[]) {
  const headers = ['Ref ID', 'Timestamp', 'Tanggal', 'Dari', 'Jumlah Dari', 'Harga Dari (USD)', 'Ke', 'Jumlah Ke', 'Harga Ke (USD)', 'Nilai (USD)', 'Memo'];
  const rows = history.map(s => [
    s.refId, s.timestamp, s.tanggal,
    s.fromSymbol, s.fromAmount, s.fromPriceUsd,
    s.toSymbol, s.toAmount, s.toPriceUsd,
    s.valueUsd.toFixed(2), s.memo || '-',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `swap-history-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportTokenCSV(tokens: PortfolioToken[]) {
  const headers = ['Ref ID', 'Timestamp', 'Project', 'Token', 'Jumlah', 'Harga/Token (USD)', 'Network', 'Tanggal Diterima', 'Status', 'Catatan'];
  const rows = tokens.map(t => [
    t.refId || '-', t.timestamp || '-',
    t.projectName, t.tokenSymbol,
    t.jumlahToken, t.hargaPerToken,
    t.network, t.tanggalDiterima, t.status, t.catatan || '-',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `portfolio-tokens-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── SwapHistoryModal ─────────────────────────────────────────────────────────
const SwapHistoryModal: React.FC<{ history: SwapRecord[]; onClose: () => void; onClear: () => void; }> = ({ history, onClose, onClear }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div style={{ background: '#111', border: '1px solid #2a2a2a', padding: '24px', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '15px', color: '#e0e0e0' }}>Riwayat Swap</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px' }}><FaTimes /></button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {history.length === 0 ? (
          <p style={{ color: '#555', textAlign: 'center', padding: '20px 0' }}>Belum ada riwayat swap.</p>
        ) : [...history].reverse().map(s => (
          <div key={s.id} style={{ borderBottom: '1px solid #1a1a1a', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  <span style={{ color: '#f44336' }}>{s.fromAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} {s.fromSymbol}</span>
                  <span style={{ color: '#555', margin: '0 8px' }}>→</span>
                  <span style={{ color: '#4caf50' }}>{s.toAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {s.toSymbol}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                  ${s.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {s.tanggal}
                </div>
              </div>
              <div style={{ fontSize: '10px', color: '#444', fontFamily: 'monospace', textAlign: 'right' }}>
                1 {s.fromSymbol} = {(s.fromPriceUsd / s.toPriceUsd).toFixed(4)} {s.toSymbol}
              </div>
            </div>
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#2196f3', background: '#0d1a2a', border: '1px solid #1a2a3a', padding: '2px 7px' }}>
                {s.refId || 'INPO-???'}
              </span>
              {s.timestamp && (
                <span style={{ fontSize: '10px', color: '#555' }}>{s.timestamp}</span>
              )}
              {s.memo && (
                <span style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic' }}>"{s.memo}"</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
        {history.length > 0 && (
          <button onClick={() => exportSwapCSV(history)}
            style={{ background: '#0d1a0d', border: '1px solid #2a4a2a', color: '#4caf50', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ⬇ Export CSV
          </button>
        )}
        {history.length > 0 && (
          <button onClick={onClear} style={{ background: 'none', border: '1px solid #3a1a1a', color: '#f44336', padding: '8px 14px', cursor: 'pointer', fontSize: '12px' }}>
            Hapus Semua
          </button>
        )}
      </div>
    </div>
  </div>
);

// ─── Main Portfolio Component ─────────────────────────────────────────────────
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
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pinnedTokenIds') || '[]')); } catch { return new Set(); }
  });
  const [livePrices, setLivePrices] = useState<LivePriceMap>({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showSwapHistory, setShowSwapHistory] = useState(false);
  const [swapHistory, setSwapHistory] = useState<SwapRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('swapHistory') || '[]'); } catch { return []; }
  });
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [checkedPrice, setCheckedPrice] = useState<number | null>(null);
  const [checkPriceError, setCheckPriceError] = useState('');

  const showAlert = (msg: string, type: 'success' | 'error' | 'hapus' | 'info' = 'info') =>
    setAlertData({ isOpen: true, msg, type });

  useEffect(() => { localStorage.setItem('portfolioTokens', JSON.stringify(tokens)); }, [tokens]);
  useEffect(() => { localStorage.setItem('pinnedTokenIds', JSON.stringify([...pinnedIds])); }, [pinnedIds]);
  useEffect(() => { localStorage.setItem('swapHistory', JSON.stringify(swapHistory)); }, [swapHistory]);

  const fetchPrices = useCallback(async () => {
    const activeTokens = tokens.filter(t => t.status !== 'sold');
    if (activeTokens.length === 0) return;
    const symbols = [...new Set(activeTokens.map(t => t.tokenSymbol.toUpperCase()))];
    setPriceLoading(true);
    try {
      const prices = await fetchLivePrices(symbols);
      setLivePrices(prev => ({ ...prev, ...prices }));
      setLastUpdated(new Date());
    } finally { setPriceLoading(false); }
  }, [tokens]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60_000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // ── Swap handler ───────────────────────────────────────────────────────────
  const handleSwap = (
    fromId: string, fromAmountUsed: number,
    toSymbol: string, toProjectName: string, toNetwork: string,
    toAmount: number, toPriceUsd: number, fromPriceUsd: number, memo: string = '',
  ) => {
    setTokens(prev => {
      const fromToken = prev.find(t => t.id === fromId);
      if (!fromToken) return prev;
      let updated = prev.map(t => {
        if (t.id !== fromId) return t;
        const remaining = t.jumlahToken - fromAmountUsed;
        return remaining <= 0 ? { ...t, jumlahToken: 0, status: 'sold' as const } : { ...t, jumlahToken: remaining };
      });
      const existingTo = updated.find(t => t.tokenSymbol.toUpperCase() === toSymbol.toUpperCase() && t.status !== 'sold');
      if (existingTo) {
        const totalOldValue = existingTo.jumlahToken * existingTo.hargaPerToken;
        const totalNewValue = toAmount * toPriceUsd;
        const totalAmount = existingTo.jumlahToken + toAmount;
        const avgPrice = (totalOldValue + totalNewValue) / totalAmount;
        updated = updated.map(t => t.id === existingTo.id ? { ...t, jumlahToken: totalAmount, hargaPerToken: avgPrice } : t);
      } else {
        const newToken: PortfolioToken = {
          id: Date.now().toString(), projectName: toProjectName, tokenSymbol: toSymbol,
          jumlahToken: toAmount, hargaPerToken: toPriceUsd, network: toNetwork,
          tanggalDiterima: new Date().toISOString().split('T')[0],
          status: 'holding', catatan: `Swap dari ${fromToken.tokenSymbol}`,
          refId: generateRefId(), timestamp: generateTimestamp(),
        };
        updated = [newToken, ...updated];
      }
      return updated;
    });
    const swapRefId = generateRefId();
    const swapTimestamp = generateTimestamp();
    const record: SwapRecord = {
      id: Date.now().toString(),
      tanggal: new Date().toLocaleDateString('id-ID'),
      timestamp: swapTimestamp,
      refId: swapRefId,
      memo,
      fromSymbol: tokens.find(t => t.id === fromId)?.tokenSymbol ?? '',
      fromAmount: fromAmountUsed, fromPriceUsd, toSymbol, toAmount, toPriceUsd,
      valueUsd: fromAmountUsed * fromPriceUsd,
    };
    setSwapHistory(prev => [...prev, record]);
    setShowSwapModal(false);
    showAlert(`Swap berhasil! ${fromAmountUsed.toLocaleString()} → ${toAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${toSymbol}`, 'success');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectName || !form.tokenSymbol) return;
    if (isEditMode && editId) {
      setTokens(prev => prev.map(t => t.id === editId ? { ...t, ...form } : t));
      showAlert('Token berhasil diperbarui!', 'success');
      setIsEditMode(false); setEditId(null);
    } else {
      const refId = generateRefId();
      const timestamp = generateTimestamp();
      setTokens(prev => [{ ...form, id: Date.now().toString(), refId, timestamp }, ...prev]);
      showAlert(`Token ditambahkan! Ref: ${refId}`, 'success');
    }
    setForm(emptyForm);
  };

  const handleEdit = (token: PortfolioToken) => {
    const { id, ...rest } = token;
    setForm(rest); setIsEditMode(true); setEditId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    setConfirmData({
      isOpen: true, title: 'HAPUS TOKEN?', message: 'Data token ini akan dihapus permanen.',
      action: () => {
        setTokens(prev => prev.filter(t => t.id !== id));
        setPinnedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        showAlert('Token dihapus.', 'hapus');
      }
    });
  };

  const togglePin = (id: string) => {
    setPinnedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // CoinGecko autofill for add form
  const handleFormCoinSelect = (coin: CoinSuggestion) => {
    setForm(p => ({
      ...p,
      tokenSymbol: coin.symbol.toUpperCase(),
      projectName: p.projectName || coin.name, // only autofill if empty
    }));
    setCheckedPrice(null);
    setCheckPriceError('');
  };

  const handleCheckPrice = async () => {
    const sym = form.tokenSymbol.trim().toUpperCase();
    if (!sym) return;
    setCheckingPrice(true);
    setCheckedPrice(null);
    setCheckPriceError('');
    try {
      const result = await fetchLivePrices([sym]);
      const lp = result[sym];
      if (lp?.usd) {
        setCheckedPrice(lp.usd);
      } else {
        setCheckPriceError('Harga tidak ditemukan di CoinGecko.');
      }
    } catch {
      setCheckPriceError('Gagal mengambil harga. Coba lagi.');
    } finally {
      setCheckingPrice(false);
    }
  };

  const filtered = useMemo(() => {
    const list = tokens.filter(t => {
      const matchSearch = t.projectName.toLowerCase().includes(search.toLowerCase()) ||
        t.tokenSymbol.toLowerCase().includes(search.toLowerCase()) ||
        t.network.toLowerCase().includes(search.toLowerCase());
      return matchSearch && (statusFilter === 'all' || t.status === statusFilter);
    });
    return [...list].sort((a, b) => (pinnedIds.has(a.id) ? 0 : 1) - (pinnedIds.has(b.id) ? 0 : 1));
  }, [tokens, search, statusFilter, pinnedIds]);

  const stats = useMemo(() => {
    const holding = tokens.filter(t => t.status === 'holding');
    const liveValue = holding.reduce((acc, t) => {
      const lp = livePrices[t.tokenSymbol.toUpperCase()];
      return acc + t.jumlahToken * (lp?.usd ?? t.hargaPerToken);
    }, 0);
    const soldValue = tokens.filter(t => t.status === 'sold')
      .reduce((acc, t) => acc + t.jumlahToken * t.hargaPerToken, 0);
    return { liveValue, soldValue, holdingCount: holding.length };
  }, [tokens, livePrices]);

  return (
    <div className="app-container">
      <CustomAlert isOpen={alertData.isOpen} message={alertData.msg} type={alertData.type}
        onClose={() => setAlertData(p => ({ ...p, isOpen: false }))} />
      <CustomConfirm isOpen={confirmData.isOpen} title={confirmData.title} message={confirmData.message}
        onCancel={() => setConfirmData(p => ({ ...p, isOpen: false }))}
        onConfirm={() => { confirmData.action?.(); setConfirmData(p => ({ ...p, isOpen: false })); }} />
      {showSwapModal && (
        <SwapModal tokens={tokens} livePrices={livePrices} onClose={() => setShowSwapModal(false)} onSwap={handleSwap} />
      )}
      {showSwapHistory && (
        <SwapHistoryModal history={swapHistory} onClose={() => setShowSwapHistory(false)}
          onClear={() => { setSwapHistory([]); showAlert('Riwayat swap dihapus.', 'hapus'); }} />
      )}

      <header>
        <h1><FaCoins style={{ marginRight: '10px' }} />Portfolio Tracker</h1>
      </header>
      <Navbar />

      {/* Stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Nilai Holding (Live)', value: `$${stats.liveValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#4caf50' },
          { label: 'Token Holding', value: stats.holdingCount, color: '#2196f3' },
          { label: 'Total Sold', value: `$${stats.soldValue.toFixed(2)}`, color: '#888' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111', borderLeft: `4px solid ${s.color}`, border: `1px solid #333`, padding: '16px 20px', flex: 1, minWidth: '160px' }}>
            <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', fontFamily: 'monospace', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '10px 14px', background: '#0d1117', border: '1px solid #1e2a1e', fontSize: '12px', color: '#555', flexWrap: 'wrap' }}>
        <FaWifi style={{ color: priceLoading ? '#f3ba2f' : '#4caf50' }} />
        <span style={{ color: '#777', flex: 1 }}>
          {priceLoading ? 'Memperbarui harga...' : lastUpdated ? `Harga diperbarui: ${lastUpdated.toLocaleTimeString('id-ID')}` : 'Harga belum dimuat'}
        </span>
        <button onClick={fetchPrices} disabled={priceLoading}
          style={{ background: 'none', border: '1px solid #333', color: priceLoading ? '#444' : '#4caf50', cursor: priceLoading ? 'not-allowed' : 'pointer', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FaSync style={{ animation: priceLoading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
        <button onClick={() => setShowSwapModal(true)}
          style={{ background: '#1a2a1a', border: '1px solid #4caf50', color: '#4caf50', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaExchangeAlt /> Swap Token
        </button>
        <button onClick={() => setShowSwapHistory(true)}
          style={{ background: 'none', border: '1px solid #333', color: '#666', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>
          Riwayat ({swapHistory.length})
        </button>
        <button onClick={() => exportTokenCSV(tokens)}
          style={{ background: '#0d1a0d', border: '1px solid #2a4a2a', color: '#4caf50', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          ⬇ Export Portfolio CSV
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Add / Edit form */}
      <div className="form-container">
        <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>
          {isEditMode ? <><FaEdit /> Edit Token</> : <><FaPlus /> Tambah Token</>}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>

          {/* Token Symbol — with CoinGecko autocomplete */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <img src="https://static.coingecko.com/s/thumbnail-007177f3eca19695592f0b8b0eabbdae4523f2d21e1bee54db0b8e2b5f65a8c7.png"
                alt="" width={10} height={10} style={{ opacity: 0.4 }} />
              Simbol Token (cari dari CoinGecko)
            </div>
            <CoinSearchInput
              value={form.tokenSymbol}
              onChange={v => setForm(p => ({ ...p, tokenSymbol: v }))}
              onSelect={coin => {
                setForm(p => ({
                  ...p,
                  tokenSymbol: coin.symbol.toUpperCase(),
                  projectName: p.projectName || coin.name,
                }));
              }}
              placeholder="ETH, SOL, BTC..."
              inputStyle={{ color: '#f3ba2f' }}
            />
          </div>

          <input placeholder="Nama Project (Monad)" value={form.projectName}
            onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))} required />
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

          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <button type="button" onClick={handleCheckPrice} disabled={!form.tokenSymbol || checkingPrice}
              style={{ background: '#0d1a2a', border: '1px solid #2196f3', color: checkingPrice ? '#444' : '#2196f3', padding: '10px', cursor: form.tokenSymbol && !checkingPrice ? 'pointer' : 'not-allowed', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}>
              <FaSync style={{ animation: checkingPrice ? 'spin 1s linear infinite' : 'none' }} /> Cek Harga
            </button>
            <button type="submit" className="btn-manage btn-import">
              <FaSave /> {isEditMode ? 'Update' : 'Tambah Token'}
            </button>
            <button type="button" className="cancel-btn" onClick={() => { setForm(emptyForm); setIsEditMode(false); setEditId(null); setCheckedPrice(null); setCheckPriceError(''); }}>
              <FaUndo /> Reset
            </button>
          </div>
          {checkedPrice !== null && (
            <div style={{ gridColumn: '1 / -1', background: '#0a1a0a', border: '1px solid #1a3a1a', padding: '10px 14px', fontSize: '13px', fontFamily: 'monospace', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaWifi style={{ flexShrink: 0 }} />
              Harga live <strong style={{ color: '#f3ba2f' }}>{form.tokenSymbol}</strong>: <strong>${checkedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</strong>
              <button type="button" onClick={() => setForm(p => ({ ...p, hargaPerToken: checkedPrice! }))}
                style={{ marginLeft: '8px', background: '#1a3a1a', border: '1px solid #4caf50', color: '#4caf50', padding: '3px 10px', cursor: 'pointer', fontSize: '11px' }}>
                Pakai harga ini
              </button>
            </div>
          )}
          {checkPriceError && (
            <div style={{ gridColumn: '1 / -1', background: '#1a0a0a', border: '1px solid #3a1a1a', padding: '8px 14px', fontSize: '12px', color: '#f44336', fontFamily: 'monospace' }}>
              ⚠ {checkPriceError}
            </div>
          )}
        </form>
        {form.jumlahToken > 0 && form.hargaPerToken > 0 && (
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#4caf50', marginTop: '10px', fontFamily: 'monospace' }}>
            Estimasi nilai: <strong>${(form.jumlahToken * form.hargaPerToken).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </p>
        )}
      </div>

      {/* Filter bar */}
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

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th title="Pin/Prioritas"><FaThumbtack /></th>
              <th>Project</th><th>Token</th><th>Jumlah</th>
              <th>Harga Beli</th><th>Harga Live</th><th>PnL</th>
              <th>Total (Live)</th><th>Network</th><th>Tgl Diterima</th>
              <th>Status</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: '20px', color: '#555' }}>Belum ada token di portfolio.</td></tr>
            ) : filtered.map(token => {
              const isPinned = pinnedIds.has(token.id);
              const lp = livePrices[token.tokenSymbol.toUpperCase()];
              const livePrice = lp?.usd;
              const change24h = lp?.usd_24h_change;
              const buyPrice = token.hargaPerToken;
              const liveTotal = livePrice != null ? token.jumlahToken * livePrice : null;
              const buyTotal = token.jumlahToken * buyPrice;
              const pnlUsd = liveTotal != null ? liveTotal - buyTotal : null;
              const pnlPct = pnlUsd != null && buyTotal > 0 ? (pnlUsd / buyTotal) * 100 : null;

              return (
                <tr key={token.id} style={{ background: isPinned ? 'rgba(243,186,47,0.04)' : undefined, borderLeft: isPinned ? '2px solid #f3ba2f' : '2px solid transparent' }}>
                  <td data-label="Pin" style={{ textAlign: 'center' }}>
                    <button onClick={() => togglePin(token.id)} title={isPinned ? 'Unpin' : 'Pin'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: isPinned ? '#f3ba2f' : '#444', fontSize: '13px', padding: '2px 4px', transform: isPinned ? 'rotate(-20deg)' : 'none', transition: 'color 0.2s, transform 0.2s' }}>
                      <FaThumbtack />
                    </button>
                  </td>
                  <td data-label="Project">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isPinned && <span style={{ fontSize: '9px', color: '#f3ba2f', border: '1px solid #f3ba2f', padding: '1px 5px', fontWeight: 'bold' }}>PINNED</span>}
                      <strong>{token.projectName}</strong>
                    </div>
                    {token.catatan && <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>{token.catatan}</div>}
                    {token.refId && (
                      <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#2196f3', background: '#0d1a2a', border: '1px solid #1a2a3a', padding: '1px 6px', marginTop: '3px', display: 'inline-block' }}>
                        {token.refId}
                      </div>
                    )}
                    {token.timestamp && (
                      <div style={{ fontSize: '9px', color: '#444', marginTop: '2px' }}>{token.timestamp}</div>
                    )}
                  </td>
                  <td data-label="Token" style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#f3ba2f' }}>{token.tokenSymbol}</td>
                  <td data-label="Jumlah" style={{ fontFamily: 'monospace' }}>{token.jumlahToken.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                  <td data-label="Harga Beli" style={{ fontFamily: 'monospace', color: '#aaa' }}>
                    ${buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </td>
                  <td data-label="Harga Live" style={{ fontFamily: 'monospace' }}>
                    {token.status === 'sold' ? <span style={{ color: '#444' }}>—</span>
                      : lp === null ? <span style={{ color: '#555', fontSize: '11px' }}>N/A</span>
                      : livePrice != null ? (
                        <div>
                          <div style={{ color: '#e0e0e0' }}>${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                          {change24h != null && (
                            <div style={{ fontSize: '10px', color: change24h >= 0 ? '#4caf50' : '#f44336' }}>
                              {change24h >= 0 ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
                            </div>
                          )}
                        </div>
                      ) : <span style={{ color: '#444', fontSize: '11px' }}>—</span>}
                  </td>
                  <td data-label="PnL" style={{ fontFamily: 'monospace' }}>
                    {token.status === 'sold' || pnlUsd == null ? <span style={{ color: '#444' }}>—</span> : (
                      <div style={{ color: pnlUsd >= 0 ? '#4caf50' : '#f44336' }}>
                        <div style={{ fontWeight: 'bold' }}>{pnlUsd >= 0 ? '+' : ''}${pnlUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {pnlPct != null && <div style={{ fontSize: '10px' }}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</div>}
                      </div>
                    )}
                  </td>
                  <td data-label="Total" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    <span style={{ color: '#4caf50' }}>
                      ${(liveTotal != null && token.status !== 'sold' ? liveTotal : buyTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td data-label="Network" style={{ fontSize: '12px' }}>{token.network || '-'}</td>
                  <td data-label="Tgl" style={{ fontSize: '12px', color: '#888' }}>{token.tanggalDiterima}</td>
                  <td data-label="Status">
                    <span style={{ color: STATUS_COLORS[token.status], border: `1px solid ${STATUS_COLORS[token.status]}`, padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>
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
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="app-footer" style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '0.8em' }}>
        Powered by IAC Community
      </footer>
    </div>
  );
};
