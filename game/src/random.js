// A small deterministic random source, so a seed always builds the same city and the
// same traffic. mulberry32: short, fast, and good enough for placement and flavour.
export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
  };
}
