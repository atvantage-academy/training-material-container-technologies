/* =============================================================================
   contrast.mjs – holt die Messwerte der Kontrastprüfung aus EINEM Browser
   -----------------------------------------------------------------------------
   Aufruf:  node theme/jekyll/contrast.mjs --chrome «pfad» --base http://127.0.0.1:1234
            Adressen kommen über stdin, eine je Zeile; Ergebnisse gehen als
            JSON-Zeilen nach stdout.

   WOFÜR. `contrast.rb` baut die Sondenseiten, bedient den kleinen HTTP-Server und
   wertet aus. Fehlte nur eines: die Seiten aufzurufen. Das tat es bis hierher mit
   `chrome --headless --dump-dom «url»` – und zwar EINMAL JE SEITE UND FARBSCHEMA.

   GEMESSEN: 74 Seiten × 2 Schemata = 148 Chrome-Kaltstarts, acht davon parallel,
   jeder mit bis zu fünf Sekunden `--virtual-time-budget`. Ergebnis: 5 Minuten 20.
   Die Barrierefreiheitsmessung daneben kommt mit EINEM Browser aus, misst mit 296
   Kombinationen doppelt so viel und braucht 6 Minuten 30 – pro Messung also etwa
   die Hälfte, obwohl sie mit axe-core die deutlich schwerere Arbeit tut. Der
   Unterschied war nie die Messung, sondern der Prozessstart.

   EIN FRISCHER REITER JE SEITE, aber nur EIN Browser. Dieselbe Erfahrung wie bei
   `a11y.mjs`: Ein wiederverwendeter Reiter wird von Seite zu Seite langsamer, weil
   jede Zuhörer, Zeitgeber und Speicher zurücklässt. Ein neuer Reiter kostet rund
   50 ms – gegenüber 1,5 bis 2,5 Sekunden für einen Chrome-Start.

   DIE SONDE STEHT SCHON IN DER SEITE. `contrast.rb` hat sie beim Schreiben der
   Arbeitskopie eingebaut; sie läuft beim Laden und legt ihr Ergebnis in
   `<pre id="__contrast">` ab. Hier wird es nur abgeholt – über `textContent` und
   nicht mehr aus dem HTML des `--dump-dom`. Damit entfällt auch das Zurückschreiben
   der Maskierung (`&lt;`, `&amp;`), an der vorher ein `&` im Text das JSON brechen
   konnte.
   ============================================================================= */
import { Browser } from "./browser.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const CHROME = arg("chrome", "");
const BASE = arg("base", "").replace(/\/+$/, "");
const JOBS = Math.max(1, Number(arg("jobs", "8")));
/* Frist je Seite. Dieselbe Vorgabe wie bisher im Ruby-Teil – nur greift sie jetzt
   je Reiter statt je Prozess. */
const TIMEOUT = Math.max(5, Number(arg("timeout", "30"))) * 1000;

/* Adressen über stdin, nicht als Argumente: Bei 148 Seiten wäre die Kommandozeile
   je nach System am Limit, und ein abgeschnittenes Argument fiele als „Seite ohne
   Antwort" auf – also als Messfehler statt als das, was es wäre. */
const paths = (await new Promise((done) => {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => { buffer += d; });
  process.stdin.on("end", () => done(buffer));
})).split("\n").map((s) => s.trim()).filter(Boolean);

if (!CHROME) {
  console.error("FEHLER: --chrome fehlt.");
  process.exit(2);
}

const browser = await Browser.start(CHROME);
const queue = paths.slice();
const out = [];

/* DIESELBE FLAECHE WIE VORHER: 1400 x 1000. Die alte Fassung gab sie Chrome als
   `--window-size` mit; ein frischer Reiter startet kleiner. Das ist keine
   Kleinigkeit - bei schmalerem Fenster greifen die Medienabfragen des Themes, die
   Kopfnavigation wandert hinter den Burger, und gemessen wird eine ANDERE Seite.
   Nachgemessen: 42196 statt 42586 Elemente, und eine Fundstelle wechselte von
   `p > a` auf `summary > code`. Zwei Laeufe, die verschiedene Zahlen liefern, sind
   schlimmer als einer, der langsam ist. */
const WIDTH = Number(arg("width", "1400"));
const HEIGHT = Number(arg("height", "1000"));

async function measureOne(url) {
  const page = await browser.openPage();
  try {
    await browser.call("Emulation.setDeviceMetricsOverride",
      { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false }, page.sessionId, TIMEOUT);
    const loaded = browser.event("Page.loadEventFired", page.sessionId, TIMEOUT);
    await browser.call("Page.navigate", { url }, page.sessionId, TIMEOUT);
    await loaded;
    /* Kurz atmen lassen: Das Theme setzt Farben teils erst im Browser (Farbschema,
       abgeleitete Tokens), und genau die sollen gemessen werden. */
    await new Promise((f) => setTimeout(f, 150));
    const { result } = await browser.call("Runtime.evaluate", {
      expression: 'document.getElementById("__contrast")?.textContent || ""',
      returnByValue: true
    }, page.sessionId, TIMEOUT);
    return result?.value || "";
  } finally {
    await browser.closePage(page.targetId);
  }
}

const workers = Array.from({ length: Math.min(JOBS, Math.max(1, paths.length)) }, () => (async () => {
  for (;;) {
    const rel = queue.shift();
    if (rel === undefined) break;
    try {
      const probe = await measureOne(BASE + rel);
      out.push(JSON.stringify({ path: rel, probe }));
    } catch (e) {
      out.push(JSON.stringify({ path: rel, error: e.message }));
    }
  }
})());

try {
  await Promise.all(workers);
} finally {
  await browser.close();
}
process.stdout.write(out.join("\n") + (out.length ? "\n" : ""));
