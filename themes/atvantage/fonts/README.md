# Schriften (`fonts/`)

Die CI-Schrift der ATVANTAGE, **Outfit**, liegt hier und wird mit dem Theme ausgeliefert.
Keine Seite lädt sie von Google Fonts. IBM Plex Mono bringt das Theme „internal“
in seinem eigenen `files/fonts/` mit.

| Datei | Inhalt |
| --- | --- |
| `outfit-latin.woff2` | variable Schrift, Gewichte 100–900, Zeichenbereich Latein |
| `outfit-latin-ext.woff2` | dieselbe Schrift, erweitertes Latein – nur geladen, wenn eine Seite solche Zeichen enthält |
| `OFL.txt` | Lizenz von Outfit (SIL Open Font License 1.1) |

Quelle: npm-Paket `@fontsource-variable/outfit` 5.3.0. Die `@font-face`-Regeln stehen in
[`../fonts.css`](../fonts.css); `theme.yml` lädt sie als Stylesheet und die lateinische
Datei vorab (`fonts.preload`). Der Schriftname kommt als Token aus dem Fundament
(`--font-family`). Fehlt die Datei, greifen die System-Schriften.

**Aktualisieren:** `npm pack @fontsource-variable/outfit@«version»`, aus `files/` die beiden
`*-wght-normal.woff2` hierher kopieren (umbenannt wie oben), `LICENSE` als `OFL.txt`,
Version in `../fonts.css` und hier nachziehen.

Schriftnamen nur über die Tokens referenzieren, nie hartkodiert; nie von Google Fonts laden.
