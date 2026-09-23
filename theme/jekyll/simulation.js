/* =============================================================================
   Layout „simulation“ – Miniframework (ATVANTAGE Academy)
   -----------------------------------------------------------------------------
   Macht aus einer Seite mit `layout: simulation` einen abspielbaren Ablauf.
   Abhängigkeitsfrei, kein Build, kein CDN.

   GRUNDIDEE: DEKLARATIVE SCHRITTE
   Ein Schritt beschreibt NICHT „was passiert“, sondern „was gilt danach“. Das
   Framework baut den Zustand bei jedem Wechsel von vorn auf:

       Zustand = Ausgangslage;  für i = 0..aktuell:  schritt[i].apply(Zustand)

   Danach zeichnet EINE Funktion – `render(zustand, ctx)` – die Bühne. Weil der
   Zustand jedes Mal neu entsteht, funktionieren Vor, Zurück, Springen und Reset
   ohne Zutun: Es gibt keine Rückwärts-Logik, die man vergessen könnte.

   Preis: `apply` darf NUR den Zustand verändern (keine DOM-Zugriffe, keine
   Timer) – es läuft beim Zurückspringen erneut. Alles Sichtbare gehört in
   `render`.

   BENUTZUNG (Inline-<script> am Ende des Bühnenbilds):

       AvdSimulation.setup({
         state:  () => ({ kisten: [] }),          // Ausgangslage (Funktion oder Objekt)
         render: (s, ctx) => { … }                // zeichnet die Bühne
       });

       AvdSimulation.registerStep({
         title: "Erste Kiste",                    // Überschrift der Erklärspalte
         text:  "Die Kiste entsteht auf dem …",   // HTML oder Funktion (s) => HTML
         apply: (s) => { s.kisten.push({ id: "k1" }); },
         duration: 3000                           // optional: eigene Standzeit (ms)
       });

   FELDNAMEN SIND ENGLISCH – ausnahmslos. Bis 2.0 nahm dieses Skript jeden
   Schlüssel auch deutsch (`titel`, `dauer`, `kennung`, `schritte`, `zustand`,
   `zeichne`), damit „gemischte Bestände nicht an einer Vokabel scheitern“. Genau
   das war das Problem: Zwei Namen für dasselbe Feld sind zwei Wartungsorte, und
   niemand konnte sagen, welcher der richtige ist.

   HELFER
     AvdSimulation.list(container, items, {key, create, update})
         Gleicht eine Liste von Elementen mit dem DOM ab (Schlüssel statt
         innerHTML). Nur so können neue Kästen einfliegen und alte ausblenden –
         mit innerHTML entstünde bei jedem Schritt alles neu und nichts bewegte
         sich.
     AvdSimulation.pulse(el)    kurzes Hervorheben (Klasse `is-pulse`)
     AvdSimulation.on(name, fn) "step" nach jedem Wechsel

   OHNE DIESES SKRIPT bleibt die Kulisse als statische Seite stehen.
   ============================================================================= */
