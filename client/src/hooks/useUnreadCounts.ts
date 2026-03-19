// useUnreadCounts — Tracks unread agent messages per conversation
// Stored in sessionStorage (survives re-renders, resets on page refresh)
// Critical for proactive outreach visibility — users need to know when agents messaged them

import { useState, useCallback, useEffect } from "react";

const SESSION_KEY = "hatchin:unreadCounts";

function loadFromSession(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToSession(counts: Record<string, number>): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(counts));
  } catch {
    // sessionStorage might be unavailable in some contexts — fail silently
  }
}

export function useUnreadCounts() {
  const [counts, setCounts] = useState<Record<string, number>>(loadFromSession);

  // Persist to sessionStorage on every change
  useEffect(() => {
    saveToSession(counts);
  }, [counts]);

  const increment = useCallback((conversationId: string) => {
    setCounts((prev) => {
      const updated = { ...prev, [conversationId]: (prev[conversationId] ?? 0) + 1 };
      return updated;
    });
  }, []);

  const clear = useCallback((conversationId: string) => {
    setCounts((prev) => {
      if (!prev[conversationId]) return prev;
      const updated = { ...prev, [conversationId]: 0 };
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setCounts({});
  }, []);

  const getTotalUnread = useCallback(
    (projectId: string): number => {
      return Object.entries(counts).reduce((total, [convId, count]) => {
        // Count unread from any conversation in this project
        if (convId.includes(projectId)) return total + (count ?? 0);
        return total;
      }, 0);
    },
    [counts]
  );

  const hasUnread = useCallback(
    (conversationId: string): boolean => {
      return (counts[conversationId] ?? 0) > 0;
    },
    [counts]
  );

  const getCount = useCallback(
    (conversationId: string): number => {
      return counts[conversationId] ?? 0;
    },
    [counts]
  );

  return {
    counts,
    increment,
    clear,
    clearAll,
    getTotalUnread,
    hasUnread,
    getCount,
  };
}
