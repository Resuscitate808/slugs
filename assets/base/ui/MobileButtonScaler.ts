import { _decorator, Component, Node, sys, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MobileButtonScaler')
export class MobileButtonScaler extends Component
{
    onLoad()
    {
        if (sys.isMobile)
        {
            this.node.scale = new Vec3(1.3, 1.3, 1);
        }
    }
}