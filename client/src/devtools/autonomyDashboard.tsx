import { useEffect, useMemo, useState } from 'react';

interface EventRow {
  eventType: string;
  timestamp: string;
  projectId: string | null;
  conversationId: string | null;
  hatchId: string | null;
  latencyMs: number | null;
  riskScore: number | null;
}

interface TraceRow {
  traceId: string;
  projectId: string;
  conversationId: string;
  objective: string;
  rounds: Array<{ roundNo: number; hatchId: string }>;
  review: Array<{ reviewerHatchId: string }>;
  updatedAt: string;
}

export default function AutonomyDashboard() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [eventsRes, tracesRes, healthRes] = await Promise.all([
          fetch('/api/autonomy/events'),
          fetch('/api/autonomy/traces'),
          fetch('/health'),
        ]);

        if (!eventsRes.ok || !tracesRes.ok || !healthRes.ok) {
          throw new Error('Failed to load autonomy dashboard data');
        }

        const eventsJson = await eventsRes.json();
        const tracesJson = await tracesRes.json();
        const healthJson = await healthRes.json();

        if (!active) return;
        setEvents(Array.isArray(eventsJson.events) ? eventsJson.events : []);
        setTraces(Array.isArray(tracesJson.traces) ? tracesJson.traces : []);
        setHealth(healthJson);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || 'Failed to load dashboard');
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const recentEvents = useMemo(() => events.slice(-30).reverse(), [events]);
  const recentTraces = useMemo(() => traces.slice(-12).reverse(), [traces]);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-[#E7ECF6] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Autonomy Dashboard</h1>
          <div className="text-sm text-[#9BA7C0]">Live trace + event view</div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-[#9BA7C0]">Provider</div>
            <div className="text-lg">{health?.provider?.resolvedProvider || 'unknown'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-[#9BA7C0]">Mode</div>
            <div className="text-lg">{health?.provider?.runtimeMode || health?.provider?.mode || 'unknown'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-[#9BA7C0]">Events</div>
            <div className="text-lg">{events.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-[#9BA7C0]">Traces</div>
            <div className="text-lg">{traces.length}</div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold mb-3">Recent Events</h2>
            <div className="max-h-[540px] overflow-auto space-y-2">
              {recentEvents.map((event, index) => (
                <div key={`${event.timestamp}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{event.eventType}</span>
                    <span className="text-[#9BA7C0]">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1 text-[#9BA7C0]">
                    conversation: {event.conversationId || 'n/a'} · hatch: {event.hatchId || 'n/a'}
                  </div>
                  <div className="mt-1 text-[#9BA7C0]">
                    latency: {event.latencyMs ?? 'n/a'}ms · risk: {event.riskScore ?? 'n/a'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold mb-3">Deliberation Traces</h2>
            <div className="max-h-[540px] overflow-auto space-y-2">
              {recentTraces.map((trace) => (
                <div key={trace.traceId} className="rounded-md border border-white/10 bg-black/20 p-3 text-xs">
                  <div className="font-medium">{trace.traceId}</div>
                  <div className="mt-1 text-[#9BA7C0]">{trace.objective}</div>
                  <div className="mt-1 text-[#9BA7C0]">
                    rounds: {trace.rounds?.length || 0} · peer reviews: {trace.review?.length || 0}
                  </div>
                  <div className="mt-1 text-[#9BA7C0]">{new Date(trace.updatedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
