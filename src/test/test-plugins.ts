import {visibilityRule} from './rules/visibility/visibility.rule';
import {getTestRuleFunction} from '..';

export const testRule = getTestRuleFunction({
    // a plugin must be supplied so that stylelint can find the rule you want to test
    linterOptions: {config: {plugins: ['./dist/test/test-plugins.js']}},
});

export default [visibilityRule];