(function () {
  "use strict";

  /* --- Beschriftungen, die erst im Browser entstehen -----------------------
     Die Steuerleiste beschriftet Liquid beim Bauen (avd-i18n.html). Diese Texte
     nicht: Sie wechseln zur Laufzeit (Abspielen/Pause) oder gehören zu Elementen,
     die dieses Skript selbst erzeugt (die Reiter der Szenarien).

     GELESEN WIRD `<html lang>` – gesetzt vom Layout aus der Sprache der Seite.
     Unbekannte Sprache fällt auf Deutsch zurück. */
  var TEXTE = {
    de: { abspielen: "Abspielen", pause: "Pause", leertaste: "Leertaste",
          uebersicht: "Übersicht", alleSzenarien: "Alle Szenarien", szenario: "Szenario",
          taste: "Taste" },
    en: { abspielen: "Play",      pause: "Pause", leertaste: "space",
          uebersicht: "Overview", alleSzenarien: "All scenarios", szenario: "Scenario",
          taste: "key" }
  };
  var T = TEXTE[(document.documentElement.getAttribute("lang") || "de").split("-")[0].toLowerCase()] || TEXTE.de;

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TEMPI = [0.5, 1, 2, 5];

  /* --- Zustand des Frameworks ----------------------------------------------
     Eine Simulation besteht aus einem oder mehreren SZENARIEN. Jedes bringt
     eigene Schritte mit und darf eigene Ausgangslage/Zeichenfunktion haben;
     fehlen sie, gelten die aus `setup()`.

     Der EINFACHE FALL bleibt unangetastet: Wer nur `registerStep` ruft, bekommt
     ein unbenanntes Szenario, keine Reiter und keine Übersicht – genau wie
     bisher. Erst `registerScenario` schaltet beides frei. */
  var szenarien = [];
  var szIndex = 0;
  var uebersicht = false;
  var opts = { state: null, render: null };
  var index = 0;
  var tempoIdx = 0;
  var grunddauer = 2500;
  var playing = false;
  var timer = null;
  var started = false;
  var hoerer = {};

  var el = {};   // gecachte Bedienelemente, gefüllt in start()

  /* --- Kleinkram ------------------------------------------------------------ */
  function q(name) { return document.querySelector("[data-avd-academy-sim-" + name + "]"); }

  /* Das Szenario, in dem wir gerade stecken – und seine Schritte. Alles unten
     rechnet gegen diese beiden, nie gegen eine globale Schrittliste. */
  function szenario() { return szenarien[szIndex] || { steps: [] }; }
  function steps() { return szenario().steps || []; }
  function mehrere() { return szenarien.length > 1; }

  /* Ein unbenanntes Szenario für den einfachen Fall (`registerStep` ohne
     `registerScenario`). Es taucht in keiner Leiste auf. */
  function standardSzenario() {
    if (!szenarien.length) szenarien.push({ id: "", titel: "", steps: [] });
    return szenarien[0];
  }

  function klon(v) {
    if (v === null || typeof v !== "object") return v;
    if (typeof structuredClone === "function") {
      try { return structuredClone(v); } catch (e) { /* Funktionen im Zustand – s. u. */ }
    }
    return JSON.parse(JSON.stringify(v));
  }

  function feld(obj, name, fallback) {
    /* Ein Feld lesen, mit Vorgabe. EIN Name, nicht zwei: Die deutschen Zweitnamen
       sind mit 2.0 entfallen (siehe Kopf). */
    return obj[name] !== undefined ? obj[name] : fallback;
  }

  function melde(name, daten) {
    (hoerer[name] || []).forEach(function (fn) { fn(daten); });
  }

  /* --- Ausgangslage + Wiederaufbau ------------------------------------------
     Der Zustand entsteht bei JEDEM Wechsel neu. `state` darf eine Funktion sein
     (empfohlen – sie liefert garantiert eine frische Struktur) oder ein Objekt,
     das dann geklont wird. */
  function ausgangslage() {
    // Das Szenario darf eine eigene Ausgangslage mitbringen; sonst die aus setup().
    var quelle = szenario().state !== undefined ? szenario().state : opts.state;
    if (typeof quelle === "function") return quelle();
    if (quelle && typeof quelle === "object") return klon(quelle);
    return {};
  }

  function zeichner() {
    return szenario().render !== undefined ? szenario().render : opts.render;
  }

  function baue(bis) {
    var s = ausgangslage();
    var liste = steps();
    for (var i = 0; i <= bis && i < liste.length; i++) {
      var apply = feld(liste[i], "apply", null);
      if (typeof apply === "function") apply(s, { index: i, schritt: liste[i] });
    }
    return s;
  }

  /* --- Anzeige --------------------------------------------------------------- */
  function zeichne(vorher, richtung) {
    // Auf der Übersicht gibt es keinen Schritt zu zeichnen – nur die Reiter und
    // die Adresse wollen nachgezogen werden.
    if (uebersicht) {
      ansichtWechseln();
      reiterZeichnen();
      // Auf der Übersicht gibt es keinen Schritt – also auch nichts zu erklären
      // und nichts abzuspielen. Zähler, Fortschritt und Erklärspalte treten ab.
      if (el.root) el.root.setAttribute("data-uebersicht", "");
      if (el.counter) el.counter.textContent = szenarien.length + " Szenarien";
      if (el.progress) el.progress.style.width = "0";
      if (el.prev) el.prev.disabled = true;
      if (el.next) el.next.disabled = false;
      if (el.reset) el.reset.disabled = true;
      hash();
      return;
    }
    if (el.root) el.root.removeAttribute("data-uebersicht");

    var liste = steps();
    var schritt = liste[index] || {};
    var animiert = !REDUCED && richtung !== 0 && Math.abs(index - vorher) === 1;
    var zustand = baue(index);

    /* DER KONTEXT IST DIE AUTORENSCHNITTSTELLE – deshalb englische Namen, auch wenn
       die Variablen darunter deutsch heissen. Er wird an `render` und `apply`
       uebergeben; jeder Name darin steht im fremden Simulationsskript. */
    var ctx = {
      index: index,
      previous: vorher,
      direction: richtung,
      animated: animiert,
      step: schritt,
      count: liste.length,
      scenario: szenario().id || null,
      scenarioIndex: szIndex,
      stage: el.stage,
      sim: API
    };

    /* Auch ohne eigene `render`-Funktion nutzbar: Schrittnummer und Kennung
       stehen als data-Attribute auf der Bühne, sodass eine Simulation allein
       mit CSS-Regeln (`[data-step="3"] .paket { … }`) auskommen kann. */
    ansichtWechseln();

    if (el.stage) {
      el.stage.setAttribute("data-step", String(index + 1));
      if (szenario().id) el.stage.setAttribute("data-szenario", szenario().id);
      else el.stage.removeAttribute("data-szenario");
      el.stage.setAttribute("data-direction", richtung > 0 ? "forward" : richtung < 0 ? "back" : "start");
      var kennung = feld(schritt, "id", "");
      if (kennung) el.stage.setAttribute("data-step-id", kennung);
      else el.stage.removeAttribute("data-step-id");
    }

    var render = zeichner();
    if (typeof render === "function") render(zustand, ctx);

    // Erklärspalte
    var titel = feld(schritt, "title", "");
    var text = feld(schritt, "text", "");
    if (typeof text === "function") text = text(zustand, ctx);
    if (el.noteTitle) {
      el.noteTitle.textContent = titel || "";
      el.noteTitle.hidden = !titel;
    }
    if (el.note) el.note.innerHTML = text || "";

    // Kopfleiste, Fortschritt, Knöpfe
    if (el.counter) {
      var zaehler = liste.length ? "Schritt " + (index + 1) + " / " + liste.length : "";
      // Bei mehreren Szenarien steht davor, in welchem man ist – ohne das wäre
      // „Schritt 3 / 8“ auf einer Seite mit vier Abläufen mehrdeutig.
      if (zaehler && mehrere()) zaehler = szenario().titel + " · " + zaehler;
      el.counter.textContent = zaehler;
    }
    if (el.progress) el.progress.style.width = liste.length ? ((index + 1) / liste.length) * 100 + "%" : "0";
    if (el.prev) el.prev.disabled = index === 0;
    if (el.next) el.next.disabled = index >= liste.length - 1;
    if (el.reset) el.reset.disabled = index === 0 && !playing;

    reiterZeichnen();
    ostZeichnen();
    hash();
    melde("step", ctx);
  }

  /* Die aktuelle Schrittnummer steht im Fragment (#/3) – reload-fest und
     verlinkbar. `replaceState` löst kein `hashchange` aus; der QR-Code der
     Seitenadresse (theme/academy/atvantage.js) hört deshalb zusätzlich auf das
     eigene Ereignis `avd-academy-urlchange` und zeigt so stets auf den Schritt,
     der gerade an der Wand steht. */
  function hash() {
    var h;
    if (uebersicht) h = "#/uebersicht";
    else if (mehrere() && szenario().id) h = "#/" + szenario().id + "/" + (index + 1);
    else h = "#/" + (index + 1);
    if (location.hash !== h) {
      history.replaceState(null, "", h);
      window.dispatchEvent(new CustomEvent("avd-academy-urlchange"));
    }
  }

  /* Erlaubte Formen: `#/3` (eine Simulation ohne Szenarien), `#/«id»/3` und
     `#/uebersicht`. Die Kennung statt einer Nummer, damit ein Verweis aus dem
     Regiebuch das Umsortieren der Szenarien überlebt. */
  function ausHash() {
    var h = location.hash || "";
    if (/^#\/uebersicht\/?$/.test(h)) {
      if (mehrere()) { uebersicht = true; return; }
    }
    var m = /^#\/([A-Za-z0-9_-]+)\/(\d+)$/.exec(h);
    if (m) {
      var treffer = -1;
      for (var i = 0; i < szenarien.length; i++) if (szenarien[i].id === m[1]) treffer = i;
      if (treffer >= 0) {
        szIndex = treffer;
        uebersicht = false;
        index = grenze(parseInt(m[2], 10) - 1);
      }
      return;
    }
    m = /^#\/(\d+)$/.exec(h);
    if (m) {
      uebersicht = false;
      index = grenze(parseInt(m[1], 10) - 1);
    }
  }

  function grenze(n) {
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(steps().length - 1, n));
  }

  /* --- Ablaufsteuerung ------------------------------------------------------- */
  function go(ziel) {
    var neu = grenze(ziel);
    var vorher = index;
    var kamVonUebersicht = uebersicht;
    uebersicht = false;
    index = neu;
    // Aus der Übersicht heraus wird nicht animiert – dort war vorher nichts,
    // was sich verändern könnte.
    zeichne(kamVonUebersicht ? neu : vorher, kamVonUebersicht ? 0 : neu === vorher ? 0 : neu > vorher ? 1 : -1);
  }

  function next() {
    if (uebersicht) { go(0); return true; }
    if (index >= steps().length - 1) { pause(); return false; }
    go(index + 1);
    return true;
  }

  function prev() { go(index - 1); }

  function reset() {
    pause();
    var vorher = index;
    uebersicht = false;
    index = 0;
    // Immer neu zeichnen, auch wenn schon Schritt 1 lief: „Reset“ soll die Bühne
    // sichtbar in den Anfangszustand zurückversetzen, nicht bloß nichts tun.
    zeichne(vorher, vorher > 0 ? -1 : 0);
  }

  function dauer() {
    var s = steps()[index];
    var eigen = s ? feld(s, "duration", null) : null;
    var ms = (typeof eigen === "number" ? eigen : grunddauer) / TEMPI[tempoIdx];
    return Math.max(150, ms);
  }

  function plane() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(function () {
      if (!playing) return;
      if (next()) plane();
    }, dauer());
  }

  function play() {
    if (uebersicht) go(0);
    if (!steps().length) return;
    // Am Ende beginnt „Abspielen“ wieder von vorn – sonst passierte gar nichts.
    if (index >= steps().length - 1) go(0);
    playing = true;
    playKnopf();
    plane();
  }

  function pause() {
    playing = false;
    clearTimeout(timer);
    playKnopf();
  }

  function toggle() { playing ? pause() : play(); }

  function playKnopf() {
    if (el.playIcon) el.playIcon.textContent = playing ? "⏸" : "▶";
    if (el.playText) el.playText.textContent = playing ? T.pause : T.abspielen;
    if (el.play) {
      el.play.setAttribute("aria-label", playing ? T.pause : T.abspielen);
      el.play.setAttribute("title", (playing ? T.pause : T.abspielen) + " (" + T.leertaste + ")");
      el.play.classList.toggle("is-laeuft", playing);
    }
    if (el.reset) el.reset.disabled = index === 0 && !playing;
  }

  /* --- Tempo ----------------------------------------------------------------
     Ohne Argument: das nächste Tempo (Taste T). Mit Argument: genau dieses.
     `1` ist die Voreinstellung – auf sie fällt jede unbekannte Angabe zurück. */
  function tempo(stufe) {
    if (stufe !== undefined) {
      var i = TEMPI.indexOf(Number(stufe));
      tempoIdx = i < 0 ? TEMPI.indexOf(1) : i;
    } else {
      tempoIdx = (tempoIdx + 1) % TEMPI.length;
    }
    var wert = TEMPI[tempoIdx];
    if (el.tempoLabel) el.tempoLabel.textContent = beschriftung(wert);
    if (el.tempoMenu) {
      Array.prototype.forEach.call(
        el.tempoMenu.querySelectorAll("[data-avd-academy-sim-speed-value]"),
        function (b) {
          var an = Number(b.getAttribute("data-avd-academy-sim-speed-value")) === wert;
          b.setAttribute("aria-checked", an ? "true" : "false");
          b.classList.toggle("is-active", an);
        }
      );
    }
    if (playing) plane();          // laufendes Abspielen sofort auf neues Tempo
    return wert;
  }

  // Im Deutschen trennt das Komma die Nachkommastelle – „0.5×“ wäre ein Anglizismus
  // in einer Leiste, die sonst durchweg deutsch beschriftet ist.
  function beschriftung(wert) {
    return String(wert).replace(".", ",") + "×";
  }

  /* --- Tempo-Menü ------------------------------------------------------------
     Klappt nach OBEN auf: Die Steuerleiste sitzt am unteren Rand, nach unten wäre
     kein Platz. Es schließt bei Auswahl, bei Escape, beim Klick daneben und beim
     Verlassen per Tabulator – ein Menü, das offen stehen bleibt, verdeckt die
     Bühne. */
  function menuOffen() {
    return !!(el.tempoMenu && !el.tempoMenu.hasAttribute("hidden"));
  }

  function menuZeigen(an) {
    if (!el.tempoMenu || !el.tempo) return;
    if (an) el.tempoMenu.removeAttribute("hidden");
    else el.tempoMenu.setAttribute("hidden", "");
    el.tempo.setAttribute("aria-expanded", an ? "true" : "false");
    if (an) {
      var aktiv = el.tempoMenu.querySelector("[aria-checked='true']") ||
                  el.tempoMenu.querySelector("[data-avd-academy-sim-speed-value]");
      if (aktiv) aktiv.focus();
    }
  }

  function menuSchliessen(zurueckZumKnopf) {
    if (!menuOffen()) return;
    menuZeigen(false);
    if (zurueckZumKnopf && el.tempo) el.tempo.focus();
  }

  function menuVerdrahten() {
    if (!el.tempo || !el.tempoMenu) return;
    var eintraege = Array.prototype.slice.call(
      el.tempoMenu.querySelectorAll("[data-avd-academy-sim-speed-value]"));

    el.tempo.addEventListener("click", function (e) {
      e.stopPropagation();
      menuZeigen(!menuOffen());
    });

    eintraege.forEach(function (b, i) {
      b.addEventListener("click", function () {
        tempo(b.getAttribute("data-avd-academy-sim-speed-value"));
        menuSchliessen(true);
        // Ein Tempo zu wählen heißt: so abspielen. Sonst wäre jede Wahl zwei
        // Klicks weit von dem entfernt, weswegen man sie getroffen hat.
        if (!playing) play();
      });
      b.addEventListener("keydown", function (e) {
        var ziel = null;
        if (e.key === "ArrowDown") ziel = eintraege[(i + 1) % eintraege.length];
        else if (e.key === "ArrowUp") ziel = eintraege[(i - 1 + eintraege.length) % eintraege.length];
        else if (e.key === "Home") ziel = eintraege[0];
        else if (e.key === "End") ziel = eintraege[eintraege.length - 1];
        else if (e.key === "Escape") { menuSchliessen(true); e.preventDefault(); return; }
        else return;
        if (ziel) { ziel.focus(); e.preventDefault(); }
      });
    });

    document.addEventListener("click", function (e) {
      if (!menuOffen()) return;
      if (el.playGroup && el.playGroup.contains(e.target)) return;
      menuSchliessen(false);
    });
    document.addEventListener("focusin", function (e) {
      if (!menuOffen()) return;
      if (el.playGroup && el.playGroup.contains(e.target)) return;
      menuSchliessen(false);
    });
  }

  function vollbild() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }

  /* --- Listen-Abgleich -------------------------------------------------------
     Der Kern jeder Bewegung. `innerHTML = …` erzeugt bei jedem Schritt frische
     Elemente – der Browser sieht nichts, das sich verändert, und animiert nichts.
     Hier bleiben bestehende Knoten erhalten (Übergänge greifen), neue kommen mit
     `is-new` hinzu (Einblend-Animation) und verschwundene gehen mit `is-gone`. */
  function list(container, items, cfg) {
    if (!container) return [];
    cfg = cfg || {};
    var animiert = cfg.animated !== undefined ? cfg.animated : !REDUCED;
    var key = cfg.key || function (item, i) { return item && item.id !== undefined ? item.id : i; };

    var vorhanden = {};
    Array.prototype.forEach.call(container.children, function (node) {
      var k = node.getAttribute("data-sim-key");
      // Knoten, die gerade ausblenden, zählen nicht mehr mit: Sonst würde ein
      // Element, das im selben Schritt neu entsteht, den sterbenden wiederbeleben.
      if (k !== null && !node.hasAttribute("data-sim-gone")) vorhanden[k] = node;
    });

    var ergebnis = [];
    (items || []).forEach(function (item, i) {
      var k = String(key(item, i));
      var node = vorhanden[k];
      if (node) {
        delete vorhanden[k];
        node.classList.remove("is-new");
      } else {
        node = cfg.create ? cfg.create(item, i) : document.createElement("div");
        node.setAttribute("data-sim-key", k);
        if (animiert) node.classList.add("is-new");
      }
      if (cfg.update) cfg.update(node, item, i);
      container.appendChild(node);          // stellt zugleich die Reihenfolge her
      ergebnis.push(node);
    });

    Object.keys(vorhanden).forEach(function (k) {
      var node = vorhanden[k];
      if (!animiert) { node.remove(); return; }
      node.setAttribute("data-sim-gone", "");
      node.classList.remove("is-new");
      node.classList.add("is-gone");
      setTimeout(function () { node.remove(); }, 280);
    });

    return ergebnis;
  }

  /* --- Laufende Codezeile -----------------------------------------------------
     Hebt Zeile `n` (0-basiert) in einem Codeblock hervor – über einen Balken
     DAHINTER, nicht durch Umbauen des Markups. Nur so bleibt die Ausgabe von
     highlight.js unangetastet: Sie besteht aus verschachtelten Spans, die man
     nicht zeilenweise zerlegen kann, ohne die Farben zu zerreißen.

     `n = null` (oder < 0) blendet den Balken aus. Vorausgesetzt wird eine feste
     Zeilenhöhe – simulation.css setzt sie auf `.avd-academy-sim-code`. */
  function codeZeile(block, n) {
    if (!block) return null;
    var marker = block.querySelector(".avd-academy-sim-code__zeiger");
    if (!marker) {
      marker = document.createElement("div");
      marker.className = "avd-academy-sim-code__zeiger";
      marker.setAttribute("aria-hidden", "true");
      block.insertBefore(marker, block.firstChild);
    }
    if (n === null || n === undefined || n < 0) {
      marker.setAttribute("hidden", "");
      return marker;
    }
    var code = block.querySelector("code") || block;
    var stil = window.getComputedStyle(code);
    var zh = parseFloat(stil.lineHeight);
    // `line-height: normal` ist nicht messbar – dann bleibt der Balken lieber weg,
    // als an einer willkürlichen Stelle zu stehen.
    if (!zh) { marker.setAttribute("hidden", ""); return marker; }
    marker.removeAttribute("hidden");
    marker.style.height = zh + "px";
    /* Das Polster des <code> MUSS mitgerechnet werden: highlight.js gibt ihm
       eines, und ohne den Summanden säße der Balken um genau diesen Betrag zu
       hoch – gleichmäßig verschoben, deshalb leicht zu übersehen. */
    var oben = code.offsetTop + (parseFloat(stil.paddingTop) || 0);
    marker.style.transform = "translateY(" + (oben + n * zh) + "px)";
    return marker;
  }

  function pulse(node) {
    if (!node || REDUCED) return;
    node.classList.remove("is-pulse");
    void node.offsetWidth;               // Reflow erzwingen → Animation startet neu
    node.classList.add("is-pulse");
    setTimeout(function () { node.classList.remove("is-pulse"); }, 900);
  }

  /* --- Szenarien: Reiter, Übersicht, Bühnenbilder ----------------------------
     Bei mehreren Szenarien bekommt die Seite eine Reiterleiste und eine
     Übersicht als Startbild. Beide baut das Skript – die Seite liefert nur je
     Szenario ein Bühnenbild in einem Container mit
     `data-avd-academy-sim-scene="«id»"`; sichtbar ist immer genau eines. */
  function szenenSammeln() {
    if (!el.stage) return;
    var knoten = el.stage.querySelectorAll("[data-avd-academy-sim-scene]");
    Array.prototype.forEach.call(knoten, function (n) {
      var id = n.getAttribute("data-avd-academy-sim-scene");
      for (var i = 0; i < szenarien.length; i++) if (szenarien[i].id === id) szenarien[i].szene = n;
    });
  }

  /* Genau EIN Bühnenbild ist sichtbar – und auf der Übersicht keines. Ohne das
     lägen bei vier Szenarien alle vier Kulissen übereinander. */
  function ansichtWechseln() {
    szenarien.forEach(function (sz, i) {
      if (sz.szene) sz.szene.hidden = uebersicht || i !== szIndex;
    });
    if (el.stage) el.stage.hidden = uebersicht && mehrere();
    if (el.intro) el.intro.hidden = !uebersicht;
  }

  function reiterBauen() {
    if (!el.tabs || !mehrere()) return;
    el.tabs.removeAttribute("hidden");
    el.tabs.textContent = "";

    var uebersichtKnopf = document.createElement("button");
    uebersichtKnopf.type = "button";
    uebersichtKnopf.className = "avd-academy-sim__tab avd-academy-sim__tab--uebersicht";
    uebersichtKnopf.textContent = T.uebersicht;
    uebersichtKnopf.title = T.alleSzenarien + " (" + T.taste + " 0)";
    uebersichtKnopf.addEventListener("click", function () { zurUebersicht(); });
    el.tabs.appendChild(uebersichtKnopf);
    el.tabUebersicht = uebersichtKnopf;

    szenarien.forEach(function (sz, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "avd-academy-sim__tab";
      b.innerHTML = '<span class="avd-academy-sim__tab-nr">' + (i + 1) + '</span>' +
                    '<span class="avd-academy-sim__tab-title"></span>';
      b.querySelector(".avd-academy-sim__tab-title").textContent = sz.titel || (T.szenario + " " + (i + 1));
      if (i < 9) b.title = (sz.titel || "") + " (" + T.taste + " " + (i + 1) + ")";
      b.addEventListener("click", function () { zumSzenario(i); });
      el.tabs.appendChild(b);
      sz.tab = b;
    });
  }

  function reiterZeichnen() {
    if (!mehrere() || !el.tabs) return;
    if (el.tabUebersicht) {
      el.tabUebersicht.classList.toggle("is-active", uebersicht);
      el.tabUebersicht.setAttribute("aria-current", uebersicht ? "true" : "false");
    }
    szenarien.forEach(function (sz, i) {
      if (!sz.tab) return;
      var an = !uebersicht && i === szIndex;
      sz.tab.classList.toggle("is-active", an);
      sz.tab.setAttribute("aria-current", an ? "true" : "false");
    });
  }

  /* Die Übersicht erklärt, was einen in den Szenarien erwartet – sie ist das
     Inhaltsverzeichnis der Simulation, nicht bloß ein leerer Startbildschirm. */
  function introBauen() {
    if (!el.intro || !mehrere()) return;
    var titel = el.root ? el.root.getAttribute("data-avd-academy-sim-title") : "";
    var kopf = document.createElement("div");
    kopf.className = "avd-academy-sim__intro-kopf";
    if (titel) {
      var h = document.createElement("h1");
      h.className = "avd-academy-sim__intro-title";
      h.textContent = titel;
      kopf.appendChild(h);
    }
    var lead = el.intro.getAttribute("data-lead");
    if (lead) {
      var p = document.createElement("p");
      p.className = "avd-academy-sim__intro-lead";
      p.textContent = lead;
      kopf.appendChild(p);
    }
    el.intro.textContent = "";
    if (kopf.childNodes.length) el.intro.appendChild(kopf);

    var liste = document.createElement("ol");
    liste.className = "avd-academy-sim__intro-liste";
    szenarien.forEach(function (sz, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "avd-academy-sim__intro-karte";
      b.innerHTML =
        '<span class="avd-academy-sim__intro-nr">' + (i + 1) + '</span>' +
        '<span class="avd-academy-sim__intro-text">' +
          '<span class="avd-academy-sim__intro-name"></span>' +
          '<span class="avd-academy-sim__intro-mehr"></span>' +
        '</span>' +
        '<span class="avd-academy-sim__intro-meta">' + (sz.steps || []).length + ' Schritte</span>';
      b.querySelector(".avd-academy-sim__intro-name").textContent = sz.titel || ("Szenario " + (i + 1));
      var mehr = b.querySelector(".avd-academy-sim__intro-mehr");
      var besch = feld(sz, "description", "");
      if (besch) mehr.innerHTML = besch; else mehr.remove();
      b.addEventListener("click", function () { zumSzenario(i); });
      li.appendChild(b);
      liste.appendChild(li);
    });
    el.intro.appendChild(liste);
  }

  function zumSzenario(i) {
    if (i < 0 || i >= szenarien.length) return;
    pause();
    szIndex = i;
    uebersicht = false;
    index = 0;
    zeichne(0, 0);
  }

  function zurUebersicht() {
    if (!mehrere()) return;
    pause();
    uebersicht = true;
    zeichne(index, 0);
  }

  /* --- Capture-Modus ---------------------------------------------------------
     Für Beamer und Aufzeichnung: Alles außer der Bühne verschwindet, der
     Mauszeiger auch. Die Erklärspalte geht dabei mit – deshalb die Einblendung
     (OST, Taste T), die den Text des laufenden Schritts über die Bühne legt.

     Der Zustand steht in der Adresse (`?capture`): So lässt sich eine Aufnahme
     direkt im Aufzeichnungs-Zustand öffnen, ohne dass jemand vor laufender
     Kamera eine Taste drückt. */
  var capture = false;
  var ost = false;

  function captureSetzen(an, mitHinweis) {
    capture = !!an;
    // `el.root` statt einer eigenen Abfrage: start() hat es bereits ermittelt,
    // und vor start() wird hier nichts gerufen.
    if (!el.root) return;
    if (capture) el.root.setAttribute("data-capture", "");
    else el.root.removeAttribute("data-capture");
    // Verlässt man den Modus, geht die Einblendung mit – sonst stünde sie beim
    // nächsten Betreten unerwartet schon offen.
    if (!capture) ost = false;
    ostZeichnen();
    adresseSchreiben();
    if (capture && mitHinweis && el.captureHint) {
      el.captureHint.removeAttribute("hidden");
      // Animation neu starten, falls der Modus mehrfach umgeschaltet wird.
      el.captureHint.style.animation = "none";
      void el.captureHint.offsetWidth;
      el.captureHint.style.animation = "";
      clearTimeout(hinweisTimer);
      hinweisTimer = setTimeout(function () {
        el.captureHint.setAttribute("hidden", "");
      }, 2600);
    } else if (el.captureHint) {
      clearTimeout(hinweisTimer);
      el.captureHint.setAttribute("hidden", "");
    }
  }
  var hinweisTimer = null;

  function ostZeichnen() {
    if (!el.ost) return;
    var an = capture && ost;
    if (an) el.ost.removeAttribute("hidden");
    else el.ost.setAttribute("hidden", "");
    if (el.root) {
      if (an) el.root.setAttribute("data-ost", "");
      else el.root.removeAttribute("data-ost");
    }
    if (!an) { ostPlatz(); return; }
    var schritt = steps()[index] || {};
    var titel = feld(schritt, "title", "");
    var text = feld(schritt, "text", "");
    if (typeof text === "function") text = text(baue(index), { index: index, schritt: schritt });
    if (el.ostTitle) el.ostTitle.textContent = titel || "";
    if (el.ostText) el.ostText.innerHTML = text || "";
    ostPlatz();
  }

  /* Die Einblendung liegt ÜBER der Bühne – ohne freigehaltenen Platz verdeckt sie
     genau das, worüber sie spricht. Ihre Höhe hängt am Text, ist also nicht
     vorherzusehen: Sie wird gemessen und als Polster an die Bühne gegeben. */
  function ostPlatz() {
    if (!el.root) return;
    var hoehe = capture && ost && el.ost ? el.ost.offsetHeight : 0;
    el.root.style.setProperty("--avd-academy-sim-ost-h", hoehe + "px");
  }

  /* `?capture` bleibt in der Adresse stehen, damit ein Neuladen (oder ein Link an
     die Aufzeichnungs-Maschine) im selben Zustand landet. Der Schritt steht
     weiterhin im Fragment (#/3) – beides zusammen beschreibt die Ansicht. */
  function adresseSchreiben() {
    var url = new URL(location.href);
    if (capture) url.searchParams.set("capture", "");
    else url.searchParams.delete("capture");
    // `URL` hängt an einen wertlosen Parameter ein „=“ – das sieht in der
    // Adresszeile nach Fehler aus und ist beim Vorlesen lästig. Die Bereinigung
    // läuft auf der SUCHE allein: An der zusammengesetzten Adresse folgt auf
    // „capture=“ das Fragment (#/3), also weder „&“ noch das Ende.
    var suche = url.search.replace(/([?&])capture=(?=&|$)/, "$1capture");
    history.replaceState(null, "", url.pathname + suche + url.hash);
    window.dispatchEvent(new CustomEvent("avd-academy-urlchange"));
  }

  /* --- Aufbau ----------------------------------------------------------------- */
  function start() {
    if (started) return;
    var root = document.querySelector("[data-avd-academy-sim]");
    if (!root) return;
    started = true;

    el = {
      root: root,
      stage: q("stage"),
      note: q("note"),
      noteTitle: q("note-title"),
      counter: q("counter"),
      progress: q("progress"),
      controls: q("controls"),
      reset: q("reset"),
      prev: q("prev"),
      next: q("next"),
      play: q("play"),
      playIcon: q("play-icon"),
      playText: q("play-text"),
      playGroup: document.querySelector(".avd-academy-sim__play-group"),
      tempo: q("speed-toggle"),
      tempoLabel: q("speed-label"),
      tempoMenu: q("speed-menu"),
      full: q("full"),
      tabs: q("tabs"),
      intro: q("intro"),
      ost: q("ost"),
      ostTitle: q("ost-title"),
      ostText: q("ost-text"),
      captureHint: q("capture-hint")
    };

    /* Die Startvorgabe steht am WURZELKNOTEN (`data-avd-academy-sim-speed`, gesetzt aus
       `page.simulation.speed`) – nicht am Tempo-Knopf. Der heißt bewusst anders
       (`…-speed-toggle`), weil `q()` mit `document.querySelector` arbeitet: Trügen beide
       denselben Namen, fände die Suche den Wurzelknoten, der im Dokument vorher steht.
       Ein Name, der zwei Dinge bezeichnet, ist genau der Fehler, der das Tempo-Menü
       einmal stillgelegt hat (der Umzug auf englische Namen in #136 benannte das Markup
       um, die drei q()-Aufrufe aber nicht – sie suchten weiter `…-tempo*`, das es nicht
       mehr gab, und `menuZeigen()` brach an den null-Elementen ab). */
    grunddauer = parseInt(root.getAttribute("data-avd-academy-sim-step-interval"), 10) || 2500;
    tempo(root.getAttribute("data-avd-academy-sim-speed") || 1);

    if (!steps().length) {
      // Keine Schritte angemeldet: Die Kulisse steht, die Steuerung bleibt aus.
      if (el.controls) el.controls.setAttribute("hidden", "");
      return;
    }

    szenenSammeln();
    reiterBauen();
    introBauen();
    // Mit mehreren Szenarien beginnt die Simulation auf der Übersicht: erst die
    // Landkarte, dann der Weg. Ein Fragment in der Adresse sticht das (ausHash).
    if (mehrere()) uebersicht = true;

    if (el.reset) el.reset.addEventListener("click", reset);
    if (el.prev) el.prev.addEventListener("click", function () { pause(); prev(); });
    if (el.next) el.next.addEventListener("click", function () { pause(); next(); });
    if (el.play) el.play.addEventListener("click", toggle);
    if (el.full) el.full.addEventListener("click", vollbild);
    menuVerdrahten();

    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Solange das Tempo-Menü offen ist, gehören die Tasten ihm (Pfeile, Enter,
      // Escape). Sonst blätterte ein Pfeiltastendruck die Simulation weiter,
      // während der Blick im Menü liegt.
      if (menuOffen()) {
        if (e.key === "Escape") { menuSchliessen(true); e.preventDefault(); }
        return;
      }
      switch (e.key) {
        case "ArrowRight": case "PageDown": pause(); next(); e.preventDefault(); break;
        case "ArrowLeft":  case "PageUp":   pause(); prev(); e.preventDefault(); break;
        case " ":          toggle(); e.preventDefault(); break;
        case "Home":       reset(); e.preventDefault(); break;
        case "End":        pause(); go(steps().length - 1); e.preventDefault(); break;
        case "r": case "R": reset(); e.preventDefault(); break;
        case "c": case "C": captureSetzen(!capture, true); e.preventDefault(); break;
        case "0": if (mehrere()) { zurUebersicht(); e.preventDefault(); } break;
        // T gehört im Capture-Modus der Einblendung, sonst dem Tempo-Menü:
        // Beide kann man nicht gleichzeitig brauchen – die Steuerleiste, an der
        // das Menü hängt, ist im Capture-Modus gar nicht da.
        case "t": case "T":
          if (capture) { ost = !ost; ostZeichnen(); }
          else menuZeigen(true);
          e.preventDefault();
          break;
        case "Escape": if (capture) { captureSetzen(false); e.preventDefault(); } break;
        case "f": case "F": vollbild(); e.preventDefault(); break;
        default:
          // Ziffern 1–9 springen in das jeweilige Szenario – wie in der
          // eigenständigen Vorlage, damit der Griff derselbe bleibt.
          if (mehrere() && /^[1-9]$/.test(e.key)) {
            var n = Number(e.key) - 1;
            if (n < szenarien.length) { zumSzenario(n); e.preventDefault(); }
          }
          break;
      }
    });

    // Bei geänderter Fensterbreite bricht der Text anders um – das Polster muss
    // mit, sonst steht die Bühne zu hoch oder wieder darunter.
    window.addEventListener("resize", ostPlatz);

    window.addEventListener("hashchange", function () {
      var vorher = index;
      ausHash();
      if (vorher !== index) { pause(); zeichne(vorher, index > vorher ? 1 : -1); }
    });

    ausHash();
    // `?capture` in der Adresse startet direkt im Aufzeichnungs-Zustand – ohne
    // Hinweis-Einblendung, die sonst mit im Bild wäre.
    if (/[?&]capture(=|&|$)/.test(location.search)) captureSetzen(true, false);
    playKnopf();
    zeichne(index, 0);
  }

  /* --- Öffentliche Schnittstelle ---------------------------------------------- */
  var API = {
    /** Ausgangslage und Zeichenfunktion festlegen. */
    setup: function (o) {
      o = o || {};
      if (o.state !== undefined) opts.state = o.state;
      if (o.render !== undefined) opts.render = o.render;
      if (o.speed !== undefined) tempo(o.speed);
      if (o.stepInterval !== undefined) grunddauer = o.stepInterval;
      return API;
    },
    /** Ein Szenario anmelden. Ab dem ZWEITEN erscheinen Reiterleiste und
        Übersicht. Felder: id, title, description, state?, render?, steps. */
    registerScenario: function (sz) {
      if (!sz) return API;
      szenarien.push({
        id: sz.id || ("szenario-" + (szenarien.length + 1)),
        titel: feld(sz, "title", ""),
        beschreibung: feld(sz, "description", ""),
        state: sz.state,
        render: sz.render,
        steps: (sz.steps || []).slice()
      });
      return API;
    },
    /** Mehrere Szenarien auf einmal. */
    registerScenarios: function (liste) {
      (liste || []).forEach(API.registerScenario);
      return API;
    },
    /** Einen Schritt anmelden – Reihenfolge = Aufrufreihenfolge. Ohne
        `registerScenario` landen alle Schritte in einem unbenannten Szenario. */
    registerStep: function (schritt) {
      if (schritt) standardSzenario().steps.push(schritt);
      return API;
    },
    /** Mehrere Schritte auf einmal anmelden. */
    registerSteps: function (liste) {
      (liste || []).forEach(API.registerStep);
      return API;
    },
    list: list,
    pulse: pulse,
    codeLine: codeZeile,
    on: function (name, fn) {
      (hoerer[name] = hoerer[name] || []).push(fn);
      return API;
    },
    go: function (n) { pause(); go(n - 1); return API; },
    /** Zu einem Szenario springen – per Kennung oder 1-basierter Nummer. */
    szenario: function (was) {
      if (typeof was === "number") zumSzenario(was - 1);
      else for (var i = 0; i < szenarien.length; i++) if (szenarien[i].id === was) zumSzenario(i);
      return API;
    },
    /** Zurück auf die Übersicht (nur bei mehreren Szenarien). */
    uebersicht: function () { zurUebersicht(); return API; },
    next: function () { pause(); next(); return API; },
    prev: function () { pause(); prev(); return API; },
    reset: reset,
    play: play,
    pause: pause,
    toggle: toggle,
    tempo: tempo,
    /** Capture-Modus schalten (ohne Argument: umschalten). */
    capture: function (an) {
      captureSetzen(an === undefined ? !capture : !!an, false);
      return capture;
    },
    /** Einblendung (OST) im Capture-Modus schalten. */
    ost: function (an) {
      ost = an === undefined ? !ost : !!an;
      ostZeichnen();
      return ost;
    },
    /** Läuft nur, falls eine Seite die Schritte erst spät anmeldet. */
    start: start,
    get index() { return index; },
    get szenarien() { return szenarien.map(function (s) { return s.id; }); },
    get aktuellesSzenario() { return szenario().id || null; },
    get istUebersicht() { return uebersicht; },
    get length() { return steps().length; },
    get playing() { return playing; },
    get reducedMotion() { return REDUCED; }
  };

  window.AvdSimulation = API;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
