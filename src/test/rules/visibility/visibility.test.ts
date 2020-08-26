import {visibilityRule} from './visibility.rule';
import {testRule} from '../../..';

testRule({
    ruleName: visibilityRule.ruleName,
    ruleOptions: [true],
    fix: true,
    linterOptions: {config: {plugins: ['./dist/test/test-plugin.js']}},
    accept: [
        {
            code: 'a { color: pink; }',
        },
    ],
    reject: [
        {
            code: 'a { color: pink; visibility: hidden; }',
            fixed: 'a { color: pink; }',
            message: visibilityRule.messages.noUseVisibility(),
        },
    ],
});
