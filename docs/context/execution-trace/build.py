"""Assemble saksi-trace.html from head.html (the published page's CSS), body.html
and fn-data.json. SNIP markers are filled with verbatim lines from fn-data, so
every code figure on the page is the extracted source, not a retyping."""
import html
import json
import re
import sys
import textwrap

fn = json.load(open("fn-data.json", encoding="utf-8"))
head = open("head.html", encoding="utf-8").read()
body = open("body.html", encoding="utf-8").read()
errors = []

EXTRA_CSS = """
<style>
  [hidden] { display: none !important; }
  .pin { font: 400 12px/1.6 "IBM Plex Mono", monospace; color: var(--ink-faint); margin: 18px 0 0; }
  .pin code { background: none; padding: 0; font-size: 12px; color: var(--ink-soft); }
  h3.sub { font: 600 15px/1.4 "IBM Plex Sans", sans-serif; margin: 30px 0 10px; text-wrap: balance; }
  h3.sub code { font-size: 13px; }
  .muted { color: var(--ink-faint); font-weight: 400; }
  .small-note { font-size: 13.5px; color: var(--ink-soft); margin: -8px 0 0; }
  .elide { color: var(--ink-faint); font-size: 13px; padding-left: 14px; }
  .wrapcode { font-size: 12px; word-break: break-all; }
  .note figure { margin: 12px 0 0; }
  .v-inc  { background: var(--amber-weak); color: var(--amber); }
  .v-fail { background: var(--reject-weak); color: var(--reject); }
  .role { font: 500 10.5px/1 "IBM Plex Mono", monospace; letter-spacing: .04em; padding: 4px 7px;
          border-radius: 3px; white-space: nowrap; border: 1px solid transparent; }
  .r-public  { background: var(--seal-weak); color: var(--seal-ink); }
  .r-signed  { background: var(--code-bg); color: var(--ink); border-color: var(--rule); }
  .r-trustee { background: var(--amber-weak); color: var(--amber); }
  .r-admin   { background: var(--reject-weak); color: var(--reject); }
  .r-legacy  { background: var(--code-bg); color: var(--ink-faint); border-style: dashed; border-color: var(--rule); }
  .routes td:first-child { min-width: 14em; }
</style>
"""


def snip(m):
    key, start, end = m.group(1), m.group(2), m.group(3)
    if key not in fn:
        errors.append(f"SNIP {key}: no such function")
        return ""
    lines = fn[key]["code"].split("\n")
    i = next((n for n, l in enumerate(lines) if start in l), None)
    if i is None:
        errors.append(f"SNIP {key}: start {start!r} not found")
        return ""
    if end.startswith("^"):
        j = next((n for n in range(i, len(lines)) if lines[n].rstrip() == end[1:]), None)
    else:
        j = next((n for n in range(i, len(lines)) if end in lines[n]), None)
    if j is None:
        errors.append(f"SNIP {key}: end {end!r} not found after {start!r}")
        return ""
    code = textwrap.dedent("\n".join(lines[i:j + 1]).expandtabs(4))
    return "<pre><code>" + html.escape(code, quote=False) + "</code></pre>"


body = re.sub(r"<!--SNIP ([^|]+)\|([^|]+)\|(.+?)-->", snip, body)

used = set(re.findall(r'data-fn="([^"]+)"', body))
for k in sorted(used - fn.keys()):
    errors.append(f"data-fn {k} has no extracted source")

text = re.sub(r"<[^>]+>", " ", body)
for stale in ["appendReceipt", "OfflineVoterCeiling", "check_nullifier_uniqueness", "six checks",
              "audit_with_evidence", "trail.json ", "multi_position_fixture", "halalan-e2e-20260830",
              "halalan-e2e-20260914-174438", "25d523f", "fixed in the generator", "the dealers are fixed"]:
    if stale in text:
        errors.append(f"stale name still on the page: {stale}")

if errors:
    print("\n".join(errors))
    sys.exit(1)

scripts = """
<script id="fn-data" type="application/json">""" + json.dumps(fn, ensure_ascii=False).replace("</", "<\\/") + """</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/go.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/rust.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/typescript.min.js"></script>
<script>
(function () {
  "use strict";
  var FN = JSON.parse(document.getElementById("fn-data").textContent);
  var LANG = { go: "Go", rust: "Rust", typescript: "TypeScript" };
  var side = document.getElementById("side"),
      scrim = document.getElementById("scrim"),
      last = null;

  function group(f) {
    if (f.file.indexOf("balotachain/") === 0) return "apps";
    if (f.file.indexOf("saksi-bulletin") > -1) return "chain";
    if (f.lang === "rust") return "rust";
    return "console";
  }
  var groups = { console: [], rust: [], chain: [], apps: [] };
  Object.keys(FN).forEach(function (k) { groups[group(FN[k])].push(k); });
  Object.keys(groups).forEach(function (g) {
    var box = document.getElementById("idx-" + g);
    if (!box) return;
    groups[g].sort(function (a, b) { return FN[a].name.localeCompare(FN[b].name); });
    box.innerHTML = groups[g].map(function (k) {
      var f = FN[k];
      return '<button class="fn" data-fn="' + k + '" type="button">' + f.name +
             "<em>" + f.file.split("/").pop() + ":" + f.line + "</em></button>";
    }).join("");
  });

  function open(key, trigger) {
    var f = FN[key];
    if (!f) return;
    last = trigger || null;
    document.getElementById("side-name").textContent = f.name;
    var loc = document.getElementById("side-loc");
    loc.innerHTML = "<b></b> &nbsp;";
    loc.firstChild.textContent = LANG[f.lang] || f.lang;
    loc.appendChild(document.createTextNode(f.file + " : " + f.line));
    var why = document.getElementById("side-why");
    why.innerHTML = "<b>Why it matters</b>";
    why.appendChild(document.createTextNode(f.why));
    var src = document.getElementById("side-src");
    src.textContent = f.code;
    src.className = "language-" + f.lang;
    if (window.hljs) { try { delete src.dataset.highlighted; hljs.highlightElement(src); } catch (e) {} }
    side.hidden = false;
    requestAnimationFrame(function () { side.classList.add("on"); scrim.classList.add("on"); });
    document.getElementById("close").focus();
    document.querySelector("#side .src").scrollTop = 0;
  }

  function close() {
    side.classList.remove("on");
    scrim.classList.remove("on");
    setTimeout(function () { side.hidden = true; }, 260);
    if (last) { last.focus(); last = null; }
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("button.fn");
    if (b) { open(b.dataset.fn, b); return; }
    if (e.target === scrim || e.target.id === "close") close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !side.hidden) close();
  });
})();
</script>
"""

page = "<title>Saksi Execution Trace</title>\n" + head + EXTRA_CSS + body + scripts
open("saksi-trace.html", "w", encoding="utf-8", newline="\n").write(page)
print(f"built saksi-trace.html: {len(page):,} chars, {len(used)} functions referenced in prose, "
      f"{len(fn) - len(used & fn.keys())} only in the index")
