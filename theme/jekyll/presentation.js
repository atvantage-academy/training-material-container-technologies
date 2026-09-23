/* =============================================================================
   Layout „presentation“ – Verhalten (ATVANTAGE Academy)
   -----------------------------------------------------------------------------
   Macht aus dem gerenderten Markdown einer Seite mit `layout: presentation` ein
   Foliendeck. Abhängigkeitsfrei, kein Build, kein CDN.

   1) AUFTEILEN: Der Inhalt von [data-avd-academy-deck] wird an jedem <h2> in
      Folien zerlegt. Alles vor dem ersten <h2> wird zur Titelfolie; fehlt dort
      eine Überschrift, wird der Präsentationstitel eingesetzt.
   2) BLÄTTERN: Alle Folien liegen nebeneinander auf einer Schiene, die um
      n × 100 % verschoben wird – die alte Folie wandert nach links aus dem Bild.
   3) BEDIENEN: ← → (auch Leertaste, Bild ↑/↓, Pos1/Ende), Schaltflächen,
      Wischgesten; F schaltet Vollbild. Die Folie steht im Hash (#/3).

   Ohne dieses Skript bleibt die Seite ein normales, scrollbares Dokument – die
   CSS-Regeln für die Bühne hängen an `data-ready`, das erst hier gesetzt wird.
   ============================================================================= */
