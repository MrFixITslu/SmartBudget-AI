
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
import { syncBankData } from './services/bankApiService';
import { Transaction, AIAnalysisResult, RecurringExpense, RecurringIncome, SavingGoal, BankConnection, InvestmentAccount, MarketPrice, InstitutionType, BudgetEvent, PortfolioUpdate } from './types';

// Simple obfuscated credentials
const _U = "bnN2"; // nsv
const _P = "JGgzcnchbg=="; // $h3rw!n

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Persistent auth using localStorage for "Auto Login"
    return localStorage.getItem('ff_auth') === 'true';
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events'>('dashboard');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // REMOTE LOGIN HANDLER
  useEffect(() => {
    const handleRemoteLogin = () => {
      const hash = window.location.hash;
      if (hash.includes('u=') && hash.includes('p=')) {
        const params = new URLSearchParams(hash.substring(1));
        const u = params.get('u');
        const p = params.get('p');
        if (u && p) {
          const success = handleLogin(u, p);
          if (success) {
            // Clear hash after successful remote login
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
        }
      }
    };
    handleRemoteLogin();
    window.addEventListener('hashchange', handleRemoteLogin);
    return () => window.removeEventListener('hashchange', handleRemoteLogin);
  }, []);

  // Core State
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

  const [targetMargin, setTargetMargin] = useState<number>(() => {
    const saved = localStorage.getItem('budget_target_margin');
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
    { symbol: 'BTC', price: 92450.00, change24h: 1.2 },
    { symbol: 'ETH', price: 2850.50, change24h: -0.5 },
    { symbol: 'VOO', price: 545.12, change24h: 0.3 }
  ]);

  // Verification Staging State
  const [pendingApprovals, setPendingApprovals] = useState<AIAnalysisResult[]>([]);
  const [editingApprovalIndex, setEditingApprovalIndex] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  // OVERDUE CHECKER
  useEffect(() => {
    const now = new Date();
    let updated = false;

    const newRecurringExpenses = recurringExpenses.map(rec => {
      const dueDate = new Date(rec.nextDueDate);
      if (now > dueDate) {
        updated = true;
        const nextDate = new Date(dueDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        return {
          ...rec,
          accumulatedOverdue: rec.accumulatedOverdue + rec.amount,
          nextDueDate: nextDate.toISOString().split('T')[0]
        };
      }
      return rec;
    });

    if (updated) {
      setRecurringExpenses(newRecurringExpenses);
    }
  }, [recurringExpenses.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketPrices(prev => prev.map(p => {
        const drift = (Math.random() - 0.48) * (p.symbol === 'BTC' ? 40 : 0.4);
        return { 
          ...p, 
          price: Math.max(0, p.price + drift),
          change24h: p.change24h + (Math.random() - 0.5) * 0.08
        };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { localStorage.setItem('budget_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('budget_recurring', JSON.stringify(recurringExpenses)); }, [recurringExpenses]);
  useEffect(() => { localStorage.setItem('budget_recurring_incomes', JSON.stringify(recurringIncomes)); }, [recurringIncomes]);
  useEffect(() => { localStorage.setItem('budget_salary', salary.toString()); }, [salary]);
  useEffect(() => { localStorage.setItem('budget_target_margin', targetMargin.toString()); }, [targetMargin]);
  useEffect(() => { localStorage.setItem('budget_savings_goals', JSON.stringify(savingGoals)); }, [savingGoals]);
  useEffect(() => { localStorage.setItem('budget_bank_conns', JSON.stringify(bankConnections)); }, [bankConnections]);
  useEffect(() => { localStorage.setItem('budget_investments', JSON.stringify(investments)); }, [investments]);
  useEffect(() => { localStorage.setItem('budget_events', JSON.stringify(events)); }, [events]);

  const readilyAvailableFunds = useMemo(() => {
    const primaryBank = bankConnections.find(c => c.institution.includes('1st National'));
    const opening = primaryBank?.openingBalance || 0;
    const relevantHistory = transactions.filter(t => 
      t.institution === primaryBank?.institution || t.institution === 'Cash in Hand'
    );
    const flow = relevantHistory.reduce((acc, t) => {
       if (t.type === 'income' || t.type === 'withdrawal') return acc + t.amount;
       if (t.type === 'expense') return acc - t.amount;
       return acc;
    }, 0);
    return opening + flow;
  }, [transactions, bankConnections]);

  const handleLogin = (u: string, p: string): boolean => {
    if (u === atob(_U) && p === atob(_P)) {
      setIsAuthenticated(true);
      localStorage.setItem('ff_auth', 'true');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ff_auth');
    setShowSettings(false);
  };

  const handleAIAnalysis = (result: AIAnalysisResult) => {
    setPendingApprovals(prev => [...prev, result]);
  };

  const handleBulkAIAnalysis = (results: AIAnalysisResult[]) => {
    setPendingApprovals(prev => [...prev, ...results]);
  };

  const approveItem = (index: number) => {
    const item = pendingApprovals[index];
    if (!item) return;

    if (item.updateType === 'portfolio' && item.portfolio) {
      updatePortfolio(item.portfolio);
    } else if (item.updateType === 'transaction' && item.transaction) {
      addTransaction(item.transaction as Transaction);
    }
    setPendingApprovals(prev => prev.filter((_, i) => i !== index));
    if (editingApprovalIndex === index) setEditingApprovalIndex(null);
  };

  const discardItem = (index: number) => {
    setPendingApprovals(prev => prev.filter((_, i) => i !== index));
    if (editingApprovalIndex === index) setEditingApprovalIndex(null);
  };

  const updatePortfolio = (update: PortfolioUpdate) => {
    setInvestments(prev => prev.map(inv => {
      if (inv.provider === update.provider) {
        const existingIdx = inv.holdings.findIndex(h => h.symbol === update.symbol);
        const newHoldings = [...inv.holdings];
        if (existingIdx >= 0) {
          newHoldings[existingIdx] = { ...newHoldings[existingIdx], quantity: update.quantity };
        } else {
          newHoldings.push({ 
            symbol: update.symbol, 
            quantity: update.quantity, 
            purchasePrice: marketPrices.find(m => m.symbol === update.symbol)?.price || 0 
          });
        }
        return { ...inv, holdings: newHoldings };
      }
      return inv;
    }));
  };

  const updateTransaction = (t: Transaction) => {
    setTransactions(prev => prev.map(item => item.id === t.id ? t : item));
  };

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const finalInstitution = t.institution || 'Cash in Hand';
    const newTransaction: Transaction = { ...t, id: generateId(), institution: finalInstitution };
    const transactionsToAdd: Transaction[] = [newTransaction];
    
    // Auto-handling of savings logic
    const descLower = t.description.toLowerCase();
    const isSavingsTarget = descLower.includes('general saving') || descLower.includes('vacation saving');
    if (isSavingsTarget && t.type === 'expense') {
      transactionsToAdd.push({
        id: generateId() + '-transfer',
        amount: t.amount,
        description: `Savings Transfer: ${t.description}`,
        category: 'Savings',
        type: 'income',
        date: t.date,
        institution: 'Laborie Cooperative Credit Union'
      });
    }

    setTransactions(prev => [...transactionsToAdd, ...prev]);

    // Handle updates for recurring items
    if (t.recurringId) {
       const targetExpense = recurringExpenses.find(r => r.id === t.recurringId);
       if (targetExpense) {
          const desc = targetExpense.description.toLowerCase();
          let targetGoalName = '';
          if (desc.includes('general saving')) targetGoalName = 'general savings';
          else if (desc.includes('vacation saving')) targetGoalName = 'vacation';
          else if (targetExpense.category === 'Savings') targetGoalName = desc;
          if (targetGoalName) {
            setSavingGoals(prevGoals => prevGoals.map(goal => {
              if (goal.name.toLowerCase() === targetGoalName.toLowerCase()) {
                return { ...goal, currentAmount: goal.currentAmount + t.amount };
              }
              return goal;
            }));
          }
       }
       setRecurringExpenses(prev => prev.map(rec => {
          if (rec.id === t.recurringId) {
             const totalDue = rec.amount + rec.accumulatedOverdue;
             if (t.amount >= totalDue) {
                const dueDate = new Date(rec.nextDueDate);
                dueDate.setMonth(dueDate.getMonth() + 1);
                return { ...rec, accumulatedOverdue: 0, lastBilledDate: t.date, nextDueDate: dueDate.toISOString().split('T')[0] };
             } else {
                return { ...rec, accumulatedOverdue: Math.max(0, totalDue - t.amount), lastBilledDate: t.date };
             }
          }
          return rec;
       }));
       setRecurringIncomes(prev => prev.map(inc => {
          if (inc.id === t.recurringId) {
             const nextDate = new Date(inc.nextConfirmationDate);
             nextDate.setMonth(nextDate.getMonth() + 1);
             return { ...inc, lastConfirmedDate: t.date, nextConfirmationDate: nextDate.toISOString().split('T')[0] };
          }
          return inc;
       }));
    }
  };

  const handleWithdrawal = (institution: string, amount: number) => {
    addTransaction({
      amount,
      description: `Withdrawal from ${institution}`,
      category: 'Transfer',
      type: 'withdrawal',
      date: new Date().toISOString().split('T')[0],
      institution: institution
    });
  };

  const handleBankSuccess = async (institution: string, accountLastFour: string, openingBalance: number, institutionType: InstitutionType) => {
    const newConn: BankConnection = { 
      institution, institutionType, status: 'linked', accountLastFour, 
      lastSynced: new Date().toLocaleTimeString(), openingBalance
    };
    setBankConnections(prev => [...prev.filter(c => c.institution !== institution), newConn]);
    if (institutionType !== 'investment') {
      setIsLoading(true);
      const newApiData = await syncBankData(institution);
      if (newApiData && newApiData.length > 0) {
        const pendingResults: AIAnalysisResult[] = newApiData.map((res: any) => ({
          updateType: 'transaction',
          transaction: {
            amount: res.amount, category: res.category, description: res.description,
            type: res.type, date: res.date || new Date().toISOString().split('T')[0],
            vendor: res.vendor, institution: institution
          }
        }));
        setPendingApprovals(prev => [...prev, ...pendingResults]);
      }
      setIsLoading(false);
    } else {
      const newInv: InvestmentAccount = {
        id: generateId(), provider: institution as any, name: `${institution} Portfolio`, holdings: []
      };
      setInvestments(prev => [...prev.filter(i => i.provider !== institution), newInv]);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

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
    <div className="min-h-screen pb-20 px-4 md:px-6 max-w-6xl mx-auto pt-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-100"><i className="fas fa-chart-pie"></i></div>
            Fire Finance <span className="text-indigo-600">Pro v0.5</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">1st National Priority Enabled</p>
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

      <section className="mb-10 sticky top-4 z-30">
        <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-xl p-4 rounded-[2.5rem] border border-white shadow-2xl">
          <MagicInput 
            onSuccess={handleAIAnalysis} 
            onBulkSuccess={handleBulkAIAnalysis} 
            onLoading={setIsLoading} 
            onManualEntry={() => setShowManualEntry(true)} 
          />
        </div>
      </section>

      <main>
        {activeTab === 'dashboard' ? (
          <>
            <VerificationQueue pendingItems={pendingApprovals} onApprove={approveItem} onDiscard={discardItem} onEdit={setEditingApprovalIndex} onDiscardAll={() => setPendingApprovals([])} />
            <Dashboard 
              transactions={transactions} 
              recurringExpenses={recurringExpenses} 
              recurringIncomes={recurringIncomes}
              savingGoals={savingGoals} 
              investments={investments} 
              marketPrices={marketPrices}
              bankConnections={bankConnections} 
              targetMargin={targetMargin}
              onEdit={updateTransaction} 
              onDelete={(id) => setTransactions(prev => prev.filter(t => t.id !== id))}
              onPayRecurring={handlePayRecurring} 
              onReceiveRecurringIncome={handleReceiveRecurringIncome}
              onContributeSaving={handleContributeSaving} 
              onWithdrawSaving={handleWithdrawSaving}
              onWithdrawal={handleWithdrawal}
              onAddIncome={(amount, desc, notes) => addTransaction({ amount, description: desc, notes, type: 'income', category: 'Income', date: new Date().toISOString().split('T')[0] })}
            />
          </>
        ) : (
          <EventPlanner events={events} onAddEvent={(e) => setEvents(prev => [...prev, { ...e, id: generateId(), items: [] }])} onDeleteEvent={(id) => setEvents(prev => prev.filter(e => e.id !== id))} onUpdateEvent={(updated) => setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))} />
        )}
      </main>

      <BudgetAssistant transactions={transactions} investments={investments} marketPrices={marketPrices} availableFunds={readilyAvailableFunds} />

      {showManualEntry && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-black text-slate-800">Record Transaction</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manual Ledger Entry</p>
              </div>
              <button onClick={() => setShowManualEntry(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-2">
              <TransactionForm 
                bankConnections={bankConnections}
                onAdd={(t) => { addTransaction(t); setShowManualEntry(false); }} 
                onCancel={() => setShowManualEntry(false)} 
              />
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <Settings 
          salary={salary} 
          onUpdateSalary={setSalary} 
          targetMargin={targetMargin} 
          onUpdateTargetMargin={setTargetMargin} 
          recurringExpenses={recurringExpenses} 
          onAddRecurring={(b) => setRecurringExpenses(p => [...p, {...b, id: generateId(), accumulatedOverdue: 0}])} 
          onUpdateRecurring={(b) => setRecurringExpenses(p => p.map(x => x.id === b.id ? b : x))} 
          onDeleteRecurring={(id) => setRecurringExpenses(p => p.filter(x => x.id !== id))} 
          recurringIncomes={recurringIncomes} 
          onAddRecurringIncome={(i) => setRecurringIncomes(p => [...p, {...i, id: generateId()}])} 
          onUpdateRecurringIncome={(i) => setRecurringIncomes(p => p.map(x => x.id === i.id ? i : x))} 
          onDeleteRecurringIncome={(id) => setRecurringIncomes(p => p.filter(x => x.id !== id))} 
          savingGoals={savingGoals} 
          onAddSavingGoal={(g) => setSavingGoals(p => [...p, {...g, id: generateId(), currentAmount: g.openingBalance}])} 
          onDeleteSavingGoal={(id) => setSavingGoals(p => p.filter(x => x.id !== id))} 
          onExportData={() => {}} 
          onResetData={() => {}} 
          onClose={() => setShowSettings(false)} 
          onLogout={handleLogout}
          currentBank={bankConnections[0] || {institution: '', status: 'unlinked', institutionType: 'bank', openingBalance: 0}} 
          onResetBank={() => {}} 
        />
      )}
      {showBankModal && <BankSyncModal onSuccess={handleBankSuccess} onClose={() => setShowBankModal(false)} />}
    </div>
  );

  function handlePayRecurring(rec: RecurringExpense, amount: number) {
    addTransaction({ amount, description: rec.description, category: rec.category, type: 'expense', date: new Date().toISOString().split('T')[0], recurringId: rec.id, institution: '1st National Bank St. Lucia' });
  }
  function handleReceiveRecurringIncome(inc: RecurringIncome, amount: number) {
    addTransaction({ amount, description: `Income: ${inc.description}`, category: inc.category, type: 'income', date: new Date().toISOString().split('T')[0], recurringId: inc.id, institution: '1st National Bank St. Lucia' });
  }
  function handleContributeSaving(id: string, amount: number) {
    setSavingGoals(prev => prev.map(g => g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g));
  }
  function handleWithdrawSaving(id: string, amount: number) {
    setSavingGoals(prev => prev.map(g => g.id === id ? { ...g, currentAmount: Math.max(0, g.currentAmount - amount) } : g));
  }
};

export default App;
