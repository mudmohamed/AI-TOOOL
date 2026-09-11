/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TradeRecord } from '../types';

/**
 * Escapes a cell value for safe RFC 4180 CSV export.
 */
function escapeCsvCell(val: string | number | boolean | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts trade history records to a standard CSV string and triggers browser download.
 */
export function exportTradesToCsv(
  tradeHistory: TradeRecord[],
  filenamePrefix: string = 'deriv_recovery_trade_history'
): { success: boolean; count: number; error?: string } {
  if (!tradeHistory || tradeHistory.length === 0) {
    return { success: false, count: 0, error: 'No trade records to export' };
  }

  const headers = [
    'Trade ID',
    'Timestamp (Unix)',
    'Date Time',
    'Symbol',
    'Contract Type',
    'Target Digit / Value',
    'Stake ($)',
    'Payout ($)',
    'Net Profit ($)',
    'Status',
    'Recovery Step',
    'Entry Price',
    'Entry Digit',
    'Exit Price',
    'Exit Digit',
  ];

  const rows = tradeHistory.map((trade) => {
    const dateTimeStr = new Date(trade.timestamp).toISOString();
    return [
      escapeCsvCell(trade.id),
      escapeCsvCell(trade.timestamp),
      escapeCsvCell(dateTimeStr),
      escapeCsvCell(trade.symbol),
      escapeCsvCell(trade.contractType),
      escapeCsvCell(trade.targetValue),
      escapeCsvCell(trade.stake.toFixed(2)),
      escapeCsvCell(trade.payout.toFixed(2)),
      escapeCsvCell(trade.profit.toFixed(2)),
      escapeCsvCell(trade.status),
      escapeCsvCell(trade.recoveryStep),
      escapeCsvCell(trade.entryPrice.toFixed(4)),
      escapeCsvCell(trade.entryDigit),
      escapeCsvCell(trade.exitPrice !== undefined ? trade.exitPrice.toFixed(4) : ''),
      escapeCsvCell(trade.exitDigit !== undefined ? trade.exitDigit : ''),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${timestampStr}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, count: tradeHistory.length };
}
