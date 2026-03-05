// B2.1: User Behavior Detection System
// Analyzes user communication patterns to adapt AI responses

export interface UserBehaviorProfile {
  communicationStyle: 'anxious' | 'decisive' | 'reflective' | 'casual' | 'analytical';
  responsePreference: 'brief' | 'detailed' | 'structured' | 'conversational';
  decisionMaking: 'quick' | 'thorough' | 'collaborative';
  interactionFrequency: 'high' | 'moderate' | 'low';
  feedbackPattern: 'positive' | 'critical' | 'neutral';
  lastAnalyzed: string;
  confidence: number; // 0-1 scale
}

export interface MessageAnalysis {
  urgencyLevel: number; // 0-1 scale
  complexityPreference: number; // 0-1 scale
  emotionalTone: 'positive' | 'neutral' | 'frustrated' | 'excited' | 'confused';
  questionType: 'clarification' | 'decision' | 'brainstorm' | 'instruction' | 'feedback';
  responseLength: 'short' | 'medium' | 'long';
}

export class UserBehaviorAnalyzer {
  private static readonly ANALYSIS_PATTERNS = {
    // Anxiety indicators
    anxious: {
      keywords: ['urgent', 'asap', 'quickly', 'worried', 'concerned', 'deadline', 'rush'],
      messagePatterns: ['multiple questions', 'short bursts', 'follow-ups'],
      punctuation: ['multiple !', 'multiple ?', 'ALL CAPS']
    },
    
    // Decisive indicators  
    decisive: {
      keywords: ['decide', 'choose', 'pick', 'go with', 'final', 'done', 'let\'s do'],
      messagePatterns: ['clear statements', 'action-oriented', 'minimal back-and-forth'],
      punctuation: ['periods', 'brief sentences']
    },
    
    // Reflective indicators
    reflective: {
      keywords: ['think', 'consider', 'analyze', 'explore', 'what if', 'pros and cons'],
      messagePatterns: ['longer messages', 'detailed questions', 'hypothesis testing'],
      punctuation: ['thoughtful pauses', 'complex sentences']
    },
    
    // Casual indicators
    casual: {
      keywords: ['hey', 'cool', 'awesome', 'nice', 'sounds good', 'yeah', 'ok'],
      messagePatterns: ['informal tone', 'abbreviations', 'relaxed pace'],
      punctuation: ['casual punctuation', 'emojis if present']
    },
    
    // Analytical indicators
    analytical: {
      keywords: ['data', 'metrics', 'analyze', 'compare', 'evaluate', 'research', 'evidence'],
      messagePatterns: ['structured questions', 'detail-oriented', 'systematic approach'],
      punctuation: ['formal structure', 'numbered lists']
    }
  };

