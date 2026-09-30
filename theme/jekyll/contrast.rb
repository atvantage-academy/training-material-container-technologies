#!/usr/bin/env ruby
# frozen_string_literal: true

# ---------------------------------------------------------------------------
# Kontrastprüfung – gerenderte Farbpaare des gebauten `_site`
# ---------------------------------------------------------------------------
#
# WOFÜR. Ein Farbwert wird gegen EINEN Untergrund entworfen und später vor EINEN
# ANDEREN gestellt. Nichts im Build wird davon rot: Das Schema ist zufrieden, die
# Seite entsteht, der Text steht da – nur lesen kann ihn niemand. Diese Fehlerart
# hat allein zwischen 2.6.0 und 2.10.0 sechsmal zugeschlagen, zweimal davon
# entstand sie BEIM BEHEBEN einer anderen. Gefunden hat sie jedes Mal ein Mensch,
# meist Wochen später und meist in fertigen Schulungsunterlagen.
#
# WARUM GEGEN DAS GEBAUTE HTML. Dieselbe Begründung wie bei `links.rb` und
# `bin/js-hooks.sh`, hier aber noch zwingender: Kontrast ist eine Eigenschaft
# GERENDERTER PAARE. Welche Fläche wirklich unter einem Text liegt, steht in
# keiner einzelnen CSS-Regel – das ergeben erst Kaskade, Vererbung und Farbschema.
# Eine Prüfung über die Quellen hätte ihr Loch genau dort, wo die echten Fälle
# liegen: `.bubble.a` setzte `background: #fff` und erbte die Schrift von weit
# oben; die getönte Tafel färbte Schrift und Fläche aus DERSELBEN Variablen.
#
# WARUM BEIDE FARBSCHEMATA. Vier der sechs Fälle zeigten sich nur in einem davon,
# und zwei davon nur im Dark-Theme – dem, das beim Schreiben niemand offen hat.
#
# WAS SIE NICHT KANN – und das steht hier, damit es niemand für „geprüft“ hält:
#   * Text über Verlauf, Bild oder SVG-Fläche. Die wirksame Farbe ist dort kein
#     einzelner Wert. Solche Stellen werden GEZÄHLT und gemeldet, nicht still
#     übergangen.
#   * Halbdurchsichtige Schrift. Was durchscheint, hängt am Stapel darunter.
#   * Alles, was erst nach einer Eingabe entsteht – aufgeklappte Menüs, Folien
#     hinter der ersten, Simulationsschritte. Gemessen wird der Auslieferungs-
#     zustand der Seite.
#
# SIE BRICHT NICHTS – MIT EINER AUSNAHME. Absichtlich: Ein Prüfer, der aus
# unwichtigem Grund rot wird, wird weggeklickt und schützt dann gar nichts mehr –
# siehe die Begründung zum Markup Contract in AGENTS.md. `--strict` macht aus dem
# Bericht ein Tor, aber erst, wenn eine Ausnahmeliste steht und ein Lauf sauber
# durchgeht.
#
# DIE AUSNAHME IST EIN LAUF, DER NICHTS GEMESSEN HAT. Kam eine Seite ohne
# Theme-CSS in den Browser, steht dort nacktes HTML: Fast jede Paarung trägt,
# weil es nur noch Schwarz auf Weiß gibt. Der Bericht sagte dann „Keine Paarung
# unter der Schwelle" und endete mit 0 – dieselbe Zeile wie nach einer echten,
# sauberen Messung. Gemeldet aus `atlassian-mcp`: 106 betrachtete Elemente gegen
# 4, beide Läufe grün, nichts in der Ausgabe unterschied sie.
#
# Solche Seiten werden jetzt BENANNT und der Lauf endet mit RÜCKGABEWERT 2 –
# unabhängig von `--strict`, weil ein Befund eine inhaltliche Entscheidung ist
# und dies keine Messung. Dazu nennt der Bericht, wie viele Elemente er überhaupt
# betrachtet hat: die Bezugsgröße, die vorher fehlte.
#
# DER BASISPFAD IST DIE HÄUFIGSTE URSACHE. Eine mit `jekyll build --baseurl /docs`
# gebaute Site verweist absolut auf `/docs/theme/academy/…`. Wird das gebaute
# Verzeichnis flach serviert, liegt dort nichts. `--baseurl /docs` bildet den
# Pfad nach – gleiche Schreibweise und Bedeutung wie in `links.rb`, weil beide
# Prüfer nebeneinander aufgerufen werden.
#
# BRAUCHT EINEN BROWSER. Chrome oder Chromium, gefunden über `--browser`, die
# Umgebungsvariable `CHROME` oder die üblichen Pfade. Ohne Browser wird die
# Prüfung SICHTBAR übersprungen (mit `--require-browser` scheitert sie).
#
# Aufruf:
#   ruby theme/jekyll/contrast.rb                    # Bericht
#   ruby theme/jekyll/contrast.rb --baseurl /docs    # Site mit Basispfad gebaut
#   ruby theme/jekyll/contrast.rb --require-site     # ohne _site scheitern
#   ruby theme/jekyll/contrast.rb --self-test        # die Prüfung selbst prüfen
#   ruby theme/jekyll/contrast.rb --allow .avd-contrast-allow.txt
#
# Rückgabewerte: 0 in Ordnung · 1 Befunde (nur mit `--strict`) · 2 nicht gemessen
# ---------------------------------------------------------------------------

require 'json'
require 'set'
require 'socket'
require 'fileutils'
require 'tmpdir'

AA_NORMAL = 4.5
AA_LARGE = 3.0

# ---------------------------------------------------------------------------
# Browser finden
# ---------------------------------------------------------------------------
BROWSER_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium'
].freeze

def find_browser(default)
  candidates = [default, ENV['CHROME'], *BROWSER_PATHS].compact
  candidates.find { |p| File.executable?(p) } ||
    candidates.find { |p| !p.include?('/') && system("command -v #{p} >/dev/null 2>&1") }
end

# ---------------------------------------------------------------------------
# Ein winziger HTTP-Server aus der Standardbibliothek
#
# Warum überhaupt einer: Über `file://` laufen die wurzelabsoluten Asset-Pfade der
# gebauten Seiten (`/theme/academy/…`) ins Leere. Die Seite rendert dann ganz ohne
# Theme-CSS – und eine Messung daran wäre nicht falsch, sondern sinnlos.
#
# Warum nicht WEBrick: Seit Ruby 3.0 keine Default-Gem mehr. Auf einem fremden
# Runner ist sie damit nicht zugesichert, und dieses Paket bleibt abhängigkeitsfrei.
# ---------------------------------------------------------------------------
KINDS = {
  '.html' => 'text/html; charset=utf-8', '.css' => 'text/css; charset=utf-8',
  '.js' => 'text/javascript; charset=utf-8', '.json' => 'application/json',
  '.svg' => 'image/svg+xml', '.png' => 'image/png', '.jpg' => 'image/jpeg',
  '.jpeg' => 'image/jpeg', '.gif' => 'image/gif', '.webp' => 'image/webp',
  '.woff' => 'font/woff', '.woff2' => 'font/woff2', '.ico' => 'image/x-icon'
}.freeze

# DER BASISPFAD GEHOERT DAZU, GENAU WIE BEI `links.rb`. Eine mit
# `jekyll build --baseurl /docs` gebaute Site traegt ihre Theme-Pfade
# wurzel-absolut als `/docs/theme/academy/...`. Serviert man das gebaute
# Verzeichnis flach, liegt unter `/docs/` nichts: Jede Datei laeuft ins Leere,
# und gemessen wird eine Seite OHNE Theme-CSS. Der Server bildet den Basispfad
# deshalb nach, statt dass jeder Aufrufer sein Artefakt vorher in einen
# Unterordner umpacken muss -- genau dieser Behelf war in `atlassian-mcp` noetig.
def start_server(root, base = '')
  server = TCPServer.new('127.0.0.1', 0)
  port = server.addr[1]
  thread = Thread.new do
    loop do
      session = begin
        server.accept
      rescue StandardError
        break
      end
      Thread.new(session) { |s| serve_request(s, root, base) }
    end
  end
  [server, thread, port]
