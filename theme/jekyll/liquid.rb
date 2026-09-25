#!/usr/bin/env ruby
# =============================================================================
# Liquid in den Quellen – steht da etwas, das nie ausgewertet wird?
#
#   ruby theme/jekyll/liquid.rb                        # Befunde ausgeben
#   ruby theme/jekyll/liquid.rb --source . --config _config.yml
#   ruby theme/jekyll/liquid.rb --require-liquid-off   # ohne Abschaltung scheitern
#   ruby theme/jekyll/liquid.rb --markdown bericht.md  # Bericht für die Zusammenfassung
#   ruby theme/jekyll/liquid.rb --self-test            # nur die Prüfung selbst prüfen
#
# WOFÜR: Wer seine Quellen an einen Verbraucher übergibt, der sie OHNE Liquid
# rendert, bekommt jede Liquid-Anweisung wörtlich auf die Seite gedruckt. Aus
# `{% if site.audience == 'learner' %}` wird sichtbarer Text, und ein
# `{% comment %}`-Block – der sonst NICHTS anzeigt – stellt seine internen
# Notizen in die Öffentlichkeit. Das ist der teure Fall: Redaktionsnotizen sind
# per Konstruktion das, was nicht erscheinen soll.
#
# DIESE PRÜFUNG LÄUFT NUR, WENN LIQUID AUS IST – und das ist ihr ganzer Witz.
# Solange Liquid läuft, ist eine Liquid-Anweisung Absicht und funktioniert; sie
# zu melden wäre reiner Lärm. Die Frage „ist Liquid aus?“ beantwortet nicht diese
# Datei, sondern die Site selbst, in ihrer `_config.yml`:
#
#     defaults:
#       - scope: { path: "" }
#         values:
#           render_with_liquid: false
#
# Das ist Jekylls eigener Schalter, kein erfundener. Wer ihn setzt, baut ab
# sofort so, wie der Verbraucher bauen wird – und diese Prüfung sagt ihm, wo er
# sich noch auf Liquid verlässt. Ohne den Schalter gibt es nichts zu prüfen, und
# das ist kein Fehler, sondern eine Aussage über die Site.
#
# GEPRÜFT WIRD GEGEN DIE QUELLEN, nicht gegen das gebaute `_site` – anders als
# bei links.rb, contrast.rb und a11y.mjs. Der Grund ist der Befund selbst: Zu
# reparieren ist die QUELLE, und nur sie kennt Datei und Zeile. Im gebauten HTML
# stünde der Text irgendwo mitten auf einer Seite, und wer ihn dort findet, sucht
# den Ursprung von Hand.
#
# WAS GELESEN WIRD, und vor allem, was NICHT:
#
#   .md .markdown .mkdown .mkdn .mkd   ohne Front Matter, ohne umzäunte
#                                      Codeblöcke, ohne Code-Spans
#   .html .htm .xhtml                  NUR mit Front Matter – ohne eines rührt
#                                      Jekyll die Datei nicht an
#
# LIQUID IST KEIN PLUGIN, sondern Jekylls Kern – es gibt keine Site ohne. Die
# Frage ist nur, WELCHE Dateien hindurchlaufen: die mit Front Matter immer, die
# ohne gar nicht. Eine Ausnahme macht `jekyll-optional-front-matter`: Es befördert
# Markdown OHNE Front Matter zu einer Seite, und damit läuft auch die durch Liquid.
#
# Ob das Plugin wirkt, wird deshalb aus der Konfiguration GELESEN und nicht
# angenommen – in Jekylls Semantik: Setzt ein Projekt `plugins` selbst, ERSETZT
# das die Theme-Vorgabe vollständig, und das Plugin ist nur dabei, wenn es dort
# steht. Ohne jede `plugins`-Angabe gilt die Vorgabe des Themes, die es führt.
# Fehlt es, wird Markdown ohne Front Matter nicht gelesen: Die Datei wird
# unverändert kopiert und ist keine Seite, die jemand zu sehen bekommt.
#   alles andere                       gar nicht, besonders CSS und JavaScript:
#                                      `{{` ist dort meist Template-Syntax einer
#                                      anderen Sprache und hat mit Liquid nichts
#                                      zu tun
#
# DIE MUSTERERKENNUNG IST DIE VON ATLAS, WÖRTLICH ÜBERNOMMEN (Regel 35,
# `atlas_contract/content_check.rb`). Zwei Werkzeuge, die über dieselbe Datei
# verschieden urteilen, sind schlimmer als eines – wer hier eine Klammer anfasst,
# fasst sie dort mit an.
#
# WO DIESE LESART ENDET: Ein eingerückter Codeblock (vier Leerzeichen, kein
# Zaun) wird als Fließtext gelesen. Ihn von einem fortgesetzten Listenpunkt zu
# unterscheiden braucht einen vollständigen Block-Parser; der Preis ist ein
# Befund zu viel, nie einer zu wenig. Dieselbe Richtung gilt für mehrzeilige
# Tags: Ein Tag darf sich über beliebig viele Zeilen ziehen, Leerzeilen
# eingeschlossen – was syntaktisch ein Liquid-Tag ist, wird gefunden.
#
# RÜCKGABEWERTE, wie bei den übrigen Werkzeugen des Themes:
#   0  nichts zu beanstanden (oder nichts zu prüfen)
#   1  Befunde
#   2  die Prüfung konnte nicht laufen
# =============================================================================

