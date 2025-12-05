
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from '../types';

export const generateFraudReport = async (analysis: AnalysisResult): Promise<string> => {
  if (!process.env.API_KEY) {
    console.error("API Key not found");
    return "Error: API Key is missing. Please configure your environment.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert forensic accountant and fraud auditor (CFE).
    Analyze the following statistical data derived from a Benford's Law test, Outlier detection, Cluster Analysis, and Data Quality check on a financial dataset.
    
    Target Column: "${analysis.columnName}"
    Total Records: ${analysis.totalRows}
    Valid Numeric Records: ${analysis.validRows}
    Average Amount: ${analysis.stats.averageAmount.toFixed(2)}
    
    🚨 OVERALL FRAUD RISK SCORE: ${analysis.riskScore}/100 (${analysis.riskLevel}) 🚨
    
    Data Quality & Risk Flags:
    - Statistical Outliers (IQR Method): ${analysis.stats.outlierCount} records
    - Exact Duplicate Rows: ${analysis.stats.duplicateCount}
    - Negative Amounts: ${analysis.stats.negativeCount}
    - Missing/Null Values: ${analysis.stats.missingCount}
    
    Cluster Analysis (Entity Risk):
    - Category Used: ${analysis.categoryColumnName || 'None'}
    - High Risk Entities (Outliers in Frequency/Amount): ${analysis.stats.highRiskEntities}
    
    Timing Analysis:
    - Time Series Data Available: ${analysis.timeSeriesData.length > 0 ? 'Yes' : 'No'}
    - Heatmap Data (Day/Hour) Available: ${analysis.heatmapData.length > 0 ? 'Yes' : 'No'}

    Benford's Law Analysis:
    - 1-Digit MAD: ${analysis.mad.toFixed(4)} (${analysis.conformity})
    - 2-Digit MAD: ${analysis.mad2Digit.toFixed(4)} (${analysis.conformity2Digit})
    
    TOP 5 SPECIFIC SUSPICIOUS TRANSACTIONS (Investigate These):
    ${analysis.stats.topAnomalies.map(a => 
        `- Row ${a.rowIndex} (${a.type}): Value=${a.value}, Context=${JSON.stringify(a.data).slice(0, 150)}...`
    ).join('\n')}

    Please provide a concise but detailed "Fraud Risk Assessment" report in Markdown format.
    Include:
    1. **Executive Summary**: Start with the Risk Score and Risk Level. State clearly if the data looks manipulated.
    2. **Specific Anomalies**: **CRITICAL**: explicitly reference the "Top 5 Suspicious Transactions" listed above. Tell the auditor exactly which rows/invoices to pull.
    3. **Benford's Law Analysis**: Compare the 1-digit vs 2-digit results. (2-digit is more sensitive to invention).
    4. **Cluster & Entity Analysis**: If "High Risk Entities" > 0, discuss the risk of vendors/employees with unusual transaction frequencies or amounts.
    5. **Recommendations**: Actionable steps.
    
    Keep the tone professional, objective, and cautious.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Standard generation
      }
    });

    return response.text || "Unable to generate report.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while generating the AI report. Please check your network or API key.";
  }
};
