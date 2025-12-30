
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
  onAddIncome: (amount: number, description: string, notes: string) => void;
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
  onWithdrawSaving,
  onAddIncome
}) => {
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [saveAmounts, setSaveAmounts] = useState<Record<string, string>>({});
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});
  
  // Extra Income State
  const [extraIncomeAmount, setExtraIncomeAmount] = useState('');
  const [extraIncomeDesc, setExtraIncomeDesc] = useState('');
  const [extraIncomeNotes, setExtraIncomeNotes] = useState('');

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
    const amount = (rawValue === undefined || rawValue === '') ? rec.balance : parseFloat(rawValue);
    if (isNaN(amount) || amount <= 0) return;
    onPayRecurring(rec, amount);
    setPayAmounts(prev => {
      const next = { ...prev };
      delete next[rec.id];
      return next;
    });
  };

  const handleLogIncome = () => {
    const amount = parseFloat(extraIncomeAmount);
    if (isNaN(amount) || amount <= 0 || !extraIncomeDesc) return;
    onAddIncome(amount, extraIncomeDesc, extraIncomeNotes);
    setExtraIncomeAmount('');
    setExtraIncomeDesc('');
    setExtraIncomeNotes('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Available Balance</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Additional Income Section */}
        <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
              <i className="fas fa-hand-holding-usd text-emerald-500"></i>
              Log Additional Income
            </h3>
            <p className="text-slate-400 text-xs font-medium mt-1">Bonus, side gigs, or gifts</p>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <input 
                type="number"
                placeholder="Amount"
                className="w-32 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                value={extraIncomeAmount}
                onChange={e => setExtraIncomeAmount(e.target.value)}
              />
              <input 
                type="text"
                placeholder="Description (e.g. Side Gig)"
                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                value={extraIncomeDesc}
                onChange={e => setExtraIncomeDesc(e.target.value)}
              />
            </div>
            <textarea 
              placeholder="Notes..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
              rows={2}
              value={extraIncomeNotes}
              onChange={e => setExtraIncomeNotes(e.target.value)}
            />
            <button 
              onClick={handleLogIncome}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl transition shadow-lg shadow-emerald-100 uppercase text-xs tracking-widest"
            >
              Add to Balance
            </button>
          </div>
        </section>

        {/* Bills Preview */}
        <section className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-black flex items-center gap-2">
                <i className="fas fa-receipt text-indigo-400"></i>
                Monthly Bills
              </h3>
              <p className="text-slate-400 text-xs font-medium">Pending payments</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Total Due</p>
              <p className="text-xl font-black text-rose-400">
                ${recurringExpenses.reduce((acc, r) => acc + r.balance, 0).toFixed(2)}
              </p>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
            {recurringExpenses.filter(r => r.balance > 0).map(rec => (
              <div key={rec.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-slate-700">
                <div>
                  <p className="font-bold text-sm">{rec.description}</p>
                  <p className="text-[10px] text-slate-500 font-bold">Due Day {rec.dayOfMonth}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-rose-300 text-sm">${rec.balance.toFixed(2)}</span>
                  <button onClick={() => handleQuickPay(rec)} className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-black uppercase tracking-widest">Pay</button>
                </div>
              </div>
            ))}
            {recurringExpenses.filter(r => r.balance > 0).length === 0 && <p className="text-center text-slate-500 text-xs py-4">All bills paid for now!</p>}
          </div>
        </section>
      </div>

      {/* Saving Goals Section */}
      <section className="bg-emerald-900 p-8 rounded-[2.5rem] shadow-2xl text-white">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2">
              <i className="fas fa-piggy-bank text-emerald-400"></i>
              Savings Progress
            </h3>
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
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Monthly Trends & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Monthly Trends</h3>
            <span className="text-xs text-slate-400 font-medium">Last 6 Months (Outgoings)</span>
          </div>
          <div style={{ height: 250, width: '100%', minHeight: 250 }} className="relative">
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

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4">Expense Mix</h3>
          {pieChartData.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div style={{ height: 200, width: '100%', minHeight: 200 }} className="relative">
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
                    <span className="truncate uppercase tracking-tighter text-ellipsis">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 italic text-xs">No transactions.</div>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-widest">Recent Activity</h3>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {transactions.slice(0, 20).map((t) => (
            <div key={t.id} className="group flex items-start justify-between p-4 bg-slate-50 rounded-2xl hover:bg-white hover:ring-2 hover:ring-indigo-100 transition relative">
              <div className="flex items-start gap-3 overflow-hidden">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5 ${t.type === 'income' ? 'bg-emerald-500' : t.type === 'savings' ? 'bg-teal-500' : t.type === 'withdrawal' ? 'bg-amber-500' : 'bg-slate-400'}`}>
                  <i className={`fas ${t.type === 'income' ? 'fa-arrow-up' : t.type === 'savings' ? 'fa-piggy-bank' : t.type === 'withdrawal' ? 'fa-hand-holding-usd' : 'fa-arrow-down'}`}></i>
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{t.description}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                  {t.notes && (
                    <p className="mt-1 text-xs text-slate-400 italic bg-slate-100 p-2 rounded-lg border border-slate-200/50">
                      "{t.notes}"
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
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
          {transactions.length === 0 && <p className="text-center text-slate-400 text-sm py-8 italic">No transactions yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
