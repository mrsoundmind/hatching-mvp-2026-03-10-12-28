// Custom Logic Functions for Each Colleague Type
// Add specialized behaviors and calculations for different roles

interface LogicResult {
  shouldExecute: boolean;
  result?: any;
  enhancedResponse?: string;
}

// Product Manager Logic
export const productManagerLogic = {
  // Priority scoring for feature requests
  scorePriority: (userMessage: string): LogicResult => {
    const keywords = ['urgent', 'critical', 'users complaining', 'revenue impact'];
    const hasUrgentKeywords = keywords.some(word => 
      userMessage.toLowerCase().includes(word)
    );
    
    if (hasUrgentKeywords) {
      return {
        shouldExecute: true,
        result: { priority: 'high', score: 9 },
        enhancedResponse: "🔴 High priority detected. This needs immediate attention based on urgency indicators."
      };
    }
    
    return { shouldExecute: false };
  },

  // Roadmap timeline estimation
  estimateTimeline: (userMessage: string): LogicResult => {
    if (userMessage.toLowerCase().includes('roadmap') || userMessage.toLowerCase().includes('timeline')) {
      const features = (userMessage.match(/feature|functionality|component/gi) || []).length;
      const estimatedWeeks = Math.max(2, features * 2);
      
      return {
        shouldExecute: true,
        result: { weeks: estimatedWeeks, features },
        enhancedResponse: `Based on ${features} features mentioned, I estimate ${estimatedWeeks} weeks for delivery.`
      };
    }
    
    return { shouldExecute: false };
  }
};

// Backend Developer Logic
export const backendDeveloperLogic = {
  // Database optimization suggestions
  analyzeDatabaseIssue: (userMessage: string): LogicResult => {
    const dbKeywords = ['slow query', 'database slow', 'performance issue', 'timeout'];
    const hasDatabaseIssue = dbKeywords.some(word => 
      userMessage.toLowerCase().includes(word)
    );
    
    if (hasDatabaseIssue) {
      const suggestions = [
        'Add indexes on frequently queried columns',
        'Implement query caching',
        'Consider database connection pooling',
        'Review N+1 query patterns'
      ];
      
      return {
        shouldExecute: true,
        result: { type: 'database_optimization', suggestions },
        enhancedResponse: `Database performance issue detected. Key optimizations: ${suggestions.slice(0, 2).join(', ')}`
      };
    }
    
    return { shouldExecute: false };
  },

  // Security audit checks
  securityAudit: (userMessage: string): LogicResult => {
    const securityTerms = ['auth', 'login', 'password', 'security', 'vulnerability'];
    const hasSecurityContext = securityTerms.some(term => 
      userMessage.toLowerCase().includes(term)
    );
    
    if (hasSecurityContext) {
      const securityChecks = [
        'JWT token expiration handling',
        'Input validation and sanitization', 
        'Rate limiting implementation',
        'HTTPS enforcement'
      ];
      
      return {
        shouldExecute: true,
        result: { securityChecks, riskLevel: 'medium' },
        enhancedResponse: `Security review needed. Priority checks: ${securityChecks[0]}, ${securityChecks[1]}`
      };
    }
    
    return { shouldExecute: false };
  }
};

// UI Engineer Logic
export const uiEngineerLogic = {
  // Performance optimization
  analyzePerformance: (userMessage: string): LogicResult => {
    const perfKeywords = ['slow', 'laggy', 'performance', 'loading'];
    const hasPerformanceIssue = perfKeywords.some(word => 
      userMessage.toLowerCase().includes(word)
    );
    
    if (hasPerformanceIssue) {
      const optimizations = [
        'Bundle size analysis and code splitting',
        'Image optimization and lazy loading',
        'Component virtualization for large lists',
        'Memoization of expensive calculations'
      ];
      
      return {
        shouldExecute: true,
        result: { optimizations, impact: 'high' },
        enhancedResponse: `Performance issue identified. Top fixes: ${optimizations[0]}, ${optimizations[1]}`
      };
    }
    
    return { shouldExecute: false };
  },

  // Responsive design helper
  responsiveDesignCheck: (userMessage: string): LogicResult => {
    if (userMessage.toLowerCase().includes('mobile') || userMessage.toLowerCase().includes('responsive')) {
      const breakpoints = {
        mobile: '320px - 768px',
        tablet: '768px - 1024px', 
        desktop: '1024px+'
      };
      
      return {
        shouldExecute: true,
        result: { breakpoints, approach: 'mobile-first' },
        enhancedResponse: `I'll implement mobile-first responsive design with breakpoints: mobile (${breakpoints.mobile}), tablet (${breakpoints.tablet})`
      };
    }
    
    return { shouldExecute: false };
  }
};

