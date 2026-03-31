"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/useAuth";

interface ApiKey {
  _id: string;
  keyPrefix: string;
  description: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; keyPrefix: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchKeys();
  }, [user, fetchKeys]);

  if (!user) return null;

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/auth/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newDescription }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey({ key: data.key, keyPrefix: data.keyPrefix });
        setNewDescription("");
        setShowCreateForm(false);
        await fetchKeys();
      } else {
        setError(data.error ?? "Failed to create API key");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this API key? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/auth/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k._id !== id));
        if (newKey) setNewKey(null);
      }
    } catch {
      // ignore
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your account settings
          </p>
        </div>

        {/* API Keys Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">API Keys</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Use API keys to access the Paperview API from external applications
              </p>
            </div>
            {!showCreateForm && (
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setNewKey(null);
                  setError("");
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                New API Key
              </button>
            )}
          </div>

          {/* Create form */}
          {showCreateForm && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                New API Key
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Description (optional)"
                  maxLength={200}
                  autoFocus
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setError("");
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
              {error && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
          )}

          {/* Newly created key display */}
          {newKey && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                API key created
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mb-3">
                ⚠️ This key will only be shown once. Store it securely.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded px-3 py-2 font-mono text-gray-900 dark:text-gray-100 overflow-x-auto whitespace-nowrap">
                  {newKey.key}
                </code>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shrink-0"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {/* Keys list */}
          <div className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                No API keys yet. Create one to get started.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Key Prefix
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Used
                    </th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {keys.map((k) => (
                    <tr key={k._id}>
                      <td className="py-3 text-gray-900 dark:text-gray-100 pr-4">
                        {k.description || (
                          <span className="text-gray-400 dark:text-gray-500 italic">
                            No description
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded font-mono">
                          {k.keyPrefix}…
                        </code>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                        {k.lastUsedAt
                          ? new Date(k.lastUsedAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDelete(k._id)}
                          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
