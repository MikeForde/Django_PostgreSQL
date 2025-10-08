#!/usr/bin/env python3
import sys, json, re
from typing import Dict, Any, List

# ── Loose tag readers ──────────────────────────────────────────────────────────
TAG_OPEN_RE     = re.compile(r"<\s*([A-Za-z0-9_]+)\s*>")                   # <TAG>
TAG_LINE_RE     = re.compile(r"<\s*([A-Za-z0-9_]+)\s*>(.*)")              # <TAG>value...
TAG_EMPTY_RE    = re.compile(r"<\s*([A-Za-z0-9_]+)\s*/\s*>")              # <TAG/>
TRAILING_LT_RE  = re.compile(r"(.*?)(<+\s*)?$")                           # strip trailing '<'
WS_ONLY_RE      = re.compile(r"^\s*$")

BOOL_KEYS = {"DISPLAY","VISIBLE","READONLY","DEFAULT","SELECT"}
INT_KEYS  = {"CTYPE","X","Y","W","H","TAB","ZINDEX","PAGEW","PAGEH","BCOL","FORECOLOUR"}
FLT_KEYS  = {"FSIZE","FSIZE_F"}

# Some page-level keys live under <PAGES> as W/H/FSIZE; prefer those over TFORMS
PAGE_KEY_MAP = {"W":"PAGEW","H":"PAGEH","FSIZE":"FSIZE_F"}

def coerce_value(key: str, raw: str):
    s = raw.strip()
    # remove any trailing "<" noise like "52<"
    s = TRAILING_LT_RE.sub(lambda m: (m.group(1) or "").rstrip(), s)
    if key.upper() in BOOL_KEYS:
        return s.lower() in ("true","1","yes","display","default")
    if key.upper() in INT_KEYS:
        try: return int(float(s))
        except: pass
    if key.upper() in FLT_KEYS:
        try: return float(s)
        except: pass
    # bare numbers that aren't listed above: keep as number if clean int/float
    if re.fullmatch(r"-?\d+", s):
        try: return int(s)
        except: pass
    if re.fullmatch(r"-?\d+\.\d+", s):
        try: return float(s)
        except: pass
    return s

def flush_block(current: Dict[str, Any], bucket: List[Dict[str, Any]]):
    if not current: return
    cleaned = {k:v for k,v in current.items() if v not in ("", None)}
    if cleaned: bucket.append(cleaned)
    current.clear()

