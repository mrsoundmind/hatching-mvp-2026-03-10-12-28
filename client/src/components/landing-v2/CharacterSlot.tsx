// Landing v2 — CharacterSlot
//
// Renders a character image when one exists in characterAssets.ts, and a
// deliberate placeholder when it does not. The placeholder is not a grey box:
// it draws the head-and-shoulders silhouette in the character's own role
// colour with the Shell Visor and its glowing fracture, so the layout, the
// colour system and the visor concept are all reviewable before a single
// image has been generated.

import { memo, useId } from "react";
import { characterHex, getCharacter, HATCH_ORANGE, type CharacterPose } from "./characterAssets";

interface CharacterSlotProps {
  name: string;
  pose?: CharacterPose;
  className?: string;
  /** Fallback chain: if the requested pose is missing, try neutral. */
  fallbackToNeutral?: boolean;
}

function CharacterSlotImpl({
  name,
  pose = "neutral",
  className = "",
  fallbackToNeutral = true,
}: CharacterSlotProps) {
  const uid = useId();
  const character = getCharacter(name);
  const hex = characterHex(name);

  const src = character?.src[pose] ?? (fallbackToNeutral ? character?.src.neutral : undefined);

  if (src) {
    return (
      <img
        src={src}
        alt={`${name}, ${character?.role ?? "teammate"}`}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }

  // Placeholder. Silhouette + Shell Visor, in this character's colour.
  const bodyGrad = `${uid}-body`;
  const visorGrad = `${uid}-visor`;
  const crackGlow = `${uid}-glow`;

  return (
    <svg
      viewBox="0 0 400 520"
      className={className}
      role="img"
      aria-label={`${name}, ${character?.role ?? "teammate"} (artwork pending)`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hex} stopOpacity="0.30" />
          <stop offset="100%" stopColor={hex} stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={visorGrad} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor={hex} stopOpacity="0.95" />
          <stop offset="100%" stopColor={hex} stopOpacity="0.65" />
        </linearGradient>
        <filter id={crackGlow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* shoulders */}
      <path
        d="M34 520 C34 412 108 344 200 344 C292 344 366 412 366 520 Z"
        fill={`url(#${bodyGrad})`}
        stroke={hex}
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      {/* neck */}
      <path d="M168 268 L232 268 L232 352 L168 352 Z" fill={`url(#${bodyGrad})`} />
      {/* head */}
      <ellipse
        cx="200"
        cy="182"
        rx="90"
        ry="110"
        fill={`url(#${bodyGrad})`}
        stroke={hex}
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />

      {/* Shell Visor: asymmetric shard, deeper on the left */}
      <path
        d="M104 164 Q104 143 126 141 L286 152 Q304 154 302 174 L297 208
           Q295 227 275 225 L121 213 Q104 211 104 191 Z"
        fill={`url(#${visorGrad})`}
      />
      {/* eye openings */}
      <ellipse cx="156" cy="185" rx="21" ry="13" fill="#0A0C13" opacity="0.82" />
      <ellipse cx="248" cy="192" rx="21" ry="13" fill="#0A0C13" opacity="0.82" />

      {/* the fracture: the one constant across all thirty */}
      <path
        d="M196 143 L214 176 L200 190 L222 224"
        fill="none"
        stroke={HATCH_ORANGE}
        strokeWidth="2.5"
        strokeLinecap="round"
        filter={`url(#${crackGlow})`}
      />

      <text
        x="200"
        y="500"
        textAnchor="middle"
        fill={hex}
        fillOpacity="0.5"
        fontSize="15"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        letterSpacing="1.5"
      >
        {name.toUpperCase()}
      </text>
    </svg>
  );
}

export const CharacterSlot = memo(CharacterSlotImpl);
export default CharacterSlot;
