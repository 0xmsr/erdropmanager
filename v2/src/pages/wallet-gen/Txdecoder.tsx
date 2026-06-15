
import React, { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { KNOWN_4BYTE, KNOWN_TOPICS } from './know';
import {
  FaSearch, FaCopy, FaCheckCircle, FaChevronDown, FaChevronUp,
  FaCode, FaList, FaExchangeAlt, FaGasPump, FaInfoCircle,
  FaFileCode, FaTerminal, FaLayerGroup, FaBolt, FaLink,
  FaExclamationTriangle, FaSpinner, FaGlobe,
} from 'react-icons/fa';

const TX_TYPES: Record<number, { label: string; color: string; eip: string; desc: string }> = {
  0: { label: 'Legacy',   color: '#888',    eip: 'Pre-EIP-155 / EIP-155', desc: 'Transaksi lama dengan gasPrice flat. Tidak punya proteksi replay chain (Pre-155) atau pakai chainId untuk proteksi (EIP-155).' },
  1: { label: 'Type 1',   color: '#f3ba2f', eip: 'EIP-2930',              desc: 'Menambahkan Access List — daftar alamat & storage slot yang akan diakses. Menghemat gas untuk kontrak yang sudah diketahui.' },
  2: { label: 'Type 2',   color: '#01a2ff', eip: 'EIP-1559',              desc: 'Fee Market baru: maxFeePerGas (batas atas) + maxPriorityFeePerGas (tip ke miner/validator). Base fee dibakar oleh jaringan.' },
  3: { label: 'Type 3',   color: '#e81899', eip: 'EIP-4844 (Blob)',       desc: 'Blob-carrying transactions untuk Proto-Danksharding. Membawa blob data besar (128 KB) off-chain via KZG commitment.' },
};

const ABI_TYPES_STATIC = ['uint256','uint128','uint64','uint32','uint16','uint8','int256','int128','int64','int32','int16','int8','address','bool','bytes32','bytes16','bytes8','bytes4','bytes1'];
const ABI_TYPES_DYNAMIC = ['string','bytes'];

function hex(n: bigint | number, pad = 0) {
  return '0x' + BigInt(n).toString(16).padStart(pad, '0');
}

function formatGwei(wei: bigint) {
  const g = Number(wei) / 1e9;
  return g < 0.001 ? `${wei} wei` : `${g.toFixed(4)} Gwei`;
}

function formatEther(wei: bigint) {
  const e = Number(wei) / 1e18;
  return e.toFixed(10).replace(/\.?0+$/, '') + ' ETH';
}

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : '—';
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

interface DecodedParam {
  name: string;
  type: string;
  value: string;
  raw: string;
  note?: string;
}

interface DecodedCall {
  selector: string;
  signature: string | null;
  knownSig: string | null;
  params: DecodedParam[];
  raw: string;
  error?: string;
}

function decodeSlot(hex32: string, abiType: string): string {
  try {
    const h = hex32.replace(/^0x/, '').padStart(64, '0');
    if (abiType === 'address') return '0x' + h.slice(24);
    if (abiType === 'bool')    return BigInt('0x' + h) === 0n ? 'false' : 'true';
    if (abiType.startsWith('uint') || abiType.startsWith('int')) {
      const signed = abiType.startsWith('int');
      const bits   = parseInt(abiType.replace(/^u?int/, '') || '256');
      let val      = BigInt('0x' + h);
      if (signed && (val >> BigInt(bits - 1)) === 1n) val -= (1n << BigInt(bits));
      return val.toString();
    }
    if (abiType.startsWith('bytes') && abiType !== 'bytes') {
      const size = parseInt(abiType.replace('bytes', '')) || 32;
      return '0x' + h.slice(0, size * 2);
    }
    return '0x' + h;
  } catch {
    return '0x' + hex32.replace(/^0x/, '');
  }
}

function decodeCalldata(data: string): DecodedCall {
  const raw = data.startsWith('0x') ? data : '0x' + data;
  if (raw.length < 10) return { selector: '', signature: null, knownSig: null, params: [], raw, error: 'Data terlalu pendek (<4 byte)' };

  const selector = raw.slice(2, 10).toLowerCase();
  const knownSig = KNOWN_4BYTE[selector] ?? null;
  const body     = raw.slice(10);

  const params: DecodedParam[] = [];
  if (knownSig) {
    const inner   = knownSig.slice(knownSig.indexOf('(') + 1, knownSig.lastIndexOf(')'));
    const typeList = inner ? inner.split(',').map(t => t.trim()) : [];

    let offset = 0;
    typeList.forEach((abiType, i) => {
      const slot = body.slice(offset, offset + 64);
      if (!slot) return;
      const isDynamic = abiType === 'string' || abiType === 'bytes' || abiType.endsWith('[]');
      const value = isDynamic
        ? `[offset: 0x${BigInt('0x' + slot).toString(16)}] (dynamic — lihat raw)`
        : decodeSlot(slot, abiType);
      let note: string | undefined;
      if (abiType === 'address') note = `checksum: ${ethers.utils.getAddress('0x' + slot.slice(24).padStart(40, '0'))}`;
      if (abiType === 'uint256' && BigInt('0x' + slot) > 10n ** 15n) {
        note = `≈ ${formatEther(BigInt('0x' + slot))} (jika 18 decimals)`;
      }

      params.push({ name: `param${i}`, type: abiType, value, raw: '0x' + slot, note });
      offset += 64;
    });
  } else {
    for (let i = 0; i < Math.min(body.length / 64, 10); i++) {
      const slot = body.slice(i * 64, (i + 1) * 64);
      if (slot.length < 64) break;
      const stripped = slot.replace(/^0{24}/, '');
      let guessType  = 'bytes32';
      let guessVal   = '0x' + slot;
      if (slot.slice(0, 24) === '0'.repeat(24) && stripped.length === 40) {
        guessType = 'address (tebakan)';
        guessVal  = '0x' + stripped;
      } else {
        try {
          const bn = BigInt('0x' + slot);
          if (bn < 2n ** 128n) { guessType = 'uint256 (tebakan)'; guessVal = bn.toString(); }
        } catch {}
      }
      params.push({ name: `slot${i}`, type: guessType, value: guessVal, raw: '0x' + slot });
    }
  }

  return { selector, signature: knownSig, knownSig, params, raw };
}

interface DecodedLog {
  address: string;
  topic0: string;
  knownEvent: { sig: string; desc: string; category: string } | null;
  topics: string[];
  data: string;
  decodedTopics: { index: number; name: string; value: string; type: string }[];
}

function decodeLog(log: { address: string; topics: string[]; data: string }): DecodedLog {
  const topic0    = (log.topics?.[0] ?? '').slice(2).toLowerCase();
  const knownEvent = KNOWN_TOPICS[topic0] ?? null;

  const decodedTopics: DecodedLog['decodedTopics'] = [];
  if (knownEvent) {
    const inner     = knownEvent.sig.slice(knownEvent.sig.indexOf('(') + 1, knownEvent.sig.lastIndexOf(')'));
    const typeList   = inner ? inner.split(',').map(t => t.trim()) : [];
    let topicIndex  = 1; // topics[0] = event sig
    typeList.forEach((t, i) => {
      const raw = log.topics?.[topicIndex];
      if (!raw) return;
      const value = decodeSlot(raw.slice(2), t);
      decodedTopics.push({ index: topicIndex, name: `param${i}`, type: t, value });
      topicIndex++;
    });
  }

  return {
    address: log.address,
    topic0: log.topics?.[0] ?? '',
    knownEvent,
    topics: log.topics ?? [],
    data: log.data ?? '0x',
    decodedTopics,
  };
}

export interface ParsedTx {
  // Identitas
  hash:         string;
  type:         number;
  // Block
  blockNumber:  number | null;
  blockHash:    string | null;
  timestamp:    number | null;
  // Addresses
  from:         string;
  to:           string | null;
  // Value
  value:        bigint;
  nonce:        number;
  // Gas — Legacy
  gasPrice?:    bigint;
  // Gas — EIP-1559
  maxFeePerGas?:         bigint;
  maxPriorityFeePerGas?: bigint;
  // Gas umum
  gasLimit:     bigint;
  gasUsed?:     bigint;
  // EIP-2930
  accessList?: { address: string; storageKeys: string[] }[];
  // EIP-4844
  maxFeePerBlobGas?: bigint;
  blobVersionedHashes?: string[];
  // Data
  data:         string;
  // Receipt
  status?:      number; // 1 = sukses, 0 = reverted
  logs?:        { address: string; topics: string[]; data: string }[];
  // Decoded
  decodedCall?: DecodedCall;
  decodedLogs?: DecodedLog[];
  // Chain
  chainId?:     number;
  // Fee aktual
  effectiveGasPrice?: bigint;
  fee?:              bigint;
}

async function fetchAndParseTx(
  hashOrRaw: string,
  rpcUrl: string,
  onLog?: (msg: string) => void,
): Promise<ParsedTx> {
  const log = onLog ?? (() => {});
  const trimmed = hashOrRaw.trim();

  // ─── Mode 1: Raw RLP hex ───
  if (trimmed.startsWith('0x') && trimmed.length > 66) {
    log('Mendeteksi raw tx RLP, parsing lokal…');
    return parseRawTx(trimmed);
  }

  // ─── Mode 2: TX Hash — fetch dari RPC ───
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error('Input harus berupa tx hash (0x…64 hex) atau raw RLP hex');
  }

  log(`Fetching tx dari RPC: ${rpcUrl}…`);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const [txRaw, receipt] = await Promise.allSettled([
    provider.send('eth_getTransactionByHash', [trimmed]),
    provider.send('eth_getTransactionReceipt', [trimmed]),
  ]);

  const tx      = txRaw.status === 'fulfilled' ? txRaw.value : null;
  const rcpt    = receipt.status === 'fulfilled' ? receipt.value : null;

  if (!tx) throw new Error('Transaksi tidak ditemukan di RPC');
  log('Tx ditemukan, parsing…');

  let timestamp: number | null = null;
  if (tx.blockHash) {
    try {
      const block = await provider.send('eth_getBlockByHash', [tx.blockHash, false]);
      timestamp   = block?.timestamp ? parseInt(block.timestamp, 16) : null;
    } catch { /* ignore */ }
  }

  const type     = parseInt(tx.type ?? '0', 16);
  const gasUsed  = rcpt?.gasUsed  ? BigInt(rcpt.gasUsed)  : undefined;
  const effGP    = rcpt?.effectiveGasPrice ? BigInt(rcpt.effectiveGasPrice) : undefined;
  const fee      = gasUsed && effGP ? gasUsed * effGP : undefined;
  const logs     = rcpt?.logs ?? [];
  const data     = tx.input ?? '0x';

  const decodedCall = data && data !== '0x' ? decodeCalldata(data) : undefined;
  const decodedLogs = logs.map((l: any) => decodeLog(l));

  return {
    hash:         tx.hash,
    type,
    blockNumber:  tx.blockNumber ? parseInt(tx.blockNumber, 16) : null,
    blockHash:    tx.blockHash ?? null,
    timestamp,
    from:         tx.from ?? '',
    to:           tx.to ?? null,
    value:        BigInt(tx.value ?? '0x0'),
    nonce:        parseInt(tx.nonce ?? '0', 16),
    gasPrice:     tx.gasPrice  ? BigInt(tx.gasPrice)  : undefined,
    maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
    maxFeePerBlobGas: tx.maxFeePerBlobGas ? BigInt(tx.maxFeePerBlobGas) : undefined,
    blobVersionedHashes: tx.blobVersionedHashes,
    accessList:  tx.accessList,
    gasLimit:    BigInt(tx.gas ?? '0x5208'),
    gasUsed,
    data,
    status:      rcpt?.status ? parseInt(rcpt.status, 16) : undefined,
    logs,
    decodedCall,
    decodedLogs,
    chainId:     tx.chainId ? parseInt(tx.chainId, 16) : undefined,
    effectiveGasPrice: effGP,
    fee,
  };
}

