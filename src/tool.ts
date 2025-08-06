
import { Kind, type Static, type TSchema } from "@sinclair/typebox";
import type { TypeCheck, ValueError } from '@sinclair/typebox/compiler';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import Keyv from "keyv";
import type { ICache } from "./cache";
import { hashObjectSHA1 } from "./cache";
import type { DescribedFunc } from "./described";
import type { ILogFunction, ILogProvider } from "./log";
import type { JSONSchemaRaw } from "./schema/json-schema";
import { FromSchema, type TFromSchema } from "./schema/typebox-fromschema";

export type ValidateOptions = {
  validateInput?: boolean;
  validateResult?: boolean;
};

/**
 * Represents options when invoking a tool.
 */
export type InvokeToolOptions<T = unknown> = {
  /**
 * Cache options for the tool invocation.
 * If set to `false`, it forces the tool to not use any caching.
 * If set to a string, it indicates a named cache (e.g., Redis).
 * If set to an `ICache` instance, it uses that cache directly.
 * If not provided, it defaults to an in-memory cache.
 *
 */
  cache?: false | ICache<T>;

  /**
   * Optional log provider or function for logging during tool invocation.
   * If provided, it can be used to log messages related to the tool's execution.
   *
   */
  log?: ILogProvider | ILogFunction;
} & ValidateOptions;

export class ValidationError extends Error {
  constructor(public errors: ValueError[], public type?: string) {
    super(`Schema validation failed ${type ? `(${type})` : ""}`);
    this.name = "ValidationError";
  }
  toString() {
    return this.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
  }
}

export class ToolClass<
  TInputSchema extends JSONSchemaRaw | TSchema,
  TResultSchema extends JSONSchemaRaw | TSchema,
  TInput = TInputSchema extends TSchema ? Static<TInputSchema> : TFromSchema<TInputSchema>,
  TResult = TResultSchema extends TSchema ? Static<TResultSchema> : TFromSchema<TResultSchema>,
> {
  config: DescribedFunc<TInputSchema, TResultSchema, TInput, TResult>;

  // biome-ignore lint/suspicious/noExplicitAny: cannot determine type
  callFunc: (input: TInput, context?: any) => Promise<TResult>;

  cache?: ICache<unknown> = new Keyv<unknown>();

  keyFactory: (prefix: string, input: object) => Promise<string> = async (prefix, input) =>
    `${prefix}:${await hashObjectSHA1(input)}`;

  compiledInputSchema: TypeCheck<TSchema>;

  compiledResultSchema: TypeCheck<TSchema>;

  constructor(config: DescribedFunc<TInputSchema, TResultSchema, TInput, TResult> & ValidateOptions) {
    this.config = config;

    if ((!config.func && !config.httpEndpoint) || (config.func && config.httpEndpoint)) {
      throw new Error("Tool configuration must have either a function or an endpoint defined.");
    }

    if (config.func) {
      this.callFunc = config.func;
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: cannot determine type
      this.callFunc = async (input: TInput, context?: any) => {
        if (!config.httpEndpoint) {
          throw new Error("Tool configuration must have a function or an HTTP endpoint defined.");
        }
        return makeRequest(config.httpEndpoint.url, input, config.httpEndpoint.method);
      };
    }

    // CONVERT SCHEMAS TO TYPEBOX SCHEMAS
    if (typeof config.inputSchema[Kind] !== "string") {
      config.inputSchema = FromSchema(config.inputSchema) as unknown as TInputSchema;
    }
    if (typeof config.resultSchema[Kind] !== "string") {
      config.resultSchema = FromSchema(config.resultSchema) as unknown as TResultSchema;
    }

    // COMPILE SCHEMAS IF VALIDATION IS ENABLED (DEFAULT)
    if (config?.validateInput !== false) {
      this.compiledInputSchema = TypeCompiler.Compile(config.inputSchema as TSchema);
    }
    if (config?.validateResult !== false) {
      this.compiledResultSchema = TypeCompiler.Compile(config.resultSchema as TSchema);
    }
  }

  /**
   * Invokes the tool with the provided input and optional context.
   *
   * @param {TInput} input The input arguments to call the function or to send to the HTTP endpoint.
   * @param {any} context Optional context that will be passed to the function.
   * @param {InvokeToolOptions} options Options for invoking the tool, including caching and logging.
   * @returns {Promise<TResult>} A promise that resolves to the result of the function invocation
   *  or HTTP request.
   */
  // biome-ignore lint/suspicious/noExplicitAny: cannot determine type
  async invoke(input: TInput, context?: any, options?: InvokeToolOptions): Promise<TResult> {
    // Validate input before invoking the function
    if (this.compiledInputSchema) {
      this.validateInput(input);
    }

    let result: TResult;

    // If caching is enabled, check the cache first
    if (options?.cache !== false && this.config.cache && this.config.intents === "resource") {
      const key = await this.keyFactory(this.config.name, input as object);
      const cache = options.cache ?? this.cache;

      const cachedResult = await cache.get(key);
      if (cachedResult) {
        return cachedResult as TResult;
      }

      result = await this.callFunc(input, context) as TResult;
      // Store the result in the cache
      await cache.set(key, result, this.config.cache);
    } else {
      // Skip caching
      result = await this.callFunc(input, context) as TResult;
    }

    // Validate the result after invoking the function
    this.validateResult(result);
    return result;
  }

  /**
   * Validates the input against the defined schema.
   *
   * @param {TInput} input The input to validate.
   * @returns {boolean} Returns true if the input is valid, otherwise throws a ValidationError.
   */
  validateInput(input: TInput): boolean {
    const errors = this.compiledInputSchema.Errors(input as unknown);
    if (errors.First()) {
      throw new ValidationError([...errors], "input");
    }
    return true;
  }

  /**
   * Validates the result against the defined schema.
   *
   * @param {TResult} result The result to validate.
   * @returns {boolean} Returns true if the result is valid, otherwise throws a ValidationError.
   */
  validateResult(result: TResult): boolean {
    const errors = this.compiledResultSchema.Errors(result as unknown);
    if (errors.First()) {
      throw new ValidationError([...errors], "result");
    }
    return true;
  }
}

