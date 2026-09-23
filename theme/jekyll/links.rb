#!/usr/bin/env ruby
# =============================================================================
# Interne Verweise im gebauten HTML – zeigt ein Link ins Leere?
#
#   ruby theme/jekyll/links.rb                       # Befunde ausgeben
#   ruby theme/jekyll/links.rb --site _site --baseurl /mein-repo
#   ruby theme/jekyll/links.rb --ignore /schemas/    # von der Anwendung bedient
#   ruby theme/jekyll/links.rb --require-site        # ohne _site/ scheitern
#   ruby theme/jekyll/links.rb --self-test           # nur die Prüfung selbst prüfen
#
# WOFÜR: Ein Verweis ins Leere ist für Jekyll KEIN Baufehler. Die Seite entsteht, der
# Link ist tot, und es fällt erst beim Klicken auf – oft Wochen später und meist einem
# Leser, nicht dem Autor. Genau so stand in einem Consumer-Repo ein `resources`-Eintrag
# wurzel-absolut auf `/konzepte/authentifizierung.html`, während im Wurzelbaum Englisch
# liegt: Die Seite gab es dort nie.
#
# GEPRÜFT WIRD GEGEN DAS GEBAUTE `_site`, nicht gegen die Quellen – aus demselben
# Grund wie bei js-hooks.sh und html-attributes.sh, hier aber noch zwingender: Verweise
# entstehen an FÜNF verschiedenen Stellen und sehen in der Quelle jedes Mal anders aus.
#
#     Fließtext              `](../a/b.md)`            (Markdown)
#     resources              `url:` im Front Matter    (YAML, andere Stelle)
#     Kopf-/Fußnavigation    `nav.items[].page|url`    (_config.yml)
#     Sprachkarten           `url: { de: …, en: … }`   (wieder anders)
#     Brotkrumen             `breadcrumb.ancestors[]`  (wieder anders)
#
# Ein Prüfer über die Quellen kennt immer nur einige davon und hat deshalb ein Loch –
# ausgerechnet dort, wo der echte tote Verweis stand. Im gebauten HTML steht am Ende
# überall dasselbe: ein `<a href="…">`. Eine Prüfung, ein Ort, keine vergessene Quelle.
#
# DREI BEFUNDE, und der dritte ist der interessante:
#
#   1. ZIEL FEHLT – das `href` trifft im `_site` keine Datei. `/a/b.html` muss
#      `_site/a/b.html` sein, `/a/` muss `_site/a/index.html` sein. Ein Ordner OHNE
#      `index.html` ist auf GitHub Pages ein 404, kein Verzeichnislisting.
#
#   2. ANKER FEHLT – `#kapitel` trifft auf der Zielseite keine `id`. Geprüft wird das
#      im GEBAUTEN HTML, weil kramdown den Slug dort schon erzeugt hat. Wer ihn
#      stattdessen aus der Überschrift NACHBAUT, trifft die Umlautregel falsch und
#      meldet `#löschen` als tot, obwohl kramdown den Umlaut behält – ein Fehlalarm,
#      der die ganze Prüfung unglaubwürdig macht.
#
#   3. SPRACHBAUM GEWECHSELT – die Zielseite ist in einer anderen Sprache als die
#      Seite, auf der der Verweis steht, UND es gibt sie in der Sprache der Seite.
#      Der Leser wechselt unbemerkt die Sprache, obwohl die richtige Fassung existiert.
#      In einer einsprachigen Site kann dieser Befund gar nicht entstehen.
#
#      DIE ZUGEHÖRIGKEIT KOMMT AUS DEM GEBAUTEN HTML, nicht aus einer Pfadregel:
#      `<html lang>` nennt die Sprache jeder Seite, die `<link rel="alternate">` im
#      Kopf nennen ihre Fassungen. Damit ist der Befund kein Verdacht, sondern trägt
#      die Adresse der richtigen Seite gleich mit.
#
#      EIN VERWEIS MIT `hreflang` IST ABSICHT und wird übergangen. Genau so beschriftet
#      das Theme einen Verweis, dessen Ziel in einer anderen Sprache liegt
#      (avd-link-target.html) – und genau so schreibt ein Autor einen bewussten
#      Sprachwechsel hin. Ohne diese Ausnahme meldete die Prüfung den Sprachumschalter.
#
# NUR `<a href>`, und zwar bewusst: Ein fehlendes Stylesheet, Bild oder Skript bricht
# SICHTBAR – die Seite steht ungestylt da, das Bild fehlt im Layout. Ein toter Verweis
# ist die einzige Art von fehlender Datei, die man einer Seite nicht ansieht. Wer die
# Assets mitprüfen will, prüft etwas anderes und sollte es getrennt tun.
#
# NUR VOLLSTÄNDIGE DOKUMENTE werden als Quelle gelesen (eine Datei mit `<html …>`).
# Das Theme legt Partials als fertiges HTML ab (`theme/academy/partials/footer.html`),
# und die tragen Platzhalter statt Adressen (`href="«WEBSITE-URL»"`). Sie sind keine
# Seiten: Ihre relativen Verweise gelten für die Seite, die sie einbindet, nicht für
# ihren Ablageort. Dieselbe Auswahl-Logik wie bei js-hooks.sh, das nur Seiten mit dem
# Wurzel-Haken seines Layouts zählt.
#
# `<script>` UND `<style>` FALLEN HERAUS. Die Simulations-Vorlage baut ihre Bühne mit
# JS-Template-Literalen, und darin steht `<a href="${…}">` – kein Verweis, sondern
# Programmtext. Ohne diese Ausnahme meldete die Prüfung eine Vorlage, die in Ordnung
# ist. (Codebeispiele im Markdown sind ungefährlich: Sie stehen gebaut als
# `&lt;a href="…"&gt;` da und sind damit gar kein Tag.)
#
# WAS DIE ANWENDUNG AUSLIEFERT, IST KEIN FEHLER. Manche Repos verweisen auf Adressen,
# die erst der laufende Dienst bedient (`/schemas/*.json`); im `_site` liegen sie nicht.
# `--ignore «Präfix»` nimmt solche Adressen aus – und zwar in beide Richtungen: Eine
# Seite unter dem Präfix wird auch nicht mehr gelesen. Ohne diese Möglichkeit wäre die
# Prüfung für solche Repos unbrauchbar und würde abgeschaltet.
#
# KEINE EXTERNEN LINKS. Das bräuchte Netz, würde langsam und schlüge fehl, wenn eine
# fremde Site kurz weg ist. Ein Prüflauf, der aus fremden Gründen rot wird, wird
# abgeschaltet – und damit wäre auch die interne Prüfung weg.
#
# EXIT-CODES:  0 = alles geprüft und in Ordnung (oder: kein `_site/`, siehe unten)
#              1 = Befunde (Liste auf stdout, Zusammenfassung auf stderr)
#              2 = die Prüfung konnte nicht laufen (`--require-site` ohne `_site/`,
#                  kaputte `_config.yml`, KEINE Seite gefunden). Eine Prüfung über die
#                  leere Menge ist kein Erfolg – sie ist ein Befund.
#
# OHNE GEBAUTE SITE lässt sich nichts prüfen. Ein Lauf ohne `_site/` meldet das SICHTBAR
# und überspringt; in einer Pipeline steht die Prüfung hinter dem Build und läuft mit
# `--require-site`, wird dort also nie stillschweigend weggelassen. Dieselbe Zweiteilung
# wie bei js-hooks.sh und html-attributes.sh.
#
# WARUM RUBY OHNE GEMS: wie bei schema/validate.rb – Ruby ist überall da, wo Jekyll
# baut. Ein zusätzliches Gem wäre eine weitere Sache, die installiert sein muss, damit
# eine Prüfung überhaupt läuft.
# =============================================================================
require 'yaml'
require 'set'
require 'date'
require 'fileutils'

