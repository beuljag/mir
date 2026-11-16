"""Create a persistent local key once. Never print the key."""
import json
from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "config" / "local-api-keys.json"
path.parent.mkdir(exist_ok=True)
try:
    with path.open("x", encoding="utf-8") as file:
        json.dump({secrets.token_urlsafe(32): "local-user"}, file, indent=2)
    print("Created persistent local API key file.")
except FileExistsError:
    print("Existing local API key preserved.")

review_path = ROOT / "config" / "local-review-key.json"
try:
    with review_path.open("x", encoding="utf-8") as file:
        json.dump({"review_key": secrets.token_urlsafe(32)}, file, indent=2)
    print("Created separate HUMAN review key. Do not add it to agent connections or knowledge.")
except FileExistsError:
    print("Existing human review key preserved.")
