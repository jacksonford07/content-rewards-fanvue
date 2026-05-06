import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { initAnalytics } from "./lib/analytics"

// v1.2 M4 — fire-and-forget PostHog init. Gated on VITE_POSTHOG_KEY.
initAnalytics()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
