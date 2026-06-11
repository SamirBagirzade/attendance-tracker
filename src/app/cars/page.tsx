"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { Car } from "@/types/domain";

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [form, setForm] = useState({ makeModel: "", licensePlate: "" });
  const [error, setError] = useState("");
  const [savedCarId, setSavedCarId] = useState<number | null>(null);

  const loadCars = useCallback(async () => {
    setError("");
    const response = await fetch("/api/cars");

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not load cars.");
      return;
    }

    setCars(await response.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCars();
  }, [loadCars]);

  async function createCar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavedCarId(null);

    const response = await fetch("/api/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not add car.");
      return;
    }

    setForm({ makeModel: "", licensePlate: "" });
    await loadCars();
  }

  async function updateCar(car: Car) {
    setError("");
    setSavedCarId(null);

    const response = await fetch(`/api/cars/${car.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(car),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not update car.");
      await loadCars();
      return;
    }

    setCars((current) => current.map((item) => (item.id === car.id ? car : item)));
    setSavedCarId(car.id);
  }

  async function deleteCar(id: number) {
    setError("");
    setSavedCarId(null);

    const response = await fetch(`/api/cars/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not delete car.");
      return;
    }

    setCars((current) => current.filter((car) => car.id !== id));
  }

  return (
    <AppShell title="Cars" eyebrow="Fleet">
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px_auto]"
          onSubmit={createCar}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Make model
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) =>
                setForm((current) => ({ ...current, makeModel: event.target.value }))
              }
              placeholder="Toyota Prado"
              value={form.makeModel}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            License plate
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm uppercase outline-none focus:border-slate-500"
              onChange={(event) =>
                setForm((current) => ({ ...current, licensePlate: event.target.value }))
              }
              placeholder="10-AA-100"
              value={form.licensePlate}
            />
          </label>
          <div className="flex items-end">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Plus size={16} />
              Add
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
                  <th className="px-4 py-3 font-semibold text-slate-700">Make model</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">License plate</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cars.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
                      No cars
                    </td>
                  </tr>
                ) : (
                  cars.map((car) => (
                    <tr className="border-b border-slate-100" key={car.id}>
                      <td className="px-4 py-3">
                        <input
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                          onBlur={() => void updateCar(car)}
                          onChange={(event) =>
                            setCars((current) =>
                              current.map((item) =>
                                item.id === car.id
                                  ? { ...item, makeModel: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          value={car.makeModel}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm uppercase outline-none focus:border-slate-500"
                          onBlur={() => void updateCar(car)}
                          onChange={(event) =>
                            setCars((current) =>
                              current.map((item) =>
                                item.id === car.id
                                  ? { ...item, licensePlate: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          value={car.licensePlate}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {savedCarId === car.id ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <Check size={14} />
                              Saved
                            </span>
                          ) : null}
                          <button
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                            onClick={() => void deleteCar(car.id)}
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
