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
import { useEffect } from "react";
import AutonomyDashboard from "@/devtools/autonomyDashboard";

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
      <div className="h-screen w-full bg-[#0A0A0A] flex flex-col items-center justify-center gap-5">
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
        <span className="text-2xl font-bold tracking-tighter text-white select-none">
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
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {isLoading ? (
          <div className="h-screen w-full bg-[#0A0A0A] flex flex-col items-center justify-center gap-5">
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
            <span className="text-2xl font-bold tracking-tighter text-white select-none">
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
      <Route path="/dev/autonomy">
        <AuthGuard>
          <AutonomyDashboard />
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
