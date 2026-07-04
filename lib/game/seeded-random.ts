/**
 * Детерминированный PRNG из строкового seed (xmur3 → mulberry32).
 *
 * Сервер выдаёт seed при старте партии, клиент генерирует из него
 * препятствия. Одинаковый seed — одинаковая партия: фундамент для
 * серверной replay-валидации в будущих играх.
 */
export function createSeededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (h ^= h >>> 16) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
