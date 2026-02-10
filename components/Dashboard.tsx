
import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, Legend, ComposedChart } from 'recharts';
import { Transaction, RecurringExpense, RecurringIncome, SavingGoal, InvestmentAccount, MarketPrice, BankConnection, CATEGORIES, InvestmentGoal } from '../types';
import { syncLucelecPortal } from '../services/bankApiService';
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
  transactions, investments, marketPrices, bankConnections, recurringExpenses, recurringIncomes, savingGoals, investmentGoals, targetMargin, categoryBudgets, onWithdrawal, onDelete, onPayRecurring, onReceiveRecurringIncome, onEdit
}) => {
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [incomeInputs, setIncomeInputs] = useState<Record<string, string>>({});
  const [isSyncingPortal, setIsSyncingPortal] = useState<string | null>(null);
  const [trendTimeframe, setTrendTimeframe] = useState<Timeframe>('monthly');
  const [trendCategory, setTrendCategory] = useState<string>('All');
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

  const portfolioFunds = useMemo(() => (Object.values(institutionalBalances) as InstitutionalBalance[]).filter(b => b.type === 'investment').reduce((acc: number, b) => acc + b.balance, 0), [institutionalBalances]);
  const netWorth: number = (Object.values(institutionalBalances) as InstitutionalBalance[]).reduce((acc: number, b) => acc + b.balance, 0);

  const trendData = useMemo(() => {
    const grouped: Record<string, number> = {};
    const filteredTransactions = transactions.filter(t => 
      t.type === 'expense' && (trendCategory === 'All' || t.category === trendCategory)
    );

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
  }, [transactions, trendTimeframe, trendCategory]);

  const settlementProgress = useMemo(() => {
    const totalItems = recurringIncomes.length + recurringExpenses.length;
    if (totalItems === 0) return 100;

    const incomesCleared = recurringIncomes.filter(inc => 
      transactions.some(t => t.recurringId === inc.id && new Date(t.date) >= cycleStartDate && t.type === 'income')
    ).length;

    const billsCleared = recurringExpenses.filter(bill => 
      transactions.some(t => t.recurringId === bill.id && new Date(t.date) >= cycleStartDate && t.type === 'expense')
    ).length;

    return ((incomesCleared + billsCleared) / totalItems) * 100;
  }, [recurringIncomes, recurringExpenses, transactions, cycleStartDate]);

  const totalMonthlyIncomes = useMemo(() => recurringIncomes.reduce((acc: number, i) => acc + i.amount, 0), [recurringIncomes]);
  const totalMonthlyExpenses = useMemo(() => recurringExpenses.reduce((acc: number, e) => acc + e.amount, 0) + (Object.values(categoryBudgets).reduce((a: number, b) => a + (Number(b) || 0), 0)), [recurringExpenses, categoryBudgets]);
  const savingsRate = useMemo(() => totalMonthlyIncomes === 0 ? 0 : ((totalMonthlyIncomes - totalMonthlyExpenses) / totalMonthlyIncomes) * 100, [totalMonthlyIncomes, totalMonthlyExpenses]);
  const burnRate = useMemo(() => totalMonthlyExpenses / 30, [totalMonthlyExpenses]);
  const runwayMonths = useMemo(() => burnRate > 0 ? (liquidFunds / (burnRate * 30)) : 0, [liquidFunds, burnRate]);

  const safetyMargin = liquidFunds;
  const { daysUntil25th, dailySpendLimit, cycleProgress } = useMemo(() => {
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() >= 25) target = new Date(now.getFullYear(), now.getMonth() + 1, 25);
    let start = new Date(target);
    start.setMonth(start.getMonth() - 1);
    const totalDuration = target.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const cycleProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const diff = target.getTime() - now.getTime();
    const safeDays = Math.max(1, Math.ceil(diff / 86400000));
    const dailySpendLimit = safetyMargin / safeDays;
    return { daysUntil25th: safeDays, dailySpendLimit: dailySpendLimit > 0 ? dailySpendLimit : 0, cycleProgress };
  }, [safetyMargin]);

  const investmentGoalProgress = useMemo(() => {
    return investmentGoals.map(goal => {
      let currentVal = 0;
      if (goal.provider === 'Binance' || goal.provider === 'Both') {
        currentVal += institutionalBalances['Binance']?.balance || 0;
      }
      if (goal.provider === 'Vanguard' || goal.provider === 'Both') {
        currentVal += institutionalBalances['Vanguard']?.balance || 0;
      }
      const percent = Math.min(100, (currentVal / goal.targetAmount) * 100);
      return { ...goal, currentVal, percent };
    });
  }, [investmentGoals, institutionalBalances]);

  const manualTransactions = useMemo(() => transactions.filter(t => !t.recurringId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [transactions]);

  useEffect(() => {
    const generateSummary = async () => {
      if (transactions.length < 1) { setAiInsight("Welcome! Start logging spend to unlock Gemini Insights."); return; }
      setIsGeneratingInsight(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const context = `Liquid Hub: $${liquidFunds.toFixed(2)}, Savings Rate: ${savingsRate.toFixed(1)}%, Burn: $${burnRate.toFixed(2)}, Runway: ${runwayMonths.toFixed(1)} mo.`;
        const response = await ai.models.generateContent({ 
          model: 'gemini-3-flash-preview', 
          contents: { parts: [{ text: `Context: ${context}\nAction: Provide one short, helpful financial tip based on these numbers.` }] }
        });
        setAiInsight(response.text || "Your portfolio is healthy.");
      } catch (e) { 
        console.error("Insight Error:", e);
        setAiInsight("Financial advisor is optimizing. Check back soon."); 
      } finally { 
        setIsGeneratingInsight(false); 
      }
    };
    generateSummary();
  }, [liquidFunds, netWorth, transactions.length]);

  const renderIncomeCard = (income: RecurringIncome) => {
    const receivedTotal = transactions.filter(t => t.recurringId === income.id && new Date(t.date) >= cycleStartDate && t.type === 'income').reduce((acc: number, t) => acc + t.amount, 0);
    const fullyReceived = receivedTotal >= income.amount;
    const currentInput = incomeInputs[income.id] || (income.amount - receivedTotal).toString();
    return (
      <div key={income.id} className={`p-5 border-2 rounded-[2rem] transition-all ${fullyReceived ? 'bg-emerald-50/30 border-emerald-100 opacity-60 scale-[0.98]' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${fullyReceived ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500 text-white shadow-lg'}`}><i className="fas fa-hand-holding-dollar"></i></div>
            <div><p className={`font-black text-sm ${fullyReceived ? 'text-slate-400' : 'text-slate-800'}`}>{income.description}</p><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{fullyReceived ? `Settled` : `the ${income.dayOfMonth}th`}</p></div>
          </div>
          <div className="text-right">
            <p className={`font-black text-base ${fullyReceived ? 'text-slate-300' : 'text-emerald-600'}`}>+${income.amount.toFixed(2)}</p>
          </div>
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

  const renderBillCard = (bill: RecurringExpense, isCompact: boolean = false) => {
    const paid = transactions.some(t => t.recurringId === bill.id && new Date(t.date) >= cycleStartDate && t.type === 'expense');
    const totalToPay = bill.amount + (bill.accumulatedOverdue || 0);
    const currentInput = paymentInputs[bill.id] || totalToPay.toString();
    const today = new Date();
    const isActive = today.getDate() >= bill.dayOfMonth || (bill.accumulatedOverdue || 0) > 0;
    return (
      <div key={bill.id} className={`p-6 border-2 transition-all duration-300 ${paid ? 'bg-slate-50/50 border-slate-100 opacity-70' : isActive ? 'bg-white border-indigo-100 shadow-md' : 'bg-slate-50 border-slate-100'} rounded-[2.5rem] group relative`}>
        <div className={`absolute top-4 right-6 flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] border px-3 py-1.5 rounded-full ${paid ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}><i className={`fas ${paid ? 'fa-check-circle' : 'fa-calendar-day'}`}></i> {paid ? 'Paid' : 'Due'}</div>
        <div className={`flex flex-col ${isCompact ? 'lg:flex-col' : 'lg:flex-row lg:items-center'} justify-between gap-6 mt-4`}>
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg ${paid ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white'}`}><i className={`fas ${bill.externalSyncEnabled ? 'fa-plug' : 'fa-file-invoice'}`}></i></div>
            <div><p className={`font-black text-base ${paid ? 'text-slate-400' : 'text-slate-800'}`}>{bill.description}</p><p className={`text-[10px] font-black uppercase tracking-widest text-slate-400`}>{paid ? `Settled` : `the ${bill.dayOfMonth}th`}</p></div>
          </div>
          <div className="flex items-center gap-4">
            <p className={`text-xl font-black ${paid ? 'text-slate-300' : 'text-slate-900'}`}>${totalToPay.toFixed(2)}</p>
            <div className={`flex items-center gap-2 p-2 rounded-2xl border ${paid ? 'bg-slate-100' : 'bg-slate-50 border-slate-200'}`}>
              <input type="number" step="0.01" disabled={paid} className="w-24 px-3 py-2 border-none rounded-xl text-xs font-black outline-none bg-white" value={paid ? '0.00' : currentInput} onChange={(e) => setPaymentInputs(prev => ({ ...prev, [bill.id]: e.target.value }))} />
              <button disabled={paid} onClick={() => { const amt = parseFloat(currentInput); if (!isNaN(amt) && amt > 0) { onPayRecurring(bill, amt); setPaymentInputs(prev => { const next = {...prev}; delete next[bill.id]; return next; }); } }} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all shadow-lg active:scale-95 ${paid ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-slate-900'}`}>{paid ? 'Paid' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 transition-transform group-hover:rotate-0"><i className="fas fa-brain text-white text-[120px]"></i></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span>
              <p className="text-white text-[10px] font-black uppercase tracking-[0.3em]">Gemini Strategic Advisor</p>
            </div>
            {isGeneratingInsight ? <div className="h-6 w-3/4 bg-white/5 animate-pulse rounded-lg"></div> : <h2 className="text-white text-lg md:text-xl font-medium leading-tight">"{aiInsight}"</h2>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white md:col-span-2 p-10 rounded-[3rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-start">
            <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3">Consolidated Net Worth</p><h2 className="text-5xl font-black text-slate-900 tracking-tight">${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2></div>
            <div className="text-right"><p className="text-indigo-600 text-[9px] font-black uppercase tracking-widest border border-indigo-100 px-3 py-1.5 rounded-full bg-indigo-50">Fiscal Cycle: 25th - 25th</p></div>
          </div>
          <div className="flex items-center gap-6 mt-10">
             <div className="bg-slate-50 px-5 py-4 rounded-[1.5rem] border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Liquid Hub</p><p className="text-xl font-black text-emerald-600">${liquidFunds.toLocaleString()}</p></div>
             <div className="bg-slate-50 px-5 py-4 rounded-[1.5rem] border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assets & Portfolio</p><p className="text-xl font-black text-indigo-600">${portfolioFunds.toLocaleString()}</p></div>
          </div>
        </div>
        <div className={`${safetyMargin >= 0 ? 'bg-indigo-600 shadow-indigo-100' : 'bg-rose-600 shadow-rose-100'} p-8 rounded-[3rem] shadow-xl text-white flex flex-col justify-center transition-colors duration-500 relative overflow-hidden`}>
           <div className="absolute top-2 right-6 p-4 opacity-10"><i className="fas fa-calendar-alt text-4xl"></i></div>
           <p className="text-white text-[10px] font-black uppercase tracking-widest mb-1">Monthly Net Margin</p>
           <h3 className="text-4xl font-black mb-4">${safetyMargin.toLocaleString()}</h3>
           <div className="mb-6"><div className="flex justify-between items-center mb-1.5 px-1"><p className="text-[8px] font-black text-white/60 uppercase">Cycle Runway</p><p className="text-[8px] font-black text-white/80 uppercase">{daysUntil25th} Days Remaining</p></div><div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: `${cycleProgress}%` }}></div></div></div>
           <div className="bg-black/10 rounded-[2rem] p-5 border border-white/10 backdrop-blur-sm shadow-inner"><div className="flex justify-between items-center mb-1"><p className="text-9px text-white font-black uppercase tracking-widest">Safe Daily Spend</p><span className="bg-white/20 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Limit</span></div><h4 className="text-3xl font-black text-white">${dailySpendLimit.toLocaleString('en-US', { maximumFractionDigits: 2 })}</h4></div>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center text-center"><div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4"><i className="fas fa-percentage"></i></div><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Savings Rate</h4><p className="text-3xl font-black text-slate-900">{savingsRate.toFixed(1)}%</p></div>
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center text-center"><div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4"><i className="fas fa-fire"></i></div><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Daily Burn Rate</h4><p className="text-3xl font-black text-slate-900">${burnRate.toFixed(2)}</p></div>
        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl flex flex-col items-center text-center"><div className="w-12 h-12 bg-white/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-4"><i className="fas fa-clock"></i></div><h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Financial Freedom Clock</h4><p className="text-3xl font-black text-white">{runwayMonths.toFixed(1)} <span className="text-sm text-white/40">Mo</span></p></div>
      </section>

      {investmentGoalProgress.length > 0 && (
        <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8"><div><h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Wealth Milestones</h3><p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Tracking Portfolio Growth Targets</p></div><i className="fas fa-trophy text-amber-400 text-xl"></i></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {investmentGoalProgress.map(goal => (
              <div key={goal.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div><p className="font-black text-sm text-slate-800">{goal.name}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{goal.provider} Link</p></div>
                  <p className="text-xs font-black text-indigo-600">{goal.percent.toFixed(0)}%</p>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-3"><div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${goal.percent}%` }}></div></div>
                <div className="flex justify-between items-center"><p className="text-[10px] font-black text-slate-900">${goal.currentVal.toLocaleString()}</p><p className="text-[10px] font-black text-slate-400">Target: ${goal.targetAmount.toLocaleString()}</p></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-10"><div><h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Spending Trends</h3><p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Interactive Cash Flow Analytics</p></div><div className="bg-slate-100 p-1 rounded-xl flex gap-1">{(['daily', 'weekly', 'monthly', 'yearly'] as Timeframe[]).map(tf => (<button key={tf} onClick={() => setTrendTimeframe(tf)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${trendTimeframe === tf ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tf}</button>))}</div></div>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}`} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={4} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-8"><div><h3 className="font-black uppercase text-xs tracking-[0.3em] text-white/80">Active Budgets</h3><p className="text-[10px] text-white/40 font-bold uppercase mt-1 tracking-widest">Target Limits This Cycle</p></div><i className="fas fa-bullseye text-indigo-400"></i></div>
          <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-1">{(Object.entries(categoryBudgets) as [string, number][]).filter(([_, limit]) => limit > 0).map(([cat, limit]) => {
              const actual = transactions.filter(t => t.category === cat && new Date(t.date) >= cycleStartDate).reduce((a: number, b) => a + b.amount, 0);
              const percent = Math.min(100, (actual / limit) * 100);
              return (<div key={cat} className="space-y-2"><div className="flex justify-between items-end"><div><p className="text-[10px] font-black text-white/90 uppercase tracking-widest">{cat}</p></div><div className="text-right"><p className={`text-xs font-black ${percent >= 90 ? 'text-rose-400' : 'text-indigo-400'}`}>${Math.max(0, limit - actual).toFixed(0)} left</p></div></div><div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5"><div className={`h-full transition-all duration-1000 ease-out ${percent >= 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${percent}%` }}></div></div></div>);
            })}</div>
        </section>
      </div>

      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-10"><div><h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Financial Activity Feed</h3><p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Cash & Digital Transaction Ledger</p></div></div>
        <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-2">{manualTransactions.map(t => (<div key={t.id} className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:shadow-lg transition-all group flex items-center justify-between"><div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg ${t.type === 'expense' ? 'bg-slate-200 text-slate-400' : t.type === 'transfer' ? 'bg-indigo-600' : 'bg-emerald-500'}`}><i className={`fas ${t.type === 'transfer' ? 'fa-exchange-alt' : 'fa-receipt'}`}></i></div><div><p className="font-black text-sm text-slate-800">{t.description}</p><div className="flex items-center gap-2"><span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{t.category}</span><span className="w-1 h-1 bg-slate-300 rounded-full"></span><span className={`text-[8px] font-black uppercase tracking-widest text-slate-400`}>{t.institution}{t.type === 'transfer' && ` → ${t.destinationInstitution}`}</span></div></div></div><div className="flex items-center gap-4"><div className="text-right"><p className={`font-black text-base ${t.type === 'expense' || t.type === 'transfer' ? 'text-slate-900' : 'text-emerald-600'}`}>{t.type === 'expense' || t.type === 'transfer' ? '-' : '+'}${t.amount.toFixed(2)}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.date}</p></div><button onClick={() => setTransactionToEdit(t)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-edit text-xs"></i></button></div></div>))}</div>
      </section>

      {transactionToEdit && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden p-2 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div><h2 className="text-xl font-black text-slate-800">Modify Entry</h2><p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Update Transaction Details</p></div>
              <div className="flex gap-2">
                <button onClick={() => { if(confirm('Delete?')) { onDelete(transactionToEdit.id); setTransactionToEdit(null); } }} className="w-10 h-10 flex items-center justify-center bg-white border border-rose-100 rounded-xl text-rose-400 hover:bg-rose-500 hover:text-white transition shadow-sm"><i className="fas fa-trash-alt"></i></button>
                <button onClick={() => setTransactionToEdit(null)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition"><i className="fas fa-times"></i></button>
              </div>
            </div>
            <TransactionForm bankConnections={bankConnections} initialData={transactionToEdit} onAdd={(t) => { onEdit({ ...t, id: transactionToEdit.id } as Transaction); setTransactionToEdit(null); }} onCancel={() => setTransactionToEdit(null)} />
          </div>
        </div>
      )}

      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-10"><div><h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Checklist & P&L Summary</h3><p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Verify All Recurring Incomes & Monthly Bills</p></div><div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Progress</p><p className={`text-sm font-black ${settlementProgress >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>{settlementProgress.toFixed(0)}% Cleared</p></div></div>
        <div className="w-full h-2 bg-slate-100 rounded-full mb-10 overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${settlementProgress}%` }}></div></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6"><h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] px-2">Incoming Cash Flow</h4>{recurringIncomes.map(income => renderIncomeCard(income))}</div>
          <div className="space-y-6"><h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] px-2">Monthly Bills</h4>{recurringExpenses.map(bill => renderBillCard(bill, true))}</div>
        </div>
      </section>

      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-10">Institutional Vaults</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(Object.entries(institutionalBalances) as [string, InstitutionalBalance][]).map(([name, data]) => (
            <div key={name} className={`p-6 bg-slate-50 border rounded-[2rem] transition-all flex flex-col gap-4 group ${data.isCash ? 'border-amber-200 ring-2 ring-amber-50' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg ${data.isCash ? 'bg-amber-500 shadow-amber-200' : data.available ? 'bg-emerald-500' : 'bg-slate-800'} shadow-lg`}><i className={`fas ${data.isCash ? 'fa-wallet' : data.type === 'investment' ? 'fa-chart-pie' : 'fa-building-columns'}`}></i></div>
                  <div><p className="font-black text-sm text-slate-800 truncate max-w-[120px]">{name}</p><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{data.type.replace('_', ' ')}</p></div>
                </div>
                <div className="text-right"><p className={`font-black text-base ${data.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>${data.balance.toLocaleString()}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
