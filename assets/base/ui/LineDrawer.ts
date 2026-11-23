import { _decorator, Component, Graphics, Vec2, Color, CCFloat, CCInteger, Node, UITransform, Mat4, Vec3 } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('LineDrawer')
@executeInEditMode
export class LineDrawer extends Component {

    @property({ type: [Vec2], tooltip: 'Массив точек для отрисовки' })
    public points: Vec2[] = [];

    @property({ tooltip: 'Толщина линий' })
    public lineWidth: number = 5;

    @property({ tooltip: 'Цвет линий' })
    public lineColor: Color = Color.WHITE.clone();

    @property({ tooltip: 'Радиус кружков в точках' })
    public circleRadius: number = 10;

    @property({ tooltip: 'Цвет кружков' })
    public circleColor: Color = Color.RED.clone();

    private _graphics: Graphics | null = null;
    private _scratchLocalPos = new Vec3();
    private _scratchInvWorldMat = new Mat4();


    onLoad() {
        this._graphics = this.getComponent(Graphics);
        if (!this._graphics) {
            this._graphics = this.addComponent(Graphics);
        }
    }

    start() {
        this.redraw();
    }

    onValidate() {
        this.redraw();
    }

    public clear() {
        this._graphics.clear();
    }


    public redraw() {
        if (!this._graphics || this.points.length === 0) return;


        this._graphics.clear();

        this.node.setSiblingIndex(this.node.parent.children.length - 1);

        if (this.points.length > 1) {
            this._graphics.lineWidth = this.lineWidth;
            this._graphics.strokeColor = this.lineColor;

            this._graphics.moveTo(this.points[0].x, this.points[0].y);


            for (let i = 1; i < this.points.length; i++) {
                this._graphics.lineTo(this.points[i].x, this.points[i].y);
            }
            this._graphics.stroke();
        }


        if (this.circleRadius > 0) {
            this._graphics.fillColor = this.circleColor;

            for (let i = 0; i < this.points.length; i++) {
                const pt = this.points[i];
                this._graphics.circle(pt.x, pt.y, this.circleRadius);
                this._graphics.fill();
            }
        }
    }

    public setPoints(newPoints: Node[], delay: number = 0) {
        setTimeout(() => {
            const invWorldMat = this._scratchInvWorldMat;
            Mat4.invert(invWorldMat, this.node.parent.getWorldMatrix());
            const localPos = this._scratchLocalPos;

            for (let i = 0; i < newPoints.length; i++) {
                const worldPos = newPoints[i].worldPosition;
                Vec3.transformMat4(localPos, worldPos, invWorldMat);
                if (i < this.points.length) {
                    this.points[i].set(localPos.x, localPos.y);
                } else {
                    this.points.push(new Vec2(localPos.x, localPos.y));
                }
            }
            this.points.length = newPoints.length;

            this.redraw();
        }, delay);
    }

}