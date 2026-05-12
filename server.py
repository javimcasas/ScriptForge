import http.server
import os
import json

PORT = 5500
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates')

class ScriptForgeHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        if self.path == '/api/templates':
            try:
                files = [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.cfg')]
                self._respond(200, {'files': sorted(files)})
            except Exception as e:
                self._respond(500, {'error': str(e)})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/templates':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                filename = data.get('filename', '').strip()
                content  = data.get('content', '').strip()

                if not filename or not content:
                    self._respond(400, {'error': 'filename y content son obligatorios'})
                    return
                if not filename.endswith('.cfg'):
                    filename += '.cfg'
                filename = os.path.basename(filename)
                filepath = os.path.join(TEMPLATES_DIR, filename)

                os.makedirs(TEMPLATES_DIR, exist_ok=True)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)

                self._respond(200, {'ok': True, 'filename': filename})
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
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"  {' '.join(str(a) for a in args)}")

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with http.server.HTTPServer(('', PORT), ScriptForgeHandler) as httpd:
        print(f"ScriptForge server → http://localhost:{PORT}")
        httpd.serve_forever()