
import React, { useState, useEffect, useMemo } from 'react';
import MagicInput from './components/MagicInput';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import BankSyncModal from './components/BankSyncModal';
import BudgetAssistant from './components/BudgetAssistant';
import EventPlanner from './components/EventPlanner';
import { syncBankData } from './services/bankApiService';
import { Transaction, AIAnalysisResult, RecurringExpense, RecurringIncome, SavingGoal, BankConnection, InvestmentAccount, MarketPrice, InstitutionType, BudgetEvent } from './types';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events'>('dashboard');

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('budget_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() => {
    const saved = localStorage.getItem('budget_recurring');
    return saved ? JSON.parse(saved) : [];
  });

  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>(() => {
    const saved = localStorage.getItem('budget_recurring_incomes');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [savingGoals, setSavingGoals] = useState<SavingGoal[]>(() => {
    const saved = localStorage.getItem('budget_savings_goals');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [salary, setSalary] = useState<number>(() => {
    const saved = localStorage.getItem('budget_salary');
    return saved ? parseFloat(saved) : 0;
  });

  const [bankConnections, setBankConnections] = useState<BankConnection[]>(() => {
    const saved = localStorage.getItem('budget_bank_conns');
    return saved ? JSON.parse(saved) : [];
  });

  const [investments, setInvestments] = useState<InvestmentAccount[]>(() => {
    const saved = localStorage.getItem('budget_investments');
    return saved ? JSON.parse(saved) : [];
  });

  const [events, setEvents] = useState<BudgetEvent[]>(() => {
    const saved = localStorage.getItem('budget_events');
    return saved ? JSON.parse(saved) : [];
  });

  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([
    { symbol: 'BTC', price: 68420.50, change24h: 2.4 },
    { symbol: 'VOO', price: 512.45, change24h: 0.8 },
    { symbol: 'VOOG', price: 345.12, change24h: 1.2 }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAIResult, setPendingAIResult] = useState<AIAnalysisResult | null>(null);
  const [pendingBulkResults, setPendingBulkResults] = useState<AIAnalysisResult[] | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);

  // Market Price Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketPrices(prev => prev.map(p => {
        const drift = (Math.random() - 0.48) * (p.symbol === 'BTC' ? 10 : 0.1);
        return { 
          ...p, 
          price: Math.max(0, p.price + drift),
          change24h: p.change24h + (Math.random() - 0.5) * 0.05
        };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Persistence
  useEffect(() => { localStorage.setItem('budget_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('budget_recurring', JSON.stringify(recurringExpenses)); }, [recurringExpenses]);
  useEffect(() => { localStorage.setItem('budget_recurring_incomes', JSON.stringify(recurringIncomes)); }, [recurringIncomes]);
  useEffect(() => { localStorage.setItem('budget_salary', salary.toString()); }, [salary]);
  useEffect(() => { localStorage.setItem('budget_savings_goals', JSON.stringify(savingGoals)); }, [savingGoals]);
  useEffect(() => { localStorage.setItem('budget_bank_conns', JSON.stringify(bankConnections)); }, [bankConnections]);
  useEffect(() => { localStorage.setItem('budget_investments', JSON.stringify(investments)); }, [investments]);
  useEffect(() => { localStorage.setItem('budget_events', JSON.stringify(events)); }, [events]);

  const availableFunds = useMemo(() => {
    const bankInitial = bankConnections.reduce((acc, c) => acc + (c.openingBalance || 0), 0);
    const income = transactions.filter(t => t.type === 'income' || t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);
    const outgoings = transactions.filter(t => t.type === 'expense' || t.type === 'savings').reduce((acc, t) => acc + t.amount, 0);
    return bankInitial + income - outgoings;
  }, [transactions, bankConnections]);

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = { ...t, id: generateId() };
    setTransactions(prev => [newTransaction, ...prev]);
    setPendingAIResult(null);
  };

  const handleBankSuccess = async (institution: string, accountLastFour: string, openingBalance: number, institutionType: InstitutionType) => {
    const newConn: BankConnection = { 
      institution, 
      institutionType,
      status: 'linked', 
      accountLastFour, 
      lastSynced: new Date().toLocaleTimeString(),
      openingBalance
    };
    
    setBankConnections(prev => [...prev.filter(c => c.institution !== institution), newConn]);

    setIsLoading(true);
    const newApiData = await syncBankData(institution);
    if (newApiData.length > 0) {
      const apiTransactions = newApiData.map(res => ({ ...res, id: generateId(), date: res.date || new Date().toISOString().split('T')[0] } as Transaction));
      setTransactions(prev => [...apiTransactions, ...prev]);
    }

    if (institution === 'Binance') {
      const newInv: InvestmentAccount = {
        id: generateId(),
        provider: 'Binance',
        name: 'Spot Wallet',
        holdings: [{ symbol: 'BTC', quantity: 0.145, purchasePrice: 55000 }]
      };
      setInvestments(prev => [...prev, newInv]);
    } else if (institution === 'Vanguard') {
      const newInv: InvestmentAccount = {
        id: generateId(),
        provider: 'Vanguard',
        name: 'Personal Brokerage',
        holdings: [
          { symbol: 'VOO', quantity: 15, purchasePrice: 480 },
          { symbol: 'VOOG', quantity: 10, purchasePrice: 310 }
        ]
      };
      setInvestments(prev => [...prev, newInv]);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 max-w-6xl mx-auto pt-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg shadow-xl shadow-indigo-100">
              <i className="fas fa-chart-pie"></i>
            </div>
            SmartBudget <span className="text-indigo-600">Pro</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] ${isLoading ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-slate-200`}>
              {isLoading ? 'Fetching API Data...' : `${bankConnections.length + investments.length} Active API Channels`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Available</span>
            <span className={`text-xl font-black ${availableFunds >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              ${availableFunds.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <button 
            onClick={() => setShowBankModal(true)}
            className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-indigo-600 hover:bg-indigo-50 transition shadow-sm"
          >
            <i className="fas fa-plug"></i>
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 transition shadow-sm"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <div className="flex justify-center mb-8">
        <nav className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fas fa-th-large"></i> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'events' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fas fa-calendar-alt"></i> Event Planner
          </button>
        </nav>
      </div>

      <section className="mb-10 sticky top-4 z-30">
        <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-xl p-4 rounded-[2.5rem] border border-white shadow-2xl shadow-slate-200/50">
          {editingTransaction ? (
             <TransactionForm 
                onAdd={(t) => { setTransactions(prev => prev.map(item => item.id === (editingTransaction as any).id ? { ...t, id: item.id } as any : item)); setEditingTransaction(null); }} 
                initialData={editingTransaction} 
                onCancel={() => setEditingTransaction(null)} 
             />
          ) : pendingBulkResults ? (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-3xl">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="font-bold text-indigo-900 uppercase text-xs tracking-widest">API Batch Review ({pendingBulkResults.length})</h3>
                 <div className="flex gap-2">
                   <button onClick={() => setPendingBulkResults(null)} className="px-3 py-2 bg-white text-slate-600 text-[10px] font-black uppercase rounded-xl border border-slate-200">Discard</button>
                   <button onClick={() => { handleBulkConfirm(); setPendingBulkResults(null); }} className="px-3 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg">Commit</button>
                 </div>
               </div>
               <div className="max-h-32 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {pendingBulkResults.map((r, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/50 p-2.5 rounded-xl border border-white">
                      <span className="font-bold text-slate-400 text-[10px] w-12">{r.date?.slice(5)}</span>
                      <span className="flex-1 px-2 truncate font-bold text-slate-700 text-xs">{r.description}</span>
                      <span className={`text-[11px] font-black ${r.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>${r.amount.toFixed(2)}</span>
                    </div>
                  ))}
               </div>
            </div>
          ) : (
            <>
              <MagicInput onSuccess={setPendingAIResult} onBulkSuccess={setPendingBulkResults} onLoading={setIsLoading} />
              {isLoading && (activeTab === 'dashboard') && (
                <div className="mt-4 flex items-center justify-center gap-3 p-4 bg-indigo-50 rounded-2xl text-indigo-600 animate-pulse border border-indigo-100">
                  <i className="fas fa-network-wired fa-spin"></i>
                  <span className="font-black text-xs uppercase tracking-widest">Synching Secure API Channels...</span>
                </div>
              )}
              {pendingAIResult && (
                <div className="mt-6 animate-in slide-in-from-top-4 duration-300">
                  <TransactionForm onAdd={addTransaction} initialData={pendingAIResult} onCancel={() => setPendingAIResult(null)} />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <main>
        {activeTab === 'dashboard' ? (
          <Dashboard 
            transactions={transactions} 
            recurringExpenses={recurringExpenses}
            recurringIncomes={recurringIncomes}
            savingGoals={savingGoals}
            investments={investments}
            marketPrices={marketPrices}
            bankConnections={bankConnections}
            onEdit={setEditingTransaction} 
            onDelete={(id) => setTransactions(prev => prev.filter(t => t.id !== id))}
            onPayRecurring={handlePayRecurring} 
            onReceiveRecurringIncome={handleReceiveRecurringIncome}
            onContributeSaving={handleContributeSaving}
            onWithdrawSaving={handleWithdrawSaving}
            onAddIncome={(amount, desc, notes) => addTransaction({ amount, description: desc, notes, type: 'income', category: 'Income', date: new Date().toISOString().split('T')[0] })}
          />
        ) : (
          <EventPlanner 
            events={events}
            onAddEvent={(e) => setEvents(prev => [...prev, { ...e, id: generateId(), items: [] }])}
            onDeleteEvent={(id) => setEvents(prev => prev.filter(e => e.id !== id))}
            onUpdateEvent={(updated) => setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))}
          />
        )}
      </main>

      <BudgetAssistant 
        transactions={transactions}
        investments={investments}
        marketPrices={marketPrices}
        availableFunds={availableFunds}
      />

      {showSettings && (
        <Settings 
          salary={salary}
          onUpdateSalary={setSalary}
          recurringExpenses={recurringExpenses}
          onAddRecurring={handleAddRecurring}
          onUpdateRecurring={handleUpdateRecurring}
          onDeleteRecurring={handleDeleteRecurring}
          recurringIncomes={recurringIncomes}
          onAddRecurringIncome={handleAddRecurringIncome}
          onUpdateRecurringIncome={handleUpdateRecurringIncome}
          onDeleteRecurringIncome={handleDeleteRecurringIncome}
          savingGoals={savingGoals}
          onAddSavingGoal={handleAddSavingGoal}
          onDeleteSavingGoal={(id) => setSavingGoals(prev => prev.filter(g => g.id !== id))}
          onExportData={handleExportData}
          onResetData={handleResetData}
          onClose={() => setShowSettings(false)}
          currentBank={bankConnections[0] || { 
            institution: '', 
            status: 'unlinked', 
            institutionType: 'bank', 
            openingBalance: 0 
          }}
          onResetBank={() => setBankConnections([])}
        />
      )}

      {showBankModal && (
        <BankSyncModal onSuccess={handleBankSuccess} onClose={() => setShowBankModal(false)} />
      )}
    </div>
  );
  
  function handleBulkConfirm() {
    if (!pendingBulkResults) return;
    const newList = pendingBulkResults.map(res => ({ ...res, id: generateId(), date: res.date || new Date().toISOString().split('T')[0] } as Transaction));
    setTransactions(prev => [...newList, ...prev]);
  }

  function handleAddRecurring(rec: any) { 
    setRecurringExpenses(prev => [...prev, { ...rec, id: generateId(), balance: rec.amount }]); 
  }

  function handleUpdateRecurring(updated: any) { 
    setRecurringExpenses(prev => prev.map(r => r.id === updated.id ? updated : r)); 
  }

  function handleDeleteRecurring(id: string) { 
    setRecurringExpenses(prev => prev.filter(r => r.id !== id)); 
  }

  function handlePayRecurring(rec: RecurringExpense, amount: number) {
    addTransaction({ amount, description: `Bill Payment: ${rec.description}`, category: rec.category, type: 'expense', date: new Date().toISOString().split('T')[0], recurringId: rec.id });
    
    setRecurringExpenses(prev => prev.map(r => {
      if (r.id === rec.id) {
        const newBalance = r.balance - amount;
        if (newBalance <= 0) {
          return { ...r, balance: r.amount, lastBilledDate: new Date().toISOString() };
        }
        return { ...r, balance: newBalance };
      }
      return r;
    }));
  }
  
  function handleAddRecurringIncome(inc: any) { 
    setRecurringIncomes(prev => [...prev, { ...inc, id: generateId() }]); 
  }

  function handleUpdateRecurringIncome(updated: any) { 
    setRecurringIncomes(prev => prev.map(i => i.id === updated.id ? updated : i)); 
  }

  function handleDeleteRecurringIncome(id: string) { 
    setRecurringIncomes(prev => prev.filter(i => i.id !== id)); 
  }

  function handleReceiveRecurringIncome(inc: RecurringIncome, amount: number) {
    addTransaction({ amount, description: `Recurring Income: ${inc.description}`, category: inc.category, type: 'income', date: new Date().toISOString().split('T')[0], recurringId: inc.id });
    
    setRecurringIncomes(prev => prev.map(i => {
      if (i.id === inc.id) {
        return { ...i, lastConfirmedDate: new Date().toISOString() };
      }
      return i;
    }));
  }

  function handleAddSavingGoal(goal: any) { 
    setSavingGoals(prev => [...prev, { ...goal, id: generateId(), currentAmount: goal.openingBalance }]); 
  }

  function handleContributeSaving(id: string, amount: number) {
    addTransaction({ amount, description: 'Savings Contribution', category: 'Savings', type: 'savings', date: new Date().toISOString().split('T')[0], savingGoalId: id });
    setSavingGoals(prev => prev.map(g => g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g));
  }

  function handleWithdrawSaving(id: string, amount: number) {
    addTransaction({ amount, description: 'Savings Withdrawal', category: 'Savings', type: 'withdrawal', date: new Date().toISOString().split('T')[0], savingGoalId: id });
    setSavingGoals(prev => prev.map(g => g.id === id ? { ...g, currentAmount: Math.max(0, g.currentAmount - amount) } : g));
  }

  function handleExportData() {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Date,Description,Amount,Type,Category,Vendor,Notes\n" +
      transactions.map(t => `${t.date},${t.description},${t.amount},${t.type},${t.category},${t.vendor || ''},${t.notes || ''}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `budget_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  }

  function handleResetData() { 
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) { 
      localStorage.clear(); 
      window.location.reload(); 
    } 
  }
};

export default App;
