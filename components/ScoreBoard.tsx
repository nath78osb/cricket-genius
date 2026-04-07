import { MatchState, BatterStats, BowlerStats } from "@/lib/matchTypes";
import { User, Activity, Settings2 } from "lucide-react";
import { useState } from "react";

interface ScoreBoardProps {
  match: MatchState;
  onUpdateBatter: (index: number, updates: Partial<BatterStats>) => void;
  onUpdateBowler: (index: number, updates: Partial<BowlerStats>) => void;
}

const ScoreBoard = ({ match, onUpdateBatter, onUpdateBowler }: ScoreBoardProps) => {
  const currentInnings = match.innings[match.currentInnings - 1];
  const batters = match.batters;
  const bowlers = match.bowlers;
  const [editingBatter, setEditingBatter] = useState<number | null>(null);
  const [editingBowler, setEditingBowler] = useState<number | null>(null);

  const getPowerplay = () => {
    if (!match.powerplayConfig) return null;
    const over = currentInnings.overs;
    const config = match.powerplayConfig;
    if (over < config.p1.endOver) return { name: "P1", max: config.p1.maxOutfield };
    if (over < config.p2.endOver) return { name: "P2", max: config.p2.maxOutfield };
    if (over < config.p3.endOver) return { name: "P3", max: config.p3.maxOutfield };
    return null;
  };
  const pp = getPowerplay();

  // ... (rest of calculations: extrasBreakdown, fallOfWickets, etc.)
  const extrasBreakdown = match.ballHistory
    .filter(ball => ball.innings === match.currentInnings)
    .reduce((acc, ball) => {
      if (ball.result === "wide") acc.w += ball.extraRuns;
      if (ball.result === "no-ball") acc.nb += ball.extraRuns;
      if (ball.result === "byes") acc.b += ball.extraRuns;
      if (ball.result === "leg-byes") acc.lb += ball.extraRuns;
      return acc;
    }, { w: 0, nb: 0, b: 0, lb: 0 });

  // Calculate fall of wickets
  const fallOfWickets = match.ballHistory
    .filter(ball => ball.innings === match.currentInnings && ball.isWicket)
    .map((ball, index) => {
      const ballsUntilThisOne = match.ballHistory
        .filter(b => b.innings === match.currentInnings)
        .slice(0, match.ballHistory.filter(b => b.innings === match.currentInnings).indexOf(ball) + 1);
      const scoreAtWicket = ballsUntilThisOne.reduce((sum, b) => sum + b.runs, 0);
      return {
        wicketNum: index + 1,
        score: scoreAtWicket,
        batter: ball.batterName,
        over: `${ball.over}.${ball.ballInOver}`
      };
    });

  const battingOrder = batters.filter(b => b.balls > 0 || batters.indexOf(b) === match.currentBatterIndex || batters.indexOf(b) === match.nonStrikerIndex);
  const yetToBat = batters.filter(b => b.balls === 0 && batters.indexOf(b) !== match.currentBatterIndex && batters.indexOf(b) !== match.nonStrikerIndex);

  return (
    <div className="bg-card/80 backdrop-blur border border-border rounded-xl overflow-hidden shadow-lg">
      {/* Header Summary */}
      <div className="bg-secondary/30 p-4 border-b border-border flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {currentInnings.runs}/{currentInnings.wickets}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({currentInnings.overs}.{currentInnings.balls} ov)
            </span>
          </h2>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <span>Innings {match.currentInnings}/{match.totalInnings} | {match.format.toUpperCase()}</span>
            {pp && (
              <span className="px-1.5 py-0.5 bg-accent/10 text-accent rounded border border-accent/20 font-bold">
                {pp.name} (Max {pp.max} Outfield)
              </span>
            )}
          </p>
        </div>
        {currentInnings.target && (
          <div className="text-right">
            <p className="text-[10px] font-mono text-accent uppercase tracking-wider font-bold">
              Target: {currentInnings.target}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Need {Math.max(0, currentInnings.target - currentInnings.runs)} runs
            </p>
          </div>
        )}
      </div>

      {/* Batting Section */}
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Batting</span>
          <div className="flex gap-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <span className="w-6 text-right">R</span>
            <span className="w-6 text-right">B</span>
            <span className="w-4 text-right">4s</span>
            <span className="w-4 text-right">6s</span>
            <span className="w-12 text-right">S/R</span>
          </div>
        </div>

        <div className="space-y-3">
          {battingOrder.map((batter, idx) => {
            const isStriker = batters.indexOf(batter) === match.currentBatterIndex;
            const isNonStriker = batters.indexOf(batter) === match.nonStrikerIndex;
            const sr = batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : "0.0";

            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3 items-center">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold ${batter.isOut ? "text-muted-foreground" : "text-foreground"}`}>
                          {batter.name}
                          {(isStriker || isNonStriker) && !batter.isOut && "*"}
                        </span>
                        <button 
                          onClick={() => setEditingBatter(editingBatter === idx ? null : idx)}
                          className="p-1 hover:bg-secondary rounded-full transition-colors"
                        >
                          <Settings2 className={`w-3 h-3 ${editingBatter === idx ? "text-accent" : "text-muted-foreground"}`} />
                        </button>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono uppercase">
                          {batter.hand[0]}{batter.type[0]}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">
                        {batter.isOut ? batter.dismissal : "not out"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs font-mono">
                    <span className="w-6 text-right font-bold">{batter.runs}</span>
                    <span className="w-6 text-right text-muted-foreground">{batter.balls}</span>
                    <span className="w-4 text-right text-muted-foreground">{batter.fours}</span>
                    <span className="w-4 text-right text-muted-foreground">{batter.sixes}</span>
                    <span className="w-12 text-right text-muted-foreground">{sr}</span>
                  </div>
                </div>

                {/* Inline Batter Editor */}
                {editingBatter === idx && (
                  <div className="ml-11 p-2 bg-secondary/30 rounded-lg border border-border/50 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                      <label className="text-[8px] font-mono text-muted-foreground uppercase">Hand</label>
                      <select
                        value={batter.hand}
                        onChange={(e) => onUpdateBatter(idx, { hand: e.target.value as any })}
                        className="w-full bg-background border border-border rounded px-1.5 py-1 text-[9px] font-mono uppercase focus:outline-none focus:border-accent"
                      >
                        <option value="right">Right</option>
                        <option value="left">Left</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-mono text-muted-foreground uppercase">Type</label>
                      <select
                        value={batter.type}
                        onChange={(e) => onUpdateBatter(idx, { type: e.target.value as any })}
                        className="w-full bg-background border border-border rounded px-1.5 py-1 text-[9px] font-mono uppercase focus:outline-none focus:border-accent"
                      >
                        <option value="balanced">Balanced</option>
                        <option value="aggressive">Aggressive</option>
                        <option value="defensive">Defensive</option>
                        <option value="tailender">Tailender</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Extras */}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-xs font-medium">Extras</span>
          <div className="flex gap-2 items-center">
            <span className="text-xs font-bold">{currentInnings.extras}</span>
            <span className="text-[10px] text-muted-foreground">
              (W {extrasBreakdown.w}, NB {extrasBreakdown.nb}, B {extrasBreakdown.b}, LB {extrasBreakdown.lb})
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center py-2 border-y border-border bg-secondary/10 px-2 -mx-2">
          <span className="text-xs font-bold uppercase tracking-wider">Total runs</span>
          <span className="text-xs font-bold">
            {currentInnings.runs} ({currentInnings.wickets} wkts, {currentInnings.overs}.{currentInnings.balls} ov)
          </span>
        </div>

        {/* Yet to bat */}
        {yetToBat.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Yet to bat</p>
            <p className="text-xs text-muted-foreground">
              {yetToBat.map(b => b.name).join(" • ")}
            </p>
          </div>
        )}

        {/* Fall of Wickets */}
        {fallOfWickets.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Fall of Wickets</p>
            <div className="text-[10px] text-muted-foreground leading-relaxed">
              {fallOfWickets.map((f, i) => (
                <span key={i}>
                  <span className="font-bold text-foreground">{f.score}/{f.wicketNum}</span> ({f.batter}, {f.over} ov)
                  {i < fallOfWickets.length - 1 && " • "}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bowling Section */}
      <div className="bg-secondary/20 p-4 space-y-3">
        <div className="flex justify-between items-center border-b border-border pb-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Bowling</span>
          <div className="flex gap-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <span className="w-8 text-right">O</span>
            <span className="w-6 text-right">M</span>
            <span className="w-6 text-right">R</span>
            <span className="w-6 text-right">W</span>
            <span className="w-10 text-right">Econ</span>
          </div>
        </div>

        <div className="space-y-2">
          {bowlers.filter(b => b.overs > 0 || b.balls > 0 || bowlers.indexOf(b) === match.currentBowlerIndex).map((bowler, idx) => {
            const econ = (bowler.overs + bowler.balls / 6) > 0 ? (bowler.runs / (bowler.overs + bowler.balls / 6)).toFixed(2) : "0.00";
            return (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2 items-center">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold">{bowler.name}</span>
                      <button 
                        onClick={() => setEditingBowler(editingBowler === idx ? null : idx)}
                        className="p-1 hover:bg-secondary rounded-full transition-colors"
                      >
                        <Settings2 className={`w-2.5 h-2.5 ${editingBowler === idx ? "text-accent" : "text-muted-foreground"}`} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs font-mono">
                    <span className="w-8 text-right">{bowler.overs}.{bowler.balls}</span>
                    <span className="w-6 text-right">0</span> {/* Maidens not tracked yet */}
                    <span className="w-6 text-right">{bowler.runs}</span>
                    <span className="w-6 text-right font-bold">{bowler.wickets}</span>
                    <span className="w-10 text-right text-muted-foreground">{econ}</span>
                  </div>
                </div>

                {/* Inline Bowler Editor */}
                {editingBowler === idx && (
                  <div className="ml-8 p-2 bg-secondary/30 rounded-lg border border-border/50 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                      <label className="text-[8px] font-mono text-muted-foreground uppercase">Arm</label>
                      <select
                        value={bowler.arm}
                        onChange={(e) => onUpdateBowler(idx, { arm: e.target.value as any })}
                        className="w-full bg-background border border-border rounded px-1.5 py-1 text-[9px] font-mono uppercase focus:outline-none focus:border-accent"
                      >
                        <option value="right">Right</option>
                        <option value="left">Left</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-mono text-muted-foreground uppercase">Type</label>
                      <select
                        value={bowler.type}
                        onChange={(e) => onUpdateBowler(idx, { type: e.target.value as any })}
                        className="w-full bg-background border border-border rounded px-1.5 py-1 text-[9px] font-mono uppercase focus:outline-none focus:border-accent"
                      >
                        <option value="fast">Fast</option>
                        <option value="medium">Medium</option>
                        <option value="spin">Spin</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ScoreBoard;
