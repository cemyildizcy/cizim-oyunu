// Firebase Configuration — Shared across all pages
const firebaseConfig = {
	apiKey: "AIzaSyCbCrS4ku7_E5qEUqAbFGLjDq3tyD9Tdnw",
	authDomain: "cizgisavaslari-98312.firebaseapp.com",
	databaseURL: "https://cizgisavaslari-98312-default-rtdb.firebaseio.com",
	projectId: "cizgisavaslari-98312",
	storageBucket: "cizgisavaslari-98312.appspot.com",
	messagingSenderId: "236401267419",
	appId: "1:236401267419:web:1e2f9efaba97ad08b532fe"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// ================================================
// AUTH HELPERS
// ================================================

function getCurrentUser() {
	return auth.currentUser;
}

function isLoggedIn() {
	return !!auth.currentUser;
}

function isGuest() {
	const user = auth.currentUser;
	return user && user.isAnonymous;
}

function getUserDisplayName() {
	const user = auth.currentUser;
	if (!user) return 'Misafir';
	if (user.isAnonymous) return 'Misafir';
	return user.displayName || user.email.split('@')[0];
}

// ================================================
// DATABASE HELPERS
// ================================================

async function saveUserProfile(data) {
	const user = auth.currentUser;
	if (!user) return;

	const updates = {
		displayName: getUserDisplayName(),
		email: user.email || '',
		isGuest: user.isAnonymous,
		lastVisitDate: new Date().toISOString().split('T')[0],
		updatedAt: firebase.database.ServerValue.TIMESTAMP,
		...data
	};

	await database.ref('users/' + user.uid).update(updates);

	// Update leaderboard
	if (data.level !== undefined || data.totalXP !== undefined) {
		await database.ref('leaderboard/' + user.uid).set({
			displayName: getUserDisplayName(),
			level: data.level || 1,
			totalXP: data.totalXP || 0
		});
	}
}

async function loadUserProfile() {
	const user = auth.currentUser;
	if (!user) return null;

	const snapshot = await database.ref('users/' + user.uid).once('value');
	return snapshot.val();
}

async function initUserInDB() {
	const user = auth.currentUser;
	if (!user) return;

	const snapshot = await database.ref('users/' + user.uid).once('value');
	if (!snapshot.exists()) {
		await database.ref('users/' + user.uid).set({
			displayName: getUserDisplayName(),
			email: user.email || '',
			level: 1,
			xp: 0,
			totalXP: 0,
			gamesPlayed: [],
			gameClickCounts: {},
			achievements: [],
			dailyStreak: 1,
			lastVisitDate: new Date().toISOString().split('T')[0],
			isGuest: user.isAnonymous,
			createdAt: firebase.database.ServerValue.TIMESTAMP,
			updatedAt: firebase.database.ServerValue.TIMESTAMP
		});
		await database.ref('leaderboard/' + user.uid).set({
			displayName: getUserDisplayName(),
			level: 1,
			totalXP: 0
		});
	}
}

// Auth state listener
function onAuthStateChange(callback) {
	auth.onAuthStateChanged(callback);
}
