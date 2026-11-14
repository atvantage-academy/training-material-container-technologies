/* =============================================================================
   Wissens-Check – Komponente `skr-didaktikon-quiz`
   -----------------------------------------------------------------------------
   Gehoert zu `quiz.css`. Das Skriptorium laedt beides auf jeder Seite, deren Inhalt
   das Merkmal `skr-didaktikon-quiz` enthaelt (extension.yml), nach `payload.js`.

   DER AUTOR SCHREIBT YAML (schemas/quiz.schema.json) – je Frage `question`, `answers` mit
   `text`, `correct` und `reason`, dazu `note` für Trainer:innen; jeder Text ist Markdown,
   auch mit Codeblock. Das Skript bekommt die Daten mit gerendertem HTML: nach dem Bau aus
   der Nutzlast (`{ questions }`, payload.js), in der Vorschau aus `skr.componentData()`.

   Fragen, Antworten und Begründungen bleiben HTML: Das Skript KLONT sie in die
   Bedienung, statt Text zu setzen. Codeblöcke samt Hervorhebung kommen so mit.

   WARUM DAS HIER LIEGT UND NICHT IN DER SEITE: Die erste Fassung stand als rund
   240 Zeilen CSS und JavaScript IN einer Unterlage. Beim zweiten Wissens-Check
   haette jemand sie kopiert - ab dann zwei Fassungen, die auseinanderlaufen, und
   ein Fehler in der Mechanik an zwei Stellen zu beheben.
   ============================================================================= */
