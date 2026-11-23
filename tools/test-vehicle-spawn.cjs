const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true
} }).outputText;
require.extensions['.ts'] = (module, file) => module._compile(compile(fs.readFileSync(file, 'utf8')), file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { vehicleSpriteShapes } = require('../assets/Scripts/game/presentation/VehicleSpriteBounds.ts');
const { vehicleCenter: center, vehicleExtent: extent } = require('../assets/Scripts/game/domain/VehicleContact.ts');
let count = 0;
const test = (name, fn) => { fn(); count++; console.log('PASS ' + name); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/WorldSprites.ts'), 'utf8');
const rendererModule = {};
vm.runInNewContext(compile(source), { exports: rendererModule, require: () => ({
    Quat: class { static fromEuler(out, x, y, z) { out.angle = z * Math.PI / 180; } }
}) });
const renderer = new rendererModule.WorldSprites({ node: { worldRotation: {} } });
function renderedEdges(car, style) {
    let scale, translation, angle;
    renderer.pose({ style, root: { setPosition() {}, setWorldRotation() {}, setRotationFromEuler() {} }, plane: {
        setScale: (...a) => scale = a, setPosition: (...a) => translation = a, setRotation: q => angle = q.angle
    } }, car.x, 0.18, car.z, car.direction, car.direction * 90, false, 0);
    const xs = [];
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5])
        xs.push(car.x + translation[0] + x * scale[0] * Math.cos(angle) - y * scale[1] * Math.sin(angle));
    return { left: Math.min(...xs), right: Math.max(...xs) };
}
for (const billboard of [true, false]) for (const rotation of [0, 33, 90]) for (const direction of [-1, 1]) {
    test(`rendered car starts hidden and enters continuously ${billboard}/${rotation}/${direction}`, () => {
        const style = { width: 11, height: 0, billboard, rotation, bottomAnchor: true, lift: 0.3, flipWithDirection: true,
            frame: { originalSize: { width: 700, height: 210 }, rect: { width: 600, height: 180 }, offset: { x: 45, y: -8 } } };
        const shape = vehicleSpriteShapes(style);
        const w = new World(1, 42, { zombieCount: 1, driverExitEnabled: false, vehicleShapes: { jeep: shape } });
        const lane = direction > 0 ? 1 : 0;
        for (const bounds of [{ left: -40, right: 46 }, { left: 4, right: 20 }, { left: -9, right: 3 }]) {
            w.vehicles = []; w.trafficBounds = bounds;
            const car = spawnVehicle(w, 'jeep', lane); assert.ok(car);
            const edges = renderedEdges(car, style);
            near(direction > 0 ? bounds.left - edges.right : edges.left - bounds.right, 1);
            car.cruise = car.speed = 6;
            let entered = false;
            for (let i = 0; i < 150 && !entered; i++) {
                const before = car.x;
                updateTraffic(w, 1 / 60, false);
                assert.ok(w.vehicles.includes(car), 'incoming car must not be culled');
                near(car.x - before, direction * 0.1);
                const e = renderedEdges(car, style);
                entered = e.right > bounds.left && e.left < bounds.right;
            }
            assert.ok(entered);
            car.x = (direction > 0 ? bounds.right : bounds.left) + direction * extent(car, 'x') - (center(car, 'x') - car.x);
            car.abandoned = true;
            updateTraffic(w, 1 / 60, false); assert.ok(w.vehicles.includes(car), 'do not remove at visible edge');
            car.x += direction * 80;
            updateTraffic(w, 1 / 60, false); assert.ok(!w.vehicles.includes(car), 'remove after full exit');
        }
    });
}
test('fallback body spawns hidden in both directions and occupied entry is retained', () => {
    for (const lane of [0, 1]) {
        const w = new World(1, 42, { zombieCount: 1 });
        const car = spawnVehicle(w, 'ordinary', lane);
        assert.ok(Math.abs(center(car, 'x')) - extent(car, 'x') >= w.layout.halfWidth + 1);
        assert.equal(spawnVehicle(w, 'ordinary', lane), undefined);
    }
});
test('bootstrap publishes current camera edges before update and uses them for each new world', () => {
    const file = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/GameBootstrap.ts'), 'utf8');
    const out = {}, noop = () => () => {};
    const size = { width: 1440, height: 900 };
    vm.runInNewContext(compile(file), { exports: out, require: id => id === 'cc' ? {
        Component: class {}, _decorator: { ccclass: noop, requireComponent: noop, property: noop },
        view: { getVisibleSize: () => size }
    } : new Proxy({}, { get: () => class {} }) });
    const boot = Object.create(out.GameBootstrap.prototype);
    boot.fitLandscapeCamera = () => {};
    boot.fittedCamera = { orthoHeight: 12, node: { worldPosition: { x: 5 } } };
    boot.flow = { world: new World() };
    boot.syncTrafficBounds();
    near(boot.flow.world.trafficBounds.left, 5 - 19.2);
    const oldWorld = boot.flow.world;
    size.width = 390; size.height = 844;
    boot.flow.world = new World(4); boot.syncTrafficBounds();
    near(boot.flow.world.trafficBounds.right, 5 + 12 * 390 / 844);
    near(oldWorld.trafficBounds.right, 24.2);
    const update = file.slice(file.indexOf('protected update('), file.indexOf('protected onDestroy('));
    assert.ok(update.indexOf('this.syncTrafficBounds()') < update.indexOf('this.flow.update(dt)'));
    assert.ok(file.includes("this.audio?.sync(this.world, this.flow.screen === 'playing', this.world.trafficBounds)"));
});
console.log(`${count} offscreen vehicle checks passed (render-transform contract and real traffic; no GPU acceptance)`);
