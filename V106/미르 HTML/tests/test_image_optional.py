from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '서버'))
from fastapi.testclient import TestClient
from app import component_images
from app.local_connection import ROUTES
from app.main import create_app

KEY = 'optional-image-test-key-not-production-00'


def drawing(layout):
    w, h = layout['width'], layout['height']
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            '<rect x="12" y="30" width="50" height="24" fill="#219c8f"/></svg>')


class OptionalImageTests(unittest.TestCase):
    def test_local_routes_allow_optional_image_only(self):
        self.assertTrue(ROUTES.fullmatch('/components/esp32-devkitc/image'))
        self.assertTrue(ROUTES.fullmatch('/components/esp32-devkitc/image?optional=true'))
        self.assertFalse(ROUTES.fullmatch('/components/esp32-devkitc/image?optional=false'))
        self.assertFalse(ROUTES.fullmatch('/components/esp32-devkitc?optional=true'))

    def test_optional_image_returns_null_instead_of_404_or_stale_409(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict('os.environ', {'OPENAI_API_KEY': ''}):
            app = create_app(str(Path(folder) / 'images.db'), {KEY: 'owner'})
            try:
                with TestClient(app, headers={'X-API-Key': KEY}) as client:
                    path = '/components/virtual-sensor/image'
                    self.assertEqual(client.get(path).status_code, 404)
                    empty = client.get(path, params={'optional': 'true'})
                    self.assertEqual(empty.status_code, 200)
                    self.assertEqual(empty.json(), {'component_id': 'virtual-sensor', 'image_data': None,
                                                    'layout': None, 'reason': 'ACTIVE_IMAGE_NOT_FOUND'})
                    self.assertEqual(client.get('/components/no-such-part/image', params={'optional': 'true'}).status_code, 404)
                    spec = client.get('/components/virtual-sensor/image-spec').json()
                    job = client.post('/component-images/svg', json={
                        'component_id': 'virtual-sensor', 'appearance': '초록색 PCB의 단순한 평면 센서 외형',
                        'request_id': 'optional-image-01', 'svg': drawing(spec['layout'])}).json()
                    self.assertEqual(client.put(path, json={'asset_id': job['result']['asset_id']}).status_code, 200)
                    self.assertTrue(client.get(path, params={'optional': 'true'}).json()['image_data'].startswith('data:image/svg+xml;base64,'))
                    with patch.object(component_images, 'canvas_layout', lambda *args, **kwargs: {'changed': True}):
                        self.assertEqual(client.get(path).status_code, 409)
                        stale = client.get(path, params={'optional': 'true'})
                        self.assertEqual(stale.status_code, 200)
                        self.assertIsNone(stale.json()['image_data'])
                        self.assertEqual(stale.json()['reason'], 'IMAGE_LAYOUT_CHANGED_REGENERATE')
            finally:
                app.state.images.pool.shutdown(wait=True)
                app.state.research.pool.shutdown(wait=True)


if __name__ == '__main__':
    unittest.main()
