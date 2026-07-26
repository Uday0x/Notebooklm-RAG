import { ApiError } from "../api/client";

export function isClientError(error) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export function shouldRetryQuery(failureCount, error) {
  return !isClientError(error) && failureCount < 1;
}

export function sourceRefetchInterval(query) {
  if (isClientError(query.state.error)) {
    return false;
  }

  return query.state.data?.some((source) =>
    ["PENDING", "PROCESSING"].includes(source.status)
  )
    ? 3000
    : false;
}
