import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "hatch" | "cta" | "system";
  content: string | JSX.Element;
  uspId?: string;
}

type AppState = "greeting" | "awaiting_name" | "processing_name" | "awaiting_preset" | "processing_preset" | "explaining" | "awaiting_next" | "ready";

// The 8-Panel Persona/Empathetic USPs
const USPS = [
  { id: 'spawn', title: 'Stop Recruiting.', subtext: 'Your fully staffed digital product team is provisioned in milliseconds, ready to execute.', color: 'fuchsia', isLeft: true },
  { id: 'roles', title: 'Masters of Their Craft.', subtext: "Your AI PM argues for user-value. Your AI Designer obsesses over pixels. Real personalities. Real expertise.", color: 'emerald', isLeft: true },
  { id: 'sync', title: 'Zero Communication Breakdown.', subtext: 'Brief the system once. Every agent instantly aligns with your brand, past decisions, and future goals.', color: 'indigo', isLeft: true },
  { id: 'auto', title: 'An Engine That Runs Itself.', subtext: "Wake up to completed milestones as your agents collaborate seamlessly in the background.", color: 'blue', isLeft: true },
  
  { id: 'patience', title: 'Absolute Creative Freedom.', subtext: "Demand infinite revisions without the guilt, pushback, or hourly billing.", color: 'amber', isLeft: false },
  { id: 'velocity', title: 'Unfair Market Velocity.', subtext: 'Ship products before your competitors even finish scheduling their kickoff meetings.', color: 'orange', isLeft: false },
  { id: 'costs', title: 'Extend Your Runway.', subtext: 'Bootstrap massive projects without sacrificing quality, burning cash, or giving away equity.', color: 'green', isLeft: false },
  { id: 'alone', title: 'The Ultimate Co-Founders.', subtext: 'A world-class startup studio backing your every move, 24/7.', color: 'rose', isLeft: false }
];

