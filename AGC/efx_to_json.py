#!/usr/bin/env python3
import sys, json, re
from pathlib import Path

# ── helpers ───────────────────────────────────────────────────────────────────

TAG_LINE = re.compile(r'^\s*<([A-Za-z0-9_]+)>\s*(.*?)\s*$')

INT_FIELDS   = {"X","Y","H","W","TAB","CTYPE","PAGEW","PAGEH","FCOL","BCOL","ZINDEX"}
FLOAT_FIELDS = {"FSIZE","FSIZE_F"}
BOOL_FIELDS  = {"DISPLAY","READONLY","VISIBLE"}

def strip_closing(val: str) -> str:
    """Remove a trailing </TAG> if present, and dangling '<' from size-trimmed lines."""
    if val is None:
        return ''
    s = str(val).strip()
    # remove trailing closing tag e.g. "OPT2722</OPTIONID>"
    s = re.sub(r'</[A-Za-z0-9_]+>\s*$', '', s)
    # some trimmed lines have stray '<' at the end like "52<"
    if s.endswith('<'):
        s = s[:-1].rstrip()
    return s

def coerce(key, val):
    if val is None: return None
    sval = strip_closing(val)

    # booleans
    if key in BOOL_FIELDS:
        low = sval.lower()
        if low in ("true","false"):
            return low == "true"
        return sval  # leave unusual content as string

    # ints
    if key in INT_FIELDS:
        try:
            return int(float(sval))
        except:
            return None

    # floats
    if key in FLOAT_FIELDS:
        try:
            return float(sval)
        except:
            return None

    # everything else: raw string (preserve entities like &lt;br&gt;)
    return sval

def parse_blocks(lines, start_tags):
    """
    Yield dicts for blocks that start with any tag in start_tags and end
    just before the next occurrence of the same start tag.
    """
    if isinstance(start_tags, str):
        start_tags = [start_tags]
    starts = tuple(f"<{t}>" for t in start_tags)

    i, n = 0, len(lines)
    while i < n:
        if any(lines[i].strip().startswith(s) for s in starts):
            # Which tag started us (so we know when to stop)?
            this_tag = next(s for s in starts if lines[i].strip().startswith(s))
            i += 1
            block = {}
            last_key = None
            while i < n and not lines[i].strip().startswith(this_tag):
                line = lines[i].rstrip("\n")
                m = TAG_LINE.match(line)
                if m:
                    key, raw = m.group(1), m.group(2)
                    val = coerce(key, raw)
                    block[key] = val
                    last_key = key
                else:
                    # Continuation: keep appending to TEXT if that was last
                    if last_key == "TEXT":
                        block["TEXT"] = (block.get("TEXT","") + ("\n" if block.get("TEXT") else "") + line.strip())
                i += 1
            if block:
                yield block
        else:
            i += 1

# ── meta ──────────────────────────────────────────────────────────────────────

def parse_meta(lines):
    meta = {}
    # Your compact "TFORMS" / "PAGES" remain supported
    for b in parse_blocks(lines, "TFORMS"):
        if "FONTNAME_F" in b: meta["FONTNAME_F"] = b["FONTNAME_F"]
        if "FSIZE_F"   in b: meta["FSIZE_F"]   = coerce("FSIZE_F", b["FSIZE_F"])
    for b in parse_blocks(lines, "PAGES"):
        if "W" in b: meta["PAGEW"] = coerce("PAGEW", b["W"])
        if "H" in b: meta["PAGEH"] = coerce("PAGEH", b["H"])
        if "FSIZE" in b and "FSIZE_F" not in meta:
            meta["FSIZE_F"] = coerce("FSIZE_F", b["FSIZE"])
        break

    # Sensible fallbacks
    meta.setdefault("FONTNAME_F", "Arial")
    meta.setdefault("FSIZE_F", 9.0)
    meta.setdefault("PAGEW", 600)
    meta.setdefault("PAGEH", 600)
    return meta

