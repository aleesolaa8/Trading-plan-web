/** Catálogo de mercados: solo sugiere nombres. Los datos del contrato los introduce el usuario. */
export type MarketCategory = 'indices' | 'forex' | 'materias_primas' | 'cripto' | 'acciones' | 'futuros'

export const MARKET_CATEGORIES: Record<MarketCategory, string> = {
  indices: 'Índices',
  forex: 'Forex',
  materias_primas: 'Materias primas',
  cripto: 'Cripto',
  acciones: 'Acciones',
  futuros: 'Futuros',
}

const RAW: [string, string, MarketCategory][] = [
  ['US100', 'Nasdaq 100', 'indices'], ['US500', 'S&P 500', 'indices'], ['US30', 'Dow Jones', 'indices'],
  ['US2000', 'Russell 2000', 'indices'], ['GER40', 'DAX', 'indices'], ['UK100', 'FTSE 100', 'indices'],
  ['FRA40', 'CAC 40', 'indices'], ['ESP35', 'IBEX 35', 'indices'], ['EU50', 'Euro Stoxx 50', 'indices'],
  ['JP225', 'Nikkei 225', 'indices'], ['HK50', 'Hang Seng', 'indices'], ['AUS200', 'ASX 200', 'indices'],
  ['EURUSD', 'Euro / Dólar', 'forex'], ['GBPUSD', 'Libra / Dólar', 'forex'], ['USDJPY', 'Dólar / Yen', 'forex'],
  ['USDCHF', 'Dólar / Franco', 'forex'], ['AUDUSD', 'Dólar australiano', 'forex'], ['USDCAD', 'Dólar / Canadiense', 'forex'],
  ['NZDUSD', 'Dólar neozelandés', 'forex'], ['EURGBP', 'Euro / Libra', 'forex'], ['EURJPY', 'Euro / Yen', 'forex'],
  ['GBPJPY', 'Libra / Yen', 'forex'], ['EURCHF', 'Euro / Franco', 'forex'],
  ['XAUUSD', 'Oro', 'materias_primas'], ['XAGUSD', 'Plata', 'materias_primas'], ['WTI', 'Petróleo WTI', 'materias_primas'],
  ['BRENT', 'Petróleo Brent', 'materias_primas'], ['NATGAS', 'Gas natural', 'materias_primas'], ['COPPER', 'Cobre', 'materias_primas'],
  ['BTCUSD', 'Bitcoin', 'cripto'], ['ETHUSD', 'Ethereum', 'cripto'], ['SOLUSD', 'Solana', 'cripto'], ['XRPUSD', 'XRP', 'cripto'],
  ['AAPL', 'Apple', 'acciones'], ['MSFT', 'Microsoft', 'acciones'], ['NVDA', 'Nvidia', 'acciones'], ['TSLA', 'Tesla', 'acciones'],
  ['AMZN', 'Amazon', 'acciones'], ['META', 'Meta', 'acciones'], ['GOOGL', 'Alphabet', 'acciones'], ['SAN', 'Banco Santander', 'acciones'],
  ['NQ', 'E-mini Nasdaq', 'futuros'], ['ES', 'E-mini S&P 500', 'futuros'], ['FDAX', 'Futuro DAX', 'futuros'],
  ['GC', 'Futuro oro', 'futuros'], ['CL', 'Futuro crudo', 'futuros'],
]

export const MARKETS = RAW.map(([symbol, name, category]) => ({ symbol, name, category }))

/** Normaliza un mercado escrito a mano: mayúsculas, sin espacios extremos, máx. 30. */
export function normalizeMarket(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase().slice(0, 30)
}
