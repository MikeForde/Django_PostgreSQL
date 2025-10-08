#!/usr/bin/env python3
import sys, json, re, os
from typing import Dict, Any, List

# -------- Helpers --------

TAG_LINE_RE = re.compile(r"<\s*([A-Za-z0-9_]+)\s*>(.*?)\s*$")
TAG_EMPTY_RE = re.compile(r"<\s*([A-Za-z0-9_]+)\s*/\s*>\s*$")
TAG_CLOSING_RE = re.compile(r"<\s*/\s*([A-Za-z0-9_]+)\s*>\s*$")

# some values have trailing "<" like <H>270<
TRAILING_JUNK_RE = re.compile(r"^[\s]*([^<]+)")

def strip_trailing_junk(v: str) -> str:
    m = TRAILING_JUNK_RE.match(v)
    return m.group(1).strip() if m else v.strip()

def to_bool(v: str):
    return v.strip().lower() in ("true", "1", "yes")

def to_number(v: str):
    # Return int where possible, else float, else original string
    s = strip_trailing_junk(v)
    # allow negatives
    if re.fullmatch(r"-?\d+", s):
        try:
            return int(s)
        except Exception:
            return s
    if re.fullmatch(r"-?\d+\.\d+", s):
        try:
            return float(s)
        except Exception:
            return s
    return s

def parse_kv_value(key: str, raw: str):
    s = strip_trailing_junk(raw)

    # booleans
    if key.upper() in ("DISPLAY", "VISIBLE", "READONLY"):
        return to_bool(s)

    # known numeric fields (ints or floats)
    int_fields = {
        "CTYPE","X","Y","W","H","TAB","ZINDEX",
        "PAGEW","PAGEH","BCOL","FORECOLOUR",
    }
    float_fields = {"FSIZE","FSIZE_F"}

    if key.upper() in int_fields:
        n = to_number(s)
        return int(n) if isinstance(n,(int,float)) else n
    if key.upper() in float_fields:
        n = to_number(s)
        return float(n) if isinstance(n,(int,float)) else n

    # everything else: raw string
    return s

def flush_block(current: Dict[str, Any], bucket: List[Dict[str, Any]]):
    if current:
        # tidy empty keys
        cleaned = {k:v for k,v in current.items() if v not in ("", None)}
        if cleaned:
            bucket.append(cleaned)

# -------- Parser --------

