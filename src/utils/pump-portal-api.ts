
import { TokenMetadata } from './token-data';
import { formatWalletAddress } from './wallet-utils';

// Interface for the WebSocket response from PumpPortal
interface TokenResponse {
  ca: string; // Contract address
  name: string;
  symbol: string;
  supply: number;
  holders: number;
  volume: number;
  price: number;
  marketCap: number;
  tradable: boolean;
  createdAt: number; // Timestamp
  lastTradeAt?: number; // Timestamp
}

// Interface for the token creation WebSocket event
export interface TokenCreationEvent {
  signature: string;
  mint: string; // Contract address
  name: string;
  symbol: string;
  marketCapSol: number;
  vTokensInBondingCurve: number;
  vSolInBondingCurve: number;
  initialBuy: number;
  solAmount: number;
  uri: string;
  pool: string;
  traderPublicKey: string;
  txType: string;
  bondingCurveKey: string;
}

let websocketInstance: WebSocket | null = null;
let subscribedToCreation = false;

/**
 * Subscribe to new token creation events from PumpPortal
 * @param callback The callback function that receives token creation events
 */
export const subscribeToTokenCreation = (callback: (event: TokenCreationEvent) => void): void => {
  console.log('Subscribing to token creation events');
  
  if (!websocketInstance || websocketInstance.readyState !== WebSocket.OPEN) {
    websocketInstance = new WebSocket('wss://pumpportal.fun/api/data');
    
    websocketInstance.onopen = () => {
      console.log('PumpPortal WebSocket connected');
      
      // Subscribe to token creation events
      const payload = {
        method: "subscribeNewToken",
      };
      
      websocketInstance?.send(JSON.stringify(payload));
      subscribedToCreation = true;
    };
    
    websocketInstance.onerror = (error) => {
      console.error('PumpPortal WebSocket error:', error);
    };
    
    websocketInstance.onclose = () => {
      console.log('PumpPortal WebSocket connection closed');
      subscribedToCreation = false;
      websocketInstance = null;
    };
  } else if (!subscribedToCreation) {
    // Subscribe to token creation events if we're connected but not subscribed
    const payload = {
      method: "subscribeNewToken",
    };
    
    websocketInstance.send(JSON.stringify(payload));
    subscribedToCreation = true;
  }
  
  // Set up the message handler
  websocketInstance.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data as string);
      console.log('PumpPortal message received:', response);
      
      // Check if this is a token creation event (has mint and signature fields)
      if (response && response.mint && response.signature) {
        callback(response as TokenCreationEvent);
      }
    } catch (error) {
      console.error('Error parsing PumpPortal message:', error);
    }
  };
};

/**
 * Fetches token data from PumpPortal WebSocket API
 * @param tokenAddress The token address to fetch data for
 * @returns A Promise that resolves to TokenMetadata
 */
