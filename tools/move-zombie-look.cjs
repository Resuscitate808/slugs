

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/Scenes/ZombieRoad.scene');
const original = fs.readFileSync(file, 'utf8');
const scene = JSON.parse(original);

const settings = scene.find(o => o.obstacleSprites && o.landscapeSprites);
assert.ok(settings, 'GameSettings not found');
assert.ok(settings.zombieSprite, 'Already applied (GameSettings has no zombieSprite)');
const win = scene.find(o => o.cards && o.claimTimer);
assert.ok(win, 'PreLevelWindow not found');

const lookId = settings.zombieSprite.__id__;
let refs = 0;
(function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (v.__id__ === lookId) refs++;
    for (const c of Object.values(v)) walk(c);
})(scene);
assert.equal(refs, 1, 'zombieSprite style is referenced elsewhere');
const old = scene[lookId];
scene[lookId] = {
    __type__: 'ZombieLook', width: old.width, height: old.height, billboard: old.billboard,
    bottomAnchor: old.bottomAnchor, flipWithDirection: old.flipWithDirection, rotation: old.rotation, lift: old.lift,
};
delete settings.zombieSprite;
win.zombieLook = { __id__: lookId };

for (const r of win.cards) {
    const card = scene[r.__id__];
    scene[card.body.__id__]._spriteFrame = { ...win.cardFrame };
    scene[card.selectedBadge.__id__]._active = false;
}

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-zombie-look');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`ZombieLook moved to PreLevelWindow (width ${old.width}, lift ${old.lift}); ${win.cards.length} cards unselected; backup ${path.relative(root, backup)}`);