def parse_efx(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    meta: Dict[str, Any] = {}
    tpccp: List[Dict[str, Any]] = []
    tpcp:  List[Dict[str, Any]] = []

    current_tpccp: Dict[str, Any] = {}
    current_tpcp: Dict[str, Any] = {}
    in_tpccp = False
    in_tpcp = False

    # Simple pass: walk lines, detect block starts <TPCCP> and <TPcP>,
    # read tag-value pairs until next block marker.
    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        # block starts
        if line.startswith("<TPCCP"):
            # flush any previous
            flush_block(current_tpccp, tpccp)
            flush_block(current_tpcp, tpcp)
            current_tpccp = {}
            in_tpccp, in_tpcp = True, False
            continue

        if line.startswith("<TPcP"):
            flush_block(current_tpccp, tpccp)
            flush_block(current_tpcp, tpcp)
            current_tpcp = {}
            in_tpccp, in_tpcp = False, True
            continue

        # very loose meta collection (header sections)
        # pick the ones your page uses
        if line.startswith("<PAGEW>"):
            v = parse_kv_value("PAGEW", line[len("<PAGEW>"):])
            meta["PAGEW"] = v
            continue
        if line.startswith("<PAGEH>"):
            v = parse_kv_value("PAGEH", line[len("<PAGEH>"):])
            meta["PAGEH"] = v
            continue
        if line.startswith("<FONTNAME_F>"):
            v = parse_kv_value("FONTNAME_F", line[len("<FONTNAME_F>"):])
            meta["FONTNAME_F"] = v
            continue
        if line.startswith("<FSIZE_F>"):
            v = parse_kv_value("FSIZE_F", line[len("<FSIZE_F>"):])
            meta["FSIZE_F"] = v
            continue

        # tag=value lines
        m_tag = TAG_LINE_RE.match(line)
        if m_tag:
            key, val = m_tag.groups()
            key = key.strip()
            # some properties come wrapped with closing tags on same line (e.g. <READONLY>true</READONLY>)
            # but the regex already captured the inner; just strip trailing closing if any:
            val = re.sub(TAG_CLOSING_RE, "", val).strip()
            target = current_tpccp if in_tpccp else (current_tpcp if in_tpcp else None)

            if target is None:
                # outside known blocks: ignore
                continue

            # Special handling: <ITEMS> lines should remain raw strings (commas preserved)
            if key.upper() == "ITEMS":
                target[key.upper()] = strip_trailing_junk(val)
            else:
                target[key.upper()] = parse_kv_value(key, val)
            continue

        m_empty = TAG_EMPTY_RE.match(line)
        if m_empty:
            key = m_empty.group(1).strip()
            target = current_tpccp if in_tpccp else (current_tpcp if in_tpcp else None)
            if target is not None:
                target[key.upper()] = ""
            continue

        # ignore any other lines (closing tags, etc.)

    # flush last blocks
    flush_block(current_tpccp, tpccp)
    flush_block(current_tpcp, tpcp)

    # Normalise field names and prune empties for tpccp
    def cleanup_ctrl(c: Dict[str, Any]) -> Dict[str, Any]:
        keep_keys = {
            "ID","CID","CTYPE","PARENT","X","Y","FSIZE","BCOL","H","W","TAB",
            "DISPLAY","VISIBLE","READONLY","STYLE","TEXT","FORECOLOUR","HELPTEXT","ZINDEX",
        }
        out: Dict[str, Any] = {}
        for k,v in c.items():
            ku = k.upper()
            if ku in keep_keys:
                out[ku] = v
        # final type coerce for safety
        if "CTYPE" in out: out["CTYPE"] = int(out["CTYPE"])
        for nkey in ("X","Y","W","H","TAB","ZINDEX"):
            if nkey in out:
                try: out[nkey] = int(float(out[nkey]))
                except Exception: pass
        for fkey in ("FSIZE",):
            if fkey in out:
                try: out[fkey] = float(out[fkey])
                except Exception: pass
        if "BCOL" in out:
            try: out["BCOL"] = int(out["BCOL"])
            except Exception: pass
        if "FORECOLOUR" in out:
            try: out["FORECOLOUR"] = int(out["FORECOLOUR"])
            except Exception: pass
        return out

    tpccp = [cleanup_ctrl(c) for c in tpccp if "ID" in c or "CID" in c]

    # Normalise tpcp (control property) blocks — keep ID plus commonly used props
    def cleanup_prop(p: Dict[str, Any]) -> Dict[str, Any]:
        keep = {"ID","ALIGN","ITEMS","DEFAULT","BLANK","SELECT","FUNCTIONORDER","RUNJAVASCRIPT","MAX","BTYPE","TEXTMODE","TOOLBARMODE","DIRECTION"}
        out = {}
        for k,v in p.items():
            ku = k.upper()
            if ku in keep:
                out[ku] = v
        return out if "ID" in out else {}
    tpcp = [x for x in (cleanup_prop(p) for p in tpcp) if x]

    # Defaults if meta missing
    if "PAGEW" not in meta: meta["PAGEW"] = 1024
    if "PAGEH" not in meta: meta["PAGEH"] = 768
    if "FONTNAME_F" not in meta: meta["FONTNAME_F"] = "Arial"
    if "FSIZE_F" not in meta: meta["FSIZE_F"] = 9

    return {"meta": meta, "tpccp": tpccp, "tpcp": tpcp}

# -------- Main --------

def main():
    if len(sys.argv) < 2:
        exe = os.path.basename(sys.argv[0])
        print(f"Usage: {exe} MF_Advanced_Army_Grading_Concept.efx [--pretty]")
        sys.exit(1)

    path = sys.argv[1]
    pretty = ("--pretty" in sys.argv)

    data = parse_efx(path)

    # Output JSON to stdout; redirect to a file if you like.
    if pretty:
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(data, separators=(",",":"), ensure_ascii=False))

if __name__ == "__main__":
    main()
