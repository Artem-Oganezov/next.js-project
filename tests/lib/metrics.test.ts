import { describe, expect, it } from "vitest";
import {
  getCounter,
  incrementCounter,
  renderPrometheusMetrics,
  resetMetrics,
} from "@/lib/observability/metrics";

describe("metrics", () => {
  it("increments and renders prometheus counters", () => {
    resetMetrics();
    incrementCounter("test_events_total", { kind: "a" });
    incrementCounter("test_events_total", { kind: "a" });
    incrementCounter("test_events_total", { kind: "b" });

    expect(getCounter("test_events_total", { kind: "a" })).toBe(2);
    expect(getCounter("test_events_total", { kind: "b" })).toBe(1);

    const text = renderPrometheusMetrics();
    expect(text).toContain("# TYPE test_events_total counter");
    expect(text).toContain('test_events_total{kind="a"} 2');
  });
});
