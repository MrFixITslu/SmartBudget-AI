
import React, { useState, useEffect, useMemo } from 'react';
import Login from './components/Login';
import MagicInput from './components/MagicInput';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import BankSyncModal from './components/BankSyncModal';
import BudgetAssistant from './components/BudgetAssistant';
import EventPlanner from './components/EventPlanner';
import VerificationQueue from './components/VerificationQueue';
import { Transaction, AIAnalysisResult, RecurringExpense, RecurringIncome, SavingGoal, BankConnection, InvestmentAccount, MarketPrice, BudgetEvent, Contact, InvestmentGoal, NetWorthSnapshot } from './types';

// Simple obfuscated credentials
const _U = "bnN2"; // nsv
const _P = "JGgzcnchbg=="; // $h3rw!n

const STORAGE_KEYS = {
  TRANSACTIONS: 'budget_transactions',
  RECURRING_EXPENSES: 'budget_recurring',
  RECURRING_INCOMES: 'budget_recurring_incomes',
  SAVINGS_GOALS: 'budget_savings_goals',
  INVESTMENT_GOALS: 'budget_investment_goals',
  SALARY: 'budget_salary',
  TARGET_MARGIN: 'budget_target_margin',
  CATEGORY_LIMITS: 'budget_category_limits',
  BANK_CONNECTIONS: 'budget_bank_conns',
  INVESTMENTS: 'budget_investments',
  EVENTS: 'budget_events',
  CONTACTS: 'ff_contacts',
  NETWORTH_HISTORY: 'ff_networth_history',
  AUTH: 'ff_auth'
};

const safeParse = (key: string, fallback: any) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    return fallback;
  }
};

const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

