
// script.js (complete - ready to paste)
// Firebase Configuration (from your project)
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

// UI elements
const bookingModal = document.getElementById('booking-modal-bg');
const bookingForm = document.getElementById('booking-form');
const bookingConfirm = document.getElementById('booking-confirm');
const bookingDetails = document.getElementById('booking-details');
const bookingHouseInput = document.getElementById('booking-house');
const closeButtons = document.querySelectorAll('.modal-close');

// Local state
let bookedDates = [];   // array strings YYYY-MM-DD
let bookedSet = new Set();
let checkinPicker = null;
let checkoutPicker = null;
let timePicker = null;

// Utility: show / hide modal
function openBookingModal(house) {
  bookingModal.classList.add('active');
  bookingHouseInput.value = house || '';
  bookingForm.style.display = 'block';
  bookingConfirm.style.display = 'none';
  bookingForm.reset();

  // Ensure we fetch blocked dates for that house and (re)init pickers
  fetchAndApplyBookedDates(house).then(() => {
    setupDatePickers();
    // set HTML min attributes fallback
    const todayISO = new Date().toISOString().split('T')[0];
    document.getElementById('booking-checkin').min = todayISO;
    document.getElementById('booking-checkout').min = todayISO;
  }).catch(err => {
    console.error("Error initializing booking modal:", err);
    setupDatePickers(); // even if fetch fails, allow picking
  });
}

function closeBookingModal() {
  bookingModal.classList.remove('active');
}

// Close icon(s)
closeButtons.forEach(btn => btn.addEventListener('click', closeBookingModal));
// click outside modal to close
bookingModal.addEventListener('click', (e) => { if (e.target === bookingModal) closeBookingModal(); });
// ESC key
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBookingModal(); });

// === Firestore: fetch bookings for house and convert to blocked days ===
async function fetchAndApplyBookedDates(houseName) {
  if (!houseName) { bookedDates = []; bookedSet = new Set(); return []; }
  try {
    const snapshot = await db.collection('bookings').where('house', '==', houseName).get();
    const dates = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data || !data.checkin || !data.checkout) return;
      const start = new Date(data.checkin);
      const end = new Date(data.checkout);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      // Mark each night from checkin inclusive to day before checkout (checkout exclusive)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        dates.add(d.toISOString().split('T')[0]);
      }
    });
    bookedDates = Array.from(dates).sort();
    bookedSet = new Set(bookedDates);
    // for debugging
    console.log('bookedDates for', houseName, bookedDates);
    return bookedDates;
  } catch (err) {
    console.error('Error fetching bookings from Firestore:', err);
    bookedDates = []; bookedSet = new Set();
    return [];
  }
}

// === Setup flatpickr instances (checkin, checkout, time) ===
function setupDatePickers() {
  const checkinInput = document.getElementById('booking-checkin');
  const checkoutInput = document.getElementById('booking-checkout');
  const prefTimeInput = document.getElementById('preferred-checkin-time');

  if (!checkinInput || !checkoutInput || !prefTimeInput) return;

  // Destroy previous instances safely
  try { if (checkinPicker && checkinPicker.destroy) checkinPicker.destroy(); } catch (e){}
  try { if (checkoutPicker && checkoutPicker.destroy) checkoutPicker.destroy(); } catch (e){}
  try { if (timePicker && timePicker.destroy) timePicker.destroy(); } catch (e){}

  // disable function for booked sets
  const disableFn = function(date) {
    const iso = date.toISOString().split('T')[0];
    return bookedSet.has(iso);
  };

  // create check-in picker
  checkinPicker = flatpickr(checkinInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [disableFn],
    onDayCreate: function(dObj, dStr, fpDayElem) {
      const iso = fpDayElem.dateObj.toISOString().split('T')[0];
      if (bookedSet.has(iso)) {
        fpDayElem.classList.add('booked');
      } else {
        fpDayElem.classList.add('available');
      }
    },
    onChange: function(selectedDates) {
      if (!selectedDates || !selectedDates.length) return;
      const sel = selectedDates[0];
      const minCheckout = new Date(sel); minCheckout.setDate(minCheckout.getDate() + 1);
      if (checkoutPicker) checkoutPicker.set('minDate', minCheckout);
      // If checkout value <= new min, clear it
      if (checkoutPicker && checkoutPicker.selectedDates.length) {
        const cur = checkoutPicker.selectedDates[0];
        if (cur <= sel) checkoutPicker.clear();
      }
    }
  });

  // create check-out picker
  checkoutPicker = flatpickr(checkoutInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [disableFn],
    onDayCreate: function(dObj, dStr, fpDayElem) {
      const iso = fpDayElem.dateObj.toISOString().split('T')[0];
      if (bookedSet.has(iso)) {
        fpDayElem.classList.add('booked');
      } else {
        fpDayElem.classList.add('available');
      }
    }
  });

  // create a time-only flatpickr (clock-style)
  timePicker = flatpickr(prefTimeInput, {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: false,
    defaultHour: 14,
    defaultMinute: 0,
    minuteIncrement: 15,
    allowInput: false
  });
}

