import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

// Inline SVG component that preserves SMIL animations
const InlineSVG = ({ src, size }: { src: string; size: number }) => {
  const [svgContent, setSvgContent] = useState<string>("");
  useEffect(() => {
    fetch(src)
      .then(r => r.text())
      .then(text => {
        // Inject width/height into the SVG tag so it scales properly
        const sized = text.replace('<svg ', `<svg width="${size}" height="${size}" `);
        setSvgContent(sized);
      })
      .catch(() => {});
  }, [src, size]);
  if (!svgContent) return <div style={{ width: size, height: size }} />;
  return <div style={{ width: size, height: size, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: svgContent }} />;
};


interface Message {
  id: string;
  role: "user" | "hatch" | "cta" | "system";
  content: string | JSX.Element;
  uspId?: string;
}

function renderHighlighted(text: string, accentColor = "rgba(255,255,255,0.95)"): JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <span key={i} style={{ color: accentColor, fontWeight: 600 }}>{part.slice(2, -2)}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

type AppState = "greeting" | "awaiting_name" | "processing_name" | "awaiting_preset" | "processing_preset" | "explaining" | "awaiting_next" | "ready";

// The 8-Panel Persona/Empathetic USPs
const USPS = [
  { id: 'spawn', label: 'your team', title: 'Your Team, Instantly.', subtext: "Tell us what you're building. **Maya**, **Drew**, and **Zara** are AI teammates. A PM, an engineer, and a designer. Each with their own expertise, opinions, and way of working.", color: 'fuchsia', isLeft: true },
  { id: 'roles', label: 'real expertise', title: 'Real Expertise. Real Opinions.', subtext: "**Maya** argues for what your users actually need. **Zara** obsesses over every pixel. **Drew** won't ship anything half-done. They have opinions. That's by design.", color: 'emerald', isLeft: false },
  { id: 'sync', label: 'shared memory', title: 'Tell Them Once. They All Get It.', subtext: "Tell your team once. They all remember. Your brand, your past decisions, where you're headed. **Everyone's on the same page.**", color: 'indigo', isLeft: true },
  { id: 'auto', label: 'always building', title: "They Keep Going While You're Away.", subtext: "Wake up to **progress you didn't expect**. Your team talks to each other, divides the work, and keeps building while you're **living your life**.", color: 'blue', isLeft: true },

  { id: 'patience', label: 'infinite patience', title: 'Iterate Without Guilt.', subtext: "Change your mind at **3 AM**. They'll start over without blinking. **No guilt. No pushback.** No clock ticking.", color: 'amber', isLeft: false },
  { id: 'velocity', label: 'built different', title: 'Move at the Speed of Ideas.', subtext: "Your team doesn't wait for meetings. They don't wait for approvals. They **build while the world is still planning**.", color: 'orange', isLeft: false },
  { id: 'costs', label: 'for everyone', title: 'World-Class Team. Not World-Class Budget.', subtext: "A team that would cost **six figures**, for less than you'd spend on coffee. **Quality isn't a luxury anymore.**", color: 'green', isLeft: false },
  { id: 'alone', label: 'never alone', title: "You're Not Building Alone Anymore.", subtext: "Whatever you're building. A product, a skill, a side project, a dream. You don't have to do it alone. **Your team is here. Always.**", color: 'rose', isLeft: false }
];


const USP_ACCENT: Record<string, string> = {
  spawn: '#d946ef', roles: '#10b981', sync: '#6366f1', auto: '#3b82f6',
  patience: '#f59e0b', velocity: '#f97316', costs: '#22c55e', alone: '#f43f5e',
};

