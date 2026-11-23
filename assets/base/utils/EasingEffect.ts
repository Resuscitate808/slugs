import { _decorator, Enum } from 'cc';
const { ccclass, property } = _decorator;

export enum EasingEffect
{
    linear = "linear",
    smooth = "smooth",
    fade = "fade",
    constant = "constant",

    quadIn = "quadIn",
    quadOut = "quadOut",
    quadInOut = "quadInOut",
    quadOutIn = "quadOutIn",

    cubicIn = "cubicIn",
    cubicOut = "cubicOut",
    cubicInOut = "cubicInOut",
    cubicOutIn = "cubicOutIn",

    quartIn = "quartIn",
    quartOut = "quartOut",
    quartInOut = "quartInOut",
    quartOutIn = "quartOutIn",

    quintIn = "quintIn",
    quintOut = "quintOut",
    quintInOut = "quintInOut",
    quintOutIn = "quintOutIn",

    sineIn = "sineIn",
    sineOut = "sineOut",
    sineInOut = "sineInOut",
    sineOutIn = "sineOutIn",

    expoIn = "expoIn",
    expoOut = "expoOut",
    expoInOut = "expoInOut",
    expoOutIn = "expoOutIn",

    circIn = "circIn",
    circOut = "circOut",
    circInOut = "circInOut",
    circOutIn = "circOutIn",

    elasticIn = "elasticIn",
    elasticOut = "elasticOut",
    elasticInOut = "elasticInOut",
    elasticOutIn = "elasticOutIn",

    backIn = "backIn",
    backOut = "backOut",
    backInOut = "backInOut",
    backOutIn = "backOutIn",

    bounceIn = "bounceIn",
    bounceOut = "bounceOut",
    bounceInOut = "bounceInOut",
    bounceOutIn = "bounceOutIn"
}
Enum(EasingEffect);