from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Source(Model):
    title: str
    reference: str
    revision: str | None = None
    page: str | None = None
    sha256: str | None = None
    retrieved_at: str | None = None


class Pin(Model):
    id: str = Field(min_length=1, max_length=80)
    label: str
    direction: Literal["input", "output", "bidirectional", "passive", "power_in", "power_out", "ground"]
    signal_type: Literal["power", "ground", "digital", "analog", "passive"]
    required: bool = False
    voltage_min: float | None = None
    voltage_max: float | None = None
    output_voltage: float | None = None

    @model_validator(mode="after")
    def range_valid(self):
        if self.voltage_min is not None and self.voltage_max is not None:
            if self.voltage_min > self.voltage_max:
                raise ValueError("voltage_min must be <= voltage_max")
        return self


class ComponentDefinition(Model):
    id: str
    manufacturer: str
    model: str
    revision: str
    category: str
    is_virtual: bool = True
    verification_status: Literal["verified", "partial", "unverified"]
    pins: list[Pin] = Field(default_factory=list)
    source_references: list[Source] = Field(default_factory=list)
    notes: str = ""
    is_draft: bool = False
    unresolved_fields: list[str] = Field(default_factory=list)
    research_candidate_id: str | None = None

    @model_validator(mode="after")
    def valid_definition(self):
        ids = [pin.id for pin in self.pins]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate pin IDs")
        if self.verification_status == "verified" and (not self.pins or self.is_draft):
            raise ValueError("Verified components require pins and cannot be drafts")
        return self


