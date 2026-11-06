import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { vorabEinbetten } from "./vite.vorab.js";

// base: "/" statt "./", seit die Seite auf einer eigenen Domain liegt und Adressen wie
// /matrix traegt. Relative Pfade wuerden dort je nach Schraegstrich anders aufgeloest.
export default defineConfig({
  base: "/",
  plugins: [react(), tailwind(), vorabEinbetten()],
  build: { outDir: "dist", assetsDir: "assets", chunkSizeWarningLimit: 900 },
});
