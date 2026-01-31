
import { Transaction, ProcessedTransaction } from '../types';

/**
 * Parses a string of CSV data into an array of Transaction objects
 */
export const parseCSV = (csvText: string): any[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Handle potential BOM or weird characters in header
  const rawHeaders = lines[0].split(',');
  const headers = rawHeaders.map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const entry: any = {};
    headers.forEach((header, index) => {
      // Clean quotes from values
      let val = values[index] || '';
      val = val.replace(/^["']|["']$/g, '');
      entry[header] = val;
    });
    return entry;
  });
};

/**
 * Robust helper to format dates from various patterns (8-Aug-25, 8/18/2025, etc.) to "MMM D, YYYY"
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Normalize delimiters to simplify parsing
  const cleanStr = dateStr.trim();
  
  // Try Slash Format: M/D/YYYY or D/M/YYYY
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      let m = parseInt(parts[0], 10);
      let d = parseInt(parts[1], 10);
      let y = parts[2];
      
      // Heuristic: if first part is > 12, it's likely D/M/Y
      if (m > 12) {
        [m, d] = [d, m];
      }
      
      if (y.length === 2) y = `20${y}`;
      const mName = (m > 0 && m <= 12) ? monthNames[m - 1] : parts[0];
      return `${mName} ${d}, ${y}`;
    }
  }

  // Try Hyphen Format: D-MMM-YY or D-MM-YYYY
  if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      let dStr = parts[0];
      let mStr = parts[1];
      let yStr = parts[2];
      
      if (yStr.length === 2) yStr = `20${yStr}`;
      
      let mName = mStr;
      // If month is a number (e.g. 08-08-2025)
      if (!isNaN(parseInt(mStr, 10))) {
        const mIdx = parseInt(mStr, 10);
        mName = (mIdx > 0 && mIdx <= 12) ? monthNames[mIdx - 1] : mStr;
      } else {
        // If month is a string (e.g. Aug)
        mName = mStr.charAt(0).toUpperCase() + mStr.slice(1, 3).toLowerCase();
      }
      
      return `${mName} ${parseInt(dStr, 10)}, ${yStr}`;
    }
  }

  // Fallback to Javascript's native Date parser for other patterns
  const parsed = new Date(cleanStr);
  if (!isNaN(parsed.getTime())) {
    return `${monthNames[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
  }

  return dateStr;
};

/**
 * Robust helper to parse amount strings like "($198.52)", "-$198.52", or "198.52" to numeric -198.52
 */
export const parseAmountToNumber = (amountStr: string): number => {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  
  const trimmed = amountStr.trim();
  // Detect negative indicators: parentheses or a minus sign
  const isNegative = trimmed.includes('(') || trimmed.includes('-');
  
  // Extract only digits and the decimal point
  const cleanNumeric = trimmed.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleanNumeric);
  
  if (isNaN(val)) return 0;
  return isNegative ? -val : val;
};

/**
 * Formats a number to a string like -$162.97 or $50.00
 */
export const formatAmount = (num: number): string => {
  const absNum = Math.abs(num).toFixed(2);
  // Add commas for thousands to maintain professional appearance
  const parts = absNum.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formattedAbs = parts.join('.');
  
  return num < 0 ? `-$${formattedAbs}` : `$${formattedAbs}`;
};

/**
 * Deduplicates and merges multiple sets of transactions
 */
export const mergeAndDeduplicate = (allTransactions: ProcessedTransaction[]): ProcessedTransaction[] => {
  const seen = new Set<string>();
  const result: ProcessedTransaction[] = [];

  allTransactions.forEach(t => {
    // Create a unique key for deduplication including the account to avoid cross-account collisions if necessary
    const key = `${t['Date']}|${t['Description']}|${t['Amount']}|${t['Account/Card']}`.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  });

  return result;
};

export type FileOrigin = 'EQ' | 'CIBC' | 'PC' | 'OTHER';

/**
 * Transforms transactions based on account type, handling filtering and column mapping
 */
export const processTransactions = (transactions: any[], accountName: string, origin: FileOrigin): ProcessedTransaction[] => {
  const filtered = transactions.filter(t => {
    const desc = (t['Description'] || '').trim().toUpperCase();

    if (origin === 'CIBC') {
      const forbidden = [
        "ROYAL BANK OF CANADA MONTREAL",
        "PAYMENT THANK YOU/PAIEMEN T MERCI"
      ];
      if (forbidden.includes(desc)) return false;
    }

    if (origin === 'PC') {
      const type = (t['Type'] || '').trim().toUpperCase();
      if (type === 'PAYMENT') return false;
    }

    return true;
  });

  return filtered.map(t => {
    let numericAmount = parseAmountToNumber(t['Amount']);
    
    // For CIBC files, ensure all amounts are negative as requested
    if (origin === 'CIBC') {
      numericAmount = -Math.abs(numericAmount);
    }

    // Handle column name variations
    const rawDate = t['Date'] || t['Transfer date'] || '';
    
    return {
      'Date': formatDate(rawDate),
      'Description': t['Description'] || '',
      'Amount': formatAmount(numericAmount),
      'Account/Card': accountName
    };
  });
};

/**
 * Converts transaction array back to CSV string
 */
export const convertToCSV = (data: ProcessedTransaction[]): string => {
  if (data.length === 0) return '';
  const headers: (keyof ProcessedTransaction)[] = ['Date', 'Description', 'Amount', 'Account/Card'];
  const csvRows = [headers.join(',')];

  data.forEach(row => {
    const values = headers.map(header => {
      const val = row[header] || '';
      // Escape commas and wrap in quotes if necessary
      return val.includes(',') ? `"${val}"` : val;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
};
