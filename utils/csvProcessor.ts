
import { Transaction, ProcessedTransaction } from '../types';

/**
 * Professional categorization engine based on user-defined merchant mapping rules.
 * Prioritizes banking and transfer rules before retail matching.
 */
const categorizeMerchant = (description: string, amount: number): { category: string; subCategory: string; overrideDescription?: string } | null => {
  const desc = description.toLowerCase().trim();
  const absAmount = Math.abs(amount);
  
  // 1. Any row starting with “Payment to” -> ignore / skip entirely for categorization.
  if (desc.startsWith('payment to')) return null;

  // 2. Specific Person Overrides (PRIORITIZED to prevent incorrect amount-based matches)
  if (desc.includes('luiz fernando pinheiros de araujo') && amount > 0) {
    return { 
      category: 'Transfers', 
      subCategory: 'Other transfer'
    };
  }
  if (desc.includes('luiz araujo') && amount > 0) {
    return { 
      category: 'Transfers', 
      subCategory: 'Transfer in', 
      overrideDescription: 'Simplii' 
    };
  }

  // 3. Internal Transfers & Maternity Leave
  // Specific case: Maternity Leave logic
  const maternityAmounts = [1246.84, 1252, 1267.59, 1246.00, 1211.00, 1257.85, 1256.00];
  
  // Handle the specific amount threshold logic (1211 negative is transfer, positive is income)
  if (absAmount === 1211.00 && amount < 0) {
    return { category: 'Transfers', subCategory: 'Internal transfer' };
  }

  // Handle Maternity Leave rule: specific transfer strings or known amounts (positive)
  const isMaternityTransfer = desc.startsWith("transfer from 111431248 to 114728209");
  if (isMaternityTransfer || (maternityAmounts.includes(absAmount) && amount > 0)) {
    return { category: 'Income', subCategory: 'Maternity Leave' };
  }

  // General Internal Transfers (other own accounts)
  if (
    desc.startsWith("transfer from 111195544 to 114728209") || 
    desc.startsWith("transfer from 114728209 to 111195544") ||
    desc.startsWith("transfer from 111431248 to 114728209") // Non-maternity internal transfer
  ) {
    return { category: 'Transfers', subCategory: 'Internal transfer' };
  }

  // 4. Transfers in (other bank/internal)
  if (desc.startsWith("transfer from 200225325 to 114728209") || desc.startsWith("transfer from 115853228 to 114728209")) {
    return { category: 'Transfers', subCategory: 'Transfer in (other bank/internal)' };
  }

  // 5. Transfers out (other bank/internal)
  if (desc.startsWith("transfer from 114728209 to 200225325")) {
    return { category: 'Transfers', subCategory: 'Transfer out (other bank/internal)' };
  }

  // International Transfer Detection
  if (desc.includes('international transfer')) {
    return { category: 'Transfers', subCategory: 'International Transfer' };
  }

  // 6. Income: Salary, Interest, and Benefits
  if (desc.includes('long view')) {
    return { category: 'Income', subCategory: 'Salary' };
  }
  if (desc.includes("interest")) {
    return { category: 'Income', subCategory: 'Interest' };
  }
  // New Rule: Direct deposit from CANADA + 295.04 -> Child Benefit
  if (desc.startsWith("direct deposit from canada") && absAmount === 295.04) {
    return { category: 'Income', subCategory: 'Child Benefit' };
  }
  if (desc.startsWith("direct deposit from")) {
    return { category: 'Income', subCategory: 'Direct deposit' };
  }

  // 7. Auto-withdrawals & Debt
  if (desc.startsWith("auto-withdrawal by rbc loan pymt")) {
    return { category: 'Transport', subCategory: 'Car payment' };
  }
  if (desc.startsWith("auto-withdrawal by solaro apartmen")) {
    return { category: 'Household', subCategory: 'Rent/strata (Solaro Apartment)' };
  }
  if (desc.startsWith("auto-withdrawal by b c hydro pap")) {
    return { category: 'Household', subCategory: 'Utilities' };
  }
  if (desc.startsWith("transfer to pc financial")) {
    return { category: 'Debt & credit', subCategory: 'Credit card/line of credit payment (PC Financial)' };
  }

  // 8. Retail & Merchant Rules
  
  // Costco logic
  if (desc.includes('costco gas w259')) {
    return { category: 'Transport', subCategory: 'Gas' };
  }
  if (desc.includes('costco wholesale w259')) {
    return { category: 'Household', subCategory: 'Groceries' };
  }

  // Willowbrook Produce
  if (desc.includes('willowbrook produce')) {
    return { category: 'Household', subCategory: 'Groceries' };
  }

  // IKEA
  if (desc.includes('ikea')) {
    return { category: 'Household', subCategory: 'Furniture' };
  }

  // Associated Veterinary
  if (desc.includes('associated veterinary')) {
    return { category: 'Education', subCategory: 'Vet validation' };
  }

  // Fullscript
  if (desc.includes('fullscript.com')) {
    return { category: 'Health & Wellness', subCategory: 'Supplement' };
  }

  // Kim's Coin Laundry
  if (desc.includes("kim's coin laundry")) {
    return { category: 'Household', subCategory: 'Laundry' };
  }

  // Once Upon A Child
  if (desc.includes('once upon a child')) {
    return { category: 'Kids', subCategory: 'Clothes/Toys' };
  }

  // Personal & Beauty
  if (desc.includes('shoppers')) {
    return { category: 'Personal', subCategory: 'Health & Personal Care' };
  }
  if (desc.includes('andreia depila') || desc.includes('dolce lounge')) {
    return { category: 'Personal', subCategory: 'Beauty' };
  }
  if (desc.includes('great clips')) {
    return { category: 'Personal', subCategory: 'Haircut' };
  }

  // Insurance
  if (desc.includes('icbc') || desc.includes('max insurance')) {
    return { category: 'Transport', subCategory: 'Car Insurance' };
  }

  // Retail matching...
  if (desc.includes('magic wand car wash')) return { category: 'Transport', subCategory: 'Car wash' };
  if (desc.includes('homes alive pet centre')) return { category: 'Pets', subCategory: 'Pet supplies' };
  if (desc.includes('fit4less') || desc.includes('club16')) return { category: 'Health & wellness', subCategory: 'Gym & Club' };
  if (desc.includes('wal-mart') || desc.includes('walmart')) return { category: 'Household', subCategory: 'Groceries' };
  if (desc.includes('superstore') || desc.includes('real cdn superstore')) return { category: 'Household', subCategory: 'Groceries' };
  if (desc.includes('subway')) return { category: 'Pleasure', subCategory: 'Fast food' };
  if (desc.includes('hard bean brunch')) return { category: 'Pleasure', subCategory: 'Restaurant/cafe' };

  // Aliexpress / Amazon / Temu
  const isAliexpress = desc.includes('aliexpress');
  const isAmazon = desc.includes('amazon');
  const isTemu = desc.includes('temu.com');

  if (isAliexpress && amount < 0) return { category: 'Shopping', subCategory: 'Online (Aliexpress)' };
  if (isTemu && amount < 0) return { category: 'Household', subCategory: 'Misc shopping' };
  if (isAmazon && amount < 0) return { category: 'Shopping', subCategory: 'Online (Amazon)' };
  
  if ((isAmazon || isTemu || isAliexpress) && amount >= 0) return { category: 'Shopping', subCategory: 'Refund/credit' };

  // --- FINAL DEFAULT ---
  return { category: 'Transfers', subCategory: 'Other transfer' };
};

