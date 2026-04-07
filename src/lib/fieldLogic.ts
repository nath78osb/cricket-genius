import { FielderPosition } from "@/components/CricketField";
import { MatchSettings } from "@/components/SettingsPanel";

export interface BowlingTactics {
  plan: string;
  mainBall: string;
  variations: { ball: string; when: string }[];
  bluffs: { setup: string; execution: string }[];
}

export const STANDARD_POSITIONS = [
  { name: "Wicketkeeper", label: "WK", x: 0, y: -0.25, category: "catcher" },
  { name: "Bowler", label: "BW", x: 0, y: 0.25 },
  { name: "First Slip", label: "1S", x: -0.08, y: -0.25 },
  { name: "Second Slip", label: "2S", x: -0.14, y: -0.23 },
  { name: "Third Slip", label: "3S", x: -0.2, y: -0.21 },
  { name: "Fourth Slip", label: "4S", x: -0.26, y: -0.19 },
  { name: "Fly Slip", label: "FS", x: -0.2, y: -0.3 },
  { name: "Gully", label: "GU", x: -0.35, y: -0.15 },
  { name: "Point", label: "PT", x: -0.45, y: -0.15 },
  { name: "Backward Point", label: "BP", x: -0.42, y: -0.22 },
  { name: "Forward Point", label: "FP", x: -0.45, y: -0.05 },
  { name: "Cover Point", label: "CP", x: -0.45, y: 0.05 },
  { name: "Cover", label: "CV", x: -0.4, y: 0.15 },
  { name: "Extra Cover", label: "EC", x: -0.3, y: 0.28 },
  { name: "Mid-off", label: "MO", x: -0.15, y: 0.38 },
  { name: "Mid-on", label: "MN", x: 0.15, y: 0.38 },
  { name: "Mid-wicket", label: "MW", x: 0.4, y: 0.15 },
  { name: "Square Leg", label: "SL", x: 0.45, y: -0.15 },
  { name: "Backward Square Leg", label: "BS", x: 0.4, y: -0.25 },
  { name: "Forward Square Leg", label: "FSL", x: 0.45, y: -0.05 },
  { name: "Fine Leg", label: "FL", x: 0.25, y: -0.35 },
  { name: "Third Man", label: "3M", x: -0.25, y: -0.35 },
  { name: "Long Off", label: "LO", x: -0.3, y: 0.85 },
  { name: "Long On", label: "LN", x: 0.3, y: 0.85 },
  { name: "Deep Mid-wicket", label: "DW", x: 0.8, y: 0.3 },
  { name: "Deep Forward Mid-wicket", label: "DFM", x: 0.65, y: 0.6 },
  { name: "Deep Square Leg", label: "DS", x: 0.85, y: -0.15 },
  { name: "Deep Backward Square Leg", label: "DBS", x: 0.8, y: -0.4 },
  { name: "Long Leg", label: "LL", x: 0.6, y: -0.7 },
  { name: "Deep Fine Leg", label: "DF", x: 0.4, y: -0.8 },
  { name: "Deep Third Man", label: "DT", x: -0.5, y: -0.75 },
  { name: "Deep Backward Point", label: "DBP", x: -0.8, y: -0.4 },
  { name: "Deep Point", label: "DP", x: -0.85, y: -0.15 },
  { name: "Deep Cover Point", label: "DCP", x: -0.85, y: 0 },
  { name: "Deep Cover", label: "DC", x: -0.8, y: 0.3 },
  { name: "Deep Extra Cover", label: "DEC", x: -0.65, y: 0.6 },
  { name: "Straight Hit", label: "STH", x: 0, y: 0.9 },
  { name: "Long Stop", label: "LS", x: 0, y: -0.9 },
  { name: "Silly Point", label: "SP", x: -0.15, y: -0.15 },
  { name: "Short Leg", label: "SH", x: 0.15, y: -0.15 },
  { name: "Silly Mid-off", label: "SMO", x: -0.1, y: -0.05 },
  { name: "Silly Mid-on", label: "SMN", x: 0.1, y: -0.05 },
  { name: "Leg Slip", label: "LSL", x: 0.1, y: -0.25 },
  { name: "Leg Gully", label: "LG", x: 0.2, y: -0.2 },
];

