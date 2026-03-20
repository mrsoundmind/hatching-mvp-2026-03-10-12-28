// Smart Task Detection — Barrel Export
export { classifyTaskIntent, type TaskIntent, type ClassifierContext } from './intentClassifier.js';
export { extractDueDate, extractPriority, checkRateLimit } from './taskCreator.js';
export { checkForDuplicate, type DuplicateCheckResult } from './duplicateDetector.js';
export { executeLifecycleCommand, fuzzyMatchTask, formatTaskList, formatProgressSummary, type LifecycleContext, type LifecycleResult } from './taskLifecycle.js';
export { extractOrganicTasks, type OrganicTask, type OrganicExtractionResult } from './organicExtractor.js';
export { detectCompletionSignal, type CompletionSignal } from './completionDetector.js';
