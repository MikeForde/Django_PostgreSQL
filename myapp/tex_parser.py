from dataclasses import dataclass, field
from typing import List

@dataclass
class Property:
    name: str
    value: str

@dataclass
class Control:
    type: str
    name: str
    x: int
    y: int
    width: int
    height: int
    properties: List[Property] = field(default_factory=list)


def parse_tex(content: str) -> List[Control]:
    blocks = content.split("'''")
    controls: List[Control] = []
    template_name = None
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        first_tilde = block.find('~')
        if first_tilde == -1:
            continue
        ctrl_type = block[1:first_tilde]
        second_tilde = block.find('~', first_tilde + 1)
        ctrl_name = block[first_tilde + 1:second_tilde]
        if template_name is None:
            template_name = ctrl_name
        rest = block[second_tilde + 1:]
        coord_end = rest.find("'#13#10")
        coords_part = rest[:coord_end] if coord_end != -1 else rest
        coords = [0, 0, 0, 0]
        try:
            coords = list(map(int, coords_part.split(',')[:4]))
        except ValueError:
            pass
        properties: List[Property] = []
        prop_parts = block.split("'Prop")[1:]
        for p in prop_parts:
            pclean = p.replace("'#13#10'", "").replace("'#13#10", "")
            pclean = pclean.lstrip('~')
            pieces = pclean.split('~')
            if len(pieces) >= 5:
                prop_name = pieces[2]
                value = pieces[4]
                properties.append(Property(prop_name, value))
        controls.append(Control(ctrl_type, ctrl_name, *coords, properties))
    return controls
