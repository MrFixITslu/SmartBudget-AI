
import React, { useState, useMemo, useRef, useEffect } from 'react';
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

// Separate TaskItem component with recursive sub-task support
interface TaskItemProps {
  task: ProjectTask;
  depth: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: ProjectTask) => void;
  onAddSub: (parentId: string, text: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, depth, onToggle, onDelete, onEdit, onAddSub }) => {
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [subText, setSubText] = useState('');

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
  const subProgress = task.subTasks && task.subTasks.length > 0 
    ? (task.subTasks.filter(st => st.completed).length / task.subTasks.length) * 100 
    : null;

  const handleAddSub = () => {
    if (!subText.trim()) return;
    onAddSub(task.id, subText);
    setSubText('');
    setIsAddingSub(false);
  };

  return (
    <div className="relative">
      {depth > 0 && (
        <div className="absolute left-[-20px] top-[-16px] w-[20px] h-[34px] border-l-2 border-b-2 border-slate-100 rounded-bl-xl pointer-events-none"></div>
      )}
      <div className="space-y-3">
        <div className={`flex items-center justify-between p-4 rounded-[1.5rem] border transition-all ${depth > 0 ? 'bg-slate-50/40' : 'bg-white border-slate-100 shadow-sm'} ${task.completed ? 'opacity-60' : isOverdue ? 'bg-rose-50 border-rose-200' : ''} group z-10`}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button 
              onClick={() => onToggle(task.id)} 
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-100 text-transparent hover:bg-slate-200'}`}
            >
              <i className="fas fa-check text-[10px]"></i>
            </button>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-xs truncate ${task.completed ? 'line-through text-slate-400 font-bold' : 'text-slate-800'}`}>{task.text}</p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {task.dueDate && <span className={`text-[7px] font-black uppercase tracking-widest ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`}><i className="far fa-clock mr-1"></i> {task.dueDate}</span>}
                {subProgress !== null && <span className="text-[7px] font-black uppercase tracking-widest text-indigo-500">{subProgress.toFixed(0)}% Sub-tasks Done</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {depth < 3 && (
              <button onClick={() => setIsAddingSub(!isAddingSub)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isAddingSub ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}><i className={`fas ${isAddingSub ? 'fa-times' : 'fa-plus'} text-[9px]`}></i></button>
            )}
            <button onClick={() => onEdit(task)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-800 hover:text-white transition"><i className="fas fa-edit text-[9px]"></i></button>
            <button onClick={() => onDelete(task.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition"><i className="fas fa-trash-alt text-[9px]"></i></button>
          </div>
        </div>
        {isAddingSub && (
          <div className="ml-10 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in slide-in-from-top-2">
            <div className="flex gap-2">
              <input autoFocus value={subText} onChange={(e) => setSubText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSub()} placeholder="New sub-task..." className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none" />
              <button onClick={handleAddSub} className="px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">Add</button>
            </div>
          </div>
        )}
        {task.subTasks && task.subTasks.length > 0 && (
          <div className="ml-10 space-y-4">
            {task.subTasks.map(st => (
              <TaskItem key={st.id} task={st} depth={depth + 1} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSub={onAddSub} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Advanced Multi-Format File Preview Modal ---
const FilePreviewModal = ({ file, directoryHandle, onClose }: { file: ProjectFile | null; directoryHandle: FileSystemDirectoryHandle | null; onClose: () => void }) => {
  const [content, setContent] = useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) return;

    const loadPreview = async () => {
      setLoading(true);
      try {
        if (file.storageType === 'url') {
          let embedUrl = file.storageRef;
          
          if (embedUrl.includes('docs.google.com')) {
             if (embedUrl.includes('/edit')) embedUrl = embedUrl.replace('/edit', '/preview');
             else if (!embedUrl.includes('/preview')) embedUrl += '/preview';
          }
          else if (embedUrl.includes('sharepoint.com') || embedUrl.includes('onedrive.live.com')) {
             if (!embedUrl.includes('action=embedview')) {
                embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'action=embedview';
             }
          }

          setContent(<iframe src={embedUrl} className="w-full h-full border-none rounded-2xl bg-white" title="Cloud Document"></iframe>);
          setLoading(false);
          return;
        }

        let blob: Blob | null = null;
        if (file.storageType === 'filesystem' && directoryHandle) {
          blob = await getFileFromHardDrive(directoryHandle, file.storageRef);
        } else {
          blob = await getFileFromIndexedDB(file.id);
        }

        if (!blob) throw new Error("Asset not found");

        const ext = file.name.split('.').pop()?.toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
          const url = URL.createObjectURL(blob);
          setContent(<img src={url} alt={file.name} className="max-w-full max-h-full object-contain mx-auto rounded-xl shadow-2xl" />);
        } else if (ext === 'pdf') {
          const url = URL.createObjectURL(blob);
          setContent(<iframe src={url} className="w-full h-full border-none rounded-2xl bg-white" title="PDF Viewer"></iframe>);
        } else if (ext === 'docx') {
          const arrayBuffer = await blob.arrayBuffer();
          const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
          setContent(<div className="office-preview-content overflow-auto h-full custom-scrollbar" dangerouslySetInnerHTML={{ __html: result.value }}></div>);
        } else if (['xlsx', 'xls', 'csv', 'ods'].includes(ext || '')) { // ODS support via SheetJS
          const arrayBuffer = await blob.arrayBuffer();
          const workbook = (window as any).XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const html = (window as any).XLSX.utils.sheet_to_html(workbook.Sheets[firstSheet]);
          setContent(<div className="office-preview-content overflow-auto h-full custom-scrollbar" dangerouslySetInnerHTML={{ __html: html }}></div>);
        } else if (['txt', 'md', 'json', 'js', 'ts', 'html'].includes(ext || '')) {
          const text = await blob.text();
          setContent(<pre className="p-10 bg-slate-900 text-slate-100 rounded-xl overflow-auto h-full font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{text}</pre>);
        } else {
          setContent(
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6">
              <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-3xl"><i className="fas fa-file-circle-question"></i></div>
              <div className="text-center">
                <p className="font-black text-white text-lg">Format Preview Limited</p>
                <p className="text-xs text-slate-500 max-w-xs mt-2">.{ext} files are best viewed in their native applications. Use a Cloud Link for direct embedding or download to local disk.</p>
                <button onClick={() => {
                   const link = document.createElement('a');
                   link.href = URL.createObjectURL(blob!);
                   link.download = file.name;
                   link.click();
                }} className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase transition-all">Download Asset</button>
              </div>
            </div>
          );
        }
      } catch (err) {
        setContent(<div className="text-rose-500 font-black flex flex-col items-center gap-4"><i className="fas fa-exclamation-triangle text-4xl"></i> Failed to parse vault asset</div>);
      }
      setLoading(false);
    };

    loadPreview();
  }, [file, directoryHandle]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col glass-dark animate-in fade-in duration-300">
      <div className="flex items-center justify-between p-5 md:px-10 md:py-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20"><i className="fas fa-layer-group"></i></div>
          <div>
            <h3 className="text-white font-black text-sm md:text-base tracking-tight truncate max-w-[200px] md:max-w-xl">{file.name}</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{file.storageType === 'url' ? 'Cloud Link' : `${(file.size / 1024).toFixed(1)} KB`}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="w-10 h-10 bg-rose-500 hover:bg-rose-600 text-white rounded-xl flex items-center justify-center transition shadow-lg shadow-rose-500/20"><i className="fas fa-times"></i></button>
        </div>
      </div>
      <div className="flex-1 p-4 md:p-12 overflow-hidden flex flex-col items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-5">
            <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Processing Visual Layer...</p>
          </div>
        ) : (
          <div className="w-full h-full max-w-6xl mx-auto flex items-center justify-center">
            {content}
          </div>
        )}
      </div>
    </div>
  );
};

const EventPlanner: React.FC<Props> = ({ events, contacts, directoryHandle, onAddEvent, onDeleteEvent, onUpdateEvent, onUpdateContacts }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('ledger');
  const [uploading, setUploading] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskText, setTaskText] = useState('');
  const [noteText, setNoteText] = useState('');
  
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactNum, setNewContactNum] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEvent = useMemo(() => (events || []).find(e => e.id === selectedEventId), [events, selectedEventId]);

  const projectContacts = useMemo(() => {
    if (!selectedEvent) return [];
    return contacts.filter(c => (selectedEvent.contactIds || []).includes(c.id));
  }, [selectedEvent, contacts]);

  const stats = useMemo(() => {
    if (!selectedEvent) return { income: 0, expenses: 0, net: 0, taskProgress: 0 };
    const items = selectedEvent.items || [];
    const income = items.filter(i => i.type === 'income').reduce((acc, i) => acc + i.amount, 0);
    const expenses = items.filter(i => i.type === 'expense').reduce((acc, i) => acc + i.amount, 0);
    const tasksCount = (selectedEvent.tasks || []).length;
    const completedTasks = (selectedEvent.tasks || []).filter(t => t.completed).length;
    return { income, expenses, net: income - expenses, taskProgress: tasksCount ? (completedTasks / tasksCount) * 100 : 0 };
  }, [selectedEvent]);

  const handleAddNote = () => {
    if (!noteText.trim() || !selectedEvent) return;
    const newNote: ProjectNote = { id: generateId(), text: noteText, timestamp: new Date().toLocaleString() };
    onUpdateEvent({ ...selectedEvent, notes: [newNote, ...(selectedEvent.notes || [])] });
    setNoteText('');
  };

  const handleLinkContact = (cid: string) => {
    if (!selectedEvent) return;
    if ((selectedEvent.contactIds || []).includes(cid)) return;
    onUpdateEvent({ ...selectedEvent, contactIds: [...(selectedEvent.contactIds || []), cid] });
  };

  const handleCreateAndLinkContact = () => {
    if (!newContactName.trim() || !selectedEvent) return;
    const newContact: Contact = { id: generateId(), name: newContactName, number: newContactNum, email: '' };
    onUpdateContacts([...contacts, newContact]);
    onUpdateEvent({ ...selectedEvent, contactIds: [...(selectedEvent.contactIds || []), newContact.id] });
    setNewContactName(''); setNewContactNum(''); setShowContactPicker(false);
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

  const updateTaskInList = (tasks: ProjectTask[], taskId: string, updateFn: (task: ProjectTask) => ProjectTask): ProjectTask[] => {
    return tasks.map(t => {
      if (t.id === taskId) return updateFn(t);
      if (t.subTasks && t.subTasks.length > 0) return { ...t, subTasks: updateTaskInList(t.subTasks, taskId, updateFn) };
      return t;
    });
  };

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
      const newFile: ProjectFile = { id: fileId, name: file.name, type: file.type, size: file.size, timestamp: new Date().toLocaleString(), storageRef, storageType };
      onUpdateEvent({ ...selectedEvent, files: [...(selectedEvent.files || []), newFile] });
    } catch (err) {
      alert("Persistence protocol failure.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto px-2">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter">Project Intelligence</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Multi-Channel Asset & Goal Hub</p>
        </div>
        {!selectedEventId && (
          <button onClick={() => setShowAddForm(!showAddForm)} className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${showAddForm ? 'bg-rose-50 text-rose-600' : 'bg-slate-900 text-white shadow-2xl'}`}>
            <i className={`fas ${showAddForm ? 'fa-times' : 'fa-plus'}`}></i>
            {showAddForm ? 'Abort' : 'Initiate Container'}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="p-12 bg-white border border-slate-200 rounded-[4rem] shadow-sm animate-in zoom-in-95 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Designation</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Q4 Strategic Summit" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black text-lg focus:ring-4 focus:ring-indigo-50 transition-all" />
            </div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Target Date</label><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black focus:ring-4 focus:ring-indigo-50" /></div>
          </div>
          <button onClick={() => { if (!newName) return; onAddEvent({ name: newName, date: newDate, status: 'active' }); setShowAddForm(false); setNewName(''); }} className="w-full mt-12 py-6 bg-indigo-600 text-white font-black rounded-[2.5rem] shadow-2xl uppercase tracking-[0.2em] text-[12px] hover:bg-slate-900 transition-all">Establish Context</button>
        </div>
      )}

      {!selectedEventId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(events || []).map(event => {
            const taskList = event.tasks || [];
            const taskProgress = taskList.length ? (taskList.filter(t => t.completed).length / taskList.length) * 100 : 0;
            return (
              <div key={event.id} onClick={() => { setSelectedEventId(event.id); setActiveTab('ledger'); }} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all group relative overflow-hidden flex flex-col h-full min-h-[300px]">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] scale-[2.5] rotate-12 pointer-events-none transition-transform group-hover:rotate-0"><i className="fas fa-layer-group text-slate-900"></i></div>
                <div className="relative z-10 flex-1">
                  <h3 className="font-black text-slate-800 text-lg leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{event.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">{event.date}</p>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100"><p className="text-[9px] text-slate-400 font-black uppercase mb-1">Vault</p><p className="text-base font-black text-slate-800">{(event.files || []).length} Items</p></div>
                    <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100"><p className="text-[9px] text-slate-400 font-black uppercase mb-1">Goals</p><p className="text-base font-black text-slate-800">{(event.tasks || []).length} Goals</p></div>
                  </div>
                </div>
                <div className="space-y-3 relative z-10">
                   <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${taskProgress}%` }}></div></div>
                </div>
              </div>
            );
          })}
          {(!events || events.length === 0) && <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-200 rounded-[4rem] bg-white/50"><i className="fas fa-folder-open text-slate-200 text-6xl mb-6"></i><p className="text-slate-400 text-sm font-black uppercase tracking-[0.3em]">No project frameworks identified</p></div>}
        </div>
      ) : selectedEvent && (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 bg-slate-900 p-10 rounded-[4rem] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-5 scale-150 rotate-12 pointer-events-none"><i className="fas fa-microchip text-[140px] text-white"></i></div>
             <div className="relative z-10 flex items-center gap-6">
               <button onClick={() => setSelectedEventId(null)} className="w-14 h-14 flex items-center justify-center bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all active:scale-95"><i className="fas fa-arrow-left"></i></button>
               <div>
                 <h2 className="text-3xl font-black text-white tracking-tighter leading-tight">{selectedEvent.name}</h2>
                 <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em] mt-1">{selectedEvent.status} Context Active</p>
               </div>
             </div>
             <div className="relative z-10 flex bg-white/5 p-2 rounded-[2rem] border border-white/10 overflow-x-auto no-scrollbar max-w-full">
               {(['ledger', 'tasks', 'vault', 'contacts', 'log', 'review'] as ProjectTab[]).map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>{tab}</button>
               ))}
             </div>
          </div>

          <div className="min-h-[600px]">
            {activeTab === 'tasks' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 animate-in fade-in">
                <div className="lg:col-span-3 space-y-8">
                  <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em] mb-10">Strategic Matrix</h3>
                    <div className="space-y-6">
                      {(selectedEvent.tasks || []).map(task => (
                        <TaskItem key={task.id} task={task} depth={0} onToggle={(id) => onUpdateEvent({...selectedEvent, tasks: updateTaskInList(selectedEvent.tasks || [], id, (t) => ({...t, completed: !t.completed}))})} onDelete={(id) => onUpdateEvent({...selectedEvent, tasks: (selectedEvent.tasks || []).filter(t => t.id !== id)})} onEdit={setEditingTask} onAddSub={(parentId, text) => onUpdateEvent({...selectedEvent, tasks: updateTaskInList(selectedEvent.tasks || [], parentId, (p) => ({...p, subTasks: [...(p.subTasks || []), {id: generateId(), text, completed: false}]}))})} />
                      ))}
                      {(!selectedEvent.tasks || selectedEvent.tasks.length === 0) && <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem] text-[10px] font-black text-slate-300 uppercase tracking-widest">Awaiting task initialization</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm h-fit sticky top-28">
                  <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-10">Define Goal</h3>
                  <div className="space-y-6">
                    <textarea value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="Primary requirement..." className="w-full h-40 p-6 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-bold text-xs resize-none focus:ring-4 focus:ring-indigo-50 transition-all"></textarea>
                    <button onClick={() => { if(!taskText.trim()) return; onUpdateEvent({...selectedEvent, tasks: [...(selectedEvent.tasks || []), {id: generateId(), text: taskText, completed: false}]}); setTaskText(''); }} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all">Assign Goal</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vault' && (
              <div className="animate-in fade-in space-y-10">
                <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm min-h-[500px]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                    <div>
                      <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em]">Integrated Repository</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Source: {directoryHandle ? 'Local Hard Drive' : 'Encrypted IndexedDB'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                       <button onClick={() => setShowAddLink(!showAddLink)} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${showAddLink ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}><i className="fas fa-link mr-2"></i> Cloud Asset</button>
                       <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-2xl">
                         {uploading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-upload mr-2"></i>}
                         Upload Binary
                       </button>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  </div>

                  {showAddLink && (
                    <div className="mb-12 p-10 bg-slate-50 rounded-[3rem] border border-slate-200 animate-in slide-in-from-top-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input value={newLinkName} onChange={e => setNewLinkName(e.target.value)} placeholder="Resource Label (e.g. Budget Sheet)" className="p-5 bg-white border border-slate-200 rounded-2xl outline-none font-black text-xs" />
                        <input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="URL (Google Docs / OneDrive)" className="p-5 bg-white border border-slate-200 rounded-2xl outline-none font-black text-xs" />
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setShowAddLink(false)} className="px-6 py-2 text-slate-400 text-[10px] font-black uppercase">Cancel</button>
                        <button onClick={() => { if(!newLinkUrl.trim()) return; onUpdateEvent({...selectedEvent, files: [...(selectedEvent.files || []), {id: generateId(), name: newLinkName || 'Cloud Doc', type: 'link', size: 0, timestamp: new Date().toLocaleString(), storageRef: newLinkUrl, storageType: 'url'}]}); setNewLinkUrl(''); setNewLinkName(''); setShowAddLink(false); }} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-indigo-100">Link Asset</button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10">
                    {(selectedEvent.files || []).map(file => {
                      const ext = file.name.split('.').pop()?.toLowerCase();
                      return (
                        <div key={file.id} className="group relative bg-slate-50 border border-slate-100 rounded-[3rem] p-8 text-center hover:bg-white hover:shadow-2xl transition-all border-b-4 border-b-transparent hover:border-b-indigo-500">
                          <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center text-3xl mx-auto mb-6 transition-all group-hover:scale-110 shadow-sm ${file.storageType === 'url' ? 'bg-indigo-50 text-indigo-500' : 'bg-white text-slate-400'}`}>
                             {file.storageType === 'url' ? <i className="fas fa-cloud"></i> : <i className={`fas ${['xlsx','ods','csv'].includes(ext||'') ? 'fa-file-excel text-emerald-600' : ['docx','odt'].includes(ext||'') ? 'fa-file-word text-blue-500' : 'fa-file'}`}></i>}
                          </div>
                          <p className="text-[12px] font-black text-slate-800 truncate mb-1 px-2">{file.name}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{file.storageType === 'url' ? 'Cloud' : `${(file.size / 1024).toFixed(0)} KB`}</p>
                          <div className="mt-8 flex gap-2"><button onClick={() => setPreviewFile(file)} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 active:scale-95">Preview</button></div>
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
                             <button onClick={(e) => { e.stopPropagation(); if(confirm('Purge asset?')) onUpdateEvent({...selectedEvent, files: (selectedEvent.files || []).filter(f => f.id !== file.id)}); }} className="w-9 h-9 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition shadow-sm"><i className="fas fa-times text-[11px]"></i></button>
                          </div>
                        </div>
                      );
                    })}
                    {(!selectedEvent.files || selectedEvent.files.length === 0) && <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-100 rounded-[3rem]"><p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">Repository empty</p></div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ledger' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 animate-in fade-in">
                <div className="lg:col-span-3 space-y-10">
                  <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-12">
                      <div><h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em]">Operational Flow</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Project P&L Ledger</p></div>
                      <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Net</p><p className={`text-3xl font-black ${stats.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>${stats.net.toLocaleString()}</p></div>
                    </div>
                    <div className="space-y-5">
                      {(selectedEvent.items || []).map(item => (
                        <div key={item.id} className="flex items-center justify-between p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 transition-all hover:bg-white hover:shadow-xl group">
                           <div className="flex items-center gap-6"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl ${item.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'} shadow-lg`}><i className={`fas ${item.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i></div><div><p className="font-black text-base text-slate-800">{item.description}</p><p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{item.category}</p></div></div><p className={`font-black text-lg ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}</p>
                        </div>
                      ))}
                      {(selectedEvent.items || []).length === 0 && <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem] text-[10px] font-black text-slate-300 uppercase tracking-widest">No entries found</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm h-fit">
                   <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-10">Entry</h3>
                   <form onSubmit={handleAddItem} className="space-y-6">
                      <select name="type" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl font-black text-[11px] uppercase outline-none"><option value="expense">Expense (-)</option><option value="income">Revenue (+)</option></select>
                      <select name="category" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl font-black text-[11px] uppercase outline-none">{EVENT_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                      <input name="description" required placeholder="Description..." className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl font-black text-xs outline-none" />
                      <input name="amount" type="number" step="0.01" required placeholder="Amount ($)..." className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl font-black text-sm outline-none" />
                      <button type="submit" className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl shadow-2xl uppercase tracking-[0.2em] text-[11px] hover:bg-indigo-600 transition-all active:scale-95">Commit Entry</button>
                   </form>
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 animate-in fade-in">
                <div className="lg:col-span-3 space-y-8">
                  <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm min-h-[500px]">
                    <div className="flex items-center justify-between mb-12">
                      <div><h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em]">Project Directory</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Stakeholders & Global Contacts</p></div>
                      <button onClick={() => setShowContactPicker(true)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-600 transition-all">Link Global Stakeholder</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {projectContacts.map(contact => (
                        <div key={contact.id} className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                           <div className="flex items-center gap-6"><div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm"><i className="fas fa-user-tie text-xl"></i></div><div><p className="font-black text-slate-800 text-base">{contact.name}</p><p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">{contact.number || 'No Digital ID'}</p></div></div>
                           <button onClick={() => onUpdateEvent({...selectedEvent, contactIds: (selectedEvent.contactIds || []).filter(cid => cid !== contact.id)})} className="w-10 h-10 bg-white border border-slate-100 text-rose-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"><i className="fas fa-unlink text-[10px]"></i></button>
                        </div>
                      ))}
                      {projectContacts.length === 0 && <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem] text-slate-300 font-black uppercase text-[10px] tracking-widest">No stakeholders linked</div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm h-fit">
                   <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.3em] mb-10">Initialize ID</h3>
                   <div className="space-y-6">
                      <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Stakeholder Name</label><input value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Full Name" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black text-xs focus:ring-4 focus:ring-indigo-50" /></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Reference ID / Phone</label><input value={newContactNum} onChange={e => setNewContactNum(e.target.value)} placeholder="+1..." className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black text-xs focus:ring-4 focus:ring-indigo-50" /></div>
                      <button onClick={handleCreateAndLinkContact} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all">Create & Link</button>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm min-h-[500px] animate-in fade-in">
                <div className="flex items-center justify-between mb-12">
                   <div><h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em]">Project Lifecycle Log</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Historical Milestone Tracking</p></div>
                </div>
                <div className="space-y-10 max-w-4xl mx-auto">
                   <div className="flex gap-4"><textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Record system update or project milestone..." className="flex-1 p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] outline-none font-bold text-sm resize-none h-32 focus:ring-4 focus:ring-indigo-50 transition-all"></textarea><button onClick={handleAddNote} className="w-20 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-center hover:bg-indigo-600 transition-all shadow-xl active:scale-95"><i className="fas fa-paper-plane"></i></button></div>
                   <div className="relative pl-10 border-l-4 border-slate-100 space-y-10">
                      {(selectedEvent.notes || []).map(note => (
                        <div key={note.id} className="relative"><div className="absolute left-[-52px] top-0 w-10 h-10 bg-white border-4 border-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400 shadow-sm"><i className="fas fa-bookmark"></i></div><p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{note.timestamp}</p><div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-sm"><p className="text-sm font-bold text-slate-800 leading-relaxed">{note.text}</p></div></div>
                      ))}
                      {(selectedEvent.notes || []).length === 0 && <div className="py-20 text-center"><p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">Historical record void</p></div>}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'review' && (
              <div className="animate-in fade-in space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   <div className="lg:col-span-2 bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm">
                      <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.4em] mb-10">Strategic Review</h3>
                      <div className="space-y-10">
                         <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Container Outcome</label><select value={selectedEvent.outcome || 'success'} onChange={e => onUpdateEvent({...selectedEvent, outcome: e.target.value as any})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl font-black text-xs uppercase outline-none focus:ring-4 focus:ring-indigo-50 transition-all"><option value="success">Success</option><option value="failed">Failed</option></select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lifecycle State</label><select value={selectedEvent.status} onChange={e => onUpdateEvent({...selectedEvent, status: e.target.value as any})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl font-black text-xs uppercase outline-none focus:ring-4 focus:ring-indigo-50 transition-all"><option value="active">Active Execution</option><option value="planned">Future Frame</option><option value="completed">Cycle Terminated</option></select></div>
                         </div>
                         <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lessons Learnt / Post-Mortem</label><textarea value={selectedEvent.lessonsLearnt || ''} onChange={e => onUpdateEvent({...selectedEvent, lessonsLearnt: e.target.value})} placeholder="Identify bottlenecks and optimization routes..." className="w-full h-48 p-8 bg-slate-50 border border-slate-100 rounded-[3rem] outline-none font-bold text-sm resize-none focus:ring-4 focus:ring-indigo-50 transition-all"></textarea></div>
                      </div>
                   </div>
                   <div className="bg-slate-900 p-10 rounded-[4rem] shadow-2xl text-white">
                      <h3 className="font-black text-white uppercase text-[11px] tracking-[0.3em] mb-10">Performance Matrix</h3>
                      <div className="space-y-10">
                         <div className="space-y-2"><p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Financial Yield</p><p className={`text-4xl font-black ${stats.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${stats.net.toLocaleString()}</p></div>
                         <div className="space-y-2"><div className="flex justify-between items-end"><p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Goal Saturation</p><p className="text-xl font-black text-indigo-400">{stats.taskProgress.toFixed(0)}%</p></div><div className="h-2 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${stats.taskProgress}%` }}></div></div></div>
                         <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10"><p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-4">Flow P&L</p><div className="space-y-3"><div className="flex justify-between text-xs font-black uppercase tracking-widest"><span>Revenue</span><span className="text-emerald-400">+${stats.income.toLocaleString()}</span></div><div className="flex justify-between text-xs font-black uppercase tracking-widest"><span>Expenses</span><span className="text-rose-400">-${stats.expenses.toLocaleString()}</span></div></div></div>
                         <button onClick={() => { if(confirm('Purge Project Framework?')) { onDeleteEvent(selectedEvent.id); setSelectedEventId(null); }}} className="w-full py-5 bg-rose-500/20 text-rose-500 font-black rounded-3xl uppercase tracking-widest text-[10px] hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-lg shadow-rose-500/10">Decommission Container</button>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {previewFile && <FilePreviewModal file={previewFile} directoryHandle={directoryHandle} onClose={() => setPreviewFile(null)} />}

      {editingTask && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 mb-10">Adjust Objective</h3>
            <form onSubmit={(e) => { e.preventDefault(); onUpdateEvent({ ...selectedEvent!, tasks: updateTaskInList(selectedEvent!.tasks || [], editingTask.id, () => editingTask) }); setEditingTask(null); }} className="space-y-8">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 block">Objective Logic</label><textarea value={editingTask.text} onChange={e => setEditingTask({...editingTask, text: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-bold resize-none h-48 focus:ring-4 focus:ring-indigo-50 transition-all" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 block">Deadline</label><input type="date" value={editingTask.dueDate || ''} onChange={e => setEditingTask({...editingTask, dueDate: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black focus:ring-4 focus:ring-indigo-50 transition-all" /></div>
              <div className="flex gap-4 pt-4"><button type="submit" className="flex-1 py-6 bg-indigo-600 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-widest text-[12px] hover:bg-slate-900 transition-all active:scale-95">Update Frame</button><button type="button" onClick={() => setEditingTask(null)} className="px-10 py-6 bg-slate-100 text-slate-400 font-black rounded-[2rem] uppercase tracking-widest text-[12px]">Abort</button></div>
            </form>
          </div>
        </div>
      )}

      {showContactPicker && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl">
             <div className="flex justify-between items-center mb-8"><div><h3 className="text-2xl font-black text-slate-800 tracking-tight">Global Directory</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Select stakeholders to link to context</p></div><button onClick={() => setShowContactPicker(false)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl hover:text-slate-800"><i className="fas fa-times"></i></button></div>
             <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {contacts.filter(c => !(selectedEvent?.contactIds || []).includes(c.id)).map(c => (
                  <button key={c.id} onClick={() => { handleLinkContact(c.id); setShowContactPicker(false); }} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex items-center justify-between group hover:bg-indigo-600 hover:text-white transition-all"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm group-hover:text-indigo-600 transition-all"><i className="fas fa-user-plus text-[10px]"></i></div><p className="font-black text-sm">{c.name}</p></div><i className="fas fa-plus text-[10px] opacity-40"></i></button>
                ))}
                {contacts.length === 0 && <p className="text-center py-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">Global directory empty</p>}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventPlanner;
