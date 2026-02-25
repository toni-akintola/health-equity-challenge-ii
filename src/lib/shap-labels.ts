/**
 * Human-readable labels for SHAP feature codes (EJSCREEN / analysis minimal).
 */
export const SHAP_FEATURE_LABELS: Record<string, string> = {
  P_PM25: "PM 2.5",
  P_OZONE: "Ozone",
  P_DSLPM: "Diesel PM",
  P_PTRAF: "Traffic proximity",
  P_LDPNT: "Lead paint",
  P_PNPL: "NPL sites",
  P_PRMP: "RMP facilities",
  P_PTSDF: "TSDF proximity",
  P_UST: "UST proximity",
  P_PWDIS: "Wastewater discharge",
  DEMOGIDX_2: "Demographic index (low income + minority)",
  // EJI 2024
  RPL_EJI: "EJI overall percentile",
  RPL_SER: "EJI socioeconomic rank",
  RPL_SVM: "EJI social vulnerability",
  RPL_EBM: "EJI environmental burden",
  RPL_EJI_CBM: "EJI climate burden",
};

export function getShapFeatureLabel(feature: string): string {
  return SHAP_FEATURE_LABELS[feature] ?? feature;
}
