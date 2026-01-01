import { useState } from 'react';
import { ArrowRight, Copy, Check, Coins, Trophy, Flame, Sprout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import pumpadTextLogo from '@/assets/pumpad-text-logo.png';

const CONTRACT_ADDRESS = "2FWWHi5NLVj6oXkAyWAtqjBZ6CNRCX8QM8yUtRVNpump";

// Feature node component - compact design
const FeatureNode = ({ 
  icon: Icon, 
  label, 
  color, 
  borderColor,
  position,
  onClick
}: { 
  icon: React.ElementType; 
  label: string; 
  color: string;
  borderColor: string;
  position: 'top' | 'right' | 'bottom' | 'left';
  onClick: () => void;
}) => {
  const positionClasses = {
    top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  };

  return (
    <button
      onClick={onClick}
      className={`absolute ${positionClasses[position]} group cursor-pointer z-20`}
    >
      <div className={`
        relative w-16 h-16 sm:w-20 sm:h-20 
        flex flex-col items-center justify-center 
        bg-card/95 backdrop-blur-sm
        border-2 ${borderColor}
        transition-all duration-300
        group-hover:scale-110
      `}>
        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${color} mb-1`} />
        <span className={`font-pixel text-[7px] sm:text-[8px] ${color}`}>{label}</span>
        
        {/* Glow on hover */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity ${color.replace('text-', 'bg-')}`} />
      </div>
    </button>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    toast.success('Address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const features = [
    { icon: Coins, label: 'STAKE', route: '/staking', color: 'text-green-400', borderColor: 'border-green-400/50', position: 'top' as const },
    { icon: Trophy, label: 'RACE', route: '/race', color: 'text-yellow-400', borderColor: 'border-yellow-400/50', position: 'right' as const },
    { icon: Flame, label: 'BURN', route: '/burn', color: 'text-orange-400', borderColor: 'border-orange-400/50', position: 'bottom' as const },
    { icon: Sprout, label: 'FARM', route: '/social-farming', color: 'text-purple-400', borderColor: 'border-purple-400/50', position: 'left' as const },
  ];

  return (
    <div className="min-h-screen flex items-center relative overflow-hidden bg-background">
      {/* Subtle grid */}
      <div className="absolute inset-0 bg-pixel-grid opacity-20" />

      {/* Animations */}
      <style>{`
        @keyframes border-flow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes data-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes line-draw {
          0% { stroke-dashoffset: 100; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-border-flow {
          background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.5), transparent);
          background-size: 200% 100%;
          animation: border-flow 2s linear infinite;
        }
      `}</style>

      <div className="w-full max-w-7xl mx-auto px-6 py-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* LEFT SIDE */}
          <div className="space-y-8">
            {/* Status */}
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-muted border-2 border-border">
              <div className="w-2 h-2 bg-primary animate-pulse" />
              <span className="font-pixel text-[9px] text-muted-foreground tracking-wider">LIVE ON SOLANA</span>
            </div>

            {/* Main title */}
            <div className="space-y-4">
              <h1 className="font-pixel text-2xl sm:text-3xl lg:text-4xl leading-loose text-foreground">
                <span className="block">TOKEN</span>
                <span className="block">UTILITIES</span>
                <span className="block text-primary">UPGRADED</span>
              </h1>
              
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Stake, race, burn, and farm — all the tools to make your token thrive. 
                <span className="text-foreground"> No code required.</span>
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Button
                variant="game"
                size="lg"
                onClick={() => navigate('/staking')}
                className="group"
              >
                START
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="pixel"
                size="lg"
                onClick={() => navigate('/docs')}
              >
                DOCS
              </Button>
            </div>

            {/* Contract Address */}
            <div className="pt-2 space-y-2">
              <span className="font-pixel text-[8px] text-muted-foreground">CONTRACT</span>
              <button
                onClick={copyAddress}
                className="flex items-center gap-3 px-4 py-3 bg-card border-2 border-border hover:border-primary transition-colors group"
              >
                <code className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-6)}
                </code>
                {copied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </button>
            </div>
          </div>

          {/* RIGHT SIDE - Tech Grid Design */}
          <div className="relative flex items-center justify-center min-h-[380px] lg:min-h-[450px]">
            
            {/* Background grid effect */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="w-full h-full bg-pixel-grid" />
            </div>

            {/* SVG Connection Lines */}
            <svg className="absolute w-[320px] h-[320px] sm:w-[360px] sm:h-[360px]" viewBox="0 0 360 360">
              {/* Animated connection lines from features to center */}
              <g className="text-green-400">
                <line x1="180" y1="40" x2="180" y2="130" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" opacity="0.4" />
                <circle cx="180" cy="70" r="3" fill="currentColor" opacity="0.8">
                  <animate attributeName="cy" values="40;130;40" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" dur="2s" repeatCount="indefinite" />
                </circle>
              </g>
              <g className="text-yellow-400">
                <line x1="320" y1="180" x2="230" y2="180" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" opacity="0.4" />
                <circle cx="290" cy="180" r="3" fill="currentColor" opacity="0.8">
                  <animate attributeName="cx" values="320;230;320" dur="2s" repeatCount="indefinite" begin="0.5s" />
                  <animate attributeName="opacity" values="0;1;1;0" dur="2s" repeatCount="indefinite" begin="0.5s" />
                </circle>
              </g>
              <g className="text-orange-400">
                <line x1="180" y1="320" x2="180" y2="230" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" opacity="0.4" />
                <circle cx="180" cy="290" r="3" fill="currentColor" opacity="0.8">
                  <animate attributeName="cy" values="320;230;320" dur="2s" repeatCount="indefinite" begin="1s" />
                  <animate attributeName="opacity" values="0;1;1;0" dur="2s" repeatCount="indefinite" begin="1s" />
                </circle>
              </g>
              <g className="text-purple-400">
                <line x1="40" y1="180" x2="130" y2="180" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" opacity="0.4" />
                <circle cx="70" cy="180" r="3" fill="currentColor" opacity="0.8">
                  <animate attributeName="cx" values="40;130;40" dur="2s" repeatCount="indefinite" begin="1.5s" />
                  <animate attributeName="opacity" values="0;1;1;0" dur="2s" repeatCount="indefinite" begin="1.5s" />
                </circle>
              </g>
            </svg>

            {/* Feature nodes container */}
            <div className="relative w-[240px] h-[240px] sm:w-[280px] sm:h-[280px]">
              
              {/* Feature nodes */}
              {features.map((f) => (
                <FeatureNode
                  key={f.label}
                  icon={f.icon}
                  label={f.label}
                  color={f.color}
                  borderColor={f.borderColor}
                  position={f.position}
                  onClick={() => navigate(f.route)}
                />
              ))}

              {/* Center logo */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Animated border */}
                  <div className="absolute inset-[-4px] bg-gradient-to-r from-green-400 via-yellow-400 via-orange-400 to-purple-400 opacity-30" 
                       style={{ 
                         background: 'linear-gradient(90deg, #22c55e, #facc15, #fb923c, #c084fc, #22c55e)',
                         backgroundSize: '200% 100%',
                         animation: 'border-flow 3s linear infinite'
                       }} 
                  />
                  
                  {/* Logo container */}
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36 flex items-center justify-center bg-card border-2 border-primary/60">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                    <img 
                      src={pumpadTextLogo} 
                      alt="Pumpad" 
                      className="w-20 sm:w-24 lg:w-28 h-auto relative z-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Corner decorations */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-border/50" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-border/50" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-border/50" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-border/50" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
