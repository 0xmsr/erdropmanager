import { ethers } from 'ethers';
import type { RPCNetwork, DetectedToken, ChainlistChain, EvmWalletTx, EvmTokenDetail } from './types';
import { AUTO_SELECTOR_MAP, BLOCKSCOUT_HOSTS, PINATA_API_BASE, PINATA_GATEWAY, CHAINLIST_API_URL } from './constants';

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

// ── Nama standar token fungible per network EVM. Secara teknis BEP-20 (BNB
// Smart Chain) adalah interface yang identik dengan ERC-20, tapi penamaan
// standarnya beda — jadi label di UI harus ikut chain aktif, bukan selalu
// hardcode "ERC-20", supaya gak salah kaprah waktu network aktifnya BNB
// (mainnet chainId 56 / testnet chainId 97).
export function getEvmTokenStandardLabel(chainId?: number | null): string {
  return chainId === 56 || chainId === 97 ? 'BEP-20' : 'ERC-20';
}

// ── Harga fiat (USD/IDR) buat native coin — dipakai nunjukin nilai fiat dari
// estimasi gas fee saat kirim (mis. "0.0001 ETH" ke user gak kebayang nilainya,
// tapi "≈ $0.32 / Rp 5.100" langsung kebaca). Best-effort lewat CoinGecko
// public API (gratis, tanpa API key, rate limit longgar tapi tetap ada) —
// makanya di-cache singkat di memori biar gak spam request tiap render/tick.
const COINGECKO_ID_MAP: Record<string, string> = {
  ETH:   'ethereum',
  MATIC: 'matic-network',
  BNB:   'binancecoin',
  AVAX:  'avalanche-2',
  FTM:   'fantom',
  CRO:   'crypto-com-chain',
  CELO:  'celo',
  GLMR:  'moonbeam',
  MOVR:  'moonriver',
  KLAY:  'klay-token',
  MNT:   'mantle',
  SOL:   'solana',
  TRX:   'tron',
  ATOM:  'cosmos',
  AXM:   'axiome',
  GRAM:  'the-open-network',
  TON:   'the-open-network',
};

const FIAT_PRICE_CACHE_TTL_MS = 30000;
const fiatPriceCache: Record<string, { data: { usd: number | null; idr: number | null }; ts: number }> = {};

