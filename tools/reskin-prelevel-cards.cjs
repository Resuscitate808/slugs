

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/Scenes/ZombieRoad.scene');
const original = fs.readFileSync(file, 'utf8');
const scene = JSON.parse(original);
const ref = id => ({ __id__: id });
function scriptType(relative) {
    const uuid = JSON.parse(fs.readFileSync(path.join(root, relative + '.meta'), 'utf8')).uuid.replace(/-/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = uuid.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(uuid.slice(i, i + 3), 16); result += chars[n >> 6] + chars[n & 63]; }
    return result;
}

const frames = new Map();
(function scan(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) scan(full);
        else if (e.name.endsWith('.png.meta')) {
            const m = JSON.parse(fs.readFileSync(full, 'utf8'));
            for (const s of Object.values(m.subMetas || {})) if (s.importer === 'sprite-frame')
                frames.set(s.uuid, { name: e.name.replace('.png.meta', ''), w: s.userData.rawWidth, h: s.userData.rawHeight });
        }
    }
})(path.join(root, 'assets'));
const frameRef = name => {
    const hit = [...frames].filter(([, f]) => f.name === name);
    assert.equal(hit.length, 1, `Sprite ${name} must exist exactly once`);
    return { __uuid__: hit[0][0], __expectedType__: 'cc.SpriteFrame' };
};
const NORMAL = frameRef('Vector-2'), SELECTED = frameRef('Vector-3'), ROBOT = frameRef('Group-10'), BATTERY = frameRef('Group-11');
const sizeOf = r => frames.get(r.__uuid__);

const CARD = scriptType('assets/Scripts/game/presentation/PreLevelCard.ts');
const WINDOW = scriptType('assets/Scripts/game/presentation/PreLevelWindow.ts');
const win = scene.find(o => o.__type__ === WINDOW);
assert.ok(win, 'PreLevelWindow not found');
const preLevel = win.node.__id__;
const comps = id => scene[id]._components.map(r => r.__id__);
const comp = (id, type) => comps(id).find(c => scene[c].__type__ === type);
const child = (id, name) => scene[id]._children.map(r => r.__id__).find(c => scene[c]._name === name);
const setSize = (id, w, h) => { const t = scene[comp(id, 'cc.UITransform')]; t._contentSize = { __type__: 'cc.Size', width: w, height: h }; };
const plainSprite = (spriteId, frame) => Object.assign(scene[spriteId], { _spriteFrame: frame, _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 }, _type: 0, _sizeMode: 0 });
function inside(id, top) { for (let p = id; p != null; p = scene[p]._parent?.__id__) if (p === top) return true; return false; }

const cards = scene.map((o, i) => o.__type__ === CARD ? i : -1).filter(i => i >= 0);
assert.ok(cards.length > 0, 'No PreLevelCard');
assert.ok(cards.some(c => child(scene[c].node.__id__, 'SelectedRing') != null), 'Already applied (no SelectedRing); edit PreLevel in Cocos instead');

const drop = new Set();
function dropTree(id) {
    drop.add(id);
    for (const c of comps(id)) drop.add(c);
    for (const r of scene[id]._children) dropTree(r.__id__);
}

const CW = 136, CH = 160, PIC_W = 110, PIC_H = 76;
cards.forEach((c, index) => {
    const card = scene[c], cardNode = card.node.__id__;
    assert.ok(inside(cardNode, preLevel), 'Card outside PreLevel');
    const ring = child(cardNode, 'SelectedRing');
    if (ring != null) dropTree(ring);
    const body = child(cardNode, 'Body'); assert.ok(body != null, 'Card Body missing');
    const fill = child(body, 'Fill'); if (fill != null) dropTree(fill);
    const bodySprite = comp(body, 'cc.Sprite'); assert.ok(bodySprite != null);
    plainSprite(bodySprite, index === 0 ? SELECTED : NORMAL);
    setSize(body, CW, CH); setSize(cardNode, CW, CH);
    const picture = child(cardNode, 'Picture'); assert.ok(picture != null, 'Card Picture missing');
    const pic = scene[comp(picture, 'cc.Sprite')];
    pic._sizeMode = 0;
    const raw = pic._spriteFrame && sizeOf(pic._spriteFrame);
    const k = raw ? Math.min(PIC_W / raw.w, PIC_H / raw.h) : 1;
    setSize(picture, raw ? Math.round(raw.w * k) : PIC_H, raw ? Math.round(raw.h * k) : PIC_H);
    scene[picture]._lpos.y = 10;
    card.body = ref(bodySprite);
    card.pictureTransform = ref(comp(picture, 'cc.UITransform'));
    delete card.selectedRing;
});

const grid = scene[cards[0]].node && scene[scene[cards[0]].node.__id__]._parent.__id__;
const layout = scene[comp(grid, 'cc.Layout')];
const viewW = scene[comp(grid, 'cc.UITransform')]._contentSize.width;
const cols = layout._constraintNum || 5;
layout._cellSize = { __type__: 'cc.Size', width: CW, height: CH };
layout._spacingX = Math.floor((viewW - layout._paddingLeft - layout._paddingRight - cols * CW) / (cols - 1));
scene[grid]._children.forEach((r, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    scene[r.__id__]._lpos.x = -viewW / 2 + layout._paddingLeft + CW / 2 + col * (CW + layout._spacingX);
    scene[r.__id__]._lpos.y = -(layout._paddingTop + CH / 2 + row * (CH + layout._spacingY));
});
Object.assign(win, { cardFrame: NORMAL, selectedCardFrame: SELECTED, pictureMaxWidth: PIC_W, pictureMaxHeight: PIC_H });

const named = name => scene.map((o, i) => o.__type__ === 'cc.Node' && o._name === name && inside(i, preLevel) ? i : -1).filter(i => i >= 0);
const [robot] = named('Robot'), [battery] = named('Battery');
assert.ok(robot != null && battery != null, 'Robot/Battery missing');
for (const r of scene[robot]._children) dropTree(r.__id__);
plainSprite(comp(robot, 'cc.Sprite'), ROBOT); setSize(robot, sizeOf(ROBOT).w, sizeOf(ROBOT).h);
plainSprite(comp(battery, 'cc.Sprite'), BATTERY); setSize(battery, sizeOf(BATTERY).w, sizeOf(BATTERY).h);

for (const o of scene) if (o && o._children) o._children = o._children.filter(r => !drop.has(r.__id__));
const map = new Map(); let next = 0;
scene.forEach((_, i) => { if (!drop.has(i)) map.set(i, next++); });
function remap(value) {
    if (!value || typeof value !== 'object') return;
    if ('__id__' in value) { assert.ok(map.has(value.__id__), `Kept object references removed ${value.__id__}`); value.__id__ = map.get(value.__id__); return; }
    for (const v of Object.values(value)) remap(v);
}
const kept = scene.filter((_, i) => !drop.has(i));
for (const o of kept) for (const v of Object.values(o)) remap(v);

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-prelevel-sprites');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(kept, null, 2) + '\n');
console.log(`PreLevel sprites applied: ${cards.length} cards, removed ${drop.size} objects, spacingX ${layout._spacingX}; backup ${path.relative(root, backup)}`);
