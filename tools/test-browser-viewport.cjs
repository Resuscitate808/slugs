const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../build-templates/web-mobile');
const source = fs.readFileSync(path.join(root, 'viewport.js'), 'utf8');
function fixture(visual, insets = {}) {
  const callbacks = new Map(), frames = [], vars = {};
  const frame = { style: {} };
  let resizeCount = 0;
  const target = prefix => ({ addEventListener(name, callback) { callbacks.set(prefix + name, callback); } });
  const window = Object.assign(target('window:'), {
    innerWidth: 1440, innerHeight: 760,
    getComputedStyle() { return { getPropertyValue: name => insets[name] || '0px' }; },
    visualViewport: visual ? Object.assign(target('visual:'), { width: 1440, height: 680, offsetLeft: 0, offsetTop: 0 }) : null,
    requestAnimationFrame(callback) { frames.push(callback); },
    dispatchEvent(event) { resizeCount++; callbacks.get('window:' + event.type)?.(); }
  });
  const document = Object.assign(target('document:'), {
    documentElement: { style: { setProperty(key, value) { vars[key] = value; } } },
    getElementById() { return frame; }
  });
  vm.runInNewContext(source, { window, document, Event: class { constructor(type) { this.type = type; } } });
  const flush = () => { let i = 0; while (frames.length) { assert.ok(i++ < 10, 'resize loop'); frames.shift()(); } };
  flush();
  return { window, vars, frame, flush, callbacks, get count() { return resizeCount; } };
}
const a = fixture(true);
assert.equal(a.vars['--game-height'], '680px');
assert.equal(a.frame.style.height, '680px');
assert.equal(a.count, 1);
a.window.visualViewport.height = 530.8;
a.window.visualViewport.offsetTop = 20;
a.callbacks.get('visual:resize')();
a.callbacks.get('visual:scroll')();
a.flush();
assert.equal(a.frame.style.height, '530px');
assert.equal(a.vars['--game-top'], '20px');
assert.equal(a.count, 2);
a.callbacks.get('visual:resize')(); a.flush(); assert.equal(a.count, 2);
a.window.visualViewport.height = 0;
a.callbacks.get('visual:resize')(); a.flush(); assert.equal(a.frame.style.height, '530px');
a.window.visualViewport.width = 390; a.window.visualViewport.height = 700;
a.callbacks.get('window:orientationchange')(); a.flush();
assert.equal(a.frame.style.width, '390px'); assert.equal(a.frame.style.height, '700px');
const before = a.count;
a.window.gameViewport.refresh();
assert.equal(a.count, before + 1, 'forced refresh dispatches resize even when size is unchanged');
assert.equal(a.frame.style.height, '700px');
const heights = [];
const baseCount = a.count;
a.callbacks.set('window:resize', () => heights.push(a.frame.style.height));
a.window.gameViewport.resync();
assert.equal(a.frame.style.height, '699px', 'resync really changes the frame size so Cocos sees a new style');
assert.deepEqual(heights, ['699px']);
a.flush();
assert.equal(a.frame.style.height, '700px', 'resync restores the visible height');
assert.deepEqual(heights, ['699px', '700px']);
assert.equal(a.count, baseCount + 2);
const mobile = fixture(true, { '--gesture-edge': '24px', '--gesture-bottom': '28px', '--safe-left': '44px' });
assert.equal(mobile.frame.style.width, '1372px');
assert.equal(mobile.frame.style.height, '640px');
assert.equal(mobile.vars['--game-left'], '44px');
assert.equal(mobile.vars['--game-top'], '12px');
mobile.window.visualViewport.width = 390;
mobile.window.visualViewport.height = 700;
mobile.callbacks.get('window:orientationchange')(); mobile.flush();
assert.equal(mobile.frame.style.width, '322px');
assert.equal(mobile.frame.style.height, '660px');
mobile.window.gameViewport.resync(); mobile.flush();
assert.equal(mobile.frame.style.height, '660px');
mobile.window.innerWidth = 390;
mobile.window.innerHeight = 700;
mobile.window.gameViewport.setMobile(true);
mobile.flush();
assert.equal(mobile.frame.style.width, '660px');
assert.equal(mobile.frame.style.height, '322px');
assert.equal(mobile.vars['--game-transform'], 'rotate(90deg)');
assert.equal(mobile.vars['--game-left'], '366px');
mobile.window.gameViewport.resync(); mobile.flush();
assert.equal(mobile.frame.style.height, '322px');
for (const [x, y] of [[0, 0], [660, 322], [120, 80]]) {
  const clientX = 366 - y, clientY = 12 + x;
  const rect = { x: 44, y: 12, width: 322, height: 660 };
  const cocosX = clientY - rect.y;
  const cocosY = clientX - rect.x;
  assert.equal(cocosX, x);
  assert.equal(cocosY, 322 - y);
}
mobile.window.innerWidth = 700; mobile.window.innerHeight = 390;
mobile.window.visualViewport.width = 700; mobile.window.visualViewport.height = 390;
mobile.callbacks.get('window:orientationchange')(); mobile.flush();
assert.equal(mobile.vars['--game-transform'], 'none');
assert.equal(mobile.frame.style.width, '632px');
assert.equal(mobile.frame.style.height, '350px');
const b = fixture(false);
assert.equal(b.frame.style.height, '760px');
b.window.innerWidth = 900; b.window.innerHeight = 500;
b.callbacks.get('window:resize')(); b.flush();
assert.equal(b.frame.style.width, '900px'); assert.equal(b.frame.style.height, '500px');
const html = fs.readFileSync(path.join(root, 'index.ejs'), 'utf8');
assert.ok(html.includes('src="viewport.js"'));
assert.ok(html.includes('cc_exact_fit_screen="false"'));
assert.ok(!/#Cocos3dGameContainer, #GameCanvas\s*\{[^}]*\b(?:vh|dvh)\b/s.test(html));
let Application, configuration, ran = false, refreshes = 0, resyncs = 0, sceneHandler = null;
const timers = [];
vm.runInNewContext(fs.readFileSync(path.join(root, 'application.js'), 'utf8'), {
  window: { gameViewport: { refresh() { refreshes++; }, resync() { resyncs++; } } },
  setTimeout(fn, ms) { timers.push({ fn, ms }); },
  System: { register(deps, factory) { factory((name, value) => { Application = value; }).execute(); } }
});
const application = new Application();
const delegate = { add() {} };
application.init({ DebugMode: { ERROR: 0 }, Director: { EVENT_AFTER_SCENE_LAUNCH: 'launch' },
  director: { once(name, fn) { assert.equal(name, 'launch'); sceneHandler = fn; } }, game: {
  onPostBaseInitDelegate: delegate, onPostSubsystemInitDelegate: delegate,
  init(config) { configuration = config; return Promise.resolve(); },
  run() { ran = true; }
} });
application.start().then(() => {
  assert.equal(configuration.overrideSettings.screen.exactFitScreen, false);
  assert.equal(configuration.overrideSettings.screen.orientation, 'landscape');
  assert.equal(configuration.settingsPath, 'src/settings.json');
  assert.equal(ran, true);
  assert.equal(refreshes, 1, 'viewport refreshed right after cc.game.run');
  sceneHandler();
  assert.equal(resyncs, 1, 'real resize cycle after the first scene launch');
  assert.equal(timers.length, 1);
  timers[0].fn();
  assert.equal(resyncs, 2, 'late resync catches layout settling');
  console.log('PASS browser viewport: visible area, resize, orientation, offsets, fallback, zero size, no event loop, resync, Cocos startup contract');
}).catch(error => { console.error(error); process.exitCode = 1; });
