import React, { useState, useEffect } from 'react';
import { AnalysisMode, Message } from './types';
import { generateAnalysis } from './services/geminiService';
import AnalysisDisplay from './components/AnalysisDisplay';
import { Send, Terminal, Shield, Zap, Layers, Activity } from 'lucide-react';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<AnalysisMode>(AnalysisMode.MEDIUM);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);

  useEffect(() => {
    // In a real deployed environment, process.env.API_KEY would be used via the build system.
    // However, per instructions, we must assume it is available or injected.
    // If process.env.API_KEY is available, we use it automatically.
    if (process.env.API_KEY) {
      setApiKey(process.env.API_KEY);
      setIsApiKeySet(true);
    }
  }, []);

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim().length > 0) {
      setIsApiKeySet(true);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || !apiKey) return;

    const userMsg: Message = {
      role: 'user',
      content: query,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setIsLoading(true);

    try {
      const responseText = await generateAnalysis({
        prompt: userMsg.content,
        mode: mode,
        apiKey: apiKey
      });

      const modelMsg: Message = {
        role: 'model',
        content: responseText || "System error: No response generated.",
        id: (Date.now() + 1).toString(),
        mode: mode,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      const errorMsg: Message = {
        role: 'model',
        content: `**SYSTEM ERROR**: Analysis failed. \n\n\`${error instanceof Error ? error.message : 'Unknown error'}\``,
        id: (Date.now() + 1).toString(),
        mode: mode,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isApiKeySet) {
    return (
      <div className="min-h-screen bg-os-bg text-gray-300 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-os-panel border border-os-border p-8 rounded-lg shadow-2xl">
           <div className="flex items-center justify-center mb-6 text-os-accent">
              <Terminal size={48} />
           </div>
           <h1 className="text-xl font-mono text-center mb-2 font-bold text-white">SYSTEM INITIALIZATION</h1>
           <p className="text-center text-sm mb-6 text-os-secondary">
             Enter Google GenAI API Key to initialize PATTERN-FORMER OS.
           </p>
           <form onSubmit={handleApiKeySubmit} className="space-y-4">
             <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-black/50 border border-os-border rounded p-3 text-sm focus:border-os-accent focus:outline-none font-mono"
             />
             <button 
                type="submit"
                disabled={!apiKey}
                className="w-full bg-os-accent/10 hover:bg-os-accent/20 text-os-accent border border-os-accent/50 py-2 rounded font-mono text-sm transition-colors uppercase"
             >
               Mount System
             </button>
             <p className="text-xs text-center text-gray-600 mt-4">
               Requires Gemini 3.0 Pro access for Deep Thinking capabilities.
             </p>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-os-bg text-gray-200 font-sans selection:bg-os-accent/30 selection:text-white">
      {/* Header */}
      <header className="h-14 border-b border-os-border bg-os-bg/95 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-os-accent" />
          <h1 className="font-mono font-bold tracking-widest text-sm">PATTERN-FORMER <span className="text-xs text-os-secondary font-normal ml-2">v3.0-thinking</span></h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-os-secondary">
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-os-success animate-pulse"></div>
              <span>ONLINE</span>
           </div>
        </div>
      </header>

      {/* Main Content */}
      <AnalysisDisplay messages={messages} isLoading={isLoading} currentMode={mode} />

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-os-bg border-t border-os-border shrink-0">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {/* Mode Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
             <button 
               onClick={() => setMode(AnalysisMode.LIGHT)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                 mode === AnalysisMode.LIGHT 
                 ? 'bg-os-success/10 border-os-success text-os-success shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                 : 'border-os-border text-os-secondary hover:border-os-secondary'
               }`}
             >
               <Zap size={12} />
               LIGHT
             </button>
             <button 
               onClick={() => setMode(AnalysisMode.MEDIUM)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                 mode === AnalysisMode.MEDIUM 
                 ? 'bg-os-warning/10 border-os-warning text-os-warning shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                 : 'border-os-border text-os-secondary hover:border-os-secondary'
               }`}
             >
               <Activity size={12} />
               MEDIUM
             </button>
             <button 
               onClick={() => setMode(AnalysisMode.HEAVY)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                 mode === AnalysisMode.HEAVY 
                 ? 'bg-os-accent/10 border-os-accent text-os-accent shadow-[0_0_10px_rgba(0,240,255,0.2)]' 
                 : 'border-os-border text-os-secondary hover:border-os-secondary'
               }`}
             >
               <Layers size={12} />
               HEAVY
             </button>
             <button 
               onClick={() => setMode(AnalysisMode.ADVERSARIAL)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                 mode === AnalysisMode.ADVERSARIAL
                 ? 'bg-os-danger/10 border-os-danger text-os-danger shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                 : 'border-os-border text-os-secondary hover:border-os-secondary'
               }`}
             >
               <Shield size={12} />
               ADVERSARIAL
             </button>
          </div>

          {/* Input Box */}
          <div className="relative group">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Input query for pattern analysis..."
              className="w-full bg-os-panel border border-os-border rounded-lg p-4 pr-12 min-h-[60px] max-h-[200px] resize-none focus:outline-none focus:border-os-accent/50 font-mono text-sm transition-all shadow-inner"
              rows={2}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading || !query.trim()}
              className="absolute right-3 bottom-3 p-2 rounded bg-os-accent text-os-bg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
          
          <div className="text-[10px] text-center text-os-secondary font-mono">
             PATTERN-FORMER OS v3.0 // CONFIDENCE BOUND REASONING
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
