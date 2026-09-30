#!/usr/bin/env ruby
# =============================================================================
# Prüft die Konfiguration und das Front Matter einer Academy-Site gegen die
# JSON-Schemas dieses Verzeichnisses.
#
#   ruby theme/jekyll/schema/validate.rb          # ganzes Repo
#   ruby validate.rb --root . --schemas /tmp/schema/1
#   ruby validate.rb --config _config.yml --config _config.ci.yml
#   ruby validate.rb --self-test                  # nur die Schemas prüfen
#
# WARUM RUBY OHNE GEMS: Das Skript läuft in drei Umgebungen – Doku-Pipeline,
# Schulungs-Pipeline und lokal im Container. Ruby ist überall da (Jekyll), YAML
# und JSON sind Standardbibliothek. Ein zusätzliches Gem (json_schemer) wäre eine
# vierte Sache, die installiert sein muss, damit eine Prüfung überhaupt läuft.
#
# WARUM EIN EIGENER, KLEINER VALIDATOR: Er deckt bewusst nur den Draft-07-Ausschnitt
# ab, den die Schemas verwenden (siehe SCHLUESSELWOERTER). Damit die IDE und diese
# Prüfung nie unterschiedlich urteilen, dürfen die Schemas diesen Ausschnitt NICHT
# verlassen – wer ein weiteres Schlüsselwort braucht, ergänzt es hier mit.
#
# EXIT-CODES:  0 = alles geprüft und in Ordnung
#              1 = Verstöße gefunden (Liste auf stderr)
#              2 = die Prüfung konnte nicht laufen (Schema fehlt, YAML kaputt,
#                  KEINE Seite gefunden). Eine Prüfung über die leere Menge ist
#                  kein Erfolg – sie ist ein Befund.
#
# Schema-Versionen: frontmatter.version.txt und config.version.txt neben dieser Datei.
# JE SCHEMA eine eigene Zaehlung – die beiden entwickeln sich unabhaengig, und eine
# gemeinsame Nummer haette bei jeder Aenderung des einen auch das andere „neu" gemacht.
# =============================================================================
require 'yaml'
require 'json'
require 'date'

SCHEMA_KEYWORDS = %w[
  $ref type enum const required properties patternProperties additionalProperties
  items minItems uniqueItems minimum exclusiveMinimum maximum oneOf anyOf allOf
  pattern not
].freeze

