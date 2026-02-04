
export interface Transaction {
  'Transfer date': string;
  'Description': string;
  'Amount': string;
  'Balance'?: string;
}

export interface ProcessedTransaction {
  'Date': string;
  'Description': string;
  'Category': string;
  'SubCategory': string;
  'Amount': string;
  'Account/Card': string;
}

export interface FileStatus {
  name: string;
  status: 'processed' | 'skipped';
  reason?: string;
  count: number;
}

export interface AiSummary {
  overview: string;
  topCategories: { category: string; amount: number }[];
  savingsAdvice: string;
}
