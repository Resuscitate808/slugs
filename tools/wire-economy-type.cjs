const fs = require('node:fs');
const file = '../assets/Scenes/ZombieRoad.scene';
const s = JSON.parse(fs.readFileSync(file, 'utf8'));
const uuid = JSON.parse(fs.readFileSync('../assets/Scripts/game/presentation/EconomyWindows.ts.meta', 'utf8')).uuid;
const hex = uuid.replaceAll('-', '');
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let type = hex.slice(0, 5);
for (let i = 5; i < 32; i += 3) { const n = parseInt(hex.slice(i, i + 3), 16); type += chars[n >> 6] + chars[n & 63]; }
const c = s.find(n => n.__type__ === uuid);
if (!c) throw Error('Expected newly authored component');
c.__type__ = type;
fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
console.log(type);
