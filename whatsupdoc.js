#!/usr/bin/env node

/**
 * An API for parsing inline JavaScript documentation.
 * @author Kris Kowal (http://askawizard.blogspot.com)
 * <kris@cixar.com>
 * @license MIT License
 * @module
 */

// TODO {@link support}

var PARSE = require("./parse");
var Author = require("./author").Author;
var expand = require("./expand").expand;

/**
 * Creates a documentation tree for a module.
 * 
 * @param {String} text the text of a JavaScript program
 * @param {String} id optional module identifier
 * @returns {{name, doc, children}} a tree of code point
 * documentation descriptors of the form `{name, type,
 * params, returns, throws, doc, errors, children, fileName,
 * lineNo}`
 */
exports.parseModule = function (text, id) {
    text = expand(text);
    var comments = exports.comments(text);
    var markup = exports.guessMarkup(comments);
    var docs = exports.docs(comments);
    var nodes = exports.parseDocs(docs, markup);
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
 * @param {String} text the text of a JavaScript program.
 * @param {String} fileName optional
 * @param {Number} lineNo line number starting with 1,
 * optional
 * @returns {Array * {comment, code, prefix, fileName,
 * lineNo}}
 */
// XXX known issue: does not find quoted or slashed sections
exports.comments = function (text, fileName, lineNo) {
    lineNo = lineNo || 1;
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
            text.slice(0, nextInline).replace(/\n/g, function () {
                lineNo++;
            });
            text = text.slice(nextInline);
            var nextLf = text.indexOf("\n");
            if (nextLf < 0) {
                text = "";
            } else {
                if (nodes.length)
                    nodes[nodes.length - 1].code += text.slice(0, nextLf + 1);
                text = text.slice(nextLf + 1);
                lineNo++;
            }
        } else {
            // block
            var prefix = text.slice(0, nextBlock);
            prefix.replace(/\n/g, function () {
                lineNo++;
            });
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
                "code": "",
                "fileName": fileName,
                "lineNo": lineNo
            });
            comment.replace(/\n/g, function () {
                lineNo++;
            });
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
 * @param {Array * {comment, prefix, code, fileName,
 * lineNo}} nodes nodes in the format produced by `comments`
 * @returns {Array * {doc, code, name, level, fileName,
 * lineNo}} nodes
 */
exports.docs = function (nodes) {
    var docs = [];
    nodes.forEach(function (node) {
        var comment = node.comment;
        var lines = comment.split(/\r?\n/);
        var firstLine = lines.shift();
        if (!/^\*+/.test(firstLine))
            return;
        var spacePrefix = spaces(node.prefix.length + 4);
        var starPrefix = spaces(node.prefix.length) + " \\* ?";
        var expression = new RegExp(
            "^(" +
                spacePrefix + "|" + 
                starPrefix +
            ")" + "(.*)$"
        );
        lines = lines.map(function (line) {
            if (!line.trim().length)
                return "";
            if (!expression.test(line))
                return line; // XXX throw useful error
            return expression.exec(line)[2];
        });
        while (
            lines.length &&
            !lines[lines.length - 1].trim().length
        )
            lines.pop();
        var match = /^(\*+) ?(.*)$/.exec(firstLine)
        var firstLine = match[2];
        if (firstLine.trim())
            lines.unshift(firstLine);
        docs.push({
            "level": match[1].length - 1,
            "doc": lines.join("\n"),
            "code": node.code,
            "fileName": node.fileName,
            "lineNo": node.lineNo
        });
    });
    return docs;
};

/**
 * Scans an array of comment descriptors as provided by the
 * `comments` method and returns a markup language module
 * name.  The default is `undefined`.
 */
exports.guessMarkup = function (comments) {
    var markup;
    comments.forEach(function (node) {
        var match = /^markup\s+(\S+)\s*$/.exec(node.comment);
        if (match)
            markup = match[1];
    });
    return markup;
};

