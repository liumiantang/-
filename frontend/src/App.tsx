import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BankDetailPage from './pages/BankDetailPage';
import QuizStartPage from './pages/QuizStartPage';
import QuizPage from './pages/QuizPage';
import ReportPage from './pages/ReportPage';
import HistoryPage from './pages/HistoryPage';
import FavoritesPage from './pages/FavoritesPage';

function App() {
  return (
    <BrowserRouter>
      <div>
        <nav className="nav">
          <div className="nav-inner">
            <Link to="/" className="nav-brand">📚 题库抽题系统</Link>
            <div className="nav-links">
              <Link to="/">题库</Link>
              <Link to="/quiz/start">开始答题</Link>
              <Link to="/favorites">收藏夹</Link>
              <Link to="/history">历史记录</Link>
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
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
