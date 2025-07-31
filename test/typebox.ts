import { Static, Type } from '@sinclair/typebox';
import type { DescribedFunc } from '../src/described';
import { FromSchema, type TFromSchema } from '../src/schema/typebox-fromschema';
import { makeTool } from '../src/tool';

const inputSchema = Type.Object({
  name: Type.String({ description: 'The name of the person to greet.' }),
  age: Type.Optional(Type.Number({ description: 'The age of the person to greet.' })),
}, {
  additionalProperties: false,
  required: ['name'],
});

const resultSchema = Type.Object({
  greeting: Type.String({ description: 'A greeting message for the person.' }),
}, {
  additionalProperties: false,
  required: ['greeting'],
});


const greetingFunc: DescribedFunc<
  typeof inputSchema,
  typeof resultSchema
> = {
  name: 'greet',
  description: 'Generates a greeting message for a person.',
  inputSchema,
  resultSchema,
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
