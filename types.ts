
export type TransactionType = 'expense' | 'income' | 'savings' | 'withdrawal';

export interface LineItem {
  name: string;
  price: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  type: TransactionType;
  notes?: string;
  vendor?: string;
  lineItems?: LineItem[];
  recurringId?: string; // Links a transaction to a recurring template
  savingGoalId?: string; // Links a transaction to a specific saving goal
}

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  openingBalance: number;
  category: string;
}

export interface RecurringExpense {
  id: string;
  amount: number;
  category: string;
  description: string;
  dayOfMonth: number;
  balance: number; // Current outstanding balance for this bill
  lastBilledDate?: string; // Track when we last added the monthly amount to balance
}

export interface Budget {
  category: string;
  limit: number;
  spent: number;
}

export const CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Entertainment',
  'Utilities',
  'Health',
  'Shopping',
  'Education',
  'Personal',
  'Income',
  'Savings',
  'Other'
];

export interface AIAnalysisResult {
  amount: number;
  category: string;
  description: string;
  type: TransactionType;
  notes?: string;
  date?: string;
  vendor?: string;
  lineItems?: LineItem[];
}
