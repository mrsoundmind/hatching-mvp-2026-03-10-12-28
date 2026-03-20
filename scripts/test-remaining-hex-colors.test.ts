import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

function readComponent(relativePath: string): string {
  return readFileSync(join(__dirname, "..", relativePath), "utf-8");
}

describe("LandingPage.tsx remaining hex cleanup", () => {
  it("uses bg-background instead of bg-[#040609] for main page background", () => {
    const src = readComponent("client/src/pages/LandingPage.tsx");
    expect(src).not.toMatch(/bg-\[#040609\]/);
  });

  it("uses dark: prefix for chat container and input bg-[#080A0F]", () => {
    const src = readComponent("client/src/pages/LandingPage.tsx");
    const lines = src.split("\n");
    const hexLines = lines.filter(l => l.includes("bg-[#080A0F]") && !l.includes("dark:bg-[#080A0F]"));
    expect(hexLines).toHaveLength(0);
  });

  it("uses dark: prefix for chat bubble bg-[#0A0C13]", () => {
    const src = readComponent("client/src/pages/LandingPage.tsx");
    const lines = src.split("\n");
    const hexLines = lines.filter(l => l.includes("bg-[#0A0C13]") && !l.includes("dark:bg-[#0A0C13]"));
    expect(hexLines).toHaveLength(0);
  });
});

describe("login.tsx remaining hex cleanup", () => {
  it("uses dark: prefix for decorative bg-[#050505]", () => {
    const src = readComponent("client/src/pages/login.tsx");
    const lines = src.split("\n");
    const hexLines = lines.filter(l => l.includes("bg-[#050505]") && !l.includes("dark:bg-[#050505]"));
    expect(hexLines).toHaveLength(0);
  });

  it("uses dark: prefix for code mock bg-[#0A0A0A]/80", () => {
    const src = readComponent("client/src/pages/login.tsx");
    const lines = src.split("\n");
    const hexLines = lines.filter(l => l.includes("bg-[#0A0A0A]/80") && !l.includes("dark:bg-[#0A0A0A]/80"));
    expect(hexLines).toHaveLength(0);
  });
});

describe("LeftSidebar.tsx undo popup hex cleanup", () => {
  it("uses semantic tokens instead of hardcoded hex in undo popup", () => {
    const src = readComponent("client/src/components/LeftSidebar.tsx");
    expect(src).not.toMatch(/bg-\[#2A2D33\]/);
    expect(src).not.toMatch(/border-\[#43444B\]/);
    expect(src).not.toMatch(/text-\[#F1F1F3\]/);
    expect(src).not.toMatch(/text-\[#A6A7AB\]/);
    expect(src).not.toMatch(/bg-\[#37383B\]/);
  });
});

describe("LandingPage.tsx text-white cleanup", () => {
  it("heading and body text use text-foreground instead of text-white for light mode support", () => {
    const src = readComponent("client/src/pages/LandingPage.tsx");
    const lines = src.split("\n");
    // text-white is only valid on colored backgrounds (orange buttons) or hover states
    // Filter out lines where text-white is on a button with bg-orange or is a hover: state
    const badLines = lines.filter(l => {
      if (!l.includes("text-white")) return false;
      // Allow text-white on orange buttons
      if (l.includes("bg-orange") || l.includes("CONTINUE")) return false;
      // Allow hover:text-white
      if (l.includes("hover:text-white") && !l.match(/(?<!hover:)text-white(?!\/)/)) return false;
      // Allow text-white inside gradient spans (bg-clip-text)
      if (l.includes("bg-clip-text")) return false;
      // Check for plain text-white (not text-white/XX opacity variants)
      return l.match(/(?<!hover:|dark:)text-white(?!\/)\b/) !== null;
    });
    expect(badLines.length).toBe(0);
  });
});
