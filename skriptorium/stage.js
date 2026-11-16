/* =============================================================================
   Layout „stage“ – Verhalten der Bühne (Skriptorium)
   -----------------------------------------------------------------------------
   Geladen von skriptorium.stage und allen Layouts, die von ihm erben (vor deren
   eigenen Skripten). Abhängigkeitsfrei, kein Build, kein CDN.

   1) SCHLIESSEN: Der Knopf ✕ (`data-skr-stage-close`) führt zur Seite vor der
      Bühne, samt Anker, Zustand und Sprache – siehe unten.
   2) VOLLBILD: der Knopf in den Werkzeugen (`data-skr-stage-full`).
   3) CLIENT-API: Die Bühne meldet `close()` und `closeTarget()` an
      (`skr.layouts.define`, skr.js) – jedes Layout, das von ihr erbt, hat sie über
      seinen Prototyp (client.js, `layoutChain`).

   Wo die Bühne liegt, sagt das Layout der Seite: `data-skr-layouts` am <body>
   nennt skriptorium.stage. Ohne dieses Skript bleibt das ✕ verborgen – ohne
   Skript gibt es nichts zu schließen.
   ============================================================================= */
(function () {
  "use strict";

  if (!/(^|\s)skriptorium\.stage(\s|$)/.test(document.body.getAttribute("data-skr-layouts") || "")) return;

  /* --- 1) Schließen ----------------------------------------------------------
     ZUR SEITE VOR DER BÜHNE, nicht `history.back()`: Ein Wechsel auf der Bühne (eine
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
     Sprache (`data-skr-stage-home` am <body>, auch ohne Knopf). Geöffnet wird vorwärts
     (`location.assign`), als neuer Eintrag. Gemerkt wird auch ohne Knopf – `closeTarget()`
     der Client-API kennt das Ziel dann trotzdem. */
  var RETURN = "skr-present-return";
  var closeBtn = document.querySelector("[data-skr-stage-close]");
  var strip = function (url) { return String(url || "").replace(/#.*$/, ""); };
  var stored = function (key) {
    try { return JSON.parse(sessionStorage.getItem(key)); } catch (e) { return null; }
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
  try { sessionStorage.setItem(RETURN, JSON.stringify(targets)); } catch (e) { /* dann nur für diesen Aufruf */ }

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
      try { sessionStorage.setItem("skr-lang-handover", JSON.stringify(carry)); } catch (e) { /* dann nur gleiche Kennungen */ }
    }
    return strip(other) + hash;
  }

  function close() { location.assign(away(true)); }

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

  /* --- 3) Client-API ------------------------------------------------------------
     close() wie der Knopf, durch die Schranke `client_api`; closeTarget() nur lesend: die
     Adresse, zu der Schließen jetzt führte. */
  window.skr.layouts.define("skriptorium.stage", {
    close: window.skr._guard("stage.close", close),
    closeTarget: function () { return away(false); }
  });
})();
