#!/usr/bin/env python3
import argparse
import csv
import json
import math
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple
from myapp.tex_parser import parse_tex

import requests
from widget_codebanks import WIDGET_CODES


# -------- Helpers: extraction & normalization ---------------------------------

# Matches codes inside <code>…</code>
CODE_TAG_RE = re.compile(r"<code[^>]*>(.*?)</code>", re.IGNORECASE | re.DOTALL)

# Matches data-read-code="..."
DATA_ATTR_RE = re.compile(r'data-read-code\s*=\s*"([^"]+)"', re.IGNORECASE)

# Fallback "looks like a code" (letters/digits/dots, reasonably short)
# You can tighten this if needed.
LOOSE_CODE_RE = re.compile(r"\b([A-Z]{2,10}[0-9A-Z.]{0,8})\b")

# Lines like "CODE — Label" (the U+2014 em dash often appears in your HTML snippets)
LINE_WITH_DASH_RE = re.compile(r"^\s*([A-Z0-9.\-]+)\s+—\s+", re.IGNORECASE)

LAST_ENTRY_PREFIX_RE = re.compile(r"^\s*Last\s+Entry\s+for\s+", re.IGNORECASE)

NEGATION_OR_QUERY_RE = re.compile(r"^(NEGATION-|QUERY-)", re.IGNORECASE)

AUTO_ENTERED_RE = re.compile(r"^\s*Auto[-\s]*Entered\s+Text\s*:", re.IGNORECASE)

CODE_FROM_LABEL_RE = re.compile(r"\b([A-Z]{2,10}[0-9A-Z./]{0,12})\b", re.I)

READLIST_ROW_SPLIT_RE = re.compile(r"[\xFF\uFFFD]")

def _read_tex_or_html(p: Path) -> str:
    ext = p.suffix.lower()
    if ext == ".tex":
        # Preserve 0xFF bytes (ÿ) used by EMIS as row separators
        return p.read_text(encoding="latin-1")
    # HTML/Jinja templates are UTF-8
    return p.read_text(encoding="utf-8")

def looks_like_read_code(s: str) -> bool:
    if not s:
        return False
    s = s.strip()
    if len(s) > 20:  # keep sane
        return False
    # allow ellipsis codes (1T...), dotted families (22K..), numeric+dot (4671.)
    if s.endswith("..."):
        return True
    if "." in s:
        return True
    # alpha+digits like EMISNQRE312 / DMS4274
    return bool(re.fullmatch(r"[A-Za-z]{2,}[A-Za-z0-9]+", s))

def _readlist_pick_code(tokens: list[str]) -> str | None:
    """
    tokens: [Label, CODEPAIR, '', Label, CODEA, CODEB, 'False', ...]
    Prefer tokens[1] (pair or code), else first code-y token later on.
    """
    if len(tokens) >= 2:
        t = tokens[1].strip()
        if t:
            if "_" in t:
                a, b = t.split("_", 1)
                if looks_like_read_code(a): return a
                if looks_like_read_code(b): return b
            if looks_like_read_code(t): return t
    # fallback: scan later tokens
    for t in tokens[2:]:
        if looks_like_read_code(t.strip()):
            return t.strip()
    return None

def _add_readlist_codes_from_raw(raw: str, add_fn):
    if not raw:
        return
    rows = READLIST_ROW_SPLIT_RE.split(raw)
    # rows[0] is the title; rows[1:] are items
    for raw_row in rows[1:]:
        raw_row = raw_row.strip()
        if not raw_row:
            continue
        toks = [t.strip() for t in raw_row.split("~")]
        if not toks:
            continue
        pick = _readlist_pick_code(toks)
        if pick:
            add_fn(pick)

def _normalize_code(code: str) -> str:
    """
    Normalize a read code:
    - Strip leading 'Last Entry for ' (if any).
    - Trim spaces.
    """
    if not code:
        return ""
    code = code.strip()
    # Safety: some sources put the prefix into the code itself
    if code.lower().startswith("last entry for "):
        code = code[len("last entry for "):].strip()
    return code

