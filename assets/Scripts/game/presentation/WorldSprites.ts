import { Camera, Color, gfx, Material, Mesh, MeshRenderer, Node, Quat, SpriteFrame, utils } from 'cc';
import { SpriteStyle } from './SpriteStyle';

interface SpriteResource { mesh: Mesh; material: Material }
export interface SpriteVisual { root: Node; plane: Node; style: SpriteStyle }
export class WorldSprites {
    private resources = new Map<SpriteFrame, SpriteResource>();
    private vehicleResources = new Map<SpriteFrame, SpriteResource>();
    private rotation = new Quat();
    constructor(private camera: Camera) {}
    create(parent: Node, name: string, style: SpriteStyle): SpriteVisual {
        const frame = style.frame!;
        const translucent = name === 'ordinary' || name === 'jeep' || name === 'pink'
            || name === 'zombie' || name.startsWith('zombie#');
        const resources = translucent ? this.vehicleResources : this.resources;
        let resource = resources.get(frame);
        if (!resource) {
            const mesh = utils.createMesh({
                positions: [-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0],
                normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
                uvs: Array.from(frame.uv), indices: [0, 1, 2, 2, 1, 3],
            });
            const material = new Material();
            material.initialize({
                effectName: 'builtin-unlit', defines: { USE_TEXTURE: true, USE_ALPHA_TEST: true },
                states: {
                    rasterizerState: { cullMode: gfx.CullMode.NONE },
                    ...(translucent ? {
                        depthStencilState: { depthTest: true, depthWrite: false },
                        blendState: { targets: [{
                            blend: true,
                            blendSrc: gfx.BlendFactor.SRC_ALPHA,
                            blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                            blendSrcAlpha: gfx.BlendFactor.ONE,
                            blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                        }] },
                    } : {}),
                },
            });
            material.setProperty('mainTexture', frame.texture);
            material.setProperty('mainColor', Color.WHITE);
            material.setProperty('alphaThreshold', translucent ? 1 / 255 : 0.1);
            resource = { mesh, material }; resources.set(frame, resource);
        }
        const root = new Node(name); root.setParent(parent);
        const plane = new Node('SpritePlane'); plane.setParent(root);
        const renderer = plane.addComponent(MeshRenderer);
        renderer.mesh = resource.mesh; renderer.setSharedMaterial(resource.material, 0);
        const visual = { root, plane, style };
        this.pose(visual, 0, 0, 0);
        return visual;
    }
    pose(v: SpriteVisual, x: number, y: number, z: number, directionX = 1, heading = 0, fallen = false, extraRotation = 0): void {
        const s = v.style, frame = s.frame!;
        const width = Math.max(0.05, s.width);
        const height = s.height > 0 ? s.height : width * frame.originalSize.height / Math.max(1, frame.originalSize.width);
        v.root.setPosition(x, y + s.lift, z);
        if (s.billboard) v.root.setWorldRotation(this.camera.node.worldRotation);
        else v.root.setRotationFromEuler(-90, 0, 0);
        const angle = s.rotation + extraRotation + (fallen ? 80 : 0) + (!s.billboard && s.flipWithDirection ? heading - 180 : 0);
        Quat.fromEuler(this.rotation, 0, 0, angle);
        v.plane.setRotation(this.rotation);
        const flip = s.billboard && s.flipWithDirection && directionX < -0.01 ? -1 : 1;
        const size = frame.originalSize, rect = frame.rect, offset = frame.offset;
        v.plane.setScale(flip * width * rect.width / size.width, height * rect.height / size.height, 1);
        v.plane.setPosition(flip * width * offset.x / size.width, (s.bottomAnchor ? height / 2 : 0) + height * offset.y / size.height, 0);
    }
    destroy(): void {
        for (const r of this.resources.values()) { r.mesh.destroy(); r.material.destroy(); }
        for (const r of this.vehicleResources.values()) { r.mesh.destroy(); r.material.destroy(); }
        this.resources.clear(); this.vehicleResources.clear();
    }
}
