import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { getActiveQuizzes, QUIZZES_CHANGE, type ActiveQuiz } from './activeQuiz';
import { ThemeProvider } from './theme/ThemeContext';
import ThemePanel from './theme/ThemePanel';
import HomePage from './pages/HomePage';
import BankDetailPage from './pages/BankDetailPage';
import QuizStartPage from './pages/QuizStartPage';
import QuizPage from './pages/QuizPage';
import ReportPage from './pages/ReportPage';
import HistoryPage from './pages/HistoryPage';
import FavoritesPage from './pages/FavoritesPage';
import StatsPage from './pages/StatsPage';
import AiGeneratePage from './pages/AiGeneratePage';
import AiSettingsPage from './pages/AiSettingsPage';
import AiUsagePage from './pages/AiUsagePage';

function App() {
  const [activeQuizzes, setActiveQuizzes] = useState<ActiveQuiz[]>(() => getActiveQuizzes());

  useEffect(() => {
    const handler = () => setActiveQuizzes(getActiveQuizzes());
    window.addEventListener(QUIZZES_CHANGE, handler);
    return () => window.removeEventListener(QUIZZES_CHANGE, handler);
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div>
          <nav className="nav">
            <div className="nav-inner">
              <Link to="/" className="nav-brand">📚 题库抽题系统</Link>
              <div className="nav-links">
                <Link to="/">题库</Link>
                <Link to="/quiz/start">开始答题</Link>
                {activeQuizzes.map((q, i) => (
                  <Link key={q.sessionId}
                    to={`/quiz/${q.sessionId}?mode=${q.mode}`}
                    style={{
                      background: i === 0 ? '#dbeafe' : '#fef3c7',
                      color: i === 0 ? '#1d4ed8' : '#92400e',
                      fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
                      animation: i === 0 ? 'pulse 1.5s infinite' : 'none',
                      fontSize: '13px',
                    }}>
                    {i === 0 ? '📝 ' : ''}{q.mode === 'exam' ? '📋' : '📖'} {q.mode === 'exam' ? '考试' : '练习'}{activeQuizzes.length > 1 ? ` ${i + 1}` : ''}
                  </Link>
                ))}
                <Link to="/favorites">收藏夹</Link>
                <Link to="/history">历史记录</Link>
                <Link to="/stats">📊 统计</Link>
                <Link to="/ai/generate">🤖 AI 出题</Link>
              </div>
            </div>
          </nav>
          <div className="page-container">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/banks/:id" element={<BankDetailPage />} />
              <Route path="/quiz/start" element={<QuizStartPage />} />
              <Route path="/quiz/:id" element={<QuizPage />} />
              <Route path="/quiz/:id/report" element={<ReportPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/ai/generate" element={<AiGeneratePage />} />
              <Route path="/ai/settings" element={<AiSettingsPage />} />
              <Route path="/ai/usage" element={<AiUsagePage />} />
            </Routes>
          </div>
          <ThemePanel />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
