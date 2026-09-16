# 📚 题库抽题系统

一个基于 FastAPI + React 的智能题库管理系统，支持多种文档格式导入、练习/考试双模式答题、错题本自动汇总、题目收藏、艾宾浩斯复习和 AI 辅助出题等功能。

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)

---

## ✨ 功能特性

### 题库管理
- **多题库支持** — 创建/删除题库，每个题库独立管理题目
- **智能解析** — 自动识别文档格式，支持 `.docx` / `.xlsx` / `.md` / `.txt` / `.pdf`
- **表格导入** — 支持 `.csv` 题库文件
- **扫描件 OCR** — 文本型 PDF 直接解析，扫描型 PDF 可使用 Tesseract OCR
- **题型识别** — 自动识别单选题、多选题、判断题、填空题，支持从章节标题推断题型
- **答案提取** — 支持 `正确答案：X` 和 `答案：X` 两种标记格式
- **题目编辑** — 在线修改答案、查看解析、题型筛选

### 答题模式
- **📝 考试模式** — 答完所有题目后统一交卷，显示分数和作答报告
- **📖 练习模式** — 每道题提交后立即显示对错、正确答案和解析
- **进度追踪** — 题号指示器，绿色=已答，红色=答错，蓝色=当前
- **多题型支持** — 单选、多选（确认提交）、判断、填空/简答
- **复习模式** — 从首页复习提醒进入，自动覆盖所有题库中的到期题目
- **简答题评分** — 作答报告支持 AI 评分；未配置 AI 时保留待评分状态

### 错题本 & 收藏
- **⭐ 收藏夹** — 练习模式中一键收藏题目，导航栏独立入口查看
- **📋 错题本** — 一键汇总所有历史错题，生成独立"错题本"题库
- **🗑 历史管理** — 每条作答记录支持单独删除

### 作答报告
- 分数统计 + 正确率进度条
- 逐题复盘：每道题标注对错，高亮你的答案和正确答案
- 错题附带解析说明
- 简答题可在报告页发起 AI 评分

### 智能抽题
- 跨题库抽题、按难度范围筛选
- 按题型过滤（单选/多选/判断/填空）
- 排除已答对题目，避免重复

### AI 与学习辅助
- AI 生成题目和解析（需要配置 OpenAI 兼容 API）
- 艾宾浩斯复习提醒与到期题目抽取
- 学习统计、连续学习和成就数据
- 主题切换与未完成答题会话恢复

---

## 🚀 快速开始

### 环境要求
- Python 3.9+
- Node.js 18+（仅构建前端时需要）

### 一键启动（Windows）
双击根目录下的 **`启动题库系统.vbs`**，自动启动后端并打开浏览器。

### 手动启动

```bash
# 1. 安装 Python 依赖
cd backend
pip install -r requirements.txt

# 2. 启动后端（默认端口 5201）
python -m uvicorn app.main:app --host 127.0.0.1 --port 5201

# 3. 浏览器访问
# http://127.0.0.1:5201
```

### OCR 配置（可选）

扫描型 PDF 需要额外安装 Tesseract OCR，并确保 `tesseract` 命令在 PATH 中。也可以通过环境变量指定路径：

```powershell
$env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
$env:TESSDATA_PREFIX = "C:\Program Files\Tesseract-OCR\tessdata"
```

中文扫描件还需要安装 Tesseract 的 `chi_sim` 语言数据。EasyOCR 是可选增强项；未安装时会自动回退到 Tesseract。

### 构建前端（开发时）

```bash
cd frontend
npm install
npm run build        # 生产构建到 frontend/dist/
npm run dev          # 开发模式（Vite 热更新）
```

---

## 📂 项目结构

