import { _decorator, CCString, Component, instantiate, Node, Prefab, Quat, Vec3 } from 'cc';
import { IBundleManager } from './BundleManager';
import { Inject } from './ServiceLocator';
const { ccclass, property } = _decorator;

@ccclass('BundlePrefabLoader')
export class BundlePrefabLoader extends Component {
    @property
    private position:Vec3 = new Vec3();

    @property
    private rotation:Vec3 = new Vec3();

    @property({type:CCString})
    private namePrefab:string;

    @Inject(IBundleManager)
    private bundleManager!: IBundleManager;

    
    protected onLoad(): void {
        this.bundleManager.loadPrefab(this.namePrefab, (prefab:Prefab)=>{
            let objeto = instantiate(prefab);
            objeto.parent = this.node.parent;

            objeto.worldPosition = this.position;
            objeto.rotation = Quat.fromEuler(new Quat(), this.rotation.x, this.rotation.y, this.rotation.z);
        });
    }
}

