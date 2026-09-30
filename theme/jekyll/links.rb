#!/usr/bin/env ruby
# =============================================================================
# Interne Verweise im gebauten HTML – zeigt ein Link ins Leere?
#
#   ruby theme/jekyll/links.rb                       # Befunde ausgeben
#   ruby theme/jekyll/links.rb --site _site --baseurl /mein-repo
#   ruby theme/jekyll/links.rb --ignore /schemas/    # von der Anwendung bedient
#   ruby theme/jekyll/links.rb --label learner       # Lauf beschriften (mehrere Bündel)
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
def without_code(text)
  text = text.gsub(%r{<(script|style)\b[^>]*>.*?</\1\s*>}mi, ' ')
  text.sub(%r{<(script|style)\b[^>]*>.*\z}mi, ' ')
end

# Nur `%XX` auflösen. NICHT CGI.unescape: Das macht aus `+` ein Leerzeichen, und ein
# `+` in einem Anker (`#c++`) wäre danach ein anderer Anker.
def decode_percent(text)
  text.gsub(/(?:%[0-9A-Fa-f]{2})+/) do |sequence|
    sequence.scan(/%(..)/).flatten.map(&:hex).pack('C*').force_encoding('UTF-8')
  end
end

ENTITIES = { 'amp' => '&', 'lt' => '<', 'gt' => '>', 'quot' => '"', '#39' => "'" }.freeze

