'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/stores/chat';
import { useConversationsStore } from '@/stores/conversations';
import ChatInterface from '@/components/chat/ChatInterface';
import ConversationList from '@/components/chat/ConversationList';

export default function ChatPage() {
  const { conversation, setConversation, loadMessages, clearMessages } = useChatStore();
  const { conversations, loadConversations, deleteConversation } = useConversationsStore();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSelect = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setConversation(conv);
      loadMessages(id);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    if (conversation?.id === id) {
      clearMessages();
    }
  };

  const handleNew = () => {
    clearMessages();
  };

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
          <ChatInterface />
        </div>
      </main>
    </div>
  );
}
