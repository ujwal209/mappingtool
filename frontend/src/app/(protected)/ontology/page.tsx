"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { ProjectGuard } from "@/components/ProjectGuard";
import { useOntologyState } from "@/components/ontology/useOntologyState";
import { OntologyRegistry } from "@/components/ontology/OntologyRegistry";
import { FloatingToolbars } from "@/components/ontology/BuilderToolbar";
import { CanvasView } from "@/components/ontology/CanvasView";
import { TableView } from "@/components/ontology/TableView";
import { RelationshipsView } from "@/components/ontology/RelationshipsView";
import { CopilotPanel } from "@/components/ontology/CopilotPanel";
import { CommandPalette } from "@/components/ontology/CommandPalette";
import { EntityModal } from "@/components/ontology/modals/EntityModal";
import { AttributeModal } from "@/components/ontology/modals/AttributeModal";
import { RelationshipModal } from "@/components/ontology/modals/RelationshipModal";
import { EntityInspectorModal } from "@/components/ontology/modals/EntityInspectorModal";
import { OntologyMetaModal } from "@/components/ontology/modals/OntologyMetaModal";

export default function OntologyStudioPage() {
  const s = useOntologyState();

  return (
    <ProtectedRoute>
      <ProjectGuard featureName="Ontology Studio">
        <div className="h-full w-full overflow-hidden font-sans bg-slate-50 text-slate-900 relative">
          {s.viewMode === "registry" && <OntologyRegistry s={s} />}

          {s.viewMode === "builder" && s.selectedOntology && (
            <div className="absolute inset-0 overflow-hidden">
              {s.activeTab === "graph" && <CanvasView s={s} />}
              {s.activeTab === "table" && <TableView s={s} />}
              {s.activeTab === "relationships" && <RelationshipsView s={s} />}

              <FloatingToolbars s={s} />

              {s.isAgentOpen && <CopilotPanel s={s} />}
            </div>
          )}

          <CommandPalette s={s} />

          <EntityModal s={s} />
          <AttributeModal s={s} />
          <RelationshipModal s={s} />
          <EntityInspectorModal s={s} />
          <OntologyMetaModal s={s} />
        </div>
      </ProjectGuard>
    </ProtectedRoute>
  );
}