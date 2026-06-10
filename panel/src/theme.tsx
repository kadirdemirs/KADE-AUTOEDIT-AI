import React, { createContext, useContext, useEffect, useState } from "react";

// ── Palette ──────────────────────────────────────────────────────────────────

export interface Theme {
  name: "dark" | "light";
  bg: string;          // app background
  surface: string;     // card background
  surface2: string;    // nested / input background
  surfaceHover: string;
  border: string;
  text: string;        // primary text
  textDim: string;     // secondary / descriptions
  textFaint: string;   // hints
  accent: string;      // primary action
  accent2: string;     // secondary accent (gradients)
  accentText: string;  // text on accent
  good: string;
  bad: string;
  warn: string;
}

const DARK: Theme = {
  name: "dark",
  bg: "#16181d",
  surface: "#1f232b",
  surface2: "#272c36",
  surfaceHover: "#2c323d",
  border: "#333a45",
  text: "#f0f2f5",
  textDim: "#9aa3b2",
  textFaint: "#6b7280",
  accent: "#4a9eff",
  accent2: "#7c4dff",
  accentText: "#ffffff",
  good: "#4caf50",
  bad: "#ff5a5a",
  warn: "#ffb020",
};

const LIGHT: Theme = {
  name: "light",
  bg: "#f4f5f7",
  surface: "#ffffff",
  surface2: "#f0f2f5",
  surfaceHover: "#e9edf2",
  border: "#dfe3e8",
  text: "#1a1d23",
  textDim: "#5b6472",
  textFaint: "#9aa3b2",
  accent: "#2f7ff0",
  accent2: "#7c4dff",
  accentText: "#ffffff",
  good: "#2e9e4f",
  bad: "#e23c3c",
  warn: "#d98a00",
};

// ── Context ──────────────────────────────────────────────────────────────────

interface ThemeCtx {
  t: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ t: DARK, toggle: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [name, setName] = useState<"dark" | "light">(() => {
    try {
      return (localStorage.getItem("kade-theme") as "dark" | "light") || "dark";
    } catch {
      return "dark";
    }
  });

  const t = name === "dark" ? DARK : LIGHT;

  useEffect(() => {
    try {
      localStorage.setItem("kade-theme", name);
    } catch {
      /* uxp storage may be unavailable */
    }
    try {
      if (typeof document !== "undefined" && document.body) {
        document.body.style.background = t.bg;
        document.body.style.color = t.text;
      }
    } catch {
      /* uxp document may differ */
    }
  }, [name, t]);

  const toggle = () => setName((n) => (n === "dark" ? "light" : "dark"));

  return <Ctx.Provider value={{ t, toggle }}>{children}</Ctx.Provider>;
};

export const useTheme = (): ThemeCtx => useContext(Ctx);
