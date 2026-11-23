import { _decorator, Size, Vec2, Vec3 } from 'cc';
import { Cell } from '../cells/Cell';
import { Position } from '../enums/Position';
import { Edge } from '../geometry/Edge';
import { Shape } from '../shapes/Shape';
import { CellType } from '../enums/CellType';
const { ccclass } = _decorator;

@ccclass('Grid')
export abstract class Grid
{
    public originPosition:Vec2 = new Vec2();

    protected _cell:Cell;
    protected _gap:Vec2;
    protected _defineQuadrant:boolean = false;

    protected _offset:Vec2 = new Vec2();
    protected _distance:Vec2 = new Vec2();

    protected readonly neighbors:Map<Position, Vec2> = new Map<Position, Vec2>();
    protected readonly diagonals:Map<Position, Vec2> = new Map<Position, Vec2>();
    
    protected readonly neighborsShifted:Map<Position, Vec2> = new Map<Position, Vec2>();
    protected readonly diagonalsShifted:Map<Position, Vec2> = new Map<Position, Vec2>();

    protected _position:Position;

    private _tempPoint:Vec2 = new Vec2();
    private _tempEdge:Edge = new Edge();

    constructor(cell:Cell, gap:Vec2)
    {
        this._cell = cell;
        this._gap = gap;
    }

    public abstract gridToScreen(gridPoint:Vec2):Vec2;
    public abstract screenToGrid(screenPoint:Vec2):[Position, Vec2];
    public abstract getCellNeighbor(gridCell:Vec2, direction:Position):Vec2;
    public abstract getCellNeighbors(gridCell:Vec2):Map<Position, Vec2>;
    public abstract getShapeSize(shape:Shape):Size; // размер фигуры по границам в этой сетке, по сути bounding box

    protected abstract setNeighbors():void;
    protected abstract calculateGridSpecificPrameters():void;

    protected initialize():void
    {
        this.setNeighbors();
        this.calculateGridSpecificPrameters();
    }

    protected isPointInside(screenPoint:Vec2, gridToScreenPoint:Vec2, defineQuadrant:boolean):Position
    {
        if (this._cell.type == CellType.ELLIPSE)
        {
            let tempPoint:Vec2 = this._cell.center.clone().add(gridToScreenPoint);
            let ellipseHit:number = Math.pow(screenPoint.x - tempPoint.x, 2) / Math.pow(this._cell.halfWidth, 2)
                                + Math.pow(screenPoint.y - tempPoint.y, 2) / Math.pow(this._cell.halfHeight, 2);
            
            // ellipseHit > 1 находимся за эллипсом
            // _tempOvalHit == 1 находимся на краю эллипса ellipseHit < 1 находимся внутри эллипса
            if (ellipseHit > 1)
                return defineQuadrant ? this.defineQuadrant(screenPoint, tempPoint) : Position.OUT;
            else
                return Position.IN;
        }
        else
        {
            return this.checkEdges(screenPoint, gridToScreenPoint, defineQuadrant);
        }
    }

    public defineQuadrant(screenPoint:Vec2, centerPoint:Vec2):Position
    {
        if (screenPoint.x <= centerPoint.x)
            return screenPoint.y >= centerPoint.y ? Position.LT : Position.LB;
        else
            return screenPoint.y >= centerPoint.y ? Position.RT : Position.RB;
    }

    protected checkEdges(screenPoint:Vec2, gridToScreenPoint:Vec2, defineQuadrant:boolean):Position
    {
        this._tempPoint.set(this._cell.center);
        this._tempPoint.add(gridToScreenPoint);

        for (let [key, value] of this._cell.edges)
        {
            this._tempEdge.set(value);
            this._tempEdge.add(gridToScreenPoint);

            if (this._tempEdge.isPointOutOfEdge(screenPoint))
                return defineQuadrant ? this.defineQuadrant(screenPoint, this._tempPoint) : key;
        }

        return Position.IN;
    }

    protected getNeighbor(gridCell:Vec2, direction:Position):Vec2
    {
        let resultCell:Vec2 = gridCell.clone();
        
        if (this.neighbors.has(direction))
            return resultCell.add(this.neighbors.get(direction));
        else
            return null;
    }

    protected getNeighborShifted(gridCell:Vec2, direction:Position, notFromShifted:boolean):Vec2
    {
        let resultCell:Vec2 = gridCell.clone();
        
        if (notFromShifted)
            return resultCell.add(this.neighbors.get(direction));
        else
            return resultCell.add(this.neighborsShifted.get(direction));
    }

    protected getNeighborShiftedByX(gridCell:Vec2, direction:Position):Vec2
    {
        return this.getNeighborShifted(gridCell, direction, gridCell.x % 2 == 0);
    }

    protected getNeighborShiftedByY(gridCell:Vec2, direction:Position):Vec2
    {
        return this.getNeighborShifted(gridCell, direction, gridCell.y % 2 == 0);
    }
    
    protected getNeighbors(gridCell:Vec2):Map<Position, Vec2>
    {
        return this.neighbors;
    }

    protected getNeighborsShifted(notFromShifted:boolean):Map<Position, Vec2>
    {
        if (notFromShifted)
            return this.neighbors;
        else
            return this.neighborsShifted;
    }

    protected getNeighborsShiftedByX(gridCell:Vec2):Map<Position, Vec2>
    {
        return this.getNeighborsShifted(gridCell.x % 2 == 0);
    }
    
    protected getNeighborsShiftedByY(gridCell:Vec2):Map<Position, Vec2>
    {
        return this.getNeighborsShifted(gridCell.y % 2 == 0);
    }

    public getDistance(gridStartPos:Vec2, gridEndPos:Vec2):number
    {
        return Vec2.distance(gridStartPos, gridEndPos);
    }

    public offsetToCube(vec:Vec3):Vec3
    {
        return vec;
    }

    protected cubeDistance(from:Vec3, to:Vec3):number
    {
        return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y), Math.abs(from.z - to.z));
    }
}