# ---------------------------------------------------------------------------
# HTML-Kleinkram
# ---------------------------------------------------------------------------

# `<script>`/`<style>` samt Inhalt entfernen – auch einen unabgeschlossenen Block am
# Dateiende, sonst bliebe Programmtext stehen und würde als Markup gelesen.
def ohne_programmtext(text)
  text = text.gsub(%r{<(script|style)\b[^>]*>.*?</\1\s*>}mi, ' ')
  text.sub(%r{<(script|style)\b[^>]*>.*\z}mi, ' ')
end

# Nur `%XX` auflösen. NICHT CGI.unescape: Das macht aus `+` ein Leerzeichen, und ein
# `+` in einem Anker (`#c++`) wäre danach ein anderer Anker.
def prozent_aufloesen(text)
  text.gsub(/(?:%[0-9A-Fa-f]{2})+/) do |folge|
    folge.scan(/%(..)/).flatten.map(&:hex).pack('C*').force_encoding('UTF-8')
  end
end

ENTITAETEN = { 'amp' => '&', 'lt' => '<', 'gt' => '>', 'quot' => '"', '#39' => "'" }.freeze

def entitaeten_aufloesen(text)
  text.gsub(/&(#?\w+);/) { ENTITAETEN[Regexp.last_match(1)] || Regexp.last_match(0) }
end

# `/a/./b/../c/` -> `/a/c/`. Von Hand und nicht per File.expand_path: Das schneidet den
# abschließenden Schrägstrich weg – und genau der entscheidet, ob `_site/a/index.html`
# oder `_site/a` gemeint ist. Außerdem deutet expand_path ein führendes `~`.
def normalisieren(pfad)
  schluss = pfad.end_with?('/')
  teile = []
  pfad.split('/').each do |t|
    next if t.empty? || t == '.'

    t == '..' ? teile.pop : teile << t
  end
  '/' + teile.join('/') + (schluss && !teile.empty? ? '/' : '')
end

# ---------------------------------------------------------------------------
# Eine gebaute Seite
# ---------------------------------------------------------------------------
Seite = Struct.new(:datei, :pfad, :lang, :fassungen, :anker, :verweise, :routing)

# Zwei Layouts nummerieren ihre Abschnitte ZUR LAUFZEIT und führen den Stand im
# Fragment: `presentation.js` liest `#/5` und springt zur fünften Folie,
# `simulation.js` zusätzlich `#/«szenario»/5` und `#/uebersicht`. Eine passende
# `id` steht dafür NICHT im HTML und soll dort auch nicht stehen – die Folien
# entstehen erst im Browser. Ohne dieses Wissen meldet die Prüfung jeden
# Folienanker als tot, und zwar in jedem Repo mit einer Präsentation.
#
# Geprüft wird trotzdem, nur gegen etwas anderes: gegen die FORM, die das
# jeweilige Skript zusichert, und gegen das Layout der ZIELSEITE. `#/5` auf einer
# gewöhnlichen Seite bleibt damit ein Befund, ebenso `#/kapitel` auf einer
# Präsentation.
#
# NICHT geprüft wird, ob es die fünfte Folie gibt. Dafür müsste dieses Skript die
# Aufteilungsregeln aus `presentation.js` nachbauen (h2 beginnt eine Folie, Inhalt
# davor wird zur Titelfolie, fehlt sie, wird eine erzeugt) – und dann bei jeder
# Änderung dort mitwandern. Genau diese Art von stiller Drift hat #152 verursacht.
# Ein Anker auf eine Folie, die es nicht gibt, landet auf der letzten; das ist
# sichtbar, ein toter Verweis ist es nicht.
#
# Die Quelle dieser Formen sind die `ausHash()`-Funktionen der beiden Skripte.
# Wer sie dort ändert, ändert sie hier mit.
LAUFZEIT_ANKER = {
  present: [%r{\A/\d+\z}],
  sim: [%r{\A/\d+\z}, %r{\A/[A-Za-z0-9_-]+/\d+\z}, %r{\A/uebersicht/?\z}]
}.freeze

LAUFZEIT_NAME = { present: 'Präsentation', sim: 'Simulation' }.freeze

# Der Wurzel-Haken des Layouts steht am `<body>` – dieselbe Kennung, an der auch
# `bin/js-hooks.sh` die Seiten eines Layouts auswählt.
def routing_lesen(roh)
  koerper = roh[/<body\b[^>]*>/mi].to_s
  return :present if koerper.match?(/\sdata-avd-academy-present[\s=>]/mi)
  return :sim if koerper.match?(/\sdata-avd-academy-sim[\s=>]/mi)

  nil
end

# `<a …>`-Tags einer Seite: [href, hat_hreflang].
def verweise_lesen(rumpf)
  rumpf.scan(/<a\b[^>]*>/mi).map do |tag|
    treffer = tag.match(/\shref\s*=\s*"([^"]*)"/mi) || tag.match(/\shref\s*=\s*'([^']*)'/mi)
    next nil unless treffer

    [entitaeten_aufloesen(treffer[1].strip), !tag.match(/\shreflang\s*=/mi).nil?]
  end.compact
end

# Alle Sprungziele einer Seite: `id="…"` überall, dazu das alte `name="…"` an `<a>`.
def anker_lesen(rumpf)
  menge = Set.new
  rumpf.scan(/\sid\s*=\s*"([^"]*)"/mi) { |t| menge << entitaeten_aufloesen(t[0]) }
  rumpf.scan(/<a\b[^>]*\sname\s*=\s*"([^"]*)"/mi) { |t| menge << entitaeten_aufloesen(t[0]) }
  menge
