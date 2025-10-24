// script.js (full — ready to paste)

// -------- Firebase Configuration (replace with your own if needed) --------
const firebaseConfig = {
  apiKey: "AIzaSyABTVp797tNu353FBVLzsOp90aIX2mNF74",
  authDomain: "my-website-project2797.firebaseapp.com",
  projectId: "my-website-project2797",
  storageBucket: "my-website-project2797.appspot.com",
  messagingSenderId: "406226552922",
  appId: "1:406226552922:web:ffdf2ccf6f77a57964b063"
};

// Initialize Firebase (compat)
if (!window.firebase) {
  console.error("Firebase SDK not loaded. Make sure firebase scripts are included in HTML.");
} else {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
}
const db = firebase.firestore();

// -------- Globals --------
let currentUser = null;
const adminEmail = "gonahhomes0@gmail.com";

let bookedDates = [];      // array of YYYY-MM-DD strings for current house
let bookedSet = new Set(); // quick lookup
let checkinPicker = null;
let checkoutPicker = null;
let timePicker = null;     // preferred check-in time flatpickr instance

// -------- Inject CSS for flatpickr custom classes & legend (once) --------
(function injectStyles() {
  const id = 'flatpickr-custom-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.innerHTML = `
    /* Booked day: greyed and muted */
    .flatpickr-day.booked {
      background: #e6e6e6 !important;
      color: #8a8a8a !important;
      pointer-events: none !important;
      position: relative;
    }
    .flatpickr-day.booked::after {
      content: "Booked";
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 9px;
      color: #666;
      padding: 0 2px;
    }
    /* Available day visual (green underline) */
    .flatpickr-day.available {
      box-shadow: inset 0 -4px 0 0 rgba(34,197,94,0.25);
    }
    /* Legend styling */
    .booking-legend {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-top: 0.75rem;
      font-size: 0.9rem;
    }
    .legend-item {
      display:flex;
      align-items:center;
      gap:0.5rem;
    }
    .legend-swatch {
      width: 18px;
      height: 12px;
      border-radius: 3px;
      display:inline-block;
      border: 1px solid #ccc;
    }
    .legend-swatch.booked { background: #e6e6e6; }
    .legend-swatch.available {
      background: linear-gradient(0deg, rgba(0,0,0,0) 50%, rgba(34,197,94,0.25) 50%);
    }

    /* Modal active class (simple helper) */
    #booking-modal-bg { display: none; }
    #booking-modal-bg.active { display: block; }

    /* Prevent typing caret in date fields (user must use picker) */
    input.flatpickr-input[readonly] { cursor: pointer; }
  `;
  document.head.appendChild(style);
})();

// -------- Utilities --------
function isoDate(d) {
  return new Date(d).toISOString().split('T')[0];
}

function formatDate(dateString) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function showCustomAlert(message, type = "success") {
  const existing = document.querySelector('.custom-alert');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `custom-alert ${type}`;
  el.style.position = 'fixed';
  el.style.right = '1rem';
  el.style.bottom = '1rem';
  el.style.background = type === 'error' ? '#ffe6e6' : '#f0fff4';
  el.style.color = '#111';
  el.style.border = '1px solid #ddd';
  el.style.padding = '0.75rem 1rem';
  el.style.borderRadius = '6px';
  el.style.zIndex = 9999;
  const p = document.createElement('p'); p.style.margin = 0; p.textContent = message;
  const close = document.createElement('span');
  close.innerHTML = '&times;';
  close.style.marginLeft = '0.5rem';
  close.style.cursor = 'pointer';
  close.addEventListener('click', () => el.remove());
  el.appendChild(p);
  el.appendChild(close);
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 5000);
}

// -------- Firestore: fetch booked dates for a house --------
// Blocks days from checkin .. (checkout - 1 day). Checkout day remains selectable.
async function getBookedDates(houseName) {
  if (!houseName) return [];
  try {
    const snapshot = await db.collection("bookings").where("house", "==", houseName).get();
    const dates = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.checkin || !data.checkout) return;
      const start = new Date(data.checkin);
      const end = new Date(data.checkout);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      // Loop from start to day before checkout (exclusive)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        dates.add(isoDate(d));
      }
    });
    bookedDates = Array.from(dates).sort();
    bookedSet = new Set(bookedDates);
    console.log(`[bookings] blocked for ${houseName}:`, bookedDates);
    return bookedDates;
  } catch (err) {
    console.error("getBookedDates error:", err);
    bookedDates = []; bookedSet = new Set();
    return [];
  }
}

// -------- Flatpickr setup / re-setup --------
function setupDatePickers() {
  const checkinInputEl = document.getElementById("booking-checkin");
  const checkoutInputEl = document.getElementById("booking-checkout");
  if (!checkinInputEl || !checkoutInputEl) {
    console.warn("Checkin/Checkout inputs not found.");
    return;
  }

  // Make inputs text & readonly to force Flatpickr popup and prevent native date UI
  checkinInputEl.type = 'text';
  checkoutInputEl.type = 'text';
  checkinInputEl.setAttribute('readonly', 'readonly');
  checkoutInputEl.setAttribute('readonly', 'readonly');

  // Destroy previous flatpickr instances if they exist
  try { if (checkinPicker && checkinPicker.destroy) checkinPicker.destroy(); } catch (e) {}
  try { if (checkoutPicker && checkoutPicker.destroy) checkoutPicker.destroy(); } catch (e) {}
  checkinPicker = null; checkoutPicker = null;

  // Helper to disable booked dates
  function disableFn(date) {
    return bookedSet.has(isoDate(date));
  }

  // Common options for both pickers
  const commonOptions = {
    dateFormat: "Y-m-d",
    minDate: "today",
    allowInput: false,       // force use of picker (no manual typing)
    clickOpens: true,
    disable: [disableFn],
    onDayCreate: function(dObj, dStr, fpDayElem) {
      const iso = isoDate(fpDayElem.dateObj);
      if (bookedSet.has(iso)) {
        fpDayElem.classList.add('booked');
      } else {
        fpDayElem.classList.add('available');
      }
    },
    // Make the calendar append inside modal for correct z-index stacking
    appendTo: document.querySelector('#booking-modal-bg .modal') || document.body
  };

  // Initialize checkinPicker first (it will set checkout min on change)
  checkinPicker = flatpickr(checkinInputEl, Object.assign({}, commonOptions, {
    onChange: function(selectedDates) {
      if (!selectedDates || !selectedDates.length) return;
      const sel = selectedDates[0];
      const minCheckout = new Date(sel);
      minCheckout.setDate(minCheckout.getDate() + 1);
      if (checkoutPicker) checkoutPicker.set('minDate', minCheckout);
      // update native min fallback (if any)
      const checkoutNative = document.querySelector('#booking-checkout');
      if (checkoutNative) checkoutNative.min = isoDate(minCheckout);
      // If current checkout is before new min, clear it
      if (checkoutPicker && checkoutPicker.selectedDates && checkoutPicker.selectedDates.length) {
        const cur = checkoutPicker.selectedDates[0];
        if (cur <= sel) checkoutPicker.clear();
      }
    }
  }));

  // Initialize checkoutPicker
  checkoutPicker = flatpickr(checkoutInputEl, Object.assign({}, commonOptions, {}));
}

// -------- Add Preferred Check-in Time (clock-style) & legend to modal (only once) --------
function ensurePreferredTimeAndLegend() {
  const form = document.getElementById('booking-form');
  if (!form) return;

  // Preferred time input: use a text input enhanced by flatpickr (time-only)
  if (!document.getElementById('preferred-checkin-time')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    wrapper.style.marginTop = '0.5rem';
    wrapper.innerHTML = `<label for="preferred-checkin-time"><i class="fas fa-clock"></i> Preferred Check-in Time (optional)</label>`;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'preferred-checkin-time';
    input.name = 'preferred_checkin_time';
    input.placeholder = 'Select time';
    input.className = 'flatpickr-input';
    input.setAttribute('readonly', 'readonly'); // force using the time picker UI
    wrapper.appendChild(input);

    // Insert before the date row if possible
    const checkinRow = document.getElementById('booking-checkin')?.closest('.form-row') || document.getElementById('booking-checkin');
    if (checkinRow && checkinRow.parentNode) {
      checkinRow.parentNode.insertBefore(wrapper, checkinRow);
    } else {
      // fallback append at the end of the form
      form.insertBefore(wrapper, form.firstChild);
    }

    // Initialize flatpickr time-only on that input
    // Destroy existing if any
    try { if (timePicker && timePicker.destroy) timePicker.destroy(); } catch (e) {}
    timePicker = flatpickr(input, {
      enableTime: true,
      noCalendar: true,
      dateFormat: "h:i K", // 12-hour with AM/PM
      time_24hr: false,
      allowInput: false,
      defaultHour: 14,
      defaultMinute: 0,
      minuteIncrement: 15,
      clickOpens: true,
      appendTo: document.querySelector('#booking-modal-bg .modal') || document.body
    });
  }

  // Legend
  const modalBody = document.querySelector('#booking-modal-bg .modal-body');
  if (!modalBody) return;
  if (!modalBody.querySelector('.booking-legend')) {
    const legend = document.createElement('div');
    legend.className = 'booking-legend';
    legend.innerHTML = `
      <div class="legend-item"><span class="legend-swatch booked"></span> <span>Booked</span></div>
      <div class="legend-item"><span class="legend-swatch available"></span> <span>Available</span></div>
    `;
    // Insert near top of modal body, after header area
    modalBody.insertBefore(legend, modalBody.firstChild.nextSibling || null);
  }
}

// -------- Booking Modal open/close --------
async function openBookingModal(house) {
  try {
    const modal = document.getElementById('booking-modal-bg');
    const form = document.getElementById('booking-form');
    const confirmDiv = document.getElementById('booking-confirm');
    if (!modal || !form || !confirmDiv) {
      console.warn("Booking modal elements missing.");
      return;
    }

    // Reset + show
    form.reset();
    form.style.display = 'block';
    confirmDiv.style.display = 'none';
    document.getElementById('booking-house').value = house || '';

    // Ensure dropdown + legend exist
    ensurePreferredTimeAndLegend();

    // Fetch booked dates for the selected house then initialize datepickers
    await getBookedDates(house || '');
    setupDatePickers();

    // Set native input min attributes as fallback (useful for some browsers)
    const todayISO = isoDate(new Date());
    const checkinInput = document.getElementById('booking-checkin');
    const checkoutInput = document.getElementById('booking-checkout');
    if (checkinInput) checkinInput.min = todayISO;
    if (checkoutInput) checkoutInput.min = todayISO;

    // Attach a change listener to checkin native element (best-effort) without duplicating handlers:
    // We'll replace node to clean previous listeners, then add one that updates checkout min.
    if (checkinInput && checkinInput.parentNode) {
      const cloned = checkinInput.cloneNode(true);
      checkinInput.parentNode.replaceChild(cloned, checkinInput);
      const newCheckin = document.getElementById('booking-checkin');
      newCheckin.addEventListener('change', function () {
        const val = this.value;
        if (!val) return;
        const start = new Date(val);
        start.setDate(start.getDate() + 1);
        const minCheckoutStr = isoDate(start);
        const co = document.getElementById('booking-checkout');
        if (co) co.min = minCheckoutStr;
        if (checkoutPicker) checkoutPicker.set('minDate', start);
        // Clear checkout if before min
        if (co && co.value) {
          const cur = new Date(co.value);
          if (cur <= new Date(val)) {
            if (checkoutPicker) checkoutPicker.clear();
            else co.value = '';
          }
        }
      });
    }

    // Show modal (add active class)
    modal.classList.add('active');

    // Ensure flatpickr calendars open above other elements (z-index) by appending to modal; done in options
  } catch (err) {
    console.error("openBookingModal error:", err);
  }
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) modal.classList.remove('active');
}

// -------- Booking submit, validation & save --------
function showBookingConfirmation(bookingData) {
  const form = document.getElementById('booking-form');
  const confirmDiv = document.getElementById('booking-confirm');
  const details = document.getElementById('booking-details');
  if (!form || !confirmDiv || !details) return;
  form.style.display = 'none';
  confirmDiv.style.display = 'block';
  details.innerHTML = `
    <p><strong>Accommodation:</strong> ${bookingData.house}</p>
    <p><strong>Guest Name:</strong> ${bookingData.name}</p>
    <p><strong>Email:</strong> ${bookingData.email}</p>
    <p><strong>Phone:</strong> ${bookingData.phone}</p>
    <p><strong>Guests:</strong> ${bookingData.guests}</p>
    <p><strong>Check-in:</strong> ${formatDate(bookingData.checkin)}</p>
    <p><strong>Check-out:</strong> ${formatDate(bookingData.checkout)}</p>
    ${bookingData.preferred_checkin_time ? `<p><strong>Preferred Check-in Time:</strong> ${bookingData.preferred_checkin_time}</p>` : ''}
    ${bookingData.access ? `<p><strong>Accessibility:</strong> ${bookingData.access}</p>` : ''}
    ${bookingData.requests ? `<p><strong>Requests:</strong> ${bookingData.requests}</p>` : ''}
  `;
}

function initFormHandlers() {
  // Email form for reviews
  const emailForm = document.getElementById('email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email-input').value.trim();
      if (email && email.includes('@')) {
        currentUser = { email };
        showUserInfo(email);
      } else {
        showCustomAlert("Please enter a valid email address", "error");
      }
    });
  }

  // Sign out
  const signOutBtn = document.getElementById('signout-btn');
  if (signOutBtn) signOutBtn.addEventListener('click', () => {
    currentUser = null;
    hideUserInfo();
    const el = document.getElementById('email-input');
    if (el) el.value = '';
  });

  // Review form
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentUser) { showCustomAlert("Enter email first to leave a review", "error"); return; }
      const rating = document.querySelector('input[name="rating"]:checked')?.value || 0;
      const reviewText = document.getElementById('review-text').value.trim();
      if (!reviewText) { showCustomAlert("Please write a review", "error"); return; }
      if (!rating) { showCustomAlert("Please select a rating", "error"); return; }

      const submitBtn = reviewForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

      const reviewData = {
        review: reviewText,
        rating,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        user: { name: currentUser.email.split('@')[0], email: currentUser.email }
      };

      db.collection('reviews').add(reviewData).then(() => {
        reviewForm.reset();
        showCustomAlert("Review submitted — thank you!");
        return db.collection('notifications').add({
          type: 'new_review',
          data: reviewData,
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }).catch(err => {
        console.error("Error adding review", err);
        showCustomAlert("Error submitting review. Try again.", "error");
      }).finally(() => {
        submitBtn.disabled = false; submitBtn.innerHTML = originalText;
      });
    });
  }

  // Booking form
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(bookingForm);
      const bookingData = Object.fromEntries(fd.entries());

      // preferred checkin time (if present)
      const pref = document.getElementById('preferred-checkin-time');
      if (pref) bookingData.preferred_checkin_time = pref.value || null;

      // Basic validation
      const required = ['house', 'name', 'guests', 'checkin', 'checkout', 'phone', 'email'];
      for (const key of required) {
        if (!bookingData[key] || bookingData[key].toString().trim() === '') {
          showCustomAlert("Please fill all required booking fields.", "error");
          return;
        }
      }

      const checkinDate = new Date(bookingData.checkin);
      const checkoutDate = new Date(bookingData.checkout);
      const today = new Date(); today.setHours(0,0,0,0);

      if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
        showCustomAlert("Invalid dates provided.", "error"); return;
      }
      if (checkinDate < today) { showCustomAlert("Check-in date cannot be in the past.", "error"); return; }
      if (checkoutDate <= checkinDate) { showCustomAlert("Check-out must be after check-in.", "error"); return; }

      // Server-side overlap check against current bookedSet
      for (let d = new Date(checkinDate); d < checkoutDate; d.setDate(d.getDate() + 1)) {
        if (bookedSet.has(isoDate(d))) {
          showCustomAlert("Selected dates overlap with an existing booking. Choose different dates.", "error");
          return;
        }
      }

      // Save booking
      const submitBtn = bookingForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

      try {
        // Save booking doc
        await db.collection('bookings').add({
          ...bookingData,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'pending'
        });

        // notify admin
        await db.collection('notifications').add({
          type: 'new_booking',
          data: { ...bookingData },
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Show in-UI confirmation
        showBookingConfirmation(bookingData);

        // Locally block new dates immediately in this session
        for (let d = new Date(checkinDate); d < checkoutDate; d.setDate(d.getDate() + 1)) {
          bookedSet.add(isoDate(d));
        }
        // Rebuild pickers to reflect new local blocks
        setupDatePickers();

      } catch (err) {
        console.error("Error saving booking:", err);
        showCustomAlert("Error processing booking. Try again.", "error");
      } finally {
        submitBtn.disabled = false; submitBtn.innerHTML = originalText;
      }
    });
  }

  // Contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const message = document.getElementById('contact-message').value.trim();
      if (!name || !email || !message) { showCustomAlert("Please fill all contact fields.", "error"); return; }

      const submitBtn = contactForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

      db.collection('messages').add({
        name, email, message, timestamp: firebase.firestore.FieldValue.serverTimestamp(), status: 'new'
      }).then(() => {
        contactForm.reset();
        showCustomAlert("Message sent — we'll be in touch!");
        return db.collection('notifications').add({
          type: 'new_message',
          data: { name, email, message },
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }).catch(err => {
        console.error("Error sending message:", err);
        showCustomAlert("Error sending message. Try again.", "error");
      }).finally(() => {
        submitBtn.disabled = false; submitBtn.innerHTML = originalText;
      });
    });
  }
}

// -------- Testimonials loader --------
function renderTestimonials(reviews) {
  const grid = document.getElementById('testimonials-grid');
  if (!grid) return;
  if (!reviews || reviews.length === 0) {
    grid.innerHTML = `<p>No reviews yet.</p>`;
    return;
  }
  let html = '';
  reviews.slice(0,6).forEach(r => {
    const name = r.user?.name || (r.user?.email ? r.user.email.split('@')[0] : 'Guest');
    const date = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleDateString() : '';
    html += `
      <div class="testimonial-card">
        <div class="testimonial-rating">${'★'.repeat(Number(r.rating || 5))}</div>
        <p class="testimonial-text">"${r.review}"</p>
        <div class="testimonial-author">
          <div class="author-info"><h4>${name}</h4><span>${date}</span></div>
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

function loadReviews() {
  db.collection('reviews').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
    const reviews = [];
    snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
    renderTestimonials(reviews);
  }, err => {
    console.error("loadReviews error:", err);
    renderTestimonials([]);
  });
}

// -------- Small UI helpers & init routines --------
function showUserInfo(email) {
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const emailForm = document.getElementById('email-form');
  const reviewForm = document.getElementById('review-form');
  if (userInfo && userName && userEmail && emailForm && reviewForm) {
    userInfo.style.display = 'block';
    userName.textContent = email.split('@')[0];
    userEmail.textContent = email;
    reviewForm.style.display = 'block';
    emailForm.style.display = 'none';
  }
}
function hideUserInfo() {
  const userInfo = document.getElementById('user-info');
  const emailForm = document.getElementById('email-form');
  const reviewForm = document.getElementById('review-form');
  if (userInfo && emailForm && reviewForm) {
    userInfo.style.display = 'none';
    reviewForm.style.display = 'none';
    emailForm.style.display = 'block';
  }
}

function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  if (!hamburger || !navMenu) return;
  hamburger.addEventListener('click', (e) => { e.preventDefault(); navMenu.classList.toggle('active'); hamburger.classList.toggle('active'); });
  navMenu.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', () => { navMenu.classList.remove('active'); hamburger.classList.remove('active'); }));
}

