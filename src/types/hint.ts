export const CHALLENGE_TYPES = ['html', 'css', 'javascript', 'python'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export interface HintTestResult {
  text: string;
  failed: boolean;
}

export interface HintRequestBody {
  userId: string;
  challengeType?: ChallengeType;
  description: string;
  userInput?: string;
  seed?: string;
  hints: HintTestResult[];
}

export interface NormalizedHintRequest {
  userId: string;
  challengeType?: ChallengeType;
  description: string;
  userInput: string;
  seed: string;
  hints: string;
}
