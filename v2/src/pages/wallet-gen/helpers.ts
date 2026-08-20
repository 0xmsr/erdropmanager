import { ethers } from 'ethers';
import type { RPCNetwork, DetectedToken } from './types';
import { AUTO_SELECTOR_MAP, BLOCKSCOUT_HOSTS, PINATA_API_BASE, PINATA_GATEWAY } from './constants';

export function encodeAutoAbi(funcSig: string, types: string[], values: any[]): string {
  const selector = AUTO_SELECTOR_MAP[funcSig] ?? '0x00000000';
  const encoded = values.map((v, i) => {
    if (types[i] === 'address') return String(v).toLowerCase().replace(/^0x/, '').padStart(64, '0');
    return BigInt(String(v)).toString(16).padStart(64, '0');
  }).join('');
  return selector + encoded;
}

export function parseAbiFunc(abiStr: string, funcName: string) {
  try {
    const abi = JSON.parse(abiStr);
    return abi.find((f: any) => f.name === funcName && f.type === 'function');
  } catch { return null; }
}

export function toIpfsUri(url: string): string {
  if (!url) return url;
  if (url.startsWith('ipfs://')) return url;
  const match = url.match(/\/ipfs\/([^/?#]+)(\/[^?#]*)?/);
  if (!match) return url;
  const [, cid, rest] = match;
  return `ipfs://${cid}${rest || ''}`;
}

export function shortAddr(addr: string) {
  return addr ? `${addr.slice(0,6)}...${addr.slice(-4)}` : '';
}

export function weiToEthStr(hexWei: string, dec = 6) {
  try {
    const wei = BigInt(hexWei);
    const whole = wei / BigInt('1000000000000000000');
    const frac  = wei % BigInt('1000000000000000000');
    return `${whole}.${frac.toString().padStart(18, '0').slice(0, dec)}`;
  } catch { return '0'; }
}

export function ethToHex(eth: string): string {
  try { return '0x' + BigInt(Math.floor(parseFloat(eth) * 1e18)).toString(16); } catch { return '0x0'; }
}

export function generateMnemonic(bits: 128|160|192|224|256): string {
  const entropy = ethers.utils.randomBytes(bits / 8);
  return ethers.utils.entropyToMnemonic(entropy);
}

export function deriveAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
  const child  = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
  return { address: child.address, privateKey: child.privateKey };
}

export async function pinataUploadFile(file: File | Blob, jwt: string, filename?: string): Promise<string> {
  const form = new FormData();
  form.append('file', file, filename || 'image');
  const res = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Upload file ke IPFS gagal (${res.status}). ${detail.slice(0, 150)}`);
  }
  const data = await res.json();
  if (!data?.IpfsHash) throw new Error('Upload ke IPFS gagal: respons Pinata tidak berisi IpfsHash.');
  return `${PINATA_GATEWAY}${data.IpfsHash}`;
}

export async function pinataUploadJson(json: Record<string, unknown>, jwt: string, name?: string): Promise<string> {
  const res = await fetch(`${PINATA_API_BASE}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      pinataContent: json,
      pinataMetadata: { name: name || 'metadata.json' },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Upload metadata JSON ke IPFS gagal (${res.status}). ${detail.slice(0, 150)}`);
  }
  const data = await res.json();
  if (!data?.IpfsHash) throw new Error('Upload ke IPFS gagal: respons Pinata tidak berisi IpfsHash.');
  return `${PINATA_GATEWAY}${data.IpfsHash}`;
}

export async function getProvider(network: RPCNetwork): Promise<ethers.providers.JsonRpcProvider> {
  for (const rpc of network.rpcUrls) {
    try {
      const p = new ethers.providers.JsonRpcProvider(rpc, { chainId: network.chainId, name: network.id });
      await Promise.race([
        p.getBlockNumber(),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 6000)),
      ]);
      return p;
    } catch { }
  }
  throw new Error(`Tidak dapat connect ke ${network.name}. Cek koneksi / RPC.`);
}

export async function fetchEvmTokenPortfolio(address: string, networkId: string): Promise<DetectedToken[]> {
  const host = BLOCKSCOUT_HOSTS[networkId];
  if (!host) {
    throw new Error(
      'Chain ini belum didukung untuk deteksi token otomatis (belum ada instance Blockscout publik). ' +
      'Coba: Ethereum, Base, Optimism, Arbitrum, Polygon, Gnosis, Celo, Scroll, zkSync Era, atau Sepolia.'
    );
  }
  const res = await fetch(`https://${host}/api/v2/addresses/${address}/tokens?type=ERC-20`);
  if (!res.ok) throw new Error(`Gagal ambil data token dari Blockscout (HTTP ${res.status}).`);
  const json = await res.json();
  const items: any[] = Array.isArray(json?.items) ? json.items : [];
  return items.map((it) => {
    const decimals = parseInt(it?.token?.decimals ?? '18', 10) || 0;
    const rawBal   = it?.value ?? '0';
    let balance = 0;
    try { balance = Number(BigInt(rawBal)) / Math.pow(10, decimals); } catch { balance = Number(rawBal) / Math.pow(10, decimals); }
    const priceStr = it?.token?.exchange_rate;
    const price    = priceStr !== null && priceStr !== undefined && priceStr !== '' ? parseFloat(priceStr) : null;
    return {
      chain: 'evm',
      address: it?.token?.address ?? '',
      symbol: it?.token?.symbol || '???',
      name: it?.token?.name || 'Unknown Token',
      decimals,
      balance,
      balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
      usdPrice: price !== null && !isNaN(price) ? price : null,
      usdValue: price !== null && !isNaN(price) ? balance * price : null,
      logo: it?.token?.icon_url || undefined,
    } as DetectedToken;
  });
}