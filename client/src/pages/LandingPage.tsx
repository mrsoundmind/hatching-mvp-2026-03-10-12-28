import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles";
import LandingBento from "@/components/LandingBento";
import { TestimonialShowcase } from "@/components/ui/testimonial-showcase";
import HowItWorksBento from "@/components/ui/how-it-works-bento";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const avatarFor = (seed: string) =>
  `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=fef3c7,fed7aa,fde68a,fee2e2,e0e7ff,dbeafe`;

const hatchinTestimonials = [
  { id: "sam", quote: "Maya rewrote my entire product strategy in one conversation. First time I felt like I had a real team.", author: { name: "Sam K.", title: "Founder, SaaS", avatar: avatarFor("Sam K") } },
  { id: "li", quote: "I told Drew about a bug at midnight. Woke up to a fixed architecture doc and three options.", author: { name: "Li W.", title: "Solo developer", avatar: avatarFor("Li W") } },
  { id: "priya", quote: "Zara argued with me about my color palette for 20 minutes. She was right. My page converts 3x better now.", author: { name: "Priya R.", title: "Indie maker", avatar: avatarFor("Priya R") } },
  { id: "rachel", quote: "Alex shipped a roadmap in an hour that would've taken me a week. They actually disagree with me when I'm wrong.", author: { name: "Rachel M.", title: "Founder", avatar: avatarFor("Rachel M") } },
  { id: "marco", quote: "Having Kai run growth experiments while I sleep feels illegal. I come back to real results.", author: { name: "Marco T.", title: "Bootstrapped founder", avatar: avatarFor("Marco T") } },
  { id: "ines", quote: "The handoffs between my Hatches are wild. Engineer finishes a spec, designer picks it up.", author: { name: "Ines K.", title: "Indie hacker", avatar: avatarFor("Ines K") } },
  { id: "david", quote: "I stopped using five different AI tools. One team, one project, they remember everything.", author: { name: "David P.", title: "Product builder", avatar: avatarFor("David P") } },
  { id: "jenna", quote: "Mira rewrote my copy and it finally sounds like me instead of a robot. My open rates doubled.", author: { name: "Jenna L.", title: "Newsletter founder", avatar: avatarFor("Jenna L") } },
  { id: "omar", quote: "Launched my side project in a weekend with a full team of Hatches. Nothing else feels like this.", author: { name: "Omar B.", title: "Weekend builder", avatar: avatarFor("Omar B") } },
];

