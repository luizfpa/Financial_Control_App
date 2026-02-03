
import { Transaction, ProcessedTransaction } from '../types';

/**
 * Normalizes monetary values (Handles Wealthsimple's specific characters)
 */
export const parseAmountToNumber = (amountStr: string): number => {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  const cleaned = amountStr
    .replace(/[−–—]/g, "-")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/CAD/gi, "")
    .replace(/\s/g, "")
    .trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

/**
 * Formats dates into "MMM D, YYYY" (e.g., Feb 1, 2026)
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const cleanStr = dateStr.trim().toLowerCase();
  const now = new Date();

  // Handle Relative Dates
  if (cleanStr === 'today') {
    return `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
  if (cleanStr === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    return `${monthNames[yesterday.getMonth()]} ${yesterday.getDate()}, ${yesterday.getFullYear()}`;
  }
  
  // Handle Standard and Long-form Dates (e.g., "February 1, 2026" or "2026-02-01")
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return `${monthNames[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
  }

  // Final Fallback for manual regex (ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [y, m, d] = dateStr.trim().split('-').map(Number);
    return `${monthNames[m - 1]} ${d}, ${y}`;
  }

  return dateStr;
};

export const parseCSV = (csvText: string): any[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 1) return [];
  const rawHeaders = lines[0].split(',');
  const headers = rawHeaders.map(h => h.trim().replace(/^["']|["']$/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());
    const entry: any = {};
    headers.forEach((header, index) => {
      let val = values[index] || '';
      entry[header] = val.replace(/^["']|["']$/g, '');
    });
    return entry;
  });
};

export const mergeAndDeduplicate = (allTransactions: ProcessedTransaction[]): ProcessedTransaction[] => {
  const seen = new Set<string>();
  const result: ProcessedTransaction[] = [];
  
  // Sort by date before deduplication to keep the most recent entries
  allTransactions.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
  
  allTransactions.forEach(t => {
    const key = `${t['Date']}|${t['Description']}|${t['Amount']}|${t['Account/Card']}`.toLowerCase().trim();
    if (!seen.has(key)) { 
      seen.add(key); 
      result.push(t); 
    }
  });
  return result;
};

export type FileOrigin = 'EQ' | 'CIBC' | 'PC' | 'WS' | 'OTHER';

export const processTransactions = (transactions: any[], accountName: string, origin: FileOrigin): ProcessedTransaction[] => {
  return transactions.map(t => {
    let rawAmount = t['Amount'] || t['amount'] || '';
    let numericAmount = parseAmountToNumber(String(rawAmount));
    
    // Reverse amounts for CIBC to match spending negative convention
    if (origin === 'CIBC') numericAmount = -Math.abs(numericAmount);
    
    let description = t['Description'] || t['description'] || 'No Description';
    
    // Clean description of excess whitespace
    description = description.replace(/\s+/g, ' ').trim();

    const rawDate = t['Date'] || t['date'] || t['Transfer date'] || '';
    
    // Map account source
    let finalSource = accountName;
    if (origin === 'WS') {
      finalSource = 'Wealthsimple';
    }
    
    return {
      'Date': formatDate(rawDate),
      'Description': description,
      'Amount': numericAmount < 0 ? `-$${Math.abs(numericAmount).toFixed(2)}` : `$${numericAmount.toFixed(2)}`,
      'Account/Card': finalSource
    };
  });
};

export const convertToCSV = (data: ProcessedTransaction[]): string => {
  if (data.length === 0) return '';
  const headers: (keyof ProcessedTransaction)[] = ['Date', 'Description', 'Amount', 'Account/Card'];
  const csvRows = [headers.join(',')];
  data.forEach(row => {
    const values = headers.map(header => {
      const val = row[header] || '';
      return val.includes(',') ? `"${val}"` : val;
    });
    csvRows.push(values.join(','));
  });
  return csvRows.join('\n');
};
