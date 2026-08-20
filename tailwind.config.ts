import type { Config } from 'tailwindcss';

// Semantic, light-first token system. No neon, no gradients as primary, no glow.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f6f6f3',          // warm near-white page
        surface: '#ffffff',     // content surface
        surface2: '#fbfbf9',    // subtle secondary fill
        ink: '#1b1e23',         // primary charcoal text
        ink2: '#5b616b',        // secondary text
        ink3: '#8a909a',        // tertiary / metadata
        line: '#e8e8e3',        // restrained border
        line2: '#d9d9d2',       // stronger border
        accent: '#1f5fd6',      // deep professional blue
        accentHover: '#184db0',
        accentSoft: '#eef3fc',  // very light accent fill
        success: '#2f8f52',
        successSoft: '#eef7f0',
        warning: '#b5730c',
        warningSoft: '#fbf4e9',
        danger: '#c8443a',
        dangerSoft: '#fbeeec',
        info: '#3f6ea6',
        infoSoft: '#eef3f8',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        meta: ['0.78rem', { lineHeight: '1.1rem' }],
        sm: ['0.875rem', { lineHeight: '1.35rem' }],
        base: ['0.95rem', { lineHeight: '1.6rem' }],
        lg: ['1.075rem', { lineHeight: '1.5rem' }],
        xl: ['1.35rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.1rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.5rem' }],
        hero: ['clamp(2.5rem, 5vw, 3.75rem)', { lineHeight: '1.04', letterSpacing: '-0.025em' }],
      },
      borderRadius: { md: '6px', lg: '10px', xl: '14px' },
      boxShadow: {
        subtle: '0 1px 2px rgba(20,22,26,0.04), 0 1px 3px rgba(20,22,26,0.05)',
        card: '0 1px 2px rgba(20,22,26,0.03), 0 4px 16px rgba(20,22,26,0.05)',
      },
      maxWidth: { content: '1120px' },
    },
  },
  plugins: [],
};

export default config;
