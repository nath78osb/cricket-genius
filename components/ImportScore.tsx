import { useState } from "react";
import { InningsScore, BatterStats, BowlerStats } from "@/lib/matchTypes";

interface ImportScoreProps {
  onImport: (data: {
    innings: InningsScore;
    batters: BatterStats[];
    bowlers: BowlerStats[];
    previousInnings: InningsScore[];
  }) => void;
}

const ImportScore = ({ onImport }: ImportScoreProps) => {
  const [runs, setRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [overs, setOvers] = useState(0);
  const [balls, setBalls] = useState(0);
  const [extras, setExtras] = useState(0);
  const [target, setTarget] = useState<number | "">("");

  const handleImport = () => {
    const innings: InningsScore = {
      runs,
      wickets,
      overs,
      balls,
      extras,
      target: target === "" ? null : target,
    };

    // Create "Imported Score" entries
    const batters: BatterStats[] = [
      { 
        name: "Imported Score", 
        runs: runs - extras, // Batter runs are total runs minus extras
        balls: (overs * 6 + balls), 
        fours: 0, 
        sixes: 0, 
        isOut: true, 
        hand: "right", 
        type: "unknown",
        dismissal: "Imported"
      }
    ];

    const bowlers: BowlerStats[] = [
      { 
        name: "Imported Score", 
        overs, 
        balls, 
        runs: runs - extras, // Bowler runs conceded (usually excludes some extras but for import we'll simplify)
        wickets, 
        extras, 
        arm: "right", 
        type: "medium" 
      }
    ];

    onImport({ innings, batters, bowlers, previousInnings: [] });
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-xs font-mono text-primary uppercase tracking-wider font-bold">Import Current Score</h3>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Quickly catch up to live match</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Runs</label>
          <input
            type="number"
            value={runs}
            onChange={(e) => setRuns(parseInt(e.target.value) || 0)}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Wickets</label>
          <input
            type="number"
            value={wickets}
            onChange={(e) => setWickets(parseInt(e.target.value) || 0)}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Overs</label>
          <input
            type="number"
            value={overs}
            onChange={(e) => setOvers(parseInt(e.target.value) || 0)}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Balls</label>
          <input
            type="number"
            value={balls}
            onChange={(e) => setBalls(parseInt(e.target.value) || 0)}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Extras</label>
          <input
            type="number"
            value={extras}
            onChange={(e) => setExtras(parseInt(e.target.value) || 0)}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Target (Optional)</label>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value === "" ? "" : parseInt(e.target.value))}
            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <button
        onClick={handleImport}
        className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-mono uppercase tracking-wider text-xs font-bold transition-all hover:opacity-90"
      >
        Import Score
      </button>
    </div>
  );
};

export default ImportScore;
