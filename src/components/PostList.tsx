import { useState, useEffect } from 'react'
import { useSuiClient, useWallets } from '@mysten/dapp-kit'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material'
import { Link } from 'react-router-dom'
import { PUBLISHER_URL,BLOG_PACKAGE_ID } from '../constants'

interface Post {
  id: string
  title: string
  content: string
  tags: string[]
  assets: Array<{
    type: string
    name: string
    hash: string
  }>
  isPublished: boolean
  createdAt: number
  author: string
}

// Walrus API 配置

export function PostList() {
  const suiClient = useSuiClient()
  const wallets = useWallets()
  const currentWallet = wallets[0]
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchContent = async (hash: string): Promise<string> => {
    try {
      const response = await fetch(`${PUBLISHER_URL}/v1/blob/${hash}`)
      if (!response.ok) {
        throw new Error('Failed to fetch content from Walrus')
      }
      return await response.text()
    } catch (error) {
      console.error('Error fetching content:', error)
      return 'Failed to load content'
    }
  }

  const fetchPosts = async () => {
    try {
      setLoading(true)
      // 从 Sui 区块链获取文章列表
      const result = await suiClient.queryTransactionBlocks({
        filter: {
          MoveFunction: {
            package: BLOG_PACKAGE_ID,
            module: 'blog',
            function: 'get_post',
          },
        },
        options: {
          showInput: true,
          showEvents: true,
          showEffects: true,
        },
        limit: 50,
      })

      const posts: Post[] = []
      for (const tx of result.data) {
        if (tx.events) {
          for (const event of tx.events) {
            if (event.type === `${import.meta.env.VITE_BLOG_PACKAGE_ID}::blog::PostCreated`) {
              const postData = event.parsedJson as any
              const content = await fetchContent(postData.contentHash)
              posts.push({
                id: postData.id,
                title: postData.title,
                content,
                tags: postData.tags,
                assets: postData.assets,
                isPublished: postData.isPublished,
                createdAt: postData.createdAt,
                author: postData.author
              })
            }
          }
        }
      }

      // 按创建时间降序排序
      posts.sort((a, b) => b.createdAt - a.createdAt)
      setPosts(posts)
    } catch (error) {
      console.error('Error fetching posts:', error)
      setError('Failed to fetch posts')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Grid container spacing={3}>
        {posts.map((post) => (
          <Grid item xs={12} md={6} key={post.id}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  <Link to={`/post/${post.id}`} style={{ textDecoration: 'none' }}>
                    {post.title}
                  </Link>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  {post.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {new Date(post.createdAt).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  By {post.author}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
} 