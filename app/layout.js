import "./globals.css";

export const metadata = {
  title: "조직연구방법론",
  description: "통계분석 수업을 위한 보조자료",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
