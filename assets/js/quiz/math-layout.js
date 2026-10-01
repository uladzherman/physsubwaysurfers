export function formulaLabelRows(tex, narrowScreen) {
  if (!narrowScreen) return [tex];

  let depth = 0;
  let equalsIndex = -1;
  for (let i = 0; i < tex.length; i++) {
    const char = tex[i];
    if (char === "\\") { i++; continue; }
    if (char === "{") depth++;
    else if (char === "}") depth = Math.max(0, depth - 1);
    else if (char === "=" && depth === 0) { equalsIndex = i; break; }
  }

  if (equalsIndex < 0) return [tex];
  const left = tex.slice(0, equalsIndex).trim();
  const right = tex.slice(equalsIndex + 1).trim();
  return left && right ? [left, "= " + right] : [tex];
}
