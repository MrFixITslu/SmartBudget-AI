
import React, { useState, useMemo, useRef } from 'react';
import { BudgetEvent, EventItem, EVENT_ITEM_CATEGORIES, ProjectTask, ProjectFile, ProjectNote, Contact, IOU } from '../types';

interface Props {
  events: BudgetEvent[];
  contacts: Contact[];
  directoryHandle: FileSystemDirectoryHandle | null;
  onAddEvent: (event: Omit<BudgetEvent, 'id' | 'items' | 'notes' | 'tasks' | 'files' | 'contactIds' | 'ious'>) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (event: BudgetEvent) => void;
  onUpdateContacts: (contacts: Contact[]) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

type ProjectTab = 'ledger' | 'tasks' | 'vault' | 'ious' | 'contacts' | 'log';

const EventPlanner: React.FC<Props> = ({ events, contacts, directoryHandle, onAddEvent, onDeleteEvent, onUpdateEvent, onUpdateContacts }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('ledger');
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Tab-specific form states
  const [taskText, setTaskText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [iouForm, setIouForm] = useState({ contactId: '', amount: '', description: '', type: 'claim' as 'debt' | 'claim' });
  const [newContact, setNewContact] = useState({ name: '', email: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedEvent = useMemo(() => (events || []).find(e => e.id === selectedEventId), [events, selectedEventId]);

  const projectContacts = useMemo(() => {
    if (!selectedEvent) return [];
    return contacts.filter(c => (selectedEvent.contactIds || []).includes(c.id));
  }, [selectedEvent, contacts]);

  const handleAddIOU = () => {
    if (!selectedEvent || !iouForm.contactId || !iouForm.amount) return;
    const newIou: IOU = {
      id: generateId(),
      contactId: iouForm.contactId,
      amount: parseFloat(iouForm.amount),
      description: iouForm.description,
      type: iouForm.type,
      settled: false
    };
    onUpdateEvent({ ...selectedEvent, ious: [...(selectedEvent.ious || []), newIou] });
    setIouForm({ contactId: '', amount: '', description: '', type: 'claim' });
  };

  const handleAddItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEvent) return;
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string) || 0;
    const description = (formData.get('description') as string || '').trim();
    if (!description || isNaN(amount)) return;
    const newItem: EventItem = {
      id: generateId(),
      description,
      amount,
      type: formData.get('type') as 'income' | 'expense',
      category: formData.get('category') as string,
      date: new Date().toISOString().split('T')[0]
    };
    onUpdateEvent({ ...selectedEvent, items: [...(selectedEvent.items || []), newItem] });
    e.currentTarget.reset();
  };

  const handleAddTask = () => {
    if (!selectedEvent || !taskText.trim()) return;
    const newTask: ProjectTask = {
      id: generateId(),
      text: taskText.trim(),
      completed: false
    };
    onUpdateEvent({ ...selectedEvent, tasks: [...(selectedEvent.tasks || []), newTask] });
    setTaskText('');
  };

  const handleAddNote = () => {
    if (!selectedEvent || !noteText.trim()) return;
    const newNote: ProjectNote = {
      id: generateId(),
      text: noteText.trim(),
      timestamp: new Date().toISOString()
    };
    onUpdateEvent({ ...selectedEvent, notes: [...(selectedEvent.notes || []), newNote] });
    setNoteText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!selectedEvent || !file) return;
    const newFile: ProjectFile = {
      id: generateId(),
      name: file.name,
      type: file.type,
      size: file.size,
      timestamp: new Date().toISOString(),
      storageRef: 'temp',
      storageType: 'indexeddb'
    };
    onUpdateEvent({ ...selectedEvent, files: [...(selectedEvent.files || []), newFile] });
  };

  const handleToggleTask = (taskId: string) => {
    if (!selectedEvent) return;
    onUpdateEvent({
      ...selectedEvent,
      tasks: selectedEvent.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    });
  };

  const handleLinkContact = (contactId: string) => {
    if (!selectedEvent) return;
    if (selectedEvent.contactIds.includes(contactId)) return;
    onUpdateEvent({
      ...selectedEvent,
      contactIds: [...selectedEvent.contactIds, contactId]
    });
  };

