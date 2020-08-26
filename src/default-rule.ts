import * as globToRegExp from 'glob-to-regexp';
import {Result} from 'postcss';
import {Node} from 'postcss';
import {Rule, ReportCallback, BaseMessagesType, RuleCallback, createRule} from './rule';

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