def resolve_entities(text)
  text.gsub(/&(#?\w+);/) { ENTITIES[Regexp.last_match(1)] || Regexp.last_match(0) }
end

# `/a/./b/../c/` -> `/a/c/`. Von Hand und nicht per File.expand_path: Das schneidet den
# abschließenden Schrägstrich weg – und genau der entscheidet, ob `_site/a/index.html`
# oder `_site/a` gemeint ist. Außerdem deutet expand_path ein führendes `~`.
def normalise(path)
  suffix = path.end_with?('/')
  parts = []
  path.split('/').each do |t|
    next if t.empty? || t == '.'

    t == '..' ? parts.pop : parts << t
  end
  '/' + parts.join('/') + (suffix && !parts.empty? ? '/' : '')
end

# ---------------------------------------------------------------------------
# Eine gebaute Seite
# ---------------------------------------------------------------------------
Page = Struct.new(:file, :path, :lang, :versions, :anchor, :links, :routing)

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
RUNTIME_ANCHORS = {
  present: [%r{\A/\d+\z}],
  sim: [%r{\A/\d+\z}, %r{\A/[A-Za-z0-9_-]+/\d+\z}, %r{\A/uebersicht/?\z}]
}.freeze

RUNTIME_NAMES = { present: 'Präsentation', sim: 'Simulation' }.freeze

# Der Wurzel-Haken des Layouts steht am `<body>` – dieselbe Kennung, an der auch
# `bin/js-hooks.sh` die Seiten eines Layouts auswählt.
def read_routing(raw)
  body = raw[/<body\b[^>]*>/mi].to_s
  return :present if body.match?(/\sdata-avd-academy-present[\s=>]/mi)
  return :sim if body.match?(/\sdata-avd-academy-sim[\s=>]/mi)

  nil
end

# `<a …>`-Tags einer Seite: [href, hat_hreflang].
def read_links(body)
  body.scan(/<a\b[^>]*>/mi).map do |tag|
    hits = tag.match(/\shref\s*=\s*"([^"]*)"/mi) || tag.match(/\shref\s*=\s*'([^']*)'/mi)
    next nil unless hits

    [resolve_entities(hits[1].strip), !tag.match(/\shreflang\s*=/mi).nil?]
  end.compact
end

# WEITERLEITUNGEN ZÄHLEN ALS VERWEISE. Eine Seite, die nur aus
# `<meta http-equiv="refresh" content="0; url=…">` besteht, ist der Regelfall
# für eine kurze Adresse (`permaid`) und für jede von Hand gelegte Umleitung.
# Zeigt ihr Ziel ins Leere, ist der Verweis tot wie jeder andere – nur schlimmer,
# weil der Leser eine leere Seite bekommt, ohne je etwas angeklickt zu haben.
#
# GELESEN WIRD AUS DEM ROHEN DOKUMENT, nicht aus `without_code`: In einer
# Weiterleitungsseite steht kein Code, und ein `<meta>` im Kopf soll auch dann
# zählen, wenn die Seite sonst nichts enthält.
#
# `content` HAT ZWEI TEILE: Wartezeit und Adresse, getrennt durch ein Semikolon.
# Die Adresse darf in Anführungszeichen stehen und `url=` in beliebiger
# Schreibweise – so liest es der Browser auch.
def read_redirects(raw)
  raw.scan(/<meta\b[^>]*>/mi).map do |tag|
    next nil unless tag.match?(/\shttp-equiv\s*=\s*["']?refresh["']?/mi)

    inhalt = tag[/\scontent\s*=\s*"([^"]*)"/mi, 1] || tag[/\scontent\s*=\s*'([^']*)'/mi, 1]
    next nil if inhalt.nil?

    ziel = inhalt[/;\s*url\s*=\s*(.+)\z/mi, 1]
    next nil if ziel.nil?

    ziel = resolve_entities(ziel.strip.sub(/\A["']/, '').sub(/["']\z/, ''))
    next nil if ziel.empty?

    [ziel, false]
  end.compact
end

# Alle Sprungziele einer Seite: `id="…"` überall, dazu das alte `name="…"` an `<a>`.
def read_anchors(body)
  set = Set.new
  body.scan(/\sid\s*=\s*"([^"]*)"/mi) { |t| set << resolve_entities(t[0]) }
  body.scan(/<a\b[^>]*\sname\s*=\s*"([^"]*)"/mi) { |t| set << resolve_entities(t[0]) }
  set
end

# Die Sprachfassungen dieser Seite aus dem Kopf: { 'en' => '/en/a.html', … }.
# `x-default` bleibt draußen – das ist eine Wiederholung, keine eigene Sprache.
def read_versions(body, baseurl)
  found = {}
  body.scan(/<link\b[^>]*>/mi) do |tag|
    next unless tag =~ /\srel\s*=\s*"alternate"/mi

    code = tag[/\shreflang\s*=\s*"([^"]*)"/mi, 1]
    target = tag[/\shref\s*=\s*"([^"]*)"/mi, 1]
    next if code.nil? || target.nil? || code == 'x-default'

    found[code] = normalise(strip_baseurl(resolve_entities(target), baseurl))
  end
  found
end

def strip_baseurl(path, baseurl)
  return path if baseurl.empty?
  return '/' if path == baseurl

  path.start_with?(baseurl + '/') ? path[baseurl.size..] : path
end

# Die Adresse, unter der eine Datei ausgeliefert wird – ohne `baseurl`, denn den tragen
# die gebauten Adressen, die Dateien im `_site` aber nicht. `…/index.html` ist `…/`.
def page_path(file, site)
  path = file[site.size..].to_s
  path = '/' + path unless path.start_with?('/')
  path.sub(%r{/index\.html\z}, '/')
end

# ---------------------------------------------------------------------------
# Einlesen
# ---------------------------------------------------------------------------
def read_pages(site, baseurl, scope)
  Dir.glob(File.join(site, '**', '*.html')).sort.map do |file|
    raw = File.read(file, encoding: 'UTF-8')
    # Kein vollständiges Dokument = keine Seite, sondern ein Partial. Siehe Kopf.
    next nil unless raw =~ /<html[\s>]/i

    path = page_path(file, site)
    next nil if scope.skips?(path)

    body = without_code(raw)
    Page.new(file, path, raw[/<html\b[^>]*\slang\s*=\s*"([^"]*)"/i, 1],
              read_versions(raw, baseurl), read_anchors(body),
              read_links(body) + read_redirects(raw),
              read_routing(raw))
  end.compact
end

# --- Eine Schreibweise für Ausschlussmuster ----------------------------------
#
# DERSELBE BLOCK STEHT IN `contrast.rb` UND `components.rb`. Drei Werkzeuge, die
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