/**
 * Takes an array of nodes produced by `docs` and returns an
 * array of nodes consumable by `tree`.  Uses `parseDoc` to
 * extract `@` meta-data like `param` and `returns`.  Uses
 * `guessName` to guess the name of the object.  `@name`
 * overrides the guess.
 *
 * @param {Array * {level, doc, code, fileName, lineNo}} nodes
 * @param {String} markup the name of a markup module, a
 * module that exports a `to` method for whatever format the
 * documentation must be rendered in, for example `toHtml`.
 * The `to` method may accept a second argument, a function
 * for resolving custom references if they are supported by
 * the language.
 * @returns {Array} with `name`, `level`, `markup`, and the
 * properties added by {@link parseDoc}.
 */
exports.parseDocs = function (docs, markup) {
    var n = 0;
    return docs.map(function (doc) {
        var node = {
            "name": exports.guessName(doc.code) || String(n++),
            "level": doc.level,
            "markup": markup,
            "fileName": doc.fileName,
            "lineNo": doc.lineNo
        };
        exports.parseDoc(
            doc.doc,
            node,
            exports.tagParsers,
            markup
        );
        return node;
    });
};

/**
 * takes a linear list of documentation nodes from a single
 * module, such as those returned by `parseDocs`, and
 * returns the root of a tree of nodes, where the `level`
 * numbers are translated into `children` arrays.
 *
 * @param {Array * {level, ...}} nodes
 * @param {String} id optional module identifier
 * @returns {{"type": "module", "id": id, "children":
 * Array * ...}}
 */
