const fs = require('node:fs');
const crypto = require('node:crypto');
const file = '../assets/Scenes/ZombieRoad.scene';
const raw = fs.readFileSync(file, 'utf8');
const s = JSON.parse(raw);
const uuid = 'bd472d82-3472-4e41-9c68-382895b10ac4';
if (s.some(c => c.__type__ === uuid)) throw Error('Already authored');
const ref = i => ({ __id__: i });
const clone = value => JSON.parse(JSON.stringify(value));
const comp = (i, type) => s[s[i]._components.find(r => s[r.__id__].__type__ === type).__id__];
const add = value => { const i = s.length; s.push(value); return i; };
function component(i, type, props) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(i), _enabled: true, __prefab: null, ...props, _id: crypto.randomUUID() });
    s[i]._components.push(ref(id)); return id;
}
function nodeFrom(source, parent, name) {
    const n = clone(s[source]); n._name = name; n._parent = ref(parent); n._children = []; n._components = []; n._id = crypto.randomUUID();
    const i = add(n); s[parent]._children.push(ref(i));
    for (const r of s[source]._components) {
        const c = clone(s[r.__id__]); c.node = ref(i); c._id = crypto.randomUUID();
        n._components.push(ref(add(c)));
    }
    return i;
}
function box(i, x, y, w, h) {
    Object.assign(s[i]._lpos, { x, y, z: 0 });
    Object.assign(comp(i, 'cc.UITransform')._contentSize, { width: w, height: h });
}
function text(i, value, size, align = 1) {
    const c = comp(i, 'cc.Label'); c._string = value; c._fontSize = size; c._lineHeight = size + 8; c._horizontalAlign = align; c._overflow = 2;
}
function button(i) {
    const c = clone(s[2065]); c.node = ref(i); c._target = ref(i); c._transition = 0; c._id = crypto.randomUUID();
    const id = add(c); s[i]._components.push(ref(id)); return id;
}
if (s[1996]._name !== 'NotEnoughCoins' || s[2049]._name !== 'Battery') throw Error('Scene changed');
box(2054, 0, 0, 1000, 636); box(2055, 0, 0, 994, 630);
comp(2054, 'cc.Sprite')._color = { __type__: 'cc.Color', r: 27, g: 67, b: 75, a: 255 };
comp(2055, 'cc.Sprite')._color = { __type__: 'cc.Color', r: 255, g: 251, b: 237, a: 255 };
box(2056, -220, 267, 480, 48); text(2056, 'Генератор батареек', 32, 0);
box(2059, 447, 267, 55, 55);
box(2066, 72, 194, 300, 40); box(2067, 0, 0, 296, 36); box(2068, 0, 0, 280, 32); text(2068, 'Монеты 0', 20);
const robot = nodeFrom(908, 2055, 'Robot'); box(robot, -286, 48, 250, 245);
box(2092, 72, 140, 450, 52); text(2092, 'Готово 60 монет', 32);
const timer = nodeFrom(2092, 2055, 'Timer'); box(timer, 72, 76, 490, 40); text(timer, 'Можно забрать сейчас', 23);
const rate = nodeFrom(2092, 2055, 'Rate'); box(rate, 72, 25, 450, 36); text(rate, '60 монет раз в 6 часов', 23);
s[2075]._active = false;
s[2082]._name = 'Claim'; box(2082, 72, -88, 390, 78); box(2083, 0, 0, 370, 70); text(2083, 'Забрать · 60 монет', 26);
s[2089]._active = true; box(2089, 0, -230, 880, 90);
text(2089, 'Генератор заряжается и вне игры. Сбор раз в 6 часов.\nМонеты не накапливаются сверх одной награды.', 23, 0);
text(2039, 'Забери монеты у генератора или вернись\nи продай доставленного слизня.\nТекущий результат сохранится.', 25, 0);
box(2003, -55, 247, 590, 44); box(2015, 0, 0, 330, 30);
const hudButton = button(59), preButton = button(911), robotButton = button(908);
const labelId = i => s[i]._components.find(r => s[r.__id__].__type__ === 'cc.Label');
const controller = component(2049, uuid, {
    insufficient: ref(1996), shortage: ref(2005), required: ref(2017), back: ref(2028), dismiss: ref(2012), toBattery: ref(2035),
    battery: ref(2049), closeBattery: ref(2065), claim: ref(2088), balance: ref(2070), status: ref(2094), timer: labelId(timer), claimText: ref(2085),
    openButtons: [ref(hudButton), ref(preButton), ref(robotButton)], readinessLabels: [ref(66), labelId(914)]
});
s.find(c => c.preLevel && c.postLevel).economy = ref(controller);
s[1996]._active = false; s[2049]._active = false;
fs.mkdirSync('../.sharrowkin', { recursive: true });
fs.writeFileSync('../.sharrowkin/ZombieRoad.scene.before-economy-' + Date.now(), raw);
fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
console.log('Economy windows authored; controller', controller);
