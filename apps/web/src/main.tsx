import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth";
import { App } from "./App";
import { LanguageProvider } from "./i18n";
import "bootstrap-icons/font/bootstrap-icons.css"; // іконки: лише шрифт і класи bi-*
import "./app.css";
import "./metrics.css";
import { applyTheme, storedTheme } from "./theme";
import { installFieldErrors } from "./fieldErrors";
import { i18n } from "./i18n.en";

applyTheme(storedTheme());
installFieldErrors(() => (i18n.language === "en" ? "en" : "uk"));

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
