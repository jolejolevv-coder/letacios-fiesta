import { Component } from "react";

/**
 * Error Boundary (specs/features/haerten.md, P0-1).
 *
 * Wirft eine Ansicht beim Zeichnen, faengt diese Grenze den Fehler, statt dass React den
 * ganzen Baum abbaut und die Seite schwarz wird. Am 06.11.2026 ist genau das passiert: eine
 * geloeschte Komponente wurde noch benutzt, und Kopf und Reiter waren mit weg.
 *
 * Zwei Stufen: eine Grenze um den Inhalt jedes Reiters (der Aufrufer gibt ihr den Reiter
 * als key, so beginnt sie bei jedem Wechsel frisch) und eine letzte um die ganze App.
 *
 * Props:
 *   ersatz   Funktion (fehler) => Element, was statt des Inhalts erscheint.
 *   children der geschuetzte Inhalt.
 */
export default class Fehlergrenze extends Component {
  constructor(props) {
    super(props);
    this.state = { fehler: null };
  }

  static getDerivedStateFromError(fehler) {
    return { fehler };
  }

  componentDidCatch(fehler, info) {
    // In der Konsole bleibt die Spur, damit sich der Fehler finden laesst.
    console.error("Fehlergrenze:", fehler, info?.componentStack || "");
  }

  render() {
    if (this.state.fehler) return this.props.ersatz(this.state.fehler);
    return this.props.children;
  }
}

/** Ersatz fuer einen Reiter: Meldung und ein Weg zurueck zu Decklists. */
export function ReiterFehler({ zurueck }) {
  return (
    <div className="fehler-ersatz" role="alert">
      <p className="meldung fehler">This part of the page failed to load.</p>
      <a className="knopf rand" href="/decklists"
         onClick={(e) => {
           if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
           e.preventDefault();
           zurueck();
         }}>
        Back to Decklists
      </a>
    </div>
  );
}

/** Letzte Stufe um die ganze App: ohne Kopf und Reiter bleibt nur das Neuladen. */
export function AppFehler() {
  return (
    <div className="fehlerseite" role="alert">
      <p className="meldung fehler">Something went wrong and the page stopped.</p>
      <a className="knopf rand" href="/decklists">Reload the page</a>
    </div>
  );
}