(function () {
  "use strict";

  var root = document.querySelector("[data-avd-academy-present]");
  var deck = document.querySelector("[data-avd-academy-deck]");
  if (!root || !deck) return;

  /* --- 1) Folien aus dem Markdown bauen ------------------------------------ */
  var track = document.createElement("div");
  track.className = "avd-academy-deck__track";

  var inner = null; // Inhaltsspalte der aktuell befüllten Folie

  function addSlide(modifier) {
    var section = document.createElement("section");
    section.className = "avd-academy-slide" + (modifier ? " " + modifier : "");
    var box = document.createElement("div");
    box.className = "avd-academy-slide__inner";
    section.appendChild(box);
    track.appendChild(section);
    inner = box;
    return section;
  }

  var nodes = Array.prototype.slice.call(deck.childNodes);
  nodes.forEach(function (node) {
    // Reine Zeilenumbrüche zwischen den Blöcken und Kommentare tragen nichts bei –
    // sie dürfen vor allem nicht versehentlich eine Titelfolie auslösen.
    if (node.nodeType === 3 && !node.textContent.trim()) return;
    if (node.nodeType === 8) return;

    if (node.nodeType === 1 && node.tagName === "H2") {
      addSlide();
    } else if (!inner) {
      addSlide("avd-academy-slide--title");
    }
    inner.appendChild(node);
  });

  // Beginnt der Inhalt direkt mit einem h2, fehlt die Titelfolie – dann wird sie
  // aus dem Präsentationstitel erzeugt und vorangestellt.
  var title = root.getAttribute("data-avd-academy-present-title");
  var firstSlide = track.firstElementChild;
  if (firstSlide && !firstSlide.classList.contains("avd-academy-slide--title") && title) {
    var lead = addSlide("avd-academy-slide--title");
    var h1 = document.createElement("h1");
    h1.textContent = title;
    lead.querySelector(".avd-academy-slide__inner").appendChild(h1);
    track.insertBefore(lead, track.firstElementChild);
  }
  // Titelfolie ohne eigene Überschrift (z. B. nur ein Untertitel): Titel ergänzen.
  firstSlide = track.firstElementChild;
  if (firstSlide && firstSlide.classList.contains("avd-academy-slide--title") && title) {
    var box = firstSlide.querySelector(".avd-academy-slide__inner");
    if (!box.querySelector("h1")) {
      var heading = document.createElement("h1");
      heading.textContent = title;
      box.insertBefore(heading, box.firstChild);
    }
  }

  deck.textContent = "";
  deck.appendChild(track);
  deck.setAttribute("data-ready", "");
  root.setAttribute("data-ready", "");

  var slides = Array.prototype.slice.call(track.children);
  if (!slides.length) return;

  /* --- 2) Zustand + Anzeige ------------------------------------------------- */
  var counter = document.querySelector("[data-avd-academy-present-counter]");
  var progress = document.querySelector("[data-avd-academy-present-progress]");
  var controls = document.querySelector("[data-avd-academy-present-controls]");
  var prevBtn = document.querySelector("[data-avd-academy-present-prev]");
  var nextBtn = document.querySelector("[data-avd-academy-present-next]");
  var index = 0;

  if (controls && slides.length > 1) controls.removeAttribute("hidden");

  function render() {
    track.style.transform = "translateX(-" + index * 100 + "%)";
    slides.forEach(function (s, i) {
      /* NICHT NUR VERSTECKEN, SONDERN STILLLEGEN. Eine Folie, die nur
         `aria-hidden` traegt, ist fuer eine Vorlesehilfe weg - ihre Links
         bleiben aber in der Tabulatorreihenfolge: Der Fokus wandert in etwas,
         das niemand sieht und niemand angesagt bekommt. `inert` nimmt beides
         zusammen; Browser, die es nicht kennen, verhalten sich wie bisher. */
      if (i === index) { s.removeAttribute("aria-hidden"); s.removeAttribute("inert"); }
      else { s.setAttribute("aria-hidden", "true"); s.setAttribute("inert", ""); }
    });
    if (counter) counter.textContent = index + 1 + " / " + slides.length;
    if (progress) progress.style.width = ((index + 1) / slides.length) * 100 + "%";
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === slides.length - 1;
    if (slides[index].classList.contains("avd-academy-slide--title")) {
      root.setAttribute("data-at-title", "");
    } else {
      root.removeAttribute("data-at-title");
    }
    var hash = "#/" + (index + 1);
    if (location.hash !== hash) {
      history.replaceState(null, "", hash);
      /* `replaceState` löst KEIN `hashchange` aus – wer auf die Adresse angewiesen
         ist, erfährt den Folienwechsel sonst nie. Das betrifft den QR-Code der
         Seitenadresse (theme/academy/atvantage.js): Er soll auf die Folie zeigen,
         die gerade an der Wand steht, nicht auf die, mit der begonnen wurde.
         Bewusst ein EIGENES Ereignis und kein nachgebautes `hashchange`: Letzteres
         liefe in den Zuhörer weiter unten und damit zurück in `render()`. */
      window.dispatchEvent(new CustomEvent("avd-academy-urlchange"));
    }
  }

  function go(to) {
    var next = Math.max(0, Math.min(slides.length - 1, to));
    // Auch wenn sich nichts ändert (erste/letzte Folie): rendern. Nach einer
    // Wischgeste steht die Schiene sonst verschoben stehen, statt zurückzurasten.
    if (next === index) { render(); return; }
    index = next;
    slides[index].scrollTop = 0;
    render();
  }

  /* --- Gemeinsames Ziehen (Trackpad UND Touch) ------------------------------
     Beide Gesten fühlen sich nur dann gut an, wenn die Schiene SOFORT mitgeht und
     erst beim Loslassen entschieden wird. Deshalb teilen sie sich diese Helfer:
     `dragTo` verschiebt die Schiene relativ zur aktuellen Folie, `dragStart`
     schaltet die Übergangsanimation ab (sonst läuft sie dem Finger hinterher),
     `dragStop` schaltet sie wieder ein, damit das Einrasten animiert ist. */
  var DRAGGING = "avd-academy-deck__track--dragging";

  function dragStart() { track.classList.add(DRAGGING); }
  function dragStop() { track.classList.remove(DRAGGING); }

  function dragTo(px) {
    // An erster und letzter Folie nur gedämpft mitziehen – sichtbar „hier ist Schluss“.
    if ((index === 0 && px > 0) || (index === slides.length - 1 && px < 0)) px *= 0.35;
    track.style.transform = "translateX(calc(" + -index * 100 + "% + " + px + "px))";
  }

  // Schwelle für den Folienwechsel. Zwei Werte, weil die Eingaben verschieden
  // sind: Der Finger schiebt die Folie 1:1 – dort ist ein längerer Weg natürlich.
  // Die Trackpad-Geste ist indirekt und liefert je Wisch deutlich weniger
  // „Pixel“; mit demselben Wert fühlte sie sich zäh an.
  function dragSchwelle() { return Math.min(80, (deck.clientWidth || 1) * 0.12); }
  function wischSchwelle() { return Math.min(50, (deck.clientWidth || 1) * 0.06); }

  function fromHash() {
    var m = /^#\/(\d+)$/.exec(location.hash || "");
    if (!m) return;
    var n = parseInt(m[1], 10) - 1;
    if (!isNaN(n)) index = Math.max(0, Math.min(slides.length - 1, n));
  }

  fromHash();
  render();
  window.addEventListener("hashchange", function () {
    var before = index;
    fromHash();
    if (before !== index) render();
  });

  /* --- 3) Bedienung --------------------------------------------------------- */
  if (prevBtn) prevBtn.addEventListener("click", function () { go(index - 1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { go(index + 1); });

  var printBtn = document.querySelector("[data-avd-academy-present-print]");
  if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

  var fullBtn = document.querySelector("[data-avd-academy-present-full]");
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }
  if (fullBtn) fullBtn.addEventListener("click", toggleFullscreen);

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        go(index + 1); e.preventDefault(); break;
      case "ArrowLeft":
      case "PageUp":
        go(index - 1); e.preventDefault(); break;
      case "Home":
        go(0); e.preventDefault(); break;
      case "End":
        go(slides.length - 1); e.preventDefault(); break;
      case "f":
      case "F":
        toggleFullscreen(); e.preventDefault(); break;
      default:
        break;
    }
  });

  // Wischen (Trackpad/Magic Mouse): Der Browser meldet die Zwei-Finger-Geste als
  // `wheel` mit waagerechtem deltaX (nach links wischen ⇒ deltaX positiv).
  //
  // Die Folie geht SOFORT mit – gewechselt wird aber erst, wenn die Geste die
  // Schwelle überschreitet. Darunter rastet sie zurück. So gibt es in jedem Fall
  // eine Rückmeldung, statt dass ein zu kurzer Wisch spurlos verpufft.
  //
  //   1. ACHSE EINMAL FESTLEGEN – nach dem ersten Ereignis steht fest, ob die
  //      Geste blättert oder scrollt, und sie wechselt bis zum Ende nicht mehr.
  //      Sonst fällt ein leicht schräger Wisch zwischen beide Fälle und ruckelt.
  //   2. GESTE STATT EREIGNIS – ein Wisch erzeugt Dutzende Ereignisse samt
  //      Nachlauf (Momentum). Nach dem Wechsel wird der Rest der Geste ignoriert,
  //      bis 150 ms lang nichts mehr kommt; ein Flick blättert also genau einmal.
  //   3. WAAGERECHT SCROLLBARE INHALTE haben Vorrang: Wer in einem breiten
  //      Codeblock oder einer breiten Tabelle wischt, scrollt dort – erst am
  //      Anschlag blättert die Folie weiter.
  //
  // preventDefault() ist nötig, damit die Geste nicht zusätzlich die
  // Verlaufsnavigation des Browsers („zurück“) auslöst.
  var wSum = 0, wAxis = 0, wDone = false, wTimer = null;
  var wLetzter = 0, wRichtung = 0, wAbfall = 0;

  function wheelEnde() {
    if (wAxis === 1) {
      dragStop();
      if (!wDone) render();          // unter der Schwelle → zurückrasten
    }
    wAxis = 0; wSum = 0; wDone = false; wLetzter = 0; wRichtung = 0; wAbfall = 0;
  }

  function wheelIdle() {
    clearTimeout(wTimer);
    wTimer = setTimeout(wheelEnde, 120);
  }

  // EIN Wisch = EIN Folienwechsel. Nach dem Wechsel wird der Rest der Geste
  // ignoriert – der Nutzer muss loslassen, kann dann aber sofort wieder wischen.
  //
  // Das Loslassen selbst meldet der Browser nicht. Erkennbar ist es am Verlauf:
  // Nach dem Loslassen läuft der NACHLAUF (Momentum), dessen Beträge monoton
  // abklingen. Erst wenn dieses Abklingen deutlich zu sehen war (`wAbfall`), gilt
  // ein danach wieder ANSTEIGENDER Betrag als neuer Wisch.
  //
  // Die Hürde ist bewusst hoch (Abklingen über mehrere Ereignisse UND mehr als
  // doppelter Betrag): Innerhalb eines einzelnen Wischs schwanken die Beträge
  // ständig – beschleunigen, abbremsen, wieder beschleunigen. Eine weichere
  // Regel deutete das als zweiten Wisch und blätterte gleich mehrere Folien.
  //
  // Eine klare Richtungsumkehr zählt immer als neue Absicht: Nachlauf läuft nie
  // rückwärts.
  function neueGeste(dx) {
    var betrag = Math.abs(dx);
    if (betrag <= 2) return false;                                   // Zittern
    if (wRichtung !== 0 && (dx > 0) !== (wRichtung > 0) && betrag > 4) return true;
    return wAbfall >= 4 && betrag > wLetzter * 2 + 2;
  }

  // Nur ECHTE Scroll-Container zählen: `overflow-x: auto|scroll` UND noch Weg in
  // der Wischrichtung. Die Schiene ist ausdrücklich ausgenommen – sie ist n-mal
  // so breit wie die Bühne (n Folien nebeneinander) und sähe sonst wie ein
  // scrollbarer Inhalt aus, der jedes Vorwärtsblättern schluckt.
  function scrollsHorizontally(node, delta) {
    while (node && node !== document && node !== document.documentElement) {
      if (node.nodeType === 1 && node !== track) {
        var ox = getComputedStyle(node).overflowX;
        if (ox === "auto" || ox === "scroll") {
          var max = node.scrollWidth - node.clientWidth;
          if (max > 1 &&
              ((delta > 0 && node.scrollLeft < max - 1) ||
               (delta < 0 && node.scrollLeft > 1))) return true;
        }
      }
      node = node.parentNode;
    }
    return false;
  }

  // Zuständig ist das DOKUMENT, nicht die Bühne: `wheel`-Ereignisse gehen an das
  // Element unter dem Zeiger. Steht der über der Kopfleiste oder den fixierten
  // Blätter-Knöpfen – genau dort landet er nach einem Klick auf „weiter“ –, dann
  // liegen sie AUSSERHALB der Bühne, und ein Wisch lief ins Leere, bis man den
  // Zeiger wieder über die Folie bewegte.
  document.addEventListener("wheel", function (e) {
    if (e.ctrlKey) return;                                   // Pinch-Zoom
    var dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; }                                  // Zeilen
    else if (e.deltaMode === 2) { dx *= deck.clientWidth; dy *= deck.clientHeight; } // Seiten

    var betrag = Math.abs(dx);

    // Läuft nur noch der Nachlauf (oder ist die Geste als „scrollen“ abgehakt),
    // aber es kommt sichtbar ein neuer Wisch: alte Geste beenden, neue beginnen.
    if (wAxis !== 0 && betrag > Math.abs(dy) && (wDone || wAxis === 2) && neueGeste(dx)) {
      if (wAxis === 1) { dragStop(); if (!wDone) render(); }
      wAxis = 0; wSum = 0; wDone = false; wAbfall = 0;
    } else if (wDone && wAbfall >= 4 && betrag < 2) {
      // Der Nachlauf ist ausgelaufen – Geste beenden, ohne aufs Zeitfenster zu
      // warten. Sonst hielten die letzten Ein-Pixel-Ereignisse sie am Leben.
      // Das auslösende Ereignis selbst beginnt NICHTS: Es ist der letzte Zucker
      // des Nachlaufs. Startete es eine Geste, trüge die dessen zufällige
      // Richtung – und die Richtungsumkehr-Regel zündete dann mitten im nächsten
      // Wisch, was mehrere Folien auf einmal weiterblätterte.
      wAxis = 0; wSum = 0; wDone = false; wAbfall = 0; wLetzter = betrag; wRichtung = 0;
      clearTimeout(wTimer);
      return;
    }

    // Abklingen mitzählen: Nur eine LÜCKENLOSE Folge nicht steigender Beträge ist
    // der Nachlauf. Jeder Anstieg setzt den Zähler zurück.
    if (betrag <= wLetzter + 0.5) wAbfall++; else wAbfall = 0;
    wLetzter = betrag;

    if (wAxis === 0) {                                       // Achse festlegen
      // Rauschen (Nachlauf-Zittern, Trackpad-Jitter) beginnt keine Geste – sonst
      // stünde die Richtung der Geste auf einem zufälligen Ein-Pixel-Ereignis.
      if (betrag <= 2) { wheelIdle(); return; }
      if (Math.abs(dx) <= Math.abs(dy)) { wAxis = 2; wheelIdle(); return; }
      if (scrollsHorizontally(e.target, dx)) { wAxis = 2; wheelIdle(); return; }
      wAxis = 1; wSum = 0; wDone = false; wRichtung = dx;
      dragStart();
    }
    wheelIdle();
    if (wAxis !== 1) return;                                 // senkrecht → Browser scrollt

    e.preventDefault();
    if (wDone) return;                                       // Nachlauf der Geste

    wSum += dx;
    dragTo(-wSum);                                           // Folie folgt sofort

    if (Math.abs(wSum) >= wischSchwelle()) {
      wDone = true;
      wRichtung = wSum;      // die Richtung, in die tatsächlich gewischt wurde
      dragStop();
      go(wSum > 0 ? index + 1 : index - 1);
    }
  }, { passive: false });

  // Wischen (Touch): Die Folie folgt dem Finger und rastet beim Loslassen ein.
  //
  // Die Geste entscheidet sich EINMAL – nach den ersten paar Pixeln steht die
  // Achse fest (`axis`) und wechselt bis zum Loslassen nicht mehr. Damit gerät
  // ein Wisch nicht zwischen Blättern und Scrollen.
  //   axis 1 = waagerecht → wir blättern, die Schiene folgt dem Finger
  //   axis 2 = senkrecht ODER waagerecht scrollbarer Inhalt → der Browser scrollt
  //
  // Ausgelöst wird beim Loslassen über Strecke ODER Tempo: Ein kurzer, schneller
  // Flick zählt genauso wie ein langes Ziehen – sonst fühlt sich die Geste
  // schwerfällig an, weil kurze Wische unter der Strecken-Schwelle verpuffen.
  var tStartX = 0, tStartY = 0, tStartTime = 0, tDelta = 0, tAxis = 0, tActive = false;

  function dragOff() {
    dragStop();
    tActive = false; tAxis = 0; tDelta = 0;
  }

  document.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { if (tActive) { dragOff(); render(); } return; }
    tActive = true; tAxis = 0; tDelta = 0;
    tStartX = e.touches[0].clientX;
    tStartY = e.touches[0].clientY;
    tStartTime = e.timeStamp;
  }, { passive: true });

  document.addEventListener("touchmove", function (e) {
    if (!tActive) return;
    if (e.touches.length !== 1) { dragOff(); render(); return; }   // Pinch o. Ä.
    var dx = e.touches[0].clientX - tStartX;
    var dy = e.touches[0].clientY - tStartY;

    if (tAxis === 0) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;             // noch unentschieden
      if (Math.abs(dx) <= Math.abs(dy)) { tAxis = 2; return; }      // senkrecht
      if (scrollsHorizontally(e.target, -dx)) { tAxis = 2; return; } // Inhalt scrollt
      tAxis = 1;
      dragStart();
    }
    if (tAxis !== 1) return;

    tDelta = dx;
    dragTo(dx);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchend", function (e) {
    if (!tActive) return;
    if (tAxis !== 1) { dragOff(); return; }
    var dx = tDelta;
    var dt = e.timeStamp - tStartTime;
    var weit = Math.abs(dx) > dragSchwelle();
    var flink = dt < 300 && Math.abs(dx) > 40;
    var ziel = index;
    if (weit || flink) ziel = dx < 0 ? index + 1 : index - 1;
    dragOff();
    if (ziel !== index) go(ziel); else render();   // sonst zurückrasten
  }, { passive: true });

  document.addEventListener("touchcancel", function () {
    if (!tActive) return;
    var war = tAxis === 1;
    dragOff();
    if (war) render();
  }, { passive: true });
})();
