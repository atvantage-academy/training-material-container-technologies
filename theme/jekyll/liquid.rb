#!/usr/bin/env ruby
# =============================================================================
# Liquid in den Quellen – steht da etwas, das nie ausgewertet wird?
#
#   ruby theme/jekyll/liquid.rb                        # Befunde ausgeben
#   ruby theme/jekyll/liquid.rb --source . --config _config.yml
#   ruby theme/jekyll/liquid.rb --require-liquid-off   # ohne Abschaltung scheitern
#   ruby theme/jekyll/liquid.rb --forbid-liquid-optin  # Ausnahmen sind Befunde
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
# `Dir.mktmpdir` und `FileUtils` braucht der Selbsttest – beide Standardbibliothek.
require 'fileutils'

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
MARKDOWN_EXTENSIONS = %w[.md .markdown .mkdown .mkdn .mkd].freeze
HTML_EXTENSIONS = %w[.html .htm .xhtml].freeze
FENCE = /\A[ \t]*(`{3,}|~{3,})/.freeze
FRONT_MATTER_OPEN = /\A---[ \t]*\r?\z/.freeze
FRONT_MATTER_CLOSE = /\A(?:---|\.\.\.)[ \t]*\r?\z/.freeze

# `file_scope` trägt nur die Ausnahme auf `defaults`-Ebene: dort ist `file` die
# Konfigurationsdatei, und der Bereich, den sie wieder anschaltet, wäre sonst
# nicht zu benennen.
Finding = Struct.new(:file, :line, :count, :kind, :file_scope)

def front_matter?(text)
  lines = text.to_s.split("\n", -1)
  return false unless lines.first.to_s.match?(FRONT_MATTER_OPEN)

  !lines.drop(1).index { |z| z.match?(FRONT_MATTER_CLOSE) }.nil?
end

# Das Front Matter ausgeblendet, die Zeilenzahl erhalten – ein Befund soll die
# Zeile nennen können, um die es geht. Es ist YAML, nicht Markdown.
def without_front_matter(text)
  text = text.to_s
  return text unless front_matter?(text)

  lines = text.split("\n", -1)
  closing = lines.drop(1).index { |z| z.match?(FRONT_MATTER_CLOSE) } + 1
  (0..closing).each { |i| lines[i] = '' }
  lines.join("\n")
end

# Jeder Codeblock und jeder Code-Span ausgeblendet. Ein `{{ name }}` in einem
# Vue-Beispiel ist ein Beispiel und kein Befund; wer es meldet, erzieht die
# Leserschaft dazu, das Werkzeug zu ignorieren.
def without_code(text)
  fence = nil
  text.to_s.split("\n", -1).map do |line|
    if fence
      fence = nil if line.match?(/\A[ \t]*#{Regexp.escape(fence)}[ \t]*\z/)
      ''
    elsif (hits = line.match(FENCE))
      fence = hits[1]
      ''
    else
      line.gsub(/`+[^`]*`+/, '')
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
def liquid_defaults(configs)
  defaults = []
  skipped = 0
  configs.each do |source, data|
    Array(data['defaults']).each_with_index do |entry, index|
      next unless entry.is_a?(Hash)

      value = entry.dig('values', 'render_with_liquid')
      next if value.nil?

      region = entry['scope'] || {}
      if region['type']
        skipped += 1
        next
      end
      defaults << { path: region['path'].to_s, off: value == false, rank: index,
                    source: source }
    end
  end
  [defaults, skipped]
end

# Deckt dieser Eintrag die Datei ab?
#
# JEKYLLS SEMANTIK, ZEILE FÜR ZEILE NACHGEBAUT – `frontmatter_defaults.rb`,
# `applies_path?`. Zwei Dinge daran überraschen und stehen deshalb hier:
#
#   1. OHNE `*` VERGLEICHT JEKYLL EINEN ROHEN PRÄFIX, nicht auf Verzeichnis-
#      grenze: `path_is_subpath?` ist schlicht `path.start_with?(parent_path)`.
#      `path: "trainings"` erfasst damit AUCH `trainingsheft/a.md`.
#   2. MIT `*` GLOBT JEKYLL GEGEN DAS DATEISYSTEM (`Dir.glob`) und prüft das
#      Ergebnis wieder als Präfix. Ein Muster trifft also nur, was es dort
#      wirklich gibt.
#
# HIER WIRD NICHT „SAUBERER" VERGLICHEN, und das ist der Punkt. Diese Prüfung
# beantwortet EINE Frage: Rendert Jekyll diese Datei ohne Liquid? Wer dabei
# strenger urteilt als der Renderer, hält eine Datei für „Liquid an", die Jekyll
# ohne Liquid baut – und überspringt sie. Das Werkzeug prüfte dann etwas anderes,
# als gebaut wird, und zwar still.
#
# `sanitize_path`: Ein führender Schrägstrich fällt weg, sonst bliebe der Pfad
# absolut und träfe nie.
#
# NICHT NACHGEBAUT ist `strip_collections_dir` – es greift nur bei gesetztem
# `collections_dir`, und Sammlungen liest diese Prüfung ohnehin nicht (jedes
# Pfadstück mit `_` am Anfang fällt weg).
def covers?(entry, relative, source = '.')
  scope = entry[:path].to_s
  return true if scope.empty?

  scope = scope.sub(%r{\A/+}, '')
  return relative.start_with?(scope) unless scope.include?('*')

  Dir.glob(File.join(source, scope)).any? do |treffer|
    relative.start_with?(treffer.delete_prefix("#{source}/"))
  end
end

# Ein `defaults`-Eintrag, der Liquid WIEDER ANSCHALTET – die Ausnahme auf
# Ordner- statt auf Seitenebene, und die teurere von beiden: Sie nimmt nicht
# eine Seite aus, sondern alle künftigen darunter gleich mit.
#
# Der Eintrag auf der Wurzel (`path: ""`) ist keine Ausnahme, sondern die
# Grundeinstellung der Site. Gezählt wird nur, was sich unter einer BREITEREN
# Abschaltung befindet.
def optin_scopes(defaults)
  defaults.reject { |entry| entry[:off] }.select do |entry|
    defaults.any? do |other|
      # MUSTER GEGEN MUSTER, nicht gegen eine Datei: Hier wird gefragt, ob ein
      # Eintrag unter einem breiteren liegt. Ein `Dir.glob` gegen das Dateisystem
      # hätte darauf keine Antwort, also bleibt es beim Präfix – dieselbe
      # Rechnung, die Jekyll ohne Wildcard anstellt.
      other[:off] && !other.equal?(entry) &&
        (other[:path].to_s.empty? || entry[:path].to_s.start_with?(other[:path].to_s))
    end
  end
end

# Der Eintrag, der für diese Datei gilt: längster passender `path`, bei gleicher
# Länge der spätere. Nil, wenn kein Eintrag greift.
def governing(relative, defaults, source = '.')
  defaults.select { |v| covers?(v, relative, source) }
          .max_by { |v| [v[:path].length, v[:rank]] }
end

# Setzt ein Projekt `plugins` selbst, ersetzt das die Theme-Vorgabe vollständig –
# dieselbe Regel wie bei `exclude`. Ohne jede Angabe gilt die Vorgabe des Themes,
# und die führt das Plugin.
def markdown_without_front_matter_is_page?(data)
  entries = data.reverse.find { |d| d.key?('plugins') }
  return true if entries.nil?

  Array(entries['plugins']).map(&:to_s).include?('jekyll-optional-front-matter')
end

def liquid_off?(relative, defaults, front_matter, source = '.')
  own = front_matter['render_with_liquid'] if front_matter
  return own == false unless own.nil?

  entry = governing(relative, defaults, source)
  entry ? entry[:off] : false
end

# --- Wer hebt die Abschaltung wieder auf? ------------------------------------
#
# `render_with_liquid` ist FRONT MATTER, kein globaler Schalter – einen solchen
# hat Jekyll nicht (jekyll/jekyll#9018). Eine Site schaltet Liquid deshalb über
# `defaults` für alle Seiten ab, und genau daraus folgt die Lücke: JEDE EINZELNE
# SEITE kann die Abschaltung mit `render_with_liquid: true` in ihrem eigenen
# Front Matter wieder aufheben, und ein Eintrag in `defaults` kann es für einen
# ganzen Ordner tun.
#
# FÜR DIE MEISTEN PROJEKTE IST DAS EINE ZULÄSSIGE AUSNAHME. Eine Seite, die
# Liquid vorführt, braucht Liquid. Deshalb ist es die Vorgabe, sie zu erlauben.
#
# FÜR EINEN VERBRAUCHER, DER OHNE LIQUID RENDERT, IST ES KEINE. Er liest
# `render_with_liquid` gar nicht erst – die Anweisung steht dort wörtlich auf
# der Seite. Schlimmer ist, was diese Prüfung dann tut: Sie übergeht die Datei
# stillschweigend, weil Liquid dort ja „an" ist. Ein grüner Lauf meldet „keine
# Liquid-Syntax", während sich eine Seite ausdrücklich ausgenommen hat – die
# Abschaltung, auf die sich die Prüfung stützt, gilt für sie nicht mehr.
#
# `--forbid-liquid-optin` macht die Ausnahme selbst zum Befund. ATLAS braucht
# das (Vertragsregel B35, ADR 0025): Dort ist „ohne Liquid" eine Zusage an den
# Verbraucher und nicht die Einstellung eines Autors. Eine Schulungsunterlage
# kann es je Zielgruppe verschieden halten – dieselbe Prüfung, einmal je
# gefilterter Fassung: In der Trainerfassung darf eine Seite Liquid anschalten,
# in der Teilnehmerfassung, die nach ATLAS geht, nicht.
def optin?(relative, defaults, front_matter, source = '.')
  own = front_matter['render_with_liquid'] if front_matter
  return false if own.nil? || own == false

  # Nur dort ein Befund, wo die Site Liquid sonst abgeschaltet HÄTTE. Wo ohnehin
  # gerendert wird, nimmt sich die Seite von nichts aus.
  entry = governing(relative, defaults, source)
  !entry.nil? && entry[:off]
end

# Die Zeile, in der die Seite sich ausnimmt – ein Befund ohne Zeile schickt den
# Leser auf die Suche.
def optin_line(text)
  lines = text.to_s.split("\n", -1)
  closing = lines.drop(1).index { |line| line.match?(FRONT_MATTER_CLOSE) }
  return 1 if closing.nil?

  hit = lines[1..closing].index { |line| line.match?(/\A[ \t]*render_with_liquid[ \t]*:/) }
  hit.nil? ? 1 : hit + 2
end

# --- Was Jekyll gar nicht erst ansieht ---------------------------------------
#
# Ohne diese Liste meldete die Prüfung README.md, AGENTS.md und jede Vorlage
# unter `vendor/` – Dateien, die nie eine Seite werden. ATLAS braucht das nicht:
# Dort ist der eingereichte Bereich bereits ausgewählt, hier steht ein ganzes
# Repository. Setzt ein Projekt `exclude` selbst, ERSETZT das die Theme-Liste
# vollständig; genau so verhält sich Jekyll, und genau so wird hier gelesen.
#
# `theme/` GEHÖRT DAZU: Dort liegt das ausgepackte npm-Paket. Dessen eigene
# Dateien – das `CHANGELOG.md` etwa – sind keine Quellen des Projekts, und
# gemeldet wäre dort ein Befund, den niemand beheben kann: Er kommt mit jedem
# Paket wieder. Dieselbe Begründung steht hinter `ignore: /theme/` und
# `exclude: theme` in den Prüf-Bausteinen.
ALWAYS_EXCLUDED = %w[_site .git .jekyll-cache node_modules vendor .github theme].freeze

def excluded?(relative, pattern)
  parts = relative.split('/')
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
  return true if parts.any? { |t| ALWAYS_EXCLUDED.include?(t) || t.start_with?('_') }

  pattern.any? do |m|
    m = m.to_s.chomp('/')
    relative == m || relative.start_with?("#{m}/") ||
      File.fnmatch?(m, relative, File::FNM_PATHNAME) ||
      File.fnmatch?(m, relative, File::FNM_PATHNAME | File::FNM_DOTMATCH) ||
      File.fnmatch?(m, File.basename(relative))
  end
end

def front_matter_data(text)
  return nil unless front_matter?(text)

  lines = text.split("\n", -1)
  closing = lines.drop(1).index { |z| z.match?(FRONT_MATTER_CLOSE) } + 1
  YAML.safe_load(lines[1...closing].join("\n"), permitted_classes: [Date, Time]) || {}
rescue Psych::Exception
  # NUR YAML-Fehler. Ein kaputtes Front Matter ist die Sache dessen, der die
  # Datei schreibt, und bricht hier nichts; ein Programmierfehler dagegen soll
  # auffallen und nicht als „leeres Front Matter" durchgehen.
  {}
end

# Ein Befund je DATEI, nicht je Fundstelle – von ATLAS übernommen. Wer zehn
# Verzweigungen in einer Datei hat, hat ein Problem und nicht zehn; die Zeile der
# ersten Fundstelle genügt zum Finden, die Anzahl sagt, wie viel Arbeit wartet.
def scan(source, defaults, pattern, md_without_fm = true, forbid_optin = false)
  findings = []
  checked = 0
  Dir.glob(File.join(source, '**', '*'), File::FNM_DOTMATCH).sort.each do |path|
    next unless File.file?(path)

    relative = path.delete_prefix("#{source}/")
    next if excluded?(relative, pattern)

    extension = File.extname(relative).downcase
    next unless MARKDOWN_EXTENSIONS.include?(extension) || HTML_EXTENSIONS.include?(extension)

    raw = File.read(path, encoding: 'UTF-8', invalid: :replace, undef: :replace)
    head = front_matter_data(raw)
    unless liquid_off?(relative, defaults, head, source)
      # Die Seite nimmt sich von der Abschaltung aus. Ob das ein Befund ist,
      # entscheidet der Aufrufer – übergangen wird sie in keinem Fall
      # unbemerkt: Sie zählt als geprüft, damit die Zahlen stimmen.
      next unless forbid_optin && optin?(relative, defaults, head, source)

      checked += 1
      findings << Finding.new(relative, optin_line(raw), 1, :optin)
      next
    end

    text = if MARKDOWN_EXTENSIONS.include?(extension)
             # Ohne `jekyll-optional-front-matter` ist Markdown ohne Front Matter
             # keine Seite, sondern eine kopierte Datei – Liquid rührt sie nicht an.
             without_code(without_front_matter(raw)) if md_without_fm || front_matter?(raw)
           elsif front_matter?(raw)
             without_front_matter(raw)
           end
    next if text.nil?

    checked += 1
    # Über den GANZEN Text, nicht Zeile für Zeile – sonst entginge jeder Tag mit
    # Zeilenumbruch. Die Zeilennummer kommt aus dem Offset des ersten Treffers.
    first = text.index(LIQUID)
    next if first.nil?

    findings << Finding.new(relative, text[0...first].count("\n") + 1,
                            text.scan(LIQUID).length, :syntax)
  end
  [findings, checked]
end

# Eine Spalte „Fundstellen" trüge für die drei Arten drei verschiedene
# Bedeutungen. Deshalb sagt der Bericht in Worten, was gefunden wurde.
def describe(finding)
  case finding.kind
  when :optin
    '`render_with_liquid: true` – hebt die Abschaltung für diese Seite auf'
  when :optin_scope
    "`defaults` schaltet Liquid für `#{finding.file_scope}` wieder an"
  else
    "Liquid-Syntax (#{finding.count} Fundstelle(n))"
  end
end

def write_report(file, findings, checked, label)
  title = label.to_s.empty? ? 'Liquid in den Quellen' : "Liquid in den Quellen (#{label})"
  lines = ["## #{title}", '']
  if findings.empty?
    lines << "✅ Keine Liquid-Syntax in #{checked} Quelle(n), die ohne Liquid gerendert werden."
  else
    # Die Zusammenfassung nennt nur, was tatsächlich vorliegt. „Der Ausdruck
    # steht wörtlich auf der Seite" über einem Bericht, der ausschließlich
    # Ausnahmen aufzählt, wäre eine andere Aussage als die gemeinte.
    syntax = findings.count { |f| f.kind == :syntax }
    exceptions = findings.size - syntax
    parts = ["⚠️ #{findings.size} Befund(e) bei #{checked} geprüften Quelle(n)."]
    if syntax.positive?
      parts << "#{syntax} Quelle(n) enthalten Liquid-Syntax und werden ohne Liquid " \
               'gerendert – der Ausdruck steht wörtlich auf der Seite.'
    end
    if exceptions.positive?
      parts << "#{exceptions} Stelle(n) schalten Liquid ausdrücklich wieder an. Ein " \
               'Verbraucher, der ohne Liquid rendert, liest diesen Schalter nicht: Die ' \
               'Seite geht ungeprüft durch und kommt dort wörtlich heraus.'
    end
    lines << parts.join(' ')
    lines << ''
    lines << '| Datei | Zeile | Befund |'
    lines << '|---|---|---|'
    findings.each { |f| lines << "| `#{f.file}` | #{f.line || '–'} | #{describe(f)} |" }
  end
  lines << ''
  File.write(file, "#{lines.join("\n")}\n")
end

# --- Selbsttest --------------------------------------------------------------
#
# „Beispiele sind Tests“: Die Ausnahmen sind der ganze Wert dieser Prüfung. Ein
# Werkzeug, das `{{ x }}` im Codeblock meldet, wird abgeschaltet und nicht
# repariert.
SELF_TEST_CASES = {
  'finding.md' => ["---\nlayout: page\n---\n", "{% if a %}x{% endif %}\n"],
  'comment.md' => ["---\nlayout: page\n---\n", "{%- comment -%}intern{%- endcomment -%}\n"],
  'codeblock.md' => ["---\nlayout: page\n---\n", "```vue\n{{ name }}\n```\n"],
  'codespan.md' => ["---\nlayout: page\n---\n", "Setze `{{ name }}` ein.\n"],
  'frontmatter.md' => ["---\ntitle: \"{{ nicht }}\"\n---\n", "Text.\n"],
  'plaintext.md' => ["---\nlayout: page\n---\n", "Eine einzelne { Klammer.\n"],
  'raw.html' => ["{% if a %}x{% endif %}\n"],
  'page.html' => ["---\nlayout: page\n---\n", "{% if a %}x{% endif %}\n"],
  'script.js' => ["const t = `{{ x }}`;\n"],
  'optin.md' => ["---\nrender_with_liquid: true\n---\n", "{% if a %}x{% endif %}\n"],
  # Ohne Front Matter: nur mit `jekyll-optional-front-matter` eine Seite.
  'without-front-matter.md' => ["{% if a %}x{% endif %}\n"],
  # Mehrzeilig – Liquid erlaubt das, und genau das entginge einer Zeilensuche.
  'multiline.md' => ["---\nlayout: page\n---\n", "{%- include b.html\n    titel=\"x\" -%}\n"],
  # Über eine Leerzeile hinweg: für Liquids Lexer ein Tag, also ein Befund.
  'paragraphs.md' => ["---\nlayout: page\n---\n", "Eine {{ Klammer hier.\n\nUnd }} dort.\n"],
  # Eine EINZELNE Klammer ohne Schließer ist kein Tag und bleibt es auch.
  'unclosed.md' => ["---\nlayout: page\n---\n", "Eine {{ Klammer ohne Ende.\n"]
}.freeze
SELF_TEST_EXPECTED = %w[comment.md finding.md multiline.md page.html paragraphs.md without-front-matter.md].freeze
# Dieselben Dateien, gelesen OHNE das Plugin: `ohne-fm.md` fällt weg.
SELF_TEST_EXPECTED_WITHOUT_PLUGIN = %w[comment.md finding.md multiline.md page.html paragraphs.md].freeze

def self_test
  require 'tmpdir'
  errors = []
  Dir.mktmpdir do |dir|
    SELF_TEST_CASES.each { |name, parts| File.write(File.join(dir, name), parts.join) }
    defaults = [{ path: '', off: true, rank: 0 }]
    findings, checked = scan(dir, defaults, [])
    reported = findings.map(&:file).sort
    errors << "gemeldet: #{reported.inspect}, erwartet: #{SELF_TEST_EXPECTED.sort.inspect}" \
      if reported != SELF_TEST_EXPECTED.sort
    errors << 'die Datei mit render_with_liquid: true wurde geprüft' if checked > SELF_TEST_CASES.size - 2
    # Ohne `jekyll-optional-front-matter` ist Markdown ohne Front Matter keine
    # Seite – Liquid rührt es nicht an, also darf es auch nicht gemeldet werden.
    without_plugin, = scan(dir, defaults, [], false)
    reported_without_plugin = without_plugin.map(&:file).sort
    errors << "ohne Plugin gemeldet: #{reported_without_plugin.inspect}, erwartet: #{SELF_TEST_EXPECTED_WITHOUT_PLUGIN.sort.inspect}" \
      if reported_without_plugin != SELF_TEST_EXPECTED_WITHOUT_PLUGIN.sort
    # Und die Gegenprobe: ohne Abschaltung darf NICHTS gemeldet werden.
    none, = scan(dir, [], [])
    errors << "ohne Abschaltung gemeldet: #{none.map(&:file).inspect}" unless none.empty?

    # `--forbid-liquid-optin`: Die Seite, die sich ausnimmt, kommt DAZU – und
    # zwar genau eine. Bliebe der Rest der Liste gleich lang, hätte der Schalter
    # bloß nichts kaputt gemacht; er soll aber auch etwas bewirken.
    strict, = scan(dir, defaults, [], true, true)
    expected_strict = (SELF_TEST_EXPECTED + ['optin.md']).sort
    errors << "mit --forbid-liquid-optin gemeldet: #{strict.map(&:file).sort.inspect}, " \
              "erwartet: #{expected_strict.inspect}" if strict.map(&:file).sort != expected_strict
    exception = strict.find { |f| f.file == 'optin.md' }
    errors << 'die Ausnahme wurde nicht als solche gekennzeichnet' if exception&.kind != :optin
    # Die Zeile muss auf den Schalter zeigen und nicht auf den Dateianfang –
    # sonst sucht der Leser im Front Matter von Hand.
    errors << "Zeile der Ausnahme: #{exception&.line.inspect}, erwartet: 2" if exception&.line != 2

    # JEKYLLS SCOPE-SEMANTIK, beide Zweige. Ohne diese Fälle urteilte die
    # Prüfung über eine Datei anders als der Renderer, der sie baut – und zwar
    # in die stille Richtung: Sie hielte eine Seite für „Liquid an" und
    # überspränge sie.
    Dir.mktmpdir do |quelle|
      FileUtils.mkdir_p(File.join(quelle, 'abschnitt', 'eins'))
      FileUtils.mkdir_p(File.join(quelle, 'trainingsheft'))
      File.write(File.join(quelle, 'abschnitt', 'eins', 'seite.md'), "x\n")
      File.write(File.join(quelle, 'trainingsheft', 'a.md'), "x\n")

      # Ohne `*`: ROHER PRÄFIX, keine Verzeichnisgrenze. So macht es Jekyll.
      unless covers?({ path: 'trainings' }, 'trainingsheft/a.md', quelle)
        errors << 'ohne Wildcard wird nicht als roher Präfix verglichen – Jekyll tut es.'
      end
      unless covers?({ path: 'trainings' }, 'trainings/a.md', quelle)
        errors << '`trainings` deckt `trainings/a.md` nicht ab.'
      end
      # Ein führender Schrägstrich fällt weg, sonst träfe der Pfad nie.
      unless covers?({ path: '/trainings' }, 'trainings/a.md', quelle)
        errors << 'der führende Schrägstrich wird nicht abgeschnitten.'
      end
      # Mit `*`: gegen das DATEISYSTEM geglobt.
      unless covers?({ path: 'abschnitt/*/seite.md' }, 'abschnitt/eins/seite.md', quelle)
        errors << 'ein Glob-Scope trifft die passende Datei nicht.'
      end
      if covers?({ path: 'abschnitt/*/gibt-es-nicht.md' }, 'abschnitt/eins/seite.md', quelle)
        errors << 'ein Glob-Scope trifft eine Datei, die er nicht meint.'
      end
      # Ein Muster, das es im Dateisystem nicht gibt, trifft nichts.
      if covers?({ path: 'fehlt/*/seite.md' }, 'abschnitt/eins/seite.md', quelle)
        errors << 'ein ins Leere zeigender Glob-Scope trifft trotzdem.'
      end
      errors << 'ein leerer Scope deckt nicht alles ab.' unless covers?({ path: '' }, 'x.md', quelle)
    end

    # Eine bereichsweite Ausnahme unter einer breiteren Abschaltung zählt,
    # dieselbe Angabe auf der Wurzel ist dagegen die Grundeinstellung.
    scopes = optin_scopes([{ path: '', off: true, rank: 0, source: '_config.yml' },
                           { path: 'trainer', off: false, rank: 1, source: '_config.yml' }])
    errors << "bereichsweite Ausnahme nicht erkannt: #{scopes.inspect}" if scopes.size != 1
    root_only = optin_scopes([{ path: '', off: false, rank: 0, source: '_config.yml' }])
    errors << 'die Wurzel wurde als Ausnahme gezählt' unless root_only.empty?
  end
  errors
end

# --- Aufruf ------------------------------------------------------------------

source = '.'
configs = []
markdown = nil
label = ''
require_off = false
forbid_optin = false
self_test_only = false

argv = ARGV.dup
until argv.empty?
  case (arg = argv.shift)
  when '--source' then source = argv.shift
  when '--config' then configs << argv.shift
  when '--markdown' then markdown = argv.shift
  when '--label' then label = argv.shift.to_s
  when '--require-liquid-off' then require_off = true
  when '--forbid-liquid-optin' then forbid_optin = true
  when '--self-test' then self_test_only = true
  when '--help', '-h'
    puts File.read(__FILE__).lines[2..8].map { |z| z.sub(/\A# ?/, '') }.join
    exit 0
  else
    warn "Unbekannte Option: #{arg}"
    exit 2
  end
end

if self_test_only
  errors = self_test
  if errors.empty?
    puts "Selbsttest der Liquid-Prüfung bestanden (#{SELF_TEST_CASES.size} Dateien, " \
         "#{SELF_TEST_EXPECTED.size} erwartete Befunde)."
    exit 0
  end
  warn "FEHLER: Die Liquid-Prüfung selbst arbeitet nicht wie beschrieben:\n\n"
  errors.each { |f| warn "  #{f}" }
  exit 1
end

source = source.chomp('/')
unless File.directory?(source)
  warn "FEHLER: #{source}/ gibt es nicht – ohne Quellen ist nichts zu prüfen."
  exit 2
end

configs = [File.join(source, '_config.yml')] if configs.empty?
data = []
configs.each do |path|
  next unless File.file?(path)

  begin
    data << [path, YAML.safe_load(File.read(path), permitted_classes: [Date, Time],
                                       aliases: true) || {}]
  rescue StandardError => e
    warn "FEHLER: #{path} ist kein gültiges YAML – #{e.message}"
    exit 2
  end
end

defaults, skipped = liquid_defaults(data)
parsed = data.map(&:last)
pattern = parsed.reverse.find { |d| d['exclude'] }&.fetch('exclude', nil) || []

if skipped.positive?
  warn "HINWEIS: #{skipped} defaults-Eintrag/-Einträge mit `scope.type` bleiben unberücksichtigt –"
  warn '         aus den Quellen allein ist die Sammlung einer Datei nicht sicher zu bestimmen.'
end

if defaults.none? { |v| v[:off] }
  message = 'In dieser Site ist Liquid nirgends abgeschaltet – es gibt nichts zu prüfen.'
  hint = 'Wer für einen Verbraucher baut, der ohne Liquid rendert, setzt in der _config.yml ' \
            '`defaults: [{ scope: { path: "" }, values: { render_with_liquid: false } }]`.'
  if require_off
    warn "FEHLER: #{message}"
    warn "        Die Prüfung wurde ausdrücklich angefordert; eine Prüfung über die leere Menge"
    warn '        ist kein Erfolg. ' + hint
    exit 2
  end
  puts message
  puts hint
  write_report(markdown, [], 0, label) if markdown
  exit 0
end

findings, checked = scan(source, defaults, pattern,
                        markdown_without_front_matter_is_page?(parsed), forbid_optin)

# Die bereichsweiten Ausnahmen ZUERST: Wer einen ganzen Ordner wieder
# anschaltet, findet darunter womöglich keine einzige gemeldete Seite mehr –
# die Prüfung hat sie ja alle übersprungen. Der Eintrag ist dann die Ursache
# und gehört an den Anfang der Liste.
if forbid_optin
  findings = optin_scopes(defaults).map do |entry|
    Finding.new(entry[:source], nil, 1, :optin_scope,
                entry[:path].empty? ? '/' : entry[:path])
  end + findings
end
write_report(markdown, findings, checked, label) if markdown

# EINE PRÜFUNG ÜBER DIE LEERE MENGE IST KEIN ERFOLG – dieselbe Regel wie in
# links.rb. Liquid ist irgendwo abgeschaltet (sonst stünden wir hier nicht),
# aber unter dem abgeschalteten Bereich liegt keine einzige Quelle. Das sieht
# von außen aus wie ein sauberer Lauf und ist in Wahrheit ein Bereich, den es
# nicht gibt: ein `scope.path`, der ins Leere zeigt, oder ein Inhalt, der noch
# nicht da ist. Genau an einem Tor, das „ohne Liquid" zusagt, wäre das die
# teuerste Art zu schweigen.
if checked.zero?
  warn 'FEHLER: Liquid ist abgeschaltet, aber darunter liegt keine einzige Quelle.'
  warn '        Zeigt der `scope.path` des `defaults`-Eintrags ins Leere?'
  warn "        Abgeschaltet für: #{defaults.select { |v| v[:off] }
                                            .map { |v| v[:path].empty? ? '/' : v[:path] }
                                            .uniq.join(', ')}"
  exit 2
end

if findings.empty?
  puts "Keine Liquid-Syntax in #{checked} Quelle(n), die ohne Liquid gerendert werden."
  exit 0
end

findings.each do |f|
  puts "  #{f.file}#{f.line ? ":#{f.line}" : ''}"
  puts "    #{describe(f).gsub('`', '')}"
end
puts ''
puts "#{findings.size} Befund(e) bei #{checked} geprüften Quelle(n)."
warn ''
if findings.any? { |f| f.kind == :syntax }
  warn 'FEHLER: Diese Quellen werden ohne Liquid gerendert. Jede Anweisung darin wird'
  warn '        gedruckt statt ausgewertet – ein `{% comment %}` stellt dabei seine'
  warn '        internen Notizen in die Öffentlichkeit.'
end
if findings.any? { |f| f.kind != :syntax }
  warn 'FEHLER: Wo `render_with_liquid: true` steht, hilft der Schalter nicht: Ein'
  warn '        Verbraucher, der ohne Liquid rendert, liest ihn gar nicht erst. Die'
  warn '        Seite geht an dieser Prüfung vorbei und kommt dort wörtlich heraus.'
  warn '        Sie braucht eine Fassung ohne Liquid.'
end
exit 1
