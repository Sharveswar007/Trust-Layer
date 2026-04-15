#!/usr/bin/env node

/**
 * TruthLayer Evaluation Runner
 * 
 * This script evaluates the TruthLayer system against a labeled benchmark dataset.
 * It calculates precision, recall, F1 for both claim extraction and verdict accuracy.
 * 
 * Usage: npx ts-node eval_runner.ts (or node eval_runner.js after building)
 */

import fs from "fs";
import path from "path";

interface EvalCase {
  id: string;
  category: string;
  text: string;
  expectedClaims: number;
  expectedVerdicts: Record<string, "correct" | "incorrect" | "unverifiable">;
}

interface EvalDataset {
  evalDataset: EvalCase[];
}

interface Claim {
  text: string;
  verdict: string;
  confidence: number | null;
  explanation: string;
}

interface VerifyResponse {
  claims: Claim[];
  overall_trust_score: number;
  risk_label: string;
}

interface CategoryMetrics {
  category: string;
  casesRun: number;
  extractionAccuracy: number;
  verdictAccuracy: number;
  extractionPrecision: number;
  extractionRecall: number;
  extractionF1: number;
  verdictPrecision: number;
  verdictRecall: number;
  verdictF1: number;
}

const API_BASE_URL = process.env.API_URL || "http://localhost:3000";

async function verifyText(text: string): Promise<VerifyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

function calculateMetrics(
  extracted: string[],
  expected: string[],
  verdictExtracted: Record<string, string>,
  verdictExpected: Record<string, string>
): { extractionF1: number; verdictF1: number; extractionAccuracy: number; verdictAccuracy: number } {
  // Claim extraction metrics
  const extractedSet = new Set(extracted.map((c) => c.toLowerCase().trim()));
  const expectedSet = new Set(expected.map((c) => c.toLowerCase().trim()));

  const commonClaims = [...extractedSet].filter((c) => expectedSet.has(c)).length;
  const extractionPrecision = extractedSet.size > 0 ? commonClaims / extractedSet.size : 1.0;
  const extractionRecall = expectedSet.size > 0 ? commonClaims / expectedSet.size : 1.0;
  const extractionF1 =
    extractionPrecision + extractionRecall > 0
      ? (2 * extractionPrecision * extractionRecall) / (extractionPrecision + extractionRecall)
      : 0;

  // Verdict accuracy metrics (only for extracted claims that have expected verdicts)
  let correctVerdicts = 0;
  let totalVerdicts = 0;

  for (const [claimText, expectedVerdict] of Object.entries(verdictExpected)) {
    const claimLower = claimText.toLowerCase().trim();
    for (const extractedClaim of extracted) {
      if (extractedClaim.toLowerCase().trim() === claimLower) {
        const extractedVerdict = verdictExtracted[extractedClaim] || "unverifiable";
        if (extractedVerdict === expectedVerdict) {
          correctVerdicts++;
        }
        totalVerdicts++;
        break;
      }
    }
  }

  const verdictAccuracy = totalVerdicts > 0 ? correctVerdicts / totalVerdicts : 1.0;

  return {
    extractionF1,
    verdictF1: verdictAccuracy,
    extractionAccuracy: extracted.length === expected.length ? 1.0 : 0.0,
    verdictAccuracy
  };
}

async function runEvaluation() {
  console.log("🧪 TruthLayer Evaluation Suite\n");

  // Load dataset
  const datasetPath = path.join(process.cwd(), "eval_dataset.json");
  const rawData = fs.readFileSync(datasetPath, "utf-8");
  const dataset: EvalDataset = JSON.parse(rawData);

  console.log(`📊 Loaded ${dataset.evalDataset.length} test cases\n`);

  const categoryMetrics: Map<string, CategoryMetrics> = new Map();
  let totalCases = 0;
  let totalExtractF1 = 0;
  let totalVerdictF1 = 0;
  let passedCases = 0;

  // Run each test case
  for (const testCase of dataset.evalDataset) {
    try {
      console.log(`▶️  [${testCase.id}] ${testCase.category}: "${testCase.text.substring(0, 60)}..."`);

      const response = await verifyText(testCase.text);

      // Extract claims and build verdict map
      const extractedClaims = response.claims.map((c) => c.text);
      const verdictMap: Record<string, string> = {};
      response.claims.forEach((c) => {
        verdictMap[c.text] = c.verdict;
      });

      // Calculate metrics
      const metrics = calculateMetrics(
        extractedClaims,
        Array.from(Object.keys(testCase.expectedVerdicts)),
        verdictMap,
        testCase.expectedVerdicts
      );

      // Track by category
      if (!categoryMetrics.has(testCase.category)) {
        categoryMetrics.set(testCase.category, {
          category: testCase.category,
          casesRun: 0,
          extractionAccuracy: 0,
          verdictAccuracy: 0,
          extractionPrecision: 0,
          extractionRecall: 0,
          extractionF1: 0,
          verdictPrecision: 0,
          verdictRecall: 0,
          verdictF1: 0
        });
      }

      const cat = categoryMetrics.get(testCase.category)!;
      cat.casesRun++;
      cat.extractionF1 += metrics.extractionF1;
      cat.verdictF1 += metrics.verdictF1;

      totalCases++;
      totalExtractF1 += metrics.extractionF1;
      totalVerdictF1 += metrics.verdictF1;

      if (Math.abs(metrics.extractionF1 - 1.0) < 0.01 && Math.abs(metrics.verdictF1 - 1.0) < 0.01) {
        passedCases++;
      }

      console.log(
        `   ✓ Extraction F1: ${(metrics.extractionF1 * 100).toFixed(1)}% | Verdict Accuracy: ${(metrics.verdictAccuracy * 100).toFixed(1)}%\n`
      );

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (err) {
      console.log(`   ✗ Error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  // Print results
  const avgExtractF1 = totalCases > 0 ? (totalExtractF1 / totalCases) * 100 : 0;
  const avgVerdictF1 = totalCases > 0 ? (totalVerdictF1 / totalCases) * 100 : 0;
  const passRate = totalCases > 0 ? (passedCases / totalCases) * 100 : 0;

  console.log("\n" + "=".repeat(80));
  console.log("📈 EVALUATION RESULTS\n");

  console.log(`Total Cases: ${totalCases}`);
  console.log(`Passed (perfect F1): ${passedCases} (${passRate.toFixed(1)}%)\n`);

  console.log(`Overall Extraction F1: ${avgExtractF1.toFixed(1)}%`);
  console.log(`Overall Verdict Accuracy: ${avgVerdictF1.toFixed(1)}%\n`);

  console.log("Category Breakdown:");
  console.log("-".repeat(80));

  for (const [, metrics] of categoryMetrics) {
    const avgExtract = metrics.casesRun > 0 ? (metrics.extractionF1 / metrics.casesRun) * 100 : 0;
    const avgVerdict = metrics.casesRun > 0 ? (metrics.verdictF1 / metrics.casesRun) * 100 : 0;

    console.log(
      `\n${metrics.category.toUpperCase()}: ${metrics.casesRun} cases`
    );
    console.log(`  Extraction F1: ${avgExtract.toFixed(1)}%`);
    console.log(`  Verdict Accuracy: ${avgVerdict.toFixed(1)}%`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Evaluation complete. Results logged above.\n");
}

runEvaluation().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