```
tiku/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口 + 前端 SPA 托管
│   │   ├── database.py          # SQLite 数据库初始化
│   │   ├── models/              # SQLAlchemy 数据模型
│   │   │   ├── bank.py          # 题库模型
│   │   │   ├── question.py      # 题目模型
│   │   │   ├── quiz.py          # 作答记录模型
│   │   │   └── favorite.py      # 收藏模型
│   │   ├── routers/             # API 路由
│   │   │   ├── banks.py         # 题库 CRUD + 导入 + 错题本
│   │   │   ├── questions.py     # 题目管理 + 收藏夹
│   │   │   └── quiz.py          # 抽题/答题/交卷/历史
│   │   ├── services/            # 业务逻辑
│   │   │   ├── bank_service.py  # 题库服务
│   │   │   ├── quiz_service.py  # 答题服务
│   │   │   └── picker_service.py# 抽题算法
│   │   └── parser/              # 文档解析引擎
│   │       ├── auto_parser.py   # 智能格式检测 + 多格式解析
│   │       ├── text_parser.py   # Markdown 格式解析
│   │       ├── excel_parser.py  # Excel 表格解析
│   │       └── base.py          # 数据模型 + 公共逻辑
│   ├── data/
│   │   └── quiz.db              # SQLite 数据库
│   ├── kill_port.py             # 端口清理工具
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # 路由 + 导航
│   │   ├── api/index.ts         # API 封装 (axios)
│   │   ├── types/index.ts       # TypeScript 类型定义
│   │   └── pages/
│   │       ├── HomePage.tsx      # 首页（题库列表 + 错题本）
│   │       ├── BankDetailPage.tsx# 题库详情（题目管理 + 导入）
│   │       ├── QuizStartPage.tsx # 抽题设置
│   │       ├── QuizPage.tsx     # 答题页面（练习/考试模式）
│   │       ├── ReportPage.tsx   # 作答报告
│   │       ├── HistoryPage.tsx  # 历史记录
│   │       └── FavoritesPage.tsx# 收藏夹
│   └── package.json
├── sample_questions.md          # 示例题目（Markdown 格式）
├── 启动题库系统.vbs              # Windows 一键启动脚本
├── 停止题库系统.bat              # 停止服务器
└── README.md
```

---

## 📄 支持的文档格式

### 1. 超星/学习通格式（`.docx`）
```
一、单选题（共 3 题）
1. 总体国家安全观是（ ）提出的。
A、以习近平同志为核心的党中央
B、毛泽东
C、邓小平
D、江泽民
答案：A

三、多选题（共 1 题）
1. 我国国家安全形势面临的挑战有（ ）。
A、发展不平衡问题仍然突出
B、科技创新能力强
C、意识形态领域存在挑战
D、生态环境保护任务轻松
答案：AC

二、判断题（共 1 题）
1. 在百年变局下，传统安全领域的威胁仍然存在。（ ）
答案：对
```

解析器自动：识别题型、提取选项、映射答案（对→正确）。

### 2. 正确答案标记格式
```
1. 题目内容
A. 选项A
B. 选项B
正确答案： A
```

### 3. Markdown 模板格式
参考 `sample_questions.md`

---

## 🔧 API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/banks` | GET | 题库列表 |
| `/api/banks` | POST | 创建题库 |
| `/api/banks/{id}` | DELETE | 删除题库 |
| `/api/banks/{id}/import` | POST | 导入文档 |
| `/api/banks/wrong-answer-book` | POST | 生成错题本 |
| `/api/banks/{id}/questions` | GET | 题目列表（支持筛选） |
| `/api/questions/{id}` | PUT | 编辑题目答案 |
| `/api/questions/{id}` | DELETE | 删除题目 |
| `/api/questions/{id}/favorite` | POST | 收藏题目 |
| `/api/questions/{id}/favorite` | DELETE | 取消收藏 |
| `/api/favorites` | GET | 收藏列表 |
| `/api/quiz/start` | POST | 开始答题（含模式设置） |
| `/api/quiz/{id}` | GET | 获取答题进度 |
| `/api/quiz/{id}/answer` | POST | 提交答案 |
| `/api/quiz/{id}/finish` | POST | 交卷 |
| `/api/quiz/{id}` | DELETE | 删除作答记录 |
| `/api/quiz/history` | GET | 作答历史 |

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI (Python) |
| 数据库 | SQLite + SQLAlchemy ORM |
| 前端框架 | React + TypeScript |
| 构建工具 | Vite |
| 文档解析 | python-docx, openpyxl, pdfplumber, PyPDF2, PyMuPDF, Tesseract |
| 样式 | 纯 CSS（无第三方 UI 库） |

---

## 📝 许可

MIT License
