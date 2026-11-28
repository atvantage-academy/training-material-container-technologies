/* =============================================================================
   Skriptorium – Hervorhebung von Code (highlight.js), als Modul
   -----------------------------------------------------------------------------
   Lädt den Kern der Bibliothek und genau die Grammatiken, die die Codeblöcke der Seite
   brauchen – die Sprache steht am Block (`language-…`), Name oder Kurzname (sh, js, yml …);
   welche Grammatiken das sind, sagt highlight-languages.mjs (skriptorium#535). Eine Seite ohne
   Codeblock lädt nichts davon. Gefärbt wird jeder Block, dessen Sprache eine Grammatik hat;
   einer ohne bleibt einfarbig. Danach stehen Färben (`apply`), Nachladen (`load`) und Färben
   einer Zeichenkette (`code`) unter `skr.highlight` bereit, und das Ereignis
   `skr-highlight-ready` geht an das Dokument.

   Eine eigene Datei, kein Skript im Dokument: Die Seiten kommen ohne
   `unsafe-inline` in einer Content Security Policy aus.
   ============================================================================= */
import { modulesOf, wanted, FENCE, FRONT_MATTER } from "./highlight-languages.mjs";

const _hlBase = new URL("skriptorium/hljs/", window.skr._root()).href;
const _BLOCKS = 'pre code[class*="language-"]';
let _core = null;
let hljs = null;
const _loaded = new Set();
const _pending = new Map();

const _language = (el) => (Array.from(el.classList).find((k) => k.startsWith("language-")) || "").slice(9);
const _escaped = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const _known = (language) => !!(hljs && language && hljs.getLanguage(language));

/* NACHLADEN: der Kern einmal, je Grammatik ein Modul, jedes nur einmal – auch wenn zwei Aufrufe
   sie zugleich verlangen. Eine Sprache ohne Grammatik lädt nichts. */
function load(...languages) {
  const modules = [...new Set(languages.flat().flatMap(modulesOf))];
  if (!modules.length) return Promise.resolve();
  _core = _core || import(_hlBase + "core.min.js").then((m) => { hljs = m.default; return hljs; });
  return _core.then((lib) => Promise.all(modules.map((name) => {
    if (_loaded.has(name)) return null;
    if (!_pending.has(name)) {
      _pending.set(name, import(_hlBase + name + ".min.js").then((g) => {
        lib.registerLanguage(name, g.default);
        _loaded.add(name);
      }));
    }
    return _pending.get(name);
  }))).then(() => undefined);
}

const _in = (text, language) => (_known(language) ? hljs.highlight(text, { language: language, ignoreIllegals: true }).value : _escaped(text));
/* Markdown: das Front Matter als YAML, jeder Codeblock darin in seiner Sprache, wenn sie eine
   Grammatik hat, sonst einfarbig (skriptorium#467). Die Grammatik der Bibliothek färbt beides
   nur einfarbig und hielte die letzte Zeile des Front Matter vor `---` für eine Überschrift;
   sie färbt nur den Text dazwischen. */
const _isMarkdown = (language) => _known(language) && hljs.getLanguage(language).name === "Markdown";
const _markdown = (text) => {
  let out = "";
  let rest = text;
  const head = rest.match(FRONT_MATTER);
  if (head) {
    out += '<span class="hljs-meta">---</span>\n' + (head[1] !== undefined ? _in(head[1], "yaml") + "\n" : "") + '<span class="hljs-meta">---</span>';
    rest = rest.slice(head[0].length);
  }
  let pos = 0;
  for (const m of rest.matchAll(FENCE)) {
    out += _in(rest.slice(pos, m.index), "markdown");
    const open = m[0].slice(0, m[0].indexOf("\n") + 1);
    const close = m[0].slice(open.length + m[3].length);
    const language = m[2].trim().split(/\s+/)[0];
    out += '<span class="hljs-code">' + _escaped(open) + (_isMarkdown(language) ? _markdown(m[3]) : _in(m[3], language)) + _escaped(close) + "</span>";
    pos = m.index + m[0].length;
  }
  return out + _in(rest.slice(pos), "markdown");
};

/* Färbt die Blöcke unter `root`, deren Grammatik schon steht; HTTP-Statuscodes bekommen ihre
   Klasse `skr-http-status--«n»xx`. */
const _colorize = (root) => (root || document).querySelectorAll(_BLOCKS).forEach((el) => {
  const language = _language(el);
  if (el.dataset.highlighted || !_known(language)) return;
  if (_isMarkdown(language)) {
    el.innerHTML = _markdown(el.textContent);
    el.classList.add("hljs");
    el.dataset.highlighted = "yes";
  } else {
    hljs.highlightElement(el);
  }
  if (hljs.getLanguage(language).name === "HTTP") {
    el.querySelectorAll(".hljs-number").forEach((n) => {
      const code = parseInt(n.textContent, 10);
      if (code >= 100 && code <= 599) n.classList.add("skr-http-status--" + Math.floor(code / 100) + "xx");
    });
  }
});

/* Färbt unter `root` und lädt dafür, was fehlt: was schon geladen ist, sofort, der Rest, sobald
   seine Grammatik steht. */
function apply(root) {
  const blocks = Array.from((root || document).querySelectorAll(_BLOCKS)).filter((el) => !el.dataset.highlighted);
  if (hljs) _colorize(root);
  const languages = blocks.flatMap((el) => wanted(el.textContent, _language(el)));
  return load(languages).then(() => { _colorize(root); });
}

/* Eine Zeichenkette färben, ohne Element – etwa Zeile für Zeile in einer Visualisierung: HTML
   mit den Klassen der Hervorhebung, der Text maskiert. Synchron: Eine Sprache, deren Grammatik
   noch nicht geladen ist, kommt nur maskiert zurück – `load` lädt sie vorher. */
const _code = (text, language) => {
  const t = String(text == null ? "" : text);
  if (!_known(language)) return _escaped(t);
  return _isMarkdown(language) ? _markdown(t) : _in(t, language);
};

const _ready = () => {
  if (window.skr && !window.skr.highlight) {
    Object.defineProperty(window.skr, "highlight", {
      value: Object.freeze({
        get hljs() { return hljs; },
        get languages() { return Array.from(_loaded); },
        apply: apply,
        load: load,
        code: _code,
      }),
      enumerable: true,
    });
  }
  document.dispatchEvent(new CustomEvent("skr-highlight-ready"));
};
apply(document).then(_ready, _ready);
