/* =============================================================================
   Kreuzworträtsel – Komponente `skr-didaktikon-crossword` (#371)
   -----------------------------------------------------------------------------
   Gehoert zu `crossword.css`. Das Skriptorium laedt beides auf jeder Seite, deren
   Inhalt das Merkmal `skr-didaktikon-crossword` enthaelt (extension.yml), nach `payload.js`.

   DAS MARKUP IST EINE MARKDOWN-DEFINITIONSLISTE – vorgegeben ist nur der Rahmen:

     <div class="skr-didaktikon-crossword" id="tag-1" data-skr-didaktikon-crossword-solution="POD" markdown="1">
     POD
     : Kleinste deploybare Einheit
     </div>

   Der Begriff ist die Antwort, die Beschreibung der Hinweis. Das Lösungswort ist
   optional: Seine Buchstaben werden im Gitter markiert und ergeben es.

   EINE NUTZLAST GEHT VOR: Trägt der Rahmen das Rätsel als Base64-Nutzlast, daneben ein
   Rückfall nur mit den Hinweisen, dekodiert sie `skr.ext.didaktikon.payload`
   (payload.js); Klartext geht ebenso.

   DAS GITTER ENTSTEHT HIER, DETERMINISTISCH: Begriffe nach Länge (bei gleicher Länge in
   der Reihenfolge des Autors), jeder an der ersten passenden Kreuzung – kein Zufall.
   Alle sehen dasselbe Rätsel, und gedruckt ist es dasselbe. Nummern stehen in
   Lesereihenfolge, wie in jedem gedruckten Rätsel. Das Verfahren stammt aus den
   Vorlagen in k8s-materials und cloud-native-entwicklung/docs.

   DER FORTSCHRITT BLEIBT IM BROWSER (localStorage, #394), nicht in der Adresse.
   ============================================================================= */
