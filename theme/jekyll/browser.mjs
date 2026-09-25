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
export function chromeSuchen() {
  if (process.env.AVD_CHROME && existsSync(process.env.AVD_CHROME)) return process.env.AVD_CHROME;
  const pfade = (process.env.PATH || "").split(path.delimiter);
  for (const k of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    for (const p of pfade) {
      const kandidat = path.join(p, k);
      if (existsSync(kandidat)) return kandidat;
    }
  }
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  return null;
}

/* --- Chrome über das DevTools-Protokoll ----------------------------------- */
export class Browser {
  constructor(ws) { this.ws = ws; this.id = 0; this.warten = new Map(); this.horcher = new Map(); }

  static async starten(chromePfad) {
    const profil = await mkdtemp(path.join(tmpdir(), "avd-a11y-"));
    const proc = spawn(chromePfad, [
      "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profil,
      "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
      "--disable-extensions", "--disable-dev-shm-usage", "--no-sandbox",
      "--force-device-scale-factor=1", "--disable-lcd-text", "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe"] });

    /* Chrome schreibt die Adresse des Sockets auf stderr - mit Port 0 ist das
       der einzige Weg, den zufällig gewählten Port zu erfahren. */
    const url = await new Promise((fertig, fehler) => {
      let puffer = "";
      const zeit = setTimeout(() => fehler(new Error("Chrome meldet sich nicht (20 s)")), 20000);
      proc.stderr.on("data", (d) => {
        puffer += d.toString();
        const m = puffer.match(/ws:\/\/[^\s]+/);
        if (m) { clearTimeout(zeit); fertig(m[0]); }
      });
      proc.on("exit", (c) => { clearTimeout(zeit); fehler(new Error("Chrome beendet sich sofort (Code " + c + ")\n" + puffer.slice(0, 400))); });
    });

    const ws = new WebSocket(url);
    await new Promise((f, x) => { ws.onopen = f; ws.onerror = () => x(new Error("Kein Anschluss an " + url)); });
    const b = new Browser(ws);
    b.proc = proc;
    ws.onmessage = (e) => b.empfangen(JSON.parse(e.data));
    return b;
  }

  empfangen(n) {
    if (n.id && this.warten.has(n.id)) {
      const { fertig, fehler } = this.warten.get(n.id);
      this.warten.delete(n.id);
      n.error ? fehler(new Error(n.error.message)) : fertig(n.result);
      return;
    }
    const schluessel = (n.sessionId || "") + "|" + n.method;
    const h = this.horcher.get(schluessel);
    if (h) { this.horcher.delete(schluessel); h(n.params); }
  }

  /* JEDER AUFRUF HAT EINE FRIST. Ohne sie haengt der ganze Lauf, wenn eine
     einzige Seite den Browser beschaeftigt - und zwar ohne Ausgabe, weil der
     Bericht erst am Ende entsteht. Eine Pipeline, die stumm in ihr Zeitlimit
     laeuft, ist schlimmer als eine, die eine Seite nicht messen konnte. */
  ruf(methode, params = {}, sessionId, msFrist = 45000) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method: methode, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((fertig, fehler) => {
      const uhr = setTimeout(() => {
        this.warten.delete(id);
        fehler(new Error(methode + " antwortet nicht (" + Math.round(msFrist / 1000) + " s)"));
      }, msFrist);
      this.warten.set(id, {
        fertig: (r) => { clearTimeout(uhr); fertig(r); },
        fehler: (e) => { clearTimeout(uhr); fehler(e); }
      });
    });
  }

  ereignis(methode, sessionId, msFrist) {
    return new Promise((fertig) => {
      const schluessel = (sessionId || "") + "|" + methode;
      this.horcher.set(schluessel, fertig);
      setTimeout(() => { if (this.horcher.get(schluessel)) { this.horcher.delete(schluessel); fertig(null); } }, msFrist);
    });
  }

  async seiteOeffnen() {
    const { targetId } = await this.ruf("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.ruf("Target.attachToTarget", { targetId, flatten: true });
    await this.ruf("Page.enable", {}, sessionId);
    await this.ruf("Runtime.enable", {}, sessionId);
    return { targetId, sessionId };
  }

  async seiteSchliessen(targetId) {
    try { await this.ruf("Target.closeTarget", { targetId }, undefined, 5000); } catch { /* egal */ }
  }

  async schliessen() {
    try { this.ws.close(); } catch { /* egal */ }
    try { this.proc.kill(); } catch { /* egal */ }
  }
}
