/**
 * Given a filename and a set of existing names, return a non-conflicting
 * filename by appending " (N)" before the extension. Dotfiles (.env) and
 * names without extensions treat the whole name as the stem.
 */
export function resolveRename(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name;

  const { stem, ext } = splitExtension(name);
  for (let i = 1; i <= 100; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error(`Too many rename attempts for "${name}"`);
}

function splitExtension(name: string): { stem: string; ext: string } {
  // Dotfile: leading dot is not an extension separator
  const firstNonDot = name.search(/[^.]/);
  if (firstNonDot < 0) return { stem: name, ext: '' };
  const body = name.slice(firstNonDot);
  const dot = body.lastIndexOf('.');
  if (dot <= 0) return { stem: name, ext: '' };
  const extStart = firstNonDot + dot;
  return { stem: name.slice(0, extStart), ext: name.slice(extStart) };
}
