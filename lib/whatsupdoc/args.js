
var ARGS = require("args");

var parser = exports.parser = new ARGS.Parser();

parser.interleaved();

parser.arg('dir');

parser.option('-a', '--all')
    .help('compile all modules in all packages')
    .set(true);

parser.option('-m', '--module', 'id')
    .help('compile a module by its top-level identifier')
    .todo('module', 'id');

parser.option('-p', '--package', 'name')
    .help('compile a package by its name')
    .todo('package', 'package');

parser.helpful();

