import { z } from "zod";

import { FINDING_CATEGORIES, FINDING_SEVERITIES } from "@/lib/domain";

/** A single actionable observation about an estimate. */
export interface ReviewFinding {
  id: string;
  source: "rule" | "ai";
  severity: (typeof FINDING_SEVERITIES)[number];
  category: (typeof FINDING_CATEGORIES)[number];
  title: string;
  description: string;
  recommendedAction: string;
  /** Line item this finding points at, when it is item specific. */
  itemName: string | null;
}

export interface ReviewMetrics {
  itemCount: number;
  itemsSubtotal: number;
  subtotalAmount: number;
  totalAmount: number;
  costAmount: number;
  grossProfit: number;
  grossMarginRate: number;
  discountRate: number;
  zeroCostItemCount: number;
  zeroQuantityItemCount: number;
  belowCostItemCount: number;
  largestItemShare: number;
  topCategoryShare: number;
}

export interface ReviewResult {
  source: "rule" | "hybrid";
  model: string;
  summary: string;
  findings: ReviewFinding[];
  metrics: ReviewMetrics;
  /** Human readable reason the AI layer did not contribute, if it did not. */
  aiError: string | null;
  aiConfigured: boolean;
}

/**
 * Schema applied to whatever the AI provider returns. The model's output is
 * never trusted: unknown fields are dropped, strings are length-capped, and a
 * malformed payload degrades to "AI unavailable" rather than reaching the UI.
 */
export const aiFindingSchema = z.object({
  severity: z.enum(FINDING_SEVERITIES),
  category: z.enum(FINDING_CATEGORIES),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(600),
  recommendedAction: z.string().trim().max(400).default(""),
  itemName: z.string().trim().max(160).nullish().transform((value) => value ?? null),
});

export const aiResponseSchema = z.object({
  summary: z.string().trim().max(800).default(""),
  findings: z.array(aiFindingSchema).max(12).default([]),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;
