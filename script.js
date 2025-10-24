// script.js (paste as a single file; overwrite existing script.js)

// ---------- Firebase configuration (your values) ----------
const firebaseConfig = {
  apiKey: "AIzaSyABTVp797tNu353FBVLzsOp90aIX2mNF74",
  authDomain: "my-website-project2797.firebaseapp.com",
  projectId: "my-website-project2797",
  storageBucket: "my-website-project2797.appspot.com",
  messagingSenderId: "406226552922",
  appId: "1:406226552922:web:ffdf2ccf6f77a57964b063"
};

// Initialize Firebase (compat)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ---------- State ----------
let bookedDates = [];       // string array YYYY-MM-DD
let bookedSet = new Set();  // quick lookup
let checkinPicker = null;
let checkoutPicker = null;
let timePicker = null;

// ---------- Inject style for legend/flatpickr (already present in HTML but keep safe) ----------
(function injectStyles() {
  const id = 'app-flatpickr-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.innerHTML = `
    .flatpickr-day.booked { background:#e6e6e6 !important; color:#8a8a8a !important; pointer-events:none; position: relative; }
    .flatpickr-day.booked::after { content: "Booked"; position:absolute; bottom:2px; left:50%; transform:translateX(-50%); font-size:9px; color:#666; }
    .flatpickr-day.available { box-shadow: inset 0 -4px 0 0 rgba(34,197,94,0.25); }
  `;
  document.head.appendChild(style);
})();

// ---------- Utility: format date to ISO YYYY-MM-DD ----------
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------- Fetch booked dates for a house (handles both "house" and "houseId" fields) ----------
async function getBookedDates(houseName) {
  bookedSet = new Set();
  bookedDates = [];

  try {
    // Query where "house" == houseName
    const q1 = await db.collection("bookings").where("house", "==", houseName).get();
    // Query where "houseId" == houseName
    const q2 = await db.collection("bookings").where("houseId", "==", houseName).get();

    const docs = [];
    q1.forEach(d => docs.push(d));
    q2.forEach(d => {
      // avoid double counting same doc id
      if (!docs.find(x => x.id === d.id)) docs.push(d);
    });

    docs.forEach(doc => {
      const data = doc.data();
      // Accept either checkIn/checkOut or checkin/checkout stored fields
      const startStr = data.checkIn || data.checkin || data.check_in || null;
      const endStr = data.checkOut || data.checkout || data.check_out || null;
      if (!startStr || !endStr) return;
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      // Block days from start (inclusive) to day before end (exclusive)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        bookedSet.add(toISODate(d));
      }
    });

    bookedDates = Array.from(bookedSet).sort();
    console.log('bookedDates:', bookedDates);
    return bookedDates;
  } catch (err) {
    console.error('Error fetching bookings:', err);
    bookedSet = new Set();
    bookedDates = [];
    return [];
  }
}

// ---------- Setup/refresh flatpickr instances ----------
function setupDatePickers() {
  const checkinInput = document.getElementById('booking-checkin');
  const checkoutInput = document.getElementById('booking-checkout');

  if (!checkinInput || !checkoutInput) return;

  // Destroy previous instances if exist
  if (checkinPicker && typeof checkinPicker.destroy === 'function') { checkinPicker.destroy(); checkinPicker = null; }
  if (checkoutPicker && typeof checkoutPicker.destroy === 'function') { checkoutPicker.destroy(); checkoutPicker = null; }

  // disable function: disable days that are booked
  const disableFn = function(date) {
    return bookedSet.has(toISODate(date));
  };

  // create checkoutPicker first (we will reference it in checkin onChange)
  checkoutPicker = flatpickr(checkoutInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [disableFn],
    onDayCreate: function(dObj, dStr, fpDayElem) {
      const iso = toISODate(fpDayElem.dateObj);
      if (bookedSet.has(iso)) fpDayElem.classList.add('booked'); else fpDayElem.classList.add('available');
    }
  });

  checkinPicker = flatpickr(checkinInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [disableFn],
    onChange: function(selectedDates) {
      if (selectedDates.length === 0) return;
      const sel = selectedDates[0];
      // set checkout min to next day after selected checkin
      const minCheckout = new Date(sel);
      minCheckout.setDate(minCheckout.getDate() + 1);
      if (checkoutPicker) checkoutPicker.set('minDate', minCheckout);

      // if currently selected checkout is <= sel then clear it
      const curCheckoutVal = checkoutInput.value;
      if (curCheckoutVal) {
        const cur = new Date(curCheckoutVal + 'T00:00:00');
        if (cur <= sel) {
          if (checkoutPicker) checkoutPicker.clear();
          else checkoutInput.value = '';
        }
      }
    },
    onDayCreate: function(dObj, dStr, fpDayElem) {
      const iso = toISODate(fpDayElem.dateObj);
      if (bookedSet.has(iso)) fpDayElem.classList.add('booked'); else fpDayElem.classList.add('available');
    }
  });

  // If user manually edits native input, keep flatpickr in-sync (rare because inputs are text)
  checkinInput.addEventListener('input', function () {
    try {
      if (checkinPicker) checkinPicker.setDate(this.value, false, "Y-m-d");
    } catch(e){ /* ignore */ }
  });
  checkoutInput.addEventListener('input', function () {
    try {
      if (checkoutPicker) checkoutPicker.setDate(this.value, false, "Y-m-d");
    } catch(e){ /* ignore */ }
  });
}

// ---------- Preferred check-in time picker (clock-style using flatpickr noCalendar + enableTime) ----------
function setupTimePicker() {
  const timeInput = document.getElementById('preferred-checkin-time');
  if (!timeInput) return;

  // destroy if exists
  if (timePicker && typeof timePicker.destroy === 'function') {
    timePicker.destroy(); timePicker = null;
  }

  timePicker = flatpickr(timeInput, {
    enableTime: true,
    noCalendar: true,
    dateFormat: "h:i K",
    time_24hr: false,
    minuteIncrement: 15,
    defaultDate: null,
    wrap: false,
    clickOpens: true,
  });
}

// ---------- Ensure the preferred time input & legend visible inside modal ----------
function ensurePreferredAndLegend() {
  const prefWrapper = document.getElementById('preferred-time-wrapper');
  const legend = document.getElementById('booking-legend');
  if (prefWrapper) prefWrapper.style.display = 'block';
  if (legend) legend.style.display = 'flex';
  setupTimePicker();
}

// ---------- Booking modal open/close ----------
async function openBookingModal(houseName) {
  try {
    const modalBg = document.getElementById('booking-modal-bg');
    const form = document.getElementById('booking-form');
    const confirmDiv = document.getElementById('booking-confirm');
    const title = document.getElementById('modal-title');

    if (!modalBg || !form || !title) return;

    // populate hidden house field and title
    document.getElementById('booking-house').value = houseName;
    title.textContent = `Book: ${houseName}`;

    // reset UI
    form.style.display = 'block';
    confirmDiv.style.display = 'none';
    form.reset();

    // show modal
    modalBg.classList.add('active');

    // Ensure preferred time and legend exist
    ensurePreferredAndLegend();

    // fetch existing bookings for this house and setup pickers
    await getBookedDates(houseName);
    setupDatePickers();

    // set native min to today as extra fallback
    const todayISO = toISODate(new Date());
    const checkinInput = document.getElementById('booking-checkin');
    const checkoutInput = document.getElementById('booking-checkout');
    if (checkinInput) checkinInput.setAttribute('min', todayISO);
    if (checkoutInput) checkoutInput.setAttribute('min', todayISO);

  } catch (err) {
    console.error('openBookingModal error', err);
  }
}

function closeBookingModal() {
  const modalBg = document.getElementById('booking-modal-bg');
  if (modalBg) modalBg.classList.remove('active');
}

// close on backdrop click or Escape
document.addEventListener('click', function(e) {
  const modalBg = document.getElementById('booking-modal-bg');
  if (modalBg && modalBg.classList.contains('active') && e.target === modalBg) closeBookingModal();
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeBookingModal(); });

// ---------- Booking submission ----------
function showBookingConfirmation(bookingData) {
  const form = document.getElementById('booking-form');
  const confirmDiv = document.getElementById('booking-confirm');
  const detailsDiv = document.getElementById('booking-details');

  if (!form || !confirmDiv || !detailsDiv) return;
  form.style.display = 'none';
  confirmDiv.style.display = 'block';
  detailsDiv.innerHTML = `
    <p><strong>Accommodation:</strong> ${bookingData.house}</p>
    <p><strong>Guest:</strong> ${bookingData.name}</p>
    <p><strong>Email:</strong> ${bookingData.email}</p>
    <p><strong>Phone:</strong> ${bookingData.phone}</p>
    <p><strong>Guests:</strong> ${bookingData.guests}</p>
    <p><strong>Check-in:</strong> ${bookingData.checkin}</p>
    <p><strong>Check-out:</strong> ${bookingData.checkout}</p>
    ${bookingData.preferred_checkin_time ? `<p><strong>Preferred check-in time:</strong> ${bookingData.preferred_checkin_time}</p>` : ''}
    ${bookingData.requests ? `<p><strong>Requests:</strong> ${bookingData.requests}</p>` : ''}
  `;
}

function showCustomAlert(msg, type='success') {
  // very small inline alert
  alert(msg);
}

function initFormHandlers() {
  const bookingForm = document.getElementById('booking-form');
  if (!bookingForm) return;

  bookingForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    // collect form data
    const formData = new FormData(bookingForm);
    const bookingData = Object.fromEntries(formData.entries());

    // Normalize keys and required fields
    const house = bookingData.house || document.getElementById('booking-house').value || '';
    const name = bookingData.name || '';
    const guests = bookingData.guests || '';
    const phone = bookingData.phone || '';
    const email = bookingData.email || '';
    const checkin = bookingData.checkin || '';
    const checkout = bookingData.checkout || '';
    const preferred = bookingData.preferred_checkin_time || '';
    const requests = bookingData.requests || '';

    // Basic validation
    if (!house || !name || !guests || !phone || !email || !checkin || !checkout) {
      showCustomAlert('Please fill all required fields.', 'error');
      return;
    }

    const ci = new Date(checkin + 'T00:00:00');
    const co = new Date(checkout + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    if (isNaN(ci.getTime()) || isNaN(co.getTime())) { showCustomAlert('Invalid dates supplied.', 'error'); return; }
    if (ci < today) { showCustomAlert('Check-in cannot be in the past.', 'error'); return; }
    if (co <= ci) { showCustomAlert('Check-out must be after check-in.', 'error'); return; }

    // server-side overlap validation against bookedSet
    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
      if (bookedSet.has(toISODate(d))) {
        showCustomAlert('Selected dates overlap with an existing booking. Choose different dates.', 'error');
        return;
      }
    }

    // Save booking to Firestore
    const submitBtn = bookingForm.querySelector('[type="submit"]');
    const origText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Processing...';

    const payload = {
      house, // keep house for backwards compatibility
      houseId: house,
      name,
      guestName: name,
      guests,
      phone,
      email,
      checkin: toISODate(ci),
      checkout: toISODate(co),
      checkIn: toISODate(ci),
      checkOut: toISODate(co),
      preferred_checkin_time: preferred || null,
      checkInTime: preferred || null,
      requests: requests || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    };

    try {
      await db.collection('bookings').add(payload);
      // locally block these days so UI updates immediately
      for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        bookedSet.add(toISODate(d));
      }
      setupDatePickers();

      showBookingConfirmation({
        house, name, guests, phone, email, checkin: toISODate(ci), checkout: toISODate(co),
        preferred_checkin_time: preferred, requests
      });

      // optional: add a notification doc for admin
      await db.collection('notifications').add({
        type: 'new_booking',
        data: payload,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

    } catch (err) {
      console.error('Error saving booking:', err);
      showCustomAlert('Failed to save booking. Try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
  });
}

// ---------- Init on DOMContentLoaded ----------
document.addEventListener('DOMContentLoaded', () => {
  // wire up global helpers used by your HTML buttons
  window.openBookingModal = openBookingModal;
  window.closeBookingModal = closeBookingModal;

  // init forms
  initFormHandlers();

  // If you open modal programmatically, it will call getBookedDates and setup pickers
  console.log('script.js loaded: date/time pickers ready');
});
