import { _decorator, Size, Vec2 } from 'cc';
import { Shape } from './Shape';
import { Position } from '../enums/Position';
const { ccclass } = _decorator;

@ccclass('ShapeFromRectangle')
export class ShapeFromRectangle extends Shape
{
    constructor(size:Vec2, startCell:Vec2, directionTo:Position)
    {
        super();

        let gridCell:Vec2 = startCell.clone();
        let multiplierX:number = 1;
        let multiplierY:number = 1;

        // Direction определяет построение фигуры относительно начальной ячейки и центра координат
        switch (directionTo)
        {
            case Position.C:
            {
                gridCell.set(startCell.x - Math.floor(size.x / 2), startCell.y - Math.floor(size.y / 2));

                this._lb = new Vec2(gridCell);
                this._rt = new Vec2(gridCell.clone().add(size.clone().subtract2f(1, 1)));
                break;
            }
            case Position.BC:
            {
                multiplierY = -1;
                gridCell.x = startCell.x - Math.floor(size.x / 2);
                
                this._lb = new Vec2(startCell.x - Math.floor(size.x / 2), gridCell.y - size.y + 1);
                this._rt = new Vec2(gridCell.x + size.x - 1, gridCell.y);
                break;
            }
            case Position.TC:
            {
                gridCell.x = startCell.x - Math.floor(size.x / 2);
                    
                this._lb = new Vec2(gridCell);
                this._rt = new Vec2(gridCell.clone().add(size.clone().subtract2f(1, 1)));
                break;
            }
            case Position.LC:
            {
                multiplierX = -1;
                gridCell.y = startCell.y - Math.floor(size.y / 2);
                
                this._lb = new Vec2(gridCell.x - size.x + 1, startCell.y - Math.floor(size.y / 2));
                this._rt = new Vec2(gridCell.x, gridCell.y + size.y - 1);
                break;
            }
            case Position.RC:
            {
                gridCell.y = startCell.y - Math.floor(size.y / 2);

                this._lb = new Vec2(gridCell.x, startCell.y - Math.floor(size.y / 2));
                this._rt = new Vec2(gridCell.x + size.x - 1, gridCell.y + size.y - 1);
                break;
            }
            case Position.RT:
            {
                this._lb = new Vec2(gridCell);
                this._rt = new Vec2(gridCell.clone().add(size.clone().subtract2f(1, 1)));
                break;
            }
            case Position.RB:
            {
                multiplierY = -1;

                this._lb = new Vec2(gridCell.x, gridCell.y - size.y + 1);
                this._rt = new Vec2(gridCell.x + size.x - 1, gridCell.y);
                break;
            }
            case Position.LT:
            {
                multiplierX = -1;

                this._lb = new Vec2(gridCell.x - size.x + 1, gridCell.y);
                this._rt = new Vec2(gridCell.x, gridCell.y + size.y - 1);
                break;
            }
            case Position.LB:
            {
                multiplierX = -1;
                multiplierY = -1;

                this._lb = new Vec2(gridCell.x - size.x + 1, gridCell.y - size.y + 1);
                this._rt = new Vec2(gridCell);
                break;
            }
        }
        
        // Сначало инкрементируем колонки а потом строки или слева направо и снизу вверх
        for (let i:number = 0; i < (size.x * size.y); i++)
        {
            this.add(new Vec2(gridCell.x + (i % size.x) * multiplierX, gridCell.y + Math.floor(i / size.x) * multiplierY));
        }

        this._size = new Size(size.x, size.y);
    }

    public override isInsideShape(gridPoint:Vec2):boolean
    {
        return (gridPoint.x >= this._lb.x) && (gridPoint.x <= this._rt.x) && (gridPoint.y >= this._lb.y) && (gridPoint.y <= this._rt.y);
    }
}