import {basename} from 'path';
import {AtRule} from 'postcss';
import {
    createDefaultRule,
    DefaultOptionMode,
    DefaultRuleOptions,
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

function replaceAtRule(atRule: AtRule, newFileName: string, oldFileName: string) {
    const newParams = atRule.params.replace(oldFileName, newFileName);
    const replacementNode = atRule.clone({
        params: newParams,
    });
    atRule.replaceWith(replacementNode);
}

function extractImportFileParam(atRule: AtRule): string {
    const importParam = atRule.params.split(' ').filter((param) => param.match(/^['"]/))[0];

    if (!importParam) {
        throw new Error(`No import path found in ${atRule.params}`);
    }

    return importParam;
}

/**
 * This rules uses the very opinionated createdDefaultRule function which provides many benefits but
 * also locks you into a certain paradigm
 */
export const fileNameStartsWithRule = createDefaultRule<
    typeof messages,
    FileNameStartsWithRuleOptions
>({
    ruleName: `rule-creator/file-name-starts-with`,
    messages,
    defaultOptions,
    ruleCallback: (report, messages, {ruleOptions, root, context, exceptionRegExps}) => {
        root.walkAtRules('import', (atRule) => {
            if (doesMatchLineExceptions(atRule, exceptionRegExps)) {
                return;
            }
            const importParam = extractImportFileParam(atRule);

            const fileName = basename(importParam.replace(/['"]/g, ''));
            const startWith = ruleOptions.startWith || defaultOptions.startWith;

            if (ruleOptions.mode === DefaultOptionMode.REQUIRE && !fileName.startsWith(startWith)) {
                if (context.fix) {
                    const newFileName = `${startWith}${fileName}`;
                    replaceAtRule(atRule, newFileName, fileName);
                } else {
                    report({
                        message: messages.shouldStartWith(fileName, startWith),
                        node: atRule,
                        word: atRule.toString(),
                    });
                }
            } else if (
                ruleOptions.mode === DefaultOptionMode.BLOCK &&
                fileName.startsWith(startWith)
            ) {
                if (context.fix) {
                    const newFileName = fileName.replace(new RegExp(`^${startWith}`), '');
                    replaceAtRule(atRule, newFileName, fileName);
                } else {
                    report({
                        message: messages.shouldNotStartWith(fileName, startWith),
                        node: atRule,
                        word: atRule.toString(),
                    });
                }
            }
        });
    },
});
