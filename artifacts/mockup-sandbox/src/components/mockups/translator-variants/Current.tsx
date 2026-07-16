import './_group.css';
import { Mic, Edit2, Repeat, ChevronDown, ArrowRight, Copy, X, Volume2 } from 'lucide-react';

export function Current() {
  return (
    <div className="phone-frame bg-[#F8FAFC] flex flex-col text-slate-900">
      {/* Header */}
      <div className="pt-14 px-5 pb-3 flex justify-center">
        <h1 className="text-[26px] font-bold tracking-tight text-blue-600" style={{ fontFamily: 'Inter, sans-serif' }}>LingoSwap</h1>
      </div>

      {/* Language bar */}
      <div className="px-4 py-2.5 flex items-center gap-2.5 border-b border-slate-200 bg-white">
        <button className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[15px] font-medium text-slate-700">Auto-detect</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
        <Repeat size={18} className="text-blue-500" />
        <button className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-50/50 border border-blue-200">
          <span className="text-[15px] font-semibold text-blue-600">Spanish</span>
          <ChevronDown size={14} className="text-blue-400" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center py-3">
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button className="flex items-center gap-2 px-5 py-2 rounded-lg text-slate-500 text-[15px] font-semibold">
            <Mic size={16} /> Voice
          </button>
          <button className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-[15px] font-semibold shadow-sm">
            <Edit2 size={16} /> Type
          </button>
        </div>
      </div>

      {/* Text input card */}
      <div className="mx-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <textarea
          readOnly
          value="Hello, how are you today?"
          className="w-full h-[130px] p-4 text-[18px] text-slate-800 bg-transparent resize-none outline-none"
          style={{ fontFamily: 'Inter, sans-serif' }}
        />
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200">
          <span className="text-[13px] text-slate-400">27/5000</span>
          <button className="flex items-center gap-2 px-5 py-2 rounded-full bg-blue-600 text-white text-[15px] font-semibold">
            Translate <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Result card */}
      <div className="mx-4 mt-4 rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-slate-500 font-medium">English</span>
            <ArrowRight size={12} className="text-blue-500" />
            <span className="text-blue-600 font-semibold">Spanish</span>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 text-slate-400"><X size={18} /></button>
            <button className="p-1.5 text-slate-400"><Copy size={18} /></button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <p className="flex-1 text-[15px] leading-snug text-slate-500">Hello, how are you today?</p>
          <button className="text-slate-400 mt-0.5"><Volume2 size={18} /></button>
        </div>

        <div className="h-px bg-slate-200 mb-3" />

        <div className="flex gap-2">
          <p className="flex-1 text-[26px] leading-tight font-medium text-slate-900">Hola, ¿qué tal estás hoy?</p>
          <button className="text-slate-400 mt-1"><Volume2 size={20} /></button>
        </div>
      </div>

      {/* Bottom mic hint */}
      <div className="mt-auto pb-10 text-center">
        <p className="text-[14px] text-slate-400">Tap to speak in any language</p>
      </div>
    </div>
  );
}
