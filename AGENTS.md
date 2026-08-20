<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Traps found in this repo

**Do not write HTML entities in JSX text.** `<code>x</code> &mdash; y` renders as
`x— y`: the compiler's entity decoding swallows the space in front of the entity, and
Prettier will keep reverting an explicit `{" "}` because it considers the plain space
significant. Write the character itself — `—`, `·`, `’` — and the space survives. This
cost a build-verify cycle to find; it is invisible in review and obvious on screen.
