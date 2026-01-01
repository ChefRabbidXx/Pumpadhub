import React from "react";
import { ShieldCheck, Wallet, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Compensation = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="pb-6">
        <div className="max-w-3xl mx-auto px-4">
          
          {/* Hero Section */}
          <div className="relative mb-8 p-8 rounded-2xl bg-card border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-500/5" />
            
            <div className="relative flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10 text-blue-400" />
              </div>
              
              <Badge className="mb-4 bg-blue-500/20 text-blue-400 border-blue-500/30">
                Coming Soon
              </Badge>
              
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Compensation Pool
              </h1>
              <p className="text-muted-foreground max-w-lg">
                Protection for users in case of project failures or rug pulls. Get compensated from reserved token supply.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid gap-4 mb-8">
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Reserved Compensation Supply</h3>
                  <p className="text-sm text-muted-foreground">
                    Projects allocate a portion of their token supply specifically for user compensation. This fund is locked and only released if the project fails.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Rug Pull Protection</h3>
                  <p className="text-sm text-muted-foreground">
                    If a project is identified as a rug pull, affected holders can claim compensation proportional to their holdings from the reserved supply.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Fair Distribution</h3>
                  <p className="text-sm text-muted-foreground">
                    Compensation is distributed fairly based on verified holdings at the time of the incident. Our system ensures transparent and equitable claims.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="p-5 rounded-xl bg-card border border-border mb-8">
            <h3 className="font-semibold text-foreground mb-4">How It Works</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs shrink-0">1</span>
                <p>Projects allocate compensation tokens when submitting to SAFU</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs shrink-0">2</span>
                <p>Tokens are locked in a secure compensation pool</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs shrink-0">3</span>
                <p>If project fails, holders submit claims with proof of holdings</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs shrink-0">4</span>
                <p>Verified claims receive proportional compensation</p>
              </div>
            </div>
          </div>

          {/* Coming Soon CTA */}
          <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              This feature is currently in development
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <span className="text-sm font-medium">Stay tuned for updates</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Compensation;