end

def respond_404(session)
  session.print("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
  session.close
  nil
end

def serve_request(session, root, base = '')
  # Ein einzelner hängender Socket darf den ganzen Lauf nicht anhalten.
  session.timeout = 5 if session.respond_to?(:timeout=)
  line = session.gets
  return session.close if line.nil?

  # Kopfzeilen bis zur Leerzeile verwerfen – GENAU EIN gets je Durchlauf.
  while (head = session.gets)
    break if head.strip.empty?
  end
  path = line.split(' ')[1].to_s.split('?').first.to_s
  # Der Basispfad wird abgezogen, nicht ignoriert: Eine Anfrage AUSSERHALB von ihm
  # geht auch in der Auslieferung ins Leere und muss hier ebenso 404 bekommen -
  # sonst faende die Messung Dateien, die es spaeter nicht gibt.
  unless base.empty?
    return respond_404(session) unless path == base || path.start_with?(base + '/')

    path = path[base.length..].to_s
    path = '/' if path.empty?
  end
  path = '/index.html' if path == '/'
  path += 'index.html' if path.end_with?('/')
  file = File.join(root, URI_decode(path))
  # Ausbruch aus dem Wurzelverzeichnis ist keine Anfrage, sondern ein Fehler.
  if !File.file?(file) || !File.expand_path(file).start_with?(File.expand_path(root))
    session.print("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
  else
    content = File.binread(file)
    kind = KINDS[File.extname(file).downcase] || 'application/octet-stream'
    session.print("HTTP/1.1 200 OK\r\nContent-Type: #{kind}\r\n" \
                  "Content-Length: #{content.bytesize}\r\nConnection: close\r\n\r\n")
    session.write(content)
  end
rescue StandardError
  nil
ensure
  begin
    session.close
  rescue StandardError
    nil
  end
end

# Nur die Zeichen kodieren, die eine Adresse zerlegen – die Schraegstriche bleiben.
def encode_path(path)
  path.split('/', -1).map { |t| t.gsub(/[^A-Za-z0-9\-_.~!$&'()*+,;=:@]/) { |z| format('%%%02X', z.ord) } }.join('/')
end

def URI_decode(path)
  path.gsub(/%([0-9A-Fa-f]{2})/) { [Regexp.last_match(1)].pack('H2') }
end

# ---------------------------------------------------------------------------
# Die Sonde – läuft IM Browser, in jeder Seite, je Farbschema einmal
#
# Sie liefert genau die Paare, die unter der Schwelle liegen. Gruppiert wird erst
# hier in Ruby; der Browser soll nur messen.
# ---------------------------------------------------------------------------
PROBE = <<~'JS'
  (function () {
    var cv = document.createElement("canvas"); cv.width = cv.height = 1;
    var ctx = cv.getContext("2d", { willReadFrequently: true });
    /* Ueber einen Canvas-Pixel, weil getComputedStyle je nach Farbraum
       `color(srgb …)` oder `oklch(…)` zurueckgibt - beides ist keine Zahl,
       die man direkt rechnen kann.

       Gemessen wird ueber ZWEI Gruende, schwarz und weiss. Stimmen beide
       Ergebnisse ueberein, ist die Farbe deckend; weichen sie ab, ist sie
       durchscheinend. Das ersetzt die fruehere Alpha-Erkennung per Regex auf
       `rgba(…)`: Die griff bei `color-mix(… , transparent)` nicht, weil Chrome
       daraus `color(srgb r g b / 0.45)` macht. Eine 45 % deckende Flaeche galt
       damit als deckend und wurde ueber SCHWARZ gemessen - aus #EDEDED wurde
       #6B6B6B, und die Prueferei meldete reihenweise Text, der in Wahrheit
       traegt. Ein Prueferi mit Fehlalarmen wird weggeklickt; deshalb ist das
       hier kein Randfall, sondern der Kern. */
    function px(css) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
      var b = ctx.getImageData(0, 0, 1, 1).data;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
      var w = ctx.getImageData(0, 0, 1, 1).data;
      var deckend = Math.abs(b[0] - w[0]) < 2 && Math.abs(b[1] - w[1]) < 2 && Math.abs(b[2] - w[2]) < 2;
      return { farbe: [b[0], b[1], b[2]], deckend: deckend };
    }
    function lum(c) {
      var f = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    }
    function ratio(a, b) { var A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); }
    var hex = function (c) { return "#" + c.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("").toUpperCase(); };

    /* Die wirksame Flaeche: nach oben laufen, bis eine DECKENDE Hintergrundfarbe
       kommt. Liegt unterwegs ein Bild oder Verlauf, ist die Farbe kein einzelner
       Wert mehr - dann wird nicht geraten, sondern uebersprungen und gezaehlt. */
    /* WOHER KOMMT DIE FARBE? Ein Befund ohne Ursache ist beim Verbraucher
       wertlos: Er misst Seiten, die ihm gehoeren, aber die Farbe darauf kann
       aus dem Theme stammen - und dann kann er nichts daran aendern. Die
       Regel dazu steht in AGENTS.md, „Ein Befund gehoert dem, der seine
       Ursache aendern kann".

       GEFRAGT WIRD NICHT NACH DEM GEWINNER DER KASKADE, sondern danach, ob
       ueberhaupt eine PROJEKTREGEL im Spiel ist. Das ist absichtlich grob und
       absichtlich in diese Richtung: Wer die Kaskade nachbaut, baut
       Spezifitaet, Ebenen und `!important` nach und liegt irgendwann falsch -
       still. Hier gilt: Sobald eine Regel ausserhalb von `/theme/` die
       Eigenschaft setzt, gehoert der Befund dem Projekt. Lieber einer zu viel
       als eine stille Luecke.

       ALS PROJEKT ZAEHLEN: jedes `<style>` im Dokument (kein `href`), jedes
       Stylesheet ausserhalb von `/theme/`, und das `style`-Attribut am Element.
       Ein Stylesheet, dessen Regeln der Browser nicht herausgibt, macht den
       Befund `unbekannt` - und `unbekannt` wird wie `projekt` behandelt. */
    var regeln = [];
    (function sammle(blaetter, ausTheme) {
      for (var i = 0; i < blaetter.length; i++) {
        var blatt = blaetter[i], eigen = ausTheme;
        if (eigen === null) {
          var h = blatt.href;
          /* Ohne `href` ist es ein `<style>` im Dokument - das schreibt das
             Projekt. Mit `href` entscheidet der Pfad. */
          eigen = h ? /\/theme\//.test(h) : false;
        }
        var r;
        try { r = blatt.cssRules; } catch (e) { regeln.push({ blind: true }); continue; }
        if (!r) continue;
        for (var j = 0; j < r.length; j++) {
          var regel = r[j];
          if (regel.styleSheet) { sammle([regel.styleSheet], eigen); continue; }  /* @import */
          if (regel.cssRules && !regel.selectorText) { sammle([regel], eigen); continue; } /* @media, @supports */
          if (!regel.selectorText || !regel.style) continue;
          regeln.push({ sel: regel.selectorText, stil: regel.style, theme: eigen });
        }
      }
    })(document.styleSheets, null);

    /* `rgba(…, 0)` und `transparent`: keine Flaeche, kein Beitrag, keine Ursache. */
    function durchsichtig(css) {
      var t = (css || "").replace(/\s+/g, "");
      return t === "" || t === "transparent" || /,0\)$/.test(t);
    }

    /* AUCH DIE KURZSCHREIBWEISE FRAGEN, und das ist kein Feinschliff, sondern
       der Unterschied zwischen „funktioniert" und „findet nie etwas": Steht in
       einer Regel `background: var(--avd-academy-color-bg-subtle)`, kann CSSOM
       die Kurzschreibweise NICHT zerlegen - eine Kurzform mit `var()` bleibt ein
       unaufgeloester Wert, und `getPropertyValue("background-color")` gibt den
       Leerstring zurueck. Das Theme schreibt seine Flaechen fast durchweg so.
       Ohne diese Liste fand die Herkunftssuche zu keinem Hintergrund eine Regel,
       jeder Befund galt als „nicht feststellbar" und damit als einer des
       Projekts. */
    var KURZFORM = {
      "background-color": ["background-color", "background"],
      "color": ["color"]
    };

    function setzt(stil, eigenschaft) {
      var namen = KURZFORM[eigenschaft] || [eigenschaft];
      for (var i = 0; i < namen.length; i++) {
        if (stil.getPropertyValue(namen[i])) return true;
      }
      return false;
    }

    /* VERERBTE EIGENSCHAFTEN OBEN WEITERSUCHEN. `color` wird vererbt: Ein
       `<code>` in einem Verweis hat meist gar keine eigene Farbregel, es traegt
       die des `<a>`. Wer nur das Element fragt, findet nichts und landet bei
       „nicht feststellbar" - also beim Projekt. `background-color` wird NICHT
       vererbt; dort waere Weitersuchen schlicht falsch. */
    var VERERBT = { "color": true };

    function herkunft(el, eigenschaft) {
      if (VERERBT[eigenschaft]) {
        var n = el;
        while (n && n.nodeType === 1) {
          var q = herkunft_eigen(n, eigenschaft);
          if (q !== "unbekannt") return q;
          n = n.parentElement;
        }
        return "unbekannt";
      }
      return herkunft_eigen(el, eigenschaft);
    }

    function herkunft_eigen(el, eigenschaft) {
      if (!el) return "unbekannt";
      if (el.style && setzt(el.style, eigenschaft)) return "projekt";
      var gefunden = false, blind = false;
      for (var i = 0; i < regeln.length; i++) {
        var r = regeln[i];
        if (r.blind) { blind = true; continue; }
        if (!setzt(r.stil, eigenschaft)) continue;
        var passt = false;
        try { passt = el.matches(r.sel); } catch (e) { continue; }
        if (!passt) continue;
        if (!r.theme) return "projekt";
        gefunden = true;
      }
      if (gefunden) return "theme";
      return blind ? "unbekannt" : "unbekannt";
    }

    /* Die wirksame Flaeche ist das, was der Browser tatsaechlich zeigt: der
       erste DECKENDE Grund im Baum, und darauf alle durchscheinenden Schichten
       darueber - von aussen nach innen aufgetragen. Einfach zum deckenden
       Vorfahren durchzugreifen waere falsch: Eine helle 45-%-Tintung ueber
       dunklem Grund ergibt eine mitteldunkle Flaeche, und genau darauf steht
       der Text. */
    function flaeche(el) {
      var n = el, bild = false, grund = [255, 255, 255], schichten = [], traeger = [];
      while (n && n.nodeType === 1) {
        var cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== "none") bild = true;
        var g = px(cs.backgroundColor);
        /* JEDE SCHICHT, DIE ETWAS BEITRAEGT, zaehlt zur Ursache - nicht nur der
           deckende Grund: Eine durchscheinende Tintung des Projekts ueber einer
           Theme-Flaeche macht die wirksame Farbe zur Sache des Projekts.

           VOLLSTAENDIG DURCHSICHTIGE ELEMENTE GEHOEREN NICHT DAZU, und das ist
           kein Feinschliff: Zwischen einem Text und seiner Flaeche liegen
           typischerweise vier, fuenf Elemente ohne jede Hintergrundangabe -
           `p`, `main`, ein paar `div`. Fuer sie findet die Herkunftssuche keine
           Regel, weil es keine gibt; „nicht feststellbar" zaehlt wie Projekt,
           und damit waere JEDER Befund einer des Projekts. Genau daran ist die
           erste Fassung an der eigenen Doku-Site gescheitert. */
        if (!durchsichtig(cs.backgroundColor)) traeger.push(n);
        if (g.deckend) { grund = g.farbe; break; }
        schichten.push(cs.backgroundColor);
        n = n.parentElement;
      }
      ctx.fillStyle = "rgb(" + grund[0] + "," + grund[1] + "," + grund[2] + ")";
      ctx.fillRect(0, 0, 1, 1);
      for (var i = schichten.length - 1; i >= 0; i--) {
        ctx.fillStyle = schichten[i]; ctx.fillRect(0, 0, 1, 1);
      }
      var d = ctx.getImageData(0, 0, 1, 1).data;
      return { farbe: [d[0], d[1], d[2]], bild: bild, traeger: traeger };
    }

    /* Die Signatur ist die CSS-HERKUNFT, nicht das Element: Aus einer Regel
       sollen nicht 61 Zeilen werden. Zwei Ebenen, weil ein blankes `span` sonst
       Unterschiedliches zusammenwirft. */
    function kennung(el) {
      function teil(e) {
        if (!e || e.nodeType !== 1) return "";
        var k = (typeof e.className === "string" ? e.className : "").trim();
        return e.tagName.toLowerCase() + (k ? "." + k.split(/\s+/).slice(0, 3).join(".") : "");
      }
      var eltern = teil(el.parentElement);
      return (eltern ? eltern + " > " : "") + teil(el);
    }

    /* IST DAS THEME UEBERHAUPT ANGEKOMMEN? Diese Frage steht VOR jeder Messung.
       Laedt das Stylesheet nicht - falsche Basisadresse, flach entpacktes
       Artefakt, umbenannter Ordner -, steht im Browser nacktes HTML. Darauf
       traegt fast jede Paarung, weil es nur noch Schwarz auf Weiss gibt: Der
       Lauf meldet „keine Paarung unter der Schwelle" und hat nichts geprueft.
       Dasselbe Ruestzeug hat `a11y.mjs` schon; hier fehlte es. */
    var themeGrund = getComputedStyle(document.documentElement)
      .getPropertyValue("--avd-academy-color-bg").trim();

    var befunde = [], uebersprungen = { bild: 0, transparent: 0, unsichtbar: 0 };
    var betrachtet = 0;
    var alle = document.querySelectorAll("body *");
    for (var i = 0; i < alle.length; i++) {
      var el = alle[i];
      var eigen = "";
      for (var j = 0; j < el.childNodes.length; j++) {
        var k = el.childNodes[j];
        if (k.nodeType === 3 && k.textContent.trim().length > 1) eigen += k.textContent.trim() + " ";
      }
      if (!eigen) continue;
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") { uebersprungen.unsichtbar++; continue; }
      if (parseFloat(cs.opacity) < 0.6) { uebersprungen.unsichtbar++; continue; }
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) { uebersprungen.unsichtbar++; continue; }
      var vgm = px(cs.color);
      if (!vgm.deckend) { uebersprungen.transparent++; continue; }
      var fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400;
      if (!fs) { uebersprungen.unsichtbar++; continue; }
      var f = flaeche(el);
      if (f.bild) { uebersprungen.bild++; continue; }
      betrachtet++;
      var gross = fs >= 24 || (fs >= 18.66 && fw >= 700);
      var noetig = gross ? 3.0 : 4.5;
      var vg = vgm.farbe;
      var wert = ratio(vg, f.farbe);
      if (wert + 0.005 < noetig) {
        /* Die Herkunft wird NUR fuer Befunde bestimmt. Ueber alle Elemente
           gerechnet waere es eine Regelsuche je Element; so sind es ein paar
           je Seite. */
        var q = herkunft(el, "color");
        if (q === "theme") {
          for (var t = 0; t < f.traeger.length && q === "theme"; t++) {
            var qt = herkunft(f.traeger[t], "background-color");
            if (qt !== "theme") q = qt;
          }
        }
        befunde.push({
          sig: kennung(el), fg: hex(vg), bg: hex(f.farbe),
          wert: Math.round(wert * 100) / 100, noetig: noetig,
          fs: Math.round(fs * 10) / 10, text: eigen.trim().slice(0, 48),
          quelle: q
        });
      }
    }
    var pre = document.createElement("pre");
    pre.id = "__contrast";
    pre.textContent = JSON.stringify({
      befunde: befunde, uebersprungen: uebersprungen,
      betrachtet: betrachtet, theme: themeGrund
    });
    document.body.appendChild(pre);
  })();
