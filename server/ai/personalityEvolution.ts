// B4: Personality Evolution System
// Adapts AI agent personalities based on user interaction patterns and feedback

import { UserBehaviorProfile, MessageAnalysis } from './userBehaviorAnalyzer.js';

export interface PersonalityTraits {
  formality: number;        // 0-1 (casual to formal)
  verbosity: number;        // 0-1 (brief to detailed)
  empathy: number;          // 0-1 (analytical to empathetic)
  directness: number;       // 0-1 (diplomatic to direct)
  enthusiasm: number;       // 0-1 (reserved to enthusiastic)
  technicalDepth: number;   // 0-1 (simple to technical)
}

export interface PersonalityProfile {
  agentId: string;
  userId: string;
  baseTraits: PersonalityTraits;
  adaptedTraits: PersonalityTraits;
  interactionCount: number;
  lastUpdated: Date;
  adaptationConfidence: number; // 0-1
  learningHistory: PersonalityAdjustment[];
}

export interface PersonalityAdjustment {
  timestamp: Date;
  trigger: 'positive_feedback' | 'negative_feedback' | 'behavior_pattern' | 'preference_signal';
  adjustmentType: keyof PersonalityTraits;
  previousValue: number;
  newValue: number;
  confidence: number;
  reason: string;
}

export class PersonalityEvolutionEngine {
  private personalityProfiles = new Map<string, PersonalityProfile>();
  
  // Default personality traits for each role
  private static readonly DEFAULT_TRAITS: Record<string, PersonalityTraits> = {
    'Product Manager': {
      formality: 0.6,
      verbosity: 0.7,
      empathy: 0.8,
      directness: 0.7,
      enthusiasm: 0.6,
      technicalDepth: 0.5
    },
    'Product Designer': {
      formality: 0.4,
      verbosity: 0.6,
      empathy: 0.9,
      directness: 0.5,
      enthusiasm: 0.8,
      technicalDepth: 0.4
    },
    'UI Engineer': {
      formality: 0.5,
      verbosity: 0.6,
      empathy: 0.6,
      directness: 0.6,
      enthusiasm: 0.7,
      technicalDepth: 0.8
    },
    'Backend Developer': {
      formality: 0.7,
      verbosity: 0.8,
      empathy: 0.5,
      directness: 0.8,
      enthusiasm: 0.5,
      technicalDepth: 0.9
    },
    'QA Lead': {
      formality: 0.8,
      verbosity: 0.7,
      empathy: 0.6,
      directness: 0.9,
      enthusiasm: 0.4,
      technicalDepth: 0.7
    }
  };

  /**
   * Get or create personality profile for an agent-user pair
   */
  getPersonalityProfile(agentId: string, userId: string): PersonalityProfile {
    const key = `${agentId}-${userId}`;
    
    if (!this.personalityProfiles.has(key)) {
      const baseTraits = PersonalityEvolutionEngine.DEFAULT_TRAITS[agentId] || 
                        PersonalityEvolutionEngine.DEFAULT_TRAITS['Product Manager'];
      
      const profile: PersonalityProfile = {
        agentId,
        userId,
        baseTraits: { ...baseTraits },
        adaptedTraits: { ...baseTraits },
        interactionCount: 0,
        lastUpdated: new Date(),
        adaptationConfidence: 0.1,
        learningHistory: []
      };
      
      this.personalityProfiles.set(key, profile);
    }
    
    return this.personalityProfiles.get(key)!;
  }

