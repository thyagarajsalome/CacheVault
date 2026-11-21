# CacheVault Pro

> Intelligent Windows Storage Optimization & Cache Management Suite built natively with **Tauri 2.0, Rust, React, TypeScript, and Tailwind CSS**.

---

## 🌟 Overview

**CacheVault Pro** is a high-performance Windows desktop application engineered to liberate storage, manage developer dependencies, prevent system SSD saturation, and monitor disk health using direct Windows kernel storage telemetry.

---

## 🚀 Key Modules

* **Drives Telemetry & Overview:** Sub-millisecond disk capacity queries, NTFS/exFAT file system detection, and cluster slack waste diagnostics.
* **C: Drive Liberator:** Safely purges temporary user sessions, crash dumps, DirectX shader caches, and package caches (npm, pip, Gradle).
* **Windows Known Folder Redirector:** Safeguards your system SSD by rerouting high-volume download traffic to secondary NVMe/SATA drives.
* **Smart Folder Junction Mover:** Relocates heavy application directories to secondary drives while maintaining transparent NTFS symbolic junctions.
* **Drive Blueprint Generator:** 1-click professional folder architecture scaffolding for Developers, Creators, and Storage Vaults.
* **Developer `node_modules` & `.venv` Vacuum:** Scans projects for dormant dependencies (> 30–60 days inactive) to reclaim tens of gigabytes.
* **Giant File Hunter:** Multi-threaded disk scanner locating massive files (> 1 GB, > 2 GB) for inspection.
* **Smart Downloads Auto-Organizer:** Sorts cluttered downloads folders into categorized subfolders by file type.
* **Health & S.M.A.R.T. Watchdog:** Decodes internal microcontroller hardware telemetry to flag physical sector defects before data loss occurs.

---

## 🛠️ Tech Stack

* **Backend / Kernel:** Tauri 2.0, Rust, `sysinfo`, Windows Win32 / Shell APIs
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
* **Architecture:** Non-blocking async multi-threaded runtime (`tauri::async_runtime`)

---

## 📦 Building from Source

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Rust](https://www.rust-lang.org/) (v1.78+)
* Windows 10/11 with WebView2

### Setup & Run
```bash
# Install frontend dependencies
npm install

# Run development server with live reload
npm run tauri dev

# Build standalone production binary
npm run build
npx tauri build --no-bundle
```
