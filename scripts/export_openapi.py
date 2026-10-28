"""Export runtime OpenAPI 3 and a Swagger 2 contract for Power Platform."""
import argparse
import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import create_app


def to_swagger(spec, host):
    def convert(value):
        if isinstance(value, list):
            return [convert(v) for v in value]
        if not isinstance(value, dict):
            return value
        if "anyOf" in value:
            options = [v for v in value["anyOf"] if v.get("type") != "null"]
            if len(options) != 1:
                raise ValueError("Unsupported union in connector schema")
            return {**convert(options[0]), "x-nullable": True}
        result = {}
        for key, item in value.items():
            if key in ("const", "examples"):
                continue
            if key == "$ref":
                item = item.replace("#/components/schemas/", "#/definitions/")
            result[key] = convert(item)
        if "const" in value:
            result["enum"] = [value["const"]]
        return result

    result = {"swagger": "2.0", "info": spec["info"], "host": host, "basePath": "/", "schemes": ["https"],
              "consumes": ["application/json"], "produces": ["application/json"], "paths": {},
              "securityDefinitions": spec["components"]["securitySchemes"],
              "definitions": {name: convert(schema) for name, schema in spec["components"]["schemas"].items()
                              if name not in ("ValidationError", "HTTPValidationError")}}
    for path, methods in spec["paths"].items():
        result["paths"][path] = {}
        for method, operation in methods.items():
            op = {k: copy.deepcopy(operation[k]) for k in ("operationId", "summary", "description", "tags", "security") if k in operation}
            op["parameters"] = []
            for parameter in operation.get("parameters", []):
                p = {k: v for k, v in parameter.items() if k != "schema"}
                p.update(convert(parameter["schema"]))
                op["parameters"].append(p)
            if "requestBody" in operation:
                body = operation["requestBody"]
                op["parameters"].append({"name": "body", "in": "body", "required": body.get("required", False),
                                          "schema": convert(body["content"]["application/json"]["schema"])})
            op["responses"] = {}
            for status, response in operation["responses"].items():
                if status == "422":
                    continue
                r = {"description": response.get("description", "Response")}
                if "application/json" in response.get("content", {}):
                    r["schema"] = convert(response["content"]["application/json"]["schema"])
                op["responses"][status] = r
            result["paths"][path][method] = op
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="YOUR-API-HOST.example.com", help="HTTPS host only, no scheme or path")
    args = parser.parse_args()
    if "/" in args.host:
        parser.error("--host must contain only the hostname (and optional port)")
    root = Path(__file__).resolve().parents[1]
    # Export is offline; the temporary export key is never written to specifications.
    app = create_app(str(root / "work" / "export.db"), {"export-only-not-a-runtime-key-1234": "export"})
    spec = app.openapi()
    spec["servers"] = [{"url": f"https://{args.host}"}]
    for filename, document in [("openapi.json", spec), ("copilot-connector.swagger.json", to_swagger(spec, args.host))]:
        (root / filename).write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")
        print(filename)
