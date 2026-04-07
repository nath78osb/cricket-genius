import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import CricketField from "@/components/CricketField";
import type { FielderPosition } from "@/components/CricketField";
import SettingsPanel from "@/components/SettingsPanel";
import type { MatchSettings } from "@/components/SettingsPanel";
import MatchSetup from "@/components/MatchSetup";
import BallInput from "@/components/BallInput";
import ScoreBoard from "@/components/ScoreBoard";
import LiveSuggestions from "@/components/LiveSuggestions";
import WagonWheel from "@/components/WagonWheel";
import ImportScore from "@/components/ImportScore";
import ConditionsAnalyzer, { CRICKET_GROUNDS, calculateHeuristicCCHI } from "@/components/ConditionsAnalyzer";
import TiddlesScorer from "@/components/TiddlesScorer";
import FieldVisualization from "@/components/FieldVisualization";
import { getDefaultField, generateFieldPrompt, parseFieldResponse, BowlingTactics } from "@/lib/fieldLogic";
import {
  MatchState, AISuggestion, BallData, BallResult, ShotType, ShotDirection, BallType,
  BatterStats, BowlerStats, InningsScore,
  createInitialInnings, getMaxInnings, getMaxOvers, isLegalDelivery,
} from "@/lib/matchTypes";
import { suggestField, liveAnalysis } from "@/lib/gemini";
import { fetchBulkCurrentWeather } from "@/lib/weatherApi";
import { toast } from "sonner";

const defaultSettings: MatchSettings = {
  batterHand: "right",
  batterType: "aggressive",
  bowlerType: "fast",
  bowlerArm: "right",
  bowlerPace: "fast",
  pitchCondition: "green",
  groundSize: 70,
  boundaryLeg: 65,
  boundaryOff: 70,
  boundaryStraight: 75,
  boundaryBack: 60,
  matchSituation: "attacking",
  oversRemaining: "test",
  favouriteShots: "",
  worstShots: "",
};

type AppMode = "manual" | "live";
type AppTab = "field" | "conditions" | "tiddles" | "visualization";

