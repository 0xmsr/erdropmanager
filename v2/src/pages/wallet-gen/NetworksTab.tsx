// @ts-nocheck

import React from 'react';
import type { WalletGeneratorCtx } from './types';
import { DEFAULT_NETWORKS } from './constants';

export function NetworksTab({ ctx }: { ctx: WalletGeneratorCtx }) {
  const {
    FaCheckCircle, FaCopy, FaEdit, FaExchangeAlt, FaLink, FaPlug, FaPlus, FaSearch, FaTrash, activeTab, 
    addToMetaMask, copiedKey, copyText, filteredNetworks, netEditId, netForm, netSearch, networks, 
    saveNetwork, search, setActiveTab, setConfirmData, setNetEditId, setNetForm, setNetSearch, 
    setNetworks, setShowNetForm, setTxNetworkId, showAlert, showNetForm
  } = ctx;

  return (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
            <div className="search-input-wrapper" style={{ flex:1 }}>
              <FaSearch className="search-icon"/>
              <input type="search" placeholder="Cari network / symbol..." value={netSearch} onChange={e => setNetSearch(e.target.value)}/>
            </div>
            <span style={{ fontSize:'12px', color:'#555', whiteSpace:'nowrap' }}>{filteredNetworks.length} network</span>
            <button onClick={() => { setShowNetForm(p => !p); setNetEditId(null); setNetForm({ name:'', chainId:0, symbol:'', rpcUrls:[], rpcRaw:'', explorerUrl:'', color:'#01a2ff' }); }}
              style={{ background:'#01a2ff', color:'#000', border:'none', padding:'8px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'6px' }}>
              <FaPlus/> Tambah Network
            </button>
          </div>

          {showNetForm && (
            <div className="form-container" style={{ marginBottom:'20px' }}>
              <h3 style={{ marginTop:0, marginBottom:'14px', fontSize:'13px', textTransform:'uppercase', letterSpacing:'1px', color:'#01a2ff' }}>
                {netEditId ? <><FaEdit/> Edit Network</> : <><FaPlus/> Network Baru</>}
              </h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <input placeholder="Nama Network" value={netForm.name} onChange={e => setNetForm(p => ({ ...p, name:e.target.value }))}/>
                <input type="number" placeholder="Chain ID" value={netForm.chainId||''} onChange={e => setNetForm(p => ({ ...p, chainId:parseInt(e.target.value)||0 }))}/>
                <input placeholder="Symbol (ETH, BNB, ...)" value={netForm.symbol} onChange={e => setNetForm(p => ({ ...p, symbol:e.target.value.toUpperCase() }))}/>
                <input placeholder="Block Explorer URL" value={netForm.explorerUrl} onChange={e => setNetForm(p => ({ ...p, explorerUrl:e.target.value }))}/>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'4px' }}>RPC URLs (satu per baris):</label>
                  <textarea placeholder="https://rpc.example.com" value={netForm.rpcRaw} onChange={e => setNetForm(p => ({ ...p, rpcRaw:e.target.value }))}
                    rows={3} style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'12px', resize:'vertical' }}/>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <label style={{ fontSize:'12px', color:'#888' }}>Warna:</label>
                  <input type="color" value={netForm.color} onChange={e => setNetForm(p => ({ ...p, color:e.target.value }))}
                    style={{ width:'40px', height:'32px', padding:'2px', border:'1px solid #333', background:'#111', cursor:'pointer' }}/>
                  <span style={{ fontSize:'12px', color:netForm.color, fontFamily:'monospace' }}>{netForm.color}</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <button onClick={saveNetwork} className="btn-manage btn-import" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                  <FaCheckCircle/> {netEditId ? 'Update' : 'Tambah'}
                </button>
                <button onClick={() => { setShowNetForm(false); setNetEditId(null); }} className="cancel-btn">Batal</button>
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'12px' }}>
            {filteredNetworks.map(n => (
              <div key={n.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${n.color}`, padding:'16px', display:'flex', flexDirection:'column', gap:'10px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                  <div>
                    <div style={{ fontWeight:'bold', fontSize:'13px', color:n.color }}>{n.name}</div>
                    <div style={{ fontSize:'11px', color:'#444', marginTop:'2px' }}>Chain ID: {n.chainId} · {n.symbol}</div>
                  </div>
                  <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
                    <button onClick={() => { setNetForm({ ...n, rpcRaw:n.rpcUrls.join('\n') }); setNetEditId(n.id); setShowNetForm(true); }} title="Edit"
                      style={{ background:'none', border:'1px solid #333', color:'#888', padding:'4px 7px', cursor:'pointer', fontSize:'11px' }}><FaEdit/></button>
                    <button onClick={() => setConfirmData({ isOpen:true, title:'HAPUS NETWORK?', message:'Network ini akan dihapus.',
                        action:()=>{ setNetworks(prev => prev.filter(x => x.id !== n.id)); showAlert('Network dihapus.','hapus'); } })} title="Hapus"
                      style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'4px 7px', cursor:'pointer', fontSize:'11px' }}><FaTrash/></button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>
                    <FaLink style={{ marginRight:'4px' }}/>RPC Endpoints
                  </div>
                  {n.rpcUrls.map((url, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                      <code style={{ flex:1, fontSize:'10px', color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:'#0a0a0a', padding:'4px 8px', border:'1px solid #141414' }}>
                        {url}
                      </code>
                      <button onClick={() => copyText(url, `rpc_${n.id}_${i}`)} title="Salin RPC"
                        style={{ background:'none', border:'none', color:copiedKey===`rpc_${n.id}_${i}`?'#4caf50':'#333', cursor:'pointer', padding:'3px', flexShrink:0 }}>
                        {copiedKey===`rpc_${n.id}_${i}` ? <FaCheckCircle size={11}/> : <FaCopy size={11}/>}
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
                  {n.explorerUrl && (
                    <a href={n.explorerUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize:'11px', color:n.color, border:`1px solid ${n.color}30`, padding:'5px 10px', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                      <FaLink size={10}/> Explorer
                    </a>
                  )}
                  <button onClick={() => addToMetaMask(n)}
                    style={{ fontSize:'11px', color:'#f6851b', border:'1px solid #f6851b30', padding:'5px 10px', cursor:'pointer', background:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaPlug size={10}/> + MetaMask
                  </button>
                  <button onClick={() => { copyText(n.rpcUrls[0]||'', 'chain_'+n.id); showAlert('RPC URL disalin!','success'); }}
                    style={{ fontSize:'11px', color:'#888', border:'1px solid #1e1e1e', padding:'5px 10px', cursor:'pointer', background:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaCopy size={10}/> Salin RPC
                  </button>
                  <button onClick={() => { setTxNetworkId(n.id); setActiveTab('transfer'); }}
                    style={{ fontSize:'11px', color:'#4caf50', border:'1px solid #4caf5030', padding:'5px 10px', cursor:'pointer', background:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                    <FaExchangeAlt size={10}/> Send/Receive
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:'20px', textAlign:'center' }}>
            <button
              onClick={() => setConfirmData({ isOpen:true, title:'RESET NETWORKS?', message:'Semua network akan direset ke default.',
                action:()=>{ setNetworks(DEFAULT_NETWORKS); showAlert('Networks direset ke default.','success'); } })}
              style={{ background:'none', border:'1px solid #333', color:'#555', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
              Reset ke Default Networks
            </button>
          </div>
        </>
  );
}