

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/Scenes/ZombieRoad.scene');
const original = fs.readFileSync(file, 'utf8');
const scene = JSON.parse(original);
const ref = id => ({ __id__: id });
const vec = (x = 0, y = 0, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const size = (width, height) => ({ __type__: 'cc.Size', width, height });
const color = hex => {
    const s = hex.replace('#', '');
    return { __type__: 'cc.Color', r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: 255 };
};
function scriptType(relative) {
    const uuid = JSON.parse(fs.readFileSync(path.join(root, relative + '.meta'), 'utf8')).uuid.replace(/-/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = uuid.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(uuid.slice(i, i + 3), 16); result += chars[n >> 6] + chars[n & 63]; }
    return result;
}
const PLAYING_HUD = scriptType('assets/Scripts/game/presentation/PlayingHud.ts');
const HUD = scriptType('assets/Scripts/game/presentation/GameHud.ts');
const BOOT = scriptType('assets/Scripts/game/GameBootstrap.ts');

const frames = new Map();
(function scan(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) scan(full);
        else if (e.name.endsWith('.png.meta')) {
            const m = JSON.parse(fs.readFileSync(full, 'utf8'));
            for (const s of Object.values(m.subMetas || {})) if (s.importer === 'sprite-frame') frames.set(e.name.replace('.png.meta', ''), s.uuid);
        }
    }
})(path.join(root, 'assets'));
const frameRef = name => { assert.ok(frames.has(name), `Sprite ${name} missing`); return { __uuid__: frames.get(name), __expectedType__: 'cc.SpriteFrame' }; };
const panelFrame = frameRef('ui-panel');
const BATTERY = frameRef('Group-11');

assert.ok(!scene.some(o => o._name === 'TopHud'), 'TopHud already exists; edit it in Cocos instead');
const hud = scene.find(o => o.__type__ === HUD), boot = scene.find(o => o.__type__ === BOOT);
assert.ok(hud && boot && hud.gameLayer, 'GameHud/GameBootstrap not found');
const playing = hud.gameLayer.__id__;
assert.equal(scene[playing]._name, 'Playing');
const childNamed = name => scene[playing]._children.map(r => r.__id__).find(id => scene[id]._name === name);
const title = childNamed('Title'), status = childNamed('Status'), pause = childNamed('Pause');
assert.ok(title != null && status != null && pause != null, 'Playing/Title, Status or Pause missing');
assert.equal(hud.status?.__id__ !== undefined, true, 'GameHud.status expected');

const add = object => { scene.push(object); return scene.length - 1; };
function component(node, type, fields = {}) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...fields, _id: `playinghud-c-${scene.length}` });
    scene[node]._components.push(ref(id)); return id;
}
function node(parent, name, x, y, width, height, { active = true, anchorX = 0.5, anchorY = 0.5 } = {}) {
    const id = add({ __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x, y), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec(1, 1, 1), _mobility: 0, _layer: 33554432, _euler: vec(), _id: `playinghud-n-${scene.length}` });
    scene[parent]._children.push(ref(id));
    component(id, 'cc.UITransform', { _contentSize: size(width, height), _anchorPoint: { __type__: 'cc.Vec2', x: anchorX, y: anchorY } });
    return id;
}
function sprite(id, tint, frame = panelFrame, sliced = true) {
    return component(id, 'cc.Sprite', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _spriteFrame: frame, _type: sliced ? 1 : 0, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 }, _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null });
}
function panel(parent, name, x, y, w, h, tint, opts) { const id = node(parent, name, x, y, w, h, opts); sprite(id, tint); return id; }
function framed(parent, name, x, y, w, h, border, fill, thickness = 3, opts) {
    const outer = panel(parent, name, x, y, w, h, border, opts);
    const face = panel(outer, 'Fill', 0, 0, w - thickness * 2, h - thickness * 2, fill);
    return { node: outer, fill: face };
}
const INK = '#26352f', MUTED = '#7d8782', LINE = '#2f5b55';
function text(parent, name, value, x, y, w, h, fontSize, tint = INK, { align = 1, bold = false, active = true } = {}) {
    const id = node(parent, name, x, y, w, h, { active });
    return component(id, 'cc.Label', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _string: value, _horizontalAlign: align, _verticalAlign: 1, _actualFontSize: fontSize, _fontSize: fontSize, _fontFamily: 'Arial', _lineHeight: fontSize + 4, _overflow: 2, _enableWrapText: false, _font: null, _isSystemFontUsed: true, _spacingX: 0, _isBold: bold, _isItalic: false, _isUnderline: false, _cacheMode: 0 });
}

