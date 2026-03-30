import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dokument Kommentare",
  description: "Kommentarplattform für ein geschütztes Dokument",
};

/**
 * Anti-flash script: runs synchronously before the page paints.
 * Reads the saved theme from localStorage (or falls back to prefers-color-scheme)
 * and sets the `dark` class on <html> immediately.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        {/* suppressHydrationWarning: this script differs between server/client by design */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        {children}
      </body>
    </html>
  );
}
