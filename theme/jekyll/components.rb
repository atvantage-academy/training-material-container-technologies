#!/usr/bin/env ruby
# frozen_string_literal: true

# =============================================================================
# components.rb – werden die Bausteine des Themes richtig verwendet?
# -----------------------------------------------------------------------------
#   ruby theme/jekyll/components.rb                  # Befunde ausgeben
#   ruby theme/jekyll/components.rb --check          # scheitern, wenn es einen gibt
#   ruby theme/jekyll/components.rb --self-test
#
# WOGEGEN DAS PRÜFT. Nicht gegen den Markup Contract – der sagt, welche Namen es
# gibt. Hier geht es um die Frage danach: Ist ein Baustein so BENUTZT, dass er
# tut, was er soll? Ein falsch verwendeter Baustein ist gültiges HTML, sieht im
# Diff richtig aus und ist im Browser kaputt. Genau diese Lücke.
#
# HEUTE EINE REGEL, die Info-Schaltfläche. Weitere kommen dazu, wenn ein Fall
# gemeldet wird – erfunden wird hier keiner: Eine Regel ohne einen echten Defekt
# dahinter kostet nur Lauf und Vertrauen.
#
# WOFÜR: `avd-academy-reveal--info` ist die ICON-Fassung des aufdeckbaren
# Inhalts – ein runder Knopf von 1,4 rem. Ihr Titel gehört als visuell
# verborgener Text ins `summary`; sichtbar ist nur das Info-Zeichen.
#
# Zwei Befunde macht diese Prüfung:
#
#   SICHTBARER TITEL – wer den Titel sichtbar hineinschreibt, presst ihn in
#   1,4 rem Breite. Der Knopf bricht über drei Zeilen um, und niemand sieht mehr,
#   wo er anfängt.
#
#   KEIN `summary` – dann hat kramdown es zu Text gemacht. `summary` und `p` sind
#   BLOCK-Elemente; steht das `details` in einer SPAN-Umgebung (mitten in einem
#   Absatz, in der Zelle einer Markdown-Tabelle), maskiert kramdown sie zu
#   `&lt;summary&gt;`. Der Knopf zeigt dann seinen eigenen Quelltext und lässt sich
#   nicht mehr öffnen. Ein `span` überlebt dieselbe Stelle – deshalb sieht die
#   Quelle richtig aus und das Ergebnis ist kaputt.
#
# BEIDES WURDE GEMELDET, und der zweite Befund stand danach immer noch an 16
# Stellen: in der Regeltabelle der Zielgruppen-Seite und im Playground, je Sprache
# – also ausgerechnet dort, wo man sich die richtige Form abschaut.
#
# DIE KOMPONENTEN-DOKU SAGT ES BEREITS („Der Titel muss dastehen, auch wenn man
# ihn nicht sieht“). Eine Regel, die nur in der Prosa steht, wird beim Schreiben
# nicht gelesen – deshalb diese Prüfung.
#
# GEPRÜFT WIRD GEGEN DAS GEBAUTE HTML. In der Quelle steht die Auszeichnung mal
# als Markdown-Block, mal als rohes HTML in einer Tabellenzelle; gebaut ist sie
# überall dasselbe. Und ein Codebeispiel, das die Schreibweise ZEIGT, steht dort
# maskiert (`&lt;details`) – es ist kein Tag und fällt von selbst heraus.
#
# RÜCKGABEWERTE: 0 in Ordnung, 1 Befunde, 2 die Prüfung konnte nicht laufen.
# =============================================================================
#
# REGEL 1 – DIE INFO-SCHALTFLÄCHE (`avd-academy-reveal--info`)
# -----------------------------------------------------------------------------

