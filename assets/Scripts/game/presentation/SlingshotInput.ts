import { Camera, EventMouse, EventTouch, Input, input, geometry, game, Game, view } from 'cc';
import { Point, Zombie, activeZombie } from '../domain/Model';
import { World } from '../domain/World';
import { WorldView } from './WorldView';
import { playableFraction } from './ScreenFit';

export class SlingshotInput {
    private selected = 0;
    private held: Zombie | null = null;
    private origin: Point | null = null;
    private pull: Point = { x: 0, z: 0 };
    private touchId: number | null = null;
    private touchActive = false;
    private lastTouchTime = 0;
    private ray = new geometry.Ray();
    get aiming(): boolean { return this.selected !== 0; }

    constructor(private camera: Camera, private world: () => World, private view: WorldView, private enabled: () => boolean = () => true,
        private picker?: { armed: () => boolean; pick: (id: number) => void }) {
        input.on(Input.EventType.MOUSE_DOWN, this.mouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.mouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.mouseUp, this);
        input.on(Input.EventType.TOUCH_START, this.touchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.cancel, this);
        game.on(Game.EVENT_HIDE, this.cancel, this);
    }
    cancel(): void {
        if (this.held) delete this.held.aimHeld;
        this.held = null;
        this.selected = 0; this.origin = null; this.touchId = null; this.touchActive = false; this.view.showAim(null, null);
    }
    destroy(): void {
        input.off(Input.EventType.MOUSE_DOWN, this.mouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.mouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.mouseUp, this);
        input.off(Input.EventType.TOUCH_START, this.touchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.cancel, this);
        game.off(Game.EVENT_HIDE, this.cancel, this);
        this.cancel();
    }
    private point(x: number, y: number): Point | null {
        this.camera.screenPointToRay(x, y, this.ray);
        if (Math.abs(this.ray.d.y) < 0.0001) return null;
        const t = -this.ray.o.y / this.ray.d.y;
        if (t < 0) return null;
        return { x: this.ray.o.x + this.ray.d.x * t, z: this.ray.o.z + this.ray.d.z * t };
    }
    private start(x: number, y: number, uiY: number): void {
        const world = this.world();
        if (!this.enabled() || world.paused || world.result || this.selected) return;
        if (!this.playArea(uiY)) return;
        if (this.picker?.armed()) { this.pickTarget(world, x, y); return; }
        const p = this.point(x, y);
        if (!p) return;
        let nearest = 45;
        world.zombies.forEach((z, index) => {
            if (z.state !== 'idle') return;
            const screen = this.camera.worldToScreen(this.view.zombiePickPosition(z.x, z.z, index, z.idleMotion?.height ?? 0));
            const d = Math.hypot(screen.x - x, screen.y - y);
            if (d < nearest) { nearest = d; this.selected = z.id; }
        });
        if (this.selected) {
            this.held = world.zombies.find(z => z.id === this.selected)!;
            this.held.aimHeld = true;
            this.origin = p; this.pull = { x: 0, z: 0 };
        }
    }
    private pickTarget(world: World, x: number, y: number): void {
        let nearest = 60, id = 0;
        world.zombies.forEach((z, index) => {
            if (!activeZombie(z)) return;
            const screen = this.camera.worldToScreen(this.view.zombiePickPosition(z.x, z.z, index, z.state === 'walking' || z.state === 'idle' ? z.idleMotion?.height ?? 0 : 0));
            const d = Math.hypot(screen.x - x, screen.y - y);
            if (d < nearest) { nearest = d; id = z.id; }
        });
        if (id) this.picker!.pick(id);
    }
    private move(x: number, y: number): void {
        if (!this.origin || !this.selected) return;
        const world = this.world(), z = world.zombies.find(z => z.id === this.selected);
        if (!this.enabled() || world.paused || world.result || !z || z !== this.held || z.state !== 'idle') { this.cancel(); return; }
        const p = this.point(x, y);
        if (!p) return;

        this.pull = { x: p.x - this.origin.x, z: p.z - this.origin.z };
        this.update();
    }
    update(): void {
        if (!this.selected) return;
        const world = this.world(), z = world.zombies.find(z => z.id === this.selected);
        if (!this.enabled() || world.paused || world.result || !z || z !== this.held || z.state !== 'idle') { this.cancel(); return; }
        if (this.pull.z >= 0 || Math.hypot(this.pull.x, this.pull.z) < 0.25) {
            this.view.showAim(z, null);
            return;
        }
        if (world.config.levelTable) this.view.showAim(z, world.launchVector(this.pull), Infinity);
        else this.view.showAim(z, this.pull);
    }
    private playArea(uiY: number): boolean {
        if (!this.enabled()) return false;
        const height = view.getVisibleSize().height;
        if (!(height > 0)) return false;
        return uiY >= 0 && uiY <= height * playableFraction(height) + 40;
    }
    private end(x: number, y: number, uiY: number): void {
        if (!this.playArea(uiY)) { this.cancel(); return; }
        this.move(x, y);
        if (this.selected && this.pull.z < 0) this.world().launch(this.selected, this.pull);
        this.cancel();
    }
    private mouseDown(e: EventMouse): void {
        if (e.getButton() !== EventMouse.BUTTON_LEFT) return;
        if (this.touchActive) return;
        if (Date.now() - this.lastTouchTime < 500) return;
        this.start(e.getLocationX(), e.getLocationY(), e.getUILocation().y);
    }
    private mouseMove(e: EventMouse): void {
        if (this.touchActive) return;
        if (this.touchId !== null && Date.now() - this.lastTouchTime < 500) return;
        this.move(e.getLocationX(), e.getLocationY());
    }
    private mouseUp(e: EventMouse): void {
        if (e.getButton() !== EventMouse.BUTTON_LEFT) return;
        if (this.touchActive) return;
        if (this.touchId !== null && Date.now() - this.lastTouchTime < 500) return;
        this.end(e.getLocationX(), e.getLocationY(), e.getUILocation().y);
    }
    private touchStart(e: EventTouch): void {
        if (this.touchActive) return;
        this.touchActive = true;
        this.touchId = e.getID();
        this.lastTouchTime = Date.now();
        const p = e.getLocation();
        this.start(p.x, p.y, e.getUILocation().y);
    }
    private touchMove(e: EventTouch): void {
        if (!this.touchActive || this.touchId !== e.getID()) return;
        const p = e.getLocation();
        this.move(p.x, p.y);
    }
    private touchEnd(e: EventTouch): void {
        if (!this.touchActive || this.touchId !== e.getID()) return;
        const p = e.getLocation();
        this.end(p.x, p.y, e.getUILocation().y);
        this.touchActive = false;
        this.touchId = null;
    }
}