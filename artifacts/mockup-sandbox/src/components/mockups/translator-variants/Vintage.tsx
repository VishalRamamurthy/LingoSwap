import './_group.css';
import { Mic, Type, Repeat, ChevronDown, ArrowRight, Copy, X, Volume2 } from 'lucide-react';

export function Vintage() {
  return (
    <div className="phone-frame bg-[#F5E6D3] flex flex-col text-[#3E2C1C]" style={{ fontFamily: 'Playfair Display, serif' }}>
      {/* Ornate header */}
      <div className="pt-14 px-5 pb-2 text-center">
        <div className="text-[11px] uppercase tracking-[0.25em] text-[#A67B5B] mb-1">Language Companion</div>
        <h1 className="text-[28px] font-bold text-[#5D3A1A]" style={{ fontFamily: 'Playfair Display, serif' }}>LingoSwap</h1>
        <div className="w-16 h-0.5 bg-[#A67B5B] mx-auto mt-2" />
      </div>

      {/* Language bar */}
      <div className="px-5 py-3 flex items-center gap-3">
        <button className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg border-2 border-[#C8A882] bg-[#FFF8F0] shadow-sm">
          <span className="text-[15px] font-semibold">Auto-detect</span>
          <ChevronDown size={14} className="text-[#A67B5B]" />
        </button>
        <Repeat size={18} className="text-[#8B5E3C]" />
        <button className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg border-2 border-[#8B5E3C] bg-[#FFF8F0] shadow-sm">
          <span className="text-[15px] font-bold text-[#8B5E3C]">Spanish</span>
          <ChevronDown size={14} className="text-[#8B5E3C]" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center py-2">
        <div className="flex rounded-full border-2 border-[#C8A882] bg-[#FFF8F0] p-1">
          <button className="flex items-center gap-2 px-5 py-2 rounded-full text-[#A67B5B] text-[15px] font-semibold">
            <Mic size={16} /> Voice
          </button>
          <button className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#8B5E3C] text-[#FFF8F0] text-[15px] font-bold shadow-sm">
            <Type size={16} /> Type
          </button>
        </div>
      </div>

      {/* Input card */}
      <div className="mx-5 rounded-xl border-2 border-[#C8A882] bg-[#FFF8F0] overflow-hidden shadow-md">
        <textarea
          readOnly
          value="Hello, how are you today?"
          className="w-full h-[130px] p-4 text-[18px] bg-transparent resize-none outline-none text-[#3E2C1C]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        />
        <div className="flex items-center justify-between px-4 py-2.5 border-t-2 border-[#C8A882]">
          <span className="text-[13px] italic text-[#A67B5B]">27/5000</span>
          <button className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#8B5E3C] text-[#FFF8F0] text-[15px] font-bold border-2 border-[#5D3A1A]">
            Translate <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Result card */}
      <div className="mx-5 mt-4 rounded-xl border-2 border-[#C8A882] bg-[#FFF8F0] p-5 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[#A67B5B] font-semibold">English</span>
            <ArrowRight size={12} className="text-[#8B5E3C]" />
            <span className="text-[#8B5E3C] font-bold">Spanish</span>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 text-[#A67B5B]"><X size={18} /></button>
            <button className="p-1.5 text-[#A67B5B]"><Copy size={18} /></button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <p className="flex-1 text-[15px] leading-snug italic text-[#A67B5B]">Hello, how are you today?</p>
          <button className="text-[#8B5E3C] mt-0.5"><Volume2 size={18} /></button>
        </div>

        <div className="h-px bg-[#C8A882] mb-3" />

        <div className="flex gap-2">
          <p className="flex-1 text-[24px] leading-tight font-bold text-[#5D3A1A]">Hola, ¿qué tal estás hoy?</p>
          <button className="text-[#8B5E3C] mt-1"><Volume2 size={20} /></button>
        </div>
      </div>

      <div className="mt-auto pb-10 text-center">
        <p className="text-[13px] italic text-[#A67B5B]">Speak in any language</p>
      </div>
    </div>
  );
}
