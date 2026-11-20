"""Run a packaged Mee Pay edition on loopback using Python 3."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--examples", action="store_true", help="Open the two-merchant v1.12 edition")
parser.add_argument("--port", type=int)
args = parser.parse_args()
site = root / ("examples/two-merchants-v1.12" if args.examples else "demo")
port = args.port if args.port is not None else (4322 if args.examples else 4321)

class DemoHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".wasm": "application/wasm"}

    def translate_path(self, path):
        filename = Path(super().translate_path(path))
        if args.examples and (site / "vendor") in filename.parents:
            return str(root / "demo/vendor" / filename.relative_to(site / "vendor"))
        return str(filename)

    def list_directory(self, path):
        self.send_error(404)
        return None

if __name__ == "__main__":
    handler = partial(DemoHandler, directory=str(site))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        for page in ("backoffice", "external"):
            print(f"http://127.0.0.1:{port}/{page}.html#/login", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
