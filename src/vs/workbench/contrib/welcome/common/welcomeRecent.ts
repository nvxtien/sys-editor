export interface RecentRow { readonly path: string; readonly name: string; readonly parent: string }

/** Turns folder paths (most recent first) into Welcome rows: unique, at most `max`. */
export function pickRecents(paths: readonly string[], max: number): RecentRow[] {
	const seen = new Set<string>();
	const rows: RecentRow[] = [];
	for (const raw of paths) {
		const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
		if (seen.has(path)) { continue; }
		seen.add(path);
		const i = path.lastIndexOf('/');
		rows.push({ path, name: path.slice(i + 1), parent: i <= 0 ? '/' : path.slice(0, i) });
		if (rows.length === max) { break; }
	}
	return rows;
}
