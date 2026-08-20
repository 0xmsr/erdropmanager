// @ts-nocheck

import React from 'react';
import type { WalletGeneratorCtx, AirdropTask } from './types';
import { TASK_TYPES, PRIORITY_COLORS, PRIORITY_LABELS, AUTO_ACTION_TEMPLATES } from './constants';
import { shortAddr } from './helpers';

export function GarapTab({ ctx }: { ctx: WalletGeneratorCtx }) {
  const {
    FaBolt, FaCalendarAlt, FaChartBar, FaCheckCircle, FaCode, FaCopy, FaEdit, FaExclamationTriangle, 
    FaFileExport, FaFileImport, FaGasPump, FaLayerGroup, FaLink, FaNetworkWired, FaPaperPlane, FaPlus, 
    FaSearch, FaTrash, FaWallet, SmartContractConfig, activeTab, agHistory, airdropTasks, atEditId, 
    atEmptyForm, atFilter, atForm, atSearch, atShowForm, atStats, batchSelectedIds, copiedKey, 
    copyText, deleteAirdropTask, editAirdropTask, execContract, execGasLimit, execLog, execMode, 
    execNetId, execPrivKey, execRawData, execRawTo, execRawVal, execReadResult, execRunning, 
    execSimFailed, execTaskId, execWalSel, exportGarapan, filteredAtTasks, garapImportRef, 
    handleExecWalSel, handleGarapImport, markTaskDone, networks, openExecPanel, runExec, 
    saveAirdropTask, search, setAgHistory, setAirdropTasks, setAtEditId, setAtFilter, setAtForm, 
    setAtSearch, setAtShowForm, setBatchModalOpen, setBatchSelectedIds, setConfirmData, 
    setExecContract, setExecGasLimit, setExecMode, setExecNetId, setExecPrivKey, setExecRawData, 
    setExecRawTo, setExecRawVal, setExecSimFailed, setExecTaskId, setExecWalSel, showAlert, wallets
  } = ctx;

  return (
        <>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Total Task',  value: atStats.total,  color:'#01a2ff' },
              { label:'Todo',        value: atStats.todo,   color:'#ffaa00' },
              { label:'Done',        value: atStats.done,   color:'#4caf50' },
              { label:'Failed',      value: atStats.failed, color:'#f44336' },
            ].map(s => (
              <div key={s.label} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderLeft:`3px solid ${s.color}`, padding:'12px 18px', flex:1, minWidth:'110px' }}>
                <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{s.label}</div>
                <div style={{ fontSize:'24px', fontWeight:'bold', fontFamily:'monospace', color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
              <button onClick={() => { setAtShowForm(p => !p); setAtEditId(null); setAtForm(atEmptyForm); }}
                style={{ background:'#01a2ff', color:'#000', border:'none', padding:'9px 18px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'6px' }}>
                <FaPlus/> Tambah Task
              </button>
              <button
                onClick={() => {
                  if (batchSelectedIds.size > 0) {
                    setBatchModalOpen(true);
                  } else {
                    // Auto-select all todo tasks with contract
                    const todoIds = new Set(airdropTasks.filter(t => t.status === 'todo' && t.contractAddress).map(t => t.id));
                    if (todoIds.size > 0) { setBatchSelectedIds(todoIds); setBatchModalOpen(true); }
                    else { showAlert('Tidak ada task todo dengan contract address.', 'info'); }
                  }
                }}
                style={{
                  background: batchSelectedIds.size > 0 ? '#1a0d2a' : '#111',
                  border:`1px solid ${batchSelectedIds.size > 0 ? '#836EFD' : '#333'}`,
                  color: batchSelectedIds.size > 0 ? '#836EFD' : '#555',
                  padding:'9px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold',
                  display:'flex', alignItems:'center', gap:'6px',
                }}>
                <FaLayerGroup size={12}/> Garap Batch {batchSelectedIds.size > 0 ? `(${batchSelectedIds.size})` : ''}
              </button>
              {batchSelectedIds.size > 0 && (
                <button onClick={() => setBatchSelectedIds(new Set())}
                  style={{ background:'none', border:'1px solid #333', color:'#555', padding:'6px 10px', cursor:'pointer', fontSize:'11px' }}>
                  Batal Pilih
                </button>
              )}
              <button onClick={exportGarapan} disabled={airdropTasks.length === 0}
                style={{ background:'none', border:'1px solid #4caf5044', color:'#4caf50', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px', opacity: airdropTasks.length === 0 ? 0.4 : 1 }}>
                <FaFileExport size={12}/> Export
              </button>
              <button onClick={() => garapImportRef.current?.click()}
                style={{ background:'none', border:'1px solid #ffaa0044', color:'#ffaa00', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px' }}>
                <FaFileImport size={12}/> Import
              </button>
              <input ref={garapImportRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleGarapImport} />
            </div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {(['all','todo','done','failed'] as const).map(f => (
                <button key={f} onClick={() => setAtFilter(f)} style={{
                  padding:'6px 14px', fontSize:'11px', cursor:'pointer', fontWeight:'bold',
                  background: atFilter === f ? (f==='all'?'#01a2ff':f==='todo'?'#ffaa00':f==='done'?'#4caf50':'#f44336') : '#111',
                  color: atFilter === f ? '#000' : '#555',
                  border:`1px solid ${atFilter===f?(f==='all'?'#01a2ff':f==='todo'?'#ffaa00':f==='done'?'#4caf50':'#f44336'):'#333'}`,
                }}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {atShowForm && (
            <div className="form-container" style={{ marginBottom:'20px' }}>
              <h3 style={{ marginTop:0, marginBottom:'14px', fontSize:'13px', textTransform:'uppercase', letterSpacing:'1px', color:'#01a2ff' }}>
                {atEditId ? <><FaEdit/> Edit Task</> : <><FaPlus/> Task Baru</>}
              </h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px', marginBottom:'10px' }}>
                <input placeholder="Nama Project *" value={atForm.projectName}
                  onChange={e => setAtForm(p => ({ ...p, projectName: e.target.value }))} required/>
                <input placeholder="Network (Monad, Base, ...)" value={atForm.network}
                  onChange={e => setAtForm(p => ({ ...p, network: e.target.value }))}/>
                <select value={atForm.taskType} onChange={e => setAtForm(p => ({ ...p, taskType: e.target.value as AirdropTask['taskType'] }))}>
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={atForm.priority} onChange={e => setAtForm(p => ({ ...p, priority: e.target.value as AirdropTask['priority'] }))}>
                  <option value="low">Priority: Low</option>
                  <option value="medium">Priority: Medium</option>
                  <option value="high">Priority: High</option>
                </select>
                <select value={atForm.status} onChange={e => setAtForm(p => ({ ...p, status: e.target.value as AirdropTask['status'] }))}>
                  <option value="todo">Status: Todo</option>
                  <option value="done">Status: Done</option>
                  <option value="failed">Status: Failed</option>
                </select>
                <input type="date" value={atForm.deadline} title="Deadline"
                  onChange={e => setAtForm(p => ({ ...p, deadline: e.target.value }))}/>
                <input placeholder="Wallet address (opsional)" value={atForm.walletAddress}
                  onChange={e => setAtForm(p => ({ ...p, walletAddress: e.target.value }))}
                  style={{ gridColumn:'span 2', fontFamily:'monospace', fontSize:'12px' }}/>
                <input placeholder="Deskripsi task" value={atForm.description}
                  onChange={e => setAtForm(p => ({ ...p, description: e.target.value }))}
                  style={{ gridColumn:'span 2' }}/>
                <input placeholder="TX Hash (isi setelah selesai)" value={atForm.txHash}
                  onChange={e => setAtForm(p => ({ ...p, txHash: e.target.value }))}
                  style={{ gridColumn:'span 2', fontFamily:'monospace', fontSize:'11px' }}/>
                <textarea placeholder="Catatan tambahan..." value={atForm.notes}
                  onChange={e => setAtForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} style={{ gridColumn:'1/-1', resize:'vertical', fontFamily:'inherit', fontSize:'12px' }}/>
              </div>

              <SmartContractConfig
                value={{
                  contractAddress: atForm.contractAddress || '',
                  contractAbi:     atForm.contractAbi     || '',
                  contractFunc:    atForm.contractFunc    || '',
                  contractArgs:    atForm.contractArgs    || '[]',
                  ethValue:        atForm.ethValue        || '0',
                }}
                onChange={(cfg) => setAtForm(p => ({ ...p, ...cfg }))}
                defaultOpen={!!atEditId}
              />

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <button onClick={saveAirdropTask} className="btn-manage btn-import" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                  <FaCheckCircle/> {atEditId ? 'Update' : 'Simpan Task'}
                </button>
                <button onClick={() => { setAtShowForm(false); setAtEditId(null); setAtForm(atEmptyForm); }} className="cancel-btn">Batal</button>
              </div>
            </div>
          )}

          <div className="search-filter-bar" style={{ marginBottom:'16px' }}>
            <div className="search-input-wrapper" style={{ flex:1 }}>
              <FaSearch className="search-icon"/>
              <input type="search" placeholder="Cari project / network / deskripsi..." value={atSearch}
                onChange={e => setAtSearch(e.target.value)}/>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filteredAtTasks.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px', color:'#333', border:'1px dashed #222' }}>
                {atSearch ? 'Tidak ditemukan.' : 'Belum ada task. Klik "Tambah Task" untuk mulai.'}
              </div>
            )}
            {filteredAtTasks.map(task => {
              const isDone         = task.status === 'done';
              const isFailed       = task.status === 'failed';
              const taskTypeInfo   = TASK_TYPES.find(t => t.value === task.taskType);
              const deadlineOverdue = task.deadline && task.status === 'todo'
                ? new Date(task.deadline) < new Date(new Date().toDateString())
                : false;
              const isExecOpen     = execTaskId === task.id;
              const explorerNet    = networks.find(n => n.id === execNetId);

              return (
                <div key={task.id} style={{
                  background:'#0d0d0d',
                  border:`1px solid ${isDone?'#1e3a1e':isFailed?'#3a1e1e':'#1e1e1e'}`,
                  borderLeft:`3px solid ${isDone?'#4caf50':isFailed?'#f44336':PRIORITY_COLORS[task.priority]}`,
                  overflow:'hidden',
                }}>
                  <div style={{ padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:'12px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:'200px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'6px' }}>
                        <span style={{ fontWeight:'bold', fontSize:'14px', textDecoration:isDone?'line-through':'none', color:isDone?'#555':'#fff' }}>
                          {task.projectName}
                        </span>
                        {taskTypeInfo && (
                          <span style={{ fontSize:'10px', color:taskTypeInfo.color, border:`1px solid ${taskTypeInfo.color}44`, padding:'2px 8px', fontWeight:'bold' }}>
                            {taskTypeInfo.label}
                          </span>
                        )}
                        <span style={{ fontSize:'10px', color:PRIORITY_COLORS[task.priority], border:`1px solid ${PRIORITY_COLORS[task.priority]}44`, padding:'2px 8px' }}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        {task.network && (
                          <span style={{ fontSize:'10px', color:'#888', border:'1px solid #333', padding:'2px 8px' }}>{task.network}</span>
                        )}
                        {task.contractAddress && (
                          <span style={{ fontSize:'10px', color:'#836EFD', border:'1px solid #836EFD44', padding:'2px 8px', display:'flex', alignItems:'center', gap:'3px' }}>
                            <FaCode size={9}/> Contract
                          </span>
                        )}
                        {deadlineOverdue && (
                          <span style={{ fontSize:'10px', color:'#ff3333', border:'1px solid #ff333344', padding:'2px 8px', display:'flex', alignItems:'center', gap:'4px' }}>
                            <FaExclamationTriangle size={9}/> OVERDUE
                          </span>
                        )}
                      </div>
                      {task.description && <div style={{ fontSize:'12px', color:'#666', marginBottom:'4px' }}>{task.description}</div>}
                      <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', fontSize:'11px', color:'#444', marginTop:'4px' }}>
                        {task.deadline && (
                          <span style={{ display:'flex', alignItems:'center', gap:'4px', color:deadlineOverdue?'#ff5555':'#555' }}>
                            <FaCalendarAlt size={10}/> {task.deadline}
                          </span>
                        )}
                        {task.walletAddress && (
                          <span style={{ fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'180px', whiteSpace:'nowrap' }}>
                            {shortAddr(task.walletAddress)}
                          </span>
                        )}
                        {task.doneAt && <span style={{ color:'#4caf50' }}>✓ {new Date(task.doneAt).toLocaleDateString('id-ID')}</span>}
                      </div>
                      {task.txHash && (
                        <div style={{ marginTop:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ fontSize:'10px', color:'#555' }}>TX:</span>
                          <code style={{ fontSize:'10px', color:'#888', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'220px' }}>
                            {task.txHash}
                          </code>
                          <button onClick={() => copyText(task.txHash, 'txh_'+task.id)}
                            style={{ background:'none', border:'none', color:copiedKey==='txh_'+task.id?'#4caf50':'#444', cursor:'pointer', padding:'2px', flexShrink:0 }}>
                            {copiedKey==='txh_'+task.id ? <FaCheckCircle size={10}/> : <FaCopy size={10}/>}
                          </button>
                        </div>
                      )}
                      {task.notes && <div style={{ fontSize:'11px', color:'#444', marginTop:'5px', fontStyle:'italic' }}>{task.notes}</div>}
                    </div>

                    <div style={{ display:'flex', gap:'6px', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end', alignItems:'flex-start' }}>
                      {/* Batch checkbox */}
                      {task.contractAddress && (
                        <button
                          title="Pilih untuk Batch"
                          onClick={() => setBatchSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                            return next;
                          })}
                          style={{
                            background: batchSelectedIds.has(task.id) ? '#1a0d2a' : '#0a0a0a',
                            border:`1px solid ${batchSelectedIds.has(task.id) ? '#836EFD' : '#2a2a2a'}`,
                            color: batchSelectedIds.has(task.id) ? '#836EFD' : '#333',
                            padding:'6px 8px', cursor:'pointer', fontSize:'11px',
                            display:'flex', alignItems:'center', gap:'4px',
                          }}>
                          <FaLayerGroup size={10}/> {batchSelectedIds.has(task.id) ? '✓' : '+'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (isExecOpen) { setExecTaskId(null); }
                          else { openExecPanel(task); }
                        }}
                        title="Execute Smart Contract"
                        style={{
                          background: isExecOpen ? '#1a0d2a' : (task.contractAddress ? '#0d0a1a' : '#0a0a0a'),
                          border:`1px solid ${isExecOpen ? '#836EFD' : task.contractAddress ? '#836EFD55' : '#333'}`,
                          color: isExecOpen ? '#836EFD' : task.contractAddress ? '#836EFD' : '#555',
                          padding:'6px 10px', cursor:'pointer', fontSize:'12px',
                          display:'flex', alignItems:'center', gap:'5px', fontWeight:'bold',
                        }}>
                        <FaBolt size={11}/> {isExecOpen ? 'Tutup' : 'Execute'}
                      </button>
                      <button onClick={() => markTaskDone(task.id)} title={isDone?'Tandai Ulang':'Tandai Selesai'}
                        style={{ background:isDone?'#1e3a1e':'#0a1a0a', border:`1px solid ${isDone?'#4caf50':'#333'}`, color:isDone?'#4caf50':'#555', padding:'6px 10px', cursor:'pointer', fontSize:'12px' }}>
                        <FaCheckCircle/>
                      </button>
                      <button onClick={() => editAirdropTask(task)} title="Edit"
                        style={{ background:'none', border:'1px solid #333', color:'#888', padding:'6px 10px', cursor:'pointer', fontSize:'12px' }}>
                        <FaEdit/>
                      </button>
                      <button onClick={() => deleteAirdropTask(task.id)} title="Hapus"
                        style={{ background:'none', border:'1px solid #333', color:'#f44336', padding:'6px 10px', cursor:'pointer', fontSize:'12px' }}>
                        <FaTrash/>
                      </button>
                    </div>
                  </div>

                  {isExecOpen && (
                    <div style={{ borderTop:'1px solid #1a0d2a', background:'#080810', padding:'16px' }}>
                      <div style={{ fontSize:'11px', color:'#836EFD', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'6px' }}>
                        <FaBolt size={10}/> Execute — {task.projectName}
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                        <div>
                          <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                            <FaWallet style={{ marginRight:'4px' }}/>Wallet (dari BIP39)
                          </label>
                          <select value={execWalSel} onChange={e => handleExecWalSel(e.target.value)}
                            style={{ width:'100%', fontFamily:'monospace', fontSize:'11px' }}>
                            <option value="">-- Pilih wallet --</option>
                            {wallets.flatMap((w, wi) =>
                              w.addresses.map(a => (
                                <option key={`${wi},${a.index}`} value={`${wi},${a.index}`}>
                                  {w.name} · #{a.index} · {shortAddr(a.address)}
                                </option>
                              ))
                            )}
                          </select>
                          {!execWalSel && (
                            <input type="password" placeholder="Atau paste Private Key (0x...)"
                              value={execPrivKey}
                              onChange={e => { setExecPrivKey(e.target.value); setExecWalSel(''); }}
                              style={{ width:'100%', boxSizing:'border-box', fontFamily:'monospace', fontSize:'11px', marginTop:'6px' }}/>
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize:'10px', color:'#555', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                            <FaNetworkWired style={{ marginRight:'4px' }}/>Network
                          </label>
                          <select value={execNetId} onChange={e => setExecNetId(e.target.value)}
                            style={{ width:'100%', fontFamily:'monospace', fontSize:'11px' }}>
                            {networks.map(n => (
                              <option key={n.id} value={n.id}>{n.name} · {n.symbol}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
                        {(['contract','raw'] as const).map(m => (
                          <button key={m} onClick={() => setExecMode(m)} style={{
                            padding:'5px 14px', fontSize:'11px', cursor:'pointer', fontWeight:'bold',
                            background: execMode===m ? '#1a0d2a' : '#111',
                            border:`1px solid ${execMode===m ? '#836EFD' : '#333'}`,
                            color: execMode===m ? '#836EFD' : '#555',
                          }}>
                            {m === 'contract' ? <><FaCode style={{ marginRight:'4px' }}/>Contract Call</> : <><FaPaperPlane style={{ marginRight:'4px' }}/>Raw ETH Send</>}
                          </button>
                        ))}
                      </div>

                      {execMode === 'contract' ? (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                          <input placeholder="Contract Address (0x...)" value={execContract.contractAddress}
                            onChange={e => setExecContract(p => ({ ...p, contractAddress: e.target.value }))}
                            style={{ fontFamily:'monospace', fontSize:'11px', gridColumn:'span 2' }}/>
                          <input placeholder="Function Name (mint, claim, stake, ...)" value={execContract.contractFunc}
                            onChange={e => setExecContract(p => ({ ...p, contractFunc: e.target.value }))}/>
                          <input placeholder='Args JSON — simple: ["0xabc","1000"] | tuple: [["40245","0x...","1000"],["108874","0"],"0x..."]' value={execContract.contractArgs}
                            onChange={e => setExecContract(p => ({ ...p, contractArgs: e.target.value }))}
                            style={{ fontFamily:'monospace', fontSize:'11px' }}/>
                          <input placeholder="ETH Value (e.g. 0.01 — atau 0 jika payable dengan value 0)" value={execContract.ethValue}
                            onChange={e => setExecContract(p => ({ ...p, ethValue: e.target.value }))}/>
                          <div style={{ fontSize:'10px', color:'#555', alignSelf:'center' }}>
                            💡 Kosongkan ABI = raw calldata
                          </div>
                          <textarea placeholder='ABI JSON (opsional) — contoh: [{"inputs":[{"name":"quantity","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}]'
                            value={execContract.contractAbi}
                            onChange={e => setExecContract(p => ({ ...p, contractAbi: e.target.value }))}
                            rows={3} style={{ gridColumn:'span 2', resize:'vertical', fontFamily:'monospace', fontSize:'10px' }}/>
                          <div style={{ gridColumn:'span 2', display:'flex', gap:'5px', flexWrap:'wrap' }}>
                            {AUTO_ACTION_TEMPLATES.filter(t => t.abi).map(t => (
                              <button key={t.id} onClick={() => {
                                setExecContract(p => ({ ...p, contractAbi: t.abi }));
                                if (t.id === 'erc20_approve') setExecContract(p => ({ ...p, contractFunc: 'approve' }));
                                if (t.id === 'erc20_transfer') setExecContract(p => ({ ...p, contractFunc: 'transfer' }));
                                if (t.id === 'nft_mint') setExecContract(p => ({ ...p, contractFunc: 'mint' }));
                              }}
                              style={{ fontSize:'10px', padding:'3px 8px', background:'#111', border:'1px solid #333', color:'#888', cursor:'pointer' }}>
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                          <input placeholder="To Address (0x...)" value={execRawTo}
                            onChange={e => setExecRawTo(e.target.value)}
                            style={{ fontFamily:'monospace', fontSize:'11px', gridColumn:'span 2' }}/>
                          <input placeholder="ETH Amount (e.g. 0.001)" value={execRawVal}
                            onChange={e => setExecRawVal(e.target.value)} type="number" step="any" min="0"/>
                          <input placeholder="Calldata (0x, opsional)" value={execRawData}
                            onChange={e => setExecRawData(e.target.value)}
                            style={{ fontFamily:'monospace', fontSize:'11px' }}/>
                        </div>
                      )}

                      <div style={{ marginBottom:'8px' }}>
                        <div style={{ fontSize:'10px', color:'#555', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'5px', display:'flex', alignItems:'center', gap:'5px' }}>
                          <FaGasPump size={9}/> Gas Limit
                          <span style={{ color:'#333', fontStyle:'italic', textTransform:'none', letterSpacing:0 }}>(kosong = auto-estimate)</span>
                        </div>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                          <input
                            type="number"
                            placeholder="auto"
                            value={execGasLimit}
                            onChange={e => { setExecGasLimit(e.target.value); setExecSimFailed(false); }}
                            min="21000"
                            style={{ flex:1, fontFamily:'monospace', fontSize:'12px',
                              borderColor: execSimFailed ? '#ffaa00' : undefined }}
                          />
                          {(['100000','200000','300000','500000'] as const).map(v => (
                            <button key={v} type="button"
                              onClick={() => { setExecGasLimit(v); setExecSimFailed(false); }}
                              style={{ fontSize:'10px', padding:'4px 7px', background:'#111', border:'1px solid #2a2a2a',
                                color: execGasLimit === v ? '#836EFD' : '#555', cursor:'pointer',
                                borderColor: execGasLimit === v ? '#836EFD' : '#2a2a2a' }}>
                              {parseInt(v)/1000}k
                            </button>
                          ))}
                          {execGasLimit && (
                            <button type="button" onClick={() => { setExecGasLimit(''); setExecSimFailed(false); }}
                              style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:'12px' }}>✕</button>
                          )}
                        </div>
                      </div>

                      {execSimFailed && (
                        <div style={{
                          background:'rgba(255,170,0,0.07)', border:'1px solid #ffaa0055',
                          borderLeft:'3px solid #ffaa00', padding:'10px 12px', marginBottom:'8px',
                          fontSize:'11px', color:'#ffcc44', lineHeight:'1.6',
                        }}>
                          <div style={{ fontWeight:'bold', marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
                            <FaExclamationTriangle size={11}/> Simulasi TX revert
                          </div>
                          <div>TX kemungkinan akan gagal. Set gas limit manual di atas dan klik <strong>Force Send</strong> untuk tetap mengirim (risiko gas hangus).</div>
                        </div>
                      )}

                      <button
                        onClick={() => runExec(task)}
                        disabled={execRunning || !execPrivKey}
                        style={{
                          width:'100%', padding:'11px', marginBottom:'10px',
                          background: execRunning ? '#1a0d2a' : execSimFailed ? '#3a2a00' : '#836EFD',
                          color: '#fff', border: execSimFailed ? '1px solid #ffaa00' : 'none',
                          cursor: execRunning || !execPrivKey ? 'not-allowed' : 'pointer',
                          fontSize:'13px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                          opacity: !execPrivKey ? 0.5 : 1,
                        }}>
                        {execRunning
                          ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Executing...</>
                          : execSimFailed
                            ? <><FaExclamationTriangle size={12}/> Force Send (⚠️ Berisiko)</>
                            : <><FaBolt/> Eksekusi TX / Call</>}
                      </button>

                      {execReadResult !== null && (
                        <div style={{
                          background:'#001a0d', border:'1px solid #00e67644', borderLeft:'3px solid #00e676',
                          padding:'10px 14px', marginBottom:'10px', fontSize:'12px',
                        }}>
                          <div style={{ fontSize:'10px', color:'#00e676', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px', display:'flex', alignItems:'center', gap:'5px' }}>
                            <FaCheckCircle size={10}/> Hasil Read-Only (eth_call)
                          </div>
                          <code style={{ fontFamily:'monospace', color:'#aaffcc', wordBreak:'break-all', lineHeight:'1.7', display:'block' }}>
                            {execReadResult}
                          </code>
                        </div>
                      )}

                      {execLog.length > 0 && (
                        <div style={{ background:'#030308', border:'1px solid #0e0e1a', padding:'10px', fontFamily:'monospace', fontSize:'10px', color:'#888', maxHeight:'140px', overflowY:'auto', lineHeight:'1.7' }}>
                          {execLog.map((l, i) => (
                            <div key={i} style={{
                              color: l.includes('[done]')||l.includes('DIKONFIRMASI')||l.includes('[result]') ? '#4caf50'
                                   : l.includes('[X]') ? '#f44336'
                                   : l.includes('[read-only]') ? '#01a2ff'
                                   : l.includes('[execute]')||l.includes('[send]') ? '#836EFD'
                                   : l.includes('⏳') ? '#ffaa00'
                                   : '#666',
                            }}>{l}</div>
                          ))}
                        </div>
                      )}

                      {task.txHash && task.status === 'done' && explorerNet?.explorerUrl && (
                        <div style={{ marginTop:'8px', textAlign:'center' }}>
                          <a href={`${explorerNet.explorerUrl}/tx/${task.txHash}`} target="_blank" rel="noreferrer"
                            style={{ fontSize:'11px', color:'#836EFD', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'5px' }}>
                            <FaLink size={10}/> Lihat TX di {explorerNet.name} Explorer ↗
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {airdropTasks.length > 0 && (
            <div style={{ marginTop:'20px', textAlign:'center' }}>
              <button
                onClick={() => setConfirmData({ isOpen:true, title:'HAPUS SEMUA TASK?', message:'Semua airdrop task akan dihapus.',
                  action:()=>{ setAirdropTasks([]); showAlert('Semua task dihapus.','hapus'); } })}
                style={{ background:'none', border:'1px solid #333', color:'#555', padding:'8px 20px', cursor:'pointer', fontSize:'12px' }}>
                Hapus Semua Task
              </button>
            </div>
          )}

          <div style={{ marginTop:'28px', background:'#0a0a0a', border:'1px solid #1e1e1e', borderTop:'2px solid #836EFD' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderBottom:'1px solid #141414' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <FaChartBar color="#836EFD" size={13}/>
                <span style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#836EFD', fontWeight:'bold' }}>
                  TX History
                </span>
                <span style={{ fontSize:'11px', color:'#333', border:'1px solid #222', padding:'2px 8px', fontFamily:'monospace' }}>
                  {agHistory.length} tx
                </span>
              </div>
              {agHistory.length > 0 && (
                <button
                  onClick={() => setConfirmData({ isOpen:true, title:'HAPUS HISTORY TX?', message:'Semua riwayat transaksi akan dihapus.',
                    action:()=>{ setAgHistory([]); showAlert('History TX dihapus.','hapus'); } })}
                  style={{ background:'none', border:'1px solid #2a2a2a', color:'#444', padding:'5px 12px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
                  <FaTrash size={10}/> Clear
                </button>
              )}
            </div>

            {agHistory.length === 0 ? (
              <div style={{ padding:'32px', textAlign:'center', color:'#2a2a2a', fontSize:'12px' }}>
                Belum ada transaksi. History akan muncul setelah TX berhasil.
              </div>
            ) : (
              <div style={{ maxHeight:'420px', overflowY:'auto' }}>
                {agHistory.slice(0, 100).map((h, idx) => {
                  const histNet = h.description.includes('·')
                    ? networks.find(n => h.description.toLowerCase().includes(n.id.toLowerCase()) || h.description.toLowerCase().includes(n.name.toLowerCase()))
                    : null;
                  const timeStr = h.timestamp
                    ? new Date(h.timestamp).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                    : '—';
                  const isBatch = h.description.startsWith('[BATCH]');
                  return (
                    <div key={h.id ?? idx} style={{
                      display:'flex', alignItems:'flex-start', gap:'12px',
                      padding:'12px 18px', borderBottom:'1px solid #111',
                      transition:'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0d0d0d')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {/* status dot */}
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: h.status === 'success' ? '#4caf50' : h.status === 'failed' ? '#f44336' : '#ffaa00', flexShrink:0, marginTop:'5px' }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', flexWrap:'wrap' }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:'12px', fontWeight:'bold', color:'#ddd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {isBatch && <span style={{ fontSize:'10px', color:'#836EFD', border:'1px solid #836EFD44', padding:'1px 5px', marginRight:'6px', fontWeight:'normal' }}>BATCH</span>}
                              {h.taskName}
                            </div>
                            <div style={{ fontSize:'11px', color:'#555', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {h.description}
                            </div>
                          </div>
                          <span style={{ fontSize:'10px', color:'#444', whiteSpace:'nowrap', flexShrink:0 }}>{timeStr}</span>
                        </div>
                        {h.txHash && (
                          <div style={{ marginTop:'6px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                            <code style={{ fontSize:'10px', color:'#555', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'220px' }}>
                              {h.txHash}
                            </code>
                            <button
                              onClick={() => copyText(h.txHash!, `hist_${h.id}`)}
                              style={{ background:'none', border:'none', color: copiedKey === `hist_${h.id}` ? '#4caf50' : '#333', cursor:'pointer', padding:'2px', flexShrink:0 }}
                              title="Salin TX Hash">
                              {copiedKey === `hist_${h.id}` ? <FaCheckCircle size={10}/> : <FaCopy size={10}/>}
                            </button>
                            {histNet?.explorerUrl && (
                              <a href={`${histNet.explorerUrl}/tx/${h.txHash}`} target="_blank" rel="noreferrer"
                                style={{ fontSize:'10px', color:'#836EFD', textDecoration:'none', display:'flex', alignItems:'center', gap:'3px', flexShrink:0 }}>
                                <FaLink size={9}/> Explorer ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {agHistory.length > 100 && (
                  <div style={{ padding:'12px', textAlign:'center', fontSize:'11px', color:'#333' }}>
                    Menampilkan 100 dari {agHistory.length} tx terakhir
                  </div>
                )}
              </div>
            )}
          </div>
        </>
  );
}