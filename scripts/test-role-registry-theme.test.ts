// TDD tests for roleRegistry light/dark mode color variants
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const registrySrc = () =>
  fs.readFileSync(path.resolve("shared/roleRegistry.ts"), "utf8");

describe("roleRegistry light/dark color variants", () => {
  it("every text field uses the dark: prefix pattern for dark mode", () => {
    const src = registrySrc();
    const textMatches = src.match(/\btext:\s*"([^"]+)"/g) ?? [];
    expect(textMatches.length).toBeGreaterThan(0);
    for (const match of textMatches) {
      const value = match.replace(/\btext:\s*"/, "").replace(/"$/, "");
      expect(
        value,
        `text field value "${value}" must include a dark: variant`
      ).toMatch(/dark:text-/);
    }
  });

  it("every dot field uses the dark: prefix pattern for dark mode", () => {
    const src = registrySrc();
    const dotMatches = src.match(/\bdot:\s*"([^"]+)"/g) ?? [];
    expect(dotMatches.length).toBeGreaterThan(0);
    for (const match of dotMatches) {
      const value = match.replace(/\bdot:\s*"/, "").replace(/"$/, "");
      expect(
        value,
        `dot field value "${value}" must include a dark: variant`
      ).toMatch(/dark:bg-/);
    }
  });

  it("text fields use 600 shade as the light-mode base class", () => {
    const src = registrySrc();
    const textMatches = src.match(/\btext:\s*"([^"]+)"/g) ?? [];
    expect(textMatches.length).toBeGreaterThan(0);
    for (const match of textMatches) {
      const value = match.replace(/\btext:\s*"/, "").replace(/"$/, "");
      const lightClass = value.split(" ")[0];
      expect(
        lightClass,
        `light-mode text class "${lightClass}" in "${value}" should use shade 600`
      ).toMatch(/text-\w+-600$/);
    }
  });

  it("dot fields use 500 shade as the light-mode base class", () => {
    const src = registrySrc();
    const dotMatches = src.match(/\bdot:\s*"([^"]+)"/g) ?? [];
    expect(dotMatches.length).toBeGreaterThan(0);
    for (const match of dotMatches) {
      const value = match.replace(/\bdot:\s*"/, "").replace(/"$/, "");
      const lightClass = value.split(" ")[0];
      expect(
        lightClass,
        `light-mode dot class "${lightClass}" in "${value}" should use shade 500`
      ).toMatch(/bg-\w+-500$/);
    }
  });

  it("avatarBg fields do not use very light shades (200 or 300) that are invisible on white", () => {
    const src = registrySrc();
    const avatarBgMatches = src.match(/\bavatarBg:\s*"([^"]+)"/g) ?? [];
    expect(avatarBgMatches.length).toBeGreaterThan(0);
    for (const match of avatarBgMatches) {
      const value = match.replace(/\bavatarBg:\s*"/, "").replace(/"$/, "");
      expect(
        value,
        `avatarBg "${value}" should not use a 200 or 300 shade (too light for white backgrounds)`
      ).not.toMatch(/bg-\w+-(200|300)$/);
    }
  });
});
