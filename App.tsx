
import React, { useState, useEffect, useMemo } from 'react';
import MagicInput from './components/MagicInput';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { Transaction, AIAnalysisResult, RecurringExpense, SavingGoal } from './types';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [savingGoals, setSavingGoals] = useState<SavingGoal[]>([]);
  const [salary, setSalary] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAIResult, setPendingAIResult] = useState<AIAnalysisResult | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Load from Local Storage on Mount
  useEffect(() => {
    const savedTrans = localStorage.getItem('budget_transactions');
    const savedRec = localStorage.getItem('budget_recurring');
    const savedSalary = localStorage.getItem('budget_salary');
    const savedGoals = localStorage.getItem('budget_savings_goals');

    if (savedTrans) setTransactions(JSON.parse(savedTrans));
    if (savedRec) setRecurringExpenses(JSON.parse(savedRec));
    if (savedSalary) setSalary(parseFloat(savedSalary));
    if (savedGoals) setSavingGoals(JSON.parse(savedGoals));
  }, []);

  // Save to Local Storage on Change
  useEffect(() => {
    localStorage.setItem('budget_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('budget_recurring', JSON.stringify(recurringExpenses));
  }, [recurringExpenses]);

  useEffect(() => {
    localStorage.setItem('budget_salary', salary.toString());
  }, [salary]);

  useEffect(() => {
    localStorage.setItem('budget_savings_goals', JSON.stringify(savingGoals));
  }, [savingGoals]);

  // Total Available Funds (All-time balance)
  const availableFunds = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income' || t.type === 'withdrawal')
      .reduce((acc, t) => acc + t.amount, 0);
    const outgoings = transactions
      .filter(t => t.type === 'expense' || t.type === 'savings')
      .reduce((acc, t) => acc + t.amount, 0);
    return income - outgoings;
  }, [transactions]);

  // Logic to handle auto-salary on the 25th
  useEffect(() => {
    if (salary <= 0) return;

    const now = new Date();
    let cycleMonthDate = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() < 25) {
      cycleMonthDate.setMonth(cycleMonthDate.getMonth() - 1);
    }

    const cycleMonth = cycleMonthDate.getMonth();
    const cycleYear = cycleMonthDate.getFullYear();

    const salaryExists = transactions.some(t => {
      const tDate = new Date(t.date);
      return t.type === 'income' && 
             t.description.toLowerCase().includes('salary') &&
             tDate.getMonth() === cycleMonth &&
             tDate.getFullYear() === cycleYear;
    });

    if (!salaryExists) {
      const salaryDate = new Date(cycleYear, cycleMonth, 25).toISOString().split('T')[0];
      const newSalaryTransaction: Transaction = {
        id: crypto.randomUUID(),
        amount: salary,
        description: `Monthly Salary confirmed for cycle starting ${cycleMonthDate.toLocaleString('default', { month: 'short' })} 25th`,
        category: 'Income',
        type: 'income',
        date: salaryDate,
        vendor: 'Employer'
      };
      setTransactions(prev => [newSalaryTransaction, ...prev]);
    }
  }, [salary, transactions.length]);

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    if ((t.type === 'expense' || t.type === 'savings') && t.amount > availableFunds) {
      alert(`Transaction declined: Insufficient total balance. Available: $${availableFunds.toFixed(2)}`);
      return;
    }

    const newTransaction: Transaction = {
      ...t,
      id: crypto.randomUUID()
    };
    setTransactions([newTransaction, ...transactions]);
    setPendingAIResult(null);
  };

  const handleAddAdditionalIncome = (amount: number, description: string, notes: string) => {
    const newTrans: Transaction = {
      id: crypto.randomUUID(),
      amount,
      description,
      notes,
      category: 'Income',
      type: 'income',
      date: new Date().toISOString().split('T')[0]
    };
    setTransactions(prev => [newTrans, ...prev]);
  };

  const updateTransaction = (t: Omit<Transaction, 'id'>) => {
    if (!editingTransaction) return;

    const currentBalanceWithoutThisOne = (editingTransaction.type === 'expense' || editingTransaction.type === 'savings')
      ? availableFunds + editingTransaction.amount 
      : availableFunds - editingTransaction.amount;

    if ((t.type === 'expense' || t.type === 'savings') && t.amount > currentBalanceWithoutThisOne) {
      alert(`Update declined: Insufficient total balance. Available: $${currentBalanceWithoutThisOne.toFixed(2)}`);
      return;
    }

    setTransactions(prev => prev.map(item => 
      item.id === editingTransaction.id ? { ...t, id: item.id } : item
    ));
    setEditingTransaction(null);
  };

  const deleteTransaction = (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      const t = transactions.find(x => x.id === id);
      if (t && t.recurringId) {
        setRecurringExpenses(prev => prev.map(rec => 
          rec.id === t.recurringId ? { ...rec, balance: rec.balance + t.amount } : rec
        ));
      }
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const handlePayRecurring = (rec: RecurringExpense, payAmount: number) => {
    if (payAmount > availableFunds) {
      alert(`Payment declined: Insufficient funds. Balance: $${availableFunds.toFixed(2)}`);
      return;
    }

    const date = new Date();
    const transDate = date.toISOString().split('T')[0];

    const newTrans: Transaction = {
      id: crypto.randomUUID(),
      amount: payAmount,
      description: `Payment for ${rec.description}`,
      category: rec.category,
      type: 'expense',
      date: transDate,
      recurringId: rec.id
    };

    setTransactions([newTrans, ...transactions]);
    setRecurringExpenses(prev => prev.map(item => 
      item.id === rec.id ? { ...item, balance: Math.max(0, item.balance - payAmount) } : item
    ));
  };

  const handleContributeToSaving = (goalId: string, amount: number) => {
    if (amount > availableFunds) {
      alert(`Savings contribution declined: Insufficient funds. Balance: $${availableFunds.toFixed(2)}`);
      return;
    }

    setTransactions(prev => [
      {
        id: crypto.randomUUID(),
        amount,
        description: 'Transfer to Savings',
        category: 'Savings',
        type: 'savings',
        date: new Date().toISOString().split('T')[0],
        savingGoalId: goalId
      },
      ...prev
    ]);

    setSavingGoals(prev => prev.map(g => 
      g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount } : g
    ));
  };

  const handleWithdrawFromSaving = (goalId: string, amount: number) => {
    const goal = savingGoals.find(g => g.id === goalId);
    if (!goal || amount > goal.currentAmount) {
      alert(`Withdrawal declined: Goal has insufficient balance.`);
      return;
    }

    setTransactions(prev => [
      {
        id: crypto.randomUUID(),
        amount,
        description: `Withdrawal from ${goal.name}`,
        category: 'Income',
        type: 'withdrawal',
        date: new Date().toISOString().split('T')[0],
        savingGoalId: goalId
      },
      ...prev
    ]);

    setSavingGoals(prev => prev.map(g => 
      g.id === goalId ? { ...g, currentAmount: g.currentAmount - amount } : g
    ));
  };

  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 max-w-5xl mx-auto pt-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm">
              <i className="fas fa-wallet"></i>
            </div>
            SmartBudget <span className="text-indigo-600">AI</span>
          </h1>
          <p className="text-slate-500 text-sm">Friction-less finance tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Available Funds</span>
            <span className={`text-lg font-black ${availableFunds >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ${availableFunds.toFixed(2)}
            </span>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 transition shadow-sm relative"
            title="Budget Settings"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </header>

      {/* Primary Input & Edit Section */}
      <section className="mb-10 sticky top-4 z-30">
        <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-2xl shadow-slate-200/50">
          
          {editingTransaction ? (
            <div className="animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="font-bold text-slate-700">Edit Transaction</h3>
                <button onClick={() => setEditingTransaction(null)} className="text-slate-400 hover:text-slate-600 text-sm font-medium">Cancel</button>
              </div>
              <TransactionForm onAdd={updateTransaction} initialData={editingTransaction} onCancel={() => setEditingTransaction(null)} />
            </div>
          ) : (
            <>
              <MagicInput onSuccess={setPendingAIResult} onLoading={setIsLoading} />
              {isLoading && (
                <div className="mt-4 flex items-center justify-center gap-3 p-4 bg-indigo-50 rounded-2xl text-indigo-600 animate-pulse border border-indigo-100">
                  <i className="fas fa-circle-notch fa-spin"></i>
                  <span className="font-medium">AI is analyzing...</span>
                </div>
              )}
              {pendingAIResult && (
                <div className="mt-6 animate-in slide-in-from-top duration-300">
                  <TransactionForm onAdd={addTransaction} initialData={pendingAIResult} onCancel={() => setPendingAIResult(null)} />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <main>
        <Dashboard 
          transactions={transactions} 
          recurringExpenses={recurringExpenses}
          savingGoals={savingGoals}
          onEdit={setEditingTransaction} 
          onDelete={deleteTransaction}
          onPayRecurring={handlePayRecurring}
          onContributeSaving={handleContributeToSaving}
          onWithdrawSaving={handleWithdrawFromSaving}
          onAddIncome={handleAddAdditionalIncome}
        />
      </main>

      {showSettings && (
        <Settings 
          salary={salary}
          onUpdateSalary={setSalary}
          recurringExpenses={recurringExpenses}
          onAddRecurring={item => setRecurringExpenses(prev => [...prev, { ...item, id: crypto.randomUUID(), balance: 0 }])}
          onDeleteRecurring={id => setRecurringExpenses(prev => prev.filter(i => i.id !== id))}
          savingGoals={savingGoals}
          onAddSavingGoal={item => setSavingGoals(prev => [...prev, { ...item, id: crypto.randomUUID(), currentAmount: item.openingBalance }])}
          onDeleteSavingGoal={id => setSavingGoals(prev => prev.filter(i => i.id !== id))}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default App;
