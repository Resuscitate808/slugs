import { Camera, Color, gfx, Material, MeshRenderer, Node, Prefab, Texture2D, resources, utils, Vec3 } from 'cc';
import { SmartNodePool } from '../../../base/pools/SmartNodePool';
import { World } from '../domain/World';
import { Point } from '../domain/Model';
import { GameSettings } from './GameSettings';
import { Primitives } from './Primitives';
import { ActorAnimation } from './ActorAnimation';
import { SpriteVisual, WorldSprites } from './WorldSprites';
import { SpriteStyle } from './SpriteStyle';
import { ACTOR_LAYER, ForegroundLayers } from './ForegroundLayers';

interface Visual { node: Node; kind: string; animations: ActorAnimation[]; sprite?: SpriteVisual; warped?: boolean }

const PLATFORM_PRIORITY = -2;
const ARROW_PRIORITY = -1;

export class WorldView {
    private visuals = new Map<string, Visual>();
    private pools = new Map<string, SmartNodePool>();
    private fallback = new Map<string, Visual[]>();
    private environment = new Node('GeneratedEnvironment');
    private obstacles = new Node('LevelObstacles');
    private actors = new Node('Actors');
    private staticSprites: SpriteVisual[] = [];
    private sprites: WorldSprites;
    private aim: Node;
    private marker: Node;
    private aimMaterials: Material[] = [];
    private arrowAspect = 158 / 356;
    private platform: Node;
    private platformMaterials: Material[] = [];
    private platformAspect = 238 / 142;

    private warpFrom: Node;
    private warpTo: Node;

    zombieSkins: Array<SpriteStyle | null> = [];

