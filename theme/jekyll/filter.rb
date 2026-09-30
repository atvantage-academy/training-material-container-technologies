#!/usr/bin/env ruby
# =============================================================================
# Zielgruppenfilter – aus einem Quellbaum die Sicht EINER Zielgruppe machen
#
#   ruby theme/jekyll/filter.rb --audience learner
#   ruby theme/jekyll/filter.rb --audience learner --source . --into ausgabe/
#   ruby theme/jekyll/filter.rb --self-test
#
# WOFÜR: Eine Unterlage trägt Material für mehrere Zielgruppen. Was eine Gruppe
# nicht sehen soll, darf nicht in ihrer Ausgabe landen – und „nicht sehen“ heißt
# hier nicht „ausgeblendet“, sondern „gar nicht erst gebaut“.
#
# DIESES WERKZEUG KENNT KEINE ZIELGRUPPE. Es weiß nicht, dass es „trainer“ oder
# „learner“ gibt; welche Werte eine Site führt, steht in ihrer `_config.yml`.
# Das Theme liefert den Mechanismus, die Werte gehören dem Werkzeug, das die
# Site baut. Stünde hier ein Name, müsste jede neue Zielgruppe das Theme ändern.
#
# DIE REGEL, UND ES IST NUR EINE:
#
#     keine `audiences`-Angabe   ->  erscheint in JEDEM Build
#     `audiences: [a]`           ->  erscheint NUR im Build für a
#
# Ausdrücklich auch gegenüber einer Gruppe, die „eigentlich alles sehen darf“:
# Wer will, dass Trainer:innen eine Lernenden-Seite bekommen, trägt `trainer`
# mit ein. Eine Ausnahmeliste in der Konfiguration gibt es nicht mehr – sie war
# der Grund, warum ein Build ungefiltert lief, ohne dass es jemandem auffiel.
#
# ZWEI FASSUNGEN UNTER DERSELBEN ADRESSE sind damit möglich, und das ist der
# eigentliche Gewinn: Eine Startseite kann für Lernende anders aussehen als für
# Trainer:innen, ohne dass eine Verzweigung IM Inhalt steht. Gefiltert wird VOR
# Jekyll – der Renderer sieht die Kollision deshalb nie, und weder das
# Adressen-Plugin noch die `page_id`-Auflösung mussten dafür angefasst werden.
#
# ES GIBT KEINE VORGABE-ZIELGRUPPE. Eine Site, die `audiences` deklariert, MUSS
# eine nennen; eine Site ohne Deklaration hat keine Zielgruppen und wird nicht
# gefiltert. Eine Vorgabe wäre eine Annahme darüber, wer was sehen darf – und
# die falsche Annahme veröffentlicht Trainermaterial.
#
# RÜCKGABEWERTE: 0 gefiltert, 4 Konfiguration unbrauchbar, 5 Befunde im Baum.
# =============================================================================

require 'yaml'
require 'date'
require 'fileutils'
require 'set'

MARKDOWN = %w[.md .markdown .mkdown .mkdn .mkd].freeze
LANG_SUFFIX = /_([a-z]{2}(?:-[A-Za-z0-9]+)?)\z/.freeze

def front_matter(path)
  raw = File.read(path, encoding: 'UTF-8', invalid: :replace, undef: :replace)
  lines = raw.split("\n", -1)
  return nil unless lines.first.to_s.match?(/\A---[ \t]*\r?\z/)

  closing = lines.drop(1).index { |z| z.match?(/\A(?:---|\.\.\.)[ \t]*\r?\z/) }
  return nil if closing.nil?

  YAML.safe_load(lines[1..closing].join("\n"), permitted_classes: [Date, Time], aliases: true) || {}
rescue Psych::Exception => e
  # Ein kaputtes Front Matter ist ein Befund, kein Absturz – und einer, den
  # Jekyll ohnehin melden würde. Hier zählt nur, dass er benannt wird.
  { '__fehler' => e.message }
end

# DIE SPRACHE GEHÖRT IN DEN ADRESSSCHLÜSSEL, sonst gibt es Fehlalarme: `a.md`
# und `b_en.md` mit demselben `slug` liegen auf verschiedenen Adressen, weil sie
# in verschiedenen Sprachbäumen landen. Ohne die Sprache sähe das wie eine
# Kollision aus, und der Lauf bräche ab, wo nichts kaputt ist.
def language(head, base)
  return head['lang'].to_s if head.is_a?(Hash) && head['lang'].is_a?(String)

  hits = base.match(LANG_SUFFIX)
  hits ? hits[1] : ''
end

