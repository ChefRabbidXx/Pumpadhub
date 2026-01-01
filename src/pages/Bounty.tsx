import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bug, Image, Send, Clock, Check, X, ExternalLink, Loader2 } from "lucide-react";
import { formatWalletAddress } from "@/utils/wallet-utils";
import { LoadingIndicator } from "@/components/submit-token/LoadingIndicator";
import { useLoadingState } from "@/utils/loading-utils";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";

interface BountySubmission {
  id: string;
  wallet_address: string;
  title: string;
  description: string;
  severity: string;
  image_url: string | null;
  status: string;
  reward_amount: number;
  admin_response: string | null;
  tx_hash: string | null;
  created_at: string;
}

const Bounty = () => {
  const { walletAddress, connected } = useWallet();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "",
    imageUrl: "",
  });
  
  const { 
    isLoading: isSubmitting, 
    startLoading: startSubmitting, 
    stopLoading: stopSubmitting 
  } = useLoadingState(false);
  
  const { 
    isLoading: isLoadingSubmissions, 
    startLoading: startLoadingSubmissions, 
    stopLoading: stopLoadingSubmissions 
  } = useLoadingState(false);
  
  const [mySubmissions, setMySubmissions] = useState<BountySubmission[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  useEffect(() => {
    loadUserSubmissions();
  }, [walletAddress]);
  
  const loadUserSubmissions = async () => {
    if (!walletAddress) {
      stopLoadingSubmissions();
      setMySubmissions([]);
      return;
    }
    
    startLoadingSubmissions();
    
    try {
      const { data, error } = await supabase
        .from('bounty_submissions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMySubmissions(data || []);
    } catch (error) {
      console.error("Error loading submissions:", error);
      toast({
        title: "Error",
        description: "Failed to load your submissions. Please try again.",
        variant: "destructive",
      });
    } finally {
      stopLoadingSubmissions();
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSeverityChange = (value: string) => {
    setFormData((prev) => ({ ...prev, severity: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const imageUrl = URL.createObjectURL(file);
    setPreviewImage(imageUrl);
    setSelectedFile(file);
    
    setFormData(prev => ({ ...prev, imageUrl: file.name }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to submit a bug report.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.title || !formData.description || !formData.severity) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    startSubmitting();
    
    try {
      let imageUrl: string | null = null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${walletAddress}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('bounty-screenshots')
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('bounty-screenshots')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('bounty_submissions')
        .insert({
          wallet_address: walletAddress,
          title: formData.title,
          description: formData.description,
          severity: formData.severity,
          image_url: imageUrl,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      
      setMySubmissions(prev => [data, ...prev]);
      
      toast({
        title: "Bug Report Submitted",
        description: "Your report has been submitted and is pending review.",
      });
      
      setFormData({
        title: "",
        description: "",
        severity: "",
        imageUrl: "",
      });
      setPreviewImage(null);
      setSelectedFile(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error submitting bug report:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your bug report. Please try again.",
        variant: "destructive",
      });
    } finally {
      stopSubmitting();
    }
  };
  
  const getSolanaExplorerUrl = (txHash: string) => {
    return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <div className="inline-flex items-center px-2 py-1 font-pixel text-[7px] bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
            <Clock className="w-3 h-3 mr-1" />
            PENDING
          </div>
        );
      case "approved":
        return (
          <div className="inline-flex items-center px-2 py-1 font-pixel text-[7px] bg-green-400/20 text-green-400 border border-green-400/30">
            <Check className="w-3 h-3 mr-1" />
            APPROVED
          </div>
        );
      case "rejected":
        return (
          <div className="inline-flex items-center px-2 py-1 font-pixel text-[7px] bg-red-400/20 text-red-400 border border-red-400/30">
            <X className="w-3 h-3 mr-1" />
            REJECTED
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center px-2 py-1 font-pixel text-[7px] bg-muted text-muted-foreground">
            {status}
          </div>
        );
    }
  };
  
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "normal":
        return (
          <div className="inline-flex items-center px-2 py-1 font-pixel text-[7px] bg-blue-400/20 text-blue-400 border border-blue-400/30">
            NORMAL
          </div>
        );
      case "major":
        return (
          <div className="inline-flex items-center px-2 py-1 font-pixel text-[7px] bg-purple-400/20 text-purple-400 border border-purple-400/30">
            MAJOR
          </div>
        );
      case "critical":
        return (
          <div className="inline-flex items-center px-2 py-1 font-pixel text-[7px] bg-red-400/20 text-red-400 border border-red-400/30">
            CRITICAL
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b-2 border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 flex items-center justify-center border-2 border-red-400 bg-red-400/10">
              <Bug className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h1 className="font-pixel text-xl text-foreground">BUG BOUNTY</h1>
              <p className="text-sm text-muted-foreground font-mono">Report bugs, earn $PUMPAD rewards</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Report Form */}
          <div className="border-2 border-border bg-card p-6">
            <div className="flex items-center mb-6">
              <Bug className="mr-2 h-5 w-5 text-red-400" />
              <h3 className="font-pixel text-sm text-foreground">REPORT A BUG</h3>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label className="font-pixel text-[9px] text-muted-foreground">BUG TITLE</Label>
                  <Input
                    name="title"
                    placeholder="Brief description of the issue"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="border-2 border-border bg-background font-mono text-sm"
                  />
                </div>
                
                <div>
                  <Label className="font-pixel text-[9px] text-muted-foreground">DESCRIPTION</Label>
                  <Textarea
                    name="description"
                    placeholder="Please provide steps to reproduce and any relevant details"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="min-h-[120px] border-2 border-border bg-background font-mono text-sm"
                  />
                </div>
                
                <div>
                  <Label className="font-pixel text-[9px] text-muted-foreground">SEVERITY LEVEL</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={handleSeverityChange}
                  >
                    <SelectTrigger className="border-2 border-border bg-background font-pixel text-[10px]">
                      <SelectValue placeholder="Select severity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal" className="font-pixel text-[10px]">Normal</SelectItem>
                      <SelectItem value="major" className="font-pixel text-[10px]">Major</SelectItem>
                      <SelectItem value="critical" className="font-pixel text-[10px]">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="font-pixel text-[9px] text-muted-foreground">SCREENSHOT (optional)</Label>
                  <div className="mt-1 flex items-center">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-border font-pixel text-[10px]"
                    >
                      <Image className="mr-2 h-4 w-4" />
                      UPLOAD IMAGE
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    {formData.imageUrl && (
                      <span className="ml-3 font-mono text-xs text-primary">
                        {formData.imageUrl}
                      </span>
                    )}
                  </div>
                  
                  {previewImage && (
                    <div className="mt-3 relative">
                      <div className="relative border-2 border-border overflow-hidden">
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="w-full h-auto max-h-48 object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 font-pixel text-[8px]"
                          onClick={() => {
                            setPreviewImage(null);
                            setFormData(prev => ({ ...prev, imageUrl: "" }));
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                        >
                          REMOVE
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !connected}
                    className="w-full bg-red-400 hover:bg-red-500 text-primary-foreground font-pixel text-[10px] border-2 border-red-400"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        SUBMITTING...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        SUBMIT BUG REPORT
                      </>
                    )}
                  </Button>
                  
                  {!connected && (
                    <p className="font-pixel text-[8px] text-red-400 mt-2 text-center">
                      Please connect your wallet to submit a bug report.
                    </p>
                  )}
                </div>
              </div>
            </form>
          </div>
          
          {/* Reward Levels & Submissions */}
          <div className="space-y-6">
            <div className="border-2 border-border bg-card p-6">
              <h3 className="font-pixel text-sm text-foreground mb-4">REWARD LEVELS</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 border-2 border-blue-400 bg-blue-400/10 flex items-center justify-center shrink-0">
                    <Bug className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-[10px] text-foreground">NORMAL</h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      Minor issues, UI glitches, non-critical errors
                    </p>
                    <p className="font-pixel text-[9px] text-green-400 mt-1">
                      5,000 - 10,000 $PUMPAD
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 border-2 border-purple-400 bg-purple-400/10 flex items-center justify-center shrink-0">
                    <Bug className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-[10px] text-foreground">MAJOR</h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      Functional issues, performance problems
                    </p>
                    <p className="font-pixel text-[9px] text-green-400 mt-1">
                      15,000 - 25,000 $PUMPAD
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 border-2 border-red-400 bg-red-400/10 flex items-center justify-center shrink-0">
                    <Bug className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-[10px] text-foreground">CRITICAL</h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      Security vulnerabilities, data issues
                    </p>
                    <p className="font-pixel text-[9px] text-green-400 mt-1">
                      30,000 - 50,000 $PUMPAD
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* My Submissions */}
            {connected && mySubmissions.length > 0 && (
              <div className="border-2 border-border bg-card p-6">
                <h3 className="font-pixel text-sm text-foreground mb-4">MY SUBMISSIONS</h3>
                <div className="space-y-3">
                  {mySubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="p-3 border-2 border-border bg-background"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-pixel text-[9px] text-foreground">{submission.title}</h4>
                        {getStatusBadge(submission.status)}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {getSeverityBadge(submission.severity)}
                        
                        {submission.status === "approved" && submission.reward_amount > 0 && (
                          <span className="font-pixel text-[8px] text-green-400">
                            +{submission.reward_amount.toLocaleString()} $PUMPAD
                          </span>
                        )}
                      </div>

                      {submission.admin_response && (
                        <div className="mt-2 p-2 border border-border bg-muted/20">
                          <p className="font-pixel text-[8px] text-muted-foreground mb-1">ADMIN RESPONSE:</p>
                          <p className="text-xs text-foreground font-mono">{submission.admin_response}</p>
                        </div>
                      )}

                      {submission.tx_hash && (
                        <a
                          href={getSolanaExplorerUrl(submission.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 font-pixel text-[8px] text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          VIEW TX
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Image Dialog */}
      <Dialog open={!!viewImageUrl} onOpenChange={() => setViewImageUrl(null)}>
        <DialogContent className="max-w-3xl border-2 border-border">
          <DialogHeader>
            <DialogTitle className="font-pixel text-sm">SCREENSHOT</DialogTitle>
          </DialogHeader>
          {viewImageUrl && (
            <img src={viewImageUrl} alt="Bug screenshot" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bounty;