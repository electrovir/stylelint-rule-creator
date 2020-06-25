# Stylelint Rule Creator

_This is not an official [stylelint](https://stylelint.io) package._

**Create custom stylelint rules with less boilerplate.**

This package greatly reduces the complexity of creating custom stylelint rules. All that is needed is calling a single function to generate a rule that is testable and directly exportable to stylelint as a plugin. All the necessary types are also included to help you keep everything type safe.

# Usage

```bash
npm install stylelint-rule-creator
```

This is _all_ you need in order to create a rule:

```typescript
import {createRule} from 'stylelint-rule-creator';

export const myExampleRule = createRule(
    'my-plugin-name/my-rule-name',
    {
        myMessageName: (messageInput: string) => `My message example: ${messageInput}`,
    },
    (report, messages, {primaryOption, root}) => {
        if (!primaryOption) {
            return;
        }

        root.walkDecls(decl => {
            if (<declaration violated logic>) {
                report({
                    message: messages.myMessageName(decl.value),
                    node: decl,
                    word: decl.value
                });
            }
        });
    },
);
```

For a more concrete example [see this test files](https://github.com/electrovir/stylelint-rule-creator/src/test/rules/visibility/visibility.rule.ts).
