import { _decorator, Vec2 } from 'cc';
import { Cell } from './Cell';
import { Edge } from '../geometry/Edge';
import { CellType } from '../enums/CellType';
import { Position } from '../enums/Position';
const { ccclass } = _decorator;

@ccclass('CellFromRectangle')
export class CellFromRectangle extends Cell
{
    constructor(width:number, height:number)
    {
        super();

        this._type = CellType.RECTANGLE;
        this._width = width;
        this._height = height;
        
        this.initialize();
    }

    protected override setVertices():void
    {
        // INFO: точки углов формируются против часовой стрелки слева направо и снизу вверх
        this._vertices.set(Position.LB, new Vec2(0, 0));
        this._vertices.set(Position.RB, new Vec2(this._width, 0));
        this._vertices.set(Position.RT, new Vec2(this._width, this._height));
        this._vertices.set(Position.LT, new Vec2(0, this._height));
    }

    protected override setEdges():void
    {
        // INFO: рёбра формируются против часовой стрелки для корректной работы алгоритма PointToEdgeDistance слева направо снизу вверх
        this._edges.set(Position.B, new Edge(this.getVertex(Position.LB), this.getVertex(Position.RB)));
        this._edges.set(Position.R, new Edge(this.getVertex(Position.RB), this.getVertex(Position.RT)));
        this._edges.set(Position.T, new Edge(this.getVertex(Position.RT), this.getVertex(Position.LT)));
        this._edges.set(Position.L, new Edge(this.getVertex(Position.LT), this.getVertex(Position.LB)));
    }
}