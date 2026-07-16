import './_group.css';
import { Mic, Type, Repeat, ChevronDown, ArrowRight, Copy, X, Volume2 } from 'lucide-react';

export function Brutalist() {
  return (
    <div className="phone-frame bg-white flex flex-col text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="pt-14 px-5 pb-3">
        <div className="border-b-[3px] border-black pb-2">
          <h1 className="text-[32px] font-black uppercase tracking-tighter">LingoSwap</h1>
        </div>
      </div>

      {/* Language bar */}
      <div className="px-4 py-3 flex items-center gap-2">
        <button className="flex-1 flex items-center justify-between px-3 py-3 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
          <span className="text-[15px] font-black">AUTO</span>
          <ChevronDown size={16} />
        </button>
        <Repeat size={20} className="font-black" />
        <button className="flex-1 flex items-center justify-between px-3 py-3 bg-[#FF2A00] text-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
          <span className="text-[15px] font-black">SPANISH</span>
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center py-2">
        <div className="flex border-[3px] border-black p-1 bg-white">
          <button className="flex items-center gap-2 px-5 py-2.5 border-r-[3px] border-black text-[15px] font-black">
            <Mic size={16} /> VOICE
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-black text-white text-[15px] font-black">
            <Type size={16} /> TYPE
          </button>
        </div>
      </div>

      {/* Input card */}
      <div className="mx-4 border-[3px] border-black bg-white shadow-[6px_6px_0px_0px_#000]">
        <textarea
          readOnly
          value="Hello, how are you today?"
          className="w-full h-[130px] p-4 text-[18px] bg-transparent resize-none outline-none font-black"
        />
        <div className="flex items-center justify-between px-4 py-3 border-t-[3px] border-black">
          <span className="text-[13px] font-black">27/5000</span>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-[#FF2A00] text-white border-[3px] border-black text-[15px] font-black shadow-[4px_4px_0px_0px_#000]">
            TRANSLATE <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Result card */}
      <div className="mx-4 mt-4 border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="font-black">ENGLISH</span>
            <ArrowRight size={14} className="text-[#FF2A00]" />
            <span className="font-black text-[#FF2A00]">SPANISH</span>
          </div>
          <div className="flex">
            <button className="p-1.5 border-[3px] border-black -mr-[3px]"><X size={18} /></button>
            <button className="p-1.5 border-[3px] border-black"><Copy size={18} /></button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <p className="flex-1 text-[15px] leading-snug font-bold">Hello, how are you today?</p>
          <button className="mt-0.5"><Volume2 size={18} /></button>
        </div>

        <div className="h-[3px] bg-black mb-3" />

        <div className="flex gap-2">
          <p className="flex-1 text-[24px] leading-tight font-black uppercase">Hola, ¿qué tal estás hoy?</p>
          <button className="mt-1"><Volume2 size={20} /></button>
        </div>
      </div>

      <div className="mt-auto pb-10 text-center">
        <p className="text-[14px] font-black uppercase">Tap to speak</p>
      </div>
    </div>
  );
}
