
export type TransactionType = 'expense' | 'income' | 'savings' | 'withdrawal' | 'transfer';
export type InstitutionType = 'bank' | 'credit_union' | 'investment';

export interface LineItem {
  name: string;
  price: number;
  quantity?: number;
}

export interface BankConnection {
  institution: string;
  institutionType: InstitutionType;
  status: 'linked' | 'unlinked' | 'syncing';
  lastSynced?: string;
  accountLastFour?: string;
  openingBalance: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  purchasePrice: number;
}

export interface InvestmentAccount {
  id: string;
  provider: 'Binance' | 'Vanguard';
  name: string;
  holdings: Holding[];
}

export interface MarketPrice {
  symbol: string;
  price: number;
  change24h: number;
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
  recurringId?: string;
  savingGoalId?: string;
  institution?: string;
  destinationInstitution?: string; 
}

export interface PortfolioUpdate {
  symbol: string;
  quantity: number;
  provider: 'Binance' | 'Vanguard';
}

export interface AIAnalysisResult {
  updateType: 'transaction' | 'portfolio';
  transaction?: {
    amount: number;
    category: string;
    description: string;
    type: TransactionType;
    notes?: string;
    date?: string;
    vendor?: string;
    lineItems?: LineItem[];
  };
  portfolio?: PortfolioUpdate;
}

export interface SavingGoal {
  id: string;
  name: string;
  institution: string;
  institutionType: 'bank' | 'credit_union';
  targetAmount: number;
  currentAmount: number;
  openingBalance: number;
  category: string;
}

export interface InvestmentGoal {
  id: string;
  name: string;
  targetAmount: number;
  provider: 'Binance' | 'Vanguard' | 'Both';
}

export interface RecurringExpense {
  id: string;
  amount: number;
  category: string;
  description: string;
  dayOfMonth: number;
  nextDueDate: string; 
  accumulatedOverdue: number; 
  lastBilledDate?: string;
  externalPortalUrl?: string; 
  externalSyncEnabled?: boolean;
}

export interface RecurringIncome {
  id: string;
  amount: number;
  category: string;
  description: string;
  dayOfMonth: number;
  nextConfirmationDate: string; 
  lastConfirmedDate?: string;
  accumulatedReceived?: number; 
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  email: string;
}

export interface ProjectNote {
  id: string;
  text: string;
  timestamp: string;
}

export interface ProjectTask {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  completionDate?: string;
  subTasks?: ProjectTask[]; // Support for nested tasks
}

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
  timestamp: string;
  storageRef: string; // Key for IndexedDB or filename for Disk
  storageType: 'indexeddb' | 'filesystem';
}

export interface BudgetEvent {
  id: string;
  name: string;
  date: string;
  items: EventItem[];
  notes: ProjectNote[];
  tasks: ProjectTask[];
  files: ProjectFile[];
  contactIds: string[];
  status: 'planned' | 'active' | 'completed';
  outcome?: 'success' | 'failed';
  lessonsLearnt?: string;
  projectedBudget?: number;
}

export interface EventItem {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  notes?: string;
  date: string;
}

export const CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Entertainment', 'Utilities', 
  'Health', 'Shopping', 'Education', 'Personal', 'Income', 'Savings', 'Other', 'Investments', 'Transfer'
];

export const EVENT_ITEM_CATEGORIES = [
  'Venue', 'Catering', 'Decor', 'Entertainment', 'Staff', 'Marketing', 'Tickets', 'Donation', 'Other'
];
export type EventItemCategory = typeof EVENT_ITEM_CATEGORIES[number];
