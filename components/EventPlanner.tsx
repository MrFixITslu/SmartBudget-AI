
import React, { useState, useMemo } from 'react';
import { BudgetEvent, EventItem } from '../types';

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

  const selectedEvent = useMemo(() => 
    events.find(e => e.id === selectedEventId), 
    [events, selectedEventId]
  );

  const calculatePnL = (event: BudgetEvent) => {
    const income = event.items.filter(i => i.type === 'income').reduce((acc, i) => acc + i.amount, 0);
    const expenses = event.items.filter(i => i.type === 'expense').reduce((acc, i) => acc + i.amount, 0);
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
      notes: formData.get('notes') as string
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
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest text-xs">Event Planner</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Manage project-specific P&L</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-slate-800 transition"
        >
          {showAddForm ? 'Close' : 'Create Event'}
        </button>
      </div>

      {showAddForm && (
        <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm animate-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Event Name</label>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                placeholder="e.g. Annual Wedding Gala" 
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Event Date</label>
              <input 
                type="date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)} 
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" 
              />
            </div>
          </div>
          <button 
            onClick={() => { onAddEvent({ name: newName, date: newDate, status: 'planned' }); setNewName(''); setShowAddForm(false); }}
            className="w-full mt-4 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-[10px]"
          >
            Launch Project
          </button>
        </div>
      )}

      {!selectedEventId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => {
            const stats = calculatePnL(event);
            return (
              <div 
                key={event.id} 
                onClick={() => setSelectedEventId(event.id)}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm cursor-pointer hover:shadow-xl transition-all group relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-2 h-full ${stats.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm truncate pr-4">{event.name}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{event.date}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }}
                    className="text-slate-200 hover:text-rose-500 transition"
                  >
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
                
                <div className="space-y-3 mt-6">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                    <span>Current Status</span>
                    <span className="text-slate-800">{event.status}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400">Net Flow</span>
                    <span className={`text-sm font-black ${stats.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stats.net >= 0 ? '+' : '-'}${Math.abs(stats.net).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[2.5rem]">
              <i className="fas fa-calendar-alt text-4xl text-slate-100 mb-4"></i>
              <p className="text-slate-300 font-black uppercase text-xs tracking-[0.2em]">No Events Planned Yet</p>
            </div>
          )}
        </div>
      ) : selectedEvent && (
        <div className="animate-in fade-in duration-300">
          <button 
            onClick={() => setSelectedEventId(null)}
            className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-6"
          >
            <i className="fas fa-arrow-left"></i> Back to All Events
          </button>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white mb-6 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-5">
               <i className="fas fa-chart-line text-[120px]"></i>
             </div>
             <div className="relative z-10">
               <h2 className="text-2xl font-black mb-1">{selectedEvent.name}</h2>
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{selectedEvent.date}</p>
               
               <div className="grid grid-cols-3 gap-4 mt-8">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                   <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Income</p>
                   <p className="text-lg font-black text-emerald-400">${calculatePnL(selectedEvent).income.toLocaleString()}</p>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                   <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Expenses</p>
                   <p className="text-lg font-black text-rose-400">${calculatePnL(selectedEvent).expenses.toLocaleString()}</p>
                 </div>
                 <div className="p-4 bg-white/10 rounded-2xl border border-white/20">
                   <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Net P&L</p>
                   <p className="text-lg font-black">${calculatePnL(selectedEvent).net.toLocaleString()}</p>
                 </div>
               </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-6">Financial Items</h3>
                <div className="space-y-4">
                  {selectedEvent.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-slate-200 transition">
                      <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${item.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                          <i className={`fas ${item.type === 'income' ? 'fa-plus' : 'fa-minus'} text-xs`}></i>
                        </div>
                        <div>
                          <p className="font-black text-xs text-slate-800">{item.description}</p>
                          {item.notes && <p className="text-[9px] text-slate-400 font-medium">{item.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-black text-xs ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
                        </span>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-slate-200 hover:text-rose-500"><i className="fas fa-times text-xs"></i></button>
                      </div>
                    </div>
                  ))}
                  {selectedEvent.items.length === 0 && (
                    <p className="text-center py-10 text-slate-300 font-bold uppercase text-[9px] tracking-widest">No Items Added</p>
                  )}
                </div>
              </section>

              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-4">Event Notes</h3>
                <textarea 
                  className="w-full h-32 p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 font-medium"
                  placeholder="Logistical details, vendor contact info..."
                  value={selectedEvent.notes || ''}
                  onChange={(e) => onUpdateEvent({ ...selectedEvent, notes: e.target.value })}
                ></textarea>
              </section>
            </div>

            <div className="space-y-6">
              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] mb-6">Add New Entry</h3>
                <form onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                    <select name="type" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs font-bold">
                      <option value="expense">Expense (-)</option>
                      <option value="income">Income (+)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <input name="description" required placeholder="Vendor, ticket sale..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs font-bold" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                    <input name="amount" type="number" step="0.01" required placeholder="0.00" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs font-bold" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes (Optional)</label>
                    <input name="notes" placeholder="Additional info" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs font-bold" />
                  </div>
                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-[9px]">
                    Add Entry
                  </button>
                </form>
              </section>
              
              <div className="p-8 bg-slate-100 rounded-[2.5rem]">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Project Controls</h4>
                <div className="space-y-3">
                  <button 
                    onClick={() => onUpdateEvent({ ...selectedEvent, status: 'completed' })}
                    className="w-full py-3 bg-white text-slate-800 font-black rounded-xl border border-slate-200 text-[10px] uppercase tracking-widest hover:bg-slate-50"
                  >
                    Mark as Completed
                  </button>
                  <button 
                    onClick={() => onDeleteEvent(selectedEvent.id)}
                    className="w-full py-3 bg-rose-50 text-rose-600 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-rose-100"
                  >
                    Delete Project
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventPlanner;
