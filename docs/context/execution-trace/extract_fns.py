"""Extract function sources from pinned commits for the Saksi Execution Trace page.

manifest.json: [{"key", "repo": "saksi"|"balotachain", "path", "symbol", "lang", "why"}]
symbol forms:
  go     Name | Recv.Name          (method receiver type, pointer or not)
         var:Name | const:Name | type:Name
  rust   name | Type::name | struct:Name | const:NAME
  ts     name                       (function or const arrow)
Writes fn-data.json {key: {file, line, code, why, lang}}. Exits 1 on any miss or
ambiguity, so the page can never name a function the commit does not have.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# The page is pinned to these commits. Repo paths default to sibling checkouts of
# balotachain (this file is balotachain/docs/context/execution-trace/extract_fns.py);
# override with SAKSI_REPO / BALOTACHAIN_REPO, and re-pin with SAKSI_COMMIT /
# BALOTACHAIN_COMMIT. Only git objects are read, so the checkouts can be on any branch.
_BALOTACHAIN = Path(__file__).resolve().parents[3]
REPOS = {
    "saksi": (os.environ.get("SAKSI_REPO", str(_BALOTACHAIN.parent / "saksi")),
              os.environ.get("SAKSI_COMMIT", "dca7776")),
    "balotachain": (os.environ.get("BALOTACHAIN_REPO", str(_BALOTACHAIN)),
                    os.environ.get("BALOTACHAIN_COMMIT", "b03d4ba")),
}
_cache = {}


def source(repo, path):
    k = (repo, path)
    if k not in _cache:
        root, commit = REPOS[repo]
        out = subprocess.run(["git", "-C", root, "show", f"{commit}:{path}"],
                             capture_output=True, check=True)
        _cache[k] = out.stdout.decode("utf-8").replace("\r\n", "\n").split("\n")
    return _cache[k]


def def_patterns(lang, symbol):
    kind, _, name = symbol.rpartition(":") if ":" in symbol and "::" not in symbol else ("", "", symbol)
    if lang == "go":
        if kind in ("var", "const", "type"):
            return [rf"^{kind} {re.escape(name)}\b"]
        if "." in name:
            recv, fn = name.split(".", 1)
            return [rf"^func \(\w+ \*?{re.escape(recv)}(\[[^\]]*\])?\) {re.escape(fn)}[\[(]"]
        return [rf"^func (\(\w+ \*?\w+(\[[^\]]*\])?\) )?{re.escape(name)}[\[(]"]
    if lang == "rust":
        if kind == "struct":
            return [rf"^\s*(pub(\([^)]*\))? )?struct {re.escape(name)}\b"]
        if kind == "const":
            return [rf"^\s*(pub(\([^)]*\))? )?const {re.escape(name)}\b"]
        return [rf"^\s*(pub(\([^)]*\))? )?(async )?fn {re.escape(name.split('::')[-1])}\b"]
    if lang in ("ts", "typescript"):
        return [rf"^\s*(export )?(async )?function {re.escape(name)}\b",
                rf"^\s*(export )?const {re.escape(name)}\b"]
    raise ValueError(lang)


def find_def(lines, lang, symbol):
    pats = [re.compile(p) for p in def_patterns(lang, symbol)]
    hits = [i for i, l in enumerate(lines) if any(p.search(l) for p in pats)]
    if lang == "rust" and "::" in symbol:
        typ = symbol.split("::")[0]
        impl = re.compile(rf"^\s*impl(<[^>]*>)?\s+(\w+\s+for\s+)?{re.escape(typ)}\b")
        starts = [i for i, l in enumerate(lines) if impl.search(l)]
        scoped = []
        for s in starts:
            end = block_end(lines, s, "rust")
            scoped += [h for h in hits if s < h <= end]
        hits = scoped
    return hits


def block_end(lines, start, lang):
    """Line index where the item starting at `start` ends (brace matched)."""
    text = "\n".join(lines[start:])
    depth, i, n, opened = 0, 0, len(text), False
    parens = angles = 0
    while i < n:
        c = text[i]
        two = text[i:i + 2]
        if two == "//":
            i = text.find("\n", i)
            if i < 0:
                break
            continue
        if two == "/*":
            i = text.find("*/", i + 2) + 2
            continue
        if c == '"':
            if lang == "rust" and i > 0 and text[i - 1] == "r":
                pass
            i += 1
            while i < n and text[i] != '"':
                i += 2 if text[i] == "\\" else 1
            i += 1
            continue
        if c == "`" and lang in ("go", "ts"):
            i = text.find("`", i + 1) + 1
            continue
        if c == "'":
            m = re.match(r"'(\\.|[^\\'])'", text[i:i + 4]) or re.match(r"'\\u\{[0-9a-fA-F]+\}'", text[i:i + 12])
            if m:
                i += len(m.group(0))
                continue
            if lang == "ts":
                i += 1
                while i < n and text[i] != "'":
                    i += 2 if text[i] == "\\" else 1
                i += 1
                continue
            i += 1  # rust lifetime
            continue
        # Before the body opens, braces inside the signature's parentheses (Go
        # interface{...} parameters) or TS generic brackets are type literals.
        if not opened:
            if c == "(":
                parens += 1
            elif c == ")":
                parens -= 1
            elif lang == "ts" and c == "<":
                angles += 1
            elif lang == "ts" and c == ">" and text[i - 1] != "=":
                angles -= 1
            if c == "{" and (parens > 0 or angles > 0 or text[i + 1:i + 2] == "}"):
                i += 2 if text[i + 1:i + 2] == "}" else 1
                if parens > 0 or angles > 0:
                    skip = 1
                    while i < n and skip:
                        skip += {"{": 1, "}": -1}.get(text[i], 0)
                        i += 1
                continue
        if c == "{":
            depth += 1
            opened = True
        elif c == "}":
            depth -= 1
            if opened and depth == 0:
                return start + text.count("\n", 0, i)
        elif c == ";" and not opened and depth == 0:
            return start + text.count("\n", 0, i)
        i += 1
    raise ValueError(f"unbalanced block from line {start + 1}")


def leading_comments(lines, i, lang):
    j = i
    marks = ("//", "///", "#[", "#!") if lang == "rust" else ("//",)
    while j > 0 and lines[j - 1].strip().startswith(marks):
        j -= 1
    return j


def main():
    manifest = json.load(open(sys.argv[1], encoding="utf-8"))
    out, errors = {}, []
    for e in manifest:
        lines = source(e["repo"], e["path"])
        hits = find_def(lines, e["lang"], e["symbol"])
        if len(hits) != 1:
            errors.append(f'{e["key"]}: {e["symbol"]} in {e["repo"]}/{e["path"]} matched {len(hits)} times {[h + 1 for h in hits]}')
            continue
        d = hits[0]
        end = block_end(lines, d, e["lang"])
        top = leading_comments(lines, d, e["lang"])
        out[e["key"]] = {
            "file": f'{e["repo"]}/{e["path"]}',
            "line": d + 1,
            "code": "\n".join(l.rstrip() for l in lines[top:end + 1]),
            "why": e["why"],
            "name": e.get("name") or e["symbol"],
            "lang": {"ts": "typescript"}.get(e["lang"], e["lang"]),
        }
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(out)} functions extracted")


if __name__ == "__main__":
    main()
