
export interface DataRow {
  [key: string]: string | number | null | undefined;
}

export interface BenfordDataPoint {
  digit: number;
  actual: number; // percentage 0-100
  expected: number; // percentage 0-100
  count: number;
}

export interface HistogramBin {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  label: string;
}

export interface TimeSeriesPoint {
  date: string; // ISO string or formatted date
  amount: number;
  count: number;
}

export interface ScatterPoint {
  id: number; // rowIndex
  amount: number;
  index: number;
  isOutlier: boolean;
  zScore: number;
}

export interface EntityDataPoint {
  id: string; // Name of vendor/employee
  count: number; // Frequency
  totalAmount: number;
  averageAmount: number;
  isOutlier: boolean;
}

export interface HeatmapCell {
  day: string; // "Mon", "Tue"
  hour: number; // 0-23
  count: number;
  intensity: number; // 0-1 scale for coloring
}

// New: Pareto Data
export interface ParetoPoint {
  name: string;
  value: number;
  cumulativePercentage: number;
}

// New: Network/Sankey Data
export interface GraphNode {
  id: string;
  type: 'source' | 'target';
  value: number; // Total amount handled
}

export interface GraphLink {
  source: string;
  target: string;
  value: number; // Amount flowing between them
}

export type AnomalyType = 'Duplicate Record' | 'Duplicate Invoice ID' | 'Negative Amount' | 'Missing Value' | 'Statistical Outlier';

export interface Anomaly {
  rowIndex: number; // 1-based index from file
  type: AnomalyType;
  column: string;
  value: string | number | null | undefined;
  data: DataRow; // The full row for context
}

export interface AnalysisConfig {
  amountColumn: string;
  dateColumn?: string;
  categoryColumn?: string;
  sourceColumn?: string;
  invoiceColumn?: string;
}

export interface AnalysisResult {
  columnName: string;
  dateColumnName?: string;
  categoryColumnName?: string;
  sourceColumnName?: string;
  invoiceColumnName?: string; 
  totalRows: number;
  validRows: number;
  
  // Benford 1-Digit
  mad: number; // Mean Absolute Deviation
  conformity: 'Close' | 'Acceptable' | 'Marginally Acceptable' | 'Nonconformity';
  chartData: BenfordDataPoint[];

  // Benford 2-Digit
  mad2Digit: number;
  conformity2Digit: 'Close' | 'Acceptable' | 'Marginally Acceptable' | 'Nonconformity';
  chartData2Digit: BenfordDataPoint[];
  
  // Charts
  histogramData: HistogramBin[];
  timeSeriesData: TimeSeriesPoint[];
  scatterData: ScatterPoint[];
  
  // Advanced Charts
  entityData: EntityDataPoint[];
  heatmapData: HeatmapCell[];
  paretoData: ParetoPoint[]; 
  graphData: { nodes: GraphNode[], links: GraphLink[] }; 

  anomalies: Anomaly[];
  
  // Global Risk Assessment
  riskScore: number; // 0-100
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  
  stats: {
    duplicateCount: number;
    negativeCount: number;
    missingCount: number;
    outlierCount: number;
    totalAmount: number;
    averageAmount: number;
    highRiskEntities: number;
    topAnomalies: Anomaly[]; // The 5 most egregious rows for AI context
    totalAtRisk: number;
    forecastLoss: number;
    // New breakdown fields
    riskBreakdown: {
        outliers: number;
        duplicates: number;
        negatives: number;
    };
  };
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  SELECT_COLUMN = 'SELECT_COLUMN',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}