def extract_codes_from_tex_content(tex_str: str) -> list[str]:
    controls, _ = parse_tex(tex_str)

    seen: set[str] = set()
    out: list[str] = []

    def add(raw: str | None):
        if not raw:
            return
        code = _normalize_code(raw.strip())
        if not code:
            return
        # Normalise case like the webapp sidebar (upper) to match SnowFusion keys
        code_norm = code.upper()
        if code_norm not in seen:
            seen.add(code_norm)
            out.append(code_norm)

    for c in controls:
        ctype = (c.type or "").upper()

        # --- ReadCode / QuestionReadCode
        if getattr(c, "is_readcode", False):
            add(c.rc_code)
            # If qualifiers include Negation, webapp renders an extra NEGATION-<code> pseudo-code
            if getattr(c, "rc_has_negation", False) and c.rc_code:
                add(f"{getattr(c, 'rc_neg_prefix', 'NEGATION-')}{c.rc_code}")

        # --- ReadList
        if getattr(c, "is_readlist", False):
            added = False
            # 1) Prefer parsed options (parse_tex already tries to pull codes)
            for it in (getattr(c, "options", []) or []):
                if it.code and looks_like_read_code(it.code):
                    add(it.code)
                    added = True
            # 2) If options carried no codes, parse the raw EMIS blob exactly as renderer does
            if not added:
                raw = (c.props or {}).get("strDataAsString", "") or ""
                _add_readlist_codes_from_raw(raw, add)

        # --- Diary readcode (sidebar shows these in the Diary section)
        if getattr(c, "is_diary", False) and getattr(c, "diary_readcode", None):
            add(c.diary_readcode)

        # --- LastEntry pseudo-readcode (sidebar shows "Last Entry for X")
        if getattr(c, "is_lastentry", False) and getattr(c, "le_code", None):
            add(c.le_code)

        # --- Widget codebanks (mirror import_tex.html manual data-readcodes)
        for key, bank in WIDGET_CODES.items():
            if key in ctype and bank:
                for k in bank:
                    add(k)

    return out


def strip_last_entry_prefix(s: str) -> str:
    return LAST_ENTRY_PREFIX_RE.sub("", s).strip()


def extract_codes_from_text(text: str) -> List[str]:
    """
    Best-effort extraction:
    - data-read-code="..."
    - <code>...</code>
    - lines like "CODE — Label"
    - last fallback: generic code-like tokens in the file
    """
    codes: Set[str] = set()

    # 1) Explicit data-read-code attributes
    for m in DATA_ATTR_RE.finditer(text):
        code = strip_last_entry_prefix(m.group(1)).strip()
        if code:
            codes.add(code)

    # 2) <code>…</code> blocks
    for m in CODE_TAG_RE.finditer(text):
        raw = m.group(1).strip()
        raw = strip_last_entry_prefix(raw)
        if raw:
            codes.add(raw)

    # 3) Lines like "CODE — Label"
    for line in text.splitlines():
        line = line.strip()
        if not line or AUTO_ENTERED_RE.search(line):
            continue
        mdash = LINE_WITH_DASH_RE.match(line)
        if mdash:
            code = strip_last_entry_prefix(mdash.group(1))
            if code:
                codes.add(code)

    # 4) Fallback scan (only if we found nothing above)
    if not codes:
        for m in LOOSE_CODE_RE.finditer(text):
            token = strip_last_entry_prefix(m.group(1))
            if token:
                codes.add(token)

    # Normalize whitespace
    return sorted({c.strip() for c in codes if c.strip()})


# -------- SnowFusion classification -------------------------------------------

def classify_decision(decision: str) -> str:
    """
    Map SnowFusion decision string to categories we track.
    """
    d = (decision or "").strip().lower()
    if "dmscreate" in d or d == "dms":
        return "DMSCreate"
    if "manual" in d:
        return "ManualMap"
    if "api" in d or "exact" in d or "auto" in d:
        return "APIMap"
    if "inactivate" in d:
        return "Ignored"  # treat as ignored for mix/ratio
    return "Other"

def make_session(cookie="", bearer=""):
    sess = requests.Session()
    sess.trust_env = False  # <-- ignore HTTP(S)_PROXY, NO_PROXY, etc.

    # Mimic curl a bit; some WAFs block python-requests
    sess.headers.update({
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "curl/8.1.2",   # looks like a harmless client
    })
    if cookie:
        sess.headers["Cookie"] = cookie
    if bearer:
        sess.headers["Authorization"] = f"Bearer {bearer}"
    return sess


def post_review_decisions(api_url, codes, batch_size=50, timeout=20.0, sess=None, cert=None, verify=True):
    sess = sess or make_session()
    results = {}
    for i in range(0, len(codes), batch_size):
        chunk = codes[i:i+batch_size]
        r = sess.post(api_url, json={"codes": chunk}, timeout=timeout, cert=cert, verify=verify, allow_redirects=False)
        # Helpful diagnostics
        if r.status_code == 403:
            raise requests.HTTPError(
                f"403 Forbidden. Tip: check proxies (trust_env), headers (UA), or reduce batch size. "
                f"Resp: {r.text[:300]!r}", response=r
            )
        r.raise_for_status()
        payload = r.json() or {}
        results.update((payload.get("results") or {}))
    return results


# -------- Aggregation per file ------------------------------------------------

