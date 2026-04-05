"use client";

import { useState, useEffect } from "react";
import { Popover } from "radix-ui";
import { ChevronDownIcon, CheckIcon, SearchIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOURNAMENTS = [
  "Friendly",
  "FIFA World Cup",
  "UEFA Euro",
  "Copa América",
  "AFC Asian Cup",
  "UEFA Nations League",
  "CONMEBOL World Cup qualification",
  "UEFA World Cup qualification",
];

type Prediction = {
  result: string;
  confidence: number;
  probabilities: { "Home Win": number; Draw: number; "Away Win": number };
  home_form: { win_rate: number; avg_scored: number; avg_conceded: number };
  away_form: { win_rate: number; avg_scored: number; avg_conceded: number };
};

function TeamCombobox({
  teams,
  value,
  onChange,
  placeholder,
}: {
  teams: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? teams.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
    : teams;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <Popover.Trigger asChild>
        <button
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl border bg-white/5 px-4 py-3.5 text-sm transition-all focus:outline-none",
            value ? "text-white" : "text-white/30",
            open
              ? "border-emerald-500/50 ring-2 ring-emerald-500/20"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.08]"
          )}
        >
          <span className="truncate font-medium">{value || placeholder}</span>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-white/30 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          avoidCollisions
          className="z-[9999] w-[var(--radix-popover-trigger-width)] min-w-64 rounded-xl border border-white/10 bg-[#13131f] shadow-2xl shadow-black/60 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
        >
          {/* Search input */}
          <div className="p-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2">
              <SearchIcon className="size-3.5 shrink-0 text-white/30" />
              <input
                autoFocus
                placeholder="Search teams..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-white/30 hover:text-white/60 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Team list */}
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-white/25">
                No teams found
              </p>
            ) : (
              filtered.map((team) => (
                <button
                  key={team}
                  onClick={() => {
                    onChange(team);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                    value === team
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <span className="flex size-3.5 shrink-0 items-center justify-center">
                    {value === team && <CheckIcon className="size-3.5" />}
                  </span>
                  {team}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const OUTCOME_STYLES = {
  "Home Win": {
    text: "text-emerald-400",
    gradient: "from-emerald-500/[0.08] via-transparent to-transparent",
    border: "border-emerald-500/20",
    shadow: "shadow-emerald-500/5",
    bar: "bg-emerald-400",
  },
  Draw: {
    text: "text-amber-400",
    gradient: "from-amber-500/[0.08] via-transparent to-transparent",
    border: "border-amber-500/20",
    shadow: "shadow-amber-500/5",
    bar: "bg-amber-400",
  },
  "Away Win": {
    text: "text-rose-400",
    gradient: "from-rose-500/[0.08] via-transparent to-transparent",
    border: "border-rose-500/20",
    shadow: "shadow-rose-500/5",
    bar: "bg-rose-400",
  },
} as const;

export default function Home() {
  const [teams, setTeams] = useState<string[]>([]);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [tournament, setTournament] = useState("Friendly");
  const [isNeutral, setIsNeutral] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/teams`)
      .then((r) => r.json())
      .then((d) => setTeams(d.teams))
      .catch(() => setError("Backend not running. Start uvicorn first."));
  }, []);

  async function predict() {
    if (!homeTeam || !awayTeam) return;
    if (homeTeam === awayTeam) {
      setError("Teams must be different.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_team: homeTeam,
          away_team: awayTeam,
          tournament,
          is_neutral: isNeutral,
        }),
      });
      const data = await res.json();
      setPrediction(data);
    } catch {
      setError("Prediction failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  const outcomeStyle =
    prediction &&
    prediction.result in OUTCOME_STYLES
      ? OUTCOME_STYLES[prediction.result as keyof typeof OUTCOME_STYLES]
      : null;

  return (
    <main className="min-h-screen bg-[#080810] text-white font-mono">
      {/* Top nav */}
      <header className="border-b border-white/[0.06] px-8 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <span className="text-emerald-400 text-sm font-black">M</span>
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider">
                MATCH <span className="text-emerald-400">ORACLE</span>
              </span>
              <p className="text-[9px] tracking-[0.25em] text-white/25 uppercase mt-0.5">
                ML Prediction Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] tracking-[0.2em] text-white/30 uppercase">
              XGBoost · 45k matches
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-8 py-10 space-y-6">
        {/* Match setup card */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {/* Teams row */}
          <div className="grid grid-cols-[1fr_80px_1fr]">
            {/* Home */}
            <div className="p-8 space-y-5">
              <div className="flex items-center gap-3">
                <span className="text-[9px] tracking-[0.25em] uppercase text-white/30 font-medium">
                  Home
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              <TeamCombobox
                teams={teams}
                value={homeTeam}
                onChange={setHomeTeam}
                placeholder="Select home team..."
              />
              {homeTeam ? (
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-xs text-white/50 truncate">{homeTeam}</span>
                </div>
              ) : (
                <div className="h-4" />
              )}
            </div>

            {/* VS */}
            <div className="flex flex-col items-center justify-center border-x border-white/[0.06]">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-px bg-gradient-to-b from-transparent to-white/10" />
                <div className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <span className="text-[10px] font-black text-white/30 tracking-wider">
                    VS
                  </span>
                </div>
                <div className="h-10 w-px bg-gradient-to-b from-white/10 to-transparent" />
              </div>
            </div>

            {/* Away */}
            <div className="p-8 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
                <span className="text-[9px] tracking-[0.25em] uppercase text-white/30 font-medium">
                  Away
                </span>
              </div>
              <TeamCombobox
                teams={teams}
                value={awayTeam}
                onChange={setAwayTeam}
                placeholder="Select away team..."
              />
              {awayTeam ? (
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs text-white/50 truncate">{awayTeam}</span>
                  <span className="size-2 rounded-full bg-rose-400 shrink-0" />
                </div>
              ) : (
                <div className="h-4" />
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.05]" />

          {/* Options row */}
          <div className="grid grid-cols-2 p-8 gap-10">
            <div className="space-y-2.5">
              <Label className="text-[9px] tracking-[0.25em] uppercase text-white/30 font-medium">
                Tournament
              </Label>
              <Select onValueChange={setTournament} defaultValue="Friendly">
                <SelectTrigger className="h-11 w-full rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/[0.08] transition-colors focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#13131f] border-white/10 text-white z-[9999]">
                  {TOURNAMENTS.map((t) => (
                    <SelectItem
                      key={t}
                      value={t}
                      className="focus:bg-white/[0.06] focus:text-white text-white/80"
                    >
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <div className="space-y-2.5 w-full">
                <Label className="text-[9px] tracking-[0.25em] uppercase text-white/30 font-medium">
                  Venue Type
                </Label>
                <div className="flex items-center gap-4 h-11 rounded-xl border border-white/10 bg-white/5 px-4">
                  <Switch
                    checked={isNeutral}
                    onCheckedChange={setIsNeutral}
                  />
                  <span className="text-sm text-white/50">
                    {isNeutral ? "Neutral venue" : "Home / Away venue"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-8 mb-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3">
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}

          {/* Predict button */}
          <div className="px-8 pb-8">
            <button
              onClick={predict}
              disabled={loading || !homeTeam || !awayTeam}
              className={cn(
                "w-full h-14 rounded-xl font-bold tracking-[0.2em] uppercase text-sm transition-all duration-200",
                "bg-emerald-500 text-black",
                "hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20",
                "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-emerald-500 disabled:hover:shadow-none"
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="size-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Analyzing...
                </span>
              ) : (
                "Predict Match"
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {prediction && outcomeStyle && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Outcome card */}
            <div
              className={cn(
                "rounded-2xl border bg-gradient-to-b p-12 text-center shadow-2xl",
                outcomeStyle.gradient,
                outcomeStyle.border,
                outcomeStyle.shadow
              )}
            >
              <p className="text-[9px] tracking-[0.35em] uppercase text-white/30 mb-6">
                Predicted Outcome
              </p>
              <p
                className={cn(
                  "text-7xl font-black tracking-tight leading-none mb-6",
                  outcomeStyle.text
                )}
              >
                {prediction.result}
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-16 bg-white/10" />
                <div className="text-center">
                  <span className="text-4xl font-black text-white">
                    {prediction.confidence}
                  </span>
                  <span className="text-xl font-bold text-white/40">%</span>
                </div>
                <div className="h-px w-16 bg-white/10" />
              </div>
              <p className="text-[9px] tracking-[0.3em] uppercase text-white/25 mt-2">
                Confidence
              </p>
            </div>

            {/* Probabilities */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8">
              <p className="text-[9px] tracking-[0.3em] uppercase text-white/30 mb-8">
                Match Probabilities
              </p>
              <div className="space-y-6">
                {(
                  [
                    ["Home Win", "bg-emerald-400", "text-emerald-400"],
                    ["Draw", "bg-amber-400", "text-amber-400"],
                    ["Away Win", "bg-rose-400", "text-rose-400"],
                  ] as const
                ).map(([label, barClass, textClass]) => {
                  const pct =
                    prediction.probabilities[
                      label as keyof typeof prediction.probabilities
                    ];
                  return (
                    <div key={label} className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/60">
                          {label}
                        </span>
                        <span
                          className={cn(
                            "text-xl font-black tabular-nums",
                            textClass
                          )}
                        >
                          {pct}
                          <span className="text-sm font-bold text-white/30">
                            %
                          </span>
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            barClass
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form stats */}
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  {
                    label: homeTeam,
                    form: prediction.home_form,
                    side: "Home",
                    accent: "emerald",
                  },
                  {
                    label: awayTeam,
                    form: prediction.away_form,
                    side: "Away",
                    accent: "rose",
                  },
                ] as const
              ).map(({ label, form, side, accent }) => {
                const isEmerald = accent === "emerald";
                return (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 space-y-6"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[9px] tracking-[0.25em] uppercase font-medium mb-1",
                            isEmerald ? "text-emerald-400/50" : "text-rose-400/50"
                          )}
                        >
                          {side} · Last 5
                        </p>
                        <p className="text-base font-bold text-white truncate">
                          {label}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "size-9 shrink-0 rounded-xl flex items-center justify-center border text-xs font-black",
                          isEmerald
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        )}
                      >
                        {side === "Home" ? "H" : "A"}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-0 divide-y divide-white/[0.05]">
                      {/* Win rate */}
                      <div className="flex items-center justify-between py-3.5">
                        <span className="text-xs text-white/35 uppercase tracking-wider">
                          Win Rate
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                isEmerald ? "bg-emerald-400" : "bg-rose-400"
                              )}
                              style={{ width: `${form.win_rate}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-white tabular-nums w-10 text-right">
                            {form.win_rate}%
                          </span>
                        </div>
                      </div>

                      {/* Avg scored */}
                      <div className="flex items-center justify-between py-3.5">
                        <span className="text-xs text-white/35 uppercase tracking-wider">
                          Avg Scored
                        </span>
                        <span className="text-sm font-bold text-emerald-400 tabular-nums">
                          {form.avg_scored}
                        </span>
                      </div>

                      {/* Avg conceded */}
                      <div className="flex items-center justify-between py-3.5">
                        <span className="text-xs text-white/35 uppercase tracking-wider">
                          Avg Conceded
                        </span>
                        <span className="text-sm font-bold text-rose-400 tabular-nums">
                          {form.avg_conceded}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
