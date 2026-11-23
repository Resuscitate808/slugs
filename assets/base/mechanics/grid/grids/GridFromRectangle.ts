import { _decorator, Component, Node, Size, Vec2 } from 'cc';
import { Grid } from './Grid';
import { Cell } from '../cells/Cell';
import { Position } from '../enums/Position';
import { Shape } from '../shapes/Shape';
const { ccclass, property } = _decorator;

@ccclass('GridFromRectangle')
export class GridFromRectangle extends Grid
{
    constructor(cell:Cell, gap:Vec2)
    {
        super(cell, gap);
        
        this.initialize();
    }

    public override gridToScreen(gridPoint:Vec2):Vec2
    {
        let resultPoint:Vec2 = new Vec2();
        
        resultPoint.x = this.originPosition.x + gridPoint.x * (this._cell.width + this._gap.x);
        resultPoint.y = this.originPosition.y + gridPoint.y * (this._cell.height + this._gap.y);

        return resultPoint;
    }

    public override screenToGrid(screenPoint:Vec2):[Position, Vec2]
    {
        let resultPoint:Vec2 = new Vec2();

        resultPoint.x = Math.floor((screenPoint.x - this.originPosition.x) / (this._cell.width + this._gap.x));
        resultPoint.y = Math.floor((screenPoint.y - this.originPosition.y) / (this._cell.height + this._gap.y));
        
        this._position = this.isPointInside(screenPoint, this.gridToScreen(resultPoint), this._defineQuadrant);

        // log(PositionToString.toString(this._position), resultPoint.toString(), this.gridToScreen(resultPoint).toString());
        
        switch (this._position)
        {
            case Position.IN:
            {
                return [Position.IN, resultPoint];
            }
            case Position.OUT:
            default:
            {
                return [Position.OUT, null];
            }
        }
    }

    protected override setNeighbors():void
    {
        this.neighbors.set(Position.L, new Vec2(-1, 0));
        this.neighbors.set(Position.T, new Vec2(0, 1));
        this.neighbors.set(Position.R, new Vec2(1, 0));
        this.neighbors.set(Position.B, new Vec2(0, -1));
        
        this.diagonals.set(Position.LB, new Vec2(-1, -1));
        this.diagonals.set(Position.LT, new Vec2(-1, 1));
        this.diagonals.set(Position.RT, new Vec2(1, 1));
        this.diagonals.set(Position.RB, new Vec2(1, -1));
    }

    protected override calculateGridSpecificPrameters():void
    {
        
    }

    public override getCellNeighbor(gridCell:Vec2, direction:Position):Vec2
    {
        return this.getNeighbor(gridCell, direction);
    }

    public override getCellNeighbors(gridCell:Vec2):Map<Position, Vec2>
    {
        return this.getNeighbors(gridCell);
    }
    
    public override getShapeSize(shape:Shape):Size
    {
        const width:number = (this._cell.width * shape.size.x) + (this._gap.x * (shape.size.x - 1));
        const height:number = (this._cell.height * shape.size.y) + (this._gap.y * (shape.size.y - 1));
        
        return new Size(width, height);
    }
}