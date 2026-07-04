/**
 * In-process счётчики для мониторинга (Prometheus text format).
 * Для multi-instance деплоя агрегируйте на стороне scraper'а или шлите в OTel.
 */
type Labels = Record<string, string>;

function labelKey(name: string, labels: Labels): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`);
  return parts.length > 0 ? `${name}{${parts.join(",")}}` : name;
}

const counters = new Map<string, number>();

export function incrementCounter(name: string, labels: Labels = {}, delta = 1): void {
  const key = labelKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + delta);
}

export function getCounter(name: string, labels: Labels = {}): number {
  return counters.get(labelKey(name, labels)) ?? 0;
}

/** Сброс всех счётчиков (тесты). */
export function resetMetrics(): void {
  counters.clear();
}

/** Prometheus exposition format 0.0.4 (subset — только counters). */
export function renderPrometheusMetrics(): string {
  const names = new Set<string>();
  for (const key of counters.keys()) {
    const brace = key.indexOf("{");
    names.add(brace === -1 ? key : key.slice(0, brace));
  }

  const lines: string[] = [];
  for (const name of [...names].sort()) {
    lines.push(`# TYPE ${name} counter`);
    const prefix = `${name}{`;
    const entries = [...counters.entries()]
      .filter(([k]) => k === name || k.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of entries) {
      lines.push(`${key} ${value}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
