export type ValidatorResult = {
  is_supported: boolean;
  issues?: string[];
  adjusted_answer?: string | null;
  confidence?: number | null;
};

export type GenerateOptions = {
  apiKey?: string;
  model?: string;
  temperature?: number;
};

