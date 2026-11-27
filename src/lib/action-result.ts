/** Server action failures travel as values: Next.js hides thrown error
 * messages in production builds, so users would only see a generic error. */
export type ActionFailure = { error: string };

export function isFailure(value: unknown): value is ActionFailure {
  return (
    !!value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string" &&
    Object.keys(value).length === 1
  );
}

/** Client helper: turn a returned failure back into a thrown Error so the
 * existing try/catch + toast handlers keep working. */
export function unwrap<T>(value: T): Exclude<T, ActionFailure> {
  if (isFailure(value)) throw new Error(value.error);
  return value as Exclude<T, ActionFailure>;
}

/** Wrap an action so a returned failure is thrown: `await settle(action)(args)`. */
export function settle<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A) => unwrap(await fn(...args));
}