end

# Die Sprachfassungen dieser Seite aus dem Kopf: { 'en' => '/en/a.html', … }.
# `x-default` bleibt draußen – das ist eine Wiederholung, keine eigene Sprache.
def fassungen_lesen(rumpf, baseurl)
  gefunden = {}
  rumpf.scan(/<link\b[^>]*>/mi) do |tag|
    next unless tag =~ /\srel\s*=\s*"alternate"/mi

    code = tag[/\shreflang\s*=\s*"([^"]*)"/mi, 1]
    ziel = tag[/\shref\s*=\s*"([^"]*)"/mi, 1]
    next if code.nil? || ziel.nil? || code == 'x-default'

    gefunden[code] = normalisieren(baseurl_abschneiden(entitaeten_aufloesen(ziel), baseurl))
  end
  gefunden
end

def baseurl_abschneiden(pfad, baseurl)
  return pfad if baseurl.empty?
  return '/' if pfad == baseurl

  pfad.start_with?(baseurl + '/') ? pfad[baseurl.size..] : pfad
end

# Die Adresse, unter der eine Datei ausgeliefert wird – ohne `baseurl`, denn den tragen
# die gebauten Adressen, die Dateien im `_site` aber nicht. `…/index.html` ist `…/`.
def seitenpfad(datei, site)
  pfad = datei[site.size..].to_s
  pfad = '/' + pfad unless pfad.start_with?('/')
  pfad.sub(%r{/index\.html\z}, '/')
