import Ajv, { ValidationError } from "ajv";
import type { JSONSchema } from "json-schema-to-ts";
import type { DescribedFunc } from "./described";
import type { AcceptableCacheValue, ICache } from "./cache";
import { hashObjectSHA1, MemoryCache } from "./cache";
import type { ILogFunction, ILogProvider } from "./log";

/**
 * Represents options when invoking a tool.
 */
export type InvokeToolOptions = {
  /**
 * Cache options for the tool invocation.
 * If set to `false`, it forces the tool to not use any caching.
 * If set to a string, it indicates a named cache (e.g., Redis).
 * If set to an `ICache` instance, it uses that cache directly.
 * If not provided, it defaults to an in-memory cache.
 *
 */
  cache?: false | string | ICache;

  /**
   * Optional log provider or function for logging during tool invocation.
   * If provided, it can be used to log messages related to the tool's execution.
   *
   */
  log?: ILogProvider | ILogFunction;
};

export class ToolClass<
  TInputSchema extends JSONSchema,
  TResultSchema extends JSONSchema,
  TInput extends object | object[],
  TResult extends object | object[]
> {
  config: DescribedFunc<TInputSchema, TResultSchema, TInput, TResult>;

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  callFunc: (input: AcceptableCacheValue, context?: any) => Promise<AcceptableCacheValue>;

  constructor(config: DescribedFunc<TInputSchema, TResultSchema, TInput, TResult>) {
    this.config = config;

    if (!config.func && !config.httpEndpoint) {
      throw new Error("Tool configuration must have either a function or an endpoint defined.");
    }

    if (config.func) {
      this.callFunc = config.func;
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      this.callFunc = async (input: AcceptableCacheValue, context?: any) => {
        if (!config.httpEndpoint) {
          throw new Error("Tool configuration must have a function or an HTTP endpoint defined.");
        }
        return makeRequest(config.httpEndpoint.url, input, config.httpEndpoint.method);
      };
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
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  async invoke(input: TInput, context?: any, options?: InvokeToolOptions): Promise<TResult> {
    // Validate input before invoking the function
    this.validateInput(input);

    let result: TResult;

    // If caching is enabled, check the cache first
    if (options?.cache !== false && this.config.cache) {
      const key = DEFAULT_CACHE_KEY_FACTORY(this.config.name, input as object);
      const cache = resolveCache(options.cache);

      const cachedResult = await cache.get(key);
      if (cachedResult) {
        return cachedResult as TResult;
      }

      result = await this.callFunc(input, context) as TResult;
      // Store the result in the cache
      await cache.set(key, result, this.config.cache);
    }

    result = await this.callFunc(input, context) as TResult;

    // Validate the result after invoking the function
    this.validateResult(result);
    return result;
  }

  /**
   * Validates the input against the defined schema.
   *
   * @param {TInput} input The input to validate.
   * @returns {boolean} Returns true if the input is valid, otherwise throws a ValidationError.
   * @throws {ValidationError} If the input does not conform to the schema.
   */
  validateInput(input: TInput): boolean {
    return basicAjvValidate(this.config.inputSchema, input as object);
  }

  /**
   * Validates the result against the defined schema.
   *
   * @param {TResult} result The result to validate.
   * @returns {boolean} Returns true if the result is valid, otherwise throws a ValidationError.
   * @throws {ValidationError} If the result does not conform to the schema.
   */
  validateResult(result: TResult): boolean {
    return basicAjvValidate(this.config.resultSchema, result as object);
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
  TInputSchema extends JSONSchema,
  TResultSchema extends JSONSchema,
  TInput extends object | object[],
  TResult extends object | object[]
> = DescribedFunc<TInputSchema, TResultSchema, TInput, TResult>
  & ToolClass<TInputSchema, TResultSchema, TInput, TResult>;

/**
 * Transforms a described function into a tool that can be invoked with input validation and caching.
 */
export function makeTool<
  TInputSchema extends JSONSchema,
  TResultSchema extends JSONSchema,
  TInput extends object | object[],
  TResult extends object | object[]
>(
  config: DescribedFunc<TInputSchema, TResultSchema, TInput, TResult>
): Tool<TInputSchema, TResultSchema, TInput, TResult> {
  const tool = new ToolClass(config);
  return Object.assign(tool, config);
}

function basicAjvValidate(schema: JSONSchema, input: object): boolean {
  const ajv = new Ajv();
  const validateInput = ajv.compile(schema);
  const isValid = validateInput(input);
  if (!isValid) {
    throw new ValidationError(validateInput.errors ?? []);
  }
  return isValid;
}

const DEFAULT_CACHE_KEY_FACTORY = (prefix: string, input: object): string =>
  `${prefix}:${hashObjectSHA1(input)}`;

function resolveCache(cache: string | ICache | undefined): ICache {
  if (typeof cache === 'undefined') {
    return new MemoryCache();
  }

  if (typeof cache === 'string') {
    // Placeholder for a named cache, e.g., Redis or similar
    return new MemoryCache(); // Replace with actual cache implementation
  }

  return cache;
}

async function makeRequest(
  url: string,
  data: AcceptableCacheValue,
  method?: "GET" | "POST",
): Promise<AcceptableCacheValue> {
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
    return response.json() as Promise<AcceptableCacheValue>;
  }
  if (contentType?.includes("text/plain")) {
    return response.text() as Promise<AcceptableCacheValue>;
  }

  throw new Error(`Unsupported or missing content type: ${contentType ?? "none"}`);
}
