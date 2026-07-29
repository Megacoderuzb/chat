"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    try {
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 opacity-20 blur-sm" />

        <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              User Hub
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {isLogin ? 'Log in to your account' : 'Create an account to get started'}
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="mb-6 flex rounded-lg bg-zinc-950 p-1">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all duration-200 ${
                isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all duration-200 ${
                !isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Register
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Username
              </label>
              <div className="relative mt-1">
                <User size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="e.g. muhammad"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2.5 pr-4 pl-10 text-white placeholder-zinc-600 outline-none transition-all focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Password
              </label>
              <div className="relative mt-1">
                <Lock size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2.5 pr-4 pl-10 text-white placeholder-zinc-600 outline-none transition-all focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-3 font-semibold text-white transition-all hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Processing...' : isLogin ? 'Log In' : 'Sign Up'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
