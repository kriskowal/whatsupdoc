
var UTIL = require("util");
var MARKDOWN = require("markdown");
var PARSERS = require("./whatsupdoc/parsers");

/**
 * Creates a documentation tree for a module.
 *
 * @param text {String} the text of a JavaScript program
 * @param id {String} optional module identifier
 * @returns {{name, params, returns, doc, children}} a tree
 * of code point documentation descriptors of the form
 * `{name, type, params, returns, doc, errors, children}`
 */
exports.parseModule = function (text, id) {
    text = UTIL.expand(text);
    var nodes = exports.comments(text);
    nodes = exports.docs(nodes);
    nodes = exports.parseDocs(nodes);
    var tree = exports.tree(nodes, id);
    return tree;
};

/**
 * takes the text of a JavaScript file and returns an array
 * of each of the block comments, the prefix on the initial
 * line (for measuring indentation), and the subsequent code
 * up to the next comment.
 *
 * It's a good idea to expand the tabs in the program text
 * before running them through this function.  The `util`
 * module in the `narwhal-lib` package provides an `expand`
 * function that serves this purpose.
 *
 * @param text {String} the text of a JavaScript program.
 * @returns {Array * {comment, code, prefix}}
 */
// XXX known issue: does not find quoted or slashed sections
exports.comments = function (text) {
    var nodes = [];
    do {
        var nextBlock = text.indexOf("/*");
        var nextInline = text.indexOf("//");
        if (nextBlock < 0 && nextInline < 0) {
            // neither
            if (nodes.length)
                nodes[nodes.length - 1].code += text;
            text = "";
        } else if (
            nextBlock < 0 ||
            (nextInline >= 0 && nextInline < nextBlock)
        ) {
            // inline
            if (nodes.length)
                nodes[nodes.length - 1].code += text.slice(0, nextInline);
            text = text.slice(nextInline);
            var nextLf = text.indexOf("\n");
            if (nextLf < 0) {
                text = "";
            } else {
                if (nodes.length)
                    nodes[nodes.length - 1].code += text.slice(0, nextLf + 1);
                text = text.slice(nextLf + 1);
            }
        } else {
            // block
            var prefix = text.slice(0, nextBlock);
            if (nodes.length)
                nodes[nodes.length - 1].code += prefix
            var prevLf = prefix.lastIndexOf("\n");
            var prefixLength;
            if (prevLf < 0) {
                prefix = "";
            } else {
                prefix = prefix.slice(prevLf + 1);
                text = text.slice(nextBlock);
            }
            var nextBlockEnd = text.indexOf("*/");
            var comment;
            if (nextBlockEnd < 0) {
                comment = text.slice(2);
                text = "";
            } else {
                comment = text.slice(2, nextBlockEnd);
                text = text.slice(nextBlockEnd + 2);
            }
            nodes.push({
                "comment": comment,
                "prefix": prefix,
                "code": ""
            })
        }
    } while (text.length);
    return nodes;
};

/**
 * Extracts documentation nodes from comment nodes.
 *
 * Takes the output of the `comments` method and returns an
 * array of objects with `doc`, `code`, and `level`
 * properties, consumable by `parseDocs`.
 *
 * * `doc` is a string containing each line of
 *    the original `comment` with the leading cruft on each
 *    line trimmed off.
 * * `code` is the subsequent code up
 *    to the next comment.
 * * `level` is the number of extra stars on the beginning
 *   of the comment.  These can be used to provide an
 *   indication of hierarchical depth.
 *
 * @param nodes {Array * {comment, prefix, code}} nodes in
 * the format produced by `comments`
 * @returns {Array * {doc, code, name, level}} nodes
 */
exports.docs = function (nodes) {
    var docs = [];
    nodes.forEach(function (node) {
        var comment = node.comment;
        var lines = comment.split(/\r?\n/);
        var firstLine = lines.shift();
        if (!/^\*+/.test(firstLine))
            return;
        var spacePrefix = UTIL.mul(" ", node.prefix.length + 4);
        var starPrefix = UTIL.mul(" ", node.prefix.length) + " \\* ?";
        var expression = new RegExp(
            "^(" +
                spacePrefix + "|" + 
                starPrefix +
            ")" + "(.*)$"
        );
        lines = lines.map(function (line) {
            if (!UTIL.trim(line).length)
                return "";
            if (!expression.test(line))
                return line; // XXX throw useful error
            return expression.exec(line)[2];
        });
        while (
            lines.length &&
            !UTIL.trim(lines[lines.length - 1]).length
        )
            lines.pop();
        var match = /^(\*+) ?(.*)$/.exec(firstLine)
        var firstLine = match[2];
        if (UTIL.trim(firstLine))
            lines.unshift(firstLine);
        docs.push({
            "level": match[1].length - 1,
            "doc": lines.join("\n"),
            "code": node.code
        });
    });
    return docs;
};

