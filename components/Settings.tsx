import React, { useState, useEffect, useMemo } from 'react';
import { CATEGORIES, RecurringExpense, RecurringIncome, SavingGoal, BankConnection, InvestmentGoal, StoredUser } from '../types';

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
}

const Settings: React.FC<Props> = ({ 
  targetMargin, categoryBudgets, onUpdateCategoryBudgets, 
  cashOpeningBalance, onUpdateCashOpeningBalance,
  recurringExpenses, onAddRecurring, onUpdateRecurring, onDeleteRecurring, 
  recurringIncomes, onAddRecurringIncome, onUpdateRecurringIncome, onDeleteRecurringIncome, 
  investmentGoals, onAddInvestmentGoal, onDeleteInvestmentGoal,
  onResetData, onClose, onLogout, remindersEnabled, onToggleReminders,
  onSetDirectory, directoryHandle, onUpdatePassword,
  users, onUpdateUsers, isAdmin, bankConnections
}) => {
  const [editingBill, setEditingBill] = useState<RecurringExpense | null>(null);
  const [editingIncome, setEditingIncome] = useState<RecurringIncome | null>(null);
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [billForm, setBillForm] = useState({ desc: '', amount: '', category: 'Utilities', day: '1', sync: false });
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [incForm, setIncForm] = useState({ desc: '', amount: '', category: 'Income', day: '25' });

  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passForm, setPassForm] = useState({ old: '', new: '', confirm: '' });
  const [passError, setPassError] = useState('');

  const [isAddingInvGoal, setIsAddingInvGoal] = useState(false);
  const [invGoalForm, setInvGoalForm] = useState({ name: '', target: '', provider: 'Both' });

  // User Management State
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'collaborator' as const });

  const [vaultStatus, setVaultStatus] = useState<'unlinked' | 'locked' | 'active'>('unlinked');

  const isFileSystemSupported = typeof window !== 'undefined' && !!(window as any).showDirectoryPicker;
  const isIframe = window.self !== window.top;

  // Breakdown for formula: Assets (Banks + Cash) - (Budgets + Recurring) = Surplus
  // UPDATED: Filter out credit unions from assets breakdown as requested.
  const { totalAssets, totalBudgets, totalRecurring } = useMemo(() => {
    const assets = bankConnections
      .filter(c => c.institutionType === 'bank')
      .reduce((acc: number, c) => acc + (c.openingBalance || 0), 0) + cashOpeningBalance;
    const budgets = Object.values(categoryBudgets).reduce((acc: number, b) => acc + ((b as number) || 0), 0);
    const recurring = recurringExpenses.reduce((acc: number, e) => acc + (e.amount || 0), 0);
    return { totalAssets: assets, totalBudgets: budgets, totalRecurring: recurring };
  }, [bankConnections, cashOpeningBalance, categoryBudgets, recurringExpenses]);

  useEffect(() => {
    const checkVaultStatus = async () => {
      if (!directoryHandle) {
        setVaultStatus('unlinked');
        return;
      }
      try {
        const permission = await (directoryHandle as any).queryPermission({ mode: 'readwrite' });
        setVaultStatus(permission === 'granted' ? 'active' : 'locked');
      } catch (e) {
        setVaultStatus('locked');
      }
    };
    checkVaultStatus();
  }, [directoryHandle]);

  const handleBudgetChange = (category: string, value: string) => {
    onUpdateCategoryBudgets({ ...categoryBudgets, [category]: parseFloat(value) || 0 });
  };

  const handlePasswordSubmit = () => {
    setPassError('');
    if (!passForm.new || passForm.new.length < 4) {
      setPassError('New password must be at least 4 characters');
      return;
    }
    if (passForm.new !== passForm.confirm) {
      setPassError('New passwords do not match');
      return;
    }
    onUpdatePassword(passForm.new);
    setIsChangingPass(false);
    setPassForm({ old: '', new: '', confirm: '' });
    alert("Vault credentials updated successfully.");
  };

  const handleAddUserSubmit = () => {
    if (!userForm.username || !userForm.password) return;
    if (users.some(u => u.username.toLowerCase() === userForm.username.toLowerCase())) {
        alert("Username already exists.");
        return;
    }
    const newUser: StoredUser = {
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
        createdAt: new Date().toISOString()
    };
    onUpdateUsers([...users, newUser]);
    setIsAddingUser(false);
    setUserForm({ username: '', password: '', role: 'collaborator' });
  };

  const handleDeleteUser = (username: string) => {
    if (confirm(`Remove user ${username}? They will lose access to all projects.`)) {
        onUpdateUsers(users.filter(u => u.username !== username));
    }
  };

  const handleSetLocalVault = async () => {
    if (isIframe) {
      alert("Browser Security Rule: Folder picking is disabled when the app is running in an iframe (sub-frame). Please use the standalone version for hard drive syncing.");
      return;
    }
    if (!isFileSystemSupported) {
      alert("Browser Restriction: The File System Access API is not available. This happens in incognito mode, non-Chromium browsers, or insecure contexts.");
      return;
    }

    try {
      if (vaultStatus === 'locked' && directoryHandle) {
        const permission = await (directoryHandle as any).requestPermission({ mode: 'readwrite' });
        if (permission === 'granted') setVaultStatus('active');
        return;
      }

      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      onSetDirectory(handle);
      setVaultStatus('active');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Directory access error:", err);
      alert(`Could not link folder: ${err.message || 'Unknown Error'}. Ensure you are using a modern browser like Chrome or Edge and not in a restricted frame.`);
    }
  };

  const saveInvGoal = () => {
    const target = parseFloat(invGoalForm.target);
    if (!invGoalForm.name || isNaN(target)) return;
    onAddInvestmentGoal({
      name: invGoalForm.name,
      targetAmount: target,
      provider: invGoalForm.provider
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
        nextDueDate: billForm.sync ? editingBill.nextDueDate : nextDue.toISOString().split('T')[0], 
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
        nextConfirmationDate: editingIncome.nextConfirmationDate 
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
          {/* USER MANAGEMENT SECTION - ONLY FOR NSV */}
          {isAdmin && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Collaborator Directory</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manage Project Matrix Users</p>
                </div>
                <button onClick={() => setIsAddingUser(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-900 transition">+ New User</button>
              </div>
              <div className="space-y-3">
                {users.map(user => (
                  <div key={user.username} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 font-black uppercase">{user.username[0]}</div>
                      <div>
                        <p className="font-black text-sm text-slate-800">{user.username}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{user.role} • Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteUser(user.username)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 transition flex items-center justify-center">
                      <i className="fas fa-user-xmark text-[10px]"></i>
                    </button>
                  </div>
                ))}
                {users.length === 0 && <p className="text-[10px] italic text-slate-300 font-bold uppercase text-center py-4">No collaborators provisioned</p>}
              </div>
            </section>
          )}

          <section className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 space-y-4">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><i className="fas fa-folder-open"></i></div>
                <div><h3 className="text-sm font-black text-slate-800">Local Hard Drive Vault</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sync files to {vaultStatus === 'unlinked' ? 'a local folder' : 'linked vault'}</p></div>
              </div>
              <button 
                onClick={handleSetLocalVault}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${vaultStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : (isFileSystemSupported && !isIframe) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}
              >
                {vaultStatus === 'active' ? 'Vault Linked' : vaultStatus === 'locked' ? 'Unlock Vault' : (isFileSystemSupported && !isIframe) ? 'Connect Folder' : 'Unsupported'}
              </button>
            </div>
            {isIframe && <p className="text-[8px] text-amber-500 font-black uppercase tracking-widest bg-amber-50 p-2 rounded-lg text-center"><i className="fas fa-exclamation-triangle mr-1"></i> Restricted in Preview (Iframe). IndexedDB vault active.</p>}
            {!isFileSystemSupported && !isIframe && <p className="text-[8px] text-rose-500 font-black uppercase tracking-widest bg-rose-50 p-2 rounded-lg text-center"><i className="fas fa-exclamation-triangle mr-1"></i> File System Access restricted in this browser session.</p>}
            {vaultStatus === 'locked' && !isIframe && <p className="text-[8px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 p-2 rounded-lg text-center"><i className="fas fa-lock mr-1"></i> Folder linked but permission required this session.</p>}
            {vaultStatus === 'active' && <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest bg-emerald-50 p-2 rounded-lg text-center"><i className="fas fa-shield-check mr-1"></i> Native File System Sync Enabled</p>}
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

          <section className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><i className="fas fa-shield-halved"></i></div>
                <div><h3 className="text-sm font-black text-slate-800">Security Hub</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manage Vault Access</p></div>
              </div>
              <button 
                onClick={() => setIsChangingPass(true)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition"
              >
                Reset Password
              </button>
            </div>
          </section>

          <section className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Financial Strategy Hub</label>
            <div className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* UPDATED: Monthly Target Surplus derivation excludes credit unions from assets */}
                 <div className="p-6 bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-indigo-500/20 transition-all"></div>
                   <h3 className="text-lg font-black mb-1 relative z-10">Monthly Target Surplus</h3>
                   <div className="flex items-end gap-1 relative z-10">
                     <span className="font-black text-indigo-400 text-2xl tracking-tighter">${targetMargin.toLocaleString()}</span>
                     <span className="text-[9px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Calculated</span>
                   </div>
                   <div className="mt-4 pt-4 border-t border-white/10 space-y-1 relative z-10">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                        <span>Banks & Cash (Only)</span>
                        <span className="text-emerald-400">+${totalAssets.toLocaleString()}</span>
                      </p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                        <span>Monthly Commitments</span>
                        <span className="text-rose-400">-${(totalBudgets + totalRecurring).toLocaleString()}</span>
                      </p>
                   </div>
                 </div>
                 <div>
                   <h3 className="text-lg font-black mb-1">Physical Cash Opening Balance</h3>
                   <div className="relative">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-400 text-lg">$</span>
                     <input type="number" value={cashOpeningBalance || ''} onChange={(e) => onUpdateCashOpeningBalance(parseFloat(e.target.value) || 0)} className="w-full pl-10 p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-xl text-white placeholder:text-white/10" />
                   </div>
                   <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-1">Starting funds in wallet/physical safe</p>
                 </div>
               </div>
               <div className="pt-4 border-t border-white/10"><h3 className="text-lg font-black mb-1">Monthly Category Limits</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{CATEGORIES.filter(c => !['Income', 'Savings', 'Investments', 'Other'].includes(c)).map(cat => (<div key={cat} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/10 transition-colors"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat}</p><div className="relative"><span className="absolute left-0 top-1/2 -translate-y-1/2 font-black text-indigo-400 text-xs">$</span><input type="number" value={categoryBudgets[cat] || ''} onChange={(e) => handleBudgetChange(cat, e.target.value)} className="bg-transparent border-none p-0 pl-3 outline-none font-black text-sm text-white w-24" /></div></div><div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors"><i className="fas fa-bullseye text-[10px]"></i></div></div>))}</div></div>
            </div>
          </section>

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
                <button onClick={() => alert("Export feature initialized. Compiling encrypted bundle...")} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition">Export JSON</button>
                <button onClick={onResetData} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 transition">Purge Store</button>
             </div>
          </section>

          <section className="pt-6 border-t border-slate-100 space-y-4">
            <button onClick={onLogout} className="w-full py-5 bg-rose-50 text-rose-600 font-black rounded-2xl text-xs uppercase tracking-[0.2em] hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-100"><i className="fas fa-sign-out-alt mr-2"></i> Terminate Session</button>
          </section>
        </div>
      </div>

      {isAddingUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-2">Provision Matrix Access</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Create Collaborative Account</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                <input 
                  type="text"
                  value={userForm.username} 
                  onChange={e => setUserForm({...userForm, username: e.target.value})} 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" 
                  placeholder="e.g. jdoe_matrix" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <input 
                  type="password"
                  value={userForm.password} 
                  onChange={e => setUserForm({...userForm, password: e.target.value})} 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" 
                  placeholder="••••••••" 
                />
              </div>
              <button onClick={handleAddUserSubmit} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-slate-900 transition">Create Account</button>
              <button onClick={() => setIsAddingUser(false)} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Discard</button>
            </div>
          </div>
        </div>
      )}

      {isChangingPass && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-sm rounded-[2rem] p-8 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-2">Reset Vault Key</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Update Access Credentials</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                <input 
                  type="password"
                  value={passForm.new} 
                  onChange={e => setPassForm({...passForm, new: e.target.value})} 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" 
                  placeholder="••••••••" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                <input 
                  type="password"
                  value={passForm.confirm} 
                  onChange={e => setPassForm({...passForm, confirm: e.target.value})} 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" 
                  placeholder="••••••••" 
                />
              </div>
              {passError && <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1">{passError}</p>}
              <button onClick={handlePasswordSubmit} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-indigo-600 transition">Update Security</button>
              <button onClick={() => { setIsChangingPass(false); setPassError(''); }} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Discard Changes</button>
            </div>
          </div>
        </div>
      )}

      {isAddingInvGoal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-6">New Wealth Target</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Goal Name</label><input value={invGoalForm.name} onChange={e => setInvGoalForm({...invGoalForm, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" placeholder="Retirement Fund" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Amount ($)</label><input type="number" value={invGoalForm.target} onChange={e => setInvGoalForm({...invGoalForm, target: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" placeholder="500000" /></div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linked Provider</label>
                <select value={invGoalForm.provider} onChange={e => setInvGoalForm({...invGoalForm, provider: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
                  <optgroup label="Investment Platforms">
                    <option value="Binance">Binance (Crypto)</option>
                    <option value="Vanguard">Vanguard (Stocks)</option>
                    <option value="Both">Both (Aggregated)</option>
                  </optgroup>
                  <optgroup label="Banking & Credit Unions">
                    {bankConnections.map(conn => (
                      <option key={conn.institution} value={conn.institution}>{conn.institution}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <button onClick={saveInvGoal} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-indigo-600 transition">Create Target</button>
              <button onClick={() => setIsAddingInvGoal(false)} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

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