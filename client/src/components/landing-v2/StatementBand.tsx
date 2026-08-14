// Landing v2 — StatementBand  (reference: OneTwoCU)
//
// Their DOM: div.one-two-cu > div.section-content > div.section-header >
// span.section-eyebrow + h3.section-title + p.section-description, then a
// link. No imagery, deliberately. It is the breather between heavy sections.
//
// Reused twice on their page (once for "One prompt spins up an entire team",
// once for the billing promise), so this takes props rather than hardcoding.

import type { ReactNode } from "react";
import { Link } from "wouter";
import { useReveal } from "./useReveal";

interface StatementBandProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  cta?: { label: string; href: string };
}

export function StatementBand({ eyebrow, title, description, cta }: StatementBandProps) {
  const { ref, className } = useReveal<HTMLDivElement>(0.12);

  return (
    <div ref={ref} className={`lv2-one-two-cu ${className}`}>
      <div className="lv2-section-content">
        <div className="lv2-section-header">
          <span className="lv2-section-eyebrow">{eyebrow}</span>
          <h3 className="lv2-section-title">{title}</h3>
          <p className="lv2-section-description">{description}</p>
        </div>
        {cta && (
          <Link href={cta.href}>
            <button type="button" className="lv2-statement-btn">
              {cta.label}
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

export default StatementBand;