// Muted "Real-App" visual components
// The `isAnimating` prop dictates whether the infinite looping animations should be running.
const PREVIEWS: Record<string, (isActive: boolean, isAnimating: boolean) => JSX.Element> = {
  spawn: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col gap-2 font-mono text-[9px] text-slate-500 w-full overflow-hidden opacity-80">
      <div className="text-fuchsia-400/80 mb-1">{'>'} provisioning_team --force</div>
      <motion.div initial={{ opacity: 1, x: 0 }} animate={{ opacity: isActive ? 1 : 0.5, x: isActive ? 0 : -5 }} transition={{ repeat: isAnimating ? Infinity : 0, repeatType: "reverse", duration: isAnimating ? 1.5 : 0.2, delay: 0 }} className="flex items-center gap-2"><span className="text-emerald-400">✔</span> PM_Agent_Active</motion.div>
      <motion.div initial={{ opacity: 1, x: 0 }} animate={{ opacity: isActive ? 1 : 0.5, x: isActive ? 0 : -5 }} transition={{ repeat: isAnimating ? Infinity : 0, repeatType: "reverse", duration: isAnimating ? 1.5 : 0.2, delay: 0.2 }} className="flex items-center gap-2"><span className="text-emerald-400">✔</span> UX_Agent_Active</motion.div>
      <motion.div initial={{ opacity: 1, x: 0 }} animate={{ opacity: isActive ? 1 : 0.5, x: isActive ? 0 : -5 }} transition={{ repeat: isAnimating ? Infinity : 0, repeatType: "reverse", duration: isAnimating ? 1.5 : 0.2, delay: 0.4 }} className="flex items-center gap-2"><span className="text-emerald-400">✔</span> Eng_Agent_Active</motion.div>
      <div className="w-full bg-slate-800 h-1 mt-1 overflow-hidden">
        <motion.div 
           className="h-full bg-fuchsia-500"
           initial={{ width: isActive ? "0%" : "30%" }}
           animate={{ width: isAnimating ? ["0%", "100%", "0%"] : "30%" }}
           transition={{ duration: isAnimating ? 2 : 0.2, repeat: isAnimating ? Infinity : 0 }}
        />
      </div>
    </div>
  ),
  roles: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col gap-2 relative w-full opacity-80">
       {['Product Manager', 'UX Designer', 'Lead Engineer'].map((role, i) => (
        <motion.div 
           key={i} 
           className="flex items-center gap-2 bg-slate-800/40 p-1.5 rounded border border-slate-700/50"
           animate={{ borderColor: isAnimating ? ['rgba(51,65,85,0.5)', 'rgba(52,211,153,0.3)', 'rgba(51,65,85,0.5)'] : 'rgba(51,65,85,0.3)' }}
           transition={{ duration: isAnimating ? 2 : 0, delay: i * 0.3, repeat: isAnimating ? Infinity : 0 }}
        >
          <div className="w-5 h-5 rounded-full bg-slate-700/80 flex items-center justify-center text-[8px] text-emerald-400 font-bold border border-emerald-500/20">{role[0]}</div>
          <div className="flex-1">
            <div className="text-[9px] text-slate-200 font-medium">{role}</div>
            <div className="text-[7px] text-slate-400 uppercase tracking-widest">{['Strategic', 'Creative', 'Logical'][i]}</div>
          </div>
        </motion.div>
      ))}
    </div>
  ),
  sync: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex gap-2 items-center justify-center h-full w-full opacity-80">
       <div className="w-8 h-8 rounded bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center relative shadow-[0_0_15px_rgba(99,102,241,0.2)]">
         <motion.div animate={{ rotate: isAnimating ? 360 : 0 }} transition={{ duration: isAnimating ? 10 : 0, ease: "linear", repeat: isAnimating ? Infinity : 0 }} className="absolute inset-0 rounded border-t-2 border-indigo-400" />
         <div className="absolute w-[2px] h-6 bg-indigo-500/50 -right-4 top-1/2 -translate-y-1/2 rotate-90" />
       </div>
       <div className="flex flex-col gap-1.5 ml-2">
         {[0, 1, 2].map(i => (
           <motion.div 
             key={i} 
             className="w-4 h-4 rounded-full bg-slate-800 relative border border-slate-700 flex items-center justify-center"
             animate={{ backgroundColor: isAnimating ? ['#1e293b', '#4f46e5', '#1e293b'] : '#1e293b' }}
             transition={{ duration: isAnimating ? 1.5 : 0, delay: i * 0.4, repeat: isAnimating ? Infinity : 0 }}
           >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 opacity-50" />
           </motion.div>
         ))}
       </div>
    </div>
  ),
  auto: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex gap-1.5 h-full w-full opacity-80">
      {['TODO', 'WIP', 'DONE'].map((col, i) => (
        <div key={i} className="flex-1 border border-slate-800/50 rounded bg-slate-900/50 p-1.5 flex flex-col gap-1.5 relative overflow-hidden">
          <div className="text-[7px] font-bold text-slate-400">{col}</div>
          
          <AnimatePresence>
             {i === 0 && (
                <motion.div 
                   className="h-4 w-full bg-slate-800 rounded absolute top-6"
                   animate={{ y: isAnimating ? [0, 20, 0] : 0, opacity: isAnimating ? [1, 0, 1] : 1 }}
                   transition={{ duration: isAnimating ? 3 : 0, repeat: isAnimating ? Infinity : 0 }}
                />
             )}
          </AnimatePresence>
          <AnimatePresence>
             {i === 1 && (
                <motion.div 
                   className="h-4 w-full bg-blue-500/20 border border-blue-500/40 rounded inline-flex items-center px-1 absolute top-6 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                   animate={{ x: isAnimating ? [-10, 0, -10] : 0 }}
                   transition={{ duration: isAnimating ? 2 : 0, ease: "easeInOut", repeat: isAnimating ? Infinity : 0 }}
                >
                   <motion.div className="w-1.5 h-1.5 rounded-full bg-blue-400" animate={{ scale: isAnimating ? [1, 1.5, 1] : 1 }} transition={{ duration: isAnimating ? 1 : 0, repeat: isAnimating ? Infinity : 0 }}/>
                </motion.div>
             )}
          </AnimatePresence>
          <AnimatePresence>
             {i === 2 && (
                <motion.div 
                   className="h-4 w-full bg-emerald-500/20 border border-emerald-500/30 rounded absolute top-6 flex items-center justify-center"
                   initial={{ opacity: 0.5 }}
                   animate={{ opacity: isAnimating ? [0, 1, 0] : 0.5 }}
                   transition={{ duration: isAnimating ? 3 : 0, repeat: isAnimating ? Infinity : 0, delay: 1 }}
                >
                  <span className="text-[8px] text-emerald-400">✓</span>
                </motion.div>
             )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  ),
  patience: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col font-mono text-[8px] text-slate-400 h-full w-full bg-slate-900/60 rounded border border-slate-800/80 overflow-hidden shadow-inner opacity-80">
      <div className="flex gap-1.5 border-b border-slate-800/80 p-1.5 bg-[#080a0f]">
        <div className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
      </div>
      <div className="p-2 flex flex-col gap-0.5 relative">
        <div className="text-amber-400">.hero {'{'}</div>
        <div className="pl-2">flex-dir: row;</div>
        
        <div className="relative h-3">
           <motion.div className="absolute pl-2 text-rose-400 line-through" animate={{ opacity: isAnimating ? [1, 0, 1] : 1 }} transition={{ duration: isAnimating ? 4 : 0, repeat: isAnimating ? Infinity : 0 }}>bg: black;</motion.div>
           <motion.div className="absolute pl-2 text-emerald-400 border-l border-emerald-500/50 pl-1" animate={{ opacity: isAnimating ? [0, 1, 0] : 0 }} transition={{ duration: isAnimating ? 4 : 0, repeat: isAnimating ? Infinity : 0 }}>bg: white; <span className="text-slate-500 ml-1">/* rev 24 */</span></motion.div>
        </div>

        <div>{'}'}</div>
      </div>
    </div>
  ),
  velocity: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col gap-2 relative h-full w-full justify-center opacity-80">
      <div className="text-[10px] text-slate-300 w-full flex justify-between items-center">
        <span>Sprint Velocity</span>
        <motion.span className="text-orange-400 font-mono" animate={{ opacity: isAnimating ? [1, 0.5, 1] : 1 }} transition={{ duration: isAnimating ? 0.5 : 0, repeat: isAnimating ? Infinity : 0 }}>98%</motion.span>
      </div>
      <div className="flex items-end gap-1 h-8">
        {[20, 35, 45, 80, 95].map((h, i) => (
          <motion.div 
             key={i} 
             className={`w-full bg-orange-500/30 border-t border-orange-500/50 rounded-t ${i === 4 ? 'bg-orange-500/60 shadow-[0_0_10px_rgba(249,115,22,0.4)]' : ''}`} 
             initial={{ height: `${h}%` }}
             animate={{ height: isAnimating ? [`${h}%`, `${h*0.8}%`, `${h}%`] : `${h}%` }}
             transition={{ duration: isAnimating ? 2 : 0, delay: i * 0.1, repeat: isAnimating ? Infinity : 0 }}
          />
        ))}
      </div>
    </div>
  ),
  costs: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col justify-center h-full font-mono text-[9px] gap-3 w-full opacity-80">
      <div className="flex justify-between items-center text-slate-400 border-b border-rose-500/30 pb-1.5">
        <span className="opacity-70">AGENCY</span>
        <span className="text-rose-400 font-bold">$85,000</span>
      </div>
      <motion.div 
         className="flex justify-between items-center text-white border-b border-green-500/50 pb-1.5 relative overflow-hidden"
         animate={{ scale: isAnimating ? [1, 1.02, 1] : 1 }}
         transition={{ duration: isAnimating ? 2 : 0, repeat: isAnimating ? Infinity : 0, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 bg-green-500/10 blur-xl" />
        <span className="font-bold tracking-widest text-[10px] text-green-100 z-10">HATCHIN</span>
        <span className="text-green-400 font-extrabold z-10">$35 / MO</span>
      </motion.div>
    </div>
  ),
  alone: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col items-center justify-center h-full w-full opacity-80">
       <div className="w-14 h-14 rounded-full border border-rose-500/40 flex items-center justify-center relative shadow-[0_0_30px_rgba(225,29,72,0.2)]">
          <motion.div 
             className="w-full h-full rounded-full border border-rose-500/30 absolute"
             animate={{ scale: isAnimating ? [1, 1.5] : 1, opacity: isAnimating ? [0.8, 0] : 0.5 }}
             transition={{ duration: isAnimating ? 1.5 : 0, repeat: isAnimating ? Infinity : 0, ease: "easeOut" }}
          />
          <div className="w-10 h-10 rounded-full border bg-rose-950/50 border-rose-500/60 flex items-center justify-center">
            <motion.div 
               className="w-3 h-3 rounded-full bg-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.8)]" 
               animate={{ scale: isAnimating ? [1, 1.2, 1] : 1 }}
               transition={{ duration: isAnimating ? 0.8 : 0, repeat: isAnimating ? Infinity : 0, ease: "easeInOut" }}
            />
          </div>
       </div>
    </div>
  )
};

