
import React, { useMemo, useState } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Transaction, CATEGORIES, RecurringExpense, SavingGoal } from '../types';

interface Props {
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  savingGoals: SavingGoal[];
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onPayRecurring: (rec: RecurringExpense, amount: number) => void;
  onContributeSaving: (goalId: string, amount: number) => void;
  onWithdrawSaving: (goalId: string, amount: number) => void;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#d946ef', '#14b8a6', '#f97316'];

const Dashboard: React.FC<Props> = ({ 
  transactions, 
  recurringExpenses, 
  savingGoals, 
  onEdit, 
  onDelete, 
  onPayRecurring,
  onContributeSaving,
  onWithdrawSaving
}) => {
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [saveAmounts, setSaveAmounts] = useState<Record<string, string>>({});
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});
  const now = new Date();
  
  // Pay day is the 25th of every month
  let cycleEnd = new Date(now.getFullYear(), now.getMonth(), 25);
  if (now.getDate() >= 25) {
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
  }

  const daysRemaining = Math.max(1, Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const expenses = transactions.filter(t => t.type === 'expense');
  const savings = transactions.filter(t => t.type === 'savings');
  const income = transactions.filter(t => t.type === 'income');
  const withdrawals = transactions.filter(t => t.type === 'withdrawal');

  const totalInflow = income.reduce((acc, t) => acc + t.amount, 0) + withdrawals.reduce((acc, t) => acc + t.amount, 0);
  const totalOutflow = expenses.reduce((acc, t) => acc + t.amount, 0) + savings.reduce((acc, t) => acc + t.amount, 0);
  const balance = totalInflow - totalOutflow;

  // Daily spending limit = total available divided by total days left before next pay day
  const dailyAllowance = Math.max(0, balance / daysRemaining);

  const cycleStart = new Date(cycleEnd);
  cycleStart.setMonth(cycleStart.getMonth() - 1);

  const cycleIncome = transactions
    .filter(t => (t.type === 'income' || t.type === 'withdrawal') && new Date(t.date) >= cycleStart)
    .reduce((acc, t) => acc + t.amount, 0);

  const cycleSpending = transactions
    .filter(t => (t.type === 'expense' || t.type === 'savings') && new Date(t.date) >= cycleStart)
    .reduce((acc, t) => acc + t.amount, 0);

  // Monthly Spending Trends
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      
      const monthlyTotal = transactions.filter(t => {
        const tDate = new Date(t.date);
        return (t.type === 'expense' || t.type === 'savings') && 
               tDate.getMonth() === d.getMonth() && 
               tDate.getFullYear() === d.getFullYear();
      }).reduce((acc, t) => acc + t.amount, 0);
      
      months.push({ name: monthLabel, amount: Math.round(monthlyTotal) });
    }
    return months;
  }, [transactions]);

  // Category Analysis
  const categoryStats = useMemo(() => {
    return CATEGORIES.map(cat => {
      const catExpenses = transactions.filter(t => t.category === cat && (t.type === 'expense' || t.type === 'savings'));
      const currentMonthTotal = catExpenses
        .filter(t => new Date(t.date) >= cycleStart)
        .reduce((acc, t) => acc + t.amount, 0);
      
      const uniqueMonths = new Set(catExpenses.map(t => {
        const d = new Date(t.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })).size || 1;
      
      const average = catExpenses.reduce((acc, t) => acc + t.amount, 0) / uniqueMonths;
      
      return { 
        name: cat, 
        current: currentMonthTotal, 
        average: Math.round(average),
        diff: currentMonthTotal - average
      };
    }).filter(d => d.current > 0 || d.average > 0);
  }, [transactions, cycleStart]);

  const pieChartData = categoryStats
    .filter(d => d.current > 0)
    .map(d => ({ name: d.name, value: d.current }));

  const handleQuickPay = (rec: RecurringExpense) => {
    const rawValue = payAmounts[rec.id];
    // Default to full balance if input is empty or undefined
    const amount = (rawValue === undefined || rawValue === '') ? rec.balance : parseFloat(rawValue);
    
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    onPayRecurring(rec, amount);
    setPayAmounts(prev => {
      const next = { ...prev };
      delete next[rec.id];
      return next;
    });
  };

  const handleQuickSave = (goal: SavingGoal) => {
    const amount = parseFloat(saveAmounts[goal.id]) || 0;
    if (amount <= 0) return;
    onContributeSaving(goal.id, amount);
    setSaveAmounts(prev => ({ ...prev, [goal.id]: '' }));
  };

  const handleQuickWithdraw = (goal: SavingGoal) => {
    const amount = parseFloat(withdrawAmounts[goal.id]) || 0;
    if (amount <= 0) return;
    onWithdrawSaving(goal.id, amount);
    setWithdrawAmounts(prev => ({ ...prev, [goal.id]: '' }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">All-time Balance</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-100 text-white">
          <div className="flex justify-between items-start">
            <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Daily Spending Limit</p>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase">{daysRemaining}d left</span>
          </div>
          <p className="text-3xl font-black mt-1">
            ${dailyAllowance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-indigo-200 mt-2 font-medium">Safe to spend per day until pay day.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Cycle Income</p>
          <p className="text-2xl font-bold text-slate-800">
            ${cycleIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Cycle Outgoings</p>
          <p className="text-2xl font-bold text-slate-800">
            ${cycleSpending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Saving Goals Section */}
      <section className="bg-emerald-900 p-8 rounded-[2.5rem] shadow-2xl text-white">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2">
              <i className="fas fa-piggy-bank text-emerald-400"></i>
              Savings Progress
            </h3>
            <p className="text-emerald-300/60 text-xs mt-1 font-medium">Move money from your budget to these goals.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-emerald-300/60 font-bold uppercase tracking-widest">Total Saved</p>
            <p className="text-2xl font-black text-emerald-400">
              ${savingGoals.reduce((acc, g) => acc + g.currentAmount, 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {savingGoals.map(goal => {
            const percent = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
            return (
              <div key={goal.id} className="p-5 bg-emerald-800/40 rounded-3xl border border-emerald-700/50 backdrop-blur-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-emerald-50 text-lg">{goal.name}</h4>
                    <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">{goal.category}</p>
                  </div>
                  <span className="text-xs font-black bg-emerald-500/30 text-emerald-200 px-2 py-1 rounded-lg">
                    {percent.toFixed(0)}%
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-emerald-300 uppercase mb-2">
                      <span>${goal.currentAmount.toLocaleString()} saved</span>
                      <span>Target: ${goal.targetAmount.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-emerald-900/50 rounded-full overflow-hidden border border-emerald-700/30">
                      <div 
                        className="h-full bg-emerald-400 transition-all duration-1000 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Deposit..."
                        className="flex-1 bg-emerald-900/60 border border-emerald-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
                        value={saveAmounts[goal.id] || ''}
                        onChange={e => setSaveAmounts(prev => ({ ...prev, [goal.id]: e.target.value }))}
                      />
                      <button 
                        onClick={() => handleQuickSave(goal)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-900/40"
                      >
                        Save
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Withdraw..."
                        className="flex-1 bg-emerald-900/40 border border-emerald-700/50 rounded-xl px-3 py-2 text-sm text-emerald-200 outline-none focus:ring-2 focus:ring-rose-500"
                        value={withdrawAmounts[goal.id] || ''}
                        onChange={e => setWithdrawAmounts(prev => ({ ...prev, [goal.id]: e.target.value }))}
                      />
                      <button 
                        onClick={() => handleQuickWithdraw(goal)}
                        className="bg-transparent hover:bg-emerald-800 text-emerald-400 text-xs font-bold px-4 py-2 rounded-xl border border-emerald-700 transition"
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {savingGoals.length === 0 && (
            <div className="col-span-full py-10 text-center border-2 border-dashed border-emerald-800 rounded-3xl bg-emerald-900/20">
              <i className="fas fa-bullseye text-emerald-800 text-4xl mb-3"></i>
              <p className="text-emerald-700 font-bold uppercase text-xs tracking-widest">No saving goals set up yet</p>
            </div>
          )}
        </div>
      </section>

      {/* Monthly Trends & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Monthly Trends</h3>
            <span className="text-xs text-slate-400 font-medium">Last 6 Months (Outgoings)</span>
          </div>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAmt)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[350px]">
          <h3 className="font-bold text-slate-800 mb-4">Expense Mix</h3>
          {pieChartData.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="h-[200px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {pieChartData.slice(0, 6).map((d, i) => (
                  <div key={d.name} className="flex items-center text-[10px] text-slate-600 font-bold">
                    <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                    <span className="truncate uppercase tracking-tighter">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 italic text-xs">No transactions.</div>
          )}
        </div>
      </div>

      {/* Recurring Bills */}
      <section className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2">
              <i className="fas fa-calendar-alt text-indigo-400"></i>
              Active Monthly Bills
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Due</p>
            <p className="text-2xl font-black text-rose-400">
              ${recurringExpenses.reduce((acc, r) => acc + r.balance, 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurringExpenses.map(rec => {
            const isFullyPaid = rec.balance <= 0;
            const isOverdue = !isFullyPaid && now.getDate() > rec.dayOfMonth;
            const amountVal = payAmounts[rec.id] !== undefined ? payAmounts[rec.id] : rec.balance.toFixed(2);
            
            return (
              <div key={rec.id} className={`p-5 rounded-3xl border transition-all duration-300 ${isFullyPaid ? 'bg-slate-800/50 border-slate-700/50 opacity-60' : 'bg-slate-800 border-indigo-900/50 shadow-lg'}`}>
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-slate-100">{rec.description}</h4>
                  {isFullyPaid ? (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg uppercase">Paid</span>
                  ) : (
                    <span className={`px-2 py-1 ${isOverdue ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'} text-[10px] font-black rounded-lg uppercase`}>
                      Day {rec.dayOfMonth}
                    </span>
                  )}
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Due Now</p>
                    <p className="text-xl font-black text-white">${rec.balance.toFixed(2)}</p>
                  </div>
                  {!isFullyPaid && (
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Amt"
                        className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        value={amountVal}
                        onChange={e => setPayAmounts(prev => ({ ...prev, [rec.id]: e.target.value }))}
                      />
                      <button 
                        onClick={() => handleQuickPay(rec)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
                      >
                        Pay
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Activity List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-widest">Recent Activity</h3>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {transactions.slice(0, 20).map((t) => (
            <div key={t.id} className="group flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-white hover:ring-2 hover:ring-indigo-100 transition relative">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${t.type === 'income' ? 'bg-emerald-500' : t.type === 'savings' ? 'bg-teal-500' : t.type === 'withdrawal' ? 'bg-amber-500' : 'bg-slate-400'}`}>
                  <i className={`fas ${t.type === 'income' ? 'fa-arrow-up' : t.type === 'savings' ? 'fa-piggy-bank' : t.type === 'withdrawal' ? 'fa-hand-holding-usd' : 'fa-arrow-down'}`}></i>
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{t.description}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className={`font-black shrink-0 ${ (t.type === 'income' || t.type === 'withdrawal') ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {(t.type === 'income' || t.type === 'withdrawal') ? '+' : '-'}${t.amount.toFixed(2)}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => onEdit(t)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600"><i className="fas fa-pen text-[10px]"></i></button>
                  <button onClick={() => onDelete(t.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600"><i className="fas fa-trash text-[10px]"></i></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
