import { describe, expect, it } from "vitest";

import { splitItems } from "../split";
import type { Item, Person } from "../../types";

const createPerson = (id: string, weight: number): Person => ({
  id,
  name: id.toUpperCase(),
  weight,
  color: "#000000",
});

const options = {
  mode: "half-up" as const,
  roundToTenCents: false,
  currency: "SGD" as const,
};

describe("splitItems", () => {
  it("splits unassigned items according to percentage weights where no explicit assignments exist", () => {
    const persons = [createPerson("a", 60), createPerson("b", 40)];
    const items: Item[] = [
      { id: "1", name: "Item 1", qty: 1, unitPrice: 30, assignments: [] },
      { id: "2", name: "Item 2", qty: 1, unitPrice: 20, assignments: [] },
    ];

    const breakdown = splitItems(items, persons, 0, 0, options);
    const [first, second] = breakdown.perPerson;

    expect(first.items).toBeCloseTo(30, 2);
    expect(second.items).toBeCloseTo(20, 2);
    expect(first.total + second.total).toBeCloseTo(50, 2);
  });

  it("respects explicit assignments while splitting remaining items by percentage weights", () => {
    const persons = [createPerson("a", 50), createPerson("b", 50)];
    const items: Item[] = [
      {
        id: "1",
        name: "Assigned only",
        qty: 1,
        unitPrice: 41.2,
        assignments: [{ personId: "a" }],
      },
      { id: "2", name: "Shared 1", qty: 1, unitPrice: 42.52, assignments: [] },
      { id: "3", name: "Shared 2", qty: 1, unitPrice: 2.51, assignments: [] },
    ];

    const breakdown = splitItems(items, persons, 0, 0, options);
    const [first, second] = breakdown.perPerson;

    expect(first.items).toBeCloseTo(63.71, 2);
    expect(second.items).toBeCloseTo(22.52, 2);
    expect(first.total + second.total).toBeCloseTo(86.23, 2);
  });

  it("applies service charge and tax after item allocation", () => {
    const persons = [createPerson("a", 70), createPerson("b", 30)];
    const items: Item[] = [
      { id: "1", name: "Shared", qty: 1, unitPrice: 100, assignments: [] },
    ];

    const breakdown = splitItems(items, persons, 0.1, 0.08, options);
    const [first, second] = breakdown.perPerson;

    expect(first.items).toBeCloseTo(70, 2);
    expect(second.items).toBeCloseTo(30, 2);

    expect(first.total + second.total).toBeCloseTo(breakdown.grandTotal, 2);
    expect(breakdown.grandTotal).toBeCloseTo(100 * 1.1 * 1.08, 2);
  });
});
