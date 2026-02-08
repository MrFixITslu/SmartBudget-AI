
import React, { useMemo, useState } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  AreaChart, Area, XAxis, YAxis
} from 'recharts';
import { Transaction, CATEGORIES, RecurringExpense, RecurringIncome, SavingGoal, InvestmentAccount, MarketPrice, BankConnection } from '../types';

interface Props {
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  recurringIncomes: RecurringIncome[];
  savingGoals: SavingGoal[];
  investments: InvestmentAccount[];
  marketPrices: MarketPrice[];
  /* Added missing bankConnections prop */
  bankConnections: BankConnection[];
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onPayRecurring: (rec: RecurringExpense, amount: number) => void;
  onReceiveRecurringIncome: (inc: RecurringIncome, amount: number) => void;
  onContributeSaving: (goalId: string, amount: number) => void;
  onWithdrawSaving: (goalId: string, amount: number) => void;
  onAddIncome: (amount: number, description: string, notes: string) => void;
}

const Dashboard: React.FC<Props> = ({ 
  transactions, recurringExpenses, recurringIncomes, savingGoals, investments, marketPrices, bankConnections,
  onEdit, onDelete, onPayRecurring, onReceiveRecurringIncome, onContributeSaving, onWithdrawSaving, onAddIncome
}) => {
  const [trendPeriod, setTrendPeriod] = useState<'daily' | 'monthly'>('monthly');
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [incAmounts, setIncAmounts] = useState<Record<string, string>>({});

  // Time-based filters
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTransactions = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }), [transactions, currentMonth, currentYear]);

  // Financial Summaries
  const cashBalance = useMemo(() => {
    const inflow = transactions.filter(t => t.type === 'income' || t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);
    const outflow = transactions.filter(t => t.type === 'expense' || t.type === 'savings').reduce((acc, t) => acc + t.amount, 0);
    return inflow - outflow;
  }, [transactions]);

  const portfolioValue = useMemo(() => {
    return investments.reduce((acc, inv) => {
      return acc + inv.holdings.reduce((hAcc, h) => {
        const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
        return hAcc + (h.quantity * live);
      }, 0);
    }, 0);
  }, [investments, marketPrices]);

  const netWorth = cashBalance + portfolioValue;

  // Personal Portfolio Performance for Ticker
  const holdingPerformance = useMemo(() => {
    return investments.flatMap(inv => inv.holdings.map(h => {
      const live = marketPrices.find(m => m.symbol === h.symbol);
      const currentPrice = live?.price || h.purchasePrice;
      const gainLoss = (currentPrice - h.purchasePrice) * h.quantity;
      const gainLossPerc = ((currentPrice - h.purchasePrice) / h.purchasePrice) * 100;
      return {
        symbol: h.symbol,
        currentPrice,
        avgCost: h.purchasePrice,
        gainLoss,
        gainLossPerc,
        provider: inv.provider
      };
    }));
  }, [investments, marketPrices]);

  // Budget Analysis
  const monthlySpendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthTransactions.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [thisMonthTransactions]);

  const totalMonthlyExpense = useMemo(() => 
    Object.values(monthlySpendByCategory).reduce((a, b) => a + b, 0), 
    [monthlySpendByCategory]
  );

  const budgetAllocation: Record<string, number> = {
    'Food': 500,
    'Transport': 300,
    'Entertainment': 200,
    'Shopping': 400,
    'Utilities': 250,
    'Other': 300
  };

  const getNextDueDate = (day: number, lastActionDateStr?: string) => {
    const target = new Date(now.getFullYear(), now.getMonth(), day);
    if (lastActionDateStr) {
      const lastDate = new Date(lastActionDateStr);
      if (lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear()) {
        target.setMonth(target.getMonth() + 1);
      }
    }
    return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Real-time Ticker */}
      <div className="bg-slate-900 rounded-2xl p-3 flex items-center gap-6 overflow-hidden shadow-xl border border-white/5">
        <div className="flex items-center gap-2 shrink-0 border-r border-white/10 pr-4">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Portfolio</span>
        </div>
        <div className="flex gap-10 whitespace-nowrap overflow-x-auto no-scrollbar py-1">
          {holdingPerformance.length > 0 ? holdingPerformance.map((h, i) => (
            <div key={`${h.symbol}-${i}`} className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-indigo-400">{h.symbol}</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{h.provider}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-mono text-slate-100">${h.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Cost: ${h.avgCost.toFixed(2)}</span>
              </div>
              <div className={`flex flex-col items-start ${h.gainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className="text-[10px] font-black">
                  {h.gainLoss >= 0 ? '+' : ''}${Math.abs(h.gainLoss).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-tighter">
                  {h.gainLoss >= 0 ? '▲' : '▼'} {Math.abs(h.gainLossPerc).toFixed(2)}%
                </span>
              </div>
            </div>
          )) : marketPrices.map(m => (
            <div key={m.symbol} className="flex items-center gap-2">
              <span className="text-[11px] font-black text-indigo-400">{m.symbol}</span>
              <span className="text-[11px] font-mono text-slate-300">${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`text-[10px] font-bold ${m.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {m.change24h >= 0 ? '▲' : '▼'} {Math.abs(m.change24h).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 opacity-5 group-hover:opacity-10 transition-opacity">
            <i className="fas fa-wallet text-6xl"></i>
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.15em] mb-1">Liquid Cash</p>
          <p className={`text-3xl font-black ${cashBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-indigo-600 p-7 rounded-[2rem] shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-5 opacity-10">
            <i className="fas fa-rocket text-6xl"></i>
          </div>
          <p className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.15em] mb-1">Portfolios Value</p>
          <p className="text-3xl font-black">
            ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 flex gap-2">
            {investments.map(i => (
              <span key={i.id} className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                {i.provider} Active
              </span>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-7 rounded-[2rem] shadow-2xl text-white relative overflow-hidden group">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] mb-1">Net Worth</p>
          <p className="text-3xl font-black">
            ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] font-bold text-emerald-400 mt-2 uppercase">
            <i className="fas fa-chart-line mr-1"></i> Tracking Live
          </p>
        </div>
      </div>

      {/* Monthly Budget Performance Tracking */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Budget Performance</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Monthly Spending Control</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-slate-400 uppercase">Total Spent</p>
            <p className="text-xl font-black text-slate-900">${totalMonthlyExpense.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {Object.entries(budgetAllocation).map(([cat, limit]) => {
            const spent = monthlySpendByCategory[cat] || 0;
            const percentage = Math.min(100, (spent / limit) * 100);
            const isOver = spent > limit;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-700">{cat}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className={isOver ? 'text-rose-600' : 'text-slate-600'}>${spent.toFixed(0)}</span> / ${limit}
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-1000 ${isOver ? 'bg-rose-500' : percentage > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cashflow Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-6">Upcoming Income</h3>
          <div className="space-y-4">
            {recurringIncomes.map(inc => (
              <div key={inc.id} className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/50 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                      <i className="fas fa-hand-holding-usd"></i>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-800">{inc.description}</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase">
                        Due: {getNextDueDate(inc.dayOfMonth, inc.lastConfirmedDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-600">${inc.amount.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    step="0.01"
                    className="flex-1 px-3 py-2 bg-white border border-emerald-100 rounded-xl text-xs font-black text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Amount received..."
                    value={incAmounts[inc.id] || inc.amount.toString()}
                    onChange={(e) => setIncAmounts(prev => ({ ...prev, [inc.id]: e.target.value }))}
                  />
                  <button 
                    onClick={() => {
                      const amount = parseFloat(incAmounts[inc.id] || inc.amount.toString());
                      onReceiveRecurringIncome(inc, amount);
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-100"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ))}
            {recurringIncomes.length === 0 && (
              <p className="text-center py-8 text-slate-300 font-bold uppercase text-[10px] tracking-widest">No Recurring Income</p>
            )}
          </div>
        </section>

        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-6">Upcoming Bills</h3>
          <div className="space-y-4">
            {recurringExpenses.map(rec => (
              <div key={rec.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                      <i className="fas fa-file-invoice-dollar"></i>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-800">{rec.description}</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase">
                        Due: {getNextDueDate(rec.dayOfMonth, rec.lastBilledDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-800">${rec.balance.toFixed(2)}</p>
                    {rec.balance !== rec.amount && (
                      <p className="text-[8px] text-slate-400 uppercase font-black">of ${rec.amount}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    step="0.01"
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Payment amount..."
                    value={payAmounts[rec.id] || rec.balance.toString()}
                    onChange={(e) => setPayAmounts(prev => ({ ...prev, [rec.id]: e.target.value }))}
                  />
                  <button 
                    onClick={() => {
                      const amount = parseFloat(payAmounts[rec.id] || rec.balance.toString());
                      onPayRecurring(rec, amount);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                  >
                    Pay
                  </button>
                </div>
              </div>
            ))}
            {recurringExpenses.length === 0 && (
              <p className="text-center py-8 text-slate-300 font-bold uppercase text-[10px] tracking-widest">No Bills Tracked</p>
            )}
          </div>
        </section>
      </div>

      {/* Flow Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Flow Trends</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['daily', 'monthly'].map(p => (
                <button 
                  key={p} 
                  onClick={() => setTrendPeriod(p as any)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition ${trendPeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={transactions.slice(-12).map(t => ({ name: t.date.slice(5), amount: t.amount }))}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl">
          <h3 className="font-black uppercase text-xs tracking-[0.2em] mb-8 text-center">Net Worth Spread</h3>
          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Liquid', value: Math.max(0, cashBalance) },
                    { name: 'Crypto/Stocks', value: portfolioValue }
                  ]}
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={8}
                  dataKey="value"
                >
                  <Cell fill="#6366f1" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[9px] text-slate-400 font-black uppercase">Asset Mix</p>
              <p className="text-lg font-black">{netWorth > 0 ? ((portfolioValue / netWorth) * 100).toFixed(0) : 0}%</p>
            </div>
          </div>
          <div className="space-y-4 mt-6">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cash Reserve</span>
                </div>
                <span className="text-[11px] font-black">${cashBalance.toLocaleString()}</span>
             </div>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Risk Assets</span>
                </div>
                <span className="text-[11px] font-black">${portfolioValue.toLocaleString()}</span>
             </div>
          </div>
        </section>
      </div>

      {/* Savings Progress */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-6">Savings Goals Progress</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {savingGoals.map(goal => {
            const perc = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
            return (
              <div key={goal.id} className="group">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700">{goal.name}</span>
                  <span className="text-xs font-black text-indigo-600">${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${perc}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
        {savingGoals.length === 0 && (
          <p className="text-center py-8 text-slate-300 font-bold uppercase text-[10px] tracking-widest">No Active Savings Goals</p>
        )}
      </section>

      {/* Ledger */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-8">Financial Ledger</h3>
        <div className="space-y-4">
          {transactions.slice(0, 10).map(t => (
            <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-white hover:ring-2 hover:ring-indigo-100 transition shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${t.type === 'income' ? 'bg-emerald-500 shadow-emerald-100 shadow-lg' : 'bg-rose-500 shadow-rose-100 shadow-lg'}`}>
                  <i className={`fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                </div>
                <div>
                  <p className="font-black text-xs text-slate-800">{t.description}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">{t.category} • {t.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className={`font-black text-xs ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                </p>
                <div className="flex opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => onDelete(t.id)} className="w-8 h-8 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 flex items-center justify-center">
                    <i className="fas fa-trash-alt text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center py-12">
               <i className="fas fa-receipt text-4xl text-slate-100 mb-4"></i>
               <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No entries yet</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