end

# ---------------------------------------------------------------------------
# Einlesen
# ---------------------------------------------------------------------------
def seiten_einlesen(site, baseurl, ignorieren)
  Dir.glob(File.join(site, '**', '*.html')).sort.map do |datei|
    roh = File.read(datei, encoding: 'UTF-8')
    # Kein vollständiges Dokument = keine Seite, sondern ein Partial. Siehe Kopf.
    next nil unless roh =~ /<html[\s>]/i

    pfad = seitenpfad(datei, site)
    next nil if ignoriert?(pfad, ignorieren)

    rumpf = ohne_programmtext(roh)
    Seite.new(datei, pfad, roh[/<html\b[^>]*\slang\s*=\s*"([^"]*)"/i, 1],
              fassungen_lesen(roh, baseurl), anker_lesen(rumpf), verweise_lesen(rumpf),
              routing_lesen(roh))
  end.compact
end

def ignoriert?(pfad, ignorieren)
  ignorieren.any? { |p| pfad == p || pfad.start_with?(p) }
end

# Adressen, die nicht auf diese Site zeigen – nichts davon ist hier prüfbar. Dazu
# gehören auch PLATZHALTER: Vorlagen bleiben inhaltsleer und schreiben `«…»` hin
# (`href="«WEBSITE-URL»"`, `«https://…»`). Das ist keine Adresse, sondern eine Lücke,
# die der Anwender füllt – sie als toten Verweis zu melden hieße, jede Vorlage zu
# melden, und zwar genau dafür, dass sie eine Vorlage ist.
def extern?(href)
  href.empty? || href.start_with?('#', '//') ||
    href.include?('«') || href.include?('»') ||
    href.match?(%r{\A[a-zA-Z][a-zA-Z0-9+.-]*:})
end

# ---------------------------------------------------------------------------
# Prüfen
# ---------------------------------------------------------------------------
Befund = Struct.new(:seite, :href, :art, :text)

def pruefen(site, seiten, baseurl, ignorieren)
  nach_pfad = seiten.to_h { |s| [s.pfad, s] }
  befunde = []
  geprueft = 0
  wurzelabsolut = 0
  wurzelabsolut_tot = 0

  seiten.each do |seite|
    seite.verweise.each do |href, hat_hreflang|
      next if extern?(href)

      adresse = href.split('#', 2)
      fragment = adresse[1]
      pfad = adresse[0].to_s.split('?').first.to_s
      next if pfad.empty?

      pfad = prozent_aufloesen(pfad)
      absolut = if pfad.start_with?('/')
                  baseurl_abschneiden(normalisieren(pfad), baseurl)
                else
                  ordner = seite.pfad.end_with?('/') ? seite.pfad : File.dirname(seite.pfad)
                  normalisieren(File.join(ordner, pfad))
                end
      next if ignoriert?(absolut, ignorieren)

      geprueft += 1
      wurzelabsolut += 1 if pfad.start_with?('/')

      ziel = zieldatei(site, absolut)
      unless File.file?(ziel)
        wurzelabsolut_tot += 1 if pfad.start_with?('/')
        befunde << Befund.new(seite, href, 'Ziel fehlt', "im _site gibt es #{ziel[site.size..]} nicht")
        next
      end

      zielseite = nach_pfad[seitenpfad(ziel, site)]
      befunde << anker_befund(seite, href, fragment, zielseite, ziel, site) if fragment && !fragment.empty?
      befunde << sprach_befund(seite, href, zielseite, nach_pfad) unless hat_hreflang
    end
  end

  # Derselbe Verweis kommt auf einer Seite oft mehrfach vor (Kopfzeile, Fließtext,
  # Fußbereich). Gemeldet wird er einmal – eine Liste, in der eine Zeile dreißigmal
  # steht, liest niemand zu Ende.
  eindeutig = befunde.compact.uniq { |b| [b.seite.pfad, b.href, b.art] }
  [eindeutig, geprueft, wurzelabsolut, wurzelabsolut_tot]
