import { _decorator, Component, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DontDestroyOnLoad')
export class DontDestroyOnLoad extends Component {
    protected onLoad(): void {
        director.addPersistRootNode(this.node);
    }
}

