import type { AxiosError } from 'axios';

export interface FieldError {
  field: string;
  message: string;
}

export function extractFieldErrors(err: AxiosError): Record<string, string> {
  const data = err.response?.data as any;
  if (err.response?.status !== 422 || !Array.isArray(data?.errors)) return {};

  const map: Record<string, string> = {};
  for (const e of data.errors as FieldError[]) {
    map[e.field] = e.message;
  }
  return map;
}
