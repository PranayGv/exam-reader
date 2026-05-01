import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import './App.css';

import Dashboard from './pages/Dashboard';
import AddExam from './pages/AddExam';
import StudyWorkspace from './pages/StudyWorkspace';

function App() {
  return (
    <Router>
      <div className="app-layout">
        <header className="header">
          <Link to="/" className="logo">
            <BookOpen size={28} color="var(--accent-primary)" />
            Exam<span>Reader</span>
          </Link>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add" element={<AddExam />} />
            <Route path="/exam/:id" element={<StudyWorkspace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
