# 🎓 ExamPortal — Secure Online Examination System

A lightweight, high-performance objective examination portal built with **React**, **Vite**, and modern **CSS design tokens**. Designed to handle large concurrent student exams with rigorous anti-cheating security features and comprehensive admin management.

---

## ✨ Features

### 👨‍💼 Admin Controls
- **Dashboard Overview:** Real-time stats on active, upcoming, and completed exams.
- **Question Bank:** Add, delete, and manage questions with flexible dynamic options (fewer or more than 4) and single/multiple correct answers mapped to specific examinations.
- **Exam Manager:**
  - Create & schedule multi-exam sessions.
  - **Exam Hall Access Code:** Toggle & generate random/custom passcodes so only candidates physically in the exam hall can unlock tests.
  - Configurable duration, question count, max violation threshold, and live result publishing.
- **Live Student Monitor:** Real-time activity cards tracking student progress, time left, and violation warnings.
- **Results & Rankings:** Automatic rank computation, pass/fail thresholds, and export options.

### 👩‍🎓 Student Experience
- **Student Dashboard:** View upcoming and active exams with security requirements.
- **Exam Hall Code Protection:** Enter invigilator passcode to unlock tests.
- **Fullscreen Proctored Room:** Clean, distraction-free interface with question navigation palette.
- **Live Timer & Proctoring Status:** Constant visibility of remaining time and warning counter.
- **Instant Result & Review:** Detailed question-by-question review with correct answer highlights.

### 🛡️ Anti-Cheating & Proctoring Security
- **Mandatory Fullscreen Gate:** Fullscreen lock initiated on start; exiting triggers violation alerts.
- **Tab Switch Detection:** Page visibility monitoring detects switching to other browser tabs.
- **Window Blur Detection:** Detects Alt+Tab, minimizing, or clicking other applications.
- **Right-Click Blocked:** Context menu disabled across the portal (no false positive penalty).
- **Copy/Paste & Text Selection Blocked:** Keyboard shortcuts (`Ctrl+C`, `Ctrl+V`, `Ctrl+X`, `Ctrl+A`) blocked.
- **Developer Tools & Inspection Blocked:** `F12`, `Ctrl+Shift+I`, and inspection tools intercepted.
- **Screenshot Protection:** `PrintScreen` and screenshot shortcuts detected.
- **Reload Protection:** `F5`, `Ctrl+R`, and browser reload prompts alert students to prevent loss of progress.
- **Audio Warning Alert:** Web Audio alert chime plays on violations.
- **Auto-Submission:** Reaching the admin-set violation limit (default: 3) automatically locks and submits the exam.

### 🎨 Themes
- **Light Mode:** Crisp White + Deep Purple (`#7c3aed`)
- **Dark Mode:** Sleek Black (`#09090f`) + Electric Purple (`#9333ea`)
- **Clean SVG Line Icons:** High-end vector icons (Linear / Lucide style) without emojis.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Demo Credentials

- **Admin Account:** `admin@exam.com` / `admin123`
- **Student Account:** Any email (e.g. `student@exam.com`) / `student123`
- **Default Exam Hall Code (Physics Mid-Term):** `PHYS90`
