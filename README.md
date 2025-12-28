# WinBorg Manager

![WinBorg Manager Dashboard](/images/dashboard.png)

**A modern, Windows 11-styled GUI for BorgBackup.**

WinBorg Manager bridges the gap between the powerful deduplicating backup tool **BorgBackup** and the **Windows** desktop experience. It leverages the **Windows Subsystem for Linux (WSL)** to run Borg natively while providing a seamless, beautiful user interface to manage repositories, create archives, and—most importantly—mount backups directly into Windows Explorer.

## 💡 Motivation

I am fully aware that **Vorta** exists, and it is an excellent tool (Big kudos to the developers!).

However, I wanted to build a **leaner, more modern alternative** specifically for my workflow on Windows. My main goal was to create a lightweight tool that focuses purely on **speed and accessibility**—allowing me to mount archives and browse my files/folders via Windows Explorer instantly, wrapped in a native Windows 11 interface.

## 🚀 Features

*   **Windows 11 Aesthetics:** Clean UI with Mica effects and native look & feel.
*   **WSL Integration:** Runs Borg in a native Linux environment for maximum stability and speed.
*   **Repository Management:** Add, edit, and monitor local or remote (SSH/Hetzner/NAS) repositories.
*   **Visual Monitoring:** See storage efficiency, deduplication savings, and compression stats instantly.
*   **Integrity Checks:** Run and monitor `borg check` operations with ETA calculation.
*   **Lock Management:** Automatically detects stalled lock files and offers a UI to break locks.
*   **One-Click Mount:** Mount archives to the file system and browse them seamlessly in Windows Explorer.

---

## 🛠️ Installation & Setup Guide

This guide is designed for beginners. It assumes you are starting with a standard Windows 10/11 PC and have never used Linux or Borg before.

### Phase 1: Enable WSL (Windows Subsystem for Linux)

WinBorg uses a lightweight Linux (Ubuntu) running in the background to handle the heavy technical work.

1.  Click the **Start Button**, type `PowerShell`.
2.  Right-click "Windows PowerShell" and select **Run as Administrator**.
3.  Copy and paste the following command, then press **Enter**:
    ```powershell
    wsl --install
    ```
4.  **Restart your computer** when asked.
5.  **Crucial Step:** After restarting, a terminal window should open automatically to install **Ubuntu**.
    *   *If it doesn't open automatically:* Search for "Ubuntu" in the Start Menu and open it.
6.  Wait for the installation to finish. You will be asked to create a **Unix Username** and **Password**.
    *   *Tip:* When typing the password, nothing will appear on screen. This is normal. Just type it and press Enter.

### Phase 2: Install Borg Backup Software

Now we install the backup engine inside the Linux system.

1.  Open the **Ubuntu** app from your Start Menu.
2.  Copy and paste this entire command line and press **Enter**:
    ```bash
    sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y
    ```
3.  Enter the password you created in Phase 1 if prompted.

### Phase 3: Setup SSH Keys (For Remote Backups)

Most Borg repositories (like Hetzner StorageBox or rsync.net) require an SSH Key instead of a password.

1.  In the **Ubuntu** terminal, verify if you already have a key or create a new one:
    ```bash
    ssh-keygen -t ed25519
    ```
    *   Press **Enter** 3 times (to accept default path and no passphrase for the key itself).
2.  Display your new public key:
    ```bash
    cat ~/.ssh/id_ed25519.pub
    ```
3.  **Copy the output** (it starts with `ssh-ed25519 ...`).
4.  **Paste this key** into the "Authorized Keys" settings of your backup provider (e.g., Hetzner Console -> StorageBox -> SSH Keys).

### Phase 4: Install WinBorg Manager

1.  Download the latest installer (`.exe`) from the [Releases Page](#).
2.  Run the installer.
3.  Open **WinBorg Manager**.

---

## 📖 User Guide

### 1. Dashboard
The landing page gives you a health check of your backup infrastructure.
*   **Stats:** View total data protected, storage usage, and deduplication efficiency (how much space Borg saved you).
*   **Repository Status:** Quickly see which repos are connected, offline, or locked.
*   **Quick Actions:** Shortcuts to verify integrity or add new sources.

### 2. Repositories
Manage your backup destinations here.
*   **Adding a Repo:** Click "Add Repository".
    *   **Name:** Give it a friendly name (e.g., "Hetzner Box").
    *   **URL:** Enter the SSH URL (e.g., `ssh://u123@u123.your-storagebox.de:23/./backup`).
    *   **Encryption:** Select your mode (Repokey/Keyfile).
    *   **Trust Host:** Check this if connecting for the first time to avoid SSH errors.
*   **Lock Status:** If a backup crashed previously, a repository might be "Locked". WinBorg detects `lock.roster` files and shows a **Locked** badge. You can click the **Unlock** button on the card to force-remove these locks.
*   **Integrity Check:** Click "Verify Integrity" to run a consistency check. WinBorg displays a progress bar and an estimated time of arrival (ETA).

### 3. Archives
Browse the history of your backups.
*   **List:** Shows all snapshots in the currently connected repository.
*   **Stats:** Click "Calc" on any archive to fetch its exact deduplicated size and duration.
*   **Mounting:** Click the **Mount** button next to any archive to make it accessible in Windows.

### 4. Mounts (Accessing your Files)
This is where the magic happens. When you mount an archive:

1.  Go to the **Mounts** tab.
2.  You will see your active mount.
3.  Click the **Open** button.
4.  **Windows Explorer** will open directly into the backup.
    *   *Technical Detail:* The path is located at `\\wsl.localhost\Ubuntu\mnt\wsl\winborg\<archive_name>`.
5.  You can copy/paste files out of the backup just like a normal folder.
6.  **Important:** When finished, click **Unmount** to release the connection.

### 5. Activity
A log of everything WinBorg does.
*   Useful for troubleshooting connection errors or checking when the last verify operation finished.
*   Shows technical command output if you hover over log entries.

---

## 🔧 Troubleshooting

**"Connection Closed" or SSH Errors**
*   Did you complete **Phase 3** of the installation guide? Ensure your public key (`id_ed25519.pub`) is uploaded to your backup server.
*   In WinBorg, when adding a repo, try checking "Trust Unknown SSH Host".

**"Mount Failed: FUSE missing"**
*   WinBorg tries to fix permissions automatically. If it fails, open Ubuntu and run:
    ```bash
    echo "user_allow_other" | sudo tee -a /etc/fuse.conf
    sudo chmod 666 /dev/fuse
    ```

**App says "Repo Locked"**
*   This happens if a previous backup was interrupted (power loss, crash).
*   Go to the **Repositories** tab and click the **Unlock** button on the affected repository card.

---

## 💻 Development

If you want to contribute to WinBorg:

```bash
# Clone the repo
git clone https://github.com/robotnikz/WinBorg.git

# Install dependencies
npm install

# Run React Frontend + Electron Backend
npm run electron
```

## 📄 License

MIT License. See [LICENSE](LICENSE) file for details.
