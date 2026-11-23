import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('StringFormater')
export class StringFormater {

    private static _scoreNames: string[] = ["", "k", "M", "B", "T"]

    public static Format(score: number, max_short: number = 4): string {
        var i = 0;
        while (score > 999 && i < max_short) {
            score = Math.floor(score / 100) / 10;
            i++;
        }

        return score.toString() + this._scoreNames[i];
    }

    public static FormatWithTwoFixed(score: number): string {
        var i = 0;
        while (score > 999) {
            score = Math.fround(score / 100) / 10;
            i++;
        }

        return (score).toFixed(2) + this._scoreNames[i];
    }

    public static FormatWithTwoFlexible(score: number): string {
        let i = 0;

        while (score >= 1000 && i < this._scoreNames.length - 1) {
            score /= 1000;
            i++;
        }

        const formattedScore = parseFloat(score.toFixed(2));

        return formattedScore + this._scoreNames[i];
    }

    public static FormatToDHMS(seconds): string {
        if (seconds < 0)
            seconds = 0;

        var d = Math.floor(seconds / 3600 / 24);
        var h = Math.floor(seconds / 3600) - d * 24;
        var m = Math.floor(seconds % 3600 / 60);
        var s = Math.floor(seconds % 3600 % 60);

        var days = d > 0 ? d + "d " : "";
        var hours = h < 10 ? "0" + h + (":") : h + (":")
        var minutes = m < 10 ? "0" + m + (":") : m + (":")
        var sec = s < 10 ? "0" + s : s

        return days + hours + minutes + sec;
    }

    public static FormatToMS(seconds): string {
        if (seconds < 0)
            seconds = 0;

        var m = Math.floor(seconds % 3600 / 60);
        var s = Math.floor(seconds % 3600 % 60);

        var minutes = m < 10 ? "0" + m + (":") : m + (":")
        var sec = s < 10 ? "0" + s : s

        return minutes + sec;
    }

    public static FormatWithCommas(score: number): string {
        // 'en-US' использует запятую как разделитель тысяч
        return score.toLocaleString('en-US');
    }

    public static GetRussialLetterByKeyCode(keyCode: number): string {
        switch (keyCode) {
            case 81: return "й";
            case 87: return "ц";
            case 69: return "у";
            case 82: return "к";
            case 84: return "е";
            case 89: return "н";
            case 85: return "г";
            case 73: return "ш";
            case 79: return "щ";
            case 80: return "з";
            case 219: return "х";
            case 221: return "ъ";
            case 65: return "ф";
            case 83: return "ы";
            case 68: return "в";
            case 70: return "а";
            case 71: return "п";
            case 72: return "р";
            case 74: return "о";
            case 75: return "л";
            case 76: return "д";
            case 186: return "ж";
            case 222: return "э";
            case 90: return "я";
            case 88: return "ч";
            case 67: return "с";
            case 86: return "м";
            case 66: return "и";
            case 78: return "т";
            case 77: return "ь";
            case 188: return "б";
            case 190: return "ю";
            case 192: return "ё";
            default: return "";
        }
    }
}

