import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import Sombrero from "./Sombrero.jsx";
import {
  anmelden,
  anzahl,
  bildpfad,
  holen,
  kartenLaden,
  kennung,
  satzLaden,
  verschluesselung,
  zeitraumLaden,
} from "./daten.js";

/* --------------------------------------------------------------------------
   Kleine Helfer
   -------------------------------------------------------------------------- */

const proz = (w, g) => (g > 0 ? (100 * w) / g : 0);
const fmtProz = (w, g) => (g > 0 ? proz(w, g).toFixed(1) + " %" : "–");
const fmtZahl = (n) => (n || 0).toLocaleString("en-US");
const fmtDauer = (s) =>
  s ? Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0") : "–";

/** Standardfehler einer Winrate in Prozentpunkten. Ehrlicher als die blosse Zahl. */
const fehler = (g) => (g > 0 ? 100 * Math.sqrt(0.25 / g) : 0);

function farbe(w, g) {
  return proz(w, g) >= 50 ? "var(--sieg)" : "var(--niederlage)";
}

/* Die sechs Kartenfarben des Spiels. Sie sind echte Information aus dem Kartensatz und
   tragen die Seite optisch, ohne dass ich mir eine Dekoration ausdenken muss. */
const FARBEN = {
  r: "#d1495b", g: "#3f8f6b", b: "#3a6ea5",
  p: "#8b6bb1", s: "#70707c", y: "#d9b13d",
};

/** Verlauf ueber die Farben eines Leaders, fuer den Streifen an der Zeile. */
function farbverlauf(kuerzel) {
  const teile = String(kuerzel || "").split("").map((k) => FARBEN[k]).filter(Boolean);
  if (!teile.length) return "var(--liniestark)";
  if (teile.length === 1) return teile[0];
  return "linear-gradient(180deg, " + teile.join(", ") + ")";
}

/* --------------------------------------------------------------------------
   Bausteine
   -------------------------------------------------------------------------- */

function Bild({ id, className, alt = "", breite, hoehe }) {
  const [kaputt, setKaputt] = useState(false);
  if (kaputt) {
    return (
      <span
        className={
          className +
          " grid place-items-center text-[7px] leading-none zahl text-center px-[2px]"
        }
        style={{
          background: "var(--flaeche2)",
          border: "1px dashed var(--liniestark)",
          color: "var(--still)",
        }}
        title={id}
      >
        {id}
      </span>
    );
  }
  return (
    <img
      src={bildpfad(id)}
      alt={alt}
      width={breite}
      height={hoehe}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ background: "var(--flaeche2)" }}
      onError={() => setKaputt(true)}
    />
  );
}

/** Name gross, Seriennummer klein darunter. Faellt auf die Nummer zurueck. */
function LeaderName({ id, namen, klein = false }) {
  const nummer = kennung(id);
  const name = (namen[nummer] || {}).n;
  return (
    <span className="min-w-0">
      <span
        className={
          "block truncate font-semibold " + (klein ? "text-[13px]" : "text-sm")
        }
      >
        {name || nummer}
      </span>
      {name ? (
        <span className="zahl block text-[11px] leading-tight" style={{ color: "var(--still)" }}>
          {nummer}
        </span>
      ) : null}
    </span>
  );
}

function Balken({ w, g, schmal = false }) {
  return (
    <span
      className={"relative block overflow-hidden rounded-full " + (schmal ? "h-1.5" : "h-2")}
      style={{ background: "var(--niederlageweich)" }}
      aria-hidden="true"
    >
      <i
        className="absolute inset-y-0 left-0 block rounded-full"
        style={{ width: proz(w, g).toFixed(1) + "%", background: g < 30 ? "var(--liniestark)" : "var(--sieg)" }}
      />
    </span>
  );
}

/** Zahl, die beim Wechsel hochzaehlt. Ein bewusster Einsatz von GSAP, kein Zierrat. */
function Zaehler({ wert, nachkomma = 0, suffix = "" }) {
  const knoten = useRef(null);
  const alt = useRef(0);
  useEffect(() => {
    const el = knoten.current;
    if (!el) return;
    const objekt = { n: alt.current };
    const anim = gsap.to(objekt, {
      n: wert,
      duration: 0.5,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent =
          (nachkomma ? objekt.n.toFixed(nachkomma) : Math.round(objekt.n).toLocaleString("en-US")) +
          suffix;
      },
      onComplete: () => {
        alt.current = wert;
      },
    });
    return () => anim.kill();
  }, [wert, nachkomma, suffix]);
  return <span ref={knoten} className="zahl">0{suffix}</span>;
}

