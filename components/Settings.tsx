
import React, { useState, useMemo, useRef } from 'react';
import { CATEGORIES, RecurringExpense, RecurringIncome, SavingGoal, BankConnection, InvestmentGoal, StoredUser, STORAGE_KEYS } from '../types';
import { storeMirrorHandle, clearVaultHandle, triggerSecureDownload } from '../services/fileStorageService';

interface Props {
  salary: number;
  onUpdateSalary: (val: number) => void;
  targetMargin: number;
  cashOpeningBalance: number;
  onUpdateCashOpeningBalance: (val: number) => void;
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
  bankConnections: BankConnection[];
  onResetBank: () => void;
  onSetDirectory: (handle: FileSystemDirectoryHandle | null) => void;
  directoryHandle: FileSystemDirectoryHandle | null;
  onUpdatePassword: (newPass: string) => void;
  users: StoredUser[];
  onUpdateUsers: (users: StoredUser[]) => void;
  isAdmin: boolean;
  onOpenBankSync?: () => void;
  onUnlinkBank?: (inst: string) => void;
}

type SettingsTab = 'general' | 'recurring' | 'goals' | 'api' | 'security';

const Settings: React.FC<Props> = ({ 
  targetMargin, categoryBudgets, onUpdateCategoryBudgets, 
  cashOpeningBalance, onUpdateCashOpeningBalance,
  recurringExpenses, onAddRecurring, onDeleteRecurring,
  recurringIncomes, onAddRecurringIncome, onDeleteRecurringIncome,
  savingGoals, onAddSavingGoal, onDeleteSavingGoal,
  investmentGoals, onAddInvestmentGoal, onDeleteInvestmentGoal,
  onResetData, onClose, onLogout, 
  onUpdatePassword, bankConnections,
  onOpenBankSync, onUnlinkBank,
  onSetDirectory, directoryHandle,
  isAdmin
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passForm, setPassForm] = useState({ new: '', confirm: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Temp form states for adding new items
  const [newRec, setNewRec] = useState({ description: '', amount: '', category: CATEGORIES[0], dayOfMonth: '1' });
  const [newInc, setNewInc] = useState({ description: '', amount: '', dayOfMonth: '25' });
  const [newGoal, setNewGoal] = useState({ name: '', target: '', category: CATEGORIES[0] });

  const calculatedSurplus = useMemo(() => {
    // Filter out everything except institutionType === 'bank'
    const totalOnlyBanks: number = (bankConnections || [])
      .filter(c => c.institutionType === 'bank')
      .reduce((acc: number, c) => acc + (c.openingBalance || 0), 0);
    
    const totalLiquid: number = totalOnlyBanks + cashOpeningBalance;
    const totalThresholds: number = (Object.values(categoryBudgets || {}) as number[]).reduce((acc: number, val: number) => acc + (val || 0), 0);
    const totalRecurring: number = (recurringExpenses || []).reduce((acc: number, exp) => acc + (exp.amount || 0), 0);
    
    return totalLiquid - (totalThresholds + totalRecurring);
  }, [bankConnections, cashOpeningBalance, categoryBudgets, recurringExpenses]);

  const handleExportBackup = () => {
    const backupData: Record<string, string | null> = {};
    Object.values(STORAGE_KEYS).forEach(key => {
      backupData[key] = localStorage.getItem(key);
    });
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    triggerSecureDownload(blob, `fire_finance_backup_${timestamp}.json`);
  };

  const handleImportRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (confirm("RESTORE WARNING: This will overwrite ALL current vault data. This action cannot be undone. Proceed?")) {
          Object.keys(data).forEach(key => {
            if (data[key] !== null) {
              localStorage.setItem(key, data[key]);
            }
          });
          alert("Vault Data Restored Successfully. Terminal will now reload.");
          window.location.reload();
        }
      } catch (err) {
        alert("CRITICAL ERROR: Invalid backup file structure.");
      }
    };
    reader.readAsText(file);
  };

  const handleLinkMirrorDirectory = async () => {
    try {
      if ((window as any).showDirectoryPicker) {
        const handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        onSetDirectory(handle);
        alert("SSD Mirror established. Filesystem Access Protocol Active.");
      } else {
        alert("Directory Picker API not supported in this browser.");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      alert(`Mirror Setup Failed: ${err.message}`);
    }
  };

  const handleUnlinkMirror = async () => {
    onSetDirectory(null);
    alert("Mirror Unlinked.");
  };

  const handleBudgetChange = (category: string, value: string) => {
    onUpdateCategoryBudgets({ ...categoryBudgets, [category]: parseFloat(value) || 0 });
  };

  const handlePasswordSubmit = () => {
    if (!passForm.new || passForm.new.length < 4) return alert('Min 4 chars');
    if (passForm.new !== passForm.confirm) return alert('Mismatch');
    onUpdatePassword(passForm.new);
    setIsChangingPass(false);
    setPassForm({ new: '', confirm: '' });
    alert("Vault credentials updated.");
  };

  const tabs: {id: SettingsTab, label: string, icon: string}[] = [
    { id: 'general', label: 'Core', icon: 'fa-sliders-h' },
    { id: 'recurring', label: 'Recurring', icon: 'fa-redo' },
    { id: 'goals', label: 'Targets', icon: 'fa-bullseye' },
    { id: 'api', label: 'Gateways', icon: 'fa-plug' },
    { id: 'security', label: 'System', icon: 'fa-shield-halved' },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 h-[85vh] flex flex-col md:flex-row">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 flex flex-col p-6 overflow-x-auto no-scrollbar">
          <div className="mb-8 hidden md:block">
            <h2 className="text-xl font-black text-slate-800">Vault Settings</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Logic Center</p>
          </div>
          
          <div className="flex md:flex-col gap-2 flex-nowrap">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-white hover:text-slate-800'}`}
              >
                <i className={`fas ${tab.icon} w-4`}></i>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-auto pt-6 hidden md:block">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition">
              <i className="fas fa-power-off"></i> Logout
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white relative">
          <button onClick={onClose} className="absolute top-6 right-8 w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition shadow-sm z-10"><i className="fas fa-times"></i></button>

          {activeTab === 'general' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
              <section>
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fas fa-coins text-indigo-600"></i> Financial Baseline</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Opening Cash Ledger</label>
                    <input 
                      type="number" 
                      value={cashOpeningBalance} 
                      onChange={(e) => onUpdateCashOpeningBalance(parseFloat(e.target.value) || 0)} 
                      className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xl font-black outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                  <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Monthly Surplus Target</label>
                    <p className={`text-2xl font-black ${calculatedSurplus >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      ${calculatedSurplus.toLocaleString()}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Derived: (Banks + Cash) - (Budgets + Recurring)</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fas fa-layer-group text-indigo-600"></i> Spending Thresholds</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {CATEGORIES.filter(c => !['Income', 'Savings', 'Investments', 'Other', 'Transfer'].includes(c)).map(cat => (
                    <div key={cat} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{cat}</p>
                      <input 
                        type="number" 
                        value={categoryBudgets[cat] || ''} 
                        onChange={(e) => handleBudgetChange(cat, e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'recurring' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
              <section>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-slate-800">Recurring Commitments</h3>
                  <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">Fixed Expenses</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3 mb-6">
                  {recurringExpenses.map(exp => (
                    <div key={exp.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-rose-500 shadow-sm"><i className="fas fa-calendar-minus"></i></div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{exp.description}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${exp.amount} • {exp.category} • Day {exp.dayOfMonth}</p>
                        </div>
                      </div>
                      <button onClick={() => onDeleteRecurring(exp.id)} className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-alt text-xs"></i></button>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">Register New Bill/Subscription</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <input type="text" placeholder="Description" value={newRec.description} onChange={e => setNewRec({...newRec, description: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="number" placeholder="Amount" value={newRec.amount} onChange={e => setNewRec({...newRec, amount: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                    <select value={newRec.category} onChange={e => setNewRec({...newRec, category: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                      {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                    </select>
                    <input type="number" placeholder="Day (1-31)" value={newRec.dayOfMonth} onChange={e => setNewRec({...newRec, dayOfMonth: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <button 
                    onClick={() => {
                      if (!newRec.description || !newRec.amount) return;
                      onAddRecurring({ ...newRec, amount: parseFloat(newRec.amount), dayOfMonth: parseInt(newRec.dayOfMonth), nextDueDate: new Date().toISOString() });
                      setNewRec({ description: '', amount: '', category: CATEGORIES[0], dayOfMonth: '1' });
                    }} 
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition"
                  >Initialize Lifecycle</button>
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-slate-800">Recurring Inflows</h3>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest">Income Sources</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3 mb-6">
                  {recurringIncomes.map(inc => (
                    <div key={inc.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-emerald-500 shadow-sm"><i className="fas fa-calendar-plus"></i></div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{inc.description}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${inc.amount} • {inc.category} • Day {inc.dayOfMonth}</p>
                        </div>
                      </div>
                      <button onClick={() => onDeleteRecurringIncome(inc.id)} className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-alt text-xs"></i></button>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4">Register Recurring Income</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <input 
                      type="text" 
                      placeholder="Source (e.g. Salary, Rent)" 
                      value={newInc.description} 
                      onChange={e => setNewInc({...newInc, description: e.target.value})} 
                      className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                    />
                    <input 
                      type="number" 
                      placeholder="Amount" 
                      value={newInc.amount} 
                      onChange={e => setNewInc({...newInc, amount: e.target.value})} 
                      className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                    />
                    <div className="col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-1">Expected Day of Month</label>
                      <input 
                        type="number" 
                        placeholder="Day (1-31)" 
                        value={newInc.dayOfMonth} 
                        onChange={e => setNewInc({...newInc, dayOfMonth: e.target.value})} 
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (!newInc.description || !newInc.amount) return;
                      onAddRecurringIncome({ 
                        description: newInc.description, 
                        amount: parseFloat(newInc.amount), 
                        category: 'Income', 
                        dayOfMonth: parseInt(newInc.dayOfMonth), 
                        nextConfirmationDate: new Date().toISOString() 
                      });
                      setNewInc({ description: '', amount: '', dayOfMonth: '25' });
                    }} 
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20"
                  >Register Inflow</button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
              <section>
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fas fa-mountain-sun text-indigo-600"></i> Active Saving Goals</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {savingGoals.map(goal => (
                    <div key={goal.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] relative group">
                      <div className="flex justify-between items-start mb-4">
                        <p className="font-black text-slate-800">{goal.name}</p>
                        <button onClick={() => onDeleteSavingGoal(goal.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-times text-xs"></i></button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Progress</span>
                          <span className="text-indigo-600">${goal.currentAmount} / ${goal.targetAmount}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${(goal.currentAmount/goal.targetAmount)*100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-[3rem] text-center">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Initialize New Objective</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
                    <input type="text" placeholder="Goal Name (e.g. New Car)" value={newGoal.name} onChange={e => setNewGoal({...newGoal, name: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" />
                    <input type="number" placeholder="Target Amount" value={newGoal.target} onChange={e => setNewGoal({...newGoal, target: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" />
                    <button 
                      onClick={() => {
                        if (!newGoal.name || !newGoal.target) return;
                        onAddSavingGoal({ name: newGoal.name, targetAmount: parseFloat(newGoal.target), institution: 'Savings Account', institutionType: 'bank', openingBalance: 0, category: 'Savings' });
                        setNewGoal({ name: '', target: '', category: CATEGORIES[0] });
                      }}
                      className="md:col-span-2 py-4 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-600 transition"
                    >Activate Goal Matrix</button>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fas fa-rocket text-indigo-600"></i> Investment Targets</h3>
                <div className="grid grid-cols-1 gap-3">
                  {investmentGoals.map(goal => (
                    <div key={goal.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-sm font-black text-slate-800">{goal.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Target: ${goal.targetAmount} • Provider: {goal.provider}</p>
                      </div>
                      <button onClick={() => onDeleteInvestmentGoal(goal.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt text-xs"></i></button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Managed API Connections</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Banks & Investment Portals</p>
                  </div>
                  <button 
                    onClick={onOpenBankSync}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
                  >
                    <i className="fas fa-plus"></i> Link New
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {bankConnections.map(conn => (
                    <div key={conn.institution} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                          <i className={`fas ${conn.institutionType === 'investment' ? 'fa-chart-line' : 'fa-landmark'}`}></i>
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">{conn.institution}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            {conn.institutionType} • {conn.accountLastFour}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-[9px] font-black text-emerald-500 uppercase">Status: Linked</p>
                          <p className="text-[8px] text-slate-400 font-bold">Synced: {conn.lastSynced ? new Date(conn.lastSynced).toLocaleTimeString() : 'Never'}</p>
                        </div>
                        <button onClick={() => onUnlinkBank?.(conn.institution)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors">
                          <i className="fas fa-unlink"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  {bankConnections.length === 0 && (
                    <div className="p-12 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-center">
                      <i className="fas fa-plug text-slate-200 text-4xl mb-4"></i>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest max-w-[200px]">Link external institutions for real-time liquidity tracking</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-indigo-50/50 p-8 rounded-[3rem] border border-indigo-100 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-xl border border-indigo-100"><i className="fas fa-folder-open text-2xl"></i></div>
                    <div><h3 className="text-lg font-black text-slate-800">SSD Vault Mirror</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Physical File Persistence</p></div>
                  </div>
                  {directoryHandle ? (
                    <button 
                      onClick={handleUnlinkMirror}
                      className="px-8 py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all flex items-center gap-2"
                    >
                      <i className="fas fa-unlink"></i> Unlink Directory
                    </button>
                  ) : (
                    <button 
                      onClick={handleLinkMirrorDirectory}
                      className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                      <i className="fas fa-link"></i> Mount SSD Folder
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-medium px-4 leading-relaxed">
                  {directoryHandle 
                    ? `Currently mirroring to: ${directoryHandle.name}. Project files and assets are stored physically on your local machine.`
                    : "Mirroring is currently inactive. Link a local folder to ensure project files and backups are stored physically on your machine."}
                </p>
              </section>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
              <section className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3"><i className="fas fa-shield-virus text-indigo-600"></i> Authentication Logic</h3>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <button onClick={() => setIsChangingPass(true)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition shadow-sm">Rotate Credentials</button>
                    <button onClick={onResetData} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 transition shadow-sm">Factory Purge</button>
                  </div>
                  
                  <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-[10px] text-amber-700 font-black uppercase tracking-widest flex items-center gap-2 mb-2"><i className="fas fa-exclamation-triangle"></i> Security Protocol</p>
                    <p className="text-[11px] text-amber-900 leading-relaxed font-medium">All data is encrypted using AES-256 before being stored in IndexedDB. Only your local vault key can decrypt the ledger.</p>
                  </div>
                </div>
              </section>

              <section className="bg-white p-10 rounded-[3rem] border border-slate-100">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3"><i className="fas fa-cloud-arrow-down text-indigo-600"></i> Vault Backup & Restore</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={handleExportBackup}
                    className="py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-indigo-700 transition flex items-center justify-center gap-3"
                  >
                    <i className="fas fa-file-export"></i> Export Local Backup
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-slate-800 transition flex items-center justify-center gap-3"
                  >
                    <i className="fas fa-file-import"></i> Restore from Backup
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json"
                    onChange={handleImportRestore} 
                  />
                </div>
                <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase text-center">Use this to move your financial hub to another device or create a redundant snapshot.</p>
              </section>

              <button onClick={onLogout} className="w-full py-6 bg-slate-900 text-white font-black rounded-[2rem] text-xs uppercase tracking-[0.3em] hover:bg-rose-600 transition-all shadow-2xl flex items-center justify-center gap-3">
                <i className="fas fa-lock"></i> Close Vault & Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {isChangingPass && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-2">Security Update</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Update Vault Credentials</p>
            <div className="space-y-5">
              <div className="relative">
                <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input type="password" value={passForm.new} onChange={e => setPassForm({...passForm, new: e.target.value})} className="w-full pl-12 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800" placeholder="New Password" />
              </div>
              <div className="relative">
                <i className="fas fa-check-double absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input type="password" value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})} className="w-full pl-12 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800" placeholder="Confirm Password" />
              </div>
              <button onClick={handlePasswordSubmit} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-indigo-600 transition active:scale-95">Apply Cryptography</button>
              <button onClick={() => setIsChangingPass(false)} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Abort Process</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
