import './_group.css';
import { Mic, Type, Repeat, ChevronDown, ArrowRight, Copy, X, Volume2 } from 'lucide-react';

export function Brutalist() {
  return (
    <div className="phone-frame bg-white flex flex-col text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="pt-14 px-5 pb-3">
        <div className="border-b-[3px] border-black pb-2">
          <h1 className="text-[28px] font-bold tracking-tight text-black">LingoSwap</h1>
        </div>
      </div>

      {/* Language bar */}
      <div className="px-4 py-3 flex items-center gap-2.5">
        <button className="flex-1 flex items-center justify-between px-3.5 py-3 bg-white rounded-xl border-[3px] border-black shadow-[3px_3px_0px_0px_#000]">
          <span className="text-[15px] font-semibold">Auto-detect</span>
          <ChevronDown size={16} />
        </button>
        <Repeat size={18} className="text-black" />
        <button className="flex-1 flex items-center justify-between px-3.5 py-3 rounded-xl bg-[#FF2A00] text-white border-[3px] border-black shadow-[3px_3px_0px_0px_#000]">
          <span className="text-[15px] font-bold">Spanish</span>
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center py-2">
        <div className="flex rounded-xl border-[3px] border-black p-1 bg-white">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[15px] font-semibold">
            <Mic size={16} /> Voice
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black text-white text-[15px] font-semibold">
            <Type size={16} /> Type
          </button>
        </div>
      </div>

      {/* Input card */}
      <div className="mx-4 rounded-2xl border-[3px] border-black bg-white shadow-[5px_5px_0px_0px_#000]">
        <textarea
          readOnly
          value="Hello, how are you today?"
          className="w-full h-[130px] p-4 text-[18px] bg-transparent resize-none outline-none font-normal"
          style={{ fontFamily: 'Inter, sans-serif' }}
        />
        <div className="flex items-center justify-between px-4 py-3 border-t-[3px] border-black">
          <span className="text-[13px] text-black/60">27/5000</span>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF2A00] text-white border-[3px] border-black text-[15px] font-semibold shadow-[3px_3px_0px_0px_#000]">
            Translate <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Result card */}
      <div className="mx-4 mt-4 rounded-2xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-black/70 font-medium">English</span>
            <ArrowRight size={14} className="text-[#FF2A00]" />
            <span className="text-[#FF2A00] font-semibold">Spanish</span>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 rounded-lg border-[3px] border-black"><X size={18} /></button>
            <button className="p-1.5 rounded-lg border-[3px] border-black"><Copy size={18} /></button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <p className="flex-1 text-[15px] leading-snug text-black/70">Hello, how are you today?</p>
          <button className="text-black mt-0.5"><Volume2 size={18} /></button>
        </div>

        <div className="h-[3px] bg-black mb-3 rounded-full" />

        <div className="flex gap-2">
          <p className="flex-1 text-[24px] leading-tight font-semibold text-black">Hola, ¿qué tal estás hoy?</p>
          <button className="text-black mt-1"><Volume2 size={20} /></button>
        </div>
      </div>

      <div className="mt-auto pb-10 text-center">
        <p className="text-[14px] text-black/60">Tap to speak</p>
      </div>
    </div>
  );
}
