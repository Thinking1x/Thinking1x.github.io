// ==========================================
// CONFIG.JS — Appwrite Setup & Global State
// ==========================================

// Notice: I removed 'Storage' from the import below!
const { Client, Databases, Account, ID, Query } = Appwrite;

const client = new Client();
client
    .setEndpoint('https://cloud.appwrite.io/v1') // (Make sure this matches your Appwrite region)
    .setProject('6a1d4acd002390236d37'); // Your NEW Appwrite Project ID

const databases = new Databases(client);
const account = new Account(client); 

// ---- Database IDs ----
// You need to grab these from your NEW Appwrite project dashboard!
const DATABASE_ID = '6a1d4af100202f96af67';
const COLLECTION_ID = 'tracks';
const PLAYLIST_COLLECTION_ID = 'playlists';
const USERS_COLLECTION_ID = 'users';

// (I completely deleted BUCKET_ID, you don't need it!)

// ---- Playback State ----
let allTracks = [];
let currentPlaylistTracks = [];
let currentTrackIndex = 0;
let currentViewPlaylistIndex = -1;
let isShuffle = false;
let repeatMode = 0; // 0: Off, 1: Repeat All, 2: Repeat One
let userPlaylists = [];
let isSeeking = false; // Fixes the timeline tug-of-war

// ---- User Session State ----
let currentUser = null;
let currentUserRole = null;
let currentUserId = null;

// ---- DOM References ----
const audio = document.getElementById('audio');
const seekbar = document.getElementById('seekbar');
const volumebar = document.getElementById('volumebar');
const playIcon = document.getElementById('playIcon');

// ---- Restore Saved Volume ----
const savedVolume = localStorage.getItem('userVolume');
if (savedVolume) {
    audio.volume = savedVolume;
    if (volumebar) volumebar.value = savedVolume * 100;
}