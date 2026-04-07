import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center tactical-grid p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card/80 backdrop-blur border border-border rounded-xl p-8 text-center max-w-md"
      >
        <h1 className="text-6xl font-bold text-accent mb-4">404</h1>
        <p className="text-xl text-foreground mb-6">Oops! Page not found</p>
        <Link 
          to="/" 
          className="inline-block px-6 py-3 rounded-lg bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          Return to Home
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
