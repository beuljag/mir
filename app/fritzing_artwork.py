"""Import a board's drawing and connector positions from a Fritzing part."""
from collections import Counter
from html.parser import HTMLParser
from io import BytesIO
import math
from pathlib import PurePosixPath
import re
from urllib.parse import quote, unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET
from zipfile import BadZipFile, ZipFile

from .models import ImagePresentation
from .web_fetch import FetchError, fetch_public


SVG = 'http://www.w3.org/2000/svg'
MAX_ASSET = 750_000
NUMBER = r'[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?'
SVG_TAGS = set('svg g defs title desc rect circle ellipse line polyline polygon path text tspan linearGradient radialGradient stop clipPath mask'.split())
METADATA_TAGS = {'metadata', 'namedview', 'referenceFile'}


class FritzingError(ValueError):
    def __init__(self, code, **details):
        super().__init__(code)
        self.detail = {'code': code, **details}


class ArduinoLinks(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base, self.bundles = base, set()

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            href = dict(attrs).get('href') or ''
            link = urljoin(self.base, href)
            if urlsplit(link).hostname == 'docs.arduino.cc' and urlsplit(link).path.lower().endswith('.fzpz'):
                self.bundles.add(link)


def download(url, host, limit, *, timeout=8):
    try:
        return fetch_public(url, max_bytes=limit, timeout=timeout, allowed_hosts={host})['body']
    except (FetchError, OSError) as exc:
        raise FritzingError('FRITZING_DOWNLOAD_FAILED', reason=str(exc) if isinstance(exc, FetchError) else 'FETCH_FAILED') from None


def read_xml(raw):
    # The standard legacy SVG declaration is informational; never resolve a DTD.
    raw = re.sub(rb'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1\.1//EN" "http://www\.w3\.org/Graphics/SVG/1\.1/DTD/svg11\.dtd">', b'', raw)
    if len(raw) > MAX_ASSET or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper() or b'\x00' in raw:
        raise FritzingError('FRITZING_UNSAFE_XML')
    try:
        return ET.fromstring(raw)
    except ET.ParseError:
        raise FritzingError('FRITZING_INVALID_XML') from None


def breadboard_name(part):
    element = part.find('./views/breadboardView/layers')
    image = element.get('image', '') if element is not None else ''
    if not image.startswith('breadboard/') or len(PurePosixPath(image).parts) != 2 or not image.lower().endswith('.svg'):
        raise FritzingError('FRITZING_BREADBOARD_VIEW_MISSING')
    return PurePosixPath(image).name


def load_source(url):
    parts = urlsplit(url)
    host, path = parts.hostname, unquote(parts.path)
    if host == 'docs.arduino.cc':
        if re.fullmatch(r'/hardware/[a-z0-9-]+/?', path):
            links = ArduinoLinks(url)
            links.feed(download(url, host, 4_000_000).decode('utf-8', errors='replace'))
            if len(links.bundles) != 1:
                raise FritzingError('FRITZING_BUNDLE_LINK_NOT_UNIQUE')
            url = next(iter(links.bundles))
            path = unquote(urlsplit(url).path)
        if not re.fullmatch(r'/(?:static|resources)/[^?#]+\.fzpz', path, re.I):
            raise FritzingError('FRITZING_SOURCE_UNSUPPORTED')
        raw = download(url, host, 2_000_000)
        try:
            with ZipFile(BytesIO(raw)) as archive:
                names = archive.namelist()
                if len(names) > 30 or len(set(names)) != len(names):
                    raise FritzingError('FRITZING_INVALID_ARCHIVE')
                definitions = [name for name in names if name.endswith('.fzp')]
                if len(definitions) != 1:
                    raise FritzingError('FRITZING_INVALID_ARCHIVE')
                def member(name):
                    if archive.getinfo(name).file_size > MAX_ASSET:
                        raise FritzingError('FRITZING_ASSET_TOO_LARGE')
                    return archive.read(name)
                part = read_xml(member(definitions[0]))
                svg = member('svg.breadboard.' + breadboard_name(part))
        except (BadZipFile, KeyError, RuntimeError, NotImplementedError):
            raise FritzingError('FRITZING_INVALID_ARCHIVE') from None
        return url, part, svg
    if host == 'raw.githubusercontent.com':
        match = re.fullmatch(r'(/fritzing/fritzing-parts/[a-zA-Z0-9._-]+)/core/[^/]+\.fzp', path)
        if match:
            part = read_xml(download(url, host, MAX_ASSET))
            svg_url = f'https://{host}{match[1]}/svg/core/breadboard/{quote(breadboard_name(part), safe="")}'
            return url, part, download(svg_url, host, MAX_ASSET)
    raise FritzingError('FRITZING_SOURCE_UNSUPPORTED')


def sanitize_svg(raw):
    root = read_xml(raw)
    if root.tag != f'{{{SVG}}}svg':
        raise FritzingError('FRITZING_INVALID_SVG')
    parents, by_id = {}, {}
    pending = [(root, 0)]
    count = 0
    while pending:
        node, depth = pending.pop()
        count += 1
        if count > 8000 or depth > 64 or not node.tag.startswith(f'{{{SVG}}}') or node.tag.split('}')[-1] not in SVG_TAGS:
            raise FritzingError('FRITZING_UNSUPPORTED_SVG')
        for name, value in tuple(node.attrib.items()):
            local = name.rsplit('}', 1)[-1].lower()
            if (local.startswith('on') or local in ('href', 'base', 'src') or '\\' in value
                    or re.search(r'url\s*\((?!\s*#[\w.-]+\s*\))|javascript:|@import|expression\s*\(', value, re.I)):
                raise FritzingError('FRITZING_UNSAFE_SVG')
            if name.startswith('{') and name != '{http://www.w3.org/XML/1998/namespace}space':
                del node.attrib[name]
        if (node_id := node.get('id')):
            if node_id in by_id:
                raise FritzingError('FRITZING_DUPLICATE_SVG_ID')
            by_id[node_id] = node
        for child in list(node):
            if child.tag.rsplit('}', 1)[-1] in METADATA_TAGS:
                node.remove(child)
            else:
                parents[child] = node
                pending.append((child, depth + 1))
    return root, parents, by_id


def transform_point(point, transform):
    commands = list(re.finditer(r'(matrix|translate|scale|rotate)\s*\(([^()]*)\)', transform))
    if re.sub(r'(matrix|translate|scale|rotate)\s*\([^()]*\)|[\s,]', '', transform):
        raise ValueError('unsupported transform')
    x, y = point
    for command in reversed(commands):
        name, values = command.groups()
        params = [float(value) for value in re.findall(NUMBER, values)]
        if re.sub(NUMBER + r'|[\s,]', '', values):
            raise ValueError('invalid transform')
        if name == 'matrix' and len(params) == 6:
            a, b, c, d, e, f = params
            x, y = a*x + c*y + e, b*x + d*y + f
        elif name == 'translate' and len(params) in (1, 2):
            x, y = x + params[0], y + (params[1] if len(params) == 2 else 0)
        elif name == 'scale' and len(params) in (1, 2):
            x, y = x*params[0], y*params[-1]
        elif name == 'rotate' and len(params) in (1, 3):
            angle = math.radians(params[0])
            cx, cy = params[1:] if len(params) == 3 else (0, 0)
            x, y = cx + (x-cx)*math.cos(angle) - (y-cy)*math.sin(angle), cy + (x-cx)*math.sin(angle) + (y-cy)*math.cos(angle)
        else:
            raise ValueError('invalid transform')
    return x, y


def circular_path_center(path):
    # Fritzing exports some round pads as four cubic curves through cardinal points.
    groups = re.findall(r'([mMcCzZ])([^mMcCzZ]*)', path)
    if not groups or groups[0][0].lower() != 'm':
        raise ValueError('unsupported pad path')
    def values(text):
        if re.sub(NUMBER + r'|[\s,]', '', text):
            raise ValueError('unsupported pad path')
        return [float(value) for value in re.findall(NUMBER, text)]
    x, y = values(groups[0][1])
    points = [(x, y)]
    for kind, data in groups[1:]:
        coordinates = values(data)
        if kind.lower() == 'z' and not coordinates:
            continue
        if kind.lower() != 'c' or not coordinates or len(coordinates) % 6:
            raise ValueError('unsupported pad path')
        for end in range(4, len(coordinates), 6):
            px, py = coordinates[end:end+2]
            x, y = (x+px, y+py) if kind == 'c' else (px, py)
            points.append((x, y))
    if len(points) != 5 or math.dist(points[0], points[-1]) > .015:
        raise ValueError('open pad path')
    xs, ys = zip(*points[:4])
    cx, cy = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2
    rx, ry = max(xs)-cx, max(ys)-cy
    if min(rx, ry) <= 0 or any(not (abs(abs(x-cx)-rx) < .02 and abs(y-cy) < .02
                                  or abs(x-cx) < .02 and abs(abs(y-cy)-ry) < .02) for x, y in points[:4]):
        raise ValueError('pad is not round')
    return cx, cy


def connector_center(node, parents):
    kind = node.tag.rsplit('}', 1)[-1]
    if kind in ('circle', 'ellipse'):
        point = float(node.get('cx', '0')), float(node.get('cy', '0'))
    elif kind == 'rect':
        point = tuple(float(node.get(coord, '0')) + float(node.get(size, '0'))/2
                      for coord, size in (('x', 'width'), ('y', 'height')))
    elif kind == 'path':
        point = circular_path_center(node.get('d', ''))
    else:
        raise ValueError('unsupported connector')
    while node is not None:
        point = transform_point(point, node.get('transform', ''))
        node = parents.get(node)
    return point


SKU = re.compile(r'(?<![A-Z0-9])(?:A\d{6}|ABX\d{5})(?![A-Z0-9])', re.I)


def skus(value):
    return {match.upper() for match in SKU.findall(value)}


def model_key(value):
    value = SKU.sub('', value)
    return ' '.join(re.findall(r'[a-z0-9]+', value.casefold()))


def is_arduino(manufacturer):
    return model_key(manufacturer) in ('arduino', 'arduino sa', 'arduino srl')


def pin_names(value):
    tokens = re.findall(r'[A-Z0-9]+', re.sub(r'(?<=\w)_\d+$', '', value.upper()))
    names = set()
    if tokens:
        names.add(tokens[0])
        if tokens[0] in ('D0', 'D1'):
            names.add('RX' if tokens[0] == 'D0' else 'TX')
        if tokens[0] in ('RX', 'TX'):
            names.add('D0' if tokens[0] == 'RX' else 'D1')
    return names


def import_artwork(component, url, pin_map):
    source, part, raw = load_source(url)
    title = (part.findtext('title') or '').strip()
    expected_skus = skus(component.model)
    source_skus = skus(title) | skus(unquote(urlsplit(source).path))
    official = urlsplit(source).hostname == 'docs.arduino.cc'
    name = model_key(component.model)
    name_matches = name == model_key(title) if name else bool(official and expected_skus & source_skus)
    if (not title or not name_matches or (expected_skus and source_skus and not expected_skus & source_skus)
            or (official and not is_arduino(component.manufacturer))):
        raise FritzingError('FRITZING_MODEL_MISMATCH', source_model=title[:160])
    root, parents, nodes = sanitize_svg(raw)
    try:
        vx, vy, vw, vh = map(float, re.split(r'[\s,]+', root.get('viewBox', '').strip()))
        if not all(math.isfinite(n) for n in (vx, vy, vw, vh)) or min(vw, vh) <= 0:
            raise ValueError
    except ValueError:
        raise FritzingError('FRITZING_INVALID_VIEWBOX') from None
    connectors = {}
    entries = part.findall('./connectors/connector')
    if part.tag != 'module' or not 1 <= len(entries) <= 200:
        raise FritzingError('FRITZING_INVALID_CONNECTORS')
    for entry in entries:
        view = entry.find('./views/breadboardView/p')
        if view is not None and (node := nodes.get(view.get('svgId'))) is not None and entry.get('id'):
            if entry.get('id') in connectors:
                raise FritzingError('FRITZING_INVALID_CONNECTORS')
            connectors[entry.get('id')] = (entry.get('name', ''), node)
    if set(pin_map) - {pin.id for pin in component.pins}:
        raise FritzingError('FRITZING_UNKNOWN_PIN_MAP_ID')
    positions, unresolved, chosen = {}, {}, {}
    scale = min(4, 900/max(vw, vh))
    for pin in component.pins:
        names = pin_names(pin.id) | pin_names(pin.label)
        options = [key for key, (label, _) in connectors.items() if names & pin_names(label)]
        connector = pin_map.get(pin.id) or (options[0] if len(options) == 1 else None)
        if connector not in options:
            unresolved[pin.id] = options
            continue
        try:
            x, y = connector_center(connectors[connector][1], parents)
            x, y = x-vx, y-vy
            if not (0 <= x <= vw and 0 <= y <= vh):
                raise ValueError
        except (ValueError, OverflowError):
            unresolved[pin.id] = []
            continue
        distances = {'left': x, 'right': vw-x, 'top': y, 'bottom': vh-y}
        side = min(distances, key=distances.get)
        positions[pin.id] = {'x': round(x*scale, 6), 'y': round(y*scale, 6), 'side': side}
        chosen[pin.id] = connector
    duplicates = {connector for connector, count in Counter(chosen.values()).items() if count > 1}
    unresolved.update({pin: [connector] for pin, connector in chosen.items() if connector in duplicates})
    if unresolved:
        raise FritzingError('FRITZING_PIN_MAPPING_REQUIRED', pins=unresolved)
    width, height = round(vw*scale, 6), round(vh*scale, 6)
    root.attrib.update(width=str(width), height=str(height))
    try:
        presentation = ImagePresentation(physical_layout={'reference_url':source,'width':width,'height':height,'pins':positions})
    except ValueError:
        raise FritzingError('FRITZING_INVALID_PIN_COORDINATES') from None
    return ET.tostring(root, encoding='utf-8'), presentation, (part.findtext('author') or '').strip()[:120]
