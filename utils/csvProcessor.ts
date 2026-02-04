
import { Transaction, ProcessedTransaction } from '../types';

/**
 * Enhanced categorization engine based on common merchant keywords and user-specific rules
 */
const categorizeMerchant = (description: string): { category: string; subCategory: string } => {
  const desc = description.toLowerCase();
  
  // User Specific Rules - Health & Wellness
  if (desc.includes('club16') || desc.includes('fitness') || desc.includes('gym') || desc.includes('yoga')) {
    return { category: 'Health & Fitness', subCategory: 'Gym & Club' };
  }

  if (desc.includes('aquarius dental') || desc.includes('dentist') || desc.includes('dental') || desc.includes('medical') || desc.includes('pharmacy')) {
    return { category: 'Health & Fitness', subCategory: 'Medical/Dentist' };
  }
  
  // User Specific Rules - Lifestyle & Shopping
  if (
    desc.includes('rwco') || 
    desc.includes('rw&co') || 
    desc.includes('zara') || 
    desc.includes('h&m') || 
    desc.includes('clothing') || 
    desc.includes('winners') || 
    desc.includes('marshalls') ||
    desc.includes('zhouhuang')
  ) {
    return { category: 'Personal', subCategory: 'Apparel' };
  }

  // Transportation & Auto
  if (desc.includes('uber') || desc.includes('lyft') || desc.includes('bolt')) return { category: 'Transport', subCategory: 'Rideshare' };
  if (desc.includes('gas') || desc.includes('shell') || desc.includes('esso') || desc.includes('petro')) return { category: 'Transport', subCategory: 'Fuel' };
  if (desc.includes('translink') || desc.includes('compass') || desc.includes('transit')) return { category: 'Transport', subCategory: 'Public Transit' };
  if (desc.includes('car wash') || desc.includes('magic wand')) return { category: 'Transport', subCategory: 'Car Wash' };

  // Food & Dining
  if (desc.includes('walmart') || desc.includes('costco') || desc.includes('loblaws') || desc.includes('no frills') || desc.includes('grocery') || desc.includes('safeway')) {
    return { category: 'Food & Dining', subCategory: 'Groceries' };
  }
  if (desc.includes('starbucks') || desc.includes('tim hortons') || desc.includes('mcdonald') || desc.includes('restaurant') || desc.includes('pub') || desc.includes('uber eats') || desc.includes('skipthedishes') || desc.includes('nando')) {
    return { category: 'Food & Dining', subCategory: 'Dining Out' };
  }

  // Entertainment & Shopping
  if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('disney') || desc.includes('steam') || desc.includes('nintendo') || desc.includes('youtube')) {
    return { category: 'Entertainment', subCategory: 'Subscriptions' };
  }
  if (desc.includes('amazon') || desc.includes('apple') || desc.includes('best buy') || desc.includes('indigo')) {
    return { category: 'Shopping', subCategory: 'Electronics/Retail' };
  }

  // Housing & Bills
  if (desc.includes('rent') || desc.includes('apartment') || desc.includes('solaro') || desc.includes('mortgage')) return { category: 'Housing', subCategory: 'Rent/Mortgage' };
  if (desc.includes('hydro') || desc.includes('bell') || desc.includes('rogers') || desc.includes('telus') || desc.includes('shaw')) return { category: 'Housing', subCategory: 'Utilities' };

  // Financial
  if (desc.includes('interac') || desc.includes('transfer') || desc.includes('e-transfer')) return { category: 'Transfer', subCategory: 'Personal' };
  if (desc.includes('interest') || desc.includes('dividend')) return { category: 'Income', subCategory: 'Investment' };
  if (desc.includes('payroll') || desc.includes('deposit')) return { category: 'Income', subCategory: 'Salary' };
  
  return { category: 'Uncategorized', subCategory: 'General' };
};

/**
 * Normalizes monetary values (Handles Wealthsimple's specific characters and accounting notation)
 */
export const parseAmountToNumber = (amountStr: string): number => {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  let str = amountStr.trim();
  let multiplier = 1;
  
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

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const cleanStr = dateStr.trim().toLowerCase();
  const now = new Date();

  if (cleanStr.includes('today')) return `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  if (cleanStr.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    return `${monthNames[yesterday.getMonth()]} ${yesterday.getDate()}, ${yesterday.getFullYear()}`;
  }
  
  let processedStr = dateStr;
  Object.keys(MONTH_MAP).forEach(long => {
    const regex = new RegExp(long, 'gi');
    processedStr = processedStr.replace(regex, MONTH_MAP[long]);
  });

  const parsed = new Date(processedStr);
  if (!isNaN(parsed.getTime())) {
    let year = parsed.getFullYear();
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) year = parseInt(yearMatch[0], 10);
    else if (year === 2001 || (year > now.getFullYear() + 1)) year = now.getFullYear();
    return `${monthNames[parsed.getMonth()]} ${parsed.getDate()}, ${year}`;
  }
  return dateStr;
};

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
    
    if (headers.length === 4) {
      if (values.length >= 5 && /^\d{4}$/.test(values[1].trim())) {
        const mergedDate = `${values[0]}, ${values[1]}`;
        values.splice(0, 2, mergedDate);
      }
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
      if (origin === 'CIBC' && (desc.includes('ROYAL BANK OF CANADA MONTREAL') || desc.includes('PAYMENT THANK YOU') || desc.includes('PAIEMEN T MERCI'))) return false;
      if (origin === 'PC' && (t['Type'] || t['type'] || '').toLowerCase() === 'payment') return false;
      return true;
    })
    .map(t => {
      let rawAmount = t['Amount'] || t['amount'] || '';
      let numericAmount = parseAmountToNumber(String(rawAmount));
      if (origin === 'CIBC') numericAmount = -Math.abs(numericAmount);
      
      let description = t['Description'] || t['description'] || 'No Description';
      description = description.replace(/\s+/g, ' ').trim();
      
      const { category, subCategory } = categorizeMerchant(description);

      const rawDate = t['Date'] || t['date'] || t['Transfer date'] || t['Transfer Date'] || '';
      
      let finalSource = accountName;
      const incomingAccount = (t['Account'] || t['Account/Card'] || '').toLowerCase();
      if (origin === 'WS' || incomingAccount.includes('wealthsimple')) finalSource = 'Wealthsimple';
      
      return {
        'Date': formatDate(rawDate),
        'Description': description,
        'Category': category,
        'SubCategory': subCategory,
        'Amount': numericAmount < 0 ? `-$${Math.abs(numericAmount).toFixed(2)}` : `$${numericAmount.toFixed(2)}`,
        'Account/Card': finalSource
      };
    });
};

export const convertToCSV = (data: ProcessedTransaction[]): string => {
  if (data.length === 0) return '';
  const headers: (keyof ProcessedTransaction)[] = ['Date', 'Description', 'Category', 'SubCategory', 'Amount', 'Account/Card'];
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
