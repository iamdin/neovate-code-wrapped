import defaultProviderLogo from "../assets/images/default-provider.svg" with { type: 'text' };

const DEFAULT_PROVIDER_LOGO_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(defaultProviderLogo).toString("base64")}`;

// Inline SVG logos for providers (from models.dev)
const ANTHROPIC_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <path d="M26.9568 9.88184H22.1265L30.7753 31.7848H35.4917L26.9568 9.88184ZM13.028 9.88184L4.4917 31.7848H9.32203L11.2305 27.1793H20.2166L22.0126 31.6724H26.8444L18.0832 9.88184H13.028ZM12.5783 23.1361L15.4987 15.3853L18.5315 23.1361H12.5783Z" fill="currentColor"/>
</svg>`;

const ANTIGRAVITY_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <path d="M37 20.034C27.8809 20.5837 20.5808 27.8809 20.0326 37H19.966C19.4163 27.8809 12.1177 20.5837 3 20.034V19.9674C12.1191 19.4163 19.4163 12.1191 19.966 3H20.0326C20.5822 12.1191 27.8809 19.4163 37 19.9674V20.034Z" fill="currentColor"/>
</svg>`;

const ZAI_CODING_PLAN_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <path d="M20.1312 7.50002L17.4088 11.1913H5.81625L8.5375 7.50002H20.1325H20.1312ZM34.0675 28.81L31.3475 32.5H19.795L22.5125 28.81H34.0675ZM35 7.50002L16.58 32.5H5L23.42 7.50002H35Z" fill="currentColor"/>
</svg>`;

const OPENAI_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="50" fill="currentColor"/>
  <text x="50" y="70" font-size="35" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold">◯</text>
</svg>`;

const GOOGLE_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="50" fill="currentColor"/>
  <text x="50" y="70" font-size="40" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold">G</text>
</svg>`;

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
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
              models[modelId] = {
                id: modelId,
                name: modelData.name,
                provider: providerId,
              };
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
  // Provider logos as base64 data URLs
  const providerLogos: Record<string, string> = {
    anthropic: `data:image/svg+xml;base64,${Buffer.from(ANTHROPIC_LOGO).toString("base64")}`,
    antigravity: `data:image/svg+xml;base64,${Buffer.from(ANTIGRAVITY_LOGO).toString("base64")}`,
    "zai-coding-plan": `data:image/svg+xml;base64,${Buffer.from(ZAI_CODING_PLAN_LOGO).toString("base64")}`,
    openai: `data:image/svg+xml;base64,${Buffer.from(OPENAI_LOGO).toString("base64")}`,
    google: `data:image/svg+xml;base64,${Buffer.from(GOOGLE_LOGO).toString("base64")}`,
  };

  return providerLogos[providerId] || DEFAULT_PROVIDER_LOGO_DATA_URL;
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
