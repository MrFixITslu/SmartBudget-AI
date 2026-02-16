
import React, { useState, useEffect, useRef } from 'react';

interface Props {
  initialTitle: string;
  initialContent: string;
  onSave: (title: string, content: string) => Promise<void>;
  onClose: () => void;
  isVaultMounted: boolean;
  onMountVault?: () => void;
}

const DocumentEditor: React.FC<Props> = ({ initialTitle, initialContent, onSave, onClose, isVaultMounted, onMountVault }) => {
  const [title, setTitle] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [activeStates, setActiveStates] = useState<Record<string, any>>({});
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent || '<p><br></p>';
      updateStats();
      // Force paragraph wrapping
      document.execCommand('defaultParagraphSeparator', false, 'p');
    }
  }, []);

  const updateStats = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || "";
      const words = text.trim().split(/\s+/).filter(w => w.length > 0);
      setWordCount(words.length);
      
      const currentBlock = document.queryCommandValue('formatBlock').toLowerCase();
      const currentFontSize = document.queryCommandValue('fontSize');
      
      setActiveStates({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        listUl: document.queryCommandState('insertUnorderedList'),
        listOl: document.queryCommandState('insertOrderedList'),
        h1: currentBlock === 'h1' || currentBlock === '<h1>',
        h2: currentBlock === 'h2' || currentBlock === '<h2>',
        p: currentBlock === 'p' || currentBlock === '<p>' || !currentBlock || currentBlock === 'div',
        fontSize: currentFontSize || '3'
      });
    }
  };

  const execCommand = (e: React.MouseEvent | React.KeyboardEvent | null, command: string, value: string = '') => {
    if (e && 'preventDefault' in e) e.preventDefault(); 
    if (!editorRef.current) return;
    
    editorRef.current.focus();

    try {
      if (command === 'formatBlock' && value) {
        // Modern browser normalization
        const finalValue = value.startsWith('<') ? value : `<${value}>`;
        document.execCommand(command, false, finalValue);
      } else {
        document.execCommand(command, false, value);
      }
    } catch (err) {
      console.warn("Formatting Engine Error:", command, err);
    }
    
    updateStats();
  };

  const changeFontSize = (delta: number) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const current = parseInt(activeStates.fontSize) || 3;
    const next = Math.max(1, Math.min(7, current + delta));
    document.execCommand('fontSize', false, next.toString());
    updateStats();
  };

  const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // Inject standard responsive image tag
      const imgTag = `<img src="${dataUrl}" style="max-width:100%; border-radius:12px; margin: 10px 0; border: 1px solid #e2e8f0; shadow: 0 10px 15px -3px rgba(0,0,0,0.1);" />`;
      document.execCommand('insertHTML', false, imgTag);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      const content = editorRef.current.innerHTML;
      await onSave(title, content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Internal storage commit failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-200 flex flex-col items-center justify-start animate-in fade-in duration-300 overflow-hidden">
      
      {/* RIBBON UI */}
      <div className="w-full bg-white border-b border-slate-300 shadow-sm z-30 px-6 pt-2 pb-1 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-100">
              <i className="fas fa-file-word text-indigo-600 text-lg"></i>
              <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Document Pro</span>
            </div>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm w-64 placeholder:text-slate-300"
              placeholder="Untitled Document..."
            />
          </div>
          
          <div className="flex items-center gap-2">
            {!isVaultMounted && (
              <button onClick={onMountVault} className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition flex items-center gap-2">
                <i className="fas fa-plug-circle-xmark"></i> Reconnect SSD
              </button>
            )}
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md transition flex items-center gap-2 ${isSaving ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {isSaving ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-floppy-disk"></i>}
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2 border-t border-slate-100">
          
          <div className="flex flex-col gap-1 pr-4 border-r border-slate-200 shrink-0">
             <div className="flex items-center gap-1">
               <button onMouseDown={(e) => execCommand(e, 'undo')} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600" title="Undo"><i className="fas fa-undo text-xs"></i></button>
               <button onMouseDown={(e) => execCommand(e, 'redo')} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600" title="Redo"><i className="fas fa-redo text-xs"></i></button>
             </div>
             <span className="text-[8px] font-bold text-slate-400 uppercase text-center">History</span>
          </div>

          <div className="flex flex-col gap-1 pr-4 border-r border-slate-200 shrink-0">
             <div className="flex items-center gap-1">
                <button 
                  onMouseDown={(e) => execCommand(e, 'bold')} 
                  className={`w-8 h-8 rounded transition-all ${activeStates.bold ? 'bg-indigo-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}
                ><i className="fas fa-bold text-xs"></i></button>
                <button 
                  onMouseDown={(e) => execCommand(e, 'italic')} 
                  className={`w-8 h-8 rounded transition-all ${activeStates.italic ? 'bg-indigo-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}
                ><i className="fas fa-italic text-xs"></i></button>
                <button 
                  onMouseDown={(e) => execCommand(e, 'underline')} 
                  className={`w-8 h-8 rounded transition-all ${activeStates.underline ? 'bg-indigo-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}
                ><i className="fas fa-underline text-xs"></i></button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <button onMouseDown={() => changeFontSize(1)} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600" title="Large"><i className="fas fa-font text-xs"></i><i className="fas fa-plus text-[6px]"></i></button>
                <button onMouseDown={() => changeFontSize(-1)} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600" title="Small"><i className="fas fa-font text-[8px]"></i><i className="fas fa-minus text-[6px]"></i></button>
             </div>
             <span className="text-[8px] font-bold text-slate-400 uppercase text-center">Format</span>
          </div>

          <div className="flex flex-col gap-1 pr-4 border-r border-slate-200 shrink-0">
             <div className="flex items-center gap-1">
                <button onMouseDown={(e) => execCommand(e, 'formatBlock', 'h1')} className={`px-3 h-8 rounded text-[10px] font-black transition-all ${activeStates.h1 ? 'bg-indigo-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}>H1</button>
                <button onMouseDown={(e) => execCommand(e, 'formatBlock', 'h2')} className={`px-3 h-8 rounded text-[10px] font-black transition-all ${activeStates.h2 ? 'bg-indigo-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}>H2</button>
                <button onMouseDown={(e) => execCommand(e, 'formatBlock', 'p')} className={`px-3 h-8 rounded text-[10px] font-black transition-all ${activeStates.p ? 'bg-indigo-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}>P</button>
             </div>
             <span className="text-[8px] font-bold text-slate-400 uppercase text-center">Paragraph</span>
          </div>

          <div className="flex flex-col gap-1 pr-4 border-r border-slate-200 shrink-0">
             <div className="flex items-center gap-1">
                <button onMouseDown={(e) => execCommand(e, 'insertUnorderedList')} className={`w-8 h-8 rounded transition-all ${activeStates.listUl ? 'bg-indigo-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}><i className="fas fa-list-ul text-xs"></i></button>
                <button onMouseDown={(e) => execCommand(e, 'insertOrderedList')} className={`w-8 h-8 rounded transition-all ${activeStates.listOl ? 'bg-indigo-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}><i className="fas fa-list-ol text-xs"></i></button>
             </div>
             <span className="text-[8px] font-bold text-slate-400 uppercase text-center">Lists</span>
          </div>

          <div className="flex flex-col gap-1 pr-4 border-r border-slate-200 shrink-0">
             <div className="flex items-center gap-1">
                <button onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600"><i className="fas fa-image text-xs"></i></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageInsert} />
                <button onMouseDown={(e) => execCommand(e, 'insertHorizontalRule')} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600"><i className="fas fa-minus text-xs"></i></button>
             </div>
             <span className="text-[8px] font-bold text-slate-400 uppercase text-center">Insert</span>
          </div>

          <div className="flex flex-col gap-1 shrink-0">
             <div className="flex items-center gap-1">
                <button onMouseDown={(e) => execCommand(e, 'justifyLeft')} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600"><i className="fas fa-align-left text-xs"></i></button>
                <button onMouseDown={(e) => execCommand(e, 'justifyCenter')} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600"><i className="fas fa-align-center text-xs"></i></button>
                <button onMouseDown={(e) => execCommand(e, 'justifyRight')} className="w-8 h-8 hover:bg-slate-100 rounded text-slate-600"><i className="fas fa-align-right text-xs"></i></button>
             </div>
             <span className="text-[8px] font-bold text-slate-400 uppercase text-center">Align</span>
          </div>

          <button onMouseDown={(e) => execCommand(e, 'removeFormat')} className="ml-auto px-4 h-8 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-lg font-black text-[8px] uppercase tracking-widest flex items-center gap-2 border border-slate-100 transition-all shrink-0">
            <i className="fas fa-eraser"></i> Clear Styles
          </button>
        </div>
      </div>

      {/* PAPER CANVAS */}
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center py-10 px-4 bg-slate-200">
        <div className="w-full max-w-[850px] relative shadow-2xl">
          <div 
            ref={editorRef}
            contentEditable
            onInput={updateStats}
            onKeyUp={updateStats}
            onMouseUp={updateStats}
            className="w-full min-h-[1100px] bg-white p-[90px] outline-none text-slate-800 prose prose-slate max-w-none prose-h1:text-4xl prose-h1:font-black prose-p:text-[17px] prose-p:leading-relaxed prose-li:text-[17px] prose-ul:list-disc prose-ol:list-decimal"
            style={{ fontFamily: "'Inter', sans-serif" }}
          />
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="w-full bg-indigo-700 text-white h-7 flex items-center justify-between px-6 text-[10px] font-bold z-40 shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <i className="fas fa-file-alt"></i>
               <span>Page 1 of 1</span>
            </div>
            <div className="flex items-center gap-2">
               <span>{wordCount} Words</span>
            </div>
         </div>
         
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <i className={`fas ${isVaultMounted ? 'fa-cloud-check text-emerald-300' : 'fa-database text-amber-300'}`}></i>
               <span>{isVaultMounted ? 'SSD Mirror Synchronized' : 'INTERNAL DATABASE VAULT'}</span>
            </div>
            {saveSuccess && (
               <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                  <i className="fas fa-check-circle text-emerald-300"></i>
                  <span>AUTO-SYNC SUCCESS</span>
               </div>
            )}
            <div className="flex items-center gap-4 border-l border-white/20 pl-4">
               <i className="fas fa-print opacity-50 cursor-pointer hover:opacity-100"></i>
               <div className="flex items-center gap-2">
                  <div className="w-20 h-1 bg-white/20 rounded-full">
                     <div className="w-full h-full bg-white rounded-full"></div>
                  </div>
                  <span>100%</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default DocumentEditor;
