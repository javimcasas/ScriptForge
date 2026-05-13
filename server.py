import http.server
import os
import json
import zipfile
import io


PORT = 5500
TEMPLATES_DIR   = os.path.join(os.path.dirname(__file__), 'templates')
CATEGORIES_FILE = os.path.join(os.path.dirname(__file__), 'categories.json')


DEFAULT_CATEGORIES = [
    {"id": "VLAN",       "icon": "network"},
    {"id": "AAA",        "icon": "shield"},
    {"id": "NTP",        "icon": "clock"},
    {"id": "SNMP",       "icon": "activity"},
    {"id": "Management", "icon": "settings"},
    {"id": "Trunks",     "icon": "list"},
    {"id": "Otros",      "icon": "more-horizontal"}
]


def read_categories():
    if not os.path.exists(CATEGORIES_FILE):
        with open(CATEGORIES_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_CATEGORIES, f, indent=2, ensure_ascii=False)
    with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_categories(data):
    with open(CATEGORIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class ScriptForgeHandler(http.server.SimpleHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/templates':
            try:
                files = sorted(
                    [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.cfg')],
                    key=lambda f: os.path.getmtime(os.path.join(TEMPLATES_DIR, f))
                )
                self._respond(200, {'files': files})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path == '/api/categories':
            try:
                self._respond(200, {'categories': read_categories()})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path == '/api/export':
            try:
                buf = io.BytesIO()
                cfg_files = sorted(
                    [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.cfg')],
                    key=lambda f: os.path.getmtime(os.path.join(TEMPLATES_DIR, f))
                )
                with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for fname in cfg_files:
                        fpath = os.path.join(TEMPLATES_DIR, fname)
                        zf.write(fpath, arcname=fname)
                    # Incluir categories.json si existe
                    if os.path.exists(CATEGORIES_FILE):
                        zf.write(CATEGORIES_FILE, arcname='categories.json')
                body = buf.getvalue()
                self.send_response(200)
                self.send_header('Content-Type', 'application/zip')
                self.send_header('Content-Disposition', 'attachment; filename="scriptforge-export.zip"')
                self.send_header('Content-Length', len(body))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self._respond(500, {'error': str(e)})

        else:
            super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)

        if self.path == '/api/templates':
            try:
                data = json.loads(body)
                filename = data.get('filename', '').strip()
                content  = data.get('content', '').strip()
                if not filename or not content:
                    self._respond(400, {'error': 'filename y content son obligatorios'}); return
                if not filename.endswith('.cfg'):
                    filename += '.cfg'
                filename = os.path.basename(filename)
                os.makedirs(TEMPLATES_DIR, exist_ok=True)
                with open(os.path.join(TEMPLATES_DIR, filename), 'w', encoding='utf-8') as f:
                    f.write(content)
                self._respond(200, {'ok': True, 'filename': filename})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path == '/api/categories':
            try:
                data = json.loads(body)
                name  = data.get('id', '').strip()
                icon  = data.get('icon', 'folder').strip()
                color = data.get('color', '').strip()
                if not name:
                    self._respond(400, {'error': 'El nombre es obligatorio'}); return
                cats = read_categories()
                if any(c['id'].lower() == name.lower() for c in cats):
                    self._respond(409, {'error': 'Ya existe esa categoría'}); return
                cats.append({'id': name, 'icon': icon, 'color': color})
                write_categories(cats)
                self._respond(200, {'ok': True, 'category': {'id': name, 'icon': icon, 'color': color}})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path == '/api/categories/reorder':
            try:
                data  = json.loads(body)
                order = data.get('order', [])
                cats  = read_categories()
                cat_map   = {c['id']: c for c in cats}
                reordered = [cat_map[i] for i in order if i in cat_map]
                seen      = {c['id'] for c in reordered}
                reordered += [c for c in cats if c['id'] not in seen]
                write_categories(reordered)
                self._respond(200, {'ok': True})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        else:
            self._respond(404, {'error': 'Not found'})

    def do_DELETE(self):
        if self.path.startswith('/api/templates/'):
            filename = os.path.basename(self.path[len('/api/templates/'):])
            filepath = os.path.join(TEMPLATES_DIR, filename)
            try:
                if not os.path.exists(filepath):
                    self._respond(404, {'error': 'Archivo no encontrado'}); return
                os.remove(filepath)
                self._respond(200, {'ok': True})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path.startswith('/api/categories/'):
            cat_id = self.path[len('/api/categories/'):]
            try:
                cats = read_categories()
                if cat_id not in [c['id'] for c in cats]:
                    self._respond(404, {'error': 'Categoría no encontrada'}); return
                cats = [c for c in cats if c['id'] != cat_id]
                write_categories(cats)
                self._respond(200, {'ok': True})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        else:
            self._respond(404, {'error': 'Not found'})

    def _respond(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"  {' '.join(str(a) for a in args)}")


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with http.server.HTTPServer(('', PORT), ScriptForgeHandler) as httpd:
        print(f"ScriptForge server → http://localhost:{PORT}")
        httpd.serve_forever()