# DIE ADRESSE, SOWEIT SIE FÜR EINE KOLLISION HIER ZÄHLT.
#
# ES GIBT ZWEI PRÜFSTELLEN, UND DAS IST ABSICHT – keine davon deckt allein alles ab:
#
#   HIER, vor Jekyll:  Fassungen, die ihre Adresse über `permalink` beanspruchen.
#                      Genau das tut die zweite Startseite einer Zielgruppe, und
#                      genau die sieht das Adressen-Plugin NICHT: Es verwirft
#                      `permalink`-Seiten aus seinen Kandidaten, weil es sie nicht
#                      umbenennen darf.
#   avd-addresses.rb:  alles, was über `slug` und `folder_slug` abgebildet wird –
#                      einschließlich ZWEIER PHYSISCHER ORDNER, die über
#                      `folder_slug` auf denselben Web-Ordner zeigen. Dateien
#                      daraus landen nebeneinander, und das Plugin bricht ab. Weil
#                      jeder Zielgruppen-Build ein eigener Jekyll-Lauf über den
#                      gefilterten Baum ist, greift das je Zielgruppe.
#
# `folder_slug` wird hier deshalb NICHT gelesen: Die Auflösung ein zweites Mal zu
# bauen hieße, zwei Fassungen derselben Logik zu pflegen, und die driften. Der
# Ordner im Schlüssel unten ist der PHYSISCHE – er unterscheidet, was in
# verschiedenen Ordnern liegt, und mehr muss er nicht, weil das Plugin die
# Abbildung beurteilt.
#
# `slug` als SPRACHKARTE (`{de: …, en: …}`) wird übergangen: Welche Adresse
# gemeint ist, hängt dann an der Sprache der Seite, und ein falsch geratener
# Schlüssel wäre ein Abbruch, wo nichts kaputt ist. Solche Dateien nehmen an der
# Kollisionsprüfung nicht teil; Jekyll meldet eine echte Doppelbelegung weiter.
#
# EINE INDEX-SEITE BEANSPRUCHT DEN ORDNER, nicht einen Namen darin – und ein
# `permalink`, der auf `/` endet, beansprucht ebenfalls einen Ordner. Beide
# werden auf dieselbe Form gebracht, sonst sähe `index.md` neben einem
# `permalink: /` wie zwei verschiedene Adressen aus. Genau das ist der Fall, für
# den es diese Prüfung gibt: die Startseite in zwei Zielgruppenfassungen.
def folder_slug(path, lang)
  ['ordner', "#{path.to_s.gsub(%r{\A/+|/+\z}, '')}\t#{lang}"]
end

def address(head, relative)
  head = {} unless head.is_a?(Hash)
  base = File.basename(relative, '.*')
  lang = language(head, base)
  folder = File.dirname(relative).sub(/\A\.\z/, '')

  if head['permalink'].is_a?(String)
    target = head['permalink']
    return target.end_with?('/') ? folder_slug(target, lang) : ['permalink', "#{target}\t#{lang}"]
  end

  return nil if head['slug'].is_a?(Hash)

  segment = head['slug'].is_a?(String) ? head['slug'] : base.sub(LANG_SUFFIX, '')
  return folder_slug(folder, lang) if segment == 'index'

  ['pfad', "#{folder}\t#{segment}\t#{lang}"]
end

