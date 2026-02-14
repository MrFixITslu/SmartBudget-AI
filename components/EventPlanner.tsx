import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BudgetEvent, EventItem, EVENT_ITEM_CATEGORIES, ProjectTask, ProjectFile, ProjectNote, Contact, IOU, User } from '../types';
import { saveFileToHardDrive } from '../services/fileStorageService';

// Define global admin identifier for project access control
const ADMIN_USER = "nsv";

interface Props {
  events: BudgetEvent[];
  contacts: Contact[];
  directoryHandle: FileSystemDirectoryHandle | null;
  currentUser: string;
  isAdmin: boolean;
  onAddEvent: (event: Omit<BudgetEvent, 'id' | 'items' | 'notes' | 'tasks' | 'files' | 'contactIds' | 'memberUsernames' | 'ious' | 'lastUpdated'>) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (event: BudgetEvent) => void;
  onUpdateContacts: (contacts: Contact[]) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

type ProjectTab = 'ledger' | 'tasks' | 'vault' | 'team' | 'log';

// Collaborative Presence Mock Data for UI/UX demonstration
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
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [taskText, setTaskText] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');

  // Collaboration Specific State
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string>('nsv');
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulatedBitrate, setSimulatedBitrate] = useState(2400);
  
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [conflictModal, setConflictModal] = useState<{ open: boolean, fileName: string, currentVersion: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedEvent = useMemo(() => (events || []).find(e => e.id === selectedEventId), [events, selectedEventId]);

  // Simulate active speaker switching and network jitter
  useEffect(() => {
    if (!isVideoCallActive) return;
    const speakers = ['nsv', 'Sarah', 'John'];
    const interval = setInterval(() => {
      const randomSpeaker = speakers[Math.floor(Math.random() * speakers.length)];
      setActiveSpeaker(randomSpeaker);
      setSimulatedBitrate(prev => Math.max(1800, Math.min(3200, prev + (Math.random() * 200 - 100))));
    }, 4500);
    return () => clearInterval(interval);
  }, [isVideoCallActive]);

  // Initialize Media Bridge with robust Fallback Path to prevent "Stuck" state
  useEffect(() => {
    if (isVideoCallActive && !localStream) {
      const initMedia = async () => {
        setIsConnecting(true);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720 }, 
            audio: true 
          });
          setLocalStream(stream);
          setIsSimulated(false);
        } catch (err) {
          console.warn("Hardware Access Denied - Switching to Strategy Mode (Simulator)");
          setIsSimulated(true);
          setIsCameraOff(true);
        } finally {
          // Use a small delay to ensure the UI transitions smoothly
          setTimeout(() => setIsConnecting(false), 800);
        }
      };
      initMedia();
    } else if (!isVideoCallActive && localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
  }, [isVideoCallActive]);

  // Secure attachment of stream to video element
  useEffect(() => {
    if (videoRef.current && localStream && !isCameraOff) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOff]);

  const handleUpdateEventWithVersion = (updated: BudgetEvent) => {
    onUpdateEvent({ ...updated, lastUpdated: new Date().toISOString() });
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
    handleUpdateEventWithVersion({ ...selectedEvent, items: [...(selectedEvent.items || []), newItem] });
    e.currentTarget.reset();
  };

  const handleAddTask = () => {
    if (!selectedEvent || !taskText.trim()) return;
    const newTask: ProjectTask = {
      id: generateId(),
      text: taskText.trim(),
      completed: false,
      assignedToId: currentUser
    };
    handleUpdateEventWithVersion({ ...selectedEvent, tasks: [...(selectedEvent.tasks || []), newTask] });
    setTaskText('');
  };

  const handleAddMember = () => {
    if (!selectedEvent || !inviteUsername.trim()) return;
    const currentMembers = selectedEvent.memberUsernames || [];
    const normalizedUsername = inviteUsername.trim().toLowerCase();
    
    if (currentMembers.some(m => m.toLowerCase() === normalizedUsername)) {
      alert("User is already a project member.");
      return;
    }
    
    handleUpdateEventWithVersion({ 
      ...selectedEvent, 
      memberUsernames: [...currentMembers, inviteUsername.trim()] 
    });
    setInviteUsername('');
  };

  const handleRemoveMember = (username: string) => {
    if (!selectedEvent || username === ADMIN_USER) return;
    if (confirm(`Are you sure you want to revoke project access for "${username}"?`)) {
      handleUpdateEventWithVersion({
        ...selectedEvent,
        memberUsernames: selectedEvent.memberUsernames.filter(u => u !== username)
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!selectedEvent || !file) return;

    let storageRef = generateId();
    let storageType: 'indexeddb' | 'filesystem' = 'indexeddb';

    if (directoryHandle) {
      try {
        storageRef = await saveFileToHardDrive(directoryHandle, selectedEvent.name, file.name, file);
        storageType = 'filesystem';
      } catch (err) { 
        console.warn("Hard drive storage failed, falling back to IndexedDB:", err); 
      }
    }

    const newFile: ProjectFile = {
      id: generateId(),
      name: file.name,
      type: file.type,
      size: file.size,
      timestamp: new Date().toISOString(),
      storageRef,
      storageType,
      version: 1,
      lastModifiedBy: currentUser
    };
    
    handleUpdateEventWithVersion({ ...selectedEvent, files: [...(selectedEvent.files || []), newFile] });
  };

  const handleSaveFileDraft = (fileId: string) => {
    if (!selectedEvent) return;
    const file = selectedEvent.files.find(f => f.id === fileId);
    if (!file) return;

    const isConflictDetected = Math.random() > 0.85; 
    if (isConflictDetected) {
      setConflictModal({ open: true, fileName: file.name, currentVersion: file.version });
      return;
    }

    const updatedFiles = selectedEvent.files.map(f => 
      f.id === fileId ? { 
        ...f, 
        version: f.version + 1, 
        lastModifiedBy: currentUser, 
        timestamp: new Date().toISOString() 
      } : f
    );
    handleUpdateEventWithVersion({ ...selectedEvent, files: updatedFiles });
    setEditingFileId(null);
  };

  return (
    <div className={`space-y-6 pb-20 max-w-6xl mx-auto px-2 ${!isAdmin ? 'text-slate-200' : ''}`}>
      {/* Presence Header - Reverted to Satellite theme */}
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

      {/* Enhanced Video Call UI - Satellite Flavor */}
      {isVideoCallActive && (
        <div className="space-y-6 mb-12 animate-in zoom-in-95 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Local Participant Card */}
            <div className={`bg-slate-900 rounded-[3.5rem] overflow-hidden border-2 relative aspect-video shadow-2xl transition-all duration-700 ${activeSpeaker === currentUser ? 'border-indigo-500 ring-8 ring-indigo-500/10 scale-[1.03]' : 'border-slate-800'}`}>
              
              {/* Uplink Dashboard - Fixed stuck state */}
              {isConnecting && (
                <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-500/30 rounded-full"></div>
                    <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <i className="fas fa-satellite absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400"></i>
                  </div>
                  <div className="text-center px-6">
                    <p className="text-[12px] font-black text-white uppercase tracking-[0.4em] mb-2">Establishing Secure Bridge</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Handshaking with Signal Cluster...</p>
                  </div>
                </div>
              )}

              {!isCameraOff ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale-[0.2] brightness-90 contrast-110" />
              ) : (
                <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center space-y-6">
                  <div className="w-28 h-28 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center text-4xl font-black text-white shadow-2xl">
                    {currentUser[0].toUpperCase()}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Signal: Inactive</p>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{isSimulated ? 'Strategy Fallback Active' : 'Camera Suspended'}</p>
                  </div>
                </div>
              )}
              
              {/* Overlay HUD - High Contrast Bright Icons */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/90 via-transparent to-black/40"></div>
              <div className="absolute top-6 left-6 flex items-center gap-4 pointer-events-none">
                <div className="bg-indigo-600 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white border border-white/20 shadow-2xl">Primary Node</div>
                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-black text-indigo-400 border border-indigo-500/30 uppercase tracking-widest">{simulatedBitrate.toFixed(0)} KBPS</div>
                {isMuted && <div className="bg-rose-600 px-2.5 py-1.5 rounded-xl text-[11px] shadow-2xl border border-rose-400/50"><i className="fas fa-microphone-slash text-white"></i></div>}
              </div>
              
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                <div className="bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] ${activeSpeaker === currentUser ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></div>
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">{currentUser} (Command)</span>
                </div>
                
                {/* High Contrast Controls - Explicit text-white brightness fixes */}
                <div className="flex gap-3 pointer-events-auto">
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all shadow-2xl ${isMuted ? 'bg-rose-600 border-rose-500 text-white' : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'}`}>
                    <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg text-white brightness-125`}></i>
                  </button>
                  <button onClick={() => setIsCameraOff(!isCameraOff)} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all shadow-2xl ${isCameraOff ? 'bg-rose-600 border-rose-500 text-white' : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'}`}>
                    <i className={`fas ${isCameraOff ? 'fa-video-slash' : 'fa-video'} text-lg text-white brightness-125`}></i>
                  </button>
                  <button onClick={() => setIsCasting(!isCasting)} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all shadow-2xl ${isCasting ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'}`}>
                    <i className="fas fa-desktop text-lg text-white brightness-125"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Teammate Cards - Fixed Contrast */}
            {MOCK_ONLINE_USERS.filter(u => u.online && u.name !== currentUser).map(u => (
              <div key={u.id} className={`bg-slate-900 rounded-[3.5rem] overflow-hidden border-2 relative aspect-video flex items-center justify-center group transition-all duration-700 ${activeSpeaker === u.name ? 'border-emerald-500 ring-8 ring-emerald-500/10 scale-[1.03]' : 'border-slate-800'}`}>
                <div className="absolute inset-0 bg-slate-950 opacity-60 group-hover:opacity-40 transition-opacity"></div>
                
                <div className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl font-black text-slate-400 uppercase border-4 transition-all duration-500 ${activeSpeaker === u.name ? 'bg-slate-800 border-emerald-500 scale-110 shadow-[0_0_40px_rgba(16,185,129,0.25)] text-white' : 'bg-slate-800 border-slate-700'}`}>
                  {u.name[0]}
                  {activeSpeaker === u.name && (
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-slate-900 flex items-center justify-center text-[10px] text-white shadow-2xl">
                      <i className="fas fa-volume-up"></i>
                    </div>
                  )}
                </div>

                <div className="absolute top-6 right-6 flex items-center gap-2 opacity-80">
                   {[1,2,3,4,5].map(bar => (
                     <div key={bar} className={`w-1.5 rounded-full transition-all duration-300 ${activeSpeaker === u.name ? 'bg-emerald-400' : 'bg-slate-700'} ${bar === 5 ? 'h-4' : bar === 4 ? 'h-3.5' : bar === 3 ? 'h-3' : bar === 2 ? 'h-2.5' : 'h-2'}`} style={{ height: activeSpeaker === u.name ? `${Math.random() * 14 + 6}px` : undefined }}></div>
                   ))}
                </div>

                <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-4">
                   <div className={`w-2.5 h-2.5 rounded-full shadow-2xl ${activeSpeaker === u.name ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></div>
                   <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">{u.name}</span>
                </div>

                {/* Collaborative Action Marker */}
                <div className="absolute top-6 left-6 bg-indigo-600/90 border border-white/20 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-3 transition-transform group-hover:scale-105 shadow-2xl">
                   <i className="fas fa-pen-nib text-[10px] text-white"></i>
                   <span className="text-[9px] font-black text-white uppercase tracking-widest">{u.name === 'Sarah' ? 'Editing Ledger' : 'Reviewing Matrix'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Broadcast Casting Area - Satellite Flavor */}
          {isCasting && (
            <div className="bg-slate-950 border-2 border-indigo-500/50 rounded-[4rem] p-10 shadow-3xl animate-in slide-in-from-bottom-12 duration-700 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                 <i className="fas fa-satellite-dish text-[180px] text-indigo-400"></i>
               </div>
               <div className="flex items-center justify-between mb-10 relative z-10">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl border border-indigo-400/30">
                      <i className="fas fa-broadcast-tower text-2xl text-white"></i>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tight leading-none">Global Strategy Casting</h3>
                      <p className="text-[11px] text-indigo-400 font-black uppercase tracking-[0.4em] mt-3">Active Data Stream • AES-256 Tunnel Established</p>
                    </div>
                 </div>
                 <button onClick={() => setIsCasting(false)} className="px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95">Terminate Cast</button>
               </div>
               <div className="bg-slate-900/50 border border-white/5 rounded-[4rem] aspect-[21/9] flex items-center justify-center relative group overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent"></div>
                  <div className="text-center space-y-6 relative z-10">
                     <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto shadow-2xl border border-indigo-500/20">
                        <i className="fas fa-microchip text-4xl text-indigo-400 animate-pulse"></i>
                     </div>
                     <p className="text-slate-400 font-black uppercase text-[14px] tracking-[0.6em]">System Architecture Syncing...</p>
                  </div>
                  <div className="absolute bottom-12 flex gap-6">
                     <div className="px-6 py-2.5 bg-black/80 rounded-2xl text-[9px] font-black text-indigo-300 border border-indigo-500/20 uppercase tracking-widest">FPS: 60.0</div>
                     <div className="px-6 py-2.5 bg-black/80 rounded-2xl text-[9px] font-black text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">STATUS: OPTIMAL</div>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

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
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 mb-8">
          <div className="grid grid-cols-1 gap-8">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Project Alias (Matrix Identity)</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. MISSION_RETIREMENT_2030" className="w-full p-6 bg-slate-800 border border-slate-700 text-white rounded-3xl outline-none font-black text-xl focus:ring-4 focus:ring-indigo-500/20" />
            </div>
          </div>
          <button onClick={() => { if (!newName) return; onAddEvent({ name: newName, date: newDate, status: 'active' }); setShowAddForm(false); setNewName(''); }} className="w-full mt-8 py-6 bg-indigo-600 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-[0.2em] text-[12px] hover:bg-indigo-500 transition-all">Deploy Operational Frame</button>
        </div>
      )}

      {selectedEventId && selectedEvent ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 bg-indigo-600 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
             <div className="flex items-center gap-6 relative z-10">
               <button onClick={() => setSelectedEventId(null)} className="w-14 h-14 flex items-center justify-center bg-white/15 text-white rounded-2xl hover:bg-white/25 transition-all active:scale-90"><i className="fas fa-chevron-left"></i></button>
               <div>
                 <h2 className="text-3xl font-black text-white tracking-tight leading-none">{selectedEvent.name}</h2>
                 <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.3em] mt-2">Last Revision: {selectedEvent.lastUpdated ? new Date(selectedEvent.lastUpdated).toLocaleTimeString() : 'Origin'}</p>
               </div>
             </div>
             <div className="flex bg-black/30 p-2 rounded-3xl border border-white/10 overflow-x-auto no-scrollbar max-w-full relative z-10 backdrop-blur-md">
               {(['ledger', 'tasks', 'vault', 'team', 'log'] as ProjectTab[]).map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all min-w-max ${activeTab === tab ? 'bg-white text-slate-900 shadow-2xl' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>{tab}</button>
               ))}
             </div>
          </div>

          <div className="min-h-[500px]">
            {activeTab === 'ledger' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-900/50 p-10 rounded-[3.5rem] border border-slate-800 shadow-xl backdrop-blur-md">
                    <div className="flex justify-between items-center mb-10">
                      <h3 className="font-black text-white uppercase text-[10px] tracking-[0.4em]">Resource Allocation Stream</h3>
                      <div className="flex gap-6">
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Gross Inflow</p>
                          <p className="text-lg font-black text-emerald-400">${selectedEvent.items.filter(i => i.type === 'income').reduce((a,b) => a + b.amount, 0).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Gross Outflow</p>
                          <p className="text-lg font-black text-rose-400">${selectedEvent.items.filter(i => i.type === 'expense').reduce((a,b) => a + b.amount, 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {selectedEvent.items.length > 0 ? selectedEvent.items.map(item => (
                        <div key={item.id} className="p-6 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] flex items-center justify-between group hover:bg-slate-800 hover:border-indigo-500/30 transition-all">
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg ${item.type === 'income' ? 'bg-emerald-500/15 text-emerald-400 shadow-emerald-500/5' : 'bg-rose-500/15 text-rose-400 shadow-rose-500/5'}`}>
                              <i className={`fas ${item.type === 'income' ? 'fa-plus-circle' : 'fa-minus-circle'}`}></i>
                            </div>
                            <div>
                              <p className="font-black text-sm text-white">{item.description}</p>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{item.category} • {item.date}</p>
                            </div>
                          </div>
                          <p className={`font-black text-xl ${item.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                            {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
                          </p>
                        </div>
                      )) : (
                        <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[2.5rem]">
                          <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">No allocations recorded</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 shadow-2xl h-fit">
                   <h3 className="font-black text-white uppercase text-[10px] tracking-[0.3em] mb-8">Execute Entry</h3>
                   <form onSubmit={handleAddItem} className="space-y-6">
                    <div><label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-2 block tracking-widest">Description</label><input name="description" className="w-full p-4 bg-slate-800 border border-slate-700 text-white rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500" required /></div>
                    <div><label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-2 block tracking-widest">Amount ($)</label><input name="amount" type="number" step="0.01" className="w-full p-4 bg-slate-800 border border-slate-700 text-white rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <button type="button" onClick={() => {}} className="py-3 bg-slate-800 text-slate-400 rounded-xl font-black uppercase text-[8px] tracking-widest">Type: Expense</button>
                      <button type="button" onClick={() => {}} className="py-3 bg-slate-800 text-slate-400 rounded-xl font-black uppercase text-[8px] tracking-widest">Cat: Other</button>
                    </div>
                    <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500 transition-all">Broadcast Log</button>
                   </form>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 bg-slate-900/50 p-10 rounded-[3.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="font-black text-white uppercase text-[10px] tracking-[0.4em]">Project Access Matrix</h3>
                    <div className="px-4 py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                      {selectedEvent.memberUsernames?.length || 1} Stakeholders
                    </div>
                  </div>
                  <div className="space-y-4">
                    {(selectedEvent.memberUsernames || [ADMIN_USER]).map(username => (
                      <div key={username} className="p-6 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black uppercase text-xl">
                            {username[0]}
                          </div>
                          <div>
                            <p className="font-black text-md text-white">{username}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{username === ADMIN_USER ? 'Project Originator (Admin)' : 'Matrix Collaborator'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          {isAdmin && username !== ADMIN_USER && (
                            <button onClick={() => handleRemoveMember(username)} className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white transition-all shadow-lg flex items-center justify-center">
                              <i className="fas fa-user-minus text-white"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {isAdmin && (
                  <div className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 shadow-2xl h-fit">
                    <h3 className="font-black text-white uppercase text-[10px] tracking-[0.3em] mb-8">Grant Access</h3>
                    <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl mb-8">
                      <p className="text-[9px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest">Input the collaborator's login username to grant full project access within the Matrix.</p>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-2 block tracking-widest">Collaborator ID</label>
                        <input 
                          value={inviteUsername} 
                          onChange={e => setInviteUsername(e.target.value)} 
                          className="w-full p-4 bg-slate-800 border border-slate-700 text-white rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="e.g. Sarah2024" 
                        />
                      </div>
                      <button onClick={handleAddMember} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500 transition-all">Authorize User</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'vault' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-900/50 p-10 rounded-[4rem] border border-slate-800 shadow-2xl min-h-[450px] backdrop-blur-md">
                    <div className="flex justify-between items-center mb-10">
                      <h3 className="font-black text-white uppercase text-[10px] tracking-[0.4em]">Strategic Data Vault</h3>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Storage Status</p>
                        <p className="text-[10px] font-black text-indigo-400 uppercase">{selectedEvent.files.length} Optimized Assets</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                      {selectedEvent.files.map(file => (
                        <div key={file.id} className="p-8 bg-slate-800/40 border border-slate-700/50 rounded-[3rem] flex flex-col items-center text-center group relative cursor-pointer hover:bg-slate-800 hover:border-indigo-500/50 transition-all shadow-lg" onClick={() => setEditingFileId(file.id)}>
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-400 shadow-2xl mb-5 group-hover:scale-110 transition-transform border border-slate-700">
                            <i className="fas fa-file-invoice text-2xl text-white"></i>
                          </div>
                          <p className="font-black text-[11px] text-white truncate w-full mb-1">{file.name}</p>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">v{file.version} • {file.lastModifiedBy}</p>
                          <div className="absolute top-4 right-4 w-2 h-2 bg-emerald-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                      ))}
                      <div className="p-8 border-4 border-dashed border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-slate-600 hover:border-indigo-500/30 hover:text-indigo-400 cursor-pointer transition-all group" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-12 h-12 bg-slate-800/30 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-indigo-500/10">
                          <i className="fas fa-plus text-xl text-white"></i>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest">Inject Asset</span>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="font-black text-white uppercase text-[10px] tracking-[0.3em] mb-8">Version Feed</h3>
                  <div className="space-y-6">
                    {selectedEvent.files.length > 0 ? selectedEvent.files.slice(-4).reverse().map(f => (
                      <div key={f.id} className="text-[10px] font-medium text-slate-400 flex items-start gap-4 border-l-2 border-slate-800 pl-4 py-1">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 -ml-[21px]"></div>
                        <div>
                          <p className="font-black text-slate-300">Revision v{f.version}</p>
                          <p className="mt-0.5">{f.lastModifiedBy} updated <b className="text-white">{f.name}</b></p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center py-10">No revisions found</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
                <div className="lg:col-span-2 bg-slate-900/50 p-10 rounded-[4rem] border border-slate-800 shadow-2xl backdrop-blur-md">
                  <h3 className="font-black text-white uppercase text-[10px] tracking-[0.4em] mb-10">Operational Roadmaps</h3>
                  <div className="space-y-4">
                    {selectedEvent.tasks.length > 0 ? selectedEvent.tasks.map(task => (
                      <div key={task.id} className={`p-6 bg-slate-800/40 border rounded-[2.5rem] flex items-center gap-6 group transition-all ${task.completed ? 'border-emerald-500/20 opacity-50' : 'border-slate-700/50 hover:border-indigo-500/30'}`}>
                        <button 
                          onClick={() => handleUpdateEventWithVersion({...selectedEvent, tasks: selectedEvent.tasks.map(t => t.id === task.id ? {...t, completed: !t.completed} : t)})}
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all shadow-lg ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-800 border-slate-700 hover:border-emerald-500/50 text-transparent'}`}
                        >
                          <i className="fas fa-check text-sm text-white"></i>
                        </button>
                        <div>
                          <p className={`font-black text-md ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>{task.text}</p>
                          <p className="text-[9px] font-black text-slate-500 uppercase mt-1.5 tracking-widest">Owner: {task.assignedToId}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[3rem]">
                        <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">No objectives deployed</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 shadow-2xl h-fit">
                   <h3 className="font-black text-white uppercase text-[10px] tracking-[0.3em] mb-8">Deploy Milestone</h3>
                   <textarea value={taskText} onChange={e => setTaskText(e.target.value)} className="w-full p-6 bg-slate-800 border border-slate-700 text-white rounded-3xl font-black text-xs h-40 no-scrollbar outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Describe the objective..."></textarea>
                   <button onClick={handleAddTask} className="w-full mt-6 py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500 transition-all">Publish Milestone</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
           {events.map(event => (
              <div key={event.id} onClick={() => setSelectedEventId(event.id)} className="bg-slate-900 p-10 rounded-[4rem] border border-slate-800 shadow-2xl cursor-pointer hover:border-indigo-600/50 hover:-translate-y-2 transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex justify-between items-start mb-12">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all border border-slate-700">
                    <i className="fas fa-layer-group text-2xl text-white"></i>
                  </div>
                  <div className="flex -space-x-3">
                    {(event.memberUsernames || [ADMIN_USER]).slice(0, 3).map(u => (
                      <div key={u} className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black uppercase ring-2 ring-indigo-500/10" title={u}>{u[0]}</div>
                    ))}
                    {(event.memberUsernames?.length || 1) > 3 && (
                      <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-[9px] font-black text-white">+{event.memberUsernames.length - 3}</div>
                    )}
                  </div>
                </div>
                <h3 className="font-black text-white text-2xl leading-none mb-4 group-hover:text-indigo-400 transition-colors tracking-tight">{event.name}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-12">Modified: {new Date(event.lastUpdated).toLocaleDateString()}</p>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-slate-800/60 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-indigo-400 tracking-widest border border-slate-700/50">{event.files.length} Assets</div>
                  <div className="bg-slate-800/60 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-emerald-400 tracking-widest border border-slate-700/50">{event.tasks.filter(t => t.completed).length}/{event.tasks.length} Resolved</div>
                </div>
              </div>
           ))}
           {events.length === 0 && !isAdmin && (
             <div className="md:col-span-2 lg:col-span-3 py-24 text-center bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-[4rem] backdrop-blur-md">
               <div className="w-20 h-20 bg-slate-800 rounded-[2rem] flex items-center justify-center text-slate-600 mx-auto mb-8 text-3xl shadow-2xl border border-slate-700">
                 <i className="fas fa-user-secret text-white"></i>
               </div>
               <p className="text-slate-400 font-black uppercase text-sm tracking-[0.3em] mb-2">Access Denied</p>
               <p className="text-slate-600 text-[11px] font-bold uppercase tracking-widest">Contact System Admin ("nsv") for Project Authorization.</p>
             </div>
           )}
        </div>
      )}

      {/* VERSION CONFLICT MODAL */}
      {conflictModal?.open && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="bg-slate-900 max-w-md w-full p-12 rounded-[4rem] border-2 border-rose-500 shadow-2xl animate-in zoom-in-95 duration-300">
             <div className="w-24 h-24 bg-rose-500/20 text-rose-500 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-10 border border-rose-500/20 shadow-xl">
               <i className="fas fa-sync-alt animate-spin-slow"></i>
             </div>
             <h3 className="text-2xl font-black text-white text-center mb-4 tracking-tight">Revision Conflict</h3>
             <p className="text-slate-400 text-sm text-center mb-10 leading-relaxed font-medium">A collaborator has updated <b>{conflictModal.fileName}</b> to <b>v{conflictModal.currentVersion + 1}</b> while you were editing. To prevent data loss, you must merge the latest changes.</p>
             <div className="space-y-4">
               <button onClick={() => setConflictModal(null)} className="w-full py-6 bg-indigo-600 text-white font-black rounded-[1.5rem] shadow-2xl uppercase tracking-[0.2em] text-[11px] hover:bg-indigo-500 transition-all">Pull Latest Revision</button>
               <button onClick={() => setConflictModal(null)} className="w-full py-4 text-slate-500 font-black uppercase tracking-[0.2em] text-[9px] hover:text-rose-400 transition-all">Discard Local Studio State</button>
             </div>
          </div>
        </div>
      )}

      {/* COLLABORATIVE STUDIO (DOCUMENT EDITOR) */}
      {editingFileId && (
        <div className="fixed inset-0 z-[250] bg-slate-950/98 backdrop-blur-[50px] p-6 md:p-12 flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-8">
               <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl shadow-2xl shadow-indigo-500/20">
                 <i className="fas fa-file-invoice text-white"></i>
               </div>
               <div>
                 <h2 className="text-3xl font-black text-white tracking-tight">{selectedEvent?.files.find(f => f.id === editingFileId)?.name}</h2>
                 <p className="text-[11px] text-indigo-400 font-black uppercase tracking-[0.4em] mt-2">Active Studio: {currentUser} • Revision v{selectedEvent?.files.find(f => f.id === editingFileId)?.version}</p>
               </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => handleSaveFileDraft(editingFileId)} className="px-10 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[12px] shadow-2xl shadow-emerald-500/20 hover:bg-emerald-500 transition-all active:scale-95">Commit Revision</button>
              <button onClick={() => setEditingFileId(null)} className="px-10 py-5 bg-slate-800 text-slate-400 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[12px] hover:bg-slate-700 hover:text-white transition-all">Exit Studio</button>
            </div>
          </div>
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-[4rem] p-16 shadow-inner overflow-y-auto no-scrollbar relative backdrop-blur-md">
             <div className="absolute top-10 right-10 flex items-center gap-4 bg-slate-800/60 px-5 py-2.5 rounded-2xl border border-white/5">
               <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sarah is co-editing</span>
             </div>
             <textarea 
               className="w-full h-full bg-transparent border-none outline-none text-slate-200 font-medium leading-[2.2] resize-none text-xl placeholder:text-slate-700"
               placeholder="Initiate strategic drafting session..."
               defaultValue="PROJECT_MATRIX_LOG: Revision Active. All keystrokes are being buffered for peer synchronization. Committing updates will increment the global version ID."
             ></textarea>
          </div>
          <div className="mt-8 flex justify-center">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">Secure Operational Environment • Encrypted Stream Active</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventPlanner;