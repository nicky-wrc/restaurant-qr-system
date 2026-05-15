/** Natural sort for labels like "โต๊ะ 1", "โต๊ะ 2", "โต๊ะ 10" (Prisma `orderBy: label` is lexicographic only). */
export function sortTablesByLabel<T extends { label: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) =>
    a.label.localeCompare(b.label, "th", { numeric: true, sensitivity: "base" }),
  );
}