// Ambil harga native coin dalam USD & IDR sekaligus (satu request), berdasarkan
// symbol-nya (ETH, BNB, SOL, TRX, ATOM, AXM, GRAM/TON, dst). Symbol yang gak
// ada mapping-nya (mis. token testnet: tBNB, MON, PHRS) otomatis balik null —
// UI tinggal skip nampilin badge fiat-nya, bukan error.
export async function fetchFiatPrice(symbol: string): Promise<{ usd: number | null; idr: number | null }> {
  const id = COINGECKO_ID_MAP[(symbol || '').toUpperCase()];
  if (!id) return { usd: null, idr: null };

  const cached = fiatPriceCache[id];
  if (cached && Date.now() - cached.ts < FIAT_PRICE_CACHE_TTL_MS) return cached.data;

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,idr`);
    if (!res.ok) return cached?.data ?? { usd: null, idr: null };
    const json = await res.json();
    const usd = typeof json?.[id]?.usd === 'number' ? json[id].usd : null;
    const idr = typeof json?.[id]?.idr === 'number' ? json[id].idr : null;
    const data = { usd, idr };
    fiatPriceCache[id] = { data, ts: Date.now() };
    return data;
  } catch {
    return cached?.data ?? { usd: null, idr: null };
  }
}

// Format nilai fiat dari jumlah native coin (mis. estimasi gas fee) + harga
// yang sudah didapat dari fetchFiatPrice(). Sengaja gak pernah nampilin "$0.00"
// / "Rp0" polos buat nilai kecil-tapi-bukan-nol — itu justru bikin gas fee
// keliatan "gratis" padahal ada nilainya, cuma kecil. Makanya dibulatkan ke
// bawah minimum yang masih bermakna ("< $0.01" / "< Rp 1").
export function formatGasFiat(
  nativeAmount: number,
  price: { usd: number | null; idr: number | null } | null | undefined,
  currency: 'usd' | 'idr',
): string | null {
  if (!price || !isFinite(nativeAmount) || nativeAmount <= 0) return null;
  const rate = price[currency];
  if (rate === null || rate === undefined || !isFinite(rate)) return null;

  const value = nativeAmount * rate;
  if (currency === 'idr') {
    if (value < 1) return '< Rp 1';
    return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
  }
  if (value < 0.01) return '< $0.01';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// ── Impor RPC / Network dari Chainlist (chainid.network/chains.json) ──
// Chainlist adalah database publik berisi ribuan EVM chain (mainnet & testnet)
// beserta daftar RPC publiknya. Dipakai supaya user tidak perlu isi manual
// Chain ID / RPC URL / Explorer satu-satu — cukup cari nama chain-nya.
//
// Banyak entri RPC di chains.json memakai placeholder API key milik provider
// pihak ketiga, misal "https://mainnet.infura.io/v3/${INFURA_API_KEY}" — URL
// seperti ini tidak bisa langsung dipakai tanpa API key sendiri, jadi
// disaring keluar. Hanya RPC https:// polos (tanpa placeholder ${...}) yang
// diambil, maksimal 5 per chain supaya form tidak kebanjiran.
let chainlistCache: ChainlistChain[] | null = null;
let chainlistCachePromise: Promise<ChainlistChain[]> | null = null;

function isUsableChainlistRpc(url: string): boolean {
  return /^https:\/\//i.test(url) && !url.includes('${') && !url.includes('API_KEY');
}

export async function fetchChainlistChains(forceRefresh = false): Promise<ChainlistChain[]> {
  if (chainlistCache && !forceRefresh) return chainlistCache;
  if (chainlistCachePromise && !forceRefresh) return chainlistCachePromise;

  chainlistCachePromise = (async () => {
    const res = await fetch(CHAINLIST_API_URL);
    if (!res.ok) throw new Error(`Gagal mengambil data Chainlist (HTTP ${res.status}).`);
    const raw: any[] = await res.json();
    const cleaned: ChainlistChain[] = raw
      .filter(c => c && typeof c.chainId === 'number' && c.name && c.nativeCurrency)
      .map(c => ({
        name: c.name,
        chain: c.chain || '',
        chainId: c.chainId,
        shortName: c.shortName || String(c.chainId),
        nativeCurrency: {
          name: c.nativeCurrency?.name || c.nativeCurrency?.symbol || 'Token',
          symbol: c.nativeCurrency?.symbol || '???',
          decimals: c.nativeCurrency?.decimals ?? 18,
        },
        rpc: (Array.isArray(c.rpc) ? c.rpc : []).filter(isUsableChainlistRpc).slice(0, 5),
        explorers: Array.isArray(c.explorers) ? c.explorers : [],
        infoURL: c.infoURL,
      }))
      .filter(c => c.rpc.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    chainlistCache = cleaned;
    return cleaned;
  })();

  try {
    return await chainlistCachePromise;
  } finally {
    chainlistCachePromise = null;
  }
}

// Konversi 1 entri Chainlist menjadi bentuk form Tambah/Edit Network
// (Omit<RPCNetwork,'id'> & { rpcRaw: string }) yang dipakai NetworksTab.
export function chainlistChainToNetForm(c: ChainlistChain) {
  return {
    name: c.name,
    chainId: c.chainId,
    symbol: c.nativeCurrency.symbol,
    rpcUrls: c.rpc,
    rpcRaw: c.rpc.join('\n'),
    explorerUrl: c.explorers?.[0]?.url || '',
    color: '#01a2ff',
  };
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

// ── Fallback generik buat network yang gak punya instance Blockscout publik
// (lihat BLOCKSCOUT_HOSTS). Routescan (routescan.io) index 70+ chain EVM dan
// nyediain endpoint bergaya Etherscan classic API TANPA butuh API key sama
// sekali di free tier (2 req/detik, 10rb call/hari, "apikey" boleh diisi
// string apa aja) — cukup modal Chain ID mentah, jadi otomatis nyakup semua
// network di daftar RPCNetwork user selama Routescan udah nge-index chain
// itu. Kalau chain-nya belum ke-index Routescan, endpoint ini balikin
// status:'0' dan kita lempar error biasa (bukan Blockscout-only error lagi). ──
const ROUTESCAN_ETHERSCAN_BASE = 'https://api.routescan.io/v2/network/mainnet/evm';

async function routescanEtherscanCall(chainId: number, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, apikey: 'noKeyRequired' }).toString();
  const res = await fetch(`${ROUTESCAN_ETHERSCAN_BASE}/${chainId}/etherscan/api?${qs}`);
  if (!res.ok) throw new Error(`Routescan HTTP ${res.status}`);
  const json = await res.json();
  // Format balikannya gaya Etherscan classic: { status:'1'|'0', message, result }
  if (json?.status === '0' && !Array.isArray(json?.result)) {
    throw new Error(json?.result || json?.message || 'Chain ini belum ter-index Routescan.');
  }
  return json?.result;
}

// Mapper generik format Etherscan-classic (dipakai buat balikan Routescan,
// yang formatnya kompatibel persis dengan Etherscan classic API).
function mapEtherscanTxItems(items: any[]): EvmWalletTx[] {
  return items.slice(0, 12).map((it) => {
    let valueEth = '0';
    try { valueEth = ethers.utils.formatEther(String(it?.value ?? '0')); } catch { }
    return {
      hash: it?.hash ?? '',
      from: it?.from ?? '',
      to: it?.to || null,
      value: valueEth,
      timestamp: it?.timeStamp ? parseInt(it.timeStamp, 10) : null,
      status: it?.isError === '1' ? 'failed' : it?.txreceipt_status === '0' ? 'failed' : 'success',
      methodGuess: it?.functionName ? String(it.functionName).split('(')[0] : (it?.methodId ?? null),
    } as EvmWalletTx;
  }).filter(t => t.hash);
}

// ── Riwayat TX wallet (dipakai kartu "Riwayat Transaksi" di tab Kirim/Terima)
// Endpoint & parsing-nya sengaja disamakan persis dengan fetchAddressRecentTxs
// di Explorer.tsx, supaya baris yang tampil di Kirim/Terima cocok 1:1 dengan
// yang muncul saat user klik "Lihat di Explorer" untuk address/tx yang sama.
// Urutan fallback: Blockscout (kalau network ada di BLOCKSCOUT_HOSTS) →
// Routescan (tanpa API key, tapi gak nyakup semua chain — mis. BNB gak
// ke-index). ──
export async function fetchEvmAddressTxHistory(
  address: string,
  networkId: string,
  chainId?: number,
): Promise<EvmWalletTx[]> {
  const host = BLOCKSCOUT_HOSTS[networkId];
  if (host) {
    const res = await fetch(`https://${host}/api/v2/addresses/${address}/transactions`);
    if (!res.ok) throw new Error(`Gagal mengambil riwayat transaksi dari Blockscout (HTTP ${res.status}).`);
    const json = await res.json();
    const items: any[] = Array.isArray(json?.items) ? json.items : [];
    return items.slice(0, 12).map((it) => {
      let valueEth = '0';
      try { valueEth = ethers.utils.formatEther(String(it?.value ?? '0')); } catch { }
      return {
        hash: it?.hash ?? '',
        from: it?.from?.hash ?? it?.from ?? '',
        to: it?.to?.hash ?? it?.to ?? null,
        value: valueEth,
        timestamp: it?.timestamp ? Math.floor(new Date(it.timestamp).getTime() / 1000) : null,
        status: it?.status === 'ok' ? 'success' : it?.status === 'error' ? 'failed' : 'pending',
        methodGuess: it?.method ?? null,
      } as EvmWalletTx;
    }).filter(t => t.hash);
  }

  if (!chainId) {
    throw new Error('Riwayat transaksi belum didukung untuk network ini (Chain ID tidak diketahui, gak bisa fallback ke Routescan).');
  }

  try {
    const result = await routescanEtherscanCall(chainId, {
      module: 'account', action: 'txlist', address, sort: 'desc', page: '1', offset: '12',
    });
    return mapEtherscanTxItems(Array.isArray(result) ? result : []);
  } catch (e: any) {
    throw new Error(
      `Riwayat transaksi gak tersedia dari Blockscout maupun Routescan untuk network ini (${e?.message || 'Routescan gagal.'}).`
    );
  }
}

