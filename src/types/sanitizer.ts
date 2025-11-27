export interface RawTestObject {
  // Test object shape is unknown — allow any additional fields
  [key: string]: any;
}

export interface RawRequestBody {
  userId?: string;
  description?: string;
  userInput?: string;
  tests?: RawTestObject[];
  [key: string]: any;
}

export interface SanitizedTestObject {
  // Only keep certain fields for safety
  text?: string; // natural language description of test or failure
  name?: string;
  // other safe metadata
  [key: string]: any;
}

export interface SanitizedRequest {
  userId?: string;
  description: string;
  userInput: string;
  failedTestText?: string;
  firstTest?: SanitizedTestObject;
}
