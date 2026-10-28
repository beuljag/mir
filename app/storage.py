import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .models import CandidateRecord, CircuitRecord, ComponentDefinition, JobRecord, ComponentImage
from .seed import sample_components


class VersionConflict(Exception):
    pass


class Store:
    def __init__(self, path: str):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS components (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS component_drafts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(owner,request_id))")
            db.execute("CREATE TABLE IF NOT EXISTS circuits (id TEXT PRIMARY KEY, owner TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS circuit_versions (id TEXT, version INTEGER, payload TEXT NOT NULL, PRIMARY KEY(id, version))")
            db.execute("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS component_candidates (id TEXT PRIMARY KEY, owner TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS component_images (id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(owner,request_id))")
            db.execute("CREATE TABLE IF NOT EXISTS component_image_bindings (owner TEXT NOT NULL, component_id TEXT NOT NULL, asset_id TEXT NOT NULL, PRIMARY KEY(owner,component_id))")
            for component in sample_components():
                db.execute("INSERT OR IGNORE INTO components VALUES (?, ?)", (component.id, component.model_dump_json()))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        try:
            with db:
                yield db
        finally:
            db.close()

    def components(self, owner=None):
        with self.connect() as db:
            result = {row[0]: ComponentDefinition.model_validate_json(row[1]) for row in db.execute("SELECT id,payload FROM components ORDER BY id")}
            if owner is not None:
                result.update({row[0]: ComponentDefinition.model_validate_json(row[1]) for row in db.execute("SELECT id,payload FROM component_drafts WHERE owner=? ORDER BY id", (owner,))})
            return result

    def component_request(self, owner, request_id):
        with self.connect() as db:
            row = db.execute("SELECT payload,fingerprint FROM component_drafts WHERE owner=? AND request_id=?", (owner, request_id)).fetchone()
            return (ComponentDefinition.model_validate_json(row[0]), row[1]) if row else None

    def create_component(self, component, owner, request_id, fingerprint):
        with self.connect() as db:
            db.execute("INSERT INTO component_drafts VALUES (?,?,?,?,?)", (component.id, owner, request_id, fingerprint, component.model_dump_json()))

    def get(self, circuit_id, owner):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM circuits WHERE id=? AND owner=?", (circuit_id, owner)).fetchone()
            return CircuitRecord.model_validate_json(row[0]) if row else None

    def create(self, circuit, owner):
        payload = circuit.model_dump_json()
        with self.connect() as db:
            db.execute("INSERT INTO circuits VALUES (?, ?, ?, ?)", (circuit.id, owner, circuit.version, payload))
            db.execute("INSERT INTO circuit_versions VALUES (?, ?, ?)", (circuit.id, circuit.version, payload))

    def save(self, circuit, owner, expected_version):
        payload = circuit.model_dump_json()
        with self.connect() as db:
            cursor = db.execute("UPDATE circuits SET version=?,payload=? WHERE id=? AND owner=? AND version=?",
                                (circuit.version, payload, circuit.id, owner, expected_version))
            if cursor.rowcount != 1:
                raise VersionConflict()
            db.execute("INSERT OR REPLACE INTO circuit_versions VALUES (?, ?, ?)", (circuit.id, circuit.version, payload))

    def save_job(self, job: JobRecord, owner: str, create=False):
        with self.connect() as db:
            if create:
                db.execute("INSERT INTO jobs VALUES (?, ?, ?)", (job.id, owner, job.model_dump_json()))
            else:
                db.execute("UPDATE jobs SET payload=? WHERE id=? AND owner=?", (job.model_dump_json(), job.id, owner))

    def get_job(self, job_id, owner):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM jobs WHERE id=? AND owner=?", (job_id, owner)).fetchone()
            return JobRecord.model_validate_json(row[0]) if row else None

    def add_candidate(self, candidate, owner):
        with self.connect() as db:
            db.execute("INSERT INTO component_candidates VALUES (?, ?, ?, ?)", (candidate.id, owner, candidate.version, candidate.model_dump_json()))

    def get_candidate(self, candidate_id, owner):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM component_candidates WHERE id=? AND owner=?", (candidate_id, owner)).fetchone()
            return CandidateRecord.model_validate_json(row[0]) if row else None

    def list_candidates(self, owner, limit=50):
        with self.connect() as db:
            rows = db.execute("SELECT payload FROM component_candidates WHERE owner=? ORDER BY rowid DESC LIMIT ?", (owner, limit)).fetchall()
            return [CandidateRecord.model_validate_json(row[0]) for row in rows]

    def review_candidate(self, candidate, owner, expected_version, component=None):
        with self.connect() as db:
            cursor = db.execute("UPDATE component_candidates SET version=?, payload=? WHERE id=? AND owner=? AND version=?",
                                (candidate.version, candidate.model_dump_json(), candidate.id, owner, expected_version))
            if cursor.rowcount != 1:
                raise VersionConflict()
            if component:
                # Definitions are immutable once published; avoid invalidating old circuit versions.
                db.execute("INSERT INTO components VALUES (?, ?)", (component.id, component.model_dump_json()))

    def unfinished_jobs(self):
        with self.connect() as db:
            return [(row[1], JobRecord.model_validate_json(row[0])) for row in db.execute("SELECT payload,owner FROM jobs")
                    if JobRecord.model_validate_json(row[0]).status in ("queued", "running")]

    def image_request(self, owner, request_id):
        with self.connect() as db:
            row = db.execute("SELECT payload,fingerprint FROM component_images WHERE owner=? AND request_id=?", (owner, request_id)).fetchone()
            return (ComponentImage.model_validate_json(row[0]), row[1]) if row else None

    def create_image(self, image, owner, request_id, fingerprint, job):
        # 이미지와 작업을 한 트랜잭션으로 저장해 재전송에 따른 중복 생성을 막는다.
        with self.connect() as db:
            db.execute("INSERT INTO component_images VALUES (?,?,?,?,?)", (image.id, owner, request_id, fingerprint, image.model_dump_json()))
            db.execute("INSERT INTO jobs VALUES (?,?,?)", (job.id, owner, job.model_dump_json()))

    def save_image(self, image, owner):
        with self.connect() as db:
            db.execute("UPDATE component_images SET payload=? WHERE id=? AND owner=?", (image.model_dump_json(), image.id, owner))

    def get_image(self, asset_id, owner):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM component_images WHERE id=? AND owner=?", (asset_id, owner)).fetchone()
            return ComponentImage.model_validate_json(row[0]) if row else None

    def list_images(self, owner, limit=50):
        with self.connect() as db:
            return [ComponentImage.model_validate_json(row[0]) for row in db.execute("SELECT payload FROM component_images WHERE owner=? ORDER BY rowid DESC LIMIT ?", (owner, limit))]

    def apply_image(self, owner, component_id, asset_id):
        with self.connect() as db:
            db.execute("INSERT INTO component_image_bindings VALUES (?,?,?) ON CONFLICT(owner,component_id) DO UPDATE SET asset_id=excluded.asset_id", (owner, component_id, asset_id))

    def active_image(self, owner, component_id):
        with self.connect() as db:
            row = db.execute("SELECT i.payload FROM component_image_bindings b JOIN component_images i ON i.id=b.asset_id AND i.owner=b.owner WHERE b.owner=? AND b.component_id=?", (owner, component_id)).fetchone()
            return ComponentImage.model_validate_json(row[0]) if row else None
