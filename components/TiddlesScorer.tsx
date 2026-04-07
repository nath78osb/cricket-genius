import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Trophy, LogIn, LogOut, User, Users, Copy, ArrowRight, Medal, Hash } from 'lucide-react';
import { auth, db, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, onSnapshot, orderBy, limit, writeBatch, arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserStats {
  uid: string;
  displayName: string;
  totalPositive: number;
  totalNegative: number;
  netScore: number;
}

interface Match {
  id?: string;
  hostId: string;
  name: string;
  inviteCode: string;
  createdAt: number;
  status: string;
  playerIds: string[];
}

interface MatchPlayer {
  uid: string;
  displayName: string;
  score: number;
  fumbles: number;
  cleans: number;
  isLocal?: boolean;
}

const TiddlesScorer = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  
  const [activeTab, setActiveTab] = useState<'play' | 'leaderboard' | 'history'>('play');
  
  // Match State
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(() => localStorage.getItem('tiddles-match-id'));
  const [matchInfo, setMatchInfo] = useState<Match | null>(null);
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newMatchName, setNewMatchName] = useState('');
  const [newLocalPlayerName, setNewLocalPlayerName] = useState('');
  
  // Leaderboard State
  const [leaderboardType, setLeaderboardType] = useState<'net' | 'fumbles' | 'cleans'>('net');
  const [leaderboardData, setLeaderboardData] = useState<UserStats[]>([]);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  // History State
  const [matchHistory, setMatchHistory] = useState<(Match & { myScore?: number })[]>([]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserStats(currentUser);
      } else {
        setUserStats(null);
        setCurrentMatchId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Persist Match ID
  useEffect(() => {
    if (currentMatchId) {
      localStorage.setItem('tiddles-match-id', currentMatchId);
    } else {
      localStorage.removeItem('tiddles-match-id');
    }
  }, [currentMatchId]);

  // Match Listener
  useEffect(() => {
    if (!currentMatchId) {
      setMatchInfo(null);
      setMatchPlayers([]);
      return;
    }

    const matchUnsub = onSnapshot(doc(db, 'matches', currentMatchId), (docSnap) => {
      if (docSnap.exists()) {
        setMatchInfo({ id: docSnap.id, ...docSnap.data() } as Match);
      } else {
        // Match was deleted or invalid
        setCurrentMatchId(null);
      }
    });

    const playersUnsub = onSnapshot(collection(db, `matches/${currentMatchId}/players`), (snapshot) => {
      const players = snapshot.docs.map(d => d.data() as MatchPlayer);
      players.sort((a, b) => b.score - a.score);
      setMatchPlayers(players);
    });

    return () => {
      matchUnsub();
      playersUnsub();
    };
  }, [currentMatchId]);

  // Leaderboard Listener
  useEffect(() => {
    if (activeTab !== 'leaderboard' || !user) return;

    let orderByField = 'netScore';
    if (leaderboardType === 'fumbles') orderByField = 'totalPositive';
    if (leaderboardType === 'cleans') orderByField = 'totalNegative';

    const q = query(collection(db, 'users'), orderBy(orderByField, 'desc'), limit(10));
    const unsub = onSnapshot(q, (snapshot) => {
      setLeaderboardData(snapshot.docs.map(d => d.data() as UserStats));
    });

    return () => unsub();
  }, [activeTab, leaderboardType, user]);

  // History Listener
  useEffect(() => {
    if (activeTab !== 'history' || !user) return;

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'matches'),
          where('playerIds', 'array-contains', user.uid),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const matches = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match));
        
        // Fetch the user's score for each match
        const historyWithScores = await Promise.all(matches.map(async (m) => {
          const playerDoc = await getDoc(doc(db, `matches/${m.id}/players`, user.uid));
          return { ...m, myScore: playerDoc.exists() ? playerDoc.data().score : 0 };
        }));
        
        setMatchHistory(historyWithScores);
      } catch (error) {
        console.error("Error fetching match history:", error);
      }
    };

    fetchHistory();
  }, [activeTab, user]);

  const fetchUserStats = async (currentUser: FirebaseUser) => {
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserStats(docSnap.data() as UserStats);
      } else {
        const newStats: UserStats = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Unknown User',
          totalPositive: 0,
          totalNegative: 0,
          netScore: 0
        };
        await setDoc(docRef, newStats);
        setUserStats(newStats);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Signed in successfully!");
    } catch (error) {
      console.error("Sign in error:", error);
      toast.error("Failed to sign in.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Signed out.");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const createMatch = async () => {
    if (!user) return;
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const matchRef = doc(collection(db, 'matches'));
      const matchId = matchRef.id;

      const batch = writeBatch(db);
      batch.set(matchRef, {
        hostId: user.uid,
        name: newMatchName.trim() || 'Friendly Match',
        inviteCode,
        createdAt: Date.now(),
        status: 'active',
        playerIds: [user.uid]
      });

      batch.set(doc(db, `matches/${matchId}/players`, user.uid), {
        uid: user.uid,
        displayName: user.displayName || 'Unknown',
        score: 0,
        fumbles: 0,
        cleans: 0
      });

      await batch.commit();
      setCurrentMatchId(matchId);
      toast.success(`Match created! Invite code: ${inviteCode}`);
    } catch (error) {
      console.error("Error creating match:", error);
      toast.error("Failed to create match.");
    }
  };

  const joinMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteCodeInput.trim()) return;

    try {
      const q = query(collection(db, 'matches'), where('inviteCode', '==', inviteCodeInput.trim().toUpperCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.error("Invalid invite code");
        return;
      }

      const matchDoc = snapshot.docs[0];
      const matchId = matchDoc.id;

      const batch = writeBatch(db);

      // Add user to match playerIds array
      batch.update(doc(db, 'matches', matchId), {
        playerIds: arrayUnion(user.uid)
      });

      // Add user to match players (merge true in case they are re-joining)
      batch.set(doc(db, `matches/${matchId}/players`, user.uid), {
        uid: user.uid,
        displayName: user.displayName || 'Unknown',
        score: 0,
        fumbles: 0,
        cleans: 0
      }, { merge: true });

      await batch.commit();

      setCurrentMatchId(matchId);
      setInviteCodeInput('');
      toast.success("Joined match!");
    } catch (error) {
      console.error("Error joining match:", error);
      toast.error("Failed to join match.");
    }
  };

  const leaveMatch = () => {
    setCurrentMatchId(null);
    toast.info("Left the match.");
  };

  const updateScore = async (change: number, playerId?: string) => {
    if (!user || !currentMatchId) return;

    const targetUid = playerId || user.uid;
    const isLocalPlayer = targetUid !== user.uid;

    const isPositive = change > 0; // +1 is a fumble
    const batch = writeBatch(db);

    // Update match player stats
    const playerRef = doc(db, `matches/${currentMatchId}/players`, targetUid);
    batch.update(playerRef, {
      score: increment(change),
      fumbles: isPositive ? increment(1) : increment(0),
      cleans: !isPositive ? increment(1) : increment(0)
    });

    // Update global user stats only if it's the logged-in user
    if (!isLocalPlayer) {
      const userRef = doc(db, 'users', user.uid);
      batch.set(userRef, {
        netScore: increment(change),
        totalPositive: isPositive ? increment(1) : increment(0),
        totalNegative: !isPositive ? increment(1) : increment(0)
      }, { merge: true });
    }

    try {
      await batch.commit();
      
      if (!isLocalPlayer) {
        // Update local state for immediate feedback
        setUserStats(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            totalPositive: prev.totalPositive + (isPositive ? 1 : 0),
            totalNegative: prev.totalNegative + (!isPositive ? 1 : 0),
            netScore: prev.netScore + change
          };
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update score");
    }
  };

  const addLocalPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentMatchId || !newLocalPlayerName.trim()) return;

    const localUid = 'local_' + Math.random().toString(36).substring(2, 9);
    
    try {
      const batch = writeBatch(db);
      
      // Add to match playerIds
      batch.update(doc(db, 'matches', currentMatchId), {
        playerIds: arrayUnion(localUid)
      });

      // Add player document
      batch.set(doc(db, `matches/${currentMatchId}/players`, localUid), {
        uid: localUid,
        displayName: newLocalPlayerName.trim(),
        score: 0,
        fumbles: 0,
        cleans: 0,
        isLocal: true
      });

      await batch.commit();
      setNewLocalPlayerName('');
      toast.success("Local player added!");
    } catch (error) {
      console.error("Error adding local player:", error);
      toast.error("Failed to add local player.");
    }
  };

  const resetStats = async () => {
    if (!user) return;
    
    if (!isConfirmingReset) {
      setIsConfirmingReset(true);
      setTimeout(() => setIsConfirmingReset(false), 3000); // Reset confirmation state after 3 seconds
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        netScore: 0,
        totalPositive: 0,
        totalNegative: 0
      }, { merge: true });

      setUserStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          totalPositive: 0,
          totalNegative: 0,
          netScore: 0
        };
      });
      setIsConfirmingReset(false);
      toast.success("Stats reset successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reset stats");
    }
  };

  const copyInviteCode = () => {
    if (matchInfo) {
      navigator.clipboard.writeText(matchInfo.inviteCode);
      toast.success("Invite code copied!");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 px-2 sm:px-0">
      
      {/* Profile Section (Always visible at top) */}
      <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            My Tiddles Profile
          </h3>
          {user ? (
            <div className="flex gap-2">
              <button 
                onClick={resetStats} 
                className={`text-[10px] sm:text-xs flex items-center gap-1 transition-all px-2 py-1 rounded-md ${
                  isConfirmingReset 
                    ? "bg-destructive text-destructive-foreground font-bold" 
                    : "text-destructive hover:bg-destructive/10"
                }`}
              >
                {isConfirmingReset ? "Confirm Reset?" : "Reset Stats"}
              </button>
              <button onClick={handleSignOut} className="text-[10px] sm:text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
                <LogOut className="w-3 h-3" /> Sign Out
              </button>
            </div>
          ) : (
            <button onClick={handleSignIn} className="text-[10px] sm:text-xs flex items-center gap-1 bg-accent/10 text-accent hover:bg-accent/20 px-2 sm:px-3 py-1.5 rounded-full transition-colors font-medium">
              <LogIn className="w-3 h-3" /> Sign In with Google
            </button>
          )}
        </div>

        {user ? (
          userStats ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-background border border-border/50 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Fumbles (+1)</div>
                <div className="text-lg sm:text-xl font-black text-green-500">{userStats.totalPositive}</div>
              </div>
              <div className="bg-background border border-border/50 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Cleans (-1)</div>
                <div className="text-lg sm:text-xl font-black text-red-500">{userStats.totalNegative}</div>
              </div>
              <div className="bg-background border border-border/50 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1">All-Time Net</div>
                <div className={`text-lg sm:text-xl font-black ${userStats.netScore > 0 ? 'text-green-500' : userStats.netScore < 0 ? 'text-red-500' : 'text-foreground'}`}>
                  {userStats.netScore}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">Loading profile stats...</div>
          )
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
            Sign in to track your all-time Tiddles statistics across all matches!
          </div>
        )}
      </div>

      {/* Main Content Tabs */}
      {user && (
        <div className="flex justify-center flex-wrap gap-2 border-b border-border/50 pb-4">
          <button
            onClick={() => setActiveTab('play')}
            className={`px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'play' ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Current Match
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'leaderboard' ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Global Leaderboards
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'history' ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Match History
          </button>
        </div>
      )}

      {/* Play Tab */}
      {activeTab === 'play' && (
        <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-4 sm:p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-accent mb-2">Multiplayer Tiddles</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Call "Tiddles!" before a fielder fields the ball.<br/>
              Fumble/Drop = <span className="text-green-500 font-bold">+1 point</span> | Clean/Catch = <span className="text-red-500 font-bold">-1 point</span>
            </p>
          </div>

          {!user ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border/50 rounded-lg">
              Please sign in above to create or join a multiplayer match.
            </div>
          ) : !currentMatchId ? (
            <div className="space-y-6">
              <div className="bg-background border border-border/50 rounded-lg p-4 sm:p-6 text-center">
                <h3 className="font-bold mb-2 text-sm sm:text-base">Start a New Match</h3>
                <p className="text-xs text-muted-foreground mb-4">Create a new match and invite your friends with a code.</p>
                <div className="flex flex-col sm:flex-row gap-2 max-w-xs mx-auto">
                  <input
                    type="text"
                    value={newMatchName}
                    onChange={(e) => setNewMatchName(e.target.value)}
                    placeholder="Match Name (Optional)"
                    className="flex-1 bg-secondary border border-border rounded-lg px-4 py-3 sm:py-2 text-sm focus:outline-none focus:border-accent text-center"
                    maxLength={30}
                  />
                  <button
                    onClick={createMatch}
                    className="bg-accent text-accent-foreground px-6 py-3 sm:py-2 rounded-lg font-bold text-sm w-full sm:w-auto"
                  >
                    Create
                  </button>
                </div>
              </div>
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-border/50"></div>
                <span className="flex-shrink-0 mx-4 text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">OR</span>
                <div className="flex-grow border-t border-border/50"></div>
              </div>

              <div className="bg-background border border-border/50 rounded-lg p-4 sm:p-6 text-center">
                <h3 className="font-bold mb-2 text-sm sm:text-base">Join Existing Match</h3>
                <p className="text-xs text-muted-foreground mb-4">Enter an invite code from a friend to join their match.</p>
                <form onSubmit={joinMatch} className="flex flex-col sm:flex-row gap-2 max-w-xs mx-auto">
                  <input
                    type="text"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value)}
                    placeholder="Enter Code..."
                    className="flex-1 bg-secondary border border-border rounded-lg px-4 py-3 sm:py-2 text-sm focus:outline-none focus:border-accent uppercase text-center font-mono"
                    maxLength={6}
                  />
                  <button
                    type="submit"
                    disabled={!inviteCodeInput.trim()}
                    className="bg-primary text-primary-foreground px-4 py-3 sm:py-2 rounded-lg font-bold text-sm disabled:opacity-50 w-full sm:w-auto"
                  >
                    Join
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Match Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 bg-background border border-border/50 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Match Code:</span>
                  <span className="font-mono font-bold text-base sm:text-lg text-accent tracking-widest">{matchInfo?.inviteCode}</span>
                  <button onClick={copyInviteCode} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm font-bold text-foreground">
                  {matchInfo?.name || 'Friendly Match'}
                </div>
                <button onClick={leaveMatch} className="text-[10px] sm:text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Leave Match
                </button>
              </div>

              {/* Match Players */}
              <div className="space-y-3 sm:space-y-4">
                {matchPlayers.map((player, index) => {
                  const isMe = player.uid === user.uid;
                  const canEdit = isMe || (player.isLocal && matchInfo?.hostId === user.uid);
                  return (
                    <motion.div
                      key={player.uid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-background border ${isMe ? 'border-accent/50 shadow-[0_0_10px_rgba(var(--accent),0.1)]' : 'border-border/50'} rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-1 min-w-0">
                        <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 && player.score > 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                          index === 1 && player.score > 0 ? 'bg-gray-400/20 text-gray-400' :
                          index === 2 && player.score > 0 ? 'bg-amber-600/20 text-amber-600' :
                          'bg-secondary text-muted-foreground'
                        }`}>
                          {index === 0 && player.score > 0 ? <Trophy className="w-4 h-4" /> : `#${index + 1}`}
                        </div>
                        <span className="font-bold text-base sm:text-lg truncate flex items-center gap-2">
                          {player.displayName}
                          {isMe && <span className="text-[9px] sm:text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">You</span>}
                          {player.isLocal && <span className="text-[9px] sm:text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Local</span>}
                        </span>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 shrink-0">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Score</span>
                          <span className={`text-xl sm:text-2xl font-black ${player.score > 0 ? 'text-green-500' : player.score < 0 ? 'text-red-500' : 'text-foreground'}`}>
                            {player.score}
                          </span>
                        </div>

                        {canEdit && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateScore(-1, player.uid)}
                              className="w-12 h-12 sm:w-10 sm:h-10 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                              title="Clean/Catch (-1)"
                            >
                              <Minus className="w-5 h-5 sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={() => updateScore(1, player.uid)}
                              className="w-12 h-12 sm:w-10 sm:h-10 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 flex items-center justify-center transition-colors"
                              title="Fumble/Drop (+1)"
                            >
                              <Plus className="w-5 h-5 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Add Local Player (Host Only) */}
              {matchInfo?.hostId === user.uid && (
                <div className="bg-background border border-border/50 rounded-lg p-4 mt-4">
                  <h3 className="font-bold mb-2 text-sm">Add Local Player</h3>
                  <p className="text-xs text-muted-foreground mb-3">Playing with someone in real life? Add them here to track their score on your device.</p>
                  <form onSubmit={addLocalPlayer} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newLocalPlayerName}
                      onChange={(e) => setNewLocalPlayerName(e.target.value)}
                      placeholder="Player Name"
                      className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent"
                      maxLength={20}
                    />
                    <button
                      type="submit"
                      disabled={!newLocalPlayerName.trim()}
                      className="bg-accent text-accent-foreground px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 w-full sm:w-auto"
                    >
                      Add Player
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && user && (
        <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-4 sm:p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-accent mb-2">Global Leaderboards</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">See how you stack up against Tiddles players worldwide.</p>
          </div>

          <div className="flex justify-center flex-wrap gap-2 mb-6">
            <button
              onClick={() => setLeaderboardType('net')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all ${
                leaderboardType === 'net' ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Net Score
            </button>
            <button
              onClick={() => setLeaderboardType('fumbles')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all ${
                leaderboardType === 'fumbles' ? "bg-green-500/20 text-green-500" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Most Fumbles
            </button>
            <button
              onClick={() => setLeaderboardType('cleans')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all ${
                leaderboardType === 'cleans' ? "bg-red-500/20 text-red-500" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Most Cleans
            </button>
          </div>

          <div className="space-y-2">
            {leaderboardData.map((lbUser, index) => (
              <div key={lbUser.uid} className={`flex items-center justify-between p-3 rounded-lg border ${lbUser.uid === user.uid ? 'bg-accent/5 border-accent/30' : 'bg-background border-border/50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                    index === 1 ? 'bg-gray-400/20 text-gray-400' :
                    index === 2 ? 'bg-amber-600/20 text-amber-600' :
                    'bg-secondary text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="font-medium text-sm flex items-center gap-2">
                    {lbUser.displayName}
                    {lbUser.uid === user.uid && <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full uppercase tracking-wider">You</span>}
                  </span>
                </div>
                <div className="font-mono font-bold">
                  {leaderboardType === 'net' && (
                    <span className={lbUser.netScore > 0 ? 'text-green-500' : lbUser.netScore < 0 ? 'text-red-500' : ''}>{lbUser.netScore}</span>
                  )}
                  {leaderboardType === 'fumbles' && <span className="text-green-500">{lbUser.totalPositive}</span>}
                  {leaderboardType === 'cleans' && <span className="text-red-500">{lbUser.totalNegative}</span>}
                </div>
              </div>
            ))}
            {leaderboardData.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">No data available yet.</div>
            )}
          </div>
        </div>
      )}
      {/* History Tab */}
      {activeTab === 'history' && user && (
        <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-4 sm:p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-accent mb-2">Match History</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Your recent Tiddles matches.</p>
          </div>

          <div className="space-y-3">
            {matchHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No matches played yet.
              </div>
            ) : (
              matchHistory.map((match) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-background border border-border/50 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                  <div className="flex flex-col w-full sm:w-auto">
                    <span className="font-bold text-base">{match.name || 'Friendly Match'}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(match.createdAt), 'MMM d, yyyy • h:mm a')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Players</span>
                      <span className="font-bold text-sm flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {match.playerIds?.length || 1}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Your Score</span>
                      <span className={`text-lg font-black ${match.myScore && match.myScore > 0 ? 'text-green-500' : match.myScore && match.myScore < 0 ? 'text-red-500' : 'text-foreground'}`}>
                        {match.myScore || 0}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TiddlesScorer;
