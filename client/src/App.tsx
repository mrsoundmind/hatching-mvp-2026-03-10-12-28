import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import { MayaChat } from "@/pages/MayaChat";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import AutonomyDashboard from "@/devtools/autonomyDashboard";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, hasCompletedOnboarding, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!isSignedIn || !hasCompletedOnboarding())) {
      setLocation('/');
    }
  }, [isSignedIn, hasCompletedOnboarding, isLoading, setLocation]);

  if (isLoading) {
    return <div className="h-screen w-full bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!isSignedIn || !hasCompletedOnboarding()) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/maya/:projectId">
        {(params) => (
          <AuthGuard>
            <MayaChat projectId={params.projectId} />
          </AuthGuard>
        )}
      </Route>
      <Route path="/dev/autonomy" component={AutonomyDashboard} />
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
