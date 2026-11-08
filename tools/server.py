"""Serve code and private assets only over loopback; no external downloads."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import errno
import json
import os
import re

APP = Path(__file__).resolve().parents[1]
DEFAULT_ASSETS = APP.parents[1] / 'work/medieval2/private-assets'
DEFAULT_GAME = Path(r'C:\Program Files (x86)\Steam\steamapps\common\Medieval II Total War')
LOOSE_FILES = ('data/animations/pack.idx', 'data/animations/pack.dat',
               'data/animations/skeletons.idx', 'data/animations/skeletons.dat',
               'data/world/maps/battle/norman_prologue/battle_of_hastings/loading_screen.tga')
MAX_RANGE = 64 * 1024 * 1024

def valid_game_root(path):
    return path is not None and (path / 'medieval2.exe').is_file() and (path / 'packs').is_dir()

def detect_game_root(explicit=None):
    candidates = [explicit, Path(os.environ['MEDIEVAL2_GAME_DIR']) if os.environ.get('MEDIEVAL2_GAME_DIR') else None, DEFAULT_GAME]
    for path in candidates:
        if path and valid_game_root(path): return path.resolve()
    return None

def game_manifest(root):
    if not valid_game_root(root): return {'available': False, 'packs': [], 'loose': {}}
    packs = [{'name': p.name, 'size': p.stat().st_size, 'url': f'/api/game/pack/{p.name}'}
             for p in sorted((root / 'packs').glob('*.pack'))]
    loose = {}
    for name in LOOSE_FILES:
        path = root.joinpath(*name.split('/'))
        if path.is_file(): loose[name] = {'size': path.stat().st_size, 'url': '/api/game/file/' + name}
    return {'available': bool(packs), 'packs': packs, 'loose': loose}

def ranged_bytes(path, header):
    match = re.fullmatch(r'bytes=(\d+)-(\d*)', header or '')
    if not match: raise ValueError('A single byte range is required')
    start = int(match[1]); end = int(match[2]) if match[2] else min(path.stat().st_size - 1, start + MAX_RANGE - 1)
    size = path.stat().st_size
    if start >= size or end < start or end - start + 1 > MAX_RANGE: raise ValueError('Invalid byte range')
    with path.open('rb') as stream:
        stream.seek(start); body = stream.read(end - start + 1)
    return body, start, start + len(body) - 1, size

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
    def send_json(self, value):
        body = json.dumps(value).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def serve_range(self, path):
        try: body, start, end, size = ranged_bytes(path, self.headers.get('Range'))
        except (ValueError, OSError): self.send_error(416); return
        self.send_response(206); self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Accept-Ranges', 'bytes'); self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path == '/api/game': self.send_json(game_manifest(self.game_root)); return
        if path.startswith('/api/game/pack/'):
            name = path.removeprefix('/api/game/pack/')
            pack = next((p for p in (self.game_root / 'packs').glob('*.pack') if p.name == name), None) if self.game_root else None
            if pack: self.serve_range(pack)
            else: self.send_error(404)
            return
        if path.startswith('/api/game/file/'):
            name = path.removeprefix('/api/game/file/').lower()
            file = self.game_files.get(name)
            if file: self.serve_range(file)
            else: self.send_error(404)
            return
        if path == '/catalog.json' and not (self.asset_root / 'catalog.json').is_file():
            body = json.dumps({'entries': []}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
        else: super().do_GET()
    def log_message(self, format, *args): pass

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8872)
    parser.add_argument('--assets', type=Path, default=DEFAULT_ASSETS)
    parser.add_argument('--game', type=Path, default=None)
    parser.add_argument('--open', action='store_true')
    args=parser.parse_args(); Handler.asset_root=args.assets.resolve();Handler.game_root=detect_game_root(args.game)
    Handler.game_files={name.lower():Handler.game_root.joinpath(*name.split('/')) for name in LOOSE_FILES} if Handler.game_root else {}
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError as error:
        if not args.open or error.errno not in (errno.EADDRINUSE, 10048):
            raise
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    port = server.server_port
    print(f'Medieval II local port: http://127.0.0.1:{port} ({"game detected" if Handler.game_root else "game not found"})', flush=True)
    if args.open:
        import webbrowser
        webbrowser.open(f'http://127.0.0.1:{port}/menu.html')
    server.serve_forever()