end

# `/a/b.html` -> `_site/a/b.html`; `/a/` -> `_site/a/index.html`. Ein Ordner ohne
# `index.html` bleibt damit ein Befund – auf GitHub Pages ist er ein 404.
def zieldatei(site, pfad)
  voll = File.join(site, pfad)
  return File.join(voll, 'index.html') if pfad.end_with?('/') || File.directory?(voll)

  voll
end

def anker_befund(seite, href, fragment, zielseite, ziel, site)
  # `#top` bringt jeder Browser von sich aus an den Seitenanfang, auch ohne Element.
  return nil if fragment.casecmp('top').zero?
  # Eine Datei, die keine Seite ist (JSON, PDF, Bild), hat keine Anker zum Prüfen.
  return nil if zielseite.nil?

  roh = prozent_aufloesen(fragment)
  return nil if zielseite.anker.include?(roh) || zielseite.anker.include?(fragment)

  # Laufzeit-Anker (`#/5`) – siehe LAUFZEIT_ANKER.
  if roh.start_with?('/')
    formen = LAUFZEIT_ANKER[zielseite.routing]
    if formen.nil?
      return Befund.new(seite, href, 'Anker fehlt',
                        "#{ziel[site.size..]} ist weder Präsentation noch Simulation – " \
                        'dort schaltet nichts auf `#/…`')
    end
    return nil if formen.any? { |f| roh.match?(f) }

    return Befund.new(seite, href, 'Anker fehlt',
                      "#{LAUFZEIT_NAME[zielseite.routing]}: `##{roh}` ist keine Form, " \
                      'die das Layout kennt')
  end

  Befund.new(seite, href, 'Anker fehlt',
             "#{ziel[site.size..]} hat keine id=\"#{roh}\"")
end

# Siehe Kopf, Befund 3: nur wenn es die Zielseite in der Sprache DIESER Seite gibt.
#
# DIE FASSUNG MUSS ZURÜCKZEIGEN. `switch.fallback: base` lässt eine Seite OHNE
# Übersetzung die WURZEL des anderen Sprachbaums als Fassung nennen – damit der
# Umschalter etwas anzubieten hat. Wer das für ein Gegenstück hält, empfiehlt als
# Lösung `/en/` für jede unübersetzte Seite: ein Vorschlag, der die Prüfung sofort
# unglaubwürdig macht. Ein echtes Paar nennt sich gegenseitig.
def sprach_befund(seite, href, zielseite, nach_pfad)
  return nil if zielseite.nil? || seite.lang.nil? || zielseite.lang.nil?
  return nil if zielseite.lang == seite.lang

  passend = zielseite.fassungen[seite.lang]
  return nil if passend.nil? || passend == zielseite.pfad

  gegenstueck = nach_pfad[passend]
  return nil if gegenstueck.nil? || gegenstueck.fassungen[zielseite.lang] != zielseite.pfad

  Befund.new(seite, href, 'Sprachbaum gewechselt',
             "Ziel ist #{zielseite.lang}, die Seite #{seite.lang} – " \
             "in #{seite.lang} liegt es unter #{passend}")
end

