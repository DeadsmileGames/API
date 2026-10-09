export class AppError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code   = code;
  }
}
