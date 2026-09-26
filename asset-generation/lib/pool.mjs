// Run `worker` over `items` with at most `concurrency` in flight and at least `gapMs` between
// starts. Results keep input order. A worker failure is recorded, never re-attempted: re-running
// a paid call is always a human decision.
export async function runPool(items, worker, { concurrency = 3, gapMs = 0 } = {}) {
  const results = new Array(items.length);
  let next = 0;
  let lastStart = 0;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function lane() {
    while (next < items.length) {
      const index = next++;
      const wait = lastStart + gapMs - Date.now();
      lastStart = Math.max(Date.now(), lastStart + gapMs);
      if (wait > 0) await sleep(wait);
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { ok: false, error: String(error?.message || error).slice(0, 400) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
}
