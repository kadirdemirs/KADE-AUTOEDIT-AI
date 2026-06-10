import React from "react";
import { useTheme } from "../theme";

interface Props {
  value: number;  // 0-100
  label?: string;
  color?: string;
}

export const ProgressBar: React.FC<Props> = ({
  value,
  label,
  color,
}) => {
  const { t } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const barColor = color || t.accent;

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: t.textDim,
            marginBottom: 3,
          }}
        >
          <span>{label}</span>
          <span>{clamped.toFixed(0)}%</span>
        </div>
      )}
      <div
        style={{
          width: "100%",
          height: 6,
          background: t.surface2,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: "100%",
            background: barColor,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
};