# WAS EINE PRÜFUNG ANSIEHT – zwei Listen, eine Regel, an genau dieser Stelle.
#
# `only` leer: alles ist erfasst, wie bisher. `only` gesetzt: erfasst ist nur,
# was darauf passt. `ignore` nimmt in BEIDEN Fällen danach noch heraus.
#
# WARUM DER AUSSCHLUSS DEN EINSCHLUSS SCHLÄGT: Anders herum liesse sich ein
# einmal ausgenommener Zweig durch ein weiteres Einschlussmuster wieder
# hereinholen – welche der beiden Angaben dann gilt, entschiede die Reihenfolge,
# und die steht in einer Eingabe nirgends verlässlich fest. So gilt: Was
# ausgenommen ist, bleibt ausgenommen.
Scope = Struct.new(:only, :ignore) do
  def skips?(path)
    return true unless only.empty? || ignored?(path, only)

    ignored?(path, ignore)
  end
end

# Adressen, die nicht auf diese Site zeigen – nichts davon ist hier prüfbar. Dazu
# gehören auch PLATZHALTER: Vorlagen bleiben inhaltsleer und schreiben `«…»` hin
# (`href="«WEBSITE-URL»"`, `«https://…»`). Das ist keine Adresse, sondern eine Lücke,
# die der Anwender füllt – sie als toten Verweis zu melden hieße, jede Vorlage zu
# melden, und zwar genau dafür, dass sie eine Vorlage ist.
def external?(href)
  href.empty? || href.start_with?('#', '//') ||
    href.include?('«') || href.include?('»') ||
    href.match?(%r{\A[a-zA-Z][a-zA-Z0-9+.-]*:})
end

# ---------------------------------------------------------------------------
# Prüfen
# ---------------------------------------------------------------------------
Finding = Struct.new(:page, :href, :kind, :text)

def check(site, pages, baseurl, scope)
  by_path = pages.to_h { |s| [s.path, s] }
  findings = []
  checked = 0
  root_absolute = 0
  root_absolute_dead = 0

  pages.each do |page|
    page.links.each do |href, has_hreflang|
      next if external?(href)

      address = href.split('#', 2)
      fragment = address[1]
      path = address[0].to_s.split('?').first.to_s
      next if path.empty?

      path = decode_percent(path)
      absolute = if path.start_with?('/')
                  strip_baseurl(normalise(path), baseurl)
                else
                  folder = page.path.end_with?('/') ? page.path : File.dirname(page.path)
                  normalise(File.join(folder, path))
                end
      next if scope.skips?(absolute)

      checked += 1
      root_absolute += 1 if path.start_with?('/')

      target = target_file(site, absolute)
      unless File.file?(target)
        root_absolute_dead += 1 if path.start_with?('/')
        findings << Finding.new(page, href, 'Ziel fehlt', "im _site gibt es #{target[site.size..]} nicht")
        next
      end

      target_page = by_path[page_path(target, site)]
      findings << anchor_finding(page, href, fragment, target_page, target, site) if fragment && !fragment.empty?
      findings << language_finding(page, href, target_page, by_path) unless has_hreflang
    end
  end

  # Derselbe Verweis kommt auf einer Seite oft mehrfach vor (Kopfzeile, Fließtext,
  # Fußbereich). Gemeldet wird er einmal – eine Liste, in der eine Zeile dreißigmal
  # steht, liest niemand zu Ende.
  unique = findings.compact.uniq { |b| [b.page.path, b.href, b.kind] }
  [unique, checked, root_absolute, root_absolute_dead]
end

# `/a/b.html` -> `_site/a/b.html`; `/a/` -> `_site/a/index.html`. Ein Ordner ohne
# `index.html` bleibt damit ein Befund – auf GitHub Pages ist er ein 404.
def target_file(site, path)
  full = File.join(site, path)
  return File.join(full, 'index.html') if path.end_with?('/') || File.directory?(full)

  full
end

