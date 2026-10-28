"""조사 결과를 미검증 부품으로 저장하고 이미지·설계 단계에 사용할 ID를 반환한다."""
import hashlib
import sqlite3
from uuid import NAMESPACE_URL, uuid5

from fastapi import Depends, HTTPException

from .models import ComponentCreateRequest, ComponentDefinition, Source


def attach_component_catalog(app, store, owner):
    @app.post('/components', response_model=ComponentDefinition, status_code=201,
              operation_id='CreateComponent', tags=['components'])
    def create_component(body: ComponentCreateRequest, user: str = Depends(owner)):
        fingerprint = hashlib.sha256(body.model_dump_json().encode('utf-8')).hexdigest()
        existing = store.component_request(user, body.request_id)
        if existing:
            if existing[1] != fingerprint:
                raise HTTPException(409, detail={'code': 'COMPONENT_REQUEST_ID_CONFLICT'})
            return existing[0]
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
