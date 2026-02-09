// powered coingecko & ExchangeRate
export interface CurrencyData {
  symbol: string;
  rate: number;
  code: string;
}

export interface CurrencyConfigType {
  USD: CurrencyData;
  IDR: CurrencyData;
  BTC: CurrencyData;
  ETH: CurrencyData;
}

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfigType = {
  USD: { symbol: '$', rate: 1, code: 'USD' },
  IDR: { symbol: 'Rp', rate: 0, code: 'IDR' },
  BTC: { symbol: '₿', rate: 0, code: 'BTC' },
  ETH: { symbol: '♦', rate: 0, code: 'ETH' },
};