const Index = () => {
  const [activeTab, setActiveTab] = useState<AppTab>("field");
  const [mode, setMode] = useState<AppMode>("live");

  // Manual mode state
  const [settings, setSettings] = useState<MatchSettings>(defaultSettings);
  const [fielders, setFielders] = useState<FielderPosition[]>(getDefaultField());
  const [isLoading, setIsLoading] = useState(false);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [tactics, setTactics] = useState<BowlingTactics | null>(null);

  // Live mode state
  const [match, setMatch] = useState<MatchState | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [pendingFielders, setPendingFielders] = useState<FielderPosition[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Conditions Analyzer persistent state
  const [groundScores, setGroundScores] = useState<Record<string, number>>({});
  const [favouriteScores, setFavouriteScores] = useState<Record<string, number>>({});
  const [favourites, setFavourites] = useState<{name: string, lat: number, lng: number}[]>(() => {
    const saved = localStorage.getItem('cchi-favourites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cchi-favourites', JSON.stringify(favourites));
  }, [favourites]);

  // Fetch initial scores for Conditions Analyzer
  useEffect(() => {
    const fetchScores = async () => {
      try {
        const results = await fetchBulkCurrentWeather(CRICKET_GROUNDS);
        if (results.length > 0) {
          const scores: Record<string, number> = {};
          results.forEach((res: any, i: number) => {
            scores[CRICKET_GROUNDS[i].name] = calculateHeuristicCCHI(res);
          });
          setGroundScores(scores);
        }
      } catch (err) {
        console.error("Failed to fetch ground scores", err);
      }
    };

    if (Object.keys(groundScores).length === 0) {
      fetchScores();
    }
    const interval = setInterval(fetchScores, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchFavScores = async () => {
      if (favourites.length === 0) return;
      try {
        const results = await fetchBulkCurrentWeather(favourites);
        if (results.length > 0) {
          const scores: Record<string, number> = {};
          results.forEach((res: any, i: number) => {
            scores[favourites[i].name] = calculateHeuristicCCHI(res);
          });
          setFavouriteScores(scores);
        }
      } catch (err) {
        console.error("Failed to fetch favourite scores", err);
      }
    };
    
    const hasAllScores = favourites.length > 0 && favourites.every(f => favouriteScores[f.name] !== undefined);
    if (!hasAllScores) {
      fetchFavScores();
    }
    
    const interval = setInterval(fetchFavScores, 300000);
    return () => clearInterval(interval);
  }, [favourites]);

  // ── Manual mode handler ──
  const handleGenerate = async () => {
    setIsLoading(true);
    setReasoning(null);
    setTactics(null);
    try {
      const currentOver = match?.innings[match.currentInnings - 1]?.overs || 0;
      const prompt = generateFieldPrompt({
        ...settings,
        currentOver,
        powerplayConfig: match?.powerplayConfig,
        format: match?.format
      });
      const result = await suggestField(prompt);
      const { fielders: positions, tactics: bowlingTactics } = parseFieldResponse(result);
      setFielders(positions);
      setTactics(bowlingTactics);
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.fielders) {
            const reasons = parsed.fielders.filter((f: any) => f.reason).map((f: any) => `${f.name}: ${f.reason}`).join("\n");
            if (reasons) setReasoning(reasons);
          }
        }
      } catch { /* ignore */ }
      toast.success("Field placement generated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate field.");
      setFielders(getDefaultField());
    } finally { setIsLoading(false); }
  };

  // ── Live mode handlers ──
  const handleStartMatch = async (data: any) => {
    const totalInnings = getMaxInnings(data.format);
    const initialBatters: BatterStats[] = data.squad && data.squad.length >= 2 
      ? data.squad.map((name: string) => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, hand: "right", type: "balanced" }))
      : [
          { name: "Batter 1", runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, hand: "right", type: "balanced" },
          { name: "Batter 2", runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, hand: "right", type: "balanced" },
        ];

    const initialBowlers: BowlerStats[] = [
      { name: "Bowler 1", overs: 0, balls: 0, runs: 0, wickets: 0, extras: 0, arm: "right", type: "fast" },
    ];

    const newMatchState: MatchState = {
      format: data.format,
      pitchCondition: data.pitchCondition,
      boundaryDistances: data.boundaryDistances,
      powerplayConfig: data.powerplayConfig,
      currentInnings: 1,
      totalInnings,
      innings: [createInitialInnings()],
      ballHistory: [],
      isNewBatter: true,
      ballsSinceNewBatter: 0,
      isMatchStarted: true,
      isMatchComplete: false,
      batters: initialBatters,
      bowlers: initialBowlers,
      currentBatterIndex: 0,
      nonStrikerIndex: 1,
      currentBowlerIndex: 0,
    };

    setMatch(newMatchState);
    setSuggestions([]);
    setPendingFielders(null);
    setShowImport(false);

    // Auto-generate initial field
    await autoGenerateField(newMatchState);
  };

  const handleImportScore = (data: {
    innings: InningsScore;
    batters: BatterStats[];
    bowlers: BowlerStats[];
    previousInnings: InningsScore[];
  }) => {
    if (!match) return;
    
    // Keep previous innings if we're in a multi-innings match
    const previousInnings = match.innings.slice(0, match.currentInnings - 1);
    const inningsArr = [...previousInnings, data.innings];
    
    // We prepend the "Imported Score" entries to the existing lists
    // This keeps them in the scorecard but we need to adjust indices for the active players
    const newBatters = [...data.batters, ...match.batters];
    const newBowlers = [...data.bowlers, ...match.bowlers];
    
    setMatch({
      ...match,
      innings: inningsArr,
      batters: newBatters,
      bowlers: newBowlers,
      currentBatterIndex: match.currentBatterIndex + data.batters.length,
      nonStrikerIndex: match.nonStrikerIndex + data.batters.length,
      currentBowlerIndex: match.currentBowlerIndex + data.bowlers.length,
    });
    setShowImport(false);
    toast.success("Score imported!");
  };

  const handleBallRecorded = useCallback((result: BallResult, shotType: ShotType, shotDirection: ShotDirection, ballType: BallType, additionalRuns: number) => {
    if (!match || match.isMatchComplete) return;

    const currentInn = match.innings[match.currentInnings - 1];
    const legal = isLegalDelivery(result);
    const isWicket = result === "wicket";

    // Calculate bat runs and extra runs
    let batRuns = 0;
    let extraRuns = 0;

    if (result === "wide") {
      extraRuns = 1 + additionalRuns;
      batRuns = 0;
    } else if (result === "no-ball") {
      extraRuns = 1;
      batRuns = additionalRuns;
    } else if (result === "byes" || result === "leg-byes") {
      extraRuns = additionalRuns;
      batRuns = 0;
    } else if (result === "wicket") {
      batRuns = 0;
      extraRuns = 0;
    } else {
      // Normal delivery
      batRuns = additionalRuns;
      extraRuns = 0;
    }

    const totalRuns = batRuns + extraRuns;
    const striker = match.batters[match.currentBatterIndex];
    const bowler = match.bowlers[match.currentBowlerIndex];

    const newBall: BallData = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      over: currentInn.overs,
      ballInOver: currentInn.balls,
      result,
      runs: totalRuns,
      batRuns,
      extraRuns,
      shotType,
      shotDirection,
      ballType,
      isWicket,
      timestamp: Date.now(),
      batterName: striker?.name || "Unknown",
      bowlerName: bowler?.name || "Unknown",
      innings: match.currentInnings,
    };

    const newBalls = currentInn.balls + (legal ? 1 : 0);
    const newOvers = newBalls >= 6 ? currentInn.overs + 1 : currentInn.overs;
    const ballsAfter = newBalls >= 6 ? 0 : newBalls;

    const updatedInnings: InningsScore = {
      ...currentInn,
      runs: currentInn.runs + totalRuns,
      wickets: currentInn.wickets + (isWicket ? 1 : 0),
      overs: newOvers,
      balls: ballsAfter,
      extras: currentInn.extras + extraRuns,
    };

    // Update batter stats
    const updatedBatters = [...match.batters];
    if (striker) {
      const si = match.currentBatterIndex;
      updatedBatters[si] = {
        ...striker,
        runs: striker.runs + batRuns,
        balls: striker.balls + (legal ? 1 : 0),
        fours: striker.fours + (batRuns === 4 ? 1 : 0),
        sixes: striker.sixes + (batRuns === 6 ? 1 : 0),
        isOut: isWicket,
        dismissal: isWicket ? `b ${bowler?.name || "Unknown"}` : striker.dismissal,
      };
    }

    // Update bowler stats
    const updatedBowlers = [...match.bowlers];
    if (bowler) {
      const bi = match.currentBowlerIndex;
      const bowlerBalls = bowler.balls + (legal ? 1 : 0);
      const bowlerOvers = bowlerBalls >= 6 ? bowler.overs + 1 : bowler.overs;
      const bowlerBallsAfter = bowlerBalls >= 6 ? 0 : bowlerBalls;
      updatedBowlers[bi] = {
        ...bowler,
        overs: bowlerOvers,
        balls: bowlerBallsAfter,
        runs: bowler.runs + totalRuns,
        wickets: bowler.wickets + (isWicket ? 1 : 0),
        extras: bowler.extras + extraRuns,
      };
    }

    const newInningsArr = [...match.innings];
    newInningsArr[match.currentInnings - 1] = updatedInnings;

    // Rotate strike on odd runs or end of over
    let newStrikerIdx = match.currentBatterIndex;
    let newNonStrikerIdx = match.nonStrikerIndex;
    const physicalRuns = additionalRuns;
    const oddRuns = physicalRuns % 2 === 1;
    if (oddRuns && !isWicket) {
      [newStrikerIdx, newNonStrikerIdx] = [newNonStrikerIdx, newStrikerIdx];
    }
    // End of over: swap
    if (ballsAfter === 0 && legal) {
      [newStrikerIdx, newNonStrikerIdx] = [newNonStrikerIdx, newStrikerIdx];
    }

    // New batter on wicket
    if (isWicket) {
      const currentWickets = updatedInnings.wickets;
      const nextBatterIdx = updatedBatters.findIndex((b, idx) => 
        idx !== match.currentBatterIndex && 
        idx !== match.nonStrikerIndex && 
        !b.isOut && 
        b.balls === 0 && 
        b.runs === 0
      );

      if (nextBatterIdx !== -1) {
        newStrikerIdx = nextBatterIdx;
      } else {
        // If no more batters in squad, push a new one (emergency fallback)
        const newIdx = updatedBatters.length;
        updatedBatters.push({ name: `Batter ${newIdx + 1}`, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, hand: "right", type: "balanced" });
        newStrikerIdx = newIdx;
      }
    }

    // Check if chase target reached
    let isComplete = match.isMatchComplete;
    if (updatedInnings.target && updatedInnings.runs >= updatedInnings.target) {
      isComplete = true;
      toast.success("🏏 Target reached! Match won!");
    }

    // Check if all out (10 wickets)
    if (updatedInnings.wickets >= 10) {
      isComplete = true;
      toast.info("All out!");
    }

    // Check max overs
    const maxOvers = getMaxOvers(match.format);
    if (maxOvers && updatedInnings.overs >= maxOvers && ballsAfter === 0) {
      isComplete = true;
      toast.info("Innings complete - overs exhausted");
    }

    const updated: MatchState = {
      ...match,
      innings: newInningsArr,
      ballHistory: [...match.ballHistory, newBall],
      isNewBatter: isWicket,
      ballsSinceNewBatter: isWicket ? 0 : match.ballsSinceNewBatter + 1,
      batters: updatedBatters,
      bowlers: updatedBowlers,
      currentBatterIndex: newStrikerIdx,
      nonStrikerIndex: newNonStrikerIdx,
      isMatchComplete: isComplete,
    };
    setMatch(updated);

    // AI analysis trigger
    const totalBallsCount = updated.ballHistory.length;
    if (!isComplete && totalBallsCount >= 2 && (totalBallsCount % 3 === 0 || isWicket || batRuns >= 4)) {
      runLiveAnalysis(updated);
    }
  }, [match]);

  const runLiveAnalysis = async (currentMatch: MatchState) => {
    setIsAnalyzing(true);
    try {
      const currentInnings = currentMatch.innings[currentMatch.currentInnings - 1];
      const recentBalls = currentMatch.ballHistory.slice(-12);
      const striker = currentMatch.batters[currentMatch.currentBatterIndex];
      const currentBowler = currentMatch.bowlers[currentMatch.currentBowlerIndex];
      const isLeftHanded = striker?.hand === "left";
      
      // Swap off/leg if left-handed (assuming settings define them for RHB)
      const offBoundary = isLeftHanded ? currentMatch.boundaryDistances.leg : currentMatch.boundaryDistances.off;
      const legBoundary = isLeftHanded ? currentMatch.boundaryDistances.off : currentMatch.boundaryDistances.leg;

      const matchContext = {
        format: currentMatch.format,
        batterHand: striker?.hand || "right",
        batterType: currentMatch.isNewBatter ? "new-to-crease" : (striker?.type || "balanced"),
        bowlerType: currentBowler?.type || "fast",
        bowlerArm: currentBowler?.arm || "right",
        pitchCondition: currentMatch.pitchCondition,
        runs: currentInnings.runs,
        wickets: currentInnings.wickets,
        overs: currentInnings.overs,
        balls: currentInnings.balls,
        isNewBatter: currentMatch.isNewBatter,
        ballsSinceNewBatter: currentMatch.ballsSinceNewBatter,
        boundaryOff: offBoundary,
        boundaryLeg: legBoundary,
        boundaryStraight: currentMatch.boundaryDistances.straight,
        boundaryBack: currentMatch.boundaryDistances.behind,
        powerplayConfig: currentMatch.powerplayConfig,
      };

      const result = await liveAnalysis(matchContext, recentBalls);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.suggestions) setSuggestions(parsed.suggestions);
        if (parsed.fielders && Array.isArray(parsed.fielders)) {
          const validCategories = ["30yd-wall", "sprinter", "catcher", "superfielder"];
          const newFielders = parsed.fielders.map((f: any) => ({
            name: f.name || "Unknown",
            label: f.label || "?",
            x: Math.max(-0.85, Math.min(0.85, Number(f.x) || 0)),
            y: Math.max(-0.85, Math.min(0.85, Number(f.y) || 0)),
            category: (f.category && validCategories.includes(f.category) ? f.category : null),
          }));
          setPendingFielders(newFielders);
        }
      }
    } catch (err) {
      console.error(err);
    } finally { setIsAnalyzing(false); }
  };

  const handleApplyField = () => {
    if (pendingFielders) {
      setFielders(pendingFielders);
      setPendingFielders(null);
      toast.success("Field updated!");
    }
  };

  const handleDeclare = () => {
    if (!match) return;
    toast.info("Innings Declared!");
    handleNewInnings();
  };

  const handleNewInnings = () => {
    if (!match) return;
    if (match.currentInnings >= match.totalInnings) {
      setMatch({ ...match, isMatchComplete: true });
      toast.info("Match complete!");
      return;
    }

    let target: number | null = null;
    if (match.totalInnings === 2) {
      // Standard 2-innings match
      const prevInningsScore = match.innings[match.currentInnings - 1];
      target = prevInningsScore.runs + 1;
    } else if (match.totalInnings === 4 && match.currentInnings === 3) {
      // 4th innings of a Test/Timed match
      const inn1 = match.innings[0].runs;
      const inn2 = match.innings[1].runs;
      const inn3 = match.innings[2].runs;
      // If Team A batted 1st and 3rd, Team B batted 2nd and now 4th
      target = (inn1 + inn3) - inn2 + 1;
    }

    setMatch({
      ...match,
      currentInnings: match.currentInnings + 1,
      innings: [...match.innings, createInitialInnings(target)],
      isNewBatter: true,
      ballsSinceNewBatter: 0,
      boundaryDistances: match.boundaryDistances,
      batters: [
        { name: "Batter 1", runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, hand: "right", type: "balanced" },
        { name: "Batter 2", runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, hand: "right", type: "balanced" },
      ],
      bowlers: [
        { name: "Bowler 1", overs: 0, balls: 0, runs: 0, wickets: 0, extras: 0, arm: "right", type: "fast" },
      ],
      currentBatterIndex: 0,
      nonStrikerIndex: 1,
      currentBowlerIndex: 0,
    });
    setSuggestions([]);
    setPendingFielders(null);
    setFielders(getDefaultField());
  };

  const handleEndMatch = () => {
    setMatch(null);
    setSuggestions([]);
    setPendingFielders(null);
    setFielders(getDefaultField());
    setShowImport(false);
  };

  const handleChangeBowler = async () => {
    if (!match) return;
    const nextIdx = match.bowlers.length;
    const updated = {
      ...match,
      bowlers: [...match.bowlers, { name: `Bowler ${nextIdx + 1}`, overs: 0, balls: 0, runs: 0, wickets: 0, extras: 0, arm: "right", type: "fast" as const }],
      currentBowlerIndex: nextIdx,
    };
    setMatch(updated);
    toast.info(`New bowler: Bowler ${nextIdx + 1}`);
    await autoGenerateField(updated);
  };

  const updateBatter = async (index: number, updates: Partial<BatterStats>) => {
    if (!match) return;
    const updatedBatters = [...match.batters];
    updatedBatters[index] = {
      ...updatedBatters[index],
      ...updates
    };
    const updatedMatch = { ...match, batters: updatedBatters };
    setMatch(updatedMatch);

    // If the current batter was updated (e.g. hand or type changed), regenerate field
    if (index === match.currentBatterIndex && (updates.hand || updates.type)) {
      await autoGenerateField(updatedMatch);
    }
  };

  const updateBowler = async (index: number, updates: Partial<BowlerStats>) => {
    if (!match) return;
    const updatedBowlers = [...match.bowlers];
    updatedBowlers[index] = {
      ...updatedBowlers[index],
      ...updates
    };
    const updatedMatch = { ...match, bowlers: updatedBowlers };
    setMatch(updatedMatch);

    // If the current bowler was updated (e.g. arm or type changed), regenerate field
    if (index === match.currentBowlerIndex && (updates.arm || updates.type)) {
      await autoGenerateField(updatedMatch);
    }
  };

  const autoGenerateField = async (currentMatchState: MatchState) => {
    setIsLoading(true);
    setReasoning(null);
    setTactics(null);

    const currentBatter = currentMatchState.batters[currentMatchState.currentBatterIndex];
    const currentBowler = currentMatchState.bowlers[currentMatchState.currentBowlerIndex];
    const currentOver = currentMatchState.innings[currentMatchState.currentInnings - 1]?.overs || 0;

    const prompt = generateFieldPrompt({
      batterHand: currentBatter.hand,
      batterType: currentBatter.type,
      bowlerType: currentBowler.type,
      bowlerArm: currentBowler.arm,
      bowlerPace: currentBowler.type === "spin" ? "slow" : "fast",
      pitchCondition: currentMatchState.pitchCondition,
      groundSize: 70,
      boundaryLeg: currentMatchState.boundaryDistances.leg,
      boundaryOff: currentMatchState.boundaryDistances.off,
      boundaryStraight: currentMatchState.boundaryDistances.straight,
      boundaryBack: currentMatchState.boundaryDistances.behind,
      matchSituation: "balanced",
      oversRemaining: currentMatchState.format === "test" ? "Unlimited" : (getMaxOvers(currentMatchState.format) + " overs"),
      favouriteShots: "",
      worstShots: "",
      currentOver,
      powerplayConfig: currentMatchState.powerplayConfig,
      format: currentMatchState.format
    });

    try {
      const result = await suggestField(prompt);
      const { fielders: positions, tactics: bowlingTactics } = parseFieldResponse(result);
      setFielders(positions);
      setTactics(bowlingTactics);
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.fielders) {
            const reasons = parsed.fielders.filter((f: any) => f.reason).map((f: any) => `${f.name}: ${f.reason}`).join("\n");
            setReasoning(reasons || null);
          }
        }
      } catch (e) {}
    } catch (error) {
      console.error("Failed to auto-generate field:", error);
      toast.error("Failed to auto-generate field.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen tactical-grid">
      <div className="container py-4 px-3">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
            <span className="text-accent">CRICKET</span>
            <span className="text-foreground">GENIUS</span>
          </h1>
          <p className="text-muted-foreground text-xs font-mono mt-0.5">AI-Powered Cricket Field Placement, Analysis & Conditions Forecasting</p>
        </motion.div>

        {/* Main Tabs */}
        <div className="flex justify-center gap-2 mb-6 border-b border-border/50 pb-4 flex-wrap">
          <button
            onClick={() => setActiveTab("field")}
            className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === "field" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Field Placement
          </button>
          <button
            onClick={() => setActiveTab("conditions")}
            className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === "conditions" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Conditions Analyzer
          </button>
          <button
            onClick={() => setActiveTab("tiddles")}
            className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === "tiddles" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Tiddles
          </button>
          <button
            onClick={() => setActiveTab("visualization")}
            className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === "visualization" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Field Visualization
          </button>
        </div>

        {activeTab === "visualization" ? (
          <FieldVisualization />
        ) : activeTab === "tiddles" ? (
          <TiddlesScorer />
        ) : activeTab === "conditions" ? (
          <ConditionsAnalyzer 
            groundScores={groundScores} 
            setGroundScores={setGroundScores}
            favouriteScores={favouriteScores}
            setFavouriteScores={setFavouriteScores}
            favourites={favourites}
            setFavourites={setFavourites}
          />
        ) : (
          <>
            {/* Mode toggle */}
            <div className="flex justify-center gap-1 mb-4">
              {(["manual", "live"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all ${
                    mode === m ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "manual" ? "Manual Setup" : "Live Match"}
                </button>
              ))}
            </div>

            {/* ═══════ LIVE MODE ═══════ */}
            {mode === "live" && (
          <div className="space-y-4">
            {!match ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto bg-card/80 backdrop-blur border border-border rounded-xl p-5">
                <MatchSetup onStart={handleStartMatch} />
              </motion.div>
            ) : (
              <>
                <ScoreBoard 
                  match={match} 
                  onUpdateBatter={updateBatter}
                  onUpdateBowler={updateBowler}
                />

                <button 
                  onClick={() => autoGenerateField(match)}
                  disabled={isLoading}
                  className="w-full bg-accent text-accent-foreground py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Generating Field...</span>
                  ) : (
                    <>🎯 Generate Optimal Field</>
                  )}
                </button>

                {/* Import score toggle */}
                {!showImport && (
                  <button onClick={() => setShowImport(true)} className="w-full text-[10px] font-mono text-primary hover:text-primary/80 uppercase tracking-wider text-center py-1">
                    📥 Import Current Score
                  </button>
                )}

                {showImport && (
                  <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-4">
                    <ImportScore onImport={handleImportScore} />
                    <button onClick={() => setShowImport(false)} className="w-full mt-2 text-[10px] font-mono text-muted-foreground hover:text-foreground uppercase tracking-wider text-center">
                      Cancel
                    </button>
                  </div>
                )}

                <CricketField
                  fielders={fielders}
                  isLoading={isAnalyzing}
                  batterHand={match.batters[match.currentBatterIndex]?.hand || "right"}
                  boundaryDistances={match.boundaryDistances}
                />

                {/* Wagon Wheel (separate from field) */}
                <WagonWheel
                  ballHistory={match.ballHistory}
                  batters={match.batters}
                  batterHand={match.batters[match.currentBatterIndex]?.hand || "right"}
                  currentInnings={match.currentInnings}
                />

                {/* Ball input */}
                {!match.isMatchComplete && (
                  <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Ball Input</span>
                      <div className="flex gap-2">
                        <button onClick={handleChangeBowler} className="text-[10px] font-mono text-accent hover:text-accent/80 uppercase tracking-wider">
                          Change Bowler
                        </button>
                        {match.format === "test" && (
                          <button onClick={handleDeclare} className="text-[10px] font-mono text-orange-400 hover:text-orange-300 uppercase tracking-wider">
                            Declare
                          </button>
                        )}
                        <button onClick={handleNewInnings} className="text-[10px] font-mono text-primary hover:text-primary/80 uppercase tracking-wider">
                          New Innings
                        </button>
                        <button onClick={handleEndMatch} className="text-[10px] font-mono text-destructive hover:text-destructive/80 uppercase tracking-wider">
                          End Match
                        </button>
                      </div>
                    </div>
                    <BallInput onBallRecorded={handleBallRecorded} disabled={isAnalyzing || match.isMatchComplete} />
                  </div>
                )}

                {/* New batter alert */}
                {match.isNewBatter && match.ballHistory.length > 0 && !match.isMatchComplete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-center"
                  >
                    <p className="text-sm font-bold text-accent">🆕 New Batter at Crease</p>
                    <p className="text-xs text-muted-foreground mt-1">Attack mode: slips in, fuller lengths, pressure!</p>
                  </motion.div>
                )}

                <LiveSuggestions
                  suggestions={suggestions}
                  onApplyField={handleApplyField}
                  isLoading={isAnalyzing}
                  hasFieldSuggestion={!!pendingFielders}
                />

                {/* Special Fielder Roles Info */}
                <div className="bg-card/30 border border-border/50 rounded-xl p-3 space-y-2">
                  <h4 className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest font-bold">Tactical Roles</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex gap-2 items-start">
                      <span className="text-blue-400 text-xs">🧱</span>
                      <div>
                        <p className="text-[10px] font-bold text-foreground leading-none">30 Yard Wall</p>
                        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">Best infielder, blocks grounded shots.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <span className="text-green-400 text-xs">🏃</span>
                      <div>
                        <p className="text-[10px] font-bold text-foreground leading-none">Sprinter</p>
                        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">Best runner, covers outfield singles/doubles.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <span className="text-red-400 text-xs">🧤</span>
                      <div>
                        <p className="text-[10px] font-bold text-foreground leading-none">Catcher</p>
                        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">Best catcher, placed where catching chances are most frequent (slips, short leg, or boundary).</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <span className="text-purple-400 text-xs">⭐</span>
                      <div>
                        <p className="text-[10px] font-bold text-foreground leading-none">Superfielder</p>
                        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">Elite athlete (Sprinter + Catcher combination).</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fielder legend */}
                {fielders.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {fielders.map((f) => {
                      const catBadge: Record<string, { label: string; color: string }> = {
                        "30yd-wall": { label: "🧱", color: "text-blue-400" },
                        sprinter: { label: "🏃", color: "text-green-400" },
                        catcher: { label: "🧤", color: "text-red-400" },
                        superfielder: { label: "⭐", color: "text-purple-400" },
                      };
                      const badge = f.category ? catBadge[f.category] : null;
                      return (
                        <div key={f.name} className="flex items-center gap-1.5 text-[10px] font-mono bg-card/50 rounded px-2 py-1 border border-border/50">
                          <span className="text-accent font-bold">{f.label}</span>
                          <span className="text-muted-foreground truncate">{f.name}</span>
                          {badge && <span className={`ml-auto ${badge.color}`}>{badge.label}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Match complete actions */}
                {match.isMatchComplete && (
                  <button onClick={handleEndMatch} className="w-full h-10 rounded-lg bg-accent text-accent-foreground font-mono uppercase tracking-wider text-sm font-bold">
                    New Match
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════ MANUAL MODE ═══════ */}
        {mode === "manual" && (
          <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="order-1">
              <CricketField 
                fielders={fielders} 
                isLoading={isLoading} 
                batterHand={settings.batterHand}
                boundaryDistances={{
                  off: settings.boundaryOff,
                  leg: settings.boundaryLeg,
                  straight: settings.boundaryStraight,
                  behind: settings.boundaryBack
                }}
              />

              {fielders.length > 0 && !isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {fielders.map((f) => {
                    const catBadge: Record<string, { label: string; color: string }> = {
                      "30yd-wall": { label: "🧱 Wall", color: "text-blue-400" },
                      sprinter: { label: "🏃 Sprint", color: "text-green-400" },
                      catcher: { label: "🧤 Catch", color: "text-red-400" },
                      superfielder: { label: "⭐ Super", color: "text-purple-400" },
                    };
                    const badge = f.category ? catBadge[f.category] : null;
                    return (
                      <div key={f.name} className="flex items-center gap-2 text-xs font-mono bg-card/50 rounded-md px-3 py-1.5 border border-border/50">
                        <span className="text-accent font-bold">{f.label}</span>
                        <span className="text-muted-foreground">{f.name}</span>
                        {badge && <span className={`ml-auto text-[10px] ${badge.color} font-semibold`}>{badge.label}</span>}
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {reasoning && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-card/50 border border-border/50 rounded-lg p-4">
                  <h3 className="text-xs font-mono text-accent uppercase tracking-wider mb-2">Tactical Reasoning</h3>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{reasoning}</pre>
                </motion.div>
              )}

              {tactics && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4 space-y-4">
                  <div className="bg-card/50 border border-border/50 rounded-lg p-4">
                    <h3 className="text-xs font-mono text-accent uppercase tracking-wider mb-2">🎯 Bowling Plan</h3>
                    <p className="text-sm text-foreground leading-relaxed">{tactics.plan}</p>
                  </div>
                  <div className="bg-card/50 border border-accent/30 rounded-lg p-4">
                    <h3 className="text-xs font-mono text-accent uppercase tracking-wider mb-2">⚡ Primary Delivery</h3>
                    <p className="text-sm text-foreground font-medium">{tactics.mainBall}</p>
                  </div>
                  {tactics.variations.length > 0 && (
                    <div className="bg-card/50 border border-border/50 rounded-lg p-4">
                      <h3 className="text-xs font-mono text-accent uppercase tracking-wider mb-3">🔄 Variations</h3>
                      <div className="space-y-2">
                        {tactics.variations.map((v, i) => (
                          <div key={i} className="flex gap-2 text-sm">
                            <span className="text-accent font-mono shrink-0">{i + 1}.</span>
                            <div><span className="text-foreground font-medium">{v.ball}</span><span className="text-muted-foreground"> — {v.when}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {tactics.bluffs.length > 0 && (
                    <div className="bg-card/50 border border-primary/30 rounded-lg p-4">
                      <h3 className="text-xs font-mono text-primary uppercase tracking-wider mb-3">🃏 Bluffs & Double Bluffs</h3>
                      <div className="space-y-3">
                        {tactics.bluffs.map((b, i) => (
                          <div key={i} className="text-sm space-y-1">
                            <div className="flex gap-2"><span className="text-muted-foreground font-mono shrink-0 text-xs uppercase">Setup:</span><span className="text-foreground">{b.setup}</span></div>
                            <div className="flex gap-2"><span className="text-accent font-mono shrink-0 text-xs uppercase">Execute:</span><span className="text-foreground font-medium">{b.execution}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="order-2 bg-card/80 backdrop-blur border border-border rounded-xl p-5">
              <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Match Conditions</h2>
              <SettingsPanel settings={settings} onChange={setSettings} onGenerate={handleGenerate} isLoading={isLoading} />
            </motion.div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
