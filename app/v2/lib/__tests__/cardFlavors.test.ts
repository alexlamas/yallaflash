import { describe, expect, it } from "vitest";
import { FLAVOR_STYLES, FLAVOR_WASHES, flavorForWord } from "../cardFlavors";

describe("flavorForWord", () => {
  it("colors by the word's rung: new is cool, the climb greens, the summit is night", () => {
    expect(flavorForWord(0, false)).toBe("sky");
    expect(flavorForWord(1, false)).toBe("mint");
    expect(flavorForWord(2, false)).toBe("mint");
    expect(flavorForWord(3, false)).toBe("sand");
    expect(flavorForWord(4, false)).toBe("classic");
    expect(flavorForWord(5, false)).toBe("night");
  });

  it("paints a slipping word warm regardless of rung", () => {
    expect(flavorForWord(0, true)).toBe("rose");
    expect(flavorForWord(5, true)).toBe("rose");
  });

  it("every flavor it deals has card styles and a page wash", () => {
    for (const level of [0, 1, 2, 3, 4, 5]) {
      for (const slipping of [true, false]) {
        const flavor = flavorForWord(level, slipping);
        expect(FLAVOR_STYLES[flavor]).toBeDefined();
        expect(FLAVOR_WASHES[flavor]).toBeTruthy();
      }
    }
  });
});
