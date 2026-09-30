/* =============================================================================
   browser.mjs – Chrome über das DevTools-Protokoll, ohne Installation
   -----------------------------------------------------------------------------
   Die Mechanik, mit der `a11y.mjs` und `bin/contrast-pairs.mjs` einen Browser
   fernsteuern: starten, Seite öffnen, Befehl schicken, Ereignis abwarten.

   WARUM EIN EIGENER KLIENT UND KEIN PUPPETEER: Die Prüfungen sollen ohne
   Installation laufen – kein `npm install` in der Pipeline, kein Netz, kein
   nachgeladener Browser. Node bringt seit v22 `WebSocket` mit, und mehr braucht
   es nicht.

   WARUM EINE EIGENE DATEI UND KEINE ZWEITE KOPIE: Zwei Prüfungen steuern
   denselben Browser. Als Kopie in beiden teilte die eine Fassung Fristen,
   Flaggen und Fehlermeldungen der anderen irgendwann nicht mehr – und die
   Prüfung, an der seltener gearbeitet wird, hinge an der älteren Mechanik, ohne
   dass es auffiele.

   LIEGT IM PAKET, wie `a11y.mjs` daneben: Die Schulungs-Repos messen über die
   zentrale didaktikon-Action mit derselben Datei.
   ============================================================================= */
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import path from "node:path";

/* --- Chrome finden --------------------------------------------------------
   DIESELBE REIHENFOLGE WIE IN `a11y.sh`, und das ist kein Zufall: Wer dort einen
   Pfad über `AVD_CHROME` setzt, erwartet ihn hier auch. `a11y.sh` sucht weiter
   selbst, weil es VOR dem Node-Start entscheiden muss, ob der Lauf übersprungen
   wird; diese Fassung ist für Aufrufer, die direkt in Node beginnen. */
export function findChrome() {
  if (process.env.AVD_CHROME && existsSync(process.env.AVD_CHROME)) return process.env.AVD_CHROME;
  const paths = (process.env.PATH || "").split(path.delimiter);
  for (const k of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    for (const p of paths) {
      const candidate = path.join(p, k);
      if (existsSync(candidate)) return candidate;
    }
  }
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  return null;
}

/* --- Chrome über das DevTools-Protokoll ----------------------------------- */
export class Browser {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }

  static async start(chromePath) {
    const profile = await mkdtemp(path.join(tmpdir(), "avd-a11y-"));
    const proc = spawn(chromePath, [
      "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile,
      "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
      "--disable-extensions", "--disable-dev-shm-usage", "--no-sandbox",
      "--force-device-scale-factor=1", "--disable-lcd-text", "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe"] });

    /* Chrome schreibt die Adresse des Sockets auf stderr - mit Port 0 ist das
       der einzige Weg, den zufällig gewählten Port zu erfahren. */
    /* 60 SEKUNDEN, NICHT 20. Ein kalter Runner braucht fuer den ersten Start
       laenger als ein warmer Rechner - gemessen an einem Lauf, in dem DREI Jobs
       gleichzeitig scheiterten, darunter einer, an dem niemand etwas geaendert
       hatte. Eine Zeitschranke, die von der Tagesform der Infrastruktur abhaengt,
       meldet keinen Defekt, sondern Rauschen; und Rauschen wird weggeklickt.
       Ueber `AVD_CHROME_TIMEOUT` (Sekunden) einstellbar. */
    const deadline = Number(process.env.AVD_CHROME_TIMEOUT || 60);
    const url = await new Promise((done, fail) => {
      let buffer = "";
      const timer = setTimeout(() => fail(new Error(`Chrome meldet sich nicht (${deadline} s)`)), deadline * 1000);
      proc.stderr.on("data", (d) => {
        buffer += d.toString();
        const m = buffer.match(/ws:\/\/[^\s]+/);
        if (m) { clearTimeout(timer); done(m[0]); }
      });
      proc.on("exit", (c) => { clearTimeout(timer); fail(new Error("Chrome beendet sich sofort (Code " + c + ")\n" + buffer.slice(0, 400))); });
    });

    const ws = new WebSocket(url);
    await new Promise((f, x) => { ws.onopen = f; ws.onerror = () => x(new Error("Kein Anschluss an " + url)); });
    const b = new Browser(ws);
    b.proc = proc;
    ws.onmessage = (e) => b.receive(JSON.parse(e.data));
    return b;
  }

  receive(n) {
    if (n.id && this.pending.has(n.id)) {
      const { done, fail } = this.pending.get(n.id);
      this.pending.delete(n.id);
      n.error ? fail(new Error(n.error.message)) : done(n.result);
      return;
    }
    const key = (n.sessionId || "") + "|" + n.method;
    const h = this.listeners.get(key);
    if (h) { this.listeners.delete(key); h(n.params); }
  }

  /* JEDER AUFRUF HAT EINE FRIST. Ohne sie haengt der ganze Lauf, wenn eine
     einzige Seite den Browser beschaeftigt - und zwar ohne Ausgabe, weil der
     Bericht erst am Ende entsteht. Eine Pipeline, die stumm in ihr Zeitlimit
     laeuft, ist schlimmer als eine, die eine Seite nicht messen konnte. */
  call(method, params = {}, sessionId, msDeadline = 45000) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method: method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((done, fail) => {
      const clock = setTimeout(() => {
        this.pending.delete(id);
        fail(new Error(method + " antwortet nicht (" + Math.round(msDeadline / 1000) + " s)"));
      }, msDeadline);
      this.pending.set(id, {
        done: (r) => { clearTimeout(clock); done(r); },
        fail: (e) => { clearTimeout(clock); fail(e); }
      });
    });
  }

  event(method, sessionId, msDeadline) {
    return new Promise((done) => {
      const key = (sessionId || "") + "|" + method;
      this.listeners.set(key, done);
      setTimeout(() => { if (this.listeners.get(key)) { this.listeners.delete(key); done(null); } }, msDeadline);
    });
  }

  async openPage() {
    const { targetId } = await this.call("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.call("Target.attachToTarget", { targetId, flatten: true });
    await this.call("Page.enable", {}, sessionId);
    await this.call("Runtime.enable", {}, sessionId);
    return { targetId, sessionId };
  }

  async closePage(targetId) {
    try { await this.call("Target.closeTarget", { targetId }, undefined, 5000); } catch { /* egal */ }
  }

  async close() {
    try { this.ws.close(); } catch { /* egal */ }
    try { this.proc.kill(); } catch { /* egal */ }
  }
}