  const ledgerTotals = useMemo(() => {
    if (!selectedEvent) return { income: 0, expense: 0 };
    return selectedEvent.items.reduce((acc, item) => {
      if (item.type === 'income') acc.income += item.amount;
      else acc.expense += item.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [selectedEvent]);

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto px-2">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter">Project Matrix</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Advanced Contextual Command</p>
        </div>
        {!selectedEventId && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-600 transition-all">
            <i className="fas fa-plus"></i> New Project
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="p-10 bg-white border border-slate-200 rounded-[3rem] shadow-sm animate-in zoom-in-95 duration-300 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Designation</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Summit 2025" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-lg focus:ring-4 focus:ring-indigo-50" />
            </div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Target Date</label><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black" /></div>
          </div>
          <button onClick={() => { if (!newName) return; onAddEvent({ name: newName, date: newDate, status: 'active' }); setShowAddForm(false); setNewName(''); }} className="w-full mt-8 py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl uppercase tracking-widest text-[11px]">Deploy Frame</button>
        </div>
      )}

      {selectedEventId ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl relative">
             <div className="flex items-center gap-6">
               <button onClick={() => setSelectedEventId(null)} className="w-12 h-12 flex items-center justify-center bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"><i className="fas fa-arrow-left"></i></button>
               <div>
                 <h2 className="text-2xl font-black text-white tracking-tight">{selectedEvent?.name}</h2>
                 <p className="text-[9px] text-indigo-400 font-black uppercase tracking-[0.3em] mt-1">Status: {selectedEvent?.status}</p>
               </div>
             </div>
             <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
               {(['ledger', 'tasks', 'vault', 'ious', 'contacts', 'log'] as ProjectTab[]).map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>{tab}</button>
               ))}
             </div>
          </div>

          <div className="min-h-[500px]">
            {activeTab === 'ledger' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em]">Project Ledger</h3>
                      <div className="flex gap-4">
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Inflow</p>
                          <p className="text-sm font-black text-emerald-600">${ledgerTotals.income.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Outflow</p>
                          <p className="text-sm font-black text-rose-600">${ledgerTotals.expense.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(selectedEvent?.items || []).map(item => (
                        <div key={item.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              <i className={`fas ${item.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                            </div>
                            <div>
                              <p className="font-black text-xs text-slate-800">{item.description}</p>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.category}</p>
                            </div>
                          </div>
                          <p className={`font-black text-sm ${item.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                      {(!selectedEvent?.items || selectedEvent.items.length === 0) && (
                        <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Empty Ledger</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-6">Log Event Item</h3>
                  <form onSubmit={handleAddItem} className="space-y-4">
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Description</label><input name="description" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs" required /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Amount</label><input name="amount" type="number" step="0.01" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs" required /></div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Type</label>
                      <select name="type" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs">
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Category</label>
                      <select name="category" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs">
                        {EVENT_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[10px]">Record Entry</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
                    <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em] mb-8">Mission Roadmap</h3>
                    <div className="space-y-3">
                      {(selectedEvent?.tasks || []).map(task => (
                        <div key={task.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 group">
                          <button onClick={() => handleToggleTask(task.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200'}`}>
                            {task.completed && <i className="fas fa-check text-[10px]"></i>}
                          </button>
                          <span className={`text-sm font-black transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.text}</span>
                        </div>
                      ))}
                      {(!selectedEvent?.tasks || selectedEvent.tasks.length === 0) && <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No Active Tasks</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-6">New Objective</h3>
                  <div className="space-y-4">
                    <textarea value={taskText} onChange={e => setTaskText(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs h-32 no-scrollbar" placeholder="Task details..."></textarea>
                    <button onClick={handleAddTask} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[10px]">Add Task</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vault' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
                    <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em] mb-8">Document Assets</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      {(selectedEvent?.files || []).map(file => (
                        <div key={file.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col items-center text-center group relative cursor-pointer hover:bg-white hover:shadow-xl transition-all">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-4">
                            <i className="fas fa-file-invoice text-xl"></i>
                          </div>
                          <p className="font-black text-[10px] text-slate-800 truncate w-full mb-1">{file.name}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ))}
                      {(!selectedEvent?.files || selectedEvent.files.length === 0) && <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No Assets Found</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-6">Archive Asset</h3>
                  <div className="p-10 border-4 border-dashed border-slate-100 rounded-[2.5rem] text-center group cursor-pointer hover:border-indigo-200 transition-all" onClick={() => fileInputRef.current?.click()}>
                    <i className="fas fa-cloud-upload text-3xl text-slate-200 group-hover:text-indigo-400 mb-4 transition-colors"></i>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Files</p>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  </div>
                  <p className="text-[8px] text-slate-300 font-black uppercase text-center mt-4 tracking-widest">Standardized IndexedDB Encryption</p>
                </div>
              </div>
            )}

            {activeTab === 'ious' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
                    <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em] mb-8">Settlement Matrix (IOU)</h3>
                    <div className="space-y-4">
                      {(selectedEvent?.ious || []).map(iou => {
                        const contact = contacts.find(c => c.id === iou.contactId);
                        return (
                          <div key={iou.id} className={`p-6 rounded-[2rem] border transition-all ${iou.settled ? 'opacity-50 bg-slate-50' : 'bg-white border-slate-100 shadow-md'} flex items-center justify-between group`}>
                            <div className="flex items-center gap-5">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iou.type === 'claim' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                <i className={`fas ${iou.type === 'claim' ? 'fa-hand-holding-dollar' : 'fa-money-bill-transfer'}`}></i>
                              </div>
                              <div>
                                <p className="font-black text-sm text-slate-800">{contact?.name || 'Unknown Contact'}</p>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{iou.description || 'Project Settlement'}</p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-6">
                              <div>
                                <p className={`text-lg font-black ${iou.type === 'claim' ? 'text-emerald-600' : 'text-rose-600'}`}>{iou.type === 'claim' ? '+' : '-'}${iou.amount.toLocaleString()}</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{iou.type === 'claim' ? 'They Owe You' : 'You Owe Them'}</p>
                              </div>
                              <button 
                                onClick={() => onUpdateEvent({...selectedEvent!, ious: selectedEvent!.ious.map(i => i.id === iou.id ? {...i, settled: !i.settled} : i)})}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${iou.settled ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
                              >
                                {iou.settled ? 'Settled' : 'Mark Clear'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {(!selectedEvent?.ious || selectedEvent.ious.length === 0) && <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No outstanding balances</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-8">Record Debt/Claim</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Stakeholder</label>
                      <select value={iouForm.contactId} onChange={e => setIouForm({...iouForm, contactId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-xs">
                        <option value="">Select Contact</option>
                        {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Type</label>
                      <select value={iouForm.type} onChange={e => setIouForm({...iouForm, type: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-xs">
                        <option value="claim">They owe me (Claim)</option>
                        <option value="debt">I owe them (Debt)</option>
                      </select>
                    </div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Amount</label><input type="number" value={iouForm.amount} onChange={e => setIouForm({...iouForm, amount: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm" placeholder="0.00" /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Note</label><input value={iouForm.description} onChange={e => setIouForm({...iouForm, description: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs" placeholder="Venue split, etc." /></div>
                    <button onClick={handleAddIOU} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all">Establish IOU</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
                    <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em] mb-8">Linked Personnel</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {projectContacts.map(c => (
                        <div key={c.id} className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                              <i className="fas fa-user text-xs"></i>
                            </div>
                            <div>
                              <p className="font-black text-xs text-slate-800">{c.name}</p>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{c.email || 'No Email'}</p>
                            </div>
                          </div>
                          <button onClick={() => onUpdateEvent({...selectedEvent!, contactIds: selectedEvent!.contactIds.filter(id => id !== c.id)})} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 transition flex items-center justify-center">
                            <i className="fas fa-unlink text-[10px]"></i>
                          </button>
                        </div>
                      ))}
                      {projectContacts.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No Stakeholders Linked</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-6">Link Personnel</h3>
                  <div className="space-y-4">
                    <div className="max-h-64 overflow-y-auto no-scrollbar space-y-2">
                      {contacts.filter(c => !selectedEvent?.contactIds.includes(c.id)).map(c => (
                        <button key={c.id} onClick={() => handleLinkContact(c.id)} className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-xl text-left flex items-center gap-3 group transition-colors">
                          <i className="fas fa-plus text-[10px] text-slate-300 group-hover:text-indigo-400"></i>
                          <span className="text-xs font-black text-slate-700">{c.name}</span>
                        </button>
                      ))}
                      {contacts.length === 0 && <p className="text-center py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Global Contact List Empty</p>}
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">New Global Personnel</p>
                      <input value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs mb-3" placeholder="Name" />
                      <input value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs mb-4" placeholder="Email (Optional)" />
                      <button onClick={() => { if (!newContact.name) return; const cid = generateId(); onUpdateContacts([...contacts, { ...newContact, id: cid, number: '' }]); handleLinkContact(cid); setNewContact({ name: '', email: '' }); }} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[10px]">Create & Link</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
                    <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em] mb-8">Project Narrative</h3>
                    <div className="space-y-6">
                      {(selectedEvent?.notes || []).map(note => (
                        <div key={note.id} className="relative pl-8 border-l-2 border-slate-100 py-2">
                          <div className="absolute left-[-9px] top-4 w-4 h-4 rounded-full bg-white border-2 border-slate-100"></div>
                          <p className="text-xs font-black text-slate-800 leading-relaxed mb-2">{note.text}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{new Date(note.timestamp).toLocaleString()}</p>
                        </div>
                      ))}
                      {(!selectedEvent?.notes || selectedEvent.notes.length === 0) && <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Project Journal Empty</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-6">Log Journal Note</h3>
                  <div className="space-y-4">
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs h-32 no-scrollbar" placeholder="Log entry..."></textarea>
                    <button onClick={handleAddNote} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[10px]">Record Log</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {events.map(event => (
              <div key={event.id} onClick={() => setSelectedEventId(event.id)} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-indigo-600 transition-colors">
                    <i className="fas fa-folder-open text-xl"></i>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 transition flex items-center justify-center">
                    <i className="fas fa-trash-alt text-[10px]"></i>
                  </button>
                </div>
                <h3 className="font-black text-slate-800 text-lg leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{event.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">{event.date}</p>
                <div className="flex flex-wrap gap-2">
                  <div className="bg-slate-50 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-slate-500">{(event.ious || []).length} Settlements</div>
                  <div className="bg-slate-50 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-indigo-500">{(event.files || []).length} Assets</div>
                  <div className="bg-slate-50 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-emerald-500">{(event.tasks || []).filter(t => t.completed).length}/{(event.tasks || []).length} Tasks</div>
                </div>
              </div>
           ))}
           {events.length === 0 && !showAddForm && (
             <div className="col-span-full py-32 text-center animate-in fade-in">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                 <i className="fas fa-layer-group text-3xl"></i>
               </div>
               <h3 className="text-xl font-black text-slate-800 mb-2">Matrix Command Offline</h3>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No Active Projects Detected</p>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default EventPlanner;