function initModalHandlers() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeBookingModal(); });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBookingModal(); });
}

function initSlideshow() {
  let slideIndex = 0;
  const slides = document.querySelectorAll('.slide');
  const indicators = document.querySelectorAll('.indicator');
  if (!slides.length) return;
  function show(i) {
    slides.forEach(s => s.classList.remove('active'));
    indicators.forEach(ind => ind.classList.remove('active'));
    slides[i].classList.add('active');
    if (indicators[i]) indicators[i].classList.add('active');
  }
  setInterval(() => { slideIndex = (slideIndex + 1) % slides.length; show(slideIndex); }, 5000);
}

// Admin modal (simple local check)
function openAdminModal() { const modal = document.getElementById('admin-login-modal'); if (modal) modal.style.display = 'flex'; }
function closeAdminModal() { const modal = document.getElementById('admin-login-modal'); if (modal) { modal.style.display = 'none'; const f = document.getElementById('admin-login-form'); if (f) f.reset(); const e = document.getElementById('admin-login-error'); if (e) e.style.display = 'none'; } }
function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('admin-login-error');
  const creds = { username: 'gonahhomes0@gmail.com', password: 'gonahhomes@0799466723' };
  if (username === creds.username && password === creds.password) {
    closeAdminModal();
    window.open('backend/dashboard.html', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
  } else {
    if (errorDiv) { errorDiv.style.display = 'block'; errorDiv.textContent = 'Invalid credentials. Please try again.'; }
  }
}

function initAdminAccess() {
  const adminBtn = document.getElementById('admin-access-btn'); if (adminBtn) adminBtn.addEventListener('click', openAdminModal);
  const adminForm = document.getElementById('admin-login-form'); if (adminForm) adminForm.addEventListener('submit', handleAdminLogin);
  const adminModal = document.getElementById('admin-login-modal'); if (adminModal) adminModal.addEventListener('click', (e) => { if (e.target === adminModal) closeAdminModal(); });
}

// Smooth scrolling for internal anchors
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// Init everything on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initFormHandlers();
  initSmoothScrolling();
  initModalHandlers();
  initAdminAccess();
  initSlideshow();
  loadReviews();
  hideUserInfo();
  console.log("script.js initialized — Flatpickr and bookings ready.");
});

// Expose functions for HTML buttons
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.scrollToSection = function(id){ const el = document.getElementById(id); if (el) el.scrollIntoView({behavior:'smooth'}); };
window.currentSlide = function(i){ /* optional: used by indicators */ };
