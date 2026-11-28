/* =============================================================================
   Skriptorium – Sprachen der Hervorhebung, als Modul (skriptorium#535)
   -----------------------------------------------------------------------------
   Welche Grammatiken unter hljs/ eine Sprache am Zaun braucht – je Name und Kurzname der
   Bibliothek (sh, js, yml …). Zusammengesetzte Sprachen bringen ihre Helfer mit:
   `dockerfile` färbt Befehle mit `bash`, `markdown` eingebettetes HTML mit `xml`; `html` ist die
   Grammatik `xml`, `toml` die Grammatik `ini`. Die erste Grammatik eines Eintrags ist die der
   Sprache. Gelesen im Browser (highlight.js) und beim Bau (adapter/code-languages.mjs); ein Test
   gleicht die Tabelle mit den Grammatiken selbst ab.
   ============================================================================= */
const NAMES = {
  bash: ["sh", "zsh"],
  c: ["h"],
  cpp: ["cc", "c++", "h++", "hpp", "hh", "hxx", "cxx"],
  csharp: ["cs", "c#"],
  css: [],
  dart: [],
  dockerfile: ["docker"],
  go: ["golang"],
  groovy: [],
  http: ["https"],
  ini: ["toml"],
  java: ["jsp"],
  javascript: ["js", "jsx", "mjs", "cjs"],
  json: ["jsonc", "json5"],
  kotlin: ["kt", "kts", "ktm", "ktx"],
  markdown: ["md", "mkdown", "mkd"],
  php: [],
  plaintext: ["text", "txt"],
  properties: [],
  python: ["py", "gyp", "ipython"],
  rust: ["rs"],
  scala: [],
  scss: [],
  shell: ["console", "shellsession"],
  sql: [],
  swift: [],
  typescript: ["ts", "tsx", "mts", "cts"],
  xml: ["html", "xhtml", "rss", "atom", "xjb", "xsd", "xsl", "plist", "wsf", "svg"],
  yaml: ["yml"],
};
const HELPERS = { dockerfile: ["bash"], markdown: ["xml"] };

/** Sprache am Zaun (klein geschrieben) → die Grammatiken, die sie braucht. */
export const GRAMMARS = Object.freeze(Object.fromEntries(Object.entries(NAMES).flatMap(([grammar, aliases]) =>
  [grammar, ...aliases].map((name) => [name, Object.freeze([grammar, ...(HELPERS[grammar] || [])])]))));

/** Die Grammatiken einer Sprache – leer, wenn es für sie keine gibt. */
export function modulesOf(language) {
  return (GRAMMARS[String(language || "").toLowerCase()] || []).slice();
}

/** Ein Zaun auf oberster Ebene: Zeichen, Info-Zeile, Inhalt. */
export const FENCE = /^ {0,3}(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^ {0,3}\1[`~]*[ \t]*$/gm;
/** Das Front Matter am Anfang eines Markdown-Texts. */
export const FRONT_MATTER = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?=\n|$)/;

/**
 * Die Sprachen, die ein Block in `language` zum Färben braucht: die eigene, in Markdown dazu
 * `yaml` für das Front Matter und die Sprachen seiner Zäune – auch verschachtelt.
 */
export function wanted(text, language) {
  const out = [language];
  if (modulesOf(language)[0] !== "markdown") return out;
  const body = String(text || "");
  if (FRONT_MATTER.test(body)) out.push("yaml");
  for (const m of body.matchAll(FENCE)) {
    const inner = m[2].trim().split(/\s+/)[0];
    if (inner) out.push(...wanted(m[3], inner));
  }
  return [...new Set(out)];
}
