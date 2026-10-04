"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import AuthModal from './AuthModal';

import Link from 'next/link';

export default function AuthNav() {
  const { user, logout, loading, notifications, clearNotification, clearAllNotifications } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'login' | 'register'>('login');
  
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const openModal = (mode: 'login' | 'register') => {
    setModalMode(mode);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <nav className="glass-nav sticky top-0 z-50 px-6 py-4 flex justify-between items-center w-full">
        <Link href="/" className="font-bold text-xl tracking-tight text-primary cursor-pointer">
          LocalReads
        </Link>
        <div className="flex gap-4 items-center">
          {loading ? (
            <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md" />
          ) : user ? (
            <>
              <Link href="/" className="text-sm font-medium hover:text-primary transition-colors mr-2">
                Home
              </Link>
              <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors mr-2">
                Dashboard
              </Link>
              
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                  {notifications?.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden animate-fade-in z-50">
                    <div className="p-3 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                      <h3 className="font-bold text-sm">Notifications</h3>
                      {notifications?.length > 0 && (
                        <button 
                          onClick={clearAllNotifications}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {!notifications || notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm opacity-60">
                          No new notifications
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id} className="p-3 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex justify-between items-start gap-2">
                            <p className="text-sm">{notif.message}</p>
                            <button 
                              onClick={() => clearNotification(notif.id)}
                              className="opacity-40 hover:opacity-100 flex-shrink-0"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-sm font-medium ml-2 mr-2 opacity-60">| Hi, {user.name}</span>
              <button onClick={logout} className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors">
                Log out
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => openModal('login')} 
                className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                Log in
              </button>
              <button 
                onClick={() => openModal('register')} 
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors shadow-md hover-lift"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </nav>

      {isModalOpen && (
        <AuthModal 
          mode={modalMode} 
          setMode={setModalMode} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </>
  );
}