// Muted "Real-App" visual components
// The `isAnimating` prop dictates whether the infinite looping animations should be running.
const PREVIEWS: Record<string, (isActive: boolean, isAnimating: boolean) => JSX.Element> = {
  spawn: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex items-center justify-center gap-3 w-full h-full">
      {[
        { name: 'Maya', role: 'PM', color: '#d946ef', doodle: '/doodles/maya.svg', delay: 0 },
        { name: 'Drew', role: 'Engineer', color: '#3b82f6', doodle: '/doodles/drew.svg', delay: 0.15 },
        { name: 'Zara', role: 'Designer', color: '#10b981', doodle: '/doodles/zara.svg', delay: 0.3 },
      ].map((member, i) => (
        <motion.div
          key={i}
          className="flex flex-col items-center gap-1"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: isActive ? 1 : 0.7, opacity: isActive ? 1 : 0.4 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.6, delay: isAnimating ? member.delay : 0 }}
        >
          <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden relative"
            animate={{ y: isAnimating ? [0, -4, 0] : 0 }}
            transition={{ duration: 2.5, repeat: isAnimating ? Infinity : 0, delay: member.delay, ease: 'easeInOut' }}
          >
            <InlineSVG src={member.doodle} size={64} />
          </motion.div>
          <div className="text-center">
            <div className="text-[10px] font-semibold text-foreground">{member.name}</div>
            <div className="text-[8px] uppercase tracking-wider font-medium" style={{ color: member.color }}>{member.role}</div>
          </div>
        </motion.div>
      ))}
    </div>
  ),
  roles: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col gap-2 relative w-full opacity-80">
      {[
        { name: 'Maya', doodle: '/doodles/maya.svg', quote: '"Who\'s this actually for?"', color: '#d946ef' },
        { name: 'Zara', doodle: '/doodles/zara.svg', quote: '"I have three directions"', color: '#10b981' },
        { name: 'Drew', doodle: '/doodles/drew.svg', quote: '"Let me check the arch"', color: '#3b82f6' },
      ].map((member, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2.5 bg-muted p-2 rounded-lg border border-border/40"
          animate={{ borderColor: isAnimating ? ['rgba(51,65,85,0.4)', member.color + '60', 'rgba(51,65,85,0.4)'] : 'rgba(51,65,85,0.3)' }}
          transition={{ duration: 2.5, delay: i * 0.4, repeat: isAnimating ? Infinity : 0 }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0">
            <InlineSVG src={member.doodle} size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-foreground font-semibold">{member.name}</div>
            <motion.div className="text-[9px] text-muted-foreground truncate italic"
              animate={{ opacity: isAnimating ? [0.5, 1, 0.5] : 0.7 }}
              transition={{ duration: 2, delay: i * 0.3, repeat: isAnimating ? Infinity : 0 }}>
              {member.quote}
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  ),
  sync: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex items-center justify-center h-full w-full opacity-80 relative">
      <motion.div
        className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center relative z-10"
        animate={{ boxShadow: isAnimating ? ['0 0 10px rgba(99,102,241,0.2)', '0 0 25px rgba(99,102,241,0.4)', '0 0 10px rgba(99,102,241,0.2)'] : '0 0 10px rgba(99,102,241,0.2)' }}
        transition={{ duration: 2, repeat: isAnimating ? Infinity : 0 }}
      >
        <span className="text-[7px] text-indigo-300 font-bold uppercase tracking-wider">Brain</span>
      </motion.div>
      {[
        { x: -28, y: -20, doodle: '/doodles/maya.svg', color: '#d946ef' },
        { x: 28, y: -20, doodle: '/doodles/zara.svg', color: '#10b981' },
        { x: 0, y: 28, doodle: '/doodles/drew.svg', color: '#3b82f6' },
      ].map((dot, i) => (
        <motion.div
          key={i}
          className="absolute w-7 h-7 rounded-full flex items-center justify-center overflow-hidden"
          style={{ left: `calc(50% + ${dot.x}px - 14px)`, top: `calc(50% + ${dot.y}px - 14px)`, borderColor: dot.color + '50' }}
          animate={{ opacity: isAnimating ? [0.5, 1, 0.5] : 0.6 }}
          transition={{ duration: 1.5, delay: i * 0.4, repeat: isAnimating ? Infinity : 0 }}
        >
          <InlineSVG src={dot.doodle} size={28} />
        </motion.div>
      ))}
    </div>
  ),
  auto: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col gap-1.5 w-full h-full justify-center opacity-80">
      {[
        { text: 'Maya drafted the product brief', color: '#d946ef' },
        { text: 'Drew started on the API', color: '#3b82f6' },
        { text: 'Zara has 3 mockups ready', color: '#10b981' },
      ].map((notif, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2 bg-muted rounded px-2.5 py-2 border border-border/40"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: isActive ? 0 : 10, opacity: isActive ? 1 : 0.4 }}
          transition={{ delay: isAnimating ? i * 0.3 : 0, type: "spring", bounce: 0.3 }}
        >
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: notif.color }} />
          <span className="text-[9px] text-foreground">{notif.text}</span>
        </motion.div>
      ))}
    </div>
  ),
  patience: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col font-mono text-[9px] text-muted-foreground h-full w-full bg-muted rounded border border-border/80 overflow-hidden shadow-inner opacity-80">
      <div className="flex gap-1.5 border-b border-border/80 p-1.5 bg-[#080a0f]">
        <div className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
      </div>
      <div className="p-2 flex flex-col gap-0.5 relative">
        <div className="text-amber-400">{`.hero {`}</div>
        <div className="pl-2">flex-dir: row;</div>
        <div className="relative h-3">
           <motion.div className="absolute pl-2 text-rose-400 line-through" animate={{ opacity: isAnimating ? [1, 0, 1] : 1 }} transition={{ duration: isAnimating ? 4 : 0, repeat: isAnimating ? Infinity : 0 }}>bg: black;</motion.div>
           <motion.div className="absolute pl-2 text-emerald-400 border-l border-emerald-500/50 pl-1" animate={{ opacity: isAnimating ? [0, 1, 0] : 0 }} transition={{ duration: isAnimating ? 4 : 0, repeat: isAnimating ? Infinity : 0 }}>bg: white; <span className="text-muted-foreground ml-1">{"/* take 24, almost there */"}</span></motion.div>
        </div>
        <div>{`}`}</div>
      </div>
    </div>
  ),
  velocity: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col gap-3 justify-center h-full w-full opacity-80">
      <div className="flex items-center gap-2">
        <span className="text-[8px] text-muted-foreground w-12 shrink-0">Others</span>
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div className="h-full bg-slate-600 rounded-full" animate={{ width: isAnimating ? ['5%', '15%', '5%'] : '10%' }} transition={{ duration: 4, repeat: isAnimating ? Infinity : 0 }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[8px] text-orange-400 w-12 shrink-0 font-semibold">Your team</span>
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div className="h-full bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.4)]" animate={{ width: isAnimating ? ['30%', '95%', '30%'] : '60%' }} transition={{ duration: 3, repeat: isAnimating ? Infinity : 0 }} />
        </div>
      </div>
      <div className="text-[7px] text-muted-foreground text-right">Already building</div>
    </div>
  ),
  costs: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex flex-col justify-center h-full font-mono text-[9px] gap-3 w-full opacity-80">
      <div className="text-muted-foreground">
        <span className="text-rose-400/70 line-through text-[8px]">Hiring a team: 3 months + $100k+</span>
      </div>
      <motion.div
        className="relative overflow-hidden"
        animate={{ scale: isAnimating ? [1, 1.02, 1] : 1 }}
        transition={{ duration: 2, repeat: isAnimating ? Infinity : 0, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 bg-green-500/10 blur-xl" />
        <span className="text-[10px] text-green-300 font-semibold relative z-10">Your team is already here.</span>
      </motion.div>
    </div>
  ),
  alone: (isActive: boolean, isAnimating: boolean) => (
    <div className="flex items-center justify-center h-full w-full opacity-80 relative">
      <motion.div
        className="w-8 h-8 rounded-full bg-slate-700/50 border border-slate-600 flex items-center justify-center z-10"
        animate={{ scale: isAnimating ? [1, 0.95, 1] : 1 }}
        transition={{ duration: 2, repeat: isAnimating ? Infinity : 0 }}
      >
        <div className="w-2 h-2 rounded-full bg-slate-400" />
      </motion.div>
      {[
        { x: -22, y: -18, doodle: '/doodles/maya.svg', color: '#d946ef', delay: 0 },
        { x: 22, y: -18, doodle: '/doodles/zara.svg', color: '#10b981', delay: 0.2 },
        { x: -22, y: 18, doodle: '/doodles/drew.svg', color: '#3b82f6', delay: 0.4 },
      ].map((member, i) => (
        <motion.div
          key={i}
          className="absolute w-7 h-7 rounded-full flex items-center justify-center overflow-hidden"
          style={{ left: `calc(50% + ${member.x}px - 14px)`, top: `calc(50% + ${member.y}px - 14px)` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: isActive ? 1 : 0.3, opacity: isActive ? 1 : 0.2 }}
          transition={{ type: "spring", bounce: 0.5, delay: isAnimating ? member.delay : 0 }}
        >
          <InlineSVG src={member.doodle} size={32} />
        </motion.div>
      ))}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{ opacity: isAnimating ? [0, 0.3, 0] : 0 }}
        transition={{ duration: 2, repeat: isAnimating ? Infinity : 0 }}
        style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)' }}
      />
    </div>
  )
};


