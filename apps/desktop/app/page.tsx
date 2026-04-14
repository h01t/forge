'use client';

import { useState } from 'react';

export default function Home() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const agents = [
    {
      id: 'software-engineer',
      name: 'Software Engineer',
      description: 'Expert in code generation, debugging, and best practices',
      icon: '⚡',
      color: 'from-cyan-500 to-blue-600',
      status: 'online',
    },
    {
      id: 'cybersecurity',
      name: 'Cybersecurity Specialist',
      description: 'Expert in vulnerability analysis and secure coding',
      icon: '🛡️',
      color: 'from-magenta-500 to-purple-600',
      status: 'online',
    },
  ];

  return (
    <div className="flex h-full w-full">
      {/* Sidebar - Agent Selection */}
      <aside className="w-72 bg-surface-secondary border-r border-border-default flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border-default">
          <h1 className="text-2xl font-display font-bold text-primary-500 text-glow-cyan tracking-wider">
            PANTHEON FORGE
          </h1>
          <p className="text-sm text-text-muted mt-1">AI Agent Platform</p>
        </div>

        {/* Agents List */}
        <div className="flex-1 p-4 space-y-3">
          <h2 className="text-xs font-display text-text-tertiary uppercase tracking-widest mb-4">
            Available Agents
          </h2>
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`w-full p-4 rounded-lg text-left transition-all duration-300 cyber-card
                ${selectedAgent === agent.id ? 'active' : 'opacity-70 hover:opacity-100'}
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`text-2xl p-2 rounded-lg bg-gradient-to-br ${agent.color} bg-opacity-20`}>
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-text-primary truncate">
                      {agent.name}
                    </h3>
                    <span className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-accent-500 pulse-glow' : 'bg-text-muted'}`} />
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {agent.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Settings Button */}
        <div className="p-4 border-t border-border-default">
          <button className="w-full py-3 px-4 rounded-lg cyber-button text-sm">
            ⚙️ Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-surface-primary relative">
        {/* Grid Background */}
        <div className="absolute inset-0 grid-bg pointer-events-none" />

        {selectedAgent ? (
          <>
            {/* Header */}
            <header className="relative z-10 p-6 border-b border-border-default bg-surface-secondary/80 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-display font-semibold text-primary-500">
                    {agents.find((a) => a.id === selectedAgent)?.name}
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Ready to assist
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">Status:</span>
                  <span className="text-accent-500 status-online">ONLINE</span>
                </div>
              </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 relative z-10 overflow-hidden flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="message-assistant p-4 max-w-3xl">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg">
                      {agents.find((a) => a.id === selectedAgent)?.icon}
                    </span>
                    <span className="text-sm font-display text-primary-500">
                      {agents.find((a) => a.id === selectedAgent)?.name}
                    </span>
                  </div>
                  <p className="text-text-secondary">
                    Greetings, user. I am ready to assist you with your tasks. What would you like to work on today?
                  </p>
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-border-default bg-surface-secondary/80 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto">
                  <div className="relative">
                    <textarea
                      placeholder="Type your message..."
                      className="w-full cyber-input rounded-lg resize-none"
                      rows={3}
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <button className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors">
                        📎
                      </button>
                      <button className="px-4 py-2 cyber-button text-sm rounded-lg">
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center relative z-10">
            <div className="text-center max-w-lg p-8">
              <div className="text-6xl mb-6 animate-pulse">⚡</div>
              <h2 className="text-3xl font-display font-bold text-primary-500 text-glow-cyan mb-4">
                Welcome to Pantheon Forge
              </h2>
              <p className="text-text-secondary mb-8">
                Select an agent from the sidebar to begin. Each agent specializes in different domains
                and can collaborate to solve complex tasks.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-surface-tertiary border border-border-default">
                  <div className="text-2xl mb-2">🤝</div>
                  <h3 className="font-display text-sm text-text-primary mb-1">Collaboration</h3>
                  <p className="text-xs text-text-tertiary">Agents can work together</p>
                </div>
                <div className="p-4 rounded-lg bg-surface-tertiary border border-border-default">
                  <div className="text-2xl mb-2">🔒</div>
                  <h3 className="font-display text-sm text-text-primary mb-1">Secure</h3>
                  <p className="text-xs text-text-tertiary">Local-first, encrypted</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
