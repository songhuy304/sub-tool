import { DouyinDownloadPage } from "@/components/douyin-download/download-page";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata(
  "Douyin Download",
  "Tải video Douyin, chèn phụ đề Việt, theo dõi tiến trình job realtime.",
);

export default function HomePage() {
  return <DouyinDownloadPage />;
}