  /**
   * B4.1: Track user interaction patterns and adapt personality
   */
  adaptPersonalityFromBehavior(
    agentId: string,
    userId: string,
    userBehavior: UserBehaviorProfile,
    messageAnalysis: MessageAnalysis
  ): PersonalityProfile {
    const profile = this.getPersonalityProfile(agentId, userId);
    profile.interactionCount++;
    
    const adjustments: PersonalityAdjustment[] = [];
    
    // Adapt based on user communication style
    switch (userBehavior.communicationStyle) {
      case 'anxious':
        adjustments.push(
          this.createAdjustment('empathy', profile.adaptedTraits.empathy, 
            Math.min(1, profile.adaptedTraits.empathy + 0.1), 
            'behavior_pattern', 'User shows anxious communication patterns')
        );
        adjustments.push(
          this.createAdjustment('directness', profile.adaptedTraits.directness,
            Math.max(0, profile.adaptedTraits.directness - 0.05),
            'behavior_pattern', 'More diplomatic approach for anxious user')
        );
        break;
        
      case 'decisive':
        adjustments.push(
          this.createAdjustment('directness', profile.adaptedTraits.directness,
            Math.min(1, profile.adaptedTraits.directness + 0.1),
            'behavior_pattern', 'User prefers direct communication')
        );
        adjustments.push(
          this.createAdjustment('verbosity', profile.adaptedTraits.verbosity,
            Math.max(0, profile.adaptedTraits.verbosity - 0.05),
            'behavior_pattern', 'Brief responses for decisive user')
        );
        break;
        
      case 'analytical':
        adjustments.push(
          this.createAdjustment('technicalDepth', profile.adaptedTraits.technicalDepth,
            Math.min(1, profile.adaptedTraits.technicalDepth + 0.1),
            'behavior_pattern', 'User appreciates technical details')
        );
        adjustments.push(
          this.createAdjustment('verbosity', profile.adaptedTraits.verbosity,
            Math.min(1, profile.adaptedTraits.verbosity + 0.05),
            'behavior_pattern', 'Detailed responses for analytical user')
        );
        break;
        
      case 'casual':
        adjustments.push(
          this.createAdjustment('formality', profile.adaptedTraits.formality,
            Math.max(0, profile.adaptedTraits.formality - 0.1),
            'behavior_pattern', 'User prefers casual communication')
        );
        adjustments.push(
          this.createAdjustment('enthusiasm', profile.adaptedTraits.enthusiasm,
            Math.min(1, profile.adaptedTraits.enthusiasm + 0.05),
            'behavior_pattern', 'More enthusiasm for casual user')
        );
        break;
    }
    
    // Adapt based on response preference
    switch (userBehavior.responsePreference) {
      case 'brief':
        adjustments.push(
          this.createAdjustment('verbosity', profile.adaptedTraits.verbosity,
            Math.max(0.2, profile.adaptedTraits.verbosity - 0.1),
            'preference_signal', 'User prefers brief responses')
        );
        break;
        
      case 'detailed':
        adjustments.push(
          this.createAdjustment('verbosity', profile.adaptedTraits.verbosity,
            Math.min(0.9, profile.adaptedTraits.verbosity + 0.1),
            'preference_signal', 'User prefers detailed responses')
        );
        break;
        
      case 'structured':
        adjustments.push(
          this.createAdjustment('formality', profile.adaptedTraits.formality,
            Math.min(0.8, profile.adaptedTraits.formality + 0.05),
            'preference_signal', 'User prefers structured responses')
        );
        break;
    }
    
    // Apply adjustments and update profile
    this.applyAdjustments(profile, adjustments);
    
    // Update confidence based on interaction count
    profile.adaptationConfidence = Math.min(0.9, 
      0.1 + (profile.interactionCount * 0.05)
    );
    
    profile.lastUpdated = new Date();
    
    console.log(`🧠 Personality adapted for ${agentId}-${userId}: ${adjustments.length} adjustments`);
    
    return profile;
  }

  /**
   * B4.3: Learn from feedback patterns
   */
  adaptPersonalityFromFeedback(
    agentId: string,
    userId: string,
    feedback: 'positive' | 'negative',
    messageContent: string,
    agentResponse: string
  ): PersonalityProfile {
    const profile = this.getPersonalityProfile(agentId, userId);
    const adjustments: PersonalityAdjustment[] = [];
    
    if (feedback === 'positive') {
      // Reinforce current traits slightly
      Object.keys(profile.adaptedTraits).forEach(trait => {
        const currentValue = profile.adaptedTraits[trait as keyof PersonalityTraits];
        const adjustment = currentValue > 0.5 ? 0.02 : -0.02; // Move towards extremes slightly
        const newValue = Math.max(0, Math.min(1, currentValue + adjustment));
        
        if (Math.abs(adjustment) > 0.01) {
          adjustments.push(
            this.createAdjustment(trait as keyof PersonalityTraits, currentValue, newValue,
              'positive_feedback', 'Reinforcing successful personality traits')
          );
        }
      });
    } else {
      // Adjust traits towards middle ground
      Object.keys(profile.adaptedTraits).forEach(trait => {
        const currentValue = profile.adaptedTraits[trait as keyof PersonalityTraits];
        const adjustment = currentValue > 0.5 ? -0.05 : 0.05; // Move towards center
        const newValue = Math.max(0, Math.min(1, currentValue + adjustment));
        
        adjustments.push(
          this.createAdjustment(trait as keyof PersonalityTraits, currentValue, newValue,
            'negative_feedback', 'Adjusting personality based on negative feedback')
        );
      });
    }
    
    this.applyAdjustments(profile, adjustments);
    profile.lastUpdated = new Date();
    
    console.log(`🔄 Personality updated from ${feedback} feedback: ${adjustments.length} adjustments`);
    
    return profile;
  }

