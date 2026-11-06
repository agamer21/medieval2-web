"""Serve code and private assets only over loopback; no external downloads."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import json

APP = Path(__file__).resolve().parents[1]
DEFAULT_ASSETS = APP.parents[1] / 'work/medieval2/private-assets'

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, request):
        path = unquote(urlsplit(request).path)
        if path == '/catalog.json': root, relative = self.asset_root, 'catalog.json'
        elif path.startswith('/assets/'): root, relative = self.asset_root, path[len('/assets/'):]
        else: root, relative = APP, path.lstrip('/') or 'index.html'
        candidate = (root / relative).resolve()
        if not candidate.is_relative_to(root) or candidate.is_dir(): return str(APP / '__not_found__')
        return str(candidate)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
    def do_GET(self):
        if urlsplit(self.path).path == '/catalog.json' and not (self.asset_root / 'catalog.json').is_file():
            body = json.dumps({'entries': []}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
        else: super().do_GET()
    def log_message(self, format, *args): pass

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8872)
    parser.add_argument('--assets', type=Path, default=DEFAULT_ASSETS)
    args=parser.parse_args(); Handler.asset_root=args.assets.resolve()
    print(f'Medieval II Asset Lab: http://127.0.0.1:{args.port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
