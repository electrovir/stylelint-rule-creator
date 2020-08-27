import {basename} from 'path';
import {
    DefaultRuleOptions,
    DefaultOptionMode,
    createDefaultRule,
    doesMatchLineExceptions,
} from '../../../default-rule';

const messages = {
    shouldStartWith(importFileName: string, start: string) {
        return `"${importFileName}" import should start with "${start}"`;
    },
    shouldNotStartWith(importFileName: string, start: string) {
        return `"${importFileName}" import should not start with "${start}"`;
    },
};

export type FileNameStartsWithRuleOptions = DefaultRuleOptions & {
    startWith?: string;
};

const defaultOptions = {
    mode: DefaultOptionMode.REQUIRE,
    startWith: '_',
};

/**
 * this rules uses the very opinionated createdDefaultRule function which provides many benefits but
 * also locks you into a certain paradigm
 */
export const fileNameStartsWithRule = createDefaultRule<
    typeof messages,
    FileNameStartsWithRuleOptions
>({
    ruleName: `rule-creator/file-name-starts-with`,
    messages,
    defaultOptions,
    ruleCallback: (report, messages, {ruleOptions, root, exceptionRegExps}) => {
        root.walkAtRules('import', atRule => {
            if (doesMatchLineExceptions(atRule, exceptionRegExps)) {
                return;
            }
            const importPath = atRule.params
                .split(' ')
                .filter(param => param.match(/^['"]/))[0]
                .replace(/['"]/g, '');
            const fileName = basename(importPath);
            const startWith = ruleOptions.startWith || defaultOptions.startWith;

            if (ruleOptions.mode === DefaultOptionMode.REQUIRE && !fileName.startsWith(startWith)) {
                report({
                    message: messages.shouldStartWith(fileName, startWith),
                    node: atRule,
                    word: atRule.toString(),
                });
            } else if (
                ruleOptions.mode === DefaultOptionMode.BLOCK &&
                fileName.startsWith(startWith)
            ) {
                report({
                    message: messages.shouldNotStartWith(fileName, startWith),
                    node: atRule,
                    word: atRule.toString(),
                });
            }
        });
    },
});
