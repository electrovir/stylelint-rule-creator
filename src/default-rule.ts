import * as globToRegExp from 'glob-to-regexp';
import {Result, Node, Root} from 'postcss';
import {Rule, ReportCallback, BaseMessagesType, createRule, RuleContext} from './rule';

/**
 * The required base options type for a DefaultRule.
 * An object matching this type is what must be provided in the stylelint config for one of these rules.
 */
export type DefaultRuleOptions = {
    mode: DefaultOptionMode;
    fileExceptions?: string[];
    lineExceptions?: string[];
};

/**
 * Operating modes for a DefaultRule.
 */
export enum DefaultOptionMode {
    /**
     * Turn the rule completely off.
     */
    OFF = 'off',
    /**
     * Require the rule to be matched.
     */
    REQUIRE = 'require',
    /**
     * Require the rule to NOT be matched.
     */
    BLOCK = 'block',
}

export type DefaultRuleMessagesType = typeof invalidOptionsMessages;

/**
 * A default rule that can be directly exported to stylelint as a plugin, is extremely easy to test,
 * and has with opinions and extra type checking for rule options.
 */
export type DefaultRule<OptionsType, MessagesType extends DefaultRuleMessagesType> = Rule<
    MessagesType
> & {defaultOptions: OptionsType};

export type ParsedException = RegExp | Error;

export type ParsedExceptions = {
    parsedFileExceptions: ParsedException[];
    parsedLineExceptions: ParsedException[];
};

/**
 * Checks if the given variable can be considered a valid implementation of the DefaultRuleOptions
 * type. This is a type guard function as well for TypeScript purposes.
 *
 * @param input   the variable to test. Can be anything, though if it's not a valid DefaultRuleOptions
 *                object then it returns false as soon as possible.
 *
 * @returns       true if valid, false if not.
 */
export function isValidDefaultOptionsObject(input?: any): input is DefaultRuleOptions {
    if (typeof input !== 'object') {
        return false;
    }
    // assumption for type checking below
    const validatingInput = input as DefaultRuleOptions;

    if (!isDefaultOptionMode(validatingInput.mode)) {
        return false;
    }
    if (!isValidDefaultOptionsExceptions(validatingInput.fileExceptions)) {
        return false;
    }
    if (!isValidDefaultOptionsExceptions(validatingInput.lineExceptions)) {
        return false;
    }
    return true;
}

/**
 * Checks if the given variable is a valid object for the fileExceptions and lineExceptions
 * properties of the DefaultRuleOptions type.
 * In this case, valid means that they are either undefined (which is considered valid because it
 * is possible to not even pass in anything for these properties) or an array of strings.
 *
 * @param input         the variable to check as a valid match for fileExceptions and lineExceptions
 * @returns             true if input is an array of strings or undefined, otherwise false
 */
export function isValidDefaultOptionsExceptions(input?: any): input is string[] | undefined {
    if (!input) {
        return true;
    }
    if (!Array.isArray(input)) {
        return false;
    }
    if (input.some(value => typeof value !== 'string')) {
        return false;
    }
    return true;
}

/**
 * Checks if the given variable is a valid member of the DefaultOptionMode enum.
 *
 * @param input      the variable to check
 * @returns          true if input is a valid member of DefaultOptionMode, false otherwise
 */
export function isDefaultOptionMode(input?: any): input is DefaultOptionMode {
    if (typeof input !== 'string') {
        return false;
    }
    return Object.values(DefaultOptionMode).includes(input as any);
}

