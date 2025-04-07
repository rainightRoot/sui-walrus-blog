import { useState, useEffect, useCallback } from 'react'
import { useWallets, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Chip,
  IconButton,
  Stack,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextareaAutosize
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Image as ImageIcon } from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import { TransactionBlock } from '@mysten/sui.js/transactions'
import { BLOG_PACKAGE_ID, BLOG_MODULE, WALRUS_API_URL } from '../constants'
import { Asset } from '../types'

// 自定义样式
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  '&:hover': {
    boxShadow: theme.shadows[3],
  },
}))

const StyledTextarea = styled(TextareaAutosize)(({ theme }) => ({
  width: '100%',
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  fontFamily: 'monospace',
  fontSize: '14px',
  lineHeight: 1.5,
  resize: 'vertical',
  minHeight: '300px',
  '&:focus': {
    outline: 'none',
    borderColor: theme.palette.primary.main,
  },
}))

const PreviewPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
}))

export function CreatePost() {
  const navigate = useNavigate()
  const wallets = useWallets()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const currentWallet = wallets[0]
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [assets, setAssets] = useState<Asset[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState('')

  // 从本地存储加载草稿
  useEffect(() => {
    const draft = localStorage.getItem('blogPostDraft')
    if (draft) {
      const { title, content, tags } = JSON.parse(draft)
      setTitle(title)
      setContent(content)
      setTags(tags)
    }
  }, [])

  // 保存草稿到本地存储
  useEffect(() => {
    const draft = { title, content, tags }
    localStorage.setItem('blogPostDraft', JSON.stringify(draft))
  }, [title, content, tags])

  // 处理图片粘贴
  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const preview = URL.createObjectURL(file)
          setAssets(prev => [...prev, {
            file,
            preview,
            uploadStatus: 'pending'
          }])
        }
      }
    }
  }, [])

  // 添加图片上传按钮
  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file)
        setAssets(prev => [...prev, {
          file,
          preview,
          uploadStatus: 'pending'
        }])
      }
    })
  }, [])

  // 删除图片
  const handleDeleteAsset = (index: number) => {
    setAssets(prev => {
      const newAssets = [...prev]
      URL.revokeObjectURL(newAssets[index].preview)
      newAssets.splice(index, 1)
      return newAssets
    })
  }

  // 上传图片到 Walrus
  const uploadToWalrus = async (file: File): Promise<string> => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${WALRUS_API_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('Error uploading to Walrus:', error)
      throw error
    }
  }

  // 处理提交
  const handleSubmit = async () => {
    if (!currentWallet) {
      setError('Please connect your wallet first')
      return
    }

    if (!title.trim() || !content.trim()) {
      setError('Title and content are required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // 上传所有图片
      const uploadedAssets = await Promise.all(
        assets.map(async (asset) => {
          try {
            const url = await uploadToWalrus(asset.file)
            return url
          } catch (error) {
            console.error('Error uploading asset:', error)
            throw error
          }
        })
      )

      // 创建交易块
      const tx = new TransactionBlock()
      
      // 创建帖子对象
      tx.moveCall({
        target: `${BLOG_PACKAGE_ID}::${BLOG_MODULE}::create_post`,
        arguments: [
          tx.pure(title),
          tx.pure(content),
          tx.pure(tags),
          tx.pure(uploadedAssets),
          tx.pure(currentWallet.accounts[0].address),
          tx.pure(Date.now())
        ]
      })

      // 发布帖子
      await signAndExecute({
        transaction: tx.serialize(),
        account: currentWallet.accounts[0]
      })
      
      setSuccess(true)
      localStorage.removeItem('blogPostDraft')
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 预览功能
  const handlePreview = () => {
    setPreviewContent(content)
    setIsPreviewOpen(true)
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create New Post
      </Typography>

      <StyledPaper>
        <TextField
          fullWidth
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          margin="normal"
          required
        />

        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Tags:</Typography>
            {tags.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                onDelete={() => setTags(tags.filter((_, i) => i !== index))}
                color="primary"
                variant="outlined"
              />
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField
                size="small"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    setTags([...tags, newTag.trim()])
                    setNewTag('')
                  }
                }}
              />
              <IconButton
                color="primary"
                onClick={() => {
                  if (newTag.trim()) {
                    setTags([...tags, newTag.trim()])
                    setNewTag('')
                  }
                }}
              >
                <AddIcon />
              </IconButton>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Content:</Typography>
            <Button
              variant="outlined"
              startIcon={<ImageIcon />}
              component="label"
              size="small"
            >
              Upload Image
              <input
                type="file"
                hidden
                accept="image/*"
                multiple
                onChange={handleImageUpload}
              />
            </Button>
          </Stack>
          <StyledTextarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            placeholder="Write your post content in Markdown..."
          />
        </Box>

        {assets.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Uploaded Images:
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {assets.map((asset, index) => (
                <Box
                  key={index}
                  sx={{
                    position: 'relative',
                    width: 150,
                    height: 150,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <img
                    src={asset.preview}
                    alt={`Preview ${index + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <IconButton
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    }}
                    onClick={() => handleDeleteAsset(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || !currentWallet}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Publish'}
          </Button>
          <Button variant="outlined" onClick={handlePreview}>
            Preview
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Post published successfully! Redirecting...
          </Alert>
        )}
      </StyledPaper>

      <Dialog
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Preview</DialogTitle>
        <DialogContent>
          <PreviewPaper>
            <Typography variant="h5" gutterBottom>
              {title}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              {tags.join(', ')}
            </Typography>
            <Box sx={{ mt: 2 }}>
              {previewContent}
            </Box>
          </PreviewPaper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
} 