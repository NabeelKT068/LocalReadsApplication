"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { fetchAPI } from '@/lib/api';
import ChatModal from '@/components/ChatModal';

export default function Dashboard() {
  const { user, loading, addNotification } = useAuth();
  const [books, setBooks] = useState<any[]>([]);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState('');
  const [locationName, setLocationName] = useState<string | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBook, setNewBook] = useState({ title: '', author: '', description: '', image_url: '' });
  const [addingBook, setAddingBook] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [coverMode, setCoverMode] = useState<'upload' | 'web'>('web');
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '' });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingBook, setUpdatingBook] = useState(false);
  const [activeTab, setActiveTab] = useState<'catalogue' | 'incoming' | 'borrowed'>('catalogue');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chatTxId, setChatTxId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const wsConnections = useRef<{[key: string]: WebSocket}>({});
  const prevTransactions = useRef<any[]>([]);

  const loadData = async () => {
    try {
      const [booksData, txData] = await Promise.all([
        fetchAPI('/books/me'),
        fetchAPI('/transactions/')
      ]);
      setBooks(booksData);
      
      if (prevTransactions.current.length > 0) {
        txData.forEach((newTx: any) => {
          const oldTx = prevTransactions.current.find(t => t.id === newTx.id);
          const bookTitle = newTx.book?.title || 'a book';
          
          if (!oldTx && newTx.lender_id === user?.id && newTx.status === 'REQUESTED') {
            setToastMsg(`New borrow request for "${bookTitle}"`);
            addNotification(`New borrow request for "${bookTitle}"`);
            setTimeout(() => setToastMsg(null), 5000);
          } else if (oldTx && oldTx.status !== newTx.status) {
            if (newTx.borrower_id === user?.id && newTx.status === 'APPROVED') {
              setToastMsg(`Your request for "${bookTitle}" was approved!`);
              addNotification(`Your request for "${bookTitle}" was approved!`);
              setTimeout(() => setToastMsg(null), 5000);
            } else if (newTx.borrower_id === user?.id && newTx.status === 'REJECTED') {
              setToastMsg(`Your request for "${bookTitle}" was rejected.`);
              addNotification(`Your request for "${bookTitle}" was rejected.`);
              setTimeout(() => setToastMsg(null), 5000);
            } else if (newTx.borrower_id === user?.id && newTx.status === 'BORROWED') {
              setToastMsg(`"${bookTitle}" has been handed over to you!`);
              addNotification(`"${bookTitle}" has been handed over to you!`);
              setTimeout(() => setToastMsg(null), 5000);
            } else if (newTx.borrower_id === user?.id && newTx.status === 'RETURNED') {
              setToastMsg(`"${bookTitle}" return confirmed.`);
              addNotification(`"${bookTitle}" return confirmed.`);
              setTimeout(() => setToastMsg(null), 5000);
            }
          }
        });
      }
      
      prevTransactions.current = txData;
      setTransactions(txData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // Setup global websocket listeners for active transactions
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || !user) return;

    const activeTxs = transactions.filter(tx => tx.status === 'APPROVED' || tx.status === 'BORROWED');
    
    activeTxs.forEach(tx => {
      if (!wsConnections.current[tx.id] && tx.id !== chatTxId) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//localhost:8000/api/v1/chat/ws/${tx.id}?token=${token}`);
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.sender_id !== user.id) {
             setToastMsg(`New message regarding "${tx.book?.title || 'a book'}"`);
             addNotification(`New message regarding "${tx.book?.title || 'a book'}"`);
             setTimeout(() => setToastMsg(null), 5000);
          }
        };
        
        wsConnections.current[tx.id] = ws;
      }
    });

    // Cleanup unused connections
    Object.keys(wsConnections.current).forEach(txId => {
      if (!activeTxs.find(tx => tx.id === txId) || txId === chatTxId) {
         wsConnections.current[txId].close();
         delete wsConnections.current[txId];
      }
    });

  }, [transactions, user, chatTxId]);

  useEffect(() => {
    if (user) {
      loadData();
      const interval = setInterval(loadData, 10000);
      
      // Automatically fetch location on load
      if (navigator.geolocation && !locationName && !locating) {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const lat = position.coords.latitude;
              const lon = position.coords.longitude;
              
              await fetchAPI('/users/me/location', {
                method: 'PATCH',
                body: JSON.stringify({ latitude: lat, longitude: lon })
              });
              
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
              const data = await res.json();
              const place = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || 'your area';
              setLocationName(place);
            } catch (e) {
              console.error("Location auto-update failed", e);
            } finally {
              setLocating(false);
            }
          },
          (err) => {
             console.error("Geolocation denied or failed", err);
             setLocating(false);
          },
          { timeout: 10000 }
        );
      }
      return () => clearInterval(interval);
    }
  }, [user, locationName]);


  const fetchCoverFromWeb = async () => {
    if (!newBook.title) return alert("Please enter a book title first!");
    try {
      // Using OpenLibrary's broad search to avoid Google's strict rate limits
      const query = encodeURIComponent(newBook.title);
      const res = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=10`);
      const data = await res.json();
      
      const docWithCover = data.docs?.find((d: any) => d.cover_i);
      
      if (docWithCover) {
        setNewBook({ ...newBook, image_url: `https://covers.openlibrary.org/b/id/${docWithCover.cover_i}-L.jpg` });
      } else {
        alert("No cover found using broad search. You can upload your own image instead!");
      }
    } catch (e) {
      console.error(e);
      alert("Network error while searching for book cover.");
    }
  };

  const updateLocation = () => {
    setLocating(true);
    setLocMsg('');
    if (!navigator.geolocation) {
      setLocMsg('Geolocation is not supported by your browser');
      setLocating(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          await fetchAPI('/users/me/location', {
            method: 'PATCH',
            body: JSON.stringify({ latitude: lat, longitude: lon })
          });
          
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            const place = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || 'your area';
            setLocationName(place);
            setLocMsg(`Location updated successfully!`);
          } catch (e) {
            setLocationName(`${lat.toFixed(2)}, ${lon.toFixed(2)}`);
            setLocMsg('Location updated successfully!');
          }
        } catch (e: any) {
          setLocMsg(e.message || 'Failed to update location');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocMsg('Unable to retrieve your location');
        setLocating(false);
      }
    );
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingBook(true);
    try {
      let finalImageUrl = newBook.image_url;
      
      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        const uploadRes = await fetchAPI('/books/upload-cover', {
          method: 'POST',
          body: formData,
        });
        finalImageUrl = "http://localhost:8000" + uploadRes.image_url;
      }
      
      await fetchAPI('/books', {
        method: 'POST',
        body: JSON.stringify({ ...newBook, image_url: finalImageUrl, status: 'AVAILABLE' })
      });
      setIsAddModalOpen(false);
      setNewBook({ title: '', author: '', description: '', image_url: '' });
      setUploadFile(null);
      loadData();
    } catch (err) {
      alert("Failed to add book");
    } finally {
      setAddingBook(false);
    }
  };

  const handleUpdateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingBook(true);
    try {
      await fetchAPI(`/books/${editingBook.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          title: editingBook.title, 
          author: editingBook.author, 
          description: editingBook.description,
          status: editingBook.status 
        })
      });
      setEditingBook(null);
      loadData();
    } catch (err) {
      alert("Failed to update book");
    } finally {
      setUpdatingBook(false);
    }
  };

  const handleTxAction = async (txId: string, action: string) => {
    try {
      await fetchAPI(`/transactions/${txId}/${action}`, { method: 'PATCH' });
      loadData();
    } catch (err: any) {
      alert(err.detail || `Failed to ${action}`);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await fetchAPI('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(profileData)
      });
      setEditingProfile(false);
      window.location.reload();
    } catch (err) {
      alert("Failed to update profile");
    } finally {
      setUpdatingProfile(false);
    }
  };

  if (loading) return <div className="p-8 mt-20 text-center">Loading...</div>;
  if (!user) return <div className="p-8 mt-20 text-center">Please log in to view your dashboard.</div>;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-fade-in mt-10">
      <h1 className="text-3xl font-bold mb-8">My Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile / Location Card */}
        <div className="glass-panel p-6 flex flex-col gap-4 col-span-1 h-fit">
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-bold">Profile</h2>
            <button 
              onClick={() => { setProfileData({ name: user.name, email: user.email }); setEditingProfile(true); }}
              className="text-xs text-primary hover:underline font-semibold"
            >
              Edit
            </button>
          </div>
          <div className="opacity-80">
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
            <h3 className="font-semibold mb-2">Discovery Location</h3>
            <p className="text-sm opacity-70 mb-4">Set your approximate location so neighbors can find your books.</p>
            
            {locationName && (
              <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-1">Current Area</span>
                <span className="font-medium flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {locationName}
                </span>
              </div>
            )}
            
            <button 
              onClick={updateLocation}
              disabled={locating}
              className="w-full py-2 bg-black/5 dark:bg-white/10 rounded-lg hover:bg-black/10 dark:hover:bg-white/20 transition-colors font-medium text-sm disabled:opacity-50"
            >
              {locating ? 'Locating...' : (locationName ? 'Refresh Location' : 'Set My Location')}
            </button>
            {locMsg && !locationName && <p className="text-xs mt-2 text-green-600">{locMsg}</p>}
          </div>
        </div>

        {/* My Books */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="flex border-b border-black/10 dark:border-white/10 overflow-x-auto hide-scrollbar mb-4">
            <button onClick={() => setActiveTab('catalogue')} className={`pb-3 px-4 font-semibold text-sm whitespace-nowrap transition-colors ${activeTab === 'catalogue' ? 'border-b-2 border-primary text-primary' : 'opacity-60 hover:opacity-100'}`}>My Catalogue</button>
            <button onClick={() => setActiveTab('incoming')} className={`pb-3 px-4 font-semibold text-sm whitespace-nowrap transition-colors ${activeTab === 'incoming' ? 'border-b-2 border-primary text-primary' : 'opacity-60 hover:opacity-100'}`}>Incoming Requests</button>
            <button onClick={() => setActiveTab('borrowed')} className={`pb-3 px-4 font-semibold text-sm whitespace-nowrap transition-colors ${activeTab === 'borrowed' ? 'border-b-2 border-primary text-primary' : 'opacity-60 hover:opacity-100'}`}>Borrowed Books</button>
          </div>

          {activeTab === 'catalogue' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">My Catalogue</h2>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover-lift"
                >
                  + Add Book
                </button>
              </div>
              
              {books.length === 0 ? (
                <div className="glass-panel p-8 text-center opacity-70">
                  You haven't added any books yet. Share your first book!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {books.map(book => (
                    <div key={book.id} className="glass-panel p-4 flex gap-4">
                      <div className="w-20 h-28 bg-black/10 dark:bg-white/10 rounded flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {book.image_url ? (
                           <img src={book.image_url} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                        )}
                      </div>
                      <div className="flex flex-col justify-between flex-1">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold line-clamp-2 pr-2">{book.title}</h3>
                            <button onClick={() => setEditingBook(book)} className="text-xs text-primary hover:underline font-semibold flex-shrink-0">Edit</button>
                          </div>
                          <p className="text-sm opacity-70 line-clamp-1">{book.author}</p>
                        </div>
                        <span className="inline-block mt-2 text-xs px-2 py-1 bg-green-500/10 text-green-700 dark:text-green-400 rounded-full font-medium w-fit">
                          {book.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'incoming' && (
            <div className="flex flex-col gap-4">
              {transactions.filter(t => t.lender_id === user.id).length === 0 ? (
                <div className="glass-panel p-8 text-center opacity-70">
                  No incoming requests right now.
                </div>
              ) : (
                transactions.filter(t => t.lender_id === user.id).map(tx => (
                  <div key={tx.id} className="glass-panel p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h3 className="font-bold">{tx.book?.title || 'Unknown Book'}</h3>
                      <p className="text-sm opacity-70">Requested by: {tx.borrower?.name || 'Unknown'}</p>
                      <span className="inline-block mt-2 text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">Status: {tx.status}</span>
                    </div>
                    {tx.status === 'REQUESTED' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleTxAction(tx.id, 'approve')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Approve</button>
                        <button onClick={() => handleTxAction(tx.id, 'reject')} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200">Reject</button>
                      </div>
                    )}
                    {tx.status === 'APPROVED' && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setChatTxId(tx.id)} className="px-4 py-2 bg-black/10 dark:bg-white/10 rounded-lg text-sm font-medium hover:bg-black/20">Open Chat</button>
                        <button onClick={() => handleTxAction(tx.id, 'handover')} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Mark Handed Over</button>
                      </div>
                    )}
                    {tx.status === 'BORROWED' && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setChatTxId(tx.id)} className="px-4 py-2 bg-black/10 dark:bg-white/10 rounded-lg text-sm font-medium hover:bg-black/20">Open Chat</button>
                        <button onClick={() => handleTxAction(tx.id, 'confirm-return')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Confirm Return</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'borrowed' && (
            <div className="flex flex-col gap-4">
              {transactions.filter(t => t.borrower_id === user.id).length === 0 ? (
                <div className="glass-panel p-8 text-center opacity-70">
                  You haven't requested any books yet.
                </div>
              ) : (
                transactions.filter(t => t.borrower_id === user.id).map(tx => {
                  let daysLeft = null;
                  if (tx.status === 'BORROWED' && tx.expected_return_date) {
                    const diff = new Date(tx.expected_return_date).getTime() - new Date().getTime();
                    daysLeft = Math.ceil(diff / (1000 * 3600 * 24));
                  }
                  
                  return (
                  <div key={tx.id} className="glass-panel p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h3 className="font-bold">{tx.book?.title || 'Unknown Book'}</h3>
                      <p className="text-sm opacity-70">Owned by: {tx.lender?.name || 'Unknown'}</p>
                      <div className="mt-2 flex gap-2 items-center">
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">Status: {tx.status}</span>
                        {['APPROVED', 'BORROWED'].includes(tx.status) && (
                          <button onClick={() => setChatTxId(tx.id)} className="text-xs px-2 py-1 bg-black/10 dark:bg-white/10 rounded-full font-medium hover:bg-black/20">Open Chat</button>
                        )}
                        {daysLeft !== null && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${daysLeft < 3 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            {daysLeft} days left
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          )}
        </div>
        
      </div>

      {/* Add Book Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 py-12">
            <div className="glass-panel w-full max-w-md p-8 relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <h2 className="text-2xl font-bold mb-6">Add a Book</h2>
            <form onSubmit={handleAddBook} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Book Title</label>
                <input 
                  type="text" required 
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Author</label>
                <input 
                  type="text" required 
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})}
                />
              </div>
              
              <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                <label className="block text-sm font-medium mb-2 opacity-80">Book Cover (Optional)</label>
                <div className="flex gap-2 mb-3">
                   <button type="button" onClick={() => setCoverMode('web')} className={`px-3 py-1 text-xs rounded-full ${coverMode === 'web' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Web Search</button>
                   <button type="button" onClick={() => setCoverMode('upload')} className={`px-3 py-1 text-xs rounded-full ${coverMode === 'upload' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Upload Image</button>
                </div>
                
                {coverMode === 'web' ? (
                  <div className="flex gap-2 items-center">
                    <button type="button" onClick={fetchCoverFromWeb} className="px-3 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg border border-blue-500/20 whitespace-nowrap">
                       Auto-Fetch
                    </button>
                    {newBook.image_url && <span className="text-xs text-green-600 font-medium truncate w-full flex-1">Found!</span>}
                  </div>
                ) : (
                  <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="text-xs" />
                )}
                
                {(newBook.image_url || uploadFile) && (
                   <div className="mt-3 w-16 h-24 bg-gray-200 rounded overflow-hidden">
                      {coverMode === 'web' && newBook.image_url && <img src={newBook.image_url} className="w-full h-full object-cover" />}
                      {coverMode === 'upload' && uploadFile && <img src={URL.createObjectURL(uploadFile)} className="w-full h-full object-cover" />}
                   </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Description</label>
                <textarea 
                  required rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newBook.description} onChange={e => setNewBook({...newBook, description: e.target.value})}
                ></textarea>
              </div>
              <button 
                type="submit" disabled={addingBook}
                className="w-full mt-2 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {addingBook ? 'Adding & Fetching Cover...' : 'Add to Catalogue'}
              </button>
            </form>
          </div>
        </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 py-12">
            <div className="glass-panel w-full max-w-md p-8 relative">
            <button onClick={() => setEditingBook(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <h2 className="text-2xl font-bold mb-6">Edit Book</h2>
            <form onSubmit={handleUpdateBook} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Book Title</label>
                <input 
                  type="text" required 
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={editingBook.title} onChange={e => setEditingBook({...editingBook, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Author</label>
                <input 
                  type="text" required 
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={editingBook.author} onChange={e => setEditingBook({...editingBook, author: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Status</label>
                <select 
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={editingBook.status} onChange={e => setEditingBook({...editingBook, status: e.target.value})}
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                  <option value="BORROWED">Borrowed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Description</label>
                <textarea 
                  required rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={editingBook.description} onChange={e => setEditingBook({...editingBook, description: e.target.value})}
                ></textarea>
              </div>
              <button 
                type="submit" disabled={updatingBook}
                className="w-full mt-2 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {updatingBook ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 py-12">
            <div className="glass-panel w-full max-w-md p-8 relative">
            <button onClick={() => setEditingProfile(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>
            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Name</label>
                <input 
                  type="text" required 
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 opacity-80">Email</label>
                <input 
                  type="email" required 
                  className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})}
                />
              </div>
              <button 
                type="submit" disabled={updatingProfile}
                className="w-full mt-2 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {updatingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] bg-black text-white px-6 py-3 rounded-full shadow-2xl animate-slide-up flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
           <span className="font-medium text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Chat Modal */}
      {chatTxId && (
        <ChatModal txId={chatTxId} onClose={() => setChatTxId(null)} />
      )}
    </div>
  );
}
