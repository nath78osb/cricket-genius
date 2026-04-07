import { useState } from "react";
import { Format } from "@/lib/matchTypes";

interface MatchSetupProps {
  onStart: (data: any) => void;
}

const MatchSetup = ({ onStart }: MatchSetupProps) => {
  const [format, setFormat] = useState<Format>("t20");
  const [pitchCondition, setPitchCondition] = useState("flat");
  const [boundaryOff, setBoundaryOff] = useState(70);
  const [boundaryLeg, setBoundaryLeg] = useState(65);
  const [boundaryBowler, setBoundaryBowler] = useState(75);
  const [boundaryBatsman, setBoundaryBatsman] = useState(60);
  const [squad, setSquad] = useState("Batter 1, Batter 2, Batter 3, Batter 4, Batter 5, Batter 6, Batter 7, Batter 8, Batter 9, Batter 10, Batter 11");
  
  // Powerplay state
  const [p1End, setP1End] = useState(6);
  const [p1Max, setP1Max] = useState(2);
  const [p2End, setP2End] = useState(20);
  const [p2Max, setP2Max] = useState(5);
  const [p3End, setP3End] = useState(0);
  const [p3Max, setP3Max] = useState(0);

  const handleFormatChange = (f: Format) => {
    setFormat(f);
    if (f === "t20") {
      setP1End(6); setP1Max(2);
      setP2End(20); setP2Max(5);
      setP3End(0); setP3Max(0);
    } else if (f === "40-over") {
      setP1End(8); setP1Max(2);
      setP2End(32); setP2Max(4);
      setP3End(40); setP3Max(5);
    } else if (f === "45-over") {
      setP1End(9); setP1Max(2);
      setP2End(36); setP2Max(4);
      setP3End(45); setP3Max(5);
    } else if (f === "odi") {
      setP1End(10); setP1Max(2);
      setP2End(40); setP2Max(4);
      setP3End(50); setP3Max(5);
    } else {
      // Test / Timed
      setP1End(0); setP1Max(9);
      setP2End(0); setP2Max(9);
      setP3End(0); setP3Max(9);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold text-foreground">New Match Setup</h2>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mt-1">Configure Live Simulation</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Batting Squad (Comma separated)</label>
          <textarea
            value={squad}
            onChange={(e) => setSquad(e.target.value)}
            placeholder="Enter player names..."
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-[10px] font-mono focus:outline-none focus:border-accent min-h-[60px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Match Format</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["t20", "40-over", "45-over", "odi", "test"] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleFormatChange(f)}
                className={`py-2 rounded-lg text-[9px] font-mono uppercase tracking-tighter border transition-all ${
                  format === f ? "bg-accent border-accent text-accent-foreground" : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "test" ? "Test / Timed" : f.replace("-over", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Powerplay Config */}
        {format !== "test" && (
          <div className="space-y-2 p-3 bg-secondary/30 rounded-xl border border-border/50">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Powerplay Restrictions (Max Outfield)</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[8px] font-mono text-muted-foreground uppercase">P1 (to Over)</label>
                <div className="flex gap-1">
                  <input type="number" value={p1End} onChange={(e) => setP1End(parseInt(e.target.value) || 0)} className="w-full bg-background border border-border rounded px-1 py-1 text-[9px] font-mono" />
                  <input type="number" value={p1Max} onChange={(e) => setP1Max(parseInt(e.target.value) || 0)} className="w-10 bg-accent/10 border border-accent/20 rounded px-1 py-1 text-[9px] font-mono text-accent" title="Max Outfield" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-mono text-muted-foreground uppercase">P2 (to Over)</label>
                <div className="flex gap-1">
                  <input type="number" value={p2End} onChange={(e) => setP2End(parseInt(e.target.value) || 0)} className="w-full bg-background border border-border rounded px-1 py-1 text-[9px] font-mono" />
                  <input type="number" value={p2Max} onChange={(e) => setP2Max(parseInt(e.target.value) || 0)} className="w-10 bg-accent/10 border border-accent/20 rounded px-1 py-1 text-[9px] font-mono text-accent" title="Max Outfield" />
                </div>
              </div>
              {(format === "odi" || format === "40-over" || format === "45-over") && (
                <div className="space-y-1">
                  <label className="text-[8px] font-mono text-muted-foreground uppercase">P3 (to Over)</label>
                  <div className="flex gap-1">
                    <input type="number" value={p3End} onChange={(e) => setP3End(parseInt(e.target.value) || 0)} className="w-full bg-background border border-border rounded px-1 py-1 text-[9px] font-mono" />
                    <input type="number" value={p3Max} onChange={(e) => setP3Max(parseInt(e.target.value) || 0)} className="w-10 bg-accent/10 border border-accent/20 rounded px-1 py-1 text-[9px] font-mono text-accent" title="Max Outfield" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Pitch Condition</label>
          <select
            value={pitchCondition}
            onChange={(e) => setPitchCondition(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:border-accent"
          >
            {["flat", "green", "dusty", "damp"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Boundary Distances (m)</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Off Side</label>
              <input
                type="number"
                value={boundaryOff}
                onChange={(e) => setBoundaryOff(parseInt(e.target.value) || 0)}
                className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Leg Side</label>
              <input
                type="number"
                value={boundaryLeg}
                onChange={(e) => setBoundaryLeg(parseInt(e.target.value) || 0)}
                className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Bowler End (Straight)</label>
              <input
                type="number"
                value={boundaryBowler}
                onChange={(e) => setBoundaryBowler(parseInt(e.target.value) || 0)}
                className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Batsman End (Behind)</label>
              <input
                type="number"
                value={boundaryBatsman}
                onChange={(e) => setBoundaryBatsman(parseInt(e.target.value) || 0)}
                className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => onStart({ 
            format, 
            pitchCondition,
            squad: squad.split(",").map(s => s.trim()).filter(s => s.length > 0),
            boundaryDistances: {
              off: boundaryOff,
              leg: boundaryLeg,
              straight: boundaryBowler,
              behind: boundaryBatsman
            },
            powerplayConfig: {
              p1: { endOver: p1End, maxOutfield: p1Max },
              p2: { endOver: p2End, maxOutfield: p2Max },
              p3: { endOver: p3End, maxOutfield: p3Max }
            }
          })}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Start Match
        </button>
      </div>
    </div>
  );
};

export default MatchSetup;
