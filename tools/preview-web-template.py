from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / 'build/web-mobile'
TEMPLATE = ROOT / 'build-templates/web-mobile'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BUILD), **kwargs)

    def do_GET(self):
        route = self.path.split('?', 1)[0]
        if route in ('/', '/index.html'):
            built = (BUILD / 'index.html').read_text(encoding='utf-8')
            bootstrap = built[built.index('<!-- Polyfills bundle. -->'):built.rindex('</body>')]
            html = (TEMPLATE / 'index.ejs').read_text(encoding='utf-8')
            html = html.replace('<%= projectName %>', 'Zombie Road — viewport preview')
            html = html.replace('<%- include(cocosTemplate, {}) %>', bootstrap)
            if 'inspect' in self.path:
                html = html.replace('</head>', '''<script>
window.previewErrors = [];
window.addEventListener('error', event => window.previewErrors.push(event.message || 'resource failed'));
window.addEventListener('unhandledrejection', event => window.previewErrors.push(String(event.reason)));
</script></head>''')
                html = html.replace('</body>', '''<output id="viewport-check" style="position:fixed;bottom:0;left:0;background:#fff;color:#111;padding:12px;z-index:99;font:16px Arial"></output>
<script>
setInterval(function () {
  var viewport = window.visualViewport;
  var width = viewport ? viewport.width : innerWidth;
  var height = viewport ? viewport.height : innerHeight;
  var frame = document.getElementById('GameDiv').getBoundingClientRect();
  var canvas = document.getElementById('GameCanvas').getBoundingClientRect();
  var style = getComputedStyle(document.documentElement);
  var expectedWidth = parseFloat(style.getPropertyValue('--game-width'));
  var expectedHeight = parseFloat(style.getPropertyValue('--game-height'));
  var match = Math.abs(frame.width - expectedWidth) < 1 && Math.abs(frame.height - expectedHeight) < 1
    && Math.abs(canvas.width - frame.width) < 1 && Math.abs(canvas.height - frame.height) < 1
    && frame.left >= 0 && frame.top >= 0 && frame.right <= width + 1 && frame.bottom <= height + 1;
  document.getElementById('viewport-check').textContent = (match ? 'Размер контейнера совпадает' : 'ОШИБКА РАЗМЕРА') +
    ' | Область: ' + Math.floor(width) + ' × ' + Math.floor(height) +
    ' | Canvas: ' + Math.round(canvas.width) + ' × ' + Math.round(canvas.height) +
    ' | Ошибки: ' + (window.previewErrors.join('; ') || 'нет') +
    ' | ' + (document.getElementById('loader-container') ? 'Загрузчик виден' : 'Загрузчик скрыт');
}, 300);
</script></body>''')
            self.respond(html.encode('utf-8'), 'text/html; charset=utf-8')
        elif route in ('/viewport.js', '/application.js', '/fullscreen.js', '/gestures.js'):
            self.respond((TEMPLATE / route[1:]).read_bytes(), 'application/javascript')
        elif route == '/manifest.webmanifest':
            self.respond((TEMPLATE / route[1:]).read_bytes(), 'application/manifest+json')
        else:
            super().do_GET()

    def respond(self, data, content_type):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    if not (BUILD / 'index.html').is_file():
        raise SystemExit('Build web-mobile in Cocos Creator before previewing the template.')
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    print(f'http://127.0.0.1:{server.server_port}', flush=True)
    server.serve_forever()