export const getDefaultField = (): FielderPosition[] => [
  { name: "Wicketkeeper", label: "WK", x: 0, y: -0.25, category: "catcher" },
  { name: "Bowler", label: "BW", x: 0, y: 0.25 },
  { name: "First Slip", label: "1S", x: -0.08, y: -0.25, category: "catcher" },
  { name: "Point", label: "PT", x: -0.45, y: -0.15 },
  { name: "Cover", label: "CV", x: -0.4, y: 0.15, category: "30yd-wall" },
  { name: "Mid-off", label: "MO", x: -0.15, y: 0.38 },
  { name: "Mid-on", label: "MN", x: 0.15, y: 0.38 },
  { name: "Mid-wicket", label: "MW", x: 0.4, y: 0.15, category: "30yd-wall" },
  { name: "Square Leg", label: "SL", x: 0.45, y: -0.15 },
  { name: "Fine Leg", label: "FL", x: 0.25, y: -0.35, category: "sprinter" },
  { name: "Third Man", label: "3M", x: -0.25, y: -0.35 },
];

export const generateFieldPrompt = (settings: MatchSettings & { currentOver?: number; powerplayConfig?: any; format?: string }): string => {
  let powerplayInfo = "";
  if (settings.powerplayConfig && settings.currentOver !== undefined) {
    const over = settings.currentOver;
    const config = settings.powerplayConfig;
    let currentPP = "None";
    let maxOutfield = 9;

    if (over < config.p1.endOver) {
      currentPP = "P1";
      maxOutfield = config.p1.maxOutfield;
    } else if (over < config.p2.endOver) {
      currentPP = "P2";
      maxOutfield = config.p2.maxOutfield;
    } else if (over < config.p3.endOver) {
      currentPP = "P3";
      maxOutfield = config.p3.maxOutfield;
    }
    powerplayInfo = `\n- Current Powerplay: ${currentPP} (Max ${maxOutfield} fielders allowed in the outfield)`;
  }

  const matchFormat = settings.format || "Unknown";

  return `You are an expert, PROACTIVE cricket fielding coach and bowling strategist. Your goal is to take wickets, create pressure, and dictate play. Based on these match conditions, suggest the optimal field placement AND bowling tactics.

Match Conditions:
- Format: ${matchFormat.toUpperCase()} (This is critical. Test/Timed matches require highly attacking, wicket-taking fields with catchers. T20/ODI require balancing attack with boundary protection.)
- Batter: ${settings.batterHand}-handed, ${settings.batterType} style
- Bowler: ${settings.bowlerArm}-arm ${settings.bowlerType} (${settings.bowlerPace})
- Pitch: ${settings.pitchCondition}
- Boundary dimensions: Leg side ${settings.boundaryLeg}m, Off side ${settings.boundaryOff}m, Straight ${settings.boundaryStraight}m, Behind ${settings.boundaryBack}m
- Match situation: ${settings.matchSituation}${powerplayInfo}
- Overs Remaining: ${settings.oversRemaining}${settings.favouriteShots ? `\n- Batter's favourite shots: ${settings.favouriteShots}` : ""}${settings.worstShots ? `\n- Batter's weakest shots: ${settings.worstShots}` : ""}

TACTICAL MINDSET & THE SACRED NINE SPOTS:
- Be PROACTIVE, not reactive. Set fields that anticipate the batter's mistakes, create pressure, and force errors.
- FORMAT DICTATES FIELD: In Test/Timed matches, prioritize slips, short legs, and close catchers heavily. Do not worry about saving singles. In limited overs, use catchers early or when attacking, but protect the boundaries when defensive.
- GREEDY OPTIMIZATION: You have 9 fielders. Maximize "runs saved". Consider a 30-degree coverage angle per fielder. Ensure a minimum 30-degree gap between fielders to avoid overlap.
- RUNS CLASSES: Divide runs into "Running Class" (1s, 2s, 3s, grounded 4s - saved by infielders) and "Boundary Class" (aerial 4s, 6s - saved by outfielders).
- SPECIAL FIELDERS:
  1. "30-Yard Wall": Place your best infielder to save maximum Running Class runs.
  2. "The Catcher": Place your safest hands on the boundary to save Boundary Class runs.
  3. "The Sprinter": Place a fast outfielder in areas with high Running Class runs to stop 2s and 3s.
  4. "Superfielder": If a zone has high Boundary AND Running Class runs, place an elite fielder there.
- Dictate the game. Don't just put fielders where the ball went last time; put them where you want the batter to hit it next based on the bowling plan.

COORDINATE SYSTEM (IMPORTANT):
- x-axis: NEGATIVE = OFF SIDE (left on screen), POSITIVE = LEG SIDE (right on screen) for a right-handed batsman. FLIP for left-hander.
- y-axis: NEGATIVE = BEHIND the batsman (keeper end, top of screen), POSITIVE = IN FRONT (bowler end, bottom of screen)
- So for a right-hander: slips/gully are at negative x and negative y, cover/mid-off at negative x and positive y, mid-on/mid-wicket at positive x and positive y, fine leg at positive x and negative y.

Standard Fielding Positions (Reference for RHB):
${JSON.stringify(STANDARD_POSITIONS, null, 2)}

SPECIAL FIELDER CATEGORIES:
Most fielders should have category: null. Only assign a category when the position genuinely demands that specialist skill:
- "30yd-wall": ONLY for an infielder (e.g. short cover, short mid-wicket) positioned specifically to stop grounded drives/pushes. NOT for slips, keeper, or deep fielders.
- "sprinter": ONLY for a boundary rider or sweeper covering a large zone where the batter likes to rotate strike (e.g. deep square leg, deep point). NOT for close catchers or infielders.
- "catcher": ONLY for a close catching position (e.g. slip, gully, short leg, silly point) where edges or top-edges are expected. NOT for outfielders.
- "superfielder": ONLY if a single position genuinely requires both catching and ground-fielding athleticism (very rare — e.g. a backward point saving runs AND taking catches).
Assign at most 2-3 categories total. The bowler, keeper, mid-off, mid-on, and most standard positions should be null.

IMPORTANT: 
1. Use the Standard Fielding Positions as a guide for names, labels, and coordinates.
2. For a Left-Handed Batter, you MUST flip the X-coordinates (multiply by -1) and adjust labels accordingly (e.g., Slips move to the other side).
3. Ensure the field placement complies with the current powerplay restrictions (outfield is defined as distance from center sqrt(x^2 + y^2) > 0.4).

Return a JSON object with two keys:
1. "fielders": array of exactly 11 objects, each with:
   - "name": fielding position name (e.g. "Slip", "Mid-off", "Fine Leg")
   - "label": short 2-4 char abbreviation (e.g. "SL", "MO", "FL")
   - "x": number from -0.85 to 0.85 (negative = off side, positive = leg side for right-hander; REVERSED for left-hander)
   - "y": number from -0.85 to 0.85 (negative = behind batsman, positive = in front)
   - "category": one of "30yd-wall", "sprinter", "catcher", "superfielder", or null if no special role
   - "reason": one sentence explaining placement

2. "tactics": object with:
   - "mainBall": the primary delivery to bowl (e.g. "Back of a length outside off stump")
   - "variations": array of 3-5 variation deliveries with "ball" (description) and "when" (when to use it)
   - "bluffs": array of 2-3 bluff/double-bluff tactics with "setup" (what you show) and "execution" (what you actually do)
   - "plan": 2-3 sentence overall bowling plan summary

The wicketkeeper should be near (0, -0.25) and bowler near (0, 0.25). Place fielders realistically.

Return ONLY the JSON object, no other text.`;
};

