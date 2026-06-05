export const CHALLENGE_TYPES = ['html', 'css', 'javascript', 'python'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

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
