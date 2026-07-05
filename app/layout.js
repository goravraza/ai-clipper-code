import './globals.css'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import UpgradeDialog from './_components/UpgradeDialog'
import SiteChrome from './_components/SiteChrome'

export const metadata = {
  title: 'ClipForge AI — Turn Long Videos into Viral Shorts',
  description: 'AI-powered short-form video clipping platform. Convert YouTube, TikTok and Instagram videos into viral clips in minutes.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SiteChrome />
          {children}
          <UpgradeDialog />
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
