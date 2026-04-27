import { motion } from "motion/react";
import { Sparkles, ArrowUp, Check, Wrench, Palette, BarChart3 } from "lucide-react";

const notionist = (seed: string) =>
  `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=fef3c7,fed7aa,fde68a,fee2e2,e0e7ff,dbeafe,dcfce7&radius=50`;

function StepBadge({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-full border border-orange-400/60 bg-orange-500/10 flex items-center justify-center">
        <span className="text-orange-400 font-bold text-xs">{n}</span>
      </div>
      <h3 className="text-[15px] font-semibold text-white">{title}</h3>
    </div>
  );
}

function Card1() {
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 overflow-hidden h-full">
      <StepBadge n={1} title="Tell Maya your idea" />
      <p className="text-[13px] text-white/55 leading-relaxed mb-5">
        Describe what you're building. She asks the hard questions and shapes it into something real.
      </p>

      <div className="space-y-3">
        <motion.div
          initial={{ opacity: 0, y: 6, x: 12 }}
          whileInView={{ opacity: 1, y: 0, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start gap-2.5 ml-auto max-w-[85%] justify-end"
        >
          <div className="rounded-2xl rounded-tr-sm bg-orange-500 text-white px-3.5 py-2 text-[12px] leading-relaxed shadow-sm">
            I want to build a tool for indie makers to ship faster.
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6, x: -12 }}
          whileInView={{ opacity: 1, y: 0, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start gap-2.5"
        >
          <img src={notionist("Maya")} alt="Maya" className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/10 px-3.5 py-2 text-[12px] leading-relaxed text-white/80">
            Love it. Who are you building this for — first-time founders or repeat?
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.0, duration: 0.3 }}
          className="flex items-center gap-2 pt-1 text-[11px] text-white/40"
        >
          <Sparkles className="w-3 h-3" />
          <span>Maya is thinking</span>
          <span className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-white/40 animate-[bounce_1s_infinite]" />
            <span className="w-1 h-1 rounded-full bg-white/40 animate-[bounce_1s_infinite_150ms]" />
            <span className="w-1 h-1 rounded-full bg-white/40 animate-[bounce_1s_infinite_300ms]" />
          </span>
        </motion.div>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        <span className="text-[11px] text-white/40 flex-1">Reply to Maya...</span>
        <ArrowUp className="w-3.5 h-3.5 text-white/40" />
      </div>
    </div>
  );
}

function Card2() {
  const hatches = [
    { name: "Alex", role: "PM" },
    { name: "Dev", role: "Engineer" },
    { name: "Cleo", role: "Designer" },
    { name: "Mira", role: "Writer" },
    { name: "Kai", role: "Growth" },
    { name: "Rio", role: "Analyst" },
  ];
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 overflow-hidden h-full">
      <StepBadge n={2} title="Your team assembles" />
      <p className="text-[13px] text-white/55 leading-relaxed mb-5">
        Maya picks the right teammates for your project — engineer, designer, analyst. Each with their own expertise.
      </p>

      <div className="grid grid-cols-3 gap-3">
        {hatches.map((h, i) => (
          <motion.div
            key={h.name}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
          >
            <img src={notionist(h.name)} alt={h.name} className="w-10 h-10 rounded-full" />
            <div className="text-[11px] font-semibold text-white/90">{h.name}</div>
            <div className="text-[9px] text-white/40 uppercase tracking-wider">{h.role}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-400/20 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] text-orange-300 font-medium">
          <Check className="w-3 h-3" />
          6 teammates ready
        </div>
        <span className="text-[10px] text-orange-400/70">just now</span>
      </div>
    </div>
  );
}

function Card3() {
  const tasks = [
    { icon: Wrench, label: "Wire auth flow", who: "Dev", pct: 80 },
    { icon: Palette, label: "Design onboarding", who: "Cleo", pct: 55 },
    { icon: BarChart3, label: "Set up analytics", who: "Rio", pct: 30 },
  ];
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 overflow-hidden h-full">
      <StepBadge n={3} title="They start building" />
      <p className="text-[13px] text-white/55 leading-relaxed mb-5">
        Your team talks to each other, divides the work, and keeps going while you sleep. Wake up to progress.
      </p>

      <div className="space-y-2.5">
        {tasks.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-400/20 flex items-center justify-center">
                <t.icon className="w-3 h-3 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-medium text-white/85 truncate">{t.label}</div>
                <div className="text-[9.5px] text-white/40 uppercase tracking-wider">{t.who}</div>
              </div>
              <span className="text-[10px] font-semibold text-white/60 tabular-nums">{t.pct}%</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${t.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px]">
        <span className="text-white/40">Autonomy running</span>
        <span className="flex items-center gap-1.5 text-green-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>
    </div>
  );
}

export default function HowItWorksBento() {
  const cards = [<Card1 key="c1" />, <Card2 key="c2" />, <Card3 key="c3" />];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {cards.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 48, scale: 0.94, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ delay: i * 0.85, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          {c}
        </motion.div>
      ))}
    </div>
  );
}