# ── tpccp (controls) ─────────────────────────────────────────────────────────

def map_common_to_compact(b: dict) -> dict:
    """
    Map original <TBLPAGECONTROLCOMMONPROPERTIES> keys to your compact tpccp dict.
    """
    d = {}
    # ID/CID/TYPE/PARENT
    if "OPTIONID" in b:           d["ID"]     = b["OPTIONID"]
    if "CONTROLID" in b:          d["CID"]    = b["CONTROLID"]
    if "CONTROLTYPE" in b:        d["CTYPE"]  = coerce("CTYPE", b["CONTROLTYPE"])
    if "PARENTCONTROLID" in b:    d["PARENT"] = b["PARENTCONTROLID"]

    # positioning and sizing
    if "XPOSITION" in b:          d["X"]      = coerce("X", b["XPOSITION"])
    if "YPOSITION" in b:          d["Y"]      = coerce("Y", b["YPOSITION"])
    if "HEIGHT" in b:             d["H"]      = coerce("H", b["HEIGHT"])
    if "WIDTH" in b:              d["W"]      = coerce("W", b["WIDTH"])

    # font / color / z
    if "FONTSIZE" in b:           d["FSIZE"]  = coerce("FSIZE", b["FONTSIZE"])
    if "BACKCOLOUR" in b:         d["BCOL"]   = coerce("BCOL", b["BACKCOLOUR"])
    if "ZINDEX" in b:             d["ZINDEX"] = coerce("ZINDEX", b["ZINDEX"])
    if "TEXT" in b and b["TEXT"]: d["TEXT"]   = b["TEXT"]

    # flags
    if "TABINDEX" in b:           d["TAB"]     = coerce("TAB", b["TABINDEX"])
    if "VISIBLE" in b:            d["VISIBLE"] = (str(b["VISIBLE"]).lower() == "true")
    if "DISPLAY" in b:            d["DISPLAY"] = (str(b["DISPLAY"]).lower() == "true")
    if "READONLY" in b:           d["READONLY"]= (str(b["READONLY"]).lower() == "true")

    # style / help
    if "CSSSTYLE" in b and b["CSSSTYLE"]:
        d["STYLE"] = b["CSSSTYLE"].strip()
    if "HELPTEXT" in b and b["HELPTEXT"]:
        d["HELPTEXT"] = b["HELPTEXT"]

    # Normalize missing parent
    d.setdefault("PARENT", "PG23271")
    return d

def parse_tpccp(lines):
    controls = []

    # 1) your compact blocks
    for b in parse_blocks(lines, "TPCCP"):
        d = {}
        for k in ("ID","CID","PARENT","STYLE","TEXT","HELPTEXT"):
            if k in b: d[k] = b[k]
        for k in ("CTYPE","X","Y","H","W","TAB","BCOL","FSIZE","ZINDEX"):
            if k in b: d[k] = coerce(k, b[k])
        for k in ("DISPLAY","READONLY","VISIBLE"):
            if k in b: d[k] = coerce(k, b[k])
        if not d.get("PARENT"):
            d["PARENT"] = b.get("PARENT") or "PG23271"
        controls.append(d)

    # 2) original blocks
    for b in parse_blocks(lines, "TBLPAGECONTROLCOMMONPROPERTIES"):
        controls.append(map_common_to_compact(b))

    return controls

# ── tpcp (properties) ────────────────────────────────────────────────────────

