// Bettet src/vorab.js als Skript in index.html ein (specs/features/ladepfad-handy.md).
// Eingebettet und nicht als eigene Datei, damit der Vorabruf keinen eigenen Abruf braucht
// und startet, waehrend das Bundle noch laedt. "post", damit Vite das Skript nicht in das
// Bundle zieht; dann waere der Vorsprung wieder weg.
import fs from "node:fs";
import path from "node:path";
import { transformWithEsbuild } from "vite";

const QUELLE = path.resolve(import.meta.dirname, "src/vorab.js");
const AUFRUF = "\nvorabStarten(window, window.fetch.bind(window));\n";

export function vorabEinbetten() {
  return {
    name: "vorab-einbetten",
    transformIndexHtml: {
      order: "post",
      async handler() {
        const quelle = fs.readFileSync(QUELLE, "utf8") + AUFRUF;
        const { code } = await transformWithEsbuild(quelle, QUELLE, { minify: true, format: "esm" });
        return [{ tag: "script", attrs: { type: "module" }, children: code, injectTo: "head-prepend" }];
      },
    },
  };
}