  /**
   * Generate personality-adapted system prompt additions
   */
  generatePersonalityPrompt(agentId: string, userId: string): string {
    const profile = this.getPersonalityProfile(agentId, userId);
    const traits = profile.adaptedTraits;
    
    const personalityGuidance: string[] = [];
    
    // Formality guidance
    if (traits.formality < 0.3) {
      personalityGuidance.push("Use casual, friendly language. Feel free to use contractions and informal expressions.");
    } else if (traits.formality > 0.7) {
      personalityGuidance.push("Maintain professional, formal communication. Use complete sentences and proper grammar.");
    }
    
    // Verbosity guidance
    if (traits.verbosity < 0.3) {
      personalityGuidance.push("Keep responses concise and to-the-point. Prioritize key information.");
    } else if (traits.verbosity > 0.7) {
      personalityGuidance.push("Provide detailed explanations and context. Include examples and reasoning.");
    }
    
    // Empathy guidance
    if (traits.empathy > 0.7) {
      personalityGuidance.push("Show understanding and emotional awareness. Acknowledge user concerns and feelings.");
    }
    
    // Directness guidance
    if (traits.directness > 0.7) {
      personalityGuidance.push("Be direct and straightforward. Get to the point quickly and clearly.");
    } else if (traits.directness < 0.3) {
      personalityGuidance.push("Use diplomatic language. Present information tactfully and considerately.");
    }
    
    // Enthusiasm guidance
    if (traits.enthusiasm > 0.7) {
      personalityGuidance.push("Show enthusiasm and energy in your responses. Express excitement about ideas and possibilities.");
    } else if (traits.enthusiasm < 0.3) {
      personalityGuidance.push("Maintain a measured, professional tone. Focus on practical considerations.");
    }
    
    // Technical depth guidance
    if (traits.technicalDepth > 0.7) {
      personalityGuidance.push("Include technical details and implementation specifics when relevant.");
    } else if (traits.technicalDepth < 0.3) {
      personalityGuidance.push("Explain concepts in simple terms. Avoid technical jargon unless necessary.");
    }
    
    if (personalityGuidance.length === 0) {
      return "";
    }
    
    return `\n--- PERSONALITY ADAPTATION ---\n${personalityGuidance.join('\n')}\n--- END ADAPTATION ---\n`;
  }

  /**
   * Get personality statistics for debugging
   */
  getPersonalityStats(agentId: string, userId: string): {
    profile: PersonalityProfile;
    adaptationSummary: string;
  } {
    const profile = this.getPersonalityProfile(agentId, userId);
    
    const traitChanges = Object.keys(profile.adaptedTraits).map(trait => {
      const key = trait as keyof PersonalityTraits;
      const base = profile.baseTraits[key];
      const adapted = profile.adaptedTraits[key];
      const change = adapted - base;
      return `${trait}: ${base.toFixed(2)} → ${adapted.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)})`;
    });
    
    const adaptationSummary = `
Interactions: ${profile.interactionCount}
Confidence: ${(profile.adaptationConfidence * 100).toFixed(1)}%
Recent Adjustments: ${profile.learningHistory.slice(-3).length}
Trait Changes:
${traitChanges.join('\n')}
    `.trim();
    
    return { profile, adaptationSummary };
  }

  // Helper methods
  private createAdjustment(
    trait: keyof PersonalityTraits,
    previousValue: number,
    newValue: number,
    trigger: PersonalityAdjustment['trigger'],
    reason: string
  ): PersonalityAdjustment {
    return {
      timestamp: new Date(),
      trigger,
      adjustmentType: trait,
      previousValue,
      newValue,
      confidence: 0.8,
      reason
    };
  }

  private applyAdjustments(profile: PersonalityProfile, adjustments: PersonalityAdjustment[]) {
    adjustments.forEach(adjustment => {
      profile.adaptedTraits[adjustment.adjustmentType] = adjustment.newValue;
      profile.learningHistory.push(adjustment);
      
      // Keep history manageable
      if (profile.learningHistory.length > 50) {
        profile.learningHistory = profile.learningHistory.slice(-30);
      }
    });
  }
}

// Export singleton instance
export const personalityEngine = new PersonalityEvolutionEngine();