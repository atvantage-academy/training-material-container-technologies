/* =============================================================================
   ATVANTAGE Brand – interaktives Verhalten
   -----------------------------------------------------------------------------
   Kleines, abhängigkeitsfreies Skript für markenweite Interaktionen, die in
   JEDER Unterlage verfügbar sein sollen. Bewusst schlank gehalten; unterlagen-
   spezifische Logik gehört in das Skript der jeweiligen Unterlage.

   Aktuell enthalten:
     - Theme-Umschaltung  (Elemente mit [data-avd-academy-theme-toggle])
     - "Kopieren"-Buttons an Code-Blöcken (<pre>)
     - Mobiles Aufklappen der Header-Navigation ([data-avd-academy-nav-toggle])
     - "Markdown kopieren" auf Übungsseiten ([data-avd-academy-copy-md])
     - QR-Code der Seiten-URL ([data-avd-academy-qr])

   Einbindung: <script src="<BASISPFAD>/atvantage.js" defer></script>
   ============================================================================= */
(function () {
  "use strict";

  /* Eigene Adresse merken, SOLANGE das Skript läuft: `document.currentScript` ist
     nur während der Ausführung gesetzt (bei `defer` also genau hier, nicht mehr in
     späteren Callbacks). Der QR-Code lädt seine Bibliothek relativ dazu nach – so
     braucht das Skript weder den Jekyll-`baseurl` noch einen fest verdrahteten
     Pfad. Inline eingebunden (kein `src`) bleibt der Wert leer; dann fällt der
     Nachladepfad auf die Dokument-Basis zurück. */
  var scriptUrl = (document.currentScript && document.currentScript.src) || "";

  /* --- Theme-Umschaltung -------------------------------------------------- */
  function initThemeToggle() {
    document.querySelectorAll("[data-avd-academy-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var root = document.documentElement;
        var next = root.getAttribute("data-avd-academy-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-avd-academy-theme", next);
        try { localStorage.setItem("avd-academy-theme", next); } catch (e) { /* egal */ }
      });
    });
    try {
      var saved = localStorage.getItem("avd-academy-theme");
      if (saved) document.documentElement.setAttribute("data-avd-academy-theme", saved);
    } catch (e) { /* egal */ }
  }

  /* --- Beschriftungen, die erst im Browser entstehen -----------------------
     Die meisten Texte des Themes setzt Liquid beim Bauen (siehe
     theme/jekyll/_includes/avd-i18n.html). Diese drei nicht: Sie gehören zu
     Elementen, die dieses Skript SELBST erzeugt – die Kopieren-Knöpfe an
     Codeblöcken und den Schließen-Knopf eines Reveals.

     GELESEN WIRD `<html lang>`. Das Attribut setzt jedes Theme-Layout aus der
     Sprache der Seite; damit gilt hier dieselbe Sprache wie im übrigen Markup.
     Auch die eigenständige Seitenvorlage (theme/academy/page-template.html) trägt
     es – deshalb funktioniert dieser Weg auch ohne Jekyll.

     Unbekannte Sprache fällt auf Deutsch zurück, wie im Wörterbuch des Layouts. */
  var TEXTE = {
    de: { kopieren: "Kopieren", kopiert: "Kopiert!", schließen: "Schließen",
          erledigt: "erledigt", schritt: "Arbeitsschritt" },
    en: { kopieren: "Copy",     kopiert: "Copied!",  schließen: "Close",
          erledigt: "done",     schritt: "Step" }
  };
  var T = TEXTE[(document.documentElement.getAttribute("lang") || "de").split("-")[0].toLowerCase()] || TEXTE.de;

  /* --- Kopieren-Buttons an Code-Blöcken ----------------------------------- */
  function initCopyButtons() {
    document.querySelectorAll("pre > code").forEach(function (code) {
      var pre = code.parentElement;
      if (pre.querySelector(".avd-academy-copy")) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "avd-academy-btn avd-academy-btn--primary avd-academy-copy";
      btn.title = T.kopieren;
      btn.setAttribute("aria-label", T.kopieren);
      btn.style.position = "absolute";
      btn.style.top = "0.5rem";
      btn.style.right = "0.5rem";
      pre.style.position = "relative";
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(code.innerText).then(function () {
          btn.classList.add("is-copied");
          btn.title = T.kopiert;
          setTimeout(function () {
            btn.classList.remove("is-copied");
            btn.title = T.kopieren;
          }, 1500);
        });
      });
      pre.appendChild(btn);
    });
  }

  /* --- Mobile Navigation --------------------------------------------------
     Der Burger klappt das per CSS (max-width) eingeklappte Nav auf/zu. Auf
     breiten Viewports ist der Burger ausgeblendet und das Nav ohnehin sichtbar;
     das Attribut [data-open] ist dort wirkungslos. */
  function closeAllNavs() {
    document.querySelectorAll("[data-avd-academy-nav-toggle]").forEach(function (btn) {
      var t = document.querySelector(btn.getAttribute("data-avd-academy-nav-toggle"));
      if (t) t.removeAttribute("data-open");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function initNavToggle() {
    var toggles = document.querySelectorAll("[data-avd-academy-nav-toggle]");
    if (!toggles.length) return;

    toggles.forEach(function (btn) {
      var target = document.querySelector(btn.getAttribute("data-avd-academy-nav-toggle"));
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
      if (!e.target.closest(".avd-academy-header")) closeAllNavs();
    });
  }

  /* --- "Markdown kopieren" (Übungsseiten) ---------------------------------
     Kopiert den rohen Markdown-Inhalt aus dem versteckten <textarea>, auf das
     der Button per [data-avd-academy-copy-md="#id"] zeigt. */
  function initCopyMarkdown() {
    document.querySelectorAll("[data-avd-academy-copy-md]").forEach(function (btn) {
      var src = document.querySelector(btn.getAttribute("data-avd-academy-copy-md"));
      if (!src) return;
      btn.addEventListener("click", function () {
        var text = (src.value != null) ? src.value : src.textContent;
        navigator.clipboard.writeText(text).then(function () {
          var oldTitle = btn.title || btn.getAttribute("aria-label");
          btn.classList.add("is-copied");
          btn.title = T.kopiert;
          setTimeout(function () {
            btn.classList.remove("is-copied");
            btn.title = oldTitle;
          }, 1500);
        });
      });
    });
  }

  /* --- Übung: Inhaltsverzeichnis automatisch aus Überschriften ------------- */
  function initGuideToc() {
    var toc = document.querySelector("[data-avd-academy-toc]");
    var main = document.querySelector(".avd-academy-guide-main, .avd-academy-doc-main");
    // Karte, die das Inhaltsverzeichnis trägt (Guide- oder Doc-Layout).
    var tocCard = toc && toc.closest(".avd-academy-guide-side, [data-avd-academy-toc-box]");

    if (toc && main) {
      // Nur Überschriften auf oberster Ebene (nicht in Karten/Zitaten verschachtelte).
      var heads = main.querySelectorAll(":scope > h2, :scope > h3");
      // Inhaltsverzeichnis erst ab mindestens ZWEI Überschriften anzeigen.
      if (heads.length >= 2) {
        heads.forEach(function (h) {
          if (!h.id) {
            h.id = (h.textContent || "").toLowerCase().trim()
              .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
          }
          var a = document.createElement("a");
          a.href = "#" + h.id;
          a.textContent = h.textContent;
          if (h.tagName === "H3") a.className = "avd-academy-toc--h3";
          toc.appendChild(a);
        });
        if (tocCard) {
          tocCard.hidden = false;
          /* ZUGEKLAPPT STARTEN, wenn das Verzeichnis lang ist – aber nur, wenn darunter
             ueberhaupt noch eine Karte sichtbar ist (Fortschritt, weiterfuehrende Links).
             Ist das Verzeichnis das letzte Element der Sidebar, verdeckt es nichts; dann
             es zuzuklappen wuerde dem Leser nur einen Klick abverlangen, ohne dass er
             etwas gewinnt. Die Fortschrittskarte blendet sich in initGuideProgress()
             selbst ein – die laeuft vorher, ihr [hidden] ist hier also endgueltig.
             Hat die Seite den Zustand selbst gesetzt, gilt sie und beides bleibt aussen vor. */
          /* SCHMAL IMMER ZUGEKLAPPT - und zwar vor allem anderen. Das Verzeichnis
             steht dort ueber dem Text; offen schoebe es den Anfang der Seite unter
             den Bildschirmrand. Die Angaben aus `_config.yml` und Front Matter
             beschreiben eine SEITENSPALTE; auf einem Telefon gibt es keine. */
          var schmal = window.matchMedia && window.matchMedia("(max-width: 960px)").matches;
          var vorgabe = tocCard.getAttribute("data-avd-academy-toc-open");
          if (schmal) {
            tocCard.open = false;
          } else if (vorgabe !== null) {
            tocCard.open = vorgabe !== "false";
          } else {
            var darunter = false;
            for (var g = tocCard.nextElementSibling; g; g = g.nextElementSibling) {
              if (!g.hidden) { darunter = true; break; }
            }
            var grenze = parseInt(tocCard.getAttribute("data-avd-academy-toc-grenze"), 10);
            if (darunter && !isNaN(grenze) && grenze > 0 && heads.length > grenze) tocCard.open = false;
          }
        }
        if ("IntersectionObserver" in window) {
          var links = toc.querySelectorAll("a");
          var byId = {};
          links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
          var obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              var a = byId[en.target.id];
              if (a && en.isIntersecting) {
                links.forEach(function (x) { x.removeAttribute("aria-current"); });
                a.setAttribute("aria-current", "true");
              }
            });
          }, { rootMargin: "0px 0px -75% 0px" });
          heads.forEach(function (h) { obs.observe(h); });
        }
      } else if (tocCard) {
        tocCard.hidden = true;
      }
    }

    // Doc-Layout: rechte Sidebar nur zeigen, wenn sie sichtbaren Inhalt hat
    // (Inhaltsverzeichnis mit >= 2 Einträgen und/oder „Weiterführende
    // Informationen“). Sonst einspaltig.
    var docLayout = document.querySelector(".avd-academy-doc-layout");
    if (docLayout) {
      var sidebar = docLayout.querySelector(".avd-academy-doc-sidebar");
      if (sidebar) {
        if (sidebar.querySelector(":scope > :not([hidden])")) {
          docLayout.classList.add("avd-academy-doc-layout--with-sidebar");
        } else {
          sidebar.hidden = true;
        }
      }
    }
  }

  /* --- Fortschritt aus Task-Listen-Checkboxen -----------------------------
     Funktioniert im Guide- wie im Doc-Layout (Definition of Done bzw.
     Voraussetzungen). Läuft VOR der Doc-Sidebar-Sichtbarkeitsprüfung in
     initGuideToc(), damit die (per [hidden]) versteckte Fortschrittskarte dort
     korrekt als „leer“ zählt. */
  /* --- Aufgabenlisten: anklickbar und benannt ----------------------------- */
  /* EIGENE FUNKTION, NICHT TEIL DES FORTSCHRITTS: Aufgabenlisten stehen auch auf
     Seiten ohne Fortschrittskarte (Doku, Uebersichten, Trainer-Checklisten).

     ZWEI DINGE, WEIL SIE DIESELBE URSACHE HABEN. Kramdown gibt ein
     `- [ ] …` als `<input type="checkbox" disabled>` aus, und es blieb auch
     genau so stehen: Eine Checkliste, die man nicht abhaken kann, ist ein Bild
     von einer Checkliste. Eingeschaltet wurde bisher nur, wo eine
     Fortschrittskarte danebenstand - also ausgerechnet nicht auf der Seite, die
     nichts als eine Liste ist. Und ohne Namen sagt eine Vorlesehilfe
     fuenfzehnmal „Kontrollkaestchen“ und sonst nichts; der Name kommt aus dem
     Listeneintrag, in dem das Kaestchen steht.

     Der Zustand wird NICHT gespeichert. Ein Haken gilt fuer diesen Durchgang -
     eine Liste, die beim naechsten Kurs noch die Haken des letzten traegt, waere
     schlimmer als eine leere. */
  function initAufgabenlisten() {
    document.querySelectorAll('li > input[type="checkbox"]').forEach(function (c, i) {
      c.disabled = false;
      if (c.getAttribute("aria-label") || (c.labels && c.labels.length)) return;
      var li = c.closest("li");
      var name = li ? li.textContent.replace(/\s+/g, " ").trim() : "";
      c.setAttribute("aria-label", name || (T.schritt + " " + (i + 1)));
    });
  }

  function initGuideProgress() {
    var box = document.querySelector("[data-avd-academy-progress]");
    var main = document.querySelector(".avd-academy-guide-main, .avd-academy-doc-main");
    if (!box || !main) return;
    var checks = main.querySelectorAll('input[type="checkbox"]');
    if (!checks.length) { box.hidden = true; return; }
    box.hidden = false;
    var fill = box.querySelector(".avd-academy-progress__fill");
    var text = box.querySelector(".avd-academy-progress__text");
    var bar = box.querySelector(".avd-academy-progress__bar");

    /* DER BALKEN IST EINE ANZEIGE, KEIN BILD. Ohne Rolle ist er fuer eine
       Vorlesehilfe ein leeres Kaestchen; mit `progressbar` und `aria-valuenow`
       sagt er den Stand an. Der Text daneben traegt `aria-live`, damit das
       Abhaken hoerbar wird - sonst passiert beim Klicken nichts Hoerbares. */
    if (bar) {
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
    }
    if (text) text.setAttribute("aria-live", "polite");

    function update() {
      var done = 0;
      checks.forEach(function (c) { if (c.checked) done++; });
      var pct = Math.round((done / checks.length) * 100);
      if (fill) fill.style.width = pct + "%";
      if (bar) bar.setAttribute("aria-valuenow", String(pct));
      if (text) text.textContent = done + " / " + checks.length + " " + T.erledigt;
      // Vollständig erledigt → grüner Haken (Balken/Text bleiben sichtbar).
      box.classList.toggle("is-complete", done === checks.length);
    }
    checks.forEach(function (c) {
      /* Eingeschaltet und benannt sind die Kaestchen schon - das erledigt
         `initAufgabenlisten()`, die vorher laeuft, auch auf Seiten ohne Karte.
         Hier kommt nur noch das Mitzaehlen dazu. */
      c.addEventListener("change", update);
    });
    update();
  }

  /* --- Header-Untermenü (Dropdown / im Burger aufklappbar) ----------------- */
  function closeAllMenus(except) {
    document.querySelectorAll(".avd-academy-header__submenu[data-open]").forEach(function (s) {
      if (s === except) return;
      /* EIN ELTERNMENUE BLEIBT OFFEN. Seit es drei Ebenen gibt, liegt das Menue
         der dritten IN dem der zweiten - wer beim Oeffnen stumpf alles schließt,
         zieht sich den Boden unter dem eigenen Menue weg. */
      if (except && s.contains(except)) return;
      s.removeAttribute("data-open");
      var t = s.parentNode.querySelector(".avd-academy-header__grouptoggle");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }
  function initNavDropdown() {
    var groups = document.querySelectorAll("[data-avd-academy-menu]");
    if (!groups.length) return;
    groups.forEach(function (group) {
      /* :scope - sonst griffe eine Gruppe der ersten Ebene nach dem Schalter
         einer verschachtelten und schoebe beide Ebenen mit einem Klick auf. */
      var toggle = group.querySelector(":scope > .avd-academy-header__grouptoggle");
      var submenu = group.querySelector(":scope > .avd-academy-header__submenu");
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
      var drin = e.target.closest && e.target.closest("[data-avd-academy-menu]");
      if (!drin) { closeAllMenus(); return; }
      document.querySelectorAll(".avd-academy-header__submenu[data-open]").forEach(function (s) {
        if (s.contains(e.target)) return;
        s.removeAttribute("data-open");
        var t = s.parentNode.querySelector(".avd-academy-header__grouptoggle");
        if (t) t.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllMenus();
    });
  }

  /* --- Bleibt der rechte Bereich leer? ------------------------------------ *
     Eine Visualisierung schaltet ihn AUS. Eine gewoehnliche Seite kann ihn nur
     ZUFAELLIG leer lassen - wenn die Seite zu wenige Ueberschriften fuer ein
     Verzeichnis hat, keine Checkboxen fuer den Fortschritt und keine
     weiterfuehrenden Links. Dann reserviert das Raster 300px fuer nichts, und die
     Seite haengt links statt mittig zu stehen.

     ERST JETZT ENTSCHEIDBAR: Das Inhaltsverzeichnis entsteht im Browser, und die
     Fortschrittskarte blendet sich selbst ein. Deshalb laeuft diese Pruefung
     NACH beiden - die Reihenfolge in `init()` ist Teil der Sache.

     Gepruefte Bedingung ist die SICHTBARKEIT, nicht die Existenz: Die Karten
     stehen als `[hidden]` im Markup und bleiben es, wenn sie nichts zu zeigen
     haben. */
  function initSidebarLeer() {
    var sidebar = document.querySelector(".avd-academy-guide-sidebar");
    if (!sidebar) return;
    var etwasDa = Array.prototype.some.call(sidebar.children, function (karte) {
      if (karte.hidden) return false;
      return karte.offsetParent !== null || karte.getClientRects().length > 0;
    });
    document.body.classList.toggle("avd-academy-guide--sidebar-empty", !etwasDa);
  }

  /* --- TopNav: Umbruch messen, Seite des Flyouts waehlen ------------------ *
     ZWEI DINGE, die CSS nicht kann.

     ERSTENS: Passt die Leiste in eine Zeile? Die Anzahl der Eintraege steht in
     Liquid (`nav.compact_after`), aber lange Beschriftungen und schmale Fenster
     kennt nur der Browser. Gemessen wird die NATUERLICHE Breite - also die, die
     die Leiste haette, wenn sie nicht umbrechen duerfte. Das geht nur, wenn man
     den Umbruch kurz abschaltet und wieder herstellt; sonst misst man den bereits
     umgebrochenen Zustand und bekaeme nie ein "passt nicht".

     Die Falle dabei: Sobald `--compact` gesetzt ist, liegt die Leiste als Klappfeld
     und waere immer "schmal genug" - das Ergebnis schwankte bei jeder Messung.
     Deshalb wird fuer die Messung auch `--compact` kurz abgenommen.

     ZWEITENS: Faehrt das Menue der dritten Ebene nach rechts oder nach links aus?
     Das entscheidet der Platz bis zum Fensterrand, und den kennt erst der Browser. */
  function initNavLayout() {
    var header = document.querySelector("[data-avd-academy-header]");
    if (!header) return;
    var nav = header.querySelector(".avd-academy-header__nav");
    if (!nav) return;

    /* Aus Liquid gesetzt? Dann bleibt es dabei - die Anzahl ist eine Ansage des
       Autors, keine Messung, und sie soll nicht durch eine weggemessen werden. */
    var festGesetzt = header.classList.contains("avd-academy-header--compact");

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
    function passtInEineZeile() {
      var vorherCompact = header.classList.contains("avd-academy-header--compact");
      header.classList.remove("avd-academy-header--compact");
      var kinder = nav.children;
      var umbruch = false;
      if (kinder.length > 1) {
        var oben = kinder[0].offsetTop;
        for (var i = 1; i < kinder.length; i++) {
          if (kinder[i].offsetTop > oben + 2) { umbruch = true; break; }
        }
      }
      if (vorherCompact) header.classList.add("avd-academy-header--compact");
      return !umbruch;
    }

    function nachmessen() {
      if (festGesetzt) return;
      /* Unter der Media-Query-Schwelle misst niemand: Dort gilt ohnehin der
         Burger, und die Leiste ist ausgeblendet - jede Messung waere Unsinn. */
      if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
        header.classList.remove("avd-academy-header--compact");
        return;
      }
      header.classList.toggle("avd-academy-header--compact", !passtInEineZeile());
      /* DAS KLAPPFELD GEHOERT UNTER DEN KNOPF. Wo der steht, weiß nur das
         Layout - CSS kann die Stelle nicht ausrechnen. Deshalb kommt sie als
         Custom Property herein; das Stylesheet setzt sie ein. */
      var burger = header.querySelector(".avd-academy-header__burger");
      if (burger) header.style.setProperty("--avd-academy-nav-left", burger.offsetLeft + "px");
    }

    nachmessen();

    /* NOCH EINMAL, WENN DIE SCHRIFT DA IST. Beim ersten Messen steht oft noch die
       Ersatzschrift; die Beschriftungen sind dann schmaler, die Leiste passt
       scheinbar in eine Zeile, und gleich darauf laedt Outfit nach und sie bricht
       um - ohne dass ein `resize` faellt. Gemessen: Bei 940 px blieb die Leiste
       dreizeilig und der Burger aus. */
    if (document.fonts && document.fonts.ready) {
      /* EIN BILD SPAETER. `fonts.ready` sagt "geladen", nicht "neu umbrochen" -
         der Reflow mit der echten Schrift kommt erst danach. Direkt gemessen
         blieb die Leiste bei 940 px dreizeilig und der Burger aus (gemessen). */
      document.fonts.ready.then(function () { window.requestAnimationFrame(nachmessen); });
    }

    var wartet = false;
    window.addEventListener("resize", function () {
      if (wartet) return;
      wartet = true;
      window.requestAnimationFrame(function () { wartet = false; nachmessen(); });
    });

    /* Seite des seitlichen Menues. Beim Oeffnen und beim Ueberfahren pruefen, ob
       rechts noch Platz ist; sonst nach links. */
    /* WELCHE SEITE. Nicht "rechts, ausser es passt nicht" - sondern die Seite mit
       mehr Platz, falls rechts nicht reicht. Der Unterschied zeigt sich erst im
       Grenzfall: Ein Menue, das rechts um zehn Pixel ueberlaeuft, lief nach dem
       blossen Umkippen links um zweihundert ueber (gemessen). */
    function seiteWaehlen(menu, gruppe) {
      menu.classList.remove("avd-academy-header__submenu--flip");
      var noetig = menu.offsetWidth;
      var g = gruppe.getBoundingClientRect();
      var platzRechts = window.innerWidth - g.right - 8;
      var platzLinks = g.left - 8;
      if (noetig > platzRechts && platzLinks > platzRechts) {
        menu.classList.add("avd-academy-header__submenu--flip");
      }
    }
    /* Und beim Betreten eines gewoehnlichen Eintrags derselben Ebene: Wer von
       „Referenz" auf „Ueberblick" faehrt, will das Untermenue nicht weiter sehen. */
    header.querySelectorAll(".avd-academy-header__submenu > a").forEach(function (a) {
      a.addEventListener("mouseenter", function () {
        if (header.classList.contains("avd-academy-header--compact")) return;
        if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) return;
        document.querySelectorAll(".avd-academy-header__submenu--side[data-open]").forEach(function (offen) {
          if (offen.contains(a)) return;
          offen.removeAttribute("data-open");
          var t = offen.parentNode.querySelector(":scope > .avd-academy-header__grouptoggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
      });
    });

    header.querySelectorAll(".avd-academy-header__group--sub").forEach(function (g) {
      var menu = g.querySelector(".avd-academy-header__submenu--side");
      if (!menu) return;
      /* EIN ANDERES MENUE UEBERNIMMT. Am Schreibtisch oeffnet der Hover per CSS,
         ein Klick setzt zusaetzlich `data-open` - und das bliebe stehen, waehrend
         nebenan schon das naechste aufgeht. Beim Betreten einer Gruppe schließt
         deshalb alles, was weder sie selbst noch ein Vorfahr von ihr ist. */
      function uebernehmen() {
        /* NUR AM SCHREIBTISCH. Im Burger oeffnet und schließt allein der Klick -
           dort ist die Maus kein Zeigegeraet ueber einem Streifen, sondern faehrt
           beim Scrollen ueber alles hinweg. Gemeldet: Ein Klick auf „Grundlagen"
           oeffnete, das blosse Ueberfahren von „Referenz" schloss es wieder. */
        if (header.classList.contains("avd-academy-header--compact")) return;
        if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) return;
        seiteWaehlen(menu, g);
        document.querySelectorAll(".avd-academy-header__submenu[data-open]").forEach(function (offen) {
          if (offen === menu || offen.contains(g)) return;
          offen.removeAttribute("data-open");
          var t = offen.parentNode.querySelector(":scope > .avd-academy-header__grouptoggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
      }
      g.addEventListener("mouseenter", uebernehmen);
      g.addEventListener("focusin", uebernehmen);
    });
  }

  /* --- Drucken-Button -----------------------------------------------------
     Löst den Druckdialog aus. Genutzt im Hero der Visualisierungs-Ansicht: Sie
     hat keine Kopfzeile und keine Sidebar, in der ein Weg zum Ausdruck stecken
     könnte. Ohne JavaScript bleibt der Knopf wirkungslos – wie die
     Kopier-Buttons, deren Funktion ebenfalls am Skript hängt. */
  function initPrintButtons() {
    document.querySelectorAll("[data-avd-academy-print]").forEach(function (btn) {
      btn.addEventListener("click", function () { window.print(); });
    });
  }

  /* --- QR-Code der Seiten-URL ---------------------------------------------
     Neben dem Drucken- bzw. Kopieren-Button steht ein QR-Code auf die Adresse
     der aktuellen Seite: „Diese Seite auf Deinem Smartphone öffnen“ – vom
     Beamer oder vom gedruckten Blatt in die eigene Hand, ohne Abtippen.

     Warum clientseitig: Die Adresse kennt erst der Browser. Zur Build-Zeit
     fehlen Host und `baseurl` (dieselbe Unterlage läuft unter github.io, im
     lokalen Jekyll-Server und in einem Fork), und das Fragment (#/3 der
     Präsentation) ändert sich sogar ohne Seitenwechsel.

     Das Layout stellt nur einen leeren, [hidden] gesetzten Platzhalter
     `<button class="avd-academy-qr" data-avd-academy-qr>` bereit. Der Code
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
       components.css aus den ATVANTAGE-Tokens (--avd-white/--avd-ink). Sie
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

  function closeQrZoom() {
    document.querySelectorAll(".avd-academy-qr").forEach(function (host) {
      host.classList.remove("is-zoom");
      if (host.hasAttribute("aria-pressed")) host.setAttribute("aria-pressed", "false");
      /* Auch den Fokus abgeben: Solange die Schaltfläche ihn hat, hält ihn
         `:focus-visible` vergrößert – Zuklappen sähe wirkungslos aus. Betrifft
         die Tastaturbedienung; wer klickt oder tippt, hat keinen sichtbaren
         Fokus und merkt davon nichts. */
      if (document.activeElement === host) host.blur();
    });
  }

  function initPageQr() {
    var hosts = document.querySelectorAll("[data-avd-academy-qr]");
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

      function render() {
        if (location.href === shown) return;
        shown = location.href;
        hosts.forEach(function (host) {
          var box = document.createElement("span");
          box.className = "avd-academy-qr__box";
          box.appendChild(buildQrSvg(factory, shown));
          host.replaceChildren(box);
          host.hidden = false;
        });
      }

      render();

      /* Die Adresse kann sich ohne Seitenwechsel ändern: Die Präsentation führt
         die aktuelle Folie im Fragment (#/3). Ohne Neuberechnung zeigte der Code
         auf eine Folie, die längst weitergeblättert ist.

         Zwei Ereignisse, weil eines nicht genügt: `hashchange` deckt Sprungmarken
         und Vor/Zurück ab; die Präsentation setzt das Fragment aber per
         `history.replaceState`, und das löst kein `hashchange` aus – dafür sendet
         presentation.js `avd-academy-urlchange`. */
      window.addEventListener("hashchange", render);
      window.addEventListener("avd-academy-urlchange", render);

      /* Vergrößern: Auf Zeigergeräten genügt CSS (:hover/:focus-visible). Touch
         kennt kein Überfahren – dort öffnet ein Tipp den Code, ein Tipp daneben
         oder Escape schließt ihn wieder. */
      hosts.forEach(function (host) {
        /* GEDRUECKT ODER NICHT - das ist hier der Zustand, und eine Vorlesehilfe
           erfaehrt ihn nur ueber `aria-pressed`. Ohne das Attribut ist der Knopf
           eine Schaltflaeche, die scheinbar nichts tut: Das Vergroessern ist rein
           optisch, und der angesagte Text bleibt in beiden Zustaenden derselbe. */
        host.setAttribute("aria-pressed", "false");
        host.addEventListener("click", function () {
          var auf = host.classList.toggle("is-zoom");
          host.setAttribute("aria-pressed", auf ? "true" : "false");
        });
      });
      /* Klick daneben schließt. Bewusst OHNE `stopPropagation` am Knopf selbst:
         Das Ereignis soll weiterlaufen, damit die übrigen Zuhörer am Dokument
         (offenes Menü/Nav schließen) auch dann greifen, wenn der QR-Code
         angetippt wird. */
      document.addEventListener("click", function (e) {
        if (e.target.closest(".avd-academy-qr")) return;
        closeQrZoom();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeQrZoom();
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
    var knoepfe = document.querySelectorAll("[data-avd-academy-back]");
    if (!knoepfe.length) return;
    var gibtVerlauf = window.history.length > 1;
    Array.prototype.forEach.call(knoepfe, function (knopf) {
      if (!gibtVerlauf) return;
      knopf.removeAttribute("hidden");
      knopf.addEventListener("click", function () { window.history.back(); });
    });
  }

  /* --- Aufdeckbarer Inhalt (`avd-academy-reveal`) --------------------------
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
    document.querySelectorAll("details.avd-academy-reveal").forEach(function (details) {
      if (inVorfuehrung(details)) { return; }
      var summary = details.querySelector(":scope > summary");
      if (!summary) return;

      var body = details.querySelector(":scope > .avd-academy-reveal__body");
      if (!body) {
        body = document.createElement("div");
        body.className = "avd-academy-reveal__body";
        // Alles außer dem summary in den Rahmen umhängen (Reihenfolge bleibt).
        var kinder = [];
        details.childNodes.forEach(function (n) { if (n !== summary) kinder.push(n); });
        kinder.forEach(function (n) { body.appendChild(n); });
        details.appendChild(body);
      }

      if (!body.querySelector(".avd-academy-reveal__title")) {
        var titel = document.createElement("p");
        titel.className = "avd-academy-reveal__title";
        titel.textContent = summary.textContent.trim();
        body.insertBefore(titel, body.firstChild);
      }

      if (!body.querySelector(".avd-academy-reveal__close")) {
        var knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "avd-academy-reveal__close";
        knopf.setAttribute("aria-label", T.schließen);
        knopf.innerHTML = "&times;";
        knopf.addEventListener("click", function () { details.open = false; });
        body.appendChild(knopf);
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
      var offen = document.querySelectorAll("details.avd-academy-reveal[open]");
      if (!offen.length) return;
      offen[offen.length - 1].open = false;
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
    var fuerDruckGeoeffnet = [];
    /* EXKLUSIVITAET VORUEBERGEHEND AUFHEBEN. Ein `<details name="…">` schließt
       beim Oeffnen seine Geschwister - das ist am Bildschirm der Zweck und beim
       Drucken der Fehler: Die Schleife unten oeffnet reihum und liesse am Ende
       GENAU EINEN Reiter offen, der Rest waere auf dem Papier verschwunden.
       Der Name wird deshalb kurz entfernt und danach zurueckgesetzt. */
    var namenGemerkt = [];
    function nameAus() {
      namenGemerkt = [];
      document.querySelectorAll(
        "details.avd-academy-tabs__panel[name], details.avd-academy-walkthrough__line[name]"
      ).forEach(function (d) {
        namenGemerkt.push([d, d.getAttribute("name")]);
        d.removeAttribute("name");
      });
    }
    function nameAn() {
      namenGemerkt.forEach(function (e) { e[0].setAttribute("name", e[1]); });
      namenGemerkt = [];
    }
    function vorDemDruck() {
      nameAus();
      fuerDruckGeoeffnet = [];
      document.querySelectorAll(
        "details.avd-academy-reveal, details.avd-academy-tabs__panel, " +
        "details.avd-academy-walkthrough__line"
      ).forEach(function (d) {
        if (d.classList.contains("avd-academy-reveal--screen-only")) return;
        if (d.open) return;
        d.open = true;
        fuerDruckGeoeffnet.push(d);
      });
    }
    function nachDemDruck() {
      fuerDruckGeoeffnet.forEach(function (d) { d.open = false; });
      fuerDruckGeoeffnet = [];
      /* Erst schließen, dann die Namen zurueck: Andersherum schloesse der
         Browser beim Setzen des Namens selbst Geschwister und der Zustand von
         vor dem Druck waere nicht wiederhergestellt, sondern geraten. */
      nameAn();
    }
    window.addEventListener("beforeprint", vorDemDruck);
    window.addEventListener("afterprint", nachDemDruck);
    /* Älteres Safari kennt beforeprint/afterprint nicht, wohl aber den
       Medienwechsel. */
    if (window.matchMedia) {
      var mq = window.matchMedia("print");
      var beiWechsel = function (e) { if (e.matches) { vorDemDruck(); } else { nachDemDruck(); } };
      if (mq.addEventListener) { mq.addEventListener("change", beiWechsel); }
      else if (mq.addListener) { mq.addListener(beiWechsel); }
    }
  }

  /* --- Vorfuehrungen gehoeren dem Demo-Skript ----------------------------- */
  /* EINE BUEHNE IST EINE VORSCHAU, KEIN BAUSTEIN. `demo.js` nimmt ihr Markup und
     baut es in einem eigenen Rahmen noch einmal auf - mit demselben Theme und
     demselben Skript. Wer hier vorher zugreift, uebergibt eine bereits
     umgebaute Fassung: Der Rahmen setzte dann einen Knopf in den Knopf und eine
     Klappzeile in die Klappzeile. Gemessen: zehn Koepfe, wo fuenf hingehoeren.

     Deshalb laesst dieses Skript alles in Ruhe, was unter
     `[data-avd-academy-demo]` steht. Ohne `demo.js` bleibt die Buehne damit das
     rohe Markup - und genau das ist sie dann auch. */
  function inVorfuehrung(el) {
    return !!(el.closest && el.closest("[data-avd-academy-demo]"));
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
  function initTabs() {
    document.querySelectorAll(".avd-academy-tabs").forEach(function (box, nr) {
      if (inVorfuehrung(box)) { return; }
      var panels = Array.prototype.slice.call(
        box.querySelectorAll(":scope > details.avd-academy-tabs__panel")
      );
      if (panels.length < 2) return;   /* ein einzelner Reiter ist keiner */

      /* Senkrecht oder waagerecht? Entscheidet allein die Klasse im Markup.
         Das Skript muss es wissen, weil Hilfstechnik und Pfeiltasten sich
         danach richten - die Anordnung selbst macht das Stylesheet. */
      var seitlich = box.classList.contains("avd-academy-tabs--side");

      var leiste = document.createElement("div");
      leiste.className = "avd-academy-tabs__bar";
      leiste.setAttribute("role", "tablist");
      leiste.setAttribute("aria-orientation", seitlich ? "vertical" : "horizontal");

      /* DIE ADRESSE FUEHRT DEN ZUSTAND MIT, damit sie sich als Lesezeichen eignet.
         `replaceState` und nicht `location.hash`: Letzteres SPRINGT zum Ziel - der
         Browser scrollte also bei jedem Reiterwechsel - und legt je Klick einen
         Verlaufseintrag an. Wer fuenfmal umschaltet, muesste fuenfmal zurueck, um
         die Seite zu verlassen.
         Die Tastatur ruft dieselbe Funktion: Ein per Pfeiltaste gewaehlter Reiter
         ist genauso gewaehlt wie ein angeklickter. */
      function adresseFuehren(panel) {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", "#" + panel.id);
        }
      }

      var knoepfe = panels.map(function (panel, i) {
        var summary = panel.querySelector(":scope > summary");
        if (!summary) return null;

        /* EINE LESBARE ID JE PANEL. Sie landet in der Adresse, sobald jemand
           einen Reiter waehlt - `#tag-1` ist ein brauchbares Lesezeichen,
           `#avd-tabs-0-3` nicht. Eine vorhandene ID bleibt unangetastet: Sie
           steht womoeglich schon in einem Link.

           Kollidiert der Name mit etwas anderem auf der Seite (eine Ueberschrift
           heißt leicht genauso), gewinnt das Vorhandene und der Reiter bekommt
           den technischen Namen - zwei gleiche IDs waeren schlimmer als eine
           haessliche. */
        if (!panel.id) {
          var wunsch = summary.textContent.toLowerCase()
            .replace(/\u00e4/g, "ae").replace(/\u00f6/g, "oe")
            .replace(/\u00fc/g, "ue").replace(/\u00df/g, "ss")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          panel.id = (wunsch && !document.getElementById(wunsch))
            ? wunsch : ("avd-tabs-" + nr + "-" + i);
        }

        var knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "avd-academy-tabs__tab";
        knopf.setAttribute("role", "tab");
        knopf.setAttribute("aria-controls", panel.id);
        knopf.innerHTML = summary.innerHTML;
        knopf.addEventListener("click", function () {
          panel.open = true;
          adresseFuehren(panel);
        });
        leiste.appendChild(knopf);
        return knopf;
      });
      if (knoepfe.indexOf(null) !== -1) return;  /* ein Panel ohne summary: Finger weg */

      /* Den ausgewaehlten Reiter markieren. `toggle` feuert auch, wenn der
         Browser wegen `name` ein anderes Panel SCHLIESST - eine Funktion fuer
         beide Richtungen. */
      function nachfuehren() {
        panels.forEach(function (panel, i) {
          var offen = panel.open;
          knoepfe[i].setAttribute("aria-selected", offen ? "true" : "false");
          knoepfe[i].tabIndex = offen ? 0 : -1;
        });
      }
      panels.forEach(function (panel) {
        panel.addEventListener("toggle", nachfuehren);
      });

      /* Pfeiltasten in der Leiste - ohne sie ist ein Reiterstreifen mit der
         Tastatur nur ueber Tab-Sprünge erreichbar, und `tabIndex = -1` an den
         nicht gewaehlten macht ihn dann ganz unerreichbar. */
      leiste.addEventListener("keydown", function (event) {
        var i = knoepfe.indexOf(document.activeElement);
        if (i === -1) return;
        /* Die Pfeile folgen der Anordnung: senkrecht hoch/runter, waagerecht
           links/rechts. Eine Leiste, die untereinander steht und auf
           `ArrowDown` nicht reagiert, fuehlt sich kaputt an - so steht die
           Erwartung auch in den ARIA Authoring Practices. */
        var vor = seitlich ? "ArrowDown" : "ArrowRight";
        var zurueck = seitlich ? "ArrowUp" : "ArrowLeft";
        var ziel = null;
        if (event.key === vor) { ziel = (i + 1) % knoepfe.length; }
        else if (event.key === zurueck) { ziel = (i - 1 + knoepfe.length) % knoepfe.length; }
        else if (event.key === "Home") { ziel = 0; }
        else if (event.key === "End") { ziel = knoepfe.length - 1; }
        if (ziel === null) return;
        event.preventDefault();
        panels[ziel].open = true;
        adresseFuehren(panels[ziel]);
        knoepfe[ziel].focus();
      });

      box.insertBefore(leiste, box.firstChild);
      box.classList.add("avd-academy-tabs--enhanced");

      /* Keines offen? Dann das erste - sonst stuende die Leiste ueber einer
         leeren Flaeche. Im Akkordeon waere das in Ordnung, als Reiterstreifen
         sieht es kaputt aus. */
      if (!panels.some(function (p) { return p.open; })) { panels[0].open = true; }
      nachfuehren();
    });

    /* TIEFE VERWEISE: `#…` auf ein Panel oder auf etwas DARIN muss den
       zugehoerigen Reiter oeffnen - sonst springt der Browser an eine Stelle,
       die gerade zu ist, und die Seite ruehrt sich nicht. */
    function ausHash() {
      var id = location.hash.slice(1);
      if (!id) return;
      var ziel = document.getElementById(id);
      if (!ziel) return;
      var panel = ziel.closest(".avd-academy-tabs__panel");
      if (!panel) return;
      panel.open = true;
      ziel.scrollIntoView();
    }
    window.addEventListener("hashchange", ausHash);
    ausHash();
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
    var kaesten = Array.prototype.slice.call(
      document.querySelectorAll(".avd-academy-accordion")
    ).filter(function (box) { return !inVorfuehrung(box); });

    kaesten.forEach(function (box, nr) {
      var kinder = Array.prototype.slice.call(box.children);

      /* DIE FLACHSTE UEBERSCHRIFT UNTER DEN DIREKTEN KINDERN macht die Bereiche.
         Damit entscheidet der Autor die Ebene, indem er sie schreibt (`###` in
         einem `##`-Kapitel), und ein verschachteltes Akkordeon in einem Bereich
         zaehlt nicht mit - es ist kein direktes Kind mehr. */
      var ebene = 0;
      kinder.forEach(function (el) {
        var treffer = /^H([1-6])$/.exec(el.tagName);
        if (!treffer) return;
        var n = Number(treffer[1]);
        if (!ebene || n < ebene) { ebene = n; }
      });
      if (!ebene) return;
      var marke = "H" + ebene;

      /* Was VOR der ersten Ueberschrift steht, bleibt stehen: eine Einleitung
         gehoert in keinen Bereich - sie sagt ja gerade, wozu die Liste da ist. */
      var abschnitte = [];
      var offen = null;
      kinder.forEach(function (el) {
        if (el.tagName === marke) {
          offen = { kopf: el, inhalt: [] };
          abschnitte.push(offen);
        } else if (offen) {
          offen.inhalt.push(el);
        }
      });
      /* Ein einzelner Bereich ist kein Akkordeon - dafuer gibt es
         `avd-academy-fold`. Ohne diese Bremse baute das Skript eine Bedienung,
         die nichts zu waehlen hat. */
      if (abschnitte.length < 2) return;

      abschnitte.forEach(function (a, i) {
        var kopf = a.kopf;

        /* EINE LESBARE ID JE ABSCHNITT - sie ist der Anker, unter dem sich ein
           einzelner Bereich verlinken laesst. Eine vorhandene bleibt
           unangetastet: Sie steht womoeglich schon in einem Verweis. Kramdown
           vergibt sie ohnehin aus der Ueberschrift; der Zweig darunter greift
           nur, wenn eine Seite die automatischen IDs abgeschaltet hat. */
        if (!kopf.id) {
          var wunsch = (kopf.textContent || "").toLowerCase()
            .replace(/ä/g, "ae").replace(/ö/g, "oe")
            .replace(/ü/g, "ue").replace(/ß/g, "ss")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          kopf.id = (wunsch && !document.getElementById(wunsch))
            ? wunsch : ("avd-accordion-" + nr + "-" + i);
        }

        /* ZWEI ELEMENTE, WEIL EINES NICHT REICHT: Der Bereich traegt die
           Gitterzeile (und damit die Bewegung), der Koerper darin `overflow`
           und den Innenabstand. Stuende beides auf einem Element, schnitte der
           Innenabstand die Zeile nie auf null - genau der Fehler, der im Burger
           zwoelf Pixel stehen liess. */
        var bereich = document.createElement("div");
        bereich.className = "avd-academy-accordion__region";
        bereich.id = kopf.id + "-region";
        bereich.setAttribute("role", "region");
        bereich.setAttribute("aria-labelledby", kopf.id);

        var koerper = document.createElement("div");
        koerper.className = "avd-academy-accordion__body";
        a.inhalt.forEach(function (el) { koerper.appendChild(el); });
        bereich.appendChild(koerper);
        kopf.insertAdjacentElement("afterend", bereich);

        /* DIE UEBERSCHRIFT BLEIBT EINE UEBERSCHRIFT, der Knopf steht DARIN.
           So steht es in den ARIA Authoring Practices, und es ist der einzige
           Weg, der die Gliederung nicht opfert: Wer die Ueberschrift durch einen
           Knopf ersetzt, nimmt einer Vorlesehilfe die Sprungmarken der Seite. */
        var knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "avd-academy-accordion__toggle";
        knopf.setAttribute("aria-expanded", "false");
        knopf.setAttribute("aria-controls", bereich.id);
        while (kopf.firstChild) { knopf.appendChild(kopf.firstChild); }
        kopf.appendChild(knopf);

        a.bereich = bereich;
        a.knopf = knopf;
      });

      /* Sichtbar halten, was gerade gewaehlt wurde. Der zweite Blick nach der
         Bewegung ist kein Aberglaube: Waehrend der 220 ms schrumpft der
         Nachbar, der vorher offen war - was jetzt im Bild steht, liegt danach
         womoeglich darueber. `nearest` ruehrt sich nicht, wenn nichts noetig
         ist, also kostet der zweite Aufruf im Regelfall gar nichts. */
      function sichtbarHalten(el) {
        el.scrollIntoView({ block: "nearest" });
        window.setTimeout(function () { el.scrollIntoView({ block: "nearest" }); }, 260);
      }

      /* EXKLUSIV: Ein Akkordeon zeigt einen Bereich. Das ist der Zweck - eine
         lange Liste soll nicht doch wieder in ganzer Laenge dastehen. */
      function waehlen(ziel, auf, mitBewegung) {
        abschnitte.forEach(function (a) {
          var jetzt = (a === ziel) ? auf : false;
          a.knopf.setAttribute("aria-expanded", jetzt ? "true" : "false");
          a.bereich.classList.toggle("is-open", jetzt);
        });
        if (auf && mitBewegung) { sichtbarHalten(ziel.knopf); }
      }

      abschnitte.forEach(function (a) {
        a.knopf.addEventListener("click", function () {
          var war = a.knopf.getAttribute("aria-expanded") === "true";
          waehlen(a, !war, true);
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
        abschnitte.forEach(function (a, j) {
          if (a.knopf === document.activeElement) { i = j; }
        });
        if (i === -1) { return; }
        var ziel = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          ziel = (i + 1) % abschnitte.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          ziel = (i - 1 + abschnitte.length) % abschnitte.length;
        } else if (event.key === "Home") { ziel = 0; }
        else if (event.key === "End") { ziel = abschnitte.length - 1; }
        if (ziel === null) { return; }
        event.preventDefault();
        abschnitte[ziel].knopf.focus();
        waehlen(abschnitte[ziel], true, true);
      });

      /* TIEFE VERWEISE: `#…` auf einen Kopf oder auf etwas DARIN muss den
         Bereich aufklappen - sonst springt der Browser an eine Stelle, die
         gerade zu ist, und die Seite ruehrt sich nicht. Dieselbe Ueberlegung
         wie bei den Reitern, nur dass hier jeder Kasten seinen eigenen Zustand
         fuehrt und die Pruefung deshalb hier drin steht. */
      function ausHash() {
        var id = location.hash.slice(1);
        if (!id) { return; }
        var ziel = document.getElementById(id);
        if (!ziel) { return; }
        var treffer = null;
        abschnitte.forEach(function (a) {
          if (a.kopf === ziel || a.bereich.contains(ziel)) { treffer = a; }
        });
        if (!treffer) { return; }
        waehlen(treffer, true, false);
        ziel.scrollIntoView();
      }
      window.addEventListener("hashchange", ausHash);

      box.classList.add("avd-academy-accordion--enhanced");
      ausHash();
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
  function initScrollbereiche() {
    var haupt = document.querySelector(".avd-academy-guide-main, .avd-academy-doc-main, main");
    if (!haupt) return;

    haupt.querySelectorAll("table").forEach(function (tab) {
      if (tab.parentNode.classList &&
          tab.parentNode.classList.contains("avd-academy-tablescroll")) return;
      var rahmen = document.createElement("div");
      rahmen.className = "avd-academy-tablescroll";
      tab.parentNode.insertBefore(rahmen, tab);
      rahmen.appendChild(tab);
    });

    /* GESUCHT IST, WAS TATSAECHLICH SCROLLT - nicht, was danach aussieht. Beim
       Code sind es je nach Auszeichnung mal das `pre`, mal das `code` darin
       (highlight.css setzt `overflow-x: auto` auf `pre code.hljs`); wer nur
       eines von beiden nimmt, laesst die Haelfte unerreichbar. */
    function pruefen(b) {
      var art = window.getComputedStyle(b).overflowX;
      var scrollt = (art === "auto" || art === "scroll") && b.scrollWidth > b.clientWidth + 1;
      if (scrollt) { b.setAttribute("tabindex", "0"); }
      else if (b.getAttribute("tabindex") === "0") { b.removeAttribute("tabindex"); }
    }
    var kandidaten = haupt.querySelectorAll(
      ".avd-academy-tablescroll, .avd-academy-walkthrough, pre, pre > code");

    /* EINMAL MESSEN GENUEGT NICHT. Ob ein Block ueberlaeuft, steht erst fest, wenn
       Schrift UND Inhalt endgueltig sind - und die Syntaxhervorhebung baut den
       Inhalt danach noch einmal um: Sie ersetzt den Text durch ausgezeichnete
       Spannen, und die sind breiter. Gemessen davor, fehlte dem Codeblock der
       Haltepunkt in der Tabulatorreihenfolge - und der Befund tauchte je nach
       Rechnertempo mal auf und mal nicht.
       `ResizeObserver` beendet das Raten: Er meldet JEDE Groessenaenderung - die
       Hervorhebung, den Schriftwechsel, das Fenster. Wo es ihn nicht gibt, bleibt
       es beim einmaligen Messen und einem Blick nach dem Schriftwechsel. */
    if (window.ResizeObserver) {
      var beobachter = new ResizeObserver(function (eintraege) {
        eintraege.forEach(function (e) { pruefen(e.target); });
      });
      Array.prototype.forEach.call(kandidaten, function (b) { beobachter.observe(b); pruefen(b); });
    } else {
      var nachmessen = function () { Array.prototype.forEach.call(kandidaten, pruefen); };
      nachmessen();
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(nachmessen); }
      var t = null;
      window.addEventListener("resize", function () {
        window.clearTimeout(t); t = window.setTimeout(nachmessen, 150);
      });
    }
  }

  function init() {
    initBackButtons();
    initThemeToggle();
    initCopyButtons();
    initNavToggle();
    initNavDropdown();
    initNavLayout();
    initCopyMarkdown();
    initPrintButtons();
    initTabs();
    initAccordion();
    initPageQr();
    initAufgabenlisten();
    initGuideProgress();
    initScrollbereiche();
    initGuideToc();
    /* NACH beiden - vorher steht nicht fest, ob der rechte Bereich etwas zeigt. */
    initSidebarLeer();
    initReveals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
