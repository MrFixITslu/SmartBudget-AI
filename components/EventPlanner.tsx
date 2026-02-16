import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BudgetEvent, EventItem, EVENT_ITEM_CATEGORIES, ProjectTask, ProjectFile, EventLog, Contact, User } from '../types';
import { saveFileToHardDrive, getFileFromHardDrive, triggerSecureDownload } from '../services/fileStorageService';

const ADMIN_USER = "nsv";

interface Props {
  events: BudgetEvent[];
  contacts: Contact[];
  directoryHandle: FileSystemDirectoryHandle | null;
  currentUser: string;
  isAdmin: boolean;
  onAddEvent: (event: Omit<BudgetEvent, 'id' | 'items' | 'notes' | 'tasks' | 'files' | 'contactIds' | 'memberUsernames' | 'ious' | 'lastUpdated' | 'logs'>) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (event: BudgetEvent) => void;
  onUpdateContacts: (contacts: Contact[]) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

type ProjectTab = 'ledger' | 'tasks' | 'vault' | 'team' | 'contacts' | 'log';

const MOCK_ONLINE_USERS: User[] = [
  { id: 'u1', name: 'nsv', role: 'admin', online: true },
  { id: 'u2', name: 'Sarah', role: 'collaborator', online: true },
  { id: 'u3', name: 'John', role: 'collaborator', online: true },
  { id: 'u4', name: 'Michael', role: 'collaborator', online: false },
];

const EventPlanner: React.FC<Props> = ({ events, contacts, directoryHandle, currentUser, isAdmin, onAddEvent, onDeleteEvent, onUpdateEvent, onUpdateContacts }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('ledger');
  const [newName, setNewName] = useState('');
  
  const [taskText, setTaskText] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [subTaskInputs, setSubTaskInputs] = useState<Record<string, string>>({});

  // Contact States
  const [contactSearch, setContactSearch] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', number: '', email: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEvent = useMemo(() => (events || []).find(e => e.id === selectedEventId), [events, selectedEventId]);

  const addActionLog = (event: BudgetEvent, action: string, type: EventLog['type']) => {
    const newLog: EventLog = {
      id: generateId(),
      action,
      timestamp: new Date().toISOString(),
      username: currentUser,
      type
    };
    onUpdateEvent({
      ...event,
      logs: [newLog, ...(event.logs || [])],
      lastUpdated: new Date().toISOString()
    });
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

    const updatedEvent = { ...selectedEvent, items: [...(selectedEvent.items || []), newItem] };
    addActionLog(updatedEvent, `Added ${newItem.type}: "${description}" ($${amount})`, 'transaction');
    e.currentTarget.reset();
  };

  const handleAddTask = () => {
    if (!selectedEvent || !taskText.trim()) return;
    const newTask: ProjectTask = {
      id: generateId(),
      text: taskText.trim(),
      completed: false,
      assignedToId: currentUser,
      subTasks: []
    };
    const updatedEvent = { ...selectedEvent, tasks: [...(selectedEvent.tasks || []), newTask] };
    addActionLog(updatedEvent, `Deployed milestone: "${newTask.text}"`, 'task');
    setTaskText('');
  };

  const handleAddSubTask = (parentTaskId: string) => {
    const text = subTaskInputs[parentTaskId];
    if (!selectedEvent || !text?.trim()) return;

    const newSubTask: ProjectTask = {
      id: generateId(),
      text: text.trim(),
      completed: false,
      assignedToId: currentUser,
      subTasks: []
    };

    const updatedTasks = selectedEvent.tasks.map(t => {
      if (t.id === parentTaskId) {
        return { ...t, subTasks: [...(t.subTasks || []), newSubTask] };
      }
      return t;
    });

    const updatedEvent = { ...selectedEvent, tasks: updatedTasks };
    addActionLog(updatedEvent, `Linked sub-milestone to "${parentTaskId}": "${newSubTask.text}"`, 'task');
    setSubTaskInputs(prev => ({ ...prev, [parentTaskId]: '' }));
  };

  const toggleTaskCompletion = (taskId: string, parentTaskId?: string) => {
    if (!selectedEvent) return;
    
    let updatedTasks: ProjectTask[];
    if (parentTaskId) {
      updatedTasks = selectedEvent.tasks.map(t => {
        if (t.id === parentTaskId) {
          return {
            ...t,
            subTasks: t.subTasks?.map(st => st.id === taskId ? { ...st, completed: !st.completed } : st)
          };
        }
        return t;
      });
    } else {
      updatedTasks = selectedEvent.tasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
    }
    
    onUpdateEvent({ ...selectedEvent, tasks: updatedTasks });
  };

  const handleAddMember = () => {
    if (!selectedEvent || !inviteUsername.trim()) return;
    const currentMembers = selectedEvent.memberUsernames || [];
    if (currentMembers.includes(inviteUsername.trim())) return;
    
    const updatedEvent = { 
      ...selectedEvent, 
      memberUsernames: [...currentMembers, inviteUsername.trim()] 
    };
    addActionLog(updatedEvent, `Authorized user "${inviteUsername.trim()}"`, 'team');
    setInviteUsername('');
  };

  // Contact Handlers
  const handleLinkContact = (contactId: string) => {
    if (!selectedEvent) return;
    const currentIds = selectedEvent.contactIds || [];
    if (currentIds.includes(contactId)) return;

    const updatedEvent = { ...selectedEvent, contactIds: [...currentIds, contactId] };
    const contact = contacts.find(c => c.id === contactId);
    addActionLog(updatedEvent, `Linked stakeholder: "${contact?.name || 'Unknown'}"`, 'contact');
    onUpdateEvent(updatedEvent);
  };

  const handleUnlinkContact = (contactId: string) => {
    if (!selectedEvent) return;
    const updatedEvent = { 
      ...selectedEvent, 
      contactIds: (selectedEvent.contactIds || []).filter(id => id !== contactId) 
    };
    const contact = contacts.find(c => c.id === contactId);
    addActionLog(updatedEvent, `Removed stakeholder: "${contact?.name || 'Unknown'}"`, 'contact');
    onUpdateEvent(updatedEvent);
  };

  const handleCreateContact = () => {
    if (!newContact.name) return;
    const contact: Contact = { ...newContact, id: generateId() };
    onUpdateContacts([...contacts, contact]);
    if (selectedEvent) handleLinkContact(contact.id);
    setNewContact({ name: '', number: '', email: '' });
    setShowContactForm(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!selectedEvent || !file) return;

    if (!directoryHandle) {
      alert("Hard Drive Vault not linked. Please mount SSD in Settings.");
      return;
    }

    try {
      const storageRef = await saveFileToHardDrive(directoryHandle, selectedEvent.name, file.name, file);
      const newFile: ProjectFile = {
        id: generateId(),
        name: file.name,
        type: file.type,
        size: file.size,
        timestamp: new Date().toISOString(),
        storageRef,
        storageType: 'filesystem',
        version: 1,
        lastModifiedBy: currentUser
      };
      
      const updatedEvent = { ...selectedEvent, files: [...(selectedEvent.files || []), newFile] };
      addActionLog(updatedEvent, `Linked local asset: "${file.name}"`, 'file');
    } catch (err) {
      console.error("Vault access error:", err);
    }
  };

  const handleAssetClick = async (file: ProjectFile) => {
    if (file.storageType === 'url') {
      window.open(file.storageRef, '_blank', 'noopener,noreferrer');
      return;
    }

    if (file.storageType === 'filesystem') {
      if (!directoryHandle) {
        alert("SSD Vault Disconnected. Re-mount in Settings.");
        return;
      }
      try {
        const blob = await getFileFromHardDrive(directoryHandle, file.storageRef);
        triggerSecureDownload(blob, file.name);
      } catch (err) {
        console.error("File retrieval error:", err);
        alert("Mirror Asset Error: File missing or access denied.");
      }
    }
  };

  const eventContacts = useMemo(() => {
    if (!selectedEvent) return [];
    return contacts.filter(c => selectedEvent.contactIds?.includes(c.id));
  }, [selectedEvent, contacts]);

  const availableContacts = useMemo(() => {
    if (!selectedEvent) return [];
    const search = contactSearch.toLowerCase();
    return contacts.filter(c => 
      !selectedEvent.contactIds?.includes(c.id) && 
      (c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search))
    );
  }, [selectedEvent, contacts, contactSearch]);

