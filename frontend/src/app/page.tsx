"use client";

import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";

export default function Home() {
  const { user } = useAuth();
  const [nearbyBooks, setNearbyBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchAPI('/books/nearby')
        .then(data => {
          if (Array.isArray(data)) {
            setNearbyBooks(data);
          } else {
            setErrorMsg(data.detail || "Failed to load books");
          }
        })
        .catch(err => {
          setErrorMsg("Please ensure your location is set in the dashboard to see nearby books.");
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  const handleBorrow = async (bookId: string, bookTitle: string) => {
    try {
      await fetchAPI(`/transactions/`, { 
        method: 'POST', 
        body: JSON.stringify({ book_id: bookId }) 
      });
      alert(`Borrow request sent for "${bookTitle}"!`);
      // It's still a request, but we hide it from feed for now
      setNearbyBooks(prev => prev.filter(b => b.id !== bookId));
    } catch (err: any) {
      alert(err.detail || "Failed to borrow book");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-fade-in pb-20">
      
      {!user ? (
        <>
          <section className="text-center space-y-6 max-w-3xl mx-auto mt-20">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
              Share Books. <br/> Build Community.
            </h1>
            <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Discover physical books available for borrowing within a 2 km radius of your home. Lend your favorites, meet neighbors, and spark joy through reading.
            </p>
            
            <div className="pt-8 flex flex-wrap gap-4 justify-center">
              <button className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold shadow-lg hover-lift hover:shadow-primary/30">
                Explore Nearby Books
              </button>
            </div>
          </section>
          
          {/* Featured mock books for MVP landing */}
          <section className="mt-32 w-full max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 opacity-50 pointer-events-none">
            {[1, 2, 3].map((item) => (
              <div key={item} className="glass-panel p-6 flex flex-col gap-4 hover-lift cursor-pointer">
                <div className="w-full h-64 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center relative overflow-hidden">
                   <div className="w-full h-full bg-gray-200 dark:bg-gray-800"></div>
                </div>
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">Sample Book {item}</h3>
                    <span className="text-xs px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full font-medium">Available</span>
                  </div>
                  <p className="text-sm opacity-70 mt-1">Jane Doe</p>
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                  <span className="text-sm font-medium opacity-70 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    850m away
                  </span>
                  <button className="text-primary font-semibold text-sm">Log in to Request</button>
                </div>
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="mt-10 w-full max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-4xl font-bold">Discover Nearby</h1>
              <p className="opacity-70 mt-2">Books available to borrow in your local area.</p>
            </div>
            {errorMsg && <p className="text-red-500 text-sm font-medium bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-lg">{errorMsg}</p>}
          </div>

          {loading ? (
             <div className="py-20 text-center opacity-70">Searching your neighborhood for books...</div>
          ) : nearbyBooks.length === 0 && !errorMsg ? (
             <div className="glass-panel p-16 text-center flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20 mb-4"><path d="m2 9 10-5 10 5v5a2 2 0 0 1-2 2h-1.09a2 2 0 0 0-1.65 1.11l-1.22 2.45a2 2 0 0 1-3.56 0L11.26 17.1a2 2 0 0 0-1.65-1.11H8.5a2 2 0 0 1-2-2V9z"/><circle cx="12" cy="15" r="2"/></svg>
                <h3 className="text-xl font-bold mb-2">No books found nearby</h3>
                <p className="opacity-70 max-w-md">It looks like there aren't any available books in your radius yet. Be the first to add books to your neighbourhood!</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {nearbyBooks.map((book) => (
                <div key={book.id} className="glass-panel p-5 flex flex-col gap-4 hover-lift cursor-pointer h-full">
                  <div className="w-full h-56 bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center relative overflow-hidden flex-shrink-0">
                     {book.image_url ? (
                        <img src={book.image_url} alt={book.title} className="w-full h-full object-cover" />
                     ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                     )}
                     
                     {book.already_read && (
                        <div className="absolute top-2 right-2 bg-green-600/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md backdrop-blur-sm shadow-sm flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          Already Read
                        </div>
                     )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-lg line-clamp-1" title={book.title}>{book.title}</h3>
                    </div>
                    <p className="text-sm opacity-70 line-clamp-1">{book.author}</p>
                    <p className="text-xs opacity-50 line-clamp-2 mt-2">{book.description}</p>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-4 border-t border-black/5 dark:border-white/5">
                    <span className="text-xs font-semibold text-primary flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {book.distance_meters ? `${(book.distance_meters / 1000).toFixed(1)} km` : '< 1 km'}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleBorrow(book.id, book.title); }}
                      className="text-sm px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity"
                    >
                      {book.already_read ? 'Borrow Again' : 'Borrow'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
