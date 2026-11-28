/* =============================================================================
   Suche – Volltextsuche in der Kopfzeile
   -----------------------------------------------------------------------------
   Sucht in der EIGENEN Site, in der Sprache der aktuellen Seite. Den Index
   schreibt der Bau nach /skriptorium/search/; geladen wird er erst, wenn jemand
   die Suche öffnet – nicht beim Seitenaufruf.

   Markup: Vorlage der Seitenwerkzeuge (`search`). Ohne JavaScript bleibt das Icon
   verborgen, ebenso über file://: Dort lädt der Browser den Index nicht.

   Zwei Darstellungen (`search.display`): `expand` klappt das Feld unter dem
   Icon auf, `dialog` öffnet es über der Seite. Auf schmalen Viewports ist es
   immer der Dialog – ein aufklappendes Feld hätte dort keinen Platz.

   Tastenkürzel (`search.shortcut`): `double_shift` (Vorgabe) – zweimal Shift,
   ohne andere Taste dazwischen, wie „Search Everywhere“ in IntelliJ; nicht,
   solange der Fokus in einem Eingabefeld liegt, sonst öffnete schnelles Tippen
   von Großbuchstaben die Suche. `ctrl_k` – Strg+K bzw. ⌘K, auch aus einem
   Eingabefeld. `slash` – die Taste /, nicht in einem Eingabefeld. `off` – keins.

   Bereiche einer Rolle (`role` im Manifest, aus `search.scopes: nav`) stehen nur
   zur Wahl, solange diese Rolle gewählt ist (`<html data-skr-role>`).

   Bereichskontext (nur bei `search.preselect: current`): Eine geteilte Seite,
   die mehrere Bereiche einbinden, gehört keinem davon allein. Welcher gilt,
   ergibt sich aus dem Weg dorthin, den `search-trail.js` je Tab notiert – bei
   Bereichen aus der Navigation der Bereich, aus dem man kommt. Ob
   vorausgewählt wird, steht im Manifest – abgeleitet an EINER Stelle, beim Bau
   des Index.

   Auswahlen (`search.filters` → `filters` im Manifest): `scope: false` blendet die
   Bereiche aus und sucht immer überall – eine Vorauswahl gilt dann nicht.
   `doclinks: false` blendet die Arten aus.

   Arten (`doclinks` im Manifest, `k` am Eintrag): Jeder Treffer nennt die Art seiner
   Seite – Symbol und Bezeichnung –, eine Seite ohne Art („Seite“, Kennung "") ohne
   Symbol, mit der Lücke dafür; immer, auch bei nur einer Art und bei
   `filters.doclinks: false`. Die Auswahl der Arten ist eine Mehrfachauswahl, zu Beginn
   alle; zur Wahl erst ab zwei Arten. Ohne Haken gibt es keine Treffer: Die Schaltfläche
   sagt dann „Keine Art“, der Status „Keine Art gewählt.“, „Alle auswählen“ stellt
   zurück. Die Liste schließt mit Escape und sobald der Fokus Schaltfläche und Liste
   verlässt (Disclosure).

   Gemerkt wird die Auswahl der Arten im localStorage, je Unterlage unter
   `skr-search-doclinks:«Pfad der Wurzel»` (wie die Tabs; Wurzel unbekannt: „/“), für
   alle Sprachen gemeinsam – die Kennungen sind Langnamen bzw. "" für „Seite“. Der
   Eintrag ist ein JSON-Array der ABGEWÄHLTEN Arten: Eine Art, die später hinzukommt, ist
   so angehakt. Eine Sprache setzt nur die Arten, die ihr Manifest kennt; die Abwahl
   von Arten, die nur eine andere Sprache hat, bleibt stehen. Nichts abgewählt – kein
   Eintrag; auch die leere Auswahl bleibt gemerkt.
   Unbekannte Kennungen und ungültiger Inhalt zählen nicht. Bei `filters.doclinks: false`
   wird nichts gelesen – eine unsichtbare Einschränkung darf nicht wirken.
   ============================================================================= */
