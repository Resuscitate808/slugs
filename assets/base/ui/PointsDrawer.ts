import { _decorator, Component, Node, Mat4, Vec3, Prefab } from 'cc';
import { SmartNodePool } from '../pools/SmartNodePool';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('PointsDrawer')
export class PointsDrawer extends Component {
   
    @property({type:Prefab})
    private pointPrefab:Prefab;

    @property
    private startCapacity = 5;

    @property
    private changeSibling:boolean = false;

    @property
    private siblingIndex = 0;

    private _objects: Node[] = [];
    private _smartPool:SmartNodePool;
    private _scratchLocalPos = new Vec3();
    private _scratchInvWorldMat = new Mat4();

    protected onLoad(): void {
        this._smartPool = new SmartNodePool(this.pointPrefab, this.startCapacity);
    }


    public addPoint(newObj: Node) {
        if (this.changeSibling){
            this.node.setSiblingIndex(this.siblingIndex);
        }
        const worldPos = newObj.worldPosition;
        const localPos = this._scratchLocalPos;
        const invWorldMat = this._scratchInvWorldMat;
        Mat4.invert(invWorldMat, this.node.parent.getWorldMatrix());
        Vec3.transformMat4(localPos, worldPos, invWorldMat);

        let obj = this._smartPool.get(this.node);
        this._objects.push(obj);
        obj.setPosition(localPos);
    }

    public removeLast(){
        let last = this._objects.pop();
        last.active = false;
        this._smartPool.release(last);
    }

    public clearPoints() {
        this._objects.forEach(x => {
            x.active = false;
            this._smartPool.release(x);
        });

        this._objects = [];
    }

}