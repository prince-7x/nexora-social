export type ThemeId =
  | "amoled-pink"
  | "amoled-purple"
  | "amoled-cyan"
  | "amoled-sunset"
  | "amoled-emerald"
  | "amoled-crimson"
  | "amoled-mono";

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  gradient: string;
  desc: string;
};

export const THEMES: ThemeMeta[] = [
  { id: "amoled-pink",    name: "Neon Pink",   desc: "Default • Pink × Violet", gradient: "linear-gradient(135deg,#a855f7,#ec4899 50%,#fb923c)" },
  { id: "amoled-purple",  name: "Royal Purple",desc: "Deep violet glow",        gradient: "linear-gradient(135deg,#7c3aed,#a855f7 50%,#e879f9)" },
  { id: "amoled-cyan",    name: "Cyber Cyan",  desc: "Icy futuristic blue",     gradient: "linear-gradient(135deg,#0ea5e9,#22d3ee 50%,#5eead4)" },
  { id: "amoled-sunset",  name: "Sunset",      desc: "Warm orange × red",       gradient: "linear-gradient(135deg,#ef4444,#f97316 50%,#fbbf24)" },
  { id: "amoled-emerald", name: "Emerald",     desc: "Forest neon green",       gradient: "linear-gradient(135deg,#059669,#10b981 50%,#a3e635)" },
  { id: "amoled-crimson", name: "Crimson",     desc: "Bold blood red",          gradient: "linear-gradient(135deg,#b91c1c,#ef4444 50%,#f97316)" },
  { id: "amoled-mono",    name: "Mono Noir",   desc: "Pure black & white",      gradient: "linear-gradient(135deg,#525252,#e5e5e5 50%,#ffffff)" },
];

export const DEFAULT_THEME: ThemeId = "amoled-pink";
export const LS_THEME_KEY = "nexora_theme";

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
  try { localStorage.setItem(LS_THEME_KEY, id); } catch {}
}

export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const t = localStorage.getItem(LS_THEME_KEY) as ThemeId | null;
    if (t && THEMES.some(x => x.id === t)) return t;
  } catch {}
  return DEFAULT_THEME;
}
