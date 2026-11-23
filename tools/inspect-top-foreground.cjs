const fs = require('node:fs');
const s = JSON.parse(fs.readFileSync('assets/Scenes/ZombieRoad.scene', 'utf8'));
for (let i = 0; i < s.length; i++) if (s[i].__type__ === 'cc.Node' && ['TopForeground', 'BottomForeground', 'Playing', 'HUDCamera'].includes(s[i]._name)) {
 console.log(i, JSON.stringify(s[i], null, 2));
 for (const r of s[i]._components) console.log(r.__id__, JSON.stringify(s[r.__id__], null, 2));
}
