const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,f);
const {settleParty}=require('../assets/Scripts/game/application/Party.ts');
const lineup=[{id:1,kind:0,growth:0},{id:2,kind:0,growth:0},{id:3,kind:0,growth:0}];
const zombies=[{state:'saved'},{state:'dead'},{state:'walking'}];
const party=[{id:1,kind:0,growth:0},{id:2,kind:0,growth:0},{id:3,kind:0,growth:0},{id:4,kind:0,growth:0}];

// preLevelEnabled=true (default): dead -> fallen, removed from party
const r1=settleParty(lineup,zombies,party,true,true);
console.log('preLevel=true party ids:',r1.party.map(m=>m.id),'fallen:',r1.outcome.fallen.length);

// preLevelEnabled=false: dead -> kept, stays in party
const r2=settleParty(lineup,zombies,party,true,false);
console.log('preLevel=false party ids:',r2.party.map(m=>m.id),'fallen:',r2.outcome.fallen.length);

// assert
const ids1=r1.party.map(m=>m.id).sort((a,b)=>a-b);
const ids2=r2.party.map(m=>m.id).sort((a,b)=>a-b);
if(!ids1.every((v,i)=>v===ids2[i])) console.log('PARTIES DIFFER (expected)');
// r1 should NOT contain id 2 (dead, fallen), r2 SHOULD contain id 2 (dead, kept)
console.log('r1 has id2:',r1.party.some(m=>m.id===2),'r2 has id2:',r2.party.some(m=>m.id===2));
