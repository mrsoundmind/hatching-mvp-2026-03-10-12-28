// Shared design tokens — match Hatchin's brand palette and the LLM-ARCHITECTURE.pdf.
// Keep these in sync with the main app and the PDF builder script.

export const colors = {
  brand: '#6C82FF',
  brandSoft: '#A4B0FF',
  dark: '#1E2235',
  grey: '#5A6378',
  bgSoft: '#F4F6FB',
  white: '#FFFFFF',
  green: '#22A06B',
  red: '#D8504D',
  orange: '#E07A1B',

  // Per-role agent colors (used by TeamAssembling)
  rolePalette: [
    '#6C82FF', // Product Manager
    '#22A06B', // Engineer
    '#E07A1B', // Designer
    '#A05BFF', // Marketer
    '#D8504D', // Strategist
    '#1AA8C0', // Analyst
  ],
} as const;

export const typography = {
  display: '"Helvetica Neue", "Helvetica", "Arial", sans-serif',
  body: '"Helvetica Neue", "Helvetica", "Arial", sans-serif',
  mono: '"SF Mono", "Menlo", "Courier", monospace',
} as const;

export const fps = 30;

// Standard 1080p frame
export const videoConfig = {
  width: 1920,
  height: 1080,
  fps,
} as const;
