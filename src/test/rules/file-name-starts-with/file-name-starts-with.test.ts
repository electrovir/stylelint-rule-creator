import {DefaultOptionMode} from '../../../default-rule';
import {testDefaultRule} from '../../../default-rule-test';
import {fileNameStartsWithRule} from './file-name-starts-with.rule';

testDefaultRule({
    rule: fileNameStartsWithRule,
    pluginPath: './dist/test/test-plugin.js',
    tests: [
        {
            ruleOptions: true,
            linterOptions: {
                customSyntax: 'postcss-less',
            },
            description: 'test different syntax',
            accept: [
                {
                    code: `
                        @import (reference) "_colors";

                        a { color: pink; }
                        
                        .myMixin() {
                            font-family: serif;
                        }
                        
                        div {
                            .myMixin();
                            color: #123;
                        }
                    `,
                    description: 'accepts import with startWith',
                },
            ],
            reject: [],
        },
        {
            ruleOptions: true,
            description: 'should work with default rule options',
            accept: [
                {
                    code: `
                        @import (reference) "_colors";

                        a { color: pink; }
                    `,
                    description: 'accepts import with startWith',
                },
                {
                    code: `
                        @import (reference) "../../../_colors";
                        a { color: pink; }
                    `,
                    description: 'accepts import with startWith and directories',
                },
            ],
            reject: [
                {
                    code: `
                        @import (reference) "colors";
                        a { color: pink; }
                    `,
                    description: 'blocks import without startWith',
                    message: fileNameStartsWithRule.messages.shouldStartWith('colors', '_'),
                },
                {
                    code: `
                        @import (reference) "../../../colors";
                        a { color: pink; }
                    `,
                    description: 'blocks import with directories and without startWith',
                    message: fileNameStartsWithRule.messages.shouldStartWith('colors', '_'),
                },
            ],
        },
        {
            ruleOptions: true,
            description: 'should work with default rule options',
            fix: true,
            accept: [
                {
                    code: `
                        @import (reference) "_colors";

                        a { color: pink; }
                    `,
                    description: 'accepts import with startWith',
                },
                {
                    code: `
                        @import (reference) "../../../_colors";
                        a { color: pink; }
                    `,
                    description: 'accepts import with startWith and directories',
                },
            ],
            reject: [
                {
                    code: `
                        @import (reference) "colors";
                        a { color: pink; }
                    `,
                    description: 'blocks import without startWith',
                    message: fileNameStartsWithRule.messages.shouldStartWith('colors', '_'),
                    fixed: `
                        @import (reference) "_colors";
                        a { color: pink; }
                    `,
                },
                {
                    code: `
                        @import (reference) "../../../colors";
                        a { color: pink; }
                    `,
                    description: 'blocks import with directories and without startWith',
                    message: fileNameStartsWithRule.messages.shouldStartWith('colors', '_'),
                    fixed: `
                        @import (reference) "../../../_colors";
                        a { color: pink; }
                    `,
                },
            ],
        },
        {
            ruleOptions: {
                // try to get this to work as well
                mode: DefaultOptionMode.REQUIRE,
                startWith: '_',
            },
            accept: [
                {
                    code: `
                        @import (reference) "_colors";

                        a { color: pink; }
                    `,
                    description: 'accepts import with startWith',
                },
                {
                    code: `
                        @import (reference) "../../../_colors";
                        a { color: pink; }
                    `,
                    description: 'accepts import with startWith and directories',
                },
            ],
            reject: [
                {
                    code: `
                        @import (reference) "colors";
                        a { color: pink; }
                    `,
                    description: 'blocks import without startWith',
                    message: fileNameStartsWithRule.messages.shouldStartWith('colors', '_'),
                },
                {
                    code: `
                        @import (reference) "../../../colors";
                        a { color: pink; }
                    `,
                    description: 'blocks import with directories and without startWith',
                    message: fileNameStartsWithRule.messages.shouldStartWith('colors', '_'),
                },
                {
                    code: `
                        @import (reference) "../../../_dir/colors";
                        a { color: pink; }
                    `,
                    description:
                        'blocks import without startWith and with directories with startWith',
                    message: fileNameStartsWithRule.messages.shouldStartWith('colors', '_'),
                },
            ],
        },
        {
            ruleOptions: {
                mode: DefaultOptionMode.BLOCK,
                startWith: '_',
            },
            accept: [
                {
                    code: `
                        @import (reference) "colors";

                        a { color: pink; }
                    `,
                    description: 'accepts import without blocked startWith',
                },
                {
                    code: `
                        @import (reference) "../../../colors";
                        a { color: pink; }
                    `,
                    description: 'accepts import without blocked startWith and with directories',
                },
            ],
            reject: [
                {
                    code: `
                        @import (reference) "_colors";
                        a { color: pink; }
                    `,
                    description: 'blocks import with blocked startWith',
                    message: fileNameStartsWithRule.messages.shouldNotStartWith('_colors', '_'),
                },
                {
                    code: `
                        @import (reference) "../../../_colors";
                        a { color: pink; }
                    `,
                    description: 'blocks import with directories and with blocked startWith',
                    message: fileNameStartsWithRule.messages.shouldNotStartWith('_colors', '_'),
                },
                {
                    code: `
                        @import (reference) "../../../thingie/_colors";
                        a { color: pink; }
                    `,
                    description:
                        'blocks import with blocked startWith and with directories without blocked startWith',
                    message: fileNameStartsWithRule.messages.shouldNotStartWith('_colors', '_'),
                },
            ],
        },
        {
            ruleOptions: {
                mode: DefaultOptionMode.REQUIRE,
                startWith: '_',
                lineExceptions: [
                    '*colors*',
                    '*things*',
                ],
            },
            description: 'should ignore lines that match line exceptions',
            accept: [
                {
                    code: `
                        @import "colors";

                        a { color: pink; }
                    `,
                },
                {
                    code: `
                        @import "colors";
                        @import "things";

                        a { color: pink; }
                    `,
                },
                {
                    code: `
                        @import "things";

                        a { color: pink; }
                    `,
                },
                {
                    code: `
                        @import "../../things";

                        a { color: pink; }
                    `,
                },
            ],
            reject: [
                {
                    code: `
                        @import "colors";
                        @import "other-thing";

                        a { color: pink; }
                    `,
                    description: 'catches other lines that do not match line exceptions',
                    message: fileNameStartsWithRule.messages.shouldStartWith('other-thing', '_'),
                },
            ],
        },
        {
            ruleOptions: {
                mode: DefaultOptionMode.REQUIRE,
                startWith: '_',
                fileExceptions: [
                    '/**/path/**/*.less',
                    '/**/path/**/*.css',
                ],
            },
            linterOptions: {
                codeFilename: 'path/to-directory/and/filename.css',
            },
            description: 'should ignore whole files that match file exceptions',
            accept: [
                {
                    code: `
                        @import "colors";
                        @import "a";
                        @import "b";
                        @import "c";
                        @import "d";

                        a { color: pink; }
                    `,
                },
            ],
            reject: [],
        },
        {
            ruleOptions: {
                mode: DefaultOptionMode.REQUIRE,
                startWith: '_',
                lineExceptions: ['*"{a,b,c,d}"*'],
            },
            linterOptions: {
                codeFilename: 'path/to-directory/and/filename.css',
            },
            description: 'should ignore lines with or matching',
            accept: [
                {
                    code: `
                        @import "a";
                        @import "b";
                        @import "c";
                        @import "d";

                        a { color: pink; }
                    `,
                },
            ],
            reject: [],
        },
    ],
});
