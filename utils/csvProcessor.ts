
import { Transaction, ProcessedTransaction } from '../types';

/**
 * Normalizes monetary values (Handles Wealthsimple's specific characters and accounting notation)
 */
export const parseAmountToNumber = (amountStr: string): number => {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  let str = amountStr.trim();
  let multiplier = 1;
  
  // Handle (Amount) as negative (Accounting notation common in bank statements)
  if (str.startsWith('(') && str.endsWith(')')) {
    multiplier = -1;
    str = str.substring(1, str.length - 1);
  }

  const cleaned = str
    .replace(/[−–—]/g, "-")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/CAD/gi, "")
    .replace(/\s/g, "")
    .trim();
  
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val * multiplier;
};

const MONTH_MAP: Record<string, string> = {
  'january': 'Jan', 'february': 'Feb', 'march': 'Mar', 'april': 'Apr', 
  'may': 'May', 'june': 'Jun', 'july': 'Jul', 'august': 'Aug', 
  'september': 'Sep', 'october': 'Oct', 'november': 'Nov', 'december': 'Dec'
};

/**
 * Formats dates into "MMM D, YYYY" (e.g., Jan 29, 2026)
 * Strictly converts relative dates and handles long-form months.
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const cleanStr = dateStr.trim().toLowerCase();
  const now = new Date();

  // 1. Handle Relative Dates
  if (cleanStr.includes('today')) {
    return `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
  if (cleanStr.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    return `${monthNames[yesterday.getMonth()]} ${yesterday.getDate()}, ${yesterday.getFullYear()}`;
  }
  
  // 2. Pre-clean long months
  let processedStr = dateStr;
  Object.keys(MONTH_MAP).forEach(long => {
    const regex = new RegExp(long, 'gi');
    processedStr = processedStr.replace(regex, MONTH_MAP[long]);
  });

  // 3. Standard JS Parsing
  const parsed = new Date(processedStr);
  if (!isNaN(parsed.getTime())) {
    let year = parsed.getFullYear();
    // Heuristic: If parsing results in 2001 (often a default) or if the year seems shifted,
    // we only trust the year if it was explicitly in the input.
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) {
      year = parseInt(yearMatch[0], 10);
    } else if (year === 2001 || (year > now.getFullYear() + 1)) {
      // If no year in input, but parser produced one far in future or 2001, use current year
      year = now.getFullYear();
    }
    
    return `${monthNames[parsed.getMonth()]} ${parsed.getDate()}, ${year}`;
  }

  return dateStr;
};

/**
 * Robust CSV Parser that handles:
 * 1. Quoted fields ("Dec 31, 2025")
 * 2. Unquoted fields with commas (Jan 29, 2026 and $2,252.76) via splitting heuristic
 */
export const parseCSV = (csvText: string): any[] => {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 1) return [];

  const parseLine = (line: string) => {
    const row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    row.push(cur.trim());
    return row;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  return lines.slice(1).map(line => {
    let values = parseLine(line);
    
    // HEURISTIC: Fix the unquoted comma issue (Wealthsimple clipboard common case)
    if (headers.length === 4) {
      // Step 1: Fix Date split (e.g., "Dec 25" and "2025")
      if (values.length >= 5 && /^\d{4}$/.test(values[1].trim())) {
        const mergedDate = `${values[0]}, ${values[1]}`;
        values.splice(0, 2, mergedDate);
      }
      
      // Step 2: Fix Amount split (e.g., "$2" and "252.76 CAD")
      if (values.length === 5) {
        const p2 = values[2].trim();
        const p3 = values[3].trim();
        if (p2.includes('$') || p3.toLowerCase().includes('cad') || /^\d+\.?\d*$/.test(p3)) {
          const mergedAmt = `${values[2]},${values[3]}`;
          values.splice(2, 2, mergedAmt);
        }
      }
    }

    const entry: any = {};
    headers.forEach((header, index) => {
      let val = values[index] || '';
      entry[header] = val.trim().replace(/^["']|["']$/g, '');
    });
    return entry;
  });
};

export const mergeAndDeduplicate = (allTransactions: ProcessedTransaction[]): ProcessedTransaction[] => {
  const seen = new Set<string>();
  const result: ProcessedTransaction[] = [];
  
  // Sort by date (descending)
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
  return transactions
    .filter(t => {
      const desc = (t['Description'] || t['description'] || '').toUpperCase();
      
      // Specifically filter out unwanted CIBC rows
      if (origin === 'CIBC') {
        if (desc.includes('ROYAL BANK OF CANADA MONTREAL') || 
            desc.includes('PAYMENT THANK YOU') || 
            desc.includes('PAIEMEN T MERCI')) {
          return false;
        }
      }

      // Filter out unwanted PC rows (Payment type)
      if (origin === 'PC') {
        const type = (t['Type'] || t['type'] || '').toLowerCase();
        if (type === 'payment') {
          return false;
        }
      }

      return true;
    })
    .map(t => {
      let rawAmount = t['Amount'] || t['amount'] || '';
      let numericAmount = parseAmountToNumber(String(rawAmount));
      
      // CIBC amounts are usually purchases (negative for processing)
      if (origin === 'CIBC') numericAmount = -Math.abs(numericAmount);
      
      let description = t['Description'] || t['description'] || 'No Description';
      description = description.replace(/\s+/g, ' ').trim();

      // Support multiple date header variations
      const rawDate = t['Date'] || t['date'] || t['Transfer date'] || t['Transfer Date'] || '';
      
      let finalSource = accountName;
      const incomingAccount = (t['Account'] || t['Account/Card'] || '').toLowerCase();
      if (origin === 'WS' || incomingAccount.includes('wealthsimple')) {
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
