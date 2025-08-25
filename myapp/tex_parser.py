# tex_parser.py
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

    # convenience for rendering
    caption: Optional[str] = None
    options: List[ReadListItem] = field(default_factory=list)
    exclusive: bool = False  # radio vs checkbox/select
    prompt: Optional[str] = None
    unit: Optional[str] = None

    # label font
    is_bold: bool = False
    font_name: Optional[str] = None
    font_size_pt: Optional[int] = None
    font_color: Optional[str] = None  # CSS like "#RRGGBB"

    # diary entry
    is_diary: bool = False
    diary_prompt: Optional[str] = None
    diary_readcode: Optional[str] = None
    diary_editbox: bool = False
    diary_prompt_below: bool = False
    diary_editbox_chars: Optional[int] = None  # width hint in “ch”

    # ReadCode (TEmisReadCode)
    is_readcode: bool = False
    rc_prompt: Optional[str] = None
    rc_code: Optional[str] = None
    rc_term: Optional[str] = None
    rc_has_text: bool = False  # bTextPrompt
    rc_prompt_width_ch: Optional[int] = None  # nTextPromptWidth
    rc_required: bool = False  # bInputRequired
    rc_has_value: bool = False
    rc_value_unit: Optional[str] = None
    rc_has_datepicker: bool = False

    # read list (TEmisReadList)
    is_readlist: bool = False
    rl_multi: bool = False  # False => exclusive (single)
    rl_minimised: bool = False  # True => show as “combobox”
    rl_date_prompt: bool = False  # optional date under the list / combobox
    rl_size: int | None = None  # number of visible rows when expanded

    # ReadCode (incl. TEmisQuestionReadCode)
    is_readcode: bool = False
    rc_prompt: Optional[str] = None
    rc_code: Optional[str] = None
    rc_term: Optional[str] = None
    rc_has_text: bool = False
    rc_prompt_width_ch: Optional[int] = None
    rc_required: bool = False

    # Yes/No qualifier (Negation)
    rc_is_question: bool = False
    rc_has_negation: bool = False
    rc_neg_label: str = "No"
    rc_neg_prefix: str = "Negation-"

    # TTplLastEntry (read-only date showing "last entry")
    is_lastentry: bool = False
    le_code: Optional[str] = None
    le_term: Optional[str] = None

FORM_HEADER_RE = re.compile(
    r"#FORM~(?P<name>[^~]+)~(?P<title>[^~]+)~(?P<geom>\d+,\d+,\d+,\d+)"
)
# multiline: after unescape, each Prop is a full line
PROP_RE = re.compile(
    r"^Prop~(?P<form>[^~]*)~(?P<ctrl>[^~]*)~(?P<key>[^~]*)~~(?P<val>.*)$", re.MULTILINE
)


def _unescape_tex(txt: str) -> str:
    # CRLF markers → newline, strip stray quotes
    return txt.replace("'#13#10'", "\n").replace("'#13#10", "\n").replace("''", "'")


def _parse_coords(part: str) -> Tuple[int, int, int, int]:
    a = part.split(",")[:4]
    try:
        x, y, w, h = map(int, a)
        return x, y, w, h
    except Exception:
        return 0, 0, 0, 0


