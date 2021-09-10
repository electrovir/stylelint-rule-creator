import {LinterOptions} from 'stylelint';
import {TestCase, testRule, TestRuleInput} from 'stylelint-jest-rule-tester';
import {
    DefaultOptionMode,
    DefaultRule,
    DefaultRuleMessagesType,
    DefaultRuleOptions,
    DisabledDefaultRuleOptions,
} from './default-rule';
import {Rule} from './rule';

/**
 * An actual test that is used in TestDefaultRuleInput. This is just TestRuleInput from the
 * stylelint-jest-rule-tester plugin but without the ruleName property.
 */
export type DefaultRuleTest<RuleOptions extends DefaultRuleOptions> = Omit<
    TestRuleInput<RuleOptions | boolean>,
    'ruleName'
>;

/**
 * The input to testDefaultRule function which pulls out the need to redefine the rule name or
 * plugin path for every single test.
 */
export type TestDefaultRuleInput<
    MessagesType extends DefaultRuleMessagesType,
    RuleOptions extends DefaultRuleOptions,
> =
    | {
          rule: DefaultRule<RuleOptions, MessagesType>;
          tests: DefaultRuleTest<RuleOptions>[];
          // This must include either a single string pluginPath or...
          pluginPath: string;
          pluginPaths?: string[];
      }
    | {
          rule: DefaultRule<RuleOptions, MessagesType>;
          tests: DefaultRuleTest<RuleOptions>[];
          pluginPath?: string;
          // ... must include an array of pluginPaths.
          pluginPaths: string[];
      };

function createInvalidOptionsTest<
    MessagesType extends DefaultRuleMessagesType,
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions,
>(
    rule: Rule<MessagesType>,
    // this uses partial here because it will be merged with the original test's options
    ruleOptions: Partial<RuleOptions> | boolean,
    tests: TestCase[],
): DefaultRuleTest<RuleOptions> {
    return {
        ruleOptions: ruleOptions as RuleOptions | boolean,
        description: 'everything should be rejected when invalid options are given',
        accept: [],
        reject: tests.map((test) => {
            const invalidTest = {...test, message: rule.messages.invalidOptions(ruleOptions)};
            if (invalidTest.description) {
                invalidTest.description = `everything in "${invalidTest.description}" should be rejected when invalid options are given`;
            }
            return invalidTest;
        }),
    };
}

function createValidOptionsTest<RuleOptions extends DefaultRuleOptions = DefaultRuleOptions>(
    ruleOptions: RuleOptions | boolean,
): DefaultRuleTest<RuleOptions> {
    return {
        ruleOptions: ruleOptions,
        description: 'valid rule options inputs should be accepted',
        reject: [],
        accept: [{code: ``}],
    };
}

function createDefaultRuleTests<
    MessagesType extends DefaultRuleMessagesType,
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions,
>(
    rule: Readonly<Rule<MessagesType>>,
    testInputs: Readonly<DefaultRuleTest<RuleOptions>[]>,
): DefaultRuleTest<RuleOptions>[] {
    const invalidOptionsTests: DefaultRuleTest<RuleOptions>[] = (
        [
            {},
            {mode: 'blah blah'},
            {mode: 5},
            {mode: DefaultOptionMode.BLOCK, fileExceptions: true},
            {mode: DefaultOptionMode.BLOCK, fileExceptions: [true]},
            {mode: DefaultOptionMode.REQUIRE, fileExceptions: [true]},
            {mode: DefaultOptionMode.REQUIRE, fileExceptions: [{}]},
        ] as Partial<RuleOptions>[]
    ).map((ruleOptions) =>
        createInvalidOptionsTest(
            rule,
            ruleOptions,
            testInputs.reduce(
                (accum, testInput) => accum.concat(testInput.accept),
                [] as TestCase[],
            ),
        ),
    );

    const validOptionsTests: DefaultRuleTest<RuleOptions>[] = [true, false].map((ruleOptions) =>
        createValidOptionsTest<RuleOptions>(ruleOptions),
    );

    return [...invalidOptionsTests, ...validOptionsTests];
}

function getExceptionTestDescription(originalDescription: string, suffix: string): string {
    return `Rejection test${
        originalDescription ? ` "${originalDescription}"` : ''
    } should pass when ${suffix}`;
}

type Variation = {
    fileName?: string;
    ruleOptions: Partial<DefaultRuleOptions> | boolean;
    // this is appended to the output of the getExceptionTestDescription function
    descriptionSuffix: string;
};

/**
 * Array of test variations that will be applied to all reject test cases to verify that they are
 * accepted when ignored due to rule exceptions.
 */
const ExemptTestVariations: Variation[] = [
    {
        ruleOptions: {mode: DefaultOptionMode.OFF},
        descriptionSuffix: 'mode is off',
    },
    {
        ruleOptions: false,
        descriptionSuffix: 'rule is disabled',
    },
    {
        fileName: '/single-start-match.less',
        ruleOptions: {fileExceptions: ['/*.less']},
        descriptionSuffix: 'inside file matched by single star glob',
    },
    {
        fileName: '/double/star/match.less',
        ruleOptions: {fileExceptions: ['/**/*.less']},
        descriptionSuffix: 'inside file matched by double star glob',
    },
    {
        fileName: '/ab.less',
        ruleOptions: {fileExceptions: ['/**/qqq.less', '/*b.less']},
        descriptionSuffix: 'inside exception file with multiple files',
    },
];