/**
 * Normalizes monetary values
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
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return `${monthNames[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
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
  const results: ProcessedTransaction[] = [];
  
  transactions.forEach(t => {
    const descUpper = (t['Description'] || t['description'] || '').toUpperCase();
    if (origin === 'CIBC' && (descUpper.includes('ROYAL BANK OF CANADA MONTREAL') || descUpper.includes('PAYMENT THANK YOU'))) return;
    if (origin === 'PC' && (t['Type'] || t['type'] || '').toLowerCase() === 'payment') return;

    let rawAmount = t['Amount'] || t['amount'] || '';
    let numericAmount = parseAmountToNumber(String(rawAmount));
    if (origin === 'CIBC') numericAmount = -Math.abs(numericAmount);
    
    let description = t['Description'] || t['description'] || 'No Description';
    description = description.replace(/\s+/g, ' ').trim();
    
    const categoryResult = categorizeMerchant(description, numericAmount);
    if (categoryResult === null) return;

    const { category, subCategory, overrideDescription } = categoryResult;
    const rawDate = t['Date'] || t['date'] || t['Transfer date'] || t['Transfer Date'] || '';
    
    let finalSource = accountName;
    const incomingAccount = (t['Account'] || t['Account/Card'] || '').toLowerCase();
    if (origin === 'WS' || incomingAccount.includes('wealthsimple')) finalSource = 'Wealthsimple';
    
    results.push({
      'Date': formatDate(rawDate),
      'Description': overrideDescription || description,
      'Category': category,
      'SubCategory': subCategory,
      'Amount': numericAmount < 0 ? `-$${Math.abs(numericAmount).toFixed(2)}` : `$${numericAmount.toFixed(2)}`,
      'Account/Card': finalSource
    });
  });

  return results;
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
