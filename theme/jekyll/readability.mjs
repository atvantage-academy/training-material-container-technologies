/* =============================================================================
   readability.mjs – misst, wie schwer sich das gebaute `_site` liest.
   -----------------------------------------------------------------------------
   Aufruf:  node theme/jekyll/readability.mjs --site _site [--markdown bericht.md]

   WAS GEMESSEN WIRD. Zwei etablierte Formeln, je Sprache der Seite:

     Flesch-Reading-Ease   0–100, je höher desto leichter. Für Deutsch in der
                           Fassung von Amstad, für Englisch die Originalformel.
                           Dasselbe Maß, das Yoast in WordPress anzeigt.
     Wiener Sachtextformel Schulstufe für deutsche Sachtexte: 4 = sehr leicht,
                           15 = sehr schwer. Nur für Deutsch definiert.

   GEMESSEN WIRD DAS GEBAUTE HTML, nicht die Quelle. Drei Gründe: Die Sprache
   steht dort verbindlich im `<html lang>` – die Quelle weiß das je nach Ablage
   nicht. Der Inhaltsbereich lässt sich sauber herausschneiden, sodass
   Navigation und Fußzeile nicht mitzählen. Und Markdown-Auszeichnung ist
   bereits aufgelöst, statt als Sternchen im Wort zu stehen.

   NICHT GEMESSEN WIRD, was keine Prosa ist: Codeblöcke, Tabellen, Code-Spannen
   und visuell verborgener Text. Eine Feldtabelle ist keine schwere Sprache,
   sondern gar keine – zählte sie mit, sagte die Zahl nichts mehr.

   DIE ABHÄNGIGKEIT WIRD NICHT MITGELIEFERT. `@lunarisapp/readability` (MIT)
   bringt die Silbentrennmuster aller Sprachen mit und wiegt installiert rund
   48 MB – zu viel, um es wie axe-core ins Paket zu legen. Fehlt es, steigt
   dieser Lauf SICHTBAR aus, statt zu scheitern: Eine Prüfung, die nicht laufen
   kann, soll das sagen und nicht so tun, als sei alles in Ordnung.

   RÜCKGABEWERTE: 0 nichts unter der Schwelle, 1 Seiten unter der Schwelle,
   2 die Prüfung konnte nicht laufen (nur mit `--require-tool`).
   ============================================================================= */
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const arg = (name, standard) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : standard;
};
const SITE = path.resolve(arg("site", "_site"));
const MD_TARGET = arg("markdown", "");
const LABEL = arg("label", "");
/* DIE SCHWELLE IST EINSTELLBAR UND HAT EINEN GRUND. 40 ist im Flesch-Band die
   Grenze zu „schwer" (30–50 gilt als Hochschulniveau). Darunter liest sich ein
   Satz nicht mehr nebenbei – und Schulungsunterlagen werden nebenbei gelesen,
   zwischen zwei Übungen. Wer eine Referenz schreibt, darf die Schwelle senken;
   wer eine Einstiegsunterlage schreibt, sollte sie anheben. */
const THRESHOLD = Number(arg("min-flesch", "40"));
/* Kurze Seiten schwanken stark: Ein einziger Schachtelsatz reißt den Wert einer
   Seite mit 80 Wörtern nach unten, ohne dass die Seite schwer zu lesen wäre. */
const MIN_WORDS = Number(arg("min-words", "120"));
const NO_FAIL = process.argv.includes("--no-fail");
const REQUIRE_TOOL = process.argv.includes("--require-tool");
/* --- Eine Schreibweise für Ausschlussmuster --------------------------------
   DERSELBE BLOCK STEHT IN `a11y.mjs`. Zwei Werkzeuge, die über dieselbe Angabe
   verschieden urteilen, sind schlimmer als eines.

   `theme`, `/theme`, `theme/`, `/theme/` und `/theme/**` meinen DASSELBE -
   dieselbe Schreibweise wie bei `links.rb`, `contrast.rb` und `components.rb`.

   VERGLICHEN WIRD SEGMENTWEISE: `"/themes-overview".startsWith("/theme")` ist
   wahr, gemeint ist es nicht. Getroffen wird Gleichheit oder Präfix samt
   trennendem Schrägstrich - und damit auch die Adresse, die GENAU `/theme` ist. */
function musterNormalisieren(liste) {
  return liste
    .flatMap((x) => String(x).split(","))
    .map((x) => x.trim().replace(/\/\*\*$/, "").replace(/\/+$/, ""))
    .filter(Boolean)
    .map((x) => (x.startsWith("/") ? x : "/" + x))
    .filter((x) => x !== "/");
}

