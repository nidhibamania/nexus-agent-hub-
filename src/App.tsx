import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import Markdown from 'react-markdown';
import { 
  Search, 
  Sparkles, 
  Code2, 
  Send, 
  User, 
  Bot, 
  Menu, 
  X, 
  ChevronRight,
  Loader2,
  Terminal,
  Zap
} from "lucide-react";
import { AGENTS, Agent, AgentId } from './types';

// Initialize Gemini (will be re-initialized in handleSendMessage to ensure fresh API key)
let ai: GoogleGenAI;

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [activeAgent, setActiveAgent] = useState<Agent>(AGENTS[0]);
  const [messages, setMessages] = useState<Record<AgentId, Message[]>>({
    researcher: [],
    creative: [],
    architect: []
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentMessages = messages[activeAgent.id];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, isLoading]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Check for either the standard key or our new custom key name
    const apiKey = process.env.NEXUS_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
      const errorMessage: Message = {
        role: 'model',
        content: "Error: API Key is missing. Please add a secret named 'NEXUS_API_KEY', paste your key string, and click 'Apply changes'.",
        timestamp: new Date()
      };
      setMessages(prev => ({
        ...prev,
        [activeAgent.id]: [...prev[activeAgent.id], errorMessage]
      }));
      return;
    }

    // Initialize AI with the current key
    ai = new GoogleGenAI({ apiKey });

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => ({
      ...prev,
      [activeAgent.id]: [...prev[activeAgent.id], userMessage]
    }));
    setInput('');
    setIsLoading(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: activeAgent.systemInstruction,
          // Removed googleSearch to support Free Tier API keys
          // tools: activeAgent.id === 'researcher' ? [{ googleSearch: {} }] : undefined,
        },
        history: currentMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))
      });

      const result = await chat.sendMessage({ message: input });
      const modelResponse = result.text || "I'm sorry, I couldn't generate a response.";

      const modelMessage: Message = {
        role: 'model',
        content: modelResponse,
        timestamp: new Date()
      };

      setMessages(prev => ({
        ...prev,
        [activeAgent.id]: [...prev[activeAgent.id], modelMessage]
      }));
    } catch (error: any) {
      console.error("Gemini Error:", error);
      const errorMessage: Message = {
        role: 'model',
        content: `Error: Failed to connect to the agent. ${error?.message || "Please check your connection."}`,
        timestamp: new Date()
      };
      setMessages(prev => ({
        ...prev,
        [activeAgent.id]: [...prev[activeAgent.id], errorMessage]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (iconName: string, className?: string) => {
    switch (iconName) {
      case 'Search': return <Search className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Code2': return <Code2 className={className} />;
      default: return <Bot className={className} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 300 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="border-r border-white/10 bg-[#0F0F0F] flex flex-col relative"
      >
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">NEXUS AI</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold px-2 mb-4">
            Specialized Agents
          </p>
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                activeAgent.id === agent.id 
                ? 'bg-white/10 text-white' 
                : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                activeAgent.id === agent.id ? 'bg-blue-600/20 text-blue-400' : 'bg-white/5 group-hover:bg-white/10'
              }`}>
                {getIcon(agent.icon, "w-5 h-5")}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">{agent.name}</div>
                <div className="text-[10px] opacity-50">{agent.role}</div>
              </div>
              {activeAgent.id === agent.id && (
                <motion.div layoutId="active-indicator">
                  <ChevronRight size={14} className="text-blue-500" />
                </motion.div>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold">
              U
            </div>
            <div>
              <div className="text-xs font-medium">User Account</div>
              <div className="text-[10px] text-white/40">Premium Access</div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-[#0A0A0A]">
        {/* Header */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0A0A0A]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-white/90">{activeAgent.name}</div>
              <div className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                Online
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-[10px] text-white/40 font-mono">
              <Terminal size={12} />
              <span>v2.5.0-stable</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
        >
          {currentMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-blue-500">
                {getIcon(activeAgent.icon, "w-10 h-10")}
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">I am {activeAgent.name}</h2>
                <p className="text-white/50 text-sm leading-relaxed">
                  {activeAgent.description} How can I assist you with your {activeAgent.role.toLowerCase()} needs today?
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 w-full">
                <button 
                  onClick={() => setInput("What are the latest trends in AI agents?")}
                  className="p-3 text-xs text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                >
                  "What are the latest trends in AI agents?"
                </button>
                <button 
                  onClick={() => setInput("Help me architect a scalable cloud solution.")}
                  className="p-3 text-xs text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                >
                  "Help me architect a scalable cloud solution."
                </button>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {currentMessages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-white/10'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : getIcon(activeAgent.icon, "w-4 h-4")}
                </div>
                <div className={`max-w-[80%] space-y-1 ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-none'
                  }`}>
                    <div className="markdown-body">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                  <div className={`text-[10px] text-white/30 px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Loader2 size={16} className="animate-spin text-blue-500" />
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none">
                <div className="flex gap-1">
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gradient-to-t from-[#0A0A0A] to-transparent">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Message ${activeAgent.name}...`}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl transition-all"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-center text-[10px] text-white/20 mt-4">
            Nexus AI can make mistakes. Verify important information. Powered by Gemini.
          </p>
        </div>
      </main>
    </div>
  );
}
