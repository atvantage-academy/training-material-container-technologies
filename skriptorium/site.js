/* =============================================================================
   Web / GitHub Pages – Seitenverhalten
   -----------------------------------------------------------------------------
   Optionales Verhalten für Webseiten-Layouts, das ÜBER das markenweite
   skriptorium/client.js hinausgeht: Jahreszahl im Fußbereich, Merken der
   gewählten Sprache. Abhängigkeitsfrei; geladen vom Rahmen (head.html).
   ============================================================================= */
(function () {
  "use strict";

  /* --- Sprachwahl merken --------------------------------------------------
     Der Sprachumschalter ist ein echter Link (siehe tools.html) und
     funktioniert ohne dieses Skript. Hier wird nur festgehalten, DASS jemand
     ausdrücklich gewählt hat – die Spracherkennung in head.html lässt danach die
     Finger von der Adresse. Eine Wahl, die bei der nächsten Seite wieder
     überstimmt wird, wäre keine.

     Geschrieben wird beim Klick, nicht beim Laden der Zielseite: Die Zielseite
     weiß nicht, ob sie aus einem Klick oder aus einer Umleitung kommt. */
  function initLangChoice() {
    document.querySelectorAll("[data-skr-lang-choice]").forEach(function (a) {
      a.addEventListener("click", function () {
        try {
          localStorage.setItem("skr-lang", a.getAttribute("data-skr-lang-choice"));
        } catch (e) { /* localStorage gesperrt - dann eben ohne Gedaechtnis */ }
      });
    });
  }

  /* Aktuelles Jahr in Footer einsetzen (Elemente mit [data-skr-year]). */
  function fillYear() {
    var year = new Date().getFullYear();
    document.querySelectorAll("[data-skr-year]").forEach(function (el) {
      el.textContent = year;
    });
  }

  function init() { fillYear(); initLangChoice(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