require 'yaml'
# `date` ausdrücklich: Ohne sie kennt Ruby `Date` nicht, und jedes
# `permitted_classes: [Date, Time]` unten wäre ein NameError statt einer
# YAML-Prüfung – ein Fehler, den ein weiter Rettungsblock still verschluckt.
require 'date'

# Das Muster von ATLAS (`AtlasContract::ContentCheck`), Zeichen für Zeichen – nur
# mit `/m`, damit ein Tag sich über Zeilen ziehen darf.
#
# WARUM `/m` SEIN MUSS: Liquid erlaubt Zeilenumbrüche IM Tag, und ATLAS liest
# Zeile für Zeile. Ein mehrzeiliges
#
#     {%- include baustein.html
#         titel="…" -%}
#
# entgeht damit vollständig. Maßgeblich ist, was Liquids eigener Lexer als Tag
# liest, nicht, was bequem zu suchen ist: Was syntaktisch ein Tag ist, muss
# gefunden werden.
#
# KEINE SCHRANKE ÜBER DIE LEERZEILE. Der Gedanke lag nahe – zwei zufällige
# Klammern in getrennten Absätzen wären dann kein Befund –, aber er sparte am
# falschen Ende. Fließtext mit einer `{{` im einen und einer `}}` im übernächsten
# Absatz gibt es faktisch nicht; ein Tag, das der Prüfung entgeht, geht dagegen
# ungesehen auf die Seite. Ein Fehlalarm kostet einen Blick, ein übersehener
# Befund kostet die Veröffentlichung. Und Liquid selbst zieht die Grenze auch
# nicht: Es liest über die Leerzeile hinweg und wirft dann einen Syntaxfehler.
#
# `.*?` bleibt nicht-gierig: Gesucht wird der NÄCHSTE Schließer, nicht der letzte.
LIQUID = /\{\{.*?\}\}|\{%.*?%\}/m.freeze
MARKDOWN_ENDUNGEN = %w[.md .markdown .mkdown .mkdn .mkd].freeze
HTML_ENDUNGEN = %w[.html .htm .xhtml].freeze
ZAUN = /\A[ \t]*(`{3,}|~{3,})/.freeze
FRONT_MATTER_AUF = /\A---[ \t]*\r?\z/.freeze
FRONT_MATTER_ZU = /\A(?:---|\.\.\.)[ \t]*\r?\z/.freeze

Befund = Struct.new(:datei, :zeile, :anzahl)

def front_matter?(text)
  zeilen = text.to_s.split("\n", -1)
  return false unless zeilen.first.to_s.match?(FRONT_MATTER_AUF)

  !zeilen.drop(1).index { |z| z.match?(FRONT_MATTER_ZU) }.nil?
end

# Das Front Matter ausgeblendet, die Zeilenzahl erhalten – ein Befund soll die
# Zeile nennen können, um die es geht. Es ist YAML, nicht Markdown.
def ohne_front_matter(text)
  text = text.to_s
  return text unless front_matter?(text)

  zeilen = text.split("\n", -1)
  zu = zeilen.drop(1).index { |z| z.match?(FRONT_MATTER_ZU) } + 1
  (0..zu).each { |i| zeilen[i] = '' }
  zeilen.join("\n")
end

# Jeder Codeblock und jeder Code-Span ausgeblendet. Ein `{{ name }}` in einem
# Vue-Beispiel ist ein Beispiel und kein Befund; wer es meldet, erzieht die
# Leserschaft dazu, das Werkzeug zu ignorieren.
def ohne_code(text)
  zaun = nil
  text.to_s.split("\n", -1).map do |zeile|
    if zaun
      zaun = nil if zeile.match?(/\A[ \t]*#{Regexp.escape(zaun)}[ \t]*\z/)
      ''
    elsif (treffer = zeile.match(ZAUN))
      zaun = treffer[1]
      ''
    else
      zeile.gsub(/`+[^`]*`+/, '')
    end
  end.join("\n")
end

# --- Ist Liquid aus? ---------------------------------------------------------
#
# Zwei Quellen, in Jekylls eigener Rangfolge: Das Front Matter einer Datei
# gewinnt gegen jede Vorgabe; darunter entscheidet der `defaults`-Eintrag mit dem
# LÄNGSTEN passenden `path`, bei gleicher Länge der SPÄTERE. Ohne Angabe ist
# Liquid an – so verhält sich Jekyll, und so muss sich diese Prüfung verhalten,
# sonst meldet sie Dateien, die sehr wohl gerendert werden.
#
# `scope.type` wird NICHT ausgewertet. Aus den Quellen allein ist die Sammlung
# einer Datei nicht sicher zu bestimmen, und ein falsch geratener Typ wäre
# schlimmer als ein ausgelassener: Ein Eintrag mit `type` bleibt deshalb
# unberücksichtigt und wird im Bericht genannt.
def liquid_vorgaben(konfigurationen)
  vorgaben = []
  uebergangen = 0
  konfigurationen.each do |daten|
    Array(daten['defaults']).each_with_index do |eintrag, index|
      next unless eintrag.is_a?(Hash)

      wert = eintrag.dig('values', 'render_with_liquid')
      next if wert.nil?

      bereich = eintrag['scope'] || {}
      if bereich['type']
        uebergangen += 1
        next
      end
      vorgaben << { pfad: bereich['path'].to_s, aus: wert == false, rang: index }
    end
  end
  [vorgaben, uebergangen]
end

# Setzt ein Projekt `plugins` selbst, ersetzt das die Theme-Vorgabe vollständig –
# dieselbe Regel wie bei `exclude`. Ohne jede Angabe gilt die Vorgabe des Themes,
# und die führt das Plugin.
def markdown_ohne_front_matter_ist_seite?(daten)
  liste = daten.reverse.find { |d| d.key?('plugins') }
  return true if liste.nil?

  Array(liste['plugins']).map(&:to_s).include?('jekyll-optional-front-matter')
end

def liquid_aus?(relativ, vorgaben, front_matter)
  eigen = front_matter['render_with_liquid'] if front_matter
  return eigen == false unless eigen.nil?

  passend = vorgaben.select do |v|
    v[:pfad].empty? || relativ == v[:pfad] || relativ.start_with?("#{v[:pfad].chomp('/')}/")
  end
  return false if passend.empty?

  passend.max_by { |v| [v[:pfad].length, v[:rang]] }[:aus]
end

# --- Was Jekyll gar nicht erst ansieht ---------------------------------------
#
# Ohne diese Liste meldete die Prüfung README.md, AGENTS.md und jede Vorlage
# unter `vendor/` – Dateien, die nie eine Seite werden. ATLAS braucht das nicht:
# Dort ist der eingereichte Bereich bereits ausgewählt, hier steht ein ganzes
# Repository. Setzt ein Projekt `exclude` selbst, ERSETZT das die Theme-Liste
# vollständig; genau so verhält sich Jekyll, und genau so wird hier gelesen.
IMMER_AUS = %w[_site .git .jekyll-cache node_modules vendor .github].freeze

def ausgeschlossen?(relativ, muster)
  teile = relativ.split('/')
  # JEDES Pfadstück mit `_` am Anfang, nicht nur das erste. Die Layouts und
  # Includes des Themes liegen unter `theme/jekyll/_layouts/` – sie sind Liquid
  # von Berufs wegen, und eine Prüfung, die sie meldet, meldet ausgerechnet das,
  # was niemand ändern darf. Gemessen am `playground`: drei Fehlalarme auf zwei
  # echte Befunde.
  #
  # WO DAS ENDET: Eine Jekyll-Sammlung (`_posts` und eigene) wird damit ebenfalls
  # nicht gelesen. Für eine Schulungsunterlage ist das folgenlos – sie besteht aus
  # gewöhnlichen Seiten –, und ATLAS liest aus demselben Grund nur deklarierte
  # Artefaktquellen.
  return true if teile.any? { |t| IMMER_AUS.include?(t) || t.start_with?('_') }

  muster.any? do |m|
    m = m.to_s.chomp('/')
    relativ == m || relativ.start_with?("#{m}/") ||
      File.fnmatch?(m, relativ, File::FNM_PATHNAME) ||
      File.fnmatch?(m, relativ, File::FNM_PATHNAME | File::FNM_DOTMATCH) ||
      File.fnmatch?(m, File.basename(relativ))
  end
end

def front_matter_daten(text)
  return nil unless front_matter?(text)

  zeilen = text.split("\n", -1)
  zu = zeilen.drop(1).index { |z| z.match?(FRONT_MATTER_ZU) } + 1
  YAML.safe_load(zeilen[1...zu].join("\n"), permitted_classes: [Date, Time]) || {}
rescue Psych::Exception
  # NUR YAML-Fehler. Ein kaputtes Front Matter ist die Sache dessen, der die
  # Datei schreibt, und bricht hier nichts; ein Programmierfehler dagegen soll
  # auffallen und nicht als „leeres Front Matter" durchgehen.
  {}
end

# Ein Befund je DATEI, nicht je Fundstelle – von ATLAS übernommen. Wer zehn
# Verzweigungen in einer Datei hat, hat ein Problem und nicht zehn; die Zeile der
# ersten Fundstelle genügt zum Finden, die Anzahl sagt, wie viel Arbeit wartet.
def pruefen(quelle, vorgaben, muster, md_ohne_fm = true)
  befunde = []
  geprueft = 0
  Dir.glob(File.join(quelle, '**', '*'), File::FNM_DOTMATCH).sort.each do |pfad|
    next unless File.file?(pfad)

    relativ = pfad.delete_prefix("#{quelle}/")
    next if ausgeschlossen?(relativ, muster)

    endung = File.extname(relativ).downcase
    next unless MARKDOWN_ENDUNGEN.include?(endung) || HTML_ENDUNGEN.include?(endung)

    roh = File.read(pfad, encoding: 'UTF-8', invalid: :replace, undef: :replace)
    kopf = front_matter_daten(roh)
    next unless liquid_aus?(relativ, vorgaben, kopf)

    text = if MARKDOWN_ENDUNGEN.include?(endung)
             # Ohne `jekyll-optional-front-matter` ist Markdown ohne Front Matter
             # keine Seite, sondern eine kopierte Datei – Liquid rührt sie nicht an.
             ohne_code(ohne_front_matter(roh)) if md_ohne_fm || front_matter?(roh)
           elsif front_matter?(roh)
             ohne_front_matter(roh)
           end
    next if text.nil?

    geprueft += 1
    # Über den GANZEN Text, nicht Zeile für Zeile – sonst entginge jeder Tag mit
    # Zeilenumbruch. Die Zeilennummer kommt aus dem Offset des ersten Treffers.
    erster = text.index(LIQUID)
    next if erster.nil?

    befunde << Befund.new(relativ, text[0...erster].count("\n") + 1,
                          text.scan(LIQUID).length)
  end
  [befunde, geprueft]
end

def bericht_schreiben(datei, befunde, geprueft, label)
  titel = label.to_s.empty? ? 'Liquid in den Quellen' : "Liquid in den Quellen (#{label})"
  zeilen = ["## #{titel}", '']
  if befunde.empty?
    zeilen << "✅ Keine Liquid-Syntax in #{geprueft} Quelle(n), die ohne Liquid gerendert werden."
  else
    zeilen << "⚠️ #{befunde.size} von #{geprueft} geprüften Quelle(n) enthalten Liquid-Syntax. " \
              'Diese Dateien werden ohne Liquid gerendert – der Ausdruck steht wörtlich auf der Seite.'
    zeilen << ''
    zeilen << '| Datei | Zeile | Fundstellen |'
    zeilen << '|---|---|---|'
    befunde.each { |b| zeilen << "| `#{b.datei}` | #{b.zeile} | #{b.anzahl} |" }
  end
  zeilen << ''
  File.write(datei, "#{zeilen.join("\n")}\n")
end

# --- Selbsttest --------------------------------------------------------------
#
# „Beispiele sind Tests“: Die Ausnahmen sind der ganze Wert dieser Prüfung. Ein
# Werkzeug, das `{{ x }}` im Codeblock meldet, wird abgeschaltet und nicht
# repariert.
SELBSTTEST = {
  'befund.md' => ["---\nlayout: page\n---\n", "{% if a %}x{% endif %}\n"],
  'kommentar.md' => ["---\nlayout: page\n---\n", "{%- comment -%}intern{%- endcomment -%}\n"],
  'codeblock.md' => ["---\nlayout: page\n---\n", "```vue\n{{ name }}\n```\n"],
  'codespan.md' => ["---\nlayout: page\n---\n", "Setze `{{ name }}` ein.\n"],
  'frontmatter.md' => ["---\ntitle: \"{{ nicht }}\"\n---\n", "Text.\n"],
  'klartext.md' => ["---\nlayout: page\n---\n", "Eine einzelne { Klammer.\n"],
  'roh.html' => ["{% if a %}x{% endif %}\n"],
  'seite.html' => ["---\nlayout: page\n---\n", "{% if a %}x{% endif %}\n"],
  'skript.js' => ["const t = `{{ x }}`;\n"],
  'an.md' => ["---\nrender_with_liquid: true\n---\n", "{% if a %}x{% endif %}\n"],
  # Ohne Front Matter: nur mit `jekyll-optional-front-matter` eine Seite.
  'ohne-fm.md' => ["{% if a %}x{% endif %}\n"],
  # Mehrzeilig – Liquid erlaubt das, und genau das entginge einer Zeilensuche.
  'mehrzeilig.md' => ["---\nlayout: page\n---\n", "{%- include b.html\n    titel=\"x\" -%}\n"],
  # Ueber eine Leerzeile hinweg: fuer Liquids Lexer ein Tag, also ein Befund.
  'absaetze.md' => ["---\nlayout: page\n---\n", "Eine {{ Klammer hier.\n\nUnd }} dort.\n"],
  # Eine EINZELNE Klammer ohne Schliesser ist kein Tag und bleibt es auch.
  'offen.md' => ["---\nlayout: page\n---\n", "Eine {{ Klammer ohne Ende.\n"]
}.freeze
SELBSTTEST_ERWARTET = %w[absaetze.md befund.md kommentar.md mehrzeilig.md ohne-fm.md seite.html].freeze
# Dieselben Dateien, gelesen OHNE das Plugin: `ohne-fm.md` faellt weg.
SELBSTTEST_ERWARTET_OHNE_PLUGIN = %w[absaetze.md befund.md kommentar.md mehrzeilig.md seite.html].freeze

def selbsttest
  require 'tmpdir'
  fehler = []
  Dir.mktmpdir do |dir|
    SELBSTTEST.each { |name, teile| File.write(File.join(dir, name), teile.join) }
    vorgaben = [{ pfad: '', aus: true, rang: 0 }]
    befunde, geprueft = pruefen(dir, vorgaben, [])
    gemeldet = befunde.map(&:datei).sort
    fehler << "gemeldet: #{gemeldet.inspect}, erwartet: #{SELBSTTEST_ERWARTET.sort.inspect}" \
      if gemeldet != SELBSTTEST_ERWARTET.sort
    fehler << 'die Datei mit render_with_liquid: true wurde geprüft' if geprueft > SELBSTTEST.size - 2
    # Ohne `jekyll-optional-front-matter` ist Markdown ohne Front Matter keine
    # Seite – Liquid ruehrt es nicht an, also darf es auch nicht gemeldet werden.
    ohne_plugin, = pruefen(dir, vorgaben, [], false)
    gemeldet2 = ohne_plugin.map(&:datei).sort
    fehler << "ohne Plugin gemeldet: #{gemeldet2.inspect}, erwartet: #{SELBSTTEST_ERWARTET_OHNE_PLUGIN.sort.inspect}" \
      if gemeldet2 != SELBSTTEST_ERWARTET_OHNE_PLUGIN.sort
    # Und die Gegenprobe: ohne Abschaltung darf NICHTS gemeldet werden.
    leer, = pruefen(dir, [], [])
    fehler << "ohne Abschaltung gemeldet: #{leer.map(&:datei).inspect}" unless leer.empty?
  end
  fehler
end

# --- Aufruf ------------------------------------------------------------------

quelle = '.'
konfigurationen = []
markdown = nil
label = ''
require_aus = false
selbsttest_nur = false

argv = ARGV.dup
until argv.empty?
  case (arg = argv.shift)
  when '--source' then quelle = argv.shift
  when '--config' then konfigurationen << argv.shift
  when '--markdown' then markdown = argv.shift
  when '--label' then label = argv.shift.to_s
  when '--require-liquid-off' then require_aus = true
  when '--self-test' then selbsttest_nur = true
  when '--help', '-h'
    puts File.read(__FILE__).lines[2..7].map { |z| z.sub(/\A# ?/, '') }.join
    exit 0
  else
    warn "Unbekannte Option: #{arg}"
    exit 2
  end
end

if selbsttest_nur
  fehler = selbsttest
  if fehler.empty?
    puts "Selbsttest der Liquid-Prüfung bestanden (#{SELBSTTEST.size} Dateien, " \
         "#{SELBSTTEST_ERWARTET.size} erwartete Befunde)."
    exit 0
  end
  warn "FEHLER: Die Liquid-Prüfung selbst arbeitet nicht wie beschrieben:\n\n"
  fehler.each { |f| warn "  #{f}" }
  exit 1
end

quelle = quelle.chomp('/')
unless File.directory?(quelle)
  warn "FEHLER: #{quelle}/ gibt es nicht – ohne Quellen ist nichts zu prüfen."
  exit 2
end

konfigurationen = [File.join(quelle, '_config.yml')] if konfigurationen.empty?
daten = []
konfigurationen.each do |pfad|
  next unless File.file?(pfad)

  begin
    daten << (YAML.safe_load(File.read(pfad), permitted_classes: [Date, Time], aliases: true) || {})
  rescue StandardError => e
    warn "FEHLER: #{pfad} ist kein gültiges YAML – #{e.message}"
    exit 2
  end
end

vorgaben, uebergangen = liquid_vorgaben(daten)
muster = daten.reverse.find { |d| d['exclude'] }&.fetch('exclude', nil) || []

if uebergangen.positive?
  warn "HINWEIS: #{uebergangen} defaults-Eintrag/-Einträge mit `scope.type` bleiben unberücksichtigt –"
  warn '         aus den Quellen allein ist die Sammlung einer Datei nicht sicher zu bestimmen.'
end

if vorgaben.none? { |v| v[:aus] }
  meldung = 'In dieser Site ist Liquid nirgends abgeschaltet – es gibt nichts zu prüfen.'
  hinweis = 'Wer für einen Verbraucher baut, der ohne Liquid rendert, setzt in der _config.yml ' \
            '`defaults: [{ scope: { path: "" }, values: { render_with_liquid: false } }]`.'
  if require_aus
    warn "FEHLER: #{meldung}"
    warn "        Die Prüfung wurde ausdrücklich angefordert; eine Prüfung über die leere Menge"
    warn '        ist kein Erfolg. ' + hinweis
    exit 2
  end
  puts meldung
  puts hinweis
  bericht_schreiben(markdown, [], 0, label) if markdown
  exit 0
end

befunde, geprueft = pruefen(quelle, vorgaben, muster, markdown_ohne_front_matter_ist_seite?(daten))
bericht_schreiben(markdown, befunde, geprueft, label) if markdown

if befunde.empty?
  puts "Keine Liquid-Syntax in #{geprueft} Quelle(n), die ohne Liquid gerendert werden."
  exit 0
end

befunde.each do |b|
  puts "  #{b.datei}:#{b.zeile}"
  puts "    #{b.anzahl} Fundstelle(n) – ohne Liquid steht der Ausdruck wörtlich auf der Seite."
end
puts ''
puts "#{befunde.size} von #{geprueft} geprüften Quelle(n) mit Liquid-Syntax."
warn ''
warn 'FEHLER: Diese Quellen werden ohne Liquid gerendert. Jede Anweisung darin wird'
warn '        gedruckt statt ausgewertet – ein `{% comment %}` stellt dabei seine'
warn '        internen Notizen in die Öffentlichkeit.'
exit 1