# ---------------------------------------------------------------------------
# Selbsttest – die Prüfung an einer Site, die die Fehler ABSICHTLICH enthält
#
# Das eigene Repo taugt dafür nicht: Dort ist jeder Verweis heil, jedes Ziel übersetzt,
# und die interessanten Fälle entstehen gar nicht. Genau dieser blinde Fleck hat 2.5.1
# grün durchlaufen lassen. Hier steht deshalb eine kleine Site, in der jeder Befund
# einmal vorkommt – und ebenso jeder Fall, der KEIN Befund sein darf.
# ---------------------------------------------------------------------------
SELBSTTEST_DATEIEN = {
  # Standardsprache in der Wurzel, Englisch unter /en/.
  'index.html' => <<~HTML,
    <html lang="de"><head>
    <link rel="alternate" hreflang="de" href="/BASE/"><link rel="alternate" hreflang="en" href="/BASE/en/">
    </head><body>
    <a href="/BASE/gibt-es.html">heil</a>
    <a href="/BASE/unterordner/">Ordner mit index</a>
    <a href="/BASE/leerer-ordner/">Ordner ohne index</a>
    <a href="/BASE/gibt-es-nicht.html">tot</a>
    <a href="gibt-es.html#l%C3%B6schen">Anker, prozentkodiert</a>
    <a href="gibt-es.html#löschen">Anker, roh</a>
    <a href="gibt-es.html#c++">Anker mit Plus</a>
    <a href="gibt-es.html#gibt-es-nicht">Anker tot</a>
    <a href="gibt-es.html#TOP">immer heil</a>
    <a href="https://example.org/x.html">extern</a>
    <a href="mailto:a@b.c">Mail</a>
    <a href="#nur-fragment">Fragment</a>
    <a href="/BASE/ausgenommen/datei.json">von der Anwendung bedient</a>
    <a href="/BASE/unterordner/../gibt-es.html">mit ..</a>
    <a href="/BASE/nicht-html.json">keine Seite, keine Anker</a>
    <a href="/BASE/nicht-html.json#egal">Fragment an einer Nicht-Seite</a>
    <a href="«ZIEL-URL»">Platzhalter einer Vorlage</a>
    <a href="praesentation.html#/3">Folie, gueltig</a>
    <a href="simulation.html#/uebersicht">Simulation, Uebersicht</a>
    <a href="simulation.html#/schritte/2">Simulation, Szenario und Schritt</a>
    <a href="simulation.html#/2">Simulation, nur Schritt</a>
    <a href="praesentation.html#/kapitel">Folie, Form kennt das Layout nicht</a>
    <a href="gibt-es.html#/3">Laufzeit-Anker auf gewoehnlicher Seite</a>
    <script>var t = '<a href="/BASE/aus-javascript.html">nur Programmtext</a>';</script>
    </body></html>
  HTML
  'gibt-es.html' => <<~HTML,
    <html lang="de"><head>
    <link rel="alternate" hreflang="de" href="/BASE/gibt-es.html"><link rel="alternate" hreflang="en" href="/BASE/en/exists.html">
    </head><body><h2 id="löschen">Löschen</h2><h2 id="c++">C++</h2></body></html>
  HTML
  # Die beiden Layouts mit Laufzeit-Nummerierung. Entscheidend ist allein der
  # Wurzel-Haken am `<body>`; die Folien entstehen erst im Browser, im HTML steht
  # deshalb bewusst KEINE passende `id`.
  'praesentation.html' => <<~HTML,
    <html lang="de"><head></head>
    <body class="avd-academy-present" data-avd-academy-present data-avd-academy-present-title="Titel">
    <div data-avd-academy-deck><h2>Erste</h2><h2>Zweite</h2></div></body></html>
  HTML
  'simulation.html' => <<~HTML,
    <html lang="de"><head></head>
    <body class="avd-academy-sim" data-avd-academy-sim><div data-avd-academy-sim-stage></div></body></html>
  HTML
  'nur-deutsch.html' => <<~HTML,
    <html lang="de"><head></head><body><p>ohne englische Fassung</p></body></html>
  HTML
  # `switch.fallback: base`: nennt als englische Fassung die WURZEL des englischen
  # Baums, weil es keine Übersetzung gibt. Das ist kein Gegenstück – es zeigt nicht
  # zurück. Ohne diese Datei fände der Selbsttest den Fehlalarm nicht.
  'rueckfall.html' => <<~HTML,
    <html lang="de"><head>
    <link rel="alternate" hreflang="de" href="/BASE/rueckfall.html"><link rel="alternate" hreflang="en" href="/BASE/en/">
    </head><body><p>keine Übersetzung, nur Rückfall</p></body></html>
  HTML
  'unterordner/index.html' => <<~HTML,
    <html lang="de"><head></head><body><p>Ordnerseite</p></body></html>
  HTML
  'leerer-ordner/nicht-index.html' => <<~HTML,
    <html lang="de"><head></head><body><p>kein index</p></body></html>
  HTML
  'ausgenommen/seite.html' => <<~HTML,
    <html lang="de"><head></head><body><a href="/BASE/gibt-es-nicht.html">wird nicht gelesen</a></body></html>
  HTML
  'partial.html' => <<~HTML,
    <div class="partial"><a href="«WEBSITE-URL»">Platzhalter</a></div>
  HTML
  'en/index.html' => <<~HTML,
    <html lang="en"><head>
    <link rel="alternate" hreflang="de" href="/BASE/"><link rel="alternate" hreflang="en" href="/BASE/en/">
    </head><body>
    <a href="/BASE/gibt-es.html">Sprachbaum gewechselt, obwohl es die Seite gibt</a>
    <a href="/BASE/nur-deutsch.html">bewusst deutsch, keine englische Fassung</a>
    <a href="/BASE/rueckfall.html">deutsch, englische „Fassung“ ist nur der Rückfall</a>
    <a href="/BASE/" hreflang="de">Sprachumschalter</a>
    <a href="/BASE/en/exists.html">heil und englisch</a>
    </body></html>
  HTML
  'en/exists.html' => <<~HTML,
    <html lang="en"><head>
    <link rel="alternate" hreflang="de" href="/BASE/gibt-es.html"><link rel="alternate" hreflang="en" href="/BASE/en/exists.html">
    </head><body><p>exists</p></body></html>
  HTML
  'nicht-html.json' => "{}\n",
  'ausgenommen/datei.json' => "{}\n"
}.freeze

