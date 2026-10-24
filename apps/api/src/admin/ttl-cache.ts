/** Injection token for the admin module's cache instance. */
export const ADMIN_CACHE = Symbol("ADMIN_CACHE");

/**
 * A small in-memory cache so refreshing the admin page does not rerun heavy
 * queries (spec: 60 seconds per route and query). Per process, so each API
 * instance keeps its own copy; fine for one owner looking at a dashboard.
 */
export class TtlCache {
  private readonly entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

  constructor(
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns the cached value for `key`, or loads and caches it. */
  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const time = this.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > time) return cached.value as Promise<T>;

    this.prune(time);
    // The promise is cached so concurrent requests share one query.
    const value = load();
    this.entries.set(key, { expiresAt: time + this.ttlMs, value });
    // Errors are not cached: the next request tries again.
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    return value;
  }

  /** Drops expired entries so distinct searches cannot grow the map forever. */
  private prune(time: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= time) this.entries.delete(key);
    }
  }
}
