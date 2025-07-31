import type { DescribedFunc } from '../src/described';
import { FromSchema, type TFromSchema } from '../src/schema/typebox-fromschema';
import { makeTool } from '../src/tool';

const inputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'The name of the person to greet.',
    },
    age: {
      type: 'number',
      description: 'The age of the person to greet.',
    },
  },
  required: ['name'],
  additionalProperties: false,
} as const;

const resultSchema = {
  type: 'object',
  properties: {
    greeting: {
      type: 'string',
      description: 'A greeting message for the person.',
    },
  },
  required: ['greeting'],
  additionalProperties: false,
} as const;

const greetingFunc: DescribedFunc<
  TFromSchema<typeof inputSchema>,
  TFromSchema<typeof resultSchema>
> = {
  name: 'greet',
  description: 'Generates a greeting message for a person.',
  inputSchema: FromSchema(inputSchema),
  resultSchema: FromSchema(resultSchema),
  async func(input) {
    const { name, age } = input;
    const greeting = `Hello, ${name}${age ? `! You are ${age} years old.` : ''}`;
    return { greeting };
  },
}

const greetTool = makeTool(greetingFunc);

const testInput = { name: 'Alice', age: 30 };
const testOutput = await greetTool.invoke(testInput, {});

console.log('Test Input:', testOutput.greeting);
