// @ts-nocheck
// Semua state & handler di file ini datang dari ctx (Record<string, any>) yang
// diteruskan dari Walletgenerator.tsx, jadi TypeScript tidak bisa menurunkan
// tipe parameter callback (.map/.filter/dst) di sini secara otomatis.
// Type-safety sesungguhnya tetap ada penuh di state/handler aslinya
// (Walletgenerator.tsx) dan di ./types.ts — file ini murni JSX passthrough.

import React from 'react';
import type { WalletGeneratorCtx, ChainKind } from './types';
import { CHAIN_OPTIONS } from './constants';
import { shortAddr } from './helpers';
import { GRAM_WALLET_VERSIONS } from './network/Gramnet';

/**
 * TransferTab: dipecah dari Walletgenerator.tsx (tab "TransferTab").
 * Semua state, handler, dan helper dari komponen induk diteruskan lewat prop `ctx`
 * (lihat WalletGeneratorCtx di ../types.ts) supaya logic tetap terpusat di
 * Walletgenerator.tsx tanpa perlu re-wiring ratusan handler satu per satu.
 */
export function TransferTab({ ctx }: { ctx: WalletGeneratorCtx }) {
  const {
    AXIOME_NETWORK, AXIOME_NETWORKS, COSMOS_NETWORK, COSMOS_NETWORKS, GRAM_NETWORK, GRAM_NETWORKS, FaBolt, FaCheckCircle, 
    FaChevronDown, FaChevronUp, FaCoins, FaCopy, FaExchangeAlt, FaExclamationTriangle, FaFaucet, 
    FaGasPump, FaGlobe, FaInfoCircle, FaKey, FaLayerGroup, FaLink, FaNetworkWired, FaPaperPlane, 
    FaPlug, FaPlus, FaQrcode, FaRocket, FaSpinner, FaSync, FaTrash, LAMPORTS_PER_SOL, SOLANA_NETWORK, 
    SOLANA_NETWORKS, TOKEN_2022_PROGRAM_ID, TRON_NETWORKS, activeTab, agHistory, atomAddress, 
    atomBalance, atomConnect, atomConnected, atomConnecting, atomDisconnect, atomFeeEstimate, 
    atomFeeEstimateError, atomLoadingBal, atomNetId, atomPrivKey, atomRefreshBalance, atomSend, 
    atomSendAmt, atomSendTo, atomSending, atomStatus, atomWalletSel, axmAddress, axmBalance, 
    axmConnect, axmConnected, axmConnecting, axmDisconnect, axmFeeEstimate, axmFeeEstimateError, 
    axmFeeEstimating, axmLoadingBal, axmNetId, axmPrivKey, axmRefreshBalance, axmSend, axmSendAmt, 
    axmSendTo, axmSending, axmStatus, axmWalletSel, 
    gramAddress, gramBalance, gramConnect, gramConnected, gramConnecting, gramDisconnect, 
    gramLoadingBal, gramNetId, gramPrivKey, gramRefreshBalance, gramSend, gramSendAmt, gramSendTo, 
    gramSending, gramStatus, gramWalletSel, handleGramWalletSel, setGramPrivKey, setGramSendAmt, 
    setGramSendTo, setGramWalletSel, switchGramNetwork, gramConnectVersion, setGramConnectVersion, 
    gramFeeEstimate, gramFeeEstimateError, gramFeeEstimating, gramMaxLoading, gramSetMaxAmount, 
    gramSendMode, setGramSendMode, gramJettonMaster, setGramJettonMaster, gramJettonTo, setGramJettonTo, 
    gramJettonAmt, setGramJettonAmt, gramJettonComment, setGramJettonComment, gramJettonSending, gramJettonStatus, 
    gramJettonMeta, gramJettonMetaLoading, gramJettonMetaError, gramJettonFeeEstimate, gramJettonFeeEstimating, 
    gramJettonFeeEstimateError, gramJettonDetected, gramJettonDetectedLoading, gramLoadDetectedJettons, 
    gramSelectJetton, gramSendJetton, 
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
    solIsValidAddr, solLoadingBal, solMode, solMultiAddRow, solMultiApplyEqual, solMultiEqualAmt, 
    solMultiRemoveRow, solMultiRows, solMultiRunning, solMultiSend, solMultiUpdateRow, solNetId, 
    solPrivKey, solRefreshBalance, solRequestAirdrop, solSend, solSendAmt, solSendTo, solSending, 
    solStatus, solSweepAddFromBIP39, solSweepAddManualPK, solSweepAmtMode, solSweepDelayMs, 
    solSweepDestAddr, solSweepFetchBalances, solSweepFetchingBal, solSweepFixedAmt, solSweepLeaveBuf, 
    solSweepManualPK, solSweepRemoveSource, solSweepRun, solSweepRunning, solSweepSources, 
    solWalletSel, sunToTrx, sweepAddFromBIP39, sweepAddManualPK, sweepAdvanced, sweepAmtMode, 
    sweepDelayMs, sweepDestAddr, sweepFetchBalances, sweepFetchingBal, sweepFixedAmt, sweepLeaveGas, 
    sweepManualPK, sweepRemoveSource, sweepRun, sweepRunning, sweepSources, switchAtomNetwork, 
    switchAxmNetwork, switchSolNetwork, switchTronNetwork, trc20Tokens, tronAddress, tronAsset, 
    tronAssetBal, tronAssetBalLoading, tronBalance, tronConnect, tronConnected, tronConnecting, 
    tronDisconnect, tronFeeEstimate, tronFeeEstimateError, tronFeeEstimating, tronLoadingBal, tronMode, 
    tronMultiAddRow, tronMultiApplyEqual, tronMultiEqualAmt, tronMultiRemoveRow, tronMultiRows, 
    tronMultiRunning, tronMultiSend, tronMultiUpdateRow, tronNetId, tronNetwork, tronPrivKey, 
    tronRefreshBalance, tronRefreshResources, tronResources, tronResourcesLoading, tronSend, 
    tronSendAmt, tronSendTo, tronSending, tronStatus, tronSweepAddFromBIP39, tronSweepAddManualPK, 
    tronSweepAmtMode, tronSweepDestAddr, tronSweepFetchBalances, tronSweepFetchingBal, 
    tronSweepFixedAmt, tronSweepLeaveBuf, tronSweepManualPK, tronSweepRemoveSource, tronSweepRun, 
    tronSweepRunning, tronSweepSources, tronWalletSel, txAddress, txAsset, txBalance, txChain, 
    txConnect, txConnected, txConnecting, txDisconnect, txIsToken, txLoadingBal, txMaxLoading, txMode, 
    txMultiAddRow, txMultiApplyEqual, txMultiEqualAmt, txMultiRemoveRow, txMultiRows, txMultiRunning, 
    txMultiSend, txMultiUpdateRow, txNetworkId, txPrivKey, txRefreshBalance, txSend, txSendAmt, 
    txSendTo, txSending, txSetMaxAmount, txStatus, txStatusColor, txWalletSel, wallets
  } = ctx;

  return (
        <>
          {/* ── Ganti Network: EVM / Solana / Lainnya (Segera) ── */}
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
                const chainColor = opt.id === 'sol' ? '#9945FF' : opt.id === 'tron' ? '#EF0027' : opt.id === 'axm' ? '#75bbe9' : opt.id === 'gram' ? '#0088CC' : '#01a2ff';
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
          {/* ── Network Selector ── */}
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

              {/* ── Balance / Receive card ── */}
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
                  <FaQrcode size={11} color="#444"/>
                  <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {txAddress}
                  </code>
                  <button onClick={() => copyText(txAddress, 'tx_addr')}
                    style={{ background:'none', border:'1px solid #333', color:copiedKey==='tx_addr'?'#4caf50':'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                    {copiedKey==='tx_addr' ? <FaCheckCircle/> : <FaCopy/>}
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

              {/* ── Mode + Form card ── */}
              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>

                {/* Mode segmented control */}
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

                {/* ── Single Send ── */}
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

                    <button onClick={txSend} disabled={txSending || !txSendTo || !txSendAmt}
                      style={{ padding:'13px', background:txSending?'#1a1a2a':selectedNetwork?.color??'#01a2ff', color:'#000', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!txSendTo||!txSendAmt)?0.5:1 }}>
                      {txSending
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim...</>
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

                {/* ── Multi Send ── */}
                {txMode === 'multi' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    {/* Equal amount helper */}
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
                      disabled={txMultiRunning || txMultiRows.every(r => !r.to || !r.amount)}
                      style={{
                        padding:'13px', background:txMultiRunning?'#1a1a2a':'#01a2ff', color:'#000', border:'none',
                        cursor:txMultiRunning?'wait':'pointer', fontSize:'14px', fontWeight:'bold',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
                        opacity: txMultiRows.every(r=>!r.to||!r.amount) ? 0.5 : 1,
                      }}>
                      {txMultiRunning
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Mengirim {txMultiRows.filter(r=>r.status==='success').length}/{txMultiRows.filter(r=>ethers.utils.isAddress(r.to)&&parseFloat(r.amount)>0).length}...</>
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
                      disabled={sweepRunning || sweepSources.length === 0 || !ethers.utils.isAddress(sweepDestAddr)}
                      style={{
                        padding:'13px', fontWeight:'bold', fontSize:'14px', cursor:sweepRunning?'wait':'pointer',
                        background: sweepRunning ? '#001a00' : (sweepSources.length===0||!ethers.utils.isAddress(sweepDestAddr)) ? 'transparent' : '#00e676',
                        color: sweepRunning ? '#00e676' : '#000',
                        border:`1px solid ${sweepRunning?'#00e67644':'#00e676'}`,
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                        opacity: (sweepSources.length===0||!ethers.utils.isAddress(sweepDestAddr)) ? 0.4 : 1,
                        transition:'all 0.2s',
                      }}>
                      {sweepRunning
                        ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Sweeping {sweepSources.filter(s=>s.status==='success').length}/{sweepSources.length}...</>
                        : <><FaExchangeAlt/> Mulai Sweep {sweepSources.length} Wallet{txIsToken ? ` (${selectedTxToken!.symbol})` : ''}</>}
                    </button>
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
                      <FaQrcode size={11} color="#444"/>
                      <code style={{ flex:1, fontSize:'12px', color:'#a0d0ff', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {solAddress}
                      </code>
                      <button onClick={() => copyText(solAddress, 'sol_addr')}
                        style={{ background:'none', border:'1px solid #333', color:copiedKey==='sol_addr'?'#4caf50':'#555', padding:'4px 8px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}>
                        {copiedKey==='sol_addr' ? <FaCheckCircle/> : <FaCopy/>}
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
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'5px' }}>
                            Jumlah {solAsset === 'native' ? '(SOL)' : '(token)'}
                          </label>
                          <input type="number" placeholder="0.01" step="0.0001" min="0" value={solSendAmt}
                            onChange={e => setSolSendAmt(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px' }}/>
                        </div>
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
                            background: solSweepRunning ? '#001a00' : (solSweepSources.length===0||!solIsValidAddr(solSweepDestAddr)) ? 'transparent' : '#00e676',
                            color: solSweepRunning ? '#00e676' : '#000',
                            border:`1px solid ${solSweepRunning?'#00e67644':'#00e676'}`,
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                            opacity: (solSweepSources.length===0||!solIsValidAddr(solSweepDestAddr)) ? 0.4 : 1,
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
                                // ── Nama tampilan: pakai nama/simbol on-chain kalau ketemu, kalau nggak ada
                                //    metadata (token polos) jatuh ke label netral — bukan dibiarkan kosong. ──
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
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                        Jumlah ({tronAsset === 'native' ? 'TRX' : (trc20Tokens.find(t=>t.address===tronAsset)?.symbol || 'Token')})
                      </label>
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
                              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'6px', borderTop:'1px solid #1a1a1a' }}>
                                <span style={{ color:'#888' }}>Total biaya</span>
                                <span style={{ fontFamily:'monospace', fontWeight:'bold', color: tronFeeEstimate.coveredByFree ? '#4caf50' : '#ffaa00' }}>
                                  {tronFeeEstimate.coveredByFree ? 'Gratis (dicover kuota)' : `~${sunToTrx(tronFeeEstimate.feeSun)} TRX`}
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
                      </div>
                    </div>
                  </div>

                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim AXM</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="axm1..." value={axmSendTo} onChange={e => setAxmSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Jumlah (AXM)</label>
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
                        <button onClick={() => setQrAddress(gramAddress)} style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'8px 10px' }}>
                          <FaQrcode size={12}/>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Toggle: kirim TON native vs Jetton (token TON) ── */}
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
                  </div>

                  {gramSendMode === 'native' && (
                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim TON</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="UQ... / EQ..." value={gramSendTo} onChange={e => setGramSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <label style={{ fontSize:'11px', color:'#555' }}>Jumlah (TON)</label>
                        <button onClick={gramSetMaxAmount} disabled={gramMaxLoading || !gramConnected}
                          style={{ background:'none', border:'1px solid #333', color:gramMaxLoading?'#555':GRAM_NETWORK.color, padding:'2px 8px', cursor:(gramMaxLoading||!gramConnected)?'not-allowed':'pointer', fontSize:'10px', fontWeight:'bold', letterSpacing:'0.5px', opacity:!gramConnected?0.4:1 }}>
                          {gramMaxLoading ? <FaSpinner style={{ animation:'spin 1s linear infinite' }}/> : 'MAX'}
                        </button>
                      </div>
                      <input type="number" placeholder="0.0" value={gramSendAmt} onChange={e => setGramSendAmt(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'16px' }}/>

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
                            Estimasi fee: <span style={{ fontFamily:'monospace', color:'#888' }}>~{gramFeeEstimate.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} TON</span>
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
                          : <><FaPaperPlane/> Kirim TON</>}
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
                        <button onClick={gramLoadDetectedJettons} disabled={gramJettonDetectedLoading}
                          style={{ background:'none', border:'1px solid #333', color:'#888', padding:'5px 10px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                          <FaSync size={10} style={{ animation:gramJettonDetectedLoading?'spin 1s linear infinite':undefined }}/> Muat Jetton Saya
                        </button>
                      </div>

                      {gramJettonDetected.length > 0 && (
                        <div style={{ marginBottom:'12px' }}>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Jetton yang Dipegang</label>
                          <select value={gramJettonDetected.some(t => t.address === gramJettonMaster) ? gramJettonMaster : ''}
                            onChange={e => gramSelectJetton(e.target.value)}
                            style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                            <option value="">-- Pilih dari daftar, atau tempel address manual di bawah --</option>
                            {gramJettonDetected.map(t => (
                              <option key={t.address} value={t.address}>
                                {t.symbol} · {t.balanceFormatted} · {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {!gramJettonDetectedLoading && gramJettonDetected.length === 0 && (
                        <p style={{ fontSize:'10px', color:'#444', margin:'0 0 12px' }}>
                          Tidak ada Jetton terdeteksi otomatis di address ini (atau belum dimuat) — bisa tetap kirim dengan tempel address kontraknya manual di bawah.
                        </p>
                      )}

                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Kontrak Jetton</label>
                      <input placeholder="EQ... / UQ... (jetton master)" value={gramJettonMaster}
                        onChange={e => setGramJettonMaster(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'8px' }}/>

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
                            Estimasi fee: <span style={{ fontFamily:'monospace', color:'#888' }}>~{gramJettonFeeEstimate.totalFeeGram.toLocaleString('en-US', { maximumFractionDigits: 6 })} TON</span>
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
                      </div>
                    </div>
                  </div>

                  <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                    <h3 style={{ fontSize:'13px', marginBottom:'14px' }}><FaPaperPlane style={{ marginRight:'6px' }}/>Kirim ATOM</h3>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Address Tujuan</label>
                      <input placeholder="cosmos1..." value={atomSendTo} onChange={e => setAtomSendTo(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'12px' }}/>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Jumlah (ATOM)</label>
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
        </>
  );
}