(function () {
  "use strict";

  /* DIE TEXTE KOMMEN AUS DER ERWEITERUNG (texts/«sprache».yml) – über `ctx.text` in der
     Sprache der Seite, mit Zahlen in ihrem Zahlformat; ein Theme darf sie ändern. Die
     Anmeldung bringt nur den Kontext, Teile meldet dieses Skript nicht an. */
  var ctx = null;
  window.skr.ext.register("didaktikon", function (c) { ctx = c; return {}; });
  function T(schluessel, werte) { return ctx.text(schluessel, werte); }

  /* Ein Begriff im Gitter: Großbuchstaben, ohne Leer- und Satzzeichen. `ß` wird zu `SS`. */
  function begriff(text) {
    return String(text).toLocaleUpperCase("de-DE").replace(/[^\p{L}\p{N}]/gu, "");
  }

  function pruefsumme(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) { h = ((h << 5) + h + text.charCodeAt(i)) | 0; }
    return (h >>> 0).toString(36);
  }

  function element(tag, klasse, haken) {
    var e = document.createElement(tag);
    if (klasse) { e.className = klasse; }
    if (haken) { e.setAttribute("data-skr-didaktikon-crossword-" + haken, ""); }
    return e;
  }

  /* --- Das Markup lesen: Begriff (`dt`), Hinweis (`dd`) ------------------- */
  function lesen(dl) {
    var eintraege = [], aktuell = null;
    Array.prototype.forEach.call(dl.children, function (k) {
      if (k.tagName === "DT") {
        aktuell = { wort: begriff(k.textContent), hinweis: [] };
        eintraege.push(aktuell);
      } else if (k.tagName === "DD" && aktuell) {
        var knoten = Array.prototype.slice.call(k.childNodes);
        /* Ein Hinweis in einem `<p>` (lockere Liste) – in der Schaltfläche zählt nur der Inhalt. */
        if (knoten.length === 1 && knoten[0].tagName === "P") { knoten = Array.prototype.slice.call(knoten[0].childNodes); }
        aktuell.hinweis = aktuell.hinweis.concat(knoten);
      }
    });
    return eintraege.filter(function (e) { return e.wort.length >= 2; });
  }

  /* --- Das Gitter legen (deterministisch) --------------------------------- */
  function legen(eintraege) {
    var groesse = Math.min(160, Math.max(30, eintraege.reduce(function (s, e) { return s + e.wort.length; }, 0) * 2));
    var gitter = [];
    for (var z = 0; z < groesse; z++) { gitter.push(new Array(groesse).fill(null)); }
    var woerter = [];

    function passt(text, r, c, richtung) {
      if (r < 1 || c < 1) { return false; }
      if (richtung === "V" ? r + text.length >= groesse - 1 : c + text.length >= groesse - 1) { return false; }
      for (var i = 0; i < text.length; i++) {
        var rr = richtung === "V" ? r + i : r, cc = richtung === "H" ? c + i : c;
        var feld = gitter[rr][cc];
        if (feld) {
          if (feld.zeichen !== text[i]) { return false; }
          if (feld.richtungen.indexOf(richtung) >= 0) { return false; }
        } else {
          var seiten = richtung === "V" ? [[rr, cc - 1], [rr, cc + 1]] : [[rr - 1, cc], [rr + 1, cc]];
          for (var s = 0; s < seiten.length; s++) { if (gitter[seiten[s][0]][seiten[s][1]]) { return false; } }
          if (i === 0) {
            var vor = richtung === "V" ? gitter[rr - 1][cc] : gitter[rr][cc - 1];
            if (vor) { return false; }
          }
          if (i === text.length - 1) {
            var nach = richtung === "V" ? gitter[rr + 1][cc] : gitter[rr][cc + 1];
            if (nach) { return false; }
          }
        }
      }
      return true;
    }

    function setzen(eintrag, r, c, richtung) {
      for (var i = 0; i < eintrag.wort.length; i++) {
        var rr = richtung === "V" ? r + i : r, cc = richtung === "H" ? c + i : c;
        if (!gitter[rr][cc]) { gitter[rr][cc] = { zeichen: eintrag.wort[i], richtungen: [] }; }
        gitter[rr][cc].richtungen.push(richtung);
      }
      woerter.push({ eintrag: eintrag, r: r, c: c, richtung: richtung });
    }

    var sortiert = eintraege.map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) { return (b.e.wort.length - a.e.wort.length) || (a.i - b.i); })
      .map(function (x) { return x.e; });
    if (!sortiert.length) { return { gitter: [], woerter: [] }; }

    setzen(sortiert[0], Math.floor(groesse / 3), Math.floor(groesse / 3), "H");
    var gelegt = [sortiert[0]];
    for (var runde = 0; runde < 10 && gelegt.length < sortiert.length; runde++) {
      sortiert.forEach(function (eintrag) {
        if (gelegt.indexOf(eintrag) >= 0) { return; }
        var text = eintrag.wort, ort = null;
        for (var w = 0; w < woerter.length && !ort; w++) {
          var da = woerter[w], quer = da.richtung === "H" ? "V" : "H";
          for (var j = 0; j < da.eintrag.wort.length && !ort; j++) {
            for (var k = 0; k < text.length && !ort; k++) {
              if (da.eintrag.wort[j] !== text[k]) { continue; }
              var r = quer === "V" ? da.r - k : da.r + j, c = quer === "V" ? da.c + j : da.c - k;
              if (passt(text, r, c, quer)) { ort = { r: r, c: c, richtung: quer }; }
            }
          }
        }
        if (ort) { setzen(eintrag, ort.r, ort.c, ort.richtung); gelegt.push(eintrag); }
      });
    }
    /* Was nirgends kreuzt, steht für sich – waagrecht, mit Abstand. */
    sortiert.forEach(function (eintrag) {
      if (gelegt.indexOf(eintrag) >= 0) { return; }
      for (var r = 2; r < groesse - 2; r += 2) {
        for (var c = 2; c < groesse - 2; c += 2) {
          if (passt(eintrag.wort, r, c, "H")) { setzen(eintrag, r, c, "H"); gelegt.push(eintrag); return; }
        }
      }
    });

    /* Auf das Nötige zuschneiden. */
    var minR = groesse, maxR = 0, minC = groesse, maxC = 0;
    for (var rr = 0; rr < groesse; rr++) {
      for (var cc = 0; cc < groesse; cc++) {
        if (gitter[rr][cc]) { minR = Math.min(minR, rr); maxR = Math.max(maxR, rr); minC = Math.min(minC, cc); maxC = Math.max(maxC, cc); }
      }
    }
    var zugeschnitten = [];
    for (var zr = minR; zr <= maxR; zr++) { zugeschnitten.push(gitter[zr].slice(minC, maxC + 1)); }
    woerter.forEach(function (w) { w.r -= minR; w.c -= minC; });

    /* NUMMERN IN LESEREIHENFOLGE: je Anfangsfeld eine Nummer, ein Feld, an dem ein
       waagrechtes und ein senkrechtes Wort beginnen, trägt beide unter einer. */
    var anfaenge = {};
    woerter.forEach(function (w) { anfaenge[w.r + ":" + w.c] = { r: w.r, c: w.c }; });
    Object.keys(anfaenge).map(function (k) { return anfaenge[k]; })
      .sort(function (a, b) { return (a.r - b.r) || (a.c - b.c); })
      .forEach(function (a, i) { a.nummer = i + 1; });
    woerter.forEach(function (w) { w.nummer = anfaenge[w.r + ":" + w.c].nummer; });
    return { gitter: zugeschnitten, woerter: woerter };
  }

  /* Das Lösungswort legen: je Buchstabe ein Feld mit diesem Buchstaben, verteilt über
     möglichst viele Wörter – hingen alle in einem, verriete dessen Lösung schon das
     Lösungswort. Gesucht wird die Belegung, deren meistbelegtes Wort am wenigsten Felder
     trägt, danach die gleichmäßigste; ein Kreuzungsfeld zählt für beide Wörter. Die Suche
     ist deterministisch (Lesereihenfolge bei Gleichstand) und begrenzt; reicht die Grenze
     nicht, gilt die beste bis dahin gefundene Belegung. Fehlt ein Buchstabe im Gitter,
     gibt es kein Lösungswort (leere Liste). */
  function loesungLegen(loesung, felder, anzahlWoerter) {
    if (!loesung) { return []; }
    var kandidaten = [];
    for (var i = 0; i < loesung.length; i++) {
      kandidaten.push(felder.filter(function (f) { return f.zeichen === loesung[i]; }));
      if (!kandidaten[i].length) { return []; }
    }
    /* Der Buchstabe mit den wenigsten Feldern zuerst. */
    var folge = kandidaten.map(function (k, j) { return j; })
      .sort(function (a, b) { return kandidaten[a].length - kandidaten[b].length || a - b; });
    var belegt = [], zahl = [], best = null, schritte = 0;
    for (var w = 0; w < anzahlWoerter; w++) { zahl.push(0); }

    function wert() {
      var max = 0, quadrate = 0;
      zahl.forEach(function (z) { if (z > max) { max = z; } quadrate += z * z; });
      return [max, quadrate];
    }
    function schlechter(a, b) { return a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1]); }

    function suchen(k) {
      if (++schritte > 5000) { return; }
      var jetzt = wert();
      if (best && schlechter(jetzt, best.wert)) { return; }
      if (k === folge.length) { best = { wert: jetzt, felder: belegt.slice() }; return; }
      var stelle = folge[k];
      var frei = kandidaten[stelle].filter(function (f) { return belegt.indexOf(f) < 0; });
      frei.sort(function (a, b) {
        var ka = 0, kb = 0;
        a.woerter.forEach(function (fw) { ka += zahl[fw.wort]; });
        b.woerter.forEach(function (fw) { kb += zahl[fw.wort]; });
        return ka - kb || a.woerter.length - b.woerter.length;
      });
      for (var j = 0; j < frei.length; j++) {
        var f = frei[j];
        belegt[stelle] = f;
        f.woerter.forEach(function (fw) { zahl[fw.wort]++; });
        suchen(k + 1);
        f.woerter.forEach(function (fw) { zahl[fw.wort]--; });
        belegt[stelle] = undefined;
      }
    }
    suchen(0);
    return best ? best.felder : [];
  }

  var zaehler = 0;

  document.querySelectorAll(".skr-didaktikon-crossword").forEach(function (wurzel, index) {
    var ext = window.skr && window.skr.ext && window.skr.ext.didaktikon;
    var nutzlast = ext && ext.payload ? ext.payload(wurzel) : null;
    if (nutzlast && typeof nutzlast.html === "string") { wurzel.innerHTML = nutzlast.html; }
    var loesungRoh = (nutzlast && nutzlast.solution) || wurzel.getAttribute("data-skr-didaktikon-crossword-solution") || "";

    var dl = wurzel.querySelector(":scope > dl");
    if (!dl) { return; }
    var eintraege = lesen(dl);
    if (!eintraege.length) { return; }
    var lage = legen(eintraege);
    zaehler++;

    /* --- Felder in Lesereihenfolge, je mit ihren Wörtern -------------------- */
    var felder = [], feldAn = {};
    lage.gitter.forEach(function (zeile, r) {
      zeile.forEach(function (f, c) {
        if (!f) { return; }
        var feld = { r: r, c: c, zeichen: f.zeichen, woerter: [], eingabe: null, zelle: null };
        feldAn[r + ":" + c] = feld;
        felder.push(feld);
      });
    });
    lage.woerter.forEach(function (w, wi) {
      w.felder = [];
      for (var i = 0; i < w.eintrag.wort.length; i++) {
        var f = feldAn[(w.richtung === "V" ? w.r + i : w.r) + ":" + (w.richtung === "H" ? w.c + i : w.c)];
        w.felder.push(f);
        f.woerter.push({ wort: wi, stelle: i + 1 });
      }
    });

    var loesung = begriff(loesungRoh);
    var loesungsFelder = loesungLegen(loesung, felder, lage.woerter.length);
    if (loesung && !loesungsFelder.length && window.console) {
      console.warn("Kreuzworträtsel: Das Lösungswort lässt sich nicht im Gitter legen.");
    }

    /* --- Die Bedienung bauen ---------------------------------------------- */
    var bedienung = element("div", "skr-didaktikon-crossword__ui");
    var brett = element("div", "skr-didaktikon-crossword__board");
    var rollbar = element("div", "skr-didaktikon-crossword__scroll");
    var gitterEl = element("div", "skr-didaktikon-crossword__grid");
    var breite = lage.gitter[0] ? lage.gitter[0].length : 0;

    lage.gitter.forEach(function (zeile, r) {
      var zeileEl = element("div", "skr-didaktikon-crossword__row");
      zeile.forEach(function (f, c) {
        var zelle = element("div", "skr-didaktikon-crossword__cell");
        var feld = feldAn[r + ":" + c];
        if (!feld) { zelle.classList.add("skr-didaktikon-crossword__cell--block"); zeileEl.appendChild(zelle); return; }
        var nummer = lage.woerter.filter(function (w) { return w.r === r && w.c === c; })[0];
        if (nummer) {
          var n = element("span", "skr-didaktikon-crossword__num");
          n.textContent = nummer.nummer;
          n.setAttribute("aria-hidden", "true");
          zelle.appendChild(n);
        }
        var si = loesungsFelder.indexOf(feld);
        if (si >= 0) {
          zelle.classList.add("skr-didaktikon-crossword__cell--solution");
          zelle.setAttribute("data-skr-didaktikon-crossword-solution-index", String(si + 1));
        }
        var eingabe = element("input");
        eingabe.type = "text";
        eingabe.setAttribute("maxlength", "2");
        eingabe.setAttribute("autocomplete", "off");
        eingabe.setAttribute("autocapitalize", "characters");
        eingabe.setAttribute("spellcheck", "false");
        eingabe.tabIndex = -1;
        eingabe.setAttribute("aria-label", feld.woerter.map(function (fw) {
          var w = lage.woerter[fw.wort];
          return T(w.richtung === "H" ? "crosswordCellAcross" : "crosswordCellDown", { number: w.nummer, position: fw.stelle });
        }).join("; "));
        feld.eingabe = eingabe; feld.zelle = zelle;
        zelle.appendChild(eingabe);
        zeileEl.appendChild(zelle);
      });
      gitterEl.appendChild(zeileEl);
    });
    rollbar.appendChild(gitterEl);

    var hinweise = element("div", "skr-didaktikon-crossword__clues");
    var hinweisZu = [];
    [["H", T("crosswordAcross"), "across"], ["V", T("crosswordDown"), "down"]].forEach(function (art) {
      var liste = lage.woerter.map(function (w, wi) { return { w: w, wi: wi }; })
        .filter(function (x) { return x.w.richtung === art[0]; })
        .sort(function (a, b) { return a.w.nummer - b.w.nummer; });
      if (!liste.length) { return; }
      var gruppe = element("div", "skr-didaktikon-crossword__clue-group");
      var titel = element("p", "skr-didaktikon-crossword__clue-title");
      titel.textContent = art[1];
      var ol = element("ol");
      ol.setAttribute("data-skr-didaktikon-crossword-clues", art[2]);
      liste.forEach(function (x) {
        var item = element("li", "skr-didaktikon-crossword__clue");
        var knopf = element("button");
        knopf.type = "button";
        var nr = element("span", "skr-didaktikon-crossword__clue-num");
        nr.textContent = x.w.nummer;
        knopf.appendChild(nr);
        x.w.eintrag.hinweis.forEach(function (k) { knopf.appendChild(k.cloneNode(true)); });
        knopf.addEventListener("click", function () { waehlen(x.wi); });
        item.appendChild(knopf);
        ol.appendChild(item);
        hinweisZu[x.wi] = item;
      });
      gruppe.appendChild(titel);
      gruppe.appendChild(ol);
      hinweise.appendChild(gruppe);
    });

    brett.appendChild(rollbar);
    brett.appendChild(hinweise);
    bedienung.appendChild(brett);

    var loesungEl = null, loesungsEingaben = [];
    if (loesungsFelder.length) {
      loesungEl = element("div", "skr-didaktikon-crossword__solution");
      var lt = element("p", "skr-didaktikon-crossword__solution-title");
      lt.textContent = T("crosswordSolution");
      var reihe = element("div", "skr-didaktikon-crossword__solution-letters");
      loesungsFelder.forEach(function (f, i) {
        var e = element("input");
        e.type = "text"; e.readOnly = true; e.tabIndex = -1;
        e.setAttribute("aria-label", T("crosswordSolutionCell", { position: i + 1 }));
        reihe.appendChild(e);
        loesungsEingaben.push(e);
      });
      loesungEl.appendChild(lt);
      loesungEl.appendChild(reihe);
      bedienung.appendChild(loesungEl);
    }
    var status = element("p", "skr-didaktikon-crossword__status", "status");
    status.setAttribute("role", "status");
    bedienung.appendChild(status);

    var leiste = element("div", "skr-didaktikon-crossword__actions");
    function knopf(text, haken, wert) {
      var k = element("button", "skr-btn skr-btn--ghost");
      k.type = "button";
      k.textContent = text;
      k.setAttribute("data-skr-didaktikon-crossword-" + haken, wert || "");
      leiste.appendChild(k);
      return k;
    }
    var tippBuchstabe = knopf(T("crosswordHintLetter"), "hint", "letter");
    var tippWort = knopf(T("crosswordHintWord"), "hint", "word");
    var aufloesen = knopf(T("crosswordReveal"), "reveal");
    var neu = knopf(T("crosswordRestart"), "reset");
    bedienung.appendChild(leiste);
    dl.parentNode.insertBefore(bedienung, dl.nextSibling);

    /* --- Zustand -------------------------------------------------------------- */
    var aktuell = felder[0], richtung = "H", aufgeloest = false;
    var SCHLUESSEL = "skr-didaktikon:crossword:" + location.pathname + ":" + (wurzel.id || index);
    var PRUEFSUMME = pruefsumme(eintraege.map(function (e) { return e.wort; }).join(",") + "|" + loesung);

    function sichern() {
      try {
        localStorage.setItem(SCHLUESSEL, JSON.stringify({
          h: PRUEFSUMME, a: aufgeloest, e: felder.map(function (f) { return f.eingabe.value; })
        }));
      } catch (e) { /* ohne Speicher eben ohne Gedächtnis */ }
    }
    function vergessen() { try { localStorage.removeItem(SCHLUESSEL); } catch (e) { /* dito */ } }
    function laden() {
      var s;
      try { s = JSON.parse(localStorage.getItem(SCHLUESSEL)); } catch (e) { return null; }
      return (s && s.h === PRUEFSUMME && Array.isArray(s.e) && s.e.length === felder.length) ? s : null;
    }

    function wortAn(feld, r) {
      var treffer = feld.woerter.filter(function (fw) { return lage.woerter[fw.wort].richtung === r; })[0];
      return treffer ? treffer.wort : feld.woerter[0].wort;
    }

    function markieren() {
      var wi = wortAn(aktuell, richtung);
      richtung = lage.woerter[wi].richtung;
      felder.forEach(function (f) {
        f.eingabe.tabIndex = f === aktuell ? 0 : -1;
        f.zelle.classList.toggle("skr-didaktikon-crossword__cell--word", lage.woerter[wi].felder.indexOf(f) >= 0);
        f.zelle.classList.toggle("skr-didaktikon-crossword__cell--current", f === aktuell);
      });
      hinweisZu.forEach(function (li, i) {
        li.classList.toggle("skr-didaktikon-crossword__clue--current", i === wi);
        if (i === wi) { li.setAttribute("aria-current", "true"); } else { li.removeAttribute("aria-current"); }
      });
    }

    function pruefen() {
      var alle = true;
      felder.forEach(function (f) { f.zelle.classList.remove("skr-didaktikon-crossword__cell--solved", "skr-didaktikon-crossword__cell--wrong"); });
      lage.woerter.forEach(function (w, wi) {
        var richtig = w.felder.every(function (f) { return f.eingabe.value === f.zeichen; });
        // Vollständig, aber falsch: erst dann rot – ein halbes Wort ist noch kein Fehler.
        var falsch = !richtig && w.felder.every(function (f) { return f.eingabe.value !== ""; });
        if (!richtig) { alle = false; }
        hinweisZu[wi].classList.toggle("skr-didaktikon-crossword__clue--solved", richtig);
        hinweisZu[wi].classList.toggle("skr-didaktikon-crossword__clue--wrong", falsch);
        if (richtig) { w.felder.forEach(function (f) { f.zelle.classList.add("skr-didaktikon-crossword__cell--solved"); }); }
        if (falsch) { w.felder.forEach(function (f) { f.zelle.classList.add("skr-didaktikon-crossword__cell--wrong"); }); }
      });
      loesungsFelder.forEach(function (f, i) { loesungsEingaben[i].value = f.eingabe.value; });
      status.textContent = alle ? T("crosswordSolved") : "";
      wurzel.classList.toggle("skr-didaktikon-crossword--solved", alle);
    }

    function gehe(feld, fokus) {
      if (!feld) { return; }
      aktuell = feld;
      markieren();
      if (fokus !== false) { feld.eingabe.focus(); feld.eingabe.select(); }
    }

    function waehlen(wi) {
      richtung = lage.woerter[wi].richtung;
      var w = lage.woerter[wi];
      gehe(w.felder.filter(function (f) { return !f.eingabe.value; })[0] || w.felder[0]);
    }

    /* Das nächste Feld in einer Richtung – über Lücken hinweg. */
    function nachbar(feld, dr, dc) {
      for (var r = feld.r + dr, c = feld.c + dc; r >= 0 && c >= 0 && r < lage.gitter.length && c < breite; r += dr, c += dc) {
        if (feldAn[r + ":" + c]) { return feldAn[r + ":" + c]; }
      }
      return null;
    }
    /* Im aktuellen Wort weiter oder zurück. */
    function imWort(feld, schritt) {
      var w = lage.woerter[wortAn(feld, richtung)];
      return w.felder[w.felder.indexOf(feld) + schritt] || null;
    }

    felder.forEach(function (f) {
      f.eingabe.addEventListener("focus", function () {
        if (aktuell !== f) { aktuell = f; markieren(); }
      });
      /* Ein zweiter Klick auf dasselbe Feld wechselt die Richtung – wo zwei Wörter kreuzen. */
      f.eingabe.addEventListener("mousedown", function () {
        if (aktuell === f && f.woerter.length > 1) { richtung = richtung === "H" ? "V" : "H"; markieren(); }
      });
      f.eingabe.addEventListener("input", function () {
        var zeichen = begriff(f.eingabe.value).slice(-1);
        f.eingabe.value = zeichen;
        pruefen(); sichern();
        if (zeichen) { gehe(imWort(f, 1) || f); }
      });
      f.eingabe.addEventListener("keydown", function (e) {
        var ziel = null;
        if (e.key === "ArrowRight") { ziel = nachbar(f, 0, 1); richtung = "H"; }
        else if (e.key === "ArrowLeft") { ziel = nachbar(f, 0, -1); richtung = "H"; }
        else if (e.key === "ArrowDown") { ziel = nachbar(f, 1, 0); richtung = "V"; }
        else if (e.key === "ArrowUp") { ziel = nachbar(f, -1, 0); richtung = "V"; }
        else if (e.key === "Backspace") {
          e.preventDefault();
          if (f.eingabe.value) { f.eingabe.value = ""; } else {
            ziel = imWort(f, -1);
            if (ziel) { ziel.eingabe.value = ""; }
          }
          pruefen(); sichern();
          if (ziel) { gehe(ziel); }
          return;
        } else { return; }
        e.preventDefault();
        if (ziel) { gehe(ziel); } else { markieren(); }
      });
    });

    function fragen(titel, text, ja) {
      return (window.skr && window.skr.dialog)
        ? window.skr.dialog.choose({ title: titel, text: text, choices: [{ label: ja, value: true, primary: true }] })
        : Promise.resolve(window.confirm(titel));
    }

    tippBuchstabe.addEventListener("click", function () {
      var feld = aktuell.eingabe.value === aktuell.zeichen
        ? (lage.woerter[wortAn(aktuell, richtung)].felder.filter(function (f) { return f.eingabe.value !== f.zeichen; })[0] || aktuell)
        : aktuell;
      feld.eingabe.value = feld.zeichen;
      pruefen(); sichern();
      gehe(feld);
    });
    tippWort.addEventListener("click", function () {
      lage.woerter[wortAn(aktuell, richtung)].felder.forEach(function (f) { f.eingabe.value = f.zeichen; });
      pruefen(); sichern();
      gehe(aktuell);
    });
    aufloesen.addEventListener("click", function () {
      fragen(T("crosswordRevealTitle"), T("crosswordRevealText"), T("crosswordReveal")).then(function (ja) {
        if (!ja) { return; }
        felder.forEach(function (f) { f.eingabe.value = f.zeichen; });
        aufgeloest = true;
        pruefen(); sichern();
      });
    });
    neu.addEventListener("click", function () {
      fragen(T("crosswordRestartTitle"), T("crosswordRestartText"), T("crosswordRestart")).then(function (ja) {
        if (!ja) { return; }
        felder.forEach(function (f) { f.eingabe.value = ""; });
        aufgeloest = false;
        vergessen();
        pruefen();
        gehe(felder[0]);
      });
    });

    var stand = laden();
    if (stand) {
      felder.forEach(function (f, i) { f.eingabe.value = begriff(stand.e[i] || "").slice(-1); });
      aufgeloest = !!stand.a;
    }
    markieren();
    pruefen();
    wurzel.classList.add("skr-didaktikon-crossword--ready");
  });
})();