INFO_BUTTON = /<details\b[^>]*\bclass="[^"]*\bavd-academy-reveal--info\b[^"]*"[^>]*>/i.freeze
SUMMARY_TAG = %r{<summary\b[^>]*>(.*?)</summary>}im.freeze
# Ein Element, das seinen Inhalt verbirgt – samt Inhalt. Nicht-gierig, damit
# zwei davon nebeneinander nicht zu einem verschmelzen.
HIDDEN_ELEMENT = %r{<(\w+)\b[^>]*\bclass="[^"]*\bavd-academy-visually-hidden\b[^"]*"[^>]*>.*?</\1>}im.freeze

# Was von einem `summary` sichtbar übrig bleibt: ohne verborgene Elemente, ohne
# Tags, ohne Entities, ohne Leerraum.
def visible_text(inner)
  rest = inner.gsub(HIDDEN_ELEMENT, "")
  rest = rest.gsub(/<[^>]*>/, "")
  rest = rest.gsub(/&[a-z]+;|&#\d+;/i, "")
  rest.gsub(/\s+/, "")
end

# Gesucht wird NUR im Element selbst, bis zu seinem `</details>` – sonst fände die
# Prüfung beim fehlenden `summary` das nächstbeste der Seite und meldete fremdes
# Markup. Aufdeckbare Inhalte schachteln sich nicht, das erste Ende ist das eigene.
CLOSING_TAG = %r{</details>}i.freeze

def findings_in(text)
  hits = []
  pos = 0
  while (start = text.index(INFO_BUTTON, pos))
    body_start = Regexp.last_match.end(0)
    pos = body_start
    body_end = text.index(CLOSING_TAG, body_start) || text.length
    body = text[body_start...body_end]

    m = body.match(SUMMARY_TAG)
    if m.nil?
      hits << [:no_summary, text[start, 120].gsub(/\s+/, " ").strip]
    elsif !visible_text(m[1]).empty?
      hits << [:visible_title, m[0].gsub(/\s+/, " ").strip]
    end
  end
  hits
end

SELF_TEST_CASES = [
  ['<details class="avd-academy-reveal avd-academy-reveal--info">' \
   '<summary><span class="avd-academy-visually-hidden">Titel</span></summary><p>x</p></details>', 0],
  ['<details class="avd-academy-reveal avd-academy-reveal--info">' \
   '<summary>Warum?</summary><p>x</p></details>', 1],
  # Die gewöhnliche Fassung DARF einen sichtbaren Titel tragen – sie ist dafür da.
  ['<details class="avd-academy-reveal"><summary>Musterlösung</summary><p>x</p></details>', 0],
  # Ein Codebeispiel zeigt die Schreibweise, statt sie zu verwenden.
  ['<code>&lt;details class="avd-academy-reveal--info"&gt;&lt;summary&gt;Titel&lt;/summary&gt;</code>', 0],
  # Nur Leerraum und ein Entity sind kein sichtbarer Titel.
  ['<details class="avd-academy-reveal--info"><summary>  &nbsp; ' \
   '<span class="avd-academy-visually-hidden">Titel</span> </summary></details>', 0],
  # kramdown hat das `summary` maskiert: der Knopf zeigt seinen Quelltext.
  ['<p>Text <details class="avd-academy-reveal--info">&lt;summary&gt;' \
   '<span class="avd-academy-visually-hidden">Titel</span>&lt;/summary&gt;&lt;p&gt;x&lt;/p&gt;' \
   '</details> weiter.</p>', 1],
  # Und dann NICHT das `summary` der nächsten Komponente melden.
  ['<details class="avd-academy-reveal--info">&lt;summary&gt;x&lt;/summary&gt;</details>' \
   '<details class="avd-academy-reveal"><summary>Auf dieser Seite</summary></details>', 1]
].freeze

def self_test
  # `filter_map` gibt es erst ab Ruby 2.7 - die System-Ruby eines Rechners ist
  # oft aelter, und dieses Skript soll auch dort laufen.
  errors = []
  SELF_TEST_CASES.each_with_index do |(html, expected), i|
    actual = findings_in(html).size
    errors << "Fall #{i + 1}: #{actual} Befund(e), expected #{expected}" if actual != expected
  end

  # DIE AUSSCHLUSSMUSTER, drei Schreibweisen und eine Gegenprobe. Sie müssen
  # dasselbe bedeuten, sonst ist die Zusage „`theme` ≡ `/theme` ≡ `/theme/**`"
  # nur behauptet - und sie steht wortgleich in links.rb und contrast.rb.
  %w[theme /theme theme/ /theme/ /theme/**].each do |schreibweise|
    muster = normalize_patterns([schreibweise])
    unless ignored?("theme/CHANGELOG.html", muster)
      errors << "Schreibweise `#{schreibweise}` nimmt theme/ nicht aus."
    end
    # Eine Adresse, die GENAU so heisst, gehoert ebenfalls dazu.
    errors << "`#{schreibweise}` trifft `/theme` selbst nicht." unless ignored?("theme", muster)
    # Aber `/themes-overview/` nicht - ein roher Praefixvergleich taete es.
    if ignored?("themes-overview/index.html", muster)
      errors << "`#{schreibweise}` trifft fälschlich `/themes-overview/`."
    end
  end
  errors << "Ein leeres Muster wurde nicht verworfen." unless normalize_patterns(["", "  ", "/"]).empty?

  # DER EINSCHLUSS und sein Verhältnis zum Ausschluss. Vier Aussagen, die
  # zusammen die ganze Regel ergeben - steht wortgleich in links.rb.
  muster = normalize_patterns(["/theme"])
  errors << "`--include` nimmt die benannte Seite aus." if Scope.new(muster, []).skips?("theme/CHANGELOG.html")
  errors << "`--include` lässt eine nicht benannte Seite durch." unless Scope.new(muster, []).skips?("index.html")
  errors << "Ohne Angabe fällt eine Seite heraus." if Scope.new([], []).skips?("index.html")
  unless Scope.new(muster, muster).skips?("theme/CHANGELOG.html")
    errors << "Ein Ausschluss schlägt den Einschluss nicht."
  end

  errors
end

# --- Aufruf ------------------------------------------------------------------

# Befunde nach stdout, die Erklaerung nach stderr - ohne das hier stuende die
# Erklärung im Log VOR den Befunden, zu denen sie gehört.
$stdout.sync = true
$stderr.sync = true

mode = ARGV.include?("--check") ? :check : :bericht
site = ARGV.include?("--site") ? ARGV[ARGV.index("--site") + 1] : "_site"

# --- Was nicht dem Projekt gehört -------------------------------------------
#
# `--ignore «Präfix»` nimmt Seiten aus, so wie es links.rb und contrast.rb tun –
# und aus demselben Grund: Ein gebautes Bundle enthält unter `/theme/` die
# Seiten des Themes selbst. Ein Befund darin ist einer, den kein Projekt beheben
# kann; er kommt mit jedem Paket wieder. NICHTS, WAS AUS DEM THEME KOMMT, WIRD
# BEIM VERBRAUCHER GEPRÜFT.
#
# --- Eine Schreibweise für Ausschlussmuster ----------------------------------
#
# DERSELBE BLOCK STEHT IN `links.rb` UND `contrast.rb`. Drei Werkzeuge, die
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

def ignored?(relative, ignore)
  path = "/#{relative}"
  ignore.any? { |p| path == p || path.start_with?("#{p}/") }
end

# WAS DIE PRÜFUNG ANSIEHT - zwei Listen, eine Regel. `only` leer: alles ist
# erfasst. `only` gesetzt: erfasst ist nur, was darauf passt. `ignore` nimmt in
# beiden Fällen danach noch heraus - ein Ausschluss schlägt einen Einschluss,
# sonst entschiede die Reihenfolge der Angaben, welche von beiden gilt.
# Wortgleich in links.rb und contrast.rb.
Scope = Struct.new(:only, :ignore) do
  def skips?(relative)
    return true unless only.empty? || ignored?(relative, only)

    ignored?(relative, ignore)
  end
end

ignore = []
only = []
ARGV.each_with_index { |a, i| ignore << ARGV[i + 1] if a == "--ignore" }
ARGV.each_with_index { |a, i| only << ARGV[i + 1] if a == "--include" }
scope = Scope.new(normalize_patterns(only), normalize_patterns(ignore))


if ARGV.include?("--self-test")
  errors = self_test
  if errors.empty?
    puts "Selbsttest der Baustein-Prüfung bestanden (#{SELF_TEST_CASES.size} Fälle)."
    exit 0
  end
  warn "FEHLER: Die Prüfung arbeitet nicht wie beschrieben:\n\n"
  errors.each { |f| warn "  #{f}" }
  exit 1
end

unless File.directory?(site)
  if ARGV.include?("--require-site")
    warn "FEHLER: Keine gebaute Site unter #{site}/ – ohne sie ist die Auszeichnung nicht prüfbar."
    warn "        Erst bauen: `make build`."
    exit 2
  end
  puts "Hinweis: Info-Schaltflächen NICHT geprüft – keine gebaute Site unter #{site}/."
  exit 0
end

findings = []
checked = 0
Dir.glob(File.join(site, "**", "*.html")).sort.each do |path|
  relative = path.delete_prefix("#{site}/")
  next if scope.skips?(relative)

  checked += 1
  text = File.read(path, encoding: "UTF-8", invalid: :replace, undef: :replace)
  findings_in(text).each { |kind, markup| findings << [relative, kind, markup] }
end

# Eine Prüfung über die leere Menge ist kein Erfolg – dieselbe Regel wie bei
# links.rb. Ein zu weites `--ignore` sähe sonst aus wie ein sauberes Bundle –
# und ein `--include`, das auf nichts passt, ebenso. Beide werden genannt: Aus
# der Zahl 0 allein ist nicht zu sehen, welche der beiden Angaben sie verursacht.
if checked.zero?
  warn "FEHLER: Unter #{site}/ blieb keine einzige Seite zu prüfen übrig."
  warn "        --include: #{scope.only.inspect}"
  warn "        --ignore:  #{scope.ignore.inspect}"
  exit 2
end

if findings.empty?
  puts "Bausteine in Ordnung."
  exit 0
end

LABELS = {
  visible_title: "sichtbarer Titel im Knopf",
  no_summary: "kein `summary` – von kramdown maskiert"
}.freeze

findings.group_by(&:first).sort.each do |file, entries|
  puts "  #{file}"
  entries.each { |(_, kind, markup)| puts "    [#{LABELS[kind]}] #{markup}" }
end
puts ""
puts "#{findings.size} Info-Schaltfläche(n) mit Befund."

exit 0 unless mode == :check

kinds = findings.map { |(_, kind, _)| kind }.uniq

warn ""
if kinds.include?(:visible_title)
  warn "FEHLER: `avd-academy-reveal--info` ist der ICON-Knopf – 1,4 rem breit. Ein sichtbarer"
  warn "        Titel darin bricht über mehrere Zeilen um, und der Knopf ist nicht mehr zu"
  warn "        treffen."
  warn ""
  warn "        Der Titel gehört als verborgener Text hinein:"
  warn "          <summary><span class=\"avd-academy-visually-hidden\">«Titel»</span></summary>"
  warn ""
  warn "        Soll der Titel SICHTBAR sein, ist es die gewöhnliche Fassung: `avd-academy-reveal`"
  warn "        ohne `--info`."
  warn ""
end
if kinds.include?(:no_summary)
  warn "FEHLER: Ein `details` ohne `summary` – kramdown hat es maskiert. `summary` und `p` sind"
  warn "        BLOCK-Elemente; mitten in einem Absatz oder in der Zelle einer"
  warn "        Markdown-Tabelle werden sie zu `&lt;summary&gt;`. Der Knopf zeigt dann seinen"
  warn "        eigenen Quelltext und geht nicht mehr auf. Ein `span` überlebt dieselbe Stelle –"
  warn "        deshalb sieht die Quelle richtig aus."
  warn ""
  warn "        Abhilfe: die Umgebung zu rohem HTML machen – die Tabelle als `<table>`"
  warn "        schreiben, den Satz als `<p>`-Block. Darin bleibt alles stehen, wie es dasteht."
end
exit 1
