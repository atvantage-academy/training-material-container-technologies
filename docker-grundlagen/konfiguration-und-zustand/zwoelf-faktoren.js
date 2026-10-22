(function () {
  "use strict";
  var fenster = document.getElementById("zf-fenster");
  var koerper = document.getElementById("zf-koerper");
  var titel   = document.getElementById("zf-titel");
  var nr      = document.getElementById("zf-nr");
  var marke   = document.getElementById("zf-marke");
  if (!fenster || !fenster.showModal) return;   /* ohne <dialog> bleibt die Seite lesbar */

  /* DAS BLATT WIRD VERSCHOBEN, NICHT KOPIERT. Die Reiter sind Bausteine des
     Themes; sein Skript wertet sie beim Laden der Seite auf. Eine Kopie waere
     roher Markup-Abzug und bliebe ein Akkordeon. Ein verschobener Knoten nimmt
     die Aufwertung mit – und wandert beim Schliessen zurueck ins Lager, damit
     der Druck ihn wieder an seiner Stelle findet. */
  /* Die Blaetter liegen an zwei Stellen: die zwoelf Faktoren im Lager VOR der
     Zusammenfassung, die vier Stationen mitten in ihr. Auf Papier ist das die
     Lesereihenfolge. Deshalb merkt sich das Fenster nicht "das Lager", sondern
     die Stelle, von der es das Blatt geholt hat - samt Nachbarn. Mit
     `appendChild` landete ein einmal geoeffneter Faktor am ENDE des Lagers und
     stuende im Ausdruck hinter allen anderen. */
  var offen = null, heimat = null, nachbar = null;
  function zurueck() {
    if (offen && heimat) heimat.insertBefore(offen, nachbar);
    offen = null; heimat = null; nachbar = null;
  }

  /* Faktoren UND Stationen liegen im selben Lager und benutzen dasselbe
     Fenster. Eine zweite Fenstermechanik waere doppelt zu pflegen - und der
     Hash muesste zweimal bedacht werden. */
  var BLAETTER = ".zf__blatt, .sw__blatt";

  function oeffne(id, ausHash) {
    oeffneBlatt(document.getElementById(id), ausHash);
  }

  function oeffneBlatt(blatt, ausHash) {
    if (!blatt) return;
    zurueck();
    titel.textContent = blatt.getAttribute("data-titel");
    nr.textContent    = blatt.getAttribute("data-nr");
    /* Die Marke gehoert neben den Titel, nicht in einen Reiter: Sie gilt fuer
       den ganzen Faktor und darf nicht erst beim Umschalten auftauchen. */
    if (marke) marke.hidden = blatt.getAttribute("data-kern") !== "ja";
    heimat  = blatt.parentNode;          /* VOR dem Verschieben merken */
    nachbar = blatt.nextSibling;
    koerper.appendChild(blatt);
    offen = blatt;
    koerper.scrollTop = 0;
    /* Gescrollt wird im Reiter, also dort auch wieder nach oben. */
    Array.prototype.forEach.call(
      blatt.querySelectorAll(".skr-tabs__panel"), function (t) { t.scrollTop = 0; });
    if (!fenster.open) fenster.showModal();
    /* Kommt der Aufruf AUS der Adresse, waere ein erneutes Schreiben eine Schleife. */
    if (!ausHash) zustandMelden();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-zf]"), function (knopf) {
    knopf.addEventListener("click", function () { oeffne("zf-" + knopf.getAttribute("data-zf")); });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-sw]"), function (knopf) {
    knopf.addEventListener("click", function () {
      oeffneBlatt(blattZuSlug(knopf.getAttribute("data-sw")));
    });
  });

  /* --- DAS NETZ AUF DER UEBERSICHT -----------------------------------------
     Die Paare kommen AUS den Querverweisen der Blaetter – nicht aus einer
     zweiten Liste hier im Skript. Eine solche Liste waere binnen einer
     Ueberarbeitung veraltet, und niemand saehe es ihr an: Die Linie zeigte
     einen Zusammenhang, den der Text nicht mehr nennt.

     Gezeichnet wird nur, was BEIDE Seiten nennen. Eine einseitige Nennung ist
     kein Fehler (X nennt IX als Voraussetzung, IX kommt ohne X aus) – sie
     traegt nur keine Linie, weil man am anderen Ende nichts dazu faende. */
  var netz = document.getElementById("zf-netz");
  var SVG_NS = "http://www.w3.org/2000/svg";

  function netzPaare() {
    var nrZuSlug = {};
    Array.prototype.forEach.call(document.querySelectorAll(".zf__blatt"), function (b) {
      nrZuSlug[b.getAttribute("data-slug")] = b.id.replace("zf-", "");
    });
    var genannt = {};
    Array.prototype.forEach.call(document.querySelectorAll(".zf__blatt"), function (b) {
      var von = b.id.replace("zf-", "");
      Array.prototype.forEach.call(b.querySelectorAll(".zf__bezug a"), function (a) {
        var nach = nrZuSlug[(a.getAttribute("href") || "").replace(/^#/, "")];
        if (nach) genannt[von + ">" + nach] = true;
      });
    });
    var paare = [], gesehen = {};
    Object.keys(genannt).forEach(function (k) {
      var t = k.split(">");
      if (!genannt[t[1] + ">" + t[0]]) return;
      var a = Math.min(Number(t[0]), Number(t[1]));
      var b = Math.max(Number(t[0]), Number(t[1]));
      var schluessel = a + "-" + b;
      if (gesehen[schluessel]) return;
      gesehen[schluessel] = true;
      paare.push({ a: a, b: b, schluessel: schluessel });
    });
    return paare;
  }

  /* In Pixeln gerechnet, nicht in Winkeln: Die Knopfmitte steht auch dann
     richtig, wenn die Medienabfrage die Buehne anders aufbaut oder ein Knopf
     durch laengeren Text hoeher wird. */
  function netzZeichnen() {
    var buehne = document.querySelector(".zf");
    if (!netz || !buehne) return;
    var rb = buehne.getBoundingClientRect();
    if (!rb.width || !rb.height) return;
    var mitte = {};
    Array.prototype.forEach.call(
      document.querySelectorAll(".zf__kreis [data-zf]"), function (k) {
        var r = k.getBoundingClientRect();
        mitte[k.getAttribute("data-zf")] = {
          x: r.left - rb.left + r.width / 2,
          y: r.top - rb.top + r.height / 2
        };
      });
    netz.setAttribute("viewBox", "0 0 " + rb.width + " " + rb.height);
    while (netz.firstChild) netz.removeChild(netz.firstChild);
    netzPaare().forEach(function (p) {
      var a = mitte[p.a], b = mitte[p.b];
      if (!a || !b) return;
      var linie = document.createElementNS(SVG_NS, "line");
      linie.setAttribute("x1", a.x); linie.setAttribute("y1", a.y);
      linie.setAttribute("x2", b.x); linie.setAttribute("y2", b.y);
      linie.setAttribute("data-paar", p.schluessel);
      netz.appendChild(linie);
    });
  }

  /* Beim Zeigen auf einen Knopf treten SEINE Linien hervor, der Rest tritt
     zurueck. Erst dadurch wird aus dem Geflecht eine Auskunft. */
  function netzHervorheben(nummer) {
    if (!netz) return;
    netz.classList.toggle("is-gedimmt", !!nummer);
    Array.prototype.forEach.call(netz.querySelectorAll("line"), function (l) {
      var t = (l.getAttribute("data-paar") || "").split("-");
      l.classList.toggle("is-hell", !!nummer && (t[0] === nummer || t[1] === nummer));
    });
  }

  Array.prototype.forEach.call(
    document.querySelectorAll(".zf__kreis [data-zf]"), function (knopf) {
      var an  = function () { netzHervorheben(knopf.getAttribute("data-zf")); };
      var aus = function () { netzHervorheben(null); };
      knopf.addEventListener("mouseenter", an);
      knopf.addEventListener("focus", an);
      knopf.addEventListener("mouseleave", aus);
      knopf.addEventListener("blur", aus);
    });

  netzZeichnen();
  /* Schriften kommen spaeter an und aendern die Knopfhoehe; die Breite aendert
     sich beim Drehen des Geraets. Beides verschoebe die Enden. */
  window.addEventListener("load", netzZeichnen);
  window.addEventListener("resize", netzZeichnen);

  /* --- DER OFFENE FAKTOR STEHT IN DER ADRESSE -------------------------------
     DAS FRAGMENT GEHOERT DEM SKRIPTORIUM, NICHT DIESER SEITE. `skr.state`
     fuehrt den Zustand aller Bausteine zusammen und schreibt die
     Adresse EINMAL (`#/?open=…&faktor=…`). Frueher schrieb hier jeder fuer
     sich, und der letzte Klick loeschte den anderen - genau daran ging schon
     einmal das Lesezeichen auf einen Faktor verloren, weil der Reiterstreifen
     `#«panel-id»` hineinschrieb.

     Das Fenster ist kein Auf-und-Zu unter vielen, sondern eine Auswahl: Es
     zeigt GENAU EIN Blatt. Deshalb `register({key})` und nicht `openable`.
     `#config` bleibt dabei lesbar - der Wert ist der Slug, nicht `zf-3`: Ein
     Lesezeichen soll das Umsortieren der Faktoren ueberleben. */
  function blattZuSlug(slug) {
    var treffer = null;
    Array.prototype.forEach.call(document.querySelectorAll(BLAETTER), function (b) {
      if (b.getAttribute("data-slug") === slug) treffer = b;
    });
    return treffer;
  }

  function zustandMelden() {
    if (window.skr && window.skr.state) window.skr.state.update();
  }

  function zustandAnmelden() {
    var Z = window.skr && window.skr.state;
    if (!Z) return;                   /* ohne skr.state: Seite bleibt bedienbar */
    Z.register({
      key: "faktor",
      read: function () { return offen ? offen.getAttribute("data-slug") : ""; },
      apply: function (wert) {
        var blatt = wert ? blattZuSlug(wert) : null;
        if (blatt) { if (offen !== blatt) oeffneBlatt(blatt, true); }
        else if (fenster.open) { fenster.close(); }
      }
    });
    /* Anmelden darf jederzeit passieren: Wer sich nach dem ersten Herstellen
       meldet, bekommt seinen Wert vom Skriptorium sofort nachgereicht. */

    /* ALTE LESEZEICHEN BLEIBEN GUELTIG. Vor 2.46.0 stand der Faktor als blosse
       Sprungmarke in der Adresse (`#logs`), beim Reiter zweigeteilt
       (`#logs--zusammenhaenge`). Fuer das Skriptorium ist das eine Sprungmarke ins
       Leere - hier wird sie aufgeloest. */
    var anker = Z.anchor ? Z.anchor() : "";
    if (!offen && anker) {
      var alt = blattZuSlug(anker) || blattZuSlug(String(anker).split("--")[0]);
      if (alt) oeffneBlatt(alt, true);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", zustandAnmelden);
  } else {
    zustandAnmelden();
  }

  /* QUERVERWEISE OEFFNEN DAS FENSTER SELBST. Ein `href="#logs"` ist fuer das
     Theme eine gewoehnliche Sprungmarke - es gibt kein Element mit dieser ID,
     also passiert nichts. Der Klick wird deshalb hier abgefangen; das ist
     ohnehin ehrlicher, als einen Zustand ueber einen Seitensprung zu
     transportieren. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var blatt = blattZuSlug(a.getAttribute("href").slice(1));
    if (!blatt) return;
    e.preventDefault();
    oeffneBlatt(blatt);
  });

  fenster.querySelector(".zf__zu").addEventListener("click", function () { fenster.close(); });

  /* NEBEN DAS FENSTER KLICKEN SCHLIESST. Ein Klick auf den abgedunkelten Grund
     landet beim <dialog> selbst – der Inhalt liegt in Kindelementen. Genau
     daran laesst sich beides unterscheiden, ohne Koordinaten zu pruefen. */
  fenster.addEventListener("click", function (e) {
    if (e.target === fenster) fenster.close();
  });
  /* Auch Esc laeuft hier durch – `close` feuert in jedem Fall. */
  fenster.addEventListener("close", function () {
    zurueck();
    zustandMelden();                  /* raeumt den Faktor aus der Adresse */
  });

  /* DRUCK. Das Aufklappen der Reiter macht das Theme (es nimmt dafuer die
     `name`-Attribute kurz weg, sonst schlossen sich die Geschwister reihum).
     Hier bleibt nur, was es nicht wissen kann: Ein Blatt, das gerade im Fenster
     liegt, muss zurueck an seinen Platz - das Fenster ist auf Papier
     ausgeblendet, das Blatt fehlte sonst.

     `close()` allein genuegt dafuer nicht: Das `close`-Ereignis - und mit ihm
     `zurueck()` - kommt erst in einer eigenen Aufgabe, moeglicherweise also
     nach dem Druck. */
  window.addEventListener("beforeprint", function () {
    if (fenster.open) fenster.close();
    zurueck();
  });

})();
