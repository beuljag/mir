"""조사 결과를 미검증 부품으로 저장하고 이미지·설계 단계에 사용할 ID를 반환한다."""
import hashlib
import sqlite3
from uuid import NAMESPACE_URL, uuid5

from fastapi import Depends, HTTPException

from .models import ComponentCreateRequest, ComponentDefinition, PinVoltageUpdate, Source


def attach_component_catalog(app, store, owner):
    @app.patch('/components/{component_id}/pins/{pin_id:path}/voltage', response_model=ComponentDefinition,
               operation_id='FillComponentPinVoltage', tags=['components'])
    def fill_pin_voltage(component_id: str, pin_id: str, body: PinVoltageUpdate, user: str = Depends(owner)):
        def update(component):
            pin = next((pin for pin in component.pins if pin.id == pin_id), None)
            if pin is None:
                raise HTTPException(404, detail={'code': 'PIN_NOT_FOUND'})
            fields = {name: getattr(body, name) for name in ('output_voltage', 'voltage_min', 'voltage_max')
                      if getattr(body, name) is not None}
            if ('output_voltage' in fields and pin.direction not in ('power_out', 'output', 'bidirectional')
                    or fields.keys() & {'voltage_min', 'voltage_max'} and pin.direction not in ('power_in', 'input', 'bidirectional')):
                raise HTTPException(422, detail={'code': 'VOLTAGE_FIELD_DIRECTION_MISMATCH'})
            if any(getattr(pin, name) not in (None, value) for name, value in fields.items()):
                raise HTTPException(409, detail={'code': 'PIN_VOLTAGE_ALREADY_SET'})
            if all(getattr(pin, name) == value for name, value in fields.items()):
                return component
            values = {**pin.model_dump(), **fields}
            low, high = values['voltage_min'], values['voltage_max']
            if low is not None and high is not None and low > high:
                raise HTTPException(422, detail={'code': 'INVALID_VOLTAGE_RANGE'})
            pins = [p.model_validate(values) if p.id == pin_id else p for p in component.pins]
            source = Source(title=body.source_title, reference=str(body.source_url))
            sources = component.source_references if source in component.source_references else [*component.source_references, source]
            note = f'{pin_id} ({", ".join(fields)}): {body.evidence.strip()} [{source.reference}]'
            return component.model_copy(update={'pins': pins, 'source_references': sources,
                                                'notes': component.notes + '\n' + note})

        updated = store.update_draft_component(component_id, user, update)
        if updated is None:
            raise HTTPException(404, detail={'code': 'COMPONENT_DRAFT_NOT_FOUND'})
        return updated

    @app.post('/components', response_model=ComponentDefinition, status_code=201,
              operation_id='CreateComponent', tags=['components'])
    def create_component(body: ComponentCreateRequest, user: str = Depends(owner)):
        fingerprint = hashlib.sha256(body.model_dump_json().encode('utf-8')).hexdigest()
        existing = store.component_request(user, body.request_id)
        if existing:
            if existing[1] != fingerprint:
                raise HTTPException(409, detail={'code': 'COMPONENT_REQUEST_ID_CONFLICT'})
            return existing[0]
        builtin = store.matching_builtin(body)
        if builtin:
            return builtin
        sources = list(body.source_references)
        notes = body.notes
        if body.candidate_id:
            candidate = store.get_candidate(body.candidate_id, user)
            if not candidate:
                raise HTTPException(404, detail={'code': 'CANDIDATE_NOT_FOUND'})
            if candidate.requested_model.casefold() != body.model.casefold():
                raise HTTPException(422, detail={'code': 'CANDIDATE_MODEL_MISMATCH'})
            for analysis in candidate.analyses:
                if analysis.get('source'):
                    source = Source.model_validate(analysis['source'])
                    if source not in sources:
                        sources.append(source)
            notes += '\n조사 후보의 출처를 연결했습니다. 후보 승인이나 전기 사양 검증을 완료한 것은 아닙니다.'
        missing = list(body.unresolved_fields)
        if not body.pins:
            missing.append('pinout')
        if body.manufacturer == '미확인' or body.revision == 'unconfirmed':
            missing.append('exact_model_revision')
        if not sources:
            missing.append('source_documents')
        component = ComponentDefinition(
            id='draft-' + uuid5(NAMESPACE_URL, user + '\x00' + body.request_id).hex,
            manufacturer=body.manufacturer, model=body.model, revision=body.revision, category=body.category,
            pins=body.pins, source_references=sources, notes='미검증 설계 부품.\n' + notes.strip(),
            is_virtual=body.is_virtual, verification_status='unverified', is_draft=True,
            unresolved_fields=list(dict.fromkeys(missing)), research_candidate_id=body.candidate_id)
        try:
            store.create_component(component, user, body.request_id, fingerprint)
        except sqlite3.IntegrityError:
            # 동시 재전송도 동일 요청이면 같은 결과를 반환한다.
            existing = store.component_request(user, body.request_id)
            if existing and existing[1] == fingerprint:
                return existing[0]
            raise HTTPException(409, detail={'code': 'COMPONENT_REQUEST_ID_CONFLICT'}) from None
        return component
