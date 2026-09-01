import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

// base: "./" macht den Build ortsunabhaengig. Damit laeuft er sowohl unter der Wurzel
// einer Domain als auch in einem Unterverzeichnis wie /ladder/, ohne Neubau.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwind()],
  build: { outDir: "dist", assetsDir: "assets", chunkSizeWarningLimit: 900 },
});
