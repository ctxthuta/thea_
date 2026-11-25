export interface ProblemFieldError {
  field: string;
  message: string;
}

export interface AppErrorOptions {
  status: number;
  code: string;
  title: string;
  detail: string;
  errors?: ProblemFieldError[];
}

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly title: string;
  public readonly detail: string;
  public readonly errors?: ProblemFieldError[];

  constructor(options: AppErrorOptions) {
    super(options.detail);
    this.name = 'AppError';
    this.status = options.status;
    this.code = options.code;
    this.title = options.title;
    this.detail = options.detail;
    this.errors = options.errors;
  }

  static badRequest(detail: string, errors?: ProblemFieldError[], code = 'bad-request'): AppError {
    return new AppError({
      status: 400,
      code,
      title: 'Bad Request',
      detail,
      errors,
    });
  }

  static unauthorized(detail = 'Authentication required.', code = 'unauthorized'): AppError {
    return new AppError({
      status: 401,
      code,
      title: 'Unauthorized',
      detail,
    });
  }

  static forbidden(detail = 'Insufficient permissions for this action.', code = 'forbidden'): AppError {
    return new AppError({
      status: 403,
      code,
      title: 'Forbidden',
      detail,
    });
  }

  static notFound(detail: string, code = 'not-found'): AppError {
    return new AppError({
      status: 404,
      code,
      title: 'Not Found',
      detail,
    });
  }

  static conflict(detail: string, code = 'conflict', errors?: ProblemFieldError[]): AppError {
    return new AppError({
      status: 409,
      code,
      title: 'Conflict',
      detail,
      errors,
    });
  }

  static unprocessable(
    detail: string,
    code = 'unprocessable-entity',
    title = 'Unprocessable Entity',
    errors?: ProblemFieldError[]
  ): AppError {
    return new AppError({
      status: 422,
      code,
      title,
      detail,
      errors,
    });
  }

  static tooManyRequests(detail = 'Rate limit exceeded. Retry later.'): AppError {
    return new AppError({
      status: 429,
      code: 'rate-limit-exceeded',
      title: 'Too Many Requests',
      detail,
    });
  }
}
