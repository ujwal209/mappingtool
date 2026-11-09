"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  fetchMockDatasets,
  loadMockDataset,
  uploadExcelPair,
  transformDataset,
  exportReplicaExcel,
  runAIMapping,
  type SchemaInfo,
  type ColumnMapping,
  type MockDatasetSummary,
  type TransformResponse,
} from "@/lib/mapping-api";
import { type ColumnDef } from "@/components/excel-grid-editor";

interface MappingContextType {
  mockSummaries: MockDatasetSummary[];
  selectedMockId: string;
  sourceFilename: string;
  targetFilename: string;
  sourceColumns: ColumnDef[];
  sourceRows: Record<string, any>[];
  targetColumns: ColumnDef[];
  targetRows: Record<string, any>[];
  mappings: ColumnMapping[];
  userOverrides: Record<string, string | null>;
  defaultValues: Record<string, string>;
  replicaData: TransformResponse | null;
  aiLoading: boolean;
  aiReasoningSummary: string | null;
  aiCustomPrompt: string;
  setAiCustomPrompt: (prompt: string) => void;
  groqApiKeys: string[];
  selectedModel: string;
  isLoading: boolean;
  errorMessage: string | null;
  transformLoading: boolean;
  exportLoading: boolean;
  mappingStats: {
    total: number;
    mapped: number;
    unmapped: number;
    percentage: number;
    metadataCount: number;
  };
  handleLoadMock: (id: string) => Promise<void>;
  handleRunAIMapping: () => Promise<void>;
  handleSourceGridChange: (updatedCols: ColumnDef[], updatedRows: Record<string, any>[]) => void;
  handleTargetGridChange: (updatedCols: ColumnDef[], updatedRows: Record<string, any>[]) => void;
  handleMappingChange: (targetCol: string, sourceCol: string | null) => void;
  handleDefaultValueChange: (targetCol: string, val: string) => void;
  handleExportExcel: () => Promise<void>;
  handleUpload: (sourceFile: File, targetFile: File) => Promise<void>;
  setGroqApiKeys: (keys: string[]) => void;
  setSelectedModel: (model: string) => void;
}

const MappingContext = createContext<MappingContextType | undefined>(undefined);

