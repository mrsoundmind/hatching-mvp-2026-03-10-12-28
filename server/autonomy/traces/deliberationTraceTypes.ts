export interface DeliberationRoundTrace {
  roundNo: number;
  hatchId: string;
  prompt: string;
  output: string;
  confidence: number;
  riskScore: number;
  latencyMs: number;
  timestamp: string;
}

export interface PeerReviewTrace {
  reviewerHatchId: string;
  rubricOutput: Record<string, unknown>;
  revisionApplied: boolean;
  timestamp: string;
}

export interface DeliberationTrace {
  traceId: string;
  projectId: string;
  conversationId: string;
  objective: string;
  rounds: DeliberationRoundTrace[];
  review: PeerReviewTrace[];
  finalSynthesis?: string;
  createdAt: string;
  updatedAt: string;
}
