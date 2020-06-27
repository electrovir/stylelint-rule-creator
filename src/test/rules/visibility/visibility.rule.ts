import {createRule} from '../../..';

/*
Example rule influenced by
https://www.codementor.io/@rudolfolah/stylelint-rules-how-to-write-your-own-rules-hhmwikafq
*/

const messages = {
    noUseVisibility: () => `Try not to use visibility.`,
};

export const visibilityRule = createRule<typeof messages, string | undefined>({
    ruleName: 'skeleton/visibility',
    messages,
    optionsCallback: (primary): string | undefined => {
        return `${primary}`;
    },
    ruleCallback: (
        reportCallback,
        messageCallbacks,
        {primaryOption, context, root, optionsCallbackResult},
    ) => {
        if (!primaryOption) {
            return;
        }
        if (!optionsCallbackResult) {
            reportCallback({
                message: 'Messed up options callback',
                node: root,
            });
        }

        root.walkDecls(decl => {
            if (decl.prop === 'visibility') {
                if (context.fix) {
                    decl.remove();
                } else {
                    reportCallback({
                        message: messageCallbacks.noUseVisibility(),
                        node: decl,
                        word: decl.value,
                    });
                }
            }
        });
    },
});
