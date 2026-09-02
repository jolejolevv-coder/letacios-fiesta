/**
 * Laden und Zusammenfuehren der Statistikdateien.
 *
 * Die Dateien liegen als gzip verpacktes JSON neben der Seite. Ein statischer
 * Webserver liefert sie unveraendert aus, entpackt wird hier mit DecompressionStream.
 * Grund ist die Groesse: ein einzelner Tag im Bereich 25_1000 sind 4,8 MB nacktes
 * JSON und 0,41 MB gepackt. Ohne das waere ein tagesgenauer Zeitraum nicht ladbar.
 */

const zwischenspeicher = new Map();

/** Basis der Datendateien. Feste Wurzel, weil Adressen wie /matrix sonst danebengreifen. */
function basis() {
  return "/";
}

/**
 * Pfad zum Kartenbild.
 *
 * Manche Kennungen tragen ein vorangestelltes X, etwa XOP12-040 statt OP12-040. Ein
 * eigenes Bild dazu gibt es nirgends, gemeint ist dieselbe Karte. Fuer die Anzeige wird
 * das X deshalb abgestreift, in den Daten bleibt die Kennung unveraendert.
 */
export function bildpfad(id) {
  const ohneX = /^X([A-Z]{2,4}\d{2}-\d{3})$/.exec(String(id));
  return basis() + "img/" + (ohneX ? ohneX[1] : id) + ".jpg";
}

export const KARTE = /([A-Z]{2,4}\d{2}-\d{3}|P-\d{3})/;

export function kennung(text) {
  const t = KARTE.exec(String(text ?? ""));
  return t ? t[1] : String(text ?? "");
}

export function anzahl(text) {
  const t = /^(\d+)x/.exec(String(text ?? ""));
  return t ? parseInt(t[1], 10) : 1;
}

/* ---------------------------------------------------------------------------
   Passwort.

   Die Seite liegt statisch und oeffentlich auf GitHub Pages. Eine Abfrage, die nur
   etwas ein- und ausblendet, waere dort wirkungslos: die Datendateien laegen daneben.
   Deshalb sind die Daten selbst verschluesselt, AES-256-GCM, der Schluessel kommt aus
   PBKDF2 ueber das Passwort. Ohne Passwort laedt die Huelle, aber es gibt nichts zu
   sehen. Verschluesselt wird beim Bauen, siehe verschluesseln.py.

   Beim Entwickeln liegt keine schluessel.json neben der Seite. Dann laeuft alles
   unverschluesselt weiter, ohne Abfrage.
   --------------------------------------------------------------------------- */

let schluesselInfo;
let sitzungsSchluessel = null;

function ausBase64(text) {
  const roh = atob(text);
  const feld = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) feld[i] = roh.charCodeAt(i);
  return feld;
}

/** Liegt eine Verschluesselung vor? Gibt die Angaben zurueck oder false. */
export async function verschluesselung() {
  if (schluesselInfo !== undefined) return schluesselInfo;
  try {
    const antwort = await fetch(basis() + "schluessel.json", { cache: "no-cache" });
    schluesselInfo = antwort.ok ? await antwort.json() : false;
  } catch {
    schluesselInfo = false;
  }
  return schluesselInfo;
}

async function entschluesseln(schluessel, feld) {
  const iv = feld.slice(0, 12);
  const rest = feld.slice(12);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, schluessel, rest)
  );
}

/** Prueft das Passwort an der Probe und merkt sich den Schluessel fuer die Sitzung. */
export async function anmelden(passwort) {
  const info = await verschluesselung();
  if (!info) return true;
  const roh = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passwort), "PBKDF2", false, ["deriveKey"]
  );
  const schluessel = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ausBase64(info.salz), iterations: info.runden, hash: "SHA-256" },
    roh,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  try {
    const probe = await entschluesseln(schluessel, ausBase64(info.probe));
    if (new TextDecoder().decode(probe) !== "letacios-fiesta") return false;
  } catch {
    return false;
  }
  sitzungsSchluessel = schluessel;
  return true;
}

// Dateien, deren Inhalt sich unter demselben Namen nie mehr aendert: ein Replay,
// ein Tagesausschnitt, ein fertiger Satz. Sie tragen Datum oder Partie im Namen.
// Alles andere wird taeglich neu geschrieben und behaelt seinen Namen.
const UNVERAENDERLICH = /^(replays|tage|saetze)\//;