// Typewriter component for AI messages
// Typewriter component — highlights in real-time as text appears
const TypewriterMessage = ({ content, accentColor = "rgba(255,255,255,0.95)", onComplete, onType }: { content: string, accentColor?: string, onComplete?: () => void, onType?: () => void }) => {
  const [charCount, setCharCount] = useState(0);
  const contentRef = useRef(content);
  const plainLenRef = useRef(content.replace(/\*\*/g, "").length);
  const onCompleteRef = useRef(onComplete);
  const onTypeRef = useRef(onType);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTypeRef.current = onType;
  }, [onComplete, onType]);

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      i++;
      setCharCount(i);
      if (onTypeRef.current) onTypeRef.current();
      if (i >= plainLenRef.current) {
        clearInterval(typingInterval);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    }, 20);
    return () => clearInterval(typingInterval);
  }, []);

  // Render charCount visible characters with real-time color highlighting
  const parts = contentRef.current.split(/(\*\*[^*]+\*\*)/g);
  let remaining = charCount;
  const elements: JSX.Element[] = [];
  for (let idx = 0; idx < parts.length && remaining > 0; idx++) {
    const part = parts[idx];
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      const show = inner.slice(0, remaining);
      remaining -= show.length;
      elements.push(<span key={idx} style={{ color: accentColor, fontWeight: 600 }}>{show}</span>);
    } else {
      const show = part.slice(0, remaining);
      remaining -= show.length;
      elements.push(<span key={idx}>{show}</span>);
    }
  }
  return <>{elements}</>;
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const extractName = (input: string): string => {
  let name = input.trim();
  const prefixes = [
    /^hi[,!]?\s+i'?m?\s+/i,
    /^hey[,!]?\s+i'?m?\s+/i,
    /^hello[,!]?\s+i'?m?\s+/i,
    /^my\s+name\s+is\s+/i,
    /^i\s+am\s+/i,
    /^i'm\s+/i,
    /^it'?s\s+/i,
    /^call\s+me\s+/i,
    /^they\s+call\s+me\s+/i,
    /^the\s+name'?s\s+/i,
    /^just\s+/i,
  ];
  for (const prefix of prefixes) {
    name = name.replace(prefix, '');
  }
  // Remove trailing punctuation
  name = name.replace(/[.!]+$/, '').trim();
  // Capitalize first letter of each word
  return name.replace(/\b\w/g, c => c.toUpperCase());
};

