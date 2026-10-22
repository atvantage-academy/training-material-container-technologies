/* =============================================================================
   Weg der Suche – der Weg durch die Site, je Tab
   -----------------------------------------------------------------------------
   WOZU: Eine geteilte Übung, die die Bereiche A und B einbinden, soll in A
   gesucht werden, wenn man aus A kommt, und in B, wenn man aus B kommt. Ebenso
   eine Seite, die in der Navigation unter zwei Einträgen steht. Die Seite selbst
   weiß das nicht – nur der Weg dorthin (`search.js`, Vorauswahl bei
   `search.preselect: current`).

   EIGENE DATEI, IN JEDEM LAYOUT. Die Suche steht in der Kopfzeile; Präsentation
   und Seiten ohne Kopfzeile haben keine. Notierten sie sich nicht,
   risse der Weg dort ab. Dieses Skript ist klein, lädt keinen Index und steht
   deshalb im Kopf jeder Seite, solange die Suche an ist (head.html).

   WARUM EIN WEG UND KEIN FERTIGER BEREICH: Welcher Bereich eine Seite hat, steht
   im Manifest, und das lädt erst, wer die Suche öffnet. Beim Seitenaufruf wird
   deshalb nur die Adresse notiert; ausgewertet wird beim Öffnen. Dazu kommen
   Marken: `?scope=` an einem Treffer sagt, in welchem Bereich gesucht wurde.

   WARUM sessionStorage: je Tab. Zwei Schulungen in zwei Tabs stellen sich nicht
   gegenseitig um. Ein NEUER TAB beginnt leer; dann zählt die Seite, von der er
   geöffnet wurde (Referrer) – samt dem Weg, der zu ihr geführt hat: Den legt
   jede Seite zusätzlich als letzten Stand in localStorage ab. Ohne Speicher
   (privates Fenster, blockiert) bleibt der Referrer allein.

   GEKÜRZT OHNE VERLUST. Der Weg hält 30 Einträge. Wird er länger, holt das Skript
   das Manifest (einmal, aus dem Cache des Browsers), rechnet aus, welcher Bereich
   am Anfang galt, und ersetzt diesen Anfang durch eine Marke mit genau diesem
   Bereich. Der Bereich überlebt so beliebig lange Wege über geteilte Seiten.

   Markup: `<script … data-skr-search-trail data-base data-index>` (head.html) –
   beide Adressen relativ zur Seite, `data-base` zeigt auf die Wurzel der Site. `search.js` liest den Weg über `skr._searchTrail` (intern).
   ============================================================================= */
