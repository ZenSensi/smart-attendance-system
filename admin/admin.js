import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, addDoc, getDocs, query, where, orderBy, Timestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentQRExpiry = null;
let timerInterval = null;
let subjects = new Set();

// Check auth and role
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../login.html";
        return;
    }

    // Verify admin role
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists() || userDoc.data().role !== "admin") {
        alert("Access denied. Admin only.");
        window.location.href = "../login.html";
        return;
    }

    document.getElementById("admin-name").textContent = userDoc.data().name;
    loadStats();
    loadAttendance();
});

// Logout function
window.logout = async function () {
    await signOut(auth);
    window.location.href = "../login.html";
};

// Load dashboard stats
async function loadStats() {
    try {
        // Total sessions
        const sessionsSnap = await getDocs(collection(db, "lectures"));
        document.getElementById("total-sessions").textContent = sessionsSnap.size;

        // Today's attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        const attendanceSnap = await getDocs(
            query(collection(db, "attendance"), where("timestamp", ">=", todayTimestamp))
        );
        document.getElementById("today-attendance").textContent = attendanceSnap.size;

        // Active students (unique students who attended in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysTimestamp = Timestamp.fromDate(thirtyDaysAgo);

        const recentSnap = await getDocs(
            query(collection(db, "attendance"), where("timestamp", ">=", thirtyDaysTimestamp))
        );
        const uniqueStudents = new Set();
        recentSnap.forEach(doc => uniqueStudents.add(doc.data().studentId));
        document.getElementById("active-students").textContent = uniqueStudents.size;

    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

// Generate QR Code
window.generateQR = async function () {
    const subjectInput = document.getElementById("subject-input");
    const subject = subjectInput.value.trim();

    const expiryInput = document.getElementById("expiry-time");
    let expiryMinutes = parseInt(expiryInput ? expiryInput.value : 50);
    if (isNaN(expiryMinutes) || expiryMinutes < 1) {
        expiryMinutes = 50; // fallback to 50 mins
    }

    if (!subject) {
        alert("Please enter a subject name.");
        return;
    }

    try {
        document.getElementById("qr-container").innerHTML = "<p>Getting location...</p>";
        document.getElementById("qr-container").style.display = "inline-block";
        document.getElementById("qr-info").style.display = "none";

        // 1. Get GPS coordinates
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser"));
            } else {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            }
        });

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        document.getElementById("qr-container").innerHTML = "<p>Generating session...</p>";

        const now = Date.now();
        const expiresAt = now + expiryMinutes * 60 * 1000; // dynamic minutes

        // Create lecture document with GPS
        const lectureRef = await addDoc(collection(db, "lectures"), {
            subject: subject,
            createdAt: Timestamp.now(),
            expiresAt: Timestamp.fromMillis(expiresAt),
            createdBy: auth.currentUser.uid,
            latitude: latitude,
            longitude: longitude
        });

        // Generate QR code with lecture ID
        const qrContainer = document.getElementById("qr-container");
        qrContainer.innerHTML = "";

        new QRCode(qrContainer, {
            text: lectureRef.id,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff"
        });

        // Show QR info
        document.getElementById("qr-info").style.display = "block";
        document.getElementById("qr-subject").textContent = subject;

        // Start countdown timer
        currentQRExpiry = expiresAt;
        startTimer();

        // Add subject to filter dropdown
        subjects.add(subject);
        updateSubjectFilter();

        // Reload stats
        loadStats();

    } catch (error) {
        console.error("Error generating QR:", error);
        alert(`Failed to generate QR code: ${error.message || error.code}. Ensure location services are enabled.`);
        document.getElementById("qr-container").innerHTML = "";
        document.getElementById("qr-container").style.display = "none";
    }
};