(function () {
  "use strict";

  /* Beschriftungen, die erst im Browser entstehen. Die festen stehen in den
     Wörterbüchern (`texts/`) und kommen über das Markup. */
  var TEXT = {
    de: {
      loading: "Suche wird geladen …",
      failed: "Die Suche ist gerade nicht verfügbar.",
      short: "Bitte mindestens zwei Zeichen eingeben.",
      none: "Keine Treffer.",
      one: "1 Treffer",
      many: "{n} Treffer",
      more: "{n} Treffer, die ersten {k} werden angezeigt"
    },
    en: {
      loading: "Loading search …",
      failed: "Search is not available right now.",
      short: "Please enter at least two characters.",
      none: "No results.",
      one: "1 result",
      many: "{n} results",
      more: "{n} results, showing the first {k}"
    }
  };
  var MIN = 2;
  var MAX = 20;
  var NARROW = "(max-width: 600px)";
  /* Gewicht je Feld: Ein Treffer im Titel sagt mehr als einer im Fließtext. */
  /* Was ein Treffer wiegt, je nachdem WO er steht: `t` Titel, `g` Topics,
     `h`/`i`/`j` die Überschriften der Ebenen 1 bis 3, `d` Beschreibung, `b` Fließtext.

     JE EBENE EIN EIGENES GEWICHT. Lägen alle Überschriften zusammen, zählte eine
     h3 so viel wie eine h2 – die Gliederung sagt aber etwas darüber, wie zentral
     ein Begriff für die Seite ist. Über der Beschreibung steht deshalb nur die h1;
     die h3 bleibt darunter, aber deutlich über dem Fließtext.

     Die h1 ist meist ohnehin der Titel – der Rahmen rendert sie aus `title`. `h`
     trägt sie trotzdem: Eine Seite darf mehrere h1 haben, und wo `title` bewusst
     vom Text abweicht, stehen beide da.

     TOPICS ZWISCHEN h1 UND h2. Ein Topic ist ein ABSICHTLICH gesetztes Schlagwort –
     die Autorin sagt damit, worunter die Seite gefunden werden soll. Das wiegt mehr
     als eine Zwischenüberschrift. Über die h1 geht es trotzdem nicht: Topics sind
     kurz und oft allgemein („Qualität“, „Einstieg“), und ein Kapiteltitel sagt
     genauer, wovon die Seite wirklich handelt. */
  var WEIGHT = { t: 10, h: 6, g: 5, i: 4, d: 3, j: 2, b: 1 };
  /* Ein Wort, das zwanzigmal auf einer Seite steht, macht sie nicht zwanzigmal
     relevanter. */
  var BODY_CAP = 8;

  function lang() {
    var l = (document.documentElement.getAttribute("lang") || "de").split("-")[0].toLowerCase();
    return TEXT[l] ? l : "de";
  }

  function say(key, n, k) {
    return TEXT[lang()][key].replace("{n}", n).replace("{k}", k);
  }

  /* Normalform für den Vergleich. Umlaute werden ausgeschrieben, damit
     „Groesse“ „Größe“ findet; übrige Akzente fallen weg. */
  function fold(s, caseSensitive) {
    if (!caseSensitive) s = s.toLowerCase();
    return s
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
      .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function tokens(s, caseSensitive) {
    return fold(s || "", caseSensitive).split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  }

  /* DER WEG – je Tab notiert von `search-trail.js`, das in jedem Layout steht (auch
     ohne Suche). Hier wird er nur gelesen und beim Öffnen ausgewertet. */
  var Trail = (window.skr && window.skr._searchTrail) || {
    read: function () { return []; },
    contextOf: function () { return ""; },
    visibleIn: function () { return function () { return true; }; },
    indexPath: function (p) { return p; }
  };

  /* Die gewählte Rolle der Navigation – leer ohne Rollen. */
  function role() {
    return document.documentElement.getAttribute("data-skr-role") || "";
  }

  /* Steht ein Bereich zur Wahl? Einer ohne Rolle immer, einer einer Rolle nur in ihr. */
  function forRole(s) {
    return !s.role || s.role === role();
  }

  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function Search(root) {
    this.root = root;
    this.toggle = root.querySelector("[data-skr-search-toggle]");
    this.dialog = root.querySelector("dialog");
    this.input = root.querySelector("input[type=search]");
    this.scope = root.querySelector("select");
    this.kindField = root.querySelector(".skr-search__field--kind");
    this.kindButton = root.querySelector(".skr-search__kind");
    this.kindValue = root.querySelector(".skr-search__kind-value");
    this.kinds = root.querySelector(".skr-search__kinds");
    this.kindList = root.querySelector(".skr-search__kind-list");
    this.list = root.querySelector("[data-skr-search-results]");
    this.status = root.querySelector("[data-skr-search-status]");
    this.close = root.querySelector("[data-skr-search-close]");
    this.mode = root.getAttribute("data-mode") === "dialog" ? "dialog" : "expand";
    this.manifestUrl = root.getAttribute("data-index");
    /* Die Wurzel der Site, unter der sie gerade läuft – `data-base` zeigt relativ zur
       Seite auf sie; die Adressen im Index stehen ab dieser Wurzel. */
    this.base = new URL(root.getAttribute("data-base") || "/", location.href).pathname;
    this.allLabel = this.scope ? this.scope.options[0].textContent : "";
    this.manifest = null;
    this.files = {};
    this.index = {};
    this.timer = 0;
    this.bind();
  }

  Search.prototype.bind = function () {
    var self = this;
    this.toggle.addEventListener("click", function () {
      if (self.dialog.open) self.hide(); else self.show();
    });
    if (this.close) this.close.addEventListener("click", function () { self.hide(); });
    this.input.addEventListener("input", function () {
      clearTimeout(self.timer);
      self.timer = setTimeout(function () { self.run(); }, 80);
    });
    if (this.scope) this.scope.addEventListener("change", function () { self.run(); });
    if (this.kinds) {
      this.kindButton.addEventListener("click", function () { self.openKinds(self.kinds.hidden); });
      this.kindButton.addEventListener("pointerenter", function () { self.fitKindTitle(); });
      this.kindButton.addEventListener("focus", function () { self.fitKindTitle(); });
      this.kindList.addEventListener("change", function () { self.kindsChanged(); });
      /* „nur“ hakt nur seine Art an. Die Liste bleibt stehen – ein neu gebautes
         Element wäre beim Klick schon aus dem Dokument, und die Suche schlösse sich. */
      this.kindList.addEventListener("click", function (e) {
        var only = e.target.closest(".skr-search__kind-only");
        if (!only) return;
        self.kindBoxes().forEach(function (c) { c.checked = c.value === only.value; });
        self.kindsChanged();
      });
      this.kinds.querySelector(".skr-search__kind-all").addEventListener("click", function () {
        self.kindBoxes().forEach(function (c) { c.checked = true; });
        self.kindsChanged();
      });
      /* Verlässt der Fokus Schaltfläche und Liste – zu einem anderen Element –, klappt
         die Liste zu. Ein Klick auf eine Stelle ohne Fokus (relatedTarget leer) lässt sie
         offen: Ein Klick auf eine Beschriftung soll sie nicht schließen. */
      var leave = function (e) {
        var to = e.relatedTarget;
        if (to && to !== self.kindButton && !self.kinds.contains(to)) self.openKinds(false, true);
      };
      this.kindButton.addEventListener("focusout", leave);
      this.kinds.addEventListener("focusout", leave);
    }
    this.dialog.addEventListener("keydown", function (e) { self.keys(e); });
    /* Der native Dialog schließt modal von sich aus mit Escape; das Ereignis
       kommt hier an, damit der Fokus zurück aufs Icon geht. */
    this.dialog.addEventListener("cancel", function (e) { e.preventDefault(); self.hide(); });
    document.addEventListener("click", function (e) {
      if (self.dialog.open && !self.root.contains(e.target)) self.hide();
    });
    /* Ein Klick auf den Hintergrund eines modalen Dialogs trifft den Dialog selbst. */
    this.dialog.addEventListener("click", function (e) {
      if (e.target === self.dialog && self.dialog.matches(":modal")) self.hide();
    });
  };

  Search.prototype.show = function () {
    if (this.manifest && this.shownRole !== role()) this.fillScopes(this.manifest.scopes || []);
    /* Die gemerkte Auswahl der Arten – ein anderer Tab kann sie geändert haben. */
    if (this.manifest) { this.restoreKinds(); this.run(); }
    var modal = this.mode === "dialog" || window.matchMedia(NARROW).matches;
    this.root.setAttribute("data-open", modal ? "dialog" : "expand");
    if (modal) this.dialog.showModal(); else this.dialog.show();
    this.toggle.setAttribute("aria-expanded", "true");
    this.input.focus();
    this.input.select();
    this.load();
  };

  Search.prototype.hide = function () {
    if (!this.dialog.open) return;
    this.openKinds(false);
    this.dialog.close();
    this.root.removeAttribute("data-open");
    this.toggle.setAttribute("aria-expanded", "false");
    this.toggle.focus();
  };

  /* Pfeiltasten zwischen Feld und Treffern; Escape schließt. In der Liste der Arten
     wandern die Pfeiltasten zwischen den Kontrollkästchen, und Escape schließt erst
     die Liste – der Fokus geht auf ihre Schaltfläche. */
  Search.prototype.keys = function (e) {
    if (this.kinds && !this.kinds.hidden) {
      var inKinds = this.kinds.contains(document.activeElement);
      if (e.key === "Escape" && (inKinds || document.activeElement === this.kindButton)) {
        e.preventDefault();
        this.openKinds(false);
        this.kindButton.focus();
        return;
      }
      if (inKinds && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        var boxes = this.kindBoxes();
        /* Aus einer Zeile (Kontrollkästchen oder „nur“) zur nächsten bzw. vorigen; von
           „Alle auswählen“ unter der Liste hoch zur letzten Art, abwärts bleibt er. */
        var item = document.activeElement.closest(".skr-search__kind-item");
        var at = item ? boxes.indexOf(item.querySelector("input")) : boxes.length;
        var next = e.key === "ArrowDown" ? at + 1 : at - 1;
        if (next >= 0 && next < boxes.length) boxes[next].focus();
        return;
      }
      if (inKinds) return;
    }
    var links = Array.prototype.slice.call(this.list.querySelectorAll("a"));
    var i = links.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
    } else if (e.key === "ArrowDown" && links.length) {
      e.preventDefault();
      links[Math.min(i + 1, links.length - 1)].focus();
    } else if (e.key === "ArrowUp" && i >= 0) {
      e.preventDefault();
      if (i === 0) this.input.focus(); else links[i - 1].focus();
    } else if (e.key === "Enter" && document.activeElement === this.input && links.length) {
      e.preventDefault();
      links[0].click();
    }
  };

  Search.prototype.setStatus = function (text) {
    this.status.textContent = text;
  };

  Search.prototype.load = function () {
    var self = this;
    if (this.manifest) return Promise.resolve(this.manifest);
    if (this.loading) return this.loading;
    this.setStatus(say("loading"));
    this.loading = fetch(this.manifestUrl).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (m) {
      self.manifest = m;
      self.fillScopes(m.scopes || []);
      self.fillKinds();
      self.setStatus("");
      self.run();
      return m;
    }).catch(function () {
      self.loading = null;
      self.setStatus(say("failed"));
    });
    return this.loading;
  };

  /* Der Bereich der aktuellen Seite – für `search.preselect: current`. Je Adresse
     steht im Manifest eine Liste: vorn der eigene Bereich (leer, wenn keiner),
     danach die Bereiche, die die Seite einbinden. Welcher davon gilt, sagt der Weg –
     bei Bereichen aus der Navigation der, aus dem man kommt (`search-trail.js`). */
  Search.prototype.currentScope = function () {
    var pages = this.manifest && this.manifest.pages;
    if (!pages) return "";
    var trail = Trail.read();
    var here = Trail.indexPath(location.pathname);
    var last = trail[trail.length - 1];
    if (!last || last.p !== here) trail.push({ p: here });
    var known = (this.manifest.scopes || []).filter(forRole).map(function (s) { return s.id; });
    var ctx = Trail.contextOf(trail, pages, { source: this.manifest.source, visible: Trail.visibleIn(this.manifest) });
    return known.indexOf(ctx) >= 0 ? ctx : "";
  };

  /* „Alle“ steht schon im Markup; die Bereiche kommen aus dem Index, in der
     Reihenfolge, die der Build festgelegt hat. Vorausgewählt wird bei
     `preselect: current` der Bereich der Seite – gehört sie zu keinem, „Alle“.
     Die Marke `default: true` spielt dann keine Rolle: Wer nirgends steht, soll
     überall suchen, nicht in einem Bereich, der mit der Seite nichts zu tun hat. */
  Search.prototype.fillScopes = function (all) {
    if (!this.scope) return;
    var self = this;
    var preset = "";
    var scopes = all.filter(forRole);
    this.shownRole = role();
    if (!this.scopeChoice()) {
      this.scope.value = "";
      this.scope.closest(".skr-search__field").hidden = true;
      return;
    }
    while (this.scope.options.length > 1) this.scope.remove(1);
    scopes.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.title;
      self.scope.appendChild(o);
      if (s["default"]) preset = s.id;
    });
    if (this.manifest.preselect === "current") preset = this.currentScope();
    this.scope.value = preset;
    this.scope.closest(".skr-search__field").hidden = scopes.length === 0;
  };

  /* Steht der Bereich zur Wahl? Nicht bei `filters.scope: false` – dann immer „Alle“. */
  Search.prototype.scopeChoice = function () {
    return !(this.manifest && this.manifest.filters && this.manifest.filters.scope === false);
  };

  /* DIE ARTEN – aus dem Manifest, in seiner Reihenfolge („Seite“ zuerst). Zu Beginn
     ist jede angehakt; zur Wahl stehen sie erst ab zwei und nicht bei
     `filters.doclinks: false`. */
  Search.prototype.fillKinds = function () {
    if (!this.kinds) return;
    var self = this;
    var kinds = this.manifest.doclinks || [];
    var only = this.kinds.getAttribute("data-label-only") || "";
    this.kindList.textContent = "";
    kinds.forEach(function (k) {
      var li = document.createElement("li");
      li.className = "skr-search__kind-item";
      var label = document.createElement("label");
      label.className = "skr-search__kind-option";
      var box = document.createElement("input");
      box.type = "checkbox";
      box.value = k.id;
      box.checked = true;
      label.appendChild(box);
      label.appendChild(kindIcon(k.id));
      var text = document.createElement("span");
      text.textContent = k.label;
      label.appendChild(text);
      /* „nur“ sichtbar, für Screenreader mit der Art: „nur Präsentation“. */
      var button = document.createElement("button");
      button.type = "button";
      button.className = "skr-search__kind-only";
      button.value = k.id;
      button.textContent = only;
      var hidden = document.createElement("span");
      hidden.className = "skr-visually-hidden";
      hidden.textContent = " " + k.label;
      button.appendChild(hidden);
      li.appendChild(label);
      li.appendChild(button);
      self.kindList.appendChild(li);
    });
    var doclinksOff = this.manifest.filters && this.manifest.filters.doclinks === false;
    this.kindField.hidden = kinds.length < 2 || !!doclinksOff;
    this.openKinds(false);
    this.restoreKinds();
  };

  function doclinksKey() {
    var root = "/";
    try { root = new URL(window.skr._root()).pathname; } catch (e) { /* Wurzel unbekannt */ }
    return "skr-search-doclinks:" + root;
  }

  Search.prototype.doclinksOff = function () {
    return !!(this.manifest && this.manifest.filters && this.manifest.filters.doclinks === false);
  };

  /* Wendet die gemerkte Auswahl an: abgewählt, was im Eintrag steht, sonst angehakt. */
  Search.prototype.restoreKinds = function () {
    if (!this.kinds || this.doclinksOff()) return;
    var stored = window.skr.storage.get(doclinksKey());
    var off = Array.isArray(stored) ? stored : [];
    this.kindBoxes().forEach(function (c) { c.checked = off.indexOf(c.value) < 0; });
    this.showKinds();
  };

  /* Merkt die abgewählten Arten. Das Manifest einer Sprache kennt nur ihre Arten: Was
     der Eintrag über Arten anderer Sprachen sagt, bleibt stehen; neu gesetzt werden nur
     die bekannten. Bleibt nichts abgewählt – kein Eintrag. */
  Search.prototype.storeKinds = function () {
    if (this.doclinksOff()) return;
    var boxes = this.kindBoxes();
    var known = boxes.map(function (c) { return c.value; });
    var stored = window.skr.storage.get(doclinksKey());
    var kept = Array.isArray(stored) ? stored.filter(function (id) { return known.indexOf(id) < 0; }) : [];
    var off = kept.concat(boxes.filter(function (c) { return !c.checked; }).map(function (c) { return c.value; }));
    window.skr.storage.set(doclinksKey(), off.length ? off : null);
  };

  Search.prototype.kindBoxes = function () {
    return this.kindList ? Array.prototype.slice.call(this.kindList.querySelectorAll("input[type=checkbox]")) : [];
  };

  /* Die angehakten Arten – oder null, wenn nicht nach Art gewählt wird. */
  Search.prototype.chosenKinds = function () {
    if (!this.kindField || this.kindField.hidden) return null;
    return this.kindBoxes().filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
  };

  /* Die Schaltfläche nennt die Wahl: „Alle Arten“, die eine Bezeichnung, „{n} Arten“
     oder „Keine Art“. */
  Search.prototype.showKinds = function () {
    var boxes = this.kindBoxes();
    var on = boxes.filter(function (c) { return c.checked; });
    var text = on.length === boxes.length ? this.kindButton.getAttribute("data-all")
      : on.length === 0 ? this.kindButton.getAttribute("data-none")
      : on.length === 1 ? on[0].closest("label").textContent
      : (this.kindButton.getAttribute("data-count") || "").replace("{n}", on.length);
    this.kindValue.textContent = text;
    this.fitKindTitle();
  };

  /* Den vollen Text als `title` nur, solange er gekürzt („…“) ist – sonst sagten
     Screenreader die Bezeichnung doppelt an. Geprüft, wenn der Zeiger oder der Fokus
     kommt: Erst dann steht fest, wie breit die Schaltfläche ist. */
  Search.prototype.fitKindTitle = function () {
    var v = this.kindValue;
    if (v.scrollWidth > v.clientWidth) this.kindButton.title = v.textContent;
    else this.kindButton.removeAttribute("title");
  };

  Search.prototype.kindsChanged = function () {
    this.storeKinds();
    this.showKinds();
    this.run();
  };

  /* Klappt die Liste auf oder zu; auf führt den Fokus zur ersten Art – außer
     `keepFocus`, dann bleibt er, wo er ist. */
  Search.prototype.openKinds = function (open, keepFocus) {
    if (!this.kinds) return;
    /* Lag der Fokus in der Liste (ein Klick, der nicht fokussiert, etwa auf Touch),
       geht er beim Zuklappen auf die Schaltfläche – sonst fiele er ins Leere. */
    if (!open && this.kinds.contains(document.activeElement)) this.kindButton.focus();
    this.kinds.hidden = !open;
    this.kindButton.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && !keepFocus && this.kindBoxes().length) this.kindBoxes()[0].focus();
  };

  Search.prototype.kindOf = function (id) {
    return (this.manifest.doclinks || []).filter(function (k) { return k.id === id; })[0];
  };

  /* Das Symbol einer Art – die Maske, die das Theme an `skr-doclink--«kurzname»` setzt
     (doclinks.css). Der Kurzname ist der Teil des Langnamens «paket».«art» nach dem
     Punkt. Ein eigenes Element ohne die Klasse `skr-doclink`: Das Zeichen zeichnet
     sein `::after` (site.css). Das `::before` mit der Bezeichnung als Alternativtext,
     das doclinks.css an die Klasse der Art hängt, entsteht auch hier; `aria-hidden`
     hält es von Screenreadern fern – die Bezeichnung steht daneben als Text. Ohne Art
     bleibt das Element leer. */
  function kindIcon(id) {
    var icon = document.createElement("span");
    icon.className = "skr-search__kind-icon";
    icon.setAttribute("aria-hidden", "true");
    if (id) icon.classList.add("skr-doclink--" + id.slice(id.lastIndexOf(".") + 1));
    return icon;
  }

  /* Die Dateien, die die Auswahl verlangt – für „Alle“ jede. Ein Bereich, der
     Seiten von anderswo einbindet, nennt seine Dateien selbst. */
  Search.prototype.filesFor = function (scope) {
    var m = this.manifest;
    if (!scope) return m.files;
    var def = (m.scopes || []).filter(function (s) { return s.id === scope; })[0];
    if (def && def.files) return def.files;
    var name = m.lang + "/" + scope + ".json";
    return m.files.indexOf(name) >= 0 ? [name] : [];
  };

  /* Gehört der Treffer zum Bereich? Als eigener oder als eingebundener. */
  function inScope(doc, scope) {
    return !scope || doc.s === scope || (doc.x || []).indexOf(scope) >= 0;
  }

  Search.prototype.fetchFile = function (name) {
    var self = this;
    if (!this.files[name]) {
      /* Die Cache-Kennung des Manifests gilt für seine Einträge mit. */
      var parts = this.manifestUrl.split("?");
      var url = parts[0].replace(/[^/]*$/, "") + name + (parts[1] ? "?" + parts[1] : "");
      this.files[name] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).then(function (docs) {
        self.index[name] = build(docs, self.manifest.case_sensitive);
        return self.index[name];
      });
    }
    return this.files[name];
  };

  /* Wortverzeichnis einer Datei: Begriff → { Seite: Gewicht }. */
  function build(docs, cs) {
    var terms = new Map();
    docs.forEach(function (doc, n) {
      ["t", "g", "h", "i", "j", "d", "b"].forEach(function (f) {
        var counts = new Map();
        tokens(doc[f], cs).forEach(function (w) { counts.set(w, (counts.get(w) || 0) + 1); });
        counts.forEach(function (c, w) {
          var weight = WEIGHT[f] * (f === "b" ? Math.min(c, BODY_CAP) : 1);
          var entry = terms.get(w);
          if (!entry) terms.set(w, entry = new Map());
          entry.set(n, (entry.get(n) || 0) + weight);
        });
      });
    });
    return { docs: docs, terms: terms, cs: cs };
  }

  /* Jeder Suchbegriff muss vorkommen; ein Wort, das mit ihm BEGINNT, zählt,
     ein gleiches Wort zählt mehr. */
  function score(idx, query) {
    var total = null;
    query.forEach(function (q) {
      var hits = new Map();
      idx.terms.forEach(function (entry, w) {
        if (w.lastIndexOf(q, 0) !== 0) return;
        var factor = w === q ? 1.5 : 1;
        entry.forEach(function (v, n) { hits.set(n, (hits.get(n) || 0) + v * factor); });
      });
      if (total === null) { total = hits; return; }
      var next = new Map();
      total.forEach(function (v, n) { if (hits.has(n)) next.set(n, v + hits.get(n)); });
      total = next;
    });
    var out = [];
    (total || new Map()).forEach(function (v, n) { out.push({ doc: idx.docs[n], score: v }); });
    return out;
  }

  Search.prototype.run = function () {
    var self = this;
    if (!this.manifest) return;
    var raw = this.input.value.trim();
    var query = tokens(raw, this.manifest.case_sensitive);
    this.list.textContent = "";
    /* Jede frühe Rückkehr zählt die Marke weiter: Eine ältere Suche, die noch lädt,
       überschreibt dann weder Liste noch Status. */
    if (raw.length < MIN || !query.length) {
      this.ticket = (this.ticket || 0) + 1;
      this.setStatus(raw.length ? say("short") : "");
      return;
    }
    var scope = this.scope ? this.scope.value : "";
    var kinds = this.chosenKinds();
    if (kinds && !kinds.length) {
      this.ticket = (this.ticket || 0) + 1;
      this.setStatus(this.kinds.getAttribute("data-none-selected") || say("none"));
      return;
    }
    var ticket = this.ticket = (this.ticket || 0) + 1;
    Promise.all(this.filesFor(scope).map(function (f) { return self.fetchFile(f); })).then(function (indexes) {
      if (ticket !== self.ticket) return;
      var found = [];
      indexes.forEach(function (idx) {
        found = found.concat(score(idx, query).filter(function (hit) {
          return inScope(hit.doc, scope) && (!kinds || kinds.indexOf(hit.doc.k || "") >= 0);
        }));
      });
      found.sort(function (a, b) { return b.score - a.score || a.doc.t.localeCompare(b.doc.t); });
      self.render(found, raw);
    }).catch(function () { self.setStatus(say("failed")); });
  };

  Search.prototype.scopeTitle = function (id) {
    var s = (this.manifest.scopes || []).filter(function (x) { return x.id === id; })[0];
    return s ? s.title : "";
  };

  Search.prototype.render = function (found, raw) {
    var self = this;
    var shown = found.slice(0, MAX);
    shown.forEach(function (hit) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.className = "skr-search__hit";
      var href = self.base.replace(/\/$/, "") + hit.doc.u;
      /* Der gewählte Bereich reist mit – auch in einen neuen Tab. Die Zielseite
         nimmt ihn aus der Adresse, sobald sie ihn gelesen hat. „Alle“ als leerer
         Wert: Wer überall gesucht hat, soll nicht in einem Bereich landen. */
      if (self.manifest.preselect === "current" && self.scopeChoice()) href += "?scope=" + encodeURIComponent(self.scope ? self.scope.value : "");
      a.href = href;
      /* Die Art vorn – an jedem Treffer. */
      var kind = self.kindOf(hit.doc.k || "");
      if (kind) {
        var tagKind = document.createElement("span");
        tagKind.className = "skr-search__kind-tag";
        tagKind.appendChild(kindIcon(kind.id));
        var kindLabel = document.createElement("span");
        kindLabel.className = "skr-search__kind-label";
        kindLabel.textContent = kind.label;
        tagKind.appendChild(kindLabel);
        a.appendChild(tagKind);
      }
      var title = document.createElement("span");
      title.className = "skr-search__title";
      mark(title, hit.doc.t, raw);
      /* Eine unübersetzte Fassung spricht die Sprache ihres Inhalts. */
      if (hit.doc.l) { title.lang = hit.doc.l; }
      a.appendChild(title);
      var scopeTitle = self.scope && !self.scope.value ? self.scopeTitle(hit.doc.s) : "";
      if (scopeTitle) {
        var tag = document.createElement("span");
        tag.className = "skr-search__scope-tag";
        tag.textContent = scopeTitle;
        a.appendChild(tag);
      }
      var text = snippet(hit.doc, raw);
      if (text) {
        var p = document.createElement("span");
        p.className = "skr-search__snippet";
        if (hit.doc.l) { p.lang = hit.doc.l; }
        mark(p, text, raw);
        a.appendChild(p);
      }
      li.appendChild(a);
      self.list.appendChild(li);
    });
    if (!found.length) this.setStatus(say("none"));
    else if (found.length > MAX) this.setStatus(say("more", found.length, MAX));
    else this.setStatus(found.length === 1 ? say("one") : say("many", found.length));
  };

  /* Ein Ausschnitt um die erste Fundstelle im Text, sonst die Beschreibung. */
  function snippet(doc, raw) {
    var words = raw.toLowerCase().split(/\s+/).filter(Boolean);
    var body = doc.b || "";
    var lower = body.toLowerCase();
    for (var i = 0; i < words.length; i++) {
      var at = lower.indexOf(words[i]);
      if (at >= 0) {
        var start = Math.max(0, at - 60);
        var end = Math.min(body.length, at + 120);
        /* An Wortgrenzen schneiden – ein Ausschnitt, der mit „r längst“ beginnt,
           liest sich wie ein Fehler. */
        if (start > 0) { var sp = body.indexOf(" ", start); if (sp >= 0 && sp < at) start = sp + 1; }
        if (end < body.length) { var ep = body.lastIndexOf(" ", end); if (ep > at) end = ep; }
        return (start > 0 ? "… " : "") + body.slice(start, end).trim() + (end < body.length ? " …" : "");
      }
    }
    return doc.d || body.slice(0, 160);
  }

  /* Hervorheben ohne innerHTML: Der Text kommt aus dem Index und wird als Text
     eingesetzt, die Fundstellen als <mark>. */
  function mark(el, text, raw) {
    var words = raw.split(/\s+/).filter(function (w) { return w.length >= MIN; })
      .map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    if (!words.length) { el.textContent = text; return; }
    var re = new RegExp("(" + words.join("|") + ")", "gi");
    var last = 0;
    text.replace(re, function (m, _g, at) {
      if (at > last) el.appendChild(document.createTextNode(text.slice(last, at)));
      var b = document.createElement("mark");
      b.textContent = m;
      el.appendChild(b);
      last = at + m.length;
      return m;
    });
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  /* Zweimal Shift – ohne andere Taste dazwischen, innerhalb von 400 ms. */
  function doubleShift(open) {
    var last = 0;
    var clean = false;
    document.addEventListener("keydown", function (e) {
      if (e.key === "Shift") { if (!e.repeat) clean = true; }
      else { clean = false; last = 0; }
    }, true);
    document.addEventListener("keyup", function (e) {
      if (e.key !== "Shift" || !clean) return;
      clean = false;
      if (editable(document.activeElement)) { last = 0; return; }
      var now = Date.now();
      if (now - last < 400) { last = 0; open(); }
      else last = now;
    }, true);
  }

  /* Strg+K bzw. ⌘K (`ctrl_k`) – auch aus einem Eingabefeld; die Taste / (`slash`) –
     nicht in einem Eingabefeld, dort ist sie ein Zeichen. */
  function keyShortcut(kind, open) {
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented || e.altKey) return;
      var hit = kind === "ctrl_k"
        ? (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "k" || e.key === "K")
        : e.key === "/" && !e.ctrlKey && !e.metaKey && !editable(document.activeElement);
      if (!hit) return;
      e.preventDefault();
      open();
    });
  }

  function init() {
    if (location.protocol === "file:") return;
    document.querySelectorAll("[data-skr-search]").forEach(function (root) {
      if (!root.querySelector("dialog") || typeof root.querySelector("dialog").showModal !== "function") return;
      var s = new Search(root);
      root.hidden = false;
      /* Zurück aus dem Cache des Browsers: Die Seite steht wieder am Ende des Wegs
         (`search-trail.js`) – und die Vorauswahl folgt ihr. Die gemerkte Auswahl der
         Arten kann sich inzwischen geändert haben; ist die Suche offen, läuft sie neu. */
      window.addEventListener("pageshow", function (e) {
        if (!e.persisted || !s.manifest) return;
        if (s.scope && s.manifest.preselect === "current" && s.scopeChoice()) s.scope.value = s.currentScope();
        s.restoreKinds();
        if (s.dialog.open) s.run();
      });
      var open = function () { if (!s.dialog.open) s.show(); };
      var shortcut = root.getAttribute("data-shortcut");
      if (shortcut === "double_shift") doubleShift(open);
      else if (shortcut === "ctrl_k" || shortcut === "slash") keyShortcut(shortcut, open);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
