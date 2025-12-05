export interface RawRequestBody {
  userId?: string;
  description?: string;
  userInput?: string;
  seed?: string;
  hints?: { text: string; failed?: boolean }[];
  [key: string]: any;
}

export interface SanitizedRequest {
  userId?: string;
  description: string;
  userInput: string;
  seed: string;
  hints?: string;
}
