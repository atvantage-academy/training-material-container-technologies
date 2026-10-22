/* =============================================================================
   Wissens-Check – Komponente `skr-didaktikon-quiz`
   -----------------------------------------------------------------------------
   Gehoert zu `quiz.css`. Das Skriptorium laedt beides auf jeder Seite, deren Inhalt
   das Merkmal `skr-didaktikon-quiz` enthaelt (extension.yml), nach `payload.js`.

   DAS MARKUP IST GEWOEHNLICHES MARKDOWN – vorgegeben ist nur die Klasse am Rahmen:

     <div class="skr-didaktikon-quiz" markdown="1">
     1. Frage – beliebiges Markdown, auch Code
        - [ ] falsche Antwort
          > Begruendung
        - [x] richtige Antwort
     </div>

   Je Eintrag der nummerierten Liste eine Frage; die letzte Aufgabenliste darin sind
   die Antworten, `[x]` die richtige; ein Zitat unter einer Antwort ihre Begruendung.
   Alles davor ist die Frage. Das Layout „quiz“ schreibt seine Fragen aus dem Front
   Matter in genau dieses Markup – es gibt EINE Mechanik, nicht zwei.

   Fragen, Antworten und Begruendungen bleiben HTML: Das Skript KLONT sie in die
   Bedienung, statt Text zu setzen. Codebloecke samt Hervorhebung kommen so mit.

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

  /* Die Deutung am Ende ist KURSSTOFF, nicht Theme-Text: Sie verweist auf die
     Unterlagen dieses Kurses. Das Layout „quiz“ bringt sie aus dem Front Matter mit.
     Fehlt sie, bleibt die Auswertung bei der nackten Zahl - besser als ein Satz, der
     auf Material verweist, das es hier nicht gibt. */
  function deutungFinden(deutungen, anteil) {
    var treffer = null;
    (deutungen || []).forEach(function (d) {
      var ab = typeof d.min === "number" ? d.min : 0;
      if (anteil >= ab && (!treffer || ab >= treffer.min)) { treffer = { min: ab, d: d }; }
    });
    return treffer && treffer.d;
  }

  function kinder(knoten) { return Array.prototype.slice.call(knoten.children); }

  /* Ein Antwortpunkt einer lockeren Liste steckt in einem `<p>` – in einer Schaltflaeche
     zaehlt nur sein Inhalt. */
  function auspacken(knoten) {
    return knoten.length === 1 && knoten[0].nodeType === 1 && knoten[0].tagName === "P"
      ? Array.prototype.slice.call(knoten[0].childNodes) : knoten;
  }

  /* --- Das Markup lesen -------------------------------------------------- */
  function lesen(liste) {
    return kinder(liste).filter(function (li) { return li.tagName === "LI"; }).map(function (li) {
      var aufgaben = kinder(li).filter(function (k) { return k.tagName === "UL"; });
      var antworten = aufgaben[aufgaben.length - 1];
      var frage = Array.prototype.slice.call(li.childNodes).filter(function (n) { return n !== antworten; });
      var optionen = antworten ? kinder(antworten).filter(function (k) { return k.tagName === "LI"; }).map(function (punkt) {
        var haken = punkt.querySelector("input[type=checkbox]");
        var begruendung = [], inhalt = [];
        Array.prototype.slice.call(punkt.childNodes).forEach(function (n) {
          if (n === haken) { return; }
          if (n.nodeType === 1 && n.tagName === "BLOCKQUOTE") { begruendung.push(n); return; }
          if (n.nodeType === 1 && n.tagName === "P" && haken && n.contains(haken)) {
            /* Lockere Liste: Haken und Text stehen im selben Absatz. */
            Array.prototype.slice.call(n.childNodes).forEach(function (m) { if (m !== haken) { inhalt.push(m); } });
            return;
          }
          inhalt.push(n);
        });
        return { inhalt: rand(auspacken(rand(inhalt))), begruendung: begruendung, richtig: !!(haken && haken.checked) };
      }) : [];
      return { frage: frage, optionen: optionen };
    }).filter(function (f) { return f.optionen.length; });
  }

  /* Knoten in ein Ziel klonen. Ein Zitat gibt seinen INHALT ab, nicht sich selbst –
     in der Rueckmeldung ist es kein Zitat mehr, sondern die Begruendung. */
  function einsetzen(ziel, knoten) {
    knoten.forEach(function (n) {
      if (n.nodeType === 1 && n.tagName === "BLOCKQUOTE") {
        Array.prototype.slice.call(n.childNodes).forEach(function (m) { ziel.appendChild(m.cloneNode(true)); });
      } else {
        ziel.appendChild(n.cloneNode(true));
      }
    });
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
    /* DIE KÄSTCHEN GEHÖREN DEM CHECK, NICHT DER AUFGABENLISTE. `[x]` markiert die
       richtige Antwort; anklickbar gemacht, ließe sie sich vor dem Start umstellen, und
       eine Fortschrittskarte zählte sie mit. `data-skr-tasklist="off"` nimmt den Block
       aus – das Skriptorium hat die Kästchen beim Laden womöglich schon eingeschaltet,
       deshalb werden sie hier wieder gesperrt. */
    wurzel.setAttribute("data-skr-tasklist", "off");
    wurzel.querySelectorAll('li > input[type="checkbox"]').forEach(function (k) { k.disabled = true; });

    /* EINE NUTZLAST GEHT VOR (payload.js): Trägt der Rahmen den Check verschlüsselt
       und daneben einen Rückfall ohne Lösung, ersetzt ihr Inhalt den Rückfall; sonst
       gilt das Klartext-Markup. */
    var ext = window.skr && window.skr.ext && window.skr.ext.didaktikon;
    var nutzlast = ext && ext.payload ? ext.payload(wurzel) : null;
    if (nutzlast && typeof nutzlast.html === "string") { wurzel.innerHTML = nutzlast.html; }

    var liste = kinder(wurzel).filter(function (k) { return k.tagName === "OL"; })[0];
    if (!liste) { return; }
    var FRAGEN = lesen(liste);
    if (!FRAGEN.length) { return; }

    var DEUTUNGEN = [];
    var deutungKnoten = wurzel.querySelector("[data-skr-didaktikon-quiz-verdicts]");
    if (deutungKnoten) {
      try { DEUTUNGEN = JSON.parse(deutungKnoten.textContent) || []; } catch (e) { DEUTUNGEN = []; }
    }

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
    var elFrage = element("div", "skr-didaktikon-quiz__question", "question");
    elFrage.id = frageId; elFrage.setAttribute("tabindex", "-1");
    var elOptionen = element("div", "skr-didaktikon-quiz__options", "options");
    elOptionen.setAttribute("role", "group");
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
    var elText = element("p", "skr-didaktikon-quiz__verdict", "result-verdict");
    var elNeu = element("button", "skr-didaktikon-quiz__next", "restart");
    elNeu.type = "button"; elNeu.textContent = T("quizAgain");
    [elTitel, elZahl, elText, elNeu].forEach(function (e) { elErgebnis.appendChild(e); });

    [leiste, elBalkenRahmen, elKarte, elErgebnis].forEach(function (e) { bedienung.appendChild(e); });
    liste.parentNode.insertBefore(bedienung, liste.nextSibling);

    var reihenfolge = [], aktuell = 0, punkte = 0, gestartet = false, gewaehlt = [], fertig = false;

    /* --- Der Stand im Browser (#394) ------------------------------------------
       DER FORTSCHRITT ÜBERLEBT DAS NEULADEN: im `localStorage` dieses Browsers, nicht
       in der Adresse – eine geteilte Adresse zeigt keine fremden Antworten. Gespeichert
       werden die gemischte Reihenfolge, die gewählten Antworten, die aktuelle Frage und
       ob ausgewertet ist. Schlüssel: Seite und Check; die Prüfsumme verwirft einen
       Stand, der nicht mehr zum Inhalt passt. Ohne Speicher (privates Fenster,
       gesperrt) läuft der Check wie zuvor, nur ohne Gedächtnis. */
    var SCHLUESSEL = "skr-didaktikon:quiz:" + location.pathname + ":" + (wurzel.id || index);
    var PRUEFSUMME = pruefsumme(liste.outerHTML);
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
      var g = gewaehlt[aktuell];
      if (g != null && !fertig) {
        antworten(reihenfolge[aktuell].optionen[g], elOptionen.querySelectorAll(".skr-didaktikon-quiz__option")[g], true);
      }
      if (fertig) { beenden(true); }
    }

    function zeigen() {
      var eintrag = reihenfolge[aktuell];
      elFrage.textContent = "";
      einsetzen(elFrage, eintrag.frage.frage);
      elFeedback.hidden = true; elFeedback.textContent = "";
      elWeiter.hidden = true;
      elOptionen.textContent = "";

      eintrag.optionen.forEach(function (opt, i) {
        var knopf = element("button", "skr-didaktikon-quiz__option");
        knopf.type = "button";
        var marke = element("span", "skr-didaktikon-quiz__marker");
        marke.textContent = String.fromCharCode(65 + i);
        knopf.appendChild(marke);
        einsetzen(knopf, opt.inhalt);
        knopf.addEventListener("click", function () { antworten(opt, knopf); });
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
      zurueckZeigen();
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
        k.disabled = true;
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

      var deutung = deutungFinden(DEUTUNGEN, punkte / reihenfolge.length);
      elTitel.textContent = (deutung && deutung.title) || T("quizDone");
      elZahl.textContent = T("quizResultLong", { correct: punkte, total: reihenfolge.length });
      elText.textContent = (deutung && deutung.text) || "";
      /* Auch hier wandert der Fokus mit - die Karte ist weg, die Auswertung neu. */
      if (!still) { elTitel.focus(); }
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

    /* ERST JETZT die Klasse setzen - sie blendet die Fragenliste aus und die
       Bedienung ein. Bricht oben etwas ab, bleibt die Liste stehen; nie eine halbe
       Oberflaeche. */
    wurzel.classList.add("skr-didaktikon-quiz--ready");
    var stand = laden();
    if (stand) { wiederherstellen(stand); } else { starten(); }
  });
})();
