const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../build-templates/web-mobile');
const source = fs.readFileSync(path.join(root, 'fullscreen.js'), 'utf8');

function fixture({ search = '', embedded = false, api = true } = {}) {
  const listeners = new Map();
  const on = (key, fn) => { (listeners.get(key) || listeners.set(key, []).get(key)).push(fn); };
  const off = (key, fn) => { const list = listeners.get(key) || []; const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); };
  const fire = key => (listeners.get(key) || []).slice().forEach(fn => fn({ stopPropagation() {} }));
  let requests = 0, lastOptions = null, button = null;
  const document = {
    fullscreenElement: null,
    fullscreenEnabled: api,
    body: { appendChild(el) { button = el; } },
    createElement() {
      return { style: {}, attrs: {}, handlers: {}, setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener(name, fn) { this.handlers[name] = fn; } };
    },
    addEventListener(name, fn) { on('doc:' + name, fn); },
    exitFullscreen() { document.fullscreenElement = null; fire('doc:fullscreenchange'); return Promise.resolve(); }
  };
  document.documentElement = api ? {
    requestFullscreen(options) {
      requests++; lastOptions = options;
      document.fullscreenElement = document.documentElement; fire('doc:fullscreenchange');
      return Promise.resolve();
    }
  } : {};
  const window = {
    location: { search },
    screen: { orientation: { lock() { return Promise.reject(new Error('unsupported')); } } },
    addEventListener(name, fn) { on('win:' + name, fn); },
    removeEventListener(name, fn) { off('win:' + name, fn); }
  };
  window.self = window; window.top = embedded ? {} : window;
  vm.runInNewContext(source, { window, document, URLSearchParams, Promise });
  return { window, document, fire, get button() { return button; }, get requests() { return requests; }, get options() { return lastOptions; } };
}

const tick = () => new Promise(r => setImmediate(r));

(async () => {
  const n = fixture();
  n.fire('win:pointerup'); await tick();
  assert.equal(n.requests, 0, 'no automatic fullscreen by default');
  assert.equal(n.button.style.display, 'flex');

  const a = fixture({ search: '?fullscreen=auto' });
  assert.equal(a.button.style.display, 'flex');
  assert.equal(a.button.attrs['aria-label'], 'Во весь экран');
  a.fire('win:pointerup'); await tick();
  assert.equal(a.requests, 1);
  assert.equal(a.options.navigationUI, 'hide');
  assert.equal(a.button.style.display, 'none');
  a.document.exitFullscreen(); await tick();
  assert.equal(a.button.style.display, 'flex');
  a.fire('win:pointerup'); await tick();
  assert.equal(a.requests, 1, 'auto request only once, Escape is respected');
  a.button.handlers.click({ stopPropagation() {} }); await tick();
  assert.equal(a.requests, 2, 'button re-enters fullscreen');

  const b = fixture({ search: '?fullscreen=0' });
  b.fire('win:pointerup'); await tick();
  assert.equal(b.requests, 0);
  assert.equal(b.button.style.display, 'none');

  const c = fixture({ search: '?fullscreen=auto', embedded: true });
  c.fire('win:pointerup'); await tick();
  assert.equal(c.requests, 0, 'no auto request inside platform iframe');
  assert.equal(c.button.style.display, 'flex');

  const d = fixture({ api: false });
  d.fire('win:pointerup'); await tick();
  assert.equal(d.button.style.display, 'none', 'hidden where the API is missing (iPhone Safari)');

  const html = fs.readFileSync(path.join(root, 'index.ejs'), 'utf8');
  assert.ok(html.indexOf('src="viewport.js"') < html.indexOf('src="fullscreen.js"'));
  assert.ok(html.includes('rel="manifest" href="manifest.webmanifest"'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'fullscreen');
  assert.ok(fs.readFileSync(path.join(root, 'viewport.js'), 'utf8').includes('webkitfullscreenchange'));
  console.log('PASS browser fullscreen: no auto by default, ?fullscreen=auto first gesture, navigationUI hide, Escape respected, button, opt-out, iframe, no API, manifest');
})().catch(error => { console.error(error); process.exitCode = 1; });
