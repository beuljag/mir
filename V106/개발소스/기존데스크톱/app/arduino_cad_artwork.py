"""Render Arduino CAD exports with IPC-D-356 pads and RS-274X assembly artwork."""
from html.parser import HTMLParser
from io import BytesIO
import math
from pathlib import PurePosixPath
import re
from urllib.parse import unquote, urljoin, urlsplit
from xml.sax.saxutils import escape
from zipfile import BadZipFile, ZipFile

from .fritzing_artwork import FritzingError, download, is_arduino, model_key, skus
from .models import ImagePresentation


HOST = 'docs.arduino.cc'
CAD_PATH = re.compile(r'/(?:static|resources)/[^?#]+-cad-files\.zip', re.I)
# Arduino UNO Q user manual, JDIGITAL1 and JANALOG1 pin maps. IPC-D-356
# records shorten the designators to six characters.
UNO_Q = {
    **{f'D{number}': f'JDIGIT-{number+1}' for number in range(14)},
    'GND_1': 'JDIGIT-15', 'AREF': 'JDIGIT-16', 'D20': 'JDIGIT-17', 'D21': 'JDIGIT-18',
    **{f'A{number}': f'JANALO-{number+9}' for number in range(6)},
    'BOOT': 'JANALO-1', 'IOREF': 'JANALO-2', 'RESET': 'JANALO-3', '3V3': 'JANALO-4',
    '5V': 'JANALO-5', 'GND_2': 'JANALO-6', 'GND_3': 'JANALO-7', 'VIN': 'JANALO-8',
}


