import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { 
  AIProvider, 
  AIConfig, 
  AIQuery, 
  AIResponse,
  generateId,
  isDangerousCommand 
} from '@ai-terminal/shared';

export class AIService {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private defaultProvider: AIProvider = AIProvider.OPENAI;

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    // Initialize Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }

    // Set default provider based on available API keys
    if (process.env.ANTHROPIC_API_KEY) {
      this.defaultProvider = AIProvider.ANTHROPIC;
    } else if (process.env.OPENAI_API_KEY) {
      this.defaultProvider = AIProvider.OPENAI;
    }
  }

  async translateNaturalLanguage(
    query: string, 
    systemContext?: string,
    provider?: AIProvider
  ): Promise<AIResponse> {
    const responseId = generateId();
    const queryId = generateId();
    const selectedProvider = provider || this.defaultProvider;

    try {
      const systemPrompt = this.buildSystemPrompt(systemContext);
      const userPrompt = this.buildTranslationPrompt(query);

      let response: string;
      let commands: string[] = [];
      let explanation: string = '';
      let warnings: string[] = [];
      let confidence: number = 0.8;

      if (selectedProvider === AIProvider.OPENAI && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });

        response = completion.choices[0]?.message?.content || '';
        const parsed = this.parseAIResponse(response);
        commands = parsed.commands;
        explanation = parsed.explanation;
        warnings = parsed.warnings;
        confidence = parsed.confidence;

      } else if (selectedProvider === AIProvider.ANTHROPIC && this.anthropic) {
        const completion = await this.anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          temperature: 0.3,
          messages: [
            {
              role: 'user', 
              content: `${systemPrompt}\n\nUser Query: ${userPrompt}`
            }
          ]
        });

        response = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
        const parsed = this.parseAIResponse(response);
        commands = parsed.commands;
        explanation = parsed.explanation;
        warnings = parsed.warnings;
        confidence = parsed.confidence;

      } else {
        throw new Error(`AI provider ${selectedProvider} not available or not configured`);
      }

      // Add safety warnings for dangerous commands
      for (const command of commands) {
        if (isDangerousCommand(command)) {
          warnings.push(`⚠️ Potentially dangerous command: ${command}`);
          confidence = Math.min(confidence, 0.6); // Reduce confidence for dangerous commands
        }
      }

      return {
        id: responseId,
        queryId,
        response,
        commands,
        explanation,
        warnings,
        confidence,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('AI translation error:', error);
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async explainCommand(
    command: string,
    provider?: AIProvider
  ): Promise<AIResponse> {
    const responseId = generateId();
    const queryId = generateId();
    const selectedProvider = provider || this.defaultProvider;

    try {
      const systemPrompt = this.buildExplanationSystemPrompt();
      const userPrompt = `Explain this command: ${command}`;

      let response: string;
      let explanation: string = '';
      let warnings: string[] = [];
      let confidence: number = 0.9;

      if (selectedProvider === AIProvider.OPENAI && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 800
        });

        response = completion.choices[0]?.message?.content || '';
        explanation = response;

      } else if (selectedProvider === AIProvider.ANTHROPIC && this.anthropic) {
        const completion = await this.anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 800,
          temperature: 0.2,
          messages: [
            {
              role: 'user', 
              content: `${systemPrompt}\n\nCommand to explain: ${userPrompt}`
            }
          ]
        });

        response = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
        explanation = response;

      } else {
        throw new Error(`AI provider ${selectedProvider} not available or not configured`);
      }

      // Add safety warnings for dangerous commands
      if (isDangerousCommand(command)) {
        warnings.push(`⚠️ This is a potentially dangerous command that could harm your system`);
        warnings.push(`🛡️ Please review carefully before executing`);
      }

      return {
        id: responseId,
        queryId,
        response,
        commands: [command],
        explanation,
        warnings,
        confidence,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('AI explanation error:', error);
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildSystemPrompt(systemContext?: string): string {
    return `You are an expert Linux system administrator assistant. Your job is to translate natural language requests into precise Linux commands.

Rules:
1. Always respond in this JSON format:
{
  "commands": ["command1", "command2"],
  "explanation": "Brief explanation of what these commands do",
  "confidence": 0.8
}

2. Provide only safe, commonly used commands
3. If the request is unclear, ask for clarification
4. Include brief explanations for complex commands
5. Never suggest commands that could harm the system without explicit warning
6. For file operations, use relative paths unless absolute paths are specifically requested

${systemContext ? `System Context: ${systemContext}` : ''}

Current system is Linux with standard tools available.`;
  }

  private buildExplanationSystemPrompt(): string {
    return `You are an expert Linux system administrator. Explain Linux commands in a clear, educational way.

Explain:
1. What the command does
2. Key flags and options used
3. Potential risks or side effects
4. Common use cases
5. Alternative approaches if applicable

Be concise but thorough. Use examples when helpful.`;
  }

  private buildTranslationPrompt(query: string): string {
    return `Translate this natural language request into Linux commands:

"${query}"

Respond with the exact JSON format specified in the system prompt.`;
  }

  private parseAIResponse(response: string): {
    commands: string[];
    explanation: string;
    warnings: string[];
    confidence: number;
  } {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          commands: parsed.commands || [],
          explanation: parsed.explanation || response,
          warnings: parsed.warnings || [],
          confidence: parsed.confidence || 0.7
        };
      }

      // Fallback: extract commands from markdown code blocks
      const codeBlocks = response.match(/```(?:bash|shell)?\n(.*?)\n```/gs);
      const commands = codeBlocks 
        ? codeBlocks.map(block => block.replace(/```(?:bash|shell)?\n|\n```/g, '').trim())
        : [];

      return {
        commands,
        explanation: response,
        warnings: [],
        confidence: 0.6
      };

    } catch (error) {
      console.error('Error parsing AI response:', error);
      return {
        commands: [],
        explanation: response,
        warnings: ['Failed to parse AI response properly'],
        confidence: 0.3
      };
    }
  }

  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    
    if (this.openai) {
      providers.push(AIProvider.OPENAI);
    }
    
    if (this.anthropic) {
      providers.push(AIProvider.ANTHROPIC);
    }
    
    return providers;
  }

  isProviderAvailable(provider: AIProvider): boolean {
    switch (provider) {
      case AIProvider.OPENAI:
        return !!this.openai;
      case AIProvider.ANTHROPIC:
        return !!this.anthropic;
      default:
        return false;
    }
  }
} 