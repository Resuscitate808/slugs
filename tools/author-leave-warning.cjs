const fs = require('node:fs');
const crypto = require('node:crypto');
const file = '../assets/Scenes/ZombieRoad.scene';
const raw = fs.readFileSync(file, 'utf8');
const s = JSON.parse(raw);
if (s.some(n => n._name === 'LeaveWarning')) throw Error('LeaveWarning already exists');
const copy = x => JSON.parse(JSON.stringify(x));
const ref = i => ({ __id__: i });
const add = x => (s.push(x), s.length - 1);
const template = type => s.find(c => c.__type__ === type);
const canvas = s.findIndex(n => n.__type__ === 'cc.Node' && n._name === 'GameUI');
const dark = [27, 67, 75], cream = [255, 251, 237];
const color = (rgb, a = 255) => ({ __type__: 'cc.Color', r: rgb[0], g: rgb[1], b: rgb[2], a });
function component(n, type, props = {}) {
    const c = { ...copy(template(type) || { __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, _enabled: true, __prefab: null }), ...props, node: ref(n), _id: crypto.randomUUID() };
    const i = add(c); s[n]._components.push(ref(i)); return i;
}
function node(parent, name, x, y, w, h) {
    const n = copy(s[canvas]);
    Object.assign(n, { _name: name, _parent: ref(parent), _children: [], _components: [], _active: true, _id: crypto.randomUUID(), _lpos: { __type__: 'cc.Vec3', x, y, z: 0 } });
    const i = add(n); s[parent]._children.push(ref(i));
    component(i, 'cc.UITransform', { _contentSize: { __type__: 'cc.Size', width: w, height: h }, _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } });
    return i;
}
function sprite(n, rgb) { return component(n, 'cc.Sprite', { _color: color(rgb), _type: 1, _sizeMode: 0 }); }
function label(parent, name, value, x, y, w, h, size, bold = false, align = 1, rgb = dark) {
    const n = node(parent, name, x, y, w, h);
    component(n, 'cc.Label', { _string: value, _fontSize: size, _actualFontSize: size, _lineHeight: size + 10, _horizontalAlign: align, _verticalAlign: 1, _overflow: 2, _isBold: bold, _color: color(rgb), _font: null, _isSystemFontUsed: true });
    return n;
}
function button(parent, name, value, x, y, w, h, rgb, size = 28) {
    const n = node(parent, name, x, y, w, h); sprite(n, dark);
    const fill = node(n, 'Fill', 0, 2, w - 5, h - 7); sprite(fill, rgb);
    label(fill, 'Label', value, 0, 0, w - 16, h - 12, size, true);
    return component(n, 'cc.Button', { _target: ref(n), clickEvents: [], _interactable: true, _transition: 3, _zoomScale: 0.98 });
}
const root = node(canvas, 'LeaveWarning', 0, 0, 1280, 720);
component(root, 'cc.BlockInputEvents');
component(root, 'cc.Widget', { _alignFlags: 45, _target: null, _left: 0, _right: 0, _top: 0, _bottom: 0 });
const shade = node(root, 'Shade', 0, 0, 1280, 720);
const shadeSprite = sprite(shade, dark); s[shadeSprite]._color.a = 80;
component(shade, 'cc.Widget', { _alignFlags: 45, _target: null, _left: 0, _right: 0, _top: 0, _bottom: 0 });
const panel = node(root, 'Dialog', 0, 0, 1000, 660); sprite(panel, dark);
const fill = node(panel, 'Fill', 0, 0, 994, 654); sprite(fill, cream);
label(fill, 'Title', 'Оставить этих слизней?', -42, 280, 840, 54, 34, true, 0);
label(fill, 'Description', 'Невоскрешённые слизни будут потеряны навсегда.\nМожно вернуться и спасти их перед уходом.', 0, 175, 870, 100, 27, false, 0);
const dismiss = button(fill, 'Close', '×', 442, 280, 58, 58, cream, 32);
const back = button(fill, 'Back', 'Вернуться', -240, -206, 418, 86, [214, 241, 123]);
const confirm = button(fill, 'Confirm', 'Уйти без них', 220, -206, 444, 86, [255, 171, 141]);
label(fill, 'Footer', 'Если сбитых не осталось, это окно пропускается.', 0, -286, 890, 38, 22, false, 1, [102, 128, 132]);
const scrollNode = node(fill, 'FallenScroll', 0, -6, 860, 240);
const view = node(scrollNode, 'View', 0, 0, 860, 240); component(view, 'cc.Mask');
const contentNode = node(view, 'Content', 0, 120, 840, 240);
const content = s[contentNode]._components[0].__id__;
s[content]._anchorPoint.y = 1;
const scroll = component(scrollNode, 'cc.ScrollView', { _content: ref(contentNode), horizontal: false, vertical: true, _horizontalScrollBar: null, _verticalScrollBar: null, scrollEvents: [] });
const pictures = [], transforms = [];
for (let i = 0; i < 100; i++) {
    const n = node(contentNode, 'Slug' + (i + 1), (i % 5 - 2) * 160, -60 - Math.floor(i / 5) * 120, 110, 86);
    transforms.push(s[n]._components[0]);
    pictures.push(ref(component(n, 'cc.Sprite', { _color: color([255, 255, 255]), _type: 0, _sizeMode: 0, _spriteFrame: null })));
    s[n]._active = false;
}
const uuid = JSON.parse(fs.readFileSync('../assets/Scripts/game/presentation/LeaveWarning.ts.meta')).uuid;
const hex = uuid.replaceAll('-', ''), chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let type = hex.slice(0, 5);
for (let i = 5; i < 32; i += 3) { const n = parseInt(hex.slice(i, i + 3), 16); type += chars[n >> 6] + chars[n & 63]; }
const controller = component(root, type, { back: ref(back), dismiss: ref(dismiss), confirm: ref(confirm), scroll: ref(scroll), content: ref(content), pictures, transforms });
s.find(c => c.preLevel && c.postLevel).leaveWarning = ref(controller);
s.find(c => c.lostFooter !== undefined).lostFooter = 'Невоскрешённые слизни будут потеряны даже при повторе.';
s[root]._active = false;
fs.mkdirSync('../.sharrowkin', { recursive: true });
fs.writeFileSync('../.sharrowkin/ZombieRoad.scene.before-leave-warning-' + Date.now(), raw);
fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
console.log('PASS authored GameUI/LeaveWarning, 100 scene slots, scroll, modal blocker, three buttons, bootstrap reference');
