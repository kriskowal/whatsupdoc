

// find all the documentation comments
// extract and parse line tags of the documentation comments
//  organize the documentation comments
//  determine markup language of documents
// assign locations to the documents, for use in cross-references
// parse and format the documentation markup, including references to other
//  documents by way of {@link} or other embedded reference formats


var parseCurly = require("./parse").parseCurly;
var parse = require("esprima").parse;
var search = require("./binary-search").binarySearch;
var expand = require("./expand").expand;
var defaultTagParsers = require("./tag-parsers");

/**
 * @name parse
 */
exports.parse = function (text, options) {
    options = options || {};
    var source = options.source;
    var context = options.context || {
        children: Object.create(null)
    };
    var syntax = parse(text, {
        source: source,
        comment: true,
        commentPrefix: true,
        range: true,
        loc: true
    });
    if (source) {
        context = lookup(context, source.replace(/\.js$/, ""));
    }
    var documents = exports.extractDocuments(syntax, context);
    exports.parseDocuments(documents, context, source);
    var tree = organize(context);
    return tree;
};

function organize(context, document, parent) {
    if (!document) {
        document = context.document || {};
        document.name = context.name;
        document.children = Object.create(parent ? parent.children : null);
    }
    Object.keys(context.children).forEach(function (name) {
        var child = context.children[name];
        if (child.document) {
            document.children[name] = organize(child, null, document);
        } else {
            organize(child, document);
        }
    });
    return document;
}

function renderContext(context, level) {
    level = level || 0;
    if (context.document) {
        console.log(Array(level + 2).join(">") + " " + (context.document.name || context.name) + ":", context.document.text);
        Object.keys(context.children).forEach(function (name) {
            renderContext(context.children[name], level + 1);
        });
    } else {
        Object.keys(context.children).forEach(function (name) {
            renderContext(context.children[name], level);
        });
    }
}

/**
 * documents
 */
exports.extractDocuments = function (syntax, context) {
    var assignments = findAssignments(syntax, null, context);
    var assignmentLineNumbers = assignments.map(function (assignment, i) {
        return assignment.syntax.loc.start.line;
    });
    var comments = syntax.comments;
    return comments.filter(function (comment) {
        return (
            comment.type == "Block" &&
            comment.value.length &&
            comment.value[0] == "*"
        );
    }).map(function (comment) {
        var seek = comment.loc.start.line;
        var index = search(assignmentLineNumbers, seek);
        var before = assignments[index - 1];
        var after = assignments[index];
        var text = exports.trimComment(comment.value, comment.prefix);
        return {
            text: text,
            loc: comment.loc,
            before: before,
            after: after
        }
    });
};

/**
 * Comment margins come in two major flavors, with varying amounts of
 * white space expected to be trimmed from each line depending on the
 * indentation depth of the first line.  `cutParser` expands any tabs and
 * trims the prefix white space and comment art from the margin of the
 * comment.
 *
 *     /**
 *      * Comment
 *      *\/
 *
 *     /*
 *          Comment
 *     *\/
 *
 */
exports.trimComment = function (comment, prefix) {
    var parts = expand(comment).split(/\n/);
    var first = parts.shift().slice(1).trimLeft();
    var prefixWhitespace = new RegExp('^\\s{0,' + prefix.length + '}');
    parts = parts.map(function (line) {
        line = line.replace(prefixWhitespace, "");
        line = line.replace(commentMargin, "");
        return line;
    });
    var last = parts.pop();
    if (first) {
        parts.unshift(first);
    }
    if (last) {
        parts.push(last);
    }
    return parts.map(function (line) {
        return line.trimRight() + "\n";
    }).join("");
}
var commentMargin = new RegExp('^(\\* | \\*| ? ? ?)? ?');

/**
 */
exports.parseDocuments = function (documents, context, source) {
    documents.forEach(function (document) {
        exports.parseDocument(document.text, document, context, source);
    });
};

/**
 * Accepts a documentation string and a documentation node,
 * strips out and applies the `@` metadata blocks to the
 * documentation node.
 *
 * @param {String} text a documentation string
 * @param {Object} node a documentation node, as provided by
 * `documents`
 * @param {Object * [name String, handler Function(text,
 * node)]} tagParsers an optional mapping of `@` tag names
 * to corresponding handlers.  Defaults to `tagParsers` as
 * exported by the same module.
 * @returns node
 */
