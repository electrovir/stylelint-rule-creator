import {fileNameStartsWithRule} from './file-name-starts-with.rule';
import {testDefaultRule} from '../../../default-rule-test';
import {DefaultOptionMode} from '../../../default-rule';

testDefaultRule({
    rule: fileNameStartsWithRule,
    pluginPath: './dist/test/test-plugin.js',
    tests: [
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
                lineExceptions: ['*colors*', '*things*'],
            },
            accept: [
                {
                    code: `
                        @import "colors";

                        a { color: pink; }
                    `,
                    description: 'ignores lines that match line exceptions',
                },
                {
                    code: `
                        @import "colors";
                        @import "things";

                        a { color: pink; }
                    `,
                    description: 'ignores lines that match line exceptions',
                },
                {
                    code: `
                        @import "things";

                        a { color: pink; }
                    `,
                    description: 'ignores lines that match line exceptions',
                },
            ],
            reject: [
                {
                    code: `
                        @import "colors";
                        @import "otherthing";

                        a { color: pink; }
                    `,
                    description: 'catches other lines that do not match line exceptions',
                    message: fileNameStartsWithRule.messages.shouldStartWith('otherthing', '_'),
                },
            ],
        },
    ],
});
