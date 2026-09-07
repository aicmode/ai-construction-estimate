import { describe, expect, it } from "vitest";

import { estimateSchema } from "@/lib/validation/estimate";
import { projectSchema } from "@/lib/validation/project";

/**
 * Every form submission is validated twice with the same schema: once in the
 * browser by react-hook-form, and once again in the server action, which
 * receives the *output* of the first parse. Schemas that transform a value
 * (here: `"" -> null`) must therefore accept their own output, otherwise a
 * perfectly valid form is rejected server-side with an untranslated
 * "Invalid input" and the record is silently never created.
 */
function parseTwice<T extends { safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: unknown } }>(
  schema: T,
  input: unknown,
) {
  const first = schema.safeParse(input);
  expect(first.success, `first parse failed: ${JSON.stringify(first.error)}`).toBe(true);
  const second = schema.safeParse(first.data);
  return { first, second };
}

const projectBase = {
  name: "テスト案件",
  customerId: "11111111-2222-4333-8444-555555555555",
  workType: "reform",
  siteAddress: "",
  description: "",
  managerName: "",
  status: "planning",
  notes: "",
};

const estimateBase = {
  title: "テスト見積",
  customerId: "11111111-2222-4333-8444-555555555555",
  issueDate: "2026-09-07",
  status: "DRAFT",
  taxRate: 10,
  discountAmount: 0,
  paymentTerms: "",
  notes: "",
  items: [
    {
      name: "項目A",
      category: "other",
      description: "",
      quantity: 1,
      unit: "set",
      unitPrice: 1000,
      unitCost: 600,
    },
  ],
};

describe("schema round-trip (browser parse -> server parse)", () => {
  it("accepts a project with both optional dates left empty", () => {
    const { first, second } = parseTwice(projectSchema, {
      ...projectBase,
      scheduledStartDate: "",
      scheduledEndDate: "",
    });
    expect((first.data as { scheduledStartDate: unknown }).scheduledStartDate).toBeNull();
    expect(second.success).toBe(true);
  });

  it("accepts a project with both optional dates filled", () => {
    const { second } = parseTwice(projectSchema, {
      ...projectBase,
      scheduledStartDate: "2026-10-01",
      scheduledEndDate: "2026-10-20",
    });
    expect(second.success).toBe(true);
  });

  it("accepts an estimate with no project and no validity date", () => {
    const { first, second } = parseTwice(estimateSchema, {
      ...estimateBase,
      projectId: "",
      validUntil: "",
    });
    expect((first.data as { projectId: unknown }).projectId).toBeNull();
    expect(second.success).toBe(true);
  });

  it("accepts an estimate with a project and a validity date", () => {
    const { second } = parseTwice(estimateSchema, {
      ...estimateBase,
      projectId: "99999999-8888-4777-8666-555555555555",
      validUntil: "2026-10-07",
    });
    expect(second.success).toBe(true);
  });

  it("still rejects a genuinely malformed date", () => {
    expect(
      projectSchema.safeParse({ ...projectBase, scheduledStartDate: "2026/10/01", scheduledEndDate: "" })
        .success,
    ).toBe(false);
  });

  it("still rejects a genuinely malformed id", () => {
    expect(
      estimateSchema.safeParse({ ...estimateBase, projectId: "not-a-uuid", validUntil: "" }).success,
    ).toBe(false);
  });
});
