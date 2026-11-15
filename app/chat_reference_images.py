"""Find product images and drawings in public links pasted into MIR chat."""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from html.parser import HTMLParser
from io import BytesIO
import re
import time
from urllib.parse import parse_qs, quote, urljoin, urlsplit

from PIL import Image, ImageOps

from .research import reference_catalog, run_pdf_worker
from .web_fetch import fetch_public


PHOTO, PINOUT, DIMENSIONS = 'board-photo', 'pin-definition', 'board-dimensions'
MAX_IMAGE_BYTES = 1_250_000  # Three images plus the activity must fit Direct Line's 4 MiB limit.
MAX_SOURCE_IMAGE_BYTES = 8_000_000
IMAGE_ACCEPT = {'Accept': 'image/png,image/jpeg,image/webp,application/pdf'}
PINOUT_NAME = re.compile(r'(?:pin|gpio)[\W_]*(?:out|definition|map|assignments?)|(?:^|[^\w])pins?(?:[._-]|$)', re.I)
DIMENSION_NAME = re.compile(r'outline|mechanical|d[ie]mension', re.I)
UNRELATED_NAME = re.compile(r'\b(?:logo|icon|avatar|banner|placeholder|comparison|side|back|rear|lifestyle)\b|form[\W_]*factor|\bvs\b', re.I)


@dataclass(frozen=True)
class ReferenceImage:
    role: str
    url: str
    content_type: str
    extension: str
    content: bytes

    @property
    def filename(self):
        return f'{self.role}.{self.extension}'


def first_reference_url(message, root=None):
    user_text = message.partition('\n\n[현재 배선]')[0]
    match = re.search(r'https://[^\s<>"\[\]{}()]+', user_text, re.I)
    if match:
        return match.group().rstrip('.,;:!?。')
    if root is not None:
        return next((entry['chat_reference_url'] for entry in reference_catalog(root, user_text)
                     if entry.get('chat_reference_url')), None)
    return None


def prepare_image(role, fetched):
    try:
        with Image.open(BytesIO(fetched['body']), formats=('PNG', 'JPEG', 'WEBP')) as source:
            if not (32 <= min(source.size) and source.width * source.height <= 16_000_000):
                return None
            image = ImageOps.exif_transpose(source)
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            if image.mode in ('RGBA', 'LA') or 'transparency' in image.info:
                rgba = image.convert('RGBA')
                image = Image.new('RGB', rgba.size, 'white')
                image.paste(rgba, mask=rgba.getchannel('A'))
            else:
                image = image.convert('RGB')
            # Prefer lossless PNG for diagrams with small text. Re-encode to
            # strip source metadata and keep the total multipart body bounded.
            buffer = BytesIO()
            if role != PHOTO:
                image.save(buffer, 'PNG')
                if buffer.tell() <= MAX_IMAGE_BYTES:
                    return ReferenceImage(role, fetched['url'], 'image/png', 'png', buffer.getvalue())
            buffer = BytesIO()
            image.save(buffer, 'JPEG', quality=89, subsampling=0)
            if buffer.tell() <= MAX_IMAGE_BYTES:
                return ReferenceImage(role, fetched['url'], 'image/jpeg', 'jpg', buffer.getvalue())
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        return None
    return None


def prepare_reference(role, fetched, source):
    if not fetched['body'].startswith(b'%PDF-'):
        return prepare_image(role, fetched)
    page = parse_qs(urlsplit(source).fragment).get('page', ['1'])[0]
    try:
        number = int(page)
        if not 1 <= number <= 40:
            return None
        pixels = run_pdf_worker(fetched['body'], ('--render-page', str(number)), timeout=8)
    except (ValueError, OSError):
        return None
    return prepare_image(role, {**fetched, 'body': pixels})


def absolute_image_url(base, value):
    if not value or len(value) > 2000:
        return None
    try:
        url = urljoin(base, value)
        if urlsplit(url).scheme != 'https':
            return None
    except ValueError:
        return None
    return quote(url, safe=":/?#[]@!$&'()*+,;=%")


class ProductImages(HTMLParser):
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.images = {role: {} for role in (PHOTO, PINOUT, DIMENSIONS)}

    @staticmethod
    def classify(url, alt='', social=False):
        path = urlsplit(url).path.rsplit('/', 1)[-1]
        name = alt + ' ' + path
        if PINOUT_NAME.search(name):
            return PINOUT, 30
        if DIMENSION_NAME.search(name):
            return DIMENSIONS, 30
        if not UNRELATED_NAME.search(name):
            if re.search(r'\b(front|top|topview)\b', name, re.I):
                return PHOTO, 30
            if social or re.search(r'\b(?:board|module|product)\b', alt, re.I):
                return PHOTO, 20 if social else 10
        return PHOTO, 0

    def add(self, value, alt='', social=False):
        if url := absolute_image_url(self.url, value):
            role, score = self.classify(url, alt, social)
            if score:
                candidates = self.images[role]
                candidates[url] = max(candidates.get(url, 0), score)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'meta' and (values.get('property') or values.get('name')) in ('og:image', 'twitter:image'):
            self.add(values.get('content'), social=True)
        if tag == 'a':
            if url := absolute_image_url(self.url, values.get('href')):
                if urlsplit(url).path.lower().endswith('.pdf') and self.classify(url, values.get('title') or '')[0] in (PINOUT, DIMENSIONS):
                    self.add(url, values.get('title') or '')
        if tag != 'img':
            return
        alt = values.get('alt') or ''
        # Prioritize displayed/lazy-loading files over the optional original upload.
        for attribute in ('data-src', 'src', 'data-large_image'):
            self.add(values.get(attribute), alt)


def resolve_reference_images(url, fetcher=fetch_public):
    deadline = time.monotonic() + 14

    def fetch(target, limit, headers):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return None
        try:
            return fetcher(target, max_bytes=limit, timeout=min(remaining, 6), headers=headers)
        except (OSError, ValueError):
            return None

    page = fetch(url, MAX_SOURCE_IMAGE_BYTES, {'Accept': 'text/html,image/png,image/jpeg,image/webp,application/pdf'})
    if not page:
        return []
    if 'html' not in page['content_type'].lower():
        role, score = ProductImages.classify(page['url'])
        if not score and page['body'].startswith(b'%PDF-'):
            role = DIMENSIONS
        image = prepare_reference(role, page, url)
        return [image] if image else []

    parser = ProductImages(page['url'])
    parser.feed(page['body'].decode('utf-8', errors='replace'))
    def load_role(role):
        candidates = parser.images[role]
        for source in sorted(candidates, key=candidates.get, reverse=True)[:4]:
            fetched = fetch(source, MAX_SOURCE_IMAGE_BYTES, IMAGE_ACCEPT)
            image = prepare_reference(role, fetched, source) if fetched else None
            if image:
                return image
        return None

    with ThreadPoolExecutor(max_workers=3) as pool:
        images = pool.map(load_role, (PINOUT, DIMENSIONS, PHOTO))
        selected = {}
        for image in images:
            if image:
                selected.setdefault(image.url, image)
    return list(selected.values())
