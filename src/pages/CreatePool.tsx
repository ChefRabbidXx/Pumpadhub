import React, { useState } from "react";
import { Layers, Trophy, Flame, Users, ChevronRight, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import CreatePoolForm from "@/components/pool/CreatePoolForm";
import { CreateRaceModal } from "@/components/race/CreateRaceModal";
import { CreateBurnPoolModal } from "@/components/burn/CreateBurnPoolModal";
import { CreateSocialFarmingModal } from "@/components/farming/CreateSocialFarmingModal";
import { LaunchTokenForm } from "@/components/safu/LaunchTokenForm";

type FeatureType = "safu" | "staking" | "race" | "burn" | "social" | null;

const features = [
  {
    id: "safu" as const,
    icon: Rocket,
    label: "Safu Launch",
    description: "Submit a token idea for community funding",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20 hover:border-green-500/40",
  },
  {
    id: "staking" as const,
    icon: Layers,
    label: "Staking Pool",
    description: "Create a staking pool where users can stake tokens and earn APR rewards",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20 hover:border-primary/40",
  },
  {
    id: "race" as const,
    icon: Trophy,
    label: "Token Race",
    description: "Run competitive holder races where top holders win prizes each round",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20 hover:border-primary/40",
  },
  {
    id: "burn" as const,
    icon: Flame,
    label: "Burn Pool",
    description: "Gamified burn mechanism with 50/50 odds to win 2x your burned tokens",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20 hover:border-orange-500/40",
  },
  {
    id: "social" as const,
    icon: Users,
    label: "Social Farming",
    description: "Reward users for social media engagement like follows, likes, and shares",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20 hover:border-yellow-500/40",
  },
];

const CreatePool = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedFeature, setSelectedFeature] = useState<FeatureType>(null);

  // Modal states
  const [isStakingModalOpen, setIsStakingModalOpen] = useState(false);
  const [isRaceModalOpen, setIsRaceModalOpen] = useState(false);
  const [isBurnModalOpen, setIsBurnModalOpen] = useState(false);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);

  // Auto-select SAFU if tab=safu in URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "safu") {
      setSelectedFeature("safu");
    }
  }, [searchParams]);

  const handleFeatureSelect = (featureId: FeatureType) => {
    if (featureId === "safu") {
      setSelectedFeature("safu");
    } else if (featureId === "staking") {
      setIsStakingModalOpen(true);
    } else if (featureId === "race") {
      setIsRaceModalOpen(true);
    } else if (featureId === "burn") {
      setIsBurnModalOpen(true);
    } else if (featureId === "social") {
      setIsSocialModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setSelectedFeature(null);
  };

  const handlePoolCreated = () => {
    navigate("/");
  };

  const handleBackToSelection = () => {
    setSelectedFeature(null);
  };

  return (
    <div className="bg-background">
      <main className="pb-20 md:pb-0">
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
          
          {selectedFeature === "safu" ? (
            <LaunchTokenForm onBack={handleBackToSelection} />
          ) : (
            // Feature Selection
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2">Select Feature Type</h2>
                <p className="text-muted-foreground text-sm">
                  Choose which type of pool you want to create for your token
                </p>
              </div>

              <div className="space-y-3">
                {features.map((feature) => (
                  <Card
                    key={feature.id}
                    onClick={() => handleFeatureSelect(feature.id)}
                    className={cn(
                      "p-4 cursor-pointer transition-all border-2",
                      feature.borderColor
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("p-3 rounded-lg", feature.bgColor)}>
                        <feature.icon className={cn("h-6 w-6", feature.color)} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-0.5">{feature.label}</h3>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreatePoolForm 
        open={isStakingModalOpen} 
        onClose={() => {
          setIsStakingModalOpen(false);
          handleModalClose();
        }}
        onSave={() => {
          setIsStakingModalOpen(false);
          handlePoolCreated();
        }}
      />
      <CreateRaceModal
        open={isRaceModalOpen}
        onOpenChange={(open) => {
          setIsRaceModalOpen(open);
          if (!open) handleModalClose();
        }}
        onRaceCreated={handlePoolCreated}
      />
      <CreateBurnPoolModal
        open={isBurnModalOpen}
        onOpenChange={(open) => {
          setIsBurnModalOpen(open);
          if (!open) handleModalClose();
        }}
        onPoolCreated={handlePoolCreated}
      />
      <CreateSocialFarmingModal
        open={isSocialModalOpen}
        onOpenChange={(open) => {
          setIsSocialModalOpen(open);
          if (!open) handleModalClose();
        }}
        onPoolCreated={handlePoolCreated}
      />
    </div>
  );
};

export default CreatePool;
