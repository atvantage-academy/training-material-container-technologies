# Änderungen am ATVANTAGE Academy Theme

Dieses Paket folgt ab `1.0.0` der **semantischen Versionierung**:

| Stelle | wann | für Konsumenten |
| ------ | ---- | --------------- |
| **Major** | inkompatible Änderung | Umstellung nötig – Migrationshinweis steht hier |
| **Minor** | neue Funktion, verträglich | gefahrlos |
| **Patch** | Korrektur, verträglich | gefahrlos |

Die Spanne `^1` (`>=1.0.0 <2.0.0`) ist damit die empfohlene Bindung. Was als
inkompatibel gilt und wie eingestuft wird, steht in
[`AGENTS.md`](https://timetoact.ghe.com/AVD-Academy-Tools/academy-theme/blob/main/AGENTS.md),
Abschnitt „Theme-Version“.

---

## 2.44.0

### Der Blockrhythmus fehlte in Reitern, im Akkordeon – und an Listen und Zitaten überall

Gemeldet aus `training-concept-container-technologies` (A-005), gemessen an Theme 2.42.0:
In einem Reiter stößt eine `<ul>` hart an den Absatz darunter, ein `<blockquote>` hart an
die Tabelle. **Die Meldung war richtig und traf nur die Hälfte.**

**Erstens: die Aufzählung.** `base.css` räumt mit `* { margin: 0 }` alles ab; zurück holt
den Rhythmus eine Eulenregel, die nur **direkte** Kinder der Inhaltsspalte zählt, plus
eine **Aufzählung** der Container, in denen er ebenfalls gelten soll. In dieser
Aufzählung fehlten `avd-academy-tabs__panel` (seit Einführung der Reiter) und
`avd-academy-accordion__body` (seit 2.40.0, also vom ersten Tag des Bausteins an).

Das wiegt schwerer als ein Einzelfall: Das Didaktikon schreibt Reiter für **jedes**
Regiebuch vor – der gesamte Trainerleitfaden jedes Konzept-Repos stand damit in genau dem
Container, in dem der Rhythmus fehlte.

**Zweitens, und das stand nicht in der Meldung: drei Element-Regeln machten die Eulenregel
zunichte.** `.avd-academy-guide-main ul, ol` und `.avd-academy-guide-main blockquote`
setzten `margin: 0` – redundant, weil `base.css` das längst tut, aber **nach** der
Eulenregel und mit höherer Spezifität (0-1-1 gegen 0-1-0). Jede Liste und jedes Zitat
verlor damit seinen Blockabstand, **auch auf der Seitenebene**. Gemessen an der
Bausteine-Seite: `margin-top: 0px` an jeder `<ul>`, heute 25,6 px.

**Gemessen, vorher → nachher:**

| | vorher | jetzt |
| --- | --- | --- |
| Akkordeon, `<ul>` → `<blockquote>` | 0 px | **26 px** |
| Reiter, erster Absatz | 0 px | 0 px + 24 px Innenabstand (richtig, siehe unten) |
| Seitenebene, `<ul>` | 0 px | **25,6 px** |
| Listenpunkte `li + li` | 0 px | 0 px (unverändert, der `gap` macht sie) |

**Kein doppelter Abstand im Reiterstreifen.** Das `<summary>` ist dort `display: none`,
zählt für die Eulenregel aber als Geschwister – der erste sichtbare Absatz hätte 24 px
Innenabstand **plus** 25,6 px Marge bekommen. Eine eigene Regel nimmt ihn im
`--enhanced`-Zustand heraus; im Akkordeon-Zustand ist das `summary` sichtbar und der
Abstand gehört dorthin.

### `avd-academy-flow` – die Aufzählung ist nicht mehr der einzige Weg

Die Meldung fragte, ob die Aufzählung selbst das Problem sei. **Ja** – sie muss bei jedem
neuen Container von Hand nachgezogen werden, in **zwei** Dateien, und der Fehler ist
unsichtbar: Wo der Abstand fehlt, sieht die Seite nicht kaputt aus, sondern nur eng.
Zweimal ist es passiert, das zweite Mal vom Autor des Bausteins selbst.

Wer jetzt einen Fluss-Container baut – im Theme oder in einem Repo –, gibt ihm
`avd-academy-flow`:

```html
<div class="mein-kasten avd-academy-flow" markdown="1">
```

**Die Umkehrung („alles außer …") wurde erwogen und verworfen.** Sie hätte die bessere
Fehlerrichtung – ein vergessener Eintrag fiele als *zu viel* Abstand auf statt als gar
keiner –, aber die Ausnahmeliste wäre länger als die heutige (Reiterleiste, Karten-Gitter,
Materialspalten, Zeilenerklärung, das Akkordeon selbst, die Demo-Bühne), und `ul > li + li`
bekäme plötzlich Blockabstand. Das ist ein Eingriff in jede Seite jedes Repos und gehört in
einen eigenen Schnitt, nicht in die Behebung eines gemeldeten Befunds.

**Und ein Wächter.** `bin/flow-containers.sh` prüft, dass beide Listen identisch sind und
die Marke enthalten – in `make check` und in der Pipeline. Was er nicht kann: wissen,
welcher Container hineingehört. Das bleibt eine Entwurfsentscheidung.

### Zur dritten Frage: Grundmargen an den Elementen

**Nein.** Eine Grundmarge an `ul`, `ol`, `table`, `blockquote` wäre ein zweites System
neben dem Rhythmus-Token und würde in Flex- und Grid-Komponenten wieder stören, wo genau
kein Abstand gewollt ist. Der Ort für den Abstand ist die Eulenregel – sie muss nur
überall greifen und darf nicht hinterher zurückgesetzt werden. Genau das war der Fehler.

---

## 2.43.0

### Mehr Luft um Überschriften – und der Wert darunter kommt jetzt an

Gemeldet aus `training-concepts-overview`: Die Seiten stehen zu eng, über wie unter den
Überschriften.

**Der Befund zuerst, denn er erklärt die Hälfte.** Unter einer Überschrift stand
`margin-bottom: 0.25rem`, also 4 px – gemeint als Bindung an den folgenden Text. Angekommen
sind davon **18 px**: Der Wert **kollabiert** mit dem `margin-top` der Flussregel
(`.avd-academy-guide-main > * + *`, 1,1 rem), und der größere gewinnt. Eine Überschrift
stand damit exakt so weit von ihrem Text wie zwei Absätze voneinander – die gemeinte
Hierarchie gab es nur im Kommentar.

Die Flussregel nimmt Überschriften jetzt aus:

```css
.avd-academy-guide-main > :is(h1, h2, h3, h4, h5, h6) + * {
  margin-top: var(--avd-academy-rhythm-heading);
}
```

Erst dadurch entscheidet das Token überhaupt. Dazu bekommt die `h3` ein eigenes
(`--avd-academy-rhythm-subsection`); dort stand `1.75rem` hart im Stylesheet, während die
`h2` längst ein Token hatte.

**Gemessen am gebauten Stand, vorher und nachher:**

| | vorher | jetzt |
| --- | --- | --- |
| über einer `h2` | 44 px | **60 px** |
| unter einer Überschrift | 18 px | **24 px** |
| über einer `h3` | 28 px | **40 px** |
| zwischen zwei Absätzen | 17,6 px | **26 px** |

Die Hierarchie bleibt erhalten: unter der Überschrift (24 px) weniger als zwischen zwei
Absätzen (26 px), damit sie an ihrem Text hängt – nur eben spürbar statt bloß behauptet.

**Zur Herkunft:** Das ATVANTAGE-Fundament setzt `h1..h6 { margin: 0 0 0.5em }` – nichts
darüber, ein halbes Geviert darunter. Die Academy-Ebene dreht das bewusst um (viel darüber,
weniger darunter), weil ihre Seiten Abschnitte haben und keine Fließtexte. Diese Abweichung
ist damit älter als die Tokens; 2.15.0 hatte nur den Abstand **darüber** angehoben.

**Was Projekte tun müssen: nichts.** Wer den Rhythmus einer Unterlage anders will, setzt die
vier Tokens um, statt Klassen des Themes zu überschreiben.

---

## 2.42.0

### Der Kontrastprüfer kann nicht mehr still über nichts laufen

Gemeldet aus `atlassian-mcp`, wo `contrast.rb` zum ersten Mal in einer fremden Pipeline
lief: Zwei Läufe über dieselbe Startseite, beide grün, beide mit derselben Zeile „Keine
Paarung unter der Schwelle." Der eine hatte **106** Elemente betrachtet, der andere **4**.
Nichts in der Ausgabe unterschied sie.

**Die Ursache ist der Basispfad.** Eine mit `jekyll build --baseurl /docs` gebaute Site
verweist absolut auf `/docs/theme/academy/…`. `contrast.rb` servierte das mit `--site`
übergebene Verzeichnis flach als Wurzel – unter `/docs/` lag dort nichts, jede Datei lief
ins Leere, und gemessen wurde nacktes HTML. Darauf trägt fast jede Paarung, weil es nur
noch Schwarz auf Weiß gibt.

**Zwei Änderungen, und die zweite ist die wichtigere:**

**`--baseurl «pfad»`** – gleiche Schreibweise und Bedeutung wie in `links.rb`, weil beide
Prüfer nebeneinander aufgerufen werden. Der interne Server bildet den Pfad nach, statt
dass jeder Aufrufer sein Artefakt vorher in einen Unterordner umpacken muss.

**Ein Wächter, unabhängig davon.** Vor jeder Messung wird geprüft, ob die Theme-Tokens
überhaupt angekommen sind (`--avd-academy-color-bg`). Ist das nicht so, wird die Seite
**benannt und nicht gemessen**, und der Lauf endet mit **Rückgabewert 2** – auch ohne
`--strict`. Ein Befund ist eine inhaltliche Entscheidung und darf eine Warnung bleiben;
eine Seite ohne Stylesheet ist gar keine Messung. `a11y.mjs` hatte diesen Wächter längst,
`contrast.rb` nie.

Ein `--baseurl` hilft nur dem, der weiß, dass er es braucht. Der Wächter hilft auch dem,
der es nicht weiß – und er fängt mehr ab als den Basispfad: falsch entpacktes Artefakt,
halb hochgeladenes Bundle, umbenannter Theme-Ordner.

**Dazu die Bezugsgröße, die gefehlt hat:** Der Bericht nennt jetzt, wie viele Elemente mit
eigenem Text überhaupt betrachtet wurden. An dieser Zahl unterscheidet man 4 von 106.

**Kopiervorlagen bleiben draußen.** Eine eigenständige Vorlage trägt statt Pfaden den
Platzhalter `«BASISPFAD»`, lädt also gar kein Stylesheet – ohne diese Ausnahme wäre sie
beim neuen Wächter hängengeblieben. Dasselbe Kriterium steht in `a11y.mjs`.

**Belegt am gebauten Stand** (Doku-Site dieses Repos, mit `--baseurl /docs` gebaut):

| | betrachtete Elemente | Rückgabewert |
| --- | --- | --- |
| ohne `--baseurl` | 26 | **2**, 118 Seitenansichten benannt |
| mit `--baseurl /docs` | 29 582 | 0 |

Der Selbsttest deckt beide Fälle ab – er baut sich dafür eine Site mit einem
wurzel-absoluten Stylesheet unter einem Basispfad, weil im eigenen Repo ohne Basispfad
gebaut wird und der Fall sonst nie entstünde.

---

## 2.41.0

### Ausnahmen der Barrierefreiheitsmessung sind erweiterbar

Die benannten Ausnahmen standen fest im Skript. Für die des **Themes** war das richtig
und bleibt es: Was das Theme entschieden hat – heute das Marken-Orange als Verweisfarbe –
liegt im Paket und reist mit jeder Unterlage mit. Ein Repo bekommt dafür keinen Befund,
ohne eine Zeile dafür zu schreiben.

**Ein Projekt hat aber eigene.** Die kommen jetzt aus einer Datei:

```json
[
  {
    "rule": "color-contrast",
    "when": { "fgColor": "#5a7d2a" },
    "since": "2026-09-23",
    "reason": "Schulungsfarbe im dekorativen Schriftzug; der Name steht daneben als Text."
  }
]
```

Ohne Angabe wird `a11y-exceptions.json` im Arbeitsverzeichnis gesucht; `--exceptions
«datei»` setzt einen anderen Ort. **Die Felder sind englisch**, weil ein Projekt sie
tippt; `rule` und `reason` sind Pflicht.

**Ergänzen, nicht überschreiben.** Die Liste des Projekts wird an die des Themes
angehängt; eine Theme-Ausnahme abzuschalten geht bewusst nicht. Sie steht dort, weil sie
**im Theme** entschieden wurde – wer sie für falsch hält, ändert sie dort und nicht still
in einem Repo, in dem niemand sie sucht.

Der Bericht nennt jetzt je Ausnahme die **Herkunft** (`Theme` oder `Projekt`) neben der
Zahl der unterdrückten Stellen. Ein Fehler in der Datei hält den Lauf an (Rückgabewert 2):
Still übergangen würde das Projekt in dem Glauben messen, seine Ausnahmen griffen.

Intern heißen die Felder der eingebauten Liste jetzt ebenso `rule`/`when`/`reason`/`since`
– eine Form statt zweier. Nach außen ändert das nichts; die Liste war nie konfigurierbar.

---

## 2.40.0

### `avd-academy-accordion` – aus Überschriften werden Klappbereiche

Eine Liste von Abschnitten, die nacheinander drankommen – eine Checkliste, ein Ablauf,
eine Sammlung von Fällen. Es ist immer genau **einer** offen.

```markdown
<div class="avd-academy-accordion" markdown="1">

### 1. Eigene Vorstellung · ca. 3′

«Beliebiges Markdown.»

### 2. Vorstellungsrunde · ca. 8′

«Beliebiges Markdown.»

</div>
```

**Der Autor schreibt Überschriften, keine Bedienelemente** – das ist der Unterschied zu
Reveal, Fold und den Reitern. Die Überschrift bleibt eine Überschrift (Ebene, Anker,
Vorlesereihenfolge) und bekommt den Knopf **hinein**; so steht es in den ARIA Authoring
Practices. Die Ebene bestimmt, wer sie schreibt: Das Skript nimmt die flachste
Überschrift unter den direkten Kindern, ein Kasten im Kasten ist damit die zweite Ebene.

**Tastatur:** Pfeiltasten links/rechts und hoch/runter wechseln den Abschnitt,
`Home`/`End` springen an den Rand, der gewählte Kopf bleibt im Bild.

**Warum ein Gitter und nicht `<details>`:** Ein `<details>` geht auf, aber nicht zu – der
Browser nimmt den Inhalt beim Schließen sofort aus dem Fluss. Geklappt wird deshalb wie
im Burger-Menü (`0fr` → `1fr`, rechnet mit der wirklichen Höhe). Der Preis: **Strg+F
findet nicht, was zugeklappt ist**; im Ausdruck steht alles offen. Bei den Reitern ist
das anders, und deshalb stehen beide Bausteine nebeneinander.

Ohne JavaScript steht ein gewöhnliches Dokument da – jede Regel zum Zuklappen hängt an
`avd-academy-accordion--enhanced`, und die setzt das Skript erst nach dem Umbau.

### Aufgabenlisten sind überall anklickbar

Kramdown gibt ein `- [ ]` als `<input type="checkbox" disabled>` aus. Eingeschaltet hat
das Theme die Kästchen bisher **nur dort, wo eine Fortschrittskarte danebenstand** – also
ausgerechnet nicht auf der Seite, die nichts als eine Liste ist. Eine Trainer-Checkliste
war damit ein Bild von einer Checkliste.

Jetzt gilt es auf jeder Seite, mit dem Text der Zeile als Namen des Kästchens. Der
Zustand wird nicht gespeichert; die Fortschrittskarte zählt wie bisher zusätzlich mit.

### `avd-academy-demo` – ein Baustein, vorgeführt in seinem eigenen Fenster

Der Baustein hinter der neuen Seite **Playground**: eine Vorführung und ihr Markup aus
**einer** Quelle (`_includes/avd-demo.html` + `academy/demo.css` + `academy/demo.js`).

Die Vorführung steht in einem `<iframe>`, und das ist kein Aufwand um seiner selbst
willen: `@media (max-width: 46rem)` fragt das **Fenster**, nicht den Kasten – ein auf 320
Pixel verengtes `div` zeigt weiter das Layout für den Schreibtisch, und 320 Pixel sind
die Prüfgröße aus WCAG 1.4.10. Ebenso das Farbschema: Die Dark-Tokens hängen an `:root`
und lassen sich für einen Ausschnitt nicht setzen. Im Rahmen sind beide Schalter echt.

`demo.css`/`demo.js` werden **nicht global geladen**; die Seite, die sie braucht, bindet
sie ein – dieselbe Regel wie bei Quiz und Simulation.

**`atvantage.js` lässt alles unter `[data-avd-academy-demo]` in Ruhe.** Ohne diesen
Riegel übergäbe die Seite dem Rahmen eine bereits umgebaute Fassung, und er setzte einen
Knopf in den Knopf – gemessen zehn Akkordeon-Köpfe, wo fünf hingehören.

### Neue Namen

| | |
| --- | --- |
| Klassen | `avd-academy-accordion`, `--enhanced`, `__toggle`, `__region`, `__body` |
| | `avd-academy-demo`, `--enhanced`, `__controls`, `__group`, `__label`, `__switch`, `__stage`, `__frame`, `__source` |
| Attribut | `data-avd-academy-demo` |
| Dateien im Paket | `academy/demo.css`, `academy/demo.js`, `jekyll/_includes/avd-demo.html` |
| Beschriftung | `tMarkup` |

Alles rein ergänzend – nichts entfernt, nichts umbenannt.

---

## 2.39.0

### `avd-academy-walkthrough` – eine Zeile, eine Erklärung

Eine rohe HTTP-Nachricht, ein OpenAPI-Dokument, ein Stück Code: Jede Zeile ist
anklickbar und klappt ihre Erklärung auf.

```html
<div class="avd-academy-walkthrough">
  <details class="avd-academy-walkthrough__line" name="anfrage">
    <summary><span class="avd-academy-walkthrough__mark">GET</span> /produkte HTTP/1.1</summary>
    <div class="avd-academy-walkthrough__note">Die Startzeile nennt Methode, Ziel und Protokollfassung.</div>
  </details>
</div>
```

**Grundlage ist `<details name="…">`**, wie bei Reitern und Reveal: Der Browser schaltet
exklusiv, bringt Tastaturbedienung und `aria-expanded` mit, und ohne JavaScript bleibt
jede Erklärung erreichbar.

**Warum es den Baustein gibt:** Die Konstruktion kam in einem einzigen Schulungs-Repo
**dreimal selbst gebaut** vor (A-013, A-016), jedes Mal mit denselben drei Fehlern:

| | |
| --- | --- |
| Zeilen 22–24 px hoch | jetzt `min-height: 24px` – und weil Zeilen aneinanderliegen, greift die Abstands-Ausnahme gerade nicht (32 Stellen gemessen) |
| dunkler Codeblock als Fläche | jetzt die zurückgenommene Seitenfläche – auf dunklem Grund kippen die Statusfarben (2,1:1 gemessen) |
| Zustand nur über Farbe | jetzt ein Marker, der sich dreht (1.4.1) |

Dazu: lange Zeilen scrollen **im Baustein** statt die Seite zu verbreitern, mit
Tastaturzugang; im Druck stehen alle Erklärungen offen, ohne Marker, und Zeile und
Erklärung bleiben zusammen auf einer Seite.

Nachgemessen an der Doku-Seite, die den Baustein **lauffähig** zeigt: 28,2 px je Zeile,
Enter öffnet, die nächste Zeile schliesst die vorige, Fokusring sichtbar.

## 2.38.0

### Schriftgrößen wachsen wieder mit der Browsereinstellung

**25 `font-size`-Angaben standen in Pixeln** und reagierten damit nicht auf die
Standardschriftgröße des Browsers. Das Ergebnis war nicht „zu klein", sondern
**inkonsistent** – gemessen an einer Guide-Seite mit 24px Standardschrift:

| | 16 px | 24 px |
| --- | --- | --- |
| Fließtext (rem) | 21,6 px | **32,4 px** |
| Inhaltsverzeichnis (px) | 16 px | **16 px** |
| Brotkrume (px) | 15 px | **15 px** |
| Kartenbeschriftung (px) | 14 px | **14 px** |

Die Seite wuchs zur Hälfte mit. Wer die Schriftgröße hochstellt, tut das aus einem
Grund – und für viele ist es der einzige Weg, der ohne Zoom auskommt.

Umgerechnet mit 16px Wurzel, also **dieselben Größen wie bisher**: 14px = 0.875rem,
15px = 0.9375rem, 17px = 1.0625rem. Optisch ändert sich im Auslieferungszustand nichts.

**Für Radien, Schatten und Haarlinien bleibt Pixel richtig.** Ein Rahmen, der mit der
Schrift wächst, wird unscharf und gewinnt nichts. Die Regel lautet nicht „nie px",
sondern „px nicht für Schrift".

**Nicht enthalten:** Die H1 im Hero kommt aus dem ATVANTAGE-Fundament
(`--h1-base: 38px`) und bleibt unangetastet – sie zu überschreiben wäre eine
Design-Abweichung und keine Korrektur. Ebenso die Breakpoints, die weiter in Pixeln
stehen; `em`-Breakpoints wären eine eigene, zu messende Entscheidung.

### `--avd-academy-fs-root` entfällt

Das Token stand mit `16px` im Satz und wurde von **keiner Regel gelesen** – ein Wert,
der aussieht, als liesse sich damit die Grundschrift einstellen, und es nicht tut.

**Einstufung: Minor, nicht Major.** Formal fällt „Token entfernt" unter Major. Die Regel
schützt Projekte, die ein Token **setzen und damit etwas bewirken**; dieses konnte nichts
bewirken, weil es nirgends gelesen wurde. Wer es gesetzt hat, sah keine Wirkung und
verliert keine. Die Grundschrift gehört ohnehin dem Browser.

## 2.37.0

### `avd-academy-muted` – zurückgenommener Text, ohne den Kontrast mitzunehmen

Für Randbemerkungen und Einleitungen gab es bisher keine Klasse, also nahmen die
Unterlagen `opacity`. Das ist der naheliegendste Weg und der falsche: Die Deckkraft legt
eine Ebene über die **ganze Gruppe** und senkt damit auch den Kontrast von allem, was
darin hervorgehoben ist – ein Wort im Akzent, ein Verweis.

Gemessen in `training-concept-java-se`: Die Schulungsfarbe erreicht abgeleitet 5,38:1;
unter `opacity: .85` blieben **4,21**, an 46 Stellen. **Ein `opacity: 1` am Kindelement
hebt das nicht auf** – Elterndeckkraft erzeugt eine eigene Ebene. Deshalb sieht man der
CSS-Regel den Fehler nicht an.

```html
<p class="avd-academy-muted">Die Beispiele stammen aus Java 21.</p>
```

**`opacity` bleibt richtig, wo eine ganze Fläche mitsamt Hintergrund zurücktreten soll** –
eine Pausenzeile in einer getönten Tabelle etwa. Das Theme nutzt es an drei Stellen
genau dafür; falsch ist es über Text, dessen Farbe schon knapp ist. Beides steht jetzt
in [Bausteine → Zurückgenommener Text](https://timetoact.ghe.com/pages/AVD-Academy-Tools/academy-theme/docs/theme/bausteine.html#muted)
und im Plugin-Skill `barrierefreiheit-pruefen` (3.4.0).

## 2.36.0

### Der Bericht sagt, wofür er gilt

Neue Option **`--label`**. Dieselbe Site wird in Schulungs-Repos mehrfach gebaut – einmal
je Zielgruppe –, und beide Berichte landen am selben Ort: als Kommentar an demselben
Issue. Dort stand zweimal „Barrierefreiheit: 2 Regel(n) verletzt" mit verschiedenen
Zahlen, ohne dass erkennbar war, welche Fassung gemeint ist.

```
## ⚠️ Barrierefreiheit · learner: 2 Regel(n) verletzt
```

Ohne die Option bleibt alles wie bisher – wer nur ein Bündel baut, braucht keine
Beschriftung.

## 2.35.0

### Eine Messung, die nichts messen konnte, meldet das jetzt

**Der Fall, der es gezeigt hat:** Die Pipeline eines Schulungs-Repos baut das
Lernenden-Bundle für eine Basisadresse (`/training-material-…`) – alle Verweise darin
sind absolut. Ausgeliefert wurde es der Messung unter `/`. **Jede CSS- und JS-Datei lief
ins Leere**, gemessen wurde nacktes HTML, und der Bericht nannte **468 Befunde**: zu
kleine Trefferflächen, fehlende Namen, schlechte Kontraste. Alles wahr für die Seite, die
der Browser sah – und alles falsch für die Unterlage.

Zwei Änderungen, und die zweite ist die wichtigere:

**`--baseurl`** reicht die Basisadresse durch: Der eingebaute Server bedient sie, und die
Seiten werden darunter geöffnet.

**Eine Plausibilitätsprobe vor jeder Messung.** Ist das Theme nicht angekommen – kein
`--avd-academy-color-bg` im Dokument –, **gibt es kein Ergebnis, sondern eine Fehlmeldung
mit Grund**. Die Seite zählt als „nicht messbar", und der Bericht sagt ausdrücklich, dass
das **nicht** als „sauber" zu lesen ist. Ein Werkzeug, das im Zweifel schweigt, ist
besser als eines, das im Zweifel Zahlen erfindet.

### Kopiervorlagen werden nicht mehr gemessen

Die Probe hat im eigenen Haus gleich zugeschlagen: `presentation-template.html` trägt
statt Pfaden den Platzhalter `«BASISPFAD»` – sie lädt also weder Stylesheet noch Skript
und ist erst dann eine Seite, wenn jemand sie kopiert. **Bisher wurde sie ungestylt
gemessen und als sauber gemeldet**; jetzt bleibt sie draussen, und der Lauf sagt, welche
Datei er warum übersprungen hat.

Erkannt wird sie am Platzhalter **in einem Verweis** (`href`/`src`) – eine Doku-Seite,
die ihn nur im Beispielcode zeigt, bleibt eine gewöhnliche Seite.

### Die mitgelieferte Herkunftsnotiz ist keine Seite mehr

`vendor/axe-core/HERKUNFT.md` wurde von Jekyll **als Seite gerendert** – in jeder
Unterlage, die das Theme lädt. Die `exclude`-Liste des Themes half nicht: Jekyll
**ersetzt** den Schlüssel, ein Repo mit eigener Liste verliert die des Themes. Die Datei
heißt jetzt `HERKUNFT.txt`; was nicht wie eine Seite aussieht, kann auch keine werden.

**Einstufung: Minor, nicht Major.** Die Regel „Dateien aus dem Paket entfernt = Major"
schützt öffentliche Adressen und Asset-Pfade. Diese Datei ist eine Lizenz- und
Herkunftsnotiz neben einer Bibliothek; sie wird von nichts verlinkt, und ihr bisheriger
Pfad war ein Versehen, kein Angebot.

## 2.34.0

### Die Verweise sind wieder orange – als benannte Abweichung

2.33.0 hatte die Verweisfarbe abgedunkelt, weil `#FF5401` als Schrift nur 3,22:1
erreicht. **Die Marke kommt zurück:** Sie trägt die Verweise. Dass es Verweise sind,
zeigt die **Unterstreichung** im Fließtext – das erfüllt 1.4.1, **nicht** 1.4.3. Die
Kontrastforderung bleibt also unerfüllt, und genau so steht es jetzt da: als
**bekannte Abweichung** mit Begründung und Datum in
[Barrierefreiheit](https://timetoact.ghe.com/pages/AVD-Academy-Tools/academy-theme/docs/theme/barrierefreiheit.html).

`--avd-academy-color-link` und `--avd-academy-color-link-hover` bleiben erhalten und
zeigen jetzt auf den Akzent. **Wer die Abweichung nicht mitgehen will, setzt die
beiden Token auf eine dunklere Mischung** (die Doku nennt die Werte) und ist ohne
weiteres Zutun konform – alle Verweise folgen ihnen.

### Ausnahmen gelten je Stelle, nicht je Regel

Damit die Abweichung die Prüfung nicht blind macht, kennt `a11y.mjs` jetzt **benannte
Ausnahmen mit Merkmal**: Die Ausnahme nennt den Vordergrundton `#FF5401`, nicht die
Regel `color-contrast`. Ein schlechter Grauton fällt weiterhin auf.

**Verschwiegen wird nichts:** Jeder Lauf zählt, wie viele Stellen welche Ausnahme
deckt, und schreibt es in den Bericht – auf der Konsole, in der Zusammenfassung des
Laufs und in den Kommentar am Pull Request. Eine Zahl, die wächst, fällt auf.

## 2.33.0

### Barrierefreiheit als Maßstab – und als Messung

**WCAG 2.2 AA gilt für alles, was das Theme erzeugt.** Was das heißt, was das Theme
schon mitbringt und was eine Unterlage beitragen muss, steht neu unter
[Barrierefreiheit](https://timetoact.ghe.com/pages/AVD-Academy-Tools/academy-theme/docs/theme/barrierefreiheit.html).

**Neu: `theme/jekyll/a11y.sh`** misst das gebaute `_site` mit **axe-core** in einem
echten Browser – bei **1280 und 390 Pixeln** und in **beiden Farbschemata**, nach dem
Laufen der Skripte, weil Inhaltsverzeichnis, Fortschritt, Reiter, Quiz und Menüs erst
dort entstehen. Das Farbschema wird ausdrücklich gesetzt und nicht dem Rechner
überlassen: Sonst findet ein dunkel eingestelltes Notebook nicht, was die Pipeline auf
einem hellen Runner meldet – genau so ist der Kontrastfehler in der
Visualisierungs-Vorlage durchgerutscht (hell 2,75:1, dunkel 4,49:1).

axe-core liegt als Kopie daneben (`theme/jekyll/vendor/axe-core/`, MPL-2.0); kein CDN,
keine Installation, kein Netz. Lokal `make a11y`; in der Pipeline ein eigener Job neben
den übrigen Prüfungen, mit Bericht in der Zusammenfassung und im Pull Request – **auch
ohne Befund**.

**Im Theme blockiert eine Verletzung**, in den Schulungs-Repos nicht: Was hier kaputt
ist, wandert mit dem nächsten Paket in jede Unterlage, und dort kann es niemand
reparieren. Dort ist der Befund dagegen meist eine inhaltliche Entscheidung – die
zentrale didaktikon-Action meldet ihn als Warnung.

### Die Verweisfarbe ist nicht mehr das Marken-Orange

`#FF5401` erreicht als Schrift auf Weiß nur **3,22:1**; gefordert sind 4,5:1. Neu
sind `--avd-academy-color-link` und `--avd-academy-color-link-hover`, aus dem Akzent
gemischt: hell 5,7:1, dunkel 5,2:1. **Als Fläche, Rand, Balken und Fokusring bleibt
die Marke unverändert.** Verweise im Fließtext sind zusätzlich unterstrichen – gegen
den umgebenden Text trägt die Farbe allein nicht.

Wer einen eigenen Akzent setzt, bekommt seine eigene Verweisfarbe automatisch dazu.

### Was sonst noch behoben wurde

| | |
| --- | --- |
| **Aufgabenlisten** | Die Kästchen bekommen ihren Namen aus dem Listeneintrag – vorher sagte eine Vorlesehilfe fünfzehnmal „Kontrollkästchen“. |
| **Fortschritt** | `role="progressbar"` mit Wert und Namen; der Text daneben wird angesagt und ist endlich **übersetzt** (stand fest auf „erledigt“). |
| **Breite Tabellen** | bekommen automatisch einen Scrollbereich – mit `tabindex`, sonst erreicht die Tastatur die rechten Spalten nicht. Im Druck geht der Rahmen auf. |
| **Folien** | Nicht sichtbare Folien sind `inert`, nicht nur `aria-hidden` – der Fokus lief vorher hinein. |
| **Quiz** | Balken mit Rolle und Wert, Begründung als `status`, und der Fokus wandert zur nächsten Frage statt zum `body`. |
| **Menüs** | `aria-expanded` folgt jetzt auch dem Fokus, nicht nur dem Klick. |
| **QR-Schalter** | sagt mit `aria-pressed`, ob er gedrückt ist. |
| **Fußbereich** | Verweise sind 24 px hoch (WCAG 2.5.8). |
| **HTTP-Status im Code** | Die Farben waren im hellen Schema gegen die Seitenfläche gerechnet, standen aber auf dem dunklen Codeblock – 2,1:1. |
| **Vorlagen** | Das Foliendeck ist ein `<main>`, die Simulationsvorlage hat eine H1, ihre Knöpfe tragen Schrift mit 5,7:1 und die Schrittliste ist per Tastatur erreichbar. |
| **Visualisierungs-Vorlage** | Der hervorgehobene Wert stand im reinen Marken-Orange auf heller Fläche (2,75:1) – jetzt `--avd-academy-color-accent-ink`, 6,9:1 in beiden Schemata. |

### Für Schulungs-Repos

Das Werkzeug liegt **im Paket** (`theme/jekyll/a11y.sh`), damit die zentrale
didaktikon-Action dieselbe Prüfung fahren kann wie dieses Repo.

## 2.32.0

### Eine Seite ohne rechten Bereich steht mittig

Bleibt die rechte Spalte leer – kein Inhaltsverzeichnis, kein Fortschritt, keine
weiterführenden Links –, ordnet sich die Seite einspaltig und mittig an, wie eine
Visualisierung; Überschrift und Brotkrume wandern mit. Entschieden wird das im
Browser, nach dem Aufbau von Verzeichnis und Fortschritt.

### Schmal gilt eine eigene Anordnung

Unabhängig von der `_config.yml`: Inhaltsverzeichnis **vor** dem Text und zugeklappt,
Fortschritt gar nicht, weiterführende Links **nach** dem Text. Die Schalter in der
Konfiguration beschreiben eine Seitenspalte; auf einem Telefon gibt es keine.

## 2.31.0

### Drei Ebenen in der oberen Navigation

Untermenüs fahren wahlweise zur Seite aus (`menu: flyout`, Standard) oder stehen
eingebettet im selben Menü (`menu: embedded`), abgetrennt durch einen Querstrich, mit
dem bündelnden Eintrag als Überschrift – verlinkt, wenn er ein Ziel hat. Die dritte
Ebene ist immer eingebettet.

Der Burger erscheint ab `nav.compact_after` Einträgen (Standard 5) **und** sobald das
Theme einen Zeilenumbruch in der Leiste misst. Im Burger wird jede Ebene zum
Akkordeon, auf dem Telefon über die volle Breite.

## 2.30.0

### Layout `quiz`: Wissens-Checks zum Anklicken

Die Seite trägt nur noch `layout: quiz` und die Fragen (`quiz.questions`,
`quiz.verdicts`); Gerüst, Form und Mechanik kommen aus dem Theme. Ohne JavaScript und
im Druck erscheint die Fragenliste. Vorher standen rund 240 Zeilen CSS und JavaScript
in der Unterlage.

### `AvdHighlight`: Syntaxhervorhebung für nachgeladenen Code

Wer Code erst im Browser einfügt (Simulation, Quiz), färbt ihn über
`window.AvdHighlight.apply(el)`; das Ereignis `avd-academy-highlight-ready` sagt, wann
es bereitsteht.

## 2.29.0

### Reiter wahlweise links (`--side`) und Adressen, die man verschicken kann

`avd-academy-tabs--side` stellt die Reiterleiste an die linke Seite; die Pfeiltasten
folgen der Anordnung. Jeder Reiter hat eine lesbare Kennung, und die Adresse führt den
offenen Reiter mit – ein Verweis auf einen Reiter (oder auf etwas darin) öffnet ihn.

### Behoben: `folder_slug` in Unterordnern

Ein Ordner-Slug ging verloren, wenn der Ordner selbst keine Seite trug, sondern nur
ein Unterordner darin. Der Bauablauf reicht die Zuordnung jetzt als
`avd_folder_slugs` in die Konfiguration des Laufs.

## 2.27.1

### Behoben: Die Reiter sahen nicht aus wie Reiter

Aus der Praxis gemeldet: „Ich sehe nur die Titel, untereinander statt nebeneinander, keinen
Hintergrund bei den Tabs und im Inhalt."

**Die Mechanik war in Ordnung** – nachgewiesen gegen die deployten Dateien: Leiste gebaut,
fünf Reiter, `--enhanced` gesetzt. Die Gestaltung taugte nicht:

| Befund | Ursache |
| ------ | ------- |
| untereinander statt nebeneinander | `flex-wrap: wrap` – fünf Beschriftungen passen nicht in eine Inhaltsspalte und **brachen um** |
| kein Hintergrund bei den Tabs | nur ein Unterstrich, keine Fläche |
| kein Hintergrund im Inhalt | das offene Panel hatte gar keine |

Ein umgebrochener Streifen ohne Fläche liest sich als Liste von Titeln – also genau als
das, was er ersetzen sollte.

**Die Leiste rollt jetzt, statt umzubrechen** (`flex-wrap: nowrap` + `overflow-x: auto`).
Das ist die einzige Form, die bei jeder Breite ein Streifen bleibt; die frühere
Sonderregel für schmale Bildschirme entfällt damit, weil sie zur Regel geworden ist.

**Reiter und Inhalt bekommen Flächen.** Der gewählte Reiter trägt den Seitenhintergrund
und sitzt optisch vor der Trennlinie, die übrigen dahinter; die Inhaltsfläche schließt
**unmittelbar** an die Leiste an. Ein Abstand dazwischen ließe beide als getrennte Dinge
erscheinen.

### Nebenbei: ein Token, das es nicht gibt

`--avd-academy-space-5` wurde verwendet, ist aber nirgends definiert (die Skala geht
1, 2, 3, 4, 6, 8, 12, 16). Dank Rückfallwert wirkte es trotzdem – ein erfundenes Token
gehört trotzdem nicht ins Theme. Ersetzt durch `--avd-academy-space-6`.

---

## 2.27.0

### Neu: Tabs – ein langer Leitfaden in schaltbaren Abschnitten

Eine Seite, die zu lang zum Scrollen ist, bekommt Reiter. Dokumentiert unter
[Bausteine → Tabs](https://timetoact.ghe.com/pages/AVD-Academy-Tools/academy-theme/docs/theme/bausteine.html#tabs).

```html
<div class="avd-academy-tabs" markdown="1">
<details class="avd-academy-tabs__panel" name="leitfaden" open markdown="1">
<summary>Tag 1</summary>
…
</details>
</div>
```

**Grundlage ist `<details name="…">`, kein Klick-Handler.** Der Browser schaltet damit von
sich aus exklusiv. Das ist dieselbe Entscheidung wie beim aufdeckbaren Inhalt und aus
demselben Grund: Ein Umschalter, der nur mit JavaScript existiert, **verliert im
Fehlerfall Schulungsinhalt**.

| | ohne JavaScript | mit JavaScript |
| --- | --------------- | -------------- |
| Darstellung | Akkordeon | Reiterstreifen oben |
| Umschalten | nativ über `name` | Klick auf den Reiter |
| Strg+F | findet alles | findet alles |
| Tiefe Verweise | Browser springt | öffnet zusätzlich den Reiter |

`atvantage.js` baut die Leiste aus den `<summary>` und setzt erst **danach**
`--enhanced`. Bricht etwas vorher ab, steht das Akkordeon – nie eine halbe Oberfläche.

**Warum nicht rein mit CSS:** Ein echter Reiterstreifen braucht die Beschriftungen getrennt
von den Inhalten – eine Leiste oben, darunter eine gemeinsame Fläche. In `<details>` steckt
jede Beschriftung in ihrem eigenen Element. `display: contents` würde sie herauslösen,
zerlegt aber in mehreren Browsern die Auf-/Zu-Mechanik selbst.

### Zwei Feinheiten, die sonst stillschweigend schiefgingen

**Im Ausdruck** entfällt die Leiste (sie ist eine Bedienung), und die Zusammenfassungen
kommen als Zwischenüberschriften zurück. Beim Aufklappen steckt die Falle: Ein
`<details name="…">` **schließt beim Öffnen seine Geschwister** – eine Schleife, die reihum
öffnet, ließe am Ende genau einen Reiter offen und der Rest fehlte auf dem Papier.
`atvantage.js` entfernt den Namen deshalb vor dem Druck und setzt ihn danach zurück.

**Mit der Tastatur** wechseln Pfeiltasten den Reiter, `Home`/`End` springen an den Rand.
Ohne das wäre der Streifen unerreichbar: Nicht gewählte Reiter tragen `tabindex="-1"`,
damit die Leiste ein Tab-Stopp ist und nicht sechs.

### Für Konsumenten

Rein ergänzend. Geschrieben werden nur `avd-academy-tabs` und
`avd-academy-tabs__panel`; Leiste und Reiter legt das Skript an.

---

## 2.26.0

### Behoben: `folder_slug` ging beim Zielgruppenfilter verloren

`folder_slug` benennt einen Ordner in der **Adresse** um – der typische Fall ist eine
Nummer im Dateisystem (`03-http/`), die in der URL nichts verloren hat (`/http/`). Das
Schema verlangt die Angabe in der `index.md` des Ordners.

Genau die gehört in einer Schulungsunterlage aber oft **nur einer Zielgruppe** (das
Trainer-Thema eines Moduls). Der Filter entfernte sie – und mit ihr die Adressangabe. Der
Ordner behielt dann seinen Dateinamen, also die Nummer, **ausgerechnet in der öffentlichen
Ausgabe**, während die übrigen Seiten weiter auf die Slug-Adresse zeigten.

**Gemessen** an einem Schulungsrepo mit zwölf nummerierten Modulen: In der Trainer-Ausgabe
stimmten alle Adressen, in der Lernenden-Ausgabe hieß **jeder** Ordner wieder `NN-…` – ein
toter Verweis je Modul. Der Linkcheck fängt das erst nach dem Build; ohne ihn wäre es
unbemerkt deployt worden.

Die Baukomponente verschiebt die Angabe jetzt auf eine Seite, die **bleibt**, und meldet es
sichtbar:

```
==> folder_slug gerettet: 12 Ordner, deren Index-Seite der Filter entfernt hat
```

**Warum das geht:** Das Adressen-Plugin liest `folder_slug` von **jeder** Seite eines
Ordners, nicht nur von der Index-Datei. Die Beschränkung im Schema ist eine Konvention für
Autoren – sie hält die Angabe an einer auffindbaren Stelle –, keine technische Bedingung.
Zwei Angaben mit gleichem Wert sind zulässig; nur verschiedene brechen ab.

Bleibt keine Seite übrig, ist der Ordner ohnehin weg und es gibt nichts zu retten.

---

## 2.25.0

### Behoben: In Callouts, Zitaten und Zellen klebten die Absätze aneinander

`base.css` räumt mit `* { margin: 0 }` alle Abstände ab; zurück holte sie **eine** Regel:

```css
.avd-academy-guide-main > * + * { margin-top: var(--avd-academy-rhythm-block); }
```

Der Selektor greift nur bei **direkten Kindern**. Alles, was in einem Container steckte,
blieb ohne Abstand – und das ist auf einer Unterlage nicht der Randfall, sondern der
Normalfall: Callout, Zitat, aufdeckbarer Block, Listeneintrag, Tabellenzelle.

**Gemessen am Trainerleitfaden eines echten Schulungsrepos:** 2 von 3 `blockquote` und der
einzige Callout hatten je zwei Absätze **ohne einen Pixel dazwischen** – sieben
Absatzübergänge allein auf dieser Seite. Am Bildschirm liest sich das wie ein einziger
Block, und es traf jede Seite jedes Repos.

Der Rhythmus gilt jetzt auch **innerhalb** dieser Container:

```css
.avd-academy-guide-main :where(blockquote, li, td, th, figure,
  .avd-academy-callout, .avd-academy-reveal__body, .avd-academy-fold__body) > * + * {
  margin-top: var(--avd-academy-rhythm-block);
}
```

Dieselbe Ergänzung in `site.css` für die gewöhnliche Seite (`.avd-academy-doc-main`) –
beide Spalten lesen denselben Rhythmus, also müssen sie ihn auch gleich anwenden.

**`:where()` hält die Spezifität bei null.** Ein Repo, das in seiner `custom.css` einen
dieser Container eigens setzt, gewinnt weiterhin ohne `!important`.

### Warum Minor und nicht Patch

Die Korrektur **ändert das Aussehen jeder Seite** – dort, wo bisher nichts war, steht
jetzt ein Abstand. Das ist mehr als eine stille Korrektur, aber kein Bruch: Kein Repo muss
etwas tun, und wer den Abstand irgendwo nicht will, setzt ihn in seiner `custom.css`
zurück.

---

## 2.24.0

### Behoben: Eine Klasse des Regie-Decks hieß das Gegenteil von dem, was sie tut

`avd-academy-regie__handlung` heißt jetzt **`avd-academy-regie__material`**.

Die Vorlage, aus der der Baustein entstand, nennt die Klasse `.r--hand` – kurz für
**„zur Hand"**, also die **rechte** Spalte mit den Verweisen aufs Material. Beim Übertragen
wurde daraus „Handlung" gelesen und benannt. Das CSS tat von Anfang an das Richtige, aber
der Name sagte das Gegenteil, und die Dokumentation beschrieb damit die falsche Spalte
(„die linke Spalte: was zu tun ist").

**Die Handlungs-Spalte braucht gar keine Klasse.** Sie ist negativ selektiert – Handlung
ist, was nicht Material ist. Das ist nicht nur kürzer, es ist robuster: Eine Klasse, die
man setzen müsste, kann man vergessen; diese hier nicht.

### Warum das trotz Umbenennung Minor ist

Nach den Regeln in `AGENTS.md` ist eine umbenannte Klasse **Major**. Diese Regel schützt
Konsumenten – und hier gibt es nachweislich keine: Der Name stammt aus 2.23.0, veröffentlicht
eine knappe Stunde zuvor, und **kein einziges Repo** verwendet die Regie-Klassen bisher
(geprüft über alle vier Schulungsrepos und den Playground). Das erste Deck wird gerade
umgestellt – auf den neuen Namen.

Ein Major-Sprung hätte jedes Repo auf eine neue Spanne gezwungen, um einen Namen zu
reparieren, den noch niemand tippen konnte. Die Umbenennung steht trotzdem hier und im
Markup Contract als Entfernung – wer später sucht, findet sie.

---

## 2.23.0

### Neu: Regie-Deck – Folien zum Bedienen, nicht zum Zeigen

Ein Foliensatz, der **während** der Durchführung bedient wird: eine Folie je Einheit, oben
die Uhrzeit, links die Handlung, rechts die Verweise aufs Material, höchstens eine Falle.
Bewusst Text und Liste statt Bild – das ist kein Lehrmedium, sondern ein Spickzettel im
Blätterformat.

Dreizehn Klassen unter `avd-academy-regie__*`, dokumentiert unter
[Layouts → Regie-Deck](https://timetoact.ghe.com/pages/AVD-Academy-Tools/academy-theme/docs/theme/layouts.html#regie-deck).

**Warum das ins Theme gehört.** Die Form entstand in einem Schulungsrepo
(`training-concept-api-engineering`, A-006) als **92 Zeilen CSS im Seitenkopf**. Das trug,
solange es zwei Seiten waren. Sobald jedes Repo ein Regie-Deck führt, wären es dieselben
92 Zeilen in jedem – dieselbe Kopie-Drift, gegen die die Vorlagenversion überhaupt
existiert. Was in jedem Repo gleich aussieht, ist Design.

**Wann** man ein Regie-Deck schreibt und was daraufsteht, bleibt didaktisch und steht im
Didaktikon. Die Grenze verläuft wie immer: hier die Klassen, dort der Zweck.

**`:has()` statt einer Modifier-Klasse.** Die Inhaltsspalte einer Folie ist sonst kein
Flex-Container; das Deck braucht sie als solchen. Eine Klasse dafür müsste jede Folie
tragen und wäre genau das, was man vergisst – die Folie säße dann oben statt mittig, und
niemand wüsste warum.

**Die Klassen stehen im Markup Contract** – kuratiert, nicht per Scan: `theme/jekyll/`
pauschal mitzuscannen hätte 109 weitere Namen aufgenommen, fast alle interne
Layout-Klassen. Die Regie-Klassen sind Autorenfläche; sie stehen im Markdown eines
Schulungsrepos, in jeder Folie.

**Für Konsumenten:** rein ergänzend. Ein Deck, das seine Klassen weiter im Seitenkopf
definiert, läuft unverändert – die Namen kollidieren nicht (dort `.k`, `.r`, hier
`avd-academy-regie__*`).

---

## 2.22.0

### Neu: Zielgruppengefiltert bauen ist eine Komponente des Themes

Das Paket bringt ab sofort `jekyll/_bin/build.sh` mit – die Baukomponente, die eine
Site **einmal je Zielgruppe** baut und dabei alles entfernt, was nicht dorthin gehört.
Bisher trug jedes Repo dieses Skript als **Kopie**; bei jeder Korrektur musste die
Nummer im Kopf verglichen und die Kopie nachgezogen werden. Ab dieser Fassung kommt es
mit der gepinnten Theme-Version – lokal wie in der Pipeline dieselbe Datei.

```bash
sh theme/jekyll/_bin/build.sh «zielgruppe» «ausgabeordner» «baseurl»
```

**Die Komponente kennt keine Zielgruppe.** Das ist dieselbe Grenze wie beim Schema
(#130): Das Theme liefert den Mechanismus, die Werte gehören dem Werkzeug, das die Site
baut. Gelesen wird der neue Schlüssel `audience_filter` der `_config.yml`:

```yaml
audiences: [internal, public]     # die Deklaration, wie bisher

audience_filter:
  public:                         # NUR `public` bekommt eine gefilterte Ausgabe
    exclude_names: ['intern-*']   # Rückfall für Seiten ohne `audiences`
```

Wer in `audience_filter` steht, bekommt nur Seiten, die ihn in ihrem `audiences` nennen
oder gar keine Angabe tragen. Wer **nicht** darin steht, bekommt alles Publizierbare –
auch Seiten fremder Zielgruppe. Die Asymmetrie ist Absicht und gehört der Site:
„Material der einen Gruppe nicht an die andere“ gilt oft nur in eine Richtung.

**Geprüft wird ab jetzt auch im ungefilterten Build.** Ein Tippfehler im Front Matter
(`audiences: [publik]`) bricht jeden Build ab, nicht nur den gefilterten. Vorher meldete
ihn niemand, bis der gefilterte Build eine Seite verlor, die dorthin gehörte – und eine
Ausgabe, der eine Seite fehlt, sieht vollständig aus.

**`audience_filter` wird geprüft wie jede Zielgruppen-Angabe.** `validate.rb` vergleicht
seine Schlüssel mit `audiences`. Das war nötig, weil sie dort als **Schlüssel** stehen und
nicht als Werte: Der bisherige Durchlauf hätte sie nie zu Gesicht bekommen, und ein
Tippfehler wirkte still – die Regel griffe nie, die Ausgabe wäre ungefiltert statt
gefiltert.

**Der Ordner heißt `_bin`, mit Unterstrich.** Jekyll lässt Unterstrich-Einträge von sich
aus weg; das Skript landet also in keinem Bundle, ohne dass ein einziges Repo seine
`exclude`-Liste nachziehen muss. Das ist bewusst anders gelöst als bei der Werkstatt des
Fundaments (dort über `files` in der `package.json`, siehe 2.x/#67) – ein `exclude` hätte
hier nicht genügt, weil Jekyll die Liste **ersetzt** statt sie zu mergen und Repos mit
eigener Liste leer ausgingen.

**Für Konsumenten:** rein ergänzend. Wer weiter sein eigenes Build-Skript fährt, merkt
nichts. Wer umsteigt, ersetzt den Aufruf und löscht die Kopie – die Semantik ist
dieselbe, sofern die bisher fest verdrahtete Filterregel als `audience_filter` in die
`_config.yml` wandert.

---

## 2.21.1

### Behoben: Das Adressen-Plugin verschob Collection-Dokumente

**Wen es traf:** Jede Site mit einer Collection, die `output: true` und einen eigenen
`permalink` führt. Seit **2.18.0** landeten deren Dokumente unter der aus dem **Quellpfad**
abgeleiteten Adresse statt unter dem konfigurierten Muster:

```
2.17.0   /en/updates/3-1-0/index.html      der konfigurierte permalink
2.18.0   /en/_updates/3.1.0.html           aus dem Quellpfad
```

Die Verzeichnistiefe sank damit von drei auf zwei, und **jeder relative Verweis im
Dokument zeigte ins Leere** – gemeldet wurden 24 tote Verweise auf 16 Seiten, an Dateien,
die seit Wochen niemand angefasst hatte. Die Zahl der gebauten Seiten blieb gleich; es
waren nicht zusätzliche Seiten, sondern **andere Adressen**.

**Zwei Ursachen, beide nachgestellt:**

* Die Aktivierung hing an `data['slug']`. Bei Collection-Dokumenten setzt **Jekyll** den
  Schlüssel selbst, aus dem Dateinamen – eine Site mit Output-Collection erfüllte die
  Bedingung also, ohne dass je jemand `slug:` geschrieben hätte. Das Plugin lief dann für
  alle Seiten.
* Der Schutz prüfte `seite.data['permalink']`. Ein an der **Collection** konfigurierter
  `permalink` steht dort nicht – er wirkt über `doc.url`. Der Schutz griff nicht.

**Die Korrektur setzt an der Wurzel:** Das Plugin rührt nur noch Seiten an, deren Adresse
**noch niemand bestimmt hat** – deren `url` also genau die ist, die sich aus dem Quellpfad
ergibt. Alles andere gehört jemandem: einem `permalink` im Front Matter, einem an der
Collection, einer Vorgabe der Site. Damit sind Collection-Dokumente grundsätzlich außen
vor; ihre Adresse kommt aus ihrem Muster.

**Die Spur `.avd-addresses` nennt jetzt beide Zahlen** – `abgebildet` und `uebergangen`.
Steht dort eine Zahl bei `uebergangen` und ein Slug wirkt trotzdem nicht, ist das der erste
Ort zum Nachsehen.

**Neu: `bin/addresses-test.sh`** baut eine Fixture und rechnet fünf Lagen nach –
Collection-`permalink`, ausdrückliches `permalink`, Ordner-Slug, Seiten-Slug, Sprachbasis.
Ein Fehler, der Adressen verschiebt, ist mit blossem Hinsehen nicht zu finden; er braucht
eine Rechnung. Die Prüfung hängt in `make check` und in der Pipeline.

Dank an die Rückmeldung aus einem Konsumenten-Repo – der Bericht benannte beide Ursachen
und die Reproduktion mit.

---

## 2.21.0

### Geteilte Links bekommen eine Vorschau, Suchmaschinen eine kanonische Adresse

**Ohne Zutun und ohne `site.url`** entstehen jetzt `og:site_name`, `og:title`,
`og:description` und `og:type` – aus `title`, `description` und dem Layout (`article` bei
einem Guide, sonst `website`). Damit erscheint eine geteilte Adresse in Slack, Teams oder
LinkedIn als Karte statt als nackter Link, auch in einem Schulungs-Repo ohne absolute
Adresse. Das ist der häufigere Fall als die Suchmaschine.

**Ein Bild kommt nicht von selbst** – zwei neue Stellen dafür:

```yaml
# _config.yml – für die ganze Site
brand:
  og_image: /assets/academy-share.png
```

```yaml
# Front Matter – nur für diese Seite
image: /assets/kurs-http.png
```

Ohne beides entsteht **kein** `og:image`. Absicht: Ein Tag, das auf ein fehlendes Bild
zeigt, ist schlechter als keines – manche Dienste zeigen dann gar keine Karte mehr.

**Mit gesetztem `site.url`** kommen `<link rel="canonical">`, `og:url`, ein **absolutes**
`og:image` und eine **BreadcrumbList** als JSON-LD dazu.

<strong>Ohne `site.url` entsteht keines davon – mit Absicht.</strong> Wird dieselbe gebaute
Site unter mehreren Adressen ausgeliefert, kennt der Build die Adresse grundsätzlich nicht;
ein Canonical zeigte dann von der einen Instanz auf die andere. `absolute_url` steht
deshalb ausdrücklich **innerhalb** der Bedingung: Der Filter löst unter
`JEKYLL_ENV=production` `jekyll-github-metadata` aus, und das lässt auf GHE ohne
Repo-Namen den Build scheitern.

**Die BreadcrumbList wird aus der SICHTBAREN Brotkrume abgeleitet**, nicht zweitgerechnet.
Sie entsteht auf drei Wegen (`breadcrumb.ancestors`, das alte Array, automatisch aus der
Verzeichnisstruktur); alle drei zu verdoppeln hiesse, zwei Fassungen zu pflegen, die
auseinanderlaufen – und dann behauptete die Auszeichnung einen anderen Pfad, als der Leser
sieht.

**Keine eigenen Felder** für Titel, Beschreibung, `og:type` oder Canonical: Es gibt
`title` und `description`, der Typ folgt dem Layout, und die kanonische Adresse ist
berechenbar. Zwei Paare, die auseinanderlaufen können, sind schlechter als eines, das
stimmt.

### Schema und Doku werden gegeneinander geprüft

`bin/schema-docs.sh` vergleicht jede Eigenschaft beider Schemas gegen **beide**
Sprachfassungen der Doku. Der Anlass ist belegt: `slug` und `folder_slug` standen nach
ihrer Einführung nur in der deutschen Feldtabelle – auffallen konnte das niemandem, die
englische Seite baut ja. Die Prüfung fand beim Bau zwei weitere Lücken.

---

## 2.20.0

### Eine Seite trägt genau eine H1 – im Dokument, nicht nur in der Anzeige

Der Hero rendert den Titel; die erste `#`-Überschrift des Markdowns war eine **zweite,
wortgleiche** H1 und wurde per CSS versteckt. Versteckt heißt aber nur unsichtbar: Für
Screenreader und Crawler stand das doppelte Überschriften-Markup weiter da.

Sie fällt jetzt **aus dem DOM**, unter drei Bedingungen: Der Hero hat wirklich eine H1
gerendert, vor ihr steht nichts Sichtbares, und sie ist geschlossen. Ein HTML-Kommentar
davor zählt nicht als Inhalt – die Vorlagen beginnen mit einem, und ohne diese Nachsicht
bliebe genau dort die Dopplung stehen.

**Gemessen über die ganze Doku-Site:** jede Seite genau eine H1. Die Regeln
`.avd-academy-guide-main > h1:first-child { display: none }` und ihr Gegenstück in
`site.css` sind entfallen; die Lead-Auszeichnung des ersten Absatzes hängt jetzt an
`> p:first-child`, das es ohnehin schon gab.

Der Titel im Browser-Tab und im Hero kommt unverändert aus der ersten Überschrift, wenn
kein `title` im Front Matter steht – die Ableitung läuft vor dem Entfernen.

### Neues Feld `noindex`

```yaml
noindex: true
```

Setzt `<meta name="robots" content="noindex">`. Für Seiten, die öffentlich erreichbar und
trotzdem **ungelistet** sein sollen – ein Training nur für seine Teilnehmenden, eine
Fassung im Entwurf. Vorher gab es dafür keinen Weg: Das Front-Matter-Schema ist
geschlossen, eine Site kann das Tag nicht selbst setzen, und `robots.txt` wirkt je Pfad
statt je Seite.

Nur `noindex`, **kein** `nofollow`: Die Verweise der Seite dürfen weiter verfolgt werden,
sonst schnitte eine ungelistete Seite alles ab, was unter ihr hängt. Das Feld braucht
**kein** gesetztes `site.url` – es spricht über diese Seite, nicht über eine Adresse.

---

## 2.19.0

### Die Doku richtet sich an Theme-NUTZER

Sie trug bisher zwei Publika auf denselben Seiten: wer eine Unterlage schreibt, und wer das
Theme weiterentwickelt. Auf `academy.md` standen Autorenhinweise neben Begründungen für
Maintainer – 874 Zeilen „bewusste Abweichungen“, die niemand braucht, der eine Schulung
baut.

**Entfernt:** die Abweichungs-Begründungen, „Ein Feld ergänzen“ (Schema-Dateien des Themes
bearbeiten), „Komponenten als JSX“ und der Pflegehinweis. Was daran für Nutzer galt, ist
geblieben und an den passenden Ort gezogen:

| bleibt, als | Inhalt |
| --- | --- |
| **Academy-Theme** (417 statt 2257 Zeilen) | Anpassung: Schulungsfarbe, Logo, eigenes CSS, Tokens für Diagramme, Kontrast und Rhythmus, Dark-Mode, Drucklayout, Barrierefreiheit |
| **Layouts, Schalter und Bedienelemente** | die zwei Achsen, Schaltertabellen, QR-Code, Sprachumschalter, „Markdown kopieren“, Dropdowns, Fußbereich, Anker, Brotkrumen |
| **Bausteine** | der Katalog mit Markup |

### Ein eigenes Layout ist eine Anpassung, keine Theme-Änderung

Das Kapitel dazu war für Maintainer geschrieben – es wies auf `theme/jekyll/_layouts/`, das
bei jedem `make theme` überschrieben wird. Neu geschrieben für Konsumenten, mit der Hürde,
die dabei gemessen wurde:

**Jekyll kennt genau ein `layouts_dir` und keine Kette.** Zeigt es aufs Theme, wird ein
eigenes Layout daneben nicht gefunden; zeigt es auf einen eigenen Ordner, löst `layout:
page` nicht mehr auf und der Rahmen fehlt vollständig. Beides nachgestellt. Dokumentiert
ist deshalb der Weg, der trägt: eigener Ordner, Theme-Layouts beim Bauen hineinkopiert,
Kopien nicht eingecheckt.

Ebenfalls benannt: Die [Schalter](https://timetoact.ghe.com/pages/AVD-Academy-Tools/academy-theme/docs/theme/layouts.html#schalter)
kann ein eigenes Layout **nicht** mitbenutzen – welche Bausteine ein Layout tragen darf,
steht im Theme.

---

## 2.18.0

### Die Adresse kommt vom Ordner los: `folder_slug` und `slug`

Ein Pfad trug drei Aufgaben auf einmal – Ordnung für den Autor, öffentliche Adresse,
und bis 2.17.0 hing die Sprache mit daran. Die dritte hat `lang` übernommen, die zweite
nimmt ihm jetzt der Slug ab.

```yaml
# 03-http/index.md
folder_slug:
  de: http-grundlagen
  en: http-basics
```

Der Ordner heißt weiter `03-http` – die Nummer sortiert im Editor und taucht in der
Adresse nicht auf. **Ein schlichter Text genügt** und gilt für jede Sprache; eine
einsprachige Schulung schreibt `folder_slug: http-grundlagen` hin und braucht dafür weder
eine Sprachkarte noch eine `i18n`-Konfiguration. Gewählt wird nach der Sprache **der
Seite**: Eine englische Seite im selben Quellordner landet unter `/http-basics/…`, eine
deutsche unter `/http-grundlagen/…`.

**Zwei Schlüssel, weil es zwei Dinge sind.** `folder_slug` benennt den **Ordner** und
gehört ausschließlich in dessen `index.md`; `slug` benennt **eine Seite** und ist auf
einer Index-Seite nicht erlaubt. Deren Adresse *ist* der Ordner – ein `slug` dort schöbe
die Datei aus ihm heraus, der Ordner hätte danach keine Index-Datei mehr und `/kapitel/`
liefe ins Leere. Die Schema-Prüfung weist beide Verwechslungen mit einer Meldung zurück,
die den gemeinten Schlüssel nennt.

**Die Rangfolge ist vollständig:** Sprache der Seite → Angabe für alle Sprachen →
Standardsprache → unveränderter Name. Kein „irgendein Eintrag aus der Karte“ – das gäbe
einer dritten Sprache stillschweigend die englische Adresse, je nach Schreibreihenfolge.

**Im Nebeneinander-Layout darf jede Index-Datei den Ordner für ihre Sprache benennen**
(`index.md` deutsch, `index_en.md` englisch) statt einer Karte in einer der beiden. Zwei
Angaben zur selben Sprache mit verschiedenem Wert brechen den Build ab – sonst entschiede
die Lesereihenfolge, und die unterlegene Angabe verschwände spurlos.

**Verweise brechen dabei nicht.** `jekyll-relative-links` löst
`[Text](../03-http/einstieg.md)` gegen die **URL des Ziels** auf, nicht gegen dessen
Pfad – wird die Adresse verbogen, folgt der Verweis mit. Der Link bleibt im
Markdown-Editor klickbar; das war die Bedingung.

**Zwei Dinge brechen den Build ab**, beide mit Absicht laut: zwei Seiten auf derselben
Adresse (Jekyll schriebe beide, die zweite gewänne, die erste wäre spurlos weg – im
grünen Build), und ein `folder_slug` auf der Wurzel eines Sprachbaums (aus diesem Pfadstück
liest das Theme die Sprache jeder Seite ohne `lang`).

### Zwei Sprachfassungen dürfen in einem Ordner liegen

Damit das trägt, kommen zwei Regeln dazu, die beide nichts mit `slug` zu tun haben:

* **Ein Anhängsel `_«code»` im Dateinamen ist keine Adresse.** `responsive.md` gibt es
  deutsch und englisch – als Datei nur einmal je Ordner. Die englische heißt
  `responsive_en.md`; für die URL zählt der Name davor. Ein Ordner-Index in der zweiten
  Sprache heißt entsprechend `index_«code».md` und gilt weiter als Index.
* **Der Sprachbaum kommt aus `lang`, nicht aus dem Ordner.** Lag die englische Fassung
  unter `en/`, kam `/en/` aus dem Pfad; liegt sie neben der deutschen, setzt das Theme
  den Präfix aus der Sprache der Seite. Steht er schon im Pfad, bleibt es dabei – die
  Ablage in Sprachbäumen trägt unverändert weiter, auch **neben** der neuen in derselben
  Site.

**Diese Doku-Site macht es selbst so.** Den Ordner `en/` gibt es dort nicht mehr; jede
englische Seite liegt neben ihrer deutschen Fassung. Nachgemessen am Verzeichnis aller
gebauten Adressen: **keine einzige öffentliche Adresse hat sich geändert.**

### Die Doku ist aufgeteilt, die Migrationsseite entfallen

`academy.md` trug 2257 Zeilen – 41 % der deutschen Doku, mit einem einzigen Abschnitt von
874 Zeilen und 27 Unterüberschriften darin. Sie ist jetzt drei Seiten:

| Seite | Inhalt |
| --- | --- |
| **Academy-Theme** | Namensraum, die bewussten Abweichungen von der Marke, Customizations, Dark-Mode |
| **Bausteine** | Karten, Callouts, gruppierte Tabellen, Dokumentlinks, Materialübersicht, Reveal, Fold, Buttons, Badges, Syntaxhervorhebung |
| **Layouts und Schalter** | Layouts und ihre Eigenschaften, Schaltertabellen, Sprungmarken, Brotkrumen |

Die Anker `#schalter`, `#layout-eigenschaften` und `#anker` liegen damit auf der
Layout-Seite; alle vierzehn Verweise darauf sind nachgezogen. Gefunden hat sie die
Verweisprüfung – sie prüft Anker, nicht nur Adressen.

**Die Seite „Migration auf 2.0“ ist entfallen.** Theme 1 ist abgelöst und soll nicht mehr
verwendet werden. Wer wirklich noch dort steht, findet das Werkzeug unverändert unter
`bin/migrate.rb`.

### Eindeutig ist die ganze Adresse, nicht der einzelne Name

Derselbe `slug` darf in verschiedenen Ordnern stehen; `index.md` und `index_en.md` im
selben Ordner tragen beide den Namen `index`. Was zählt, ist die **zusammengesetzte**
Adresse – und die unterscheidet sich schon durch den Ordnernamen je Sprache und das
Sprachpräfix. Deshalb braucht eine englische Fassung meist gar keinen eigenen `slug`.

Die Kehrseite: Eine Dopplung kann von **weit oben** kommen, wenn zwei Ordner denselben
`folder_slug` tragen. Die Abbruchmeldung nennt darum beide Quelldateien und weist
ausdrücklich auf die Ordner darüber hin.

### Eine Prüfung gegen das stille Versagen

Ein Plugin, das nicht lädt, wäre der teuerste Fehler dieses Themes: Die Slugs wirken
nicht, der Build bleibt **grün**, die Seiten stehen unter falschen Adressen. Das Plugin
legt deshalb beim Bauen eine Spur (`.avd-addresses` im Ausgabeverzeichnis), und die
Schema-Prüfung schlägt an, wenn eine Site sie bräuchte und nicht findet:

```
ruby theme/jekyll/schema/validate.rb --site _site
```

Gebraucht wird sie, sobald eine Seite `slug` oder `folder_slug` trägt **oder** ihre Sprache deklariert,
ohne im passenden Sprachbaum zu liegen. Geprüft wird die **Spur**, nicht das Ergebnis –
eine nachgerechnete Adresse wäre die Abbildungsregel ein zweites Mal. Mit
`--require-site` ist eine fehlende Site ein Fehler statt eines Hinweises; so steht sie in
der Pipeline hinter dem Build.

### `avd-seitensprache.html` heißt jetzt `avd-page-lang.html`

Im Theme sind **Dateinamen und alles, was ein Konsument sieht, englisch** – Includes,
Front-Matter-Schlüssel, CSS-Namen, Skripte; deutsch sind die Kommentare und die internen
Methodennamen der Ruby-Werkzeuge. Der in 2.17.0 eingeführte Include fiel aus der Reihe
und ist umbenannt, bevor der Name sich festsetzt. Das neue Plugin heißt aus demselben
Grund `avd-addresses.rb` und legt seine Spur als `.avd-addresses`.

**Zu tun ist nichts**, solange kein eigenes Layout den Include direkt einbindet – er
beantwortet eine Frage, die das Theme intern stellt. Wer ihn doch aufruft, ändert den
Namen mit.

### Das Theme bringt erstmals ein Jekyll-Plugin mit

Die Zuordnung macht `theme/jekyll/_plugins/avd-addresses.rb`, geladen über `plugins_dir`
aus `_config.defaults.yml`. Der eigene `_plugins`-Ordner eines Repos bleibt daneben
bestehen – die Array-Form ist geprüft.

<strong>Wer sein `Gemfile` selbst pflegt, prüft eine Sache:</strong> Das `github-pages`-Gem
erzwingt Jekylls Safe-Modus und übergeht jeden Plugin-Ordner **stillschweigend** – der
Build bleibt grün, die Slugs wirken einfach nicht. Die Kopiervorlage der Konzept-Repos
baut ohnehin mit `jekyll` plus `jekyll-optional-front-matter` und
`jekyll-relative-links`; die Doku-Site dieses Repos ist mit diesem Release genauso
umgestellt.

**Warum überhaupt ein Plugin.** `permalink` je Seite kann Jekyll von Haus aus – dann
stünde die Zuordnung aber n-mal statt einmal, und wer einen Ordner umbenennt, müsste
jede Seite darin anfassen. Genau das beendet der Slug.

**Ohne eine einzige Slug-Angabe ändert sich nichts.** Der Generator bricht nach dem
Einsammeln ab und rührt keine Seite an.

Doku: [Adressen](https://timetoact.ghe.com/pages/AVD-Academy-Tools/academy-theme/docs/theme/adressen.html).

---

## 2.17.0

### Die Sprache steht im Front Matter, nicht nur im Ordnernamen

Bisher entschied **allein der Ordner**, welche Sprache eine Seite spricht: Was unter
`/en/` lag, war englisch. Das trägt ganze Bäume gut – aber nur ganze Bäume. Ein einzelnes
übersetztes Kapitel tief in einer deutschen Unterlage oder eine Sammlung, deren Dokumente
ohnehin flach nebeneinanderliegen, ließen sich so nicht paaren.

**Neu:** `lang` im Front Matter bestimmt die Seitensprache **vorrangig**.

```yaml
page_id: modul-tcp-ip
lang: en          # gilt, egal in welchem Ordner die Datei liegt
```

Damit ändert sich, wie der Umschalter das Gegenstück sucht – in zwei Schritten:

1. **Über die ganze Site**: Gibt es irgendwo eine Seite mit derselben `page_id` und der
   gesuchten Sprache, ist das die Übersetzung. Der Pfad spielt keine Rolle.
2. **Erst wenn dort nichts liegt**, wird wie bisher im Sprachbaum (`/en/…`) gesucht.

Zwei Dateien im **selben** Ordner, gleiche `page_id`, verschiedenes `lang` – der
Umschalter findet sie jetzt in beide Richtungen, mit richtigem `<html lang>` und
gegenseitigem `hreflang`.

**Für bestehende Sites ändert sich nichts.** Seiten ohne `lang` werden weiter über ihren
Ordner eingeordnet; Schritt 2 ist genau das bisherige Verhalten. Die Prüfung zählt auf
mehrsprachigen Sites die Seiten ohne `lang` und nennt sie als **Hinweis** – in einer
Zeile, nicht je Seite – ohne den Lauf abzubrechen. Gemahnt werden nur Dateien **mit**
Front Matter: Eine `.html` ohne Front Matter rendert Jekyll nicht, sondern kopiert sie
durch; für sie löst das Theme nie eine Sprache auf, und ein `lang:` bliebe wirkungslos.

Die Regel „wie bestimmt sich die Sprache einer Seite“ steckt jetzt an **einer** Stelle
(`avd-seitensprache.html`) statt verstreut; sie gilt für die gerenderte Seite ebenso wie
für jedes Verweisziel. In `avd-page-url.html` ist sie aus gemessenen Gründen eingesetzt
statt eingebunden – der Include verdoppelte dort die Bauzeit (4,7 s → 9,5 s); der
Kommentar an beiden Stellen hält das fest.

Doku: [Mehrsprachigkeit → Die Sprache einer Seite](https://timetoact.ghe.com/pages/AVD-Academy-Tools/academy-theme/docs/theme/mehrsprachigkeit.html#seitensprache).

---

## 2.16.0

### Rohe Nachrichten werden hervorgehoben: `http`, `json`, `xml`

Gemeldet aus einem Schulungs-Repo (dort A-013). Eine Akademie mit API- und
Web-Schulungen zeigt **rohe Nachrichten** in jeder zweiten Unterlage; ohne
Hervorhebung blieb nur die Wahl zwischen unleserlich und *je Repo neu gebaut*. Genau
Letzteres war dort passiert: rund 60 Zeilen eigenes JavaScript und 13 Farbregeln.

Das Grammatik-Set des Themes umfasst jetzt **vier** Sprachen statt einer – gemessen
**3 604 Bytes** zusätzlich auf 20 KB Core:

| Grammatik | minifiziert |
| --------- | ----------- |
| `http` | 909 B |
| `json` | 689 B |
| `xml` | 1 992 B |

Ein Codeblock mit der Sprache `http` trägt jetzt Farben – Startzeile, Kopfzeilen und
Rumpf.

**Der Rumpf wird automatisch mitgefärbt.** `http` erkennt JSON und XML selbst, sobald
die beiden registriert sind – im gebauten Beispiel trägt der Rumpf die
`language-json`-Klasse, ohne dass irgendwo etwas angegeben wurde.

### Die eine eigene Zutat: Statuscode nach Klasse

highlight.js gibt **jedem** dreistelligen Code dieselbe Klasse `hljs-number`. In einem
Mitschnitt ist das aber die Stelle, auf die man zuerst sieht: 201 ist etwas anderes als
404. Ein kurzes Skript hängt darum `avd-academy-http-status--2xx` … `--5xx` an, und
`highlight.css` färbt danach.

Die Farben kommen aus den **Vordergrundfassungen** und nicht als feste Hexwerte: Die
Codeblock-Fläche kippt mit dem Farbschema (`#EDEDED` hell, `#24332F` dunkel), ein fester
Wert könnte also nicht beides tragen. Gemessen auf der Codeblock-Fläche **4,56–9,38:1**
in beiden Schemata.

Dafür wurde die `-ink`-Kategorie vervollständigt: **`--avd-academy-color-success-ink`**
und **`--avd-academy-color-warning-ink`** fehlten noch. 4xx und 5xx teilen sich die
Farbe – beide sind „Fehler“, welcher, sagt die Zahl selbst.

### Was `http` nicht kann – gemessen, nicht vermutet

Die Grammatik ist streng (`illegal: /\S/`). Gegen die vier realen Formen des meldenden
Repos geprüft:

| Fall | Ergebnis |
| ---- | -------- |
| `HTTP/1.1 201` mit JSON-Rumpf | vollständig gefärbt, Rumpf automatisch mit |
| Anfrage (`GET … HTTP/1.1`) | vollständig gefärbt |
| HTTP/2 (`:status = 200`) | **gar keine Hervorhebung** |
| gRPC-Mitschnitt (DATA/TRAILERS) | **gar keine Hervorhebung** |

Diese beiden bleiben beim Repo. Ein Format, das sich nicht normieren lässt – gRPC-Frames
mit Bytelegende –, gehört nicht ins Theme; die Doku hält ausdrücklich fest, dass ein
eigener Hervorheber **in einer Visualisierung** zulässig ist.

### Nebenbefund: verschachtelte Code-Umzäunungen zerreissen die Verweise

Der erste Entwurf dieser Doku zeigte das Markdown-Beispiel in einer **vierfachen**
Umzäunung mit einer dreifachen darin – die naheliegende Art, einen Codeblock zu zeigen.
kramdown verarbeitet das fehlerhaft: Der gebauten **englischen** Seite fehlten danach
18 KB, und `links.rb` meldete **14** Sprachbaum-Befunde, ausgelöst von einer Änderung an
der **deutschen** Datei.

Gefunden wurde es durch Halbierung gegen einen sauber gebauten `main` – `make check` baut
**nicht** neu, und ein Lauf gegen ein altes `_site` hätte die Ursache verdeckt. Wer ein
Markdown-Beispiel zeigen will, nimmt eine andere Form als die verschachtelte Umzäunung.

### Einstufung

**Minor.** Drei neue Dateien im Paket, zwei neue Tokens, vier neue Klassen – alles rein
ergänzend. Wer `syntax_highlight` nicht setzt, lädt weiterhin nichts; wer es setzt,
bekommt drei Sprachen mehr und für `java` unverändertes Verhalten.

---

## 2.15.2

### Die Kontrastprüfung übersprang Seiten still, die `</body>` im Text führen

Die Sonde wurde vor das **erste** `</body>` gesetzt. Eine Seite darf das aber im Text
führen – etwa ein HTML-Codebeispiel in einem JavaScript-String. Dort eingefügt landet die
Sonde **innerhalb** des Strings, läuft nie, und die Seite wird **still** übergangen.

Gefunden an einer echten Visualisierung eines Schulungs-Repos: zwei Seiten ohne Antwort
bei sonst sauberem Lauf. Gemeldet hat es die eigene „Sonde ohne Antwort“-Warnung – ohne
sie wäre die Seite als geprüft durchgegangen.

Die Sonde steht jetzt vor dem **letzten** `</body>`. Der Selbsttest führt dafür eine Seite,
die `</body>` in einem Skript-String enthält.

### Richtigstellung zur Tabelle in 2.13.0

Dort stand eine dritte Zeile `#7A3FB0` mit 2,52:1 im Dark-Theme, als wäre sie die Farbe
eines dritten Schulungs-Repos. **Das war falsch.** Der Wert stammte aus einem
Streuungstest über erfundene Farben und ist nie in einem Repo verwendet worden;
tatsächlich nutzen **zwei** der drei Repos dieselbe Farbe `#0E7C66`.

Die Aussage darüber bleibt richtig – jedes der drei Repos lag in einem der beiden Modi
unter AA –, aber es sind zwei Farben und nicht drei. Die Tabelle ist korrigiert.

### Einstufung

**Patch.** Eine Korrektur an einer Prüfung, die Seiten still übersprang, plus eine
Richtigstellung im CHANGELOG. Kein Token, keine Klasse, kein Pfad, kein Verhalten der
ausgelieferten Seiten ändert sich.

---

## 2.15.1

### Klarstellung: Fließtext-Links brauchen eine zweite Zeile

Die Doku zu `--avd-academy-accent-base` (2.13.0) war **falsch**. Dort stand, eine Zeile
genüge und „Akzent (Links, Hover, Icons, aktive Zustände)“ folge daraus.

**Links folgen nicht.** Sie hängen nicht am Academy-Akzent, sondern am **Fundament**:
`a { color: var(--color-link) }` in `theme/atvantage/tokens/base.css`, und das löst über
`--color-orange` auf `--avd-orange` auf. Ein Repo, das nur `--avd-academy-accent-base`
setzt, bekommt also **orange Links bei sonst durchgängiger Schulungsfarbe** – und weil
beide Farben für sich stimmig aussehen, fällt das beim Durchblättern nicht auf.

Aufgefallen beim Übernehmen in ein Schulungs-Repo: Die Kontrastprüfung meldete dort
weiterhin `#FF5401` auf Kartenflächen, obwohl der Akzent nachweislich abgeleitet war.

Richtig ist:

```css
:root {
  --avd-academy-accent-base: #0198FF;
  --avd-orange: var(--avd-academy-color-accent);
}
```

Die zweite Zeile trägt **keine** eigene Farbe – sie hängt das Fundament an den bereits
abgeleiteten Akzent. Von Hand gepflegt wird weiterhin genau ein Wert.

**Warum das Theme es nicht selbst tut:** `--avd-orange` innerhalb der Academy-Schicht auf
einen Ausdruck zu setzen, der wieder `--avd-orange` als Rückfall liest, wäre ein Zyklus –
CSS erklärt dann beide Eigenschaften für ungültig. Ein Schnappschuss in ein Zwischentoken
hilft nicht, er erzeugt denselben Zyklus. Die Zeile gehört deshalb dorthin, wo die
Entscheidung fällt: in die Customization des Repos.

Nach der Korrektur meldet die Kontrastprüfung im betroffenen Repo über beide Schemata
**keine Paarung unter der Schwelle** – vorher lag dessen Akzent auf Weiß bei 3,03:1.

### Einstufung

**Patch.** Nur Doku und CHANGELOG; kein Token, keine Klasse, kein Verhalten ändert sich.
Die Korrektur beschreibt, was seit 2.13.0 gilt.

---

## 2.15.0

### Beide Inhaltsspalten haben jetzt denselben Rhythmus

Gemeldet aus einem Schulungs-Repo (dort A-002). Das Theme führte für seine beiden
Inhaltsspalten zwei verschiedene Systeme:

- Die **gewöhnliche Seite** hat eine Hierarchie – Abstand vor einem Abschnitt, kleiner
  Abstand zwischen Blöcken, und fast keiner **nach** einer Überschrift.
- Die **Guide-Spalte** war ein Flex-Container mit `gap: 3.5rem`. Ein `gap` behandelt alle
  Blöcke gleich; eine Überschrift bekommt nach oben denselben Abstand wie nach unten und
  lässt sich nicht an ihren Abschnitt binden.

**An einer echten Guide-Seite gemessen** – der Seiteninhalt läuft unverändert in die
Spalte, die direkten Kinder sind also die einzelnen Markdown-Blöcke:

| Übergang | vorher | nachher |
| -------- | ------ | ------- |
| Absatz → Überschrift | 56 px | **44 px** |
| Überschrift → ihr erster Absatz | **60 px** | **18 px** |
| Überschrift → Überschrift | **84 px** | **28 px** |
| Absatz → Liste | 76 px | **20 px** |

60 px zwischen einer Überschrift und ihrem eigenen Text – sie gehörte optisch zu nichts.

**Neu sind drei Tokens, die beide Spalten lesen:**

```css
--avd-academy-rhythm-block:   1.1rem;   /* zwischen zwei Blöcken */
--avd-academy-rhythm-section: 2.75rem;  /* vor einer Abschnitts-Überschrift */
--avd-academy-rhythm-heading: 0.25rem;  /* NACH einer Überschrift */
```

Die Guide-Spalte steht dafür auf `display: block` statt `flex`. Ausdrücklich `block` und
nicht `unset`: `display` erbt nicht, `unset` wäre `initial` und damit `inline`.

Listen trugen `margin: 0`, weil den Abstand vorher der `gap` machte; ohne ihn bringen sie
ihn selbst mit. Die Maße stehen in den **bestehenden** `h2`/`h3`-Regeln statt in neuen
`> h2`-Regeln daneben – gleiche Spezifität, und die späteren gewinnen. Beim ersten Anlauf
ist genau das passiert: Die Abschnittsabstände waren gemessen **0 px**.

**Was sich sichtbar ändert:** Jede Unterlage in jedem Repo wird kompakter, und
Überschriften stehen bei ihrem Text. Das ist die deutlichste Änderung dieser Reihe.

**Nicht übernommen** wurde aus der Meldung die dortige Überschreibung von
`--paragraph-spacing` (20px → 1.5rem). Das ist ein Token des ATVANTAGE-Fundaments und
speist **jeden** Absatz der Site, nicht nur die Guide-Spalte – eine eigene Entscheidung,
die nicht in diese gehört.

### Einstufung

**Minor.** Drei neue Tokens; kein Token entfernt oder umbenannt, keine Klasse, kein Pfad.
Es ändern sich Werte mit sichtbarer Wirkung auf bestehende Seiten – dieselbe Einstufung
wie 2.6.0, 2.7.0, 2.9.0 und 2.12.0.

---

## 2.14.0

### Die Wortmarke kann die Schulungsfarbe tragen

Gemeldet aus einem Schulungs-Repo (dort A-003). Die Vorgabe verlangt von jedem Repo ein
eigenes Logo **und** eine eigene Akzentfarbe – zusammenbringen liessen sie sich nicht:
Ein `<img>` lädt sein SVG als **eigenes Dokument**, und dort sind weder die Tokens der
Seite noch `currentColor` noch `data-avd-academy-theme` sichtbar.

Neu: `brand.logo_ratio` in der `_config.yml`. Ist es gesetzt, färbt das Theme die
Wortmarke in `--avd-academy-color-accent` – und folgt damit auch der Ableitung aus
2.13.0, ohne dass die Farbe ein zweites Mal gepflegt wird.

```yaml
brand:
  logo: /assets/logo-schulung.svg
  logo_ratio: 260 / 24        # exakt die viewBox der SVG-Datei
```

**Warum nicht inline.** Der naheliegende Weg – das SVG inline rendern, dann genügt
`fill: currentColor` – ist in diesem Aufbau verbaut: `includes_dir` zeigt bei jedem Repo
in das Theme-Verzeichnis, ein Repo kann also keinen eigenen Include beisteuern, und eine
beliebige Datei zur Bauzeit einzulesen bräuchte ein Jekyll-Plugin. Das Paket bleibt
abhängigkeitsfrei.

**Warum ein eigenes Element und nicht das Bild.** Der gemeldete Workaround setzt
`content: ""` auf das `<img>` und legt eine Maske darüber. **Gemessen trägt das nicht** –
weder `content: ""` noch `content: none` noch `-webkit-mask` entfernen den Bildinhalt in
aktuellem Chrome; das Original malt über die eingefärbte Fläche. Auf einem nicht
ersetzten Element trägt die Maske. Das Theme gibt die eingefärbte Fassung deshalb als
`<span>` **neben** dem Bild aus.

**Der Rückfall ist der Normalfall.** Der `<span>` ist voreingestellt unsichtbar und das
`<img>` sichtbar; erst innerhalb von `@supports` tauschen sie. Kann eine Engine keine
Masken, bleibt es beim unveränderten Bild – ein fehlendes Logo sieht man nicht im Build,
sondern beim Kunden.

**Der Preis, ausdrücklich benannt:** Ein maskiertes Element hat keine Eigengröße, deshalb
muss das Verhältnis von aussen kommen. Es steht jetzt als Datum neben dem Logo-Pfad statt
als Zahlenpaar in einer Style-Datei – aber **ändert sich die `viewBox`, muss `logo_ratio`
mit**, sonst wird die Marke verzerrt.

### Einstufung

**Minor.** Ein neues, optionales Feld und eine neue Klasse
(`avd-academy-header__logo-mask`). Ohne `brand.logo_ratio` ändert sich nichts: Die
Kopfzeile rendert unverändert ein `<img>`.

---

## 2.13.0

### Die Schulungsfarbe kommt jetzt aus **einem** Wert

Gemeldet aus einem Schulungs-Repo (Register A-001 dort). Die Vorgabe liess jedes Repo
**vier** Farbwerte von Hand pflegen – Akzent und Hero-Band, je für Light und Dark, den
Dark-Wert doppelt (Attribut- und `prefers-color-scheme`-Block). Dort ist genau das
passiert, was dabei passieren muss: Ein Wert wurde geändert und drei nicht, und die
Unterlage trug **Blau im Light- und Grün im Dark-Modus**. Der Build zeigt immer nur einen
Modus, also meldet ihn nichts.

**Beim Nachmessen kam Schlimmeres heraus.** Von den drei frei gewählten Schulungsfarben
lag **jede** in einem der beiden Modi unter AA, ohne dass es irgendjemand wusste:

| Basis | roh, Light | roh, Dark | abgeleitet, Light | abgeleitet, Dark |
| ----- | ---------- | --------- | ----------------- | ---------------- |
| `#0198FF` | **3,03:1** | 5,52:1 | **5,38:1** | **7,54:1** |
| `#0E7C66` | 5,13:1 | **3,26:1** | **6,10:1** | **7,33:1** |

<!-- Korrektur (2.15.2): Hier stand ursprünglich eine dritte Zeile `#7A3FB0` mit
     2,52:1 im Dark-Theme, als wäre sie die Farbe eines dritten Repos. Das war
     falsch: Der Wert stammte aus einem Streuungstest über erfundene Farben und
     ist nie in einem Repo verwendet worden. Tatsächlich nutzen zwei der drei
     Repos dieselbe Farbe `#0E7C66`. Die Aussage darüber bleibt richtig – jedes
     der drei Repos lag in einem der beiden Modi unter AA –, aber es sind zwei
     Farben und nicht drei. -->

Neu: `--avd-academy-accent-base`. Ein Repo setzt **eine Zeile** –

```css
:root { --avd-academy-accent-base: #0198FF; }
```

– und Akzent wie Hero-Band folgen in **beiden** Schemata. Angegeben wird der **Farbton**,
die **Helligkeit** kommt aus `--avd-academy-color-ink` bzw. `-bg`; weil die mit dem
Farbschema kippen, fallen Light und Dark aus derselben Formel und der Kontrast hängt an
der Konstruktion statt am Zufall.

**Ohne das Token ändert sich nichts.** Akzent und Hero-Band stehen auf
`var(--…-from-base, «bisher»)`: Der Rückfall greift, solange keine Basis gesetzt ist.
Repos, die heute `--avd-orange` überschreiben, bleiben ebenfalls unberührt.

**Die ATVANTAGE-Marke wird ausdrücklich nicht abgeleitet.** Auf das Orange angewandt macht
die Formel es *schlechter* (5,19 → 4,18:1 im Dark) und zu reinem Rot – der Farbwinkel
verträgt den Buntheits-Anschlag nicht.

**Die Regel, die man nicht sieht,** steht in der Doku und damit auch im Plugin: Wer neben
der Basis einen `[data-avd-academy-theme="dark"]`- oder `prefers-color-scheme`-Block für
diese Farben schreibt, **hebelt die Ableitung aus** – ein solcher Block gewinnt gegen die
Formel und friert einen Modus auf einen Handwert ein.

Technisch zwei Schritte, weil eine relative Farbe nur **eine** Ursprungsfarbe hat, hier
aber zwei Quellen gebraucht werden: `color-mix(in oklab, …)` setzt die modusrichtige
Helligkeit und nimmt dabei Buntheit (die Textfarbe ist fast neutral), `oklch(from …)
calc(c * 3)` dreht sie wieder auf. `in oklab` und nicht `in oklch`, weil die polare
Mischung auch den Farbwinkel interpoliert und die Farbe Richtung Textfarbe zieht. Fehlt
einer Engine die relative Farbsyntax, bleibt es per `@supports` bei der rohen Basisfarbe –
dem Zustand, den die Repos heute ohnehin haben.

### Einstufung

**Minor.** Zwei neue Tokens, rein ergänzend; kein bestehendes Repo ändert sein Aussehen,
solange es `--avd-academy-accent-base` nicht setzt.

---

## 2.12.2

### Drei tote Verweise – in jedem Schulungs-Repo, nicht hier

Gefunden beim Aufnehmen der Verweisprüfung in die Pipeline eines Schulungs-Repos. Dort
meldete `links.rb` drei Befunde, alle auf **einer** Seite: `/theme/CHANGELOG.html`.

`theme/CHANGELOG.md` liegt im npm-Paket (bewusst – es wird mit ausgeliefert und dem
Release beigelegt). Projekte laden das Paket **unterhalb ihrer Jekyll-Source** nach
`theme/`, und Jekyll rendert jede `.md` darunter zu einer Seite. Drei Einträge in diesem
CHANGELOG verwiesen relativ auf die Doku **dieses** Repos:

```
../docs/verwendung/einbindung.md#mehr-host
../github-pages/#verweise-pruefen
../docs/theme/mehrsprachigkeit.md
```

Im eigenen Repo zeigen die ins Ziel. In einem Schulungs-Repo gibt es weder `docs/` noch
`github-pages/` – dort waren es drei tote Verweise, und zwar **in jedem** Repo, das das
Paket bezieht.

**Genau der blinde Fleck, vor dem der Kopf von `links.rb` selbst warnt:** Im eigenen
Repo ist jeder Verweis heil, also entsteht der interessante Fall dort nicht. Diesmal war
es kein fehlender Selbsttest – der Fall lässt sich im eigenen Repo gar nicht erzeugen,
weil er erst durch das **Ausliefern** entsteht.

**Behoben:** Die drei Verweise sind absolut auf dieses Repo umgestellt, wie es die
übrigen Verweise im CHANGELOG ohnehin halten. `theme/README.md` ist gegengeprüft: Sein
einziger relativer Verweis (`jekyll/starter/`) ist **paket**relativ und löst in einer
Consumer-Site richtig auf.

**Für Projekte:** Nach dem Update meldet die Verweisprüfung diese drei Befunde nicht
mehr. Wer sie vorher schon in der Pipeline hatte, konnte sie nur mit `--ignore /theme/`
umgehen – was weiterhin sinnvoll ist, denn die Seiten des Themes gehören nicht dem Repo,
das sie ausliefert.

### Einstufung

**Patch.** Drei Verweise in einer Doku-Datei. Kein Token, keine Klasse, kein Pfad, kein
Verhalten ändert sich.

---

## 2.12.1

### Die Kontrastprüfung erfand Befunde, wo eine Fläche durchscheinend war

Aufgefallen beim ersten Einsatz in einem **fremden** Repo. Dort meldete
`theme/jekyll/contrast.rb` sechs Gruppen mit Werten um 1,07:1 – Text auf einer Fläche
`#6B6B6B`. Diese Fläche gibt es dort gar nicht: Die Regel lautet
`background: color-mix(in oklab, var(--avd-academy-color-bg-subtle) 45%, transparent)`,
und `#EDEDED` bei 45 % **über Schwarz gemessen** ergibt genau `#6B6B6B`.

**Zwei Fehler, einer hinter dem anderen.**

1. **Die Deckkraft wurde geraten statt gemessen.** Die Sonde las den Alpha-Wert per
   regulärem Ausdruck aus `rgba(…)`. Chrome gibt für `color-mix(…, transparent)` aber
   `color(srgb r g b / 0.45)` zurück – der Ausdruck griff nicht, die Fläche galt als
   deckend und wurde über dem schwarzen Canvas-Grund gemessen. Jetzt wird die Farbe
   über **zwei** Gründe gemessen, schwarz und weiß: Stimmen beide überein, ist sie
   deckend; weichen sie ab, ist sie durchscheinend. Das ist unabhängig von der
   Schreibweise.

2. **Durchscheinende Schichten wurden übersprungen statt aufgetragen.** Die Sonde
   griff zum ersten deckenden Vorfahren durch. Das ist eine Näherung, und sie ist
   falsch: Eine helle 45-%-Tönung über dunklem Grund ergibt eine mitteldunkle Fläche,
   und genau darauf steht der Text. Jetzt wird der deckende Grund gemalt und die
   durchscheinenden Schichten von außen nach innen darübergelegt – so, wie es der
   Browser tut.

**Warum das mehr ist als ein Rechenfehler.** Ein Prüfer, der verlässlich Fehlalarme
liefert, wird weggeklickt und schützt dann gar nichts mehr. Genau mit dieser Begründung
steht die Prüfung nicht in `make check`; ein Werkzeug, das beim ersten Einsatz in einem
fremden Repo sechs Gruppen erfindet, hätte sie bestätigt.

**Der Selbsttest deckt den Fall jetzt ab** – eine durchscheinende Fläche über dem
Seitengrund, die in **beiden** Schemata trägt und deshalb **kein** Befund sein darf.

### Zwei echte Befunde, die der korrigierte Prüfer sofort fand

In der Simulations-Vorlage standen zwei weitere fest weiße Flächen – als
`rgba(255, 255, 255, …)` geschrieben und deshalb von der `#fff`-Suche in 2.9.0 nicht
erfasst:

| Regel | Dark-Theme, vorher |
| ----- | ------------------ |
| `.stage-info` (`rgba(255,255,255,0.94)`) | **1,05:1** |
| `.vgrid .cell` (`rgba(255,255,255,0.6)`) | **2,01:1** |

Beide nehmen jetzt `color-mix(in srgb, var(--ci-bg) …%, transparent)` – dieselbe
Deckkraft, aber theme-fähig. `.voverlay` bleibt unverändert: feste dunkle Fläche mit
fester weißer Schrift, in beiden Schemata richtig.

Danach meldet der Prüfer im eigenen Repo wieder **19 Gruppen**, und alle 19 sind die
offene Markenfrage.

### Einstufung

**Patch.** Eine Korrektur an einer Prüfung, die Fehlalarme lieferte, plus zwei
Korrekturen an einer Vorlage, die nicht im npm-Paket liegt. Kein Token, keine Klasse,
kein Pfad ändert sich; für Autoren gibt es nichts Neues zu nutzen.

---

## 2.12.0

### Der Alarmton trug als Schrift nicht – gefunden vom eigenen neuen Werkzeug

**Der erste Lauf von `theme/jekyll/contrast.rb` (2.11.0) im eigenen Repo.** Zwei Regeln
in `components.css` setzen `--avd-academy-tone-alert` als **Schrift**:

- `.avd-academy-grouptable__group--tone-alert` – die Gruppenzelle einer Zeile außerhalb
  des Rasters färbt ihren Text im Signalton
- `.avd-academy-grouptable__alert td` – die Ankündigungszeile

Der Ton ist als **Fläche** gerechnet. Als Schrift kam er im Light-Theme auf **4,39:1**,
auf Kartenflächen auf **3,75:1** – beides unter AA für Kleintext, und die
Ankündigungszeile steht auf `--avd-academy-fs-sm`.

| | vorher | nachher |
| --- | --- | --- |
| Light, auf `color-bg` | 4,39:1 | **8,53:1** |
| Light, auf `color-bg-subtle` | 3,75:1 | **7,29:1** |
| Dark, auf `color-bg` | 6,62:1 | **9,99:1** |
| Dark, auf `color-bg-subtle` | 5,72:1 | **8,64:1** |

**Behoben** mit der `-ink`-Fassung aus 2.10.0: `--avd-academy-tone-alert-ink`. Die
**Linie** behält den vollen Ton – sie ist Fläche, nicht Schrift; das Signal bleibt also
genauso laut.

**Bemerkenswert am Zustandekommen.** Diese Regeln stehen seit Langem im Paket. Die
Rückmeldung, die zu 2.10.0 führte, beschrieb genau diese Fehlerklasse – „sobald ein Repo
eine Fehlermeldung **schreibt** statt sie zu umranden, gibt es kein Token, das trägt“ –
und hielt dabei fest, das Theme selbst benutze Danger **ausschließlich** als Rahmenfarbe.
Das stimmte nicht ganz, und niemandem ist es aufgefallen, auch beim Bauen der
`-ink`-Fassungen nicht. Gefunden hat es das Werkzeug, im ersten Lauf, ohne dass jemand
danach suchte.

Nach der Korrektur meldet es 19 statt 22 Gruppen. Die verbleibenden 19 sind ausnahmslos
die offene Markenfrage – der Akzent des Fundaments als Schrift auf hellen Flächen.

### Einstufung

**Minor.** Kein Token entfernt oder umbenannt, keine Klasse, kein Pfad; ein Farbwert mit
sichtbarer Wirkung auf bestehende Seiten – dieselbe Einstufung wie 2.6.0, 2.7.0 und 2.9.0.

**Was sich sichtbar ändert:** Der Text einer Alarm-Zeile in einer gruppierten Tabelle ist
gedämpfter als bisher. Die Linie darüber nicht.

---

## 2.11.0

### Neu: die Kontrastprüfung `theme/jekyll/contrast.rb`

Ein Farbwert wird gegen **einen** Untergrund entworfen und später vor **einen
anderen** gestellt. Nichts im Build wird davon rot: Das Schema ist zufrieden, die
Seite entsteht, der Text steht da – nur lesen kann ihn niemand.

Allein zwischen 2.6.0 und 2.10.0 hat diese Fehlerart **sechsmal** zugeschlagen.
**Zweimal entstand sie beim Beheben einer anderen.** Gefunden hat sie jedes Mal ein
Mensch, meist Wochen später und meist in fertigen Schulungsunterlagen. Das Repo prüft
Paketinhalt, Markup Contract, Schemas, JS-Haken, HTML-Attribute und tote Verweise –
für Farbe gab es nichts.

**Was sie tut.** Sie rendert jede Seite aus `_site` in **beiden** Farbschemata in
einem Headless-Browser, ermittelt für jedes Element mit eigenem Textknoten die
**tatsächlich wirksame** Fläche darunter und rechnet den Kontrast nach WCAG 2.1.
Gruppiert wird nach CSS-Herkunft, nicht nach Element – aus einer Regel sollen nicht
zweihundert Zeilen werden.

**Warum gegen das gebaute HTML.** Dieselbe Begründung wie bei `links.rb` und
`bin/js-hooks.sh`, hier aber noch zwingender: Kontrast ist eine Eigenschaft
gerenderter **Paare**. Welche Fläche wirklich unter einem Text liegt, steht in keiner
einzelnen CSS-Regel. Eine Prüfung über die Quellen hätte ihr Loch genau dort, wo die
echten Fälle lagen: `.bubble.a` setzte `background: #fff` und erbte die Schrift von
weit oben; die getönte Tafel färbte Schrift und Fläche aus **derselben** Variablen.

**Warum beide Farbschemata.** Vier der sechs Fälle zeigten sich nur in einem davon,
zwei davon nur im Dark-Theme – dem, das beim Schreiben niemand offen hat.

```bash
ruby theme/jekyll/contrast.rb --require-site     # Bericht
ruby theme/jekyll/contrast.rb --self-test        # die Prüfung selbst prüfen
make contrast                                    # beides
```

**Sie bricht nichts, und das ist Absicht.** Der Aufruf meldet und endet mit 0; sie
steht **nicht** in `make check` und in keinem Workflow. Ein Prüfer, der aus
unwichtigem oder unentschiedenem Grund rot wird, wird weggeklickt und schützt dann gar
nichts mehr – dieselbe Überlegung wie beim Markup Contract. Erst wenn eine
Ausnahmeliste steht und ein Lauf sauber durchgeht, macht `--strict` ein Tor daraus.

**Was der erste Lauf im eigenen Repo meldet: 22 Gruppen.** Neunzehn davon sind
dieselbe offene Frage – die Akzentfarbe des Fundaments als Schrift auf hellen Flächen
(2,75–3,22:1). Das ist eine Markenentscheidung, kein Fehler, und sie ist nicht Teil
dieser Fassung.

Die übrigen **drei sind echte Befunde**: `.avd-academy-grouptable__alert td` und die
zugehörigen Legendenschlüssel setzen `--avd-academy-tone-alert` als **Schrift** und
kommen im Light-Theme auf 4,39:1. Das ist genau die Klasse, für die 2.10.0 die
`-ink`-Fassungen eingeführt hat – die Prüfung hat sie im ersten Lauf gefunden, in
Regeln, die seit Langem im Paket stehen. Sie werden getrennt behoben; dieses Release
liefert das Werkzeug, nicht die Korrektur.

**Sie liegt im Paket** und läuft damit in jedem Schulungs-Repo über dessen **eigene**
Unterlagen. Das ist der eigentliche Punkt: Die Befunde, die zu 2.7.0 bis 2.10.0 geführt
haben, kamen aus einem Schulungs-Repo, das von Hand in Chromium nachgemessen hat. Eine
Prüfung, die nur hier läuft, sieht die Beispielseiten des Themes – nicht die
Präsentation, in der eine Überschrift unlesbar war.

**Ausnahmeliste mit Begründungspflicht.** Eine Zeile ist `Signatur⇥Begründung`; ein
Eintrag **ohne** Begründung ist ein Fehler, keine stille Ausnahme.

**Was sie nicht kann – und meldet.** Text über Verlauf, Bild oder SVG-Fläche (die
wirksame Farbe ist dort kein einzelner Wert), halbdurchsichtige Schrift, und alles, was
erst nach einer Eingabe entsteht: aufgeklappte Menüs, Folien hinter der ersten,
Simulationsschritte. Solche Elemente werden **gezählt und im Bericht genannt**. Stille
Auslassung liest sich sonst wie „alles geprüft“.

**Abhängigkeitsfrei geblieben.** Kein Gem: Der HTTP-Server, den die Messung braucht –
über `file://` laufen die wurzelabsoluten Asset-Pfade ins Leere und die Seite rendert
ganz ohne Theme-CSS –, steht in rund vierzig Zeilen auf `socket` aus der
Standardbibliothek. WEBrick ist seit Ruby 3.0 keine Default-Gem mehr und auf einem
fremden Runner nicht zugesichert.

**Browser nötig.** Chrome oder Chromium, gefunden über `--browser`, `CHROME` oder die
üblichen Pfade. Fehlt er, wird **sichtbar** übersprungen (`--require-browser`
erzwingt das Scheitern). Ob die eigenen Runner einen mitbringen, ist die Frage, die vor
einer Aufnahme in die Pipeline zu klären ist.

**Selbsttest inklusive**, aus demselben Grund wie bei `links.rb`: Im eigenen Repo trägt
nach jeder Korrektur wieder jedes Paar – die interessanten Fälle entstehen dort gar
nicht. Der Selbsttest baut eine Seite, in der jeder Befund einmal vorkommt **und** jeder
Fall, der keiner sein darf: großer Text an der 3:1-Schwelle, bewusst gedämpfte
Bedienelemente, Verlauf, halbdurchsichtige Schrift, nicht gerenderter Text. Dazu zwei
Gegenproben, die ein vertauschtes oder verschlucktes Farbschema auffliegen lassen.

**Laufzeit** rund anderthalb Minuten für 70 Seiten × 2 Schemata mit acht parallelen
Browsern (`--jobs`).

### Einstufung

**Minor.** Eine neue Datei im Paket, rein ergänzend. Kein Token, keine Klasse, kein
Pfad, kein Front-Matter-Feld ändert sich; nichts Bestehendes verhält sich anders, und
kein Lauf wird davon rot, der es vorher nicht war.
## 2.10.1

### Die Verweisprüfung meldete jeden Folienanker als tot

Gemeldet aus einem Schulungs-Repo (Register A-004, Nachtrag). `links.rb` prüft jeden
`#anker` gegen eine `id` im gebauten HTML. Eine Präsentation nummeriert ihre Folien
aber **zur Laufzeit**: `presentation.js` liest `#/5` und springt zur fünften Folie.
Eine `id="/5"` steht dafür nicht im HTML – und soll dort auch nicht stehen, die Folien
entstehen erst im Browser.

Ergebnis: **jeder** Folienanker wurde als toter Anker gemeldet. Im meldenden Repo waren
das 7 Befunde auf 2 Seiten bei **null** echten toten Verweisen.

**Es war kein Autorenfehler.** Die Schreibweise stammt aus dem Werkzeug selbst – der
Skill `konzept-pflegen` schreibt „je Kapitel mit Folien-Anker, z. B.
`praesentation.md#/9`“ ausdrücklich vor. Das Theme forderte die Schreibweise an einer
Stelle an und meldete sie an einer anderen als Fehler.

**Die Folge wiegt schwerer als die Meldung.** `links.rb` ist die einzige Prüfung, die
tote Verweise überhaupt findet. Ein Prüfer, der verlässlich Fehlalarme liefert, wird
nicht in die Pipeline genommen – im meldenden Repo lief er deshalb **gar nicht**, und
damit prüfte dort niemand die Verweise. Das Skript verfehlte seinen Zweck genau an der
Stelle, an der sein eigener Kommentar ihn am besten begründet.

**Behoben, und zwar ohne Ausnahmeliste.** Die Prüfung kennt jetzt die beiden Layouts mit
Laufzeit-Nummerierung und prüft Laufzeit-Anker gegen die **Form**, die das jeweilige
Skript zusichert, und gegen das **Layout der Zielseite**:

| Verweis | Ziel | Ergebnis |
| ------- | ---- | -------- |
| `praesentation.html#/5` | Präsentation | in Ordnung |
| `simulation.html#/uebersicht` | Simulation | in Ordnung |
| `simulation.html#/szenario/2` | Simulation | in Ordnung |
| `praesentation.html#/kapitel` | Präsentation | **Befund** – die Form kennt das Layout nicht |
| `gibt-es.html#/5` | gewöhnliche Seite | **Befund** – dort schaltet nichts auf `#/…` |

Der Betroffene ist damit nicht ausgenommen, sondern **anders geprüft**. Eine
Ausnahmeliste hätte in jedem Repo mit einer Präsentation neu gepflegt werden müssen –
das meldende Repo hat bewusst darauf verzichtet und stattdessen berichtet. Richtig so.

**Was ausdrücklich NICHT geprüft wird:** ob es die fünfte Folie überhaupt gibt. Dafür
müsste `links.rb` die Aufteilungsregeln aus `presentation.js` nachbauen (`h2` beginnt
eine Folie, Inhalt davor wird zur Titelfolie, fehlt sie, wird eine erzeugt) und dann bei
jeder Änderung dort mitwandern – genau die stille Drift, die #152 verursacht hat. Ein
Anker auf eine Folie, die es nicht gibt, landet auf der letzten; das ist sichtbar, ein
toter Verweis ist es nicht. Die Quelle der Formen sind die `ausHash()`-Funktionen der
beiden Skripte; wer sie dort ändert, ändert sie hier mit. Beides steht als Kommentar an
der Konstanten.

**Zur Frage, ob `links.rb` als CI-Schritt gedacht ist: ja.** Sie läuft in `make check`,
im `pages`-Workflow dieses Repos mit `--require-site` und – weil das Skript im Paket
liegt – in der Kopiervorlage `github-pages/deploy.example.yml`, die jedes Schulungs-Repo
übernimmt. Dieser Befund war für die Aufnahme also tatsächlich blockierend.

Der Selbsttest deckt die neuen Fälle ab: vier gültige Laufzeit-Anker, die **kein**
Befund sein dürfen, und zwei ungültige, die einer sein müssen.

### Einstufung

**Patch.** Eine Korrektur an einer Prüfung, die Fehlalarme lieferte. Kein Token, keine
Klasse, kein Pfad, kein Front-Matter-Feld ändert sich; für Autoren gibt es nichts Neues
zu nutzen. Wer die Prüfung bisher wegen der Fehlalarme nicht in der Pipeline hatte, kann
sie jetzt aufnehmen.

---

## 2.10.0

Drei Befunde aus einer Rückmeldung (Register A-004), gemessen an einem gebauten
Trainer-Bundle über CDP – 13 400 Messungen je Schema, 1 222 eindeutige
Vordergrund/Flächen-Paare. Alle drei hier gegengerechnet und bestätigt. Dazu die
Antwort auf eine Frage, die über die Befunde hinausging und die wichtigste
Änderung dieser Fassung ist.

### Vordergrundfassungen: `*-ink`

Eine Farbe der Palette ist als **Fläche** gedacht. Als **Schrift** trägt sie nicht:
`--avd-academy-color-danger` ergibt auf der Seitenfläche 4,39:1 (Light) bzw. 3,81:1
(Dark), auf `-bg-subtle` 3,75:1 bzw. 3,29:1. Das Theme selbst benutzt Danger
ausschließlich als **Rahmen** (`.avd-academy-callout--danger`,
`.avd-academy-sim-panel.is-error`) – dort ist es richtig, und **deshalb** ist es
nie aufgefallen. Sobald ein Repo eine Fehlermeldung *schreibt* statt sie zu
umranden, gab es kein Token, das trägt.

Neu, nach **einer** Regel abgeleitet – 45 % Farbe im Fließtext:

`--avd-academy-color-danger-ink`, `--avd-academy-color-accent-ink`,
`--avd-academy-tone-1-ink` … `-4-ink`, `--avd-academy-tone-alert-ink`

```css
--avd-academy-color-danger-ink:
  color-mix(in srgb, var(--avd-academy-color-danger) 45%, var(--avd-academy-color-ink));
```

Weil `--avd-academy-color-ink` mit dem Farbschema kippt, trägt derselbe Ausdruck in
beiden Schemata – die Tokens stehen deshalb **nur einmal** in `:root` und nicht in
den Dark-Blöcken.

| | Light | auf `bg` | Dark | auf `bg` |
| --- | --- | --- | --- | --- |
| `danger-ink` | `#882D2E` | 8,53:1 | `#EB8E8E` | 7,00:1 |
| `accent-ink` | `#8F4823` | 6,73:1 | `#F2A883` | 8,52:1 |
| `tone-3-ink` | `#776B34` | 5,33:1 | `#E4DCBB` | 12,14:1 |

**Zugesagt** ist AA auf `--avd-academy-color-bg` und `--avd-academy-color-bg-subtle`
in beiden Schemata; Engpass über alle sieben ist **4,56:1** (Ton 3, Gold, Light).
**Nicht zugesagt** auf den Füllflächen – dort trägt Gold nur 4,17:1; Text auf einer
Füllfläche nimmt `ink` oder `ink-muted`.

**Warum Tokens und nicht nur ein Abschnitt in der Doku.** Im Inline-SVG steht
`fill="var(…)"` – dort lässt sich nichts zusammenmischen, man kann nur auf ein Token
zeigen. Genau dort fielen die gemeldeten Stellen durch, während dieselben Projekte es
in ihrem CSS selbst lösen konnten: In einem Repo ist die Konstruktion an vier Stellen
unabhängig voneinander entstanden. Das war das ausschlaggebende Argument.

Die getönten Tafeln (2.9.0) mischen weiterhin mit 35 %. Kein Widerspruch, sondern ein
anderer Fall: Dort ist die Fläche mit **derselben** Farbe getönt, Schrift und Grund
wandern miteinander.

### Füllflächen im Dark-Theme: 26 % → 18 %

Die Ableitung aus 2.7.0 war gegen `--avd-academy-color-ink` gerechnet – und nur
dagegen. Sekundärtext auf derselben Fläche fiel bei drei von vier Füllungen durch:

| Fläche, Dark | `ink` | `ink-muted` vorher | `ink-muted` nachher |
| --- | --- | --- | --- |
| `fill-1-bg` | 8,62 → 10,10:1 | 4,53:1 | **5,30:1** |
| `fill-2-bg` | 8,44 → 10,05:1 | 4,43:1 | **5,28:1** |
| `fill-3-bg` | 7,58 → 9,36:1 | **3,98:1** | **4,91:1** |
| `fill-4-bg` | 8,21 → 9,82:1 | 4,31:1 | **5,16:1** |

Im Light-Theme trug dasselbe Paar immer (4,99–5,39:1) – es war kein Farbfehler,
sondern derselbe Fehlertyp wie in 2.7.0: ein Token, gegen **einen** Untergrund
gerechnet und vor **einem anderen** eingesetzt.

**Der Preis:** Die Flächen heben sich schwächer von der Seite ab (1,40–1,51:1 statt
1,64–1,87:1). Vertretbar, weil die Kategorie auch vom Strich `--avd-academy-fill-N`
getragen wird. **Der Light-Block bleibt unverändert.**

Bemerkenswert am Zustandekommen: Diese Flächen waren vor 2.7.0 im Dark-Theme
unbrauchbar. Sie wurden erst benutzt, *nachdem* 2.7.0 sie reparierte – und dabei fiel
der nächste Fall auf.

### `metanav-text` stand unter AA – und das war hier falsch eingestuft

`--avd-academy-metanav-text` hing an `--avd-gray-metatext` (`#707173`). Auf der
Metanav-Fläche (`#F4F4F4`) sind das **4,44:1**, für Kleintext bei 14 px unter AA – auf
**jeder** Seite des Themes.

Die Zahl steht seit 2.7.0 im CHANGELOG dieses Pakets, dort mit dem Satz, das Token
bleibe an `gray-metatext`, „dort ist es richtig“. Sie war gemessen und die Einstufung
schlicht falsch. Das Token hängt jetzt an `--avd-gray-footer`: **5,81:1**. Der
Dark-Wert war nie betroffen (6,88:1) und bleibt.

Anders als die beiden anderen Befunde kann ein Projekt diesen weder auslösen noch
vermeiden.

### Einstufung

**Minor.** Kein Token entfernt oder umbenannt, keine Klasse, kein Pfad; die neuen
`-ink`-Tokens sind rein ergänzend, die geänderten Werte sind sichtbar, verlangen aber
von keinem Projekt eine Umstellung.

**Für Projekte:**

- Wer eine Fehlermeldung, einen Akzent oder einen Ton als **Schrift** setzt – im CSS
  oder im Inline-SVG –, nimmt ab jetzt die `-ink`-Fassung.
- Wer die Mischung selbst nachgebaut hat, kann sie durch das Token ersetzen.
- Sekundärtext auf einer Füllfläche trägt im Dark-Theme jetzt; die Flächen sind dort
  etwas dunkler.
- Die Meta-Navigation ist einen Hauch dunkler.

---

## 2.9.0

### Getönte Tafeln: die Überschrift stand im vollen Ton auf ihrer eigenen Tönung

Gefunden von einem Prototyp, der jede gebaute Seite in beiden Farbschemata rendert und
jedes Vordergrund/Flächen-Paar nachrechnet – nicht von Hand. **Weder gemeldet noch in drei
Runden Handarbeit aufgefallen.**

Eine Tafel mit Ton (`.avd-academy-sim-panel--ton-1/-3/-4/-alert`) färbt ihre Fläche mit 8 %
des Tons und ihre Überschrift mit dem **vollen** Ton. Im Dark-Theme geht das auf, weil die
Töne dort aufgehellt werden. Im Light-Theme stand der rohe Ton auf seiner eigenen blassen
Tönung:

| Tafel, Light | Schrift auf Fläche | vorher | nachher |
| ------------ | ------------------ | ------ | ------- |
| Ton 1 · Slate | `#303E4F` auf `#DEDFE0` | 8,16:1 | 8,21:1 |
| Ton 4 · Violett | `#7A6FB3` auf `#E4E3E8` | 3,46:1 | **6,27:1** |
| Ton alert · Rot | `#EE1919` auf `#EDDCDC` | 3,31:1 | **7,08:1** |
| Ton 3 · Gold | `#C9A227` auf `#EAE7DD` | **1,96:1** | **5,06:1** |

**Warum es niemandem auffiel:** Dieselbe Regel besteht mit Ton 1 bei 8,16:1 und fällt mit
Ton 3 bei 1,96:1 durch. Wer eine Simulation öffnet, sieht die Tafel, die gerade da ist – und
die ist mit zwei von vier Tönen in Ordnung. Die Rückmeldung, die 2.7.0 ausgelöst hat, nannte
`sim-panel__title` sogar ausdrücklich (dort 4,17:1 in der **ungetönten** Tafel); der
schlimmere Fall stand daneben.

**Behoben:** Die Schriftfassung des Tons wird zum Fließtext hin gemischt –
`color-mix(in srgb, var(--avd-academy-sim-ton) 35%, var(--avd-academy-color-ink))`. Weil
`--avd-academy-color-ink` mit dem Farbschema kippt, trägt **derselbe Ausdruck in beiden
Schemata**: im Light-Theme dunkelt er den Ton ab, im Dark-Theme hellt er ihn weiter auf.
Gemessen über alle vier Töne: 5,06–8,21:1 hell, 8,27–9,15:1 dunkel.

**Der Rahmen behält den vollen Ton.** Die Wiedererkennung einer Tafel über Szenarien hinweg
hängt an ihm, nicht an der Überschrift – die Zuordnung bleibt also sichtbar.

**Was sich sichtbar ändert:** Die Überschrift einer getönten Tafel ist im Light-Theme
gedämpfter als bisher. Das ist eine sichtbare Änderung am Ergebnis bestehender Simulationen –
deshalb **Minor**, nicht Patch. Ungetönte Tafeln bleiben unverändert.

### Einstufung

**Minor.** Kein Token entfernt oder umbenannt, keine Klasse, kein Pfad; es ändert sich ein
Farbwert mit sichtbarer Wirkung auf bestehende Seiten – dieselbe Einstufung wie 2.6.0 und
2.7.0.

<!-- Die zugehörige Korrektur an der Simulations-VORLAGE (acht fest weiße Flächen) steht
     nicht hier: templates/ liegt nicht im npm-Paket. Sie ist in plugin/CHANGELOG.md
     unter 2.5.3 beschrieben. -->

---

## 2.8.0

### `accent-soft` folgt jetzt dem Akzent – und eine Regression aus 2.7.0

Nachtrag zu 2.7.0. Dort wurde `--avd-academy-color-accent-soft` nur im **Dark**-Block
an den Akzent gehängt; im Light-Block hing sie weiter an `--avd-orange`. Ein Projekt mit
eigenem Akzent behielt damit im Light-Theme eine **orange getönte** Fläche zu einer Farbe,
die gar nicht mehr orange ist.

**Behoben:** Die Mischung nimmt jetzt in beiden Schemata `--avd-academy-color-accent` als
Ausgangsfarbe und mischt in `--avd-academy-color-bg` statt in festes `#fff`. **Im
Auslieferungszustand ändert das nichts** – dort *ist* der Akzent das ATVANTAGE-Orange und
die Seitenfläche `#FFFFFF`, das Ergebnis bleibt `#FFEAE1`.

Die **kategoriale Füllpalette** bleibt bewusst unangetastet: `--avd-academy-fill-2-bg` hängt
weiterhin an `--avd-orange`. Füllung 2 *ist* per Definition das ATVANTAGE-Orange (siehe
`docs/theme/academy.md`, „Diagramm-Füllpalette“) – sie ist eine Markenfarbe der Palette,
nicht der Akzent des Projekts. Das ist derselbe Ausdruck, aber nicht dieselbe Bedeutung.

#### Regression aus 2.7.0: `.bubble.mono` in der Simulations-Vorlage

Beim Nachziehen aufgefallen und hier mit behoben. `--avd-academy-color-accent-soft` ist eine
**Fläche**. In `templates/simulations/simulation-template.html` wurde sie an **einer** Stelle
als **Schriftfarbe** benutzt:

```css
.bubble.mono { background: var(--ci-primary-dark); color: var(--ci-accent-soft); }
```

Das ging gut, solange die Fläche in beiden Schemata nahezu weiß war. Seit 2.7.0 schaltet sie
mit – und `--ci-primary-dark` (`--avd-academy-color-primary-dark`, `#1A2627`) schaltet
**nicht** mit. Im Dark-Theme stand damit dunkle Schrift auf dunkler Blase: **1,21:1**, vorher
13,41:1.

**Behoben** in der Vorlage, nicht im Token: Die Fläche dieser Blase ist fest dunkel, also muss
die Schrift es auch sein. Sie wird jetzt **lokal** aus dem Akzent gemischt
(`color-mix(in srgb, var(--ci-accent) 12%, #fff)`) – dasselbe Aussehen wie bisher
(`#FFEAE1` beim ATVANTAGE-Orange) und 12,5–14,4:1 auch mit einem eigenen Akzent.

Es war die **einzige** solche Stelle; alle 13 übrigen Verwendungen von `accent-soft` und
`fill-*-bg` in der Vorlage sind `background`, also korrekt.

<!-- Lehre daraus, ohne eigenen Abschnitt: Ein Token, das zur mitschaltenden Fläche wird,
     muss gegen jede Stelle geprüft werden, die es als VORDERGRUND benutzt – besonders dort,
     wo die Fläche darunter NICHT mitschaltet. -->

**Jedes Projekt mit einer Simulation muss die eine Zeile von Hand nachziehen** – ein
`npm update` behebt es nicht. `templates/` liegt **nicht** im npm-Paket (siehe `files` in
`theme/package.json`); die Vorlage ist zum **Kopieren** gedacht („`simulation-template.html`
ins Schulungs-Repo kopieren und sinnvoll benennen“). Jede Simulation da draußen ist also
eine Kopie. Zu ändern ist in der kopierten Datei:

```css
/* .bubble.mono – vorher */
color: var(--ci-accent-soft);
/* nachher */
color: color-mix(in srgb, var(--ci-accent) 12%, #fff);
```

Über das **Plugin** kommt die korrigierte Fassung mit (Asset des Skills
`simulation-erstellen`, ab Plugin 2.5.2) – aber auch das erneuert nur die Vorlage, nicht
eine bereits abgeleitete Datei im Schulungs-Repo.

### Einstufung

**Minor.** Kein Token entfernt oder umbenannt; es ändert sich ein Wert, und zwar nur für
Projekte, die den Akzent überschreiben. Im Auslieferungszustand ist das Ergebnis identisch.

---

## 2.7.0

### Drei Farb-Tokens trugen ihren Untergrund nicht

Gemeldet aus einem Schulungs-Repo, alle drei Befunde im gebauten Bundle mit Chromium
nachgemessen und hier gegen die Token-Dateien gegengemessen. Gemeinsame Ursache: Ein
Token wurde gegen **einen** Untergrund entworfen und später vor **einen anderen**
gestellt – ohne dass irgendetwas dabei rot geworden wäre.

#### Füllflächen ohne Dark-Werte

`--avd-academy-fill-1-bg` bis `-4-bg` und `--avd-academy-color-accent-soft` blieben im
Dark-Theme auf ihren hellen Pastelltönen stehen, während `--avd-academy-color-ink` auf
`#e8edee` wechselte. Wer eine Fläche damit füllt und den Text in `currentColor` setzt –
der naheliegende Weg für ein Inline-SVG –, bekam **1,00–1,08:1**: Schrift, die nicht da
ist. Im Bericht waren eine Überschrift und drei Beschriftungen einer Präsentation
betroffen.

Der Dark-Block hellt die **Töne** seit jeher auf und begründet das damit, dass die
Füllpalette auf helle Flächen gerechnet ist. Für die zugehörigen **Flächen** gilt dasselbe
Argument – sie waren übersehen worden.

**Behoben:** Beide Dark-Blöcke leiten die Flächen jetzt aus dem bereits aufgehellten
**Ton** ab, nicht aus der rohen Füllung: `color-mix(… var(--avd-academy-tone-N) 26%,
var(--avd-academy-color-bg))`. Über die rohe Füllung wäre Ton 1 (Slate) selbst so dunkel,
dass die Fläche nur 1,10:1 von der Seite abstände und als Kategorie nicht mehr erkennbar
wäre. Gemessen nach der Änderung: heller Text **7,58–8,62:1**, Fläche gegen Seite
**1,64–1,87:1**. Die weiche Akzentfläche folgt demselben Muster und hängt im Dark-Theme
am Akzent, damit ein Projekt mit eigenem Akzent keine orange getönte Fläche behält.

**Der Light-Block bleibt unverändert** – die hellen Werte sind byte-identisch.

*Bekannte Grenze:* Ton 1 (Slate) und Ton 4 (Violett) bleiben schwach gegeneinander
unterscheidbar (ΔE ≈ 5). Das sind sie im Light-Theme heute schon (ΔE ≈ 6); die Ableitung
verschlechtert nichts, behebt es aber auch nicht.

#### Text auf Akzentfläche stand fest auf Weiß

`--avd-academy-color-accent-contrast` ist das Token für Schrift **auf** der Akzentfarbe
(Abspiel-Knopf und Tab-Nummer der Simulation, Intro-Nummer, Hover-Zustand der Knöpfe).
Es stand fest auf `--avd-white`.

**Das war schon im Auslieferungszustand unter AA, und schon im Light-Theme:** Weiß auf
ATVANTAGE-Orange trägt **3,22:1**; `.avd-academy-sim__btn-text` steht auf
`--avd-academy-fs-sm` (≈13 px) und ist damit Kleintext, für den WCAG 2.1 AA 4,5:1
verlangt. Setzt ein Projekt einen eigenen, helleren Akzent, wird daraus 1,9:1. Ein Kippen
nur im Dark-Block hätte nichts behoben – der Akzent des Themes wechselt zwischen den
Schemata gar nicht, der Fehler stand in beiden.

**Behoben:** Der Wert wird nicht mehr gesetzt, sondern **aus dem Akzent abgeleitet** –
heller Akzent ergibt schwarze, dunkler Akzent weiße Schrift:

```css
@supports (color: oklch(from red l c h)) {
  :root {
    --avd-academy-color-accent-contrast:
      oklch(from var(--avd-academy-color-accent) clamp(0, (l - 0.58) * -1e5, 1) 0 h);
  }
}
```

Die Schwelle 0,58 ist nicht geschätzt: über 60 000 Zufallsfarben geprüft, trennt sie
schwarz und weiß am zuverlässigsten (≈2 % suboptimal; bei 0,62 waren es 9,5 %).

**Kein neues Token.** Ein zweites „Text auf Akzentfläche“ wäre ein Duplikat – das
bestehende bedeutet genau das und wird an fünf Stellen so verwendet. Kaputt war der Wert,
nicht der Name.

**Warum `@supports` und nicht zwei Deklarationen.** Custom Properties nehmen beim Parsen
jede Zeichenfolge an; die zweite Deklaration gewinnt also immer, und eine Engine ohne
relative Farbsyntax lässt `color` erst beim Rechnen ungültig werden – das Ergebnis ist
**Schwarz**, nicht der Rückfall auf Weiß. Auf einem dunklen Akzent wäre das exakt der
Fehler, der hier behoben wird. Beide Varianten in Chrome gegengeprüft. Mit dem Gate bleibt
es in alten Engines bei Weiß wie bisher.

**Was sich sichtbar ändert:** Im Auslieferungszustand trägt der Abspiel-Knopf jetzt
**schwarze statt weißer** Schrift auf Orange (6,52:1 statt 3,22:1). Das ist eine
Abweichung vom ATVANTAGE-Fundament, das bei `Tag`/orange selbst Weiß auf Orange setzt –
begründet und eingetragen in [`docs/theme/academy.md`](https://timetoact.ghe.com/AVD-Academy-Tools/academy-theme/blob/main/docs/theme/academy.md).

#### `--avd-academy-color-ink-muted` unter AA auf abgesetzten Flächen

Gemeldet als „4,17:1 auf `#fff`“ – auf `#fff` sind es tatsächlich **4,89:1**, und damit
besteht das Token AA. Die 4,17:1 stehen auf **`--avd-academy-color-bg-subtle`**
(`#EDEDED`), also auf Karten und erhöhten Flächen; auf dem Metanav-Grau (`#F4F4F4`) sind
es 4,44:1. Das Token war nicht theme-weit zu hell, sondern auf den Untergründen zu hell,
gegen die es nie gerechnet wurde – was auch erklärt, warum es an
`.avd-academy-sim-panel__title` und `.avd-academy-sim-panel__hint` auffiel.

**Behoben:** `--avd-academy-color-ink-muted` hängt jetzt an `--avd-gray-footer` (`#5F5F5F`)
statt an `--avd-gray-metatext` (`#707173`). Danach: **6,39:1** auf der Seite, **5,45:1**
auf abgesetzten Flächen, 5,81:1 auf dem Metanav-Grau.

**Das ist keine Abweichung vom Fundament, sondern der richtige Alias.** ATVANTAGE führt
`--avd-gray-footer` selbst als „Footer, Schatten, **sekundärer Text**“ und
`--avd-gray-metatext` als „Meta-Navigation, Affiliation-Leiste“. `ink-muted` hing am Token
der Meta-Navigation. `--avd-academy-metanav-text` bleibt unverändert an
`--avd-gray-metatext` – dort ist es richtig.

Der Dark-Wert (`#9fb0b3`) war nie betroffen (6,42–7,43:1) und bleibt.

#### Markup Contract: fünf nachgetragene Namen

`bin/markup-contract.sh` meldete beim Nachziehen fünf „neue“ öffentliche Namen:
`--avd-academy-fill-1-bg` bis `-4-bg` und `avd-academy-sim__btn-text`. Sie sind **nicht
neu** – die vier Tokens stehen seit jeher in der Doku und werden von
`templates/simulations/simulation-template.html` benutzt. Sie fehlten im Artefakt, weil
das Skript **eine Variable je Zeile** liest und `--avd-academy-fill-N` und
`--avd-academy-fill-N-bg` gepaart auf einer Zeile standen. Durch die eigenen Zeilen im
Dark-Block werden sie jetzt gefunden. Das Artefakt ist nachgezogen; damit sind diese
Namen ab sofort auch gegen stilles Wegfallen geschützt.

### Einstufung

**Minor.** Keines der Major-Kriterien greift: kein Token entfernt, keines umbenannt, kein
Pfad und kein Front-Matter-Feld geändert. Es ändern sich **Werte** – sichtbar, aber ohne
dass ein Projekt etwas umstellen müsste. Dieselbe Einstufung wie 2.6.0, die ebenfalls das
Ergebnis bestehender Seiten sichtbar veränderte.

**Was Projekte prüfen sollten, auch wenn nichts zu tun ist:**

- Wer `--avd-academy-color-accent` überschreibt, bekommt die passende Schriftfarbe jetzt
  **von allein** und kann ein eigenes `--avd-academy-color-accent-contrast` entfernen.
  Wer es gesetzt lässt, überstimmt die Ableitung weiterhin – das Gate steht in `:root`,
  eine projekteigene Regel gleicher Spezifität später im Kaskadenlauf gewinnt.
- Wer eigene Flächen aus `--avd-academy-fill-*-bg` baut, sieht sie im Dark-Theme jetzt
  **zum ersten Mal** – vorher waren sie dort unbrauchbar.
- Sekundärtext ist theme-weit einen Hauch dunkler.

---

## 2.6.0

### `title: ""` ließ die Überschrift ganz verschwinden

Eine Seite mit einem **leeren** Front-Matter-`title` trug am Ende **gar keine sichtbare
Überschrift** – und einen `<title>`, der nur aus dem Trennzeichen und dem Site-Namen
bestand (`· Academy`). Betroffen war jede solche Seite, und `title: ""` war die
verbreitete Schreibweise aus der Zeit, als `title` noch Pflichtfeld war.

**Warum es so lange unentdeckt blieb:** In Liquid ist der Leerstring **truthy**. Die
Ableitung stand als

{% raw %}
    {%- assign pageTitle = page.title -%}
    {%- unless pageTitle -%}  … erste #-Überschrift …  {%- endunless -%}
{% endraw %}

Bei `title: ""` war `pageTitle` damit „gesetzt", der 2.0 eingeführte Rückfall auf die
erste `#`-Überschrift griff **nicht**, und die Hero-Prüfung
auf `pageTitle` erzeugte ein leeres `<h1></h1>`. Die Überschrift aus dem Inhalt blieb zwar im HTML, wurde
aber von `.avd-academy-guide-main > h1:first-child { display: none }` als vermeintliches
Duplikat ausgeblendet – die Regel, die sonst genau das doppelte Anzeigen verhindert.
Beides zusammen ergab die leere Seitenüberschrift. Dieselbe Ursache erzeugte eine
**leere Brotkrume**.

Der Build lief dabei grün, das Schema war zufrieden, und die Seite sah auf den ersten
Blick plausibel aus – der Fehler zeigte sich nur im Vergleich.

**Behoben:** Die Ableitung liegt jetzt in einem gemeinsamen Include
`_includes/avd-page-title.html`, prüft den Leerstring **ausdrücklich** und setzt
`pageTitle` auf `nil`, wenn nichts übrig bleibt. Damit funktionieren alle vorhandenen
`if pageTitle`-Prüfungen wieder wie gedacht. `head.html` vergleicht zusätzlich gegen
`''`, weil der `default`-Filter zwar `nil` ersetzt, ein `''` aber durchreicht.

**Nebenbei entfernt: dreifache Kopie.** Dieselben sechs Zeilen standen in
`default.html`, `presentation.html` und `simulation.html`. Ein Fehler darin war ein
Fehler an drei Stellen – und genau so ist er entstanden.

**Was sich für Konsumenten ändert.** Seiten mit `title: ""` zeigen ihre Überschrift
**wieder an** und bekommen einen richtigen Browser-Titel. Das ist eine **sichtbare
Änderung am Ergebnis bestehender Seiten** – deshalb Minor und nicht Patch. Seiten
**ohne** `title` und Seiten mit **gesetztem** `title` bauen byte-identisch wie zuvor
(verifiziert per Vorher/Nachher-Diff über vier Fälle; einziger Unterschied war der
Cache-Buster). Nichts ist umzustellen: Wer `title: ""` stehen lässt, bekommt das
Verhalten, das seit 2.0 zugesagt ist. Wer den Hero-Titel absichtlich leer halten
möchte, hat dafür bislang kein Feld – bitte melden, dann wird daraus eines.

---

## 2.5.6

### Mehr-Host-Adressen: gemessen statt vermutet

Zu 2.5.5 stand in der Doku ein Muster für Sites, die aus **einem** Image unter mehreren
Adressen laufen – ein Platzhalter zur Bauzeit, den der ausliefernde Dienst je Anfrage
ersetzt. Ein Consumer hat es nachgestellt, und die Messung hat zwei Annahmen korrigiert:

* **Es sind zwei Werte, nicht einer.** `jekyll-github-metadata` berechnet `url` **und**
  `baseurl`. Wer auf GHE nur `url` setzt, sieht den Abbruch bloß weiterwandern:
  `Error processing value 'url'` wird zu `… value 'baseurl'`. Erst beide zusammen bauen
  durch (ein `--baseurl` auf der Kommandozeile zählt mit). `head.html` und die Doku
  sagten bisher nur `url`.
* **Der Platzhalter gehört in die Vorlage, nicht in `site.url`.** `absolute_url`
  normalisiert die Adresse und prozentkodiert dabei die Prozentzeichen – aus `%%ORIGIN%%`
  wird `%25%25ORIGIN%25%25`, und zwar auch ohne jedes Plugin. Dieselbe Normalisierung
  schreibt klein (`https://ORIGIN` → `https://origin`). Wer einen Platzhalter dennoch
  durch den Filter schicken muss, nimmt einen Hostnamen unter der reservierten TLD
  `.invalid` (RFC 2606) – er übersteht sie unverändert, und eine ausgebliebene Ersetzung
  zeigt auf einen Namen, der nie auflösen kann.

Dazu eine Einordnung, die bisher fehlte: **Die GHE-Falle greift nur, wo
`jekyll-github-metadata` überhaupt installiert ist** (über das `github-pages`-Gem). Ein
Repo, das nur `jekyll`, `jekyll-optional-front-matter` und `jekyll-relative-links` zieht,
kann sie nicht treffen. Dass das Theme trotzdem überall relativ verweist, bleibt Absicht –
sonst müsste jeder Consumer wissen, in welcher der beiden Welten er gerade baut.

Nur Doku und Kommentare; am Verhalten ändert sich nichts.

## 2.5.5

### Collection-Dokumente werden geprüft – und ihre `.md`-Verweise umgeschrieben

Eine Jekyll-Collection (`collections:` in der `_config.yml`) lief bisher an zwei
Prüfungen des Themes **vorbei**, ohne dass das irgendwo sichtbar wurde:

* **`validate.rb` übersprang sie.** Unterstrich-Ordner rendert Jekyll nicht – bis auf die
  Collections. Der Prüfer nahm die Ausnahme nicht mit und meldete danach „N Seite(n)
  geprüft, keine Verstöße“, als wäre nichts übrig geblieben. Jetzt sind die in
  `collections:` erklärten Verzeichnisse ausgenommen, `_posts` immer; `_data`,
  `_includes` und `_layouts` bleiben draußen. Die Schlussmeldung nennt die
  Collection-Dokumente eigens: `… 34 Seite(n) (darunter 32 aus Collections) geprüft …`.
* **`jekyll-relative-links` fasste sie nicht an.** Ein `[Text](../konfiguration/foo.md)`
  in einem Collection-Dokument blieb unverändert im HTML stehen und war im Browser tot –
  ohne Baufehler. Die Defaults setzen deshalb `relative_links.collections: true`; das
  Plugin löst den Verweis gegen den **Quellpfad** auf und schreibt die Adresse der
  gebauten Seite hin. In einer Collection gilt damit dieselbe Regel wie überall: im
  Markdown auf die `.md` verweisen.

<div class="avd-academy-callout avd-academy-callout--warning" markdown="1">
**Für Repos mit Collections kann dieses Update rot werden.** Front Matter, das bisher
ungeprüft durchlief, wird ab jetzt gegen das Schema geprüft. Repo-eigene Felder brauchen
dort – wie auf jeder Seite – das Präfix `x_` (`x_version`, `x_highlights`). Das ist der
Zweck der Änderung: Die Prüfung sagt jetzt, was sie wirklich angeschaut hat.

Wer die Theme-Defaults **nicht** lädt (Build mit `_config.yml` + `_config.audience.yml`),
trägt `relative_links: { collections: true }` in seine eigene `_config.yml` ein.
</div>

Neu im Front-Matter-Schema: **`categories`** und **`tags`** – beides liest Jekyll selbst
(Adresse eines Beitrags, `site.categories`/`site.tags`), nicht das Theme. Ohne sie meldete
die frisch erweiterte Prüfung jeden `_posts`-Eintrag als Tippfehler. Die Tags im Hero einer
Seite heißen weiterhin `topics`. Im Konfigurations-Schema steht jetzt `relative_links`, und
`collections` ist auch als Namensliste erlaubt – beides kennt Jekyll so. **Die
Schema-Versionen bleiben bei 2:** nur Ergänzungen, nichts entfällt, nichts wird enger.

### Doku: eine Site unter mehreren Adressen

`head.html` begründet ausführlich, warum das Theme ausschließlich `relative_url` nutzt, und
schloss mit „wer vollqualifizierte Verweise braucht, setzt `url` in der eigenen
`_config.yml`“. Das trägt für eine Site unter **einer** Adresse. Wird dieselbe gebaute Site
unter mehreren Hosts ausgeliefert – lokal, im Container, in der Cloud, alles aus demselben
Image –, kann der Build die Adresse gar nicht kennen; `url` ist dort die falsche Antwort.
Die Doku benennt den Fall jetzt und beschreibt das Muster dafür (Platzhalter zur Bauzeit,
den der ausliefernde Dienst je Anfrage ersetzt):
[Einbindung → Eine Site unter mehreren Adressen](https://timetoact.ghe.com/AVD-Academy-Tools/academy-theme/blob/main/docs/verwendung/einbindung.md).

## 2.5.4

### `hreflang` nennt nur noch Fassungen, die es gibt

`i18n.switch.fallback: base` schickt den Sprachumschalter auf die **Wurzel** des anderen
Sprachbaums, wenn es die Seite dort nicht gibt – damit ein Leser überhaupt in den anderen
Baum kommt. Als Knopf ist das richtig; **als Angabe über die Seite war es falsch.**

Dieser Rückfall lief bisher auch in den Kopf der Seite:

```html
<link rel="alternate" hreflang="en" href="/en/">
```

Das behauptet, `/en/` sei die englische Fassung **dieser** Seite. Auf einer erst teilweise
übersetzten Site behaupten das Hunderte Seiten gleichzeitig, und keine bekommt von `/en/`
eine Bestätigung zurück – `hreflang` verlangt aber Gegenseitigkeit, sonst wertet eine
Suchmaschine die Angabe ab, statt sie zu nutzen. In der Doku dieses Repos trugen **20 von
52** Seiten mit Sprachangaben eine Übersetzung, die es nicht gibt; jetzt sind es **null**,
und jede verbliebene Angabe zeigt zurück.

Dieselbe Trennung gilt für die Browsersprachen-Erkennung (`i18n.detect`): Sie leitet nur
noch dorthin um, wo es **diese** Seite in der bevorzugten Sprache wirklich gibt. Vorher
verlor ein englischsprachiger Leser auf einer unübersetzten Seite genau die Seite, die er
aufgerufen hatte, und landete auf der englischen Startseite.

**Am Umschalter ändert sich nichts** – der Rückfall bleibt genau da, wofür er gedacht war.
Intern führt `avd-i18n.html` dafür zwei Listen: `iAlt` (echte Gegenstücke, gelesen von
`head.html`) und `iAltSchalter` (echte Gegenstücke plus Rückfall, gelesen von
`tools.html`).

**Was Projekte tun müssen:** nichts. Wer `fallback: base` gesetzt hat, behält den
Umschalter und verliert nur eine Angabe, die ohnehin nicht stimmte.

---

## 2.5.3

**Eine Prüfung, die tote Verweise findet – und die 60 toten Verweise, die sie gefunden
hat.** Angestoßen von einem Hinweis aus demselben zweisprachigen Consumer-Repo, das
schon 2.5.1 und 2.5.2 gemeldet hat.

### Neu: `theme/jekyll/links.rb`

Ein Verweis ins Leere ist für Jekyll **kein Baufehler**. Die Seite entsteht, der Link
ist tot, und es fällt erst beim Klicken auf – oft Wochen später und einem Leser, nicht
dem Autor. Das Paket bringt deshalb eine Prüfung mit, die gegen das **gebaute `_site`**
läuft und dreierlei meldet:

* **Ziel fehlt** – das `href` trifft keine Datei. Ein Ordner ohne `index.html` gehört
  dazu: Auf GitHub Pages ist er ein 404, kein Verzeichnislisting.
* **Anker fehlt** – `#kapitel` trifft auf der Zielseite keine `id`. Geprüft im gebauten
  HTML, weil kramdown den Slug dort schon erzeugt hat. Wer ihn aus der Überschrift
  **nachbaut**, trifft die Umlautregel falsch und meldet `#löschen` als tot.
* **Sprachbaum gewechselt** – der Verweis führt in eine andere Sprache, **obwohl es die
  Zielseite in der Sprache der verweisenden Seite gibt**. Zugehörigkeit und Gegenstück
  kommen aus dem gebauten HTML (`<html lang>`, `<link rel="alternate">`), der Befund
  nennt deshalb gleich die richtige Adresse. Ein Verweis mit `hreflang` ist Absicht und
  wird übergangen.

**Warum gegen das Gebaute:** Ein Verweis entsteht an **fünf** Stellen – Fließtext,
`resources`, `nav`, Sprachkarten, `breadcrumb.ancestors` – und sieht in der Quelle jedes
Mal anders aus. Ein Prüfer über die Quellen kennt immer nur einige davon und hat sein
Loch genau dort, wo der echte tote Verweis steht. Im `_site` steht überall dasselbe.

`--baseurl` (derselbe Wert wie beim Bauen) und `--ignore «Praefix»` (Adressen, die erst
die laufende Anwendung bedient) sind die beiden Angaben, die eine Site braucht. Externe
Links prüft sie nicht: Ein Prüflauf, der aus fremden Gründen rot wird, wird
abgeschaltet. `--self-test` prüft die Prüfung an einer Site, die jeden Befund einmal
enthält – im eigenen Repo entstehen die interessanten Fälle nicht, und genau diese
Blindheit hat 2.5.1 grün durchlaufen lassen.

**Für Konsumenten:** Beide Workflow-Vorlagen (`github-pages/deploy.example.yml`,
`theme/jekyll/starter/pages.yml`, Vorlagenversion **10**) rufen die Prüfung nach dem
Build auf. Wer eine ältere Kopie hat, zieht den Schritt nach – nötig ist er nicht.
Doku: [GitHub Pages → Tote Verweise finden](https://timetoact.ghe.com/AVD-Academy-Tools/academy-theme/blob/main/github-pages/index.md).

### Behoben: die automatische Brotkrume verlinkte Ordner, die es nicht gibt

Die aus der Ordnerstruktur gebaute Kette verlinkte **jeden** Vorfahren – auch einen
Ordner **ohne `index`-Seite**. `/docs/` ist auf GitHub Pages dann ein 404, und zwar auf
jeder Seite darunter. In der Doku dieses Repos waren es **56 tote Verweise**, die
niemandem aufgefallen sind, weil eine Brotkrume selten angeklickt wird.

Ein Vorfahre ohne `index`-Seite steht jetzt als **Text** statt als Link; eine statische
`index.html` zählt dabei mit. Sichtbare Folge: Diese Krumen sind nicht mehr anklickbar –
sie waren es vorher auch nicht, sie sahen nur so aus.

### Behoben: vier tote und 37 sprachfremde Verweise in der englischen Doku

Gefunden von der neuen Prüfung, alle aus der Übersetzung in 2.5.0:

* ein Markdown-Verweis über **zwei Zeilen** – `jekyll-relative-links` schreibt ihn nicht
  um, und die Seite lieferte `href="docs/usage/quickstart.md"` aus;
* zwei Verweise in **rohem HTML** (`<a href="academy.md#…">`) – auch die schreibt das
  Plugin nicht um, denn es kennt nur Markdown-Syntax;
* ein relativer Verweis im CHANGELOG, der eine Ebene zu hoch zeigte;
* 37 Verweise aus dem englischen Baum auf die **deutsche** Fassung einer Seite, die es
  auf Englisch gibt – samt der Klammern „(German)“, die dazu nicht mehr stimmten.

---

## 2.5.2

**Zwei Fehler aus 2.5.1, beide von außen gemeldet** – aus einem zweisprachigen
Consumer-Repo, in dem Englisch in der Wurzel und Deutsch unter `/de/` liegt.

### Der Sprachhinweis klebte am vorigen Attribut

An jedem Verweis, der in eine andere Sprache zeigte, entstand **ungültiges HTML**: Dem
Attributnamen fehlte das trennende Leerzeichen zum schließenden Anführungsstrich des
vorigen Attributs.

**Die Ursache war unsichtbar.** `_includes/avd-link-target.html` baute die Attribute per
`capture`, mit dem trennenden Leerzeichen als **erstem Zeichen** des Blocks – und genau
den Whitespace danach schneidet das `-%}` der öffnenden Anweisung weg. Alle sechs
Verweisstellen verlassen sich darauf, dass das Leerzeichen im Wert steckt.

Das Leerzeichen wird jetzt **angehängt** (`' ' | append: …`) statt hingeschrieben. Ein
Leerzeichen, das nur als Whitespace in einer Liquid-Anweisung existiert, ist beim nächsten
Aufräumen der Delimiter wieder weg – und der Fehler fällt nicht auf, weil Browser das HTML
trotzdem darstellen. Bemerkt wird er erst von einem Validator, einem Parser oder einem
Screenreader.

**Warum der eigene Build nichts zeigte:** In derselben Runde war jedes Verweisziel der
Doku-Site übersetzt worden – damit entstand dort **kein einziger** fremdsprachiger Verweis,
und die betroffene Codezeile lief nie. Ein grüner Build war in diesem Fall kein Beleg.

### Was keine Seite ist, bekam trotzdem eine Sprache

`avd-lang-of-url.html` nahm nur **externe** Adressen (`://`) aus. Eine **wurzel-absolute**
Adresse wie `/schemas/client.schema.json` durchlief dagegen die Sprachbaum-Erkennung, fand
keinen Treffer und landete beim Rückfall auf der Standardsprache. Damit galt eine
JSON-Datei als Seite in dieser Sprache, und auf einer Seite der anderen Sprache stand
daran ein Sprachhinweis – eine Behauptung über etwas, das gar keine Seite ist. Betroffen
war jeder Verweis auf Asset, PDF, Schema oder eine von der Anwendung ausgelieferte Datei.

Geprüft wird jetzt gegen **`site.pages`** – denselben Index, den der Umschalter ohnehin
nutzt. Trifft nichts zu, wird wie bei einer externen Adresse verfahren: kein `hreflang`,
kein `title`. Fragment und Abfrage (`#kapitel`, `?x=1`) zählen beim Vergleich nicht mit,
denn sie bezeichnen eine Stelle **in** einer Seite: `/a.html#kapitel` **ist** die Seite
`/a.html`.

### Regressionsschutz: `bin/html-attributes.sh`

Neue Prüfung über das **gebaute** `_site`: Klebt irgendwo ein Attributname am vorigen
Attribut? Sie hängt in `make check` und – mit `--require-site` – hinter dem Build der
Pages-Pipeline.

**Zweistufig, und beides war nötig.** Erst werden die echten Tags herausgeschnitten (ein
Codebeispiel steht gebaut als `&lt;a …&gt;` und ist keines), dann werden die
Attributwerte durch ein Zeichen ersetzt. Ohne den zweiten Schritt kann ein Muster
öffnende und schließende Anführungsstriche nicht unterscheiden und meldet jeden Wert, der
selbst ein `=` enthält – `content="width=device-width, initial-scale=1"` also auf **jeder**
Seite. `<script>` und `<style>` fallen heraus: Die Simulations-Vorlage baut ihre Bühne mit
JS-Template-Literalen, die wie Markup aussehen und keines sind.

### Mitgefunden: `page.description` wurde unescaped in ein Attribut geschrieben

Die neue Prüfung hat auf Anhieb einen **zweiten, älteren** Fehler derselben Art gefunden:
`head.html` schrieb `content="{{ page.description }}"` ohne `escape`. Ein
Anführungsstrich in der Beschreibung beendet damit den Attributwert, und der Rest des
Satzes wird zu Pseudo-Attributen. Aufgefallen ist es an den Skill-Referenzen des Plugins –
ihre Beschreibungen führen Trigger-Sätze in Anführungsstrichen. Jetzt mit `escape`.

---

## 2.5.1

**Ein Verweis wird in der Sprache seines Ziels beschriftet.** Das korrigiert einen
Fehler aus 2.5.0, und zwar einen sichtbaren: Auf der englischen Fassung der Doku-Site
standen **elf von vierzehn** Menüpunkten englisch beschriftet da und öffneten deutsche
Seiten. Wer „With Claude“ anklickt und Deutsch bekommt, hält nicht die Übersetzung für
unfertig, sondern die Site für kaputt.

Jetzt erscheint dort „Mit Claude“ – in der Sprache der Zielseite –, dazu `hreflang="de"`
am Verweis und ein Hinweis im Tooltip („Diese Seite ist auf Deutsch“). Zu konfigurieren
ist nichts.

**Warum das keine Notlösung ist:** Die Beschriftung beschreibt eine Seite, also spricht
sie deren Sprache. Nebenwirkung mit Absicht – eine unfertige Übersetzung ist im Menü zu
**sehen**, statt sich hinter englischen Wörtern zu verstecken.

**Die Regel steckt in EINEM Auflöser** (`avd-link-target.html`), den alle sechs
Verweisstellen benutzen: Kopfzeile (Haupteintrag und Untermenü), Fußbereich, `resources`,
Brotkrumen-Vorfahren und die Kopie im Markdown. Der Fehler war entstanden, weil die
Auflösung an jeder Stelle einzeln stand; gebündelt kann sie an keiner vergessen werden.

**Kein neues sichtbares Element.** Erwogen war ein Sprach-Abzeichen („DE“) neben dem
englischen Label – eine neue Komponente, eigenes CSS, und der Sprachwechsel wäre eine
Überraschung geblieben, nur eine angekündigte. Das deutsche Wort selbst ist der
ehrlichere Hinweis.

**Der Sprachhinweis steht in der Sprache des ZIELS.** Der erste Versuch setzte ihn in der
Sprache des Lesers zusammen und lieferte „This page is in Deutsch“ – ein englischer Satz
mit deutschem Sprachnamen. Ein Satz je Sprache genügt (`avd-lang-name.html`,
`form="hint"`); die Alternative wäre eine Tabelle je Sprachpaar, also quadratisch.

**Ausnahmen, beide begründet:** Menü-**Gruppen** (Einträge mit `children`) sind keine
Seiten und behalten die Sprache der aktuellen Seite. **Externe Ziele** (`://`) ebenfalls –
welche Sprache dort wartet, kann das Theme nicht wissen, und ein Hinweis, den niemand
belegen kann, ist schlimmer als keiner.

**Eingestuft als PATCH, nicht als Minor.** Es ist eine Korrektur eines Fehlers aus
2.5.0 und keine neue Funktion – die drei neuen Includes sind Innenleben, kein neues
Angebot an Projekte. Für Repos gibt es nichts zu tun und nichts zu entscheiden: Wer
einsprachig ist, merkt nichts; wer zweisprachig ist, bekommt die Beschriftungen
richtig.

**Einsprachige Repos sind erneut nachweislich unberührt:** derselbe Build aus `main` und
aus diesem Stand, jeweils ohne `i18n`, **60 Seiten, null** inhaltliche Abweichung.

**Und die Faustregel dazu: `page` für alles Interne, `url` nur für Externes.** Weil der
Dateiname als Identität einspringt (2.5.0), ist jede Seite über `page` erreichbar – ein
interner `url`-Eintrag hat keinen Vorteil mehr, aber drei Nachteile: Er bricht beim
Verschieben, muss bei mehreren Sprachen doppelt gepflegt werden, und ein Tippfehler darin
fällt erst beim Klicken auf. `url` bleibt intern nur bei Ordner-Indizes (alle heißen
`index`), bei Dateien, die keine Seite sind, und bei Verweisen mit Anker – ein Fragment
trägt `page` nicht. Die Doku-Site führt jetzt **keinen** internen `url`-Eintrag mehr.

Neu: `theme/jekyll/_includes/avd-link-target.html` (Adresse, Sprache und Sprachhinweis
eines Verweises), `avd-lang-of-url.html` (Sprache einer Adresse),
`avd-lang-name.html` (Eigenname und Hinweissatz je Sprache – die Tabelle stand vorher
in `avd-i18n.html` und wird jetzt an zwei Stellen gebraucht).

---

## 2.5.0

**Das Theme kann zwei Sprachen.** Seine Beschriftungen lagen als deutsche Literale im
Markup – eine englische Seite war damit nicht darstellbar, ohne das Theme anzufassen.
Jetzt bringt es Deutsch und Englisch mit, und eine Site kann je Sprache einen
Ordnerbaum führen.

**Für einsprachige Repos ändert sich nichts, und zwar nachweislich.** Derselbe Build
aus `main` und aus diesem Stand, 54 Seiten, whitespace-normalisiert **null**
inhaltliche Abweichung. Ohne den neuen Schlüssel `i18n` gibt es kein Pfad-Präfix,
keinen Umschalter und keine Umleitung; `lang: de` bleibt die Vorgabe, und eine
unbekannte Sprache bekommt weiterhin die deutschen Texte.

**Neu in der `_config.yml`:**

```yaml
lang: de                    # Standardsprache – ihr Sprachbaum ist die WURZEL
i18n:
  languages:
    - code: de
    - code: en              # base: "/en/" ist die Vorgabe
  switch: { enabled: true, fallback: none }
  detect: { enabled: false }
```

**Neu im Front Matter:** `page_id` – die stabile Identität einer Seite.

**Und ein Verweis nennt die Seite, nicht ihren Ort.** `nav.items`, `footer.links.items`,
`resources` und `breadcrumb.ancestors` kennen neben `url` jetzt `page`:

```yaml
nav:
  items:
    - title: Getting Started
      page: schnellstart          # statt url: /docs/verwendung/schnellstart.html
```

Adressierbar ist eine Seite über ihre ausdrückliche `page_id` – oder, wenn sie keine
hat, über ihren **Dateinamen ohne Endung**. Die ID wird zuerst gesucht. **Das lohnt sich
auch einsprachig:** Der Verweis löst sich vom Pfad, ein Umbenennen oder Verschieben
bricht ihn nicht mehr. Bei mehreren Sprachen bildet das Theme daraus je Sprachbaum die
passende Adresse – es gibt also nichts zu übersetzen –, und fehlt die Übersetzung, zeigt
der Verweis von selbst auf die Standardsprache.

Ein Tippfehler ist dabei ein **Build-Fehler**, kein fehlender Menüpunkt: Ohne Prüfung
fände das Theme nichts, ließe den Verweis weg, und niemand sähe, dass er fehlen sollte.
Dasselbe für Mehrdeutigkeit – und die wird nur dort gemeldet, wo sie auch greift: Zwei
`index.md` in verschiedenen Ordnern sind der Normalfall und erst dann ein Problem, wenn
jemand `page: index` schreibt.

**Ordnerbäume, nicht Dateinamen-Suffixe.** Zur Wahl stand, die Übersetzung neben das
Original zu legen (`einbindung_en.md`). Dagegen sprach der Zuschnitt: Ordner und Dateien
tragen je Sprache eigene Namen (`docs/verwendung/einbindung.md` ↔
`en/docs/usage/setup.md`) – die URL ist Teil der Unterlage. Ein Suffix-Schema erzwingt
dagegen deutsche Dateinamen im englischen Baum.

**Deshalb eine ID und keine Pfad-Arithmetik.** Bei eigenen Namen je Sprache lässt sich
das Gegenstück aus dem Pfad nicht berechnen. `page_id` verbindet die Fassungen
symmetrisch und für beliebig viele Sprachen. Fehlt das Gegenstück, erscheint kein
Umschalter – ein Knopf ins 404 ist schlimmer als keiner.

**Ein Jekyll-Build, nicht zwei.** Beide Bäume entstehen in einem Lauf; es gibt kein
zweites Kommando, kein Config-Overlay und keine Pipeline-Änderung. Nebeneffekt, auf dem
der Umschalter beruht: In einem Build kennt jede Seite alle anderen, das Theme kann die
Existenz der anderen Fassung also **prüfen** statt eine Adresse zu raten.

**Jeder konfigurierte Text darf eine Sprachkarte sein** – `title`, `url` und `icon` in
TopNav, Fußbereich und `resources`, dazu `site.title`, `brand.tagline`, die Rechtstexte,
`topics`, `breadcrumb` und die Beschriftungen unter `components`:

```yaml
nav:
  items:
    - title: { de: "Design-System", en: "Design system" }
      url:   { de: "/theme.html", en: "/en/theme.html" }
```

**Auch die Adresse, nicht nur der Titel.** Wäre nur der Titel mehrsprachig, zeigte die
englische Leiste mit englischer Beschriftung auf die deutsche Seite. Die Alternative
wäre ein parallel gepflegter Navigationsbaum je Sprache gewesen – zwei Bäume driften,
und es fällt niemandem auf, weil beide für sich gültig sind. Nebeneinander im selben
Eintrag sieht man beim Schreiben, dass eine Übersetzung fehlt.

**Das Wörterbuch steht in einem Include, nicht in `_config.defaults.yml`.** Zwei der
drei Consumer laden diese Datei nicht – `bin/build.sh` einer Unterlage baut mit
`_config.yml` + `_config.audience.yml`. Ein Wörterbuch dort wäre für sie nicht vorhanden,
und jede Beschriftung käme leer heraus; dieselbe Begründung wie bei den harten Vorgaben
in `avd-switch.html`.

**Die Prüfung kommt aus dem Schema, nicht aus einer Namensliste.** `validate.rb`
vergleicht jeden Sprachcode gegen `i18n.languages` und meldet doppelte `page_id` je
Sprache. Der erste Versuch war eine Liste der Feldnamen und war sofort falsch:
`brand.icon` ist ein Hash aus `default`/`small`/`apple`, heißt aber `icon` – dasselbe
Wort bedeutet an verschiedenen Stellen Verschiedenes. Jetzt läuft die Prüfung durch Wert
und Schema gleichzeitig; wer ein Feld sprachfähig macht, ändert nur das Schema.

**Browsersprache statt `Accept-Language`.** GitHub Pages liefert statische Dateien aus –
es gibt keinen Prozess, der den Header sähe. `navigator.languages` ist dieselbe
Einstellung, clientseitig gelesen. Mit `i18n.detect.enabled: true` leitet das Theme
einmal je Sitzung um; eine ausdrückliche Wahl am Umschalter gewinnt immer, und `?nolang`
schaltet es fallweise ab. Vorgabe ist **aus**: Eine Umleitung ist eine
Verhaltensänderung.

**Was das Theme nicht übernimmt:** das Übersetzen. Prosa auf Satzebene zu verschlüsseln
(`{{ t.abschnitt3 }}`) macht das Markdown unlesbar, zerstört die Vorschau und erzwingt
Übersetzungen, die nicht auseinandergehen dürfen – obwohl Beispiele, Redewendungen und
Screenshots das müssen.

Neu: `theme/jekyll/_includes/avd-i18n.html` (Sprache, Sprachfassungen, Wörterbuch),
`theme/jekyll/_includes/avd-lang-value.html` (Sprachkarten auflösen), die Klasse
`avd-academy-tool--lang`. Doku: [Mehrsprachigkeit](https://timetoact.ghe.com/AVD-Academy-Tools/academy-theme/blob/main/docs/theme/mehrsprachigkeit.md).

---

## 2.4.1

**Das Tempo-Menü der Simulation ging nicht mehr auf.**

Der Umzug auf englische Namen (2.0, #136) hat das Markup umbenannt – aus
`data-avd-academy-sim-tempo`, `…-tempo-label` und `…-tempo-menu` wurden `…-speed*` –,
die drei zugehörigen Suchen in `simulation.js` aber nicht. Sie fragten weiter nach
`…-tempo*`, fanden nichts, und `menuVerdrahten()` stieg an den `null`-Elementen sofort
wieder aus. Betroffen war beides: der Klick auf den Tempo-Knopf **und** die Taste `T`.

Nachgemessen im gebauten Beispiel: `[data-avd-academy-sim-tempo-menu]` gibt es im HTML
nicht mehr.

**Warum der Knopf jetzt `…-speed-toggle` heißt.** Er trug denselben Namen wie der
Wurzelknoten, auf dem die Startvorgabe aus `page.simulation.speed` steht. `q()` arbeitet
mit `document.querySelector` – bei gleichem Namen findet die Suche den Wurzelknoten, weil
er im Dokument vorher steht. Die Suche auf den Knopf einzugrenzen hätte den Klick
reparieren können, aber nicht die Ursache: **ein Name, der zwei Dinge bezeichnet.** Der
Knopf heißt daher eindeutig, und die Startvorgabe behält `…-speed`.

Das Attribut ist Layout-intern (der Steuerungsbalken wird vom Layout gerendert, nicht von
Autoren geschrieben) und steht nicht im Markup-Vertrag – für Projekte ändert sich nichts.

## 2.4.0

**Eine Visualisierung darf eine Dauer nennen – und zeigt sie jetzt auch.**

`layout: visualization` setzte `duration_tag: false`. Eine Seite mit `duration` im Front
Matter bekam also **kein Zeit-Tag**, ohne Hinweis: Das Feld war erlaubt, wurde geprüft
und dann verschluckt. Begründet war das mit „kein zeitgebundener Inhalt“ – das trifft auf
ein projiziertes Schaubild zu, nicht auf Selbstlernmaterial, das jemand in einer
Viertelstunde durcharbeitet.

Neu gilt für alle Layouts mit Hero dasselbe: **`duration` gesetzt → Tag da, sonst nicht.**
Auf Visualisierungen bleibt die Angabe unüblich, aber sie ist erlaubt, und wer sie macht,
sieht sie. Nachgezogen in der Layout-Eigenschaftstabelle, im Schema (`GILT IN`) und in der
Doku.

Für bestehende Seiten ändert sich nichts: Im ganzen Bestand setzt keine Visualisierung
eine `duration`. Sichtbar wird die Korrektur erst bei der ersten, die es tut.

## 2.3.0

**Die Seitenwerkzeuge sind eine Komponente – und der Farbschema-Umschalter fehlt
nicht mehr in der Visualisierung.**

QR-Code, Farbschema-Umschalter, Drucken und Vollbild standen viermal im Markup: in
`_includes/header.html`, im Hero von `_layouts/default.html` und in den Kopfleisten
von `presentation` und `simulation`. Der QR-Block war wortgleich kopiert, der
Umschalter dreimal mit drei verschiedenen Klassen – und an der vierten Stelle, dem
Hero der Visualisierung, war er darum **vergessen** worden. Eine `visualization` hatte
als einziges Layout keine Möglichkeit, zwischen hell und dunkel zu wechseln.

Neu rendert **`_includes/tools.html`** alle Werkzeuge, und die Aufrufstelle sagt nur
noch, welche sie führt und wie sie verdrahtet sind:

| Layout | Wo | Werkzeuge |
| ------ | -- | --------- |
| `page`, `guide` | Kopfzeile | QR, Farbschema |
| `visualization` | Hero rechts | QR, Farbschema (**neu**), Drucken |
| `presentation` | Kopfleiste | QR, Farbschema, Drucken, Vollbild |
| `simulation` | Kopfleiste | QR, Farbschema, Vollbild |

**Aussehen kommt vom Container, nicht vom Knopf.** Alle Knöpfe tragen
`avd-academy-tool` und lesen Kantenlänge, Zeichengröße und Farbe aus vier Variablen,
die die umgebende Gruppe setzt: `--avd-academy-tool-size`, `-glyph`, `-ink`,
`-ink-hover`. Deshalb sieht derselbe Knopf auf der weißen Kopfzeile richtig aus wie
auf der dunklen Kopfleiste der Präsentation. `avd-academy-present__tool` und
`avd-academy-sim__tool` entfallen – beide waren zeichengleiche Kopien und standen
nicht im Markup-Vertrag.

**Für Projekte ändert sich nichts.** `avd-academy-theme-toggle` und
`avd-academy-print-btn` sind öffentliche Namen und bleiben auf den Knöpfen (siehe
Register unten). Der Drucken-Knopf der Präsentation zeigt statt des Zeichens `⎙` jetzt
dasselbe Masken-Icon wie im Hero – eine Vereinheitlichung, kein Verhaltenswechsel.

Nebenbei: Der Tooltip des Umschalters ist über `toolbar.theme.title` konfigurierbar
geworden, weil die Komponente ihn wie jeden anderen Text über `avd-text.html` auflöst.

## 2.2.1

**Warnung ergänzt: die Info-Schaltfläche trägt in einem Markdown-Listenpunkt nicht.**
Die Doku empfahl `avd-academy-reveal--info` für Stellen ohne Platz für einen Titel –
„eine Tabellenzelle, das Ende einer Zeile“. In einer **Aufzählung** führt genau das in
den Fehler: Kramdown behandelt das `<details>` dort als Inline-HTML und maskiert seinen
Inhalt, im Ergebnis steht `&lt;summary&gt;` und die Schaltfläche ist kaputt. `markdown="1"`
am umgebenden Element hilft nicht.

Nachgemessen und in die Doku übernommen, samt Ausweg (die ganze Liste als Block-HTML)
und dem Hinweis, dass dieser Preis hoch genug ist, um die Erläuterung lieber neben die
Liste zu stellen. Gemeldet aus einem Konzept-Repo (A-013).

---

## 2.2.0

**Zehn Jekyll-Schlüssel mehr im Konfigurations-Schema** – durchgegangen anhand von
[json.schemastore.org/jekyll](https://www.schemastore.org/jekyll.json) und aufgenommen,
was in einem Academy-Repo realistisch vorkommt: `source`, `destination`, `data_dir`,
`collections_dir`, `markdown_ext`, `highlighter`, `liquid`, `future`, `unpublished`,
`incremental`.

Zwei davon lohnen den Blick: **`future` und `unpublished`** entscheiden, ob eine Seite mit
künftigem `date` bzw. `published: false` überhaupt gebaut wird – beide Felder kennt das
Front-Matter-Schema, die zugehörigen Schalter fehlten. Und **`highlighter`** steht in
Spannung zu `code.highlight`: Das Theme färbt clientseitig und schaltet Rouge in seinen
Defaults ab; beides zugleich erzeugt doppeltes Markup. Das steht jetzt in der Beschreibung.

**Jede Beschreibung eines Jekyll-Schlüssels beginnt mit `JEKYLL-STANDARD –`.** Im Tooltip
soll ohne Nachschlagen klar sein, ob der Schlüssel dem Theme gehört oder Jekyll.

**Nicht aufgenommen:** die Server- und CLI-Optionen (`port`, `host`, `livereload*`,
`quiet`, `safe`, `whitelist`, `webrick`, `rdiscount`, `redcarpet` …). Sie gehören in den
Aufruf; in diesen Repos steuert sie der Container, in der Datei hätten sie keine Wirkung.

**Das Schema erweitert das Jekyll-Schema weiterhin nicht** – es zählt die Schlüssel selbst
auf. Ein `$ref` auf die veröffentlichte Fassung schiede aus zwei Gründen aus: Der Prüfer
löst `$ref` relativ zur Datei auf und kann keine URL holen, und eine Netzabhängigkeit ist
genau das, was der lokale Schema-Pfad beseitigt hat. Die Schema-Version bleibt **2**: rein
ergänzend, die Wurzel war schon vorher offen.

---

## 2.1.6

**Festgehalten, dass Markdown-Front-Matter keinen IDE-Support bekommt.** Die Doku sagte
das schon, aber als Vermutung. Der naheliegende Ausweg – den Repos eine IDE-Zuordnung
erzeugen (`.idea/jsonSchemas.xml`, `yaml.schemas` in VS Code) und das Front-Matter-Schema
auf `**/*.md` mappen – ist am 21.08.2026 ausprobiert worden und **greift nicht**: Eine
Zuordnung ordnet einer *Datei* ein Schema zu, und eine `.md` ist für die IDE eine
Markdown-Datei. `docs/theme/schemas.md` nennt jetzt Datum und Grund, damit die Idee nicht
alle paar Monate neu gebaut statt gemessen wird.

---

## 2.1.5

**Die Schemas kommen für die IDE aus dem Paket, nicht von der veröffentlichten URL.**
Liegen die veröffentlichten Schemas hinter einem Login – bei GHE-Pages der Regelfall –,
löst die IDE sie **nicht** auf, und sie sagt es nicht: Vervollständigung und Prüfung
bleiben stumm aus. `theme/jekyll/starter/_config.yml` trägt deshalb jetzt als erste Zeile

```yaml
# yaml-language-server: $schema=theme/jekyll/schema/config.schema.json
```

also denselben relativen Pfad, den dieses Repo selbst benutzt.

`docs/theme/schemas.md` schreibt aus, wie das Theme dafür lokal landet: ein Make-Ziel, das
die **gepinnte** Version per `npm pack` holt – kein `package.json`, kein
`package-lock.json`, kein `node_modules/`, das Repo wird also kein npm-Projekt – und das
`theme/` **vor** dem Download leert. Dazu die Regel, dass der Pin (`THEME_VERSION`) an
genau einer Stelle steht und Pipelines wie Container ihn von dort lesen.

Die Vorlage **ohne** npm (`github-pages/_config.example.yml` mit `deploy.example.yml`)
behält die URL – sie zieht kein Paket. Ihr Kommentar nennt jetzt den Unterschied und die
Folge.

---

## 2.1.4

**`bin/migrate.rb` baut `footer.more` kindweise um.** Bisher benannte die Regel nur den
Kopf um (`footer.more` → `footer.links`) – die Liste darunter hieß weiter `links:`,
obwohl das Schema unter `footer.links` nur `title` und `items` erlaubt. Ein migriertes
Repo fiel damit durch die eigene Schema-Prüfung. Ursache ist die Reihenfolge im Werkzeug:
Greift die Regel für den Elternteil, wird das Kind nicht mehr angesehen. Jetzt stehen
`footer.more.title` → `footer.links.title` und `footer.more.links` → `footer.links.items`
einzeln in der Tabelle; `footer.more` bleibt als leer gewordener Block nicht stehen.

---

## 2.1.3

**Die Kopiervorlage bindet `^2.1.1`.** `theme/jekyll/starter/pages.yml` schreibt seit 2.1.0
`contact.website` ins Config-Overlay – unter einem Theme 2.0.x weist das geschlossene
Config-Schema den Schlüssel ab und die Prüfung vor dem Build schlägt fehl. Die Bindung `^2`
war damit erfüllbar mit einer Fassung, unter der die Vorlage nicht durchläuft.
`starter/README.md` und `docs/verwendung/einbindung.md` nennen die Mindestversion und ihren
Grund.

**`bin/migrate.rb` migriert direkt auf `contact.website`.** Bisher schrieb es
`footer.homepage` nach `brand.website` – dem Namen von 2.0, der seit 2.1.0 nur noch
Rückfall ist. Ein Repo, das heute von 1.x migriert, geht den Schritt jetzt **einmal**. Eine
zweite Regel greift, wenn eine Konfiguration den Zwischenstand `brand.website` beim Lauf
der Stufe schon trägt. Der Migrationsleitfaden
sagt dazu, dass der Footer-Marker `homepage: true` **ersatzlos** entfällt und welcher
Pipeline-Schritt auf `contact.website` umzustellen ist.

**Neue Kopiervorlagen für den Plugin-Hook:** `github-pages/ensure-plugins.sh` und
`github-pages/settings.example.json`. `enabledPlugins` in einer `.claude/settings.json`
aktiviert die Claude-Plugins eines Repos, installiert sie aber nicht – ein geklontes Repo
hat die Datei und keine Skills. Das Skript holt das beim Sitzungsstart nach (Theme zuerst,
weil darauf aufbauende Plugins es als Abhängigkeit deklarieren). Beide Dateien liegen dem
Plugin-Skill `theme-migrieren` bei.

---

## 2.1.2

**Der Website-Link im Footer heißt „Website“, nicht mehr die URL.** Auf dem Bildschirm
ist der Link anklickbar – die ausgeschriebene Adresse ist dort überflüssig und sprengt
als lange URL die schmale Footer-Spalte. **Im Ausdruck bleibt die URL ausgeschrieben:**
Dort gibt es nichts zum Klicken, und ein Text, der die Adresse verschweigt, nützt auf
Papier niemandem.

---

## 2.1.1

**Die Kopiervorlage band das Theme auf `^1`.** `theme/jekyll/starter/pages.yml` setzte
`THEME_VERSION` per Default auf `^1` – wer damit ein Repo einrichtete, installierte
**Theme 1.x** und bekam keinen einzigen Schlüssel von Theme 2, während die
Migrationsseite allen bestehenden Repos genau diese Zeile auf `^2` umzustellen aufgab.
Der Default ist jetzt `^2`; `theme/jekyll/starter/README.md` und
`docs/verwendung/einbindung.md` nennen dieselbe Spanne.

**Die Org-Variable `ACADEMY_WEBSITE` ist eine Konvention, keine Anforderung des
Themes.** Das Theme liest `contact.website` und hat einen Default – woher der Wert
kommt, entscheidet das Repo. Die Vorlagen und der Skill `github-pages-einrichten`
verlangten bisher, den Schritt „Academy-Website aus Org-Variable ins Config-Overlay
schreiben“ *unverändert* zu übernehmen; sie nennen jetzt beide Wege: In einer
Academy-Organisation hält die Variable die URL zentral, außerhalb wird der Schritt
gestrichen und `contact.website` in der eigenen `_config.yml` gepflegt (oder
weggelassen).

Nur Kommentare und Doku – die Vorlagenversion bleibt bei **9**, es ist nichts
nachzuziehen.

---

## 2.1.0

**Die Academy-Website heißt `contact.website`, und der Ausdruck druckt die Adresse statt
eines Ankertextes.**

### `brand.website` → `contact.website`

Die URL der Academy-Website ist eine **Kontaktangabe**, keine Marken-Eigenschaft:
`brand.*` beschreibt sonst nur, wie die Site aussieht (Logo, Icons, Markentext). Sie steht
deshalb jetzt neben `contact.email` und `contact.phone` – dieselbe Gruppe, dieselbe
Ausgabe.

```yaml
contact:
  website: "https://…"     # neu (ersetzt brand.website)
  email:   "academy@atvantage.com"
  phone:   "+49 …"         # optional
```

**Nichts zu tun.** `brand.website` wird weiter gelesen, wenn `contact.website` fehlt –
siehe Register unten. In den Pipelines geschieht der Umzug von selbst: Die Kopiervorlagen
(`theme/jekyll/starter/pages.yml`, `github-pages/deploy.example.yml`, **Vorlagenversion 9**)
schreiben die Org-Variable `ACADEMY_WEBSITE` jetzt nach `contact.website`. **Diese Vorlage
setzt Theme ≥ 2.1.0 voraus** – wer noch auf 2.0.x steht, zieht erst das Theme nach.

### Die Website erscheint jetzt auch im Footer

In der Footer-Spalte „Kontakt“ steht sie **über** der E-Mail-Adresse, verlinkt. Bisher
kannte nur der Ausdruck die Adresse; im Footer musste jedes Repo sie als gewöhnlichen
Eintrag in `footer.links.items` von Hand pflegen – eine zweite Adresse, die nach einem
Domain-Wechsel niemand nachzieht. **Empfehlung:** einen solchen Eintrag aus der eigenen
`_config.yml` entfernen, sonst steht die Academy zweimal im Footer.

### Der Ausdruck trägt die Adressen, nicht ihre Namen

Die Druck-Kontaktzeile zeigt **Website, E-Mail, Telefon** – in dieser Reihenfolge, wie die
Footer-Spalte, und **ohne Links**: die blanke URL statt „ATVANTAGE Academy“, die blanke
E-Mail-Adresse statt eines `mailto:`-Verweises. Auf Papier ist ein Link nur sein Text; ein
Text, der die Adresse verschweigt, nützt dort niemandem. **`contact.phone` erscheint neu
auch im Ausdruck** – bisher stand die Nummer nur im Footer, der beim Drucken ausgeblendet
wird.

Betroffen sind `theme/jekyll/_layouts/default.html` (und alle Layouts, die darauf
aufsetzen) sowie `theme/jekyll/_layouts/presentation.html`.

---

## 2.0.0

**Veröffentlicht am 20.08.2026** (PR #137, als Merge-Commit – die Begründungen der einzelnen
Brüche bleiben damit in der Historie). Hier steht, was sich ändert und was Projekte deshalb tun
müssen.

Sammelstelle und Reihenfolge waren **Issue #123**.

Vollständiger Weg für Projekte: **Doku → Design-System → Migration auf 2.0**
(`docs/theme/migration-2.0.md`).

| Bruch | Issue | Stand |
| ----- | ----- | ----- |
| Benamung von Front Matter und `_config.yml` | #122 | **umgesetzt** – siehe unten |
| `audience`: Werteliste gehört dem Schulungsprozess, nicht dem Theme | #130 | **umgesetzt** – siehe unten |
| `default` wird reiner Rahmen, `page` die gewöhnliche Seite | #124 | **umgesetzt** – siehe unten |
| Der Schalter liegt unter dem Baustein (`sidebar.toc.enabled`) | #122 | **umgesetzt** – siehe unten |
| Werkzeuge und Kommandozeilen-Optionen heißen englisch | #122 | **umgesetzt** – siehe unten |
| Zwei Markup-Namen entfallen (`avd-academy-metanav__right`, `avd-academy-guide-nav`) | #122, #124 | **umgesetzt** – siehe unten |
| Simulations-API, Szenen-Attribut und Schalter-Include heißen englisch | #136 | **umgesetzt** – siehe unten |

### Alle Schlüssel des Themes heißen anders (#122)

**Durchgehend englisch, nach Ort gruppiert, Substantive statt Verben.** Die alten Namen waren
gemischt deutsch und englisch (`einleitung` neben `duration`), trugen Abkürzungen (`toc`),
Markup-Sprache (`resources_box`), Verben (`markdown_copy`) und Präfixe statt Struktur
(`favicon_16`). Vor allem sagten sie nicht, **wo** ein Schalter wirkt – `print_contact` klang
wie ein Drucken-Knopf.

**Front Matter:** `breadcrumb.path` → `breadcrumb.ancestors` (weil `page.path` in Jekyll die
Quelldatei ist), die Schalter
in ihre Gruppen (`sidebar.toc.enabled`, `sidebar.progress.enabled`,
`sidebar.resources.enabled`, `toolbar.copy.enabled`, `toolbar.print.enabled`,
`toolbar.qr.enabled`), die Simulationsfelder
unter `simulation.*` mit `simulation.step.interval` in **Millisekunden** – das Seitenfeld
`duration` zählt Minuten, und zwei Felder gleichen Namens mit verschiedenen Einheiten waren
eine Falle. `resources[].titel` ist entfallen; es gilt `title`.

**`_config.yml`:** `brand.*` (Logo, Icons, Markentext, Website), `code.highlight`, `styles`,
`footer.legal.*`, `nav.items[]` und `footer.links.items[]` in derselben Form wie `resources`,
`components` statt `avd_academy` – und **ohne** die
Zwischenebene `defaults`, die Jekyll für sich belegt. `footer.phone` ist entfallen (dieselbe
Angabe stand unter `contact.phone`), `footer.homepage` wurde `brand.website`, weil auch die
Druck-Kontaktzeile sie liest.

**Ein Nebeneffekt, der die Gruppen rechtfertigt:** Die Zuständigkeit je Layout steht jetzt in
der Form. Ein Layout ohne Sidebar hat keine `sidebar`-Gruppe – genau der Streitpunkt aus #68,
dort noch als Prüfregel im Schema.

**`metanav` ist entfallen.** Die Metaleiste über der Kopfzeile hatte eine rechte Seite für
kurze Verweise, und **kein Projekt hat sie je genutzt** – nicht die Doku-Site, nicht die
Vorlage, nicht die bestehenden Konzept-Repos. Die Leiste zeigt weiter den Markentext
(`brand.tagline`, vormals `contact.tagline` – eine Kontaktangabe, die keine war). Mit den
Links entfällt auch die Klasse `avd-academy-metanav__right`: der einzige Name, den der Markup
Contract in 2.0 verliert.

**Schema-Versionen:** beide auf **2**. Version 1 bleibt erreichbar (archiviert unter
`github-pages/schemas/«name»/1/`, bei jedem Deploy mitveröffentlicht) – ein Repo, das noch auf
`/schemas/config/1/` zeigt, verliert seine Auflösung nicht.

### `default` ist der reine Rahmen, `page` die gewöhnliche Seite (#124)

Bis 1.x war `default` **beides**: Rahmen **und** Seitenlayout. Ein neues Layout begann deshalb
damit, abzuschalten, was es nicht wollte – `chrome: false`, `sidebar: false`,
`breadcrumbs: false`. Jetzt ist die Grundstellung leer, und jedes Layout schaltet **an**, was
es braucht.

| Layout | Erbt von | Was es ist |
| ------ | -------- | ---------- |
| `default` | – | der **reine Rahmen**: `<html>`, `<head>`, Skripte, Footer, Druck-Kontaktzeile |
| `page` | `default` | die **gewöhnliche Seite** – Kopfzeile, Brotkrumen, Hero, Sidebar, Blätter-Navigation |
| `guide` | **`page`** | zusätzlich nummerierte Schritte und Prev/Next aus den Geschwistern |
| `visualization` | `default` | schmaler Hero mit Werkzeugen, keine Kopfzeile, keine Sidebar |
| `presentation` | **–** | eigenständiges Dokument: Folien aus Markdown |
| `simulation` | **–** | eigenständiges Dokument: ein Ablauf zum Durchklicken |

`presentation` und `simulation` erben von **niemandem**: Sie bringen ihr eigenes
`<!DOCTYPE html>` mit und teilen mit dem Rahmen nur CSS, JS und die Schalter. Der Schnitt
berührt sie deshalb nicht.

**`guide` erbt jetzt von `page`**, nicht von `default` – so steht das, was eine gewöhnliche
Seite ausmacht, an genau einer Stelle. Am Build geprüft: Die Eigenschaften werden über die
ganze Kette gemergt, eine Übung behält Kopfzeile, Hero, Brotkrumen, Sidebar und Nummerierung.

**`page` ist die Vorgabe.** `_config.defaults.yml` setzt `layout: page` für die ganze Site –
damit ist `layout` so optional wie jedes andere Feld. Wer den reinen Rahmen will, schreibt
`layout: default` hin.

**Der Schalter-Auflöser kennt `default` nicht mehr** – ausser bei `print.contact`: Ohne
Kopfzeile, Hero und Sidebar gibt es dort nichts zu schalten. Die Druck-Kontaktzeile bleibt,
denn auch ein nackt gedrucktes Blatt soll sagen, woher es kommt.

**Was Projekte tun müssen:** nichts von Hand – `bin/migrate.rb` schreibt `layout: default` auf
`layout: page` um. Das ist sicher, weil es den reinen Rahmen vorher nicht gab: Keine
bestehende Seite kann ihn gemeint haben. Danach **darf** die Zeile auch entfallen.

**Ein Fallstrick, der in der Doku steht:** Jekyll **ersetzt** `defaults`-Arrays, statt sie zu
mergen. Wer selbst einen `defaults:`-Block hat, überschreibt den des Themes – dann gehört
`layout: page` dort hinein. Konzept-Repos, die mit `bin/build.sh` bauen, laden die
Theme-Defaults ohnehin nicht und brauchen den Block in ihrer eigenen `_config.yml`.

### Die Zielgruppen gehören der Site, nicht dem Theme (#130)

Bis Schema 1 schrieb das **Theme** vor, welche Zielgruppen es gibt – ein `enum` mit den Werten
eines einzigen Anwendungsfalls, an vier Stellen: Seite, `resources`-Eintrag, `nav`-Eintrag und
`audience` des Builds. Wer eine dritte Zielgruppe brauchte, hätte das Theme ändern müssen.

Jetzt kennt das Theme den **Mechanismus** und nicht die Liste. Die Site deklariert ihre
Zielgruppen selbst:

```yaml
audiences: [internal, public]     # die Site legt fest, welche es gibt
```

**Die Prüfung ist dabei nicht entfallen, sondern umgezogen.** Ein blosses `type: string` hätte
sie verloren: `audience: publik` (Tippfehler) fiele nirgends auf, und die Seite landete
stillschweigend in **jedem** Build – die schlechteste Fehlerart. `validate.rb` prüft deshalb
jede Angabe gegen `audiences`, an allen vier Stellen. **Und wer `audience` benutzt, ohne zu
deklarieren, bekommt einen Fehler**, kein Achselzucken: Eine Angabe ohne prüfbare Menge ist
eine Vermutung.

Was die IDE verliert: die Vorschläge für die **Werte** von `audience` – ein JSON Schema kennt
keine Liste, die aus derselben Datei kommt. Die Feldnamen vervollständigt sie weiter.

**Was Projekte tun müssen:** `audiences` deklarieren, falls sie `audience` benutzen. Die Werte
bleiben dieselben; sie gehören jetzt dem Repo.

### Die rechte Sidebar scrollt für sich, das Inhaltsverzeichnis klappt

**Zwei Layout-Probleme, ein Umbau.** Eine lange Übung hatte eine Sidebar, die über den
Bildschirmrand hinausreichte: Wer die Karte „Weiterführende Informationen“ sehen wollte,
musste die **ganze Seite** scrollen, bis die Sidebar mitwanderte – und das reichte oft nicht.
Und breite Tabellen rutschten hinter die Sidebar.

- **Die Sidebar ist ein eigener Scrollbereich** (`max-height` bis zum Fensterrand,
  `overflow-y: auto`, `overscroll-behavior: contain`). Am Handy bleibt alles, wie es war.
- **Breite Tabellen brechen jetzt um, statt zu überlaufen.** Zellen erhalten
  `overflow-wrap: break-word`, Code und Links darin `anywhere` – nur das senkt die
  Mindestbreite einer Tabelle wirklich.
- **Neuer Baustein `avd-academy-fold`** – ein Abschnitt, der sich an seiner Stelle
  auf- und zuklappt (auf `<details>`/`<summary>`, ohne JavaScript). Er steht auch **Seiten**
  zur Verfügung; im Ausdruck klappt `print.css` alle Folds auf.
- **Das Inhaltsverzeichnis startet zugeklappt, wenn es lang ist** – aber nur, wenn darunter
  noch eine Karte steht, die es sonst aus dem Bild schiebt. Schwelle site-weit:
  `components.sidebar.toc.open_threshold` (Vorgabe 12); Anfangszustand je Seite:
  `sidebar.toc.open`.
- **Die Karte „Weiterführende Informationen“ ist nur klappbar, wenn es konfiguriert ist**
  (`components.sidebar.resources.open_threshold` oder `sidebar.resources.open`). Ohne
  Angabe bleibt sie ein gewöhnlicher Kasten: Unter ihr steht nichts, sie verdeckt nichts.

**Für Konsumenten:** nichts zu tun. Die Vorgaben wirken ohne Konfiguration, und Markup wie
Tokens bleiben – dazu kommen `avd-academy-fold`, `avd-academy-fold__body`,
`avd-academy-fieldtable`, `avd-academy-fieldtable__layouts` und `avd-academy-tablescroll`.

### Der Schalter heißt `enabled`

Ein Baustein ist ein **Abschnitt**, nicht ein Wahrheitswert: `sidebar.toc.enabled` statt
`sidebar.toc: true`. Erst damit kann derselbe Baustein daneben Weiteres tragen –
`sidebar.toc.open` etwa den Anfangszustand. Wäre der Name selbst der Wert, müsste alles
Weitere in eine Parallelstruktur ausweichen, und dieselbe Sache stünde an zwei Stellen.

**Und der Baustein trägt seine Beschriftung mit.** Jeder von ihnen hat ein `title`: die
Überschrift der Sidebar-Karte („Auf dieser Seite“, „Fortschritt“, „Weiterführende
Informationen“) bzw. den Tooltip des Werkzeugs („Markdown kopieren“, „Diese Seite drucken“,
„Diese Seite auf Deinem Smartphone öffnen“). Einstellbar auf denselben vier Ebenen wie
`enabled` – site-weit, je Layout, je Seite. Ein Repo, das seine Übungen anders nennt, kann das
jetzt in der Sidebar tun, ohne das Theme anzufassen. Aufgelöst wird es im neuen Include
`avd-text.html`; die Vorgaben bleiben, wo sie waren, also ändert sich ohne Konfiguration nichts.

Betroffen sind alle sechs Schalter: `sidebar.toc`, `sidebar.progress`, `sidebar.resources`,
`toolbar.copy`, `toolbar.print`, `toolbar.qr` – auf **allen** Ebenen (Front Matter,
`components.«gruppe»`, `components.layouts.«layout».«gruppe»`). Das Migrationsskript schreibt
die alten Namen direkt auf die neue Form (`qr_code` → `toolbar.qr.enabled`).

### Die Werkzeuge und ihre Optionen heißen englisch

**Bruch für Pipelines, nicht für Inhalte.** Skriptnamen und Kommandozeilen-Optionen waren
gemischt: `ruby pruefen.rb --config` zwang jeden Aufrufer zur Sprachmischung, und diese Namen
stehen in **fremden** Repos.

| vorher | jetzt |
| ------ | ----- |
| `theme/jekyll/schema/pruefen.rb` | `theme/jekyll/schema/validate.rb` |
| `bin/paketinhalt.sh` · `theme/paketinhalt.txt` | `bin/package-contents.sh` · `theme/package-contents.txt` |
| `bin/vorlagen.sh` · `github-pages/vorlagenversion.txt` | `bin/templates.sh` · `github-pages/template-version.txt` |
| `bin/schema-veroeffentlichen.sh` | `bin/publish-schemas.sh` |
| `--pruefen`, `--setzen`, `--selbsttest`, `--wurzel`, `--hilfe`, `--schreiben`, `--von`/`--nach` | `--check`, `--set`, `--self-test`, `--root`, `--help`, `--write`, `--from`/`--to` |
| `make pruefen` | `make check` |

**Was Projekte tun müssen:** den Prüfschritt ihrer Pipeline anpassen – eine Zeile. Der Weg
steht in „Migration auf 2.0“. Die Regel selbst steht ab jetzt in `AGENTS.md`
(„Namen sind englisch“): Jeder Name, den jemand von außen tippt, ist englisch; deutsch bleiben
Prosa, Kommentare, Meldungen und repo-interne Bezeichner.

Die Kopiervorlagen unter `github-pages/` tragen deshalb **Version 8**.

### Auch die Simulations-API heißt englisch – und liest nur noch **einen** Namen (#136)

**Beim Durchgang der Sammelstelle gefunden.** #122 hat Front Matter und `_config.yml`
umbenannt; der Sweep war auf YAML beschränkt. Die **Autorenschnittstelle der Simulation** ist
JavaScript – und nahm jeden Schlüssel **doppelt**: `titel` neben `title`, `dauer` neben
`duration`, dazu `kennung`, `schritte`, `zustand`, `zeichne`, `beschreibung`. Im Skriptkopf
stand als Begründung: „gemischte Bestände sollen nicht an einer Vokabel scheitern.“ Genau das
war das Problem – zwei Namen für dasselbe Feld sind zwei Wartungsorte, und keiner ist der
richtige.

Ab 2.0 gilt **ein** Name, englisch: `title`, `duration`, `id`, `steps`, `state`, `render`,
`description`. Dazu `setup({speed, stepInterval})`, die Helfer `pulse()` und `codeLine()`, das
Ereignis `"step"`, der Kontext `ctx.previous`/`.direction`/`.animated`/`.step`/`.count`/
`.scenario`/`.scenarioIndex`, die Zustandsklassen `is-new`/`is-gone`/`is-active`/`is-error`
sowie `data-avd-academy-sim-scene` und `data-direction="forward|back|start"`.

Zwei Namen außerhalb der Simulation gehören zum selben Bruch: der Include
**`avd-switch.html`** (vorher `avd-schalter.html`) – relevant für Repos mit eigenen Layouts –
und das `data`-Attribut der Szenen-Container, das damit auch im **Markup Contract** neu heißt.

**Was Projekte tun müssen:** In jeder Simulation das Inline-Skript umstellen. `bin/migrate.rb`
**meldet** die betroffenen Dateien samt Mapping-Tabelle, ändert sie aber nicht – es sind
JavaScript-Schlüssel, keine YAML-Zeilen; eine Textersetzung von `titel:` träfe auch Prosa. Der
Weg steht in „Migration auf 2.0“.

### Weggefallen, weil es keinen Nutzer hatte

**Die Blätter-Navigation** (`zurueck`/`weiter` samt automatischer Ableitung aus den
Geschwisterseiten) ist **ersatzlos entfallen**. Wird sie gebraucht, wird sie neu gebaut – bis
dahin wäre sie Aufwand ohne Nutzer: Pflege im Layout, im Schema, in der Doku und in der
Prüfung. Mit ihr entfällt die Klasse `avd-academy-guide-nav`.

**Die Druck-Kontaktzeile ist kein Schalter mehr.** Sie erscheint immer. Ein Blatt Papier ohne
Absender ist wertlos, und niemand hat sie je abgeschaltet – ein Schalter, den keiner umlegt,
ist nur eine Zeile, die geprüft, dokumentiert und mitgeschleppt werden muss.

**Der Footer-Marker `homepage: true`** ist entfallen: Der Verweis auf die Academy-Website ist
ein gewöhnlicher Eintrag mit `url`. `brand.website` bleibt für die Druck-Kontaktzeile.

### Eine Form für alle Verweise

`resources` (Front Matter), `nav.items` und `footer.links.items` (`_config.yml`) haben
**dieselben Felder**: `url`, `title`, `icon`, `audiences`. `nav.items` kennt zusätzlich
`children`. Wer eine Stelle kennt, kennt alle drei – und im Schema steht die Form einmal.

Dazu ist `nav` ein **Abschnitt mit `items`** geworden statt einer Liste: konsistent zu
`footer.links`, und später kann die Navigation weitere Eigenschaften tragen.

### Der Umstieg ist skriptiert

**`bin/migrate.rb`** benennt Front Matter und `_config.yml` um – zeilenbasiert, damit
Kommentare erhalten bleiben, und **stufenweise**: `--from 1 --to 3` führt später beide Stufen
hintereinander aus. Was es **nicht** tut, meldet es: Fälle, in denen sich die Bedeutung ändert
und nicht nur der Name. Dazu gibt es das Plugin-Skill **`theme-migrieren`**.

**Was Projekte tun müssen:** auf `^1` binden (falls noch `latest`), Skript laufen lassen, die
gemeldeten Handarbeitsfälle abarbeiten, prüfen, dann auf `^2` binden.

**Voraussetzung, die bereits erfüllt ist:** Die Konsumenten binden das Theme auf `^1`
(training-concept-java-se#66, didaktikon-playground#59, didaktikon#97) – ein Publish von 2.0.0
fährt damit nirgends ungefragt ein. Der Umstieg auf `^2` ist eine eigene Entscheidung je
Projekt, **nach** dem Release.

---

## Kompatibilitätsschichten – beim nächsten Major zu entfernen

Register der Übergangslösungen, die nur existieren, um einen Bruch zu vermeiden.
**Jeder Eintrag ist technische Schuld mit Verfallsdatum:** Beim nächsten
Major-Sprung wird die Liste durchgegangen und geleert.

| Seit | Kompatibilitätsschicht | Entfällt mit |
| ---- | ---------------------- | ------------ |
| 2.1.0 | `brand.website` wird gelesen, wenn `contact.website` fehlt | **3.0** |
| 2.3.0 | `avd-academy-theme-toggle` und `avd-academy-print-btn` bleiben neben `avd-academy-tool` auf den Knöpfen | **3.0** |

**Eintrag 2.1.0 im Klartext.** Die Academy-Website heißt seit 2.1.0 `contact.website`. Der
alte Schlüssel `brand.website` bleibt als Rückfall lesbar, damit der Umzug keine
Konfiguration bricht. **Beim Sprung auf 3.0 ist zu tun:**

1. Den Rückfall `| default: site.brand.website` aus `theme/jekyll/_layouts/default.html`,
   `theme/jekyll/_layouts/presentation.html` und `theme/jekyll/_includes/footer.html`
   entfernen.
2. `brand.website` aus `theme/jekyll/schema/config.schema.json` streichen (und die
   Schema-Version in `config.version.txt` hochzählen, weil ein bisher erlaubter Schlüssel
   entfällt).
3. In `bin/migrate.rb` unter der Stufe `3` die Regel `%w[brand website] => %w[contact
   website]` ergänzen – dann zieht `ruby bin/migrate.rb --from 2 --to 3` den Schlüssel in
   den Repos um.
4. Die veraltet-Vermerke aus `docs/theme/academy.md`, `docs/theme/schemas.md` und
   `docs/theme/migration-2.0.md` entfernen.

**Projekte müssen danach:** `brand.website` in ihrer `_config.yml` auf `contact.website`
umbenennen (falls überhaupt gesetzt – in den Pipelines schreibt die Vorlage den neuen
Schlüssel bereits seit Vorlagenversion 9).

**Eintrag 2.3.0 im Klartext.** Die Seitenwerkzeuge sind seit 2.3.0 eine Komponente und
tragen `avd-academy-tool`. Die beiden alten Namen stehen im Markup-Vertrag – fremde
Repos selektieren sie in ihrer `assets/custom.css` – und bleiben deshalb als zweite
Klasse auf denselben Knöpfen. **Beim Sprung auf 3.0 ist zu tun:**

1. `avd-academy-theme-toggle` und `avd-academy-print-btn` aus dem Selektor in
   `theme/academy/components.css` und aus der Ausblendliste in
   `theme/academy/print.css` entfernen.
2. Beide Klassen aus den Knöpfen in `theme/jekyll/_includes/tools.html` streichen.
3. `bin/markup-contract.sh > theme/markup-contract.txt` neu erzeugen.

**Projekte müssen danach:** In ihrer `assets/custom.css` `.avd-academy-theme-toggle`
bzw. `.avd-academy-print-btn` auf `.avd-academy-tool--theme` bzw.
`.avd-academy-tool--print` umschreiben. Wer die Werkzeuge nur über die Variablen
`--avd-academy-tool-*` anpasst, ist nicht betroffen.

**Für 2.0 durchgegangen und geleert.** Der Durchgang hat eine Schicht gefunden, die nie hier
stand: `simulation.js` las jeden Autorenschlüssel deutsch **und** englisch. Sie ist mit 2.0
entfernt (#136) – nicht stillschweigend, sondern als beschriebener Bruch. Dass die Liste jetzt
leer ist, heißt: **geprüft**, nicht **angenommen**.

Format für neue Einträge: *seit welcher Version, was die Schicht überbrückt, was
nach ihrer Entfernung von Projekten zu tun ist.*

---

## 1.16.2

**Ein hängender Lauf blockiert die Pipeline nicht mehr.**

Die Workflow-Vorlagen standen auf `concurrency: cancel-in-progress: false` mit einem
**festen** Gruppennamen. Beides zusammen hat einmal zwei Stunden gekostet: Der `deploy`-Job
eines Laufs bekam keinen Runner und blieb in der Warteschlange; weil die Gruppe damit belegt
war, startete danach **kein** Lauf mehr – auch keine PR-Prüfung, und die stand ohne Job und
ohne Meldung auf „pending“.

Jetzt gilt in `theme/jekyll/starter/pages.yml`, `github-pages/deploy.example.yml` und im
`pages`-Workflow dieses Repos:

```yaml
concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true
```

**Beide Hälften sind nötig.** `cancel-in-progress: true` allein hätte es schlimmer gemacht:
Bei einem festen Gruppennamen bricht ein PR-Lauf den laufenden `main`-Deploy ab. Die Gruppe
ist deshalb nach **Ref** getrennt – dann bricht ein Lauf nur seinen eigenen Vorgänger ab.

Bei einer Pages-Site ist das die richtige Vorgabe: Der veröffentlichte Stand ist immer der
letzte, ein überholter Deploy hat keinen Wert.

**Was Projekte tun sollten:** den `concurrency`-Block aus der Vorlage übernehmen
(**Vorlagenversion 4**). Wer es lässt, behält das alte Verhalten – funktioniert, blockiert
aber beim nächsten hängenden Runner wieder alles.

---

## 1.16.1

**Der Markup Contract sichert jetzt auch die `data`-Attribute der Autorenfläche.**

Bisher führte `theme/markup-contract.txt` Klassen und Variablen-Definitionen. Zwei
`data`-Attribute stehen aber ebenso in fremden Repos – belegt, nicht vermutet:

| Attribut | Wo es außerhalb des Themes steht |
| -------- | -------------------------------- |
| `data-avd-academy-sim-szene` | die Simulations-Vorlage lässt Autoren es schreiben; im Java-SE-Repo 9× in handgeschriebenem Markup |
| `data-avd-academy-theme` | Dark-Mode-Selektor in der `assets/custom.css` beider bestehender Repos (`:root[data-avd-academy-theme="dark"]`) |

Fällt eines weg, bricht es dort still. Jetzt bricht stattdessen der Build: 191 Namen (108
Klassen, 81 Variablen, 2 Attribute).

**Bewusst nicht aufgenommen sind die übrigen ~49 `data`-Attribute.** Das sind JS-Haken der
Layouts (`…-nav-toggle`, `…-qr`, `…-print`); sie alle aufzunehmen hieße, Internes als
Versprechen einzufrieren – jeder Umbau von `header.html` oder `atvantage.js` bräuchte dann
eine Begründung als Bruch. Das Kriterium steht im Kopf von `bin/markup-contract.sh`: Im
Contract ist, was **Autoren schreiben** oder was **Repos in ihrem CSS selektieren**.

---

## 1.16.0

**Die Front-Matter-Doku sagt jetzt, wann man ein Feld weglässt** – und die Schemas liegen
unter einer Adresse, die je Schema versioniert ist.

### Jedes Front-Matter-Feld ist optional – als geprüfte Regel

Zu jedem Feld gibt es einen Standardwert; eine Seite ohne Front Matter baut, und zwar
richtig. Das steht nicht nur in der Doku: `frontmatter.schema.json` darf auf oberster Ebene
**kein `required`** tragen, und der Selbsttest bricht ab, wenn doch. Wer eine `.md` anlegt,
soll schreiben können, ohne vorher eine Feldliste zu lesen.

### Empfehlungen je Feld, als Info-Schaltfläche

Neue Variante der Reveal-Komponente: **`avd-academy-reveal--info`** – ein runder Knopf mit
Info-Zeichen statt einer Titelzeile, für Tabellenzellen. Der Titel steckt als visuell
verborgener Text im `summary`; Screenreader lesen ihn, und er wird zur Überschrift des
Panels. Im Ausdruck entfällt der Knopf und der Titel erscheint als Zeile.

Damit dokumentiert sind: `layout` (was ohne Angabe gilt, mit Links zu allen Layout-Seiten),
`title` (in Markdown besser weglassen und `#` schreiben – in HTML umgekehrt, weil ein `<h1>`
im Rumpf nicht ausgewertet wird), `duration` (Bearbeitungszeit bei Übungen, Lesedauer bei
Seiten, Vortragszeit bei Folien) und `audience` (warum das Theme es nicht liest).

### Neue Adresse: `/schemas/«name»/«version»/schema.json`

Vorher: `/schema/1/config.schema.json` – eine gemeinsame Version für beide Schemas. Jetzt
trägt **jedes Schema seine eigene Version**, denn sie entwickeln sich unabhängig; eine
gemeinsame Nummer hätte bei jeder Änderung des einen auch das andere „neu“ gemacht.

```yaml
# yaml-language-server: $schema=https://«doku-site»/schemas/config/1/schema.json
```

Der Verweis des Konfigurations-Schemas auf das Front-Matter-Schema wird beim Veröffentlichen
auf `../../frontmatter/«version»/schema.json` umgehängt – relativ, damit er ohne bekannte
Basis-URL trägt und einen Domainwechsel überlebt. `validate.rb` löst `$ref` deshalb **relativ
zur Datei auf, in der er steht** und versteht damit beide Ablagen; für die veröffentlichte
gibt es `--frontmatter-schema` und `--config-schema`.

**Alte Versionen bleiben erreichbar:** Beim Erhöhen gehört die bisherige Fassung nach
`github-pages/schemas/«name»/«alt»/schema.json`, von wo sie mitveröffentlicht wird. Ein
Deploy ersetzt die ganze Site – ohne diesen Schritt wäre die alte URL weg.

**Was Projekte tun müssen:** nichts. Die alte URL war einen Tag alt und stand in keinem
Repo; die `$schema`-Zeile der Kopiervorlage zeigt bereits auf die neue.

---

## 1.15.0

**Front Matter und `_config.yml` haben ein Schema** (Issue #120).

Bis hierher waren beide YAML-Quellen ungeprüft. `ressources:` statt `resources:` baute
fehlerfrei und ließ die Sidebar-Karte einfach weg; `duration: "45"` ergab einen Zeit-Tag,
der nicht rechnet. Jekylls `--strict_front_matter` hilft dabei nicht – es prüft die
YAML-**Syntax**, nicht die Feldnamen.

Neu im Paket, unter `jekyll/schema/`:

| Datei | Inhalt |
| ----- | ------ |
| `frontmatter.schema.json` | alle Felder, die das Theme (bzw. der Zielgruppen-Build) aus dem Front Matter liest – **geschlossen**, repo-eigene Felder mit Präfix `x_` |
| `config.schema.json` | die `_config.yml`: Jekyll-Standard **plus** Theme-Schlüssel – **offen**, damit Plugins und eigene Schlüssel durchgehen |
| `validate.rb` | der Prüfer (Ruby-Standardbibliothek, kein Gem, kein Netz) |
| `version.txt` | die **Schema-Version** – eine eigene, kleine Zählung |

**Die Schema-Version ist nicht die Theme-Version.** Sie steigt nur bei einer
inkompatiblen Änderung (Feld entfernt, umbenannt, Typ verengt); neue optionale Felder
sind additiv. Deshalb darf ein Projekt auf eine Schema-Version zeigen und muss keinen
Zeiger nachziehen, wenn das Theme ein Patch weiterwandert.

**Für die IDE** werden die Schemas unter einer stabilen, versionierten URL veröffentlicht
(`«Theme-Doku»/schema/«Version»/…`; Basis aus der Org-Variablen `ACADEMY_THEME_DOCS`).
In der `_config.yml` genügt **eine Zeile** – keine Kopie je Repo:

```yaml
# yaml-language-server: $schema=https://«doku-site»/schema/1/config.schema.json
```

**Was Projekte tun können** (nichts davon ist Pflicht – der alte Stand baut unverändert):

- Die `$schema`-Zeile als **erste** Zeile der `_config.yml` ergänzen; nur dort lesen sie
  VS Code und die JetBrains-IDEs.
- Den Prüfschritt in die eigene Pipeline übernehmen – die Vorlagen
  (`github-pages/deploy.example.yml`, `theme/jekyll/starter/pages.yml`) bringen ihn mit
  (**Vorlagenversion 2**).
- Repo-eigene Felder auf das Präfix `x_` umstellen, falls es welche gibt – im Front Matter
  wie in den getippten Abschnitten der `_config.yml`. Belegter Fall: der Marker
  `academy_website: true` in `footer.more.links`, den die Pipeline eines Schulungsrepos
  liest und das Theme nicht; er heißt künftig `x_academy_website`.

Außerdem geprüft wird jetzt, **dass die `avd_academy`-Schalter zum Layout passen**:
`layouts.simulation.toc` ist ein Fehler, weil die Simulation keine Sidebar hat. Das war
der offene Rest aus Issue #68.

Vollständige Feldlisten mit Beispielen: **Doku → Design-System → Schemas**.

### Der Academy-Link im Footer gehört jetzt dem Theme

Ein Eintrag in `footer.more.links` mit **`homepage: true`** ist der Verweis auf die
Academy-Website. Sein Ziel löst das Theme aus `footer.homepage` auf – dem Wert, den die
Pipeline aus der Org-Variablen `ACADEMY_WEBSITE` setzt; ohne ihn greift derselbe Default
wie in der Druck-Kontaktzeile. Ein eigenes `url` ist unnötig, ohne `title` erscheint
„ATVANTAGE Academy“:

```yaml
footer:
  more:
    links:
      - { homepage: true }
```

Aufgefallen ist die Lücke beim Prüfen des ersten echten Repos: Dort trug der Link einen
repo-eigenen Marker, und der Workflow schrieb seine URL zur Build-Zeit um – dieselbe
Mechanik in jedem Repo, in Workflow **und** Build-Skript, für eine Angabe, die das Theme
ohnehin kennt. Nach einem Domain-Wechsel wäre jede Kopie einzeln nachzuziehen.

**Was Projekte tun können:** den eigenen Marker samt Umschreib-Schritt entfernen und den
Link auf `homepage: true` umstellen. Wer es lässt, behält seinen bisherigen Stand –
`footer.more.links` verhält sich unverändert, solange kein `homepage` daran steht.

---

## 1.14.1

**Der Markup Contract ist festgehalten und gegen Wegfall gesichert** (Issue #126,
herausgelöst aus #120).

Projekte schreiben die Klassen des Themes in ihr Markdown (`avd-academy-callout`,
`avd-academy-grouptable`, `avd-academy-doclink` …) und überschreiben seine Variablen in
ihrer `assets/custom.css` (`--avd-orange` für die Schulungs-Akzentfarbe). **Verschwindet
ein Name, bricht das in fremden Repos** – und hier fiel es niemandem auf, weil nichts
danach fragte.

Der Fall ist nicht konstruiert: `theme/atvantage/` wird bei einem neuen Export
**ersetzt**, nicht bearbeitet. Fällt dabei eine Variable weg, ist es ein stiller Bruch in
jedem Schulungs-Repo.

`theme/markup-contract.txt` führt jetzt **188 Namen** – 107 Klassen und 81
Variablen-**Definitionen**. Nur Definitionen: Was nur benutzt und nirgends gesetzt wird,
ist kein Versprechen.

**Asymmetrisch geprüft, und das ist Absicht:**

- Ein Name, der **wegfällt**, lässt die Prüfung scheitern – das ist der Bruch.
- Ein Name, der **dazukommt**, nicht. Er wird nur gemeldet, samt Befehl zum Nachziehen.
  Sonst rauschte die Prüfung bei jeder Ergänzung und würde weggeklickt.

Der Preis dieser Wahl ist benannt: Das Artefakt veraltet, wenn niemand es nachzieht.
Deshalb steht die Pflicht in `AGENTS.md`, und der Hinweis erscheint bei jedem Lauf.

**Generiert, nicht gepflegt:** 188 Namen von Hand zu führen wäre eine zweite Wahrheit,
die driftet.

Geprüft im PR (`npm-validate`) und lokal über `make pruefen`.

**Eingestuft als Patch:** ein generiertes Artefakt und ein Prüfschritt. Am ausgelieferten
Paket ändert sich nichts – die Paketprüfung belegt es (56 Dateien, unverändert).

---

## 1.14.0

### Der Rahmen kennt seine Kinder nicht mehr (Issue #119)

`default.html` verzweigte an **16 Stellen** auf `page.layout == 'visualization'` bzw.
`== 'guide'`. Damit erforderte **jedes neue Layout einen Eingriff in diese Datei** – und
damit einen PR, der Theme, Vorlagen und Plugin gleichzeitig anfasst. Genau diese Reibung
war der Anlass der Architekturdiskussion (#64).

Jetzt sagt jedes Layout **selbst**, was es anders macht – über sein eigenes Front
Matter, das Jekyll dem Rahmen als `layout.*` bereitstellt:

```yaml
# _layouts/visualization.html
layout: default
body_class: avd-academy-guide--viz
chrome: false
breadcrumbs: false
hero: slim
hero_tools: true
sidebar: false
duration_tag: false
prev_next: false
```

Zehn Eigenschaften – `body_class`, `chrome`, `breadcrumbs`, `hero`, `hero_tools`,
`sidebar`, `duration_tag`, `numbered_steps`, `prev_next`, `prev_next_siblings` – ersetzen
die Namensprüfungen. Sie gehören zu **Layouts, nicht zu Seiten**: Gelesen wird `layout.*`,
nie `page.*`. Was eine Seite steuern darf, sind die Schalter.

**Ein neues Layout braucht `default.html` nicht mehr anzufassen.**

### Neu: `layout: page`

Die gewöhnliche Seite, **benannt**. Setzt keine Eigenschaft und ist damit **identisch** zu
`layout: default` – sagt aber, was die Seite ist. `default` sagt nur, dass niemand
nachgedacht hat, und verdeckt, dass es eigentlich der geteilte Rahmen ist.

`layout: default` bleibt gültig und verhält sich unverändert.

**Eingestuft als Minor:** ein neues Layout und ein neues, dokumentiertes
Erweiterungsmodell für Layouts. Kein bestehendes Markup und kein Front Matter ändert
seine Wirkung – nachgemessen: 52 gebaute Seiten gegen 1.13.5, **0 inhaltliche
Unterschiede**, und `layout: page` liefert Byte-gleiches HTML wie `layout: default`.

**Für 2.0 gesammelt** (siehe das 2.0-Sammelissue): `default` künftig als **rein**
neutraler Rahmen, `page` verbindlich – und der Schalter-Auflöser
(`_includes/avd-schalter.html`) auf Eigenschaften statt Layout-Namen. Beides bricht
bestehende Repos und ist hier bewusst nicht enthalten.

---

## 1.13.5

**Zwei Prüfungen, die bisher Handarbeit oder gar nichts waren** (Issue #118, Teil 1 von
#106).

### Der Paketinhalt ist prüfbar

`theme/package.json` führt eine bewusst enge `files`-Liste – und forderte im
`_filesComment` eine **Handprüfung** mit `npm pack --dry-run`. Die macht niemand
zuverlässig; **#67 belegt, was dann passiert**: 24 Werkstattseiten in jedem Bundle, im
Playground sogar im öffentlich gepushten Lernenden-Bundle.

Neu: `theme/package-contents.txt` listet die **55 Dateien**, die tatsächlich im Paket landen.
Der PR-Check `npm-validate` vergleicht dagegen (`bin/package-contents.sh --check`) und sagt
im Fehlerfall, was zu tun ist – Liste absichtlich erweitert oder `files` falsch. Lokal
über `make pruefen`.

Die Liste trägt **nur Pfade**, keine Größen oder Hashes: Sie soll sich ändern, wenn
Dateien **hinzukommen oder wegfallen** – nicht bei jeder Textänderung. Sonst rauscht die
Prüfung und wird weggeklickt. Grundlage ist `npm pack --dry-run` selbst, keine
Nachbildung der `files`-Logik.

### Kopiervorlagen tragen eine Vorlagenversion

`github-pages/_config.example.yml` und `deploy.example.yml` werden in Ziel-Repos
**kopiert** und trugen danach keinen Bezug zur Quelle. Der Schaden ist belegt: Der
`Makefile` von `training-concept-java-se` war von seiner Vorlage abgedriftet – **deshalb**
überlebte dort eine Fehlerfalle, die in der Vorlage längst behoben war. Aufgefallen ist
das nur, weil jemand zufällig beide Dateien nebeneinander gelegt hat.

Jede Vorlage trägt jetzt im Kopf `# Vorlagenversion: N · Quelle: … · Aktualisieren: …`.
Die kanonische Nummer steht **an einer Stelle**
(`github-pages/template-version.txt`) und gilt für alle Vorlagen zusammen – sie werden
gemeinsam kopiert. Es ist eine **eigene, kleine Zählung**, nicht die Theme-Version: Die
ändert sich bei jedem Patch und sagt über die Vorlagen nichts.

Der **Aktualisierungsweg** steht in `github-pages/README.md`, für beide Seiten: Wie ein
Verbraucher erkennt, dass seine Kopie alt ist (und warum er sie **nicht blind
überschreibt** – sie trägt eigene Anpassungen), und wann ein Maintainer die Nummer
erhöht. Maßstab dafür: **Müsste ein bestehendes Repo etwas tun?** Reine Formulierungen
zählen nicht – eine Zahl, die bei jeder Kommaänderung steigt, wird ignoriert.

Beide Regeln stehen als Pflicht in `AGENTS.md`, damit auch eine KI sie einhält. Der
PR-Check `pages` prüft die Kopfzeilen.

**Eingestuft als Patch:** zwei Prüfungen und Kopfzeilen in Vorlagen – am ausgelieferten
Paket ändert sich nichts (die Prüfung belegt es: 55 Dateien, unverändert).

---

## 1.13.4

**Der Druck-Knopf der Präsentation hängt jetzt auch am Schalter.** `print_button` deckt
damit **beide** Knöpfe ab, die dieselbe Absicht haben: den im Hero der Visualisierung
(`data-avd-academy-print`) und den in der Werkzeugleiste der Präsentation
(`data-avd-academy-present-print`, druckt alle Folien).

**Ein Schalter statt zwei Namen**, weil die Frage dieselbe ist: „Darf man diese Ansicht
über einen Knopf drucken?“ Wer ihn abschaltet, meint nicht den einen von beiden.

| Schalter | `default` | `guide` | `visualization` | `presentation` | `simulation` |
| -------- | --------- | ------- | --------------- | -------------- | ------------ |
| `print_button` | – | – | **an** | **an** | – |

**Unberührt bleiben** die übrigen Werkzeuge der Präsentation – Farbschema-Umschalter,
Vollbild, Zurück. Sie gehören zur Bedienung des Ablaufs, nicht zur Ausgabe.

**Eingestuft als Patch:** eine weitere Auslesestelle für einen bestehenden Schalter,
Vorgabe unverändert **an** (52 Seiten gegen 1.13.3, 0 inhaltliche Unterschiede).

Damit ist der Mechanismus aus **#68** vollständig: Sieben Schalter, jeder mit
ausgeschriebener Zuständigkeit, vier Ebenen von der harten Vorgabe bis zum Front Matter.

---

## 1.13.3

### Schalter werden nur dort gelesen, wo es den Baustein gibt

Die Doku sagte für `toc` und `resources_box` „überall außer `visualization`“ – und
verschwieg, dass **Präsentation und Simulation überhaupt keine Sidebar rendern**. Der
Auflöser antwortete dort brav mit `false`, obwohl die richtige Antwort „gibt es hier
nicht“ ist. Folge: `layouts.presentation.toc: false` sah aus wie eine Einstellung und
war keine.

Jeder Schalter trägt jetzt eine **Zuständigkeit** – die Liste der Layouts, in denen er
tatsächlich ausgelesen wird. Außerhalb davon ist die Antwort `false`, und die
**Konfiguration wird nicht gelesen**. Ein YAML-Eintrag, der aussieht, als täte er etwas,
ist schlimmer als keiner.

| Schalter | `default` | `guide` | `visualization` | `presentation` | `simulation` |
| -------- | --------- | ------- | --------------- | -------------- | ------------ |
| `markdown_copy` | aus | **an** | aus | – | – |
| `toc` | **an** | **an** | – | – | – |
| `progress` | aus | **an** | – | – | – |
| `resources_box` | **an** | **an** | – | – | – |
| `print_contact` | **an** | **an** | **an** | **an** | – |
| `print_button` | – | – | **an** | – | – |
| `qr_code` | **an** | **an** | **an** | **an** | **an** |

`–` heißt: Der Bereich wird dort nicht gerendert. `toc`, `progress` und `resources_box`
verlieren damit auch die Visualisierung – deren Sidebar steht unter `unless isViz` und
existiert gar nicht.

### Neu: `print_button`

Der **Drucken-Knopf** im Hero der Visualisierungs-Ansicht ist schaltbar – zuständig nur
dort, denn auf gewöhnlichen Seiten wäre er eine Dopplung des Browser-Befehls. **Nicht zu
verwechseln mit `print_contact`**, der Kontaktzeile im Ausdruck. Der Druck-Knopf der
Präsentation ist ein anderes Element (`data-avd-academy-present-print`) und gehört zu
ihrer Werkzeugleiste – wie der Farbschema-Umschalter nicht schaltbar.

### `print_contact` wirkt jetzt auch in der Präsentation

Die Zeile stand in `presentation.html`, der Schalter wurde dort aber nicht gelesen – die
Doku versprach mehr, als das Layout tat. Jetzt ist er verdrahtet.

**Eingestuft als Patch** – auf ausdrückliche Ansage, obwohl es streng genommen eine
Inkompatibilität ist: Konfigurationseinträge für unzuständige Kombinationen werden nicht
mehr gelesen. Sie hatten aber ohnehin keine Wirkung, also ändert sich für jedes Projekt
nichts – nachgemessen: 52 Seiten gegen 1.13.2, **0 inhaltliche Unterschiede**.

---

## 1.13.2

**„Markdown kopieren“ bietet keine Kopie mehr an, die falsch wäre** (Issue #113).

Das Kopierfeld wird mit `page.content` gefüllt – der **rohen Quelle**: Jekyll baut die
`page`-Variable, bevor es den Inhalt rendert. Liquid ist darin nicht ausgeführt, und die
Kopie war deshalb die **Anweisung statt ihres Ergebnisses** – eine `for`-Schleife statt
der Kacheln, oder die wörtlichen raw-Marker statt des Textes, den sie schützen. Still
falsch: Sie sieht wie Markdown aus und tut beim Einfügen nichts.

Enthält die Quelle Liquid, **entfällt der Knopf** – samt `<textarea>`. Im HTML steht an
der Stelle ein Kommentar mit der Begründung, damit niemand sucht. **Erzwingen** geht mit
`markdown_copy: force` im Front Matter, für Seiten, deren Liquid im Ergebnis nicht ins
Gewicht fällt.

**Nachrendern wäre der offensichtliche Wunsch und ist keine Option:** Es bräuchte einen
Filter wie `liquify` aus einem Plugin, und das Theme bleibt abhängigkeitsfrei; `content`
ist HTML und widerspricht dem Zweck.

**Eingestuft als Patch:** Eine Kopie, die nachweislich falsch war, wird nicht mehr
angeboten – kein neues Verhalten, sondern der Wegfall eines stillen Fehlers. Guides ohne
Liquid bleiben unverändert (52 Seiten gegen 1.13.1 verglichen, 0 inhaltliche
Unterschiede).

---

## 1.13.1

**`qr_code` ist schaltbar, und die harten Vorgaben stehen je Layout ausgeschrieben**
(Issue #112).

Der QR-Code war der letzte Baustein, der fest verdrahtet blieb – er erscheint an **vier**
Stellen: Kopfzeile (`header.html`), Hero der Visualisierungs-Ansicht, Kopfleiste der
Präsentation und der Simulation. Alle vier hängen jetzt am Schalter, Vorgabe **an**; ohne
Konfiguration ändert sich nichts.

Dazu die Vorgaben **je Layout explizit** statt „überall außer …“: `presentation` und
`simulation` sind eigenständige Layouts ohne Sidebar – die alte Formulierung lieferte für
sie `toc: true`, obwohl es dort keine ToC gibt. Heute harmlos (das Layout fragt nicht),
aber falsch dokumentiert und bei jedem weiteren Schalter eine Falle. Die Matrix steht
jetzt in der Doku, mit `–` für „gibt es dort nicht“.

Nebenbei festgehalten, weil verwechselbar: Die Fortschrittsleisten von Präsentation und
Simulation sind **nicht** der Schalter `progress` – der meint die Sidebar-Karte mit den
Definition-of-Done-Haken.

**Eingestuft als Patch:** ein weiterer Schalter im bestehenden Mechanismus, kein
geändertes Verhalten (52 Seiten gegen 1.13.0 verglichen, 0 inhaltliche Unterschiede).

---

## 1.13.0

### Bausteine sind schaltbar – mehrstufig (Issue #68)

Was auf einer Übung richtig ist, steht auf einer Katalogseite im Weg: „Markdown
kopieren“, das Inhaltsverzeichnis, der Fortschritt. Bisher entschied das Layout allein,
und zwar fest verdrahtet. Neu ist **ein** Mechanismus mit **vier Ebenen** – die spätere
gewinnt:

1. **harte Vorgabe je Layout** (im Theme, `_includes/avd-schalter.html`)
2. `avd_academy.defaults` in `_config.yml` – site-weit
3. `avd_academy.layouts.«layout»` – site-weit je Layout
4. **Front Matter der Seite**

```yaml
avd_academy:
  defaults:
    print_contact: false
  layouts:
    default:
      toc: false
```

Fünf Schalter zum Start: `markdown_copy`, `toc`, `progress`, `resources_box`,
`print_contact`. Die harten Vorgaben entsprechen **genau** dem bisherigen Verhalten –
ohne Konfiguration ändert sich nichts (nachgemessen: 52 gebaute Seiten,
**0 inhaltliche Unterschiede** gegenüber 1.12.x).

- **`markdown_copy` schaltet Knopf und `<textarea>` gemeinsam** – sonst reiste die
  vollständige Seitenquelle unsichtbar im HTML mit; auch die Berechnung des Kopiertexts
  entfällt. Harte Vorgabe: **nur `layout: guide`**, wie es `atvantage.js` seit je
  behauptet („auf Übungsseiten“).
- **`resources_box`, nicht `resources`:** Der Schlüssel `resources` trägt im Front
  Matter die Linkliste selbst; ein gleichnamiger Schalter würde sie als Ja/Nein-Wert
  lesen.
- **Geprüft wird auf „nicht gesetzt“, nicht auf „wahr“.** Nur so kann eine Seite einen
  Schalter auf `false` ziehen, den die Ebene darunter auf `true` gesetzt hat.
- **Die harte Vorgabe steht im Include, nicht in `_config.defaults.yml`** – zwei der
  drei Consumer laden diese Datei nicht. Eine Vorgabe nur dort hätte für sie nicht
  gegolten.
- **Ein Schalter auf oberster Ebene von `_config.yml` wirkt nicht** und ist ein stiller
  Irrtum; er gehört unter `avd_academy`.

Die Struktur ist nach Schlüsseln **offen**: Ein neuer Schalter braucht einen
`when`-Zweig im Include, eine `capture`-Abfrage im Layout und eine Zeile in der Doku –
kein neues YAML-Schema. `qr_code` ist der nächste Kandidat; er erscheint an vier
Stellen (Hero der Visualisierung, Kopfzeile, Präsentation, Simulation) und bekommt
deshalb einen eigenen Durchgang.

**Eingestuft als Minor:** neue Konfiguration, kein geändertes Verhalten.

---

## 1.12.0

### Aktionsspalte am Zeilenende der gruppierten Tabelle

Hat **jede Zeile ein Ziel**, das man ansteuern soll, dann gehört der Verweis nicht in
die Inhaltszelle: Dort beginnt er in jeder Zeile an einer anderen Stelle und sieht aus
wie ein Teil des Textes – beim Überfliegen geht er unter. Neu ist
`avd-academy-grouptable__action`: eine **eigene, letzte Spalte** mit getönter Fläche
über die **volle Zeilenhöhe** – immer an derselben Stelle, groß genug, um sie zu
treffen, ohne zu zielen.

```html
<td class="avd-academy-grouptable__action" markdown="span">[<span class="avd-academy-visually-hidden">«Ziel» öffnen</span>](«ziel».md)</td>
<td class="avd-academy-grouptable__action"></td>   <!-- Zeile ohne Ziel: leer -->
```

- **Getönt wird nur, wo ein Ziel dahintersteht** (`:has(a)`) – so ist auf einen Blick
  zu sehen, welche Zeilen eines haben.
- **Das Play-Zeichen kommt aus dem Theme**, als CSS-Maske in der Akzentfarbe. **Kein
  `▶️` ins Markup**: Ein Emoji sieht je Plattform anders aus (auf manchen blau), lässt
  sich nicht einfärben und folgt der Schriftgröße nicht. Ins Markup gehört nur eine
  Beschriftung für Screenreader – ein Link ohne Text ist für sie stumm.
- **Zeilen über die volle Breite** (`…__gap`, `…__alert`) zählen die Spalte mit:
  `colspan` um eins erhöhen.
- **Im Ausdruck entfällt die Spalte** – eine Fläche zum Anklicken ist auf Papier
  sinnlos.

`…__link` bleibt unverändert für den anderen Fall: ein Verweis, der zum Satz gehört.

Die Änderung kommt als Rückmeldung aus `training-concept-java-se` (Register-Eintrag
A-004): Dort war die Spalte in der `assets/custom.css` des Repos nachgebaut – vier
Regeln, die in jedem Schulungs-Repo erneut entstehen würden.

**Eingestuft als Minor:** eine neue Klasse in einer bestehenden Komponente; kein
vorhandenes Markup ändert seine Wirkung.

---

## 1.11.0

### Aufdeckbarer Inhalt: `avd-academy-reveal`

Ein **Titel, der wie ein Link aussieht** – der Inhalt erscheint erst auf Klick,
**mittig** über der Seite; Klick daneben, ESC oder das Kreuz schließen. Der Inhalt ist
**gewöhnliches Markdown** und steht an seiner Stelle im Dokument.

```markdown
<details class="avd-academy-reveal" markdown="1">
<summary>Was dieser Kurs bewusst nicht behandelt</summary>

| Bewusst nicht hier | Warum |
| --- | --- |
| … | … |

</details>
```

**Wofür:** Material, das den Lesefluss unterbrechen würde, aber greifbar bleiben soll –
Musterlösungen neben einer Aufgabe, Legenden, Abgrenzungstabellen. Es ersetzt keinen
Callout: Ein Callout will gelesen werden, ein Reveal will verfügbar sein.

**Auf `<details>` aufgebaut, nicht auf einem Klick-Handler.** Ohne JavaScript bleibt es
ein gewöhnlicher Aufklapper, und der Inhalt ist erreichbar – ein Popup, das nur mit JS
existiert, verliert im Fehlerfall Schulungsinhalt. Die mittige Darstellung macht CSS
allein (am Attribut `[open]`).

**Im Ausdruck steht der Inhalt eingebettet** an seiner Stelle in der Seite, auch wenn er
am Bildschirm zu war: Wer eine Unterlage auf Papier durcharbeitet, kann nichts
anklicken. Das Aufklappen dafür übernimmt `atvantage.js` (`beforeprint`) – und das ist
kein Umweg, sondern nötig: Ein geschlossenes `<details>` verbirgt seinen Inhalt über
einen Slot im **Shadow DOM**, was von außen per CSS nicht aufzuheben ist.

Für Inhalte, die auf Papier **nicht** erscheinen dürfen, gibt es
`avd-academy-reveal--screen-only`. Der wichtige Fall sind **Musterlösungen neben der
Übung**: Ein Ausdruck, der die Lösung mitbringt, nimmt der Übung den Sinn.

### `audience` wirkt jetzt auch im Untermenü der TopNav

Die Doku sagte es bereits („Ein Eintrag **oder Kind** kann per `audience:` …“), die
Umsetzung tat es nicht: Der Filter griff nur für **Haupteinträge**. Ein Kind mit
`audience: trainer` erschien damit auch in der Lernenden-Unterlage – im schlechtesten
Fall ein Link auf eine Seite, die es dort nicht gibt (404).

Jetzt gilt `audience` je Kind. Bleibt in einer Gruppe **kein** Kind übrig, entfällt die
Gruppe mit – ein Aufklappmenü ohne Einträge wäre eine Schaltfläche, die nichts tut.

**Ebenfalls dokumentiert, aber bisher nirgends beschrieben:** `resources`-Einträge im
Front Matter kennen `audience` schon lange. Damit kann **dieselbe** Seite beide
Zielgruppen bedienen und dem Trainer zusätzlich Regie-Material anbieten; bleibt kein
Eintrag übrig, entfällt der ganze Kasten.

**Eingestuft als Minor:** eine neue Komponente und neue CSS-Klassen. Der
`audience`-Anteil allein wäre ein Patch – dokumentiertes Verhalten, das nicht wirkte –,
zusammen entscheidet die neue Funktion.

---

## 1.10.0

### Die Materialübersicht für Lernende kommt aus dem Theme

Die Aufstellung der Unterlagen auf der Lernenden-Startseite – **je Themenblock
zwei Spalten: links die Übungen, rechts das Material zum Nachschlagen** – ist jetzt
eine Theme-Komponente. Bisher hat jedes Schulungs-Repo sie in seiner
`assets/custom.css` nachgebaut und **eigene Kopien der Format-Icons** mitgeschleppt;
dieselben Formate sahen von Repo zu Repo unterschiedlich aus.

Neue Klassen: `avd-academy-topic` (Themenblock mit Akzentlinie),
`avd-academy-materials` + `…__col` + `…__head` (das Zwei-Spalten-Raster).

### Typisierte Dokumentlinks: `avd-academy-doclink`

Ein Link sagt über eine **Klasse**, auf welches Format er zeigt – das Icon liefert
das Theme:

```markdown
- [Die Java-Plattform erkunden](einfuehrung-java/issue.md){: .avd-academy-doclink .avd-academy-doclink--guide}
- [Entstehung von Java](einfuehrung-java/praesentation.md){: .avd-academy-doclink .avd-academy-doclink--slides}
```

Modifier: `--guide`, `--slides`, `--visualization`, `--simulation`, `--overview`.
Die Klassen gelten überall, nicht nur in der Materialübersicht.

Dazu liefert das Paket die Icons neu mit (`academy/icons/*.svg`); die CSS verweist
**relativ** darauf, damit derselbe Verweis mit und ohne `baseurl` trägt.

> **Migration (optional, empfohlen):** Wer `<img src="…/icon-guide.svg">` vor
> seinen Links stehen hat, ersetzt das durch die Klassen, löscht die lokalen
> `assets/icons/` und die nachgebauten Regeln aus `assets/custom.css`. Nichts
> bricht, wenn es stehen bleibt – es bleibt nur eine zweite Quelle derselben
> Gestaltung.

**Eingestuft als Minor:** nur neue Klassen und neue Paketdateien; kein bestehendes
Markup ändert seine Wirkung.

---

## 1.9.0

### Der Zurück-Link weicht einem Zurück-Knopf

**Die Layouts `presentation` und `simulation` verlinken nicht mehr auf eine im
Front Matter (`zurueck`) angegebene „übergeordnete“ Seite.** Das war geraten: Aufgerufen wird
eine Präsentation über das Modul, aus der Suche, per QR-Code vom Beamer oder aus
einem Chat – ein fester Link führt dann in vier von fünf Fällen woandershin, als
man gekommen ist.

An seiner Stelle steht ein **Zurück-Knopf**, der `history.back()` ruft und damit
dahin führt, wo jemand **tatsächlich** herkam. Er bleibt verborgen, wenn es keinen
Verlauf gibt (frischer Tab). Verdrahtet über `[data-avd-academy-back]` in
`theme/academy/atvantage.js` – damit steht er jedem Layout offen.

> **Migration:** `zurueck` aus dem Front Matter von Seiten mit
> `layout: presentation` und `layout: simulation` entfernen. Das Feld erzeugt
> keinen Fehler, wirkt dort aber nicht mehr – stehen bleiben würde es nur als
> Irrtum für den nächsten Leser. **In Guides bleibt `zurueck` unverändert**: Dort
> bezeichnet es den Vorgänger einer Kette (Prev/Next), nicht eine übergeordnete
> Seite.

**Eingestuft als Minor.** Nach der Kriterienliste wäre es ein Major – ein
dokumentiertes Front-Matter-Feld schaltet seine Funktion nicht mehr frei. Nichts
bricht jedoch hörbar: Kein Build schlägt fehl, keine Adresse ändert sich, und an
die Stelle des Links tritt sofort ein besserer Rückweg. Eine Übergangslösung –
den Link weiter zeigen, wenn `zurueck` gesetzt ist – wurde erwogen und verworfen:
Sie hätte genau das Verhalten konserviert, das entfallen soll, und zwei Rückwege
nebeneinandergestellt.

### Eine Simulation kann mehrere Szenarien tragen

Bisher war sie genau ein Ablauf. Manche Themen zerfallen aber in mehrere in sich geschlossene Abläufe, die
zusammengehören und jeder von vorn beginnen – dafür musste man bislang zur
eigenständigen HTML-Vorlage greifen, weil nur die Tabs kannte.

```js
AvdSimulation.registerScenario({
  id: "abgrenzung", titel: "…", beschreibung: "…", state, render, steps: [ … ]
});
```

Ab dem **zweiten** Szenario erscheinen von selbst:

- eine **Reiterleiste** unter der Kopfleiste (Tasten `1`–`9`),
- eine **Übersicht** als Startbild (Taste `0`) mit Beschreibung und Schrittzahl je
  Szenario; der Satz darüber kommt aus dem neuen Front-Matter-Feld `einleitung`.

Je Szenario liefert die Seite ein eigenes Bühnenbild in einem Container mit
`data-avd-academy-sim-szene="«id»"`; sichtbar ist immer genau eines. Die Adresse
trägt dann Szenario **und** Schritt: `#/abgrenzung/3` – mit der Kennung statt der
Nummer, damit ein Verweis das Umsortieren der Szenarien überlebt.

**Mit einem Szenario ändert sich nichts** – weder erscheint eine Leiste, noch
ändert sich die Adresse (`#/3`). `registerStep`/`registerSteps` wirken unverändert
und legen ein unbenanntes Szenario an.

Neu in der Schnittstelle: `registerScenario`, `registerScenarios`,
`szenario(kennungOderNummer)`, `uebersicht()`, dazu die Leser `szenarien`,
`aktuellesSzenario`, `istUebersicht`. `ctx` in `render` trägt jetzt zusätzlich
`szenario` und `szenarioIndex`.

**Vorlage und Beispiel zeigen beide die neue Form.** Das Beispiel
`EXAMPLE-java-speicher.md` ist in „Primitive Typen“ und „Referenztypen“ geteilt –
zwei Abläufe zu einer Frage, jeder beginnt auf leerer Bühne. Genau daran erkennt
man ein eigenes Szenario, und genau das ist die Stelle, an der der Merksatz zum
ersten Teil steht, bevor der zweite ihn umdreht.

**Tafeln lassen sich einfärben** – `avd-academy-sim-panel--ton-1` / `-3` / `-4` /
`-alert` setzen Rahmen, Überschrift und einen Anflug Fläche aus der kategorialen
Füllpalette. Gedacht für Tafeln, die über mehrere Szenarien hinweg dieselbe Sache
bezeichnen: Dann findet man sich beim Wechsel sofort zurecht. Ton 2 fehlt
absichtlich – das ist die Akzentfarbe.

**Quelltext auf der Bühne sieht jetzt wie Quelltext aus.** Die empfohlene Form ist
ein echter Codeblock mit der gewohnten Syntax-Hervorhebung durch highlight.js:

```html
<pre class="avd-academy-sim-code"><code class="language-java">int kontostand;</code></pre>
```

Die laufende Zeile markiert der neue Helfer **`AvdSimulation.codeZeile(block, n)`**
mit einem Balken **hinter** dem Text. Anders geht es nicht: Die Ausgabe von
highlight.js besteht aus verschachtelten Spans, die sich nicht zeilenweise
zerlegen lassen, ohne die Farben zu zerreißen.

Die ältere Form mit einzelnen `avd-academy-sim-code__line`-Elementen (seit 1.8.0)
**bleibt gültig** – sie hat nur keine Syntaxfarben. Neu daneben:
`avd-academy-sim-code__label` für eine Beschriftung über einer Zeilengruppe.

## 1.8.0

**Neues Layout „simulation“ – bewegte Abläufe statt Folienwechsel.** Eine Präsentation
wechselt Folien; eine Simulation verändert **einen** Schauplatz: Kästen entstehen, Werte
wandern, Pfeile werden gezogen. Dafür gab es bisher nur die eigenständige HTML-Vorlage
(`templates/simulations/simulation-template.html`) – ohne Kopfleiste, ohne QR-Code, ohne
Abspielen. Jetzt gibt es den Weg über die Site:

```yaml
---
layout: simulation
title: "Java: Stack und Heap"
---
```

Optisch ist die Seite an `presentation` angelehnt (dieselbe schmale Kopfleiste mit Logo,
Titel, QR-Code und Farbschema-Umschalter), darunter Bühne und Erklärspalte, unten eine
Steuerleiste: Reset, Schritt zurück, Abspielen, Schritt vor.

**Abspielen und Tempo sind EIN geteilter Knopf** – gemeinsamer Hintergrund, gemeinsamer
Rahmen. Der breite Teil spielt ab (voreingestellt 1×), der schmale Teil daneben klappt
ein Menü **nach oben** auf: 0,5× · 1× · 2× · 5×. Nach oben, weil die Leiste am unteren
Rand sitzt; als eigener Knopf daneben hätte das Tempo dieselbe Größe getragen wie
„vor“/„zurück“ und damit eine Wichtigkeit vorgetäuscht, die es nicht hat – man stellt es
einmal ein, nicht bei jedem Schritt. Ein Tempo zu wählen startet das Abspielen. Mit der
Tastatur: `T` öffnet, `↑`/`↓` wählen, `Esc` schließt.

**Das Miniframework `AvdSimulation`** (neu: `theme/jekyll/simulation.js`) trägt den
Ablauf. Schritte sind **deklarativ**: `apply` beschreibt nicht, was passiert, sondern was
danach gilt. Das Framework baut den Zustand bei jedem Wechsel von vorn auf und ruft
**eine** `render`-Funktion – Vor, Zurück, Springen und Reset funktionieren damit ohne
Rückwärts-Logik.

```js
AvdSimulation.setup({ state: () => ({ variablen: [] }), render: (s, ctx) => { … } });
AvdSimulation.registerStep({ titel: "…", text: "…", apply: s => { … } });
```

`AvdSimulation.list(container, items, {key, create, update})` gleicht Listen über
Schlüssel mit dem DOM ab – die Voraussetzung dafür, dass überhaupt etwas animiert:
Bestehendes bleibt stehen, Neues kommt mit `is-neu`, Verschwundenes geht mit `is-weg`.

**Neu im Paket:**

| Datei | Zweck |
| ----- | ----- |
| `jekyll/_layouts/simulation.html` | das Layout |
| `jekyll/simulation.css` | Apparatur + Bühnen-Bausteine |
| `jekyll/simulation.js` | Miniframework `AvdSimulation` |

**Neue Klassen** (alle additiv): `avd-academy-sim*` für die Apparatur sowie die
Bühnen-Bausteine `avd-academy-sim-panels`, `-panel`, `-cell`, `-code` mit den
Zustandsklassen `is-neu`, `is-weg`, `is-aktiv`, `is-puls`, `is-fehler`.

**Neue Front-Matter-Felder** (nur bei `layout: simulation`): `erklaerspalte`,
`tempo` (0.5/1/2/5), `schrittdauer`. `title`, `description` und `zurueck` wirken wie in
`presentation`.

**Capture-Modus für Beamer und Aufzeichnung.** Taste `C` oder `?capture` in der
Adresse räumt alles weg, was nicht zur Sache gehört – Kopfleiste, Erklärspalte,
Fortschritt, Steuerleiste – und blendet den Mauszeiger aus; die Bühne füllt das
Fenster. Taste `T` holt den Erklärtext als Einblendung (OST) an den unteren
Bühnenrand zurück; die Bühne hält dafür gemessenen Platz frei, damit die
Einblendung nicht verdeckt, worüber sie spricht. `?capture` bleibt in der Adresse
stehen (Neuladen-fest, verlinkbar an die Aufnahme-Maschine); der Weg über die
Taste blendet kurz einen Hinweis auf den Ausgang ein. Neu in der Schnittstelle:
`AvdSimulation.capture(an)` und `.ost(an)`.

**Kein Drucklayout – mit Absicht.** Eine Simulation lebt von der Bewegung; ein Ausdruck
wäre ein willkürliches Standbild. Es gibt weder Druck-Knopf noch Seitenaufbereitung; wer
trotzdem druckt, bekommt den sichtbaren Schritt, einen Hinweis und den QR-Code als
Rückweg.

**Bestehendes bleibt unberührt.** Die eigenständige HTML-Vorlage besteht weiter; die
Anleitung unter `/templates/simulations/` beschreibt jetzt beide Wege.

## 1.7.1

**Die Werkzeuge stehen jetzt überall in derselben Reihenfolge: QR-Code links,
Umschalter bzw. Drucken rechts.** Bisher lag der QR-Code je Layout an einer anderen
Stelle und der Farbschema-Umschalter war doppelt so groß wie seine Nachbarn.

| Layout | Wo der QR-Code steht |
| ------ | -------------------- |
| `default`, `guide` | **in der Kopfzeile**, links vom Farbschema-Umschalter (vorher: rechts im Hero) |
| `visualization` | rechts im Hero, **links vom** Drucken-Knopf (vorher: rechts davon) |
| `presentation` | in der Kopfleiste, **links vom** Farbschema-Umschalter (vorher: zwischen Drucken und Vollbild) |

**Der Farbschema-Umschalter ist kompakt.** Er trug das Button-Grundmaß (11 px/26 px
Polster) und stand damit als breiter Block neben einer 34-px-Kachel; jetzt ist er ein
Icon-Button mit derselben Kantenlänge wie der QR-Code daneben. Neue Klasse:
`avd-academy-theme-toggle` (das `data`-Attribut ist unverändert).

**Neue Gruppe `avd-academy-header__tools`** trägt beide in der Kopfzeile – bewusst
**außerhalb** von `avd-academy-header__nav`:

- Das Nav klappt unter 900 px in den Burger. Der Umschalter war dort nur nach einem
  Tipp auf ☰ erreichbar; jetzt steht er auf dem Handy so offen wie am Schreibtisch.
- Das Nav entfällt im Ausdruck. Läge der QR-Code darin, wäre er auf Papier weg –
  gerade dort ist er der Rückweg zur Online-Fassung.

Im Ausdruck ist der QR-Code in der Kopfzeile **20 mm** groß (statt 25 mm im Hero), damit
er den Briefkopf nicht aufbläht; der Umschalter entfällt dort wie alles andere Chrome.

**Für bestehende Projekte ist nichts zu tun** – keine Klasse entfällt, kein Front
Matter, keine Funktion. Nur wer per `site.custom_css` **gezielt** auf die alte
Anordnung gestylt hat, zieht nach: ein Selektor auf `.avd-academy-header__nav button`
trifft den Umschalter nicht mehr (jetzt `.avd-academy-theme-toggle` in
`.avd-academy-header__tools`), und ein Selektor auf den QR-Code im Hero greift auf
Doku-Seiten und Guides nicht mehr (dort steht er in der Kopfzeile).

## 1.7.0

**Neu: gruppierte Tabelle (`avd-academy-grouptable`).** Eine Tabelle, deren Zeilen
zu **Gruppen** zusammengefasst sind, mit **Zwischenräumen** dazwischen: Jede Gruppe
trägt links einen farbigen Streifen, die Zwischenräume sind schraffiert. Damit ist
auf einen Blick zu sehen, wie voll eine Gruppe ist, wo Raum frei bleibt und wo etwas
über die letzte Gruppe hinausläuft – was eine gewöhnliche Tabelle nicht zeigt, weil
sie Zeilen nur aufreiht.

Die Komponente ist **bewusst neutral**: „Gruppe“ und „Zwischenraum“, nicht
„Schulungstag“ und „Pause“. Sie rechnet nicht, summiert nicht und kennt keine
Reihenfolge – alles steht im Markup. Gedacht für Ablauf- und Belegungspläne,
Kapazitätsübersichten, Etappen mit Puffer.

Bausteine: `…__group` (Gruppenkopf mit `rowspan`, Töne `--tone-1` … `--tone-4` und
`--tone-alert`), `…__num` (schmale Zahlenspalte), `…__link` (rechtsbündige
Schlusszeile einer Zelle), an `<tr>`: `…__gap` (Zwischenraum zwischen Gruppen),
`…__free` (freier Raum innerhalb einer Gruppe), `…__alert` (Ankündigung, dass das
Raster verlassen wird). Dazu `avd-academy-grouptable-legend` mit
`…__key--tone-*` / `…__key--gap`. Markup, Beispiel und Grenzen:
[Doku, Abschnitt „Gruppierte Tabelle“](https://timetoact.ghe.com/AVD-Academy-Tools/academy-theme/blob/main/docs/theme/academy.md).

**Neue Tokens: `--avd-academy-tone-1..4` und `--avd-academy-tone-alert.`** Sie leiten
sich aus der kategorialen Füllpalette (`--avd-academy-fill-*`) bzw. der Danger-Farbe
ab und bringen **keine eigenen Farbwerte** mit. Im Dark-Theme werden sie per
`color-mix` aufgehellt – die Füllpalette ist auf helle Flächen gerechnet, Ton 1
(Slate) wäre auf dunklem Grund nicht zu sehen. Im **Drucklayout** werden sie auf die
Light-Werte zurückgesetzt, damit ein Ausdruck aus dem Dark-Mode nicht blass wird.

**Geändert: Lernziele in Guides stehen in der Du-Form.** Bisher galt „durchgängig
Du – **Ausnahme:** Lernziele in der 3. Person“. Diese Ausnahme fällt weg: Lernziele
beginnen mit **„Du …“**, die Verben stehen in der **2. Person Singular**
(„benennst“, „implementierst“). Ein Guide spricht die Lernenden direkt an; eine
Aufzählung in der 3. Person fiel mitten im Dokument aus der Anrede. Betrifft
`templates/guides/guide-template.md`, `EXAMPLE-postgresql-backend.md` und die
Anweisungen in `templates/guides/index.md`.

**Für bestehende Projekte ist nichts zu tun.** Die neue Komponente ist rein
ergänzend. Bestehende Guides mit „Die Lernenden …“ bleiben lesbar und funktionsfähig
und werden **nicht unaufgefordert** umgeschrieben – die neue Regel gilt für neue und
ohnehin bearbeitete Übungen.

## 1.6.0

**Neu: Drucken-Knopf im Hero der Visualisierungs-Ansicht.** `layout: visualization`
hat weder Kopfzeile noch Sidebar – darin steckte bisher kein Weg zum Ausdruck außer
dem Browser-Menü. Jetzt steht rechts im Hero ein Drucken-Knopf, gleiche Bauform und
Größe wie die Kopier-Buttons (Icon als CSS-Maske in `currentColor`, kein Emoji), und
**links neben dem QR-Code** – wie in der Präsentation.

Damit ist auch ein Nebeneffekt von `1.5.0` behoben: Wo eine Visualisierung ihren
**eigenen** Drucken-Knopf im Inhalt mitbrachte, stand der QR-Code **über** ihm statt
neben ihm. Das Layout kann eine Schaltfläche im Inhalt nicht finden – mit dem Knopf
im Hero gibt es nun eine Stelle, an der beide zusammenstehen.

- **Nur in dieser Ansicht.** Auf Doku-Seiten und Guides ist der Hero mit Tags und
  „Markdown kopieren“ belegt; dort bleibt es bei `Strg/Cmd+P`.
- Neue Klasse `avd-academy-print-btn`, neuer Haken `[data-avd-academy-print]`
  (verdrahtet von `academy/atvantage.js`, löst `window.print()` aus). Braucht
  JavaScript – wie die Kopier-Buttons.
- Im Ausdruck ausgeblendet: ein Drucken-Knopf auf Papier ist sinnlos.

**Für bestehende Projekte ist nichts zu tun.** Wer in einer Visualisierung einen
eigenen Drucken-Knopf im Inhalt hat, kann ihn jetzt entfernen – sonst stehen zwei da.

## 1.5.0

**Neu: QR-Code der Seitenadresse in allen Layouts.** Neben dem Drucken- bzw.
Kopieren-Button steht jetzt ein QR-Code auf die Adresse der aktuellen Seite –
Tooltip „Diese Seite auf Deinem Smartphone öffnen“. Er ist die Brücke von der Wand
in die Hand: Was am Beamer hängt, liegt einen Scan später auf dem Gerät der
Teilnehmenden, ohne dass jemand eine URL abtippt.

- **Überall, gleich groß:** in `default`, `guide` und `visualization` rechts im
  Hero, in `presentation` in der Kopfleiste neben dem Drucken-Knopf – jeweils in
  der Größe des Knopfs daneben. Kein Schalter im Front Matter: Es gibt keine Seite,
  auf der der Weg aufs eigene Smartphone schaden würde.
- **Vergrößert sich zum Scannen** (ca. 168 px) bei Überfahren, Tastaturfokus oder
  Antippen. In Knopfgröße wäre ein Modul rund ein Pixel breit und der Code
  unlesbar.
- **Entsteht im Browser** und wird per DOM eingehängt. Zur Build-Zeit ginge es
  nicht: Dieselbe Unterlage läuft unter github.io, im lokalen Server und in Forks
  (verschiedene `baseurl`), und in der Präsentation steht die aktuelle Folie im
  Fragment (`#/3`) – dort zeigt der Code auf **genau die Folie an der Wand** und
  wird beim Blättern neu berechnet. Ohne JavaScript und bei `file://` erscheint er
  nicht.
- **Immer dunkel auf hell**, auch im Dark-Mode: Ein invertierter QR-Code wird von
  vielen Scannern nicht gelesen.
- **Bleibt im Ausdruck** – als einziger Bedienbaustein, weil er auf Papier kein
  Chrome ist, sondern der Rückweg zur Online-Fassung. 25 mm auf Doku-/Guide-Seiten,
  20 mm in der Kopfleiste der Präsentation.

**Neu im Paket:** die Bibliothek **qrcode-generator 2.0.4** (MIT, unverändert
übernommen) unter `academy/qrcode/` – wie highlight.js **mitgeliefert statt per
CDN** und per `import()` nachgeladen, damit sie das Rendern nicht aufhält. Das SVG
baut das Theme selbst.

**Neue Klassen:** `avd-academy-qr` (mit `__box`, `is-zoom`) und
`avd-academy-guide-hero__actions` (fasst die Werkzeuge der Hero-Meta-Zeile
zusammen). **Neues Ereignis:** `presentation.js` sendet bei jedem Folienwechsel
`avd-academy-urlchange` am `window` – nötig, weil das Fragment per
`history.replaceState` gesetzt wird und das kein `hashchange` auslöst.

**Was sich für bestehende Projekte sichtbar ändert:** der Ausdruck. Die
Hero-Meta-Zeile (`avd-academy-guide-hero__meta`) wird beim Drucken nicht mehr als
Ganzes ausgeblendet, weil sie den QR-Code trägt; stattdessen entfallen dort jetzt
die Hero-Tags (`avd-academy-guide-hero__tags`) einzeln. In der Präsentation gilt
das Gleiche für `avd-academy-present__tools` und die Knöpfe darin. Nichts wurde
entfernt oder umbenannt – wer den QR-Code im Ausdruck nicht will, blendet
`.avd-academy-qr` per `site.custom_css` in einem eigenen `@media print` aus.

## 1.4.3

**Fix: Ein Wisch blätterte mehrere Folien weiter.** Die in `1.4.2` eingeführte
Erkennung eines neuen Wischs war zu großzügig und zündete schon **innerhalb**
einer Geste: Beim Wischen schwanken die Beträge ständig (beschleunigen,
abbremsen, wieder beschleunigen), und jeder Anstieg galt als neuer Wisch.

Jetzt gilt wieder streng: **Ein Wisch = ein Folienwechsel.** Danach muss
losgelassen werden – anschließend darf sofort weitergewischt werden, ohne Pause
und ohne Mausbewegung. Als neuer Wisch zählt nur noch:

- ein **deutlicher Anstieg nach sichtbarem Abklingen** (mindestens vier
  aufeinanderfolgende nicht steigende Ereignisse, danach mehr als der doppelte
  Betrag) – das ist die Signatur „Nachlauf zu Ende, Finger wieder aufgelegt“,
- oder eine **klare Richtungsumkehr** (der Nachlauf läuft nie rückwärts).

Zwei Feinheiten, die im Trace sichtbar wurden und den Ausschlag gaben:

- Das **letzte Ein-Pixel-Ereignis** des Nachlaufs beendete zwar die alte Geste,
  begann aber zugleich eine neue – mit seiner zufälligen Richtung. Die
  Umkehr-Regel zündete daraufhin mitten im nächsten Wisch. Solche Ausläufer
  beginnen jetzt gar keine Geste mehr (alles unter 2 px zählt als Rauschen).
- Die gemerkte Wischrichtung stammt jetzt aus der **tatsächlich gewischten
  Summe** statt aus dem ersten Ereignis der Geste.

## 1.4.2

**Fix: Zweimal hintereinander wischen ging nur mit Mausbewegung dazwischen.** Der
erste Wisch blätterte, der zweite tat nichts – bis man den Zeiger kurz bewegte.

Ursache war der **Nachlauf** (Momentum): Nach einem Wisch liefert das Trackpad
noch für einige Zehntelsekunden abklingende Ereignisse. Die Geste galt erst als
beendet, wenn 150 ms lang gar nichts mehr kam – der Nachlauf hielt sie also am
Leben, und der zweite Wisch wurde als dessen Rest verworfen. Eine Mausbewegung
beendet den Nachlauf, deshalb half sie.

Jetzt wird ein **neuer Wisch mitten im Nachlauf erkannt**: Momentum klingt ab,
seine Beträge werden monoton kleiner – steigt der Betrag wieder spürbar an oder
dreht die Richtung, liegen die Finger wieder auf dem Trackpad. Die alte Geste wird
dann beendet und die neue beginnt, ohne Pause dazwischen.

Dazu ist die Auslöseschwelle für **Trackpad-Gesten** von 80 px auf **50 px**
(bzw. 6 % der Bühnenbreite) gesenkt. Der Finger auf dem Touchscreen schiebt die
Folie 1:1 und darf einen längeren Weg brauchen; die Trackpad-Geste ist indirekt
und liefert je Wisch deutlich weniger „Pixel“ – mit demselben Wert fühlte sie sich
zäh an. Die Touch-Schwelle bleibt unverändert.

## 1.4.1

**Fix: Wischen wirkte nur, wenn der Zeiger über der Folie stand.** Nach einem
Folienwechsel – besonders nach einem Klick auf „weiter“ – tat die Zwei-Finger-Geste
nichts; erst ein kurzes Bewegen der Maus half.

Ursache: `wheel`-Ereignisse gehen an das Element **unter dem Zeiger**, die
Gesten-Erkennung hing aber an der Folien-Bühne. Kopfleiste, Fortschrittsbalken und
die fixierten Blätter-Knöpfe liegen **außerhalb** der Bühne – und genau über dem
Knopf steht der Zeiger, nachdem man damit weitergeblättert hat. Die Ereignisse
erreichten die Erkennung also gar nicht, bis der Zeiger wieder über einer Folie
lag.

Zuständig ist jetzt das **Dokument**: Gewischt werden kann überall auf der Seite.
Für Touch gilt dasselbe – eine Geste darf auf der Leiste beginnen. Die Prüfung auf
waagerecht scrollbare Inhalte läuft entsprechend über die volle Vorfahrenkette;
breite Codeblöcke und Tabellen behalten ihren Vorrang.

## 1.4.0

**Trackpad-Wischen: Die Folie geht jetzt sofort mit.** Das Blättern mit zwei
Fingern fühlte sich schwerfällig an und ging manchmal ins Leere – zu Recht: Bis
zum Überschreiten der Schwelle passierte **nichts Sichtbares**, und ein zu kurzer
Wisch verpuffte spurlos. Man wischte gegen ein totes Bild und wusste nicht, ob die
Geste überhaupt ankommt.

Jetzt gilt auf Trackpad und Touchscreen dasselbe Modell:

- **Sofortige Rückmeldung** – die Schiene folgt der Geste von der ersten Bewegung
  an (an den Enden gedämpft).
- **Gewechselt wird erst über der Schwelle** – 12 % der Bühnenbreite, höchstens
  80 px; darunter rastet die Folie animiert zurück.
- **Ein Wisch = eine Folie**, der Nachlauf (Momentum) blättert nicht weiter.

Dazu zwei Korrekturen, die das „teilweise gar nicht“ erklären:

- **Achse einmal festlegen.** Bisher wurde bei *jedem* Ereignis geprüft, ob
  waagerecht oder senkrecht überwiegt – bei einem leicht schrägen Wisch fiel ein
  Teil der Ereignisse heraus, die Geste zerfiel. Jetzt steht die Achse nach dem
  ersten Ereignis fest und gilt bis zum Ende der Geste.
- **Am Rand rastet die Schiene zurück.** `go()` rendert auch dann, wenn sich der
  Index nicht ändert (erste/letzte Folie) – sonst blieb die Schiene nach einer
  Geste verschoben stehen.

## 1.3.0

**Touch-Wischen: Die Folie folgt dem Finger.** Das Wischen auf dem Touchscreen war
schwerfällig und ging manchmal ins Leere. Drei Ursachen, alle behoben:

- **Nur Strecke, kein Tempo.** Ausgelöst wurde erst ab 60 px Wischweite, gemessen
  beim Loslassen. Ein kurzer, schneller Flick blieb darunter und verpuffte. Jetzt
  zählt **Strecke oder Tempo**: langes Ziehen (über 12 % der Bühnenbreite, höchstens
  80 px) **oder** ein Flick unter 300 ms.
- **Keine Rückmeldung während der Geste.** Es passierte bis zum Loslassen nichts –
  man wischte gegen ein totes Bild. Jetzt folgt die Schiene dem Finger und rastet
  beim Loslassen animiert ein (an den Enden nur gedämpft, damit sichtbar ist, dass
  dort Schluss ist).
- **Abgebrochene Gesten hingen.** Wurde die Berührung vom System abgebrochen
  (eingehender Anruf, Systemgeste, zweiter Finger), kam kein `touchend` – der
  Zustand blieb stehen. `touchcancel` und Mehrfinger-Berührung setzen jetzt sauber
  zurück.

Dazu die **Achsen-Entscheidung**: Nach den ersten Pixeln steht fest, ob die Geste
blättert oder scrollt, und sie wechselt bis zum Loslassen nicht mehr. Waagerecht
scrollbare Inhalte (breiter Codeblock, breite Tabelle) haben dabei jetzt auch beim
Touch Vorrang – dieselbe Prüfung wie beim Trackpad, die es im Touch-Pfad bisher gar
nicht gab. `touch-action: pan-y pinch-zoom` überlässt senkrechtes Scrollen und
Zoomen weiterhin dem Browser.

## 1.2.1

**Fix: Vorwärtswischen auf dem Trackpad blätterte nicht.** Rückwärts (nach rechts)
funktionierte, vorwärts (nach links) nicht.

Ursache war der Vorrang-Check für waagerecht scrollbare Inhalte: Er prüfte nur
`scrollWidth > clientWidth` und lief dabei über die **Folien-Schiene**
(`.avd-academy-deck__track`). Die ist naturgemäß so breit wie alle Folien zusammen
(bei sieben Folien 10080 px gegenüber 1440 px Bühne) und stand auf `scrollLeft: 0`
– also „links ist noch Weg“: Jede Vorwärtsgeste galt als Scrollen im Inhalt und
wurde verschluckt, während Rückwärts (`scrollLeft > 1` ist bei 0 falsch)
durchkam.

Jetzt zählen nur **echte** Scroll-Container: `overflow-x: auto|scroll` **und**
noch Weg in der Wischrichtung; die Schiene ist zusätzlich ausdrücklich
ausgenommen. Breite Codeblöcke und Tabellen behalten damit ihren Vorrang – geprüft
ist beides: Wischen im breiten Block scrollt dort, am Anschlag blättert die Folie
weiter.

## 1.2.0

**Blättern per Wischgeste auf dem Trackpad.** Bisher reagierte das Layout
`presentation` auf Tastatur, Schaltflächen und Touch-Wischen; die
Zwei-Finger-Geste auf dem Trackpad blätterte nicht. Jetzt gilt überall dasselbe:
**nach links wischen = nächste Folie, nach rechts = zurück.**

Umgesetzt über `wheel`-Events mit waagerechtem `deltaX`, mit den drei nötigen
Feinheiten:

- **Ein Wisch = eine Folie.** Die Ereignisse eines Wischs samt Nachlauf
  (Momentum) werden zu einer Geste zusammengefasst und erst nach 220 ms Ruhe
  wieder freigegeben.
- **Senkrechtes Scrollen bleibt der Folie**, ebenso Pinch-Zoom.
- **Waagerecht scrollbare Inhalte haben Vorrang** – wer in einem breiten
  Codeblock oder einer breiten Tabelle wischt, scrollt dort; erst am Anschlag
  blättert die Folie.

Die Geste löst zudem **nicht mehr die Zurück-Navigation des Browsers** aus
(`preventDefault` plus `overscroll-behavior-x: contain` auf der Bühne).

**Für Konsumenten:** nichts zu tun – rein ergänzend; Tastatur, Schaltflächen und
Touch bleiben unverändert.

## 1.1.2

**Doku:** Eine Präsentation darf statt einer Datei auch ein **Ordner mit
`index.md`** sein – der Weg, sobald sie eigene Dateien mitbringt (Bilder,
Diagramme, Skripte, Stylesheets): `«modul»/praesentation/index.md` +
`«modul»/praesentation/diagramm.svg`, Referenzen relativ, Verweis dann
`praesentation/index.md` bzw. Folien-Anker `praesentation/#/9`. Ein **inline
eingebettetes SVG** braucht gar keine Zusatzdatei und erbt über `currentColor`
die Textfarbe. Nachgezogen in Vorlage, Referenz und Skill
`praesentation-erstellen`; die Struktur-Regeln für Schulungs-Repos bleiben beim
`didaktikon`-Plugin. Kein Code, kein Verhalten geändert.

## 1.1.1

**Farbschema-Umschalter in der Präsentation.** Die Kopfleiste des Layouts
`presentation` trägt jetzt den Schalter `◐` – dieselbe Mechanik wie in der TopNav
(`[data-avd-academy-theme-toggle]`), die es in dieser Ansicht nicht gibt. Auf einer
Präsentation wechselt die Wahl regelmäßig: heller Schulungsraum am Beamer gegen
Aufzeichnung am Abend.

Dazu zwei Präzisierungen in Doku und Vorlage (kein Code): Der Verweis auf einen
Foliensatz gehört **ins Kapitel** des Modul-`index.md`, das er stützt – an
dieselbe Stelle wie `[Zur Übung](issue.md)`, bei mehreren Kapiteln mit Folien-Anker
(`praesentation.md#/9`). Und ein Foliensatz im Schulungs-Repo **steht für sich**:
keine Verortung im Ablauf („Tag 1“, „Vormittag“, festes Datum) – die lebt im
Regiebuch und wäre auf der Folie nach dem ersten Verschieben falsch.

## 1.1.0

**Neues Layout `presentation` – Folien aus Markdown.** Eine Seite mit
`layout: presentation` wird zum folienbasierten Vortrag im Vollbild: Das Theme
tritt zurück (keine Meta-Leiste, TopNav, Brotkrumen, Sidebar, Footer), es bleiben
eine schmale Kopfleiste mit dem Präsentationstitel und die Folienfläche.

Die Übersetzung ist die ganze Syntax – es gibt **keine** Folien-Auszeichnung:

| Markdown | Ergebnis |
| -------- | -------- |
| `#` (oder `title`) | Titel der Präsentation: klein in der Kopfleiste, groß auf der Titelfolie |
| alles vor dem ersten `##` | Titelfolie |
| `##` | Titel einer Folie – **jedes `##` beginnt eine neue Folie** |

Geblättert wird mit `←`/`→` (auch Leertaste, `Bild ↑/↓`, `Pos1`/`Ende`), über die
Schaltflächen oder per Wischgeste; die Folie schiebt sich dabei nach links aus dem
Bild. `F` schaltet Vollbild, der Hash (`#/3`) hält die Folie fest. **Jede
Präsentation hat ein Drucklayout:** im Ausdruck eine Folie je Seite – das Handout
entsteht aus demselben Markdown.

Neu im Paket: `jekyll/_layouts/presentation.html`, `jekyll/presentation.css`,
`jekyll/presentation.js`. Neues optionales Front-Matter-Feld `zurueck: {title,
url}` wirkt in diesem Layout als „Zurück“-Link in der Kopfleiste (`url` relativ
oder ab Site-Wurzel).

**Für Konsumenten:** nichts zu tun – rein ergänzend. Bestehende Seiten und
Layouts (`default`, `guide`, `visualization`) sind unverändert. Ohne JavaScript
bleibt eine Präsentation als scrollbares Dokument lesbar.

Das **eigenständige Deck** (`templates/presentations/presentation-template.html`
mit Fragmenten und Speaker-Notes) bleibt daneben bestehen; wann welcher Weg
passt, steht unter `/templates/presentations/`.

## 1.0.0

**Beginn der semantischen Versionierung.** Inhaltlich identisch mit `0.1.59` – der
Sprung markiert das Ende der Pre-Release-Phase, nicht einen Bruch. Alles unter
`0.1.x` war Vorabversion: Die Nummer zählte hoch, ohne eine Aussage über
Kompatibilität zu tragen.

**Für Konsumenten:** Bindung von `latest` bzw. `^0.1.x` auf **`^1`** umstellen. Wer
auf `^0.1.x` stehen bleibt, bekommt **keine** Updates mehr – die Spanne endet bei
`<0.2.0`.

### Was in der Pre-Release-Phase still gebrochen ist

Nachträglich dokumentiert, ohne die alten Nummern neu zu bewerten. Diese drei
Releases wären nach der neuen Regel **Major** gewesen; sie sind als Patch
ausgeliefert worden, weil die Pipeline nur die Patch-Stelle erhöhen konnte:

| Version | Bruch | Umstellung |
| ------- | ----- | ---------- |
| `0.1.56` | Ein **Guide** ist ausschließlich durch `layout: guide` gekennzeichnet. Zuvor genügte ein gesetztes `duration`. | Übungen von `layout: default` auf `layout: guide` umstellen – sonst fehlen Kopier-Button, Fortschritt, nummerierte Arbeitsschritte und Prev/Next. |
| `0.1.58` | Der Default `favicon` in `_config.defaults.yml` zeigt auf die quadratische Bildmarke statt auf die Wortmarke. | Nichts, wenn der Default gewünscht ist. Projekte mit eigenem `favicon:` überschreiben ihn weiterhin. |
| `0.1.59` | Die Werkstatt des Design-Fundaments ist nicht mehr Teil des Pakets: `atvantage/components/`, `guidelines/`, `ui_kits/`, `uploads/`, `SKILL.md`, `thumbnail.html`, `ATVANTAGE Homepage.html`, die `_ds_*`-Dateien sowie `academy/page-template.html` und `academy/partials/`. | Wer eine dieser Dateien referenziert, muss den Verweis auflösen. Sie liegen weiterhin im Repo. |

Ebenfalls in `0.1.5x` enthalten, verträglich: Untermenü im Burger-Menü, Versatz für
Sprungmarken, Kopier-Button nur auf Guides, Visualisierungen ohne rechten Bereich,
`<title>` aus der ersten Überschrift, quadratisches Favicon.
