# ATVANTAGE Design System

ATVANTAGE ist ein IT-Beratungshaus („Co-Creation für wirksame Technologie") und Teil der TIMETOACT GROUP. Fünf Unternehmen — ARS, brainbits, X-INTEGRATE, JOIN (+) und TIMETOACT Software & Consulting — treten seit 2026 gemeinsam als ATVANTAGE auf. Leistungsfelder: Data & AI, Technology Adoption & Integration, Digital Process Management, Digital & Business Innovation, Cloud/FinOps, Managed Services. Zielgruppe: Enterprise-Kunden im DACH-Raum; Sprache der Website ist Deutsch.

**Quellen:**
- `uploads/atvantage-design-tokens.md` — maßgebliche Token-Definition (extrahiert aus dem Inline-CSS von www.atvantage.com, Pimcore-Theming, Stand Juli 2026)
- `uploads/avd-logo-rgb-*.svg` — Logo in Orange, Dark-Slate-Blue und Weiß
- www.atvantage.com — Struktur- und Copy-Referenz (Marketing-Website, einziges Produkt/Surface)

## CONTENT FUNDAMENTALS

- **Sprache:** Deutsch, formelles „Sie". Wir-Perspektive („Wir begleiten Sie…", „machen wir unsere Kunden effizienter").
- **Ton:** Partnerschaftlich, selbstbewusst, lösungsorientiert. Schlüsselvokabular: Co-Creation, wirksam, passgenau, ganzheitlich, partnerschaftlich, auf Augenhöhe, zukunftsfähig, smarter.
- **Headlines:** Aussagesätze, oft zweiteilig mit Wendung: „Technologie verändert die Welt. In Co-Creation gestalten wir sie wirksam." Auch knappe Formeln: „Fünf Logos. Eine Vision." / „Neues gestaltet – passgenau".
- **CTAs:** Imperativ/Nominal, kurz: „Mehr dazu", „Jetzt beraten lassen", „Mehr über uns", „Weitere Referenzen entdecken".
- **Fachbegriffe** bleiben englisch (Data & AI, Digital Process Management); Fettdruck für Schlüsselaussagen im Fließtext. **Keine Emoji.**

## VISUAL FOUNDATIONS

- **Farben:** Weiße Grundfläche; Anthrazit `#343E3F` für Text, Fast-Schwarz `#1A2627` für Headlines. Orange `#FF5401` ist die einzige laute Farbe — sparsam für Links, Icons, Card-Headlines, aktive Zustände, Logo. Blaugrau `#303E4F` für dunkle Sektionen (invertierter Text). Hellblau `#DDE4EE` und Hellgrau `#EDEDED` als ruhige Sektions-/Card-Flächen. Danger `#EE1919`.
- **Typografie:** Outfit (Google Font) durchgängig, Fallback sans-serif. Fließtext 18px/1.62, Gewicht 400; Hero 1.35rem. Headlines Gewicht 600 (500 in Content-Sektionen), mobile Basis 38/34/28/22px, Desktop per `calc()`-Faktoren hochskaliert (Tokens `--h*-scale-*`).
- **Buttons:** Anthrazit-Fläche, weißer Text, Radius 5px (8px auf dunklen Sektionen), Hover `#4D5657`. Auf Dunkel invertiert: weiß mit Slate-Text, Hover transparent mit weißem Rahmen. Keine Verläufe.
- **Layout:** Sektionsbasiert, volle Breite, vertikales Padding 5–6rem, Content-Padding 24px, Topnav 80px fix. Breakpoints 576/768/992/1200/1440/2000.
- **Cards:** Hellgraue Fläche `#EDEDED`, orange Headline, Fließtext, „Mehr dazu"-Link; Schatten `0 0 10px #5F5F5F` sparsam. Kleine Radien (5–8px), keine starken Rundungen.
- **Bildwelt:** Fotografie (Menschen, Arbeitssituationen) und Firmenlogos in Grau; kein Illustrations-Stil, keine Muster/Texturen, keine Verläufe.
- **Animation:** Zurückhaltend — Standard-Hover (Farbe/Underline), keine Bounces. Transparenz/Blur nicht Teil der Sprache.
- **Hover:** Links → orange/Underline; Buttons → hellere Anthrazit-Stufe; Social-Icons → Hover-Variante des SVG.

## ICONOGRAPHY

- Die Website nutzt einen eigenen `tta-iconfont` sowie SVG-Data-URIs (Chevrons) — **nicht mitgeliefert**. Ersatzweise empfohlen: [Lucide](https://lucide.dev) via CDN, Strichstärke 2, Farbe `var(--color-icon)` (Orange). Diese Substitution ist zu flaggen, bis Original-Icons vorliegen.
- Logos liegen als SVG in `assets/` (orange, slate, weiß). Keine Emoji, keine Unicode-Icons.
- Bildmaterial (Hero-Fotos, Partner-Logos) nicht mitgeliefert — Platzhalter verwenden, echte Assets beim Team anfragen.

## Index

- `styles.css` → importiert `tokens/` (fonts, colors, typography, spacing, components, base)
- `assets/` — `logo-orange.svg`, `logo-slate.svg`, `logo-white.svg`
- `guidelines/` — Specimen-Cards (Farben, Typo, Spacing, Buttons, Marke)
- `components/core/` — Button, Input, Card, Tag, Checkbox (Standard-Set; keine Komponenten-Quelle vorhanden, daher aus den Tokens abgeleitet — „Intentional additions")
- `ui_kits/website/` — Homepage-Recreation der Marketing-Website
- `SKILL.md` — Agent-Skill-Manifest

### Intentional additions
Kein Komponenten-Inventar in den Quellen definiert (nur Token-Doku + Live-Site). Button/Card folgen exakt der Token-Doku; Input, Tag, Checkbox sind aus den Tokens abgeleitete Standard-Primitives für Formulare/Labels.
