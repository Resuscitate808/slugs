const fs=require('fs');const assert=require('node:assert/strict');
const s=JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene','utf8'));
const before=JSON.parse(fs.readFileSync('../.sharrowkin/backups/ZombieRoad.before-two-counters.scene','utf8'));
const host=s.find(n=>n._name==='TopHud');const allowed=new Set();
function visit(i){allowed.add(i);for(const c of s[i]._components||[])allowed.add(c.__id__);for(const c of s[i]._children||[])visit(c.__id__);}
visit(s.indexOf(host));assert.equal(s.length,before.length);
s.forEach((v,i)=>{if(!allowed.has(i))assert.deepEqual(v,before[i],`Unrelated scene entry ${i}`);});
const hud=host._components.map(r=>s[r.__id__]).find(c=>c.savedLabel);
for(const [label,track,fill,parent] of [['savedLabel','track','fill','ProgressPanel'],['targetLabel','targetTrack','targetFill','TargetProgress']]){
 const l=s[hud[label].__id__],t=s[hud[track].__id__],f=s[hud[fill].__id__];
 assert.equal(l.__type__,'cc.Label');assert.ok(l.node);assert.equal(s[s[l.node.__id__]._parent.__id__]._name,parent);
 assert.equal(s[f.node.__id__]._parent.__id__,t.node.__id__);assert.equal(f._anchorPoint.x,0);
 const p=s[s[l.node.__id__]._parent.__id__];assert.ok(p._children.findIndex(r=>r.__id__===l.node.__id__)>p._children.findIndex(r=>r.__id__===t.node.__id__));
}
assert.equal(s[hud.levelLabel.__id__]._string,'001');assert.ok(!('targetMark' in hud));
console.log('PASS TopHud scene: two counters, live references, foreground labels, numeric level, unrelated scene entries preserved');
