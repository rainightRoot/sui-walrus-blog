export interface Asset {
  file: File
  preview: string
  uploadStatus: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export interface Post {
  id: string
  title: string
  content: string
  tags: string[]
  assets: string[]
  author: string
  timestamp: number
} 