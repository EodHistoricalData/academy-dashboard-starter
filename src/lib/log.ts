/**
 * One line of JSON per event, on the server's standard output: what a host's log viewer
 * shows and a search can filter. Callers pass facts, never a URL, a body or a key: a log is
 * read by more people, and kept longer, than the request it describes.
 */
export function logEvent(event: string, fields: Record<string, string | number | null> = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
}
