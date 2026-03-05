import { useCallback, useEffect, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

const AUTH_CHANGED_EVENT = "hatchin_auth_changed";

async function fetchSessionUser(): Promise<User | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Auth session check failed: ${response.status}`);
  }
  return (await response.json()) as User;
}

function getOnboardingKey(userId?: string | null): string | null {
  return userId ? `hasCompletedOnboarding:${userId}` : null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  const refresh = useCallback(async () => {
    try {
      const sessionUser = await fetchSessionUser();
      setUser(sessionUser);
    } catch (error) {
      console.error("Failed to validate session:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const sessionUser = await fetchSessionUser();
        if (isMounted) {
          setUser(sessionUser);
        }
      } catch (error) {
        console.error("Failed to validate session:", error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const syncAuthState = () => {
      void loadSession();
    };

    void loadSession();
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);

    return () => {
      isMounted = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    };
  }, []);

  const signIn = async (_userData?: User) => {
    await refresh();
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Failed to call logout API", error);
    }
    setUser(null);
    queryClient.clear();
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    setLocation("/login");
  };

  const hasCompletedOnboarding = () => {
    const key = getOnboardingKey(user?.id);
    if (!key) return false;
    return localStorage.getItem(key) === "true";
  };

  const completeOnboarding = () => {
    const key = getOnboardingKey(user?.id);
    if (!key) return;
    localStorage.setItem(key, "true");
  };

  return {
    user,
    isLoading,
    signIn,
    signOut,
    refresh,
    hasCompletedOnboarding,
    completeOnboarding,
    isSignedIn: !!user,
  };
}
