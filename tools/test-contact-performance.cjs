const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { performance } = require('node:perf_hooks');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,f);
const { shapeEntry, shapeBounds } = require('../assets/Scripts/game/domain/SpriteContact.ts');
const reference = require('./contact-reference.cjs');
const { alphaRectangles, contactGeometry } = require('../assets/Scripts/game/presentation/SpriteContactGeometry.ts');
const { DEFAULT_CAMERA_BASIS: basis } = require('../assets/Scripts/game/presentation/VehicleSpriteBounds.ts');
let seed = 27;
const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const point = () => ({x:random()*12-6,z:random()*12-6});
const shape = () => ({polygons:Array.from({length:Math.floor(random()*12)},()=>{
    const p=point(), angle=random()*Math.PI, w=random()+.01, h=random()+.01;
    return [[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,z])=>({x:p.x+x*Math.cos(angle)-z*Math.sin(angle),z:p.z+x*Math.sin(angle)+z*Math.cos(angle)}));
})});
const compare = (a,from,to,b,at) => {
    const old=reference(a,from,to,b,at), actual=shapeEntry(a,from,to,b,at);
    if(old===undefined)assert.equal(actual,undefined); else assert(actual!==undefined && Math.abs(old-actual)<1e-10,`${old} != ${actual}`);
};
for(let i=0;i<4000;i++) {
    const a=shape(), b=shape(), from=point(), to=i%3?point():from, at=point();
    compare(a,from,to,b,at);
    const geometry=JSON.stringify(a);
    assert.equal(shapeBounds(a),shapeBounds(a));
    assert.equal(JSON.stringify(a),geometry);
}
console.log('PASS 4000 differential swept/static/rotated/multipart/empty contacts against original algorithm');
const contour = (size, width, height, rotation=0) => {
    const mask=alphaRectangles(size,size,(x,y)=>{
        const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
        return u*u+v*v<.95 && !(Math.abs(u)<.3 && v<.25);
    });
    return contactGeometry({width,height,rotation,billboard:true,bottomAnchor:false,flipWithDirection:false,lift:0,
        frame:{originalSize:{width:size,height:size},rect:{width:size,height:size},offset:{x:0,y:0}}},mask,basis,.1);
};
const a=contour(256,1.4,1.4), b=contour(512,6.2,2,17), zero={x:0,z:0};
const cases=Array.from({length:120},(_,i)=>{
    const from={x:(i%12-6)*.5,z:(Math.floor(i/12)-5)*.4};
    return [a,from,{x:from.x+.14,z:from.z-.08},b,zero];
});
for(const args of cases)compare(...args);
const run = fn => {const start=performance.now();let hits=0;for(let n=0;n<5;n++)for(const args of cases)if(fn(...args)!==undefined)hits++;return {ms:performance.now()-start,hits};};
run(shapeEntry); run(reference);
const old=run(reference), current=run(shapeEntry);
assert.equal(old.hits,current.hits);
console.log(`BENCH ${a.polygons.length} x ${b.polygons.length} contour parts, 600 queries: original ${old.ms.toFixed(2)} ms; optimized ${current.ms.toFixed(2)} ms; ${(old.ms/current.ms).toFixed(1)}x faster (CPU only, not rendered FPS)`);
