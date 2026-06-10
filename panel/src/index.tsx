import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./theme";
import { ErrorBoundary } from "./ErrorBoundary";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
