export interface HealthResponse {
  status: string;
  timestamp: string;
  python_version: string;
  platform: string;
}

export interface LocationItem {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  description?: string;
}

import { API_ROOT } from "./api-config";

const API_BASE_URL = API_ROOT;

export async function checkBackendHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/health`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Health check failed with HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchItems(): Promise<LocationItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/items`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch items: HTTP ${res.status}`);
  }
  return res.json();
}

export async function createItem(
  item: Omit<LocationItem, "id"> & { id?: number }
): Promise<LocationItem> {
  const payload = {
    ...item,
    id: item.id || Date.now(),
  };
  const res = await fetch(`${API_BASE_URL}/api/v1/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to create item: HTTP ${res.status}`
    );
  }
  return res.json();
}