/**
 * Creates a list of "accept" tests which are copied from the input's reject tests but with filename
 * linter options and rule option exceptions so that they should pass.
 *
 * These tests verify that the exception logic is functioning for the given tests.
 *
 * @param testInput The test input originally given in the rule's test. This is used to generate the
 *   exempt tests.
 */
function createIgnoredTestVariations<RuleOptions extends DefaultRuleOptions>(
    testInput: Readonly<DefaultRuleTest<RuleOptions | DisabledDefaultRuleOptions>>,
    rule: DefaultRule<RuleOptions, any>,
): DefaultRuleTest<RuleOptions | DisabledDefaultRuleOptions>[] {
    if (!testInput.reject.length) {
        return [];
    }

    return ExemptTestVariations.map((variation) => {
        const inputOptions: RuleOptions | DisabledDefaultRuleOptions | boolean =
            typeof testInput.ruleOptions === 'object'
                ? testInput.ruleOptions
                : testInput.ruleOptions
                ? rule.defaultOptions
                : {mode: DefaultOptionMode.OFF};
        const combinedRuleOptions: boolean | RuleOptions | DisabledDefaultRuleOptions =
            inputOptions.mode === DefaultOptionMode.OFF
                ? inputOptions
                : typeof variation.ruleOptions === 'object'
                ? {
                      ...inputOptions,
                      ...variation.ruleOptions,
                  }
                : variation.ruleOptions;

        const withFileName: Partial<Pick<LinterOptions, 'codeFilename'>> = variation.fileName
            ? {codeFilename: variation.fileName}
            : {};

        const withDescription: Partial<
            Pick<DefaultRuleTest<RuleOptions | DisabledDefaultRuleOptions>, 'description'>
        > = testInput.description
            ? {
                  description: getExceptionTestDescription(
                      testInput.description,
                      variation.descriptionSuffix,
                  ),
              }
            : {};

        const input: DefaultRuleTest<RuleOptions | DisabledDefaultRuleOptions> = {
            ...testInput,
            accept: [],
            reject: [],
            ruleOptions: combinedRuleOptions,
            linterOptions: {
                ...testInput.linterOptions,
                ...withFileName,
            },
            ...withDescription,
        };

        input.accept = testInput.reject.map((test) => {
            return {
                ...test,
                description: getExceptionTestDescription(
                    test.description || test.code,
                    variation.descriptionSuffix,
                ),
            };
        });

        return input;
    });
}

function createIgnoredRejectionTests<RuleOptions extends DefaultRuleOptions>(
    tests: Readonly<Readonly<DefaultRuleTest<RuleOptions | DisabledDefaultRuleOptions>>[]>,
    rule: DefaultRule<RuleOptions | DisabledDefaultRuleOptions, any>,
): DefaultRuleTest<RuleOptions | DisabledDefaultRuleOptions>[] {
    const ignoredRejections: DefaultRuleTest<RuleOptions | DisabledDefaultRuleOptions>[] = [];

    tests.forEach((test) => {
        const allowedRejectionsTestInput: DefaultRuleTest<
            RuleOptions | DisabledDefaultRuleOptions
        > = {
            ...test,
            linterOptions: {
                ...test.linterOptions,
            },
            // this will get filled up later
            accept: [],
        };

        ignoredRejections.push(...createIgnoredTestVariations(allowedRejectionsTestInput, rule));
    });

    return ignoredRejections;
}

/**
 * Used to test a Rule (but only a DefaultRule) with much less boilerplate than usual. In
 * particular, the rule name and plugin paths don't have to be repeated for every test, they only
 * need to be defined in one spot, at the top of the "inputs" object.
 *
 * See src/test/rules/file-name-starts-with.test.ts in this repo for an example of how to use this.
 *
 * @param inputs An object which contains all the needed information for the tests. See the
 *   documentation for the TestDefaultRuleInput type for more information on the expected properties
 *   for this type.
 */
export function testDefaultRule<
    MessagesType extends DefaultRuleMessagesType,
    RuleOptions extends DefaultRuleOptions,
>(
    // somehow only require Partial<RuleOptions> as input to the tests property of this
    inputs: Readonly<TestDefaultRuleInput<MessagesType, RuleOptions | DisabledDefaultRuleOptions>>,
): void {
    const paths: string[] = [];

    if (inputs.pluginPath) {
        paths.push(inputs.pluginPath);
    }

    if (inputs.pluginPaths) {
        paths.push(...inputs.pluginPaths);
    }

    // TODO: add line exception auto tests
    const tests: DefaultRuleTest<RuleOptions | DisabledDefaultRuleOptions>[] =
        createDefaultRuleTests<MessagesType, RuleOptions | DisabledDefaultRuleOptions>(
            inputs.rule,
            inputs.tests,
        ).concat(createIgnoredRejectionTests(inputs.tests, inputs.rule), inputs.tests);

    tests.forEach((test) =>
        testRule({
            ...test,
            ruleName: inputs.rule.ruleName,
            linterOptions: {
                ...test.linterOptions,
                config: {
                    // a plugin must be supplied so that stylelint can find the rule you want to test
                    // trying to use the configBasedir property in here instead of supplying a complete
                    // relative path to index.js does NOT work. The stylelint api doesn't seem to even
                    // read the configBasedir property.
                    plugins: paths,
                    // if the test input includes plugins, they will override the above plugins property
                    ...test.linterOptions?.config,
                },
            },
        }),
    );
}
