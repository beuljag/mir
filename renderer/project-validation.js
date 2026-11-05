// Shared file-boundary validation for main process and renderer.
(function(root){
  function validateProject(data,defs){
    const fail=message=>{throw new Error('프로젝트 파일 오류: '+message);};
    const obj=v=>v && typeof v==='object' && !Array.isArray(v);
    if(!obj(data)||data.format!=='mir-wiring/1'||!Array.isArray(data.instances)||!Array.isArray(data.wires))fail('미르 배선 파일을 선택해 주세요.');
    if(data.instances.length>2000||data.wires.length>10000)fail('부품 또는 배선 개수가 너무 많습니다.');
    if(data.title!=null && typeof data.title!=='string')fail('프로젝트 이름을 확인하세요.');
    const side=value=>['left','right','top','bottom'].includes(value);
    const strings=value=>Array.isArray(value)&&value.every(item=>typeof item==='string');
    if(data.partDefinitions!==undefined){
      const parts=data.partDefinitions;
      if(!Array.isArray(parts)||parts.length>data.instances.length)fail('포함된 부품 목록이 올바르지 않습니다.');
      const ids=new Set(), used=new Set(data.instances.map(i=>i?.part));
      for(const part of parts){
        if(!obj(part)||!used.has(part.id)||ids.has(part.id)||typeof part.name!=='string'||!part.name.trim()||
            typeof part.category!=='string'||!Array.isArray(part.pins)||part.pins.length>1000)fail('포함된 부품 정의가 올바르지 않습니다.');
        ids.add(part.id);
        const pins=new Set();
        for(const pin of part.pins){
          if(!obj(pin)||typeof pin.id!=='string'||!pin.id.trim()||pins.has(pin.id)||!side(pin.side)||
              (pin.label!=null&&typeof pin.label!=='string')||(pin.type!=null&&typeof pin.type!=='string')||
              (pin.functions!=null&&!strings(pin.functions)))fail(part.id+'의 포함된 핀 정의가 올바르지 않습니다.');
          pins.add(pin.id);
        }
        if((part.sources!=null&&!strings(part.sources))||(part.unresolvedFields!=null&&!strings(part.unresolvedFields)))fail(part.id+'의 부품 출처 형식이 올바르지 않습니다.');
        if(part.behavior!=null&&(!obj(part.behavior)||
            (part.behavior.forwardVoltage!=null&&!Number.isFinite(part.behavior.forwardVoltage))||
            (part.behavior.ohms!=null&&!Number.isFinite(part.behavior.ohms))||
            (part.behavior.color!=null&&!/^#[0-9a-f]{3,8}$/i.test(part.behavior.color))))fail(part.id+'의 부품 동작 정보가 올바르지 않습니다.');
        if(part.imageData!=null&&(typeof part.imageData!=='string'||!/^data:image\/(?:svg\+xml|png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(part.imageData)))fail(part.id+'의 부품 그림이 올바르지 않습니다.');
        if(part._layout!=null){
          const layout=part._layout;
          if(!obj(layout)||!Number.isFinite(layout.w)||!Number.isFinite(layout.h)||layout.w<=0||layout.h<=0||
              !Number.isFinite(layout.top)||!obj(layout.pos)||Object.keys(layout.pos).length!==pins.size||
              part.pins.some(pin=>{
                const pos=layout.pos[pin.id];
                return !obj(pos)||!Number.isFinite(pos.x)||!Number.isFinite(pos.y)||!side(pos.side);
              }))fail(part.id+'의 핀 위치가 올바르지 않습니다.');
        }
      }
    }
    const refs=new Map(),ids=new Set();
    for(const i of data.instances){
      if(!obj(i)||typeof i.ref!=='string'||!i.ref.trim()||i.ref.includes('.')||refs.has(i.ref))fail('부품 참조가 없거나 중복되어 있습니다.');
      if(typeof i.part!=='string'||!i.part.trim())fail(i.ref+'의 부품 ID가 없습니다.');
      if(!Number.isFinite(i.x)||!Number.isFinite(i.y)||Math.abs(i.x)>1e7||Math.abs(i.y)>1e7)fail(i.ref+'의 위치가 올바르지 않습니다.');
      if(i.rotation!=null&&!Number.isFinite(i.rotation))fail(i.ref+'의 회전 값이 올바르지 않습니다.');
      if(i.mirrored!=null&&typeof i.mirrored!=='boolean')fail(i.ref+'의 반전 상태가 올바르지 않습니다.');
      if(i.props!=null&&!obj(i.props))fail(i.ref+'의 속성 형식이 올바르지 않습니다.');
      if(i.label!=null&&typeof i.label!=='string')fail(i.ref+'의 이름 형식이 올바르지 않습니다.');
      if(defs&&!defs.has(i.part))fail(i.part+' 부품 JSON을 먼저 부품함에 추가해 주세요.');
      refs.set(i.ref,i);
    }
    function pin(key){
      if(typeof key!=='string')fail('핀 참조가 올바르지 않습니다.');
      const dot=key.indexOf('.'),ref=key.slice(0,dot),pid=key.slice(dot+1),i=refs.get(ref);
      if(dot<1||!pid||!i)fail('없는 부품의 핀 연결: '+key);
      if(defs&&!defs.get(i.part).pins.some(p=>p.id===pid))fail('없는 핀 연결: '+key);
    }
    for(const w of data.wires){
      if(!obj(w)||typeof w.id!=='string'||!w.id||ids.has(w.id))fail('배선 ID가 없거나 중복되어 있습니다.');
      ids.add(w.id);pin(w.from);pin(w.to);
      if(w.from===w.to)fail('같은 핀끼리 연결된 선이 있습니다.');
      if(w.kind!=null&&!['power','gnd','sda','scl','signal','contact'].includes(w.kind))fail('알 수 없는 선 색상 종류입니다.');
    }
    return data;
  }
  if(typeof module==='object'&&module.exports)module.exports={validateProject};
  else root.MirProjectValidation={validateProject};
})(globalThis);
