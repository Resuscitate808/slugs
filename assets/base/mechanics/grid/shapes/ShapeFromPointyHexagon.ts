import { _decorator, v2, Vec2 } from 'cc';
import { Shape } from './Shape';
import { Position } from '../enums/Position';
import { Grid } from '../grids/Grid';
const { ccclass } = _decorator;

@ccclass('ShapeFromPointyHexagon')
export class ShapeFromPointyHexagon extends Shape
{
    constructor(grid:Grid, centerPos:Vec2, radius:number, fill:boolean = false)
    {
        super();

        if (radius <= 0)
        {
            this.add(centerPos);
            return;
        }

        let startPos:Vec2 = centerPos.clone();
        
        for (let i = 0; i < radius; i++)
        {
            startPos = grid.getCellNeighbor(startPos, Position.LB);
            
            if (startPos == null)
                return;
        }

        let neighborPos:Vec2;

        if (fill)
        {
            let stepX:number = radius * 2 + 1;
            let stepY:number = radius + 1;
            let cellPos:Vec2 = v2();

            for (let x = 0; x < stepX; x++)
            {
                cellPos.x = startPos.x;

                for (let y = 0; y < stepY; y++)
                {
                    cellPos.y = startPos.y + y;
                    this.add(cellPos.clone());
                }

                if (x < radius)
                {
                    stepY += 1;
                    neighborPos = grid.getCellNeighbor(startPos, Position.RB);

                    if (neighborPos != null)
                        startPos.set(neighborPos);
                }
                else
                {
                    stepY -= 1;
                    neighborPos = grid.getCellNeighbor(startPos, Position.RT)

                    if (neighborPos != null)
                        startPos.set(neighborPos);
                }
            }
        }
        else
        {
            const directions:Position[] = [Position.RB, Position.RT, Position.T, Position.LT, Position.LB, Position.B];

            for (let i = 0; i < directions.length; i++)
            {
                for (let j = 0; j < radius; j++)
                {
                    this.add(startPos.clone());

                    neighborPos = grid.getCellNeighbor(startPos, directions[i]);
                    
                    if (neighborPos != null)
                        startPos.set(neighborPos);
                }
            }
        }
    }

    public override isInsideShape(gridPoint:Vec2):boolean
    {
        return false; // TODO: рассчитать
    }
}