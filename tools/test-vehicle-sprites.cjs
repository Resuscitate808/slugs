const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, updateTraffic, crash } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
const { vehicleExtent: extent, vehicleCenter: center, vehicleContactExtent: contactExtent } = require('../assets/Scripts/game/domain/VehicleContact.ts');
const { vehicleSpriteShapes, DEFAULT_CAMERA_BASIS } = require('../assets/Scripts/game/presentation/VehicleSpriteBounds.ts');
let count = 0;
const test = (name, run) => { run(); count++; console.log('PASS ' + name); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const style = (extra = {}) => ({ width: 7, height: 1.4, billboard: true, bottomAnchor: true,
    rotation: 0, lift: 0, flipWithDirection: true,
    frame: { originalSize: { width: 700, height: 140 }, rect: { width: 700, height: 140 }, offset: { x: 0, y: 0 } }, ...extra });
const shapes = vehicleSpriteShapes(style());
function world(config = {}, level = 1, definition) {
    return new World(level, 42, { zombieCount: 1, driverExitEnabled: false, bloodSlipChance: 0,
        laneWidths: [3.5, 3.5, 3.5, 3, 3], vehicleShapes: { jeep: shapes, ordinary: vehicleSpriteShapes(style({ width: 2.3, height: 0 })) }, ...config }, {}, definition);
}
function disjoint(a, b, gap = 0) {
    return Math.abs(center(a, 'x') - center(b, 'x')) >= extent(a, 'x') + extent(b, 'x') + gap - 1e-6
        || Math.abs(center(a, 'z') - center(b, 'z')) >= extent(a, 'z') + extent(b, 'z') + gap - 1e-6;
}
function place(car, x, z) { Object.assign(car, { x, z, lane: z, targetLane: z, reaction: 100 }); }

test('7-unit sprite has 7-unit length; height, auto aspect, anchor, lift and trim affect bounds', () => {
    near(shapes.xPositive.halfX, 3.5);
    near(shapes.xPositive.halfZ, 0.7 * Math.hypot(25, 24) / 25);
    near(shapes.xPositive.offsetZ, -0.7 * Math.hypot(25, 24) / 25 - 0.08 * 24 / 25);
    const auto = vehicleSpriteShapes(style({ height: 0 }));
    assert.deepEqual(auto, shapes);
    const centered = vehicleSpriteShapes(style({ bottomAnchor: false, lift: 1 }));
    near(centered.xPositive.offsetZ, -1.08 * 24 / 25);
    const trimmed = vehicleSpriteShapes(style({ frame: { originalSize: { width: 700, height: 140 },
        rect: { width: 500, height: 100 }, offset: { x: 50, y: 10 } } }));
    near(trimmed.xPositive.halfX, 2.5); near(trimmed.xPositive.offsetX, 0.5);
    near(trimmed.xNegative.offsetX, -0.5);
    assert.equal(vehicleSpriteShapes(style({ frame: null })), undefined);
});

test('bounds enclose actual WorldSprites.pose corners for billboard/flat, rotation, trim and all headings', () => {
    const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/WorldSprites.ts'), 'utf8');
    class Quat { static fromEuler(out, x, y, z) { out.angle = z * Math.PI / 180; } }
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
        { exports, require: () => ({ Quat }) });
    const renderer = new exports.WorldSprites({ node: { worldRotation: {} } });
    for (const billboard of [false, true]) for (const bottomAnchor of [false, true]) for (const rotation of [0, 33, 90])
        for (const axis of ['x', 'z']) for (const direction of [-1, 1]) {
            const s = style({ billboard, bottomAnchor, rotation, lift: 0.3, frame: {
                originalSize: { width: 700, height: 140 }, rect: { width: 600, height: 120 }, offset: { x: 30, y: -8 } } });
            let scale, translation, angle;
            const v = { style: s, root: { setPosition() {}, setWorldRotation() {}, setRotationFromEuler() {} },
                plane: { setScale: (...a) => scale = a, setPosition: (...a) => translation = a,
                    setRotation: q => angle = q.angle } };
            const heading = axis === 'x' ? direction * 90 : direction === 1 ? 0 : 180;
            renderer.pose(v, 0, 0.18, 0, direction, heading, false, billboard && axis === 'z' ? -90 : 0);
            const b = vehicleSpriteShapes(s)[axis + (direction > 0 ? 'Positive' : 'Negative')];
            const xs = [], zs = [];
            for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) {
                const px = translation[0] + x * scale[0] * Math.cos(angle) - y * scale[1] * Math.sin(angle);
                const py = translation[1] + x * scale[0] * Math.sin(angle) + y * scale[1] * Math.cos(angle);
                xs.push(px);
                zs.push(billboard ? -py * Math.hypot(25, 24) / 25 - 0.38 * 24 / 25 : -py - 0.38 * 24 / 25);
            }
            near(b.offsetX - b.halfX, Math.min(...xs)); near(b.offsetX + b.halfX, Math.max(...xs));
            near(b.offsetZ - b.halfZ, Math.min(...zs)); near(b.offsetZ + b.halfZ, Math.max(...zs));
        }
});

