# 📋 ATTENDIX - Smart Attendance System

A modern, QR-based digital attendance tracking system built with Firebase and vanilla JavaScript. Features secure time-limited QR codes, real-time attendance tracking, and role-based dashboards for admins and students.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Firebase](https://img.shields.io/badge/Firebase-10.7.1-orange.svg)
![Status](https://img.shields.io/badge/status-Active-green.svg)

---

## 🚀 Features

### For Admins
- **QR Code Generation** - Generate time-limited QR codes (45-minute validity)
- **Real-time Dashboard** - View attendance statistics at a glance
- **Attendance Records** - Filter by date and subject
- **CSV Export** - Download attendance reports for record-keeping
- **Secure Authentication** - Firebase-based login system

### For Students
- **QR Scanner** - Scan QR codes using device camera
- **Attendance History** - View personal attendance records
- **Statistics** - Track total classes, present count, and attendance percentage
- **Duplicate Prevention** - System prevents multiple scans for same session

### Security
- ⏱️ **Time-Limited QR Codes** - Codes expire after 45 minutes
- 🔒 **Proxy Prevention** - One scan per student per session
- 🔐 **Role-Based Access** - Separate dashboards for admin and students
- ☁️ **Cloud Storage** - Secure data storage with Firebase Firestore

---

## 📁 Project Structure

```
smart-attendance-system-project/
├── index.html              # Landing page
├── login.html              # User login (ATTENDIX design)
├── login.js                # Login authentication logic
├── register.html           # User registration (ATTENDIX design)
├── register.js             # Registration logic
├── firebase.js             # Firebase configuration
├── styles.css              # Global styles (ATTENDIX theme)
├── admin/
│   ├── admin.html          # Admin dashboard
│   └── admin.js            # Admin functionality (QR gen, records)
├── student/
│   ├── student.html        # Student dashboard
│   └── student.js          # Student functionality (QR scan, history)
└── UXUI/                   # Design mockups
    ├── Log In.png
    ├── Log In (Admin).png
    ├── Register.png
    └── Register (Admin).png
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5/CSS3** | Frontend structure and styling |
| **Vanilla JavaScript** | Application logic (ES Modules) |
| **Firebase Auth** | User authentication |
| **Firebase Firestore** | Real-time database |
| **QRCode.js** | QR code generation |
| **html5-qrcode** | QR code scanning |

---

## ⚙️ Setup & Installation

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Firebase project (already configured)
- Local server for development (optional)

### Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/ZenSensi/smart-attendance-system.git
   cd smart-attendance-system-project
   ```

2. **Open in browser**
   - Simply open `index.html` in your browser
   - Or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (npx)
   npx serve
   ```

3. **Access the application**
   - Navigate to `http://localhost:8000` (if using local server)
   - Or open `index.html` directly

---

## 🔧 Firebase Configuration

The Firebase configuration is stored in `firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "smart-attendance-system-ff889.firebaseapp.com",
  projectId: "smart-attendance-system-ff889"
};
```

### Firestore Database Structure

```
users/
  └── {uid}/
      ├── name: string
      ├── email: string
      ├── role: "admin" | "student"
      └── createdAt: timestamp

attendance/
  └── {attendanceId}/
      ├── studentId: string
      ├── studentName: string
      ├── subject: string
      ├── sessionId: string
      ├── timestamp: timestamp
      └── status: "present"

sessions/
  └── {sessionId}/
      ├── subject: string
      ├── adminId: string
      ├── createdAt: timestamp
      └── expiresAt: timestamp
```

---

## 📱 Usage

### Admin Workflow
1. Login with admin credentials
2. Enter subject name and click "Generate QR Code"
3. Display QR code to students (valid for 45 minutes)
4. View real-time attendance as students scan
5. Filter and export attendance records

### Student Workflow
1. Login with student credentials
2. Click "Start Scanner" to activate camera
3. Scan the QR code displayed by admin
4. View confirmation of attendance marked
5. Check attendance history in dashboard

---

## 🎨 Design Theme

The application uses the **ATTENDIX** design language:
- **Colors**: Navy blue (`#1e2a47`), dark slate (`#151d30`), accent purple (`#7c8cff`)
- **Typography**: Inter font family
- **Layout**: Two-panel authentication, underline-style inputs
- **Style**: Modern, minimal, dark theme

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📞 Support

For support, please open an issue in the repository or contact the development team.
