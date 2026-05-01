import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, FileText, BookOpen, StickyNote, LayoutList } from 'lucide-react';
import { db } from '../db';
import PDFViewer from '../components/PDFViewer';
import './StudyWorkspace.css';

export default function StudyWorkspace() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [activePdf, setActivePdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('docs'); // 'docs' | 'notes'

  useEffect(() => {
    const loadExam = async () => {
      const data = await db.getExam(id);
      if (data) {
        setExam(data);
        if (data.pdfs && data.pdfs.length > 0) {
          setActivePdf(data.pdfs[0]);
        } else if (data.syllabusPdf) {
          setActivePdf(data.syllabusPdf);
        }
      }
      setLoading(false);
    };
    loadExam();
  }, [id]);

  const handleProgressUpdate = async (progress) => {
    if (!activePdf || !exam) return;

    const isSyllabus = exam.syllabusPdf?.id === activePdf.id;

    // Find current saved progress to check if update is needed
    const currentProgress = isSyllabus
      ? (exam.syllabusPdf?.progress || 0)
      : (exam.pdfs?.find(p => p.id === activePdf.id)?.progress || 0);

    if (Math.abs(currentProgress - progress) <= 1) return;

    // Immutably update pdfs array
    const updatedPdfs = (exam.pdfs || []).map(p =>
      p.id === activePdf.id ? { ...p, progress } : p
    );
    const updatedSyllabus = isSyllabus
      ? { ...exam.syllabusPdf, progress }
      : exam.syllabusPdf;

    const overall = updatedPdfs.length > 0
      ? updatedPdfs.reduce((sum, p) => sum + (p.progress || 0), 0) / updatedPdfs.length
      : 0;

    const newExam = {
      ...exam,
      pdfs: updatedPdfs,
      syllabusPdf: updatedSyllabus,
      progress: overall,
    };

    setExam(newExam);
    await db.updateExam(newExam);
  };

  const handleNotesChange = async (e) => {
    const newExam = { ...exam, notes: e.target.value };
    setExam(newExam);
    await db.updateExam(newExam);
  };

  if (loading) return <div className="ws-loading"><div className="ws-spinner" /><span>Loading workspace...</span></div>;
  if (!exam) return <div className="ws-loading"><span>Exam not found.</span></div>;

  const progress = Math.round(exam.progress || 0);

  return (
    <div className="workspace-container">
      {/* ── Sidebar ── */}
      <aside className={`workspace-sidebar glass-panel${isSidebarOpen ? '' : ' sidebar-collapsed'}`}>

        {/* Sidebar top bar */}
        <div className="sidebar-topbar">
          <Link to="/" className="sidebar-back">
            <ArrowLeft size={15} />
            <span>Dashboard</span>
          </Link>
          <button className="sidebar-collapse-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title={isSidebarOpen ? 'Collapse' : 'Expand'}>
            <ChevronLeft size={18} className={isSidebarOpen ? '' : 'rotated'} />
          </button>
        </div>

        {/* Content hidden when collapsed */}
        {isSidebarOpen && (
          <>
            {/* Exam name + progress */}
            <div className="sidebar-identity">
              <h2 className="sidebar-exam-name">{exam.name}</h2>
              <div className="sidebar-exam-date">
                {new Date(exam.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>

              <div className="sidebar-progress-block">
                <div className="sidebar-progress-label">
                  <span>Overall Progress</span>
                  <span className="sidebar-progress-pct">{progress}%</span>
                </div>
                <div className="sidebar-progress-track">
                  <div className="sidebar-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            {/* Syllabus pill */}
            {exam.syllabusPdf && (
              <div className="sidebar-syllabus-wrap">
                <button
                  className={`sidebar-syllabus-btn${activePdf?.id === exam.syllabusPdf.id ? ' active' : ''}`}
                  onClick={() => setActivePdf(exam.syllabusPdf)}
                >
                  <BookOpen size={15} />
                  <span>Syllabus PDF</span>
                </button>
              </div>
            )}

            {/* Tab switcher */}
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab${activeTab === 'docs' ? ' active' : ''}`}
                onClick={() => setActiveTab('docs')}
              >
                <LayoutList size={14} /> Documents
              </button>
              <button
                className={`sidebar-tab${activeTab === 'notes' ? ' active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                <StickyNote size={14} /> Notes
              </button>
            </div>

            {/* Documents tab */}
            {activeTab === 'docs' && (
              <div className="sidebar-doc-list">
                {(exam.pdfs || []).length === 0 && (
                  <div className="sidebar-empty">No study PDFs uploaded.</div>
                )}
                {(exam.pdfs || []).map((pdf) => {
                  const pct = Math.round(pdf.progress || 0);
                  const isActive = activePdf?.id === pdf.id;
                  return (
                    <button
                      key={pdf.id}
                      className={`sidebar-doc-item${isActive ? ' active' : ''}`}
                      onClick={() => setActivePdf(pdf)}
                    >
                      <div className="sidebar-doc-icon">
                        <FileText size={16} />
                      </div>
                      <div className="sidebar-doc-info">
                        <div className="sidebar-doc-name">{pdf.name.replace(/\.pdf$/i, '')}</div>
                        <div className="sidebar-doc-progress-row">
                          <div className="sidebar-doc-track">
                            <div className="sidebar-doc-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="sidebar-doc-pct">{pct}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Notes tab */}
            {activeTab === 'notes' && (
              <div className="sidebar-notes-wrap">
                <textarea
                  className="sidebar-notes"
                  placeholder="Write your note here..."
                  value={exam.notes || ''}
                  onChange={handleNotesChange}
                />
              </div>
            )}
          </>
        )}
      </aside>

      {/* ── PDF Viewer ── */}
      <main className="workspace-main" style={{ position: 'relative' }}>
        {!isSidebarOpen && (
          <button
            className="sidebar-reopen-btn"
            onClick={() => setIsSidebarOpen(true)}
            title="Open Sidebar"
          >
            <LayoutList size={18} />
          </button>
        )}

        {activePdf ? (
          <PDFViewer pdfMeta={activePdf} onProgressUpdate={handleProgressUpdate} />
        ) : (
          <div className="empty-state glass-panel h-full">
            <FileText size={48} className="mb-4 text-muted" />
            <h3>No PDF Selected</h3>
            <p>Select a document from the sidebar to start reading.</p>
          </div>
        )}
      </main>
    </div>
  );
}
