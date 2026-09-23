// Splits a search query into the word list `search_products_with_metadata`
// matches with per-word Postgres \m/\M word-boundary regexes. Those anchors
// can never match a token that starts or ends on a non-alphanumeric
// character (e.g. a bare "-" left over from splitting "Card - Gift", or a
// currency symbol glued to a number like "£20") — \m requires an actual
// word character at that exact position, so the whole token silently fails
// to match even though the literal text is right there in the title. Strip
// each token down to its alphanumeric core so those symbols can't sink an
// otherwise-matching search.
export function tokenizeSearchQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter(Boolean);
}
