import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import { ConnectButton } from '@mysten/dapp-kit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import '@mysten/dapp-kit/dist/index.css'

import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  styled
} from '@mui/material'
import { CreatePost } from './components/CreatePost'
import { PostList } from './components/PostList'
import { rpc_url, ws_rpc_url } from './constants'

// 创建主题
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6fbcf0',
    },
    secondary: {
      main: '#f06292',
    },
  },
})

// 创建 QueryClient 实例
const queryClient = new QueryClient()

// Sui 测试网配置
const TESTNET_RPC_URL = rpc_url
const TESTNET_WS_URL = ws_rpc_url

// 自定义连接按钮样式
const StyledConnectButton = styled(ConnectButton)(({ theme }) => ({
  '& button': {
    backgroundColor: 'transparent',
    border: `1px solid ${theme.palette.primary.contrastText}`,
    color: theme.palette.primary.contrastText,
    padding: '8px 16px',
    borderRadius: '20px',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
    },
  },
  '& .wallet-address': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  '& .wallet-icon': {
    width: '20px',
    height: '20px',
  },
  '& .wallet-status': {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  '& .wallet-status-connected': {
    color: theme.palette.success.main,
  },
  '& .wallet-status-disconnected': {
    color: theme.palette.error.main,
  }
}))

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={{
          testnet: {
            url: TESTNET_RPC_URL,
            wsUrl: TESTNET_WS_URL
          },
        }}
        defaultNetwork="testnet"
      >
        <WalletProvider
          autoConnect
          preferredWallets={['okx', 'sui', 'ethos', 'martian']}
        >
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
              <Box sx={{ flexGrow: 1 }}>
                <AppBar position="static">
                  <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                      <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
                        Sui Blog
                      </Link>
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Button 
                        color="inherit" 
                        component={Link} 
                        to="/"
                        sx={{
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          }
                        }}
                      >
                        Home
                      </Button>
                      <Button 
                        color="inherit" 
                        component={Link} 
                        to="/create"
                        sx={{
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          }
                        }}
                      >
                        Create Post
                      </Button>
                      <StyledConnectButton />
                    </Box>
                  </Toolbar>
                </AppBar>

                <Container maxWidth="lg" sx={{ mt: 4 }}>
                  <Routes>
                    <Route path="/" element={<PostList />} />
                    <Route path="/create" element={<CreatePost />} />
                  </Routes>
                </Container>
              </Box>
            </Router>
          </ThemeProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}

export default App