// ── Detail token (dipakai kartu "Detail Token" saat mode Kirim = Token) —
// endpoint & parsing-nya sama persis dengan fetchTokenInfoBlockscout di
// Explorer.tsx, dipakai buat Token Page kalau address yang dicari adalah
// kontrak token. Kalau network-nya gak ada di BLOCKSCOUT_HOSTS, fallback-nya
// BUKAN explorer lain, tapi baca langsung dari kontrak via RPC (network wajib
// dikasih buat opsi ini) — jalan di chain APA AJA yang RPC-nya nyala, tanpa
// API key dan tanpa gantung ke indexer pihak ketiga. Konsekuensinya: field
// yang cuma ada di indexer (harga, market cap, jumlah holder, icon) gak akan
// keisi lewat jalur ini — cuma identitas token on-chain (name/symbol/decimals/
// totalSupply) yang bisa didapat. ──
const ERC20_DETAIL_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
];

export async function fetchEvmTokenDetail(address: string, networkId: string, network?: RPCNetwork): Promise<EvmTokenDetail | null> {
  const host = BLOCKSCOUT_HOSTS[networkId];
  if (host) {
    const res = await fetch(`https://${host}/api/v2/tokens/${address}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Gagal mengambil detail token dari Blockscout (HTTP ${res.status}).`);
    const j = await res.json();
    if (!j || (!j.symbol && !j.name)) return null;
    const decimals = j.decimals != null ? parseInt(j.decimals, 10) : null;
    const priceUsd = j.exchange_rate != null ? parseFloat(j.exchange_rate) : null;
    const totalSupplyFormatted = j.total_supply && decimals != null
      ? ethers.utils.formatUnits(j.total_supply, decimals) : (j.total_supply ?? null);
    return {
      address,
      name: j.name ?? null,
      symbol: j.symbol ?? null,
      decimals,
      totalSupply: totalSupplyFormatted,
      standard: j.type ?? 'ERC-20',
      holdersCount: j.holders != null ? parseInt(j.holders, 10) : null,
      iconUrl: j.icon_url ?? null,
      priceUsd,
      marketCapUsd: priceUsd != null && totalSupplyFormatted ? priceUsd * parseFloat(totalSupplyFormatted) : null,
    };
  }

  if (!network) {
    throw new Error('Detail token belum didukung untuk network ini (belum ada instance Blockscout, dan RPC network gak dikasih buat fallback).');
  }

  try {
    const provider = await getProvider(network);
    const c = new ethers.Contract(address, ERC20_DETAIL_ABI, provider);
    const [name, symbol, decimals, totalSupplyRaw] = await Promise.all([
      c.name().catch(() => null),
      c.symbol().catch(() => null),
      c.decimals().catch(() => null),
      c.totalSupply().catch(() => null),
    ]);
    if (!name && !symbol) return null; // bukan kontrak ERC-20 yang valid
    const totalSupplyFormatted = totalSupplyRaw != null && decimals != null
      ? ethers.utils.formatUnits(totalSupplyRaw, decimals) : null;
    return {
      address,
      name: name ?? null,
      symbol: symbol ?? null,
      decimals: decimals != null ? Number(decimals) : null,
      totalSupply: totalSupplyFormatted,
      standard: 'ERC-20',
      holdersCount: null, // gak ada indexer → gak bisa dihitung dari RPC
      iconUrl: null,
      priceUsd: null,
      marketCapUsd: null,
    };
  } catch (e: any) {
    throw new Error(`Gagal membaca detail token langsung dari kontrak via RPC (${e?.message || 'RPC error'}).`);
  }
}

