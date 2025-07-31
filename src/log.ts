/**
 * Represents a generic logging function.
 */
// biome-ignore lint/suspicious/noExplicitAny: cannot determine the type of args
export type ILogFunction = (message: string, ...args: any[]) => void;

/**
 * Interface for a logging provider.
 */
export interface ILogProvider {
  log: ILogFunction;
  warn?: ILogFunction;
  error?: ILogFunction;
  debug?: ILogFunction;
}