function ausgeschlossen(rel, muster) {
  const pfad = "/" + rel.split(path.sep).join("/");
  return muster.some((m) => pfad === m || pfad.startsWith(m + "/"));
}

const EXCLUDED = musterNormalisieren([arg("exclude", "theme/atvantage,theme/academy")]);
/* WAS DIE MESSUNG ANSIEHT - zwei Listen, eine Regel. Ohne `--include` ist alles
   erfasst, wie bisher. Mit `--include` zaehlt nur, was darauf passt; `--exclude`
   nimmt in beiden Faellen danach noch heraus.

   WARUM DER AUSSCHLUSS DEN EINSCHLUSS SCHLAEGT: Anders herum liesse sich ein
   einmal ausgenommener Zweig durch ein weiteres Einschlussmuster wieder
   hereinholen - welche Angabe dann gilt, entschiede die Reihenfolge. Dieselbe
   Regel steht in links.rb, contrast.rb und components.rb. */
const EINSCHLUSS = musterNormalisieren([arg("include", "")]);

function uebersprungen(rel) {
  if (EINSCHLUSS.length && !ausgeschlossen(rel, EINSCHLUSS)) return true;
  return ausgeschlossen(rel, EXCLUDED);
}


/* --- Das Messwerkzeug, falls vorhanden ------------------------------------ */
let TextReadability;
try {
  ({ TextReadability } = await import("@lunarisapp/readability"));
} catch {
 try {
  /* ZWEITER VERSUCH ÜBER EINEN AUSDRÜCKLICHEN PFAD. ESM sucht ein Paket von der
     IMPORTIERENDEN DATEI aus nach oben - `NODE_PATH` gilt dafür nicht. Liegt das
     Paket woanders (die Pipeline installiert es in ein eigenes Verzeichnis, um
     den Arbeitsbaum nicht anzufassen), sagt es das über diese Variable. */
  const dir = process.env.AVD_READABILITY_DIR;
  if (!dir) throw new Error("kein AVD_READABILITY_DIR");
  ({ TextReadability } = await import(
    path.join(path.resolve(dir), "node_modules", "@lunarisapp", "readability", "dist", "index.mjs")
  ));
 } catch {
  const hint =
    "Lesbarkeit NICHT gemessen - `@lunarisapp/readability` ist nicht installiert.\n" +
    "        Installieren:  npm install --no-save @lunarisapp/readability";
  if (REQUIRE_TOOL) {
    console.error("FEHLER: " + hint);
    process.exit(2);
  }
  console.log("Hinweis: " + hint);
  process.exit(0);
 }
}

/* --- Seiten einsammeln ---------------------------------------------------- */
async function htmlFiles(root) {
  const aus = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(root, p);
      if (uebersprungen(rel)) continue;
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(".html")) aus.push(p);
    }
  }
  await walk(root);
  return aus.sort();
}

/* --- Prosa aus einer Seite schneiden -------------------------------------- */
/* Der Inhaltsbereich trägt `id="avd-academy-content"`. Fehlt er - etwa in einer
   eigenständigen HTML-Datei ohne Layout -, wird die Seite NICHT ersatzweise
   ganz gemessen: Dann zählten Navigation und Fußzeile mit, und zwar auf jeder
   Seite gleich, was jeden Unterschied zwischen den Seiten einebnete. */
const CONTENT_AREA = /<(main|div)\b[^>]*\bid="avd-academy-content"[^>]*>([\s\S]*?)<\/\1>/i;

