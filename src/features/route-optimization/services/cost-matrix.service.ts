import type { Place, RouteCost } from "../types/route.types";

export type CostProvider = (from: Place, to: Place) => Promise<RouteCost>;

/** Builds a directed N×(N-1) matrix with bounded concurrency to respect API limits. */
export async function buildCostMatrix(places: Place[], getCost: CostProvider, concurrency = 3): Promise<RouteCost[]> {
  const jobs = places.flatMap((from) => places.filter((to) => to.id !== from.id).map((to) => ({ from, to })));
  const result: RouteCost[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      result.push(await getCost(job.from, job.to));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return result;
}
