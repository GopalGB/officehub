import { NextResponse } from "next/server";
import { auth } from "../../auth";

export async function requireApiAuth() {
  const session = await auth();
  if (!session?.user) {
    return {
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not signed in" } },
        { status: 401 },
      ),
      user: null,
    };
  }
  return { user: session.user, response: null };
}

export function jsonError(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
