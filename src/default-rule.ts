import * as globToRegExp from 'glob-to-regexp';
import {Result} from 'postcss';
import {Node} from 'postcss';
import {
    Rule,
    ReportCallback,
    BaseMessagesType,
    RuleCallback,
    createRule,
    TestRuleInput,
    testRule,
    TestCase,
} from '.';

export type DefaultRuleOptions = {
    mode: DefaultOptionMode;
    fileExceptions?: string[];
    lineExceptions?: string[];
};

export enum DefaultOptionMode {
    OFF = 'off',
    REQUIRE = 'require',
    BLOCK = 'block',
}

const invalidOptionsMessages = {
    invalidOptions(option: any) {
        return `Invalid options object:\n${JSON.stringify(option, null, 4)}`;
    },
};

export function isValidSerializedDefaultOptionsObject(input: any): input is DefaultRuleOptions {
    if (typeof input !== 'object') {
        return false;
    }
    // assumption for type checking below
    const validatingInput = input as DefaultRuleOptions;

    if (!isDefaultOptionMode(validatingInput.mode)) {
        return false;
    }
    if (!isValidSerializedDefaultExceptions(validatingInput.fileExceptions)) {
        return false;
    }
    if (!isValidSerializedDefaultExceptions(validatingInput.lineExceptions)) {
        return false;
    }
    return true;
}

export function isValidSerializedDefaultExceptions(
    exceptions?: any,
): exceptions is string[] | undefined {
    if (!exceptions) {
        return true;
    }
    if (!Array.isArray(exceptions)) {
        return false;
    }
    if (exceptions.some(value => typeof value !== 'string')) {
        return false;
    }
    return true;
}

function shouldBeExempt(input?: string, exceptions?: (RegExp | Error)[]): boolean {
    if (!exceptions || !input) {
        return false;
    }
    return exceptions.some(regExp => {
        if (regExp instanceof Error) {
            return false;
        }
        return input.match(regExp);
    });
}

function createExceptionRegExpArray(exceptions?: any): (RegExp | Error)[] {
    // verify in case bad input
    if (!exceptions || !Array.isArray(exceptions)) {
        return [];
    }

    return exceptions.map(exception => {
        try {
            return globToRegExp(exception, {globstar: true});
        } catch (error) {
            if (error instanceof TypeError) {
                // this indicates to later processes that an error occurred
                return error;
            } else {
                throw error;
            }
        }
    });
}

export function isDefaultOptionMode(input: string): input is DefaultOptionMode {
    return Object.values(DefaultOptionMode).includes(input as any);
}

function shouldRunDefaultRule(
    ruleOptions: DefaultRuleOptions | undefined,
    messages: DefaultRuleMessagesType,
    inputs: {
        result: Result;
        root: Node;
        report: ReportCallback;
        exceptionRegExps: (RegExp | Error)[] | undefined;
    },
): ruleOptions is DefaultRuleOptions {
    if (!ruleOptions) {
        return false;
    } else if (ruleOptions.mode === DefaultOptionMode.OFF) {
        return false;
    } else if (!isValidSerializedDefaultOptionsObject(ruleOptions)) {
        inputs.report({
            message: messages.invalidOptions(ruleOptions),
            node: inputs.root,
        });
        return false;
    } else if (shouldBeExempt(inputs.result.opts?.from, inputs.exceptionRegExps)) {
        return false;
    }

    return true;
}

export type DefaultRuleMessagesType = typeof invalidOptionsMessages;

export type DefaultRule<OptionsType, MessagesType extends DefaultRuleMessagesType> = Rule<
    MessagesType
> & {defaultOptions: OptionsType};

export type ParsedExceptions = {
    parsedFileExceptions: (RegExp | Error)[];
    parsedLineExceptions: (RegExp | Error)[];
};

