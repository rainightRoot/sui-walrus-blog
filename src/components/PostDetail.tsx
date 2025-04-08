import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSignAndExecuteTransaction, useCurrentAccount,useSuiClient } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Avatar,
  TextField,
  Card,
  CardContent,
  Skeleton
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Favorite as FavoriteIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import { BLOG_PACKAGE_ID, BLOG_MODULE } from '../constants';

// 样式组件
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginBottom: theme.spacing(4),
  boxShadow: theme.shadows[2],
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
}));

const CommentSection = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(4),
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
}));

const CommentItem = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-child': {
    borderBottom: 'none',
  },
}));

interface Post {
  id: string;
  title: string;
  content: string;
  tags: string[];
  assets: Array<{
    type: string;
    name: string;
    hash: string;
  }>;
  createdAt: number;
  author: string;
  likes: number;
  comments: Array<{
    author: string;
    content: string;
    createdAt: number;
  }>;
}

interface CommentFields {
  author: number[];
  content: number[];
  created_at: number;
}

interface BlogPostFields {
  title?: number[];
  content_hash?: number[];
  tags?: number[][];
  author?: number[];
  created_at?: string;
  likes?: string;
  comments?: Array<{ fields: CommentFields }>;
  [key: string]: unknown;
}

export function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const account = useCurrentAccount();
  const navigate = useNavigate();
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);

  // 将字节数组转换为字符串
  const bytesToString = (bytes: number[]): string => {
    return new TextDecoder().decode(new Uint8Array(bytes));
  };

  // 从 Walrus 获取内容
  // const fetchContent = async (contentHash: string): Promise<string> => {
  //   try {
  //     if (!contentHash) return "No content available";
      
  //     // 确认内容哈希是否为 URL
  //     if (contentHash.startsWith('http')) {
  //       const response = await fetch(contentHash);
  //       if (!response.ok) {
  //         throw new Error(`Failed to fetch content: ${response.statusText}`);
  //       }
  //       return await response.text();
  //     }
      
  //     // 从 Walrus 聚合器获取
  //     const response = await fetch(`${AGGREGATOR_URL}/v1/blobs/${contentHash}`);
  //     if (!response.ok) {
  //       throw new Error(`Failed to fetch content from Walrus: ${response.statusText}`);
  //     }
  //     return await response.text();
  //   } catch (error) {
  //     console.error('Error fetching content:', error);
  //     return 'Failed to load content';
  //   }
  // };

  // 获取帖子详情
  const fetchPostDetail = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // 获取对象数据
      const objectData = await suiClient.getObject({
        id,
        options: {
          showContent: true,
          showType: true,
        }
      });
      
      if (!objectData.data) {
        setError('Post not found');
        setLoading(false);
        return;
      }
      
      if (objectData.data.content && objectData.data.content.dataType === 'moveObject') {
        // 使用中间类型
        const rawFields = objectData.data.content.fields as unknown;
        const fields = rawFields as BlogPostFields;
        
        const title = bytesToString(fields.title || []);
        const contentHash = bytesToString(fields.content_hash || []);
        const tags = (fields.tags || []).map((tag: number[]) => bytesToString(tag));
        const author = bytesToString(fields.author || []);
        
        // 获取内容
        const content = contentHash
        // 处理评论
        const comments = (fields.comments || []).map((comment: { fields: CommentFields }) => {
          return {
            author: bytesToString(comment.fields.author || []),
            content: bytesToString(comment.fields.content || []),
            createdAt: Number(comment.fields.created_at || 0),
          };
        });
        
        // 构建帖子对象
        const postData: Post = {
          id,
          title,
          content,
          tags,
          assets: [],  // 暂时为空
          createdAt: Number(fields.created_at || 0),
          author,
          likes: Number(fields.likes || 0),
          comments,
        };
        setPost(postData);
        
        // 查询帖子的资产列表
        if (fields.assets && Array.isArray(fields.assets)) {
          const assets = fields.assets.map((asset: Record<string, unknown>) => {
            return {
              type: bytesToString(asset.asset_type as number[] || []),
              name: bytesToString(asset.name as number[] || []),
              hash: bytesToString(asset.hash as number[] || []),
            };
          });
          
          setPost(prev => prev ? { ...prev, assets } : null);
        }
      } else {
        setError('Invalid post data');
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      setError('Failed to fetch post details');
    } finally {
      setLoading(false);
    }
  };

  // 提交评论
  const handleSubmitComment = async () => {
    if (!id || !account || !commentText.trim()) return;
    
    setIsSubmittingComment(true);
    setCommentError(null);
    
    try {
      // 创建交易块
      const tx = new TransactionBlock();
      
      // 获取 Clock 对象
      const clockObj = tx.pure('0x6');
      
      // 将评论内容和作者转换为字节数组
      const contentBytes = Array.from(new TextEncoder().encode(commentText));
      const authorBytes = Array.from(new TextEncoder().encode(account.address));
      
      // 添加评论
      tx.moveCall({
        target: `${BLOG_PACKAGE_ID}::${BLOG_MODULE}::add_comment`,
        arguments: [
          tx.object(id),
          tx.pure(authorBytes),
          tx.pure(contentBytes),
          clockObj,
        ]
      });
      
      // 执行交易
      const response = await signAndExecute({
        transaction: tx.serialize(),
        account: account,
        chain: 'sui:testnet'
      });
      
      console.log('Comment submitted:', response);
      
      // 清空评论文本
      setCommentText('');
      
      // 重新获取帖子数据
      fetchPostDetail();
    } catch (error) {
      console.error('Error submitting comment:', error);
      setCommentError('Failed to submit comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 点赞帖子
  const handleLikePost = async () => {
    if (!id || !account) return;
    
    setIsLiking(true);
    
    try {
      // 创建交易块
      const tx = new TransactionBlock();
      
      // 点赞帖子
      tx.moveCall({
        target: `${BLOG_PACKAGE_ID}::${BLOG_MODULE}::like_post`,
        arguments: [
          tx.object(id),
        ]
      });
      
      // 执行交易
      const response = await signAndExecute({
        transaction: tx.serialize(),
        account: account,
        chain: 'sui:testnet'
      });
      
      console.log('Post liked:', response);
      
      // 更新点赞计数
      setPost(prev => prev ? { ...prev, likes: prev.likes + 1 } : null);
    } catch (error) {
      console.error('Error liking post:', error);
    } finally {
      setIsLiking(false);
    }
  };

  useEffect(() => {
    fetchPostDetail();
  }, [id]);

  // 加载状态
  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)}
          sx={{ mb: 3 }}
        >
          Back
        </Button>
        
        <StyledPaper>
          <Skeleton variant="text" height={60} width="80%" />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2, mt: 1 }}>
            <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1, mr: 1 }} />
            <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
          </Box>
          <Skeleton variant="text" width="40%" sx={{ mb: 2 }} />
          
          <Divider sx={{ my: 3 }} />
          
          <Skeleton variant="rectangular" height={400} sx={{ mb: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Skeleton variant="rectangular" width={120} height={40} />
            <Skeleton variant="text" width={150} />
          </Box>
        </StyledPaper>
        
        <CommentSection>
          <Skeleton variant="text" height={40} width="40%" sx={{ mb: 3 }} />
          <Skeleton variant="rectangular" height={100} sx={{ mb: 3 }} />
          <Skeleton variant="rectangular" height={80} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={80} sx={{ mb: 2 }} />
        </CommentSection>
      </Box>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)}
          sx={{ mb: 3 }}
        >
          Back
        </Button>
        
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        
        <Button variant="contained" onClick={fetchPostDetail}>
          Retry
        </Button>
      </Box>
    );
  }

  // 未找到帖子
  if (!post) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)}
          sx={{ mb: 3 }}
        >
          Back
        </Button>
        
        <Alert severity="warning">Post not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={() => navigate(-1)}
        sx={{ mb: 3 }}
      >
        Back
      </Button>
      
      <StyledPaper>
        <Typography variant="h3" component="h1" gutterBottom>
          {post.title}
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>
          {post.tags.map((tag) => (
            <Chip key={tag} label={tag} color="primary" variant="outlined" size="small" />
          ))}
        </Box>
        
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          By {post.author} • {new Date(post.createdAt).toLocaleString()}
        </Typography>
        
        <Divider sx={{ my: 3 }} />
        
        {/* 文章内容区，使用 Markdown 渲染 */}
        <Box sx={{ 
          my: 3, 
          '& img': { 
            maxWidth: '100%', 
            height: 'auto',
            borderRadius: 1,
            my: 2
          },
          '& a': {
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline'
            }
          },
          '& h1, & h2, & h3, & h4, & h5, & h6': {
            mt: 3,
            mb: 2
          },
          '& code': {
            px: 1,
            py: 0.5,
            borderRadius: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            fontFamily: 'monospace'
          },
          '& pre': {
            p: 2,
            borderRadius: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            overflowX: 'auto',
            '& code': {
              backgroundColor: 'transparent'
            }
          }
        }}>
          <ReactMarkdown>
            {post.content}
          </ReactMarkdown>
        </Box>
        
        {/* 如果有附件，显示附件列表 */}
        {post.assets.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Attachments
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {post.assets.map((asset, index) => (
                <Card key={index} sx={{ maxWidth: 200 }}>
                  <CardContent>
                    <Typography variant="body2">
                      {asset.name}
                    </Typography>
                    {asset.type.startsWith('image/') && (
                      <Box 
                        component="img" 
                        src={asset.hash} 
                        alt={asset.name}
                        sx={{ 
                          width: '100%', 
                          height: 'auto',
                          borderRadius: 1,
                          mt: 1
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4 }}>
          <Button 
            variant="outlined" 
            startIcon={isLiking ? <CircularProgress size={16} /> : <FavoriteIcon />}
            onClick={handleLikePost}
            disabled={isLiking || !account}
          >
            {post.likes} {post.likes === 1 ? 'Like' : 'Likes'}
          </Button>
          
          <Typography variant="body2" color="text.secondary">
            {post.comments.length} {post.comments.length === 1 ? 'Comment' : 'Comments'}
          </Typography>
        </Box>
      </StyledPaper>
      
      {/* 评论区 */}
      <CommentSection>
        <Typography variant="h5" gutterBottom>
          Comments
        </Typography>
        
        {/* 评论表单 */}
        {account ? (
          <Box sx={{ mb: 4 }}>
            <TextField
              fullWidth
              label="Add a comment"
              multiline
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              variant="outlined"
              sx={{ mb: 2 }}
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                onClick={handleSubmitComment}
                disabled={isSubmittingComment || !commentText.trim()}
                endIcon={isSubmittingComment ? <CircularProgress size={16} /> : null}
              >
                Submit
              </Button>
            </Box>
            
            {commentError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {commentError}
              </Alert>
            )}
          </Box>
        ) : (
          <Alert severity="info" sx={{ mb: 3 }}>
            Please connect your wallet to comment
          </Alert>
        )}
        
        {/* 评论列表 */}
        {post.comments.length > 0 ? (
          post.comments.sort((a, b) => b.createdAt - a.createdAt).map((comment, index) => (
            <CommentItem key={index}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ width: 32, height: 32, mr: 1 }}>{comment.author.substring(0, 1)}</Avatar>
                <Typography variant="subtitle2">
                  {comment.author.substring(0, 8)}...
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  {new Date(comment.createdAt).toLocaleString()}
                </Typography>
              </Box>
              
              <Typography variant="body2" sx={{ ml: 5 }}>
                {comment.content || 'No content'}
              </Typography>
            </CommentItem>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No comments yet. Be the first to comment!
          </Typography>
        )}
      </CommentSection>
    </Box>
  );
} 