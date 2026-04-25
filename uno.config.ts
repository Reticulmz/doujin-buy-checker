import { defineConfig, presetUno, presetIcons } from "unocss";

export default defineConfig({
  presets: [presetUno(), presetIcons()],
  theme: {
    colors: {
      primary: {
        50: "#eff6ff",
        100: "#dbeafe",
        200: "#bfdbfe",
        300: "#93c5fd",
        400: "#60a5fa",
        500: "#3b82f6",
        600: "#2563eb",
        700: "#1d4ed8",
        800: "#1e40af",
        900: "#1e3a8a",
      },
      // Semantic tokens
      danger: {
        light: "#fef2f2",
        muted: "#fee2e2",
        DEFAULT: "#dc2626",
        emphasis: "#b91c1c",
        "dark-muted": "rgba(127,29,29,0.4)",
        "dark-text": "#fca5a5",
      },
      warning: {
        light: "#fefce8",
        muted: "#fef9c3",
        DEFAULT: "#ca8a04",
        emphasis: "#a16207",
        "dark-muted": "rgba(113,63,18,0.4)",
        "dark-text": "#fde047",
      },
      success: {
        light: "#f0fdf4",
        muted: "#dcfce7",
        DEFAULT: "#16a34a",
        emphasis: "#15803d",
        "dark-muted": "rgba(20,83,45,0.4)",
        "dark-text": "#86efac",
      },
      errand: {
        light: "#faf5ff",
        muted: "#f3e8ff",
        DEFAULT: "#9333ea",
        emphasis: "#7e22ce",
        "dark-muted": "rgba(88,28,135,0.4)",
        "dark-text": "#d8b4fe",
      },
    },
  },
  preflights: [
    {
      getCSS: () => `
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0.5; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-slide-up, .animate-fade-in { animation: none; }
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `,
    },
  ],
  shortcuts: {
    "btn": "px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-97",
    "btn-primary": "btn bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm",
    "btn-secondary": "btn bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600",
    "btn-danger": "btn bg-danger text-white hover:bg-danger-emphasis",
    "card": "bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 transition-shadow hover:shadow-md",
    "input-field": "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 transition-colors",
    "touch-target": "min-h-11 min-w-11 flex items-center justify-center",
    "glass": "backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/60 dark:border-gray-700/60",
    "chip": "px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
    "chip-active": "bg-primary-600 text-white shadow-sm",
    "chip-inactive": "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
    // Priority badges
    "badge-priority-1": "text-xs px-2 py-0.5 rounded-full font-bold bg-danger-muted text-danger-emphasis dark:bg-danger-dark-muted dark:text-danger-dark-text",
    "badge-priority-2": "text-xs px-2 py-0.5 rounded-full font-bold bg-warning-muted text-warning-emphasis dark:bg-warning-dark-muted dark:text-warning-dark-text",
    "badge-priority-3": "text-xs px-2 py-0.5 rounded-full font-bold bg-success-muted text-success-emphasis dark:bg-success-dark-muted dark:text-success-dark-text",
  },
});
