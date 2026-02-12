
import React, { useState } from 'react';
import { CATEGORIES, RecurringExpense, RecurringIncome, SavingGoal, BankConnection, InvestmentGoal } from '../types';

interface Props {
  salary: number;
  onUpdateSalary: (val: number) => void;
  targetMargin: number;
  onUpdateTargetMargin: (val: number) => void;
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (budgets: Record<string, number>) => void;
  recurringExpenses: RecurringExpense[];
  onAddRecurring: (item: Omit<RecurringExpense, 'id' | 'accumulatedOverdue'>) => void;
  onUpdateRecurring: (item: RecurringExpense) => void;
  onDeleteRecurring: (id: string) => void;
  recurringIncomes: RecurringIncome[];
  onAddRecurringIncome: (item: Omit<RecurringIncome, 'id'>) => void;
  onUpdateRecurringIncome: (item: RecurringIncome) => void;
  onDeleteRecurringIncome: (id: string) => void;
  savingGoals: SavingGoal[];
  onAddSavingGoal: (item: Omit<SavingGoal, 'id' | 'currentAmount'>) => void;
  onDeleteSavingGoal: (id: string) => void;
  investmentGoals: InvestmentGoal[];
  onAddInvestmentGoal: (item: Omit<InvestmentGoal, 'id'>) => void;
  onDeleteInvestmentGoal: (id: string) => void;
  onExportData: () => void;
  onResetData: () => void;
  onClose: () => void;
  onLogout: () => void;
  remindersEnabled: boolean;
  onToggleReminders: (enabled: boolean) => void;
  currentBank: BankConnection;
  onResetBank: () => void;
  onSetDirectory: (handle: FileSystemDirectoryHandle | null) => void;
  directoryHandle: FileSystemDirectoryHandle | null;
}