JS

# ---------------------------------------------------------------------------
# Sondenseiten anlegen: jede Seite zweimal, je Farbschema fest verdrahtet
# ---------------------------------------------------------------------------
SCHEMES = %w[light dark].freeze

# `--ignore` wie bei `links.rb`: Die WERKSTATT des Fundaments liegt als gebaute
# Seite im `_site` (u. a. „ATVANTAGE Homepage.html“, 1,3 MB, rendert sich per
# JS-Bundle nach). Sie ist weder Teil des Pakets noch von uns geschrieben, und der
# Browser kommt dort nie zur Ruhe. Ausgenommen wird sie ausdruecklich im Aufruf,
# nicht still im Skript - wer den Makefile-Eintrag liest, sieht es.
# --- Eine Schreibweise für Ausschlussmuster ----------------------------------
#
# DERSELBE BLOCK STEHT IN `links.rb` UND `components.rb`. Drei Werkzeuge, die
# über dieselbe Angabe verschieden urteilen, sind schlimmer als eines – wer hier
# etwas ändert, ändert es dort mit.
#
# `theme`, `/theme`, `theme/`, `/theme/` und `/theme/**` meinen DASSELBE. Wer
# `links` und `contrast` nebeneinander aufruft, soll nicht zweimal nachdenken
# müssen, und wer ein Muster hinschreibt, soll nicht raten, ob der Schrägstrich
# zählt.
#
# VERGLICHEN WIRD SEGMENTWEISE, nicht als roher Präfix. Der Unterschied ist kein
# Feinschliff: `path.start_with?("/theme")` trifft auch `/themes-overview/` –
# eine Seite, die niemand ausnehmen wollte, und sie fiele still aus der Prüfung.
# Gleichzeitig muss eine Adresse, die GENAU `/theme` ist, getroffen werden.
# Deshalb: Gleichheit ODER Präfix samt trennendem Schrägstrich.
#
# LEERE ANGABEN FALLEN WEG. Ein leeres Muster wurde sonst zu `/`, und weil jeder
# Pfad damit anfängt, war anschliessend alles ausgenommen – der Lauf meldete
# „keine einzige gebaute Seite“ und sah aus wie ein kaputtes Bundle.
def normalize_patterns(patterns)
  Array(patterns).compact.map { |p| p.to_s.strip }.reject(&:empty?).map do |p|
    p = p.sub(%r{/\*\*\z}, '')
    p = p.sub(%r{/+\z}, '')
    p = "/#{p}" unless p.start_with?('/')
    p
  end.reject { |p| p == '/' }.uniq
