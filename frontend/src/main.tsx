import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource/atkinson-hyperlegible-mono/400.css";
import "../../design/tokens.css";
import "./styles/app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import { AuthProvider } from "./auth";
import { reportClientError } from "./api";

try {
  const t = localStorage.getItem("et-theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch { /* storage blocked: follow the system theme */ }

window.addEventListener("error", (e) => reportClientError(e.error ?? e.message, location.pathname));
window.addEventListener("unhandledrejection", (e) => reportClientError(e.reason, location.pathname));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
