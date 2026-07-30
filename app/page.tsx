"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Users,
  Plus,
  Compass,
  Search,
  LogOut,
  Send,
  Edit2,
  Trash2,
  Lock,
  Globe,
  UserPlus,
  X,
  Check,
  Loader2,
  Shield,
} from 'lucide-react';
import { useSocket, ActiveChat, ChatMessage } from './hooks/useSocket';

function extractId(val: any): string | null {
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

interface UserProfile {
  id: string;
  username: string;
  createdAt?: string;
}

interface RoomItem {
  id: string;
  name: string;
  isPrivate: boolean;
  ownerId: string;
  createdAt: string;
  isJoined?: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
}

interface DmConversation {
  id: string;
  username: string;
  lastMessage?: string;
  lastMessageAt?: string;
}

export default function ChatDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return null;
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed) {
        const uId = extractId(parsed.id || parsed._id) || String(parsed.id || parsed._id || '');
        return { ...parsed, id: uId };
      }
    } catch {}
    return null;
  });

  const [initialLoading, setInitialLoading] = useState(true);

  // Active Selected Channel
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);

  // Lists
  const [dmList, setDmList] = useState<DmConversation[]>([]);
  const [roomList, setRoomList] = useState<RoomItem[]>([]);

  // Input states
  const [messageInput, setMessageInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Modals state
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showDiscoverGroupModal, setShowDiscoverGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Search Queries
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([]);
  const [userSearching, setUserSearching] = useState(false);

  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [discoverRooms, setDiscoverRooms] = useState<RoomItem[]>([]);
  const [groupSearching, setGroupSearching] = useState(false);

  // Group creation form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Invite target search
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<UserProfile[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  // Join Requests state
  const [showJoinRequestsModal, setShowJoinRequestsModal] = useState(false);
  const [joinRequestsList, setJoinRequestsList] = useState<any[]>([]);
  const [loadingJoinRequests, setLoadingJoinRequests] = useState(false);

  // User Pending Invites state
  const [showPendingInvitesModal, setShowPendingInvitesModal] = useState(false);
  const [pendingInvitesList, setPendingInvitesList] = useState<any[]>([]);
  const [loadingPendingInvites, setLoadingPendingInvites] = useState(false);

  // Existing room member IDs for invite filtering
  const [roomMemberIds, setRoomMemberIds] = useState<Set<string>>(new Set());

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Socket Callback for New Messages
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (!msg) return;

    // 1. Group Room Message -> Update Room sidebar
    if (msg.roomId) {
      const rId = String(msg.roomId);
      setRoomList((prev) => {
        const index = prev.findIndex((r) => String(r.id) === rId);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            lastMessage: msg.content || '',
            lastMessageAt: msg.createdAt,
          };
          return updated;
        }
        return prev;
      });
      return;
    }

    // 2. Direct Message -> Update DM sidebar
    const activeUser = currentUserRef.current;
    const currentIdStr = extractId(activeUser?.id || (activeUser as any)?._id) || String(activeUser?.id || '');
    const authorIdStr = extractId(msg.authorId) || String(msg.authorId || '');
    const recipientIdStr = extractId(msg.recipientId) || String(msg.recipientId || '');

    if (!recipientIdStr) return;

    let otherUserId: string | null = null;
    let otherUsername: string | null = null;

    if (currentIdStr) {
      if (authorIdStr === currentIdStr) {
        otherUserId = recipientIdStr;
        otherUsername = msg.recipient?.username || (typeof msg.recipientId === 'object' ? (msg.recipientId as any)?.username : null);
      } else if (recipientIdStr === currentIdStr) {
        otherUserId = authorIdStr;
        otherUsername = msg.author?.username || (typeof msg.authorId === 'object' ? (msg.authorId as any)?.username : null);
      }
    }

    // Fallback using activeChat if currentIdStr didn't match author/recipient
    if (!otherUserId && activeChatRef.current && !activeChatRef.current.isRoom) {
      otherUserId = extractId(activeChatRef.current.id) || String(activeChatRef.current.id);
      otherUsername = activeChatRef.current.name;
    }

    // Absolute Safety Check: Never allow self-user as DM target
    if (otherUserId && (!currentIdStr || otherUserId !== currentIdStr)) {
      setDmList((prev) => {
        const filtered = prev.filter((d) => {
          const dId = extractId(d.id || (d as any)._id) || String(d.id || '');
          return Boolean(dId && dId !== currentIdStr && dId !== otherUserId);
        });

        const nameToUse = (otherUsername && otherUsername !== 'User') ? otherUsername : 'User';
        return [
          {
            id: otherUserId,
            username: nameToUse,
            lastMessage: msg.content || '',
            lastMessageAt: msg.createdAt,
          },
          ...filtered,
        ];
      });
    }
  }, []);

  const handleRoomJoined = useCallback((room: any) => {
    if (!room) return;
    const rId = extractId(room.id || room._id) || String(room.id || room._id);
    const normalized = { ...room, id: rId };
    setRoomList((prev) => {
      if (prev.some((r) => String(r.id) === rId)) return prev;
      return [normalized, ...prev];
    });
  }, []);

  const handleMessageUpdated = useCallback((data: { messageId: string; content: string; updatedAt: string; roomId?: string; recipientId?: string; authorId?: string }) => {
    if (!data || !data.messageId) return;
    const targetId = (extractId(data.messageId) || String(data.messageId || '')).trim();

    if (data.roomId) {
      const rId = (extractId(data.roomId) || String(data.roomId)).trim();
      setRoomList((prev) =>
        prev.map((r) => {
          const roomObjId = (extractId(r.id) || String(r.id)).trim();
          if (roomObjId === rId) {
            return { ...r, lastMessage: data.content };
          }
          return r;
        })
      );
    } else {
      const authId = (extractId(data.authorId) || String(data.authorId || '')).trim();
      const recId = (extractId(data.recipientId) || String(data.recipientId || '')).trim();
      const currentIdStr = extractId(currentUserRef.current?.id || (currentUserRef.current as any)?._id) || String(currentUserRef.current?.id || '');

      let otherId = '';
      if (currentIdStr) {
        if (authId === currentIdStr) otherId = recId;
        else if (recId === currentIdStr) otherId = authId;
      }

      if (otherId) {
        setDmList((prev) =>
          prev.map((d) => {
            const dId = (extractId(d.id || (d as any)._id) || String(d.id || '')).trim();
            if (dId === otherId) {
              return { ...d, lastMessage: data.content };
            }
            return d;
          })
        );
      }
    }
  }, []);

  const handleMessageDeleted = useCallback((data: { messageId: string; roomId?: string; recipientId?: string; authorId?: string }) => {
    if (!data || !data.messageId) return;

    if (data.roomId) {
      const rId = (extractId(data.roomId) || String(data.roomId)).trim();
      setRoomList((prev) =>
        prev.map((r) => {
          const roomObjId = (extractId(r.id) || String(r.id)).trim();
          if (roomObjId === rId) {
            return { ...r, lastMessage: 'This message was deleted' };
          }
          return r;
        })
      );
    } else {
      const authId = (extractId(data.authorId) || String(data.authorId || '')).trim();
      const recId = (extractId(data.recipientId) || String(data.recipientId || '')).trim();
      const currentIdStr = extractId(currentUserRef.current?.id || (currentUserRef.current as any)?._id) || String(currentUserRef.current?.id || '');

      let otherId = '';
      if (currentIdStr) {
        if (authId === currentIdStr) otherId = recId;
        else if (recId === currentIdStr) otherId = authId;
      }

      if (otherId) {
        setDmList((prev) =>
          prev.map((d) => {
            const dId = (extractId(d.id || (d as any)._id) || String(d.id || '')).trim();
            if (dId === otherId) {
              return { ...d, lastMessage: 'This message was deleted' };
            }
            return d;
          })
        );
      }
    }
  }, []);

  const {
    connected,
    messages,
    setMessages,
    typingUsers,
    sendDm,
    sendRoomMessage,
    updateMessage,
    deleteMessage,
    sendTyping,
  } = useSocket(token, activeChat, handleNewMessage, handleRoomJoined, handleMessageUpdated, handleMessageDeleted);

  // Load User & Auth
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      router.push('/auth');
      return;
    }

    try {
      setToken(storedToken);
      const parsed = JSON.parse(storedUser);
      if (parsed) {
        const uId = extractId(parsed.id || parsed._id) || String(parsed.id || parsed._id || '');
        setCurrentUser({ ...parsed, id: uId });
      }
    } catch {
      localStorage.clear();
      router.push('/auth');
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Fetch Sidebars data (Joined Rooms & DM conversations)
  const fetchSidebarData = useCallback(async () => {
    if (!token) return;
    try {
      const [roomsRes, dmsRes] = await Promise.all([
        fetch(`${apiUrl}/rooms`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/messages/direct/conversations`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        const normalized = roomsData.map((r: any) => ({
          ...r,
          id: extractId(r.id || r._id) || String(r.id || r._id),
        }));
        setRoomList(normalized);
      }

      if (dmsRes.ok) {
        const dmsData = await dmsRes.json();
        const activeUser = currentUserRef.current;
        const cUserId = extractId(activeUser?.id || (activeUser as any)?._id) || String(activeUser?.id || '');
        const normalized = dmsData
          .map((d: any) => ({
            ...d,
            id: extractId(d.id || d._id) || String(d.id || d._id),
          }))
          .filter((d: any) => d.id && d.id !== cUserId);
        setDmList(normalized);
      }
    } catch (err) {
      console.error('Failed to load sidebar data:', err);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    fetchSidebarData();
  }, [fetchSidebarData]);

  // Load Chat History when Active Chat changes
  useEffect(() => {
    if (!token || !activeChat) {
      setMessages([]);
      return;
    }

    // Clear previous chat messages immediately to prevent bleeding between chats
    setMessages([]);

    const currentChatId = activeChat.id;
    const currentIsRoom = activeChat.isRoom;

    const fetchHistory = async () => {
      try {
        const endpoint = currentIsRoom
          ? `${apiUrl}/rooms/${currentChatId}/messages`
          : `${apiUrl}/messages/direct/${currentChatId}`;

        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const fetchedMessages = data.map((m: any) => {
            const authorIdStr = extractId(m.authorId) || extractId(m.author?.id) || '';
            const recipientIdStr = extractId(m.recipientId) || extractId(m.recipient?.id);
            const roomIdStr = extractId(m.roomId);
            
            const authorObj = m.author ? {
              id: extractId(m.author.id || m.author._id) || authorIdStr,
              username: m.author.username || 'User',
            } : (typeof m.authorId === 'object' && m.authorId?.username ? {
              id: authorIdStr,
              username: m.authorId.username,
            } : undefined);

            const recipientObj = m.recipient ? {
              id: extractId(m.recipient.id || m.recipient._id) || recipientIdStr || '',
              username: m.recipient.username || 'User',
            } : (typeof m.recipientId === 'object' && m.recipientId?.username ? {
              id: recipientIdStr || '',
              username: m.recipientId.username,
            } : undefined);

            return {
              ...m,
              id: extractId(m.id || m._id) || String(m.id || m._id),
              authorId: authorIdStr,
              author: authorObj,
              recipientId: recipientIdStr,
              recipient: recipientObj,
              roomId: roomIdStr,
            };
          }).reverse();

          if (activeChatRef.current?.id === currentChatId && activeChatRef.current?.isRoom === currentIsRoom) {
            setMessages((prev) => {
              const fetchedIds = new Set(fetchedMessages.map((m: any) => extractId(m.id) || String(m.id || '')));
              const liveAndTemp = prev.filter((m) => {
                if (!m) return false;
                const mId = extractId(m.id) || String(m.id || '');
                return Boolean(!mId || !fetchedIds.has(mId));
              });
              const combined = [...fetchedMessages, ...liveAndTemp];

              const seenIds = new Set<string>();
              const deduplicated: ChatMessage[] = [];
              for (const item of combined) {
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
                const tA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                const safeA = isNaN(tA) ? 0 : tA;
                const safeB = isNaN(tB) ? 0 : tB;
                if (safeA !== safeB) return safeA - safeB;
                return (a.id || '').localeCompare(b.id || '');
              });
            });
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    fetchHistory();
  }, [activeChat, token, apiUrl, setMessages]);

  // Auto-scroll to bottom of message list
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Search Users for DM Modal
  useEffect(() => {
    if (!token || !showUserSearchModal) return;

    const delayFn = setTimeout(async () => {
      setUserSearching(true);
      try {
        const res = await fetch(`${apiUrl}/users/search?q=${encodeURIComponent(userSearchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUserSearching(false);
      }
    }, 200);

    return () => clearTimeout(delayFn);
  }, [userSearchQuery, showUserSearchModal, token, apiUrl]);

  // Search Users for Invite Modal
  useEffect(() => {
    if (!token || !showInviteModal) return;

    const delayFn = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/users/search?q=${encodeURIComponent(inviteSearchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setInviteSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      }
    }, 200);

    return () => clearTimeout(delayFn);
  }, [inviteSearchQuery, showInviteModal, token, apiUrl]);

  // Fetch Room Members for filtering existing members in Invite modal
  const fetchRoomMembers = useCallback(async (roomId: string) => {
    if (!token || !roomId) return;
    try {
      const res = await fetch(`${apiUrl}/rooms/${roomId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const membersData = await res.json();
        const ids = new Set<string>();
        for (const m of membersData) {
          const mId = extractId(m.userId?._id || m.userId?.id || m.userId);
          if (mId) ids.add(mId);
        }
        setRoomMemberIds(ids);
      }
    } catch (e) {
      console.error('Failed to fetch room members:', e);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    if (showInviteModal && activeChat?.isRoom) {
      fetchRoomMembers(activeChat.id);
    }
  }, [showInviteModal, activeChat, fetchRoomMembers]);

  // Fetch Pending Join Requests for Active Room
  const fetchJoinRequests = useCallback(async (roomId: string) => {
    if (!token || !roomId) return;
    setLoadingJoinRequests(true);
    try {
      const res = await fetch(`${apiUrl}/rooms/${roomId}/join-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setJoinRequestsList(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingJoinRequests(false);
    }
  }, [token, apiUrl]);

  // Fetch Pending Room Invites for Logged-In User
  const fetchPendingInvites = useCallback(async () => {
    if (!token) return;
    setLoadingPendingInvites(true);
    try {
      const res = await fetch(`${apiUrl}/rooms/invites/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingInvitesList(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPendingInvites(false);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    fetchPendingInvites();
  }, [fetchPendingInvites]);

  const handleAcceptJoinRequest = async (targetUserId: string) => {
    if (!token || !activeChat?.isRoom) return;
    try {
      const res = await fetch(`${apiUrl}/rooms/${activeChat.id}/join-requests/${targetUserId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setJoinRequestsList((prev) => prev.filter((r) => extractId(r.userId?._id || r.userId?.id || r.userId) !== targetUserId));
        fetchRoomMembers(activeChat.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectJoinRequest = async (targetUserId: string) => {
    if (!token || !activeChat?.isRoom) return;
    try {
      const res = await fetch(`${apiUrl}/rooms/${activeChat.id}/join-requests/${targetUserId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setJoinRequestsList((prev) => prev.filter((r) => extractId(r.userId?._id || r.userId?.id || r.userId) !== targetUserId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptInvite = async (roomId: string, roomName: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/rooms/${roomId}/invites/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPendingInvitesList((prev) => prev.filter((i) => extractId(i.roomId?._id || i.roomId?.id || i.roomId) !== roomId));
        const cId = extractId(roomId) || String(roomId);
        setRoomList((prev) => {
          if (prev.some((r) => String(r.id) === cId)) return prev;
          return [{ id: cId, name: roomName, isPrivate: true, ownerId: '', createdAt: new Date().toISOString() }, ...prev];
        });
        setActiveChat({ id: cId, name: roomName, isRoom: true });
        setShowPendingInvitesModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectInvite = async (roomId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/rooms/${roomId}/invites/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPendingInvitesList((prev) => prev.filter((i) => extractId(i.roomId?._id || i.roomId?.id || i.roomId) !== roomId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Search Public Rooms for Discover Modal
  const fetchDiscoverRooms = useCallback(async (query: string) => {
    if (!token) return;
    setGroupSearching(true);
    try {
      const res = await fetch(`${apiUrl}/rooms/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDiscoverRooms(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGroupSearching(false);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    if (showDiscoverGroupModal) {
      fetchDiscoverRooms(groupSearchQuery);
    }
  }, [showDiscoverGroupModal, groupSearchQuery, fetchDiscoverRooms]);

  // Handlers
  const handleSelectChat = (chat: ActiveChat) => {
    const cId = extractId(chat.id) || String(chat.id || '');
    const currentActiveId = extractId(activeChat?.id) || String(activeChat?.id || '');
    if (currentActiveId && cId === currentActiveId && activeChat?.isRoom === chat.isRoom) {
      return;
    }
    setActiveChat({ ...chat, id: cId });
    setEditingMessageId(null);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (!content || !activeChat || !currentUser) return;

    const cUserId = extractId(currentUser.id || (currentUser as any)._id) || String(currentUser.id || '');
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      authorId: cUserId,
      author: { id: cUserId, username: currentUser.username },
      recipientId: activeChat.isRoom ? null : activeChat.id,
      roomId: activeChat.isRoom ? activeChat.id : null,
      content: content,
      createdAt: new Date().toISOString(),
      sending: true,
    };

    if (activeChat.isRoom) {
      sendRoomMessage(activeChat.id, content, optimisticMsg);
    } else {
      sendDm(activeChat.id, content, optimisticMsg);
    }

    setMessageInput('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (activeChat) {
      sendTyping({
        roomId: activeChat.isRoom ? activeChat.id : undefined,
        recipientId: !activeChat.isRoom ? activeChat.id : undefined,
      });
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !token) return;

    setCreatingGroup(true);
    try {
      const res = await fetch(`${apiUrl}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newGroupName.trim(), isPrivate: newGroupIsPrivate }),
      });

      if (res.ok) {
        const rawRoom = await res.json();
        const roomId = extractId(rawRoom.id || rawRoom._id) || String(rawRoom.id || rawRoom._id);
        const room = { ...rawRoom, id: roomId };
        setRoomList((prev) => [room, ...prev]);
        setActiveChat({ id: roomId, name: room.name, isRoom: true });
        setShowCreateGroupModal(false);
        setNewGroupName('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleJoinRoom = async (rawRoomId: string, roomName: string) => {
    if (!token) return;
    const roomId = extractId(rawRoomId) || rawRoomId;
    try {
      const res = await fetch(`${apiUrl}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchSidebarData();
        setActiveChat({ id: roomId, name: roomName, isRoom: true });
        setShowDiscoverGroupModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInviteUser = async (targetUserId: string) => {
    if (!token || !activeChat || !activeChat.isRoom) return;

    setInvitingUserId(targetUserId);
    try {
      const res = await fetch(`${apiUrl}/rooms/${activeChat.id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: targetUserId }),
      });

      if (res.ok) {
        alert('User invited to room successfully!');
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to invite user');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInvitingUserId(null);
    }
  };

  const handleSaveEdit = (messageId: string) => {
    if (!editContent.trim()) return;
    updateMessage(messageId, editContent.trim());
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/auth');
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950 font-sans text-zinc-100 antialiased">
      {/* LEFT SIDEBAR */}
      <aside className="flex w-80 flex-col border-r border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
        {/* User Profile Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 font-bold text-white shadow-md">
              {currentUser?.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{currentUser?.username}</span>
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </span>
              </div>
              <span className="text-xs text-zinc-400">
                {connected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Sidebar Content Scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Direct Messages Section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Direct Messages
              </span>
              <button
                onClick={() => setShowUserSearchModal(true)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-violet-400 hover:bg-violet-500/10"
              >
                <Plus size={14} /> New DM
              </button>
            </div>

            <div className="space-y-1">
              {dmList.length === 0 ? (
                <p className="px-2 py-3 text-xs italic text-zinc-600">No active conversations yet</p>
              ) : (
                dmList.map((user) => {
                  const uId = extractId(user.id || (user as any)._id) || String(user.id || (user as any)._id || '');
                  const isActive = activeChat?.id === uId && !activeChat.isRoom;
                  return (
                    <button
                      key={uId}
                      onClick={() => handleSelectChat({ id: uId, name: user.username, isRoom: false })}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-white font-semibold border-l-2 border-violet-500'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 font-medium text-white text-xs">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm">{user.username}</p>
                        {user.lastMessage && (
                          <p className="truncate text-xs text-zinc-500">{user.lastMessage}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Group Rooms Section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Group Rooms
              </span>
              <div className="flex gap-1 items-center">
                <button
                  onClick={() => {
                    setShowPendingInvitesModal(true);
                    fetchPendingInvites();
                  }}
                  title="Pending Room Invites"
                  className="relative rounded p-1 text-xs text-indigo-400 hover:bg-indigo-500/10"
                >
                  <UserPlus size={14} />
                  {pendingInvitesList.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white">
                      {pendingInvitesList.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowDiscoverGroupModal(true)}
                  title="Discover Rooms"
                  className="rounded p-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <Compass size={14} />
                </button>
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  title="Create Group"
                  className="rounded p-1 text-xs text-violet-400 hover:bg-violet-500/10"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {roomList.length === 0 ? (
                <p className="px-2 py-3 text-xs italic text-zinc-600">No rooms joined yet</p>
              ) : (
                roomList.map((room) => {
                  const rId = extractId(room.id || (room as any)._id) || String(room.id || (room as any)._id || '');
                  const isActive = activeChat?.id === rId && activeChat.isRoom;
                  return (
                    <button
                      key={rId}
                      onClick={() => handleSelectChat({ id: rId, name: room.name, isRoom: true })}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-white font-semibold border-l-2 border-violet-500'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                        {room.isPrivate ? <Lock size={14} /> : <Globe size={14} />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm">{room.name}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex flex-1 flex-col bg-zinc-950">
        {activeChat ? (
          <>
            {/* Top Chat Header */}
            <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-6 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold shadow-md">
                  {activeChat.isRoom ? <Users size={18} /> : activeChat.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{activeChat.name}</h2>
                  <p className="text-xs text-zinc-400">
                    {activeChat.isRoom ? 'Group Room' : 'Direct Conversation'}
                  </p>
                </div>
              </div>

              {activeChat.isRoom && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowJoinRequestsModal(true);
                      fetchJoinRequests(activeChat.id);
                    }}
                    className="relative flex items-center gap-2 rounded-lg bg-indigo-600/10 px-3 py-1.5 text-sm font-semibold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/20"
                  >
                    <Shield size={16} />
                    <span>Join Requests</span>
                    {joinRequestsList.length > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                        {joinRequestsList.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 rounded-lg bg-violet-600/10 px-3 py-1.5 text-sm font-semibold text-violet-400 border border-violet-500/20 hover:bg-violet-600/20"
                  >
                    <UserPlus size={16} />
                    <span>Invite User</span>
                  </button>
                </div>
              )}
            </header>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                  <MessageSquare size={48} className="mb-2 stroke-1 text-zinc-700" />
                  <p className="text-sm">No messages in this chat yet.</p>
                  <p className="text-xs text-zinc-600 mt-1">Send a message to start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => {
                    const activeUser = currentUserRef.current || currentUser;
                    const cUserId = extractId(activeUser?.id || (activeUser as any)?._id) || String(activeUser?.id || '');
                    const cUsername = (activeUser?.username || '').trim().toLowerCase();

                    const msgAuthorId = extractId(msg.authorId) || extractId(msg.author?.id) || String(msg.authorId || '');
                    const rawAuthorName = msg.author?.username || (typeof msg.authorId === 'object' && msg.authorId ? (msg.authorId as any).username : null) || 'User';
                    const msgAuthorName = rawAuthorName.trim().toLowerCase();

                    const isOwn = Boolean(
                      (cUserId && msgAuthorId && cUserId === msgAuthorId) ||
                      (cUsername && msgAuthorName && cUsername === msgAuthorName)
                    );

                    const authorName = isOwn ? 'You' : rawAuthorName;
                    const isDeleted = Boolean(msg.deletedAt || msg.content === null);
                    const isEdited = Boolean(msg.updatedAt && !isDeleted);
                    const isEditing = editingMessageId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-3`}
                      >
                        <div className={`mb-1 flex items-center gap-2 px-1 text-xs text-zinc-500 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <span className="font-semibold text-zinc-300">
                            {authorName}
                          </span>
                          <span>•</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isEdited && <span className="text-[10px] text-zinc-500 italic">(edited)</span>}
                        </div>

                        <div className="relative max-w-md">
                          {isEditing ? (
                            <div className="flex items-center gap-2 rounded-xl bg-zinc-900 p-2 border border-violet-500 shadow-lg">
                              <input
                                type="text"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(msg.id);
                                  if (e.key === 'Escape') setEditingMessageId(null);
                                }}
                                autoFocus
                                className="flex-1 bg-transparent px-2 text-sm text-white outline-none"
                              />
                              <button
                                onClick={() => handleSaveEdit(msg.id)}
                                className="rounded p-1.5 text-emerald-400 hover:bg-zinc-800"
                                title="Save edit"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {isOwn && !isDeleted && (
                                <div className="hidden group-hover:flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditContent(msg.content || '');
                                    }}
                                    className="rounded-full bg-zinc-900 p-1.5 text-zinc-400 hover:text-white border border-zinc-800 shadow-sm"
                                    title="Edit"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => deleteMessage(msg.id)}
                                    className="rounded-full bg-zinc-900 p-1.5 text-zinc-400 hover:text-red-400 border border-zinc-800 shadow-sm"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}

                              <div
                                className={`rounded-2xl px-4 py-2.5 text-sm ${
                                  isDeleted
                                    ? 'bg-zinc-900/60 text-zinc-500 italic border border-zinc-800'
                                    : isOwn
                                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                                    : 'bg-zinc-900 text-zinc-100 border border-zinc-800'
                                }`}
                              >
                                {isDeleted ? 'This message was deleted' : msg.content}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
              <div ref={messageEndRef} />
            </div>

            {/* Typing Indicator */}
            {Object.values(typingUsers).some(Boolean) && (
              <div className="px-6 py-1 text-xs italic text-violet-400 animate-pulse">
                Someone is typing...
              </div>
            )}

            {/* Message Input Form */}
            <form onSubmit={handleSendMessage} className="border-t border-zinc-800 p-4 bg-zinc-900/20">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder={`Message ${activeChat.name}...`}
                  value={messageInput}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pr-12 pl-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="absolute right-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 p-2 text-white transition-all hover:from-violet-500 hover:to-indigo-500 disabled:opacity-30"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500 p-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 text-violet-400">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">Select a Chat or Group Room</h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-400">
              Choose a direct message conversation from the sidebar or join a group room to start messaging in real time.
            </p>
          </div>
        )}
      </main>

      {/* USER SEARCH / NEW DM MODAL */}
      {showUserSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Start a Direct Message</h3>
              <button onClick={() => setShowUserSearchModal(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute top-3 left-3 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search username..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pr-4 pl-9 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {userSearching ? (
                <div className="flex justify-center p-4 text-zinc-500"><Loader2 className="animate-spin" size={20} /></div>
              ) : userSearchResults.length === 0 ? (
                <p className="text-center py-4 text-xs text-zinc-500">No users found</p>
              ) : (
                userSearchResults
                  .filter((user) => {
                    const uId = extractId(user.id || (user as any)._id) || String(user.id || '');
                    const activeUser = currentUserRef.current;
                    const cId = extractId(activeUser?.id || (activeUser as any)?._id) || String(activeUser?.id || '');
                    return Boolean(uId && uId !== cId);
                  })
                  .map((user) => {
                    const uId = extractId(user.id || (user as any)._id) || String(user.id || '');
                    return (
                      <button
                        key={uId}
                        onClick={() => {
                          handleSelectChat({ id: uId, name: user.username, isRoom: false });
                          setShowUserSearchModal(false);
                          setUserSearchQuery('');
                        }}
                        className="flex w-full items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-950/50 p-3 text-left hover:border-violet-500/50 hover:bg-zinc-800"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 font-bold text-white text-xs">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white">{user.username}</span>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Create Group Room</h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400">Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. Developers Lounge"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="privateCheck"
                  checked={newGroupIsPrivate}
                  onChange={(e) => setNewGroupIsPrivate(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-800 bg-zinc-950 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="privateCheck" className="text-sm text-zinc-300">
                  Private Room (Requires invitation)
                </label>
              </div>

              <button
                type="submit"
                disabled={creatingGroup || !newGroupName.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
              >
                {creatingGroup ? 'Creating...' : 'Create Room'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DISCOVER PUBLIC GROUPS MODAL */}
      {showDiscoverGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Discover Public Rooms</h3>
              <button onClick={() => setShowDiscoverGroupModal(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute top-3 left-3 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search public rooms..."
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pr-4 pl-9 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {groupSearching ? (
                <div className="flex justify-center p-4 text-zinc-500"><Loader2 className="animate-spin" size={20} /></div>
              ) : discoverRooms.length === 0 ? (
                <p className="text-center py-4 text-xs text-zinc-500">No public rooms found</p>
              ) : (
                discoverRooms.map((room) => {
                  const rId = extractId(room.id || (room as any)._id) || String(room.id || (room as any)._id || '');
                  return (
                    <div
                      key={rId}
                      className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                          <Globe size={16} />
                        </div>
                        <span className="font-semibold text-white">{room.name}</span>
                      </div>

                      {room.isJoined ? (
                        <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                          Joined
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJoinRoom(rId, room.name)}
                          className="rounded bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500"
                        >
                          Join Room
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* INVITE USER MODAL */}
      {showInviteModal && activeChat?.isRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Invite User to {activeChat.name}</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute top-3 left-3 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search user to invite..."
                value={inviteSearchQuery}
                onChange={(e) => setInviteSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pr-4 pl-9 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {inviteSearchResults
                .filter((user) => {
                  const uId = extractId(user.id || (user as any)._id) || String(user.id || (user as any)._id || '');
                  return Boolean(uId && !roomMemberIds.has(uId));
                })
                .map((user) => {
                  const uId = extractId(user.id || (user as any)._id) || String(user.id || (user as any)._id || '');
                  return (
                    <div
                      key={uId}
                      className="flex items-center justify-between rounded-lg border border-zinc-800/50 bg-zinc-950/50 p-3"
                    >
                      <span className="font-semibold text-white">{user.username}</span>
                      <button
                        onClick={() => handleInviteUser(uId)}
                        disabled={invitingUserId === uId}
                        className="rounded bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {invitingUserId === uId ? 'Inviting...' : 'Invite'}
                      </button>
                    </div>
                  );
                })}
              {inviteSearchResults.filter((u) => {
                const uId = extractId(u.id || (u as any)._id) || String(u.id || (u as any)._id || '');
                return Boolean(uId && !roomMemberIds.has(uId));
              }).length === 0 && (
                <p className="text-center py-4 text-xs text-zinc-500">
                  {inviteSearchQuery.trim() ? 'No new users available to invite' : 'Search for users to invite...'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GROUP JOIN REQUESTS MODAL */}
      {showJoinRequestsModal && activeChat?.isRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Join Requests for {activeChat.name}</h3>
              <button onClick={() => setShowJoinRequestsModal(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {loadingJoinRequests ? (
                <div className="flex justify-center p-4 text-zinc-500"><Loader2 className="animate-spin" size={20} /></div>
              ) : joinRequestsList.length === 0 ? (
                <p className="text-center py-4 text-xs text-zinc-500">No pending join requests</p>
              ) : (
                joinRequestsList.map((req) => {
                  const requestingUser = req.user || req.userId;
                  const reqUserId = extractId(requestingUser?._id || requestingUser?.id || requestingUser) || '';
                  const username = requestingUser?.username || 'User';
                  return (
                    <div
                      key={req.id || reqUserId}
                      className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3"
                    >
                      <span className="font-semibold text-white">{username}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAcceptJoinRequest(reqUserId)}
                          className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          <Check size={14} /> Accept
                        </button>
                        <button
                          onClick={() => handleRejectJoinRequest(reqUserId)}
                          className="flex items-center gap-1 rounded bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* PENDING ROOM INVITES MODAL FOR USER */}
      {showPendingInvitesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Pending Room Invitations</h3>
              <button onClick={() => setShowPendingInvitesModal(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {loadingPendingInvites ? (
                <div className="flex justify-center p-4 text-zinc-500"><Loader2 className="animate-spin" size={20} /></div>
              ) : pendingInvitesList.length === 0 ? (
                <p className="text-center py-4 text-xs text-zinc-500">No pending room invitations</p>
              ) : (
                pendingInvitesList.map((inv) => {
                  const room = inv.roomId;
                  const roomObjId = extractId(room?._id || room?.id || room) || '';
                  const roomName = room?.name || 'Group Room';
                  const inviterName = inv.inviterId?.username || 'Member';

                  return (
                    <div
                      key={inv.id || roomObjId}
                      className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3"
                    >
                      <div>
                        <p className="font-semibold text-white">{roomName}</p>
                        <p className="text-xs text-zinc-400">Invited by: {inviterName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAcceptInvite(roomObjId, roomName)}
                          className="flex items-center gap-1 rounded bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500"
                        >
                          <Check size={14} /> Accept
                        </button>
                        <button
                          onClick={() => handleRejectInvite(roomObjId)}
                          className="flex items-center gap-1 rounded bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
