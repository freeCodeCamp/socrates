export interface HintRequest {
  userId?: string;
  challengeType?: 'html' | 'css' | 'javascript' | 'python';
  description: string;
  userInput?: string;
  seed?: string;
  hints?: { text: string; failed?: boolean }[];
  [key: string]: unknown;
}

export interface HintResponse {
  hint: string;
  model_used?: string;
}
