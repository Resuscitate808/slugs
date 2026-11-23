const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { vehicleCenter: center, vehicleExtent: extent } = require('../assets/Scripts/game/domain/VehicleContact.ts');
const { vehicleSpriteShapes } = require('../assets/Scripts/game/presentation/VehicleSpriteBounds.ts');
const scene = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/Scenes/ZombieRoad.scene'), 'utf8'));
const settings = scene.find(x => x.obstacleSprites);
const metadata = new Map();
function scan(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, e.name);
        if (e.isDirectory()) scan(file);
        else if (e.name.endsWith('.png.meta')) {
            const m = JSON.parse(fs.readFileSync(file, 'utf8'));
            for (const s of Object.values(m.subMetas ?? {})) if (s.importer === 'sprite-frame') metadata.set(s.uuid, s.userData);
        }
    }
}
scan(path.join(__dirname, '../assets/Sprites'));
const vehicleShapes = {};
for (const [kind, key] of [['ordinary','ordinaryCarSprite'], ['pink','pinkCarSprite'], ['jeep','jeepSprite']]) {
    const s = scene[settings[key].__id__], m = metadata.get(s.frame.__uuid__);
    assert.ok(m);
    vehicleShapes[kind] = vehicleSpriteShapes({ ...s, frame: {
        originalSize: { width: m.rawWidth, height: m.rawHeight },
        rect: { width: m.width, height: m.height }, offset: { x: m.offsetX, y: m.offsetY }
    } });
}
let count = 0;
for (const kind of ['ordinary', 'pink']) for (const level of [1,2,3,4,5]) for (const lane of [0,1]) {
    const w = new World(level, 42, { zombieCount: 0, driverExitEnabled: false,
        laneWidths: settings.laneWidths, laneOffsetZ: settings.laneOffsetZ,
        vehicleOffsetZ: settings.vehicleOffsetZ, vehicleShapes });
    const leader = spawnVehicle(w, 'pink', lane), direction = leader.direction;
    leader.x = -direction * 2; leader.speed = leader.cruise = 1;
    const car = spawnVehicle(w, kind, lane);
    assert.ok(car); car.x = -direction * 8; car.speed = car.cruise = 4;
    const follower = spawnVehicle(w, 'jeep', lane);
    assert.ok(follower); follower.speed = follower.cruise = 1;
    const home = car.z;
    let started = false, returned = false;
    for (let i = 0; i < 1200; i++) {
        updateTraffic(w, 1 / 60, false);
        started ||= !!car.overtake;
        for (const a of w.vehicles) for (const b of w.vehicles) if (a !== b) {
            assert.ok(Math.abs(center(a,'x') - center(b,'x')) >= extent(a,'x') + extent(b,'x') - 1e-6
                || Math.abs(center(a,'z') - center(b,'z')) >= extent(a,'z') + extent(b,'z') - 1e-6);
        }
        if (started && !car.overtake && Math.abs(car.z - home) < 0.001 && (car.x - leader.x) * direction > 3.5) {
            returned = true; break;
        }
    }
    assert.ok(started && returned, `${kind} level ${level} lane ${lane}: must pass with scene sprites and a follower`);
    count++;
}
console.log(`PASS ${count} scene-sized overtakes with a following car, both directions, all levels`);