# =============================================================================
# DIE WEICHE IM INHALT: `{% audience … %}` … `{% endaudience %}`
# -----------------------------------------------------------------------------
# Eine ganze Seite je Zielgruppe ist die grobe, sichere Einheit. Für EINE Zeile
# ist sie zu grob: Eine zweite, fast gleiche Fassung ist Doppelpflege, und
# Doppelpflege driftet. Dafür gibt es die Weiche.
#
#     {% audience trainer %}
#     Nur für Trainer:innen: siehe [Regie Tag 1](trainer-regie-tag-1.md).
#     {% endaudience %}
#
# Trifft die gebaute Zielgruppe zu, bleibt der Inhalt und die beiden Zeilen
# verschwinden. Trifft sie nicht zu, verschwindet beides.
#
# MEHRERE ZIELGRUPPEN STEHEN NEBENEINANDER, getrennt durch Komma oder Leerraum:
#
#     {% audience trainer, pruefer %}
#
# Der Block gilt dann fuer jede genannte. Eine Verneinung gibt es nicht - sie
# waere die Liste aller uebrigen und damit dieselbe Angabe, nur schwerer zu
# lesen und stillschweigend falsch, sobald eine Zielgruppe dazukommt.
#
# WARUM LIQUID-SYNTAX, OBWOHL LIQUID ABGESCHALTET IST – und warum trotzdem KEIN
# `{% if %}`:
#
#   Die Klammern sind das Sicherheitsnetz. Wird die Weiche nicht ersetzt, weil
#   der Filter nicht lief, dann passiert genau eines von zwei Dingen, und beide
#   sind laut:
#     * Liquid ist AN  -> `audience` ist kein registrierter Tag, Jekyll bricht
#       mit „Unknown tag" ab.
#     * Liquid ist AUS -> der Tag steht wörtlich auf der Seite und `liquid.rb`
#       meldet ihn.
#   Eine unauffällige Syntax - ein HTML-Kommentar etwa - hätte die schlechteste
#   Eigenschaft überhaupt: Bliebe sie stehen, wäre der Marker unsichtbar und der
#   INHALT sichtbar. Ein stiller Durchstich statt eines Fehlers.
#
#   `{% if %}` wäre die naheliegende Schreibweise und ist die falsche. Sie ist
#   eine Zusage auf Liquids Ausdrucksgrammatik: `and`, `or`, `contains`,
#   `elsif`, Vergleiche gegen beliebige Variablen. Wer sie nachbaut, baut sie
#   halb nach - und ein Ausdruck, den der Filter anders liest als Liquid, ist
#   schlimmer als gar keine Weiche. Ein EIGENER Tag hat keine Grammatik zu
#   erben: Er nimmt eine Liste von Zielgruppen, mehr nicht.
#
# BLOCKWEISE, JEDER TAG AUF EIGENER ZEILE. Mitten im Satz wäre es eine
# Operation am Text statt an Zeilen - und was dabei mit Satzzeichen und
# Leerraum geschieht, wäre von Fall zu Fall anders. Ein Tag mitten in einer
# Zeile ist deshalb ein Fehler und kein halbes Ergebnis.
#
# IN CODE GILT ER NICHT. Ein umzäunter Block zeigt die Schreibweise, statt sie
# zu verwenden - sonst könnte diese Datei ihre eigene Dokumentation nicht
# schreiben.
AUDIENCE_OPEN = /\A\s*\{%-?\s*audience\b([^%]*?)-?%\}\s*\z/.freeze
AUDIENCE_CLOSE = /\A\s*\{%-?\s*endaudience\s*-?%\}\s*\z/.freeze
AUDIENCE_ANYWHERE = /\{%-?\s*(?:end)?audience\b/.freeze
FENCE = /\A[ \t]*(`{3,}|~{3,})/.freeze

# Je Zeile: welche Zielgruppen gelten hier? `nil` heißt „keine Weiche offen".
# Nebenbei fallen die Zeilen an, die selbst Weiche sind – die verschwinden immer.
def analyse_switches(relative, text, declared, page_view = nil)
  errors = []
  applies = []
  switch = []
  open = nil
  fence = nil

  text.split("\n", -1).each_with_index do |line, i|
    if fence
      fence = nil if line.match?(/\A[ \t]*#{Regexp.escape(fence)}[ \t]*\z/)
      applies << open
      switch << false
      next
    elsif (hits = line.match(FENCE))
      fence = hits[1]
      applies << open
      switch << false
      next
    end

    if (hits = line.match(AUDIENCE_OPEN))
      values = hits[1].to_s.split(/[,\s]+/).reject(&:empty?)
      if open
        errors << "#{relative}:#{i + 1}: verschachtelte `audience`-Weichen gibt es nicht."
      elsif values.empty?
        errors << "#{relative}:#{i + 1}: `audience` ohne Zielgruppe – erwartet `{% audience «name» %}`."
      else
        values.each do |w|
          next if declared.include?(w)

          errors << "#{relative}:#{i + 1}: `#{w}` ist keine deklarierte Zielgruppe (deklariert: #{declared.join(' ')})."
        end
        open = Set.new(values)
        # EINE WEICHE MUSS ENGER SEIN ALS DIE SEITE, sonst ist sie keine.
        # Beide Fälle sind Fehler und keine Warnung: Der eine tut nichts, der
        # andere versteckt Inhalt, den nie jemand zu sehen bekommt - und beides
        # sieht im Diff aus wie eine Absicht, die wirkt.
        if page_view
          intersection = open & page_view
          if intersection.empty?
            errors << "#{relative}:#{i + 1}: die Weiche (#{values.sort.join(', ')}) und die Seite " \
                      "(#{page_view.to_a.sort.join(', ')}) haben keine Zielgruppe gemeinsam – " \
                      'ihr Inhalt erschiene nie.'
          elsif intersection == page_view
            errors << "#{relative}:#{i + 1}: die Weiche (#{values.sort.join(', ')}) grenzt nichts ein – " \
                      "die Seite gilt ohnehin nur für #{page_view.to_a.sort.join(', ')}."
          end
        end
      end
      applies << nil
      switch << true
    elsif line.match?(AUDIENCE_CLOSE)
      errors << "#{relative}:#{i + 1}: `endaudience` ohne offene Weiche." if open.nil?
      open = nil
      applies << nil
      switch << true
    else
      if line.match?(AUDIENCE_ANYWHERE)
        errors << "#{relative}:#{i + 1}: eine `audience`-Weiche steht mitten in einer Zeile – " \
                  'sie gilt blockweise und gehört auf eine eigene.'
      end
      applies << open
      switch << false
    end
  end

  errors << "#{relative}: eine `audience`-Weiche wird nicht geschlossen (`endaudience` fehlt)." if open
  [applies, switch, errors]
end

# Die Weiche auflösen: Zeilen der Weiche selbst fallen immer weg, Zeilen einer
# fremden Zielgruppe ebenfalls.
def resolve_switches(text, group, applies, switch)
  lines = text.split("\n", -1)
  kept = lines.each_with_index.reject do |_, i|
    switch[i] || (applies[i] && !applies[i].include?(group))
  end
  kept.map(&:first).join("\n")
end

# --- Was gar nicht erst gelesen wird ----------------------------------------
#
# Dieselbe Liste wie in `liquid.rb`, um eine Stelle erweitert: `theme/`.
#
# WARUM `theme/` DAZUGEHÖRT. Dort liegt das ausgepackte npm-Paket – der Filter
# las dessen `CHANGELOG.md` als Seite des Projekts und meldete eine
# `audience`-Weiche, die dort in PROSA steht („eine `audience`-Weiche gehört auf
# eine eigene Zeile"). Der Build brach ab, und zwar an einer Datei, die kein
# Projekt reparieren kann: Sie kommt mit jedem Paket wieder. Dieselbe Begründung
# steht hinter `ignore: /theme/` und `exclude: theme` in den Prüf-Bausteinen.
#
# Ein Pfadstück mit `_` am Anfang fällt ebenfalls weg – Layouts und Includes des
# Themes sind keine Seiten des Projekts.
ALWAYS_EXCLUDED = %w[_site .git .jekyll-cache node_modules vendor .github theme].freeze

def excluded?(relative, pattern = [])
  parts = relative.split('/')
  return true if parts.any? { |part| ALWAYS_EXCLUDED.include?(part) || part.start_with?('_') }

  # Und was die Site selbst ausschliesst. Gelesen wie Jekyll es liest: ein Pfad
  # oder ein Muster, beides auch auf den blossen Dateinamen.
  pattern.any? do |m|
    m = m.to_s.chomp('/')
    relative == m || relative.start_with?("#{m}/") ||
      File.fnmatch?(m, relative, File::FNM_PATHNAME) ||
      File.fnmatch?(m, relative, File::FNM_PATHNAME | File::FNM_DOTMATCH) ||
      File.fnmatch?(m, File.basename(relative))
  end
end

def read_pages(source, pattern = [])
  Dir.glob(File.join(source, '**', '*'), File::FNM_DOTMATCH).select do |p|
    File.file?(p) && MARKDOWN.include?(File.extname(p).downcase) &&
      !excluded?(p.delete_prefix("#{source}/"), pattern)
  end.sort.map { |p| [p.delete_prefix("#{source}/"), front_matter(p)] }
end

def filter_pages(files, ziel_gruppe, declared)
  findings = []
  removed = []
  kept = []

  files.each do |relative, head|
    if head.is_a?(Hash) && head['__fehler']
      findings << "#{relative}: Front Matter ist kein gültiges YAML – #{head['__fehler']}"
      next
    end

    # `audience` (Einzelwert) ist mit Theme 2 entfallen. Tolerant zu sein wäre
    # hier das Gefährlichste: Der Filter fände den Schlüssel nicht, die Seite
    # gälte als zielgruppenlos, und Trainermaterial landete in der öffentlichen
    # Ausgabe. Das Schema ist mit `audiences` zufrieden, der Build liefe durch.
    if head.is_a?(Hash) && head.key?('audience')
      findings << "#{relative}: `audience:` ist entfallen – es heißt `audiences:` und ist eine Liste."
      next
    end

    values = head.is_a?(Hash) ? Array(head['audiences']).map(&:to_s) : []
    values.each do |w|
      next if declared.include?(w)

      findings << "#{relative}: `#{w}` ist keine deklarierte Zielgruppe (deklariert: #{declared.join(' ')})."
    end

    if values.empty? || values.include?(ziel_gruppe)
      kept << [relative, head]
    else
      removed << relative
    end
  end

  [kept, removed, findings]
end

# NACH DEM FILTERN, NICHT DAVOR. Wer überlebt hat, beansprucht seine Adresse
# allein – zwei Fassungen mit disjunkten Zielgruppen können hier gar nicht mehr
# beide stehen. Was übrig bleibt, sind echte Doppelbelegungen: überschneidende
# Zielgruppen oder schlicht zwei Seiten auf derselben Adresse. Damit braucht es
# keine eigene Disjunktheitsprüfung – sie fällt aus der Reihenfolge heraus.
def duplicate_addresses(kept)
  by_address = Hash.new { |h, k| h[k] = [] }
  kept.each do |relative, head|
    slug = address(head, relative)
    by_address[slug] << relative unless slug.nil?
  end
  by_address.select { |_, v| v.size > 1 }
end

# `page_id` IST EINE IDENTITÄT, und zwei Seiten mit derselben sind eine
# Mehrdeutigkeit: Ein `page:`-Verweis und der Sprachumschalter fänden zwei Ziele.
# Geprüft wird JE SPRACHE – zwei Sprachfassungen derselben Seite teilen ihre
# `page_id` absichtlich, genau darüber findet der Umschalter sein Gegenstück.
def duplicate_ids(kept)
  by_id = Hash.new { |h, k| h[k] = [] }
  kept.each do |relative, head|
    next unless head.is_a?(Hash) && head['page_id'].is_a?(String)

    by_id[[head['page_id'], language(head, File.basename(relative, '.*'))]] << relative
  end
  by_id.select { |_, v| v.size > 1 }
end

# EIN VERWEIS DARF NICHT ENGER ZIELEN, ALS ER STEHT.
#
# Die Regel in einem Satz: **Das Ziel muss überall sichtbar sein, wo die
# verweisende Seite sichtbar ist.** Formal, mit „keine Angabe“ als der vollen
# Menge:
#
#     audiences(Quelle)  ⊆  audiences(Ziel)
#
# Sonst steht der Verweis in einem Build, in dem sein Ziel fehlt – und zeigt
# dort ins Leere. Der häufigste Fall ist die Seite ohne Angabe, die auf
# Trainermaterial verweist; aber es trifft jede Verengung, auch von
# `[trainer, learner]` auf `[trainer]`.
#
# GEPRÜFT WIRD STRUKTURELL, NICHT AM GEBAUTEN AUSSCHNITT. Ein Lauf sieht nur
# EINE Zielgruppe; eine Verengung, die erst in einer anderen weh tut, fiele dort
# nicht auf. Wer nur eine Sicht baut – ATLAS etwa baut nur die der Lernenden –,
# bekäme die übrigen Verstöße nie zu sehen. Deshalb vergleicht diese Prüfung die
# MENGEN und läuft über alle Dateien, unabhängig davon, was gerade gebaut wird.
#
# Die Verweisprüfung am gebauten HTML findet den Einzelfall auch – sie sagt dann
# aber „Ziel fehlt“, und das schickt die Suche in die falsche Richtung: In der
# Quelle ist nichts kaputt, die Zuordnung ist es.
#
# GELESEN WIRD DIE FORM, DIE DAS THEME VORSCHREIBT: ein relativer Pfad auf die
# `.md`-Datei. `jekyll-relative-links` löst ihn gegen die URL des Ziels auf –
# wer stattdessen die fertige Adresse hinschreibt, ist hier nicht zu sehen, und
# das ist die Grenze dieser Prüfung. Sie meldet zu wenig, nie zu viel.
LINK = /\]\(\s*(?!https?:|mailto:|#|\/)([^)\s#]+\.(?:md|markdown|mkdown|mkdn|mkd))/i.freeze

def visible_for(head, declared)
  values = head.is_a?(Hash) ? Array(head['audiences']).map(&:to_s) : []
  # Keine Angabe heißt „überall“ – und genau deshalb ist eine Seite ohne Angabe
  # die strengste Quelle, die es gibt: Ihr Ziel muss allen gehören.
  values.empty? ? Set.new(declared) : Set.new(values)
end

def links_too_narrow(source, files, declared)
  visibility = {}
  files.each { |relative, head| visibility[relative] = visible_for(head, declared) }

  hits = []
  files.each do |relative, _|
    path = File.join(source, relative)
    next unless File.file?(path)

    text = File.read(path, encoding: 'UTF-8', invalid: :replace, undef: :replace)
    applies, = analyse_switches(relative, text, declared, visibility[relative])

    text.split("\n", -1).each_with_index do |line, i|
      # EINE WEICHE VERENGT DIE QUELLE. Ein Verweis in `{% audience trainer %}`
      # steht nur dort, wo beides gilt – die Seite UND die Weiche. Genau dafür
      # ist sie da: Eine geteilte Seite darf auf Trainermaterial verweisen,
      # solange der Verweis selbst der Weiche gehört.
      source_view = applies[i] ? (visibility[relative] & applies[i]) : visibility[relative]

      line.scan(LINK).flatten.uniq.each do |target|
        resolved = File.expand_path(target, File.dirname(File.join('/', relative))).delete_prefix('/')
        # Ein Ziel, das es gar nicht gibt, ist nicht unsere Frage – das meldet die
        # Verweisprüfung am gebauten Ergebnis, und sie meldet es besser.
        next unless visibility.key?(resolved)

        missing = source_view - visibility[resolved]
        hits << [relative, target, missing.to_a.sort] unless missing.empty?
      end
    end
  end
  hits.uniq
end

def config_data(path)
  return {} unless File.file?(path)

  YAML.safe_load(File.read(path), permitted_classes: [Date, Time], aliases: true) || {}
rescue StandardError => e
  warn "FEHLER: #{path} ist kein gültiges YAML – #{e.message}"
  exit 4
end

# --- Selbsttest --------------------------------------------------------------
#
# Die Ausnahmen sind der Wert dieser Prüfung: Ein Filter, der eine Seite zu viel
# entfernt, fällt erst auf, wenn jemand die fehlende Seite sucht.
SELF_TEST_CASES = {
  'index.md' => "---\naudiences: [learner]\n---\nLernende\n",
  'index-trainer.md' => "---\naudiences: [trainer]\npermalink: /\n---\nTrainer\n",
  'gemeinsam.md' => "---\ntitle: X\n---\nFür alle\n",
  'beide.md' => "---\naudiences: [trainer, learner]\n---\nAusdrücklich beide\n",
  'nur-trainer.md' => "---\naudiences: [trainer]\n---\nSales-Material\n",
  'ohne-fm.md' => "Kein Front Matter\n",
  'de.md' => "---\nslug: gleich\n---\nDeutsch\n",
  'de_en.md' => "---\nslug: gleich\n---\nEnglisch, andere Sprache\n",
  # Verweist aus einer Seite, die JEDER Build bekommt, auf eine, die nur eine
  # Gruppe bekommt: im anderen Build ein toter Verweis.
  'verweist.md' => "---\ntitle: X\n---\nSiehe [Sales](nur-trainer.md) und [Alle](gemeinsam.md).\n",
  # VERENGUNG OHNE „ueberall“: Die Quelle gehoert beiden, das Ziel nur einer.
  # Den Fall saehe ein Lauf fuer `trainer` nie - dort sind beide da.
  'beide-verweist.md' => "---\naudiences: [trainer, learner]\n---\n[Sales](nur-trainer.md)\n",
  # Und die Gegenrichtung, die ERLAUBT ist: enger verweist auf weiter.
  'eng-auf-weit.md' => "---\naudiences: [trainer]\n---\n[Alle](gemeinsam.md)\n"
}.freeze

# Die Weiche hat eigene Fixtures: Ihr Wert steckt in den Ausnahmen, und ein
# Fehler darin ist teuer - eine nicht aufgeloeste Weiche zeigt fremdes Material.
SWITCH_TEST = {
  'gut.md' => "---\ntitle: X\n---\nAllen.\n\n{% audience trainer %}\nNur Trainer.\n{% endaudience %}\n\nWieder allen.\n",
  'code.md' => "---\ntitle: X\n---\n```\n{% audience trainer %}\n{% endaudience %}\n```\n",
  'mittendrin.md' => "---\ntitle: X\n---\nText {% audience trainer %} mehr Text\n",
  'offen.md' => "---\ntitle: X\n---\n{% audience trainer %}\nohne Ende\n",
  'verschachtelt.md' => "---\ntitle: X\n---\n{% audience trainer %}\n{% audience learner %}\n{% endaudience %}\n{% endaudience %}\n",
  'leer.md' => "---\ntitle: X\n---\n{% audience %}\n{% endaudience %}\n",
  'unbekannt.md' => "---\ntitle: X\n---\n{% audience lernende %}\nx\n{% endaudience %}\n",
  # MEHRERE ZIELGRUPPEN, kommagetrennt wie durch Leerzeichen. Mit zwei Gruppen ist
  # das noch ein Sonderfall - ab der dritten ist es der Normalfall.
  'mehrere.md' => "---\ntitle: X\n---\n{% audience trainer, learner %}\nBeide.\n{% endaudience %}\n" \
                  "{% audience trainer learner %}\nAuch beide.\n{% endaudience %}\n",
  # GRENZT NICHTS EIN: Die Seite gehoert ohnehin nur den Trainer:innen.
  'unnoetig.md' => "---\naudiences: [trainer]\n---\n{% audience trainer %}\nx\n{% endaudience %}\n",
  # ERSCHIENE NIE: Seite und Weiche haben keine Zielgruppe gemeinsam.
  'nie.md' => "---\naudiences: [trainer]\n---\n{% audience learner %}\nx\n{% endaudience %}\n"
}.freeze

def switch_self_test
  require 'tmpdir'
  errors = []
  declared = %w[trainer learner]
  Dir.mktmpdir do |dir|
    SWITCH_TEST.each { |name, content| File.write(File.join(dir, name), content) }

    # DIE WEICHE MUSS ENGER SEIN ALS DIE SEITE - geprueft gegen deren Front Matter.
    { 'unnoetig.md' => 'grenzt nichts ein',
      'nie.md' => 'erschiene nie' }.each do |name, expected|
      text = File.read(File.join(dir, name))
      view = visible_for(front_matter(File.join(dir, name)), declared)
      _, _, f = analyse_switches(name, text, declared, view)
      errors << "#{name}: kein Befund, erwartet war \"#{expected}\"" if f.none? { |m| m.include?(expected) }
    end
    # Und die Gegenprobe: dieselbe Weiche auf einer geteilten Seite ist richtig.
    text = File.read(File.join(dir, 'gut.md'))
    _, _, f = analyse_switches('gut.md', text, declared, Set.new(declared))
    errors << "gut.md: faelschlich als nicht eingrenzend gemeldet #{f.inspect}" unless f.empty?

    { 'mittendrin.md' => 'mitten in einer Zeile',
      'offen.md' => 'nicht geschlossen',
      'verschachtelt.md' => 'verschachtelte',
      'leer.md' => 'ohne Zielgruppe',
      'unbekannt.md' => 'keine deklarierte Zielgruppe' }.each do |name, expected|
      text = File.read(File.join(dir, name))
      _, _, f = analyse_switches(name, text, declared)
      errors << "#{name}: kein Befund, erwartet war \"#{expected}\"" if f.none? { |m| m.include?(expected) }
    end

    %w[gut.md code.md].each do |name|
      text = File.read(File.join(dir, name))
      _, _, f = analyse_switches(name, text, declared)
      errors << "#{name}: unerwarteter Befund #{f.inspect}" unless f.empty?
    end

    text = File.read(File.join(dir, 'gut.md'))
    applies, switch, = analyse_switches('gut.md', text, declared)
    for_trainer = resolve_switches(text, 'trainer', applies, switch)
    for_learner = resolve_switches(text, 'learner', applies, switch)
    errors << 'trainer verliert den Inhalt der Weiche' unless for_trainer.include?('Nur Trainer.')
    errors << 'trainer behaelt die Weichen-Zeilen' if for_trainer.include?('audience')
    errors << 'learner bekommt fremden Inhalt' if for_learner.include?('Nur Trainer.')
    %w[Allen. Wieder].each do |word|
      errors << "#{word} fehlt nach dem Aufloesen" unless for_trainer.include?(word) && for_learner.include?(word)
    end

    # MEHRERE ZIELGRUPPEN: Der Block gilt fuer jede genannte, und beide
    # Trennzeichen fuehren zum selben Ergebnis.
    text = File.read(File.join(dir, 'mehrere.md'))
    applies, switch, f = analyse_switches('mehrere.md', text, declared)
    errors << "mehrere.md: unerwarteter Befund #{f.inspect}" unless f.empty?
    %w[trainer learner].each do |who|
      result = resolve_switches(text, who, applies, switch)
      %w[Beide. Auch].each do |word|
        errors << "mehrere.md: #{word} fehlt fuer #{who}" unless result.include?(word)
      end
    end

    # IM CODEBLOCK BLEIBT SIE STEHEN - sonst koennte die Doku sich nicht selbst
    # zeigen, und ein Beispiel wuerde beim Filtern zerlegt.
    text = File.read(File.join(dir, 'code.md'))
    applies, switch, = analyse_switches('code.md', text, declared)
    unchanged = resolve_switches(text, 'learner', applies, switch)
    errors << 'die Weiche im Codeblock wurde angefasst' unless unchanged == text
  end
  errors
end

def self_test
  require 'tmpdir'
  errors = []
  Dir.mktmpdir do |dir|
    SELF_TEST_CASES.each { |name, content| File.write(File.join(dir, name), content) }
    files = read_pages(dir)
    declared = %w[trainer learner]

    kept, removed, findings = filter_pages(files, 'learner', declared)
    errors << "learner meldet Befunde: #{findings.inspect}" unless findings.empty?
    expected = %w[beide-verweist.md beide.md de.md de_en.md gemeinsam.md index.md ohne-fm.md verweist.md]
    errors << "learner behält #{kept.map(&:first).sort.inspect}, erwartet #{expected.inspect}" \
      if kept.map(&:first).sort != expected
    errors << "learner entfernt #{removed.sort.inspect}" if removed.sort != %w[eng-auf-weit.md index-trainer.md nur-trainer.md]

    # Der Kern: Beide Fassungen beanspruchen `/`, und nach dem Filtern ist es
    # nur noch eine. Ohne den Filter wäre es eine Doppelbelegung.
    errors << "learner hat Doppelbelegungen: #{duplicate_addresses(kept).inspect}" \
      unless duplicate_addresses(kept).empty?

    behalten_t, entfernt_t, = filter_pages(files, 'trainer', declared)
    expected_trainer = %w[beide-verweist.md beide.md de.md de_en.md eng-auf-weit.md gemeinsam.md index-trainer.md nur-trainer.md ohne-fm.md verweist.md]
    errors << "trainer behält #{behalten_t.map(&:first).sort.inspect}, erwartet #{expected_trainer.inspect}" \
      if behalten_t.map(&:first).sort != expected_trainer
    errors << 'trainer bekommt die Lernenden-Startseite' unless entfernt_t == ['index.md']
    errors << "trainer hat Doppelbelegungen: #{duplicate_addresses(behalten_t).inspect}" \
      unless duplicate_addresses(behalten_t).empty?

    # Und die Gegenprobe: Überschneiden sich die Zielgruppen, bleibt die
    # Doppelbelegung stehen und MUSS gemeldet werden.
    File.write(File.join(dir, 'index-trainer.md'), "---\naudiences: [trainer, learner]\npermalink: /\n---\nBeide\n")
    ueberschneidung, = filter_pages(read_pages(dir), 'learner', declared)
    errors << 'eine überschneidende Doppelbelegung wurde nicht gemeldet' if duplicate_addresses(ueberschneidung).empty?

    # DIE VERENGUNG IST STRUKTURELL, nicht buildabhaengig: Dasselbe Ergebnis,
    # egal welche Zielgruppe gerade gebaut wird.
    narrow = links_too_narrow(dir, files, declared)
    reported_links = narrow.map { |from, target, missing| [from, target, missing] }.sort
    expected_links = [['beide-verweist.md', 'nur-trainer.md', ['learner']],
                  ['verweist.md', 'nur-trainer.md', ['learner']]]
    errors << "Verengung gemeldet: #{reported_links.inspect}, erwartet #{expected_links.inspect}" \
      if reported_links != expected_links
    # Und unabhaengig von der gebauten Gruppe - sonst saehe ein Lauf nur seinen
    # eigenen Ausschnitt, und wer nur eine Sicht baut, bekaeme die uebrigen nie.
    errors << 'Ergebnis haengt an der gebauten Zielgruppe' \
      if links_too_narrow(dir, files, declared) != narrow

    # Eine unbekannte Zielgruppe ist ein Befund, kein stilles Entfernen.
    File.write(File.join(dir, 'tippfehler.md'), "---\naudiences: [lernende]\n---\nX\n")
    _, _, findings_second = filter_pages(read_pages(dir), 'learner', declared)
    errors << 'ein Tippfehler in audiences wurde nicht gemeldet' if findings_second.empty?
  end
  errors + switch_self_test
end

# --- Aufruf ------------------------------------------------------------------

source = '.'
target = nil
group = nil
config = nil
self_test_only = false
quiet = false

argv = ARGV.dup
until argv.empty?
  case (arg = argv.shift)
  when '--audience' then group = argv.shift
  when '--source' then source = argv.shift
  when '--into' then target = argv.shift
  when '--config' then config = argv.shift
  when '--quiet' then quiet = true
  when '--self-test' then self_test_only = true
  when '--help', '-h'
    puts File.read(__FILE__).lines[2..6].map { |z| z.sub(/\A# ?/, '') }.join
    exit 0
  else
    warn "Unbekannte Option: #{arg}"
    exit 4
  end
end

if self_test_only
  errors = self_test
  if errors.empty?
    puts "Selbsttest des Zielgruppenfilters bestanden (#{SELF_TEST_CASES.size} Dateien, " \
         "#{SWITCH_TEST.size} Weichen-Fälle)."
    exit 0
  end
  warn "FEHLER: Der Zielgruppenfilter arbeitet nicht wie beschrieben:\n\n"
  errors.each { |f| warn "  #{f}" }
  exit 5
end

source = source.to_s.chomp('/')
unless File.directory?(source)
  warn "FEHLER: #{source}/ gibt es nicht."
  exit 4
end

data = config_data(config || File.join(source, '_config.yml'))
declared = Array(data['audiences']).map(&:to_s)

# OHNE DEKLARATION GIBT ES NICHTS ZU FILTERN, und das ist kein Fehler: Eine Site
# ohne Zielgruppen ist der Normalfall. Mit Deklaration ist eine fehlende Angabe
# dagegen ein Fehler – die Site sagt, dass sie Zielgruppen führt, und ungefiltert
# zu bauen hieße, alles zu veröffentlichen.
if declared.empty?
  if group.nil?
    puts 'Keine Zielgruppen deklariert – nichts zu filtern.' unless quiet
    exit 0
  end
  warn "FEHLER: Zielgruppe '#{group}' verlangt, aber die _config.yml deklariert keine."
  warn '  Erwartet auf oberster Ebene:  audiences: [«a», «b»]'
  warn '  Die Site legt die Werte fest, nicht das Theme.'
  exit 4
end

if group.nil?
  warn "FEHLER: Diese Site deklariert Zielgruppen (#{declared.join(' ')}), aber es ist keine genannt."
  warn '  Eine Vorgabe gibt es bewusst nicht: Sie wäre eine Annahme darüber, wer was'
  warn '  sehen darf, und die falsche Annahme veröffentlicht Material, das intern bleiben soll.'
  warn '  Aufruf:  --audience «eine aus der Liste»'
  exit 4
end

unless declared.include?(group)
  warn "FEHLER: Zielgruppe '#{group}' ist in der _config.yml nicht deklariert (dort: #{declared.join(' ')})."
  exit 4
end

FileUtils.cp_r(File.join(source, '.'), target) if target
work_tree = target || source

# WAS DIE SITE SELBST NICHT AUSLIEFERT, WIRD AUCH NICHT BEURTEILT. `AGENTS.md`,
# `CLAUDE.md`, `README.md` und `ABWEICHUNGEN.md` stehen im `exclude` der
# `_config.yml` – sie werden nie eine Seite. Der Filter las sie trotzdem und
# meldete ihre Verweise gegen die Zielgruppenregel: Befunde, die per Konstruktion
# falsch sind, denn eine Datei, die es im Bundle nicht gibt, kann nirgends ins
# Leere zeigen. In den fünf Schulungsrepos waren das 13 von 19 Meldungen.
#
# Gelesen wird `exclude` wie in `liquid.rb` und wie Jekyll es liest: Setzt ein
# Projekt den Schlüssel, ERSETZT das die Liste des Themes vollständig.
pattern = Array(data['exclude'])
files = read_pages(work_tree, pattern)
kept, removed, findings = filter_pages(files, group, declared)

# DIE WEICHEN WERDEN GEPRÜFT, BEVOR IRGENDETWAS GESCHRIEBEN WIRD. Ein halb
# aufgelöster Baum wäre das schlechteste Ergebnis: Ein Teil der Weichen weg, der
# Rest drin, und beim nächsten Lauf sieht niemand mehr, was gemeint war.
switches = {}
files.each do |relative, _|
  path = File.join(work_tree, relative)
  next unless File.file?(path)

  text = File.read(path, encoding: 'UTF-8', invalid: :replace, undef: :replace)
  head = files.to_h[relative]
  applies, switch, errors = analyse_switches(relative, text, declared, visible_for(head, declared))
  findings.concat(errors)
  switches[relative] = [text, applies, switch] if switch.any?
end

unless findings.empty?
  warn 'FEHLER: Zielgruppen-Angaben sind nicht in Ordnung:'
  findings.each { |b| warn "  #{b}" }
  exit 5
end

duplicate = duplicate_addresses(kept)
unless duplicate.empty?
  warn 'FEHLER: Nach dem Filtern liegen zwei Seiten auf derselben Adresse:'
  duplicate.each { |_, entries| warn "  #{entries.join(', ')}" }
  warn '  Zwei Fassungen unter einer Adresse sind erlaubt, solange ihre `audiences`'
  warn '  sich nicht überschneiden. Hier tun sie es – welche gemeint ist, kann niemand wissen.'
  exit 5
end

ids = duplicate_ids(kept)
unless ids.empty?
  warn 'FEHLER: Nach dem Filtern tragen zwei Seiten derselben Sprache dieselbe `page_id`:'
  ids.each { |(id, lang), entries| warn "  #{id}#{lang.empty? ? '' : " (#{lang})"}: #{entries.join(', ')}" }
  warn '  Ein `page:`-Verweis und der Sprachumschalter fänden damit zwei Ziele.'
  exit 5
end

# GEMELDET WIRD VOR DEM LÖSCHEN – danach lässt sich nicht mehr feststellen, was
# auf was zeigte. Geprüft wird über ALLE Dateien, nicht über die behaltenen: Die
# Frage ist strukturell und hängt nicht daran, was dieser Lauf gerade baut.
too_narrow = links_too_narrow(work_tree, files, declared)

removed.each { |relative| File.delete(File.join(work_tree, relative)) }

kept.each do |relative, _|
  next unless switches.key?(relative)

  text, applies, switch = switches[relative]
  File.write(File.join(work_tree, relative), resolve_switches(text, group, applies, switch))
end

unless quiet
  puts "Zielgruppe #{group}: #{removed.size} Seite(n) entfernt, #{kept.size} behalten."
  removed.each { |relative| puts "  - #{relative}" }
  resolved = kept.count { |relative, _| switches.key?(relative) }
  puts "  #{resolved} Seite(n) mit Weichen aufgelöst." if resolved.positive?
end

unless too_narrow.empty?
  warn ''
  warn "FEHLER: #{too_narrow.size} Verweis(e) zielen enger, als sie stehen:"
  too_narrow.each { |from, target, missing| warn "  #{from} -> #{target}  (fehlt für: #{missing.join(', ')})" }
  warn ''
  warn '  Ein Ziel muss überall sichtbar sein, wo die verweisende Seite sichtbar ist.'
  warn '  Entweder bekommt das Ziel die `audiences` der Quelle mit, oder die Quelle wird'
  warn '  auf die des Ziels eingeschränkt. Keine Angabe heißt „überall“ – eine Seite ohne'
  warn '  `audiences` ist damit die strengste Quelle, die es gibt.'
  exit 5
end
