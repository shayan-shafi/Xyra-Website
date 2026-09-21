// PostgREST caps each response at the project max-rows (commonly 1000), so
// admin data layers page through with .range() instead of a bare .limit().
// A failing table is logged and returns what was read so far — one missing
// migration never blanks a whole admin page.

const PAGE = 1000;

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) {
      console.error(`admin/${label}:`, error.message);
      break;
    }
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}
