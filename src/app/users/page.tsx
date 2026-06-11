"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { AppUser, AppUserRole } from "@/types/domain";

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "VIEWER" as AppUserRole,
    isActive: true,
  });
  const [passwords, setPasswords] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [savedUserId, setSavedUserId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setError("");
    const response = await fetch("/api/users");

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not load users.");
      return;
    }

    setUsers(await response.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavedUserId(null);

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not create user.");
      return;
    }

    setForm({ username: "", password: "", role: "VIEWER", isActive: true });
    await loadUsers();
  }

  async function updateUser(id: number, payload: Partial<AppUser> & { password?: string }) {
    setError("");
    setSavedUserId(null);

    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not update user.");
      return;
    }

    const updatedUser: AppUser = await response.json();
    setUsers((current) => current.map((user) => (user.id === id ? updatedUser : user)));
    setSavedUserId(id);

    if (payload.password) {
      setPasswords((current) => ({ ...current, [id]: "" }));
    }
  }

  async function deleteUser(id: number) {
    setError("");
    setSavedUserId(null);

    const response = await fetch(`/api/users/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not delete user.");
      return;
    }

    setUsers((current) => current.filter((user) => user.id !== id));
  }

  return (
    <AppShell title="Users" eyebrow="Admin access">
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_180px_auto_auto]"
          onSubmit={createUser}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Username
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              value={form.username}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Password
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              type="password"
              value={form.password}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Role
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as AppUserRole }))
              }
              value={form.role}
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-3 text-sm font-medium text-slate-700">
            <input
              checked={form.isActive}
              className="h-4 w-4 rounded border-slate-300"
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.checked }))
              }
              type="checkbox"
            />
            Active
          </label>
          <div className="flex items-end">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Plus size={16} />
              Add User
            </button>
          </div>
        </form>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">Username</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Role</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Active</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Reset Password</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      No users
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr className="border-b border-slate-100" key={user.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-950">{user.username}</div>
                        <div className="text-xs text-slate-500">
                          Updated {new Date(user.updatedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                          onChange={(event) =>
                            void updateUser(user.id, { role: event.target.value as AppUserRole })
                          }
                          value={user.role}
                        >
                          <option value="VIEWER">Viewer</option>
                          <option value="EDITOR">Editor</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            checked={user.isActive}
                            className="h-4 w-4 rounded border-slate-300"
                            onChange={(event) =>
                              void updateUser(user.id, { isActive: event.target.checked })
                            }
                            type="checkbox"
                          />
                          {user.isActive ? "Active" : "Disabled"}
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-72 gap-2">
                          <input
                            className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                            onChange={(event) =>
                              setPasswords((current) => ({
                                ...current,
                                [user.id]: event.target.value,
                              }))
                            }
                            placeholder="New password"
                            type="password"
                            value={passwords[user.id] ?? ""}
                          />
                          <button
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!passwords[user.id]}
                            onClick={() =>
                              void updateUser(user.id, { password: passwords[user.id] })
                            }
                            type="button"
                          >
                            <Check size={16} />
                            Save
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {savedUserId === user.id ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <Check size={14} />
                              Saved
                            </span>
                          ) : null}
                          <button
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                            onClick={() => void deleteUser(user.id)}
                            type="button"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
