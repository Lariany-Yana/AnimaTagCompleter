import asyncio
from aiohttp import web

try:
    from server import PromptServer
except ImportError:
    PromptServer = None

from .tag_database import tag_database

DEFAULT_LIMIT = 20
MIN_LIMIT = 1
MAX_LIMIT = 200


def setup_routes():
    if PromptServer is None or PromptServer.instance is None:
        print("[AnimaTagCompleter] PromptServer not available — API routes not registered")
        return

    routes = PromptServer.instance.routes

    @routes.get("/anima_tag_completer/search")
    async def search_tags(request: web.Request) -> web.Response:
        query = request.rel_url.query.get("q", "")
        limit = _to_int(request.rel_url.query.get("limit"), DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT)
        sources = _split(request.rel_url.query.get("source") or request.rel_url.query.get("sources"))
        categories = _split(request.rel_url.query.get("category"))
        exclude_categories = _split(request.rel_url.query.get("exclude_category"))
        permuted = request.rel_url.query.get("permuted") == "1"

        search_fn = tag_database.search_permuted if permuted else tag_database.search

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                lambda: search_fn(
                    query,
                    limit=limit,
                    sources=sources,
                    categories=categories,
                    exclude_categories=exclude_categories,
                )
            )
        except Exception as e:
            print(f"[AnimaTagCompleter] Search failed: {e}")
            return web.json_response({"error": "search_failed"}, status=500)

        return web.json_response([e.to_dict() for e in results])

    @routes.get("/anima_tag_completer/sources")
    async def list_sources(request: web.Request) -> web.Response:
        try:
            return web.json_response(tag_database.list_sources())
        except Exception as e:
            print(f"[AnimaTagCompleter] list_sources failed: {e}")
            return web.json_response({"error": "list_failed"}, status=500)

    @routes.post("/anima_tag_completer/reload")
    async def reload_database(request: web.Request) -> web.Response:
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, tag_database.reload)
        except Exception as e:
            print(f"[AnimaTagCompleter] Reload failed: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)
        return web.json_response({"status": "ok", "size": tag_database.size})

    print(f"[AnimaTagCompleter] API routes registered, tags in database: {tag_database.size}")


def _split(value):
    if not value:
        return None
    values = [v.strip() for v in value.split(",") if v.strip()]
    return values or None


def _to_int(value, default, min_value=None, max_value=None):
    try:
        result = int(value)
    except (TypeError, ValueError):
        return default
    if min_value is not None:
        result = max(min_value, result)
    if max_value is not None:
        result = min(max_value, result)
    return result