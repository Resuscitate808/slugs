const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const scene = JSON.parse(read('assets/Scenes/ZombieRoad.scene'));
const before = JSON.parse(JSON.parse(read('.sharrowkin/ui-before-nine-slice.json')).scene);
const comps = n => n._components.map(r => scene[r.__id__]);
const underUI = n => n?._name === 'GameUI' || (n?._parent && underUI(scene[n._parent.__id__]));
for (const name of ['panel', 'Vector-2', 'Vector-3', 'Green_Button', 'Menu_Button', 'Long_Button', 'Pause_continue_Vector', 'Pause_restart_Vector']) {
    const meta = JSON.parse(read(`assets/Sprites/Menu/${name}.png.meta`));
    const frame = Object.values(meta.subMetas).find(s => s.importer === 'sprite-frame');
    const d = frame.userData;
    assert.ok(d.borderLeft > 0 && d.borderRight > 0 && d.borderTop > 0 && d.borderBottom > 0, name);
    assert.ok(d.borderLeft + d.borderRight < d.width && d.borderTop + d.borderBottom < d.height, name);
    for (const s of scene.filter(s => s.__type__ === 'cc.Sprite' && s._spriteFrame?.__uuid__ === frame.uuid && underUI(scene[s.node.__id__]))) assert.equal(s._type, 1, name);
}
for (const [i, c] of scene.entries()) {
    if (c.__type__ === 'cc.Sprite' && underUI(scene[c.node.__id__])) assert.equal(c._sizeMode, 0);
    if (before[i]?.__type__ === 'cc.UITransform') assert.deepEqual(c._contentSize, before[i]._contentSize, 'Preserve authored dimensions ' + i);
    if (c.__type__ === 'cc.Label') { assert.equal(c._fontSize, before[i]._fontSize); assert.deepEqual(c._font, before[i]._font); }
}
for (const name of ['LevelComolete', 'LevelFailed']) {
    const n = scene.find(n => n.__type__ === 'cc.Node' && n._name === name);
    assert.equal(n._lscale.x, 1); assert.equal(n._lscale.y, 1);
    const w = comps(n).find(c => c.__type__ === 'cc.Widget');
    assert.equal(w._alignFlags, 45); assert.equal(w._alignMode, 2);
    const exit = scene[n._children.find(r => scene[r.__id__]._name === 'Exit').__id__];
    const t = comps(exit).find(c => c.__type__ === 'cc.UITransform');
    assert.ok(exit._lpos.x + t._contentSize.width * exit._lscale.x / 2 < 640);
}
const ts = require('typescript');
const fit = { exports: {} };
new Function('exports', ts.transpileModule(read('assets/Scripts/game/presentation/ScreenFit.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(fit.exports);
for (const [w, h] of [[1920,1080], [1024,768], [2560,1080], [1366,768], [844,390]]) {
    const v = fit.exports.visibleSizeFor(w,h);
    assert.ok(v.width >= 1280 && v.height >= 720);
    assert.ok(Math.abs(w / v.width - h / v.height) < 0.00001);
}
console.log('PASS UI nine-slice: borders, Sliced/Custom, authored dimensions/fonts, result window fit, 16:9/4:3/ultrawide/mobile proportions');
