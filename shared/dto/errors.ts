export type ErrorCode =
  | 'INVALID_ENVELOPE'
  | 'INTERNAL_ERROR'
  | 'CONVERSATION_BUSY'
  | 'OPENAI_NOT_CONFIGURED'
  | 'OPENAI_RATE_LIMITED'
  | 'OPENAI_AUTH_FAILED'
  | 'OPENAI_MODEL_UNAVAILABLE'
  | 'STREAMING_GENERATION_FAILED'
  | 'OLLAMA_UNAVAILABLE';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
