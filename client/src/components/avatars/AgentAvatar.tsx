// AgentAvatar — Router component that picks the right avatar by character/role
// Used everywhere an agent avatar appears: MessageBubble, LeftSidebar, RightSidebar, OnboardingSteps

import React, { memo } from "react";
import { AvatarState, AvatarProps } from "./BaseAvatar.js";
import { getAgentColors, CHARACTER_ROLE_MAP } from "../../lib/agentColors.js";

// Lazy character avatar imports
const AlexAvatar = React.lazy(() => import("./AlexAvatar.js"));
const DevAvatar = React.lazy(() => import("./DevAvatar.js"));
const CleoAvatar = React.lazy(() => import("./CleoAvatar.js"));
const FinnAvatar = React.lazy(() => import("./FinnAvatar.js"));
const SamAvatar = React.lazy(() => import("./SamAvatar.js"));
const MiraAvatar = React.lazy(() => import("./MiraAvatar.js"));
const RouxAvatar = React.lazy(() => import("./RouxAvatar.js"));
const MayaAvatar = React.lazy(() => import("./MayaAvatar.js"));
const MorganAvatar = React.lazy(() => import("./MorganAvatar.js"));
const JordanAvatar = React.lazy(() => import("./JordanAvatar.js"));
const NyxAvatar = React.lazy(() => import("./NyxAvatar.js"));
const RemyAvatar = React.lazy(() => import("./RemyAvatar.js"));
const ZaraAvatar = React.lazy(() => import("./ZaraAvatar.js"));
const KaiAvatar = React.lazy(() => import("./KaiAvatar.js"));
const PixelAvatar = React.lazy(() => import("./PixelAvatar.js"));
const RobinAvatar = React.lazy(() => import("./RobinAvatar.js"));
const DrewAvatar = React.lazy(() => import("./DrewAvatar.js"));
const RioAvatar = React.lazy(() => import("./RioAvatar.js"));
const SageAvatar = React.lazy(() => import("./SageAvatar.js"));
const QuinnAvatar = React.lazy(() => import("./QuinnAvatar.js"));
const BlakeAvatar = React.lazy(() => import("./BlakeAvatar.js"));
const TaylorAvatar = React.lazy(() => import("./TaylorAvatar.js"));
const LeeAvatar = React.lazy(() => import("./LeeAvatar.js"));
const VinceAvatar = React.lazy(() => import("./VinceAvatar.js"));

interface AgentAvatarProps extends AvatarProps {
  characterName?: string | null;  // "Alex", "Dev", "Cleo", etc.
  role?: string | null;           // Fallback if no characterName
  agentName?: string | null;      // Fallback initial if no character found
}

function FallbackAvatar({
  role,
  agentName,
  size = 36,
  className = "",
}: {
  role?: string | null;
  agentName?: string | null;
  size?: number;
  className?: string;
}) {
  const colors = getAgentColors(role);
  const initial = agentName?.charAt(0)?.toUpperCase() ?? role?.charAt(0)?.toUpperCase() ?? "?";
  const emoji = colors.emoji;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${colors.avatarBg} select-none ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, fontSize: size * 0.4 }}
    >
      {emoji !== "🤖" ? emoji : initial}
    </div>
  );
}

const CHARACTER_AVATAR_MAP: Record<string, React.LazyExoticComponent<React.FC<AvatarProps>>> = {
  Alex: AlexAvatar,
  Dev: DevAvatar,
  Cleo: CleoAvatar,
  Finn: FinnAvatar,
  Sam: SamAvatar,
  Mira: MiraAvatar,
  Roux: RouxAvatar,
  Maya: MayaAvatar,
  Morgan: MorganAvatar,
  Jordan: JordanAvatar,
  Nyx: NyxAvatar,
  Remy: RemyAvatar,
  Zara: ZaraAvatar,
  Kai: KaiAvatar,
  Pixel: PixelAvatar,
  Robin: RobinAvatar,
  Drew: DrewAvatar,
  Rio: RioAvatar,
  Sage: SageAvatar,
  Quinn: QuinnAvatar,
  Blake: BlakeAvatar,
  Taylor: TaylorAvatar,
  Lee: LeeAvatar,
  Vince: VinceAvatar,
};

function resolveCharacterName(
  characterName?: string | null,
  role?: string | null,
  agentName?: string | null
): string | null {
  if (characterName && CHARACTER_AVATAR_MAP[characterName]) return characterName;
  // Try to infer from role
  const fromRole = Object.entries(CHARACTER_ROLE_MAP).find(([, r]) => r === role);
  if (fromRole) return fromRole[0];
  // Try to infer from agent name
  if (agentName && CHARACTER_AVATAR_MAP[agentName]) return agentName;
  return null;
}

const AgentAvatar = memo(function AgentAvatar({
  characterName,
  role,
  agentName,
  state = "idle",
  size = 36,
  className = "",
}: AgentAvatarProps) {
  const resolvedName = resolveCharacterName(characterName, role, agentName);
  const AvatarComponent = resolvedName ? CHARACTER_AVATAR_MAP[resolvedName] : null;

  if (!AvatarComponent) {
    return (
      <FallbackAvatar
        role={role}
        agentName={agentName}
        size={size}
        className={className}
      />
    );
  }

  return (
    <React.Suspense
      fallback={
        <FallbackAvatar
          role={role}
          agentName={agentName}
          size={size}
          className={className}
        />
      }
    >
      <AvatarComponent state={state} size={size} className={className} />
    </React.Suspense>
  );
});

export default AgentAvatar;
export type { AvatarState };