/**
 * Takes an array of nodes produced by `docs` and returns an
 * array of nodes consumable by `tree`.  Uses `parseDoc` to
 * extract `@` meta-data like `param` and `returns`.  Uses
 * `guessName` to guess the name of the object.  `@name`
 * overrides the guess.
 *
 * @param nodes {Array * {level, doc, code}}
 * @returns {Array * {name, doc, params, 
 */
exports.parseDocs = function (nodes) {
    return nodes.map(function (node) {
        var result = {
            "name": exports.guessName(node.code),
            "level": node.level
        };
        exports.parseDoc(node.doc, result);
        return result;
    });
};

/**
 * takes a linear list of documentation nodes, such as those
 * returned by `parseDocs`, and returns the root of a tree of
 * nodes, where the `level` numbers are translated into
 * `children` arrays.
 *
 * @param nodes {Array * {level, ...}}
 * @param id {String} optional module identifier
 * @returns {{"type": "module", "id": id, "children":
 * Array * ...}}
 *
 */
exports.tree = function (nodes, id) {
    var root = {
        "type": "module",
        "id": id,
        "children": []
    };
    var stack = [root.children];
    var level = 0;
    nodes.forEach(function (node) {
        while (node.level > stack.length - 1) {
            var top = stack[stack.length - 1];
            var last = top[top.length - 1];
            if (!last.children)
                last.children = [];
            stack.push(last.children);
        }
        while (node.level < stack.length - 1) {
            stack.pop();
        }
        delete node.level;
        stack[stack.length - 1].push(node);
    });
    return root;
};

/**
 * @param code {String} a block of code to search for an
 * applicable name.
 * @returns {String} a name or `"<unknown>"` if no name can
 * be found.
 */
var guessRe = /\.(\w+)\s*=/;
exports.guessName = function (code) {
    var match = guessRe.exec(code);
    if (match)
        return match[1];
    return '?';
};

/**
 * @param text
 * @param node
 * @param tagParsers
 * @param markupParser
 */
exports.parseDoc = function (
    text,
    node,
    tagParsers,
    markupParser
) {
    node = node || {};
    tagParsers = tagParsers || exports.tagParsers;
    markupParser = markupParser || MARKDOWN.toHtml;

    var docs = [];
    node.params = [];
    node.errors = [];
    var blocks = text.split(/\n\n/g);
    blocks.forEach(function (block) {
        if (/^@/.test(block)) {
            var blocks = block.slice(1).split(/\n@/);
            blocks.forEach(function (block) {
                var match = /^(\S+) ([\s\S]*)/.exec(block);
                var tag = match[1];
                var text = match[2].split(/\n/g).join(" ");
                if (!tagParsers[tag]) {
                    node.errors.push("Did not recognize " +
                        UTIL.enquote(tag) + " tag.");
                } else {
                    tagParsers[tag](text, node);
                }
            });
        } else {
            docs.push(block);
        }
    });
    node.doc = docs.join("\n\n");
    return node;
};

/**
 * an `Object` mapping tag names to parser functions, in the
 * form accepted by the `tagParsers` argument of `parseDoc`.
 * The parser functions accept the tag text and the node
 * they are augmenting, in the form of one of the objects
 * returned by `parseDoc`.
 */
var tagParsers = exports.tagParsers = {};

/*** parses an `@param` tag, pushing an `Object` of the
 * form `{name, type, description}` onto the `params`
 * `Array` of the given `node`. */
tagParsers.param = function (text, node) {
    var match = /^(\w+)(?:\s+([\S\s]*))?$/.exec(text);
    if (!match) {
        node.errors.push("Could not recognize `@param` " + UTIL.enquote(text));
        return;
    }
    var name = match[1];
    text = match[2];
    if (/^{/.test(text)) {
        var match = PARSERS.parseCurly(text, node);
        var type = match[0];
        text = match[1].trim();
    }
    // TODO parse the text into an object
    node.params.push({
        "name": name,
        "type": type,
        "doc": text
    });
};

/*** parses an `@returns` tag, setting the `returns`
 * property of the given `node` to an `Object` of the form,
 * `{name, type, description}`. */
tagParsers.returns = function (text, node) {
    // TODO parse the text into an object
    if (/^{/.test(text)) {
        var match = PARSERS.parseCurly(text, node);
        var type = match[0];
        text = match[1].trim();
    }
    // TODO parse the text into an object
    node.returns = {
        "type": type,
        "doc": text
    };
};

/*** @name return */
tagParsers["return"] = tagParsers.returns;

/*** */
tagParsers.name = function (text, node) {
    node.name = UTIL.trim(text);
};

/*
   TODO
   @author  Developer's name
   @constructor Marks a function as a constructor
   @deprecated  Marks a method as deprecated
   @exception   Synonym for @throws
   @private Signifies that a method is private
   @return  Documents a return value
   @see Documents an association to another object
   @this    Specifies the type of the object to which the keyword "this" refers within a function.
   @throws  Documents an exception thrown by a method
   @version Provides the version number of a library
*/

if (require.main == module) {
    var FS = require("file");
    var text = FS.path(module.path).read()
    var tree = exports.parseModule(text, module.id);
    print(JSON.encode(tree, null, 4));
}