class ComponentCreateRequest(Model):
    request_id: str = Field(min_length=8, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    manufacturer: str = Field(default="미확인", min_length=1, max_length=120)
    model: str = Field(min_length=1, max_length=160)
    revision: str = Field(default="unconfirmed", min_length=1, max_length=100)
    category: Literal["board", "sensor", "display", "output", "input", "module", "actuator", "power", "passive"]
    pins: list[Pin] = Field(default_factory=list, max_length=100)
    source_references: list[Source] = Field(default_factory=list, max_length=20)
    candidate_id: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str = Field(default="", max_length=4000)
    is_virtual: bool = False
    unresolved_fields: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def unique_pins(self):
        ids = [pin.id for pin in self.pins]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate pin IDs")
        return self


class ComponentInstance(Model):
    instance_id: str = Field(min_length=1, max_length=80)
    component_definition_id: str


class PinRef(Model):
    instance_id: str
    pin_id: str


class Net(Model):
    net_id: str = Field(min_length=1, max_length=80)
    connected_pin_refs: list[PinRef] = Field(min_length=2, max_length=500)


class Placement(Model):
    instance_id: str
    x: float = Field(ge=-100000, le=100000)
    y: float = Field(ge=-100000, le=100000)
    rotation: float = 0


class CircuitDraft(Model):
    name: str = Field(min_length=1, max_length=200)
    requirements: str = Field(default="", max_length=10000)
    component_instances: list[ComponentInstance] = Field(min_length=1, max_length=500)
    nets: list[Net] = Field(default_factory=list, max_length=1000)
    layout: list[Placement] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def unique_ids(self):
        for items, field in [(self.component_instances, "instance_id"), (self.nets, "net_id"), (self.layout, "instance_id")]:
            ids = [getattr(item, field) for item in items]
            if len(ids) != len(set(ids)):
                raise ValueError(f"Duplicate {field}")
        return self


class CircuitUpdate(CircuitDraft):
    expected_version: int = Field(ge=1)


class VersionRequest(Model):
    expected_version: int = Field(ge=1)


class ApplyRequest(VersionRequest):
    allow_unvalidated_draft: bool = False


class Issue(Model):
    code: str
    severity: Literal["error", "warning", "unknown"]
    message: str
    affected_refs: list[str] = Field(default_factory=list)


class ValidationResult(Model):
    circuit_id: str
    version: int
    ruleset_version: str = "mvp-1"
    status: Literal["passed", "failed", "unknown"]
    issues: list[Issue]
    scope: list[str]
    excluded_checks: list[str]


class CircuitRecord(CircuitDraft):
    id: str
    version: int
    status: Literal["draft", "passed", "failed", "unknown"] = "draft"
    validation_result: ValidationResult | None = None
    applied_version: int | None = None


class ApplyResult(Model):
    circuit_id: str
    version: int
    status: str
    editor_url: str


class ResearchRequest(Model):
    model: str = Field(min_length=1, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=120)
    missing_fields: list[str] = Field(default_factory=list, max_length=30)
    source_urls: list[str] = Field(default_factory=list, max_length=3)


class ResearchResult(Model):
    status: Literal["unsupported"] = "unsupported"
    message: str
    required_documents: list[str]


class DatasheetRequest(Model):
    url: str = Field(min_length=1, max_length=2000)
    model: str = Field(min_length=1, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=120)


class JobRecord(Model):
    id: str
    kind: Literal["research", "datasheet", "component_image"]
    status: Literal["queued", "running", "completed", "failed"]
    created_at: str
    updated_at: str
    result: dict | None = None
    error: dict | None = None


class CandidateRecord(Model):
    id: str
    job_id: str
    version: int = 1
    requested_model: str
    manufacturer: str | None = None
    status: Literal["pending_review", "approved", "rejected"] = "pending_review"
    analyses: list[dict]
    warnings: list[str] = Field(default_factory=list)
    review: dict | None = None


class ReviewRequest(Model):
    expected_version: int = Field(ge=1)
    decision: Literal["approve", "reject"]
    reviewer_notes: str = Field(min_length=10, max_length=4000)
    confirmed_model_revision: bool = False
    confirmed_pinout: bool = False
    confirmed_electrical_limits: bool = False
    component: ComponentDefinition | None = None

    @model_validator(mode="after")
    def reviewed(self):
        if self.decision == "approve":
            if not self.component or not all((self.confirmed_model_revision, self.confirmed_pinout, self.confirmed_electrical_limits)):
                raise ValueError("Approval requires a complete component and all three human review confirmations")
            if self.component.is_virtual or self.component.verification_status != "verified":
                raise ValueError("Approved production components must be nonvirtual and verified")
            ids = [p.id for p in self.component.pins]
            if len(ids) != len(set(ids)):
                raise ValueError("Duplicate pin IDs")
            if not self.component.source_references or not self.component.revision.strip():
                raise ValueError("Sources and revision are required")
        return self


class SimulationResult(Model):
    circuit_id: str
    version: int
    status: Literal["unsupported"] = "unsupported"
    reason: str


class ImagePresentation(Model):
    kind: Literal["pcb", "bare"] = "pcb"
    color: str = Field(default="#1d3557", pattern=r"^#[0-9a-fA-F]{6}$")
    pin_sides: dict[str, Literal["left", "right", "top", "bottom"]] = Field(default_factory=dict, max_length=100)


class ImageSpecRequest(Model):
    component_id: str | None = Field(default=None, min_length=1, max_length=200)
    candidate_id: str | None = Field(default=None, min_length=1, max_length=200)
    presentation: ImagePresentation | None = None

    @model_validator(mode="after")
    def one_target(self):
        if (self.component_id is None) == (self.candidate_id is None):
            raise ValueError("component_id 또는 candidate_id 중 하나만 지정하세요")
        return self


class ImageRequest(ImageSpecRequest):
    appearance: str = Field(min_length=10, max_length=2000)
    request_id: str = Field(min_length=8, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")


class ComponentImage(Model):
    id: str
    job_id: str
    component_id: str | None = None
    candidate_id: str | None = None
    label: str
    status: Literal["generating", "completed", "failed"] = "generating"
    created_at: str
    model: str
    width: float | None = None
    height: float | None = None
    sha256: str | None = None
    has_transparency: bool = False
    illustrative_only: bool = True
    error_code: str | None = None
    format: Literal["svg"] = "svg"
    layout: dict | None = None
    prompt_source: str = "mir/docs/부품-그림-제작-안내.md"
    design_version: Literal["v1", "v2"] = "v1"
    presentation: ImagePresentation | None = None


class ImageApplyRequest(Model):
    asset_id: str = Field(pattern=r"^[a-f0-9]{32}$")


class SvgSaveRequest(ImageRequest):
    svg: str = Field(min_length=10, max_length=200000)
