import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Employee Timesheet",
  description: "Employee timesheet and reporting application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
