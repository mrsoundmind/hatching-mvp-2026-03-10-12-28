// Combined AI Training System for Hatchin Colleagues
// Integrates: 1) User Feedback, 2) Custom Examples, 3) Role Profile Editing

interface TrainingFeedback {
  id: string;
  conversationId: string;
  messageId: string;
  userMessage: string;
  agentResponse: string;
  agentRole: string;
  rating: 'good' | 'bad' | 'excellent';
  feedback?: string;
  timestamp: string;
}

interface CustomExample {
  id: string;
  agentRole: string;
  userInput: string;
  idealResponse: string;
  category: string;
  createdAt: string;
}

interface CustomRoleProfile {
  id: string;
  agentRole: string;
  personality?: string;
  expertMindset?: string;
  communicationStyle?: string;
  responseLength?: 'short' | 'medium' | 'long';
  tone?: 'formal' | 'casual' | 'technical' | 'friendly';
  customPrompt?: string;
  companyTerminology?: string[];
  createdAt: string;
  updatedAt: string;
}

interface LearningPattern {
  agentRole: string;
  keywords: string[];
  preferredResponseStyle: string;
  responseLength: 'short' | 'medium' | 'long';
  tone: 'formal' | 'casual' | 'technical' | 'friendly';
  confidence: number;
}

export class TrainingSystem {
  private feedback: TrainingFeedback[] = [];
  private customExamples: CustomExample[] = [];
  private customRoleProfiles: CustomRoleProfile[] = [];
  private learningPatterns: LearningPattern[] = [];