def _tcolor_to_css(val_str: Optional[str]) -> Optional[str]:
    """
    Delphi TColor (BGR packed int). Non-negative -> #RRGGBB. Negative (system color) -> None.
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
    EMIS readlist rows are separated by 0xFF ('ÿ') or sometimes U+FFFD ('�').
    Each row roughly looks like:
      Label ~ CODEA_CODEB ~~ Label ~ CODEA ~ CODEB ~ False ~ 0 ~ 0 ~ ~ ~ ~
    We prefer the CODE from the early pair (before the first '~~').
    """
    if not data:
        return "", []

    s = data.strip()
    rows = re.split(r"[ÿ�]", s)  # support both sentinels

    title = rows[0].strip() if rows else ""
    items: List[ReadListItem] = []

    # helpers
    def is_bool_or_zero(t: str) -> bool:
        return t in {"True", "False", "0", "1"}

    def looks_like_code(t: str) -> bool:
        # Read codes typically have letters/digits and often a dot/underscore
        return bool(re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]*$", t)) and not is_bool_or_zero(t)

    for raw in rows[1:]:
        raw = raw.strip()
        if not raw:
            continue
        tokens = [t.strip() for t in raw.split("~") if t is not None]
        if not tokens:
            continue

        label = tokens[0] if tokens[0] else ""
        code: Optional[str] = None

        # 1) Prefer the early paired code token right after the label, e.g. "C10.._C10"
        if len(tokens) >= 2 and tokens[1]:
            pair = tokens[1]
            if "_" in pair:
                a, b = pair.split("_", 1)
                # pick the one that looks more like a proper Read code
                if looks_like_code(a) and ("." in a or any(ch.isalpha() for ch in a)):
                    code = a
                elif looks_like_code(b):
                    code = b
            elif looks_like_code(pair):
                code = pair

        # 2) Fallback: scan the rest for the first thing that looks like a code (skip booleans/zeros)
        if not code:
            for t in tokens[1:]:
                if looks_like_code(t) and (("." in t) or ("_" in t) or any(ch.isalpha() for ch in t)):
                    code = t
                    break

        items.append(ReadListItem(label=label, code=code))

    return title, items

def _parse_qualifiers(val: Optional[str]) -> tuple[bool, str, str]:
    """
    Example: 'no�no�Negation�'  -> (True, 'No', 'Negation-')
    Returns: (has_neg, neg_label, neg_prefix)
    """
    if not val:
        return (False, "No", "Negation-")
    parts = [p for p in val.split("�") if p != ""]
    if not parts:
        return (False, "No", "Negation-")
    # First token usually display text for the 'No' qualifier
    label = parts[0].strip() or "No"
    # Find a token that looks like the prefix keyword, default to 'Negation'
    prefix_token = None
    for p in parts[1:]:
        t = p.strip()
        if t:
            prefix_token = t
            break
    prefix = (prefix_token or "Negation") + "-"
    return (True, label.capitalize(), prefix)


