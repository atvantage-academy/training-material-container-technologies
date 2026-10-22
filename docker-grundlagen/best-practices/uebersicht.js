  /* Öffnen und Schließen der Erläuterungen. Die Texte stehen im Dokument und
     werden NICHT erzeugt – sonst fehlten sie im Druck. */
  (function () {
    var panels = document.querySelectorAll(".bp__detail");
    if (!panels.length) return;

    var backdrop = null;
    var openEl = null;
    var trigger = null;

    /* Die Adresse trägt den Zustand: `…/uebersicht.html#bp-versionen-pinnen`
       lässt sich verschicken und als Lesezeichen ablegen. */
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
      backdrop.className = "bp__backdrop";
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

    function applyHash() {
      var id = (location.hash || "").replace(/^#/, "");
      var target = id ? document.getElementById(id) : null;
      if (target && target.classList.contains("bp__detail")) {
        if (openEl !== target) openPanel(id, document.querySelector("[data-bp-target='" + id + "']"));
      } else if (openEl) {
        closePanel();
      }
    }

    document.querySelectorAll("[data-bp-target]").forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", button.getAttribute("data-bp-target"));
      button.addEventListener("click", function () {
        openPanel(button.getAttribute("data-bp-target"), button);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePanel();
    });

    /* Der Fokus bleibt im geöffneten Kasten. */
    document.addEventListener("focusin", function (e) {
      if (openEl && !openEl.contains(e.target)) openEl.focus();
    });

    window.addEventListener("hashchange", applyHash);
    applyHash();

    window.addEventListener("beforeprint", closePanel);
  })();
