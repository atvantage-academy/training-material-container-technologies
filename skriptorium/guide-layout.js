/* =============================================================================
   Skriptorium – Layout „guide“: die Karte „Fortschritt“
   -----------------------------------------------------------------------------
   Zählt die Kästchen der Aufgabenlisten im Inhalt – die Definition of Done
   (`skr-guide-done`) eingeschlossen – und zeigt den Stand in der Karte, die der Bau
   verborgen in die Seitenleiste legt (`data-skr-card="skriptorium.progress"`, Schalter
   `sidebar.progress`). Ohne Kästchen bleibt sie verborgen.

   AUSGENOMMEN ist, was in einem Block mit `data-skr-tasklist="off"` steht – etwa die
   Antworten eines Wissens-Checks: Sie sind seine Lösung, keine Aufgabe.

   ERST NACH ALLEN SKRIPTEN ZÄHLEN: Eine Extension, die einen Block ausnimmt oder der
   Definition of Done einen Eintrag hinzufügt, läuft womöglich nach diesem Skript. Gezählt
   wird deshalb beim Ereignis `skr-ready` – es kommt, wenn der Kern und jede mit
   `skr.ready` angemeldete Funktion gelaufen sind (skr.js) – und bei jeder Änderung neu. Den
   ersten Stand legt schon der Bau in die Karte (adapter/sidebar.mjs).

   Der Zustand wird nicht gespeichert, wie die Haken selbst: Ein Haken gilt für diesen
   Durchgang. Den Text („{done} / {total} erledigt“) legt der Bau an die Karte.
   ============================================================================= */
(function () {
  "use strict";

  function tasks(main) {
    return Array.prototype.filter.call(
      main.querySelectorAll('li > input[type="checkbox"]'),
      function (c) { return !c.closest('[data-skr-tasklist="off"]'); });
  }

  function number(n) {
    try { return new Intl.NumberFormat(document.documentElement.getAttribute("lang") || undefined).format(n); } catch (e) { return String(n); }
  }

  function update() {
    var main = document.querySelector(".skr-guide-main");
    var card = document.querySelector('[data-skr-card="skriptorium.progress"]');
    if (!main || !card) { return; }
    var checks = tasks(main);
    var before = card.hidden;
    if (!checks.length) {
      card.hidden = true;
    } else {
      var done = checks.filter(function (c) { return c.checked; }).length;
      var pct = Math.round((done / checks.length) * 100);
      var fill = card.querySelector(".skr-guide-progress__fill");
      var bar = card.querySelector(".skr-guide-progress__bar");
      var text = card.querySelector(".skr-guide-progress__text");
      if (fill) { fill.style.width = pct + "%"; }
      if (bar) { bar.setAttribute("aria-valuenow", String(pct)); }
      if (text) {
        text.textContent = (card.getAttribute("data-skr-progress-text") || "{done} / {total}")
          .replace("{done}", number(done)).replace("{total}", number(checks.length));
      }
      card.classList.toggle("is-complete", done === checks.length);
      card.hidden = false;
    }
    if (before !== card.hidden) { document.dispatchEvent(new CustomEvent("skr-sidebar-changed")); }
  }

  function start() {
    update();
    document.addEventListener("change", function (e) {
      if (e.target && e.target.matches && e.target.matches('li > input[type="checkbox"]')) { update(); }
    });
  }
  var started = false;
  function once() { if (!started) { started = true; start(); } }
  document.addEventListener("skr-ready", once);
  /* Ohne skr.js (kein Kern im Kopf) beim Laden der Seite. */
  if (!window.skr || !window.skr.ready) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", once);
    else once();
  }
})();
