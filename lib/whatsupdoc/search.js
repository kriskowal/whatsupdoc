
/**
 * Provides methods for finding modules in packages, and
 * detecting which modules are actually available in the
 * current sea, accounting for path masking, the active
 * JavaScript engines, and the package directory name
 * overrides in `package.json` if applicable.
 *
 * @module
 */

/*whatsupdoc*/

var ENGINE = require("narwhal/engine");
var FS = require("narwhal/fs");
var PACKAGES = require("narwhal/packages");
var UTIL = require("narwhal/util");

/**
 * Searches for all modules in all packages.
 *
 * @returns {Array * {id String, path Path, pkg String}} an
 * array of the identifier, path, and package name for every
 * module in every package.  There may be duplicates for a
 * given identifier.
 * @param system an optional override for the system module
 * object
 * @param packages an optional override for the packages
 * module object, which should have `order` and `catalog`
 * properties for the precedence order and name to package
 * info object properties.
 */
exports.searchAll = function (engine, packages) {
    return exports.dub(exports.searchAllPredub(engine, packages));
};

/**
 * Searches for all modules in all packages, providing an
 * incomplete picture of the module identifier.
 *
 * @see dub
 * @returns {Array * {path Path, lib Path, pkg String}} an
 * array of the identifier, path, and package name for every
 * module in every package.  There may be duplicates for a
 * given identifier.
 * @param engine an optional override for the engine module
 * object
 * @param packages an optional override for the packages
 * module object, which should have `order` and `catalog`
 * properties for the precedence order and name to package
 * info object properties.
 */
exports.searchAllPredub = function (engine, packages) {
    packages = packages || PACKAGES;
    engine = engine || ENGINE;

    // scan the package order for all possibly relevant
    // javascript files for the given engines

    var finds = [];
    packages.order.forEach(function (info) {
        exports.searchPkgInfoPredub(info, engine).forEach(function (find) {
            finds.push(find);
        });
    });

    return finds;
};

/**
 * @param {String} pkg package name.
 * @returns {Array * {id String, path Path, pkg String}} an
 * array of the identifier, path, and package name for every
 * module in the given package.
 */
exports.searchPkg = function (pkg) {
    return exports.dub(exports.searchPkg(pkg));
};

/**
 * @param {String} pkg package name.
 * @returns {Array * {path Path, lib Path, pkg String}} an
 * array of the identifier, path, and package name for every
 * module in the given package.
 */
exports.searchPkgPredub = function (pkg) {
    return exports.searchPkgInfoPredub(PACKAGES.catalog[pkg]);
};

/**
 * Finds all of the modules and their library paths for the
 * given package info object, including their identifiers.
 *
 * @param {String} pkg package info object, as provided by
 * the objects in the `packages` module `catalog` or
 * precedence `order` objects.
 * @returns {Array * {id String, path Path, pkg String}} an
 * array of the path, library path, and package name for
 * every module in the given package.  Use {@link dub} to
 * reconstruct module identifiers from each find.
 */
exports.searchPkgInfo = function (info) {
    return exports.dub(exports.searchPkgInfoPredub(info));
};

/**
 * Finds all of the modules and their library paths for the
 * given package info object.
 *
 * @param {String} pkg package info object, as provided by
 * the objects in the `packages` module `catalog` or
 * precedence `order` objects.
 * @param engine an optional override for the `narwhal/engine`
 * module for its `engines` `Array`.
 * @returns {Array * {path Path, lib Path, pkg String}} an
 * array of the path, library path, and package name for
 * every module in the given package.  Use {@link dub} to
 * reconstruct module identifiers from each find.
 */
exports.searchPkgInfoPredub = function (info, engine) {
    var directory = info.directory;
    var finds = [];
    engine = engine || ENGINE;

    var enginePaths = info.engines || 'engines';
    if (typeof enginePaths == "string")
        enginePaths = [enginePaths];
    engine.engines.forEach(function (engine) {
        enginePaths.forEach(function (enginePath) {
            enginePath = enginePath + '/' + engine;
            var enginePath = info[enginePath] || enginePath;
            if (typeof enginePath == "string")
                enginePath = [enginePath];
            enginePath.forEach(function (enginePaths) {
                enginePaths = enginePath + '/lib';
                var enginePath = info[enginePaths] || enginePaths;
                if (typeof enginePath == "string")
                    enginePath = [enginePath];
                enginePath.forEach(function (enginePath) {
                    enginePath = info.directory.join(enginePath);
                    enginePath.globPaths("**/*.js").forEach(function (path) {
                        finds.push({
                            "path": path,
                            "lib": enginePath, 
                            "pkg": info.name
                        });
                    });
                });
            });
        });
    });

    info.lib.forEach(function (lib) {
        lib.globPaths("**/*.js").forEach(function (path) {
            finds.push({
                "path": path,
                "lib": lib,
                "pkg": info.name
            });
        });
    });

    return finds;
};

/**
 * Reconstructs the module id of each module found, based
 * on its path and parent library path.
 *
 * @param {Array * {path Path, lib Path, ...}} finds
 * provided by any of the search "predub" functions,
 * particularly depending on the `path` and `lib`
 * properties.  @returns {Array * {id String, ...}} an array
 * of shallow copies of the given finds with an additional
 * `id` property.
 */
exports.dub = function (finds) {
    // transform paths into identifiers
    return finds.map(function (find) {
        find = UTIL.copy(find);
        var relative = find.path.from(find.lib.join('herein'));
        var parts = relative.split();
        parts.pop();
        parts.push(relative.base('.js'));
        find.id = parts.join('/');
        return find;
    });
};

/**
 * @returns {Array * String} the unique set of all
 * identifiers in a set of finds.
 * @param {Array * {id String, ...}} finds as returned by
 * the {@link dub} method, by way of any search method.
 */
exports.ids = function (finds) {
    return UTIL.unique(finds.map(function (find) {
        return find.id;
    }));
};

/**
 * @param {Array * {path Path, ...}} a collection of module
 * finds as returned by any of the search methods, or {@link
 * dub}
 * @returns {Object * [path, {...}]} a mapping from module
 * path to its find information.
 */
exports.paths = function (finds) {
    return UTIL.object(finds.map(function (find) {
        return [find.path, find];
    }));
};

/**
 * @param {Array * {id String, ...}} a collection of module
 * finds as returned by {@link dub} by way of any of the
 * search methods.
 * @returns {Object * [id, Array * {...}]} a mapping from
 * module identifiers to the list of all implementations
 * that have that identifier.  There can be more than one
 * if a module exists on multiple paths, and which one gets
 * loaded depends on the path order.
 */
exports.options = function (finds) {
    var map = {};
    finds.forEach(function (find) {
        map[find.id] = map[find.id] || [];
        map[find.id].push(find);
    });
    return map;
};

/**
 * @param {Object * [id, Array * Object]} a mapping from
 * module identifiers to the list of all implementations of
 * that module.
 * @returns {Object * [id, Object]} a mapping from module
 * identifiers to the find information for the module that
 * would actually be loaded if that identifier were
 * required.
 */
exports.actuals = function (options) {
    return UTIL.object(UTIL.mapApply(options,
    function (id, options) {
        if (options.length == 1)
            return [id, options[0]];
        var actual = require.loader.find(id);
        return [id, options.filter(function (find) {
            return find.path == actual;
        })[0]];
    }));
};

if (require.main == module) {
    var finds = exports.searchAllPredub();
    finds = exports.dub(finds);
    var options = exports.options(finds);
    var actuals = exports.actuals(options);
    print(JSON.encode(actuals, null, 4));
}

