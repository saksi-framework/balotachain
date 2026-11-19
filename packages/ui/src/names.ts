/**
 * The text shown for an id recorded on chain (design review D19): each
 * hyphen becomes a space, and nothing else changes.
 *
 * It never trims, re-cases or collapses anything: case, dots, underscores
 * and digits stay as they come, and repeated hyphens stay repeated spaces
 * (`A--B` reads `A  B`). Display only: the id itself is what is sent,
 * encrypted and recorded.
 */
export function idToName(id: string): string {
  return id.replace(/-/g, " ");
}