export default function LandingPage() {
  const footerRef = useRef<HTMLElement | null>(null);
  const gradientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [footerVisible, setFooterVisible] = useState(false);

  // Reset scroll + body overflow on mount
  useEffect(() => {
    if (history.scrollRestoration) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Scroll-triggered reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Trigger footer entrance animations when footer enters viewport
  useEffect(() => {
    const node = footerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setFooterVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.28 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Animated gradient canvas (Waitlister-style ambient glow)
  useEffect(() => {
    const canvas = gradientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let start = performance.now();
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);

      const blobs = [
        { bx: 0.39, by: 0.66, r: Math.min(width * 0.46, 470), color: "rgba(44, 144, 255, 0.32)", sx: 0.14, sy: 0.09, phase: 0.2 },
        { bx: 0.55, by: 0.65, r: Math.min(width * 0.5, 520), color: "rgba(106, 84, 255, 0.34)", sx: 0.11, sy: 0.075, phase: 1.7 },
        { bx: 0.69, by: 0.66, r: Math.min(width * 0.44, 450), color: "rgba(35, 201, 255, 0.26)", sx: 0.16, sy: 0.095, phase: 2.9 },
      ];

      for (const b of blobs) {
        const cx = (b.bx + Math.sin(t * b.sx * Math.PI * 2 + b.phase) * 0.035) * width;
        const cy = (b.by + Math.cos(t * b.sy * Math.PI * 2 + b.phase) * 0.02) * height;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r);
        grad.addColorStop(0, b.color);
        grad.addColorStop(1, "rgba(10, 12, 19, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      const pulse = 0.2 + (Math.sin(t * 1.35) + 1) * 0.11;
      const core = ctx.createRadialGradient(width * 0.5, height * 0.73, 0, width * 0.5, height * 0.73, Math.min(width * 0.34, 360));
      core.addColorStop(0, `rgba(255, 255, 255, ${pulse.toFixed(3)})`);
      core.addColorStop(1, "rgba(10, 12, 19, 0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, width, height);

      rafId = window.requestAnimationFrame(draw);
    };

    resize();
    rafId = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Particle canvas (twinkling star field)
  useEffect(() => {
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let start = performance.now();
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: Array<{ x: number; y: number; r: number; a: number; tw: number; phase: number; drift: number }> = [];

    const seedStars = () => {
      const count = Math.max(35, Math.floor((width * height) / 32000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() < 0.92 ? 0.35 + Math.random() * 0.4 : 0.75 + Math.random() * 0.5,
        a: 0.05 + Math.random() * 0.18,
        tw: 0.8 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.55,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedStars();
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const alpha = s.a + Math.sin(t * s.tw + s.phase) * 0.14;
        const x = (s.x + Math.sin(t * s.drift + s.phase) * 8 + width) % width;
        const y = (s.y + Math.cos(t * (s.drift * 0.65) + s.phase) * 2.6 + height) % height;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(187, 215, 255, ${Math.max(0.02, Math.min(0.45, alpha)).toFixed(3)})`;
        ctx.fill();
      }
      rafId = window.requestAnimationFrame(draw);
    };

    resize();
    rafId = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="w-full min-h-screen font-sans relative" style={{ background: '#0A0C13', overflowClipMargin: 'content-box', overflowX: 'clip' as any }}>

      {/* ━━━ GLOBAL GRAIN OVERLAY ━━━ */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.45 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "220px 220px",
          mixBlendMode: "screen",
        }}
      />

      {/* ━━━ HERO ━━━ */}
      <section className="relative min-h-screen overflow-hidden flex-shrink-0">

        {/* Full-screen video */}
        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
            type="video/mp4"
          />
        </video>

        {/* Edge blend — fade bottom of video into dark bg below */}
        <div
          className="absolute inset-x-0 bottom-0 h-64 z-[1] pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,12,19,0) 0%, rgba(10,12,19,0.35) 50%, rgba(10,12,19,0.85) 85%, #0A0C13 100%)",
          }}
        />

        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-5 py-5 md:px-8 md:py-6 max-w-7xl mx-auto">
          <span
            className="text-[22px] md:text-[28px] tracking-tight text-white"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Hatchin<sup className="text-[10px] align-super ml-0.5">®</sup>
          </span>

          <div className="hidden md:flex items-center gap-8">
            {["Product", "Pricing", "About"].map((link) => (
              <a key={link} href="#" className="text-sm text-white/55 hover:text-white transition-colors">
                {link}
              </a>
            ))}
          </div>

          <Link href="/login">
            <button className="liquid-glass rounded-full px-4 py-1.5 text-[13px] md:px-5 md:py-2 md:text-sm text-white hover:scale-[1.03] transition-transform cursor-pointer">
              Get Started
            </button>
          </Link>
        </nav>

        {/* Hero copy */}
        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-12 pb-32 sm:pt-16 sm:pb-48 md:px-6 md:pt-20 md:pb-64">
          <h1
            className="animate-fade-rise text-[32px] sm:text-5xl md:text-6xl leading-[1.08] tracking-[-1px] md:tracking-[-1.5px] max-w-4xl font-semibold text-white"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Where{' '}
            <em className="not-italic" style={{ color: 'rgba(255,255,255,0.38)' }}>great ideas</em>{' '}
            find{' '}
            <em className="not-italic" style={{ color: 'rgba(255,255,255,0.38)' }}>the team to build them.</em>
          </h1>

          <p className="animate-fade-rise-delay text-[15px] sm:text-lg max-w-xl mt-6 md:mt-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            AI teammates with real personalities — a PM, an engineer, a designer.
            They think, remember, and care about your project.
          </p>

          <Link href="/login">
            <button className="animate-fade-rise-delay-2 liquid-glass rounded-full px-8 py-3.5 text-[15px] md:px-14 md:py-5 md:text-base text-white mt-8 md:mt-12 hover:scale-[1.03] transition-transform cursor-pointer">
              Meet Your Team →
            </button>
          </Link>

          {/* Scroll indicator */}
          <div className="animate-fade-rise-delay-3 mt-16 flex flex-col items-center gap-2" style={{ color: 'rgba(255,255,255,0.28)' }}>
            <span className="text-[10px] tracking-[0.22em] uppercase">Scroll to explore</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ━━━ SPARKLES TRANSITION ━━━ */}
      <div className="relative w-full h-[200px] -mt-16 z-[5]">
        <Sparkles
          className="absolute inset-0 w-full h-full"
          density={400}
          size={1.4}
          speed={0.8}
          opacity={0.6}
          color="#ffffff"
          background="transparent"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0A0C13] to-transparent" />
      </div>

      {/* ━━━ BENTO GRID ━━━ */}
      <LandingBento />

      {/* ━━━ WHITE CARD RISES FROM DARK ━━━ */}
      <div className="bright-section-start w-full pb-0">

        {/* Social Proof */}
        <section className="w-full max-w-[1000px] mx-auto px-6 pt-14 pb-10 md:pt-20 md:pb-14 scroll-reveal">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-4xl font-semibold text-white mb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Real builders. Real results.
            </h2>
            <p className="text-white/50 text-base max-w-md mx-auto leading-relaxed">
              From solo founders to indie makers — here's what it's like to actually have a team.
            </p>
          </div>
          <TestimonialShowcase testimonials={hatchinTestimonials} />
        </section>

        {/* How It Works */}
        <section className="w-full max-w-[1200px] mx-auto px-6 pt-10 pb-20 md:pt-14 md:pb-28 scroll-reveal">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-semibold text-white mb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
              How it works.
            </h2>
            <p className="text-white/50 text-base max-w-md mx-auto leading-relaxed">
              From idea to a working team in under a minute. No setup. No configuration. Just build.
            </p>
          </div>
          <HowItWorksBento />
        </section>

      </div>{/* end bright-section-start */}

      {/* ━━━ DARK SECTION (FAQ + PRICING) — card cutout + parallax ━━━ */}
      <div className="dark-section-start w-full relative">

        {/* FAQ — brutalist unit numbering */}
        <section className="w-full max-w-[760px] mx-auto px-6 pt-20 pb-12 md:pt-28 md:pb-16 scroll-reveal">
          <div className="text-center mb-14">
            <div className="brutalist-mono text-[10px] text-white/40 tracking-[0.25em] uppercase mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-white/15" />
              <span>02 — FAQ</span>
              <span className="h-px w-8 bg-white/15" />
            </div>
            <h2 className="text-2xl md:text-4xl font-semibold text-white mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Good questions.
            </h2>
            <p className="text-white/50 text-base max-w-sm mx-auto leading-relaxed">
              The things people wonder before they meet their team.
            </p>
          </div>
          <Accordion
            type="single"
            collapsible
            className="w-full border border-white/10 bg-white/[0.02] backdrop-blur-sm"
          >
            {[
              { id: "faq-1", num: "Q.01", q: "How is this different from ChatGPT?", a: "ChatGPT is a chatbot. Hatchin is a team. Your teammates remember everything, have distinct expertise, disagree with each other, and work together on your project across conversations. They're not answering prompts. They're building with you." },
              { id: "faq-2", num: "Q.02", q: "Is my project data secure?", a: "Your data stays yours. We use encrypted connections, never train on your conversations, and you can delete everything at any time." },
              { id: "faq-3", num: "Q.03", q: "What does it cost?", a: "Free to start. No credit card, no trial expiration. Build with your team and decide if you want more." },
              { id: "faq-4", num: "Q.04", q: "Can AI really replace a team?", a: "They're not replacing humans. They're the team you don't have yet. Real opinions, real memory, real collaboration. Enough to get from idea to something you can show the world." },
              { id: "faq-5", num: "Q.05", q: "What if I don't like it?", a: "Then you leave. No contracts, no lock-in, no guilt. But most people don't leave, because their team remembers them when they come back." },
            ].map((faq) => (
              <AccordionItem key={faq.id} value={faq.id} className="border-white/10 border-dashed last:border-b-0 px-5 md:px-6">
                <AccordionTrigger className="cursor-pointer text-left hover:no-underline py-5">
                  <div className="flex items-start gap-4 md:gap-5 flex-1">
                    <span className="brutalist-mono text-[11px] tracking-[0.15em] text-[#fb923c] mt-0.5 shrink-0">{faq.num}</span>
                    <span className="text-[14px] font-semibold text-white leading-snug">{faq.q}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-[13px] text-white/60 leading-relaxed pl-[56px] md:pl-[60px] pb-4">{faq.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="text-[13px] text-white/50 mt-6 text-center">
            Still wondering something?{" "}
            <Link href="/login" className="text-orange-400 font-medium hover:underline">
              just start — Maya will walk you through it
            </Link>
          </p>
        </section>

        {/* Pricing — brutalist spec-sheet */}
        <section className="w-full max-w-[980px] mx-auto px-6 pt-10 pb-20 md:pt-16 md:pb-28 scroll-reveal">
          <div className="text-center mb-14">
            <div className="brutalist-mono text-[10px] text-white/40 tracking-[0.25em] uppercase mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-white/15" />
              <span>03 — PRICING</span>
              <span className="h-px w-8 bg-white/15" />
            </div>
            <h2 className="text-2xl md:text-4xl font-semibold text-white mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Simple pricing.
            </h2>
            <p className="text-white/50 text-base max-w-sm mx-auto leading-relaxed">
              Start free. Upgrade when you're ready to go faster.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* FREE / HATCHER */}
            <div className="brutalist-card relative bg-[#08090E] border border-white/[0.12]">
              <div className="brutalist-mono flex justify-between px-5 py-3 border-b border-white/[0.08] text-[10px] tracking-[0.15em] text-white/40 uppercase">
                <span>TIER 01</span>
                <span>SKU: HATCHIN-FREE</span>
              </div>
              <div className="p-6 md:p-7">
                <h3 className="text-[22px] md:text-[26px] font-bold tracking-[-0.02em] text-white uppercase mb-5">Hatcher</h3>
                <div className="brutalist-mono flex items-baseline gap-2 mb-1">
                  <span className="text-[34px] md:text-[40px] font-bold tracking-[-0.02em] text-white">$0.00</span>
                  <span className="text-[11px] text-white/40 tracking-[0.15em] uppercase">USD / MO</span>
                </div>
                <div className="brutalist-mono text-[10px] tracking-[0.18em] text-white/35 uppercase pb-5 mb-5 border-b border-white/[0.08]">
                  BILLING: NONE / FOR: SOLO BUILDERS
                </div>
                <div className="grid gap-px bg-white/[0.08] mb-6">
                  {[
                    "Unlimited messages",
                    "3 projects",
                    "All 30 teammates",
                    "Pro AI model",
                    "Real-time chat",
                    "Automatic task detection",
                  ].map((f) => (
                    <div key={f} className="brutalist-mono flex items-center gap-3 bg-[#08090E] px-4 py-2.5 text-[11px] tracking-[0.05em] text-white/65 uppercase">
                      <span className="text-[#f97316] font-bold tracking-normal">&gt;&gt;&gt;</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/login">
                  <button className="brutalist-mono w-full py-3.5 border border-white text-white text-[11px] tracking-[0.25em] uppercase hover:bg-white hover:text-[#0A0C13] transition-colors cursor-pointer">
                    Deploy → Free
                  </button>
                </Link>
              </div>
            </div>

            {/* PRO */}
            <div className="brutalist-card relative bg-[#08090E] border border-[#f97316]">
              <div className="brutalist-mono bg-[#f97316] text-white flex justify-between px-5 py-2 text-[10px] tracking-[0.22em] uppercase">
                <span>[ RECOMMENDED / UNIT-02 ]</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  OPERATIONAL
                </span>
              </div>
              <div className="brutalist-mono flex justify-between px-5 py-3 border-b border-white/[0.08] text-[10px] tracking-[0.15em] text-white/40 uppercase">
                <span>TIER 02</span>
                <span>SKU: HATCHIN-PRO</span>
              </div>
              <div className="p-6 md:p-7">
                <h3 className="text-[22px] md:text-[26px] font-bold tracking-[-0.02em] text-white uppercase mb-5">Pro</h3>
                <div className="brutalist-mono flex items-baseline gap-2 mb-1">
                  <span className="text-[34px] md:text-[40px] font-bold tracking-[-0.02em] text-white">$19.00</span>
                  <span className="text-[11px] text-white/40 tracking-[0.15em] uppercase">USD / MO</span>
                </div>
                <div className="brutalist-mono text-[10px] tracking-[0.18em] text-white/35 uppercase pb-5 mb-5 border-b border-white/[0.08]">
                  BILLING: CONTINUOUS / ANNUAL: $190 (-17%)
                </div>
                <div className="grid gap-px bg-white/[0.08] mb-6">
                  {[
                    "Unlimited everything",
                    "All 30 teammates",
                    "Pro AI model",
                    "Full autonomous execution",
                    "50 background exec / day",
                    "Peer review + safety gates",
                  ].map((f) => (
                    <div key={f} className="brutalist-mono flex items-center gap-3 bg-[#08090E] px-4 py-2.5 text-[11px] tracking-[0.05em] text-white/65 uppercase">
                      <span className="text-[#f97316] font-bold tracking-normal">&gt;&gt;&gt;</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/login">
                  <button className="brutalist-mono w-full py-3.5 bg-[#f97316] hover:bg-[#fb923c] text-white text-[11px] tracking-[0.25em] uppercase transition-colors cursor-pointer">
                    Deploy → Pro
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>{/* end dark-section-start */}

      {/* ━━━ WAITLISTER-STYLE FOOTER ━━━ */}
      <section
        ref={footerRef}
        className="relative w-full overflow-hidden bg-[#0A0C13]"
        style={{ fontFamily: "'Inter', 'Inter Placeholder', sans-serif" }}
      >
        {/* Layered animated background */}
        <div className="pointer-events-none absolute inset-0">
          <canvas ref={gradientCanvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,88,170,0.06)_0%,rgba(73,77,183,0.13)_50%,rgba(16,142,171,0.08)_100%)] mix-blend-screen" />
          <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,#0A0C13_0%,rgba(10,12,19,0)_100%)]" />
          <div className="absolute left-0 top-0 h-full w-1/2 bg-[linear-gradient(90deg,#0A0C13_0%,rgba(10,12,19,0)_100%)]" />
          <div className="absolute right-0 top-0 h-full w-1/2 bg-[linear-gradient(270deg,#0A0C13_0%,rgba(10,12,19,0)_100%)]" />

          <canvas ref={particlesCanvasRef} className="absolute inset-x-0 top-0 h-[72%] w-full" />

          <div
            className="waitlister-aurora-layer absolute left-1/2 bottom-[265px] h-[111px] w-[787px] max-w-[92vw] -translate-x-1/2 blur-[57px]"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0.5) 0%, rgba(10, 12, 19, 0) 100%)",
            }}
          />
          <div className="absolute left-1/2 -bottom-[662px] h-[955px] w-[2086px] -translate-x-1/2 rounded-[100%] bg-[linear-gradient(180deg,#ffffff_0%,rgba(10,12,19,0)_100%)]" />
          <div className="waitlister-horizon-layer absolute left-1/2 -bottom-[668px] h-[956px] w-[2242px] -translate-x-1/2 rounded-[100%] bg-[#0A0C13] shadow-[inset_0_2px_20px_rgb(255,255,255),0_-10px_50px_1px_rgba(255,255,255,0.49)]" />
        </div>

        <div className="relative z-10 flex h-screen min-h-[720px] w-full flex-col items-center justify-center px-6 pt-20 pb-24 md:pt-24 md:pb-28">
          <div className={`${footerVisible ? "waitlister-enter-pop waitlister-delay-1" : "waitlister-preenter"} mb-8 flex items-center rounded-full bg-[rgba(255,255,255,0.08)] px-4 py-1.5`}>
            <p className="text-[14px] font-medium leading-[16.8px] tracking-[-0.03em] text-[#F0F0F0]">Hatchin</p>
            <p className="mx-2 text-[14px] font-light leading-[16.8px] tracking-[-0.02em] text-[rgba(255,255,255,0.6)]">✦</p>
            <p className="text-[14px] font-medium leading-[16.8px] tracking-[-0.03em] text-[#F0F0F0]">Now in Early Access</p>
          </div>

          <h2 className={`${footerVisible ? "waitlister-enter-pop waitlister-delay-2" : "waitlister-preenter"} w-full max-w-[326px] text-center text-[34px] font-medium leading-[38px] tracking-[-0.05em] text-[#F0F0F0] sm:text-[40px] sm:leading-[44px] md:max-w-[560px] md:text-[60px] md:leading-[66px]`}>
            Meet your team.{" "}
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400 }}>
              Ship what you imagine.
            </span>
          </h2>

          <p className={`${footerVisible ? "waitlister-enter-pop waitlister-delay-3" : "waitlister-preenter"} mt-4 w-full max-w-[302px] text-center text-[15px] font-normal leading-[22px] tracking-[-0.04em] text-[rgba(255,255,255,0.56)] sm:text-[16px] sm:leading-[24px] md:max-w-[440px]`}>
            Thirty AI teammates with real personalities — a PM, an engineer, a designer. They think, remember, and care about your project.
          </p>

          <a
            href="/login"
            className={`${footerVisible ? "waitlister-enter-fade waitlister-delay-4" : "waitlister-preenter-fade"} mt-8 inline-flex h-[52px] items-center justify-center rounded-[10px] bg-[#F0F0F0] px-7 text-[15px] font-medium tracking-[-0.02em] text-[#0A0C13] no-underline transition-all duration-300 ease-out hover:bg-white hover:scale-[1.02] active:scale-[0.98]`}
          >
            Start Building — It's Free
            <span className="ml-2">→</span>
          </a>
        </div>

        <div className="relative z-20 flex min-h-[62px] w-full items-center justify-center border-t border-[rgba(255,255,255,0.08)] px-6 py-4 md:py-0">
          <div className={`${footerVisible ? "waitlister-enter-fade waitlister-delay-4" : "waitlister-preenter-fade"} flex flex-col items-center justify-center gap-3 text-[12px] font-normal leading-[14.4px] tracking-[-0.04em] text-[#999999] md:flex-row md:gap-3`}>
            <p>
              Proudly Built In{" "}
              <a href="/" className="text-white no-underline transition-colors duration-300 ease-out hover:text-[rgba(255,255,255,0.56)]">Hatchin</a>
            </p>
            <p className="font-light tracking-[-0.02em]">•</p>
            <p>
              Created by{" "}
              <a href="mailto:hello@hatchin.ai" className="text-white no-underline transition-colors duration-300 ease-out hover:text-[rgba(255,255,255,0.56)]">the Hatchin team</a>
            </p>
            <p className="font-light tracking-[-0.02em]">•</p>
            <a href="/legal/privacy" className="text-white no-underline transition-colors duration-300 ease-out hover:text-[rgba(255,255,255,0.56)]">Privacy</a>
            <p className="font-light tracking-[-0.02em]">•</p>
            <a href="/legal/terms" className="text-white no-underline transition-colors duration-300 ease-out hover:text-[rgba(255,255,255,0.56)]">Terms</a>
          </div>
        </div>
      </section>

    </div>
  );
}
