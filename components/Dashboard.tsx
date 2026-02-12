
import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
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
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [incomeInputs, setIncomeInputs] = useState<Record<string, string>>({});
  const [trendTimeframe, setTrendTimeframe] = useState<Timeframe>('monthly');
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");

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

  const accountTypeTotals = useMemo(() => {
    let bank = 0;
    let creditUnion = 0;
    let crypto = 0;
    let investmentsTotal = 0;

    (Object.entries(institutionalBalances) as [string, InstitutionalBalance][]).forEach(([name, data]) => {
      if (data.type === 'bank') bank += data.balance;
      else if (data.type === 'credit_union') creditUnion += data.balance;
      else if (data.type === 'investment') {
        if (name.toLowerCase().includes('binance')) crypto += data.balance;
        else investmentsTotal += data.balance;
      }
    });

    return { bank, creditUnion, crypto, investmentsTotal };
  }, [institutionalBalances]);

  const subscriptionAudit = useMemo(() => {
    return recurringExpenses.map(bill => ({
      ...bill,
      annualCost: bill.amount * 12
    })).sort((a, b) => b.annualCost - a.annualCost);
  }, [recurringExpenses]);

  const netWorthTrend = useMemo(() => {
    const pulse = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
      const simulatedVariance = (i * 150) - (Math.random() * 300);
      pulse.push({ date: dayLabel, value: netWorth - simulatedVariance });
    }
    return pulse;
  }, [netWorth]);

  const trendData = useMemo(() => {
    const grouped: Record<string, number> = {};
    const filteredTransactions = transactions.filter(t => t.type === 'expense');

    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
      let label = '';
      if (trendTimeframe === 'daily') label = t.date;
      else if (trendTimeframe === 'weekly') {
          const d = new Date(date);
          d.setDate(d.getDate() - d.getDay());
          label = d.toISOString().split('T')[0];
      }
      else if (trendTimeframe === 'monthly') label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      else label = `${date.getFullYear()}`;

      grouped[label] = (grouped[label] || 0) + t.amount;
    });

    const entries = Object.entries(grouped)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => a.label.localeCompare(b.label));
    
    return entries.length > 0 ? entries : [{ label: 'No Data', amount: 0 }];
  }, [transactions, trendTimeframe]);

  // Filtered transactions for the ledger
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

  const totalMonthlyExpenses = useMemo(() => recurringExpenses.reduce((acc: number, e) => acc + e.amount, 0) + (Object.values(categoryBudgets).reduce((a: number, b) => a + (Number(b) || 0), 0)), [recurringExpenses, categoryBudgets]);
  const burnRate = useMemo(() => totalMonthlyExpenses / 30, [totalMonthlyExpenses]);

  useEffect(() => {
    const generateSummary = async () => {
      if (transactions.length < 1) { setAiInsight("Welcome! Log spend to unlock insights."); return; }
      setIsGeneratingInsight(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const context = `Liquid: $${liquidFunds.toFixed(2)}, Net: $${netWorth.toFixed(2)}, Burn: $${burnRate.toFixed(2)}.`;
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
  }, [liquidFunds, netWorth, transactions.length, burnRate]);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white md:col-span-2 p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-8">
            <div className="flex flex-col items-end">
              <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${daysRemaining <= 5 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-500'}`}>
                <i className="fas fa-hourglass-half"></i>
                {daysRemaining} Days Left
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 mr-1">Next Cycle: {nextCycleDate}</p>
            </div>
          </div>
          
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase mb-3 tracking-widest">Consolidated Net Worth</p>
            <h2 className="text-5xl font-black text-slate-900 tracking-tight mb-6">${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
            
            <div className="h-24 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={netWorthTrend}>
                   <defs>
                     <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                       <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                 </AreaChart>
               </ResponsiveContainer>
               <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-center mt-1">7-Day Net Worth Pulse</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-8">
             <div className="bg-slate-50 px-5 py-4 rounded-[1.5rem] border border-slate-100 flex-1 min-w-[120px]">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank</p>
               <p className="text-xl font-black text-slate-800">${accountTypeTotals.bank.toLocaleString()}</p>
             </div>
             <div className="bg-slate-50 px-5 py-4 rounded-[1.5rem] border border-slate-100 flex-1 min-w-[120px]">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Credit Union</p>
               <p className="text-xl font-black text-indigo-600">${accountTypeTotals.creditUnion.toLocaleString()}</p>
             </div>
             <div className="bg-slate-50 px-5 py-4 rounded-[1.5rem] border border-slate-100 flex-1 min-w-[120px]">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Crypto</p>
               <p className="text-xl font-black text-amber-500">${accountTypeTotals.crypto.toLocaleString()}</p>
             </div>
             <div className="bg-slate-50 px-5 py-4 rounded-[1.5rem] border border-slate-100 flex-1 min-w-[120px]">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Investments</p>
               <p className="text-xl font-black text-emerald-600">${accountTypeTotals.investmentsTotal.toLocaleString()}</p>
             </div>
          </div>
        </div>

        <div className={`${liquidFunds >= 0 ? 'bg-indigo-600 shadow-indigo-100' : 'bg-rose-600 shadow-rose-100'} p-8 rounded-[3rem] shadow-xl text-white flex flex-col justify-center transition-colors`}>
           <div className="flex justify-between items-center mb-1">
             <p className="text-white text-[10px] font-black uppercase tracking-widest">Cycle Margin</p>
             <p className="text-[9px] font-black uppercase text-white/60">{daysRemaining}D Remaining</p>
           </div>
           <h3 className="text-4xl font-black mb-6">${liquidFunds.toLocaleString()}</h3>
           
           <div className="space-y-4">
             <div className="bg-black/10 rounded-[2rem] p-5 border border-white/10 backdrop-blur-sm">
               <p className="text-[9px] text-white font-black uppercase tracking-widest mb-1">Daily Spend Limit</p>
               <h4 className="text-3xl font-black text-white">${dailySpendLimit.toLocaleString('en-US', { maximumFractionDigits: 2 })}</h4>
             </div>
             <div className="space-y-1.5 px-1">
               <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                 <span>Cycle Progress</span>
                 <span>{cycleProgress.toFixed(0)}%</span>
               </div>
               <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                 <div className="h-full bg-white transition-all duration-1000" style={{ width: `${cycleProgress}%` }}></div>
               </div>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col min-h-[400px]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h3 className="font-black text-slate-800 uppercase text-xs">Transaction Ledger</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Real-time searchable history</p>
            </div>
            <div className="relative flex-1 md:max-w-xs">
              <input 
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar pr-2">
            <div className="space-y-3">
              {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                <div key={t.id} className="p-4 bg-white border border-slate-100 rounded-[1.5rem] flex items-center justify-between group hover:border-indigo-100 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                      <i className={`fas ${t.type === 'income' ? 'fa-arrow-up' : t.type === 'expense' ? 'fa-arrow-down' : 'fa-exchange-alt'}`}></i>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{t.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{t.category}</span>
                        <span className="text-[8px] text-slate-300">•</span>
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{t.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`text-sm font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{t.institution || 'Cash'}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setTransactionToEdit(t)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 transition flex items-center justify-center">
                        <i className="fas fa-edit text-[10px]"></i>
                      </button>
                      <button onClick={() => onDelete(t.id)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 transition flex items-center justify-center">
                        <i className="fas fa-trash-alt text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.2em]">No transactions found</div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase text-xs mb-8 tracking-widest">Active Budgets</h3>
          <div className="space-y-6">
            {(Object.entries(categoryBudgets) as [string, number][]).filter(([_, limit]) => limit > 0).map(([cat, limit]) => {
              const actual = transactions.filter(t => t.category === cat && new Date(t.date) >= cycleStartDate).reduce((a: number, b) => a + b.amount, 0);
              const percent = Math.min(100, (actual / limit) * 100);
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] font-black uppercase text-slate-500">{cat}</p>
                    <p className={`text-xs font-black ${percent >= 90 ? 'text-rose-600' : 'text-indigo-600'}`}>${Math.max(0, limit - actual).toFixed(0)} left</p>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full transition-all duration-1000 ${percent >= 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
            {savingGoals.length === 0 && <div className="col-span-full py-10 opacity-30 italic text-center text-xs">No active savings buckets</div>}
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
