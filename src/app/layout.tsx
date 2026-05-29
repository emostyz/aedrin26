import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "AEDRIN",
  description: "An operating system for your soul. Capture memories, preserve your story for the people you love.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AEDRIN",
  },
  formatDetection: {
    telephone: false,
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? ""

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Expose nonce to any client scripts that need to create elements */}
        {nonce && <meta property="csp-nonce" content={nonce} />}
      </head>
      <body>{children}</body>
    </html>
  )
}
