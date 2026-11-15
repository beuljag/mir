"""미르의 화면 파일만 공개한다. 설정·키·DB·Git 파일은 공개하지 않는다."""
import json
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


class MirStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if path in (".", "index.html"):
            # The entry page selects the current versions of the renderer modules.
            response.headers["Cache-Control"] = "no-cache"
        return response


def attach_mir(app):
    base = Path(__file__).resolve().parents[1]
    root = base if (base / "renderer" / "index.html").is_file() else base / "mir"
    if not (root / "renderer" / "index.html").is_file():
        return

    @app.get("/mir/parts", include_in_schema=False)
    def parts():
        return {"parts": [json.loads(p.read_text(encoding="utf-8"))
                          for p in sorted((root / "parts").glob("*.json"))
                          if not p.name.startswith("_")], "errors": []}

    @app.get("/mir/template", include_in_schema=False)
    def template():
        return FileResponse(root / "parts" / "_template.json")

    @app.get("/mir/docs/{name}", include_in_schema=False)
    def doc(name: str):
        if Path(name).name != name or not name.endswith(".md"):
            raise HTTPException(404)
        file = root / "docs" / name
        if not file.is_file():
            raise HTTPException(404)
        return FileResponse(file, media_type="text/plain; charset=utf-8")

    @app.get("/mir/directline.js", include_in_schema=False)
    def directline():
        return FileResponse(root / "src" / "directline.js", media_type="text/javascript")

    app.mount("/mir", MirStaticFiles(directory=root / "renderer", html=True), name="mir")
