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
AA_GROSS = 3.0

# ---------------------------------------------------------------------------
# Browser finden
# ---------------------------------------------------------------------------
BROWSER_PFADE = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium'
].freeze

def browser_finden(vorgabe)
  kandidaten = [vorgabe, ENV['CHROME'], *BROWSER_PFADE].compact
  kandidaten.find { |p| File.executable?(p) } ||
    kandidaten.find { |p| !p.include?('/') && system("command -v #{p} >/dev/null 2>&1") }
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
TYPEN = {
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
def server_starten(wurzel, basis = '')
  server = TCPServer.new('127.0.0.1', 0)
  port = server.addr[1]
  faden = Thread.new do
    loop do
      sitzung = begin
        server.accept
      rescue StandardError
        break
      end
      Thread.new(sitzung) { |s| anfrage_bedienen(s, wurzel, basis) }
    end
  end
  [server, faden, port]
end

def antwort_404(sitzung)
  sitzung.print("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
  sitzung.close
  nil
end

def anfrage_bedienen(sitzung, wurzel, basis = '')
  # Ein einzelner hängender Socket darf den ganzen Lauf nicht anhalten.
  sitzung.timeout = 5 if sitzung.respond_to?(:timeout=)
  zeile = sitzung.gets
  return sitzung.close if zeile.nil?

  # Kopfzeilen bis zur Leerzeile verwerfen – GENAU EIN gets je Durchlauf.
  while (kopf = sitzung.gets)
    break if kopf.strip.empty?
  end
  pfad = zeile.split(' ')[1].to_s.split('?').first.to_s
  # Der Basispfad wird abgezogen, nicht ignoriert: Eine Anfrage AUSSERHALB von ihm
  # geht auch in der Auslieferung ins Leere und muss hier ebenso 404 bekommen -
  # sonst faende die Messung Dateien, die es spaeter nicht gibt.
  unless basis.empty?
    return antwort_404(sitzung) unless pfad == basis || pfad.start_with?(basis + '/')

    pfad = pfad[basis.length..].to_s
    pfad = '/' if pfad.empty?
  end
  pfad = '/index.html' if pfad == '/'
  pfad += 'index.html' if pfad.end_with?('/')
  datei = File.join(wurzel, URI_entschluesseln(pfad))
  # Ausbruch aus dem Wurzelverzeichnis ist keine Anfrage, sondern ein Fehler.
  if !File.file?(datei) || !File.expand_path(datei).start_with?(File.expand_path(wurzel))
    sitzung.print("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
  else
    inhalt = File.binread(datei)
    typ = TYPEN[File.extname(datei).downcase] || 'application/octet-stream'
    sitzung.print("HTTP/1.1 200 OK\r\nContent-Type: #{typ}\r\n" \
                  "Content-Length: #{inhalt.bytesize}\r\nConnection: close\r\n\r\n")
    sitzung.write(inhalt)
  end
rescue StandardError
  nil
ensure
  begin
    sitzung.close
  rescue StandardError
    nil
  end
end

# Nur die Zeichen kodieren, die eine Adresse zerlegen – die Schraegstriche bleiben.
def pfad_kodieren(pfad)
  pfad.split('/', -1).map { |t| t.gsub(/[^A-Za-z0-9\-_.~!$&'()*+,;=:@]/) { |z| format('%%%02X', z.ord) } }.join('/')
end

def URI_entschluesseln(pfad)
  pfad.gsub(/%([0-9A-Fa-f]{2})/) { [Regexp.last_match(1)].pack('H2') }
end

# ---------------------------------------------------------------------------
# Die Sonde – läuft IM Browser, in jeder Seite, je Farbschema einmal
#
# Sie liefert genau die Paare, die unter der Schwelle liegen. Gruppiert wird erst
# hier in Ruby; der Browser soll nur messen.
# ---------------------------------------------------------------------------
SONDE = <<~'JS'
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
    /* Die wirksame Flaeche ist das, was der Browser tatsaechlich zeigt: der
       erste DECKENDE Grund im Baum, und darauf alle durchscheinenden Schichten
       darueber - von aussen nach innen aufgetragen. Einfach zum deckenden
       Vorfahren durchzugreifen waere falsch: Eine helle 45-%-Tintung ueber
       dunklem Grund ergibt eine mitteldunkle Flaeche, und genau darauf steht
       der Text. */
    function flaeche(el) {
      var n = el, bild = false, grund = [255, 255, 255], schichten = [];
      while (n && n.nodeType === 1) {
        var cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== "none") bild = true;
        var g = px(cs.backgroundColor);
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
      return { farbe: [d[0], d[1], d[2]], bild: bild };
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
        befunde.push({
          sig: kennung(el), fg: hex(vg), bg: hex(f.farbe),
          wert: Math.round(wert * 100) / 100, noetig: noetig,
          fs: Math.round(fs * 10) / 10, text: eigen.trim().slice(0, 48)
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
SCHEMATA = %w[light dark].freeze

# `--ignore` wie bei `links.rb`: Die WERKSTATT des Fundaments liegt als gebaute
# Seite im `_site` (u. a. „ATVANTAGE Homepage.html“, 1,3 MB, rendert sich per
# JS-Bundle nach). Sie ist weder Teil des Pakets noch von uns geschrieben, und der
# Browser kommt dort nie zur Ruhe. Ausgenommen wird sie ausdruecklich im Aufruf,
# nicht still im Skript - wer den Makefile-Eintrag liest, sieht es.
def ignoriert?(pfad, ignorieren)
  ignorieren.any? { |p| pfad == p || pfad.start_with?(p) }
end

# KOPIERVORLAGEN BLEIBEN DRAUSSEN. Eine eigenständige Vorlage trägt statt Pfaden
# den Platzhalter `«BASISPFAD»` – sie lädt also weder Stylesheet noch Skript und
# ist erst dann eine Seite, wenn jemand sie kopiert und den Platzhalter ersetzt.
# Gemessen ergäbe sie nacktes HTML und liefe damit in den Wächter für „ohne
# Theme-CSS". Erkannt wird sie am Platzhalter IN einem Verweis – eine Doku-Seite,
# die ihn nur im Beispielcode zeigt, ist eine gewöhnliche Seite. Dasselbe
# Kriterium steht in `a11y.mjs`.
VORLAGENMARKE = /(?:href|src)="[^"]*«BASISPFAD»/.freeze

def sondenseiten_anlegen(site, arbeit, ignorieren, vorlagen = [])
  FileUtils.cp_r(File.join(site, '.'), arbeit)
  gemacht = []
  Dir.glob(File.join(arbeit, '**', '*.html')).sort.each do |datei|
    roh = begin
      File.read(datei, encoding: 'UTF-8')
    rescue StandardError
      next
    end
    next unless roh =~ /<html[\s>]/i
    next if File.basename(datei).start_with?('__probe-')
    next if ignoriert?(datei.sub(arbeit, ''), ignorieren)

    if roh =~ VORLAGENMARKE
      vorlagen << datei.sub(arbeit, '').sub(%r{\A/}, '')
      next
    end

    SCHEMATA.each do |schema|
      inhalt = roh.sub(/<html\b([^>]*)>/i) do
        attr = Regexp.last_match(1).gsub(/\s*data-avd-academy-theme="[^"]*"/, '')
        %(<html#{attr} data-avd-academy-theme="#{schema}">)
      end
      skript = "<script>#{SONDE}</script>"
      # Vor das LETZTE `</body>`, nicht vor das erste. Eine Seite darf `</body>`
      # im Text fuehren - etwa ein HTML-Codebeispiel in einem JavaScript-String.
      # Vor dem ersten eingefuegt landet die Sonde in diesem String, laeuft nie,
      # und die Seite wird STILL uebersprungen. Gefunden an einer echten
      # Visualisierung, gemeldet von der eigenen "Sonde ohne Antwort"-Warnung.
      stelle = inhalt.rindex('</body>')
      inhalt = if stelle
                 inhalt[0...stelle] + skript + inhalt[stelle..]
               else
                 inhalt + skript
               end
      ziel = File.join(File.dirname(datei), "__probe-#{schema}-#{File.basename(datei)}")
      File.write(ziel, inhalt, encoding: 'UTF-8')
      gemacht << [ziel.sub(arbeit, ''), schema, File.basename(datei)]
    end
  end
  gemacht
end

# ---------------------------------------------------------------------------
# Messen
# ---------------------------------------------------------------------------
Befund = Struct.new(:sig, :fg, :bg, :wert, :noetig, :fs, :text, :schema, :seite)

# KEIN eigenes `--user-data-dir`.
#
# Naheliegend wäre ein Wegwerf-Profil, damit die Prüfung das Profil des Nutzers
# nicht anfasst. Auf macOS blockiert ein FRISCHES Profil den Start aber dauerhaft –
# gemessen: 2 Sekunden ohne, über zwei Minuten ohne Ende mit, auch mit
# `--no-first-run` und `--use-mock-keychain`. Chrome wartet dort auf etwas, das
# headless niemand wegklicken kann. `--headless` legt ohnehin keine Sitzung an und
# schreibt nichts ins Profil, das bliebe.
#
# Stattdessen eine ZEITSCHRANKE je Seite: Eine Seite, die nicht antwortet, wird
# abgebrochen und als ungeprüft GEMELDET. Ohne sie hält ein einziger hängender
# Aufruf den ganzen Lauf an – genau das ist beim Bauen dieses Werkzeugs passiert.
def mit_zeitschranke(befehl, frist)
  lesen, schreiben = IO.pipe
  pid = Process.spawn(befehl, out: schreiben, err: File::NULL)
  schreiben.close
  ausgabe = +''
  wache = Thread.new do
    sleep frist
    begin
      Process.kill('KILL', pid)
    rescue StandardError
      nil
    end
  end
  begin
    ausgabe = lesen.read
  rescue StandardError
    nil
  end
  Process.wait(pid)
  wache.kill
  ausgabe
rescue StandardError
  ''
ensure
  begin
    lesen.close
  rescue StandardError
    nil
  end
end

def messen(browser, port, seiten, jobs, frist, basis = '')
  warteschlange = seiten.dup
  schloss = Mutex.new
  befunde = []
  uebersprungen = Hash.new(0)
  stumm = []
  ohne_theme = []
  betrachtet = 0

  faeden = Array.new([jobs, 1].max) do
    Thread.new do
      loop do
        auftrag = schloss.synchronize { warteschlange.shift }
        break if auftrag.nil?

        rel, schema, quelle = auftrag
        # Der Pfad muss kodiert werden: Das Fundament bringt Dateien mit Leerzeichen
        # mit („ATVANTAGE Homepage.html“). Unkodiert bricht die Adresse, der Browser
        # liefert nichts zurueck, und die Seite waere ungeprueft durchgerutscht -
        # gemeldet hat das die eigene „Sonde ohne Antwort“-Warnung.
        befehl = "#{browser.inspect} --headless --disable-gpu --no-sandbox " \
                 '--window-size=1400,1000 --virtual-time-budget=5000 ' \
                 "--dump-dom \"http://127.0.0.1:#{port}#{basis}#{pfad_kodieren(rel)}\" 2>/dev/null"
        ausgabe = mit_zeitschranke(befehl, frist)
        # `--dump-dom` liefert HTML, nicht Text: `>` steht dort als `&gt;`, und die
        # Signaturen enthalten `>` als Trenner. Ohne das Zurückschreiben landet die
        # Maskierung im Bericht – und schlimmer, ein `&` im Text bricht das JSON.
        roh = ausgabe[%r{<pre id="__contrast">(.*?)</pre>}m, 1]
        roh = roh.gsub('&lt;', '<').gsub('&gt;', '>').gsub('&quot;', '"').gsub('&amp;', '&') if roh
        if roh.nil?
          schloss.synchronize { stumm << [quelle, schema] }
          next
        end
        daten = begin
          JSON.parse(roh)
        rescue StandardError
          schloss.synchronize { stumm << [quelle, schema] }
          next
        end
        # OHNE THEME KEINE MESSUNG. Die Seite wird nicht halb ausgewertet, sondern
        # benannt und ausgelassen - ihre Zahlen waeren die einer anderen Seite.
        if daten['theme'].to_s.empty?
          schloss.synchronize { ohne_theme << [quelle, schema] }
          next
        end
        schloss.synchronize do
          betrachtet += daten['betrachtet'].to_i
          daten['uebersprungen'].each { |k, v| uebersprungen[k] += v }
          daten['befunde'].each do |b|
            befunde << Befund.new(b['sig'], b['fg'], b['bg'], b['wert'], b['noetig'],
                                  b['fs'], b['text'], schema, quelle)
          end
        end
      end
    end
  end
  faeden.each(&:join)
  [befunde, uebersprungen, stumm, ohne_theme, betrachtet]
end

# ---------------------------------------------------------------------------
# Ausnahmeliste – mit BEGRÜNDUNGSPFLICHT
#
# Eine Zeile: `<Signatur><TAB><Begründung>`. Ohne Begründung ist der Eintrag ein
# Fehler, nicht eine stille Ausnahme – dieselbe Haltung wie beim Markup Contract.
# ---------------------------------------------------------------------------
def ausnahmen_lesen(pfad)
  return [{}, []] if pfad.nil?
  return [{}, ["Ausnahmeliste #{pfad} gibt es nicht."]] unless File.file?(pfad)

  eintraege = {}
  fehler = []
  File.readlines(pfad, encoding: 'UTF-8').each_with_index do |zeile, nr|
    z = zeile.rstrip
    next if z.strip.empty? || z.strip.start_with?('#')

    sig, grund = z.split("\t", 2)
    if grund.nil? || grund.strip.empty?
      fehler << "#{pfad}:#{nr + 1}: „#{sig}“ ohne Begründung – ein Eintrag ohne Grund ist keiner."
      next
    end
    eintraege[sig.strip] = grund.strip
  end
  [eintraege, fehler]
end

# ---------------------------------------------------------------------------
# Bericht
# ---------------------------------------------------------------------------
def berichten(befunde, uebersprungen, stumm, ausnahmen, seitenzahl, ohne_theme = [], betrachtet = 0, vorlagen = [])
  gruppen = befunde.group_by(&:sig)
  offen = gruppen.reject { |sig, _| ausnahmen.key?(sig) }
  gedeckt = gruppen.select { |sig, _| ausnahmen.key?(sig) }

  puts
  puts "Kontrast: #{seitenzahl} Seite(n) × #{SCHEMATA.size} Farbschemata gemessen (WCAG 2.1)."
  # DIE BEZUGSGROESSE GEHOERT IN DEN BERICHT. Ohne sie liest sich ein Lauf ueber
  # vier Elemente genauso wie einer ueber hundertsechs - und beide melden
  # „keine Paarung unter der Schwelle".
  puts "Betrachtet: #{betrachtet} Element(e) mit eigenem Text."
  unless vorlagen.empty?
    puts "Nicht gemessen, weil Kopiervorlage (Platzhalter statt Pfaden): " \
         "#{vorlagen.size} – #{vorlagen.first(3).join(', ')}#{vorlagen.size > 3 ? ' …' : ''}"
  end

  # EIN LAUF UEBER NICHTS IST KEIN ERFOLG. Steht hier etwas, hat die Prueferei
  # eine Seite ohne Theme-CSS vor sich gehabt - nacktes HTML, auf dem fast jede
  # Paarung traegt, weil es nur noch Schwarz auf Weiss gibt.
  unless ohne_theme.empty?
    puts
    puts "FEHLER: #{ohne_theme.size} Seitenansicht(en) OHNE Theme-CSS gemessen - das Ergebnis"
    puts '        dieser Seiten ist wertlos, nicht sauber. Ursache ist fast immer ein'
    puts '        Basispfad: Eine mit `--baseurl /docs` gebaute Site verweist absolut auf'
    puts '        `/docs/theme/...`. Dann fehlt hier `--baseurl /docs`.'
    ohne_theme.first(10).each { |quelle, schema| puts "  #{quelle} (#{schema})" }
    puts "  … und #{ohne_theme.size - 10} weitere." if ohne_theme.size > 10
  end

  if offen.empty?
    puts 'Keine Paarung unter der Schwelle.'
  else
    puts
    puts 'BEFUNDE: Schrift, die auf ihrer Fläche nicht trägt. Der Build wird davon'
    puts '         nicht rot – sichtbar wird es erst dem, der die Seite liest.'
    offen.sort_by { |_, v| v.map(&:wert).min }.each do |sig, liste|
      schlimmster = liste.min_by(&:wert)
      schemata = liste.map(&:schema).uniq.sort.join('+')
      puts
      puts "  #{sig}"
      puts format('    %<wert>.2f:1 (nötig %<noetig>.1f:1) · %<n>d Stelle(n) · %<s>s',
                  wert: schlimmster.wert, noetig: schlimmster.noetig,
                  n: liste.size, s: schemata)
      puts "    #{schlimmster.fg} auf #{schlimmster.bg} · #{schlimmster.fs}px · „#{schlimmster.text}“"
      puts "    zuerst auf: #{liste.map(&:seite).uniq.first(3).join(', ')}"
    end
  end

  unless gedeckt.empty?
    puts
    puts "Von der Ausnahmeliste gedeckt (#{gedeckt.size}):"
    gedeckt.each { |sig, liste| puts "  #{sig} – #{ausnahmen[sig]} (#{liste.size})" }
  end

  # Kein stilles Auslassen: Was nicht messbar war, steht im Bericht.
  summe = uebersprungen.values.sum
  if summe.positive?
    puts
    puts "Nicht messbar und deshalb übergangen: #{summe} Element(e) – " \
         "#{uebersprungen['bild']} über Bild/Verlauf, " \
         "#{uebersprungen['transparent']} mit halbdurchsichtiger Schrift, " \
         "#{uebersprungen['unsichtbar']} nicht sichtbar gerendert."
  end

  unless stumm.empty?
    puts
    puts "WARNUNG: #{stumm.size} Sonde(n) ohne Antwort – diese Seiten sind NICHT geprüft:"
    stumm.first(10).each { |quelle, schema| puts "  #{quelle} (#{schema})" }
  end

  [offen, stumm, ohne_theme]
end

# ---------------------------------------------------------------------------
# Lauf
# ---------------------------------------------------------------------------
def lauf(site, browser, jobs, ausnahmen, frist, ignorieren, basis = '')
  Dir.mktmpdir('academy-contrast') do |tmp|
    arbeit = File.join(tmp, 'site')
    FileUtils.mkdir_p(arbeit)
    vorlagen = []
    seiten = sondenseiten_anlegen(site, arbeit, ignorieren, vorlagen)
    server, faden, port = server_starten(arbeit, basis)
    begin
      befunde, uebersprungen, stumm, ohne_theme, betrachtet =
        messen(browser, port, seiten, jobs, frist, basis)
    ensure
      server.close
      faden.kill
    end
    berichten(befunde, uebersprungen, stumm, ausnahmen,
              seiten.size / SCHEMATA.size, ohne_theme, betrachtet, vorlagen)
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
SELBSTTEST_SEITE = <<~'HTML'
  <html lang="de"><head><style>
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
SELBSTTEST_BASEURL_CSS = <<~'CSS'
  :root { --avd-academy-color-bg: #ffffff; }
  body { background: #ffffff; color: #111111; }
  .schwach { background: #ffffff; color: #b9b9b9; }
CSS

SELBSTTEST_BASEURL_SEITE = <<~'HTML'
  <html lang="de"><head>
    <link rel="stylesheet" href="/docs/assets/tokens.css">
  </head><body>
    <p class="schwach">zu schwach, aber nur zu sehen, wenn das Stylesheet ankommt</p>
  </body></html>
HTML

def selbsttest(browser, jobs, frist)
  fehler = []
  Dir.mktmpdir('academy-contrast-test') do |tmp|
    site = File.join(tmp, '_site')
    FileUtils.mkdir_p(site)
    File.write(File.join(site, 'index.html'), SELBSTTEST_SEITE, encoding: 'UTF-8')

    arbeit = File.join(tmp, 'work')
    FileUtils.mkdir_p(arbeit)
    seiten = sondenseiten_anlegen(site, arbeit, [])
    server, faden, port = server_starten(arbeit)
    begin
      befunde, uebersprungen, stumm, ohne_theme, betrachtet =
        messen(browser, port, seiten, jobs, frist)
    ensure
      server.close
      faden.kill
    end

    fehler << "#{stumm.size} Sonde(n) ohne Antwort." unless stumm.empty?
    fehler << "#{ohne_theme.size} Seite(n) faelschlich als ohne Theme-CSS gemeldet." unless ohne_theme.empty?
    fehler << 'Es wurde kein einziges Element betrachtet.' if betrachtet.to_i.zero?

    klassen = befunde.map { |b| b.sig[/\.([a-z]+)\z/, 1] }.compact
    je = klassen.each_with_object(Hash.new(0)) { |k, h| h[k] += 1 }

    # .fest muss in GENAU EINEM Schema auffallen (dark: helle Schrift auf Weiss).
    dunkel = befunde.select { |b| b.schema == 'dark' }.map { |b| b.sig }
    fehler << '.fest wurde im Dark-Theme nicht gefunden.' unless dunkel.any? { |s| s.end_with?('.fest') }
    hell = befunde.select { |b| b.schema == 'light' }.map { |b| b.sig }
    fehler << '.nurhell wurde im Light-Theme nicht gefunden.' unless hell.any? { |s| s.end_with?('.nurhell') }
    # Gegenprobe: derselbe Prueflint traegt im Dark-Theme und darf dort NICHT auffallen.
    if dunkel.any? { |s| s.end_with?('.nurhell') }
      fehler << '.nurhell wurde faelschlich auch im Dark-Theme gemeldet.'
    end
    # Und andersherum, sonst faende der Test ein vertauschtes Schema nicht.
    if hell.any? { |s| s.end_with?('.fest') }
      fehler << '.fest wurde faelschlich auch im Light-Theme gemeldet.'
    end

    %w[heil gross gedaempft verlauf durchsichtig weg durchscheinend].each do |k|
      fehler << "„.#{k}“ ist faelschlich ein Befund (#{je[k]}x)." if je[k].to_i.positive?
    end

    fehler << 'Der Verlauf wurde nicht als unmessbar gezaehlt.' unless uebersprungen['bild'].to_i.positive?
    if uebersprungen['transparent'].to_i.zero?
      fehler << 'Halbdurchsichtige Schrift wurde nicht als unmessbar gezaehlt.'
    end
    fehler << 'Nicht gerenderter Text wurde nicht gezaehlt.' if uebersprungen['unsichtbar'].to_i.zero?
  end

  # ---- Der blinde Fleck: Seite mit Basispfad, einmal ohne und einmal mit ----
  # OHNE diesen Teil faende der Selbsttest den Fehler nicht, um dessentwillen es
  # ihn gibt: Im eigenen Repo wird ohne Basispfad gebaut, also entsteht der Fall
  # hier nie von selbst - dieselbe Blindheit wie bei `links.rb` vor 2.5.1.
  Dir.mktmpdir('academy-contrast-baseurl') do |tmp|
    site = File.join(tmp, '_site')
    FileUtils.mkdir_p(File.join(site, 'assets'))
    File.write(File.join(site, 'index.html'), SELBSTTEST_BASEURL_SEITE, encoding: 'UTF-8')
    File.write(File.join(site, 'assets', 'tokens.css'), SELBSTTEST_BASEURL_CSS, encoding: 'UTF-8')

    ['', '/docs'].each do |basis|
      arbeit = File.join(tmp, "work#{basis.empty? ? '-flach' : '-basis'}")
      FileUtils.mkdir_p(arbeit)
      seiten = sondenseiten_anlegen(site, arbeit, [])
      server, faden, port = server_starten(arbeit, basis)
      begin
        befunde, _u, _s, ohne_theme, = messen(browser, port, seiten, jobs, frist, basis)
      ensure
        server.close
        faden.kill
      end

      if basis.empty?
        # Das ist der gemeldete Zustand: Das Stylesheet kommt nicht an, die Seite
        # ist nacktes HTML - und der Lauf darf sie NICHT als sauber durchwinken.
        if ohne_theme.empty?
          fehler << 'Eine Seite ohne Theme-CSS wurde nicht als ungemessen erkannt.'
        end
        unless befunde.empty?
          fehler << 'Aus einer Seite ohne Theme-CSS wurden Befunde gemeldet.'
        end
      else
        unless ohne_theme.empty?
          fehler << '--baseurl bringt das Stylesheet nicht an die Seite.'
        end
        unless befunde.any? { |b| b.sig.end_with?('.schwach') }
          fehler << 'Mit --baseurl wurde der eingebaute Befund nicht gefunden.'
        end
      end
    end
  end

  fehler
end

# ---------------------------------------------------------------------------
# Aufruf
# ---------------------------------------------------------------------------
def main
  site = '_site'
  basis = ''
  browser_vorgabe = nil
  jobs = 8
  frist = 30
  ignorieren = []
  ausnahmedatei = nil
  require_site = false
  require_browser = false
  strict = false
  selbst = false

  args = ARGV.dup
  until args.empty?
    a = args.shift
    case a
    when '--site' then site = args.shift
    when '--baseurl' then basis = args.shift
    when '--browser' then browser_vorgabe = args.shift
    when '--jobs' then jobs = args.shift.to_i
    when '--timeout' then frist = args.shift.to_i
    when '--ignore' then ignorieren << args.shift
    when '--allow' then ausnahmedatei = args.shift
    when '--require-site' then require_site = true
    when '--require-browser' then require_browser = true
    when '--strict' then strict = true
    when '--self-test' then selbst = true
    when '--help', '-h'
      puts File.read(__FILE__)[/^# ---.*?^# ---/m].to_s.gsub(/^# ?/, '')
      exit 0
    else
      warn "Unbekannte Option: #{a}"
      exit 2
    end
  end

  browser = browser_finden(browser_vorgabe)
  if browser.nil?
    hinweis = 'Kein Chrome/Chromium gefunden – die Kontrastprüfung wird übersprungen. ' \
              'Pfad über --browser oder die Umgebungsvariable CHROME angeben.'
    if require_browser
      warn "FEHLER: #{hinweis}"
      exit 1
    end
    puts hinweis
    exit 0
  end

  if selbst
    fehler = selbsttest(browser, jobs, frist)
    if fehler.empty?
      puts 'Selbsttest der Kontrastprüfung bestanden (jeder Befund und jeder Nicht-Befund einmal).'
      exit 0
    end
    warn 'Selbsttest FEHLGESCHLAGEN:'
    fehler.each { |f| warn "  #{f}" }
    exit 1
  end

  # EINE SCHREIBWEISE, wie in `links.rb`: fuehrender Schraegstrich, keiner am Ende.
  # `/docs`, `docs`, `/docs/` meinen dasselbe, und wer beide Pruefer nebeneinander
  # aufruft, soll nicht zweimal nachdenken muessen.
  basis = basis.to_s.strip
  basis = '/' + basis unless basis.empty? || basis.start_with?('/')
  basis = basis.sub(%r{/+\z}, '')

  ausnahmen, ausnahmefehler = ausnahmen_lesen(ausnahmedatei)
  unless ausnahmefehler.empty?
    ausnahmefehler.each { |f| warn "FEHLER: #{f}" }
    exit 1
  end

  unless Dir.exist?(site)
    hinweis = "#{site}/ gibt es nicht – erst bauen, dann prüfen (`make build`)."
    if require_site
      warn "FEHLER: #{hinweis}"
      exit 1
    end
    puts "Übersprungen: #{hinweis}"
    exit 0
  end

  offen, stumm, ohne_theme = lauf(site, browser, jobs, ausnahmen, frist, ignorieren, basis)
  # EIGENER RUECKGABEWERT, UND ZWAR UNABHAENGIG VON `--strict`. Ein Befund ist eine
  # inhaltliche Entscheidung und darf eine Warnung bleiben; eine Seite ohne
  # Theme-CSS ist gar keine Messung. Wer beides auf 1 abbildete, koennte es im
  # Aufrufer nicht auseinanderhalten - und genau dort wird `--strict` abgewogen.
  exit 2 unless ohne_theme.empty?
  exit 1 if strict && (!offen.empty? || !stumm.empty?)
  exit 0
end

main if $PROGRAM_NAME == __FILE__
