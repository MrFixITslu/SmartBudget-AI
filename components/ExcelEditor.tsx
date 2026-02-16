
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface CellData {
  value: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
}

interface Props {
  initialTitle: string;
  initialData: string; // JSON string of CellData[][]
  onSave: (title: string, data: string) => Promise<void>;
  onClose: () => void;
  isVaultMounted: boolean;
  onMountVault?: () => void;
}

const INITIAL_ROWS = 50;
const INITIAL_COLS = 26; // A-Z

const createEmptyGrid = (): CellData[][] => {
  return Array(INITIAL_ROWS).fill(null).map(() => 
    Array(INITIAL_COLS).fill(null).map(() => ({ value: '' }))
  );
};

const ExcelEditor: React.FC<Props> = ({ initialTitle, initialData, onSave, onClose, isVaultMounted, onMountVault }) => {
  const [title, setTitle] = useState(initialTitle);
  // Initialize with a proper grid to avoid [] state during first render
  const [grid, setGrid] = useState<CellData[][]>(() => createEmptyGrid());
  const [selectedCell, setSelectedCell] = useState<{ r: number, c: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Memoize current cell for safe access in toolbar
  const currentCell = useMemo(() => {
    if (!selectedCell || !grid[selectedCell.r]) return null;
    return grid[selectedCell.r][selectedCell.c] || null;
  }, [selectedCell, grid]);

  // Sync grid if initialData changes or is provided
  useEffect(() => {
    if (initialData) {
      try {
        const parsed = JSON.parse(initialData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGrid(parsed);
        }
      } catch (e) {
        console.error("Failed to load spreadsheet data", e);
      }
    }
  }, [initialData]);

  const handleCellChange = (r: number, c: number, value: string) => {
    const newGrid = [...grid];
    if (!newGrid[r]) return;
    newGrid[r] = [...newGrid[r]];
    newGrid[r][c] = { ...newGrid[r][c], value };
    setGrid(newGrid);
  };

  const updateFormat = (format: Partial<CellData>) => {
    if (!selectedCell || !grid[selectedCell.r]) return;
    const { r, c } = selectedCell;
    const newGrid = [...grid];
    newGrid[r] = [...newGrid[r]];
    newGrid[r][c] = { ...newGrid[r][c], ...format };
    setGrid(newGrid);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(title, JSON.stringify(grid));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setIsSaving(false);
    }
  };

  const getColLabel = (index: number) => String.fromCharCode(65 + (index % 26));

  const addRow = () => {
    const colCount = grid[0]?.length || INITIAL_COLS;
    setGrid([...grid, Array(colCount).fill(null).map(() => ({ value: '' }))]);
  };

  const addCol = () => {
    setGrid(grid.map(row => [...row, { value: '' }]));
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-100 flex flex-col animate-in fade-in duration-300 overflow-hidden">
      {/* EXCEL RIBBON */}
      <div className="w-full bg-white border-b border-slate-300 shadow-sm shrink-0">
        <div className="px-6 py-2 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
              <i className="fas fa-file-excel text-emerald-600 text-lg"></i>
              <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Cell Matrix Pro</span>
            </div>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm w-64 placeholder:text-slate-300"
              placeholder="Spreadsheet Name..."
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md transition flex items-center gap-2 ${isSaving ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              {isSaving ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-floppy-disk"></i>}
              {isSaving ? 'Committing...' : 'Save Matrix'}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="px-6 py-2 flex items-center gap-6 overflow-x-auto no-scrollbar">
          {/* Font Controls */}
          <div className="flex flex-col gap-1 pr-4 border-r border-slate-200">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => updateFormat({ bold: !currentCell?.bold })}
                className={`w-8 h-8 rounded transition-all ${currentCell?.bold ? 'bg-emerald-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}
              ><i className="fas fa-bold text-xs"></i></button>
              <button 
                onClick={() => updateFormat({ italic: !currentCell?.italic })}
                className={`w-8 h-8 rounded transition-all ${currentCell?.italic ? 'bg-emerald-600 text-white shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}
              ><i className="fas fa-italic text-xs"></i></button>
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase text-center">Font</span>
          </div>

          {/* Alignment */}
          <div className="flex flex-col gap-1 pr-4 border-r border-slate-200">
            <div className="flex items-center gap-1">
              <button onClick={() => updateFormat({ align: 'left' })} className={`w-8 h-8 rounded transition-all ${currentCell?.align === 'left' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}><i className="fas fa-align-left text-xs"></i></button>
              <button onClick={() => updateFormat({ align: 'center' })} className={`w-8 h-8 rounded transition-all ${currentCell?.align === 'center' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}><i className="fas fa-align-center text-xs"></i></button>
              <button onClick={() => updateFormat({ align: 'right' })} className={`w-8 h-8 rounded transition-all ${currentCell?.align === 'right' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}><i className="fas fa-align-right text-xs"></i></button>
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase text-center">Alignment</span>
          </div>

          {/* Cells Management */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button onClick={addRow} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 transition">
                <i className="fas fa-plus-circle mr-1"></i> Row
              </button>
              <button onClick={addCol} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 transition">
                <i className="fas fa-plus-circle mr-1"></i> Column
              </button>
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase text-center">Structure</span>
          </div>
        </div>
      </div>

      {/* FORMULA BAR */}
      <div className="w-full bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center gap-3 shadow-inner">
        <div className="bg-white border border-slate-300 rounded px-3 py-1 text-[11px] font-black text-slate-400 min-w-[60px] text-center">
          {selectedCell ? `${getColLabel(selectedCell.c)}${selectedCell.r + 1}` : '--'}
        </div>
        <div className="text-slate-300">|</div>
        <div className="flex-1 bg-white border border-slate-300 rounded px-3 flex items-center">
          <span className="italic text-slate-400 font-serif mr-2">fx</span>
          <input 
            type="text"
            className="w-full py-1 text-xs font-medium outline-none text-slate-700"
            value={currentCell?.value || ''}
            onChange={(e) => selectedCell && handleCellChange(selectedCell.r, selectedCell.c, e.target.value)}
            placeholder="Enter value or formula..."
          />
        </div>
      </div>

      {/* GRID AREA */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-slate-200">
        <div className="inline-block min-w-full">
          <table className="border-collapse table-fixed bg-white shadow-2xl">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="w-10 border-r border-slate-300 sticky left-0 top-0 z-20 bg-slate-100"></th>
                {grid[0]?.map((_, c) => (
                  <th key={c} className="w-32 py-1 px-2 border-r border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 bg-slate-100">
                    {getColLabel(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, r) => (
                <tr key={r} className="border-b border-slate-200 group">
                  <td className="w-10 border-r border-slate-300 bg-slate-100 text-[10px] font-black text-slate-400 text-center sticky left-0 z-10 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                    {r + 1}
                  </td>
                  {row.map((cell, c) => (
                    <td 
                      key={c}
                      onClick={() => setSelectedCell({ r, c })}
                      className={`w-32 border-r border-slate-200 p-0 transition-all ${selectedCell?.r === r && selectedCell?.c === c ? 'ring-2 ring-emerald-500 z-10 relative shadow-lg' : ''}`}
                    >
                      <input 
                        type="text"
                        value={cell.value}
                        onChange={(e) => handleCellChange(r, c, e.target.value)}
                        onFocus={() => setSelectedCell({ r, c })}
                        className={`w-full h-full p-2 text-xs outline-none bg-transparent ${cell.bold ? 'font-black' : 'font-medium'} ${cell.italic ? 'italic' : ''} text-${cell.align || 'left'} text-slate-800`}
                        style={{ color: cell.color }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="w-full bg-emerald-700 text-white h-7 flex items-center justify-between px-6 text-[10px] font-bold z-40 shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <i className="fas fa-table"></i>
               <span>Sheet 1</span>
            </div>
            <div className="flex items-center gap-2">
               <span>Selection: {selectedCell ? `${getColLabel(selectedCell.c)}${selectedCell.r + 1}` : 'None'}</span>
            </div>
         </div>
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <i className={`fas ${isVaultMounted ? 'fa-cloud-check' : 'fa-database'} text-emerald-300`}></i>
               <span>{isVaultMounted ? 'Cloud Mirror Sync' : 'Internal Secure Matrix'}</span>
            </div>
            {saveSuccess && (
               <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                  <i className="fas fa-check-circle text-emerald-300"></i>
                  <span>CELLS PERSISTED</span>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ExcelEditor;
