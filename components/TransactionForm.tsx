
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !desc) return;
    onAdd({
      amount: parseFloat(amount),
      category,
      description: desc,
      notes: notes.trim() || undefined,
      type,
      date,
      vendor: vendor.trim() || undefined,
      lineItems: lineItems.length > 0 ? lineItems : undefined
    });
    setAmount('');
    setDesc('');
    setNotes('');
    setVendor('');
    setLineItems([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`flex-1 py-2 rounded-lg font-medium transition ${type === 'expense' ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-600'}`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`flex-1 py-2 rounded-lg font-medium transition ${type === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600'}`}
        >
          Income
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor</label>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Merchant name"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="What was this for?"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          placeholder="Add extra details..."
          rows={2}
        />
      </div>

      {lineItems.length > 0 && (
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Line Items Found</label>
          <div className="space-y-1">
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs text-slate-600">
                <span className="truncate">{item.name}</span>
                <span className="font-mono text-slate-400">${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
        >
          Save
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;
