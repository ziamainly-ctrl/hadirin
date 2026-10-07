import { MapPin, Camera, BellRing, ClipboardCheck, FileBarChart, Building2 } from 'lucide-react';

// Copy shared by more than one marketing page (the home hero links to it, /fitur and /bantuan
// render it), kept in one place so the wording can't drift between pages.

export const FEATURES = [
  {
    icon: MapPin,
    title: 'Geofence otomatis',
    description: 'Karyawan hanya bisa absen di dalam radius kantor atau cabang yang Anda tentukan, tanpa alat tambahan.',
  },
  {
    icon: Camera,
    title: 'Selfie wajib',
    description: 'Setiap absen disertai foto selfie, jadi tidak ada lagi titip absen.',
  },
  {
    icon: BellRing,
    title: 'Dashboard & notifikasi',
    description: 'Pantau siapa yang sudah dan belum hadir hari ini, dan dapat notifikasi saat ada yang terlambat.',
  },
  {
    icon: ClipboardCheck,
    title: 'Persetujuan satu klik',
    description: 'Koreksi absen, cuti, sakit, dan izin diajukan dari HP, lalu disetujui atau ditolak dalam satu klik.',
  },
  {
    icon: FileBarChart,
    title: 'Rekap bulanan',
    description: 'Rekap kehadiran per karyawan, lengkap dengan menit terlambat dan jam kerja, siap diunduh sebagai XLSX atau PDF.',
  },
  {
    icon: Building2,
    title: 'Banyak cabang & shift',
    description: 'Setiap cabang punya titik lokasi dan radius sendiri, setiap karyawan punya shift sendiri.',
  },
];

export const STEPS = [
  { title: 'Daftar', description: 'Buat akun perusahaan dalam 1 menit, gratis dan tanpa kartu kredit.' },
  { title: 'Atur cabang & shift', description: 'Tandai lokasi kantor dari GPS HP Anda, lalu atur jam kerjanya.' },
  { title: 'Tambahkan karyawan', description: 'Karyawan langsung absen dari HP masing-masing, tanpa memasang aplikasi.' },
];

export const FAQ = [
  {
    q: 'Apakah karyawan perlu memasang aplikasi?',
    a: 'Tidak. Absensi dibuka lewat browser HP dan bisa ditambahkan ke layar utama seperti aplikasi biasa, tanpa unduh dari Play Store atau App Store.',
  },
  {
    q: 'Bagaimana jika sinyal GPS lemah?',
    a: 'Hadirin memberi tahu karyawan saat akurasi GPS terlalu rendah dan meminta mereka pindah ke tempat yang lebih terbuka.',
  },
  {
    q: 'Bisa dipakai untuk banyak cabang?',
    a: 'Bisa. Setiap cabang punya titik lokasi dan radius sendiri. Jumlah cabang mengikuti paket yang Anda pilih.',
  },
  {
    q: 'Apa yang terjadi saat masa coba gratis berakhir?',
    a: 'Jika belum ada pembayaran, akun otomatis pindah ke paket Gratis selama jumlah karyawan dan cabang masih dalam batasnya. Jika melebihi, Anda perlu naik ke paket berbayar agar karyawan bisa absen lagi. Data Anda tetap tersimpan.',
  },
  {
    q: 'Saya lupa kata sandi, bagaimana?',
    a: 'Karyawan dapat meminta admin perusahaan untuk mengatur ulang kata sandinya dari halaman Karyawan. Admin akan menerima kata sandi sementara yang harus diganti saat masuk pertama kali.',
  },
  {
    q: 'Bagaimana cara absen hari ini?',
    a: 'Masuk ke akun Anda, buka menu Check-in, izinkan lokasi dan kamera, lalu ambil selfie. Waktu absen selalu dicatat oleh server, bukan jam di HP.',
  },
];
