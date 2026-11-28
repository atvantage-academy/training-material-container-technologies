/* =============================================================================
   Layout „stage“ – Verhalten der Bühne (Skriptorium)
   -----------------------------------------------------------------------------
   Geladen von skriptorium.stage und allen Layouts, die von ihm erben (vor deren
   eigenen Skripten). Abhängigkeitsfrei, kein Build, kein CDN.

   1) SCHLIESSEN: Der Knopf ✕ (`data-skr-stage-close`) führt zur Seite vor der
      Bühne, samt Anker, Scrollstelle, Zustand und Sprache – siehe unten.
   2) VOLLBILD: der Knopf in den Werkzeugen (`data-skr-stage-full`).
   3) CLIENT-API: Die Bühne meldet `close()`, `closeTarget()` und `progress()` an
      (`skr.layouts.define`, skr.js) – jedes Layout, das von ihr erbt, hat sie über
      seinen Prototyp (client.js, `layoutChain`).
   4) FORTSCHRITT UND ZÄHLER: `progress(current, total)` setzt den Balken unter der
      Steuerleiste (`data-skr-stage-progress`), zeigt ihn und schreibt die Zähler
      (`data-skr-stage-counter`) – für jedes Erbe, die Folien eingeschlossen (skriptorium#446).
   5) ENGE KOPFLEISTE: `skr-stage__bar--compact`, wenn die Kopfleiste nicht in eine Zeile
      passt (skriptorium#507).

   Wo die Bühne liegt, sagt das Layout der Seite: `data-skr-layouts` am <body>
   nennt skriptorium.stage. Ohne dieses Skript bleibt das ✕ verborgen – ohne
   Skript gibt es nichts zu schließen.
   ============================================================================= */
