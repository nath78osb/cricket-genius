import { motion } from "framer-motion";
import { BallData, BatterStats, SHOT_DIRECTION_ANGLES } from "@/lib/matchTypes";

interface WagonWheelProps {
  ballHistory: BallData[];
  batters: BatterStats[];
  batterHand: string;
  currentInnings: number;
}

const WagonWheel = ({ ballHistory, batters, batterHand, currentInnings }: WagonWheelProps) => {
  const isLeftHand = batterHand === "left";
  const cx = 150;
  const cy = 150;
  const radius = 130;

  // Filter balls for current innings and scoring shots off the bat
  const scoringBalls = ballHistory.filter(
    (b) => b.innings === currentInnings && b.batRuns > 0 && b.shotDirection !== "unknown"
  );

  const wagonLines = scoringBalls.map((ball) => {
    let angleDeg = SHOT_DIRECTION_ANGLES[ball.shotDirection] || 180;
    // Flip for left-hander
    if (isLeftHand && ball.shotDirection !== "straight") {
      angleDeg = 360 - angleDeg;
    }
    const angleRad = (angleDeg * Math.PI) / 180;
    // Length based on runs
    const lengthFactor = ball.batRuns >= 6 ? 0.95 : ball.batRuns >= 4 ? 0.85 : ball.batRuns >= 2 ? 0.6 : 0.4;
    const endX = cx + Math.sin(angleRad) * radius * lengthFactor;
    const endY = cy - Math.cos(angleRad) * radius * lengthFactor;
    
    let color = "hsl(210 20% 60%)"; // 1, 2, 3 runs
    if (ball.batRuns === 4) color = "hsl(148 55% 50%)";
    if (ball.batRuns === 6) color = "hsl(38 90% 55%)";

    return { startX: cx, startY: cy - 12, endX, endY, color, runs: ball.batRuns, id: ball.id };
  });

  return (
    <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Wagon Wheel</h3>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[hsl(38_90%_55%)]" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">6s</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[hsl(148_55%_50%)]" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">4s</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[hsl(210_20%_60%)]" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">1-3s</span>
          </div>
        </div>
      </div>

      <div className="relative w-[300px] h-[300px] mx-auto">
        <svg viewBox="0 0 300 300" className="w-full h-full">
          {/* Field boundary */}
          <circle cx={cx} cy={cy} r={radius} fill="hsl(148 60% 20%)" stroke="hsl(148 50% 30%)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={radius * 0.4} fill="none" stroke="hsl(148 50% 30% / 0.3)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Pitch area */}
          <rect x={cx - 5} y={cy - 15} width={10} height={30} rx={1} fill="hsl(38 40% 45%)" opacity={0.5} />

          {/* Wagon lines */}
          {wagonLines.map((line) => (
            <motion.line
              key={line.id}
              x1={line.startX}
              y1={line.startY}
              x2={line.endX}
              y2={line.endY}
              stroke={line.color}
              strokeWidth={line.runs >= 4 ? 1.5 : 0.8}
              strokeOpacity={0.7}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          ))}

          {/* Direction labels */}
          <text x={cx} y={20} textAnchor="middle" fill="hsl(210 20% 60%)" fontSize="8" fontFamily="Inter" opacity={0.5}>BEHIND (BATSMAN)</text>
          <text x={cx} y={290} textAnchor="middle" fill="hsl(210 20% 60%)" fontSize="8" fontFamily="Inter" opacity={0.5}>STRAIGHT (BOWLER)</text>
          <text x={20} y={cy} textAnchor="middle" fill="hsl(210 20% 60%)" fontSize="8" fontFamily="Inter" opacity={0.5} transform={`rotate(-90, 20, ${cy})`}>
            {isLeftHand ? "LEG" : "OFF"}
          </text>
          <text x={280} y={cy} textAnchor="middle" fill="hsl(210 20% 60%)" fontSize="8" fontFamily="Inter" opacity={0.5} transform={`rotate(90, 280, ${cy})`}>
            {isLeftHand ? "OFF" : "LEG"}
          </text>
        </svg>
      </div>
    </div>
  );
};

export default WagonWheel;
