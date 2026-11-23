import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { ActionFailure } from "@/lib/action-result";

/** Run a server action, returning user-facing messages as { error }.
 * Only plain Error messages (written for users in this codebase) and Zod
 * validation messages are returned; Prisma, system and type errors are
 * rethrown so their details stay in the server log. */
export async function guard<T>(run: () => Promise<T>): Promise<T | ActionFailure> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError)
      return { error: error.issues[0]?.message ?? "Check the form and try again." };
    if (error instanceof Error && error.constructor === Error && !("code" in error) && error.message)
      return { error: error.message };
    throw error;
  }
}
