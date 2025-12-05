
import { DataRow, AnalysisResult, BenfordDataPoint, Anomaly, HistogramBin, TimeSeriesPoint, ScatterPoint, EntityDataPoint, HeatmapCell, ParetoPoint, GraphNode, GraphLink, AnalysisConfig } from '../types';

// Theoretical Benford's Law distribution for digits 1-9
const BENFORD_EXPECTED_1ST = [
  30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6
];

// Identify purely numeric columns (for Amount analysis)
export const getNumericColumns = (data: DataRow[]): string[] => {
  if (data.length === 0) return [];
  const headers = Object.keys(data[0]);
  return headers.filter(header => {
    const sample = data.slice(0, 10);
    const numericCount = sample.filter(row => {
      const val = row[header];
      return typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val.replace(/,/g, ''))));
    }).length;
    return numericCount / sample.length > 0.5;
  });
};

// Identify columns that contain numbers, even if alphanumeric (for Invoice ID Benford analysis)
export const getIdColumns = (data: DataRow[]): string[] => {
  if (data.length === 0) return [];
  const headers = Object.keys(data[0]);
  return headers.filter(header => {
    const sample = data.slice(0, 10);
    const hasDigitsCount = sample.filter(row => {
      const val = row[header];
      // Check if it contains any digit 1-9
      return val && String(val).match(/[1-9]/); 
    }).length;
    return hasDigitsCount / sample.length > 0.5;
  });
};

export const getDateColumns = (data: DataRow[]): string[] => {
  if (data.length === 0) return [];
  const headers = Object.keys(data[0]);
  return headers.filter(header => {
    const sample = data.slice(0, 10);
    const dateCount = sample.filter(row => {
      const val = row[header];
      // Basic check for Excel serial dates or date strings
      if (typeof val === 'number' && val > 30000 && val < 60000) return true; 
      if (typeof val === 'string' && !isNaN(Date.parse(val))) return true;
      return false;
    }).length;
    return dateCount / sample.length > 0.5;
  });
};

export const getCategoryColumns = (data: DataRow[]): string[] => {
  if (data.length === 0) return [];
  const headers = Object.keys(data[0]);
  return headers.filter(header => {
    const values = new Set();
    let validStrings = 0;
    const sample = data.slice(0, 50);
    
    sample.forEach(row => {
        if (typeof row[header] === 'string' || typeof row[header] === 'number') {
            values.add(row[header]);
            validStrings++;
        }
    });
    
    // It's a candidate if it's mostly present, but not ALL unique (likely a category like Vendor)
    return validStrings > 0 && values.size < sample.length * 0.9; 
  });
};

/**
 * Intelligent Auto-Detection of Columns
 * Uses Regex on headers and fallback to data types to guess best configuration.
 */
export const detectBestColumns = (data: DataRow[]): AnalysisConfig | null => {
    if (data.length === 0) return null;
    const headers = Object.keys(data[0]);

    // Helpers to find column by regex
    const findCol = (regex: RegExp, candidates: string[]) => candidates.find(h => regex.test(h));

    // 1. Detect Amount Column
    const numericCols = getNumericColumns(data);
    if (numericCols.length === 0) return null; // Cannot proceed without amount

    let amountCol = findCol(/(amount|total|value|price|cost|balance|debit|credit)/i, numericCols);
    if (!amountCol) {
        // Fallback: Pick the numeric column with highest variance or simply the last one (often totals are on right)
        amountCol = numericCols[numericCols.length - 1]; 
    }

    // 2. Detect Date Column
    const dateCols = getDateColumns(data);
    let dateCol = findCol(/(date|time|timestamp|created|posted)/i, dateCols);
    if (!dateCol && dateCols.length > 0) dateCol = dateCols[0];

    // 3. Detect Category (Vendor)
    const catCols = getCategoryColumns(data);
    let catCol = findCol(/(vendor|merchant|payee|description|category|type|party)/i, catCols);
    if (!catCol && catCols.length > 0) {
        // Exclude date/amount cols from being picked as category
        const safeCats = catCols.filter(c => c !== amountCol && c !== dateCol);
        if (safeCats.length > 0) catCol = safeCats[0];
    }

    // 4. Detect Source (Employee)
    let srcCol = findCol(/(employee|approver|user|creator|source|person|agent)/i, catCols);
    // Ensure source is not same as category
    if (srcCol === catCol) srcCol = undefined;

    // 5. Detect Invoice ID
    const idCols = getIdColumns(data);
    let invCol = findCol(/(invoice|ref|id|document|trans|number|ticket)/i, idCols);
    if (!invCol && idCols.length > 0) {
         // Try to find one that isn't the amount or date
         const safeIds = idCols.filter(c => c !== amountCol && c !== dateCol);
         if (safeIds.length > 0) invCol = safeIds[0];
    }

    return {
        amountColumn: amountCol,
        dateColumn: dateCol,
        categoryColumn: catCol,
        sourceColumn: srcCol,
        invoiceColumn: invCol
    };
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to extract the first non-zero digit from any string (e.g., "INV-2024" -> 2)
const extractLeadingDigit = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    const str = String(val);
    const match = str.match(/[1-9]/); // Find first non-zero digit
    if (match) {
        return parseInt(match[0], 10);
    }
    return null;
};

