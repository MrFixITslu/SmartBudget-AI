
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
import { syncBankData, syncInvestmentHoldings } from './services/bankApiService';
import { Transaction, AIAnalysisResult, RecurringExpense, RecurringIncome, SavingGoal, BankConnection, InvestmentAccount, MarketPrice, InstitutionType, BudgetEvent, PortfolioUpdate, InvestmentGoal, Contact } from './types';

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
  REMINDERS: 'budget_reminders_enabled',
  AUTH: 'ff_auth',
  LAST_CYCLE_CHECK: 'ff_last_cycle_check'
};

const safeParse = (key: string, fallback: any) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    console.error(`Error parsing ${key}:`, e);
    return fallback;
  }
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
};

const MarketTicker = ({ prices }: { prices: MarketPrice[] }) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[120] bg-slate-900 text-white overflow-hidden py-1.5 shadow-md border-b border-slate-800">
      <div className="animate-marquee whitespace-nowrap flex items-center gap-12">
        {[...prices, ...prices].map((p, idx) => (
          <div key={idx} className="flex items-center gap-3">
             <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[8px] font-black text-white">
               {p.symbol.substring(0, 1)}
             </div>
             <span className="font-black text-[9px] text-slate-400 tracking-[0.2em] uppercase">{p.symbol}</span>
             <span className="font-black text-[10px] text-white tracking-tight">
               ${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.AUTH) === 'true';
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events'>('dashboard');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Core State - Loaded from LocalStorage
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

  // Notification State
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.REMINDERS) === 'true';
  });

  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([
    { symbol: 'BTC', price: 92450.00, change24h: 1.2 },
    { symbol: 'ETH', price: 2850.50, change24h: -0.5 },
    { symbol: 'SOL', price: 145.20, change24h: 2.1 },
    { symbol: 'VOO', price: 545.12, change24h: 0.3 },
    { symbol: 'VOOG', price: 310.45, change24h: 0.45 }
  ]);

  const [pendingApprovals, setPendingApprovals] = useState<AIAnalysisResult[]>([]);
  const [editingApprovalIndex, setEditingApprovalIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Fiscal Cycle Reset Detection
  useEffect(() => {
    if (!isAuthenticated) return;
    const now = new Date();
    const currentCycleYearMonth = now.getDate() < 25 
      ? `${now.getFullYear()}-${now.getMonth()}` 
      : `${now.getFullYear()}-${now.getMonth() + 1}`; 
    const lastCheck = localStorage.getItem(STORAGE_KEYS.LAST_CYCLE_CHECK);
    if (lastCheck && lastCheck !== currentCycleYearMonth) {
      const prevCycleStart = new Date(now.getFullYear(), now.getMonth(), 25);
      if (now.getDate() < 25) prevCycleStart.setMonth(prevCycleStart.getMonth() - 2);
      else prevCycleStart.setMonth(prevCycleStart.getMonth() - 1);
      const prevCycleEnd = new Date(prevCycleStart);
      prevCycleEnd.setMonth(prevCycleEnd.getMonth() + 1);
      prevCycleEnd.setDate(24);
      setRecurringExpenses(prev => prev.map(bill => {
        const wasPaidInCycle = transactions.some(t => t.recurringId === bill.id && new Date(t.date) >= prevCycleStart && new Date(t.date) <= prevCycleEnd);
        if (!wasPaidInCycle) return { ...bill, accumulatedOverdue: (bill.accumulatedOverdue || 0) + bill.amount };
        return bill;
      }));
      setRecurringIncomes(prev => prev.map(inc => ({ ...inc, accumulatedReceived: 0 })));
    }
    localStorage.setItem(STORAGE_KEYS.LAST_CYCLE_CHECK, currentCycleYearMonth);
  }, [isAuthenticated, transactions]);

  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) setHasApiKey(await aistudio.hasSelectedApiKey());
      else setHasApiKey(true);
    };
    checkKey();
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.RECURRING_EXPENSES, JSON.stringify(recurringExpenses)); }, [recurringExpenses]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.RECURRING_INCOMES, JSON.stringify(recurringIncomes)); }, [recurringIncomes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SALARY, salary.toString()); }, [salary]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TARGET_MARGIN, targetMargin.toString()); }, [targetMargin]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CATEGORY_LIMITS, JSON.stringify(categoryBudgets)); }, [categoryBudgets]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(savingGoals)); }, [savingGoals]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.INVESTMENT_GOALS, JSON.stringify(investmentGoals)); }, [investmentGoals]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BANK_CONNECTIONS, JSON.stringify(bankConnections)); }, [bankConnections]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.INVESTMENTS, JSON.stringify(investments)); }, [investments]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events)); }, [events]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.REMINDERS, remindersEnabled.toString()); }, [remindersEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketPrices(prev => prev.map(p => {
        const isCrypto = ['BTC', 'ETH', 'SOL'].includes(p.symbol);
        const drift = (Math.random() - 0.48) * (isCrypto ? (p.symbol === 'BTC' ? 40 : 2) : 0.2);
        return { ...p, price: Math.max(0, p.price + drift), change24h: p.change24h + (Math.random() - 0.5) * 0.08 };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const readilyAvailableFunds = useMemo(() => {
    const primaryBank = bankConnections.find(c => c.institution.includes('1st National'));
    const opening = primaryBank?.openingBalance || 0;
    const flow = transactions.filter(t => t.institution === primaryBank?.institution || t.destinationInstitution === primaryBank?.institution || t.institution === 'Cash in Hand' || t.destinationInstitution === 'Cash in Hand').reduce((acc, t) => {
       if (t.destinationInstitution === '1st National Bank St. Lucia' || t.destinationInstitution === 'Cash in Hand') { if (t.type === 'transfer' || t.type === 'withdrawal') return acc + t.amount; }
       if (t.institution === '1st National Bank St. Lucia' || t.institution === 'Cash in Hand') { if (t.type === 'income') return acc + t.amount; if (t.type === 'expense' || t.type === 'transfer' || t.type === 'withdrawal' || t.type === 'savings') return acc - t.amount; }
       return acc;
    }, 0);
    return opening + flow;
  }, [transactions, bankConnections]);

  const handleLogin = (u: string, p: string): boolean => {
    if (u === atob(_U) && p === atob(_P)) {
      setIsAuthenticated(true);
      localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    setShowSettings(false);
  };

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = { ...t, id: generateId(), institution: t.institution || 'Cash in Hand' };
    setTransactions(prev => [newTransaction, ...prev]);
    if (t.recurringId) {
       setRecurringExpenses(prev => prev.map(rec => {
          if (rec.id === t.recurringId) {
             const totalDue = rec.amount + (rec.accumulatedOverdue || 0);
             if (t.amount >= totalDue) {
                const dueDate = new Date(rec.nextDueDate);
                dueDate.setMonth(dueDate.getMonth() + 1);
                return { ...rec, accumulatedOverdue: 0, lastBilledDate: t.date, nextDueDate: dueDate.toISOString().split('T')[0] };
             }
             return { ...rec, accumulatedOverdue: Math.max(0, totalDue - t.amount), lastBilledDate: t.date };
          }
          return rec;
       }));
       setRecurringIncomes(prev => prev.map(inc => {
          if (inc.id === t.recurringId) {
             const alreadyReceived = inc.accumulatedReceived || 0;
             if (alreadyReceived + t.amount >= inc.amount) {
                const nextDate = new Date(inc.nextConfirmationDate);
                nextDate.setMonth(nextDate.getMonth() + 1);
                return { ...inc, lastConfirmedDate: t.date, nextConfirmationDate: nextDate.toISOString().split('T')[0], accumulatedReceived: 0 };
             }
             return { ...inc, lastConfirmedDate: t.date, accumulatedReceived: alreadyReceived + t.amount };
          }
          return inc;
       }));
    }
  };

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;
  
  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl mx-auto mb-8"><i className="fas fa-microchip"></i></div>
          <h2 className="text-2xl font-black text-slate-800 mb-4">Initialize AI Core</h2>
          <button onClick={() => (window as any).aistudio.openSelectKey().then(() => setHasApiKey(true))} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">Select API Key</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 max-w-6xl mx-auto pt-16 relative">
      <MarketTicker prices={marketPrices} />
      <header className="flex items-center justify-between mb-8 mt-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-100"><i className="fas fa-chart-pie"></i></div>
            Fire Finance <span className="text-indigo-600">Pro v1</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Universal Command Center</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowBankModal(true)} className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-indigo-600 hover:bg-indigo-50 transition shadow-sm" title="Bank Sync"><i className="fas fa-plug"></i></button>
          <button onClick={() => setShowManualEntry(true)} className="w-11 h-11 flex items-center justify-center bg-indigo-600 border border-indigo-500 rounded-xl text-white hover:bg-slate-900 transition shadow-md" title="Manual Entry"><i className="fas fa-plus"></i></button>
          <button onClick={() => setShowSettings(true)} className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm" title="Settings"><i className="fas fa-cog"></i></button>
        </div>
      </header>

      <div className="flex justify-center mb-8">
        <nav className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
          <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>Dashboard</button>
          <button onClick={() => setActiveTab('events')} className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'events' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>Event Planner</button>
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
            <VerificationQueue pendingItems={pendingApprovals} onApprove={(idx) => { const item = pendingApprovals[idx]; if (item.updateType === 'portfolio' && item.portfolio) { setInvestments(prev => { const acc = prev.find(inv => inv.provider === item.portfolio!.provider); if (!acc) return [...prev, { id: generateId(), provider: item.portfolio!.provider, name: `${item.portfolio!.provider} Portfolio`, holdings: [{ symbol: item.portfolio!.symbol, quantity: item.portfolio!.quantity, purchasePrice: 0 }] }]; return prev.map(inv => inv.provider === item.portfolio!.provider ? { ...inv, holdings: inv.holdings.some(h => h.symbol === item.portfolio!.symbol) ? inv.holdings.map(h => h.symbol === item.portfolio!.symbol ? { ...h, quantity: item.portfolio!.quantity } : h) : [...inv.holdings, { symbol: item.portfolio!.symbol, quantity: item.portfolio!.quantity, purchasePrice: 0 }] } : inv); }); } else if (item.transaction) { addTransaction(item.transaction as Transaction); } setPendingApprovals(p => p.filter((_, i) => i !== idx)); }} onDiscard={(idx) => setPendingApprovals(p => p.filter((_, i) => i !== idx))} onEdit={() => {}} onDiscardAll={() => setPendingApprovals([])} />
            <Dashboard transactions={transactions} recurringExpenses={recurringExpenses} recurringIncomes={recurringIncomes} savingGoals={savingGoals} investmentGoals={investmentGoals} investments={investments} marketPrices={marketPrices} bankConnections={bankConnections} targetMargin={targetMargin} categoryBudgets={categoryBudgets} onEdit={(t) => setTransactions(prev => prev.map(item => item.id === t.id ? t : item))} onDelete={(id) => setTransactions(prev => prev.filter(t => t.id !== id))} onPayRecurring={(rec, amt) => addTransaction({ amount: amt, description: rec.description, category: rec.category, type: 'expense', date: new Date().toISOString().split('T')[0], recurringId: rec.id, institution: '1st National Bank St. Lucia' })} onReceiveRecurringIncome={(inc, amt) => addTransaction({ amount: amt, description: `Income: ${inc.description}`, category: inc.category, type: 'income', date: new Date().toISOString().split('T')[0], recurringId: inc.id, institution: '1st National Bank St. Lucia' })} onContributeSaving={() => {}} onWithdrawSaving={() => {}} onWithdrawal={() => {}} onAddIncome={() => {}} />
          </>
        ) : (
          <EventPlanner 
            events={events} 
            contacts={contacts}
            onAddEvent={(e) => setEvents(prev => [...prev, { ...e, id: generateId(), items: [], notes: [], tasks: [], files: [], contactIds: [] }])} 
            onDeleteEvent={(id) => setEvents(prev => prev.filter(e => e.id !== id))} 
            onUpdateEvent={(updated) => setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))}
            onUpdateContacts={setContacts}
          />
        )}
      </main>

      <BudgetAssistant transactions={transactions} investments={investments} marketPrices={marketPrices} availableFunds={readilyAvailableFunds} />
      {showManualEntry && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div><h2 className="text-xl font-black text-slate-800">Record Transaction</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manual Ledger Entry</p></div>
              <button onClick={() => setShowManualEntry(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition"><i className="fas fa-times"></i></button>
            </div>
            <div className="p-2"><TransactionForm bankConnections={bankConnections} onAdd={(t) => { addTransaction(t); setShowManualEntry(false); }} onCancel={() => setShowManualEntry(false)} /></div>
          </div>
        </div>
      )}
      {showSettings && <Settings salary={salary} onUpdateSalary={setSalary} targetMargin={targetMargin} onUpdateTargetMargin={setTargetMargin} categoryBudgets={categoryBudgets} onUpdateCategoryBudgets={setCategoryBudgets} recurringExpenses={recurringExpenses} onAddRecurring={(b) => setRecurringExpenses(p => [...p, {...b, id: generateId(), accumulatedOverdue: 0}])} onUpdateRecurring={(b) => setRecurringExpenses(p => p.map(x => x.id === b.id ? b : x))} onDeleteRecurring={(id) => setRecurringExpenses(p => p.filter(x => x.id !== id))} recurringIncomes={recurringIncomes} onAddRecurringIncome={(i) => setRecurringIncomes(p => [...p, {...i, id: generateId(), accumulatedReceived: 0}])} onUpdateRecurringIncome={(i) => setRecurringIncomes(p => p.map(x => x.id === i.id ? i : x))} onDeleteRecurringIncome={(id) => setRecurringIncomes(p => p.filter(x => x.id !== id))} savingGoals={savingGoals} onAddSavingGoal={(g) => setSavingGoals(p => [...p, {...g, id: generateId(), currentAmount: g.openingBalance}])} onDeleteSavingGoal={(id) => setSavingGoals(p => p.filter(x => x.id !== id))} investmentGoals={investmentGoals} onAddInvestmentGoal={(g) => setInvestmentGoals(p => [...p, {...g, id: generateId()}])} onDeleteInvestmentGoal={(id) => setInvestmentGoals(p => p.filter(x => x.id !== id))} onExportData={() => {}} onResetData={() => {}} onClose={() => setShowSettings(false)} onLogout={handleLogout} remindersEnabled={remindersEnabled} onToggleReminders={setRemindersEnabled} currentBank={bankConnections[0] || {institution: '', status: 'unlinked', institutionType: 'bank', openingBalance: 0}} onResetBank={() => {}} />}
      {showBankModal && <BankSyncModal onSuccess={(inst, last4, open, type) => { setBankConnections(prev => [...prev, { institution: inst, institutionType: type, status: 'linked', accountLastFour: last4, openingBalance: open, lastSynced: new Date().toLocaleTimeString() }]); setShowBankModal(false); }} onClose={() => setShowBankModal(false)} />}
    </div>
  );
};

export default App;
