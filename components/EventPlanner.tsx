
import React, { useState, useMemo, useRef } from 'react';
import { BudgetEvent, EventItem, EVENT_ITEM_CATEGORIES, EventItemCategory, ProjectTask, ProjectFile, ProjectNote, Contact } from '../types';
import { saveFileToIndexedDB, saveFileToHardDrive, getFileFromIndexedDB, getFileFromHardDrive, deleteFileFromIndexedDB } from '../services/fileStorageService';

interface Props {
  events: BudgetEvent[];
  contacts: Contact[];
  directoryHandle: FileSystemDirectoryHandle | null;
  onAddEvent: (event: Omit<BudgetEvent, 'id' | 'items' | 'notes' | 'tasks' | 'files' | 'contactIds'>) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (event: BudgetEvent) => void;
  onUpdateContacts: (contacts: Contact[]) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

type ProjectTab = 'ledger' | 'tasks' | 'vault' | 'contacts' | 'log' | 'review';

const EventPlanner: React.FC<Props> = ({ events, contacts, directoryHandle, onAddEvent, onDeleteEvent, onUpdateEvent, onUpdateContacts }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('ledger');
  const [showUniversalPicker, setShowUniversalPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Edit Modal States
  const [editingItem, setEditingItem] = useState<EventItem | null>(null);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // New Project Form
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  // Task & Content States
  const [taskText, setTaskText] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [noteText, setNoteText] = useState('');

  // Sub-task State
  const [addingSubTaskTo, setAddingSubTaskTo] = useState<string | null>(null);
  const [subTaskText, setSubTaskText] = useState('');

  // Contact States
  const [cName, setCName] = useState('');
  const [cNum, setCNum] = useState('');
  const [cEmail, setCEmail] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEvent = useMemo(() => 
    (Array.isArray(events) ? events : []).find(e => e.id === selectedEventId), 
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

  // Ledger CRUD
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

  const handleUpdateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !editingItem) return;
    const items = Array.isArray(selectedEvent.items) ? selectedEvent.items : [];
    const updatedItems = items.map(i => i.id === editingItem.id ? editingItem : i);
    onUpdateEvent({ ...selectedEvent, items: updatedItems });
    setEditingItem(null);
  };

  // Task CRUD (Recursive support)
  const updateTaskInList = (tasks: ProjectTask[], taskId: string, updateFn: (task: ProjectTask) => ProjectTask): ProjectTask[] => {
    return tasks.map(t => {
      if (t.id === taskId) return updateFn(t);
      if (t.subTasks) return { ...t, subTasks: updateTaskInList(t.subTasks, taskId, updateFn) };
      return t;
    });
  };

  const removeTaskFromList = (tasks: ProjectTask[], taskId: string): ProjectTask[] => {
    return tasks
      .filter(t => t.id !== taskId)
      .map(t => (t.subTasks ? { ...t, subTasks: removeTaskFromList(t.subTasks, taskId) } : t));
  };

  const addTask = () => {
    if (!selectedEvent || !taskText.trim()) return;
    const newTask: ProjectTask = {
      id: generateId(),
      text: taskText,
      completed: false,
      dueDate: taskDueDate || undefined,
      subTasks: []
    };
    const tasks = Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : [];
    onUpdateEvent({ ...selectedEvent, tasks: [...tasks, newTask] });
    setTaskText('');
    setTaskDueDate('');
  };

  const addSubTask = (parentId: string) => {
    if (!selectedEvent || !subTaskText.trim()) return;
    const newSub: ProjectTask = {
      id: generateId(),
      text: subTaskText,
      completed: false,
      subTasks: []
    };
    const tasks = Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : [];
    const updatedTasks = updateTaskInList(tasks, parentId, (p) => ({
      ...p,
      subTasks: [...(p.subTasks || []), newSub]
    }));
    onUpdateEvent({ ...selectedEvent, tasks: updatedTasks });
    setSubTaskText('');
    setAddingSubTaskTo(null);
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !editingTask) return;
    const tasks = Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : [];
    const updatedTasks = updateTaskInList(tasks, editingTask.id, () => editingTask);
    onUpdateEvent({ ...selectedEvent, tasks: updatedTasks });
    setEditingTask(null);
  };