def map_props_to_compact(b: dict) -> dict:
    """
    Map original <TBLPAGECONTROLPROPERTIES> keys to your compact tpcp dict.
    Keep only fields your renderer uses.
    """
    d = {}
    # ID and (optional) PROPID
    if "OPTIONID" in b:   d["ID"]    = b["OPTIONID"]
    if "PROPERTYID" in b: d["PROPID"]= b["PROPERTYID"]

    # ITEMS / DEFAULT / ALIGN (and keep your existing optional ones)
    if "ITEMSCOLLECTION" in b and b["ITEMSCOLLECTION"]:
        d["ITEMS"] = b["ITEMSCOLLECTION"]
    if "DEFAULTVALUE" in b and b["DEFAULTVALUE"] is not None:
        d["DEFAULT"] = strip_closing(b["DEFAULTVALUE"])
    if "TEXTALIGN" in b and b["TEXTALIGN"]:
        # Normalize alignment to your casing (e.g., "Center", "Left", "Right")
        t = b["TEXTALIGN"].strip().capitalize()
        if t in ("Left","Center","Right"):
            d["ALIGN"] = t

    # Allow these to pass through if present (your renderer tolerates them)
    passthru = {"TEXTMODE","TOOLBARMODE","DIRECTION","BLANK","SELECT",
                "FUNCTIONORDER","RUNJAVASCRIPT","MAX","BTYPE"}
    for k in passthru:
        if k in b and b[k] not in (None, ""):
            d[k] = b[k]

    return d if "ID" in d else {}

def parse_tpcp(lines):
    props = []

    # 1) your compact blocks
    for b in parse_blocks(lines, "TPcP"):
        keep = {"ID","ALIGN","ITEMS","DEFAULT","MAX","BTYPE","TEXTMODE",
                "TOOLBARMODE","DIRECTION","BLANK","SELECT",
                "FUNCTIONORDER","RUNJAVASCRIPT"}
        d = {k: v for k, v in b.items() if k in keep}
        if "ID" in d:
            props.append(d)

    # 2) original blocks
    for b in parse_blocks(lines, "TBLPAGECONTROLPROPERTIES"):
        d = map_props_to_compact(b)
        if d:
            props.append(d)

    return props

# ── main read/render ─────────────────────────────────────────────────────────

def parse_efx(path):
    text = Path(path).read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    data = {
        "meta":  parse_meta(lines),
        "tpccp": parse_tpccp(lines),
        "tpcp":  parse_tpcp(lines),
    }
    return data

def flat_objects_lines(lst, item_indent=4):
    lines = []
    for d in lst:
        order = ["ID","CID","CTYPE","PARENT","TEXT","X","Y","FSIZE","BCOL","H","W",
                 "TAB","DISPLAY","READONLY","VISIBLE","STYLE","ZINDEX","HELPTEXT",
                 "PROPID","ALIGN","ITEMS","DEFAULT","MAX","BTYPE","TEXTMODE",
                 "TOOLBARMODE","DIRECTION","BLANK","SELECT","FUNCTIONORDER","RUNJAVASCRIPT"]
        items = []
        for k in order:
            if k in d:
                items.append(f'"{k}":{json.dumps(d[k], ensure_ascii=False)}')
        for k in d:
            if k not in order:
                items.append(f'"{k}":{json.dumps(d[k], ensure_ascii=False)}')
        inner = ", ".join(items)
        lines.append(" " * item_indent + "{" + inner + "}")
    return lines

def render_output(data: dict) -> str:
    meta_line   = f'  "meta": {json.dumps(data["meta"], ensure_ascii=False)},'
    tpccp_lines = flat_objects_lines(data["tpccp"], item_indent=4)
    tpcp_lines  = flat_objects_lines(data["tpcp"],  item_indent=4)
    tpccp_block = "  \"tpccp\": [\n" + ",\n".join(tpccp_lines) + "\n  ],"
    tpcp_block  = "  \"tpcp\": [\n"  + ",\n".join(tpcp_lines)  + "\n  ]"
    return "{\n" + "\n".join([meta_line, tpccp_block, tpcp_block]) + "\n}\n"

def main():
    if len(sys.argv) < 2:
        print("Usage: python efx_to_json.py MF_Advanced_Army_Grading_Concept.efx > eform-data.json")
        sys.exit(1)
    data = parse_efx(sys.argv[1])
    print(render_output(data), end="")

if __name__ == "__main__":
    main()