# Erwartet: [Seitenpfad, Art] – genau diese Befunde, nicht mehr und nicht weniger.
SELBSTTEST_ERWARTET = [
  ['/', 'Ziel fehlt'],          # /leerer-ordner/ – Ordner ohne index.html
  ['/', 'Ziel fehlt'],          # /gibt-es-nicht.html
  ['/', 'Anker fehlt'],         # #gibt-es-nicht
  # Laufzeit-Anker: geprueft wird die FORM und das Layout der Zielseite.
  ['/', 'Anker fehlt'],         # praesentation.html#/kapitel – Form unbekannt
  ['/', 'Anker fehlt'],         # gibt-es.html#/3 – Ziel schaltet gar nicht
  ['/en/', 'Sprachbaum gewechselt']
].freeze

def selbsttest(baseurl)
  require 'tmpdir'
  fehler = []
  Dir.mktmpdir('academy-links') do |tmp|
    site = File.join(tmp, '_site')
    SELBSTTEST_DATEIEN.each do |name, inhalt|
      ziel = File.join(site, name)
      FileUtils.mkdir_p(File.dirname(ziel))
      File.write(ziel, inhalt.gsub('/BASE/', baseurl.empty? ? '/' : "#{baseurl}/"), encoding: 'UTF-8')
    end

    seiten = seiten_einlesen(site, baseurl, ['/ausgenommen/'])
    befunde, = pruefen(site, seiten, baseurl, ['/ausgenommen/'])

    gelesen = seiten.map(&:pfad).sort
    unless gelesen.include?('/') && !gelesen.include?('/partial.html')
      fehler << "Auswahl der Quellseiten falsch: #{gelesen.join(', ')}"
    end
    fehler << 'Die ausgenommene Seite wurde gelesen.' if gelesen.include?('/ausgenommen/seite.html')

    ist = befunde.map { |b| [b.seite.pfad, b.art] }.sort
    soll = SELBSTTEST_ERWARTET.sort
    if ist != soll
      fehler << "erwartet: #{soll.inspect}"
      fehler << "gefunden: #{ist.inspect}"
      befunde.each { |b| fehler << "  #{b.seite.pfad}  #{b.href}  -> #{b.art}: #{b.text}" }
    end
  end
  fehler
end

# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------
site = nil
baseurl = nil
configs = []
ignorieren = []
require_site = false
selbsttest_nur = false

