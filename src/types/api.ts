export interface HintRequest {
  userId?: string;
  description: string;
  userInput: string;
  seed: string;
  hints?: string[];
  [key: string]: any;
}

export interface HintResponse {
  hint: string;
  model_used?: string;
}
