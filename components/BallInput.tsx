import { useState } from "react";
import { BallResult, ShotType, ShotDirection, BallType } from "@/lib/matchTypes";

interface BallInputProps {
  onBallRecorded: (result: BallResult, shotType: ShotType, shotDirection: ShotDirection, ballType: BallType, additionalRuns: number) => void;
  disabled?: boolean;
}

const BallInput = ({ onBallRecorded, disabled }: BallInputProps) => {
  const [result, setResult] = useState<BallResult>("normal");
  const [runs, setRuns] = useState(0);
  const [shotType, setShotType] = useState<ShotType>("unknown");
  const [shotDirection, setShotDirection] = useState<ShotDirection>("unknown");
  const [ballType, setBallType] = useState<BallType>("good-length");

  const handleRecord = () => {
    onBallRecorded(result, shotType, shotDirection, ballType, runs);
    // Reset some states
    setResult("normal");
    setRuns(0);
    setShotType("unknown");
    setShotDirection("unknown");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Delivery Type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(["normal", "wide", "no-ball", "byes", "leg-byes", "wicket"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setResult(r)}
              disabled={disabled}
              className={`py-2 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${result === r ? "bg-accent border-accent text-accent-foreground" : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Runs (Off Bat/Extras)</label>
        <div className="grid grid-cols-6 gap-1.5">
          {[0, 1, 2, 3, 4, 6].map((r) => (
            <button
              key={r}
              onClick={() => setRuns(r)}
              disabled={disabled}
              className={`py-2 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${runs === r ? "bg-accent border-accent text-accent-foreground" : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Shot Type</label>
          <select
            value={shotType}
            onChange={(e) => setShotType(e.target.value as ShotType)}
            disabled={disabled}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:border-accent"
          >
            {["unknown", "drive", "cut", "pull", "hook", "sweep", "reverse-sweep", "flick", "glance", "edge", "defence", "slog", "loft"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Direction</label>
          <select
            value={shotDirection}
            onChange={(e) => setShotDirection(e.target.value as ShotDirection)}
            disabled={disabled}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:border-accent"
          >
            {["unknown", "cover", "mid-off", "straight", "mid-on", "mid-wicket", "square-leg", "fine-leg", "third-man", "point", "backward-point", "gully"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Ball Type</label>
          <select
            value={ballType}
            onChange={(e) => setBallType(e.target.value as BallType)}
            disabled={disabled}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:border-accent"
          >
            {["good-length", "short", "full", "yorker", "wide", "bouncer", "unknown"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleRecord}
        disabled={disabled}
        className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
      >
        Record Ball
      </button>
    </div>
  );
};

export default BallInput;
