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
  Alert,
  Button
} from '@mui/material'
import { Link } from 'react-router-dom'
import { BLOG_PACKAGE_ID, BLOG_MODULE, PUBLISHER_URL, AGGREGATOR_URL } from '../constants'

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
  createdAt: number
  author: string
  likes: number
}

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

  // 从 Walrus 获取内容
  const fetchContent = async (contentHash: string): Promise<string> => {
    try {
      if (!contentHash) return "No content available";
      
      // 确认内容哈希是否为 URL
      if (contentHash.startsWith('http')) {
        const response = await fetch(contentHash);
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.statusText}`);
        }
        return await response.text();
      }
      
      // 否则，尝试从 Walrus 聚合器获取
      const response = await fetch(`${AGGREGATOR_URL}/v1/blobs/${contentHash}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch content from Walrus: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Error fetching content:', error);
      return 'Failed to load content';
    }
  }

  // 将字节数组转换为字符串
  const bytesToString = (bytes: number[]): string => {
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 方法1: 查询所有 BlogPost 对象
      console.log("开始查询博客对象...");
      const blogTypeArg = `${BLOG_PACKAGE_ID}::${BLOG_MODULE}::BlogPost`;
      const objectsResponse = await suiClient.getOwnedObjects({
        owner: currentWallet?.accounts[0]?.address || '',
        options: {
          showContent: true,
          showType: true,
        },
        filter: {
          StructType: blogTypeArg
        }
      });
      
      console.log("查询结果:", objectsResponse);
      
      if (objectsResponse.data.length === 0) {
        console.log("未找到任何博客对象, 尝试查询事件...");
        
        // 方法2: 查询 PostCreated 事件
        const eventsResponse = await suiClient.queryEvents({
          query: {
            MoveEventType: `${BLOG_PACKAGE_ID}::${BLOG_MODULE}::PostCreated`
          },
          limit: 50
        });
        
        console.log("事件查询结果:", eventsResponse);
        
        const postPromises = eventsResponse.data.map(async (event) => {
          const eventData = event.parsedJson as any;
          
          // 获取指向的对象
          try {
            const objectData = await suiClient.getObject({
              id: eventData.post_id,
              options: {
                showContent: true,
                showType: true,
              }
            });
            
            console.log("获取到的对象数据:", objectData);
            
            if (objectData.data?.content && objectData.data.content.dataType === 'moveObject') {
              const fields = objectData.data.content.fields as any;
              const title = bytesToString(fields.title || []);
              const contentHash = bytesToString(fields.content_hash || []);
              const tags = (fields.tags || []).map((tag: number[]) => bytesToString(tag));
              const author = bytesToString(fields.author || []);
              
              console.log("解析的帖子数据:", {
                title,
                contentHash,
                tags,
                author
              });
              
              // 获取内容
              const content = await fetchContent(contentHash);
              
              return {
                id: eventData.post_id,
                title,
                content,
                tags,
                assets: [],  // 暂时为空
                createdAt: Number(fields.created_at || 0),
                author,
                likes: Number(fields.likes || 0)
              };
            }
          } catch (err) {
            console.error(`获取对象 ${eventData.post_id} 失败:`, err);
          }
          
          return null;
        });
        
        const postsResults = await Promise.all(postPromises);
        const validPosts = postsResults.filter(post => post !== null) as Post[];
        
        console.log("解析完成的帖子:", validPosts);
        
        // 按创建时间降序排序
        validPosts.sort((a, b) => b.createdAt - a.createdAt);
        setPosts(validPosts);
      } else {
        // 处理找到的博客对象
        const postPromises = objectsResponse.data.map(async (obj) => {
          if (obj.data?.content && obj.data.content.dataType === 'moveObject') {
            const fields = obj.data.content.fields as any;
            const title = bytesToString(fields.title || []);
            const contentHash = bytesToString(fields.content_hash || []);
            const tags = (fields.tags || []).map((tag: number[]) => bytesToString(tag));
            const author = bytesToString(fields.author || []);
            
            // 获取内容
            const content = await fetchContent(contentHash);
            
            return {
              id: obj.data.objectId,
              title,
              content,
              tags,
              assets: [],  // 暂时为空
              createdAt: Number(fields.created_at || 0),
              author,
              likes: Number(fields.likes || 0)
            };
          }
          return null;
        });
        
        const postsResults = await Promise.all(postPromises);
        const validPosts = postsResults.filter(post => post !== null) as Post[];
        
        // 按创建时间降序排序
        validPosts.sort((a, b) => b.createdAt - a.createdAt);
        setPosts(validPosts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('Failed to fetch posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

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
        <Button sx={{ mt: 2 }} variant="contained" onClick={fetchPosts}>
          Retry
        </Button>
      </Box>
    )
  }

  if (posts.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Alert severity="info">No blog posts found. Create your first post!</Alert>
        <Button 
          sx={{ mt: 2 }} 
          variant="contained" 
          component={Link} 
          to="/create"
        >
          Create New Post
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Grid container spacing={3}>
        {posts.map((post) => (
          <Grid item xs={12} md={6} key={post.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  <Link to={`/post/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {post.title}
                  </Link>
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                  {post.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Box>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                >
                  {post.content.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
                </Typography>
                <Box sx={{ mt: 'auto', pt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    By {post.author.substring(0, 8)}...
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
} 