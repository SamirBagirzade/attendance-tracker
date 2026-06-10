"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not sign in.");
      return;
    }

    router.push(searchParams.get("next") || "/timesheet");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        className="grid w-full max-w-sm gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={login}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Attendance Tracker
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Sign In</h1>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Username
          <input
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Password
          <input
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
          type="submit"
        >
          <LogIn size={16} />
          Sign In
        </button>
      </form>
    </main>
  );
}
