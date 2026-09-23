/* =============================================================================
   Baustein-Demo – ein Baustein, vorgeführt in seiner eigenen Umgebung
   -----------------------------------------------------------------------------
   WOZU: Eine Doku, die einen Baustein nur BESCHREIBT, lässt den Leser raten, wie
   er sich verhält. Eine Doku, die ihn danebenstellt, beantwortet das – aber nur
   für die eine Breite und das eine Farbschema, in dem die Seite gerade steht.
   Genau dort liegen die Fehler: Das Theme misst sich an 320 Pixeln und an beiden
   Schemata, und beides sieht man auf einer Doku-Seite nie.

   WARUM EIN IFRAME UND KEIN KASTEN MIT `max-width`: Weil ein Kasten die
   Medienabfragen nicht auslöst. `@media (max-width: 46rem)` fragt das FENSTER,
   nicht den Kasten – ein auf 320 Pixel verengtes `div` zeigt also weiter das
   Layout für den Schreibtisch. Ein Rahmen hat sein eigenes Fenster: Dort ist die
   Umschaltung echt, und ebenso das Farbschema (die Dark-Tokens des Themes hängen
   an `:root`, lassen sich also nicht für einen Ausschnitt setzen).

   OHNE JAVASCRIPT BLEIBT ALLES STEHEN. Die Bühne enthält den Baustein bereits
   als gewöhnliches Markup; dieses Skript ERSETZT ihn durch den Rahmen. Bricht es
   ab, steht die Vorführung da wie auf jeder anderen Seite, nur ohne Schalter.

   Einbindung auf einer Doku-Seite (zwei Zeilen im Markdown genügen):
     <link rel="stylesheet" href="/theme/academy/demo.css">
     <script src="/theme/academy/demo.js" defer></script>
   ============================================================================= */
