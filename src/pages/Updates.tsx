import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Newspaper, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

interface TweetUpdate {
  id: string;
  tweet_url: string;
  image_url: string | null;
  created_at: string;
  is_active: boolean;
}

interface TweetData {
  authorName: string;
  authorUrl: string;
  text: string;
  html: string;
  url: string;
}

interface TweetWithData extends TweetUpdate {
  tweetData?: TweetData;
  isLoading?: boolean;
  error?: string;
}

const TweetCard: React.FC<{ tweet: TweetWithData }> = ({ tweet }) => {
  const [imageError, setImageError] = useState(false);

  if (tweet.isLoading) {
    return (
      <div className="border-2 border-border bg-card overflow-hidden animate-pulse">
        <div className="h-48 bg-muted/50" />
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted" />
              <div className="h-3 w-16 bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-muted" />
            <div className="h-3 w-3/4 bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const { tweetData } = tweet;
  const hasImage = tweet.image_url && !imageError;

  return (
    <div className="border-2 border-border bg-card hover:border-primary transition-all overflow-hidden group">
      {/* Image */}
      {hasImage && (
        <a 
          href={tweet.tweet_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block relative overflow-hidden"
        >
          <div className="aspect-video bg-muted/30 relative">
            <img 
              src={tweet.image_url!} 
              alt="Tweet media"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImageError(true)}
            />
          </div>
        </a>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary bg-primary/10 flex items-center justify-center">
              <span className="font-pixel text-sm text-primary">
                {tweetData?.authorName?.charAt(0) || 'P'}
              </span>
            </div>
            <div>
              <a 
                href={tweetData?.authorUrl || tweet.tweet_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-pixel text-[10px] text-foreground hover:text-primary transition-colors block"
              >
                {tweetData?.authorName || 'PUMPAD'}
              </a>
              <p className="font-mono text-[10px] text-muted-foreground">
                {format(new Date(tweet.created_at), 'MMM d · h:mm a')}
              </p>
            </div>
          </div>
          <a 
            href={tweet.tweet_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 border-2 border-border hover:border-primary transition-colors"
            title="View on X"
          >
            <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>

        {/* Tweet Text */}
        {tweetData?.text && (
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mb-3">
            {tweetData.text}
          </p>
        )}

        {/* Footer */}
        <a 
          href={tweet.tweet_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-pixel text-[8px] text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          VIEW ON X
        </a>
      </div>
    </div>
  );
};

const Updates: React.FC = () => {
  const [tweets, setTweets] = useState<TweetWithData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchTweets();
  }, []);

  const fetchTweetData = async (tweetUrl: string): Promise<TweetData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-tweet', {
        body: { tweetUrl }
      });

      if (error) throw error;
      if (data?.success) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching tweet data:', error);
      return null;
    }
  };

  const fetchTweets = async () => {
    try {
      const { data, error } = await supabase
        .from('tweet_updates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const initialTweets: TweetWithData[] = (data || []).map(tweet => ({
        ...tweet,
        isLoading: true
      }));
      setTweets(initialTweets);
      setIsLoading(false);

      const tweetPromises = initialTweets.map(tweet => fetchTweetData(tweet.tweet_url));
      const tweetDataResults = await Promise.all(tweetPromises);
      
      setTweets(prev => prev.map((t, index) => ({
        ...t,
        tweetData: tweetDataResults[index] || undefined,
        isLoading: false,
        error: tweetDataResults[index] ? undefined : 'Failed to load'
      })));
    } catch (error) {
      console.error('Error fetching tweets:', error);
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTweets();
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b-2 border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 flex items-center justify-center border-2 border-primary bg-primary/10">
                <Newspaper className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="font-pixel text-xl text-foreground">NEWS</h1>
                <p className="text-sm text-muted-foreground font-mono">Latest from @_pumpad</p>
              </div>
            </div>
            
            {tweets.length > 0 && (
              <Button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="font-pixel text-[10px] border-2 border-border bg-background hover:border-primary hover:bg-primary/10"
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                REFRESH
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tweets.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border">
            <div className="w-16 h-16 mx-auto mb-4 border-2 border-border flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground/50" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <h3 className="font-pixel text-sm text-foreground mb-2">NO UPDATES YET</h3>
            <p className="text-muted-foreground text-sm">
              Check back soon for the latest announcements.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tweets.map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Updates;