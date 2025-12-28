export interface ModelCost {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  cost?: ModelCost;
}

interface ProviderInfo {
  id: string;
  name: string;
}

interface ModelsDevData {
  models: Record<string, ModelInfo>;
  providers: Record<string, ProviderInfo>;
}

interface ModelsDevModel {
  name?: string;
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
}

interface ModelsDevProvider {
  name?: string;
  models?: Record<string, ModelsDevModel>;
}

// Cache for the fetched data
let cachedData: ModelsDevData | null = null;

export async function fetchModelsData(): Promise<ModelsDevData> {
  if (cachedData) {
    return cachedData;
  }

  try {
    const response = await fetch("https://models.dev/api.json", {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const models: Record<string, ModelInfo> = {};
    const providers: Record<string, ProviderInfo> = {};

    if (data && typeof data === "object") {
      for (const [providerId, providerData] of Object.entries(data)) {
        if (!providerData || typeof providerData !== "object") continue;

        const pd = providerData as ModelsDevProvider;

        if (pd.name) {
          providers[providerId] = {
            id: providerId,
            name: pd.name,
          };
        }

        if (pd.models && typeof pd.models === "object") {
          for (const [modelId, modelData] of Object.entries(pd.models)) {
            if (modelData && typeof modelData === "object" && modelData.name) {
              const model: ModelInfo = {
                id: modelId,
                name: modelData.name,
                provider: providerId,
              };

              // Extract pricing data if available
              if (modelData.cost && typeof modelData.cost === "object") {
                const costData = modelData.cost as {
                  input?: number;
                  output?: number;
                  cache_read?: number;
                  cache_write?: number;
                };
                if (typeof costData.input === "number" && typeof costData.output === "number") {
                  model.cost = {
                    input: costData.input,
                    output: costData.output,
                    cacheRead: costData.cache_read,
                    cacheWrite: costData.cache_write,
                  };
                }
              }

              models[modelId] = model;
            }
          }
        }
      }
    }

    cachedData = { models, providers };
    return cachedData;
  } catch (error) {
    console.warn("Failed to fetch models.dev data, using fallbacks");
    cachedData = { models: {}, providers: {} };
    return cachedData;
  }
}

export function getModelDisplayName(modelId: string): string {
  if (!cachedData) {
    console.warn("Models data not prefetched, using fallback formatting");
    return formatModelIdAsName(modelId);
  }

  if (cachedData.models[modelId]?.name) {
    return cachedData.models[modelId].name;
  }

  return formatModelIdAsName(modelId);
}

export function getModelProvider(modelId: string): string {
  if (!cachedData) {
    console.warn("Models data not prefetched");
    return "unknown";
  }

  if (cachedData.models[modelId]?.provider) {
    return cachedData.models[modelId].provider;
  }

  return "unknown";
}

export function getProviderDisplayName(providerId: string): string {
  if (cachedData?.providers[providerId]?.name) {
    return cachedData.providers[providerId].name;
  }

  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

export function getProviderLogoUrl(providerId: string): string {
  return `https://models.dev/logos/${providerId}.svg`;
}

export function getModelPricing(modelId: string): ModelCost | undefined {
  if (!cachedData) {
    return undefined;
  }
  return cachedData.models[modelId]?.cost;
}

function formatModelIdAsName(modelId: string): string {
  return modelId
    .split(/[-_]/)
    .map((part) => {
      if (/^\d/.test(part)) return part;

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}
