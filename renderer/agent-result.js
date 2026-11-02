// 새 DB 부품을 읽은 뒤 그린다. 기존 편집 내용은 자동으로 바꾸지 않는다.
export async function applyAgentResult(result, { backend, hasInstances, drawWiring, isDemo = false }) {
  if (!isDemo) await backend.refreshAfterAgent();
  if (result.circuit) {
    if (!hasInstances()) {
      await backend.openCircuit(result.circuit.circuit_id || result.circuit.id, { showPanel: false });
      return 'circuit-loaded';
    }
    return 'circuit-available';
  }
  if (result.wiring) { drawWiring(result.wiring); return 'wiring-proposed'; }
  return 'text-only';
}
