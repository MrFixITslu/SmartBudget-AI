import React, { useState } from 'react';
import { CATEGORIES, RecurringExpense, RecurringIncome, SavingGoal, BankConnection } from '../types';

interface Props {
  salary: number;
  onUpdateSalary: (val: number) => void;
  recurringExpenses: RecurringExpense[];
  onAddRecurring: (item: Omit<RecurringExpense, 'id' | 'balance'>) => void;
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
  currentBank: BankConnection;
  onResetBank: () => void;
}

const Settings: React.FC<Props> = ({ 
  salary, 
  onUpdateSalary, 
  recurringExpenses, 
  onAddRecurring, 
  onUpdateRecurring,
  onDeleteRecurring,
  recurringIncomes,
  onAddRecurringIncome,
  onUpdateRecurringIncome,
  onDeleteRecurringIncome,
  savingGoals,
  onAddSavingGoal,
  onDeleteSavingGoal,
  onExportData,
  onResetData,
  onClose,
  currentBank,
  onResetBank
}) => {
  const [tempSalary, setTempSalary] = useState(salary.toString());
  const [isSalarySaved, setIsSalarySaved] = useState(false);
  
  // Recurring Bill Form State
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringExpense | null>(null);
  const [billDesc, setBillDesc] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billCategory, setBillCategory] = useState(CATEGORIES[0]);
  const [billDay, setBillDay] = useState('1');

  // Recurring Income Form State
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [editingIncome, setEditingIncome] = useState<RecurringIncome | null>(null);
  const [incDesc, setIncDesc] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incCategory, setIncCategory] = useState('Income');
  const [incDay, setIncDay] = useState('1');

  // Savings Goal Form State
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalInstitution, setGoalInstitution] = useState('');
  const [goalInstitutionType, setGoalInstitutionType] = useState<'bank' | 'credit_union'>('bank');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalOpening, setGoalOpening] = useState('0');

  const resetBillForm = () => {
    setBillDesc('');
    setBillAmount('');
    setBillCategory(CATEGORIES[0]);
    setBillDay('1');
    setIsAddingBill(false);
    setEditingBill(null);
  };

  const resetIncomeForm = () => {
    setIncDesc('');
    setIncAmount('');
    setIncCategory('Income');
    setIncDay('1');
    setIsAddingIncome(false);
    setEditingIncome(null);
  };

  const handleBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(billAmount);
    const day = parseInt(billDay);
    if (isNaN(amount) || isNaN(day) || !billDesc) return;

    if (editingBill) {
      onUpdateRecurring({
        ...editingBill,
        description: billDesc,
        amount: amount,
        category: billCategory,
        dayOfMonth: day,
        balance: amount
      });
    } else {
      onAddRecurring({
        description: billDesc,
        amount: amount,
        category: billCategory,
        dayOfMonth: day
      });
    }
    resetBillForm();
  };

  const handleIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(incAmount);
    const day = parseInt(incDay);
    if (isNaN(amount) || isNaN(day) || !incDesc) return;

    if (editingIncome) {
      onUpdateRecurringIncome({
        ...editingIncome,
        description: incDesc,
        amount: amount,
        category: incCategory,
        dayOfMonth: day
      });
    } else {
      onAddRecurringIncome({
        description: incDesc,
        amount: amount,
        category: incCategory,
        dayOfMonth: day
      });
    }
    resetIncomeForm();
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(goalTarget);
    const opening = parseFloat(goalOpening);
    if (isNaN(target) || !goalName) return;

    onAddSavingGoal({
      name: goalName,
      institution: goalInstitution || (goalInstitutionType === 'bank' ? 'Commercial Bank' : 'Credit Union'),
      institutionType: goalInstitutionType,
      targetAmount: target,
      openingBalance: isNaN(opening) ? 0 : opening,
      category: 'Savings'
    });

    setGoalName('');
    setGoalInstitution('');
    setGoalTarget('');
    setGoalOpening('0');
    setIsAddingGoal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Configurations</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Setup Your Accounts</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-800 transition shadow-sm">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Recurring Incomes Section */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Income Streams</label>
                <h3 className="text-lg font-black text-slate-800">Recurring Incomes</h3>
              </div>
              <button 
                onClick={() => setIsAddingIncome(!isAddingIncome)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition ${isAddingIncome ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}
              >
                {isAddingIncome ? 'Cancel' : 'Add Income'}
              </button>
            </div>

            {isAddingIncome && (
              <form onSubmit={handleIncomeSubmit} className="mb-6 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Label</label>
                    <input type="text" value={incDesc} onChange={(e) => setIncDesc(e.target.value)} placeholder="e.g. Salary" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Amount</label>
                    <input type="number" step="0.01" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} placeholder="0.00" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Day of Month</label>
                    <input type="number" min="1" max="31" value={incDay} onChange={(e) => setIncDay(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-100 uppercase tracking-widest text-[10px]">
                  {editingIncome ? 'Update Income' : 'Save Income'}
                </button>
              </form>
            )}

            <div className="space-y-3">
              {recurringIncomes.map(inc => (
                <div key={inc.id} className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm"><i className="fas fa-arrow-up"></i></div>
                    <div><p className="font-black text-xs text-slate-800">{inc.description}</p><p className="text-[10px] text-slate-400 font-bold uppercase">Day {inc.dayOfMonth}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-black text-xs text-emerald-600">${inc.amount.toFixed(2)}</p>
                    <button onClick={() => onDeleteRecurringIncome(inc.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt text-xs"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recurring Bills Section */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Expenses</label>
                <h3 className="text-lg font-black text-slate-800">Recurring Bills</h3>
              </div>
              <button 
                onClick={() => setIsAddingBill(!isAddingBill)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition ${isAddingBill ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}
              >
                {isAddingBill ? 'Cancel' : 'Add Bill'}
              </button>
            </div>

            {isAddingBill && (
              <form onSubmit={handleBillSubmit} className="mb-6 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bill Name</label>
                    <input type="text" value={billDesc} onChange={(e) => setBillDesc(e.target.value)} placeholder="e.g. Electricity" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Amount</label>
                    <input type="number" step="0.01" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="0.00" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Day of Month</label>
                    <input type="number" min="1" max="31" value={billDay} onChange={(e) => setBillDay(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Category</label>
                    <select value={billCategory} onChange={(e) => setBillCategory(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-slate-900 text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                  {editingBill ? 'Update Bill' : 'Save Bill'}
                </button>
              </form>
            )}

            <div className="space-y-3">
              {recurringExpenses.map(bill => (
                <div key={bill.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shadow-sm"><i className="fas fa-file-invoice"></i></div>
                    <div><p className="font-black text-xs text-slate-800">{bill.description}</p><p className="text-[10px] text-slate-400 font-bold uppercase">Day {bill.dayOfMonth} • {bill.category}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-black text-xs text-rose-600">${bill.amount.toFixed(2)}</p>
                    <button onClick={() => onDeleteRecurring(bill.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt text-xs"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Savings Goals Section */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Wealth Building</label>
                <h3 className="text-lg font-black text-slate-800">Savings & Vaults</h3>
              </div>
              <button 
                onClick={() => setIsAddingGoal(!isAddingGoal)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition ${isAddingGoal ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}
              >
                {isAddingGoal ? 'Cancel' : 'New Goal'}
              </button>
            </div>

            {isAddingGoal && (
              <form onSubmit={handleGoalSubmit} className="mb-6 p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Goal Name</label>
                    <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g. Rainy Day Fund" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Type</label>
                    <select 
                      value={goalInstitutionType} 
                      onChange={(e) => setGoalInstitutionType(e.target.value as any)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                    >
                      <option value="bank">Commercial Bank</option>
                      <option value="credit_union">Credit Union</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Institution Name</label>
                    <input type="text" value={goalInstitution} onChange={(e) => setGoalInstitution(e.target.value)} placeholder="e.g. 1st National" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Target Amount</label>
                    <input type="number" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="0.00" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Starting Balance</label>
                    <input type="number" value={goalOpening} onChange={(e) => setGoalOpening(e.target.value)} placeholder="0.00" className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-black text-sm text-emerald-800" />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-slate-900 text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                  Save Savings Goal
                </button>
              </form>
            )}

            <div className="space-y-3">
              {savingGoals.map(goal => (
                <div key={goal.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${goal.institutionType === 'credit_union' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'} rounded-xl flex items-center justify-center shadow-sm`}>
                      <i className={`fas ${goal.institutionType === 'credit_union' ? 'fa-users' : 'fa-university'}`}></i>
                    </div>
                    <div>
                      <p className="font-black text-xs text-slate-800">{goal.name}</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase">{goal.institution} • {goal.institutionType.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-black text-xs text-indigo-600">${goal.currentAmount.toLocaleString()}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">of ${goal.targetAmount.toLocaleString()}</p>
                    </div>
                    <button onClick={() => onDeleteSavingGoal(goal.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt text-[10px]"></i></button>
                  </div>
                </div>
              ))}
              {savingGoals.length === 0 && (
                <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Savings Configured</p>
                </div>
              )}
            </div>
          </section>

          {/* Export / Danger Area */}
          <section className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
            <button onClick={onExportData} className="py-4 bg-slate-100 text-slate-600 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition">
              <i className="fas fa-download mr-2"></i> Export CSV
            </button>
            <button onClick={onResetData} className="py-4 bg-rose-50 text-rose-600 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-rose-100 transition">
              <i className="fas fa-exclamation-triangle mr-2"></i> Reset App
            </button>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Settings;