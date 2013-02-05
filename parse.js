
/**
 * Provides basic parsing utilities.
 */

/**
 * @param {String} text a string starting with a curly brace
 * with a matching, nested curly brace somewhere before the
 * end.
 * @param {Object} node an object with an `errors` array.
 * @returns {[enclosed, remainder]} where `enclosed` is a
 * `String` that may contain nested curly braces, and
 * remainder is all text that followed.
 */
exports.parseCurly = function (text, node) {
    if (!text.slice(0, 1) == "{")
        throw new Error("Assertion failed: parseCurly must receive a string that starts with a curly brace.");
    text = text.slice(1);
    var nextOpen = text.indexOf("{");
    var nextClose = text.indexOf("}");
    if (nextClose < 0) {
        node.errors.push("Unmatched `{` in " + JSON.stringify("{" + text));
        return ["", ""];
    } else if (nextOpen < 0) {
        return [text.slice(0, nextClose), text.slice(nextClose + 1)];
    } else {
        return exports.parseCurlyScan(text, node);
    }
};

/**
 */
// already found {, looking for }, might find { } inside
exports.parseCurlyScan = function (text, node) {
    var nextOpen = text.indexOf("{");
    var nextClose = text.indexOf("}");
    if (nextClose < 0) {
        node.errors.push("Unmatched `{` in " + JSON.stringify("{" + text));
        return ["", ""];
    } else if (nextOpen < 0 || nextClose < nextOpen) {
        // assert nextClose > 0
        return [text.slice(0, nextClose), text.slice(nextClose + 1)];
    } else {
        // assert nextOpen < nextClose
        var match = exports.parseCurly(text.slice(nextOpen), node);
        var inner = match[0];
        var after = match[1];
        var match = exports.parseCurlyScan(after, node);
        var before = match[0];
        var outer = match[1];
        return [text.slice(0, nextOpen + 1) + inner + "}" + before, outer];
    }

};