/**
 * Represents a described function that can be invoked as a tool, with additional validation and
 *  caching capabilities. It extends the DescribedFunc type to include: 1) an `invoke` method
 *  that automatically identifies the function or HTTP endpoint to call, 2) input and result
 *  validation against the defined schemas, and 3) caching capabilities that follow the described
 *  function's caching configuration.
 */
export type Tool<
	TInputSchema extends JSONSchemaRaw | TSchema,
	TResultSchema extends JSONSchemaRaw | TSchema,
	TInput = TInputSchema extends TSchema ? Static<TInputSchema> : TFromSchema<TInputSchema>,
	TResult = TResultSchema extends TSchema ? Static<TResultSchema> : TFromSchema<TResultSchema>,
> = DescribedFunc<TInputSchema, TResultSchema, TInput, TResult>
  & ToolClass<TInputSchema, TResultSchema, TInput, TResult>;

/**
 * Transforms a described function into a tool that can be invoked with input validation and caching.
 */
export function makeTool<
	TInputSchema extends JSONSchemaRaw | TSchema,
	TResultSchema extends JSONSchemaRaw | TSchema,
	TInput = TInputSchema extends TSchema ? Static<TInputSchema> : TFromSchema<TInputSchema>,
	TResult = TResultSchema extends TSchema ? Static<TResultSchema> : TFromSchema<TResultSchema>,
>(
  config: DescribedFunc<TInputSchema, TResultSchema, TInput, TResult>
): Tool<TInputSchema, TResultSchema, TInput, TResult> {
  const tool = new ToolClass(config);
  return Object.assign(tool, config);
}

async function makeRequest<TInput, TResult>(
  url: string,
  data: TInput,
  method?: "GET" | "POST",
): Promise<TResult> {
  if (!fetch) {
    throw new Error("Fetch API is not available in this environment.");
  }

  const _method = method || (typeof data === "object" ? "GET" : "POST");
  const _body = _method === "POST" ? JSON.stringify(data) : undefined;
  const _url = new URL(url);

  if (_method === "GET" && typeof data === "object") {
    // Merge existing query params with new ones
    const newParams = new URLSearchParams(data as Record<string, string>);
    for (const [key, value] of newParams.entries()) {
      _url.searchParams.set(key, value);
    }
  }

  const headers = new Headers();
  const requestInit: RequestInit = {
    method: _method,
    headers,
  };
  if (_body) {
    headers.set("Content-Type", "application/json");
    requestInit.body = _body;
  }
  const request = new Request(_url.toString(), requestInit);

  const response = await fetch(request);

  if (!response.ok) {
    throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`, { cause: response });
  }

  const contentType = response.headers.get("Content-Type");
  if (contentType?.includes("application/json")) {
    return response.json() as Promise<TResult>;
  }
  if (contentType?.includes("text/plain")) {
    return response.text() as Promise<TResult>;
  }

  throw new Error(`Unsupported or missing content type: ${contentType ?? "none"}`);
}
