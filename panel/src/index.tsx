import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./theme";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}
