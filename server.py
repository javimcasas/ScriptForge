import http.server
import os
import json
import zipfile
import io
from urllib.parse import unquote


PORT            = 5500
TEMPLATES_DIR   = os.path.join(os.path.dirname(__file__), 'templates')
CATEGORIES_FILE = os.path.join(os.path.dirname(__file__), 'categories.json')
SAVED_DIR       = os.path.join(os.path.dirname(__file__), 'saved')


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
            json.dump({"categories": DEFAULT_CATEGORIES}, f, indent=2, ensure_ascii=False)
        return DEFAULT_CATEGORIES
    with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Compatibilidad: si el archivo es una lista plana (formato antiguo), normaliza
    if isinstance(data, list):
        return data
    return data.get('categories', [])


def write_categories(data):
    with open(CATEGORIES_FILE, 'w', encoding='utf-8') as f:
        json.dump({"categories": data}, f, indent=2, ensure_ascii=False)


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
                os.makedirs(TEMPLATES_DIR, exist_ok=True)
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

        elif self.path == '/api/saved':
            try:
                os.makedirs(SAVED_DIR, exist_ok=True)
                files = sorted(
                    [f for f in os.listdir(SAVED_DIR) if f.endswith('.txt')],
                    key=lambda f: os.path.getmtime(os.path.join(SAVED_DIR, f)),
                    reverse=True
                )
                result = []
                for fname in files:
                    fpath = os.path.join(SAVED_DIR, fname)
                    with open(fpath, 'r', encoding='utf-8') as f:
                        first_line = f.readline().strip()
                    meta = {}
                    if first_line.startswith('##'):
                        for part in first_line[2:].split('|'):
                            k, _, v = part.partition(':')
                            meta[k.strip()] = v.strip()
                    result.append({
                        'filename':     fname,
                        'templateName': meta.get('template', fname.replace('.txt', '')),
                        'category':     meta.get('category', ''),
                        'savedAt':      meta.get('savedAt', ''),
                        'customName':   meta.get('customName', ''),
                    })
                self._respond(200, {'saved': result})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path == '/api/export':
            try:
                buf = io.BytesIO()
                os.makedirs(TEMPLATES_DIR, exist_ok=True)
                cfg_files = sorted(
                    [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.cfg')],
                    key=lambda f: os.path.getmtime(os.path.join(TEMPLATES_DIR, f))
                )
                with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for fname in cfg_files:
                        fpath = os.path.join(TEMPLATES_DIR, fname)
                        zf.write(fpath, arcname=fname)
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
        body   = self.rfile.read(length)

        if self.path == '/api/templates':
            try:
                data     = json.loads(body)
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

        elif self.path == '/api/saved':
            try:
                data          = json.loads(body)
                template_name = data.get('templateName', '').strip()
                category      = data.get('category', '').strip()
                content       = data.get('content', '').strip()
                saved_at      = data.get('savedAt', '').strip()
                custom_name   = data.get('customName', '').strip()
                filename      = os.path.basename(data.get('filename', '').strip())
                if not template_name or not content or not filename:
                    self._respond(400, {'error': 'templateName, filename y content son obligatorios'}); return
                if not filename.endswith('.txt'):
                    filename += '.txt'
                os.makedirs(SAVED_DIR, exist_ok=True)
                meta_line = (
                    f'## template:{template_name} | category:{category} | '
                    f'savedAt:{saved_at} | customName:{custom_name}\n'
                )
                with open(os.path.join(SAVED_DIR, filename), 'w', encoding='utf-8') as f:
                    f.write(meta_line + content)
                self._respond(200, {'ok': True, 'filename': filename})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path == '/api/categories':
            try:
                data  = json.loads(body)
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
                data      = json.loads(body)
                order     = data.get('order', [])
                cats      = read_categories()
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
            raw      = self.path[len('/api/templates/'):]
            filename = os.path.basename(unquote(raw, encoding='utf-8'))
            filepath = os.path.join(TEMPLATES_DIR, filename)
            try:
                if not os.path.exists(filepath):
                    self._respond(404, {'error': f'Archivo no encontrado: {filename}'}); return
                os.remove(filepath)
                self._respond(200, {'ok': True})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path.startswith('/api/saved/'):
            raw      = self.path[len('/api/saved/'):]
            filename = os.path.basename(unquote(raw, encoding='utf-8'))
            filepath = os.path.join(SAVED_DIR, filename)
            try:
                if not os.path.exists(filepath):
                    self._respond(404, {'error': f'Archivo no encontrado: {filename}'}); return
                os.remove(filepath)
                self._respond(200, {'ok': True})
            except Exception as e:
                self._respond(500, {'error': str(e)})

        elif self.path.startswith('/api/categories/'):
            raw    = self.path[len('/api/categories/'):]
            cat_id = unquote(raw, encoding='utf-8')
            try:
                cats = read_categories()
                if not any(c['id'] == cat_id for c in cats):
                    self._respond(404, {'error': f'Categoría no encontrada: {cat_id}'}); return
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
    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    os.makedirs(SAVED_DIR, exist_ok=True)
    read_categories()  # crea categories.json con defaults si no existe
    with http.server.HTTPServer(('', PORT), ScriptForgeHandler) as httpd:
        print(f"ScriptForge server → http://localhost:{PORT}")
        httpd.serve_forever()