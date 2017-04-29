
var assert = require("assert");
var WUD = require("./whatsupdoc");

[
    {
        name: "first line comment",
        input: "   /**/ foo",
        check(output) {
            assert.equal(output.length, 1);
            assert.equal(output[0].lineNo, 1);
            assert.equal(output[0].comment, "");
            assert.equal(output[0].code, " foo");
        }
    },
    {
        name: "second line comment",
        input: "\n   /**/ foo",
        check(output) {
            assert.equal(output.length, 1);
            assert.equal(output[0].lineNo, 2);
            assert.equal(output[0].comment, "");
            assert.equal(output[0].code, " foo");
        }
    }
].forEach((test, index) => {
    exports['test ' + (test.name || index)] = () => {
        test.check(WUD.comments(test.input));
    };
});

[
    {
        name: "empty module",
        input: "",
        check(output) {
            assert.equal(output.children.length, 0);
        }
    },
    {
        name: "name argument respected",
        input: "",
        id: "foo",
        check(output) {
            assert.equal(output.id, "foo");
            assert.equal(output.name, "foo");
        }
    },
    {
        name: "non-doc comment ignored",
        input: "/**/",
        check(output) {
            assert.equal(output.children.length, 0);
        }
    },
    {
        name: "empty code comment",
        input: "/** */",
        check(output) {
            assert.equal(output.children.length, 1);
            var child = output.children[0];
            assert.equal(child.doc, "");
        }
    },
    {
        name: "explicit @name accepted",
        input: "/** @name blah */",
        check(output) {
            assert.equal(output.children[0].name, "blah");
        }
    },
    {
        name: "content of single doc with line feed",
        input: "    /** hi \n*/",
        check(output) {
            assert.equal(output.children.length, 1);
            assert.equal(output.children[0].doc, "hi");
        }
    },
    {
        name: "multi-line doc in asterisk box style",
        input:  "/**\n" +
                " * hi\n" +
                " */",
        check(output) {
            assert.equal(output.children.length, 1);
            assert.equal(output.children[0].doc, "hi");
        }
    },
    {
        name: "multi-line doc in indent style",
        input:  "/**\n" +
                "    hi\n" +
                "*/",
        check(output) {
            assert.equal(output.children.length, 1);
            assert.equal(output.children[0].doc, "hi");
        }
    },
    {
        name: "multi-line doc preserving initial space on second line",
        input:  "/** leader\n" +
                "     - hi\n" +
                "*/",
        check(output) {
            assert.equal(output.children.length, 1);
            assert.equal(output.children[0].doc, "leader\n - hi");
        }
    },
    {
        name: "indented multi-line doc preserving initial space on second line",
        input:  "   /** leader\n" +
                "        - hi\n" +
                "   */",
        check(output) {
            assert.equal(output.children.length, 1);
            assert.equal(output.children[0].doc, "leader\n - hi");
        }
    },
    {
        name: "mixed tab indented multi-line doc preserving initial space on second line",
        input:  "  /** leader\n" +
                "\t   - hi\n" +
                "  */",
        check(output) {
            assert.equal(output.children.length, 1);
            assert.equal(output.children[0].doc, "leader\n - hi");
        }
    },
    {
        name: "name inferred from first assignment in code",
        input: "/***/\nvar blah = {};",
        check(output) {
            assert.equal(output.children[0].name, "blah");
        }
    },
    {
        name: "name inferred from export assignment in code",
        input: "/***/\nexports.blah = {};",
        check(output) {
            assert.equal(output.children[0].name, "blah");
        }
    }
].forEach((test, index) => {
    exports['test ' + (test.name || index)] = () => {
        test.check(WUD.parseModule(test.input, test.id));
    };
});

if (require.main == module) {
    require("test").run(exports);
}

