import React from "react";
import { Lock, Shield, Clock, Users, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LockTokens = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="pb-6">
        <div className="max-w-3xl mx-auto px-4">
          
          {/* Hero Section */}
          <div className="relative mb-8 p-8 rounded-2xl bg-card border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-purple-500/5" />
            
            <div className="relative flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6">
                <Lock className="w-10 h-10 text-purple-400" />
              </div>
              
              <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30">
                Coming Soon
              </Badge>
              
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Token Lock
              </h1>
              <p className="text-muted-foreground max-w-lg">
                Secure locking mechanism for developer and team tokens to build trust with your community.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid gap-4 mb-8">
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Dev Token Lock</h3>
                  <p className="text-sm text-muted-foreground">
                    Lock your developer allocation to show commitment and build investor confidence. Locked tokens cannot be sold until the unlock date.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Team Token Lock</h3>
                  <p className="text-sm text-muted-foreground">
                    Lock team allocations with customizable vesting schedules. Show transparency in token distribution to your community.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Flexible Lock Periods</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose your lock duration from 30 days to 2 years. Longer locks earn higher trust scores and visibility on the platform.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon CTA */}
          <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              This feature is currently in development
            </p>
            <div className="flex items-center justify-center gap-2 text-purple-400">
              <span className="text-sm font-medium">Stay tuned for updates</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LockTokens;
