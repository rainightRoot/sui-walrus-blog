# Sui Walrus Blog

A decentralized blog system built on Sui blockchain using Walrus for storage.

## Features

- Create and manage blog posts on the Sui blockchain
- Store blog content using Walrus decentralized storage
- Like and comment on posts
- Tag-based organization
- Modern React UI with Material-UI

## Prerequisites

- Node.js 16+
- Sui CLI
- Sui wallet (e.g., Sui Wallet)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sui-walrus-blog.git
cd sui-walrus-blog
```

2. Install dependencies:
```bash
npm install
```

3. Deploy the smart contract:
```bash
cd contracts
sui client publish --gas-budget 10000000
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
sui-walrus-blog/
├── contracts/              # Sui Move smart contracts
│   ├── sources/           # Contract source files
│   └── Move.toml         # Contract configuration
├── src/                   # React application source
│   ├── components/       # React components
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Application entry point
└── README.md            # Project documentation
```

## Smart Contract

The smart contract (`blog.move`) provides the following functionality:

- Create new blog posts
- Update existing posts
- Add comments to posts
- Like posts
- Tag-based organization

## Frontend

The frontend is built with:

- React + TypeScript
- Material-UI for components
- Sui Wallet Kit for blockchain interaction
- Walrus SDK for decentralized storage

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
