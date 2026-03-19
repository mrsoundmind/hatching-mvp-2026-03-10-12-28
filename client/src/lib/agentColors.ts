/**
 * Agent Colors — derived from the Role Registry (shared/roleRegistry.ts).
 *
 * To add a new role: edit ROLE_DEFINITIONS in shared/roleRegistry.ts ONLY.
 * This file auto-builds all color maps from that single source.
 */

import { ROLE_DEFINITIONS, getRoleDefinition } from "@shared/roleRegistry";

export interface AgentColorSet {
  bg: string;             // Bubble background — CSS value (for inline styles)
  border: string;         // Bubble border — CSS value (for inline styles)
  avatarBg: string;       // Avatar circle background — Tailwind class
  avatarRing: string;     // Avatar ring — Tailwind class
  text: string;           // Name/role text color — Tailwind class
  dot: string;            // Presence dot — Tailwind class
  hex: string;            // Hex color for SVG/canvas
  emoji: string;          // Role emoji for avatar fallback
  thinkingPhrase: string; // Agent-specific thinking placeholder text
}

const DEFAULT_COLORS: AgentColorSet = {
  bg: "hsla(158, 66%, 57%, 0.12)",
  border: "hsla(158, 66%, 57%, 0.35)",
  avatarBg: "bg-emerald-600",
  avatarRing: "ring-emerald-500/40",
  text: "text-emerald-300",
  dot: "bg-emerald-400",
  hex: "#10b981",
  emoji: "🤖",
  thinkingPhrase: "Thinking...",
};

function toColorSet(def: ReturnType<typeof getRoleDefinition>): AgentColorSet {
  if (!def) return DEFAULT_COLORS;
  return {
    bg: def.bgCss,
    border: def.borderCss,
    avatarBg: def.avatarBg,
    avatarRing: def.avatarRing,
    text: def.text,
    dot: def.dot,
    hex: def.hex,
    emoji: def.emoji,
    thinkingPhrase: def.thinkingPhrase,
  };
}

export function getAgentColors(role?: string | null): AgentColorSet {
  return toColorSet(getRoleDefinition(role));
}

export function getRoleEmoji(role?: string | null): string {
  return getAgentColors(role).emoji;
}

// Character name → role mapping (kept for direct lookups by character name)
export const CHARACTER_ROLE_MAP: Record<string, string> = Object.fromEntries(
  ROLE_DEFINITIONS.map(d => [d.characterName, d.role])
);