const invalidOptionsMessages = {
    invalidOptions(option: any) {
        return `Invalid options object:\n${JSON.stringify(option, null, 4)}`;
    },
};

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
    } else if (!isValidDefaultOptionsObject(ruleOptions)) {
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

/**
 * This is the object that gets passed into ruleCallback with all the current rule execution
 * information, as seen below. In particular, this includes the rule's input options and exception
 * regular expressions.
 */
export type DefaultRuleExecutionInfo<
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions
> = {
    /**
     * The options passed
     */
    ruleOptions: RuleOptions;
    /**
     * Includes basic other context, importantly the fix property.
     */
    context: RuleContext;
    /**
     * The root node. Use this to walk the file.
     */
    root: Root;
    /**
     * Result output from postcss. The file name can be reached here through result.opts?.from
     */
    result: Result;
    /**
     * RegExps parsed from the user's string exceptions
     */
    exceptionRegExps: {
        /**
         * Exceptions for individual lines
         */
        lineExceptions: ParsedException[];
        /**
         * Exceptions for whole file names and paths.
         * This is matched against automatically already by createDefaultRule but the information is
         * passed here just in case the rule walk wants it for some reason.
         */
        fileNameExceptions: ParsedException[];
    };
};

/**
 * This is ultimately the function that is used to create a rule.
 *
 * @param reportCallback    Example Usage:
 *                          reportCallback({
 *                              message: messageCallbacks.myMessage(data1, data2),
 *                              node: declaration,
 *                              word: declaration.value,
 *                          })
 *
 *                          this function should be used instead of stylelint.utils.report as it
 *                          wraps everything up nicely with the information already given, reducing
 *                          the need to duplicate code.
 *
 * @param messageCallbacks  Example usage:
 *                          messageCallbacks.myMessage(data1, data2)
 *
 *                          this callback is intended for use in reporting violations with
 *                          reportCallback, as demonstrated in the reportCallback example above
 *                          similar to reportCallback, this callback object should be preferred over
 *                          stylelint.utils.ruleMessages because it includes information that has
 *                          already been provided.
 *
 * @param executionInfo     This includes all the information needed for a rule to run.
 *
 *                          Example usage:
 *                          const {ruleOptions, context, root} = executionInfo;
 *
 *                          See the DefaultRuleExecutionInfo type for more information.
 */
export type DefaultRuleCallback<
    MessagesType extends BaseMessagesType,
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions
> = (
    reportCallback: ReportCallback,
    messageCallbacks: MessagesType & DefaultRuleMessagesType,
    executionInfo: DefaultRuleExecutionInfo<RuleOptions>,
) => void | PromiseLike<void>;

/**
 * Creates a self contained rule which is directly given to stylelint as the plugin export.
 *
 * @param ruleName            the rule name string. Include the plugin prefix.
 *                            Examples:
 *                                plugin-name/rule-name
 *                                skeleton/visibility
 *                                order/properties-order
 *
 * @param messages            an object with message callbacks used to generate violation messages
 *                            which are reported back to the user. This is also used for testing.
 *                            Do not include the rule name suffix, it is added automatically.
 *                            Example:
 *                                {
 *                                    noUseVisibility: () => "Don't use the visibility property."
 *                                    invalidVisibilityValue: (value) =>
 *                                        `Don't use visibility with value "${value}"`
 *                                }
 *
 * @param defaultOptions      an object which will be passed to ruleCallback as the user's supplied
 *                            options if the user actually supplied just the boolean value of true.
 *
 * @param ruleCallback        the actual rule. This is what stylelint will call when linting
 *                            occurs with this rule loaded and enabled.
 *                            This is a simplified and flattened version of stylelint's default
 *                            "Plugin" type in order to reduce boilerplate and code duplication.
 */
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
    ruleCallback: DefaultRuleCallback<MessagesType, RuleOptions>;
}): DefaultRule<RuleOptions, MessagesType & DefaultRuleMessagesType> {
    const messages = {...defaultRuleInputs.messages, ...invalidOptionsMessages};

    const rule = createRule<typeof messages, ParsedExceptions, RuleOptions | boolean, undefined>({
        ruleName: defaultRuleInputs.ruleName,
        messages,
        ruleCallback(report, messages, ruleExecutionInfo) {
            const options = ruleExecutionInfo.primaryOption;

            if (
                // check if options is just plain false or undefined (indicating it should not run)
                !options ||
                // check if options is an object and fails the should run check
                (typeof options !== 'boolean' &&
                    !shouldRunDefaultRule(options, messages, {
                        ...ruleExecutionInfo,
                        report,
                        exceptionRegExps:
                            ruleExecutionInfo.optionsCallbackResult.parsedFileExceptions,
                    }))
            ) {
                return;
            }

            const ruleOptions: RuleOptions =
                typeof options === 'boolean' ? defaultRuleInputs.defaultOptions : options;

            const defaultRuleExecutionInfo: DefaultRuleExecutionInfo<RuleOptions> = {
                ruleOptions,
                root: ruleExecutionInfo.root,
                result: ruleExecutionInfo.result,
                context: ruleExecutionInfo.context,
                exceptionRegExps: {
                    lineExceptions: ruleExecutionInfo.optionsCallbackResult.parsedLineExceptions,
                    fileNameExceptions:
                        ruleExecutionInfo.optionsCallbackResult.parsedFileExceptions,
                },
            };

            return defaultRuleInputs.ruleCallback(report, messages, defaultRuleExecutionInfo);
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