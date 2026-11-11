"""All electrical values below are synthetic fixtures, not real part specifications."""
from .models import ComponentDefinition, Pin, Source


def sample_components():
    source = Source(title="가상 테스트 부품 정의", reference="fixture://virtual-v1", revision="1")
    common = dict(manufacturer="TEST ONLY", revision="1", is_virtual=True,
                  verification_status="unverified", source_references=[source],
                  notes="소프트웨어 테스트 전용 가상 부품. 실제 하드웨어 배선에 사용하지 마세요.")
    return [
        ComponentDefinition(id="virtual-supply", model="VIRTUAL SUPPLY", category="power", pins=[
            Pin(id="VOUT", label="가상 전원", direction="power_out", signal_type="power", output_voltage=3.3),
            Pin(id="GND", label="GND", direction="ground", signal_type="ground")], **common),
        ComponentDefinition(id="virtual-sensor", model="VIRTUAL SENSOR", category="sensor", pins=[
            Pin(id="VCC", label="VCC", direction="power_in", signal_type="power", required=True, voltage_min=3, voltage_max=3.6),
            Pin(id="GND", label="GND", direction="ground", signal_type="ground", required=True),
            Pin(id="OUT", label="OUT", direction="output", signal_type="digital", output_voltage=3.3)], **common),
        ComponentDefinition(id="virtual-controller", model="VIRTUAL CONTROLLER", category="controller", pins=[
            Pin(id="VCC", label="VCC", direction="power_in", signal_type="power", required=True, voltage_min=3, voltage_max=3.6),
            Pin(id="GND", label="GND", direction="ground", signal_type="ground", required=True),
            Pin(id="IN", label="IN", direction="input", signal_type="digital", required=True, voltage_min=0, voltage_max=3.6)], **common),
    ]
