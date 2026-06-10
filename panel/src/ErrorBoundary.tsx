import React from "react";

// Catches any render/runtime error in the panel and shows it on screen instead of
// a blank white panel — so failures are visible and debuggable inside Premiere.
interface State {
  error: Error | null;
  info: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ error, info: info.componentStack });
    // eslint-disable-next-line no-console
    console.error("KADE panel crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            fontFamily: "monospace",
            fontSize: 12,
            color: "#ff6b6b",
            background: "#16181d",
            height: "100%",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>⚠️ Panel hatası</div>
          <div style={{ color: "#ffd166", marginBottom: 8 }}>{this.state.error.message}</div>
          <div style={{ color: "#9aa3b2", fontSize: 11 }}>{this.state.error.stack}</div>
          <div style={{ color: "#6b7280", fontSize: 10, marginTop: 10 }}>{this.state.info}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
