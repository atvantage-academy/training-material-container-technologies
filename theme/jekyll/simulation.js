/* =============================================================================
   Layout „simulation“ – Miniframework (ATVANTAGE Academy)
   -----------------------------------------------------------------------------
   Macht aus einer Seite mit `layout: simulation` einen abspielbaren Ablauf.
   Abhängigkeitsfrei, kein Build, kein CDN.

   GRUNDIDEE: DEKLARATIVE SCHRITTE
   Ein Schritt beschreibt NICHT „was passiert“, sondern „was gilt danach“. Das
   Framework baut den Zustand bei jedem Wechsel von vorn auf:

       Zustand = Ausgangslage;  für i = 0..aktuell:  schritt[i].apply(Zustand)

   Danach zeichnet EINE Funktion – `render(state, ctx)` – die Bühne. Weil der
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
   Schlüssel auch deutsch (`titel`, `dauer`, `ident`, `schritte`, `zustand`,
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
  var LABELS = {
    de: { abspielen: "Abspielen", pause: "Pause", leertaste: "Leertaste",
          overview: "Übersicht", allScenarios: "Alle Szenarien", scenario: "Szenario",
          taste: "Taste" },
    en: { abspielen: "Play",      pause: "Pause", leertaste: "space",
          overview: "Overview", allScenarios: "All scenarios", scenario: "Scenario",
          taste: "key" }
  };
  var T = LABELS[(document.documentElement.getAttribute("lang") || "de").split("-")[0].toLowerCase()] || LABELS.de;

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SPEEDS = [0.5, 1, 2, 5];

  /* --- Zustand des Frameworks ----------------------------------------------
     Eine Simulation besteht aus einem oder mehreren SZENARIEN. Jedes bringt
     eigene Schritte mit und darf eigene Ausgangslage/Zeichenfunktion haben;
     fehlen sie, gelten die aus `setup()`.

     Der EINFACHE FALL bleibt unangetastet: Wer nur `registerStep` ruft, bekommt
     ein unbenanntes Szenario, keine Reiter und keine Übersicht – genau wie
     bisher. Erst `registerScenario` schaltet beides frei. */
  var scenarios = [];
  var scIndex = 0;
  var overview = false;
  var opts = { state: null, render: null };
  var index = 0;
  var speedIdx = 0;
  var baseDuration = 2500;
  var playing = false;
  var timer = null;
  var started = false;
  var listeners = {};

  var el = {};   // gecachte Bedienelemente, gefüllt in start()

  /* --- Kleinkram ------------------------------------------------------------ */
  function q(name) { return document.querySelector("[data-avd-academy-sim-" + name + "]"); }

  /* Das Szenario, in dem wir gerade stecken – und seine Schritte. Alles unten
     rechnet gegen diese beiden, nie gegen eine globale Schrittliste. */
  function scenario() { return scenarios[scIndex] || { steps: [] }; }
  function steps() { return scenario().steps || []; }
  function several() { return scenarios.length > 1; }

  /* Ein unbenanntes Szenario für den einfachen Fall (`registerStep` ohne
     `registerScenario`). Es taucht in keiner Leiste auf. */
  function defaultScenario() {
    if (!scenarios.length) scenarios.push({ id: "", title: "", steps: [] });
    return scenarios[0];
  }

  function clone(v) {
    if (v === null || typeof v !== "object") return v;
    if (typeof structuredClone === "function") {
      try { return structuredClone(v); } catch (e) { /* Funktionen im Zustand – s. u. */ }
    }
    return JSON.parse(JSON.stringify(v));
  }

  function field(obj, name, fallback) {
    /* Ein Feld lesen, mit Vorgabe. EIN Name, nicht zwei: Die deutschen Zweitnamen
       sind mit 2.0 entfallen (siehe Kopf). */
    return obj[name] !== undefined ? obj[name] : fallback;
  }

  function emit(name, daten) {
    (listeners[name] || []).forEach(function (fn) { fn(daten); });
  }

  /* --- Ausgangslage + Wiederaufbau ------------------------------------------
     Der Zustand entsteht bei JEDEM Wechsel neu. `state` darf eine Funktion sein
     (empfohlen – sie liefert garantiert eine frische Struktur) oder ein Objekt,
     das dann geklont wird. */
  function initialState() {
    // Das Szenario darf eine eigene Ausgangslage mitbringen; sonst die aus setup().
    var source = scenario().state !== undefined ? scenario().state : opts.state;
    if (typeof source === "function") return source();
    if (source && typeof source === "object") return clone(source);
    return {};
  }

  function renderer() {
    return scenario().render !== undefined ? scenario().render : opts.render;
  }

  function build(bis) {
    var s = initialState();
    var stepList = steps();
    for (var i = 0; i <= bis && i < stepList.length; i++) {
      var apply = field(stepList[i], "apply", null);
      if (typeof apply === "function") apply(s, { index: i, step: stepList[i] });
    }
    return s;
  }

  /* --- Anzeige --------------------------------------------------------------- */
  function draw(previous, richtung) {
    // Auf der Übersicht gibt es keinen Schritt zu zeichnen – nur die Reiter und
    // die Adresse wollen nachgezogen werden.
    if (overview) {
      switchView();
      drawTabs();
      // Auf der Übersicht gibt es keinen Schritt – also auch nichts zu erklären
      // und nichts abzuspielen. Zähler, Fortschritt und Erklärspalte treten ab.
      if (el.root) el.root.setAttribute("data-overview", "");
      if (el.counter) el.counter.textContent = scenarios.length + " Szenarien";
      if (el.progress) el.progress.style.width = "0";
      if (el.prev) el.prev.disabled = true;
      if (el.next) el.next.disabled = false;
      if (el.reset) el.reset.disabled = true;
      hash();
      return;
    }
    if (el.root) el.root.removeAttribute("data-overview");

    var stepList = steps();
    var step = stepList[index] || {};
    var animated = !REDUCED && richtung !== 0 && Math.abs(index - previous) === 1;
    var state = build(index);

    /* DER KONTEXT IST DIE AUTORENSCHNITTSTELLE – deshalb englische Namen, auch wenn
       die Variablen darunter deutsch heissen. Er wird an `render` und `apply`
       uebergeben; jeder Name darin steht im fremden Simulationsskript. */
    var ctx = {
      index: index,
      previous: previous,
      direction: richtung,
      animated: animated,
      step: step,
      count: stepList.length,
      scenario: scenario().id || null,
      scenarioIndex: scIndex,
      stage: el.stage,
      sim: API
    };

    /* Auch ohne eigene `render`-Funktion nutzbar: Schrittnummer und Kennung
       stehen als data-Attribute auf der Bühne, sodass eine Simulation allein
       mit CSS-Regeln (`[data-step="3"] .paket { … }`) auskommen kann. */
    switchView();

    if (el.stage) {
      el.stage.setAttribute("data-step", String(index + 1));
      if (scenario().id) el.stage.setAttribute("data-szenario", scenario().id);
      else el.stage.removeAttribute("data-szenario");
      el.stage.setAttribute("data-direction", richtung > 0 ? "forward" : richtung < 0 ? "back" : "start");
      var id = field(step, "id", "");
      if (id) el.stage.setAttribute("data-step-id", id);
      else el.stage.removeAttribute("data-step-id");
    }

    var render = renderer();
    if (typeof render === "function") render(state, ctx);

    // Erklärspalte
    var title = field(step, "title", "");
    var text = field(step, "text", "");
    if (typeof text === "function") text = text(state, ctx);
    if (el.noteTitle) {
      el.noteTitle.textContent = title || "";
      el.noteTitle.hidden = !title;
    }
    if (el.note) el.note.innerHTML = text || "";

    // Kopfleiste, Fortschritt, Knöpfe
    if (el.counter) {
      var counter = stepList.length ? "Schritt " + (index + 1) + " / " + stepList.length : "";
      // Bei mehreren Szenarien steht davor, in welchem man ist – ohne das wäre
      // „Schritt 3 / 8“ auf einer Seite mit vier Abläufen mehrdeutig.
      if (counter && several()) counter = scenario().title + " · " + counter;
      el.counter.textContent = counter;
    }
    if (el.progress) el.progress.style.width = stepList.length ? ((index + 1) / stepList.length) * 100 + "%" : "0";
    if (el.prev) el.prev.disabled = index === 0;
    if (el.next) el.next.disabled = index >= stepList.length - 1;
    if (el.reset) el.reset.disabled = index === 0 && !playing;

    drawTabs();
    drawCaption();
    hash();
    emit("step", ctx);
  }

  /* Die aktuelle Schrittnummer steht im Fragment (#/3) – reload-fest und
     verlinkbar. `replaceState` löst kein `hashchange` aus; der QR-Code der
     Seitenadresse (theme/academy/atvantage.js) hört deshalb zusätzlich auf das
     eigene Ereignis `avd-academy-urlchange` und zeigt so stets auf den Schritt,
     der gerade an der Wand steht. */
  function hash() {
    var h;
    if (overview) h = "#/overview";
    else if (several() && scenario().id) h = "#/" + scenario().id + "/" + (index + 1);
    else h = "#/" + (index + 1);
    if (location.hash !== h) {
      history.replaceState(null, "", h);
      window.dispatchEvent(new CustomEvent("avd-academy-urlchange"));
    }
  }

  /* Erlaubte Formen: `#/3` (eine Simulation ohne Szenarien), `#/«id»/3` und
     `#/overview`. Die Kennung statt einer Nummer, damit ein Verweis aus dem
     Regiebuch das Umsortieren der Szenarien überlebt. */
  function fromHash() {
    var h = location.hash || "";
    if (/^#\/overview\/?$/.test(h)) {
      if (several()) { overview = true; return; }
    }
    var m = /^#\/([A-Za-z0-9_-]+)\/(\d+)$/.exec(h);
    if (m) {
      var hit = -1;
      for (var i = 0; i < scenarios.length; i++) if (scenarios[i].id === m[1]) hit = i;
      if (hit >= 0) {
        scIndex = hit;
        overview = false;
        index = limit(parseInt(m[2], 10) - 1);
      }
      return;
    }
    m = /^#\/(\d+)$/.exec(h);
    if (m) {
      overview = false;
      index = limit(parseInt(m[1], 10) - 1);
    }
  }

  function limit(n) {
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(steps().length - 1, n));
  }

  /* --- Ablaufsteuerung ------------------------------------------------------- */
  function go(target) {
    var fresh = limit(target);
    var previous = index;
    var cameFromOverview = overview;
    overview = false;
    index = fresh;
    // Aus der Übersicht heraus wird nicht animiert – dort war vorher nichts,
    // was sich verändern könnte.
    draw(cameFromOverview ? fresh : previous, cameFromOverview ? 0 : fresh === previous ? 0 : fresh > previous ? 1 : -1);
  }

  function next() {
    if (overview) { go(0); return true; }
    if (index >= steps().length - 1) { pause(); return false; }
    go(index + 1);
    return true;
  }

  function prev() { go(index - 1); }

  function reset() {
    pause();
    var previous = index;
    overview = false;
    index = 0;
    // Immer neu zeichnen, auch wenn schon Schritt 1 lief: „Reset“ soll die Bühne
    // sichtbar in den Anfangszustand zurückversetzen, nicht bloß nichts tun.
    draw(previous, previous > 0 ? -1 : 0);
  }

  function duration() {
    var s = steps()[index];
    var own = s ? field(s, "duration", null) : null;
    var ms = (typeof own === "number" ? own : baseDuration) / SPEEDS[speedIdx];
    return Math.max(150, ms);
  }

  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(function () {
      if (!playing) return;
      if (next()) schedule();
    }, duration());
  }

  function play() {
    if (overview) go(0);
    if (!steps().length) return;
    // Am Ende beginnt „Abspielen“ wieder von vorn – sonst passierte gar nichts.
    if (index >= steps().length - 1) go(0);
    playing = true;
    playButton();
    schedule();
  }

  function pause() {
    playing = false;
    clearTimeout(timer);
    playButton();
  }

  function toggle() { playing ? pause() : play(); }

  function playButton() {
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
  function speed(stufe) {
    if (stufe !== undefined) {
      var i = SPEEDS.indexOf(Number(stufe));
      speedIdx = i < 0 ? SPEEDS.indexOf(1) : i;
    } else {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
    }
    var value = SPEEDS[speedIdx];
    if (el.tempoLabel) el.tempoLabel.textContent = label(value);
    if (el.tempoMenu) {
      Array.prototype.forEach.call(
        el.tempoMenu.querySelectorAll("[data-avd-academy-sim-speed-value]"),
        function (b) {
          var on = Number(b.getAttribute("data-avd-academy-sim-speed-value")) === value;
          b.setAttribute("aria-checked", on ? "true" : "false");
          b.classList.toggle("is-active", on);
        }
      );
    }
    if (playing) schedule();          // laufendes Abspielen sofort auf neues Tempo
    return value;
  }

  // Im Deutschen trennt das Komma die Nachkommastelle – „0.5×“ wäre ein Anglizismus
  // in einer Leiste, die sonst durchweg deutsch beschriftet ist.
  function label(value) {
    return String(value).replace(".", ",") + "×";
  }

  /* --- Tempo-Menü ------------------------------------------------------------
     Klappt nach OBEN auf: Die Steuerleiste sitzt am unteren Rand, nach unten wäre
     kein Platz. Es schließt bei Auswahl, bei Escape, beim Klick daneben und beim
     Verlassen per Tabulator – ein Menü, das offen stehen bleibt, verdeckt die
     Bühne. */
  function menuOpen() {
    return !!(el.tempoMenu && !el.tempoMenu.hasAttribute("hidden"));
  }

  function showMenu(on) {
    if (!el.tempoMenu || !el.speed) return;
    if (on) el.tempoMenu.removeAttribute("hidden");
    else el.tempoMenu.setAttribute("hidden", "");
    el.speed.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) {
      var active = el.tempoMenu.querySelector("[aria-checked='true']") ||
                  el.tempoMenu.querySelector("[data-avd-academy-sim-speed-value]");
      if (active) active.focus();
    }
  }

  function closeMenu(zurueckZumKnopf) {
    if (!menuOpen()) return;
    showMenu(false);
    if (zurueckZumKnopf && el.speed) el.speed.focus();
  }

  function wireMenu() {
    if (!el.speed || !el.tempoMenu) return;
    var entries = Array.prototype.slice.call(
      el.tempoMenu.querySelectorAll("[data-avd-academy-sim-speed-value]"));

    el.speed.addEventListener("click", function (e) {
      e.stopPropagation();
      showMenu(!menuOpen());
    });

    entries.forEach(function (b, i) {
      b.addEventListener("click", function () {
        speed(b.getAttribute("data-avd-academy-sim-speed-value"));
        closeMenu(true);
        // Ein Tempo zu wählen heißt: so abspielen. Sonst wäre jede Wahl zwei
        // Klicks weit von dem entfernt, weswegen man sie getroffen hat.
        if (!playing) play();
      });
      b.addEventListener("keydown", function (e) {
        var target = null;
        if (e.key === "ArrowDown") target = entries[(i + 1) % entries.length];
        else if (e.key === "ArrowUp") target = entries[(i - 1 + entries.length) % entries.length];
        else if (e.key === "Home") target = entries[0];
        else if (e.key === "End") target = entries[entries.length - 1];
        else if (e.key === "Escape") { closeMenu(true); e.preventDefault(); return; }
        else return;
        if (target) { target.focus(); e.preventDefault(); }
      });
    });

    document.addEventListener("click", function (e) {
      if (!menuOpen()) return;
      if (el.playGroup && el.playGroup.contains(e.target)) return;
      closeMenu(false);
    });
    document.addEventListener("focusin", function (e) {
      if (!menuOpen()) return;
      if (el.playGroup && el.playGroup.contains(e.target)) return;
      closeMenu(false);
    });
  }

  function fullscreen() {
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
    var animated = cfg.animated !== undefined ? cfg.animated : !REDUCED;
    var key = cfg.key || function (item, i) { return item && item.id !== undefined ? item.id : i; };

    var present = {};
    Array.prototype.forEach.call(container.children, function (node) {
      var k = node.getAttribute("data-sim-key");
      // Knoten, die gerade ausblenden, zählen nicht mehr mit: Sonst würde ein
      // Element, das im selben Schritt neu entsteht, den sterbenden wiederbeleben.
      if (k !== null && !node.hasAttribute("data-sim-gone")) present[k] = node;
    });

    var result = [];
    (items || []).forEach(function (item, i) {
      var k = String(key(item, i));
      var node = present[k];
      if (node) {
        delete present[k];
        node.classList.remove("is-new");
      } else {
        node = cfg.create ? cfg.create(item, i) : document.createElement("div");
        node.setAttribute("data-sim-key", k);
        if (animated) node.classList.add("is-new");
      }
      if (cfg.update) cfg.update(node, item, i);
      container.appendChild(node);          // stellt zugleich die Reihenfolge her
      result.push(node);
    });

    Object.keys(present).forEach(function (k) {
      var node = present[k];
      if (!animated) { node.remove(); return; }
      node.setAttribute("data-sim-gone", "");
      node.classList.remove("is-new");
      node.classList.add("is-gone");
      setTimeout(function () { node.remove(); }, 280);
    });

    return result;
  }

  /* --- Laufende Codezeile -----------------------------------------------------
     Hebt Zeile `n` (0-basiert) in einem Codeblock hervor – über einen Balken
     DAHINTER, nicht durch Umbauen des Markups. Nur so bleibt die Ausgabe von
     highlight.js unangetastet: Sie besteht aus verschachtelten Spans, die man
     nicht zeilenweise zerlegen kann, ohne die Farben zu zerreißen.

     `n = null` (oder < 0) blendet den Balken aus. Vorausgesetzt wird eine feste
     Zeilenhöhe – simulation.css setzt sie auf `.avd-academy-sim-code`. */
  function codeLine(block, n) {
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
    var style = window.getComputedStyle(code);
    var zh = parseFloat(style.lineHeight);
    // `line-height: normal` ist nicht messbar – dann bleibt der Balken lieber weg,
    // als an einer willkürlichen Stelle zu stehen.
    if (!zh) { marker.setAttribute("hidden", ""); return marker; }
    marker.removeAttribute("hidden");
    marker.style.height = zh + "px";
    /* Das Polster des <code> MUSS mitgerechnet werden: highlight.js gibt ihm
       eines, und ohne den Summanden säße der Balken um genau diesen Betrag zu
       hoch – gleichmäßig verschoben, deshalb leicht zu übersehen. */
    var top = code.offsetTop + (parseFloat(style.paddingTop) || 0);
    marker.style.transform = "translateY(" + (top + n * zh) + "px)";
    return marker;
  }

  function pulse(node) {
    if (!node || REDUCED) return;
    node.classList.remove("is-pulse");
    void node.offsetWidth;               // Reflow erzwingen → Animation startet fresh
    node.classList.add("is-pulse");
    setTimeout(function () { node.classList.remove("is-pulse"); }, 900);
  }

  /* --- Szenarien: Reiter, Übersicht, Bühnenbilder ----------------------------
     Bei mehreren Szenarien bekommt die Seite eine Reiterleiste und eine
     Übersicht als Startbild. Beide baut das Skript – die Seite liefert nur je
     Szenario ein Bühnenbild in einem Container mit
     `data-avd-academy-sim-scene="«id»"`; sichtbar ist immer genau eines. */
  function collectScenes() {
    if (!el.stage) return;
    var node = el.stage.querySelectorAll("[data-avd-academy-sim-scene]");
    Array.prototype.forEach.call(node, function (n) {
      var id = n.getAttribute("data-avd-academy-sim-scene");
      for (var i = 0; i < scenarios.length; i++) if (scenarios[i].id === id) scenarios[i].scene = n;
    });
  }

  /* Genau EIN Bühnenbild ist sichtbar – und auf der Übersicht keines. Ohne das
     lägen bei vier Szenarien alle vier Kulissen übereinander. */
  function switchView() {
    scenarios.forEach(function (sz, i) {
      if (sz.scene) sz.scene.hidden = overview || i !== scIndex;
    });
    if (el.stage) el.stage.hidden = overview && several();
    if (el.intro) el.intro.hidden = !overview;
  }

  function buildTabs() {
    if (!el.tabs || !several()) return;
    el.tabs.removeAttribute("hidden");
    el.tabs.textContent = "";

    var overviewButton = document.createElement("button");
    overviewButton.type = "button";
    overviewButton.className = "avd-academy-sim__tab avd-academy-sim__tab--overview";
    overviewButton.textContent = T.overview;
    overviewButton.title = T.allScenarios + " (" + T.taste + " 0)";
    overviewButton.addEventListener("click", function () { toOverview(); });
    el.tabs.appendChild(overviewButton);
    el.tabUebersicht = overviewButton;

    scenarios.forEach(function (sz, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "avd-academy-sim__tab";
      b.innerHTML = '<span class="avd-academy-sim__tab-nr">' + (i + 1) + '</span>' +
                    '<span class="avd-academy-sim__tab-title"></span>';
      b.querySelector(".avd-academy-sim__tab-title").textContent = sz.title || (T.scenario + " " + (i + 1));
      if (i < 9) b.title = (sz.title || "") + " (" + T.taste + " " + (i + 1) + ")";
      b.addEventListener("click", function () { toScenario(i); });
      el.tabs.appendChild(b);
      sz.tab = b;
    });
  }

  function drawTabs() {
    if (!several() || !el.tabs) return;
    if (el.tabUebersicht) {
      el.tabUebersicht.classList.toggle("is-active", overview);
      el.tabUebersicht.setAttribute("aria-current", overview ? "true" : "false");
    }
    scenarios.forEach(function (sz, i) {
      if (!sz.tab) return;
      var on = !overview && i === scIndex;
      sz.tab.classList.toggle("is-active", on);
      sz.tab.setAttribute("aria-current", on ? "true" : "false");
    });
  }

  /* Die Übersicht erklärt, was einen in den Szenarien erwartet – sie ist das
     Inhaltsverzeichnis der Simulation, nicht bloß ein leerer Startbildschirm. */
  function buildIntro() {
    if (!el.intro || !several()) return;
    var title = el.root ? el.root.getAttribute("data-avd-academy-sim-title") : "";
    var head = document.createElement("div");
    head.className = "avd-academy-sim__intro-kopf";
    if (title) {
      var h = document.createElement("h1");
      h.className = "avd-academy-sim__intro-title";
      h.textContent = title;
      head.appendChild(h);
    }
    var lead = el.intro.getAttribute("data-lead");
    if (lead) {
      var p = document.createElement("p");
      p.className = "avd-academy-sim__intro-lead";
      p.textContent = lead;
      head.appendChild(p);
    }
    el.intro.textContent = "";
    if (head.childNodes.length) el.intro.appendChild(head);

    var stepList = document.createElement("ol");
    stepList.className = "avd-academy-sim__intro-liste";
    scenarios.forEach(function (sz, i) {
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
      b.querySelector(".avd-academy-sim__intro-name").textContent = sz.title || ("Szenario " + (i + 1));
      var more = b.querySelector(".avd-academy-sim__intro-mehr");
      var desc = field(sz, "description", "");
      if (desc) more.innerHTML = desc; else more.remove();
      b.addEventListener("click", function () { toScenario(i); });
      li.appendChild(b);
      stepList.appendChild(li);
    });
    el.intro.appendChild(stepList);
  }

  function toScenario(i) {
    if (i < 0 || i >= scenarios.length) return;
    pause();
    scIndex = i;
    overview = false;
    index = 0;
    draw(0, 0);
  }

  function toOverview() {
    if (!several()) return;
    pause();
    overview = true;
    draw(index, 0);
  }

  /* --- Capture-Modus ---------------------------------------------------------
     Für Beamer und Aufzeichnung: Alles außer der Bühne verschwindet, der
     Mauszeiger auch. Die Erklärspalte geht dabei mit – deshalb die Einblendung
     (OST, Taste T), die den Text des laufenden Schritts über die Bühne legt.

     Der Zustand steht in der Adresse (`?capture`): So lässt sich eine Aufnahme
     direkt im Aufzeichnungs-Zustand öffnen, ohne dass jemand vor laufender
     Kamera eine Taste drückt. */
  var capture = false;
  var caption = false;

  function setCapture(on, mitHinweis) {
    capture = !!on;
    // `el.root` statt einer eigenen Abfrage: start() hat es bereits ermittelt,
    // und vor start() wird hier nichts gerufen.
    if (!el.root) return;
    if (capture) el.root.setAttribute("data-capture", "");
    else el.root.removeAttribute("data-capture");
    // Verlässt man den Modus, geht die Einblendung mit – sonst stünde sie beim
    // nächsten Betreten unerwartet schon offen.
    if (!capture) caption = false;
    drawCaption();
    writeAddress();
    if (capture && mitHinweis && el.captureHint) {
      el.captureHint.removeAttribute("hidden");
      // Animation neu starten, falls der Modus mehrfach umgeschaltet wird.
      el.captureHint.style.animation = "none";
      void el.captureHint.offsetWidth;
      el.captureHint.style.animation = "";
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () {
        el.captureHint.setAttribute("hidden", "");
      }, 2600);
    } else if (el.captureHint) {
      clearTimeout(hintTimer);
      el.captureHint.setAttribute("hidden", "");
    }
  }
  var hintTimer = null;

  function drawCaption() {
    if (!el.caption) return;
    var on = capture && caption;
    if (on) el.caption.removeAttribute("hidden");
    else el.caption.setAttribute("hidden", "");
    if (el.root) {
      if (on) el.root.setAttribute("data-caption", "");
      else el.root.removeAttribute("data-caption");
    }
    if (!on) { captionSlot(); return; }
    var step = steps()[index] || {};
    var title = field(step, "title", "");
    var text = field(step, "text", "");
    if (typeof text === "function") text = text(build(index), { index: index, step: step });
    if (el.captionTitle) el.captionTitle.textContent = title || "";
    if (el.captionText) el.captionText.innerHTML = text || "";
    captionSlot();
  }

  /* Die Einblendung liegt ÜBER der Bühne – ohne freigehaltenen Platz verdeckt sie
     genau das, worüber sie spricht. Ihre Höhe hängt am Text, ist also nicht
     vorherzusehen: Sie wird gemessen und als Polster an die Bühne gegeben. */
  function captionSlot() {
    if (!el.root) return;
    var height = capture && caption && el.caption ? el.caption.offsetHeight : 0;
    el.root.style.setProperty("--avd-academy-sim-caption-h", height + "px");
  }

  /* `?capture` bleibt in der Adresse stehen, damit ein Neuladen (oder ein Link an
     die Aufzeichnungs-Maschine) im selben Zustand landet. Der Schritt steht
     weiterhin im Fragment (#/3) – beides zusammen beschreibt die Ansicht. */
  function writeAddress() {
    var url = new URL(location.href);
    if (capture) url.searchParams.set("capture", "");
    else url.searchParams.delete("capture");
    // `URL` hängt an einen wertlosen Parameter ein „=“ – das sieht in der
    // Adresszeile nach Fehler aus und ist beim Vorlesen lästig. Die Bereinigung
    // läuft auf der SUCHE allein: An der zusammengesetzten Adresse folgt auf
    // „capture=“ das Fragment (#/3), also weder „&“ noch das Ende.
    var search = url.search.replace(/([?&])capture=(?=&|$)/, "$1capture");
    history.replaceState(null, "", url.pathname + search + url.hash);
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
      speed: q("speed-toggle"),
      tempoLabel: q("speed-label"),
      tempoMenu: q("speed-menu"),
      full: q("full"),
      tabs: q("tabs"),
      intro: q("intro"),
      caption: q("caption"),
      captionTitle: q("caption-title"),
      captionText: q("caption-text"),
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
    baseDuration = parseInt(root.getAttribute("data-avd-academy-sim-step-interval"), 10) || 2500;
    speed(root.getAttribute("data-avd-academy-sim-speed") || 1);

    if (!steps().length) {
      // Keine Schritte angemeldet: Die Kulisse steht, die Steuerung bleibt aus.
      if (el.controls) el.controls.setAttribute("hidden", "");
      return;
    }

    collectScenes();
    buildTabs();
    buildIntro();
    // Mit mehreren Szenarien beginnt die Simulation auf der Übersicht: erst die
    // Landkarte, dann der Weg. Ein Fragment in der Adresse sticht das (ausHash).
    if (several()) overview = true;

    if (el.reset) el.reset.addEventListener("click", reset);
    if (el.prev) el.prev.addEventListener("click", function () { pause(); prev(); });
    if (el.next) el.next.addEventListener("click", function () { pause(); next(); });
    if (el.play) el.play.addEventListener("click", toggle);
    if (el.full) el.full.addEventListener("click", fullscreen);
    wireMenu();

    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Solange das Tempo-Menü offen ist, gehören die Tasten ihm (Pfeile, Enter,
      // Escape). Sonst blätterte ein Pfeiltastendruck die Simulation weiter,
      // während der Blick im Menü liegt.
      if (menuOpen()) {
        if (e.key === "Escape") { closeMenu(true); e.preventDefault(); }
        return;
      }
      switch (e.key) {
        case "ArrowRight": case "PageDown": pause(); next(); e.preventDefault(); break;
        case "ArrowLeft":  case "PageUp":   pause(); prev(); e.preventDefault(); break;
        case " ":          toggle(); e.preventDefault(); break;
        case "Home":       reset(); e.preventDefault(); break;
        case "End":        pause(); go(steps().length - 1); e.preventDefault(); break;
        case "r": case "R": reset(); e.preventDefault(); break;
        case "c": case "C": setCapture(!capture, true); e.preventDefault(); break;
        case "0": if (several()) { toOverview(); e.preventDefault(); } break;
        // T gehört im Capture-Modus der Einblendung, sonst dem Tempo-Menü:
        // Beide kann man nicht gleichzeitig brauchen – die Steuerleiste, an der
        // das Menü hängt, ist im Capture-Modus gar nicht da.
        case "t": case "T":
          if (capture) { caption = !caption; drawCaption(); }
          else showMenu(true);
          e.preventDefault();
          break;
        case "Escape": if (capture) { setCapture(false); e.preventDefault(); } break;
        case "f": case "F": fullscreen(); e.preventDefault(); break;
        default:
          // Ziffern 1–9 springen in das jeweilige Szenario – wie in der
          // eigenständigen Vorlage, damit der Griff derselbe bleibt.
          if (several() && /^[1-9]$/.test(e.key)) {
            var n = Number(e.key) - 1;
            if (n < scenarios.length) { toScenario(n); e.preventDefault(); }
          }
          break;
      }
    });

    // Bei geänderter Fensterbreite bricht der Text anders um – das Polster muss
    // mit, sonst steht die Bühne zu hoch oder wieder darunter.
    window.addEventListener("resize", captionSlot);

    window.addEventListener("hashchange", function () {
      var previous = index;
      fromHash();
      if (previous !== index) { pause(); draw(previous, index > previous ? 1 : -1); }
    });

    fromHash();
    // `?capture` in der Adresse startet direkt im Aufzeichnungs-Zustand – ohne
    // Hinweis-Einblendung, die sonst mit im Bild wäre.
    if (/[?&]capture(=|&|$)/.test(location.search)) setCapture(true, false);
    playButton();
    draw(index, 0);
  }

  /* --- Öffentliche Schnittstelle ---------------------------------------------- */
  var API = {
    /** Ausgangslage und Zeichenfunktion festlegen. */
    setup: function (o) {
      o = o || {};
      if (o.state !== undefined) opts.state = o.state;
      if (o.render !== undefined) opts.render = o.render;
      if (o.speed !== undefined) speed(o.speed);
      if (o.stepInterval !== undefined) baseDuration = o.stepInterval;
      return API;
    },
    /** Ein Szenario anmelden. Ab dem ZWEITEN erscheinen Reiterleiste und
        Übersicht. Felder: id, title, description, state?, render?, steps. */
    registerScenario: function (sz) {
      if (!sz) return API;
      scenarios.push({
        id: sz.id || ("szenario-" + (scenarios.length + 1)),
        title: field(sz, "title", ""),
        beschreibung: field(sz, "description", ""),
        state: sz.state,
        render: sz.render,
        steps: (sz.steps || []).slice()
      });
      return API;
    },
    /** Mehrere Szenarien auf einmal. */
    registerScenarios: function (stepList) {
      (stepList || []).forEach(API.registerScenario);
      return API;
    },
    /** Einen Schritt anmelden – Reihenfolge = Aufrufreihenfolge. Ohne
        `registerScenario` landen alle Schritte in einem unbenannten Szenario. */
    registerStep: function (step) {
      if (step) defaultScenario().steps.push(step);
      return API;
    },
    /** Mehrere Schritte auf einmal anmelden. */
    registerSteps: function (stepList) {
      (stepList || []).forEach(API.registerStep);
      return API;
    },
    list: list,
    pulse: pulse,
    codeLine: codeLine,
    on: function (name, fn) {
      (listeners[name] = listeners[name] || []).push(fn);
      return API;
    },
    go: function (n) { pause(); go(n - 1); return API; },
    /** Zu einem Szenario springen – per Kennung oder 1-basierter Nummer. */
    scenario: function (was) {
      if (typeof was === "number") toScenario(was - 1);
      else for (var i = 0; i < scenarios.length; i++) if (scenarios[i].id === was) toScenario(i);
      return API;
    },
    /** Zurück auf die Übersicht (nur bei mehreren Szenarien). */
    overview: function () { toOverview(); return API; },
    next: function () { pause(); next(); return API; },
    prev: function () { pause(); prev(); return API; },
    reset: reset,
    play: play,
    pause: pause,
    toggle: toggle,
    speed: speed,
    /** Capture-Modus schalten (ohne Argument: umschalten). */
    capture: function (on) {
      setCapture(on === undefined ? !capture : !!on, false);
      return capture;
    },
    /** Einblendung (OST) im Capture-Modus schalten. */
    caption: function (on) {
      caption = on === undefined ? !caption : !!on;
      drawCaption();
      return caption;
    },
    /** Läuft nur, falls eine Seite die Schritte erst spät anmeldet. */
    start: start,
    get index() { return index; },
    get scenarios() { return scenarios.map(function (s) { return s.id; }); },
    get currentScenario() { return scenario().id || null; },
    get isOverview() { return overview; },
    get length() { return steps().length; },
    get playing() { return playing; },
    get reducedMotion() { return REDUCED; }
  };

  window.AvdSimulation = API;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
