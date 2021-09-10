import {testRule} from '../../..';
import {visibilityRule} from './visibility.rule';

testRule({
    ruleName: visibilityRule.ruleName,
    ruleOptions: true,
    description: 'should work with a bare boolean value',
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

testRule({
    ruleName: visibilityRule.ruleName,
    ruleOptions: [true],
    description: 'also should work with an array',
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
