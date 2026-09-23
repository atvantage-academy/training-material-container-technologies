/* =============================================================================
   Web / GitHub Pages – Seitenverhalten
   -----------------------------------------------------------------------------
   Optionales Verhalten für Webseiten-Layouts, das ÜBER das markenweite
   theme/academy/atvantage.js hinausgeht (z. B. Hervorheben des aktiven Nav-Punkts,
   Merken der gewählten Sprache).
   Abhängigkeitsfrei. Nur einbinden, wenn das Doku-Layout genutzt wird.
   ============================================================================= */
(function () {
  "use strict";

  /* Aktuellen Navigationspunkt anhand des Pfads markieren. */
  function markCurrentNav() {
    var here = location.pathname.replace(/\/index\.html$/, "/");
    document.querySelectorAll(".avd-academy-doc__nav a").forEach(function (a) {
      var href = a.getAttribute("href");
      if (!href) return;
      var path = new URL(href, location.origin + location.pathname).pathname
        .replace(/\/index\.html$/, "/");
      if (path === here) a.setAttribute("aria-current", "page");
    });
  }

  /* --- Sprachwahl merken --------------------------------------------------
     Der Sprachumschalter ist ein echter Link (siehe _includes/tools.html) und
     funktioniert ohne dieses Skript. Hier wird nur festgehalten, DASS jemand
     ausdrücklich gewählt hat – die Spracherkennung in head.html lässt danach die
     Finger von der Adresse. Eine Wahl, die bei der nächsten Seite wieder
     überstimmt wird, wäre keine.

     Geschrieben wird beim Klick, nicht beim Laden der Zielseite: Die Zielseite
     weiß nicht, ob sie aus einem Klick oder aus einer Umleitung kommt. */
  function initLangChoice() {
    document.querySelectorAll("[data-avd-academy-lang-choice]").forEach(function (a) {
      a.addEventListener("click", function () {
        try {
          localStorage.setItem("avd-academy-lang", a.getAttribute("data-avd-academy-lang-choice"));
        } catch (e) { /* localStorage gesperrt - dann eben ohne Gedaechtnis */ }
      });
    });
  }

  /* Aktuelles Jahr in Footer einsetzen (Elemente mit [data-avd-academy-year]). */
  function fillYear() {
    var year = new Date().getFullYear();
    document.querySelectorAll("[data-avd-academy-year]").forEach(function (el) {
      el.textContent = year;
    });
  }

  function init() { markCurrentNav(); fillYear(); initLangChoice(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
