/* =============================================================================
   Skriptorium – der Namensraum `skr` (gleichbedeutend `skriptorium`)
   -----------------------------------------------------------------------------
   Das erste Skript jeder Seite, ohne `defer`: Es legt den Namensraum an, an den
   sich der Kern (client.js) und die Extensions hängen – gleich, in welcher
   Reihenfolge sie laden. Ein Skript in einer Seite darf ihn sofort nutzen.

     skr.state, skr.dialog                Helfer für Seiten und Extensions (client.js)
     skr.buildInfo, skr.colorScheme() …   Client-API: Bauauskunft und Steuerung (client.js)
     skr.ext.«name»                       die Teile einer Extension
     skr.ext.register(name, function (ctx) { return { … }; })

   `ctx` je Extension: `readonly`, `guard(part, fn)`, `sidebarCard(id, options)`
   – eine Karte in der Seitenleiste der Seite (siehe unten) –, `text(key, values)`
   – ein Text des Pakets in der Sprache der Seite – und `page.fields` – die Felder, die
   die Extension für das Layout der Seite erklärt, mit ihren Werten.

   REIHENFOLGE: Skripte mit `defer` laufen nach dem Lesen des Dokuments, in der Reihenfolge
   ihrer Einbindung – der Kern (client.js), dann Layout, Bausteine und Extensions –, und
   erst danach kommt `DOMContentLoaded`. Was Kern und Extensions dann tun, ordnet
   `skr.ready(fn)`: Beim `DOMContentLoaded` läuft zuerst der Kern (Rahmen, Verzeichnis,
   Bausteine, Zustand), dann jede mit `skr.ready` angemeldete Funktion in der Reihenfolge der
   Anmeldung, zuletzt geht das Ereignis `skr-ready` an das Dokument – darauf rechnen Karten
   wie der Fortschritt nach, was Extensions geändert haben. Wer später anmeldet, läuft
   sofort. Ein Fehler in einer Funktion hält die übrigen nicht auf.

   SCHALTER `client_api` (skriptorium.yml, im Seitenblock): `full` – alles; `readonly`
   – Steuerndes wirft mit Verweis auf die Einstellung; `off` – keine Bauauskunft und
   keine Steuerung. Die HELFER für Seiten bleiben immer: Ohne sie brächen die Seiten.

   VOR DEM ERSTEN MALEN setzt diese Datei, was sonst ein Skript im Dokument täte – die
   Seiten tragen keins (Content Security Policy ohne `unsafe-inline`):
     - das gewählte Farbschema (`data-skr-theme`, gespeichert im Browser);
     - die Rolle der Navigation (`data-skr-role`) aus dem Datenblock `skr-roles`, der vor
       dieser Datei steht: die gespeicherte Wahl je Site, sonst die erste Rolle; steht die
       Seite nur in der Navigation anderer Rollen, deren erste – ohne die Wahl zu ändern;
     - die Lademarke einer Präsentation (`data-skr-present-loading`, angefordert mit
       `data-skr-present-mark` am <html>), samt Frist, falls presentation.js ausbleibt.
   ========================================================================== */
