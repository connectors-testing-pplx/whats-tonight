import type { Config } from 'tailwindcss';

/**
 * Light theme, warm and premium. One accent, two language colours, nothing else.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F4F0',
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#F2EFE9',
          3: '#EBE7DF',
        },
        ink: {
          DEFAULT: '#16181D',
          2: '#4C505A',
          3: '#868B93',
        },
        line: {
          DEFAULT: '#E5E1D9',
          2: '#EFEBE3',
        },
        accent: {
          DEFAULT: '#A14E14',
          2: '#C9761F',
          soft: '#FBF1E2',
        },
        gold: '#C9971B',
        hindi: {
          DEFAULT: '#0C7355',
          soft: '#E5F3EE',
        },
        english: {
          DEFAULT: '#6D4FA8',
          soft: '#F0ECF8',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,24,29,.05), 0 12px 30px -16px rgba(22,24,29,.28)',
        soft: '0 1px 2px rgba(22,24,29,.05)',
        lift: '0 2px 4px rgba(22,24,29,.05), 0 24px 48px -24px rgba(22,24,29,.4)',
      },
      maxWidth: {
        phone: '448px',
      },
    },
  },
  plugins: [],
};

export default config;
