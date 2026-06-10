"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { Location } from "@/types/domain";

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadLocations = useCallback(async () => {
    setError("");
    const response = await fetch("/api/locations");

    if (!response.ok) {
      setError("Could not load locations.");
      return;
    }

    setLocations(await response.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLocations();
  }, [loadLocations]);

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch(editingId ? `/api/locations/${editingId}` : "/api/locations", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not save location.");
      return;
    }

    setName("");
    setEditingId(null);
    await loadLocations();
  }

  async function deleteLocation(id: number) {
    setError("");
    const response = await fetch(`/api/locations/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not delete location.");
      return;
    }

    await loadLocations();
  }

  return (
    <AppShell title="Locations" eyebrow="Ezamiyyet destinations">
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form
          className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={saveLocation}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Location
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <div className="flex gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? "Update" : "Add"}
            </button>
            {editingId ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                }}
                type="button"
              >
                <X size={16} />
                Cancel
              </button>
            ) : null}
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                <th className="w-28 px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={2}>
                    No locations
                  </td>
                </tr>
              ) : (
                locations.map((location) => (
                  <tr className="border-b border-slate-100" key={location.id}>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2 font-medium text-slate-950">
                        <MapPin size={16} />
                        {location.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            setEditingId(location.id);
                            setName(location.name);
                          }}
                          title="Edit"
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-red-600 hover:bg-red-50"
                          onClick={() => void deleteLocation(location.id)}
                          title="Delete"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
