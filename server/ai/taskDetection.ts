import { OpenAI } from 'openai';

// Initialize OpenAI client conditionally
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export interface TaskSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  suggestedAssignee: {
    id: string;
    name: string;
    role: string;
  };
  category: string;
  estimatedEffort: string;
  reasoning: string;
}

export interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  projectId: string;
  teamId?: string;
  agentId?: string;
  availableAgents: Array<{
    id: string;
    name: string;
    role: string;
    expertise: string[];
  }>;
}

export class TaskDetectionAI {
  private static readonly TASK_DETECTION_PROMPT = `
You are an AI assistant that analyzes conversations to identify potential tasks that should be created.

Your job is to:
1. Analyze the conversation for actionable items
2. Suggest specific, well-defined tasks
3. Assign appropriate team members based on their expertise
4. Set realistic priorities without timestamps
5. Provide clear reasoning for each suggestion

Guidelines:
- Only suggest tasks that are clearly actionable
- Avoid suggesting tasks for vague or incomplete ideas
- Focus on concrete deliverables
- Consider the team members' expertise when assigning
- Use High priority for critical path items
- Use Medium priority for important but not urgent items
- Use Low priority for nice-to-have items
- Never include due dates or timestamps

Available team members:
{availableAgents}

Conversation context:
- Project: {projectId}
- Team: {teamId}
- Agent: {agentId}

Analyze this conversation and suggest tasks if appropriate. Return a JSON array of task suggestions, or an empty array if no tasks should be created.

Format your response as JSON:
[
  {
    "id": "unique-task-id",
    "title": "Clear, actionable task title",
    "description": "Detailed description of what needs to be done",
    "priority": "High|Medium|Low",
    "suggestedAssignee": {
      "id": "agent-id",
      "name": "Agent Name",
      "role": "Agent Role"
    },
    "category": "Development|Design|Planning|Research|Testing|Documentation",
    "estimatedEffort": "Small|Medium|Large",
    "reasoning": "Why this task is needed based on the conversation"
  }
]
`;

  static async analyzeConversationForTasks(
    context: ConversationContext
  ): Promise<TaskSuggestion[]> {
    try {
      if (!openai) {
        console.log('⚠️  OpenAI API key not configured. Skipping task detection.');
        return [];
      }

      console.log('🔍 TaskDetectionAI: Starting analysis...');
      console.log('📊 Context:', {
        projectId: context.projectId,
        teamId: context.teamId,
        agentId: context.agentId,
        messageCount: context.messages.length
      });

      // Format available agents for the prompt
      const agentsList = context.availableAgents
        .map(agent => `- ${agent.name} (${agent.role}): ${agent.expertise.join(', ')}`)
        .join('\n');

      // Create conversation history for analysis
      const conversationText = context.messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');

      console.log('💬 Conversation text:', conversationText.substring(0, 200) + '...');

      const prompt = this.TASK_DETECTION_PROMPT
        .replace('{availableAgents}', agentsList)
        .replace('{projectId}', context.projectId)
        .replace('{teamId}', context.teamId || 'N/A')
        .replace('{agentId}', context.agentId || 'N/A');

      const fullPrompt = `${prompt}\n\nConversation:\n${conversationText}`;
      
      console.log('🤖 Calling OpenAI API...');

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a task detection AI that analyzes conversations and suggests actionable tasks. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      console.log('✅ OpenAI API response received');
      const content = response.choices[0]?.message?.content;
      console.log('📝 Raw response:', content);
      
      if (!content) {
        console.log('⚠️  No content in OpenAI response');
        return [];
      }

      // Parse the JSON response
      const suggestions = JSON.parse(content);
      console.log('📊 Parsed suggestions:', suggestions);
      
      // Validate and clean the suggestions
      const validSuggestions = suggestions
        .filter((suggestion: any) => this.validateTaskSuggestion(suggestion))
        .map((suggestion: any) => ({
          ...suggestion,
          id: suggestion.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
      
      console.log('✅ Valid suggestions:', validSuggestions.length);
      return validSuggestions;

    } catch (error) {
      console.error('❌ Error analyzing conversation for tasks:', error);
      return [];
    }
  }

  private static validateTaskSuggestion(suggestion: any): boolean {
    return (
      suggestion &&
      typeof suggestion.title === 'string' &&
      typeof suggestion.description === 'string' &&
      ['High', 'Medium', 'Low'].includes(suggestion.priority) &&
      suggestion.suggestedAssignee &&
      typeof suggestion.suggestedAssignee.id === 'string' &&
      typeof suggestion.suggestedAssignee.name === 'string' &&
      typeof suggestion.suggestedAssignee.role === 'string' &&
      typeof suggestion.category === 'string' &&
      typeof suggestion.estimatedEffort === 'string' &&
      typeof suggestion.reasoning === 'string'
    );
  }

  static async shouldAnalyzeConversation(
    messages: Array<{ role: string; content: string; timestamp: Date }>
  ): Promise<boolean> {
    console.log('🔍 shouldAnalyzeConversation: Checking conversation...');
    console.log('📊 Message count:', messages.length);
    
    // Only analyze if there are at least 3 messages and the last message is from user
    if (messages.length < 3) {
      console.log('⚠️  Not enough messages (need at least 3)');
      return false;
    }
    
    const lastMessage = messages[messages.length - 1];
    console.log('👤 Last message role:', lastMessage.role);
    // Check for both 'user' and 'user' messageType
    if (lastMessage.role !== 'user' && lastMessage.role !== 'user') {
      console.log('⚠️  Last message is not from user');
      return false;
    }

    // Check for task-related keywords
    const taskKeywords = [
      'need to', 'should', 'must', 'have to', 'implement', 'create', 'build',
      'develop', 'design', 'plan', 'schedule', 'organize', 'setup', 'configure',
      'fix', 'update', 'improve', 'optimize', 'test', 'review', 'deploy'
    ];

    const recentMessages = messages
      .slice(-3)
      .map((m) => (typeof m.content === 'string' ? m.content.toLowerCase() : ''))
      .join(' ');
    console.log('💬 Recent messages:', recentMessages.substring(0, 100) + '...');
    
    const hasKeywords = taskKeywords.some(keyword => recentMessages.includes(keyword));
    console.log('🔑 Has task keywords:', hasKeywords);
    
    if (hasKeywords) {
      const foundKeywords = taskKeywords.filter(keyword => recentMessages.includes(keyword));
      console.log('🎯 Found keywords:', foundKeywords);
    }
    
    return hasKeywords;
  }
}
