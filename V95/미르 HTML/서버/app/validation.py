from .models import CircuitRecord, ComponentDefinition, Issue, ValidationResult


def validate(circuit: CircuitRecord, definitions: dict[str, ComponentDefinition]) -> ValidationResult:
    issues: list[Issue] = []

    def report(code, severity, message, refs):
        issues.append(Issue(code=code, severity=severity, message=message, affected_refs=refs))

    pins = {}
    for instance in circuit.component_instances:
        component = definitions.get(instance.component_definition_id)
        if component is None:
            report("UNKNOWN_COMPONENT", "error", "부품 정의가 없습니다.", [instance.instance_id])
            continue
        if component.is_virtual or component.verification_status != "verified":
            report("UNVERIFIED_COMPONENT", "unknown", "가상 또는 미확인 부품 사양입니다.", [instance.instance_id])
        if not component.pins:
            report("PINOUT_NOT_DEFINED", "unknown", "핀 정보가 없는 외형 초안입니다. 핀 연결은 정의 후 검사할 수 있습니다.", [instance.instance_id])
        for pin in component.pins:
            pins[(instance.instance_id, pin.id)] = pin

    membership = {}
    for net in circuit.nets:
        valid = []
        seen = set()
        for ref in net.connected_pin_refs:
            key = (ref.instance_id, ref.pin_id)
            label = f"{ref.instance_id}.{ref.pin_id}"
            if key in seen:
                report("DUPLICATE_PIN", "error", "같은 net에 핀이 중복되었습니다.", [net.net_id, label])
                continue
            seen.add(key)
            if key in membership and membership[key] != net.net_id:
                report("PIN_IN_MULTIPLE_NETS", "error", "핀은 하나의 net에만 속할 수 있습니다.", [label])
            membership[key] = net.net_id
            if key not in pins:
                report("UNKNOWN_PIN", "error", "존재하지 않는 핀 참조입니다.", [net.net_id, label])
            else:
                valid.append((label, pins[key]))
        if len(valid) < 2:
            report("INSUFFICIENT_NET_PINS", "error", "net에 유효한 서로 다른 핀이 2개 이상 필요합니다.", [net.net_id])
        drivers = [(label, pin) for label, pin in valid if pin.direction in ("output", "power_out")]
        if len(drivers) > 1:
            report("MULTIPLE_DRIVERS", "error", "복수 출력이 연결되었습니다. 공유 가능 출력 모델은 미지원입니다.", [net.net_id])
        if any(p.direction == "power_out" for _, p in valid) and any(p.signal_type == "ground" for _, p in valid):
            report("POWER_GROUND_SHORT", "error", "전원 출력과 GND가 같은 net입니다.", [net.net_id])
        types = {p.signal_type for _, p in valid} - {"passive"}
        if len(types) > 1:
            report("SIGNAL_TYPE_CONFLICT", "error", "서로 다른 신호 타입이 연결되었습니다.", [net.net_id])
        for label, pin in valid:
            if pin.direction in ("input", "power_in"):
                if not drivers:
                    report("NO_MODELED_DRIVER", "unknown", "입력을 구동할 출력이 확인되지 않았습니다.", [net.net_id, label])
                for _, driver in drivers:
                    voltage = driver.output_voltage
                    if voltage is None or pin.voltage_min is None or pin.voltage_max is None:
                        report("MISSING_VOLTAGE_SPEC", "unknown", "전압 호환성 검사에 필요한 사양이 없습니다.", [label])
                    elif not pin.voltage_min <= voltage <= pin.voltage_max:
                        report("VOLTAGE_OUT_OF_RANGE", "error", "출력 전압이 입력 허용 범위를 벗어납니다.", [net.net_id, label])
    for key, pin in pins.items():
        if pin.required and key not in membership:
            report("REQUIRED_PIN_UNCONNECTED", "error", "필수 핀이 연결되지 않았습니다.", [".".join(key)])
    instances = {i.instance_id for i in circuit.component_instances}
    for placement in circuit.layout:
        if placement.instance_id not in instances:
            report("UNKNOWN_LAYOUT_INSTANCE", "error", "배치할 부품 인스턴스가 없습니다.", [placement.instance_id])
    status = "failed" if any(i.severity == "error" for i in issues) else "unknown" if any(i.severity == "unknown" for i in issues) else "passed"
    return ValidationResult(circuit_id=circuit.id, version=circuit.version, status=status, issues=issues,
                            scope=["핀 참조", "필수 핀 연결", "복수 출력", "전원/GND 단락", "신호 타입", "정적 전압 범위"],
                            excluded_checks=["전류/부하/발열", "통신 타이밍", "보호/보조 부품 적정성", "MCU 펌웨어", "실제 하드웨어 안전", "SPICE 시뮬레이션"])
