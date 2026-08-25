import "./globals.css";

export const metadata = {
  title: "MIDNIGHT BEY CLUB",
  description: "NO SLEEP. KEEP SPIN.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
