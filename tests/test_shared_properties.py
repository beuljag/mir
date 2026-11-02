import pytest
from pydantic import ValidationError
from app.models import ComponentInstance

def test_custom_properties_survive_validation():
    instance = ComponentInstance(instance_id='R1', component_definition_id='resistor-220', label='limit', props={'ohms':4700})
    assert instance.props.ohms == 4700

@pytest.mark.parametrize('props', [{'ohms':-1}, {'color':'javascript:alert(1)'}, {'forwardVoltage':20}, {'unknown':1}])
def test_invalid_custom_properties_rejected(props):
    with pytest.raises(ValidationError):
        ComponentInstance(instance_id='R1', component_definition_id='resistor-220', props=props)