export function parseFieldResponse(text: string): { fielders: FielderPosition[]; tactics: BowlingTactics | null } {
  try {
    // Try to parse as full JSON object with fielders + tactics
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.fielders && Array.isArray(parsed.fielders)) {
        const validCategories = ["30yd-wall", "sprinter", "catcher", "superfielder"];
        const fielders = parsed.fielders.map((f: any) => ({
          name: f.name || "Unknown",
          label: f.label || "?",
          x: Math.max(-0.85, Math.min(0.85, Number(f.x) || 0)),
          y: Math.max(-0.85, Math.min(0.85, Number(f.y) || 0)),
          category: (f.category && validCategories.includes(f.category) ? f.category : null),
        }));
        const tactics: BowlingTactics | null = parsed.tactics ? {
          mainBall: parsed.tactics.mainBall || "",
          variations: Array.isArray(parsed.tactics.variations) ? parsed.tactics.variations : [],
          bluffs: Array.isArray(parsed.tactics.bluffs) ? parsed.tactics.bluffs : [],
          plan: parsed.tactics.plan || "",
        } : null;
        return { fielders, tactics };
      }
    }

    // Fallback: try array-only format
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      return {
        fielders: parsed.map((f: any) => ({
          name: f.name || "Unknown",
          label: f.label || "?",
          x: Math.max(-0.85, Math.min(0.85, Number(f.x) || 0)),
          y: Math.max(-0.85, Math.min(0.85, Number(f.y) || 0)),
          category: null,
        })),
        tactics: null,
      };
    }

    return { fielders: getDefaultField(), tactics: null };
  } catch (err) {
    console.error("Error parsing field response:", err);
    return { fielders: getDefaultField(), tactics: null };
  }
}
