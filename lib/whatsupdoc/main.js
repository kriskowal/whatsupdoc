
var SYSTEM = require("system");
var OS = require("narwhal/os");
var FS = require("narwhal/fs");
var UTIL = require("narwhal/util");
var TERM = require("narwhal/term");
var ARGS = require("./args");
var SEARCH = require("./search");
var WHATSUPDOC = require("../whatsupdoc");
var THATSALLFOLKS = require("thatsallfolks");
var stream = TERM.stream;

/*whatsupdoc*/
/*markup markdown*/

/** */
exports.main = function (SYSTEM) {
    var options = ARGS.parser.parse(SYSTEM.args);
    var packages = [];
    var modules = [];
    if (options.args.length == 0) {
        stream.print('\0red(You must specify an API build directory.\0)'); 
        return -1;
    } else if (options.args.length > 1) {
        print("Error: only one, non-optional argument is " +
            "required, the target build directory");
    }

    var api = options.args.shift();
    api = FS.path(api).absolute();
    api.makeTree();

    var finds = exports.search(options);
    var root = WHATSUPDOC.parseModules(
        finds,
        options.force,
        options.verbose
    );

    api.join("all.json").write(
        JSON.stringify(root, null, 4),
        {"charset": "UTF-8"}
    );

    exports.crossReference(root);

    exports.walk(root, function (node) {
        exports.makeJson(node, api);
    });
    exports.walk(root, function (node) {
        exports.makeJsonTxt(node, api);
    });
    exports.walk(root, function (node) {
        exports.makeHtml(node, api);
    });

    exports.makeIndex(root, api);

    return 0;
};

/**
 * @param {{all, packages, modules, paths}} options returned by
 * `args.parser.parse`.
 * @returns {Array * {id, path, pkg}} module descriptions for the
 * modules to document.
 */
exports.search = function (options) {
    var finds = SEARCH.searchAll();
    if (!options.all) {
        finds = finds.filter(function (find) {
            return UTIL.has(options.packages, find.pkg) ||
                UTIL.has(options.modules, find.id) ||
                UTIL.has(options.paths, find.path);
        });
        // account for modules outside the package
        // system
        var paths = finds.map(function (find) {
            return find.path;
        });
        options.paths.forEach(function (path) {
            if (!UTIL.has(paths, path)) {
                path = FS.path(path).canonical();
                finds.push({
                    "id": path.toString(),
                    "path": path,
                    "pkg": "/"
                });
            }
        });
    }
    return finds;
};

/**
 */
exports.crossReference = function (node, heritage) {
    if (!heritage)
        heritage = ["packages"];

    // reflect index and children
    if (node.index) {
        node.children = UTIL.sorted(UTIL.values(node.index));
    } else if (node.children) {
        node.index = UTIL.object(node.children.map(function (child) {
            return [child.name, child];
        }));
    }

    node.heritage = heritage;
    if (node.name) {
        var name = node.name.replace(/\//g, "--");
        if (name === UTIL.camel(name)) {
            name = UTIL.lower(name, '-');
        } else if (name === UTIL.title(name)) {
            name = "_" + UTIL.lower(name, '-');
        } else if (name === UTIL.upper(name, "_")) {
            name = "__" + UTIL.lower(name, '-');
        } else {
            name = UTIL.lower(name, "-");
        }
        heritage = heritage.concat([name]);
    }

    // href
    node.href = heritage.join("---");

    (node.children || []).forEach(function (child) {
        exports.crossReference(child, heritage);
    });
};

/**
 */
exports.walk = function (node, callback) {
    callback(node);
    (node.children || []).forEach(function (node) {
        exports.walk(node, callback);
    });
};

/**
 */
exports.makeJson = function (node, directory) {
    var path = directory.join(node.href + ".json");
    path.write(
        JSON.stringify(node),
        {"charset": "UTF-8"}
    );
};

/**
 */
exports.makeJsonTxt = function (node, directory) {
    var path = directory.join(node.href + ".txt");
    path.write(
        JSON.stringify(node, null, 4),
        {"charset": "UTF-8"}
    );
};

/**
 */
exports.makeHtml = function (node, directory) {
    var path = directory.join(node.href + ".html");
    var type = "object";
    if (node.type && node.type != "module") {
        type = node.type;
    }
    var templateName = "whatsupdoc/" + type + ".html"
    var template = THATSALLFOLKS.load(templateName);
    path.write(
        template.format(node),
        {"charset": "UTF-8"}
    );
};

/**
 */
exports.makeIndex = function (node, directory) {
    var path = directory.join("index.html");
    var template = THATSALLFOLKS.load("whatsupdoc/index.html");
    path.write(template.format({
        "index": node.children.map(exports.makeIndexPartial).join("\n")
    }), {"charset": "UTF-8"});
};

/**
 */
exports.makeIndexPartial = function (node) {
    var raw = THATSALLFOLKS.load("whatsupdoc/index.raw.html");
    return raw.format({
        "name": node.name,
        "href": node.href,
        "type": node.type,
        "children": (node.children || []).map(exports.makeIndexPartial).join("\n")
    });
};

if (require.main == module)
    OS.exit(exports.main(SYSTEM));