// Timer countdown
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const remaining = currentQRExpiry - Date.now();

        if (remaining <= 0) {
            clearInterval(timerInterval);
            document.getElementById("qr-timer").textContent = "EXPIRED";
            document.getElementById("qr-timer").style.color = "var(--error)";
            return;
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        document.getElementById("qr-timer").textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Load attendance records
window.loadAttendance = async function () {
    const tableBody = document.getElementById("attendance-table");
    const filterDate = document.getElementById("filter-date").value;
    const filterSubject = document.getElementById("filter-subject").value;

    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';

    try {
        let q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));

        const snapshot = await getDocs(q);
        const records = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const timestamp = data.timestamp.toDate();
            const dateStr = timestamp.toISOString().split('T')[0];

            // Apply filters
            if (filterDate && dateStr !== filterDate) return;
            if (filterSubject && data.subject !== filterSubject) return;

            records.push({
                ...data,
                timestamp: timestamp
            });

            // Track subjects for filter
            if (data.subject) subjects.add(data.subject);
        });

        updateSubjectFilter();

        if (records.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No records found</td></tr>';
            return;
        }

        // SMART LAYER: Anomaly Detection
        const deviceCounts = {};
        const ipCounts = {};

        records.forEach(r => {
            if (!deviceCounts[r.lectureId]) deviceCounts[r.lectureId] = {};
            if (!ipCounts[r.lectureId]) ipCounts[r.lectureId] = {};

            if (r.deviceId) {
                deviceCounts[r.lectureId][r.deviceId] = (deviceCounts[r.lectureId][r.deviceId] || 0) + 1;
            }
            if (r.ipAddress && r.ipAddress !== "Unknown IP") {
                ipCounts[r.lectureId][r.ipAddress] = (ipCounts[r.lectureId][r.ipAddress] || 0) + 1;
            }
        });

        tableBody.innerHTML = records.map(record => {
            let flags = [];
            
            // Check Smart Layer Rules
            if (record.deviceId && deviceCounts[record.lectureId][record.deviceId] > 1) {
                flags.push('<span title="Same device used by multiple students" style="cursor:help; background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">🚩 Shared Device</span>');
            }
            if (record.ipAddress && record.ipAddress !== "Unknown IP" && ipCounts[record.lectureId][record.ipAddress] > 1) {
                flags.push('<span title="Same network/IP used by multiple students" style="cursor:help; background: #fef3c7; color: #f59e0b; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">⚠️ Shared IP</span>');
            }
            if (record.scanDuration && record.scanDuration < 2000) { 
                flags.push('<span title="Suspiciously fast scan" style="cursor:help; background: #e0e7ff; color: #6366f1; padding: 2px 6px; border-radius: 4px;">⏱️ Fast Scan</span>');
            }

            const flagHtml = flags.length > 0 ? `<div style="font-size: 0.75em; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">${flags.join('')}</div>` : '';

            return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${record.studentName || record.studentId}</div>
                    ${flagHtml}
                </td>
                <td>${record.subject || 'N/A'}</td>
                <td>${record.timestamp.toLocaleDateString()}</td>
                <td>${record.timestamp.toLocaleTimeString()}</td>
                <td><span class="badge badge-success">Present</span></td>
            </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading attendance:", error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error);">Error loading records</td></tr>';
    }
};

// Update subject filter dropdown
function updateSubjectFilter() {
    const select = document.getElementById("filter-subject");
    const currentValue = select.value;

    select.innerHTML = '<option value="">All Subjects</option>';
    subjects.forEach(subject => {
        select.innerHTML += `<option value="${subject}" ${subject === currentValue ? 'selected' : ''}>${subject}</option>`;
    });
}

// Export to CSV
window.exportCSV = async function () {
    try {
        const snapshot = await getDocs(query(collection(db, "attendance"), orderBy("timestamp", "desc")));

        if (snapshot.empty) {
            alert("No records to export.");
            return;
        }

        let csv = "Student Name,Student ID,Subject,Date,Time,Status\n";

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const timestamp = data.timestamp.toDate();
            csv += `"${data.studentName || 'N/A'}","${data.studentId}","${data.subject || 'N/A'}","${timestamp.toLocaleDateString()}","${timestamp.toLocaleTimeString()}","Present"\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Error exporting CSV:", error);
        alert("Failed to export CSV.");
    }
};
