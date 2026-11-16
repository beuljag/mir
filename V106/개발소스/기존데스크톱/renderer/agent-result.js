// 새 DB 부품을 읽은 뒤 회로 결과를 현재 캔버스에 적용한다.
export async function applyAgentResult(result, { backend, drawWiring, isCurrent = () => true, isDemo = false }) {
  if (result.clarification) return 'clarification';
  if (!isDemo) await backend.refreshAfterAgent();
  if (!isCurrent()) return 'stale';
  if (result.circuit) {
    const applied = await backend.applyAgentCircuit(result.circuit.circuit_id || result.circuit.id, { isCurrent });
    return applied || 'circuit-available';
  }
  if (result.wiring) { drawWiring(result.wiring); return 'wiring-proposed'; }
  return 'text-only';
}

function uniqueId(id, used, maxLength = 80) {
  let candidate = id;
  for (let n = 2; used.has(candidate); n++) {
    const suffix = `_${n}`;
    candidate = id.slice(0, maxLength - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

export function mergeAgentCircuit(current, incoming, { sourceId, arrange, hasPin }) {
  const previous = sourceId ? current.instances.filter((i) => i.circuitSource?.id === sourceId) : [];
  const previousRefs = new Set(previous.map((i) => i.ref));
  const previousBySource = new Map(previous.map((i) => [i.circuitSource.ref, i]));
  const others = current.instances.filter((i) => !previousRefs.has(i.ref));
  const usedRefs = new Set(current.instances.map((i) => i.ref));
  const refs = new Map();
  const additions = incoming.instances.map((instance) => {
    const ref = previousBySource.get(instance.ref)?.ref ?? uniqueId(instance.ref, usedRefs);
    refs.set(instance.ref, ref);
    return { ...instance, ref };
  });
  arrange(additions, others, previous);
  const instances = [...others, ...additions];
  const byRef = new Map(instances.map((i) => [i.ref, i]));
  const pin = (key) => {
    const dot = key.indexOf('.');
    return [key.slice(0, dot), key.slice(dot + 1)];
  };
  const wires = current.wires.filter((wire) => {
    const ends = [pin(wire.from), pin(wire.to)];
    if (ends.every(([ref]) => previousRefs.has(ref))) return false;
    return ends.every(([ref, id]) => !previousRefs.has(ref) || hasPin(byRef.get(ref), id));
  });
  const usedIds = new Set(current.wires.map((w) => w.id));
  const remap = (key) => {
    const [ref, id] = pin(key);
    return `${refs.get(ref)}.${id}`;
  };
  for (const wire of incoming.wires) {
    wires.push({ ...wire, id: uniqueId(wire.id, usedIds), from: remap(wire.from), to: remap(wire.to) });
  }
  return { instances, wires };
}
