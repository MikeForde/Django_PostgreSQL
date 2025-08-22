# models/tex.py
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import re

@dataclass
class Property:
    name: str
    value: str

@dataclass
class ReadListItem:
    label: str
    code: Optional[str] = None
    selected: bool = False

@dataclass
class Control:
    type: str
    name: str
    x: int
    y: int
    width: int
    height: int
    props: Dict[str, str] = field(default_factory=dict)
    # convenience for rendering:
    caption: Optional[str] = None
    options: List[ReadListItem] = field(default_factory=list)
    exclusive: bool = False  # radio vs checkbox/select
    prompt: Optional[str] = None
    unit: Optional[str] = None
    is_bold: bool = False
    font_name: str | None = None
    font_size_pt: int | None = None
    font_color: str | None = None  # CSS like "#RRGGBB"

FORM_HEADER_RE = re.compile(r"#FORM~(?P<name>[^~]+)~(?P<title>[^~]+)~(?P<geom>\d+,\d+,\d+,\d+)")
PROP_RE = re.compile(
    r"^Prop~(?P<form>[^~]*)~(?P<ctrl>[^~]*)~(?P<key>[^~]*)~~(?P<val>.*)$",
    re.MULTILINE,
)

def _unescape_tex(txt: str) -> str:
    # CRLF markers → newline, strip stray quotes
    return (
        txt.replace("'#13#10'", "\n")
           .replace("'#13#10", "\n")
           .replace("''", "'")
    )

def _parse_coords(part: str) -> Tuple[int,int,int,int]:
    a = part.split(",")[:4]
    try:
        x, y, w, h = map(int, a)
        return x, y, w, h
    except Exception:
        return 0, 0, 0, 0
    
def _tcolor_to_css(val_str: str | None) -> str | None:
    """
    TEX/Delphi TColor to CSS.
    - Non-negative: BGR packed int → CSS #RRGGBB
    - Negative (system colors like -2147483640): return None (let CSS inherit)
    """
    if not val_str:
        return None
    try:
        v = int(val_str)
    except ValueError:
        return None
    if v < 0:
        return None
    r = v & 0xFF
    g = (v >> 8) & 0xFF
    b = (v >> 16) & 0xFF
    return f"#{r:02X}{g:02X}{b:02X}"


def _parse_readlist_str(data: str) -> Tuple[str, List[ReadListItem]]:
    """
    strDataAsString looks like:
    Title�ItemLabel~codeA_codeB~~ItemLabel~codeA~codeB~False~0~0~~~~�...
    We'll keep it simple: split on '�'; first is title; for each item, take the first token as label,
    and the last non-empty code-ish token as code.
    """
    parts = data.split("�")
    if not parts:
        return "", []
    title = parts[0]
    items: List[ReadListItem] = []
    for raw in parts[1:]:
        tokens = [t for t in raw.split("~") if t != ""]
        if not tokens:
            continue
        label = tokens[0]
        # find something that looks like a Read/SNOMED-ish code
        code = None
        for t in reversed(tokens[1:]):
            if any(ch.isdigit() for ch in t) or "." in t or "_" in t:
                code = t
                break
        items.append(ReadListItem(label=label, code=code))
    return title, items

def parse_tex(content: str):
    # isolate the big TSC_BLOB string first (between ''' ... large blob ... ''' )
    # your original split works; keep it, then normalize each block starting after "#"
    blocks = content.split("'''")
    controls: List[Control] = []
    canvas = {"width": 1000, "height": 600}
    form_name = None

    for block in blocks:
        block = _unescape_tex(block.strip())
        if "#TTpl" in block or "#TEmis" in block or "#FORM" in block or "#TTplButton" in block:
            # header / geometry
            m = FORM_HEADER_RE.search(block)
            if m:
                form_name = m.group("name")
                gx, gy, gw, gh = _parse_coords(m.group("geom"))
                canvas["width"], canvas["height"] = gw, gh

            # break block into the first line "#Type~Name~x,y,w,h"
            if "#" not in block:
                continue
            first = block.splitlines()[0]
            if not first.startswith("#"):
                continue
            head = first[1:]  # drop '#'
            parts = head.split("~")
            if len(parts) < 3:
                continue
            ctrl_type, ctrl_name, geom = parts[0], parts[1], parts[2]
            x, y, w, h = _parse_coords(geom)

            # collect props for this control
            props: Dict[str, str] = {}
            for pm in PROP_RE.finditer(block):
                if pm.group("ctrl") == ctrl_name:
                    k = pm.group("key")
                    v = pm.group("val")
                    props[k] = v

            c = Control(
                type=ctrl_type,
                name=ctrl_name,
                x=x, y=y, width=w, height=h,
                props=props
            )

            # convenience fields used by the template
            c.caption = props.get("Caption") or props.get("strReadTerm")
            c.prompt = props.get("Prompt")
            c.unit   = props.get("ValueUnit")
            
            # NEW: font extraction for labels (works for any control that sets these props)
            c.font_name   = props.get("Font.Name") or None
            try:
                c.font_size_pt = int(props.get("Font.Size")) if props.get("Font.Size") else None
            except ValueError:
                c.font_size_pt = None
            c.is_bold     = "fsBold" in (props.get("Font.Style", "") or "")
            c.font_color  = _tcolor_to_css(props.get("Font.Color"))

            # readlists → options + exclusivity
            if "ReadList" in ctrl_type:
                c.exclusive = (props.get("bExclusive", "False") == "True")
                title, items = _parse_readlist_str(props.get("strDataAsString", "")) if props else ("", [])
                if title and not c.caption:
                    c.caption = title
                c.options = items

            controls.append(c)

    # ensure deterministic z-order (optional)
    controls.sort(key=lambda k: (k.y, k.x))
    return controls, canvas