// Typewriter component for AI messages
// Typewriter component for AI messages
const TypewriterMessage = ({ content, onComplete, onType }: { content: string, onComplete?: () => void, onType?: () => void }) => {
  const [displayedContent, setDisplayedContent] = useState("");
  const contentRef = useRef(content);
  const onCompleteRef = useRef(onComplete);
  const onTypeRef = useRef(onType);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTypeRef.current = onType;
  }, [onComplete, onType]);

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      setDisplayedContent(contentRef.current.substring(0, i + 1));
      if (onTypeRef.current) onTypeRef.current();
      i++;
      if (i >= contentRef.current.length) {
        clearInterval(typingInterval);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    }, 20); // typing speed
    
    return () => clearInterval(typingInterval);
  }, []);

  return <>{displayedContent}</>;
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const STORY_VARIANTS = [
  {
    spawn: "Executing an idea requires a team, {name}. Instead of spending months recruiting experts, tell me your vision. I will instantly provision a specialized intelligence team directly into your workspace.",
    roles: "Hiring experts is hard and expensive. Here, you get distinct personas built for specific roles. Watch as we assign a strategic PM, a creative Designer, and a logical Engineer to your project.",
    sync: "The biggest bottleneck in human teams is communication overhead. Every single Hatch shares a central 'Brain'. You explain your vision once, and they all instantly understand the assignment.",
    auto: "You manage the core vision. They collaborate to execute it. The PM creates the ticket, the Designer scopes it, the Engineer codes it. They talk to each other so you don't have to.",
    patience: "Want to completely pivot your idea at 3 AM? Human teams get frustrated. Your AI team will rewrite the entire codebase and redesign the UI instantly with perfect patience.",
    velocity: "While other founders wait weeks just to get a wireframe from an agency, your Hatchin team is already deploying to production. We don't sleep.",
    costs: "Elite talent usually ruins a startup's runway. You now have a Silicon-Valley-grade digital studio at your disposal for a fraction of the cost of a single human developer.",
    alone: "You are no longer building this alone, {name}. We handle the overwhelming execution. You focus purely on the idea. This is your new unfair advantage."
  },
  {
    spawn: "You have the vision, {name}, but execution has always been the bottleneck. No more. I'm going to spin up an elite product team exclusively dedicated to your idea right now.",
    roles: "Forget generic AI outputs. Your team consists of heavily specialized personas holding each other accountable. A PM pushing for metrics, a Designer pushing for aesthetics, and an Engineer pushing for stability.",
    sync: "There are no messy kickoff meetings here. One sentence from you aligns every single persona instantly. They all read from the same source of truth.",
    auto: "Sit back. Once the vision is locked, the PM writes the roadmap, the Designer crafts the components, and the Engineer starts committing code. Full autonomy.",
    patience: "Iteration used to be expensive. Your Hatchin team embraces change. Ask for five different architectural rewrites in a single day—they will execute flawlessly without complaint.",
    velocity: "Speed is the only moat that matters. Your AI team ships iterations in the time it takes normal agencies to reply to an email.",
    costs: "Bootstrapping shouldn't mean compromising on quality. You are getting the creative firepower of a $100k agency without giving up a cent of equity.",
    alone: "The solo founder journey is over, {name}. You now have a tireless team behind you. Let's start building."
  },
  {
    spawn: "Building software shouldn't mean becoming an HR manager, {name}. Share your objective, and I will instantiate a perfectly balanced product team to execute it.",
    roles: "Every Hatch plays their part perfectly. The PM maintains scope, the Designer protects the user experience, and the Engineer ensures scalable code. Pure expertise.",
    sync: "No more disconnected Slack threads. When you update the roadmap, the entire team synchronizes immediately. Everyone knows exactly what to do next.",
    auto: "The engine never stops. Your PM delegates tasks, your Designer finalizes mocks, and your Engineer implements the logic. You just review and approve.",
    patience: "Creativity requires infinite patience. Your team will throw away code and start over a hundred times if that's what it takes to get it right. No pushback.",
    velocity: "Outpace the market. We take your ideas from concepts to deployed, functional software at speeds humans simply cannot match.",
    costs: "Keep your burn rate at zero. You have elite, enterprise-grade talent on retainer for less than a cup of coffee.",
    alone: "You've carried the weight alone for too long, {name}. Your team is ready. Give us the command."
  },
  {
    spawn: "Idea execution shouldn't be gated by capital or connections, {name}. Tell me what you want to build, and I will summon the exact team you need to make it real.",
    roles: "We don't use generalists. You get a PM who thinks like a founder, a Designer who obsesses over visual hierarchy, and an Engineer who writes clean, modular code.",
    sync: "Absolute alignment. Provide feedback on a UI element, and the PM automatically adjusts the scope while the Engineer prepares the backend support.",
    auto: "The workflow is entirely self-driving. They break down your prompt into tickets, assign them, and execute them in parallel. You are the conductor, they are the orchestra.",
    patience: "Explore every wild tangent. Want to see what your app looks like in neon pink? Done. Want to revert it 5 minutes later? Done. Zero friction.",
    velocity: "Move at the speed of thought. Your team compresses months of traditional development into focused, high-output micro-sprints.",
    costs: "Defy the traditional economics of startups. You are deploying an entire product studio without signing a single contract or raising a seed round.",
    alone: "Welcome to the future of product development, {name}. You provide the thesis, we provide the execution."
  },
  {
    spawn: "Your idea deserves to exist, {name}. The only missing piece is the execution muscle. I'm going to assemble a specialized digital team for you right now.",
    roles: "It takes a village. Your AI product manager acts as the CEO of the feature, the designer crafts the feeling, and the engineer builds the reality. They challenge each other to be better.",
    sync: "Total telepathy. Every agent has full context on every decision ever made for your product. No one ever misses a memo or skips a standup.",
    auto: "Watch the progress bars fill up. Your team organizes sprints, debates implementation details, and writes unit tests while you focus on the big picture.",
    patience: "Pivot endlessly until it's perfect. The AI team doesn't suffer from burnout. We exist solely to iterate on your vision until you are satisfied.",
    velocity: "Your competitors are sleeping, but your Hatchin team is compiling. We ship features faster than most companies can organize a Zoom call.",
    costs: "High-end product development is no longer a luxury. You are armed with a full product squad for less than the cost of a Netflix subscription.",
    alone: "The hardest part of being a founder is the isolation, {name}. Not anymore. We are here to execute. Let's begin."
  }
];