// QA Lead Logic
export const qaLeadLogic = {
  // Test case generation
  generateTestCases: (userMessage: string): LogicResult => {
    if (userMessage.toLowerCase().includes('test') || userMessage.toLowerCase().includes('bug')) {
      const testTypes = [
        'Happy path user flow',
        'Edge cases and error handling',
        'Cross-browser compatibility',
        'Mobile device testing',
        'Performance under load'
      ];
      
      return {
        shouldExecute: true,
        result: { testTypes, priority: 'critical' },
        enhancedResponse: `I'll create test cases covering: ${testTypes.slice(0, 3).join(', ')}`
      };
    }
    
    return { shouldExecute: false };
  },

  // Risk assessment
  assessRisk: (userMessage: string): LogicResult => {
    const riskKeywords = ['deploy', 'release', 'ship', 'production'];
    const hasDeploymentContext = riskKeywords.some(word => 
      userMessage.toLowerCase().includes(word)
    );
    
    if (hasDeploymentContext) {
      const riskFactors = [
        'Untested integration points',
        'Database migration complexity',
        'Third-party service dependencies',
        'Rollback strategy readiness'
      ];
      
      return {
        shouldExecute: true,
        result: { riskFactors, riskLevel: 'medium' },
        enhancedResponse: `Deployment risk assessment: Monitor ${riskFactors[0]} and ${riskFactors[1]}`
      };
    }
    
    return { shouldExecute: false };
  }
};

// Product Designer Logic
export const productDesignerLogic = {
  // UX flow analysis
  analyzeUserFlow: (userMessage: string): LogicResult => {
    const uxKeywords = ['user', 'flow', 'journey', 'experience', 'confusing'];
    const hasUXContext = uxKeywords.some(word => 
      userMessage.toLowerCase().includes(word)
    );
    
    if (hasUXContext) {
      const uxPrinciples = [
        'Reduce cognitive load',
        'Clear visual hierarchy',
        'Consistent interaction patterns',
        'Accessible design standards'
      ];
      
      return {
        shouldExecute: true,
        result: { principles: uxPrinciples, approach: 'user-centered' },
        enhancedResponse: `I'll redesign focusing on: ${uxPrinciples[0]} and ${uxPrinciples[1]}`
      };
    }
    
    return { shouldExecute: false };
  }
};

// Main logic router - determines which colleague logic to apply
export function executeColleagueLogic(agentRole: string, userMessage: string): LogicResult {
  switch (agentRole) {
    case 'Product Manager':
      // Try priority scoring first, then timeline estimation
      const priorityResult = productManagerLogic.scorePriority(userMessage);
      if (priorityResult.shouldExecute) return priorityResult;
      
      return productManagerLogic.estimateTimeline(userMessage);
      
    case 'Backend Developer':
      // Try database analysis first, then security audit
      const dbResult = backendDeveloperLogic.analyzeDatabaseIssue(userMessage);
      if (dbResult.shouldExecute) return dbResult;
      
      return backendDeveloperLogic.securityAudit(userMessage);
      
    case 'UI Engineer':
      // Try performance analysis first, then responsive design
      const perfResult = uiEngineerLogic.analyzePerformance(userMessage);
      if (perfResult.shouldExecute) return perfResult;
      
      return uiEngineerLogic.responsiveDesignCheck(userMessage);
      
    case 'QA Lead':
      // Try test case generation first, then risk assessment
      const testResult = qaLeadLogic.generateTestCases(userMessage);
      if (testResult.shouldExecute) return testResult;
      
      return qaLeadLogic.assessRisk(userMessage);
      
    case 'Product Designer':
      return productDesignerLogic.analyzeUserFlow(userMessage);
      
    default:
      return { shouldExecute: false };
  }
}