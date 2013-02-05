
var parseCurly = require("./parse").parseCurly;
var NEW = require("./new");

function oneLine(text) {
    return text.split("\n").join(" ");
}

/** parses an `@param` tag, pushing an `Object` of the
 * form `{name, type, description}` onto the `params`
 * `Array` of the given `node`.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
exports.param = function (text, node) {
    text = oneLine(text);
    if (/^{/.test(text)) {
        var match = parseCurly(text, node);
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

/** parses an `@params` tag for variadic parameters, pushing an
 * `Object` of the form `{name, type, description, variadic: true}`
 * onto the `params` `Array` of the given `node`.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
exports.params = function (text, node) {
    text = oneLine(text);
    if (/^{/.test(text)) {
        var match = parseCurly(text, node);
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

/** parses an `@returns` tag, setting the `returns`
 * property of the given `node` to an `Object` of the form,
 * `{name, type, description}`.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
exports.returns = function (text, node) {
    text = oneLine(text);
    // TODO parse the text into an object
    if (/^{/.test(text)) {
        var match = parseCurly(text, node);
        var type = match[0];
        text = match[1].trim();
    }
    // TODO parse the text into an object
    node.returns = {
        "type": type,
        "doc": text
    };
};

/**
 * @see returns
 * @name return
 * @param {String} text
 * @param {{errors Array}} node
 */
exports["return"] = exports.returns;

/**
 * Specifies or overrides the documentation parser's guess
 * for the name of the object being documented.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
exports.name = function (text, document) {
    document.name = text.trim();
};

/**
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
exports.author = function (text, node) {
    text = oneLine(text);
    node.author = new Author(text);
};

/**
 * Notes a contributor.  More than one can be credited.
 *
 * @see author
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
exports.contributor = function (text, node) {
    text = oneLine(text);
    node.contributors.push(new Author(text));
};

/**
 * Tags a node as a constructor function.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
exports.constructor = function (text, node) {
    text = oneLine(text);
    if (text.trim().length)
        node.errors.push("`@constructor` tag had superfluous text");
    node.constructor = true;
};

/**
 * Tags a documentation node as deprecated.
 *
 * @param {String} text
 * @param {{errors Array}} node
 */
exports.deprecated = function (text, document) {
    if (text.trim().length)
        document.errors.push("`@deprecated` tag had superfluous text");
    document.deprecated = true;
};

/**
 * @param {String} text
 * @param {{errors Array}} document
 */
exports.module = function (text, document, context, source) {
    var name = text.trim();
    if (name.length) {
        document.name = name;
    }
    document.module = true;
    context.document = document;
    document.accounted = true;
};

/**
 * @see module
 * @param {String} text
 * @param {{errors Array}} node
 */
exports.fileoverview = exports.module;

/**
 */
exports['throws'] = function (text, node) {
    text = oneLine(text);
    if (/^{/.test(text)) {
        var match = parseCurly(text, node);
        var type = match[0];
        text = match[1].trim();
    }
    node['throws'].push({
        "type": type,
        "doc": text
    });
};

/**
 */
exports.example = function (text, node) {
    node.examples.push(text);
}

exports.external = function (text, document) {
    document.accounted = true;
};

exports.member = function (text, document, context) {
    var node = NEW.lookup(context, text);
    node.document = document;
    document.name = node.name;
    document.accounted = true;
}

exports['function'] = function (text, document, context) {
    if (!document.jsType) {
        document.jsType = 'Function';
    }
    if (text.trim().length) {
        NEW.lookup(context, text).document = document;
        document.accounted = true;
    }
}

exports.private = function (text, document) {
    document.accounted = true;
}

exports.lends = function (text, document, context) {
    NEW.lookup(context, text).document = document;
    document.accounted = true;
}

exports.requires = function (text, document) {
    document.requires = document.requires || [];
    document.requires.push(text.trim());
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

    @augments - Indicate this class uses another class as its "base."
    @author - Indicate the author of the code being documented.
    @argument - Deprecated synonym for @param.
    @borrows that as this - Document that class's member as if it were a member of this class.
    @class - Provide a description of the class (versus the constructor).
    @constant - Indicate that a variable's value is a constant.
    @constructor - Identify a function is a constructor.
    @constructs - Identicate that a lent function will be used as a constructor.
    @default - Describe the default value of a variable.
    @deprecated - Indicate use of a variable is no longer supported.
    @description - Provide a description (synonym for an untagged first-line).
    @event - Describe an event handled by a class.
    @example - Provide a small code example, illustrating usage.
    @extends - Synonym for @augments.
    @field - Indicate that the variable refers to a non-function.
    @fileOverview - Provides information about the entire file.
    @function - Indicate that the variable refers to a function.
    @ignore - Indicate JsDoc Toolkit should ignore the variable.
    @inner - Indicate that the variable refers to an inner function (and so is also @private).
    @lends - Document that all an object literal's members are members of a given class.
    {@link ...} - Like @see but can be used within the text of other tags.
    @memberOf - Document that this variable refers to a member of a given class.
    @name - Force JsDoc Toolkit to ignore the surrounding code and use the given variable name instead.
    @namespace - Document an object literal is being used as a "namespace."
    @param - Describe a function's parameter.
    @private - Indicate a variable is private (use the -p command line option to include these).
    @property - Document a property of a class from within the constructor's doclet.
    @public - Indicate an inner variable is public.
    @requires - Describe a required resource.
    @returns - Describe the return value of a function.
    @see - Describe a related resource.
    @since - Indicate that a feature has only been available on and after a certain version number.
    @static - Indicate that accessing the variable does not require instantiation of its parent.
    @throws - Describe the exception that a function might throw.
    @type - Describe the expected type of a variable's value or the value returned by a function.
    @version - Indicate the release version of this code.
*/

