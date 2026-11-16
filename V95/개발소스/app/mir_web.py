"""미르의 화면 파일만 공개한다. 설정·키·DB·Git 파일은 공개하지 않는다."""
import json
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


class MirStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if path in (".", "index.html", "미르 HTML.html"):
            # The entry page selects the current versions of the renderer modules.
            response.headers["Cache-Control"] = "no-cache"
        return response


def attach_mir(app):
    base = Path(__file__).resolve().parents[1]
    root = base if (base / "renderer" / "index.html").is_file() else base / "mir"
    has_renderer = (root / "renderer" / "index.html").is_file()
    web_root = base.parent / "미르 HTML"
    has_web = (web_root / "미르 HTML.html").is_file()
    if not has_renderer and not has_web:
        return

    if has_web:
        web_files = MirStaticFiles(directory=web_root)

        @app.api_route("/mir/", methods=["GET", "HEAD"], include_in_schema=False)
        @app.api_route("/mir/index.html", methods=["GET", "HEAD"], include_in_schema=False)
        async def web_editor(request: Request):
            return await web_files.get_response("미르 HTML.html", request.scope)

        @app.get("/mir/connection", include_in_schema=False)
        def web_connection():
            return {"hosted": True}

        @app.api_route("/mir/미르.js", methods=["GET", "HEAD"], include_in_schema=False)
        @app.api_route("/mir/미르.css", methods=["GET", "HEAD"], include_in_schema=False)
        async def web_asset(request: Request):
            return await web_files.get_response(request.url.path.rsplit("/", 1)[-1], request.scope)

        app.mount("/mir/assets", StaticFiles(directory=web_root / "assets"), name="mir-assets")

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
        if Path(name).name != name:
            raise HTTPException(404)
        if has_web and name.endswith((".html", ".css")):
            file = web_root / "docs" / name
            if file.is_file():
                return FileResponse(file)
        if not name.endswith(".md"):
            raise HTTPException(404)
        file = root / "docs" / name
        if not file.is_file():
            raise HTTPException(404)
        return FileResponse(file, media_type="text/plain; charset=utf-8")

    @app.get("/mir/directline.js", include_in_schema=False)
    def directline():
        return FileResponse(root / "src" / "directline.js", media_type="text/javascript")

    if has_renderer:
        app.mount("/mir", MirStaticFiles(directory=root / "renderer", html=True), name="mir")