  return (
    <div className={`space-y-6 pb-20 max-w-6xl mx-auto px-2`}>
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-[3rem] border border-slate-800 backdrop-blur-2xl mb-8 shadow-2xl relative overflow-hidden group">
        <div className="flex items-center gap-5 relative z-10">
          <div className="flex -space-x-4">
            {MOCK_ONLINE_USERS.filter(u => u.online).map(u => (
              <div key={u.id} className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[11px] font-black uppercase ring-2 ring-indigo-500/20 shadow-2xl">
                {u.name[0]}
              </div>
            ))}
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block leading-none mb-1.5">Hard Drive Mirroring: {directoryHandle ? <span className="text-emerald-400">ACTIVE</span> : <span className="text-rose-400">INACTIVE</span>}</span>
            <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">FileSystem Access Protocol: {directoryHandle?.name || 'ROOT'}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className={`text-4xl font-black tracking-tighter ${isAdmin ? 'text-slate-800' : 'text-slate-700'}`}>Project Matrix</h2>
        </div>
        {isAdmin && !selectedEventId && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-500 transition-all">
            {showAddForm ? 'Abort' : 'Initiate Project'}
          </button>
        )}
      </div>

      {showAddForm && !selectedEventId && (
        <div className="p-12 bg-white border border-slate-100 rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 mb-8">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. OPERATIONS_HUB_2025" className="w-full p-6 bg-slate-50 border border-slate-200 text-slate-800 rounded-3xl outline-none font-black text-xl" />
          <button onClick={() => { if (!newName) return; onAddEvent({ name: newName, date: new Date().toISOString().split('T')[0], status: 'active' }); setShowAddForm(false); setNewName(''); }} className="w-full mt-8 py-6 bg-indigo-600 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-[0.2em] text-[12px]">Publish Framework</button>
        </div>
      )}