exports.parseDocument = function (text, document, context, source, tagParsers) {
    document = document || {};
    tagParsers = tagParsers || defaultTagParsers;

    var docs = [];
    document.name = null;
    document.params = [];
    document.errors = [];
    document['throws'] = [];
    document.examples = [];
    document.see = [];
    var blocks = text.replace(/\n *@/g, "\n\n\n@").split(/\n\n+/g);
    blocks.forEach(function (block) {
        if (/^@/.test(block)) {
            var blocks = block.slice(1).split(/\n@/);
            blocks.forEach(function (block) {
                var match = /^(\S+)(?:\s+([\s\S]*))?/.exec(block);
                var tag = match[1];
                var text = match[2] || "";
                if (!tagParsers[tag]) {
                    document.errors.push("Did not recognize " +
                        JSON.stringify(tag) + " tag.");
                } else {
                    tagParsers[tag](text, document, context, source);
                }
            });
        } else {
            docs.push(block);
        }
    });
    document.text = docs.join("\n\n").trim();
    if (/^{/.test(document.text)) {
        var match = parseCurly(document.text, document);
        document.jsType = match[0];
        document.text = match[1].trim();
    }

    if (!document.accounted) {
        if (document.after) {
            if (document.after.children.document) {
                // TODO warn that there are multiple documents referring to the same code point
            }
            document.after.children.document = document;
            document.syntax = document.after;
        } else {
            // TODO warn that the document is not accounted for
        }
    }
    delete document.before;
    delete document.after;
    delete document.accounted;
    return document;
};

/**
 * findAssignments
 */
var findAssignments = function (node, assignments, context) {
    assignments = assignments || [];
    if (finders[node.type]) {
        finders[node.type](node, assignments, context);
    } else {
        console.warn("Can't traverse " + node.type);
    }
    return assignments;
};

/** finders */
var finders = {

    /** Program */
    Program: function (node, assignments, context) {
        node.body.forEach(function (node) {
            findAssignments(node, assignments, context);
        })
    },

    /** EmptyStatement */
    EmptyStatement: function () {},

    /** ExpressionStatement */
    ExpressionStatement: function (node, assignments, context) {
        findAssignments(node.expression, assignments, context);
    },
    /***/
    BlockStatement: function (node, assignments, context) {
        node.body.forEach(function (node) {
            findAssignments(node, assignments, context);
        })
    },
    /***/
    IfStatement: function (node, assignments, context) {
        findAssignments(node.consequent, assignments, context);
        if (node.alternate) {
            findAssignments(node.alternate, assignments, context);
        }
    },
    /***/
    LabeledStatement: function (node, assignments, context) {
        findAssignments(node.body, assignments, context);
    },
    /***/
    BreakStatement: function () {},
    /***/
    ContinueStatement: function () {},
    /***/
    WithStatement: function (node, assignments, context) {
        findAssignments(node.body, assignments, context);
    },
    /***/
    SwitchStatement: function (node, assignments, context) {
        node.cases.forEach(function (node) {
            findAssignments(node, assignments, context);
        });
    },
    /***/
    SwitchCase: function (node) {},
    /***/
    ReturnStatement: function (node, assignments, context) {
        if (node.argument) {
            findAssignments(node.argument, assignments, context);
        }
    },
    /***/
    TryStatement: function (node, assignments, context) {
        findAssignments(node.block, assignments, context);
        node.handlers.forEach(function (node) {
            findAssignments(node, assignments, context);
        });
        if (node.finalizer) {
            findAssignments(node.finalizer, assignments, context);
        }
    },
    /***/
    CatchClause: function (node, assignments, context) {
        findAssignments(node.body, assignments, context);
    },
    /***/
    ThrowStatement: function (node, assignments, context) {
        findAssignments(node.argument, assignments, context);
    },
    /***/
    WhileStatement: function (node, assignments, context) {
        findAssignments(node.body, assignments, context);
    },
    /***/
    DoWhileStatement: function (node, assignments, context) {
        findAssignments(node.body, assignments, context);
    },
    /***/
    ForInStatement: function (node, assignments, context) {
        findAssignments(node.body, assignments, context);
    },
    /***/
    ForStatement: function (node, assignments, context) {
        findAssignments(node.body, assignments, context);
    },
    /***/
    DebuggerStatement: function () {},

    /***/
    FunctionDeclaration: function (node, assignments, context) {
        var name = node.id.name;
        var subcontext = context;
        if (name) {
            subcontext = lookupName(context, name);
            var assignment = {
                name: name,
                syntax: node,
                children: subcontext
            };
            assignments.push(assignment);
        }
        findAssignments(node.body, assignments, subcontext);
    },
    /***/
    VariableDeclaration: function (node, assignments, context) {
        node.declarations.forEach(function (node) {
            var name = node.id.name;
            var subcontext = context;
            if (name) {
                subcontext = lookupName(context, name);
                var assignment = {
                    name: name,
                    syntax: node,
                    children: subcontext
                };
                assignments.push(assignment);
            }
            if (node.init) {
                findAssignments(node.init, assignments, subcontext);
            }
        });
    },

    /***/
    ThisExpression: function () {},
    /***/
    ArrayExpression: function (node, assignments, context) {
        node.elements.forEach(function (node) {
            findAssignments(node, assignments, context);
        });
    },
    /**
     * This should be attached to ObjectExpression
     */
    ObjectExpression: function (node, assignments, context) {
        node.properties.forEach(function (node) {
            var name = node.key.name;
            var subcontext = context;
            if (name) {
                subcontext = lookupName(context, name);
                var assignment = {
                    name: name,
                    syntax: node.value,
                    children: subcontext
                };
                assignments.push(assignment);
            }
            findAssignments(node.value, assignments, subcontext);
        });
    },
    SequenceExpression: function (node, assignments, context) {
        node.expressions.forEach(function (node) {
            findAssignments(node, assignments, context);
        });
    },
    UnaryExpression: function (node, assignments, context) {
        findAssignments(node.argument, assignments, context);
    },
    BinaryExpression: function (node, assignments, context) {
        findAssignments(node.left, assignments, context);
        findAssignments(node.right, assignments, context);
    },
    AssignmentExpression: function (node, assignments, context) {
        var found = lookupNode(context, node.left);
        var subcontext = context;
        if (found) {
            var assignment = {
                name: found.name,
                syntax: node,
                children: found
            };
            assignments.push(assignment);
            subcontext = found;
        }
        findAssignments(node.right, assignments, subcontext);
    },
    UpdateExpression: function () {},
    LogicalExpression: function () {},
    ConditionalExpression: function (node, assignments, context) {
        findAssignments(node.consequent, assignments, context);
        if (node.alternate) {
            findAssignments(node.alternate, assignments, context);
        }
    },
    NewExpression: function (node, assignments, context) {
        node.arguments.forEach(function (argument) {
            findAssignments(argument, assignments, context);
        });
    },
    MemberExpression: function (node, assignments, context) {
        findAssignments(node.object, assignments, context);
    },
    CallExpression: function (node, assignments, context) {
        var subcontext = lookupNode(node.callee, context, node) || context;
        node.arguments.forEach(function (node) {
            findAssignments(node, assignments, subcontext);
        });
    },
    /** FunctionExpression */
    FunctionExpression: function (node, assignments, context) {
        var x = 10;
        findAssignments(node.body, assignments, context);
    },

    Literal: function () {},
    /**
     * Identifier
     */
    Identifier: function () {},
};

/** lookupNode */
var lookupNode = function (context, node) {
    if (lookupNodeByType[node.type]) {
        return lookupNodeByType[node.type](context, node);
    }
};

/** lookupNodeByType */
var lookupNodeByType = {
    /***/
    MemberExpression: function (context, node) {
        return lookupName(
            lookupNode(context, node.object),
            nodeName(node.property),
            node
        );
    },
    /***/
    Identifier: function (context, node) {
        return lookupName(context, node.name, node);
    },
    /***/
    Literal: function (context, node) {
        return lookupName(context, node.value, node);
    }
};

/** lookupName */
function lookupName(context, name, node) {
    if (!context) {
        return;
    }
    if (typeof name === "undefined" || name === "exports") {
        return context;
    }
    if (!context.children[name]) {
        context.children[name] = {
            name: name,
            syntax: node,
            parent: context,
            children: Object.create(context.children)
        };
    }
    return context.children[name];
}

function nodeName(node) {
    if (nodeNamers[node.type]) {
        return nodeNamers[node.type](node);
    }
}

var nodeNamers = {
    Identifier: function (node) {
        return node.name;
    },
    Literal: function (node) {
        return node.value;
    }
};

exports.lookup = lookup;
function lookup(context, path) {
    return path
    .split("#")
    .join(".prototype.")
    .split(".")
    .reduce(function (context, name) {
        var part = name.split(":").pop().trim();
        return lookupName(context, part);
    }, context);
}

/*
if (require.main === module) {
    var fs = (require)("fs");
    var path = (require)("path");
    var directory = module.directory || module.dirname;
    var name = path.join(directory, XXX);
    var text = fs.readFileSync(name, "utf-8");
    exports.parse(text, {
        source: name
    });
}
*/

