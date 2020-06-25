import {createRule} from '../../..';

/*
Example rule influenced by
https://www.codementor.io/@rudolfolah/stylelint-rules-how-to-write-your-own-rules-hhmwikafq
*/

export const visibilityRule = createRule(
    'skeleton/visibility',
    {
        noUseVisibility: () => `Try not to use visibility.`,
    },
    (reportCallback, messageCallbacks, {primaryOption, context, root}) => {
        if (!primaryOption) {
            return;
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
);
