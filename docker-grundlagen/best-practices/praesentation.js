(function () {
  "use strict";
  /* WAS WIRD NEU GEBAUT? Die Regel steht auf der Folie davor, hier wird sie
     gerechnet - fuer beide Reihenfolgen zugleich. Man sieht dadurch nicht ZWEI
     Bilder, sondern DIESELBE Regel auf zwei Anordnungen.

     Gerechnet wird von der Basis abwaerts (im Bild von oben nach unten): Die
     erste Schicht, die das Geaenderte enthaelt, wird neu gebaut - und mit ihr
     alles, was auf ihr steht.

     `COPY . .` traegt BEIDES (`code deps`): Es kopiert die Abhaengigkeitsliste
     mit. Ohne diese Feinheit saehe die linke Spalte bei einer geaenderten Liste
     faelschlich gut aus. */
  var FAELLE = [
    { wert: "nichts", name: "Nichts geändert" },
    { wert: "code",   name: "Eine Quelldatei geändert" },
    { wert: "deps",   name: "Die Abhängigkeitsliste geändert" }
  ];

  var vergleich = document.getElementById("lc-vergleich");
  var knoepfe   = [].slice.call(document.querySelectorAll("[data-lc-wahl]"));
  if (!vergleich || !knoepfe.length) return;

  /* Rechnet EINEN Fall in EINEM Baum durch - derselbe Code fuer den Bildschirm
     und fuer die drei Fassungen auf dem Papier. */
  function zeichne(wurzel, fall) {
    [].slice.call(wurzel.querySelectorAll("[data-lc-stapel]")).forEach(function (liste) {
      var betroffen = false;
      [].slice.call(liste.children).forEach(function (schicht) {
        if (schicht.classList.contains("lc__layer--meta")) return;
        var enthaelt = (schicht.getAttribute("data-lc-enthaelt") || "").split(" ");
        if (fall !== "nichts" && enthaelt.indexOf(fall) !== -1) betroffen = true;
        schicht.classList.toggle("lc__layer--neu", betroffen);
        var marke = schicht.querySelector(".lc__marke");
        if (marke) marke.textContent = betroffen ? "neu gebaut" : "aus dem Cache";
      });
    });
    [].slice.call(wurzel.querySelectorAll("[data-lc-fall]")).forEach(function (t) {
      t.hidden = t.getAttribute("data-lc-fall") !== fall;
    });
  }

  /* AUF PAPIER STEHEN ALLE DREI FAELLE. Sie entstehen beim Laden aus demselben
     Markup - eine von Hand gepflegte Kopie waere binnen einer Aenderung falsch.
     Erzeugt wird hier und nicht erst bei `beforeprint`: Bleibt das Ereignis aus
     (es kommt nicht in jedem Browser), fehlten sonst zwei Drittel. */
  var druck = document.getElementById("lc-druck");
  if (druck) {
    FAELLE.forEach(function (fall) {
      var titel = document.createElement("p");
      titel.className = "lc__druck-fall";
      titel.textContent = fall.name;
      var kopie = vergleich.cloneNode(true);
      kopie.removeAttribute("id");
      zeichne(kopie, fall.wert);
      /* Die Kennungen der Kopie muessen weg: Sonst faende die Bedienung oben
         die Kopien mit und zeichnete sie mit um. */
      [].slice.call(kopie.querySelectorAll("[data-lc-stapel]")).forEach(function (el) {
        el.removeAttribute("data-lc-stapel");
      });
      druck.appendChild(titel);
      druck.appendChild(kopie);
    });
  }

  var wahl = "nichts";               /* der Stand, in dem das Markup ausgeliefert wird */
  function umschalten(neuerFall) {
    wahl = neuerFall;
    knoepfe.forEach(function (k) {
      k.setAttribute("aria-pressed", k.getAttribute("data-lc-wahl") === wahl ? "true" : "false");
    });
    zeichne(vergleich, wahl);
  }

  knoepfe.forEach(function (k) {
    k.addEventListener("click", function () { umschalten(k.getAttribute("data-lc-wahl")); });
  });

  umschalten(wahl);

  /* KEIN ZUSTAND IN DER ADRESSE. Auf einer Praesentation gehoert das Fragment
     dem Layout (`#/3` ist die Foliennummer); `AvdAcademyState` haelt dort
     ausdruecklich still. Ein zweiter Schreiber zerschoesse die Foliennummer. */
})();