argv = ARGV.dup
until argv.empty?
  case (arg = argv.shift)
  when '--site'         then site = argv.shift
  when '--baseurl'      then baseurl = argv.shift
  when '--config'       then configs << argv.shift
  when '--ignore'       then ignorieren << argv.shift
  when '--require-site' then require_site = true
  when '--self-test'    then selbsttest_nur = true
  when '--help', '-h'
    puts File.read(__FILE__).lines[2..8].map { |z| z.sub(/\A# ?/, '') }.join
    exit 0
  else
    warn "Unbekannte Option: #{arg}"
    exit 2
  end
end

if selbsttest_nur
  # Zweimal: einmal ohne und einmal mit `baseurl`. Das Abschneiden des Präfixes ist die
  # Stelle, an der eine Projektseite anders läuft als eine Benutzerseite – und die
  # einzige, die ein Lauf im eigenen Repo (baseurl leer) nie berührt.
  fehler = ['', '/projekt'].flat_map { |b| selbsttest(b).map { |f| "baseurl #{b.empty? ? '(leer)' : b}: #{f}" } }
  if fehler.empty?
    puts "Selbsttest der Verweisprüfung bestanden (#{SELBSTTEST_DATEIEN.size} Dateien, " \
         "#{SELBSTTEST_ERWARTET.size} erwartete Befunde, mit und ohne baseurl)."
    exit 0
  end
  warn "FEHLER: Die Verweisprüfung selbst arbeitet nicht wie beschrieben:\n\n"
  fehler.each { |f| warn "  #{f}" }
  exit 1
end

site = (site || '_site').chomp('/')
unless Dir.exist?(site)
  if require_site
    warn "FEHLER: Keine gebaute Site unter #{site}/ – ohne sie sind Verweise nicht prüfbar"
    warn '       (Liquid setzt die Adressen erst beim Bauen zusammen, und die Ziele'
    warn '       entstehen überhaupt erst dort). Erst bauen: `make build`.'
    exit 2
  end
  puts "Hinweis: Verweise NICHT geprüft – keine gebaute Site unter #{site}/."
  puts '  Vollständig:  make build && make check'
  exit 0
end

# `baseurl`: ausdrücklich, sonst aus der Konfiguration. Er MUSS stimmen – auf einer
# Projektseite tragen die gebauten Adressen ihn (`/repo/a.html`), die Dateien im `_site`
# aber nicht. Wer ihn beim Bauen per `--baseurl` setzt (so die Vorlage für Schulungs-
# Repos), setzt ihn hier genauso.
if baseurl.nil?
  configs = [File.join(Dir.pwd, '_config.yml')] if configs.empty? && File.exist?(File.join(Dir.pwd, '_config.yml'))
  configs.each do |cfg|
    unless File.exist?(cfg)
      warn "FEHLER: #{cfg} gibt es nicht."
      exit 2
    end
    begin
      daten = YAML.safe_load(File.read(cfg), permitted_classes: [Date, Time], aliases: true) || {}
    rescue Psych::SyntaxError => e
      warn "FEHLER: #{cfg} ist kein gültiges YAML – #{e.message}"
      exit 2
    end
    baseurl = daten['baseurl'] if daten.key?('baseurl')
  end
end
baseurl = (baseurl || '').to_s.chomp('/')
baseurl = '/' + baseurl unless baseurl.empty? || baseurl.start_with?('/')

ignorieren = ignorieren.compact.map do |p|
  p = '/' + p unless p.start_with?('/')
  p
end

seiten = seiten_einlesen(site, baseurl, ignorieren)
if seiten.empty?
  warn "FEHLER: Unter #{site}/ liegt keine einzige gebaute Seite."
  warn '       Eine Prüfung über die leere Menge ist kein Erfolg – sie ist ein Befund.'
  exit 2
end

befunde, geprueft, wurzelabsolut, wurzelabsolut_tot = pruefen(site, seiten, baseurl, ignorieren)

if befunde.empty?
  puts "Verweise in Ordnung (#{seiten.size} Seiten, #{geprueft} interne Verweise" \
       "#{baseurl.empty? ? '' : ", baseurl #{baseurl}"})."
  exit 0
end

befunde.group_by { |b| b.seite.pfad }.sort.each do |pfad, liste|
  puts "  #{pfad}"
  liste.each { |b| puts "    #{b.href}\n      #{b.art}: #{b.text}" }
end
puts ''
puts "#{befunde.size} Befund(e) auf #{befunde.map { |b| b.seite.pfad }.uniq.size} Seite(n)."

# Ein falscher `baseurl` sieht sonst aus wie eine kaputte Site: JEDER wurzel-absolute
# Verweis schlägt fehl. Lieber einmal zu viel darauf hinweisen als die Liste abarbeiten.
if wurzelabsolut.positive? && wurzelabsolut_tot * 2 > wurzelabsolut
  warn ''
  warn "HINWEIS: #{wurzelabsolut_tot} von #{wurzelabsolut} wurzel-absoluten Verweisen zeigen ins Leere."
  warn "         Das ist selten die Site und meist der baseurl (hier: #{baseurl.empty? ? '(leer)' : baseurl})."
  warn '         Wer beim Bauen `--baseurl` setzt, gibt hier denselben Wert mit.'
end

warn ''
warn 'FEHLER: Es gibt Verweise, die ins Leere zeigen. Jekyll baut das stumm – die Seite'
warn '        entsteht, der Link ist tot, und es fällt erst beim Klicken auf.'
exit 1