test('large sprite cannot spawn into another large or small car, including adjacent lane', () => {
    const w = world(), a = spawnVehicle(w, 'jeep', 0); assert.ok(a);
    a.x -= 5; assert.equal(spawnVehicle(w, 'jeep', 0), undefined);
    a.x -= 3; assert.ok(spawnVehicle(w, 'jeep', 0));
    const wide = vehicleSpriteShapes(style({ height: 6 }));
    const other = world({ vehicleShapes: { jeep: wide } });
    const b = spawnVehicle(other, 'jeep', 0); b.x = -18;
    assert.equal(spawnVehicle(other, 'jeep', 1), undefined);
});

test('pink crash preserves lane direction instead of creating oncoming traffic', () => {
    const w = world(), car = spawnVehicle(w, 'pink', 0);
    const direction = car.direction;
    w.random.chance = () => true;
    for (let i = 0; i < 10; i++) {
        car.collisionCooldown = 0;
        crash(w, car);
        assert.equal(car.direction, direction);
        assert.ok(car.speed > car.cruise);
    }
});

test('mixed-size queue, oncoming and crossing cars stop before overlap even across long steps', () => {
    for (const mode of ['queue', 'oncoming', 'crossing']) for (const direction of [-1, 1]) {
        const w = world(), a = spawnVehicle(w, 'jeep', 0); place(a, 0, 0); a.abandoned = true;
        const b = spawnVehicle(w, 'ordinary', 1); place(b, -direction * 10, 0);
        b.direction = direction; b.speed = b.cruise = 50;
        if (mode === 'oncoming') { a.abandoned = false; a.direction = -direction; a.speed = a.cruise = 10; }
        if (mode === 'crossing') { b.axis = 'z'; place(b, 0, -direction * 10); }
        updateTraffic(w, 0.25, false); assert.ok(disjoint(a, b, 0.19), mode);
        for (let i = 0; i < 120; i++) { updateTraffic(w, 1 / 60, false); assert.ok(disjoint(a, b), mode); }
    }
});

test('sprite front kills at visual bumper; side/rear/stationary do not, both axes/directions', () => {
    for (const axis of ['x', 'z']) for (const direction of [-1, 1]) for (const mode of ['front', 'side', 'rear', 'stopped']) {
        const w = world(), car = spawnVehicle(w, 'jeep', 0); place(car, 0, 0);
        car.axis = axis; car.direction = direction; car.speed = car.cruise = 6;
        const cross = axis === 'x' ? 'z' : 'x', z = w.zombies[0];
        z.state = 'stuck'; z.timer = 10; z[axis] = center(car, axis); z[cross] = center(car, cross);
        if (mode !== 'side') z[axis] += direction * (extent(car, axis) + 0.19) * (mode === 'rear' ? -1 : 1);
        if (mode === 'side') z[cross] += extent(car, cross) + 0.1;
        if (mode === 'stopped') car.stopped = 10;
        updateTraffic(w, 1 / 60, false);
        assert.equal(z.state, mode === 'front' ? 'dead' : 'stuck', `${axis}/${direction}/${mode}`);
    }
});

test('zombie waits at actual 7-unit car without penetration or retreat, then finishes', () => {
    const w = world(), car = spawnVehicle(w, 'jeep', 0); place(car, 0, 0); car.abandoned = true;
    const z = w.zombies[0]; Object.assign(z, { x: 0, z: 2, goalX: 0, state: 'walking', speed: 2, disoriented: 0, boost: 0 });
    for (let i = 0; i < 1200; i++) {
        const before = z.z; updateZombies(w, 1 / 60);
        assert.ok(z.z <= before + 1e-8);
        assert.ok(Math.abs(z.x - center(car, 'x')) >= contactExtent(car, 'x') + 0.15 - 1e-6
            || Math.abs(z.z - center(car, 'z')) >= contactExtent(car, 'z') + 0.15 - 1e-6);
    }
    assert.equal(z.state, 'walking', 'slug waits at the body instead of walking through it');
    w.vehicles = [];
    for (let i = 0; i < 1200 && z.state !== 'saved'; i++) updateZombies(w, 1 / 60);
    assert.equal(z.state, 'saved');
});

