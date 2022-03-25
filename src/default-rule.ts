import {toPosixPath} from 'augment-vir/dist/node-only';
import globToRegExp from 'glob-to-regexp';
import {Node, Root} from 'postcss';
import {PostcssResult} from 'stylelint';
import {BaseMessagesType, createRule, ReportCallback, Rule, RuleContext} from './rule';

/**
 * The required base options type for a DefaultRule. An object matching this type is what must be
 * provided in the stylelint config for one of these rules.
 */
export type DefaultRuleOptions = {
    mode: DefaultOptionMode;
    /**
     * Strings that will get converted into RegExps using glob syntax. Any files that match these
     * will be automatically ignored.
     */
    fileExceptions?: string[] | undefined;
    /**
     * Strings that will get converted into RegExps using glob syntax. Rules will have to manually
     * check each line against these using doesMatchLineExceptions.
     */
    lineExceptions?: string[] | undefined;
};

/**
 * When the mod is off, no other properties are needed. This is used in place of even types that
 * extend DefaultRuleOptions so that the sub type properties can be ignored.
 */
export type DisabledDefaultRuleOptions = {
    mode: DefaultOptionMode.OFF;
};

/** Operating modes for a DefaultRule. */
export enum DefaultOptionMode {
    /** Turn the rule completely off. */
    OFF = 'off',
    /** Require the rule to be matched. */
    REQUIRE = 'require',
    /** Require the rule to NOT be matched. */
    BLOCK = 'block',
}

export type DefaultRuleMessagesType = typeof invalidOptionsMessages;

/**
 * A default rule that can be directly exported to stylelint as a plugin, is extremely easy to test,
 * and has with opinions and extra type checking for rule options.
 */
export type DefaultRule<
    OptionsType extends DefaultRuleOptions,
    MessagesType extends DefaultRuleMessagesType,
> = Rule<MessagesType> & {defaultOptions: OptionsType};

export type ParsedException = RegExp | Error;

export type ParsedExceptions = {
    parsedFileExceptions: ParsedException[];
    parsedLineExceptions: ParsedException[];
};

/**
 * Checks if the given variable can be considered a valid implementation of the DefaultRuleOptions
 * type. This is a type guard function as well for TypeScript purposes.
 *
 * @param input The variable to test. Can be anything, though if it's not a valid DefaultRuleOptions
 *   object then it returns false as soon as possible.
 * @returns True if valid, false if not.
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
 * Given the default exceptionRegExps object from DefaultRuleExecutionInfo, figure out if the given
 * node matches any of the line exceptions.
 *
 * @param node The postcss node to check, likely coming straight out of a root.walk*
 * @param exceptionRegExps The ExceptionRegExps obtained from the ruleCallback execution info
 * @returns True if any exceptions match the node, false otherwise
 */
export function doesMatchLineExceptions(node: Node, exceptionRegExps: ExceptionRegExps): boolean {
    return exceptionRegExps.lineExceptions.some((exception) => node.toString().match(exception));
}

/**
 * Checks if the given variable is a valid object for the fileExceptions and lineExceptions
 * properties of the DefaultRuleOptions type. In this case, valid means that they are either
 * undefined (which is considered valid because it is possible to not even pass in anything for
 * these properties) or an array of strings.
 *
 * @param input The variable to check as a valid match for fileExceptions and lineExceptions
 * @returns True if input is an array of strings or undefined, otherwise false
 */
export function isValidDefaultOptionsExceptions(input?: any): input is string[] | undefined {
    if (!input) {
        return true;
    }
    if (!Array.isArray(input)) {
        return false;
    }
    if (input.some((value) => typeof value !== 'string')) {
        return false;
    }
    return true;
}

/**
 * Checks if the given variable is a valid member of the DefaultOptionMode enum.
 *
 * @param input The variable to check
 * @returns True if input is a valid member of DefaultOptionMode, false otherwise
 */
export function isDefaultOptionMode(input?: any): input is DefaultOptionMode {
    if (typeof input !== 'string') {
        return false;
    }
    return Object.values(DefaultOptionMode).includes(input as any);
}

const invalidOptionsMessages = {
    invalidOptions(option: any) {
        return `Invalid options object:\n${option ? JSON.stringify(option, null, 4) : option}`;
    },
};

function shouldBeExempt(input?: string, exceptions?: (RegExp | Error)[]): boolean {
    if (!exceptions || !input) {
        return false;
    }
    return exceptions.some((regExp) => {
        if (regExp instanceof Error) {
            return false;
        }
        return input.match(regExp);
    });
}

