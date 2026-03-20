/**
 * Theme Task 6: Page components must use design-system tokens instead of hardcoded colors.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PAGES_DIR = path.resolve(__dirname, "../client/src/pages");

function readPage(filename: string): string {
  return fs.readFileSync(path.join(PAGES_DIR, filename), "utf-8");
}

describe("not-found.tsx theme tokens", () => {
  it("uses bg-background instead of bg-gray-50 and text-foreground instead of text-gray-900", () => {
    const src = readPage("not-found.tsx");
    expect(src).not.toContain("bg-gray-50");
    expect(src).toContain("bg-background");
    expect(src).not.toContain("text-gray-900");
    expect(src).toContain("text-foreground");
    expect(src).not.toContain("text-gray-600");
    expect(src).toContain("text-muted-foreground");
  });
});

describe("MayaChat.tsx theme tokens", () => {
  it("replaces all hardcoded gray colors with semantic design tokens", () => {
    const src = readPage("MayaChat.tsx");
    expect(src).not.toContain("bg-gray-900");
    expect(src).not.toContain("bg-gray-800");
    expect(src).not.toContain("bg-gray-700");
    expect(src).not.toContain("border-gray-700");
    expect(src).not.toContain("border-gray-800");
    expect(src).not.toContain("border-gray-600");
    expect(src).not.toContain("text-gray-400");
    expect(src).not.toContain("text-gray-300");
    expect(src).not.toContain("text-gray-500");
    expect(src).not.toContain("text-gray-100");
    expect(src).not.toContain("bg-[#2A2D33]");
    expect(src).not.toContain("border-[#43444B]");
    expect(src).not.toContain("text-[#F1F1F3]");
    expect(src).not.toContain("placeholder-[#A6A7AB]");
    expect(src).toContain("bg-background");
    expect(src).toContain("text-foreground");
    expect(src).toContain("text-muted-foreground");
    expect(src).toContain("border-border");
    expect(src).toContain("bg-hatchin-panel");
  });
});

describe("onboarding.tsx theme tokens", () => {
  it("replaces hardcoded bg and text colors with semantic design tokens", () => {
    const src = readPage("onboarding.tsx");
    expect(src).not.toContain("bg-[#0A0A0A]");
    expect(src).toContain("bg-background");
    expect(src).not.toContain("text-slate-400");
    expect(src).not.toContain("text-gray-400");
    expect(src).not.toContain("text-gray-300");
    // text-white should only appear on accent buttons with bg-white
    const lines = src.split("\\n");
    expect(src).toContain("text-foreground");
    expect(src).toContain("text-muted-foreground");
  });
});

describe("login.tsx theme tokens", () => {
  it("replaces hardcoded bg and text colors with semantic design tokens", () => {
    const src = readPage("login.tsx");
    expect(src).not.toContain("bg-[#030303]");
    expect(src).toContain("bg-background");
    expect(src).not.toContain("text-slate-400");
    expect(src).not.toContain("text-slate-500");
    expect(src).not.toContain("bg-slate-900 ");
    expect(src).toContain("text-foreground");
    expect(src).toContain("text-muted-foreground");
  });
});

describe("LandingPage.tsx theme tokens", () => {
  it("replaces hardcoded slate/gray text and bg colors with semantic tokens", () => {
    const src = readPage("LandingPage.tsx");
    expect(src).not.toContain("text-slate-200");
    expect(src).not.toContain("text-slate-300");
    expect(src).not.toContain("text-slate-400");
    expect(src).not.toContain("text-slate-500");
    expect(src).not.toContain("text-slate-600");
    expect(src).not.toContain("bg-slate-800/30");
    expect(src).not.toContain("bg-slate-800/40");
    expect(src).not.toContain("bg-slate-900/60");
    expect(src).not.toContain("border-slate-700");
    expect(src).not.toContain("border-slate-800");
    expect(src).toContain("text-foreground");
    expect(src).toContain("text-muted-foreground");
    expect(src).toContain("bg-indigo-50 dark:bg-[#131724]");
    expect(src).toContain("bg-emerald-50 dark:bg-[#111A18]");
    expect(src).toContain("bg-fuchsia-50 dark:bg-[#1A121F]");
  });
});
