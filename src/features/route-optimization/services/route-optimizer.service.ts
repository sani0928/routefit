import { BitmaskDpOptimizer } from "../algorithms/bitmask-dp";
import type { RouteOptimizationInput, RouteOptimizationResult, RouteOptimizer } from "../types/route.types";

const optimizer: RouteOptimizer = new BitmaskDpOptimizer();
export function optimizeRoute(input: RouteOptimizationInput): RouteOptimizationResult {
  return optimizer.optimize(input);
}