      {selectedEventId && selectedEvent ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 bg-indigo-600 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
             <div className="flex items-center gap-6 relative z-10">
               <button onClick={() => setSelectedEventId(null)} className="w-14 h-14 flex items-center justify-center bg-white/15 text-white rounded-2xl hover:bg-white/25 transition-all active:scale-90"><i className="fas fa-chevron-left"></i></button>
               <div>
                 <h2 className="text-3xl font-black text-white tracking-tight leading-none">{selectedEvent.name}</h2>
                 <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.3em] mt-2">Active Strategic Logic</p>
               </div>
             </div>
             <div className="flex bg-black/30 p-2 rounded-3xl border border-white/10 overflow-x-auto no-scrollbar relative z-10 backdrop-blur-md">
               {(['ledger', 'tasks', 'vault', 'team', 'contacts', 'log'] as ProjectTab[]).map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-2xl' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>{tab}</button>
               ))}
             </div>
          </div>

          <div className="min-h-[500px]">
            {activeTab === 'ledger' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Financial Ledger</h3>
                    <div className="space-y-3">
                      {selectedEvent.items.length > 0 ? selectedEvent.items.map(item => (
                        <div key={item.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${item.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                              <i className={`fas ${item.type === 'income' ? 'fa-plus' : 'fa-minus'}`}></i>
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800">{item.description}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.category} • {item.date}</p>
                            </div>
                          </div>
                          <p className={`font-black ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
                          </p>
                        </div>
                      )) : (
                        <div className="py-12 text-center text-slate-300">
                          <i className="fas fa-file-invoice-dollar text-3xl mb-3"></i>
                          <p className="text-[10px] font-black uppercase tracking-widest">No entries recorded</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">Append Entry</h3>
                    <form onSubmit={handleAddItem} className="space-y-4">
                      <input name="description" placeholder="Description" required className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none" />
                      <input name="amount" type="number" step="0.01" placeholder="Amount" required className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none" />
                      <select name="type" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none appearance-none">
                        <option value="expense" className="bg-slate-800">Expense</option>
                        <option value="income" className="bg-slate-800">Income</option>
                      </select>
                      <select name="category" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none appearance-none">
                        {EVENT_ITEM_CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                      </select>
                      <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Authorize Transaction</button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Deployment Milestones</h3>
                  <div className="space-y-6">
                    {selectedEvent.tasks.length > 0 ? selectedEvent.tasks.map(task => (
                      <div key={task.id} className="space-y-3">
                        <div className={`p-5 rounded-[2rem] border transition-all flex items-center gap-4 ${task.completed ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                          <button onClick={() => toggleTaskCompletion(task.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-slate-300'}`}>
                            {task.completed && <i className="fas fa-check"></i>}
                          </button>
                          <p className={`font-black text-sm flex-1 ${task.completed ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>{task.text}</p>
                        </div>
                        
                        {/* Sub Tasks */}
                        <div className="pl-12 space-y-2">
                          {task.subTasks?.map(st => (
                            <div key={st.id} className={`p-3 rounded-2xl border flex items-center gap-3 ${st.completed ? 'bg-emerald-50 border-emerald-100 opacity-60' : 'bg-white border-slate-100'}`}>
                              <button onClick={() => toggleTaskCompletion(st.id, task.id)} className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${st.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-slate-300'}`}>
                                {st.completed && <i className="fas fa-check text-[10px]"></i>}
                              </button>
                              <p className={`font-bold text-xs flex-1 ${st.completed ? 'text-emerald-700 line-through' : 'text-slate-600'}`}>{st.text}</p>
                            </div>
                          ))}
                          <div className="flex gap-2 mt-2">
                             <input 
                               type="text" 
                               placeholder="Add sub-milestone..." 
                               value={subTaskInputs[task.id] || ''}
                               onChange={e => setSubTaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                               onKeyDown={e => e.key === 'Enter' && handleAddSubTask(task.id)}
                               className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                             />
                             <button onClick={() => handleAddSubTask(task.id)} className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-100 transition shadow-sm"><i className="fas fa-plus"></i></button>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="py-20 text-center text-slate-300">
                        <i className="fas fa-list-check text-4xl mb-4"></i>
                        <p className="text-[10px] font-black uppercase tracking-widest">No milestones defined</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">New Framework Milestone</h3>
                  <textarea value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Specify project objective..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold min-h-[120px] outline-none" />
                  <button onClick={handleAddTask} className="w-full mt-4 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Deploy Phase</button>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
                <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8">Authorized Personnel</h3>
                  <div className="space-y-4">
                    {selectedEvent.memberUsernames?.map(username => (
                      <div key={username} className="p-5 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 font-black uppercase">{username[0]}</div>
                          <p className="font-black text-slate-800">{username}</p>
                        </div>
                        <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full uppercase">Collaborator</span>
                      </div>
                    ))}
                    <div className="p-5 bg-indigo-600 text-white rounded-[2.5rem] flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white shadow-sm border border-white/10 font-black uppercase">{currentUser[0]}</div>
                      <p className="font-black flex-1">{currentUser}</p>
                      <span className="text-[8px] font-black bg-white text-indigo-600 px-3 py-1 rounded-full uppercase">Current User</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-10 rounded-[4rem] text-white shadow-2xl">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-8">Grant Access</h3>
                  <div className="space-y-6">
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Authorize a new collaborator to mirror this project in their terminal.</p>
                    <input value={inviteUsername} onChange={e => setInviteUsername(e.target.value)} placeholder="Username" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-black outline-none" />
                    <button onClick={handleAddMember} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-xl">Issue Access Key</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-full flex flex-col">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Project Stakeholders</h3>
                  <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                    {eventContacts.length > 0 ? eventContacts.map(contact => (
                      <div key={contact.id} className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 font-black">
                            {contact.name[0]}
                          </div>
                          <div>
                            <p className="font-black text-slate-800">{contact.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest">{contact.number || contact.email || 'No Details'}</p>
                          </div>
                        </div>
                        <button onClick={() => handleUnlinkContact(contact.id)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                          <i className="fas fa-user-minus"></i>
                        </button>
                      </div>
                    )) : (
                      <div className="py-20 text-center text-slate-300">
                        <i className="fas fa-address-book text-4xl mb-4"></i>
                        <p className="text-[10px] font-black uppercase tracking-widest">No stakeholders linked</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6">Link External Contact</h3>
                    <div className="relative mb-4">
                      <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                      <input 
                        type="text" 
                        placeholder="Search directory..." 
                        value={contactSearch}
                        onChange={e => setContactSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar mb-6">
                      {availableContacts.map(contact => (
                        <button 
                          key={contact.id} 
                          onClick={() => handleLinkContact(contact.id)}
                          className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between transition-all"
                        >
                          <span className="text-xs font-bold">{contact.name}</span>
                          <i className="fas fa-plus-circle text-indigo-400"></i>
                        </button>
                      ))}
                      {availableContacts.length === 0 && (
                        <p className="text-center py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">No available contacts</p>
                      )}
                    </div>
                    <button 
                      onClick={() => setShowContactForm(!showContactForm)}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-xl"
                    >
                      {showContactForm ? 'Cancel' : 'Register New Contact'}
                    </button>
                  </div>

                  {showContactForm && (
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm animate-in slide-in-from-top-4 duration-300">
                      <div className="space-y-4">
                        <input 
                          type="text" 
                          placeholder="Full Name" 
                          value={newContact.name}
                          onChange={e => setNewContact({...newContact, name: e.target.value})}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" 
                        />
                        <input 
                          type="text" 
                          placeholder="Phone Number" 
                          value={newContact.number}
                          onChange={e => setNewContact({...newContact, number: e.target.value})}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" 
                        />
                        <input 
                          type="email" 
                          placeholder="Email Address" 
                          value={newContact.email}
                          onChange={e => setNewContact({...newContact, email: e.target.value})}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" 
                        />
                        <button onClick={handleCreateContact} className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Confirm & Link</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'vault' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in">
                <div className="lg:col-span-2 bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm min-h-[450px]">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8">Digital Assets</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                    {selectedEvent.files.map(file => (
                      <div key={file.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[3rem] flex flex-col items-center text-center group cursor-pointer hover:bg-white hover:border-indigo-500/50 transition-all shadow-sm" onClick={() => handleAssetClick(file)}>
                        <div className={`w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl mb-5 border border-slate-100 group-hover:scale-110 transition-transform`}>
                          <i className={`fas ${file.storageType === 'url' ? 'fa-link' : 'fa-file-invoice'} text-2xl`}></i>
                        </div>
                        <p className="font-black text-[11px] text-slate-800 truncate w-full mb-1">{file.name}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate w-full">{file.storageType === 'url' ? 'Web Link' : 'Secure Vault Asset'}</p>
                      </div>
                    ))}
                    <div className="p-8 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500/30 hover:text-indigo-400 cursor-pointer transition-all group" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 text-slate-300 group-hover:text-indigo-600"><i className="fas fa-file-circle-plus text-xl"></i></div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Link SSD File</span>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm animate-in fade-in">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8">Strategic Log</h3>
                <div className="space-y-4">
                  {selectedEvent.logs?.length ? selectedEvent.logs.map(log => (
                    <div key={log.id} className="p-4 bg-slate-50 border-l-4 border-l-indigo-500 rounded-r-2xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-slate-800">{log.action}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">By {log.username} • {new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                      <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded uppercase">{log.type}</span>
                    </div>
                  )) : (
                    <p className="text-center py-20 text-slate-300 text-[10px] font-black uppercase">No activity history</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
           {events.map(event => (
              <div key={event.id} onClick={() => setSelectedEventId(event.id)} className={`bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl cursor-pointer hover:border-indigo-600/50 hover:-translate-y-2 transition-all group relative overflow-hidden`}>
                <h3 className={`font-black text-slate-800 text-2xl leading-none mb-4 group-hover:text-indigo-600 transition-colors tracking-tight`}>{event.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-12">Modified: {new Date(event.lastUpdated).toLocaleDateString()}</p>
                <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-indigo-50 border-indigo-100 text-indigo-600`}>{event.files.length} Vault Items</div>
              </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default EventPlanner;