/* =============================================================================
   Layout „quiz“ – Wissens-Check
   -----------------------------------------------------------------------------
   Gehoert zu `_layouts/quiz.html` und `quiz.css`. Die SEITE traegt nur die
   Fragen (Front Matter `quiz.questions`); das Layout schreibt sie als JSON in
   die Seite, dieses Skript baut daraus die Bedienung.

   WARUM DAS HIER LIEGT UND NICHT IN DER SEITE: Die erste Fassung stand als rund
   240 Zeilen CSS und JavaScript IN einer Unterlage. Beim zweiten Wissens-Check
   haette jemand sie kopiert - ab dann zwei Fassungen, die auseinanderlaufen, und
   ein Fehler in der Mechanik an zwei Stellen zu beheben.
   ============================================================================= */
(function () {
  "use strict";

  /* Texte, die erst im Browser entstehen, tragen ihr eigenes Mini-Woerterbuch
     und lesen `<html lang>` - so schreibt es AGENTS.md vor. Unbekannte Sprache
     bekommt Deutsch. */
  var TEXTE = {
    de: {
      frageVon: "Frage %1 von %2", richtigZahl: "%1 richtig",
      ergebnis: "%1 von %2 richtig", ergebnisLang: "%1 von %2 Fragen richtig",
      fertig: "Fertig", weiter: "Weiter", auswertung: "Auswertung",
      nochmal: "Noch einmal", richtig: "Richtig.", daneben: "Nicht ganz.",
      richtigWaere: "Richtig wäre gewesen:"
    },
    en: {
      frageVon: "Question %1 of %2", richtigZahl: "%1 correct",
      ergebnis: "%1 of %2 correct", ergebnisLang: "%1 of %2 questions correct",
      fertig: "Done", weiter: "Next", auswertung: "Result",
      nochmal: "Start over", richtig: "Correct.", daneben: "Not quite.",
      richtigWaere: "The correct answer would have been:"
    }
  };
  var T = TEXTE[(document.documentElement.getAttribute("lang") || "de")
    .split("-")[0].toLowerCase()] || TEXTE.de;

  function fuellen(vorlage, a, b) {
    return vorlage.replace("%1", a).replace("%2", b);
  }

  /* Die Deutung am Ende ist KURSSTOFF, nicht Theme-Text: Sie verweist auf die
     Unterlagen dieses Kurses. Deshalb kommt sie aus dem Front Matter. Fehlt sie,
     bleibt die Auswertung bei der nackten Zahl - besser als ein Satz, der auf
     Material verweist, das es hier nicht gibt. */
  function deutungFinden(deutungen, anteil) {
    var treffer = null;
    (deutungen || []).forEach(function (d) {
      var ab = typeof d.min === "number" ? d.min : 0;
      if (anteil >= ab && (!treffer || ab >= treffer.min)) { treffer = { min: ab, d: d }; }
    });
    return treffer && treffer.d;
  }

  document.querySelectorAll("[data-avd-academy-quiz]").forEach(function (wurzel) {
    var datenKnoten = wurzel.querySelector("[data-avd-academy-quiz-data]");
    if (!datenKnoten) { return; }

    var daten;
    try { daten = JSON.parse(datenKnoten.textContent); } catch (e) { return; }
    var FRAGEN = (daten && daten.questions) || [];
    var DEUTUNGEN = (daten && daten.verdicts) || [];
    if (!FRAGEN.length) { return; }

    var q = function (name) { return wurzel.querySelector("[data-avd-academy-quiz-" + name + "]"); };
    var elKontext = q("context"), elFrage = q("question"), elOptionen = q("options"),
        elFeedback = q("feedback"), elWeiter = q("next"), elKarte = q("card"),
        elErgebnis = q("result"), elZaehler = q("counter"), elPunkte = q("score"),
        elBalken = q("progress"), elBalkenRahmen = q("bar");
    if (!elKarte || !elOptionen || !elWeiter) { return; }

    var reihenfolge = [], aktuell = 0, punkte = 0, gestartet = false;

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
      reihenfolge = FRAGEN.map(function (f) {
        return { frage: f, optionen: mischen(f.options || []) };
      });
      aktuell = 0; punkte = 0;
      if (elErgebnis) { elErgebnis.hidden = true; }
      elKarte.hidden = false;
      zeigen();
    }

    function zeigen() {
      var eintrag = reihenfolge[aktuell];
      if (elKontext) { elKontext.textContent = eintrag.frage.context || ""; }
      if (elFrage) { elFrage.textContent = eintrag.frage.question || ""; }
      if (elFeedback) { elFeedback.hidden = true; elFeedback.textContent = ""; }
      elWeiter.hidden = true;
      elOptionen.textContent = "";

      eintrag.optionen.forEach(function (opt, i) {
        var knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "avd-academy-quiz__option";
        var marke = document.createElement("span");
        marke.className = "avd-academy-quiz__marker";
        marke.textContent = String.fromCharCode(65 + i);
        knopf.appendChild(marke);
        knopf.appendChild(document.createTextNode(opt.text || ""));
        knopf.addEventListener("click", function () { antworten(opt, knopf); });
        elOptionen.appendChild(knopf);
      });

      if (elZaehler) { elZaehler.textContent = fuellen(T.frageVon, aktuell + 1, reihenfolge.length); }
      if (elPunkte) { elPunkte.textContent = fuellen(T.richtigZahl, punkte); }
      var stand = Math.round(aktuell / reihenfolge.length * 100);
      if (elBalken) { elBalken.style.width = stand + "%"; }
      if (elBalkenRahmen) {
        elBalkenRahmen.setAttribute("aria-valuenow", String(stand));
        elBalkenRahmen.setAttribute("aria-valuetext",
          fuellen(T.frageVon, aktuell + 1, reihenfolge.length));
      }

      /* DER FOKUS MUSS MITKOMMEN. „Weiter“ blendet sich nach dem Klick aus - wer
         mit der Tastatur arbeitet, stuende danach mit dem Fokus im Nichts (beim
         `body`) und muesste sich von vorn durch die Seite tabben. Die Frage nimmt
         ihn auf; zugleich liest eine Vorlesehilfe damit die neue Frage vor.
         NICHT beim ersten Aufbau: Dort hat noch niemand etwas bedient, und ein
         Sprung in die Seite beim blossen Laden waere eine Entfuehrung. */
      if (elFrage && gestartet) { elFrage.focus(); }
    }

    function absatz(text, klasse) {
      var p = document.createElement("p");
      if (klasse) { p.className = klasse; }
      p.textContent = text;
      return p;
    }

    function antworten(gewaehlt, knopf) {
      var knoepfe = Array.prototype.slice.call(
        elOptionen.querySelectorAll(".avd-academy-quiz__option"));
      var eintrag = reihenfolge[aktuell];

      knoepfe.forEach(function (k, i) {
        k.disabled = true;
        /* DIE RICHTIGE ANTWORT WIRD IMMER MARKIERT - auch wenn daneben gegriffen
           wurde. Wer nur sieht, dass er falsch lag, lernt nichts. */
        if (eintrag.optionen[i].correct) { k.classList.add("avd-academy-quiz__option--correct"); }
      });
      if (!gewaehlt.correct) { knopf.classList.add("avd-academy-quiz__option--wrong"); }
      if (gewaehlt.correct) { punkte++; }

      if (elFeedback) {
        elFeedback.textContent = "";
        elFeedback.appendChild(absatz(gewaehlt.correct ? T.richtig : T.daneben,
                                      "avd-academy-quiz__feedback-head"));
        if (gewaehlt.feedback) { elFeedback.appendChild(absatz(gewaehlt.feedback)); }
        if (!gewaehlt.correct) {
          var richtige = eintrag.optionen.filter(function (o) { return o.correct; })[0];
          if (richtige) {
            var p = document.createElement("p");
            var stark = document.createElement("strong");
            stark.textContent = T.richtigWaere;
            p.appendChild(stark);
            p.appendChild(document.createTextNode(
              " " + (richtige.text || "") + (richtige.feedback ? " " + richtige.feedback : "")));
            elFeedback.appendChild(p);
          }
        }
        elFeedback.hidden = false;
      }

      if (elPunkte) { elPunkte.textContent = fuellen(T.richtigZahl, punkte); }
      elWeiter.hidden = false;
      elWeiter.textContent = (aktuell + 1 < reihenfolge.length) ? T.weiter : T.auswertung;
      elWeiter.focus();
    }

    function beenden() {
      elKarte.hidden = true;
      if (elErgebnis) { elErgebnis.hidden = false; }
      if (elBalken) { elBalken.style.width = "100%"; }
      if (elBalkenRahmen) {
        elBalkenRahmen.setAttribute("aria-valuenow", "100");
        elBalkenRahmen.setAttribute("aria-valuetext", T.fertig);
      }
      if (elZaehler) { elZaehler.textContent = T.fertig; }
      if (elPunkte) { elPunkte.textContent = fuellen(T.ergebnis, punkte, reihenfolge.length); }

      var deutung = deutungFinden(DEUTUNGEN, punkte / reihenfolge.length);
      var elTitel = q("result-title"), elZahl = q("result-score"), elText = q("result-verdict");
      if (elTitel) { elTitel.textContent = (deutung && deutung.title) || T.fertig; }
      /* Auch hier wandert der Fokus mit - die Karte ist weg, die Auswertung neu. */
      if (elTitel) { elTitel.setAttribute("tabindex", "-1"); elTitel.focus(); }
      if (elZahl) { elZahl.textContent = fuellen(T.ergebnisLang, punkte, reihenfolge.length); }
      if (elText) { elText.textContent = (deutung && deutung.text) || ""; }
    }

    elWeiter.addEventListener("click", function () {
      gestartet = true;
      aktuell++;
      if (aktuell < reihenfolge.length) { zeigen(); return; }
      beenden();
    });

    var neu = q("restart");
    if (neu) { neu.addEventListener("click", function () { gestartet = true; starten(); }); }
    if (neu) { neu.textContent = T.nochmal; }

    /* ERST JETZT die Klasse setzen - sie blendet den Rueckfall aus und die
       Bedienung ein. Bricht oben etwas ab, bleibt die Fragenliste stehen; nie
       eine halbe Oberflaeche. */
    wurzel.classList.add("avd-academy-quiz--ready");
    starten();
  });
})();
