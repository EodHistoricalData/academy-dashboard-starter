/**
 * Runs once as the server starts, before any request (Next.js instrumentation). An app with
 * no key and no mock mode stops here with one sentence naming the variable and the file to
 * copy, instead of serving pages of empty panels.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { configProblem } = await import("@/lib/eodhd");
  const problem = configProblem(process.env);
  if (problem) throw new Error(problem);
}
