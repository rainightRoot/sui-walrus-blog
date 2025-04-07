import { useState, useRef } from 'react'
import { Box, Paper, TextField, Typography, IconButton, Tooltip } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  FormatBold,
  FormatItalic,
  FormatStrikethrough,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  Code,
  Image,
  TableChart,
  Title,
  Link,
  Undo,
  Redo,
  Preview
} from '@mui/icons-material'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  onImageUpload?: (file: File) => Promise<string>
}

interface CodeProps {
  inline?: boolean
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}

export function MarkdownEditor({ 
  value, 
  onChange, 
  label = 'Content',
  onImageUpload 
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const insertText = (before: string, after: string = '') => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end)
    
    onChange(newText)
    
    // Set cursor position after the inserted text
    setTimeout(() => {
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(start + before.length, end + before.length)
      }
    }, 0)
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onImageUpload) return

    try {
      const imageUrl = await onImageUpload(file)
      insertText(`![${file.name}](${imageUrl})`)
    } catch (error) {
      console.error('Error uploading image:', error)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      insertText('    ')
    }
  }

  const addToHistory = (newValue: string) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newValue)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      onChange(history[historyIndex - 1])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      onChange(history[historyIndex + 1])
    }
  }

  const handleChange = (newValue: string) => {
    onChange(newValue)
    addToHistory(newValue)
  }

  const toolbarButtons = [
    { icon: <FormatBold />, tooltip: 'Bold', action: () => insertText('**', '**') },
    { icon: <FormatItalic />, tooltip: 'Italic', action: () => insertText('*', '*') },
    { icon: <FormatStrikethrough />, tooltip: 'Strikethrough', action: () => insertText('~~', '~~') },
    { icon: <Title />, tooltip: 'Heading', action: () => insertText('# ') },
    { icon: <FormatListBulleted />, tooltip: 'Bullet List', action: () => insertText('- ') },
    { icon: <FormatListNumbered />, tooltip: 'Numbered List', action: () => insertText('1. ') },
    { icon: <FormatQuote />, tooltip: 'Quote', action: () => insertText('> ') },
    { icon: <Code />, tooltip: 'Code Block', action: () => insertText('```\n', '\n```') },
    { icon: <Link />, tooltip: 'Link', action: () => insertText('[', '](url)') },
    { icon: <TableChart />, tooltip: 'Table', action: () => insertText('| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |') },
    { icon: <Image />, tooltip: 'Image', action: () => document.getElementById('image-upload')?.click() },
    { icon: <Undo />, tooltip: 'Undo', action: undo },
    { icon: <Redo />, tooltip: 'Redo', action: redo },
  ]

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{label}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          <Tooltip title={preview ? 'Edit' : 'Preview'}>
            <IconButton onClick={() => setPreview(!preview)}>
              <Preview />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Paper sx={{ p: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {toolbarButtons.map((button, index) => (
            <Tooltip key={index} title={button.tooltip}>
              <IconButton onClick={button.action} size="small">
                {button.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Paper>
      </Box>

      {preview ? (
        <Paper sx={{ p: 2, minHeight: 400 }}>
          <ReactMarkdown
            components={{
              code({ inline, className, children, ...props }: CodeProps) {
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children || '').replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
              table({ children }) {
                return (
                  <table style={{ borderCollapse: 'collapse', width: '100%', margin: '1em 0' }}>
                    {children}
                  </table>
                )
              },
              th({ children }) {
                return (
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>
                    {children}
                  </th>
                )
              },
              td({ children }) {
                return (
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {children}
                  </td>
                )
              },
              blockquote({ children }) {
                return (
                  <blockquote style={{ 
                    borderLeft: '4px solid #ddd',
                    margin: '1em 0',
                    padding: '0.5em 1em',
                    color: '#666'
                  }}>
                    {children}
                  </blockquote>
                )
              },
              img({ src, alt }) {
                return (
                  <img 
                    src={src} 
                    alt={alt} 
                    style={{ 
                      maxWidth: '100%',
                      height: 'auto',
                      borderRadius: '4px',
                      margin: '1em 0'
                    }} 
                  />
                )
              }
            }}
          >
            {value}
          </ReactMarkdown>
        </Paper>
      ) : (
        <TextField
          inputRef={textareaRef}
          fullWidth
          multiline
          rows={10}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          variant="outlined"
          placeholder="Write your content in Markdown..."
          sx={{
            '& .MuiInputBase-root': {
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: 1.6
            }
          }}
        />
      )}
    </Box>
  )
} 