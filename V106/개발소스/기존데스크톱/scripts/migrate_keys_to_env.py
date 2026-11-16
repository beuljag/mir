"""기존 키를 유지한 채 .env에 모은다. 키 값은 출력하지 않는다."""
import json
import os
from pathlib import Path
from dotenv import dotenv_values, set_key

ROOT = Path(__file__).resolve().parents[1]
env = ROOT / '.env'
env.touch(exist_ok=True)
values = dotenv_values(env, interpolate=False)
key_path = ROOT / 'config' / 'local-api-keys.json'
if key_path.exists() and not values.get('CIRCUIT_API_KEY'):
    keys = json.loads(os.getenv('CIRCUIT_API_KEYS') or key_path.read_text(encoding='utf-8'))
    key, owner = next(iter(keys.items()))
    set_key(str(env), 'CIRCUIT_API_KEY', key, quote_mode='never')
    set_key(str(env), 'CIRCUIT_API_OWNER', owner, quote_mode='never')
review_path = ROOT / 'config' / 'local-review-key.json'
if review_path.exists() and not values.get('CIRCUIT_REVIEW_KEY'):
    review_key = json.loads(review_path.read_text(encoding='utf-8'))['review_key']
    set_key(str(env), 'CIRCUIT_REVIEW_KEY', review_key, quote_mode='never')
print('Existing wiring/review keys copied to .env. Existing files and Copilot secret preserved.')