    zombieKindOf: number[] = [];
    constructor(private root: Node, private settings: GameSettings, private primitives: Primitives, private camera: Camera) {
        this.sprites = new WorldSprites(camera);
        root.scene?.getComponentInChildren(ForegroundLayers)?.bind(camera);
        this.actors.setParent(root); this.obstacles.setParent(root);
        this.environment.setParent(settings.environmentRoot ?? root);
        const prefabs: Record<string, Prefab | null> = {
            zombie: settings.zombiePrefab, ordinary: settings.ordinaryCarPrefab, jeep: settings.jeepPrefab,
            pink: settings.pinkCarPrefab, blood: settings.bloodPrefab, driver: settings.driverPrefab,
        };
        for (const [key, prefab] of Object.entries(prefabs)) if (prefab && !settings.spriteFor(key)) this.pools.set(key, new SmartNodePool(prefab));
        this.aim = new Node('Aim');
        this.aim.setParent(root);
        this.aim.active = false;
        this.marker = this.createArrowNode(this.actors, 'AimArrow');
        this.makeArrowAlwaysVisible(this.marker);
        this.platform = this.createPlatformNode(root, 'AimPlatform');
        this.loadArrowTexture();
        this.loadPlatformTexture();
        this.showAim(null, null);
        this.warpFrom = primitives.box(root, 'TeleportFrom', '#9ff3e4', 0, 0.12, 0, 1, 0.02, 1);
        this.warpTo = primitives.box(root, 'TeleportTo', '#d8fff4', 0, 0.12, 0, 1, 0.02, 1);
        this.warpFrom.active = this.warpTo.active = false;
    }
    build(world: World): void {
        this.clearActors(); this.staticSprites = [];
        for (const parent of [this.environment, this.obstacles]) for (const child of [...parent.children]) {
            child.active = false; child.destroy();
        }

        this.buildObstacles(world);
        if (!this.settings.generateEnvironment) return;
        const landscape = this.settings.useSprites && (
            this.settings.landscapeSprites.find(s => s.level === world.layout.level && s.sprite.frame)
            ?? this.settings.landscapeSprites.find(s => s.level === 0 && s.sprite.frame));
        if (landscape) {
            const v = this.sprites.create(this.environment, 'Landscape', landscape.sprite);
            this.sprites.pose(v, landscape.x, -0.12, landscape.z);
            this.staticSprites.push(v);

            this.buildLaneSurfaces(world);
            return;
        }
        const p = this.primitives, root = this.environment, l = world.layout;
        p.box(root, 'Meadow', '#637c65', 0, -0.45, 2, 36, 0.6, 25);
        p.box(root, 'RoadShoulder', '#a7aa91', 0, -0.08, 0, 36, 0.15, l.roadHalf * 2 + 1.5);
        p.box(root, 'Asphalt', '#8d5c44', 0, 0.01, 0, 36, 0.12, l.roadHalf * 2);
        this.buildLaneSurfaces(world);
        p.box(root, 'Ditch', '#48594e', 0, -0.1, 5.85, 36, 0.1, 1.5);
        for (const edge of l.ditchEdges) {
            const bank = p.box(root, 'DitchBank', '#89957c', 0, -0.05, edge, 36, 0.15, 0.65);
            bank.setRotationFromEuler(edge > 6 ? -15 : 15, 0, 0);
        }
        for (const z of [-l.roadHalf + 0.15, l.roadHalf - 0.15]) p.box(root, 'EdgeLine', '#dfded0', 0, 0.08, z, 36, 0.02, 0.08);
        for (let i = 1; i < l.laneCenters.length; i++) {
            const z = (l.laneCenters[i - 1] + l.laneCenters[i]) / 2;
            const color = l.laneDirections[i - 1] !== l.laneDirections[i] ? '#e4bb69' : '#aab6b4';
            for (let x = -17; x < 18; x += 2.2) p.box(root, 'LaneDash', color, x, 0.09, z, 1.1, 0.02, 0.09);
        }
        p.box(root, 'SafeZone', '#80b697', 0, -0.05, l.finishZ - 1.3, 34, 0.2, 2.5);
        for (let x = -15; x <= 15; x += 1) p.box(root, 'Finish', x % 2 === 0 ? '#dfebc7' : '#538275', x, 0.09, l.finishZ, 0.9, 0.02, 0.3);
    }
    private buildLaneSurfaces(world: World): void {
        const l = world.layout;
        const colors = ['#956147', '#8d5c44'];
        l.laneCenters.forEach((z, i) => {

            this.primitives.box(this.environment, `LaneSurface-${i + 1}`, colors[i % 2],
                0, 0.076, z, world.config.levelTable ? l.halfWidth * 2 : 36, 0.01, l.laneWidth);
        });
    }
    private buildObstacles(world: World): void {
        if (world.config.obstaclesVisible === false) return;
        for (const o of world.layout.obstacles) {
            const style = this.settings.useSprites && this.settings.obstacleSprites.find(s => s.type === o.type)?.sprite;
            if (style && style.frame) {
                const v = this.sprites.create(this.obstacles, o.id, style);
                this.sprites.pose(v, o.x, 0.13, o.z, 1, 0, false, o.rotation);
                v.root.setScale(o.scale, o.scale, o.scale);
                this.staticSprites.push(v);
            } else {
                const color = o.effect === 'slip' ? '#387c91' : o.effect === 'snare' ? '#bf9859' : '#6f566d';
                const height = o.effect === 'slip' ? 0.025 : o.effect === 'snare' ? 0.3 : 0.2;
                const n = this.primitives.box(this.obstacles, `${o.id}:${o.type}`, color, o.x, 0.13 + height / 2, o.z, o.radius * 2, height, o.radius * 2);
                n.setRotationFromEuler(0, o.rotation, 0);
            }
            if (this.settings.showObstacleBounds) for (let i = 0; i < 32; i++) {
                const a = i * Math.PI / 16;
                this.primitives.box(this.obstacles, 'CollisionRadius', '#ffe48a', o.x + Math.cos(a) * o.radius, 0.17, o.z + Math.sin(a) * o.radius, 0.07, 0.03, 0.07);
            }
        }
    }
    sync(world: World): void {
        const alive = new Set<string>();
        for (const v of this.staticSprites) if (v.style.billboard) {

            const cameraRotation = this.camera.node.worldRotation;
            if (cameraRotation) v.root.setWorldRotation(cameraRotation);
        }
        world.zombies.forEach((z, index) => {
            if (['dead', 'lost'].includes(z.state)) return;
            const v = this.get(`z${z.id}`, this.zombieKind(index), alive), fallen = z.state === 'fallen';

            const y = 0.1 + (z.state === 'walking' || z.state === 'idle' ? z.idleMotion?.height ?? 0 : 0);
            const heading = Math.atan2(z.direction.x, z.direction.z) * 180 / Math.PI;
            if (v.sprite) this.sprites.pose(v.sprite, z.x, y, z.z, z.direction.x, heading, fallen);
            else { v.node.setPosition(z.x, y + (fallen ? 0.2 : 0), z.z); v.node.setRotationFromEuler(fallen ? 80 : 0, heading, z.state === 'stuck' ? 18 : 0); }
            const animationState = z.state === 'saved'
                ? z.savedTarget && Math.hypot(z.x - z.savedTarget.x, z.z - z.savedTarget.z) > 0.01 ? 'walking' : 'idle'
                : z.state;
            for (const animation of v.animations) animation.apply(animationState);

            const root = v.sprite ? v.sprite.root : v.node;
            if (z.teleport) {
                const t = Math.min(1, z.teleport.elapsed / z.teleport.duration);
                const k = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
                root.setScale(Math.max(0.02, k), 1 + (1 - k) * 0.8, Math.max(0.02, k));
                v.warped = true;
            } else if (v.warped) { root.setScale(1, 1, 1); v.warped = false; }
        });
        this.syncWarp(world);
        for (const car of world.vehicles) {
            const v = this.get(`v${car.id}`, car.kind, alive);
            const heading = car.axis === 'x' ? car.direction * 90 : car.direction === 1 ? 0 : 180;
            if (v.sprite) this.sprites.pose(v.sprite, car.x, 0.18, car.z, car.direction, heading, false, v.sprite.style.billboard && car.axis === 'z' ? -90 : 0);
            else { v.node.setPosition(car.x, 0.12, car.z); v.node.setRotationFromEuler(0, heading, 0); }
        }
        for (const b of world.remains) {
            this.place(this.get(`b${b.id}`, 'blood', alive), b.x, 0.12, b.z);
        }
        for (const d of world.drivers) if (!d.eaten) this.place(this.get(`d${d.id}`, 'driver', alive), d.x, 0.1, d.z);
        for (const [key, visual] of this.visuals) if (!alive.has(key)) { this.release(visual); this.visuals.delete(key); }
    }

