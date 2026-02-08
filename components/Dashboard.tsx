
import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Transaction, RecurringExpense, RecurringIncome, SavingGoal, InvestmentAccount, MarketPrice, BankConnection, CATEGORIES } from '../types';
import { syncLucelecPortal } from '../services/bankApiService';

interface InstitutionalBalance {
  balance: number;
  type: string;
  available: boolean;
  holdings?: any[];
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
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onPayRecurring: (rec: RecurringExpense, amount: number) => void;
  onReceiveRecurringIncome: (inc: RecurringIncome, amount: number) => void;
  onContributeSaving: (goalId: string, amount: number) => void;
  onWithdrawSaving: (goalId: string, amount: number) => void;
  onWithdrawal: (institution: string, amount: number) => void;
  onAddIncome: (amount: number, description: string, notes: string) => void;
}

const Dashboard: React.FC<Props> = ({ 
  transactions, investments, marketPrices, bankConnections, recurringExpenses, recurringIncomes, savingGoals, targetMargin, onWithdrawal, onDelete, onPayRecurring, onReceiveRecurringIncome
}) => {
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [isSyncingPortal, setIsSyncingPortal] = useState<string | null>(null);

  const institutionalBalances = useMemo<Record<string, InstitutionalBalance>>(() => {
    const balances: Record<string, InstitutionalBalance> = {};
    bankConnections.forEach(conn => {
      const history = transactions.filter(t => t.institution === conn.institution);
      const flow = history.reduce((acc, t) => (t.type === 'income' || t.type === 'withdrawal') ? acc + t.amount : acc - t.amount, 0);
      balances[conn.institution] = { 
        balance: conn.openingBalance + flow, 
        type: conn.institutionType, 
        available: conn.institution.includes('1st National') 
      };
    });
    investments.forEach(inv => {
      const liveVal = inv.holdings.reduce((hAcc, h) => {
        const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
        return hAcc + (h.quantity * live);
      }, 0);
      const withdrawFlow = transactions.filter(t => t.institution === inv.provider && t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);
      balances[inv.provider] = { 
        balance: liveVal - withdrawFlow, 
        type: 'investment', 
        available: false, 
        holdings: inv.holdings 
      };
    });
    return balances;
  }, [bankConnections, investments, transactions, marketPrices]);

  const liquidFunds = useMemo(() => (institutionalBalances['1st National Bank St. Lucia'] as InstitutionalBalance | undefined)?.balance || 0, [institutionalBalances]);
  const portfolioFunds = useMemo(() => (Object.values(institutionalBalances) as InstitutionalBalance[]).filter(b => b.type === 'investment').reduce((acc, b) => acc + b.balance, 0), [institutionalBalances]);
  const cryptoFunds = useMemo(() => (institutionalBalances['Binance'] as InstitutionalBalance | undefined)?.balance || 0, [institutionalBalances]);
  const netWorth: number = (Object.values(institutionalBalances) as InstitutionalBalance[]).reduce((acc: number, b) => acc + b.balance, 0);

  const totalMonthlyRecurringExpenses = useMemo(() => 
    recurringExpenses.reduce((acc, curr) => acc + curr.amount, 0), 
    [recurringExpenses]
  );
  const totalOverdue = useMemo(() => 
    recurringExpenses.reduce((acc, curr) => acc + curr.accumulatedOverdue, 0), 
    [recurringExpenses]
  );
  const totalMonthlyRecurringIncome = useMemo(() => 
    recurringIncomes.reduce((acc, curr) => acc + curr.amount, 0), 
    [recurringIncomes]
  );
  const safetyMargin = totalMonthlyRecurringIncome - totalMonthlyRecurringExpenses - totalOverdue;
  const marginProgress = targetMargin > 0 ? Math.min(100, (safetyMargin / targetMargin) * 100) : 0;

  // Ledger for one-off transactions (non-recurring)
  const manualTransactions = useMemo(() => 
    transactions.filter(t => !t.recurringId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions]
  );

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food': return 'fa-utensils';
      case 'transport': return 'fa-car';
      case 'housing': return 'fa-home';
      case 'entertainment': return 'fa-clapperboard';
      case 'utilities': return 'fa-bolt';
      case 'health': return 'fa-heartbeat';
      case 'shopping': return 'fa-bag-shopping';
      case 'education': return 'fa-graduation-cap';
      case 'income': return 'fa-money-bill-wave';
      case 'savings': return 'fa-piggy-bank';
      case 'investments': return 'fa-chart-line';
      default: return 'fa-receipt';
    }
  };

  // Monthly Spend Report - Average per Category
  const categorySpendData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const totals: Record<string, number> = {};
    const monthCounts: Record<string, Set<string>> = {};

    expenses.forEach(t => {
      const month = t.date.substring(0, 7); // YYYY-MM
      totals[t.category] = (totals[t.category] || 0) + t.amount;
      if (!monthCounts[t.category]) monthCounts[t.category] = new Set();
      monthCounts[t.category].add(month);
    });

    return CATEGORIES
      .map(cat => ({
        name: cat,
        average: totals[cat] ? totals[cat] / monthCounts[cat].size : 0
      }))
      .filter(d => d.average > 0)
      .sort((a, b) => b.average - a.average);
  }, [transactions]);

  // 12-Month Projection Logic (Savings & Spend)
  const projectionData = useMemo(() => {
    const data = [];
    const monthlyNet = totalMonthlyRecurringIncome - totalMonthlyRecurringExpenses;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();

    let runningSavings = liquidFunds;

    for (let i = 0; i < 12; i++) {
      const monthLabel = months[(currentMonthIdx + i) % 12];
      data.push({
        name: monthLabel,
        ProjectedSavings: Math.round(runningSavings),
        MonthlySpend: Math.round(totalMonthlyRecurringExpenses)
      });
      runningSavings += monthlyNet;
    }
    return data;
  }, [liquidFunds, totalMonthlyRecurringIncome, totalMonthlyRecurringExpenses]);

  // 25th Cycle Priority logic
  const cycleBills = useMemo(() => {
    return recurringExpenses.filter(bill => bill.dayOfMonth >= 25 || bill.accumulatedOverdue > 0);
  }, [recurringExpenses]);

  const cycleIncomes = useMemo(() => {
    return recurringIncomes.filter(income => income.dayOfMonth >= 25);
  }, [recurringIncomes]);

  const cycleBillTotal = useMemo(() => 
    cycleBills.reduce((acc, b) => acc + b.amount + b.accumulatedOverdue, 0), 
    [cycleBills]
  );

  const cycleIncomeTotal = useMemo(() => 
    cycleIncomes.reduce((acc, i) => acc + i.amount, 0), 
    [cycleIncomes]
  );

  const isBillPaidInCycle = (bill: RecurringExpense) => {
    const now = new Date();
    const dueDate = new Date(bill.nextDueDate);
    return dueDate > now && bill.accumulatedOverdue === 0;
  };

  const isIncomeReceivedInCycle = (income: RecurringIncome) => {
    const now = new Date();
    const confirmDate = new Date(income.nextConfirmationDate);
    return confirmDate > now;
  };

  const handleSyncLucelec = async (id: string) => {
    setIsSyncingPortal(id);
    await syncLucelecPortal();
    setIsSyncingPortal(null);
  };

  const renderIncomeCard = (income: RecurringIncome) => {
    const received = isIncomeReceivedInCycle(income);
    
    return (
      <div key={income.id} className={`p-5 border-2 rounded-[2rem] transition-all ${received ? 'bg-emerald-50/30 border-emerald-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'} flex items-center justify-between group`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${received ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500 text-white shadow-lg'}`}>
            <i className="fas fa-hand-holding-dollar"></i>
          </div>
          <div>
            <p className={`font-black text-sm ${received ? 'text-slate-400' : 'text-slate-800'}`}>{income.description}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {received ? `Expected next: ${income.nextConfirmationDate}` : `Expected on the ${income.dayOfMonth}th`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className={`font-black text-base ${received ? 'text-slate-300' : 'text-emerald-600'}`}>+${income.amount.toFixed(2)}</p>
            {received && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">Settled</span>}
          </div>
          {!received && (
            <button 
              onClick={() => onReceiveRecurringIncome(income, income.amount)}
              className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all shadow-md active:scale-95"
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderBillCard = (bill: RecurringExpense, isCompact: boolean = false) => {
    const paid = isBillPaidInCycle(bill);
    const totalToPay = bill.amount + bill.accumulatedOverdue;
    const currentInput = paymentInputs[bill.id] || totalToPay.toString();
    const syncing = isSyncingPortal === bill.id;

    return (
      <div 
        key={bill.id} 
        className={`p-6 border-2 transition-all duration-300 ${
          paid 
            ? 'bg-slate-50/50 border-slate-100 opacity-70 grayscale-[0.5]' 
            : bill.accumulatedOverdue > 0 
              ? 'bg-white border-rose-100 shadow-xl shadow-rose-50/20' 
              : 'bg-white border-slate-100 shadow-sm'
        } rounded-[2.5rem] group relative`}
      >
        {paid && (
          <div className="absolute top-4 right-6 flex items-center gap-2 text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] border border-emerald-200 px-3 py-1.5 rounded-full bg-emerald-50 shadow-sm animate-in fade-in zoom-in">
            <i className="fas fa-check-circle"></i> Settled
          </div>
        )}
        
        <div className={`flex flex-col ${isCompact ? 'lg:flex-col' : 'lg:flex-row lg:items-center'} justify-between gap-6`}>
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-all duration-500 ${
              paid 
                ? 'bg-slate-200 text-slate-400' 
                : bill.accumulatedOverdue > 0 
                  ? 'bg-rose-500 text-white rotate-3' 
                  : 'bg-indigo-600 text-white'
            }`}>
              <i className={`fas ${bill.externalSyncEnabled ? 'fa-plug' : 'fa-file-invoice'}`}></i>
            </div>
            <div>
              <p className={`font-black text-base ${paid ? 'text-slate-400' : 'text-slate-800'} flex items-center gap-2`}>
                {bill.description}
                {bill.externalSyncEnabled && !paid && (
                  <button 
                    onClick={() => handleSyncLucelec(bill.id)}
                    disabled={syncing}
                    className={`text-[8px] px-2 py-1 rounded font-black uppercase transition-all ${syncing ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}
                  >
                    {syncing ? 'Syncing...' : 'Sync NeilV'}
                  </button>
                )}
              </p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${paid ? 'text-slate-300' : bill.accumulatedOverdue > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                {paid ? `Next: ${bill.nextDueDate}` : `Due: the ${bill.dayOfMonth}th • $${bill.amount} Base`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:gap-8">
            <div className="text-right min-w-[100px]">
               <p className={`text-xl font-black transition-colors ${paid ? 'text-slate-300' : bill.accumulatedOverdue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  ${totalToPay.toFixed(2)}
               </p>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Required</p>
            </div>

            <div className={`flex items-center gap-2 p-2 rounded-2xl border transition-all ${paid ? 'bg-slate-100 border-transparent' : 'bg-slate-50 border-slate-200'}`}>
               <input 
                 type="number" 
                 step="0.01"
                 disabled={paid}
                 className={`w-24 px-3 py-2 border-none rounded-xl text-xs font-black outline-none transition-all ${paid ? 'bg-transparent text-slate-300' : 'bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800'}`}
                 value={paid ? '0.00' : currentInput}
                 onChange={(e) => setPaymentInputs(prev => ({ ...prev, [bill.id]: e.target.value }))}
               />
               <button 
                 disabled={paid}
                 onClick={() => {
                   const amt = parseFloat(currentInput);
                   if (!isNaN(amt) && amt > 0) {
                      onPayRecurring(bill, amt);
                      setPaymentInputs(prev => {
                         const next = {...prev};
                         delete next[bill.id];
                         return next;
                      });
                   }
                 }}
                 className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 ${
                   paid 
                     ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                     : 'bg-indigo-600 text-white hover:bg-slate-900'
                 }`}
               >
                 {paid ? 'Paid' : (parseFloat(currentInput) >= totalToPay ? 'Full Pay' : 'Partial')}
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 md:col-span-2 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-16 opacity-[0.03] scale-150">
             <i className="fas fa-gem text-[140px]"></i>
          </div>
          <div className="relative z-10">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3">Consolidated Net Worth</p>
            <h2 className="text-5xl font-black tracking-tight">${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <div className="flex items-center gap-6 mt-8">
               <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/10">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Liquid Hub</p>
                  <p className="text-lg font-black text-emerald-400">${liquidFunds.toLocaleString()}</p>
               </div>
               <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/10">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Asset Value</p>
                  <p className="text-lg font-black text-indigo-400">${(portfolioFunds + cryptoFunds).toLocaleString()}</p>
               </div>
            </div>
          </div>
        </div>

        <div className={`${safetyMargin >= 0 ? 'bg-indigo-600' : 'bg-rose-600'} p-8 rounded-[3rem] shadow-xl text-white flex flex-col justify-center transition-colors duration-500 relative overflow-hidden`}>
           <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Monthly Net Margin</p>
           <h3 className="text-4xl font-black mb-2">${safetyMargin.toLocaleString()}</h3>
           
           {targetMargin > 0 && (
             <div className="mb-4">
                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest mb-1">
                  <span className="text-white/40">Goal: ${targetMargin.toLocaleString()}</span>
                  <span className={marginProgress >= 100 ? 'text-emerald-400' : 'text-white/60'}>
                    {marginProgress.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${marginProgress >= 100 ? 'bg-emerald-400' : 'bg-white/80'}`}
                    style={{ width: `${marginProgress}%` }}
                  ></div>
                </div>
             </div>
           )}

           <div className="border-t border-white/20 pt-4 mt-2">
              <div className="flex justify-between items-center mb-1">
                 <p className="text-[9px] text-white/50 font-black uppercase tracking-widest">Recurring Commitment</p>
                 <p className="text-xs font-black text-white">${totalMonthlyRecurringExpenses.toLocaleString()}</p>
              </div>
              <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                {safetyMargin >= 0 ? 'Surplus Available' : 'Critical Deficit'}
              </p>
           </div>
        </div>
      </div>

      {/* Financial Activity Feed (Non-Recurring) */}
      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-10">
           <div>
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Financial Activity Feed</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">One-Off Spend & Income Ledger</p>
           </div>
           <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Today's Flow</p>
              <p className="text-sm font-black text-slate-900">
                ${manualTransactions.filter(t => t.date === new Date().toISOString().split('T')[0]).reduce((acc, t) => t.type === 'expense' ? acc - t.amount : acc + t.amount, 0).toFixed(2)}
              </p>
           </div>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-2">
           {manualTransactions.map(t => (
              <div key={t.id} className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:shadow-lg hover:ring-2 hover:ring-indigo-100/50 transition-all group flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg shadow-sm transition-transform group-hover:scale-110 ${t.type === 'expense' ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500'}`}>
                       <i className={`fas ${getCategoryIcon(t.category)}`}></i>
                    </div>
                    <div>
                       <p className="font-black text-sm text-slate-800">{t.description}</p>
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{t.category}</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.date}</span>
                       </div>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className={`font-black text-base ${t.type === 'expense' ? 'text-slate-900' : 'text-emerald-600'}`}>
                       {t.type === 'expense' ? '-' : '+'}${t.amount.toFixed(2)}
                    </p>
                    {t.vendor && <p className="text-[8px] font-black text-slate-300 uppercase truncate max-w-[80px]">{t.vendor}</p>}
                 </div>
              </div>
           ))}
           {manualTransactions.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                 <i className="fas fa-ghost text-4xl text-slate-100 mb-4"></i>
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Activity feed is currently silent</p>
              </div>
           )}
        </div>
      </section>

      {/* Fiscal Projections Section */}
      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Savings & Spend Outlook (12m)</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Projected Liquidity vs Fixed Burn Rate</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Projected Savings</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-slate-300 rounded-full"></span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Monthly Spend</span>
            </div>
          </div>
        </div>
        
        <div className="h-[280px] w-full relative">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '20px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="ProjectedSavings" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorSave)" 
                animationDuration={1500}
              />
              <Area 
                type="stepAfter" 
                dataKey="MonthlySpend" 
                stroke="#cbd5e1" 
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Savings Goal Progress */}
      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-10">Vault Progress (Linked Savings)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {savingGoals.map(goal => {
            const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
            return (
              <div key={goal.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-end">
                  <div>
                    <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                      <i className={`fas ${goal.name.toLowerCase().includes('vacation') ? 'fa-plane' : 'fa-piggy-bank'} text-indigo-500`}></i>
                      {goal.name}
                    </h4>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{goal.institution}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-base text-indigo-600">${goal.currentAmount.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">of ${goal.targetAmount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'} shadow-lg`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <span>{progress.toFixed(1)}% Complete</span>
                  {progress >= 100 && <span className="text-emerald-500"><i className="fas fa-star mr-1"></i> Goal Achieved</span>}
                </div>
              </div>
            );
          })}
          {savingGoals.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-300 uppercase font-black text-[10px] tracking-widest">
               No savings goals configured in settings
            </div>
          )}
        </div>
      </section>

      {/* Monthly Spend Report - Average per Category */}
      <section className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white overflow-hidden">
         <div className="flex items-center justify-between mb-8">
            <div>
               <h3 className="font-black uppercase text-xs tracking-[0.3em] text-white/80">Monthly Category Analysis</h3>
               <p className="text-[10px] text-white/40 font-bold uppercase mt-1 tracking-widest">Average Spend Distribution by Label</p>
            </div>
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
               <i className="fas fa-chart-bar text-indigo-400"></i>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="h-[300px] relative">
               <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart layout="vertical" data={categorySpendData} margin={{ left: 20, right: 30 }}>
                     <XAxis type="number" hide />
                     <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                        width={80}
                     />
                     <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ borderRadius: '15px', background: '#0f172a', border: '1px solid #1e293b', color: '#fff' }}
                     />
                     <Bar dataKey="average" radius={[0, 10, 10, 0]} barSize={20}>
                        {categorySpendData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : index === 1 ? '#6366f1' : '#818cf8'} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
               {categorySpendData.map((data, idx) => (
                  <div key={data.name} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group hover:bg-white/10 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="text-white/40 font-black text-[10px] w-4">{idx + 1}</div>
                        <p className="font-black text-xs text-white/90 uppercase tracking-widest">{data.name}</p>
                     </div>
                     <div className="text-right">
                        <p className="font-black text-xs text-indigo-400">${data.average.toFixed(2)}</p>
                        <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Monthly Avg</p>
                     </div>
                  </div>
               ))}
               {categorySpendData.length === 0 && (
                  <p className="text-center py-20 text-white/20 font-black uppercase text-[10px] tracking-widest">No spend history available</p>
               )}
            </div>
         </div>
      </section>

      {/* 25th Cycle Center - Incomes & Obligations */}
      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">25th Cycle Settlement Center</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Verify End-of-Month Incomes & Bills</p>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cycle Net</p>
                <p className={`text-sm font-black ${(cycleIncomeTotal - cycleBillTotal) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ${(cycleIncomeTotal - cycleBillTotal).toLocaleString()}
                </p>
             </div>
             <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                <i className="fas fa-calendar-check"></i>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Expected Incomes Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Incoming Cash Flow</h4>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${cycleIncomeTotal.toLocaleString()} Expected</span>
            </div>
            <div className="space-y-4">
              {cycleIncomes.map(income => renderIncomeCard(income))}
              {cycleIncomes.length === 0 && (
                <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[2rem]">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No 25th cycle incomes</p>
                </div>
              )}
            </div>
          </div>

          {/* Pending Bills Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Cycle Obligations</h4>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${cycleBillTotal.toLocaleString()} Total Due</span>
            </div>
            <div className="space-y-4">
              {cycleBills.map(bill => renderBillCard(bill, true))}
              {cycleBills.length === 0 && (
                <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[2rem]">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Obligations cleared</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* All Scheduled Expenses */}
      <section className="bg-slate-50 p-10 rounded-[3rem] border border-slate-200 shadow-inner">
         <div className="flex items-center justify-between mb-8">
            <div>
               <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Full Monthly Ledger</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Manage All Recurring Commitments</p>
            </div>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recurringExpenses.map(bill => renderBillCard(bill, true))}
         </div>
      </section>

      {/* Institutional Vaults */}
      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-10">Institutional Vaults</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(Object.entries(institutionalBalances) as [string, InstitutionalBalance][]).map(([name, data]) => (
            <div key={name} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:ring-2 hover:ring-indigo-100/50 transition-all flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg transition-transform group-hover:scale-110 ${data.available ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                  <i className={`fas ${data.type === 'investment' ? 'fa-chart-pie' : data.type === 'credit_union' ? 'fa-users' : 'fa-building-columns'}`}></i>
                </div>
                <div>
                  <p className="font-black text-sm text-slate-800 truncate max-w-[120px]">{name}</p>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{data.type.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-base text-slate-900">${data.balance.toLocaleString()}</p>
                <div className="flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  <span className="text-[8px] font-black text-slate-400 uppercase">Live</span>
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
