import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth";
import { App } from "./App";
import { LanguageProvider } from "./i18n";
import "./styles.css";
import { applyTheme, storedTheme } from "./theme";

applyTheme(storedTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
