import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
