export interface HintRequest {
  userId?: string;
  description: string;
  userInput: string;
  tests?: any[];
  [key: string]: any;
}

export interface HintResponse {
  hint: string;
  model_used?: string;
}