// ── Fallback deteksi token via RPC langsung (tanpa Blockscout) — dipakai
// kalau Blockscout error/timeout ATAU baliknya kosong padahal wallet
// sebenarnya pegang token (indexer publik Blockscout kadang belum sempat
// nangkep token yang baru aja diterima). Caranya: scan mundur event log
// Transfer ERC-20 ke address ini langsung dari RPC, lalu cek balanceOf tiap
// kontrak yang ketemu. Cakupannya dibatasi RPC_SCAN_MAX_LOOKBACK block
// terakhir supaya tidak membebani RPC publik. Logic ini sengaja disamakan
// persis dengan fetchTokenPortfolioViaRpc di Explorer.tsx. ──
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const RPC_SCAN_BLOCK_RANGE = 5000;   // ukuran per panggilan eth_getLogs
const RPC_SCAN_MAX_LOOKBACK = 50000; // total block maksimal yang di-scan mundur

const ERC20_MINI_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
];

function addressToTopic(addr: string): string {
  return '0x' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

async function scanLogsBackward(
  provider: ethers.providers.JsonRpcProvider,
  topics: (string | null)[],
  opts: { maxResults?: number; maxLookback?: number } = {}
): Promise<ethers.providers.Log[]> {
  const maxResults = opts.maxResults ?? 40;
  const maxLookback = opts.maxLookback ?? RPC_SCAN_MAX_LOOKBACK;
  const head = await provider.getBlockNumber();
  const floor = Math.max(0, head - maxLookback);

  // Bagi seluruh rentang lookback jadi potongan RPC_SCAN_BLOCK_RANGE block,
  // lalu tembak SEMUA potongan itu sekaligus (Promise.all) alih-alih satu per
  // satu sekuensial. Dulu ini di-await dalam loop — dengan lookback 50.000
  // block & potongan 5.000, itu berarti sampai 10 round-trip RPC berurutan,
  // yang ke RPC publik bisa berujung puluhan detik. Ditembak paralel, total
  // waktunya dibatasi oleh respons paling lambat (biasanya cuma 1 round-trip),
  // bukan jumlah round-trip dikali latency.
  const ranges: { from: number; to: number }[] = [];
  for (let to = head; to > floor; to -= RPC_SCAN_BLOCK_RANGE) {
    const from = Math.max(floor, to - RPC_SCAN_BLOCK_RANGE + 1);
    ranges.push({ from, to });
  }

  const chunkResults = await Promise.all(
    ranges.map(({ from, to }) =>
      provider.getLogs({ fromBlock: from, toBlock: to, topics }).catch(() => [] as ethers.providers.Log[])
    )
  );

  const collected = chunkResults.flat();
  return collected.length > maxResults ? collected.slice(0, maxResults) : collected;
}

export async function fetchEvmTokenPortfolioViaRpc(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
  opts: { maxLookback?: number } = {},
): Promise<DetectedToken[]> {
  const addrTopic = addressToTopic(address);
  const logs = await scanLogsBackward(provider, [ERC20_TRANSFER_TOPIC, null, addrTopic], {
    maxResults: 200,
    maxLookback: opts.maxLookback,
  });
  const tokenAddrs = Array.from(new Set(logs.map(l => l.address))).slice(0, 20);
  if (tokenAddrs.length === 0) return [];

  const results = await Promise.all(tokenAddrs.map(async (tokenAddr): Promise<DetectedToken | null> => {
    try {
      const c = new ethers.Contract(tokenAddr, ERC20_MINI_ABI, provider);
      const [balRaw, decimals, symbol] = await Promise.all([
        c.balanceOf(address),
        c.decimals().catch(() => 18),
        c.symbol().catch(() => '???'),
      ]);
      if (balRaw.isZero()) return null;
      const balance = parseFloat(ethers.utils.formatUnits(balRaw, decimals));
      return {
        chain: 'evm', address: tokenAddr, symbol, name: symbol,
        decimals, balance,
        balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
        usdPrice: null, usdValue: null,
      } as DetectedToken;
    } catch { return null; } // token non-standar / call gagal — lewati
  }));

  return results.filter((r: DetectedToken | null): r is DetectedToken => r !== null);
}

// ── Sumber pelengkap KEDUA (selain RPC log scan) khusus buat network yang
// gak punya instance Blockscout: tarik daftar kontrak token yang PERNAH
// keluar/masuk ke address ini dari histori ERC-20 transfer Routescan
// (module=account&action=tokentx — tanpa API key, jangkauannya SELURUH
// histori chain, gak dibatasi RPC_SCAN_MAX_LOOKBACK ±50.000 block seperti
// scan RPC di atas), lalu verifikasi saldo REAL-nya lewat balanceOf on-chain
// (bukan percaya angka dari indexer). Kalau chain-nya belum ke-index
// Routescan, cukup balikin array kosong — pemanggil tetap jalan pakai
// hasil RPC scan yang udah ada. ──
export async function fetchEvmTokenPortfolioViaRoutescan(
  chainId: number,
  address: string,
  provider: ethers.providers.JsonRpcProvider,
): Promise<DetectedToken[]> {
  let items: any[];
  try {
    const result = await routescanEtherscanCall(chainId, {
      module: 'account', action: 'tokentx', address, sort: 'desc', page: '1', offset: '200',
    });
    items = Array.isArray(result) ? result : [];
  } catch {
    return []; // chain belum ke-index Routescan / request gagal — gak fatal, cuma gak nambah apa-apa
  }

  const tokenAddrs = Array.from(new Set(items.map((it: any) => it?.contractAddress).filter(Boolean))).slice(0, 30);
  if (tokenAddrs.length === 0) return [];

  const results = await Promise.all(tokenAddrs.map(async (tokenAddr: string): Promise<DetectedToken | null> => {
    try {
      const c = new ethers.Contract(tokenAddr, ERC20_MINI_ABI, provider);
      const [balRaw, decimals, symbol] = await Promise.all([
        c.balanceOf(address),
        c.decimals().catch(() => 18),
        c.symbol().catch(() => '???'),
      ]);
      if (balRaw.isZero()) return null; // pernah transfer bukan berarti masih pegang saldo
      const balance = parseFloat(ethers.utils.formatUnits(balRaw, decimals));
      return {
        chain: 'evm', address: tokenAddr, symbol, name: symbol,
        decimals, balance,
        balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
        usdPrice: null, usdValue: null,
      } as DetectedToken;
    } catch { return null; }
  }));

  return results.filter((r: DetectedToken | null): r is DetectedToken => r !== null);
}

// ── Sumber pelengkap KEEMPAT, khusus buat chain yang gak punya Blockscout
// DAN gak beneran ke-cover Routescan tanpa API key (BNB Smart Chain adalah
// contoh utamanya — Routescan cuma nge-proxy chain 56 ke api.bscscan.com,
// yang WAJIB API key sejak 2021, jadi panggilan "tanpa API key" ke situ
// gagal diam-diam dan fetchEvmTokenPortfolioViaRoutescan balik [] kayak
// biasa. Ditambah RPC_SCAN_MAX_LOOKBACK ±50.000 block cuma nyakup hitungan
// JAM di chain se-cepat BSC (~1 block/detik), jadi token yang diterima lebih
// dari itu juga gak ketemu dari scan log). Akibatnya: 2 dari 3 sumber
// deteksi otomatis efektif MATI TOTAL buat BNB, dan token populer sekalipun
// (USDT, USDC, dst) bisa gak "ketemu" walau saldo-nya jelas ada on-chain.
//
// Fix: buat chain yang masuk daftar ini, cek balanceOf LANGSUNG ke daftar
// kontrak token paling umum di chain tsb — gak bergantung pada indexer atau
// jendela block sama sekali, cuma butuh RPC nyala. Bukan pengganti
// scan-log (token gak populer/gak ada di daftar tetap butuh itu atau nambah
// manual), tapi nutup celah paling sering kejadian: user pegang stablecoin
// / token besar yang GAK kedeteksi gara-gara 2 sumber lain di atas mati. ──
const KNOWN_TOKENS_BY_CHAIN: Record<number, string[]> = {
  56: [ // BNB Smart Chain Mainnet
    '0x55d398326f99059fF775485246999027B3197955', // USDT (Binance-Peg BSC-USD)
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
    '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
    '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', // DAI
    '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // CAKE (PancakeSwap)
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTCB
    '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // ETH (Binance-Peg)
  ],
};

export async function fetchKnownTokenBalances(
  provider: ethers.providers.Provider,
  address: string,
  chainId: number,
): Promise<DetectedToken[]> {
  const list = KNOWN_TOKENS_BY_CHAIN[chainId];
  if (!list || list.length === 0) return [];

  const results = await Promise.all(list.map(async (tokenAddr): Promise<DetectedToken | null> => {
    try {
      const c = new ethers.Contract(tokenAddr, ERC20_MINI_ABI, provider);
      const [balRaw, decimals, symbol] = await Promise.all([
        c.balanceOf(address),
        c.decimals().catch(() => 18),
        c.symbol().catch(() => '???'),
      ]);
      if (balRaw.isZero()) return null;
      const balance = parseFloat(ethers.utils.formatUnits(balRaw, decimals));
      return {
        chain: 'evm', address: tokenAddr, symbol, name: symbol,
        decimals, balance,
        balanceFormatted: balance.toLocaleString('en-US', { maximumFractionDigits: 6 }),
        usdPrice: null, usdValue: null,
      } as DetectedToken;
    } catch { return null; } // RPC gak support batch ini / kontrak gak respons — lewati diam-diam
  }));

  return results.filter((r: DetectedToken | null): r is DetectedToken => r !== null);
}


//    BUG #1 (SUDAH DIPERBAIKI): fetchEvmTokenPortfolio (Blockscout) cuma
//    nyakup sebagian chain (lihat BLOCKSCOUT_HOSTS). Tombol "Portofolio
//    Token" di tab Wallets dulu manggil itu TANPA fallback sama sekali —
//    sekarang satu fungsi gabungan ini dipakai di KEDUA tempat (Portofolio
//    Wallets tab & Token Picker Transfer tab) supaya konsisten.
//
//    BUG #2 (SUDAH DIPERBAIKI): fallback RPC di atas cuma dipicu kalau
//    Blockscout BENERAN error (blockscoutError terisi) — kalau Blockscout
//    SUKSES tapi balikannya cuma sebagian, fallback gak pernah kepicu.
//    Sempat diperbaiki dengan nambahin satu scan RPC RINGAN (cuma 1 panggilan
//    eth_getLogs, lookback pendek) yang jalan walau Blockscout sukses — tapi
//    ini ternyata masih belum cukup buat kasus paling umum: token meme/kecil
//    yang SUDAH LAMA dipegang (bukan baru diterima) tapi memang gak pernah
//    di-index Blockscout sama sekali (banyak instance Blockscout publik
//    nge-filter token yang dianggap spam/scam/likuiditas nol dari endpoint
//    address-tokens ini). Untuk kasus begini, nambah token itu manual lewat
//    contract address selalu berhasil (karena baca balanceOf langsung ke
//    kontrak), tapi otomatis-detect tetap gak pernah nemuin — bukan soal
//    timing/indexing lag, tapi memang sengaja gak dimasukkan indexer-nya.
//
//    BUG #3: Fix #2 di atas cuma nge-scan RPC_SCAN_RECENT_LOOKBACK
//    (±5.000 block terakhir), jadi token yang diterima lebih dari itu tetap
//    gak ketemu dari jalur RPC juga.
//
//    Fix #3: SELALU jalankan scan RPC PENUH (sampai RPC_SCAN_MAX_LOOKBACK /
//    ±50.000 block mundur, ~10 panggilan eth_getLogs) sebagai pelengkap —
//    baik Blockscout sukses maupun gagal — lalu gabungkan hasilnya dengan
//    token dari Blockscout (dedupe by address). Ini lebih mahal daripada scan
//    ringan, tapi picker/portofolio ini dipicu manual oleh user (buka modal /
//    klik refresh), bukan proses background yang jalan terus-menerus, jadi
//    biaya ekstranya sepadan demi gak ada lagi token yang "hilang" padahal
//    jelas-jelas dipegang.
//
//    BUG #4: Buat network yang emang gak ada di BLOCKSCOUT_HOSTS sama sekali
//    (BNB, Avalanche, Fantom, Cronos, Moonbeam, dst — lihat constants.ts),
//    Fix #3 di atas cuma ngasih 1 sumber (scan RPC, dibatasi ±50.000 block +
//    tergantung RPC publik yang lagi nyala). Kalau scan RPC itu kebetulan
//    nemu 0 token (RPC publik lagi rewel, atau token-nya diterima lebih dari
//    50.000 block lalu), yang tampil ke user pesan error Blockscout yang lama
//    ("Chain ini belum didukung...") — padahal Blockscout emang dari awal
//    gak pernah dicoba buat chain ini, jadi kesannya nyesatin.
//
//    Fix #4: tambah SUMBER KETIGA — Routescan (etherscan-compatible API,
//    tanpa API key, jangkauan seluruh histori chain lewat action=tokentx,
//    bukan cuma ±50.000 block kayak scan RPC) — dan susun ulang pesan error
//    finalnya biar jujur nyebut semua sumber yang beneran udah dicoba. ──
export async function fetchEvmTokenPortfolioWithFallback(
  address: string,
  network: RPCNetwork,
  provider?: ethers.providers.JsonRpcProvider,
): Promise<{ tokens: DetectedToken[]; error: string | null; usedRpcFallback: boolean }> {
  let tokens: DetectedToken[] = [];
  let blockscoutError: string | null = null;

  // BUG: sebelumnya fetchEvmTokenPortfolio SELALU dipanggil, lalu untuk chain
  // yang emang gak ada di BLOCKSCOUT_HOSTS (mis. BNB, Avalanche, Fantom, dst)
  // fungsi itu langsung throw "Chain ini belum didukung..." — pesan itu ikut
  // ketampung ke blockscoutError, lalu dianggap SAMA PERSIS kayak "Blockscout
  // beneran dicoba tapi gagal". Akibatnya pesan error final selalu bilang
  // "dicoba lewat Blockscout, scan RPC, dan Routescan" walaupun Blockscout-nya
  // sendiri gak pernah beneran ke-hit buat chain itu — nyesatin user pas
  // troubleshoot kenapa token gak kedeteksi. Fix: cek dulu apakah chain ini
  // punya instance Blockscout SEBELUM manggil, dan bedakan dua kasusnya
  // secara eksplisit lewat flag blockscoutSupported.
  const blockscoutSupported = !!BLOCKSCOUT_HOSTS[network.id];
  if (blockscoutSupported) {
    try {
      tokens = await fetchEvmTokenPortfolio(address, network.id);
    } catch (e: any) {
      blockscoutError = e?.message || 'Gagal mendeteksi token di address ini.';
    }
  }

  let usedRpcFallback = false;
  let rpcScanFailed = false;

  // Scan RPC penuh dijalankan TERLEPAS dari sukses/gagalnya Blockscout —
  // itu sumber data independen, jadi bisa nemuin token yang Blockscout
  // lewatkan (spam-filtered, belum ke-index, dll) tanpa peduli alasannya.
  try {
    const prov = provider ?? await getProvider(network);
    const rpcTokens = await fetchEvmTokenPortfolioViaRpc(prov, address);
    const known = new Set(tokens.map(t => t.address.toLowerCase()));
    const newlyFound = rpcTokens.filter(t => !known.has(t.address.toLowerCase()));
    if (newlyFound.length > 0) {
      tokens = [...tokens, ...newlyFound];
      usedRpcFallback = true;
    }

    // Sumber pelengkap ketiga — Routescan (etherscan-compatible, tanpa API
    // key). Beda dari scan RPC di atas: jangkauannya SELURUH histori chain
    // (gak dibatasi ±50.000 block), jadi nemuin token lama yang udah keluar
    // dari jendela lookback RPC. Cuma jalan kalau provider RPC di atas
    // berhasil connect (butuh buat verifikasi balanceOf on-chain).
    const routescanTokens = await fetchEvmTokenPortfolioViaRoutescan(network.chainId, address, prov);
    const knownAfterRpc = new Set(tokens.map(t => t.address.toLowerCase()));
    const newlyFoundRoutescan = routescanTokens.filter(t => !knownAfterRpc.has(t.address.toLowerCase()));
    if (newlyFoundRoutescan.length > 0) {
      tokens = [...tokens, ...newlyFoundRoutescan];
      usedRpcFallback = true;
    }

    // Sumber pelengkap KEEMPAT — cek balanceOf langsung ke daftar token
    // populer chain ini (lihat KNOWN_TOKENS_BY_CHAIN). Ini yang nutup celah
    // nyata di BSC: Routescan diam-diam gagal buat chain 56 (lihat komentar
    // di fetchKnownTokenBalances), jadi tanpa ini stablecoin/token besar
    // sekalipun bisa "gak kedeteksi" walau saldo-nya jelas ada.
    const knownListTokens = await fetchKnownTokenBalances(prov, address, network.chainId);
    const knownAfterRoutescan = new Set(tokens.map(t => t.address.toLowerCase()));
    const newlyFoundKnownList = knownListTokens.filter(t => !knownAfterRoutescan.has(t.address.toLowerCase()));
    if (newlyFoundKnownList.length > 0) {
      tokens = [...tokens, ...newlyFoundKnownList];
      usedRpcFallback = true;
    }
  } catch {
    // RPC-nya sendiri gagal connect (network bermasalah dll) — token dari
    // Blockscout (kalau ada) tetap ditampilkan apa adanya, Routescan juga
    // otomatis gak sempat dicoba karena butuh provider yang sama.
    rpcScanFailed = true;
  }

  // Blockscout kadang balikin entri tanpa contract address yang valid (field
  // kosong/null di respons API) — saring di sini biar item rusak begini gak
  // pernah bisa lolos ke pemanggil (baik Portofolio maupun Token Picker).
  const cleanTokens = tokens.filter(t => ethers.utils.isAddress(t.address));

  // Error cuma ditampilkan kalau BENERAN gak ketemu token dari SEMUA sumber
  // yang dicoba — pesannya disusun ulang di sini biar jujur soal sumber apa
  // aja yang udah dicoba, bukan sekadar nyalin pesan Blockscout lama.
  let finalError: string | null = null;
  if (cleanTokens.length === 0) {
    if (rpcScanFailed) {
      finalError = `Gagal mendeteksi token: RPC network gak bisa dihubungi${blockscoutSupported && blockscoutError ? ` (Blockscout juga gagal: ${blockscoutError})` : ''}. Cek koneksi / RPC network ini, atau tambah token secara manual lewat contract address.`;
    } else if (blockscoutSupported && blockscoutError) {
      finalError = `Tidak ada token terdeteksi di address ini (dicoba lewat Blockscout, scan RPC, dan Routescan). Kalau yakin address ini pegang token, tambahkan manual lewat contract address.`;
    } else if (!blockscoutSupported) {
      // Chain ini emang gak punya instance Blockscout publik (mis. BNB) — jangan
      // ngaku-ngaku "dicoba lewat Blockscout" biar user gak salah kira semua
      // sumber udah ditempuh padahal sebagiannya emang gak jalan buat chain ini.
      const hasKnownList = !!KNOWN_TOKENS_BY_CHAIN[network.chainId]?.length;
      finalError = `Tidak ada token terdeteksi di address ini (chain ini belum ada instance Blockscout publik, deteksi otomatis cuma lewat scan RPC${hasKnownList ? ', cek daftar token populer,' : ''} dan Routescan). Kalau yakin address ini pegang token, tambahkan manual lewat contract address.`;
    } else {
      finalError = null; // Blockscout sukses tapi memang kosong beneran — bukan error
    }
  }

  return {
    tokens: cleanTokens,
    error: finalError,
    usedRpcFallback,
  };
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
