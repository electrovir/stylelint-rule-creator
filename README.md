# Stylelint Rule Creator

_This is not an official [stylelint](https://stylelint.io) package._

**Create custom stylelint rules with less boilerplate.**

This package greatly reduces the complexity of creating custom stylelint rules. All that is needed is calling a single function to generate a rule that is testable and directly exportable to stylelint as a plugin. All the necessary types are also included to help you keep everything type safe.

## Usage

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
            if (decl.prop === 'visibility') {
                report({
                    message: messages.myMessageName(decl.value),
                    node: decl,
                    word: decl.value,
                });
            }
        });
    },
);
```

For a concrete, in-use example [see this rule creation test file](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/rules/visibility/visibility.rule.ts).

## Testing

This package also exports the functionality of the [`stylelint-jest-rule-tester` package](https://www.npmjs.com/package/stylelint-jest-rule-tester).

### Example

#### Create testRule

In a central file somewhere, create your `testRule` function by calling `getTestRuleFunction` with a reference to your plugin's main file:

```typescript
import {getTestRuleFunction} from 'stylelint-rule-creator';

export const testRule = getTestRuleFunction({
    // a plugin must be supplied so that stylelint can find the rule(s) you want to test
    linterOptions: {config: {plugins: ['./dist/index.js']}},
});
```

In this example, `dist/index.js` should be the file which is exporting your rules as its default export. See [this plugin test file](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/test-plugins.ts) as an example of this.

#### Use testRule

Then, in your rule's test file, import and call `testRule` like so:

```typescript
import {exampleRule} from './example.rule';
import {testRule} from '.';

testRule({
    ruleName: exampleRule.name,
    ruleOptions: [true],
    fix: false,
    accept: [
        {
            // this code should pass the rule
            code: 'div { color: blue }',
        },
    ],
    reject: [
        {
            // this code should fail the rule
            code: 'div { color: blue; visibility: hidden; }',
            message: exampleRule.messages.myMessageName('hidden'),
        },
    ],
});
```

For an actual example of this in use, [see this rule test file](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/rules/visibility/visibility.test.ts).