const STORY_VARIANTS = [
  {
    spawn: "You know the hardest part of building something, {name}? It's not the idea. It's not having the right people. Let me introduce your team. AI teammates we crafted with real expertise and real opinions. **Maya**, your PM, asks the hard questions. **Drew**, your engineer, builds it right. **Zara**, your designer, won't settle for good enough. They're already here.",
    roles: "Ever hired someone who didn't care as much as you did? These teammates are different, {name}. **Maya** will push back on your roadmap if it doesn't make sense. **Zara** will show you three directions and tell you which one she'd pick. **Drew** will rewrite something four times until it's clean. They have **opinions**. That's what makes them good.",
    auto: "Here's what burned you before: everything stops when you stop. Not anymore. Come back tomorrow and **Maya** drafted the brief, **Drew** started the architecture, **Zara** has mockups ready. Your team doesn't wait for you to push them. They just **build**.",
    alone: "Here's the truth, {name}: you've been carrying this alone. The late nights. The doubt. Doing everything yourself and wondering if anyone else would care as much. **Your team is here now.** And they're not going anywhere."
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
  const TOUR_SEQUENCE = [0, 1, 3, 7]; 

  // Connection Line State
  const chatRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [connectionCoords, setConnectionCoords] = useState<{x1: number, y1: number, x2: number, y2: number, isLeft: boolean, colorHex: string} | null>(null);

  const scrollToBottom = () => {
    const el = messagesEndRef.current;
    if (el?.parentElement) {
      el.parentElement.scrollTop = el.parentElement.scrollHeight;
    }
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
        content: "You've been building alone long enough. **Every dream needs a team.** And we built yours. I'm **Maya**, your PM. I'm AI, but I have real opinions, memory, and I'll push back when your plan doesn't make sense. I've got a whole crew to introduce you to. What should we call you?"
      }]);
      setAppState("awaiting_name");
      setIsMessageDoneTyping(false); 
    };
    init();
  }, []);

  const [isThemeDark, setIsThemeDark] = useState(true);

  const anyLeftActive = ['spawn', 'auto', 'sync'].includes(activePanel);
  const anyRightActive = ['roles', 'patience', 'alone'].includes(activePanel);

  // Stabilize the completion handler to prevent Typewriter restarts
  const handleMessageTypingComplete = useRef(() => {
    setIsMessageDoneTyping(true);
    // Finally activate the panel, which triggers the highlight, the line, and the UI animation simultaneously
    setActivePanel(targetPanelRef.current);
  }).current;

  const handleTypeScroll = useRef(() => {
     const el = messagesEndRef.current;
     if (el?.parentElement) { el.parentElement.scrollTop = el.parentElement.scrollHeight; };
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
      
      const bonusMsg = `Oh, and ${userName}? They share one memory, so you never repeat yourself. They have infinite patience when you change your mind. And a team like this would normally cost six figures. Not here.`;
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "hatch", content: bonusMsg }]);
      const bonusTypingTime = bonusMsg.length * 20 + 500;
      await delay(bonusTypingTime);

      setIsTyping(true);
      await delay(1000);
      setIsTyping(false);
      setIsMessageDoneTyping(false);

      const ctaMsg = `That's your team, ${userName}. They think, they remember, they care. And they're **ready when you are.**`;
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "hatch", content: ctaMsg }]);
      
      const ctaTypingTime = ctaMsg.length * 20 + 500;
      await delay(ctaTypingTime);
      
      setAppState("ready");
      setMessages(prev => [...prev, { id: "cta", role: "cta", content: "Meet Your Team \u2192" }]);
    } else {
      setAppState("awaiting_next");
    }
  };

  const handleNameSubmit = async (skipName?: string) => {
    const rawInput = skipName || inputValue.trim();
    if (!rawInput || isTyping) return;
    const name = extractName(rawInput);
    setUserName(name);
    setInputValue("");
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: rawInput }]);
    setAppState("processing_name");
    setIsTyping(true);
    
    await delay(1200);
    setIsTyping(false);
    setIsMessageDoneTyping(false);
    
    const nextMsg = `Nice to meet you, ${name}. Building something real is hard. Doing everything yourself, hiring someone who didn't care as much as you, never having the right people at the right time. That's why we exist. Where are you at?`;

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
      aiResponse = `That's the best part, ${userName}. You don't need a finished idea. Your team can **think with you from scratch.** Challenge assumptions, explore directions, figure out what's worth building. Let me introduce them.`;
    } else if (type === 'no-team') {
      aiResponse = `I hear that a lot, ${userName}. You've got the vision but no one to build it with. **That changes today.** Let me introduce the teammates we built for exactly this.`;
    } else {
      aiResponse = `You've been carrying this alone, ${userName}. The late nights, the context-switching, wearing every hat. **You don't have to anymore.** Let me show you who's here.`;
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
      case 'indigo': return { border: 'border-indigo-500/80', bg: 'bg-indigo-50 dark:bg-[#131724]', glow: 'shadow-[0_0_40px_rgba(79,70,229,0.3)]', line: 'bg-indigo-500', text: 'text-indigo-200' };
      case 'emerald': return { border: 'border-emerald-500/80', bg: 'bg-emerald-50 dark:bg-[#111A18]', glow: 'shadow-[0_0_40px_rgba(16,185,129,0.3)]', line: 'bg-emerald-500', text: 'text-emerald-200' };
      case 'fuchsia': return { border: 'border-fuchsia-500/80', bg: 'bg-fuchsia-50 dark:bg-[#1A121F]', glow: 'shadow-[0_0_40px_rgba(192,38,211,0.3)]', line: 'bg-fuchsia-500', text: 'text-fuchsia-200' };
      case 'blue': return { border: 'border-blue-500/80', bg: 'bg-blue-50 dark:bg-[#111827]', glow: 'shadow-[0_0_40px_rgba(59,130,246,0.3)]', line: 'bg-blue-500', text: 'text-blue-200' };
      case 'amber': return { border: 'border-amber-500/80', bg: 'bg-amber-50 dark:bg-[#1C1917]', glow: 'shadow-[0_0_40px_rgba(245,158,11,0.3)]', line: 'bg-amber-500', text: 'text-amber-200' };
      case 'orange': return { border: 'border-orange-500/80', bg: 'bg-orange-50 dark:bg-[#1C140F]', glow: 'shadow-[0_0_40px_rgba(249,115,22,0.3)]', line: 'bg-orange-500', text: 'text-orange-200' };
      case 'green': return { border: 'border-green-500/80', bg: 'bg-green-50 dark:bg-[#0F1C14]', glow: 'shadow-[0_0_40px_rgba(34,197,94,0.3)]', line: 'bg-green-500', text: 'text-green-200' };
      case 'rose': return { border: 'border-rose-500/80', bg: 'bg-rose-50 dark:bg-[#1C1215]', glow: 'shadow-[0_0_40px_rgba(225,29,72,0.3)]', line: 'bg-rose-500', text: 'text-rose-200' };
      default: return { border: 'border-white/20', bg: 'bg-slate-50 dark:bg-[#0A0C13]', glow: '', line: 'bg-white/20', text: 'text-muted-foreground' };
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

  // Override body overflow for scrolling
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#040609] text-foreground font-sans selection:bg-white/20 overflow-x-hidden flex flex-col relative transition-colors duration-1000">
      
      {/* Subtle background */}
      
      {/* Dynamic Global Background */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 ${globalBackground()} opacity-100`} />

      {/* ━━━ HEADER ━━━ */}
      <header className="w-full pt-6 pb-4 px-6 text-center z-40 select-none shrink-0 relative">
        <div className="flex items-center justify-between w-full max-w-[1440px] mx-auto mb-6">
          <span className="text-white font-black text-[15px] tracking-[0.15em] uppercase" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Hatchin.</span>
          <Link href="/login">
            <a className="text-sm text-white font-semibold transition-all cursor-pointer bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-full">
              Meet Your Team &rarr;
            </a>
          </Link>
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl text-white tracking-tight leading-snug">
          <span className="font-semibold">Every dream needs a team.</span><br/>
          <span className="font-light text-white/70">We built yours.</span>
        </h1>
        <p className="text-sm md:text-base text-white/40 mt-4 max-w-[600px] mx-auto leading-relaxed font-light">AI teammates with real personalities. A PM, an engineer, a designer. They think, remember, and care about your project.</p>
      </header>

      {/* ━━━ UNIFIED BENTO GRID ━━━ */}
      <main className="w-full max-w-[1440px] mx-auto px-4 md:px-6 pb-12 relative z-10 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1.2fr_1fr_1fr] gap-3" style={{ gridAutoRows: '180px' }}>

          {/* ═══ COL 1-2: LEFT USP CARDS ═══ */}

          {/* SPAWN — 2col, 2row (big top-left) */}
          {(() => {
            const usp = USPS[0];
            const isActive = activePanel === usp.id;
            const colors = getColorClasses(usp.color);
            const isAnimating = isActive && isMessageDoneTyping;
            const isShrunk = anyLeftActive && !isActive;
            return (
              <div ref={el => panelRefs.current[usp.id] = el}
                style={{ transform: `scale(${isActive ? 1.08 : isShrunk ? 0.92 : 1})`, zIndex: isActive ? 10 : 1 }}
                className={`lg:col-span-2 p-5 border transition-all duration-700 relative overflow-hidden flex flex-col justify-between rounded-2xl ${isShrunk ? 'opacity-50' : ''} ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#0A0C13]/60 border-white/[0.06] hover:border-white/10 backdrop-blur-sm"}`}>
                <div className={`text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-700 ${isActive ? colors.text : 'text-muted-foreground'}`}>
                  [ {usp.label} ]
                </div>
                <AnimatePresence>
                  {isActive && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`absolute left-0 top-0 bottom-0 w-1 ${colors.line} shadow-[0_0_15px_currentColor] z-20`} />}
                </AnimatePresence>
                <div className="flex-1 flex items-center gap-4 relative mt-1">
                  <div className="flex-1 flex flex-col justify-center">
                    <div className={`text-[17px] font-bold text-white tracking-tight ${isActive ? '' : 'opacity-60'}`}>{usp.title}</div>
                    <p className={`text-[12px] leading-relaxed mt-1.5 ${isActive ? colors.text : 'text-muted-foreground opacity-60'}`}>{renderHighlighted(usp.subtext, isActive ? "white" : "rgb(148,163,184)")}</p>
                  </div>
                  <div className="w-[140px] shrink-0 h-full flex items-center justify-center">{(PREVIEWS as any)[usp.id](isActive, isAnimating)}</div>
                </div>
              </div>
            );
          })()}

          {/* ═══ COL 3: CHAT (spans 4 rows) ═══ */}
          <div className="lg:col-span-1 lg:row-span-3 flex flex-col min-h-0">
            <div ref={chatRef} className="w-full h-full flex flex-col border-2 border-white/60 shadow-[0_0_80px_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.1)] relative rounded-2xl bg-[#080A0F]/95 backdrop-blur-xl overflow-hidden">
              
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-transparent z-20 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center rounded-full">
                    <span className="text-fuchsia-400 text-[9px] font-bold">M</span>
                  </div>
                  <span className="font-bold text-[10px] tracking-widest uppercase text-foreground">Maya</span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-hide z-10 bg-transparent">
                <AnimatePresence initial={false}>
                  {messages.map((msg, index) => (
                    <motion.div key={msg.id}
                      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={`flex flex-col ${msg.role === "user" ? "items-end" : msg.role === "cta" ? "items-center" : "items-start"}`}>
                      {msg.role === "user" ? (
                        <div className="max-w-[90%] px-4 py-3 text-[13px] leading-relaxed bg-white text-black font-semibold border border-white shadow-[0_4px_15px_rgba(255,255,255,0.1)] rounded-xl rounded-tr-sm">
                          {msg.content}
                        </div>
                      ) : msg.role === "cta" ? (
                        <div className="py-4 w-full mt-2">
                          <Link href="/login">
                            <button className="w-full bg-orange-500 hover:bg-orange-400 text-white font-black tracking-[0.15em] uppercase text-[12px] py-4 px-4 transition-all border border-orange-400 shadow-[0_0_40px_rgba(249,115,22,0.3)] hover:shadow-[0_0_60px_rgba(249,115,22,0.5)] rounded-md cursor-pointer">
                                {msg.content}
                            </button>
                          </Link>
                        </div>
                      ) : (
                        <div id={msg.uspId ? `bubble-${msg.uspId}` : undefined}
                          className={`max-w-[95%] border bg-[#0A0C13] p-4 relative overflow-hidden group shadow-xl transition-all duration-700 rounded-xl rounded-tl-sm ${(msg.uspId && activePanel === msg.uspId) ? getColorClasses(USPS.find(u => u.id === msg.uspId)!.color).border : 'border-white/10'}`}>
                          <div className="absolute top-0 left-0 w-1 h-full bg-white/10 group-hover:bg-white/20 transition-colors" />
                          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                            <div className="relative flex items-center justify-center w-2 h-2">
                              <span className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-60" />
                              <span className="relative w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                            </div>
                            Maya
                          </div>
                          <p className="text-[12px] md:text-[13px] leading-relaxed text-foreground font-light">
                            {(msg.role === "hatch" && index === messages.length - 1 && typeof msg.content === 'string') ? (
                              <TypewriterMessage content={msg.content} accentColor={msg.uspId ? USP_ACCENT[msg.uspId] || "#a78bfa" : "#a78bfa"} onComplete={handleMessageTypingComplete} onType={handleTypeScroll} />
                            ) : typeof msg.content === 'string' ? renderHighlighted(msg.content, msg.uspId ? USP_ACCENT[msg.uspId] || "#a78bfa" : "#a78bfa") : msg.content}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="border border-white/10 bg-[#0A0C13] px-4 py-3 flex items-center gap-1.5 h-10 rounded-md shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce delay-75" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce delay-150" />
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-transparent shrink-0 z-20 border-t border-white/10 pb-5 backdrop-blur-md">
                {appState === "awaiting_name" ? (
                  <div className="relative p-[1px] rounded-lg bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-emerald-500 animate-[pulse_3s_ease-in-out_infinite] shadow-[0_0_30px_rgba(192,38,211,0.2)]">
                    <div className="relative bg-[#080A0F] rounded-md overflow-hidden">
                      <input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="What should we call you?" 
                        className="w-full bg-transparent border-none py-4 pl-4 pr-16 text-[13px] text-white placeholder-slate-500 focus:outline-none" autoFocus />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button onClick={() => handleNameSubmit("Builder")}
                          className="text-[10px] text-muted-foreground hover:text-white font-medium transition-colors cursor-pointer">
                          Skip
                        </button>
                        <button onClick={() => handleNameSubmit()}
                          className="px-3 py-2 bg-white flex items-center justify-center text-black hover:bg-slate-200 text-[10px] font-bold uppercase transition-colors rounded-sm cursor-pointer">
                          Enter
                        </button>
                      </div>
                    </div>
                  </div>
                ) : appState === "awaiting_preset" ? (
                  <div className="space-y-2">
                    <button onClick={() => handlePresetClick('no-team', "I have something to build, but no team.")} className="w-full text-left px-4 py-3 border border-white/10 hover:border-indigo-500 text-[12px] font-medium text-foreground hover:text-white hover:bg-indigo-500/10 transition-all shadow-sm rounded-md cursor-pointer">
                      "I have something to build, but no team."
                    </button>
                    <button onClick={() => handlePresetClick('impossible', "I've been trying to do it all alone.")} className="w-full text-left px-4 py-3 border border-white/10 hover:border-emerald-500 text-[12px] font-medium text-foreground hover:text-white hover:bg-emerald-500/10 transition-all shadow-sm rounded-md cursor-pointer">
                      "I've been trying to do it all alone."
                    </button>
                    <button onClick={() => handlePresetClick('no-idea', "I'm curious. Show me what they can do.")} className="w-full text-left px-4 py-3 border border-white/10 hover:border-fuchsia-500 text-[12px] font-medium text-foreground hover:text-white hover:bg-fuchsia-500/10 transition-all shadow-sm rounded-md cursor-pointer">
                      "I'm curious. Show me what they can do."
                    </button>
                  </div>
                ) : appState === "awaiting_next" ? (
                  <div className="flex flex-col items-center gap-2">
                    <motion.button initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                      onClick={handleNextClick}
                      className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_50px_rgba(249,115,22,0.5)] rounded-md cursor-pointer">
                      CONTINUE <span className="text-white font-bold text-sm">&rarr;</span>
                    </motion.button>
                    <Link href="/login">
                      <span className="text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer">
                        Skip, just let me sign up
                      </span>
                    </Link>
                  </div>
                ) : (
                  <div className="relative border border-white/5 bg-[#080A0F] py-3.5 px-4 flex items-center justify-center gap-2 opacity-60 rounded-md">
                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Processing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ COL 4-5: RIGHT USP CARDS ═══ */}

          {/* ROLES */}
          {(() => {
            const usp = USPS[1];
            const isActive = activePanel === usp.id;
            const colors = getColorClasses(usp.color);
            const isAnimating = isActive && isMessageDoneTyping;
            const isShrunk = anyRightActive && !isActive;
            return (
              <div ref={el => panelRefs.current[usp.id] = el}
                style={{ transform: `scale(${isActive ? 1.08 : isShrunk ? 0.92 : 1})`, zIndex: isActive ? 10 : 1 }}
                className={`lg:row-span-2 p-6 border transition-all duration-700 relative overflow-hidden flex flex-col justify-center rounded-2xl ${isShrunk ? 'opacity-50' : ''} ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#0A0C13]/60 border-white/[0.06] hover:border-white/10 backdrop-blur-sm"}`}>
                <div className={`absolute top-2 right-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-700 ${isActive ? colors.text : 'text-muted-foreground'} z-20`}>[ {usp.label} ]</div>
                <AnimatePresence>{isActive && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`absolute right-0 top-0 bottom-0 w-1 ${colors.line} shadow-[0_0_15px_currentColor] z-20`} />}</AnimatePresence>
                <div className="flex-1 flex items-center justify-center">{(PREVIEWS as any)[usp.id](isActive, isAnimating)}</div>
                <div className={`transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  <div className="text-[17px] font-bold text-white tracking-tight">{usp.title}</div>
                  <p className={`text-[12px] leading-relaxed mt-1 ${isActive ? colors.text : 'text-muted-foreground'}`}>{renderHighlighted(usp.subtext, isActive ? "white" : "rgb(148,163,184)")}</p>
                </div>
              </div>
            );
          })()}

                    {/* === ROW 2 LEFT: ROLES + SYNC === */}

          {/* PATIENCE */}
          {(() => {
            const usp = USPS[4];
            const isActive = activePanel === usp.id;
            const colors = getColorClasses(usp.color);
            const isAnimating = isActive && isMessageDoneTyping;
            const isShrunk = anyRightActive && !isActive;
            return (
              <div ref={el => panelRefs.current[usp.id] = el}
                style={{ transform: `scale(${isActive ? 1.08 : isShrunk ? 0.92 : 1})`, zIndex: isActive ? 10 : 1 }}
                className={`lg:row-span-2 p-5 border transition-all duration-700 relative overflow-hidden flex flex-col justify-center rounded-2xl ${isShrunk ? 'opacity-50' : ''} ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#0A0C13]/60 border-white/[0.06] hover:border-white/10 backdrop-blur-sm"}`}>
                <div className={`absolute top-2 right-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-700 ${isActive ? colors.text : 'text-muted-foreground'} z-20`}>[ {usp.label} ]</div>
                <AnimatePresence>{isActive && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`absolute right-0 top-0 bottom-0 w-1 ${colors.line} shadow-[0_0_15px_currentColor] z-20`} />}</AnimatePresence>
                <div className="flex-1 flex items-center justify-center">{(PREVIEWS as any)[usp.id](isActive, isAnimating)}</div>
                <div className={`transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  <div className="text-[17px] font-bold text-white tracking-tight">{usp.title}</div>
                  <p className={`text-[12px] leading-relaxed mt-1 ${isActive ? colors.text : 'text-muted-foreground'}`}>{renderHighlighted(usp.subtext, isActive ? "white" : "rgb(148,163,184)")}</p>
                </div>
              </div>
            );
          })()}



          {/* SYNC — 2col wide, LEFT side */}
          {(() => {
            const usp = USPS[2];
            const isActive = activePanel === usp.id;
            const colors = getColorClasses(usp.color);
            const isAnimating = isActive && isMessageDoneTyping;
            const isShrunk = anyLeftActive && !isActive;
            return (
              <div ref={el => panelRefs.current[usp.id] = el}
                style={{ transform: `scale(${isActive ? 1.08 : isShrunk ? 0.92 : 1})`, zIndex: isActive ? 10 : 1 }}
                className={`lg:col-span-2 p-5 border transition-all duration-700 relative overflow-hidden flex items-center gap-4 rounded-2xl ${isShrunk ? 'opacity-50' : ''} ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#0A0C13]/60 border-white/[0.06] hover:border-white/10 backdrop-blur-sm"}`}>
                <div className={`absolute top-2 left-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-700 ${isActive ? colors.text : 'text-muted-foreground'} z-20`}>[ {usp.label} ]</div>
                <AnimatePresence>{isActive && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`absolute left-0 top-0 bottom-0 w-1 ${colors.line} shadow-[0_0_15px_currentColor] z-20`} />}</AnimatePresence>
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`text-[17px] font-bold text-white tracking-tight ${isActive ? '' : 'opacity-60'}`}>{usp.title}</div>
                  <p className={`text-[12px] leading-relaxed mt-1 ${isActive ? colors.text : 'text-muted-foreground opacity-60'}`}>{renderHighlighted(usp.subtext, isActive ? "white" : "rgb(148,163,184)")}</p>
                </div>
                <div className="w-[100px] shrink-0 h-full flex items-center justify-center">{(PREVIEWS as any)[usp.id](isActive, isAnimating)}</div>
              </div>
            );
          })()}

                    {/* === ROW 3: AUTO + ALONE (wide bottom) === */}

          {/* AUTO — 2col wide */}
          {(() => {
            const usp = USPS[3];
            const isActive = activePanel === usp.id;
            const colors = getColorClasses(usp.color);
            const isAnimating = isActive && isMessageDoneTyping;
            const isShrunk = anyLeftActive && !isActive;
            return (
              <div ref={el => panelRefs.current[usp.id] = el}
                style={{ transform: `scale(${isActive ? 1.08 : isShrunk ? 0.92 : 1})`, zIndex: isActive ? 10 : 1 }}
                className={`lg:col-span-2 p-6 border transition-all duration-700 relative overflow-hidden flex items-center gap-4 rounded-2xl ${isShrunk ? 'opacity-50' : ''} ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#0A0C13]/60 border-white/[0.06] hover:border-white/10 backdrop-blur-sm"}`}>
                <div className={`absolute top-2 left-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-700 ${isActive ? colors.text : 'text-muted-foreground'} z-20`}>[ {usp.label} ]</div>
                <AnimatePresence>{isActive && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`absolute left-0 top-0 bottom-0 w-1 ${colors.line} shadow-[0_0_15px_currentColor] z-20`} />}</AnimatePresence>
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`text-[18px] font-bold text-white tracking-tight ${isActive ? '' : 'opacity-60'}`}>{usp.title}</div>
                  <p className={`text-[13px] leading-relaxed mt-1.5 ${isActive ? colors.text : 'text-muted-foreground opacity-60'}`}>{renderHighlighted(usp.subtext, isActive ? "white" : "rgb(148,163,184)")}</p>
                </div>
                <div className="w-[160px] shrink-0 h-full">{(PREVIEWS as any)[usp.id](isActive, isAnimating)}</div>
              </div>
            );
          })()}

          {/* ALONE — 2col wide */}
          {(() => {
            const usp = USPS[7];
            const isActive = activePanel === usp.id;
            const colors = getColorClasses(usp.color);
            const isAnimating = isActive && isMessageDoneTyping;
            const isShrunk = anyRightActive && !isActive;
            return (
              <div ref={el => panelRefs.current[usp.id] = el}
                style={{ transform: `scale(${isActive ? 1.08 : isShrunk ? 0.92 : 1})`, zIndex: isActive ? 10 : 1 }}
                className={`lg:col-span-2 p-6 border transition-all duration-700 relative overflow-hidden flex items-center gap-4 rounded-2xl ${isShrunk ? 'opacity-50' : ''} ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#0A0C13]/60 border-white/[0.06] hover:border-white/10 backdrop-blur-sm"}`}>
                <div className={`absolute top-2 right-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-700 ${isActive ? colors.text : 'text-muted-foreground'} z-20`}>[ {usp.label} ]</div>
                <AnimatePresence>{isActive && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`absolute right-0 top-0 bottom-0 w-1 ${colors.line} shadow-[0_0_15px_currentColor] z-20`} />}</AnimatePresence>
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`text-[18px] font-bold text-white tracking-tight ${isActive ? '' : 'opacity-60'}`}>{usp.title}</div>
                  <p className={`text-[13px] leading-relaxed mt-1.5 ${isActive ? colors.text : 'text-muted-foreground opacity-60'}`}>{renderHighlighted(usp.subtext, isActive ? "white" : "rgb(148,163,184)")}</p>
                </div>
                <div className="w-[120px] shrink-0 h-full flex items-center justify-center">{(PREVIEWS as any)[usp.id](isActive, isAnimating)}</div>
              </div>
            );
          })()}

        </div>
      </main>

      {/* SVG Connecting Line */}
      <AnimatePresence>
        {connectionCoords && ( 
          <motion.svg initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[100] w-full h-full overflow-visible">
            <motion.path 
              d={`M ${connectionCoords.x1} ${connectionCoords.y1} C ${connectionCoords.x1 + (connectionCoords.isLeft ? -120 : 120)} ${connectionCoords.y1}, ${connectionCoords.x2 + (connectionCoords.isLeft ? 120 : -120)} ${connectionCoords.y2}, ${connectionCoords.x2} ${connectionCoords.y2}`}
              fill="none" stroke={connectionCoords.colorHex} strokeWidth="2"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: "easeInOut" }} />
            <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 }}
              cx={connectionCoords.x2} cy={connectionCoords.y2} r="5" fill={connectionCoords.colorHex} className="shadow-[0_0_10px_currentColor]" />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Bottom CTA */}
      <section className="w-full max-w-[800px] mx-auto px-6 py-16 text-center relative z-10">
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-3 tracking-tight">
          Every dream needs a team.
        </h2>
        <p className="text-white/60 text-lg mb-2">
          Yours is already here.
        </p>
        <p className="text-white/40 text-sm mb-2">
          AI teammates who think, remember, and never stop caring about your project.
        </p>
        <p className="text-muted-foreground text-[13px] mb-8">
          Your team is one click away.
        </p>
        <Link href="/login">
          <button className="bg-orange-500 hover:bg-orange-400 text-white font-black tracking-[0.15em] uppercase text-[13px] py-5 px-12 transition-all border border-orange-400 shadow-[0_0_40px_rgba(249,115,22,0.25)] hover:shadow-[0_0_60px_rgba(249,115,22,0.45)] rounded-xl cursor-pointer">
            Meet Your Team &rarr;
          </button>
        </Link>
      </section>

    </div>
  );
}
