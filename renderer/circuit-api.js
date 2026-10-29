// 미르의 선(두 핀)과 API의 net(여러 핀으로 이뤄진 연결 그룹)을 변환한다.
const signature = (refs) => JSON.stringify(refs.map((p) => [p.instance_id, p.pin_id]).sort());

function parsePin(key, instances) {
  const dot = typeof key === 'string' ? key.indexOf('.') : -1;
  if (dot < 1) throw new Error(`잘못된 핀 참조: ${key}`);
  const ref = { instance_id: key.slice(0, dot), pin_id: key.slice(dot + 1) };
  if (!instances.has(ref.instance_id) || !ref.pin_id) throw new Error(`없는 부품의 핀: ${key}`);
  return ref;
}

export function toCircuitDraft(state, original = null) {
  if (!state.instances.length) throw new Error('먼저 부품을 배치하세요.');
  const instances = new Set();
  for (const i of state.instances) {
    if (!i.ref || i.ref.includes('.') || instances.has(i.ref)) throw new Error('부품 ref는 중복되거나 점(.)을 포함할 수 없습니다.');
    instances.add(i.ref);
  }
  const parents = new Map(), refs = new Map();
  const find = (x) => {
    if (!parents.has(x)) parents.set(x, x);
    if (parents.get(x) !== x) parents.set(x, find(parents.get(x)));
    return parents.get(x);
  };
  for (const wire of state.wires) {
    const a = parsePin(wire.from, instances), b = parsePin(wire.to, instances);
    const ka = JSON.stringify(a), kb = JSON.stringify(b);
    if (ka === kb) throw new Error('같은 핀을 자기 자신에게 연결할 수 없습니다.');
    refs.set(ka, a); refs.set(kb, b);
    parents.set(find(ka), find(kb));
  }
  const groups = new Map();
  for (const [key, ref] of refs) {
    const root = find(key);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(ref);
  }
  const oldIds = new Map((original?.nets || []).map((net) => [signature(net.connected_pin_refs), net.net_id]));
  const reserved = new Set((original?.nets || []).map((n) => n.net_id));
  let serial = 1;
  const nets = [...groups.values()].map((connected_pin_refs) => {
    let net_id = oldIds.get(signature(connected_pin_refs));
    if (!net_id) {
      do { net_id = `mir-net-${serial++}`; } while (reserved.has(net_id));
      reserved.add(net_id);
    }
    return { net_id, connected_pin_refs };
  });
  return {
    name: state.title || '미르 배선 초안',
    requirements: state.requirements ?? original?.requirements ?? '',
    component_instances: state.instances.map((i) => ({ instance_id: i.ref, component_definition_id: i.part })),
    nets,
    layout: state.instances.map((i) => ({ instance_id: i.ref, x: i.x ?? 0, y: i.y ?? 0, rotation: i.rotation ?? 0 }))
  };
}

export function fromCircuit(circuit) {
  const layout = new Map(circuit.layout.map((p) => [p.instance_id, p]));
  const instances = circuit.component_instances.map((i, n) => {
    if (i.instance_id.includes('.')) throw new Error('미르에서는 ref에 점(.)이 포함된 회로를 편집할 수 없습니다.');
    const p = layout.get(i.instance_id);
    return { ref: i.instance_id, part: i.component_definition_id,
      x: p?.x ?? (n % 3) * 360, y: p?.y ?? Math.floor(n / 3) * 240, rotation: p?.rotation ?? 0 };
  });
  const seen = new Set(), wires = [];
  for (const net of circuit.nets) {
    const keys = net.connected_pin_refs.map((p) => `${p.instance_id}.${p.pin_id}`);
    for (const key of keys) {
      if (seen.has(key)) throw new Error(`여러 net에 중복된 핀(${key})이 있어 불러오기를 중단했습니다. API에서 먼저 수정하세요.`);
      seen.add(key);
    }
    keys.slice(1).forEach((key) => wires.push({ id: `db-${wires.length}`, from: keys[0], to: key, origin: 'api', note: net.net_id }));
  }
  return { instances, wires, title: circuit.name, requirements: circuit.requirements };
}

export function definitionToPart(def) {
  const types = { ground: 'gnd', bidirectional: 'gpio' };
  return {
    id: def.id, name: def.model, category: def.category,
    description: `${def.manufacturer} · ${def.verification_status}${def.is_draft ? ' · 미검증 설계 부품' : ''}${def.is_virtual ? ' · 가상 부품' : ''}${!def.pins.length ? ' · 핀 정보 미확인' : ''}`,
    isDraft: !!def.is_draft,
    unresolvedFields: def.unresolved_fields || [],
    sources: def.source_references.map((s) => s.reference),
    pins: def.pins.map((p, n) => ({
      id: p.id, label: p.label, type: types[p.direction] || p.direction,
      side: n % 2 ? 'right' : 'left',
      ...(p.voltage_min != null ? { minVoltage: p.voltage_min } : {}),
      ...(p.voltage_max != null ? { maxVoltage: p.voltage_max } : {}),
      ...(p.output_voltage != null ? { voltage: p.output_voltage } : {})
    }))
  };
}

export async function loadComponentCatalog(client) {
  const parts = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const batch = await client.call(`/components/search?limit=100&offset=${offset}`);
    parts.push(...batch);
    if (batch.length < 100) return parts;
  }
  throw new Error('부품 목록이 조회 한도를 초과했습니다.');
}

// 서버가 검사한 SVG를 data URL로 표시한다. SVG 원문을 DOM에 직접 넣지 않는다.
export async function loadComponentImage(client, part) {
  try {
    const result = await client.call(`/components/${encodeURIComponent(part.id)}/image`);
    if (!result.image_data?.startsWith('data:image/svg+xml;base64,') || !result.layout) throw new Error('이미지 데이터 형식이 올바르지 않습니다.');
    const positions = new Map(result.layout.pins.map((p) => [p.id, p]));
    // 서버의 연결 좌표를 사용해 그림 크기와 핀 위치를 일치시킨다.
    if (part.pins.length !== positions.size || part.pins.some((p) => !positions.has(p.id))) throw new Error('이미지와 핀 목록이 일치하지 않습니다.');
    const { _layout, ...fresh } = part;
    const pins = part.pins.map((p) => ({ ...p, side: positions.get(p.id).side }));
    const pos = Object.fromEntries(pins.map((p) => [p.id, { ...positions.get(p.id), def: p }]));
    const nodes = result.design_version === 'v2' && Array.isArray(result.art_nodes) ? result.art_nodes : undefined;
    return { ...fresh, imageData: result.image_data, imageFit: 'none', pins, imageAssetId: result.asset_id,
      imageNodes: nodes, imagePresentation: result.presentation, color: result.presentation?.color || fresh.color,
      _layout: { w: result.layout.width, h: result.layout.height, top: result.layout.top || 0, pos } };
  } catch (e) {
    if (e.status === 404) return part;
    throw e;
  }
}

export class CircuitApi {
  constructor(request, key) { this.request = request; this.key = key; }
  async call(path, method = 'GET', body) {
    const response = await this.request(path, {
      method, headers: { 'X-API-Key': this.key, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (response.status >= 400) {
      const detail = response.body?.detail;
      const code = detail?.code || `HTTP ${response.status}`;
      const hint = response.status === 409;
      const error = new Error(code + (hint ? ' 최신 버전과 충돌했습니다. 편집을 파일로 저장한 뒤 회로를 다시 불러오세요.' : ''));
      error.status = response.status;
      throw error;
    }
    return response.body;
  }
}
