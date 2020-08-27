import {basename} from 'path';
import {DefaultRuleOptions, DefaultOptionMode, createDefaultRule} from '../../../default-rule';

const messages = {
    shouldStartWith(importFileName: string, start: string) {
        return `"${importFileName}" import should start with "${start}"`;
    },
    shouldNotStartWith(importFileName: string, start: string) {
        return `"${importFileName}" import should not start with "${start}"`;
    },
};

export type FileNameStartsWithRuleOptions =
    | (DefaultRuleOptions & {
          startWith: string;
      })
    // when the mode is OFF then startWith isn't a required input
    | (DefaultRuleOptions & {
          mode: DefaultOptionMode.OFF;
          startWith?: string;
      });

function isFileNameStartsWithRuleOptions(
    input: DefaultRuleOptions,
): input is FileNameStartsWithRuleOptions {
    const validatingInput = input as FileNameStartsWithRuleOptions;
    if (
        validatingInput.mode !== DefaultOptionMode.OFF &&
        typeof validatingInput.startWith !== 'string'
    ) {
        return false;
    }

    return true;
}

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
    defaultOptions: {
        mode: DefaultOptionMode.REQUIRE,
        startWith: '_',
    },
    ruleCallback: (report, messages, {ruleOptions, root}) => {
        if (!isFileNameStartsWithRuleOptions(ruleOptions)) {
            report({
                message: messages.invalidOptions(ruleOptions),
                node: root,
            });
            return;
        }

        root.walkAtRules('import', atRule => {
            const importPath = atRule.params
                .split(' ')
                .filter(param => param.match(/^['"]/))[0]
                .replace(/['"]/g, '');
            const fileName = basename(importPath);

            if (
                ruleOptions.mode === DefaultOptionMode.REQUIRE &&
                !fileName.startsWith(ruleOptions.startWith)
            ) {
                report({
                    message: messages.shouldStartWith(fileName, ruleOptions.startWith),
                    node: atRule,
                    word: atRule.toString(),
                });
            } else if (
                ruleOptions.mode === DefaultOptionMode.BLOCK &&
                fileName.startsWith(ruleOptions.startWith)
            ) {
                report({
                    message: messages.shouldNotStartWith(fileName, ruleOptions.startWith),
                    node: atRule,
                    word: atRule.toString(),
                });
            }
        });
    },
});