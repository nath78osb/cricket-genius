import { motion } from "framer-motion";
import type { BallData, BoundaryDistances } from "@/lib/matchTypes";
import { SHOT_DIRECTION_ANGLES } from "@/lib/matchTypes";

export type FielderCategory = "30yd-wall" | "sprinter" | "catcher" | "superfielder" | null;

export interface FielderPosition {
  name: string;
  x: number;
  y: number;
  label: string;
  category?: FielderCategory;
}

interface CricketFieldProps {
  fielders: FielderPosition[];
  isLoading?: boolean;
  batterHand?: string;
  wagonWheelBalls?: BallData[];
  boundaryDistances?: BoundaryDistances;
}

const CricketField = ({ 
  fielders, 
  isLoading, 
  batterHand = "right", 
  wagonWheelBalls = [],
  boundaryDistances
}: CricketFieldProps) => {
  const isLeftHand = batterHand === "left";
  const cx = 250;
  const cy = 250;
  const rx = 220;
  const ry = 200;

  // Swap off/leg distances for display if left-handed
  const displayOffDist = isLeftHand ? boundaryDistances?.leg : boundaryDistances?.off;
  const displayLegDist = isLeftHand ? boundaryDistances?.off : boundaryDistances?.leg;

  const toSvg = (pos: FielderPosition) => ({
    svgX: cx + pos.x * (rx - 20),
    svgY: cy + pos.y * (ry - 20),
  });

  // Wagon wheel: convert ball data to lines from batsman position
  const wagonLines = wagonWheelBalls
    .filter((b) => b.runs > 0 && b.shotDirection !== "unknown")
    .map((ball) => {
      let angleDeg = SHOT_DIRECTION_ANGLES[ball.shotDirection] || 180;
      // Flip for left-hander
      if (isLeftHand && ball.shotDirection !== "straight") {
        angleDeg = 360 - angleDeg;
      }
      const angleRad = (angleDeg * Math.PI) / 180;
      // Length based on runs
      const lengthFactor = ball.runs >= 6 ? 0.85 : ball.runs >= 4 ? 0.75 : ball.runs >= 2 ? 0.45 : 0.3;
      const endX = cx + Math.sin(angleRad) * (rx - 20) * lengthFactor;
      const endY = cy - Math.cos(angleRad) * (ry - 20) * lengthFactor;
      const color = ball.runs >= 6 ? "hsl(38 90% 55%)" : ball.runs >= 4 ? "hsl(148 55% 50%)" : "hsl(210 20% 60%)";
      return { startX: cx, startY: cy - 30, endX, endY, color, runs: ball.runs, id: ball.id };
    });

  return (
    <div className="relative w-full max-w-[500px] mx-auto field-shadow rounded-full">
      <svg viewBox="0 0 500 500" className="w-full h-auto">
        {/* Outer boundary */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="hsl(148 60% 28%)" stroke="hsl(148 50% 38%)" strokeWidth="2" />

        {/* 30-yard circle */}
        <ellipse cx={cx} cy={cy} rx={100} ry={90} fill="none" stroke="hsl(148 50% 38% / 0.5)" strokeWidth="1" strokeDasharray="6 4" />

        {/* Pitch */}
        <rect x={cx - 8} y={cy - 35} width={16} height={70} rx={2} fill="hsl(38 40% 55%)" opacity={0.8} />

        {/* Crease lines */}
        <line x1={cx - 14} y1={cy - 28} x2={cx + 14} y2={cy - 28} stroke="hsl(0 0% 100% / 0.6)" strokeWidth="1" />
        <line x1={cx - 14} y1={cy + 28} x2={cx + 14} y2={cy + 28} stroke="hsl(0 0% 100% / 0.6)" strokeWidth="1" />

        {/* Direction labels — BATSMAN at top, BOWLER at bottom */}
        <text x={20} y={cy + 4} textAnchor="middle" fill="hsl(210 20% 60%)" fontSize="9" fontFamily="Inter" transform={`rotate(-90, 20, ${cy})`}>
          {isLeftHand ? "LEG SIDE" : "OFF SIDE"} {displayOffDist ? `(${displayOffDist}m)` : ""}
        </text>
        <text x={480} y={cy + 4} textAnchor="middle" fill="hsl(210 20% 60%)" fontSize="9" fontFamily="Inter" transform={`rotate(90, 480, ${cy})`}>
          {isLeftHand ? "OFF SIDE" : "LEG SIDE"} {displayLegDist ? `(${displayLegDist}m)` : ""}
        </text>
        <text x={cx} y={22} textAnchor="middle" fill="hsl(210 20% 60%)" fontSize="9" fontFamily="Inter">
          BATSMAN'S END {boundaryDistances?.behind ? `(${boundaryDistances.behind}m)` : ""}
        </text>
        <text x={cx} y={490} textAnchor="middle" fill="hsl(210 20% 60%)" fontSize="9" fontFamily="Inter">
          BOWLER'S END {boundaryDistances?.straight ? `(${boundaryDistances.straight}m)` : ""}
        </text>

        {/* Wagon wheel lines */}
        {wagonLines.map((line) => (
          <motion.line
            key={line.id}
            x1={line.startX}
            y1={line.startY}
            x2={line.endX}
            y2={line.endY}
            stroke={line.color}
            strokeWidth={line.runs >= 4 ? 2 : 1}
            strokeOpacity={0.6}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5 }}
          />
        ))}

        {/* Fielders */}
        {fielders.map((fielder, i) => {
          const { svgX, svgY } = toSvg(fielder);
          const catColors: Record<string, { fill: string; stroke: string; glow: string }> = {
            "30yd-wall": { fill: "hsl(220 80% 55%)", stroke: "hsl(220 80% 65%)", glow: "hsl(220 80% 55%)" },
            sprinter: { fill: "hsl(150 70% 45%)", stroke: "hsl(150 70% 55%)", glow: "hsl(150 70% 45%)" },
            catcher: { fill: "hsl(350 80% 55%)", stroke: "hsl(350 80% 65%)", glow: "hsl(350 80% 55%)" },
            superfielder: { fill: "hsl(280 70% 55%)", stroke: "hsl(280 70% 65%)", glow: "hsl(280 70% 55%)" },
          };
          const colors = fielder.category ? catColors[fielder.category] : { fill: "hsl(38 90% 55%)", stroke: "hsl(38 90% 65%)", glow: "hsl(38 90% 55%)" };
          const radius = fielder.category ? 8 : 6;
          return (
            <motion.g
              key={fielder.name}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 300 }}
            >
              <circle cx={svgX} cy={svgY} r={radius + 4} fill={colors.glow} opacity={0.3} className="animate-pulse-glow" />
              {fielder.category && (
                <circle cx={svgX} cy={svgY} r={radius + 2} fill="none" stroke={colors.stroke} strokeWidth="1" strokeDasharray="3 2" opacity={0.6} />
              )}
              <circle cx={svgX} cy={svgY} r={radius} fill={colors.fill} stroke={colors.stroke} strokeWidth="1.5" />
              <text x={svgX} y={svgY - radius - 5} textAnchor="middle" fill="hsl(0 0% 100%)" fontSize="7" fontFamily="JetBrains Mono" fontWeight="500">
                {fielder.label}
              </text>
              {fielder.category && (
                <text x={svgX} y={svgY + radius + 10} textAnchor="middle" fill={colors.fill} fontSize="5.5" fontFamily="JetBrains Mono" fontWeight="600" opacity={0.9}>
                  {fielder.category === "30yd-wall" ? "WALL" : fielder.category === "superfielder" ? "SUPER" : fielder.category.toUpperCase()}
                </text>
              )}
            </motion.g>
          );
        })}

        {/* Loading state */}
        {isLoading && (
          <motion.text
            x={cx}
            y={cy}
            textAnchor="middle"
            fill="hsl(38 90% 55%)"
            fontSize="14"
            fontFamily="Inter"
            fontWeight="600"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            Analyzing...
          </motion.text>
        )}
      </svg>

      {/* Fielder Legend */}
      <div className="absolute -bottom-16 left-0 right-0 flex flex-wrap justify-center gap-x-4 gap-y-2 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[hsl(38,90%,55%)]" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[hsl(220,80%,55%)]" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">30yd Wall</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[hsl(150,70%,45%)]" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Sprinter</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[hsl(350,80%,55%)]" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Catcher</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[hsl(280,70%,55%)]" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Superfielder</span>
        </div>
      </div>
    </div>
  );
};

export default CricketField;