function parseRawTx(raw: string): ParsedTx {
  try {
    const tx = ethers.utils.parseTransaction(raw);
    const type = tx.type ?? 0;
    const data = tx.data ?? '0x';
    return {
      hash:                tx.hash ?? '(unsigned)',
      type,
      blockNumber:         null,
      blockHash:           null,
      timestamp:           null,
      from:                tx.from ?? '(unsigned)',
      to:                  tx.to ?? null,
      value:               BigInt(tx.value?.toString() ?? '0'),
      nonce:               tx.nonce,
      gasPrice:            tx.gasPrice  ? BigInt(tx.gasPrice.toString())  : undefined,
      maxFeePerGas:        tx.maxFeePerGas ? BigInt(tx.maxFeePerGas.toString()) : undefined,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas.toString()) : undefined,
      accessList:          (tx as any).accessList,
      gasLimit:            BigInt(tx.gasLimit.toString()),
      data,
      chainId:             tx.chainId,
      decodedCall:         data !== '0x' ? decodeCalldata(data) : undefined,
    };
  } catch (e: any) {
    throw new Error('Gagal parse raw RLP: ' + e?.message);
  }
}

interface AbiHint {
  selector: string;
  signature: string | null;
  source: 'known' | 'bytecode';
}

interface BytecodeAnalysis {
  totalBytes: number;
  // Constructor args (setelah STOP 0x00 marker)
  constructorArgs: string | null;
  constructorArgCount: number;
  // 4-byte selectors ditemukan di bytecode
  detectedSelectors: AbiHint[];
  // Pola tipikal
  patterns: { label: string; color: string; desc: string }[];
  // Init code vs runtime split
  hasMetadata: boolean;
  metadataOffset: number | null;
  swarmHash: string | null;
  ipfsHash: string | null;
  // Ukuran bagian
  initCodeSize: number | null;
  runtimeSize: number | null;
}

