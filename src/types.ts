export interface Asset {
  file: File
  preview: string
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error' | 'success'
  url?: string
}

export interface Post {
  id: string
  title: string
  content: string
  contentType: string
  author: string
  createdAt: number
  updatedAt?: number
  tags: string[]
  likes: number
  assets?: string[]
} 