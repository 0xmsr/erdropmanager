// @ts-nocheck
// Semua state & handler di file ini datang dari ctx (Record<string, any>) yang
// diteruskan dari Walletgenerator.tsx, jadi TypeScript tidak bisa menurunkan
// tipe parameter callback (.map/.filter/dst) di sini secara otomatis.
// Type-safety sesungguhnya tetap ada penuh di state/handler aslinya
// (Walletgenerator.tsx) dan di ./types.ts — file ini murni JSX passthrough.

import React from 'react';
import type { WalletGeneratorCtx } from './types';
import { GRAM_WALLET_VERSIONS } from './network/Gramnet';

/**
 * TokenTab: dipecah dari Walletgenerator.tsx (tab "TokenTab").
 * Semua state, handler, dan helper dari komponen induk diteruskan lewat prop `ctx`
 * (lihat WalletGeneratorCtx di ../types.ts) supaya logic tetap terpusat di
 * Walletgenerator.tsx tanpa perlu re-wiring ratusan handler satu per satu.
 */
export function TokenTab({ ctx }: { ctx: WalletGeneratorCtx }) {
  const {
    FaCheckCircle, FaCode, FaCoins, FaCopy, FaFileCode, FaGasPump, FaGlobe, FaHashtag, FaInfoCircle, 
    FaKey, FaLink, FaList, FaRocket, FaSpinner, FaSync, FaTerminal, FaTrash, FaUpload, 
    LAMPORTS_PER_SOL, SOLANA_NETWORKS, TRON_NETWORKS, activeTab, compileTcCustomContract, copiedKey, 
    copyText, createSplToken, deleteErc20Token, deleteSplToken, deployErc20Token, deployTrc20Token, 
    erc20Tokens, estimateTcEvmGas, estimateTcSolFee, estimateTcTronFee, handleTcSolImageFile, 
    handleTcSolWalletSel, handleTcTronWalletSel, handleTcWalletSel, networks, refreshPendingTrc20, 
    setTcChain, setTcCompileError, setTcCompiled, setTcCustomCtorArgs, setTcCustomSolidity, 
    setTcDecimals, setTcEvmMode, setTcName, setTcNetworkId, setTcPrivKey, setTcSolAddMeta, 
    setTcSolDecimals, setTcSolDescription, setTcSolImageUrl, setTcSolName, setTcSolNetId, 
    setTcSolPinataJwt, setTcSolPrivKey, setTcSolSupply, setTcSolSymbol, setTcSupply, setTcSymbol, 
    setTcTronDecimals, setTcTronName, setTcTronNetId, setTcTronPrivKey, setTcTronSupply, 
    setTcTronSymbol, setTcTronWalletSel, splTokens, sunToTrx, tcChain, tcCompileError, tcCompiled, 
    tcCompiling, tcCustomCtorArgs, tcCustomSolidity, tcDecimals, tcDeployStatus, tcDeploying, 
    tcEvmMode, tcGasError, tcGasFeeNative, tcGasLimitEst, tcGasLoading, tcGasPriceGwei, tcName, 
    tcNetworkId, tcPrivKey, tcSelectedNetwork, tcSolAddMeta, tcSolCreating, tcSolDecimals, 
    tcSolDescription, tcSolFeeDetail, tcSolFeeError, tcSolFeeLoading, tcSolFeeSol, tcSolImageUploading, 
    tcSolImageUrl, tcSolMetaPreview, tcSolName, tcSolNetId, tcSolPinataJwt, tcSolPrivKey, 
    tcSolStandard, tcSolStatus, tcSolSupply, tcSolSymbol, tcSolWalletSel, tcSupply, tcSymbol, 
    tcTronCreating, tcTronDecimals, tcTronFeeError, tcTronFeeEstimate, tcTronFeeLoading, tcTronName, 
    tcTronNetId, tcTronPrivKey, tcTronRefreshing, tcTronStatus, tcTronSupply, tcTronSymbol, 
    tcTronWalletSel, tcWalletSel, trc20Tokens, wallets,
    GRAM_NETWORKS, GRAM_JETTON_DEPLOY_VALUE, gramTokens, deleteGramToken, createGramJetton, estimateTcGramFee,
    tcGramNetId, setTcGramNetId, tcGramVersion, setTcGramVersion, tcGramWalletSel, handleTcGramWalletSel,
    tcGramPrivKey, setTcGramPrivKey, tcGramName, setTcGramName, tcGramSymbol, setTcGramSymbol,
    tcGramDecimals, setTcGramDecimals, tcGramSupply, setTcGramSupply, tcGramDescription, setTcGramDescription,
    tcGramImageUrl, setTcGramImageUrl, handleTcGramImageFile, tcGramImageUploading, tcGramCreating, tcGramStatus,
    tcGramFeeGram, tcGramFeeDetail, tcGramFeeLoading, tcGramFeeError, tcGramSelectedNetwork, tcGramMetaPreview,
  } = ctx;

  return (
        <>
          {/* ── Pilih Chain: EVM (ERC-20) / Solana (SPL Token) ── */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'8px' }}>
              <FaCoins style={{ marginRight:'5px' }}/>Buat Token Baru
            </label>
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => setTcChain('evm')} style={{
                background: tcChain === 'evm' ? '#01a2ff' : 'none',
                color: tcChain === 'evm' ? '#000' : '#888',
                border: `1px solid ${tcChain === 'evm' ? '#01a2ff' : '#333'}`,
                padding:'8px 16px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
              }}>ERC-20 (EVM)</button>
              <button onClick={() => setTcChain('sol')} style={{
                background: tcChain === 'sol' ? '#9945FF' : 'none',
                color: tcChain === 'sol' ? '#000' : '#888',
                border: `1px solid ${tcChain === 'sol' ? '#9945FF' : '#333'}`,
                padding:'8px 16px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
              }}>SPL Token (Solana)</button>
              <button onClick={() => setTcChain('tron')} style={{
                background: tcChain === 'tron' ? '#EF0027' : 'none',
                color: tcChain === 'tron' ? '#fff' : '#888',
                border: `1px solid ${tcChain === 'tron' ? '#EF0027' : '#333'}`,
                padding:'8px 16px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
              }}>TRC-20 (Tron)</button>
              <button onClick={() => setTcChain('gram')} style={{
                background: tcChain === 'gram' ? '#0098EA' : 'none',
                color: tcChain === 'gram' ? '#000' : '#888',
                border: `1px solid ${tcChain === 'gram' ? '#0098EA' : '#333'}`,
                padding:'8px 16px', fontSize:'11px', fontWeight:'bold', cursor:'pointer',
              }}>Jetton (Gram/TON)</button>
            </div>
          </div>

          {/* ══════════ ERC-20 ══════════ */}
          {tcChain === 'evm' && (
            <>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'6px' }}>
                  <FaGlobe style={{ marginRight:'4px' }}/>Network Deploy
                </label>
                <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                  <select value={tcNetworkId} onChange={e => setTcNetworkId(e.target.value)}
                    style={{ flex:'1 1 260px', fontFamily:'monospace', fontSize:'13px', padding:'10px 12px' }}>
                    {networks.map(n => (
                      <option key={n.id} value={n.id}>{n.name} · {n.symbol} · Chain {n.chainId}</option>
                    ))}
                  </select>
                  {tcSelectedNetwork && (
                    <span style={{ fontSize:'11px', color:'#555', fontFamily:'monospace', whiteSpace:'nowrap' }}>Chain {tcSelectedNetwork.chainId}</span>
                  )}
                </div>
                <p style={{ fontSize:'11px', color:'#444', marginTop:'6px' }}>
                  <FaInfoCircle style={{ marginRight:'4px' }}/>
                  Disarankan coba di testnet dulu (Sepolia / Holesky / BNB Testnet) sebelum deploy ke mainnet.
                </p>
              </div>

              <div style={{ marginBottom:'16px', display:'flex', gap:'8px' }}>
                <button onClick={() => setTcEvmMode('template')}
                  style={{ flex:1, padding:'10px', fontSize:'12px', cursor:'pointer',
                    background: tcEvmMode === 'template' ? '#01a2ff' : 'none',
                    color: tcEvmMode === 'template' ? '#000' : '#888',
                    border: `1px solid ${tcEvmMode === 'template' ? '#01a2ff' : '#333'}` }}>
                  <FaFileCode style={{ marginRight:'6px' }}/>Template Bawaan
                </button>
                <button onClick={() => setTcEvmMode('custom')}
                  style={{ flex:1, padding:'10px', fontSize:'12px', cursor:'pointer',
                    background: tcEvmMode === 'custom' ? '#01a2ff' : 'none',
                    color: tcEvmMode === 'custom' ? '#000' : '#888',
                    border: `1px solid ${tcEvmMode === 'custom' ? '#01a2ff' : '#333'}` }}>
                  <FaCode style={{ marginRight:'6px' }}/>Kode Solidity Kustom
                </button>
              </div>

              <div className="form-container" style={{ maxWidth:'520px', margin:'0 auto 24px' }}>
                <h2 style={{ textAlign:'center', marginBottom:'16px', fontSize:'15px' }}>
                  <FaRocket style={{ marginRight:'8px' }}/>{tcEvmMode === 'custom' ? 'Deploy Kontrak Kustom' : 'Deploy Token ERC-20'}
                </h2>

                {wallets.length > 0 && (
                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Deployer (dari BIP39 tersimpan)</label>
                    <select value={tcWalletSel} onChange={e => handleTcWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
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
                  <FaKey style={{ marginRight:'4px' }}/>Private Key Deployer
                </label>
                <input type="password" placeholder="0x..." value={tcPrivKey} onChange={e => setTcPrivKey(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', marginBottom:'14px' }}/>

                {tcEvmMode === 'template' && (
                <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Nama Token</label>
                    <input placeholder="misal: My Awesome Token" value={tcName} onChange={e => setTcName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Symbol</label>
                    <input placeholder="misal: MAT" value={tcSymbol} onChange={e => setTcSymbol(e.target.value.toUpperCase())} style={{ textTransform:'uppercase' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Decimals</label>
                    <input type="number" min={0} max={18} placeholder="18" value={tcDecimals} onChange={e => setTcDecimals(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Total Supply</label>
                    <input type="number" min={1} placeholder="1000000" value={tcSupply} onChange={e => setTcSupply(e.target.value)} />
                  </div>
                </div>

                <p style={{ fontSize:'11px', color:'#444', margin:'4px 0 14px' }}>
                  Seluruh total supply akan di-mint ke address deployer saat kontrak dideploy. Kontrak
                  mendukung <code>mint</code> tambahan (owner-only), <code>burn</code>, dan transfer ownership.
                </p>
                </>
                )}

                {tcEvmMode === 'custom' && (
                <>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                    <FaFileCode style={{ marginRight:'4px' }}/>Kode Solidity (.sol) — 1 file, tanpa import eksternal
                  </label>
                  <textarea
                    value={tcCustomSolidity}
                    onChange={e => { setTcCustomSolidity(e.target.value); setTcCompiled(null); setTcCompileError(''); }}
                    placeholder={'// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n\ncontract MyToken {\n  string public name = "My Token";\n  string public symbol = "MTK";\n  ...\n}'}
                    rows={12}
                    style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px', background:'#0a0a0a', color:'#ccc', border:'1px solid #262626', padding:'10px', resize:'vertical', marginBottom:'8px' }}
                  />
                  <p style={{ fontSize:'10px', color:'#555', margin:'0 0 12px' }}>
                    Kode harus 1 file mandiri (semua kode ditulis langsung di sini, tidak ada <code>import</code> ke file lain).
                    Kompilasi berjalan di browser via <code>solc</code> — kontrak kompleks bisa makan waktu beberapa detik.
                  </p>

                  <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
                    <button onClick={compileTcCustomContract} disabled={tcCompiling || !tcCustomSolidity.trim()}
                      className="btn-manage" style={{ flex:'1 1 160px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: tcCompiling ? 0.6 : 1 }}>
                      {tcCompiling ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Compiling... (percobaan pertama unduh compiler ~10-15MB dari CDN, bisa beberapa detik)</> : <><FaTerminal/> Compile</>}
                    </button>
                  </div>

                  {tcCompileError && (
                    <div style={{ marginBottom:'12px', padding:'10px 12px', fontSize:'11px', color:'#ff6666', border:'1px solid #f4433644', borderLeft:'3px solid #f44336', whiteSpace:'pre-wrap', fontFamily:'monospace' }}>
                      {tcCompileError}
                    </div>
                  )}
                  {tcCompiled && (
                    <div style={{ marginBottom:'12px', padding:'10px 12px', fontSize:'11px', color:'#4caf50', border:'1px solid #4caf5044', borderLeft:'3px solid #4caf50' }}>
                      <FaCheckCircle style={{ marginRight:'6px' }}/>Compile OK — contract <code>{tcCompiled.contractName}</code>
                      {' · '}{tcCompiled.abi.filter((f:any)=>f.type==='function').length} function
                      {tcCompiled.warnings.length > 0 && <div style={{ color:'#F1C40F', marginTop:'4px' }}>{tcCompiled.warnings.length} warning compiler (non-fatal)</div>}
                    </div>
                  )}

                  {tcCompiled && (
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                        Constructor Arguments (JSON array{tcCompiled.abi.find((f:any)=>f.type==='constructor')?.inputs?.length ? `, ${tcCompiled.abi.find((f:any)=>f.type==='constructor').inputs.map((i:any)=>i.name||i.type).join(', ')}` : ' — constructor tanpa argumen'})
                      </label>
                      <input placeholder='["MyToken","MTK",18,"1000000000000000000000000"]' value={tcCustomCtorArgs} onChange={e => setTcCustomCtorArgs(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px' }}/>
                    </div>
                  )}

                  <p style={{ fontSize:'11px', color:'#444', margin:'4px 0 14px' }}>
                    <FaInfoCircle style={{ marginRight:'4px' }}/>
                    Wajib compile dulu sebelum tombol deploy aktif. Tetap review kode sendiri sebelum deploy
                    ke mainnet, apalagi kalau kontrak akan memegang dana orang lain.
                  </p>
                </>
                )}

                {/* ── Estimasi Gas ── */}
                <div style={{ margin:'4px 0 16px', padding:'12px 14px', background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #F1C40F' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                    <span style={{ fontSize:'11px', color:'#888', display:'flex', alignItems:'center', gap:'6px' }}>
                      <FaGasPump size={11}/> Estimasi Gas Deploy
                    </span>
                    <button onClick={estimateTcEvmGas} disabled={tcGasLoading || (tcEvmMode === 'custom' && !tcCompiled)}
                      style={{ fontSize:'11px', color:'#F1C40F', background:'none', border:'1px solid #F1C40F55', padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', opacity:(tcEvmMode === 'custom' && !tcCompiled) ? 0.5 : 1 }}>
                      {tcGasLoading ? <><FaSpinner size={10} style={{ animation:'spin 1s linear infinite' }}/> Menghitung...</> : <><FaSync size={10}/> Cek Estimasi Gas</>}
                    </button>
                  </div>
                  {tcGasError && (
                    <div style={{ marginTop:'8px', fontSize:'11px', color:'#ff6666' }}>{tcGasError}</div>
                  )}
                  {tcGasPriceGwei !== null && !tcGasError && (
                    <div style={{ marginTop:'10px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px,1fr))', gap:'10px' }}>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Gas Price</div>
                        <div style={{ fontSize:'13px', color:'#ccc', fontFamily:'monospace' }}>{tcGasPriceGwei.toFixed(4)} Gwei</div>
                      </div>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Estimasi Gas Limit</div>
                        <div style={{ fontSize:'13px', color:'#ccc', fontFamily:'monospace' }}>{parseInt(tcGasLimitEst || '0').toLocaleString('en-US')}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Estimasi Total Fee</div>
                        <div style={{ fontSize:'14px', color:'#F1C40F', fontFamily:'monospace', fontWeight:'bold' }}>≈ {tcGasFeeNative} {tcSelectedNetwork?.symbol}</div>
                      </div>
                    </div>
                  )}
                  {tcGasPriceGwei === null && !tcGasError && (
                    <p style={{ fontSize:'10px', color:'#444', margin:'8px 0 0' }}>
                      Klik "Cek Estimasi Gas" untuk lihat perkiraan biaya deploy sebelum submit — gas price diambil live dari RPC {tcSelectedNetwork?.name}, gas limit dari <code>estimateGas</code> transaksi deploy sesungguhnya (sudah dengan buffer 15%).
                    </p>
                  )}
                </div>

                {tcDeployStatus.type !== 'idle' && (
                  <div style={{
                    marginBottom:'14px', padding:'10px 12px', fontSize:'12px',
                    border: `1px solid ${{pending:'#ffaa0044',success:'#4caf5044',error:'#f4433644',idle:'#33333344'}[tcDeployStatus.type]}`,
                    borderLeft: `3px solid ${{pending:'#ffaa00',success:'#4caf50',error:'#f44336',idle:'#555'}[tcDeployStatus.type]}`,
                    color: {pending:'#ffcc44',success:'#4caf50',error:'#ff6666',idle:'#888'}[tcDeployStatus.type],
                    wordBreak:'break-all',
                  }}>
                    {tcDeployStatus.type === 'pending' && <FaSpinner style={{ marginRight:'6px', animation:'spin 1s linear infinite' }}/>}
                    {tcDeployStatus.msg}
                  </div>
                )}

                <button onClick={deployErc20Token}
                  disabled={tcDeploying || (tcEvmMode === 'custom' && !tcCompiled)}
                  className="btn-manage btn-import"
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: tcDeploying ? 0.6 : 1 }}>
                  {tcDeploying ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Deploying...</> : <><FaRocket/> {tcEvmMode === 'custom' ? 'Deploy Kontrak' : 'Deploy Token'}</>}
                </button>
              </div>

              {erc20Tokens.length > 0 && (
                <div style={{ marginBottom:'20px' }}>
                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#01a2ff', marginBottom:'10px' }}>
                    <FaList style={{ marginRight:'6px' }}/>Token yang Sudah Dideploy ({erc20Tokens.length})
                  </h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'12px' }}>
                    {erc20Tokens.map(t => {
                      const net = networks.find(n => n.id === t.networkId);
                      return (
                        <div key={t.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid #01a2ff`, padding:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <div>
                              <div style={{ fontWeight:'bold', fontSize:'13px' }}>{t.name} <span style={{ color:'#555' }}>({t.symbol})</span></div>
                              <div style={{ fontSize:'10px', color:'#444', marginTop:'2px' }}>{t.networkName} · {t.decimals} dec · supply {Number(t.initialSupply).toLocaleString()}</div>
                            </div>
                            <button onClick={() => deleteErc20Token(t.id)} title="Hapus catatan"
                              style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'4px 7px', cursor:'pointer', fontSize:'11px' }}><FaTrash/></button>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <code style={{ flex:1, fontSize:'10px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'5px 8px', border:'1px solid #141414' }}>
                              {t.address}
                            </code>
                            <button onClick={() => copyText(t.address, `erc20_${t.id}`)} title="Salin address"
                              style={{ background:'none', border:'none', color:copiedKey===`erc20_${t.id}`?'#4caf50':'#333', cursor:'pointer', padding:'3px', flexShrink:0 }}>
                              {copiedKey===`erc20_${t.id}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                            </button>
                          </div>
                          {net?.explorerUrl && (
                            <a href={`${net.explorerUrl}/address/${t.address}`} target="_blank" rel="noreferrer"
                              style={{ fontSize:'11px', color:'#01a2ff', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                              <FaLink size={10}/> Lihat di Explorer
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════════ SPL TOKEN ══════════ */}
          {tcChain === 'sol' && (
            <>
              <div className="form-container" style={{ maxWidth:'520px', margin:'16px auto 24px' }}>
                <h2 style={{ textAlign:'center', marginBottom:'16px', fontSize:'15px' }}>
                  <FaRocket style={{ marginRight:'8px' }}/>Buat SPL Token
                </h2>

                <div style={{ marginBottom:'14px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                  <select value={tcSolNetId} onChange={e => setTcSolNetId(e.target.value)}
                    style={{ flex:'1 1 200px', fontFamily:'monospace', fontSize:'12px', padding:'8px 10px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                    {SOLANA_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                  </select>
                  {tcSolNetId !== 'mainnet' && (
                    <span style={{ fontSize:'10px', color:'#F1C40F', border:'1px solid #4a3f10', background:'#1a1608', padding:'4px 8px', whiteSpace:'nowrap' }}>
                      ⚠ Jaringan TEST — token dibuat di {SOLANA_NETWORKS.find(n => n.id === tcSolNetId)?.name}, tidak muncul di mainnet
                    </span>
                  )}
                </div>

                {wallets.length > 0 && (
                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Solana (dari BIP39 tersimpan)</label>
                    <select value={tcSolWalletSel} onChange={e => handleTcSolWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                      <option value="">-- Pilih address --</option>
                      {wallets.flatMap((w, wi) =>
                        (w.solAddresses || []).map(a => (
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
                <input type="password" placeholder="Private key Solana (base58)" value={tcSolPrivKey} onChange={e => setTcSolPrivKey(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', marginBottom:'14px' }}/>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Nama Token</label>
                    <input placeholder="misal: My Solana Token" value={tcSolName} onChange={e => setTcSolName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Symbol</label>
                    <input placeholder="misal: MST" value={tcSolSymbol} onChange={e => setTcSolSymbol(e.target.value.toUpperCase())} style={{ textTransform:'uppercase' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Decimals (0–9)</label>
                    <input type="number" min={0} max={9} placeholder="9" value={tcSolDecimals} onChange={e => setTcSolDecimals(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Total Supply</label>
                    <input type="number" min={1} placeholder="1000000" value={tcSolSupply} onChange={e => setTcSolSupply(e.target.value)} />
                  </div>
                </div>

                <div style={{ margin:'14px 0', padding:'12px', background:'#0d0d0d', border:'1px solid #1e1e1e' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#ccc', cursor:'pointer', marginBottom: tcSolAddMeta ? '12px' : 0 }}>
                    <input type="checkbox" checked={tcSolAddMeta} onChange={e => setTcSolAddMeta(e.target.checked)} />
                    <FaHashtag size={11}/> Sertakan Metadata On-chain (Metaplex)
                  </label>

                  {tcSolAddMeta && (
                    <>
                      <p style={{ fontSize:'10px', color:'#555', margin:'0 0 12px' }}>
                        Isi form di bawah. Saat token dibuat, data ini dirangkai jadi JSON lalu di-upload ke{' '}
                        <strong style={{ color:'#888' }}>IPFS lewat Pinata</strong> — link gateway https://-nya (bukan base64
                        data URI) yang dipakai sebagai <code>uri</code> on-chain, supaya explorer/wallet (Solscan, Solana
                        Explorer, Phantom, dst) bisa benar-benar menampilkan logo & deskripsi token ini.
                      </p>

                      <div style={{ marginBottom:'12px' }}>
                        <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                          Pinata JWT API Key <span style={{ color:'#444' }}>(gratis — daftar &amp; buat di app.pinata.cloud/keys)</span>
                        </label>
                        <input type="password" placeholder="eyJhbGciOi..." value={tcSolPinataJwt}
                          onChange={e => setTcSolPinataJwt(e.target.value)}
                          style={{ width:'100%', boxSizing:'border-box' }}/>
                        <p style={{ fontSize:'10px', color:'#555', margin:'6px 0 0' }}>
                          Disimpan lokal di browser kamu saja, dipakai buat upload gambar & JSON metadata ke IPFS.
                        </p>
                        <p style={{ fontSize:'10px', color:'#555', margin:'6px 0 0' }}>
                          <strong style={{ color:'#888' }}>Cara buat key-nya:</strong> di app.pinata.cloud/keys klik{' '}
                          <strong>New Key</strong>, lalu nyalain toggle <strong>Admin</strong> (paling gampang) — atau kalau
                          mau lebih terbatas, cukup centang scope <strong>pinFileToIPFS</strong> dan{' '}
                          <strong>pinJSONToIPFS</strong> di bagian Pinning. Copy yang <strong>JWT</strong>-nya (bukan
                          API Key/Secret biasa), lalu tempel di kolom di atas.
                        </p>
                        <p style={{ fontSize:'10px', color:'#f4a300', margin:'6px 0 0' }}>
                          ⚠ Kalau lupa centang scope-nya, upload akan gagal dengan error 403 "NO_SCOPES_FOUND" — key-nya
                          valid tapi nggak punya izin nge-pin file/JSON.
                        </p>
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Image URL (opsional)</label>
                          <input placeholder="https://.../logo.png" value={tcSolImageUrl}
                            onChange={e => setTcSolImageUrl(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box' }}/>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'6px' }}>
                            <label className="btn-manage" style={{ fontSize:'10px', padding:'4px 8px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'6px', opacity: tcSolImageUploading ? 0.6 : 1, pointerEvents: tcSolImageUploading ? 'none' : 'auto' }}>
                              <FaUpload size={10}/> {tcSolImageUploading ? 'Meng-upload ke IPFS...' : 'Upload dari file'}
                              <input type="file" accept="image/*" onChange={handleTcSolImageFile} style={{ display:'none' }} disabled={tcSolImageUploading}/>
                            </label>
                            {tcSolImageUrl.trim() && (
                              <button type="button" onClick={() => setTcSolImageUrl('')}
                                style={{ fontSize:'10px', color:'#f44336', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                                Hapus
                              </button>
                            )}
                          </div>
                          <p style={{ fontSize:'10px', color:'#555', margin:'6px 0 0' }}>
                            Isi salah satu: tempel link URL gambar yang sudah di-hosting, atau upload file dari komputer/HP
                            (otomatis diupload ke IPFS lewat Pinata — butuh JWT API Key di atas).
                          </p>
                        </div>
                        <div>
                          <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Deskripsi (opsional)</label>
                          <input placeholder="Deskripsi singkat token" value={tcSolDescription} onChange={e => setTcSolDescription(e.target.value)}
                            style={{ width:'100%', boxSizing:'border-box' }}/>
                        </div>
                      </div>

                      {tcSolImageUrl.trim() && (
                        <div style={{ marginTop:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
                          <img src={tcSolImageUrl.trim()} alt="preview logo token"
                            style={{ width:'36px', height:'36px', borderRadius:'50%', objectFit:'cover', border:'1px solid #262626' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                          <span style={{ fontSize:'10px', color:'#555' }}>Pratinjau logo</span>
                        </div>
                      )}

                      <div style={{ marginTop:'12px' }}>
                        <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                          Preview JSON metadata (akan di-upload ke IPFS saat token dibuat)
                        </label>
                        <pre style={{
                          margin:0, padding:'8px 10px', background:'#000', border:'1px solid #1e1e1e',
                          fontSize:'11px', color:'#8bc34a', whiteSpace:'pre-wrap', wordBreak:'break-all',
                        }}>
                          {JSON.stringify(tcSolMetaPreview.json, null, 2)}
                        </pre>
                      </div>
                    </>
                  )}
                </div>

                <p style={{ fontSize:'11px', color:'#444', margin:'4px 0 14px' }}>
                  <FaInfoCircle style={{ marginRight:'4px' }}/>
                  Membuat mint account SPL Token baru + associated token account, lalu mint seluruh total
                  supply ke wallet ini.{' '}
                  {tcSolAddMeta
                    ? 'Metadata (nama, symbol, URI) akan ditulis on-chain lewat Metaplex Token Metadata Program, jadi wallet/explorer lain (Phantom, Solscan, dll) bisa menampilkan nama & logo token dengan benar.'
                    : 'Metadata on-chain dimatikan — nama/symbol hanya tersimpan lokal di daftar bawah, wallet lain mungkin menampilkan token ini sebagai "Unknown Token".'}
                </p>

                {/* ── Estimasi Gas / Biaya ── */}
                <div style={{ margin:'4px 0 16px', padding:'12px 14px', background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:'3px solid #9945FF' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                    <span style={{ fontSize:'11px', color:'#888', display:'flex', alignItems:'center', gap:'6px' }}>
                      <FaGasPump size={11}/> Estimasi Biaya Buat Token
                    </span>
                    <button onClick={estimateTcSolFee} disabled={tcSolFeeLoading}
                      style={{ fontSize:'11px', color:'#9945FF', background:'none', border:'1px solid #9945FF55', padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                      {tcSolFeeLoading ? <><FaSpinner size={10} style={{ animation:'spin 1s linear infinite' }}/> Menghitung...</> : <><FaSync size={10}/> Cek Estimasi Biaya</>}
                    </button>
                  </div>
                  {tcSolFeeError && (
                    <div style={{ marginTop:'8px', fontSize:'11px', color:'#ff6666' }}>{tcSolFeeError}</div>
                  )}
                  {tcSolFeeDetail && !tcSolFeeError && (
                    <>
                      <div style={{ marginTop:'10px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:'10px' }}>
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Rent Mint Account</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>{(tcSolFeeDetail.mintRent / LAMPORTS_PER_SOL).toFixed(6)} SOL</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Rent Token Account</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>{(tcSolFeeDetail.ataRent / LAMPORTS_PER_SOL).toFixed(6)} SOL</div>
                        </div>
                        {tcSolFeeDetail.metadataRent > 0 && (
                          <div>
                            <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Rent Metadata (Metaplex)</div>
                            <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>≈ {(tcSolFeeDetail.metadataRent / LAMPORTS_PER_SOL).toFixed(6)} SOL</div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Network Fee (2 signature)</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>{(tcSolFeeDetail.networkFee / LAMPORTS_PER_SOL).toFixed(6)} SOL</div>
                        </div>
                      </div>
                      <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #1e1e1e' }}>
                        <span style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Estimasi Total</span>
                        <div style={{ fontSize:'14px', color:'#9945FF', fontFamily:'monospace', fontWeight:'bold' }}>≈ {tcSolFeeSol} SOL</div>
                      </div>
                    </>
                  )}
                  {!tcSolFeeDetail && !tcSolFeeError && (
                    <p style={{ fontSize:'10px', color:'#444', margin:'8px 0 0' }}>
                      Sebagian besar biaya di Solana adalah rent (deposit yang balik lagi kalau akun ditutup), bukan "gas" yang hangus — klik "Cek Estimasi Biaya" untuk rinciannya sebelum submit.
                      {tcSolStandard === 'classic' && tcSolAddMeta && ' Rent akun Metadata Metaplex di sini adalah perkiraan; nilai persisnya dihitung otomatis on-chain saat instruksi dieksekusi.'}
                    </p>
                  )}
                </div>

                {tcSolStatus.type !== 'idle' && (
                  <div style={{
                    marginBottom:'14px', padding:'10px 12px', fontSize:'12px',
                    border: `1px solid ${{pending:'#ffaa0044',success:'#4caf5044',error:'#f4433644',idle:'#33333344'}[tcSolStatus.type]}`,
                    borderLeft: `3px solid ${{pending:'#ffaa00',success:'#4caf50',error:'#f44336',idle:'#555'}[tcSolStatus.type]}`,
                    color: {pending:'#ffcc44',success:'#4caf50',error:'#ff6666',idle:'#888'}[tcSolStatus.type],
                    wordBreak:'break-all',
                  }}>
                    {tcSolStatus.type === 'pending' && <FaSpinner style={{ marginRight:'6px', animation:'spin 1s linear infinite' }}/>}
                    {tcSolStatus.msg}
                  </div>
                )}

                <button onClick={createSplToken} disabled={tcSolCreating} className="btn-manage btn-import"
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: tcSolCreating ? 0.6 : 1 }}>
                  {tcSolCreating ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Membuat Token...</> : <><FaHashtag/> Buat SPL Token</>}
                </button>
              </div>

              {splTokens.length > 0 && (
                <div style={{ marginBottom:'20px' }}>
                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#9945FF', marginBottom:'10px' }}>
                    <FaList style={{ marginRight:'6px' }}/>SPL Token yang Sudah Dibuat ({splTokens.length})
                  </h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'12px' }}>
                    {splTokens.map(t => {
                      const tNet = SOLANA_NETWORKS.find(n => n.id === t.networkId) ?? SOLANA_NETWORKS[0];
                      return (
                      <div key={t.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid #9945FF`, padding:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            {t.imageUrl && (
                              <img src={t.imageUrl} alt={t.symbol}
                                style={{ width:'28px', height:'28px', borderRadius:'50%', objectFit:'cover', border:'1px solid #262626', flexShrink:0 }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                            )}
                            <div>
                              <div style={{ fontWeight:'bold', fontSize:'13px' }}>{t.name} <span style={{ color:'#555' }}>({t.symbol})</span></div>
                              <div style={{ fontSize:'10px', color:'#444', marginTop:'2px' }}>
                                {t.networkName || 'Solana Mainnet'}
                                {tNet.id !== 'mainnet' && <span style={{ color:'#F1C40F' }}> (TEST)</span>}
                                {' · '}{t.decimals} dec · supply {Number(t.initialSupply).toLocaleString()}
                              </div>
                              {t.description && (
                                <div style={{ fontSize:'10px', color:'#555', marginTop:'3px' }}>{t.description}</div>
                              )}
                            </div>
                          </div>
                          <button onClick={() => deleteSplToken(t.id)} title="Hapus catatan"
                            style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'4px 7px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}><FaTrash/></button>
                        </div>

                        {t.hasMetadata ? (
                          <span style={{ alignSelf:'flex-start', fontSize:'9px', color:'#4caf50', border:'1px solid #1c3a1c', background:'#0e1a0e', padding:'2px 7px', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaCheckCircle size={9}/> Metadata on-chain (Metaplex)
                          </span>
                        ) : (
                          <span style={{ alignSelf:'flex-start', fontSize:'9px', color:'#888', border:'1px solid #2a2a2a', background:'#111', padding:'2px 7px' }}>
                            Tanpa metadata on-chain
                          </span>
                        )}

                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <code style={{ flex:1, fontSize:'10px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'5px 8px', border:'1px solid #141414' }}>
                            {t.mint}
                          </code>
                          <button onClick={() => copyText(t.mint, `spl_${t.id}`)} title="Salin mint address"
                            style={{ background:'none', border:'none', color:copiedKey===`spl_${t.id}`?'#4caf50':'#333', cursor:'pointer', padding:'3px', flexShrink:0 }}>
                            {copiedKey===`spl_${t.id}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                          </button>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                          <a href={`${tNet.explorerUrl}/token/${t.mint}${tNet.clusterParam}`} target="_blank" rel="noreferrer"
                            style={{ fontSize:'11px', color:'#9945FF', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaLink size={10}/> Lihat di Solscan
                          </a>
                          {t.metadataUri && (
                            <a href={t.metadataUri} target="_blank" rel="noreferrer"
                              style={{ fontSize:'11px', color:'#555', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                              <FaLink size={10}/> Lihat JSON Metadata
                            </a>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {tcChain === 'tron' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderTop:'2px solid #EF0027', padding:'20px' }}>
                <h3 style={{ fontSize:'13px', marginBottom:'16px' }}><FaCoins style={{ marginRight:'6px' }}/>Deploy Token TRC-20</h3>

                <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Network</label>
                <select value={tcTronNetId} onChange={e => setTcTronNetId(e.target.value)}
                  style={{ width:'100%', fontFamily:'monospace', fontSize:'13px', marginBottom:'14px' }}>
                  {TRON_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                </select>
                {!(TRON_NETWORKS.find(n => n.id === tcTronNetId)?.isMainnet) && (
                  <div style={{ fontSize:'10px', color:'#F1C40F', border:'1px solid #4a3f10', background:'#1a1608', padding:'6px 10px', marginBottom:'14px' }}>
                    ⚠ Disarankan test deploy di jaringan ini dulu sebelum ke Mainnet — bytecode ERC-20 memakai opcode yang belum tentu didukung semua versi TVM.
                  </div>
                )}

                {wallets.some(w => (w.tronAddresses||[]).length > 0) && (
                  <>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Deploy dari Wallet Tron tersimpan</label>
                    <select value={tcTronWalletSel} onChange={e => handleTcTronWalletSel(e.target.value)}
                      style={{ width:'100%', fontFamily:'monospace', fontSize:'12px', marginBottom:'14px' }}>
                      <option value="">-- Pilih address --</option>
                      {wallets.flatMap((w, wi) =>
                        (w.tronAddresses||[]).map(a => (
                          <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                            {w.name} · #{a.index} · {a.address.slice(0,14)}...
                          </option>
                        ))
                      )}
                    </select>
                  </>
                )}

                <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                  <FaKey style={{ marginRight:'4px' }}/>Atau Private Key (hex) manual
                </label>
                <input
                  type="password"
                  placeholder="0x... atau hex tanpa prefix"
                  value={tcTronPrivKey}
                  onChange={e => { setTcTronPrivKey(e.target.value); setTcTronWalletSel(''); }}
                  style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px', marginBottom:'18px' }}
                />

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Nama Token</label>
                    <input placeholder="mis. My Awesome Token" value={tcTronName} onChange={e => setTcTronName(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box', fontSize:'13px' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Simbol</label>
                    <input placeholder="mis. MAT" value={tcTronSymbol} onChange={e => setTcTronSymbol(e.target.value.toUpperCase())}
                      style={{ width:'100%', boxSizing:'border-box', fontSize:'13px', textTransform:'uppercase' }}/>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'18px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Decimals</label>
                    <input type="number" min={0} max={18} value={tcTronDecimals} onChange={e => setTcTronDecimals(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Total Supply</label>
                    <input type="number" min={0} value={tcTronSupply} onChange={e => setTcTronSupply(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'13px' }}/>
                  </div>
                </div>

                {/* ── Estimasi Energy / Bandwidth / Fee TRX ── */}
                <div style={{ margin:'4px 0 18px', padding:'12px 14px', background:'#0a0a0a', border:'1px solid #1e1e1e', borderLeft:'3px solid #EF0027' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                    <span style={{ fontSize:'11px', color:'#888', display:'flex', alignItems:'center', gap:'6px' }}>
                      <FaGasPump size={11}/> Estimasi Energy &amp; Fee
                    </span>
                    <button onClick={estimateTcTronFee} disabled={tcTronFeeLoading || !tcTronPrivKey.trim()}
                      style={{ fontSize:'11px', color:'#EF0027', background:'none', border:'1px solid #EF002755', padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', opacity: !tcTronPrivKey.trim() ? 0.5 : 1 }}>
                      {tcTronFeeLoading ? <><FaSpinner size={10} style={{ animation:'spin 1s linear infinite' }}/> Menghitung...</> : <><FaSync size={10}/> Cek Estimasi</>}
                    </button>
                  </div>
                  {tcTronFeeError && (
                    <div style={{ marginTop:'8px', fontSize:'11px', color:'#ff6666' }}>{tcTronFeeError}</div>
                  )}
                  {tcTronFeeEstimate && !tcTronFeeError && (
                    <>
                      <div style={{ marginTop:'10px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:'10px' }}>
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Energy Dibutuhkan</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>
                            {tcTronFeeEstimate.energyNeeded.toLocaleString('en-US')}
                            <span style={{ color:'#555' }}> / {tcTronFeeEstimate.energyAvailable.toLocaleString('en-US')} tersedia</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Bandwidth Dibutuhkan</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>
                            {tcTronFeeEstimate.bandwidthNeeded.toLocaleString('en-US')}
                            <span style={{ color:'#555' }}> / {tcTronFeeEstimate.bandwidthAvailable.toLocaleString('en-US')} tersedia</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #1e1e1e' }}>
                        <span style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Estimasi Fee yang Di-burn</span>
                        <div style={{ fontSize:'14px', color: tcTronFeeEstimate.coveredByFree ? '#4caf50' : '#EF0027', fontFamily:'monospace', fontWeight:'bold' }}>
                          {tcTronFeeEstimate.coveredByFree
                            ? '0 TRX — tertutup penuh Energy/Bandwidth gratis'
                            : `≈ ${sunToTrx(tcTronFeeEstimate.feeSun)} TRX`}
                        </div>
                      </div>
                    </>
                  )}
                  {!tcTronFeeEstimate && !tcTronFeeError && (
                    <p style={{ fontSize:'10px', color:'#444', margin:'8px 0 0' }}>
                      {tcTronPrivKey.trim()
                        ? 'Klik "Cek Estimasi" — kebutuhan Energy dihitung via dry-run (triggerconstantcontract) ke constructor deploy, dicek terhadap Energy/Bandwidth gratis & staked akun ini; kekurangannya yang bakal di-burn jadi TRX.'
                        : 'Isi private key deployer dulu supaya Energy/Bandwidth yang tersedia bisa dicek.'}
                    </p>
                  )}
                </div>

                <button onClick={deployTrc20Token} disabled={tcTronCreating || !tcTronPrivKey.trim() || !tcTronName.trim() || !tcTronSymbol.trim()}
                  style={{ width:'100%', padding:'13px', background:tcTronCreating?'#2a1a1a':'#EF0027', color:'#fff', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:(!tcTronPrivKey.trim()||!tcTronName.trim()||!tcTronSymbol.trim())?0.5:1 }}>
                  {tcTronCreating
                    ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Deploying...</>
                    : <><FaRocket/> Deploy Token</>}
                </button>

                {tcTronStatus.type !== 'idle' && (
                  <div style={{
                    marginTop:'14px', padding:'12px', fontSize:'12px', wordBreak:'break-all',
                    background: tcTronStatus.type==='error' ? '#2a0d0d' : tcTronStatus.type==='success' ? '#0d2a0d' : '#1a1a0d',
                    border: `1px solid ${tcTronStatus.type==='error' ? '#5a1e1e' : tcTronStatus.type==='success' ? '#1e5a1e' : '#5a5a1e'}`,
                    color: tcTronStatus.type==='error' ? '#ff8888' : tcTronStatus.type==='success' ? '#88ff88' : '#ffff88',
                  }}>
                    {tcTronStatus.msg}
                  </div>
                )}
              </div>

              {trc20Tokens.length > 0 && (
                <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', padding:'20px' }}>
                  <h3 style={{ fontSize:'12px', color:'#888', marginBottom:'14px', textTransform:'uppercase', letterSpacing:'1px' }}>
                    Token TRC-20 yang Sudah Dibuat
                  </h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {trc20Tokens.map((t, i) => {
                      const tNet = TRON_NETWORKS.find(n => n.id === t.netId) ?? TRON_NETWORKS[0];
                      return (
                        <div key={t.txId + i} style={{ border:'1px solid #1a1a1a', padding:'12px 14px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px', flexWrap:'wrap', gap:'8px' }}>
                            <div>
                              <strong style={{ fontSize:'13px' }}>{t.name}</strong>{' '}
                              <span style={{ fontSize:'11px', color:'#EF0027' }}>{t.symbol}</span>
                              <span style={{ fontSize:'10px', color:'#444', marginLeft:'8px' }}>{tNet.name} · decimals {t.decimals} · supply {t.supply}</span>
                            </div>
                            {t.address && (
                              <button onClick={() => copyText(t.address, `trc20_${i}`)}
                                style={{ background:'none', border:'1px solid #333', color:copiedKey===`trc20_${i}`?'#4caf50':'#888', cursor:'pointer', padding:'6px 10px', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                                {copiedKey===`trc20_${i}` ? <FaCheckCircle size={10}/> : <FaCopy size={10}/>} {t.address.slice(0,10)}...
                              </button>
                            )}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                            {t.address ? (
                              <a href={`${tNet.explorerUrl}/token20/${t.address}`} target="_blank" rel="noreferrer"
                                style={{ fontSize:'11px', color:'#EF0027', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                                <FaLink size={10}/> Lihat di Tronscan
                              </a>
                            ) : (
                              <a href={`${tNet.explorerUrl}/transaction/${t.txId}`} target="_blank" rel="noreferrer"
                                style={{ fontSize:'11px', color:'#555', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                                <FaLink size={10}/> Lihat TX Deploy
                              </a>
                            )}
                            {t.pending && (
                              <>
                                <span style={{ fontSize:'10px', color:'#F1C40F' }}>⏳ Menunggu konfirmasi</span>
                                <button onClick={() => refreshPendingTrc20(t.txId, t.netId)} disabled={tcTronRefreshing === t.txId}
                                  style={{ background:'none', border:'1px solid #333', color:'#888', cursor:'pointer', padding:'5px 9px', fontSize:'10px', display:'flex', alignItems:'center', gap:'5px', opacity: tcTronRefreshing === t.txId ? 0.6 : 1 }}>
                                  {tcTronRefreshing === t.txId ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Mengecek...</> : <><FaSync size={10}/> Cek Status</>}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ JETTON (GRAM/TON) ══════════ */}
          {tcChain === 'gram' && (
            <>
              <div className="form-container" style={{ maxWidth:'520px', margin:'16px auto 24px' }}>
                <h2 style={{ textAlign:'center', marginBottom:'16px', fontSize:'15px' }}>
                  <FaRocket style={{ marginRight:'8px' }}/>Deploy Jetton (TEP-74)
                </h2>

                <div style={{ marginBottom:'14px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                  <select value={tcGramNetId} onChange={e => setTcGramNetId(e.target.value)}
                    style={{ flex:'1 1 200px', fontFamily:'monospace', fontSize:'12px', padding:'8px 10px', background:'#0d0d0d', border:'1px solid #1e1e1e', color:'#ccc' }}>
                    {GRAM_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>)}
                  </select>
                  {tcGramSelectedNetwork?.isTestnet && (
                    <span style={{ fontSize:'10px', color:'#F1C40F', border:'1px solid #4a3f10', background:'#1a1608', padding:'4px 8px', whiteSpace:'nowrap' }}>
                      ⚠ Jaringan TEST — Jetton dibuat di {tcGramSelectedNetwork?.name}, tidak muncul di mainnet
                    </span>
                  )}
                </div>

                {wallets.some(w => w.gramAddress) && (
                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Wallet Gram (dari BIP39 tersimpan)</label>
                    <select value={tcGramWalletSel} onChange={e => handleTcGramWalletSel(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
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
                  <FaKey style={{ marginRight:'4px' }}/>Atau Private Key (hex, 64 byte) manual
                </label>
                <input type="password" placeholder="Private key Gram (TON) — hex 128 karakter" value={tcGramPrivKey}
                  onChange={e => { setTcGramPrivKey(e.target.value); setTcGramWalletSel(''); }}
                  style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', marginBottom:'14px' }}/>

                <div style={{ marginBottom:'14px' }}>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Versi Wallet Contract (admin/deployer)</label>
                  <select value={tcGramVersion} onChange={e => setTcGramVersion(e.target.value)} style={{ width:'100%', fontFamily:'monospace', fontSize:'12px' }}>
                    {GRAM_WALLET_VERSIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  <p style={{ fontSize:'10px', color:'#555', margin:'6px 0 0' }}>
                    Address admin (yang jadi pemegang seluruh supply awal) tergantung versi ini — kalau private key
                    dipilih lewat wallet BIP39 tersimpan, versi otomatis ikut yang sudah didera derivasi wallet itu.
                  </p>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Nama Token</label>
                    <input placeholder="misal: My Gram Token" value={tcGramName} onChange={e => setTcGramName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Symbol</label>
                    <input placeholder="misal: MGT" value={tcGramSymbol} onChange={e => setTcGramSymbol(e.target.value.toUpperCase())} style={{ textTransform:'uppercase' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Decimals (0–18)</label>
                    <input type="number" min={0} max={18} placeholder="9" value={tcGramDecimals} onChange={e => setTcGramDecimals(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Total Supply</label>
                    <input type="number" min={1} placeholder="1000000" value={tcGramSupply} onChange={e => setTcGramSupply(e.target.value)} />
                  </div>
                </div>

                <div style={{ margin:'14px 0', padding:'12px', background:'#0d0d0d', border:'1px solid #1e1e1e' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#ccc', marginBottom:'12px' }}>
                    <FaHashtag size={11}/> Metadata Jetton (WAJIB — standar TEP-64)
                  </div>
                  <p style={{ fontSize:'10px', color:'#555', margin:'0 0 12px' }}>
                    Beda dari SPL Token, metadata Jetton TIDAK opsional — tanpa ini wallet/explorer TON (Tonkeeper,
                    tonscan, dst) tidak akan bisa menampilkan nama & logo token ini sama sekali. Isi form di bawah,
                    saat deploy data ini dirangkai jadi JSON lalu di-upload ke{' '}
                    <strong style={{ color:'#888' }}>IPFS lewat Pinata</strong> — link gateway-nya dipakai sebagai
                    content URI on-chain.
                  </p>

                  <div style={{ marginBottom:'12px' }}>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                      Pinata JWT API Key <span style={{ color:'#444' }}>(sama dengan yang dipakai SPL Token — gratis, daftar di app.pinata.cloud/keys)</span>
                    </label>
                    <input type="password" placeholder="eyJhbGciOi..." value={tcSolPinataJwt}
                      onChange={e => setTcSolPinataJwt(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box' }}/>
                    <p style={{ fontSize:'10px', color:'#555', margin:'6px 0 0' }}>
                      Disimpan lokal di browser kamu saja, dipakai buat upload gambar & JSON metadata ke IPFS —
                      dipakai bersama oleh tab SPL Token dan Jetton (1 JWT, 1 akun Pinata).
                    </p>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Image URL (opsional)</label>
                      <input placeholder="https://.../logo.png" value={tcGramImageUrl}
                        onChange={e => setTcGramImageUrl(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box' }}/>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'6px' }}>
                        <label className="btn-manage" style={{ fontSize:'10px', padding:'4px 8px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'6px', opacity: tcGramImageUploading ? 0.6 : 1, pointerEvents: tcGramImageUploading ? 'none' : 'auto' }}>
                          <FaUpload size={10}/> {tcGramImageUploading ? 'Meng-upload ke IPFS...' : 'Upload dari file'}
                          <input type="file" accept="image/*" onChange={handleTcGramImageFile} style={{ display:'none' }} disabled={tcGramImageUploading}/>
                        </label>
                        {tcGramImageUrl.trim() && (
                          <button type="button" onClick={() => setTcGramImageUrl('')}
                            style={{ fontSize:'10px', color:'#f44336', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                            Hapus
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize:'10px', color:'#555', margin:'6px 0 0' }}>
                        Isi salah satu: tempel link URL gambar yang sudah di-hosting, atau upload file dari komputer/HP
                        (otomatis diupload ke IPFS lewat Pinata — butuh JWT API Key di atas).
                      </p>
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>Deskripsi (opsional)</label>
                      <input placeholder="Deskripsi singkat token" value={tcGramDescription} onChange={e => setTcGramDescription(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box' }}/>
                    </div>
                  </div>

                  {tcGramImageUrl.trim() && (
                    <div style={{ marginTop:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
                      <img src={tcGramImageUrl.trim()} alt="preview logo token"
                        style={{ width:'36px', height:'36px', borderRadius:'50%', objectFit:'cover', border:'1px solid #262626' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                      <span style={{ fontSize:'10px', color:'#555' }}>Pratinjau logo</span>
                    </div>
                  )}

                  <div style={{ marginTop:'12px' }}>
                    <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>
                      Preview JSON metadata (akan di-upload ke IPFS saat token dibuat)
                    </label>
                    <pre style={{
                      margin:0, padding:'8px 10px', background:'#000', border:'1px solid #1e1e1e',
                      fontSize:'11px', color:'#8bc34a', whiteSpace:'pre-wrap', wordBreak:'break-all',
                    }}>
                      {JSON.stringify(tcGramMetaPreview.json, null, 2)}
                    </pre>
                  </div>
                </div>

                <p style={{ fontSize:'11px', color:'#444', margin:'4px 0 14px' }}>
                  <FaInfoCircle style={{ marginRight:'4px' }}/>
                  Deploy 1 transaksi: bikin kontrak Jetton minter baru + langsung mint seluruh total supply ke
                  wallet admin ini. Address minter (dan address jetton-wallet admin) bersifat deterministik dari
                  kode kontrak + data awal — jadi tetap bisa dipakai walau explorer belum sempat meng-index tx-nya.
                </p>

                {/* ── Estimasi Fee ── */}
                <div style={{ margin:'4px 0 16px', padding:'12px 14px', background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${tcGramSelectedNetwork?.color || '#0098EA'}` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                    <span style={{ fontSize:'11px', color:'#888', display:'flex', alignItems:'center', gap:'6px' }}>
                      <FaGasPump size={11}/> Estimasi Fee Jaringan
                    </span>
                    <button onClick={estimateTcGramFee} disabled={tcGramFeeLoading || !tcGramPrivKey.trim()}
                      style={{ fontSize:'11px', color: tcGramSelectedNetwork?.color || '#0098EA', background:'none', border:`1px solid ${tcGramSelectedNetwork?.color || '#0098EA'}55`, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', opacity: !tcGramPrivKey.trim() ? 0.5 : 1 }}>
                      {tcGramFeeLoading ? <><FaSpinner size={10} style={{ animation:'spin 1s linear infinite' }}/> Menghitung...</> : <><FaSync size={10}/> Cek Estimasi</>}
                    </button>
                  </div>
                  {tcGramFeeError && (
                    <div style={{ marginTop:'8px', fontSize:'11px', color:'#ff6666' }}>{tcGramFeeError}</div>
                  )}
                  {tcGramFeeDetail && !tcGramFeeError && (
                    <>
                      <div style={{ marginTop:'10px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px,1fr))', gap:'10px' }}>
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Gas Fee</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>{(Number(tcGramFeeDetail.gasFeeNano) / 1e9).toFixed(6)} TON</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Storage Fee</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>{(Number(tcGramFeeDetail.storageFeeNano) / 1e9).toFixed(6)} TON</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Forward Fee</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>{(Number(tcGramFeeDetail.fwdFeeNano) / 1e9).toFixed(6)} TON</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>In-Forward Fee</div>
                          <div style={{ fontSize:'12px', color:'#ccc', fontFamily:'monospace' }}>{(Number(tcGramFeeDetail.inFwdFeeNano) / 1e9).toFixed(6)} TON</div>
                        </div>
                      </div>
                      <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #1e1e1e' }}>
                        <span style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.5px' }}>Total Fee Jaringan</span>
                        <div style={{ fontSize:'14px', color: tcGramSelectedNetwork?.color || '#0098EA', fontFamily:'monospace', fontWeight:'bold' }}>≈ {tcGramFeeGram} TON</div>
                        <div style={{ fontSize:'11px', color:'#888', marginTop:'6px' }}>
                          + {(Number(GRAM_JETTON_DEPLOY_VALUE) / 1e9).toFixed(2)} TON dikirim ke kontrak (deploy minter + mint + jetton-wallet admin, bukan fee yang hangus — sisa setelah dipakai jadi saldo/reserve permanen milik kontrak minter, bukan balik ke wallet ini)
                          {tcGramFeeDetail.willDeploy && ' + wallet admin ini sendiri belum aktif di chain, jadi tx ini juga sekalian deploy StateInit-nya (fee sedikit lebih besar dari perkiraan di atas).'}
                        </div>
                      </div>
                    </>
                  )}
                  {!tcGramFeeDetail && !tcGramFeeError && (
                    <p style={{ fontSize:'10px', color:'#444', margin:'8px 0 0' }}>
                      {tcGramPrivKey.trim()
                        ? `Klik "Cek Estimasi" — dry-run ke node TON, tidak broadcast apa pun. Minimal saldo yang dibutuhkan di wallet admin ≈ ${(Number(GRAM_JETTON_DEPLOY_VALUE) / 1e9).toFixed(2)} TON + fee jaringan.`
                        : 'Isi private key Gram (TON) dulu supaya fee jaringan bisa dihitung.'}
                    </p>
                  )}
                </div>

                {tcGramStatus.type !== 'idle' && (
                  <div style={{
                    marginBottom:'14px', padding:'10px 12px', fontSize:'12px',
                    border: `1px solid ${{pending:'#ffaa0044',success:'#4caf5044',error:'#f4433644',idle:'#33333344'}[tcGramStatus.type]}`,
                    borderLeft: `3px solid ${{pending:'#ffaa00',success:'#4caf50',error:'#f44336',idle:'#555'}[tcGramStatus.type]}`,
                    color: {pending:'#ffcc44',success:'#4caf50',error:'#ff6666',idle:'#888'}[tcGramStatus.type],
                    wordBreak:'break-all',
                  }}>
                    {tcGramStatus.type === 'pending' && <FaSpinner style={{ marginRight:'6px', animation:'spin 1s linear infinite' }}/>}
                    {tcGramStatus.msg}
                  </div>
                )}

                <button onClick={createGramJetton} disabled={tcGramCreating || !tcGramPrivKey.trim() || !tcGramName.trim() || !tcGramSymbol.trim()}
                  className="btn-manage btn-import" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: (tcGramCreating || !tcGramPrivKey.trim() || !tcGramName.trim() || !tcGramSymbol.trim()) ? 0.6 : 1 }}>
                  {tcGramCreating ? <><FaSpinner style={{ animation:'spin 1s linear infinite' }}/> Deploy Jetton...</> : <><FaHashtag/> Deploy Jetton</>}
                </button>
              </div>

              {gramTokens.length > 0 && (
                <div style={{ marginBottom:'20px' }}>
                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#0098EA', marginBottom:'10px' }}>
                    <FaList style={{ marginRight:'6px' }}/>Jetton yang Sudah Dibuat ({gramTokens.length})
                  </h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'12px' }}>
                    {gramTokens.map(t => {
                      const tNet = GRAM_NETWORKS.find(n => n.id === t.netId) ?? GRAM_NETWORKS[0];
                      return (
                      <div key={t.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${tNet.color}`, padding:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            {t.imageUrl && (
                              <img src={t.imageUrl} alt={t.symbol}
                                style={{ width:'28px', height:'28px', borderRadius:'50%', objectFit:'cover', border:'1px solid #262626', flexShrink:0 }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                            )}
                            <div>
                              <div style={{ fontWeight:'bold', fontSize:'13px' }}>{t.name} <span style={{ color:'#555' }}>({t.symbol})</span></div>
                              <div style={{ fontSize:'10px', color:'#444', marginTop:'2px' }}>
                                {t.networkName || 'Gram Mainnet'}
                                {tNet.isTestnet && <span style={{ color:'#F1C40F' }}> (TEST)</span>}
                                {' · '}{t.decimals} dec · supply {Number(t.initialSupply).toLocaleString()} · {t.version}
                              </div>
                              {t.description && (
                                <div style={{ fontSize:'10px', color:'#555', marginTop:'3px' }}>{t.description}</div>
                              )}
                            </div>
                          </div>
                          <button onClick={() => deleteGramToken(t.id)} title="Hapus catatan"
                            style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'4px 7px', cursor:'pointer', fontSize:'11px', flexShrink:0 }}><FaTrash/></button>
                        </div>

                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <code style={{ flex:1, fontSize:'10px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'5px 8px', border:'1px solid #141414' }}>
                            {t.masterAddress}
                          </code>
                          <button onClick={() => copyText(t.masterAddress, `gram_${t.id}`)} title="Salin address minter (master)"
                            style={{ background:'none', border:'none', color:copiedKey===`gram_${t.id}`?'#4caf50':'#333', cursor:'pointer', padding:'3px', flexShrink:0 }}>
                            {copiedKey===`gram_${t.id}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                          </button>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                          <a href={`${tNet.explorerUrl}/address/${t.masterAddress}`} target="_blank" rel="noreferrer"
                            style={{ fontSize:'11px', color:tNet.color, textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaLink size={10}/> Lihat di tonscan
                          </a>
                          {t.metadataUri && (
                            <a href={t.metadataUri} target="_blank" rel="noreferrer"
                              style={{ fontSize:'11px', color:'#555', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                              <FaLink size={10}/> Lihat JSON Metadata
                            </a>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
  );
}