/** Holt eine .json.gz Datei und entpackt sie. Ergebnisse bleiben im Speicher. */
export async function holen(datei) {
  if (zwischenspeicher.has(datei)) return zwischenspeicher.get(datei);
  const versprechen = (async () => {
    const verschluesselt = sitzungsSchluessel !== null;
    // GitHub Pages liefert `max-age=600` fuer alles. Mit "no-cache" fragt der Browser
    // trotzdem bei jedem Abruf beim Server nach. Fuer die taeglich neu geschriebenen
    // Dateien ist das richtig, sonst saehe man bis zu zehn Minuten alte Zahlen. Fuer
    // die unveraenderlichen ist es verschenkt: ein Tagesausschnitt wiegt bis zu 400 KB
    // und wurde bisher bei jedem Wechsel des Zeitraums neu geholt.
    const antwort = await fetch(basis() + datei + (verschluesselt ? ".enc" : ""), {
      cache: UNVERAENDERLICH.test(datei) ? "default" : "no-cache",
    });
    if (!antwort.ok) throw new Error(datei + ": HTTP " + antwort.status);
    let puffer = await antwort.arrayBuffer();
    if (verschluesselt) {
      puffer = (await entschluesseln(sitzungsSchluessel, new Uint8Array(puffer))).buffer;
    }
    const kopf = new Uint8Array(puffer.slice(0, 2));
    // Manche Server entpacken gzip bereits selbst. Dann fehlt die Signatur 1f 8b.
    if (kopf[0] !== 0x1f || kopf[1] !== 0x8b) {
      return JSON.parse(new TextDecoder().decode(puffer));
    }
    if (typeof DecompressionStream !== "function") {
      throw new Error("Dieser Browser kann kein gzip entpacken.");
    }
    const strom = new Blob([puffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(strom).text());
  })();
  zwischenspeicher.set(datei, versprechen);
  return versprechen;
}

/**
 * Kartennamen, damit die Seite nicht nur Seriennummern zeigt.
 *
 * Quelle ist der Punk Records Datensatz, `aktualisieren.py` legt daraus namen.json.gz
 * neben die Seite. Faellt die Datei aus, bleibt die Nummer stehen; die Seite laeuft
 * weiter, sie ist nur karger.
 */
let kartenTabelle = null;

export async function kartenLaden() {
  if (kartenTabelle) return kartenTabelle;
  try {
    kartenTabelle = await holen("karten.json.gz");
  } catch {
    kartenTabelle = {};
  }
  return kartenTabelle;
}

const ZAEHLER = ["w", "l", "fw", "fl", "sw", "sl"];

/**
 * Fuehrt mehrere Tagesdateien zu einem Satz zusammen.
 *
 * Decklisten werden ueber die sortierte Kartenliste zusammengelegt, Matchups ueber die
 * Gegnerkennung. Dieselbe Rechnung macht `zusammenfuehren` in aktualisieren.py, und
 * dieselbe macht der OPBounty Client in `merge_statlists`.
 */
export function verschmelzen(saetze, name) {
  const leader = new Map();
  let partien = 0;
  let stand = "";
  // Die Quelle fuehrt Eintraege, die keine Karte sind, allen voran "Mobile". Das ist ein
  // Platzhalter fuer Partien vom Handy, kein Leader. Er taucht sonst in der Leiste, in der
  // Matrix und in der Rangliste auf und verzerrt jede davon.
  const istLeader = (id) => KARTE.test(String(id));

  for (const satz of saetze) {
    if (!satz) continue;
    partien += satz.partien || 0;
    if ((satz.stand || "") > stand) stand = satz.stand || "";
    for (const e of satz.leader || []) {
      if (!istLeader(e.id)) continue;
      let ziel = leader.get(e.id);
      if (!ziel) {
        ziel = { id: e.id, w: 0, l: 0, fw: 0, fl: 0, sw: 0, sl: 0,
                 dauerSumme: 0, dauerPartien: 0, gegner: new Map(), listen: new Map() };
        leader.set(e.id, ziel);
      }
      for (const f of ZAEHLER) ziel[f] += e[f] || 0;
      const spiele = (e.w || 0) + (e.l || 0);
      ziel.dauerSumme += (e.dur || 0) * spiele;
      ziel.dauerPartien += spiele;

      (e.geg || []).forEach((gid, i) => {
        if (!istLeader(gid)) return;
        let g = ziel.gegner.get(gid);
        if (!g) { g = { id: gid, m: 0, w: 0, fw: 0, fl: 0, sw: 0, sl: 0 }; ziel.gegner.set(gid, g); }
        g.m += (e.gm || [])[i] || 0;
        g.w += (e.gw || [])[i] || 0;
        g.fw += (e.gfw || [])[i] || 0;
        g.fl += (e.gfl || [])[i] || 0;
        g.sw += (e.gsw || [])[i] || 0;
        g.sl += (e.gsl || [])[i] || 0;
      });

      for (const li of e.listen || []) {
        const schluessel = [...li.d].sort().join("|");
        let z = ziel.listen.get(schluessel);
        if (!z) {
          z = { d: li.d, w: 0, l: 0, fw: 0, fl: 0, sw: 0, sl: 0, dauerSumme: 0, dauerPartien: 0 };
          ziel.listen.set(schluessel, z);
        }
        for (const f of ZAEHLER) z[f] += li[f] || 0;
        const s = (li.w || 0) + (li.l || 0);
        z.dauerSumme += (li.dur || 0) * s;
        z.dauerPartien += s;
      }
    }
  }

  const fertig = [...leader.values()].map((e) => ({
    id: e.id,
    w: e.w, l: e.l, fw: e.fw, fl: e.fl, sw: e.sw, sl: e.sl,
    dur: e.dauerPartien ? Math.round(e.dauerSumme / e.dauerPartien) : 0,
    gegner: [...e.gegner.values()].sort((a, b) => b.m - a.m),
    listen: [...e.listen.values()]
      .map((l) => ({ ...l, dur: l.dauerPartien ? Math.round(l.dauerSumme / l.dauerPartien) : 0 }))
      .sort((a, b) => b.w + b.l - (a.w + a.l)),
  }));
  fertig.sort((a, b) => b.w + b.l - (a.w + a.l));
  return { name, stand, partien, leader: fertig };
}

/** Ein fertiger Satz aus saetze/ hat schon die richtige Form, wird aber gleich behandelt. */
export async function satzLaden(datei, name) {
  const roh = await holen(datei);
  return verschmelzen([roh], name || roh.name || "");
}

export async function zeitraumLaden(dateien, name) {
  const teile = await Promise.all(dateien.map((d) => holen(d)));
  return verschmelzen(teile, name);
}
