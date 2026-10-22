/* =============================================================================
   Nutzlast eines Lehrmediums mit Lösung – `skr.ext.didaktikon.payload(wurzel)`
   -----------------------------------------------------------------------------
   Für Wissens-Check (quiz.js) und Kreuzworträtsel (crossword.js); beide Bausteine
   laden diese Datei vor ihrem eigenen Skript.

   Steht im Rahmen eines Bausteins ein `<script type="text/plain" data-skr-didaktikon-payload>`,
   liefert `payload(wurzel)` daraus `{ html, solution }` – Base64 (UTF-8) über JSON.
   Sonst `null`, und der Baustein liest sein Klartext-Markup wie gewohnt. So kann ein
   Bauschritt die Lösung aus dem lesbaren HTML heraushalten, ohne dass sich an den
   Bausteinen etwas ändert.

   ZWEIMAL GELADEN, EINMAL ANGEMELDET: Stehen Wissens-Check und Kreuzworträtsel auf
   derselben Seite, lädt das Skriptorium diese Datei für jeden Baustein. Derselbe Teil
   zweimal angemeldet wäre ein Fehler – die zweite Ausführung tut deshalb nichts.
   ============================================================================= */
(function () {
  "use strict";
  var ext = window.skr && window.skr.ext;
  if (!ext || (ext.didaktikon && "payload" in ext.didaktikon)) { return; }

  function base64Text(roh) {
    var bin = window.atob(String(roh).replace(/\s+/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return new TextDecoder().decode(bytes);
  }

  function payload(wurzel) {
    var k = wurzel && wurzel.querySelector(":scope > script[data-skr-didaktikon-payload]");
    if (!k) { return null; }
    try { return JSON.parse(base64Text(k.textContent)); } catch (e) { return null; }
  }

  ext.register("didaktikon", function () { return { payload: payload }; });
})();
