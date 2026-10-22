  /* Öffnen und Schließen der Erläuterungen. Die Texte stehen im Dokument und
     werden NICHT erzeugt – sonst fehlten sie im Druck. Ohne JavaScript bleibt
     die Bühne lesbar; die Erläuterungen sind dann über den Druck erreichbar. */
  (function () {
    var panels = document.querySelectorAll(".cv__detail");
    if (!panels.length) return;

    var backdrop = null;
    var openEl = null;
    var trigger = null;

    /* Die Adresse trägt den Zustand: `…/visualisierung.html#cv-registry` lässt
       sich verschicken und als Lesezeichen ablegen. `replaceState` statt einer
       Zuweisung an `location.hash`: Das legt keinen Verlaufseintrag je Klick an
       und springt nicht zur (verborgenen) Sprungmarke. */
    function setHash(id) {
      var target = id ? "#" + id : location.pathname + location.search;
      if (id && location.hash === "#" + id) return;
      if (!id && !location.hash) return;
      history.replaceState(null, "", target);
    }

    function closePanel() {
      if (!openEl) return;
      openEl.hidden = true;
      setHash(null);
      if (backdrop) { backdrop.remove(); backdrop = null; }
      if (trigger) { trigger.setAttribute("aria-expanded", "false"); trigger.focus(); }
      openEl = null;
      trigger = null;
    }

    function openPanel(id, button) {
      var target = document.getElementById(id);
      if (!target) return;
      closePanel();
      backdrop = document.createElement("div");
      backdrop.className = "cv__backdrop";
      backdrop.addEventListener("click", closePanel);
      target.parentNode.insertBefore(backdrop, target);
      target.hidden = false;
      openEl = target;
      trigger = button || null;
      if (trigger) trigger.setAttribute("aria-expanded", "true");
      target.scrollTop = 0;
      target.focus();
      setHash(id);
    }

    /* Beim Laden und bei jeder Adressänderung (Lesezeichen, Zurück-Taste,
       getippte Adresse) den Zustand herstellen, den die Adresse beschreibt. */
    function applyHash() {
      var id = (location.hash || "").replace(/^#/, "");
      var target = id ? document.getElementById(id) : null;
      if (target && target.classList.contains("cv__detail")) {
        if (openEl !== target) openPanel(id, document.querySelector("[data-cv-target='" + id + "']"));
      } else if (openEl) {
        closePanel();
      }
    }

    document.querySelectorAll("[data-cv-target]").forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", button.getAttribute("data-cv-target"));
      button.addEventListener("click", function () {
        openPanel(button.getAttribute("data-cv-target"), button);
      });
    });

    /* Der ganze Kasten ist Hotspot. Ein Klick auf etwas, das selbst reagiert
       (eigener Knopf, Link), hat Vorrang – dort wird nichts überschrieben. */
    document.querySelectorAll("[data-cv-area]").forEach(function (area) {
      var id = area.getAttribute("data-cv-area");
      area.addEventListener("click", function (e) {
        if (e.target.closest("a, button")) return;
        openPanel(id, area.querySelector("[data-cv-target='" + id + "']"));
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePanel();
    });

    /* Der Fokus bleibt im geöffneten Kasten: Wandert er hinaus, kommt er zurück.
       Das ersetzt eine Fokusfalle mit wenigen Zeilen. */
    document.addEventListener("focusin", function (e) {
      if (openEl && !openEl.contains(e.target)) openEl.focus();
    });

    window.addEventListener("hashchange", applyHash);
    applyHash();

    /* Vor dem Drucken alles zu: Ein geöffneter Kasten läge sonst über der
       Seite, während darunter ohnehin schon alle Texte stehen. */
    window.addEventListener("beforeprint", closePanel);
  })();
