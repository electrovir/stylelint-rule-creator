# Stylelint Rule Creator

_This is not an official [stylelint](https://stylelint.io) package._

[![tests](https://github.com/electrovir/stylelint-rule-creator/actions/workflows/virmator-tests.yml/badge.svg?branch=master)](https://github.com/electrovir/stylelint-rule-creator/actions/workflows/virmator-tests.yml)

**Create custom stylelint rules with less boilerplate.**

This package greatly reduces the complexity of creating custom stylelint rules. All that is needed is calling a single function to generate a testable and directly exportable rule to stylelint as a plugin. All the necessary types are also included to keep everything type safe.

There are two ways of creating a decreased-boilerplate rule with this package. Both export an object which can be directly exported as a `Plugin` for stylelint.

-   There's the opinionated `DefaultRule` created with `createDefaultRule`. `DefaultRule` is very easy to test, automatically generates tests based on those supplied to it, and is much more type safe.
-   There's the bare-bones `Rule` created with `createRule`. This is less opinionated than `DefaultRule` but requires more checking in the rule and setup for tests.

If possible, prefer using `DefaultRule` with `createDefaultRule` to have the best experience.

## Installation

```bash
npm install stylelint-rule-creator
```

## `createDefaultRule` Usage

This is the recommended way of creating a rule.

`createDefaultRule` creates a `DefaultRule` object which greatly reduces boilerplate needed for type checking and testing. Extra tests are automatically generated from the tests you supply. Stricter typing is enforced on `DefaultRule` and its tests.

`DefaultRule` requires that the rule is always enabled with a single option (no secondary options) which is either a boolean or an object, as seen in the following type:

```typescript
boolean | {
    mode: DefaultOptionMode;
    fileExceptions?: string[];
    lineExceptions?: string[];
}
```

This type can easily be extended to add more properties to the object portion of that format ([which is done in the example `DefaultRule`](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/rules/file-name-starts-with/file-name-starts-with.rule.ts)), like so:

```typescript
import {DefaultRuleOptions} from 'stylelint-rule-creator';

type MyCustomRuleOptions = DefaultRuleOptions & {
    // note that all values must be either strings or numbers because this will come straight from a stylelint config file
    anotherProperty: string;
};
```

If more flexibility is needed, use the simpler `createRule` which is explained in a later section.

Create a `DefaultRule` like so:

```typescript
import {DefaultRuleOptions, DefaultOptionMode, createDefaultRule} from 'stylelint-rule-creator';

const messages = {
    exampleMessage(input: string) {
        return `Example message with ${input}`;
    },
};

export const exampleDefaultRule = createDefaultRule<typeof messages, DefaultRuleOptions>({
    ruleName: 'my-plugin-name/my-rule-name',
    messages,
    defaultOptions: {
        mode: DefaultOptionMode.REQUIRE,
    },
    ruleCallback: (report, messages, {ruleOptions, root}) => {
        // whatever your rule does here

        // example:
        root.walkDecls((decl) => {
            if (decl.prop === 'visibility') {
                report({
                    message: messages.myMessageName(decl.value),
                    node: decl,
                    word: decl.value,
                });
            }
        });
    },
});
```

For more info, see the [source code here](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/default-rule.ts), which is heavily documented.

[See this file for an example using `createDefaultRule`.](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/rules/file-name-starts-with/file-name-starts-with.rule.ts)

### `DefaultRule` Testing

Testing a `DefaultRule` (the output of `createDefaultRule`) is very simple and requires very little boilerplate.

```typescript
import {testDefaultRule, DefaultOptionMode} from 'stylelint-rule-creator';

testDefaultRule({
    rule: yourRuleHere,
    pluginPath: 'path/to/plugin/file.js',
    tests: [
        {
            ruleOptions: {
                mode: DefaultOptionMode.REQUIRE,
            },
            description: 'top level description optional',
            accept: [
                {
                    code: 'whatever code here',
                    description:
                        'lower level description optional but should exist if top level description does not',
                },
            ],
            reject: [
                {
                    code: 'whatever code here',
                    description:
                        'lower level description optional but should exist if top level description does not',
                    message:
                        'message with rule name must be supplied for rejections (plugin-name/rule-name)',
                },
            ],
        },
        //... more tests
    ],
});
```

For more info, see the [default rule test source code here](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/default-rule-test.ts), which is heavily documented.

[See this file for example `DefaultRule` tests.](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/rules/file-name-starts-with/file-name-starts-with.test.ts)

## `createRule` Usage

This creates a basic `Rule` which can be directly exported to stylelint as a plugin just as the above `DefaultRule` can be. `Rule` is much simpler than `DefaultRule` and doesn't provide as many typing or testing benefits. It, however, makes less requirements on your input rule options. For example, this allows primary and secondary options (whereas `DefaultRule` requires all information to be in a singular primary option).

To create a `Rule`, use the following:

```typescript
import {createRule} from 'stylelint-rule-creator';

export const myExampleRule = createRule({
    ruleName: 'my-plugin-name/my-rule-name',
    messages: {
        myMessageName: (messageInput: string) => `My message example: ${messageInput}`,
    },
    ruleCallback: (report, messages, {primaryOption, root}) => {
        // whatever your rule does here

        // example:
        if (!primaryOption) {
            // this needs to be checked because the basic createRule function doesn't do any option checking for us
            return;
        }

        root.walkDecls((decl) => {
            if (decl.prop === 'visibility') {
                report({
                    message: messages.myMessageName(decl.value),
                    node: decl,
                    word: decl.value,
                });
            }
        });
    },
});
```

[See this file for an example using `createRule`.](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/rules/visibility/visibility.rule.ts)

### `Rule` Testing

When not using `createDefaultRule`, testing is more verbose and requires more boilerplate.

This package exports the functionality of the [`stylelint-jest-rule-tester` package](https://www.npmjs.com/package/stylelint-jest-rule-tester) to be used for these testing purposes.

#### Create testRule

In a central file somewhere, create your `testRule` function by calling `getTestRuleFunction` with a reference to your plugin's main file:

```typescript
import {getTestRuleFunction} from 'stylelint-rule-creator';

export const testRule = getTestRuleFunction({
    // a plugin must be supplied so that stylelint can find the rule(s) you want to test
    linterOptions: {config: {plugins: ['./dist/index.js']}},
});
```

In this example, `dist/index.js` should be the file which is exporting your rules as its default export. See [this plugin test file](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/test-plugin.ts) as an example of this.

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

[See this file for example `Rule` tests.](https://github.com/electrovir/stylelint-rule-creator/blob/master/src/test/rules/visibility/visibility.test.ts)
