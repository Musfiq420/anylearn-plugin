import { describe, expect, it } from "vitest";
import { calc, checkFormula, parse } from "../expr";

describe("formula engine", () => {
  it("does arithmetic with precedence", () => {
    expect(calc("1 + 2 * 3", {})).toBe(7);
    expect(calc("(1 + 2) * 3", {})).toBe(9);
    expect(calc("2 ^ 3 ^ 2", {})).toBe(512);
    expect(calc("-2 ^ 2", {})).toBe(-4);
    expect(calc("10 % 4", {})).toBe(2);
  });
  it("uses variables, constants and functions", () => {
    expect(calc("25 * (1 - exp(-light / 25))", { light: 0 })).toBe(0);
    expect(calc("sin(pi / 2)", {})).toBeCloseTo(1);
    expect(calc("max(a, b, 3)", { a: 1, b: 2 })).toBe(3);
    expect(calc("clamp(x, 0, 10)", { x: 42 })).toBe(10);
    expect(calc("1.5e3 + .5", {})).toBe(1500.5);
  });
  it("evaluates conditions", () => {
    expect(calc("light >= 70", { light: 80 })).toBe(1);
    expect(calc("light >= 70 && light <= 90", { light: 95 })).toBe(0);
    expect(calc("!(x > 1) || y == 2", { x: 5, y: 2 })).toBe(1);
  });
  it("refuses anything that isn't math", () => {
    expect(() => parse("alert(1)")).toThrow(/unknown function/);
    expect(() => parse("constructor.constructor('x')()")).toThrow();
    expect(() => parse("a.b")).toThrow(/unexpected character/);
    expect(() => parse("a = 1")).toThrow(/unexpected character/);
    expect(() => parse("1 +")).toThrow();
    expect(calc("x + 1", {})).toBeNaN();
  });
  it("reports undeclared variables", () => {
    expect(checkFormula("a * b", ["a"])).toMatch(/"b"/);
    expect(checkFormula("a * 2", ["a"])).toBeNull();
    expect(checkFormula("sqr(a)", ["a"])).toMatch(/unknown function/);
  });
});