  /**
   * Analyzes a single message for behavioral indicators
   */
  static analyzeMessage(content: string, timestamp: string): MessageAnalysis {
    const lowerContent = content.toLowerCase();
    const wordCount = content.split(' ').length;
    
    // Detect urgency
    const urgencyKeywords = ['urgent', 'asap', 'quickly', 'now', 'immediately', 'rush'];
    const urgencyScore = urgencyKeywords.reduce((score, keyword) => 
      lowerContent.includes(keyword) ? score + 0.3 : score, 0
    );
    const hasMultipleExclamation = (content.match(/!/g) || []).length > 1;
    const urgencyLevel = Math.min(1, urgencyScore + (hasMultipleExclamation ? 0.2 : 0));

    // Detect complexity preference
    const complexWords = ['analyze', 'detailed', 'comprehensive', 'thorough', 'explain'];
    const simpleWords = ['simple', 'quick', 'brief', 'short', 'summary'];
    const complexityScore = complexWords.reduce((score, word) => 
      lowerContent.includes(word) ? score + 0.2 : score, 0
    ) - simpleWords.reduce((score, word) => 
      lowerContent.includes(word) ? score + 0.2 : score, 0
    );
    const complexityPreference = Math.max(0, Math.min(1, 0.5 + complexityScore));

    // Detect emotional tone
    let emotionalTone: MessageAnalysis['emotionalTone'] = 'neutral';
    if (lowerContent.match(/awesome|great|love|perfect|excellent/)) emotionalTone = 'positive';
    else if (lowerContent.match(/confused|stuck|help|don't understand/)) emotionalTone = 'confused';
    else if (lowerContent.match(/frustrated|annoyed|wrong|broken|issue/)) emotionalTone = 'frustrated';
    else if (lowerContent.match(/excited|amazing|wow|incredible/)) emotionalTone = 'excited';

    // Detect question type
    let questionType: MessageAnalysis['questionType'] = 'instruction';
    if (lowerContent.includes('?')) {
      if (lowerContent.match(/what|how|why|when|where/)) questionType = 'clarification';
      else if (lowerContent.match(/should|would|could|better/)) questionType = 'decision';
      else if (lowerContent.match(/ideas|thoughts|brainstorm|suggest/)) questionType = 'brainstorm';
    } else if (lowerContent.match(/good|bad|like|dislike|think/)) {
      questionType = 'feedback';
    }

    // Determine preferred response length
    let responseLength: MessageAnalysis['responseLength'] = 'medium';
    if (wordCount < 5 || lowerContent.match(/brief|short|quick/)) responseLength = 'short';
    else if (wordCount > 20 || lowerContent.match(/detailed|comprehensive|explain/)) responseLength = 'long';

    return {
      urgencyLevel,
      complexityPreference,
      emotionalTone,
      questionType,
      responseLength
    };
  }

  /**
   * Analyzes conversation history to build user behavior profile
   */
  static analyzeUserBehavior(
    messages: Array<{ content: string; messageType: 'user' | 'agent'; timestamp: string; senderId: string }>,
    userId: string
  ): UserBehaviorProfile {
    const userMessages = messages.filter(m => m.messageType === 'user' && m.senderId === userId);
    
    if (userMessages.length < 3) {
      // Not enough data, return neutral profile
      return {
        communicationStyle: 'casual',
        responsePreference: 'conversational',
        decisionMaking: 'collaborative',
        interactionFrequency: 'moderate',
        feedbackPattern: 'neutral',
        lastAnalyzed: new Date().toISOString(),
        confidence: 0.3
      };
    }

    // Analyze each message
    const analyses = userMessages.map(msg => this.analyzeMessage(msg.content, msg.timestamp));
    
    // Calculate style scores
    const styleScores = {
      anxious: 0,
      decisive: 0,
      reflective: 0,
      casual: 0,
      analytical: 0
    };

    userMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      
      // Score each style
      Object.entries(this.ANALYSIS_PATTERNS).forEach(([style, patterns]) => {
        let score = 0;
        patterns.keywords.forEach(keyword => {
          if (content.includes(keyword)) score += 1;
        });
        styleScores[style as keyof typeof styleScores] += score;
      });
    });

    // Determine dominant communication style
    const totalMessages = userMessages.length;
    const dominantStyle = Object.entries(styleScores).reduce((a, b) => 
      styleScores[a[0] as keyof typeof styleScores] > styleScores[b[0] as keyof typeof styleScores] ? a : b
    )[0] as UserBehaviorProfile['communicationStyle'];

    // Analyze response preferences
    const avgUrgency = analyses.reduce((sum, a) => sum + a.urgencyLevel, 0) / analyses.length;
    const avgComplexity = analyses.reduce((sum, a) => sum + a.complexityPreference, 0) / analyses.length;
    
    let responsePreference: UserBehaviorProfile['responsePreference'] = 'conversational';
    if (avgComplexity > 0.7) responsePreference = 'detailed';
    else if (avgUrgency > 0.6 || avgComplexity < 0.3) responsePreference = 'brief';
    else if (dominantStyle === 'analytical') responsePreference = 'structured';

    // Decision making pattern
    const decisionKeywords = userMessages.reduce((count, msg) => {
      const content = msg.content.toLowerCase();
      if (content.match(/decide|choose|pick|go with/)) return count + 1;
      return count;
    }, 0);
    
    let decisionMaking: UserBehaviorProfile['decisionMaking'] = 'collaborative';
    if (decisionKeywords > totalMessages * 0.3) decisionMaking = 'quick';
    else if (avgComplexity > 0.6) decisionMaking = 'thorough';

    // Interaction frequency (messages per conversation)
    const interactionFrequency: UserBehaviorProfile['interactionFrequency'] = 
      totalMessages > 10 ? 'high' : totalMessages > 5 ? 'moderate' : 'low';

    // Feedback pattern
    const positiveCount = analyses.filter(a => a.emotionalTone === 'positive').length;
    const negativeCount = analyses.filter(a => a.emotionalTone === 'frustrated').length;
    
    let feedbackPattern: UserBehaviorProfile['feedbackPattern'] = 'neutral';
    if (positiveCount > negativeCount * 2) feedbackPattern = 'positive';
    else if (negativeCount > positiveCount) feedbackPattern = 'critical';

    // Confidence based on message count and consistency
    const confidence = Math.min(1, totalMessages / 20) * 0.7 + 
                     (styleScores[dominantStyle] / totalMessages) * 0.3;

    return {
      communicationStyle: dominantStyle,
      responsePreference,
      decisionMaking,
      interactionFrequency,
      feedbackPattern,
      lastAnalyzed: new Date().toISOString(),
      confidence: Math.max(0.1, confidence)
    };
  }