def parse_tex(content: str):
    """
    Returns (controls, canvas) where canvas={'width':..., 'height':...}
    """
    blocks = content.split("'''")
    controls: List[Control] = []
    canvas = {"width": 1000, "height": 600}
    form_name = None

    for block in blocks:
        block = _unescape_tex(block.strip())
        if (
            "#TTpl" in block
            or "#TEmis" in block
            or "#FORM" in block
            or "#TTplButton" in block
        ):
            # header / geometry
            m = FORM_HEADER_RE.search(block)
            if m:
                form_name = m.group("name")
                gx, gy, gw, gh = _parse_coords(m.group("geom"))
                canvas["width"], canvas["height"] = gw, gh

            # first line like: #Type~Name~x,y,w,h
            if "#" not in block:
                continue
            first = block.splitlines()[0]
            if not first.startswith("#"):
                continue
            head = first[1:]
            parts = head.split("~")
            if len(parts) < 3:
                continue
            ctrl_type, ctrl_name, geom = parts[0], parts[1], parts[2]
            x, y, w, h = _parse_coords(geom)

            # collect props for this control
            props: Dict[str, str] = {}
            for pm in PROP_RE.finditer(block):
                if pm.group("ctrl") == ctrl_name:
                    props[pm.group("key")] = pm.group("val")

            c = Control(
                type=ctrl_type, name=ctrl_name, x=x, y=y, width=w, height=h, props=props
            )

            # convenience fields used by template
            c.caption = props.get("Caption") or props.get("strReadTerm")
            c.prompt = props.get("Prompt")
            c.unit = props.get("ValueUnit")

            # font extraction (labels)
            c.font_name = props.get("Font.Name") or None
            try:
                c.font_size_pt = (
                    int(props.get("Font.Size")) if props.get("Font.Size") else None
                )
            except ValueError:
                c.font_size_pt = None
            c.is_bold = "fsBold" in (props.get("Font.Style", "") or "")
            c.font_color = _tcolor_to_css(props.get("Font.Color"))

            # diary entry controls
            if "DiaryEntry" in ctrl_type:
                c.is_diary = True
                c.diary_prompt = props.get("strPrompt") or c.caption or c.name
                c.diary_readcode = props.get("strReadCode")
                c.diary_editbox = props.get("bEditBox", "False") == "True"
                c.diary_prompt_below = props.get("bPromptBelow", "False") == "True"
                try:
                    c.diary_editbox_chars = (
                        int(props.get("nEditboxWidth"))
                        if props.get("nEditboxWidth")
                        else None
                    )
                except ValueError:
                    c.diary_editbox_chars = None

            # TEmisReadCode → prompt + checkbox (+ optional text prompt)
            # TEmisReadCode and TEmisQuestionReadCode
            if "ReadCode" in ctrl_type:
                c.is_readcode = True
                c.rc_is_question = ("QuestionReadCode" in ctrl_type)

                c.rc_prompt = props.get("Prompt") or props.get("strReadTerm") or c.name
                c.rc_code = props.get("ReadCode")
                c.rc_term = props.get("strReadTerm")
                c.rc_has_text = (props.get("bTextPrompt", "False") == "True")
                c.rc_has_value = props.get("bValue", "False") == "True"
                c.rc_value_unit = props.get("ValueUnit") or c.unit
                c.rc_has_datepicker = props.get("bDatePicker", "False") == "True"
                c.rc_required = (props.get("bInputRequired", "False") == "True")
                try:
                    c.rc_prompt_width_ch = (
                        int(props.get("nTextPromptWidth"))
                        if props.get("nTextPromptWidth")
                        else None
                    )
                except ValueError:
                    c.rc_prompt_width_ch = None

                # Qualifiers -> Negation support for QuestionReadCode
                has_neg, neg_label, neg_prefix = _parse_qualifiers(props.get("Qualifiers"))
                if c.rc_is_question and has_neg:
                    c.rc_has_negation = True
                    c.rc_neg_label = neg_label
                    c.rc_neg_prefix = neg_prefix

            # TTplLastEntry → read-only date (tooltip can show its readcode)
            if "LastEntry" in ctrl_type:
                c.is_lastentry = True
                c.le_code = props.get("ReadCode") or props.get("strReadCode") or props.get("TermID")
                c.le_term = props.get("strReadTerm") or props.get("Caption") or None

            
            # readlists → options + exclusivity + extra flags
            if "ReadList" in ctrl_type:
                c.is_readlist = True
                c.exclusive = (props.get("bExclusive", "False") == "True")
                c.rl_multi = not c.exclusive

                title, items = _parse_readlist_str(props.get("strDataAsString", "")) if props else ("", [])
                if title and not c.caption:
                    c.caption = title
                c.options = items

                c.rl_minimised  = (props.get("bMinimised", "False") == "True")
                c.rl_date_prompt = (props.get("bDatePrompt", "False") == "True")

                # choose a sensible visible row count when expanded
                # (use number of items, capped so it doesn't get silly)
                visible = max(3, min(len(items) or 0, 10))
                # if the TEX provides a NonMinimisedHeight, you could refine this later
                c.rl_size = 1 if c.rl_minimised else visible
            
            if "IdealWeight" in ctrl_type or "BMI" in ctrl_type:
                c.is_readcode = True
                c.rc_prompt = "Ideal Weight" if "IdealWeight" in ctrl_type else "BMI"
                c.rc_code = None
                c.rc_term = c.rc_prompt
                c.rc_has_text = False
                c.rc_required = False
                c.rc_has_value = True   # NEW flag
                c.rc_value_unit = "kg" if "IdealWeight" in ctrl_type else "kg/m²"

            controls.append(c)
    
    by_name = {c.name: c for c in controls}
    adjusted: set[str] = set()

    for g in controls:
        children_str = g.props.get("ChildControls") or ""
        if not children_str:
            continue

        gx, gy = g.x, g.y
        for child_name in (n for n in children_str.split(";") if n):
            ch = by_name.get(child_name)
            if not ch:
                continue
            # allow nested groups to cascade; only adjust each control once
            if ch.name in adjusted:
                continue
            ch.x += gx
            ch.y += gy
            adjusted.add(ch.name)

    controls.sort(key=lambda k: (k.y, k.x))
    return controls, canvas
