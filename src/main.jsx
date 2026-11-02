import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist/wght-italic.css";
import "@fontsource-variable/geist-mono/wght.css";
import "./index.css";

createRoot(document.getElementById("wurzel")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
