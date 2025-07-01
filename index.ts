import type { JSONSchema } from "json-schema-to-ts";
import Ajv, { ValidationError } from "ajv";

export interface IDescribedFunc<
  TInputSchema extends JSONSchema,
  TResultSchema extends JSONSchema,
  TInput,
  TResult
> {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  resultSchema: TResultSchema;
  func: (input: TInput) => Promise<TResult>;
}

export type Tool<
  TInputSchema extends JSONSchema,
  TResultSchema extends JSONSchema,
  TInput,
  TResult
> = IDescribedFunc<TInputSchema, TResultSchema, TInput, TResult> & {
  invoke: (input: TInput) => Promise<TResult>;
  validate: (input: TInput) => boolean;
};

export function makeTool<
  TInputSchema extends JSONSchema,
  TResultSchema extends JSONSchema,
  TInput,
  TResult
>(
  config: IDescribedFunc<TInputSchema, TResultSchema, TInput, TResult>
): Tool<TInputSchema, TResultSchema, TInput, TResult> {
  return {
    ...config,

    validate(input: TInput): boolean {
      // ajv
      const ajv = new Ajv();
      const validateInput = ajv.compile(config.inputSchema);
      const isValid = validateInput(input);
      if (!isValid) {
        throw new ValidationError(validateInput.errors ?? []);
      }
      return isValid;
    },

    invoke(input: TInput): Promise<TResult> {
      // Validate input before invoking the function
      this.validate(input);
      // Call the function with the validated input
      return config.func(input);
    }
  };
}