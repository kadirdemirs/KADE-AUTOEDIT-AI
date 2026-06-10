import React from "react";
import { useTheme } from "../theme";

// Shared, theme-aware UI building blocks. Every input is paired with an optional
// `hint` rendered beneath it — the "AutoCut" pattern where nothing is a mystery.

// ── Section header (icon + title + subtitle) ─────────────────────────────────

export const SectionHeader: React.FC<{
  icon?: string;
  title: string;
  subtitle?: string;
}> = ({ icon, title, subtitle }) => {
  const { t } = useTheme();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{title}</span>
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: t.textDim, marginTop: 4, lineHeight: 1.5 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

// ── Card ─────────────────────────────────────────────────────────────────────

export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  active?: boolean;
}> = ({ children, style, onClick, active }) => {
  const { t } = useTheme();
  return (
    <div
      onClick={onClick}
      style={{
        background: t.surface,
        border: `1px solid ${active ? t.accent : t.border}`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s, background 0.15s",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── Field: label + optional hint + control ───────────────────────────────────

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ label, hint, children, style }) => {
  const { t } = useTheme();
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: hint ? 2 : 6 }}>
        {label}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: t.textDim, marginBottom: 8, lineHeight: 1.45 }}>
          {hint}
        </div>
      )}
      {children}
    </div>
  );
};

// ── Primary button ───────────────────────────────────────────────────────────

export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  full?: boolean;
  style?: React.CSSProperties;
  title?: string;
}> = ({ children, onClick, disabled, variant = "primary", full, style, title }) => {
  const { t } = useTheme();
  const base: React.CSSProperties = {
    padding: "11px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    border: "none",
    width: full ? "100%" : undefined,
    transition: "opacity 0.15s, background 0.15s",
    opacity: disabled ? 0.5 : 1,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`, color: t.accentText },
    secondary: { background: t.surface2, color: t.text, border: `1px solid ${t.border}` },
    ghost: { background: "transparent", color: t.accent },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
};

// ── Inputs ──────────────────────────────────────────────────────────────────

export const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  style?: React.CSSProperties;
}> = ({ value, onChange, placeholder, onKeyDown, style }) => {
  const { t } = useTheme();
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "9px 10px",
        background: t.surface2,
        border: `1px solid ${t.border}`,
        color: t.text,
        borderRadius: 8,
        fontSize: 13,
        boxSizing: "border-box",
        outline: "none",
        ...style,
      }}
    />
  );
};

export const NumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  style?: React.CSSProperties;
}> = ({ value, onChange, min, max, step, label, style }) => {
  const { t } = useTheme();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0, ...style }}>
      {label && <span style={{ fontSize: 11, fontWeight: 600, color: t.textDim }}>{label}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          padding: "8px 9px",
          background: t.surface2,
          border: `1px solid ${t.border}`,
          color: t.text,
          borderRadius: 8,
          fontSize: 12,
          boxSizing: "border-box",
          outline: "none",
        }}
      />
    </label>
  );
};

// ── Select ──────────────────────────────────────────────────────────────────

export const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
}> = ({ value, onChange, options, style }) => {
  const { t } = useTheme();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "9px 10px",
        background: t.surface2,
        border: `1px solid ${t.border}`,
        color: t.text,
        borderRadius: 8,
        fontSize: 13,
        outline: "none",
        ...style,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
};

// ── Toggle row (checkbox + label + hint) ─────────────────────────────────────

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}> = ({ checked, onChange, label, hint }) => {
  const { t } = useTheme();
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14, cursor: "pointer" }}
    >
      <div
        style={{
          width: 38,
          height: 22,
          borderRadius: 11,
          background: checked ? t.accent : t.surface2,
          border: `1px solid ${checked ? t.accent : t.border}`,
          position: "relative",
          flexShrink: 0,
          transition: "background 0.15s",
          marginTop: 1,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 2,
            left: checked ? 18 : 3,
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
    </div>
  );
};

// ── Slider with live value + hint ────────────────────────────────────────────

export const Slider: React.FC<{
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, hint, value, min, max, step = 1, unit = "", onChange }) => {
  const { t } = useTheme();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>
          {value}
          {unit}
        </span>
      </div>
      {hint && <div style={{ fontSize: 11, color: t.textDim, margin: "2px 0 6px", lineHeight: 1.4 }}>{hint}</div>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: t.accent }}
      />
    </div>
  );
};

// ── File picker button ───────────────────────────────────────────────────────

export const FilePicker: React.FC<{
  file: File | null;
  onPick: (f: File | null) => void;
  accept?: string;
  placeholder?: string;
}> = ({ file, onPick, accept = "video/*,audio/*", placeholder = "Dosya seç..." }) => {
  const { t } = useTheme();
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "14px 12px",
        background: t.surface2,
        border: `1.5px dashed ${file ? t.accent : t.border}`,
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        color: file ? t.text : t.textDim,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 16 }}>{file ? "🎬" : "📁"}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{file ? file.name : placeholder}</span>
      <input
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
};

// ── Chips, badges and empty states ──────────────────────────────────────────

export const Chip: React.FC<{
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, active, onClick, color, style }) => {
  const { t } = useTheme();
  const fg = color || t.accent;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "4px 8px",
        borderRadius: 999,
        cursor: onClick ? "pointer" : "default",
        background: active ? `${fg}22` : t.surface2,
        color: active ? fg : t.textDim,
        border: `1px solid ${active ? fg : t.border}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export const Badge: React.FC<{
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, color, style }) => {
  const { t } = useTheme();
  const fg = color || t.accent;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 7px",
        borderRadius: 999,
        background: `${fg}1f`,
        color: fg,
        border: `1px solid ${fg}33`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  hint?: string;
}> = ({ icon, title, hint }) => {
  const { t } = useTheme();
  return (
    <div
      style={{
        textAlign: "center",
        padding: "28px 18px",
        color: t.textDim,
        border: `1px dashed ${t.border}`,
        borderRadius: 8,
        background: t.surface,
      }}
    >
      {icon && <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{title}</div>
      {hint && <div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 4 }}>{hint}</div>}
    </div>
  );
};

// ── Inline status banners ────────────────────────────────────────────────────

export const Banner: React.FC<{ kind: "error" | "info" | "success"; children: React.ReactNode }> = ({
  kind,
  children,
}) => {
  const { t } = useTheme();
  const colors = {
    error: { bg: "rgba(255,90,90,0.12)", fg: t.bad, icon: "⚠️" },
    info: { bg: "rgba(74,158,255,0.12)", fg: t.accent, icon: "ℹ️" },
    success: { bg: "rgba(76,175,80,0.14)", fg: t.good, icon: "✅" },
  }[kind];
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        background: colors.bg,
        color: colors.fg,
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 12,
        marginTop: 12,
        lineHeight: 1.45,
      }}
    >
      <span>{colors.icon}</span>
      <span>{children}</span>
    </div>
  );
};
