// Landing v2 — CuSectionHeader
//
// Ported from the reference's `cu-section-header` / CUSectionHeader module.
// Markup structure is theirs, taken from the hydrated DOM:
//
//   .cu-section-header
//     span.header-eyebrow      [CAPABILITIES]
//     div.header-divider
//     div.header-content
//       div.header-left   > h2.header-title
//       div.header-right  > p.header-description
//                         > (optional slot, they put the carousel nav here)
//
// Class names are the lv2- renames of theirs, and every dimension comes from
// clickup-ported.css. Only the text and the colours are ours.

import type { ReactNode } from "react";
import { useReveal } from "./useReveal";

interface CuSectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** Their layout parks the carousel arrows in the right column. */
  right?: ReactNode;
  className?: string;
}

export function CuSectionHeader({
  eyebrow,
  title,
  description,
  right,
  className = "",
}: CuSectionHeaderProps) {
  const { ref, className: revealClass } = useReveal<HTMLDivElement>();

  return (
    <div ref={ref} className={`lv2-cu-section-header ${revealClass} ${className}`}>
      <span className="lv2-header-eyebrow">[{eyebrow}]</span>
      <div className="lv2-header-divider" />
      <div className="lv2-header-content">
        <div className="lv2-header-left">
          <h2 className="lv2-header-title">{title}</h2>
        </div>
        <div className="lv2-header-right">
          {description && <p className="lv2-header-description">{description}</p>}
          {right}
        </div>
      </div>
    </div>
  );
}

export default CuSectionHeader;
