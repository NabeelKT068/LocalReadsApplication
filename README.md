# Book Sharing Platform (MVP)

A hyper-local, community-driven book borrowing and sharing platform where users can lend, request, and discover books from their neighbors.

## 🚀 Features

### Core Platform
- **User Authentication:** Secure JWT-based login and registration.
- **Location-Based Discovery:** Automatic geolocation using OpenStreetMap to find neighbors and their books.
- **Book Catalogue Management:** Add books to your personal catalogue, auto-fetch covers and metadata via the OpenLibrary API, or manually upload custom covers.

### Borrowing & Handover Workflow
- **Borrow Requests:** Browse nearby books and send borrow requests to neighbors.
- **Approval System:** Lenders receive requests and can choose to **Approve** or **Reject** them via an interactive dashboard.
- **Real-Time WebSocket Chat:** Once a request is approved, a private chat room is instantly created. Lenders and borrowers can message each other in real-time to arrange a physical meetup for the book exchange.
- **Status Tracking & Time Limits:** 
  - Lenders mark a book as **Handed Over**, transitioning it to the borrower.
  - Borrowers see a live countdown tracking the 14-day borrowing period.
  - Lenders finalize the cycle by clicking **Confirm Return** once the book is physically returned.
- **Live Notifications:** Universal background polling instantly triggers toast notifications when a new request is received, a request is approved, or a book is handed over/returned.

## 🛠 Tech Stack

- **Frontend:** Next.js (React), TailwindCSS, WebSockets
- **Backend:** Python, FastAPI, SQLAlchemy (Async), WebSockets
- **Database:** PostgreSQL (with PostGIS for location logic)
- **Deployment:** Docker & Docker Compose

## 🏃‍♂️ How to Run Locally

### 1. Start the Backend (FastAPI)
The backend relies on PostgreSQL. The easiest way to spin up the database and API is via Docker Compose.
```bash
cd backend
docker-compose up -d --build
```
*Note: The API will be available at `http://localhost:8000`. The Swagger UI for API docs can be found at `http://localhost:8000/docs`.*

### 2. Start the Frontend (Next.js)
Open a new terminal and run the development server:
```bash
cd frontend
npm install
npm run dev
```
*The app will be available at `http://localhost:3000`.*

## 🔮 Future Roadmap (Next Steps)
- Email verification & user profile enhancements.
- Map UI for visually browsing nearby books.
- Advanced late fee calculations and gamification (e.g., neighbor trust scores).
- Dedicated Android App built with React Native (Expo) referencing the same FastAPI backend.
