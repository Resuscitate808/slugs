import { _decorator } from 'cc';
import { Cell } from './Cell';
import { CellType } from '../enums/CellType';
const { ccclass } = _decorator;

@ccclass('CellFromEllipse')
export class CellFromEllipse extends Cell
{
    constructor(width:number, height:number)
    {
        super();

        this._type = CellType.ELLIPSE;

        this._width = width;
        this._height = height;
        
        this.initialize();
    }

    protected override setVertices():void
    {
        
    }

    protected override setEdges():void
    {
        
    }
}