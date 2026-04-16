'use client';

import { Suspense, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChatStore } from '@/stores/chat';
import { useConversationsStore } from '@/stores/conversations';
import { useAgentStore } from '@/stores/agents';
import ChatInterface from '@/components/chat/ChatInterface';
import ConversationList from '@/components/chat/ConversationList';

function ChatContent() {
  const searchParams = useSearchParams();
  const agentParam = searchParams.get('agent');
  const { conversation, setConversation, loadMessages, clearMessages } = useChatStore();
  const { conversations, loadConversations, deleteConversation } = useConversationsStore();
  const { agents, init: initAgents, setAgent, currentAgent } = useAgentStore();

  useEffect(() => {
    initAgents();
    loadConversations();
  }, [initAgents, loadConversations]);

  useEffect(() => {
    if (agentParam && agents.length > 0) {
      setAgent(agentParam);
    }
  }, [agentParam, agents.length, setAgent]);

  const handleSelect = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setConversation(conv);
      loadMessages(id);
      if (conv.agent_id) {
        setAgent(conv.agent_id);
      }
    }
  }, [conversations, setConversation, loadMessages, setAgent]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteConversation(id);
    if (conversation?.id === id) {
      clearMessages();
    }
  }, [deleteConversation, conversation?.id, clearMessages]);

  const handleNew = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  return (
    <div className="flex h-full w-full">
      <ConversationList
        conversations={conversations}
        activeId={conversation?.id ?? null}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onNew={handleNew}
      />
      <main className="flex-1 flex flex-col bg-surface-primary relative">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="relative z-10 flex-1 flex flex-col">
          <ChatInterface agent={currentAgent} />
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-text-muted">Loading...</div>}>
      <ChatContent />
    </Suspense>
  );
}
