import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import { MayaChat } from "@/pages/MayaChat";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import AutonomyDashboard from "@/devtools/autonomyDashboard";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      const next = encodeURIComponent(location || "/");
      setLocation(`/login?next=${next}`);
    }
  }, [isSignedIn, isLoading, location, setLocation]);

  if (isLoading) {
    return <div className="h-screen w-full bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <AuthGuard>
          <Home />
        </AuthGuard>
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