end

def ignored?(path, ignore)
  ignore.any? { |p| path == p || path.start_with?("#{p}/") }
end

# WAS DIE MESSUNG ANSIEHT - zwei Listen, eine Regel. `only` leer: alles ist
# erfasst. `only` gesetzt: erfasst ist nur, was darauf passt. `ignore` nimmt in
# beiden Faellen danach noch heraus - ein Ausschluss schlaegt einen Einschluss,
# sonst entschiede die Reihenfolge der Angaben, welche von beiden gilt.
# Wortgleich in links.rb und components.rb.
Scope = Struct.new(:only, :ignore) do
  def skips?(path)
    return true unless only.empty? || ignored?(path, only)

    ignored?(path, ignore)
  end
end

# KOPIERVORLAGEN BLEIBEN DRAUSSEN. Eine eigenständige Vorlage trägt statt Pfaden
# den Platzhalter `«BASISPFAD»` – sie lädt also weder Stylesheet noch Skript und
# ist erst dann eine Seite, wenn jemand sie kopiert und den Platzhalter ersetzt.
# Gemessen ergäbe sie nacktes HTML und liefe damit in den Wächter für „ohne
# Theme-CSS". Erkannt wird sie am Platzhalter IN einem Verweis – eine Doku-Seite,
# die ihn nur im Beispielcode zeigt, ist eine gewöhnliche Seite. Dasselbe
# Kriterium steht in `a11y.mjs`.
TEMPLATE_MARKER = /(?:href|src)="[^"]*«BASISPFAD»/.freeze

