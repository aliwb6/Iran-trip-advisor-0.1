import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import MobileHomePrimaryNav from './MobileHomePrimaryNav';
import Footer from './Footer';

export default function Layout() {
  return (
    <div className="public-site-shell min-h-screen flex flex-col">
      <Navbar />
      <MobileHomePrimaryNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
