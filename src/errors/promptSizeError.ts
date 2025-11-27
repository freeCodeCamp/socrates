export class PromptSizeError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = 'PromptSizeError';
    this.status = 400;
  }
}