const MarketTicker = ({ prices }: { prices: MarketPrice[] }) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[120] bg-slate-900 text-white overflow-hidden py-1.5 shadow-md border-b border-slate-800">
      <div className="animate-marquee whitespace-nowrap flex items-center gap-12">
        {[...prices, ...prices].map((p, idx) => (
          <div key={idx} className="flex items-center gap-3">
             <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[8px] font-black text-white">{p.symbol.substring(0, 1)}</div>
             <span className="font-black text-[9px] text-slate-400 tracking-[0.2em] uppercase">{p.symbol}</span>
             <span className="font-black text-[10px] text-white tracking-tight">${p.price.toLocaleString()}</span>
             <div className={`flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded ${p.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
               <i className={`fas fa-caret-${p.change24h >= 0 ? 'up' : 'down'}`}></i>
               {Math.abs(p.change24h).toFixed(2)}%
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem(STORAGE_KEYS.AUTH) === 'true');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events'>('dashboard');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>(() => safeParse(STORAGE_KEYS.TRANSACTIONS, []));
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() => safeParse(STORAGE_KEYS.RECURRING_EXPENSES, []));
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>(() => safeParse(STORAGE_KEYS.RECURRING_INCOMES, []));
  const [savingGoals, setSavingGoals] = useState<SavingGoal[]>(() => safeParse(STORAGE_KEYS.SAVINGS_GOALS, []));
  const [investmentGoals, setInvestmentGoals] = useState<InvestmentGoal[]>(() => safeParse(STORAGE_KEYS.INVESTMENT_GOALS, []));
  const [salary, setSalary] = useState<number>(() => parseFloat(localStorage.getItem(STORAGE_KEYS.SALARY) || '0'));
  const [targetMargin, setTargetMargin] = useState<number>(() => parseFloat(localStorage.getItem(STORAGE_KEYS.TARGET_MARGIN) || '0'));
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(() => safeParse(STORAGE_KEYS.CATEGORY_LIMITS, {}));
  const [bankConnections, setBankConnections] = useState<BankConnection[]>(() => safeParse(STORAGE_KEYS.BANK_CONNECTIONS, []));
  const [investments, setInvestments] = useState<InvestmentAccount[]>(() => safeParse(STORAGE_KEYS.INVESTMENTS, []));
  const [events, setEvents] = useState<BudgetEvent[]>(() => safeParse(STORAGE_KEYS.EVENTS, []));
  const [contacts, setContacts] = useState<Contact[]>(() => safeParse(STORAGE_KEYS.CONTACTS, []));
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>(() => safeParse(STORAGE_KEYS.NETWORTH_HISTORY, []));

  const marketPrices = useMemo<MarketPrice[]>(() => [
    { symbol: 'BTC', price: 94250.00, change24h: 1.2 },
    { symbol: 'ETH', price: 2950.50, change24h: -0.5 },
    { symbol: 'SOL', price: 155.20, change24h: 3.1 },
    { symbol: 'VOO', price: 548.12, change24h: 0.3 },
    { symbol: 'VOOG', price: 312.45, change24h: 0.45 }
  ], []);

  const [pendingApprovals, setPendingApprovals] = useState<AIAnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const saveToStore = (key: string, value: any) => localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));

  useEffect(() => { saveToStore(STORAGE_KEYS.TRANSACTIONS, transactions); }, [transactions]);
  useEffect(() => { saveToStore(STORAGE_KEYS.RECURRING_EXPENSES, recurringExpenses); }, [recurringExpenses]);
  useEffect(() => { saveToStore(STORAGE_KEYS.RECURRING_INCOMES, recurringIncomes); }, [recurringIncomes]);
  useEffect(() => { saveToStore(STORAGE_KEYS.SAVINGS_GOALS, savingGoals); }, [savingGoals]);
  useEffect(() => { saveToStore(STORAGE_KEYS.INVESTMENT_GOALS, investmentGoals); }, [investmentGoals]);
  useEffect(() => { saveToStore(STORAGE_KEYS.BANK_CONNECTIONS, bankConnections); }, [bankConnections]);
  useEffect(() => { saveToStore(STORAGE_KEYS.INVESTMENTS, investments); }, [investments]);
  useEffect(() => { saveToStore(STORAGE_KEYS.EVENTS, events); }, [events]);
  useEffect(() => { saveToStore(STORAGE_KEYS.CONTACTS, contacts); }, [contacts]);
  useEffect(() => { saveToStore(STORAGE_KEYS.NETWORTH_HISTORY, netWorthHistory); }, [netWorthHistory]);

  const readilyAvailableFunds = useMemo(() => {
    const primaryBank = bankConnections.find(c => c.institution.includes('1st National'));
    const opening = primaryBank?.openingBalance || 0;
    return opening + transactions.filter(t => t.institution === primaryBank?.institution || t.destinationInstitution === primaryBank?.institution || t.institution === 'Cash in Hand').reduce((acc, t) => {
       if (t.type === 'income') return acc + t.amount;
       if (t.type === 'expense' || t.type === 'savings') return acc - t.amount;
       return acc;
    }, 0);
  }, [transactions, bankConnections]);

  const currentNetWorth = useMemo(() => {
    let total = readilyAvailableFunds;
    investments.forEach(inv => {
      inv.holdings.forEach(h => {
        const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
        total += (h.quantity * live);
      });
    });
    return total;
  }, [readilyAvailableFunds, investments, marketPrices]);

  // Record daily net worth snapshots
  useEffect(() => {
    if (!isAuthenticated) return;
    const today = new Date().toISOString().split('T')[0];
    const exists = netWorthHistory.find(s => s.date === today);
    if (!exists || (Math.abs(exists.value - currentNetWorth) > 100)) {
       setNetWorthHistory(prev => {
         const filtered = prev.filter(s => s.date !== today);
         return [...filtered, { date: today, value: currentNetWorth }].sort((a,b) => a.date.localeCompare(b.date));
       });
    }
  }, [currentNetWorth, isAuthenticated]);

  const handleLogin = (u: string, p: string): boolean => {
    if (u === atob(_U) && p === atob(_P)) {
      setIsAuthenticated(true);
      localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
      return true;
    }
    return false;
  };

  const addTransaction = (t: Omit<Transaction, 'id'>) => setTransactions(prev => [{ ...t, id: generateId() } as Transaction, ...prev]);

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;
  
  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 max-w-6xl mx-auto pt-16 relative">
      <MarketTicker prices={marketPrices} />
      {isLoading && <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-in fade-in"><div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><p className="text-white font-black uppercase text-[10px] tracking-[0.4em]">Batch AI Extraction Pulse...</p></div>}
      
      <header className="flex items-center justify-between mb-8 mt-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-100"><i className="fas fa-chart-pie"></i></div>
            Fire Finance <span className="text-indigo-600">Pro v1</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Universal Command Center</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowBankModal(true)} className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-indigo-600 hover:bg-indigo-50 transition shadow-sm"><i className="fas fa-plug"></i></button>
          <button onClick={() => setShowManualEntry(true)} className="w-11 h-11 flex items-center justify-center bg-indigo-600 border border-indigo-500 rounded-xl text-white hover:bg-slate-900 transition shadow-md"><i className="fas fa-plus"></i></button>
          <button onClick={() => setShowSettings(true)} className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm"><i className="fas fa-cog"></i></button>
        </div>
      </header>

      <div className="flex justify-center mb-10">
        <nav className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
          <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>Dashboard</button>
          <button onClick={() => setActiveTab('events')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'events' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>Project Matrix</button>
        </nav>
      </div>

      <section className="mb-10 sticky top-12 z-30">
        <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-xl p-4 rounded-[2.5rem] border border-white shadow-2xl">
          <MagicInput onSuccess={(r) => setPendingApprovals(p => [...p, r])} onBulkSuccess={(r) => setPendingApprovals(p => [...p, ...r])} onLoading={setIsLoading} onManualEntry={() => setShowManualEntry(true)} />
        </div>
      </section>

      <main>
        {activeTab === 'dashboard' ? (
          <>
            <VerificationQueue pendingItems={pendingApprovals} onApprove={(idx) => { const item = pendingApprovals[idx]; if (item.transaction) addTransaction(item.transaction as Transaction); setPendingApprovals(p => p.filter((_, i) => i !== idx)); }} onDiscard={(idx) => setPendingApprovals(p => p.filter((_, i) => i !== idx))} onEdit={() => {}} onDiscardAll={() => setPendingApprovals([])} />
            <Dashboard transactions={transactions} recurringExpenses={recurringExpenses} recurringIncomes={recurringIncomes} savingGoals={savingGoals} investmentGoals={investmentGoals} investments={investments} marketPrices={marketPrices} bankConnections={bankConnections} targetMargin={targetMargin} categoryBudgets={categoryBudgets} onEdit={(t) => setTransactions(prev => prev.map(item => item.id === t.id ? t : item))} onDelete={(id) => setTransactions(prev => prev.filter(t => t.id !== id))} onPayRecurring={(rec, amt) => addTransaction({ amount: amt, description: rec.description, category: rec.category, type: 'expense', date: new Date().toISOString().split('T')[0], recurringId: rec.id })} onReceiveRecurringIncome={() => {}} onContributeSaving={() => {}} onWithdrawSaving={() => {}} onWithdrawal={() => {}} onAddIncome={() => {}} />
          </>
        ) : (
          <EventPlanner events={events} contacts={contacts} directoryHandle={directoryHandle} onAddEvent={(e) => setEvents(prev => [...prev, { ...e, id: generateId(), items: [], notes: [], tasks: [], files: [], contactIds: [], ious: [] }])} onDeleteEvent={(id) => setEvents(prev => prev.filter(e => e.id !== id))} onUpdateEvent={(updated) => setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))} onUpdateContacts={setContacts} />
        )}
      </main>

      <BudgetAssistant transactions={transactions} investments={investments} marketPrices={marketPrices} availableFunds={readilyAvailableFunds} />
      
      {showManualEntry && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div><h2 className="text-xl font-black text-slate-800">New Entry</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manual Ledger Logic</p></div>
              <button onClick={() => setShowManualEntry(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition"><i className="fas fa-times"></i></button>
            </div>
            <div className="p-2"><TransactionForm bankConnections={bankConnections} onAdd={(t) => { addTransaction(t); setShowManualEntry(false); }} onCancel={() => setShowManualEntry(false)} /></div>
          </div>
        </div>
      )}
      
      {showSettings && <Settings salary={salary} onUpdateSalary={setSalary} targetMargin={targetMargin} onUpdateTargetMargin={setTargetMargin} categoryBudgets={categoryBudgets} onUpdateCategoryBudgets={setCategoryBudgets} recurringExpenses={recurringExpenses} onAddRecurring={(b) => setRecurringExpenses(p => [...p, {...b, id: generateId(), accumulatedOverdue: 0}])} onUpdateRecurring={(b) => setRecurringExpenses(p => p.map(x => x.id === b.id ? b : x))} onDeleteRecurring={(id) => setRecurringExpenses(p => p.filter(x => x.id !== id))} recurringIncomes={recurringIncomes} onAddRecurringIncome={(i) => setRecurringIncomes(p => [...p, {...i, id: generateId(), accumulatedReceived: 0}])} onUpdateRecurringIncome={(i) => setRecurringIncomes(p => p.map(x => x.id === i.id ? i : x))} onDeleteRecurringIncome={(id) => setRecurringIncomes(p => p.filter(x => x.id !== id))} savingGoals={savingGoals} onAddSavingGoal={(g) => setSavingGoals(p => [...p, {...g, id: generateId(), currentAmount: g.openingBalance}])} onDeleteSavingGoal={(id) => setSavingGoals(p => p.filter(x => x.id !== id))} investmentGoals={investmentGoals} onAddInvestmentGoal={(g) => setInvestmentGoals(p => [...p, {...g, id: generateId()}])} onDeleteInvestmentGoal={(id) => setInvestmentGoals(p => p.filter(x => x.id !== id))} onExportData={() => {}} onResetData={() => {}} onClose={() => setShowSettings(false)} onLogout={() => { setIsAuthenticated(false); localStorage.removeItem(STORAGE_KEYS.AUTH); }} remindersEnabled={false} onToggleReminders={() => {}} currentBank={bankConnections[0] || {institution: '', status: 'unlinked', institutionType: 'bank', openingBalance: 0}} onResetBank={() => {}} onSetDirectory={setDirectoryHandle} directoryHandle={directoryHandle} />}
      {showBankModal && <BankSyncModal onSuccess={(inst, last4, open, type) => { setBankConnections(prev => [...prev, { institution: inst, institutionType: type, status: 'linked', accountLastFour: last4, openingBalance: open, lastSynced: new Date().toLocaleTimeString() }]); setShowBankModal(false); }} onClose={() => setShowBankModal(false)} />}
    </div>
  );
};

export default App;
