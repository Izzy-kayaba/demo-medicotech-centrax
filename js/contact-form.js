
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".form");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.textContent : "Send Enquiry";
  const toastContainer = document.getElementById("toast-container");

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // --- 1. Toast Notification Helper ---
  function showToast(message, type = "success") {
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    const icon = type === "success" ? "✓" : "⚠";

    toast.innerHTML = `
      <span class="toast__icon" aria-hidden="true">${icon}</span>
      <div class="toast__content">
        <p class="toast__title">${type === "success" ? "Success" : "Submission Error"}</p>
        <p class="toast__message">${escapeHtml(message)}</p>
      </div>
      <button type="button" class="toast__close" aria-label="Close notification">&times;</button>
    `;

    toastContainer.appendChild(toast);

    const timer = setTimeout(() => dismissToast(toast), 6000);

    toast.querySelector(".toast__close").addEventListener("click", () => {
      clearTimeout(timer);
      dismissToast(toast);
    });
  }

  function dismissToast(toast) {
    toast.classList.add("toast--hiding");
    toast.addEventListener("animationend", () => toast.remove());
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  // --- 2. Validation Helpers ---
  function clearErrors() {
    form.querySelectorAll(".field-error").forEach((el) => el.remove());
    form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  }

  function setError(field, message) {
    field.classList.add("invalid");
    const errorSpan = document.createElement("span");
    errorSpan.className = "field-error";
    errorSpan.textContent = message;
    field.parentNode.appendChild(errorSpan);
  }

  function validateForm() {
    clearErrors();
    let isValid = true;

    const firstName = form.querySelector("#first-name");
    const lastName = form.querySelector("#last-name");
    const email = form.querySelector("#email");
    const enquiry = form.querySelector("#enquiry");
    const message = form.querySelector("#message");

    if (!firstName.value.trim() || firstName.value.trim().length < 2) {
      setError(firstName, "Please enter a valid first name (min 2 characters).");
      isValid = false;
    }

    if (!lastName.value.trim() || lastName.value.trim().length < 2) {
      setError(lastName, "Please enter a valid last name (min 2 characters).");
      isValid = false;
    }

    if (!email.value.trim() || !EMAIL_REGEX.test(email.value.trim())) {
      setError(email, "Please enter a valid email address.");
      isValid = false;
    }

    if (!enquiry.value) {
      setError(enquiry, "Please select an enquiry type.");
      isValid = false;
    }

    if (!message.value.trim() || message.value.trim().length < 10) {
      setError(message, "Please enter a message of at least 10 characters.");
      isValid = false;
    }

    return isValid;
  }

  // --- 3. Form Submission Handling ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Prevent duplicate submission & show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    const payload = {
      "First Name": form.querySelector("#first-name").value.trim(),
      "Last Name": form.querySelector("#last-name").value.trim(),
      "_replyto": form.querySelector("#email").value.trim(),
      "Organisation": form.querySelector("#organisation").value.trim() || "N/A",
      "Enquiry Type": form.querySelector("#enquiry").value,
      "Message": form.querySelector("#message").value.trim(),
      "_cc": "platforms@centraxdigital.com",
      "_subject": `New MedicoTech Enquiry: ${form.querySelector("#enquiry").value}`,
      "_captcha": "false",
    };

    try {
      const response = await fetch("https://formsubmit.co/ajax/96e8882e382d433997f393894643b5c6", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && (result.success === "true" || result.success === true)) {
        showToast("Your enquiry has been sent successfully! Our team will get back to you shortly.", "success");
        form.reset();
      } else {
        throw new Error(result.message || "Failed to submit enquiry. Please try again.");
      }
    } catch (err) {
      showToast("There was an issue submitting your form. Please check your connection or try again later.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
});
