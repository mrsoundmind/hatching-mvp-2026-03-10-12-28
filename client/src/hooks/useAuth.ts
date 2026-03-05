import { useState, useEffect } from 'react';
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface User {
  id: string;
  name: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    let isMounted = true;

    // Check if user has a valid server session
    const validateSession = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          if (isMounted) {
            setUser(userData);
            // Keep localStorage updated as a synchronous backup layer
            localStorage.setItem('hatchin_user', JSON.stringify(userData));
          }
        } else {
          // If server says 401/404, we are not logged in
          if (isMounted) setUser(null);
          localStorage.removeItem('hatchin_user');
        }
      } catch (error) {
        console.error("Failed to validate session:", error);
        // On network failure, gracefully fallback to local storage if it exists
        const savedUser = localStorage.getItem('hatchin_user');
        if (savedUser && isMounted) {
          setUser(JSON.parse(savedUser));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    validateSession();

    // Sync state across all hook instances (e.g. from login actions in other components)
    const syncAuthState = () => {
      const updatedUser = localStorage.getItem('hatchin_user');
      if (isMounted) {
        setUser(updatedUser ? JSON.parse(updatedUser) : null);
      }
    };

    window.addEventListener('hatchin_auth_changed', syncAuthState);

    return () => {
      isMounted = false;
      window.removeEventListener('hatchin_auth_changed', syncAuthState);
    };
  }, []);

  const signIn = async (userData: User) => {
    // We expect the component calling signIn to have already called POST /api/auth/login
    // But we update our state and emit the cross-component sync event
    setUser(userData);
    localStorage.setItem('hatchin_user', JSON.stringify(userData));
    window.dispatchEvent(new Event('hatchin_auth_changed'));
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error("Failed to call logout API", e);
    }
    setUser(null);
    localStorage.removeItem('hatchin_user');
    localStorage.removeItem('hasCompletedOnboarding');
    queryClient.clear();
    setLocation('/');
  };

  const hasCompletedOnboarding = () => {
    return localStorage.getItem('hasCompletedOnboarding') === 'true';
  };

  const completeOnboarding = () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
  };

  return {
    user,
    isLoading,
    signIn,
    signOut,
    hasCompletedOnboarding,
    completeOnboarding,
    isSignedIn: !!user
  };
}
