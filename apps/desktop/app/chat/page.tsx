'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { List } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import ChatInterface from '@/components/chat/ChatInterface';
import ConversationList from '@/components/chat/ConversationList';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useAgentStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { useConversationsStore } from '@/stores/conversations';
import { useShellStore } from '@/stores/shell';

function ChatContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const agentParam = searchParams.get('agent');
  const conversationParam = searchParams.get('conversation');
  const isNarrowWorkspace = useMediaQuery('(max-width: 1179px)');
  const { conversation, setConversation, loadMessages, clearMessages } = useChatStore();
  const { conversations, loadConversations, deleteConversation } = useConversationsStore();
  const { agents, setAgent, currentAgent } = useAgentStore();
  const {
    conversationPanelOpen,
    setConversationPanelOpen,
    toggleConversationPanel,
  } = useShellStore();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (agentParam && agents.length > 0) {
      setAgent(agentParam);
    }
  }, [agentParam, agents.length, setAgent]);

  useEffect(() => {
    if (!isNarrowWorkspace && conversationPanelOpen) {
      setConversationPanelOpen(false);
    }
  }, [conversationPanelOpen, isNarrowWorkspace, setConversationPanelOpen]);

  const handleSelect = useCallback(
    (id: string) => {
      const targetConversation = conversations.find((item) => item.id === id);
      if (!targetConversation) {
        return;
      }

      setConversation(targetConversation);
      loadMessages(id);
      if (targetConversation.agent_id) {
        setAgent(targetConversation.agent_id);
      }

      const params = new URLSearchParams(searchParams.toString());
      params.set('conversation', id);
      if (targetConversation.agent_id && targetConversation.agent_id !== 'default') {
        params.set('agent', targetConversation.agent_id);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      if (isNarrowWorkspace) {
        setConversationPanelOpen(false);
      }
    },
    [
      conversations,
      isNarrowWorkspace,
      loadMessages,
      pathname,
      router,
      searchParams,
      setAgent,
      setConversation,
      setConversationPanelOpen,
    ],
  );

  useEffect(() => {
    if (
      conversationParam &&
      conversations.length > 0 &&
      conversation?.id !== conversationParam
    ) {
      handleSelect(conversationParam);
    }
  }, [conversation?.id, conversationParam, conversations.length, handleSelect]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (conversation?.id === id) {
        clearMessages();
      }
    },
    [clearMessages, conversation?.id, deleteConversation],
  );

  const handleNew = useCallback(() => {
    clearMessages();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('conversation');
    router.replace(
      params.toString() ? `${pathname}?${params.toString()}` : pathname,
      { scroll: false },
    );
    if (isNarrowWorkspace) {
      setConversationPanelOpen(false);
    }
  }, [
    clearMessages,
    isNarrowWorkspace,
    pathname,
    router,
    searchParams,
    setConversationPanelOpen,
  ]);

  const shellDescription = currentAgent
    ? `${currentAgent.name} is active. Keep the thread list on the left, the utility controls above, and the conversation flowing through the full workspace canvas.`
    : 'Use the launchpad to pick an agent, then work inside a calmer, wider chat surface.';

  return (
    <AppShell
      title="Chat Workspace"
      description={shellDescription}
      stageWidth="workspace"
      actions={
        isNarrowWorkspace ? (
          <button
            type="button"
            onClick={toggleConversationPanel}
            className="inline-flex items-center gap-2 rounded-2xl border border-border-highlight bg-surface-secondary px-4 py-3 text-sm text-text-primary transition-all duration-200 hover:border-primary-500/30 hover:bg-surface-hover"
          >
            <List size={16} />
            Threads
          </button>
        ) : null
      }
    >
      <div className="relative">
        <div
          className="grid gap-6"
          style={
            isNarrowWorkspace
              ? undefined
              : { gridTemplateColumns: '300px minmax(0, 1fr)' }
          }
        >
          {!isNarrowWorkspace ? (
            <ConversationList
              conversations={conversations}
              activeId={conversation?.id ?? null}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onNew={handleNew}
            />
          ) : null}

          <ChatInterface agent={currentAgent} />
        </div>

        {isNarrowWorkspace && conversationPanelOpen ? (
          <ConversationList
            drawer
            conversations={conversations}
            activeId={conversation?.id ?? null}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onNew={handleNew}
            onClose={() => setConversationPanelOpen(false)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center text-text-muted">
          Loading workspace…
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