export function createDefaultRule<
    /**
     * MessagesType
     *
     * The type for the messages type object. This should be passed in as the following:
     * typeof messages
     *
     * The messages variable should be the object of message callbacks, like the following:
     * const messages = {messageNameHere(input: string) {return `message: ${input}`;}}
     *
     * This way, the MessagesType becomes automatically limited ONLY to the object as instantiated.
     * Do NOT give the messages const the type BaseMessagesType, this will destroy its strictness.
     */
    MessagesType extends BaseMessagesType,
    /**
     * SerializedRuleOptions
     *
     * The type for options as they should be typed into the stylelintrc file. This should be
     * serializable or, in other words, pure JSON. Thus, objects such as regular expressions (which
     * DefaultRuleOptions includes) should be represented as strings.
     *
     * This type later gets deserialized so that the regular expressions represented in
     * DefaultRuleOptions as strings become actual instances of RegExp.
     */
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions
>(defaultRuleInputs: {
    ruleName: string;
    messages: MessagesType;
    defaultOptions: RuleOptions;
    ruleCallback: RuleCallback<
        RuleOptions,
        undefined,
        MessagesType & DefaultRuleMessagesType,
        ParsedExceptions
    >;
}): DefaultRule<RuleOptions, MessagesType & DefaultRuleMessagesType> {
    const messages = {...defaultRuleInputs.messages, ...invalidOptionsMessages};

    const rule = createRule<typeof messages, ParsedExceptions, RuleOptions | boolean, undefined>({
        ruleName: defaultRuleInputs.ruleName,
        messages,
        ruleCallback(report, messages, ruleCallbackInputs) {
            const options = ruleCallbackInputs.primaryOption;

            if (
                // check if options is just plain false or undefined (indicating it should not run)
                !options ||
                // check if options is an object and fails the should run check
                (typeof options !== 'boolean' &&
                    !shouldRunDefaultRule(options, messages, {
                        ...ruleCallbackInputs,
                        report,
                        exceptionRegExps:
                            ruleCallbackInputs.optionsCallbackResult.parsedFileExceptions,
                    }))
            ) {
                return;
            }

            const primaryOption: RuleOptions =
                typeof options === 'boolean' ? defaultRuleInputs.defaultOptions : options;

            return defaultRuleInputs.ruleCallback(report, messages, {
                ...ruleCallbackInputs,
                primaryOption,
            });
        },
        optionsCallback(options) {
            if (typeof options === 'boolean') {
                return {
                    parsedFileExceptions: [],
                    parsedLineExceptions: [],
                };
            }

            return {
                parsedFileExceptions: createExceptionRegExpArray(options?.fileExceptions),
                parsedLineExceptions: createExceptionRegExpArray(options?.lineExceptions),
            };
        },
    });

    return {
        ...rule,
        defaultOptions: defaultRuleInputs.defaultOptions,
    };
}

function createInvalidOptionsTest<
    MessagesType extends DefaultRuleMessagesType,
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions
>(
    rule: Rule<MessagesType>,
    ruleOptions: Partial<RuleOptions> | boolean,
    tests: TestCase[],
): DefaultTestRuleInput<RuleOptions> {
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
): DefaultTestRuleInput<RuleOptions> {
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
    testInputs: DefaultTestRuleInput<RuleOptions>[],
): DefaultTestRuleInput<RuleOptions>[] {
    const invalidOptionsTests: DefaultTestRuleInput<RuleOptions>[] = ([
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

    const validOptionsTests: DefaultTestRuleInput<RuleOptions>[] = [true, false].map(ruleOptions =>
        createValidOptionsTest<RuleOptions>(ruleOptions),
    );

    return [...invalidOptionsTests, ...validOptionsTests];
}

export type DefaultTestRuleInput<RuleOptions extends DefaultRuleOptions> = Omit<
    TestRuleInput<RuleOptions | boolean>,
    'ruleName'
>;

export type TestRulesInput<
    MessagesType extends DefaultRuleMessagesType,
    RuleOptions extends DefaultRuleOptions
> =
    | {
          rule: DefaultRule<RuleOptions, MessagesType>;
          tests: DefaultTestRuleInput<RuleOptions>[];
          pluginPath: string;
          pluginPaths?: string[];
      }
    | {
          rule: DefaultRule<RuleOptions, MessagesType>;
          tests: DefaultTestRuleInput<RuleOptions>[];
          pluginPath?: string;
          pluginPaths: string[];
      };

function getExceptionTestDescription(originalDescription?: string): string {
    return `Rejection test${
        originalDescription ? ` "${originalDescription}"` : ''
    } should pass when `;
}

/**
 * Array of test variations that will be appleid to all reject test cases to verify that they are
 * accepted when ignored due to rule exceptions.
 *
 */
const ExemptTestVariations: {
    fileName?: string;
    ruleOptions: Partial<DefaultRuleOptions>;
    // this is appended to the output of the getExceptionTestDescription function
    descriptionSuffix: string;
}[] = [
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
    testInput: DefaultTestRuleInput<RuleOptions>,
): DefaultTestRuleInput<RuleOptions>[] {
    if (!testInput.reject.length) {
        return [];
    }

    return ExemptTestVariations.map(variation => {
        const inputOptions: RuleOptions =
            typeof testInput.ruleOptions[0] === 'object'
                ? testInput.ruleOptions[0]
                : ({} as RuleOptions);
        const input: DefaultTestRuleInput<RuleOptions> = {
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
    tests: DefaultTestRuleInput<RuleOptions>[],
) {
    const ignoredRejections: DefaultTestRuleInput<RuleOptions>[] = [];

    tests.forEach(test => {
        const allowedRejectionsTestInput: DefaultTestRuleInput<RuleOptions> = {
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
>(inputs: TestRulesInput<MessagesType, RuleOptions>) {
    const paths: string[] = [];

    if (inputs.pluginPath) {
        paths.push(inputs.pluginPath);
    }

    if (inputs.pluginPaths) {
        paths.push(...inputs.pluginPaths);
    }

    const tests: DefaultTestRuleInput<RuleOptions>[] = createDefaultRuleTests<
        MessagesType,
        RuleOptions
    >(inputs.rule, inputs.tests).concat(createIgnoredRejectionTests(inputs.tests), inputs.tests);

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
