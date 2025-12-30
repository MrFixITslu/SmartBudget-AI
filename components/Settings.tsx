
import React, { useState } from 'react';
import { CATEGORIES, RecurringExpense, SavingGoal } from '../types';

interface Props {
  salary: number;
  onUpdateSalary: (val: number) => void;
  recurringExpenses: RecurringExpense[];
  onAddRecurring: (item: Omit<RecurringExpense, 'id'>) => void;
  onDeleteRecurring: (id: string) => void;
  savingGoals: SavingGoal[];
  onAddSavingGoal: (item: Omit<SavingGoal, 'id' | 'currentAmount'>) => void;
  onDeleteSavingGoal: (id: string) => void;
  onClose: () => void;
}

const Settings: React.FC<Props> = ({ 
  salary, 
  onUpdateSalary, 
  recurringExpenses, 
  onAddRecurring, 
  onDeleteRecurring,
  savingGoals,
  onAddSavingGoal,
  onDeleteSavingGoal,
  onClose 
}) => {
  const [tempSalary, setTempSalary] = useState(salary.toString());
  const [isSalarySaved, setIsSalarySaved] = useState(false);
  
  // Recurring Expense State
  const [newRecAmount, setNewRecAmount] = useState('');
  const [newRecDesc, setNewRecDesc] = useState('');
  const [newRecDay, setNewRecDay] = useState('1');
  const [newRecCat, setNewRecCat] = useState(CATEGORIES[0]);

  // Saving Goal State
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalOpening, setNewGoalOpening] = useState('0');
  const [newGoalCat, setNewGoalCat] = useState(CATEGORIES[0]);

  const handleSalaryConfirm = () => {
    const val = parseFloat(tempSalary) || 0;
    onUpdateSalary(val);
    setIsSalarySaved(true);
    setTimeout(() => setIsSalarySaved(false), 2000);
  };

  const handleAddRec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecAmount || !newRecDesc) return;
    onAddRecurring({
      amount: parseFloat(newRecAmount),
      description: newRecDesc,
      dayOfMonth: parseInt(newRecDay),
      category: newRecCat,
      balance: 0
    });
    setNewRecAmount('');
    setNewRecDesc('');
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName || !newGoalTarget) return;
    onAddSavingGoal({
      name: newGoalName,
      targetAmount: parseFloat(newGoalTarget),
      openingBalance: parseFloat(newGoalOpening) || 0,
      category: newGoalCat,
    });
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalOpening('0');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Budget Settings</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Configure your financial foundation</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-800 transition shadow-sm">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar flex-1">
          {/* Salary Section */}
          <section className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
            <label className="block text-[10px] font-black text-indigo-900 mb-4 uppercase tracking-[0.2em]">Expected Monthly Salary</label>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">$</span>
                <input 
                  type="number"
                  value={tempSalary}
                  onChange={(e) => {
                    setTempSalary(e.target.value);
                    setIsSalarySaved(false);
                  }}
                  className="w-full pl-10 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-xl font-black text-slate-800 transition"
                  placeholder="0.00"
                />
              </div>
              <button 
                onClick={handleSalaryConfirm}
                className={`px-8 rounded-2xl font-black text-sm transition-all flex items-center gap-2 ${
                  isSalarySaved 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-xl shadow-indigo-200'
                }`}
              >
                {isSalarySaved ? (
                  <><i className="fas fa-check"></i> Confirmed</>
                ) : (
                  'Confirm Salary'
                )}
              </button>
            </div>
            <p className="text-[10px] text-indigo-400 mt-4 font-bold uppercase flex items-center gap-2 tracking-wider">
              <i className="fas fa-info-circle"></i>
              Automatically added to balance on the 25th of every month.
            </p>
          </section>

          {/* Recurring Expenses Section */}
          <section>
            <label className="block text-[10px] font-black text-slate-400 mb-6 uppercase tracking-[0.2em]">Monthly Bills & Subscriptions</label>
            <form onSubmit={handleAddRec} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <input 
                type="text" 
                placeholder="Bill name (e.g. Rent)" 
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                value={newRecDesc}
                onChange={e => setNewRecDesc(e.target.value)}
              />
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number" 
                  placeholder="Amount" 
                  className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  value={newRecAmount}
                  onChange={e => setNewRecAmount(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter shrink-0">Due Day</span>
                <input 
                  type="number" 
                  min="1" max="31"
                  className="w-full bg-transparent text-sm font-bold outline-none"
                  value={newRecDay}
                  onChange={e => setNewRecDay(e.target.value)}
                />
              </div>
              <button className="bg-slate-800 text-white rounded-2xl font-black text-xs hover:bg-slate-900 transition uppercase tracking-widest shadow-lg">
                Add Recurring Bill
              </button>
            </form>

            <div className="space-y-3">
              {recurringExpenses.map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white shadow-sm group">
                  <div>
                    <p className="font-black text-slate-800 text-sm">{item.description}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Due Day {item.dayOfMonth} • ${item.amount}/mo</p>
                  </div>
                  <button 
                    onClick={() => onDeleteRecurring(item.id)}
                    className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition"
                  >
                    <i className="fas fa-trash-alt text-sm"></i>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Saving Goals Section */}
          <section>
            <label className="block text-[10px] font-black text-slate-400 mb-6 uppercase tracking-[0.2em]">Financial Saving Goals</label>
            <form onSubmit={handleAddGoal} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <input 
                type="text" 
                placeholder="Goal name (e.g. New Car)" 
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                value={newGoalName}
                onChange={e => setNewGoalName(e.target.value)}
              />
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number" 
                  placeholder="Target Amount" 
                  className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  value={newGoalTarget}
                  onChange={e => setNewGoalTarget(e.target.value)}
                />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number" 
                  placeholder="Opening Balance" 
                  className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  value={newGoalOpening}
                  onChange={e => setNewGoalOpening(e.target.value)}
                />
              </div>
              <button className="sm:col-span-2 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs hover:bg-emerald-700 transition uppercase tracking-widest shadow-lg shadow-emerald-100">
                Create New Goal
              </button>
            </form>

            <div className="space-y-3">
              {savingGoals.map(goal => (
                <div key={goal.id} className="flex items-center justify-between p-4 border border-emerald-100 rounded-2xl bg-emerald-50/30 group">
                  <div>
                    <p className="font-black text-emerald-900 text-sm">{goal.name}</p>
                    <p className="text-[10px] text-emerald-500 uppercase font-bold">Target: ${goal.targetAmount.toLocaleString()} • Starting: ${goal.openingBalance.toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => onDeleteSavingGoal(goal.id)}
                    className="w-10 h-10 flex items-center justify-center text-emerald-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition"
                  >
                    <i className="fas fa-trash-alt text-sm"></i>
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
        
        <div className="p-8 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Pay day is set to the 25th of every month</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
