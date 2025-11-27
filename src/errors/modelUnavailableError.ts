export class ModelUnavailableError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = 'ModelUnavailableError';
    this.status = 503;
  }
}
