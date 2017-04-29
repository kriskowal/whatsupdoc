
var ASSERT = require("assert");
var UTIL = require("util");
var PARSERS = require("whatsupdoc/parsers");

exports.testParseCurly = () => {
    UTIL.forEachApply([
        ["{test}", ["test", ""]],
        ["{{test}}", ["{test}", ""]],
        ["{{test}{test}}", ["{test}{test}", ""]],
        ["{test} x", ["test", " x"]],
        ["{{test}} x", ["{test}", " x"]],
        ["{{test}{test}} x", ["{test}{test}", " x"]],
        ["{ test } x", [" test ", " x"]],
        ["{ {test} } x", [" {test} ", " x"]],
        ["{ {test} { test }} x", [" {test} { test }", " x"]]
    ], (input, output) => {
        ASSERT.deepEqual(PARSERS.parseCurly(input), output);
    });
};

if (require.main == module)
    require("os").exit(require("test").run(exports));