// Helper to extract first two digits (10-99)
const extractLeadingTwoDigits = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    const str = String(val).replace(/[^0-9]/g, ''); // Remove non-numeric
    // Remove leading zeros
    const cleanStr = str.replace(/^0+/, '');
    
    if (cleanStr.length >= 2) {
        return parseInt(cleanStr.substring(0, 2), 10);
    }
    return null;
};

export const performAnalysis = (
    data: DataRow[], 
    columnName: string, 
    dateColumnName?: string, 
    categoryColumnName?: string,
    sourceColumnName?: string,
    invoiceColumnName?: string
): AnalysisResult => {
  const digitCounts = new Array(9).fill(0); // 1-9
  const digitCounts2 = new Array(90).fill(0); // 10-99 (index 0 is 10)
  
  let validRows = 0;
  let totalAmount = 0;
  let benfordValidCount = 0;
  let benford2ValidCount = 0;
  
  const anomalies: Anomaly[] = [];
  const rowStrings = new Map<string, number[]>();
  const invoiceIdMap = new Map<string, number[]>(); // Map ID -> [RowIndices]
  const cleanValues: number[] = [];
  const scatterData: ScatterPoint[] = [];
  const timeSeriesMap = new Map<string, { amount: number, count: number }>();
  
  // For Entity Clustering (Target/Category)
  const entityMap = new Map<string, { count: number, total: number, amounts: number[] }>();
  
  // For Network Graph (Source -> Target)
  const networkNodes = new Map<string, { type: 'source'|'target', value: number }>();
  const networkLinks = new Map<string, number>(); 

  // For Heatmap (Day x Hour)
  const heatmapGrid = new Array(7).fill(0).map(() => new Array(24).fill(0));
  let hasTimeData = false;
  
  // For Forecast
  let minDate = Number.MAX_VALUE;
  let maxDate = Number.MIN_VALUE;

  // Track Risk: Map<RowIndex, Amount>
  const riskMap = new Map<number, number>();

  // 1. Main Pass
  data.forEach((row, index) => {
    const rowIndex = index + 1;
    const valRaw = row[columnName];
    
    // Check Missing
    if (valRaw === null || valRaw === undefined || valRaw === '') {
      anomalies.push({ rowIndex, type: 'Missing Value', column: columnName, value: 'NULL/EMPTY', data: row });
      return;
    }

    // Parse Value for Amount Statistics
    let val = typeof valRaw === 'string' ? parseFloat(valRaw.replace(/,/g, '')) : Number(valRaw);

    if (isNaN(val)) {
        anomalies.push({ rowIndex, type: 'Missing Value', column: columnName, value: valRaw, data: row });
        return;
    }

    // Check Negative
    if (val < 0) {
      anomalies.push({ rowIndex, type: 'Negative Amount', column: columnName, value: val, data: row });
      // Add to Risk Map
      riskMap.set(rowIndex, Math.abs(val));
    }

    // Valid for Stats
    validRows++;
    totalAmount += val;
    cleanValues.push(val);

    // Benford Analysis Logic
    const benfordSource = invoiceColumnName ? row[invoiceColumnName] : val;
    
    // 1-Digit
    const firstDigit = extractLeadingDigit(benfordSource);
    if (firstDigit !== null) {
      digitCounts[firstDigit - 1]++;
      benfordValidCount++;
    }

    // 2-Digit
    const firstTwoDigits = extractLeadingTwoDigits(benfordSource);
    if (firstTwoDigits !== null && firstTwoDigits >= 10 && firstTwoDigits <= 99) {
        digitCounts2[firstTwoDigits - 10]++;
        benford2ValidCount++;
    }

    // Exact Row Duplicate Check
    const rowStr = JSON.stringify(row);
    if (!rowStrings.has(rowStr)) {
        rowStrings.set(rowStr, [rowIndex]);
    } else {
        rowStrings.get(rowStr)?.push(rowIndex);
    }

    // Invoice ID Duplicate Check
    if (invoiceColumnName && row[invoiceColumnName]) {
        const idVal = String(row[invoiceColumnName]).trim();
        if (idVal) {
            if (!invoiceIdMap.has(idVal)) {
                invoiceIdMap.set(idVal, [rowIndex]);
            } else {
                invoiceIdMap.get(idVal)?.push(rowIndex);
            }
        }
    }

    // Entity Processing (Target/Category)
    if (categoryColumnName) {
        const entity = String(row[categoryColumnName] || 'Unknown');
        const curr = entityMap.get(entity) || { count: 0, total: 0, amounts: [] };
        curr.count++;
        curr.total += val;
        curr.amounts.push(val);
        entityMap.set(entity, curr);

        // Network Processing (Source -> Target)
        if (sourceColumnName) {
            const source = String(row[sourceColumnName] || 'Unknown Source');
            const target = entity;
            
            // Nodes
            const srcNode = networkNodes.get(source) || { type: 'source', value: 0 };
            srcNode.value += val;
            networkNodes.set(source, srcNode);

            const tgtNode = networkNodes.get(target) || { type: 'target', value: 0 };
            tgtNode.value += val;
            networkNodes.set(target, tgtNode); 
        }
    }

    // Network Links
    if (categoryColumnName && sourceColumnName) {
        const sourceVal = String(row[sourceColumnName] || 'Unknown');
        const targetVal = String(row[categoryColumnName] || 'Unknown');
        const linkKey = `${sourceVal}|${targetVal}`;
        networkLinks.set(linkKey, (networkLinks.get(linkKey) || 0) + val);
    }

    // Time Series & Heatmap Processing
    if (dateColumnName && row[dateColumnName]) {
        const dateVal = row[dateColumnName];
        try {
            let dateObj: Date | null = null;
            if (typeof dateVal === 'number') {
                 // Excel serial date
                 dateObj = new Date(Math.round((dateVal - 25569)*86400*1000));
            } else if (typeof dateVal === 'string') {
                dateObj = new Date(dateVal);
            }

            if (dateObj && !isNaN(dateObj.getTime())) {
                const time = dateObj.getTime();
                if (time < minDate) minDate = time;
                if (time > maxDate) maxDate = time;

                const dateKey = dateObj.toISOString().split('T')[0];
                const current = timeSeriesMap.get(dateKey) || { amount: 0, count: 0 };
                timeSeriesMap.set(dateKey, { amount: current.amount + val, count: current.count + 1 });

                const day = dateObj.getDay(); 
                const hour = dateObj.getHours(); 
                if (day >= 0 && day <= 6 && hour >= 0 && hour <= 23) {
                    heatmapGrid[day][hour]++;
                    hasTimeData = true;
                }
            }
        } catch (e) {
            // Ignore date parse errors
        }
    }
  });

  // 2. Outlier Analysis (IQR Method)
  cleanValues.sort((a, b) => a - b);
  const q1 = cleanValues[Math.floor(cleanValues.length * 0.25)];
  const q3 = cleanValues[Math.floor(cleanValues.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const mean = totalAmount / validRows;
  
  const variance = cleanValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / validRows;
  const stdDev = Math.sqrt(variance);

  data.forEach((row, index) => {
    const rowIndex = index + 1;
    const valRaw = row[columnName];
    let val = typeof valRaw === 'string' ? parseFloat(valRaw.replace(/,/g, '')) : Number(valRaw);
    
    if (!isNaN(val)) {
        const isOutlier = val < lowerBound || val > upperBound;
        const zScore = stdDev !== 0 ? (val - mean) / stdDev : 0;
        
        scatterData.push({
            id: rowIndex,
            index,
            amount: val,
            isOutlier,
            zScore
        });

        if (isOutlier) {
             anomalies.push({
                rowIndex,
                type: 'Statistical Outlier',
                column: columnName,
                value: val,
                data: row
             });
             // Add Outlier to Risk Map
             riskMap.set(rowIndex, Math.abs(val));
        }
    }
  });

  // 3. Histogram Generation
  const histogramData: HistogramBin[] = [];
  if (cleanValues.length > 0) {
      const min = cleanValues[0];
      const max = cleanValues[cleanValues.length - 1];
      const binCount = 10; 
      const binWidth = (max - min) / binCount;

      for (let i = 0; i < binCount; i++) {
          const start = min + (i * binWidth);
          const end = start + binWidth;
          const count = cleanValues.filter(v => v >= start && (i === binCount - 1 ? v <= end : v < end)).length;
          histogramData.push({
              rangeStart: start,
              rangeEnd: end,
              count,
              label: `${start.toFixed(0)}-${end.toFixed(0)}`
          });
      }
  }

  // 4. Time Series Formatting
  const timeSeriesData: TimeSeriesPoint[] = Array.from(timeSeriesMap.entries())
    .map(([date, data]) => ({ date, amount: data.amount, count: data.count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 5. Entity Data & Pareto
  const entityData: EntityDataPoint[] = [];
  let paretoData: ParetoPoint[] = [];
  
  if (categoryColumnName) {
      Array.from(entityMap.entries()).forEach(([id, stats]) => {
          const avg = stats.total / stats.count;
          const isOutlier = avg > upperBound || (stats.count > validRows * 0.1 && validRows > 50); 
          
          entityData.push({
              id,
              count: stats.count,
              totalAmount: stats.total,
              averageAmount: avg,
              isOutlier
          });
      });

      // Pareto Logic (80/20)
      const sortedEntities = [...entityData].sort((a, b) => b.totalAmount - a.totalAmount);
      let cumulative = 0;
      paretoData = sortedEntities.map(e => {
          cumulative += e.totalAmount;
          return {
              name: e.id,
              value: e.totalAmount,
              cumulativePercentage: (cumulative / totalAmount) * 100
          };
      });
      if (paretoData.length > 30) paretoData = paretoData.slice(0, 30);
  }

  // 6. Network/Graph Data Construction
  const graphNodes: GraphNode[] = [];
  const graphLinks: GraphLink[] = [];
  
  if (categoryColumnName && sourceColumnName) {
      const linksArr = Array.from(networkLinks.entries()).map(([key, val]) => {
          const [s, t] = key.split('|');
          return { source: s, target: t, value: val };
      }).sort((a, b) => b.value - a.value);

      const topLinks = linksArr.slice(0, 50); 
      const uniqueSources = new Set(topLinks.map(l => l.source));
      const uniqueTargets = new Set(topLinks.map(l => l.target));

      uniqueSources.forEach(s => graphNodes.push({ id: s, type: 'source', value: 0 }));
      uniqueTargets.forEach(t => graphNodes.push({ id: t, type: 'target', value: 0 }));
      
      topLinks.forEach(l => {
          graphLinks.push(l);
          const sNode = graphNodes.find(n => n.id === l.source && n.type === 'source');
          if (sNode) sNode.value += l.value;
          const tNode = graphNodes.find(n => n.id === l.target && n.type === 'target');
          if (tNode) tNode.value += l.value;
      });
  }

  // 7. Heatmap Data
  const heatmapData: HeatmapCell[] = [];
  if (hasTimeData) {
      let maxCount = 0;
      heatmapGrid.forEach(dayRow => dayRow.forEach(c => { if (c > maxCount) maxCount = c; }));
      
      heatmapGrid.forEach((dayRow, dayIdx) => {
          dayRow.forEach((count, hourIdx) => {
              if (maxCount > 0) {
                heatmapData.push({
                    day: DAYS[dayIdx],
                    hour: hourIdx,
                    count,
                    intensity: count / maxCount
                });
              }
          });
      });
  }

  // 8. Duplicate Analysis (Exact Rows)
  rowStrings.forEach((indices, _) => {
      if (indices.length > 1) {
          // Get value for risk calc
          const firstIdx = indices[0];
          const rowSample = data[firstIdx - 1];
          let val = typeof rowSample[columnName] === 'string' 
            ? parseFloat(String(rowSample[columnName]).replace(/,/g, '')) 
            : Number(rowSample[columnName]);
          const safeVal = isNaN(val) ? 0 : Math.abs(val);

          // Add to anomalies list
          indices.forEach(rowIndex => {
             anomalies.push({
                 rowIndex,
                 type: 'Duplicate Record',
                 column: '(Entire Row)',
                 value: 'Identical Data',
                 data: data[rowIndex - 1]
             });
          });

          // Risk Calculation for Duplicates: Count 'extra' copies as risk
          for (let i = 1; i < indices.length; i++) {
              riskMap.set(indices[i], safeVal);
          }
      }
  });

  // 8.5 Duplicate Invoice ID Analysis
  invoiceIdMap.forEach((indices, id) => {
      if (indices.length > 1) {
          for (let i = 0; i < indices.length; i++) {
              const rowIndex = indices[i];
              // Skip if already flagged as 'Duplicate Record' (exact duplicate)
              const isExactDup = anomalies.some(a => a.rowIndex === rowIndex && a.type === 'Duplicate Record');
              
              if (!isExactDup) {
                  const rowData = data[rowIndex - 1];
                  let val = typeof rowData[columnName] === 'string' 
                      ? parseFloat(String(rowData[columnName]).replace(/,/g, '')) 
                      : Number(rowData[columnName]);
                  const safeVal = isNaN(val) ? 0 : Math.abs(val);

                  anomalies.push({
                      rowIndex,
                      type: 'Duplicate Invoice ID',
                      column: invoiceColumnName!,
                      value: id,
                      data: rowData
                  });
                  
                  // Add to Risk Map (if it's not the first occurrence, it's a potential risk)
                  if (i > 0) {
                      riskMap.set(rowIndex, safeVal);
                  }
              }
          }
      }
  });

  // Calculate Total At Risk (Sum of unique rows in Risk Map)
  let totalAtRisk = 0;
  
  // Breakdown for tooltip
  let riskBreakdown = {
      outliers: 0,
      duplicates: 0,
      negatives: 0
  };

  riskMap.forEach((amount, rowIndex) => {
      totalAtRisk += amount;
      
      // Categorize the risk (Prioritize Outlier > Duplicate > Negative if overlap)
      const rowAnomalies = anomalies.filter(a => a.rowIndex === rowIndex);
      if (rowAnomalies.some(a => a.type === 'Statistical Outlier')) {
          riskBreakdown.outliers += amount;
      } else if (rowAnomalies.some(a => a.type.includes('Duplicate'))) {
          riskBreakdown.duplicates += amount;
      } else if (rowAnomalies.some(a => a.type === 'Negative Amount')) {
          riskBreakdown.negatives += amount;
      }
  });

  // Calculate Forecast Loss (Annualized)
  let forecastLoss = 0;
  if (totalAtRisk > 0) {
      if (hasTimeData && minDate < maxDate) {
          const dayDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);
          if (dayDiff > 1) {
              forecastLoss = (totalAtRisk / dayDiff) * 365;
          } else {
              forecastLoss = totalAtRisk; 
          }
      } else {
          forecastLoss = totalAtRisk * 12;
      }
  }

  // 9. Benford 1-Digit
  const chartData: BenfordDataPoint[] = digitCounts.map((count, index) => ({
    digit: index + 1,
    count,
    actual: benfordValidCount > 0 ? (count / benfordValidCount) * 100 : 0,
    expected: BENFORD_EXPECTED_1ST[index]
  }));

  // MAD Calculation 1-Digit
  let sumDeviations = 0;
  chartData.forEach(d => {
    sumDeviations += Math.abs((d.actual / 100) - (d.expected / 100));
  });
  const mad = sumDeviations / 9;

  let conformity: AnalysisResult['conformity'] = 'Nonconformity';
  if (mad <= 0.006) conformity = 'Close';
  else if (mad <= 0.012) conformity = 'Acceptable';
  else if (mad <= 0.015) conformity = 'Marginally Acceptable';

  // 10. Benford 2-Digit (10-99)
  const chartData2Digit: BenfordDataPoint[] = digitCounts2.map((count, index) => {
      const digit = index + 10;
      // Formula: log10(1 + 1/n)
      const expected = Math.log10(1 + 1/digit) * 100; 
      return {
          digit,
          count,
          actual: benford2ValidCount > 0 ? (count / benford2ValidCount) * 100 : 0,
          expected
      };
  });
  
  // MAD Calculation 2-Digit
  let sumDeviations2 = 0;
  chartData2Digit.forEach(d => {
      sumDeviations2 += Math.abs((d.actual / 100) - (d.expected / 100));
  });
  const mad2Digit = sumDeviations2 / 90;
  
  let conformity2Digit: AnalysisResult['conformity2Digit'] = 'Nonconformity';
  if (mad2Digit <= 0.0012) conformity2Digit = 'Close';
  else if (mad2Digit <= 0.0018) conformity2Digit = 'Acceptable';
  else if (mad2Digit <= 0.0022) conformity2Digit = 'Marginally Acceptable';


  // 11. Risk Score Calculation (0 - 100)
  // This is a heuristic scoring model
  let riskScore = 0;
  
  // Factor 1: Benford Conformity (Max 35)
  if (conformity === 'Nonconformity') riskScore += 25;
  else if (conformity === 'Marginally Acceptable') riskScore += 15;
  if (conformity2Digit === 'Nonconformity') riskScore += 10;

  // Factor 2: Outliers (Max 25)
  const outlierCount = anomalies.filter(a => a.type === 'Statistical Outlier').length;
  const outlierPercentage = validRows > 0 ? (outlierCount / validRows) : 0;
  if (outlierPercentage > 0.05) riskScore += 25; // More than 5% outliers is suspicious
  else if (outlierPercentage > 0.01) riskScore += 15;
  else if (outlierPercentage > 0) riskScore += 5;

  // Factor 3: Duplicates (Max 20)
  // Include both duplicate records AND duplicate IDs in count
  const duplicateCount = anomalies.filter(a => a.type === 'Duplicate Record' || a.type === 'Duplicate Invoice ID').length;
  const duplicatePercentage = validRows > 0 ? (duplicateCount / validRows) : 0;
  if (duplicatePercentage > 0.05) riskScore += 20;
  else if (duplicatePercentage > 0) riskScore += 10;

  // Factor 4: Round Numbers Spike (Max 20)
  // Simple check: do we have a huge number of values divisible by 1000?
  const roundNumbers = cleanValues.filter(v => v % 1000 === 0 && v !== 0).length;
  const roundPct = validRows > 0 ? (roundNumbers / validRows) : 0;
  if (roundPct > 0.1) riskScore += 20; // 10% of transactions are exact thousands
  else if (roundPct > 0.05) riskScore += 10;

  riskScore = Math.min(riskScore, 100);
  
  let riskLevel: AnalysisResult['riskLevel'] = 'Low';
  if (riskScore >= 75) riskLevel = 'Critical';
  else if (riskScore >= 50) riskLevel = 'High';
  else if (riskScore >= 25) riskLevel = 'Medium';

  // Sort anomalies by magnitude (value) for "Top Anomalies" to show AI
  const sortedAnomalies = [...anomalies].sort((a, b) => {
      const valA = typeof a.value === 'number' ? Math.abs(a.value) : 0;
      const valB = typeof b.value === 'number' ? Math.abs(b.value) : 0;
      return valB - valA;
  });

  return {
    columnName,
    dateColumnName,
    categoryColumnName,
    sourceColumnName,
    invoiceColumnName,
    totalRows: data.length,
    validRows,
    mad,
    conformity,
    chartData,
    mad2Digit,
    conformity2Digit,
    chartData2Digit,
    histogramData,
    timeSeriesData,
    scatterData,
    entityData,
    heatmapData,
    paretoData,
    graphData: { nodes: graphNodes, links: graphLinks },
    anomalies: anomalies.sort((a, b) => a.rowIndex - b.rowIndex),
    riskScore,
    riskLevel,
    stats: {
        duplicateCount,
        negativeCount: anomalies.filter(a => a.type === 'Negative Amount').length,
        missingCount: anomalies.filter(a => a.type === 'Missing Value').length,
        outlierCount: outlierCount,
        totalAmount,
        averageAmount: mean,
        highRiskEntities: entityData.filter(e => e.isOutlier).length,
        topAnomalies: sortedAnomalies.slice(0, 5), // Send top 5 to AI
        totalAtRisk,
        forecastLoss,
        riskBreakdown
    }
  };
};
