WEB_DIRECTORY = "web"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

try:
    from .api_routes import setup_routes
    setup_routes()
except Exception as e:
    print(f"[AnimaTagCompleter] Failed to register API routes: {e}")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]