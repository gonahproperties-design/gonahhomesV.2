// Gonah Homes Management Dashboard with Firebase Auth
class GonahHomesManagement {
    constructor() {
        this.initializeFirebase();
        this.initializeEmailJS();
        this.initializeCharts();
        this.currentSection = 'overview';
        this.notifications = [];
        this.charts = {};
        this.isAuthenticated = false;
        this.whatsappNumber = '+254799466723';
        this.init();
    }

    // Initialize Firebase
    initializeFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyABTVp797tNu353FBVLzsOp90aIX2mNF74",
            authDomain: "my-website-project2797.firebaseapp.com",
            projectId: "my-website-project2797",
            storageBucket: "my-website-project2797.appspot.com",
            messagingSenderId: "406226552922",
            appId: "1:406226552922:web:ffdf2ccf6f77a57964b063"
        };
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();
    }

    // Initialize EmailJS
    initializeEmailJS() {
        emailjs.init("VgDakmh3WscKrr_wQ");
    }

    // Initialize Charts
    initializeCharts() {
        Chart.defaults.font.family = 'Poppins, sans-serif';
        Chart.defaults.color = '#666';
    }

    // Initialize the dashboard
    init() {
        this.setupEventListeners();
        this.checkAuthentication();
    }

    // Firebase Auth check
    checkAuthentication() {
        this.auth.onAuthStateChanged(user => {
            if (user) {
                this.isAuthenticated = true;
                this.showDashboard();
            } else {
                this.isAuthenticated = false;
                this.showLoginModal();
            }
        });
    }

    // Event listeners
    setupEventListeners() {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.closest('.nav-link').dataset.section;
                this.showSection(section);
            });
        });

        document.getElementById('booking-search')?.addEventListener('input', () => this.filterBookings());
        document.getElementById('booking-filter')?.addEventListener('change', () => this.filterBookings());
        document.getElementById('client-search')?.addEventListener('input', () => this.filterClients());

        document.getElementById('notification-settings')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNotificationSettings();
        });

        document.getElementById('business-settings')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveBusinessSettings();
        });
    }

    // Handle login with Firebase Auth
    async handleLogin() {
        const email = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const errorDiv = document.getElementById('login-error');
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';

        try {
            await this.auth.signInWithEmailAndPassword(email, password);
            this.showToast('Welcome to Gonah Homes Management Dashboard!', 'success');
            // Modal will be closed by onAuthStateChanged callback
        } catch (error) {
            errorDiv.textContent = error.message || 'Authentication failed. Please check your email and password.';
            errorDiv.style.display = 'block';
            this.showToast('Authentication failed', 'error');
        }
    }

    // Show login modal
    showLoginModal() {
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.add('active');
            loginModal.style.display = 'block';
        }
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            dashboard.classList.add('hidden');
            dashboard.style.display = 'none';
        }
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-error').textContent = '';
    }

    // Show dashboard
    showDashboard() {
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.remove('active');
            loginModal.style.display = 'none';
        }
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            dashboard.classList.remove('hidden');
            dashboard.style.display = 'block';
        }
        this.loadDashboardData();
        this.setupRealTimeListeners();
    }

    // Logout
    logout() {
        this.auth.signOut().then(() => {
            this.isAuthenticated = false;
            this.showLoginModal();
            this.showToast('Logged out successfully', 'info');
        });
    }

    // Show section
    showSection(sectionName) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');
        const titles = {
            overview: 'Management Dashboard',
            bookings: 'Bookings Management',
            analytics: 'Analytics & Insights',
            clients: 'Client Management',
            messages: 'Messages & Communication',
            reviews: 'Reviews Management',
            whatsapp: 'WhatsApp Communication',
            settings: 'System Settings'
        };
        document.getElementById('page-title').textContent = titles[sectionName];
        this.currentSection = sectionName;
        switch (sectionName) {
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'bookings':
                this.loadBookings();
                break;
            case 'messages':
                this.loadMessages();
                break;
            case 'reviews':
                this.loadReviews();
                break;
            case 'clients':
                this.loadClients();
                break;
            case 'whatsapp':
                this.loadWhatsAppData();
                break;
        }
    }

    async loadDashboardData() {
        try {
            await this.loadOverviewStats();
            await this.loadRecentActivity();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showToast('Error loading dashboard data', 'error');
        }
    }

    async loadOverviewStats() {
        try {
            const [bookingsSnap, reviewsSnap, messagesSnap] = await Promise.all([
                this.db.collection('bookings').get(),
                this.db.collection('reviews').get(),
                this.db.collection('messages').get()
            ]);
            const bookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const reviews = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const totalBookings = bookings.length;
            const totalRevenue = this.calculateTotalRevenue(bookings);
            const totalClients = new Set(bookings.map(b => b.email)).size;
            const avgRating = reviews.length > 0 ?
                (reviews.reduce((sum, r) => sum + parseFloat(r.rating || 0), 0) / reviews.length).toFixed(1) : '0.0';
            document.getElementById('total-bookings').textContent = totalBookings;
            document.getElementById('total-revenue').textContent = `KSh ${totalRevenue.toLocaleString()}`;
            document.getElementById('total-clients').textContent = totalClients;
            document.getElementById('avg-rating').textContent = avgRating;
            this.calculateMonthlyChanges(bookings, reviews);
        } catch (error) {
            console.error('Error loading overview stats:', error);
        }
    }

    calculateTotalRevenue(bookings) {
        const rates = {
            'Studio Apartment': 3000,
            'One-Bedroom Apartment': 4000,
            'One Bedroom Apartment': 4000,
            'Two-Bedroom Apartment': 5500,
            'Two Bedroom Apartment': 5500,
            'Three-Bedroom Apartment': 7000,
            'Three Bedroom Apartment': 7000,
            'Four-Bedroom Apartment': 8500,
            'Four Bedroom Apartment': 8500,
            'Maisonette': 10000,
            'Luxury Maisonette': 10000
        };
        return bookings.reduce((total, booking) => {
            const days = this.calculateDays(booking.checkin, booking.checkout);
            const rate = rates[booking.house] || 4000;
            return total + (days * rate);
        }, 0);
    }

    calculateDays(checkin, checkout) {
        const start = new Date(checkin);
        const end = new Date(checkout);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    }

    calculateMonthlyChanges(bookings, reviews) {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const thisMonthBookings = bookings.filter(b => {
            const bookingDate = b.timestamp?.toDate() || new Date(b.timestamp);
            return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
        });
        const lastMonthBookings = bookings.filter(b => {
            const bookingDate = b.timestamp?.toDate() || new Date(b.timestamp);
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            return bookingDate.getMonth() === lastMonth && bookingDate.getFullYear() === lastYear;
        });
        const bookingChange = this.calculatePercentageChange(lastMonthBookings.length, thisMonthBookings.length);
        const revenueChange = this.calculatePercentageChange(
            this.calculateTotalRevenue(lastMonthBookings),
            this.calculateTotalRevenue(thisMonthBookings)
        );
        document.getElementById('booking-change').textContent = `${bookingChange >= 0 ? '+' : ''}${bookingChange}% this month`;
        document.getElementById('revenue-change').textContent = `${revenueChange >= 0 ? '+' : ''}${revenueChange}% this month`;
    }

    calculatePercentageChange(oldValue, newValue) {
        if (oldValue === 0) return newValue > 0 ? 100 : 0;
        return Math.round(((newValue - oldValue) / oldValue) * 100);
    }

    async loadRecentActivity() {
        try {
            const activityDiv = document.getElementById('recent-activity');
            const activities = [];
            const recentBookings = await this.db.collection('bookings')
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();
            recentBookings.forEach(doc => {
                const booking = doc.data();
                activities.push({
                    type: 'booking',
                    message: `New booking from ${booking.name}`,
                    time: this.getTimeAgo(booking.timestamp),
                    icon: 'fas fa-calendar-plus'
                });
            });
            const recentReviews = await this.db.collection('reviews')
                .orderBy('timestamp', 'desc')
                .limit(3)
                .get();
            recentReviews.forEach(doc => {
                const review = doc.data();
                activities.push({
                    type: 'review',
                    message: `New ${review.rating}-star review`,
                    time: this.getTimeAgo(review.timestamp),
                    icon: 'fas fa-star'
                });
            });
            activities.sort((a, b) => b.timestamp - a.timestamp);
            activityDiv.innerHTML = activities.slice(0, 8).map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="${activity.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p>${activity.message}</p>
                        <span class="activity-time">${activity.time}</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    async loadAnalytics() {
        try {
            const bookingsSnap = await this.db.collection('bookings').get();
            const bookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderAccommodationChart(bookings);
            this.renderMonthlyChart(bookings);
            this.renderClientChart(bookings);
            this.renderProjectionChart(bookings);
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showToast('Error loading analytics data', 'error');
        }
    }

    renderAccommodationChart(bookings) {
        const accommodationCounts = {};
        bookings.forEach(booking => {
            accommodationCounts[booking.house] = (accommodationCounts[booking.house] || 0) + 1;
        });
        const ctx = document.getElementById('accommodationChart');
        if (this.charts.accommodation) {
            this.charts.accommodation.destroy();
        }
        this.charts.accommodation = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(accommodationCounts),
                datasets: [{
                    data: Object.values(accommodationCounts),
                    backgroundColor: [
                        '#800000', '#a00000', '#c00000', '#600000', '#400000', '#200000'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        const mostPopular = Object.entries(accommodationCounts)
            .sort(([,a], [,b]) => b - a)[0];
        if (mostPopular) {
            document.getElementById('popular-accommodation').innerHTML =
                `<p><strong>Most Booked:</strong> ${mostPopular[0]} (${mostPopular[1]} bookings)</p>`;
        }
    }

    renderMonthlyChart(bookings) {
        const monthlyData = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        bookings.forEach(booking => {
            const date = booking.timestamp?.toDate() || new Date(booking.timestamp);
            const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
        });
        const ctx = document.getElementById('monthlyChart');
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }
        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(monthlyData).slice(-6),
                datasets: [{
                    label: 'Bookings',
                    data: Object.values(monthlyData).slice(-6),
                    borderColor: '#800000',
                    backgroundColor: 'rgba(128, 0, 0, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
        const values = Object.values(monthlyData).slice(-6);
        const trend = values.length > 1 ?
            (values[values.length - 1] > values[values.length - 2] ? 'increasing' : 'decreasing') : 'stable';
        document.getElementById('booking-trends').innerHTML =
            `<p><strong>Trend:</strong> Bookings are ${trend}</p>`;
    }

    renderClientChart(bookings) {
        const clientCounts = {};
        bookings.forEach(booking => {
            clientCounts[booking.email] = (clientCounts[booking.email] || 0) + 1;
        });
        const repeatClients = Object.values(clientCounts).filter(count => count > 1).length;
        const newClients = Object.values(clientCounts).filter(count => count === 1).length;
        const ctx = document.getElementById('clientChart');
        if (this.charts.client) {
            this.charts.client.destroy();
        }
        this.charts.client = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Repeat Clients', 'New Clients'],
                datasets: [{
                    data: [repeatClients, newClients],
                    backgroundColor: ['#800000', '#a00000']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        document.getElementById('repeat-clients').innerHTML =
            `<p><strong>Repeat Clients:</strong> ${repeatClients} (${Math.round((repeatClients / (repeatClients + newClients)) * 100)}%)</p>`;
    }

    renderProjectionChart(bookings) {
        const monthlyRevenue = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        bookings.forEach(booking => {
            const date = booking.timestamp?.toDate() || new Date(booking.timestamp);
            const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
            const revenue = this.calculateTotalRevenue([booking]);
            monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + revenue;
        });
        const revenueValues = Object.values(monthlyRevenue).slice(-6);
        const avgGrowth = this.calculateAverageGrowth(revenueValues);
        const nextMonthProjection = revenueValues[revenueValues.length - 1] * (1 + avgGrowth);
        const ctx = document.getElementById('projectionChart');
        if (this.charts.projection) {
            this.charts.projection.destroy();
        }
        const labels = Object.keys(monthlyRevenue).slice(-6);
        labels.push('Next Month (Projected)');
        const data = [...revenueValues, nextMonthProjection];
        this.charts.projection = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (KSh)',
                    data: data,
                    backgroundColor: labels.map((_, i) =>
                        i === labels.length - 1 ? 'rgba(128, 0, 0, 0.5)' : '#800000'
                    )
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
        document.getElementById('next-month-projection').innerHTML =
            `<p><strong>Next Month Projection:</strong> KSh ${Math.round(nextMonthProjection).toLocaleString()}</p>`;
    }

    calculateAverageGrowth(values) {
        if (values.length < 2) return 0;
        let totalGrowth = 0;
        let periods = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i - 1] > 0) {
                totalGrowth += (values[i] - values[i - 1]) / values[i - 1];
                periods++;
            }
        }
        return periods > 0 ? totalGrowth / periods : 0;
    }

    async loadBookings() {
        try {
            const bookingsSnap = await this.db.collection('bookings').orderBy('timestamp', 'desc').get();
            const bookingsTable = document.getElementById('bookings-table');
            bookingsTable.innerHTML = '';
            if (bookingsSnap.empty) {
                bookingsTable.innerHTML = '<tr><td colspan="8" class="text-center">No bookings found</td></tr>';
                return;
            }
            bookingsSnap.forEach(doc => {
                const booking = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${doc.id.substring(0, 8)}...</td>
                    <td>
                        <div class="client-info">
                            <strong>${booking.name}</strong><br>
                            <small>${booking.email}</small><br>
                            <small>${booking.phone}</small>
                        </div>
                    </td>
                    <td>${booking.house}</td>
                    <td>${this.formatDate(booking.checkin)}</td>
                    <td>${this.formatDate(booking.checkout)}</td>
                    <td>${booking.guests}</td>
                    <td><span class="status status-${booking.status || 'pending'}">${(booking.status || 'pending').toUpperCase()}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-success btn-sm" onclick="management.updateBookingStatus('${doc.id}', 'confirmed')" title="Confirm">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-warning btn-sm" onclick="management.updateBookingStatus('${doc.id}', 'completed')" title="Complete">
                                <i class="fas fa-flag-checkered"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="management.updateBookingStatus('${doc.id}', 'cancelled')" title="Cancel">
                                <i class="fas fa-times"></i>
                            </button>
                            <button class="btn btn-info btn-sm" onclick="management.messageClient('${booking.phone}', '${booking.name}')" title="WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                        </div>
                    </td>
                `;
                bookingsTable.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading bookings:', error);
            this.showToast('Error loading bookings', 'error');
        }
    }

    async updateBookingStatus(bookingId, status) {
        try {
            await this.db.collection('bookings').doc(bookingId).update({
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const bookingDoc = await this.db.collection('bookings').doc(bookingId).get();
            const booking = bookingDoc.data();
            await this.sendBookingStatusEmail(booking, status);
            this.showToast(`Booking ${status} successfully`, 'success');
            this.loadBookings();
            this.addNotification(`Booking ${status}: ${booking.name}`, 'booking');
        } catch (error) {
            console.error('Error updating booking:', error);
            this.showToast('Error updating booking status', 'error');
        }
    }

    async sendBookingStatusEmail(booking, status) {
        try {
            const emailData = {
                to_email: booking.email,
                to_name: booking.name,
                from_name: "Gonah Homes",
                subject: `Booking Status Update: ${status}`,
                message: `Dear ${booking.name}, your booking for ${booking.house} has been ${status}. We will contact you with further details.`,
                reply_to: "gonahhomes0@gmail.com"
            };
            await emailjs.send("service_ky2kj3t", "template_6duvs5n", emailData);
            await emailjs.send("service_ky2kj3t", "template_24gjzd3", {
                to_email: "gonahhomes0@gmail.com",
                to_name: "Admin",
                from_name: "Gonah Homes System",
                message: `Booking ${status} for ${booking.name} - ${booking.house}`,
                reply_to: "gonahhomes0@gmail.com"
            });
        } catch (error) {
            console.error('Error sending booking email:', error);
        }
    }

    async loadMessages() {
        try {
            const messagesSnap = await this.db.collection('messages').orderBy('timestamp', 'desc').get();
            const messagesList = document.getElementById('messages-list');
            messagesList.innerHTML = '';
            if (messagesSnap.empty) {
                messagesList.innerHTML = '<div class="no-data">No messages found</div>';
                return;
            }
            messagesSnap.forEach(doc => {
                const message = doc.data();
                const messageItem = document.createElement('div');
                messageItem.className = 'message-item';
                messageItem.onclick = () => this.showMessageDetail(doc.id, message, messageItem);
                messageItem.innerHTML = `
                    <div class="message-header">
                        <strong>${message.name}</strong>
                        <span class="message-time">${this.getTimeAgo(message.timestamp)}</span>
                    </div>
                    <div class="message-email">${message.email}</div>
                    <div class="message-preview">${message.message.substring(0, 100)}...</div>
                    <div class="message-status">
                        <span class="status status-${message.status || 'new'}">${(message.status || 'new').toUpperCase()}</span>
                    </div>
                `;
                messagesList.appendChild(messageItem);
            });
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showToast('Error loading messages', 'error');
        }
    }

    showMessageDetail(messageId, message, clickedElem) {
        const messageDetail = document.getElementById('message-detail');
        messageDetail.innerHTML = `
            <div class="message-detail-header">
                <h3>${message.name}</h3>
                <span class="status status-${message.status || 'new'}">${(message.status || 'new').toUpperCase()}</span>
            </div>
            <div class="message-meta">
                <p><strong>Email:</strong> ${message.email}</p>
                <p><strong>Received:</strong> ${this.formatTimestamp(message.timestamp)}</p>
            </div>
            <div class="message-content">
                <h4>Message:</h4>
                <p>${message.message}</p>
            </div>
            <div class="message-reply">
                <h4>Reply:</h4>
                <textarea id="reply-text-${messageId}" rows="4" placeholder="Type your reply here..."></textarea>
                <div class="reply-actions">
                    <button class="btn btn-primary" onclick="management.replyToMessage('${messageId}', '${message.email}', '${message.name}')">
                        <i class="fas fa-reply"></i> Send Email Reply
                    </button>
                    <button class="btn btn-success" onclick="management.replyViaWhatsApp('${message.email}', '${message.name}')">
                        <i class="fab fa-whatsapp"></i> Reply via WhatsApp
                    </button>
                    <button class="btn btn-outline" onclick="management.markMessageAsRead('${messageId}')">
                        <i class="fas fa-check"></i> Mark as Read
                    </button>
                </div>
            </div>
        `;
        document.querySelectorAll('.message-item').forEach(item => item.classList.remove('active'));
        clickedElem.classList.add('active');
    }

    async replyToMessage(messageId, clientEmail, clientName) {
        const replyTextElem = document.getElementById(`reply-text-${messageId}`);
        const replyText = replyTextElem.value.trim();
        if (!replyText) {
            this.showToast('Please enter a reply message', 'warning');
            return;
        }
        try {
            await this.db.collection('messages').doc(messageId).update({
                status: 'replied',
                reply: replyText,
                repliedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await emailjs.send("service_ky2kj3t", "template_6duvs5n", {
                to_email: clientEmail,
                to_name: clientName,
                from_name: "Gonah Homes",
                message: replyText,
                reply_to: "gonahhomes0@gmail.com"
            });
            await emailjs.send("service_ky2kj3t", "template_24gjzd3", {
                to_email: "gonahhomes0@gmail.com",
                to_name: "Admin",
                from_name: "Gonah Homes System",
                message: `Reply sent to ${clientName}: ${replyText}`,
                reply_to: "gonahhomes0@gmail.com"
            });
            this.showToast('Reply sent successfully', 'success');
            this.loadMessages();
            this.addNotification(`Reply sent to ${clientName}`, 'message');
        } catch (error) {
            console.error('Error sending reply:', error);
            this.showToast('Error sending reply', 'error');
        }
    }

    replyViaWhatsApp(clientEmail, clientName) {
        const message = `Hello ${clientName}, thank you for contacting Gonah Homes. How can we assist you today?`;
        window.open(`https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
        this.showToast('WhatsApp opened for reply', 'info');
    }

    async markMessageAsRead(messageId) {
        try {
            await this.db.collection('messages').doc(messageId).update({
                status: 'read',
                readAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.showToast('Message marked as read', 'success');
            this.loadMessages();
        } catch (error) {
            console.error('Error marking message as read:', error);
            this.showToast('Error marking message as read', 'error');
        }
    }

    async loadReviews() {
        try {
            const reviewsSnap = await this.db.collection('reviews').orderBy('timestamp', 'desc').get();
            const reviewsGrid = document.getElementById('reviews-grid');
            reviewsGrid.innerHTML = '';
            if (reviewsSnap.empty) {
                reviewsGrid.innerHTML = '<div class="no-data">No reviews found</div>';
                return;
            }
            reviewsSnap.forEach(doc => {
                const review = doc.data();
                const reviewCard = document.createElement('div');
                reviewCard.className = 'review-card';
                const stars = '★'.repeat(parseInt(review.rating)).padEnd(5, '☆');
                reviewCard.innerHTML = `
                    <div class="review-header">
                        <div class="reviewer-info">
                            <strong>${review.user?.name || 'Anonymous'}</strong>
                            <div class="review-rating">${stars}</div>
                        </div>
                        <div class="review-actions">
                            <button class="btn btn-info btn-sm" onclick="management.replyToReview('${doc.id}', '${review.user?.email}', '${review.user?.name}')">
                                <i class="fas fa-reply"></i> Reply
                            </button>
                        </div>
                    </div>
                    <div class="review-content">
                        <p>${review.review}</p>
                        <small class="review-date">${this.formatTimestamp(review.timestamp)}</small>
                    </div>
                    ${review.adminReply ? `
                        <div class="admin-reply">
                            <strong>Management Reply:</strong><br>
                            ${review.adminReply}
                        </div>
                    ` : ''}
                `;
                reviewsGrid.appendChild(reviewCard);
            });
        } catch (error) {
            console.error('Error loading reviews:', error);
            this.showToast('Error loading reviews', 'error');
        }
    }

    async replyToReview(reviewId, userEmail, userName) {
        const reply = prompt('Enter your reply to this review:');
        if (reply) {
            try {
                await this.db.collection('reviews').doc(reviewId).update({
                    adminReply: reply,
                    repliedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                if (userEmail) {
                    await emailjs.send("service_ky2kj3t", "template_6duvs5n", {
                        to_email: userEmail,
                        to_name: userName,
                        from_name: "Gonah Homes",
                        message: `Thank you for your review! Management reply: ${reply}`,
                        reply_to: "gonahhomes0@gmail.com"
                    });
                }
                this.showToast('Review reply sent successfully', 'success');
                this.loadReviews();
                this.addNotification(`Replied to review from ${userName}`, 'review');
            } catch (error) {
                console.error('Error replying to review:', error);
                this.showToast('Error sending review reply', 'error');
            }
        }
    }

    async loadClients() {
        try {
            const bookingsSnap = await this.db.collection('bookings').get();
            const clientsMap = new Map();
            bookingsSnap.forEach(doc => {
                const booking = doc.data();
                const clientKey = booking.email;
                if (clientsMap.has(clientKey)) {
                    const client = clientsMap.get(clientKey);
                    client.totalBookings++;
                    client.totalSpent += this.calculateTotalRevenue([booking]);
                    client.lastBooking = booking.timestamp;
                } else {
                    clientsMap.set(clientKey, {
                        name: booking.name,
                        email: booking.email,
                        phone: booking.phone,
                        totalBookings: 1,
                        totalSpent: this.calculateTotalRevenue([booking]),
                        firstBooking: booking.timestamp,
                        lastBooking: booking.timestamp
                    });
                }
            });
            const clientsGrid = document.getElementById('clients-grid');
            clientsGrid.innerHTML = '';
            if (clientsMap.size === 0) {
                clientsGrid.innerHTML = '<div class="no-data">No clients found</div>';
                return;
            }
            Array.from(clientsMap.values()).forEach(client => {
                const card = document.createElement('div');
                card.className = 'client-card';
                card.innerHTML = `
                    <div class="client-header">
                        <div class="client-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="client-info">
                            <h3>${client.name}</h3>
                            <p>${client.email}</p>
                            <p>${client.phone}</p>
                        </div>
                    </div>
                    <div class="client-stats">
                        <div class="client-stat">
                            <h4>${client.totalBookings}</h4>
                            <p>Total Bookings</p>
                        </div>
                        <div class="client-stat">
                            <h4>KSh ${client.totalSpent.toLocaleString()}</h4>
                            <p>Total Spent</p>
                        </div>
                    </div>
                    <div class="client-actions">
                        <button class="btn btn-outline btn-sm" onclick="management.viewClientHistory('${client.email}')">
                            <i class="fas fa-history"></i> History
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="management.messageClient('${client.phone}', '${client.name}')">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                    </div>
                `;
                clientsGrid.appendChild(card);
            });
        } catch (error) {
            console.error('Error loading clients:', error);
            this.showToast('Error loading clients', 'error');
        }
    }

    messageClient(phone, name) {
        const cleanPhone = phone.replace(/\D/g, '');
        const message = `Hello ${name}, this is Gonah Homes. How can we assist you today?`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
        this.showToast('WhatsApp opened for client communication', 'info');
    }

    loadWhatsAppData() {
        this.loadClientsForWhatsApp();
    }

    async loadClientsForWhatsApp() {
        try {
            const bookingsSnap = await this.db.collection('bookings').get();
            const clientSelect = document.getElementById('client-select');
            const clients = new Map();
            bookingsSnap.forEach(doc => {
                const booking = doc.data();
                if (!clients.has(booking.email)) {
                    clients.set(booking.email, {
                        name: booking.name,
                        phone: booking.phone
                    });
                }
            });
            clientSelect.innerHTML = '<option value="">Select a guest...</option>';
            clients.forEach((client, email) => {
                const option = document.createElement('option');
                option.value = `${client.phone}|${client.name}`;
                option.textContent = `${client.name} (${client.phone})`;
                clientSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading clients for WhatsApp:', error);
        }
    }

    sendCustomWhatsApp() {
        const clientSelect = document.getElementById('client-select');
        const messageText = document.getElementById('custom-message').value.trim();
        if (!clientSelect.value || !messageText) {
            this.showToast('Please select a client and enter a message', 'warning');
            return;
        }
        const [phone, name] = clientSelect.value.split('|');
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`, '_blank');
        this.showToast(`WhatsApp message sent to ${name}`, 'success');
        document.getElementById('custom-message').value = '';
        this.addNotification(`WhatsApp message sent to ${name}`, 'whatsapp');
    }

    sendQuickMessage(type) {
        const messages = {
            welcome: "Welcome to Gonah Homes! We're excited to host you. Check-in is from 2 PM onwards. Let us know if you need any assistance!",
            checkin: "Your accommodation is ready for check-in! Please arrive after 2 PM. The keys and instructions will be provided upon arrival. Safe travels!",
            checkout: "Thank you for staying with Gonah Homes! Check-out is by 11 AM. Please leave the keys as instructed. We hope you had a wonderful stay!"
        };
        const message = messages[type];
        if (message) {
            window.open(`https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
            this.showToast('Quick message template opened in WhatsApp', 'info');
        }
    }

    openWhatsApp() {
        window.open(`https://wa.me/${this.whatsappNumber}`, '_blank');
        this.showToast('WhatsApp opened', 'info');
    }

    setupRealTimeListeners() {
        this.db.collection('bookings').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const booking = change.doc.data();
                    this.addNotification(`New booking from ${booking.name}`, 'booking');
                    emailjs.send("service_ky2kj3t", "template_24gjzd3", {
                        to_email: "gonahhomes0@gmail.com",
                        to_name: "Admin",
                        from_name: "Gonah Homes System",
                        message: `New booking: ${booking.house} for ${booking.guests} guests from ${booking.checkin} to ${booking.checkout}. Contact: ${booking.phone}`,
                        reply_to: "gonahhomes0@gmail.com"
                    });
                }
            });
            if (this.currentSection === 'bookings') this.loadBookings();
            if (this.currentSection === 'overview') this.loadOverviewStats();
        });

        this.db.collection('messages').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    this.addNotification(`New message from ${message.name}`, 'message');
                    emailjs.send("service_ky2kj3t", "template_24gjzd3", {
                        to_email: "gonahhomes0@gmail.com",
                        to_name: "Admin",
                        from_name: "Gonah Homes System",
                        message: `New message from ${message.name} (${message.email}): ${message.message}`,
                        reply_to: "gonahhomes0@gmail.com"
                    });
                }
            });
            if (this.currentSection === 'messages') this.loadMessages();
        });

        this.db.collection('reviews').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const review = change.doc.data();
                    this.addNotification(`New ${review.rating}-star review`, 'review');
                    emailjs.send("service_ky2kj3t", "template_24gjzd3", {
                        to_email: "gonahhomes0@gmail.com",
                        to_name: "Admin",
                        from_name: "Gonah Homes System",
                        message: `New ${review.rating}-star review: ${review.review}`,
                        reply_to: "gonahhomes0@gmail.com"
                    });
                }
            });
            if (this.currentSection === 'reviews') this.loadReviews();
        });
    }

    addNotification(message, type) {
        this.notifications.unshift({
            id: Date.now(),
            message: message,
            type: type,
            timestamp: new Date(),
            read: false
        });
        this.updateNotificationCount();
    }

    updateNotificationCount() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        document.getElementById('notification-count').textContent = unreadCount;
    }

    toggleNotifications() {
        const dropdown = document.getElementById('notification-dropdown');
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            this.renderNotifications();
        }
    }

    renderNotifications() {
        const notificationList = document.getElementById('notification-list');
        if (this.notifications.length === 0) {
            notificationList.innerHTML = '<div class="notification-item">No notifications</div>';
            return;
        }
        notificationList.innerHTML = this.notifications.slice(0, 10).map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}">
                <div class="notification-content">
                    <p>${notification.message}</p>
                    <span class="notification-time">${this.getTimeAgo(notification.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }

    markAllRead() {
        this.notifications.forEach(n => n.read = true);
        this.updateNotificationCount();
        document.getElementById('notification-dropdown').classList.remove('active');
    }

    filterBookings() {
        const searchTerm = document.getElementById('booking-search').value.toLowerCase();
        const statusFilter = document.getElementById('booking-filter').value;
        const rows = document.querySelectorAll('#bookings-table tr');
        rows.forEach(row => {
            const nameCell = row.cells[1];
            const statusCell = row.cells[6];
            if (nameCell && statusCell) {
                const name = nameCell.textContent.toLowerCase();
                const status = statusCell.textContent.toLowerCase().trim();
                const matchesSearch = name.includes(searchTerm);
                const matchesStatus = statusFilter === '' || status.includes(statusFilter);
                row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
            }
        });
    }

    filterClients() {
        const searchTerm = document.getElementById('client-search').value.toLowerCase();
        const clientCards = document.querySelectorAll('.client-card');
        clientCards.forEach(card => {
            const name = card.querySelector('h3').textContent.toLowerCase();
            const email = card.querySelector('p').textContent.toLowerCase();
            if (name.includes(searchTerm) || email.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else {
            date = new Date(timestamp);
        }
        return date.toLocaleString();
    }

    getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown';
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else {
            date = new Date(timestamp);
        }
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} hours ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays} days ago`;
        return date.toLocaleDateString();
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }

    viewClientHistory(email) {
        this.showToast(`Viewing history for ${email}`, 'info');
    }

    saveNotificationSettings() {
        this.showToast('Notification settings saved', 'success');
    }

    saveBusinessSettings() {
        this.showToast('Business settings saved', 'success');
    }
}

// Global functions for external access
window.showSection = (section) => management.showSection(section);
window.toggleNotifications = () => management.toggleNotifications();
window.markAllRead = () => management.markAllRead();
window.logout = () => management.logout();
window.openWhatsApp = () => management.openWhatsApp();
window.sendQuickMessage = (type) => management.sendQuickMessage(type);
window.sendCustomWhatsApp = () => management.sendCustomWhatsApp();

let management;
document.addEventListener('DOMContentLoaded', () => {
    management = new GonahHomesManagement();
});
