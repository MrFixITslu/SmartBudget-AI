
import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, Legend } from 'recharts';
import { Transaction, RecurringExpense, RecurringIncome, SavingGoal, InvestmentAccount, MarketPrice, BankConnection, CATEGORIES } from '../types';
import { syncLucelecPortal } from '../services/bankApiService';
import TransactionForm from './TransactionForm';

interface InstitutionalBalance {
  balance: number;
  type: string;
  available: boolean;
  holdings?: any[];
  isCash?: boolean;
}

interface Props {
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  recurringIncomes: RecurringIncome[];
  savingGoals: SavingGoal[];
  investments: InvestmentAccount[];
  marketPrices: MarketPrice[];
  bankConnections: BankConnection[];
  targetMargin: number;
  categoryBudgets: Record<string, number>;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onPayRecurring: (rec: RecurringExpense, amount: number) => void;
  onReceiveRecurringIncome: (inc: RecurringIncome, amount: number) => void;
  onContributeSaving: (goalId: string, amount: number) => void;
  onWithdrawSaving: (goalId: string, amount: number) => void;
  onWithdrawal: (institution: string, amount: number) => void;
  onAddIncome: (amount: number, description: string, notes: string) => void;
}

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly';

const Dashboard: React.FC<Props> = ({ 
  transactions, investments, marketPrices, bankConnections, recurringExpenses, recurringIncomes, savingGoals, targetMargin, categoryBudgets, onWithdrawal, onDelete, onPayRecurring, onReceiveRecurringIncome, onEdit
}) => {
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [isSyncingPortal, setIsSyncingPortal] = useState<string | null>(null);
  const [trendTimeframe, setTrendTimeframe] = useState<Timeframe>('monthly');
  const [trendCategory, setTrendCategory] = useState<string>('All');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);

  const cycleStartDate = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() < 25) {
      start.setMonth(start.getMonth() - 1);
    }
    return start;
  }, []);

  const institutionalBalances = useMemo<Record<string, InstitutionalBalance>>(() => {
    const balances: Record<string, InstitutionalBalance> = {};
    bankConnections.forEach(conn => {
      const history = transactions.filter(t => t.institution === conn.institution);
      const flow = history.reduce((acc, t) => (t.type === 'income' || t.type === 'withdrawal') ? acc + t.amount : acc - t.amount, 0);
      balances[conn.institution] = { 
        balance: (conn.openingBalance || 0) + flow, 
        type: conn.institutionType, 
        available: conn.institution.includes('1st National') 
      };
    });

    const cashHistory = transactions.filter(t => t.institution === 'Cash in Hand');
    const cashFlow = cashHistory.reduce((acc, t) => {
      if (t.type === 'income' || t.type === 'withdrawal') return acc + t.amount;
      if (t.type === 'expense') return acc - t.amount;
      return acc;
    }, 0);
    balances['Cash in Hand'] = { balance: cashFlow, type: 'cash', available: true, isCash: true };

    investments.forEach(inv => {
      const liveVal = inv.holdings.reduce((hAcc, h) => {
        const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
        return hAcc + (h.quantity * live);
      }, 0);
      const withdrawFlow = transactions.filter(t => t.institution === inv.provider && t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);
      balances[inv.provider] = { balance: liveVal - withdrawFlow, type: 'investment', available: false, holdings: inv.holdings };
    });
    return balances;
  }, [bankConnections, investments, transactions, marketPrices]);

  const liquidFunds = useMemo(() => {
    const primary = institutionalBalances['1st National Bank St. Lucia']?.balance || 0;
    const cash = institutionalBalances['Cash in Hand']?.balance || 0;
    return primary + cash;
  }, [institutionalBalances]);

  const portfolioFunds = useMemo(() => (Object.values(institutionalBalances) as InstitutionalBalance[]).filter(b => b.type === 'investment').reduce((acc, b) => acc + b.balance, 0), [institutionalBalances]);
  const cryptoFunds = useMemo(() => (institutionalBalances['Binance'] as InstitutionalBalance | undefined)?.balance || 0, [institutionalBalances]);
  const netWorth: number = (Object.values(institutionalBalances) as InstitutionalBalance[]).reduce((acc: number, b) => acc + b.balance, 0);

  const totalMonthlyRecurringExpenses = useMemo(() => recurringExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0), [recurringExpenses]);
  const totalOverdue = useMemo(() => recurringExpenses.reduce((acc, curr) => acc + (curr.accumulatedOverdue || 0), 0), [recurringExpenses]);
  const totalMonthlyRecurringIncome = useMemo(() => recurringIncomes.reduce((acc, curr) => acc + (curr.amount || 0), 0), [recurringIncomes]);
  const safetyMargin = totalMonthlyRecurringIncome - totalMonthlyRecurringExpenses - totalOverdue;

  const currentMonthTransactions = useMemo(() => 
    transactions.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense'),
    [transactions, currentMonth]
  );

  const categorySpendActual = useMemo(() => {
    const totals: Record<string, number> = {};
    currentMonthTransactions.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    return totals;
  }, [currentMonthTransactions]);

  const budgetProgressItems = useMemo(() => {
    return (Object.entries(categoryBudgets) as [string, number][])
      .filter(([_, limit]) => limit > 0)
      .map(([cat, limit]) => {
        const actual = categorySpendActual[cat] || 0;
        return { category: cat, limit, actual, percent: Math.min(100, (actual / limit) * 100) };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [categoryBudgets, categorySpendActual]);

  const totalBudgetAllocated = useMemo(() => (Object.values(categoryBudgets) as number[]).reduce((acc, v) => acc + (v || 0), 0), [categoryBudgets]);

  const { daysUntil25th, dailySpendLimit } = useMemo(() => {
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() >= 25) target = new Date(now.getFullYear(), now.getMonth() + 1, 25);
    const diff = target.getTime() - now.getTime();
    const safeDays = Math.max(1, Math.ceil(diff / 86400000));
    const usableMargin = safetyMargin - totalBudgetAllocated;
    return { daysUntil25th: safeDays, dailySpendLimit: usableMargin > 0 ? usableMargin / safeDays : 0 };
  }, [safetyMargin, totalBudgetAllocated]);

  const manualTransactions = useMemo(() => 
    transactions.filter(t => !t.recurringId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions]
  );

  const trendData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const filtered = trendCategory === 'All' ? expenses : expenses.filter(t => t.category === trendCategory);
    const buckets: Record<string, number> = {};
    filtered.forEach(t => {
      let key = t.date.substring(0, trendTimeframe === 'daily' ? 10 : trendTimeframe === 'monthly' ? 7 : 4);
      buckets[key] = (buckets[key] || 0) + t.amount;
    });
    return Object.entries(buckets).map(([label, amount]) => ({ label, amount })).sort((a, b) => a.label.localeCompare(b.label)).slice(-12);
  }, [transactions, trendTimeframe, trendCategory]);

  const projectionData = useMemo(() => {
    const data = [];
    const monthlyNet = totalMonthlyRecurringIncome - totalMonthlyRecurringExpenses;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    let runningSavings = liquidFunds;
    for (let i = 0; i < 12; i++) {
      data.push({ name: months[(currentMonthIdx + i) % 12], ProjectedSavings: Math.round(runningSavings), MonthlySpend: Math.round(totalMonthlyRecurringExpenses) });
      runningSavings += monthlyNet;
    }
    return data;
  }, [liquidFunds, totalMonthlyRecurringIncome, totalMonthlyRecurringExpenses]);

  const cycleBills = useMemo(() => [...recurringExpenses].sort((a, b) => a.dayOfMonth - b.dayOfMonth), [recurringExpenses]);
  const cycleIncomes = useMemo(() => [...recurringIncomes].sort((a, b) => a.dayOfMonth - b.dayOfMonth), [recurringIncomes]);
  
  const cycleBillTotal = useMemo(() => cycleBills.reduce((acc, b) => acc + b.amount + (b.accumulatedOverdue || 0), 0), [cycleBills]);
  const cycleIncomeTotal = useMemo(() => cycleIncomes.reduce((acc, i) => acc + i.amount, 0), [cycleIncomes]);

  const isBillPaidInCycle = (bill: RecurringExpense) => {
    return transactions.some(t => 
      t.recurringId === bill.id && 
      new Date(t.date) >= cycleStartDate && 
      t.type === 'expense'
    );
  };

  const isIncomeReceivedInCycle = (income: RecurringIncome) => {
    return transactions.some(t => 
      t.recurringId === income.id && 
      new Date(t.date) >= cycleStartDate && 
      t.type === 'income'
    );
  };

  const settlementProgress = useMemo(() => {
    const totalItems = cycleBills.length + cycleIncomes.length;
    if (totalItems === 0) return 0;
    const settledIncomes = cycleIncomes.filter(isIncomeReceivedInCycle).length;
    const settledBills = cycleBills.filter(isBillPaidInCycle).length;
    return ((settledIncomes + settledBills) / totalItems) * 100;
  }, [cycleBills, cycleIncomes, transactions, cycleStartDate]);

  const handleSyncLucelec = async (id: string) => { setIsSyncingPortal(id); await syncLucelecPortal(); setIsSyncingPortal(null); };

  const renderIncomeCard = (income: RecurringIncome) => {
    const received = isIncomeReceivedInCycle(income);
    return (
      <div key={income.id} className={`p-5 border-2 rounded-[2rem] transition-all ${received ? 'bg-emerald-50/30 border-emerald-100 opacity-60 scale-[0.98]' : 'bg-white border-slate-100 shadow-sm'} flex items-center justify-between group`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${received ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 animate-pulse-soft'}`}><i className="fas fa-hand-holding-dollar"></i></div>
          <div>
            <p className={`font-black text-sm ${received ? 'text-slate-400' : 'text-slate-800'}`}>{income.description}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{received ? `Cleared on Cycle Start` : `Expected: the ${income.dayOfMonth}th`}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className={`font-black text-base ${received ? 'text-slate-300' : 'text-emerald-600'}`}>+${income.amount.toFixed(2)}</p>
            {received ? <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">Settled</span> : <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">Pending</span>}
          </div>
          {!received && <button onClick={() => onReceiveRecurringIncome(income, income.amount)} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all shadow-md active:scale-95">Confirm</button>}
        </div>
      </div>
    );
  };

  const renderBillCard = (bill: RecurringExpense, isCompact: boolean = false) => {
    const paid = isBillPaidInCycle(bill);
    const totalToPay = bill.amount + (bill.accumulatedOverdue || 0);
    const currentInput = paymentInputs[bill.id] || totalToPay.toString();
    return (
      <div key={bill.id} className={`p-6 border-2 transition-all duration-300 ${paid ? 'bg-slate-50/50 border-slate-100 opacity-70 scale-[0.98] grayscale-[0.5]' : (bill.accumulatedOverdue || 0) > 0 ? 'bg-white border-rose-100 shadow-xl shadow-rose-50/20' : 'bg-white border-slate-100 shadow-sm'} rounded-[2.5rem] group relative`}>
        {paid && <div className="absolute top-4 right-6 flex items-center gap-2 text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] border border-emerald-200 px-3 py-1.5 rounded-full bg-emerald-50 shadow-sm animate-in fade-in zoom-in"><i className="fas fa-check-circle"></i> Paid</div>}
        <div className={`flex flex-col ${isCompact ? 'lg:flex-col' : 'lg:flex-row lg:items-center'} justify-between gap-6`}>
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-all duration-500 ${paid ? 'bg-slate-200 text-slate-400' : (bill.accumulatedOverdue || 0) > 0 ? 'bg-rose-500 text-white rotate-3' : 'bg-indigo-600 text-white animate-pulse-soft'}`}><i className={`fas ${bill.externalSyncEnabled ? 'fa-plug' : 'fa-file-invoice'}`}></i></div>
            <div>
              <p className={`font-black text-base ${paid ? 'text-slate-400' : 'text-slate-800'} flex items-center gap-2`}>{bill.description}{bill.externalSyncEnabled && !paid && <button onClick={() => handleSyncLucelec(bill.id)} disabled={isSyncingPortal === bill.id} className={`text-[8px] px-2 py-1 rounded font-black uppercase transition-all ${isSyncingPortal === bill.id ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}>{isSyncingPortal === bill.id ? 'Syncing...' : 'Sync NeilV'}</button>}</p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${paid ? 'text-slate-300' : (bill.accumulatedOverdue || 0) > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{paid ? `Settled for Cycle` : `Due: the ${bill.dayOfMonth}th • $${bill.amount} Base`}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 lg:gap-8"><div className="text-right min-w-[100px]"><p className={`text-xl font-black transition-colors ${paid ? 'text-slate-300' : (bill.accumulatedOverdue || 0) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>${totalToPay.toFixed(2)}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Required</p></div><div className={`flex items-center gap-2 p-2 rounded-2xl border transition-all ${paid ? 'bg-slate-100 border-transparent' : 'bg-slate-50 border-slate-200'}`}><input type="number" step="0.01" disabled={paid} className={`w-24 px-3 py-2 border-none rounded-xl text-xs font-black outline-none transition-all ${paid ? 'bg-transparent text-slate-300' : 'bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800'}`} value={paid ? '0.00' : currentInput} onChange={(e) => setPaymentInputs(prev => ({ ...prev, [bill.id]: e.target.value }))} /><button disabled={paid} onClick={() => { const amt = parseFloat(currentInput); if (!isNaN(amt) && amt > 0) { onPayRecurring(bill, amt); setPaymentInputs(prev => { const next = {...prev}; delete next[bill.id]; return next; }); } }} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 ${paid ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-slate-900'}`}>{paid ? 'Paid' : (parseFloat(currentInput) >= totalToPay ? 'Full Pay' : 'Partial')}</button></div></div>
        </div>
      </div>
    );
  };

  const MarketTicker = ({ prices }: { prices: MarketPrice[] }) => {
    return (
      <div className="w-full bg-white/40 backdrop-blur-md border border-slate-200/60 overflow-hidden py-3 mb-8 rounded-[1.5rem] shadow-sm">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-12">
          {[...prices, ...prices].map((p, idx) => (
            <div key={idx} className="flex items-center gap-3">
               <div className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center text-[8px] font-black text-white">
                 {p.symbol.substring(0, 1)}
               </div>
               <span className="font-black text-[10px] text-slate-400 tracking-[0.2em] uppercase">{p.symbol}</span>
               <span className="font-black text-xs text-slate-800 tracking-tight">
                 ${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
               </span>
               <div className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md ${p.change24h >= 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                 <i className={`fas fa-caret-${p.change24h >= 0 ? 'up' : 'down'}`}></i>
                 {Math.abs(p.change24h).toFixed(2)}%
               </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <MarketTicker prices={marketPrices} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 md:col-span-2 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-16 opacity-[0.03] scale-150"><i className="fas fa-gem text-[140px]"></i></div>
          <div className="relative z-10">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3">Consolidated Net Worth</p>
            <h2 className="text-5xl font-black tracking-tight">${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <div className="flex items-center gap-6 mt-8">
               <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/10"><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Liquid Hub</p><p className="text-lg font-black text-emerald-400">${liquidFunds.toLocaleString()}</p></div>
               <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/10"><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Asset Value</p><p className="text-lg font-black text-indigo-400">${(portfolioFunds + cryptoFunds).toLocaleString()}</p></div>
            </div>
          </div>
        </div>
        <div className={`${safetyMargin >= 0 ? 'bg-indigo-600' : 'bg-rose-600'} p-8 rounded-[3rem] shadow-xl text-white flex flex-col justify-center transition-colors duration-500 relative overflow-hidden`}>
           <div className="absolute top-2 right-6 p-4 opacity-10"><i className="fas fa-calendar-alt text-4xl"></i></div>
           <p className="text-white text-[10px] font-black uppercase tracking-widest mb-1">Monthly Net Margin</p>
           <h3 className="text-4xl font-black mb-4">${safetyMargin.toLocaleString()}</h3>
           <div className="bg-black/10 rounded-[2rem] p-4 border border-white/10 mb-6 backdrop-blur-sm shadow-inner">
              <div className="flex justify-between items-center mb-1"><p className="text-[9px] text-white font-black uppercase tracking-widest">Safe Daily Spend</p><span className="bg-white/20 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Limit</span></div>
              <h4 className="text-2xl font-black text-white">${dailySpendLimit.toLocaleString('en-US', { maximumFractionDigits: 2 })}</h4>
              <p className="text-[9px] text-white font-bold uppercase tracking-widest mt-1">Allocated for {daysUntil25th} days until 25th</p>
           </div>
           <div className="border-t border-white/20 pt-4 mt-2"><div className="flex justify-between items-center mb-1"><p className="text-[9px] text-white font-black uppercase tracking-widest">Settlement Countdown</p><p className="text-xs font-black text-white">{daysUntil25th} Days Left</p></div><p className="text-[8px] text-white font-bold uppercase tracking-widest leading-relaxed">Stay under limit to ensure surplus at cycle end.</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10"><div><h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Spending Trends</h3><p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Interactive Cash Flow Analytics</p></div><div className="flex flex-wrap items-center gap-3"><div className="bg-slate-100 p-1 rounded-xl flex gap-1">{(['daily', 'weekly', 'monthly', 'yearly'] as Timeframe[]).map(tf => (<button key={tf} onClick={() => setTrendTimeframe(tf)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${trendTimeframe === tf ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tf}</button>))}</div></div></div>
          <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}`} /><Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }} /><Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={4} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} name="Expenditure" /></LineChart></ResponsiveContainer></div>
        </section>
        <section className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-8"><div><h3 className="font-black uppercase text-xs tracking-[0.3em] text-white/80">Active Budgets</h3><p className="text-[10px] text-white/40 font-bold uppercase mt-1 tracking-widest">Progress on Category Limits</p></div><div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10"><i className="fas fa-bullseye text-indigo-400"></i></div></div>
          <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-1">{budgetProgressItems.map(item => (<div key={item.category} className="space-y-2"><div className="flex justify-between items-end"><div><p className="text-[10px] font-black text-white/90 uppercase tracking-widest">{item.category}</p><p className="text-[9px] text-white/40 font-bold uppercase">${item.actual.toFixed(2)} spent</p></div><div className="text-right"><p className={`text-xs font-black ${item.percent >= 90 ? 'text-rose-400' : 'text-indigo-400'}`}>${(item.limit - item.actual).toFixed(2)} left</p><p className="text-[9px] text-white/40 font-bold uppercase">{item.percent.toFixed(0)}% used</p></div></div><div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5"><div className={`h-full transition-all duration-1000 ease-out ${item.percent >= 90 ? 'bg-rose-500' : item.percent >= 70 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${item.percent}%` }}></div></div></div>))}{budgetProgressItems.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-center py-10"><i className="fas fa-sliders-h text-2xl text-white/10 mb-4"></i><p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">No budgets configured</p></div>)}</div>
        </section>
      </div>

      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-10"><div><h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Financial Activity Feed</h3><p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Cash & Digital Transaction Ledger</p></div><div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Today's Flow</p><p className="text-sm font-black text-slate-900">${manualTransactions.filter(t => t.date === new Date().toISOString().split('T')[0]).reduce((acc, t) => t.type === 'expense' ? acc - t.amount : acc + t.amount, 0).toFixed(2)}</p></div></div>
        <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-2">{manualTransactions.map(t => (<div key={t.id} className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:shadow-lg hover:ring-2 hover:ring-indigo-100/50 transition-all group flex items-center justify-between"><div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg shadow-sm transition-transform group-hover:scale-110 ${t.type === 'expense' ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500'}`}><i className={`fas fa-receipt`}></i></div><div><p className="font-black text-sm text-slate-800">{t.description}</p><div className="flex items-center gap-2"><span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{t.category}</span><span className="w-1 h-1 bg-slate-300 rounded-full"></span><span className={`text-[8px] font-black uppercase tracking-widest ${t.institution === 'Cash in Hand' ? 'text-amber-500' : 'text-slate-400'}`}>{t.institution === 'Cash in Hand' ? 'Wallet' : t.institution}</span></div></div></div><div className="flex items-center gap-4"><div className="text-right"><p className={`font-black text-base ${t.type === 'expense' ? 'text-slate-900' : 'text-emerald-600'}`}>{t.type === 'expense' ? '-' : '+'}${t.amount.toFixed(2)}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.date}</p></div></div></div>))}</div>
      </section>

      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Monthly Checklist & P&L Summary</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Verify All Recurring Incomes & Monthly Bills</p>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Settlement Progress</p>
                <p className={`text-sm font-black ${settlementProgress >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                  {settlementProgress.toFixed(0)}% Cleared
                </p>
             </div>
             <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                <i className="fas fa-calendar-check"></i>
             </div>
          </div>
        </div>
        
        <div className="w-full h-2 bg-slate-100 rounded-full mb-10 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${settlementProgress}%` }}></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Incoming Cash Flow (Expected)</h4>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${cycleIncomeTotal.toLocaleString()} Total</span>
            </div>
            <div className="space-y-4">
              {cycleIncomes.map(income => renderIncomeCard(income))}
              {cycleIncomes.length === 0 && (
                <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-[2rem]">No Recurring Incomes Setup</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Monthly Bills & Commitments</h4>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${cycleBillTotal.toLocaleString()} Total</span>
            </div>
            <div className="space-y-4">
              {cycleBills.map(bill => renderBillCard(bill, true))}
              {cycleBills.length === 0 && (
                <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-[2rem]">No Recurring Bills Setup</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-10">Institutional Vaults</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(Object.entries(institutionalBalances) as [string, InstitutionalBalance][]).map(([name, data]) => (
            <div key={name} className={`p-6 bg-slate-50 border rounded-[2rem] transition-all flex flex-col gap-4 group ${data.isCash ? 'border-amber-200 ring-2 ring-amber-50' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg transition-transform group-hover:scale-110 ${data.isCash ? 'bg-amber-500 shadow-amber-200' : data.available ? 'bg-emerald-500' : 'bg-slate-800'} shadow-lg`}>
                    <i className={`fas ${data.isCash ? 'fa-wallet' : data.type === 'investment' ? 'fa-chart-pie' : data.type === 'credit_union' ? 'fa-users' : 'fa-building-columns'}`}></i>
                  </div>
                  <div>
                    <p className="font-black text-sm text-slate-800 truncate max-w-[120px]">{name}</p>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{data.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-base ${data.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>${data.balance.toLocaleString()}</p>
                  <div className="flex items-center justify-end gap-1">
                    <span className={`w-1.5 h-1.5 ${data.isCash ? 'bg-amber-400' : 'bg-emerald-400'} rounded-full animate-pulse`}></span>
                    <span className="text-[8px] font-black text-slate-400 uppercase">{data.isCash ? 'Physical' : 'Live'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
