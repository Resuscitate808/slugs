

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/Scenes/ZombieRoad.scene');
const original = fs.readFileSync(file, 'utf8');
const scene = JSON.parse(original);
const ref = id => ({ __id__: id });
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
const POST = scriptType('assets/Scripts/game/presentation/PostLevelWindow.ts');
const post = scene.find(o => o.__type__ === POST);
assert.ok(post, 'PostLevelWindow not found');
assert.ok(!post.headerBackground, 'Already wired; edit it in Cocos instead');
const childNamed = (id, name) => scene[id]._children.map(r => r.__id__).find(c => scene[c]._name === name);
const comp = (id, type) => scene[id]._components.map(r => r.__id__).find(c => scene[c].__type__ === type);

const win = post.node.__id__;
const header = childNamed(win, 'Header');
assert.ok(header !== undefined, 'PostLevel/Header not found');
const headerFill = childNamed(header, 'Fill');
const headerSprite = comp(headerFill, 'cc.Sprite');
assert.ok(headerSprite !== undefined, 'Header/Fill sprite not found');
const nextNode = scene[post.nextButton.__id__].node.__id__;
const nextFill = childNamed(nextNode, 'Fill');
const nextLabelNode = childNamed(nextFill, 'NextLabel');
const nextLabel = comp(nextLabelNode, 'cc.Label');
assert.ok(nextLabel !== undefined, 'Next/Fill/NextLabel not found');

Object.assign(post, {
    wonTitle: 'ПАРТИЯ ДОСТАВЛЕНА!', lostTitle: 'НЕ ВСЕ ДОБРАЛИСЬ',
    headerBackground: ref(headerSprite), wonHeaderColor: color('#c8e57a'), lostHeaderColor: color('#ffab8d'),
    nextLabel: ref(nextLabel), wonButtonText: 'Дальше', lostButtonText: 'Повторить',
});

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-postlevel-result');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`PostLevel wired: header sprite ${headerSprite}, next label ${nextLabel}; backup ${path.relative(root, backup)}`);
