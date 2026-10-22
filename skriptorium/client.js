/* =============================================================================
   Skriptorium – interaktives Verhalten
   -----------------------------------------------------------------------------
   Kleines, abhängigkeitsfreies Skript für Interaktionen, die in
   JEDER Unterlage verfügbar sein sollen. Bewusst schlank gehalten; unterlagen-
   spezifische Logik gehört in das Skript der jeweiligen Unterlage.

   Aktuell enthalten:
     - Theme-Umschaltung  (Elemente mit [data-skr-theme-toggle])
     - "Kopieren"-Buttons an Code-Blöcken (<pre>)
     - Mobiles Aufklappen der Header-Navigation ([data-skr-nav-toggle])
     - "Markdown kopieren" auf Übungsseiten ([data-skr-copy-md])
     - QR-Code der Seiten-URL ([data-skr-qr])
     - Client-API `skr` (= `skriptorium`; Bauauskunft und Steuerung, siehe unten)

   Einbindung: <script src="…/skriptorium/client.js" defer></script> (relativ zur Seite)
   ============================================================================= */
(function () {
  "use strict";

  /* Eigene Adresse merken, SOLANGE das Skript läuft: `document.currentScript` ist
     nur während der Ausführung gesetzt (bei `defer` also genau hier, nicht mehr in
     späteren Callbacks). Der QR-Code lädt seine Bibliothek relativ dazu nach – so
     braucht das Skript keinen fest verdrahteten Pfad. Inline eingebunden (kein `src`) bleibt der Wert leer; dann fällt der
     Nachladepfad auf die Dokument-Basis zurück. */
  var scriptUrl = (document.currentScript && document.currentScript.src) || "";

  /* ==========================================================================
     ZUSTAND IN DER ADRESSE (`skr.state`)
     --------------------------------------------------------------------------
     EINE BEDIENUNG, DIE MAN NICHT WIEDERFINDET, IST EIN VERLUST. Wer einen Reiter
     wählt, einen Abschnitt aufklappt oder eine Musterlösung aufdeckt und die Seite
     neu lädt, steht sonst wieder am Anfang - und der QR-Code an der Wand zeigt auf
     ein anderes Bild als das, über das gerade gesprochen wird.

     WARUM EINE GEMEINSAME STELLE UND NICHT JE BAUSTEIN EINE: Es gibt genau EIN
     Fragment je Seite. Schreibt jeder Baustein für sich hinein, gewinnt der letzte
     Klick und löscht die anderen - genau das tat der Reiterstreifen, solange er
     `#«panel-id»` selbst setzte. Zustand ist deshalb eine Eigenschaft der SEITE,
     nicht des einzelnen Bausteins: Hier laufen alle zusammen, und die Adresse
     entsteht einmal aus allen Teilen.

     DIE FORM:

         #«anker»                 klassische Sprungmarke - unverändert, wie bisher
         #/?open=a,b              nur Zustand
         #/«anker»?open=a,b       Sprungmarke UND Zustand

     Der führende Schrägstrich ist das Erkennungszeichen: Ohne ihn ist das Fragment
     eine gewöhnliche Sprungmarke, und jeder bestehende Verweis funktioniert weiter.
     Der Preis dieser Form ist, dass der Browser bei `#/…` nicht mehr von selbst
     springt (kein Element hat diese ID) - das übernimmt `jump()` hier.

     `open` ist der Schlüssel der Bausteine, die auf- und zugehen. Er führt IDs,
     keine Nummern: `#/?open=windows,hinweis` überlebt das Umsortieren der Seite,
     `#/?open=2,5` nicht.

     FÜR EIGENE BAUSTEINE (Consumer des Themes) gibt es zwei Wege:

         skr.state.openable({ id, exclusive, isOpen, set })
             - alles, was auf- und zugeht, reiht sich in `open` ein.

         skr.state.register({ key, read, apply })
             - alles andere: ein gewählter Datensatz, eine Zoomstufe, ein Filter.
               `read` liefert den Wert (leer = Standard), `apply` stellt ihn her.

         skr.state.update()
             - nach jeder Bedienung aufrufen; schreibt die Adresse neu.

     GESCHRIEBEN WIRD MIT `replaceState`, nicht über `location.hash`: Letzteres
     SPRINGT zum Ziel (die Seite scrollte bei jedem Klick) und legt je Bedienung
     einen Verlaufseintrag an - wer fünfmal umschaltet, müsste fünfmal zurück, um
     die Seite zu verlassen. `replaceState` löst kein `hashchange` aus; deshalb
     geht zusätzlich `skr-urlchange` hinaus, auf das der QR-Code hört.

     GESCHRIEBEN WIRD NUR, WAS VOM DOKUMENT ABWEICHT. Der Ausgangszustand ist das
     Markup des Autors; solange niemand etwas anfasst, bleibt die Adresse sauber.
     Umgekehrt gilt: Steht der Schlüssel in der Adresse, ist er die Wahrheit - auch
     leer (`open=`) bedeutet dann "alles zu", sonst ließe sich ein geschlossener
     Standard-Aufklapper nicht ausdrücken.

     AUF LAYOUTS MIT EIGENEN FRAGMENTEN HÄLT DIESE STELLE STILL. Meldet ein Layout
     Fragmente an, die erst im Browser entstehen (`fragments`, etwa `#/3`
     der Präsentation), gehört das Fragment ihm, und ein zweiter Schreiber
     zerschösse die Folien- oder Schrittnummer.
     ========================================================================== */
  var State = (function () {
    var parts = [];        /* {key, read, apply, standard} */
    var disclosures = [];    /* {id, exclusive, isOpen, set} */
    var ready = false;    /* erst nach dem ersten `apply()` wird geschrieben */
    var applying = false;

    function foreignFragment() {
      var block = document.getElementById("skr-page-info");
      if (!block) return false;
      try { return ((JSON.parse(block.textContent) || {}).runtimeFragments || []).length > 0; } catch (e) { return false; }
    }

    /* Aus dem Fragment werden Sprungmarke und Werte. Alles, was nicht mit `/`
       beginnt, ist eine gewöhnliche Sprungmarke und hat keine Werte. */
    function address() {
      var raw = location.hash || "";
      if (raw.charAt(0) === "#") { raw = raw.slice(1); }
      if (raw.charAt(0) !== "/") { return { anchor: decode(raw), values: {} }; }
      raw = raw.slice(1);
      var sep = raw.indexOf("?");
      var anchor = decode(sep === -1 ? raw : raw.slice(0, sep));
      var values = {};
      if (sep !== -1) {
        raw.slice(sep + 1).split("&").forEach(function (pair) {
          if (!pair) { return; }
          var i = pair.indexOf("=");
          var k = decode(i === -1 ? pair : pair.slice(0, i));
          values[k] = decode(i === -1 ? "" : pair.slice(i + 1));
        });
      }
      return { anchor: anchor, values: values };
    }

    /* Eine von Hand getippte Adresse darf kaputt sein - sie führt dann in den
       Ausgangszustand und nicht in eine Ausnahme. */
    function decode(text) {
      try { return decodeURIComponent(text); } catch (e) { return text; }
    }

    function encode(text) {
      /* Kommas bleiben lesbar: `open=a,b` ist eine Liste, keine Kodierung. */
      return encodeURIComponent(text).replace(/%2C/g, ",");
    }

    function valuesNow() {
      var values = {};
      parts.forEach(function (t) {
        var value;
        try { value = t.read(); } catch (e) { return; }
        if (value === null || value === undefined) { return; }
        value = String(value);
        if (value !== t.standard) { values[t.key] = value; }
      });
      return values;
    }

    function writeState() {
      /* WAEHREND DES HERSTELLENS WIRD NICHT GESCHRIEBEN. `<details>` meldet sein
         `toggle` verzoegert; ein Baustein, der beim Anwenden aufgeht, ruft also
         `update()` in dem Moment, in dem die halbe Seite hergestellt ist. Wer
         dann schreibt, ueberschreibt die Adresse mit einem Zwischenstand - und
         der Rest der Liste ist danach weg. */
      if (!ready || applying || foreignFragment()) { return; }
      var now = address();
      var values = valuesNow();
      var key = Object.keys(values);
      var fresh;
      if (!key.length) {
        fresh = now.anchor ? "#" + encode(now.anchor) : "";
      } else {
        fresh = "#/" + encode(now.anchor) + "?" + key.map(function (k) {
          return encode(k) + "=" + encode(values[k]);
        }).join("&");
      }
      if (fresh === (location.hash || "")) { return; }
      if (!window.history || !window.history.replaceState) { return; }
      /* Ohne Fragment bleibt die Adresse ohne `#` stehen - ein nacktes `#` wäre
         ein sichtbarer Rest von etwas, das nicht mehr da ist. */
      window.history.replaceState(null, "", fresh || (location.pathname + location.search));
      window.dispatchEvent(new CustomEvent("skr-urlchange"));
    }

    /* NUR SCHLÜSSEL, DIE DASTEHEN, werden angewendet. Ein fehlender Schlüssel ist
       keine Aussage "alles zu", sondern gar keine - sonst schlösse der erste
       Seitenaufruf jeden Abschnitt, den der Autor offen geschrieben hat. */
    function apply() {
      applying = true;
      window.setTimeout(function () { applying = false; }, 0);
      var values = address().values;
      parts.forEach(function (t) {
        if (!Object.prototype.hasOwnProperty.call(values, t.key)) { return; }
        try { t.apply(values[t.key]); } catch (e) { /* ein Baustein darf scheitern */ }
      });
    }

    /* Bei `#/…` springt der Browser nicht von selbst - und er könnte es auch gar
       nicht: Das Ziel steckt womöglich in einem Bereich, der erst durch den
       Zustand aufgeht. Deshalb erst anwenden, dann springen. */
    function jump() {
      var raw = location.hash || "";
      if (raw.slice(0, 2) !== "#/") { return; }
      var anchor = address().anchor;
      if (!anchor) { return; }
      var target = document.getElementById(anchor);
      if (target) { target.scrollIntoView(); }
    }

    /* SPAETE ANMELDUNG. Dieses Skript laeuft mit `defer` und damit VOR
       `DOMContentLoaded` - ein Inline-Skript einer Seite, das auf dieses Ereignis
       wartet (der uebliche Weg), meldet sich also erst NACH `restore()`. Ohne
       Nachtrag bekaeme es seinen Zustand nie: Die Adresse traegt ihn, und niemand
       liest ihn mehr. Deshalb wird er hier sofort nachgereicht, sobald sich jemand
       anmeldet. Anmelden darf damit jederzeit passieren - das ist die Zusage an
       eigene Bausteine, und ohne sie muesste jeder Aufrufer die Reihenfolge des
       Themes kennen. */
    function backfill(t) {
      if (!ready) { return; }   /* vor dem ersten `restore()` erledigt das `apply()` */
      var values = address().values;
      if (!Object.prototype.hasOwnProperty.call(values, t.key)) { return; }
      applying = true;
      window.setTimeout(function () { applying = false; }, 0);
      try { t.apply(values[t.key]); } catch (e) { /* ein Baustein darf scheitern */ }
    }

    /* DER AUSGANGSZUSTAND IST DAS MARKUP, nicht der gerade sichtbare Stand. Beides
       faellt auseinander, sobald eine Anmeldung nachtraegt: `read()` lieferte dann
       den bereits hergestellten Zustand, und der Vergleich „weicht ab?" ginge
       kuenftig gegen die Adresse statt gegen das Dokument. */
    function openDefault() {
      var ids = [];
      disclosures.forEach(function (o) {
        if (!o.defaultOpen || o.exclusive) { return; }
        ids.push(o.id);
      });
      return ids.join(",");
    }

    var openPart = {
      key: "open",
      read: function () {
        var ids = [];
        disclosures.forEach(function (o) {
          if (!o.isOpen()) { return; }
          /* EXKLUSIVES steht nur drin, wenn es abweicht: Ein Reiterstreifen hat
             IMMER einen offenen Reiter - stünde er stets in der Adresse, trüge
             jede Seite mit Reitern von Anfang an einen Zustand mit sich. */
          if (o.exclusive && o.defaultOpen) { return; }
          ids.push(o.id);
        });
        return ids.join(",");
      },
      apply: function (value) {
        var wanted = value ? value.split(",") : [];
        disclosures.forEach(function (o) {
          var expected = wanted.indexOf(o.id) !== -1;
          /* EXKLUSIV heißt: Genau eines ist offen. "Nicht genannt" bedeutet dort
             deshalb nicht "zu" - sonst stünde ein Reiterstreifen ohne Reiter da.
             Bei allem anderen ist die Liste vollständig: Was fehlt, ist zu. */
          if (o.exclusive && !expected) { return; }
          if (expected !== o.isOpen()) { o.set(expected); }
        });
      }
    };

    return {
      /* Ein Baustein, der auf- und zugeht. `id` ist die ID des Elements, das in
         der Adresse steht - sie muss auf der Seite eindeutig sein. */
      openable: function (o) {
        if (!o || !o.id) { return; }
        o.defaultOpen = !!o.isOpen();
        disclosures.push(o);
        if (parts.indexOf(openPart) === -1) {
          openPart.standard = "";
          parts.push(openPart);
        }
        /* Der Ausgangszustand waechst mit jedem Baustein, der sich anmeldet -
           deshalb nach jeder Anmeldung neu bestimmt. */
        openPart.standard = openDefault();
        backfill(openPart);
      },
      /* Alles, was kein Auf und Zu ist: ein gewählter Datensatz, eine Zoomstufe,
         ein Filter. `read()` liefert den aktuellen Wert, `apply(value)` stellt ihn
         her; was `read()` beim Anmelden liefert, gilt als Standard und steht
         deshalb nicht in der Adresse. */
      register: function (t) {
        if (!t || !t.key || typeof t.read !== "function" || typeof t.apply !== "function") { return; }
        var value;
        try { value = t.read(); } catch (e) { value = ""; }
        t.standard = (value === null || value === undefined) ? "" : String(value);
        parts.push(t);
        backfill(t);
      },
      /* Nach jeder Bedienung aufrufen. */
      update: writeState,
      /* Die Sprungmarke der Adresse - für Bausteine, die tiefe Verweise auf
         Inhalte in sich selbst auflösen müssen. */
      anchor: function () { return address().anchor; },
      /* Zustand aus der Adresse herstellen. Ruft das Theme selbst auf: einmal nach
         dem Aufbau der Seite und bei jedem `hashchange`. */
      restore: function () { apply(); jump(); },
      /* Ab hier darf geschrieben werden (nach dem ersten Herstellen). */
      ready: function () { ready = true; }
    };
  })();

  /* Am Namensraum `skr` (skr.js): für Seiten und Extensions, unabhängig von client_api. */
  /* SYMBOLE DER BEDIENELEMENTE als SVG, nicht als Schriftzeichen – wie in den Vorlagen
     (skriptorium/glyph.html): Ohne passende Schrift des Systems stünde sonst ein leeres
     Kästchen da. Farbe des Textes, Größe der Schrift, für Hilfsmittel verborgen. */
  var GLYPHS = {
    menu: [["path", { d: "M4 6h16M4 12h16M4 18h16" }]],
    close: [["path", { d: "M6 6l12 12M18 6 6 18" }]],
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    "caret-up": [["path", { d: "M5 16h14l-7-9z", fill: "currentColor", stroke: "none" }]],
    "caret-down": [["path", { d: "M5 8h14l-7 9z", fill: "currentColor", stroke: "none" }]]
  };
  function glyph(name) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    var attrs = { viewBox: "0 0 24 24", width: "1em", height: "1em", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" };
    Object.keys(attrs).forEach(function (k) { svg.setAttribute(k, attrs[k]); });
    (GLYPHS[name] || []).forEach(function (part) {
      var el = document.createElementNS(ns, part[0]);
      Object.keys(part[1]).forEach(function (k) { el.setAttribute(k, part[1][k]); });
      svg.appendChild(el);
    });
    return svg;
  }

  function toSkr(name, value) {
    if (window.skr && !(name in window.skr)) Object.defineProperty(window.skr, name, { value: value, enumerable: true });
  }
  toSkr("state", State);

  /* --- Lesbare IDs und die Abmeldung vom Zustand --------------------------
     WAS IN DER ADRESSE STEHT, LIEST JEMAND. `#/?open=musterloesung` ist ein
     brauchbares Lesezeichen, `#/?open=skr-fold-3` nicht - deshalb kommt der Name
     aus der Beschriftung, und nur wenn die nichts hergibt (oder der Name schon
     vergeben ist), aus dem Zaehler. Eine vorhandene ID bleibt unangetastet: Sie
     steht womoeglich schon in einem Verweis.

     `data-skr-state="off"` meldet einen Baustein (oder alles darunter)
     vom Zustand ab. Gedacht fuer Faelle, in denen das Aufklappen niemanden
     interessiert - eine Legende im Fussbereich, ein Gimmick. Der Baustein bleibt
     voll bedienbar; er traegt nur nichts in die Adresse ein. */
  function assignId(el, text, prefix, index) {
    if (el.id) { return el.id; }
    var wish = (text || "").trim().toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe")
      .replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    el.id = (wish && !document.getElementById(wish)) ? wish : (prefix + index);
    return el.id;
  }

  function withoutState(el) {
    var carrier = el.closest && el.closest("[data-skr-state]");
    return !!(carrier && carrier.getAttribute("data-skr-state") === "off");
  }

  /* --- Theme-Umschaltung -------------------------------------------------- */
  /* EIN WEG ZUM ABLAGEFACH - fuer alle drei Kopierknoepfe.

     `navigator.clipboard` gibt es NUR im sicheren Kontext. Eine aus dem
     Dateisystem geoeffnete Unterlage hat keinen, und ueber http von einer
     anderen Maschine aus auch nicht. Dort ist das Objekt schlicht `undefined`,
     und ein direkter Zugriff wirft
     `Cannot read properties of undefined (reading 'writeText')` - der Knopf
     tut dann gar nichts, und in der Konsole steht ein Fehler.

     GEMESSEN GENAU SO: Der Knopf an den Code-Bloecken und der an
     "Markdown kopieren" riefen die Schnittstelle direkt auf. Der Adressknopf
     hatte laengst einen Rueckfall - der lag aber IN seiner eigenen Funktion
     und war fuer die anderen beiden nicht erreichbar. Ein Rueckfall, den nur
     eine von drei gleichartigen Stellen kennt, ist keiner.

     AUCH EINE ABLEHNUNG FAELLT ZURUECK: Die Schnittstelle kann da sein und
     trotzdem ablehnen - fehlende Berechtigung, Seite nicht im Vordergrund.

     UND WENN BEIDE WEGE FEHLSCHLAGEN, faengt der Aufrufer das ab. Sonst bliebe
     eine unbehandelte Ablehnung in der Konsole stehen - derselbe rote Eintrag,
     wegen dem dieser Rueckfall ueberhaupt gebaut wurde, nur eine Zeile spaeter.
     Der Knopf bleibt dann unmarkiert: Er hat nicht kopiert, und das soll er
     auch nicht behaupten. */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return copyViaField(text);
      });
    }
    return copyViaField(text);
  }

  /* Der aeltere Weg ueber ein unsichtbares Textfeld. `document.execCommand`
     gilt als veraltet, ist aber das Einzige, was ohne sicheren Kontext traegt. */
  function copyViaField(text) {
    return new Promise(function (ok, error) {
      var field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy") ? ok() : error();
      } catch (e) {
        error(e);
      } finally {
        field.remove();
      }
    });
  }

  /* --- Farbschema ----------------------------------------------------------
     GILT IST, WAS MAN SIEHT: die ausdrückliche Wahl am <html>, sonst die
     Systemeinstellung. Nur das Attribut zu lesen hieß bei dunklem System ohne
     Wahl: Der erste Klick setzte `dark` – also das, was ohnehin galt – und der
     Umschalter tat sichtbar nichts.

     DER ZUSTAND STEHT AM KNOPF (`aria-pressed` = dunkel gilt), nicht nur in der
     Farbe der Seite. Er folgt auch einem Wechsel der Systemeinstellung, solange
     keine Wahl gespeichert ist.

     Die gespeicherte Wahl setzt bereits ein Inline-Skript im <head>
     (skriptorium/layouts/_partials/skriptorium/head.html), bevor die Seite gemalt wird. Hier wird
     sie trotzdem noch einmal gelesen: für Seiten ohne dieses Include, etwa die
     eigenständigen Vorlagen. */
  /* Der Weg, den Schalter UND Client-API nehmen: `choose("dark" | "light" | null)`,
     null heisst Systemeinstellung. Gesetzt von `initThemeToggle`. */
  var ColorScheme = { choose: null };

  function initThemeToggle() {
    var root = document.documentElement;
    var system = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    function current() {
      var chosen = root.getAttribute("data-skr-theme");
      if (chosen === "dark" || chosen === "light") return chosen;
      return system && system.matches ? "dark" : "light";
    }
    var buttons = document.querySelectorAll("[data-skr-theme-toggle]");
    function sync() {
      var dark = current() === "dark" ? "true" : "false";
      buttons.forEach(function (btn) { btn.setAttribute("aria-pressed", dark); });
    }
    try {
      var saved = localStorage.getItem("skr-theme");
      if (saved) root.setAttribute("data-skr-theme", saved);
    } catch (e) { /* egal */ }
    function choose(choice) {
      if (choice) root.setAttribute("data-skr-theme", choice);
      else root.removeAttribute("data-skr-theme");
      try {
        if (choice) localStorage.setItem("skr-theme", choice);
        else localStorage.removeItem("skr-theme");
      } catch (e) { /* egal */ }
      sync();
    }
    ColorScheme.choose = choose;
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        choose(current() === "dark" ? "light" : "dark");
      });
    });
    if (system && system.addEventListener) system.addEventListener("change", sync);
    sync();
  }

  /* --- Beschriftungen, die erst im Browser entstehen -----------------------
     Die meisten Texte setzen die Vorlagen beim Bauen (Wörterbücher unter
     `texts/`). Diese hier nicht: Sie gehören zu
     Elementen, die dieses Skript SELBST erzeugt – die Kopieren-Knöpfe an
     Codeblöcken, den Schließen-Knopf eines Reveals und den Burger des
     Reiterstreifens.

     GELESEN WIRD `<html lang>`. Das Attribut setzt jedes Theme-Layout aus der
     Sprache der Seite; damit gilt hier dieselbe Sprache wie im übrigen Markup.

     Unbekannte Sprache fällt auf Deutsch zurück, wie im Wörterbuch des Layouts. */
  var TEXTS = {
    de: { copy: "Kopieren", copied: "Kopiert!", close: "Schließen",
          step: "Arbeitsschritt",
          moreTabs: "Weitere Reiter", cancel: "Abbrechen" },
    en: { copy: "Copy",     copied: "Copied!",  close: "Close",
          step: "Step",
          moreTabs: "More tabs", cancel: "Cancel" }
  };
  var T = TEXTS[(document.documentElement.getAttribute("lang") || "de").split("-")[0].toLowerCase()] || TEXTS.de;

  /* --- Kopieren-Buttons an Code-Blöcken ----------------------------------- */
  function initCopyButtons(root) {
    (root && root.querySelectorAll ? root : document).querySelectorAll("pre > code").forEach(function (code) {
      var pre = code.parentElement;
      if (pre.querySelector(".skr-copy")) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skr-btn skr-btn--primary skr-copy";
      btn.title = T.copy;
      btn.setAttribute("aria-label", T.copy);
      /* Die Lage setzt components.css (`--skr-copy-top`, `--skr-copy-right`). */
      /* Die Sprache des Blocks fuer eine Kopfleiste per CSS (`attr()`), etwa in einem
         Theme. */
      var language = /(?:^|\s)language-([\w+#-]+)/.exec(code.className);
      if (language && language[1] !== "plaintext") pre.setAttribute("data-skr-lang", language[1]);
      pre.appendChild(btn);
    });
  }

  /* Auch Codeblöcke, die ein Baustein erst im Browser einhängt (Ereignis
     `skr-content-added`), bekommen ihren Knopf. */
  document.addEventListener("skr-content-added", function (e) { initCopyButtons(e.target); });

  /* DER KLICK WIRD AM DOKUMENT ENTGEGENGENOMMEN, nicht am Knopf. Ein Baustein, der
     einen Codeblock erst im Browser einhaengt – etwa als Klon –, bringt den Knopf
     mit, aber keinen Listener: Ein Klon erbt ihn nicht. Kopiert wird der Code des Blocks, in dem der Knopf steht. */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".skr-copy");
    var code = btn && btn.parentElement && btn.parentElement.querySelector(":scope > code");
    if (!code) return;
    copyText(code.innerText).then(function () {
      btn.classList.add("is-copied");
      btn.title = T.copied;
      setTimeout(function () {
        btn.classList.remove("is-copied");
        btn.title = T.copy;
      }, 1500);
    }).catch(function () { /* beide Wege versperrt - siehe copyText */ });
  });

  /* --- Mobile Navigation --------------------------------------------------
     Der Burger klappt das per CSS (max-width) eingeklappte Nav auf/zu. Auf
     breiten Viewports ist der Burger ausgeblendet und das Nav ohnehin sichtbar;
     das Attribut [data-open] ist dort wirkungslos. */
  function closeAllNavs() {
    document.querySelectorAll("[data-skr-nav-toggle]").forEach(function (btn) {
      var t = document.querySelector(btn.getAttribute("data-skr-nav-toggle"));
      if (t) t.removeAttribute("data-open");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function initNavToggle() {
    var toggles = document.querySelectorAll("[data-skr-nav-toggle]");
    if (!toggles.length) return;

    toggles.forEach(function (btn) {
      var target = document.querySelector(btn.getAttribute("data-skr-nav-toggle"));
      if (!target) return;
      btn.setAttribute("aria-expanded", "false");
      if (target.id) btn.setAttribute("aria-controls", target.id);

      btn.addEventListener("click", function () {
        var open = target.toggleAttribute("data-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });

      /* Klick auf einen Link schließt das Menü (Zielseite wird geladen). */
      target.addEventListener("click", function (e) {
        if (e.target.closest("a")) closeAllNavs();
      });
    });

    /* Escape schließt; Klick außerhalb des Headers schließt. */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllNavs();
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".skr-header")) closeAllNavs();
    });
  }

  /* --- Auswahldialog (#394) ------------------------------------------------
     EINE FRAGE, MEHRERE ANTWORTEN – modal, wie das QR-Popup: Titel, Text, Knöpfe.
     Für Bausteine, die vor einem folgenreichen Schritt nachfragen („Wirklich neu
     beginnen?“). Escape, „Abbrechen“ und ein Klick daneben brechen ab; der Fokus
     steht zuerst auf „Abbrechen“ – der harmlose Ausgang – und kehrt danach zurück.

       skr.dialog.choose({ title, text, choices: [{ label, value, primary }],
                                 cancel }) → Promise mit `value` oder `null`

     Gestaltet in site.css (`skr-dialog`); keine Autorenkomponente. */
  var dialogCounter = 0;
  var Dialog = {
    choose: function (o) {
      o = o || {};
      return new Promise(function (finished) {
        var id = "skr-dialog-" + (++dialogCounter);
        var d = document.createElement("dialog");
        d.className = "skr-dialog";
        d.setAttribute("aria-labelledby", id + "-titel");
        var h = document.createElement("h2");
        h.className = "skr-dialog__title";
        h.id = id + "-titel";
        h.textContent = o.title || "";
        d.appendChild(h);
        if (o.text) {
          var p = document.createElement("p");
          p.className = "skr-dialog__text";
          p.id = id + "-text";
          p.textContent = o.text;
          d.setAttribute("aria-describedby", p.id);
          d.appendChild(p);
        }
        var bar = document.createElement("div");
        bar.className = "skr-dialog__actions";
        var trigger = document.activeElement, done = false;
        function close(value) {
          if (done) return;
          done = true;
          if (d.open) d.close();
          d.remove();
          if (trigger && trigger.focus && document.contains(trigger)) trigger.focus();
          finished(value);
        }
        function button(text, cls, value) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "skr-btn " + cls;
          b.textContent = text;
          b.addEventListener("click", function () { close(value); });
          bar.appendChild(b);
          return b;
        }
        var cancel = button(o.cancel || T.cancel, "skr-btn--ghost", null);
        (o.choices || []).forEach(function (c) {
          button(c.label, c.primary ? "skr-btn--primary" : "skr-btn--ghost", c.value);
        });
        d.appendChild(bar);
        d.addEventListener("cancel", function (e) { e.preventDefault(); close(null); });
        d.addEventListener("click", function (e) {
          if (e.target !== d) return;
          var r = d.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(null);
        });
        document.body.appendChild(d);
        d.showModal();
        cancel.focus();
      });
    }
  };
  toSkr("dialog", Dialog);

  /* --- "Markdown kopieren" ---------------------------------------------------
     Kopiert den rohen Markdown-Inhalt aus dem versteckten <textarea>, auf das
     der Button per [data-skr-copy-md="#id"] zeigt. */
  function initCopyMarkdown() {
    document.querySelectorAll("[data-skr-copy-md]").forEach(function (btn) {
      var src = document.querySelector(btn.getAttribute("data-skr-copy-md"));
      if (!src) return;
      btn.addEventListener("click", function () {
        var text = (src.value != null) ? src.value : src.textContent;
        copyText(text).then(function () {
          var oldTitle = btn.title || btn.getAttribute("aria-label");
          btn.classList.add("is-copied");
          btn.title = T.copied;
          setTimeout(function () {
            btn.classList.remove("is-copied");
            btn.title = oldTitle;
          }, 1500);
        }).catch(function () { /* beide Wege versperrt - siehe copyText */ });
      });
    });
  }

  /* --- Übung: Inhaltsverzeichnis automatisch aus Überschriften ------------- */
  function initGuideToc() {
    var toc = document.querySelector("[data-skr-toc]");
    var main = document.querySelector(".skr-guide-main");
    // Karte, die das Inhaltsverzeichnis trägt.
    var tocCard = toc && toc.closest(".skr-guide-side, [data-skr-toc-box]");

    if (toc && main) {
      // Nur Überschriften auf oberster Ebene (nicht in Karten/Zitaten verschachtelte) –
      // dazu die der Definition of Done, deren Block zur Gliederung gehört (sidebar.mjs).
      var heads = main.querySelectorAll(":scope > h2, :scope > h3, :scope > .skr-guide-done > h2, :scope > .skr-guide-done > h3, :scope > [data-skr-slot] > h2, :scope > [data-skr-slot] > h3");
      /* GEBAUT: Der Bau legt das Verzeichnis schon ins HTML (adapter/sidebar.mjs), samt
         Anfangszustand – dann bleibt hier nur, was erst der Browser weiß: schmal zuklappen
         und den Abschnitt markieren, der gerade zu sehen ist. */
      var built = !!toc.querySelector("a");
      if (built && heads.length >= 2) {
        if (tocCard && window.matchMedia && window.matchMedia("(max-width: 960px)").matches) tocCard.open = false;
      } else if (heads.length >= 2) {
        // Inhaltsverzeichnis erst ab mindestens ZWEI Überschriften anzeigen.
        heads.forEach(function (h) {
          if (!h.id) {
            h.id = (h.textContent || "").toLowerCase().trim()
              .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
          }
          var a = document.createElement("a");
          a.href = "#" + h.id;
          a.textContent = h.textContent;
          if (h.tagName === "H3") a.className = "skr-toc--h3";
          toc.appendChild(a);
        });
        if (tocCard) {
          tocCard.hidden = false;
          /* ZUGEKLAPPT STARTEN, wenn das Verzeichnis lang ist – aber nur, wenn darunter
             ueberhaupt noch eine Karte sichtbar ist (weiterfuehrende Links). Ist das
             Verzeichnis das letzte Element der Sidebar, verdeckt es nichts; dann es
             zuzuklappen wuerde dem Leser nur einen Klick abverlangen, ohne dass er
             etwas gewinnt. Karten, die Extensions spaeter anlegen
             (`ctx.sidebarCard`), zaehlen hier nicht mit.
             Hat die Seite den Zustand selbst gesetzt, gilt sie und beides bleibt aussen vor. */
          /* SCHMAL IMMER ZUGEKLAPPT - und zwar vor allem anderen. Das Verzeichnis
             steht dort ueber dem Text; offen schoebe es den Anfang der Seite unter
             den Bildschirmrand. Die Angaben aus `_config.yml` und Front Matter
             beschreiben eine SEITENSPALTE; auf einem Telefon gibt es keine. */
          var narrow = window.matchMedia && window.matchMedia("(max-width: 960px)").matches;
          var preset = tocCard.getAttribute("data-skr-toc-open");
          if (narrow) {
            tocCard.open = false;
          } else if (preset !== null) {
            tocCard.open = preset !== "false";
          } else {
            var below = false;
            for (var g = tocCard.nextElementSibling; g; g = g.nextElementSibling) {
              if (!g.hidden && g.tagName !== "TEMPLATE") { below = true; break; }
            }
            var limit = parseInt(tocCard.getAttribute("data-skr-toc-limit"), 10);
            if (below && !isNaN(limit) && limit > 0 && heads.length > limit) tocCard.open = false;
          }
        }
      } else if (tocCard) {
        tocCard.hidden = true;
      }
      if (heads.length >= 2 && "IntersectionObserver" in window) {
        var links = toc.querySelectorAll("a");
        var byId = {};
        links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            var a = byId[en.target.id];
            if (a && en.isIntersecting) {
              links.forEach(function (x) { x.removeAttribute("aria-current"); });
              a.setAttribute("aria-current", "true");
            }
          });
        }, { rootMargin: "0px 0px -75% 0px" });
        heads.forEach(function (h) { observer.observe(h); });
      }
    }
  }

  /* --- Aufgabenlisten: anklickbar und benannt ----------------------------- */
  /* ZWEI DINGE, WEIL SIE DIESELBE URSACHE HABEN. Kramdown gibt ein
     `- [ ] …` als `<input type="checkbox" disabled>` aus: Eine Checkliste, die man
     nicht abhaken kann, ist ein Bild von einer Checkliste. Und ohne Namen sagt eine
     Vorlesehilfe fuenfzehnmal „Kontrollkaestchen“ und sonst nichts. Den Namen setzt
     schon der Bau (`content.html`, auch ohne Skript und in ausgenommenen Bloecken);
     hier bleibt der Rueckfall fuer Kaestchen, die ohne ihn ankommen.

     Der Zustand wird NICHT gespeichert. Ein Haken gilt fuer diesen Durchgang -
     eine Liste, die beim naechsten Kurs noch die Haken des letzten traegt, waere
     schlimmer als eine leere.

     AUSGENOMMEN ist, was in einem Block mit `data-skr-tasklist="off"` steht: Dort
     gehoeren die Kaestchen dem Baustein, der den Block baut – das Skript schaltet sie
     nicht ein. */
  function task(c) { return !c.closest('[data-skr-tasklist="off"]'); }

  function initTaskLists() {
    Array.prototype.filter.call(document.querySelectorAll('li > input[type="checkbox"]'), task).forEach(function (c, i) {
      c.disabled = false;
      if (c.getAttribute("aria-label") || (c.labels && c.labels.length)) return;
      var li = c.closest("li");
      var name = li ? li.textContent.replace(/\s+/g, " ").trim() : "";
      c.setAttribute("aria-label", name || (T.step + " " + (i + 1)));
    });
  }

  /* --- Header-Untermenü (Dropdown / im Burger aufklappbar) ----------------- */
  function closeAllMenus(except) {
    document.querySelectorAll(".skr-header__submenu[data-open]").forEach(function (s) {
      if (s === except) return;
      /* EIN ELTERNMENUE BLEIBT OFFEN. Seit es drei Ebenen gibt, liegt das Menue
         der dritten IN dem der zweiten - wer beim Oeffnen stumpf alles schließt,
         zieht sich den Boden unter dem eigenen Menue weg. */
      if (except && s.contains(except)) return;
      s.removeAttribute("data-open");
      var t = s.parentNode.querySelector(".skr-header__grouptoggle");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }
  function initNavDropdown() {
    var groups = document.querySelectorAll("[data-skr-menu]");
    if (!groups.length) return;
    groups.forEach(function (group) {
      /* :scope - sonst griffe eine Gruppe der ersten Ebene nach dem Schalter
         einer verschachtelten und schoebe beide Ebenen mit einem Klick auf. */
      var toggle = group.querySelector(":scope > .skr-header__grouptoggle");
      var submenu = group.querySelector(":scope > .skr-header__submenu");
      if (!toggle || !submenu) return;
      toggle.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = submenu.hasAttribute("data-open");
        closeAllMenus(submenu);
        if (open) {
          submenu.removeAttribute("data-open");
          toggle.setAttribute("aria-expanded", "false");
        } else {
          submenu.setAttribute("data-open", "");
          toggle.setAttribute("aria-expanded", "true");
        }
      });

      /* DER FOKUS OEFFNET DAS MENUE EBENFALLS - das macht das Stylesheet ueber
         `:focus-within`, damit man sich mit der Tabulatortaste hineinbewegen
         kann, ohne vorher zu klicken. Dann muss `aria-expanded` mitziehen:
         Sonst sagt eine Vorlesehilfe „zugeklappt“ ueber ein Menue, in dem der
         Fokus gerade steht. Nur wenn nicht ohnehin geklickt wurde - `data-open`
         hat Vorrang, sonst schloesse das Verlassen ein geklicktes Menue. */
      group.addEventListener("focusin", function () {
        if (!submenu.hasAttribute("data-open")) toggle.setAttribute("aria-expanded", "true");
      });
      group.addEventListener("focusout", function (e) {
        if (submenu.hasAttribute("data-open")) return;
        if (e.relatedTarget && group.contains(e.relatedTarget)) return;
        toggle.setAttribute("aria-expanded", "false");
      });
    });
    /* KLICK DANEBEN SCHLIESST - aber nur, was wirklich daneben liegt. Ein Klick
       im Menue der dritten Ebene liegt INNERHALB der Gruppe der ersten; wer hier
       pauschal alles schließt, macht das Untermenue unbedienbar. */
    document.addEventListener("click", function (e) {
      var inside = e.target.closest && e.target.closest("[data-skr-menu]");
      if (!inside) { closeAllMenus(); return; }
      document.querySelectorAll(".skr-header__submenu[data-open]").forEach(function (s) {
        if (s.contains(e.target)) return;
        s.removeAttribute("data-open");
        var t = s.parentNode.querySelector(".skr-header__grouptoggle");
        if (t) t.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllMenus();
    });
  }

  /* --- Bleibt der rechte Bereich leer? ------------------------------------ *
     Ein Layout ohne Seitenleiste schaltet ihn AUS (`sidebar: false`, im Markup).
     Eine gewoehnliche Seite kann ihn nur ZUFAELLIG leer lassen - wenn die Seite zu
     wenige Ueberschriften fuer ein Verzeichnis hat, keine Karte zeigt und keine
     weiterfuehrenden Links. Dann reserviert das Raster 300px fuer nichts, und die
     Seite haengt links statt mittig zu stehen.

     ERST JETZT ENTSCHEIDBAR: Das Inhaltsverzeichnis entsteht im Browser, Karten
     von Extensions ebenso. Deshalb laeuft diese Pruefung NACH dem Verzeichnis
     und erneut, wenn sich die Karten aendern.

     Gepruefte Bedingung ist die SICHTBARKEIT, nicht die Existenz: Die Karten
     stehen als `[hidden]` im Markup und bleiben es, wenn sie nichts zu zeigen
     haben. */
  function initSidebarEmpty() {
    var sidebar = document.querySelector(".skr-guide-sidebar");
    if (!sidebar) return;
    var anyContent = Array.prototype.some.call(sidebar.children, function (card) {
      if (card.hidden) return false;
      return card.offsetParent !== null || card.getClientRects().length > 0;
    });
    document.body.classList.toggle("skr-guide--sidebar-empty", !anyContent);
  }

  /* --- TopNav: Umbruch messen, Seite des Flyouts waehlen ------------------ *
     ZWEI DINGE, die CSS nicht kann.

     ERSTENS: Passt die Leiste in eine Zeile? Das allein entscheidet ueber den
     Burger; lange Beschriftungen und schmale Fenster kennt nur der Browser. Gemessen wird die NATUERLICHE Breite - also die, die
     die Leiste haette, wenn sie nicht umbrechen duerfte. Das geht nur, wenn man
     den Umbruch kurz abschaltet und wieder herstellt; sonst misst man den bereits
     umgebrochenen Zustand und bekaeme nie ein "passt nicht".

     Die Falle dabei: Sobald `--compact` gesetzt ist, liegt die Leiste als Klappfeld
     und waere immer "schmal genug" - das Ergebnis schwankte bei jeder Messung.
     Deshalb wird fuer die Messung auch `--compact` kurz abgenommen.

     ZWEITENS: Faehrt das Menue der dritten Ebene nach rechts oder nach links aus?
     Das entscheidet der Platz bis zum Fensterrand, und den kennt erst der Browser. */
  /* --- Rollen der Navigation (`nav.roles`) -----------------------------------
     Die Rolle steht an <html data-skr-role> (gesetzt im Kopf, vor dem ersten
     Malen); das CSS dort blendet die Einträge der übrigen Rollen aus. Der
     Umschalter setzt sie neu, merkt sie sich je Site und misst die Leiste neu. */
  function initRoles() {
    var group = document.querySelector("[data-skr-roles]");
    if (!group) return;
    var buttons = group.querySelectorAll("[data-skr-role-choice]");
    /* Je Site gemerkt – unter dem Pfad ihrer Wurzel: Mehrere Unterlagen unter einer
       Domain wählen getrennt. Derselbe Schlüssel wie im Kopf der Seite (head.html). */
    var key = "skr-role:" + new URL(window.skr._root()).pathname;
    function show(role) {
      buttons.forEach(function (k) {
        k.setAttribute("aria-checked", k.getAttribute("data-skr-role-choice") === role ? "true" : "false");
      });
    }
    show(document.documentElement.getAttribute("data-skr-role"));
    buttons.forEach(function (k, i) {
      k.addEventListener("click", function () {
        var role = k.getAttribute("data-skr-role-choice");
        document.documentElement.setAttribute("data-skr-role", role);
        try { localStorage.setItem(key, role); } catch (e) { /* ohne Speicher */ }
        show(role);
        window.dispatchEvent(new Event("resize"));
      });
      /* Pfeiltasten wie in jeder Gruppe von Optionsfeldern. */
      k.addEventListener("keydown", function (e) {
        var next = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!next) return;
        e.preventDefault();
        var target = buttons[(i + next + buttons.length) % buttons.length];
        target.focus(); target.click();
      });
    });
  }

  function initNavLayout() {
    var header = document.querySelector("[data-skr-header]");
    if (!header) return;
    var nav = header.querySelector(".skr-header__nav");
    if (!nav) return;

    /* PASST DIE LEISTE IN EINE ZEILE?
       Nicht ausgerechnet, sondern abgelesen: Liegt der letzte Eintrag tiefer als
       der erste, hat die Leiste umgebrochen. Das ist genau die Frage, und es ist
       die einzige Rechnung, die nicht daneben liegen kann - eine Schaetzung aus
       Header-Breite minus Wortmarke minus Werkzeuge vergisst Innenabstaende und
       Abstaende und sagte bei 950 px noch "passt", waehrend die Leiste bereits
       dreizeilig war (gemessen).

       Gemessen wird OHNE `--compact`: Mit der Klasse liegt die Leiste als Spalte,
       und jede Zeile stuende tiefer als die vorige - das Ergebnis waere immer
       "umgebrochen" und der Zustand schwankte. Zwischen Abnehmen und Wiederanlegen
       liegt kein `await` und kein Ereignis, der Browser malt also nichts davon. */
    function fitsInOneLine() {
      var previousCompact = header.classList.contains("skr-header--compact");
      header.classList.remove("skr-header--compact");
      /* Nur, was sichtbar ist: Mit Rollen liegen die Einträge der anderen Rollen
         ausgeblendet in der Leiste und haben keine Lage. */
      var children = Array.prototype.filter.call(nav.children, function (k) { return k.offsetParent !== null; });
      var wrap = false;
      if (children.length > 1) {
        var top = children[0].offsetTop;
        for (var i = 1; i < children.length; i++) {
          if (children[i].offsetTop > top + 2) { wrap = true; break; }
        }
      }
      if (previousCompact) header.classList.add("skr-header--compact");
      return !wrap;
    }

    function remeasure() {
      /* Unter der Media-Query-Schwelle misst niemand: Dort gilt ohnehin der
         Burger, und die Leiste ist ausgeblendet - jede Messung waere Unsinn. */
      if (window.matchMedia && window.matchMedia("(max-width: 600px)").matches) {
        header.classList.remove("skr-header--compact");
        return;
      }
      header.classList.toggle("skr-header--compact", !fitsInOneLine());
      /* DAS KLAPPFELD GEHOERT UNTER DEN KNOPF. Wo der steht, weiß nur das
         Layout - CSS kann die Stelle nicht ausrechnen. Deshalb kommt sie als
         Custom Property herein; das Stylesheet setzt sie ein. */
      var burger = header.querySelector(".skr-header__burger");
      if (burger) header.style.setProperty("--skr-nav-left", burger.offsetLeft + "px");
    }

    remeasure();

    /* NOCH EINMAL, WENN DIE SCHRIFT DA IST. Beim ersten Messen steht oft noch die
       Ersatzschrift; die Beschriftungen sind dann schmaler, die Leiste passt
       scheinbar in eine Zeile, und gleich darauf laedt Outfit nach und sie bricht
       um - ohne dass ein `resize` faellt. Gemessen: Bei 940 px blieb die Leiste
       dreizeilig und der Burger aus. */
    if (document.fonts && document.fonts.ready) {
      /* EIN BILD SPAETER. `fonts.ready` sagt "geladen", nicht "neu umbrochen" -
         der Reflow mit der echten Schrift kommt erst danach. Direkt gemessen
         blieb die Leiste bei 940 px dreizeilig und der Burger aus (gemessen). */
      document.fonts.ready.then(function () { window.requestAnimationFrame(remeasure); });
    }

    var waiting = false;
    window.addEventListener("resize", function () {
      if (waiting) return;
      waiting = true;
      window.requestAnimationFrame(function () { waiting = false; remeasure(); });
    });

    /* Seite des seitlichen Menues. Beim Oeffnen und beim Ueberfahren pruefen, ob
       rechts noch Platz ist; sonst nach links. */
    /* WELCHE SEITE. Nicht "rechts, ausser es passt nicht" - sondern die Seite mit
       mehr Platz, falls rechts nicht reicht. Der Unterschied zeigt sich erst im
       Grenzfall: Ein Menue, das rechts um zehn Pixel ueberlaeuft, lief nach dem
       blossen Umkippen links um zweihundert ueber (gemessen). */
    /* UND WENN ES AUF KEINER SEITE PASST, bricht es um. Lange Titel (etwa die der
       Architekturentscheidungen) machen ein Menue gut 700 px breit; bei 1000 px Fenster
       ragte es dann auf der Seite mit mehr Platz trotzdem heraus (gemessen: 250 px links).
       Dann bekommt es genau die Breite der groesseren Seite, und die Eintraege umbrechen. */
    function chooseSide(menu, group) {
      reset(menu);
      var needed = menu.offsetWidth;
      var g = group.getBoundingClientRect();
      var spaceRight = window.innerWidth - g.right - 8;
      var spaceLeft = g.left - 8;
      var links = needed > spaceRight && spaceLeft > spaceRight;
      if (links) menu.classList.add("skr-header__submenu--flip");
      var space = links ? spaceLeft : spaceRight;
      if (needed > space && space > 0) {
        menu.style.width = space + "px";
        menu.style.setProperty("--skr-submenu-wrap", "normal");
      }
      pin(menu, group, links);
      clamp(menu);
      chooseHeight(menu);
    }
    /* UND NACH UNTEN. Ein langes Menue (Kapitel 5 der Architekturdoku) ragte bei 900 px
       Fensterhoehe unten heraus; die letzten Eintraege waren nicht zu erreichen. Erst
       rueckt es nach oben, soweit Platz ist; reicht das nicht, laeuft es wie ein Menue
       mit zu vielen Zeilen – mit Dreiecken, ohne Scrollbalken (`begrenzen`). */
    function chooseHeight(menu) {
      var bottom = window.innerHeight - 8;
      var r = menu.getBoundingClientRect();
      if (r.bottom <= bottom) return;
      var tall = Math.min(r.bottom - bottom, r.top - 8);
      if (tall > 0) {
        menu.style.marginTop = (parseFloat(getComputedStyle(menu).marginTop) - tall) + "px";
        r = menu.getBoundingClientRect();
      }
      if (r.bottom > bottom) clamp(menu, bottom - r.top);
    }

    /* --- Kurze Menues ---------------------------------------------------------
       Ein Aufklappmenue zeigt hoechstens `nav.menu.rows` Zeilen
       (von der Kopfzeile als `data-skr-menu-visible`). Jedes Ziel ist eine Zeile,
       die Ueberschrift eines eingebetteten Menues ebenso; Trennstriche zaehlen nicht.
       Hat es mehr – oder passt es nicht ins Fenster –, wird es auf genau diese Hoehe
       begrenzt, GEMESSEN an der ersten Zeile, die nicht mehr hineingehoert, und bekommt
       oben und unten ein Dreieck. Zeigen auf ein Dreieck laesst es laufen; am Rand ist
       das Dreieck deaktiviert. Kein Scrollbalken: Die Dreiecke sagen, dass mehr da ist,
       und wo.

       EINE STELLE FUER BEIDE GRENZEN: die Zahl der Zeilen und das Fenster
       (`chooseHeight`) – `begrenzen` nimmt die kleinere. */
    var BASE_SPEED = 156; /* px/s bei `speed: 1.0` – eine Zeile (gut 40 px) in rund 0,26 s */
    var ROWS = ":scope > a, :scope > .skr-header__group > .skr-header__grouptoggle," +
                 " :scope > .skr-header__set > .skr-header__setlabel, :scope > .skr-header__set > a";

    function desktop() {
      if (header.classList.contains("skr-header--compact")) return false;
      return !(window.matchMedia && window.matchMedia("(max-width: 600px)").matches);
    }
    /* Der Wert gilt, wie ihn die Konfiguration nennt: Das Schema verlangt ab 1, der Bau
       bricht sonst ab – das Skript setzt keine eigene Untergrenze. */
    function visibleRows() {
      return parseInt(header.getAttribute("data-skr-menu-visible"), 10);
    }
    function pace() {
      var t = parseFloat(header.getAttribute("data-skr-menu-speed"));
      return t > 0 ? t : 1;
    }
    function rowsOf(menu) { return menu.querySelectorAll(ROWS); }

    function arrow(menu, direction) {
      return menu.querySelector(":scope > .skr-header__scroll--" + direction);
    }

    /* Was die vorige Messung gesetzt hat, faellt weg – Seite, Breite, Hoehe, Anheften. */
    function reset(menu) {
      menu.classList.remove("skr-header__submenu--flip");
      ["width", "--skr-submenu-wrap", "margin-top", "margin-left", "margin-right",
       "position", "top", "left", "right"].forEach(function (p) { menu.style.removeProperty(p); });
      runEnd(menu);
    }

    /* Kein Lauf mehr: Klasse, Hoehe und Dreiecke weg. */
    function runEnd(menu) {
      halt(menu);
      menu.classList.remove("skr-header__submenu--scroll");
      menu.style.removeProperty("max-height");
      ["up", "down"].forEach(function (r) { var p = arrow(menu, r); if (p) p.remove(); });
      var group = menu.parentNode;
      if (group && group.classList) group.classList.remove("skr-header__group--scrollt");
    }

    function clamp(menu, viewport) {
      runEnd(menu);
      if (!desktop()) return;
      var lines = rowsOf(menu);
      var n = visibleRows();
      var upperBound = typeof viewport === "number" ? viewport : Infinity;
      if (lines.length <= n && menu.offsetHeight <= upperBound) return;

      var opened = document.createElement("span");
      var fromRoot = document.createElement("span");
      [[opened, "up"], [fromRoot, "down"]].forEach(function (x) {
        x[0].className = "skr-header__scroll skr-header__scroll--" + x[1];
        x[0].setAttribute("aria-hidden", "true");
        x[0].appendChild(glyph("caret-" + x[1]));
      });
      menu.classList.add("skr-header__submenu--scroll");
      menu.insertBefore(opened, menu.firstChild);
      menu.appendChild(fromRoot);
      /* Die Hover-Bruecke des Menues schneidet `overflow` ab; der Schalter uebernimmt. */
      if (menu.parentNode && menu.parentNode.classList) menu.parentNode.classList.add("skr-header__group--scrollt");

      var height = Infinity;
      if (lines.length > n) {
        var top = menu.getBoundingClientRect().top;
        var border = parseFloat(getComputedStyle(menu).borderBottomWidth) || 0;
        height = lines[n].getBoundingClientRect().top - top + fromRoot.offsetHeight + border;
      }
      height = Math.min(height, upperBound);
      menu.style.maxHeight = Math.max(height, 0) + "px";
      menu.scrollTop = 0;
      if (menu.scrollHeight <= menu.clientHeight + 1) { runEnd(menu); return; }
      placeArrows(menu);

      [opened, fromRoot].forEach(function (p) {
        var direction = p === opened ? -1 : 1;
        p.addEventListener("mouseenter", function () { running(menu, direction); });
        p.addEventListener("mouseleave", function () { halt(menu); });
      });
    }

    function placeArrows(menu) {
      var opened = arrow(menu, "up"), fromRoot = arrow(menu, "down");
      if (!opened || !fromRoot) return;
      var max = menu.scrollHeight - menu.clientHeight;
      opened.setAttribute("aria-disabled", menu.scrollTop <= 0.5 ? "true" : "false");
      fromRoot.setAttribute("aria-disabled", menu.scrollTop >= max - 0.5 ? "true" : "false");
    }

    /* LAUFEN, solange der Zeiger auf dem Dreieck liegt. Ohne Bewegung
       (`prefers-reduced-motion`) springt es stattdessen zeilenweise im selben Takt. */
    function running(menu, direction) {
      halt(menu);
      var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var lines = rowsOf(menu);
      var line = lines.length > 1 ? lines[1].getBoundingClientRect().top - lines[0].getBoundingClientRect().top : 40;
      if (reducedMotion) {
        var step = function () { menu.scrollTop += direction * line; placeArrows(menu); };
        step();
        menu._avdRun = { beat: window.setInterval(step, (line / BASE_SPEED) * 1000 / pace()) };
        return;
      }
      var run = { pos: menu.scrollTop, last: null };
      menu._avdRun = run;
      var frame = function (now) {
        if (menu._avdRun !== run) return;
        if (run.last !== null) {
          run.pos += direction * BASE_SPEED * pace() * (now - run.last) / 1000;
          var max = menu.scrollHeight - menu.clientHeight;
          run.pos = Math.max(0, Math.min(max, run.pos));
          menu.scrollTop = run.pos;
          placeArrows(menu);
          if (run.pos <= 0 || run.pos >= max) { halt(menu); return; }
        }
        run.last = now;
        run.frame = window.requestAnimationFrame(frame);
      };
      run.frame = window.requestAnimationFrame(frame);
    }
    function halt(menu) {
      var run = menu._avdRun;
      if (!run) return;
      if (run.frame) window.cancelAnimationFrame(run.frame);
      if (run.beat) window.clearInterval(run.beat);
      menu._avdRun = null;
    }

    /* SEITLICHE MENUES EINES SCROLLENDEN MENUES. Ein Menue mit `overflow` schneidet alles
       ab, dessen Bezugsrahmen in ihm liegt – auch das seitliche Menue der dritten Ebene,
       das neben ihm stehen soll. Deshalb haengt es dann am Fenster (`position: fixed`)
       und wird an seiner Gruppe ausgerichtet; laeuft das Menue, laeuft es mit. Ein
       offenes Menue der zweiten Ebene hat keinen `transform` (siehe die Einblendung) –
       sonst waere es selbst der Bezugsrahmen und schnitte wieder ab. */
    function pin(menu, group, links) {
      var parent = group.parentNode;
      if (!parent || !parent.classList.contains("skr-header__submenu--scroll")) return;
      var g = group.getBoundingClientRect();
      menu.style.position = "fixed";
      menu.style.top = g.top + "px";
      if (links) {
        menu.style.left = "auto";
        menu.style.right = (window.innerWidth - g.left) + "px";
      } else {
        menu.style.left = g.right + "px";
        menu.style.right = "auto";
      }
    }
    function followSides(menu) {
      menu.querySelectorAll(":scope > .skr-header__group--sub").forEach(function (g) {
        var page = g.querySelector(":scope > .skr-header__submenu--side");
        if (page && getComputedStyle(page).display !== "none") chooseSide(page, g);
      });
    }

    /* Menue der zweiten Ebene: beim Oeffnen messen. */
    function measureLevelTwo(menu) {
      runEnd(menu);
      menu.style.removeProperty("margin-left");
      if (!desktop()) return;
      if (getComputedStyle(menu).display === "none") return;
      /* NICHT UEBER DEN RECHTEN RAND. Das Menue steht buendig unter seiner Gruppe; die
         Gruppe ganz rechts in der Leiste schob es bei 960 px rund 12 px aus dem Fenster
         (gemessen). Dann rueckt es nach links, hoechstens bis an den linken Rand. */
      var r = menu.getBoundingClientRect();
      var over = r.right - (window.innerWidth - 8);
      if (over > 0) menu.style.marginLeft = -Math.min(over, Math.max(r.left - 8, 0)) + "px";
      clamp(menu, window.innerHeight - 8 - menu.getBoundingClientRect().top);
    }

    /* EIN FOKUSSIERTER EINTRAG STEHT IMMER ZWISCHEN DEN DREIECKEN – ob er per Tab oder
       per Pfeiltaste dorthin kam. Gerechnet statt `scrollIntoView`: Das kennt die
       klebenden Dreiecke nicht und schoebe den Eintrag darunter. */
    function intoView(el) {
      var menu = el.closest && el.closest(".skr-header__submenu--scroll");
      if (!menu) return;
      var opened = arrow(menu, "up"), fromRoot = arrow(menu, "down");
      if (!opened || !fromRoot) return;
      var a = el.getBoundingClientRect();
      var top = opened.getBoundingClientRect().bottom, bottom = fromRoot.getBoundingClientRect().top;
      if (a.top < top) menu.scrollTop -= top - a.top;
      else if (a.bottom > bottom) menu.scrollTop += a.bottom - bottom;
      placeArrows(menu);
    }

    header.querySelectorAll(".skr-header__submenu").forEach(function (menu) {
      menu.addEventListener("scroll", function () {
        placeArrows(menu);
        followSides(menu);
      }, { passive: true });
    });
    /* EIN ZEIGER, DER IN EIN OFFENES MENUE DRUECKT, BEWEGT ES NICHT. Der Druck fokussiert
       den Eintrag, und `focusin` mass das Menue neu und setzte es an den Anfang zurueck –
       zwischen Druecken und Loslassen. Der Klick traf danach etwas anderes, erst der
       zweite oeffnete die Seite (gemeldet in der Architekturdoku). Was unter dem Zeiger
       liegt, ist ohnehin zu sehen; Messen und Ins-Bild-Ruecken bleiben der Tastatur. */
    var pointerDown = false;
    header.addEventListener("pointerdown", function () {
      pointerDown = true;
      window.setTimeout(function () { pointerDown = false; }, 0);
    }, true);

    header.addEventListener("focusin", function (e) {
      if (!desktop()) return;
      if (pointerDown) return;
      var t = e.target;
      intoView(t);
      window.requestAnimationFrame(function () { if (document.activeElement === t) intoView(t); });
    });

    /* PFEILTASTEN. Tab bleibt, wie es ist; Pfeil runter/rauf wandern zusaetzlich durch
       die Eintraege eines offenen Menues – vom Schalter der ersten Ebene hinein, am Rand
       scrollt das Menue weiter. Nur am Schreibtisch. */
    function targets(menu) {
      return Array.prototype.filter.call(rowsOf(menu), function (z) {
        return z.tagName === "A" || z.tagName === "BUTTON";
      });
    }
    header.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (!desktop()) return;
      var active = document.activeElement;
      if (!active || !header.contains(active)) return;
      var group = active.parentNode;
      if (active.classList.contains("skr-header__grouptoggle") && group.parentNode === nav) {
        if (e.key !== "ArrowDown") return;
        var own = group.querySelector(":scope > .skr-header__submenu");
        var first = own && targets(own)[0];
        if (first) { e.preventDefault(); first.focus(); }
        return;
      }
      var menu = active.closest(".skr-header__submenu");
      if (!menu) return;
      var list = targets(menu);
      var i = list.indexOf(active);
      if (i < 0) return;
      e.preventDefault();
      var nextItem = list[i + (e.key === "ArrowDown" ? 1 : -1)];
      if (nextItem) nextItem.focus();
    });

    /* Ein anderes Format (Burger, schmales Fenster) kennt keine kurzen Menues. */
    window.addEventListener("resize", function () {
      if (desktop()) return;
      header.querySelectorAll(".skr-header__submenu").forEach(reset);
    });
    /* Und beim Betreten eines gewoehnlichen Eintrags derselben Ebene: Wer von
       „Referenz" auf „Ueberblick" faehrt, will das Untermenue nicht weiter sehen. */
    header.querySelectorAll(".skr-header__submenu > a").forEach(function (a) {
      a.addEventListener("mouseenter", function () {
        if (header.classList.contains("skr-header--compact")) return;
        if (window.matchMedia && window.matchMedia("(max-width: 600px)").matches) return;
        document.querySelectorAll(".skr-header__submenu--side[data-open]").forEach(function (open) {
          if (open.contains(a)) return;
          open.removeAttribute("data-open");
          var t = open.parentNode.querySelector(":scope > .skr-header__grouptoggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
      });
    });

    /* DER FOKUS HIELT EIN GEKLICKTES MENUE OFFEN. Gemeldet und nachgestellt: Wer am
       Schreibtisch „Design-System" aufklappt, darin „Grundlagen" ANKLICKT und dann auf
       „Referenz" faehrt, hatte drei Menues gleichzeitig offen. Die Uebernahme raeumte
       zwar `data-open` - aber der Klick hatte den Schalter FOKUSSIERT, und
       `…__group:focus-within > …__submenu` haelt es weiter auf. Gemessen:
       `data-open=false`, `:hover=false`, `:focus-within=true`.

       Deshalb nimmt eine Uebernahme per ZEIGER den Fokus aus der verlassenen Gruppe.
       Nur per Zeiger: Wer mit der Tabulatortaste hineingeht, soll nichts davon merken,
       und im schmalen Layout gibt es keine Uebernahme (siehe die Schwellen unten). */
    function releaseFocus(group) {
      var active = document.activeElement;
      if (!active || active === document.body) return;
      if (!header.contains(active)) return;
      if (group && group.contains(active)) return;
      active.blur();
    }

    /* UEBERNAHME AUF JEDER EBENE. Bisher gab es sie nur fuer die seitlichen Menues der
       dritten Ebene; auf der ersten blieb ein geklicktes Menue neben dem ueberfahrenen
       stehen (gemessen: „Funktionsumfang" und „Design-System" gleichzeitig offen). */
    header.querySelectorAll("[data-skr-menu]").forEach(function (group) {
      var own = group.querySelector(":scope > .skr-header__submenu");
      if (!own) return;
      group.addEventListener("mouseenter", function () {
        if (header.classList.contains("skr-header--compact")) return;
        if (window.matchMedia && window.matchMedia("(max-width: 600px)").matches) return;
        document.querySelectorAll(".skr-header__submenu[data-open]").forEach(function (open) {
          if (open === own || open.contains(group)) return;
          open.removeAttribute("data-open");
          var t = open.parentNode.querySelector(":scope > .skr-header__grouptoggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
        releaseFocus(group);
        if (group.parentNode === nav) measureLevelTwo(own);
      });
      /* Per Tastatur oder Klick geoeffnet: ebenso messen – aber nur beim Hineingehen,
         nicht bei jedem Fokuswechsel im Menue (das setzte den Lauf zurueck). */
      if (group.parentNode === nav) {
        group.addEventListener("focusin", function (e) {
          if (e.relatedTarget && group.contains(e.relatedTarget)) return;
          if (pointerDown) return;
          measureLevelTwo(own);
        });
        var switches = group.querySelector(":scope > .skr-header__grouptoggle");
        if (switches) switches.addEventListener("click", function () {
          window.requestAnimationFrame(function () { measureLevelTwo(own); });
        });
      }
    });

    header.querySelectorAll(".skr-header__group--sub").forEach(function (g) {
      var menu = g.querySelector(".skr-header__submenu--side");
      if (!menu) return;
      /* EIN ANDERES MENUE UEBERNIMMT. Am Schreibtisch oeffnet der Hover per CSS,
         ein Klick setzt zusaetzlich `data-open` - und das bliebe stehen, waehrend
         nebenan schon das naechste aufgeht. Beim Betreten einer Gruppe schließt
         deshalb alles, was weder sie selbst noch ein Vorfahr von ihr ist. */
      function takeOver() {
        /* NUR AM SCHREIBTISCH. Im Burger oeffnet und schließt allein der Klick -
           dort ist die Maus kein Zeigegeraet ueber einem Streifen, sondern faehrt
           beim Scrollen ueber alles hinweg. Gemeldet: Ein Klick auf „Grundlagen"
           oeffnete, das blosse Ueberfahren von „Referenz" schloss es wieder. */
        if (header.classList.contains("skr-header--compact")) return;
        if (window.matchMedia && window.matchMedia("(max-width: 600px)").matches) return;
        chooseSide(menu, g);
        document.querySelectorAll(".skr-header__submenu[data-open]").forEach(function (open) {
          if (open === menu || open.contains(g)) return;
          open.removeAttribute("data-open");
          var t = open.parentNode.querySelector(":scope > .skr-header__grouptoggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
        releaseFocus(g);
      }
      g.addEventListener("mouseenter", takeOver);
      /* PER FOKUS NUR BEIM HINEINGEHEN, NIE BEIM ZEIGERDRUCK. `chooseSide` misst das
         Menue neu und setzt es an den Anfang. Lief das seitliche Menue (Kapitel 8 der
         Architekturdoku), fokussierte der Mausdruck den Eintrag, und das Menue sprang
         zurueck – zwischen Druecken und Loslassen; der Klick traf nichts. Dasselbe wie in
         der zweiten Ebene (siehe `pointerDown`). Ein Fokuswechsel innerhalb der Gruppe
         misst ebenfalls nicht neu, sonst setzte jeder Tab den Lauf zurueck. */
      g.addEventListener("focusin", function (e) {
        if (pointerDown) return;
        if (e.relatedTarget && g.contains(e.relatedTarget)) return;
        takeOver();
      });
    });
  }

  /* --- Drucken-Button -----------------------------------------------------
     Löst den Druckdialog aus. Genutzt im Hero der Visualisierungs-Ansicht: Sie
     hat keine Kopfzeile und keine Sidebar, in der ein Weg zum Ausdruck stecken
     könnte. Ohne JavaScript bleibt der Knopf wirkungslos – wie die
     Kopier-Buttons, deren Funktion ebenfalls am Skript hängt. */
  function initPrintButtons() {
    document.querySelectorAll("[data-skr-print]").forEach(function (btn) {
      btn.addEventListener("click", function () { window.print(); });
    });
  }

  /* --- QR-Code der Seiten-URL ---------------------------------------------
     Neben dem Drucken- bzw. Kopieren-Button steht ein QR-Code auf die Adresse
     der aktuellen Seite: „Diese Seite auf Deinem Smartphone öffnen“ – vom
     Beamer oder vom gedruckten Blatt in die eigene Hand, ohne Abtippen.

     Warum clientseitig: Die Adresse kennt erst der Browser. Die gebaute Site
     kennt ihre eigene nicht (dieselbe Unterlage läuft auf jedem Server, unter
     jedem Pfad, in der Vorschau), und das Fragment (#/3 der Präsentation)
     ändert sich sogar ohne Seitenwechsel.

     Das Layout stellt nur einen leeren, [hidden] gesetzten Platzhalter
     `<button class="skr-qr" data-skr-qr>` bereit. Der Code
     selbst wird hier gebaut und per DOM eingehängt, sobald die Bibliothek
     geladen und die Matrix berechnet ist. Ohne JavaScript (oder wenn das
     Nachladen scheitert) bleibt der Platzhalter verborgen – die Werkzeugzeile
     sieht dann aus wie zuvor.

     Die Matrix kommt aus der mitgelieferten Bibliothek `qrcode/` (MIT, siehe
     dortige README); das SVG baut das Theme selbst. */
  var QR_SVG_NS = "http://www.w3.org/2000/svg";
  /* Ruhezone in Modulen. ISO/IEC 18004 fordert 4 – ohne sie finden Scanner die
     Begrenzung des Codes nicht. */
  var QR_QUIET = 4;

  function buildQrSvg(factory, text) {
    /* 0 = kleinste Version, die die Nutzlast trägt; „M“ = 15 % Redundanz (guter
       Kompromiss: verzeiht Bildschirm-Spiegelungen und Druckraster, ohne die
       Module unnötig klein werden zu lassen). */
    var qr = factory(0, "M");
    qr.addData(text);
    qr.make();

    var count = qr.getModuleCount();
    var size = count + 2 * QR_QUIET;

    /* EIN Pfad für alle dunklen Module, zeilenweise zu waagerechten Läufen
       zusammengefasst. Ein Rechteck je Modul wäre ein Vielfaches an Knoten. */
    var d = "";
    for (var row = 0; row < count; row++) {
      var col = 0;
      while (col < count) {
        if (!qr.isDark(row, col)) { col++; continue; }
        var start = col;
        while (col < count && qr.isDark(row, col)) col++;
        var len = col - start;
        d += "M" + (start + QR_QUIET) + " " + (row + QR_QUIET) +
             "h" + len + "v1h-" + len + "z";
      }
    }

    var svg = document.createElementNS(QR_SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    /* Modulkanten scharf halten – weichgezeichnete Ränder kosten Lesbarkeit. */
    svg.setAttribute("shape-rendering", "crispEdges");
    /* Für Screenreader wertlos; die Beschriftung trägt der Button. */
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    /* Fläche und Module bleiben OHNE fill-Attribut: Die Farben setzt
       components.css aus den Token (--skr-white/--skr-ink). Sie
       folgen bewusst NICHT dem Farbschema – ein invertierter QR-Code (hell auf
       dunkel) wird von vielen Scannern nicht gelesen. Die Fläche deckt auch die
       Ruhezone ab. */
    var bg = document.createElementNS(QR_SVG_NS, "rect");
    bg.setAttribute("width", String(size));
    bg.setAttribute("height", String(size));
    svg.appendChild(bg);

    var path = document.createElementNS(QR_SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);

    return svg;
  }

  /* DAS POPUP DES QR-CODES. Der Knopf ist nur das Zeichen; scannbar wird der Code in
     einem modalen `<dialog>` mittig auf der Seite, darunter die Adresse, die er traegt.
     Gebaut beim ersten Oeffnen, danach wiederverwendet. `<dialog>` bringt mit, was ein
     Popup braucht: Fokus hinein, Escape schliesst, der Rest der Seite ist inert.
     Gesetzt von `initPageQr`, gelesen auch von der Client-API. */
  var QrPopup = { open: null, close: null };

  function initPageQr() {
    var hosts = document.querySelectorAll("[data-skr-qr]");
    if (!hosts.length) return;
    /* Nur echte Web-Adressen. Ein QR-Code auf `file:///…` (lokal geöffnete
       Datei) oder `about:` führt auf dem Smartphone ins Leere; dort bleibt der
       Platzhalter besser verborgen als ein Code, der nicht funktioniert. */
    if (location.protocol !== "http:" && location.protocol !== "https:") return;

    var libUrl;
    try {
      libUrl = new URL("qrcode/qrcode.mjs", scriptUrl || document.baseURI).href;
    } catch (e) { return; }

    import(libUrl).then(function (mod) {
      var factory = mod.default;
      /* Zuletzt kodierte Adresse – schützt davor, bei jedem Ereignis dieselbe
         Matrix neu zu rechnen. */
      var shown = null;

      var dialog = null, trigger = null;

      function buildDialog(title) {
        dialog = document.createElement("dialog");
        dialog.className = "skr-qr-dialog";
        dialog.setAttribute("data-skr-qr-dialog", "");
        dialog.setAttribute("aria-labelledby", "skr-qr-dialog-title");
        var head = document.createElement("div");
        head.className = "skr-qr-dialog__head";
        var h = document.createElement("h2");
        h.className = "skr-qr-dialog__title";
        h.id = "skr-qr-dialog-title";
        h.textContent = title;
        var closed = document.createElement("button");
        closed.type = "button";
        closed.className = "skr-tool skr-qr-dialog__close";
        closed.setAttribute("aria-label", T.close);
        closed.title = T.close;
        closed.appendChild(glyph("close"));
        closed.addEventListener("click", function () { dialog.close(); });
        head.appendChild(h);
        head.appendChild(closed);
        var code = document.createElement("div");
        code.className = "skr-qr-dialog__code";
        var url = document.createElement("p");
        url.className = "skr-qr-dialog__url";
        dialog.appendChild(head);
        dialog.appendChild(code);
        dialog.appendChild(url);
        /* Klick DANEBEN schliesst: Ein Klick auf die Abdunkelung landet beim
           `<dialog>` selbst, ausserhalb seines Rechtecks. */
        dialog.addEventListener("click", function (e) {
          if (e.target !== dialog) return;
          var r = dialog.getBoundingClientRect();
          var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) dialog.close();
        });
        /* Fokus zurueck auf den Knopf, der es geoeffnet hat. */
        dialog.addEventListener("close", function () {
          if (trigger && document.contains(trigger)) trigger.focus();
        });
        document.body.appendChild(dialog);
      }

      function fillDialog() {
        if (!dialog) return;
        dialog.querySelector(".skr-qr-dialog__code").replaceChildren(buildQrSvg(factory, shown));
        dialog.querySelector(".skr-qr-dialog__url").textContent = shown;
      }

      function open(host) {
        host = host || hosts[0];
        if (!host || host.hidden) return false;
        if (!dialog) buildDialog(host.getAttribute("aria-label") || "");
        fillDialog();
        trigger = host;
        if (!dialog.open) dialog.showModal();
        return true;
      }
      QrPopup.open = open;
      QrPopup.close = function () {
        if (dialog && dialog.open) dialog.close();
        return true;
      };

      function render() {
        /* DER QR-CODE ZEIGT DIE ADRESSE, DIE BLEIBT. Hat die Seite einen
           Permalink, gehoert er auf den Code - er ist der Grund, warum es ihn
           gibt: Ein Code auf Papier ueberlebt jede Umbenennung. Das Fragment
           kommt mit, weil die Praesentation ihre Folie darin fuehrt. */
        var short = permalinkHref();
        var address = short ? short.replace(/#.*$/, "") + location.hash : location.href;
        if (address === shown) return;
        shown = address;
        hosts.forEach(function (host) {
          var box = document.createElement("span");
          box.className = "skr-qr__box";
          box.appendChild(buildQrSvg(factory, shown));
          host.replaceChildren(box);
          host.hidden = false;
        });
        fillDialog();
      }

      render();

      /* Die Adresse kann sich ohne Seitenwechsel ändern: Die Präsentation führt
         die aktuelle Folie im Fragment (#/3). Ohne Neuberechnung zeigte der Code
         auf eine Folie, die längst weitergeblättert ist.

         Zwei Ereignisse, weil eines nicht genügt: `hashchange` deckt Sprungmarken
         und Vor/Zurück ab; die Präsentation setzt das Fragment aber per
         `history.replaceState`, und das löst kein `hashchange` aus – dafür sendet
         presentation.js `skr-urlchange`. */
      window.addEventListener("hashchange", render);
      window.addEventListener("skr-urlchange", render);

      /* Ein Klick oeffnet das Popup – auf jedem Geraet gleich. */
      hosts.forEach(function (host) {
        host.setAttribute("aria-haspopup", "dialog");
        host.addEventListener("click", function () { open(host); });
      });
    }).catch(function () {
      /* Bibliothek nicht ladbar → Platzhalter bleibt [hidden]. */
    });
  }

  /* --- Zurück-Knopf ------------------------------------------------------------
     Ein Verweis auf „die übergeordnete Seite“ wäre geraten: Wir wissen nicht, wie
     jemand hergekommen ist – über das Modul, aus der Suche, per QR-Code vom
     Beamer, aus einem Chat. Deshalb kein Link auf eine gedachte Hierarchie,
     sondern der Weg zurück, den der Browser tatsächlich kennt.

     Der Knopf bleibt versteckt, wenn es nichts gibt, wohin er führen könnte –
     etwa beim Öffnen in einem frischen Tab. `history.length` ist dafür der
     einzige Anhaltspunkt, den eine Seite hat; er zählt auch Einträge fremder
     Herkunft, taugt aber, um den Knopf bei einem leeren Verlauf wegzulassen. */
  function initBackButtons() {
    var buttons = document.querySelectorAll("[data-skr-back]");
    if (!buttons.length) return;
    var hasHistory = window.history.length > 1;
    Array.prototype.forEach.call(buttons, function (button) {
      if (!hasHistory) return;
      button.removeAttribute("hidden");
      button.addEventListener("click", function () { window.history.back(); });
    });
  }

  /* --- Aufdeckbarer Inhalt (`skr-reveal`) --------------------------
     Die mittige Darstellung macht CSS an `[open]`; hier kommt nur dazu, was
     `<details>` nicht mitbringt:
       - ein Rahmen um den Inhalt (`__body`), damit Panel und Overlay getrennt
         liegen und das Panel eine eigene Fläche bekommt,
       - der Titel im Panel (aus dem `summary`), damit sichtbar bleibt, was
         geöffnet ist,
       - Klick daneben, ESC und ein Schließen-Kreuz.
     Ohne dieses Skript bleibt der Baustein ein gewöhnlicher Aufklapper – der
     Inhalt ist dann erreichbar, nur nicht mittig. Kein Schulungsinhalt hängt
     also am JavaScript. */
  function initReveals() {
    document.querySelectorAll("details.skr-reveal").forEach(function (details, index) {
      if (inPresentation(details)) { return; }
      var summary = details.querySelector(":scope > summary");
      if (!summary) return;

      /* AUFGEDECKT IST EIN ZUSTAND. Wer eine Musterloesung aufschlaegt und neu
         laedt, soll sie wieder vor sich haben - und ein Verweis darf genau darauf
         zeigen. NICHT exklusiv: Mehrere duerfen offen sein, die Liste in der
         Adresse ist deshalb vollstaendig. */
      if (!withoutState(details)) {
        assignId(details, summary.textContent, "skr-reveal-", index);
        State.openable({
          id: details.id,
          isOpen: function () { return details.open; },
          set: function (opened) { details.open = opened; }
        });
        details.addEventListener("toggle", function () { State.update(); });
      }

      var body = details.querySelector(":scope > .skr-reveal__body");
      if (!body) {
        body = document.createElement("div");
        body.className = "skr-reveal__body";
        // Alles außer dem summary in den Rahmen umhängen (Reihenfolge bleibt).
        var children = [];
        details.childNodes.forEach(function (n) { if (n !== summary) children.push(n); });
        children.forEach(function (n) { body.appendChild(n); });
        details.appendChild(body);
      }

      if (!body.querySelector(".skr-reveal__title")) {
        var title = document.createElement("p");
        title.className = "skr-reveal__title";
        title.textContent = summary.textContent.trim();
        body.insertBefore(title, body.firstChild);
      }

      if (!body.querySelector(".skr-reveal__close")) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "skr-reveal__close";
        button.setAttribute("aria-label", T.close);
        button.innerHTML = "&times;";
        button.addEventListener("click", function () { details.open = false; });
        body.appendChild(button);
      }

      /* Klick NEBEN das Panel schließt. Der Klick auf die Abdunkelung landet am
         `details` selbst (sie ist dessen ::before), Klicks im Panel nicht – die
         fängt der zweite Handler ab. */
      details.addEventListener("click", function (event) {
        if (!details.open) return;
        if (event.target === summary || summary.contains(event.target)) return;
        if (body.contains(event.target)) return;
        details.open = false;
      });
    });

    /* ESC schließt das oberste offene Panel. `<details>` kennt das nicht. */
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = document.querySelectorAll("details.skr-reveal[open]");
      if (!open.length) return;
      open[open.length - 1].open = false;
    });

    /* FÜR DEN AUSDRUCK AUFKLAPPEN. Das muss hier passieren und lässt sich NICHT
       in print.css lösen: Ein geschlossenes `<details>` verbirgt seinen Inhalt
       über einen Slot im Shadow DOM (`content-visibility`), nicht über ein
       `display: none` an den Kindern – von außen ist das per CSS nicht
       aufzuheben. print.css baut anschließend nur noch Overlay und Panelfläche
       zurück, damit der Inhalt eingebettet in der Seite steht.
       `--screen-only` bleibt zu (und wird in print.css ausgeblendet): Ein
       Ausdruck, der die Musterlösung mitbringt, nimmt der Übung den Sinn.
       Nach dem Druck wird der vorherige Zustand wiederhergestellt. */
    var openedForPrint = [];
    /* EXKLUSIVITAET VORUEBERGEHEND AUFHEBEN. Ein `<details name="…">` schließt
       beim Oeffnen seine Geschwister - das ist am Bildschirm der Zweck und beim
       Drucken der Fehler: Die Schleife unten oeffnet reihum und liesse am Ende
       GENAU EINEN Reiter offen, der Rest waere auf dem Papier verschwunden.
       Der Name wird deshalb kurz entfernt und danach zurueckgesetzt. */
    var namesRemembered = [];
    function nameOff() {
      namesRemembered = [];
      document.querySelectorAll(
        "details.skr-tabs__panel[name], details.skr-walkthrough__line[name]"
      ).forEach(function (d) {
        namesRemembered.push([d, d.getAttribute("name")]);
        d.removeAttribute("name");
      });
    }
    function nameOn() {
      namesRemembered.forEach(function (e) { e[0].setAttribute("name", e[1]); });
      namesRemembered = [];
    }
    /* WIEDEREINTRITTSFEST (A-005 aus training-concept-container-technologies):
       Beide Wege sind unbedingt registriert - `beforeprint` UND der Wechsel des
       Media-Query. `beforePrint` lief damit ZWEIMAL, und beim zweiten Lauf fand es
       nichts mehr vor: kein Reiter trug noch einen Namen, keiner war noch zu. Die
       beiden Merklisten wurden dabei mit LEEREN Listen ueberschrieben, und
       `afterPrint` stellte danach nichts wieder her.

       Die Folge reichte weit ueber den Druck hinaus: Ohne ihr `name`-Attribut
       verlieren die Reiter ihre Gruppierung dauerhaft - bis zum Neuladen. Wer
       danach einen Reiter anklickte, bekam den neuen Inhalt ZUSAETZLICH zu allen
       vorher geoeffneten. Aus dem Reiterstreifen wurde eine wachsende Liste.

       Ein Flag statt zweier Waechter: Der Druckzustand ist EINER, und beide
       Merklisten haengen daran. */
    var inPrint = false;
    function beforePrint() {
      if (inPrint) { return; }
      inPrint = true;
      nameOff();
      openedForPrint = [];
      document.querySelectorAll(
        "details.skr-reveal, details.skr-tabs__panel, " +
        "details.skr-walkthrough__line, details.skr-fold"
      ).forEach(function (d) {
        if (d.classList.contains("skr-reveal--screen-only")) return;
        if (d.open) return;
        d.open = true;
        openedForPrint.push(d);
      });
    }
    function afterPrint() {
      if (!inPrint) { return; }
      inPrint = false;
      openedForPrint.forEach(function (d) { d.open = false; });
      openedForPrint = [];
      /* Erst schließen, dann die Namen zurueck: Andersherum schloesse der
         Browser beim Setzen des Namens selbst Geschwister und der Zustand von
         vor dem Druck waere nicht wiederhergestellt, sondern geraten. */
      nameOn();
    }
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    /* Älteres Safari kennt beforeprint/afterprint nicht, wohl aber den
       Medienwechsel. */
    if (window.matchMedia) {
      var mq = window.matchMedia("print");
      var onChange = function (e) { if (e.matches) { beforePrint(); } else { afterPrint(); } };
      if (mq.addEventListener) { mq.addEventListener("change", onChange); }
      else if (mq.addListener) { mq.addListener(onChange); }
    }
  }

  /* --- Klappbarer Abschnitt (`skr-fold`) ---------------------------
     Das Auf und Zu macht der Browser: Der Baustein ist ein gewoehnliches
     `<details>`, und das bleibt er auch ohne dieses Skript. Hier kommt allein der
     ZUSTAND IN DER ADRESSE dazu - sonst ist ein aufgeklappter Abschnitt nach dem
     Neuladen wieder zu, und ein Verweis kann nicht auf ihn zeigen. */
  function initFolds() {
    document.querySelectorAll("details.skr-fold").forEach(function (details, index) {
      if (inPresentation(details) || withoutState(details)) { return; }
      var summary = details.querySelector(":scope > summary");
      assignId(details, summary ? summary.textContent : "", "skr-fold-", index);
      State.openable({
        id: details.id,
        isOpen: function () { return details.open; },
        set: function (opened) { details.open = opened; }
      });
      details.addEventListener("toggle", function () { State.update(); });
    });
  }

  /* --- Vorfuehrungen gehoeren dem Demo-Skript ----------------------------- */
  /* EINE BUEHNE IST EINE VORSCHAU, KEIN BAUSTEIN. `demo.js` nimmt ihr Markup und
     baut es in einem eigenen Rahmen noch einmal auf - mit demselben Theme und
     demselben Skript. Wer hier vorher zugreift, uebergibt eine bereits
     umgebaute Fassung: Der Rahmen setzte dann einen Knopf in den Knopf und eine
     Klappzeile in die Klappzeile. Gemessen: zehn Koepfe, wo fuenf hingehoeren.

     Deshalb laesst dieses Skript alles in Ruhe, was unter
     `[data-skr-demo]` steht. Ohne `demo.js` bleibt die Buehne damit das
     rohe Markup - und genau das ist sie dann auch. */
  function inPresentation(el) {
    return !!(el.closest && el.closest("[data-skr-demo]"));
  }

  /* ==========================================================================
     TABS – aus dem Akkordeon einen Reiterstreifen machen
     --------------------------------------------------------------------------
     DIE SEITE FUNKTIONIERT OHNE DIESE FUNKTION. Grundlage ist
     `<details name="…">`; der Browser schaltet damit von sich aus exklusiv, und
     jeder Inhalt ist erreichbar. Was hier passiert, ist reine Zugabe: die
     `<summary>` wandern in eine Leiste, die Panels verlieren ihre Rahmen.

     Erst WENN die Leiste steht, wird `--enhanced` gesetzt. Bricht etwas vorher
     ab, bleibt das Akkordeon sichtbar statt einer halben Oberflaeche.
     ========================================================================== */
  /* Die gemerkte Wahl einer Gruppe von Reitern – je Site (ihre Wurzel), wie die Rolle. */
  function tabsKey(group) {
    var root = "/";
    try { root = new URL(window.skr._root()).pathname; } catch (e) { /* Wurzel unbekannt */ }
    return "skr-tabs:" + root + ":" + group;
  }

  function initTabs() {
    document.querySelectorAll(".skr-tabs").forEach(function (box, index) {
      if (inPresentation(box)) { return; }
      var panels = Array.prototype.slice.call(
        box.querySelectorAll(":scope > details.skr-tabs__panel")
      );
      if (panels.length < 2) return;   /* ein einzelner Reiter ist keiner */

      /* Senkrecht oder waagerecht? Entscheidet allein die Klasse im Markup.
         Das Skript muss es wissen, weil Hilfstechnik und Pfeiltasten sich
         danach richten - die Anordnung selbst macht das Stylesheet. */
      var sideways = box.classList.contains("skr-tabs--side");

      var bar = document.createElement("div");
      bar.className = "skr-tabs__bar";
      bar.setAttribute("role", "tablist");
      bar.setAttribute("aria-orientation", sideways ? "vertical" : "horizontal");

      /* DIE ADRESSE FUEHRT DEN ZUSTAND MIT, damit sie sich als Lesezeichen eignet -
         aber nicht dieser Baustein allein: Geschrieben wird EINMAL fuer die ganze
         Seite (`Zustand`, oben). Solange der Reiterstreifen `#«panel-id»` selbst
         setzte, loeschte jeder Klick den Zustand aller anderen Bausteine.
         Die Tastatur ruft dieselbe Funktion: Ein per Pfeiltaste gewaehlter Reiter
         ist genauso gewaehlt wie ein angeklickter. */
      function trackAddress() {
        State.update();
      }

      /* GRUPPEN (`data-skr-tabs-group="«name»"`): Reiter derselben Gruppe stehen für
         dieselbe Wahl – etwa „CLI“, „npx“, „Docker“ über jedem Befehl einer Doku. Wählt
         jemand einen, folgen alle Reiterstreifen der Gruppe auf der Seite, und der Browser
         merkt sich die Wahl je Site für die nächste Seite. Zugeordnet wird über die
         Beschriftung des Reiters; ein Streifen ohne passenden Reiter bleibt, wie er ist. */
      var group = box.getAttribute("data-skr-tabs-group");
      function label(panel) {
        var s = panel.querySelector(":scope > summary");
        return s ? s.textContent.replace(/\s+/g, " ").trim() : "";
      }
      function announceGroup(panel) {
        if (!group) return;
        var choice = label(panel);
        try { localStorage.setItem(tabsKey(group), choice); } catch (e) { /* ohne Speicher */ }
        document.dispatchEvent(new CustomEvent("skr-tabs-group", { detail: { group: group, tab: choice, source: box } }));
      }
      function followGroup(choice) {
        var matches = panels.filter(function (p) { return label(p) === choice; })[0];
        if (matches && !matches.open) { matches.open = true; }
        return !!matches;
      }
      if (group) {
        document.addEventListener("skr-tabs-group", function (e) {
          if (e.detail.group !== group || e.detail.source === box) return;
          if (followGroup(e.detail.tab)) { State.update(); }
        });
        var remembered = null;
        try { remembered = localStorage.getItem(tabsKey(group)); } catch (e) { /* ohne Speicher */ }
        if (remembered) { followGroup(remembered); }
      }

      var buttons = panels.map(function (panel, i) {
        var summary = panel.querySelector(":scope > summary");
        if (!summary) return null;

        /* EINE LESBARE ID JE PANEL. Sie landet in der Adresse, sobald jemand
           einen Reiter waehlt - `#tag-1` ist ein brauchbares Lesezeichen,
           `#skr-tabs-0-3` nicht. Eine vorhandene ID bleibt unangetastet: Sie
           steht womoeglich schon in einem Link.

           Kollidiert der Name mit etwas anderem auf der Seite (eine Ueberschrift
           heißt leicht genauso), gewinnt das Vorhandene und der Reiter bekommt
           den technischen Namen - zwei gleiche IDs waeren schlimmer als eine
           haessliche. */
        if (!panel.id) {
          var wish = summary.textContent.toLowerCase()
            .replace(/\u00e4/g, "ae").replace(/\u00f6/g, "oe")
            .replace(/\u00fc/g, "ue").replace(/\u00df/g, "ss")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          panel.id = (wish && !document.getElementById(wish))
            ? wish : ("skr-tabs-" + index + "-" + i);
        }

        var button = document.createElement("button");
        button.type = "button";
        button.className = "skr-tabs__tab";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", panel.id);
        button.innerHTML = summary.innerHTML;
        button.addEventListener("click", function () {
          panel.open = true;
          trackAddress();
          announceGroup(panel);
        });
        bar.appendChild(button);
        return button;
      });
      if (buttons.indexOf(null) !== -1) return;  /* ein Panel ohne summary: Finger weg */

      /* Den ausgewaehlten Reiter markieren. `toggle` feuert auch, wenn der
         Browser wegen `name` ein anderes Panel SCHLIESST - eine Funktion fuer
         beide Richtungen. */
      function follow() {
        panels.forEach(function (panel, i) {
          var open = panel.open;
          buttons[i].setAttribute("aria-selected", open ? "true" : "false");
          buttons[i].tabIndex = open ? 0 : -1;
        });
      }
      panels.forEach(function (panel) {
        panel.addEventListener("toggle", follow);
      });

      /* Pfeiltasten in der Leiste - ohne sie ist ein Reiterstreifen mit der
         Tastatur nur ueber Tab-Sprünge erreichbar, und `tabIndex = -1` an den
         nicht gewaehlten macht ihn dann ganz unerreichbar. */
      bar.addEventListener("keydown", function (event) {
        var i = buttons.indexOf(document.activeElement);
        if (i === -1) return;
        /* Die Pfeile folgen der Anordnung: senkrecht hoch/runter, waagerecht
           links/rechts. Eine Leiste, die untereinander steht und auf
           `ArrowDown` nicht reagiert, fuehlt sich kaputt an - so steht die
           Erwartung auch in den ARIA Authoring Practices. */
        var forward = sideways ? "ArrowDown" : "ArrowRight";
        var back = sideways ? "ArrowUp" : "ArrowLeft";
        var target = null;
        if (event.key === forward) { target = (i + 1) % buttons.length; }
        else if (event.key === back) { target = (i - 1 + buttons.length) % buttons.length; }
        else if (event.key === "Home") { target = 0; }
        else if (event.key === "End") { target = buttons.length - 1; }
        if (target === null) return;
        event.preventDefault();
        panels[target].open = true;
        trackAddress();
        announceGroup(panels[target]);
        buttons[target].focus();
      });

      /* DER RAHMEN UM LEISTE UND BURGER. Er traegt die trennende Linie, damit
         sie ueber die ganze Breite laeuft - die Leiste allein hoerte vor dem
         Knopf auf. Der Burger steht NEBEN der `tablist`, nicht darin: Ein Knopf
         zwischen den Reitern verletzt `aria-required-children`. */
      var frame = document.createElement("div");
      frame.className = "skr-tabs__nav";
      frame.appendChild(bar);

      /* Nur waagerecht. Eine seitliche Leiste steht ohnehin untereinander und
         hat das Platzproblem nicht. */
      var more = null;
      if (!sideways) {
        more = document.createElement("button");
        more.type = "button";
        more.className = "skr-tool skr-tabs__more";
        more.setAttribute("aria-expanded", "false");
        more.setAttribute("aria-controls", bar.id || (bar.id = "skr-tabs-bar-" + index));
        more.setAttribute("aria-label", T.moreTabs);
        more.appendChild(glyph("menu"));
        frame.appendChild(more);
      }

      box.insertBefore(frame, box.firstChild);
      box.classList.add("skr-tabs--enhanced");

      /* --- Zu schmal? Dann nur der gewaehlte Reiter -----------------------
         GEMESSEN, NICHT GERATEN: Wie viel Platz die Leiste braucht, haengt an
         Anzahl UND Laenge der Beschriftungen; eine feste Pixelgrenze waere bei
         zwei kurzen Reitern zu frueh und bei sechs langen zu spaet.

         Gemessen wird im NICHT zusammengeklappten Zustand - sonst misst man das
         Ergebnis der eigenen Entscheidung und bleibt fuer immer kompakt. */
      function closeMenu() {
        box.classList.remove("skr-tabs--menu-open");
        if (more) { more.setAttribute("aria-expanded", "false"); }
      }

      function measure() {
        if (!more) return;
        var wasOpen = box.classList.contains("skr-tabs--menu-open");
        box.classList.remove("skr-tabs--compact", "skr-tabs--menu-open");
        var tooNarrow = bar.scrollWidth > bar.clientWidth + 1;
        if (tooNarrow) {
          box.classList.add("skr-tabs--compact");
          if (wasOpen) { box.classList.add("skr-tabs--menu-open"); }
        } else {
          closeMenu();
        }
      }

      if (more) {
        more.addEventListener("click", function () {
          var open = box.classList.toggle("skr-tabs--menu-open");
          more.setAttribute("aria-expanded", open ? "true" : "false");
          if (open) {
            var selected = buttons[panels.findIndex(function (p) { return p.open; })];
            if (selected) { selected.focus(); }
          }
        });
        /* Eine Wahl beendet das Menue - sonst bliebe die Liste ueber dem
           Inhalt stehen, den sie gerade gewechselt hat. */
        bar.addEventListener("click", closeMenu);
        /* Escape schliesst, wie jedes Aufklappmenue. Der Fokus geht zurueck auf
           den Knopf, der es geoeffnet hat - sonst steht er im Nichts. */
        box.addEventListener("keydown", function (event) {
          if (event.key !== "Escape") return;
          if (!box.classList.contains("skr-tabs--menu-open")) return;
          closeMenu();
          more.focus();
        });
        if (window.ResizeObserver) {
          var scheduled = false;
          new ResizeObserver(function () {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(function () { scheduled = false; measure(); });
          }).observe(box);
        } else {
          window.addEventListener("resize", measure);
        }
      }

      /* Keines offen? Dann das erste - sonst stuende die Leiste ueber einer
         leeren Flaeche. Im Akkordeon waere das in Ordnung, als Reiterstreifen
         sieht es kaputt aus. */
      if (!panels.some(function (p) { return p.open; })) { panels[0].open = true; }
      follow();
      /* Erst jetzt messen: Vorher steht nicht fest, welcher Reiter gewaehlt ist,
         und im kompakten Zustand bestimmt genau der die Breite der Leiste. */
      measure();

      /* ANMELDEN, ERST JETZT: Was hier offen steht, ist der Ausgangszustand des
         Dokuments - und der entscheidet, ob ueberhaupt etwas in die Adresse muss.
         EXKLUSIV, weil genau ein Reiter offen ist: "nicht genannt" heisst deshalb
         "unveraendert" und nicht "zu" - sonst stuende die Leiste ueber nichts. */
      panels.forEach(function (panel) {
        State.openable({
          id: panel.id,
          exclusive: true,
          isOpen: function () { return panel.open; },
          set: function (opened) { if (opened) { panel.open = true; } }
        });
      });
    });

    /* TIEFE VERWEISE: `#…` auf ein Panel oder auf etwas DARIN muss den
       zugehoerigen Reiter oeffnen - sonst springt der Browser an eine Stelle,
       die gerade zu ist, und die Seite ruehrt sich nicht. */
    function fromHashValue() {
      var id = State.anchor();
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;
      var panel = target.closest(".skr-tabs__panel");
      if (!panel) return;
      panel.open = true;
      target.scrollIntoView();
    }
    window.addEventListener("hashchange", fromHashValue);
    fromHashValue();
  }


  /* ==========================================================================
     AKKORDEON – aus Ueberschriften werden Klappbereiche
     --------------------------------------------------------------------------
     DIE SEITE FUNKTIONIERT OHNE DIESE FUNKTION. Der Autor schreibt gewoehnliche
     Ueberschriften in einen Kasten; ohne Skript steht da ein gewoehnliches
     Dokument, und zwar vollstaendig. Alles Zuklappen haengt an der Klasse
     `--enhanced`, die erst gesetzt wird, wenn der Umbau steht.

     WARUM UEBERSCHRIFTEN UND NICHT `<details>` wie bei Reitern und Fold: Eine
     Ueberschrift ist die Gliederung des Dokuments - sie traegt die Ebene, den
     Anker und die Vorlesereihenfolge. Wer dieselbe Liste als `<details>`
     schreibt, verliert beides und muss jede Zeile in Markup einpacken. Hier
     bleibt die Quelle Markdown, und die Bedienung kommt dazu.

     WARUM EIN GITTER UND KEIN `<details>` FUER DIE BEWEGUNG: Es klappt hier
     genauso zu, wie das Burger-Menue zuklappt - `0fr` -> `1fr` rechnet mit der
     wirklichen Hoehe. Ein `<details>` kann man zwar aufgehen lassen, aber nicht
     zugehen: Der Browser nimmt den Inhalt beim Schliessen sofort aus dem Fluss.
     Der Preis steht in der Doku unter „Grenzen": Strg+F findet nicht, was
     zugeklappt ist. Bei Reitern ist das anders, und deshalb stehen beide
     Bausteine nebeneinander.
     ========================================================================== */
  function initAccordion() {
    var boxes = Array.prototype.slice.call(
      document.querySelectorAll(".skr-accordion")
    ).filter(function (box) { return !inPresentation(box); });

    boxes.forEach(function (box, index) {
      var children = Array.prototype.slice.call(box.children);

      /* DIE FLACHSTE UEBERSCHRIFT UNTER DEN DIREKTEN KINDERN macht die Bereiche.
         Damit entscheidet der Autor die Ebene, indem er sie schreibt (`###` in
         einem `##`-Kapitel), und ein verschachteltes Akkordeon in einem Bereich
         zaehlt nicht mit - es ist kein direktes Kind mehr. */
      var level = 0;
      children.forEach(function (el) {
        var matches = /^H([1-6])$/.exec(el.tagName);
        if (!matches) return;
        var n = Number(matches[1]);
        if (!level || n < level) { level = n; }
      });
      if (!level) return;
      var mark = "H" + level;

      /* Was VOR der ersten Ueberschrift steht, bleibt stehen: eine Einleitung
         gehoert in keinen Bereich - sie sagt ja gerade, wozu die Liste da ist. */
      var sections = [];
      var open = null;
      children.forEach(function (el) {
        if (el.tagName === mark) {
          open = { head: el, content: [] };
          sections.push(open);
        } else if (open) {
          open.content.push(el);
        }
      });
      /* Ein einzelner Bereich ist kein Akkordeon - dafuer gibt es
         `skr-fold`. Ohne diese Bremse baute das Skript eine Bedienung,
         die nichts zu waehlen hat. */
      if (sections.length < 2) return;

      sections.forEach(function (a, i) {
        var head = a.head;

        /* EINE LESBARE ID JE ABSCHNITT - sie ist der Anker, unter dem sich ein
           einzelner Bereich verlinken laesst. Eine vorhandene bleibt
           unangetastet: Sie steht womoeglich schon in einem Verweis. Kramdown
           vergibt sie ohnehin aus der Ueberschrift; der Zweig darunter greift
           nur, wenn eine Seite die automatischen IDs abgeschaltet hat. */
        if (!head.id) {
          var wish = (head.textContent || "").toLowerCase()
            .replace(/ä/g, "ae").replace(/ö/g, "oe")
            .replace(/ü/g, "ue").replace(/ß/g, "ss")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          head.id = (wish && !document.getElementById(wish))
            ? wish : ("skr-accordion-" + index + "-" + i);
        }

        /* ZWEI ELEMENTE, WEIL EINES NICHT REICHT: Der Bereich traegt die
           Gitterzeile (und damit die Bewegung), der Koerper darin `overflow`
           und den Innenabstand. Stuende beides auf einem Element, schnitte der
           Innenabstand die Zeile nie auf null - genau der Fehler, der im Burger
           zwoelf Pixel stehen liess. */
        var area = document.createElement("div");
        area.className = "skr-accordion__region";
        area.id = head.id + "-region";
        area.setAttribute("role", "region");
        area.setAttribute("aria-labelledby", head.id);

        var body = document.createElement("div");
        body.className = "skr-accordion__body";
        a.content.forEach(function (el) { body.appendChild(el); });
        area.appendChild(body);
        head.insertAdjacentElement("afterend", area);

        /* DIE UEBERSCHRIFT BLEIBT EINE UEBERSCHRIFT, der Knopf steht DARIN.
           So steht es in den ARIA Authoring Practices, und es ist der einzige
           Weg, der die Gliederung nicht opfert: Wer die Ueberschrift durch einen
           Knopf ersetzt, nimmt einer Vorlesehilfe die Sprungmarken der Seite. */
        var button = document.createElement("button");
        button.type = "button";
        button.className = "skr-accordion__toggle";
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", area.id);
        while (head.firstChild) { button.appendChild(head.firstChild); }
        head.appendChild(button);

        a.area = area;
        a.button = button;
      });

      /* Sichtbar halten, was gerade gewaehlt wurde. Der zweite Blick nach der
         Bewegung ist kein Aberglaube: Waehrend der 220 ms schrumpft der
         Nachbar, der vorher offen war - was jetzt im Bild steht, liegt danach
         womoeglich darueber. `nearest` ruehrt sich nicht, wenn nichts noetig
         ist, also kostet der zweite Aufruf im Regelfall gar nichts. */
      function keepVisible(el) {
        el.scrollIntoView({ block: "nearest" });
        window.setTimeout(function () { el.scrollIntoView({ block: "nearest" }); }, 260);
      }

      /* EXKLUSIV: Ein Akkordeon zeigt einen Bereich. Das ist der Zweck - eine
         lange Liste soll nicht doch wieder in ganzer Laenge dastehen. */
      function choose(target, opened, withMotion) {
        sections.forEach(function (a) {
          var now = (a === target) ? opened : false;
          a.button.setAttribute("aria-expanded", now ? "true" : "false");
          a.area.classList.toggle("is-open", now);
        });
        if (opened && withMotion) { keepVisible(target.button); }
      }

      sections.forEach(function (a) {
        a.button.addEventListener("click", function () {
          var wasActive = a.button.getAttribute("aria-expanded") === "true";
          choose(a, !wasActive, true);
          State.update();
        });

        /* EXKLUSIV wie die Reiter, nur dass hier auch ALLES zu sein darf. Die ID
           ist die der Ueberschrift - derselbe Anker, unter dem sich ein Bereich
           ohnehin verlinken laesst. */
        State.openable({
          id: a.head.id,
          exclusive: true,
          isOpen: function () { return a.button.getAttribute("aria-expanded") === "true"; },
          set: function (opened) { choose(a, opened, false); }
        });
      });

      /* PFEILTASTEN AUF DEN KOEPFEN. Ohne sie ist ein Akkordeon zwar bedienbar
         (jeder Kopf ist ein Knopf in der Tabulatorreihenfolge), aber man muss
         sich durch den Inhalt des offenen Bereichs tabben, um zum naechsten
         Kopf zu kommen. Links/rechts UND hoch/runter, weil beides erwartet
         wird: die Reihe der Koepfe liest sich waagerecht, die Seite laeuft
         senkrecht. */
      box.addEventListener("keydown", function (event) {
        var i = -1;
        sections.forEach(function (a, j) {
          if (a.button === document.activeElement) { i = j; }
        });
        if (i === -1) { return; }
        var target = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          target = (i + 1) % sections.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          target = (i - 1 + sections.length) % sections.length;
        } else if (event.key === "Home") { target = 0; }
        else if (event.key === "End") { target = sections.length - 1; }
        if (target === null) { return; }
        event.preventDefault();
        sections[target].button.focus();
        choose(sections[target], true, true);
        State.update();
      });

      /* TIEFE VERWEISE: `#…` auf einen Kopf oder auf etwas DARIN muss den
         Bereich aufklappen - sonst springt der Browser an eine Stelle, die
         gerade zu ist, und die Seite ruehrt sich nicht. Dieselbe Ueberlegung
         wie bei den Reitern, nur dass hier jeder Kasten seinen eigenen Zustand
         fuehrt und die Pruefung deshalb hier drin steht. */
      function fromHashValue() {
        var id = State.anchor();
        if (!id) { return; }
        var target = document.getElementById(id);
        if (!target) { return; }
        var matches = null;
        sections.forEach(function (a) {
          if (a.head === target || a.area.contains(target)) { matches = a; }
        });
        if (!matches) { return; }
        choose(matches, true, false);
        target.scrollIntoView();
      }
      window.addEventListener("hashchange", fromHashValue);

      box.classList.add("skr-accordion--enhanced");
      fromHashValue();
    });
  }

  /* --- Waagerecht scrollende Bereiche (Tabellen, Code) -------------------- */
  /* ZWEI DINGE AUF EINMAL, weil es dieselbe Ursache hat: Eine breite Tabelle
     schiebt auf einem schmalen Gerät die GANZE SEITE nach rechts (WCAG 1.4.10:
     bei 320 CSS-Pixeln darf nur der Inhalt scrollen, nicht das Dokument), und
     ein Bereich, den nur die Maus scrollen kann, ist per Tastatur unerreichbar
     (WCAG 2.1.1). Der Rahmen um die Tabelle löst das Erste, `tabindex` das
     Zweite. Gesetzt wird nur, was tatsächlich überläuft - eine schmale Tabelle
     bekommt keinen Haltepunkt in der Tabulatorreihenfolge, den niemand braucht. */
  function initScrollAreas() {
    var main = document.querySelector(".skr-guide-main, main");
    if (!main) return;

    main.querySelectorAll("table").forEach(function (tab) {
      if (tab.parentNode.classList &&
          tab.parentNode.classList.contains("skr-tablescroll")) return;
      var frame = document.createElement("div");
      frame.className = "skr-tablescroll";
      tab.parentNode.insertBefore(frame, tab);
      frame.appendChild(tab);
    });

    /* GESUCHT IST, WAS TATSAECHLICH SCROLLT - nicht, was danach aussieht. Beim
       Code sind es je nach Auszeichnung mal das `pre`, mal das `code` darin
       (highlight.css setzt `overflow-x: auto` auf `pre code.hljs`); wer nur
       eines von beiden nimmt, laesst die Haelfte unerreichbar. */
    /* SCHON EIN PIXEL ZÄHLT: Auch ein Block, der nur um einen Pixel überläuft, lässt sich
       scrollen – und die Messung der Barrierefreiheit verlangt dann den Haltepunkt. */
    function check(b) {
      var kind = window.getComputedStyle(b).overflowX;
      var scrolls = (kind === "auto" || kind === "scroll") && b.scrollWidth > b.clientWidth;
      if (scrolls) { b.setAttribute("tabindex", "0"); }
      else if (b.getAttribute("tabindex") === "0") { b.removeAttribute("tabindex"); }
    }
    var SELECTION = ".skr-tablescroll, .skr-walkthrough, pre, pre > code";
    var candidates = Array.prototype.slice.call(main.querySelectorAll(SELECTION));

    /* EINMAL MESSEN GENUEGT NICHT. Ob ein Block ueberlaeuft, steht erst fest, wenn
       Schrift UND Inhalt endgueltig sind - und die Syntaxhervorhebung baut den
       Inhalt danach noch einmal um: Sie ersetzt den Text durch ausgezeichnete
       Spannen, und die sind breiter. Gemessen davor, fehlte dem Codeblock der
       Haltepunkt in der Tabulatorreihenfolge - und der Befund tauchte je nach
       Rechnertempo mal auf und mal nicht.
       `ResizeObserver` beendet das Raten: Er meldet JEDE Groessenaenderung - die
       Hervorhebung, den Schriftwechsel, das Fenster. Wo es ihn nicht gibt, bleibt
       es beim einmaligen Messen und einem Blick nach dem Schriftwechsel. */
    var observer = window.ResizeObserver ? new ResizeObserver(function (entries) {
      entries.forEach(function (e) { check(e.target); });
    }) : null;
    function add(list) {
      list.forEach(function (b) { if (observer) { observer.observe(b); } check(b); });
    }
    add(candidates);
    if (!observer) {
      var remeasure = function () { candidates.forEach(check); };
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(remeasure); }
      var t = null;
      window.addEventListener("resize", function () {
        window.clearTimeout(t); t = window.setTimeout(remeasure, 150);
      });
    }

    /* SPAETER EINGEHAENGTER INHALT. Was ein Baustein erst im Browser baut – etwa
       eine Karte mit geklontem Code –, meldet er mit dem
       Ereignis `skr-content-added` an seinem neuen Teilbaum. Dieselbe
       Pruefung greift dann auch dort; die Regel steht nur hier. */
    document.addEventListener("skr-content-added", function (e) {
      var root = e.target;
      if (!root || !root.querySelectorAll) return;
      var fresh = Array.prototype.slice.call(root.querySelectorAll(SELECTION));
      if (root.matches && root.matches(SELECTION)) fresh.unshift(root);
      candidates = candidates.concat(fresh);
      add(fresh);
    });
  }

  /* --- Permalinks ---------------------------------------------------------
     Die kurze, gleichbleibende Adresse einer Seite. Sie steht nur in der
     Betriebsart `light` im Kopf der Seite - in `full` IST die Adresszeile
     bereits der Permalink, und ein zweiter Ort dafuer waere eine zweite
     Wahrheit.

     ABSOLUT WIRD SIE ERST HIER: Eine Site ohne `site.url` kennt beim Bauen
     ihren eigenen Ursprung nicht. Der Browser kennt ihn immer. */
  function permalinkHref() {
    var meta = document.querySelector('meta[name="skr-permalink"]');
    if (!meta || !meta.content) return null;
    try {
      return new URL(meta.content, location.href).href;
    } catch (e) {
      return null;
    }
  }

  /* ADRESSE KOPIEREN - das Kettensymbol in der Werkzeugleiste.
     Hat die Seite einen Permalink, kopiert er den; sonst die aktuelle Adresse.
     Ein Knopf, der mal da ist und mal nicht, liesse den Benutzer raten, ob er
     etwas falsch macht.

     ZUM ABLAGEFACH geht es ueber `copyText` - denselben Weg wie bei den
     Code-Bloecken und bei "Markdown kopieren". */
  function initAddressCopy() {
    var buttons = document.querySelectorAll("[data-skr-copy]");
    if (!buttons.length) return;

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var own = button.getAttribute("data-skr-copy");
        var text = (own && new URL(own, location.href).href) || permalinkHref() || location.href;
        copyText(text).then(function () {
          /* KURZE RUECKMELDUNG, und zwar auch fuer eine Vorlesehilfe: Ohne
             `aria-live` bliebe der Vorgang fuer sie stumm - der Knopf saehe
             aus, als haette er nichts getan. */
          var before = button.innerHTML;
          var title = button.getAttribute("title");
          var finished = button.getAttribute("data-skr-copy-done") || "";
          button.textContent = "";
          button.appendChild(glyph("check"));
          button.setAttribute("title", finished);
          button.setAttribute("aria-label", finished);
          setTimeout(function () {
            button.innerHTML = before;
            button.setAttribute("title", title);
            button.setAttribute("aria-label", title);
          }, 1500);
        }, function () {
          /* Nichts vorgaukeln: Schlaegt das Ablegen fehl, bleibt der Knopf, wie
             er war. Eine falsche Erfolgsmeldung ist schlimmer als keine. */
        });
      });
    });
  }


  /* --- Client-API `skr` (= `skriptorium`) ------------------------------------
     Fuer die Fehleranalyse am Endprodukt und fuer schmale Steuerung von aussen
     (Konsole, Automatisierung, Screenshots). EXPERIMENTELL bis auf `buildInfo`:
     Die Steuerung darf sich mit einer Minor aendern. Der Namensraum, das Register der
     Extensions (`skr.ext`) und die Schranke fuer `client_api` stehen in skr.js.

     JEDE STEUERUNG NIMMT DEN WEG DER OBERFLAECHE. Das Farbschema geht ueber
     denselben Weg wie der Schalter, die Suche ueber ihren Schalter und ihr Feld,
     die Praesentation ueber die Folienadresse `#/n` und ihre Knoepfe. Sonst
     steuerte die API etwas anderes, als ein Mensch erlebt.

     `buildInfo` liest den Datenblock, den der Bau in den <head> schreibt
     (build-info.html), dazu die Effekte der Seite vom <html>. Nur lesbar. */
  function freeze(o) {
    if (o && typeof o === "object") {
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
      Object.freeze(o);
    }
    return o;
  }

  function buildInfo() {
    var data = {};
    var block = document.getElementById("skr-build-info");
    if (block) { try { data = JSON.parse(block.textContent) || {}; } catch (e) { data = {}; } }
    var fx = document.documentElement.getAttribute("data-skr-effects") || "";
    return freeze({
      skriptorium: data.skriptorium || null,
      theme: data.theme || null,
      audience: data.audience === undefined ? null : data.audience,
      languages: data.languages || [],
      themes: data.themes || [],
      extensions: data.extensions || [],
      internal: data.internal === true,
      effects: fx.split(/\s+/).filter(Boolean)
    });
  }

  function colorScheme(choice) {
    var root = document.documentElement;
    if (arguments.length === 0) {
      var set = root.getAttribute("data-skr-theme");
      return set === "dark" || set === "light" ? set : "auto";
    }
    if (choice !== "dark" && choice !== "light" && choice !== "auto") {
      throw new TypeError('skr.colorScheme: "dark", "light" oder "auto" erwartet');
    }
    if (ColorScheme.choose) ColorScheme.choose(choice === "auto" ? null : choice);
    return choice;
  }

  /* Oeffnet die Suche (wie ihr Schalter) und setzt den Begriff (wie Tippen).
     false, wenn die Seite keine Suche hat. */
  function search(term) {
    var root = document.querySelector("[data-skr-search]");
    var dialog = root && root.querySelector("dialog");
    var switches = root && root.querySelector("[data-skr-search-toggle]");
    if (!dialog || !switches) return false;
    if (!dialog.open) switches.click();
    var field = dialog.querySelector("input");
    if (field && term !== undefined && term !== null) {
      field.value = String(term);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return true;
  }

  /* Nur in einer Praesentation; sonst null. Gezaehlt wird ab 1, wie in der Adresse. */
  function presentation() {
    if (!document.querySelector("[data-skr-present]")) return null;
    function slides() { return document.querySelectorAll(".skr-deck__track > .skr-slide").length; }
    function current() {
      var m = /^#\/(\d+)$/.exec(location.hash || "");
      return m ? parseInt(m[1], 10) : 1;
    }
    function button(name) {
      var k = document.querySelector("[data-skr-present-" + name + "]");
      if (k && !k.disabled) k.click();
    }
    return Object.freeze({
      count: slides,
      current: current,
      goTo: function (n) {
        var number = Math.round(Number(n));
        if (!isFinite(number)) throw new TypeError("skr.presentation.goTo: Foliennummer erwartet");
        location.hash = "#/" + Math.max(1, Math.min(slides() || 1, number));
      },
      next: function () { button("next"); },
      prev: function () { button("prev"); }
    });
  }

  /* RUHIGER ZUSTAND fuer Screenshots: keine Animationen und Uebergaenge
     (components.css, `[data-skr-motion-frozen]`), danach warten, bis Schriften und
     Bilder da sind und zwei Bilder gemalt wurden. `freezeMotion(false)` gibt frei. */
  function freezeMotion(on) {
    var root = document.documentElement;
    if (on === false) { root.removeAttribute("data-skr-motion-frozen"); return Promise.resolve(); }
    root.setAttribute("data-skr-motion-frozen", "");
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var images = Array.prototype.map.call(document.images, function (img) {
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    });
    return Promise.all([fonts].concat(images)).then(function () {
      return new Promise(function (finished) {
        window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { finished(); }); });
      });
    });
  }

  /* Oeffnet das Popup des QR-Codes wie ein Klick auf den Knopf; `qrCode(false)`
     schliesst es. false, wenn die Seite keinen QR-Code hat (oder er noch nicht
     fertig ist). */
  function qrCode(on) {
    if (on === false) return QrPopup.close ? QrPopup.close() : false;
    return QrPopup.open ? QrPopup.open() : false;
  }

  /* --- Sprachen, Seiten, Navigation (Client-API) ------------------------------
     Die aktuelle Seite nennt sich im <head> (`#skr-page-info`: Kennung,
     Sprache, Layout, Titel, Standardsprache, Adresse des Verzeichnisses). Alles
     Uebrige – TopNav, Seiten anderer Kennung oder Sprache – steht im
     Seitenverzeichnis `/skriptorium/site.json` (search-index.html), das erst bei der ersten
     Frage geladen wird. Gezaehlt und benannt wird mit Sprachcodes (`de`, `en`). */
  function pageBlock() {
    var block = document.getElementById("skr-page-info");
    if (!block) return {};
    try { return JSON.parse(block.textContent) || {}; } catch (e) { return {}; }
  }
  /* ADRESSEN AB DER WURZEL DER SITE (`/kapitel/seite.html`, so in Seitenblock und
     Seitenverzeichnis) werden absolut gegen die Wurzel, unter der die Site gerade läuft
     (skr._root). Web-Adressen bleiben, wie sie sind. */
  function absolute(u) {
    if (typeof u !== "string" || !/^\/(?!\/)/.test(u)) return u || null;
    try { return new URL(u.slice(1), window.skr._root()).href; } catch (e) { return u; }
  }
  var directory = null;
  function pageDirectory() {
    if (!directory) {
      var address = absolute(pageBlock().siteIndex);
      directory = address
        ? fetch(address).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
        : Promise.resolve(null);
    }
    return directory;
  }
  function currentLanguage() { return pageBlock().language || null; }

  /* EIN SEITENOBJEKT, EINE FORM: `currentPage` und `findPage()` liefern dasselbe. */
  function pageObject(slug, language, s, languages) {
    return freeze({
      pageId: slug || null, language: language || null, url: absolute(s.url),
      title: s.title || null, layout: s.layout || null,
      description: s.description === undefined ? null : s.description,
      duration: s.duration === undefined ? null : s.duration,
      topics: Array.isArray(s.topics) ? s.topics.slice() : [],
      languages: (languages || []).slice()
    });
  }

  /* Seite nach Kennung und Sprache (Vorgabe: die aktuelle). null, wenn es sie nicht gibt. */
  function findPage(index, slug, language) {
    var per = index && index.pages && index.pages[slug];
    if (!per || !per[language]) return null;
    return pageObject(slug, language, per[language],
      (index.languages || []).filter(function (c) { return !!per[c]; }));
  }

  function pageInfo(slug, language) {
    var here = pageBlock();
    slug = slug || here.pageId;
    language = language || here.language;
    if (!slug) return Promise.resolve(null);
    return pageDirectory().then(function (index) { return findPage(index, slug, language); });
  }

  /* TopNav als Baum: `title`/`url` in der aktuellen Sprache, `titles`/`urls` je Sprache. */
  function navigation() {
    var language = currentLanguage();
    return pageDirectory().then(function (index) {
      if (!index) return [];
      function nodes(k) {
        var urls = null;
        if (k.urls) {
          urls = {};
          Object.keys(k.urls).forEach(function (l) { urls[l] = absolute(k.urls[l]); });
        }
        var n = { title: k.titles[language] || "", url: urls ? urls[language] || null : null,
                  pageId: k.pageId || null, titles: k.titles, urls: urls };
        if (k.children) n.children = k.children.map(nodes);
        return n;
      }
      return freeze(index.nav.map(nodes));
    });
  }

  function go(address) { location.assign(address); return true; }

  /* Zur Seite mit dieser Kennung – in der aktuellen oder der genannten Sprache.
     false, wenn es sie dort nicht gibt; es wird nicht auf eine andere Sprache ausgewichen. */
  function goTo(slug, language) {
    return pageInfo(slug, language || currentLanguage()).then(function (s) {
      return s ? go(s.url) : false;
    });
  }

  /* Dieselbe Seite in einer anderen Sprache – ueber die `hreflang`-Verweise im <head>,
     dieselbe Quelle wie der Sprachumschalter. null heisst Standardsprache. */
  function switchLanguage(language) {
    var target = language || pageBlock().defaultLanguage;
    var link = document.querySelector('link[rel="alternate"][hreflang="' + String(target).replace(/"/g, "") + '"]');
    if (!link) return false;
    return go(link.getAttribute("href"));
  }

  /* SCHALTER `client_api` (skr.js): `off` – keine Bauauskunft, keine Steuerung;
     `readonly` – Steuerndes wirft ueber `skr._guard`; `full` – alles. */
  function initClientApi() {
    var skr = window.skr;
    if (!skr || !document.getElementById("skr-build-info") || skr._mode() === "off" || "buildInfo" in skr) return;
    var g = skr._guard;
    var slides = presentation();
    if (slides) {
      slides = Object.freeze({
        count: slides.count, current: slides.current,
        goTo: g("presentation.goTo", slides.goTo), next: g("presentation.next", slides.next),
        prev: g("presentation.prev", slides.prev)
      });
    }
    var api = {
      buildInfo: buildInfo(),
      /* Lesen geht immer, Setzen nur bei `full`. */
      colorScheme: function () {
        if (arguments.length) return g("colorScheme", colorScheme).apply(null, arguments);
        return colorScheme();
      },
      search: g("search", search),
      qrCode: g("qrCode", qrCode),
      currentLanguage: (function () { var b = pageBlock(); return b.language && b.language !== b.defaultLanguage ? b.language : null; })(),
      supportedLanguages: freeze((buildInfo().languages || []).slice()),
      defaultLanguage: pageBlock().defaultLanguage || null,
      currentPage: (function () { var b = pageBlock(); return pageObject(b.pageId, b.language, b, b.languages); })(),
      findPage: pageInfo,
      navItems: navigation,
      goToPage: g("goToPage", goTo),
      switchLanguage: g("switchLanguage", switchLanguage),
      presentation: slides,
      freezeMotion: g("freezeMotion", freezeMotion)
    };
    Object.keys(api).forEach(function (k) { Object.defineProperty(skr, k, { value: api[k], enumerable: true }); });
  }

  function init() {
    initBackButtons();
    initThemeToggle();
    initCopyButtons();
    initNavToggle();
    initNavDropdown();
    initRoles();
    initNavLayout();
    initCopyMarkdown();
    initPrintButtons();
    initTabs();
    initAccordion();
    initPageQr();
    initAddressCopy();
    initTaskLists();
    initScrollAreas();
    initGuideToc();
    /* NACH dem Verzeichnis - vorher steht nicht fest, ob der rechte Bereich etwas
       zeigt. Legt eine Extension spaeter eine Karte an oder blendet sie um, meldet
       skr.js das mit `skr-sidebar-changed`. */
    initSidebarEmpty();
    document.addEventListener("skr-sidebar-changed", initSidebarEmpty);
    initReveals();
    initFolds();
    initClientApi();

    /* ZULETZT, und in dieser Reihenfolge: Erst wenn ALLE Bausteine angemeldet
       sind, steht der Ausgangszustand des Dokuments fest - und erst dann laesst
       sich sagen, was in der Adresse ueberhaupt eine Abweichung ist. `ready()`
       gibt das Schreiben frei; davor waere jede Anmeldung ein Schreibanlass. */
    State.restore();
    State.ready();
    window.addEventListener("hashchange", function () { State.restore(); });
  }

  /* Beim `DOMContentLoaded`, vor den Funktionen der Extensions (`skr.ready`, skr.js). */
  if (window.skr && window.skr._ready) {
    window.skr._ready(init);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