export const fetchTokenFromPumpPortal = (tokenAddress: string): Promise<TokenMetadata> => {
  return new Promise((resolve, reject) => {
    console.log('Connecting to PumpPortal API for token:', tokenAddress);
    
    try {
      // Create WebSocket connection
      const ws = new WebSocket('wss://pumpportal.fun/api/data');
      
      // Set timeout for connection (10 seconds)
      const connectionTimeout = setTimeout(() => {
        console.error('WebSocket connection timeout');
        ws.close();
        
        // Return fallback data if connection times out
        const today = new Date().toISOString().split('T')[0];
        resolve({
          tokenName: `Unknown Token (${formatWalletAddress(tokenAddress, 4)})`,
          tokenSymbol: "???",
          totalSupply: "Unknown",
          price: 0.0000001,
          marketCap: 1000,
          holders: 10,
          volume: 100,
          status: "Pre-Raydium",
          createdAt: today,
          lastActivity: today
        });
      }, 10000);
      
      // Handle WebSocket events
      ws.onopen = () => {
        console.log('WebSocket connection established');
        
        // Request token data
        const payload = {
          method: "getToken",
          key: tokenAddress
        };
        
        ws.send(JSON.stringify(payload));
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(connectionTimeout);
        
        // Return fallback data if there's an error
        const today = new Date().toISOString().split('T')[0];
        resolve({
          tokenName: `Unknown Token (${formatWalletAddress(tokenAddress, 4)})`,
          tokenSymbol: "???",
          totalSupply: "Unknown",
          price: 0.0000001,
          marketCap: 1000,
          holders: 10,
          volume: 100,
          status: "Pre-Raydium",
          createdAt: today,
          lastActivity: today
        });
        
        ws.close();
      };
      
      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data as string);
          console.log('WebSocket response:', response);
          
          // Check if the response contains token data
          if (response && response.data) {
            clearTimeout(connectionTimeout);
            
            const tokenData = response.data as TokenResponse;
            
            // Convert timestamps to date strings
            const createdAt = tokenData.createdAt 
              ? new Date(tokenData.createdAt * 1000).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0];
              
            const lastActivity = tokenData.lastTradeAt 
              ? new Date(tokenData.lastTradeAt * 1000).toISOString().split('T')[0]
              : createdAt;
            
            // Determine if the token is on Raydium (this is an approximation)
            // In a real scenario, we'd need to check with Raydium's API
            const isOnRaydium = tokenData.tradable;
            
            // Format the total supply
            const formattedSupply = tokenData.supply 
              ? tokenData.supply.toLocaleString() 
              : "Unknown";
            
            // Convert data to our TokenMetadata format
            const metadata: TokenMetadata = {
              tokenName: tokenData.name || `Token ${formatWalletAddress(tokenAddress, 6)}`,
              tokenSymbol: tokenData.symbol || tokenAddress.substring(0, 4).toUpperCase(),
              totalSupply: formattedSupply,
              price: tokenData.price || 0.0000001,
              marketCap: tokenData.marketCap || (tokenData.price * tokenData.supply) || 1000,
              holders: tokenData.holders || 10,
              volume: tokenData.volume || 100,
              status: isOnRaydium ? "On Raydium" : "Pre-Raydium",
              createdAt,
              lastActivity
            };
            
            resolve(metadata);
            ws.close();
          } else if (response && response.mint && response.signature) {
            // This is a token creation event (new token) - convert to our metadata format
            const creationEvent = response as TokenCreationEvent;
            clearTimeout(connectionTimeout);
            
            // Convert current timestamp to date string
            const now = new Date().toISOString().split('T')[0];
            
            // Convert data to our TokenMetadata format
            const metadata: TokenMetadata = {
              tokenName: creationEvent.name || `Token ${formatWalletAddress(tokenAddress, 6)}`,
              tokenSymbol: creationEvent.symbol || tokenAddress.substring(0, 4).toUpperCase(),
              totalSupply: creationEvent.vTokensInBondingCurve.toLocaleString(),
              price: creationEvent.solAmount / creationEvent.initialBuy,
              marketCap: creationEvent.marketCapSol * getSOLPrice(),
              holders: 1, // New token has at least 1 holder (creator)
              volume: creationEvent.solAmount * getSOLPrice(),
              status: "Pre-Raydium", // New tokens on pump.fun are pre-Raydium
              createdAt: now,
              lastActivity: now
            };
            
            resolve(metadata);
            ws.close();
          }
        } catch (error) {
          console.error('Error parsing WebSocket response:', error);
          
          // Don't reject here, wait for the timeout
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        clearTimeout(connectionTimeout);
      };
      
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      reject(error);
    }
  });
};

// Helper function to get the SOL price in USD (would ideally call a price oracle)
function getSOLPrice(): number {
  return 148.35; // Current SOL price as of now, in USD
}

// Convert a token creation event to TokenMetadata
export const tokenCreationEventToMetadata = (event: TokenCreationEvent): TokenMetadata => {
  const now = new Date().toISOString().split('T')[0];
  
  return {
    tokenName: event.name || `Token ${formatWalletAddress(event.mint, 6)}`,
    tokenSymbol: event.symbol || event.mint.substring(0, 4).toUpperCase(),
    totalSupply: event.vTokensInBondingCurve.toLocaleString(),
    price: event.solAmount / event.initialBuy,
    marketCap: event.marketCapSol * getSOLPrice(),
    holders: 1, // New token has at least 1 holder (creator)
    volume: event.solAmount * getSOLPrice(),
    status: "Pre-Raydium", // New tokens on pump.fun are pre-Raydium
    createdAt: now,
    lastActivity: now
  };
};
