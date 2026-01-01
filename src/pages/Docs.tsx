import {
  BookOpen, 
  ChevronRight, 
  Coins,
  Trophy,
  Flame,
  Users,
  HelpCircle,
  Rocket,
  Plus, 
  Minus,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DocContent } from "@/components/docs/DocContent";
import { docContent, DocItem } from "@/components/docs/DocContentData";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItem = ({ question, answer, isOpen, onToggle }: FAQItemProps) => {
  return (
    <div className="border-b-2 border-border last:border-0">
      <button
        onClick={onToggle}
        className="py-4 w-full flex items-center justify-between focus:outline-none"
      >
        <span className="font-pixel text-[10px] text-left text-foreground">{question}</span>
        {isOpen ? (
          <Minus className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
        ) : (
          <Plus className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
        )}
      </button>
      <div
        className={cn(
          "pb-4 text-sm text-muted-foreground text-left font-mono",
          isOpen ? "block" : "hidden"
        )}
      >
        {answer}
      </div>
    </div>
  );
};

const DocLink = ({ title, onClick }: { title: string; onClick: () => void }) => {
  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-between w-full p-3 border-2 border-border hover:border-primary transition-colors text-left bg-background"
    >
      <span className="font-pixel text-[9px] text-foreground">{title}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};

const categoryConfig = {
  'getting-started': { 
    icon: Rocket, 
    label: 'Getting Started', 
    description: 'Learn the basics of Pumpad and how to get started with our platform.',
    color: 'text-pink-400'
  },
  'staking': { 
    icon: Coins, 
    label: 'Staking', 
    description: 'Understand how staking works and create your own staking pools.',
    color: 'text-green-400'
  },
  'race': { 
    icon: Trophy, 
    label: 'Race', 
    description: 'Competitive holder rewards based on token accumulation.',
    color: 'text-yellow-400'
  },
  'burn': { 
    icon: Flame, 
    label: 'Burn', 
    description: 'Gamified burn-to-earn mechanics with 50/50 odds.',
    color: 'text-orange-400'
  },
  'social-farming': { 
    icon: Users, 
    label: 'Social Farming', 
    description: 'Earn rewards through social media engagement.',
    color: 'text-purple-400'
  },
  'faq': { 
    icon: HelpCircle, 
    label: 'FAQ', 
    description: 'Find answers to common questions about Pumpad.',
    color: 'text-cyan-400'
  },
};

const Docs = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>("getting-started");
  const isMobile = useIsMobile();

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleDocSelect = (docId: string) => {
    const doc = docContent.find(doc => doc.id === docId);
    if (doc) {
      setSelectedDoc(doc);
    }
  };

  const handleBackToTopics = () => {
    setSelectedDoc(null);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const faqItems = [
    {
      question: "What is Pumpad?",
      answer:
        "Pumpad is the complete utility suite for Solana tokens. It provides four core utilities: Staking, Race, Burn, and Social Farming - all designed to help token projects engage their community and reward holders.",
    },
    {
      question: "How do I create a pool?",
      answer:
        "Navigate to Home, select your desired utility tab (Staking, Race, Burn, or Social Farming), connect your wallet, and click the 'Create' button. Follow the guided process to set up your pool.",
    },
    {
      question: "What tokens can I use?",
      answer:
        "You can use any SPL token on Solana. Your token must have valid on-chain metadata. Simply enter your token contract address when creating a pool.",
    },
    {
      question: "How are rewards calculated?",
      answer:
        "Rewards vary by utility type. Staking uses APR-based calculations, Race distributes prizes based on leaderboard rankings, Burn offers 50/50 odds for 2x returns, and Social Farming rewards proportional to engagement points.",
    },
    {
      question: "Are there any fees?",
      answer:
        "Creating pools requires a small SOL fee for transaction costs. Standard Solana network fees apply to all transactions. There are no additional fees for claiming rewards.",
    },
    {
      question: "Which wallets are supported?",
      answer:
        "Pumpad supports all major Solana wallets including Phantom, Solflare, and other Solana-compatible wallet adapters.",
    },
  ];

  const filteredDocs = docContent.filter(doc => doc.category === activeTab);
  const currentCategory = categoryConfig[activeTab as keyof typeof categoryConfig];
  const CategoryIcon = currentCategory?.icon || BookOpen;

  const categories = Object.entries(categoryConfig);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b-2 border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 flex items-center justify-center border-2 border-primary bg-primary/10">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="font-pixel text-xl text-foreground">DOCS</h1>
              <p className="text-sm text-muted-foreground font-mono">Complete guides for Pumpad</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {!selectedDoc ? (
          <>
            {/* Category Selector */}
            <div className="mb-6">
              <Select value={activeTab} onValueChange={handleTabChange}>
                <SelectTrigger className="w-full sm:w-64 border-2 border-border bg-background font-pixel text-[10px]">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(([key, config]) => (
                    <SelectItem key={key} value={key} className="font-pixel text-[10px]">
                      <div className="flex items-center gap-2">
                        <config.icon className={cn("h-4 w-4", config.color)} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content Card */}
            <div className="border-2 border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className={cn("w-10 h-10 border-2 border-border flex items-center justify-center", currentCategory?.color ? `bg-${currentCategory.color.replace('text-', '')}/10` : 'bg-primary/10')}>
                  <CategoryIcon className={cn("h-5 w-5", currentCategory?.color)} />
                </div>
                <div>
                  <h3 className="font-pixel text-sm text-foreground">{currentCategory?.label}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{currentCategory?.description}</p>
                </div>
              </div>

              {activeTab !== "faq" ? (
                <div className="space-y-2">
                  {filteredDocs.map((doc) => (
                    <DocLink 
                      key={doc.id} 
                      title={doc.title} 
                      onClick={() => handleDocSelect(doc.id)} 
                    />
                  ))}
                  {filteredDocs.length === 0 && (
                    <p className="font-pixel text-[10px] text-muted-foreground py-4 text-center">
                      No documentation available for this category yet.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {faqItems.map((faq, index) => (
                    <FAQItem
                      key={index}
                      question={faq.question}
                      answer={faq.answer}
                      isOpen={openIndex === index}
                      onToggle={() => toggleFAQ(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t-2 border-border text-center">
              <p className="font-pixel text-[9px] text-muted-foreground">
                Need more help?{" "}
                <a 
                  href="https://t.me/pumpadchat" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:underline"
                >
                  Contact Support
                </a>
              </p>
            </div>
          </>
        ) : (
          <DocContent 
            title={selectedDoc.title}
            content={selectedDoc.content}
            onBack={handleBackToTopics}
          />
        )}
      </main>
    </div>
  );
};

export default Docs;