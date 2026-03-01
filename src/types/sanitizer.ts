export type ChallengeType = 'html' | 'css' | 'javascript' | 'python';

export interface RawRequestBody {
  userId?: string;
  challengeType?: string;
  description?: string;
  userInput?: string;
  seed?: string;
  hints?: { text: string; failed?: boolean }[];
  [key: string]: string | { text: string; failed?: boolean }[] | undefined;
}

export interface SanitizedRequest {
  userId: string;
  challengeType?: ChallengeType;
  description: string;
  userInput: string;
  seed: string;
  hints?: string;
}
