
import React, { useState, useMemo } from 'react';
import { BudgetEvent, EventItem, EVENT_ITEM_CATEGORIES, EventItemCategory } from '../types';

interface Props {
  events: BudgetEvent[];
  onAddEvent: (event: Omit<BudgetEvent, 'id' | 'items'>) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (event: BudgetEvent) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const EventPlanner: React.FC<Props> = ({ events, onAddEvent, onDeleteEvent, onUpdateEvent }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newProjected, setNewProjected] = useState('');

  const selectedEvent = useMemo(() => 
    events.find(e => e.id === selectedEventId), 
    [events, selectedEventId]
  );

  const calculatePnL = (event: BudgetEvent) => {
    // Explicitly type reduce as number to fix arithmetic errors
    const income = event.items.filter(i => i.type === 'income').reduce<number>((acc, i) => acc + i.amount, 0);
    const expenses = event.items.filter(i => i.type === 'expense').reduce<number>((acc, i) => acc + i.amount, 0);
    return { income, expenses, net: income - expenses };
  };

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

    onUpdateEvent({
      ...selectedEvent,
      items: [...selectedEvent.items, newItem]
    });
    e.currentTarget.reset();
  };

  const handleDeleteItem = (itemId: string) => {
    if (!selectedEvent) return;
    onUpdateEvent({
      ...selectedEvent,
      items: selectedEvent.items.filter(i => i.id !== itemId)
    });
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Project Planner</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Full P&L Event Management</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${showAddForm ? 'bg-rose-50 text-rose-600' : 'bg-slate-900 text-white shadow-xl shadow-slate-200'}`}
        >
          <i className={`fas ${showAddForm ? 'fa-times' : 'fa-plus'}`}></i>
          {showAddForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {showAddForm && (
        <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Name</label>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                placeholder="e.g. Wedding Reception" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Date</label>
              <input 
                type="date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)} 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Budget Goal ($)</label>
              <input 
                type="number" 
                value={newProjected} 
                onChange={(e) => setNewProjected(e.target.value)} 
                placeholder="0.00"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" 
              />
            </div>
          </div>
          <button 
            onClick={() => { 
              if (!newName) return;
              onAddEvent({ 
                name: newName, 
                date: newDate, 
                status: 'planned',
                projectedBudget: parseFloat(newProjected) || 0
              }); 
              setNewName(''); 
              setNewProjected('');
              setShowAddForm(false); 
            }}
            className="w-full mt-6 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 uppercase tracking-widest text-[11px] transition active:scale-[0.98]"
          >
            Create Project
          </button>
        </div>
      )}

      {!selectedEventId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => {
            const stats = calculatePnL(event);
            const isOver = !!(event.projectedBudget && stats.expenses > event.projectedBudget);
            return (
              <div 
                key={event.id} 
                onClick={() => setSelectedEventId(event.id)}
                className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm cursor-pointer hover:shadow-xl hover:translate-y-[-4px] transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-black text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors">{event.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{event.date}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${
                    event.status === 'completed' ? 'bg-slate-100 text-slate-500' : 
                    event.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {event.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Income</p>
                    <p className="text-xs font-black text-slate-800">${stats.income.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Cost</p>
                    <p className={`text-xs font-black ${isOver ? 'text-rose-600' : 'text-slate-800'}`}>
                      ${stats.expenses.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div>
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Net P&L</p>
                    <p className={`text-lg font-black ${stats.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stats.net >= 0 ? '+' : '-'}${Math.abs(stats.net).toLocaleString()}
                    </p>
                  </div>
                  {event.projectedBudget ? (
                    <div className="text-right">
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Budget Usage</p>
                      <p className={`text-xs font-black ${isOver ? 'text-rose-600' : 'text-slate-500'}`}>
                        {((stats.expenses / event.projectedBudget) * 100).toFixed(0)}%
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-[3rem]">
              <i className="fas fa-chart-line text-4xl text-slate-200 mb-4"></i>
              <h4 className="text-slate-800 font-black uppercase text-sm tracking-widest">No Projects Found</h4>
              <p className="text-slate-400 text-xs mt-2">Create an event to start tracking specialized P&L.</p>
            </div>
          )}
        </div>
      ) : selectedEvent && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setSelectedEventId(null)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition shadow-sm"
            >
              <i className="fas fa-chevron-left"></i> Project Overview
            </button>
            <div className="flex gap-2">
              <button 
                onClick={() => onUpdateEvent({ ...selectedEvent, status: 'completed' })}
                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Mark as Finalized
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-8">
              {/* Professional P&L Dashboard */}
              <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
                   <i className="fas fa-file-invoice-dollar text-[140px]"></i>
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h2 className="text-3xl font-black mb-2 tracking-tight">{selectedEvent.name}</h2>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          <i className="far fa-calendar-alt text-indigo-400"></i> {selectedEvent.date}
                        </span>
                        <span className="w-1.5 h-1.5 bg-slate-600 rounded-full"></span>
                        <span className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em]">{selectedEvent.status}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Net Balance</p>
                      <h3 className={`text-4xl font-black ${calculatePnL(selectedEvent).net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${calculatePnL(selectedEvent).net.toLocaleString()}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem] hover:bg-white/10 transition">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2">Project Revenue</p>
                      <p className="text-2xl font-black text-emerald-400">${calculatePnL(selectedEvent).income.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem] hover:bg-white/10 transition">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2">Project Expenses</p>
                      <p className="text-2xl font-black text-rose-400">${calculatePnL(selectedEvent).expenses.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/10 border border-white/20 p-5 rounded-[2rem] hover:bg-white/20 transition">
                      <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest mb-2">Projected Budget</p>
                      <p className="text-2xl font-black text-white">
                        ${selectedEvent.projectedBudget?.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown Ledger */}
              <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.3em] mb-8">P&L Detailed Breakdown</h3>
                <div className="space-y-4">
                  {selectedEvent.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl group hover:bg-white hover:ring-2 hover:ring-indigo-100 transition shadow-sm border border-transparent">
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg ${item.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                          <i className={`fas ${item.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-800">{item.description}</p>
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{item.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <p className={`font-black text-base ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
                        </p>
                        <button 
                          onClick={() => handleDeleteItem(item.id)} 
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <i className="fas fa-trash-alt text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  {selectedEvent.items.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No financial data logged</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Quick P&L Entry Form */}
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-8">Quick Ledger Entry</h3>
                <form onSubmit={handleAddItem} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Entry Type</label>
                    <select name="type" className="w-full p-4 bg-slate-100 border-none rounded-2xl outline-none text-xs font-black uppercase text-slate-600">
                      <option value="expense">Expense (-)</option>
                      <option value="income">Revenue (+)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Category</label>
                    <select name="category" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-bold text-slate-700">
                      {EVENT_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Description</label>
                    <input name="description" required placeholder="e.g. Venue Rental" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Amount ($)</label>
                    <input name="amount" type="number" step="0.01" required placeholder="0.00" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-black text-slate-800" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-[11px] hover:bg-indigo-600 transition active:scale-[0.98]">
                    Record Entry
                  </button>
                </form>
              </div>

              {/* Internal Project Notes */}
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-6">Strategic Notes</h3>
                <textarea 
                  className="w-full h-48 p-5 bg-slate-50 rounded-[2rem] outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 font-medium leading-relaxed resize-none border border-slate-100"
                  placeholder="Details about vendors, contract terms, or logistics..."
                  value={selectedEvent.notes || ''}
                  onChange={(e) => onUpdateEvent({ ...selectedEvent, notes: e.target.value })}
                ></textarea>
                <p className="text-[9px] text-slate-300 font-black uppercase mt-4 text-center">Data Saved Locally</p>
              </div>

              {/* Danger Zone */}
              <div className="p-8 bg-rose-50 rounded-[3rem] border border-rose-100">
                <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4">Project Controls</h4>
                <button 
                  onClick={() => { if (confirm('Permanently delete this project?')) onDeleteEvent(selectedEvent.id); }}
                  className="w-full py-3 bg-white text-rose-600 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition shadow-sm"
                >
                  Delete Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventPlanner;
