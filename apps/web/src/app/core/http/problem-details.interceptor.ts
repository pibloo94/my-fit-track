import { type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { toAppError } from '../error/problem-details.mapper';

/**
 * Every failed HTTP call becomes an {@link AppError}. `httpResource` uses
 * HttpClient, so this applies to feature resources without each one mapping.
 */
export const problemDetailsInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: unknown) => {
      return throwError(() => toAppError(error));
    }),
  );
};
