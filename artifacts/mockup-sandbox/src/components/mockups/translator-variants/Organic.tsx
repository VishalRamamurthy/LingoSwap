import './_group.css';
import { Mic, Type, Repeat, ChevronDown, ArrowRight, Copy, X, Volume2 } from 'lucide-react';

export function Organic() {
  return (
    <div className="phone-frame bg-[#F2F9F4] flex flex-col text-[#2D4A3E]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Soft blob background */}
      <div className="absolute top-[-80px] right-[-60px] w-[260px] h-[260px] rounded-full bg-[#C8E6D5] opacity-60 blur-3xl" />
      <div className="absolute bottom-[120px] left-[-80px] w-[240px] h-[240px] rounded-full bg-[#E8D5C4] opacity-50 blur-3xl" />

      {/* Header */}
      <div className="pt-14 px-5 pb-3 text-center">
        <h1 className="text-[27px] font-bold text-[#4A7C59]" style={{ fontFamily: 'DM Sans, sans-serif' }}>LingoSwap</h1>
      </div>

      {/* Language bar */}
      <div className="px-5 py-3 flex items-center gap-3">
        <button className="flex-1 flex items-center justify-between px-4 py-3 rounded-full bg-white/80 backdrop-blur border border-[#C8E6D5] shadow-sm">
          <span className="text-[15px] font-medium text-[#5A7D6B]">Auto-detect</span>
          <ChevronDown size={14} className="text-[#7FA88F]" />
        </button>
        <Repeat size={18} className="text-[#7FA88F]" />
        <button className="flex-1 flex items-center justify-between px-4 py-3 rounded-full bg-[#EAF6EE] border border-[#A8D5BA] shadow-sm">
          <span className="text-[15px] font-bold text-[#4A7C59]">Spanish</span>
          <ChevronDown size={14} className="text-[#7FA88F]" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center py-2">
        <div className="flex rounded-full bg-white/80 backdrop-blur p-1.5 shadow-sm border border-[#C8E6D5]">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[#7FA88F] text-[15px] font-semibold">
            <Mic size={16} /> Voice
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#4A7C59] text-white text-[15px] font-semibold shadow-sm">
            <Type size={16} /> Type
          </button>
        </div>
      </div>

      {/* Input card */}
      <div className="mx-5 rounded-[28px] bg-white/90 backdrop-blur border border-[#C8E6D5] overflow-hidden shadow-lg shadow-[#4A7C59]/10">
        <textarea
          readOnly
          value="Hello, how are you today?"
          className="w-full h-[130px] p-5 text-[18px] bg-transparent resize-none outline-none text-[#2D4A3E]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E0F0E6]">
          <span className="text-[13px] text-[#7FA88F]">27/5000</span>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#4A7C59] text-white text-[15px] font-bold shadow-md shadow-[#4A7C59]/25">
            Translate <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Result card */}
      <div className="mx-5 mt-4 rounded-[28px] bg-white/90 backdrop-blur border border-[#C8E6D5] p-5 shadow-lg shadow-[#4A7C59]/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[#7FA88F] font-medium">English</span>
            <ArrowRight size={12} className="text-[#4A7C59]" />
            <span className="text-[#4A7C59] font-bold">Spanish</span>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 text-[#7FA88F]"><X size={18} /></button>
            <button className="p-1.5 text-[#7FA88F]"><Copy size={18} /></button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <p className="flex-1 text-[15px] leading-snug text-[#7FA88F]">Hello, how are you today?</p>
          <button className="text-[#4A7C59] mt-0.5"><Volume2 size={18} /></button>
        </div>

        <div className="h-px bg-[#E0F0E6] mb-3" />

        <div className="flex gap-2">
          <p className="flex-1 text-[25px] leading-tight font-medium text-[#2D4A3E]">Hola, ¿qué tal estás hoy?</p>
          <button className="text-[#4A7C59] mt-1"><Volume2 size={20} /></button>
        </div>
      </div>

      <div className="mt-auto pb-10 text-center">
        <p className="text-[13px] text-[#7FA88F]">Tap to speak</p>
      </div>
    </div>
  );
}