def anchor_finding(page, href, fragment, target_page, target, site)
  # `#top` bringt jeder Browser von sich aus an den Seitenanfang, auch ohne Element.
  return nil if fragment.casecmp('top').zero?
  # Eine Datei, die keine Seite ist (JSON, PDF, Bild), hat keine Anker zum Prüfen.
  return nil if target_page.nil?

  raw = decode_percent(fragment)
  return nil if target_page.anchor.include?(raw) || target_page.anchor.include?(fragment)

  # Laufzeit-Anker (`#/5`) – siehe LAUFZEIT_ANKER.
  if raw.start_with?('/')
    forms = RUNTIME_ANCHORS[target_page.routing]
    if forms.nil?
      return Finding.new(page, href, 'Anker fehlt',
                        "#{target[site.size..]} ist weder Präsentation noch Simulation – " \
                        'dort schaltet nichts auf `#/…`')
    end
    return nil if forms.any? { |f| raw.match?(f) }

    return Finding.new(page, href, 'Anker fehlt',
                      "#{RUNTIME_NAMES[target_page.routing]}: `##{raw}` ist keine Form, " \
                      'die das Layout kennt')
  end

  Finding.new(page, href, 'Anker fehlt',
             "#{target[site.size..]} hat keine id=\"#{raw}\"")
end

# Siehe Kopf, Befund 3: nur wenn es die Zielseite in der Sprache DIESER Seite gibt.
#
# DIE FASSUNG MUSS ZURÜCKZEIGEN. `switch.fallback: base` lässt eine Seite OHNE
# Übersetzung die WURZEL des anderen Sprachbaums als Fassung nennen – damit der
# Umschalter etwas anzubieten hat. Wer das für ein Gegenstück hält, empfiehlt als
# Lösung `/en/` für jede unübersetzte Seite: ein Vorschlag, der die Prüfung sofort
# unglaubwürdig macht. Ein echtes Paar nennt sich gegenseitig.
def language_finding(page, href, target_page, by_path)
  return nil if target_page.nil? || page.lang.nil? || target_page.lang.nil?
  return nil if target_page.lang == page.lang

  matching = target_page.versions[page.lang]
  return nil if matching.nil? || matching == target_page.path

  counterpart = by_path[matching]
  return nil if counterpart.nil? || counterpart.versions[target_page.lang] != target_page.path

  Finding.new(page, href, 'Sprachbaum gewechselt',
             "Ziel ist #{target_page.lang}, die Seite #{page.lang} – " \
             "in #{page.lang} liegt es unter #{matching}")
end

