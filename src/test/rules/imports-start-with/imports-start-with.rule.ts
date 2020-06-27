import {createRule} from '../../..';
import {basename} from 'path';

const messages = {
    shouldStartWith(fileName: string, start: string) {
        return `"${fileName}" import should start with "${start}"`;
    },
    shouldNotStartWith(fileName: string, start: string) {
        return `"${fileName}" import should not start with "${start}"`;
    },
};

enum UnderscoreOption {
    OFF = 'off',
    REQUIRE = 'require',
    BLOCK = 'block',
}

type Options = {
    start: string;
    mode: UnderscoreOption;
};

function isUnderscoreOption(input: string): input is UnderscoreOption {
    return Object.values(UnderscoreOption).includes(input as any);
}

function isOptions(input: {[key: string]: any}): input is Options {
    const validatingInput = input as Options;
    if (typeof validatingInput.start !== 'string') {
        return false;
    }
    if (!isUnderscoreOption(validatingInput.mode)) {
        return false;
    }

    return true;
}

export const leadingUnderscoreRule = createRule<typeof messages, Options>({
    ruleName: `skeleton/leading-underscore`,
    messages,
    ruleCallback: (reportCallback, messageCallbacks, {primaryOption, root}) => {
        if (!primaryOption) {
            return;
        } else if (!isOptions(primaryOption as any)) {
            return;
        } else if (primaryOption.mode === UnderscoreOption.OFF) {
            return;
        }

        root.walkAtRules('import', atRule => {
            const fileName = basename(
                atRule.params
                    .split(' ')
                    .filter(param => param.match(/^['"]/))[0]
                    .replace(/['"]/g, ''),
            );

            if (
                primaryOption.mode === UnderscoreOption.REQUIRE &&
                !fileName.startsWith(primaryOption.start)
            ) {
                reportCallback({
                    message: messageCallbacks.shouldStartWith(fileName, primaryOption.start),
                    node: atRule,
                    word: atRule.toString(),
                });
            } else if (
                primaryOption.mode === UnderscoreOption.BLOCK &&
                fileName.startsWith(primaryOption.start)
            ) {
            }
        });
    },
});
