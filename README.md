
# WinBorg Manager

![WinBorg Manager Dashboard](/images/dashboard.png)

**A modern, Windows 11-styled GUI for BorgBackup.**

WinBorg Manager bridges the gap between the powerful deduplicating backup tool **BorgBackup** and the **Windows** desktop experience. It leverages the **Windows Subsystem for Linux (WSL)** to run Borg natively while providing a seamless, beautiful user interface to manage repositories, create archives, and—most importantly—mount backups directly into Windows Explorer.

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

This guide assumes you are starting with a **fresh Windows 11 PC** and have never used WSL or Borg before.

### Phase 1: Enable WSL (Windows Subsystem for Linux)

WinBorg relies on a lightweight Linux installation running in the background to handle the heavy lifting.

1.  Open the **Start Menu**, type `PowerShell`.
2.  Right-click "Windows PowerShell" and select **Run as Administrator**.
3.  Type the following command and press Enter:
    ```powershell
    wsl --install
    ```
4.  **Restart your computer** when prompted.
5.  After restarting, a terminal window will open automatically to finish installing **Ubuntu**. If that's not the case, search in Windows Store for Ubuntu and install it.
6.  Start Ubuntu, When asked, create a **username** and **password** for your Linux system (remember this password).

### Phase 2: Install Borg Dependencies

Now we need to install the backup software inside the Linux system.

1.  Open the **Ubuntu** app (or Terminal) from your Start Menu.
2.  Update your package lists and install Borg + FUSE:
    ```bash
    sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y
    ```
    *Note: WinBorg will handle the permission configuration (user_allow_other) automatically for you.*

### Phase 3: Install WinBorg Manager

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
*   Ensure you have generated an SSH key in WSL (`ssh-keygen`) and added the public key to your backup server.
*   In WinBorg, when adding a repo, verify "Trust Unknown SSH Host" is checked if connecting for the first time.

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
