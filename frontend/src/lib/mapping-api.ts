export interface ColumnMetadata {
  name: string;
  data_type: "string" | "number" | "date" | "boolean";
  is_metadata?: boolean;
  total_count: number;
  non_null_count: number;
  null_count: number;
  null_rate: number;
  sample_values: (string | number)[];
}

export interface SchemaInfo {
  filename: string;
  sheet_name?: string;
  row_count: number;
  column_count: number;
  columns: ColumnMetadata[];
  preview_data: Record<string, any>[];
}

export interface CandidateMatch {
  source_column: string;
  score: number;
  confidence_pct: number;
}

export interface ColumnMapping {
  target_column: string;
  matched_source_column: string | null;
  confidence_score: number;
  confidence_pct: number;
  match_status: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "UNMATCHED";
  is_auto_mapped: boolean;
  default_value?: string | number | null;
  candidates: CandidateMatch[];
  ai_reasoning?: string;
  match_type?: string;
}

export interface AIAttributeMatch {
  target_column: string;
  matched_source_column: string | null;
  confidence_pct: number;
  match_type: "EXACT" | "SEMANTIC" | "METADATA_DERIVED" | "UNMATCHED";
  reasoning: string;
  suggested_default_value?: string | null;
}

export interface AIMatchResponse {
  matches: AIAttributeMatch[];
  overall_confidence: number;
  reasoning_summary: string;
}

export interface MockDatasetSummary {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface MockDatasetDetail {
  dataset_info: {
    id: string;
    title: string;
    description: string;
  };
  source_schema: SchemaInfo;
  target_schema: SchemaInfo;
  mappings: ColumnMapping[];
}

export interface TransformPayload {
  source_records: Record<string, any>[];
  target_columns: string[];
  column_mapping: Record<string, string | null>;
  default_values?: Record<string, any>;
  filename?: string;
}

export interface TransformResponse {
  row_count: number;
  column_count: number;
  columns: string[];
  data: Record<string, any>[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchMockDatasets(): Promise<MockDatasetSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/mapping/mock-datasets`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch mock datasets: HTTP ${res.status}`);
  }
  return res.json();
}

export async function loadMockDataset(
  datasetId: string
): Promise<MockDatasetDetail> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/mapping/mock-datasets/${datasetId}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to load dataset '${datasetId}': HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadExcelPair(
  sourceFile: File,
  targetFile: File
): Promise<{
  source_schema: SchemaInfo;
  target_schema: SchemaInfo;
  mappings: ColumnMapping[];
}> {
  const formData = new FormData();
  formData.append("source_file", sourceFile);
  formData.append("target_file", targetFile);

  const res = await fetch(`${API_BASE_URL}/api/v1/mapping/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed with HTTP ${res.status}`);
  }

  return res.json();
}

export async function runAIMapping(
  sourceSchema: SchemaInfo,
  targetSchema: SchemaInfo,
  customInstructions?: string,
  apiKeys?: string[],
  modelName: string = "openai/gpt-oss-120b"
): Promise<AIMatchResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/mapping/ai-match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_schema: sourceSchema,
      target_schema: targetSchema,
      custom_instructions: customInstructions && customInstructions.trim() ? customInstructions.trim() : undefined,
      api_keys: apiKeys && apiKeys.length > 0 ? apiKeys : undefined,
      model_name: modelName,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `AI Match failed: HTTP ${res.status}`);
  }

  return res.json();
}

export async function transformDataset(
  payload: TransformPayload
): Promise<TransformResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/mapping/transform`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Transformation failed: HTTP ${res.status}`);
  }

  return res.json();
}

export async function exportReplicaExcel(
  payload: TransformPayload
): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/v1/mapping/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Export failed: HTTP ${res.status}`);
  }

  return res.blob();
}