(function () {
  "use strict";

  var KEY = "skr-search-trail";
  var LAST_KEY = "skr-search-trail-last";
  var MAX = 30;
  /* Schlägt das Kürzen fehl (kein Manifest), wird hart abgeschnitten – aber erst hier,
     damit ein kurzer Netzfehler den Bereich nicht kostet. */
  var HARD_MAX = 4 * MAX;

  var tag = document.currentScript || document.querySelector("script[data-skr-search-trail]");
  /* Die Wurzel der Site als Pfad, unter dem sie gerade läuft (`/`, `/unter/ordner/`). */
  var base = new URL((tag && tag.getAttribute("data-base")) || "/", location.href).pathname;
  var manifestUrl = tag && tag.getAttribute("data-index");

  /* Die Adresse einer Seite so, wie sie im Index steht: ab der Wurzel der Site, und
     `/ordner/index.html` ist dieselbe Seite wie `/ordner/`. */
  function indexPath(pathname) {
    var b = base.replace(/\/$/, "");
    var path = pathname;
    if (b && path.lastIndexOf(b, 0) === 0) path = path.slice(b.length) || "/";
    return path.replace(/\/index\.html$/, "/");
  }

  function parse(text) {
    try {
      var t = JSON.parse(text || "[]");
      return Array.isArray(t) ? t : [];
    } catch (e) { return []; }
  }

  function read() {
    try { return parse(sessionStorage.getItem(KEY)); } catch (e) { return []; }
  }

  function write(trail) {
    if (trail.length > HARD_MAX) trail = trail.slice(-MAX);
    try { sessionStorage.setItem(KEY, JSON.stringify(trail)); } catch (e) { /* ohne Speicher */ }
    if (trail.length > MAX) shorten();
  }

  /* Den Weg nachspielen. Eine Marke setzt den Bereich ausdrücklich, „Alle“ leert ihn.
     Je Seite steht im Manifest eine Liste: vorn der eigene Bereich (leer, wenn keiner),
     danach die Bereiche, die sie einbinden.

     BEREICHE AUS ORDNERN (`source: index`): Eine Seite mit EIGENEM Bereich setzt ihn,
     egal woher man kommt. Eine ohne behält den bisherigen, wenn er sie einbindet –
     sonst gibt es keinen.

     BEREICHE AUS DER NAVIGATION (`source: nav`): Es gilt der Bereich, aus dem man kommt,
     solange die Seite zu ihm gehört – als eigener oder eingebundener. Sonst ihr erster
     Bereich; eine Seite in keinem Bereich behält den bisherigen. Bereiche, die die
     gewählte Rolle nicht zeigt (`visible`), zählen nicht. */
  function contextOf(trail, pages, opts) {
    var nav = opts && opts.source === "nav";
    var visible = (opts && opts.visible) || function () { return true; };
    var ctx = "";
    trail.forEach(function (e) {
      if (e.s !== undefined) { ctx = e.s; return; }
      var list = pages[e.p] || [];
      if (nav) {
        list = list.filter(function (s) { return s && visible(s); });
        if (list.length && list.indexOf(ctx) < 0) ctx = list[0];
        return;
      }
      if (list[0]) ctx = list[0];
      else if (!ctx || list.indexOf(ctx) < 1) ctx = "";
    });
    return ctx;
  }

  /* Welche Bereiche die gewählte Rolle zeigt – aus den Bereichen des Manifests. */
  function visibleIn(manifest) {
    var role = document.documentElement.getAttribute("data-skr-role") || "";
    var roles = {};
    (manifest.scopes || []).forEach(function (s) { roles[s.id] = s.role || ""; });
    return function (id) { return !roles[id] || roles[id] === role; };
  }

  /* Den Anfang des Wegs durch eine Marke ersetzen, die genau den Bereich trägt, der
     dort galt. `contextOf` ist ein Durchlauf mit einem einzigen Zustand – Marke plus
     Rest ergibt deshalb dasselbe wie der ganze Weg. */
  var shortening = null;
  function shorten() {
    if (shortening || !manifestUrl || typeof fetch !== "function") return;
    shortening = fetch(manifestUrl).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (m) {
      var trail = read();
      if (trail.length <= MAX) return;
      var cut = trail.length - (MAX - 1);
      var ctx = m && m.pages ? contextOf(trail.slice(0, cut), m.pages, { source: m.source, visible: visibleIn(m) }) : "";
      trail = [{ s: ctx }].concat(trail.slice(cut));
      try { sessionStorage.setItem(KEY, JSON.stringify(trail)); } catch (e) { /* ohne Speicher */ }
    }).catch(function () { /* Weg bleibt lang; HARD_MAX begrenzt ihn */ })
      .then(function () { shortening = null; });
  }

  /* Der Weg, mit dem ein neuer Tab beginnt: der letzte Stand der Seite, von der er
     geöffnet wurde – sonst nur diese Seite. */
  function seed(from) {
    try {
      var last = JSON.parse(localStorage.getItem(LAST_KEY) || "null");
      if (last && last.p === from && Array.isArray(last.t)) return last.t;
    } catch (e) { /* ohne Speicher */ }
    return [{ p: from }];
  }

  /* Beim Seitenaufruf: Marke aus `?scope=` übernehmen und aus der Adresse nehmen –
     sie gehört in kein Lesezeichen und in keinen kopierten Link. */
  function record() {
    var trail = read();
    var here = indexPath(location.pathname);
    if (!trail.length && document.referrer) {
      try {
        var ref = new URL(document.referrer);
        if (ref.origin === location.origin) {
          var from = indexPath(ref.pathname);
          if (from !== here) trail = seed(from);
        }
      } catch (e) { /* kein gültiger Referrer */ }
    }
    var params = new URLSearchParams(location.search);
    if (params.has("scope")) {
      trail.push({ s: params.get("scope") || "" });
      params.delete("scope");
      var rest = params.toString();
      try {
        history.replaceState(history.state, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
      } catch (e) { /* Adresse bleibt, wie sie ist */ }
    }
    var last = trail[trail.length - 1];
    if (!last || last.p !== here) trail.push({ p: here });
    write(trail);
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ p: here, t: trail })); } catch (e) { /* ohne Speicher */ }
  }

  if (window.skr && !window.skr._searchTrail) Object.defineProperty(window.skr, "_searchTrail", { value: { read: read, contextOf: contextOf, visibleIn: visibleIn, indexPath: indexPath } });

  if (location.protocol === "file:") return;
  record();
  /* Zurück aus dem Cache des Browsers: Das Skript läuft nicht noch einmal, die Seite
     gehört aber wieder ans Ende des Wegs. */
  window.addEventListener("pageshow", function (e) { if (e.persisted) record(); });
})();
