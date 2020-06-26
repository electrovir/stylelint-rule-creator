import {createPlugin, Plugin, utils} from 'stylelint';
import {Root, Result, Node} from 'postcss';

export {getTestRuleFunction} from 'stylelint-jest-rule-tester';

/**
 * A stylelint rule. This is what is exported to stylelint from custom plugins.
 * It is also used for easy testing of rules.
 */
export type Rule<MessagesType extends BaseMessagesType> = {
    ruleName: string;
    rule: Plugin;
    messages: MessagesType;
};

/**
 * Base, barely informative type for messages. This should generally not be used as a more
 * restrictive type (which extends this type) is preferred to ensure better type safety.
 */
export type BaseMessagesType = {
    [key: string]: (...args: any[]) => string;
};

/**
 * Violation data is that used as an argument to a ReportCallback function.
 *
 * This type is recreated mostly from the stylelint utils.report function argument type
 */
export type RuleViolation = {
    message: string;
    node: Node;
    index?: number;
    word?: string;
    line?: number;
};

/**
 * A function that is called in order to report a stylelint rule violation
 */
export type ReportCallback = (violation: RuleViolation) => void;

/**
 * Small set of information regarding the context in which a rule is running.
 * Most importantly, it includes information on whether auto-fix has been enabled.
 */
export type RuleContext = {
    fix?: boolean;
    newLine?: string;
};

/**
 * This is used as an argument to the rule callback when creating a rule.
 * It contains option, context, and parse result information.
 */
export type RuleExecutionInfo<PrimaryOptionType, SecondaryOptionsType> = {
    primaryOption: PrimaryOptionType;
    secondaryOptionsObject?: SecondaryOptionsType;
    context: RuleContext;
    root: Root;
    result: Result;
};

/**
 * This is ultimately the function that is used to create a rule.
 *
 * @param reportCallback    Example Usage:
 *
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
 *
 *                          messageCallbacks.myMessage(data1, data2)
 *
 *                          this callback is intended for use in reporting violations with
 *                          reportCallback, as demonstrated in the reportCallback example above
 *                          similar to reportCallback, this callback object should be preferred over
 *                          stylelint.utils.ruleMessages because it includes information that has
 *                          already been provided.
 */
export type RuleCallback<PrimaryOptionType, SecondaryOptionsType, MessagesType> = (
    reportCallback: ReportCallback,
    messageCallbacks: MessagesType,
    callbackInput: RuleExecutionInfo<PrimaryOptionType, SecondaryOptionsType>,
) => void | PromiseLike<void>;

type RuleOptionsCallback<PrimaryOptionType, SecondaryOptionsType> = (
    primaryOption: PrimaryOptionType,
    secondaryOptionsObject?: SecondaryOptionsType,
    context?: RuleContext,
) => (root: Root, result: Result) => void;

/**
 * Creates a self contained rule which is directly given to stylelint as the plugin export.
 *
 * @param ruleName            the rule name string. Include the plugin prefix.
 *                            Examples:
 *                                <plugin-name>/<rule-name>
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
 * @param ruleCallback        this is the actual rule. This is what stylelint will call when linting
 *                            occurs with this rule loaded and enabled.
 *                            This is a simplified and flattened version of stylelint's default
 *                            "Plugin" type in order to reduce boilerplate and code duplication.
 */
export function createRule<
    MessagesType extends BaseMessagesType,
    PrimaryOptionType = boolean | string,
    SecondaryOptionsType = undefined
>(
    ruleName: string,
    messages: MessagesType,
    ruleCallback: RuleCallback<
        PrimaryOptionType | undefined,
        SecondaryOptionsType | undefined,
        MessagesType
    >,
): Rule<MessagesType> {
    const messageCallbacks: MessagesType = utils.ruleMessages(ruleName, messages);

    const plugin: RuleOptionsCallback<PrimaryOptionType, SecondaryOptionsType> = (
        primaryOption,
        secondaryOptionsObject?,
        context?,
    ) => (root, result) => {
        const reportCallback: ReportCallback = violation => {
            utils.report({...violation, result, ruleName: ruleName});
        };
        return ruleCallback(reportCallback, messageCallbacks, {
            primaryOption,
            secondaryOptionsObject,
            context: context || {},
            root,
            result,
        });
    };

    return {
        ...createPlugin(ruleName, plugin as Plugin),
        messages: messageCallbacks,
    };
}