// === Booking form submit handler ===
bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = bookingForm;
  const data = new FormData(form);
  const booking = Object.fromEntries(data.entries());

  // If preferred_checkin_time from timePicker exists it will be string "HH:MM"
  booking.preferred_checkin_time = booking.preferred_checkin_time || null;

  // Basic validation
  const today = new Date(); today.setHours(0,0,0,0);
  const checkin = new Date(booking.checkin);
  const checkout = new Date(booking.checkout);

  if (!booking.name || !booking.email || !booking.phone || !booking.checkin || !booking.checkout) {
    alert("Please fill all required booking fields.");
    return;
  }
  if (isNaN(checkin.getTime()) || isNaN(checkout.getTime())) {
    alert("Invalid dates provided.");
    return;
  }
  if (checkin < today) { alert("Check-in cannot be in the past."); return; }
  if (checkout <= checkin) { alert("Check-out must be after check-in."); return; }

  // server-side overlap check using bookedSet for every night in range
  for (let d = new Date(checkin); d < checkout; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split('T')[0];
    if (bookedSet.has(iso)) {
      alert("Selected dates overlap an existing booking. Please choose different dates.");
      return;
    }
  }

  // Minimum 1 night
  const msPerDay = 1000 * 60 * 60 * 24;
  const nights = Math.round((checkout - checkin) / msPerDay);
  if (nights < 1) { alert("Minimum stay is one night."); return; }

  // Save booking to Firestore (status pending)
  try {
    await db.collection('bookings').add({
      ...booking,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });

    // update local blocked days for immediate UX feedback
    for (let d = new Date(checkin); d < checkout; d.setDate(d.getDate() + 1)) {
      bookedSet.add(d.toISOString().split('T')[0]);
    }
    // re-render pickers to reflect new blocks immediately
    setupDatePickers();

    // show confirmation UI
    showBookingConfirmation(booking);
    // optional: notify admin collection for your admin UI
    await db.collection('notifications').add({
      type: 'new_booking',
      data: booking,
      status: 'pending',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

  } catch (err) {
    console.error('Error saving booking:', err);
    alert('There was an error processing your booking. Please try again.');
  }
});

// display booking confirmation block
function showBookingConfirmation(b) {
  bookingForm.style.display = 'none';
  bookingConfirm.style.display = 'block';
  bookingDetails.innerHTML = `
    <p><strong>Accommodation:</strong> ${escapeHtml(b.house || '')}</p>
    <p><strong>Name:</strong> ${escapeHtml(b.name || '')}</p>
    <p><strong>Phone:</strong> ${escapeHtml(b.phone || '')}</p>
    <p><strong>Email:</strong> ${escapeHtml(b.email || '')}</p>
    <p><strong>Check-in:</strong> ${formatDate(b.checkin)}</p>
    <p><strong>Check-out:</strong> ${formatDate(b.checkout)}</p>
    ${b.preferred_checkin_time ? `<p><strong>Preferred check-in time:</strong> ${escapeHtml(b.preferred_checkin_time)}</p>` : ''}
    ${b.requests ? `<p><strong>Special requests:</strong> ${escapeHtml(b.requests)}</p>` : ''}
  `;
}

// small helpers
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) { return iso; }
}
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Expose open/close functions globally so your markup's onclick can call them
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;

// Initialize some UI behavior on DOM ready (mobile nav, fetch default if needed)
document.addEventListener('DOMContentLoaded', () => {
  // initialize with empty blocking (will be overridden when modal opens for a house)
  setupDatePickers();
  console.log('Booking script initialized - flatpickr ready.');
});
