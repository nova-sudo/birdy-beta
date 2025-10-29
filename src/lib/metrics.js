// src/lib/metrics.js
export const METRIC_ID_TO_DATA_KEY = {
  // Clients dashboard
  leads: "ghl_contacts",
  "ad-spend": "meta_spend",
  clicks: "meta_clicks",
  impressions: "meta_impressions",
  conversions: "meta_leads",
  cpl: "meta_cpl",

  // Campaigns dashboard (same keys – the API already returns them)
  spend: "spend",
  leads: "leads",
  clicks: "clicks",
  impressions: "impressions",
  cpl: "cpl",
  cpc: "cpc",
  reach: "reach",
  ctr: "ctr",
};

export const loadCustomMetrics = () => {
  try {
    const stored = localStorage.getItem("customMetrics");
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load custom metrics:", e);
    return [];
  }
};

export const evaluateFormula = (formulaParts, rowData) => {
  if (!formulaParts?.length) return 0;

  let expression = "";
  for (const part of formulaParts) {
    if (part.type === "metric") {
      const dataKey = METRIC_ID_TO_DATA_KEY[part.value] || part.value;
      const value = rowData[dataKey] ?? 0;
      expression += value;
    } else if (part.type === "operator") {
      expression += ` ${part.value} `;
    }
  }

  try {
    const result = eval(expression);
    return isNaN(result) ? 0 : Number(result.toFixed(2));
  } catch (e) {
    console.error("Formula evaluation error:", e, expression);
    return 0;
  }
};

export const formatMetricValue = (value, id) => {
  if (typeof value !== "number") return "0";

  if (id.includes("revenue") || id.includes("spend") || id.includes("cpl") || id.includes("cpc") || id.includes("cpm")) {
    return `$${value.toFixed(2)}`;
  }
  if (id.includes("ratio") || id.includes("ctr")) {
    return `${value.toFixed(2)}%`;
  }
  return value.toLocaleString();
};