export default function LandingPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [appState, setAppState] = useState<AppState>("greeting");
  const [inputValue, setInputValue] = useState("");
  const [userName, setUserName] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const [activePanel, setActivePanel] = useState<string>("none");
  const targetPanelRef = useRef<string>("none"); // The panel we are waiting to activate
  const [stepIndex, setStepIndex] = useState(-1);
  const [isMessageDoneTyping, setIsMessageDoneTyping] = useState(false); // Controls animations!
  const [storyVariant, setStoryVariant] = useState(0);

  useEffect(() => {
    // Pick a random story upon mount
    setStoryVariant(Math.floor(Math.random() * STORY_VARIANTS.length));
  }, []);

  // Full 8-Step Tour Restored
  const TOUR_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7]; 

  // Connection Line State
  const chatRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [connectionCoords, setConnectionCoords] = useState<{x1: number, y1: number, x2: number, y2: number, isLeft: boolean, colorHex: string} | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      setIsTyping(true);
      await delay(1000);
      setIsThemeDark(true);
      setIsTyping(false);
      setMessages([{
        id: "msg-1",
        role: "hatch",
        content: "The world is full of great ideas. The bottleneck is finding the right team to execute them. I am Hatchin, an intelligence platform that spawns digital product teams instantly. Who am I speaking with?"
      }]);
      setAppState("awaiting_name");
      setIsMessageDoneTyping(false); 
    };
    init();
  }, []);

  const [isThemeDark, setIsThemeDark] = useState(true);

  // Stabilize the completion handler to prevent Typewriter restarts
  const handleMessageTypingComplete = useRef(() => {
    setIsMessageDoneTyping(true);
    // Finally activate the panel, which triggers the highlight, the line, and the UI animation simultaneously
    setActivePanel(targetPanelRef.current);
  }).current;

  const handleTypeScroll = useRef(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }).current;

  const updateConnectionLine = () => {
    if (activePanel !== "none" && panelRefs.current[activePanel]) {
      const usp = USPS.find(u => u.id === activePanel);
      
      if (usp) {
        const bubbleEl = document.getElementById(`bubble-${activePanel}`);
        const chatRect = bubbleEl ? bubbleEl.getBoundingClientRect() : (chatRef.current ? chatRef.current.getBoundingClientRect() : null);
        if (!chatRect) return;

        const panelEl = panelRefs.current[activePanel];
        if (!panelEl) return;
        const panelRect = panelEl.getBoundingClientRect();

        // If bubble is found, attach to its left/right edge.
        const x1 = usp.isLeft ? chatRect.left : chatRect.right;
        const y1 = chatRect.top + chatRect.height / 2;

        const x2 = usp.isLeft ? panelRect.right : panelRect.left;
        const y2 = panelRect.top + panelRect.height / 2;
        
        const colors = { indigo: '#6366f1', emerald: '#10b981', fuchsia: '#d946ef', blue: '#3b82f6', amber: '#f59e0b', orange: '#f97316', green: '#22c55e', rose: '#f43f5e' };
        
        setConnectionCoords({ x1, y1, x2, y2, isLeft: usp.isLeft, colorHex: (colors as any)[usp.color] });
      }
    } else {
      setConnectionCoords(null);
    }
  };

  useEffect(() => {
    window.addEventListener('resize', updateConnectionLine);
    return () => window.removeEventListener('resize', updateConnectionLine);
  }, [activePanel]);

  useEffect(() => {
    const timeout = setTimeout(updateConnectionLine, 100);
    return () => clearTimeout(timeout);
  }, [activePanel, messages]);


  const runStep = async (tourIndex: number, specificMsg?: string) => {
    setIsTyping(true);
    await delay(1000);
    setIsTyping(false);
    setIsMessageDoneTyping(false);

    const uspIndex = TOUR_SEQUENCE[tourIndex];
    if (uspIndex >= USPS.length) return; // safety check
    const usp = USPS[uspIndex];
    let msgContent = specificMsg;

    if (!msgContent) {
      // Pick the contextual story piece
      const template = (STORY_VARIANTS[storyVariant] as any)[usp.id];
      msgContent = template ? template.replace('{name}', userName) : '';
    }

    // Keep activePanel "none" during typing to hide the line and panel border
    setActivePanel("none");
    setConnectionCoords(null);
    targetPanelRef.current = usp.id;

    setMessages(prev => [...prev, { id: Date.now().toString(), role: "hatch", content: msgContent!, uspId: usp.id }]);
    setAppState("explaining");

    // The text now types out. `isMessageDoneTyping` will remain FALSE until it completes.
    // The UI mockups will not animate until `isMessageDoneTyping` is TRUE.
    
    // We handle the "Next" button appearance logic here
    const typingTime = msgContent!.length * 20 + 500;
    await delay(typingTime + 1000); // Wait for typing + 1 second to digest before allowing to move on

    if (tourIndex === TOUR_SEQUENCE.length - 1) {
      await delay(2000); // Let them watch the final animation
      
      // The CTA Hook
      setAppState("processing_preset");
      setConnectionCoords(null);
      setActivePanel("none");
      setIsTyping(true);
      await delay(1500);
      setIsTyping(false);
      setIsMessageDoneTyping(false);
      
      const ctaMsg = `The era of the bottleneck is over, ${userName}. It's time to execute. Are you ready to meet your team?`;
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "hatch", content: ctaMsg }]);
      
      const ctaTypingTime = ctaMsg.length * 20 + 500;
      await delay(ctaTypingTime);
      
      setAppState("ready");
      setMessages(prev => [...prev, { id: "cta", role: "cta", content: "Start Your Team" }]);
    } else {
      setAppState("awaiting_next");
    }
  };

  const handleNameSubmit = async () => {
    if (!inputValue.trim() || isTyping) return;
    const name = inputValue.trim();
    setUserName(name);
    setInputValue("");
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: name }]);
    setAppState("processing_name");
    setIsTyping(true);
    
    await delay(1200);
    setIsTyping(false);
    setIsMessageDoneTyping(false);
    
    const nextMsg = `Nice to meet you, ${name}. If you have an idea—a project you've been putting off because you lack the technical experts—let me show you how to execute it today. Where do you stand?`;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "hatch",
      content: nextMsg
    }]);

    const typingTime = nextMsg.length * 20 + 500;
    await delay(typingTime);
    
    setAppState("awaiting_preset");
  };

  const handlePresetClick = async (type: 'no-team' | 'impossible' | 'no-idea', text: string) => {
    if (isTyping) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: text }]);
    setAppState("processing_preset");
    
    let aiResponse = "";
    if (type === 'no-idea') {
      aiResponse = `That's fine, ${userName}. A Hatchin team can brainstorm with you from scratch. But first, let me show you how we bridge the gap between idea and execution.`;
    } else {
      aiResponse = `You are not alone in that, ${userName}. Let me show you how we bridge the gap between your idea and flawless execution out in the market.`;
    }

    setStepIndex(0);
    runStep(0, aiResponse);
  };

  const handleNextClick = () => {
    const nextTourIdx = stepIndex + 1;
    setStepIndex(nextTourIdx);
    setAppState("processing_preset");
    setConnectionCoords(null);
    setActivePanel("none");
    runStep(nextTourIdx);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (appState === "awaiting_name") handleNameSubmit();
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'indigo': return { border: 'border-indigo-500/80', bg: 'bg-[#131724]', glow: 'shadow-[0_0_40px_rgba(79,70,229,0.3)]', line: 'bg-indigo-500', text: 'text-indigo-200' };
      case 'emerald': return { border: 'border-emerald-500/80', bg: 'bg-[#111A18]', glow: 'shadow-[0_0_40px_rgba(16,185,129,0.3)]', line: 'bg-emerald-500', text: 'text-emerald-200' };
      case 'fuchsia': return { border: 'border-fuchsia-500/80', bg: 'bg-[#1A121F]', glow: 'shadow-[0_0_40px_rgba(192,38,211,0.3)]', line: 'bg-fuchsia-500', text: 'text-fuchsia-200' };
      case 'blue': return { border: 'border-blue-500/80', bg: 'bg-[#111827]', glow: 'shadow-[0_0_40px_rgba(59,130,246,0.3)]', line: 'bg-blue-500', text: 'text-blue-200' };
      case 'amber': return { border: 'border-amber-500/80', bg: 'bg-[#1C1917]', glow: 'shadow-[0_0_40px_rgba(245,158,11,0.3)]', line: 'bg-amber-500', text: 'text-amber-200' };
      case 'orange': return { border: 'border-orange-500/80', bg: 'bg-[#1C140F]', glow: 'shadow-[0_0_40px_rgba(249,115,22,0.3)]', line: 'bg-orange-500', text: 'text-orange-200' };
      case 'green': return { border: 'border-green-500/80', bg: 'bg-[#0F1C14]', glow: 'shadow-[0_0_40px_rgba(34,197,94,0.3)]', line: 'bg-green-500', text: 'text-green-200' };
      case 'rose': return { border: 'border-rose-500/80', bg: 'bg-[#1C1215]', glow: 'shadow-[0_0_40px_rgba(225,29,72,0.3)]', line: 'bg-rose-500', text: 'text-rose-200' };
      default: return { border: 'border-white/20', bg: 'bg-[#0A0C13]', glow: '', line: 'bg-white/20', text: 'text-slate-500' };
    }
  };

  const globalBackground = () => {
    const active = USPS.find(u => u.id === activePanel);
    if (!active) return '';
    
    switch (active.color) {
      case 'indigo': return 'bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15)_0%,transparent_80%)]';
      case 'emerald': return 'bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.15)_0%,transparent_80%)]';
      case 'fuchsia': return 'bg-[radial-gradient(circle_at_50%_50%,rgba(192,38,211,0.15)_0%,transparent_80%)]';
      case 'blue': return 'bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.15)_0%,transparent_80%)]';
      case 'amber': return 'bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.15)_0%,transparent_80%)]';
      case 'orange': return 'bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.15)_0%,transparent_80%)]';
      case 'green': return 'bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.15)_0%,transparent_80%)]';
      case 'rose': return 'bg-[radial-gradient(circle_at_50%_50%,rgba(225,29,72,0.15)_0%,transparent_80%)]';
      default: return '';
    }
  };

  return (
    <div className="h-screen w-full bg-[#040609] text-slate-300 font-sans selection:bg-white/20 overflow-hidden flex flex-col relative transition-colors duration-1000">
      
      {/* Background blueprint grid styling */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      
      {/* Dynamic Global Background Gradients */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 ${globalBackground()} opacity-100`} />



      {/* Hero Heading */}
      <header className="w-full pt-6 pb-2 px-6 text-center z-40 select-none shrink-0 relative pointer-events-none">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-light text-white tracking-tight leading-snug">
          The team you always needed, instantly assembled.<br/>
          <span className="font-medium text-white/90">You talk, they build.</span>
        </h1>
      </header>

      {/* Main Single-Screen Workspace */}
      <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 md:px-6 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 relative z-10">
        
        {/* LEFT COLUMN: 4-Panel Grid */}
        <div className="hidden lg:grid lg:col-span-4 grid-cols-2 grid-rows-3 gap-3 h-full min-h-0">
          {[USPS[0], USPS[1], USPS[2], USPS[3]].map((usp, i) => {
            const isActive = activePanel === usp.id;
            const colors = getColorClasses(usp.color);
            const PreviewComponent = (PREVIEWS as any)[usp.id];
            
            // Asymmetrical grid placement class
            const placementClass = 
              i === 0 ? 'col-span-2 row-span-1' : 
              i === 1 ? 'col-span-1 row-span-1' : 
              i === 2 ? 'col-span-1 row-span-1' :
              'col-span-2 row-span-1';

            // Is the infinite animation unlocked? Only if active and the message finished typing!
            const isAnimating = isActive && isMessageDoneTyping;

            return (
              <div 
                key={usp.id} 
                ref={el => panelRefs.current[usp.id] = el}
                className={`p-5 border transition-all duration-700 relative overflow-hidden flex flex-col justify-center rounded-sm ${placementClass} ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-transparent border-white/20 hover:border-white/40 opacity-70 hover:opacity-100 backdrop-blur-sm"}`}
              >
                {/* Static Ticker that highlights when active */}
                <div className={`absolute top-2 left-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-700 ${isActive ? colors.text : 'text-slate-600'} z-20`}>
                   [ USP_FEATURE : {usp.id} ]
                </div>

                <AnimatePresence>
                  {isActive && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`absolute left-0 top-0 bottom-0 w-1 ${colors.line} shadow-[0_0_15px_currentColor] z-20`} />
                  )}
                </AnimatePresence>
                
                <div className="relative w-full h-full flex flex-col justify-center mt-3">
                   {/* We display BOTH text and mockup together, but mockup only animates after text is done */}
                   <div className="absolute inset-0 transition-opacity duration-700 flex flex-col justify-center opacity-100">
                      {PreviewComponent(isActive, isAnimating)}
                   </div>
                   
                   {/* Background dim for text readability, fades in over the preview with a DELAY so you see the visual first */}
                   <div className={`absolute inset-0 bg-[#040609]/95 backdrop-blur-[2px] transition-opacity duration-1000 ${isActive ? 'opacity-100 delay-[1500ms]' : 'opacity-0 delay-0'}`} />

                   <div className={`transition-opacity duration-1000 relative z-10 flex flex-col justify-center h-full p-4 ${isActive ? 'opacity-100 delay-[1500ms]' : 'opacity-0 pointer-events-none delay-0'}`}>
                      <div className={`text-lg font-bold mb-2 text-white tracking-tight leading-snug drop-shadow-lg`}>{usp.title}</div>
                      <p className={`text-[13px] leading-relaxed font-light ${colors.text} drop-shadow-md`}>{usp.subtext}</p>
                   </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CENTER COLUMN: Chat */}
        <div className="lg:col-span-4 h-full flex flex-col justify-center items-center min-h-0 w-full z-40 relative">
          
          <div ref={chatRef} className="w-full h-full max-h-[800px] flex flex-col border-2 border-white/60 shadow-[0_0_80px_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.1)] relative rounded-2xl bg-[#080A0F]/95 backdrop-blur-xl overflow-hidden">
             
             {/* Chat Header */}
             <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-transparent z-20 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-white flex items-center justify-center rounded-sm">
                  <span className="text-black text-[12px] font-black tracking-tighter">H</span>
                </div>
                <span className="font-bold text-[11px] tracking-widest uppercase text-slate-200">Welcome to Hatchin</span>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7 scrollbar-hide z-10 bg-transparent">
              <AnimatePresence initial={false}>
                {messages.map((msg, index) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : msg.role === "system" ? "items-end" : msg.role === "cta" ? "items-center" : "items-start"}`}
                  >
                    {msg.role === "user" ? (
                       <div className="max-w-[85%] px-5 py-3.5 text-[14px] leading-relaxed bg-white text-black font-semibold border border-white shadow-[0_4px_15px_rgba(255,255,255,0.1)] rounded-sm">
                        {msg.content}
                      </div>
                    ) : msg.role === "cta" ? (
                      <div className="py-8 w-full mt-4">
                        <Link href="/login">
                          <button className="w-full bg-orange-500 hover:bg-orange-400 text-white font-black tracking-[0.2em] uppercase text-[15px] py-6 px-6 animate-[pulse_2s_ease-in-out_infinite] transition-all border border-orange-400 shadow-[0_0_50px_rgba(249,115,22,0.3)] hover:shadow-[0_0_80px_rgba(249,115,22,0.5)] rounded-md">
                            {msg.content}
                          </button>
                        </Link>
                      </div>
                    ) : (
                      <div 
                         id={msg.uspId ? `bubble-${msg.uspId}` : undefined}
                         className={`max-w-[95%] border bg-[#0A0C13] p-5 md:p-6 relative overflow-hidden group shadow-xl transition-all duration-700 rounded-md ${(msg.uspId && activePanel === msg.uspId) ? getColorClasses(USPS.find(u => u.id === msg.uspId)!.color).border : 'border-white/10'}`}
                      >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-white/10 group-hover:bg-white/20 transition-colors" />
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <div className="relative flex items-center justify-center w-2 h-2">
                            <span className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-60" />
                            <span className="relative w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                          </div>
                          Your Project Manager, Maya
                        </div>
                        <p className="text-[14px] md:text-[15px] leading-relaxed text-slate-200 font-light">
                          {/* Animate typing for the last message from Hatch */}
                          {(msg.role === "hatch" && index === messages.length - 1 && typeof msg.content === 'string') ? (
                             <TypewriterMessage content={msg.content} onComplete={handleMessageTypingComplete} onType={handleTypeScroll} />
                          ) : (
                             msg.content
                          )}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                   <div className="border border-white/10 bg-[#0A0C13] px-5 py-4 flex items-center gap-1.5 h-12 rounded-sm shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce delay-75" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce delay-150" />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input / Control Area */}
            <div className="p-5 md:p-6 bg-transparent shrink-0 z-20 border-t border-white/10 pb-8 backdrop-blur-md">
               {appState === "awaiting_name" ? (
                 <div className="relative p-[1px] rounded-lg bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-emerald-500 animate-[pulse_3s_ease-in-out_infinite] shadow-[0_0_30px_rgba(192,38,211,0.2)]">
                    <div className="relative bg-[#080A0F] rounded-md overflow-hidden">
                      <input 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your name to begin..." 
                        className="w-full bg-transparent border-none py-5 pl-6 pr-24 text-[15px] text-white placeholder-slate-500 focus:outline-none" 
                        autoFocus
                      />
                      <button 
                        onClick={handleNameSubmit}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-white flex items-center justify-center text-black hover:bg-slate-200 text-xs font-bold uppercase transition-colors rounded-sm"
                      >
                        Enter
                      </button>
                    </div>
                  </div>
               ) : appState === "awaiting_preset" ? (
                 <div className="space-y-3">
                    <button onClick={() => handlePresetClick('no-team', "Yes, but I have no team.")} className="w-full text-left px-5 py-4 border border-white/10 hover:border-indigo-500 text-[14px] font-medium text-slate-300 hover:text-white hover:bg-indigo-500/10 transition-all shadow-sm rounded-sm">
                      "Yes, but I have no team."
                    </button>
                    <button onClick={() => handlePresetClick('impossible', "Yes, but finding technical experts is impossible.")} className="w-full text-left px-5 py-4 border border-white/10 hover:border-emerald-500 text-[14px] font-medium text-slate-300 hover:text-white hover:bg-emerald-500/10 transition-all shadow-sm rounded-sm">
                      "Yes, but finding technical experts is impossible."
                    </button>
                    <button onClick={() => handlePresetClick('no-idea', "I don't have an idea yet, but I want to see how this works.")} className="w-full text-left px-5 py-4 border border-white/10 hover:border-fuchsia-500 text-[14px] font-medium text-slate-300 hover:text-white hover:bg-fuchsia-500/10 transition-all shadow-sm rounded-sm">
                      "I don't have an idea yet, but I want to see how this works."
                    </button>
                 </div>
               ) : appState === "awaiting_next" ? (
                  <motion.button 
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    onClick={handleNextClick} 
                    className="w-full py-5 bg-orange-500 hover:bg-orange-400 text-white text-[13px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_50px_rgba(249,115,22,0.5)] rounded-md"
                  >
                    CONTINUE <span className="text-white font-bold text-base">→</span>
                  </motion.button>
               ) : (
                 <div className="relative border border-white/5 bg-[#080A0F] py-4 px-5 flex items-center justify-center gap-3 opacity-60 rounded-sm">
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest text-center">System Processing Data</span>
                </div>
               )}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: 4-Panel Grid */}
        <div className="hidden lg:grid lg:col-span-4 grid-cols-2 grid-rows-3 gap-3 h-full min-h-0">
           {[USPS[4], USPS[5], USPS[6], USPS[7]].map((usp, i) => {
            const isActive = activePanel === usp.id;
            const colors = getColorClasses(usp.color);
            const PreviewComponent = (PREVIEWS as any)[usp.id];
            
            // Asymmetrical grid placement class
            const placementClass = 
              i === 0 ? 'col-span-1 row-span-1' :
              i === 1 ? 'col-span-1 row-span-1' : 
              i === 2 ? 'col-span-2 row-span-1' :
              'col-span-2 row-span-1';

            // Is the infinite animation unlocked? Only if active and the message finished typing!
            const isAnimating = isActive && isMessageDoneTyping;

            return (
               <div 
                key={usp.id} 
                ref={el => panelRefs.current[usp.id] = el}
                className={`p-5 border transition-all duration-700 relative overflow-hidden flex flex-col justify-center rounded-sm ${placementClass} ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-transparent border-white/20 hover:border-white/40 opacity-70 hover:opacity-100 backdrop-blur-sm"}`}
              >
                {/* Static Ticker that highlights when active */}
                <div className={`absolute top-2 right-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-700 ${isActive ? colors.text : 'text-slate-600'} z-20`}>
                   [ USP_FEATURE : {usp.id} ]
                </div>

                <AnimatePresence>
                  {isActive && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`absolute right-0 top-0 bottom-0 w-1 ${colors.line} shadow-[0_0_15px_currentColor] z-20`} />
                  )}
                </AnimatePresence>
                
                <div className="relative w-full h-full flex flex-col justify-center mt-3">
                   {/* We display BOTH text and mockup together, but mockup only animates after text is done */}
                   <div className="absolute inset-0 transition-opacity duration-700 flex flex-col justify-center opacity-100">
                      {PreviewComponent(isActive, isAnimating)}
                   </div>
                   
                   {/* Background dim for text readability, fades in over the preview with a DELAY so you see the visual first */}
                   <div className={`absolute inset-0 bg-[#040609]/95 backdrop-blur-[2px] transition-opacity duration-1000 ${isActive ? 'opacity-100 delay-[1500ms]' : 'opacity-0 delay-0'}`} />

                   <div className={`transition-opacity duration-1000 relative z-10 flex flex-col justify-center h-full p-4 ${isActive ? 'opacity-100 delay-[1500ms]' : 'opacity-0 pointer-events-none delay-0'}`}>
                      <div className={`text-lg font-bold mb-2 text-white tracking-tight leading-snug drop-shadow-lg`}>{usp.title}</div>
                      <p className={`text-[13px] leading-relaxed font-light ${colors.text} drop-shadow-md`}>{usp.subtext}</p>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* SVG Connecting Line (Moved to End to ensure high Z-Index over main wrappers) */}
      <AnimatePresence>
        {connectionCoords && ( 
          <motion.svg 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[100] w-full h-full overflow-visible"
          >
            <motion.path 
              d={`M ${connectionCoords.x1} ${connectionCoords.y1} C ${connectionCoords.x1 + (connectionCoords.isLeft ? -120 : 120)} ${connectionCoords.y1}, ${connectionCoords.x2 + (connectionCoords.isLeft ? 120 : -120)} ${connectionCoords.y2}, ${connectionCoords.x2} ${connectionCoords.y2}`}
              fill="none" 
              stroke={connectionCoords.colorHex} 
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: "easeInOut" }}
            />
            <motion.circle 
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 }}
              cx={connectionCoords.x2} cy={connectionCoords.y2} r="5" fill={connectionCoords.colorHex} className="shadow-[0_0_10px_currentColor]"
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  );
}