function Kennzahl({ etikett, kind, unter, nurGross = false }) {
  return (
    <div className={"grid gap-0.5" + (nurGross ? " hidden sm:grid" : "")}>
      <div className="etikett">{etikett}</div>
      <div
        className="breit text-[19px] font-bold leading-tight sm:text-[27px]"
        style={{ fontFamily: "var(--font-anzeige)", fontVariantNumeric: "tabular-nums" }}
      >
        {kind}
        {unter ? (
          <small className="ml-1.5 text-xs font-medium" style={{ color: "var(--still)" }}>
            {unter}
          </small>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Quellenwahl: fertige Saetze oder tagesgenauer Zeitraum
   -------------------------------------------------------------------------- */

function Quelle({ verzeichnis, wahl, setWahl, laedt }) {
  const tage = verzeichnis.tage || [];
  const modi = [...new Set(tage.map((t) => t.modus))];
  const bereiche = [...new Set(tage.filter((t) => t.modus === wahl.modus).map((t) => t.bounty))];
  const tageDesModus = tage
    .filter((t) => t.modus === wahl.modus && t.bounty === wahl.bounty)
    .map((t) => t.tag)
    .sort();
  const ersterTag = tageDesModus[0];
  const letzterTag = tageDesModus[tageDesModus.length - 1];

  const knopf =
    "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors border";
  const aktiv = { background: "var(--akzentweich)", borderColor: "var(--akzent)", color: "var(--akzent)" };
  const ruhend = { background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--leise)" };

  function preset(n) {
    if (!letzterTag) return;
    const ende = new Date(letzterTag + "T00:00:00Z");
    const start = new Date(ende);
    start.setUTCDate(start.getUTCDate() - (n - 1));
    setWahl({
      ...wahl,
      art: "zeitraum",
      von: start.toISOString().slice(0, 10),
      bis: letzterTag,
    });
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="etikett mr-1">Source</span>
        <button
          type="button"
          className={knopf}
          style={wahl.art === "satz" ? aktiv : ruhend}
          onClick={() => setWahl({ ...wahl, art: "satz" })}
        >
          Ready sets
        </button>
        <button
          type="button"
          className={knopf}
          style={wahl.art === "zeitraum" ? aktiv : ruhend}
          onClick={() => setWahl({ ...wahl, art: "zeitraum" })}
        >
          Date range
        </button>
        {laedt ? (
          <span className="etikett ml-2" style={{ color: "var(--akzent)" }}>
            loading ...
          </span>
        ) : null}
      </div>

      {wahl.art === "satz" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="etikett" htmlFor="satzWahl">
            Data set
          </label>
          <select
            id="satzWahl"
            className="rounded-md border px-2.5 py-1.5 text-sm"
            style={{ background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--text)" }}
            value={wahl.satz}
            onChange={(e) => setWahl({ ...wahl, satz: e.target.value })}
          >
            {(verzeichnis.saetze || []).map((s) => (
              <option key={s.schluessel} value={s.schluessel}>
                {s.name} ({fmtZahl(s.partien)} games)
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="etikett" htmlFor="von">
              from
            </label>
            <input
              id="von"
              type="date"
              className="rounded-md border px-2.5 py-1.5 text-sm zahl"
              style={{ background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--text)" }}
              value={wahl.von}
              min={ersterTag}
              max={wahl.bis}
              onChange={(e) => setWahl({ ...wahl, von: e.target.value })}
            />
            <label className="etikett" htmlFor="bis">
              to
            </label>
            <input
              id="bis"
              type="date"
              className="rounded-md border px-2.5 py-1.5 text-sm zahl"
              style={{ background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--text)" }}
              value={wahl.bis}
              min={wahl.von}
              max={letzterTag}
              onChange={(e) => setWahl({ ...wahl, bis: e.target.value })}
            />
            <span className="etikett">or</span>
            {[1, 3, 7, 14, 30].map((n) => (
              <button
                key={n}
                type="button"
                className="rounded-md border px-2 py-1 text-xs font-semibold"
                style={ruhend}
                onClick={() => preset(n)}
              >
                {n}d
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="etikett" htmlFor="modus">
              Queue
            </label>
            <select
              id="modus"
              className="rounded-md border px-2.5 py-1.5 text-sm"
              style={{ background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--text)" }}
              value={wahl.modus}
              onChange={(e) => setWahl({ ...wahl, modus: e.target.value })}
            >
              {modi.map((m) => (
                <option key={m} value={m}>
                  {(verzeichnis.modi || {})[m] || m}
                </option>
              ))}
            </select>
            <label className="etikett" htmlFor="bounty">
              Bounty
            </label>
            <select
              id="bounty"
              className="rounded-md border px-2.5 py-1.5 text-sm zahl"
              style={{ background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--text)" }}
              value={wahl.bounty}
              onChange={(e) => setWahl({ ...wahl, bounty: e.target.value })}
            >
              {bereiche.map((b) => (
                <option key={b} value={b}>
                  {(verzeichnis.bounty_name || {})[b] || b}
                </option>
              ))}
            </select>
            <span className="text-xs" style={{ color: "var(--still)" }}>
              {tageDesModus.length} days available, {ersterTag} to {letzterTag}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Decklisten
   -------------------------------------------------------------------------- */

function Deckliste({ liste }) {
  const g = liste.w + liste.l;
  const [kopiert, setKopiert] = useState(false);

  function kopieren() {
    const text = liste.d.map((e) => anzahl(e) + "x" + kennung(e)).join("\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setKopiert(true);
        setTimeout(() => setKopiert(false), 1500);
      },
      () => setKopiert(false)
    );
  }

  return (
    <article
      className="liste grid gap-5 rounded-lg border p-4 lg:grid-cols-[176px_minmax(0,1fr)]"
      style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
    >
      <div className="grid content-start gap-2">
        <div className="text-3xl font-bold leading-none zahl" style={{ color: farbe(liste.w, g) }}>
          {fmtProz(liste.w, g)}
        </div>
        <Balken w={liste.w} g={g} />
        <dl className="grid gap-1 text-[13px]" style={{ color: "var(--leise)" }}>
          {[
            ["Games", fmtZahl(g)],
            ["Record", liste.w + " – " + liste.l],
            ["Std. error", "± " + fehler(g).toFixed(1)],
            ["Going first", fmtProz(liste.fw, liste.fw + liste.fl)],
            ["Going second", fmtProz(liste.sw, liste.sw + liste.sl)],
            ["Duration", fmtDauer(liste.dur)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt>{k}</dt>
              <dd className="zahl font-semibold" style={{ color: "var(--text)" }}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={kopieren}
          className="mt-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors"
          style={{
            background: kopiert ? "var(--akzentweich)" : "var(--flaeche2)",
            borderColor: kopiert ? "var(--akzent)" : "var(--linie)",
            color: kopiert ? "var(--akzent)" : "var(--leise)",
          }}
        >
          {kopiert ? "Copied" : "Copy decklist"}
        </button>
      </div>

      <div className="flex flex-wrap content-start gap-1.5">
        {liste.d.map((eintrag, i) => {
          const id = kennung(eintrag);
          const n = anzahl(eintrag);
          return (
            <span key={id + i} className="relative block w-[46px] sm:w-[54px]">
              <Bild
                id={id}
                alt={id}
                breite={54}
                hoehe={76}
                className="block h-[65px] w-[46px] rounded-[3px] object-cover sm:h-[76px] sm:w-[54px]"
              />
              {n > 1 ? (
                <b
                  className="absolute -bottom-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold zahl"
                  style={{ background: "var(--akzent)", color: "var(--grund)" }}
                >
                  {n}
                </b>
              ) : null}
            </span>
          );
        })}
      </div>
    </article>
  );
}

/* --------------------------------------------------------------------------
   Matchups
   -------------------------------------------------------------------------- */

const SPALTEN = [
  { s: "name", t: "Opponent", links: true },
  { s: "partien", t: "Games" },
  { s: "wr", t: "Win rate" },
  { s: "w", t: "Wins" },
  { s: "l", t: "Losses" },
  { s: "first", t: "Going first" },
  { s: "second", t: "Going second" },
  { s: null, t: "" },
];

function Matchups({ leader, mindest, namen }) {
  const [sortiert, setSortiert] = useState({ nach: "partien", ab: true });

  const zeilen = useMemo(() => {
    const r = (leader.gegner || [])
      .filter((g) => g.m >= mindest)
      .map((g) => ({ ...g, id: kennung(g.id), l: g.m - g.w }));
    const { nach, ab } = sortiert;
    r.sort((a, b) => {
      let v;
      if (nach === "name") v = b.id.localeCompare(a.id);
      else if (nach === "wr") v = proz(a.w, a.m) - proz(b.w, b.m);
      else if (nach === "w") v = a.w - b.w;
      else if (nach === "l") v = a.l - b.l;
      else if (nach === "first") v = proz(a.fw, a.fw + a.fl) - proz(b.fw, b.fw + b.fl);
      else if (nach === "second") v = proz(a.sw, a.sw + a.sl) - proz(b.sw, b.sw + b.sl);
      else v = a.m - b.m;
      return ab ? -v : v;
    });
    return r;
  }, [leader, mindest, sortiert]);

  if (!zeilen.length) {
    return (
      <p className="py-10 text-center" style={{ color: "var(--still)" }}>
        No opponent reaches that game count.
      </p>
    );
  }

  return (
    <div
      className="tabellenhuelle overflow-x-auto rounded-lg border"
      style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
    >
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr>
            {SPALTEN.map((sp) => (
              <th
                key={sp.t}
                scope="col"
                className={
                  "sticky top-0 z-10 border-b px-3 py-2 etikett " +
                  (sp.links ? "text-left" : "text-right") +
                  (sp.s ? " cursor-pointer select-none" : "")
                }
                style={{
                  background: "var(--flaeche)",
                  borderColor: "var(--linie)",
                  color: sortiert.nach === sp.s ? "var(--akzent)" : "var(--still)",
                }}
                aria-sort={
                  sortiert.nach === sp.s ? (sortiert.ab ? "descending" : "ascending") : "none"
                }
                onClick={
                  sp.s
                    ? () =>
                        setSortiert((v) =>
                          v.nach === sp.s ? { nach: sp.s, ab: !v.ab } : { nach: sp.s, ab: true }
                        )
                    : undefined
                }
              >
                {sp.t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-[var(--flaeche2)]">
              <td className="border-b px-2 py-1.5 sm:px-3" style={{ borderColor: "var(--linie)" }}>
                <span className="flex items-center gap-2.5">
                  <Bild id={r.id} className="block h-9 w-[26px] rounded-[3px] object-cover" />
                  <LeaderName id={r.id} namen={namen} />
                </span>
              </td>
              <td className="border-b px-3 py-1.5 text-right zahl" style={{ borderColor: "var(--linie)" }}>
                {fmtZahl(r.m)}
              </td>
              <td
                className="border-b px-3 py-1.5 text-right zahl font-semibold"
                style={{ borderColor: "var(--linie)", color: farbe(r.w, r.m) }}
              >
                {fmtProz(r.w, r.m)}
              </td>
              <td className="border-b px-3 py-1.5 text-right zahl" style={{ borderColor: "var(--linie)" }}>
                {fmtZahl(r.w)}
              </td>
              <td className="border-b px-3 py-1.5 text-right zahl" style={{ borderColor: "var(--linie)" }}>
                {fmtZahl(r.l)}
              </td>
              <td className="border-b px-3 py-1.5 text-right zahl" style={{ borderColor: "var(--linie)" }}>
                {fmtProz(r.fw, r.fw + r.fl)}
              </td>
              <td className="border-b px-3 py-1.5 text-right zahl" style={{ borderColor: "var(--linie)" }}>
                {fmtProz(r.sw, r.sw + r.sl)}
              </td>
              <td className="border-b px-3 py-1.5" style={{ borderColor: "var(--linie)", width: 110 }}>
                <Balken w={r.w} g={r.m} schmal />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Matchupmatrix
   -------------------------------------------------------------------------- */

/** Farbe einer Zelle. Divergierend um 50 Prozent, gedeckelt bei 25 Punkten Abstand. */
function zellfarbe(wr, partien, mindest) {
  if (partien < mindest) return { background: "var(--flaeche2)", color: "var(--still)" };
  const abstand = Math.max(-1, Math.min(1, (wr - 50) / 25));
  const staerke = Math.abs(abstand);
  const ton = abstand >= 0 ? "var(--sieg)" : "var(--niederlage)";
  return {
    background: `color-mix(in srgb, ${ton} ${(14 + staerke * 62).toFixed(0)}%, var(--flaeche))`,
    color: staerke > 0.42 ? "var(--grund)" : "var(--text)",
  };
}

function Matrix({ satz, top, mindest, namen, sitzModus, setSitzModus }) {
  const leader = useMemo(
    () => satz.leader.filter((e) => e.listen.length > 0).slice(0, top),
    [satz, top]
  );
  const nachschlag = useMemo(() => {
    const m = new Map();
    for (const e of leader) m.set(e.id, new Map(e.gegner.map((g) => [g.id, g])));
    return m;
  }, [leader]);

  if (!leader.length) {
    return (
      <p className="py-10 text-center" style={{ color: "var(--still)" }}>
        No data in this range.
      </p>
    );
  }

  return (
    <div
      className="matrixhuelle overflow-auto rounded-lg border"
      style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
    >
      <table className="matrix border-collapse">
        <thead>
          <tr>
            <th
              className="sticky left-0 top-0 z-20 border-b border-r p-2 text-left etikett"
              style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
              scope="col"
            >
              <span className="hidden sm:inline">Row beats column</span>
              <span className="sm:hidden">vs</span>
            </th>
            {leader.map((e) => (
              <th
                key={e.id}
                scope="col"
                className="sticky top-0 z-10 border-b border-l p-1 sm:p-1.5"
                style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
              >
                <span className="grid justify-items-center gap-1" title={(namen[kennung(e.id)] || {}).n || ""}>
                  <Bild
                    id={kennung(e.id)}
                    breite={32}
                    hoehe={46}
                    className="block h-[38px] w-[27px] rounded-[3px] object-cover sm:h-[46px] sm:w-8"
                  />
                  <span
                    className="hidden text-[10px] font-semibold leading-tight sm:block"
                    style={{ color: "var(--still)" }}
                  >
                    {((namen[kennung(e.id)] || {}).n || kennung(e.id)).slice(0, 13)}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leader.map((zeile) => {
            const g = zeile.w + zeile.l;
            return (
              <tr key={zeile.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-r p-2 text-left"
                  style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
                >
                  <span className="flex items-center gap-2">
                    <Bild
                      id={kennung(zeile.id)}
                      breite={32}
                      hoehe={44}
                      className="block h-9 w-[26px] rounded-[3px] object-cover sm:h-11 sm:w-8"
                    />
                    <span className="hidden min-w-0 sm:block">
                      <LeaderName id={zeile.id} namen={namen} klein />
                      <span className="zahl block text-[11px]" style={{ color: "var(--still)" }}>
                        {fmtProz(zeile.w, g)}
                      </span>
                    </span>
                  </span>
                </th>
                {leader.map((spalte) => {
                  const treffer = (nachschlag.get(zeile.id) || new Map()).get(spalte.id);
                  const partien = treffer ? treffer.m : 0;
                  const wr = treffer ? proz(treffer.w, treffer.m) : 0;
                  const stil = zellfarbe(wr, partien, mindest);
                  const genug = partien >= mindest;
                  return (
                    <td
                      key={spalte.id}
                      className="cursor-pointer border-b border-l p-1 text-center align-middle"
                      style={{ borderColor: "var(--linie)", ...stil }}
                      onClick={() => setSitzModus(!sitzModus)}
                      title={
                        genug
                          ? fmtZahl(partien) + " games. Click to switch the whole matrix " +
                            (sitzModus ? "back to the overall rate." : "to first and second.")
                          : "too few games"
                      }
                    >
                      {!genug ? (
                        <span className="zahl block text-[13px] font-semibold leading-tight">–</span>
                      ) : sitzModus ? (
                        <span className="grid gap-0.5 leading-none">
                          <span className="zahl block text-[12px] font-semibold">
                            <span className="opacity-60">1st </span>
                            {proz(treffer.fw, treffer.fw + treffer.fl).toFixed(1)}
                          </span>
                          <span className="zahl block text-[12px] font-semibold">
                            <span className="opacity-60">2nd </span>
                            {proz(treffer.sw, treffer.sw + treffer.sl).toFixed(1)}
                          </span>
                        </span>
                      ) : (
                        <span className="zahl block text-[15px] font-semibold leading-tight">
                          {wr.toFixed(1)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Rangliste
   -------------------------------------------------------------------------- */

/**
 * Rating auf der vertrauten Skala bis 10.
 *
 * Die veroeffentlichten Ranglisten nennen eine solche Zahl, aber keine Formel. Aus zehn
 * abgelesenen Werten (OP12 Meta Report) laesst sie sich mit kleinsten Quadraten
 * annaehern: sie haengt vor allem am Logarithmus der Partienzahl und daneben an der
 * Winrate. R2 liegt bei 0,90, die groesste Abweichung bei 0,37 Punkten.
 *
 * Verankert wird am meistgespielten Leader des Datensatzes statt an einer festen
 * Konstante. Sonst kippt die Skala: die Vorlage hatte 13.526 Partien an der Spitze,
 * "Last Week Standard" hat 107.846, und eine absolute Formel liefe ueber die 10 hinaus.
 *
 *     Rating = 9,5 + 2,2727 * log10(Partien / Spitzenreiter) + 0,071 * (Winrate - 50)
 *
 * Das Rating misst damit vor allem Verbreitung, nicht Spielstaerke. Ein seltener Leader
 * mit guter Winrate steht bewusst unter einem haeufigen mit mittlerer.
 */
const RATING_ANKER = 9.5;
const RATING_LOG = 2.2727;
const RATING_WR = 0.071;
const rating = (g, spitze, wr) =>
  Math.max(0, Math.min(10, RATING_ANKER + RATING_LOG * Math.log10(g / spitze) + RATING_WR * (wr - 50)));

function Rangliste({ satz, namen }) {
  const [nach, setNach] = useState("partien");
  const gesamt = useMemo(
    () => satz.leader.reduce((s, e) => s + e.w + e.l, 0),
    [satz]
  );
  const zeilen = useMemo(() => {
    const gespielt = satz.leader.filter((e) => e.listen.length > 0);
    const spitze = Math.max(1, ...gespielt.map((e) => e.w + e.l));
    const r = gespielt.map((e) => {
      const g = e.w + e.l;
      const wr = proz(e.w, g);
      return { ...e, g, wr, rat: rating(g, spitze, wr), anteil: gesamt ? (100 * g) / gesamt : 0 };
    });
    r.sort((a, b) => {
      if (nach === "wr") return b.wr - a.wr;
      if (nach === "anteil") return b.anteil - a.anteil;
      if (nach === "rating") return b.rat - a.rat;
      return b.g - a.g;
    });
    // Wie die veroeffentlichten Ranglisten: nur die ersten zehn. Der lange Schwanz
    // besteht aus Leadern mit wenigen hundert Partien und sagt nichts ueber die Meta.
    return r.slice(0, 10);
  }, [satz, nach, gesamt]);

  const spalten = [
    ["partien", "Games"],
    ["anteil", "Share"],
    ["wr", "Win rate"],
    ["rating", "Rating"],
  ];

  return (
    <div
      className="tabellenhuelle overflow-x-auto rounded-lg border"
      style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
    >
      <table className="w-full min-w-[340px] border-collapse sm:min-w-[720px]">
        <thead>
          <tr>
            <th className="sticky top-0 border-b px-3 py-2 text-left etikett"
                style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }} scope="col">
              #
            </th>
            <th className="sticky top-0 border-b px-3 py-2 text-left etikett"
                style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }} scope="col">
              Leader
            </th>
            {spalten.map(([k, t]) => (
              <th
                key={k}
                scope="col"
                className="sticky top-0 cursor-pointer select-none border-b px-3 py-2 text-right etikett"
                style={{
                  background: "var(--flaeche)",
                  borderColor: "var(--linie)",
                  color: nach === k ? "var(--akzent)" : "var(--still)",
                }}
                aria-sort={nach === k ? "descending" : "none"}
                onClick={() => setNach(k)}
              >
                {t}
              </th>
            ))}
            <th className="sticky top-0 border-b px-3 py-2"
                style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }} />
          </tr>
        </thead>
        <tbody>
          {zeilen.map((e, i) => (
            <tr key={e.id} className="transition-colors hover:bg-[var(--flaeche2)]">
              <td className="border-b px-3 py-2 zahl text-sm" style={{ borderColor: "var(--linie)", color: "var(--still)" }}>
                {i + 1}
              </td>
              <td className="border-b px-3 py-2" style={{ borderColor: "var(--linie)" }}>
                <span className="flex items-center gap-2.5">
                  <Bild id={kennung(e.id)} className="block h-11 w-8 rounded-[3px] object-cover" />
                  <LeaderName id={e.id} namen={namen} />
                </span>
              </td>
              <td className="border-b px-3 py-2 text-right zahl" style={{ borderColor: "var(--linie)" }}>
                {fmtZahl(e.g)}
              </td>
              <td className="border-b px-3 py-2 text-right zahl" style={{ borderColor: "var(--linie)", color: "var(--leise)" }}>
                {e.anteil.toFixed(1)} %
              </td>
              <td
                className="border-b px-3 py-2 text-right zahl font-semibold"
                style={{ borderColor: "var(--linie)", color: farbe(e.w, e.g) }}
              >
                {fmtProz(e.w, e.g)}
              </td>
              <td
                className="border-b px-3 py-2 text-right zahl text-base font-bold"
                style={{
                  borderColor: "var(--linie)",
                  color: e.rat >= 8.5 ? "var(--sieg)" : e.rat >= 7 ? "var(--akzent)" : "var(--leise)",
                }}
              >
                {e.rat.toFixed(2)}
              </td>
              <td className="border-b px-3 py-2" style={{ borderColor: "var(--linie)", width: 130 }}>
                <Balken w={e.w} g={e.g} schmal />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Bestenliste

   Die Top 100 der Western Ladder. Die Daten kommen nicht vom CDN, sondern aus einem
   Mitschnitt der Spielverbindung; warum das so ist, steht in
   specs/features/bestenliste.md. Je Spieler liegt die Leaderaufstellung mit Sitzsplit
   vor, und die ist der eigentliche Gewinn: der Client selbst zeigt sie nicht.
   -------------------------------------------------------------------------- */

function Bestenliste({ daten, namen, oeffnen }) {
  const [suche, setSuche] = useState("");

  const [sortiert, setSortiert] = useState({ nach: "rang", ab: false });

  // Bilanz je Spieler aus der Leaderaufstellung. Die Zeile selbst traegt keine
  // Winrate; sie ergibt sich aus der Summe ueber die gespielten Leader.
  const angereichert = useMemo(
    () =>
      daten.spieler.map((e) => {
        const siege = (e.leader || []).reduce((a, l) => a + l.siege, 0);
        const partien = (e.leader || []).reduce((a, l) => a + l.partien, 0);
        return { ...e, siege, partien, wr: proz(siege, partien) };
      }),
    [daten]
  );

  const spieler = useMemo(() => {
    const s = suche.trim().toLowerCase();
    let r = s
      ? angereichert.filter((e) => (e.name || "").toLowerCase().includes(s))
      : angereichert;
    const n = sortiert.nach;
    r = [...r].sort((a, b) => {
      const va = a[n] ?? 0;
      const vb = b[n] ?? 0;
      return sortiert.ab ? vb - va : va - vb;
    });
    return r;
  }, [angereichert, suche, sortiert]);

  const stunden = (sek) => (sek / 3600).toFixed(1) + " h";

  // Gleiche Spaltendefinition wie in den uebrigen Tabellen der Seite: Sortierschluessel
  // am Kopf, Zahlen rechtsbuendig, Text links.
  // `nurGross` blendet die Spalte unter 640 Pixel aus. Rang, Name, Bounty und
  // Winrate tragen die Tabelle; Partien und Spielzeit sind dort Beiwerk.
  const SPALTEN = [
    { t: "#", s: "rang" },
    { t: "Player", links: true },
    { t: "Bounty", s: "bounty" },
    { t: "Games", s: "partien", nurGross: true },
    { t: "Win rate", s: "wr" },
    { t: "Time", s: "spielzeit", nurGross: true },
    { t: "Most played", links: true },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-1">
        <span className="flex items-center gap-2">
          <label className="etikett" htmlFor="spielerSuche">
            Search Player
          </label>
          <input
            id="spielerSuche"
            type="search"
            autoComplete="off"
            placeholder="name"
            className="w-36 rounded-md border px-2.5 py-1.5 text-sm"
            style={{ background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--text)" }}
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
        </span>
      </div>

      <div
        className="tabellenhuelle overflow-x-auto rounded-lg border"
        style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
      >
        <table className="w-full min-w-[340px] border-collapse sm:min-w-[720px]">
          <thead>
            <tr>
              {SPALTEN.map((sp) => (
                <th
                  key={sp.t}
                  scope="col"
                  className={
                    "sticky top-0 z-10 whitespace-nowrap border-b px-2 py-2 etikett sm:px-3 " +
                    (sp.links ? "text-left" : "text-right") +
                    (sp.s ? " cursor-pointer select-none" : "") +
                    (sp.nurGross ? " hidden sm:table-cell" : "")
                  }
                  style={{
                    background: "var(--flaeche)",
                    borderColor: "var(--linie)",
                    color: sortiert.nach === sp.s ? "var(--akzent)" : "var(--still)",
                  }}
                  aria-sort={
                    sortiert.nach === sp.s
                      ? sortiert.ab
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                  onClick={
                    sp.s
                      ? () =>
                          setSortiert((v) =>
                            v.nach === sp.s
                              ? { nach: sp.s, ab: !v.ab }
                              : { nach: sp.s, ab: true }
                          )
                      : undefined
                  }
                >
                  {sp.t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spieler.map((e) => {
              const top = (e.leader || [])[0];
              return (
                <Fragment key={e.login}>
                  {/* Die ganze Zeile fuehrt auf die Spielerseite. Ein Aufklappen
                      daneben gab es frueher; es zeigte dieselbe Aufstellung, die
                      dort ohnehin steht, und war ein zweites Ziel in derselben
                      Zeile. */}
                  <tr
                    className="cursor-pointer transition-colors hover:bg-[var(--flaeche2)]"
                    onClick={() => oeffnen(e.user_id)}
                  >
                    <td className="zahl border-b px-2 py-1.5 text-right sm:px-3"
                        style={{ borderColor: "var(--linie)", color: "var(--still)" }}>
                      {e.rang}
                    </td>
                    <td className="border-b px-2 py-1.5 font-semibold sm:px-3"
                        style={{ borderColor: "var(--linie)" }}>
                      {/* Der Name fuehrt auf die Spielerseite, die Zeile daneben
                          klappt nur die Aufstellung auf. Zwei Ziele in einer Zeile,
                          deshalb haelt der Name das Klicken auf. */}
                      <span style={{ color: "var(--akzent)" }}>{e.name}</span>
                    </td>
                    <td className="zahl whitespace-nowrap border-b px-2 py-1.5 text-right font-semibold sm:px-3"
                        style={{ borderColor: "var(--linie)" }}>
                      {fmtZahl(e.bounty)}
                    </td>
                    <td className="zahl hidden border-b px-2 py-1.5 text-right sm:table-cell sm:px-3"
                        style={{ borderColor: "var(--linie)", color: "var(--leise)" }}>
                      {fmtZahl(e.partien)}
                    </td>
                    <td
                      className="zahl whitespace-nowrap border-b px-2 py-1.5 text-right font-semibold sm:px-3"
                      style={{
                        borderColor: "var(--linie)",
                        color: e.partien ? farbe(e.siege, e.partien) : "var(--still)",
                      }}
                    >
                      {e.partien ? e.wr.toFixed(1) + " %" : "-"}
                    </td>
                    <td className="zahl hidden border-b px-2 py-1.5 text-right sm:table-cell sm:px-3"
                        style={{ borderColor: "var(--linie)", color: "var(--leise)" }}>
                      {stunden(e.spielzeit || 0)}
                    </td>
                    <td className="border-b px-2 py-1.5 sm:px-3" style={{ borderColor: "var(--linie)" }}>
                      {top ? (
                        <span className="flex items-center gap-2">
                          <Bild id={top.leader} breite={120} hoehe={168}
                                className="h-[38px] w-[27px] shrink-0 rounded-[3px] object-cover" />
                          {/* Auf dem Telefon traegt das Kartenbild die Aussage, der
                              Name kostet dort nur Breite. */}
                          <span className="hidden sm:contents">
                            <LeaderName id={top.leader} namen={namen} klein />
                            <span className="zahl text-xs" style={{ color: "var(--still)" }}>
                              {top.siege}&ndash;{top.niederlagen}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: "var(--still)" }}>no data</span>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!spieler.length ? (
        <p className="py-10 text-center" style={{ color: "var(--still)" }}>
          No player matches.
        </p>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------------
   Spielerseite

   Hinter dem Klick auf einen Namen in der Bestenliste. Zeigt die Leaderaufstellung
   und die letzten Partien mit Deckliste und Replay.

   Neun Partien sind das Maximum: der Server schreibt einen Schnappschuss der letzten
   neun ins Profil, mehr gibt es nicht. Wer viel spielt, bei dem faellt heraus, was
   der letzte Lauf nicht gesehen hat.
   -------------------------------------------------------------------------- */

// Der Eimer, in dem die Replays liegen. Kein Geheimnis, er steckt in jeder
// Installation des Spiels und steht in jeder Downloadadresse.
const SPEICHER = "opbounty-3623c.firebasestorage.app";

/**
 * Aus dem Storagepfad den Dateinamen der vorbereiteten Fassung bilden.
 * Muss zu `dateiname()` in replays_holen.py passen, sonst greift die Seite daneben.
 */
function dateiname(pfad) {
  const kurz = pfad.startsWith("Replays/") ? pfad.slice("Replays/".length) : pfad;
  return kurz.replace(/\.log$/, "").replace(/[^A-Za-z0-9._-]/g, "_") + ".json.gz";
}

function replayAdresse(pfad) {
  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    SPEICHER +
    "/o/" +
    encodeURIComponent(pfad) +
    "?alt=media"
  );
}

/* --------------------------------------------------------------------------
   Replay

   Das Log erzaehlt die Partie in Klartextzeilen, dazwischen liegen nach jedem Zug
   Zustandsabzuege beider Spieler:

       [Spieler] Attach 3 Don to Portgas D. Ace [OP16-001] (3 Total)
       [Spieler] Portgas D. Ace [OP16-001] attacking Rocks D. Xebec [OP17-039]
       Portgas D. Ace [OP16-001][8000] vs Rocks D. Xebec [OP17-039][5000]
       Rocks D. Xebec [OP17-039] hit for 1 damage
       [Spieler] Hand: [...]   Board: [...]   Trash: [...]   Life: 5

   Die Ansicht trennt beides: die Zuege erzaehlen, die Abzuege liefern den Stand am
   Zugende. Ohne diese Trennung liest sich das Log als Wand aus Kartennummern.
   -------------------------------------------------------------------------- */

const ZUSTAND = /^\[(.+?)\]\s+(Hand|Board|Trash|Life):\s*(.*)$/;
const SPRECHER = /^\[(.+?)\]\s*(.*)$/;
const LEADERZEILE = /^\[(.+?)\]\s+Leader is .+\[([A-Z]{2,4}\d{2}-\d{3})\]/;

function kartenliste(text) {
  return text.match(/[A-Z]{2,4}\d{2}-\d{3}/g) || [];
}

/**
 * Aus den Logzeilen Zuege bauen.
 *
 * Der Gewinn gegenueber einer Textliste steckt in den Zustandsabzuegen: sie fuehren
 * Hand, Board und Trash nicht als Zahl, sondern mit den Kartennummern. Damit laesst
 * sich das Brett am Ende jedes Zuges wirklich zeigen, statt es zu beschreiben.
 */
/* Die Zonencodes der Bewegungszeilen. Sie stehen als `enum CardZone` im
   Spielpaket; die Checkpointzeile bildet denselben Enum auf ihre Zaehler ab.
   Am 02.09.2026 an 311 Logs geprueft: die Bewegungen nachgespielt stimmen alle
   zehn Zaehler an allen 135.846 Checkpoints. */
const Z_DECK = 0, Z_HAND = 1, Z_CHARACTER = 2, Z_LIFE = 3;
const Z_DON_START = 4, Z_DON_FIELD = 5, Z_TRASH = 6, Z_STAGE = 7;
const Z_LEADER = 8, Z_DON_EQUIPPED = 9;

// Nur diese Zonen fuehren wir als Kartenliste. Deck und Don sind verdeckte
// Stapel, dort genuegt die Zahl aus dem Checkpoint.
const LISTENZONEN = {
  [Z_HAND]: "hand",
  [Z_CHARACTER]: "board",
  [Z_TRASH]: "trash",
  [Z_STAGE]: "stagekarten",
};

/**
 * Aus den Logzeilen eine Schrittliste bauen, eine Klartextzeile ein Schritt.
 *
 * Der Zustand kommt aus drei Quellen, jede mit ihrer Rolle:
 *   - die Bewegungszeilen fuehren die Karten von Zone zu Zone. Daraus entsteht die
 *     genaue Aufstellung nach jedem einzelnen Schritt.
 *   - die Checkpoints liefern die Zaehler. Sie sind die Wahrheit fuer Zahlen, auch
 *     fuer die verdeckten Stapel Deck und Don-Deck, deren Inhalt niemand kennt.
 *   - die Klartextzeilen sind die Erzaehlung und geben die Schritte vor.
 *
 * Frueher stand die Aufstellung nur an den Zugenden, weil sie aus den
 * Klartextabzuegen kam. Ein gespielter Charakter erschien dadurch erst Zuege
 * spaeter auf dem Brett.
 */
function schritteBauen(zeilen) {
  const leader = {};
  const zuName = {};
  const nummern = {};
  const schritte = [];

  let stand = {};
  let zug = 1;
  let amZug = null;

  const seite = (wer) => {
    let s = stand[wer];
    if (!s) {
      s = stand[wer] = { hand: [], board: [], trash: [], stagekarten: [],
                         angelegt: {} };
    }
    return s;
  };

  const kopie = () => {
    const k = {};
    for (const [wer, s] of Object.entries(stand)) {
      k[wer] = {
        ...s,
        hand: [...s.hand], board: [...s.board], trash: [...s.trash],
        stagekarten: [...s.stagekarten], angelegt: { ...s.angelegt },
      };
    }
    return k;
  };

  const anwenden = (m) => {
    const [nr, karte, vonZone, vonSlot, nachZone, nachSlot] = m;
    const wer = zuName[nr];
    if (!wer) return;
    const s = seite(wer);

    const vonName = LISTENZONEN[vonZone];
    if (vonName) {
      const liste = s[vonName];
      // Erst am gemeldeten Platz, sonst ueber die Kartennummer. Der Platz stimmt
      // fast immer; der Rueckfall faengt die wenigen Faelle ab, in denen der
      // Client eine Karte nennt, die er nie in diese Zone gelegt hat.
      let i = vonSlot >= 0 && vonSlot < liste.length && liste[vonSlot] === karte
        ? vonSlot
        : liste.indexOf(karte);
      if (i >= 0) liste.splice(i, 1);
    } else if (vonZone === Z_DON_EQUIPPED) {
      const wirt = Math.floor(vonSlot / 100);
      s.angelegt[wirt] = Math.max(0, (s.angelegt[wirt] || 0) - 1);
    }

    const nachName = LISTENZONEN[nachZone];
    if (nachName) {
      const liste = s[nachName];
      const i = Math.max(0, Math.min(nachSlot, liste.length));
      liste.splice(i, 0, karte);
    } else if (nachZone === Z_DON_EQUIPPED) {
      // Der Slot traegt hier das Ziel: 99xx ist der Leader, sonst Boardplatz
      // mal hundert plus laufende Nummer.
      const wirt = Math.floor(nachSlot / 100);
      s.angelegt[wirt] = (s.angelegt[wirt] || 0) + 1;
    }
  };

  for (const z of zeilen) {
    if (z.p) {
      zuName[z.p[0]] = z.p[1];
      nummern[z.p[1]] = z.p[0];
      leader[z.p[1]] = z.p[2];
      continue;
    }
    if (z.m) {
      anwenden(z.m);
      if (schritte.length) schritte[schritte.length - 1].stand = kopie();
      continue;
    }
    if (z.c) {
      const wer = zuName[z.c[0]];
      if (!wer) continue;
      const s = seite(wer);
      s.don = {
        deck: z.c[1], handzahl: z.c[2], boardzahl: z.c[3],
        donDeck: z.c[5], aktiv: z.c[6], trash: z.c[7],
        stage: z.c[8], gerastet: z.c[9],
      };
      if (z.c[4] > 0 || s.life !== undefined) s.life = z.c[4];
      if (schritte.length) schritte[schritte.length - 1].stand = kopie();
      continue;
    }

    const text = z.t;
    if (!text) continue;

    const ld = LEADERZEILE.exec(text);
    if (ld && !leader[ld[1]]) leader[ld[1]] = ld[2];

    // Die Klartextabzuege am Zugende werden nicht mehr gebraucht, die Aufstellung
    // kommt jetzt aus den Bewegungen. Sie bleiben als Schritt aussen vor.
    if (ZUSTAND.test(text)) continue;

    const spr = SPRECHER.exec(text);
    const wer = spr ? spr[1] : null;
    if (wer) amZug = wer;
    schritte.push({
      wer,
      text: spr ? spr[2] : text,
      karten: z.k || [],
      zug,
      amZug,
      stand: kopie(),
    });
    if (/End Turn/i.test(text)) zug += 1;
  }

  return { schritte, leader, nummern, zuege: zug };
}

/** Angelegtes Don unter einer Karte, als kleine Reihe. */
function AngelegtesDon({ n }) {
  if (!n) return null;
  return (
    <span className="dons">
      {Array.from({ length: Math.min(n, 10) }, (_, i) => <i key={i} />)}
    </span>
  );
}

/** Ein verdeckter Stapel mit seiner Zahl. Deck, Don-Deck und Trash liegen so. */
function Stapel({ n, art = "karte", leer = "leer" }) {
  if (!n) return <span className="stapel leer">{leer}</span>;
  return (
    <span className={"stapel " + art}>
      <span className="zahl">{n}</span>
    </span>
  );
}

/** Cost Area: aktive Don zuerst, danach die gerasteten gekippt und blass. */
function DonZone({ aktiv = 0, gerastet = 0 }) {
  if (!aktiv && !gerastet) return <span className="leer">kein Don</span>;
  return (
    <>
      {Array.from({ length: aktiv }, (_, i) => (
        <span key={"a" + i}><i /></span>
      ))}
      {Array.from({ length: gerastet }, (_, i) => (
        <span key={"r" + i} className="rest"><i /></span>
      ))}
    </>
  );
}

/** Die Lifekarten als leicht ueberlappender verdeckter Stapel. */
function LifeStapel({ n }) {
  if (!n) return <div className="lifestapel aus">0 Life</div>;
  return (
    <div className="lifestapel">
      {Array.from({ length: n }, (_, i) => <span key={i} className="lk" />)}
    </div>
  );
}

function Zone({ name, feld, className = "", children }) {
  return (
    <div className={(feld ? "feld " : "") + className}>
      <div className="zonenname">{name}</div>
      {children}
    </div>
  );
}

/**
 * Ein Spielerbrett im Zonenraster des Simulatorviewers.
 *
 * Die obere Seite wird um 180 Grad gedreht, damit sich beide Spieler
 * gegenueberliegen wie am Tisch. Gedreht wird nur das Raster ueber
 * grid-template-areas; die Karten bleiben aufrecht und damit lesbar.
 */
function Brett({ wer, nummer, stand, leader, namen, eigen, gedreht, amZug }) {
  const s = stand || {};
  const don = s.don || {};
  const hand = s.hand || [];
  const board = s.board || [];
  const angelegt = s.angelegt || {};
  const life = s.life || 0;

  return (
    <div className={"seite" + (amZug ? " amzug" : "")}>
      <div className="kopf">
        <span className="text-[13px] font-bold"
              style={{ color: eigen ? "var(--akzent)" : "var(--text)" }}>
          {wer.split("#")[0]}
          {amZug ? " · am Zug" : ""}
        </span>
        <span className="pille">Life <b>{life}</b></span>
        <span className="lifeleiste">
          {Array.from({ length: life }, (_, i) => <i key={i} />)}
        </span>
        <span className="pille">
          Don <b>{don.aktiv || 0}</b>/{(don.aktiv || 0) + (don.gerastet || 0)}
        </span>
        <span className="pille">Deck <b>{don.deck ?? "-"}</b></span>
        <span className="pille">Trash <b>{s.trash ? s.trash.length : don.trash ?? 0}</b></span>
        <span className="pille">Hand <b>{hand.length || don.handzahl || 0}</b></span>
      </div>

      <div className={"mat" + (gedreht ? " gedreht" : "")}>
        <div className="z-life"><LifeStapel n={life} /></div>

        <Zone name="Character Area" feld className="z-chars">
          <div className="karten">
            {board.length ? (
              board.map((k, i) => (
                <span key={k + i} className="platz">
                  <Bild id={k} breite={120} hoehe={168}
                        className="bkarte" alt={(namen[k] || {}).n || k} />
                  {/* Angelegtes Don steht unter der Karte, an der es haengt. Der
                      Slot der Bewegungszeile nennt den Boardplatz. */}
                  <AngelegtesDon n={angelegt[i] || 0} />
                </span>
              ))
            ) : (
              <span className="brettleer">leeres Board</span>
            )}
          </div>
        </Zone>

        <div className="feld z-mid">
          <div className="mitte">
            <div className="zonenpaar">
              <div className="zonenname">Leader</div>
              {leader ? (
                <span className="platz">
                  <Bild id={leader} breite={120} hoehe={168}
                        className="bkarte leader" alt={(namen[leader] || {}).n || leader} />
                  {/* Der Slot 99xx meint den Leader. */}
                  <AngelegtesDon n={angelegt[99] || 0} />
                </span>
              ) : (
                <Stapel n={0} />
              )}
            </div>
            <div className="zonenpaar">
              <div className="zonenname">Stage</div>
              {s.stagekarten && s.stagekarten.length ? (
                <Bild id={s.stagekarten[0]} breite={120} hoehe={168}
                      className="bkarte" alt={s.stagekarten[0]} />
              ) : (
                <Stapel n={don.stage || 0} />
              )}
            </div>
          </div>
        </div>

        <div className="zonenpaar z-deck">
          <div className="zonenname">Deck</div>
          <Stapel n={don.deck || 0} />
        </div>

        <div className="zonenpaar z-dond">
          <div className="zonenname">Don-Deck</div>
          <Stapel n={don.donDeck || 0} art="don" />
        </div>

        <Zone
          name={`Cost Area · ${don.aktiv || 0} aktiv, ${don.gerastet || 0} rested`}
          feld
          className="z-cost"
        >
          <div className="donzone">
            <DonZone aktiv={don.aktiv || 0} gerastet={don.gerastet || 0} />
          </div>
        </Zone>

        <div className="zonenpaar z-trash">
          <div className="zonenname">Trash</div>
          <Stapel n={s.trash ? s.trash.length : don.trash || 0} />
        </div>
      </div>

      <div className="zonenname" style={{ marginTop: 8 }}>Hand</div>
      <div className="hand">
        {hand.length ? (
          hand.map((k, i) => (
            <Bild key={k + i} id={k} breite={120} hoehe={168}
                  className="bkarte" alt={(namen[k] || {}).n || k} />
          ))
        ) : (
          <span className="brettleer">leere Hand</span>
        )}
      </div>
    </div>
  );
}

/** Ereignisart aus der Zeile ableiten, fuer die Farbe am linken Rand. */
function ereignisart(text) {
  if (/Leader is|Chose to go|Will select turn order/i.test(text)) return "start";
  if (/Has Connected|Version is|Waiting for/i.test(text)) return "info";
  if (/zieht|Drew card|Draw \d/i.test(text)) return "draw";
  if (/attacking|hit for|Destroyed|Attack Fails|Counter|\bvs\b/i.test(text)) return "kampf";
  return "effekt";
}

// 70 Prozent ist die Telefonstufe: bei voller Groesse passt ein Brett dort nicht
// nebeneinander und muss gescrollt werden.
const ZOOMSTUFEN = [0.7, 1, 1.3, 1.6, 2];
const TEMPO = [0.5, 1, 2, 4];

function Kartenband({ karten, namen }) {
  if (!karten || !karten.length) return null;
  return (
    <span className="ml-1.5 inline-flex gap-1 align-middle">
      {karten.slice(0, 3).map((k, i) => (
        <Bild key={k + i} id={k} breite={120} hoehe={168}
              className="inline-block h-[22px] w-[16px] rounded-[2px] object-cover align-middle"
              alt={(namen[k] || {}).n || k} />
      ))}
    </span>
  );
}

/**
 * @param eigenerLeader Kartennummer des Leaders, den der betrachtete Spieler
 *   gespielt hat. Der Ladder-Name taugt zur Zuordnung nicht: im Log stehen die
 *   Spielnamen, und die sind andere. FabaniniOvert heisst dort
 *   OvertimeChampanzini#2775. Ueber den Leader geht es zuverlaessig.
 */
function Replay({ pfad, namen, eigenerLeader, zurueck }) {
  const [zeilen, setZeilen] = useState(null);
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 720 ? 0.7 : 1
  );
  const [tempo, setTempo] = useState(1);
  const [laeuft, setLaeuft] = useState(false);
  const [logOffen, setLogOffen] = useState(false);
  const listeRef = useRef(null);

  useEffect(() => {
    let abgebrochen = false;
    setZeilen(null);
    setI(0);
    holen("replays/" + dateiname(pfad))
      .then((d) => !abgebrochen && setZeilen(d.zeilen || []))
      .catch(() => !abgebrochen && setZeilen(false));
    return () => {
      abgebrochen = true;
    };
  }, [pfad]);

  const { schritte, leader, zuege } = useMemo(
    () => (zeilen ? schritteBauen(zeilen) : { schritte: [], leader: {}, zuege: 0 }),
    [zeilen]
  );

  /* Abspielen, Schritt fuer Schritt. Am Ende haelt es von selbst an. */
  useEffect(() => {
    if (!laeuft || !schritte.length) return;
    const uhr = setTimeout(() => {
      setI((n) => {
        if (n >= schritte.length - 1) {
          setLaeuft(false);
          return n;
        }
        return n + 1;
      });
    }, 700 / tempo);
    return () => clearTimeout(uhr);
  }, [laeuft, tempo, i, schritte.length]);

  /* Tastatur: Leertaste spielt, Pfeile einen Schritt, Bild springt zehn. */
  useEffect(() => {
    function taste(e) {
      if (e.target.matches("input, textarea, select")) return;
      const max = schritte.length - 1;
      if (e.key === " ") { e.preventDefault(); setLaeuft((l) => !l); }
      else if (e.key === "ArrowRight") setI((n) => Math.min(max, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      else if (e.key === "PageDown") setI((n) => Math.min(max, n + 10));
      else if (e.key === "PageUp") setI((n) => Math.max(0, n - 10));
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [schritte.length]);

  /* Die laufende Zeile in der Liste sichtbar halten. */
  useEffect(() => {
    if (!logOffen || !listeRef.current) return;
    const el = listeRef.current.querySelector('[data-jetzt="1"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [i, logOffen]);

  if (zeilen === null) {
    return <p className="py-4 text-sm" style={{ color: "var(--still)" }}>Loading replay ...</p>;
  }
  if (zeilen === false || !schritte.length) {
    return (
      <p className="py-4 text-sm" style={{ color: "var(--still)" }}>
        No replay stored for this game. The client only uploads part of them.
      </p>
    );
  }

  const nr = Math.min(i, schritte.length - 1);
  const jetzt = schritte[nr];
  const spieler = Object.entries(leader).find(([, k]) => k === eigenerLeader)?.[0];
  const seiten = [...new Set(schritte.flatMap((s) => Object.keys(s.stand)))]
    .sort((a, b) => (a === spieler ? 1 : b === spieler ? -1 : 0));

  // Auf dem Telefon zaehlt Treffsicherheit, nicht Vollstaendigkeit. Dort bleiben
  // Zurueck, ein Schritt vor und zurueck, Abspielen; Tempo und Zoom stecken je in
  // einem Umschalter, der die Stufen durchgeht. Die Knoepfe sind dafuer groesser
  // als auf dem Rechner, nicht kleiner.
  const knopf =
    "rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors " +
    "hover:bg-[var(--flaeche2)] disabled:opacity-40 " +
    "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:px-2.5 sm:py-1.5";
  const nurGross = " hidden sm:inline-flex";
  const nurKlein = " sm:hidden";
  const weiter = (liste, wert) => liste[(liste.indexOf(wert) + 1) % liste.length];
  const stufe = (an) => ({
    background: an ? "var(--akzentweich)" : "var(--flaeche2)",
    borderColor: an ? "var(--akzent)" : "var(--linie)",
    color: an ? "var(--akzent)" : "var(--leise)",
  });

  return (
    <div className="brett" style={{ "--sk": zoom }}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:mb-4 sm:gap-x-6 sm:gap-y-2">
        {zurueck ? (
          <button type="button" onClick={zurueck} className={knopf}
                  style={{ borderColor: "var(--linie)", color: "var(--leise)" }}>
            &larr; Back
          </button>
        ) : null}

        <span className="flex items-center gap-1">
          <button type="button" className={knopf + nurGross} style={stufe(false)}
                  disabled={nr <= 0} onClick={() => setI(0)}>&#9198;</button>
          <button type="button" className={knopf} style={stufe(false)}
                  disabled={nr <= 0} onClick={() => setI((n) => Math.max(0, n - 1))}>&#9664;</button>
          <button type="button" className={knopf} style={stufe(laeuft)}
                  onClick={() => setLaeuft((l) => !l)}>
            {laeuft ? "\u23F8" : "\u25B6"}
          </button>
          <button type="button" className={knopf} style={stufe(false)}
                  disabled={nr >= schritte.length - 1}
                  onClick={() => setI((n) => Math.min(schritte.length - 1, n + 1))}>&#9654;</button>
          <button type="button" className={knopf + nurGross} style={stufe(false)}
                  disabled={nr >= schritte.length - 1}
                  onClick={() => setI(schritte.length - 1)}>&#9197;</button>
        </span>

        <span className={"items-center gap-1" + nurGross}>
          {TEMPO.map((t) => (
            <button key={t} type="button" className={knopf} style={stufe(tempo === t)}
                    onClick={() => setTempo(t)}>
              {t === 0.5 ? "\u00BDx" : t + "x"}
            </button>
          ))}
        </span>

        <span className={"items-center gap-1" + nurGross}>
          {ZOOMSTUFEN.map((z) => (
            <button key={z} type="button" className={knopf} style={stufe(zoom === z)}
                    onClick={() => setZoom(z)}>
              {Math.round(z * 100)}%
            </button>
          ))}
        </span>

        {/* Auf dem Telefon je ein Umschalter statt einer Reihe. */}
        <button type="button" className={knopf + nurKlein} style={stufe(tempo !== 1)}
                onClick={() => setTempo((t) => weiter(TEMPO, t))}>
          {tempo === 0.5 ? "\u00BDx" : tempo + "x"}
        </button>
        <button type="button" className={knopf + nurKlein} style={stufe(zoom !== 1)}
                onClick={() => setZoom((z) => weiter(ZOOMSTUFEN, z))}>
          {Math.round(zoom * 100)}%
        </button>

        <span className="zahl text-xs sm:text-sm" style={{ color: "var(--leise)" }}>
          {nr + 1} / {schritte.length}
          <span className="hidden sm:inline" style={{ color: "var(--still)" }}>
            {" "}&middot; Zug {jetzt.zug} / {zuege}
          </span>
        </span>

        <button type="button" className={knopf + " ml-auto"} style={stufe(logOffen)}
                onClick={() => setLogOffen((o) => !o)}>
          {logOffen ? "Ereignisse ausblenden" : "Ereignisse"}
        </button>
      </div>

      {/* Die laufende Zeile steht immer da, auch wenn die Liste zu ist. */}
      <div className="mb-3 rounded-lg border px-3 py-2"
           style={{ borderColor: "var(--linie)", background: "var(--flaeche)" }}>
        <p className="text-[13px] leading-tight">
          {jetzt.wer ? (
            <span className="mr-1.5 font-semibold"
                  style={{ color: jetzt.wer === spieler ? "var(--akzent)" : "var(--leise)" }}>
              {jetzt.wer.split("#")[0]}
            </span>
          ) : null}
          <span style={{ color: jetzt.wer ? "var(--text)" : "var(--still)" }}>{jetzt.text}</span>
          <Kartenband karten={jetzt.karten} namen={namen} />
        </p>
      </div>

      <div
        className={
          "grid gap-3 lg:items-start " +
          (logOffen ? "lg:grid-cols-[300px_minmax(0,1fr)]" : "lg:grid-cols-1")
        }
      >
        <div
          ref={listeRef}
          className={
            "max-h-[70vh] overflow-y-auto rounded-lg border p-3 " +
            (logOffen ? "" : "hidden")
          }
          style={{ borderColor: "var(--linie)", background: "var(--flaeche)" }}
        >
          <div className="grid gap-1.5">
            {schritte.map((s, j) => {
              const art = ereignisart(s.text);
              const dran = j === nr;
              return (
                <button
                  key={j}
                  type="button"
                  data-jetzt={dran ? "1" : "0"}
                  onClick={() => setI(j)}
                  className={"ereignis " + art + " w-full text-left"}
                  style={{
                    background: dran ? "var(--akzentweich)" : "transparent",
                    opacity: j > nr ? 0.45 : 1,
                  }}
                >
                  <div className="art">
                    {art} &middot; Zug {s.zug}
                  </div>
                  <div className="text-[13px] leading-tight">
                    {s.wer ? (
                      <span className="mr-1 font-semibold"
                            style={{ color: s.wer === spieler ? "var(--akzent)" : "var(--leise)" }}>
                        {s.wer.split("#")[0]}
                      </span>
                    ) : null}
                    {s.text}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2 overflow-x-auto">
          {seiten.map((n, k) => (
            <Brett
              key={n}
              wer={n}
              stand={jetzt.stand[n]}
              leader={leader[n]}
              namen={namen}
              eigen={n === spieler}
              gedreht={k === 0}
              amZug={jetzt.amZug === n}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Partie({ p, namen, replayOeffnen }) {
  const [offen, setOffen] = useState(false);
  const karten = (p.deck || []).slice(1);
  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--linie)", background: "var(--flaeche)" }}>
      {/* Feste Spalten statt fliessender Reihe: sonst wandert das "vs" je nach
          Namenslaenge, und die Zeilen stehen untereinander nicht auf einer Linie. */}
      <button
        type="button"
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-x-2 px-2 py-2.5 text-left sm:gap-x-3 sm:px-3"
        onClick={() => setOffen((o) => !o)}
      >
        <span
          className="zahl w-7 shrink-0 rounded px-1 py-0.5 text-center text-xs font-bold"
          style={{
            background: p.gewonnen ? "var(--siegweich)" : "var(--niederlageweich)",
            color: p.gewonnen ? "var(--sieg)" : "var(--niederlage)",
          }}
        >
          {p.gewonnen ? "W" : "L"}
        </span>
        {/* Eigene Seite: Bild links, Text rechts daneben. */}
        <span className="flex min-w-0 items-center gap-2">
          <Bild id={p.eigener_leader} breite={120} hoehe={168}
                className="h-[38px] w-[27px] shrink-0 rounded-[3px] object-cover" />
          {/* Auf dem Telefon ist der Name so kurz abgeschnitten, dass er nichts mehr
              sagt. Dort steht die Kartennummer, die exakt ist und passt; der Name
              kommt ab 640 Pixel dazu. */}
          <span className="min-w-0">
            <span className="hidden sm:block">
              <LeaderName id={p.eigener_leader} namen={namen} klein />
            </span>
            <span className="zahl block truncate text-[13px] font-semibold sm:hidden">
              {kennung(p.eigener_leader)}
            </span>
          </span>
        </span>

        <span className="px-1 text-xs" style={{ color: "var(--still)" }}>vs</span>

        {/* Gegnerseite gespiegelt: Text links, Bild rechts, alles rechtsbuendig. */}
        <span className="flex min-w-0 items-center justify-end gap-2">
          <span className="min-w-0 text-right">
            <span className="hidden truncate text-[13px] font-semibold sm:block">
              {(namen[p.gegner_leader] || {}).n || p.gegner_leader}
            </span>
            <span className="zahl block truncate text-[13px] font-semibold sm:hidden">
              {kennung(p.gegner_leader)}
            </span>
            <span className="block truncate text-xs" style={{ color: "var(--still)" }}>
              {p.gegner}
            </span>
          </span>
          <Bild id={p.gegner_leader} breite={120} hoehe={168}
                className="h-[38px] w-[27px] shrink-0 rounded-[3px] object-cover" />
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <span className="zahl hidden text-xs sm:block" style={{ color: "var(--still)" }}>
            {String(p.zeit).slice(0, 16).replace("T", " ")}
          </span>
          <span className="zahl w-12 text-right text-xs" style={{ color: "var(--still)" }}>
            {fmtDauer(p.dauer)}
          </span>
        </span>
      </button>

      {offen ? (
        <div className="border-t px-3 pb-3 pt-3" style={{ borderColor: "var(--linie)" }}>
          {karten.length ? (
            <div className="flex flex-wrap gap-1.5">
              {karten.map((k, i) => (
                <span key={k + i} className="relative block w-[46px] sm:w-[54px]">
                  <Bild id={kennung(k)} breite={120} hoehe={168}
                        className="h-[65px] w-[46px] rounded-[3px] object-cover sm:h-[76px] sm:w-[54px]" />
                  <span
                    className="zahl absolute -bottom-1 -right-1 min-w-[18px] rounded-full px-1 text-center text-[10px] font-bold"
                    style={{ background: "var(--akzent)", color: "#fff" }}
                  >
                    {anzahl(k)}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--still)" }}>
              No decklist recorded for this game.
            </p>
          )}
          {p.replay ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[var(--flaeche2)]"
                style={{ borderColor: "var(--linie)", color: "var(--akzent)" }}
                onClick={() => replayOeffnen(p.replay, p.eigener_leader)}
              >
                Watch replay
              </button>
              <a
                href={replayAdresse(p.replay)}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs underline"
                style={{ color: "var(--still)" }}
              >
                raw log
              </a>
            </div>
          ) : null}

        </div>
      ) : null}
    </div>
  );
}

function Spieler({ eintrag, daten, namen, zurueck, replayOeffnen }) {
  if (!eintrag) {
    return (
      <p className="py-10 text-center" style={{ color: "var(--still)" }}>
        This player is not in the current top 100.
      </p>
    );
  }
  const partien = (daten && daten.partien) || [];
  return (
    <>
      <button
        type="button"
        onClick={zurueck}
        className="mb-4 w-fit rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[var(--flaeche2)]"
        style={{ borderColor: "var(--linie)", color: "var(--leise)" }}
      >
        &larr; Leaderboard
      </button>

      <section className="pb-1">
        <h1 className="breit text-[22px] font-extrabold leading-[1.05] sm:text-[34px]"
            style={{ fontFamily: "var(--font-anzeige)", letterSpacing: "-0.015em" }}>
          {eintrag.name}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 sm:mt-5 sm:gap-x-9">
          <Kennzahl etikett="Rank" kind={<Zaehler wert={eintrag.rang} />} />
          <Kennzahl etikett="Bounty" kind={<span className="zahl">{fmtZahl(eintrag.bounty)}</span>} />
          {daten ? (
            <>
              <Kennzahl
                etikett="Win rate"
                kind={<Zaehler wert={daten.winrate || 0} nachkomma={1} suffix=" %" />}
              />
              <Kennzahl etikett="Record"
                        kind={<span className="zahl">{daten.siege}&ndash;{daten.niederlagen}</span>} />
            </>
          ) : null}
          <Kennzahl etikett="Games" kind={<Zaehler wert={eintrag.partien} />} nurGross />
        </div>
      </section>

      <h2 className="mt-5 text-base font-semibold">Leaders played</h2>
      <div className="grid gap-2">
        {(eintrag.leader || []).map((l) => (
          <div key={l.leader} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3">
            <Bild id={l.leader} breite={120} hoehe={168}
                  className="h-[46px] w-[34px] rounded-[3px] object-cover" />
            <span className="min-w-0">
              <LeaderName id={l.leader} namen={namen} klein />
              <span className="zahl block text-xs" style={{ color: "var(--still)" }}>
                {l.siege}&ndash;{l.niederlagen} in {l.partien} games
                {" · "}first {proz(l.erst_siege, l.erst_siege + l.erst_niederlagen).toFixed(1)} %
                {" · "}second {proz(l.zweit_siege, l.zweit_siege + l.zweit_niederlagen).toFixed(1)} %
              </span>
            </span>
            <span className="w-32 shrink-0">
              <Balken w={l.siege} g={l.partien} schmal />
            </span>
          </div>
        ))}
      </div>

      <h2 className="mt-5 text-base font-semibold">
        Recent games
        <span className="ml-2 text-xs font-normal" style={{ color: "var(--still)" }}>
          the profile keeps the last nine, nothing older exists
        </span>
      </h2>
      {partien.length ? (
        <div className="grid gap-2">
          {partien.map((p, i) => (
            <Partie key={(p.replay || "") + i} p={p} namen={namen}
                    replayOeffnen={replayOeffnen} />
          ))}
        </div>
      ) : (
        <p className="py-6" style={{ color: "var(--still)" }}>
          No recent games recorded for this player.
        </p>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
   Adressen

   Der Reiter steht im Pfad, der gewaehlte Leader als Abfrage dahinter. Damit ist jede
   Ansicht verlinkbar und der Zurueckknopf tut, was man erwartet.

   GitHub Pages liefert bei unbekannten Pfaden 404.html aus; die Action legt dort eine
   Kopie der Startseite ab, deshalb laedt /matrix auch beim direkten Aufruf.
   -------------------------------------------------------------------------- */

const PFADE = {
  decks: "/decklists",
  matchups: "/matchups",
  matrix: "/matrix",
  rang: "/rankings",
  beste: "/leaderboard",
  spieler: "/player",
  replay: "/replay",
};

function reiterAusPfad(pfad) {
  const treffer = Object.entries(PFADE).find(([, p]) => p === pfad.replace(/\/$/, ""));
  return treffer ? treffer[0] : "decks";
}

function adresseSetzen(reiter, leader, ersetzen, spielerId, replayPfad) {
  // Die Spielerseite haengt an einer user_id, die Replayseite am Storagepfad,
  // alle anderen Reiter am Leader.
  const abfrage =
    reiter === "replay"
      ? replayPfad
        ? "?p=" + encodeURIComponent(replayPfad)
        : ""
      : reiter === "spieler"
      ? spielerId
        ? "?id=" + encodeURIComponent(spielerId)
        : ""
      : leader
        ? "?leader=" + encodeURIComponent(kennung(leader))
        : "";
  const ziel = PFADE[reiter] + abfrage;
  if (window.location.pathname + window.location.search === ziel) return;
  window.history[ersetzen ? "replaceState" : "pushState"]({}, "", ziel);
}

/* --------------------------------------------------------------------------
   Schloss
   -------------------------------------------------------------------------- */

function Schloss({ aufSchliessen }) {
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  // Das Log steht standardmaessig zu: es traegt alles, aber das Brett ist das,
  // weswegen man hier ist.
  const [logOffen, setLogOffen] = useState(false);

  async function absenden(e) {
    e.preventDefault();
    if (!passwort || laeuft) return;
    setLaeuft(true);
    setFehler("");
    const ok = await anmelden(passwort);
    setLaeuft(false);
    if (!ok) {
      setFehler("That password does not fit.");
      setPasswort("");
      return;
    }
    try {
      localStorage.setItem("lf.pw", passwort);
    } catch {
      /* egal */
    }
    aufSchliessen();
  }

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <form onSubmit={absenden} className="w-full max-w-[340px] text-center">
        <span className="mx-auto mb-5 block w-fit">
          <Sombrero groesse={72} />
        </span>
        <h1 className="breit text-[26px] font-bold leading-tight">
          Letacios <span style={{ color: "var(--akzent)" }}>Fiesta</span>
        </h1>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          className="mt-5 w-full rounded-md border px-3 py-2 text-center"
          style={{
            background: "var(--flaeche2)",
            borderColor: fehler ? "var(--niederlage)" : "var(--linie)",
            color: "var(--text)",
          }}
        />
        <button
          type="submit"
          disabled={laeuft || !passwort}
          className="mt-3 w-full rounded-md px-3 py-2 text-sm font-semibold transition-opacity"
          style={{
            background: "var(--akzent)",
            color: "#fff",
            opacity: laeuft || !passwort ? 0.5 : 1,
          }}
        >
          {laeuft ? "Checking" : "Continue"}
        </button>
        {fehler ? (
          <p className="mt-3 text-sm" style={{ color: "var(--niederlage)" }}>
            {fehler}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Die Seite
   -------------------------------------------------------------------------- */

export default function App() {
  const [entsperrt, setEntsperrt] = useState(null);
  const [verzeichnis, setVerzeichnis] = useState(null);
  const [satz, setSatz] = useState(null);
  const [laedt, setLaedt] = useState(true);
  const [fehlerText, setFehlerText] = useState("");
  const [wahl, setWahl] = useState({
    art: "satz",
    satz: "Stats_lw",
    modus: "mode_0",
    bounty: "25_1000",
    von: "",
    bis: "",
  });
  const [gewaehlt, setGewaehlt] = useState(null);
  const [suche, setSuche] = useState("");
  const [sortLeader, setSortLeader] = useState("partien");
  const [reiter, setReiter] = useState(() => reiterAusPfad(window.location.pathname));
  const [mindest, setMindest] = useState(50);
  const [mindestGeg, setMindestGeg] = useState(100);
  const [sortListen, setSortListen] = useState("wr");
  const [karteFilter, setKarteFilter] = useState("");
  // Nur zwoelf Listen bauen. Sechzig auf einmal sind ueber tausend Kartenfelder und
  // machten den Wechsel auf den Decklistenreiter traege.
  const [sichtbar, setSichtbar] = useState(12);
  const [namen, setNamen] = useState({});
  // null heisst "noch nicht geholt", false heisst "nicht da". Beides ist erlaubt.
  const [beste, setBeste] = useState(null);
  const [spielerAlle, setSpielerAlle] = useState(null);
  const [spielerId, setSpielerId] = useState(
    () => new URLSearchParams(window.location.search).get("id") || null
  );
  // Der Leader, den der betrachtete Spieler in dieser Partie gespielt hat. Der
  // Viewer erkennt daran, welche Seite im Log die des Spielers ist; ueber den
  // Namen ginge es nicht, im Log stehen andere.
  const [replayLeader, setReplayLeader] = useState(null);
  const [replayPfad, setReplayPfad] = useState(
    () => new URLSearchParams(window.location.search).get("p") || null
  );
  const [matrixTop, setMatrixTop] = useState(12);
  const [matrixMindest, setMatrixMindest] = useState(50);
  const [sitzModus, setSitzModus] = useState(false);

  // Auf dem Telefon liegen die drei Decklistenfilter hinter einem Knopf. Ausgeklappt
  // kosten sie drei Zeilen, und die erste Liste rutscht dafuer aus dem Bild.
  const [filterOffen, setFilterOffen] = useState(false);

  const [quelleOffen, setQuelleOffen] = useState(false);
  const [leisteOffen, setLeisteOffen] = useState(false);

  const kopfRef = useRef(null);
  const quelleRef = useRef(null);
  const railRef = useRef(null);
  const buehneRef = useRef(null);

  /* Menue schliessen, wenn daneben geklickt oder Escape gedrueckt wird */
  useEffect(() => {
    if (!quelleOffen) return undefined;
    const klick = (e) => {
      if (quelleRef.current && !quelleRef.current.contains(e.target)) setQuelleOffen(false);
    };
    const taste = (e) => {
      if (e.key === "Escape") setQuelleOffen(false);
    };
    document.addEventListener("mousedown", klick);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", klick);
      document.removeEventListener("keydown", taste);
    };
  }, [quelleOffen]);

  /* Liegt eine Verschluesselung vor, und passt ein gemerktes Passwort noch? */
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const info = await verschluesselung();
      if (abgebrochen) return;
      if (!info) {
        setEntsperrt(true);
        return;
      }
      let gemerkt = null;
      try {
        gemerkt = localStorage.getItem("lf.pw");
      } catch {
        /* egal */
      }
      if (gemerkt && (await anmelden(gemerkt))) {
        if (!abgebrochen) setEntsperrt(true);
        return;
      }
      if (!abgebrochen) setEntsperrt(false);
    })();
    return () => {
      abgebrochen = true;
    };
  }, []);

  /* Kartennamen, unabhaengig vom Datensatz */
  useEffect(() => {
    if (entsperrt !== true) return;
    kartenLaden().then(setNamen);
  }, [entsperrt]);

  /* Bestenliste. Eigene Datei, eigener Rhythmus, und sie darf fehlen: faellt sie
     aus, bleibt der Reiter leer und der Rest der Seite laeuft weiter. */
  useEffect(() => {
    if (entsperrt !== true || beste !== null) return;
    if (reiter !== "beste" && reiter !== "spieler") return;
    let abgebrochen = false;
    holen("bestenliste.json.gz")
      .then((d) => !abgebrochen && setBeste(d))
      .catch(() => !abgebrochen && setBeste(false));
    return () => {
      abgebrochen = true;
    };
  }, [entsperrt, reiter, beste]);

  /* Die Partien je Spieler. Eigene Datei, nur fuer die Spielerseite gebraucht,
     und sie darf ebenso fehlen wie die Bestenliste. */
  useEffect(() => {
    if (entsperrt !== true || reiter !== "spieler" || spielerAlle !== null) return;
    let abgebrochen = false;
    holen("spieler.json.gz")
      .then((d) => !abgebrochen && setSpielerAlle(d))
      .catch(() => !abgebrochen && setSpielerAlle(false));
    return () => {
      abgebrochen = true;
    };
  }, [entsperrt, reiter, spielerAlle]);

  /* Adresse der Spielerseite mitfuehren. */
  useEffect(() => {
    if (entsperrt !== true || reiter !== "spieler") return;
    adresseSetzen("spieler", null, false, spielerId);
  }, [reiter, spielerId, entsperrt]);

  /* Adresse der Replayseite mitfuehren. */
  useEffect(() => {
    if (entsperrt !== true || reiter !== "replay") return;
    adresseSetzen("replay", null, false, null, replayPfad);
  }, [reiter, replayPfad, entsperrt]);

  /* Verzeichnis holen */
  useEffect(() => {
    if (entsperrt !== true) return undefined;
    holen("verzeichnis.json.gz")
      .then((v) => {
        setVerzeichnis(v);
        const tage = (v.tage || []).filter((t) => t.modus === "mode_0" && t.bounty === "25_1000");
        const letzter = tage.length ? tage[tage.length - 1].tag : "";
        const start = tage.length ? tage[Math.max(0, tage.length - 7)].tag : "";
        setWahl((w) => ({ ...w, von: start, bis: letzter }));
      })
      .catch((e) => {
        setFehlerText(
          "Data missing. Run `python3 aktualisieren.py --tage 30 --bilder` once. (" +
            e.message +
            ")"
        );
        setLaedt(false);
      });
    return undefined;
  }, [entsperrt]);

  /* Satz nach Wahl laden */
  useEffect(() => {
    if (!verzeichnis) return;
    let abgebrochen = false;
    setLaedt(true);
    setFehlerText("");
    const auftrag =
      wahl.art === "satz"
        ? (() => {
            const s = (verzeichnis.saetze || []).find((x) => x.schluessel === wahl.satz)
              || (verzeichnis.saetze || [])[0];
            return s ? satzLaden(s.datei, s.name) : Promise.reject(new Error("Data set missing"));
          })()
        : (() => {
            const dateien = (verzeichnis.tage || [])
              .filter(
                (t) =>
                  t.modus === wahl.modus &&
                  t.bounty === wahl.bounty &&
                  t.tag >= wahl.von &&
                  t.tag <= wahl.bis
              )
              .map((t) => t.datei);
            if (!dateien.length) return Promise.reject(new Error("No day in that range"));
            const name =
              wahl.von === wahl.bis
                ? wahl.von
                : wahl.von + " to " + wahl.bis + ", " + dateien.length + " days";
            return zeitraumLaden(dateien, name);
          })();

    auftrag
      .then((s) => {
        if (abgebrochen) return;
        setSatz(s);
        const gewuenscht = new URLSearchParams(window.location.search).get("leader");
        const ausAdresse = gewuenscht
          ? s.leader.find((e) => kennung(e.id) === gewuenscht)
          : null;
        const ersterMitListen =
          ausAdresse || s.leader.find((e) => e.listen.length > 0) || s.leader[0];
        setGewaehlt(ersterMitListen ? ersterMitListen.id : null);
        setLaedt(false);
      })
      .catch((e) => {
        if (abgebrochen) return;
        setFehlerText(e.message);
        setLaedt(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [verzeichnis, wahl.art, wahl.satz, wahl.modus, wahl.bounty, wahl.von, wahl.bis]);


  /* Einzug beim ersten Aufbau. Eine Bewegung, nicht drei. */
  useLayoutEffect(() => {
    if (!satz) return;
    const ctx = gsap.context(() => {
      gsap.from([kopfRef.current, railRef.current, buehneRef.current], {
        y: 14,
        opacity: 0,
        duration: 0.45,
        stagger: 0.07,
        ease: "power2.out",
      });
    });
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satz === null]);

  const leader = useMemo(
    () => (satz ? satz.leader.find((e) => e.id === gewaehlt) || satz.leader[0] : null),
    [satz, gewaehlt]
  );

  const leaderListe = useMemo(() => {
    if (!satz) return [];
    const q = suche.trim().toUpperCase();
    // Leader ohne eine einzige Deckliste im Zeitraum tauchen nicht auf. Sie haetten nur
    // eine leere Decklistenansicht, und in der Rangliste stehen sie ohnehin ganz unten.
    const r = satz.leader.filter(
      (e) => e.listen.length > 0 && (!q || String(e.id).toUpperCase().includes(q))
    );
    r.sort((a, b) => {
      if (sortLeader === "wr") return proz(b.w, b.w + b.l) - proz(a.w, a.w + a.l);
      if (sortLeader === "listen") return b.listen.length - a.listen.length;
      return b.w + b.l - (a.w + a.l);
    });
    return r;
  }, [satz, suche, sortLeader]);

  useEffect(() => {
    setSichtbar(12);
  }, [gewaehlt, mindest, sortListen, karteFilter, satz]);

  const listen = useMemo(() => {
    if (!leader) return [];
    const kf = karteFilter.trim().toUpperCase();
    const r = leader.listen.filter((l) => {
      if (l.w + l.l < mindest) return false;
      if (kf) return l.d.some((e) => String(e).toUpperCase().includes(kf));
      return true;
    });
    r.sort((a, b) => {
      if (sortListen === "partien") return b.w + b.l - (a.w + a.l);
      if (sortListen === "first") return proz(b.fw, b.fw + b.fl) - proz(a.fw, a.fw + a.fl);
      if (sortListen === "second") return proz(b.sw, b.sw + b.sl) - proz(a.sw, a.sw + a.sl);
      if (sortListen === "dauer") return b.dur - a.dur;
      return proz(b.w, b.w + b.l) - proz(a.w, a.w + a.l);
    });
    return r;
  }, [leader, mindest, sortListen, karteFilter]);

  // Weicht einer der drei Decklistenfilter vom Standard ab? Der Knopf traegt dann
  // einen Punkt, damit eingeklappt sichtbar bleibt, dass gefiltert wird.
  const filterAbweichend = mindest !== 50 || sortListen !== "wr" || karteFilter.trim() !== "";

  /* Adresse mitfuehren, sobald Reiter oder Leader stehen. */
  useEffect(() => {
    if (entsperrt !== true || !gewaehlt) return;
    adresseSetzen(reiter, gewaehlt, false);
  }, [reiter, gewaehlt, entsperrt]);

  /* Vor und Zurueck im Browser */
  useEffect(() => {
    const zurueck = () => {
      setReiter(reiterAusPfad(window.location.pathname));
      setSpielerId(new URLSearchParams(window.location.search).get("id") || null);
      setReplayPfad(new URLSearchParams(window.location.search).get("p") || null);
      const wunsch = new URLSearchParams(window.location.search).get("leader");
      if (wunsch && satz) {
        const treffer = satz.leader.find((e) => kennung(e.id) === wunsch);
        if (treffer) setGewaehlt(treffer.id);
      }
    };
    window.addEventListener("popstate", zurueck);
    return () => window.removeEventListener("popstate", zurueck);
  }, [satz]);

  if (entsperrt === null) return null;
  if (entsperrt === false) return <Schloss aufSchliessen={() => setEntsperrt(true)} />;

  if (fehlerText && !satz) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24">
        <div className="mb-4 flex items-center gap-3">
          <Sombrero groesse={40} />
          <h1 className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-anzeige)" }}>
            Letacios Fiesta
          </h1>
        </div>
        <p style={{ color: "var(--leise)" }}>{fehlerText}</p>
      </div>
    );
  }

  const leaderbezogen = reiter === "decks" || reiter === "matchups";

  const eingabe = {
    background: "var(--flaeche2)",
    borderColor: "var(--linie)",
    color: "var(--text)",
  };

  return (
    <>
      <header
        ref={kopfRef}
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{ background: "color-mix(in srgb, var(--flaeche) 92%, transparent)", borderColor: "var(--linie)" }}
      >
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5">
          <span className="flex items-center gap-2.5">
            <Sombrero groesse={34} />
            <span
              className="breit text-[18px] font-extrabold leading-none"
              style={{ fontFamily: "var(--font-anzeige)", letterSpacing: "-0.01em" }}
            >
              Letacios <span style={{ color: "var(--akzent)" }}>Fiesta</span>
            </span>
          </span>

          {/* Der Quellenchip. Er zeigt, was geladen ist, und oeffnet erst auf Klick die
              Bedienelemente. Vorher stand dafuer eine Kachel dauerhaft ueber dem Inhalt. */}
          <div className="relative" ref={quelleRef}>
            <button
              type="button"
              onClick={() => setQuelleOffen((o) => !o)}
              aria-expanded={quelleOffen}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
              style={{
                background: quelleOffen ? "var(--akzentweich)" : "var(--flaeche2)",
                borderColor: quelleOffen ? "var(--akzent)" : "var(--linie)",
                color: "var(--text)",
              }}
            >
              <span className="font-semibold">{satz ? satz.name : "loading"}</span>
              {satz ? (
                <span className="zahl text-xs" style={{ color: "var(--still)" }}>
                  {fmtZahl(satz.partien)}
                </span>
              ) : null}
              <svg width="10" height="7" viewBox="0 0 10 7" aria-hidden="true">
                <path d="M1 1.5 5 5.5 9 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
            {quelleOffen && verzeichnis ? (
              <div
                className="fixed inset-x-3 top-[112px] z-50 rounded-lg border sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:w-[min(92vw,640px)]"
                style={{
                  background: "var(--flaeche)",
                  borderColor: "var(--linie)",
                  boxShadow: "var(--schatten)",
                }}
              >
                <Quelle verzeichnis={verzeichnis} wahl={wahl} setWahl={setWahl} laedt={laedt} />
              </div>
            ) : null}
          </div>

          {laedt ? (
            <span className="etikett" style={{ color: "var(--akzent)" }}>
              loading
            </span>
          ) : null}

        </div>

        {/* Reiter im Kopf statt als eigenes Band. Spart eine ganze Zeile Bedienung
            ueber dem Inhalt und macht klar, dass sie die Seite umschalten. */}
        <nav
          className="hide-scroll mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-3 sm:px-5"
          role="tablist"
        >
          {[
            ["decks", "Decklists", "Decks"],
            ["matchups", "Matchups", "Matchups"],
            ["matrix", "Matchup matrix", "Matrix"],
            ["rang", "Power rankings", "Ranking"],
            ["beste", "Leaderboard", "Ladder"],
          ].map(([k, lang, kurz]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={reiter === k}
              onClick={() => setReiter(k)}
              className="-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors"
              style={{
                borderColor: reiter === k ? "var(--akzent)" : "transparent",
                color: reiter === k ? "var(--text)" : "var(--leise)",
              }}
            >
              <span className="sm:hidden">{kurz}</span>
              <span className="hidden sm:inline">{lang}</span>
            </button>
          ))}
        </nav>
        {/* Ladeband. Ein Zeitraum ueber dreissig Tage holt dreissig Dateien nach, ohne
            Rueckmeldung wirkt die Seite in dieser Sekunde eingefroren. */}
        <span
          aria-hidden="true"
          className="block h-[2px] overflow-hidden"
          style={{ background: laedt ? "var(--akzentweich)" : "transparent" }}
        >
          {laedt ? (
            <span
              className="block h-full w-1/3"
              style={{
                background: "var(--akzent)",
                animation: "lauf 1.1s ease-in-out infinite",
              }}
            />
          ) : null}
        </span>
      </header>

      <div
        className={
          "mx-auto grid max-w-[1500px] gap-5 px-3 pb-16 pt-5 sm:px-5 lg:items-start " +
          (leaderbezogen ? "lg:grid-cols-[320px_minmax(0,1fr)]" : "lg:grid-cols-1")
        }
      >
        {leaderbezogen ? (
        <aside
          ref={railRef}
          className="flex max-h-[70vh] flex-col overflow-hidden rounded-lg border lg:sticky lg:top-[112px] lg:max-h-[calc(100vh-132px)]"
          style={{ background: "var(--flaeche)", borderColor: "var(--linie)" }}
        >
          {/* Auf dem Telefon steht hier nur der gewaehlte Leader. Aufgeklappt haette die
              Liste sonst den ganzen ersten Bildschirm belegt, bevor Daten kommen. */}
          <button
            type="button"
            className="flex items-center gap-2.5 border-b p-3 text-left lg:hidden"
            style={{ borderColor: "var(--linie)" }}
            aria-expanded={leisteOffen}
            onClick={() => setLeisteOffen((o) => !o)}
          >
            {leader ? (
              <Bild id={kennung(leader.id)} className="block h-10 w-7 rounded-[3px] object-cover" />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="etikett block">Leader</span>
              <span className="block truncate text-sm font-semibold">
                {leader ? (namen[kennung(leader.id)] || {}).n || kennung(leader.id) : "–"}
              </span>
            </span>
            <svg
              width="12" height="8" viewBox="0 0 10 7" aria-hidden="true"
              style={{ transform: leisteOffen ? "rotate(180deg)" : "none", color: "var(--still)" }}
            >
              <path d="M1 1.5 5 5.5 9 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>

          <div
            className={
              (leisteOffen ? "grid" : "hidden") +
              " gap-2 border-b p-3 lg:grid"
            }
            style={{ borderColor: "var(--linie)" }}
          >
            <label className="etikett" htmlFor="suche">
              Leader
            </label>
            <input
              id="suche"
              type="search"
              autoComplete="off"
              placeholder="OP17-039 ..."
              className="w-full rounded-md border px-2.5 py-1.5 text-sm"
              style={eingabe}
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
          </div>
          <div
            className={
              (leisteOffen ? "flex" : "hidden") +
              " items-center justify-between border-b px-3 pb-2 lg:flex"
            }
            style={{ borderColor: "var(--linie)" }}
          >
            {[
              ["partien", "Games"],
              ["wr", "Win rate"],
              ["listen", "Lists"],
            ].map(([k, t]) => (
              <button
                key={k}
                type="button"
                className="etikett"
                aria-pressed={sortLeader === k}
                style={{ color: sortLeader === k ? "var(--akzent)" : "var(--still)" }}
                onClick={() => setSortLeader(k)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className={(leisteOffen ? "block" : "hidden") + " flex-1 overflow-y-auto lg:block"}>
            {leaderListe.map((e) => {
              const g = e.w + e.l;
              const id = kennung(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setGewaehlt(e.id);
                    setLeisteOffen(false);
                  }}
                  aria-current={e.id === (leader && leader.id)}
                  className="grid w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 border-b px-3 py-1.5 text-left transition-colors hover:bg-[var(--flaeche2)]"
                  style={{
                    borderColor: "var(--linie)",
                    background: e.id === (leader && leader.id) ? "var(--akzentweich)" : "transparent",
                  }}
                >
                  <span className="relative block">
                    <Bild id={id} className="block h-12 w-[34px] rounded-[3px] object-cover" />
                    <span
                      className="absolute -left-1.5 top-0 block h-full w-[2px] rounded-full"
                      style={{ background: farbverlauf((namen[id] || {}).f) }}
                    />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block truncate text-sm font-semibold"
                      style={{ color: e.id === (leader && leader.id) ? "var(--akzent)" : "var(--text)" }}
                    >
                      {(namen[id] || {}).n || id}
                    </span>
                    <span
                      className="zahl flex gap-3 text-xs"
                      style={{ color: "var(--still)" }}
                    >
                      <span>{fmtZahl(g)} games</span>
                      <span>{e.listen.length} {e.listen.length === 1 ? "list" : "lists"}</span>
                    </span>
                  </span>
                  <span className="zahl text-sm font-semibold" style={{ color: farbe(e.w, g) }}>
                    {fmtProz(e.w, g)}
                  </span>
                </button>
              );
            })}
            {!leaderListe.length ? (
              <p className="p-6 text-center text-sm" style={{ color: "var(--still)" }}>
                No leader matches that search.
              </p>
            ) : null}
          </div>
        </aside>
        ) : null}

        <main
          ref={buehneRef}
          className="grid min-w-0 gap-4 transition-opacity duration-200"
          style={{ opacity: laedt && satz ? 0.45 : 1 }}
        >
          {fehlerText ? (
            <p
              className="rounded-lg border px-4 py-3 text-sm"
              style={{ background: "var(--flaeche)", borderColor: "var(--niederlage)", color: "var(--niederlage)" }}
            >
              {fehlerText}
            </p>
          ) : null}

          {leader ? (
            <>
              {leaderbezogen ? (
              <section className="grid grid-cols-[66px_minmax(0,1fr)] gap-3 pb-1 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5">
                <span className="relative block">
                  <Bild
                    id={kennung(leader.id)}
                    breite={112}
                    hoehe={156}
                    className="h-[92px] w-[66px] rounded object-cover sm:h-[156px] sm:w-28"
                  />
                  <span
                    className="absolute -left-2 top-1 block w-[3px] rounded-full"
                    style={{
                      height: "calc(100% - 8px)",
                      background: farbverlauf((namen[kennung(leader.id)] || {}).f),
                    }}
                  />
                </span>
                <div>
                  <h1
                    className="breit text-[22px] font-extrabold leading-[1.05] sm:text-[34px]"
                    style={{
                      fontFamily: "var(--font-anzeige)",
                      textWrap: "balance",
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {(namen[kennung(leader.id)] || {}).n || kennung(leader.id)}
                  </h1>
                  <p className="zahl text-[13px]" style={{ color: "var(--still)" }}>
                    {kennung(leader.id)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 sm:mt-5 sm:gap-x-9 sm:gap-y-4">
                    <Kennzahl
                      etikett="Win rate"
                      kind={<Zaehler wert={proz(leader.w, leader.w + leader.l)} nachkomma={1} suffix=" %" />}
                      unter={"± " + fehler(leader.w + leader.l).toFixed(1)}
                    />
                    <Kennzahl etikett="Games" kind={<Zaehler wert={leader.w + leader.l} />} />
                    <Kennzahl etikett="Wins" kind={<Zaehler wert={leader.w} />} nurGross />
                    <Kennzahl etikett="Losses" kind={<Zaehler wert={leader.l} />} nurGross />
                    <Kennzahl
                      etikett="Going first"
                      kind={<Zaehler wert={proz(leader.fw, leader.fw + leader.fl)} nachkomma={1} suffix=" %" />}
                    />
                    <Kennzahl
                      etikett="Going second"
                      kind={<Zaehler wert={proz(leader.sw, leader.sw + leader.sl)} nachkomma={1} suffix=" %" />}
                    />
                    <Kennzahl etikett="Duration" kind={<span className="zahl">{fmtDauer(leader.dur)}</span>} nurGross />
                    <Kennzahl etikett="Lists" kind={<Zaehler wert={leader.listen.length} />} nurGross />
                  </div>
                </div>
              </section>
              ) : null}

              {reiter === "decks" ? (
                <>
                  {/* Nur auf dem Telefon: eine Zeile statt drei. Der Punkt zeigt, dass ein
                      Filter vom Standard abweicht, sonst waere eingeklappt nicht zu sehen,
                      dass gefiltert wird. */}
                  <div className="flex items-center justify-between gap-3 py-1 sm:hidden">
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors"
                      style={
                        filterOffen
                          ? { background: "var(--akzentweich)", borderColor: "var(--akzent)", color: "var(--akzent)" }
                          : { background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--leise)" }
                      }
                      aria-expanded={filterOffen}
                      onClick={() => setFilterOffen((o) => !o)}
                    >
                      Filters
                      {filterAbweichend ? (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "var(--akzent)" }}
                          aria-label="active"
                        />
                      ) : null}
                      <svg
                        width="10"
                        height="7"
                        viewBox="0 0 10 7"
                        aria-hidden="true"
                        style={{ transform: filterOffen ? "rotate(180deg)" : "none" }}
                      >
                        <path d="M1 1.5 5 5.5 9 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </button>
                    <span className="zahl text-[13px]" style={{ color: "var(--still)" }}>
                      {listen.length} of {leader.listen.length} lists
                    </span>
                  </div>

                  <div
                    className={
                      (filterOffen ? "flex" : "hidden") +
                      " flex-wrap items-center gap-x-5 gap-y-3 pb-2 sm:flex sm:py-1"
                    }
                  >
                    <span className="flex items-center gap-2">
                      <label className="etikett" htmlFor="mindest">
                        min
                      </label>
                      <input
                        id="mindest"
                        type="range"
                        min="1"
                        max="200"
                        value={mindest}
                        onChange={(e) => setMindest(+e.target.value)}
                        className="w-32"
                        style={{ accentColor: "var(--akzent)" }}
                      />
                      <span className="zahl w-8 text-sm">{mindest}</span>
                      <span className="etikett">games</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <label className="etikett" htmlFor="sortListen">
                        sort by
                      </label>
                      <select
                        id="sortListen"
                        className="rounded-md border px-2.5 py-1.5 text-sm"
                        style={eingabe}
                        value={sortListen}
                        onChange={(e) => setSortListen(e.target.value)}
                      >
                        <option value="wr">Win rate</option>
                        <option value="partien">Games</option>
                        <option value="first">Win rate going first</option>
                        <option value="second">Win rate going second</option>
                        <option value="dauer">Duration</option>
                      </select>
                    </span>
                    <span className="flex items-center gap-2">
                      <label className="etikett" htmlFor="karteFilter">
                        contains card
                      </label>
                      <input
                        id="karteFilter"
                        type="search"
                        autoComplete="off"
                        placeholder="OP17-041"
                        className="w-36 rounded-md border px-2.5 py-1.5 text-sm zahl"
                        style={eingabe}
                        value={karteFilter}
                        onChange={(e) => setKarteFilter(e.target.value)}
                      />
                    </span>
                    <span className="zahl hidden text-[13px] sm:inline" style={{ color: "var(--still)" }}>
                      {listen.length} of {leader.listen.length} lists
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {listen.slice(0, sichtbar).map((l, i) => (
                      <Deckliste key={l.d.join("|") + i} liste={l} />
                    ))}
                    {!listen.length ? (
                      <p className="py-10 text-center" style={{ color: "var(--still)" }}>
                        No list matches these filters.
                      </p>
                    ) : null}
                    {listen.length > sichtbar ? (
                      <button
                        type="button"
                        onClick={() => setSichtbar((n) => n + 36)}
                        className="mx-auto mt-1 rounded-md border px-4 py-2 text-sm font-semibold"
                        style={{
                          background: "var(--flaeche2)",
                          borderColor: "var(--linie)",
                          color: "var(--leise)",
                        }}
                      >
                        Show more, {listen.length - sichtbar} left
                      </button>
                    ) : null}
                  </div>
                </>
              ) : reiter === "matchups" ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-1">
                    <span className="flex items-center gap-2">
                      <label className="etikett" htmlFor="mindestGeg">
                        min
                      </label>
                      <input
                        id="mindestGeg"
                        type="range"
                        min="1"
                        max="1000"
                        value={mindestGeg}
                        onChange={(e) => setMindestGeg(+e.target.value)}
                        className="w-32"
                        style={{ accentColor: "var(--akzent)" }}
                      />
                      <span className="zahl w-10 text-sm">{mindestGeg}</span>
                      <span className="etikett">games</span>
                    </span>
                    <span className="zahl text-[13px]" style={{ color: "var(--still)" }}>
                      {(leader.gegner || []).filter((g) => g.m >= mindestGeg).length} of{" "}
                      {(leader.gegner || []).length} opponents
                    </span>
                  </div>
                  <p className="max-w-[74ch] pb-2 text-[13px]" style={{ color: "var(--still)" }}>
                    These are the matchups of {(namen[kennung(leader.id)] || {}).n || kennung(leader.id)} alone, the leader selected
                    on the left. For every leader against every other one, open the matchup
                    matrix.
                  </p>
                  <Matchups leader={leader} mindest={mindestGeg} namen={namen} />
                </>
              ) : reiter === "matrix" ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-1">
                    <span className="flex items-center gap-2">
                      <span className="etikett">top</span>
                      {[8, 12, 16, 20].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs font-semibold zahl"
                          style={
                            matrixTop === n
                              ? { background: "var(--akzentweich)", borderColor: "var(--akzent)", color: "var(--akzent)" }
                              : { background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--leise)" }
                          }
                          onClick={() => setMatrixTop(n)}
                        >
                          {n}
                        </button>
                      ))}
                      <span className="etikett">leaders</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <label className="etikett" htmlFor="matrixMindest">
                        min
                      </label>
                      <input
                        id="matrixMindest"
                        type="range"
                        min="1"
                        max="500"
                        value={matrixMindest}
                        onChange={(e) => setMatrixMindest(+e.target.value)}
                        className="w-32"
                        style={{ accentColor: "var(--akzent)" }}
                      />
                      <span className="zahl w-10 text-sm">{matrixMindest}</span>
                      <span className="etikett">games per cell</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSitzModus(!sitzModus)}
                      aria-pressed={sitzModus}
                      className="rounded-md border px-3 py-1.5 text-sm font-semibold"
                      style={
                        sitzModus
                          ? { background: "var(--akzentweich)", borderColor: "var(--akzent)", color: "var(--akzent)" }
                          : { background: "var(--flaeche2)", borderColor: "var(--linie)", color: "var(--leise)" }
                      }
                    >
                      {sitzModus ? "Showing first and second" : "Show first and second"}
                    </button>
                  </div>
                  <Matrix
                    satz={satz}
                    top={matrixTop}
                    mindest={matrixMindest}
                    namen={namen}
                    sitzModus={sitzModus}
                    setSitzModus={setSitzModus}
                  />
                </>
              ) : reiter === "rang" ? (
                <>
                  <Rangliste satz={satz} namen={namen} />
                </>
              ) : reiter === "replay" ? (
                <>
                  {replayPfad ? (
                    <Replay
                      pfad={replayPfad}
                      namen={namen}
                      eigenerLeader={replayLeader}
                      zurueck={() => setReiter(spielerId ? "spieler" : "beste")}
                    />
                  ) : (
                    <p className="py-10 text-center" style={{ color: "var(--still)" }}>
                      No replay selected.
                    </p>
                  )}
                </>
              ) : reiter === "spieler" ? (
                <>
                  {beste === null || spielerAlle === null ? (
                    <p className="py-10 text-center" style={{ color: "var(--still)" }}>
                      Loading ...
                    </p>
                  ) : (
                    <Spieler
                      eintrag={
                        beste && beste.spieler
                          ? beste.spieler.find(
                              (e) => String(e.user_id) === String(spielerId)
                            )
                          : null
                      }
                      daten={
                        spielerAlle && spielerAlle.spieler
                          ? spielerAlle.spieler[String(spielerId)]
                          : null
                      }
                      namen={namen}
                      zurueck={() => setReiter("beste")}
                      replayOeffnen={(pfad, ldr) => {
                        setReplayPfad(pfad);
                        setReplayLeader(ldr);
                        setReiter("replay");
                        window.scrollTo(0, 0);
                      }}
                    />
                  )}
                </>
              ) : (
                <>
                  {beste === null ? (
                    <p className="py-10 text-center" style={{ color: "var(--still)" }}>
                      Loading the ladder ...
                    </p>
                  ) : beste === false ? (
                    <p className="py-10 text-center" style={{ color: "var(--still)" }}>
                      No ladder snapshot available yet.
                    </p>
                  ) : (
                    <Bestenliste
                      daten={beste}
                      namen={namen}
                      oeffnen={(id) => {
                        setSpielerId(String(id));
                        setReiter("spieler");
                        window.scrollTo(0, 0);
                      }}
                    />
                  )}
                </>
              )}
            </>
          ) : null}
        </main>
      </div>
    </>
  );
}
