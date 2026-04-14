// Cyberpunk Theme Configuration for Pantheon Forge

export const cyberpunkTheme = {
  // Color Palette
  colors: {
    // Primary - Electric Cyan
    primary: {
      50: '#e6ffff',
      100: '#b3ffff',
      200: '#80ffff',
      300: '#4dffff',
      400: '#1affff',
      500: '#00f0ff', // Primary
      600: '#00c0cc',
      700: '#009099',
      800: '#006066',
      900: '#003033',
    },
    // Secondary - Neon Magenta
    secondary: {
      50: '#ffe6ff',
      100: '#ffb3ff',
      200: '#ff80ff',
      300: '#ff4dff',
      400: '#ff1aff',
      500: '#ff00ff', // Secondary
      600: '#cc00cc',
      700: '#990099',
      800: '#660066',
      900: '#330033',
    },
    // Accent - Neon Green
    accent: {
      50: '#e6ffe6',
      100: '#b3ffb3',
      200: '#80ff80',
      300: '#4dff4d',
      400: '#1aff1a',
      500: '#39ff14', // Accent
      600: '#2ecc0f',
      700: '#23990a',
      800: '#176607',
      900: '#0b3303',
    },
    // Warning - Neon Yellow
    warning: {
      50: '#fffde6',
      100: '#fffcb3',
      200: '#fffa80',
      300: '#fff84d',
      400: '#fff61a',
      500: '#f3ff00',
      600: '#c2cc00',
      700: '#919900',
      800: '#616600',
      900: '#303300',
    },
    // Error - Neon Red
    error: {
      50: '#ffe6e6',
      100: '#ffb3b3',
      200: '#ff8080',
      300: '#ff4d4d',
      400: '#ff1a1a',
      500: '#ff0033',
      600: '#cc0029',
      700: '#99001f',
      800: '#660014',
      900: '#33000a',
    },
    // Backgrounds - Dark/Deep
    background: {
      50: '#f0f0f5',
      100: '#e0e0eb',
      200: '#c0c0d1',
      300: '#a0a0b7',
      400: '#80809d',
      500: '#606083',
      600: '#404069',
      700: '#2a2a4f',
      800: '#1a1a35',
      900: '#0a0a1f',
    },
    // Surface layers
    surface: {
      primary: '#0a0a0f',   // Deepest dark
      secondary: '#12121a', // Slightly lighter
      tertiary: '#1a1a25',  // Panel background
      elevated: '#252532',  // Cards/modals
      hover: '#2f2f42',     // Hover states
    },
    // Text colors
    text: {
      primary: '#e0e0e8',
      secondary: '#a0a0b0',
      tertiary: '#707080',
      muted: '#505060',
      inverse: '#0a0a0f',
    },
    // Borders
    border: {
      default: '#2a2a3a',
      subtle: '#1f1f2a',
      highlight: '#3a3a4a',
      glow: 'rgba(0, 240, 255, 0.3)',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      mono: ['"Fira Code"', '"JetBrains Mono"', 'Consolas', 'Monaco', 'monospace'],
      sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      display: ['"Orbitron"', '"Exo 2"', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
    },
  },

  // Spacing
  spacing: {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '3rem',  // 48px
    '3xl': '4rem',  // 64px
  },

  // Border Radius
  borderRadius: {
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    '2xl': '1.5rem', // 24px
    full: '9999px',
  },

  // Shadows (with glow effects)
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
    md: '0 4px 6px rgba(0, 0, 0, 0.5)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.5)',
    // Glow effects
    glow: {
      cyan: '0 0 20px rgba(0, 240, 255, 0.5), 0 0 40px rgba(0, 240, 255, 0.3)',
      magenta: '0 0 20px rgba(255, 0, 255, 0.5), 0 0 40px rgba(255, 0, 255, 0.3)',
      green: '0 0 20px rgba(57, 255, 20, 0.5), 0 0 40px rgba(57, 255, 20, 0.3)',
    },
  },

  // Effects
  effects: {
    // Scanline overlay
    scanline: {
      background: 'linear-gradient(to bottom, rgba(0, 240, 255, 0.03) 50%, transparent 50%)',
      backgroundSize: '100% 4px',
    },
    // Grid pattern
    grid: {
      backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)',
      backgroundSize: '20px 20px',
    },
    // Glitch animation
    glitch: {
      '@keyframes glitch': {
        '0%, 100%': { transform: 'translate(0)' },
        '20%': { transform: 'translate(-2px, 2px)' },
        '40%': { transform: 'translate(-2px, -2px)' },
        '60%': { transform: 'translate(2px, 2px)' },
        '80%': { transform: 'translate(2px, -2px)' },
      },
    },
    // Pulse glow
    pulse: {
      '@keyframes pulse-glow': {
        '0%, 100%': { opacity: '1' },
        '50%': { opacity: '0.5' },
      },
    },
    // Shimmer effect
    shimmer: {
      background: 'linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.2), transparent)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 2s infinite',
    },
  },

  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    base: '250ms ease-in-out',
    slow: '350ms ease-in-out',
  },

  // Risk level colors
  riskLevel: {
    low: '#39ff14',
    medium: '#f3ff00',
    high: '#ff6b00',
    critical: '#ff0033',
  },
} as const;

export type Theme = typeof cyberpunkTheme;
