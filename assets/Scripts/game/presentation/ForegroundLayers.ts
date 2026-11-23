import { _decorator, Camera, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

export const ACTOR_LAYER = 1 << 19;
export const FOREGROUND_LAYER = 1 << 20;

@ccclass('ForegroundLayers')
export class ForegroundLayers extends Component {
    @property(Camera) hudCamera: Camera | null = null;
    @property(Camera) foregroundCamera: Camera | null = null;
    @property(Camera) actorCamera: Camera | null = null;
    private worldCamera: Camera | null = null;

    bind(camera: Camera): void {
        this.worldCamera = camera;
        camera.visibility &= ~(ACTOR_LAYER | FOREGROUND_LAYER);
        if (this.foregroundCamera) this.foregroundCamera.priority = camera.priority + 1;
        if (this.actorCamera) this.actorCamera.priority = camera.priority + 2;
        this.lateUpdate();
    }

    lateUpdate(): void {
        if (this.hudCamera && this.foregroundCamera) {
            this.foregroundCamera.orthoHeight = this.hudCamera.orthoHeight;
            this.foregroundCamera.node.setWorldPosition(this.hudCamera.node.worldPosition);
            this.foregroundCamera.node.setWorldRotation(this.hudCamera.node.worldRotation);
            this.foregroundCamera.rect = this.hudCamera.rect;
        }
        const source = this.worldCamera, target = this.actorCamera;
        if (!source || !target) return;
        target.node.setWorldPosition(source.node.worldPosition);
        target.node.setWorldRotation(source.node.worldRotation);
        target.projection = source.projection;
        target.orthoHeight = source.orthoHeight;
        target.fov = source.fov;
        target.near = source.near;
        target.far = source.far;
        target.rect = source.rect;
        target.visibility = ACTOR_LAYER;
    }

    static actor(node: Node): void {
        node.layer = ACTOR_LAYER;
        for (const child of node.children) ForegroundLayers.actor(child);
    }
}
