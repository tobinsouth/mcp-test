import { z } from "zod";

/**
 * Result of evaluating expectations
 */
export const ExpectationResultSchema = z.object({
  /** Whether all expectations were met */
  passed: z.boolean(),
  /** Expected tool calls that were found */
  matched: z.array(
    z.object({
      toolName: z.string(),
      arguments: z.record(z.unknown()).optional(),
    })
  ),
  /** Expected tool calls that were missing */
  missing: z.array(
    z.object({
      toolName: z.string(),
      argumentsContain: z.record(z.unknown()).optional(),
    })
  ),
  /** Details about the evaluation */
  details: z.string().optional(),
});

export type ExpectationResult = z.infer<typeof ExpectationResultSchema>;

/**
 * Safety policy violation
 */
export const SafetyViolationSchema = z.object({
  /** ID of the violated policy */
  policyId: z.string(),
  /** Severity of the violation */
  severity: z.enum(["critical", "high", "medium", "low"]),
  /** Description of the violation */
  description: z.string(),
  /** Evidence supporting the violation */
  evidence: z.string().optional(),
});

export type SafetyViolation = z.infer<typeof SafetyViolationSchema>;

/**
 * Result of safety review
 */
export const SafetyReviewResultSchema = z.object({
  /** Whether all policies passed */
  passed: z.boolean(),
  /** Violations found */
  violations: z.array(SafetyViolationSchema),
  /** Model used for review */
  reviewModel: z.string(),
});

export type SafetyReviewResult = z.infer<typeof SafetyReviewResultSchema>;

/**
 * Quality assessment result
 */
export const QualityAssessmentSchema = z.object({
  /** Overall quality rating */
  overallQuality: z.enum(["high", "medium", "low"]),
  /** Whether the interaction completed successfully */
  completedSuccessfully: z.boolean(),
  /** Whether tool usage was appropriate */
  appropriateToolUsage: z.boolean(),
  /** Issues found during assessment */
  issues: z.array(z.string()),
  /** Recommendations for improvement */
  recommendations: z.array(z.string()),
});

export type QualityAssessment = z.infer<typeof QualityAssessmentSchema>;