  /**
   * Generates response adaptation instructions based on user profile
   */
  static getResponseAdaptation(
    profile: UserBehaviorProfile,
    currentMessage: MessageAnalysis
  ): {
    tone: string;
    length: string;
    structure: string;
    timing: string;
    personalityAdjustment: string;
  } {
    const adaptations = {
      tone: '',
      length: '',
      structure: '',
      timing: '',
      personalityAdjustment: ''
    };

    // Tone adaptation
    switch (profile.communicationStyle) {
      case 'anxious':
        adaptations.tone = 'Reassuring and calm. Acknowledge urgency but provide stable guidance.';
        break;
      case 'decisive':
        adaptations.tone = 'Direct and action-oriented. Provide clear recommendations with confidence.';
        break;
      case 'reflective':
        adaptations.tone = 'Thoughtful and exploratory. Encourage deeper thinking and consideration.';
        break;
      case 'casual':
        adaptations.tone = 'Friendly and approachable. Use conversational language and be supportive.';
        break;
      case 'analytical':
        adaptations.tone = 'Professional and data-driven. Provide evidence and structured reasoning.';
        break;
    }

    // Length adaptation
    if (currentMessage.responseLength === 'short' || profile.responsePreference === 'brief') {
      adaptations.length = 'Keep response concise (1-2 sentences). Focus on key points only.';
    } else if (currentMessage.responseLength === 'long' || profile.responsePreference === 'detailed') {
      adaptations.length = 'Provide comprehensive response with examples and context.';
    } else {
      adaptations.length = 'Medium length response with clear explanation.';
    }

    // Structure adaptation
    switch (profile.responsePreference) {
      case 'structured':
        adaptations.structure = 'Use numbered lists, bullet points, or clear sections.';
        break;
      case 'conversational':
        adaptations.structure = 'Natural conversation flow with smooth transitions.';
        break;
      default:
        adaptations.structure = 'Clear paragraphs with logical flow.';
    }

    // Timing adaptation
    if (currentMessage.urgencyLevel > 0.7) {
      adaptations.timing = 'Respond quickly with immediate actionable advice.';
    } else if (profile.communicationStyle === 'reflective') {
      adaptations.timing = 'Take time to provide thoughtful, well-considered response.';
    } else {
      adaptations.timing = 'Standard response timing with good pace.';
    }

    // Personality adjustment
    adaptations.personalityAdjustment = `Confidence level: ${profile.confidence.toFixed(1)}. ` +
      `Adapt personality to match ${profile.communicationStyle} style with ${profile.decisionMaking} decision-making preference.`;

    return adaptations;
  }
}