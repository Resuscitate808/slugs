const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('../assets/Scripts/game/GameBootstrap.ts', 'utf8').replace(/\r\n/g, '\n');
const method = source.match(/private fitLandscapeCamera\(\): void \{([\s\S]*?)\n    \}\n    protected start/)[1].replace('style.frame!', 'style.frame');
let size;
const fit = vm.runInNewContext('(function(){' + method + '})', { view: { getVisibleSize: () => size } });
const projection = 25 / Math.hypot(25, 24);
for (const [width, height] of [[1280,720],[1280,960],[1920,720],[935,540]]) {
    size = { width, height };
    let writes = 0;
    const node = { setPosition(x,y,z) { writes++; this.position = {x,y,z}; } };
    const camera = { node, orthoHeight: 12 };
    const landscape = { level: 0, x: 0, z: 2, sprite: { width: 36, height: 25, rotation: 0, billboard: false, frame: { originalSize: {width:36,height:25} } } };
    const host = { fittedCamera: camera, settings: { generateEnvironment: true, useSprites: true, landscapeSprites: [landscape] }, world: { layout: { level: 1 } } };
    fit.call(host);
    const center = node.position.z - 24 - 0.12 * 24 / 25;
    assert.ok(center - camera.orthoHeight / projection >= landscape.z - 12.5 - 1e-9, 'top stays inside landscape');
    assert.ok(center + camera.orthoHeight / projection <= landscape.z + 12.5 + 1e-9, 'bottom stays inside landscape');
    assert.ok(camera.orthoHeight * width / height <= 18 + 1e-9, 'sides stay inside landscape');
    const previous = JSON.stringify(camera);
    fit.call(host);
    assert.equal(JSON.stringify(camera), previous, 'no camera drift each frame');
    assert.equal(writes, 1, 'unchanged camera is not marked dirty again');
    host.settings.landscapeSprites = [];
    fit.call(host);
    assert.equal(JSON.stringify(camera), previous, 'fallback does not shrink or drift');
}
console.log('PASS camera full field: top/bottom/sides covered at four aspect ratios; stable repeated updates and fallback');
