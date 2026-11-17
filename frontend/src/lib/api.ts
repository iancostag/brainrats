export interface CategoryTemplate {
  slug: string;
  name: string;
  description: string;
  default_base_points: number;
  default_daily_cap: number;
  supports_auto_sync: boolean;
  metadata_fields: string[];
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function fetchDefaultCategories(): Promise<CategoryTemplate[]> {
  const res = await fetch(`${API_BASE_URL}/categories`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao carregar categorias (${res.status})`);
  }
  return res.json();
}
