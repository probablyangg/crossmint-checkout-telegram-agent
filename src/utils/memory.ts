/**
 * Simple memory system for storing user conversation history
 */

interface MessageMemory {
  userId: number;
  username?: string | undefined;
  firstName?: string | undefined;
  messages: Array<{
    timestamp: number;
    role: 'user' | 'assistant';
    content: string;
    messageType?: 'text' | 'command' | 'callback' | 'checkout';
  }>;
  preferences?: {
    preferredCategories?: string[];
    priceRange?: { min: number; max: number };
    lastSearchQuery?: string;
  } | undefined;
}

// In-memory storage (use database in production)
const userMemories = new Map<number, MessageMemory>();

// Configuration
const MAX_MESSAGES_PER_USER = 20; // Keep last 20 messages
const MEMORY_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_MEMORY_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Add a message to user's memory
 */
export function addMessage(
  userId: number,
  role: 'user' | 'assistant',
  content: string,
  messageType: 'text' | 'command' | 'callback' | 'checkout' = 'text',
  userInfo?: { username?: string; firstName?: string }
): void {
  let memory = userMemories.get(userId);
  
  if (!memory) {
    memory = {
      userId,
      username: userInfo?.username,
      firstName: userInfo?.firstName,
      messages: [],
      preferences: undefined
    };
    userMemories.set(userId, memory);
  }
  
  // Add new message
  memory.messages.push({
    timestamp: Date.now(),
    role,
    content: content.trim(),
    messageType
  });
  
  // Keep only the latest messages
  if (memory.messages.length > MAX_MESSAGES_PER_USER) {
    memory.messages = memory.messages.slice(-MAX_MESSAGES_PER_USER);
  }
  
  // Update user info if provided
  if (userInfo?.username) memory.username = userInfo.username;
  if (userInfo?.firstName) memory.firstName = userInfo.firstName;
  
  console.log(`📝 Added ${role} message to memory for user ${userId} (${memory.messages.length} total)`);
}

/**
 * Get user's conversation history
 */
export function getConversationHistory(userId: number): Array<{ role: 'user' | 'assistant'; content: string }> {
  const memory = userMemories.get(userId);
  if (!memory) return [];
  
  return memory.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

/**
 * Get recent messages for context
 */
export function getRecentMessages(userId: number, count: number = 10): string[] {
  const memory = userMemories.get(userId);
  if (!memory) return [];
  
  return memory.messages
    .slice(-count)
    .map(msg => `${msg.role}: ${msg.content}`);
}

/**
 * Get user's memory summary
 */
export function getUserMemory(userId: number): MessageMemory | null {
  return userMemories.get(userId) || null;
}

/**
 * Update user preferences
 */
export function updateUserPreferences(
  userId: number, 
  preferences: Partial<MessageMemory['preferences']>
): void {
  let memory = userMemories.get(userId);
  
  if (!memory) {
    memory = {
      userId,
      messages: [],
      preferences: undefined
    };
    userMemories.set(userId, memory);
  }
  
  memory.preferences = { ...memory.preferences, ...preferences };
  console.log(`🎯 Updated preferences for user ${userId}`);
}

/**
 * Clear user memory
 */
export function clearUserMemory(userId: number): void {
  userMemories.delete(userId);
  console.log(`🗑️ Cleared memory for user ${userId}`);
}

/**
 * Get memory stats
 */
export function getMemoryStats(): { totalUsers: number; totalMessages: number; avgMessagesPerUser: number } {
  const totalUsers = userMemories.size;
  let totalMessages = 0;
  
  for (const memory of userMemories.values()) {
    totalMessages += memory.messages.length;
  }
  
  return {
    totalUsers,
    totalMessages,
    avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0
  };
}

/**
 * Cleanup old memories
 */
export function cleanupOldMemories(): void {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [userId, memory] of userMemories.entries()) {
    const lastMessageTime = memory.messages[memory.messages.length - 1]?.timestamp || 0;
    
    if (now - lastMessageTime > MAX_MEMORY_AGE) {
      userMemories.delete(userId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old user memories`);
  }
}

/**
 * Build conversation context for AI
 */
export function buildAIContext(userId: number): string {
  const memory = userMemories.get(userId);
  if (!memory) return '';
  
  let context = '';
  
  // Add user info
  if (memory.firstName || memory.username) {
    context += `User: ${memory.firstName || memory.username}\n`;
  }
  
  // Add preferences
  if (memory.preferences?.preferredCategories?.length) {
    context += `Preferred categories: ${memory.preferences.preferredCategories.join(', ')}\n`;
  }
  
  if (memory.preferences?.lastSearchQuery) {
    context += `Last search: ${memory.preferences.lastSearchQuery}\n`;
  }
  
  // Add recent conversation
  const recentMessages = memory.messages.slice(-8); // Last 8 messages for context
  if (recentMessages.length > 0) {
    context += '\nRecent conversation:\n';
    recentMessages.forEach(msg => {
      context += `${msg.role}: ${msg.content}\n`;
    });
  }
  
  return context;
}

// Start cleanup interval
setInterval(cleanupOldMemories, MEMORY_CLEANUP_INTERVAL); 