def write_probe_pages(site, work, scope, templates = [])
  FileUtils.cp_r(File.join(site, '.'), work)
  produced = []
  Dir.glob(File.join(work, '**', '*.html')).sort.each do |file|
    raw = begin
      File.read(file, encoding: 'UTF-8')
    rescue StandardError
      next
    end
    next unless raw =~ /<html[\s>]/i
    next if File.basename(file).start_with?('__probe-')
    next if scope.skips?(file.sub(work, ''))

    if raw =~ TEMPLATE_MARKER
      templates << file.sub(work, '').sub(%r{\A/}, '')
      next
    end

    SCHEMES.each do |scheme|
      content = raw.sub(/<html\b([^>]*)>/i) do
        attr = Regexp.last_match(1).gsub(/\s*data-avd-academy-theme="[^"]*"/, '')
        %(<html#{attr} data-avd-academy-theme="#{scheme}">)
      end
      script = "<script>#{PROBE}</script>"
      # Vor das LETZTE `</body>`, nicht vor das erste. Eine Seite darf `</body>`
      # im Text fuehren - etwa ein HTML-Codebeispiel in einem JavaScript-String.
      # Vor dem ersten eingefuegt landet die Sonde in diesem String, laeuft nie,
      # und die Seite wird STILL uebersprungen. Gefunden an einer echten
      # Visualisierung, gemeldet von der eigenen "Sonde ohne Antwort"-Warnung.
      place = content.rindex('</body>')
      content = if place
                 content[0...place] + script + content[place..]
               else
                 content + script
               end
      target = File.join(File.dirname(file), "__probe-#{scheme}-#{File.basename(file)}")
      File.write(target, content, encoding: 'UTF-8')
      produced << [target.sub(work, ''), scheme, File.basename(file)]
    end
  end
  produced
end

# ---------------------------------------------------------------------------
# Messen
# ---------------------------------------------------------------------------
Finding = Struct.new(:sig, :fg, :bg, :value, :required, :fs, :text, :scheme, :page,
                     :source)
# EIN BROWSER FUER ALLE SEITEN, nicht einer je Seite.
#
# Bis hierher rief diese Stelle `chrome --headless --dump-dom «url»` auf - einmal
# je Seite UND Farbschema. Gemessen an der eigenen Doku-Site: 74 Seiten x 2
# Schemata = 148 Chrome-Kaltstarts, acht davon parallel, jeder mit bis zu fuenf
# Sekunden `--virtual-time-budget`. Macht 5 Minuten 20.
#
# Die Barrierefreiheitsmessung daneben kommt mit EINEM Browser aus, misst mit 296
# Kombinationen doppelt so viel und braucht 6 Minuten 30 - pro Messung also etwa
# die Haelfte, obwohl sie mit axe-core die deutlich schwerere Arbeit tut. Der
# Unterschied war nie die Messung, sondern der Prozessstart.
#
# DIE ARBEITSTEILUNG BLEIBT: Ruby baut die Sondenseiten, bedient den Server und
# wertet aus; der Browser-Teil liegt in `contrast.mjs` neben `a11y.mjs`, und beide
# teilen sich denselben DevTools-Klienten (`browser.mjs`). Eine zweite Fassung
# dieser Mechanik in Ruby haette einen WebSocket-Klienten gebraucht - also ein Gem,
# und damit genau die Installation, die diese Werkzeuge vermeiden.
#
# DER PREIS IST NODE. Fehlt es, steigt der Lauf SICHTBAR aus, statt eine leere
# Messung als sauberen Lauf auszugeben - dieselbe Regel wie beim fehlenden Browser.
def measure(browser, port, pages, jobs, deadline, base = '')
  findings = []
  skipped = Hash.new(0)
  quiet = []
  without_theme = []
  considered = 0

  # Die Sondenseiten liegen je Schema unter eigenem Namen; die Zuordnung zurueck
  # auf Quelldatei und Schema steht hier, nicht im Node-Teil - der soll nichts
  # ueber Farbschemata wissen muessen.
  # DER PFAD MUSS KODIERT SEIN. Das Fundament bringt Dateien mit Leerzeichen mit
  # („ATVANTAGE Homepage.html"). Unkodiert bricht die Adresse, der Browser liefert
  # nichts zurueck, und die Seite waere ungeprueft durchgerutscht - gemeldet hat das
  # seinerzeit die eigene „Sonde ohne Antwort"-Warnung. Der Node-Teil bekommt und
  # meldet deshalb die KODIERTE Form; die Zuordnung zurueck steht hier.
  by_path = {}
  pages.each { |rel, scheme, source| by_path[encode_path(rel)] = [scheme, source] }

  driver = File.join(__dir__, 'contrast.mjs')
  command = ['node', driver, '--chrome', browser, '--base', "http://127.0.0.1:#{port}#{base}",
             '--jobs', jobs.to_s, '--timeout', deadline.to_s]
  output = IO.popen(command, 'r+', err: File::NULL) do |io|
    io.write(by_path.keys.join("\n"))
    io.close_write
    io.read
  end

  output.to_s.each_line do |line|
    line = line.strip
    next if line.empty?

    answer = begin
      JSON.parse(line)
    rescue StandardError
      next
    end
    scheme, source = by_path[answer['path']]
    next if scheme.nil?

    raw = answer['probe'].to_s
    if raw.empty?
      quiet << [source, scheme]
      next
    end
    data = begin
      JSON.parse(raw)
    rescue StandardError
      quiet << [source, scheme]
      next
    end
    # OHNE THEME KEINE MESSUNG. Die Seite wird nicht halb ausgewertet, sondern
    # benannt und ausgelassen - ihre Zahlen waeren die einer anderen Seite.
    if data['theme'].to_s.empty?
      without_theme << [source, scheme]
      next
    end
    considered += data['betrachtet'].to_i
    data['uebersprungen'].each { |k, v| skipped[k] += v }
    data['befunde'].each do |b|
      findings << Finding.new(b['sig'], b['fg'], b['bg'], b['wert'], b['noetig'],
                              b['fs'], b['text'], scheme, source,
                              # `unbekannt` wird wie `projekt` behandelt - siehe
                              # die Begruendung im Messskript.
                              b['quelle'] == 'theme' ? :theme : :project)
    end
  end

  # EINE SEITE, ZU DER NICHTS ZURUECKKAM, IST NICHT GEMESSEN. Ohne diese Zeile
  # faenden sich solche Seiten in keiner Liste wieder - der Bericht saehe aus, als
  # waeren sie sauber.
  # `filter_map` gibt es erst ab Ruby 2.7 - die System-Ruby eines Rechners ist oft
  # aelter, und dieses Werkzeug soll auch dort laufen.
  beantwortet = []
  output.to_s.each_line do |l|
    begin
      beantwortet << JSON.parse(l)['path']
    rescue StandardError
      nil
    end
  end
  (by_path.keys - beantwortet).each do |rel|
    scheme, source = by_path[rel]
    quiet << [source, scheme]
  end

  [findings, skipped, quiet, without_theme, considered]
end

# ---------------------------------------------------------------------------
# Ausnahmeliste – mit BEGRÜNDUNGSPFLICHT
#
# Eine Zeile: `<Signatur><TAB><Begründung>`. Ohne Begründung ist der Eintrag ein
# Fehler, nicht eine stille Ausnahme – dieselbe Haltung wie beim Markup Contract.
# ---------------------------------------------------------------------------
def read_exceptions(path)
  return [{}, []] if path.nil?
  return [{}, ["Ausnahmeliste #{path} gibt es nicht."]] unless File.file?(path)

  entries = {}
  errors = []
  File.readlines(path, encoding: 'UTF-8').each_with_index do |line, nr|
    z = line.rstrip
    next if z.strip.empty? || z.strip.start_with?('#')

    sig, reason = z.split("\t", 2)
    if reason.nil? || reason.strip.empty?
      errors << "#{path}:#{nr + 1}: „#{sig}“ ohne Begründung – ein Eintrag ohne Grund ist keiner."
      next
    end
    entries[sig.strip] = reason.strip
  end
  [entries, errors]
end

# ---------------------------------------------------------------------------
# Bericht
# ---------------------------------------------------------------------------
def report(findings, skipped, quiet, exceptions, page_count, without_theme = [], considered = 0, templates = [])
  # WESSEN BEFUND IST DAS? Eine Paarung, deren beide Farben allein aus
  # Stylesheets unter `/theme/` kommen, gehoert dem Theme - und das prueft seinen
  # Token-Satz vor jedem Release selbst. Beim Verbraucher ist so ein Befund nicht
  # behebbar; er bleibt im Bericht, aber er zaehlt nicht.
  #
  # DIE TRENNUNG STEHT HIER UND NICHT IN EINER OPTION. Ein Schalter waere eine
  # Entscheidung, die jeder Aufrufer treffen muesste, und die Antwort waere
  # ueberall dieselbe. Im Theme-Repo selbst aendert sich dadurch nichts, was
  # verloren ginge: Verbindlich ist dort `bin/contrast-pairs.sh`, das die
  # zugesagten Token-Paare nachrechnet; dieser Lauf berichtet ohnehin nur.
  theme_caused = findings.select { |f| f.source == :theme }
  findings = findings.reject { |f| f.source == :theme }

  groups = findings.group_by(&:sig)
  open = groups.reject { |sig, _| exceptions.key?(sig) }
  covered = groups.select { |sig, _| exceptions.key?(sig) }

  puts
  puts "Kontrast: #{page_count} Seite(n) × #{SCHEMES.size} Farbschemata gemessen (WCAG 2.1)."
  # DIE BEZUGSGROESSE GEHOERT IN DEN BERICHT. Ohne sie liest sich ein Lauf ueber
  # vier Elemente genauso wie einer ueber hundertsechs - und beide melden
  # „keine Paarung unter der Schwelle".
  puts "Betrachtet: #{considered} Element(e) mit eigenem Text."
  unless templates.empty?
    puts "Nicht gemessen, weil Kopiervorlage (Platzhalter statt Pfaden): " \
         "#{templates.size} – #{templates.first(3).join(', ')}#{templates.size > 3 ? ' …' : ''}"
  end

  # EIN LAUF UEBER NICHTS IST KEIN ERFOLG. Steht hier etwas, hat die Prueferei
  # eine Seite ohne Theme-CSS vor sich gehabt - nacktes HTML, auf dem fast jede
  # Paarung traegt, weil es nur noch Schwarz auf Weiss gibt.
  unless without_theme.empty?
    puts
    puts "FEHLER: #{without_theme.size} Seitenansicht(en) OHNE Theme-CSS gemessen - das Ergebnis"
    puts '        dieser Seiten ist wertlos, nicht sauber. Ursache ist fast immer ein'
    puts '        Basispfad: Eine mit `--baseurl /docs` gebaute Site verweist absolut auf'
    puts '        `/docs/theme/...`. Dann fehlt hier `--baseurl /docs`.'
    without_theme.first(10).each { |source, scheme| puts "  #{source} (#{scheme})" }
    puts "  … und #{without_theme.size - 10} weitere." if without_theme.size > 10
  end

  if open.empty?
    puts 'Keine Paarung unter der Schwelle.'
  else
    puts
    puts 'BEFUNDE: Schrift, die auf ihrer Fläche nicht trägt. Der Build wird davon'
    puts '         nicht rot – sichtbar wird es erst dem, der die Seite liest.'
    # DIE SIGNATUR IST DER ZWEITE SCHLUESSEL, und das ist kein Schoenheitsfehler:
    # Ohne sie entschied bei gleichem Verhaeltnis die Reihenfolge der Messung -
    # also, welche Seite zufaellig zuerst fertig war. Zwei Laeufe ueber dieselbe
    # Site lieferten denselben Inhalt in anderer Ordnung, und ein Diff zwischen
    # zwei Berichten zeigte Bewegung, wo keine war. Dasselbe gilt fuer die drei
    # genannten Seiten: sortiert, nicht „die ersten drei, die ankamen".
    open.sort_by { |sig, v| [v.map(&:value).min, sig] }.each do |sig, entries|
      worst = entries.min_by(&:value)
      schemes = entries.map(&:scheme).uniq.sort.join('+')
      puts
      puts "  #{sig}"
      puts format('    %<value>.2f:1 (nötig %<required>.1f:1) · %<n>d Stelle(n) · %<s>s',
                  value: worst.value, required: worst.required,
                  n: entries.size, s: schemes)
      puts "    #{worst.fg} auf #{worst.bg} · #{worst.fs}px · „#{worst.text}“"
      puts "    zuerst auf: #{entries.map(&:page).uniq.sort.first(3).join(', ')}"
    end
  end

  # NICHT STILL UEBERGANGEN, sondern benannt: Wer das Theme pflegt, liest hier,
  # was seine Sache ist - und wer es nur benutzt, sieht, dass es nicht seine ist.
  unless theme_caused.empty?
    groups_theme = theme_caused.group_by(&:sig)
    puts
    puts "WARNUNG: #{groups_theme.size} Paarung(en) mit Ursache im THEME – beide Farben kommen"
    puts '         allein aus Stylesheets unter `/theme/`. Sie zählen hier nicht: Den'
    puts '         Token-Satz prüft das Theme vor jedem Release selbst, und in diesem'
    puts '         Projekt lässt sich daran nichts ändern.'
    groups_theme.sort_by { |sig, v| [v.map(&:value).min, sig] }.first(10).each do |sig, entries|
      worst = entries.min_by(&:value)
      puts format('  %<sig>s · %<value>.2f:1 (nötig %<required>.1f:1) · %<n>d Stelle(n)',
                  sig: sig, value: worst.value, required: worst.required, n: entries.size)
    end
    puts "  … und #{groups_theme.size - 10} weitere." if groups_theme.size > 10
  end

  unless covered.empty?
    puts
    puts "Von der Ausnahmeliste gedeckt (#{covered.size}):"
    covered.each { |sig, entries| puts "  #{sig} – #{exceptions[sig]} (#{entries.size})" }
  end

  # Kein stilles Auslassen: Was nicht messbar war, steht im Bericht.
  total = skipped.values.sum
  if total.positive?
    puts
    puts "Nicht messbar und deshalb übergangen: #{total} Element(e) – " \
         "#{skipped['bild']} über Bild/Verlauf, " \
         "#{skipped['transparent']} mit halbdurchsichtiger Schrift, " \
         "#{skipped['unsichtbar']} nicht sichtbar gerendert."
  end

  unless quiet.empty?
    puts
    puts "WARNUNG: #{quiet.size} Sonde(n) ohne Antwort – diese Seiten sind NICHT geprüft:"
    quiet.first(10).each { |source, scheme| puts "  #{source} (#{scheme})" }
  end

  [open, quiet, without_theme]
end

# ---------------------------------------------------------------------------
# Lauf
# ---------------------------------------------------------------------------
def run(site, browser, jobs, exceptions, deadline, scope, base = '')
  Dir.mktmpdir('academy-contrast') do |tmp|
    work = File.join(tmp, 'site')
    FileUtils.mkdir_p(work)
    templates = []
    pages = write_probe_pages(site, work, scope, templates)
    server, thread, port = start_server(work, base)
    begin
      findings, skipped, quiet, without_theme, considered =
        measure(browser, port, pages, jobs, deadline, base)
    ensure
      server.close
      thread.kill
    end
    report(findings, skipped, quiet, exceptions,
              pages.size / SCHEMES.size, without_theme, considered, templates)
  end
end

# ---------------------------------------------------------------------------
# Selbsttest
#
# Aus demselben Grund wie bei `links.rb`: Im eigenen Repo trägt nach jeder
# Korrektur wieder jedes Paar – die interessanten Fälle entstehen dort gar nicht.
# Hier steht deshalb eine Site, in der jeder Befund einmal vorkommt UND jeder
# Fall, der KEINER sein darf.
# ---------------------------------------------------------------------------
# Ein Stylesheet UNTER `/theme/`. Es traegt die Regeln, deren Befunde dem Theme
# gehoeren - und ohne eine solche Datei koennte der Selbsttest die Zuordnung gar
# nicht pruefen: Ein `<style>` im Dokument ist immer das Projekt.
SELF_TEST_THEME_CSS = <<~'CSS'
  :root { --pruef-flaeche: #ffffff; }
  .vomtheme { background: #ffffff; color: #f0f0f0; }
  .gemischt { background: #ffffff; }
  /* KURZSCHREIBWEISE MIT `var()`, und der Fall ist der Grund fuer diese Zeile:
     CSSOM kann eine Kurzform mit `var()` nicht zerlegen - `background-color`
     gibt dann den Leerstring zurueck. Das Theme schreibt seine Flaechen fast
     durchweg so. Ohne den Fall ginge eine Herkunftssuche durch, die zu keinem
     Hintergrund je eine Regel findet. */
  .varflaeche { background: var(--pruef-flaeche); color: #f0f0f0; }
  /* VERERBUNG: Das `code` darin bekommt seine Flaeche, aber KEINE eigene Farbe -
     die traegt der Vorfahr. Wer nur das Element fragt, findet nichts. */
  .erbe { background: #ffffff; color: #f0f0f0; }
  .erbe code { background: var(--pruef-flaeche); }
CSS

SELF_TEST_PAGE = <<~'HTML'
  <html lang="de"><head><link rel="stylesheet" href="theme/pruef.css"><style>
    /* Der Nachweis, dass das Theme angekommen ist. Ohne ihn gilt die Seite als
       ungemessen - und genau dieser Fall wird weiter unten eigens geprueft. */
    :root { --avd-academy-color-bg: #ffffff; }
    body { background: #ffffff; color: #111111; }
    :root[data-avd-academy-theme="dark"] body { background: #101010; color: #eeeeee; }
    /* MUSS ein Befund sein: feste Flaeche, kippende Schrift. */
    .fest { background: #ffffff; }
    /* MUSS ein Befund sein, aber NUR im Light-Theme: im Dark-Theme kippen
       Schrift und Flaeche gemeinsam und tragen wieder. Ohne diesen Fall wuerde
       der Selbsttest nicht bemerken, wenn die Prueferei ein Schema verschluckt. */
    .nurhell { background: #ffffff; color: #8a8a8a; }
    :root[data-avd-academy-theme="dark"] .nurhell { background: #101010; color: #eeeeee; }
    /* KEIN Befund: traegt in beiden Schemata. */
    .heil { background: #ffffff; color: #222222; }
    /* KEIN Befund: 3,5:1 traegt als GROSSER Text (Schwelle 3:1), als Kleintext
       waere es einer. Prueft die Groessenregel, nicht den Rechenweg. */
    .gross { background: #ffffff; color: #8a8a8a; font-size: 32px; font-weight: 400; }
    /* KEIN Befund: bewusst gedaempft (disabled). */
    .gedaempft { background: #ffffff; color: #111111; opacity: 0.4; }
    /* KEIN Befund, aber ZU ZAEHLEN: Verlauf darunter. */
    .verlauf { background-image: linear-gradient(90deg, #fff, #000); color: #808080; }
    /* KEIN Befund, aber ZU ZAEHLEN: halbdurchsichtige Schrift. */
    .durchsichtig { background: #ffffff; color: rgba(17,17,17,0.5); }
    /* KEIN Befund: nicht gerendert. */
    .weg { display: none; color: #f4f4f4; background: #ffffff; }
    /* KEIN Befund: eine DURCHSCHEINENDE Flaeche ist nicht die wirksame Flaeche -
       wirksam ist das Weiss darunter. Solange die Deckkraft per Regex auf
       `rgba(…)` geraten wurde, galt diese Mischung als deckend und wurde ueber
       Schwarz gemessen; aus #ededed wurde #6B6B6B und der Text ein Fehlalarm.
       Genau dieser Fall hat in einem Schulungs-Repo sechs Gruppen erfunden. */
    .durchscheinend { background: color-mix(in oklab, #ededed 45%, transparent); }
    /* Nur die SCHRIFT, die Flaeche kommt aus theme/pruef.css. */
    .gemischt { color: #f0f0f0; }
    :root[data-avd-academy-theme="dark"] .durchscheinend { background: color-mix(in oklab, #2a2a2a 45%, transparent); }
  </style></head><body>
    <p class="fest">feste Flaeche, kippende Schrift</p>
    <p class="nurhell">nur im Light-Theme zu schwach</p>
    <p class="heil">traegt ueberall</p>
    <p class="gross">grosser Text</p>
    <p class="gedaempft">deaktiviert</p>
    <p class="verlauf">ueber einem Verlauf</p>
    <p class="durchsichtig">halbdurchsichtig</p>
    <p class="weg">nicht gerendert</p>
    <p class="durchscheinend">durchscheinende Flaeche ueber Weiss</p>
    <!-- HERKUNFT. Beide Paarungen traegen NICHT - der Unterschied ist, WO ihre
         Regel steht. `.vomtheme` kommt aus theme/pruef.css, `.gemischt` aus
         demselben Stylesheet, bekommt seine Schrift aber aus dem `<style>` oben,
         also aus dem Projekt. -->
    <p class="vomtheme">Farbe allein aus dem Theme</p>
    <p class="gemischt">Flaeche aus dem Theme, Schrift aus dem Projekt</p>
    <p class="varflaeche">Flaeche aus dem Theme, als Kurzform mit var()</p>
    <p class="erbe">Vorfahr faerbt: <code>geerbte Farbe ohne eigene Regel</code></p>
    <!-- Eine Seite darf `</body>` im TEXT fuehren. Steht die Sonde vor dem ersten
         statt vor dem letzten, landet sie in diesem String und laeuft nie - die
         Seite waere dann still ungeprueft. -->
    <script>var beispiel = "<html><body><h1>Hallo</h1></body></html>";</script>
  </body></html>
HTML

# Die zweite Testsite prueft den blinden Fleck selbst: Sie laedt ihr Theme-Token
# aus einer Datei, die WURZEL-ABSOLUT unter einem Basispfad liegt - genau wie eine
# mit `jekyll build --baseurl /docs` gebaute Site. Flach serviert findet der
# Browser sie nicht; mit `--baseurl /docs` schon.
SELF_TEST_BASEURL_CSS = <<~'CSS'
  :root { --avd-academy-color-bg: #ffffff; }
  body { background: #ffffff; color: #111111; }
  .schwach { background: #ffffff; color: #b9b9b9; }
CSS

SELF_TEST_BASEURL_PAGE = <<~'HTML'
  <html lang="de"><head>
    <link rel="stylesheet" href="/docs/assets/tokens.css">
  </head><body>
    <p class="schwach">zu schwach, aber nur zu sehen, wenn das Stylesheet ankommt</p>
  </body></html>
HTML

def self_test(browser, jobs, deadline)
  errors = []
  Dir.mktmpdir('academy-contrast-test') do |tmp|
    site = File.join(tmp, '_site')
    FileUtils.mkdir_p(site)
    File.write(File.join(site, 'index.html'), SELF_TEST_PAGE, encoding: 'UTF-8')
    FileUtils.mkdir_p(File.join(site, 'theme'))
    File.write(File.join(site, 'theme', 'pruef.css'), SELF_TEST_THEME_CSS, encoding: 'UTF-8')

    work = File.join(tmp, 'work')
    FileUtils.mkdir_p(work)
    pages = write_probe_pages(site, work, Scope.new([], []))
    server, thread, port = start_server(work)
    begin
      findings, skipped, quiet, without_theme, considered =
        measure(browser, port, pages, jobs, deadline)
    ensure
      server.close
      thread.kill
    end

    errors << "#{quiet.size} Sonde(n) ohne Antwort." unless quiet.empty?
    errors << "#{without_theme.size} Seite(n) faelschlich als ohne Theme-CSS gemeldet." unless without_theme.empty?
    errors << 'Es wurde kein einziges Element betrachtet.' if considered.to_i.zero?

    classes = findings.map { |b| b.sig[/\.([a-z]+)\z/, 1] }.compact
    per = classes.each_with_object(Hash.new(0)) { |k, h| h[k] += 1 }

    # .fest muss in GENAU EINEM Schema auffallen (dark: helle Schrift auf Weiss).
    dark = findings.select { |b| b.scheme == 'dark' }.map { |b| b.sig }
    errors << '.fest wurde im Dark-Theme nicht gefunden.' unless dark.any? { |s| s.end_with?('.fest') }
    light = findings.select { |b| b.scheme == 'light' }.map { |b| b.sig }
    errors << '.nurhell wurde im Light-Theme nicht gefunden.' unless light.any? { |s| s.end_with?('.nurhell') }
    # Gegenprobe: derselbe Prueflint traegt im Dark-Theme und darf dort NICHT auffallen.
    if dark.any? { |s| s.end_with?('.nurhell') }
      errors << '.nurhell wurde faelschlich auch im Dark-Theme gemeldet.'
    end
    # Und andersherum, sonst faende der Test ein vertauschtes Schema nicht.
    if light.any? { |s| s.end_with?('.fest') }
      errors << '.fest wurde faelschlich auch im Light-Theme gemeldet.'
    end

    %w[heil gross gedaempft verlauf durchsichtig weg durchscheinend].each do |k|
      errors << "„.#{k}“ ist faelschlich ein Befund (#{per[k]}x)." if per[k].to_i.positive?
    end

    # HERKUNFT. `.vomtheme` bekommt beide Farben aus `/theme/pruef.css` und
    # gehoert damit dem Theme; `.gemischt` steht auf derselben Flaeche, holt
    # seine Schrift aber aus dem `<style>` der Seite - eine Projektregel im
    # Spiel, also ein Befund des Projekts. Ohne den zweiten Fall wuerde eine
    # Prueferei durchgehen, die einfach alles dem Theme zuschlaegt.
    von_theme = findings.select { |b| b.source == :theme }.map(&:sig)
    vom_projekt = findings.select { |b| b.source == :project }.map(&:sig)
    unless von_theme.any? { |x| x.end_with?('.vomtheme') }
      errors << '.vomtheme wurde nicht dem Theme zugeordnet.'
    end
    if vom_projekt.any? { |x| x.end_with?('.vomtheme') }
      errors << '.vomtheme gilt faelschlich als Befund des Projekts.'
    end
    unless vom_projekt.any? { |x| x.end_with?('.gemischt') }
      errors << '.gemischt wurde nicht dem Projekt zugeordnet – eine Projektregel war im Spiel.'
    end
    unless von_theme.any? { |x| x.end_with?('.varflaeche') }
      errors << '.varflaeche wurde nicht dem Theme zugeordnet – die Kurzschreibweise ' \
                'mit var() wurde nicht gelesen.'
    end
    unless von_theme.any? { |x| x.end_with?('> code') }
      errors << 'Das geerbte `code` wurde nicht dem Theme zugeordnet – die Vererbung ' \
                'von `color` wurde nicht verfolgt.'
    end
    # Und die Wirkung: Was dem Theme gehoert, steht nicht in `open`.
    offen, = report(findings, skipped, quiet, {}, pages.size / SCHEMES.size, without_theme, considered)
    if offen.keys.any? { |x| x.end_with?('.vomtheme') }
      errors << '.vomtheme zaehlt trotz Theme-Ursache als offener Befund.'
    end
    unless offen.keys.any? { |x| x.end_with?('.gemischt') }
      errors << '.gemischt fehlt unter den offenen Befunden.'
    end

    errors << 'Der Verlauf wurde nicht als unmessbar gezaehlt.' unless skipped['bild'].to_i.positive?
    if skipped['transparent'].to_i.zero?
      errors << 'Halbdurchsichtige Schrift wurde nicht als unmessbar gezaehlt.'
    end
    errors << 'Nicht gerenderter Text wurde nicht gezaehlt.' if skipped['unsichtbar'].to_i.zero?
  end

  # ---- Der blinde Fleck: Seite mit Basispfad, einmal ohne und einmal mit ----
  # OHNE diesen Teil faende der Selbsttest den Fehler nicht, um dessentwillen es
  # ihn gibt: Im eigenen Repo wird ohne Basispfad gebaut, also entsteht der Fall
  # hier nie von selbst - dieselbe Blindheit wie bei `links.rb` vor 2.5.1.
  Dir.mktmpdir('academy-contrast-baseurl') do |tmp|
    site = File.join(tmp, '_site')
    FileUtils.mkdir_p(File.join(site, 'assets'))
    File.write(File.join(site, 'index.html'), SELF_TEST_BASEURL_PAGE, encoding: 'UTF-8')
    File.write(File.join(site, 'assets', 'tokens.css'), SELF_TEST_BASEURL_CSS, encoding: 'UTF-8')

    ['', '/docs'].each do |base|
      work = File.join(tmp, "work#{base.empty? ? '-flach' : '-basis'}")
      FileUtils.mkdir_p(work)
      pages = write_probe_pages(site, work, Scope.new([], []))
      server, thread, port = start_server(work, base)
      begin
        findings, _u, _s, without_theme, = measure(browser, port, pages, jobs, deadline, base)
      ensure
        server.close
        thread.kill
      end

      if base.empty?
        # Das ist der gemeldete Zustand: Das Stylesheet kommt nicht an, die Seite
        # ist nacktes HTML - und der Lauf darf sie NICHT als sauber durchwinken.
        if without_theme.empty?
          errors << 'Eine Seite ohne Theme-CSS wurde nicht als ungemessen erkannt.'
        end
        unless findings.empty?
          errors << 'Aus einer Seite ohne Theme-CSS wurden Befunde gemeldet.'
        end
      else
        unless without_theme.empty?
          errors << '--baseurl bringt das Stylesheet nicht an die Seite.'
        end
        unless findings.any? { |b| b.sig.end_with?('.schwach') }
          errors << 'Mit --baseurl wurde der eingebaute Befund nicht gefunden.'
        end
      end
    end
  end

  errors
end

# ---------------------------------------------------------------------------
# Aufruf
# ---------------------------------------------------------------------------
def main
  site = '_site'
  base = ''
  browser_default = nil
  jobs = 8
  deadline = 30
  ignore = []
  only = []
  exceptions_file = nil
  require_site = false
  require_browser = false
  strict = false
  own = false

  args = ARGV.dup
  until args.empty?
    a = args.shift
    case a
    when '--site' then site = args.shift
    when '--baseurl' then base = args.shift
    when '--browser' then browser_default = args.shift
    when '--jobs' then jobs = args.shift.to_i
    when '--timeout' then deadline = args.shift.to_i
    # LEERE ANGABE FAELLT WEG: Ein leerer Praefix trifft JEDEN Pfad, und dann waere
    # alles ausgenommen - siehe die Begruendung in links.rb.
    when '--ignore' then ignore << args.shift.to_s
    when '--include' then only << args.shift.to_s
    when '--allow' then exceptions_file = args.shift
    when '--require-site' then require_site = true
    when '--require-browser' then require_browser = true
    when '--strict' then strict = true
    when '--self-test' then own = true
    when '--help', '-h'
      puts File.read(__FILE__)[/^# ---.*?^# ---/m].to_s.gsub(/^# ?/, '')
      exit 0
    else
      warn "Unbekannte Option: #{a}"
      exit 2
    end
  end

  # NODE IST SEIT DER CDP-FASSUNG VORAUSSETZUNG. Es fehlte vorher nicht, weil jede
  # Seite einen eigenen Chrome-Prozess bekam; jetzt fuehrt `contrast.mjs` einen
  # einzigen Browser. Fehlt Node, wird das GESAGT - eine leere Messung, die als
  # sauberer Lauf durchgeht, ist der Fehler, gegen den dieses Werkzeug gebaut ist.
  unless system('node', '--version', out: File::NULL, err: File::NULL)
    hint = 'Node (22+) fehlt – die Kontrastprüfung wird übersprungen. ' \
           'Sie steuert einen Browser über theme/jekyll/contrast.mjs.'
    if require_browser
      warn "FEHLER: #{hint}"
      exit 1
    end
    puts hint
    exit 0
  end

  browser = find_browser(browser_default)
  if browser.nil?
    hint = 'Kein Chrome/Chromium gefunden – die Kontrastprüfung wird übersprungen. ' \
              'Pfad über --browser oder die Umgebungsvariable CHROME angeben.'
    if require_browser
      warn "FEHLER: #{hint}"
      exit 1
    end
    puts hint
    exit 0
  end

  if own
    errors = self_test(browser, jobs, deadline)
    if errors.empty?
      puts 'Selbsttest der Kontrastprüfung bestanden (jeder Befund und jeder Nicht-Befund einmal).'
      exit 0
    end
    warn 'Selbsttest FEHLGESCHLAGEN:'
    errors.each { |f| warn "  #{f}" }
    exit 1
  end

  # EINE SCHREIBWEISE, wie in `links.rb`: fuehrender Schraegstrich, keiner am Ende.
  # `/docs`, `docs`, `/docs/` meinen dasselbe, und wer beide Pruefer nebeneinander
  # aufruft, soll nicht zweimal nachdenken muessen.
  base = base.to_s.strip
  base = '/' + base unless base.empty? || base.start_with?('/')
  base = base.sub(%r{/+\z}, '')

  exceptions, exceptions_error = read_exceptions(exceptions_file)
  unless exceptions_error.empty?
    exceptions_error.each { |f| warn "FEHLER: #{f}" }
    exit 1
  end

  unless Dir.exist?(site)
    hint = "#{site}/ gibt es nicht – erst bauen, dann prüfen (`make build`)."
    if require_site
      warn "FEHLER: #{hint}"
      exit 1
    end
    puts "Übersprungen: #{hint}"
    exit 0
  end

  scope = Scope.new(normalize_patterns(only), normalize_patterns(ignore))
  open, quiet, without_theme = run(site, browser, jobs, exceptions, deadline, scope, base)
  # EIGENER RUECKGABEWERT, UND ZWAR UNABHAENGIG VON `--strict`. Ein Befund ist eine
  # inhaltliche Entscheidung und darf eine Warnung bleiben; eine Seite ohne
  # Theme-CSS ist gar keine Messung. Wer beides auf 1 abbildete, koennte es im
  # Aufrufer nicht auseinanderhalten - und genau dort wird `--strict` abgewogen.
  exit 2 unless without_theme.empty?
  exit 1 if strict && (!open.empty? || !quiet.empty?)
  exit 0
end

main if $PROGRAM_NAME == __FILE__