const Settings: React.FC<Props> = ({ 
  targetMargin, onUpdateTargetMargin, categoryBudgets, onUpdateCategoryBudgets, 
  recurringExpenses, onAddRecurring, onUpdateRecurring, onDeleteRecurring, 
  recurringIncomes, onAddRecurringIncome, onUpdateRecurringIncome, onDeleteRecurringIncome, 
  investmentGoals, onAddInvestmentGoal, onDeleteInvestmentGoal,
  onExportData, onResetData, onClose, onLogout, remindersEnabled, onToggleReminders,
  onSetDirectory, directoryHandle
}) => {
  const [editingBill, setEditingBill] = useState<RecurringExpense | null>(null);
  const [editingIncome, setEditingIncome] = useState<RecurringIncome | null>(null);
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [billForm, setBillForm] = useState({ desc: '', amount: '', category: 'Utilities', day: '1', sync: false });
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [incForm, setIncForm] = useState({ desc: '', amount: '', category: 'Income', day: '25' });

  // Investment Goal Form
  const [isAddingInvGoal, setIsAddingInvGoal] = useState(false);
  const [invGoalForm, setInvGoalForm] = useState({ name: '', target: '', provider: 'Both' as const });

  const handleBudgetChange = (category: string, value: string) => {
    onUpdateCategoryBudgets({ ...categoryBudgets, [category]: parseFloat(value) || 0 });
  };

  const handleSetLocalVault = async () => {
    try {
      // Modern browsers support showDirectoryPicker directly
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        onSetDirectory(handle);
      } else {
        alert("The File System Access API is not supported by your browser. Please use a modern Chromium-based browser.");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Directory access denied", err);
        alert("Failed to access directory: " + err.message);
      }
    }
  };

  const saveInvGoal = () => {
    const target = parseFloat(invGoalForm.target);
    if (!invGoalForm.name || isNaN(target)) return;
    onAddInvestmentGoal({
      name: invGoalForm.name,
      targetAmount: target,
      provider: invGoalForm.provider as 'Binance' | 'Vanguard' | 'Both'
    });
    setInvGoalForm({ name: '', target: '', provider: 'Both' });
    setIsAddingInvGoal(false);
  };

  const handleEditBill = (bill: RecurringExpense) => {
    setEditingBill(bill);
    setBillForm({
      desc: bill.description,
      amount: bill.amount.toString(),
      category: bill.category,
      day: bill.dayOfMonth.toString(),
      sync: !!bill.externalSyncEnabled
    });
    setIsAddingBill(true);
  };

  const handleEditIncome = (income: RecurringIncome) => {
    setEditingIncome(income);
    setIncForm({
      desc: income.description,
      amount: income.amount.toString(),
      category: income.category,
      day: income.dayOfMonth.toString()
    });
    setIsAddingIncome(true);
  };

  const saveBill = () => {
    const amt = parseFloat(billForm.amount);
    const day = parseInt(billForm.day);
    if (!billForm.desc || isNaN(amt) || isNaN(day)) return;
    const nextDue = new Date();
    nextDue.setDate(day);
    if (nextDue < new Date()) nextDue.setMonth(nextDue.getMonth() + 1);
    
    if (editingBill) {
      onUpdateRecurring({ 
        ...editingBill, 
        description: billForm.desc, 
        amount: amt, 
        category: billForm.category, 
        dayOfMonth: day, 
        nextDueDate: nextDue.toISOString().split('T')[0], 
        externalSyncEnabled: billForm.sync 
      });
    } else {
      onAddRecurring({ 
        description: billForm.desc, 
        amount: amt, 
        category: billForm.category, 
        dayOfMonth: day, 
        nextDueDate: nextDue.toISOString().split('T')[0], 
        externalSyncEnabled: billForm.sync 
      });
    }
    resetBillForm();
  };

  const resetBillForm = () => {
    setEditingBill(null);
    setIsAddingBill(false);
    setBillForm({ desc: '', amount: '', category: 'Utilities', day: '1', sync: false });
  };

  const saveIncome = () => {
    const amt = parseFloat(incForm.amount);
    const day = parseInt(incForm.day);
    if (!incForm.desc || isNaN(amt) || isNaN(day)) return;
    const nextConf = new Date();
    nextConf.setDate(day);
    if (nextConf < new Date()) nextConf.setMonth(nextConf.getMonth() + 1);
    
    if (editingIncome) {
      onUpdateRecurringIncome({ 
        ...editingIncome, 
        description: incForm.desc, 
        amount: amt, 
        category: incForm.category, 
        dayOfMonth: day, 
        nextConfirmationDate: nextConf.toISOString().split('T')[0] 
      });
    } else {
      onAddRecurringIncome({ 
        description: incForm.desc, 
        amount: amt, 
        category: incForm.category, 
        dayOfMonth: day, 
        nextConfirmationDate: nextConf.toISOString().split('T')[0] 
      });
    }
    resetIncForm();
  };

  const resetIncForm = () => {
    setEditingIncome(null);
    setIsAddingIncome(false);
    setIncForm({ desc: '', amount: '', category: 'Income', day: '25' });
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div><h2 className="text-2xl font-black text-slate-800">Configurations</h2><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Setup Due Dates & Syncs</p></div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-800 transition shadow-sm"><i className="fas fa-times text-xl"></i></button>
        </div>

        <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar flex-1">
          <section className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 space-y-4">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><i className="fas fa-folder-open"></i></div>
                <div><h3 className="text-sm font-black text-slate-800">Local Hard Drive Vault</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Save Project Files to a specific folder</p></div>
              </div>
              <button 
                onClick={handleSetLocalVault}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${directoryHandle ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white shadow-lg'}`}
              >
                {directoryHandle ? 'Vault Linked' : 'Connect Folder'}
              </button>
            </div>
            {directoryHandle && <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest bg-emerald-50 p-2 rounded-lg text-center"><i className="fas fa-shield-check mr-1"></i> Native File System Sync Enabled</p>}
          </section>

          <section className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><i className="fas fa-bell"></i></div>
                <div><h3 className="text-sm font-black text-slate-800">Daily Desktop Reminders</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Notification Alert for Data Entry</p></div>
              </div>
              <button onClick={() => onToggleReminders(!remindersEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${remindersEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${remindersEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
            </div>
          </section>

          <section className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Financial Strategy Hub</label>
            <div className="space-y-8">
               <div><h3 className="text-lg font-black mb-1">Monthly Target Surplus</h3><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-400 text-lg">$</span><input type="number" value={targetMargin || ''} onChange={(e) => onUpdateTargetMargin(parseFloat(e.target.value) || 0)} className="w-full pl-10 p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-xl text-white placeholder:text-white/10" /></div></div>
               <div className="pt-4 border-t border-white/10"><h3 className="text-lg font-black mb-1">Monthly Category Limits</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{CATEGORIES.filter(c => !['Income', 'Savings', 'Investments', 'Other'].includes(c)).map(cat => (<div key={cat} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/10 transition-colors"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat}</p><div className="relative"><span className="absolute left-0 top-1/2 -translate-y-1/2 font-black text-indigo-400 text-xs">$</span><input type="number" value={categoryBudgets[cat] || ''} onChange={(e) => handleBudgetChange(cat, e.target.value)} className="bg-transparent border-none p-0 pl-3 outline-none font-black text-sm text-white w-24" /></div></div><div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors"><i className="fas fa-bullseye text-[10px]"></i></div></div>))}</div></div>
            </div>
          </section>

          {/* Investment Goals Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h3 className="text-lg font-black text-slate-800">Investment Milestones</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Wealth Targets & Retirement Goals</p></div>
              <button onClick={() => setIsAddingInvGoal(true)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition">+ Add Goal</button>
            </div>
            <div className="space-y-4">
              {investmentGoals.map(goal => (
                <div key={goal.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><i className="fas fa-bullseye"></i></div>
                    <div><p className="font-black text-sm text-slate-800">{goal.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase">Target: ${goal.targetAmount.toLocaleString()} • Source: {goal.provider}</p></div>
                  </div>
                  <button onClick={() => onDeleteInvestmentGoal(goal.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 transition flex items-center justify-center"><i className="fas fa-trash-alt text-[10px]"></i></button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h3 className="text-lg font-black text-slate-800">Recurring Commitments</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manage Bills & Regular Income</p></div>
              <div className="flex gap-2">
                <button onClick={() => { resetIncForm(); setIsAddingIncome(true); }} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition">+ Income</button>
                <button onClick={() => { resetBillForm(); setIsAddingBill(true); }} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition">+ Bill</button>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Recurring Incomes List */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expected Incomes</p>
                {recurringIncomes.map(income => (
                  <div key={income.id} className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm"><i className="fas fa-hand-holding-dollar"></i></div>
                      <div>
                        <p className="font-black text-sm text-slate-800">{income.description}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Received the {income.dayOfMonth}th • ${income.amount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditIncome(income)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 transition flex items-center justify-center"><i className="fas fa-edit text-[10px]"></i></button>
                      <button onClick={() => onDeleteRecurringIncome(income.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 transition flex items-center justify-center"><i className="fas fa-trash-alt text-[10px]"></i></button>
                    </div>
                  </div>
                ))}
                {recurringIncomes.length === 0 && <p className="text-[10px] italic text-slate-300 font-bold uppercase tracking-widest ml-2">No recurring incomes setup</p>}
              </div>

              {/* Recurring Bills List */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Active Bills</p>
                {recurringExpenses.map(bill => (
                  <div key={bill.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm"><i className="fas fa-file-invoice"></i></div>
                      <div>
                        <p className="font-black text-sm text-slate-800">{bill.description}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Due the {bill.dayOfMonth}th • ${bill.amount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditBill(bill)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition flex items-center justify-center"><i className="fas fa-edit text-[10px]"></i></button>
                      <button onClick={() => onDeleteRecurring(bill.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 transition flex items-center justify-center"><i className="fas fa-trash-alt text-[10px]"></i></button>
                    </div>
                  </div>
                ))}
                {recurringExpenses.length === 0 && <p className="text-[10px] italic text-slate-300 font-bold uppercase tracking-widest ml-2">No recurring bills setup</p>}
              </div>
            </div>
          </section>

          <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
             <div><h3 className="text-sm font-black text-slate-800">Data Management</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Local JSON State Portability</p></div>
             <div className="flex gap-3">
                <button onClick={onExportData} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition">Export JSON</button>
                <button onClick={onResetData} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 transition">Purge Store</button>
             </div>
          </section>

          <section className="pt-6 border-t border-slate-100 space-y-4">
            <button onClick={onLogout} className="w-full py-5 bg-rose-50 text-rose-600 font-black rounded-2xl text-xs uppercase tracking-[0.2em] hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-100"><i className="fas fa-sign-out-alt mr-2"></i> Terminate Session</button>
          </section>
        </div>
      </div>

      {/* Investment Goal Modal */}
      {isAddingInvGoal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-6">New Wealth Target</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Goal Name</label><input value={invGoalForm.name} onChange={e => setInvGoalForm({...invGoalForm, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" placeholder="Retirement Fund" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Amount ($)</label><input type="number" value={invGoalForm.target} onChange={e => setInvGoalForm({...invGoalForm, target: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" placeholder="500000" /></div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linked Provider</label>
                <select value={invGoalForm.provider} onChange={e => setInvGoalForm({...invGoalForm, provider: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
                  <option value="Binance">Binance (Crypto)</option>
                  <option value="Vanguard">Vanguard (Stocks)</option>
                  <option value="Both">Both Portfolio Aggregator</option>
                </select>
              </div>
              <button onClick={saveInvGoal} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-indigo-600 transition">Create Target</button>
              <button onClick={() => setIsAddingInvGoal(false)} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Bill Form Modal */}
      {isAddingBill && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-6">{editingBill ? 'Edit Bill' : 'New Recurring Bill'}</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label><input value={billForm.desc} onChange={e => setBillForm({...billForm, desc: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label><input type="number" value={billForm.amount} onChange={e => setBillForm({...billForm, amount: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Day of Month</label><input type="number" min="1" max="31" value={billForm.day} onChange={e => setBillForm({...billForm, day: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              </div>
              <button onClick={saveBill} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-slate-900 transition">
                {editingBill ? 'Update Commitment' : 'Save Commitment'}
              </button>
              <button onClick={resetBillForm} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Income Form Modal */}
      {isAddingIncome && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-6">{editingIncome ? 'Edit Income' : 'New Recurring Income'}</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label><input value={incForm.desc} onChange={e => setIncForm({...incForm, desc: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label><input type="number" value={incForm.amount} onChange={e => setIncForm({...incForm, amount: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Day of Month</label><input type="number" min="1" max="31" value={incForm.day} onChange={e => setIncForm({...incForm, day: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              </div>
              <button onClick={saveIncome} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-slate-900 transition">
                {editingIncome ? 'Update Commitment' : 'Save Commitment'}
              </button>
              <button onClick={resetIncForm} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
