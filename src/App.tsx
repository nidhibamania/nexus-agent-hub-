import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
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
  Zap,
  Globe,
  LogOut,
  LogIn,
  Layout,
  CheckCircle,
  FileText
} from "lucide-react";
import { AGENTS, Agent, AgentId } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  getDocs
} from './firebase';

// Initialize Gemini (will be re-initialized in handleSendMessage to ensure fresh API key)
let ai: GoogleGenAI;

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  id?: string;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [activeAgent, setActiveAgent] = useState<Agent>(AGENTS[0]);
  const [messages, setMessages] = useState<Record<AgentId, Message[]>>({
    orchestrator: [],
    researcher: [],
    creative: [],
    architect: [],
    pulse: []
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentMessages = messages[activeAgent.id];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setMessages({
        orchestrator: [],
        researcher: [],
        creative: [],
        architect: [],
        pulse: []
      });
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages: Record<AgentId, Message[]> = {
        orchestrator: [],
        researcher: [],
        creative: [],
        architect: [],
        pulse: []
      };

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const msg: Message = {
          id: doc.id,
          role: data.role,
          content: data.content,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date()
        };
        if (allMessages[data.agentId as AgentId]) {
          allMessages[data.agentId as AgentId].push(msg);
        }
      });

      setMessages(allMessages);
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setNotes([]);
      return;
    }

    const tasksQ = query(collection(db, 'tasks'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
    const notesQ = query(collection(db, 'notes'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubTasks = onSnapshot(tasksQ, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubNotes = onSnapshot(notesQ, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTasks();
      unsubNotes();
    };
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, isLoading]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !user) return;

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

    const userMessageContent = input;
    setInput('');
    setIsLoading(true);

    try {
      // Save user message to Firestore
      await addDoc(collection(db, 'messages'), {
        role: 'user',
        content: userMessageContent,
        agentId: activeAgent.id,
        uid: user.uid,
        timestamp: serverTimestamp()
      });

      // Define Tools for Track 2 & 3: Real-world Data & Productivity
      const getWeatherTool: FunctionDeclaration = {
        name: "getWeather",
        description: "Get the current weather for a specific city.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING, description: "The name of the city to get weather for." }
          },
          required: ["city"]
        }
      };

      const createTaskTool: FunctionDeclaration = {
        name: "createTask",
        description: "Create a new productivity task or schedule item.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The title of the task." },
            dueDate: { type: Type.STRING, description: "Optional due date (ISO string)." }
          },
          required: ["title"]
        }
      };

      const saveNoteTool: FunctionDeclaration = {
        name: "saveNote",
        description: "Save a text note for the user.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: "The content of the note." }
          },
          required: ["content"]
        }
      };

      const listTasksTool: FunctionDeclaration = {
        name: "listTasks",
        description: "Retrieve all pending tasks for the user.",
        parameters: { type: Type.OBJECT, properties: {} }
      };

      const listNotesTool: FunctionDeclaration = {
        name: "listNotes",
        description: "Retrieve all saved notes for the user.",
        parameters: { type: Type.OBJECT, properties: {} }
      };

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: activeAgent.systemInstruction,
          tools: [
            ...(activeAgent.id === 'pulse' ? [{ functionDeclarations: [getWeatherTool] }] : []),
            ...(activeAgent.id === 'researcher' ? [{ googleSearch: {} }] : []),
            ...(activeAgent.id === 'orchestrator' ? [{ functionDeclarations: [createTaskTool, saveNoteTool, listTasksTool, listNotesTool] }] : [])
          ],
        },
        history: currentMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))
      });

      let result = await chat.sendMessage({ message: userMessageContent });
      
      // Handle Function Calls (Track 2 & 3: Real-world Data & Productivity)
      let functionCalls = result.functionCalls;
      if (functionCalls) {
        const toolResults = [];
        for (const call of functionCalls) {
          if (call.name === "getWeather") {
            const city = (call.args as any).city;
            try {
              // Fetch real-world data from Open-Meteo API
              const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
              const geoData = await geoResponse.json();
              
              if (geoData.results && geoData.results.length > 0) {
                const { latitude, longitude, name, country } = geoData.results[0];
                const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                const weatherData = await weatherResponse.json();
                
                toolResults.push({
                  name: call.name,
                  response: {
                    content: `The current weather in ${name}, ${country} is ${weatherData.current_weather.temperature}°C with a windspeed of ${weatherData.current_weather.windspeed} km/h.`,
                    id: call.id
                  }
                });
              } else {
                toolResults.push({
                  name: call.name,
                  response: { content: `Could not find weather data for ${city}.`, id: call.id }
                });
              }
            } catch (err) {
              toolResults.push({
                name: call.name,
                response: { content: "Error fetching weather data.", id: call.id }
              });
            }
          } else if (call.name === "createTask") {
            const { title, dueDate } = call.args as any;
            try {
              await addDoc(collection(db, 'tasks'), {
                uid: user.uid,
                title,
                status: 'pending',
                dueDate: dueDate || null,
                createdAt: serverTimestamp()
              });
              toolResults.push({
                name: call.name,
                response: { content: `Successfully created task: "${title}"`, id: call.id }
              });
            } catch (err) {
              toolResults.push({
                name: call.name,
                response: { content: "Failed to create task.", id: call.id }
              });
            }
          } else if (call.name === "saveNote") {
            const { content } = call.args as any;
            try {
              await addDoc(collection(db, 'notes'), {
                uid: user.uid,
                content,
                createdAt: serverTimestamp()
              });
              toolResults.push({
                name: call.name,
                response: { content: "Note saved successfully.", id: call.id }
              });
            } catch (err) {
              toolResults.push({
                name: call.name,
                response: { content: "Failed to save note.", id: call.id }
              });
            }
          } else if (call.name === "listTasks") {
            try {
              const q = query(collection(db, 'tasks'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
              const snapshot = await getDocs(q);
              const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              toolResults.push({
                name: call.name,
                response: { content: JSON.stringify(tasks), id: call.id }
              });
            } catch (err) {
              toolResults.push({
                name: call.name,
                response: { content: "Failed to retrieve tasks.", id: call.id }
              });
            }
          } else if (call.name === "listNotes") {
            try {
              const q = query(collection(db, 'notes'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
              const snapshot = await getDocs(q);
              const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              toolResults.push({
                name: call.name,
                response: { content: JSON.stringify(notes), id: call.id }
              });
            } catch (err) {
              toolResults.push({
                name: call.name,
                response: { content: "Failed to retrieve notes.", id: call.id }
              });
            }
          }
        }
        
        // Send tool results back to model to get final response
        result = await chat.sendMessage({
          message: toolResults.map(tr => ({
            functionResponse: { name: tr.name, response: tr.response }
          }))
        });
      }

      const modelResponse = result.text || "I'm sorry, I couldn't generate a response.";

      // Save model response to Firestore
      await addDoc(collection(db, 'messages'), {
        role: 'model',
        content: modelResponse,
        agentId: activeAgent.id,
        uid: user.uid,
        timestamp: serverTimestamp()
      });

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
      case 'Globe': return <Globe className={className} />;
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
          {user ? (
            <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} 
                  alt="User" 
                  className="w-10 h-10 rounded-full border border-white/10"
                  referrerPolicy="no-referrer"
                />
                <div className="overflow-hidden">
                  <div className="text-xs font-medium truncate">{user.displayName || user.email}</div>
                  <div className="text-[10px] text-white/40">Premium Access</div>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl flex items-center justify-center gap-3 font-medium transition-all"
            >
              <LogIn size={20} />
              <span>Login with Google</span>
            </button>
          )}
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
            <button 
              onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isWorkspaceOpen ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Layout size={14} />
              <span>Workspace</span>
            </button>
            <div className="hidden md:flex items-center gap-2 text-[10px] text-white/40 font-mono">
              <Terminal size={12} />
              <span>v2.5.0-stable</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 flex overflow-hidden">
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

          {/* Workspace Panel */}
          <motion.div
            initial={false}
            animate={{ width: isWorkspaceOpen ? 350 : 0, opacity: isWorkspaceOpen ? 1 : 0 }}
            className="border-l border-white/10 bg-[#0F0F0F] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">Workspace</h3>
              <button onClick={() => setIsWorkspaceOpen(false)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Tasks Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                  <CheckCircle size={14} />
                  <span>TASKS</span>
                  <span className="ml-auto bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px]">{tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <div className="text-[10px] text-white/20 italic p-4 border border-dashed border-white/5 rounded-lg text-center">
                      No tasks yet. Ask Nexus Core to create one!
                    </div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className="p-3 bg-white/5 rounded-lg border border-white/5 group hover:border-blue-500/30 transition-colors">
                        <div className="text-xs font-medium text-white/90 mb-1">{task.title}</div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] uppercase font-bold ${task.status === 'completed' ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {task.status}
                          </span>
                          {task.dueDate && (
                            <span className="text-[9px] text-white/30 font-mono">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Notes Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                  <FileText size={14} />
                  <span>NOTES</span>
                  <span className="ml-auto bg-purple-500/10 px-1.5 py-0.5 rounded text-[10px]">{notes.length}</span>
                </div>
                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <div className="text-[10px] text-white/20 italic p-4 border border-dashed border-white/5 rounded-lg text-center">
                      No notes saved.
                    </div>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="p-3 bg-white/5 rounded-lg border border-white/5 hover:border-purple-500/30 transition-colors">
                        <div className="text-[11px] text-white/70 leading-relaxed line-clamp-3">{note.content}</div>
                        <div className="mt-2 text-[8px] text-white/20 font-mono">
                          {note.createdAt?.toDate?.()?.toLocaleDateString() || new Date().toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gradient-to-t from-[#0A0A0A] to-transparent">
          {!user ? (
            <div className="max-w-4xl mx-auto p-8 bg-white/5 border border-white/10 rounded-3xl text-center space-y-4">
              <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-2xl flex items-center justify-center mx-auto">
                <Zap size={32} />
              </div>
              <h3 className="text-xl font-bold">Unlock the Power of Nexus AI</h3>
              <p className="text-white/50 text-sm max-w-md mx-auto">
                Login to save your chat history, access specialized agents, and experience persistent AI memory.
              </p>
              <button 
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-semibold transition-all inline-flex items-center gap-2"
              >
                <LogIn size={18} />
                Get Started
              </button>
            </div>
          ) : (
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
          )}
          <p className="text-center text-[10px] text-white/20 mt-4">
            Nexus AI can make mistakes. Verify important information. Powered by Gemini.
          </p>
        </div>
      </main>
    </div>
  );
}
