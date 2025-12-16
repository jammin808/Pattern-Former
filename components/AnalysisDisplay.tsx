import React from 'react';
import { Message, AnalysisMode } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { Bot, User, BrainCircuit, AlertTriangle, ShieldCheck } from 'lucide-react';

interface AnalysisDisplayProps {
  messages: Message[];
  isLoading: boolean;
  currentMode: AnalysisMode;
}

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ messages, isLoading, currentMode }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8" ref={scrollRef}>
      {messages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 select-none">
          <BrainCircuit size={64} className="mb-6 text-os-accent animate-pulse" />
          <h2 className="text-2xl font-bold font-mono tracking-widest mb-2">PATTERN-FORMER</h2>
          <p className="max-w-md text-sm text-os-secondary font-mono">
            High-integrity reasoning OS ready. <br/>
            Select a mode and initialize analysis.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-2 border border-os-border rounded">
                <span className="block text-os-accent mb-1">LIGHT</span>
                Direct answers
            </div>
            <div className="p-2 border border-os-border rounded">
                <span className="block text-os-warning mb-1">MEDIUM</span>
                Bounded analysis
            </div>
             <div className="p-2 border border-os-border rounded">
                <span className="block text-os-danger mb-1">HEAVY</span>
                Deep structure
            </div>
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <div 
          key={msg.id} 
          className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'model' && (
            <div className="w-8 h-8 rounded bg-os-panel border border-os-accent/30 flex items-center justify-center shrink-0 mt-1">
              <Bot size={16} className="text-os-accent" />
            </div>
          )}
          
          <div className={`max-w-4xl rounded-lg p-5 ${
            msg.role === 'user' 
              ? 'bg-os-panel border border-os-border text-gray-200' 
              : 'bg-black/20 border border-os-border/50 w-full'
          }`}>
             {msg.role === 'user' ? (
                <div className="font-sans text-sm">{msg.content}</div>
             ) : (
                <div className="animate-in fade-in duration-500">
                    <div className="flex items-center gap-2 mb-4 border-b border-os-border pb-2">
                         <span className="text-[10px] font-mono text-os-secondary uppercase tracking-widest">
                            Output Mode: <span className="text-os-accent">{msg.mode}</span>
                         </span>
                         <span className="text-[10px] font-mono text-os-secondary ml-auto">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                         </span>
                    </div>
                    <MarkdownRenderer content={msg.content} />
                </div>
             )}
          </div>

          {msg.role === 'user' && (
            <div className="w-8 h-8 rounded bg-os-panel border border-os-secondary/30 flex items-center justify-center shrink-0 mt-1">
              <User size={16} className="text-gray-400" />
            </div>
          )}
        </div>
      ))}

      {isLoading && (
         <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded bg-os-panel border border-os-accent/30 flex items-center justify-center shrink-0 mt-1">
              <Bot size={16} className="text-os-accent" />
            </div>
            <div className="bg-black/20 border border-os-border/50 rounded-lg p-5 w-full max-w-2xl flex flex-col gap-3">
               <div className="flex items-center gap-3 text-os-accent text-sm font-mono animate-pulse">
                  <BrainCircuit size={16} className="animate-spin" style={{animationDuration: '3s'}} />
                  <span>
                    {currentMode === AnalysisMode.HEAVY ? "RUNNING DEEP PATTERN MATCHING (32k CTX)..." : "ANALYZING STRUCTURE..."}
                  </span>
               </div>
               <div className="h-1 w-full bg-os-border rounded overflow-hidden">
                  <div className="h-full bg-os-accent/50 w-1/2 animate-[shimmer_2s_infinite]"></div>
               </div>
               <div className="space-y-2 mt-2">
                  <div className="h-2 w-3/4 bg-os-panel rounded animate-pulse"></div>
                  <div className="h-2 w-1/2 bg-os-panel rounded animate-pulse"></div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default AnalysisDisplay;
