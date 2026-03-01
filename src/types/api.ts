export interface ApiError extends Error {
  status?: number;
}

export interface HintResponse {
  hint: string;
  model_used?: string;
}
