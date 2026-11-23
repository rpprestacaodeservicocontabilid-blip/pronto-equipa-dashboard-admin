export function ordered<T>(items: T[], preferred: string[] | undefined, identify: (item: T) => string) {
  if (!preferred?.length) return items;
  const indexed = new Map(items.map(item => [identify(item), item]));
  const result: T[] = [];
  for (const key of preferred) {
    const item = indexed.get(key);
    if (item !== undefined) { result.push(item); indexed.delete(key); }
  }
  return [...result, ...indexed.values()];
}

export function moveVisible(complete: string[], visible: string[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= visible.length || to >= visible.length) return complete;
  const moved = [...visible];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  const included = new Set(visible);
  let index = 0;
  return complete.map(key => included.has(key) ? moved[index++] : key);
}
