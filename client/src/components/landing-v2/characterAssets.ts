// Landing v2 — character asset registry.
//
// THIS IS THE ONLY FILE YOU EDIT WHEN THE REAL CHARACTER IMAGES LAND.
// Drop the cut-out WebPs into client/public/characters/ and fill in the paths
// below. Every v2 component reads from here, so nothing else needs touching.
//
// Poses come from .planning/character-system/NANO-BANANA-PROMPTS.md:
//   neutral    — role cards, avatars, group shot
//   working    — companion beside a product mock
//   thinking   — deliberation / agent-thinking surfaces
//   handoff    — handoff card
//   reviewing  — peer review surfaces
//
// Until a path is filled in, CharacterSlot renders a placeholder silhouette
// with the Shell Visor drawn on it, so layout and colour are already correct.

import { getRoleDefinition } from "@shared/roleRegistry";

export type CharacterPose = "neutral" | "working" | "thinking" | "handoff" | "reviewing";

export interface CharacterAsset {
  /** Character name as it appears in shared/roleRegistry.ts */
  name: string;
  /** Role string, used to pull hex/colour from the registry */
  role: string;
  /** Plain-language colour name, matches the generation prompt */
  colourName: string;
  /** Image paths per pose. Leave undefined until the asset exists. */
  src: Partial<Record<CharacterPose, string>>;
}

export const CHARACTERS: CharacterAsset[] = [
  { name: "Maya", role: "Idea Partner", colourName: "teal", src: {} },
  { name: "Alex", role: "Product Manager", colourName: "cobalt blue", src: {} },
  { name: "Dev", role: "Backend Developer", colourName: "bright orange", src: {} },
  { name: "Cleo", role: "Product Designer", colourName: "violet", src: {} },
  { name: "Zara", role: "Creative Director", colourName: "magenta", src: {} },
  { name: "Kai", role: "Growth Marketer", colourName: "grass green", src: {} },
  { name: "Mira", role: "Content Writer", colourName: "golden yellow", src: {} },
  { name: "Sam", role: "QA Lead", colourName: "rose red", src: {} },
];

/** Group finale composite. One image of five characters, not five cutouts. */
export const GROUP_SHOT: string | undefined = undefined;

const BY_NAME = new Map(CHARACTERS.map((c) => [c.name, c]));

export function getCharacter(name: string): CharacterAsset | undefined {
  return BY_NAME.get(name);
}

/** Role colour, straight from the registry so the page matches the app. */
export function characterHex(name: string): string {
  const c = BY_NAME.get(name);
  return (c && getRoleDefinition(c.role)?.hex) || "#f97316";
}

/** The one constant across every character: the fracture glow. */
export const HATCH_ORANGE = "#f97316";
