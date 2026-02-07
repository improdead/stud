import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://stud.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Stud — AI Coding Assistant for Roblox",
    template: "%s | Stud",
  },
  description:
    "Open-source AI coding assistant with deep Roblox Studio integration. Edit Luau scripts, manipulate instances, query DataStores, and search the Toolbox — all from your terminal.",
  keywords: [
    "Stud",
    "AI coding assistant",
    "Roblox",
    "Roblox Studio",
    "Luau",
    "Roblox development",
    "AI terminal",
    "code assistant",
    "Roblox scripting",
    "open source",
    "TUI",
    "DataStore",
    "Roblox Toolbox",
  ],
  authors: [{ name: "Stud", url: siteUrl }],
  creator: "Stud",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Stud",
    title: "Stud — AI Coding Assistant for Roblox",
    description:
      "Open-source AI coding assistant with deep Roblox Studio integration. 27+ specialized tools for Roblox development, right in your terminal.",
    images: [
      {
        url: "/assets/app_icon.png",
        width: 512,
        height: 512,
        alt: "Stud — AI Coding Assistant for Roblox",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Stud — AI Coding Assistant for Roblox",
    description:
      "Open-source AI coding assistant with deep Roblox Studio integration. 27+ specialized tools right in your terminal.",
    images: ["/assets/app_icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
