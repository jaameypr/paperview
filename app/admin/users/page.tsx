"use client";

import { useState, useEffect, FormEvent } from "react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/useAuth";
import type { UserDTO } from "@/types/user";

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "user" });
  const [error, setError] = useState("");

  function fetchUsers() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setShowCreate(false);
      setForm({ username: "", email: "", password: "", role: "user" });
      fetchUsers();
    } else {
      setError(data.error ?? "Failed to create user");
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    fetchUsers();
  }

  async function resetPassword(id: string) {
    const newPassword = prompt("Enter new password (min 6 chars):");
    if (!newPassword || newPassword.length < 6) return;
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    fetchUsers();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user permanently?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchUsers();
  }

  if (me?.role !== "admin") {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Admin access required.</p>
        </div>
      </AppShell>
    );
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + New User
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                className={inputClass}
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Password (min 6)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                className={inputClass}
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={inputClass}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
              Create User
            </button>
          </form>
        )}

        {/* User list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u._id}
                className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between ${
                  !u.isActive ? "opacity-50" : ""
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{u.username}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === "admin"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}>
                      {u.role}
                    </span>
                    {!u.isActive && <span className="text-xs text-red-500">Inactive</span>}
                    {u.mustChangePassword && <span className="text-xs text-amber-500">Must change password</span>}
                  </div>
                  {u.email && <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>}
                </div>
                {u._id !== me?._id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(u._id, !u.isActive)}
                      className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => resetPassword(u._id)}
                      className="text-xs text-gray-400 hover:text-amber-500 transition-colors"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => deleteUser(u._id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
