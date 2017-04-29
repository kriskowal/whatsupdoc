
/**
 * Provides basic parsing utilities.
 */

/**
 * parses a template and returns its syntax tree
 * using {@link nodes} and {@link tree}.
 */
exports.parse = (text, fileName, lineNo) => {
    var nodes = exports.nodes(text, fileName, lineNo);
    var tree = exports.tree(nodes, fileName);
    return tree;
};

/** constructs a flat list of inline and block nodes with
 * interpolated text based on the text of a template */
exports.nodes = (text, fileName, lineNo) => {
    var nodes = [];
    var node = {errors:[]};
    var lineNo = lineNo || 1;
    while (text.length) {
        var nextOpen = text.indexOf("{");
        if (nextOpen < 0) {
            nodes.push(text);
            text = "";
        } else {
            var prefix = text.slice(0, nextOpen);
            prefix.replace(/\n/g, () => {
                lineNo++;
            });
            var lastLf = prefix.lastIndexOf("\n");
            var columnNo = lastLf < 0 ? 0 : prefix.length - lastLf - 1;
            nodes.push(prefix);
            text = text.slice(nextOpen);
            var match = exports.parseCurly(text, node);
            var tag = match[0];
            if (/^%.*%$/.test(tag) || /^{.*}$/.test(tag)) {
                nodes.push({
                    "type": match[0].slice(0, 1),
                    "content": match[0].slice(
                        1,
                        match[0].length - 1
                    ),
                    "fileName": fileName,
                    "lineNo": lineNo,
                    "columnNo": columnNo
                });
            } else {
                nodes.push("{" + tag + "}");
            }
            text = match[1];
        }
    }
    return nodes;
};

/** transforms a flat list of interpolated text and inline
 * and block nodes and constructs a syntax tree. */
exports.tree = (nodes, fileName) => {
    var root = {
        "type": "block",
        "content": "root",
        "fileName": fileName,
        "lineNo": 1,
        "columnNo": 0,
        "children": []
    };
    var stack = [root];
    nodes.forEach(node => {
        if (typeof node === "string") {
            stack[stack.length - 1].children.push(node);
        } else {
            if (node.type == "{") {
                stack[stack.length - 1].children.push({
                    "type": "inline",
                    "content": node.content.trim(),
                    "fileName": fileName,
                    "lineNo": node.lineNo,
                    "columnNo": node.columnNo
                });
            } else if (/^\s*end/.test(node.content)) {
                if (stack.length == 1) {
                    stack[0].children.push({
                        "type": "error",
                        "fileName": fileName,
                        "lineNo": node.lineNo,
                        "columnNo": node.columnNo,
                        "error": "unmatched end tag"
                    })
                } else {
                    stack.pop();
                }
            } else {
                var node = {
                    "type": "block",
                    "content": node.content.trim(),
                    "fileName": fileName,
                    "lineNo": node.lineNo,
                    "columnNo": node.columnNo,
                    "children": []
                };
                stack[stack.length - 1].children.push(node);
                stack.push(node);
            }
        }
    });
    return root;
};

/**
 * @param {String} text a string starting with a curly brace
 * with a matching, nested curly brace somewhere before the
 * end.
 * @param {Object} node an object with an `errors` array.
 * @returns {[enclosed, remainder]} where `enclosed` is a
 * `String` that may contain nested curly braces, and
 * remainder is all text that followed.
 */
exports.parseCurly = (text, node) => {
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
exports.parseCurlyScan = (text, node) => {
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

