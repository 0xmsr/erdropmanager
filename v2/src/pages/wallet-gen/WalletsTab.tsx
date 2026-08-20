// @ts-nocheck
// Semua state & handler di file ini datang dari ctx (Record<string, any>) yang
// diteruskan dari Walletgenerator.tsx, jadi TypeScript tidak bisa menurunkan
// tipe parameter callback (.map/.filter/dst) di sini secara otomatis.
// Type-safety sesungguhnya tetap ada penuh di state/handler aslinya
// (Walletgenerator.tsx) dan di ./types.ts — file ini murni JSX passthrough.

import React from 'react';
import type { WalletGeneratorCtx, ChainKind } from './types';
import { QLENGTH_OPTIONS, WALLET_CHAIN_OPTIONS } from './constants';
import { GRAM_WALLET_VERSIONS } from './network/Gramnet';

/**
 * WalletsTab: dipecah dari Walletgenerator.tsx (tab "WalletsTab").
 * Semua state, handler, dan helper dari komponen induk diteruskan lewat prop `ctx`
 * (lihat WalletGeneratorCtx di ../types.ts) supaya logic tetap terpusat di
 * Walletgenerator.tsx tanpa perlu re-wiring ratusan handler satu per satu.
 */
export function WalletsTab({ ctx }: { ctx: WalletGeneratorCtx }) {
  const {
    FaChartBar, FaCheckCircle, FaChevronDown, FaChevronUp, FaCoins, FaCopy, FaEye, FaEyeSlash, 
    FaFileExport, FaFileImport, FaKey, FaNetworkWired, FaPlus, FaQrcode, FaRandom, FaSearch, 
    FaShieldAlt, FaSync, FaTrash, FaWallet, activeTab, addressCount, balCheckNetId, balChecking, 
    balResults, chainView, checkAllAtomBalances, checkAllAxmBalances, checkAllBalances, checkAllGramBalances, 
    checkAllSolBalances, checkAllTronBalances, copiedKey, copyText, csvExporting, customMnemonic, 
    deleteWallet, deriveMore, entropyBits, expandedId, exportAllCSV, exportWallet, filteredWallets, 
    generateWallet, generating, importMode, networks, openPortfolio, revealedIds, revealedPKs, search, 
    setAddressCount, setBalCheckNetId, setBalResults, setChainView, setCustomMnemonic, setEntropyBits, 
    setExpandedId, setImportMode, setQrAddress, setRevealedIds, setRevealedPKs, setSearch, 
    setWalletName, walletName, wallets, gramVersion, setGramVersion, switchGramVersion,
  } = ctx;

  return (
        <>
          <div className="form-container" style={{ marginBottom:'24px' }}>
            <h2 style={{ textAlign:'center', marginBottom:'16px', fontSize:'15px' }}>
              {importMode ? <><FaFileImport/> Import Mnemonic</> : <><FaRandom/> Generate Wallet Baru</>}
            </h2>
            <div style={{ display:'flex', gap:'8px', marginBottom:'14px', justifyContent:'center' }}>
              {[false, true].map(isImport => (
                <button key={String(isImport)} onClick={() => setImportMode(isImport)} style={{
                  padding:'7px 16px',
                  background:importMode === isImport ? '#01a2ff' : '#111',
                  border:`1px solid ${importMode === isImport ? '#01a2ff' : '#333'}`,
                  color:importMode === isImport ? '#000' : '#888',
                  cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                }}>
                  {isImport ? <><FaFileImport style={{ marginRight:'5px' }}/>Import</> : <><FaRandom style={{ marginRight:'5px' }}/>Generate</>}
                </button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <input placeholder="Nama Wallet (opsional)" value={walletName} onChange={e => setWalletName(e.target.value)}/>
              {!importMode && (
                <select value={entropyBits} onChange={e => setEntropyBits(Number(e.target.value) as any)}>
                  {QLENGTH_OPTIONS.map(o => <option key={o.bits} value={o.bits}>{o.label}</option>)}
                </select>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <label style={{ fontSize:'12px', color:'#888', whiteSpace:'nowrap' }}>Jumlah Address:</label>
                <input type="number" min={1} max={20} value={addressCount}
                  onChange={e => setAddressCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{ width:'70px' }}/>
              </div>
            </div>
            {importMode && (
              <textarea
                placeholder="Masukkan mnemonic phrase (12/15/18/21/24 kata, dipisah spasi)..."
                value={customMnemonic}
                onChange={e => setCustomMnemonic(e.target.value)}
                rows={3}
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', resize:'vertical', marginBottom:'10px' }}
              />
            )}
            <button onClick={generateWallet}
              disabled={generating || (importMode && !customMnemonic.trim())}
              style={{ width:'100%', padding:'13px', background:generating?'#1a2a1a':'#01a2ff', color:generating?'#4caf50':'#000', border:'none', cursor:generating?'wait':'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:importMode&&!customMnemonic.trim()?0.5:1 }}>
              {generating
                ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Generating...</>
                : importMode ? <><FaFileImport/> Import Wallet</> : <><FaRandom/> Generate Wallet</>}
            </button>
          </div>

          <div className="search-filter-bar" style={{ marginBottom:'16px' }}>
            <div className="search-input-wrapper">
              <FaSearch className="search-icon"/>
              <input type="search" placeholder="Cari nama / address..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <span style={{ fontSize:'12px', color:'#555', alignSelf:'center' }}>{wallets.length} wallet tersimpan</span>
          </div>

          <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:'2px solid #4caf50', padding:'16px', marginBottom:'16px', boxSizing:'border-box', maxWidth:'100%', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:'1 1 240px', minWidth:0, flexWrap:'wrap' }}>
                <span style={{ fontSize:'11px', color:'#4caf50', textTransform:'uppercase', letterSpacing:'1px', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'5px' }}>
                  <FaChartBar size={11}/> Cek Balance Semua Wallet
                </span>
                <select value={balCheckNetId} onChange={e => { setBalCheckNetId(e.target.value); setBalResults({}); }}
                  style={{ fontSize:'12px', padding:'5px 8px', fontFamily:'monospace', minWidth:'140px', maxWidth:'100%', boxSizing:'border-box' }}>
                  {networks.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', width:'100%', boxSizing:'border-box' }}>
                <button onClick={checkAllBalances} disabled={balChecking || wallets.length === 0}
                  style={{ background: balChecking ? '#1a2a1a' : '#4caf50', color:'#000', border:'none', padding:'8px 16px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: wallets.length === 0 ? 0.4 : 1, flex:'1 1 auto', minWidth:'110px', boxSizing:'border-box' }}>
                  {balChecking
                    ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Checking...</>
                    : <><FaSync size={10}/> Cek Semua {networks.find(n => n.id === balCheckNetId)?.symbol || 'EVM'}</>}
                </button>
                <button onClick={checkAllSolBalances} disabled={balChecking || wallets.length === 0}
                  title="Cek saldo SOL semua address Solana yang tersimpan"
                  style={{ background: balChecking ? '#1a1a2a' : '#9945FF', color:'#000', border:'none', padding:'8px 16px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: wallets.length === 0 ? 0.4 : 1, flex:'1 1 auto', minWidth:'110px', boxSizing:'border-box' }}>
                  {balChecking
                    ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Checking...</>
                    : <><FaSync size={10}/> Cek Semua SOL</>}
                </button>
                <button onClick={checkAllTronBalances} disabled={balChecking || wallets.length === 0}
                  title="Cek saldo TRX semua address Tron yang tersimpan"
                  style={{ background: balChecking ? '#2a1a1a' : '#EF0027', color:'#fff', border:'none', padding:'8px 16px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: wallets.length === 0 ? 0.4 : 1, flex:'1 1 auto', minWidth:'110px', boxSizing:'border-box' }}>
                  {balChecking
                    ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Checking...</>
                    : <><FaSync size={10}/> Cek Semua TRX</>}
                </button>
                <button onClick={checkAllAtomBalances} disabled={balChecking || wallets.length === 0}
                  title="Cek saldo ATOM semua address Cosmos Hub yang tersimpan"
                  style={{ background: balChecking ? '#15161d' : '#2E3148', color:'#fff', border:'none', padding:'8px 16px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: wallets.length === 0 ? 0.4 : 1, flex:'1 1 auto', minWidth:'110px', boxSizing:'border-box' }}>
                  {balChecking
                    ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Checking...</>
                    : <><FaSync size={10}/> Cek Semua ATOM</>}
                </button>
                <button onClick={checkAllAxmBalances} disabled={balChecking || wallets.length === 0}
                  title="Cek saldo AXM semua address Axiome yang tersimpan"
                  style={{ background: balChecking ? '#181229' : '#75bbe9', color:'#fff', border:'none', padding:'8px 16px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: wallets.length === 0 ? 0.4 : 1, flex:'1 1 auto', minWidth:'110px', boxSizing:'border-box' }}>
                  {balChecking
                    ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Checking...</>
                    : <><FaSync size={10}/> Cek Semua AXM</>}
                </button>
                <button onClick={checkAllGramBalances} disabled={balChecking || wallets.length === 0}
                  title="Cek saldo TON semua address Gram yang tersimpan"
                  style={{ background: balChecking ? '#0d222b' : '#0088CC', color:'#fff', border:'none', padding:'8px 16px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: wallets.length === 0 ? 0.4 : 1, flex:'1 1 auto', minWidth:'110px', boxSizing:'border-box' }}>
                  {balChecking
                    ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Checking...</>
                    : <><FaSync size={10}/> Cek Semua GRAM</>}
                </button>
                <button onClick={exportAllCSV} disabled={csvExporting || wallets.length === 0}
                  style={{ background:'#111', color: wallets.length === 0 ? '#333' : '#f3ba2f', border:`1px solid ${wallets.length === 0 ? '#222' : '#f3ba2f44'}`, padding:'8px 14px', cursor: wallets.length === 0 ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', flex:'1 1 auto', minWidth:'110px', boxSizing:'border-box' }}>
                  {csvExporting ? '...' : <><FaFileExport size={10}/> Export CSV</>}
                </button>
              </div>
            </div>
            {Object.keys(balResults).length > 0 && (
              <div style={{ marginTop:'12px', fontSize:'11px', color:'#555', display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {Object.entries(balResults as Record<string, any>).map(([addr, r]) => (
                  <span key={addr} style={{ background:'#111', border:`1px solid ${r.error ? '#f4433622' : '#4caf5022'}`, padding:'4px 10px', fontFamily:'monospace', display:'flex', alignItems:'center', gap:'6px' }}>
                    <span style={{ color:'#444' }}>{addr.slice(0,8)}…{addr.slice(-4)}</span>
                    <span style={{ color: r.error ? '#f44336' : r.loading ? '#888' : '#4caf50', fontWeight:'bold' }}>
                      {r.loading ? '⟳' : r.balance}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {filteredWallets.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px', color:'#333', border:'1px dashed #222' }}>
                <FaWallet size={28} style={{ marginBottom:'10px', opacity:0.3 }}/>
                <p>Belum ada wallet. Generate wallet pertamamu!</p>
              </div>
            )}
            {filteredWallets.map(w => {
              const isExpanded      = expandedId === w.id;
              const isMnemonicShown = revealedIds.has(w.id);
              const activeChain: ChainKind = chainView[w.id] || 'evm';
              const activeList  = activeChain === 'sol' ? (w.solAddresses || []) : activeChain === 'tron' ? (w.tronAddresses || []) : activeChain === 'axm' ? (w.axmAddresses || []) : activeChain === 'atom' ? (w.atomAddresses || []) : activeChain === 'gram' ? (w.gramAddress ? [{ index: 0, address: w.gramAddress.address, privateKey: w.gramAddress.privateKey }] : []) : w.addresses;
              const activePath  = activeChain === 'sol' ? "m/44'/501'/x'/0'" : activeChain === 'tron' ? "m/44'/195'/0'/0/x" : activeChain === 'axm' ? "m/44'/118'/x'/0/0" : activeChain === 'atom' ? "m/44'/118'/x'/0/0" : activeChain === 'gram' ? "m/44'/607'/0'" : "m/44'/60'/0'/0/x";
              return (
                <div key={w.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #01a2ff', overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', cursor:'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : w.id)}>
                    <FaWallet color="#01a2ff" size={14}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'bold', fontSize:'14px' }}>{w.name}</div>
                      <div style={{ fontSize:'10px', color:'#444', marginTop:'2px' }}>
                        {new Date(w.createdAt).toLocaleString('id-ID')} · {activeList.length} address · {activePath}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <button onClick={e => { e.stopPropagation(); exportWallet(w); }} title="Export JSON"
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 8px', cursor:'pointer', fontSize:'11px' }}>
                        <FaFileExport/>
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteWallet(w.id); }} title="Hapus"
                        style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'5px 8px', cursor:'pointer', fontSize:'11px' }}>
                        <FaTrash/>
                      </button>
                      <span style={{ color:'#444', fontSize:'14px' }}>
                        {isExpanded ? <FaChevronUp/> : <FaChevronDown/>}
                      </span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop:'1px solid #1a1a1a', padding:'16px' }}>
                      <div style={{ marginBottom:'16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                          <span style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px' }}>
                            <FaKey style={{ marginRight:'5px' }}/>Mnemonic Phrase
                          </span>
                          <button
                            onClick={() => setRevealedIds(prev => { const n = new Set(prev); n.has(w.id) ? n.delete(w.id) : n.add(w.id); return n; })}
                            style={{ background:'none', border:'1px solid #333', color:'#888', padding:'4px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                            {isMnemonicShown ? <><FaEyeSlash/> Sembunyikan</> : <><FaEye/> Tampilkan</>}
                          </button>
                        </div>
                        {isMnemonicShown ? (
                          <div style={{ background:'#0a1a0a', border:'1px solid #1a3a1a', padding:'14px' }}>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
                              {w.mnemonic.split(' ').map((word, i) => (
                                <span key={i} style={{ background:'#111', border:'1px solid #1e3a1e', padding:'4px 10px', fontSize:'12px', fontFamily:'monospace', color:'#4caf50' }}>
                                  <span style={{ color:'#2a5a2a', fontSize:'10px', marginRight:'4px' }}>{i+1}.</span>{word}
                                </span>
                              ))}
                            </div>
                            <button onClick={() => copyText(w.mnemonic, 'mn_'+w.id)}
                              style={{ background:'#0d2a0d', border:'1px solid #1e5a1e', color:'#4caf50', padding:'6px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'6px' }}>
                              {copiedKey === 'mn_'+w.id ? <><FaCheckCircle/> Tersalin!</> : <><FaCopy/> Salin Mnemonic</>}
                            </button>
                          </div>
                        ) : (
                          <div style={{ background:'#0d0d0d', border:'1px dashed #1e1e1e', padding:'12px', textAlign:'center', color:'#333', fontSize:'12px' }}>
                            ██████ ██████ ██████ ██████ ██████ ██████ (tersembunyi)
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom:'14px' }}>
                        <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>
                          <FaNetworkWired style={{ marginRight:'5px' }}/>Ganti Network
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                          {WALLET_CHAIN_OPTIONS.map(opt => {
                            const isActive = activeChain === opt.id;
                            if (opt.soon) {
                              return (
                                <button key={opt.id} disabled title="Segera hadir"
                                  style={{ background:'none', border:'1px dashed #262626', color:'#3a3a3a', padding:'6px 12px', fontSize:'11px', cursor:'not-allowed', display:'flex', alignItems:'center', gap:'5px' }}>
                                  {opt.label} <span style={{ fontSize:'9px', color:'#333' }}>SOON</span>
                                </button>
                              );
                            }
                            return (
                              <button key={opt.id}
                                onClick={() => setChainView(prev => ({ ...prev, [w.id]: opt.id as ChainKind }))}
                                style={{
                                  background:   isActive ? '#01a2ff' : 'none',
                                  color:        isActive ? '#000' : '#888',
                                  border:       `1px solid ${isActive ? '#01a2ff' : '#333'}`,
                                  padding:'6px 14px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
                                }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                          <FaShieldAlt style={{ marginRight:'5px' }}/>
                          Derived Addresses {activeChain === 'sol' ? '(Solana · ed25519)' : activeChain === 'tron' ? '(Tron · secp256k1, base58check)' : activeChain === 'axm' ? '(Axiome · secp256k1, bech32 "axm1...")' : activeChain === 'atom' ? '(Cosmos Hub · secp256k1, bech32 "cosmos1...")' : activeChain === 'gram' ? `(Gram/TON · ed25519, wallet ${w.gramAddress?.version === 'v4' ? 'V4R2' : 'W5/v5r1'})` : '(EIP-55 Checksummed)'}
                        </div>

                        {activeList.length === 0 && activeChain === 'sol' && (
                          <div style={{ color:'#444', fontSize:'11px', padding:'10px 0' }}>
                            Belum ada address Solana — klik "Turunkan Address" di bawah untuk generate dari mnemonic yang sama.
                          </div>
                        )}
                        {activeList.length === 0 && activeChain === 'tron' && (
                          <div style={{ color:'#444', fontSize:'11px', padding:'10px 0' }}>
                            Belum ada address Tron — klik "Turunkan Address" di bawah untuk generate dari mnemonic yang sama.
                          </div>
                        )}
                        {activeList.length === 0 && activeChain === 'axm' && (
                          <div style={{ color:'#444', fontSize:'11px', padding:'10px 0' }}>
                            Belum ada address Axiome — sedang diturunkan dari mnemonic yang sama (async), atau klik "Turunkan Address" di bawah.
                          </div>
                        )}
                        {activeList.length === 0 && activeChain === 'atom' && (
                          <div style={{ color:'#444', fontSize:'11px', padding:'10px 0' }}>
                            Belum ada address Cosmos Hub — sedang diturunkan dari mnemonic yang sama (async), atau klik "Turunkan Address" di bawah.
                          </div>
                        )}
                        {activeList.length === 0 && activeChain === 'gram' && (
                          <div style={{ color:'#444', fontSize:'11px', padding:'10px 0' }}>
                            Belum ada address Gram (TON) — sedang diturunkan dari mnemonic yang sama (async).
                          </div>
                        )}
                        {activeList.slice().sort((a,b) => a.index - b.index).map(addr => {
                          const pkKey      = `pk_${activeChain}_${w.id}_${addr.index}`;
                          const pkRevealed = revealedPKs.has(pkKey);
                          return (
                            <div key={addr.index} style={{ background:'#0a0a0a', border:'1px solid #151515', padding:'12px', marginBottom:'8px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                                <span style={{ fontSize:'10px', color:'#444', background:'#111', padding:'2px 7px', fontFamily:'monospace' }}>#{addr.index}</span>
                                <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}>
                                  {addr.address}
                                </code>
                                <button onClick={() => copyText(addr.address, `addr_${activeChain}_${addr.index}_${w.id}`)}
                                  style={{ background:'none', border:'none', color:copiedKey===`addr_${activeChain}_${addr.index}_${w.id}`?'#4caf50':'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  {copiedKey===`addr_${activeChain}_${addr.index}_${w.id}` ? <FaCheckCircle size={12}/> : <FaCopy size={12}/>}
                                </button>
                                <button onClick={() => setQrAddress(addr.address)} title="QR Code"
                                  style={{ background:'none', border:'none', color:'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  <FaQrcode size={12}/>
                                </button>
                                <button onClick={() => openPortfolio(activeChain, addr.address, w.name)} title="Cek semua token & nilai USD"
                                  style={{ background:'none', border:'none', color:'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  <FaCoins size={12}/>
                                </button>
                                {balResults[addr.address] && (
                                  <span style={{ fontSize:'10px', fontFamily:'monospace', color: balResults[addr.address].error ? '#f44336' : '#4caf50', whiteSpace:'nowrap', flexShrink:0 }}>
                                    {balResults[addr.address].loading ? '...' : balResults[addr.address].balance}
                                  </span>
                                )}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <span style={{ fontSize:'10px', color:'#333', whiteSpace:'nowrap' }}>Private Key:</span>
                                <code style={{ flex:1, fontSize:'11px', color:pkRevealed?'#ff9944':'#1e1e1e', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0d0d0d', padding:'3px 6px' }}>
                                  {pkRevealed ? addr.privateKey : '████████████████████████████████████████████████████████████████'}
                                </code>
                                <button
                                  onClick={() => setRevealedPKs(prev => { const n = new Set(prev); n.has(pkKey) ? n.delete(pkKey) : n.add(pkKey); return n; })}
                                  style={{ background:'none', border:'none', color:'#444', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                  {pkRevealed ? <FaEyeSlash size={11}/> : <FaEye size={11}/>}
                                </button>
                                {pkRevealed && (
                                  <button onClick={() => copyText(addr.privateKey, `pk_copy_${activeChain}_${addr.index}_${w.id}`)}
                                    style={{ background:'none', border:'none', color:copiedKey===`pk_copy_${activeChain}_${addr.index}_${w.id}`?'#4caf50':'#555', cursor:'pointer', padding:'4px', flexShrink:0 }}>
                                    {copiedKey===`pk_copy_${activeChain}_${addr.index}_${w.id}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {activeChain !== 'gram' && (
                          <button onClick={() => deriveMore(w.id, activeList.length)} disabled={generating}
                            style={{ background:'#0d0d1a', border:'1px solid #1e1e3a', color:'#4a4aff', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px', marginTop:'4px', opacity:generating?0.5:1 }}>
                            <FaPlus size={10}/> Turunkan Address #{activeList.length}
                          </button>
                        )}
                        {activeChain === 'gram' && w.gramAddress && (
                          <button onClick={() => switchGramVersion(w.id)}
                            title="Menurunkan ulang address dari mnemonic yang sama dengan versi wallet contract lain"
                            style={{ background:'#0d0d1a', border:'1px solid #1e1e3a', color:'#4a4aff', padding:'8px 14px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px', marginTop:'4px' }}>
                            <FaSync size={10}/> Ganti ke {w.gramAddress.version === 'v4' ? 'W5 (v5r1)' : 'V4R2 (legacy)'}
                          </button>
                        )}
                      </div>
                    </div>

                  )}
                </div>
              );
            })}
          </div>
        </>
  );
}