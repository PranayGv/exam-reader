import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Book, Trash2, ChevronRight } from 'lucide-react';
import { db } from '../db';
import './Dashboard.css';

export default function Dashboard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    const loadedExams = await db.getExams();
    setExams(loadedExams);
    setLoading(false);
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to delete this exam?')) {
      await db.deleteExam(id);
      loadExams();
    }
  };

  if (loading) return <div className="container mt-8">Loading exams...</div>;

  return (
    <div className="container dashboard">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1>Your Dashboard</h1>
          <p>Track and manage your upcoming exams.</p>
        </div>
        <Link to="/add" className="btn btn-primary">Add Exam</Link>
      </div>

      {exams.length === 0 ? (
        <div className="empty-state glass-panel">
          <Book size={48} className="mb-4" color="var(--text-muted)" />
          <h3>No exams added yet</h3>
          <p className="mb-4">Get started by adding your first exam and study materials.</p>
          <Link to="/add" className="btn btn-primary">Add Exam</Link>
        </div>
      ) : (
        <div className="exam-grid">
          {exams.map(exam => (
            <Link to={`/exam/${exam.id}`} key={exam.id} className="exam-card glass-panel">
              <div className="exam-card-header">
                <h3>{exam.name}</h3>
                <button 
                  className="btn-icon" 
                  onClick={(e) => handleDelete(exam.id, e)}
                  title="Delete Exam"
                >
                  <Trash2 size={18} color="var(--danger)" />
                </button>
              </div>
              
              <div className="exam-card-body">
                <div className="exam-detail">
                  <Calendar size={16} />
                  <span>{new Date(exam.date).toLocaleDateString()}</span>
                </div>
                <div className="exam-detail">
                  <Book size={16} />
                  <span>{exam.pdfs?.length || 0} PDFs {exam.syllabusPdf ? '+ Syllabus' : ''}</span>
                </div>
              </div>

              <div className="exam-card-footer">
                <div className="progress-container">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${exam.progress || 0}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{Math.round(exam.progress || 0)}% completed</span>
                </div>
                <ChevronRight size={20} color="var(--text-muted)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