(function () {
  "use strict";

  /* Die Breiten sind nicht frei gewählt: 320 ist die Prüfgröße aus WCAG 1.4.10,
     480 ein gewöhnliches Telefon im Querformat, 768 der Punkt, an dem die
     meisten Umbrüche des Themes liegen. „voll" ist der Normalfall. */
  var BREITEN = [320, 480, 768, 0];

  var T = (document.documentElement.lang || "de").indexOf("en") === 0
    ? { breite: "Width", voll: "full", schema: "Colour scheme",
        hell: "light", dunkel: "dark", seite: "page", rahmen: "Demo" }
    : { breite: "Breite", voll: "voll", schema: "Farbschema",
        hell: "hell", dunkel: "dunkel", seite: "Seite", rahmen: "Vorführung" };

  /* Was die Seite lädt, lädt auch der Rahmen. Damit ist die Vorführung nicht
     „ungefähr wie das Theme", sondern dasselbe Theme – inklusive der Stile, die
     nur ein bestimmtes Layout einbindet. `href`/`src` als EIGENSCHAFT gelesen
     (nicht als Attribut): Die geben die absolute Adresse, und ein `srcdoc`-
     Dokument hat `about:srcdoc` als Basis, kann also mit relativen Pfaden
     nichts anfangen. */
  function kopf() {
    var teile = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
      teile.push('<link rel="stylesheet" href="' + l.href + '">');
    });
    document.querySelectorAll("script[src]").forEach(function (s) {
      if (s.src.indexOf("atvantage.js") === -1) { return; }
      teile.push('<script src="' + s.src + '" defer><\/script>');
    });
    return teile.join("\n");
  }

  /* Der Baustein steht im Rahmen in DEMSELBEN Behälter wie auf der Seite –
     sonst fehlte ihm der Flussrhythmus (`.avd-academy-…-main > * + *`), und die
     Abstände in der Vorführung wären andere als die echten. */
  function behaelter(el) {
    var wirt = el.closest(".avd-academy-guide-main, .avd-academy-doc-main");
    return wirt ? wirt.className.split(/\s+/)[0] : "avd-academy-doc-main";
  }

  function knopf(text, gewaehlt) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "avd-academy-demo__switch";
    b.textContent = text;
    b.setAttribute("aria-pressed", gewaehlt ? "true" : "false");
    return b;
  }

  function gruppe(beschriftung) {
    var g = document.createElement("div");
    g.className = "avd-academy-demo__group";
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", beschriftung);
    var t = document.createElement("span");
    t.className = "avd-academy-demo__label";
    t.textContent = beschriftung;
    g.appendChild(t);
    return g;
  }

  function aufbauen(demo) {
    var buehne = demo.querySelector(".avd-academy-demo__stage");
    if (!buehne) { return; }
    var markup = buehne.innerHTML;
    var klasse = behaelter(demo);

    var rahmen = document.createElement("iframe");
    rahmen.className = "avd-academy-demo__frame";
    rahmen.title = T.rahmen;
    /* Eine Doku-Seite zeigt ein Dutzend Bausteine. Ohne `lazy` lüde sie ein
       Dutzend Dokumente auf einmal - und zwar alle, bevor der Leser den
       ersten gesehen hat. */
    rahmen.loading = "lazy";
    /* `<base target="_blank">`: Ein Verweis in der Vorführung soll die
       Vorführung nicht ersetzen – man käme nur mit „zurück" wieder heraus, und
       auch das nur im Rahmen. */
    rahmen.srcdoc =
      '<!doctype html><html lang="' + (document.documentElement.lang || "de") + '">' +
      '<head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<base target="_blank">' + kopf() +
      '<style>html,body{margin:0;background:var(--avd-academy-color-bg);}' +
      '.avd-demo-wrap{padding:1.25rem;}</style>' +
      '</head><body class="' + document.body.className + '">' +
      '<div class="avd-demo-wrap ' + klasse + '">' + markup + '</div>' +
      '</body></html>';

    buehne.textContent = "";
    buehne.appendChild(rahmen);

    /* DIE HÖHE FOLGT DEM INHALT. Ein Rahmen hat von sich aus eine feste Höhe;
       ohne das hier stünde unter jedem Baustein leerer Raum oder es fehlte
       etwas. Beobachtet wird der Inhalt, nicht ein Ereignis: Ein Akkordeon
       wächst 220 ms lang, und ein einmaliges Messen nach dem Laden träfe genau
       den falschen Moment. */
    function nachmessen() {
      var d = rahmen.contentDocument;
      if (!d || !d.body) { return; }
      rahmen.style.height = Math.ceil(d.documentElement.scrollHeight) + "px";
    }
    rahmen.addEventListener("load", function () {
      nachmessen();
      var d = rahmen.contentDocument;
      if (window.ResizeObserver && d && d.body) {
        new window.ResizeObserver(nachmessen).observe(d.body);
      }
      /* Die Schrift kommt aus dem Netz; sie ändert die Höhe, nachdem der Rahmen
         längst geladen ist. */
      if (d && d.fonts && d.fonts.ready) { d.fonts.ready.then(nachmessen); }
      schemaSetzen(schema);
    });

    /* --- Schalter --------------------------------------------------------- */
    var leiste = document.createElement("div");
    leiste.className = "avd-academy-demo__controls";

    var gBreite = gruppe(T.breite);
    var breitenKnoepfe = BREITEN.map(function (px) {
      var b = knopf(px ? String(px) : T.voll, px === 0);
      b.addEventListener("click", function () {
        rahmen.style.width = px ? px + "px" : "";
        breitenKnoepfe.forEach(function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        /* Nach dem Verengen ist die Höhe eine andere – erst nach dem Umbruch
           messen, sonst steht die alte da. */
        window.requestAnimationFrame(nachmessen);
      });
      gBreite.appendChild(b);
      return b;
    });
    leiste.appendChild(gBreite);

    var schema = "";   /* "" = wie die Seite */
    function schemaSetzen(wert) {
      schema = wert;
      var d = rahmen.contentDocument;
      if (!d) { return; }
      if (wert) { d.documentElement.setAttribute("data-avd-academy-theme", wert); }
      else { d.documentElement.removeAttribute("data-avd-academy-theme"); }
    }

    var gSchema = gruppe(T.schema);
    var schemata = [["", T.seite], ["light", T.hell], ["dark", T.dunkel]];
    var schemaKnoepfe = schemata.map(function (paar) {
      var b = knopf(paar[1], paar[0] === "");
      b.addEventListener("click", function () {
        schemaSetzen(paar[0]);
        schemaKnoepfe.forEach(function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        window.requestAnimationFrame(nachmessen);
      });
      gSchema.appendChild(b);
      return b;
    });
    leiste.appendChild(gSchema);

    demo.insertBefore(leiste, buehne);
    demo.classList.add("avd-academy-demo--enhanced");
  }

  function init() {
    document.querySelectorAll("[data-avd-academy-demo]").forEach(aufbauen);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