function prose(html) {
  const m = html.match(CONTENT_AREA);
  if (!m) return null;
  let t = m[2];
  t = t.replace(/<(script|style|pre|table|figure)\b[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<code\b[\s\S]*?<\/code>/gi, " ");
  /* Visuell verborgener Text ist Beschriftung für Vorlesehilfen, keine Prosa. */
  t = t.replace(/<(\w+)\b[^>]*\bclass="[^"]*\bavd-academy-visually-hidden\b[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
       .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  t = t.replace(/&[a-z]+;|&#\d+;/gi, " ");
  return t.replace(/\s+/g, " ").trim();
}

function language(html) {
  const m = html.match(/<html\b[^>]*\blang="([a-z]{2})/i);
  return m ? m[1].toLowerCase() : "de";
}

/* --- Messen --------------------------------------------------------------- */
const scorers = new Map();
const scorerFor = (lang) => {
  if (!scorers.has(lang)) scorers.set(lang, new TextReadability({ lang }));
  return scorers.get(lang);
};

const results = [];
const skipped = [];
for (const file of await htmlFiles(SITE)) {
  if (!(await stat(file)).size) continue;
  const html = await readFile(file, "utf8");
  const text = prose(html);
  const rel = path.relative(SITE, file);
  if (text === null) { skipped.push([rel, "kein Inhaltsbereich"]); continue; }
  const words = text.split(" ").filter(Boolean).length;
  if (words < MIN_WORDS) { skipped.push([rel, words + " Wörter"]); continue; }

  const lang = language(html);
  const s = scorerFor(lang);
  let flesch, wiener = null;
  try {
    flesch = s.fleschReadingEase(text);
    if (lang === "de") wiener = s.wienerSachtextformel(text, 1);
  } catch (e) {
    skipped.push([rel, "nicht messbar: " + e.message]);
    continue;
  }
  results.push({ file: rel, lang, words, flesch, wiener });
}

results.sort((a, b) => a.flesch - b.flesch);
const hard = results.filter((e) => e.flesch < THRESHOLD);

/* --- Ausgabe -------------------------------------------------------------- */
/* Die Bänder sind die üblichen des Flesch-Reading-Ease. Sie stehen im Bericht,
   weil eine nackte Zahl niemandem sagt, ob 52 gut oder schlecht ist. */
const band = (f) =>
  f >= 70 ? "leicht" : f >= 60 ? "eingängig" : f >= 50 ? "mittel" : f >= 40 ? "anspruchsvoll" : "schwer";

for (const e of results) {
  console.log(
    String(Math.round(e.flesch)).padStart(4) + "  " +
    (e.wiener === null ? "    –" : e.wiener.toFixed(1).padStart(5)) + "  " +
    band(e.flesch).padEnd(14) + e.file
  );
}
console.log("");
if (hard.length) {
  console.warn(`WARNUNG: ${hard.length} von ${results.length} Seite(n) unter Flesch ${THRESHOLD}.`);
} else {
  console.log(`OK - keine der ${results.length} gemessenen Seiten liegt unter Flesch ${THRESHOLD}.`);
}

if (MD_TARGET) {
  const lines = [];
  lines.push("## Lesbarkeit" + (LABEL ? " – " + LABEL : ""));
  lines.push("");
  if (hard.length) {
    lines.push(`> [!WARNING]`);
    lines.push(`> **${hard.length} Seite(n) lesen sich schwer** – Flesch unter ${THRESHOLD}. ` +
      "Kürzere Sätze und weniger Nebensätze heben den Wert; Fachbegriffe muss man dafür nicht opfern.");
    lines.push("");
    lines.push("| Flesch | Wiener | Seite |");
    lines.push("| -----: | -----: | ----- |");
    for (const e of hard) {
      lines.push(`| **${Math.round(e.flesch)}** | ${e.wiener === null ? "–" : e.wiener.toFixed(1)} | \`${e.file}\` |`);
    }
    lines.push("");
  } else {
    lines.push(`Keine der **${results.length}** gemessenen Seiten liegt unter Flesch ${THRESHOLD}.`);
    lines.push("");
  }
  lines.push("<details><summary>Alle Seiten, von schwer nach leicht</summary>");
  lines.push("");
  lines.push("| Flesch | Band | Wiener | Wörter | Seite |");
  lines.push("| -----: | ---- | -----: | -----: | ----- |");
  for (const e of results) {
    lines.push(`| ${Math.round(e.flesch)} | ${band(e.flesch)} | ${e.wiener === null ? "–" : e.wiener.toFixed(1)} | ${e.words} | \`${e.file}\` |`);
  }
  lines.push("");
  lines.push("</details>");
  if (skipped.length) {
    lines.push("");
    lines.push(`<sub>Nicht gemessen: ${skipped.length} Seite(n) – zu kurz oder ohne Inhaltsbereich.</sub>`);
  }
  lines.push("");
  lines.push("<sub>**Flesch-Reading-Ease** 0–100, je höher desto leichter (deutsch nach Amstad); " +
    "**Wiener Sachtextformel** als Schulstufe, 4 sehr leicht bis 15 sehr schwer. " +
    "Codeblöcke, Tabellen und Navigation zählen nicht mit.</sub>");
  await writeFile(MD_TARGET, lines.join("\n") + "\n");
  console.log("Bericht (Markdown): " + MD_TARGET);
}

if (!NO_FAIL && hard.length) process.exit(1);
