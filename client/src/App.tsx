import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import { MayaChat } from "@/pages/MayaChat";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import LandingPage from "@/pages/LandingPage";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, lazy, Suspense } from "react";

// LandingPageV2 is lazy-loaded so its ported `clickup-ported.css` — which contains
// UNSCOPED global `.text-sm/.text-md/.text-xl/.text-xs` color rules (#090c1d) — does
// NOT load on the main app and paint dark-navy text over every menu/chat/dropdown.
// The stylesheet now only loads when someone actually visits /v2.
const LandingPageV2 = lazy(() => import("@/pages/LandingPageV2"));
import { ErrorBoundary } from "react-error-boundary";
import AutonomyDashboard from "@/devtools/autonomyDashboard";
import AccountPage from "@/pages/AccountPage";
import PrivacyPage from "@/pages/legal/PrivacyPage";
import TermsPage from "@/pages/legal/TermsPage";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppErrorFallback } from "@/components/ErrorFallbacks";

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

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  const { isSignedIn, isLoading } = useAuth();
  return (
    <Switch>
      <Route path="/landing" component={LandingPage} />
      {/* Landing v2 prototype. Additive only: /landing is untouched.
          Lazy + Suspense so its global-leaking stylesheet stays off the main app. */}
      <Route path="/v2">
        <Suspense fallback={null}>
          <LandingPageV2 />
        </Suspense>
      </Route>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {isLoading ? (
          <div className="h-screen w-full bg-background flex flex-col items-center justify-center gap-5">
            <div className="relative flex items-center justify-center">
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
        ) : isSignedIn ? (
          <Home />
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/maya/:projectId">
        {(params) => (
          <AuthGuard>
            <MayaChat projectId={params.projectId} />
          </AuthGuard>
        )}
      </Route>
      <Route path="/account">
        <AuthGuard>
          <AccountPage />
        </AuthGuard>
      </Route>
      {import.meta.env.DEV && (
        <Route path="/dev/autonomy">
          <AuthGuard>
            <AutonomyDashboard />
          </AuthGuard>
        </Route>
      )}
      <Route path="/legal/privacy" component={PrivacyPage} />
      <Route path="/legal/terms" component={TermsPage} />
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