(function () {
  "use strict";
  var h = document.documentElement;
  try {
    var t = localStorage.getItem("skr-theme");
    if (t === "dark" || t === "light") h.setAttribute("data-skr-theme", t);
  } catch (e) { /* kein Speicher */ }
  addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    if (r && r.name === "InvalidStateError" && /ViewTransition opt-in disabled/.test(r.message || "")) e.preventDefault();
  });
  var roles = document.getElementById("skr-roles");
  if (roles) {
    try {
      var data = JSON.parse(roles.textContent) || {};
      var ids = data.ids || [], page = data.page || [], r = null;
      var m = document.querySelector('meta[name="skr-root"]');
      try { r = localStorage.getItem("skr-role:" + new URL((m && m.getAttribute("content")) || "/", location.href).pathname); } catch (e) { /* kein Speicher */ }
      if (ids.indexOf(r) < 0) r = ids[0];
      if (page.length && page.indexOf(r) < 0) r = page[0];
      if (r) h.setAttribute("data-skr-role", r);
    } catch (e) { /* Rolle bleibt die aus dem Markup */ }
  }
  if (h.hasAttribute("data-skr-present-mark")) {
    h.setAttribute("data-skr-present-loading", "");
    h.setAttribute("aria-busy", "true");
    setTimeout(function () { h.removeAttribute("data-skr-present-loading"); h.removeAttribute("aria-busy"); }, 3000);
  }
})();
(function () {
  "use strict";
  if (window.skriptorium) return;

  /* Die Einstellung lesen, wenn sie gebraucht wird – der Seitenblock kann beim Laden
     dieser Datei noch fehlen. */
  function mode() {
    var block = document.getElementById("skr-page-info");
    if (!block) return "full";
    try { return (JSON.parse(block.textContent) || {}).clientApi || "full"; } catch (e) { return "full"; }
  }

  /* Steuerndes durch die Einstellung führen: Bei `readonly` und `off` wirft es, statt
     still nichts zu tun. */
  function guard(name, fn) {
    return function () {
      var m = mode();
      if (m !== "full") {
        throw new Error("skr." + name + ": nicht verfügbar – die Site setzt client_api: " + m + ".");
      }
      return fn.apply(this, arguments);
    };
  }

  /* KARTEN IN DER SEITENLEISTE: Eine Extension legt eine Karte an, wo die Vorlage
     ihren Ort vorsieht (`<template data-skr-sidebar-cards>`, nach dem
     Inhaltsverzeichnis). Gibt es keine Seitenleiste, liefert sie `null` – die
     Extension zeigt dann nichts. Dieselbe Kennung liefert dieselbe Karte.

       var k = ctx.sidebarCard("progress", { label: "Fortschritt", hidden: true });
       k.body.append(…); k.show(true);

     Die Karte trägt Form und Beschriftung der Karten des Kerns; ihr Inhalt gehört der
     Extension. Jede Änderung der Sichtbarkeit meldet `skr-sidebar-changed` – der
     Kern stellt daraufhin das Raster um, wenn die Seitenleiste leer wird oder nicht
     mehr leer ist. */
  function card(slug, o) {
    var place = document.querySelector("template[data-skr-sidebar-cards]");
    if (!place) return null;
    var announce = function () { document.dispatchEvent(new CustomEvent("skr-sidebar-changed")); };
    var el = place.parentNode.querySelector('[data-skr-card="' + slug + '"]');
    if (!el) {
      el = document.createElement("section");
      el.className = "skr-guide-side skr-guide-side--bordered";
      el.setAttribute("data-skr-card", slug);
      var label = document.createElement("div");
      label.className = "skr-guide-side__label";
      label.id = "skr-card-" + slug.replace(/[^a-z0-9-]/gi, "-");
      label.textContent = o.label || "";
      el.setAttribute("aria-labelledby", label.id);
      var body = document.createElement("div");
      body.className = "skr-guide-side__body";
      el.appendChild(label);
      el.appendChild(body);
      el.hidden = o.hidden === true;
      place.parentNode.insertBefore(el, place);
      announce();
    }
    return Object.freeze({
      element: el,
      label: el.querySelector(".skr-guide-side__label"),
      body: el.querySelector(".skr-guide-side__body"),
      show: function (on) { el.hidden = on === false; announce(); }
    });
  }

  /* DATENBLÖCKE der Seite (build-info.html): einmal gelesen, bei Fehlern leer. */
  var blocks = {};
  function block(id) {
    if (!(id in blocks)) {
      var el = document.getElementById(id);
      try { blocks[id] = (el && JSON.parse(el.textContent)) || {}; } catch (e) { blocks[id] = {}; }
    }
    return blocks[id];
  }

  function freeze(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) {
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
      Object.freeze(o);
    }
    return o;
  }

  /* TEXTE eines Pakets in der Sprache der Seite – der Bau legt die Texte aller
     Extensions dieser Sprache in den Block `skr-texts`, samt den Änderungen des Themes
     und dem Rückfall auf die Standardsprache. Platzhalter `{name}` füllt `werte`; Zahlen
     erscheinen im Zahlformat der Seite. Ein unbekannter Schlüssel liefert seinen vollen
     Namen – sichtbar, statt still zu fehlen. */
  function text(pkg, key, values) {
    var full = pkg + "." + key;
    var t = block("skr-texts")[full];
    if (typeof t !== "string") return full;
    if (!values) return t;
    var language = document.documentElement.getAttribute("lang") || undefined;
    return t.replace(/\{([A-Za-z0-9_]+)\}/g, function (whole, k) {
      if (!Object.prototype.hasOwnProperty.call(values, k)) return whole;
      var w = values[k];
      if (typeof w === "number") { try { return new Intl.NumberFormat(language).format(w); } catch (e) { return String(w); } }
      return String(w);
    });
  }

  var ext = {};
  /* Eine Extension meldet ihre Teile an. Mehrere Anmeldungen unter einem Namen werden
     zusammengeführt; derselbe Eintrag zweimal ist ein Fehler.
     DER NAME IST EIN BEZEICHNER: der Name aus extension.yml in camelCase (`skr-test` →
     `skrTest`), damit die Teile als skr.ext.skrTest erreichbar sind. Texte, Felder der Seite
     und Karten gehören weiter zum Namen aus extension.yml – aus dem Bezeichner eindeutig
     zurückgewonnen, denn Namen haben nur Kleinbuchstaben. */
  Object.defineProperty(ext, "register", {
    value: function (name, api) {
      if (typeof name !== "string" || typeof api !== "function") {
        throw new TypeError("skr.ext.register(name, function (ctx) { … }) erwartet");
      }
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
        var suggestion = name.replace(/-([a-z0-9])/g, function (all, c) { return c.toUpperCase(); });
        throw new TypeError('skr.ext.register: "' + name + '" is no valid identifier – register the extension ' + name + ' as "' + suggestion + '"');
      }
      var extensionName = name.replace(/[A-Z]/g, function (c) { return "-" + c.toLowerCase(); });
      var ctx = Object.freeze({
        get readonly() { return mode() !== "full"; },
        guard: function (part, fn) { return guard("ext." + name + "." + part, fn); },
        sidebarCard: function (id, o) { return card(extensionName + "." + id, o || {}); },
        text: function (key, values) { return text(extensionName, key, values); },
        get page() {
          var fieldDefs = (block("skr-page-info").fields || {})[extensionName] || {};
          return { fields: freeze(JSON.parse(JSON.stringify(fieldDefs))) };
        }
      });
      var parts = api(ctx) || {};
      var target = ext[name] || (ext[name] = {});
      Object.keys(parts).forEach(function (k) {
        if (k in target) throw new Error("skr.ext." + name + "." + k + " ist schon angemeldet");
        Object.defineProperty(target, k, { value: parts[k], enumerable: true });
      });
      return target;
    }
  });

  /* DIE WURZEL DER SITE, absolut: Die Site kennt ihre Adresse nicht, der Browser schon.
     `<meta name="skr-root">` zeigt relativ zur Seite auf die Wurzel (`../../`); aufgelöst
     gegen die Adresse der Seite ergibt das die Wurzel, unter der die Site gerade läuft. */
  function root() {
    var m = document.querySelector('meta[name="skr-root"]');
    try { return new URL((m && m.getAttribute("content")) || "/", location.href).href; } catch (e) { return location.href; }
  }

  /* ABGEKÜNDIGTES der Client-API: Ein Teil, den der nächste Major entfernt, bleibt
     nutzbar und meldet bei der ersten Nutzung einmal je Seite eine Warnung in der Konsole,
     die seinen Ersatz nennt. Der Kern hüllt ihn so ein:
       skr._deprecated("altName", "neuerName", fn)   eine Funktion
     Gemeldet wird je Name nur einmal. */
  var reported = {};
  function deprecatedNames(name, replacementNote, fn) {
    return function () {
      if (!reported[name]) {
        reported[name] = true;
        if (window.console && console.warn) {
          console.warn("skr." + name + " is deprecated" + (replacementNote ? " – use skr." + replacementNote : "") +
            "; it is removed with the next major version of the Skriptorium.");
        }
      }
      return fn.apply(this, arguments);
    };
  }

  /* BEREIT: erst der Kern, dann die übrigen Anmeldungen, zuletzt `skr-ready`. */
  var done = false, core = [], others = [];
  function run(fn) { try { fn(); } catch (e) { if (window.console && console.error) console.error(e); } }
  function ready(fn, isCore) {
    if (typeof fn !== "function") throw new TypeError("skr.ready(function () { … }) erwartet");
    if (done) { run(fn); return; }
    (isCore ? core : others).push(fn);
  }
  function start() {
    if (done) return;
    while (core.length) run(core.shift());
    while (others.length) run(others.shift());
    done = true;
    document.dispatchEvent(new CustomEvent("skr-ready"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else setTimeout(start, 0);

  var skr = {};
  Object.defineProperty(skr, "ext", { value: ext, enumerable: true });
  Object.defineProperty(skr, "ready", { value: function (fn) { ready(fn, false); }, enumerable: true });
  /* Für den Kern: Einstellung, Schranke und Wurzel der Site – nicht Teil der öffentlichen API. */
  Object.defineProperty(skr, "_mode", { value: mode });
  Object.defineProperty(skr, "_guard", { value: guard });
  Object.defineProperty(skr, "_root", { value: root });
  Object.defineProperty(skr, "_deprecated", { value: deprecatedNames });
  Object.defineProperty(skr, "_ready", { value: function (fn) { ready(fn, true); } });

  window.skriptorium = window.skr = skr;
})();
