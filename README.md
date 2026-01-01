# Pumpad

A modular upgrade layer for pump.fun tokens on Solana. Pumpad lets creators add staking, races, burns, and social farming to their tokens.

## Features

- **Staking** - Create staking pools with customizable APR and lock periods
- **Token Races** - Competitive holder rankings with prize pools  
- **Token Burns** - Gamified burn mechanics with rewards
- **Social Farming** - Reward community engagement with tokens
- **SAFU Launches** - Secure token launches with built-in protections

## Technology Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Solana Web3.js
- Supabase (Backend)

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/your-org/pumpad.git
cd pumpad
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

4. Open [http://localhost:8080](http://localhost:8080) in your browser

## Environment Variables

Create a `.env` file with:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

## Project Structure

```
src/
├── components/     # React components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
├── contexts/       # React contexts
└── integrations/   # External integrations
```

## License

MIT License - see LICENSE file for details.

## Links

- Website: [https://pumpad.fun](https://pumpad.fun)
- Twitter: https://x.com/pumpadfun
- Telegram: [t.me/pumpad](https://t.me/pumpadchat)
