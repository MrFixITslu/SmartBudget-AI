
import React, { useMemo, useState, useEffect } from 'react';
// Added missing Legend import from recharts
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, Cell, Legend } from 'recharts';
import { Transaction, RecurringExpense, RecurringIncome, SavingGoal, InvestmentAccount, MarketPrice, BankConnection, InvestmentGoal } from '../types';
import { GoogleGenAI } from "@google/genai";
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
  investmentGoals: InvestmentGoal[];
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
  transactions, investments, marketPrices, bankConnections, recurringExpenses, recurringIncomes, savingGoals, categoryBudgets, onDelete, onPayRecurring, onReceiveRecurringIncome, onEdit
}) => {
  const [trendTimeframe, setTrendTimeframe] = useState<Timeframe>('monthly');
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const cycleStartDate = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() < 25) {
      start.setMonth(start.getMonth() - 1);
    }
    return start;
  }, []);

  // Actual Totals for current cycle
  const { totalActualIncome, totalActualExpenses } = useMemo(() => {
    const current = transactions.filter(t => new Date(t.date) >= cycleStartDate);
    return {
      totalActualIncome: current.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
      totalActualExpenses: current.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0),
    };
  }, [transactions, cycleStartDate]);

  const institutionalBalances = useMemo<Record<string, InstitutionalBalance>>(() => {
    const balances: Record<string, InstitutionalBalance> = {};
    bankConnections.forEach(conn => {
      const history = transactions.filter(t => t.institution === conn.institution || t.destinationInstitution === conn.institution);
      const flow = history.reduce((acc: number, t) => {
        if (t.destinationInstitution === conn.institution && (t.type === 'transfer' || t.type === 'withdrawal')) return acc + t.amount;
        if (t.institution === conn.institution) {
          if (t.type === 'income') return acc + t.amount;
          if (t.type === 'expense' || t.type === 'transfer' || t.type === 'withdrawal' || t.type === 'savings') return acc - t.amount;
        }
        return acc;
      }, 0);
      balances[conn.institution] = { balance: (conn.openingBalance || 0) + flow, type: conn.institutionType, available: conn.institution.includes('1st National') };
    });

    const cashFlow = transactions.filter(t => t.institution === 'Cash in Hand' || t.destinationInstitution === 'Cash in Hand').reduce((acc: number, t) => {
      if (t.destinationInstitution === 'Cash in Hand' && (t.type === 'transfer' || t.type === 'withdrawal')) return acc + t.amount;
      if (t.institution === 'Cash in Hand') {
        if (t.type === 'income') return acc + t.amount;
        if (t.type === 'expense' || t.type === 'transfer' || t.type === 'withdrawal' || t.type === 'savings') return acc - t.amount;
      }
      return acc;
    }, 0);
    balances['Cash in Hand'] = { balance: cashFlow, type: 'cash', available: true, isCash: true };

    investments.forEach(inv => {
      const liveVal = inv.holdings.reduce((hAcc: number, h) => {
        const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
        return hAcc + (h.quantity * live);
      }, 0);
      const withdrawFlow = transactions.filter(t => t.institution === inv.provider && (t.type === 'withdrawal' || t.type === 'transfer' || t.type === 'expense')).reduce((acc: number, t) => acc + t.amount, 0);
      const depositFlow = transactions.filter(t => t.destinationInstitution === inv.provider && (t.type === 'transfer' || t.type === 'income')).reduce((acc: number, t) => acc + t.amount, 0);
      balances[inv.provider] = { balance: liveVal - withdrawFlow + depositFlow, type: 'investment', available: false, holdings: inv.holdings };
    });
    return balances;
  }, [bankConnections, investments, transactions, marketPrices]);

  const liquidFunds = useMemo(() => {
    const primary = institutionalBalances['1st National Bank St. Lucia']?.balance || 0;
    const cash = institutionalBalances['Cash in Hand']?.balance || 0;
    return primary + cash;
  }, [institutionalBalances]);

  const netWorth: number = (Object.values(institutionalBalances) as InstitutionalBalance[]).reduce((acc: number, b) => acc + b.balance, 0);

  const { dailySpendLimit, daysRemaining, nextCycleDate, cycleProgress } = useMemo(() => {
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() >= 25) target = new Date(now.getFullYear(), now.getMonth() + 1, 25);
    
    const diffTime = target.getTime() - now.getTime();
    const safeDays = Math.max(1, Math.ceil(diffTime / 86400000));
    const progress = Math.min(100, Math.max(0, ((30 - safeDays) / 30) * 100));
    const dailyLimit = liquidFunds / safeDays;
    return { 
      dailySpendLimit: dailyLimit > 0 ? dailyLimit : 0,
      daysRemaining: safeDays,
      nextCycleDate: target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cycleProgress: progress
    };
  }, [liquidFunds]);

  const cashflowTrends = useMemo(() => {
    const grouped: Record<string, { income: number; expense: number }> = {};
    const filtered = transactions.filter(t => t.type === 'income' || t.type === 'expense');

    filtered.forEach(t => {
      const date = new Date(t.date);
      const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[label]) grouped[label] = { income: 0, expense: 0 };
      if (t.type === 'income') grouped[label].income += t.amount;
      else grouped[label].expense += t.amount;
    });

    return Object.entries(grouped)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-6); // Last 6 months
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const query = searchTerm.toLowerCase();
      return (
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        (t.vendor && t.vendor.toLowerCase().includes(query)) ||
        (t.notes && t.notes.toLowerCase().includes(query)) ||
        t.amount.toString().includes(query)
      );
    });
  }, [transactions, searchTerm]);

  const totalTargetExpenses = useMemo(() => recurringExpenses.reduce((acc: number, e) => acc + e.amount, 0) + (Object.values(categoryBudgets).reduce((a: number, b) => a + (Number(b) || 0), 0)), [recurringExpenses, categoryBudgets]);
  
  // Calculate how many months user can survive with total assets (Net Worth)
  const survivalMonths = useMemo(() => totalTargetExpenses > 0 ? netWorth / totalTargetExpenses : 0, [netWorth, totalTargetExpenses]);

  // Identify unpaid bills in current cycle
  const unpaidBills = useMemo(() => {
    return recurringExpenses.filter(bill => {
      const alreadyPaid = transactions.some(t => 
        t.recurringId === bill.id && 
        new Date(t.date) >= cycleStartDate
      );
      return !alreadyPaid;
    });
  }, [recurringExpenses, transactions, cycleStartDate]);

  // Identify expected incomes not yet confirmed in current cycle
  const unconfirmedIncomes = useMemo(() => {
    return recurringIncomes.filter(inc => {
      const alreadyReceived = transactions.some(t => 
        t.description.includes(inc.description) && 
        t.type === 'income' &&
        new Date(t.date) >= cycleStartDate
      );
      return !alreadyReceived;
    });
  }, [recurringIncomes, transactions, cycleStartDate]);

  useEffect(() => {
    const generateSummary = async () => {
      if (transactions.length < 1) { setAiInsight("Welcome! Log spend to unlock insights."); return; }
      setIsGeneratingInsight(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const context = `Actual Income: $${totalActualIncome.toFixed(2)}, Actual Spending: $${totalActualExpenses.toFixed(2)}, Net Worth: $${netWorth.toFixed(2)}, Runway: ${survivalMonths.toFixed(1)} months. Unpaid Bills: ${unpaidBills.length}. Expected Income: ${unconfirmedIncomes.length}.`;
        const response = await ai.models.generateContent({ 
          model: 'gemini-3-flash-preview', 
          contents: { parts: [{ text: `Context: ${context}\nAction: One ultra-concise finance tip.` }] }
        });
        setAiInsight(response.text || "Portfolio stable.");
      } catch (e) { 
        setAiInsight("Gemini Advisor on standby."); 
      } finally { 
        setIsGeneratingInsight(false); 
      }
    };
    generateSummary();
  }, [totalActualIncome, totalActualExpenses, netWorth, transactions.length, survivalMonths, unpaidBills.length, unconfirmedIncomes.length]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span>
              <p className="text-white text-[10px] font-black uppercase tracking-[0.3em]">Gemini Strategic Advisor</p>
            </div>
            {isGeneratingInsight ? <div className="h-6 w-3/4 bg-white/5 animate-pulse rounded-lg"></div> : <h2 className="text-white text-lg md:text-xl font-medium italic">"{aiInsight}"</h2>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:flex flex-wrap lg:grid lg:grid-cols-5 gap-5">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center flex-1 min-w-[150px]">
           <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Monthly Actual Income</p>
           <h3 className="text-xl font-black text-emerald-600">${totalActualIncome.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center flex-1 min-w-[150px]">
           <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Monthly Actual Spending</p>
           <h3 className="text-xl font-black text-rose-600">${totalActualExpenses.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center flex-1 min-w-[150px]">
           <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Cycle Surplus/Deficit</p>
           <h3 className={`text-xl font-black ${(totalActualIncome - totalActualExpenses) >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
             ${(totalActualIncome - totalActualExpenses).toLocaleString()}
           </h3>
        </div>
        <div className="bg-indigo-600 p-6 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-center flex-1 min-w-[150px]">
           <p className="text-white/60 text-[9px] font-black uppercase tracking-widest mb-1">Survival Runway</p>
           <h3 className="text-xl font-black">{survivalMonths.toFixed(1)} <span className="text-[10px] text-white/40 uppercase">Months</span></h3>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl text-white flex flex-col justify-center flex-1 min-w-[150px]">
           <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Total Assets</p>
           <h3 className="text-xl font-black">${netWorth.toLocaleString()}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.1em]">Cashflow Analysis</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Income vs Expenses (Last 6 Months)</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', paddingBottom: '20px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-indigo-600 p-10 rounded-[3rem] shadow-xl text-white flex flex-col justify-between">
           <div>
             <div className="flex justify-between items-center mb-1">
               <p className="text-white/80 text-[10px] font-black uppercase tracking-widest">Cycle Margin</p>
               <p className="text-[9px] font-black uppercase text-white/60">{daysRemaining}D Left</p>
             </div>
             <h3 className="text-4xl font-black mb-10">${liquidFunds.toLocaleString()}</h3>
             
             <div className="bg-black/10 rounded-[2rem] p-6 border border-white/10 backdrop-blur-sm mb-8">
               <p className="text-[9px] text-white/60 font-black uppercase tracking-widest mb-1">Daily Spend Limit</p>
               <h4 className="text-3xl font-black text-white">${dailySpendLimit.toLocaleString('en-US', { maximumFractionDigits: 2 })}</h4>
             </div>
           </div>

           <div className="space-y-2">
             <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
               <span>Month Completion</span>
               <span>{cycleProgress.toFixed(0)}%</span>
             </div>
             <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
               <div className="h-full bg-white transition-all duration-1000" style={{ width: `${cycleProgress}%` }}></div>
             </div>
           </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h3 className="font-black text-slate-800 uppercase text-xs">Transaction Ledger</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Real-time searchable history</p>
            </div>
            <div className="relative flex-1 md:max-w-xs">
              <input 
                type="text"
                placeholder="Search description, amount or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
            <div className="space-y-3">
              {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                <div key={t.id} className="p-5 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-between group hover:border-indigo-100 transition-all hover:shadow-lg hover:shadow-indigo-50/50">
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                      <i className={`fas ${t.type === 'income' ? 'fa-arrow-up' : t.type === 'expense' ? 'fa-arrow-down' : 'fa-exchange-alt'}`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{t.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">{t.category}</span>
                        <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">{t.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className={`text-lg font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{t.institution || 'Cash'}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setTransactionToEdit(t)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition flex items-center justify-center">
                        <i className="fas fa-edit text-xs"></i>
                      </button>
                      <button onClick={() => onDelete(t.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 transition flex items-center justify-center">
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-24 text-center">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                     <i className="fas fa-search text-2xl"></i>
                   </div>
                   <p className="text-slate-300 font-black uppercase text-[10px] tracking-[0.3em]">Zero matches for "{searchTerm}"</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-xs mb-10 tracking-widest">Active Budgets</h3>
            <div className="space-y-8">
              {(Object.entries(categoryBudgets) as [string, number][]).filter(([_, limit]) => limit > 0).map(([cat, limit]) => {
                const actual = transactions.filter(t => t.category === cat && new Date(t.date) >= cycleStartDate).reduce((a: number, b) => a + b.amount, 0);
                const percent = Math.min(100, (actual / limit) * 100);
                return (
                  <div key={cat} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{cat}</p>
                        <p className="text-xs font-black text-slate-400">${actual.toLocaleString()} / ${limit.toLocaleString()}</p>
                      </div>
                      <p className={`text-xs font-black ${percent >= 90 ? 'text-rose-600' : 'text-indigo-600'}`}>{percent.toFixed(0)}%</p>
                    </div>
                    <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                      <div className={`h-full transition-all duration-1000 ${percent >= 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(categoryBudgets).length === 0 && <p className="text-center text-[10px] text-slate-300 font-black uppercase py-10">No budgets configured</p>}
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-xs mb-10 tracking-widest">Expected Inflows</h3>
            <div className="space-y-4">
              {unconfirmedIncomes.map(inc => (
                <div key={inc.id} className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                      <i className="fas fa-hand-holding-dollar text-xs"></i>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{inc.description}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected {inc.dayOfMonth}th • ${inc.amount.toLocaleString()}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onReceiveRecurringIncome(inc, inc.amount)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-emerald-100"
                  >
                    Confirm
                  </button>
                </div>
              ))}
              {unconfirmedIncomes.length === 0 && <p className="text-center text-[10px] text-slate-300 font-black uppercase py-10">All income received</p>}
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-xs mb-10 tracking-widest">Upcoming Commitments</h3>
            <div className="space-y-4">
              {unpaidBills.map(bill => (
                <div key={bill.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                      <i className="fas fa-calendar-day text-xs"></i>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{bill.description}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due on the {bill.dayOfMonth}th • ${bill.amount.toLocaleString()}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onPayRecurring(bill, bill.amount)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100"
                  >
                    Pay
                  </button>
                </div>
              ))}
              {unpaidBills.length === 0 && <p className="text-center text-[10px] text-slate-300 font-black uppercase py-10">All bills settled</p>}
            </div>
          </section>
        </div>
      </div>

      <section className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 pointer-events-none"><i className="fas fa-vault text-[120px]"></i></div>
        <div className="relative z-10">
          <h3 className="font-black uppercase text-[11px] text-indigo-400 mb-10 tracking-[0.4em]">Smart Savings Buckets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {savingGoals.map(goal => {
              const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
              return (
                <div key={goal.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative group overflow-hidden transition-all hover:bg-white/10">
                  <div className="relative z-10">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">{goal.category}</p>
                    <h4 className="text-xl font-black mb-4 truncate">{goal.name}</h4>
                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <p className="text-[10px] font-black text-white/40 uppercase">Saved</p>
                        <p className="text-2xl font-black">${goal.currentAmount.toLocaleString()}</p>
                      </div>
                      <p className="text-sm font-black text-indigo-400">{progress.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5">
                    <div className="h-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              );
            })}
            {savingGoals.length === 0 && <div className="col-span-full py-20 opacity-30 italic text-center text-xs font-black uppercase tracking-widest">No active savings buckets</div>}
          </div>
        </div>
      </section>

      {transactionToEdit && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-2">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800">Modify Entry</h2>
              <button onClick={() => setTransactionToEdit(null)} className="text-slate-400 hover:text-slate-800"><i className="fas fa-times"></i></button>
            </div>
            <TransactionForm initialData={transactionToEdit} onAdd={(t) => { onEdit({ ...t, id: transactionToEdit.id } as Transaction); setTransactionToEdit(null); }} onCancel={() => setTransactionToEdit(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