(function () {
  "use strict";

  if (!/(^|\s)skriptorium\.stage(\s|$)/.test(document.body.getAttribute("data-skr-layouts") || "")) return;

  /* --- 1) Schließen ----------------------------------------------------------
     ZUR SEITE VOR DER BÜHNE, nicht einfach `history.back()`: Ein Wechsel auf der Bühne (eine
     Folie, ein Schritt) kann Verlaufseinträge anlegen, und zurück wäre dann nur der
     vorige Schritt. Die Seite davor ist die, von der aus die Bühne geöffnet wurde
     (`document.referrer`, derselbe Ursprung) – mit Fragment, Sprache, Fassungen und
     Kennungen, wie sie client.js beim Verlassen ablegt (`skr-last-page`). Sie bleibt je
     Seite der Bühne im `sessionStorage` (Schlüssel `skr-present-return`, gemeinsam für alle
     Bühnen), damit Neuladen und Wechsel auf der Bühne sie
     nicht verlieren. Kommt der Leser von einer anderen Seite der Bühne (etwa über den
     Sprachumschalter), gilt deren Seite davor – in der Sprache dieser Seite, wenn sie dort
     eine Fassung hat; Anker und Zustand übersetzt dann die Zielseite wie beim Sprachwechsel
     (`skr-lang-handover`). Ohne Seite davor: die Startseite der Unterlage in dieser
     Sprache (`data-skr-stage-home` am <body>, auch ohne Knopf). Gemerkt wird auch ohne Knopf –
     `closeTarget()` der Client-API kennt das Ziel dann trotzdem.

     ZURÜCK IM VERLAUF, WO ES GEHT: Steht die Seite davor im Verlauf dieses Tabs, und dazwischen
     nur Seiten der Bühne (jede, die hier ihre Seite davor gemerkt hat) samt ihrer Schritte,
     springt Schließen so viele Einträge zurück (`history.go`). Der Browser stellt die Seite
     dann her, wie sie war – Scrollstelle, offene Bereiche, eingegebener Text. Den Verlauf
     zeigt die Navigation API (`navigation.entries()`). Vorwärts (`location.assign`, als neuer
     Eintrag) geht es, wo sie fehlt, die Seite davor nicht im Verlauf steht oder das Ziel die
     Fassung einer anderen Sprache ist; die Scrollstelle beginnt dann beim Anker. */
  var RETURN = "skr-present-return";
  var closeBtn = document.querySelector("[data-skr-stage-close]");
  var strip = function (url) { return String(url || "").replace(/#.*$/, ""); };
  var stored = function (key) {
    var v = window.skr.storage.session.get(key);
    return v && typeof v === "object" ? v : null;
  };
  var here = strip(location.href);
  var targets = stored(RETURN) || {};
  var from = "";
  try {
    var ref = new URL(document.referrer);
    if (ref.protocol === location.protocol && ref.host === location.host) from = strip(ref.href);
  } catch (e) { /* kein Verweis */ }
  if (from && from !== here) {
    var last = stored("skr-last-page");
    if (targets[from]) targets[here] = targets[from];
    else if (!targets[here] || strip(targets[here].href) !== from) {
      targets[here] = last && strip(last.href) === from ? last : { href: from };
    }
  }
  window.skr.storage.session.set(RETURN, targets);

  function home() {
    return new URL(document.body.getAttribute("data-skr-stage-home") || window.skr._root(), location.href).href;
  }

  /* Das Ziel als volle Adresse; `handover` legt die Übergabe für die Zielseite ab – nur beim
     Gehen, nicht beim bloßen Nachfragen (closeTarget). */
  function away(handover) {
    var target = targets[here];
    if (!target || !target.href) return home();
    var lang = document.documentElement.lang || "";
    var other = target.lang && lang && target.lang !== lang && target.alternates && target.alternates[lang];
    if (!other) return target.href;
    var hash = (target.carry && target.carry.hash) || (/#.*$/.exec(target.href) || [""])[0];
    if (handover && target.carry) {
      var carry = JSON.parse(JSON.stringify(target.carry));
      carry.to = new URL(other).pathname;
      window.skr.storage.session.set("skr-lang-handover", carry);
    }
    return strip(other) + hash;
  }

  /* Wie viele Einträge zurück die Seite davor steht – 0, wenn der Verlauf nicht dorthin führt. */
  function backSteps() {
    var target = targets[here];
    var nav = window.navigation;
    if (!target || !target.href || away(false) !== target.href) return 0;
    if (!nav || typeof nav.entries !== "function" || !nav.currentEntry) return 0;
    var entries = nav.entries(), at = nav.currentEntry.index, goal = strip(target.href);
    for (var i = at - 1; i >= 0; i--) {
      var url = strip(entries[i] && entries[i].url);
      if (url === goal) return at - i;
      if (!url || !targets[url]) return 0;
    }
    return 0;
  }

  function close() {
    var steps = backSteps();
    if (steps) history.go(-steps);
    else location.assign(away(true));
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", close);
    closeBtn.removeAttribute("hidden");
  }

  /* --- 2) Vollbild ------------------------------------------------------------ */
  var fullBtn = document.querySelector("[data-skr-stage-full]");
  if (fullBtn) {
    fullBtn.addEventListener("click", function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    });
  }

  /* --- 4) Fortschritt und Zähler ------------------------------------------------
     Der Balken steht verborgen da (stage-controls.html), bis ein Wert kommt – ein Erbe ohne
     Schritte, das ihn nie setzt, zeigt so keinen leeren Balken. Die Zähler zeigen
     „«current» / «total»“. Setzt nur die eigene Anzeige der Seite und steht darum nicht
     hinter der Schranke `client_api`; die Folien rufen es intern (`skr._stageProgress`). */
  function progress(current, total) {
    if (typeof current !== "number" || typeof total !== "number" || !isFinite(current) || !isFinite(total) || total <= 0 || current < 0 || current > total) {
      throw new TypeError("skr.stage.progress(current, total): expected numbers with 0 <= current <= total and total > 0");
    }
    document.querySelectorAll("[data-skr-stage-progress]").forEach(function (fill) {
      fill.style.width = (current / total) * 100 + "%";
      var bar = fill.closest(".skr-stage__progress");
      if (bar) bar.hidden = false;
    });
    document.querySelectorAll("[data-skr-stage-counter]").forEach(function (c) { c.textContent = current + " / " + total; });
  }
  Object.defineProperty(window.skr, "_stageProgress", { value: progress });

  /* --- 5) Enge Kopfleiste -----------------------------------------------------
     Ragt die Kopfleiste über ihren Rand oder bliebe vom Titel weniger als TITLE_MIN
     Zeichenbreiten, bekommt sie `skr-stage__bar--compact` (stabil): stage.css rückt
     zusammen und nimmt den QR-Code heraus, Einschübe verdichten sich an derselben Klasse.
     GEMESSEN WIRD OHNE DIE KLASSE UND OHNE UMBRUCH – sonst passte die verdichtete Leiste,
     die Klasse fiele ab, und die Leiste spränge hin und her; der Umbruch hielte ein
     Überlaufen verborgen. Abnehmen, Messen und Anlegen liegen in einem Zug, der Browser
     malt nichts davon. Neu gemessen wird, wenn die Leiste oder ein Einschub in ihr die
     Größe ändert – das Fenster, ein Einschub, den sein Skript später füllt – und wenn die
     Schrift geladen ist. */
  var bar = document.querySelector(".skr-stage__bar");
  if (bar) {
    var TITLE_MIN = 6;
    var fits = function () {
      bar.classList.remove("skr-stage__bar--compact");
      bar.style.flexWrap = "nowrap";
      var title = bar.querySelector(".skr-stage__title");
      var cut = !!title && title.clientWidth < Math.min(title.scrollWidth, TITLE_MIN * parseFloat(getComputedStyle(title).fontSize));
      var over = bar.scrollWidth > bar.clientWidth;
      bar.style.flexWrap = "";
      return !over && !cut;
    };
    var measure = function () { bar.classList.toggle("skr-stage__bar--compact", !fits()); };
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { window.requestAnimationFrame(measure); });
    if (window.ResizeObserver) {
      var queued = false;
      var observer = new ResizeObserver(function () {
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(function () { queued = false; measure(); });
      });
      observer.observe(bar);
      bar.querySelectorAll("[data-skr-slot]").forEach(function (slot) { observer.observe(slot); });
    } else {
      window.addEventListener("resize", measure);
    }
  }

  /* --- 3) Client-API ------------------------------------------------------------
     close() wie der Knopf, durch die Schranke `client_api`; closeTarget() nur lesend: die
     Adresse, zu der Schließen jetzt führte; progress() wie oben. */
  window.skr.layouts.define("skriptorium.stage", {
    close: window.skr._guard("stage.close", close),
    closeTarget: function () { return away(false); },
    progress: progress
  });
})();
