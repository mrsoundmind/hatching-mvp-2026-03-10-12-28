import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, lazy, Suspense } from "react";

// The signed-in application is lazy. It used to be a static import, which meant
// every logged-OUT visitor to the landing page downloaded and parsed the whole
// product — chat, both sidebars, the artifact panel — to look at a marketing
// page. Measured: it was 55% of the main bundle (1.90 MB -> 859 KB when split).
//
// Safe to split here in a way the home page is not: `/` is reached by everyone
// including first-time visitors on a cold machine, whereas these routes are
// only reached after a session exists, by which point the app is warm and the
// chunk is already cached.
const Home = lazy(() => import("@/pages/home"));
const MayaChat = lazy(() =>
  import("@/pages/MayaChat").then((m) => ({ default: m.MayaChat })),
);
const AccountPage = lazy(() => import("@/pages/AccountPage"));

// Rarely-reached pages. No reason for these to sit in the bundle every visitor
// downloads.
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));
const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));

// LandingPageV2 is lazy-loaded so its ported `clickup-ported.css` — which contains
// UNSCOPED global `.text-sm/.text-md/.text-xl/.text-xs` color rules (#090c1d) — does
// NOT load on the main app and paint dark-navy text over every menu/chat/dropdown.
// The stylesheet now only loads when someone actually visits /v2.
const LandingPageV2 = lazy(() => import("@/pages/LandingPageV2"));
// LandingPageV3 — the FIMI-style editorial/bento direction. Its stylesheet IS
// fully scoped under .lv3, so it cannot leak the way v2's does; it is lazy for
// bundle size only (framer-motion sections + the 34-avatar roster).
const LandingPageV3 = lazy(() => import("@/pages/LandingPageV3"));
// v5 — hero-only variant. Lazy so its liquid-glass stylesheet never loads on
// any other route.
const LandingPageV5 = lazy(() => import("@/pages/LandingPageV5"));
// v4 is the home page, so it is imported EAGERLY, not lazily. Every visitor
// hits `/`, so code-splitting it buys nothing and costs a second network
// round trip that can fail: with min_machines_running = 0 the machine cold
// starts, and a dynamic import issued during that boot rejects with
// "Failed to fetch dynamically imported module". Seen in production.
// Its stylesheet is safe to bundle eagerly because landing-v3.css is scoped
// entirely under .lv3 (unlike landing-v2's, which is why THAT one is lazy).
import LandingPageV4 from "@/pages/LandingPageV4";
import { ErrorBoundary } from "react-error-boundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppErrorFallback } from "@/components/ErrorFallbacks";

// DEV-only routes, but these were STATIC imports, so both modules shipped to
// production inside the bundle every real user downloads, to serve routes that
// can never match there. Lazy means the chunks exist but are never requested.
const AutonomyDashboard = lazy(() => import("@/devtools/autonomyDashboard"));
// reusable interactive product demo (for the homepage later); dev preview at /dev/teachdemo
const TeachDemo = lazy(() =>
  import("@/components/onboarding/TeachDemo").then((m) => ({ default: m.TeachDemo })),
);

/** The app's loading state. Was duplicated inline in two places; it is now one
 *  component because it is also the Suspense fallback for every lazy route, and
 *  three copies of it would drift. */
function AppLoader() {
  return (
    <div className="h-screen w-full bg-background flex flex-col items-center justify-center gap-5">
      <div className="relative flex items-center justify-center">
        {/* Pulsing ring — uses existing coachmark-ring keyframes from index.css */}
        <span
          className="absolute w-14 h-14 rounded-full border border-indigo-500/40"
          style={{ animation: "coachmark-ring 1.8s ease-out infinite" }}
        />
        <span
          className="absolute w-20 h-20 rounded-full border border-indigo-500/20"
          style={{ animation: "coachmark-ring 1.8s ease-out infinite 0.4s" }}
        />
        <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center">
          <span className="text-lg">🥚</span>
        </div>
      </div>
      <span className="text-2xl font-bold tracking-tighter text-foreground select-none">
        Hatchin<span className="text-indigo-500">.</span>
      </span>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      const next = encodeURIComponent(location || "/");
      if (location !== "/login" && location !== "/landing") setLocation(`/login?next=${next}`);
    }
  }, [isSignedIn, isLoading, location, setLocation]);

  if (isLoading) {
    return <AppLoader />;
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  const { isSignedIn, isLoading } = useAuth();
  return (
    <Switch>
      {/* v1, kept reachable for reference now that v3 is the live home page */}
      <Route path="/landing">
        <Suspense fallback={<AppLoader />}>
          <LandingPage />
        </Suspense>
      </Route>
      {/* Landing v2 prototype. Additive only: /landing is untouched.
          Lazy + Suspense so its global-leaking stylesheet stays off the main app. */}
      <Route path="/v2">
        <Suspense fallback={null}>
          <LandingPageV2 />
        </Suspense>
      </Route>
      {/* v3 is the live home page. /v3 stays as a stable direct link. */}
      <Route path="/v3">
        <Suspense fallback={null}>
          <LandingPageV3 />
        </Suspense>
      </Route>
      {/* v4 — hero variant. Everything below the fold is v3's, by import. */}
      <Route path="/v4" component={LandingPageV4} />
      {/* v5 — hero ONLY. No sections below the fold by design, and it shares no
          component with v3/v4, so nothing here can affect the live home page.
          Lazy + Suspense keeps its stylesheet and its video off every other route. */}
      <Route path="/v5">
        <Suspense fallback={null}>
          <LandingPageV5 />
        </Suspense>
      </Route>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {isLoading ? (
          <AppLoader />
        ) : isSignedIn ? (
          /* The signed-in app is a lazy chunk, so it needs a boundary. The
             fallback is the same loader the auth check already shows, which
             makes the handoff between "checking session" and "fetching app"
             invisible rather than a flash of blank. */
          <Suspense fallback={<AppLoader />}>
            <Home />
          </Suspense>
        ) : (
          /* v4 is the home page a logged-out visitor gets, imported eagerly.
             v3 stays at /v3 and v1 at /landing. */
          <LandingPageV4 />
        )}
      </Route>
      <Route path="/maya/:projectId">
        {(params) => (
          <AuthGuard>
            <Suspense fallback={<AppLoader />}>
              <MayaChat projectId={params.projectId} />
            </Suspense>
          </AuthGuard>
        )}
      </Route>
      <Route path="/account">
        <AuthGuard>
          <Suspense fallback={<AppLoader />}>
            <AccountPage />
          </Suspense>
        </AuthGuard>
      </Route>
      {import.meta.env.DEV && (
        <Route path="/dev/autonomy">
          <AuthGuard>
            <Suspense fallback={<AppLoader />}>
              <AutonomyDashboard />
            </Suspense>
          </AuthGuard>
        </Route>
      )}
      {/* Dev preview of the reusable interactive product demo (destined for the
          homepage later). DEV-only; not part of the onboarding flow. */}
      {import.meta.env.DEV && (
        <Route path="/dev/teachdemo">
          <Suspense fallback={<AppLoader />}>
            <TeachDemo isOpen onDone={() => window.location.reload()} />
          </Suspense>
        </Route>
      )}
      <Route path="/legal/privacy">
        <Suspense fallback={<AppLoader />}>
          <PrivacyPage />
        </Suspense>
      </Route>
      <Route path="/legal/terms">
        <Suspense fallback={<AppLoader />}>
          <TermsPage />
        </Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