def summarize_file(api_url: str, file_path: Path) -> Tuple[dict, List[dict]]:
    """
    For a single TEX/HTML file:
    - Prefer structured parse (same as webapp).
    - Fallback to text/HTML scraping ONLY if structured parse returns no codes.
    - Classify with SnowFusion.
    """
    text = _read_tex_or_html(file_path)

    # 1) Primary: structured parse (same logic as the webapp)
    all_codes = extract_codes_from_tex_content(text)

    # 2) Fallback: HTML/text scraping (covers genuine HTML library files)
    if not all_codes:
        all_codes = extract_codes_from_text(text)

    # Pre-class ignore (NEGATION-/QUERY-)
    to_query = []
    ignored_codes = []
    for c in all_codes:
        if NEGATION_OR_QUERY_RE.match(c):
            ignored_codes.append(c)
        else:
            to_query.append(c)

    # De-dupe query list (API is fine either way, this keeps payloads small)
    to_query = sorted(set(to_query))

    results: Dict[str, dict] = {}
    if to_query:
        results = post_review_decisions(api_url, to_query)

    # Build detailed list & counts
    detailed_rows: List[dict] = []
    counts = {"DMSCreate": 0, "APIMap": 0, "ManualMap": 0, "Other": 0, "Ignored": 0}

    for code in all_codes:
        if code in ignored_codes:
            cat = "Ignored"
            decision = "NEGATION/QUERY"
        else:
            hit = results.get(code) or {}
            decision = hit.get("decision") or ""
            # Treat Inactivate as Ignored (matches your heat-map denominator rule)
            cat = classify_decision(decision)

        counts[cat] = counts.get(cat, 0) + 1
        detailed_rows.append({
            "file": file_path.name,
            "code": code,
            "decision": decision,
            "category": cat,
        })

    # Ratio: DMS / (DMS + non-DMS), ignoring "Ignored"
    dms = counts.get("DMSCreate", 0)
    non_dms = counts.get("APIMap", 0) + counts.get("ManualMap", 0) + counts.get("Other", 0)
    denom = dms + non_dms
    ratio_pct = "" if denom == 0 else round(100.0 * dms / denom, 1)

    summary_row = {
        "file": file_path.name,
        "total_unique_codes": len(all_codes),
        "included": denom,
        "DMSCreate": counts.get("DMSCreate", 0),
        "APIMap": counts.get("APIMap", 0),
        "ManualMap": counts.get("ManualMap", 0),
        "Other": counts.get("Other", 0),
        "Ignored": counts.get("Ignored", 0),
        "ratio_percent": ratio_pct,  # blank if denom==0
    }
    return summary_row, detailed_rows



# -------- CLI -----------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Batch SnowFusion code mix for TEX library")
    ap.add_argument("--tex-dir", required=True, help="Directory containing .tex/.html files")
    ap.add_argument("--api", required=True, help="SnowFusion /review/decisions API URL")
    ap.add_argument("--out", default="snowfusion_code_mix.csv", help="Summary CSV output path")
    ap.add_argument("--details", default="", help="Optional detailed CSV output path (per-code rows)")
    ap.add_argument("--ext", nargs="*", default=[".tex", ".html", ".htm"], help="File extensions to include")
    ap.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout seconds")
    args = ap.parse_args()

    base = Path(args.tex_dir)
    if not base.is_dir():
        print(f"ERROR: {base} is not a directory", file=sys.stderr)
        sys.exit(1)

    files = sorted([p for p in base.iterdir() if p.suffix.lower() in {e.lower() for e in args.ext}])
    if not files:
        print("No TEX/HTML files found.")
        sys.exit(0)

    summary_rows: List[dict] = []
    all_details: List[dict] = []

    print(f"Scanning {len(files)} files in {base} ...")
    for idx, f in enumerate(files, 1):
        try:
            srow, drows = summarize_file(args.api, f)
            summary_rows.append(srow)
            all_details.extend(drows)
            print(f"[{idx}/{len(files)}] {f.name}: {srow['included']} considered, "
                  f"{srow['DMSCreate']} DMS, ratio={srow['ratio_percent'] or '—'}")
        except requests.HTTPError as e:
            print(f"[{idx}/{len(files)}] {f.name}: HTTP error {e}", file=sys.stderr)
        except Exception as e:
            print(f"[{idx}/{len(files)}] {f.name}: ERROR {e}", file=sys.stderr)

    # Write summary CSV
    if summary_rows:
        fieldnames = [
            "file", "total_unique_codes", "included",
            "DMSCreate", "APIMap", "ManualMap", "Other", "Ignored",
            "ratio_percent"
        ]
        with open(args.out, "w", newline="", encoding="utf-8") as fp:
            w = csv.DictWriter(fp, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(summary_rows)
        print(f"✅ Summary CSV written: {args.out} ({len(summary_rows)} rows)")
    else:
        print("No summary rows produced.")

    # Write details CSV (optional)
    if args.details:
        if all_details:
            d_fields = ["file", "code", "decision", "category"]
            with open(args.details, "w", newline="", encoding="utf-8") as fp:
                w = csv.DictWriter(fp, fieldnames=d_fields)
                w.writeheader()
                w.writerows(all_details)
            print(f"✅ Details CSV written: {args.details} ({len(all_details)} rows)")
        else:
            print("No details rows to write.")


if __name__ == "__main__":
    main()

