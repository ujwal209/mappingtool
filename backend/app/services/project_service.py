"""
Project & Environment Management Service.
Manages Migration Projects, Environments (DEV/TEST/UAT/PROD), Waves, and Delivery Scopes.
"""

from typing import List, Optional
from app.models.canonical import Project, Environment, EnvironmentType, Wave, LifecycleState
from app.db.store import store
from app.core.errors import PlatformException, ErrorCategory


class ProjectService:
    """Handles migration project hierarchy, environment isolation, and wave lifecycle."""

    def create_project(
        self,
        tenant_id: str,
        name: str,
        description: Optional[str] = None,
        owners: Optional[List[str]] = None,
        domain: Optional[str] = "Banking & Financial Services",
        methodology: Optional[str] = "Phased Wave Replication",
        source_ecosystem: Optional[str] = "Legacy Oracle / SAP ERP",
        target_ecosystem: Optional[str] = "Microsoft Fabric OneLake",
        estimated_volume: Optional[str] = "10M - 50M Records",
        target_cutover_date: Optional[str] = "2026-12-31",
        compliance_framework: Optional[str] = "SOC2 Type II / GDPR",
        data_classification: Optional[str] = "CONFIDENTIAL",
        planned_waves: Optional[int] = 3,
        rehearsal_strategy: Optional[str] = "Dual-Run Shadow Execution",
    ) -> Project:
        project = Project(
            tenant_id=tenant_id,
            name=name,
            description=description,
            owners=owners or [],
            lifecycle_state=LifecycleState.ACTIVE,
            domain=domain,
            methodology=methodology,
            source_ecosystem=source_ecosystem,
            target_ecosystem=target_ecosystem,
            estimated_volume=estimated_volume,
            target_cutover_date=target_cutover_date,
            compliance_framework=compliance_framework,
            data_classification=data_classification,
            planned_waves=planned_waves,
            rehearsal_strategy=rehearsal_strategy,
        )
        store.save_project(tenant_id, project)
        
        # Automatically initialize default environments for the project
        for env_type in [EnvironmentType.DEV, EnvironmentType.TEST, EnvironmentType.PROD]:
            env = Environment(
                project_id=project.project_id,
                name=f"{env_type.value} Environment",
                type=env_type,
            )
            store.save_environment(tenant_id, env)

        from app.services.event_bus import event_bus
        from app.models.events import EventType
        event_bus.publish(
            tenant_id=tenant_id,
            event_type=EventType.PROJECT_CREATED,
            payload={
                "project_id": project.project_id,
                "name": project.name,
                "description": project.description,
            },
        )
            
        return project

    def get_project(self, tenant_id: str, project_id: str) -> Project:
        proj = store.get_project(tenant_id, project_id)
        if not proj:
            raise PlatformException(
                code="PROJECT_NOT_FOUND",
                message=f"Project '{project_id}' not found for tenant '{tenant_id}'",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        return proj

    def list_projects(self, tenant_id: str) -> List[Project]:
        return store.list_projects(tenant_id)

    def create_wave(
        self,
        tenant_id: str,
        project_id: str,
        name: str,
        scope_definition: dict,
        dependencies: Optional[List[str]] = None,
    ) -> Wave:
        self.get_project(tenant_id, project_id)  # Validate project exists
        wave = Wave(
            project_id=project_id,
            name=name,
            scope_definition=scope_definition,
            dependencies=dependencies or [],
            state="PLANNED",
        )
        return store.save_wave(tenant_id, wave)

    def get_wave(self, tenant_id: str, wave_id: str) -> Wave:
        wave = store.get_wave(tenant_id, wave_id)
        if not wave:
            raise PlatformException(
                code="WAVE_NOT_FOUND",
                message=f"Wave '{wave_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        return wave


project_service = ProjectService()
