import './_group.css';
import { Mic, Edit3, Repeat, ChevronDown, ArrowRight, Copy, X, Volume2 } from 'lucide-react';

export function Retro() {
  return (
    <div className="phone-frame bg-[#0D0221] flex flex-col text-[#FF00FF]" style={{ fontFamily: 'Space Mono, monospace' }}>
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)'
      }} />

      {/* Header */}
      <div className="pt-14 px-5 pb-3 text-center">
        <h1 className="text-[28px] font-bold tracking-widest text-[#00FFFF] uppercase" style={{ textShadow: '0 0 10px #00FFFF' }}>
          LingoSwap
        </h1>
      </div>

      {/* Language bar */}
      <div className="px-4 py-2.5 flex items-center gap-2.5">
        <button className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-none bg-[#1A0B2E] border-2 border-[#00FFFF]">
          <span className="text-[14px] font-bold text-[#00FFFF]">AUTO</span>
          <ChevronDown size={14} className="text-[#FF00FF]" />
        </button>
        <Repeat size={18} className="text-[#FFFF00]" />
        <button className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-none bg-[#1A0B2E] border-2 border-[#FF00FF]">
          <span className="text-[14px] font-bold text-[#FF00FF]">ES</span>
          <ChevronDown size={14} className="text-[#FF00FF]" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center py-3">
        <div className="flex bg-[#1A0B2E] p-1 border-2 border-[#00FFFF]">
          <button className="flex items-center gap-2 px-5 py-2 text-[#00FFFF] text-[14px] font-bold">
            <Mic size={16} /> VOICE
          </button>
          <button className="flex items-center gap-2 px-5 py-2 bg-[#FF00FF] text-[#0D0221] text-[14px] font-bold" style={{ textShadow: '0 0 8px #FF00FF' }}>
            <Edit3 size={16} /> TYPE
          </button>
        </div>
      </div>

      {/* Input card */}
      <div className="mx-4 rounded-none border-2 border-[#00FFFF] bg-[#1A0B2E] overflow-hidden shadow-[0_0_15px_rgba(0,255,255,0.3)]">
        <textarea
          readOnly
          value="Hello, how are you today?"
          className="w-full h-[130px] p-4 text-[17px] bg-transparent resize-none outline-none text-[#00FFFF]"
          style={{ fontFamily: 'Space Mono, monospace' }}
        />
        <div className="flex items-center justify-between px-4 py-2.5 border-t-2 border-[#00FFFF]">
          <span className="text-[12px] text-[#FFFF00]">27/5000</span>
          <button className="flex items-center gap-2 px-5 py-2 border-2 border-[#FFFF00] bg-[#FFFF00] text-[#0D0221] text-[14px] font-bold">
            TRANSLATE <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Result card */}
      <div className="mx-4 mt-4 rounded-none border-2 border-[#FF00FF] bg-[#1A0B2E] p-5 shadow-[0_0_15px_rgba(255,0,255,0.3)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[#00FFFF] font-bold">EN</span>
            <ArrowRight size={12} className="text-[#FFFF00]" />
            <span className="text-[#FF00FF] font-bold">ES</span>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 text-[#FF00FF]"><X size={18} /></button>
            <button className="p-1.5 text-[#FF00FF]"><Copy size={18} /></button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <p className="flex-1 text-[14px] leading-snug text-[#00FFFF]">Hello, how are you today?</p>
          <button className="text-[#FF00FF] mt-0.5"><Volume2 size={18} /></button>
        </div>

        <div className="h-px bg-[#FF00FF] mb-3" />

        <div className="flex gap-2">
          <p className="flex-1 text-[22px] leading-tight font-bold text-[#FFFF00]" style={{ textShadow: '0 0 8px #FFFF00' }}>
            Hola, ¿qué tal estás hoy?
          </p>
          <button className="text-[#FF00FF] mt-1"><Volume2 size={20} /></button>
        </div>
      </div>

      <div className="mt-auto pb-10 text-center">
        <p className="text-[12px] text-[#00FFFF] animate-pulse">TAP TO SPEAK</p>
      </div>
    </div>
  );
}
