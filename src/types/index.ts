export type InputMode = 'text' | 'audio'

export interface StreamError {
  type: 'network' | 'timeout' | 'aborted' | 'http'
  message: string
  statusCode?: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}
