import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ActiveChat {
  id: string;
  name: string;
  isRoom: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  author?: { id: string; username: string };
  recipientId?: string | null;
  recipient?: { id: string; username: string } | null;
  roomId?: string | null;
  content: string | null;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  sending?: boolean;
}

export function extractId(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.toHexString === 'function') return val.toHexString();
    if (val._id && val._id !== val) {
      if (typeof val._id === 'string') return val._id.trim();
      if (typeof val._id === 'number') return String(val._id);
      if (typeof val._id.toHexString === 'function') return val._id.toHexString();
      if (typeof val._id.toString === 'function') {
        const s = val._id.toString().trim();
        if (s && s !== '[object Object]') return s;
      }
    }
    if (val.id && val.id !== val) {
      if (typeof val.id === 'string') return val.id.trim();
      if (typeof val.id === 'number') return String(val.id);
      if (typeof val.id.toHexString === 'function') return val.id.toHexString();
    }
    if (typeof val.toString === 'function' && !ArrayBuffer.isView(val)) {
      const str = val.toString().trim();
      if (str && str !== '[object Object]') return str;
    }
  }
  return null;
}

function getSafeTime(val: any): number {
  if (!val) return 0;
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
}

export function useSocket(
  token: string | null,
  activeChat: { id: string; isRoom: boolean } | null,
  onNewMessage?: (msg: ChatMessage) => void,
  onRoomJoined?: (room: any) => void,
  onMessageUpdated?: (data: { messageId: string; content: string; updatedAt: string; roomId?: string; recipientId?: string; authorId?: string }) => void,
  onMessageDeleted?: (data: { messageId: string; roomId?: string; recipientId?: string; authorId?: string }) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ [userId: string]: boolean }>({});

  const joinedRoomRef = useRef<string | null>(null);

  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  const onRoomJoinedRef = useRef(onRoomJoined);
  useEffect(() => {
    onRoomJoinedRef.current = onRoomJoined;
  }, [onRoomJoined]);

  const onMessageUpdatedRef = useRef(onMessageUpdated);
  useEffect(() => {
    onMessageUpdatedRef.current = onMessageUpdated;
  }, [onMessageUpdated]);

  const onMessageDeletedRef = useRef(onMessageDeleted);
  useEffect(() => {
    onMessageDeletedRef.current = onMessageDeleted;
  }, [onMessageDeleted]);

  useEffect(() => {
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const socket = io(`${apiUrl}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('[WS] Connected to WebSocket namespace /chat, id:', socket.id);

      const active = activeChatRef.current;
      if (active?.isRoom && active.id) {
        socket.emit('room:join', { roomId: active.id }, (response: any) => {
          if (response?.status === 'ok') {
            joinedRoomRef.current = active.id;
            console.log('[WS] Re-joined room after reconnect:', active.id);
          }
        });
      }
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[WS] Disconnected from WebSocket. Reason:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[WS] Socket connection error:', err.message);
      setConnected(false);
    });

    socket.on('exception', (data: { status: string; message: string }) => {
      console.error('[WS] Server exception:', data);
    });

    socket.on('room:joined', (data: { room: any }) => {
      if (data?.room && onRoomJoinedRef.current) {
        onRoomJoinedRef.current(data.room);
      }
    });

    socket.on('message:new', (data: { message: any }) => {
      const rawMsg = data.message;
      if (!rawMsg) return;

      const authorIdStr = extractId(rawMsg.authorId) || extractId(rawMsg.author?.id) || '';
      const recipientIdStr = extractId(rawMsg.recipientId) || extractId(rawMsg.recipient?.id);
      const roomIdStr = extractId(rawMsg.roomId);

      const authorObj = rawMsg.author ? {
        id: extractId(rawMsg.author.id || rawMsg.author._id) || authorIdStr,
        username: rawMsg.author.username || 'User',
      } : (typeof rawMsg.authorId === 'object' && rawMsg.authorId?.username ? {
        id: authorIdStr,
        username: rawMsg.authorId.username,
      } : undefined);

      const recipientObj = rawMsg.recipient ? {
        id: extractId(rawMsg.recipient.id || rawMsg.recipient._id) || recipientIdStr || '',
        username: rawMsg.recipient.username || 'User',
      } : (typeof rawMsg.recipientId === 'object' && rawMsg.recipientId?.username ? {
        id: recipientIdStr || '',
        username: rawMsg.recipientId.username,
      } : undefined);

      const msg: ChatMessage = {
        ...rawMsg,
        id: extractId(rawMsg.id || rawMsg._id) || String(rawMsg.id || rawMsg._id),
        authorId: authorIdStr,
        author: authorObj,
        recipientId: recipientIdStr,
        recipient: recipientObj,
        roomId: roomIdStr,
      };

      if (authorIdStr) {
        setTypingUsers((prev) => {
          if (!prev[authorIdStr]) return prev;
          const next = { ...prev };
          delete next[authorIdStr];
          return next;
        });
      }

      if (onNewMessageRef.current) {
        onNewMessageRef.current(msg);
      }

      const active = activeChatRef.current;
      if (!active) return;

      const activeId = (extractId(active.id) || String(active.id || '')).trim();
      const msgRoomId = extractId(msg.roomId);
      const msgAuthorId = (extractId(msg.authorId) || String(msg.authorId || '')).trim();
      const msgRecipientId = (extractId(msg.recipientId) || String(msg.recipientId || '')).trim();

      const isForActiveChat = active.isRoom
        ? Boolean(msgRoomId && activeId && msgRoomId === activeId)
        : !msgRoomId && Boolean(activeId && (msgAuthorId === activeId || msgRecipientId === activeId));

      if (isForActiveChat) {
        setMessages((prev) => {
          const targetMsgId = (extractId(msg.id) || String(msg.id || '')).trim();

          // 1. Flexible match for temp optimistic message to replace
          const tempIdx = prev.findIndex((m) => {
            if (!m || !m.id || typeof m.id !== 'string' || !m.id.startsWith('temp-')) {
              return false;
            }
            const mText = (m.content || '').trim();
            const msgText = (msg.content || '').trim();
            const contentMatches = m.content === msg.content || (Boolean(mText) && Boolean(msgText) && mText === msgText);
            if (!contentMatches) return false;

            if (msgRoomId) {
              const mRoomId = extractId(m.roomId);
              if (mRoomId && mRoomId !== msgRoomId) return false;
            } else if (msgRecipientId) {
              const mRecId = extractId(m.recipientId);
              if (mRecId && mRecId !== msgRecipientId && mRecId !== msgAuthorId) return false;
            }
            return true;
          });

          // 2. Existing message match by ID
          const existingIdx = prev.findIndex((m) => m && (extractId(m.id) || String(m.id)) === targetMsgId);

          let updated: ChatMessage[];
          if (tempIdx !== -1) {
            updated = [...prev];
            updated[tempIdx] = msg;
            if (existingIdx !== -1 && existingIdx !== tempIdx) {
              updated = updated.filter((_, idx) => idx !== existingIdx);
            }
          } else if (existingIdx !== -1) {
            updated = prev.map((m, idx) => (idx === existingIdx ? msg : m));
          } else {
            updated = [...prev, msg];
          }

          // Strict deduplication by message ID
          const seenIds = new Set<string>();
          const deduplicated: ChatMessage[] = [];
          for (const item of updated) {
            if (!item) continue;
            const itemId = extractId(item.id) || String(item.id || '');
            if (itemId && !seenIds.has(itemId)) {
              seenIds.add(itemId);
              deduplicated.push(item);
            } else if (!itemId) {
              deduplicated.push(item);
            }
          }

          return deduplicated.sort((a, b) => {
            const tA = getSafeTime(a.createdAt);
            const tB = getSafeTime(b.createdAt);
            if (tA !== tB) return tA - tB;
            return (a.id || '').localeCompare(b.id || '');
          });
        });
      }
    });

    socket.on('message:updated', (data: { messageId: string; content: string; updatedAt: string; roomId?: string; recipientId?: string; authorId?: string }) => {
      if (!data || !data.messageId) return;
      const targetId = (extractId(data.messageId) || String(data.messageId || '')).trim();

      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg) return msg;
          const msgId = (extractId(msg.id) || String(msg.id || '')).trim();
          if (msgId === targetId) {
            return { ...msg, content: data.content, updatedAt: data.updatedAt };
          }
          return msg;
        })
      );

      if (onMessageUpdatedRef.current) {
        onMessageUpdatedRef.current(data);
      }
    });

    socket.on('message:deleted', (data: { messageId: string; roomId?: string; recipientId?: string; authorId?: string }) => {
      if (!data || !data.messageId) return;
      const targetId = (extractId(data.messageId) || String(data.messageId || '')).trim();

      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg) return msg;
          const msgId = (extractId(msg.id) || String(msg.id || '')).trim();
          if (msgId === targetId) {
            return { ...msg, content: null, deletedAt: new Date().toISOString() };
          }
          return msg;
        })
      );

      if (onMessageDeletedRef.current) {
        onMessageDeletedRef.current(data);
      }
    });

    socket.on('user:typing', (data: { userId: string; roomId?: string }) => {
      const active = activeChatRef.current;
      if (!active) return;

      const activeId = extractId(active.id) || String(active.id);
      const dataUserId = extractId(data.userId) || String(data.userId || '');
      const dataRoomId = extractId(data.roomId);

      const isForActiveChat = active.isRoom
        ? (Boolean(dataRoomId) && dataRoomId === activeId)
        : (!dataRoomId && Boolean(dataUserId) && dataUserId === activeId);

      if (isForActiveChat) {
        setTypingUsers((prev) => ({ ...prev, [dataUserId]: true }));
        setTimeout(() => {
          setTypingUsers((prev) => {
            if (!prev[dataUserId]) return prev;
            const next = { ...prev };
            delete next[dataUserId];
            return next;
          });
        }, 3000);
      }
    });

    return () => {
      joinedRoomRef.current = null;
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    if (activeChat?.isRoom && activeChat.id && joinedRoomRef.current !== activeChat.id) {
      socket.emit('room:join', { roomId: activeChat.id }, (response: any) => {
        if (response?.status === 'ok') {
          joinedRoomRef.current = activeChat.id;
          console.log('[WS] Joined room:', activeChat.id);
        }
      });
    }
  }, [activeChat, connected]);

  const sendDm = useCallback((recipientId: string, content: string, optimisticMsg?: ChatMessage) => {
    if (optimisticMsg) {
      setMessages((prev) => [...prev, optimisticMsg]);
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit('dm:send', { recipientId, content });
    }
  }, []);

  const sendRoomMessage = useCallback((roomId: string, content: string, optimisticMsg?: ChatMessage) => {
    if (optimisticMsg) {
      setMessages((prev) => [...prev, optimisticMsg]);
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:send', { roomId, content });
    }
  }, []);

  const joinRoomWs = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:join', { roomId });
    }
  }, []);

  const leaveRoomWs = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:leave', { roomId });
    }
  }, []);

  const updateMessage = useCallback((messageId: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (!msg) return msg;
        const msgId = extractId(msg.id) || String(msg.id || '');
        if (msgId === messageId) {
          return { ...msg, content, updatedAt: new Date().toISOString() };
        }
        return msg;
      })
    );
    if (socketRef.current?.connected) {
      socketRef.current.emit('message:update', { messageId, content });
    }
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (!msg) return msg;
        const msgId = extractId(msg.id) || String(msg.id || '');
        if (msgId === messageId) {
          return { ...msg, content: null, deletedAt: new Date().toISOString() };
        }
        return msg;
      })
    );
    if (socketRef.current?.connected) {
      socketRef.current.emit('message:delete', { messageId });
    }
  }, []);

  const sendTyping = useCallback((params: { roomId?: string; recipientId?: string }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', params);
    }
  }, []);

  return {
    connected,
    messages,
    setMessages,
    typingUsers,
    sendDm,
    sendRoomMessage,
    joinRoomWs,
    leaveRoomWs,
    updateMessage,
    deleteMessage,
    sendTyping,
  };
}
