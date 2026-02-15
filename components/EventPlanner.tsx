import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BudgetEvent, EventItem, EVENT_ITEM_CATEGORIES, ProjectTask, ProjectFile, EventLog, Contact, User } from '../types';
import { saveFileToHardDrive } from '../services/fileStorageService';

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

type ProjectTab = 'ledger' | 'tasks' | 'vault' | 'team' | 'directory' | 'log';

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
  const [subTaskInput, setSubTaskInput] = useState<{ taskId: string, text: string } | null>(null);

  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', address: '', number: '' });

  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string>('nsv');
  
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  useEffect(() => {
    if (isVideoCallActive && !localStream) {
      const initMedia = async () => {
        setIsConnecting(true);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(stream);
        } catch (err) {
          setIsCameraOff(true);
        } finally {
          setTimeout(() => setIsConnecting(false), 800);
        }
      };
      initMedia();
    } else if (!isVideoCallActive && localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
  }, [isVideoCallActive]);

  useEffect(() => {
    if (videoRef.current && localStream && !isCameraOff) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOff]);

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
    if (!selectedEvent || !subTaskInput || !subTaskInput.text.trim()) return;
    const newSubTask: ProjectTask = {
      id: generateId(),
      text: subTaskInput.text.trim(),
      completed: false,
      assignedToId: currentUser,
      subTasks: []
    };

    const parentTask = selectedEvent.tasks.find(t => t.id === parentTaskId);
    const updatedTasks = selectedEvent.tasks.map(t => {
      if (t.id === parentTaskId) {
        return { ...t, subTasks: [...(t.subTasks || []), newSubTask] };
      }
      return t;
    });

    const updatedEvent = { ...selectedEvent, tasks: updatedTasks };
    addActionLog(updatedEvent, `Added sub-task "${newSubTask.text}" to "${parentTask?.text}"`, 'task');
    setSubTaskInput(null);
  };

  const toggleTaskCompletion = (taskId: string, parentTaskId?: string) => {
    if (!selectedEvent) return;
    
    let taskName = "";
    let updatedTasks: ProjectTask[];
    if (parentTaskId) {
      updatedTasks = selectedEvent.tasks.map(t => {
        if (t.id === parentTaskId) {
          const sub = (t.subTasks || []).find(st => st.id === taskId);
          taskName = sub?.text || "";
          return {
            ...t,
            subTasks: (t.subTasks || []).map(st => st.id === taskId ? { ...st, completed: !st.completed } : st)
          };
        }
        return t;
      });
    } else {
      updatedTasks = selectedEvent.tasks.map(t => {
        if (t.id === taskId) {
          taskName = t.text;
          return { ...t, completed: !t.completed };
        }
        return t;
      });
    }
    
    const updatedEvent = { ...selectedEvent, tasks: updatedTasks };
    addActionLog(updatedEvent, `Marked task "${taskName}" as ${updatedTasks.find(t => t.id === (parentTaskId || taskId))?.completed ? 'resolved' : 'pending'}`, 'task');
  };

  const handleAddMember = () => {
    if (!selectedEvent || !inviteUsername.trim()) return;
    const currentMembers = selectedEvent.memberUsernames || [];
    if (currentMembers.includes(inviteUsername.trim())) return;
    
    const updatedEvent = { 
      ...selectedEvent, 
      memberUsernames: [...currentMembers, inviteUsername.trim()] 
    };
    addActionLog(updatedEvent, `Authorized user "${inviteUsername.trim()}" for project access`, 'team');
    setInviteUsername('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!selectedEvent || !file) return;

    const newFile: ProjectFile = {
      id: generateId(),
      name: file.name,
      type: file.type,
      size: file.size,
      timestamp: new Date().toISOString(),
      storageRef: generateId(),
      storageType: 'indexeddb',
      version: 1,
      lastModifiedBy: currentUser
    };
    
    const updatedEvent = { ...selectedEvent, files: [...(selectedEvent.files || []), newFile] };
    addActionLog(updatedEvent, `Injected asset: "${file.name}"`, 'file');
  };

  const handleAddContactToProject = () => {
    if (!selectedEvent || !contactForm.name.trim()) return;
    const newContact: Contact = {
      id: generateId(),
      name: contactForm.name.trim(),
      email: contactForm.email.trim(),
      address: contactForm.address.trim(),
      number: contactForm.number.trim(),
    };

    onUpdateContacts([...contacts, newContact]);
    const updatedEvent = {
      ...selectedEvent,
      contactIds: [...(selectedEvent.contactIds || []), newContact.id]
    };
    addActionLog(updatedEvent, `Integrated stakeholder: "${newContact.name}"`, 'contact');

    setIsAddingContact(false);
    setContactForm({ name: '', email: '', address: '', number: '' });
  };

  const projectContacts = useMemo(() => {
    if (!selectedEvent) return [];
    return contacts.filter(c => selectedEvent.contactIds?.includes(c.id));
  }, [contacts, selectedEvent]);

  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className={`space-y-6 pb-20 max-w-6xl mx-auto px-2 ${!isAdmin ? 'text-slate-200' : ''}`}>
      {/* Presence Header */}
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-[3rem] border border-slate-800 backdrop-blur-2xl mb-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="flex -space-x-4">
            {MOCK_ONLINE_USERS.filter(u => u.online).map(u => (
              <div key={u.id} className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[11px] font-black uppercase ring-2 ring-indigo-500/20 shadow-2xl" title={`${u.name} online`}>
                {u.name[0]}
                <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-lg"></span>
              </div>
            ))}
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block leading-none mb-1.5">Satellite Uplink Active</span>
            <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">{MOCK_ONLINE_USERS.filter(u => u.online).length} Peer Connections Established</span>
          </div>
        </div>
        <button 
          onClick={() => setIsVideoCallActive(!isVideoCallActive)}
          className={`px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${isVideoCallActive ? 'bg-rose-600 text-white animate-pulse shadow-rose-600/30 shadow-2xl' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30 shadow-2xl active:scale-95'}`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${isVideoCallActive ? 'bg-white' : 'bg-indigo-400'} animate-ping`}></div>
          {isVideoCallActive ? 'Terminate Bridge' : 'Deploy Video Bridge'}
        </button>
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className={`text-4xl font-black tracking-tighter ${isAdmin ? 'text-slate-800' : 'text-white'}`}>Project Matrix</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Cross-Functional Strategy Command</p>
        </div>
        {isAdmin && !selectedEventId && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-500 transition-all active:scale-95">
            <i className={`fas ${showAddForm ? 'fa-times' : 'fa-plus'}`}></i> {showAddForm ? 'Abort' : 'Initiate Project'}
          </button>
        )}
      </div>

      {showAddForm && !selectedEventId && (
        <div className="p-12 bg-white border border-slate-100 rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 mb-8">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Project Alias (Matrix Identity)</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. MISSION_RETIREMENT_2030" className="w-full p-6 bg-slate-50 border border-slate-200 text-slate-800 rounded-3xl outline-none font-black text-xl focus:ring-4 focus:ring-indigo-500/20" />
          </div>
          <button onClick={() => { if (!newName) return; onAddEvent({ name: newName, date: new Date().toISOString().split('T')[0], status: 'active' }); setShowAddForm(false); setNewName(''); }} className="w-full mt-8 py-6 bg-indigo-600 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-[0.2em] text-[12px] hover:bg-indigo-500 transition-all">Deploy Operational Frame</button>
        </div>
      )}

      {selectedEventId && selectedEvent ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 bg-indigo-600 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
             <div className="flex items-center gap-6 relative z-10">
               <button onClick={() => setSelectedEventId(null)} className="w-14 h-14 flex items-center justify-center bg-white/15 text-white rounded-2xl hover:bg-white/25 transition-all active:scale-90"><i className="fas fa-chevron-left"></i></button>
               <div>
                 <h2 className="text-3xl font-black text-white tracking-tight leading-none">{selectedEvent.name}</h2>
                 <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.3em] mt-2">Active Framework</p>
               </div>
             </div>
             <div className="flex bg-black/30 p-2 rounded-3xl border border-white/10 overflow-x-auto no-scrollbar max-w-full relative z-10 backdrop-blur-md">
               {(['ledger', 'tasks', 'vault', 'team', 'directory', 'log'] as ProjectTab[]).map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all min-w-max ${activeTab === tab ? 'bg-white text-slate-900 shadow-2xl' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>{tab}</button>
               ))}
             </div>
          </div>

          <div className="min-h-[500px]">
            {activeTab === 'ledger' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl">
                    <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.4em] mb-10">Resource Allocation Stream</h3>
                    <div className="space-y-4">
                      {selectedEvent.items.length > 0 ? selectedEvent.items.map(item => (
                        <div key={item.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between group hover:bg-white hover:border-indigo-500/30 transition-all">
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg ${item.type === 'income' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}>
                              <i className={`fas ${item.type === 'income' ? 'fa-plus-circle' : 'fa-minus-circle'}`}></i>
                            </div>
                            <div>
                              <p className="font-black text-sm text-slate-800">{item.description}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.category} • {item.date}</p>
                            </div>
                          </div>
                          <p className={`font-black text-xl ${item.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>${item.amount.toLocaleString()}</p>
                        </div>
                      )) : <div className="py-20 text-center text-slate-300 uppercase text-[10px] font-black">No entries logged</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-2xl h-fit">
                   <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.3em] mb-8 text-center">Execute Entry</h3>
                   <form onSubmit={handleAddItem} className="space-y-6">
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block tracking-widest">Description</label><input name="description" className="w-full p-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500" required /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block tracking-widest">Amount ($)</label><input name="amount" type="number" step="0.01" className="w-full p-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <select name="type" className="p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-black uppercase text-[8px] tracking-widest outline-none">
                        <option value="expense">Expense</option><option value="income">Income</option>
                      </select>
                      <select name="category" className="p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-black uppercase text-[8px] tracking-widest outline-none">
                        {EVENT_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500 transition-all">Broadcast Log</button>
                   </form>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl">
                  <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.4em] mb-10">Operational Roadmaps</h3>
                  <div className="space-y-6">
                    {selectedEvent.tasks.length > 0 ? selectedEvent.tasks.map(task => (
                      <div key={task.id} className="space-y-3">
                        <div className={`p-6 bg-slate-50 border rounded-[2.5rem] flex items-center gap-6 group transition-all ${task.completed ? 'border-emerald-200 opacity-60' : 'border-slate-100 hover:border-indigo-200'}`}>
                          <button onClick={() => toggleTaskCompletion(task.id)} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20' : 'bg-white border-slate-200 text-transparent'}`}><i className="fas fa-check text-sm"></i></button>
                          <div className="flex-1">
                            <p className={`font-black text-md ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.text}</p>
                            <button onClick={() => setSubTaskInput(subTaskInput?.taskId === task.id ? null : { taskId: task.id, text: '' })} className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mt-1 hover:underline">+ Add Sub-Task</button>
                          </div>
                        </div>
                        {(task.subTasks || []).length > 0 && (
                          <div className="ml-16 space-y-2 border-l-2 border-slate-100 pl-6">
                            {task.subTasks?.map(sub => (
                              <div key={sub.id} className={`p-4 bg-slate-50/50 border rounded-[1.5rem] flex items-center gap-4 transition-all ${sub.completed ? 'border-emerald-100 opacity-60' : 'border-slate-100'}`}>
                                <button onClick={() => toggleTaskCompletion(sub.id, task.id)} className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${sub.completed ? 'bg-emerald-400 border-emerald-400 text-white' : 'bg-white border-slate-200 text-transparent'}`}><i className="fas fa-check text-[10px]"></i></button>
                                <p className={`text-xs font-bold ${sub.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{sub.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {subTaskInput?.taskId === task.id && (
                          <div className="ml-16 animate-in slide-in-from-left-4 duration-300">
                            <div className="flex gap-2">
                              <input value={subTaskInput.text} onChange={e => setSubTaskInput({ ...subTaskInput, text: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleAddSubTask(task.id)} placeholder="Sub-task description..." className="flex-1 p-3 bg-slate-50 border border-indigo-200 rounded-xl text-xs font-bold outline-none" autoFocus />
                              <button onClick={() => handleAddSubTask(task.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Add</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )) : <div className="py-20 text-center text-slate-300 uppercase text-[10px] font-black">No objectives deployed</div>}
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-2xl h-fit">
                   <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.3em] mb-8 text-center">Deploy Objective</h3>
                   <textarea value={taskText} onChange={e => setTaskText(e.target.value)} className="w-full p-6 bg-slate-50 border border-slate-200 text-slate-800 rounded-3xl font-black text-xs h-40 no-scrollbar outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Describe the objective..."></textarea>
                   <button onClick={handleAddTask} className="w-full mt-6 py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500 transition-all">Publish Milestone</button>
                </div>
              </div>
            )}

            {activeTab === 'directory' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl min-h-[450px]">
                  <div className="flex justify-between items-center mb-10">
                    <div><h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.4em]">Project Directory</h3><p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Stakeholder Register</p></div>
                    <button onClick={() => setIsAddingContact(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all">+ New Contact</button>
                  </div>
                  <div className="space-y-4">
                    {projectContacts.length > 0 ? projectContacts.map(contact => (
                      <div key={contact.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:bg-white hover:border-indigo-500/30 transition-all shadow-sm">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-lg font-black text-xl uppercase border border-slate-100">{contact.name[0]}</div>
                          <div>
                            <p className="font-black text-lg text-slate-800 tracking-tight leading-none">{contact.name}</p>
                            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{contact.email}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{contact.number}</p>
                          </div>
                        </div>
                        {contact.address && <div className="md:text-right max-w-[200px]"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</p><p className="text-[11px] font-bold text-slate-600 leading-relaxed">{contact.address}</p></div>}
                      </div>
                    )) : <div className="py-24 text-center text-slate-300 uppercase text-[10px] font-black border-2 border-dashed border-slate-100 rounded-[3.5rem]">Directory Empty</div>}
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-2xl h-fit">
                   <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.3em] mb-4 text-center">Global Contacts</h3>
                   <p className="text-[9px] text-slate-400 font-bold uppercase text-center mb-8">Integrated Platform Access</p>
                   <div className="space-y-3">
                     {contacts.length === 0 && <p className="text-center text-[9px] text-slate-300 font-black uppercase">No global entries</p>}
                     {contacts.filter(c => !selectedEvent.contactIds?.includes(c.id)).map(c => (
                       <button key={c.id} onClick={() => onUpdateEvent({...selectedEvent, contactIds: [...(selectedEvent.contactIds || []), c.id]})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 hover:border-indigo-500/30 transition-all group">
                         <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-xs font-black text-indigo-600 shadow-sm border border-slate-100">{c.name[0]}</div>
                         <div className="flex-1 text-left"><p className="text-[10px] font-black text-slate-800">{c.name}</p></div>
                         <i className="fas fa-plus text-[8px] text-slate-300 group-hover:text-indigo-600"></i>
                       </button>
                     ))}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div className="animate-in fade-in duration-300">
                <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl min-h-[500px]">
                  <div className="flex justify-between items-center mb-10">
                    <div><h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.4em]">Audit Timeline</h3><p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Operational Log • {currentUser}</p></div>
                    <div className="px-4 py-2 bg-slate-100 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest">Secure AES-256 Storage</div>
                  </div>
                  <div className="space-y-8 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
                    {selectedEvent.logs && selectedEvent.logs.length > 0 ? selectedEvent.logs.map(log => (
                      <div key={log.id} className="relative pl-12 group">
                        <div className={`absolute left-0 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center text-[10px] shadow-sm z-10 transition-transform group-hover:scale-110 ${
                          log.type === 'transaction' ? 'bg-emerald-500 text-white' : 
                          log.type === 'task' ? 'bg-indigo-500 text-white' : 
                          log.type === 'file' ? 'bg-amber-500 text-white' : 
                          'bg-slate-200 text-slate-500'
                        }`}>
                          <i className={`fas ${
                            log.type === 'transaction' ? 'fa-wallet' : 
                            log.type === 'task' ? 'fa-check-circle' : 
                            log.type === 'file' ? 'fa-file-alt' : 
                            'fa-info-circle'
                          }`}></i>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem] group-hover:bg-white group-hover:border-indigo-100 transition-all">
                          <div className="flex justify-between items-center mb-2">
                             <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{log.username}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{getTimeAgo(log.timestamp)}</p>
                          </div>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed">{log.action}</p>
                        </div>
                      </div>
                    )) : <div className="py-20 text-center text-slate-300 uppercase text-[10px] font-black">Timeline Origin Point • No activity logged</div>}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'team' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-2xl">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.4em]">Access Matrix</h3>
                    <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 text-[9px] font-black text-indigo-600 uppercase tracking-widest">{selectedEvent.memberUsernames?.length || 1} Stakeholders</div>
                  </div>
                  <div className="space-y-4">
                    {(selectedEvent.memberUsernames || [ADMIN_USER]).map(username => (
                      <div key={username} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 font-black uppercase text-xl">{username[0]}</div>
                          <div><p className="font-black text-md text-slate-800">{username}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{username === ADMIN_USER ? 'Project Originator' : 'Matrix Collaborator'}</p></div>
                        </div>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </div>
                {isAdmin && (
                  <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-2xl h-fit">
                    <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.3em] mb-8 text-center">Grant Access</h3>
                    <div className="space-y-6">
                      <input value={inviteUsername} onChange={e => setInviteUsername(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Username..." />
                      <button onClick={handleAddMember} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500 transition-all">Authorize User</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'vault' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl min-h-[450px]">
                  <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.4em] mb-10">Strategic Data Vault</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                    {selectedEvent.files.map(file => (
                      <div key={file.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[3rem] flex flex-col items-center text-center group cursor-pointer hover:bg-white hover:border-indigo-500/50 transition-all shadow-sm">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl mb-5 border border-slate-100"><i className="fas fa-file-invoice text-2xl"></i></div>
                        <p className="font-black text-[11px] text-slate-800 truncate w-full mb-1">{file.name}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">v{file.version} • {file.lastModifiedBy}</p>
                      </div>
                    ))}
                    <div className="p-8 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500/30 hover:text-indigo-400 cursor-pointer transition-all group" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 text-slate-300"><i className="fas fa-plus text-xl"></i></div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Inject Asset</span>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
           {events.map(event => (
              <div key={event.id} onClick={() => setSelectedEventId(event.id)} className={`${isAdmin ? 'bg-white' : 'bg-slate-900'} p-10 rounded-[4rem] border ${isAdmin ? 'border-slate-100' : 'border-slate-800'} shadow-2xl cursor-pointer hover:border-indigo-600/50 hover:-translate-y-2 transition-all group relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex justify-between items-start mb-12">
                  <div className={`w-16 h-16 ${isAdmin ? 'bg-slate-50 border-slate-100' : 'bg-slate-800 border-slate-700'} rounded-2xl flex items-center justify-center text-slate-600 group-hover:text-indigo-600 transition-all border`}><i className="fas fa-layer-group text-2xl"></i></div>
                  <div className="flex -space-x-3">
                    {(event.memberUsernames || [ADMIN_USER]).slice(0, 3).map(u => (
                      <div key={u} className={`${isAdmin ? 'bg-white border-slate-100' : 'bg-slate-800 border-slate-900'} w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] font-black uppercase ring-2 ring-indigo-500/10`} title={u}>{u[0]}</div>
                    ))}
                  </div>
                </div>
                <h3 className={`font-black ${isAdmin ? 'text-slate-800' : 'text-white'} text-2xl leading-none mb-4 group-hover:text-indigo-600 transition-colors tracking-tight`}>{event.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-12">Modified: {new Date(event.lastUpdated).toLocaleDateString()}</p>
                <div className="flex flex-wrap gap-3">
                  <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${isAdmin ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-800/60 border-slate-700/50 text-indigo-400'}`}>{event.files.length} Assets</div>
                  <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${isAdmin ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-800/60 border-slate-700/50 text-emerald-400'}`}>{event.tasks.filter(t => t.completed).length}/{event.tasks.length} Resolved</div>
                </div>
              </div>
           ))}
        </div>
      )}

      {/* ADD CONTACT MODAL */}
      {isAddingContact && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
           <div className="bg-white max-w-md w-full p-12 rounded-[4rem] shadow-3xl animate-in zoom-in-95 duration-300 border border-slate-100">
              <h3 className="text-2xl font-black text-slate-800 text-center mb-2 tracking-tight">Provision Identity</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] text-center mb-10">Add Stakeholder to Matrix</p>
              <div className="space-y-6">
                <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Name</label><input value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs outline-none focus:ring-4 focus:ring-indigo-500/10" /></div>
                <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Email</label><input value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs outline-none focus:ring-4 focus:ring-indigo-500/10" /></div>
                <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Address</label><textarea value={contactForm.address} onChange={e => setContactForm({...contactForm, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs h-24 no-scrollbar outline-none focus:ring-4 focus:ring-indigo-500/10" /></div>
                <div className="flex gap-4 pt-4">
                  <button onClick={handleAddContactToProject} className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-[1.5rem] shadow-2xl uppercase tracking-[0.2em] text-[11px] hover:bg-indigo-500 transition-all">Authorize Contact</button>
                  <button onClick={() => setIsAddingContact(false)} className="px-6 py-5 bg-slate-100 text-slate-500 font-black rounded-[1.5rem] uppercase tracking-[0.2em] text-[11px]">Abort</button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default EventPlanner;