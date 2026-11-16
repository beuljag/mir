import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .models import CandidateRecord, CircuitRecord, ComponentDefinition, JobRecord, ComponentImage
from .seed import sample_components
from .builtin_catalog import normalized_name, read_builtin_parts


class VersionConflict(Exception):
    pass


class Store:
    def __init__(self, path: str):
        self.path = path
        self.builtin_parts, self.builtin_names, self.builtin_artwork = read_builtin_parts()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS components (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS kicad_projects (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL)")
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
            result = dict(self.builtin_parts)
            result.update({row[0]: ComponentDefinition.model_validate_json(row[1]) for row in db.execute("SELECT id,payload FROM components ORDER BY id")})
            if owner is not None:
                result.update({row[0]: ComponentDefinition.model_validate_json(row[1]) for row in db.execute("SELECT id,payload FROM component_drafts WHERE owner=? ORDER BY id", (owner,))})
            return result

    def matching_builtin(self, request):
        requested_name = normalized_name(request.model)
        for part_id, names in self.builtin_names.items():
            part = self.builtin_parts[part_id]
            if part.category != request.category or not any(normalized_name(name) == requested_name for name in names):
                continue
            pins = {pin.id: pin.direction for pin in part.pins}
            if all(pins.get(pin.id) == pin.direction for pin in request.pins):
                return part
        return None

    def resolve_artwork(self, component):
        if component.id in self.builtin_artwork:
            path, presentation, _ = self.builtin_artwork[component.id]
            return component.id, path, presentation
        if component.category != 'board' or not component.pins:
            return None
        model = normalized_name(component.model)
        manufacturer = normalized_name(component.manufacturer).removesuffix(' ltd')
        for part_id, (path, presentation, aliases) in self.builtin_artwork.items():
            builtin = self.builtin_parts[part_id]
            if (manufacturer != normalized_name(builtin.manufacturer).removesuffix(' ltd')
                    or not any(model == normalized_name(name) for name in self.builtin_names[part_id])):
                continue
            physical = presentation.physical_layout
            pins = {pin.id: aliases.get(pin.id, pin.id) for pin in component.pins}
            pin_ids = set(pins.values())
            if len(pin_ids) != len(pins) or not pin_ids <= physical.pins.keys():
                continue
            # A draft may expose only some pins or name a header differently.
            # Preserve its IDs and use only the known positions on the artwork.
            mapped = physical.model_copy(update={'pins': {old: physical.pins[new] for old, new in pins.items()}})
            return part_id, path, presentation.model_copy(update={'physical_layout': mapped})
        return None

    def component_request(self, owner, request_id):
        with self.connect() as db:
            row = db.execute("SELECT payload,fingerprint FROM component_drafts WHERE owner=? AND request_id=?", (owner, request_id)).fetchone()
            return (ComponentDefinition.model_validate_json(row[0]), row[1]) if row else None

    def create_component(self, component, owner, request_id, fingerprint):
        with self.connect() as db:
            db.execute("INSERT INTO component_drafts VALUES (?,?,?,?,?)", (component.id, owner, request_id, fingerprint, component.model_dump_json()))

    def update_draft_component(self, component_id, owner, update):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload FROM component_drafts WHERE id=? AND owner=?", (component_id, owner)).fetchone()
            if row is None:
                return None
            original = ComponentDefinition.model_validate_json(row[0])
            component = update(original)
            if component != original:
                db.execute("UPDATE component_drafts SET payload=? WHERE id=? AND owner=?",
                           (component.model_dump_json(), component_id, owner))
            return component

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

    def save_kicad_project(self, project, owner):
        import json
        with self.connect() as db:
            db.execute("INSERT INTO kicad_projects VALUES (?,?,?)", (project['id'], owner, json.dumps(project, ensure_ascii=False)))

    def get_kicad_project(self, project_id, owner):
        import json
        with self.connect() as db:
            row = db.execute("SELECT payload FROM kicad_projects WHERE id=? AND owner=?", (project_id, owner)).fetchone()
            return json.loads(row[0]) if row else None
