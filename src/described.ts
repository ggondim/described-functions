import type { Static, TSchema } from "@sinclair/typebox";
import type { JSONSchemaRaw } from "./schema/json-schema";
import type { TFromSchema } from "./schema/typebox-fromschema";

/**
 * Represents an implemented function or an HTTP endpoint that can be invoked as a tool. A
 *  Described Function is an implemented logic or a remote procedure that is described by its
 *  input and output schemas, alongside additional metadata such as description, intents and
 *  caching.
 *
 * @template TInputSchema The JSON schema for the input arguments.
 * @template TResultSchema The JSON schema for the function/endpoint result.
 * @template TInput The typed input arguments (usually JSONSchemaRaw<TInputSchema>).
 * @template TResult The typed result (usually JSONSchemaRaw<TResultSchema>).
 * @description This interface is used to describe a JavaScript function or an API endpoint with its input and output schemas. When used in an agentic context, it can be used to infer the function's purpose and how to invoke it.
 */
export type DescribedFunc<
	TInputSchema extends JSONSchemaRaw | TSchema,
	TResultSchema extends JSONSchemaRaw | TSchema,
	TInput = TInputSchema extends TSchema ? Static<TInputSchema> : TFromSchema<TInputSchema>,
	TResult = TResultSchema extends TSchema ? Static<TResultSchema> : TFromSchema<TResultSchema>,
> = {
	/**
	 * The unique name of this described function.
	 *
	 */
	name: string;

	/**
	 * The title of this described function, which can be used for display purposes.
	 *
	 */
	title?: string;

	/**
	 * A human-readable description of the function. Used for documentation and
	 *  agentic discovery/inference.
	 *
	 */
	description: string;

	/**
	 * The tags associated with this function, which can be used for categorization or
	 *  filtering.
	 */
	tags?: string[];

	/**
	 * The intents of this function, which can determine the HTTP method if it is an HTTP endpoint.
	 *
	 */
	intents?: "resource" | "action";

	/**
	 * The JSON schema for the input arguments.
	 *
	 */
	inputSchema: TInputSchema;

	/**
	 * The JSON schema for the function/endpoint result.
	 *
	 */
	resultSchema: TResultSchema;

	/**
	 * Determines a cache duration (in milliseconds) to be implemented by invokers/wrappers of this
	 *  described function.
	 *
	 */
	cache?: number;

	/**
	 * Indicates a client-side cache duration (in milliseconds) to be advertised by invokers/wrappers
	 *  encapsulated in application servers.
	 *
	 */
	clientCache?: number;

	/**
	 * The function that implements the described function logic.
	 *
	 * @param {TInput} input The input arguments.
	 * @param {any} context The context in which the function is invoked.
	 * @returns {Promise<TResult>} The result of the function invocation.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: cannot determine type
	func?: (input: TInput, context: any) => Promise<TResult>;

	/**
	 * The HTTP endpoint configuration, if this described function is an HTTP endpoint.
	 *
	 */
	httpEndpoint?: {
		/**
		 * The HTTP method (GET, POST, etc.) for the endpoint.
		 *
		 */
		method: "GET" | "POST";

		/**
		 * The URL of the HTTP endpoint.
		 *
		 */
		url: string;

		/**
		 * Indicates if the invoker is an intermediary (aka HTTP server) and it should send an HTTP
		 *  redirect response (3xx) instead relying on the built-in Tool HTTP client.
		 */
		redirect?: true | 301 | 302;

		/**
		 * Indicates if the invoker is an intermediary (aka HTTP server) and it has original
		 *  request headers to be forwarded to the built-in Tool HTTP client.
		 *  If true, all headers are forwarded. If an array of strings, only the specified headers
		 *  are forwarded.
		 */
		// TODO: implement on makeRequest
		proxyHeaders?: true | string[];

		/**
		 * Additional headers to be sent with the request. Overrides the `proxyHeaders` if
		 *  specified.
		 */
		// TODO: implement on makeRequest
		// requestHeaders?: Record<string, string>;
		// responseHeaders?: Record<string, string>;

		// TODO: custom client (WinterCG compliant)
	};
};
