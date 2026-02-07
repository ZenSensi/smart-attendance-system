import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("register-form");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm-password");
const errorMsg = document.getElementById("error-msg");
const successMsg = document.getElementById("success-msg");
const registerBtn = document.getElementById("register-btn");

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = "block";
    successMsg.style.display = "none";
}

function showSuccess(message) {
    successMsg.textContent = message;
    successMsg.style.display = "block";
    errorMsg.style.display = "none";
}

function hideMessages() {
    errorMsg.style.display = "none";
    successMsg.style.display = "none";
}

function setLoading(loading) {
    registerBtn.disabled = loading;
    registerBtn.innerHTML = loading
        ? '<span class="spinner"></span> Creating account...'
        : 'Create Account';
}


form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessages();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const role = "student";

    // Validate passwords match
    if (password !== confirmPassword) {
        showError("Passwords do not match.");
        return;
    }

    setLoading(true);

    try {
        // Create user with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update display name
        await updateProfile(user, { displayName: name });

        // Store user data in Firestore
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
            role: role,
            createdAt: Timestamp.now()
        });

        showSuccess("Account created successfully! Redirecting...");

        window.location.href = "student/student.html";

    } catch (error) {
        console.error("Registration error:", error);

        switch (error.code) {
            case "auth/email-already-in-use":
                showError("This email is already registered.");
                break;
            case "auth/invalid-email":
                showError("Invalid email address.");
                break;
            case "auth/weak-password":
                showError("Password is too weak. Use at least 6 characters.");
                break;
            default:
                showError("Registration failed. Please try again.");
        }
        setLoading(false);
    }
});