# ── Parser ─────────────────────────────────────────────────────────────────────
def parse_efx(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    meta: Dict[str, Any] = {}
    tpccp: List[Dict[str, Any]] = []
    tpcp:  List[Dict[str, Any]] = []

    cur_ccp: Dict[str, Any] = {}
    cur_cp:  Dict[str, Any] = {}

    in_ccp = in_cp = in_pages = in_tforms = False

    for raw in lines:
        line = raw.strip()
        if WS_ONLY_RE.match(line): 
            continue

        # Section switches
        if line.startswith("<TPCCP"):
            flush_block(cur_ccp, tpccp); flush_block(cur_cp, tpcp)
            cur_ccp = {}; in_ccp, in_cp = True, False
            continue
        if line.startswith("<TPcP"):
            flush_block(cur_ccp, tpccp); flush_block(cur_cp, tpcp)
            cur_cp = {}; in_ccp, in_cp = False, True
            continue

        if line.startswith("<PAGES>") or line.startswith("<PAGES"):
            in_pages = True;  in_tforms = False;  continue
        if line.startswith("<TFORMS>") or line.startswith("<TFORMS"):
            in_tforms = True; in_pages = False;  continue
        if line.startswith("</PAGES>"):
            in_pages = False; continue
        if line.startswith("</TFORMS>"):
            in_tforms = False; continue

        # META: accept PAGEW/PAGEH/FSIZE_F in TFORMS; in PAGES prefer W/H/FSIZE
        m = TAG_LINE_RE.match(line)
        if m:
            key, val = m.groups()
            keyU = key.upper()
            # Page-level overrides
            if in_pages and keyU in ("W","H","FSIZE"):
                meta[PAGE_KEY_MAP[keyU]] = coerce_value(keyU, val)
                continue
            if in_tforms and keyU in ("PAGEW","PAGEH","FONTNAME_F","FSIZE_F"):
                meta[keyU] = coerce_value(keyU, val)
                continue

            # Active block targets
            target = cur_ccp if in_ccp else (cur_cp if in_cp else None)
            if target is not None:
                # keep original ITEMS string verbatim; other keys coerced
                if keyU == "ITEMS":
                    # keep flattened, no splitting
                    v = TRAILING_LT_RE.sub(lambda m: (m.group(1) or "").rstrip(), val).strip()
                    target[keyU] = v
                else:
                    target[keyU] = coerce_value(keyU, val)
            continue

        # Empty tags like <PARENT />
        m = TAG_EMPTY_RE.match(line)
        if m:
            key = m.group(1).upper()
            target = cur_ccp if in_ccp else (cur_cp if in_cp else None)
            if target is not None:
                target[key] = ""
            continue

    # Final flush
    flush_block(cur_ccp, tpccp)
    flush_block(cur_cp,  tpcp)

    # Clean + normalize controls
    def clean_ctrl(c: Dict[str,Any]) -> Dict[str,Any]:
        keep = {"ID","CID","CTYPE","PARENT","X","Y","FSIZE","BCOL","H","W","TAB",
                "DISPLAY","VISIBLE","READONLY","STYLE","TEXT","HELPTEXT","ZINDEX",
                "FORECOLOUR"}
        out = {k:v for k,v in c.items() if k in keep}
        # cast shapes
        for k in ("CTYPE","X","Y","W","H","TAB","ZINDEX","BCOL","FORECOLOUR"):
            if k in out:
                try: out[k] = int(float(out[k]))
                except: pass
        if "FSIZE" in out:
            try: out["FSIZE"] = float(out["FSIZE"])
            except: pass
        # drop empties again
        out = {k:v for k,v in out.items() if v not in ("", None)}
        return out

    def clean_prop(p: Dict[str,Any]) -> Dict[str,Any]:
        keep = {"ID","ALIGN","ITEMS","DEFAULT","BLANK","SELECT","RUNJAVASCRIPT"}
        out = {k:v for k,v in p.items() if k in keep}
        return out

    tpccp = [clean_ctrl(c) for c in tpccp if ("ID" in c or "CID" in c)]
    tpcp  = [clean_prop(p) for p in tpcp  if "ID" in p]

    # Defaults + prefer page W/H if present
    meta.setdefault("FONTNAME_F","Arial")
    meta.setdefault("FSIZE_F", 9)
    # If PAGEW/H absent but TFORMS had them, keep; else fall back
    meta["PAGEW"] = int(meta.get("PAGEW", 1024))
    meta["PAGEH"] = int(meta.get("PAGEH", 768))

    return {"meta": meta, "tpccp": tpccp, "tpcp": tpcp}

# ── Flat JSON writer (one-line objects) ────────────────────────────────────────
def flat_objects_lines(lst, item_indent=4):
    """Return a list of single-line JSON dicts, each already indented."""
    lines = []
    for d in lst:
        inner = ", ".join(f'"{k}":{json.dumps(v, ensure_ascii=False)}' for k, v in d.items())
        lines.append(" " * item_indent + "{" + inner + "}")
    return lines

def render_output(data: dict) -> str:
    # meta as a compact inline object
    meta_line = f'  "meta": {json.dumps(data["meta"], ensure_ascii=False)},'

    # tpccp array with one object per line
    tpccp_lines = flat_objects_lines(data["tpccp"], item_indent=4)
    tpccp_block = "  \"tpccp\": [\n" + ",\n".join(tpccp_lines) + "\n  ],"

    # tpcp array with one object per line
    tpcp_lines = flat_objects_lines(data["tpcp"], item_indent=4)
    tpcp_block = "  \"tpcp\": [\n" + ",\n".join(tpcp_lines) + "\n  ]"

    return "{\n" + "\n".join([meta_line, tpccp_block, tpcp_block]) + "\n}\n"

def main():
    if len(sys.argv) < 2:
        print("Usage: python efx_to_json.py MF_Advanced_Army_Grading_Concept.efx > eform-data.json")
        sys.exit(1)
    data = parse_efx(sys.argv[1])
    print(render_output(data), end="")

if __name__ == "__main__":
    main()
