import { useEffect, useRef, useState } from "react";
import { useRoom } from "../hooks/useRoom";
import type { RoomSettings } from "../types/room";

interface RoomSettingsPanelProps {
  settings: RoomSettings;
}

export const RoomSettingsPanel = ({ settings }: RoomSettingsPanelProps) => {
  const { playerId, room, updateRoomSettings } = useRoom();
  const isHost = room?.hostId === playerId;
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(settings);
    setIsSaving(false);
  }, [settings]);

  useEffect(() => {
    if (!isHost) {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    const serializedDraft = JSON.stringify(draft);
    const serializedSettings = JSON.stringify(settings);
    if (serializedDraft === serializedSettings) {
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      updateRoomSettings(draft);
      debounceRef.current = null;
    }, 220);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [draft, settings, isHost, updateRoomSettings]);

  const setNumberField = <K extends keyof RoomSettings>(
    key: K,
    value: number
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const setBooleanField = <K extends keyof RoomSettings>(
    key: K,
    value: boolean
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };


  const labelClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Room Settings</div>
          <p className="mt-1 text-sm text-slate-500">
            {isHost
              ? "Adjust the lobby before starting the match."
              : "Only the host can modify settings."}
          </p>
        </div>
        <div className="text-xs text-slate-400">{isSaving ? "Saving..." : "Synced"}</div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-1">
          <div className={labelClass}>
            Max Players <span className="normal-case font-normal text-slate-400">{draft.maxPlayers}</span>
          </div>
          <input
            type="range"
            min={2}
            max={20}
            value={draft.maxPlayers}
            disabled={!isHost}
            onChange={(event) => setNumberField("maxPlayers", Number(event.target.value))}
            className="w-full accent-orange-500 disabled:cursor-not-allowed"
          />
        </label>

        <label className="space-y-2">
          <div className={labelClass}>
            Rounds <span className="normal-case font-normal text-slate-400">{draft.rounds}</span>
          </div>
          <input
            type="range"
            min={2}
            max={10}
            value={draft.rounds}
            disabled={!isHost}
            onChange={(event) => setNumberField("rounds", Number(event.target.value))}
            className="w-full accent-orange-500 disabled:cursor-not-allowed"
          />
        </label>

        <label className="space-y-2">
          <div className={labelClass}>
            Draw Time <span className="normal-case font-normal text-slate-400">{draft.drawTime}s</span>
          </div>
          <input
            type="range"
            min={15}
            max={240}
            step={5}
            value={draft.drawTime}
            disabled={!isHost}
            onChange={(event) => setNumberField("drawTime", Number(event.target.value))}
            className="w-full accent-orange-500 disabled:cursor-not-allowed"
          />
        </label>

        <label className="space-y-2">
          <div className={labelClass}>
            Word Choice Count <span className="normal-case font-normal text-slate-400">{draft.wordChoices}</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={draft.wordChoices}
            disabled={!isHost}
            onChange={(event) => setNumberField("wordChoices", Number(event.target.value))}
            className="w-full accent-orange-500 disabled:cursor-not-allowed"
          />
        </label>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3 sm:col-span-1">
          <div>
            <div className={labelClass}>Hints</div>
            <div className="mt-1 text-xs text-slate-400">Enable automatic letter reveals.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Enable hints"
            aria-checked={draft.hintsEnabled}
            disabled={!isHost}
            onClick={() => setBooleanField("hintsEnabled", !draft.hintsEnabled)}
            className={`relative h-7 w-12 rounded-full transition-colors ${draft.hintsEnabled ? "bg-orange-500" : "bg-stone-300"} disabled:cursor-not-allowed`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${draft.hintsEnabled ? "left-6" : "left-1"}`}
            />
          </button>
        </div>

        <label className="space-y-2">
          <div className={labelClass}>Hint Count</div>
          <select
            value={draft.hintCount}
            disabled={!isHost || !draft.hintsEnabled}
            onChange={(event) => setNumberField("hintCount", Number(event.target.value))}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-orange-400 disabled:cursor-not-allowed disabled:bg-stone-100"
          >
            {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        
      </div>

      <div className="mt-4 text-xs text-slate-400">
        {isHost ? "Changes sync live to every connected player." : "Only the host can modify settings."}
      </div>
    </div>
  );
};
