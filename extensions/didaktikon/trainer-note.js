/* =============================================================================
   Trainerhinweis – Baustein `skr-didaktikon-trainer-note`
   -----------------------------------------------------------------------------
   Gehört zu `trainer-note.css`. Das Skriptorium lädt beides auf jeder Seite, deren
   Inhalt das Merkmal `skr-didaktikon-trainer-note` enthält (extension.yml).

     <div class="skr-didaktikon-trainer-note" data-skr-audiences="trainer" markdown="1">
     Beliebiges Markdown – der Hinweis.
     </div>

   Das Skript macht aus dem Kasten einen Knopf mit Studentenhut und legt den Hinweis in
   ein natives `popover`: Öffnen, Schließen per Esc oder Klick daneben, Fokus und
   `aria-expanded` bringt der Browser mit. Folgt der Hinweis einem Absatz, rückt der
   Knopf an dessen Ende – in einer Liste von Reflexionsfragen steht er so an seiner Frage.

   Ohne Skript, ohne `popover` im Browser und im Druck bleibt der Kasten stehen, wie er
   ist: ein Hinweis, der sichtbar ist, schadet Trainer:innen nicht.

   ALS BOX STATT POPUP: Mit `skr-didaktikon-trainer-note--box` am Kasten bleibt er stehen,
   wie er ist – Studentenhut und Hinweis offen an seiner Stelle. Die Vorgabe bleibt das
   Popup. Der Wissens-Check fasst so die Bedienung nur für Trainer:innen ein (quiz.js).
   ============================================================================= */
(function () {
  "use strict";

  if (!HTMLElement.prototype.hasOwnProperty("popover")) return;

  var ctx = null;
  window.skr.ext.register("didaktikon", function (c) { ctx = c; return {}; });
  function T(key) { return ctx.text(key); }

  var ICON = "skr-didaktikon-trainer-note__icon";

  function icon() {
    var span = document.createElement("span");
    span.className = ICON;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  document.querySelectorAll(".skr-didaktikon-trainer-note:not(.skr-didaktikon-trainer-note--box)").forEach(function (root, index) {
    var id = root.id ? root.id + "-popup" : "skr-didaktikon-trainer-note-" + (index + 1);

    var popup = document.createElement("div");
    popup.className = "skr-didaktikon-trainer-note__popup";
    popup.id = id;
    popup.setAttribute("popover", "");
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-labelledby", id + "-title");

    var head = document.createElement("div");
    head.className = "skr-didaktikon-trainer-note__head";
    var title = document.createElement("p");
    title.className = "skr-didaktikon-trainer-note__title";
    title.id = id + "-title";
    title.appendChild(icon());
    title.appendChild(document.createTextNode(T("trainerNoteTitle")));
    var close = document.createElement("button");
    close.type = "button";
    close.className = "skr-didaktikon-trainer-note__close";
    close.setAttribute("popovertarget", id);
    close.setAttribute("popovertargetaction", "hide");
    close.setAttribute("aria-label", T("trainerNoteClose"));
    close.textContent = "×";
    head.appendChild(title);
    head.appendChild(close);

    var body = document.createElement("div");
    body.className = "skr-didaktikon-trainer-note__body";
    while (root.firstChild) body.appendChild(root.firstChild);
    popup.appendChild(head);
    popup.appendChild(body);

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "skr-didaktikon-trainer-note__toggle";
    toggle.setAttribute("popovertarget", id);
    toggle.setAttribute("aria-label", T("trainerNoteOpen"));
    toggle.title = T("trainerNoteOpen");
    toggle.appendChild(icon());

    var paragraph = root.previousElementSibling;
    if (paragraph && paragraph.tagName === "P") {
      paragraph.appendChild(document.createTextNode(" "));
      paragraph.appendChild(toggle);
    } else {
      root.appendChild(toggle);
    }
    root.appendChild(popup);
    root.classList.add("is-ready");
  });
})();