    private syncWarp(world: World): void {
        if (!this.warpFrom || !this.warpTo) return;
        const warping = world.zombies.find(z => z.teleport);
        if (!warping?.teleport) { this.warpFrom.active = this.warpTo.active = false; return; }
        const t = Math.min(1, warping.teleport.elapsed / warping.teleport.duration);
        const out = Math.sin(Math.min(1, t * 2) * Math.PI), inn = Math.sin(Math.max(0, t * 2 - 1) * Math.PI);
        this.warpFrom.setPosition(warping.teleport.from.x, 0.12, warping.teleport.from.z);
        this.warpFrom.setScale(0.2 + out * 1.6, 0.02, 0.2 + out * 1.6);
        this.warpFrom.active = out > 0.02;
        const to = warping.savedTarget ?? warping;
        this.warpTo.setPosition(to.x, 0.12, to.z);
        this.warpTo.setScale(0.2 + inn * 1.6, 0.02, 0.2 + inn * 1.6);
        this.warpTo.active = inn > 0.02;
    }
    private place(v: Visual, x: number, y: number, z: number): void {
        if (v.sprite) this.sprites.pose(v.sprite, x, y, z);
        else v.node.setPosition(x, y, z);
    }

    zombieKind(index: number): string {
        const skins = this.zombieSkins ?? [];
        if (!skins.length) return 'zombie';
        const kind = (this.zombieKindOf ?? [])[index] ?? index;
        const skin = ((kind % skins.length) + skins.length) % skins.length;
        return skins[skin] ? `zombie#${skin}` : 'zombie';
    }
    private styleFor(kind: string): SpriteStyle | null {
        if (kind.startsWith('zombie#')) return (this.zombieSkins ?? [])[Number(kind.slice(7))] ?? null;
        return this.settings.spriteFor(kind);
    }
    zombiePickPosition(x: number, z: number, index = 0, jumpHeight = 0): Vec3 {
        const s = this.styleFor(this.zombieKind(index));
        if (!s) return new Vec3(x, 0.65 + jumpHeight, z);
        const height = s.height || s.width * s.frame!.originalSize.height / Math.max(1, s.frame!.originalSize.width);
        const center = new Vec3(0, s.bottomAnchor ? height * 0.5 : 0, 0);
        if (s.billboard) Vec3.transformQuat(center, center, this.camera.node.worldRotation);
        else { center.z = -center.y; center.y = 0; }
        return center.add(new Vec3(x, 0.1 + s.lift + jumpHeight, z));
    }
    showAim(origin: (Point & { idleMotion?: { height: number } }) | null, pull: Point | null, maxLength = 4): void {
        this.aim.active = false;
        const show = !!origin && !!pull;
        this.marker.active = show;
        this.platform.active = !!origin;
        if (!origin) return;
        this.platform.layer = ACTOR_LAYER;
        for (const child of this.platform.children) child.layer = ACTOR_LAYER;
        this.platform.setPosition(origin.x, 0.09, origin.z);
        this.platform.setScale(Math.max(0.3, 1.1 * this.platformAspect), 1, Math.max(0.3, 1.1));
        if (!pull) return;
        const length = Math.min(maxLength, Math.hypot(pull.x, pull.z)), angle = Math.atan2(pull.x, pull.z);
        const zombieHeight = 2.0 + (origin.idleMotion?.height ?? 0);
        const half = length / 2;
        this.marker.setPosition(origin.x + Math.sin(angle) * half, zombieHeight, origin.z + Math.cos(angle) * half);
        this.marker.setScale(Math.max(0.05, length * this.arrowAspect), 1, Math.max(0.05, length));
        this.marker.setRotationFromEuler(0, angle * 180 / Math.PI, 0);
    }
    private createArrowNode(parent: Node, name: string): Node {
        const root = new Node(name);
        root.setParent(parent);
        const plane = new Node('ArrowPlane');
        plane.setParent(root);
        const mesh = utils.createMesh({
            positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5],
            normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
            uvs: [0, 1, 1, 1, 0, 0, 1, 0],
            indices: [0, 1, 2, 2, 1, 3],
        });
        const renderer = plane.addComponent(MeshRenderer);
        renderer.mesh = mesh;
        const material = new Material();
        material.initialize({
            effectName: 'builtin-unlit',
            defines: { USE_TEXTURE: true },
            states: {
                rasterizerState: { cullMode: gfx.CullMode.NONE },
                depthStencilState: { depthTest: true, depthWrite: false },
                blendState: { targets: [{
                    blend: true,
                    blendSrc: gfx.BlendFactor.SRC_ALPHA,
                    blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                    blendSrcAlpha: gfx.BlendFactor.ONE,
                    blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                }] },
            },
        });
        material.setProperty('mainColor', Color.WHITE);
        renderer.setSharedMaterial(material, 0);
        renderer.priority = ARROW_PRIORITY;
        this.aimMaterials.push(material);
        return root;
    }
    private createPlatformNode(parent: Node, name: string): Node {
        const root = new Node(name);
        root.setParent(parent);
        root.layer = parent.layer;
        const plane = new Node('PlatformPlane');
        plane.setParent(root);
        plane.layer = parent.layer;
        const mesh = utils.createMesh({
            positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5],
            normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
            uvs: [0, 0, 1, 0, 0, 1, 1, 1],
            indices: [0, 1, 2, 2, 1, 3],
        });
        const renderer = plane.addComponent(MeshRenderer);
        renderer.mesh = mesh;
        const material = new Material();
        material.initialize({
            effectName: 'builtin-unlit',
            defines: { USE_TEXTURE: true },
            states: {
                rasterizerState: { cullMode: gfx.CullMode.NONE },
                depthStencilState: { depthTest: false, depthWrite: false },
                blendState: { targets: [{
                    blend: true,
                    blendSrc: gfx.BlendFactor.SRC_ALPHA,
                    blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                    blendSrcAlpha: gfx.BlendFactor.ONE,
                    blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                }] },
            },
        });
        material.setProperty('mainColor', Color.WHITE);
        renderer.setSharedMaterial(material, 0);
        renderer.priority = PLATFORM_PRIORITY;
        this.platformMaterials.push(material);
        return root;
    }
    private makeArrowAlwaysVisible(node: Node): void {
        node.layer = ACTOR_LAYER;
        for (const child of node.children) {
            child.layer = ACTOR_LAYER;
        }
    }
    private loadArrowTexture(): void {
        const texture = this.settings.arrowSprite?.texture as Texture2D | null;
        if (texture) {
            this.arrowAspect = texture.width / Math.max(1, texture.height);
            for (const material of this.aimMaterials) material.setProperty('mainTexture', texture);
            return;
        }
        resources.load('Arrow', Texture2D, (err, loaded) => {
            if (err || !loaded) {
                console.warn('[ZombieRoad] Arrow texture failed to load', err);
                return;
            }
            this.arrowAspect = loaded.width / Math.max(1, loaded.height);
            for (const material of this.aimMaterials) material.setProperty('mainTexture', loaded);
        });
    }
    private loadPlatformTexture(): void {
        const sprite = this.settings.arrowPlatformSprite;
        // (debug removed)
        const texture = sprite?.texture as Texture2D | null;
        if (texture) {
            console.log('[ZombieRoad] platform sprite assigned, texture', texture.width, texture.height);
            this.platformAspect = texture.width / Math.max(1, texture.height);
            for (const material of this.platformMaterials) material.setProperty('mainTexture', texture);
            return;
        }
        console.warn('[ZombieRoad] arrowPlatformSprite is not assigned, trying resources/arrow_platform');
        resources.load('arrow_platform', Texture2D, (err, loaded) => {
            if (err || !loaded) {
                return;
            }
            this.platformAspect = loaded.width / Math.max(1, loaded.height);
            for (const material of this.platformMaterials) material.setProperty('mainTexture', loaded);
        });
    }
    destroy(): void {
        this.clearActors();
        for (const pool of this.pools.values()) pool.clear();
        for (const visuals of this.fallback.values()) for (const v of visuals) v.node.destroy();
        const arrowPlane = this.marker.getChildByName('ArrowPlane');
        const arrowRenderer = arrowPlane?.getComponent(MeshRenderer);
        if (arrowRenderer?.mesh) arrowRenderer.mesh.destroy();
        const platformPlane = this.platform.getChildByName('PlatformPlane');
        const platformRenderer = platformPlane?.getComponent(MeshRenderer);
        if (platformRenderer?.mesh) platformRenderer.mesh.destroy();
        this.environment.destroy(); this.obstacles.destroy(); this.actors.destroy(); this.aim.destroy(); this.marker.destroy();
        for (const material of this.aimMaterials) material.destroy();
        this.aimMaterials = [];
        this.sprites.destroy();
    }
    private get(key: string, kind: string, alive: Set<string>): Visual {
        alive.add(key);
        let visual = this.visuals.get(key);
        if (!visual) {
            visual = this.fallback.get(kind)?.pop();
            if (!visual) {
                const style = this.styleFor(kind);
                const sprite = style ? this.sprites.create(this.actors, kind, style) : undefined;
                const node = sprite?.root ?? this.pools.get(kind)?.get(this.actors) ?? this.primitives.actor(kind);
                if (this.root.scene?.getComponentInChildren(ForegroundLayers)) ForegroundLayers.actor(node);
                visual = { node, kind, sprite, animations: node.getComponentsInChildren(ActorAnimation) };
            }
            visual.node.setParent(this.actors); visual.node.active = true;
            visual.node.setRotationFromEuler(0, 0, 0);
            for (const animation of visual.animations) animation.reset();
            this.visuals.set(key, visual);
        }
        return visual;
    }
    private release(v: Visual): void {
        const pool = this.pools.get(v.kind);
        if (pool) pool.release(v.node);
        else {
            v.node.active = false; v.node.removeFromParent();
            const nodes = this.fallback.get(v.kind) ?? [];
            nodes.push(v); this.fallback.set(v.kind, nodes);
        }
    }
    private clearActors(): void { for (const v of this.visuals.values()) this.release(v); this.visuals.clear(); }
}