export function MappingProvider({ children }: { children: React.ReactNode }) {
  const [mockSummaries, setMockSummaries] = useState<MockDatasetSummary[]>([]);
  const [selectedMockId, setSelectedMockId] = useState<string>("crm_contacts");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable Spreadsheet Grid State
  const [sourceFilename, setSourceFilename] = useState("source_dataset.xlsx");
  const [targetFilename, setTargetFilename] = useState("target_template.xlsx");
  const [sourceColumns, setSourceColumns] = useState<ColumnDef[]>([]);
  const [sourceRows, setSourceRows] = useState<Record<string, any>[]>([]);
  const [targetColumns, setTargetColumns] = useState<ColumnDef[]>([]);
  const [targetRows, setTargetRows] = useState<Record<string, any>[]>([]);

  // Mapping state
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [userOverrides, setUserOverrides] = useState<Record<string, string | null>>({});
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>({});

  // Output & AI state
  const [replicaData, setReplicaData] = useState<TransformResponse | null>(null);
  const [transformLoading, setTransformLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoningSummary, setAiReasoningSummary] = useState<string | null>(null);
  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>("");

  // Groq API Configuration
  const [groqApiKeys, setGroqApiKeys] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("atlas_groq_keys");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("atlas_groq_model") || "openai/gpt-oss-120b";
    }
    return "openai/gpt-oss-120b";
  });

  // Save to local storage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("atlas_groq_keys", JSON.stringify(groqApiKeys));
    }
  }, [groqApiKeys]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("atlas_groq_model", selectedModel);
    }
  }, [selectedModel]);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const list = await fetchMockDatasets();
        setMockSummaries(list);
        if (list.length > 0) {
          handleLoadMock(list[0].id);
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Backend connection error. Make sure the backend server is running and reachable."
        );
      }
    }
    init();
  }, []);

  const executeTransformation = async (
    records: Record<string, any>[],
    targetCols: string[],
    mappingDict: Record<string, string | null>,
    defaultsDict: Record<string, any>
  ) => {
    if (!records || records.length === 0 || !targetCols || targetCols.length === 0)
      return;

    setTransformLoading(true);
    try {
      const result = await transformDataset({
        source_records: records,
        target_columns: targetCols,
        column_mapping: mappingDict,
        default_values: defaultsDict,
      });
      setReplicaData(result);
    } catch (err: unknown) {
      console.error("Transformation failed", err);
    } finally {
      setTransformLoading(false);
    }
  };

  const handleLoadMock = async (id: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedMockId(id);
    try {
      const data = await loadMockDataset(id);

      setSourceFilename(data.source_schema.filename);
      setTargetFilename(data.target_schema.filename);

      const sCols: ColumnDef[] = data.source_schema.columns.map((c) => ({
        name: c.name,
        data_type: c.data_type,
        is_metadata:
          c.name.toLowerCase().startsWith("meta_") ||
          c.name.toLowerCase().startsWith("_") ||
          c.name.toLowerCase().includes("audit") ||
          c.name.toLowerCase().includes("checksum") ||
          c.name.toLowerCase().includes("classification"),
      }));

      const tCols: ColumnDef[] = data.target_schema.columns.map((c) => ({
        name: c.name,
        data_type: c.data_type,
        is_metadata:
          c.name.toLowerCase().startsWith("meta_") ||
          c.name.toLowerCase().startsWith("_") ||
          c.name.toLowerCase().includes("audit") ||
          c.name.toLowerCase().includes("checksum") ||
          c.name.toLowerCase().includes("governance") ||
          c.name.toLowerCase().includes("source system"),
      }));

      setSourceColumns(sCols);
      setSourceRows(data.source_schema.preview_data);
      setTargetColumns(tCols);
      setTargetRows(data.target_schema.preview_data);
      setMappings(data.mappings);

      const initialOverrides: Record<string, string | null> = {};
      const initialDefaults: Record<string, string> = {};

      data.mappings.forEach((m) => {
        initialOverrides[m.target_column] = m.matched_source_column;
        if (m.default_value !== undefined && m.default_value !== null) {
          initialDefaults[m.target_column] = String(m.default_value);
        }
      });

      setUserOverrides(initialOverrides);
      setDefaultValues(initialDefaults);

      executeTransformation(
        data.source_schema.preview_data,
        tCols.map((c) => c.name),
        initialOverrides,
        initialDefaults
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load dataset"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Run AI Mapping via Groq & LangGraph
  const handleRunAIMapping = async (customPromptOverride?: string) => {
    if (sourceColumns.length === 0 || targetColumns.length === 0) return;

    setAiLoading(true);
    setErrorMessage(null);
    try {
      const sSchema: SchemaInfo = {
        filename: sourceFilename,
        row_count: sourceRows.length,
        column_count: sourceColumns.length,
        columns: sourceColumns.map((c) => ({
          name: c.name,
          data_type: c.data_type as any,
          is_metadata: c.is_metadata,
          total_count: sourceRows.length,
          non_null_count: sourceRows.length,
          null_count: 0,
          null_rate: 0,
          sample_values: sourceRows.map((r) => r[c.name]).filter((v) => v !== null && v !== undefined).slice(0, 3),
        })),
        preview_data: sourceRows.slice(0, 10),
      };

      const tSchema: SchemaInfo = {
        filename: targetFilename,
        row_count: targetRows.length,
        column_count: targetColumns.length,
        columns: targetColumns.map((c) => ({
          name: c.name,
          data_type: c.data_type as any,
          is_metadata: c.is_metadata,
          total_count: targetRows.length,
          non_null_count: targetRows.length,
          null_count: 0,
          null_rate: 0,
          sample_values: targetRows.map((r) => r[c.name]).filter((v) => v !== null && v !== undefined).slice(0, 2),
        })),
        preview_data: targetRows.slice(0, 5),
      };

      const promptToUse =
        customPromptOverride !== undefined ? customPromptOverride : aiCustomPrompt;

      const aiResult = await runAIMapping(
        sSchema,
        tSchema,
        promptToUse,
        groqApiKeys,
        selectedModel
      );

      setAiReasoningSummary(aiResult.reasoning_summary);

      // Apply AI mappings
      const nextOverrides: Record<string, string | null> = { ...userOverrides };
      const nextDefaults: Record<string, string> = { ...defaultValues };

      const updatedMappings: ColumnMapping[] = targetColumns.map((tc) => {
        const aiMatch = aiResult.matches.find((m) => m.target_column === tc.name);
        const matchedSource = aiMatch?.matched_source_column || null;
        const confidencePct = aiMatch?.confidence_pct || 0;
        const defaultVal = aiMatch?.suggested_default_value || defaultValues[tc.name] || "";

        nextOverrides[tc.name] = matchedSource;
        if (defaultVal) {
          nextDefaults[tc.name] = defaultVal;
        }

        return {
          target_column: tc.name,
          matched_source_column: matchedSource,
          confidence_score: confidencePct / 100,
          confidence_pct: confidencePct,
          match_status:
            confidencePct >= 85
              ? "HIGH_CONFIDENCE"
              : confidencePct >= 50
              ? "MEDIUM_CONFIDENCE"
              : "UNMATCHED",
          is_auto_mapped: matchedSource !== null,
          default_value: defaultVal,
          ai_reasoning: aiMatch?.reasoning,
          match_type: aiMatch?.match_type,
          candidates: sourceColumns.map((sc) => ({
            source_column: sc.name,
            score: sc.name === matchedSource ? confidencePct / 100 : 0.2,
            confidence_pct: sc.name === matchedSource ? confidencePct : 20,
          })),
        };
      });

      setMappings(updatedMappings);
      setUserOverrides(nextOverrides);
      setDefaultValues(nextDefaults);

      executeTransformation(
        sourceRows,
        targetColumns.map((c) => c.name),
        nextOverrides,
        nextDefaults
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI Attribute Mapping failed";
      setErrorMessage(msg);
      console.error("AI Mapping error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSourceGridChange = (
    updatedCols: ColumnDef[],
    updatedRows: Record<string, any>[]
  ) => {
    setSourceColumns(updatedCols);
    setSourceRows(updatedRows);

    executeTransformation(
      updatedRows,
      targetColumns.map((c) => c.name),
      userOverrides,
      defaultValues
    );
  };

  const handleTargetGridChange = (
    updatedCols: ColumnDef[],
    updatedRows: Record<string, any>[]
  ) => {
    setTargetColumns(updatedCols);
    setTargetRows(updatedRows);

    executeTransformation(
      sourceRows,
      updatedCols.map((c) => c.name),
      userOverrides,
      defaultValues
    );
  };

  const handleMappingChange = (targetCol: string, sourceCol: string | null) => {
    const nextOverrides = {
      ...userOverrides,
      [targetCol]: sourceCol,
    };
    setUserOverrides(nextOverrides);

    executeTransformation(
      sourceRows,
      targetColumns.map((c) => c.name),
      nextOverrides,
      defaultValues
    );
  };

  const handleDefaultValueChange = (targetCol: string, val: string) => {
    const nextDefaults = {
      ...defaultValues,
      [targetCol]: val,
    };
    setDefaultValues(nextDefaults);

    executeTransformation(
      sourceRows,
      targetColumns.map((c) => c.name),
      userOverrides,
      nextDefaults
    );
  };

  const handleUpload = async (sourceFile: File, targetFile: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await uploadExcelPair(sourceFile, targetFile);

      setSourceFilename(res.source_schema.filename);
      setTargetFilename(res.target_schema.filename);

      const sCols: ColumnDef[] = res.source_schema.columns.map((c) => ({
        name: c.name,
        data_type: c.data_type,
        is_metadata:
          c.name.toLowerCase().startsWith("meta_") ||
          c.name.toLowerCase().startsWith("_") ||
          c.name.toLowerCase().includes("audit"),
      }));

      const tCols: ColumnDef[] = res.target_schema.columns.map((c) => ({
        name: c.name,
        data_type: c.data_type,
        is_metadata:
          c.name.toLowerCase().startsWith("meta_") ||
          c.name.toLowerCase().startsWith("_") ||
          c.name.toLowerCase().includes("audit"),
      }));

      setSourceColumns(sCols);
      setSourceRows(res.source_schema.preview_data);
      setTargetColumns(tCols);
      setTargetRows(res.target_schema.preview_data);
      setMappings(res.mappings);

      const initialOverrides: Record<string, string | null> = {};
      const initialDefaults: Record<string, string> = {};

      res.mappings.forEach((m) => {
        initialOverrides[m.target_column] = m.matched_source_column;
        if (m.default_value !== undefined && m.default_value !== null) {
          initialDefaults[m.target_column] = String(m.default_value);
        }
      });

      setUserOverrides(initialOverrides);
      setDefaultValues(initialDefaults);
      setSelectedMockId("custom_upload");

      executeTransformation(
        res.source_schema.preview_data,
        tCols.map((c) => c.name),
        initialOverrides,
        initialDefaults
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error uploading Excel pair"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (sourceRows.length === 0 || targetColumns.length === 0) return;

    setExportLoading(true);
    try {
      const blob = await exportReplicaExcel({
        source_records: sourceRows,
        target_columns: targetColumns.map((c) => c.name),
        column_mapping: userOverrides,
        default_values: defaultValues,
        filename: `replica_${targetFilename}`,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `replica_${targetFilename}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Export download failed");
    } finally {
      setExportLoading(false);
    }
  };

  const mappingStats = useMemo(() => {
    const total = targetColumns.length;
    let mapped = 0;
    let metadataCount = 0;

    targetColumns.forEach((col) => {
      if (userOverrides[col.name]) mapped++;
      if (col.is_metadata) metadataCount++;
    });

    const unmapped = total - mapped;
    const percentage = total > 0 ? Math.round((mapped / total) * 100) : 0;
    return { total, mapped, unmapped, percentage, metadataCount };
  }, [targetColumns, userOverrides]);

  return (
    <MappingContext.Provider
      value={{
        mockSummaries,
        selectedMockId,
        sourceFilename,
        targetFilename,
        sourceColumns,
        sourceRows,
        targetColumns,
        targetRows,
        mappings,
        userOverrides,
        defaultValues,
        replicaData,
        aiLoading,
        aiReasoningSummary,
        aiCustomPrompt,
        setAiCustomPrompt,
        groqApiKeys,
        selectedModel,
        isLoading,
        errorMessage,
        transformLoading,
        exportLoading,
        mappingStats,
        handleLoadMock,
        handleRunAIMapping,
        handleSourceGridChange,
        handleTargetGridChange,
        handleMappingChange,
        handleDefaultValueChange,
        handleExportExcel,
        handleUpload,
        setGroqApiKeys,
        setSelectedModel,
      }}
    >
      {children}
    </MappingContext.Provider>
  );
}

export function useMapping() {
  const context = useContext(MappingContext);
  if (!context) {
    throw new Error("useMapping must be used within a MappingProvider");
  }
  return context;
}
