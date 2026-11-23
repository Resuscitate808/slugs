import { _decorator, Component, Node, Size, v2, v3, Vec2, Vec3 } from 'cc';
import { Grid } from './Grid';
import { Cell } from '../cells/Cell';
import { Position } from '../enums/Position';
import { Shape } from '../shapes/Shape';
const { ccclass, property } = _decorator;

@ccclass('HalfShiftedRightEvenGrid')
export class HalfShiftedRightEvenGrid extends Grid
{
    protected _shift:Vec3 = v3();

    constructor(cell:Cell, gap:Vec2)
    {
        super(cell, gap);
        
        this.initialize();
    }

    protected override setNeighbors():void
    {
        this.neighbors.set(Position.L, v2(-1, 0));
        this.neighbors.set(Position.R, v2(1, 0));
        this.neighbors.set(Position.LB, v2(-1, -1));
        this.neighbors.set(Position.LT, v2(-1, 1));
        this.neighbors.set(Position.RT, v2(0, 1));
        this.neighbors.set(Position.RB, v2(0, -1));

        this.neighborsShifted.set(Position.L, v2(-1, 0));
        this.neighborsShifted.set(Position.R, v2(1, 0));
        this.neighborsShifted.set(Position.LB, v2(0, -1));
        this.neighborsShifted.set(Position.LT, v2(0, 1));
        this.neighborsShifted.set(Position.RT, v2(1, 1));
        this.neighborsShifted.set(Position.RB, v2(1, -1));
    }

    protected override calculateGridSpecificPrameters():void
    {
        const median:number = this._cell.height * (Math.sqrt(3) / 2);
        this._shift.set(this._cell.halfWidth, this._cell.height - median);
    }

    public override gridToScreen(gridPoint:Vec2):Vec2
    {
        let result:Vec2 = new Vec2();        
        let offsetPos:Vec3 = v3(); // Учет смещений по позиции ячеек
        let gapOffset:Vec3 = v3(); // Учет смещений по расстаянию между ячейками (gap)

        if (Math.abs(gridPoint.y % 2) == 1)
        {
            offsetPos.x =  this._shift.x;
            gapOffset.x =  this._gap.x / 2;
        }

        offsetPos.y = -(gridPoint.y * this._shift.y);

        result.x = this.originPosition.x + gridPoint.x * (this._cell.width + this._gap.x) + offsetPos.x + gapOffset.x;
        result.y = this.originPosition.y + gridPoint.y * (this._cell.height + this._gap.y) + offsetPos.y + gapOffset.y;

        return result;
    }

    public override screenToGrid(screenPoint:Vec2):[Position, Vec2]
    {
        let result:Vec2 = new Vec2();
        let offsetPos:Vec3 = v3(); // Учёт смещений по позиции ячеек
        let offsetSize:Vec3 = v3(); // Учёт смещений по размеру ячеек
        let position:Position;

        offsetSize.y = -this._shift.y;
        result.y = Math.floor((screenPoint.y - this.originPosition.y) / (this._cell.height + this._gap.y + offsetSize.y));

        if (Math.abs(result.y % 2) == 1)
            offsetPos.x = -this._shift.x;

        result.x = Math.floor((screenPoint.x - this.originPosition.x + offsetPos.x) / (this._cell.width + this._gap.x));

        position = this.isPointInside(screenPoint, this.gridToScreen(result), true);

        switch (position)
        {
            case Position.IN:
            {
                return [Position.IN, result];
            }
            default:
            {
                result = this.getCellNeighbor(result, position);
                position = this.isPointInside(screenPoint, this.gridToScreen(result), false); // Эта проверка нужна если между ячейками есть отступ
                
                if (position == Position.IN)
                    return [Position.IN, result];

                break;
            }
        }

        return [Position.OUT, null];
    }

    public override getCellNeighbor(gridCell:Vec2, direction:Position):Vec2
    {
        let result:Vec2 = gridCell.clone();
        let neighbor:Vec2;

        if (Math.abs(gridCell.y % 2) == 0)
            neighbor = this.neighbors.get(direction);
        else
            neighbor = this.neighborsShifted.get(direction);
    
        if (neighbor != null)
            result.add(neighbor);

        return result;
    }

    public override getCellNeighbors(gridCell:Vec2):Map<Position, Vec2>
    {
        let result:Map<Position, Vec2> = new Map<Position, Vec2>();

        if (Math.abs(gridCell.y % 2) == 0)
            return this.neighbors;
        else
            return this.neighborsShifted;
    }
    
    public override getShapeSize(shape:Shape):Size
    {
        return new Size(1, 1);
    }

    public override getDistance(gridStartPos:Vec2, gridEndPos:Vec2):number
    {
        return this.cubeDistance(this.offsetToCube(gridStartPos.toVec3()), this.offsetToCube(gridEndPos.toVec3()));
    }

    public override offsetToCube(vec:Vec3):Vec3
    {
        let x:number = vec.x;
        let y:number = vec.y;
        let z:number = vec.z;

        x = vec.x - (vec.y - (vec.y & 1)) / 2;
        z = vec.y;
        y = -x - z;
        
        return v3(x, y, z);
    }
}