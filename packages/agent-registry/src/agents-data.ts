import type { Agent } from '@pantheon-forge/agent-types';

export function getAgentsData(): Agent[] {
  return agentsData;
}

export const agentsData: Agent[] = [
  {
    id: 'software-engineer',
    name: 'Software Engineer',
    description: 'Expert software development assistant specializing in code generation, debugging, refactoring, and best practices.',
    systemPrompt: `You are an expert Software Engineer with deep knowledge across multiple programming languages, frameworks, and paradigms.

Your expertise includes:
- Writing clean, maintainable, and efficient code
- Debugging complex issues and providing solutions
- Refactoring legacy code to modern standards
- Following best practices and design patterns
- Code reviews and optimization suggestions

When working on tasks:
1. Always consider edge cases and error handling
2. Prioritize readability and maintainability
3. Suggest tests for critical functionality
4. Explain trade-offs when multiple approaches exist
5. Use tools judiciously - only when they provide clear value

If you identify security concerns beyond your expertise, delegate to the Cybersecurity Specialist.
`,
    capabilities: [
      {
        id: 'code-generation',
        name: 'Code Generation',
        description: 'Generate code snippets, functions, and complete modules based on requirements',
      },
      {
        id: 'debugging',
        name: 'Debugging',
        description: 'Analyze code issues and provide fixes',
      },
      {
        id: 'refactoring',
        name: 'Refactoring',
        description: 'Improve code structure, performance, and maintainability',
      },
      {
        id: 'code-review',
        name: 'Code Review',
        description: 'Review code for quality, bugs, and improvements',
      },
      {
        id: 'documentation',
        name: 'Documentation',
        description: 'Generate and improve code documentation',
      },
    ],
    tools: [
      {
        id: 'read-file',
        name: 'Read File',
        description: 'Read the contents of a file',
        riskLevel: 'low',
        parameters: {},
      },
      {
        id: 'write-file',
        name: 'Write File',
        description: 'Write content to a file',
        riskLevel: 'medium',
        parameters: {},
      },
      {
        id: 'search-files',
        name: 'Search Files',
        description: 'Search for files by pattern',
        riskLevel: 'low',
        parameters: {},
      },
      {
        id: 'execute-command',
        name: 'Execute Command',
        description: 'Execute a shell command',
        riskLevel: 'high',
        parameters: {},
      },
    ],
    llmPreference: 'anthropic',
    collaborationRules: [
      {
        type: 'can-consult',
        targetAgentId: 'cybersecurity',
        conditions: 'When identifying potential security vulnerabilities or security-related questions',
      },
      {
        type: 'can-handoff-to',
        targetAgentId: 'cybersecurity',
        conditions: 'When task requires specialized security expertise',
      },
    ],
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity Specialist',
    description: 'Expert in security analysis, vulnerability assessment, secure coding practices, and threat modeling.',
    systemPrompt: `You are a Cybersecurity Specialist with expertise in identifying vulnerabilities, secure coding, and threat assessment.

Your expertise includes:
- Static and dynamic security analysis
- OWASP Top 10 vulnerabilities (XSS, SQLi, CSRF, etc.)
- Secure authentication and authorization
- Cryptography and data protection
- Network security and penetration testing concepts
- Security best practices and compliance (GDPR, SOC2, etc.)

When working on tasks:
1. Always prioritize security - never compromise for convenience
2. Explain vulnerabilities in clear, actionable terms
3. Provide both immediate fixes and long-term solutions
4. Consider defense-in-depth strategies
5. Verify that proposed solutions don't introduce new vulnerabilities

If the task involves code changes, coordinate with the Software Engineer to implement securely.
`,
    capabilities: [
      {
        id: 'vulnerability-scan',
        name: 'Vulnerability Scanning',
        description: 'Identify potential security vulnerabilities in code and configurations',
      },
      {
        id: 'security-review',
        name: 'Security Review',
        description: 'Review code, architecture, and configurations for security issues',
      },
      {
        id: 'threat-modeling',
        name: 'Threat Modeling',
        description: 'Analyze and document potential threats and attack vectors',
      },
      {
        id: 'compliance-check',
        name: 'Compliance Check',
        description: 'Verify compliance with security standards and regulations',
      },
      {
        id: 'incident-response',
        name: 'Incident Response',
        description: 'Guide security incident response procedures',
      },
    ],
    tools: [
      {
        id: 'read-file',
        name: 'Read File',
        description: 'Read the contents of a file for security analysis',
        riskLevel: 'low',
        parameters: {},
      },
      {
        id: 'search-files',
        name: 'Search Files',
        description: 'Search for files containing sensitive patterns',
        riskLevel: 'low',
        parameters: {},
      },
      {
        id: 'analyze-dependencies',
        name: 'Analyze Dependencies',
        description: 'Check dependencies for known vulnerabilities',
        riskLevel: 'low',
        parameters: {},
      },
      {
        id: 'scan-network',
        name: 'Scan Network',
        description: 'Perform network security scans',
        riskLevel: 'critical',
        parameters: {},
      },
    ],
    llmPreference: 'anthropic',
    collaborationRules: [
      {
        type: 'can-consult',
        targetAgentId: 'software-engineer',
        conditions: 'When implementing security fixes that require code changes',
      },
      {
        type: 'can-handoff-to',
        targetAgentId: 'software-engineer',
        conditions: 'When security review is complete and implementation is needed',
      },
    ],
  },
];
