export interface RawRequestBody {
  userId?: string;
  description?: string;
  userInput?: string;
  seed?: string;
  hints?: { text: string; failed?: boolean }[];
  [key: string]: string | { text: string; failed?: boolean }[] | undefined;
}

export interface SanitizedRequest {
  userId?: string;
  description: string;
  userInput: string;
  seed: string;
  hints?: string;
}
