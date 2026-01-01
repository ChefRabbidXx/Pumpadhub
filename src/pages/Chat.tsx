import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { MessageCircle, Sparkles, Users } from "lucide-react";
import { useHolderBadges } from "@/hooks/use-holder-badges";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";

const PUMPAD_CONTRACT = "2FWWHi5NLVj6oXkAyWAtqjBZ6CNRCX8QM8yUtRVNpump";

interface ChatMessage {
  id: string;
  wallet_address: string;
  message: string;
  created_at: string;
  reply_to_id?: string | null;
}

interface Reaction {
  message_id: string;
  emoji: string;
  wallet_address: string;
}

interface Report {
  message_id: string;
  reporter_wallet: string;
}

interface DeleteVote {
  message_id: string;
  voter_wallet: string;
}

const Chat = () => {
  const { connected, walletAddress, connectWallet } = useWallet();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [deleteVotes, setDeleteVotes] = useState<DeleteVote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { balance: tokenBalance, loading: tokenLoading } = useTokenBalance(PUMPAD_CONTRACT);
  const isTokenHolder = tokenBalance > 0;

  const walletAddresses = useMemo(
    () => [...new Set(messages.map((m) => m.wallet_address))],
    [messages]
  );

  const { holders } = useHolderBadges(walletAddresses);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [messagesRes, reactionsRes, reportsRes, votesRes] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(200),
        supabase.from("chat_reactions").select("*"),
        supabase.from("chat_reports").select("*"),
        supabase.from("chat_delete_votes").select("*"),
      ]);

      if (messagesRes.data) setMessages(messagesRes.data);
      if (reactionsRes.data) setReactions(reactionsRes.data);
      if (reportsRes.data) setReports(reportsRes.data);
      if (votesRes.data) setDeleteVotes(votesRes.data);

      scrollToBottom("instant");
    };

    fetchData();

    const messagesChannel = supabase
      .channel("chat-messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    const reactionsChannel = supabase
      .channel("chat-reactions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_reactions" },
        () => {
          supabase.from("chat_reactions").select("*").then(({ data }) => {
            if (data) setReactions(data);
          });
        }
      )
      .subscribe();

    const reportsChannel = supabase
      .channel("chat-reports-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_reports" },
        () => {
          supabase.from("chat_reports").select("*").then(({ data }) => {
            if (data) setReports(data);
          });
        }
      )
      .subscribe();

    const votesChannel = supabase
      .channel("chat-votes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_delete_votes" },
        () => {
          supabase.from("chat_delete_votes").select("*").then(({ data }) => {
            if (data) setDeleteVotes(data);
          });
        }
      )
      .subscribe();

    const presenceChannel = supabase.channel("chat-presence");
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUsers(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user: walletAddress || "anonymous",
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(votesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [walletAddress, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const handleSendMessage = async (message: string, replyToId?: string) => {
    if (!connected || !walletAddress) {
      toast.error("Please connect your wallet to send messages");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("chat_messages").insert({
      wallet_address: walletAddress,
      message,
      reply_to_id: replyToId || null,
    });

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } else {
      setReplyingTo(null);
    }
    setIsLoading(false);
  };

  const handleSendGif = async (gifUrl: string, replyToId?: string) => {
    if (!connected || !walletAddress) {
      toast.error("Please connect your wallet to send GIFs");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("chat_messages").insert({
      wallet_address: walletAddress,
      message: `[GIF]${gifUrl}[/GIF]`,
      reply_to_id: replyToId || null,
    });

    if (error) {
      console.error("Error sending GIF:", error);
      toast.error("Failed to send GIF");
    } else {
      setReplyingTo(null);
    }
    setIsLoading(false);
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!walletAddress) {
      toast.error("Connect wallet to react");
      return;
    }

    const { error } = await supabase.from("chat_reactions").insert({
      message_id: messageId,
      wallet_address: walletAddress,
      emoji,
    });

    if (error && !error.message.includes("duplicate")) {
      toast.error("Failed to add reaction");
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    if (!walletAddress) return;

    await supabase
      .from("chat_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("wallet_address", walletAddress)
      .eq("emoji", emoji);
  };

  const handleReport = async (messageId: string) => {
    if (!walletAddress) {
      toast.error("Connect wallet to report");
      return;
    }

    const existingReport = reports.find(
      (r) => r.message_id === messageId && r.reporter_wallet === walletAddress
    );
    if (existingReport) {
      toast.error("You've already reported this message");
      return;
    }

    const { error } = await supabase.from("chat_reports").insert({
      message_id: messageId,
      reporter_wallet: walletAddress,
    });

    if (error) {
      toast.error("Failed to report message");
    } else {
      toast.success("Message reported");
    }
  };

  const handleVoteDelete = async (messageId: string) => {
    if (!walletAddress) {
      toast.error("Connect wallet to vote");
      return;
    }

    const { error } = await supabase.from("chat_delete_votes").insert({
      message_id: messageId,
      voter_wallet: walletAddress,
    });

    if (error) {
      toast.error("Failed to vote");
      return;
    }

    const votesForMessage = deleteVotes.filter((v) => v.message_id === messageId).length + 1;
    if (votesForMessage >= 3) {
      await supabase.from("chat_messages").delete().eq("id", messageId);
      toast.success("Message deleted by community");
    } else {
      toast.success(`Vote recorded (${votesForMessage}/3)`);
    }
  };

  const getMessageReactions = (messageId: string) => {
    const messageReactions = reactions.filter((r) => r.message_id === messageId);
    const grouped: Record<string, { count: number; hasReacted: boolean }> = {};

    messageReactions.forEach((r) => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { count: 0, hasReacted: false };
      }
      grouped[r.emoji].count++;
      if (r.wallet_address === walletAddress) {
        grouped[r.emoji].hasReacted = true;
      }
    });

    return Object.entries(grouped).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasReacted: data.hasReacted,
    }));
  };

  const uniqueWallets = new Set(messages.map((m) => m.wallet_address)).size;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background">
      {/* Gamified Header */}
      <div className="border-b-2 border-border bg-card/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center border-2 border-primary bg-primary/10">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-pixel text-sm text-foreground">PUMPAD CHAT</h1>
              <p className="font-pixel text-[8px] text-muted-foreground">Community discussion</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 animate-pulse" />
              <span className="font-pixel text-[8px] text-green-400">{onlineUsers} ONLINE</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="font-pixel text-[8px] text-muted-foreground">{uniqueWallets} USERS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
            <div className="p-6 border-2 border-border bg-card mb-4">
              <MessageCircle className="h-12 w-12 opacity-50" />
            </div>
            <p className="font-pixel text-sm text-foreground">NO MESSAGES YET</p>
            <p className="font-pixel text-[8px] text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Be the first to start the conversation
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.wallet_address === walletAddress;
            const holderInfo = holders[msg.wallet_address];
            const replyToMessage = msg.reply_to_id
              ? messages.find((m) => m.id === msg.reply_to_id)
              : undefined;
            const isReported = reports.some((r) => r.message_id === msg.id);
            const msgDeleteVotes = deleteVotes.filter((v) => v.message_id === msg.id);
            const hasVotedToDelete = msgDeleteVotes.some((v) => v.voter_wallet === walletAddress);
            const isHighlighted = highlightedMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`transition-all duration-300 ${isHighlighted ? 'ring-2 ring-primary bg-primary/5' : ''}`}
              >
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  holderInfo={holderInfo}
                  walletAddress={walletAddress}
                  onReply={setReplyingTo}
                  replyToMessage={replyToMessage}
                  reactions={getMessageReactions(msg.id)}
                  isReported={isReported}
                  deleteVotes={msgDeleteVotes.length}
                  hasVotedToDelete={hasVotedToDelete}
                  onAddReaction={handleAddReaction}
                  onRemoveReaction={handleRemoveReaction}
                  onReport={handleReport}
                  onVoteDelete={handleVoteDelete}
                  onScrollToMessage={scrollToMessage}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput
        connected={connected}
        isLoading={isLoading}
        replyingTo={replyingTo}
        onSendMessage={handleSendMessage}
        onSendGif={handleSendGif}
        onCancelReply={() => setReplyingTo(null)}
        onConnectWallet={connectWallet}
        isTokenHolder={isTokenHolder}
        tokenLoading={tokenLoading}
      />
    </div>
  );
};

export default Chat;