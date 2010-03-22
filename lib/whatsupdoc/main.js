
var SYSTEM = require("system");
var OS = require("os");
var FILE = require("file");
var UTIL = require("util");
var ARGS = require("./args");
var SEARCH = require("./search");
var WHATSUPDOC = require("../whatsupdoc");
var TERM = require("term");
var stream = TERM.stream;

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
    api = FILE.path(api).absolute();
    api.mkdirs();

    var finds = exports.search(options);

    api.join("all.json").write(
        JSON.encode(
            WHATSUPDOC.parseModules(
                finds,
                options.force,
                options.verbose
            ),
            null,
            4
        ),
        {"charset": "UTF-8"}
    );

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
                path = FILE.path(path).canonical();
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

if (require.main == module)
    OS.exit(exports.main(SYSTEM));

