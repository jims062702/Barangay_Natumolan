import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../../features/public/components/Navbar";
import Footer from "../../features/public/components/Footer";
import ChatWidget from "../../features/chat/components/ChatWidget";
import BackToTop from "../../features/public/components/BackToTop";
import NewsDetailSkeleton from "../../features/public/components/NewsDetailSkeleton";

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* The public site stays on screen while a page's code downloads.
            Only the announcement page downloads separately — the landing
            page is part of the first load — so its shape is the fallback. */}
        <Suspense fallback={<NewsDetailSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      {/* AI assistant — floating icon, bottom right */}
      <ChatWidget />
      {/* Reading progress + back to top — bottom left, clear of the assistant */}
      <BackToTop />
    </div>
  );
}
