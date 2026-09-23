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

SCHLUESSELWOERTER = %w[
  $ref type enum const required properties patternProperties additionalProperties
  items minItems uniqueItems minimum exclusiveMinimum maximum oneOf anyOf allOf
].freeze

# ---------------------------------------------------------------------------
# Validator – Draft-07-Ausschnitt
# ---------------------------------------------------------------------------
class Validator
  def initialize
    @dokumente = {}
  end

  # Schluessel ist der ABSOLUTE Pfad. Damit loest `$ref` relativ zur Datei auf, in
  # der er steht – und der Pruefer versteht beide Ablagen: die flache im Paket
  # (`frontmatter.schema.json` neben `config.schema.json`) und die veroeffentlichte
  # (`schemas/config/1/schema.json` verweist auf `../../frontmatter/1/schema.json`).
  def dokument(datei)
    pfad = File.expand_path(datei)
    @dokumente[pfad] ||= JSON.parse(File.read(pfad))
  end

  # Liefert eine Liste von Meldungen [{zeiger:, text:}].
  def pruefen(wert, schema, datei, zeiger = '')
    return [] if schema == true
    return [{ zeiger: zeiger, text: 'hier ist kein Wert erlaubt' }] if schema == false

    unbekannt = schema.keys - SCHLUESSELWOERTER - %w[$schema $id title description examples definitions default]
    unless unbekannt.empty?
      # Nicht abfangen, sondern melden: ein stillschweigend ignoriertes Schlüsselwort
      # wäre eine Prüfung, die aussieht, als täte sie etwas.
      return [{ zeiger: zeiger, text: "Schema nutzt Schlüsselwörter, die dieser Validator nicht kennt: #{unbekannt.join(', ')} (in #{datei})" }]
    end

    if (ref = schema['$ref'])
      ziel_datei, fragment = ref.split('#', 2)
      ziel_datei = if ziel_datei.nil? || ziel_datei.empty?
                     datei
                   else
                     File.expand_path(ziel_datei, File.dirname(datei))
                   end
      unter = dokument(ziel_datei)
      (fragment || '').split('/').reject(&:empty?).each do |teil|
        unter = unter[teil.gsub('~1', '/').gsub('~0', '~')]
        return [{ zeiger: zeiger, text: "Schema-Referenz #{ref} ist nicht auflösbar" }] if unter.nil?
      end
      rest = schema.reject { |k, _| k == '$ref' }
      return pruefen(wert, unter, ziel_datei, zeiger) + (rest.empty? ? [] : pruefen(wert, rest, datei, zeiger))
    end

    fehler = []

    if (typ = schema['type'])
      erlaubt = Array(typ)
      fehler << { zeiger: zeiger, text: "muss #{erlaubt.map { |t| typname(t) }.join(' oder ')} sein, ist #{typname(typ_von(wert))}" } unless erlaubt.any? { |t| typ_passt?(wert, t) }
      return fehler unless fehler.empty?
    end

    if schema.key?('enum') && !schema['enum'].include?(wert)
      fehler << { zeiger: zeiger, text: "muss einer dieser Werte sein: #{schema['enum'].map(&:inspect).join(', ')} (ist #{wert.inspect})" }
    end
    if schema.key?('const') && schema['const'] != wert
      fehler << { zeiger: zeiger, text: "muss #{schema['const'].inspect} sein (ist #{wert.inspect})" }
    end

    if wert.is_a?(Numeric)
      fehler << { zeiger: zeiger, text: "muss mindestens #{schema['minimum']} sein" } if schema['minimum'] && wert < schema['minimum']
      fehler << { zeiger: zeiger, text: "muss höchstens #{schema['maximum']} sein" } if schema['maximum'] && wert > schema['maximum']
      fehler << { zeiger: zeiger, text: "muss größer als #{schema['exclusiveMinimum']} sein" } if schema['exclusiveMinimum'] && wert <= schema['exclusiveMinimum']
    end

    if wert.is_a?(Hash)
      Array(schema['required']).each do |feld|
        fehler << { zeiger: zeiger, text: "das Feld `#{feld}` fehlt" } unless wert.key?(feld)
      end
      eigenschaften = schema['properties'] || {}
      muster = schema['patternProperties'] || {}
      wert.each do |k, v|
        unter = zeiger + '/' + k.to_s
        if eigenschaften.key?(k)
          fehler += pruefen(v, eigenschaften[k], datei, unter)
          next
        end
        treffer = muster.keys.select { |m| Regexp.new(m).match?(k.to_s) }
        unless treffer.empty?
          treffer.each { |m| fehler += pruefen(v, muster[m], datei, unter) }
          next
        end
        zusatz = schema['additionalProperties']
        next if zusatz.nil? || zusatz == true
        if zusatz == false
          erlaubte = (eigenschaften.keys + muster.keys.map { |m| "Muster #{m}" }).sort
          fehler << { zeiger: unter, text: "unbekanntes Feld `#{k}`#{erlaubte.empty? ? '' : " – erlaubt sind: #{erlaubte.join(', ')}"}" }
        else
          fehler += pruefen(v, zusatz, datei, unter)
        end
      end
    end

    if wert.is_a?(Array)
      fehler << { zeiger: zeiger, text: "braucht mindestens #{schema['minItems']} Eintrag/Einträge" } if schema['minItems'] && wert.size < schema['minItems']
      fehler << { zeiger: zeiger, text: 'enthält doppelte Einträge' } if schema['uniqueItems'] && wert.uniq.size != wert.size
      if (items = schema['items'])
        wert.each_with_index { |v, i| fehler += pruefen(v, items, datei, "#{zeiger}/#{i}") }
      end
    end

    if (liste = schema['oneOf'])
      treffer = liste.count { |s| pruefen(wert, s, datei, zeiger).empty? }
      fehler << { zeiger: zeiger, text: "passt auf keine der erlaubten Formen (#{beschreibungen(liste)})" } if treffer.zero?
      fehler << { zeiger: zeiger, text: 'passt auf mehrere erlaubte Formen – das Schema ist mehrdeutig' } if treffer > 1
    end
    if (liste = schema['anyOf'])
      unless liste.any? { |s| pruefen(wert, s, datei, zeiger).empty? }
        fehler << { zeiger: zeiger, text: "passt auf keine der erlaubten Formen (#{beschreibungen(liste)})" }
      end
    end
    Array(schema['allOf']).each { |s| fehler += pruefen(wert, s, datei, zeiger) }

    fehler
  end

  private

  def beschreibungen(liste)
    liste.map { |s| s['description'] || s['type'] || (s['required'] && "mit #{s['required'].join(', ')}") || s['const'].inspect }.compact.join(' | ')
  end

  def typ_von(wert)
    case wert
    when nil then 'null'
    when true, false then 'boolean'
    when Integer then 'integer'
    when Numeric then 'number'
    when String, Date, Time then 'string'
    when Array then 'array'
    when Hash then 'object'
    else wert.class.to_s
    end
  end

  def typ_passt?(wert, typ)
    case typ
    when 'string'  then wert.is_a?(String) || wert.is_a?(Date) || wert.is_a?(Time)
    when 'integer' then wert.is_a?(Integer)
    when 'number'  then wert.is_a?(Numeric) && !(wert == true || wert == false)
    when 'boolean' then wert == true || wert == false
    when 'array'   then wert.is_a?(Array)
    when 'object'  then wert.is_a?(Hash) || wert.is_a?(Date) || wert.is_a?(Time)
    when 'null'    then wert.nil?
    else true
    end
  end

  def typname(typ)
    { 'string' => 'Text', 'integer' => 'ganze Zahl', 'number' => 'Zahl', 'boolean' => 'Ja/Nein',
      'array' => 'Liste', 'object' => 'Abschnitt', 'null' => 'leer' }[typ] || typ
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
IMMER_AUS = %w[theme dist vendor _site].freeze

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
def sammlungsverzeichnisse(konfigurationen)
  namen = ['posts']
  wurzel = ''
  konfigurationen.each do |daten|
    erklaert = daten['collections']
    namen += case erklaert
             when Hash  then erklaert.keys
             when Array then erklaert
             else []
             end
    wurzel = daten['collections_dir'].to_s if daten['collections_dir']
  end
  namen.map(&:to_s).uniq.map { |n| [wurzel, "_#{n}"].reject(&:empty?).join('/') }
end

# Liegt die Datei in einer Collection? Geprüft wird der PFADANFANG und nicht ein
# einzelnes Segment: Eine Collection gibt es genau dort, wo Jekyll sie erwartet – im
# Wurzelverzeichnis der Quelle bzw. unter `collections_dir`. Ein `en/_neuigkeiten/`
# unter einem Sprachbaum ist KEINE Collection; Jekyll rendert es nicht, und die Prüfung
# würde sonst Dateien melden, die gar nicht in die Site kommen.
def in_sammlung?(rel, sammlungen)
  sammlungen.any? { |verzeichnis| rel.start_with?(verzeichnis + '/') }
end

def uebersprungen?(rel, ausschluss, sammlungen = [])
  teile = rel.split('/')
  return true if teile.any? { |t| t.start_with?('.') }
  return true if teile.include?('node_modules')
  return true if IMMER_AUS.include?(teile.first) || teile.first.start_with?('_site')
  # Jekyll rendert `_`-Verzeichnisse nicht – AUSGENOMMEN die Collections, die die
  # Konfiguration erklärt. Deren Dokumente werden wie Seiten geprüft; `_data`,
  # `_includes`, `_layouts` und alles übrige bleiben draußen.
  unless in_sammlung?(rel, sammlungen)
    return true if teile[0..-2].any? { |t| t.start_with?('_') }
  end
  # Jekylls `exclude`-Semantik: Pfade RELATIV zur Quelle. `README.md` schließt also
  # nur die im Wurzelverzeichnis aus, `**/README.md` alle. Deshalb KEIN Rückfall auf
  # den Dateinamen – der schlösse zu viel aus.
  ausschluss.any? do |muster|
    m = muster.chomp('/')
    rel == m || rel.start_with?(m + '/') || File.fnmatch?(m, rel, File::FNM_PATHNAME)
  end
end

def front_matter(pfad)
  zeilen = File.readlines(pfad, encoding: 'utf-8')
  return [nil, nil] unless zeilen.first && zeilen.first.chomp == '---'
  ende = zeilen[1..].index { |z| %w[--- ...].include?(z.chomp) }
  return [nil, 'Front Matter ist nicht abgeschlossen (es fehlt die zweite `---`-Zeile)'] if ende.nil?
  roh = zeilen[1, ende].join
  daten = YAML.safe_load(roh, permitted_classes: [Date, Time], aliases: true)
  return [nil, nil] if daten.nil?
  return [nil, 'Front Matter ist kein Abschnitt aus Feldern'] unless daten.is_a?(Hash)
  [daten, nil]
rescue Psych::SyntaxError => e
  [nil, "Front Matter ist kein gültiges YAML: #{e.message}"]
end

# Zeilennummer des obersten Feldes eines Zeigers – macht die Meldung anklickbar.
def zeile_von(pfad, zeiger, versatz)
  feld = zeiger.split('/').reject(&:empty?).first
  return nil unless feld
  File.readlines(pfad, encoding: 'utf-8').each_with_index do |z, i|
    return i + 1 if i >= versatz && z =~ /\A#{Regexp.escape(feld)}\s*:/
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
def zielgruppen_pruefen(daten, deklariert, quelle, pfad = [])
  meldungen = []
  case daten
  when Hash
    daten.each do |k, v|
      # `audiences` auf der WURZEL einer Konfiguration ist die Deklaration selbst, keine
      # Verwendung – sonst pruefte sie sich gegen sich.
      deklaration = k == 'audiences' && pfad.empty?
      # `audience_filter` benutzt die Zielgruppen als SCHLÜSSEL, nicht als Werte – der
      # Durchlauf unten würde sie nie zu Gesicht bekommen. Ein Tippfehler darin wirkt
      # still: Die Regel greift nie, die Ausgabe ist ungefiltert statt gefiltert, und
      # weil eine ungefilterte Ausgabe VOLLSTÄNDIG aussieht, fällt es niemandem auf.
      if k == 'audience_filter' && pfad.empty? && v.is_a?(Hash)
        v.each_key do |zielgruppe|
          next unless zielgruppe.is_a?(String)
          if deklariert.nil? || deklariert.empty?
            meldungen << ["audience_filter.#{zielgruppe}",
                          "Zielgruppe `#{zielgruppe}` benutzt, aber die Site deklariert keine " \
                          '`audiences`. Ohne Deklaration ist der Wert nicht prüfbar.']
          elsif !deklariert.include?(zielgruppe)
            meldungen << ["audience_filter.#{zielgruppe}",
                          "`#{zielgruppe}` ist keine deklarierte Zielgruppe. Deklariert sind: " \
                          "#{deklariert.join(', ')} (Schlüssel `audiences` in der _config.yml)."]
          end
        end
        next
      end
      benutzt = !deklaration && (k == 'audiences' || (k == 'audience' && v.is_a?(String)))
      if benutzt
        voll = (pfad + [k.to_s]).join('.')
        Array(v).each do |wert|
          next unless wert.is_a?(String)
          if deklariert.nil? || deklariert.empty?
            meldungen << [voll, "Zielgruppe `#{wert}` benutzt, aber die Site deklariert keine " \
                                '`audiences`. Ohne Deklaration ist der Wert nicht prüfbar – ' \
                                'ein Tippfehler fiele nirgends auf.']
          elsif !deklariert.include?(wert)
            meldungen << [voll, "`#{wert}` ist keine deklarierte Zielgruppe. Deklariert sind: " \
                                "#{deklariert.join(', ')} (Schlüssel `audiences` in der _config.yml)."]
          end
        end
      else
        meldungen += zielgruppen_pruefen(v, deklariert, quelle, pfad + [k.to_s])
      end
    end
  when Array
    daten.each_with_index { |v, i| meldungen += zielgruppen_pruefen(v, deklariert, quelle, pfad + [i.to_s]) }
  end
  meldungen
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
class SchemaDurchlauf
  attr_reader :seitenverweise

  def initialize(validator, deklariert)
    @v = validator
    @deklariert = deklariert
    @meldungen = []
    @seitenverweise = []
  end

  def lauf(wert, schema, datei, pfad = [])
    @meldungen = []
    @seitenverweise = []
    gehe(wert, schema, datei, pfad)
    @meldungen
  end

  private

  def gehe(wert, schema, datei, pfad)
    return unless schema.is_a?(Hash)

    if (ref = schema['$ref'])
      ziel, fragment = ref.split('#', 2)
      ziel_datei = ziel.nil? || ziel.empty? ? datei : File.expand_path(ziel, File.dirname(datei))
      begin
        unter = @v.dokument(ziel_datei)
      rescue StandardError
        return
      end
      (fragment || '').split('/').reject(&:empty?).each { |t| unter = unter.is_a?(Hash) ? unter[t] : nil }
      return if unter.nil?
      # DER TREFFER: eine Sprachkarte an dieser Stelle erlaubt, und der Wert ist eine.
      if ref.end_with?('/definitions/sprachtext') && wert.is_a?(Hash)
        pruefe_codes(wert, pfad)
        return
      end
      if ref.end_with?('/definitions/seitenverweis') && wert.is_a?(String)
        @seitenverweise << [pfad.join('.'), wert]
        return
      end
      return gehe(wert, unter, ziel_datei, pfad)
    end

    %w[oneOf anyOf allOf].each { |c| Array(schema[c]).each { |s| gehe(wert, s, datei, pfad) } }

    if wert.is_a?(Hash)
      eigenschaften = schema['properties'] || {}
      muster = schema['patternProperties'] || {}
      wert.each do |k, v|
        unter_pfad = pfad + [k.to_s]
        if eigenschaften.key?(k)
          gehe(v, eigenschaften[k], datei, unter_pfad)
          next
        end
        treffer = muster.keys.select { |m| Regexp.new(m).match?(k.to_s) }
        if treffer.any?
          treffer.each { |m| gehe(v, muster[m], datei, unter_pfad) }
          next
        end
        gehe(v, schema['additionalProperties'], datei, unter_pfad) if schema['additionalProperties'].is_a?(Hash)
      end
    elsif wert.is_a?(Array) && schema['items'].is_a?(Hash)
      wert.each_with_index { |v, i| gehe(v, schema['items'], datei, pfad + [i.to_s]) }
    end
  end

  def pruefe_codes(karte, pfad)
    voll = pfad.join('.')
    karte.each_key do |code|
      next if @deklariert.include?(code.to_s)
      text = if @deklariert.empty?
               "Sprachkarte benutzt (`#{code}`), aber die Site deklariert keine " \
               '`i18n.languages`. Ohne Deklaration ist der Code nicht prüfbar – ' \
               'ein Tippfehler fiele nirgends auf.'
             else
               "`#{code}` ist keine deklarierte Sprache. Deklariert sind: " \
               "#{@deklariert.join(', ')} (Schlüssel `i18n.languages` in der _config.yml)."
             end
      @meldungen << [voll, text]
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
def sprache_von_pfad(rel, sprachen, standard)
  treffer = standard
  laenge = 0
  sprachen.each do |sp|
    code = sp['code'].to_s
    basis = (sp['base'] || (code == standard ? '/' : "/#{code}/")).to_s
    praefix = basis.sub(%r{\A/}, '')
    next if praefix.empty?
    next unless rel.start_with?(praefix)
    next unless praefix.length > laenge
    laenge = praefix.length
    treffer = code
  end
  treffer
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
def selbsttest(pfade)
  fehler = []
  bekannt = SCHLUESSELWOERTER + %w[$schema $id title description examples definitions default]

  # Schluessel ist der Dateiname, wie ihn ein `$ref` schreibt – so bleibt die
  # Referenzpruefung unabhaengig davon, wo die Dateien liegen.
  dokumente = {}
  namen = {}
  pfade.each do |rolle, pfad|
    name = File.basename(pfad)
    namen[rolle] = name
    begin
      dokumente[name] = JSON.parse(File.read(pfad))
    rescue JSON::ParserError => e
      fehler << "#{name}: kein gültiges JSON – #{e.message}"
    end
  end
  return fehler unless fehler.empty?
  dateien = namen.values

  # Rekursiv durch alle Schema-Knoten. Ein Knoten ist ein Schema, wenn er als
  # Wert an einer Schema-Stelle steht – deshalb wird über die bekannten
  # Container-Schlüssel navigiert statt blind über alle Hashes.
  pruefe = lambda do |knoten, datei, pfad|
    return unless knoten.is_a?(Hash)
    (knoten.keys - bekannt).each do |k|
      fehler << "#{datei}#{pfad}: Schlüsselwort `#{k}` kennt validate.rb nicht – " \
                'entweder aus dem Schema entfernen oder in SCHLUESSELWOERTER ergänzen ' \
                '(sonst urteilen IDE und Pipeline unterschiedlich).'
    end
    if (ref = knoten['$ref'])
      ziel, fragment = ref.split('#', 2)
      ziel = datei if ziel.nil? || ziel.empty?
      doc = dokumente[File.basename(ziel)]
      if doc.nil?
        fehler << "#{datei}#{pfad}: `$ref` zeigt auf #{ziel} – diese Datei gehört nicht zum Schema-Satz."
      else
        unter = doc
        (fragment || '').split('/').reject(&:empty?).each { |t| unter = unter.is_a?(Hash) ? unter[t] : nil }
        fehler << "#{datei}#{pfad}: `$ref` #{ref} ist nicht auflösbar." if unter.nil?
      end
    end
    %w[properties patternProperties definitions].each do |c|
      (knoten[c] || {}).each { |k, v| pruefe.call(v, datei, "#{pfad}/#{c}/#{k}") }
    end
    %w[items additionalProperties].each do |c|
      pruefe.call(knoten[c], datei, "#{pfad}/#{c}") if knoten[c].is_a?(Hash)
    end
    %w[oneOf anyOf allOf].each do |c|
      Array(knoten[c]).each_with_index { |v, i| pruefe.call(v, datei, "#{pfad}/#{c}/#{i}") }
    end
  end
  dateien.each { |datei| pruefe.call(dokumente[datei], datei, '') }

  # KEIN PFLICHTFELD IM FRONT MATTER. Eine Seite ohne Front Matter muss bauen, und
  # zwar richtig – wer eine .md anlegt, soll schreiben koennen, ohne vorher eine
  # Feldliste zu lesen. Ein `required` auf oberster Ebene waere genau das Gegenteil
  # und faellt sonst niemandem auf, bis ein bestehendes Repo rot wird.
  # `required` INNERHALB einer Unterstruktur bleibt erlaubt: Ein resources-Eintrag
  # ohne `url` ist kein Standardfall, sondern ein halber Eintrag.
  wurzel_required = dokumente[namen[:frontmatter]]['required']
  unless wurzel_required.nil?
    fehler << 'frontmatter.schema.json: `required` auf oberster Ebene ist nicht erlaubt ' \
              "(#{Array(wurzel_required).join(', ')}). Jedes Front-Matter-Feld ist optional – " \
              'das Theme darf kein Feld verlangen. Stattdessen einen Standardwert vorsehen.'
  end
  fehler
end

# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------
wurzel = Dir.pwd
schema_dir = __dir__
configs = []
fm_schema = nil
cfg_schema = nil
selbsttest_nur = false
argv = ARGV.dup
site_dir = nil
site_pflicht = false
until argv.empty?
  case (arg = argv.shift)
  when '--root'  then wurzel = argv.shift
  when '--schemas' then schema_dir = argv.shift
  when '--frontmatter-schema' then fm_schema = argv.shift
  when '--config-schema'      then cfg_schema = argv.shift
  when '--config'  then configs << argv.shift
  when '--self-test' then selbsttest_nur = true
  when '--site' then site_dir = argv.shift
  when '--require-site' then site_pflicht = true
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
pfade = {
  frontmatter: fm_schema || File.join(schema_dir, 'frontmatter.schema.json'),
  config: cfg_schema || File.join(schema_dir, 'config.schema.json')
}
pfade.each do |rolle, pfad|
  next if File.exist?(pfad)
  warn "FEHLER: Das #{rolle == :config ? 'Konfigurations' : 'Front-Matter'}-Schema fehlt: #{pfad}"
  warn '       Das Theme liefert die Schemas unter theme/jekyll/schema/ aus, die Doku-Site'
  warn '       unter /schemas/«name»/«version»/schema.json. Ohne sie gibt es keine Prüfung –'
  warn '       und eine Prüfung, die nichts prüft, ist kein Erfolg.'
  exit 2
end

if selbsttest_nur
  fehler = selbsttest(pfade)
  if fehler.empty?
    puts "Schema-Selbsttest bestanden (#{pfade.values.map { |p| File.basename(File.dirname(p)) + '/' + File.basename(p) }.join(', ')})."
    exit 0
  end
  warn "FEHLER: #{fehler.size} Problem(e) in den Schemas selbst:"
  warn ''
  fehler.each { |f| warn "  #{f}" }
  exit 1
end

validator = Validator.new
def schema_version(dir, name)
  datei = File.join(dir, "#{name}.version.txt")
  File.exist?(datei) ? File.read(datei).strip : '?'
end
# Version: die Datei neben dem Schema (veroeffentlichte Ablage: schemas/«name»/version.txt,
# Paket: «name».version.txt). Fehlt sie, steht dort ein Fragezeichen statt einer Erfindung.
def version_von(pfad, name)
  kandidaten = [
    File.join(File.dirname(pfad), "#{name}.version.txt"),
    File.join(File.dirname(pfad), '..', 'version.txt')
  ]
  kandidaten.each { |k| return File.read(k).strip if File.exist?(k) }
  '?'
end
version = "Front Matter #{version_von(pfade[:frontmatter], 'frontmatter')} / Config #{version_von(pfade[:config], 'config')}"
configs = [File.join(wurzel, '_config.yml')] if configs.empty?

meldungen = []

# --- _config.yml ---------------------------------------------------------
ausschluss = []
zielgruppen = []
sprachen = []
standardsprache = 'de'
konfigurationen_daten = []
configs.each do |cfg|
  unless File.exist?(cfg)
    warn "FEHLER: #{cfg} gibt es nicht."
    exit 2
  end
  begin
    daten = YAML.safe_load(File.read(cfg), permitted_classes: [Date, Time], aliases: true) || {}
  rescue Psych::SyntaxError => e
    meldungen << "#{cfg}: kein gültiges YAML – #{e.message}"
    next
  end
  ausschluss += Array(daten['exclude'])
  zielgruppen += Array(daten['audiences'])
  sprachen += Array(daten.dig('i18n', 'languages')).select { |sp| sp.is_a?(Hash) && sp['code'] }
  standardsprache = daten['lang'].to_s if daten['lang']
  anzeige = cfg.sub(/\A#{Regexp.escape(wurzel)}\/?/, '')
  konfigurationen_daten << [anzeige, cfg, daten]
  validator.pruefen(daten, validator.dokument(pfade[:config]), pfade[:config]).each do |f|
    zeile = zeile_von(cfg, f[:zeiger], 0)
    meldungen << "#{anzeige}#{zeile ? ":#{zeile}" : ''}: #{f[:zeiger].empty? ? '' : "`#{f[:zeiger].sub(%r{\A/}, '').gsub('/', '.')}` "}#{f[:text]}"
  end
end

# --- Zielgruppen in den Konfigurationen (nav, audience des Builds) -------
# Erst NACH allen Konfigurationen, denn `audiences` kann im Overlay stehen.
sprachcodes = sprachen.map { |sp| sp['code'].to_s }.uniq
karten = SchemaDurchlauf.new(validator, sprachcodes)
# Alle vergebenen `page_id` und alle `page:`-Verweise – geprüft wird nach dem Durchlauf,
# denn ein Verweis darf auf eine Seite zeigen, die spaeter im Baum kommt.
vergebene_ids = []
verweise = []
konfigurationen_daten.each do |anzeige, cfg, daten|
  zielgruppen_pruefen(daten, zielgruppen.uniq, anzeige).each do |feld, text|
    zeile = zeile_von(cfg, '/' + feld.split('.').first, 0)
    meldungen << "#{anzeige}#{zeile ? ":#{zeile}" : ''}: `#{feld}` #{text}"
  end
  # `i18n.languages` ist die Deklaration selbst und wird nicht gegen sich geprüft.
  ohne_deklaration = daten.reject { |k, _| k == 'i18n' }
  karten.lauf(ohne_deklaration, validator.dokument(pfade[:config]), pfade[:config]).each do |feld, text|
    zeile = zeile_von(cfg, '/' + feld.split('.').first, 0)
    meldungen << "#{anzeige}#{zeile ? ":#{zeile}" : ''}: `#{feld}` #{text}"
  end
  karten.seitenverweise.each { |feld, id| verweise << [anzeige, cfg, 0, feld, id] }
end

# Die Standardsprache MUSS mit deklariert sein – sonst hätte der Wurzelbaum keine
# Sprache, und `page_id` liesse sich ihm nicht zuordnen.
if sprachcodes.any? && !sprachcodes.include?(standardsprache)
  meldungen << "_config.yml: `lang` ist `#{standardsprache}`, steht aber nicht in " \
               "`i18n.languages` (dort: #{sprachcodes.join(', ')}). Die Standardsprache gehört " \
               'mit in die Deklaration – ihr Sprachbaum ist die Wurzel der Site.'
end

# --- Front Matter aller Seiten und Collection-Dokumente ------------------
# Die Collections stehen erst hier fest: Sie können in einem Overlay erklärt werden,
# und gelesen sind alle Konfigurationen erst nach der Schleife oben.
sammlungen = sammlungsverzeichnisse(konfigurationen_daten.map { |_, _, daten| daten })
seiten = 0
sammlungsseiten = 0
uebersetzungen = {}
dateinamen = {}
ohne_sprachangabe = []
# Braucht diese Site das Adressen-Plugin? Zwei Anzeichen, beide allein am QUELLTEXT
# ablesbar – die Pruefung rechnet KEINE Adresse nach. Sonst staende die Abbildungsregel
# ein zweites Mal hier und koennte von der im Plugin abweichen.
slug_vorhanden = false
nebeneinander = false
Dir.glob(File.join(wurzel, '**', '*.{md,markdown,html}')).sort.each do |pfad|
  rel = pfad.sub(/\A#{Regexp.escape(wurzel)}\/?/, '')
  next if uebersprungen?(rel, ausschluss, sammlungen)
  daten, fehler = front_matter(pfad)
  if fehler
    meldungen << "#{rel}: #{fehler}"
    next
  end
  seiten += 1
  sammlungsseiten += 1 if in_sammlung?(rel, sammlungen)

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
  seitensprache = sprache_von_pfad(rel, sprachen, standardsprache)
  slug_vorhanden = true if daten.is_a?(Hash) && (daten['slug'] || daten['folder_slug'])
  if daten.is_a?(Hash) && daten['lang'].is_a?(String)
    # SPRACHE DEKLARIERT, ORDNER SAGT ETWAS ANDERES: Die Seite liegt NEBEN ihrer
    # Uebersetzung statt im Sprachbaum. Dann erzeugt nur das Plugin das `/en/`-Praefix.
    nebeneinander = true if daten['lang'].split('-').first.downcase !=
                            seitensprache.split('-').first.downcase
    seitensprache = daten['lang']
  elsif daten.is_a?(Hash)
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
    ohne_sprachangabe << rel
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
  if daten.is_a?(Hash)
    basis = File.basename(rel, '.*')
    kurz = basis.sub(/_#{Regexp.escape(seitensprache.to_s.split('-').first.downcase)}\z/, '')
    ist_index = kurz == 'index'
    if daten['folder_slug'] && !ist_index
      meldungen << "#{rel}: `folder_slug` benennt den ORDNER und gehört deshalb in " \
                   'dessen `index.md` (bzw. `index_«code».md`), nicht in eine ' \
                   'gewöhnliche Seite. Für DIESE Seite ist `slug` gemeint.'
    end
    if daten['slug'] && ist_index
      meldungen << "#{rel}: `slug` ist auf einer Index-Seite nicht erlaubt – ihre " \
                   'Adresse IST der Ordner. Die Angabe nähme dem Ordner seine ' \
                   'Index-Datei, `/…/` liefe ins Leere. Gemeint ist `folder_slug`.'
    end
  end
  if daten.is_a?(Hash) && daten['page_id'].is_a?(String)
    vergebene_ids << daten['page_id']
    (uebersetzungen[[seitensprache, daten['page_id']]] ||= []) << rel
  end
  dateiname = File.basename(rel).sub(/\.(md|markdown|html?)\z/i, '')
  (dateinamen[[seitensprache, dateiname]] ||= []) << rel

  next if daten.nil?
  validator.pruefen(daten, validator.dokument(pfade[:frontmatter]), pfade[:frontmatter]).each do |f|
    zeile = zeile_von(pfad, f[:zeiger], 1)
    meldungen << "#{rel}#{zeile ? ":#{zeile}" : ''}: #{f[:zeiger].empty? ? '' : "`#{f[:zeiger].sub(%r{\A/}, '').gsub('/', '.')}` "}#{f[:text]}"
  end
  zielgruppen_pruefen(daten, zielgruppen.uniq, rel).each do |feld, text|
    zeile = zeile_von(pfad, '/' + feld.split('.').first, 1)
    meldungen << "#{rel}#{zeile ? ":#{zeile}" : ''}: `#{feld}` #{text}"
  end
  karten.lauf(daten, validator.dokument(pfade[:frontmatter]), pfade[:frontmatter]).each do |feld, text|
    zeile = zeile_von(pfad, '/' + feld.split('.').first, 1)
    meldungen << "#{rel}#{zeile ? ":#{zeile}" : ''}: `#{feld}` #{text}"
  end
  karten.seitenverweise.each { |feld, id| verweise << [rel, pfad, 1, feld, id] }


  # `lang` je Seite gegen die Deklaration – wie eine Zielgruppe.
  if daten['lang'].is_a?(String) && sprachcodes.any? && !sprachcodes.include?(daten['lang'])
    zeile = zeile_von(pfad, '/lang', 1)
    meldungen << "#{rel}#{zeile ? ":#{zeile}" : ''}: `lang` `#{daten['lang']}` ist keine " \
                 "deklarierte Sprache. Deklariert sind: #{sprachcodes.join(', ')}."
  end

end

# --- Seitenverweise: zeigt jede `page`-Angabe auf eine vorhandene `page_id`? ------
# EIN TIPPFEHLER WAERE SONST EIN STILLER AUSFALL: `avd-page-url.html` findet nichts,
# liefert eine leere Zeichenkette, und der Aufrufer lässt den Verweis weg. Im HTML fehlt
# dann einfach ein Menuepunkt – niemand sieht, dass er fehlen sollte.
verweise.each do |anzeige, datei, versatz, feld, id|
  zeile = zeile_von(datei, '/' + feld.split('.').first, versatz)
  ort = "#{anzeige}#{zeile ? ":#{zeile}" : ''}"

  per_id   = uebersetzungen.select { |(_spr, wert), _| wert == id }
  per_name = dateinamen.select { |(_spr, wert), _| wert == id }

  if per_id.empty? && per_name.empty?
    bekannt = vergebene_ids.uniq.sort
    meldungen << "#{ort}: `#{feld}` verweist mit `page: #{id}` auf eine Seite, die es " \
                 'nicht gibt – keine Seite trägt diese `page_id`, und keine Datei heißt ' \
                 "so.#{bekannt.empty? ? '' : " Vergebene IDs: #{bekannt.join(', ')}."}"
    next
  end

  # MEHRDEUTIG IST NUR, WAS AUCH GENOMMEN WIRD. Greift der Verweis über eine
  # ausdrückliche `page_id`, sind gleichnamige DATEIEN gleichgültig – die ID hat Vorrang
  # (siehe avd-page-url.html). Erst wenn er über den Dateinamen geht, zählt dessen
  # Eindeutigkeit. Sonst wäre `page: schnellstart` in jedem Repo ein Fehler, das
  # irgendwo eine zweite `schnellstart.md` liegen hat, auf die niemand verweist.
  quelle = per_id.empty? ? per_name : per_id
  quelle.each do |(spr, _wert), dateien|
    next if dateien.size < 2
    meldungen << "#{ort}: `#{feld}` verweist mit `page: #{id}` mehrdeutig – in der " \
                 "Sprache `#{spr}` passen #{dateien.size} Seiten (#{dateien.join(', ')}). " \
                 'Einer davon eine ausdrückliche `page_id` geben; über den Dateinamen ' \
                 'ist nicht bestimmt, welche gemeint ist.'
  end
end

# --- page_id: je Sprache eindeutig --------------------------------------
# ZWEI SEITEN DERSELBEN SPRACHE MIT DERSELBEN ID sind keine Übersetzung, sondern eine
# Mehrdeutigkeit: Der Umschalter nimmt die erste, die er findet, und welche das ist,
# entscheidet die Sortierung des Dateisystems. Das fällt beim Bauen nicht auf.
uebersetzungen.each do |(sprache, id), dateien|
  next if dateien.size < 2
  meldungen << "#{dateien.first}: `page_id` `#{id}` kommt in der Sprache " \
               "`#{sprache}` mehrfach vor (#{dateien.join(', ')}). Je Sprache darf es zu " \
               'einer ID nur EINE Seite geben – sonst ist weder bestimmt, wohin der ' \
               'Sprachumschalter führt, noch wohin ein `page`-Verweis zeigt.'
end

# Eine Prüfung über die leere Menge ist kein Erfolg.
if seiten.zero?
  warn "FEHLER: Unter #{wurzel} wurde KEINE Seite gefunden."
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
  spur = File.join(site_dir, '.avd-addresses')
  braucht = slug_vorhanden || nebeneinander
  if !Dir.exist?(site_dir)
    if site_pflicht
      warn "FEHLER: --require-site verlangt eine gebaute Site, #{site_dir}/ gibt es nicht."
      exit 2
    end
    warn "Hinweis: Adressen-Plugin NICHT geprüft – keine gebaute Site unter #{site_dir}/."
    warn ''
  elsif braucht && !File.exist?(spur)
    grund = []
    grund << '`slug`-Angaben im Front Matter' if slug_vorhanden
    grund << 'Seiten, die ihre Sprache deklarieren und NICHT im Sprachbaum liegen' if nebeneinander
    warn 'FEHLER: Das Adressen-Plugin des Themes hat beim Bauen NICHT gewirkt.'
    warn ''
    warn "       Diese Site braucht es – sie hat #{grund.join(' und ')}."
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
if sprachcodes.size > 1 && !ohne_sprachangabe.empty?
  beispiele = ohne_sprachangabe.first(3).join(', ')
  rest = ohne_sprachangabe.size - [ohne_sprachangabe.size, 3].min
  warn "HINWEIS: #{ohne_sprachangabe.size} Seite(n) ohne `lang` im Front Matter – dort " \
       'entscheidet der Ordner über die Sprache. Das ist gültig, bindet die Seite aber an ' \
       'ihren Platz im Baum; eine Übersetzung lässt sich so nicht woanders ablegen.'
  warn "         z. B. #{beispiele}#{rest.positive? ? " (und #{rest} weitere)" : ''}"
  warn ''
end

if meldungen.empty?
  zg = zielgruppen.uniq.empty? ? 'keine Zielgruppen deklariert' : "Zielgruppen: #{zielgruppen.uniq.join(', ')}"
  spr = sprachcodes.empty? ? 'einsprachig' : "Sprachen: #{sprachcodes.join(', ')}"
  # Die Collection-Dokumente werden EIGENS genannt: Wer eine Collection anlegt, soll der
  # Meldung ansehen, dass sie mit geprüft wurde – und nicht raten müssen, ob die Zahl
  # sie enthält.
  aus_sammlungen = sammlungsseiten.zero? ? '' : " (darunter #{sammlungsseiten} aus Collections)"
  puts "Schema #{version}: #{configs.size} Konfiguration(en) und #{seiten} Seite(n)#{aus_sammlungen} geprüft, #{zg}, #{spr} – keine Verstöße."
  exit 0
end

warn "FEHLER: #{meldungen.size} Verstoß/Verstöße gegen die Academy-Schemas (#{version}):"
warn ''
meldungen.each { |m| warn "  #{m}" }
warn ''
warn 'Was jetzt zu tun ist:'
warn '  * Tippfehler im Feldnamen? Die erlaubten Felder stehen in der Meldung.'
warn '  * Feld ABSICHTLICH neu? Dann gehört es ins Schema UND in die Theme-Doku'
warn '    (docs/theme/schemas.md) – ein Feld ohne Doku findet niemand wieder.'
warn '  * Repo-eigenes Feld, das das Theme nicht liest? Präfix `x_` verwenden.'
exit 1