function createExceptionGlobRegExpArray(exceptions?: any, globstar = true): (RegExp | Error)[] {
    // verify in case bad input
    if (!exceptions || !Array.isArray(exceptions)) {
        return [];
    }

    return exceptions.map((exception) => {
        try {
            return globToRegExp(exception, {globstar, extended: true});
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
        result: PostcssResult;
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
    } else if (
        inputs.result.opts?.from &&
        (shouldBeExempt(inputs.result.opts?.from, inputs.exceptionRegExps) ||
            shouldBeExempt(toPosixPath(inputs.result.opts?.from), inputs.exceptionRegExps))
    ) {
        return false;
    }

    return true;
}

/** RegExps parsed from the user's string exceptions */
export type ExceptionRegExps = {
    /** Exceptions for individual lines */
    lineExceptions: RegExp[];
    /**
     * Exceptions for whole file names and paths. This is matched against automatically already by
     * createDefaultRule but the information is passed here just in case the rule walk wants it for
     * some reason.
     */
    fileNameExceptions: RegExp[];
};

/**
 * This is the object that gets passed into ruleCallback with all the current rule execution
 * information, as seen below. In particular, this includes the rule's input options and exception
 * regular expressions.
 */
export type DefaultRuleExecutionInfo<RuleOptions extends DefaultRuleOptions = DefaultRuleOptions> =
    {
        /** The options passed */
        ruleOptions: RuleOptions;
        /** Includes basic other context, importantly the fix property. */
        context: RuleContext;
        /** The root node. Use this to walk the file. */
        root: Root;
        /** Result output from postcss. The file name can be reached here through result.opts?.from */
        result: PostcssResult;
        /** RegExps parsed from the user's string exceptions */
        exceptionRegExps: ExceptionRegExps;
    };

/**
 * This is ultimately the function that is used to create a rule.
 *
 * @param reportCallback Example Usage: reportCallback({ message: messageCallbacks.myMessage(data1,
 *   data2), node: declaration, word: declaration.value, })
 *
 *   This function should be used instead of stylelint.utils.report as it wraps everything up nicely
 *   with the information already given, reducing the need to duplicate code.
 * @param messageCallbacks Example usage: messageCallbacks.myMessage(data1, data2)
 *
 *   This callback is intended for use in reporting violations with reportCallback, as demonstrated in
 *   the reportCallback example above similar to reportCallback, this callback object should be
 *   preferred over stylelint.utils.ruleMessages because it includes information that has already
 *   been provided.
 * @param executionInfo This includes all the information needed for a rule to run.
 *
 *   Example usage: const {ruleOptions, context, root} = executionInfo;
 *
 *   See the DefaultRuleExecutionInfo type for more information.
 */
export type DefaultRuleCallback<
    MessagesType extends BaseMessagesType,
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions,
> = (
    reportCallback: ReportCallback,
    messageCallbacks: MessagesType & DefaultRuleMessagesType,
    executionInfo: DefaultRuleExecutionInfo<RuleOptions>,
) => void | PromiseLike<void>;

function optionsIsDisabled<RuleOptions extends DefaultRuleOptions>(
    input?: DisabledDefaultRuleOptions | RuleOptions,
): input is DisabledDefaultRuleOptions {
    if (
        input &&
        !input.hasOwnProperty('fileExceptions') &&
        !input.hasOwnProperty('lineExceptions')
    ) {
        return true;
    } else {
        return false;
    }
}

/**
 * Creates a self contained rule which is directly given to stylelint as the plugin export.
 *
 * @param ruleName The rule name string. Include the plugin prefix. Examples: plugin-name/rule-name
 *   skeleton/visibility order/properties-order
 * @param messages An object with message callbacks used to generate violation messages which are
 *   reported back to the user. This is also used for testing. Do not include the rule name suffix,
 *   it is added automatically. Example: { noUseVisibility: () => "Don't use the visibility
 *   property." invalidVisibilityValue: (value) => `Don't use visibility with value "${value}"` }
 * @param defaultOptions An object which will be passed to ruleCallback as the user's supplied
 *   options if the user actually supplied just the boolean value of true.
 * @param ruleCallback The actual rule. This is what stylelint will call when linting occurs with
 *   this rule loaded and enabled. This is a simplified and flattened version of stylelint's default
 *   "Plugin" type in order to reduce boilerplate and code duplication.
 */
export function createDefaultRule<
    /**
     * MessagesType
     *
     * The type for the messages type object. This should be passed in as the following: typeof messages
     *
     * The messages variable should be the object of message callbacks, like the following: const
     * messages = {messageNameHere(input: string) {return `message: ${input}`;}}
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
    RuleOptions extends DefaultRuleOptions = DefaultRuleOptions,
>(defaultRuleInputs: {
    ruleName: string;
    messages: MessagesType;
    defaultOptions: RuleOptions;
    ruleCallback: DefaultRuleCallback<
        MessagesType,
        /**
         * Partial is used here because the user might not input all the fields needed for the
         * subtype of DefaultRuleOptions (RuleOptions, which extends DefaultRuleOptions) and we
         * can't validate that subtype here because we can't know all the properties. We CAN,
         * however, and do validate that DefaultRuleOptions is at least a valid instance of
         * DefaultRuleOptions.
         */
        Partial<RuleOptions> & DefaultRuleOptions
    >;
}): DefaultRule<RuleOptions, MessagesType & DefaultRuleMessagesType> {
    const messages = {...defaultRuleInputs.messages, ...invalidOptionsMessages};

    const rule = createRule<
        typeof messages,
        ParsedExceptions,
        RuleOptions | boolean | DisabledDefaultRuleOptions,
        undefined
    >({
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
                    lineExceptions:
                        ruleExecutionInfo.optionsCallbackResult.parsedLineExceptions.filter(
                            (exception): exception is RegExp => exception instanceof RegExp,
                        ),
                    fileNameExceptions:
                        ruleExecutionInfo.optionsCallbackResult.parsedFileExceptions.filter(
                            (exception): exception is RegExp => exception instanceof RegExp,
                        ),
                },
            };

            return defaultRuleInputs.ruleCallback(report, messages, defaultRuleExecutionInfo);
        },
        optionsCallback(options) {
            if (typeof options === 'boolean' || optionsIsDisabled(options)) {
                return {
                    parsedFileExceptions: [],
                    parsedLineExceptions: [],
                };
            }

            return {
                parsedFileExceptions: createExceptionGlobRegExpArray(options?.fileExceptions),
                parsedLineExceptions: createExceptionGlobRegExpArray(
                    options?.lineExceptions,
                    false,
                ),
            };
        },
    });

    return {
        ...rule,
        defaultOptions: defaultRuleInputs.defaultOptions,
    };
}
