export class InputValidationError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
    this.status = 400;
  }
}
