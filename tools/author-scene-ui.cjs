

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/Scenes/ZombieRoad.scene');
const original = fs.readFileSync(file, 'utf8');
const scene = JSON.parse(original);
assert.ok(!scene.some(o => o._name === 'GameUI'), 'UI already exists; edit it in Cocos, do not regenerate');
const baseline = structuredClone(scene);
const ref = id => ({ __id__: id });
const vec = (x = 0, y = 0, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const color = hex => {
    const s = hex.replace('#', '');
    return { __type__: 'cc.Color', r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255 };
};
const add = object => { scene.push(object); return scene.length - 1; };
function component(node, type, fields = {}) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...fields, _id: `ui-component-${scene.length}` });
    scene[node]._components.push(ref(id)); return id;
}
function node(parent, name, x = 0, y = 0, width = 1280, height = 720, active = true, z = 0) {
    const id = add({ __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x, y, z), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec(1, 1, 1), _mobility: 0, _layer: 33554432, _euler: vec(), _id: `ui-node-${scene.length}` });
    scene[parent]._children.push(ref(id));
    component(id, 'cc.UITransform', { _contentSize: { __type__: 'cc.Size', width, height }, _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } });
    return id;
}
const frameUuid = 'ce3d2b73-7688-449d-a534-512835c16c86';
function panel(parent, name, x, y, w, h, tint, active = true) {
    const id = node(parent, name, x, y, w, h, active);
    component(id, 'cc.Sprite', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _spriteFrame: { __uuid__: frameUuid + '@f9941', __expectedType__: 'cc.SpriteFrame' }, _type: 1, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 }, _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null });
    return id;
}
function text(parent, name, value, x, y, w, h, size, tint) {
    const id = node(parent, name, x, y, w, h);
    return component(id, 'cc.Label', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _string: value, _horizontalAlign: 1, _verticalAlign: 1, _actualFontSize: size, _fontSize: size, _fontFamily: 'Arial', _lineHeight: size + 8, _overflow: 2, _enableWrapText: true, _font: null, _isSystemFontUsed: true, _spacingX: 0, _isBold: false, _isItalic: false, _isUnderline: false, _cacheMode: 0 });
}
function button(parent, name, title, x, y, width) {
    const id = panel(parent, name, x, y, width, 56, '#41645f');
    const label = text(id, name + 'Label', title, 0, 0, width - 16, 52, 24, '#fff1cc');
    const comp = component(id, 'cc.Button', { clickEvents: [], _interactable: true, _transition: 3, _normalColor: color('#41645f'), _hoverColor: color('#527b73'), _pressedColor: color('#36534f'), _disabledColor: color('#808080'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.98, _target: ref(id) });
    component(id, 'cc.BlockInputEvents');
    return { node: id, button: comp, label };
}
const canvas = node(1, 'GameUI', 640, 360);
const cameraNode = node(canvas, 'HUDCamera', 0, 0, 0, 0, true, 1000);
const camera = component(cameraNode, 'cc.Camera', { _projection: 0, _priority: 10, _fov: 45, _fovAxis: 0, _orthoHeight: 360, _near: 0.1, _far: 2000, _color: color('#172b35'), _depth: 1, _stencil: 0, _clearFlags: 6, _rect: { __type__: 'cc.Rect', x: 0, y: 0, width: 1, height: 1 }, _aperture: 19, _shutter: 7, _iso: 0, _screenScale: 1, _visibility: 33554432, _targetTexture: null, _postProcess: null, _usePostProcess: false, _cameraType: -1, _trackingType: 0 });
component(canvas, 'cc.Canvas', { _cameraComponent: ref(camera), _alignCanvasWithScreen: true });

component(canvas, 'cc.Widget', { _alignFlags: 45, _target: null, _left: 0, _right: 0, _top: 0, _bottom: 0, _isAbsLeft: true, _isAbsRight: true, _isAbsTop: true, _isAbsBottom: true, _originalWidth: 1280, _originalHeight: 720, _alignMode: 2, _lockFlags: 0 });
function overlay(name, opaque = false, active = false) {
    const id = panel(canvas, name, 0, 0, 1280, 720, opaque ? '#172b35' : '#101c25d9', active);
    component(id, 'cc.BlockInputEvents'); return id;
}
const playing = node(canvas, 'Playing', 0, 0, 1280, 720, false);
const top = panel(playing, 'TopBar', 0, 310, 1240, 76, '#1c3038'); component(top, 'cc.BlockInputEvents');
text(playing, 'Title', 'Зомби Роад', -120, 326, 960, 32, 24, '#f6eccd');
const status = text(playing, 'Status', 'Ур. 1 / 5   •   Спасено 0/20   •   Цель 5   •   3:00   •   Монеты 0', -120, 294, 960, 28, 19, '#c0d8ce');
const pause = button(playing, 'Pause', 'Пауза', 520, 310, 176);
const help = panel(playing, 'HelpBar', 0, -326, 1240, 56, '#1c3038'); component(help, 'cc.BlockInputEvents');
const hint = text(playing, 'Hint', '', -120, -326, 960, 48, 20, '#c0d8ce');
const cancel = button(playing, 'CancelAim', 'Отмена', 520, -326, 176);
const levels = overlay('LevelSelect', true, true);
text(levels, 'Subtitle', 'Зомби Роад', 0, 126, 900, 40, 24, '#c0d8ce');
const levelButtons = [], levelLabels = [], levelStars = [];
for (let level = 1; level <= 5; level++) {
    const x = (level - 3) * 176;
    const b = button(levels, `Level${level}`, String(level), x, 40, 144);
    levelButtons.push(ref(b.button)); levelLabels.push(ref(b.label));
    levelStars.push(ref(text(levels, `Stars${level}`, 'Не пройден', x, -16, 160, 32, 20, '#f6eccd')));
}
const levelInfo = text(levels, 'LevelInfo', 'Уровень 1\nЦель: спасти не менее 5 из 20', 0, -86, 1000, 68, 24, '#c0d8ce');
const play = button(levels, 'Play', 'Играть', 0, -176, 304);
const wallet = text(levels, 'Wallet', 'Монеты: 0', 0, -264, 1000, 60, 20, '#c0d8ce');
const result = overlay('RoundResult');
panel(result, 'Card', 0, 0, 768, 416, '#172b35');
const resultText = text(result, 'ResultText', 'Победа\n★★★\nСпасено 20 из 20 • Нужно было 5\n20 × 3 = +60 монет', 0, 56, 704, 264, 27, '#f6eccd');
const advance = button(result, 'Advance', 'Дальше', -168, -136, 288);
const resultLevels = button(result, 'ResultLevels', 'Уровни', 168, -136, 288);
const paused = overlay('PausePanel');
panel(paused, 'Card', 0, 0, 560, 392, '#172b35');
text(paused, 'PauseTitle', 'Пауза', 0, 128, 480, 56, 36, '#f6eccd');
const resume = button(paused, 'Resume', 'Продолжить', 0, 48, 352);
const restart = button(paused, 'Restart', 'Начать заново', 0, -32, 352);
const pauseLevels = button(paused, 'PauseLevels', 'Уровни', 0, -112, 352);
const complete = overlay('TestComplete', true);
text(complete, 'CompleteTitle', 'Тест завершён', 0, 152, 1000, 72, 44, '#f6eccd');
const completionText = text(complete, 'CompleteText', 'Пять уровней пройдены\nПройдено уровней: 5 из 5\nМожно вернуться и улучшить результат', 0, 24, 1000, 144, 28, '#c0d8ce');
const choose = button(complete, 'ChooseLevel', 'Выбрать уровень', 0, -144, 352);
const portrait = panel(canvas, 'LandscapeHint', 0, 322, 1100, 60, '#172b35', false);
text(portrait, 'Rotate', 'Поверни устройство горизонтально для удобной игры', 0, 0, 1060, 52, 26, '#f6eccd');
const loading = overlay('LevelLoading', true);
const loadingText = text(loading, 'Status', 'Загрузка уровней…', 0, 40, 1050, 320, 26, '#f6eccd');
const retry = button(loading, 'Retry', '↻ Повторить загрузку', 0, -170, 440);
function scriptType(relative) {
    const uuid = JSON.parse(fs.readFileSync(path.join(root, relative + '.meta'), 'utf8')).uuid.replace(/-/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = uuid.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(uuid.slice(i, i + 3), 16); result += chars[n >> 6] + chars[n & 63]; }
    return result;
}
const hud = component(canvas, scriptType('assets/Scripts/game/presentation/GameHud.ts'), {
    gameLayer: ref(playing), levels: ref(levels), result: ref(result), paused: ref(paused), complete: ref(complete), portrait: ref(portrait), status: ref(status), hint: ref(hint), resultText: ref(resultText), completionText: ref(completionText), levelInfo: ref(levelInfo), wallet: ref(wallet), advanceLabel: ref(advance.label), levelButtons, levelLabels, levelStars,
    playButton: ref(play.button), pauseButton: ref(pause.button), cancelButton: ref(cancel.button), advanceButton: ref(advance.button), resultLevelsButton: ref(resultLevels.button), resumeButton: ref(resume.button), restartButton: ref(restart.button), pauseLevelsButton: ref(pauseLevels.button), chooseLevelButton: ref(choose.button), selectedColor: color('#fff1cc'), unselectedColor: color('#c0d8ce')
});
const startup = component(canvas, scriptType('assets/Scripts/game/presentation/StartupScreen.ts'), { panel: ref(loading), status: ref(loadingText), retryButton: ref(retry.button) });
const bootstrapIndex = scene.findIndex(o => o.__type__ === scriptType('assets/Scripts/game/GameBootstrap.ts'));
assert.ok(bootstrapIndex >= 0, 'Bootstrap not found');
scene[bootstrapIndex].hud = ref(hud); scene[bootstrapIndex].startup = ref(startup);

for (let i = 0; i < baseline.length; i++) {
    if (i !== 1 && i !== bootstrapIndex) assert.deepEqual(scene[i], baseline[i]);
}
assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');

const imageMeta = JSON.parse(fs.readFileSync(path.join(root, 'assets/Sprites/danger.png.meta'), 'utf8'));
const oldUuid = imageMeta.uuid;
const meta = JSON.parse(JSON.stringify(imageMeta).replaceAll(oldUuid, frameUuid));
for (const entry of Object.values(meta.subMetas)) entry.displayName = 'ui-panel';
const data = meta.subMetas.f9941.userData;
Object.assign(data, { trimType: 'none', width: 64, height: 64, rawWidth: 64, rawHeight: 64, borderTop: 12, borderBottom: 12, borderLeft: 12, borderRight: 12 });
data.vertices = { rawPosition: [-32,-32,0,32,-32,0,-32,32,0,32,32,0], indexes: [0,1,2,2,1,3], uv: [0,64,64,64,0,0,64,0], nuv: [0,0,1,0,0,1,1,1], minPos: [-32,-32,0], maxPos: [32,32,0] };
meta.userData.compressSettings = { useCompressTexture: false };
fs.writeFileSync(path.join(root, 'assets/Sprites/ui-panel.png.meta'), JSON.stringify(meta, null, 2) + '\n', { flag: 'wx' });
console.log(`Authored ${scene.length - baseline.length} UI objects; existing world settings preserved.`);
