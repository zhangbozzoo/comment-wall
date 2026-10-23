import { create } from 'zustand'

export interface Comment {
  id: string
  content: string
  author_name: string
  author_avatar: string | null
  x: number
  y: number
  color: string
  rotate: number
  likes: number
  sentiment: string
  created_at: string
  liked_by_me?: boolean
}

export interface OnlineUser {
  id: string
  username: string
  avatar: string | null
}

interface AppState {
  user: { id: string; username: string; avatar: string | null } | null
  token: string | null
  comments: Comment[]
  onlineUsers: OnlineUser[]
  showLogin: boolean
  showCreate: boolean
  ws: WebSocket | null
  syncStatus: string
  setUser: (user: AppState['user']) => void
  setToken: (token: string | null) => void
  setComments: (comments: Comment[]) => void
  addComment: (comment: Comment) => void
  updateComment: (id: string, data: Partial<Comment>) => void
  removeComment: (id: string) => void
  setOnlineUsers: (users: OnlineUser[]) => void
  setShowLogin: (show: boolean) => void
  setShowCreate: (show: boolean) => void
  setWs: (ws: WebSocket | null) => void
  setSyncStatus: (status: string) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  comments: [],
  onlineUsers: [],
  showLogin: false,
  showCreate: false,
  ws: null,
  syncStatus: '已连接',
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setComments: (comments) => set({ comments }),
  addComment: (comment) => set((state) => ({ comments: [comment, ...state.comments] })),
  updateComment: (id, data) =>
    set((state) => ({
      comments: state.comments.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),
  removeComment: (id) =>
    set((state) => ({ comments: state.comments.filter((c) => c.id !== id) })),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  setShowLogin: (showLogin) => set({ showLogin }),
  setShowCreate: (showCreate) => set({ showCreate }),
  setWs: (ws) => set({ ws }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
}))