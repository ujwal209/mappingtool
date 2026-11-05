"use client";

import { useMapping } from "@/context/MappingContext";
import { Excel3SheetStudio } from "@/components/excel-grid-editor";

export default function SpreadsheetStudioPage() {
  const {
    sourceFilename,
    sourceColumns,
    sourceRows,
    handleSourceGridChange,
    targetFilename,
    targetColumns,
    targetRows,
    handleTargetGridChange,
    replicaData,
    transformLoading,
    mappings,
    userOverrides,
    defaultValues,
    handleMappingChange,
    handleDefaultValueChange,
    handleRunAIMapping,
    aiLoading,
    aiReasoningSummary,
    handleExportExcel,
    exportLoading,
    mappingStats,
  } = useMapping();

  return (
    <main className="w-screen h-screen p-0 m-0 flex flex-col bg-background overflow-hidden">
      <Excel3SheetStudio
        sourceFilename={sourceFilename}
        sourceColumns={sourceColumns}
        sourceRows={sourceRows}
        onSourceChange={handleSourceGridChange}
        targetFilename={targetFilename}
        targetColumns={targetColumns}
        targetRows={targetRows}
        onTargetChange={handleTargetGridChange}
        replicaData={replicaData}
        transformLoading={transformLoading}
        mappings={mappings}
        userOverrides={userOverrides}
        defaultValues={defaultValues}
        onMappingChange={handleMappingChange}
        onDefaultValueChange={handleDefaultValueChange}
        onRunAIMapping={handleRunAIMapping}
        aiLoading={aiLoading}
        aiReasoningSummary={aiReasoningSummary}
        onExportExcel={handleExportExcel}
        exportLoading={exportLoading}
        mappingStats={mappingStats}
      />
    </main>
  );
}
