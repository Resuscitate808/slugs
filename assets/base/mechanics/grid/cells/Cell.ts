import { _decorator, Vec2 } from 'cc';
import { CellType } from '../enums/CellType';
import { Position } from '../enums/Position';
import { Edge } from '../geometry/Edge';
const { ccclass } = _decorator;

@ccclass('Cell')
export abstract class Cell
{
    protected _type:CellType;

    protected _width:number;
    protected _height:number;

    protected _halfWidth:number;
    protected _halfHeight:number;

    protected _center:Vec2 = new Vec2();

    protected _vertices:Map<Position, Vec2> = new Map<Position, Vec2>();
    protected _edges:Map<Position, Edge> = new Map<Position, Edge>();

    public get type():CellType { return this._type; }
    public get width():number { return this._width; }
    public get height():number { return this._height; }
    public get halfWidth():number { return this._halfWidth; }
    public get halfHeight():number { return this._halfHeight; }
    public get center():Vec2 { return this._center; }
    public get vertices():Map<Position, Vec2> { return this._vertices; }
    public get edges():Map<Position, Edge> { return this._edges; }

    public getVertex(key:Position):Vec2
    {
        return this._vertices.get(key);
    }

    public getEdge(key:Position):Edge
    {
        return this._edges.get(key);
    }

    protected initialize():void
    {
        this._halfWidth = this._width / 2;
        this._halfHeight = this._height / 2;
        this._center.set(this._halfWidth, this._halfHeight);
        
        this.setVertices();
        this.setEdges();
    }

    protected abstract setVertices():void;
    protected abstract setEdges():void;
}