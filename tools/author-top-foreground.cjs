const fs = require('node:fs');
const path = 'assets/Scenes/ZombieRoad.scene';
const text = fs.readFileSync(path, 'utf8');
const s = JSON.parse(text);
const index = name => s.findIndex(n => n.__type__ === 'cc.Node' && n._name === name);
const topId = index('TopForeground'), hudId = index('HUDCamera');
if (topId < 0 || hudId < 0) throw Error('Missing authored nodes');
const top = s[topId], hud = s[hudId];
if (top._components.some(r => s[r.__id__].__type__ === 'e4c05eaQTJLgqnYYkNQrHaP')) throw Error('Already configured');
fs.mkdirSync('.sharrowkin', { recursive: true });
fs.writeFileSync('.sharrowkin/scene-before-top-foreground.json', text, { flag: 'wx' });
const uuid = 'e4c0579a41324b82a9d8624350ac768f';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let type = uuid.slice(0, 5);
for (let i = 5; i < 32; i += 3) { const n = parseInt(uuid.slice(i, i + 3), 16); type += alphabet[n >> 6] + alphabet[n & 63]; }
const ref = __id__ => ({ __id__ });
function camera(name, layer, priority) {
 const n = structuredClone(hud), c = structuredClone(s[hud._components.find(r => s[r.__id__].__type__ === 'cc.Camera').__id__]);
 const ni = s.length, ci = ni + 1;
 n._name = name; n._id = name; n._components = [ref(ci)]; n._layer = layer;
 c.node = ref(ni); c._id = name + '-camera'; c._priority = priority; c._visibility = layer; c._clearFlags = 6;
 s.push(n, c);
 s[hud._parent.__id__]._children.push(ref(ni));
 return ci;
}
const foregroundCamera = camera('ForegroundCamera', 1 << 20, 1);
const actorCamera = camera('ActorCamera', 1 << 19, 2);
top._layer = 1 << 20;
top._active = true;
const id = s.length;
s.push({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(topId), _enabled: true, __prefab: null, hudCamera: hud._components.find(r => s[r.__id__].__type__ === 'cc.Camera'), foregroundCamera: ref(foregroundCamera), actorCamera: ref(actorCamera), _id: 'foreground-layers' });
top._components.push(ref(id));
fs.writeFileSync(path, JSON.stringify(s, null, 2) + '\n');
console.log('Configured TopForeground; original sprite, dimensions and anchors preserved');
