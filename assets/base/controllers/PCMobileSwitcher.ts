import { _decorator, Component, Node, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PCMobileSwithcer')
export class PCMobileSwithcer extends Component {
    @property({ type: Node })
    private pcBLock: Node;

    @property({ type: Node })
    private mobileBlock: Node;

    protected onEnable(): void {
        this.mobileBlock.active = sys.isMobile;
        this.pcBLock.active = !sys.isMobile;
    }
}

