import { motion } from "framer-motion";
import { BatterType } from "@/lib/matchTypes";

export interface MatchSettings {
  batterHand: "right" | "left";
  batterType: BatterType;
  bowlerType: "fast" | "spin" | "medium";
  bowlerArm: "right" | "left";
  bowlerPace: "fast" | "medium-fast" | "medium" | "slow";
  pitchCondition: "green" | "dusty" | "flat" | "damp";
  groundSize: number;
  boundaryLeg: number;
  boundaryOff: number;
  boundaryStraight: number;
  boundaryBack: number;
  matchSituation: "attacking" | "defensive" | "balanced" | "death-overs";
  oversRemaining: string;
  favouriteShots: string;
  worstShots: string;
}

interface SettingsPanelProps {
  settings: MatchSettings;
  onChange: (settings: MatchSettings) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

const SettingsPanel = ({ settings, onChange, onGenerate, isLoading }: SettingsPanelProps) => {
  const handleChange = (field: keyof MatchSettings, value: any) => {
    onChange({ ...settings, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Batter Hand</label>
          <div className="flex gap-1">
            {["right", "left"].map((h) => (
              <button
                key={h}
                onClick={() => handleChange("batterHand", h)}
                className={`flex-1 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                  settings.batterHand === h ? "bg-accent border-accent text-accent-foreground" : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Batter Type</label>
          <select
            value={settings.batterType}
            onChange={(e) => handleChange("batterType", e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:border-accent"
          >
            {["aggressive", "defensive", "balanced", "tailender", "new-to-crease", "unknown"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Bowler Type</label>
          <select
            value={settings.bowlerType}
            onChange={(e) => handleChange("bowlerType", e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:border-accent"
          >
            {["fast", "spin", "medium"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Bowler Arm</label>
          <div className="flex gap-1">
            {["right", "left"].map((a) => (
              <button
                key={a}
                onClick={() => handleChange("bowlerArm", a)}
                className={`flex-1 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                  settings.bowlerArm === a ? "bg-accent border-accent text-accent-foreground" : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Pitch Condition</label>
        <div className="grid grid-cols-4 gap-1">
          {["green", "dusty", "flat", "damp"].map((p) => (
            <button
              key={p}
              onClick={() => handleChange("pitchCondition", p)}
              className={`py-1.5 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                settings.pitchCondition === p ? "bg-accent border-accent text-accent-foreground" : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Situation</label>
        <select
          value={settings.matchSituation}
          onChange={(e) => handleChange("matchSituation", e.target.value)}
          className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:border-accent"
        >
          {["attacking", "defensive", "balanced", "death-overs"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Favourite Shots</label>
          <input
            type="text"
            value={settings.favouriteShots}
            onChange={(e) => handleChange("favouriteShots", e.target.value)}
            placeholder="e.g. Cover Drive"
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Worst Shots</label>
          <input
            type="text"
            value={settings.worstShots}
            onChange={(e) => handleChange("worstShots", e.target.value)}
            placeholder="e.g. Pull Shot"
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Boundary Distances (m)</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              {settings.batterHand === "left" ? "Leg Side" : "Off Side"}
            </label>
            <input
              type="number"
              value={settings.boundaryOff}
              onChange={(e) => handleChange("boundaryOff", parseInt(e.target.value) || 0)}
              className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              {settings.batterHand === "left" ? "Off Side" : "Leg Side"}
            </label>
            <input
              type="number"
              value={settings.boundaryLeg}
              onChange={(e) => handleChange("boundaryLeg", parseInt(e.target.value) || 0)}
              className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Bowler End (Straight)</label>
            <input
              type="number"
              value={settings.boundaryStraight}
              onChange={(e) => handleChange("boundaryStraight", parseInt(e.target.value) || 0)}
              className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Batsman End (Behind)</label>
            <input
              type="number"
              value={settings.boundaryBack}
              onChange={(e) => handleChange("boundaryBack", parseInt(e.target.value) || 0)}
              className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="w-full h-10 rounded-lg bg-accent text-accent-foreground font-mono uppercase tracking-wider text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
      >
        {isLoading ? "Generating..." : "Generate Field"}
      </button>
    </div>
  );
};

export default SettingsPanel;
