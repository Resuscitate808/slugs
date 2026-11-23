import { _decorator, Component, input, Input, Camera, Vec2, Vec3, UITransform, EventTouch, EventMouse, Node, NodeEventType } from 'cc';
const { ccclass, property } = _decorator;

type ClickCallback = (position: Vec3) => void;
type ZoomCallback = (value: number, minScale: number, maxScale: number) => void;

@ccclass('Zoom')
export class Zoom extends Component {

    @property
    private maxScale: number = 2;

    @property
    private zoomStep: number = 0.1;

    @property({ type: Camera })
    private camera: Camera = null;

    private _uiTransform: UITransform = null;
    private _scale: number = 1;
    private _initialDistance: number = 0;
    private _initialScale: number = 1;

    private _isDragging: boolean = false;
    private _lastPosition: Vec2 = new Vec2();
    private _touchStartPosition: Vec2 = new Vec2();

    private _clickListeners: ClickCallback[] = [];
    private _zoomListeners: ZoomCallback[] = [];

    protected onLoad(): void {

        this.node.on(NodeEventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(NodeEventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(NodeEventType.TOUCH_END, this.onTouchEnd, this);

        this.node.on(NodeEventType.MOUSE_WHEEL, this.onMouseWheel, this);

        this._uiTransform = this.node.getComponent(UITransform);
    }

    protected onDestroy() {

        this.node.off(NodeEventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(NodeEventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(NodeEventType.TOUCH_END, this.onTouchEnd, this);

        this.node.off(NodeEventType.MOUSE_WHEEL, this.onMouseWheel, this);
    }

    /**
     * Передает значение от 0 до 1
     *
     * @param fraction - значение от 0 до 1
     * @public
     */
    public zoomFraction(fraction: number) {
        let minScale = 1;
        let dif = this.maxScale - minScale;
        this._scale = minScale + dif * fraction;
        this.node.setScale(new Vec3(this._scale, this._scale, this._scale));

        this.clampPosition();

        this._zoomListeners.forEach(callback => callback((this._scale - 1) / (this.maxScale - 1), 1, this.maxScale));
    }

    public zoomIn() {
        this._scale += this.zoomStep;
        this._scale = Math.min(Math.max(this._scale, 1), this.maxScale);
        this.node.setScale(new Vec3(this._scale, this._scale, this._scale));

        this._zoomListeners.forEach(callback => callback((this._scale - 1) / (this.maxScale - 1), 1, this.maxScale));
    }

    public zoomOut() {
        this._scale -= this.zoomStep;
        this._scale = Math.min(Math.max(this._scale, 1), this.maxScale);
        this.node.setScale(new Vec3(this._scale, this._scale, this._scale));

        this.clampPosition();

        this._zoomListeners.forEach(callback => callback((this._scale - 1) / (this.maxScale - 1), 1, this.maxScale));
    }

    public onScreenClick(callback: ClickCallback) {
        this._clickListeners.push(callback);
    }

    public onZoomChanged(callback: ZoomCallback) {
        this._zoomListeners.push(callback);
    }

    public offZoomChanged(callback: ZoomCallback) {
        const index = this._zoomListeners?.indexOf(callback);
        if (index > -1) {
            this._zoomListeners.splice(index, 1);
        }
    }

    public offScreenClick(callback: ClickCallback) {
        const index = this._clickListeners?.indexOf(callback);
        if (index > -1) {
            this._clickListeners.splice(index, 1);
        }
    }

    private onTouchStart(event: EventTouch) {
        const touches = event.getAllTouches();
        if (touches.length === 2) {
            const touch1 = touches[0];
            const touch2 = touches[1];
            this._initialDistance = this.getDistanceBetweenPoints(
                touch1.getLocation().x,
                touch1.getLocation().y,
                touch2.getLocation().x,
                touch2.getLocation().y
            );
            this._initialScale = this._scale;
        } else if (touches.length === 1) {
            const touchPos = touches[0].getLocation();
            this._isDragging = true;
            this._lastPosition.set(touchPos);
            this._touchStartPosition.set(touchPos);
        }
    }

    private onTouchMove(event: EventTouch) {
        const touches = event.getAllTouches();
        if (touches.length === 2) {
            const touch1 = touches[0];
            const touch2 = touches[1];
            const currentDistance = this.getDistanceBetweenPoints(
                touch1.getLocation().x,
                touch1.getLocation().y,
                touch2.getLocation().x,
                touch2.getLocation().y
            );

            const scaleFactor = currentDistance / this._initialDistance;
            let newScale = this._initialScale * scaleFactor;

            // Ограничиваем масштаб
            this._scale = Math.min(Math.max(newScale, 1), this.maxScale);
            this.node.setScale(new Vec3(this._scale, this._scale, this._scale));

            this._zoomListeners.forEach(callback => callback((this._scale - 1) / (this.maxScale - 1), 1, this.maxScale));

            this.clampPosition();
        } else if (touches.length === 1 && this._isDragging) {
            const touchPos = touches[0].getLocation();
            const delta = new Vec3(
                touchPos.x - this._lastPosition.x,
                touchPos.y - this._lastPosition.y,
                0
            );
            this._lastPosition.set(touchPos);

            this.node.setPosition(new Vec3(this.node.position.x + delta.x, this.node.position.y + delta.y, 0));

            this.clampPosition();
        }
    }

    private onTouchEnd() {
        this._initialDistance = 0;
        
        const delta = new Vec3(
                this._touchStartPosition.x - this._lastPosition.x,
                this._touchStartPosition.y - this._lastPosition.y,
                0
            );

        if (delta.length() < 10 && 
            this._isDragging &&
            this.camera) {

            const screenPos = this._lastPosition;

            const worldPos = this.camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0));

            this._clickListeners.forEach(callback => callback(worldPos));
        }
        this._isDragging = false;
    }

    private onMouseWheel(event: EventMouse) {
        // Получаем значение прокрутки (deltaY положительный - скролл вниз, отрицательный - вверх)
        const scrollDelta = event.getScrollY();

        // Изменяем масштаб в зависимости от направления прокрутки
        if (scrollDelta > 0) {
            this._scale -= this.zoomStep; // Уменьшаем при прокрутке вниз
        } else {
            this._scale += this.zoomStep; // Увеличиваем при прокрутке вверх
        }

        // Ограничиваем масштаб
        this._scale = Math.min(Math.max(this._scale, 1), this.maxScale);
        this.node.setScale(new Vec3(this._scale, this._scale, this._scale));

        this.clampPosition();



        this._zoomListeners.forEach(callback => callback((this._scale - 1) / (this.maxScale - 1), 1, this.maxScale));
    }

    private getDistanceBetweenPoints(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private clampPosition() {
        const newPosition = new Vec3(
            this.node.position.x,
            this.node.position.y,
            0
        );

        const { minX, maxX, minY, maxY } = this.getPositionLimits();

        newPosition.x = Math.min(Math.max(newPosition.x, minX), maxX);
        newPosition.y = Math.min(Math.max(newPosition.y, minY), maxY);

        this.node.setPosition(newPosition);
    }

    private getPositionLimits(): { minX: number, maxX: number, minY: number, maxY: number } {
        const roomSize = this._uiTransform.contentSize;

        const maxX = Math.abs((1 - this._scale) * roomSize.width / 2);
        const minX = - maxX;
        const maxY = Math.abs((1 - this._scale) * roomSize.height / 2);
        const minY = - maxY;
        return { minX, maxX, minY, maxY };
    }
}

