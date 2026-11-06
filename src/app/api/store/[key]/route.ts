import { getDoc, isDocKey, putDoc } from "@/lib/store";
import { currentUser } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
/** A document is settings and notes, not data: anything this large is a mistake or an attack. */
const MAX_BYTES = 200_000;

type Context = { params: Promise<{ key: string }> };

/**
 * GET /api/store/<key>: the signed-in user's document, or 404. 404 also for a key that is
 * not one of the documents, and for a document that exists only for somebody else: a 403
 * would confirm it is there.
 */
export async function GET(_req: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return signIn();
  const { key } = await params;
  const doc = isDocKey(key) ? getDoc(user.id, key) : null;
  if (!doc) return Response.json({ error: "No such document." }, { status: 404, headers: NO_STORE });
  return Response.json(doc, { headers: NO_STORE });
}

/**
 * PUT /api/store/<key> with `{ version, payload }`, where version is the one you read (0 for
 * a document you have not seen). 409 if it has moved: another tab saved first.
 */
export async function PUT(req: Request, { params }: Context) {
  const user = await currentUser();
  if (!user) return signIn();
  const { key } = await params;
  if (!isDocKey(key)) {
    return Response.json({ error: "No such document." }, { status: 404, headers: NO_STORE });
  }

  const text = await req.text();
  if (text.length > MAX_BYTES) {
    return Response.json({ error: "Document too large." }, { status: 413, headers: NO_STORE });
  }
  let body: { version?: unknown; payload?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Body is not JSON." }, { status: 400, headers: NO_STORE });
  }
  if (!Number.isInteger(body.version) || (body.version as number) < 0 || !("payload" in body)) {
    return Response.json(
      { error: "Send { version, payload }: the version you read, 0 if none." },
      { status: 400, headers: NO_STORE },
    );
  }

  const result = putDoc(user.id, key, body.payload, body.version as number);
  if (result.conflict) {
    return Response.json(
      {
        error: "Your other tab is ahead: it saved this after you opened it. Reload to see its version.",
        current: result.current,
      },
      { status: 409, headers: NO_STORE },
    );
  }
  return Response.json({ version: result.version }, { headers: NO_STORE });
}

function signIn() {
  return Response.json(
    { error: "Not signed in. Sign in at /login." },
    { status: 401, headers: NO_STORE },
  );
}