# ---------------------------------------------------------------------------
# Selbsttest – die Prüfung an einer Site, die die Fehler ABSICHTLICH enthält
#
# Das eigene Repo taugt dafür nicht: Dort ist jeder Verweis heil, jedes Ziel übersetzt,
# und die interessanten Fälle entstehen gar nicht. Genau dieser blinde Fleck hat 2.5.1
# grün durchlaufen lassen. Hier steht deshalb eine kleine Site, in der jeder Befund
# einmal vorkommt – und ebenso jeder Fall, der KEIN Befund sein darf.
# ---------------------------------------------------------------------------
SELF_TEST_FILES = {
  # WEITERLEITUNGEN – eine gültige und eine tote. Ohne die zweite bliebe
  # unbemerkt, wenn read_redirects nichts mehr findet: Der Lauf wäre grün, und
  # eine kurze Adresse führte ins Leere.
  'umleitung-gut.html' =>
    %(<html lang="de"><head><meta http-equiv="refresh" content="0; url=gibt-es.html"></head><body></body></html>),
  'umleitung-tot.html' =>
    %(<html lang="de"><head><meta http-equiv="refresh" content="0; url=gibt-es-auch-nicht.html"></head><body></body></html>),
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
SELF_TEST_EXPECTED = [
  ['/', 'Ziel fehlt'],          # /leerer-ordner/ – Ordner ohne index.html
  ['/', 'Ziel fehlt'],          # /gibt-es-nicht.html
  ['/', 'Anker fehlt'],         # #gibt-es-nicht
  # Laufzeit-Anker: geprueft wird die FORM und das Layout der Zielseite.
  ['/', 'Anker fehlt'],         # praesentation.html#/kapitel – Form unbekannt
  ['/', 'Anker fehlt'],         # gibt-es.html#/3 – Ziel schaltet gar nicht
  ['/en/', 'Sprachbaum gewechselt'],
  ['/umleitung-tot.html', 'Ziel fehlt']   # <meta refresh> auf eine Seite, die es nicht gibt
].freeze

def self_test(baseurl)
  require 'tmpdir'
  errors = []
  Dir.mktmpdir('academy-links') do |tmp|
    site = File.join(tmp, '_site')
    SELF_TEST_FILES.each do |name, content|
      target = File.join(site, name)
      FileUtils.mkdir_p(File.dirname(target))
      File.write(target, content.gsub('/BASE/', baseurl.empty? ? '/' : "#{baseurl}/"), encoding: 'UTF-8')
    end

    # DURCH DEN NORMALISIERER, wie im echten Lauf. Ohne ihn prüfte der Selbsttest
    # eine Aufrufform, die es nicht gibt – und merkte nicht, dass `ignored?` seit
    # dem segmentweisen Vergleich normalisierte Muster erwartet.
    #
    # DREI SCHREIBWEISEN, ABSICHTLICH: Sie müssen dasselbe bedeuten, sonst ist die
    # Zusage „`theme` ≡ `/theme` ≡ `/theme/**`“ nur behauptet.
    %w[/ausgenommen/ ausgenommen /ausgenommen/**].each do |schreibweise|
      muster = normalize_patterns([schreibweise])
      pages_x = read_pages(site, baseurl, Scope.new([], muster))
      if pages_x.any? { |p| p[:path].start_with?('/ausgenommen/') }
        errors << "#{label}: Schreibweise `#{schreibweise}` nimmt die Seite nicht aus."
      end
    end
    # UND DIE GEGENPROBE: `/ausgenommen` darf `/ausgenommenes/` NICHT treffen.
    # Ein roher Präfixvergleich täte es, und die Seite fiele still aus der Prüfung.
    unless ignored?('/ausgenommenes/seite.html', normalize_patterns(['/ausgenommen']))
      # erwartet – nichts zu melden
    else
      errors << "#{label}: `/ausgenommen` trifft fälschlich `/ausgenommenes/`."
    end

    # DER EINSCHLUSS – und dass der Ausschluss ihn schlägt. Vier Aussagen, die
    # zusammen die ganze Regel ergeben; fällt eine, ist der Umfang einer Prüfung
    # ein anderer als der angegebene, und das fiele sonst niemandem auf.
    muster = normalize_patterns(['/ausgenommen'])
    nur = Scope.new(muster, [])
    errors << "#{label}: `--include` nimmt die benannte Seite aus." if nur.skips?('/ausgenommen/seite.html')
    errors << "#{label}: `--include` lässt eine nicht benannte Seite durch." unless nur.skips?('/')
    errors << "#{label}: Ohne Angabe fällt eine Seite heraus." if Scope.new([], []).skips?('/')
    unless Scope.new(muster, muster).skips?('/ausgenommen/seite.html')
      errors << "#{label}: Ein Ausschluss schlägt den Einschluss nicht."
    end

    scope = Scope.new([], normalize_patterns(['/ausgenommen/']))
    pages = read_pages(site, baseurl, scope)
    findings, = check(site, pages, baseurl, scope)

    read_count = pages.map(&:path).sort
    unless read_count.include?('/') && !read_count.include?('/partial.html')
      errors << "Auswahl der Quellseiten falsch: #{read_count.join(', ')}"
    end
    errors << 'Die ausgenommene Seite wurde gelesen.' if read_count.include?('/ausgenommen/seite.html')

    actual = findings.map { |b| [b.page.path, b.kind] }.sort
    expected = SELF_TEST_EXPECTED.sort
    if actual != expected
      errors << "erwartet: #{expected.inspect}"
      errors << "gefunden: #{actual.inspect}"
      findings.each { |b| errors << "  #{b.page.path}  #{b.href}  -> #{b.kind}: #{b.text}" }
    end
  end
  errors
end

# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------
site = nil
baseurl = nil
configs = []
ignore = []
only = []
require_site = false
self_test_only = false
# BESCHRIFTUNG, WENN DIESELBE SITE MEHRFACH GEPRÜFT WIRD. Seit Theme 3 filtert
# JEDER Build nach Zielgruppe, es gibt also regelmäßig mehr als einen – und zwei
# Ergebniszeilen „Verweise in Ordnung" nebeneinander sagen nicht, welcher Lauf
# welcher war. Genau dafür gibt es `--label` bei der Barrierefreiheitsmessung.
label = ''

argv = ARGV.dup
until argv.empty?
  case (arg = argv.shift)
  when '--site'         then site = argv.shift
  when '--baseurl'      then baseurl = argv.shift
  when '--config'       then configs << argv.shift
  when '--ignore'       then ignore << argv.shift
  when '--include'      then only << argv.shift
  when '--label'        then label = argv.shift.to_s
  when '--require-site' then require_site = true
  when '--self-test'    then self_test_only = true
  when '--help', '-h'
    puts File.read(__FILE__).lines[2..8].map { |z| z.sub(/\A# ?/, '') }.join
    exit 0
  else
    warn "Unbekannte Option: #{arg}"
    exit 2
  end
end

if self_test_only
  # Zweimal: einmal ohne und einmal mit `baseurl`. Das Abschneiden des Präfixes ist die
  # Stelle, an der eine Projektseite anders läuft als eine Benutzerseite – und die
  # einzige, die ein Lauf im eigenen Repo (baseurl leer) nie berührt.
  errors = ['', '/projekt'].flat_map { |b| self_test(b).map { |f| "baseurl #{b.empty? ? '(leer)' : b}: #{f}" } }
  if errors.empty?
    puts "Selbsttest der Verweisprüfung bestanden (#{SELF_TEST_FILES.size} Dateien, " \
         "#{SELF_TEST_EXPECTED.size} erwartete Befunde, mit und ohne baseurl)."
    exit 0
  end
  warn "FEHLER: Die Verweisprüfung selbst arbeitet nicht wie beschrieben:\n\n"
  errors.each { |f| warn "  #{f}" }
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
      data = YAML.safe_load(File.read(cfg), permitted_classes: [Date, Time], aliases: true) || {}
    rescue Psych::SyntaxError => e
      warn "FEHLER: #{cfg} ist kein gültiges YAML – #{e.message}"
      exit 2
    end
    baseurl = data['baseurl'] if data.key?('baseurl')
  end
end
baseurl = (baseurl || '').to_s.chomp('/')
baseurl = '/' + baseurl unless baseurl.empty? || baseurl.start_with?('/')

scope = Scope.new(normalize_patterns(only), normalize_patterns(ignore))

pages = read_pages(site, baseurl, scope)
if pages.empty?
  warn "FEHLER: Unter #{site}/ liegt keine einzige gebaute Seite."
  warn '       Eine Prüfung über die leere Menge ist kein Erfolg – sie ist ein Befund.'
  exit 2
end

findings, checked, root_absolute, root_absolute_dead = check(site, pages, baseurl, scope)

if findings.empty?
  puts "Verweise in Ordnung (#{pages.size} Seiten, #{checked} interne Verweise" \
       "#{baseurl.empty? ? '' : ", baseurl #{baseurl}"})."
  exit 0
end

findings.group_by { |b| b.page.path }.sort.each do |path, entries|
  puts "  #{path}"
  entries.each { |b| puts "    #{b.href}\n      #{b.kind}: #{b.text}" }
end
puts ''
puts "#{findings.size} Befund(e) auf #{findings.map { |b| b.page.path }.uniq.size} Seite(n)" \
     "#{label.empty? ? '' : " – #{label}"}."

# Ein falscher `baseurl` sieht sonst aus wie eine kaputte Site: JEDER wurzel-absolute
# Verweis schlägt fehl. Lieber einmal zu viel darauf hinweisen als die Liste abarbeiten.
if root_absolute.positive? && root_absolute_dead * 2 > root_absolute
  warn ''
  warn "HINWEIS: #{root_absolute_dead} von #{root_absolute} wurzel-absoluten Verweisen zeigen ins Leere."
  warn "         Das ist selten die Site und meist der baseurl (hier: #{baseurl.empty? ? '(leer)' : baseurl})."
  warn '         Wer beim Bauen `--baseurl` setzt, gibt hier denselben Wert mit.'
end

warn ''
warn 'FEHLER: Es gibt Verweise, die ins Leere zeigen. Jekyll baut das stumm – die Seite'
warn '        entsteht, der Link ist tot, und es fällt erst beim Klicken auf.'
exit 1
