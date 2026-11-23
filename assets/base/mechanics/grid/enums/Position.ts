import { _decorator, Enum } from 'cc';

export enum Position
{
    // LT -- T -- RT
    // |     |     |
    // L  -- C --  R
    // |     |     |
    // LB -- B -- RB
    
    OUT = 0, // OUTSIDE
    IN,  // INSIDE
    
    C,   // CENTER - horizontal and vertical
    
    L,   // LEFT
    T,   // TOP
    R,   // RIGHT
    B,   // BOTTOM
    
    BC,  // BOTTOM CENTER
    RC,  // RIGHT CENTER
    TC,  // TOP CENTER
    LC,  // LEFT CENTER

    LB,  // LEFT BOTTOM
    RB,  // RIGHT BOTTOM
    RT,  // RIGHT TOP
    LT,  // LEFT TOP
    
    UP,   // UP
    DOWN  // DOWN
}
Enum(Position);