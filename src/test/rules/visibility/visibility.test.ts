import {visibilityRule} from './visibility.rule';
import {testRule} from '../../test-plugins';

testRule({
    ruleName: visibilityRule.ruleName,
    ruleOptions: [true],
    fix: true,
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
