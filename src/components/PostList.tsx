import { useState, useEffect } from 'react'
import { useSuiClient } from '@mysten/dapp-kit'
import { type EventId } from '@mysten/sui/client'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Pagination,
  Stack,
  Skeleton,
  Grid
} from '@mui/material'
import { Link } from 'react-router-dom'
import { BLOG_PACKAGE_ID, BLOG_MODULE, AGGREGATOR_URL } from '../constants'

// 定义一个工具函数，确保不返回 undefined
const ensureNotUndefined = <T,>(value: T | null | undefined): T | null => {
  return value === undefined ? null : value;
};

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

interface PostEvent {
  post_id: string
  title: number[]
  author: number[]
}

// 定义部分字段，不需要完全匹配
interface BlogPostFields {
  title?: number[]
  content_hash?: number[]
  tags?: number[][]
  author?: number[]
  created_at?: string
  likes?: string
  [key: string]: unknown // 使用 unknown 而不是 any
}

export function PostList() {
  const suiClient = useSuiClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 分页相关状态
  const [page, setPage] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)
  const [hasNextCursor, setHasNextCursor] = useState<EventId | null>(null)
  const [cursors, setCursors] = useState<Record<number, EventId | null>>({}) // 保存每页的游标
  const postsPerPage = 6 // 每页显示的帖子数量

  // 页面变化处理函数
  const handlePageChange = (_event: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
    fetchPosts(cursors[newPage - 1]);
  };

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

  const fetchPosts = async (cursor?: EventId | null) => {
    try {
      setLoading(true);
      setError(null);
      
      // 查询 PostCreated 事件
      console.log("查询 PostCreated 事件...");
      const eventsResponse = await suiClient.queryEvents({
        query: {
          MoveEventType: `${BLOG_PACKAGE_ID}::${BLOG_MODULE}::PostCreated`
        },
        cursor,
        limit: postsPerPage,
        order: 'descending' // 按时间降序排列
      });
      
      console.log("事件查询结果:", eventsResponse);
      
      // 保存下一页的游标
      if (eventsResponse.hasNextPage && eventsResponse.nextCursor) {
        const nextCursor = ensureNotUndefined(eventsResponse.nextCursor);
        setHasNextCursor(nextCursor);
        setCursors(prev => {
          const newCursors = { ...prev };
          newCursors[page] = nextCursor;
          return newCursors;
        });
      } else {
        setHasNextCursor(null);
      }
      
      // 处理获取到的事件
      const postPromises = eventsResponse.data.map(async (event) => {
        const eventData = event.parsedJson as PostEvent;
        
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
            // 使用中间类型
            const rawFields = objectData.data.content.fields as unknown;
            const fields = rawFields as BlogPostFields;
            
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
      
      // 等待所有查询完成
      const postsResults = await Promise.all(postPromises);
      const validPosts = postsResults.filter(post => post !== null) as Post[];
      
      console.log("解析完成的帖子:", validPosts);
      
      // 估算总帖子数量
      if (cursor === undefined || cursor === null) {
        // 这只是一个粗略的估计，以后可能需要更精确的计算
        setTotalPosts(eventsResponse.hasNextPage ? (page * postsPerPage) + postsPerPage : validPosts.length);
      }
      
      // 按创建时间降序排序
      validPosts.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(validPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('Failed to fetch posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // 渲染加载状态的骨架屏
  const renderSkeletons = () => {
    return Array(postsPerPage).fill(0).map((_, index) => (
      <Grid item xs={12} md={6} key={`skeleton-${index}`}>
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" height={40} width="80%" />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2, mt: 1 }}>
              <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1, mr: 1 }} />
              <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
            </Box>
            <Skeleton variant="rectangular" height={80} />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', pt: 2 }}>
              <Skeleton variant="text" width={100} />
              <Skeleton variant="text" width={120} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    ));
  };

  if (loading && posts.length === 0) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
        <Grid container spacing={3}>
          {renderSkeletons()}
        </Grid>
      </Box>
    );
  }

  if (error && posts.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => fetchPosts()}>
          Retry
        </Button>
      </Box>
    )
  }

  if (posts.length === 0 && !loading) {
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
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      
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
      
      {/* 分页控件 */}
      {(hasNextCursor || page > 1) && (
        <Stack spacing={2} sx={{ mt: 4, display: 'flex', alignItems: 'center' }}>
          <Pagination 
            count={Math.ceil(totalPosts / postsPerPage)} 
            page={page} 
            onChange={handlePageChange} 
            color="primary"
            disabled={loading}
          />
        </Stack>
      )}
    </Box>
  )
} 