  const toggleTask = (taskId: string) => {
    if (!selectedEvent) return;
    const tasks = Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : [];
    const updatedTasks = updateTaskInList(tasks, taskId, (t) => ({
      ...t,
      completed: !t.completed,
      completionDate: !t.completed ? new Date().toLocaleString() : undefined
    }));
    onUpdateEvent({ ...selectedEvent, tasks: updatedTasks });
  };

  const deleteTask = (taskId: string) => {
    if (!selectedEvent) return;
    const tasks = Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : [];
    const updatedTasks = removeTaskFromList(tasks, taskId);
    onUpdateEvent({ ...selectedEvent, tasks: updatedTasks });
  };

  // Contact CRUD
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

  const handleUpdateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    const updatedContacts = contacts.map(c => c.id === editingContact.id ? editingContact : c);
    onUpdateContacts(updatedContacts);
    setEditingContact(null);
  };

  const linkExistingContact = (contactId: string) => {
    if (!selectedEvent) return;
    const contactIds = Array.isArray(selectedEvent.contactIds) ? selectedEvent.contactIds : [];
    if (contactIds.includes(contactId)) return;
    onUpdateEvent({ ...selectedEvent, contactIds: [...contactIds, contactId] });
  };

  // Vault Management
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEvent) return;

    setUploading(true);
    try {
      const fileId = generateId();
      let storageRef = fileId;
      let storageType: 'indexeddb' | 'filesystem' = 'indexeddb';

      if (directoryHandle) {
        storageRef = await saveFileToHardDrive(directoryHandle, selectedEvent.name, file.name, file);
        storageType = 'filesystem';
      } else {
        await saveFileToIndexedDB(fileId, file);
      }

      const newFile: ProjectFile = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        timestamp: new Date().toLocaleString(),
        storageRef: storageRef,
        storageType: storageType
      };

      const files = Array.isArray(selectedEvent.files) ? selectedEvent.files : [];
      onUpdateEvent({ ...selectedEvent, files: [...files, newFile] });
    } catch (error) {
      console.error("Upload failed:", error);
      alert("File upload failed. Ensure you have granted folder permissions if using disk sync.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadFile = async (file: ProjectFile) => {
    try {
      let blob: Blob | null = null;
      if (file.storageType === 'filesystem' && directoryHandle) {
        blob = await getFileFromHardDrive(directoryHandle, file.storageRef);
      } else {
        blob = await getFileFromIndexedDB(file.id);
      }
      if (!blob) throw new Error("File data not found in vault.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      alert("Unable to retrieve file.");
    }
  };

  const openPreview = async (file: ProjectFile) => {
    try {
      let blob: Blob | null = null;
      if (file.storageType === 'filesystem' && directoryHandle) {
        blob = await getFileFromHardDrive(directoryHandle, file.storageRef);
      } else {
        blob = await getFileFromIndexedDB(file.id);
      }
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const win = window.open();
      if (win) win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } catch (error) {
      alert("Preview error.");
    }
  };

  const deleteFile = async (file: ProjectFile) => {
    if (!selectedEvent) return;
    if (!confirm('Permanently remove this asset?')) return;
    if (file.storageType === 'indexeddb') await deleteFileFromIndexedDB(file.id);
    const files = (Array.isArray(selectedEvent.files) ? selectedEvent.files : []).filter(f => f.id !== file.id);
    onUpdateEvent({ ...selectedEvent, files });
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

  // Explicitly type TaskItem as React.FC to handle the 'key' prop in recursive calls and list rendering.
  const TaskItem: React.FC<{ task: ProjectTask; depth?: number }> = ({ task, depth = 0 }) => {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
    const subProgress = task.subTasks && task.subTasks.length > 0 
      ? (task.subTasks.filter(st => st.completed).length / task.subTasks.length) * 100 
      : null;

    return (
      <div className="space-y-2">
        <div className={`flex items-center justify-between p-4 rounded-[1.5rem] border transition-all ${depth > 0 ? 'ml-8 bg-slate-50/50' : 'bg-white border-slate-100 shadow-sm'} ${task.completed ? 'opacity-60' : isOverdue ? 'bg-rose-50 border-rose-200' : ''} group`}>
          <div className="flex items-center gap-4">
            <button onClick={() => toggleTask(task.id)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${task.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-transparent hover:bg-slate-200'}`}><i className="fas fa-check text-[10px]"></i></button>
            <div>
              <p className={`font-black text-xs ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.text}</p>
              <div className="flex flex-wrap items-center gap-3 mt-0.5">
                {task.dueDate && <span className={`text-[7px] font-black uppercase tracking-widest ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`}><i className="far fa-clock mr-1"></i> {task.dueDate}</span>}
                {subProgress !== null && <span className="text-[7px] font-black uppercase tracking-widest text-indigo-500">{subProgress.toFixed(0)}% Sub-tasks Done</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {depth < 2 && (
              <button onClick={() => setAddingSubTaskTo(task.id)} className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition" title="Add Sub-task"><i className="fas fa-plus text-[8px]"></i></button>
            )}
            <button onClick={() => setEditingTask(task)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-800 hover:text-white transition"><i className="fas fa-edit text-[8px]"></i></button>
            <button onClick={() => deleteTask(task.id)} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition"><i className="fas fa-trash-alt text-[8px]"></i></button>
          </div>
        </div>
        
        {addingSubTaskTo === task.id && (
          <div className="ml-12 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in slide-in-from-top-1">
            <div className="flex gap-2">
              <input value={subTaskText} onChange={(e) => setSubTaskText(e.target.value)} placeholder="Sub-task requirement..." className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none" />
              <button onClick={() => addSubTask(task.id)} className="px-3 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase">Add</button>
              <button onClick={() => setAddingSubTaskTo(null)} className="px-3 bg-slate-200 text-slate-500 rounded-lg text-[9px] font-black uppercase">Cancel</button>
            </div>
          </div>
        )}

        {task.subTasks?.map(st => (
          <TaskItem key={st.id} task={st} depth={depth + 1} />
        ))}
      </div>
    );
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
                        <div key={item.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 transition shadow-sm group">
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
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className={`font-black text-base ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}</p>
                            </div>
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingItem(item)} className="text-[8px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition">Edit</button>
                              <button onClick={() => onUpdateEvent({...selectedEvent, items: (Array.isArray(selectedEvent.items) ? selectedEvent.items : []).filter(i => i.id !== item.id)})} className="text-[8px] font-black text-rose-300 uppercase tracking-widest hover:text-rose-500 transition">Delete</button>
                            </div>
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
                      {(Array.isArray(selectedEvent.tasks) ? selectedEvent.tasks : []).map(task => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                      {(!Array.isArray(selectedEvent.tasks) || selectedEvent.tasks.length === 0) && <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-[10px] font-black text-slate-300 uppercase tracking-widest">No strategic tasks assigned</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-8">New Primary Objective</h3>
                  <div className="space-y-5">
                    <textarea value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="Operational requirement..." className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs resize-none"></textarea>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block">Deadline</label><input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-[10px] font-bold" /></div>
                    <button onClick={addTask} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[9px] hover:bg-slate-900 transition">Assign Root Task</button>
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
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {directoryHandle ? 'Native Disk Storage Active' : 'Internal Secure Vault Active'}
                      </p>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition shadow-lg disabled:opacity-50">
                      {uploading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-upload mr-2"></i>}
                      Upload Asset
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {(Array.isArray(selectedEvent.files) ? selectedEvent.files : []).map(file => (
                      <div key={file.id} className="group relative bg-slate-50 border border-slate-100 rounded-[2rem] p-5 text-center hover:bg-white hover:shadow-xl transition-all">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 text-xl mx-auto mb-4 group-hover:text-indigo-600 transition shadow-sm"><i className={`fas ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file-alt'}`}></i></div>
                        <p className="text-[10px] font-black text-slate-800 truncate mb-1">{file.name}</p>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{file.timestamp}</p>
                        <div className="mt-4 flex flex-col gap-2">
                           <button onClick={() => downloadFile(file)} className="py-2 bg-indigo-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition hover:bg-slate-900">Open</button>
                           <button onClick={() => openPreview(file)} className="py-2 bg-slate-200 text-slate-600 rounded-xl text-[8px] font-black uppercase tracking-widest transition hover:bg-slate-300">Preview</button>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="w-6 h-6 bg-rose-50 text-rose-500 rounded-lg text-[8px] flex items-center justify-center hover:bg-rose-500 hover:text-white transition"><i className="fas fa-times"></i></button>
                        </div>
                        {file.storageType === 'filesystem' && <div className="absolute -top-1 -left-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[7px] border-2 border-white shadow-sm" title="Stored on Local Hard Drive"><i className="fas fa-hdd"></i></div>}
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
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingContact(c)} className="text-[8px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition">Edit</button>
                              <button onClick={() => onUpdateEvent({...selectedEvent, contactIds: (Array.isArray(selectedEvent.contactIds) ? selectedEvent.contactIds : []).filter(id => id !== c.id)})} className="text-[8px] font-black text-rose-300 uppercase tracking-widest hover:text-rose-500 transition">Disconnect</button>
                            </div>
                          </div>
                        </div>
                      ))}
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
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl h-fit">
                   <h3 className="font-black text-white uppercase text-xs tracking-[0.2em] mb-8">Record Decision</h3>
                   <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Document project development..." className="w-full h-64 p-6 bg-white/5 border border-white/10 rounded-[2.5rem] text-white text-xs font-medium leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500 mb-6 outline-none transition"></textarea>
                   <button onClick={addNote} className="w-full py-5 bg-white text-slate-900 font-black rounded-[1.5rem] shadow-xl uppercase tracking-widest text-[9px] hover:bg-indigo-400 transition">Archive Entry</button>
                </div>
              </div>
            )}

            {activeTab === 'review' && selectedEvent.status === 'completed' && (
              <div className="animate-in fade-in space-y-8">
                <div className="bg-slate-50 border-2 border-indigo-100 p-12 rounded-[4rem] shadow-sm">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">After-Action Report</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
                    <div className="space-y-6">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Final Outcome</p>
                      <div className="flex gap-4">
                        <button onClick={() => onUpdateEvent({...selectedEvent, outcome: 'success'})} className={`flex-1 py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] transition-all border-2 flex items-center justify-center gap-2 ${selectedEvent.outcome === 'success' ? 'bg-emerald-500 text-white border-emerald-400 shadow-2xl' : 'bg-white text-slate-400 border-slate-100'}`}><i className="fas fa-trophy"></i> Success</button>
                        <button onClick={() => onUpdateEvent({...selectedEvent, outcome: 'failed'})} className={`flex-1 py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] transition-all border-2 flex items-center justify-center gap-2 ${selectedEvent.outcome === 'failed' ? 'bg-rose-500 text-white border-rose-400 shadow-2xl' : 'bg-white text-slate-400 border-slate-100'}`}><i className="fas fa-exclamation-triangle"></i> Failed</button>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Lessons Learnt</p>
                      <textarea value={selectedEvent.lessonsLearnt || ''} onChange={(e) => onUpdateEvent({...selectedEvent, lessonsLearnt: e.target.value})} className="w-full h-48 p-7 bg-white border border-slate-100 rounded-[3rem] outline-none font-medium text-sm text-slate-700 leading-relaxed resize-none focus:ring-4 focus:ring-indigo-100 transition shadow-inner" placeholder="Detail findings..."></textarea>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Task Modal (Standard for edits) */}
      {editingTask && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase text-xs tracking-widest">Update Goal</h3>
            <form onSubmit={handleUpdateTask} className="space-y-5">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Requirement</label><textarea value={editingTask.text} onChange={e => setEditingTask({...editingTask, text: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold resize-none h-32" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Deadline</label><input type="date" value={editingTask.dueDate || ''} onChange={e => setEditingTask({...editingTask, dueDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition">Update Goal</button>
                <button type="button" onClick={() => setEditingTask(null)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-100 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ledger Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase text-xs tracking-widest">Update Ledger Entry</h3>
            <form onSubmit={handleUpdateItem} className="space-y-5">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Description</label><input value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Amount</label><input type="number" step="0.01" value={editingItem.amount} onChange={e => setEditingItem({...editingItem, amount: parseFloat(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition">Save Changes</button>
                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-100 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase text-xs tracking-widest">Update Stakeholder</h3>
            <form onSubmit={handleUpdateContact} className="space-y-5">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label><input value={editingContact.name} onChange={e => setEditingContact({...editingContact, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mobile Line</label><input value={editingContact.number} onChange={e => setEditingContact({...editingContact, number: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label><input value={editingContact.email} onChange={e => setEditingContact({...editingContact, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" /></div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition">Save Data</button>
                <button type="button" onClick={() => setEditingContact(null)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-100 transition">Cancel</button>
              </div>
            </form>
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
