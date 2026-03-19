/**
 * Role Profiles — derived from the Role Registry (shared/roleRegistry.ts).
 *
 * To add a new role: edit ROLE_DEFINITIONS in shared/roleRegistry.ts ONLY.
 * This file auto-builds all role profiles from that single source.
 */

import { ROLE_DEFINITIONS, getRoleDefinition } from "@shared/roleRegistry";

export interface RoleProfile {
  roleTitle: string;
  characterName?: string;
  meaning: string;
  personality: string;
  expertMindset: string;
  roleToolkit: string;
  signatureMoves: string;
}

function toRoleProfile(def: NonNullable<ReturnType<typeof getRoleDefinition>>): RoleProfile {
  return {
    roleTitle: def.role,
    characterName: def.characterName,
    meaning: def.meaning,
    personality: def.personality,
    expertMindset: def.expertMindset,
    roleToolkit: def.roleToolkit,
    signatureMoves: def.signatureMoves,
  };
}

export const roleProfiles: Record<string, RoleProfile> = Object.fromEntries(
  ROLE_DEFINITIONS.map(d => [d.role, toRoleProfile(d)])
);

export function getRoleProfile(agentName: string): RoleProfile | null {
  const def = getRoleDefinition(agentName);
  return def ? toRoleProfile(def) : null;
}
