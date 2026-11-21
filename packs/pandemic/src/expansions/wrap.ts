/** Words wrapped within 34 columns, later lines indented: a module's line under the base's table on a phone. */
export function wrap(text: string, width = 34): string {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (line && line.length + 1 + w.length > width) { lines.push(line); line = `  ${w}`; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
