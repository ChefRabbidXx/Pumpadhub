
interface PhantomProvider {
  isPhantom?: boolean;
  isConnected?: boolean;
  connected?: boolean;
  publicKey?: import('@solana/web3.js').PublicKey;
  connect: () => Promise<{ publicKey: import('@solana/web3.js').PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction) => Promise<import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction>;
  signAllTransactions: (transactions: (import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction)[]) => Promise<(import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction)[]>;
  signAndSendTransaction: (transaction: import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction) => Promise<{ signature: string }>;
}

interface Window {
  phantom?: {
    solana?: PhantomProvider;
  };
}
