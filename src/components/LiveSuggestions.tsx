import { motion, AnimatePresence } from "framer-motion";
import { AISuggestion } from "@/lib/matchTypes";

interface LiveSuggestionsProps {
  suggestions: AISuggestion[];
  onApplyField: () => void;
  isLoading: boolean;
  hasFieldSuggestion: boolean;
}

const LiveSuggestions = ({ suggestions, onApplyField, isLoading, hasFieldSuggestion }: LiveSuggestionsProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono text-accent uppercase tracking-wider font-bold">AI Tactical Suggestions</h3>
        {isLoading && (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider"
          >
            Analyzing...
          </motion.span>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {suggestions.length === 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card/30 border border-border/50 rounded-lg p-4 text-center"
            >
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">No suggestions yet. Record more balls to trigger analysis.</p>
            </motion.div>
          )}

          {suggestions.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.1 }}
              className={`p-3 rounded-lg border flex gap-3 items-start ${
                s.priority === "high" ? "bg-accent/10 border-accent/30" : "bg-card/50 border-border/50"
              }`}
            >
              <div className="mt-0.5">
                {s.type === "field-change" ? "🛡️" : s.type === "bowling" ? "🎯" : s.type === "pressure" ? "🔥" : "ℹ️"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-mono uppercase tracking-widest font-bold ${
                    s.priority === "high" ? "text-accent" : "text-muted-foreground"
                  }`}>
                    {s.priority} Priority
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest opacity-50">
                    {s.type}
                  </span>
                </div>
                <p className="text-xs text-foreground leading-relaxed font-medium">{s.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {hasFieldSuggestion && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onApplyField}
          className="w-full h-10 rounded-lg bg-accent text-accent-foreground font-mono uppercase tracking-wider text-xs font-bold shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Apply Suggested Field Changes
        </motion.button>
      )}
    </div>
  );
};

export default LiveSuggestions;
