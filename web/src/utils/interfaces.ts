import { z } from "zod";

export interface QueryParams {
  sorting?: {
    id: string;
    desc: boolean;
  }[];
  pagination?: {
    pageIndex?: number;
    pageSize?: number;
  };
  filter?: {
    id: string;
    value: unknown;
  }[];
}

export interface ComboboxItem {
  label: string;
  value: string;
  extra?: Record<string, unknown>;
}

type FieldTypes =
  | "text"
  | "password"
  | "email"
  | "select"
  | "autocomplete"
  | "date"
  | "number"
  | "checkbox";

export interface FieldInfo {
  name: string;
  initValue: string | number | boolean | null;
  label: string;
  placeholder?: string;
  info?: string;
  type: FieldTypes;
  validation: z.ZodTypeAny;
  options?: ComboboxItem[];
  fetchOptions?: (token: string) => Promise<{ label: string; value: string }[]>;
  create: boolean;
  hideCreate?: boolean;
  update: boolean;
}

export interface ErrorResponse {
  requestId: string;
  message: string;
  statusCode: number;
}

export interface FilterItem {
  label: string;
  value: unknown;
}
