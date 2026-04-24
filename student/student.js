import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc, getDoc, setDoc, getDocs, collection, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let html5QrCode = null;
let isScanning = false;
let currentUser = null;
let currentUserData = null;

// Check auth and role
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../login.html";
        return;
    }

    // Verify student role
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists() || userDoc.data().role !== "student") {
        alert("Access denied. Students only.");
        window.location.href = "../login.html";
        return;
    }

    currentUser = user;
    currentUserData = userDoc.data();
    document.getElementById("student-name").textContent = currentUserData.name;

    loadStats();
    loadAttendanceHistory();
});

// Logout function
window.logout = async function () {
    if (html5QrCode && isScanning) {
        await html5QrCode.stop();
    }
    await signOut(auth);
    window.location.href = "../login.html";
};

// Load stats
async function loadStats() {
    try {
        // Get total unique lectures (sessions created)
        const lecturesSnap = await getDocs(collection(db, "lectures"));
        const totalClasses = lecturesSnap.size;
        document.getElementById("total-classes").textContent = totalClasses;

        // Get student's attendance records
        const attendanceSnap = await getDocs(
            query(collection(db, "attendance"), where("studentId", "==", currentUser.uid))
        );
        const presentCount = attendanceSnap.size;
        document.getElementById("present-count").textContent = presentCount;

        // Calculate percentage
        const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
        document.getElementById("attendance-percent").textContent = percentage + "%";

    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

// Start QR Scanner
window.startScan = async function () {
    const scanBtn = document.getElementById("scan-btn");
    const resultDiv = document.getElementById("scan-result");
    resultDiv.style.display = "none";

    if (isScanning) {
        // Stop scanning
        await html5QrCode.stop();
        isScanning = false;
        scanBtn.innerHTML = "Start Scanner";
        return;
    }

    // Get location before scanning
    let latitude = null;
    let longitude = null;
    try {
        scanBtn.innerHTML = "Getting location...";
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation not supported"));
            } else {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            }
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
    } catch (err) {
        console.error("Location error:", err);
        showResult("error", "Failed to get location. Ensure GPS is enabled.");
        scanBtn.innerHTML = "Start Scanner";
        return;
    }

    scanBtn.innerHTML = "Stop Scanner";
    isScanning = true;

    html5QrCode = new Html5Qrcode("reader");

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            async (decodedText) => {
                // Stop scanner after successful scan
                await html5QrCode.stop();
                isScanning = false;
                scanBtn.innerHTML = "Start Scanner";

                // Mark attendance with token and coords
                await markAttendance(decodedText, latitude, longitude);
            },
            (errorMessage) => {
                // QR scan error - ignore, keep scanning
            }
        );
    } catch (error) {
        console.error("Scanner error:", error);
        showResult("error", "Failed to start camera. Please allow camera access.");
        isScanning = false;
        scanBtn.innerHTML = "Start Scanner";
    }
};

// Haversine formula to calculate distance in meters
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radius of the earth in m
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

// Mark attendance
async function markAttendance(lectureId, latitude, longitude) {
    const resultDiv = document.getElementById("scan-result");
    showResult("warning", "⏳ Processing attendance, verifying location...");

    try {
        // Get lecture details
        const lecSnap = await getDoc(doc(db, "lectures", lectureId));

        if (!lecSnap.exists()) {
            showResult("error", "❌ Invalid QR code. This session does not exist.");
            return;
        }

        const lectureData = lecSnap.data();
        const expiresAt = lectureData.expiresAt.toMillis();

        // Check if QR is expired
        if (Date.now() > expiresAt) {
            showResult("error", "⏰ QR code has expired. Ask your teacher for a new one.");
            return;
        }

        // Verify Location Match
        if (lectureData.latitude && lectureData.longitude && latitude && longitude) {
            const dist = getDistanceFromLatLonInM(
                lectureData.latitude, lectureData.longitude,
                latitude, longitude
            );
            
            if (dist > 100) { 
                showResult("error", `❌ You are too far from the classroom (${Math.round(dist)}m away). You must be within 100 meters.`);
                return;
            }
        } else if (lectureData.latitude && (!latitude || !longitude)) {
            showResult("error", "❌ Please enable GPS/Location services to mark attendance for this session.");
            return;
        }

        // Check if already marked
        const attendanceId = `${lectureId}_${currentUser.uid}`;
        const existingAttendance = await getDoc(doc(db, "attendance", attendanceId));

        if (existingAttendance.exists()) {
            showResult("warning", "⚠️ You have already marked attendance for this session.");
            return;
        }

        // Mark attendance locally
        await setDoc(doc(db, "attendance", attendanceId), {
            lectureId: lectureId,
            studentId: currentUser.uid,
            studentName: currentUserData.name,
            subject: lectureData.subject || "Unknown",
            timestamp: new Date(),
            status: "present",
            latitude: latitude,
            longitude: longitude
        });

        showResult("success", `✅ Attendance marked for <strong>${lectureData.subject || 'this session'}</strong>!`);

        // Lock the scanner visually
        const scanBtn = document.getElementById("scan-btn");
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.innerHTML = "Attendance Locked 🔒";
            scanBtn.style.opacity = "0.6";
            scanBtn.style.cursor = "not-allowed";
            scanBtn.onclick = null; // Remove click listener
        }

        // Reload stats and history
        loadStats();
        loadAttendanceHistory();

    } catch (error) {
        console.error("Error marking attendance:", error);
        showResult("error", `❌ Failed: ${error.message || "Please try again."}`);
    }
}

// Show result message
function showResult(type, message) {
    const resultDiv = document.getElementById("scan-result");
    resultDiv.style.display = "block";

    const bgColor = type === "success" ? "rgba(34, 197, 94, 0.15)" :
        type === "warning" ? "rgba(245, 158, 11, 0.15)" :
            "rgba(239, 68, 68, 0.15)";
    const borderColor = type === "success" ? "rgba(34, 197, 94, 0.3)" :
        type === "warning" ? "rgba(245, 158, 11, 0.3)" :
            "rgba(239, 68, 68, 0.3)";
    const textColor = type === "success" ? "#86efac" :
        type === "warning" ? "#fcd34d" :
            "#fca5a5";

    resultDiv.innerHTML = `
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; color: ${textColor}; padding: 16px; border-radius: 8px;">
            ${message}
        </div>
    `;
}

// Load attendance history
async function loadAttendanceHistory() {
    const tableBody = document.getElementById("attendance-table");

    try {
        const snapshot = await getDocs(
            query(
                collection(db, "attendance"),
                where("studentId", "==", currentUser.uid)
            )
        );

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No attendance records yet</td></tr>';
            return;
        }

        tableBody.innerHTML = "";

        // Sort on client side to avoid needing composite index in Firebase
        const records = [];
        snapshot.forEach(docSnap => {
            records.push(docSnap.data());
        });

        records.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

        records.forEach(data => {
            const timestamp = data.timestamp.toDate();

            tableBody.innerHTML += `
                <tr>
                    <td>${data.subject || 'N/A'}</td>
                    <td>${timestamp.toLocaleDateString()}</td>
                    <td>${timestamp.toLocaleTimeString()}</td>
                    <td><span class="badge badge-success">Present</span></td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Error loading history:", error);
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--error);">Error loading records</td></tr>';
    }
}
