import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A text fallback reserves the same space without pretending to be an official logo.
const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="352" height="88" viewBox="0 0 352 88"><g fill="white" font-family="Helvetica Neue,Arial,sans-serif" text-anchor="middle"><text x="176" y="39" font-size="34" font-weight="700" letter-spacing="5">CATALYST</text><text x="176" y="69" font-size="19" font-weight="500" letter-spacing="9">BRANDS</text></g></svg>`;

export async function GET() {
  try {
    const file = await readFile("logo.png");
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    return new Response(fallback, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}