test('vehicle-only offset moves all five levels, not lane surfaces, obstacles, spawn or finish', () => {
    for (let level = 1; level <= 5; level++) {
        const a = world({ vehicleOffsetZ: 0 }, level), b = world({ vehicleOffsetZ: 0.4 }, level);
        assert.deepEqual(a.layout, b.layout); assert.deepEqual(a.zombies, b.zombies);
        for (let lane = 0; lane < a.layout.laneCenters.length; lane++) {
            a.vehicles = []; b.vehicles = [];
            const ca = spawnVehicle(a, 'jeep', lane), cb = spawnVehicle(b, 'jeep', lane);
            near(cb.z - ca.z, 0.4); near(cb.lane - ca.lane, 0.4); near(cb.targetLane - ca.targetLane, 0.4);
            near(center(cb, 'z') - center(ca, 'z'), 0.4);
            updateTraffic(b, 1 / 60, false); near(cb.z, b.layout.laneCenters[lane] + 0.4);
        }
    }
    const w = world({ vehicleShapes: {}, vehicleOffsetZ: NaN });
    const c = spawnVehicle(w, 'ordinary', 0); near(extent(c, 'x'), 1.2); near(extent(c, 'z'), 0.6);
    near(c.z, w.layout.laneCenters[0] + 0.4);
});
test('scene GameSettings passes assigned frame dimensions into each new round; disabled sprites keep 3D bounds', () => {
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
    const scene = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/Scenes/ZombieRoad.scene'), 'utf8'));
    const saved = scene.find(s => s.obstacleSprites);
    const exports = {}, noop = (...args) => args.length > 1 ? undefined : () => {};
    const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/GameSettings.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText, {
        exports, require: id => id === 'cc' ? { Component: class {}, _decorator: { ccclass: noop, property: noop } }
            : id === './SpriteStyle' ? { actorStyle: () => ({}) }
            : require(path.join(__dirname, '../assets/Scripts/game/presentation', id + '.ts')),
    });
    const settings = new exports.GameSettings(); Object.assign(settings, saved);
    for (const key of ['ordinaryCarSprite', 'jeepSprite', 'pinkCarSprite']) {
        const s = scene[saved[key].__id__], m = metadata.get(s.frame.__uuid__); assert.ok(m);
        settings[key] = { ...s, frame: { originalSize: { width: m.rawWidth, height: m.rawHeight },
            rect: { width: m.width, height: m.height }, offset: { x: m.offsetX, y: m.offsetY } } };
    }
    const config = settings.toConfig();
    const jeepHalf = scene[saved.jeepSprite.__id__].width / 2;
    near(config.vehicleShapes.jeep.xPositive.halfX, jeepHalf); near(config.vehicleOffsetZ, saved.vehicleOffsetZ);
    for (let level = 1; level <= 5; level++) {
        const w = new World(level, 42, config), c = spawnVehicle(w, 'jeep', 0);
        near(extent(c, 'x'), jeepHalf); near(c.z, w.layout.laneCenters[0] + saved.vehicleOffsetZ);

        for (let i = 0; i < 1800; i++) {
            updateTraffic(w, 1 / 60, i % 15 === 0);
            for (let a = 0; a < w.vehicles.length; a++) for (let b = a + 1; b < w.vehicles.length; b++)
                assert.ok(disjoint(w.vehicles[a], w.vehicles[b]), `level ${level}, frame ${i}: overlap`);
        }
    }
    for (const level of [4, 5]) {
        const w = new World(level, 42, config);
        for (let i = 0; i < 1800; i++) updateTraffic(w, 1 / 60, i % 15 === 0);
        assert.ok(w.vehicles.length > 0);
        for (let i = 0; i < 7200; i++) updateTraffic(w, 1 / 60, false);
        assert.equal(w.vehicles.length, 0, `level ${level}: traffic must drain after spawning stops`);
    }
    settings.useSprites = false;
    const w = new World(1, 42, settings.toConfig()); near(extent(spawnVehicle(w, 'jeep', 0), 'x'), 1.2);
});
console.log(`${count} sprite vehicle checks passed (real simulation + render-transform contract, no GPU acceptance)`);
