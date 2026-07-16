import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Top-level safety net: if any component throws during render, show a minimal
// reload prompt instead of a blank white page. Inline styles only — this must
// render even if the app's own stylesheet failed to load or apply.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "1rem", padding: "2rem", textAlign: "center",
        background: "#1a1714", color: "#f0ebe0", fontFamily: "sans-serif",
      }}>
        <p style={{ fontSize: "1rem", fontWeight: 300 }}>문제가 발생했습니다. 새로고침해 주세요.</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase",
            color: "#b87355", border: "1px solid #b87355", background: "transparent",
            padding: "0.6rem 1.25rem", cursor: "pointer",
          }}
        >
          새로고침
        </button>
      </div>
    );
  }
}
