import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface MessageFeedbackProps {
  messageId: string;
  conversationId: string;
  userMessage: string;
  agentResponse: string;
  agentRole: string;
  agentName: string;
  onFeedbackSubmitted?: () => void;
}

export function MessageFeedback({ 
  messageId, 
  conversationId, 
  userMessage, 
  agentResponse, 
  agentRole, 
  agentName,
  onFeedbackSubmitted 
}: MessageFeedbackProps) {
  const [selectedRating, setSelectedRating] = useState<'good' | 'bad' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRatingSelect = async (rating: 'good' | 'bad') => {
    setSelectedRating(rating);
    setIsSubmitting(true);

    try {
      await fetch('/api/training/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          conversationId,
          userMessage,
          agentResponse,
          agentRole,
          rating
        })
      });

      onFeedbackSubmitted?.();
      
      // Auto-hide after success
      setTimeout(() => {
        setSelectedRating(null);
      }, 1500);

    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (selectedRating) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mt-2">
        <ThumbsUp size={12} />
        <span>Thanks for the feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-2 opacity-60 hover:opacity-100 transition-opacity">
      <button
        onClick={() => handleRatingSelect('good')}
        disabled={isSubmitting}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Good response"
      >
        <ThumbsUp size={12} className="text-gray-600 dark:text-gray-400" />
      </button>
      
      <button
        onClick={() => handleRatingSelect('bad')}
        disabled={isSubmitting}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Could be better"
      >
        <ThumbsDown size={12} className="text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  );
}