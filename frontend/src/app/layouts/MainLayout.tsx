import { Outlet } from "react-router-dom";
import Navbar from "../../features/public/components/Navbar";
import Footer from "../../features/public/components/Footer";
import ChatWidget from "../../features/chat/components/ChatWidget";
import BackToTop from "../../features/public/components/BackToTop";

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {/* AI assistant — floating icon, bottom right */}
      <ChatWidget />
      {/* Reading progress + back to top — bottom left, clear of the assistant */}
      <BackToTop />
    </div>
  );
}
