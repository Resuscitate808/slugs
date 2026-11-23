import { _decorator, BatchingUtility, Component, MeshRenderer, CCBoolean } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameStaticBatch')
export class GameStaticBatch extends Component {

    @property
    private shadowCastingMode:boolean = false;


    protected onLoad(): void {
        BatchingUtility.batchStaticModel(this.node, this.node);
        this.node.getComponent(MeshRenderer).shadowCastingMode = this.shadowCastingMode ? 1 : 0;
    }
}

