// 새 DB 부품을 읽은 뒤 그린다. 기존 편집 내용은 자동으로 바꾸지 않는다.
export async function applyAgentResult(result, { backend, hasInstances, drawWiring, isCurrent = () => true, isDemo = false }) {
  if (result.clarification) return 'clarification';
  if (!isDemo) await backend.refreshAfterAgent();
  if (!isCurrent()) return 'stale';
  if (result.circuit) {
    if (!hasInstances()) {
      const loaded = await backend.openCircuit(result.circuit.circuit_id || result.circuit.id, { showPanel: false, automatic: true });
      return loaded ? 'circuit-loaded' : 'circuit-available';
    }
    return 'circuit-available';
  }
  if (result.wiring) { drawWiring(result.wiring); return 'wiring-proposed'; }
  return 'text-only';
}
