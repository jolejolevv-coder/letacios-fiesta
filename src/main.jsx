import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Fehlergrenze, { AppFehler } from "./Fehlergrenze.jsx";
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist/wght-italic.css";
import "@fontsource-variable/geist-mono/wght.css";
import "./index.css";

createRoot(document.getElementById("wurzel")).render(
  <StrictMode>
    {/* Letzte Stufe: faellt etwas ausserhalb der Reitergrenze, bleibt eine Meldung statt Schwarz. */}
    <Fehlergrenze ersatz={() => <AppFehler />}>
      <App />
    </Fehlergrenze>
  </StrictMode>
);
