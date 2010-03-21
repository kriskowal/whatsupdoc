
var SYSTEM = require("system");
var OS = require("os");
var UTIL = require("util");
var ARGS = require("./args");

exports.main = function (SYSTEM) {
    var options = ARGS.parser.parse(SYSTEM.args);
    var packages = [];
    var modules = [];
    UTIL.forEachApply(options.todo, function (type, task) {
        print(type + " " + task);
    });
    return 0;
};

if (require.main == module)
    OS.exit(exports.main(SYSTEM));

