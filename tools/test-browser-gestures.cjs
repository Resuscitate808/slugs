const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '../build-templates/web-mobile');
const handlers = new Map();
vm.runInNewContext(fs.readFileSync(path.join(root, 'gestures.js'), 'utf8'), {
  document: { addEventListener(name, callback, options) { assert.equal(options.passive, false); assert.equal(options.capture, true); handlers.set(name, callback); } }
});
for (const name of ['touchstart', 'touchmove', 'gesturestart', 'gesturechange', 'gestureend']) {
  for (const inside of [true, false]) for (const cancelable of [true, false]) {
    let prevented = false;
    const event = { target: { closest: () => inside }, cancelable, preventDefault() { prevented = true; }, stopPropagation() { assert.fail('game events must propagate'); } };
    handlers.get(name)(event);
    assert.equal(prevented, inside && cancelable);
  }
}
const html = fs.readFileSync(path.join(root, 'index.ejs'), 'utf8');
assert.ok(html.includes('src="gestures.js"'));
assert.match(html, /touch-action: none/);
assert.match(html, /overscroll-behavior: none/);
assert.match(html, /any-pointer: coarse/);
assert.match(html, /--gesture-edge: 24px/);
assert.match(html, /--gesture-bottom: 28px/);
console.log('PASS browser gesture guards: cancelable game touches blocked, Cocos propagation preserved, outside controls untouched, safe-edge CSS');
