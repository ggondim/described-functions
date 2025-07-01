# described-functions

> Utilities and typings to describe and validate functions. Useful when dealing agentic function calling and MCP.

Agentic frameworks like OpenAI's Agent SDK and Model Control Protocol (MCP) often require functions to be described in a way that allows for validation and invocation, including:

- Input schemas (and optionally result schemas), often defined using JSON Schema.
- Function metadata, such as name and description, required for function calling capabilities.

**described-functions** provides a simple way to define these functions and to invoke them, with automatic type inference and validation.

## Describing a tool

```typescript
// userTool.ts
import { FromSchema } from "json-schema-to-ts";
import { makeTool } from "described-functions";

// Define the input and result schemas using JSON Schema
// Use `as const` to ensure the types are inferred correctly
const inputSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }
  },
  required: ["name", "age"]
} as const;

const resultSchema = {
  type: "object",
  properties: {
    category: { type: "boolean" }
  }
} as const;

// (Optional) Define the input and result types to help with external type checking
export type InputType = FromSchema<typeof inputSchema>;
export type ResultType = FromSchema<typeof resultSchema>;

// Implement the function that will be called by the tool
async function func(input: InputType): Promise<ResultType> {
  return {
    category: !!input
  };
}

// Export the tool using `makeTool`
export default makeTool({
  name: "UserTool",
  description: "A nice tool to classify users",
  inputSchema,
  resultSchema,
  func
});
```

## Invoking a tool

```typescript
// Import the tool
import userTool from "./userTool";

async function main() {
  const input = {
    name: "Name",
    age: 30
  };

  // Invoke the tool with the input
  const result = await userTool.invoke(input);
}
```