function extractSelectorsFromBytecode(hex: string): AbiHint[] {
  const body = hex.replace(/^0x/, '').toLowerCase();
  const found = new Map<string, AbiHint>();

  for (const [sel, sig] of Object.entries(KNOWN_4BYTE)) {
    if (body.includes(sel)) {
      found.set(sel, { selector: sel, signature: sig, source: 'known' });
    }
  }

  for (let i = 0; i < body.length - 10; i += 2) {
    const opcode = body.slice(i, i + 2);
    if (opcode === '63') { // PUSH4
      const sel = body.slice(i + 2, i + 10);
      if (!found.has(sel) && /^[0-9a-f]{8}$/.test(sel)) {
        found.set(sel, { selector: sel, signature: KNOWN_4BYTE[sel] ?? null, source: 'bytecode' });
      }
    }
  }

  return Array.from(found.values()).slice(0, 40); // max 40
}

function detectMetadata(hex: string): { offset: number | null; swarmHash: string | null; ipfsHash: string | null; hasMetadata: boolean } {
  const body = hex.replace(/^0x/, '').toLowerCase();
  const swarmMatch = body.match(/a165627a7a72305820([0-9a-f]{64})0029/);
  if (swarmMatch) {
    const offset = body.indexOf(swarmMatch[0]);
    return { offset: offset / 2, swarmHash: swarmMatch[1], ipfsHash: null, hasMetadata: true };
  }

  const ipfsMatch = body.match(/a2646970667358221220([0-9a-f]{64})64736f6c63/);
  if (ipfsMatch) {
    const offset = body.indexOf(ipfsMatch[0]);
    return { offset: offset / 2, ipfsHash: ipfsMatch[1], swarmHash: null, hasMetadata: true };
  }

  return { offset: null, swarmHash: null, ipfsHash: null, hasMetadata: false };
}

function detectPatterns(hex: string): BytecodeAnalysis['patterns'] {
  const body = hex.replace(/^0x/, '').toLowerCase();
  const out: BytecodeAnalysis['patterns'] = [];

  if (body.includes('363d3d37') || body.includes('5af43d82')) {
    out.push({ label: 'EIP-1167 Minimal Proxy', color: '#61dfff', desc: 'Clone factory pattern — delegatecall ke implementation contract' });
  }
  if (body.includes('f4') && body.includes('calldatacopy'.toLowerCase())) {
    out.push({ label: 'Proxy (DELEGATECALL)', color: '#836efd', desc: 'Pola proxy: mendelegasikan panggilan ke contract lain' });
  }

  // Ownership: a9059cbb = transfer, 8da5cb5b = owner()
  if (body.includes('8da5cb5b')) {
    out.push({ label: 'Ownable', color: '#f3ba2f', desc: 'Contract punya fungsi owner() — pola kepemilikan' });
  }

  // Pausable: 5c975abb = paused()
  if (body.includes('5c975abb')) {
    out.push({ label: 'Pausable', color: '#ff9800', desc: 'Contract bisa di-pause (Pausable pattern)' });
  }

  // ERC-20: a9059cbb = transfer, 70a08231 = balanceOf, 18160ddd = totalSupply
  const erc20Sigs = ['a9059cbb', '70a08231', '18160ddd', 'dd62ed3e'];
  const erc20Count = erc20Sigs.filter(s => body.includes(s)).length;
  if (erc20Count >= 3) {
    out.push({ label: 'ERC-20 Token', color: '#01a2ff', desc: `${erc20Count}/4 fungsi wajib ERC-20 terdeteksi` });
  }

  // ERC-721: 6352211e = ownerOf, b88d4fde = safeTransferFrom
  const erc721Sigs = ['6352211e', 'b88d4fde', '42842e0e', 'e985e9c5'];
  const erc721Count = erc721Sigs.filter(s => body.includes(s)).length;
  if (erc721Count >= 2) {
    out.push({ label: 'ERC-721 NFT', color: '#e81899', desc: `${erc721Count}/4 fungsi wajib ERC-721 terdeteksi` });
  }

  // Lock/Timelock pola: biasanya ada storage timestamp + require(block.timestamp >= ...)
  // TIMESTAMP opcode = 42, LT = 10, require biasanya JUMPI (57)
  const timestampOp = '42';
  const tsIdx = body.indexOf(timestampOp);
  if (tsIdx !== -1 && body.includes('57')) {
    // Hitung frekuensi TIMESTAMP opcode
    const tsCount = (body.match(/(?<=^|(?<=..))42(?=..)/g) ?? []).length;
    if (tsCount >= 2) {
      out.push({ label: '⏰ Time-Lock / Vesting', color: '#4caf50', desc: `Opcode TIMESTAMP (0x42) ditemukan ${tsCount}x — kemungkinan ada logika lock/unlock berbasis waktu` });
    }
  }

  // Self-destruct: ff
  if (body.includes('ff')) {
    out.push({ label: '⚠ SELFDESTRUCT', color: '#f44336', desc: 'Opcode SELFDESTRUCT (0xFF) ada dalam bytecode — contract bisa dihancurkan' });
  }

  // CREATE2
  if (body.includes('f5')) {
    out.push({ label: 'CREATE2', color: '#9c27b0', desc: 'Menggunakan CREATE2 untuk deploy contract dengan alamat deterministik' });
  }

  return out;
}

