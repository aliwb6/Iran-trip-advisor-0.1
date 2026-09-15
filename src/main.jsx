import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import SupabaseSetupNotice from '@/components/SupabaseSetupNotice.jsx'
import { isSupabaseConfigured } from '@/supabaseClient'
import '@/index.css'
import '@/dashboard-mobile.css'
import '@/public-mobile-performance.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  isSupabaseConfigured ? <App /> : <SupabaseSetupNotice />
)
