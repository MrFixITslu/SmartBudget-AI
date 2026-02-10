
import React, { useState, useMemo, useRef } from 'react';
import { BudgetEvent, EventItem, EVENT_ITEM_CATEGORIES, EventItemCategory, ProjectTask, ProjectFile, ProjectNote, Contact } from '../types';

interface Props {
  events: BudgetEvent[];
  contacts: Contact[];
  onAddEvent: (event: Omit<BudgetEvent, 'id' | 'items' | 'notes' | 'tasks' | 'files' | 'contactIds'>) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (event: BudgetEvent) => void;
  onUpdateContacts: (contacts: Contact[]) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

type ProjectTab = 'ledger' | 'tasks' | 'vault' | 'contacts' | 'log' | 'review';

const EventPlanner: React.FC<Props> = ({ events, contacts, onAddEvent, onDeleteEvent, onUpdateEvent, onUpdateContacts }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('ledger');
  const [showUniversalPicker, setShowUniversalPicker] = useState(false);
  
  // New Project Form
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  // Task & Content States
  const [taskText, setTaskText] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [noteText, setNoteText] = useState('');

  // Contact States
  const [cName, setCName] = useState('');
  const [cNum, setCNum] = useState('');
  const [cEmail, setCEmail] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEvent = useMemo(() => 
    events.find(e => e.id === selectedEventId), 
    [events, selectedEventId]
  );

  const projectContacts = useMemo(() => {
    if (!selectedEvent) return [];
    const contactIds = Array.isArray(selectedEvent.contactIds) ? selectedEvent.contactIds : [];
    return (Array.isArray(contacts) ? contacts : []).filter(c => contactIds.includes(c.id));
  }, [selectedEvent, contacts]);

  const stats = useMemo(() => {
    if (!selectedEvent) return { income: 0, expenses: 0, net: 0 };
    const items = Array.isArray(selectedEvent.items) ? selectedEvent.items : [];
    const income = items.filter(i => i.type === 'income').reduce((acc, i) => acc + i.amount, 0);
    const expenses = items.filter(i => i.type === 'expense').reduce((acc, i) => acc + i.amount, 0);
    return { income, expenses, net: income - expenses };
  }, [selectedEvent]);

  const handleAddItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEvent) return;
    const formData = new FormData(e.currentTarget);
    const newItem: EventItem = {
      id: generateId(),
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      type: formData.get('type') as 'income' | 'expense',
      category: formData.get('category') as EventItemCategory,
      notes: formData.get('notes') as string,
      date: new Date().toISOString().split('T')[0]
    };
    const items = Array.isArray(selectedEvent.items) ? selectedEvent.items : [];
    onUpdateEvent({ ...selectedEvent, items: [...items, newItem] });
    e.currentTarget.reset();
  };

  const addTask = () => {
    if (!selectedEvent || !taskText.trim()) return;
    const newTask: ProjectTask = {
      id: generateId(),
      text: taskText,
      completed: false,
      dueDate: taskDueDate || undefined
    };
    const tasks = Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : [];
    onUpdateEvent({ ...selectedEvent, tasks: [...tasks, newTask] });
    setTaskText('');
    setTaskDueDate('');
  };

  const toggleTask = (taskId: string) => {
    if (!selectedEvent) return;
    const tasks = Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : [];
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { 
        ...t, 
        completed: !t.completed, 
        completionDate: !t.completed ? new Date().toLocaleString() : undefined 
      } : t
    );
    onUpdateEvent({ ...selectedEvent, tasks: updatedTasks });
  };

  const addContactToProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !cName.trim()) return;
    
    const newContact: Contact = {
      id: generateId(),
      name: cName,
      number: cNum,
      email: cEmail
    };
    
    onUpdateContacts([...(Array.isArray(contacts) ? contacts : []), newContact]);
    const contactIds = Array.isArray(selectedEvent.contactIds) ? selectedEvent.contactIds : [];
    onUpdateEvent({ ...selectedEvent, contactIds: [...contactIds, newContact.id] });
    
    setCName(''); setCNum(''); setCEmail('');
  };

  const linkExistingContact = (contactId: string) => {
    if (!selectedEvent) return;
    const contactIds = Array.isArray(selectedEvent.contactIds) ? selectedEvent.contactIds : [];
    if (contactIds.includes(contactId)) return;
    onUpdateEvent({ ...selectedEvent, contactIds: [...contactIds, contactId] });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEvent) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newFile: ProjectFile = {
        id: generateId(),
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result as string, // base64
        timestamp: new Date().toLocaleString()
      };
      const files = Array.isArray(selectedEvent.files) ? selectedEvent.files : [];
      onUpdateEvent({ ...selectedEvent, files: [...files, newFile] });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openFile = (file: ProjectFile) => {
    try {
      const base64Parts = file.data.split(',');
      const mime = base64Parts[0].match(/:(.*?);/)?.[1] || file.type;
      const b64Data = base64Parts[1];
      
      const byteCharacters = atob(b64Data);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      const blob = new Blob(byteArrays, { type: mime });
      const url = URL.createObjectURL(blob);
      
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("Failed to open file:", error);
      alert("Unable to open file.");
    }
  };

  const addNote = () => {
    if (!selectedEvent || !noteText.trim()) return;
    const newNote: ProjectNote = {
      id: generateId(),
      text: noteText,
      timestamp: new Date().toLocaleString()
    };
    const notes = Array.isArray(selectedEvent.notes) ? selectedEvent.notes : [];
    onUpdateEvent({ ...selectedEvent, notes: [newNote, ...notes] });
    setNoteText('');
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto px-2">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Project Hub</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Lifecycle Management & Intelligence</p>
        </div>
        {!selectedEventId && (
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${showAddForm ? 'bg-rose-50 text-rose-600' : 'bg-slate-900 text-white shadow-xl'}`}
          >
            <i className={`fas ${showAddForm ? 'fa-times' : 'fa-plus'}`}></i>
            {showAddForm ? 'Cancel' : 'Initiate Project'}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="p-10 bg-white border border-slate-200 rounded-[3rem] shadow-sm animate-in zoom-in-95 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Project Designation</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Annual Tech Conference" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Target Launch Date</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" />
            </div>
          </div>
          <button onClick={() => { if (!newName) return; onAddEvent({ name: newName, date: newDate, status: 'active' }); setShowAddForm(false); setNewName(''); }} className="w-full mt-10 py-5 bg-indigo-600 text-white font-black rounded-[2rem] shadow-xl uppercase tracking-widest text-[11px] hover:bg-slate-900 transition">Establish Project Structure</button>
        </div>
      )}

      {!selectedEventId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(Array.isArray(events) ? events : []).map(event => {
            const evStats = calculatePnL(event);
            const tasks = Array.isArray(event.tasks) ? event.tasks : [];
            const taskProgress = tasks.length ? (tasks.filter(t => t.completed).length / tasks.length) * 100 : 0;
            return (
              <div key={event.id} onClick={() => { setSelectedEventId(event.id); setActiveTab('ledger'); }} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col justify-between h-full relative overflow-hidden">
                {event.status === 'completed' && (
                  <div className={`absolute top-0 right-0 px-4 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-bl-2xl ${event.outcome === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {event.outcome || 'Finalized'}
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-black text-slate-800 text-base truncate group-hover:text-indigo-600 transition-colors">{event.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-1">{event.date}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 p-4 rounded-3xl">
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Financial Net</p>
                      <p className={`text-sm font-black ${evStats.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>${evStats.net.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-3xl">
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Status</p>
                      <p className="text-sm font-black text-slate-800 capitalize">{event.status}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Operational Efficiency</span>
                    <span>{taskProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${taskProgress}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
              <i className="fas fa-folder-plus text-slate-200 text-5xl mb-4"></i>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No active project frameworks found</p>
            </div>
          )}
        </div>
      ) : selectedEvent && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 pointer-events-none"><i className="fas fa-microchip text-[140px] text-white"></i></div>
             <div className="relative z-10">
               <div className="flex items-center gap-4 mb-3">
                 <button onClick={() => setSelectedEventId(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded-xl hover:bg-white/20 transition"><i className="fas fa-arrow-left"></i></button>
                 <div>
                   <h2 className="text-2xl font-black text-white tracking-tight">{selectedEvent.name}</h2>
                   <div className="flex items-center gap-2 mt-1">
                     <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${selectedEvent.status === 'completed' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}`}>{selectedEvent.status}</span>
                     {selectedEvent.status === 'completed' && <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${selectedEvent.outcome === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{selectedEvent.outcome}</span>}
                   </div>
                 </div>
               </div>
             </div>
             <div className="relative z-10 flex bg-white/5 p-1.5 rounded-[1.5rem] border border-white/10 overflow-x-auto no-scrollbar">
               {(['ledger', 'tasks', 'vault', 'contacts', 'log', 'review'] as ProjectTab[]).map(tab => {
                 if (tab === 'review' && selectedEvent.status !== 'completed') return null;
                 return (
                   <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}>{tab}</button>
                 );
               })}
             </div>
          </div>

          <div className="min-h-[500px]">
            {activeTab === 'ledger' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in">
                <div className="lg:col-span-3 space-y-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                      <div>
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Operational Ledger</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time P&L Audit</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Net Flow</p>
                        <p className={`text-xl font-black ${stats.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>${stats.net.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {(Array.isArray(selectedEvent.items) ? selectedEvent.items : []).map(item => (
                        <div key={item.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 transition shadow-sm">
                          <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg ${item.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}><i className={`fas ${item.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i></div>
                            <div>
                              <p className="font-black text-sm text-slate-800">{item.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{item.category}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.date}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-black text-base ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}</p>
                            <button onClick={() => onUpdateEvent({...selectedEvent, items: (Array.isArray(selectedEvent.items) ? selectedEvent.items : []).filter(i => i.id !== item.id)})} className="text-[8px] font-black text-slate-300 uppercase tracking-widest hover:text-rose-500 transition">Delete</button>
                          </div>
                        </div>
                      ))}
                      {(!Array.isArray(selectedEvent.items) || selectedEvent.items.length === 0) && <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem]"><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No financial events recorded</p></div>}
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-8">Record Movement</h3>
                    <form onSubmit={handleAddItem} className="space-y-6">
                      <select name="type" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"><option value="expense">Expense (-)</option><option value="income">Revenue (+)</option></select>
                      <select name="category" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-[10px] outline-none focus:ring-2 focus:ring-indigo-500">{EVENT_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                      <input name="description" required placeholder="Event description..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" />
                      <input name="amount" type="number" step="0.01" required placeholder="Amount ($)..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500" />
                      <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[9px] hover:bg-indigo-600 transition">Authorize Entry</button>
                    </form>
                  </div>
                  {selectedEvent.status === 'active' && (
                    <button onClick={() => { if (confirm('Mark this project as complete?')) onUpdateEvent({...selectedEvent, status: 'completed'}); }} className="w-full py-5 bg-indigo-600 text-white font-black rounded-[2rem] shadow-xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition">Archive Project</button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in">
                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-8">Operational Roadmap</h3>
                    <div className="space-y-4">
                      {(Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : []).map(task => {
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
                        return (
                          <div key={task.id} className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${task.completed ? 'bg-slate-50 border-slate-100 opacity-60' : isOverdue ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex items-center gap-5">
                              <button onClick={() => toggleTask(task.id)} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${task.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-transparent hover:bg-slate-300'}`}><i className="fas fa-check"></i></button>
                              <div>
                                <p className={`font-black text-sm ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.text}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-1">
                                  {task.dueDate && <span className={`text-[8px] font-black uppercase tracking-widest ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`}><i className="far fa-clock mr-1"></i> Due: {task.dueDate}</span>}
                                  {task.completionDate && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500"><i className="fas fa-check-double mr-1"></i> Executed: {task.completionDate}</span>}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => onUpdateEvent({...selectedEvent, tasks: (Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : []).filter(t => t.id !== task.id)})} className="text-slate-300 hover:text-rose-500 transition px-2"><i className="fas fa-trash-alt text-[10px]"></i></button>
                          </div>
                        );
                      })}
                      {(!Array.isArray(selectedEvent.tasks) || selectedEvent.tasks.length === 0) && <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-[10px] font-black text-slate-300 uppercase tracking-widest">No strategic tasks assigned</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-8">New Objective</h3>
                  <div className="space-y-5">
                    <textarea value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="Operational requirement..." className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs resize-none"></textarea>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block">Deadline</label><input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-[10px] font-bold" /></div>
                    <button onClick={addTask} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[9px] hover:bg-slate-900 transition">Assign Task</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vault' && (
              <div className="animate-in fade-in space-y-8">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Vault: /{selectedEvent.name.replace(/\s+/g, '-').toLowerCase()}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Encrypted Local Asset Storage</p>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition shadow-lg"><i className="fas fa-upload mr-2"></i> Upload Asset</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {(Array.isArray(selectedEvent.files) ? selectedEvent.files : []).map(file => (
                      <div 
                        key={file.id} 
                        onClick={() => openFile(file)}
                        className="group relative bg-slate-50 border border-slate-100 rounded-[2rem] p-5 text-center hover:bg-white hover:shadow-xl transition-all cursor-pointer"
                      >
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 text-xl mx-auto mb-4 group-hover:text-indigo-600 transition shadow-sm"><i className={`fas ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file-alt'}`}></i></div>
                        <p className="text-[10px] font-black text-slate-800 truncate mb-1">{file.name}</p>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{file.timestamp}</p>
                        <div className="mt-2 text-[8px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Click to View</div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateEvent({...selectedEvent, files: (Array.isArray(selectedEvent.files) ? selectedEvent.files : []).filter(f => f.id !== file.id)}); }} 
                            className="w-6 h-6 bg-rose-50 text-rose-500 rounded-lg text-[8px] flex items-center justify-center hover:bg-rose-500 hover:text-white transition"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!Array.isArray(selectedEvent.files) || selectedEvent.files.length === 0) && <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]"><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No assets in repository</p></div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in">
                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em]">Project Stakeholders</h3>
                      <button onClick={() => setShowUniversalPicker(!showUniversalPicker)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition">
                        {showUniversalPicker ? 'Hide Repository' : 'Link from Repository'}
                      </button>
                    </div>
                    {showUniversalPicker && (
                      <div className="mb-10 p-8 bg-slate-900 rounded-[2rem] text-white">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Universal Relationship Ledger</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(Array.isArray(contacts) ? contacts : []).filter(c => !((Array.isArray(selectedEvent.contactIds) ? selectedEvent.contactIds : [])).includes(c.id)).map(c => (
                            <div key={c.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex justify-between items-center group">
                               <div><p className="font-black text-sm">{c.name}</p><p className="text-[9px] text-white/40 font-bold">{c.email}</p></div>
                               <button onClick={() => linkExistingContact(c.id)} className="px-4 py-2 bg-white/10 hover:bg-indigo-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition">Connect</button>
                            </div>
                          ))}
                          {(Array.isArray(contacts) ? contacts : []).filter(c => !((Array.isArray(selectedEvent.contactIds) ? selectedEvent.contactIds : [])).includes(c.id)).length === 0 && <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest py-4 text-center col-span-full">No available contacts to link</p>}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {projectContacts.map(c => (
                        <div key={c.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col justify-between group hover:bg-white hover:shadow-xl transition-all">
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><i className="fas fa-user-tie"></i></div>
                              <div><p className="font-black text-base text-slate-800">{c.name}</p><p className="text-[10px] text-indigo-500 font-bold uppercase">{c.email}</p></div>
                            </div>
                            <button onClick={() => onUpdateEvent({...selectedEvent, contactIds: (Array.isArray(selectedEvent.contactIds) ? selectedEvent.contactIds : []).filter(id => id !== c.id)})} className="text-slate-300 hover:text-rose-500 transition px-2"><i className="fas fa-user-minus text-[10px]"></i></button>
                          </div>
                          <div className="flex items-center gap-5 mt-4">
                             <div className="flex items-center gap-2 text-slate-400"><i className="fas fa-mobile-alt text-xs"></i><span className="text-[11px] font-black">{c.number}</span></div>
                             <div className="flex items-center gap-2 text-slate-400"><i className="far fa-envelope text-xs"></i><span className="text-[11px] font-black uppercase tracking-tighter">Email Active</span></div>
                          </div>
                        </div>
                      ))}
                      {projectContacts.length === 0 && <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-[10px] font-black text-slate-300 uppercase tracking-widest">No stakeholders linked to project</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                   <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-8">New Global Link</h3>
                   <form onSubmit={addContactToProject} className="space-y-5">
                     <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block">Full Name</label><input value={cName} onChange={e => setCName(e.target.value)} required placeholder="Neil V." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs" /></div>
                     <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block">Mobile Line</label><input value={cNum} onChange={e => setCNum(e.target.value)} placeholder="+1 (758)..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs" /></div>
                     <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block">E-Mail Address</label><input value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="contact@pro.hub" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs" /></div>
                     <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[9px] hover:bg-indigo-600 transition">Archive & Connect</button>
                   </form>
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in">
                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm h-full max-h-[700px] overflow-y-auto no-scrollbar">
                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-10">Strategic Journal</h3>
                    <div className="space-y-10 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                      {(Array.isArray(selectedEvent.notes) ? selectedEvent.notes : []).map(note => (
                        <div key={note.id} className="relative pl-12">
                          <div className="absolute left-0 top-1 w-10 h-10 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center z-10 text-indigo-500 shadow-sm"><i className="fas fa-pencil-alt text-[10px]"></i></div>
                          <div className="bg-slate-50 p-7 rounded-[2.5rem] border border-slate-100 shadow-sm group">
                            <p className="text-[13px] font-medium leading-relaxed text-slate-700">{note.text}</p>
                            <div className="flex justify-between items-center mt-5">
                              <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{note.timestamp}</p>
                              <button onClick={() => onUpdateEvent({...selectedEvent, notes: (Array.isArray(selectedEvent.notes) ? selectedEvent.notes : []).filter(n => n.id !== note.id)})} className="text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100"><i className="fas fa-trash-alt text-[9px]"></i></button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!Array.isArray(selectedEvent.notes) || selectedEvent.notes.length === 0) && <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-[10px] font-black text-slate-300 uppercase tracking-widest">Journal is currently empty</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl h-fit">
                   <h3 className="font-black text-white uppercase text-xs tracking-[0.2em] mb-8">Record Decision</h3>
                   <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Document project development, decision logic, or unexpected findings..." className="w-full h-64 p-6 bg-white/5 border border-white/10 rounded-[2.5rem] text-white text-xs font-medium leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500 mb-6 outline-none transition"></textarea>
                   <button onClick={addNote} className="w-full py-5 bg-white text-slate-900 font-black rounded-[1.5rem] shadow-xl uppercase tracking-widest text-[9px] hover:bg-indigo-400 transition">Archive Entry</button>
                </div>
              </div>
            )}

            {activeTab === 'review' && selectedEvent.status === 'completed' && (
              <div className="animate-in fade-in space-y-8">
                <div className="bg-slate-50 border-2 border-indigo-100 p-12 rounded-[4rem] shadow-sm">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">After-Action Report</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-12">Project Intelligence & Lifecycle Debriefing</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Final Operational Outcome</p>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => onUpdateEvent({...selectedEvent, outcome: 'success'})}
                          className={`flex-1 py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] transition-all border-2 flex items-center justify-center gap-2 ${selectedEvent.outcome === 'success' ? 'bg-emerald-500 text-white border-emerald-400 shadow-2xl' : 'bg-white text-slate-400 border-slate-100'}`}
                        >
                          <i className="fas fa-trophy"></i> Success
                        </button>
                        <button 
                          onClick={() => onUpdateEvent({...selectedEvent, outcome: 'failed'})}
                          className={`flex-1 py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] transition-all border-2 flex items-center justify-center gap-2 ${selectedEvent.outcome === 'failed' ? 'bg-rose-500 text-white border-rose-400 shadow-2xl' : 'bg-white text-slate-400 border-slate-100'}`}
                        >
                          <i className="fas fa-exclamation-triangle"></i> Failed
                        </button>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Institutional Lessons Learnt</p>
                      <textarea 
                        value={selectedEvent.lessonsLearnt || ''} 
                        onChange={(e) => onUpdateEvent({...selectedEvent, lessonsLearnt: e.target.value})}
                        className="w-full h-48 p-7 bg-white border border-slate-100 rounded-[3rem] outline-none font-medium text-sm text-slate-700 leading-relaxed resize-none focus:ring-4 focus:ring-indigo-100 transition shadow-inner"
                        placeholder="Detail the critical findings, technical bottlenecks, or relationship breakthroughs identified in this project cycle..."
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-white border border-slate-100 rounded-[3rem] flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div>
                     <h4 className="font-black text-rose-600 uppercase text-xs tracking-widest mb-1">Project Termination</h4>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Destroying this project framework will delete all ledger data, files, and logs.</p>
                   </div>
                   <button onClick={() => { if(confirm('Permanently destroy project data?')) onDeleteEvent(selectedEvent.id); }} className="px-8 py-4 bg-rose-50 text-rose-600 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition shadow-sm">Terminate Repository</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Internal utility
function calculatePnL(event: BudgetEvent) {
  const items = Array.isArray(event.items) ? event.items : [];
  const income = items.filter(i => i.type === 'income').reduce((acc, i) => acc + i.amount, 0);
  const expenses = items.filter(i => i.type === 'expense').reduce((acc, i) => acc + i.amount, 0);
  return { income, expenses, net: income - expenses };
}

export default EventPlanner;