function analyzeBytecode(data: string): BytecodeAnalysis {
  const body = data.replace(/^0x/, '').toLowerCase();
  const totalBytes = Math.floor(body.length / 2);

  const { offset: metadataOffset, swarmHash, ipfsHash, hasMetadata } = detectMetadata(body);

  // Estimasi init code vs runtime — cari CODECOPY (39) + RETURN (f3) pola
  // Ini heuristik, bukan pasti
  let initCodeSize: number | null = null;
  let runtimeSize: number | null = null;
  if (hasMetadata && metadataOffset !== null) {
    runtimeSize = metadataOffset;
    initCodeSize = totalBytes - runtimeSize;
  }

  // Constructor args: jika bytecode panjang dan ada data setelah metadata
  let constructorArgs: string | null = null;
  let constructorArgCount = 0;
  if (hasMetadata && metadataOffset !== null) {
    // Args biasanya ada di akhir setelah metadata hash
    const afterMeta = body.slice((metadataOffset + 43) * 2); // +43 bytes metadata
    if (afterMeta.length >= 64 && /^[0-9a-f]+$/.test(afterMeta)) {
      constructorArgs = '0x' + afterMeta;
      constructorArgCount = Math.floor(afterMeta.length / 64);
    }
  }

  const detectedSelectors = extractSelectorsFromBytecode(body);
  const patterns = detectPatterns(body);

  return {
    totalBytes,
    constructorArgs,
    constructorArgCount,
    detectedSelectors,
    patterns,
    hasMetadata,
    metadataOffset,
    swarmHash,
    ipfsHash,
    initCodeSize,
    runtimeSize,
  };
}

