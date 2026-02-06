import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("error-msg");
const loginBtn = document.getElementById("login-btn");

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = "block";
}

function hideError() {
    errorMsg.style.display = "none";
}

function setLoading(loading) {
    loginBtn.disabled = loading;
    loginBtn.innerHTML = loading
        ? '<span class="spinner"></span> Signing in...'
        : 'Sign In';
}

function getSelectedRole() {
    return document.querySelector('input[name="role"]:checked').value;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    setLoading(true);

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const selectedRole = getSelectedRole();

    try {
        // Sign in with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get user role from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            showError("User profile not found. Please register first.");
            setLoading(false);
            return;
        }

        const userData = userDoc.data();
        const actualRole = userData.role;

        // Check if selected role matches actual role
        if (actualRole !== selectedRole) {
            showError(`Invalid login. You are registered as ${actualRole}, not ${selectedRole}.`);
            await auth.signOut();
            setLoading(false);
            return;
        }

        // Redirect based on role
        if (actualRole === "admin") {
            window.location.href = "admin/admin.html";
        } else {
            window.location.href = "student/student.html";
        }

    } catch (error) {
        console.error("Login error:", error);

        switch (error.code) {
            case "auth/user-not-found":
                showError("No account found with this email.");
                break;
            case "auth/wrong-password":
                showError("Incorrect password.");
                break;
            case "auth/invalid-email":
                showError("Invalid email address.");
                break;
            case "auth/too-many-requests":
                showError("Too many attempts. Please try again later.");
                break;
            default:
                showError("Login failed. Please try again.");
        }
        setLoading(false);
    }
});
