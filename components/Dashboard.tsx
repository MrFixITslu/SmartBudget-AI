
import React, { useMemo, useState } from 'react';
import { Transaction, RecurringExpense, RecurringIncome, SavingGoal, InvestmentAccount, MarketPrice, BankConnection } from '../types';

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
  transactions, investments, marketPrices, bankConnections, recurringExpenses, recurringIncomes, onWithdrawal, onDelete, onPayRecurring
}) => {
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});

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
  const storedFunds = useMemo(() => (Object.values(institutionalBalances) as InstitutionalBalance[]).filter(b => b.type === 'credit_union').reduce((acc, b) => acc + b.balance, 0), [institutionalBalances]);
  const cryptoFunds = useMemo(() => (institutionalBalances['Binance'] as InstitutionalBalance | undefined)?.balance || 0, [institutionalBalances]);
  const portfolioFunds = useMemo(() => (Object.values(institutionalBalances) as InstitutionalBalance[]).filter(b => b.type === 'investment').reduce((acc, b) => acc + b.balance, 0), [institutionalBalances]);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Live Market Bar */}
      <div className="bg-slate-900 rounded-[1.5rem] p-3.5 flex items-center gap-6 overflow-hidden shadow-2xl border border-white/5">
        <div className="flex items-center gap-2.5 shrink-0 border-r border-white/10 pr-6">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Ticker Live</span>
        </div>
        <div className="flex gap-10 whitespace-nowrap overflow-x-auto no-scrollbar py-1">
          {marketPrices.map(m => (
            <div key={m.symbol} className="flex items-center gap-2.5 transition-opacity hover:opacity-80 cursor-default">
              <span className="text-[11px] font-black text-indigo-400">{m.symbol}</span>
              <span className="text-[11px] font-mono text-slate-300 font-bold">${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`text-[10px] font-black ${m.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {m.change24h >= 0 ? '▲' : '▼'}{Math.abs(m.change24h).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Required: Overdue Cards */}
      {totalOverdue > 0 && (
        <div className="bg-rose-50 border-2 border-rose-100 p-6 rounded-[2.5rem] flex items-center justify-between animate-pulse-soft">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-rose-200">
               <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div>
               <h4 className="text-sm font-black text-rose-800 uppercase tracking-widest">Overdue Payments Detected</h4>
               <p className="text-[10px] text-rose-500 font-bold uppercase">Total Debt: ${totalOverdue.toLocaleString()} added to current cycle</p>
            </div>
          </div>
          <button 
            className="px-6 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 transition shadow-lg shadow-rose-100"
          >
            Review Bills
          </button>
        </div>
      )}

      {/* Global Net Worth Card */}
      <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-16 opacity-[0.03] scale-150 transition-transform group-hover:scale-[1.6]">
           <i className="fas fa-gem text-[140px]"></i>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3">Consolidated Net Worth</p>
            <h2 className="text-5xl font-black tracking-tight">${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <div className="flex items-center gap-4 mt-6">
               <div className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Liquid: ${liquidFunds.toLocaleString()}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Ratio: {netWorth > 0 ? (((portfolioFunds)/netWorth)*100).toFixed(0) : 0}% Growth</span>
               </div>
            </div>
          </div>
          <div className="flex md:flex-col gap-3">
             <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-500 uppercase">Crypto</p>
                <p className="text-sm font-black text-indigo-400">${cryptoFunds.toLocaleString()}</p>
             </div>
             <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-500 uppercase">Stored</p>
                <p className="text-sm font-black text-emerald-400">${storedFunds.toLocaleString()}</p>
             </div>
          </div>
        </div>
      </div>

      {/* Monthly Commitment Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Commitment Flow</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Including Accumulated Debt</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${safetyMargin >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              Margin: ${safetyMargin.toLocaleString()}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monthly Income</p>
              <p className="text-xl font-black text-emerald-600">${totalMonthlyRecurringIncome.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Commitment + Debt</p>
              <p className="text-xl font-black text-rose-600">${(totalMonthlyRecurringExpenses + totalOverdue).toLocaleString()}</p>
            </div>
          </div>
          
          <div className="mt-6 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
             <div 
               className="h-full bg-rose-500" 
               style={{ width: `${Math.min(100, totalMonthlyRecurringIncome > 0 ? ((totalMonthlyRecurringExpenses + totalOverdue) / totalMonthlyRecurringIncome) * 100 : 100)}%` }}
             ></div>
          </div>
        </div>

        {/* Updated Uncommitted Cash Card to show the Safety Margin as requested */}
        <div className={`${safetyMargin >= 0 ? 'bg-indigo-600' : 'bg-rose-600'} p-7 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-center transition-colors duration-500`}>
           <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Monthly Net Margin</p>
           <h3 className="text-3xl font-black">${safetyMargin.toLocaleString()}</h3>
           <p className="text-[9px] text-white/40 font-bold uppercase mt-2 tracking-widest">
             {safetyMargin >= 0 ? 'Projected Monthly Surplus' : 'Projected Monthly Deficit'}
           </p>
        </div>
      </section>

      {/* Institutional Breakdown */}
      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Institutional Channels</h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Real-time Sync Active</span>
          </div>
        </div>
        <div className="space-y-5">
          {(Object.entries(institutionalBalances) as [string, InstitutionalBalance][]).map(([name, data]) => (
            <div key={name} className="group flex flex-col p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:ring-2 hover:ring-indigo-100/50 transition-all shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg transition-transform group-hover:scale-110 ${data.available ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                    <i className={`fas ${data.type === 'investment' ? 'fa-chart-pie' : data.type === 'credit_union' ? 'fa-users' : 'fa-building-columns'}`}></i>
                  </div>
                  <div>
                    <p className="font-black text-base text-slate-800">{name}</p>
                    <div className="flex items-center gap-2 mt-1">
                       <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${data.available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                          {data.type.replace('_', ' ')}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-xl text-slate-900">${data.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Ledger Balance</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bill Sync Status (Specifically for LUCELEC as mentioned) */}
      {recurringExpenses.some(r => r.externalSyncEnabled) && (
        <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-8">External Smart Syncs</h3>
          <div className="space-y-4">
            {recurringExpenses.filter(r => r.externalSyncEnabled).map(bill => (
              <div key={bill.id} className="flex items-center justify-between p-5 bg-indigo-50/30 rounded-[1.5rem] border border-indigo-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <i className="fas fa-plug"></i>
                  </div>
                  <div>
                    <p className="font-black text-sm text-slate-800">{bill.description}</p>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Current Balance: NeilV Sync Active</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm text-slate-900">${(bill.amount + bill.accumulatedOverdue).toFixed(2)}</p>
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">Verified</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Latest Ledger Activity */}
      <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-8">Recent Flow</h3>
        <div className="space-y-4">
          {transactions.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] group hover:bg-white hover:ring-2 hover:ring-indigo-50 transition-all border border-transparent">
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${t.type === 'income' ? 'bg-emerald-500 shadow-emerald-50' : 'bg-rose-500 shadow-rose-50'} shadow-lg`}>
                  <i className={`fas ${t.type === 'income' ? 'fa-plus' : 'fa-minus'} text-sm`}></i>
                </div>
                <div>
                  <p className="font-black text-sm text-slate-800">{t.description}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t.institution || 'Ledger'} • {t.category} • {t.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <p className={`font-black text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                </p>
                <button onClick={() => onDelete(t.id)} className="w-9 h-9 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                  <i className="fas fa-trash-alt text-[11px]"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
