export class AppError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code = "INTERNAL_ERROR",
    public details: unknown = null,
  ) {
    super(message);
  }
}
