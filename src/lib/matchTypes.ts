export type Format = "t20" | "40-over" | "45-over" | "odi" | "test";
export type BatterType = "aggressive" | "defensive" | "balanced" | "tailender" | "new-to-crease" | "unknown";
export type ShotType = "drive" | "cut" | "pull" | "hook" | "sweep" | "reverse-sweep" | "flick" | "glance" | "edge" | "defence" | "slog" | "loft" | "unknown";
export type ShotDirection = "cover" | "mid-off" | "straight" | "mid-on" | "mid-wicket" | "square-leg" | "fine-leg" | "third-man" | "point" | "backward-point" | "gully" | "unknown";
export type BallType = "short" | "good-length" | "full" | "yorker" | "wide" | "bouncer" | "unknown";
export type BallResult = "normal" | "wide" | "no-ball" | "byes" | "leg-byes" | "wicket";

export interface BallData {
  id: string;
  over: number;
  ballInOver: number;
  result: BallResult;
  runs: number;
  batRuns: number; // runs scored by the bat (for wagon wheel)
  extraRuns: number; // extras on this delivery
  shotType: ShotType;
  shotDirection: ShotDirection;
  ballType: BallType;
  isWicket: boolean;
  timestamp: number;
  batterName: string;
  bowlerName: string;
  innings: number;
}

export interface BatterStats {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  hand: "right" | "left";
  type: BatterType;
  dismissal?: string;
}

export interface BowlerStats {
  name: string;
  overs: number;
  balls: number;
  runs: number;
  wickets: number;
  extras: number;
  arm: "right" | "left";
  type: "fast" | "medium" | "spin";
}

export interface InningsScore {
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: number;
  target: number | null; // chase target (1st innings score + 1)
}

export interface BoundaryDistances {
  off: number;
  leg: number;
  straight: number;
  behind: number;
}

export interface PowerplayConfig {
  p1: { endOver: number; maxOutfield: number };
  p2: { endOver: number; maxOutfield: number };
  p3: { endOver: number; maxOutfield: number };
}

export interface MatchState {
  format: Format;
  pitchCondition: "green" | "dusty" | "flat" | "damp";
  boundaryDistances: BoundaryDistances;
  powerplayConfig: PowerplayConfig;
  currentInnings: number;
  totalInnings: number;
  innings: InningsScore[];
  ballHistory: BallData[];
  isNewBatter: boolean;
  ballsSinceNewBatter: number;
  isMatchStarted: boolean;
  isMatchComplete: boolean;
  batters: BatterStats[];
  bowlers: BowlerStats[];
  currentBatterIndex: number;
  currentBowlerIndex: number;
  nonStrikerIndex: number;
}

export interface AISuggestion {
  message: string;
  type: "field-change" | "bowling" | "pressure" | "info";
  priority: "high" | "medium" | "low";
}

export const SHOT_DIRECTION_ANGLES: Record<ShotDirection, number> = {
  "third-man": 310,
  "gully": 290,
  "backward-point": 270,
  "point": 250,
  "cover": 230,
  "mid-off": 210,
  "straight": 180,
  "mid-on": 150,
  "mid-wicket": 130,
  "square-leg": 110,
  "fine-leg": 70,
  "unknown": 180,
};

export function createInitialInnings(target: number | null = null): InningsScore {
  return { runs: 0, wickets: 0, overs: 0, balls: 0, extras: 0, target };
}

export function getMaxInnings(format: Format): number {
  return format === "test" ? 4 : 2;
}

export function getMaxOvers(format: Format): number | null {
  if (format === "t20") return 20;
  if (format === "40-over") return 40;
  if (format === "45-over") return 45;
  if (format === "odi") return 50;
  return null;
}

export function isLegalDelivery(result: BallResult): boolean {
  return result !== "wide" && result !== "no-ball";
}
