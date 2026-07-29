"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, LogOut, User as UserIcon, Calendar, CheckCircle2, Loader2, Users } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  createdAt?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load Auth State
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      router.push('/auth');
      return;
    }

    try {
      setToken(storedToken);
      setCurrentUser(JSON.parse(storedUser));
    } catch {
      localStorage.clear();
      router.push('/auth');
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  // Debounced User Search
  useEffect(() => {
    if (!token) return;

    const delayDebounceFn = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

      try {
        const res = await fetch(`${apiUrl}/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        } else if (res.status === 401) {
          localStorage.clear();
          router.push('/auth');
        }
      } catch (err) {
        console.error('Search request failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, token, router]);

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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 font-bold text-white shadow-lg shadow-violet-500/20">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">User Hub</h1>
              <p className="text-xs text-zinc-400">Auth & User Directory API</p>
            </div>
          </div>

          {/* User Status & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-1.5 text-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="font-medium text-zinc-200">{currentUser?.username}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Find Other Registered Users
          </h2>
          <p className="mt-2 text-zinc-400">
            Search users in real-time by their username across the database
          </p>
        </div>

        {/* Search Input Box */}
        <div className="relative mb-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
            {searching ? (
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
            ) : (
              <Search className="h-5 w-5 text-zinc-400" />
            )}
          </div>
          <input
            type="text"
            placeholder="Type a username to search (e.g. mega, muhammad)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 py-4 pr-4 pl-12 text-base text-white placeholder-zinc-500 shadow-xl outline-none backdrop-blur-md transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        {/* Search Results List */}
        <div className="space-y-4">
          {!searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
              <Search size={40} className="mb-3 text-zinc-600" />
              <h3 className="text-lg font-medium text-zinc-300">Start typing to search</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Matches will display instantly as you type.
              </p>
            </div>
          ) : searchResults.length === 0 && !searching ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
              <Users size={40} className="mb-3 text-zinc-600" />
              <h3 className="text-lg font-medium text-zinc-300">No users found</h3>
              <p className="mt-1 text-sm text-zinc-500">
                No user matching &quot;{searchQuery}&quot; was found.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="group relative flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 transition-all hover:border-violet-500/50 hover:bg-zinc-900"
                >
                  <div className="flex items-center gap-3">
                    {/* User Avatar */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 font-bold text-white shadow-md">
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white group-hover:text-violet-400">
                          {user.username}
                        </span>
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <UserIcon size={12} />
                          ID: {user.id.slice(-6)}
                        </span>
                        {user.createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
                    Active User
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
