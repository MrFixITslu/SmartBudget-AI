
import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
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
  transactions, investments, marketPrices, bankConnections, recurringExpenses, recurringIncomes, investmentGoals, categoryBudgets, onDelete, onPayRecurring, onReceiveRecurringIncome, onEdit
}) => {
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [incomeInputs, setIncomeInputs] = useState<Record<string, string>>({});
  const [trendTimeframe, setTrendTimeframe] = useState<Timeframe>('monthly');
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  const cycleStartDate = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() < 25) {
      start.setMonth(start.getMonth() - 1);
    }
    return start;
  }, []);

  // Fix: Move institutionalBalances declaration before its usage in dailySpendLimit useMemo
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

  // Fix: Move liquidFunds declaration before its usage in dailySpendLimit useMemo
  const liquidFunds = useMemo(() => {
    const primary = institutionalBalances['1st National Bank St. Lucia']?.balance || 0;
    const cash = institutionalBalances['Cash in Hand']?.balance || 0;
    return primary + cash;
  }, [institutionalBalances]);

  const { dailySpendLimit, daysRemaining, nextCycleDate, cycleProgress } = useMemo(() => {
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() >= 25) target = new Date(now.getFullYear(), now.getMonth + 1, 25);
    
    const diffTime = target.getTime() - now.getTime();
    const safeDays = Math.max(1, Math.ceil(diffTime / 86400000));
    
    // Calculate progress through a 30-day average month
    const progress = Math.min(100, Math.max(0, ((30 - safeDays) / 30) * 100));
    
    const dailyLimit = liquidFunds / safeDays;
    return { 
      dailySpendLimit: dailyLimit > 0 ? dailyLimit : 0,
      daysRemaining: safeDays,
      nextCycleDate: target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cycleProgress: progress
    };
  }, [liquidFunds]);

  const portfolioFunds = useMemo(() => (Object.values(institutionalBalances) as InstitutionalBalance[]).filter(b => b.type === 'investment').reduce((acc: number, b) => acc + b.balance, 0), [institutionalBalances]);
  const netWorth: number = (Object.values(institutionalBalances) as InstitutionalBalance[]).reduce((acc: number, b) => acc + b.balance, 0);

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

  const totalMonthlyIncomes = useMemo(() => recurringIncomes.reduce((acc: number, i) => acc + i.amount, 0), [recurringIncomes]);
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

  const renderIncomeCard = (income: RecurringIncome) => {
    const receivedTotal = transactions.filter(t => t.recurringId === income.id && new Date(t.date) >= cycleStartDate && t.type === 'income').reduce((acc: number, t) => acc + t.amount, 0);
    const fullyReceived = receivedTotal >= income.amount;
    const currentInput = incomeInputs[income.id] || (income.amount - receivedTotal).toString();
    return (
      <div key={income.id} className={`p-5 border-2 rounded-[2rem] transition-all ${fullyReceived ? 'bg-emerald-50/30 border-emerald-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${fullyReceived ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500 text-white shadow-lg'}`}><i className="fas fa-hand-holding-dollar"></i></div>
            <div><p className={`font-black text-sm ${fullyReceived ? 'text-slate-400' : 'text-slate-800'}`}>{income.description}</p><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{fullyReceived ? `Settled` : `the ${income.dayOfMonth}th`}</p></div>
          </div>
          <div className="text-right"><p className={`font-black text-base ${fullyReceived ? 'text-slate-300' : 'text-emerald-600'}`}>+${income.amount.toFixed(2)}</p></div>
        </div>
        {!fullyReceived && (
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
             <input type="number" step="0.01" className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none" value={currentInput} onChange={(e) => setIncomeInputs(prev => ({ ...prev, [income.id]: e.target.value }))} />
             <button onClick={() => { const amt = parseFloat(currentInput); if (!isNaN(amt) && amt > 0) { onReceiveRecurringIncome(income, amt); setIncomeInputs(prev => { const next = {...prev}; delete next[income.id]; return next; }); } }} className="h-10 px-4 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl">Confirm</button>
          </div>
        )}
      </div>
    );
  };

  const renderBillCard = (bill: RecurringExpense) => {
    const paid = transactions.some(t => t.recurringId === bill.id && new Date(t.date) >= cycleStartDate && t.type === 'expense');
    const totalToPay = bill.amount + (bill.accumulatedOverdue || 0);
    const currentInput = paymentInputs[bill.id] || totalToPay.toString();
    return (
      <div key={bill.id} className={`p-6 border-2 transition-all ${paid ? 'bg-slate-50/50 border-slate-100 opacity-70' : 'bg-white border-indigo-100 shadow-md'} rounded-[2.5rem] relative`}>
        <div className={`absolute top-4 right-6 text-[8px] font-black uppercase px-3 py-1.5 rounded-full ${paid ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>{paid ? 'Paid' : 'Due'}</div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mt-4">
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${paid ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white'}`}><i className="fas fa-file-invoice"></i></div>
            <div><p className={`font-black text-base ${paid ? 'text-slate-400' : 'text-slate-800'}`}>{bill.description}</p><p className="text-[10px] font-black uppercase text-slate-400">the {bill.dayOfMonth}th</p></div>
          </div>
          {!paid && (
            <div className="flex items-center gap-2 p-2 rounded-2xl border bg-slate-50 border-slate-200">
              <input type="number" step="0.01" className="w-24 px-3 py-2 rounded-xl text-xs font-black outline-none bg-white" value={currentInput} onChange={(e) => setPaymentInputs(prev => ({ ...prev, [bill.id]: e.target.value }))} />
              <button onClick={() => { const amt = parseFloat(currentInput); if (!isNaN(amt) && amt > 0) { onPayRecurring(bill, amt); setPaymentInputs(prev => { const next = {...prev}; delete next[bill.id]; return next; }); } }} className="px-5 py-2.5 text-[10px] font-black uppercase rounded-xl bg-indigo-600 text-white shadow-lg">Pay</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span>
              <p className="text-white text-[10px] font-black uppercase tracking-[0.3em]">Gemini Strategic Advisor</p>
            </div>
            {isGeneratingInsight ? <div className="h-6 w-3/4 bg-white/5 animate-pulse rounded-lg"></div> : <h2 className="text-white text-lg md:text-xl font-medium">"{aiInsight}"</h2>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white md:col-span-2 p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8">
            <div className="flex flex-col items-end">
              <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${daysRemaining <= 5 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-500'}`}>
                <i className="fas fa-hourglass-half"></i>
                {daysRemaining} Days Left
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 mr-1">Next Cycle: {nextCycleDate}</p>
            </div>
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase mb-3 tracking-widest">Consolidated Net Worth</p>
          <h2 className="text-5xl font-black text-slate-900 tracking-tight">${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
          <div className="flex items-center gap-6 mt-10">
             <div className="bg-slate-50 px-5 py-4 rounded-[1.5rem] border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Liquid</p><p className="text-xl font-black text-emerald-600">${liquidFunds.toLocaleString()}</p></div>
             <div className="bg-slate-50 px-5 py-4 rounded-[1.5rem] border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assets</p><p className="text-xl font-black text-indigo-600">${portfolioFunds.toLocaleString()}</p></div>
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
               <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                 <div className="h-full bg-white transition-all duration-1000" style={{ width: `${cycleProgress}%` }}></div>
               </div>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 overflow-hidden min-h-[400px] shadow-sm">
          <div className="flex justify-between items-center mb-10"><div><h3 className="font-black text-slate-800 uppercase text-xs">Spending Trends</h3></div></div>
          <div style={{ width: '100%', height: 300, minHeight: 300 }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={4} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white">
          <h3 className="font-black uppercase text-xs text-white/80 mb-8 tracking-widest">Active Budgets</h3>
          <div className="space-y-6">{(Object.entries(categoryBudgets) as [string, number][]).filter(([_, limit]) => limit > 0).map(([cat, limit]) => {
              const actual = transactions.filter(t => t.category === cat && new Date(t.date) >= cycleStartDate).reduce((a: number, b) => a + b.amount, 0);
              const percent = Math.min(100, (actual / limit) * 100);
              return (<div key={cat} className="space-y-2"><div className="flex justify-between items-end"><p className="text-[10px] font-black uppercase text-white/90">{cat}</p><p className={`text-xs font-black ${percent >= 90 ? 'text-rose-400' : 'text-indigo-400'}`}>${Math.max(0, limit - actual).toFixed(0)}</p></div><div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${percent >= 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${percent}%` }}></div></div></div>);
            })}</div>
        </section>
      </div>

      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <h3 className="font-black text-slate-800 uppercase text-xs mb-10">Verification & Summary</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6"><h4 className="text-[10px] font-black text-emerald-600 uppercase px-2 tracking-widest">Revenue</h4>{recurringIncomes.map(income => renderIncomeCard(income))}</div>
          <div className="space-y-6"><h4 className="text-[10px] font-black text-rose-600 uppercase px-2 tracking-widest">Bills</h4>{recurringExpenses.map(bill => renderBillCard(bill))}</div>
        </div>
      </section>

      {/* Connected Infrastructure Section at the Bottom */}
      <section className="mt-12">
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xs shadow-sm">
            <i className="fas fa-plug"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Connected Infrastructure</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Live API & Secure Gateway Status</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {bankConnections.map(conn => (
            <div key={conn.institution} className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col items-center text-center group hover:border-indigo-200 transition-all">
               <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mb-3 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                 <i className={`fas ${conn.institutionType === 'investment' ? 'fa-coins' : 'fa-building-columns'} text-sm`}></i>
               </div>
               <p className="text-[10px] font-black text-slate-800 truncate w-full px-1">{conn.institution}</p>
               <div className="flex items-center gap-2 mt-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                 <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">{conn.status}</p>
               </div>
            </div>
          ))}
          {investments.map(inv => {
            // Check if already in bankConnections to avoid duplicates
            if (bankConnections.some(c => c.institution === inv.provider)) return null;
            return (
              <div key={inv.provider} className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col items-center text-center group hover:border-indigo-200 transition-all">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mb-3 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                  <i className="fas fa-chart-line text-sm"></i>
                </div>
                <p className="text-[10px] font-black text-slate-800 truncate w-full px-1">{inv.provider}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Live API</p>
                </div>
              </div>
            );
          })}
          {bankConnections.length === 0 && investments.length === 0 && (
            <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-200 rounded-[2rem]">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No active API links detected</p>
            </div>
          )}
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