# ---------------------------------------------------------------------------
# Validator – Draft-07-Ausschnitt
# ---------------------------------------------------------------------------
class Validator
  def initialize
    @documents = {}
  end

  # Schluessel ist der ABSOLUTE Pfad. Damit loest `$ref` relativ zur Datei auf, in
  # der er steht – und der Pruefer versteht beide Ablagen: die flache im Paket
  # (`frontmatter.schema.json` neben `config.schema.json`) und die veroeffentlichte
  # (`schemas/config/1/schema.json` verweist auf `../../frontmatter/1/schema.json`).
  def document(file)
    path = File.expand_path(file)
    @documents[path] ||= JSON.parse(File.read(path))
  end

  # Liefert eine Liste von Meldungen [{zeiger:, text:}].
  def check_all(value, schema, file, pointer = '')
    return [] if schema == true
    return [{ pointer: pointer, text: 'hier ist kein Wert erlaubt' }] if schema == false

    unknown = schema.keys - SCHEMA_KEYWORDS - %w[$schema $id title description examples definitions default]
    unless unknown.empty?
      # Nicht abfangen, sondern melden: ein stillschweigend ignoriertes Schlüsselwort
      # wäre eine Prüfung, die aussieht, als täte sie etwas.
      return [{ pointer: pointer, text: "Schema nutzt Schlüsselwörter, die dieser Validator nicht kennt: #{unknown.join(', ')} (in #{file})" }]
    end

    if (ref = schema['$ref'])
      target_file, fragment = ref.split('#', 2)
      target_file = if target_file.nil? || target_file.empty?
                     file
                   else
                     File.expand_path(target_file, File.dirname(file))
                   end
      below = document(target_file)
      (fragment || '').split('/').reject(&:empty?).each do |part|
        below = below[part.gsub('~1', '/').gsub('~0', '~')]
        return [{ pointer: pointer, text: "Schema-Referenz #{ref} ist nicht auflösbar" }] if below.nil?
      end
      rest = schema.reject { |k, _| k == '$ref' }
      return check_all(value, below, target_file, pointer) + (rest.empty? ? [] : check_all(value, rest, file, pointer))
    end

    errors = []

    if (kind = schema['type'])
      allowed = Array(kind)
      errors << { pointer: pointer, text: "muss #{allowed.map { |t| kind_name(t) }.join(' oder ')} sein, ist #{kind_name(kind_of_value(value))}" } unless allowed.any? { |t| kind_matches?(value, t) }
      return errors unless errors.empty?
    end

    if schema.key?('enum') && !schema['enum'].include?(value)
      errors << { pointer: pointer, text: "muss einer dieser Werte sein: #{schema['enum'].map(&:inspect).join(', ')} (ist #{value.inspect})" }
    end
    if schema.key?('const') && schema['const'] != value
      errors << { pointer: pointer, text: "muss #{schema['const'].inspect} sein (ist #{value.inspect})" }
    end

    # `pattern` NUR AUF ZEICHENKETTEN – so steht es in JSON Schema, und ein
    # Muster gegen eine Zahl zu halten wäre eine Meldung, die niemand beheben
    # kann. Gelesen wird es als Ruby-Regex: Beides ist PCRE-nah genug für die
    # einfachen Muster, die hier vorkommen (`^[a-z0-9]+(-[a-z0-9]+)*$`).
    if schema.key?('pattern') && value.is_a?(String) && !value.match?(Regexp.new(schema['pattern']))
      errors << { pointer: pointer, text: "passt nicht auf das Muster #{schema['pattern'].inspect} (ist #{value.inspect})" }
    end

    if value.is_a?(Numeric)
      errors << { pointer: pointer, text: "muss mindestens #{schema['minimum']} sein" } if schema['minimum'] && value < schema['minimum']
      errors << { pointer: pointer, text: "muss höchstens #{schema['maximum']} sein" } if schema['maximum'] && value > schema['maximum']
      errors << { pointer: pointer, text: "muss größer als #{schema['exclusiveMinimum']} sein" } if schema['exclusiveMinimum'] && value <= schema['exclusiveMinimum']
    end

    if value.is_a?(Hash)
      Array(schema['required']).each do |field|
        errors << { pointer: pointer, text: "das Feld `#{field}` fehlt" } unless value.key?(field)
      end
      properties = schema['properties'] || {}
      pattern = schema['patternProperties'] || {}
      value.each do |k, v|
        below = pointer + '/' + k.to_s
        if properties.key?(k)
          errors += check_all(v, properties[k], file, below)
          next
        end
        hits = pattern.keys.select { |m| Regexp.new(m).match?(k.to_s) }
        unless hits.empty?
          hits.each { |m| errors += check_all(v, pattern[m], file, below) }
          next
        end
        extra = schema['additionalProperties']
        next if extra.nil? || extra == true
        if extra == false
          allowed_values = (properties.keys + pattern.keys.map { |m| "Muster #{m}" }).sort
          errors << { pointer: below, text: "unbekanntes Feld `#{k}`#{allowed_values.empty? ? '' : " – erlaubt sind: #{allowed_values.join(', ')}"}" }
        else
          errors += check_all(v, extra, file, below)
        end
      end
    end

    if value.is_a?(Array)
      errors << { pointer: pointer, text: "braucht mindestens #{schema['minItems']} Eintrag/Einträge" } if schema['minItems'] && value.size < schema['minItems']
      errors << { pointer: pointer, text: 'enthält doppelte Einträge' } if schema['uniqueItems'] && value.uniq.size != value.size
      if (items = schema['items'])
        value.each_with_index { |v, i| errors += check_all(v, items, file, "#{pointer}/#{i}") }
      end
    end

    if (entries = schema['oneOf'])
      hits = entries.count { |s| check_all(value, s, file, pointer).empty? }
      errors << { pointer: pointer, text: "passt auf keine der erlaubten Formen (#{descriptions(entries)})" } if hits.zero?
      errors << { pointer: pointer, text: 'passt auf mehrere erlaubte Formen – das Schema ist mehrdeutig' } if hits > 1
    end
    if (entries = schema['anyOf'])
      unless entries.any? { |s| check_all(value, s, file, pointer).empty? }
        errors << { pointer: pointer, text: "passt auf keine der erlaubten Formen (#{descriptions(entries)})" }
      end
    end
    Array(schema['allOf']).each { |s| errors += check_all(value, s, file, pointer) }
    # `not` – gebraucht für „entweder das eine oder das andere, oder keines von
    # beiden". Ohne dieses Schlüsselwort liesse sich ein `oneOf` mit einem Zweig
    # „nichts davon gesetzt" nicht ausdrücken, und der Zweig fiele weg: Die
    # einfachste Konfiguration wäre dann ungültig.
    if (verboten = schema['not']) && check_all(value, verboten, file, pointer).empty?
      errors << { pointer: pointer, text: "darf diese Form NICHT haben (#{descriptions([verboten])})" }
    end

    errors
  end

  private

  def descriptions(entries)
    entries.map { |s| s['description'] || s['type'] || (s['required'] && "mit #{s['required'].join(', ')}") || s['const'].inspect }.compact.join(' | ')
  end

  def kind_of_value(value)
    case value
    when nil then 'null'
    when true, false then 'boolean'
    when Integer then 'integer'
    when Numeric then 'number'
    when String, Date, Time then 'string'
    when Array then 'array'
    when Hash then 'object'
    else value.class.to_s
    end
  end

  def kind_matches?(value, kind)
    case kind
    when 'string'  then value.is_a?(String) || value.is_a?(Date) || value.is_a?(Time)
    when 'integer' then value.is_a?(Integer)
    when 'number'  then value.is_a?(Numeric) && !(value == true || value == false)
    when 'boolean' then value == true || value == false
    when 'array'   then value.is_a?(Array)
    when 'object'  then value.is_a?(Hash) || value.is_a?(Date) || value.is_a?(Time)
    when 'null'    then value.nil?
    else true
    end
  end

  def kind_name(kind)
    { 'string' => 'Text', 'integer' => 'ganze Zahl', 'number' => 'Zahl', 'boolean' => 'Ja/Nein',
      'array' => 'Liste', 'object' => 'Abschnitt', 'null' => 'leer' }[kind] || kind
  end
end

# ---------------------------------------------------------------------------
# Dateien sammeln
# ---------------------------------------------------------------------------
# Immer übersprungen – unabhängig von `exclude`: Build-Ausgaben, Abhängigkeiten
# und das eingebundene Theme selbst (dessen Markdown gehört nicht zur Site).
#
# NUR AUF OBERSTER EBENE, und das ist wesentlich: `theme` als beliebiges Segment
# hätte auch `docs/theme/academy.md` verschluckt – eine Seite, die es zu prüfen
# gibt. Eine Auswahl, die stillschweigend Seiten auslässt, sieht aus wie eine
# bestandene Prüfung und ist keine.
ALWAYS_EXCLUDED = %w[theme dist vendor _site].freeze

# Die Verzeichnisse der Collections – aus `collections` und `collections_dir` der
# Konfiguration. `_posts` ist IMMER dabei: Diese Collection kennt Jekyll eingebaut, sie
# steht in keiner `collections:`-Liste, und ihre Dokumente werden gerendert.
#
# WOFÜR: Ein Collection-Dokument ist eine Quelle wie eine Seite – es hat Front Matter,
# wird gerendert und bekommt eine Adresse. Die `_`-Regel unten hat es trotzdem
# ausgelassen, und die Schlussmeldung sagte danach „N Seite(n) geprüft, keine
# Verstöße“, als wäre nichts übrig geblieben. Eine Auswahl, die stillschweigend Dateien
# auslässt, sieht aus wie eine bestandene Prüfung und ist keine – dieselbe Begründung
# wie bei IMMER_AUS.
def collection_dirs(configs)
  names = ['posts']
  root = ''
  configs.each do |data|
    documented = data['collections']
    names += case documented
             when Hash  then documented.keys
             when Array then documented
             else []
             end
    root = data['collections_dir'].to_s if data['collections_dir']
  end
  names.map(&:to_s).uniq.map { |n| [root, "_#{n}"].reject(&:empty?).join('/') }
end

# Liegt die Datei in einer Collection? Geprüft wird der PFADANFANG und nicht ein
# einzelnes Segment: Eine Collection gibt es genau dort, wo Jekyll sie erwartet – im
# Wurzelverzeichnis der Quelle bzw. unter `collections_dir`. Ein `en/_neuigkeiten/`
# unter einem Sprachbaum ist KEINE Collection; Jekyll rendert es nicht, und die Prüfung
# würde sonst Dateien melden, die gar nicht in die Site kommen.
def in_collection?(rel, collections)
  collections.any? { |directory| rel.start_with?(directory + '/') }
end

def skipped?(rel, excluded, collections = [])
  parts = rel.split('/')
  return true if parts.any? { |t| t.start_with?('.') }
  return true if parts.include?('node_modules')
  return true if ALWAYS_EXCLUDED.include?(parts.first) || parts.first.start_with?('_site')
  # Jekyll rendert `_`-Verzeichnisse nicht – AUSGENOMMEN die Collections, die die
  # Konfiguration erklärt. Deren Dokumente werden wie Seiten geprüft; `_data`,
  # `_includes`, `_layouts` und alles übrige bleiben draußen.
  unless in_collection?(rel, collections)
    return true if parts[0..-2].any? { |t| t.start_with?('_') }
  end
  # Jekylls `exclude`-Semantik: Pfade RELATIV zur Quelle. `README.md` schließt also
  # nur die im Wurzelverzeichnis aus, `**/README.md` alle. Deshalb KEIN Rückfall auf
  # den Dateinamen – der schlösse zu viel aus.
  excluded.any? do |pattern|
    m = pattern.chomp('/')
    rel == m || rel.start_with?(m + '/') || File.fnmatch?(m, rel, File::FNM_PATHNAME)
  end
end

def front_matter(path)
  lines = File.readlines(path, encoding: 'utf-8')
  return [nil, nil] unless lines.first && lines.first.chomp == '---'
  last = lines[1..].index { |z| %w[--- ...].include?(z.chomp) }
  return [nil, 'Front Matter ist nicht abgeschlossen (es fehlt die zweite `---`-Zeile)'] if last.nil?
  raw = lines[1, last].join
  data = YAML.safe_load(raw, permitted_classes: [Date, Time], aliases: true)
  return [nil, nil] if data.nil?
  return [nil, 'Front Matter ist kein Abschnitt aus Feldern'] unless data.is_a?(Hash)
  [data, nil]
rescue Psych::SyntaxError => e
  [nil, "Front Matter ist kein gültiges YAML: #{e.message}"]
end

# Zeilennummer des obersten Feldes eines Zeigers – macht die Meldung anklickbar.
def line_of(path, pointer, offset)
  field = pointer.split('/').reject(&:empty?).first
  return nil unless field
  File.readlines(path, encoding: 'utf-8').each_with_index do |z, i|
    return i + 1 if i >= offset && z =~ /\A#{Regexp.escape(field)}\s*:/
  end
  nil
end

# ---------------------------------------------------------------------------
# Zielgruppen: deklarierte Werte gegen benutzte Werte
# ---------------------------------------------------------------------------
# WARUM DAS HIER STEHT UND NICHT IM SCHEMA: Welche Zielgruppen es gibt, ist keine
# Festlegung des Themes, sondern des Werkzeugs, das die Site baut. Ein `enum` im Schema
# waere der falsche Ort – wer eine dritte Zielgruppe braucht, muesste das THEME aendern.
#
# Ein blosses `type: string` wuerde die Pruefung aber verlieren: `audience: lerner`
# (Tippfehler) faellt dann nirgends auf, und die Seite landet stillschweigend in JEDEM
# Build. Deshalb deklariert die Site ihre Zielgruppen in `audiences`, und hier wird
# dagegen geprueft. Die Werte kommen aus der Site, die Pruefung bleibt.
#
# WER `audience` OHNE `audiences` BENUTZT, bekommt einen Fehler – nicht ein Achselzucken.
# Das ist der ganze Zweck: Eine Angabe ohne pruefbare Menge ist eine Vermutung.
def check_audiences(data, declared, source, path = [])
  messages = []
  case data
  when Hash
    data.each do |k, v|
      # `audiences` auf der WURZEL einer Konfiguration ist die Deklaration selbst, keine
      # Verwendung – sonst pruefte sie sich gegen sich.
      declaration = k == 'audiences' && path.empty?
      # `audience_filter` benutzt die Zielgruppen als SCHLÜSSEL, nicht als Werte – der
      # Durchlauf unten würde sie nie zu Gesicht bekommen. Ein Tippfehler darin wirkt
      # still: Die Regel greift nie, die Ausgabe ist ungefiltert statt gefiltert, und
      # weil eine ungefilterte Ausgabe VOLLSTÄNDIG aussieht, fällt es niemandem auf.
      if k == 'audience_filter' && path.empty? && v.is_a?(Hash)
        v.each_key do |audience|
          next unless audience.is_a?(String)
          if declared.nil? || declared.empty?
            messages << ["audience_filter.#{audience}",
                          "Zielgruppe `#{audience}` benutzt, aber die Site deklariert keine " \
                          '`audiences`. Ohne Deklaration ist der Wert nicht prüfbar.']
          elsif !declared.include?(audience)
            messages << ["audience_filter.#{audience}",
                          "`#{audience}` ist keine deklarierte Zielgruppe. Deklariert sind: " \
                          "#{declared.join(', ')} (Schlüssel `audiences` in der _config.yml)."]
          end
        end
        next
      end
      used = !declaration && (k == 'audiences' || (k == 'audience' && v.is_a?(String)))
      if used
        full = (path + [k.to_s]).join('.')
        Array(v).each do |value|
          next unless value.is_a?(String)
          if declared.nil? || declared.empty?
            messages << [full, "Zielgruppe `#{value}` benutzt, aber die Site deklariert keine " \
                                '`audiences`. Ohne Deklaration ist der Wert nicht prüfbar – ' \
                                'ein Tippfehler fiele nirgends auf.']
          elsif !declared.include?(value)
            messages << [full, "`#{value}` ist keine deklarierte Zielgruppe. Deklariert sind: " \
                                "#{declared.join(', ')} (Schlüssel `audiences` in der _config.yml)."]
          end
        end
      else
        messages += check_audiences(v, declared, source, path + [k.to_s])
      end
    end
  when Array
    data.each_with_index { |v, i| messages += check_audiences(v, declared, source, path + [i.to_s]) }
  end
  messages
end

# ---------------------------------------------------------------------------
# Sprachen: deklarierte Codes gegen benutzte Codes
# ---------------------------------------------------------------------------
# DIESELBE BEGRÜNDUNG WIE BEI DEN ZIELGRUPPEN: Welche Sprachen eine Site führt, legt
# die Site fest (`i18n.languages`), nicht das Theme – ein `enum` im Schema wäre der falsche
# Ort. Ohne Prüfung dagegen wirkt aber jeder Tippfehler STILL: Eine Sprachkarte
# `{ de: …, eng: … }` ist gueltiges YAML, gueltig gegen das Schema, und die englische
# Seite zeigt einfach den deutschen Text. Genau die Sorte Fehler, die niemandem auffällt.
#
# GEPRUEFT WERDEN NUR DIE FELDER, DIE DAS THEME ALS SPRACHKARTE LIEST. Die Liste steht
# hier ausgeschrieben und nicht als Formerkennung („ein Hash aus kurzen Schluesseln“):
# Eine Heuristik würde irgendwann ein fremdes Feld erwischen, dessen Schlüssel zufällig
# wie Sprachcodes aussehen. Wer ein Feld sprachfähig macht, ergaenzt es hier – so wie er
# es im Schema und in avd-lang-value.html ergaenzt.
# WIE DIE SPRACHKARTEN GEFUNDEN WERDEN: aus dem SCHEMA, nicht aus einer Namensliste.
# Erster Versuch war eine Liste der Feldnamen (title, url, icon, …) – und sie war sofort
# falsch: `brand.icon` ist ein Hash mit `default`/`small`/`apple` (die Favicon-Groessen),
# heißt aber `icon`. Derselbe Name bedeutet an verschiedenen Stellen Verschiedenes; eine
# Liste von Namen kann das nicht wissen.
#
# Das Schema weiss es: Jedes sprachfähige Feld verweist auf
# `frontmatter.schema.json#/definitions/sprachtext`. Der Durchlauf unten laeuft deshalb
# durch Wert UND Schema gleichzeitig und prüft genau dort, wo eine Sprachkarte erlaubt
# ist. Wer ein Feld sprachfaehig macht, aendert nur das Schema – die Prüfung folgt.
#
# DERSELBE DURCHLAUF FINDET AUCH DIE SEITENVERWEISE (`page: «id»`). Ein Durchlauf, zwei
# Befunde – und aus demselben Grund schemagetrieben: Ein Schluessel `page` kann anderswo
# etwas anderes bedeuten (`defaults` traegt `layout: page` als WERT). Gesammelt wird nur,
# was im Schema als `seitenverweis` deklariert ist.
class SchemaWalk
  attr_reader :page_links

  def initialize(validator, declared)
    @v = validator
    @declared = declared
    @messages = []
    @page_links = []
  end

  def run(value, schema, file, path = [])
    @messages = []
    @page_links = []
    walk(value, schema, file, path)
    @messages
  end

  private

  def walk(value, schema, file, path)
    return unless schema.is_a?(Hash)

    if (ref = schema['$ref'])
      target, fragment = ref.split('#', 2)
      target_file = target.nil? || target.empty? ? file : File.expand_path(target, File.dirname(file))
      begin
        below = @v.document(target_file)
      rescue StandardError
        return
      end
      (fragment || '').split('/').reject(&:empty?).each { |t| below = below.is_a?(Hash) ? below[t] : nil }
      return if below.nil?
      # DER TREFFER: eine Sprachkarte an dieser Stelle erlaubt, und der Wert ist eine.
      if ref.end_with?('/definitions/sprachtext') && value.is_a?(Hash)
        check_codes(value, path)
        return
      end
      if ref.end_with?('/definitions/seitenverweis') && value.is_a?(String)
        @page_links << [path.join('.'), value]
        return
      end
      return walk(value, below, target_file, path)
    end

    %w[oneOf anyOf allOf].each { |c| Array(schema[c]).each { |s| walk(value, s, file, path) } }

    if value.is_a?(Hash)
      properties = schema['properties'] || {}
      pattern = schema['patternProperties'] || {}
      value.each do |k, v|
        sub_path = path + [k.to_s]
        if properties.key?(k)
          walk(v, properties[k], file, sub_path)
          next
        end
        hits = pattern.keys.select { |m| Regexp.new(m).match?(k.to_s) }
        if hits.any?
          hits.each { |m| walk(v, pattern[m], file, sub_path) }
          next
        end
        walk(v, schema['additionalProperties'], file, sub_path) if schema['additionalProperties'].is_a?(Hash)
      end
    elsif value.is_a?(Array) && schema['items'].is_a?(Hash)
      value.each_with_index { |v, i| walk(v, schema['items'], file, path + [i.to_s]) }
    end
  end

  def check_codes(map, path)
    full = path.join('.')
    map.each_key do |code|
      next if @declared.include?(code.to_s)
      text = if @declared.empty?
               "Sprachkarte benutzt (`#{code}`), aber die Site deklariert keine " \
               '`i18n.languages`. Ohne Deklaration ist der Code nicht prüfbar – ' \
               'ein Tippfehler fiele nirgends auf.'
             else
               "`#{code}` ist keine deklarierte Sprache. Deklariert sind: " \
               "#{@declared.join(', ')} (Schlüssel `i18n.languages` in der _config.yml)."
             end
      @messages << [full, text]
    end
  end
end

# Die Sprache einer QUELLDATEI aus ihrem Pfad – dieselbe Ableitung wie im Layout
# (avd-i18n.html), nur auf dem Quellbaum statt auf der URL: Der laengste passende
# Praefix gewinnt, die Standardsprache wohnt in der Wurzel.
#
# VORAUSSETZUNG ist die dokumentierte Konvention, dass der Quellordner dem `base` der
# Sprache entspricht (`base: "/en/"` -> `en/…`). Wer anders ausliefert, verliert hier die
# Doppelungspruefung – nicht die Übersetzung.
def language_from_path(rel, languages, default)
  hits = default
  length = 0
  languages.each do |lp|
    code = lp['code'].to_s
    base = (lp['base'] || (code == default ? '/' : "/#{code}/")).to_s
    prefix = base.sub(%r{\A/}, '')
    next if prefix.empty?
    next unless rel.start_with?(prefix)
    next unless prefix.length > length
    length = prefix.length
    hits = code
  end
  hits
end

# ---------------------------------------------------------------------------
# Selbsttest der Schemas
# ---------------------------------------------------------------------------
# Prüft die Schemas selbst, nicht die Site: gültiges JSON, KEIN Schlüsselwort
# außerhalb von SCHLUESSELWOERTER, und jede `$ref` auflösbar.
#
# Warum das eine eigene Prüfung ist: Ein Schlüsselwort, das dieser Validator nicht
# kennt (etwa `pattern`), fällt sonst erst auf, wenn eine Seite den betroffenen
# Zweig überhaupt erreicht – bis dahin urteilen IDE und Pipeline verschieden.
def self_test(paths)
  errors = []
  known = SCHEMA_KEYWORDS + %w[$schema $id title description examples definitions default]

  # Schluessel ist der Dateiname, wie ihn ein `$ref` schreibt – so bleibt die
  # Referenzpruefung unabhaengig davon, wo die Dateien liegen.
  documents = {}
  names = {}
  paths.each do |role, path|
    name = File.basename(path)
    names[role] = name
    begin
      documents[name] = JSON.parse(File.read(path))
    rescue JSON::ParserError => e
      errors << "#{name}: kein gültiges JSON – #{e.message}"
    end
  end
  return errors unless errors.empty?
  files = names.values

  # Rekursiv durch alle Schema-Knoten. Ein Knoten ist ein Schema, wenn er als
  # Wert an einer Schema-Stelle steht – deshalb wird über die bekannten
  # Container-Schlüssel navigiert statt blind über alle Hashes.
  check = lambda do |node, file, path|
    return unless node.is_a?(Hash)
    (node.keys - known).each do |k|
      errors << "#{file}#{path}: Schlüsselwort `#{k}` kennt validate.rb nicht – " \
                'entweder aus dem Schema entfernen oder in SCHLUESSELWOERTER ergänzen ' \
                '(sonst urteilen IDE und Pipeline unterschiedlich).'
    end
    if (ref = node['$ref'])
      target, fragment = ref.split('#', 2)
      target = file if target.nil? || target.empty?
      doc = documents[File.basename(target)]
      if doc.nil?
        errors << "#{file}#{path}: `$ref` zeigt auf #{target} – diese Datei gehört nicht zum Schema-Satz."
      else
        below = doc
        (fragment || '').split('/').reject(&:empty?).each { |t| below = below.is_a?(Hash) ? below[t] : nil }
        errors << "#{file}#{path}: `$ref` #{ref} ist nicht auflösbar." if below.nil?
      end
    end
    %w[properties patternProperties definitions].each do |c|
      (node[c] || {}).each { |k, v| check.call(v, file, "#{path}/#{c}/#{k}") }
    end
    %w[items additionalProperties].each do |c|
      check.call(node[c], file, "#{path}/#{c}") if node[c].is_a?(Hash)
    end
    %w[oneOf anyOf allOf].each do |c|
      Array(node[c]).each_with_index { |v, i| check.call(v, file, "#{path}/#{c}/#{i}") }
    end
  end
  files.each { |file| check.call(documents[file], file, '') }

  # KEIN PFLICHTFELD IM FRONT MATTER. Eine Seite ohne Front Matter muss bauen, und
  # zwar richtig – wer eine .md anlegt, soll schreiben koennen, ohne vorher eine
  # Feldliste zu lesen. Ein `required` auf oberster Ebene waere genau das Gegenteil
  # und faellt sonst niemandem auf, bis ein bestehendes Repo rot wird.
  # `required` INNERHALB einer Unterstruktur bleibt erlaubt: Ein resources-Eintrag
  # ohne `url` ist kein Standardfall, sondern ein halber Eintrag.
  root_required = documents[names[:frontmatter]]['required']
  unless root_required.nil?
    errors << 'frontmatter.schema.json: `required` auf oberster Ebene ist nicht erlaubt ' \
              "(#{Array(root_required).join(', ')}). Jedes Front-Matter-Feld ist optional – " \
              'das Theme darf kein Feld verlangen. Stattdessen einen Standardwert vorsehen.'
  end
  errors
end

# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------
root = Dir.pwd
schema_dir = __dir__
configs = []
fm_schema = nil
cfg_schema = nil
self_test_only = false
argv = ARGV.dup
site_dir = nil
site_required = false
until argv.empty?
  case (arg = argv.shift)
  when '--root'  then root = argv.shift
  when '--schemas' then schema_dir = argv.shift
  when '--frontmatter-schema' then fm_schema = argv.shift
  when '--config-schema'      then cfg_schema = argv.shift
  when '--config'  then configs << argv.shift
  when '--self-test' then self_test_only = true
  when '--site' then site_dir = argv.shift
  when '--require-site' then site_required = true
  when '--help', '-h'
    puts File.read(__FILE__).lines[2..24].map { |z| z.sub(/\A# ?/, '') }.join
    exit 0
  else
    warn "Unbekannte Option: #{arg}"
    exit 2
  end
end

# Die beiden Schemas: entweder ueber --schemas (flache Ablage im Paket) oder
# einzeln ueber --frontmatter-schema/--config-schema (veroeffentlichte Ablage,
# `schemas/«name»/«version»/schema.json`). Ohne Angabe gilt das Verzeichnis dieser Datei.
paths = {
  frontmatter: fm_schema || File.join(schema_dir, 'frontmatter.schema.json'),
  config: cfg_schema || File.join(schema_dir, 'config.schema.json')
}
paths.each do |role, path|
  next if File.exist?(path)
  warn "FEHLER: Das #{role == :config ? 'Konfigurations' : 'Front-Matter'}-Schema fehlt: #{path}"
  warn '       Das Theme liefert die Schemas unter theme/jekyll/schema/ aus, die Doku-Site'
  warn '       unter /schemas/«name»/«version»/schema.json. Ohne sie gibt es keine Prüfung –'
  warn '       und eine Prüfung, die nichts prüft, ist kein Erfolg.'
  exit 2
end

if self_test_only
  errors = self_test(paths)
  if errors.empty?
    puts "Schema-Selbsttest bestanden (#{paths.values.map { |p| File.basename(File.dirname(p)) + '/' + File.basename(p) }.join(', ')})."
    exit 0
  end
  warn "FEHLER: #{errors.size} Problem(e) in den Schemas selbst:"
  warn ''
  errors.each { |f| warn "  #{f}" }
  exit 1
end

validator = Validator.new
def schema_version(dir, name)
  file = File.join(dir, "#{name}.version.txt")
  File.exist?(file) ? File.read(file).strip : '?'
end
# Version: die Datei neben dem Schema (veroeffentlichte Ablage: schemas/«name»/version.txt,
# Paket: «name».version.txt). Fehlt sie, steht dort ein Fragezeichen statt einer Erfindung.
def version_of(path, name)
  candidates = [
    File.join(File.dirname(path), "#{name}.version.txt"),
    File.join(File.dirname(path), '..', 'version.txt')
  ]
  candidates.each { |k| return File.read(k).strip if File.exist?(k) }
  '?'
end
version = "Front Matter #{version_of(paths[:frontmatter], 'frontmatter')} / Config #{version_of(paths[:config], 'config')}"
configs = [File.join(root, '_config.yml')] if configs.empty?

messages = []

# --- _config.yml ---------------------------------------------------------
excluded = []
audiences = []
languages = []
default_language = 'de'
config_data = []
configs.each do |cfg|
  unless File.exist?(cfg)
    warn "FEHLER: #{cfg} gibt es nicht."
    exit 2
  end
  begin
    data = YAML.safe_load(File.read(cfg), permitted_classes: [Date, Time], aliases: true) || {}
  rescue Psych::SyntaxError => e
    messages << "#{cfg}: kein gültiges YAML – #{e.message}"
    next
  end
  excluded += Array(data['exclude'])
  audiences += Array(data['audiences'])
  languages += Array(data.dig('i18n', 'languages')).select { |lp| lp.is_a?(Hash) && lp['code'] }
  default_language = data['lang'].to_s if data['lang']
  display = cfg.sub(/\A#{Regexp.escape(root)}\/?/, '')
  config_data << [display, cfg, data]
  validator.check_all(data, validator.document(paths[:config]), paths[:config]).each do |f|
    line = line_of(cfg, f[:pointer], 0)
    messages << "#{display}#{line ? ":#{line}" : ''}: #{f[:pointer].empty? ? '' : "`#{f[:pointer].sub(%r{\A/}, '').gsub('/', '.')}` "}#{f[:text]}"
  end
end

# --- Zielgruppen in den Konfigurationen (nav, audience des Builds) -------
# Erst NACH allen Konfigurationen, denn `audiences` kann im Overlay stehen.
language_codes = languages.map { |lp| lp['code'].to_s }.uniq
maps = SchemaWalk.new(validator, language_codes)
# Alle vergebenen `page_id` und alle `page:`-Verweise – geprüft wird nach dem Durchlauf,
# denn ein Verweis darf auf eine Seite zeigen, die spaeter im Baum kommt.
used_ids = []
links = []
config_data.each do |display, cfg, data|
  check_audiences(data, audiences.uniq, display).each do |field, text|
    line = line_of(cfg, '/' + field.split('.').first, 0)
    messages << "#{display}#{line ? ":#{line}" : ''}: `#{field}` #{text}"
  end
  # `i18n.languages` ist die Deklaration selbst und wird nicht gegen sich geprüft.
  without_declaration = data.reject { |k, _| k == 'i18n' }
  maps.run(without_declaration, validator.document(paths[:config]), paths[:config]).each do |field, text|
    line = line_of(cfg, '/' + field.split('.').first, 0)
    messages << "#{display}#{line ? ":#{line}" : ''}: `#{field}` #{text}"
  end
  maps.page_links.each { |field, id| links << [display, cfg, 0, field, id] }
end

# Die Standardsprache MUSS mit deklariert sein – sonst hätte der Wurzelbaum keine
# Sprache, und `page_id` liesse sich ihm nicht zuordnen.
if language_codes.any? && !language_codes.include?(default_language)
  messages << "_config.yml: `lang` ist `#{default_language}`, steht aber nicht in " \
               "`i18n.languages` (dort: #{language_codes.join(', ')}). Die Standardsprache gehört " \
               'mit in die Deklaration – ihr Sprachbaum ist die Wurzel der Site.'
end

# --- Front Matter aller Seiten und Collection-Dokumente ------------------
# Die Collections stehen erst hier fest: Sie können in einem Overlay erklärt werden,
# und gelesen sind alle Konfigurationen erst nach der Schleife oben.
collections = collection_dirs(config_data.map { |_, _, data| data })
pages = 0
collection_pages = 0
translations = {}
filenames = {}
without_language = []
# Braucht diese Site das Adressen-Plugin? Zwei Anzeichen, beide allein am QUELLTEXT
# ablesbar – die Pruefung rechnet KEINE Adresse nach. Sonst staende die Abbildungsregel
# ein zweites Mal hier und koennte von der im Plugin abweichen.
slug_present = false
siblings = false
Dir.glob(File.join(root, '**', '*.{md,markdown,html}')).sort.each do |path|
  rel = path.sub(/\A#{Regexp.escape(root)}\/?/, '')
  next if skipped?(rel, excluded, collections)
  data, errors = front_matter(path)
  if errors
    messages << "#{rel}: #{errors}"
    next
  end
  pages += 1
  collection_pages += 1 if in_collection?(rel, collections)

  # ZWEI WEGE, EINE SEITE ZU ADRESSIEREN – dieselbe Rangfolge wie in avd-page-url.html:
  # die ausdrückliche `page_id`, sonst der Dateiname ohne Endung.
  #
  # DAS STEHT VOR `next if daten.nil?`, UND ZWAR AUS EINEM GRUND: Eine Seite OHNE Front
  # Matter ist im Theme ausdruecklich erlaubt (jekyll-optional-front-matter). Sie hat
  # keine `page_id`, aber sie hat einen Dateinamen – und muss darueber verlinkbar sein.
  # Stand die Sammlung hinter dem `next`, meldete die Prüfung jeden Verweis auf eine
  # solche Seite als „gibt es nicht", obwohl das Layout sie findet. Genau so ist es beim
  # ersten Versuch passiert.
  #
  # ID UND DATEINAME WERDEN GETRENNT GEFUEHRT, denn nur so lässt sich sagen, ob ein
  # Verweis EINDEUTIG ist: Zwei Seiten mit demselben Dateinamen in verschiedenen Ordnern
  # sind der Normalfall (jeder Ordner hat eine `index.md`) und erst dann ein Problem, wenn
  # jemand darauf verweist.
  page_language = language_from_path(rel, languages, default_language)
  slug_present = true if data.is_a?(Hash) && (data['slug'] || data['folder_slug'])
  if data.is_a?(Hash) && data['lang'].is_a?(String)
    # SPRACHE DEKLARIERT, ORDNER SAGT ETWAS ANDERES: Die Seite liegt NEBEN ihrer
    # Uebersetzung statt im Sprachbaum. Dann erzeugt nur das Plugin das `/en/`-Praefix.
    siblings = true if data['lang'].split('-').first.downcase !=
                            page_language.split('-').first.downcase
    page_language = data['lang']
  elsif data.is_a?(Hash)
    # OHNE `lang` entscheidet der Ordner. Das bleibt gültig und ist der bequeme
    # Normalfall – aber es bindet die Seite an ihren Platz im Baum. Wer eine
    # Übersetzung woanders ablegen will, braucht die Angabe. Gesammelt wird sie
    # als HINWEIS, nicht als Verstoß: Ein Abbruch würde jede bestehende
    # mehrsprachige Site auf einen Schlag rot machen.
    #
    # NUR für Dateien MIT Front Matter (`daten` ist ein Hash). Eine .html ohne
    # Front Matter rendert Jekyll nicht, es kopiert sie durch – das Theme löst
    # für sie nie eine Sprache auf, und ein `lang:` hätte dort keine Wirkung.
    # Die Vorlagen-Decks unter templates/ sind genau dieser Fall: Sie tragen ihr
    # `<html lang>` selbst. Sie zu mahnen hieße, eine Angabe zu verlangen, die
    # nichts bewirkt.
    without_language << rel
  end

  # ZWEI SCHLUESSEL, ZWEI ORTE – und keiner davon darf am falschen stehen.
  #
  # `folder_slug` benennt den ORDNER, `slug` die SEITE. Auf einer Index-Seite gibt es
  # nichts zu benennen: Ihre Adresse IST der Ordner. Ein `slug` dort schoebe die Datei
  # aus dem Ordner heraus (`/kapitel/einstieg.html` statt `/kapitel/`) – der Ordner
  # haette dann KEINE Index-Datei mehr, und `/kapitel/` waere 404. Deshalb verboten,
  # nicht bloss unnoetig.
  #
  # Umgekehrt benennt `folder_slug` auf einer gewoehnlichen Seite einen Ordner, in dem
  # sie nur zufaellig liegt – die Angabe gehoert an EINE Stelle je Ordner, sonst ist
  # nicht bestimmt, wer sie fuehrt.
  if data.is_a?(Hash)
    base = File.basename(rel, '.*')
    short = base.sub(/_#{Regexp.escape(page_language.to_s.split('-').first.downcase)}\z/, '')
    is_index = short == 'index'
    if data['folder_slug'] && !is_index
      messages << "#{rel}: `folder_slug` benennt den ORDNER und gehört deshalb in " \
                   'dessen `index.md` (bzw. `index_«code».md`), nicht in eine ' \
                   'gewöhnliche Seite. Für DIESE Seite ist `slug` gemeint.'
    end
    if data['slug'] && is_index
      messages << "#{rel}: `slug` ist auf einer Index-Seite nicht erlaubt – ihre " \
                   'Adresse IST der Ordner. Die Angabe nähme dem Ordner seine ' \
                   'Index-Datei, `/…/` liefe ins Leere. Gemeint ist `folder_slug`.'
    end
  end
  if data.is_a?(Hash) && data['page_id'].is_a?(String)
    used_ids << data['page_id']
    (translations[[page_language, data['page_id']]] ||= []) << rel
  end
  filename = File.basename(rel).sub(/\.(md|markdown|html?)\z/i, '')
  (filenames[[page_language, filename]] ||= []) << rel

  next if data.nil?
  validator.check_all(data, validator.document(paths[:frontmatter]), paths[:frontmatter]).each do |f|
    line = line_of(path, f[:pointer], 1)
    messages << "#{rel}#{line ? ":#{line}" : ''}: #{f[:pointer].empty? ? '' : "`#{f[:pointer].sub(%r{\A/}, '').gsub('/', '.')}` "}#{f[:text]}"
  end
  check_audiences(data, audiences.uniq, rel).each do |field, text|
    line = line_of(path, '/' + field.split('.').first, 1)
    messages << "#{rel}#{line ? ":#{line}" : ''}: `#{field}` #{text}"
  end
  maps.run(data, validator.document(paths[:frontmatter]), paths[:frontmatter]).each do |field, text|
    line = line_of(path, '/' + field.split('.').first, 1)
    messages << "#{rel}#{line ? ":#{line}" : ''}: `#{field}` #{text}"
  end
  maps.page_links.each { |field, id| links << [rel, path, 1, field, id] }


  # `lang` je Seite gegen die Deklaration – wie eine Zielgruppe.
  if data['lang'].is_a?(String) && language_codes.any? && !language_codes.include?(data['lang'])
    line = line_of(path, '/lang', 1)
    messages << "#{rel}#{line ? ":#{line}" : ''}: `lang` `#{data['lang']}` ist keine " \
                 "deklarierte Sprache. Deklariert sind: #{language_codes.join(', ')}."
  end

end

# --- Seitenverweise: zeigt jede `page`-Angabe auf eine vorhandene `page_id`? ------
# EIN TIPPFEHLER WAERE SONST EIN STILLER AUSFALL: `avd-page-url.html` findet nichts,
# liefert eine leere Zeichenkette, und der Aufrufer lässt den Verweis weg. Im HTML fehlt
# dann einfach ein Menuepunkt – niemand sieht, dass er fehlen sollte.
links.each do |display, file, offset, field, id|
  line = line_of(file, '/' + field.split('.').first, offset)
  place = "#{display}#{line ? ":#{line}" : ''}"

  by_id   = translations.select { |(_lng, value), _| value == id }
  by_name = filenames.select { |(_lng, value), _| value == id }

  if by_id.empty? && by_name.empty?
    known = used_ids.uniq.sort
    messages << "#{place}: `#{field}` verweist mit `page: #{id}` auf eine Seite, die es " \
                 'nicht gibt – keine Seite trägt diese `page_id`, und keine Datei heißt ' \
                 "so.#{known.empty? ? '' : " Vergebene IDs: #{known.join(', ')}."}"
    next
  end

  # MEHRDEUTIG IST NUR, WAS AUCH GENOMMEN WIRD. Greift der Verweis über eine
  # ausdrückliche `page_id`, sind gleichnamige DATEIEN gleichgültig – die ID hat Vorrang
  # (siehe avd-page-url.html). Erst wenn er über den Dateinamen geht, zählt dessen
  # Eindeutigkeit. Sonst wäre `page: schnellstart` in jedem Repo ein Fehler, das
  # irgendwo eine zweite `schnellstart.md` liegen hat, auf die niemand verweist.
  source = by_id.empty? ? by_name : by_id
  source.each do |(lng, _value), files|
    next if files.size < 2
    messages << "#{place}: `#{field}` verweist mit `page: #{id}` mehrdeutig – in der " \
                 "Sprache `#{lng}` passen #{files.size} Seiten (#{files.join(', ')}). " \
                 'Einer davon eine ausdrückliche `page_id` geben; über den Dateinamen ' \
                 'ist nicht bestimmt, welche gemeint ist.'
  end
end

# --- page_id: je Sprache eindeutig --------------------------------------
# ZWEI SEITEN DERSELBEN SPRACHE MIT DERSELBEN ID sind keine Übersetzung, sondern eine
# Mehrdeutigkeit: Der Umschalter nimmt die erste, die er findet, und welche das ist,
# entscheidet die Sortierung des Dateisystems. Das fällt beim Bauen nicht auf.
translations.each do |(language, id), files|
  next if files.size < 2
  messages << "#{files.first}: `page_id` `#{id}` kommt in der Sprache " \
               "`#{language}` mehrfach vor (#{files.join(', ')}). Je Sprache darf es zu " \
               'einer ID nur EINE Seite geben – sonst ist weder bestimmt, wohin der ' \
               'Sprachumschalter führt, noch wohin ein `page`-Verweis zeigt.'
end

# Eine Prüfung über die leere Menge ist kein Erfolg.
if pages.zero?
  warn "FEHLER: Unter #{root} wurde KEINE Seite gefunden."
  warn '       Damit hat die Prüfung nichts geprüft – das ist ein Befund, kein Erfolg.'
  warn '       Stimmt --root? Schließt `exclude` versehentlich alles aus?'
  exit 2
end

# ---------------------------------------------------------------------------
# HAT DAS ADRESSEN-PLUGIN GEWIRKT?
#
# Der teuerste Fehler dieses Themes ist ein STILLER: `github-pages` erzwingt Jekylls
# Safe-Modus und uebergeht jeden Plugin-Ordner, ohne das zu melden. Dann wirken `slug`
# und das `/«code»/`-Praefix einfach nicht – der Build bleibt gruen, und die Seiten
# stehen unter falschen Adressen. Gemerkt haette es niemand.
#
# Geprueft wird deshalb die SPUR, die das Plugin beim Bauen legt, nicht das Ergebnis:
# Eine nachgerechnete Adresse waere die Abbildungsregel ein zweites Mal – zwei Stellen,
# die auseinanderlaufen koennen. Die Spur ist eindeutig und kostet nichts.
if site_dir
  trace = File.join(site_dir, '.avd-addresses')
  requires = slug_present || siblings
  if !Dir.exist?(site_dir)
    if site_required
      warn "FEHLER: --require-site verlangt eine gebaute Site, #{site_dir}/ gibt es nicht."
      exit 2
    end
    warn "Hinweis: Adressen-Plugin NICHT geprüft – keine gebaute Site unter #{site_dir}/."
    warn ''
  elsif requires && !File.exist?(trace)
    reason = []
    reason << '`slug`-Angaben im Front Matter' if slug_present
    reason << 'Seiten, die ihre Sprache deklarieren und NICHT im Sprachbaum liegen' if siblings
    warn 'FEHLER: Das Adressen-Plugin des Themes hat beim Bauen NICHT gewirkt.'
    warn ''
    warn "       Diese Site braucht es – sie hat #{reason.join(' und ')}."
    warn "       In #{site_dir}/ fehlt aber die Spur `.avd-addresses`, die es beim"
    warn '       Bauen legt. Ohne das Plugin stehen die Seiten unter den Adressen,'
    warn '       die Ordner- und Dateiname vorgeben – ohne jede Meldung.'
    warn ''
    warn '       Häufigste Ursache: Der Build läuft mit dem Gem `github-pages`. Es'
    warn '       erzwingt Jekylls Safe-Modus und übergeht Plugin-Ordner STILLSCHWEIGEND.'
    warn '       Abhilfe: `jekyll` plus `jekyll-optional-front-matter` und'
    warn '       `jekyll-relative-links` verwenden, wie in der Kopiervorlage.'
    warn ''
    warn '       Zweitfrage: Steht `plugins_dir` mit `theme/jekyll/_plugins`? Es kommt'
    warn '       aus `theme/jekyll/_config.defaults.yml` – wird die Datei nicht geladen,'
    warn '       fehlt der Schlüssel.'
    exit 1
  end
end

# EIN Hinweis, nicht siebzig. Eine Warnung, die je Seite erscheint, scrollt die
# eigentliche Meldung weg und wird beim zweiten Mal überlesen – dann schützt sie nichts
# mehr. Genannt werden drei Dateien als Einstieg, gezählt wird der Rest.
if language_codes.size > 1 && !without_language.empty?
  examples = without_language.first(3).join(', ')
  rest = without_language.size - [without_language.size, 3].min
  warn "HINWEIS: #{without_language.size} Seite(n) ohne `lang` im Front Matter – dort " \
       'entscheidet der Ordner über die Sprache. Das ist gültig, bindet die Seite aber an ' \
       'ihren Platz im Baum; eine Übersetzung lässt sich so nicht woanders ablegen.'
  warn "         z. B. #{examples}#{rest.positive? ? " (und #{rest} weitere)" : ''}"
  warn ''
end

if messages.empty?
  aud = audiences.uniq.empty? ? 'keine Zielgruppen deklariert' : "Zielgruppen: #{audiences.uniq.join(', ')}"
  lng = language_codes.empty? ? 'einsprachig' : "Sprachen: #{language_codes.join(', ')}"
  # Die Collection-Dokumente werden EIGENS genannt: Wer eine Collection anlegt, soll der
  # Meldung ansehen, dass sie mit geprüft wurde – und nicht raten müssen, ob die Zahl
  # sie enthält.
  from_collections = collection_pages.zero? ? '' : " (darunter #{collection_pages} aus Collections)"
  puts "Schema #{version}: #{configs.size} Konfiguration(en) und #{pages} Seite(n)#{from_collections} geprüft, #{aud}, #{lng} – keine Verstöße."
  exit 0
end

warn "FEHLER: #{messages.size} Verstoß/Verstöße gegen die Academy-Schemas (#{version}):"
warn ''
messages.each { |m| warn "  #{m}" }
warn ''
warn 'Was jetzt zu tun ist:'
warn '  * Tippfehler im Feldnamen? Die erlaubten Felder stehen in der Meldung.'
warn '  * Feld ABSICHTLICH neu? Dann gehört es ins Schema UND in die Theme-Doku'
warn '    (docs/theme/schemas.md) – ein Feld ohne Doku findet niemand wieder.'
warn '  * Repo-eigenes Feld, das das Theme nicht liest? Präfix `x_` verwenden.'
exit 1
