import {
    DefaultOptionMode,
    DefaultRuleMessagesType,
    DefaultRuleOptions,
    DefaultRule,
} from './default-rule';
import {Rule} from './rule';
import {TestCase, TestRuleInput, testRule} from 'stylelint-jest-rule-tester';

/**
 * An actual test that is used in TestDefaultRuleInput. This is mostly the original TestRuleInput
 * from the stylelint-jest-rule-tester plugin
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
    RuleOptions extends DefaultRuleOptions
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
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions
>(
    rule: Rule<MessagesType>,
    ruleOptions: Partial<RuleOptions> | boolean,
    tests: TestCase[],
): DefaultRuleTest<RuleOptions> {
    return {
        ruleOptions: [ruleOptions as any],
        description: 'everything should be rejected when invalid options are given',
        accept: [],
        reject: tests.map(test => {
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
        ruleOptions: [ruleOptions],
        description: 'valid rule options inputs should be accepted',
        reject: [],
        accept: [{code: ``}],
    };
}

function createDefaultRuleTests<
    MessagesType extends DefaultRuleMessagesType,
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions
>(
    rule: Rule<MessagesType>,
    testInputs: DefaultRuleTest<RuleOptions>[],
): DefaultRuleTest<RuleOptions>[] {
    const invalidOptionsTests: DefaultRuleTest<RuleOptions>[] = ([
        {},
        {mode: 'blah blah'},
        {mode: 5},
        {mode: DefaultOptionMode.BLOCK, fileExceptions: true},
        {mode: DefaultOptionMode.BLOCK, fileExceptions: [true]},
        {mode: DefaultOptionMode.REQUIRE, fileExceptions: [true]},
        {mode: DefaultOptionMode.REQUIRE, fileExceptions: [{}]},
    ] as Partial<RuleOptions>[]).map(ruleOptions =>
        createInvalidOptionsTest(
            rule,
            ruleOptions,
            testInputs.reduce(
                (accum, testInput) => accum.concat(testInput.accept),
                [] as TestCase[],
            ),
        ),
    );

    const validOptionsTests: DefaultRuleTest<RuleOptions>[] = [true, false].map(ruleOptions =>
        createValidOptionsTest<RuleOptions>(ruleOptions),
    );

    return [...invalidOptionsTests, ...validOptionsTests];
}

function getExceptionTestDescription(originalDescription?: string): string {
    return `Rejection test${
        originalDescription ? ` "${originalDescription}"` : ''
    } should pass when `;
}

type Variation = {
    fileName?: string;
    ruleOptions: Partial<DefaultRuleOptions>;
    // this is appended to the output of the getExceptionTestDescription function
    descriptionSuffix: string;
};

/**
 * Array of test variations that will be appleid to all reject test cases to verify that they are
 * accepted when ignored due to rule exceptions.
 *
 */
const ExemptTestVariations: Variation[] = [
    {
        ruleOptions: {mode: DefaultOptionMode.OFF},
        descriptionSuffix: 'rule is turned off',
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
        ruleOptions: {fileExceptions: ['/**/a.less', '/*b.less']},
        descriptionSuffix: 'inside exception file with multiple files',
    },
];

/**
 * Creates a list of "accept" tests which are copied from the input's reject tests but with filename
 * linter options and rule option exceptions so that they should pass.
 *
 * These tests verify that the exception logic is funtioning for the given tests.
 *
 * @param testInput    the test input originally given in the rule's test. This is used to generate
 *                     the exempt tests.
 */
function createIgnoredTestVariations<RuleOptions extends DefaultRuleOptions = DefaultRuleOptions>(
    testInput: DefaultRuleTest<RuleOptions>,
): DefaultRuleTest<RuleOptions>[] {
    if (!testInput.reject.length) {
        return [];
    }

    return ExemptTestVariations.map(variation => {
        const inputOptions: RuleOptions =
            typeof testInput.ruleOptions[0] === 'object'
                ? testInput.ruleOptions[0]
                : ({} as RuleOptions);
        const input: DefaultRuleTest<RuleOptions> = {
            ...testInput,
            accept: [],
            reject: [],
            ruleOptions: [
                {
                    ...inputOptions,
                    ...variation.ruleOptions,
                },
            ],
            linterOptions: {
                ...testInput.ruleOptions,
                codeFilename: variation.fileName,
            },
            description: testInput.description?.concat(variation.descriptionSuffix),
        };

        input.accept = input.accept.map(test => {
            return {
                ...test,
                description: test.description?.concat(variation.descriptionSuffix),
            };
        });

        return input;
    });
}

function createIgnoredRejectionTests<RuleOptions extends DefaultRuleOptions>(
    tests: DefaultRuleTest<RuleOptions>[],
) {
    const ignoredRejections: DefaultRuleTest<RuleOptions>[] = [];

    tests.forEach(test => {
        const allowedRejectionsTestInput: DefaultRuleTest<RuleOptions> = {
            ...test,
            linterOptions: {
                ...test.linterOptions,
            },
            // all of these tests are going to pass
            reject: [],
            // this will get filled up later
            accept: [],
            description: getExceptionTestDescription(test.description),
        };

        test.reject.forEach(rejectionTestCase => {
            const allowedBecauseFileIgnoredRejection: TestCase = {
                code: rejectionTestCase.code,
            };

            if (rejectionTestCase.description) {
                allowedBecauseFileIgnoredRejection.description = getExceptionTestDescription(
                    rejectionTestCase.description,
                );
            }

            allowedRejectionsTestInput.accept.push(allowedBecauseFileIgnoredRejection);
        });

        ignoredRejections.push(...createIgnoredTestVariations(allowedRejectionsTestInput));
    });

    return ignoredRejections;
}

export function testDefaultRule<
    MessagesType extends DefaultRuleMessagesType,
    RuleOptions extends DefaultRuleOptions
>(inputs: TestDefaultRuleInput<MessagesType, RuleOptions>) {
    const paths: string[] = [];

    if (inputs.pluginPath) {
        paths.push(inputs.pluginPath);
    }

    if (inputs.pluginPaths) {
        paths.push(...inputs.pluginPaths);
    }

    const tests: DefaultRuleTest<RuleOptions>[] = createDefaultRuleTests<MessagesType, RuleOptions>(
        inputs.rule,
        inputs.tests,
    ).concat(createIgnoredRejectionTests(inputs.tests), inputs.tests);

    tests.forEach(test =>
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