(function () {
  "use strict";

  /* DIE TEXTE KOMMEN AUS DER ERWEITERUNG (texts/«sprache».yml) – über `ctx.text` in der
     Sprache der Seite, mit Zahlen in ihrem Zahlformat; ein Theme darf sie ändern. Die
     Anmeldung bringt nur den Kontext, Teile meldet dieses Skript nicht an. */
  var ctx = null;
  window.skr.ext.register("didaktikon", function (c) { ctx = c; return {}; });
  function T(schluessel, werte) { return ctx.text(schluessel, werte); }

  function kinder(knoten) { return Array.prototype.slice.call(knoten.children); }

  /* Ein Antwortpunkt einer lockeren Liste steckt in einem `<p>` – in einer Schaltflaeche
     zaehlt nur sein Inhalt. */
  function auspacken(knoten) {
    return knoten.length === 1 && knoten[0].nodeType === 1 && knoten[0].tagName === "P"
      ? Array.prototype.slice.call(knoten[0].childNodes) : knoten;
  }

  /* --- Die Daten lesen ----------------------------------------------------
     Jeder Text kommt als HTML; das Skript macht daraus Knoten zum Klonen. Eine Antwort aus
     einem einzigen Absatz zählt ohne ihr `<p>`. */
  function knoten(html) {
    var t = document.createElement("template");
    t.innerHTML = typeof html === "string" ? html : "";
    return Array.prototype.slice.call(t.content.childNodes);
  }

  function lesen(fragen) {
    return (Array.isArray(fragen) ? fragen : []).map(function (f) {
      return {
        frage: knoten(f.question),
        hinweis: rand(knoten(f.note)),
        optionen: (Array.isArray(f.answers) ? f.answers : []).map(function (a) {
          return { inhalt: rand(auspacken(rand(knoten(a.text)))), begruendung: rand(knoten(a.reason)), richtig: a.correct === true };
        })
      };
    }).filter(function (f) { return f.optionen.length; });
  }

  /* Knoten in ein Ziel klonen – unverändert, auch ein Zitat, das der Autor geschrieben hat. */
  function einsetzen(ziel, knoten) {
    knoten.forEach(function (n) { ziel.appendChild(n.cloneNode(true)); });
    return ziel;
  }

  /* Eine Antwort steht im Markup mit Zeilenumbruechen drumherum; in der Schaltflaeche
     und in der Rueckmeldung zaehlt nur der Inhalt. Leerraum am Rand faellt weg. */
  function rand(knoten) {
    var k = knoten.slice();
    while (k.length && k[0].nodeType === 3 && !k[0].nodeValue.trim()) { k.shift(); }
    while (k.length && k[k.length - 1].nodeType === 3 && !k[k.length - 1].nodeValue.trim()) { k.pop(); }
    if (!k.length) { return k; }
    if (k[0].nodeType === 3) { k[0] = document.createTextNode(k[0].nodeValue.replace(/^\s+/, "")); }
    var z = k.length - 1;
    if (k[z].nodeType === 3) { k[z] = document.createTextNode(k[z].nodeValue.replace(/\s+$/, "")); }
    return k;
  }

  function element(tag, klasse, haken) {
    var e = document.createElement(tag);
    if (klasse) { e.className = klasse; }
    if (haken) { e.setAttribute("data-skr-didaktikon-quiz-" + haken, ""); }
    return e;
  }

  /* Was erst nach dem Klonen hervorgehoben werden kann, faerbt die Hervorhebung nach.
     Und der Teilbaum wird gemeldet: Ein Codeblock, der darin waagrecht ueberlaeuft,
     muss per Tastatur erreichbar werden – das regelt client.js an einer Stelle. */
  function faerben(wurzel) {
    if (window.skr && window.skr.highlight) { window.skr.highlight.apply(wurzel); }
    wurzel.dispatchEvent(new CustomEvent("skr-content-added", { bubbles: true }));
  }

  /* Eine kurze Prüfsumme des Inhalts: Ändert der Autor den Check, passt ein
     gespeicherter Stand nicht mehr und wird verworfen. */
  function pruefsumme(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) { h = ((h << 5) + h + text.charCodeAt(i)) | 0; }
    return (h >>> 0).toString(36);
  }

  var zaehler = 0;

  document.querySelectorAll(".skr-didaktikon-quiz").forEach(function (wurzel, index) {
    /* EINE NUTZLAST GEHT VOR (payload.js): Nach dem Bau trägt der Rahmen die Fragen
       verschleiert und daneben einen Rückfall ohne Lösung; in der Vorschau trägt er die
       Daten selbst (`skr.componentData`). */
    var ext = window.skr && window.skr.ext && window.skr.ext.didaktikon;
    var nutzlast = ext && ext.payload ? ext.payload(wurzel) : null;
    var daten = nutzlast && Array.isArray(nutzlast.questions) ? nutzlast.questions
      : (window.skr && window.skr.componentData ? window.skr.componentData(wurzel) : null);
    var FRAGEN = lesen(daten);
    if (!FRAGEN.length) { return; }

    /* --- Die Bedienung bauen ------------------------------------------------
       Rollen und Bezuege: `progressbar` mit Wert, `status` fuer die Rueckmeldung,
       die Antworten eine Gruppe, benannt durch die Frage. Die Kennung ist je Check
       eindeutig – eine Seite kann mehrere tragen. */
    zaehler++;
    var frageId = "skr-didaktikon-quiz-question-" + zaehler;
    var bedienung = element("div", "skr-didaktikon-quiz__ui");
    var leiste = element("div", "skr-didaktikon-quiz__bar");
    var elZaehler = element("span", "", "counter"), elPunkte = element("span", "", "score");
    var elZurueck = element("button", "skr-didaktikon-quiz__reset", "reset");
    elZurueck.type = "button"; elZurueck.textContent = T("quizRestart"); elZurueck.hidden = true;
    leiste.appendChild(elZaehler); leiste.appendChild(elZurueck); leiste.appendChild(elPunkte);
    var elBalkenRahmen = element("div", "skr-didaktikon-quiz__progress", "bar");
    elBalkenRahmen.setAttribute("role", "progressbar");
    elBalkenRahmen.setAttribute("aria-valuemin", "0");
    elBalkenRahmen.setAttribute("aria-valuemax", "100");
    elBalkenRahmen.setAttribute("aria-valuenow", "0");
    elBalkenRahmen.setAttribute("aria-label", T("quizProgress"));
    var elBalken = element("div", "skr-didaktikon-quiz__progress-fill", "progress");
    elBalkenRahmen.appendChild(elBalken);

    var elKarte = element("div", "skr-didaktikon-quiz__card", "card");
    var elHinweis = null;
    var elFrage = element("div", "skr-didaktikon-quiz__question", "question");
    elFrage.id = frageId; elFrage.setAttribute("tabindex", "-1");
    var elOptionen = element("div", "skr-didaktikon-quiz__options", "options");
    elOptionen.setAttribute("role", "radiogroup");
    elOptionen.setAttribute("aria-labelledby", frageId);
    var elFeedback = element("div", "skr-didaktikon-quiz__feedback", "feedback");
    elFeedback.setAttribute("role", "status"); elFeedback.hidden = true;
    var elWeiter = element("button", "skr-didaktikon-quiz__next", "next");
    elWeiter.type = "button"; elWeiter.hidden = true;
    [elFrage, elOptionen, elFeedback, elWeiter].forEach(function (e) { elKarte.appendChild(e); });

    var elErgebnis = element("div", "skr-didaktikon-quiz__result", "result");
    elErgebnis.hidden = true;
    var elTitel = element("p", "skr-didaktikon-quiz__result-title", "result-title");
    elTitel.setAttribute("tabindex", "-1");
    var elZahl = element("p", "skr-didaktikon-quiz__score", "result-score");
    var elNeu = element("button", "skr-didaktikon-quiz__next", "restart");
    elNeu.type = "button"; elNeu.textContent = T("quizAgain");
    [elTitel, elZahl, elNeu].forEach(function (e) { elErgebnis.appendChild(e); });

    /* --- Die Ansicht für Trainer:innen (#361) ---------------------------------
       NUR IM BAU FÜR TRAINER:INNEN (`data-skr-audience` am <body>): eine Leiste mit den
       Nummern der Fragen – ein Klick springt zur Frage, etwa um sie im Kurs gemeinsam zu
       besprechen – und „Alle Fragen“: die Fragen untereinander, samt Lösung und
       Begründungen. Lernende sehen den Check unverändert: Springen höbe den Gang durch
       die Fragen auf, die Übersicht verriete die Lösung. */
    var TRAINER = document.body.getAttribute("data-skr-audience") === "trainer";
    var elTrainer = null, elSprung = null, elUebersicht = null, elUebersichtKnopf = null, uebersicht = false;
    if (TRAINER) {
      /* DIE LEISTE IST EIN TRAINERHINWEIS ALS BOX (`--box`): Studentenhut und Rand wie jeder
         Hinweis, den nur Trainer:innen sehen. Sein Stylesheet lädt extension.yml mit; sein
         Skript lässt eine Box stehen, wie sie ist. */
      elTrainer = element("div", "skr-didaktikon-trainer-note skr-didaktikon-trainer-note--box skr-didaktikon-quiz__trainer", "trainer");
      elTrainer.setAttribute("role", "group");
      elTrainer.setAttribute("aria-label", T("quizTrainerOnly"));
      elSprung = element("div", "skr-didaktikon-quiz__jump", "jump");
      elSprung.setAttribute("role", "group");
      elSprung.setAttribute("aria-label", T("quizJump"));
      FRAGEN.forEach(function (f, i) {
        var knopf = element("button", "skr-didaktikon-quiz__jump-item");
        knopf.type = "button"; knopf.textContent = String(i + 1);
        knopf.setAttribute("aria-label", T("quizQuestionOf", { current: i + 1, total: FRAGEN.length }));
        knopf.addEventListener("click", function () { springen(i); });
        elSprung.appendChild(knopf);
      });
      elUebersicht = element("div", "skr-didaktikon-quiz__overview", "overview");
      elUebersicht.id = (wurzel.id || "skr-didaktikon-quiz-" + zaehler) + "-overview";
      elUebersicht.hidden = true;
      elUebersichtKnopf = element("button", "skr-didaktikon-quiz__reset", "overview-toggle");
      elUebersichtKnopf.type = "button"; elUebersichtKnopf.textContent = T("quizOverview");
      elUebersichtKnopf.setAttribute("aria-expanded", "false");
      elUebersichtKnopf.setAttribute("aria-controls", elUebersicht.id);
      elUebersichtKnopf.addEventListener("click", function () { uebersichtZeigen(!uebersicht); });
      elTrainer.appendChild(elSprung); elTrainer.appendChild(elUebersichtKnopf);
    }

    [leiste, elBalkenRahmen, elTrainer, elUebersicht, elKarte, elErgebnis].forEach(function (e) { if (e) { bedienung.appendChild(e); } });
    wurzel.appendChild(bedienung);

    var reihenfolge = [], aktuell = 0, punkte = 0, gestartet = false, gewaehlt = [], fertig = false;

    /* --- Der Stand im Browser (#394) ------------------------------------------
       DER FORTSCHRITT ÜBERLEBT DAS NEULADEN: im `localStorage` dieses Browsers, nicht
       in der Adresse – eine geteilte Adresse zeigt keine fremden Antworten. Gespeichert
       werden die gemischte Reihenfolge, die gewählten Antworten, die aktuelle Frage und
       ob ausgewertet ist. Schlüssel: Seite und Check; die Prüfsumme verwirft einen
       Stand, der nicht mehr zum Inhalt passt. Ohne Speicher (privates Fenster,
       gesperrt) läuft der Check wie zuvor, nur ohne Gedächtnis. */
    var SCHLUESSEL = "skr-didaktikon:quiz:" + location.pathname + ":" + (wurzel.id || index);
    var PRUEFSUMME = pruefsumme(JSON.stringify(daten));
    function sichern() {
      try {
        localStorage.setItem(SCHLUESSEL, JSON.stringify({
          h: PRUEFSUMME, a: aktuell, p: punkte, w: gewaehlt, f: fertig,
          o: reihenfolge.map(function (r) { return r.optionen.map(function (o) { return r.frage.optionen.indexOf(o); }); })
        }));
      } catch (e) { /* ohne Speicher eben ohne Gedächtnis */ }
    }
    function vergessen() { try { localStorage.removeItem(SCHLUESSEL); } catch (e) { /* dito */ } }
    function laden() {
      var s;
      try { s = JSON.parse(localStorage.getItem(SCHLUESSEL)); } catch (e) { return null; }
      if (!s || s.h !== PRUEFSUMME || !Array.isArray(s.o) || s.o.length !== FRAGEN.length) { return null; }
      var passt = s.o.every(function (ord, i) {
        return Array.isArray(ord) && ord.length === FRAGEN[i].optionen.length &&
          ord.every(function (j) { return FRAGEN[i].optionen[j]; });
      });
      return passt ? s : null;
    }

    /* „Neu beginnen“ steht nur da, wenn es etwas zu verlieren gibt. */
    function zurueckZeigen() {
      elZurueck.hidden = !(fertig || aktuell > 0 || gewaehlt[aktuell] != null);
    }

    /* DIE OPTIONEN WERDEN JE FRAGE GEMISCHT. Sonst steht die richtige Antwort
       zweimal hintereinander an derselben Stelle, und man raet die Position statt
       der Sache. Die FRAGEN bleiben in ihrer Reihenfolge - sie bauen aufeinander
       auf, und ein Wissens-Check ist kein Zufallsgenerator. */
    function mischen(feld) {
      var kopie = feld.slice();
      for (var i = kopie.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = kopie[i]; kopie[i] = kopie[j]; kopie[j] = t;
      }
      return kopie;
    }

    function starten() {
      reihenfolge = FRAGEN.map(function (f) { return { frage: f, optionen: mischen(f.optionen) }; });
      aktuell = 0; punkte = 0; fertig = false;
      gewaehlt = FRAGEN.map(function () { return null; });
      vergessen();
      if (uebersicht) { uebersichtZeigen(false); }
      elErgebnis.hidden = true;
      elKarte.hidden = false;
      zeigen();
    }

    /* Den gespeicherten Stand herstellen – ohne Fokus zu bewegen: Neu geladen hat
       der Browser, nicht die Person. */
    function wiederherstellen(s) {
      reihenfolge = FRAGEN.map(function (f, i) {
        return { frage: f, optionen: s.o[i].map(function (j) { return f.optionen[j]; }) };
      });
      aktuell = Math.min(Math.max(0, s.a | 0), reihenfolge.length - 1);
      punkte = s.p | 0; fertig = !!s.f;
      gewaehlt = FRAGEN.map(function (f, i) { return (s.w && s.w[i] != null) ? s.w[i] : null; });
      elErgebnis.hidden = true;
      elKarte.hidden = false;
      zeigen();
      if (fertig) { beenden(true); }
    }

    function zeigen() {
      var eintrag = reihenfolge[aktuell];
      elFrage.textContent = "";
      einsetzen(elFrage, eintrag.frage.frage);
      /* Der Hinweis für Trainer:innen steht nur in ihrer Nutzlast – Lernende haben keinen.
         Er steht unter der Frage, nicht in ihr: Die Frage benennt die Antworten
         (`aria-labelledby`), der Hinweis gehört nicht in diesen Namen. */
      if (elHinweis) { elKarte.removeChild(elHinweis); elHinweis = null; }
      if (TRAINER && eintrag.frage.hinweis.length) { elHinweis = elKarte.insertBefore(hinweisBox(eintrag.frage.hinweis), elOptionen); }
      elFeedback.hidden = true; elFeedback.textContent = "";
      elWeiter.hidden = true;
      elOptionen.textContent = "";

      /* DIE ANTWORTEN SIND AUSWAHL-KARTEN (`role="radio"`), keine Schaltflächen: Sie dürfen
         Absätze und Codeblöcke tragen. Bedient wie eine Gruppe von Radioknöpfen – Tab
         erreicht die Gruppe, die Pfeiltasten wandern, Leertaste oder Enter wählt. */
      eintrag.optionen.forEach(function (opt, i) {
        var knopf = element("div", "skr-didaktikon-quiz__option");
        knopf.setAttribute("role", "radio");
        knopf.setAttribute("aria-checked", "false");
        knopf.tabIndex = i === 0 ? 0 : -1;
        var marke = element("span", "skr-didaktikon-quiz__marker");
        marke.textContent = String.fromCharCode(65 + i);
        knopf.appendChild(marke);
        einsetzen(knopf, opt.inhalt);
        knopf.addEventListener("click", function () {
          if (knopf.getAttribute("aria-disabled") !== "true") { antworten(opt, knopf); }
        });
        knopf.addEventListener("keydown", tasten);
        elOptionen.appendChild(knopf);
      });
      faerben(elKarte);

      elZaehler.textContent = T("quizQuestionOf", { current: aktuell + 1, total: reihenfolge.length });
      elPunkte.textContent = T("quizCorrectCount", { count: punkte });
      var stand = Math.round(aktuell / reihenfolge.length * 100);
      elBalken.style.width = stand + "%";
      elBalkenRahmen.setAttribute("aria-valuenow", String(stand));
      elBalkenRahmen.setAttribute("aria-valuetext", T("quizQuestionOf", { current: aktuell + 1, total: reihenfolge.length }));

      /* DER FOKUS MUSS MITKOMMEN. „Weiter“ blendet sich nach dem Klick aus - wer
         mit der Tastatur arbeitet, stuende danach mit dem Fokus im Nichts (beim
         `body`) und muesste sich von vorn durch die Seite tabben. Die Frage nimmt
         ihn auf; zugleich liest eine Vorlesehilfe damit die neue Frage vor.
         NICHT beim ersten Aufbau: Dort hat noch niemand etwas bedient, und ein
         Sprung in die Seite beim blossen Laden waere eine Entfuehrung. */
      if (gestartet) { elFrage.focus(); }

      /* EINE BEANTWORTETE FRAGE BLEIBT BEANTWORTET – nach dem Neuladen wie nach einem
         Sprung zurück: Sie zeigt ihre Antwort, statt ein zweites Mal zu zählen. */
      var g = gewaehlt[aktuell];
      if (g != null) {
        antworten(eintrag.optionen[g], elOptionen.querySelectorAll(".skr-didaktikon-quiz__option")[g], true);
      }
      sprungMarkieren(aktuell);
      zurueckZeigen();
    }

    /* Die aktuelle Frage in der Leiste der Trainer:innen; nach der Auswertung keine. */
    function sprungMarkieren(index) {
      if (!elSprung) { return; }
      kinder(elSprung).forEach(function (k, i) {
        if (i === index) { k.setAttribute("aria-current", "step"); } else { k.removeAttribute("aria-current"); }
      });
    }

    /* Zu einer Frage springen. Eine Auswertung gilt danach nicht mehr – sie kommt wieder
       mit „Weiter“ nach der letzten Frage. */
    function springen(index) {
      if (uebersicht) { uebersichtZeigen(false); }
      gestartet = true;
      aktuell = index; fertig = false;
      elErgebnis.hidden = true;
      elKarte.hidden = false;
      sichern();
      zeigen();
    }

    /* DIE ÜBERSICHT wird bei jedem Öffnen neu gebaut – in der Reihenfolge der Antworten, die
       der Check gerade zeigt: Die Buchstaben stimmen mit dem überein, was alle sehen. Die
       richtige Antwort trägt ein Wort, nicht nur eine Farbe. */
    function uebersichtBauen() {
      elUebersicht.textContent = "";
      var ol = element("ol", "skr-didaktikon-quiz__overview-list");
      reihenfolge.forEach(function (eintrag, i) {
        /* Jede Frage eine Karte wie im Check: Vier Fragen sehen aus wie vier Checks. */
        var li = element("li", "skr-didaktikon-quiz__overview-item");
        li.appendChild(absatz(T("quizQuestionOf", { current: i + 1, total: reihenfolge.length }), "skr-didaktikon-quiz__overview-counter"));
        einsetzen(li.appendChild(element("div", "skr-didaktikon-quiz__question")), eintrag.frage.frage);
        var ul = element("ul", "skr-didaktikon-quiz__overview-answers");
        eintrag.optionen.forEach(function (opt, j) {
          var a = element("li", "skr-didaktikon-quiz__overview-answer" + (opt.richtig ? " skr-didaktikon-quiz__overview-answer--correct" : ""));
          var marke = element("span", "skr-didaktikon-quiz__marker");
          marke.textContent = String.fromCharCode(65 + j);
          a.appendChild(marke);
          einsetzen(a, opt.inhalt);
          if (opt.richtig) {
            var richtig = element("strong", "skr-didaktikon-quiz__overview-correct");
            richtig.textContent = " " + T("quizOverviewCorrect");
            a.appendChild(richtig);
          }
          if (opt.begruendung.length) {
            a.appendChild(einsetzen(element("div", "skr-didaktikon-quiz__overview-reason"), opt.begruendung));
          }
          ul.appendChild(a);
        });
        li.appendChild(ul);
        if (eintrag.frage.hinweis.length) { li.appendChild(hinweisBox(eintrag.frage.hinweis)); }
        var hin = element("button", "skr-didaktikon-quiz__reset");
        hin.type = "button"; hin.textContent = T("quizOverviewGoTo");
        hin.setAttribute("aria-label", T("quizOverviewGoTo") + ": " + T("quizQuestionOf", { current: i + 1, total: reihenfolge.length }));
        hin.addEventListener("click", function () { springen(i); });
        li.appendChild(hin);
        ol.appendChild(li);
      });
      elUebersicht.appendChild(ol);
      faerben(elUebersicht);
    }

    /* Die Übersicht tritt an die Stelle von Karte und Auswertung; geschlossen ist alles
       wie vorher. `ausAdresse`: hergestellt aus der Adresse – die steht dann schon. */
    function uebersichtZeigen(an, ausAdresse) {
      uebersicht = an;
      if (an) { uebersichtBauen(); } else { elUebersicht.textContent = ""; }
      elUebersicht.hidden = !an;
      bedienung.classList.toggle("skr-didaktikon-quiz__ui--overview", an);
      elUebersichtKnopf.setAttribute("aria-expanded", String(an));
      elUebersichtKnopf.textContent = an ? T("quizOverviewClose") : T("quizOverview");
      if (!ausAdresse && window.skr && window.skr.state) { window.skr.state.update(); }
    }

    /* „ALLE FRAGEN“ STEHT IN DER ADRESSE (`#/?open=«id des Checks»-overview`): Neu geladen
       oder als Verweis geteilt, öffnet die Seite wieder die Übersicht – etwa am Beamer.
       Wie jedes Auf und Zu über `skr.state`, das EINE Fragment der Seite gehört allen
       Bausteinen. Der Fortschritt bleibt im Browser (siehe oben), nicht in der Adresse. */
    if (TRAINER && window.skr && window.skr.state) {
      window.skr.state.openable({
        id: elUebersicht.id,
        isOpen: function () { return uebersicht; },
        set: function (an) { if (an !== uebersicht) { uebersichtZeigen(an, true); } }
      });
    }

    /* Die Tasten einer Auswahl-Karte: Pfeile, Pos1 und Ende wandern in der Gruppe,
       Leertaste und Enter wählen. Der Fokus folgt, nur die Karte mit Fokus ist per Tab
       erreichbar. */
    function tasten(ev) {
      var karten = Array.prototype.slice.call(elOptionen.querySelectorAll(".skr-didaktikon-quiz__option"));
      var i = karten.indexOf(ev.currentTarget), ziel = null;
      if (ev.key === "ArrowDown" || ev.key === "ArrowRight") { ziel = karten[(i + 1) % karten.length]; }
      else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") { ziel = karten[(i - 1 + karten.length) % karten.length]; }
      else if (ev.key === "Home") { ziel = karten[0]; }
      else if (ev.key === "End") { ziel = karten[karten.length - 1]; }
      else if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); ev.currentTarget.click(); return; }
      if (!ziel) { return; }
      ev.preventDefault();
      karten.forEach(function (k) { k.tabIndex = k === ziel ? 0 : -1; });
      ziel.focus();
    }

    /* Ein Hinweis für Trainer:innen als Box, wie jeder Trainerhinweis. */
    function hinweisBox(knotenListe) {
      var box = element("div", "skr-didaktikon-trainer-note skr-didaktikon-trainer-note--box skr-didaktikon-quiz__note");
      box.setAttribute("role", "note");
      box.setAttribute("aria-label", T("quizTrainerOnly"));
      return einsetzen(box, knotenListe);
    }

    function absatz(text, klasse) {
      var p = element("p", klasse);
      p.textContent = text;
      return p;
    }

    /* `still`: beim Wiederherstellen – weder zählen noch speichern noch Fokus. */
    function antworten(wahl, knopf, still) {
      var knoepfe = Array.prototype.slice.call(elOptionen.querySelectorAll(".skr-didaktikon-quiz__option"));
      var eintrag = reihenfolge[aktuell];

      knoepfe.forEach(function (k, i) {
        k.setAttribute("aria-disabled", "true");
        k.setAttribute("aria-checked", String(k === knopf));
        k.tabIndex = k === knopf ? 0 : -1;
        /* DIE RICHTIGE ANTWORT WIRD IMMER MARKIERT - auch wenn daneben gegriffen
           wurde. Wer nur sieht, dass er falsch lag, lernt nichts. */
        if (eintrag.optionen[i].richtig) { k.classList.add("skr-didaktikon-quiz__option--correct"); }
      });
      if (!wahl.richtig) { knopf.classList.add("skr-didaktikon-quiz__option--wrong"); }
      if (!still) {
        if (wahl.richtig) { punkte++; }
        gewaehlt[aktuell] = knoepfe.indexOf(knopf);
        sichern();
      }

      elFeedback.textContent = "";
      elFeedback.appendChild(absatz(wahl.richtig ? T("quizCorrect") : T("quizWrong"), "skr-didaktikon-quiz__feedback-head"));
      einsetzen(elFeedback, wahl.begruendung);
      if (!wahl.richtig) {
        var richtige = eintrag.optionen.filter(function (o) { return o.richtig; })[0];
        if (richtige) {
          var p = element("p");
          var stark = element("strong");
          stark.textContent = T("quizCorrectWouldBe");
          p.appendChild(stark);
          p.appendChild(document.createTextNode(" "));
          einsetzen(p, richtige.inhalt);
          elFeedback.appendChild(p);
          einsetzen(elFeedback, richtige.begruendung);
        }
      }
      faerben(elFeedback);
      elFeedback.hidden = false;

      elPunkte.textContent = T("quizCorrectCount", { count: punkte });
      elWeiter.hidden = false;
      elWeiter.textContent = (aktuell + 1 < reihenfolge.length) ? T("quizNext") : T("quizEvaluate");
      if (!still) { elWeiter.focus(); }
      zurueckZeigen();
    }

    function beenden(still) {
      elKarte.hidden = true;
      elErgebnis.hidden = false;
      elBalken.style.width = "100%";
      elBalkenRahmen.setAttribute("aria-valuenow", "100");
      elBalkenRahmen.setAttribute("aria-valuetext", T("quizDone"));
      elZaehler.textContent = T("quizDone");
      elPunkte.textContent = T("quizResult", { correct: punkte, total: reihenfolge.length });

      elTitel.textContent = T("quizDone");
      elZahl.textContent = T("quizResultLong", { correct: punkte, total: reihenfolge.length });
      /* Auch hier wandert der Fokus mit - die Karte ist weg, die Auswertung neu. */
      if (!still) { elTitel.focus(); }
      sprungMarkieren(-1);
      fertig = true;
      sichern();
      zurueckZeigen();
    }

    elWeiter.addEventListener("click", function () {
      gestartet = true;
      if (aktuell + 1 < reihenfolge.length) { aktuell++; sichern(); zeigen(); return; }
      beenden();
    });
    /* „Noch einmal“ nach der Auswertung ist schon die Entscheidung – ohne Rückfrage. */
    elNeu.addEventListener("click", function () { gestartet = true; starten(); });

    /* „Neu beginnen“ mitten im Check fragt nach: Die Antworten wären weg. */
    elZurueck.addEventListener("click", function () {
      var frage = (window.skr && window.skr.dialog)
        ? window.skr.dialog.choose({ title: T("quizRestartTitle"), text: T("quizRestartText"),
            choices: [{ label: T("quizRestart"), value: true, primary: true }] })
        : Promise.resolve(window.confirm(T("quizRestartTitle")));
      frage.then(function (ja) {
        if (!ja) { return; }
        gestartet = true;
        starten();
        elFrage.focus();
      });
    });

    /* Die Hervorhebung laedt als Modul nach; was vorher geklont wurde, faerbt sie
       hier nach. */
    document.addEventListener("skr-highlight-ready", function () { faerben(bedienung); });

    /* ERST JETZT die Klasse setzen - sie blendet den Rückfall aus und die Bedienung
       ein. Bricht oben etwas ab, bleibt der Rückfall stehen; nie eine halbe
       Oberfläche. */
    wurzel.classList.add("skr-didaktikon-quiz--ready");
    var stand = laden();
    if (stand) { wiederherstellen(stand); } else { starten(); }
  });
})();
