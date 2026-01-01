import React from "react";
import { UserCheck, BadgeCheck, Globe, Twitter, MessageCircle, ArrowRight, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const KYD = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="pb-6">
        <div className="max-w-3xl mx-auto px-4">
          
          {/* Hero Section */}
          <div className="relative mb-8 p-8 rounded-2xl bg-card border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-green-500/5" />
            
            <div className="relative flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-green-500/20 flex items-center justify-center mb-6">
                <UserCheck className="w-10 h-10 text-green-400" />
              </div>
              
              <Badge className="mb-4 bg-green-500/20 text-green-400 border-green-500/30">
                Coming Soon
              </Badge>
              
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Know Your Dev (KYD)
              </h1>
              <p className="text-muted-foreground max-w-lg">
                Transparent developer profiles with optional KYC, doxxing, and social verification. Know who is behind the projects you invest in.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid gap-4 mb-8">
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                  <BadgeCheck className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">KYC Verification</h3>
                  <p className="text-sm text-muted-foreground">
                    Developers can complete optional KYC verification to earn a verified badge. Identity is verified by trusted third parties and kept confidential.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Public Doxxing</h3>
                  <p className="text-sm text-muted-foreground">
                    Developers can voluntarily doxx themselves by sharing their real identity, location, and background. Full transparency for maximum trust.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Developer Profiles</h3>
                  <p className="text-sm text-muted-foreground">
                    Each developer gets a public profile showcasing their projects, verification status, social links, and community reputation score.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Preview */}
          <div className="p-5 rounded-xl bg-card border border-border mb-8">
            <h3 className="font-semibold text-foreground mb-4">What Profiles Include</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Twitter className="w-4 h-4 text-blue-400" />
                <span>Twitter/X Profile</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="w-4 h-4 text-blue-400" />
                <span>Telegram Handle</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="w-4 h-4 text-green-400" />
                <span>Personal Website</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BadgeCheck className="w-4 h-4 text-green-400" />
                <span>Verification Status</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCheck className="w-4 h-4 text-purple-400" />
                <span>Project History</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Trust Score</span>
              </div>
            </div>
          </div>

          {/* Trust Levels */}
          <div className="p-5 rounded-xl bg-card border border-border mb-8">
            <h3 className="font-semibold text-foreground mb-4">Trust Levels</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-sm text-foreground">Anonymous</span>
                </div>
                <span className="text-xs text-muted-foreground">No verification</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <span className="text-sm text-foreground">Social Verified</span>
                </div>
                <span className="text-xs text-muted-foreground">Linked socials</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-sm text-foreground">KYC Verified</span>
                </div>
                <span className="text-xs text-muted-foreground">Identity confirmed</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm text-foreground font-medium">Fully Doxxed</span>
                </div>
                <span className="text-xs text-primary">Maximum trust</span>
              </div>
            </div>
          </div>

          {/* Coming Soon CTA */}
          <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              This feature is currently in development
            </p>
            <div className="flex items-center justify-center gap-2 text-green-400">
              <span className="text-sm font-medium">Stay tuned for updates</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KYD;
