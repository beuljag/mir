"""Expose the same bundled parts to MIR and to the circuit tools."""
import json
import re
from pathlib import Path

from .models import ComponentDefinition, ImagePresentation, Pin, Source

PARTS_ALIASES = {
    "led-red": ("red LED", "빨간색 LED", "빨강 LED"),
    "resistor-220": ("220Ω 저항", "220 ohm resistor", "220Ω"),
    "resistor-10k": ("10kΩ 저항", "10k ohm resistor"),
}
PIN_DIRECTIONS = {"gnd": "ground", "gpio": "bidirectional", "contact": "passive", "nc": "passive"}


def normalized_name(name):
    return re.sub(r"[^\w]+|_", " ", name.casefold()).strip()


def read_builtin_parts():
    root = Path(__file__).resolve().parents[1]
    folder = root / "parts"
    if not folder.is_dir():
        folder = root / "mir" / "parts"
    definitions, names, artwork = {}, {}, {}
    for file in sorted(folder.glob("*.json")):
        if file.name.startswith("_"):
            continue
        data = json.loads(file.read_text(encoding="utf-8-sig"))
        part_id = data["id"]
        pins = []
        for pin in data["pins"]:
            kind = pin["type"]
            direction = PIN_DIRECTIONS.get(kind, kind)
            signal = pin.get("signalType") or (
                "power" if kind in ("power_in", "power_out") else "ground" if kind == "gnd"
                else "passive" if direction == "passive" else "digital"
            )
            voltage = pin.get("voltage")
            pins.append(Pin(
                id=pin["id"], label=pin.get("label") or pin["id"], direction=direction, signal_type=signal,
                voltage_min=pin.get("minVoltage"), voltage_max=pin.get("maxVoltage"),
                output_voltage=voltage if direction in ("output", "power_out", "bidirectional") and isinstance(voltage, (float, int)) else None,
            ))
        definitions[part_id] = ComponentDefinition(
            id=part_id, manufacturer=data.get("manufacturer", "MIR"), model=data["name"],
            revision=data.get("revision", "built-in"), category=data["category"], pins=pins,
            is_virtual=True, verification_status="unverified",
            source_references=[Source(title=data["name"], reference=url) for url in data.get("sources", [])],
            notes="미르 기본 부품. 같은 부품은 이 ID와 기존 그림·가상 동작을 재사용합니다.",
        )
        names[part_id] = (part_id, data["name"], *PARTS_ALIASES.get(part_id, ()), *data.get("aliases", []))
        physical = data.get("physicalLayout")
        if physical:
            asset = physical["asset"]
            if not re.fullmatch(r"[a-z0-9-]+\.svg", asset):
                raise ValueError(f"Invalid bundled artwork filename for {part_id}")
            path = folder.parent / "renderer" / "assets" / asset
            presentation = ImagePresentation(color=data["color"], physical_layout={
                "reference_url": data["sources"][0], "width": physical["width"], "height": physical["height"],
                "pins": {pin["id"]: {**pin["position"], "side": pin["side"]} for pin in data["pins"]},
            })
            aliases = physical.get("pinAliases", {})
            if set(aliases) & set(presentation.physical_layout.pins) or not set(aliases.values()) <= set(presentation.physical_layout.pins):
                raise ValueError(f"Invalid bundled artwork pin aliases for {part_id}")
            artwork[part_id] = (path, presentation, aliases)
    return definitions, names, artwork
