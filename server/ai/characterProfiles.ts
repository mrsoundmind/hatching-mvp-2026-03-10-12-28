/**
 * Character Profiles — derived from the Role Registry (shared/roleRegistry.ts).
 *
 * To add a new role or change a personality: edit ROLE_DEFINITIONS in shared/roleRegistry.ts ONLY.
 * This file auto-builds all character profiles from that single source.
 */

import { ROLE_DEFINITIONS, getRoleDefinition } from "@shared/roleRegistry";

export interface CharacterProfile {
  characterName: string;
  role: string;
  voicePrompt: string;
  tendencies: string[];
  emotionalSignature: {
    excited: string;
    challenged: string;
    uncertain: string;
    celebrating: string;
  };
  neverSays: string[];
  thinkingPhrase: string;
}

function toCharacterProfile(def: NonNullable<ReturnType<typeof getRoleDefinition>>): CharacterProfile {
  return {
    characterName: def.characterName,
    role: def.role,
    voicePrompt: def.voicePrompt,
    tendencies: def.tendencies,
    emotionalSignature: def.emotionalSignature,
    neverSays: def.neverSays,
    thinkingPhrase: def.thinkingPhrase,
  };
}

export const characterProfiles: Record<string, CharacterProfile> = Object.fromEntries(
  ROLE_DEFINITIONS.map(d => [d.role, toCharacterProfile(d)])
);

// Maya convenience export (kept for backward compatibility with existing callers)
export const mayaCharacterProfile: CharacterProfile =
  characterProfiles["AI Idea Partner"] ?? toCharacterProfile(ROLE_DEFINITIONS[ROLE_DEFINITIONS.length - 1]);

export function getCharacterProfile(role: string): CharacterProfile | null {
  if (role === "Maya" || role === "AI Idea Partner") return mayaCharacterProfile;
  const def = getRoleDefinition(role);
  return def ? toCharacterProfile(def) : null;
}

export function getThinkingPhrase(role: string): string {
  const profile = getCharacterProfile(role);
  return profile?.thinkingPhrase ?? `${role} is thinking...`;
}
