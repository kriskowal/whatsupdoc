
/**
    transforms tabs to an equivalent number of spaces.
*/
// TODO special case for \r if it ever matters
exports.expand = (str, tabLength) => {
    str = String(str);
    tabLength = tabLength || 4;
    var output = [];
    var tabLf = /[\t\n]/g;
    var lastLastIndex = 0;
    var lastLfIndex = 0;
    var charsAddedThisLine = 0;
    var tabOffset;
    var match;
    while (match = tabLf.exec(str)) {
        if (match[0] == "\t") {
            tabOffset = (
                tabLength - 1 -
                (
                    (match.index - lastLfIndex) +
                    charsAddedThisLine
                ) % tabLength
            );
            charsAddedThisLine += tabOffset;
            output.push(
                str.slice(lastLastIndex, match.index) +
                spaces(tabOffset + 1)
            );
        } else if (match[0] === "\n") {
            output.push(str.slice(lastLastIndex, tabLf.lastIndex));
            lastLfIndex = tabLf.lastIndex;
            charsAddedThisLine = 0;
        }
        lastLastIndex = tabLf.lastIndex;
    }
    return output.join("") + str.slice(lastLastIndex);
};

var spaces = n => Array(n + 1).join(" ");

