
import { Transaction, ProcessedTransaction } from '../types';

/**
 * Professional categorization engine based on user-defined merchant mapping rules.
 * Prioritizes banking and transfer rules before retail matching.
 */
const categorizeMerchant = (description: string, amount: number): { category: string; subCategory: string } | null => {
  const desc = description.toLowerCase().trim();
  const absAmount = Math.abs(amount);
  
  // 1. Any row starting with “Payment to” -> ignore / skip entirely for categorization.
  if (desc.startsWith('payment to')) return null;

  // 2. Internal Transfers & Maternity Leave
  // Specific case: Maternity Leave (from 111431248 with specific amounts)
  if (desc.startsWith("transfer from 111431248 to 114728209")) {
    const maternityAmounts = [1246.84, 1252, 1267.59, 1246.00];
    if (maternityAmounts.includes(absAmount)) {
      return { category: 'Income', subCategory: 'Maternity Leave' };
    }
    return { category: 'Transfers', subCategory: 'Internal transfer' };
  }

  // General Internal Transfers (other own accounts)
  if (
    desc.startsWith("transfer from 111195544 to 114728209") || 
    desc.startsWith("transfer from 114728209 to 111195544")
  ) {
    return { category: 'Transfers', subCategory: 'Internal transfer' };
  }

  // 3. Transfers in (other bank/internal)
  if (desc.startsWith("transfer from 200225325 to 114728209") || desc.startsWith("transfer from 115853228 to 114728209")) {
    return { category: 'Transfers', subCategory: 'Transfer in (other bank/internal)' };
  }

  // 4. Transfers out (other bank/internal)
  if (desc.startsWith("transfer from 114728209 to 200225325")) {
    return { category: 'Transfers', subCategory: 'Transfer out (other bank/internal)' };
  }

  // 5. Transfer to PC Financial
  if (desc.startsWith("transfer to pc financial")) {
    return { category: 'Debt & credit', subCategory: 'Credit card/line of credit payment (PC Financial)' };
  }

  // 6. Interac e-Transfer sent to WealthSimple
  if (desc.startsWith("interac e-transfer sent to wealthsimple")) {
    return { category: 'Investments', subCategory: 'Transfer out to investments' };
  }

  // 7. Interac e-Transfer sent to Luiz PC Financial
  if (desc.startsWith("interac e-transfer sent to luiz pc financial")) {
    return { category: 'Debt & credit', subCategory: 'Credit card payment (PC Financial via Interac)' };
  }

  // 8. Interac e-Transfer sent to CIBC
  if (desc.startsWith("interac e-transfer sent to cibc")) {
    return { category: 'Debt & credit', subCategory: 'Bank or credit product payment (CIBC)' };
  }

  // 9. Personal & Beauty (Specific recipients)
  if (desc.includes('andreia depila') || desc.includes('dolce lounge')) {
    return { category: 'Personal', subCategory: 'Beauty' };
  }

  // 10. Interac e-Transfer sent to other people
  const people = ["gey", "fernando", "nathalia unha", "simplii nando", "tatiana bassinet", "diaper"];
  if (people.some(p => desc.startsWith(`interac e-transfer sent to ${p}`))) {
    return { category: 'Transfers', subCategory: 'Transfer out (to other person)' };
  }

  // 11. Auto-withdrawal by RBC LOAN PYMT
  if (desc.startsWith("auto-withdrawal by rbc loan pymt")) {
    return { category: 'Transport', subCategory: 'Car payment' };
  }

  // 12. Auto-withdrawal by Solaro Apartmen
  if (desc.startsWith("auto-withdrawal by solaro apartmen")) {
    return { category: 'Household', subCategory: 'Rent/strata (Solaro Apartment)' };
  }

  // 13. Auto-withdrawal by B C HYDRO PAP
  if (desc.startsWith("auto-withdrawal by b c hydro pap")) {
    return { category: 'Household', subCategory: 'Utilities' };
  }

  // 14. International Transfer
  if (desc.startsWith("international transfer")) {
    return { category: 'Transfers', subCategory: 'International transfer out' };
  }

  // 15. Interest received
  if (desc === "interest received") {
    return { category: 'Income', subCategory: 'Interest' };
  }

  // 16. Direct deposit
  if (desc.startsWith("direct deposit from")) {
    return { category: 'Income', subCategory: 'Direct deposit' };
  }

  // 17. GIC redemption/purchase
  if (desc.includes("gic cancelled")) return { category: 'Investments', subCategory: 'GIC redemption' };
  if (desc.includes("gic purchase")) return { category: 'Investments', subCategory: 'GIC purchase' };

  // --- RETAIL & MERCHANT RULES ---

  // Transport
  if (desc.includes('magic wand car wash')) {
    return { category: 'Transport', subCategory: 'Car wash' };
  }

  // Pets
  if (desc.includes('associated veterinary pur')) return { category: 'Pets', subCategory: 'Vet services' };
  if (desc.includes('homes alive pet centre')) return { category: 'Pets', subCategory: 'Pet supplies' };

  // Health & wellness
  if (desc.includes('fullscript')) return { category: 'Health & wellness', subCategory: 'Supplements/healthcare' };
  if (desc.includes('club16')) return { category: 'Health & wellness', subCategory: 'Gym & Club' };
  if (desc.includes('aquarius dental')) return { category: 'Health & wellness', subCategory: 'Medical/Dentist' };

  // Education
  if (desc.includes('zuku learning') || desc.includes('zuku')) return { category: 'Education', subCategory: 'Professional/vet education' };

  // Household (Groceries, Utilities, and Home Infrastructure)
  if (desc.includes('wal-mart') || desc.includes('walmart')) return { category: 'Household', subCategory: 'Groceries' };
  if (desc.includes('superstore') || desc.includes('real cdn superstore')) return { category: 'Household', subCategory: 'Groceries' };
  if (desc.includes('t&t supermarket')) return { category: 'Household', subCategory: 'Groceries' };
  if (desc.includes('willowbrook produce')) return { category: 'Household', subCategory: 'Groceries' };
  if (desc.includes('dollarama')) return { category: 'Household', subCategory: 'Misc shopping' };
  if (desc.includes('home depot')) return { category: 'Household', subCategory: 'Hardware' };
  if (desc.includes('ikea')) return { category: 'Household', subCategory: 'Home goods/furniture' };
  if (desc.includes("kim's coin laundry")) return { category: 'Household', subCategory: 'Laundry' };

  // Pleasure (Discretionary Dining and Entertainment)
  if (desc.includes('subway')) return { category: 'Pleasure', subCategory: 'Fast food' };
  if (desc.includes('hard bean brunch')) return { category: 'Pleasure', subCategory: 'Restaurant/cafe' };
  if (desc.includes('firecrust')) return { category: 'Pleasure', subCategory: 'Restaurant' };
  if (desc.includes('coca cola coquitlam')) return { category: 'Pleasure', subCategory: 'Drinks/snacks' };

  // Personal Care & Kids
  if (desc.includes('great clips')) return { category: 'Personal', subCategory: 'Haircut' };
  if (desc.includes('once upon a child')) return { category: 'Kids', subCategory: 'Second-hand kids items' };

  // Shopping (General Discretionary Retail)
  if (desc.includes('michaels') || desc.includes('staples')) {
    return { category: 'Shopping', subCategory: 'Crafts/School' };
  }
  if (desc.includes('adidas')) return { category: 'Shopping', subCategory: 'Clothing/shoes' };
  if (desc.includes('kerrisdale') || desc.includes('kerrisdalec')) return { category: 'Shopping', subCategory: 'Clothing/retail' };
  if (desc.includes('aliexpress')) return { category: 'Shopping', subCategory: 'Online (AliExpress)' };

  // Amazon/Temu logic
  const isAmazon = desc.includes('amazon');
  const isTemu = desc.includes('temu.com');
  // Temu.com into Misc shopping too if the amount is negative
  if (isTemu && amount < 0) return { category: 'Household', subCategory: 'Misc shopping' };
  if (isAmazon && amount < 0) return { category: 'Shopping', subCategory: 'Online (Amazon)' };
  if ((isAmazon || isTemu) && amount >= 0) return { category: 'Shopping', subCategory: 'Refund/credit' };

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

    const { category, subCategory } = categoryResult;
    const rawDate = t['Date'] || t['date'] || t['Transfer date'] || t['Transfer Date'] || '';
    
    let finalSource = accountName;
    const incomingAccount = (t['Account'] || t['Account/Card'] || '').toLowerCase();
    if (origin === 'WS' || incomingAccount.includes('wealthsimple')) finalSource = 'Wealthsimple';
    
    results.push({
      'Date': formatDate(rawDate),
      'Description': description,
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