exports.tree = function (nodes, id) {
    var root = {};

    if (nodes.length && nodes[0].module) {
        root = nodes.shift();
        delete root.level;
    }
    root.type = 'module';
    root.name = root.id = id;
    root.children = [];

    var stack = [root.children];
    var level = 0;
    nodes.forEach(function (node) {
        while (node.level > stack.length - 1) {
            var top = stack[stack.length - 1];
            var last;
            if (!top.length)
                last = top;
            else
                last = top[top.length - 1];
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
 * @param {String} code a block of code to search for an
 * applicable name.
 * @returns {String | Undefined} a name or undefined if no
 * name can be found.
 */
var guessRe = /\.(\w+)\s*=|["']([^'"]+)["']\s*:/;
exports.guessName = function (code) {
    var match = guessRe.exec(code);
    if (match)
        return match[1] || match[2];
};

/**
 * Accepts a documentation string and a documentation node,
 * strips out and applies the `@` metadata blocks to the
 * documentation node.
 *
 * @param {String} text a documentation string
 * @param {Object} node a documentation node, as provided by
 * `parseDocs`
 * @param {Object * [name String, handler Function(text,
 * node)]} tagParsers an optional mapping of `@` tag names
 * to corresponding handlers.  Defaults to `tagParsers` as
 * exported by the same module.
 * @returns node
 */
exports.parseDoc = function (text, node, tagParsers) {
    node = node || {};
    tagParsers = tagParsers || exports.tagParsers;

    var docs = [];
    node.params = [];
    node.errors = [];
    node['throws'] = [];
    node.see = [];
    var blocks = text.replace(/\n@/g, "\n\n\n@").split(/\n\n+/g);
    blocks.forEach(function (block) {
        if (/^@/.test(block)) {
            var blocks = block.slice(1).split(/\n@/);
            blocks.forEach(function (block) {
                var match = /^(\S+)(?:\s+([\s\S]*))?/.exec(block);
                var tag = match[1];
                var text = (match[2] || "").split(/\n/g).join(" ");
                if (!tagParsers[tag]) {
                    node.errors.push("Did not recognize " +
                        JSON.stringify(tag) + " tag.");
                } else {
                    tagParsers[tag](text, node);
                }
            });
        } else {
            docs.push(block);
        }
    });
    node.doc = docs.join("\n\n").trim();
    if (/^{/.test(node.doc)) {
        var match = PARSE.parseCurly(node.doc, node);
        node.jsType = match[0];
        node.doc = match[1].trim();
    }
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
 * `Array` of the given `node`.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.param = function (text, node) {
    if (/^{/.test(text)) {
        var match = PARSE.parseCurly(text, node);
        var type = match[0];
        text = match[1].trim();
    }
    var match = /^(\w+)(?:\s+([\S\s]*))?$/.exec(text);
    if (!match) {
        node.errors.push("Could not recognize `@param` " + JSON.stringify(text));
        return;
    }
    var name = match[1];
    text = match[2];
    // TODO parse the text into an object
    node.params.push({
        "name": name,
        "type": type,
        "doc": text
    });
};

/*** parses an `@params` tag for variadic parameters, pushing an
 * `Object` of the form `{name, type, description, variadic: true}`
 * onto the `params` `Array` of the given `node`.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.params = function (text, node) {
    if (/^{/.test(text)) {
        var match = PARSE.parseCurly(text, node);
        var type = match[0];
        text = match[1].trim();
    }
    var match = /^(\w+)(?:\s+([\S\s]*))?$/.exec(text);
    if (!match) {
        node.errors.push("Could not recognize `@param` " + JSON.stringify(text));
        return;
    }
    var name = match[1];
    text = match[2];
    // TODO parse the text into an object
    node.params.push({
        "name": name,
        "type": type,
        "variadic": true,
        "doc": text
    });
};
/*** parses an `@returns` tag, setting the `returns`
 * property of the given `node` to an `Object` of the form,
 * `{name, type, description}`.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.returns = function (text, node) {
    // TODO parse the text into an object
    if (/^{/.test(text)) {
        var match = PARSE.parseCurly(text, node);
        var type = match[0];
        text = match[1].trim();
    }
    // TODO parse the text into an object
    node.returns = {
        "type": type,
        "doc": text
    };
};

/***
 * @see returns
 * @name return
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers["return"] = tagParsers.returns;

/***
 * Specifies or overrides the documentation parser's guess
 * for the name of the object being documented.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.name = function (text, node) {
    node.name = text.trim();
};

/***
 * Notes the author.  Uses the `Author` type from the
 * `packages` module of the `narwhal-lib` package to
 * normalize a string representation of an author of the
 * form:
 *
 *     Author Name (http://example.com) <author@example.com>
 *
 * Where each component is optional and gets composed into
 * an `Object` with `name`, `url` and `email` properties.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.author = function (text, node) {
    node.author = new Author(text);
};

/***
 * Notes a contributor.  More than one can be credited.
 *
 * @see author
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.contributor = function (text, node) {
    node.contributors.push(new Author(text));
};

/***
 * Tags a node as a constructor function.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.constructor = function (text, node) {
    if (text.trim().length)
        node.errors.push("`@constructor` tag had superfluous text");
    node.constructor = true;
};

/***
 * Tags a documentation node as deprecated.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.deprecated = function (text, node) {
    if (text.trim().length)
        node.errors.push("`@deprecated` tag had superfluous text");
    node.deprecated = true;
};

/***
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.module = function (text, node) {
    if (text.trim().length)
        node.errors.push("`@module` tag had superfluous text");
    node.module = true;
};

/***
 * @see module
 * @param {String} text
 * @param {{errors Array}} node
 */
tagParsers.fileoverview = tagParsers.module;

/***
 */
tagParsers['throws'] = function (text, node) {
    if (/^{/.test(text)) {
        var match = PARSE.parseCurly(text, node);
        var type = match[0];
        text = match[1].trim();
    }
    node['throws'].push({
        "type": type,
        "doc": text
    });
};

/*
   TODO
   @exception   Synonym for @throws
   @argument
   @requires
   @private Signifies that a method is private
   @return  Documents a return value
   @see Documents an association to another object
   @this    Specifies the type of the object to which the keyword "this" refers within a function.
   @throws  Documents an exception thrown by a method
   @version Provides the version number of a library
   @fileoverview
   @module
   @type the return type of a function
   @extends
   @private
   @final
   @member
   @ignore
   @base
   @addon
   @classmethod
   @classproperty
   @readonly
   @configurable
   @get
   @set
*/

var spaces = function (n) {
    return Array(n + 1).join(" ");
};

if (require.main == module) {
    // node side only, not in browser. use parens to prevent
    // static dependency.
    var FS = (require)("fs");
    var fileName = process.argv[2] || module.path || module.filename
    var text = FS.readFileSync(fileName);
    var tree = exports.parseModule(text, module.id);
    console.log(JSON.stringify(tree, null, 4));
}