function booster(parent, name, title, x) {
    const box = framed(parent, name, x, 316, 150, 64, LINE, '#ffffff', 3);
    text(box.fill, name + 'Title', title, 0, 10, 136, 26, 20, INK, { bold: true });
    const count = text(box.fill, name + 'Count', '×1', 0, -16, 136, 20, 15, MUTED);
    component(box.node, 'cc.BlockInputEvents');
    const button = component(box.node, 'cc.Button', { clickEvents: [], _interactable: true, _transition: 3, _normalColor: color('#ffffff'), _hoverColor: color('#ffffff'), _pressedColor: color('#ffffff'), _disabledColor: color('#ffffff'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.94, _target: ref(box.node) });
    return { node: box.node, button, count };
}

const top = node(playing, 'TopHud', 0, 0, 1280, 720);
const time = text(top, 'TimeLabel', '3:00', -530, 340, 200, 20, 15, MUTED, { align: 0 });
const level = text(top, 'LevelLabel', 'Уровень 01', -530, 310, 200, 36, 28, INK, { align: 0, bold: true });

const battery = framed(top, 'BatteryPanel', -370, 316, 120, 64, LINE, '#ffffff', 3);
const icon = node(battery.fill, 'BatteryIcon', -34, 0, 24, 42);
sprite(icon, '#ffffff', BATTERY, false);
text(battery.fill, 'BatteryCount', '0/10', 16, 9, 76, 26, 20, INK, { bold: true });
text(battery.fill, 'BatteryCaption', 'Батарейки', 16, -16, 76, 18, 13, MUTED);

const progress = framed(top, 'ProgressPanel', -30, 316, 500, 72, LINE, '#ffffff', 3);
text(progress.fill, 'SavedTitle', 'Спасено', -130, 16, 220, 28, 22, INK, { align: 0 });
const saved = text(progress.fill, 'SavedLabel', '0 / 20', 160, 16, 140, 28, 22, INK, { align: 2, bold: true });
const track = panel(progress.fill, 'Track', 0, -10, 460, 14, '#dfe3d3');

const fill = panel(track, 'Fill', -230, 0, 0, 14, '#4fb39d', { anchorX: 0, active: false });
const mark = panel(progress.fill, 'TargetMark', -230 + 460 * 5 / 20, -10, 4, 24, INK);
const target = text(mark, 'TargetLabel', 'цель 5', 0, -21, 80, 16, 13, MUTED);

const slow = booster(top, 'SlowButton', 'Замедлить', 320);

const glow = panel(top, 'TeleportArmed', 478, 316, 164, 78, '#7ff0d9', { active: false });
const teleport = booster(top, 'TeleportButton', 'Телепорт', 478);

const hint = panel(playing, 'TeleportHint', 0, 236, 620, 44, '#2f5b55', { active: false });
text(hint, 'TeleportHintLabel', 'Нажми на зомби — он телепортируется на финиш. Esc — отмена', 0, 0, 600, 36, 19, '#ffffff', { bold: true });

const transformOf = id => scene[scene[id]._components.find(r => scene[r.__id__].__type__ === 'cc.UITransform').__id__];
scene[pause]._lpos = vec(600, 316);
transformOf(pause)._contentSize = size(64, 64);
const pauseLabel = scene[pause]._children.map(r => r.__id__).find(id => scene[id]._name === 'PauseLabel');
if (pauseLabel != null) {
    transformOf(pauseLabel)._contentSize = size(56, 56);
    const label = scene[scene[pauseLabel]._components.find(r => scene[r.__id__].__type__ === 'cc.Label').__id__];
    Object.assign(label, { _string: 'II', _fontSize: 30, _actualFontSize: 30, _lineHeight: 34, _isBold: true });
}

const comp = component(top, PLAYING_HUD, {
    levelLabel: ref(level), timeLabel: ref(time), savedLabel: ref(saved), targetLabel: ref(target),
    track: ref(scene[track]._components[0].__id__), fill: ref(scene[fill]._components[0].__id__), targetMark: ref(mark),
    slowButton: ref(slow.button), slowCount: ref(slow.count), teleportButton: ref(teleport.button), teleportCount: ref(teleport.count),
    teleportArmed: ref(glow), teleportHint: ref(hint),
    slowDuration: 5, slowFactor: 0.4, teleportDuration: 0.7, fillSpeed: 1.5,
});
boot.playingHud = ref(comp);

delete hud.status;
const drop = new Set();
(function dropTree(ids) {
    for (const id of ids) {
        drop.add(id);
        for (const c of scene[id]._components) drop.add(c.__id__);
        dropTree(scene[id]._children.map(c => c.__id__));
    }
})([title, status]);
scene[playing]._children = scene[playing]._children.filter(r => !drop.has(r.__id__));
const map = new Map(); let nextId = 0;
scene.forEach((_, i) => { if (!drop.has(i)) map.set(i, nextId++); });
function remap(value) {
    if (!value || typeof value !== 'object') return;
    if ('__id__' in value) { assert.ok(map.has(value.__id__), `Kept object references removed ${value.__id__}`); value.__id__ = map.get(value.__id__); return; }
    for (const v of Object.values(value)) remap(v);
}
const kept = scene.filter((_, i) => !drop.has(i));
for (const o of kept) for (const v of Object.values(o)) remap(v);

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-playing-hud');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(kept, null, 2) + '\n');
console.log(`TopHud authored; removed Title/Status (${drop.size} objects); backup ${path.relative(root, backup)}`);
