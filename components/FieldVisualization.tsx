import React, { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '@/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { motion, useMotionValue } from 'motion/react';
import { LogIn, LogOut, Users, Shield, UserPlus, Copy, Check } from 'lucide-react';

interface Fielder {
  id: string;
  x: number;
  y: number;
  label: string;
}

interface FieldRoom {
  roomCode: string;
  bowlerId: string;
  batterId?: string;
  fieldPositions: Fielder[];
  createdAt: any;
}

const FielderNode = ({ 
  fielder, 
  role, 
  fieldRef, 
  onUpdate 
}: { 
  fielder: Fielder; 
  role: 'bowler' | 'batter' | null; 
  fieldRef: React.RefObject<HTMLDivElement | null>; 
  onUpdate: (id: string, x: number, y: number) => void;
}) => {
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={nodeRef}
      drag={role === 'bowler'}
      dragConstraints={fieldRef}
      dragElastic={0}
      dragMomentum={false}
      style={{ 
        x: dragX, 
        y: dragY, 
        left: `${fielder.x}%`, 
        top: `${fielder.y}%`,
        zIndex: 10 
      }}
      onDragEnd={(e, info) => {
        if (role !== 'bowler' || !fieldRef.current || !nodeRef.current) return;
        
        const containerRect = fieldRef.current.getBoundingClientRect();
        const nodeRect = nodeRef.current.getBoundingClientRect();
        
        // Calculate the center of the fielder node relative to the viewport
        const nodeCenterX = nodeRect.left + nodeRect.width / 2;
        const nodeCenterY = nodeRect.top + nodeRect.height / 2;
        
        // Convert to percentages relative to the field container
        let xPct = ((nodeCenterX - containerRect.left) / containerRect.width) * 100;
        let yPct = ((nodeCenterY - containerRect.top) / containerRect.height) * 100;
        
        // Clamp to keep strictly inside the field (e.g. 2% to 98%)
        xPct = Math.max(2, Math.min(98, xPct));
        yPct = Math.max(2, Math.min(98, yPct));
        
        onUpdate(fielder.id, xPct, yPct);
        
        // Reset the drag transform so the new left/top takes over cleanly
        dragX.set(0);
        dragY.set(0);
      }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center ${role === 'bowler' ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="w-4 h-4 bg-white rounded-full border-2 border-red-500 shadow-md"></div>
    </motion.div>
  );
};

const INITIAL_FIELDERS: Fielder[] = [
  { id: 'wk', x: 50, y: 85, label: 'WK' },
  { id: 'slip1', x: 40, y: 80, label: '1st Slip' },
  { id: 'point', x: 15, y: 50, label: 'Point' },
  { id: 'cover', x: 30, y: 30, label: 'Cover' },
  { id: 'mid-off', x: 45, y: 15, label: 'Mid Off' },
  { id: 'mid-on', x: 55, y: 15, label: 'Mid On' },
  { id: 'mid-wicket', x: 75, y: 40, label: 'Mid Wicket' },
  { id: 'square-leg', x: 85, y: 60, label: 'Square Leg' },
  { id: 'fine-leg', x: 70, y: 85, label: 'Fine Leg' },
  { id: 'third-man', x: 25, y: 85, label: 'Third Man' },
  { id: 'bowler', x: 50, y: 10, label: 'Bowler' },
];

export default function FieldVisualization() {
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [role, setRole] = useState<'bowler' | 'batter' | null>(null);
  const [fielders, setFielders] = useState<Fielder[]>(INITIAL_FIELDERS);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const roomRef = doc(db, 'fieldRooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as FieldRoom;
        setFielders(data.fieldPositions);
      } else {
        setError('Room closed or does not exist.');
        setRoomCode('');
        setRole(null);
      }
    }, (err) => {
      console.error("Snapshot error:", err);
      setError("Lost connection to room.");
    });

    return () => unsubscribe();
  }, [roomCode]);

  const handleSignIn = async () => {
    try {
      setError('');
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/network-request-failed' || err.message?.includes('network-request-failed')) {
        setError('Sign-in blocked by browser. Please click the "Open in new tab" button (top right of preview) to sign in.');
      } else {
        setError(`Failed to sign in: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setRoomCode('');
    setRole(null);
  };

  const createRoom = async () => {
    if (!user) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = doc(db, 'fieldRooms', code);
    
    try {
      await setDoc(roomRef, {
        roomCode: code,
        bowlerId: user.uid,
        fieldPositions: INITIAL_FIELDERS,
        createdAt: serverTimestamp()
      });
      setRoomCode(code);
      setRole('bowler');
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to create room.');
    }
  };

  const joinRoom = async () => {
    if (!user || !joinCode) return;
    const code = joinCode.toUpperCase();
    const roomRef = doc(db, 'fieldRooms', code);
    
    try {
      const docSnap = await getDoc(roomRef);
      if (docSnap.exists()) {
        await updateDoc(roomRef, {
          batterId: user.uid
        });
        setRoomCode(code);
        setRole('batter');
        setError('');
      } else {
        setError('Room not found.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to join room.');
    }
  };

  const updateFielderPosition = async (id: string, x: number, y: number) => {
    if (role !== 'bowler' || !roomCode) return;
    
    const updatedFielders = fielders.map(f => 
      f.id === id ? { ...f, x, y } : f
    );
    
    setFielders(updatedFielders);
    
    try {
      const roomRef = doc(db, 'fieldRooms', roomCode);
      await updateDoc(roomRef, {
        fieldPositions: updatedFielders
      });
    } catch (err) {
      console.error("Failed to sync position", err);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Match Scenario Field</h2>
          <p className="text-muted-foreground">Sign in to create or join a field visualization session.</p>
        </div>
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm text-center max-w-md">
            {error}
          </div>
        )}
        <button
          onClick={handleSignIn}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-lg"
        >
          <LogIn className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className="max-w-md mx-auto mt-12 space-y-8">
        <div className="flex items-center justify-between bg-secondary/30 p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <p className="font-medium text-sm">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid gap-6">
          <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Shield className="w-5 h-5" />
              <h3 className="font-semibold text-lg">I am the Bowler</h3>
            </div>
            <p className="text-sm text-muted-foreground">Create a room to set the field and share the code with the batter.</p>
            <button
              onClick={createRoom}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Create Room
            </button>
          </div>

          <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-accent mb-2">
              <UserPlus className="w-5 h-5" />
              <h3 className="font-semibold text-lg">I am the Batter</h3>
            </div>
            <p className="text-sm text-muted-foreground">Join a room using the code provided by the bowler.</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Room Code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary uppercase"
                maxLength={6}
              />
              <button
                onClick={joinRoom}
                disabled={!joinCode}
                className="bg-accent text-accent-foreground px-4 py-2 rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-card border border-border p-4 rounded-xl shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Role</span>
            <span className="font-bold text-lg capitalize text-primary">{role}</span>
          </div>
          <div className="h-8 w-px bg-border"></div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Room Code</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg tracking-widest">{roomCode}</span>
              <button onClick={copyCode} className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={() => { setRoomCode(''); setRole(null); }}
          className="text-sm text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
        >
          <LogOut className="w-4 h-4" /> Leave Room
        </button>
      </div>

      <div className="relative w-full max-w-[600px] mx-auto aspect-[3/4] bg-green-800 rounded-[100px] border-4 border-white/20 overflow-hidden shadow-2xl" ref={fieldRef}>
        {/* Pitch */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[15%] h-[30%] bg-[#e3c188] border border-white/30 rounded-sm">
          {/* Creases */}
          <div className="absolute top-[10%] left-0 w-full h-px bg-white/80"></div>
          <div className="absolute bottom-[10%] left-0 w-full h-px bg-white/80"></div>
          {/* Stumps */}
          <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[20%] h-[2%] flex justify-between">
            <div className="w-[20%] h-full bg-white"></div>
            <div className="w-[20%] h-full bg-white"></div>
            <div className="w-[20%] h-full bg-white"></div>
          </div>
          <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[20%] h-[2%] flex justify-between">
            <div className="w-[20%] h-full bg-white"></div>
            <div className="w-[20%] h-full bg-white"></div>
            <div className="w-[20%] h-full bg-white"></div>
          </div>
        </div>

        {/* 30 Yard Circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[45%] border border-white/30 rounded-[50%] pointer-events-none"></div>

        {/* Fielders */}
        {fielders.map((fielder) => (
          <FielderNode 
            key={fielder.id} 
            fielder={fielder} 
            role={role} 
            fieldRef={fieldRef} 
            onUpdate={updateFielderPosition} 
          />
        ))}
      </div>
      
      {role === 'bowler' && (
        <p className="text-center text-sm text-muted-foreground">Drag the fielders to set your custom field. Changes sync automatically.</p>
      )}
      {role === 'batter' && (
        <p className="text-center text-sm text-muted-foreground">Viewing live field set by the bowler.</p>
      )}
    </div>
  );
}