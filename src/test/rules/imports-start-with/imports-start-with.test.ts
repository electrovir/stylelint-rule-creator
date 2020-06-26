import {testRule} from '../../test-plugins';
import {leadingUnderscoreRule} from './imports-start-with.rule';

testRule({
    ruleName: leadingUnderscoreRule.ruleName,
    ruleOptions: [{mode: 'require', char: '_'}],
    fix: true,
    accept: [
        {
            code: `
                @import (reference) "_colors";
                a { color: pink; }
            `,
        },
        {
            code: `
                @import (reference) "../../../_colors";
                a { color: pink; }
            `,
        },
    ],
    reject: [],
});