class CadLinks(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base, self.links = base, set()

    def handle_starttag(self, tag, attrs):
        if tag != 'a':
            return
        url = urljoin(self.base, dict(attrs).get('href') or '')
        parts = urlsplit(url)
        if parts.hostname == HOST and CAD_PATH.fullmatch(unquote(parts.path)):
            self.links.add(url)


def load_cad(component, url):
    parts = urlsplit(url)
    if parts.hostname != HOST or not is_arduino(component.manufacturer):
        raise FritzingError('ARDUINO_CAD_SOURCE_UNSUPPORTED')
    page_model = None
    if page := re.fullmatch(r'/hardware/([a-z0-9-]+)/?', parts.path):
        page_model = page[1]
        parser = CadLinks(url)
        parser.feed(download(url, HOST, 4_000_000).decode('utf-8', errors='replace'))
        if len(parser.links) != 1:
            raise FritzingError('ARDUINO_CAD_LINK_NOT_UNIQUE')
        url = next(iter(parser.links))
    path = unquote(urlsplit(url).path)
    if not CAD_PATH.fullmatch(path):
        raise FritzingError('ARDUINO_CAD_SOURCE_UNSUPPORTED')
    expected, actual = skus(component.model), skus(path)
    name = model_key(component.model).removeprefix('arduino ')
    if (expected and not expected & actual) or (not expected and (not page_model or name != model_key(page_model))):
        raise FritzingError('ARDUINO_CAD_MODEL_MISMATCH')
    raw = download(url, HOST, 13_000_000, timeout=18)
    try:
        with ZipFile(BytesIO(raw)) as archive:
            files = [info for info in archive.infolist() if not info.is_dir()
                     and not info.filename.startswith('__MACOSX/')]
            if len(files) > 120 or len({info.filename for info in files}) != len(files):
                raise FritzingError('ARDUINO_CAD_INVALID_ARCHIVE')
            def member(matches):
                selected = [info for info in files if matches(PurePosixPath(info.filename).name.lower())]
                if len(selected) != 1 or selected[0].file_size > 2_000_000:
                    raise FritzingError('ARDUINO_CAD_IPC_ASSEMBLY_REQUIRED')
                return archive.read(selected[0]).decode('ascii')
            return url, actual, member(lambda name: name.endswith('.ipc')), member(lambda name: name == 'asst.art')
    except (BadZipFile, UnicodeError, RuntimeError, NotImplementedError):
        raise FritzingError('ARDUINO_CAD_INVALID_ARCHIVE') from None


def ipc_pads(text):
    if 'IPC-D-356' not in text or not re.search(r'^P\s+UNITS\s+CUST\s+1\s*$', text, re.M):
        raise FritzingError('ARDUINO_CAD_IPC_FORMAT_UNSUPPORTED')
    pads = {}
    for line in text.splitlines():
        if line[:3] not in ('317', '327') or len(line) < 54:
            continue
        ref, number = line[20:26].strip(), line[27:31].strip()
        xy = re.search(r'X([+-]\d{6})Y([+-]\d{6})', line[32:])
        if not ref or ref == 'VIA' or not number or not xy or line[26] != '-':
            continue
        key = f'{ref}-{number}'.upper()
        point = tuple(int(value)/1000 for value in xy.groups())
        if key in pads and pads[key] != point:
            pads[key] = None
        else:
            pads[key] = point
    return {key: point for key, point in pads.items() if point is not None}


def assembly_paths(text):
    if ('BOARD GEOMETRY/DESIGN_OUTLINE' not in text or '%FSLAX44Y44*MOMM*%' not in text
            or '%LPD*%' not in text or '%LPC' in text):
        raise FritzingError('ARDUINO_CAD_ASSEMBLY_FORMAT_UNSUPPORTED')
    paths, segments, pos, mode = [], [], (0.0, 0.0), '01'
    coordinate = re.compile(r'(?:G(0[123]))?((?:[XYIJ][+-]?\d+)+)D(0[12])')
    for raw in text.split('*'):
        command = raw.strip().lstrip('%').strip()
        if command in ('G01', 'G02', 'G03'):
            mode = command[1:]
        if not (match := coordinate.fullmatch(command)):
            continue
        selected, fields, operation = match.groups()
        mode = selected or mode
        numbers = {axis: int(value)/10000 for axis, value in re.findall(r'([XYIJ])([+-]?\d+)', fields)}
        new = (numbers.get('X', pos[0]), numbers.get('Y', pos[1]))
        if operation == '02':
            if segments:
                paths.append(segments)
                segments = []
        else:
            center = None if mode == '01' else (pos[0] + numbers.get('I', 0), pos[1] + numbers.get('J', 0))
            segments.append((pos, new, center, mode == '02'))
        pos = new
    if segments:
        paths.append(segments)
    return paths


def path_bounds(path):
    points = [path[0][0], *(end for _, end, _, _ in path)]
    xs, ys = zip(*points)
    return min(xs), min(ys), max(xs), max(ys)


def board_outline(paths, pins):
    xs, ys = zip(*pins)
    candidates = []
    for path in paths:
        if len(path) < 4 or math.dist(path[0][0], path[-1][1]) > .02:
            continue
        left, bottom, right, top = path_bounds(path)
        if (8 <= right-left <= 250 and 8 <= top-bottom <= 250
                and left <= min(xs) <= max(xs) <= right and bottom <= min(ys) <= max(ys) <= top):
            candidates.append((path, (left, bottom, right, top)))
    if not candidates:
        raise FritzingError('ARDUINO_CAD_BOARD_OUTLINE_NOT_FOUND')
    def area(candidate):
        _, (left, bottom, right, top) = candidate
        return (right-left)*(top-bottom)
    # Pick the enclosing board contour, rather than the drawing's outer frame.
    candidates.sort(key=area)
    path, bounds = candidates[0]
    if len(candidates) > 1 and area(candidates[1]) <= area(candidates[0])*1.03:
        other, other_bounds = candidates[1]
        if other_bounds != bounds or other != path:
            raise FritzingError('ARDUINO_CAD_AMBIGUOUS_OUTLINE')
    return path, bounds


def svg_path(path, project):
    def xy(point):
        x, y = project(point)
        return f'{x:.3f} {y:.3f}'
    draw = ['M'+xy(path[0][0])]
    for start, end, center, clockwise in path:
        if center is None:
            draw.append('L'+xy(end))
            continue
        radius = math.dist(project(start), project(center))
        angle = (math.atan2(end[1]-center[1], end[0]-center[0]) -
                 math.atan2(start[1]-center[1], start[0]-center[0]))
        sweep = int(clockwise)
        if start == end:
            opposite = (2*center[0]-start[0], 2*center[1]-start[1])
            draw.extend(f'A{radius:.3f} {radius:.3f} 0 0 {sweep} {xy(point)}' for point in (opposite, end))
        else:
            span = (-angle if clockwise else angle) % math.tau
            draw.append(f'A{radius:.3f} {radius:.3f} 0 {int(span > math.pi)} {sweep} {xy(end)}')
    return ''.join(draw)


def render_board(width, height, border, paths, bounds, project, pads, mapped, title, uno_q):
    """Use CAD for placement while drawing only the features needed for wiring."""
    left, bottom, right, top = bounds
    features = []

    def rectangle(points, padding, fill, stroke, css_class, label=''):
        xs, ys = zip(*(project(point) for point in points))
        x, y = min(xs) - padding, min(ys) - padding
        w, h = max(xs) - min(xs) + 2*padding, max(ys) - min(ys) + 2*padding
        features.append(f'<rect class="{css_class}" x="{x:.3f}" y="{y:.3f}" width="{w:.3f}" height="{h:.3f}" '
                        f'rx="5" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        if label:
            features.append(f'<text x="{x+w/2:.3f}" y="{y+h/2+4:.3f}" text-anchor="middle" '
                            f'font-family="monospace" font-size="12" fill="#edf5f0">{escape(label)}</text>')

    for path in paths:
        if len(path) != 1:
            continue
        start, end, center, _ = path[0]
        if center is None or start != end:
            continue
        x, y = center
        radius = math.dist(start, center)
        if 1.2 <= radius <= 2.1 and left < x < right and bottom < y < top:
            if min(x-left, right-x, y-bottom, top-y) <= 8:
                cx, cy = project(center)
                features.append(f'<circle cx="{cx}" cy="{cy}" r="{math.dist(project(start), (cx, cy)):.3f}" '
                                'fill="#163630" stroke="#d2b364" stroke-width="3"/>')

    headers = {}
    for key in mapped.values():
        headers.setdefault(key.rsplit('-', 1)[0], []).append(pads[key])
    for points in headers.values():
        if len(points) > 1:
            rectangle(points, 11, '#162e2d', '#315651', 'header')

    if uno_q:
        packages = (
            ('SOC1', 'QRB2210', '#243638', '#64807a'),
            ('DRAM1', 'RAM', '#253638', '#64807a'),
            ('MCU1', 'STM32', '#243638', '#64807a'),
            ('U2901', 'Wi-Fi', '#657e7d', '#c4d5cf'),
            ('JUSB1', 'USB-C', '#778b8a', '#c4d5cf'),
            ('JSPI1', '', '#203732', '#64807a'),
            ('QWIIC1', '', '#b7bdab', '#dfdfca'),
            ('JBTN1', '', '#293d39', '#64807a'),
        )
        for ref, label, fill, stroke in packages:
            points = [point for key, point in pads.items() if key.rsplit('-', 1)[0] == ref]
            if points:
                rectangle(points, 6, fill, stroke, 'package', label)
        features.append(f'<text x="{width/2:.3f}" y="{height*.31:.3f}" text-anchor="middle" '
                        'font-family="monospace" font-size="24" font-weight="bold" fill="#e7f4ea">UNO Q</text>')

    for key in mapped.values():
        x, y = project(pads[key])
        features.append(f'<circle class="pad" cx="{x}" cy="{y}" r="6.1" '
                        'fill="#cdac51" stroke="#fff0a6" stroke-width="1.4"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
            f'<title>{escape(title)} — Arduino CAD, CC BY-SA 4.0</title>'
            f'<path d="{border}" fill="#147f72" stroke="#4bb5a2" stroke-width="2"/>'
            f'{"".join(features)}</svg>').encode('utf-8')


def import_cad_artwork(component, url, pin_map):
    source, identities, ipc, assembly = load_cad(component, url)
    pads = ipc_pads(ipc)
    defaults = UNO_Q if 'ABX00162' in identities else {}
    if set(pin_map) - {pin.id for pin in component.pins}:
        raise FritzingError('ARDUINO_CAD_UNKNOWN_PIN_MAP_ID')
    mapped = {pin.id: pin_map.get(pin.id, defaults.get(pin.id, '')).upper() for pin in component.pins}
    unmapped = [pin for pin, key in mapped.items()
                if key not in pads or (pin in defaults and key != defaults[pin])]
    if unmapped or len(set(mapped.values())) != len(mapped):
        raise FritzingError('ARDUINO_CAD_PIN_MAPPING_REQUIRED', pins=unmapped,
                            cad_headers=sorted({key.rsplit('-', 1)[0] for key in pads if key.startswith('J')})[:35])
    paths = assembly_paths(assembly)
    outline, (left, bottom, right, top) = board_outline(paths, [pads[key] for key in mapped.values()])
    scale = min(10, 880/max(right-left, top-bottom))
    margin = 9
    width, height = round((right-left)*scale+2*margin, 6), round((top-bottom)*scale+2*margin, 6)
    def project(point):
        x, y = point
        return round((x-left)*scale+margin, 6), round((top-y)*scale+margin, 6)
    positions = {}
    for pin, key in mapped.items():
        x, y = project(pads[key])
        distances = {'left': x, 'right': width-x, 'top': y, 'bottom': height-y}
        positions[pin] = {'x': x, 'y': y, 'side': min(distances, key=distances.get)}
    try:
        presentation = ImagePresentation(color='#147f72', physical_layout={
            'reference_url': source, 'width': width, 'height': height, 'pins': positions})
    except ValueError:
        raise FritzingError('ARDUINO_CAD_INVALID_PIN_COORDINATES') from None
    border = svg_path(outline, project)+'Z'
    title = 'Arduino UNO Q' if defaults else component.model
    svg = render_board(width, height, border, paths, (left, bottom, right, top), project, pads, mapped, title, bool(defaults))
    return svg, presentation, 'Arduino (CC BY-SA 4.0)'
