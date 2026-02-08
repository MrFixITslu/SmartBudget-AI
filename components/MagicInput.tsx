
import React, { useState, useRef } from 'react';
import { parseInputToTransaction, parseStatementToTransactions } from '../services/geminiService';
import { AIAnalysisResult } from '../types';

interface Props {
  onSuccess: (data: AIAnalysisResult) => void;
  onBulkSuccess: (data: AIAnalysisResult[]) => void;
  onLoading: (isLoading: boolean) => void;
  onManualEntry?: () => void;
}

const MagicInput: React.FC<Props> = ({ onSuccess, onBulkSuccess, onLoading, onManualEntry }) => {
  const [input, setInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleMagicSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    onLoading(true);
    const result = await parseInputToTransaction(input);
    if (result) {
      onSuccess(result);
      setInput('');
    }
    onLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const fileData = { data: base64, mimeType: file.type };

      if (file.type === 'application/pdf' || file.name.endsWith('.csv')) {
        const results = await parseStatementToTransactions(fileData);
        if (results.length > 0) onBulkSuccess(results);
      } else {
        const result = await parseInputToTransaction(fileData, true);
        if (result) onSuccess(result);
      }
      onLoading(false);
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          onLoading(true);
          const result = await parseInputToTransaction({ data: base64, mimeType: 'audio/webm' }, true);
          if (result) onSuccess(result);
          onLoading(false);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="relative group">
      <form onSubmit={handleMagicSubmit} className="flex items-center gap-2 p-1.5 bg-white border-2 border-slate-200 rounded-2xl focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition shadow-sm">
        <div className="flex-1 flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-transparent px-3 py-2 text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="Log coffee, or upload 1st National statement..."
          />
        </div>
        
        <div className="flex items-center gap-1 pr-1">
          {onManualEntry && (
            <button
              type="button"
              onClick={onManualEntry}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-indigo-50 text-indigo-500 transition"
              title="Manual Form Entry"
            >
              <i className="fas fa-edit"></i>
            </button>
          )}

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Voice Record"
          >
            <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition"
            title="Upload Receipt or Statement"
          >
            <i className="fas fa-file-import"></i>
          </button>

          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:bg-slate-400 shadow-md shadow-indigo-200"
          >
            <i className="fas fa-magic"></i>
          </button>
        </div>
      </form>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,application/pdf,.csv"
      />

      <div className="absolute -bottom-6 left-3 text-[10px] text-slate-400 flex gap-4 uppercase font-bold tracking-wider">
        <span>AI-Powered Parsing Hub</span>
        <i className="fas fa-check-circle text-indigo-400"></i>
      </div>
    </div>
  );
};

export default MagicInput;
