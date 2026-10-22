(function () {
  "use strict";
  var sim = window.skr.ext.didaktikon.simulation;

  /* Beide Szenarien teilen sich die Bühne. Die Kennung aus `ctx.scenario`
     entscheidet nur, WELCHE Tafeln gezeichnet werden – gezeichnet wird gleich. */
  var ZIELE = {
    container:      { reg: "reg-images",   img: "lok-images",   ctr: "lok-container",   term: "term",   panel: "reg-panel-1", leitung: "leitung-1" },
    aktualisierung: { reg: "reg-images-2", img: "lok-images-2", ctr: "lok-container-2", term: "term-2", panel: "reg-panel-2", leitung: "leitung-2" }
  };

  function hebt(s, id) { return (s.hebe || []).indexOf(id) !== -1; }

  /* Welche Farbe eine Kennung traegt, steht fest und gilt in BEIDEN Szenarien –
     sonst muesste man beim Wechsel neu lernen, was violett bedeutet. */
  var BINDUNG = { a1b2c3: 0, a4f901: 1 };
  function bindung(el, kurz) {
    el.classList.remove("lz-bindung--0", "lz-bindung--1");
    var n = BINDUNG[kurz];
    if (n !== undefined) el.classList.add("lz-bindung--" + n);
  }

  /* Eine Image-Zeile: Name links, kurze ID rechts. Die ID ist der Beleg dafür,
     dass zwei gleich benannte Images nicht dasselbe sein müssen. */
  /* --- Die Zeichnungen -------------------------------------------------------
     Alles inline, alles in `currentColor` – damit erbt jede Figur die Farbe der
     Zelle, in der sie steckt, und kippt im dunklen Schema von selbst mit.
     Keine Bilddatei: Die Simulation braucht nichts außer Seite, Stylesheet und Skript. */

  /* Ein Image ist eine Schichtung. Noch KEIN Layer-Unterricht (der kommt
     spaeter) – nur das Sinnbild, das dort wiedererkannt wird. */
  var BILD_STAPEL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" fill="currentColor" fill-opacity="0.18"/>' +
    '<path d="m3 12.5 9 4.5 9-4.5"/><path d="m3 17 9 4.5 9-4.5"/></svg>';

  /* Das Dateisystem als kleine Baumstruktur: eine Wurzel, zwei Aeste, und ein
     dritter Ast erscheint, sobald im Container etwas geschrieben wurde. */
  function bildBaum(mitDatei) {
    return '<svg viewBox="0 0 48 34" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M10 4v24"/>' +
      '<path d="M10 10h7"/><rect x="17" y="6.5" width="13" height="7" rx="1.5"/>' +
      '<path d="M10 19h7"/><rect x="17" y="15.5" width="16" height="7" rx="1.5"/>' +
      (mitDatei
        ? '<path d="M10 28h7"/><rect x="17" y="24.5" width="19" height="7" rx="1.5" ' +
          'fill="currentColor" fill-opacity="0.2"/>'
        : '') +
      '</svg>';
  }

  /* Prozesse als parallele Faeden. Laufen sie, wandert die Strichelung – das
     macht `stop` sichtbar, ohne dass ein Wort noetig waere. */
  var BILD_FAEDEN =
    '<svg viewBox="0 0 48 34" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" aria-hidden="true">' +
    '<path class="lz-faden" d="M4 9h40" stroke-dasharray="6 6"/>' +
    '<path class="lz-faden" d="M4 17h40" stroke-dasharray="6 6" style="animation-delay:-0.6s"/>' +
    '<path class="lz-faden" d="M4 25h40" stroke-dasharray="6 6" style="animation-delay:-1.2s"/>' +
    '</svg>';

  /* Die Umgebung als Etiketten – Schluessel mit Wert, angehaengt an den
     Container. Sie gehoeren zur Festlegung, nicht zum Lauf. */
  var BILD_ETIKETTEN =
    '<svg viewBox="0 0 48 34" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 6h22l8 5.5-8 5.5H6Z" fill="currentColor" fill-opacity="0.14"/>' +
    '<circle cx="11" cy="11.5" r="1.4"/>' +
    '<path d="M12 20h22l8 5.5-8 5.5H12Z"/>' +
    '<circle cx="17" cy="25.5" r="1.4"/></svg>';

  /* Der Stecker sitzt am Rand: gesteckt, solange der Container laeuft. */
  function bildStecker(gesteckt) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 9v6"/>' +
      '<path d="M8 8v8h4a4 4 0 0 0 4-4V8Z" fill="currentColor" fill-opacity="' +
      (gesteckt ? '0.22' : '0') + '"/>' +
      '<path d="M16 12h5" stroke-dasharray="' + (gesteckt ? '0' : '3 3') + '"/>' +
      '</svg>';
  }

  /* Dasselbe Sinnbild wie in der Tafel-Ueberschrift: Was hier steht, ist ein
     Container – erkennbar, bevor man den Namen liest. */
  var BILD_KISTE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z"/>' +
    '<path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>';

  /* Der gestrichelte Pfeil mit offener Spitze – UML `«instanceof»`. */
  /* `preserveAspectRatio="none"` zieht die Linie auf die volle Breite; damit
     Strichstaerke und Spitze dabei NICHT mitverzerren, haengen beide an
     `vector-effect="non-scaling-stroke"`. */
  /* EIN PFEIL MIT KNICK. Waagerecht funktionierte er nur, solange Container und
     Image auf derselben Hoehe standen. Sobald der zweite Container unten sitzt
     und seine Karte oben, verbindet eine waagerechte Linie nichts mehr – sie
     schwebt irgendwo dazwischen.

     Jetzt laeuft er wie ein UML-Verbinder: waagerecht aus dem Container heraus,
     senkrecht durch die Gasse, waagerecht in die Karte hinein. Die Spitze bleibt
     dadurch IMMER waagerecht und muss nicht mitgedreht werden.

     Gezeichnet wird in Pixeln: Das Skript setzt `viewBox` auf die tatsaechliche
     Groesse des Elements – deshalb kein `preserveAspectRatio` und keine
     Verzerrung. */
  var BILD_PFEIL =
    '<svg class="lz-ctr__linie" viewBox="0 0 60 14" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path class="lz-ctr__bahn" d="M60 7H11" stroke-dasharray="5 3.5"/>' +
    '<path class="lz-ctr__spitze" d="M11 2 2 7l9 5"/></svg>';

  function imageZeile() {
    var el = document.createElement("div");
    el.className = "skr-didaktikon-simulation-cell lz-img";
    el.innerHTML =
      '<span class="lz-img__kopf">' +
        '<span class="lz-img__marke">' +
          '<span class="lz-img__stapel">' + BILD_STAPEL + '</span>' +
          '<span class="lz-img__repo"></span>' +
        '</span>' +
        '<span class="lz-img__hash"></span>' +
      '</span>' +
      '<span class="lz-img__env">' +
        '<span class="lz-img__env-schild">ENV</span>' +
        '<span class="lz-img__env-wert"></span>' +
      '</span>' +
      '<span class="lz-img__tags"></span>';
    return el;
  }

  /* Die drei Anteile IM Container, in fester Reihenfolge: erst was bleibt, dann
     was mit dem Lauf kommt und geht. So steht die Trennung schon in der
     Anordnung. Der Port ist bewusst NICHT dabei – er sitzt am Rand. */
  var TEILE = [
    { schl: "dateien",  text: "Dateisystem" },
    { schl: "umgebung", text: "Umgebungsvariablen" },
    { schl: "prozesse", text: "Prozesse" }
  ];

  function containerZeile() {
    var el = document.createElement("div");
    el.className = "skr-didaktikon-simulation-cell lz-ctr";
    el.innerHTML =
      '<span class="lz-ctr__kopf">' +
        '<span class="lz-zeile__links">' +
          '<span class="lz-ctr__marke">' +
            '<span class="lz-ctr__sinnbild">' + BILD_KISTE + '</span>' +
            '<span class="lz-zeile__name"></span>' +
          '</span>' +
        '</span>' +
        '<span class="lz-zeile__rechts">' +
          '<span class="lz-status"><span class="lz-status__zeichen"></span>' +
          '<span class="lz-nur-sr"></span></span>' +
        '</span>' +
      '</span>' +
      '<span class="lz-ctr__innen">' +
        TEILE.map(function (t) {
          return '<span class="lz-teil" data-teil="' + t.schl + '">' +
                 '<span class="lz-teil__bild"></span>' +
                 '<span class="lz-teil__text">' + t.text + '</span>' +
                 '<span class="lz-teil__wert"></span>' +
                 '<span class="lz-nur-sr"></span></span>';
        }).join("") +
      '</span>' +
      '<span class="lz-ctr__pfeil">' +
        '<span class="lz-ctr__pfeil-text">&laquo;instanceof&raquo;</span>' +
        BILD_PFEIL +
      '</span>' +
      '<span class="lz-ctr__port"></span>' +
      '<span class="lz-ctr__portnr"></span>' +
      '<span class="lz-nur-sr lz-ctr__portsr"></span>';
    return el;
  }

  function zeichneImages(s, knotenId, liste, ctx, tagsVorher) {
    sim.list(document.getElementById(knotenId), liste, {
      animated: ctx.animated,
      key: function (x) { return x.id; },
      create: imageZeile,
      update: function (el, x) {
        /* Der Repository-Name gehoert auf die Karte: Ohne ihn stehen dort nur
           Kennung und Etiketten, und niemand sieht mehr, WELCHES Image das ist. */
        el.querySelector(".lz-img__repo").textContent = x.repo || "";
        el.querySelector(".lz-img__hash").textContent = x.kurz;
        /* Die Tags haengen AM Image, sie sind es nicht. Deshalb eine Reihe
           Etiketten unter dem Hash – in Szenario 2 wandert `latest` dann
           sichtbar von einer Karte zur anderen. */
        var tags = (tagsVorher && tagsVorher[x.id]) || x.tags;
        el.querySelector(".lz-img__tags").innerHTML = (tags && tags.length)
          ? tags.map(function (t) {
              return '<span class="skr-badge lz-tag" data-tag="' + t + '">' + t + '</span>';
            }).join("")
          : '<span class="lz-img__ohne">ohne Tag</span>';
        /* Die Umgebungsvariable steckt im Bauplan – sie kommt aus dem
           Dockerfile (`ENV`) und wandert beim Erzeugen in den Container. */
        /* Das ENV-Schild steht nur da, wenn der Bauplan wirklich eine Variable
           setzt – ein leerer Rahmen waere eine Behauptung. */
        var env = el.querySelector(".lz-img__env");
        env.querySelector(".lz-img__env-wert").textContent = x.env || "";
        env.hidden = !x.env;
        bindung(el, x.kurz);
        el.classList.toggle("is-active", hebt(s, x.id));
      }
    });
  }

  /* `opt` sagt, was in DIESER Phase noch nicht zu sehen sein soll – siehe die
     Choreografie weiter unten. Ohne `opt` wird alles gezeigt.

       zurueck      Kennungen, die noch gar nicht auf der Buehne stehen
       ohneZustand  fuer DIESE Container bleibt ein frisch geschriebener
                    Dateiname noch weg
       ohneStart    diese Container werden als ANGEHALTEN gezeichnet, auch wenn
                    der Zustand schon "laeuft" sagt – das Starten ist ein
                    Vorgang und bekommt seine eigene Phase
       ohneStop     das Gegenstueck: als LAEUFT gezeichnet, obwohl der Zustand
                    schon "angehalten" sagt. Auch das Anhalten braucht einen
                    Moment – nur ohne Glimmen, es faehrt ja nichts hoch
       zeigeWeg     Container, die dieser Schritt LOESCHT, aber noch einmal
                    gezeichnet werden: Auch das Verschwinden gehoert hinter den
                    Befehl, nicht davor
       tagsVorher   Kennung -> Etiketten im Stand VOR diesem Schritt. Damit
                    bleibt `latest` am alten Image haengen, bis das neue
                    angekommen ist – erst dann wandert es hinueber */
  function ohne(liste, zurueck) {
    if (!zurueck || !zurueck.length) return liste;
    return liste.filter(function (x) { return zurueck.indexOf(x.id) === -1; });
  }

  function zeichne(s, ctx, opt) {
    opt = opt || {};
    var zurueck      = opt.zurueck;
    var ohneZustand  = opt.ohneZustand || [];
    var ohneStart    = opt.ohneStart || [];
    var ohneStop     = opt.ohneStop  || [];
    var zeigeWeg     = opt.zeigeWeg  || [];
    var tagsVorher   = opt.tagsVorher || null;
    var ziel = ZIELE[ctx.scenario] || ZIELE.container;

    zeichneImages(s, ziel.reg, ohne(s.remote, zurueck), ctx, tagsVorher);
    zeichneImages(s, ziel.img, ohne(s.images, zurueck), ctx, tagsVorher);

    sim.list(document.getElementById(ziel.ctr),
             ohne(s.container, zurueck).concat(zeigeWeg), {
      animated: ctx.animated,
      key: function (c) { return c.id; },
      create: containerZeile,
      update: function (el, c) {
        el.querySelector(".lz-zeile__name").textContent = c.name;
        /* Die Kennung steht NICHT am Pfeil – sie stuende dort ein zweites Mal,
           denn die Image-Karte, auf die er zeigt, traegt sie schon. Wer die
           Zuordnung nicht sehen kann, bekommt sie aus `title` und dem
           Screenreader-Text der Zelle. */
        el.querySelector(".lz-ctr__pfeil").setAttribute("title",
          c.name + " ist eine Ausprägung des Images " + c.kurz);
        /* Der Platz haengt am Container, nicht an seiner Stelle in der Liste:
           Verschwindet der erste, bleibt der zweite, wo er war. */
        el.style.setProperty("--lz-platz", c.platz || 1);
        bindung(el, c.kurz);
        /* Das Zeichen traegt die Aussage, das Wort bleibt fuer Screenreader
           daneben stehen – ein Punkt allein ist nicht vorlesbar. */
        var laeuft = ohneStop.indexOf(c.id) !== -1
          ? true
          : (c.status === "laeuft" && ohneStart.indexOf(c.id) === -1);
        var st = el.querySelector(".lz-status");
        st.className = "lz-status lz-status--" + (laeuft ? "laeuft" : "angehalten");
        st.setAttribute("title", laeuft ? "läuft" : "angehalten");
        el.querySelector(".lz-nur-sr").textContent = laeuft ? "läuft" : "angehalten";
        /* Der geschriebene Zustand kann eine Phase lang zurueckgehalten werden:
           Erst der Befehl, dann die Datei. Sie erscheint IM Dateisystem-Kaestchen
           und nicht in der Kopfzeile – dort stuende sie neben dem Container statt
           darin. */
        var zustand = ohneZustand.indexOf(c.id) !== -1 ? "" : (c.zustand || "");

        /* Dateisystem und Umgebung gehoeren zur Festlegung des Containers und
           sind da, solange es ihn gibt. Prozesse und Ports gibt es nur, solange
           er laeuft – deshalb haengen genau diese beiden am Status. */
        /* ALLE Anteile haengen am Lauf: Ein angehaltener Container tut nichts,
           und das soll man sehen. Dass er trotzdem nicht leer ist, sagt der
           INHALT – der Baum behaelt seinen Ast, die Variable ihren Wert. Weg
           ist erst, was nach `rm` weg ist: die ganze Zelle. */
        var an = { dateien: laeuft, umgebung: laeuft, prozesse: laeuft };
        var bild = {
          dateien:  bildBaum(!!zustand),
          umgebung: BILD_ETIKETTEN,
          prozesse: BILD_FAEDEN
        };
        TEILE.forEach(function (t) {
          var kasten = el.querySelector('[data-teil="' + t.schl + '"]');
          var da = !!an[t.schl];
          kasten.className = "lz-teil " + (da ? "is-an" : "is-aus");
          kasten.querySelector(".lz-teil__bild").innerHTML = bild[t.schl];
          /* Nur die Umgebungsvariable traegt einen konkreten Wert – an ihm
             sieht man, WANN ein Container etwas aus dem Image uebernimmt. */
          kasten.querySelector(".lz-teil__wert").textContent =
            t.schl === "umgebung" ? (c.env || "") :
            t.schl === "dateien"  ? zustand : "";
          var lage = da ? "vorhanden" : "nicht vorhanden, erst wenn er läuft";
          kasten.setAttribute("title", t.text + " – " + lage);
          kasten.querySelector(".lz-nur-sr").textContent = t.text + ": " + lage + ".";
        });

        /* Der Port sitzt am RAND, nicht im Inneren: Er ist die Stelle, an der
           die Aussenwelt andockt. Gesteckt nur, solange der Container laeuft. */
        var stecker = el.querySelector(".lz-ctr__port");
        stecker.className = "lz-ctr__port " + (laeuft ? "is-an" : "is-aus");
        stecker.innerHTML = bildStecker(laeuft);
        var portlage = laeuft
          ? "Port " + c.port + " ist belegt"
          : "kein Port belegt, der Container läuft nicht";
        stecker.setAttribute("title", portlage);
        el.querySelector(".lz-ctr__portnr").textContent = laeuft ? c.port : "";
        el.querySelector(".lz-ctr__portsr").textContent = portlage + "."; 

        el.classList.toggle("is-active", hebt(s, c.id));
      }
    });

    var konsole = document.getElementById(ziel.term);
    sim.list(konsole, s.term, {
      animated: ctx.animated,
      key: function (t) { return t.id; },
      create: function () {
        var el = document.createElement("div");
        el.className = "lz-cmd";
        el.innerHTML = '<span class="lz-cmd__prompt">$</span>' +
                       '<span class="lz-cmd__text"></span>';
        return el;
      },
      update: function (el, t, i) {
        el.querySelector(".lz-cmd__text").textContent = t.cmd;
        el.classList.toggle("is-active", i === s.term.length - 1);
      }
    });
    /* Die Konsole zeigt nur die letzten Zeilen – der neue Befehl muss also
       hereingerollt werden, sonst tippt sie unsichtbar weiter. */
    ansEnde(konsole);

    /* Die Registry meldet sich nur, wenn sich dort etwas getan hat – der einzige
       Moment im ganzen Ablauf, in dem die Bewegung NICHT vom Befehl ausgeht. */
    var panel = document.getElementById(ziel.panel);
    if (panel) {
      panel.classList.toggle("is-active", !!s.registryMeldet);
      if (s.registryMeldet && ctx.animated) { sim.pulse(panel); }
    }

    /* DER PFEIL ZEIGT AUF SEIN IMAGE. Er sitzt links an der Container-Zelle und
       lief bisher immer waagerecht auf Hoehe des Zellenkopfs los – bei zwei
       Image-Karten traf er damit die obere, egal auf welche er zeigen sollte.
       Jetzt wird er auf die Mitte SEINER Karte gesetzt.

       Gemessen wird im Browser; faellt die Messung flach (kein Layout, etwa in
       einer Pruefung), bleibt der Pfeil, wo er ist – null Verschiebung. */
    var bilderTafel = document.getElementById(ziel.img);
    var ctrTafel    = document.getElementById(ziel.ctr);
    if (bilderTafel && ctrTafel) {
      Array.prototype.forEach.call(ctrTafel.querySelectorAll(".lz-ctr"), function (zelle) {
        var pfeil = zelle.querySelector(".lz-ctr__pfeil");
        var c = (s.container.concat(zeigeWeg)).filter(function (x) {
          return x.id === zelle.getAttribute("data-sim-key");
        })[0];
        if (!pfeil || !c) return;
        var karte = null;
        Array.prototype.forEach.call(bilderTafel.querySelectorAll(".lz-img"), function (k) {
          if (k.textContent.indexOf(c.kurz) !== -1) karte = k;
        });
        if (!karte) return;
        /* GEMESSEN WIRD OHNE TRANSFORMATIONEN. `getBoundingClientRect` liefert
           die Lage NACH einer laufenden Animation – und eine frisch eingefuegte
           Zelle traegt `is-new`, das sie aus einem halben rem Tiefe einblendet.
           Der Pfeil wurde damit acht Pixel zu tief berechnet und rueckte nach,
           sobald die Einblendung durch war.

           `offsetTop` und `offsetHeight` kennen keine Transformationen: Sie
           liefern die endgueltige Lage schon waehrend der Einblendung. Deshalb
           steht der Pfeil vom ersten Bild an dort, wo er hingehoert. */
        if (!zelle.offsetHeight || !karte.offsetHeight) return;  /* ohne Layout nichts tun */

        var ANKER = 15;                             /* Hoehe der Namenszeile */
        var yA = ANKER;                             /* am Container, relativ zur Zelle */
        var yB = (absY(karte) + karte.offsetHeight / 2) - absY(zelle);
        var oben  = Math.min(yA, yB) - 7;
        var hoehe = Math.abs(yB - yA) + 14;

        /* IMMER NEU RECHNEN, NIE EINEN ALTEN WERT STEHENLASSEN. Hier stand
           einmal ein Riegel, der nur bei mehr als zwei Pixel Unterschied
           geschrieben hat – gut gemeint gegen das Zittern, aber falsch herum
           gedacht: Er liess damit den ERSTEN Messwert stehen, und der entsteht
           mitten in der Choreografie, wenn die Buehne noch gar nicht fertig
           ist. Beim zweiten Container endete der Pfeil deshalb erst dort, wo
           der erste endet, und sprang danach an seinen richtigen Platz.

           Das Zittern kam in Wahrheit vom Uebergang auf `top`. Der ist weg;
           ohne ihn faellt ein Pixel Unterschied nicht auf, und der Pfeil ist
           zu JEDEM Zeitpunkt da, wo er hingehoert. */
        pfeil.style.top    = Math.round(oben) + "px";
        pfeil.style.height = Math.round(hoehe) + "px";

        var breite = pfeil.offsetWidth || 60;
        var y1 = Math.round(yA - oben), y2 = Math.round(yB - oben);
        var mitte = Math.round(breite * 0.45);
        var svg = pfeil.querySelector(".lz-ctr__linie");
        if (!svg) return;
        svg.setAttribute("viewBox", "0 0 " + Math.round(breite) + " " + Math.round(hoehe));
        svg.querySelector(".lz-ctr__bahn").setAttribute("d",
          "M" + Math.round(breite) + " " + y1 + " H" + mitte + " V" + y2 + " H11");
        svg.querySelector(".lz-ctr__spitze").setAttribute("d",
          "M11 " + (y2 - 5) + " L2 " + y2 + " L11 " + (y2 + 5));
        /* Das Stereotyp bleibt AM CONTAINER, nicht am Knick. */
        var text = pfeil.querySelector(".lz-ctr__pfeil-text");
        if (text) text.style.top = y1 + "px";
      });
    }

    /* Das Paket bekommt die Farbe des Images, das gerade wandert – und die Form
       des Stapels, damit erkennbar ist, WAS da uebertragen wird. Gestartet wird
       die Leitung nicht hier, sondern von der Choreografie: Sie laeuft erst,
       nachdem der Befehl getippt ist. */
    var leitung = document.getElementById(ziel.leitung);
    if (leitung) {
      var paket = leitung.querySelector(".lz__paket");
      if (paket) {
        var neuestes = s.images.length ? s.images[s.images.length - 1] : null;
        paket.innerHTML = BILD_STAPEL;
        bindung(paket, neuestes ? neuestes.kurz : null);
      }
    }
  }

  /* --- Die Choreografie ------------------------------------------------------
     EIN SCHRITT IST EINE KETTE, KEIN AUGENBLICK. Vorher erschien alles
     gleichzeitig: der Befehl stand da, das Paket flog, und das Image war schon
     angekommen – man konnte nicht sehen, was wovon kommt.

     Jetzt laeuft es in der Reihenfolge, in der es auch wirklich passiert:

       1. Der Befehl wird getippt, Zeichen fuer Zeichen, in der Konsole.
       2. Erst danach laeuft das Paket ueber die Leitung – wenn es eines gibt.
       3. Erst danach steht das Neue auf der Buehne.

     NUR BEIM SCHRITT VORWAERTS. Beim Zurueckgehen, beim Springen und beim
     ersten Zeichnen steht das Bild sofort vollstaendig – dort waere die
     Choreografie eine Verzoegerung ohne Aussage. */
  /* NUR DIE GEMEINTEN ZELLEN. `sim.list` haengt die Kennung als `data-sim-key`
     an jede Zelle – darueber laesst sich genau die eine treffen, um die es geht.
     Vorher liefen `querySelectorAll(".lz-ctr")` ueber ALLE, und beim Starten des
     zweiten Containers pulste der erste mit. */
  function zellenFuer(knoten, ids) {
    if (!knoten || !ids || !ids.length) return [];
    return ids.map(function (id) {
      return knoten.querySelector('[data-sim-key="' + id + '"]');
    }).filter(Boolean);
  }

  var REDUZIERT = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var LAEUFT = [];
  function abbrechen() {
    LAEUFT.forEach(function (t) { clearTimeout(t); });
    LAEUFT = [];
  }

  /* --- Nichts aus dem vorigen Schritt stehenlassen ---------------------------
     Die Klassen fuer Pulsen, Blinken und die Leitung nimmt normalerweise ein
     Timer wieder ab. Wer schneller weiterklickt, als die Animation dauert,
     bricht diesen Timer ab – und die Klasse bleibt kleben. Genau so pulste
     beim Erzeugen des zweiten Containers auf einmal auch der erste mit: Er
     trug sein `is-startet` noch von seinem eigenen Start.

     Deshalb wird zu Beginn JEDES Schritts aufgeraeumt, statt sich darauf zu
     verlassen, dass der vorige sauber zu Ende gelaufen ist. */
  function aufraeumen() {
    Array.prototype.forEach.call(
      document.querySelectorAll(".lz-ctr.is-startet"), function (e) {
        e.classList.remove("is-startet");
      });
    Array.prototype.forEach.call(
      document.querySelectorAll(".lz-teil.is-frisch"), function (e) {
        e.classList.remove("is-frisch");
      });
    Array.prototype.forEach.call(
      document.querySelectorAll(".lz__leitung"), function (e) {
        e.classList.remove("is-anfrage", "is-transfer");
      });
  }
  function spaeter(fn, ms) { LAEUFT.push(setTimeout(fn, ms)); }

  /* Senkrechte Lage OHNE Transformationen – siehe die Begruendung beim Pfeil. */
  function absY(el) {
    var y = 0;
    while (el) { y += el.offsetTop || 0; el = el.offsetParent; }
    return y;
  }

  /* Immer ans untere Ende: Die Konsole ist kleiner als ihre Geschichte. */
  function ansEnde(el) { if (el) el.scrollTop = el.scrollHeight; }

  /* --- Ein wanderndes Etikett -----------------------------------------------
     `latest` haengt in Szenario 2 erst am alten Image und danach am neuen. Wenn
     es dort einfach verschwindet und hier einfach auftaucht, sieht es aus wie
     zwei Etiketten – dabei ist es DASSELBE, nur umgehaengt. Und genau das ist
     die Aussage des Szenarios.

     Gemacht wird das nach dem Muster "First, Last, Invert, Play": Ort merken,
     neu zeichnen, die Differenz als Verschiebung zurueckrechnen und sie
     weganimieren. Der Browser bewegt danach ein Element, das wirklich dasselbe
     ist – kein Nachbau, der daneben herfliegt.

     Faellt `getBoundingClientRect` flach (kein Layout, etwa in einer Pruefung),
     ist die Differenz null und es passiert schlicht nichts. */
  function tagOrte(buehne) {
    var orte = {};
    if (!buehne) return orte;
    Array.prototype.forEach.call(buehne.querySelectorAll(".lz-tag"), function (t) {
      var tafel = t.closest ? t.closest(".skr-didaktikon-simulation-panel__body") : null;
      orte[(tafel ? tafel.id : "?") + "|" + t.getAttribute("data-tag")] =
        t.getBoundingClientRect();
    });
    return orte;
  }

  function mitWanderndenTags(buehne, zeichnen) {
    if (!buehne || !buehne.querySelectorAll) { zeichnen(); return; }
    var vorher = tagOrte(buehne);
    zeichnen();
    if (REDUZIERT) return;
    Array.prototype.forEach.call(buehne.querySelectorAll(".lz-tag"), function (t) {
      var tafel = t.closest ? t.closest(".skr-didaktikon-simulation-panel__body") : null;
      var alt = vorher[(tafel ? tafel.id : "?") + "|" + t.getAttribute("data-tag")];
      if (!alt) return;                          /* neu, nicht gewandert */
      var jetzt = t.getBoundingClientRect();
      var dx = alt.left - jetzt.left, dy = alt.top - jetzt.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      t.style.transition = "none";
      t.style.transform  = "translate(" + dx + "px, " + dy + "px)";
      void t.offsetWidth;                        /* Reflow → der Sprung gilt */
      t.style.transition = "transform 620ms cubic-bezier(0.4, 0, 0.2, 1)";
      t.style.transform  = "";
      spaeter(function () { t.style.transition = ""; }, 700);
    });
  }

  var TIPPTEMPO = 16;     /* ms je Zeichen */
  var TIPPMAX   = 900;    /* laenger als das wird kein Befehl getippt */

  function tippe(el, text, fertig) {
    if (!el) { fertig(); return; }
    var tempo = Math.min(TIPPTEMPO, Math.max(6, TIPPMAX / Math.max(text.length, 1)));
    el.textContent = "";
    /* Beim Tippen mitrollen: Bricht die Zeile um, waechst sie waehrenddessen. */
    var feld = el.closest ? el.closest('[id^="term"]') : null;
    var i = 0;
    (function weiter() {
      el.textContent = text.slice(0, ++i);
      ansEnde(feld);
      if (i < text.length) spaeter(weiter, tempo);
      else spaeter(fertig, 180);
    })();
  }

  function auffuehren(s, ctx) {
    abbrechen();
    aufraeumen();
    var ziel = ZIELE[ctx.scenario] || ZIELE.container;

    /* Sofort fertig: rueckwaerts, gesprungen, erstes Bild, reduzierte Bewegung. */
    if (!(ctx.animated && ctx.direction > 0)) { zeichne(s, ctx, null); return; }

    var neu   = s.neu || [];
    var spaet = s.zustandSpaet || [];
    var start = s.startSpaet || [];
    var stopp = s.stopSpaet  || [];
    var weg   = s.weg        || [];
    var tagsV = s.tagsVorher || null;

    /* Phase 1 – nur der Befehl. Das Neue bleibt weg, ein frisch geschriebener
       Zustand ebenfalls, und ein Container, der gerade gestartet wird, steht
       weiter als angehalten da. */
    zeichne(s, ctx, { zurueck: neu, ohneZustand: spaet, ohneStart: start,
                      ohneStop: stopp, zeigeWeg: weg, tagsVorher: tagsV });

    var zeilen = document.getElementById(ziel.term);
    var letzte = zeilen && zeilen.lastElementChild;
    var text   = s.term.length ? s.term[s.term.length - 1].cmd : "";
    var frisch = letzte && letzte.classList.contains("is-new");

    /* Phase 4 – zuletzt das, was IM Container entsteht: der Dateiname im
       Dateisystem-Kaestchen und der dritte Ast im Baum. Das Kaestchen blinkt
       dabei kurz auf, sonst uebersieht man die Aenderung in einem Bild, das
       ohnehin schon voll ist. */
    function zumSchluss() {
      if (!spaet.length) return;
      spaeter(function () {
        zeichne(s, ctx, null);
        /* Auch hier nur die betroffene Zelle – blinkte jede, waere das Blinken
           keine Aussage mehr, sondern Dekor. */
        zellenFuer(document.getElementById(ziel.ctr), spaet).forEach(function (z) {
          var f = z.querySelector('.lz-teil[data-teil="dateien"]');
          if (!f) return;
          f.classList.remove("is-frisch");
          void f.offsetWidth;
          f.classList.add("is-frisch");
          spaeter(function () { f.classList.remove("is-frisch"); }, 1000);
        });
      }, 420);
    }

    /* Phase 3b – DAS STARTEN IST EIN VORGANG. Bevor der Container warm
       dasteht, pulst sein Kasten dreimal: Da faehrt etwas hoch. Erst danach
       der Endzustand mit den gruenen Glimmen. */
    var PULSE = 3, PULSDAUER = 700;   /* muss zu `lz-hochfahren` im Stil passen */
    function dannStarten() {
      if (!start.length) return;
      var zellen = zellenFuer(document.getElementById(ziel.ctr), start);
      zellen.forEach(function (z) {
        z.classList.remove("is-startet");
        void z.offsetWidth;                     /* Reflow → Animation startet neu */
        z.classList.add("is-startet");
      });
      spaeter(function () {
        zellen.forEach(function (z) { z.classList.remove("is-startet"); });
        zeichne(s, ctx, { ohneZustand: spaet });   /* jetzt laeuft er */
        zumSchluss();
      }, PULSE * PULSDAUER);
    }

    /* Phase 3c – das Anhalten. Wie das Starten ein Vorgang und nicht ein
       Umschalten, aber OHNE Pulsen: Es faehrt nichts hoch, es geht etwas aus. */
    function dannStoppen() {
      spaeter(function () {
        zeichne(s, ctx, { ohneZustand: spaet });
        zumSchluss();
      }, 420);
    }

    /* Phase 3 – das Neue steht auf der Buehne. */
    function dannDasNeue(verzug) {
      spaeter(function () {
        /* Ab hier ist das Geloeschte wirklich weg – `zeigeWeg` entfaellt, und
           `sim.list` blendet die Zelle aus. Ein Etikett, das dabei die Karte
           wechselt, wandert sichtbar hinueber. */
        mitWanderndenTags(document.querySelector(
          '[data-skr-didaktikon-simulation-scene="' + ctx.scenario + '"]'), function () {
          zeichne(s, ctx, { ohneZustand: spaet, ohneStart: start, ohneStop: stopp });
        });
        if (start.length)      dannStarten();
        else if (stopp.length) dannStoppen();
        else                   zumSchluss();
      }, verzug);
    }

    /* Phase 2 – die Leitung, und zwar in ZWEI Zuegen: erst die Anfrage vom
       Zielsystem zur Registry, dann das Image zurueck. Ein `pull` holt; es wird
       nichts geschickt. Wer nur den Rueckweg zeigt, verliert, wer hier fragt. */
    var ANFRAGE = 450, RUECKWEG = 900;
    function danach() {
      if (!s.uebertraegt) { dannDasNeue(140); return; }
      var leitung = document.getElementById(ziel.leitung);
      if (leitung) {
        leitung.classList.remove("is-anfrage", "is-transfer");
        void leitung.offsetWidth;               /* Reflow → Animation startet neu */
        leitung.classList.add("is-anfrage");
        spaeter(function () {
          leitung.classList.remove("is-anfrage");
          void leitung.offsetWidth;
          leitung.classList.add("is-transfer");
        }, ANFRAGE + 60);
        spaeter(function () { leitung.classList.remove("is-transfer"); },
                ANFRAGE + 60 + RUECKWEG);
      }
      /* Erst wenn das Paket ANGEKOMMEN ist – nicht waehrend es unterwegs ist. */
      dannDasNeue(ANFRAGE + 60 + RUECKWEG - 40);
    }

    /* Getippt wird nur eine WIRKLICH neue Zeile. Ein Schritt ohne Befehl – in
       Szenario 2 baut die Registry ohne Zutun um – geht direkt weiter. */
    if (frisch && text) tippe(letzte.querySelector(".lz-cmd__text"), text, danach);
    else danach();
  }

  sim.setup({
    state: function () {
      return { remote: [], images: [], container: [], term: [], hebe: [], neu: [], zustandSpaet: [], startSpaet: [], stopSpaet: [], weg: [], tagsVorher: null,
               registryMeldet: false, uebertraegt: false };
    },
    render: auffuehren
  });

  /* Hilfen, damit ein Schritt genau das sagt, was er tut. */
  /* Jeder getippte Befehl setzt zugleich, ob dabei etwas ueber die Leitung geht.
     Das MUSS hier passieren und nicht im einzelnen Schritt: `apply` laeuft beim
     Zuruecksprung erneut, und ein Schritt, der das Flag nicht zuruecksetzt,
     liesse die Leitung auch dort laufen, wo nichts uebertragen wird. */
  function tippt(s, nr, befehl) {
    s.term.push({ id: "t" + nr, cmd: befehl });
    s.uebertraegt = befehl.indexOf("image pull") !== -1;
    /* Die Phasen-Angaben gehoeren zum Schritt, nicht zum Zustand davor: Beim
       Zuruecksprung laeuft `apply` erneut, und eine stehengebliebene Ansage
       liesse die Buehne etwas zurueckhalten, das laengst da ist. */
    s.neu = [];
    s.zustandSpaet = [];
    s.startSpaet = [];
    s.stopSpaet = [];
    s.weg = [];
    s.tagsVorher = null;
  }
  function findeContainer(s, id) {
    for (var i = 0; i < s.container.length; i++) { if (s.container[i].id === id) return s.container[i]; }
    return null;
  }

  sim.registerScenario({
    id: "container",
    title: "Vom Image zum Container",
    description: "Ein Image wird gezogen, ein Container daraus erzeugt, gestartet, beschrieben, gestoppt und gelöscht – und ein zweiter zeigt, wem der Zustand gehört.",
    state: function () {
      return {
        remote: [{ id: "r-a", repo: "webserver", kurz: "a1b2c3", tags: ["1.0", "latest"], env: "APP_VERSION=1.0" }],
        images: [], container: [], term: [], hebe: ["r-a"], neu: [], zustandSpaet: [], startSpaet: [], stopSpaet: [], weg: [], tagsVorher: null,
        registryMeldet: false, uebertraegt: false
      };
    },
    steps: [
      {
        title: "Die Ausgangslage",
        text: "<p>In der <b>Registry</b> liegt <b>ein</b> Image mit dem Fingerabdruck " +
              "<code>a1b2c3</code>. Daran hängen <b>zwei Etiketten</b>: <code>1.0</code> und " +
              "<code>latest</code>. Nicht zwei Images – zwei Zettel an demselben.</p>" +
              "<p>Im Bauplan steckt eine Umgebungsvariable: <code>APP_VERSION=1.0</code>. " +
              "Behalte sie im Auge; an ihr wird gleich sichtbar, wann ein Container etwas " +
              "aus dem Image übernimmt.</p>" +
              "<p>Rechts das <b>Zielsystem</b>: Die Konsole spricht mit dem <b>Docker-Daemon</b>, " +
              "und dem gehören Images und Container. Noch sind sie leer.</p>",
        apply: function (s) { s.hebe = ["r-a"]; s.neu = []; }
      },
      {
        title: "Das Image herunterladen",
        text: "<p>Das Image liegt jetzt <b>zweimal</b> – in der Registry und beim Daemon. " +
              "Gleicher Fingerabdruck: <b>derselbe Stand</b>.</p>" +
              "<p>Geholt wurde es über das Etikett <code>latest</code>, und nur dieses eine " +
              "ist mitgekommen: Lokal trägt das Image <b>einen</b> Tag, in der Registry zwei.</p>" +
              "<p>Ein Image ist damit noch nichts, was läuft. Es ist der Bauplan.</p>",
        apply: function (s) {
          tippt(s, 1, "docker image pull webserver:latest");
          s.images.push({ id: "i1", repo: "webserver", kurz: "a1b2c3", tags: ["latest"], env: "APP_VERSION=1.0" });
          s.neu = ["i1"];              /* erscheint erst, wenn das Paket angekommen ist */
          s.hebe = ["i1"];
        }
      },
      {
        title: "Einen Container erzeugen",
        text: "<p>Aus dem Bauplan entsteht ein <b>Container</b> – und zwar einer, der noch " +
              "<b>nicht läuft</b>. Erzeugen und Starten sind zwei verschiedene Dinge.</p>" +
              "<p><b>Jetzt</b> wird übernommen, was im Image stand: <code>APP_VERSION=1.0</code> " +
              "steht nun auch im Container. Der gestrichelte Pfeil zeigt, woher er stammt – " +
              "in UML wäre das ein <code>«instanceof»</code>.</p>" +
              "<p>Alles im Container ist noch kalt: Er ist da, aber er tut nichts. " +
              "Das Image hat sich nicht verändert. Es verändert sich nie.</p>",
        apply: function (s) {
          tippt(s, 2, "docker container create --name web-1 -p 8080:80 webserver:latest");
          s.container.push({ id: "c1", name: "web-1", kurz: "a1b2c3", status: "angehalten",
                             zustand: "", port: "8080", env: "APP_VERSION=1.0", platz: 1 });
          s.neu = ["c1"];
          s.hebe = ["c1"];
        }
      },
      {
        title: "Den Container starten",
        text: "<p>Jetzt läuft er – und der ganze Container wird <b>warm</b>: Dateisystem, " +
              "Umgebungsvariablen und Prozesse leuchten auf, und der Stecker am Rand ist " +
              "gesteckt. Vorher war alles da, aber nichts davon <i>tat</i> etwas.</p>" +
              "<p><code>docker container ls</code> zeigt ab hier etwas an. " +
              "Vorher hätte man <code>ls -a</code> gebraucht: <i>„mein Container ist weg“</i> heißt " +
              "meistens <i>„er läuft nur nicht“</i>.</p>",
        apply: function (s) {
          tippt(s, 3, "docker container start web-1");
          findeContainer(s, "c1").status = "laeuft";
          s.startSpaet = ["c1"];       /* erst der Befehl, dann das Hochfahren */
          s.hebe = ["c1"];
        }
      },
      {
        title: "Im Container entsteht etwas",
        text: "<p>Eine Datei wird geschrieben. Sie liegt <b>im Container</b> – nicht im Image.</p>" +
              "<p>Das ist der Unterschied, um den es hier geht: Der Bauplan links ist unverändert, " +
              "der Container rechts hat jetzt eine eigene Geschichte.</p>",
        apply: function (s) {
          tippt(s, 4, "docker container exec web-1 touch /tmp/notiz.txt");
          findeContainer(s, "c1").zustand = "notiz.txt";
          s.zustandSpaet = ["c1"];     /* erst der Befehl, dann die Datei, dann der Baum */
          s.hebe = ["c1"];
        }
      },
      {
        title: "Stoppen – und die Datei bleibt",
        text: "<p><code>stop</code> hält ihn an – und alles wird wieder kalt. Ein angehaltener " +
              "Container tut <b>nichts</b>.</p>" +
              "<p><b>Leer ist er deshalb nicht.</b> Sieh in den Baum: Der Ast mit " +
              "<code>notiz.txt</code> ist noch da, nur eben grau. Und <code>APP_VERSION</code> " +
              "steht unverändert im Container. Ein <code>start</code> würde beides " +
              "wieder aufwecken.</p>" +
              "<p>Ein <code>start</code> würde ihn mit der Datei wieder hochfahren. " +
              "Merk Dir diesen Zustand – zwei Schritte weiter wird er gelöscht.</p>",
        apply: function (s) {
          tippt(s, 5, "docker container stop web-1");
          findeContainer(s, "c1").status = "angehalten";
          s.stopSpaet = ["c1"];        /* erst der Befehl, dann geht es aus */
          s.hebe = ["c1"];
        }
      },
      {
        title: "Ein zweiter Container aus demselben Image",
        text: "<p>Derselbe Bauplan, ein zweiter Container – und der weiß <b>nichts</b> von " +
              "<code>notiz.txt</code>. Er startet im Auslieferungszustand.</p>" +
              "<p>Beide Pfeile zeigen auf dasselbe Image, beide tragen " +
              "<code>APP_VERSION=1.0</code>. <b>Was aus dem Image kommt, ist bei beiden " +
              "gleich; was im Container entsteht, gehört nur ihm.</b></p>" +
              "<p>Der Zustand gehört dem Container, nicht dem Image. Deshalb ergibt ein Image " +
              "beliebig viele Container.</p>" +
              "<p class=\"lz-nb\"><code>run</code> ist dabei nur die Abkürzung für " +
              "<code>create</code> plus <code>start</code> – dieselben zwei Schritte wie oben, in einem Befehl.</p>",
        apply: function (s) {
          tippt(s, 6, "docker container run -d --name web-2 -p 8081:80 webserver:latest");
          s.container.push({ id: "c2", name: "web-2", kurz: "a1b2c3", status: "laeuft",
                             zustand: "", port: "8081", env: "APP_VERSION=1.0", platz: 2 });
          s.neu = ["c2"];
          s.startSpaet = ["c2"];       /* `run` erzeugt UND startet – beides sichtbar */
          s.hebe = ["c2"];
        }
      },
      {
        title: "Löschen – und die Datei ist weg",
        text: "<p><code>rm</code> wirft den Container weg – <b>die ganze Karte verschwindet</b>, " +
              "mit Baum, Variablen und allem. Beim <code>stop</code> war er nur kalt; jetzt " +
              "ist er fort. <code>notiz.txt</code> gibt es nicht mehr.</p>" +
              "<p><b>Das Image ist unberührt.</b> Aus ihm lässt sich jederzeit ein neuer Container " +
              "erzeugen – nur eben wieder ohne die Datei.</p>",
        apply: function (s) {
          tippt(s, 7, "docker container rm web-1");
          /* Das Geloeschte wird noch einmal gezeichnet, damit es erst NACH dem
             Befehl verschwindet – vorher waere es weg, bevor er dasteht. */
          s.weg = s.container.filter(function (c) { return c.id === "c1"; });
          s.container = s.container.filter(function (c) { return c.id !== "c1"; });
          s.hebe = ["i1"];
        }
      },
      {
        title: "Das Image ist der Bauplan, der Container sein Zustand",
        text: "<p>Nach dem Löschen steht das Image unverändert da. Es hat den Container überlebt, " +
              "weil es ihn nie enthalten hat.</p>" +
              "<p><b>Ein Image ist der Bauplan. Ein Container ist ein Ablauf mit eigenem Zustand – " +
              "und dieser Zustand stirbt mit ihm.</b></p>" +
              "<p class=\"lz-nb\">Wo die Daten stattdessen liegen könnten, damit sie das " +
              "überleben, ist eine eigene Frage – und eine eigene Antwort.</p>",
        apply: function (s) {
          tippt(s, 8, "docker image ls");
          s.hebe = ["i1"];
        },
        duration: 5000
      }
    ]
  });

  sim.registerScenario({
    id: "aktualisierung",
    title: "Eine neue Fassung ausrollen",
    description: "Die Anwendung wird weiterentwickelt, es entsteht ein neues Image – und die laufende Fassung auf dem Zielsystem muss ausgetauscht werden. Was dafür nötig ist, und warum ein Container dabei nicht aktualisiert, sondern ersetzt wird.",
    state: function () {
      return {
        remote:    [{ id: "r-a", repo: "webserver", kurz: "a1b2c3", tags: ["1.0", "latest"], env: "APP_VERSION=1.0" }],
        images:    [{ id: "i1", repo: "webserver", kurz: "a1b2c3", tags: ["latest"], env: "APP_VERSION=1.0" }],
        container: [{ id: "c1", name: "web-1", kurz: "a1b2c3", status: "laeuft",
                      zustand: "", port: "8080", env: "APP_VERSION=1.0", platz: 1 }],
        term: [], hebe: [], neu: [], zustandSpaet: [], startSpaet: [], stopSpaet: [], weg: [], tagsVorher: null, registryMeldet: false, uebertraegt: false
      };
    },
    steps: [
      {
        title: "Die Ausgangslage",
        text: "<p>Auf dem Zielsystem läuft eine Anwendung im Container – erzeugt aus " +
              "<code>webserver</code> mit der Kennung <code>a1b2c3</code>, im Bauplan " +
              "<code>APP_VERSION=1.0</code>. Sie tut, was sie soll.</p>" +
              "<p><b>Jetzt wird die Anwendung weiterentwickelt.</b> Am Quelltext ändert " +
              "sich etwas, es wird neu gebaut – und damit entsteht ein <b>neues Image</b>. " +
              "Nicht ein geändertes: ein zweites. Ein Image lässt sich nicht bearbeiten.</p>" +
              "<p>Die Frage dieses Szenarios ist deshalb nicht „wie aktualisiere ich den " +
              "Container?“, sondern: <b>Was muss geschehen, damit auf dem Zielsystem die " +
              "neue Fassung läuft?</b> Zähl die Schritte mit – und sieh zu, an welcher " +
              "Stelle die Anwendung dabei steht.</p>",
        apply: function (s) { s.hebe = []; s.neu = []; }
      },
      {
        title: "Der Neubau landet in der Registry",
        text: "<p>Eine Kollegin hat neu gebaut und hochgeladen. In der Registry liegt jetzt ein " +
              "<b>zweites</b> Image, <code>a4f901</code>, mit dem Etikett <code>1.1</code> – " +
              "und im Bauplan <code>APP_VERSION=1.1</code>.</p>" +
              "<p><b>Sieh, was mit <code>latest</code> passiert ist:</b> Der Zettel hing eben " +
              "noch an <code>a1b2c3</code> und hängt jetzt an <code>a4f901</code>. Ein Etikett " +
              "lässt sich umhängen – ein Fingerabdruck nicht.</p>" +
              "<p><b>Der alte Stand ist nicht weg.</b> Er trägt weiter <code>1.0</code> und " +
              "liegt unverändert da.</p>" +
              "<p>Sieh auf Deinen Rechner: <b>Dort hat sich nichts geändert.</b> Kein Befehl ist " +
              "gelaufen, nichts hat sich gemeldet. Der Container läuft weiter wie bisher – und " +
              "niemand merkt es.</p>",
        apply: function (s) {
          s.remote = [
            { id: "r-a", repo: "webserver", kurz: "a1b2c3", tags: ["1.0"],           env: "APP_VERSION=1.0" },
            { id: "r-b", repo: "webserver", kurz: "a4f901", tags: ["1.1", "latest"], env: "APP_VERSION=1.1" }
          ];
          s.hebe = ["r-b"];
          s.neu = ["r-b"];             /* der neue Stand taucht in der Registry auf */
          /* `latest` haengt noch am alten Image, bis das neue da ist – dann
             wandert es sichtbar hinueber. */
          s.tagsVorher = { "r-a": ["1.0", "latest"] };
          s.registryMeldet = true;
        }
      },
      {
        title: "Den neuen Stand holen",
        text: "<p>Der neue Stand liegt jetzt beim Daemon. Der alte ist <b>nicht weg</b> – aber " +
              "sein Etikett ist es: Du hattest nur <code>latest</code> geholt, und das hängt " +
              "jetzt am neuen. Lokal steht <code>a1b2c3</code> damit <b>ohne Tag</b> da, " +
              "während er in der Registry weiter <code>1.0</code> trägt.</p>" +
              "<p><b>Und jetzt sieh auf den Container.</b> Sein Pfeil zeigt unverändert auf " +
              "<code>a1b2c3</code>, und in ihm steht weiter <code>APP_VERSION=1.0</code> – " +
              "obwohl daneben ein Image mit <code>1.1</code> liegt. Ein <code>pull</code> " +
              "fasst keinen Container an.</p>" +
              "<p class=\"lz-nb\">Übernommen wird beim <b>Erzeugen</b>, nicht beim Holen. " +
              "Wer einen Versionstag zieht statt <code>latest</code>, sieht wenigstens, " +
              "woran er ist.</p>",
        apply: function (s) {
          tippt(s, 1, "docker image pull webserver:latest");
          s.images = [
            { id: "i1", repo: "webserver", kurz: "a1b2c3", tags: [],         env: "APP_VERSION=1.0" },
            { id: "i2", repo: "webserver", kurz: "a4f901", tags: ["latest"], env: "APP_VERSION=1.1" }
          ];
          s.neu = ["i2"];              /* erscheint erst, wenn das Paket angekommen ist */
          /* Und solange es unterwegs ist, traegt der ALTE Stand weiterhin
             `latest` – er verliert das Etikett erst an das neue Image. */
          s.tagsVorher = { "i1": ["latest"] };
          s.hebe = ["i2", "c1"];
          s.registryMeldet = false;
        }
      },
      {
        title: "Den laufenden Container anhalten",
        text: "<p>Ein Container lässt sich nicht auf einen neuen Stand umheben – er ist an das " +
              "Image gebunden, aus dem er erzeugt wurde.</p>" +
              "<p>Also anhalten. Der erste von drei Schritten, die zusammengehören.</p>",
        apply: function (s) {
          tippt(s, 2, "docker container stop web-1");
          findeContainer(s, "c1").status = "angehalten";
          s.stopSpaet = ["c1"];
          s.hebe = ["c1"];
        }
      },
      {
        title: "Den alten Container löschen",
        text: "<p>Weg damit. Jetzt ist auch das alte Image nicht mehr in Benutzung – " +
              "es könnte aufgeräumt werden.</p>" +
              "<p>Der Name <code>web-1</code> ist damit wieder frei. Das ist kein Detail: " +
              "Solange der alte Container existiert, kann kein neuer so heißen.</p>",
        apply: function (s) {
          tippt(s, 3, "docker container rm web-1");
          s.weg = s.container.slice();
          s.container = [];
          s.hebe = ["i1"];
        }
      },
      {
        title: "Einen neuen Container erzeugen",
        text: "<p>Derselbe Befehl wie beim ersten Mal, derselbe Name – aber <code>latest</code> " +
              "zeigt inzwischen woandershin, also ist der Bauplan ein anderer: " +
              "<code>a4f901</code>. Der Pfeil zeigt jetzt dorthin.</p>" +
              "<p><b>Und hier wird übernommen:</b> Im Container steht " +
              "<code>APP_VERSION=1.1</code>. Nicht beim <code>pull</code>, sondern <b>jetzt</b>, " +
              "beim Erzeugen.</p>" +
              "<p>Er ist noch angehalten und damit kalt. Erzeugen und Starten bleiben zwei Dinge.</p>",
        apply: function (s) {
          tippt(s, 4, "docker container create --name web-1 -p 8080:80 webserver:latest");
          s.container = [{ id: "c2", name: "web-1", kurz: "a4f901", status: "angehalten",
                           zustand: "", port: "8080", env: "APP_VERSION=1.1", platz: 1 }];
          s.neu = ["c2"];
          s.hebe = ["c2"];
        }
      },
      {
        title: "Ein Container wird nicht aktualisiert – er wird ersetzt",
        text: "<p>Es läuft wieder, auf dem neuen Stand. Von außen sieht es aus wie vorher; " +
              "es ist aber ein anderer Container aus einem anderen Image.</p>" +
              "<p><b>Ein Container wird nie aktualisiert. Er wird gelöscht und neu erzeugt.</b> " +
              "Genau deshalb darf nichts Wichtiges in ihm liegen.</p>" +
              "<p class=\"lz-nb\">Und weil <code>webserver:latest</code> eben noch auf " +
              "<code>a1b2c3</code> zeigte und jetzt auf <code>a4f901</code>: Ein Tag ist ein Etikett, " +
              "das jemand verschieben kann – keine Version.</p>",
        apply: function (s) {
          tippt(s, 5, "docker container start web-1");
          findeContainer(s, "c2").status = "laeuft";
          s.startSpaet = ["c2"];
          s.hebe = ["c2"];
        },
        duration: 5000
      }
    ]
  });
})();
