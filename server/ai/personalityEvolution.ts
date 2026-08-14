// B4: Personality Evolution System
// Adapts AI agent personalities based on user interaction patterns and feedback

import { UserBehaviorProfile, MessageAnalysis } from './userBehaviorAnalyzer.js';
import { getRoleIntelligence } from '@shared/roleIntelligence';

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

// ITL-3 / LEARN-02: content-aware personality. The audit found feedback adaptation was content-BLIND
// (it nudged all 6 trait dials generically and threw away the message content). This maps the SUBSTANCE
// of the feedback (the user's note, and a signal from the reacted response) to the SPECIFIC trait it
// points at, so a thumbs-down teaches WHAT to change ("too long" -> less verbose), not just a blanket
// drift. Pure + unit-testable. Returns only the traits the feedback actually spoke to (often none, in
// which case the adaptation falls back to the existing Phase C baseline-anchored nudge).
export function deriveTraitHints(feedbackText: string, agentResponse = ''): Partial<Record<keyof PersonalityTraits, 'up' | 'down'>> {
  const t = `${feedbackText || ''}`.toLowerCase();
  const h: Partial<Record<keyof PersonalityTraits, 'up' | 'down'>> = {};
  // Trailing \b on prefix-risky words so "too short" != "shortsighted", "expand" != "expandable",
  // "cold" != "cold call". (Known limitation: no negation handling, so "don't expand" can misread as
  // "expand"; bounded to +-0.05 and clamped to the role baseline band, so the blast radius is tiny.)
  if (/\b(too long|verbose|wordy|shorter|too much text|rambl|cut it down)\b/.test(t)) h.verbosity = 'down';
  else if (/\b(too short\b|more detail|elaborate|expand\b|too brief|say more)/.test(t)) h.verbosity = 'up';
  if (/\b(generic|vague|be specific|more specific|no substance|surface.level|hand.?wav)/.test(t)) h.technicalDepth = 'up';
  if (/\b(too formal|stiff\b|stuffy|be casual|less formal)/.test(t)) h.formality = 'down';
  else if (/\b(too casual|unprofessional|more formal|too flippant)/.test(t)) h.formality = 'up';
  if (/\b(rude|harsh|blunt\b|too direct|softer|abrasive|condescend)/.test(t)) h.directness = 'down';
  else if (/\b(wishy.?washy|be direct|just tell me|give.*opinion|stop hedging|too diplomatic|take a stance)/.test(t)) h.directness = 'up';
  if (/\b(cold\b|robotic|no empathy|warmer|more human|dismissive)/.test(t)) h.empathy = 'up';
  if (/\b(too enthusiastic|too much hype|calm down|over the top|too excited|tone it down)/.test(t)) h.enthusiasm = 'down';
  // Fallback: a very long reply plus any length complaint in the note points at verbosity.
  if (!h.verbosity && (agentResponse || '').length > 1200 && /\b(long|too much|shorter|tl;?dr)/.test(t)) h.verbosity = 'down';
  return h;
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
  /**
   * Resolve base traits from roleIntelligence (covers all 30+ roles) with hardcoded fallback.
   */
  private static resolveBaseTraits(role?: string | null): PersonalityTraits {
    if (role) {
      const intelligence = getRoleIntelligence(role);
      if (intelligence) return { ...intelligence.baseTraitDefaults };
    }
    // Hardcoded fallback for unknown roles
    return PersonalityEvolutionEngine.DEFAULT_TRAITS['Product Manager'];
  }

  getPersonalityProfile(agentId: string, userId: string, role?: string | null): PersonalityProfile {
    // Bug 5: normalise to bare agentId — strip composite "projectId:agentId" format
    const bareAgentId = agentId.includes(':') ? agentId.split(':').pop()! : agentId;
    const key = `${bareAgentId}-${userId}`;

    if (!this.personalityProfiles.has(key)) {
      const baseTraits = PersonalityEvolutionEngine.resolveBaseTraits(role) ||
                        PersonalityEvolutionEngine.DEFAULT_TRAITS['Product Manager'];

      const profile: PersonalityProfile = {
        agentId: bareAgentId,
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
   * Bug 1: seed profile from persisted DB data so learning survives server restart.
   * No-op if profile is already live in memory.
   */
  seedProfileFromDB(
    agentId: string,
    userId: string,
    adaptedTraits: PersonalityTraits,
    meta: { interactionCount: number; adaptationConfidence: number; lastUpdated: string },
    role?: string | null
  ): void {
    const bareAgentId = agentId.includes(':') ? agentId.split(':').pop()! : agentId;
    const key = `${bareAgentId}-${userId}`;
    if (this.personalityProfiles.has(key)) return;
    const baseTraits = PersonalityEvolutionEngine.resolveBaseTraits(role);
    this.personalityProfiles.set(key, {
      agentId: bareAgentId,
      userId,
      baseTraits: { ...baseTraits },
      adaptedTraits: { ...adaptedTraits },
      interactionCount: meta.interactionCount,
      lastUpdated: new Date(meta.lastUpdated),
      adaptationConfidence: meta.adaptationConfidence,
      learningHistory: []
    });
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

    // Rec 3: skip first 3 interactions (cold start noise) + throttle to every 5th
    if (profile.interactionCount <= 3 || profile.interactionCount % 5 !== 0) {
      return profile;
    }

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
    agentResponse: string,
    role?: string | null
  ): PersonalityProfile {
    // v2.2 Phase C: pass role so a freshly-created profile resolves the correct role baseline
    // (otherwise a first-ever reaction would anchor to the generic fallback, not the role's own).
    const profile = this.getPersonalityProfile(agentId, userId, role);
    // v2.2 Phase C: feedback now accumulates. Previously this path never touched interactionCount,
    // so the persisted count stayed 0 and adaptationConfidence never grew across sessions.
    profile.interactionCount++;
    const adjustments: PersonalityAdjustment[] = [];

    // v2.2 Phase C: anchor BOTH feedback directions to the role's OWN baseline. The old math
    // collapsed every trait toward a generic 0.5 center under 👎 (erasing each role's distinct
    // personality) and pushed toward the extremes under 👍 (drifting toward sycophancy).
    //   negative → revert gently toward the role baseline (stay the distinct role, do not flatten)
    //   positive → reinforce an existing user-specific lean, bounded to a fixed band of the baseline
    const BAND = 0.15;            // adaptedTraits may never drift more than this from the role baseline
    const REVERT_STEP = 0.04;     // negative: pull back toward baseline
    const REINFORCE_STEP = 0.02;  // positive: gentle, bounded personalization
    // LEARN-02: which specific trait(s) did the feedback text actually point at?
    const hints = deriveTraitHints(messageContent, agentResponse);
    const TARGET_STEP = 0.05; // a targeted, content-aware nudge is slightly larger than the blanket drift
    const traitKeys = Object.keys(profile.adaptedTraits) as (keyof PersonalityTraits)[];
    for (const trait of traitKeys) {
      const base = profile.baseTraits[trait];
      const current = profile.adaptedTraits[trait];
      const hint = hints[trait];
      let next: number;
      let reason: string;
      if (hint && feedback === 'negative') {
        // Content-aware: a thumbs-DOWN whose note named this trait ("too long") is a correction, so
        // move the trait in the named direction. A thumbs-UP is NOT a correction, so its text must not
        // steer traits (this also stops the /api/personality/feedback caller, which passes the user's
        // own message, from lowering verbosity off words like "make it shorter" on a positive react).
        next = current + (hint === 'up' ? TARGET_STEP : -TARGET_STEP);
        reason = `Content-aware: feedback pointed at ${trait} (${hint})`;
      } else if (feedback === 'negative') {
        const delta = base - current;
        next = current + Math.sign(delta) * Math.min(REVERT_STEP, Math.abs(delta));
        reason = 'Reverting toward role baseline (no flattening)';
      } else {
        const drift = current - base;
        next = Math.abs(drift) < 0.01 ? current : current + Math.sign(drift) * REINFORCE_STEP;
        reason = 'Reinforcing user-specific lean, bounded to role baseline';
      }
      // Clamp within the baseline band, then to [0,1].
      next = Math.max(base - BAND, Math.min(base + BAND, next));
      next = Math.max(0, Math.min(1, next));
      if (Math.abs(next - current) > 0.001) {
        adjustments.push(
          this.createAdjustment(
            trait, current, next,
            feedback === 'positive' ? 'positive_feedback' : 'negative_feedback',
            reason
          )
        );
      }
    }

    this.applyAdjustments(profile, adjustments);
    // v2.2 Phase C: confidence grows with accumulated feedback (was stuck because count never moved).
    profile.adaptationConfidence = Math.min(0.9, 0.1 + profile.interactionCount * 0.05);
    profile.lastUpdated = new Date();

    console.log(`🔄 Personality updated from ${feedback} feedback: ${adjustments.length} adjustments (count=${profile.interactionCount})`);

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