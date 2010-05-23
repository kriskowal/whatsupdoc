
/**
 * provides command line argument parsing for the
 * `whatsupdoc` command.
 * @module
 */

/*whatsupdoc*/

var ARGS = require("narwhal/args");

/** an arguments parser from the `narwhal-lib` `args` module
 * for the `whatsupdoc` command line utility. */
var parser = exports.parser = new ARGS.Parser();

parser.interleaved();

parser.help(
'Builds an API reference site from selected CommonJS\n' +
'modules and packages.'
);

parser.arg('api_build_dir');

parser.option('-a', '--all')
    .help('compile all modules in all packages')
    .set(true);

parser.option('-m', '--module', 'id')
    .help('compile a module by its top-level identifier')
    .name('modules')
    .push();

parser.option('-p', '--package', 'name')
    .help('compile a package by its name')
    .name('packages')
    .push();

parser.option('-i', '--input', 'fileName')
    .help('compile a module by its file name')
    .name('paths')
    .push();

parser.option('-P', '--prefix', 'prefix')
    .help('add an alternate package prefix')
    .name('prefixes')
    .push();

parser.option('-E', '--engine', 'engine')
    .help('add an alternate engine')
    .name('engines')
    .push();

parser.option('-e', '--errors')
    .help('show errors in generated HTML.')
    .name('showErrors')
    .set(true);

parser.option('-s', '--source-links')
    .help('generate file:// links for source code')
    .name('sourceLinks')
    .set(true);

parser.option('-f', '--force')
    .help('force documentation of modules that lack a /*whatsupdoc*/ annotation')
    .set(true);

parser.option('-v', '--verbose')
    .help('logs each module that is documented')
    .set(true);

parser.helpful();