function DeploymentPanel({ data }: { data: string }) {
  const [rawOpen, setRawOpen] = useState(false);
  const [abiOpen, setAbiOpen] = useState(true);
  const analysis = React.useMemo(() => analyzeBytecode(data), [data]);

  return (
    <div>
      {/* ── Ringkasan ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.pink}`, padding: '12px' }}>
          <div style={S.label}>Ukuran Bytecode</div>
          <div style={{ fontFamily: COLORS.mono, fontSize: '14px', color: COLORS.pink }}>{analysis.totalBytes.toLocaleString()} bytes</div>
          <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>{(analysis.totalBytes / 24576 * 100).toFixed(1)}% dari batas 24 KB</div>
        </div>
        {analysis.runtimeSize !== null && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.purple}`, padding: '12px' }}>
            <div style={S.label}>Runtime Code</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '14px', color: COLORS.purple }}>~{analysis.runtimeSize.toLocaleString()} bytes</div>
          </div>
        )}
        <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.accent}`, padding: '12px' }}>
          <div style={S.label}>ABI Hints</div>
          <div style={{ fontFamily: COLORS.mono, fontSize: '14px', color: COLORS.accent }}>{analysis.detectedSelectors.length} selector</div>
          <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>
            {analysis.detectedSelectors.filter(s => s.signature).length} dikenali
          </div>
        </div>
        {analysis.constructorArgCount > 0 && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.gold}`, padding: '12px' }}>
            <div style={S.label}>Constructor Args</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '14px', color: COLORS.gold }}>{analysis.constructorArgCount} slot</div>
          </div>
        )}
      </div>

      {/* ── Pola Terdeteksi ── */}
      {analysis.patterns.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Pola Terdeteksi</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {analysis.patterns.map((p, i) => (
              <div key={i} style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${p.color}`, padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ ...S.tag(p.color), flexShrink: 0, fontSize: '10px' }}>{p.label}</span>
                <span style={{ fontSize: '12px', color: COLORS.muted, lineHeight: '1.5' }}>{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABI Hints (selectors terdeteksi) ── */}
      {analysis.detectedSelectors.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <button
            onClick={() => setAbiOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: '#070707', border: `1px solid ${COLORS.border}`, cursor: 'pointer', color: COLORS.text, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: abiOpen ? '8px' : 0 }}
          >
            <FaCode size={10} style={{ color: COLORS.accent }} />
            ABI Terdeteksi dari Bytecode ({analysis.detectedSelectors.length})
            <span style={{ marginLeft: 'auto', color: COLORS.muted }}>{abiOpen ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}</span>
          </button>
          {abiOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {analysis.detectedSelectors.map((s, i) => (
                <div key={i} style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${s.signature ? COLORS.accent : COLORS.muted}`, padding: '8px 12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontFamily: COLORS.mono, fontSize: '12px', color: COLORS.purple, flexShrink: 0 }}>0x{s.selector}</code>
                  {s.signature ? (
                    <span style={{ fontFamily: COLORS.mono, fontSize: '12px', color: COLORS.accent }}>{s.signature}</span>
                  ) : (
                    <span style={{ fontSize: '11px', color: COLORS.muted, fontStyle: 'italic' }}>Unknown selector</span>
                  )}
                  <span style={{ marginLeft: 'auto', ...S.tag(s.source === 'known' ? COLORS.gold : COLORS.muted), fontSize: '10px' }}>
                    {s.source === 'known' ? '✓ DB' : 'PUSH4'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Metadata Hash ── */}
      {analysis.hasMetadata && (
        <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.green}`, padding: '12px 14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Metadata Hash (Compiler Fingerprint)</div>
          {analysis.ipfsHash && (
            <div style={{ fontFamily: COLORS.mono, fontSize: '12px', color: COLORS.green }}>
              IPFS: <span style={{ color: COLORS.text }}>0x{analysis.ipfsHash}</span>
            </div>
          )}
          {analysis.swarmHash && (
            <div style={{ fontFamily: COLORS.mono, fontSize: '12px', color: COLORS.green }}>
              Swarm: <span style={{ color: COLORS.text }}>0x{analysis.swarmHash}</span>
            </div>
          )}
          {analysis.metadataOffset !== null && (
            <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>offset: byte {analysis.metadataOffset}</div>
          )}
          <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '6px', fontStyle: 'italic' }}>
            Hash ini bisa dipakai untuk verifikasi source code di Etherscan / Sourcify.
          </div>
        </div>
      )}

      {/* ── Constructor Args ── */}
      {analysis.constructorArgs && (
        <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.gold}`, padding: '12px 14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Constructor Arguments ({analysis.constructorArgCount} slot ABI-encoded)
          </div>
          {Array.from({ length: analysis.constructorArgCount }, (_, i) => {
            const slot = analysis.constructorArgs!.slice(2 + i * 64, 2 + (i + 1) * 64);
            // Tebak tipe
            const stripped = slot.replace(/^0{24}/, '');
            let guess = 'bytes32';
            let guessVal: string = '0x' + slot;
            if (slot.slice(0, 24) === '0'.repeat(24) && stripped.length === 40) {
              guess = 'address'; guessVal = '0x' + stripped;
            } else {
              try {
                const bn = BigInt('0x' + slot);
                if (bn < 2n ** 128n) { guess = 'uint256'; guessVal = bn.toString(); }
              } catch {}
            }
            return (
              <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <code style={{ fontFamily: COLORS.mono, fontSize: '11px', color: COLORS.muted, flexShrink: 0 }}>arg[{i}]</code>
                <code style={{ fontFamily: COLORS.mono, fontSize: '11px', color: COLORS.accent }}>{guess}</code>
                <span style={{ fontFamily: COLORS.mono, fontSize: '12px', color: COLORS.text, wordBreak: 'break-all' }}>{guessVal}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Raw Bytecode ── */}
      <button
        onClick={() => setRawOpen(o => !o)}
        style={{ background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: '5px 10px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: rawOpen ? '8px' : 0 }}
      >
        <FaCode size={10} /> {rawOpen ? 'Sembunyikan' : 'Tampilkan'} Raw Bytecode
      </button>
      {rawOpen && (
        <div style={{ background: '#060606', border: `1px solid ${COLORS.border}`, padding: '12px', fontFamily: COLORS.mono, fontSize: '11px', color: '#555', wordBreak: 'break-all', lineHeight: '1.8', maxHeight: '260px', overflowY: 'auto' }}>
          {data}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   KOMPONEN UTAMA
───────────────────────────────────────────── */

const COLORS = {
  bg:       '#0a0a0a',
  card:     '#0d0d0d',
  border:   '#1e1e1e',
  accent:   '#01a2ff',
  gold:     '#f3ba2f',
  green:    '#4caf50',
  red:      '#f44336',
  purple:   '#836efd',
  pink:     '#e81899',
  text:     '#c8c8c8',
  muted:    '#555',
  mono:     'monospace',
};

const S = {
  card: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    padding: '16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  label: {
    fontSize: '10px',
    color: COLORS.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '4px',
  },
  value: {
    fontSize: '13px',
    color: COLORS.text,
    fontFamily: COLORS.mono,
    wordBreak: 'break-all' as const,
  },
  mono: {
    fontFamily: COLORS.mono,
    fontSize: '12px',
    color: COLORS.accent,
    wordBreak: 'break-all' as const,
  },
  tag: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center' as const,
    gap: '4px',
    background: color + '22',
    border: `1px solid ${color}66`,
    color,
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
  }),
};

function Field({ label, value, color, copy }: { label: string; value: React.ReactNode; color?: string; copy?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={S.label}>{label}</div>
      <div style={{ ...S.value, color: color ?? COLORS.text, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <span style={{ flex: 1 }}>{value}</span>
        {copy && (
          <button
            onClick={() => { copyToClipboard(copy); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? COLORS.green : COLORS.muted, padding: '0 2px', flexShrink: 0 }}
          >
            {copied ? <FaCheckCircle size={11} /> : <FaCopy size={11} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...S.card, padding: '0' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: COLORS.text, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: open ? `1px solid ${COLORS.border}` : 'none' }}
      >
        <span style={{ color: COLORS.accent }}>{icon}</span>
        {title}
        <span style={{ marginLeft: 'auto', color: COLORS.muted }}>{open ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}</span>
      </button>
      {open && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  );
}

/* ─── Tampilan TX Type Badge ─── */
function TypeBadge({ type }: { type: number }) {
  const info = TX_TYPES[type] ?? { label: `Type ${type}`, color: '#888', eip: 'Unknown', desc: 'Tipe transaksi tidak dikenal.' };
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <span style={S.tag(info.color)}><FaBolt size={10} /> {info.label}</span>
        <span style={{ ...S.tag('#888'), fontWeight: 'normal' }}>{info.eip}</span>
      </div>
      <div style={{ fontSize: '12px', color: COLORS.muted, lineHeight: '1.6' }}>{info.desc}</div>
    </div>
  );
}

/* ─── Calldata Decoder Display ─── */
function CalldataPanel({ decoded }: { decoded: DecodedCall }) {
  const [rawOpen, setRawOpen] = useState(false);
  const [lookup4, setLookup4] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const lookup4Byte = async () => {
    setLooking(true);
    try {
      const res  = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${decoded.selector}`);
      const json = await res.json();
      const sig  = json?.results?.[0]?.text_signature ?? '(not found)';
      setLookup4(sig);
    } catch {
      setLookup4('(lookup failed — CORS/network)');
    }
    setLooking(false);
  };

  return (
    <div>
      {/* Selector row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <code style={{ ...S.mono, fontSize: '14px', fontWeight: 'bold', color: COLORS.purple }}>
          0x{decoded.selector}
        </code>
        {decoded.knownSig ? (
          <span style={S.tag(COLORS.gold)}><FaCheckCircle size={10} /> {decoded.knownSig}</span>
        ) : lookup4 ? (
          <span style={S.tag(COLORS.accent)}><FaGlobe size={10} /> {lookup4}</span>
        ) : (
          <button
            onClick={lookup4Byte}
            disabled={looking}
            style={{ ...S.tag(COLORS.accent), cursor: 'pointer', border: `1px solid ${COLORS.accent}` }}
          >
            {looking ? <><FaSpinner size={9} style={{ animation: 'spin 1s linear infinite' }} /> Lookup…</> : <><FaGlobe size={9} /> Lookup 4byte.directory</>}
          </button>
        )}
        {!decoded.knownSig && !lookup4 && (
          <span style={{ fontSize: '11px', color: COLORS.muted, fontStyle: 'italic' }}>Selector tidak dikenal di DB lokal</span>
        )}
      </div>

      {decoded.error && (
        <div style={{ color: COLORS.red, fontSize: '12px', marginBottom: '10px' }}>
          <FaExclamationTriangle size={11} style={{ marginRight: '5px' }} />
          {decoded.error}
        </div>
      )}

      {/* Parameter slots */}
      {decoded.params.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {decoded.params.map((p, i) => (
            <div key={i} style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${p.type.includes('address') ? COLORS.green : p.type.includes('uint') || p.type.includes('int') ? COLORS.gold : COLORS.purple}`, padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: COLORS.muted }}>{p.name}</span>
                <code style={{ fontSize: '11px', color: COLORS.accent, fontFamily: COLORS.mono }}>{p.type}</code>
              </div>
              <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.text, wordBreak: 'break-all' }}>
                {p.value}
              </div>
              {p.note && <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '4px', fontStyle: 'italic' }}>ℹ {p.note}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Raw calldata collapsible */}
      <button
        onClick={() => setRawOpen(o => !o)}
        style={{ background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: '5px 10px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: rawOpen ? '8px' : 0 }}
      >
        <FaCode size={10} /> {rawOpen ? 'Sembunyikan' : 'Tampilkan'} Raw Calldata
      </button>
      {rawOpen && (
        <div style={{ background: '#060606', border: `1px solid ${COLORS.border}`, padding: '12px', fontFamily: COLORS.mono, fontSize: '11px', color: '#666', wordBreak: 'break-all', lineHeight: '1.6' }}>
          {decoded.raw}
        </div>
      )}
    </div>
  );
}

/* ─── Event Log Display ─── */
function LogPanel({ log, index }: { log: DecodedLog; index: number }) {
  const [open, setOpen] = useState(false);
  const cat  = log.knownEvent?.category ?? 'Unknown';
  const catColors: Record<string, string> = {
    'ERC-20': COLORS.accent, 'ERC-721': COLORS.purple, 'ERC-1155': COLORS.pink,
    'DeFi': COLORS.gold, 'DEX': COLORS.green, 'Staking': '#9c27b0',
    'Access': '#ff6600', 'Governance': '#00e676', 'Proxy': '#61dfff',
    'Pausable': '#888', 'Unknown': COLORS.muted,
  };
  const color = catColors[cat] ?? COLORS.muted;

  return (
    <div style={{ ...S.card, marginBottom: '8px', borderLeft: `3px solid ${color}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0' }}
      >
        <span style={{ fontSize: '11px', color: COLORS.muted, fontFamily: COLORS.mono, flexShrink: 0 }}>#{index}</span>
        <div style={{ flex: 1 }}>
          {log.knownEvent ? (
            <>
              <div style={{ fontFamily: COLORS.mono, fontSize: '12px', color, fontWeight: 'bold' }}>{log.knownEvent.sig}</div>
              <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '2px' }}>{log.knownEvent.desc}</div>
            </>
          ) : (
            <div style={{ fontFamily: COLORS.mono, fontSize: '11px', color: COLORS.muted }}>Unknown Event · {shortAddr(log.topic0)}</div>
          )}
        </div>
        <span style={{ ...S.tag(color), flexShrink: 0 }}>{cat}</span>
        <span style={{ color: COLORS.muted, flexShrink: 0 }}>{open ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}</span>
      </button>

      {open && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={S.label}>Emitting Contract</div>
            <div style={S.mono}>{log.address}</div>
          </div>
          {log.decodedTopics.length > 0 && (
            <div>
              <div style={S.label}>Indexed Params (Topics)</div>
              {log.decodedTopics.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: '11px', color: COLORS.accent, fontFamily: COLORS.mono }}>topics[{t.index}]</code>
                  <span style={{ fontSize: '11px', color: COLORS.muted }}>{t.type}</span>
                  <span style={{ fontSize: '12px', color: COLORS.text, fontFamily: COLORS.mono, wordBreak: 'break-all' }}>{t.value}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <div style={S.label}>All Topics (raw)</div>
            {log.topics.map((t, i) => (
              <div key={i} style={{ fontFamily: COLORS.mono, fontSize: '11px', color: '#555', marginBottom: '2px' }}>
                [{i}] {t}
              </div>
            ))}
          </div>
          {log.data && log.data !== '0x' && (
            <div>
              <div style={S.label}>Data (non-indexed)</div>
              <div style={{ fontFamily: COLORS.mono, fontSize: '11px', color: '#555', wordBreak: 'break-all', background: '#060606', padding: '8px', border: `1px solid ${COLORS.border}` }}>
                {log.data}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Gas Fee Explainer ─── */
function GasPanel({ tx }: { tx: ParsedTx }) {
  const typeInfo = TX_TYPES[tx.type];
  return (
    <div>
      <TypeBadge type={tx.type} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
        {/* Common */}
        <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, padding: '12px' }}>
          <div style={S.label}>Gas Limit</div>
          <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.text }}>{tx.gasLimit.toString()}</div>
          <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>{hex(tx.gasLimit)}</div>
        </div>

        {tx.gasUsed !== undefined && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, padding: '12px' }}>
            <div style={S.label}>Gas Used</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.text }}>{tx.gasUsed.toString()}</div>
            <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>
              {((Number(tx.gasUsed) / Number(tx.gasLimit)) * 100).toFixed(1)}% dari limit
            </div>
          </div>
        )}

        {/* Type 0/1: gasPrice */}
        {tx.gasPrice !== undefined && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid #888`, padding: '12px' }}>
            <div style={S.label}>gasPrice (Legacy)</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.text }}>{formatGwei(tx.gasPrice)}</div>
            <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>Dibayar flat, tidak ada burn</div>
          </div>
        )}

        {/* Type 2: EIP-1559 */}
        {tx.maxFeePerGas !== undefined && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.accent}`, padding: '12px' }}>
            <div style={S.label}>maxFeePerGas (EIP-1559)</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.accent }}>{formatGwei(tx.maxFeePerGas)}</div>
            <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>Batas atas harga gas yang mau dibayar</div>
          </div>
        )}

        {tx.maxPriorityFeePerGas !== undefined && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.gold}`, padding: '12px' }}>
            <div style={S.label}>maxPriorityFeePerGas (Tip)</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.gold }}>{formatGwei(tx.maxPriorityFeePerGas)}</div>
            <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>Tip ke validator. Base fee dibakar 🔥</div>
          </div>
        )}

        {tx.effectiveGasPrice !== undefined && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.green}`, padding: '12px' }}>
            <div style={S.label}>effectiveGasPrice (aktual)</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.green }}>{formatGwei(tx.effectiveGasPrice)}</div>
            <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>= baseFee + priorityFee aktual</div>
          </div>
        )}

        {tx.fee !== undefined && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.red}`, padding: '12px' }}>
            <div style={S.label}>Total Fee Dibayar</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.red }}>{formatEther(tx.fee)}</div>
            <div style={{ fontSize: '10px', color: COLORS.muted, marginTop: '4px' }}>= gasUsed × effectiveGasPrice</div>
          </div>
        )}

        {/* Type 3: Blob */}
        {tx.maxFeePerBlobGas !== undefined && (
          <div style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.pink}`, padding: '12px' }}>
            <div style={S.label}>maxFeePerBlobGas (EIP-4844)</div>
            <div style={{ fontFamily: COLORS.mono, fontSize: '13px', color: COLORS.pink }}>{formatGwei(tx.maxFeePerBlobGas)}</div>
          </div>
        )}
      </div>

      {/* EIP-1559 formula explainer */}
      {tx.type === 2 && (
        <div style={{ marginTop: '14px', background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.accent}`, padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: COLORS.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>EIP-1559 Formula</div>
          <code style={{ fontFamily: COLORS.mono, fontSize: '12px', color: COLORS.text, lineHeight: '2' }}>
            effectiveGasPrice = min(maxFeePerGas, baseFee + maxPriorityFeePerGas)<br />
            totalFee = gasUsed × effectiveGasPrice<br />
            burned   = gasUsed × baseFee<br />
            tip      = gasUsed × priorityFee<br />
          </code>
          <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '8px' }}>
            Selisih <code style={{ color: COLORS.gold }}>maxFeePerGas − effectiveGasPrice</code> dikembalikan ke pengirim (refund).
          </div>
        </div>
      )}

      {/* Access List */}
      {tx.accessList && tx.accessList.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '11px', color: COLORS.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Access List (EIP-2930) — {tx.accessList.length} alamat
          </div>
          {tx.accessList.map((entry, i) => (
            <div key={i} style={{ background: '#070707', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.gold}`, padding: '10px 14px', marginBottom: '6px' }}>
              <div style={{ fontFamily: COLORS.mono, fontSize: '12px', color: COLORS.gold }}>{entry.address}</div>
              {entry.storageKeys.length > 0 && (
                <div style={{ marginTop: '6px' }}>
                  {entry.storageKeys.map((k, j) => (
                    <div key={j} style={{ fontFamily: COLORS.mono, fontSize: '11px', color: '#555', marginBottom: '2px' }}>storage[{j}]: {k}</div>
                  ))}
                </div>
              )}
              {entry.storageKeys.length === 0 && <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '4px' }}>Tidak ada storage key (warm address saja)</div>}
            </div>
          ))}
          <div style={{ fontSize: '11px', color: COLORS.muted, fontStyle: 'italic' }}>
            Access list mengurangi biaya gas storage read/write untuk slot yang terdaftar (warm storage = 100 gas vs 2100 gas cold).
          </div>
        </div>
      )}

      {/* Blob hashes */}
      {tx.blobVersionedHashes && tx.blobVersionedHashes.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '11px', color: COLORS.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Blob Versioned Hashes (EIP-4844)
          </div>
          {tx.blobVersionedHashes.map((h, i) => (
            <div key={i} style={{ fontFamily: COLORS.mono, fontSize: '11px', color: COLORS.pink, marginBottom: '4px' }}>[{i}] {h}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN TXDECODER COMPONENT
───────────────────────────────────────────── */

interface TxDecoderProps {
  defaultRpc?: string;
  networks?: { id: string; name: string; rpcUrls: string[]; color: string }[];
}

export const TxDecoder: React.FC<TxDecoderProps> = ({ defaultRpc = 'https://eth.llamarpc.com', networks = [] }) => {
  const [input,    setInput]    = useState('');
  const [rpc,      setRpc]      = useState(defaultRpc);
  const [loading,  setLoading]  = useState(false);
  const [logs,     setLogs]     = useState<string[]>([]);
  const [result,   setResult]   = useState<ParsedTx | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [copied,   setCopied]   = useState<string | null>(null);
  const [calldataInput, setCalldataInput] = useState('');
  const [calldataResult, setCalldataResult] = useState<DecodedCall | null>(null);
  const [tab,      setTab]      = useState<'fetch' | 'calldata'>('fetch');

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), msg]);

  const copy = (key: string, text: string) => {
    copyToClipboard(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const decode = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);
    try {
      const tx = await fetchAndParseTx(input.trim(), rpc, addLog);
      setResult(tx);
    } catch (e: any) {
      setError(e?.message ?? 'Error tidak diketahui');
    }
    setLoading(false);
  }, [input, rpc]);

  const decodeCalldata2 = () => {
    if (!calldataInput.trim()) return;
    setCalldataResult(decodeCalldata(calldataInput.trim()));
  };

  const statusColor = result?.status === 1 ? COLORS.green : result?.status === 0 ? COLORS.red : COLORS.muted;
  const statusLabel = result?.status === 1 ? '✓ Sukses' : result?.status === 0 ? '✗ Reverted' : 'Pending / Unknown';

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: COLORS.text }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '10px' }}>
        {(['fetch', 'calldata'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab === t ? COLORS.accent + '22' : 'none', border: `1px solid ${tab === t ? COLORS.accent : COLORS.border}`, color: tab === t ? COLORS.accent : COLORS.muted, padding: '7px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
            {t === 'fetch' ? <><FaSearch size={10} style={{ marginRight: '6px' }} />Decode TX</> : <><FaCode size={10} style={{ marginRight: '6px' }} />Decode Calldata</>}
          </button>
        ))}
      </div>

      {/* ── TAB: Fetch & Decode TX ── */}
      {tab === 'fetch' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && decode()}
              placeholder="TX Hash (0x…64) atau Raw RLP Hex (0x02…)"
              style={{ background: '#0d0d0d', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 14px', fontSize: '13px', fontFamily: COLORS.mono, outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
            <button
              onClick={decode}
              disabled={loading}
              style={{ background: COLORS.accent, color: '#000', border: 'none', padding: '10px 18px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <><FaSpinner size={11} style={{ animation: 'spin 1s linear infinite' }} /> Decoding…</> : <><FaSearch size={11} /> Decode</>}
            </button>
          </div>

          {/* RPC selector */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: COLORS.muted, flexShrink: 0 }}>RPC:</span>
            {networks.length > 0 ? (
              <select value={rpc} onChange={e => setRpc(e.target.value)}
                style={{ flex: 1, background: '#0d0d0d', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '5px 10px', fontSize: '12px', fontFamily: COLORS.mono }}>
                {networks.map(n => n.rpcUrls.map((url, i) => (
                  <option key={`${n.id}_${i}`} value={url}>[{n.name}] {url}</option>
                )))}
              </select>
            ) : (
              <input value={rpc} onChange={e => setRpc(e.target.value)}
                style={{ flex: 1, background: '#0d0d0d', border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: '5px 10px', fontSize: '12px', fontFamily: COLORS.mono, outline: 'none' }} />
            )}
          </div>

          {/* Logs */}
          {logs.length > 0 && !result && !error && (
            <div style={{ background: '#060606', border: `1px solid ${COLORS.border}`, padding: '10px', marginBottom: '12px' }}>
              {logs.map((l, i) => <div key={i} style={{ fontSize: '11px', color: COLORS.muted, fontFamily: COLORS.mono }}>{l}</div>)}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: COLORS.red + '11', border: `1px solid ${COLORS.red}44`, color: COLORS.red, padding: '12px 16px', marginBottom: '14px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <FaExclamationTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div>
              {/* ── Header Summary ── */}
              <div style={{ ...S.card, borderLeft: `3px solid ${statusColor}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={S.tag(statusColor)}>{statusLabel}</span>
                  <TypeBadge type={result.type} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <code style={{ fontFamily: COLORS.mono, fontSize: '12px', color: COLORS.purple, wordBreak: 'break-all' }}>{result.hash}</code>
                  <button onClick={() => copy('hash', result.hash)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === 'hash' ? COLORS.green : COLORS.muted }}>
                    {copied === 'hash' ? <FaCheckCircle size={11} /> : <FaCopy size={11} />}
                  </button>
                </div>
                {result.timestamp && (
                  <div style={{ fontSize: '12px', color: COLORS.muted }}>
                    {new Date(result.timestamp * 1000).toLocaleString('id-ID')} · Block #{result.blockNumber?.toLocaleString()}
                  </div>
                )}
              </div>

              {/* ── Identitas ── */}
              <Section title="Identitas Transaksi" icon={<FaInfoCircle size={12} />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0 24px' }}>
                  <Field label="From" value={result.from} color={COLORS.green} copy={result.from} />
                  <Field label="To" value={result.to ?? '(kontrak deployment)' } color={result.to ? COLORS.accent : COLORS.pink} copy={result.to ?? ''} />
                  <Field label="Value" value={`${formatEther(result.value)} (${result.value.toString()} wei)`} />
                  <Field label="Nonce" value={result.nonce.toString()} />
                  {result.chainId !== undefined && <Field label="Chain ID" value={result.chainId.toString()} />}
                </div>
              </Section>

              {/* ── Gas & Fee ── */}
              <Section title="Gas & Fee" icon={<FaGasPump size={12} />}>
                <GasPanel tx={result} />
              </Section>

              {/* ── Calldata ── */}
              {result.data && result.data !== '0x' && (
                <Section title={`Calldata${result.decodedCall?.signature ? ` — ${result.decodedCall.signature}` : ''}`} icon={<FaTerminal size={12} />}>
                  {result.decodedCall && <CalldataPanel decoded={result.decodedCall} />}
                </Section>
              )}

              {result.data === '0x' && (
                <div style={{ ...S.card, color: COLORS.muted, fontSize: '12px' }}>
                  <FaExchangeAlt size={11} style={{ marginRight: '7px' }} />
                  Transfer ETH murni — tidak ada calldata
                </div>
              )}

              {/* ── Deployment ── */}
              {result.to === null && result.data && result.data !== '0x' && (
                <Section title="Contract Deployment — Bytecode & ABI Analysis" icon={<FaLayerGroup size={12} />}>
                  <DeploymentPanel data={result.data} />
                </Section>
              )}

              {/* ── Event Logs ── */}
              {result.decodedLogs && result.decodedLogs.length > 0 && (
                <Section title={`Event Logs (${result.decodedLogs.length})`} icon={<FaList size={12} />} defaultOpen={false}>
                  {result.decodedLogs.map((log, i) => (
                    <LogPanel key={i} log={log} index={i} />
                  ))}
                </Section>
              )}

              {/* ── Raw JSON ── */}
              <Section title="Raw Data" icon={<FaFileCode size={12} />} defaultOpen={false}>
                <pre style={{ fontFamily: COLORS.mono, fontSize: '11px', color: '#555', background: '#060606', padding: '12px', overflow: 'auto', margin: 0, maxHeight: '300px', lineHeight: '1.6' }}>
                  {JSON.stringify({
                    hash: result.hash,
                    type: result.type,
                    from: result.from,
                    to: result.to,
                    value: result.value.toString(),
                    nonce: result.nonce,
                    gasLimit: result.gasLimit.toString(),
                    gasUsed: result.gasUsed?.toString(),
                    gasPrice: result.gasPrice?.toString(),
                    maxFeePerGas: result.maxFeePerGas?.toString(),
                    maxPriorityFeePerGas: result.maxPriorityFeePerGas?.toString(),
                    effectiveGasPrice: result.effectiveGasPrice?.toString(),
                    fee: result.fee?.toString(),
                    chainId: result.chainId,
                    blockNumber: result.blockNumber,
                    status: result.status,
                    data: result.data,
                    accessList: result.accessList,
                    blobVersionedHashes: result.blobVersionedHashes,
                  }, null, 2)}
                </pre>
              </Section>
            </div>
          )}
        </>
      )}
      {tab === 'calldata' && (
        <div>
          <p style={{ fontSize: '12px', color: COLORS.muted, marginTop: 0, marginBottom: '14px' }}>
            Paste calldata hex mentah (misalnya nilai <code style={{ color: COLORS.accent }}>input</code> dari eth_getTransactionByHash) untuk di-decode tanpa perlu TX hash atau RPC.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '16px' }}>
            <input
              value={calldataInput}
              onChange={e => setCalldataInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && decodeCalldata2()}
              placeholder="0xa9059cbb000000000000000000000000…"
              style={{ background: '#0d0d0d', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 14px', fontSize: '13px', fontFamily: COLORS.mono, outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
            <button onClick={decodeCalldata2}
              style={{ background: COLORS.accent, color: '#000', border: 'none', padding: '10px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaCode size={11} /> Decode
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: COLORS.muted, alignSelf: 'center' }}>Contoh:</span>
            {[
              { label: 'ERC-20 transfer', data: '0xa9059cbb000000000000000000000000dead000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a7640000' },
              { label: 'ERC-20 approve', data: '0x095ea7b3000000000000000000000000uniswapv2router000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' },
              { label: 'Uniswap swap', data: '0x38ed1739' },
            ].map((ex, i) => (
              <button key={i} onClick={() => { setCalldataInput(ex.data); }}
                style={{ background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>
                {ex.label}
              </button>
            ))}
          </div>

          {calldataResult && <CalldataPanel decoded={calldataResult} />}
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
};

export default TxDecoder;
