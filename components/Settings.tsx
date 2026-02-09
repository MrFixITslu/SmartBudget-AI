
import React, { useState } from 'react';
import { CATEGORIES, RecurringExpense, RecurringIncome, SavingGoal, BankConnection } from '../types';

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
  onExportData: () => void;
  onResetData: () => void;
  onClose: () => void;
  onLogout: () => void;
  remindersEnabled: boolean;
  onToggleReminders: (enabled: boolean) => void;
  currentBank: BankConnection;
  onResetBank: () => void;
}

const Settings: React.FC<Props> = ({ 
  targetMargin, onUpdateTargetMargin, categoryBudgets, onUpdateCategoryBudgets, recurringExpenses, onAddRecurring, onUpdateRecurring, onDeleteRecurring, recurringIncomes, onAddRecurringIncome, onUpdateRecurringIncome, onDeleteRecurringIncome, savingGoals, onAddSavingGoal, onDeleteSavingGoal, onExportData, onResetData, onClose, onLogout, remindersEnabled, onToggleReminders
}) => {
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [billDesc, setBillDesc] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billCategory, setBillCategory] = useState('Utilities');
  const [billDueDate, setBillDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [externalSync, setExternalSync] = useState(false);

  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [incDesc, setIncDesc] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incConfirmDate, setIncConfirmDate] = useState(new Date().toISOString().split('T')[0]);

  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  const handleBudgetChange = (category: string, value: string) => {
    onUpdateCategoryBudgets({ ...categoryBudgets, [category]: parseFloat(value) || 0 });
  };

  const handleReminderToggle = (enabled: boolean) => {
    if (enabled) {
      if ("Notification" in window) {
        window.Notification.requestPermission().then(permission => {
          if (permission === "granted") onToggleReminders(true);
          else alert("Notification permission denied. Please enable them in browser settings.");
        });
      } else alert("This browser does not support desktop notifications.");
    } else onToggleReminders(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div><h2 className="text-2xl font-black text-slate-800">Configurations</h2><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Setup Due Dates & Syncs</p></div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-800 transition shadow-sm"><i className="fas fa-times text-xl"></i></button>
        </div>

        <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar flex-1">
          <section className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><i className="fas fa-bell"></i></div>
                <div><h3 className="text-sm font-black text-slate-800">Daily Desktop Reminders</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Notification Alert for Data Entry</p></div>
              </div>
              <button onClick={() => handleReminderToggle(!remindersEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${remindersEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${remindersEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
            </div>
          </section>

          <section className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Financial Strategy Hub</label>
            <div className="space-y-8">
               <div><h3 className="text-lg font-black mb-1">Monthly Target Surplus</h3><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-400 text-lg">$</span><input type="number" value={targetMargin || ''} onChange={(e) => onUpdateTargetMargin(parseFloat(e.target.value) || 0)} className="w-full pl-10 p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-xl text-white placeholder:text-white/10" /></div></div>
               <div className="pt-4 border-t border-white/10"><h3 className="text-lg font-black mb-1">Monthly Category Limits</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{CATEGORIES.filter(c => !['Income', 'Savings', 'Investments', 'Other'].includes(c)).map(cat => (<div key={cat} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/10 transition-colors"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat}</p><div className="relative"><span className="absolute left-0 top-1/2 -translate-y-1/2 font-black text-indigo-400 text-xs">$</span><input type="number" value={categoryBudgets[cat] || ''} onChange={(e) => handleBudgetChange(cat, e.target.value)} className="bg-transparent border-none p-0 pl-3 outline-none font-black text-sm text-white w-24" /></div></div><div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors"><i className="fas fa-bullseye text-[10px]"></i></div></div>))}</div></div>
            </div>
          </section>

          <section className="pt-6 border-t border-slate-100 space-y-4"><button onClick={onLogout} className="w-full py-5 bg-rose-50 text-rose-600 font-black rounded-2xl text-xs uppercase tracking-[0.2em] hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-100"><i className="fas fa-sign-out-alt mr-2"></i> Terminate Session</button></section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
