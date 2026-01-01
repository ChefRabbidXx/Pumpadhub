import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock as LockIcon, Clock, Shield, Search } from "lucide-react";
import { useState } from "react";

const Lock = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  // No locked tokens - feature coming soon
  const lockedTokens: any[] = [];

  return (
    <div className="min-h-screen bg-background">
      <div className="pb-6">
        
        {/* Lock Hero Section */}
        <div className="relative overflow-hidden border-b border-green-500/20 bg-gradient-to-b from-green-500/10 via-black to-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0a0a0a_1px,transparent_1px),linear-gradient(to_bottom,#0a0a0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000,transparent)]" />
          
          <div className="container max-w-screen-2xl mx-auto px-4 py-12 relative">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="relative">
                <LockIcon className="h-12 w-12 text-green-500 animate-pulse" />
                <div className="absolute inset-0 blur-xl bg-green-500/30 animate-pulse" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-center mb-3 text-white tracking-tight">
              Token <span className="text-green-500">Lock</span>
            </h1>
            <p className="text-center text-gray-400 text-lg max-w-2xl mx-auto mb-6">
              Secure your tokens with time-locked contracts. Build trust through verified token locks.
            </p>
            <div className="flex justify-center">
              <Button
                className="h-11 px-8 bg-green-600 text-white hover:bg-green-700 font-light"
              >
                <LockIcon className="mr-2 h-4 w-4" />
                Lock Tokens
              </Button>
            </div>
          </div>
        </div>
        
        <div className="container max-w-screen-2xl mx-auto px-4 mt-8">

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="crypto-card border-purple-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Locked Value</p>
                  <p className="text-2xl font-bold text-purple-400">$0</p>
                </div>
                <div className="bg-purple-500/20 p-3 rounded-full">
                  <LockIcon className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </Card>
            
            <Card className="crypto-card border-purple-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Locked Tokens</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div className="bg-purple-500/20 p-3 rounded-full">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </Card>
            
            <Card className="crypto-card border-purple-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Lock %</p>
                  <p className="text-2xl font-bold">0%</p>
                </div>
                <div className="bg-purple-500/20 p-3 rounded-full">
                  <Clock className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tokens by name or symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-purple-500/20 focus:border-purple-500/40"
              />
            </div>
          </div>

          {/* Locked Tokens Table */}
          <Card className="crypto-card border-purple-500/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-purple-500/20">
                  <tr className="text-left">
                    <th className="p-4 text-muted-foreground font-medium">Token</th>
                    <th className="p-4 text-muted-foreground font-medium">Locked Amount</th>
                    <th className="p-4 text-muted-foreground font-medium">Lock %</th>
                    <th className="p-4 text-muted-foreground font-medium">Locked Value</th>
                    <th className="p-4 text-muted-foreground font-medium">Lock Type</th>
                    <th className="p-4 text-muted-foreground font-medium">Unlock Date</th>
                    <th className="p-4 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lockedTokens.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <div className="flex flex-col items-center justify-center py-8">
                          <LockIcon className="h-12 w-12 text-purple-500/30 mb-4" />
                          <p className="text-muted-foreground mb-2">No locked tokens found</p>
                          <p className="text-sm text-muted-foreground">Lock your tokens to build trust and transparency</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    lockedTokens
                      .filter((token) =>
                        token.tokenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((token) => (
                      <tr 
                        key={token.id} 
                        className="border-b border-purple-500/20 hover:bg-purple-500/5 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={token.logo} 
                              alt={token.tokenName} 
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/30"
                            />
                            <div>
                              <p className="font-semibold">{token.tokenName}</p>
                              <p className="text-sm text-muted-foreground">${token.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{token.lockedAmount}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-purple-400 font-bold">{token.lockPercentage}%</span>
                            <LockIcon className="w-4 h-4 text-purple-400" />
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-purple-400">{token.lockedValue}</p>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                            {token.lockType}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <p className="text-sm">{token.unlockDate}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/50">
                            {token.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Lock;
