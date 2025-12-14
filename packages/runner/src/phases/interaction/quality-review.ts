import type Anthropic from "@anthropic-ai/sdk";
import type { TestCheck, Transcript, Expectation } from "@mcp-qa/types";

/**
 * Review a transcript for quality using an LLM.
 */
export async function reviewQuality(
  transcript: Transcript,
  expectations: Expectation | undefined,
  model: string,
  anthropic: Anthropic,
  pushCheck: (check: TestCheck) => void
): Promise<void> {
  const prompt = `Analyze this interaction transcript for quality.

Transcript:
${JSON.stringify(transcript, null, 2)}

${expectations?.customValidation ? `Custom validation criteria: ${expectations.customValidation}` : ""}

Evaluate:
1. Did the interaction complete successfully?
2. Were tool calls appropriate for the task?
3. Was the final response helpful and accurate?
4. Were there any errors or issues?

Respond in JSON format:
{
  "overallQuality": "high" | "medium" | "low",
  "completedSuccessfully": true/false,
  "appropriateToolUsage": true/false,
  "issues": ["list of issues if any"],
  "recommendations": ["improvement suggestions"]
}`;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as {
        overallQuality: "high" | "medium" | "low";
        completedSuccessfully: boolean;
        appropriateToolUsage: boolean;
        issues: string[];
        recommendations: string[];
      };

      pushCheck({
        id: "quality-overall",
        name: "Quality Assessment",
        description: `Overall quality: ${result.overallQuality}`,
        status:
          result.overallQuality === "high"
            ? "SUCCESS"
            : result.overallQuality === "medium"
              ? "WARNING"
              : "FAILURE",
        timestamp: new Date().toISOString(),
        details: {
          completedSuccessfully: result.completedSuccessfully,
          appropriateToolUsage: result.appropriateToolUsage,
          issues: result.issues,
          recommendations: result.recommendations,
        },
      });
    }
  } catch (error) {
    pushCheck({
      id: "quality-review-failed",
      name: "Quality Review",
      description: "Failed to complete quality review",
      status: "WARNING",
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
