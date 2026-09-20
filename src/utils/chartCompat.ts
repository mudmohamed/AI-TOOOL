export function calculateSMA(prices: number[], period = 10): number {
  if (prices.length === 0) return 0;
  const slice = prices.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return Number((sum / slice.length).toFixed(4));
}

export function calculateSMASeries(prices: number[], period = 10): number[] {
  if (!prices.length) return [];
  const result: number[] = [];
  for (let i = 0; i < prices.length; i += 1) {
    const start = Math.max(0, i - period + 1);
    const windowSlice = prices.slice(start, i + 1);
    const sum = windowSlice.reduce((acc, val) => acc + val, 0);
    result.push(Number((sum / windowSlice.length).toFixed(4)));
  }
  return result;
}
