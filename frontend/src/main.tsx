import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ⚠️ 去掉了 React.StrictMode，防止 WebSocket 在开发模式下建立两条连接
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