  // Add feedback for a colleague response
  addFeedback(feedback: Omit<TrainingFeedback, 'id' | 'timestamp'>) {
    const trainingFeedback: TrainingFeedback = {
      ...feedback,
      id: `feedback-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    
    this.feedback.push(trainingFeedback);
    this.updateLearningPatterns(trainingFeedback);
    
    console.log(`Training feedback recorded: ${feedback.rating} for ${feedback.agentRole}`);
    return trainingFeedback;
  }

  // Add custom example conversation
  addCustomExample(example: Omit<CustomExample, 'id' | 'createdAt'>) {
    const customExample: CustomExample = {
      ...example,
      id: `example-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    this.customExamples.push(customExample);
    console.log(`Custom example added for ${example.agentRole}`);
    return customExample;
  }

  // Create or update custom role profile
  updateRoleProfile(profile: Omit<CustomRoleProfile, 'id' | 'createdAt' | 'updatedAt'>) {
    const existingIndex = this.customRoleProfiles.findIndex(p => p.agentRole === profile.agentRole);
    
    if (existingIndex >= 0) {
      // Update existing profile
      this.customRoleProfiles[existingIndex] = {
        ...this.customRoleProfiles[existingIndex],
        ...profile,
        updatedAt: new Date().toISOString()
      };
      console.log(`Role profile updated for ${profile.agentRole}`);
      return this.customRoleProfiles[existingIndex];
    } else {
      // Create new profile
      const newProfile: CustomRoleProfile = {
        ...profile,
        id: `profile-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.customRoleProfiles.push(newProfile);
      console.log(`Role profile created for ${profile.agentRole}`);
      return newProfile;
    }
  }

  // Get custom role profile for an agent
  getCustomRoleProfile(agentRole: string): CustomRoleProfile | null {
    return this.customRoleProfiles.find(p => p.agentRole === agentRole) || null;
  }

  // Get training data for a specific agent role
  getTrainingData(agentRole: string) {
    const roleFeedback = this.feedback.filter(f => f.agentRole === agentRole);
    const roleExamples = this.customExamples.filter(e => e.agentRole === agentRole);
    const rolePatterns = this.learningPatterns.filter(p => p.agentRole === agentRole);

    return {
      feedback: roleFeedback,
      examples: roleExamples,
      patterns: rolePatterns,
      goodResponses: roleFeedback.filter(f => f.rating === 'good' || f.rating === 'excellent'),
      badResponses: roleFeedback.filter(f => f.rating === 'bad')
    };
  }

  // Generate comprehensive enhanced prompt based on all training methods
  generateEnhancedPrompt(agentRole: string, userMessage: string, basePrompt: string): string {
    const trainingData = this.getTrainingData(agentRole);
    const customProfile = this.getCustomRoleProfile(agentRole);
    
    let enhancedPrompt = basePrompt;

    // Method 1: Custom Role Profile Override
    if (customProfile) {
      enhancedPrompt += "\n\n=== CUSTOM ROLE PROFILE ===";
      
      if (customProfile.personality) {
        enhancedPrompt += `\nPersonality Override: ${customProfile.personality}`;
      }
      
      if (customProfile.expertMindset) {
        enhancedPrompt += `\nExpert Mindset: ${customProfile.expertMindset}`;
      }
      
      if (customProfile.communicationStyle) {
        enhancedPrompt += `\nCommunication Style: ${customProfile.communicationStyle}`;
      }
      
      if (customProfile.customPrompt) {
        enhancedPrompt += `\nCustom Instructions: ${customProfile.customPrompt}`;
      }
      
      if (customProfile.companyTerminology && customProfile.companyTerminology.length > 0) {
        enhancedPrompt += `\nCompany Terminology: Use these terms naturally: ${customProfile.companyTerminology.join(', ')}`;
      }
      
      if (customProfile.tone) {
        enhancedPrompt += `\nPreferred Tone: ${customProfile.tone}`;
      }
      
      if (customProfile.responseLength) {
        enhancedPrompt += `\nResponse Length: ${customProfile.responseLength}`;
      }
    }

    // Method 2: Custom Training Examples
    if (trainingData.examples.length > 0) {
      enhancedPrompt += "\n\n=== CUSTOM TRAINING EXAMPLES ===";
      enhancedPrompt += "\nFollow these exact conversation patterns:";
      trainingData.examples.slice(-5).forEach((example, index) => {
        enhancedPrompt += `\n\nExample ${index + 1}:`;
        enhancedPrompt += `\nUser: "${example.userInput}"`;
        enhancedPrompt += `\nIdeal Response: "${example.idealResponse}"`;
      });
    }

    // Method 3: Feedback-Based Learning Patterns
    if (trainingData.goodResponses.length > 0) {
      enhancedPrompt += "\n\n=== SUCCESSFUL RESPONSE PATTERNS ===";
      enhancedPrompt += "\nThese responses received positive feedback - emulate this style:";
      trainingData.goodResponses.slice(-3).forEach((response, index) => {
        enhancedPrompt += `\n\nGood Example ${index + 1}:`;
        enhancedPrompt += `\nUser: "${response.userMessage}"`;
        enhancedPrompt += `\nWell-Received Response: "${response.agentResponse}"`;
        if (response.feedback) {
          enhancedPrompt += `\nUser Feedback: "${response.feedback}"`;
        }
      });
    }

    // Add learned behavioral patterns
    if (trainingData.patterns.length > 0) {
      const pattern = trainingData.patterns[0];
      enhancedPrompt += "\n\n=== LEARNED PREFERENCES ===";
      enhancedPrompt += `\n- Preferred Response Style: ${pattern.preferredResponseStyle}`;
      enhancedPrompt += `\n- Communication Tone: ${pattern.tone}`;
      enhancedPrompt += `\n- Response Length: ${pattern.responseLength}`;
      enhancedPrompt += `\n- Key Focus Areas: ${pattern.keywords.join(', ')}`;
      enhancedPrompt += `\n- Learning Confidence: ${Math.round(pattern.confidence * 100)}%`;
    }

    // Add responses to avoid (from negative feedback)
    if (trainingData.badResponses.length > 0) {
      enhancedPrompt += "\n\n=== AVOID THESE PATTERNS ===";
      enhancedPrompt += "\nThese responses received negative feedback - avoid similar approaches:";
      trainingData.badResponses.slice(-2).forEach((response, index) => {
        enhancedPrompt += `\n\nAvoid Pattern ${index + 1}:`;
        enhancedPrompt += `\nUser: "${response.userMessage}"`;
        enhancedPrompt += `\nPoor Response: "${response.agentResponse}"`;
        if (response.feedback) {
          enhancedPrompt += `\nWhy it failed: "${response.feedback}"`;
        }
      });
    }

    enhancedPrompt += "\n\n=== FINAL INSTRUCTION ===";
    enhancedPrompt += "\nApply ALL the above training while maintaining your core role identity. Prioritize: 1) Custom role profile, 2) Training examples, 3) Learned patterns from feedback.";
    
    return enhancedPrompt;
  }

  // Update learning patterns based on feedback
  private updateLearningPatterns(feedback: TrainingFeedback) {
    const existingPattern = this.learningPatterns.find(p => p.agentRole === feedback.agentRole);
    
    if (feedback.rating === 'good' || feedback.rating === 'excellent') {
      const keywords = this.extractKeywords(feedback.userMessage);
      const responseStyle = this.analyzeResponseStyle(feedback.agentResponse);
      const tone = this.analyzeTone(feedback.agentResponse);
      const responseLength = this.analyzeLength(feedback.agentResponse);

      if (existingPattern) {
        // Update existing pattern
        existingPattern.keywords = [...new Set([...existingPattern.keywords, ...keywords])];
        existingPattern.preferredResponseStyle = responseStyle;
        existingPattern.tone = tone;
        existingPattern.responseLength = responseLength;
        existingPattern.confidence = Math.min(existingPattern.confidence + 0.1, 1.0);
      } else {
        // Create new pattern
        this.learningPatterns.push({
          agentRole: feedback.agentRole,
          keywords,
          preferredResponseStyle: responseStyle,
          tone,
          responseLength,
          confidence: 0.7
        });
      }
    }
  }

  // Extract keywords from user message
  private extractKeywords(message: string): string[] {
    const words = message.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return words.filter(word => word.length > 3 && !stopWords.includes(word)).slice(0, 5);
  }

  // Analyze response style
  private analyzeResponseStyle(response: string): string {
    if (response.includes('?')) return 'questioning';
    if (response.includes('Let me') || response.includes('I\'ll')) return 'proactive';
    if (response.includes('Here\'s') || response.includes('Try this')) return 'directive';
    return 'conversational';
  }

  // Analyze tone
  private analyzeTone(response: string): 'formal' | 'casual' | 'technical' | 'friendly' {
    if (response.includes('API') || response.includes('database') || response.includes('code')) return 'technical';
    if (response.includes('!') || response.includes('Great') || response.includes('Perfect')) return 'friendly';
    if (response.length > 100 && !response.includes('!')) return 'formal';
    return 'casual';
  }

  // Analyze response length
  private analyzeLength(response: string): 'short' | 'medium' | 'long' {
    if (response.length < 50) return 'short';
    if (response.length < 150) return 'medium';
    return 'long';
  }

  // Get comprehensive training statistics
  getTrainingStats() {
    const totalFeedback = this.feedback.length;
    const goodFeedback = this.feedback.filter(f => f.rating === 'good' || f.rating === 'excellent').length;
    const badFeedback = this.feedback.filter(f => f.rating === 'bad').length;
    
    const roleStats = Object.entries(
      this.feedback.reduce((acc, f) => {
        acc[f.agentRole] = (acc[f.agentRole] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    );

    const customProfileStats = Object.entries(
      this.customRoleProfiles.reduce((acc, p) => {
        acc[p.agentRole] = (acc[p.agentRole] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    );

    return {
      // Method 1: Feedback Learning
      totalFeedback,
      goodFeedback,
      badFeedback,
      successRate: totalFeedback > 0 ? Math.round((goodFeedback / totalFeedback) * 100) : 0,
      roleStats,
      
      // Method 2: Custom Examples
      customExamples: this.customExamples.length,
      examplesByRole: Object.entries(
        this.customExamples.reduce((acc, e) => {
          acc[e.agentRole] = (acc[e.agentRole] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ),
      
      // Method 3: Role Profile Customization
      customProfiles: this.customRoleProfiles.length,
      profilesByRole: customProfileStats,
      
      // Combined Intelligence
      learningPatterns: this.learningPatterns.length,
      totalTrainingMethods: 3,
      activeTrainingTypes: [
        this.feedback.length > 0 ? 'Feedback Learning' : null,
        this.customExamples.length > 0 ? 'Custom Examples' : null,
        this.customRoleProfiles.length > 0 ? 'Role Profiles' : null
      ].filter(Boolean)
    };
  }
}

// Global training system instance
export const trainingSystem = new TrainingSystem();