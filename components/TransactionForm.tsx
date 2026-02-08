
import React, { useState } from 'react';
import { CATEGORIES, Transaction, TransactionType, LineItem } from '../types';

interface Props {
  onAdd: (t: Omit<Transaction, 'id'>) => void;
  initialData?: Partial<Transaction>;
  onCancel?: () => void;
}

const TransactionForm: React.FC<Props> = ({ onAdd, initialData, onCancel }) => {
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [category, setCategory] = useState(initialData?.category || CATEGORIES[0]);
  const [desc, setDesc] = useState(initialData?.description || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [vendor, setVendor] = useState(initialData?.vendor || '');
  const [lineItems, setLineItems] = useState<LineItem[]>(initialData?.lineItems || []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }
    if (!desc.trim()) {
      newErrors.description = "Description is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    onAdd({
      amount: parseFloat(amount),
      category,
      description: desc.trim(),
      notes: notes.trim() || undefined,
      type,
      date,
      vendor: vendor.trim() || undefined,
      lineItems: lineItems.length > 0 ? lineItems : undefined
    });
    
    // Reset form
    setAmount('');
    setDesc('');
    setNotes('');
    setVendor('');
    setLineItems([]);
    setErrors({});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in duration-300">
      <div className="flex gap-3 mb-2">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${type === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
        >
          <i className="fas fa-arrow-down mr-2"></i> Expense
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${type === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
        >
          <i className="fas fa-arrow-up mr-2"></i> Income
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`w-full p-4 bg-slate-50 border ${errors.amount ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-800 text-lg`}
            placeholder="0.00"
            required
            aria-invalid={errors.amount ? "true" : "false"}
          />
          {errors.amount && <p className="text-[9px] font-bold text-rose-500 mt-1 ml-1">{errors.amount}</p>}
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 text-sm"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Merchant / Vendor</label>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 text-sm"
            placeholder="Store Name"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-700 text-sm appearance-none"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Description</label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className={`w-full p-4 bg-slate-50 border ${errors.description ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 text-sm`}
          placeholder="What was this for?"
          required
        />
        {errors.description && <p className="text-[9px] font-bold text-rose-500 mt-1 ml-1">{errors.description}</p>}
      </div>

      {lineItems.length > 0 && (
        <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-50">
          <label className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">Itemized Breakdown</label>
          <div className="space-y-2">
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div className="flex gap-2 items-center">
                  <span className="w-6 h-6 bg-white border border-indigo-100 rounded-lg flex items-center justify-center text-[9px] font-black text-indigo-600">
                    {item.quantity || 1}x
                  </span>
                  <span className="font-bold text-slate-700">{item.name}</span>
                </div>
                <span className="font-black text-slate-900">${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 transition active:scale-95"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 active:scale-95"
        >
          Confirm Entry
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;
