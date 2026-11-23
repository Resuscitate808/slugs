import { Color, Material, Mesh, MeshRenderer, Node, primitives, utils } from 'cc';
export class Primitives {
    private mesh: Mesh = utils.createMesh(primitives.box());
    private materials = new Map<string, Material>();
    box(parent: Node, name: string, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number): Node {
        const node = new Node(name);
        node.setParent(parent); node.setPosition(x, y, z); node.setScale(sx, sy, sz);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = this.mesh;
        let material = this.materials.get(color);
        if (!material) {
            material = new Material();
            material.initialize({ effectName: 'builtin-unlit' });
            material.setProperty('mainColor', new Color().fromHEX(color));
            this.materials.set(color, material);
        }
        renderer.setSharedMaterial(material, 0);
        return node;
    }
    actor(kind: string): Node {
        const root = new Node(kind);
        if (kind === 'zombie' || kind === 'driver') {
            const skin = kind === 'zombie' ? '#a8d86f' : '#f0c49a';
            this.box(root, 'Body', kind === 'zombie' ? '#41695e' : '#edb34e', 0, 0.65, 0, 0.48, 0.65, 0.32);
            this.box(root, 'Head', skin, 0, 1.13, 0, 0.42, 0.4, 0.4);
            for (const x of [-0.16, 0.16]) this.box(root, 'Leg', '#253e41', x, 0.19, 0, 0.18, 0.38, 0.22);
            for (const x of [-0.34, 0.34]) this.box(root, 'Arm', skin, x, 0.73, 0.12, 0.16, 0.18, 0.55);
            for (const x of [-0.1, 0.1]) this.box(root, 'Eye', '#142d2d', x, 1.17, 0.21, 0.08, 0.07, 0.03);
        } else if (kind === 'blood') {
            this.box(root, 'Pool', '#7b263e', 0, 0.025, 0, 1.5, 0.035, 1.25);
        } else {
            const color = kind === 'jeep' ? '#202d37' : kind === 'pink' ? '#f17fac' : '#e8be59';
            this.box(root, 'Chassis', color, 0, 0.45, 0, 1.15, 0.5, 2.3);
            this.box(root, 'Cabin', kind === 'jeep' ? '#364957' : '#83c1cb', 0, 0.89, -0.18, 0.96, 0.48, 1.1);
            for (const x of [-0.6, 0.6]) for (const z of [-0.73, 0.73]) this.box(root, 'Wheel', '#17262d', x, 0.24, z, 0.18, 0.44, 0.44);
            for (const x of [-0.37, 0.37]) this.box(root, 'Light', '#fff1bc', x, 0.48, 1.16, 0.23, 0.16, 0.04);
        }
        return root;
    }
    destroy(): void {
        this.mesh.destroy();
        for (const material of this.materials.values()) material.destroy();
        this.materials.clear();
    }
}
